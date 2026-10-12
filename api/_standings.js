// api/_standings.js - season standings computed from NASCAR's own race feeds (2026-10-12).
//
// Operator: "does the api carry the points system for each series?" It carries the SCORING, not the
// rulebook: weekend-feed.json gives points_earned / playoff_points_earned per car and stage_results
// per stage. Everything else here is the 2026 rulebook as published (nascar.com "The Chase 101",
// 2026-08-31) and verified against nascar.com's standings page after Cup R32 (13 of 16 Chase drivers
// exact; the three misses were one seed slot each, i.e. post-race penalties the feed never records -
// hence points_adjustments).
//
// 2026 format: no playoffs, no win-and-in. After the regular season the top N in points are reseeded
// once onto a ladder (2100, 2075, 2065, 2060, ... 5-point steps to 2000 for the 16th seed) and race
// the Chase on normal points. Cup: 16 drivers / 10 Chase races; O'Reilly: 12 / 9; Trucks: 10 / 7.
// Race points: win 55 (was 40), then 35, 34, ... ; stage points 10..1. Drivers not declared for
// points in a series earn 0 in the feed, which is exactly what we want.
//
// Tiebreak (NASCAR rulebook, unchanged): most wins, then most 2nds, 3rds, ... down the finishing order.
const { getJson, NASCAR } = require('./_weekend')

const RULES = {
  cup:     { seriesId: 1, chaseDrivers: 16, chaseRaces: 10 },
  oreilly: { seriesId: 2, chaseDrivers: 12, chaseRaces: 9 },
  trucks:  { seriesId: 3, chaseDrivers: 10, chaseRaces: 7 },
}
const LADDER = [2100, 2075, 2065, 2060, 2055, 2050, 2045, 2040, 2035, 2030, 2025, 2020, 2015, 2010, 2005, 2000]

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k) }
  })
  await Promise.all(workers)
  return out
}

// One race's scoring: [{driver_id, name, car, team, make, finish, status, points, stage, laps_led}]
function scoreRace(wk) {
  const race = wk && wk.weekend_race && wk.weekend_race[0]
  if (!race || !(race.results || []).length) return null
  const stage = {}
  ;(race.stage_results || []).forEach(s => (s.results || []).forEach(x => { stage[x.driver_id] = (stage[x.driver_id] || 0) + (+x.stage_points || 0) }))
  const rows = race.results.filter(r => +r.finishing_position > 0).map(r => ({
    driver_id: r.driver_id, name: String(r.driver_fullname || '').trim(), car: String(r.car_number || '').trim(),
    team: r.team_name || null, make: r.car_make || null,
    finish: +r.finishing_position, status: r.finishing_status || null,
    points: +r.points_earned || 0, stage: stage[r.driver_id] || 0, laps_led: +r.laps_led || 0,
  }))
  return { race_id: race.race_id, name: race.race_name, track: race.track_name, date: String(race.race_date || '').slice(0, 10), rows }
}

// Compare two drivers for the tiebreak: wins, then 2nds, 3rds ... (higher count wins)
function finishVectorCmp(a, b) {
  const n = Math.max(a.finishes.length, b.finishes.length)
  for (let p = 1; p <= n; p++) { const d = (b.finishes[p] || 0) - (a.finishes[p] || 0); if (d) return d }
  return 0
}

// races: scoreRace() outputs in date order (points races only, all already run).
// adjustments: [{driver_name, nascar_race_id|null, delta, reason}].
function computeStandings(seriesKey, races, totalPointsRaces, adjustments) {
  const R = RULES[seriesKey]
  // If the schedule feed is short (early January, or a bad read) every race counts as regular season.
  const regularRaces = totalPointsRaces > R.chaseRaces ? totalPointsRaces - R.chaseRaces : Infinity
  const drivers = {}
  const get = (r) => drivers[r.name] || (drivers[r.name] = { name: r.name, car: r.car, team: r.team, make: r.make, driver_id: r.driver_id,
    regular: 0, chase: 0, season: 0, stagePts: 0, starts: 0, wins: 0, top5: 0, top10: 0, dnf: 0, lapsLed: 0, finishes: [], perRace: [], adj: 0 })
  races.forEach((rc, idx) => {
    const inChase = idx >= regularRaces
    rc.rows.forEach(r => {
      const d = get(r)
      d.car = r.car; d.team = r.team; d.make = r.make           // latest entry wins
      d.starts++; d.season += r.points; d.stagePts += r.stage; d.lapsLed += r.laps_led
      if (inChase) d.chase += r.points; else d.regular += r.points
      if (r.finish === 1) d.wins++
      if (r.finish <= 5) d.top5++
      if (r.finish <= 10) d.top10++
      if (r.status && !/running/i.test(r.status)) d.dnf++
      d.finishes[r.finish] = (d.finishes[r.finish] || 0) + 1
      d.perRace.push({ race_id: rc.race_id, finish: r.finish, points: r.points, stage: r.stage })
    })
  })
  // Penalties / credits. A race id ties the adjustment to the half of the season it belongs to;
  // without one it is applied to the regular season (the common case: a Tuesday penalty on a
  // regular-season race).
  const raceIdx = {}; races.forEach((rc, i) => { raceIdx[rc.race_id] = i })
  ;(adjustments || []).forEach(a => {
    const d = drivers[a.driver_name]; if (!d) return
    const i = a.nascar_race_id != null ? raceIdx[a.nascar_race_id] : undefined
    const inChase = i != null && i >= regularRaces
    d.adj += a.delta; d.season += a.delta
    if (inChase) d.chase += a.delta; else d.regular += a.delta
  })
  const all = Object.values(drivers).filter(d => d.season > 0 || d.adj !== 0)
  const byRegular = all.slice().sort((a, b) => (b.regular - a.regular) || finishVectorCmp(a, b))
  const regularDone = races.length >= regularRaces
  byRegular.forEach((d, i) => { d.seed = i + 1 })
  let rows
  if (regularDone) {
    const field = byRegular.slice(0, R.chaseDrivers)
    field.forEach(d => { d.inChase = true; d.reset = LADDER[d.seed - 1]; d.points = d.reset + d.chase })
    const rest = byRegular.slice(R.chaseDrivers)
    rest.forEach(d => { d.inChase = false; d.points = d.season })
    field.sort((a, b) => (b.points - a.points) || finishVectorCmp(a, b))
    rest.sort((a, b) => (b.points - a.points) || finishVectorCmp(a, b))
    rows = field.concat(rest)
  } else {
    rows = byRegular
    rows.forEach(d => { d.points = d.regular; d.inChase = d.seed <= R.chaseDrivers })   // provisional cut line
  }
  const leader = rows.length ? rows[0].points : 0
  rows.forEach((d, i) => { d.pos = i + 1; d.behind = d.points - leader; delete d.finishes })
  return {
    series: seriesKey, rules: { ...R, regularRaces: isFinite(regularRaces) ? regularRaces : null, ladder: LADDER.slice(0, R.chaseDrivers) },
    phase: regularDone ? 'chase' : 'regular', racesRun: races.length, totalPointsRaces,
    races: races.map(r => ({ race_id: r.race_id, name: r.name, track: r.track, date: r.date })),
    rows,
  }
}

// Fetch + compute. sb (optional) = supabase client for points_adjustments.
async function standings(seriesKey, year, sb) {
  const R = RULES[seriesKey]
  if (!R) throw new Error('unknown series ' + seriesKey)
  const sched = await getJson(`${NASCAR}/cacher/${year}/race_list_basic.json`)
  const list = (sched[`series_${R.seriesId}`] || []).filter(r => r.race_type_id === 1 && r.race_id)
    .sort((a, b) => String(a.date_scheduled).localeCompare(String(b.date_scheduled)))
  // date_scheduled is Eastern wall-clock with no zone; read it as UTC and allow 10h (a 3pm ET race is
  // scored by ~7pm ET = 23Z, i.e. 8h past the naive parse). A race without points yet is dropped below.
  const cutoff = Date.now() - 10 * 3600e3
  const past = list.filter(r => Date.parse(String(r.race_date || r.date_scheduled).replace(/Z?$/, 'Z')) < cutoff)
  const scored = await mapLimit(past, 8, async r => {
    try { return scoreRace(await getJson(`${NASCAR}/cacher/${year}/${R.seriesId}/${r.race_id}/weekend-feed.json`)) } catch (e) { return null }
  })
  const races = scored.filter(r => r && r.rows.some(x => x.points > 0))
  let adjustments = []
  if (sb) {
    const { data } = await sb.from('points_adjustments').select('driver_name,nascar_race_id,delta,reason').eq('series', seriesKey).eq('year', year)
    adjustments = data || []
  }
  const out = computeStandings(seriesKey, races, list.length, adjustments)
  out.year = year
  out.adjustments = adjustments
  out.skipped = past.length - races.length
  return out
}

module.exports = { RULES, LADDER, scoreRace, computeStandings, standings }

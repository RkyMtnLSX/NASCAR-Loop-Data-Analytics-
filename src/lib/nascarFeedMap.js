// src/lib/nascarFeedMap.js
//
// Pure mapping from api/nascar-feed.js payloads to the rows we store. No React,
// no Supabase, no network - so it can be executed and checked against real
// stored values without a browser. scripts/verify-feed-mapping.js does exactly
// that; if you change anything here, run it.
//
// It lives apart from the Admin components so that the one-race loader and the
// backfill cannot drift apart: both call mapRace, and there is only one.

export const SERIES_ID = { cup: 1, oreilly: 2, trucks: 3 }
export const SERIES_OPTS = [['cup', 'Cup'], ['oreilly', "O'Reilly"], ['trucks', 'Trucks']]

// Racing Reference reports the three percentage columns to ONE decimal. Verified:
// 223/340 -> 65.6, 126/166 -> 75.9, 5/166 -> 3.0, 22/24 -> 91.7, 6/151 -> 4.0.
export const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0)

// NASCAR spells some drivers differently than loop_data does ("John H. Nemechek"
// vs "John Hunter Nemechek", "AJ Allmendinger" vs "A.J. Allmendinger", "Daniel
// Suárez" vs "Daniel Suarez"). driver_name is the join key for most of the
// product, so OUR spelling wins and the feed only supplies the id.
export const fold = s => (s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[.,'’]/g, '')
  .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
  .replace(/\s+/g, ' ')
  .trim()

export const initialSurname = s => {
  const parts = fold(s).split(' ').filter(Boolean)
  if (parts.length < 2) return ''
  return parts[0][0] + parts[parts.length - 1]
}

// Resolve a feed name to the spelling already in our database.
//   1. the NASCAR id, once any race has been loaded with it   (exact, free)
//   2. accent/punctuation/suffix-folded exact match           (Suárez, A.J.)
//   3. unique first-initial + surname                          (John H. Nemechek)
//   4. the feed's own spelling, and say so                     (genuinely new driver)
export function makeResolver(existing) {
  const byId = new Map()
  const byFold = new Map()
  const byInitial = new Map()
  const initialDupes = new Set()
  for (const r of existing) {
    if (r.nascar_driver_id && !byId.has(r.nascar_driver_id)) byId.set(r.nascar_driver_id, r.driver_name)
    const f = fold(r.driver_name)
    if (f && !byFold.has(f)) byFold.set(f, r.driver_name)
    const k = initialSurname(r.driver_name)
    if (k) {
      if (byInitial.has(k) && byInitial.get(k) !== r.driver_name) initialDupes.add(k)
      else byInitial.set(k, r.driver_name)
    }
  }
  return d => {
    const hitId = byId.get(d.driver_id)
    if (hitId) return { name: hitId, how: 'id' }
    const hitFold = byFold.get(fold(d.driver_fullname))
    if (hitFold) return { name: hitFold, how: 'fold' }
    const k = initialSurname(d.driver_fullname)
    if (k && !initialDupes.has(k) && byInitial.has(k)) return { name: byInitial.get(k), how: 'initial' }
    return { name: d.driver_fullname, how: 'new' }
  }
}

export async function feed(params) {
  const qs = Object.entries(params).filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  const r = await fetch(`/api/nascar-feed?${qs}`)
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
  return j
}

// One race's feed payload -> the rows we store. Pure, so the backfill and the
// loader cannot drift apart.
export function mapRace(payload, ctx) {
  const { series, year, raceNumber, trackName, resolve } = ctx
  const R = payload.race
  // Some races have complete loopstats and an empty weekend feed. Everything
  // sourced from the weekend feed is then unknown - NOT known-to-be-null - and
  // callers must not write it over a stored value. See api/nascar-feed.js.
  // undefined means UNKNOWN (no weekend feed, do not overwrite what is stored);
  // null means KNOWN ABSENT (the feed answered and had nothing there).
  const wk = payload.weekendAvailable !== false

  // Stage results only publish the points-paying top ten, so most drivers get
  // null here. That is the feed's shape, not a load failure.
  const stagePos = {}
  for (const st of payload.stageResults || []) {
    for (const row of st.results || []) {
      stagePos[row.driver_id] = stagePos[row.driver_id] || {}
      stagePos[row.driver_id][st.stage_number] = row.finishing_position
    }
  }

  const rows = payload.drivers.map(d => {
    const L = d.loop
    const { name, how } = resolve(d)
    return {
      __how: how,
      __feedName: d.driver_fullname,
      driver_name: name,
      nascar_driver_id: d.driver_id,
      series,
      year,
      race_number: raceNumber,
      track_name: trackName,
      car_number: !wk ? undefined : (d.car_number != null ? String(d.car_number).trim() : null),
      team_name: wk ? (d.team_name || null) : undefined,
      start_position: L.start_ps,
      mid_race_position: L.mid_ps,
      finish_position: L.ps,
      high_position: L.best_ps,
      low_position: L.worst_ps,
      avg_position: L.avg_ps,
      pass_diff: L.passing_diff,
      green_flag_passes: L.passes_gf,
      green_flag_times_passed: L.passed_gf,
      quality_passes: L.quality_passes,
      pct_quality_passes: pct(L.quality_passes, L.passes_gf),
      fastest_laps: L.fast_laps,
      top15_laps: L.top15_laps,
      pct_top15_laps: pct(L.top15_laps, L.laps),
      laps_led: L.lead_laps,
      pct_laps_led: pct(L.lead_laps, L.laps),
      laps_completed: L.laps,
      driver_rating: L.rating,
      closing_ps: L.closing_ps,
      // Lowercased so it matches both vocabularies already in the column, and
      // so SimulationCenter's `fs && fs !== 'running'` DNF test keeps working.
      finish_status: wk ? ((d.finishing_status || '').trim().toLowerCase() || null) : undefined,
      stage1_finish: wk ? ((stagePos[d.driver_id] || {})[1] ?? null) : undefined,
      stage2_finish: wk ? ((stagePos[d.driver_id] || {})[2] ?? null) : undefined,
    }
  })

  const winner = rows.find(r => r.finish_position === 1)
  const mov = parseFloat(R.margin_of_victory)

  const race = {
    race_name: `${trackName} ${year}`,
    track_name: trackName,
    year,
    race_number: raceNumber,
    series,
    race_date: (R.race_date || R.date_scheduled || '').slice(0, 10) || null,
    nascar_race_id: R.race_id,
    winning_driver: winner ? winner.driver_name : null,
    winning_car_number: !wk ? undefined : (winner ? (winner.car_number ?? null) : null),
    // ACTUAL laps, not scheduled. This is the 142-race correction.
    //
    // Floored at the most laps any driver completed, because NASCAR's two feeds
    // can disagree with each other: the 2024 Daytona 500 reports actual_laps 199
    // in the weekend feed while loopstats has the winner on 200. A race is at
    // least as long as its longest runner, and finish_status is derived from
    // this number, so taking the smaller value reintroduces the exact defect
    // this migration existed to fix.
    total_laps: Math.max(R.actual_laps || 0, ...rows.map(r => r.laps_completed || 0)) || null,
    scheduled_laps: R.scheduled_laps || null,
    total_cautions: wk ? R.number_of_cautions : undefined,
    total_caution_laps: wk ? R.number_of_caution_laps : undefined,
    lead_changes: wk ? R.number_of_lead_changes : undefined,
    avg_speed: wk ? R.average_speed : undefined,
    // Not published as a race total; it is the sum of the driver rows, verified
    // against races.green_flag_passes for cup 2026 R25 and R26.
    green_flag_passes: rows.reduce((s, r) => s + (r.green_flag_passes || 0), 0),
    stage_1_laps: wk ? (R.stage_1_laps ?? null) : undefined,
    stage_2_laps: wk ? (R.stage_2_laps ?? null) : undefined,
    stage_3_laps: wk ? (R.stage_3_laps ?? null) : undefined,
    stage_4_laps: wk ? (R.stage_4_laps ?? null) : undefined,
    margin_of_victory: !wk ? undefined : (Number.isFinite(mov) ? mov : null),
    margin_of_victory_text: !wk ? undefined : (R.margin_of_victory != null ? String(R.margin_of_victory) : null),
    weekendAvailable: wk,
  }

  // Caution segments -> table rows. Ordered by start_lap and numbered from 1, so
  // segment_number is stable across re-runs and the unique key holds.
  const cautions = (payload.cautionSegments || [])
    .filter(c => c && c.start_lap != null)
    .slice()
    .sort((a, b) => a.start_lap - b.start_lap)
    .map((c, i) => ({
      segment_number: i + 1,
      start_lap: c.start_lap,
      end_lap: c.end_lap ?? null,
      reason: c.reason ?? null,
      comment: c.comment ?? null,
      beneficiary_car_number: c.beneficiary_car_number != null ? String(c.beneficiary_car_number) : null,
      flag_state: c.flag_state ?? null,
      series, year, race_number: raceNumber, track_name: trackName,
    }))

  return { race, rows, cautions }
}

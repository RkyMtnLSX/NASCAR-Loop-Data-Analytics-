// src/lib/pitFeeds.js - post-race pit data from NASCAR's feeds, shaped for pit_stops and pit_penalties
// (2026-10-11). Ported from the operator's Python jobs so the Load Race button does what
// POST_RACE_UPDATE.bat did (pitboard_pit_backfill.py + pitboard_penalties_backfill_v3.py); the
// domain rules and every comment that explains a guard came across with the code. CommonJS on
// purpose: api/nascar-feed.js require()s it (shape only) and CRA imports it the same way.
//
// pit_stops:     cacher/live/series_{sid}/{nascar_race_id}/live-pit-data.json (one row per stop)
// pit_penalties: cacher/{year}/{sid}/{nascar_race_id}/lap-notes.json (race-control prose, parsed)
//
// Domain rules (pitboard.md): raw seconds stored, never pooled across series; organization = the
// weekend-feed team_name (crew key = car + org + season); NASCAR sentinels -1 (and 0 for prev/next
// lap time) -> NULL; a penalty MISSED is the safe failure, a FALSE penalty demotes a crew that did
// nothing wrong (the rankings add 1.75s per crew penalty), so the parser only attributes what it
// can place.

// ---------------------------------------------------------------- pit stops
function num(v, zeroIsNull) {
  if (v == null) return null
  const f = parseFloat(v)
  if (!isFinite(f)) return null
  if (f <= 0 && (zeroIsNull || f < 0)) return null
  return f
}
function rank(v) { const i = parseInt(v, 10); return isFinite(i) && i > 0 ? i : null }

// car_number -> team / driver info from weekend_race[0].results.
function buildTeamMap(weekend) {
  const out = {}
  const wr = ((weekend || {}).weekend_race || [{}])[0] || {}
  ;(wr.results || []).forEach(res => {
    const car = String(res.car_number != null ? res.car_number : (res.official_car_number || '')).trim()
    if (car) out[car] = { team_name: res.team_name || res.owner_fullname || null, driver_id: res.driver_id || null, crew_chief: res.crew_chief_fullname || null, pit_box: res.pit_box != null ? res.pit_box : null }
  })
  return out
}

function transformStop(p, teamMap) {
  const car = String(p.vehicle_number != null ? p.vehicle_number : '').trim()
  const tires = ['left_front_tire_changed', 'left_rear_tire_changed', 'right_front_tire_changed', 'right_rear_tire_changed'].reduce((n, k) => n + (p[k] ? 1 : 0), 0)
  const info = teamMap[car] || {}
  const flagIn = p.pit_in_flag_status
  return {
    car_number: car, driver_name: p.driver_name || null, nascar_driver_id: info.driver_id || null,
    organization: info.team_name || null, crew_chief: info.crew_chief || null, manufacturer: p.vehicle_manufacturer || null,
    pit_box: info.pit_box != null ? info.pit_box : null,
    lap: p.lap_count != null ? p.lap_count : null, leader_lap: p.leader_lap != null ? p.leader_lap : null,
    flag_state: flagIn != null ? flagIn : null, flag_state_out: p.pit_out_flag_status != null ? p.pit_out_flag_status : null,
    green_flag: flagIn === 1, pit_stop_type: p.pit_stop_type || null,
    tires_changed: tires, lf: !!p.left_front_tire_changed, lr: !!p.left_rear_tire_changed, rf: !!p.right_front_tire_changed, rr: !!p.right_rear_tire_changed,
    box_time: num(p.pit_stop_duration), pit_road_time: num(p.total_duration),
    in_travel: num(p.in_travel_duration), out_travel: num(p.out_travel_duration),
    pit_in_race_time: num(p.pit_in_race_time), pit_out_race_time: num(p.pit_out_race_time),
    pit_in_rank: rank(p.pit_in_rank), pit_out_rank: rank(p.pit_out_rank),
    positions_gained_lost: p.positions_gained_lost != null ? p.positions_gained_lost : null,
    // 0 here means not-recorded (uniformly 0 pre-~2022) -> NULL
    prev_lap_time: num(p.previous_lap_time, true), next_lap_time: num(p.next_lap_time, true),
  }
}

// NASCAR's archived feed can contain literal duplicate stop rows (same car/lap/pit_in_race_time -
// observed cup 2026 R2). Keep the most complete row per unique-index key.
function dedupeStops(rows) {
  const best = {}
  rows.forEach(r => {
    const key = r.car_number + '|' + r.lap + '|' + (r.pit_in_race_time == null ? -1 : r.pit_in_race_time)
    const score = Object.values(r).filter(v => v != null).length
    if (!best[key] || score > best[key][0]) best[key] = [score, r]
  })
  const out = Object.values(best).map(x => x[1])
  return { rows: out, dropped: rows.length - out.length }
}

// live-pit-data.json is an array of stops (or {pit_stops:[...]} / {data:[...]} in some seasons).
function shapePitStops(pitJson, weekendJson) {
  const stops = Array.isArray(pitJson) ? pitJson : (pitJson && (pitJson.pit_stops || pitJson.data || pitJson.stops)) || []
  const teamMap = buildTeamMap(weekendJson)
  const rows = stops.filter(p => p && p.vehicle_number != null).map(p => transformStop(p, teamMap))
  const d = dedupeStops(rows)
  return { rows: d.rows, dropped: d.dropped, cars: new Set(d.rows.map(r => r.car_number)).size }
}

// ---------------------------------------------------------------- penalties (parser v3, 2026-08-31)
const PEN_SENT = /penalt|violation|too fast|over the wall too soon|uncontrolled tire|too many (?:men|crew)|commitment|improper fueling|outside (?:his |the )?box|improper (?:pit )?(?:entry|exit)|(?:equipment|vehicle) interference|removing equipment|speeding|held for|to the rear|tail end of the field|unapproved adjust/i
const DRIVER_PEN = /speeding|too fast|commitment|outside (?:his |the )?box|improper (?:pit )?(?:entry|exit)|running over (?:the )?equipment/i
const CREW_PEN = /over the wall too soon|crew over the wall|too many (?:men|crew)|uncontrolled tire|improper fueling|safety violation|(?:equipment|vehicle) interference|equipment over the wall|removing equipment|lug ?nut/i
// GRID penalties: pre-race calls that change where a car lines up but appear nowhere in the position
// data. NOT crew and NOT driver - unapproved adjustments is a technical call against the setup.
const GRID_PEN = /to the rear|tail end of the field|unapproved adjust|failed (?:pre-?race )?inspection|inspection failure/i
const GENERIC_PEN = /penalt|violation|held for/i
const CAR = /#(\d+)/g
const SEP = /^[\s,;/]*(?:and|&)?[\s,;/]*$/i
const MAX_FALLBACK_CARS = 6

function classify(segment) {
  // GRID first: "To the rear ... (unapproved adjustments)" carries no crew/driver keyword.
  if (GRID_PEN.test(segment)) return 'grid'
  if (CREW_PEN.test(segment)) return 'crew'
  if (DRIVER_PEN.test(segment)) return 'driver'
  return 'other'
}
function shortPhrase(segment) {
  for (const rx of [GRID_PEN, CREW_PEN, DRIVER_PEN]) {
    const m = rx.exec(segment)
    if (m) {
      const start = Math.max(0, m.index - 30)
      const frag = segment.slice(start, m.index + m[0].length + 15)
      return frag.split(/\s+/).join(' ').slice(0, 80).replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    }
  }
  return segment.trim().split(/\s+/).slice(0, 8).join(' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '')
}
function carMentions(sent) { const out = []; let m; const rx = new RegExp(CAR.source, 'g'); while ((m = rx.exec(sent))) out.push({ car: m[1], start: m.index, end: m.index + m[0].length }); return out }

// Returns { pairs: [[car, phrase, category, sentence]], unparsed: [sentence] }. Three steps in strict
// precedence - trailing segment, leading context for the FIRST car only, interior list members
// inheriting a shared category under the hard cap - then a whole-sentence fallback only when nothing
// else resolved. Each guard's reason is in the Python original (pitboard_penalties_backfill_v3.py).
function parseNote(noteText) {
  const pairs = [], unparsed = []
  const sentences = String(noteText || '').split(/(?<=[.!?])\s+/)
  for (const sent of sentences) {
    if (!PEN_SENT.test(sent)) continue
    let found = []
    const cars = carMentions(sent)
    const sentGeneric = GENERIC_PEN.test(sent)
    // step 1: trailing segment
    cars.forEach((m, i) => {
      const segEnd = i + 1 < cars.length ? cars[i + 1].start : sent.length
      const segment = sent.slice(m.end, segEnd)
      const cat = classify(segment)
      if (cat !== 'other') found.push([m.car, shortPhrase(segment), cat])
      else if (sentGeneric && GENERIC_PEN.test(segment)) found.push([m.car, shortPhrase(segment), 'other'])
    })
    // step 2: leading context, first car only
    if (cars.length && !found.some(f => f[0] === cars[0].car)) {
      const ctxEnd = cars.length > 1 ? cars[1].start : sent.length
      const window = sent.slice(0, ctxEnd)
      const cat = classify(window)
      if (cat !== 'other') found.push([cars[0].car, shortPhrase(window), cat])
    }
    // step 2b: interior list members inherit the shared category (hard cap - pit-lists run 15-21 cars)
    if (cars.length && cars.length <= MAX_FALLBACK_CARS && found.length < cars.length && found.length) {
      const cats = new Set(found.map(f => f[2]))
      if (cats.size === 1) {
        const shared = [...cats][0]
        const got = new Set(found.map(f => f[0]))
        const phrase = shortPhrase(sent)
        const resIdx = new Set(cars.map((m, i) => got.has(m.car) ? i : -1).filter(i => i >= 0))
        cars.forEach((m, i) => {
          if (got.has(m.car)) return
          let chain = false, j = i
          while (j > 0 && SEP.test(sent.slice(cars[j - 1].end, cars[j].start))) { j -= 1; if (resIdx.has(j)) { chain = true; break } }
          if (!chain) { j = i; while (j < cars.length - 1 && SEP.test(sent.slice(cars[j].end, cars[j + 1].start))) { j += 1; if (resIdx.has(j)) { chain = true; break } } }
          if (!chain) return
          const before = i === 0 ? sent.slice(0, m.start) : sent.slice(cars[i - 1].end, m.start)
          let after = i === cars.length - 1 ? sent.slice(m.end) : sent.slice(m.end, cars[i + 1].start)
          if (i === cars.length - 1) after = after.replace(/[.!?\s]*$/, '')
          if (SEP.test(before) && SEP.test(after)) { found.push([m.car, phrase, shared]); got.add(m.car) }
        })
      }
    }
    // step 3: whole-sentence fallback, only when steps 1-2 resolved nothing
    if (!found.length && cars.length && cars.length <= MAX_FALLBACK_CARS) {
      const types = [['grid', GRID_PEN], ['crew', CREW_PEN], ['driver', DRIVER_PEN]].filter(([, rx]) => rx.test(sent)).map(([t]) => t)
      if (types.length === 1) { const phrase = shortPhrase(sent); found = cars.map(m => [m.car, phrase, types[0]]) }
      else if (sentGeneric) { const phrase = shortPhrase(sent); found = cars.map(m => [m.car, phrase, 'other']) }
    }
    if (found.length) found.forEach(([c, p, cat]) => pairs.push([c, p, cat, sent.trim()]))
    else unparsed.push(sent.trim())
  }
  return { pairs, unparsed }
}

// lap-notes.json -> pit_penalties rows (without race_id / registry fields; the caller adds them).
function shapePenalties(notesJson) {
  const laps = (notesJson && notesJson.laps) || {}
  const out = [], seen = new Set(), unparsed = []
  Object.keys(laps).forEach(lap => {
    const lapN = /^\d+$/.test(String(lap)) ? parseInt(lap, 10) : null
    ;(laps[lap] || []).forEach(n => {
      const r = parseNote(n.Note || '')
      r.unparsed.forEach(s => unparsed.push('L' + lap + ': ' + s.slice(0, 160)))
      r.pairs.forEach(([car, phrase, cat, sent]) => {
        const key = lapN + '|' + car + '|' + phrase.toLowerCase()
        if (seen.has(key)) return
        seen.add(key)
        out.push({ lap: lapN, flag_state: n.FlagState != null ? n.FlagState : null, car_number: car, penalty_text: phrase.toLowerCase(), category: cat, note_id: n.NoteID != null ? n.NoteID : null, raw_note: sent.slice(0, 400) })
      })
    })
  })
  const totals = { driver: 0, crew: 0, grid: 0, other: 0 }
  out.forEach(o => { totals[o.category] = (totals[o.category] || 0) + 1 })
  return { rows: out, totals, unparsed, hasNotes: Object.keys(laps).length > 0 }
}

module.exports = { shapePitStops, shapePenalties, parseNote, classify, shortPhrase, buildTeamMap, transformStop, dedupeStops }

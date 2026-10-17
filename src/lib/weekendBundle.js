// src/lib/weekendBundle.js - entry list / qualifying draw / qualifying result / starting grid from
// NASCAR's weekend-feed, shaped once and written the same way by the cron and the Admin panel.
//
// Operator (2026-10-03): "more process to automate the website so I don't have to manually upload so
// much, such as entry lists, qualifying orders". NASCAR's weekend-feed.json carries, per race,
// `weekend_race[0].results` = one row per entered car (driver_fullname, car_number, team_name,
// car_make, driver_id) from the moment the entry list is published, with qualifying_order (the draw),
// qualifying_position and starting_position filled in as the weekend goes; and `weekend_runs` = the
// timed sessions that actually ran (run_type 2 = qualifying) with finishing_position per car.
// Verified 2026-10-03 on Kansas Cup (5628): 36 rows, qualifying_order 1-36, qualifying_position set;
// on Las Vegas Cup (5630) two days out: 36 entries, every order/position 0. Practice lap-by-lap is NOT
// in this feed (the practice PDF upload stays).
//
// CommonJS on purpose: api/ functions require() it and CRA's webpack imports it the same way.

const SERIES_ID = { cup: 1, oreilly: 2, trucks: 3 }
const MIN_FIELD = 20   // fewer rows than this = the feed has not published that piece yet

function alnum(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '') }
function rrId(trackName, year, raceNumber) {
  return String(trackName || '').toLowerCase().replace(/\s+/g, '_') + '_' + year + '_' + (raceNumber || '0')
}

// Shape the weekend feed into the four pieces. Pure: no I/O.
function shapeBundle(wk) {
  const race = (wk && wk.weekend_race && wk.weekend_race[0]) || null
  const results = (race && race.results) || []
  const entries = results.filter(r => r.driver_fullname && r.car_number != null).map(r => ({
    driver_name: String(r.driver_fullname).trim(), car_number: String(r.car_number).trim(),
    team: r.team_name || null, make: r.car_make || null, nascar_driver_id: r.driver_id || null,
  }))
  const draw = results.filter(r => +r.qualifying_order > 0).map(r => ({ driver_name: String(r.driver_fullname).trim(), car_number: String(r.car_number).trim(), draw_order: +r.qualifying_order }))
  const runs = (wk && wk.weekend_runs) || []
  const qrun = runs.filter(r => +r.run_type === 2 && (r.results || []).length >= MIN_FIELD).pop() || null
  let qualifying = []
  let lineup_source = null
  if (qrun) {
    qualifying = qrun.results.filter(r => +r.finishing_position > 0).map(r => ({
      driver_name: String(r.driver_name).trim(), car_number: String(r.car_number).trim(),
      qualifying_position: +r.finishing_position, lap_time: +r.best_lap_time > 0 ? +r.best_lap_time : null,
      qualifying_speed: +r.best_lap_speed > 0 ? +r.best_lap_speed : null,
    }))
    // Audited 2026-10-11 on 13 untimed grids 2022-26: NASCAR writes a qualifying "run" around the
    // metric order when the session is rained out (37 cars in a "Round 1 Group A", best_lap_time 0 on
    // every car, while the same weekend's practice is fully timed). A run with no timed lap is that
    // placeholder, not a session. (Bristol dirt heats also show as an untimed run - label by hand.)
    lineup_source = qualifying.some(q => q.lap_time != null) ? 'qualifying' : 'metric'
  } else {
    const byPos = results.filter(r => +r.qualifying_position > 0)
    if (byPos.length >= MIN_FIELD) {
      qualifying = byPos.map(r => ({ driver_name: String(r.driver_fullname).trim(), car_number: String(r.car_number).trim(), qualifying_position: +r.qualifying_position, lap_time: null, qualifying_speed: +r.qualifying_speed > 0 ? +r.qualifying_speed : null }))
      // Charlotte (oval) Cup 2026 R32 (no practice, no qualifying): the feed filled qualifying_position
      // with the metric order and no timed run, and this branch labelled it 'qualifying'. A session
      // that ran always carries qualifying_speed; a metric grid never does. No run + no speeds = metric.
      // The Simulation Center badge is a toggle for the case this still gets wrong (2026-10-11).
      lineup_source = qualifying.some(q => q.qualifying_speed != null) ? 'qualifying' : 'metric'
    } else {
      // No timed session and no qualifying positions, but a grid: the field was set by metric.
      const byStart = results.filter(r => +r.starting_position > 0 && !(+r.finishing_position > 0))
      if (byStart.length >= MIN_FIELD) {
        qualifying = byStart.map(r => ({ driver_name: String(r.driver_fullname).trim(), car_number: String(r.car_number).trim(), qualifying_position: +r.starting_position, lap_time: null, qualifying_speed: null }))
        lineup_source = 'metric'
      }
    }
  }
  qualifying.sort((a, b) => a.qualifying_position - b.qualifying_position)
  return {
    nascar_race_id: race ? race.race_id : null, race_name: race ? race.race_name : null,
    track_name: race ? race.track_name : null, race_date: race ? String(race.race_date || '').slice(0, 10) : null,
    raced: results.some(r => +r.finishing_position > 0),
    entries, draw, qualifying, lineup_source, qualifying_run: qrun ? qrun.run_name : null,
  }
}

// Write the bundle. ctx = { series, year, race_number, track_name } (the Weekend Config). sb = a
// supabase-js client (service role from the cron, the operator's session from the Admin panel - RLS
// decides). Never deletes. Returns per-piece counts; dry = report only.
async function applyBundle(sb, ctx, b, opts = {}) {
  const dry = !!opts.dry
  // opts.pieces (2026-10-17, qualifying backfill): restrict to a subset of 'entries' | 'draw' | 'qualifying'.
  // The backfill writes qualifying only - it must not touch a Jayski draw order already stored.
  const want = (piece) => !opts.pieces || opts.pieces.indexOf(piece) >= 0
  const out = { entries: 0, draw: 0, qualifying: 0, lineup_source: b.lineup_source, skipped: [] }
  const { series, year, race_number, track_name } = ctx
  if (!series || !year || !track_name) throw new Error('applyBundle: series/year/track_name required')
  if (b.raced && !opts.allowRaced) { out.skipped.push('race already run - nothing written'); return out }

  // Names: a PDF-loaded entry list may already hold this week's drivers under its own spelling
  // ("AJ Allmendinger" vs the feed's "A.J. Allmendinger"). Rows key on driver_name, so the feed's name is
  // mapped onto the stored one BY CAR NUMBER for this race - the upsert then updates that row instead of
  // adding a second driver in the same car. Draw and qualifying rows use the same mapping.
  const { data: cur } = await sb.from('entry_list').select('driver_name,car_number').eq('series', series).eq('race_year', year).eq('track_name', track_name)
  const byCar = {}; (cur || []).forEach(r => { if (r.car_number != null) byCar[String(r.car_number).trim()] = r.driver_name })
  // Collision guard (2026-10-17 backfill): entry_list is keyed by track + year, not by visit, so at a
  // track raced twice a season the same car can carry two drivers; mapping both onto the stored name
  // made one upsert batch hit the same row twice ("ON CONFLICT DO UPDATE command cannot affect row a
  // second time"). Map by car only when the feed name and the stored name are the same person
  // (same last name); otherwise keep the feed's spelling.
  const lastOf = (n) => String(n || '').toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(w => !/^(jr|sr|ii|iii|iv)$/.test(w)).pop() || ''
  const nameOf = (name, car) => { const st = byCar[String(car).trim()]; return st && lastOf(st) === lastOf(name) ? st : name }
  // Entry list. Team spelling: reuse the spelling already stored for this series (this + last season)
  // so the feed's "23XI Racing" and a PDF's "23XI Racing" stay one organization.
  if (!want('entries')) out.skipped.push('entries not requested')
  else if (b.entries.length >= MIN_FIELD) {
    const { data: known } = await sb.from('entry_list').select('organization').eq('series', series).in('race_year', [year - 1, year])
    const spell = {}; (known || []).forEach(r => { if (r.organization && !spell[alnum(r.organization)]) spell[alnum(r.organization)] = r.organization })
    const rows = b.entries.map(e => ({
      series, race_year: year, track_name, driver_name: nameOf(e.driver_name, e.car_number), car_number: e.car_number,
      organization: (e.team && spell[alnum(e.team)]) || e.team, manufacturer: e.make,
    }))
    if (!dry) {
      const { error } = await sb.from('entry_list').upsert(rows, { onConflict: 'series,race_year,track_name,driver_name' })
      if (error) throw new Error('entry_list: ' + error.message)
    }
    out.entries = rows.length
  } else out.skipped.push('entry list not published yet (' + b.entries.length + ' rows)')

  const key = { series, year, track_name, race_number: race_number || 0 }
  if (!want('draw')) out.skipped.push('draw not requested')
  else if (b.draw.length >= MIN_FIELD) {
    const rows = b.draw.map(d => ({ ...key, driver_name: nameOf(d.driver_name, d.car_number), car_number: d.car_number, draw_order: d.draw_order }))
    if (!dry) {
      const { error } = await sb.from('qualifying_results').upsert(rows, { onConflict: 'series,year,track_name,race_number,driver_name' })
      if (error) throw new Error('draw: ' + error.message)
    }
    out.draw = rows.length
  } else out.skipped.push('qualifying draw not published yet')

  if (b.qualifying.length >= MIN_FIELD) {
    const rows = b.qualifying.map(q => ({
      ...key, driver_name: nameOf(q.driver_name, q.car_number), car_number: q.car_number, racing_reference_id: rrId(track_name, year, race_number),
      qualifying_position: q.qualifying_position, qualifying_speed: q.qualifying_speed, lap_time: q.lap_time, lineup_source: b.lineup_source,
    }))
    if (!dry) {
      const { error } = await sb.from('qualifying_results').upsert(rows, { onConflict: 'series,year,track_name,race_number,driver_name' })
      if (error) throw new Error('qualifying: ' + error.message)
    }
    out.qualifying = rows.length
  } else out.skipped.push('qualifying not run yet')
  return out
}

module.exports = { SERIES_ID, MIN_FIELD, shapeBundle, applyBundle, rrId }

// api/_weekend_sync.js - Monday cron (NOT its own function: Hobby plan caps a deployment at 12 serverless
// functions and this was #13, so it is mounted inside api/admin-track.js as GET ?job=weekend-sync and
// vercel.json rewrites /api/weekend-sync there; the cron path is unchanged): set each series' Weekend Config from NASCAR's schedule (2026-10-01).
//
// Operator: "automate the pitboard weekend configurations so I don't have to do it every week".
// vercel.json schedules this for Monday 12:00 UTC (06:00 Mountain). Vercel calls it with
// Authorization: Bearer <CRON_SECRET>; without a matching CRON_SECRET env var nothing runs. GET
// ?dry=1 (with the secret) reports what it would write without writing.
//
// What it writes per series, only when the proposal maps cleanly: track_name / track_label /
// correlation_label / race_number / total_laps / stage1_laps / stage2_laps / correlation_year, and -
// when the race CHANGES - clears eq_overrides and rear_overrides (they are per-race: a rear-of-field
// flag set for Bristol must not follow the config to Kansas). track_years and every other column
// are kept. A series whose track is not in the tracks table is skipped and named in the result, so a
// new venue is set by hand once and mapped forever after.
const { createClient } = require('@supabase/supabase-js')
const W = require('./_weekend')
const B = require('../src/lib/weekendBundle')
const P = require('./_perfects')

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const secret = process.env.CRON_SECRET
  const auth = req.headers['authorization'] || ''
  if (!secret || auth !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' })
  const dry = String((req.query || {}).dry || '') === '1'
  const sb = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const year = new Date().getFullYear()
  try {
    const [{ data: tracks }, { data: current }, schedule] = await Promise.all([
      sb.from('tracks').select('name, correlation_group_label'),
      sb.from('featured_weekend').select('*'),
      W.fetchSchedule(year),
    ])
    const proposed = W.propose(schedule, tracks || [], new Date())
    const cur = {}; (current || []).forEach(r => { cur[r.series] = r })
    const result = {}
    for (const series of Object.keys(proposed)) {
      const p = proposed[series], c = cur[series] || {}
      if (!p.ok) { result[series] = { action: 'skipped', reason: p.reason }; continue }
      const same = c.track_name === p.track_name && c.race_number === p.race_number && c.total_laps === p.total_laps && c.stage1_laps === p.stage1_laps && c.stage2_laps === p.stage2_laps
      if (same) { result[series] = { action: 'unchanged', race: `${p.track_label} R${p.race_number}` }; continue }
      const raceChanged = c.track_name !== p.track_name || c.race_number !== p.race_number
      const row = {
        series, track_name: p.track_name, track_label: p.track_label, correlation_label: p.correlation_label,
        correlation_year: year, race_number: p.race_number, total_laps: p.total_laps,
        stage1_laps: p.stage1_laps, stage2_laps: p.stage2_laps,
        track_years: (c.track_years && c.track_years.length) ? c.track_years : [2022, 2023, 2024, 2025, year].filter((v, i, a) => a.indexOf(v) === i),
        updated_at: new Date().toISOString(),
        ...(raceChanged ? { eq_overrides: {}, rear_overrides: {} } : {}),
      }
      if (!dry) {
        const { error } = await sb.from('featured_weekend').upsert(row, { onConflict: 'series' })
        if (error) { result[series] = { action: 'error', error: error.message }; continue }
      }
      result[series] = { action: dry ? 'would-set' : 'set', from: c.track_name ? `${c.track_label || c.track_name} R${c.race_number}` : null, to: `${p.track_label} R${p.race_number} · ${p.total_laps} laps · stages ${p.stage1_laps}/${p.stage2_laps} · ${p.race_date}`, overridesCleared: raceChanged }
    }
    // 2026-10-04: make sure the races REGISTRY has a row for every featured race. The practice uploader's
    // race-number guard reads `races`; at a second visit (Las Vegas fall = cup R31) only the spring row
    // existed, so the guard offered "upload as R5" - wrong. Rows for a race that has not run yet are
    // exactly what the O'Reilly schedule already had (Phoenix R30 etc.); cup lacked them. Insert-if-
    // missing from the schedule: name, date, nascar id, laps, stage lengths (stage_*_end are generated).
        const registry = {}
    for (const series of Object.keys(proposed)) {
      const p = proposed[series]
      if (!p.ok || !p.race_number) continue
      try {
        const { data: have } = await sb.from('races').select('id').eq('series', series).eq('year', year).eq('race_number', p.race_number).limit(1)
        if (have && have.length) { registry[series] = 'exists'; continue }
        const row = {
          race_name: p.race_name, series, year, race_number: p.race_number, track_name: p.track_name, race_date: p.race_date || null,
          // racing_reference_id stays NULL until the race loader writes it: the loader's "already loaded"
          // check and the Load Data status strip both key on it (Vegas R31 2026-10-04: a pre-filled id
          // made the strip say "up to date" and the loader refuse the real load).
          racing_reference_id: null, nascar_race_id: p.nascar_race_id,
          scheduled_laps: p.total_laps, stage_1_laps: p.stage1_laps, stage_2_laps: p.stage2_laps - p.stage1_laps, stage_3_laps: p.total_laps - p.stage2_laps, exhibition: false,
        }
        if (!dry) { const { error } = await sb.from('races').insert(row); if (error) throw error }
        registry[series] = (dry ? 'would-create ' : 'created ') + `R${p.race_number} ${p.track_label}`
      } catch (e) { registry[series] = 'error: ' + e.message }
    }
    // 2026-10-03: entry list / qualifying draw / qualifying result from the same feed, per series, every
    // run (daily now, twice a day via vercel.json). Idempotent upserts, never deletes, skips a race
    // that has already run. Uses the PROPOSED race (= the config after this run).
    const loads = {}
    for (const series of Object.keys(proposed)) {
      const p = proposed[series]
      if (!p.ok || !p.nascar_race_id) continue
      try {
        const wk = await W.getJson(`https://cf.nascar.com/cacher/${year}/${B.SERIES_ID[series]}/${p.nascar_race_id}/weekend-feed.json`)
        const b = B.shapeBundle(wk)
        loads[series] = { race: `${p.track_label} R${p.race_number}`, ...(await B.applyBundle(sb, { series, year, race_number: p.race_number, track_name: p.track_name }, b, { dry })) }
      } catch (e) { loads[series] = { error: e.message } }
    }
    // 2026-10-06: Optimal Lineup Archive - perfect lineup + priced field for every loaded race that has a
    // DK salary file and no row yet (the archive had frozen at cup R25 because nothing wrote new rows).
    let perfects = null
    try { perfects = await P.syncPerfects(sb, year, { dry }) } catch (e) { perfects = { error: e.message } }
    return res.status(200).json({ ok: true, dry, year, result, registry, loads, perfects })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}

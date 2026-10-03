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
    return res.status(200).json({ ok: true, dry, year, result, loads })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}

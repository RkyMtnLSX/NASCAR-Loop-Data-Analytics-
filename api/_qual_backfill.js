// api/_qual_backfill.js - fill qualifying_results from NASCAR's weekend-feed archive (2026-10-17).
//
// Operator asked for the Qualifying Center to be looked at; the first finding was that its averages
// ran on a qualifying table with holes (Cup 2022: 33 of 36 races, 2024: 34, 2025: 32, 2026: 29 of 32)
// and O'Reilly / Trucks had only this season's synced races. Every missing race is in
// cacher/{year}/{series}/{race}/weekend-feed.json. This job walks a season's points races, keys each
// on the `races` table row (series, year, race_number -> canonical track_name, the same key loop_data
// uses), and writes QUALIFYING ROWS ONLY through the shared bundle shape - entry lists and draw orders
// are left alone (a Jayski draw order must never be overwritten by the feed's car-number sort).
//
// GET /api/admin-track?job=qual-backfill&series=cup|oreilly|trucks&year=2025[&dry=1][&limit=12]
// Bearer CRON_SECRET. Processes up to `limit` missing races per call (Hobby function budget) and
// reports `remaining` so the caller loops.
const { createClient } = require('@supabase/supabase-js')
const W = require('./_weekend')
const B = require('../src/lib/weekendBundle')

const SID = { cup: 1, oreilly: 2, trucks: 3 }

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  // Either operator secret: CRON_SECRET (the Monday sync) or SNAP_SECRET (the pg_cron Kalshi job) - the
  // backfill is driven from Supabase pg_net, which carries the latter.
  const auth = req.headers['authorization'] || ''
  const okAuth = [process.env.CRON_SECRET, process.env.SNAP_SECRET].filter(Boolean).some(sec => auth === `Bearer ${sec}`)
  if (!okAuth) return res.status(401).json({ error: 'unauthorized' })
  const q = req.query || {}
  const series = String(q.series || '')
  const year = Number(q.year)
  const dry = String(q.dry || '') === '1'
  const limit = Math.max(1, Math.min(40, Number(q.limit) || 12))
  if (!SID[series] || !(year >= 2015 && year <= 2030)) return res.status(400).json({ error: 'series=cup|oreilly|trucks and year required' })
  const sb = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  try {
    const [sched, { data: raceRows }, { data: tracks }, { data: have }] = await Promise.all([
      W.fetchSchedule(year),
      sb.from('races').select('race_number,track_name,race_date').eq('series', series).eq('year', year),
      sb.from('tracks').select('name'),
      sb.from('qualifying_results').select('track_name,race_number').eq('series', series).eq('year', year).not('qualifying_position', 'is', null),
    ])
    const names = (tracks || []).map(t => t.name)
    const byRn = {}; (raceRows || []).forEach(r => { byRn[r.race_number] = r })
    const haveN = {}; (have || []).forEach(r => { const k = r.track_name + '|' + (r.race_number || 0); haveN[k] = (haveN[k] || 0) + 1 })
    const list = (sched[`series_${SID[series]}`] || []).filter(r => r.race_type_id === 1 && r.race_id)
      .sort((a, b) => String(a.date_scheduled).localeCompare(String(b.date_scheduled)))
    const cutoff = Date.now() - 6 * 3600e3
    const plan = []
    list.forEach((r, i) => {
      const rn = i + 1
      if (Date.parse(String(r.date_scheduled).replace(/Z?$/, 'Z')) > cutoff) return    // not run yet
      const row = byRn[rn]
      const track = row ? row.track_name : W.canonTrack(r, names)
      const k = track + '|' + rn
      plan.push({ rn, race_id: r.race_id, feed_track: r.track_name, track, date: String(r.date_scheduled).slice(0, 10), have: haveN[k] || 0, in_races_table: !!row })
    })
    const missing = plan.filter(p => p.track && p.have < B.MIN_FIELD)
    const unmapped = plan.filter(p => !p.track)
    const todo = missing.slice(0, limit)
    const results = []
    for (const p of todo) {
      try {
        const wk = await W.getJson(`${W.NASCAR}/cacher/${year}/${SID[series]}/${p.race_id}/weekend-feed.json`)
        const b = B.shapeBundle(wk)
        if (b.qualifying.length < B.MIN_FIELD) { results.push({ ...p, result: 'feed has no qualifying (' + b.qualifying.length + ' rows)' }); continue }
        const out = await B.applyBundle(sb, { series, year, race_number: p.rn, track_name: p.track }, b, { dry, allowRaced: true, pieces: ['qualifying'] })
        results.push({ ...p, result: (dry ? 'would write ' : 'wrote ') + out.qualifying + ' rows', lineup_source: out.lineup_source, run: b.qualifying_run })
      } catch (e) { results.push({ ...p, result: 'error: ' + e.message }) }
    }
    return res.status(200).json({ series, year, dry, points_races: list.length, run_so_far: plan.length, already_loaded: plan.length - missing.length - unmapped.length, missing: missing.length, processed: results.length, remaining: Math.max(0, missing.length - todo.length), unmapped, results })
  } catch (e) { return res.status(502).json({ error: e.message }) }
}

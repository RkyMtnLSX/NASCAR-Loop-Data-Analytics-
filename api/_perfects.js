// api/_perfects.js - keep the Optimal Lineup Archive current (2026-10-06).
//
// Operator: "how come the optimal archive stops at New Hampshire?" The 2022-2026 corpus in
// dfs_optimal_history was loaded ONCE from workbooks (BACKTEST_LOG 08-29/08-30); nothing wrote a row
// when a new race loaded, so the public archive froze at cup R25 while six more races ran. This runs
// inside the daily sync (service role): for every race of the season that has loop data AND a stored
// DK salary file but no 'perfect' row, compute the best cap-legal six on ACTUAL DK points, write the
// lineup + the full priced field, and refresh race_seq / race_cnt for that track-year so two-visit
// tracks label "Daytona 1 / Daytona 2". Idempotent; never overwrites an existing row.
const CAP = 50000, ROSTER = 6
const DKTBL = [0, 45, 42, 41, 40, 39, 38, 37, 36, 35, 34, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
function dkPoints(fin, start, ll, fl) {
  if (fin == null) return null
  const f = Math.round(+fin), s = (start == null || isNaN(+start)) ? f : +start
  return (f >= 1 && f <= 40 ? DKTBL[f] : 0) + (s - f) + (+ll || 0) * 0.25 + (+fl || 0) * 0.45
}
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const nrm = s => fold(s).replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '').replace(/[^a-z0-9]/g, '')
const fl = s => { const p = fold(s).replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean); return p.length >= 2 ? p[0] + p[p.length - 1] : p.join('') }

// best 6 under the cap by actual points - branch and bound over drivers sorted by points
function perfectSix(rows) {
  const c = rows.filter(r => r.pts != null && r.sal > 0).sort((a, b) => b.pts - a.pts)
  const m = c.length
  if (m < ROSTER) return null
  let best = null, bestPts = -Infinity
  const suffixTop = (i, k) => { let s = 0, n = 0; for (let j = i; j < m && n < k; j++) { s += c[j].pts; n++ } return s }
  const dfs = (i, chosen, sal, pts) => {
    if (chosen.length === ROSTER) { if (pts > bestPts) { bestPts = pts; best = chosen.slice() } return }
    const need = ROSTER - chosen.length
    for (let j = i; j <= m - need; j++) {
      if (sal + c[j].sal > CAP) continue
      if (pts + c[j].pts + suffixTop(j + 1, need - 1) <= bestPts) break
      chosen.push(c[j]); dfs(j + 1, chosen, sal + c[j].sal, pts + c[j].pts); chosen.pop()
    }
  }
  dfs(0, [], 0, 0)
  return best ? { lineup: best, score: +bestPts.toFixed(2), salary: best.reduce((a, r) => a + r.sal, 0) } : null
}

async function syncPerfects(sb, year, opts = {}) {
  const dry = !!opts.dry
  const out = { checked: 0, written: [], skipped: [], errors: [] }
  const { data: races, error: rErr } = await sb.from('races').select('id,series,race_number,track_name').eq('year', year).not('total_laps', 'is', null).eq('exhibition', false)
  if (rErr) { out.errors.push('races: ' + rErr.message); return out }
  const { data: have } = await sb.from('dfs_optimal_history').select('series,race_number').eq('race_year', year).eq('kind', 'perfect')
  const haveK = new Set((have || []).map(r => r.series + '|' + r.race_number))
  const { data: sals } = await sb.from('dfs_salaries').select('series,race_number,salaries,updated_at').eq('race_year', year).order('updated_at', { ascending: true })
  const salByK = {}; (sals || []).forEach(r => { salByK[r.series + '|' + r.race_number] = r.salaries || {} })   // latest wins (ascending order)
  const touched = new Set()
  for (const race of races || []) {
    const k = race.series + '|' + race.race_number
    if (haveK.has(k)) continue
    out.checked++
    const salaries = salByK[k]
    if (!salaries || !Object.keys(salaries).length) { out.skipped.push(k + ': no DK salary file'); continue }
    try {
      const { data: laps, error: lErr } = await sb.from('loop_data').select('driver_name,finish_position,start_position,laps_led,fastest_laps').eq('race_id', race.id)
      if (lErr) throw lErr
      if (!laps || laps.length < 20) { out.skipped.push(k + ': loop data has ' + (laps ? laps.length : 0) + ' rows'); continue }
      const byN = {}, byFL = {}
      Object.keys(salaries).forEach(n => { byN[nrm(n)] = +salaries[n] || 0; byFL[fl(n)] = +salaries[n] || 0 })
      const field = laps.map(l => {
        const sal = byN[nrm(l.driver_name)] != null ? byN[nrm(l.driver_name)] : byFL[fl(l.driver_name)]
        return { name: l.driver_name, sal: sal || 0, start: l.start_position == null ? null : Math.round(+l.start_position), fin: l.finish_position == null ? null : Math.round(+l.finish_position),
          ll: +l.laps_led || 0, fl: +l.fastest_laps || 0, pts: dkPoints(l.finish_position, l.start_position, l.laps_led, l.fastest_laps) }
      })
      const priced = field.filter(d => d.sal > 0)
      if (priced.length < 20) { out.skipped.push(k + ': only ' + priced.length + ' of ' + field.length + ' drivers matched a salary'); continue }
      const best = perfectSix(priced)
      if (!best) { out.skipped.push(k + ': no cap-legal six'); continue }
      const lineup = best.lineup.map(d => ({ name: d.name, sal: d.sal, start: d.start, fin: d.fin, pts: +d.pts.toFixed(2) }))
      if (!dry) {
        const { error: e1 } = await sb.from('dfs_optimal_history').insert({ series: race.series, race_year: year, race_number: race.race_number, track_name: race.track_name, kind: 'perfect', lineup, score: best.score, salary: best.salary, source: 'sync:' + new Date().toISOString().slice(0, 10) })
        if (e1) throw e1
        const fieldRow = { series: race.series, race_year: year, race_number: race.race_number, track_name: race.track_name, field: priced.map(d => ({ ...d, pts: +d.pts.toFixed(2) })), source: 'sync' }
        const { data: fx } = await sb.from('dfs_race_field').select('id').eq('series', race.series).eq('race_year', year).eq('race_number', race.race_number).limit(1)
        const { error: e2 } = fx && fx.length ? await sb.from('dfs_race_field').update(fieldRow).eq('id', fx[0].id) : await sb.from('dfs_race_field').insert(fieldRow)
        if (e2) throw e2
      }
      touched.add(race.series + '|' + race.track_name)
      out.written.push(k + ' ' + race.track_name + ' ' + best.score + ' $' + best.salary + (dry ? ' (dry)' : ''))
    } catch (e) { out.errors.push(k + ': ' + e.message) }
  }
  // race_seq / race_cnt for every track-year this run touched (ordinal of the visit within the season)
  if (!dry) {
    for (const tk of touched) {
      const [series, track] = tk.split('|')
      const { data: rows } = await sb.from('dfs_optimal_history').select('id,race_number').eq('race_year', year).eq('kind', 'perfect').eq('series', series).eq('track_name', track).order('race_number', { ascending: true })
      for (let i = 0; i < (rows || []).length; i++) await sb.from('dfs_optimal_history').update({ race_seq: i + 1, race_cnt: rows.length }).eq('id', rows[i].id)
    }
  }
  return out
}

module.exports = { syncPerfects, perfectSix, dkPoints }

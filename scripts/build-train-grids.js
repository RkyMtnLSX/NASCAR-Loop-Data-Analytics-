// scripts/build-train-grids.js — 2026-10-10: leak-free trail10 projected grids for the 274 train races (2022-24),
// production rules (trail10-v2.1 hybrid): mean of the driver's last 10 PRIOR same-series start percentiles
// ((start - 1) / (field - 1)), minimum 3; SS and ROAD races use same-category history, ovals use oval history;
// re-ranked 1..K among eligible drivers; ineligible drivers get null (the harness scores them at 50, as the
// engine does for a missing start). No v4 form term (2022-24 is pre-metric). Inputs: scratch hist.json (the
// 10-10 loop_data pull, 2022-26 all series) and the track names carried by dom-train-actuals / dominator-actuals.
// Output: backtest-data/train-grids.json { race_id: { 'start:finish': projectedRank } }.
const fs = require('fs'), path = require('path')
const E = require('./loadEngine'); const { isSuperspeedway, isRoadCourse } = E
const D = f => path.join(__dirname, 'backtest-data', f)
const H = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const tracks = {}
JSON.parse(fs.readFileSync(D('dom-train-actuals.json'), 'utf8')).forEach(r => { tracks[r.race_id] = r.track_name })
const RF = JSON.parse(fs.readFileSync(D('race-features.json'), 'utf8'))
const FEAT = JSON.parse(fs.readFileSync(D('protocol-features.json'), 'utf8'))
// test race tracks from dominator-actuals (has no track) -> use holdout-practice lines via FEAT
fs.readFileSync(D('holdout-practice.txt'), 'utf8').split('\n').forEach((line, li) => { const f = FEAT['test|' + li]; if (!f) return; const h = line.split('#')[0].split('|'); const off = h.length === 10 ? 1 : 0; tracks[f.race_id] = h[off + 1] })
const cat = rid => { const t = tracks[rid]; if (!t) return 'OVAL'; return isSuperspeedway(t) ? 'SS' : isRoadCourse(t) ? 'ROAD' : 'OVAL' }
const out = {}; let elig = 0, tot = 0
const trainIds = new Set(Object.keys(FEAT).filter(k => k.startsWith('train|')).map(k => FEAT[k].race_id))
for (const series of Object.keys(H.hist)) {
  const drivers = H.hist[series]
  // index every race's rows
  const byRace = {}
  for (const [drv, L] of Object.entries(drivers)) for (const [rid, yr, rn, st, fi] of L) (byRace[rid] = byRace[rid] || []).push({ drv, yr, rn, st, fi })
  for (const rid of Object.keys(byRace).map(Number)) {
    if (!trainIds.has(rid)) continue
    const rows = byRace[rid]; const yr = rows[0].yr, rn = rows[0].rn; const c = cat(rid)
    const vals = rows.map(r => {
      const prior = drivers[r.drv].filter(([pid, py, prn, pst]) => (py < yr || (py === yr && prn < rn)) && pst > 0 && cat(pid) === c)
        .sort((a, b) => (b[1] - a[1]) || (b[2] - a[2])).slice(0, 10)
      tot++
      if (prior.length < 3) return null
      elig++
      return prior.reduce((s, [pid, , , pst]) => s + (pst - 1) / Math.max(1, H.fieldN[pid] - 1), 0) / prior.length
    })
    const idx = vals.map((v, i) => i).filter(i => vals[i] != null).sort((a, b) => vals[a] - vals[b]); const rk = new Array(vals.length).fill(null); idx.forEach((i, k) => { rk[i] = k + 1 })
    out[rid] = Object.fromEntries(rows.map((r, i) => [r.st + ':' + r.fi, rk[i]]))
  }
}
fs.writeFileSync(D('train-grids.json'), JSON.stringify(out))
console.log(`train races with projected grids: ${Object.keys(out).length}; driver rows ${tot}, eligible ${elig} (${(100 * elig / tot).toFixed(1)}%)`)

// scripts/backtest-practice-weight.js — REGISTERED 2026-10-18 (BACKTEST_LOG): the sim's practice weight
// (longRunPace) per track group, swept on holdout-practice.txt with a season split both ways.
//   SIMS=8000 node scripts/backtest-practice-weight.js
const fs = require('fs'), path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup,
  isRoadCourse, isSuperspeedway, DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS,
  TRUCK_ROAD_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } = E
const SIMS = Number(process.env.SIMS || 8000)
const D = f => path.join(__dirname, 'backtest-data', f)
const FEAT = JSON.parse(fs.readFileSync(D('protocol-features.json'), 'utf8'))
const POOLS = JSON.parse(fs.readFileSync(D('dom-pools.json'), 'utf8'))
const num = s => (s === '' || s == null ? null : Number(s))
const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
function wf(se, tr) {
  if (isRoadCourse(tr)) return se === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(tr)) return se === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (se === 'trucks' && __trackGroup(tr) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
const shipped = b => ({ series: b.series, carDnf: b.series === 'trucks' ? { k: 32 } : null, ...((b.g === 'INT' || b.g === 'SHORT') && POOLS[b.series] && POOLS[b.series][b.g] ? { domBoot: POOLS[b.series][b.g] } : {}), lappedTraffic: b.series === 'oreilly' ? { series: 'oreilly', k: 1.5 } : null })
const boards = []
fs.readFileSync(D('holdout-practice.txt'), 'utf8').split('\n').forEach((line, li) => {
  if (!line.trim() || line.indexOf('#') === -1) return
  const [h, b] = line.split('#'); const hf = h.split('|'); const off = hf.length === 10 ? 1 : 0
  const year = off ? +hf[0] : null
  const [series, track, grp, pDnf, pN, pCau] = hf.slice(off)
  const fj = FEAT['test|' + li]; if (!fj) return
  const base = [], fin = []; let nP = 0
  for (const rec of b.split(';')) {
    const f = rec.split(','); if (f.length < 9) continue
    const v = num(f[9]); if (v != null) nP++
    const key = (f[0] === '' ? -1 : Math.round(+f[0])) + ':' + Math.round(+f[1]); const ft = fj.feat[key] || [null, 0]
    base.push({ name: 'D' + base.length, startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]), nCorrRaces: num(f[5]) || 0, trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]), nTrackRaces: num(f[8]) || 0, lrpTime: v, pitCrewTime: null, corrWinConv: null, ownDnf: ft[0], ownDnfN: ft[1] })
    fin.push(num(f[1]))
  }
  if (base.length < 15 || nP < base.length * 0.5) return
  const P = getCautionPresets(series), cau = num(pCau), g = __trackGroup(track)
  boards.push({ li, year, series, track, g, base, fin, w: wf(series, track), rate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0), asym: series !== 'cup' && (g === 'INT' || g === 'SHORT'),
    preset: cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2] : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a) })
})
const spearman = (a, b) => { const n = a.length; const rk = v => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(n); for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; const m = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = m; i = j + 1 } return r }; const ra = rk(a), rb = rk(b); const ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (ra[i] - ma) * (rb[i] - mb); sxx += (ra[i] - ma) ** 2; syy += (rb[i] - mb) ** 2 } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0 }
const cl = p => Math.max(1e-6, Math.min(1 - 1e-6, p))
function score(b, wLrp, seed) {
  const w = wLrp == null ? b.w : Object.assign({}, b.w, { longRunPace: wLrp })
  const sc = buildSpeedScores(b.base, w)
  const rows = runRaceSim(sc, { numSims: SIMS, cautionPreset: b.preset, dnfRate: b.rate, totalRaceLaps: 300, trackGroup: b.g, startSampling: null, asymNoise: b.asym, seed, ...shipped(b) })
  const pf = [], af = []; let t10 = 0, wb = 0, t5b = 0, nn = 0, fav = null
  for (const r of rows) {
    const f = b.fin[r.simIdx]; if (f == null) continue
    pf.push(r.projFinish); af.push(f); nn++
    t10 += (cl(r.top10Pct / 100) - (f <= 10 ? 1 : 0)) ** 2; wb += (cl(r.winPct / 100) - (f === 1 ? 1 : 0)) ** 2; t5b += (cl(r.top5Pct / 100) - (f <= 5 ? 1 : 0)) ** 2
    if (!fav || r.winPct > fav.winPct) fav = { winPct: r.winPct, f }
  }
  return { rho: spearman(pf, af), t10: t10 / nn, wb: wb / nn, t5b: t5b / nn, favStated: fav.winPct / 100, favHit: fav.f === 1 ? 1 : 0 }
}
const W = [0, 0.10, 0.15, 0.20, 0.25, 0.30]
console.log(`${boards.length} boards with practice (${['cup', 'oreilly', 'trucks'].map(s => s + ' ' + boards.filter(b => b.series === s).length).join(', ')}); groups ${JSON.stringify(boards.reduce((m, b) => { m[b.g] = (m[b.g] || 0) + 1; return m }, {}))}; years ${JSON.stringify(boards.reduce((m, b) => { m[b.year] = (m[b.year] || 0) + 1; return m }, {}))}; ${SIMS} sims; engine ${E.__engineSha}`)
const res = {}   // li -> w -> metrics
for (const b of boards) { res[b.li] = {}; for (const w of W) res[b.li][w] = score(b, w, 12345) }
const agg = (bs, w) => { const rs = bs.map(b => res[b.li][w]); return { n: rs.length, rho: mean(rs.map(r => r.rho)), t10: mean(rs.map(r => r.t10)), wb: mean(rs.map(r => r.wb)), t5b: mean(rs.map(r => r.t5b)), favGap: mean(rs.map(r => r.favStated)) - mean(rs.map(r => r.favHit)) } }
const wl = (bs, w, w0, key, better) => { let a = 0, l = 0; bs.forEach(b => { const d = better === 'high' ? res[b.li][w][key] - res[b.li][w0][key] : res[b.li][w0][key] - res[b.li][w][key]; if (d > 1e-12) a++; else if (d < -1e-12) l++ }); return a + '/' + l }
const fmt = (a) => `rho ${a.rho.toFixed(4)} t10 ${a.t10.toFixed(5)} winB ${a.wb.toFixed(5)} t5B ${a.t5b.toFixed(5)} favGap ${(100 * a.favGap).toFixed(1)}`
for (const g of ['INT', 'SHORT', 'ROAD']) {
  const gb = boards.filter(b => b.g === g); if (!gb.length) continue
  console.log(`\n=== ${g} (${gb.length} boards: ${['cup', 'oreilly', 'trucks'].map(s => s + ' ' + gb.filter(b => b.series === s).length).join(', ')}) ===`)
  for (const yr of [2025, 2026]) {
    const bs = gb.filter(b => b.year === yr); if (!bs.length) continue
    console.log(` ${yr} (${bs.length}):`)
    for (const w of W) console.log(`   w ${w.toFixed(2)}  ${fmt(agg(bs, w))}  vs .15: t10 ${wl(bs, w, 0.15, 't10', 'low')} rho ${wl(bs, w, 0.15, 'rho', 'high')} winB ${wl(bs, w, 0.15, 'wb', 'low')} t5B ${wl(bs, w, 0.15, 't5b', 'low')}`)
  }
  for (const s of ['cup', 'oreilly', 'trucks']) {
    const bs = gb.filter(b => b.series === s); if (bs.length < 4) continue
    console.log(` ${s} (${bs.length}, both seasons): ` + W.map(w => `w${w.toFixed(2)} t10 ${agg(bs, w).t10.toFixed(5)} (${wl(bs, w, 0.15, 't10', 'low')})`).join(' | '))
  }
}
fs.writeFileSync(D('practice-weight-result.json'), JSON.stringify({ sims: SIMS, engine: E.__engineSha, boards: boards.map(b => ({ li: b.li, year: b.year, series: b.series, g: b.g, track: b.track })), res }, null, 1))

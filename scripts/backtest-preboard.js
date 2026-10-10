// scripts/backtest-preboard.js — REGISTERED 2026-10-10 (BACKTEST_LOG): PRE-BOARD study, stage 1 (diagnostic,
// control engine only, nothing ships). The same 2025-26 boards under three input conditions:
//   POST   real grid + practice            (holdout-practice lines with >= 50% practice coverage)
//   NOPRAC real grid, no practice          (all fingerprint-matched lines, lrpTime null)
//   PRE    PROJECTED grid, no practice     (production projection: trail10 + v4 form term for cup / O'Reilly,
//                                           trail10 for trucks; projected-start shading x0.7 as in production;
//                                           per-sim start sampling (#73) NOT reproduced - noted)
//   PRE0   PRE without the x0.7 shading    (reference only)
// Shipped engine throughout (trucks carDnf, domBoot INT+SHORT, SS FL budget, O'Reilly lapped traffic).
//   SIMS=20000 node scripts/backtest-preboard.js
const fs = require('fs'), path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup,
  isRoadCourse, isSuperspeedway, DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS,
  TRUCK_ROAD_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } = E
const SIMS = Number(process.env.SIMS || 20000)
const D = f => path.join(__dirname, 'backtest-data', f)
const FEAT = JSON.parse(fs.readFileSync(D('protocol-features.json'), 'utf8'))
const POOLS = JSON.parse(fs.readFileSync(D('dom-pools.json'), 'utf8'))
const BETA = { cup: JSON.parse(fs.readFileSync(D('start-v4-fit.json'), 'utf8')).beta, oreilly: JSON.parse(fs.readFileSync(D('start-v4-fit-oreilly.json'), 'utf8')).beta, trucks: null }
const num = s => (s === '' || s == null ? null : Number(s))
const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
function wf(se, tr) {
  if (isRoadCourse(tr)) return se === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(tr)) return se === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (se === 'trucks' && __trackGroup(tr) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
const shipped = b => ({ series: b.series, carDnf: b.series === 'trucks' ? { k: 32 } : null, ...((b.g === 'INT' || b.g === 'SHORT') && POOLS[b.series] && POOLS[b.series][b.g] ? { domBoot: POOLS[b.series][b.g] } : {}), lappedTraffic: b.series === 'oreilly' ? { series: 'oreilly', k: 1.5 } : null })
// projection study rows (start-v4 files) by fingerprint
const PROJ = {}
for (const se of ['cup', 'oreilly', 'trucks']) {
  for (const l of fs.readFileSync(D(`start-v4-${se}-2025-26.txt`), 'utf8').split('\n')) {
    if (!l.trim() || l.startsWith('#')) continue
    const [h, b] = l.split('#'); const [id, yr, rn, grp, track] = h.split('|')
    const rows = b.split(';').map(r => { const f = r.split(','); return { st: +f[0], fi: +f[1], tr: num(f[2]), lfp: num(f[3]) } })
    PROJ[se + '|' + rows.map(r => r.st + ':' + r.fi).sort().join('|')] = { grp, rows }
  }
}
function projectedRank(series, R) {
  const beta = BETA[series]; const b = beta ? (beta[R.grp] || 0) : 0
  const vals = R.rows.map(d => d.tr == null ? null : d.tr + (d.lfp == null ? 0 : b * (d.lfp - 0.5)))
  const idx = vals.map((v, i) => i).filter(i => vals[i] != null).sort((a, c) => vals[a] - vals[c]); const rk = new Array(vals.length).fill(null); idx.forEach((i, k) => { rk[i] = k + 1 })
  return Object.fromEntries(R.rows.map((d, i) => [d.st + ':' + d.fi, rk[i]]))
}
const boards = []
fs.readFileSync(D('holdout-practice.txt'), 'utf8').split('\n').forEach((line, li) => {
  if (!line.trim() || line.indexOf('#') === -1) return
  const [h, b] = line.split('#'); const hf = h.split('|'); const off = hf.length === 10 ? 1 : 0
  const [series, track, grp, pDnf, pN, pCau] = hf.slice(off)
  const fj = FEAT['test|' + li]; if (!fj) return
  const recs = b.split(';').map(r => r.split(',')).filter(f => f.length >= 9)
  const fp = series + '|' + recs.map(f => Math.round(+f[0]) + ':' + Math.round(+f[1])).sort().join('|')
  const R = PROJ[fp] || null; const pr = R ? projectedRank(series, R) : null
  const base = [], fin = []; let nP = 0
  recs.forEach((f, i) => {
    const v = num(f[9]); if (v != null) nP++
    const key = (f[0] === '' ? -1 : Math.round(+f[0])) + ':' + Math.round(+f[1]); const ft = fj.feat[key] || [null, 0]
    base.push({ name: 'D' + i, startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]), nCorrRaces: num(f[5]) || 0, trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]), nTrackRaces: num(f[8]) || 0, lrpTime: v, pitCrewTime: null, corrWinConv: null, ownDnf: ft[0], ownDnfN: ft[1], __proj: pr ? pr[key] : null })
    fin.push(num(f[1]))
  })
  if (base.length < 15) return
  const P = getCautionPresets(series), cau = num(pCau), g = __trackGroup(track)
  boards.push({ series, track, g, base, fin, hasPractice: nP >= base.length * 0.5, hasProj: !!pr, w: wf(series, track), rate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0), asym: series !== 'cup' && (g === 'INT' || g === 'SHORT'),
    preset: cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2] : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a) })
})
const spearman = (a, b) => { const n = a.length; const rk = v => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(n); for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; const m = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = m; i = j + 1 } return r }; const ra = rk(a), rb = rk(b); const ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (ra[i] - ma) * (rb[i] - mb); sxx += (ra[i] - ma) ** 2; syy += (rb[i] - mb) ** 2 } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0 }
const cl = p => Math.max(1e-6, Math.min(1 - 1e-6, p))
function runCond(b, cond) {
  const drivers = b.base.map(d => {
    const x = { ...d }
    if (cond !== 'POST') x.lrpTime = null
    if (cond === 'PRE' || cond === 'PRE0') { x.startPos = d.__proj; if (cond === 'PRE') x.__startProjected = true }
    return x
  })
  const sc = buildSpeedScores(drivers, b.w, { lapPenalty: b.series !== 'cup' })
  const rows = runRaceSim(sc, { numSims: SIMS, cautionPreset: b.preset, dnfRate: b.rate, totalRaceLaps: 300, trackGroup: b.g, startSampling: null, asymNoise: b.asym, carCeilFloor: true, ...shipped(b) })
  const elite = new Set(sc.map((d, ix) => ({ ix, r: d.corrAvgRating || 0 })).sort((x, y) => y.r - x.r).slice(0, 5).map(x => x.ix))
  const pf = [], af = []; let t10 = 0, wb = 0, t5b = 0, nn = 0, fav = null, winnerRank = null, gridErr = 0, gridN = 0
  const order = rows.slice().sort((x, y) => y.winPct - x.winPct)
  order.forEach((r, k) => { if (b.fin[r.simIdx] === 1) winnerRank = k + 1 })
  const cells = { eliteFront: [], eliteDeep: [], neP26: [] }; let tlS = 0, tlA = 0, tlN = 0, mdS = 0, mdA = 0, mdN = 0
  for (const r of rows) {
    const f = b.fin[r.simIdx]; if (f == null) continue
    pf.push(r.projFinish); af.push(f); nn++
    t10 += (cl(r.top10Pct / 100) - (f <= 10 ? 1 : 0)) ** 2; wb += (r.winPct / 100 - (f === 1 ? 1 : 0)) ** 2; t5b += (r.top5Pct / 100 - (f <= 5 ? 1 : 0)) ** 2
    if (!fav || r.winPct > fav.winPct) fav = { winPct: r.winPct, f }
    if (r.winPct < 3) { tlS += r.winPct / 100; tlA += f === 1 ? 1 : 0; tlN++ } else if (r.winPct < 10) { mdS += r.winPct / 100; mdA += f === 1 ? 1 : 0; mdN++ }
    const d = b.base[r.simIdx], sp = d.startPos, res = f - r.projFinish   // cells keyed on the REAL grid in every condition
    if (sp != null && b.g !== 'SS') { if (elite.has(r.simIdx) && sp <= 5) cells.eliteFront.push(res); if (elite.has(r.simIdx) && sp >= 16) cells.eliteDeep.push(res); if (!elite.has(r.simIdx) && sp >= 26) cells.neP26.push(res) }
    if ((cond === 'PRE' || cond === 'PRE0') && d.__proj != null && sp != null) { gridErr += Math.abs(d.__proj - sp); gridN++ }
  }
  return { series: b.series, g: b.g, rho: spearman(pf, af), t10: t10 / nn, wb: wb / nn, t5b: t5b / nn, favStated: fav.winPct / 100, favHit: fav.f === 1 ? 1 : 0, winnerRank,
    tailGap: tlN ? (tlS - tlA) / tlN : null, midGap: mdN ? (mdS - mdA) / mdN : null, eliteFront: mean(cells.eliteFront), eliteDeep: mean(cells.eliteDeep), neP26: mean(cells.neP26), gridMAE: gridN ? gridErr / gridN : null }
}
const CONDS = ['POST', 'NOPRAC', 'PRE', 'PRE0']
const res = {}; CONDS.forEach(c => { res[c] = [] })
console.log(`${boards.length} boards (${boards.filter(b => b.hasPractice).length} with practice, ${boards.filter(b => b.hasProj).length} with a projected grid), ${SIMS} sims; engine ${E.__engineSha}`)
for (const b of boards) for (const c of CONDS) { if (c === 'POST' && !b.hasPractice) continue; if ((c === 'PRE' || c === 'PRE0') && !b.hasProj) continue; res[c].push({ ...runCond(b, c), id: b.series + '|' + b.track + '|' + boards.indexOf(b) }) }
const agg = (rs) => { const m = k => mean(rs.filter(r => r[k] != null).map(r => r[k])); return { n: rs.length, rho: m('rho'), t10: m('t10'), wb: m('wb'), t5b: m('t5b'), favGap: m('favStated') - m('favHit'), favHit: m('favHit'), winnerRank: m('winnerRank'), midGap: m('midGap'), tailGap: m('tailGap'), eliteFront: m('eliteFront'), eliteDeep: m('eliteDeep'), neP26: m('neP26'), gridMAE: m('gridMAE') } }
const fmt = (a) => `n=${String(a.n).padStart(3)}  rho ${a.rho.toFixed(4)}  t10 ${a.t10.toFixed(5)}  winB ${a.wb.toFixed(5)}  t5B ${a.t5b.toFixed(5)} | fav gap ${(100 * a.favGap).toFixed(1).padStart(6)}  fav hits ${(100 * a.favHit).toFixed(0)}%  winner's sim rank ${a.winnerRank.toFixed(2)} | mid ${(100 * a.midGap).toFixed(1)}  tail ${(100 * a.tailGap).toFixed(2)} | eliteFront ${a.eliteFront.toFixed(2)}  eliteDeep ${a.eliteDeep.toFixed(2)}  neP26 ${a.neP26.toFixed(2)}${a.gridMAE != null && !isNaN(a.gridMAE) ? `  grid MAE ${a.gridMAE.toFixed(2)}` : ''}`
for (const s of ['cup', 'oreilly', 'trucks']) {
  console.log(`\n${s.toUpperCase()}`)
  for (const c of CONDS) { const rs = res[c].filter(r => r.series === s); if (rs.length) console.log(`  ${c.padEnd(7)} ${fmt(agg(rs))}`) }
  // SAME-BOARD deltas: NOPRAC vs POST on the practice boards; PRE vs NOPRAC on the projection boards
  const postIds = new Set(res.POST.filter(r => r.series === s).map(r => r.id)), preIds = new Set(res.PRE.filter(r => r.series === s).map(r => r.id))
  const np1 = res.NOPRAC.filter(r => r.series === s && postIds.has(r.id)), np2 = res.NOPRAC.filter(r => r.series === s && preIds.has(r.id))
  if (np1.length) { const A = agg(res.POST.filter(r => r.series === s)), B = agg(np1); console.log(`  practice removed (same ${np1.length} boards): t10 ${A.t10.toFixed(5)} -> ${B.t10.toFixed(5)}  rho ${A.rho.toFixed(4)} -> ${B.rho.toFixed(4)}  fav gap ${(100 * A.favGap).toFixed(1)} -> ${(100 * B.favGap).toFixed(1)}  fav hits ${(100 * A.favHit).toFixed(0)}% -> ${(100 * B.favHit).toFixed(0)}%`) }
  if (np2.length) { const B = agg(np2), C = agg(res.PRE.filter(r => r.series === s)), C0 = agg(res.PRE0.filter(r => r.series === s)); console.log(`  grid projected (same ${np2.length} boards): t10 ${B.t10.toFixed(5)} -> ${C.t10.toFixed(5)} (unshaded ${C0.t10.toFixed(5)})  rho ${B.rho.toFixed(4)} -> ${C.rho.toFixed(4)}  fav gap ${(100 * B.favGap).toFixed(1)} -> ${(100 * C.favGap).toFixed(1)} (unshaded ${(100 * C0.favGap).toFixed(1)})  fav hits ${(100 * B.favHit).toFixed(0)}% -> ${(100 * C.favHit).toFixed(0)}%  winner rank ${B.winnerRank.toFixed(2)} -> ${C.winnerRank.toFixed(2)}`) }
  for (const g of ['INT', 'SHORT', 'ROAD', 'SS']) { const line = CONDS.map(c => { const rs = res[c].filter(r => r.series === s && r.g === g); return rs.length >= 4 ? `${c} n${rs.length} t10 ${agg(rs).t10.toFixed(4)} fav ${(100 * agg(rs).favGap).toFixed(0)} hit ${(100 * agg(rs).favHit).toFixed(0)}%` : null }).filter(Boolean); if (line.length) console.log(`    ${g.padEnd(5)} ` + line.join('  |  ')) }
}
fs.writeFileSync(D('preboard-stage1.json'), JSON.stringify(res))

// scripts/backtest-dominators.js — REGISTERED 2026-10-09 (BACKTEST_LOG): dominator concentration, stage 1.
// Shipped engine (trucks carDnf ON = production), 94 practice-holdout boards 2025-26, 20k sims. Compares
// the sim's per-draw TOP laps-led / fastest-laps share against the actual top share (PIT), per-driver
// ordering, the favourite's calibration and DK dominator-point error. Diagnostic only - nothing ships.
//
//   SIMS=20000 node scripts/backtest-dominators.js
const fs = require('fs'), path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup,
  isRoadCourse, isSuperspeedway, DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS,
  TRUCK_ROAD_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } = E
const SIMS = Number(process.env.SIMS || 20000)
const D = f => path.join(__dirname, 'backtest-data', f)
const FEAT = JSON.parse(fs.readFileSync(D('protocol-features.json'), 'utf8'))
const ACT = {}; JSON.parse(fs.readFileSync(D('dominator-actuals.json'), 'utf8')).forEach(r => { ACT[r.race_id] = r })
const num = s => (s === '' || s == null ? null : Number(s))
function wf(se, tr) {
  if (isRoadCourse(tr)) return se === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(tr)) return se === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (se === 'trucks' && __trackGroup(tr) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
const boards = []
fs.readFileSync(D('holdout-practice.txt'), 'utf8').split('\n').forEach((line, li) => {
  if (!line.trim() || line.indexOf('#') === -1) return
  const [h, b] = line.split('#'); const hf = h.split('|'); const off = hf.length === 10 ? 1 : 0
  const [series, track, grp, pDnf, pN, pCau] = hf.slice(off)
  const fj = FEAT['test|' + li]; if (!fj || !ACT[fj.race_id]) return
  const act = {}; ACT[fj.race_id].recs.split(';').forEach(r => { const f = r.split(','); act[f[0] + ':' + f[1]] = { ll: +f[2], fl: +f[3] } })
  const laps = +ACT[fj.race_id].laps
  const base = [], ll = [], fl = [], fin = []; let i = 0, nP = 0
  for (const rec of b.split(';')) {
    const f = rec.split(','); if (f.length < 9) continue
    const v = num(f[9]); if (v != null) nP++
    const key = (f[0] === '' ? -1 : Math.round(+f[0])) + ':' + Math.round(+f[1])
    const ft = (fj.feat[key] || [null, 0]), a = act[key] || { ll: 0, fl: 0 }
    base.push({ name: 'D' + i, startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]), nCorrRaces: num(f[5]) || 0,
      trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]), nTrackRaces: num(f[8]) || 0, lrpTime: v, pitCrewTime: null, corrWinConv: null, ownDnf: ft[0], ownDnfN: ft[1] })
    ll.push(a.ll); fl.push(a.fl); fin.push(num(f[1])); i++
  }
  if (base.length < 15 || nP < base.length * 0.5) return
  const P = getCautionPresets(series), cau = num(pCau), g = __trackGroup(track)
  boards.push({ series, track, g, base, ll, fl, fin, laps, w: wf(series, track), rate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0),
    asym: series !== 'cup' && (g === 'INT' || g === 'SHORT'),
    preset: cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2] : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a) })
})
const spearman = (a, b) => { const n = a.length; const rk = v => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(n); for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; const m = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = m; i = j + 1 } return r }; const ra = rk(a), rb = rk(b); const ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (ra[i] - ma) * (rb[i] - mb); sxx += (ra[i] - ma) ** 2; syy += (rb[i] - mb) ** 2 } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0 }
const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
const POOLS = fs.existsSync(D('dom-pools.json')) ? JSON.parse(fs.readFileSync(D('dom-pools.json'), 'utf8')) : null
const ARM = process.env.ARM || 'A'   // A = shipped; B = shipped + domBoot (stage 2)
const res = []
console.log(`${boards.length} boards, ${SIMS} sims; engine ${E.__engineSha}; trucks carDnf ON; ARM ${ARM}${ARM === 'B' ? ' (domBoot pools 2022-24)' : ''}`)
for (const b of boards) {
  const sc = buildSpeedScores(b.base, b.w)
  const diag = {}
  const boot = ARM === 'B' && POOLS && POOLS[b.series] && POOLS[b.series][b.g] ? POOLS[b.series][b.g] : null
  const rows = runRaceSim(sc, { numSims: SIMS, cautionPreset: b.preset, dnfRate: b.rate, totalRaceLaps: b.laps || 300, trackGroup: b.g, startSampling: null, asymNoise: b.asym,
    carDnf: b.series === 'trucks' ? { k: 32 } : null, __domDiag: diag, ...(boot ? { domBoot: boot } : {}) })
  // guards (finish + probabilities) and LL / FL MAE
  const cl = p => Math.max(1e-6, Math.min(1 - 1e-6, p))
  let t10 = 0, wll = 0, t5ll = 0, nn = 0; const pf = [], af = []
  rows.forEach(r => { const f = b.fin[r.simIdx]; if (f == null) return; nn++; pf.push(r.projFinish); af.push(f); t10 += (cl(r.top10Pct / 100) - (f <= 10 ? 1 : 0)) ** 2; const pw = cl(r.winPct / 100), p5 = cl(r.top5Pct / 100); wll += -(f === 1 ? Math.log(pw) : Math.log(1 - pw)); t5ll += -(f <= 5 ? Math.log(p5) : Math.log(1 - p5)) })
  const guards = { rhoFin: spearman(pf, af), t10: t10 / nn, wll: wll / nn, t5ll: t5ll / nn }
  const L = b.laps || 300
  const actTopLL = Math.max.apply(null, b.ll) / L
  const flTot = Math.max(1, b.fl.reduce((s, x) => s + x, 0)), actTopFL = Math.max.apply(null, b.fl) / flTot
  const pit = (arr, v) => arr.length ? arr.filter(x => x < v).length / arr.length + 0.5 * arr.filter(x => x === v).length / arr.length : null
  const pitLL = pit(diag.topLL || [], actTopLL), pitFL = pit(diag.topFL || [], actTopFL)
  const projLL = new Array(sc.length).fill(0), projFL = new Array(sc.length).fill(0)
  rows.forEach(r => { projLL[r.simIdx] = r.projLapsLed; projFL[r.simIdx] = r.avgFastLaps })
  const rhoLL = spearman(projLL, b.ll), rhoFL = spearman(projFL, b.fl)
  const fav = projLL.indexOf(Math.max.apply(null, projLL))
  const favProj = projLL[fav], favAct = b.ll[fav]
  const top3 = projLL.map((v, i) => [v, i]).sort((a, c) => c[0] - a[0]).slice(0, 3).map(x => x[1])
  const dkErr = mean(projLL.map((v, i) => (0.25 * v + 0.45 * projFL[i]) - (0.25 * b.ll[i] + 0.45 * b.fl[i])))
  const dkErrTop3 = mean(top3.map(i => (0.25 * projLL[i] + 0.45 * projFL[i]) - (0.25 * b.ll[i] + 0.45 * b.fl[i])))
  const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))) }
  const maeLL = mean(projLL.map((v, i) => Math.abs(v - b.ll[i]))), maeFL = mean(projFL.map((v, i) => Math.abs(v - b.fl[i])))
  res.push({ series: b.series, g: b.g, pitLL, pitFL, rhoLL, rhoFL, favProj, favAct, dkErr, dkErrTop3, actTopLL, simTopLL: mean(diag.topLL || []), simSdLL: sd(diag.topLL || []), actTopFL, simTopFL: mean(diag.topFL || []), simSdFL: sd(diag.topFL || []), maeLL, maeFL, ...guards })
}
const cells = {}
res.forEach(r => { (cells[r.series + ' ' + r.g] = cells[r.series + ' ' + r.g] || []).push(r); (cells['ALL ' + r.g] = cells['ALL ' + r.g] || []).push(r); (cells[r.series + ' all'] = cells[r.series + ' all'] || []).push(r) })
cells['ALL all'] = res
console.log('\ncell               n | LL: PIT mean  >.9  <.1  | top share sim/act | FL: PIT mean  >.9  <.1 | top share sim/act | rhoLL rhoFL | fav proj/act LL | DK dom err all / top3')
Object.keys(cells).sort().forEach(k => {
  const c = cells[k]; if (c.length < 8) return
  const p = v => (100 * v).toFixed(0) + '%'
  const hi = (key) => c.filter(r => r[key] != null && r[key] > 0.9).length / c.length, lo = (key) => c.filter(r => r[key] != null && r[key] < 0.1).length / c.length
  const sdA = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))) }
  console.log('   ' + k + ': within-race sd of sim top LL share ' + (100 * mean(c.map(r => r.simSdLL))).toFixed(1) + ' pts vs across-race sd of ACTUAL top share ' + (100 * sdA(c.map(r => r.actTopLL))).toFixed(1) + ' pts; FL ' + (100 * mean(c.map(r => r.simSdFL))).toFixed(1) + ' vs ' + (100 * sdA(c.map(r => r.actTopFL))).toFixed(1))
  console.log('   ' + k + ': maeLL ' + mean(c.map(r => r.maeLL)).toFixed(2) + '  maeFL ' + mean(c.map(r => r.maeFL)).toFixed(2) + '  | guards rhoFin ' + mean(c.map(r => r.rhoFin)).toFixed(4) + '  t10 ' + mean(c.map(r => r.t10)).toFixed(5) + '  winLL ' + mean(c.map(r => r.wll)).toFixed(4) + '  t5LL ' + mean(c.map(r => r.t5ll)).toFixed(4))
  console.log(k.padEnd(18) + String(c.length).padStart(3) + ' |   ' + mean(c.map(r => r.pitLL)).toFixed(2) + '     ' + p(hi('pitLL')).padStart(4) + ' ' + p(lo('pitLL')).padStart(4) + '  |   ' + p(mean(c.map(r => r.simTopLL))) + ' / ' + p(mean(c.map(r => r.actTopLL))) + '   |   ' + mean(c.map(r => r.pitFL)).toFixed(2) + '     ' + p(hi('pitFL')).padStart(4) + ' ' + p(lo('pitFL')).padStart(4) + ' |   ' + p(mean(c.map(r => r.simTopFL))) + ' / ' + p(mean(c.map(r => r.actTopFL))) + '   | ' + mean(c.map(r => r.rhoLL)).toFixed(3) + ' ' + mean(c.map(r => r.rhoFL)).toFixed(3) + ' |  ' + mean(c.map(r => r.favProj)).toFixed(1) + ' / ' + mean(c.map(r => r.favAct)).toFixed(1) + '   |  ' + mean(c.map(r => r.dkErr)).toFixed(2) + ' / ' + mean(c.map(r => r.dkErrTop3)).toFixed(2))
})
fs.writeFileSync(D('dominator-result-' + ARM + (process.env.RUN || '') + '.json'), JSON.stringify(res))

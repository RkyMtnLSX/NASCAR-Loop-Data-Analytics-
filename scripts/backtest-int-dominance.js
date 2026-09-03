// scripts/backtest-int-dominance.js — the pre-registered INT dominance-level harness
// (BACKTEST_LOG 2026-09-03). Read that registration before changing anything here.
//
//   SIMS=4000 node scripts/backtest-int-dominance.js            # fit on train, then holdout
//   PHASE=train  ... only fits + train-side reference (holdout never opened)
//   PHASE=holdout ... requires scripts/backtest-data/int-dominance-fit.json from a train run
//
// Arms: CONTROL | A (green-lap FL budget) | B (A + strength-keyed pool + sorted-share curves)
//       | C (B with per-draw bootstrap of real share vectors) | NULL (control, other seed).
// Inputs: the committed leak-free reconstruction lines, joined to loop_data actuals by
// (start, finish) fingerprint. Cup INT only. Practice arm reads holdout-practice.txt.

const fs = require('fs')
const path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, dkFinishPts,
  DEFAULT_WEIGHTS, __trackGroup, isSuperspeedway } = E

const SIMS = Number(process.env.SIMS || 4000)
const PHASE = process.env.PHASE || 'all'
const D = p => path.join(__dirname, 'backtest-data', p)
const num = s => (s === '' || s == null ? null : Number(s))

// ---- seeded RNG so arms are reproducible and the NULL arm is a real second seed
function seedRandom(seed) {
  let a = seed >>> 0
  Math.random = function () { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// ---- actuals
const actuals = {}
for (const l of fs.readFileSync(D('int-dominance-actuals.txt'), 'utf8').split('\n')) {
  if (!l.trim() || l.startsWith('#')) continue
  const [h, b] = l.split('#')
  const [id, yr, track, date, laps, cau] = h.split('|')
  const rows = b.split(';').map(r => r.split(',').map(Number)).map(([st, fi, ll, fl]) => ({ st, fi, ll, fl }))
  const fp = rows.map(r => r.st + ':' + r.fi).sort().join('|')
  actuals[fp] = { id, yr: +yr, track, date, laps: +laps, cau: +cau, rows, byKey: Object.fromEntries(rows.map(r => [r.st + ':' + r.fi, r])) }
}

// ---- reconstruction lines -> boards (cup INT only, matched to actuals)
function loadBoards(file, withPractice) {
  const out = []
  for (const line of fs.readFileSync(D(file), 'utf8').split('\n')) {
    if (!line.trim()) continue
    const [h, b] = line.split('#'); if (!b) continue
    const hf = h.split('|'); const off = hf.length === 10 ? 1 : 0   // holdout-practice carries a leading year
    const [series, track, grp, pDnf, pN, pCau] = hf.slice(off)
    if (series !== 'cup' || __trackGroup(track) !== 'INT') continue
    const recs = b.split(';').map(r => r.split(',')).filter(f => f.length >= 9)
    const fp = recs.map(f => f[0] + ':' + f[1]).sort().join('|')
    const A = actuals[fp]; if (!A) continue
    const drivers = recs.map((f, i) => ({
      name: 'D' + i, startPos: num(f[0]),
      corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]), nCorrRaces: num(f[5]) || 0,
      trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]), nTrackRaces: num(f[8]) || 0,
      lrpTime: withPractice ? num(f[9]) : null, pitCrewTime: null, corrWinConv: null,
      __act: A.byKey[f[0] + ':' + f[1]],
    }))
    if (drivers.length < 15) continue
    if (withPractice && drivers.filter(d => d.lrpTime != null).length < drivers.length * 0.5) continue
    const P = getCautionPresets(series), cau = num(pCau)
    const preset = cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2]
      : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a)
    out.push({ A, series, track, drivers, preset, dnfRate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0) })
  }
  return out
}
const bucketOfCau = c => (c <= 5 ? 'low' : c <= 8 ? 'mid' : 'high')

// ---- TRAIN-side derivations (registration: G_FL, sorted-share curves, bootstrap pools, k)
function deriveFromTrain(train) {
  const vecs = { LL: { low: [], mid: [], high: [] }, FL: { low: [], mid: [], high: [] } }
  let flSum = 0
  const topWin = [], topFin = []
  for (const b of train) {
    const A = b.A; const cb = bucketOfCau(A.cau)
    const sLL = A.rows.reduce((s, r) => s + r.ll, 0), sFL = A.rows.reduce((s, r) => s + r.fl, 0)
    flSum += sFL / A.laps
    const vLL = A.rows.map(r => r.ll / sLL).sort((x, y) => y - x), vFL = A.rows.map(r => r.fl / Math.max(1, sFL)).sort((x, y) => y - x)
    const pad = v => { const o = new Array(40).fill(0); for (let i = 0; i < Math.min(40, v.length); i++) o[i] = v[i]; const t = o.reduce((a, c) => a + c, 0); return o.map(x => x / t) }
    vecs.LL[cb].push(pad(vLL)); vecs.FL[cb].push(pad(vFL))
    const top = A.rows.slice().sort((x, y) => y.ll - x.ll)[0]
    topWin.push(top.fi === 1 ? 1 : 0); topFin.push(top.fi)
  }
  const mean = arr => { const o = new Array(40).fill(0); arr.forEach(v => v.forEach((x, i) => { o[i] += x / arr.length })); return o }
  const curves = { LL: {}, FL: {} }, boot = { LL: {}, FL: {} }
  for (const T of ['LL', 'FL']) {
    const pooled = [].concat(vecs[T].low, vecs[T].mid, vecs[T].high)
    for (const cb of ['low', 'mid', 'high']) {
      const use = vecs[T][cb].length >= 20 ? vecs[T][cb] : pooled   // registration: n<20 -> pooled
      curves[T][cb] = mean(use); boot[T][cb] = use
    }
  }
  return { G_FL: flSum / train.length, curves, boot, nBucket: { low: vecs.LL.low.length, mid: vecs.LL.mid.length, high: vecs.LL.high.length },
    targetTopWin: topWin.reduce((a, c) => a + c, 0) / topWin.length, targetTopFin: topFin.reduce((a, c) => a + c, 0) / topFin.length }
}

// ---- one sim run of a board under an arm
function cfgFor(arm, b, fit, diag) {
  const base = { numSims: SIMS, cautionPreset: b.preset, dnfRate: b.dnfRate, totalRaceLaps: b.A.laps, trackGroup: 'INT', startSampling: null }
  if (diag) base.__domDiag = diag
  if (arm === 'CONTROL' || arm === 'NULL') return base
  base.flBudget = fit.G_FL
  if (diag) base.__domDiag = diag
  if (arm === 'A') return base
  base.domPool = 'strength'; base.domK = fit.k; if (fit.alpha != null) base.domAlpha = fit.alpha; if (fit.kFL != null) base.domKFL = fit.kFL
  if (arm === 'B') base.domCurves = fit.curves
  if (arm === 'C') base.domBoot = fit.boot
  return base
}
function scoreBoard(b) {
  const sc = buildSpeedScores(b.drivers, DEFAULT_WEIGHTS)
  // practice pctile exactly as SimulationCenter: rank by lrpTime ascending, fastest -> 1
  const withP = sc.filter(d => d.lrpTime != null)
  if (withP.length) { const ord = withP.slice().sort((x, y) => x.lrpTime - y.lrpTime); ord.forEach((d, i) => { d.__spdPct = ord.length > 1 ? 1 - i / (ord.length - 1) : 0.5 }) }
  return sc
}

// ---- metrics per board -> aggregate
function evalArm(arm, boards, fit, seed) {
  seedRandom(seed)
  const M = { m1: 0, m2: 0, m4: 0, m5: 0, n: 0, win: 0, t5: 0, t10: 0, tiers: {} }
  const tierOf = r => (r === 0 ? '1' : r <= 2 ? '2-3' : r <= 5 ? '4-6' : r <= 11 ? '7-12' : '13+')
  for (const t of ['1', '2-3', '4-6', '7-12', '13+']) M.tiers[t] = { ll: 0, fl: 0, n: 0 }
  for (const b of boards) {
    const sc = scoreBoard(b)
    const diag = {}
    const rows = runRaceSim(sc, cfgFor(arm, b, fit, diag))
    const bySim = new Map(rows.map(r => [r.simIdx, r]))
    const ord = sc.map((d, i) => ({ i, s: d.speedScore || 0 })).sort((x, y) => y.s - x.s)
    let e1 = 0, e2 = 0, n = 0
    const pd = [], ad = []
    ord.forEach((o, rank) => {
      const d = sc[o.i], r = bySim.get(o.i) || rows[o.i]; const a = d.__act
      if (!a || !r) return
      e1 += Math.abs(r.projLapsLed - a.ll); e2 += Math.abs(r.avgFastLaps - a.fl); n++
      const t = M.tiers[tierOf(rank)]; t.ll += a.ll - r.projLapsLed; t.fl += a.fl - r.avgFastLaps; t.n++
      pd.push(r.projDK); ad.push(dkFinishPts(a.fi) + (a.st - a.fi) + 0.25 * a.ll + 0.45 * a.fl)
      const f = a.fi
      M.win += (r.winPct / 100 - (f === 1 ? 1 : 0)) ** 2; M.t5 += (r.top5Pct / 100 - (f <= 5 ? 1 : 0)) ** 2; M.t10 += (r.top10Pct / 100 - (f <= 10 ? 1 : 0)) ** 2
    })
    M.m1 += e1 / n; M.m2 += e2 / n; M.m4 += spearman(pd, ad)
    // M5: sim per-draw top-share mean (max projected share is a lower bound; use max curve weight proxy)
    const sLL = b.A.rows.reduce((s, r) => s + r.ll, 0)
    const actTop = Math.max(...b.A.rows.map(r => r.ll)) / sLL
    const simTop = diag.draws ? diag.topShare / diag.draws : Math.max(...rows.map(r => r.projLapsLed)) / b.A.laps
    M.m5 += Math.abs(simTop - actTop)
    M.n++
  }
  const k = M.n
  const out = { arm, races: k, M1_llMAE: M.m1 / k, M2_flMAE: M.m2 / k, M4_dkRho: M.m4 / k, M5_topShareGap: M.m5 / k,
    winBrier: M.win / k, t5Brier: M.t5 / k, t10Brier: M.t10 / k, tiers: {} }
  for (const t in M.tiers) out.tiers[t] = { llBias: M.tiers[t].ll / M.tiers[t].n, flBias: M.tiers[t].fl / M.tiers[t].n }
  return out
}
function spearman(x, y) {
  const rk = a => { const idx = a.map((v, i) => i).sort((p, q) => a[p] - a[q]); const r = new Array(a.length); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[i]]) j++; const m = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = m; i = j + 1 } return r }
  const rx = rk(x), ry = rk(y), n = x.length, mx = rx.reduce((a, c) => a + c, 0) / n, my = ry.reduce((a, c) => a + c, 0) / n
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2 }
  return sxy / Math.sqrt(sxx * syy)
}

// ---- v2 fit on train (BACKTEST_LOG 2026-09-03 amendment): alpha shared, k_LL / k_FL separate.
// Objective per target: sum over strength tiers of (tier bias)^2, subject to P(top-LL-pool car
// wins) in [0.30, 0.50]. Everything here reads TRAIN only.
function tierBias(rows, sc) {
  const by = new Map(rows.map(r => [r.simIdx, r]))
  const ord = sc.map((d, i) => ({ i, s: d.speedScore || 0 })).sort((x, y) => y.s - x.s)
  const T = {}; const tierOf = r => (r === 0 ? '1' : r <= 2 ? '2-3' : r <= 5 ? '4-6' : r <= 11 ? '7-12' : '13+')
  ord.forEach((o, rank) => { const a = sc[o.i].__act, r = by.get(o.i); if (!a || !r) return; const t = tierOf(rank); T[t] = T[t] || { ll: 0, fl: 0, n: 0 }; T[t].ll += a.ll - r.projLapsLed; T[t].fl += a.fl - r.avgFastLaps; T[t].n++ })
  return T
}
function fitV2(train, fit) {
  const KS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2], ALS = [0.25, 0.5, 0.75]
  const table = []
  for (const al of ALS) for (const k of KS) {
    seedRandom(11)
    const acc = {}; let wins = 0, n = 0
    for (const b of train) {
      const sc = scoreBoard(b); const diag = {}
      const cfg = { ...cfgFor('B', b, { ...fit, k }, diag), domAlpha: al, domKFL: k, numSims: Math.min(SIMS, 1500) }
      const rows = runRaceSim(sc, cfg); wins += diag.wins || 0; n += diag.n || 0
      const T = tierBias(rows, sc); for (const t in T) { acc[t] = acc[t] || { ll: 0, fl: 0, n: 0 }; acc[t].ll += T[t].ll; acc[t].fl += T[t].fl; acc[t].n += T[t].n }
    }
    let oLL = 0, oFL = 0; for (const t in acc) { oLL += (acc[t].ll / acc[t].n) ** 2; oFL += (acc[t].fl / acc[t].n) ** 2 }
    table.push({ al, k, pTopWin: +(wins / n).toFixed(3), objLL: +oLL.toFixed(1), objFL: +oFL.toFixed(1), t1LL: +(acc['1'].ll / acc['1'].n).toFixed(1), t1FL: +(acc['1'].fl / acc['1'].n).toFixed(1) })
  }
  // alpha: the value whose best feasible k_LL objective is lowest; then k_LL and k_FL separately at that alpha
  const feas = table.filter(r => r.pTopWin >= 0.30 && r.pTopWin <= 0.50)
  if (!feas.length) throw new Error('no feasible (alpha,k) satisfies the coupling constraint')
  const bestLL = feas.slice().sort((a, b) => a.objLL - b.objLL)[0]
  const alpha = bestLL.al
  const kLL = bestLL.k
  const kFL = table.filter(r => r.al === alpha).sort((a, b) => a.objFL - b.objFL)[0].k   // FL order does not enter the coupling constraint
  return { alpha, kLL, kFL, table }
}

// ======================================================================= run
console.log(`engine ${E.__engineSha}  SIMS=${SIMS}  PHASE=${PHASE}`)
const train = loadBoards('train.txt', false)
console.log(`train boards: ${train.length} (cup INT, matched)`)
const fitPath = D('int-dominance-fit.json')
let fit
if (PHASE !== 'holdout') {
  fit = deriveFromTrain(train)
  console.log(`G_FL (train) = ${fit.G_FL.toFixed(4)}   bucket n: ${JSON.stringify(fit.nBucket)}`)
  console.log(`train targets: P(top-LL car wins) = ${fit.targetTopWin.toFixed(3)}, E[fin of top-LL car] = ${fit.targetTopFin.toFixed(2)}`)
  console.log(`strength-rank LL curve (mid) top5: ${fit.curves.LL.mid.slice(0, 5).map(x => x.toFixed(3)).join(' ')}`)
  console.log(`strength-rank FL curve (mid) top5: ${fit.curves.FL.mid.slice(0, 5).map(x => x.toFixed(3)).join(' ')}`)
  const v2 = fitV2(train, fit)
  fit.alpha = v2.alpha; fit.k = v2.kLL; fit.kFL = v2.kFL
  console.log('v2 grid (train):'); v2.table.forEach(r => console.log('   ', JSON.stringify(r)))
  console.log(`CHOSEN alpha = ${fit.alpha}  k_LL = ${fit.k}  k_FL = ${fit.kFL}`)
  fs.writeFileSync(fitPath, JSON.stringify({ G_FL: fit.G_FL, k: fit.k, alpha: fit.alpha, kFL: fit.kFL, curves: fit.curves, boot: fit.boot, targets: { topWin: fit.targetTopWin, topFin: fit.targetTopFin }, nBucket: fit.nBucket }, null, 0))
  console.log('\n--- TRAIN-side reference (in-sample, not the test) ---')
  for (const [arm, seed] of [['CONTROL', 1], ['NULL', 2], ['A', 1], ['B', 1], ['C', 1]]) report(evalArm(arm, train, fit, seed))
}
if (PHASE !== 'train') {
  if (!fit) fit = JSON.parse(fs.readFileSync(fitPath, 'utf8'))
  const hold = loadBoards('holdout.txt', false)
  console.log(`\n=== HOLDOUT (read once): ${hold.length} cup INT boards, no practice ===`)
  for (const [arm, seed] of [['CONTROL', 1], ['NULL', 2], ['A', 1], ['B', 1], ['C', 1]]) report(evalArm(arm, hold, fit, seed))
  const holdP = loadBoards('holdout-practice.txt', true)
  console.log(`\n=== HOLDOUT with PRACTICE (post-hoc rail): ${holdP.length} practice-covered cup INT boards ===`)
  for (const [arm, seed] of [['CONTROL', 1], ['NULL', 2], ['A', 1], ['B', 1], ['C', 1]]) report(evalArm(arm, holdP, fit, seed))
}
function report(r) {
  const t = r.tiers
  console.log(`${r.arm.padEnd(8)} n=${r.races}  M1 llMAE ${r.M1_llMAE.toFixed(2)}  M2 flMAE ${r.M2_flMAE.toFixed(2)}  M4 dkRho ${r.M4_dkRho.toFixed(3)}  M5 topGap ${r.M5_topShareGap.toFixed(3)}  | win ${r.winBrier.toFixed(5)} t5 ${r.t5Brier.toFixed(4)} t10 ${r.t10Brier.toFixed(4)}`)
  console.log(`         M3 bias (act-proj) LL/FL by strength tier: ` + Object.keys(t).map(k => `${k}: ${t[k].llBias.toFixed(1)}/${t[k].flBias.toFixed(1)}`).join('   '))
}

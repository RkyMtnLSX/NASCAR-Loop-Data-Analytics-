// scripts/backtest-features.js — REGISTERED 2026-10-10 (BACKTEST_LOG): the loop-data feature registrations.
// Per-driver features built from each driver's PRIOR same-series races (race-features.json: volUp / volDown =
// mean of (avg running position - finish) split by sign, pd = green-flag pass differential per lap, close =
// mid-race position minus finish; recency 0.85 per race back, up to 30 races, >= 3 to count), fingerprint-joined to the
// train (2022-24) and holdout-practice (2025-26) boards. One constant per series, fit on train, judged once.
//
//   FORM=carVol   PHASE=fit  SIMS=10000 node scripts/backtest-features.js     # simConfig.carVol { gamma }
//   FORM=passDiff PHASE=fit  SIMS=10000 node scripts/backtest-features.js     # buildSpeedScores opts.passDiff { w }
//   FORM=...      PHASE=test SIMS=20000 RUNS=2 node scripts/backtest-features.js
const fs = require('fs'), path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup, dkFinishPts,
  isRoadCourse, isSuperspeedway, DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS,
  TRUCK_ROAD_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } = E
const FORM = process.env.FORM || 'carVol'
const PHASE = process.env.PHASE || 'test', SIMS = Number(process.env.SIMS || (PHASE === 'fit' ? 10000 : 20000)), RUNS = Number(process.env.RUNS || 2)
const D = f => path.join(__dirname, 'backtest-data', f)
const FEAT = JSON.parse(fs.readFileSync(D('protocol-features.json'), 'utf8'))
const RF = JSON.parse(fs.readFileSync(D('race-features.json'), 'utf8'))
const POOLS = JSON.parse(fs.readFileSync(D('dom-pools.json'), 'utf8'))
const ACT = {}
JSON.parse(fs.readFileSync(D('dom-train-actuals.json'), 'utf8')).forEach(r => { ACT['train|' + r.race_id] = r })
JSON.parse(fs.readFileSync(D('dominator-actuals.json'), 'utf8')).forEach(r => { ACT['test|' + r.race_id] = r })
const num = s => (s === '' || s == null ? null : Number(s))
const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
function wf(se, tr) {
  if (isRoadCourse(tr)) return se === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(tr)) return se === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (se === 'trucks' && __trackGroup(tr) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
const shipped = b => ({ carDnf: b.series === 'trucks' ? { k: 32 } : null, ...((b.g === 'INT' || b.g === 'SHORT') && POOLS[b.series] && POOLS[b.series][b.g] ? { domBoot: POOLS[b.series][b.g] } : {}) })
function load(file, tag, withPractice) {
  const boards = []
  fs.readFileSync(D(file), 'utf8').split('\n').forEach((line, li) => {
    if (!line.trim() || line.indexOf('#') === -1) return
    const [h, b] = line.split('#'); const hf = h.split('|'); const off = hf.length === 10 ? 1 : 0
    const [series, track, grp, pDnf, pN, pCau] = hf.slice(off)
    const fj = FEAT[tag + '|' + li], rf = RF[tag + '|' + li]; if (!fj || !rf) return
    const A = ACT[tag + '|' + fj.race_id]; const act = {}
    if (A) A.recs.split(';').forEach(r => { const f = r.split(','); act[f[0] + ':' + f[1]] = { ll: +f[2], fl: +f[3] } })
    const base = [], fin = [], ll = [], fl = []; let i = 0, nP = 0
    for (const rec of b.split(';')) {
      const f = rec.split(','); if (f.length < 9) continue
      const v = num(f[9]); if (v != null) nP++
      const key = (f[0] === '' ? -1 : Math.round(+f[0])) + ':' + Math.round(+f[1])
      const ft = fj.feat[key] || [null, 0], x = rf.feat[key] || [null, 0, null, null], a = act[key] || { ll: 0, fl: 0 }
      base.push({ name: 'D' + i, startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]), nCorrRaces: num(f[5]) || 0,
        trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]), nTrackRaces: num(f[8]) || 0, lrpTime: withPractice ? v : null, pitCrewTime: null, corrWinConv: null,
        ownDnf: ft[0], ownDnfN: ft[1], vol: x[0], volN: x[1], passDiff: x[2], closing: x[3], volUp: x[4], volDown: x[5] })
      fin.push(num(f[1])); ll.push(a.ll); fl.push(a.fl); i++
    }
    if (base.length < 15) return
    if (withPractice && nP < base.length * 0.5) return
    const P = getCautionPresets(series), cau = num(pCau), g = __trackGroup(track)
    boards.push({ series, track, g, base, fin, ll, fl, hasAct: !!A, laps: A ? +A.laps || 300 : 300, w: wf(series, track), rate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0),
      asym: series !== 'cup' && (g === 'INT' || g === 'SHORT'),
      preset: cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2] : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a) })
  })
  return boards
}
const spearman = (a, b) => { const n = a.length; const rk = v => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(n); for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; const m = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = m; i = j + 1 } return r }; const ra = rk(a), rb = rk(b); const ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (ra[i] - ma) * (rb[i] - mb); sxx += (ra[i] - ma) ** 2; syy += (rb[i] - mb) ** 2 } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0 }
const cl = p => Math.max(1e-6, Math.min(1 - 1e-6, p))
// value -> engine config for the form
function armCfg(v, b) {
  if (FORM === 'carVol') return { sim: v > 0 ? { carVol: { gamma: v } } : {}, opts: undefined }
  if (FORM === 'passDiff') return { sim: {}, opts: v > 0 ? { passDiff: { w: v } } : undefined }
  throw new Error('unknown FORM ' + FORM)
}
function arm(boards, v) {
  const per = []; const cells = { eliteDeep: [], eliteFront: [], neP26: [] }
  let favS = 0, favA = 0, favN = 0, tlS = 0, tlA = 0, tlN = 0, mdS = 0, mdA = 0, mdN = 0
  for (const b of boards) {
    const a = armCfg(v, b)
    const sc = buildSpeedScores(b.base, b.w, a.opts)
    const rows = runRaceSim(sc, { numSims: SIMS, cautionPreset: b.preset, dnfRate: b.rate, totalRaceLaps: b.laps, trackGroup: b.g, startSampling: null, asymNoise: b.asym, ...shipped(b), ...a.sim, ...(process.env.DIAG ? { __finSamples: {} } : {}) })
    const smp = rows.__dkSamples || []
    const elite = new Set(sc.map((d, ix) => ({ ix, r: d.corrAvgRating || 0 })).sort((x, y) => y.r - x.r).slice(0, 5).map(x => x.ix))
    { const fv = rows.reduce((acc, r) => (b.fin[r.simIdx] != null && (!acc || r.winPct > acc.winPct)) ? r : acc, null); if (fv) { favS += fv.winPct / 100; favA += b.fin[fv.simIdx] === 1 ? 1 : 0; favN++ } }
    const pf = [], af = [], pd = [], ad = []; let t10 = 0, wll = 0, t5ll = 0, nn = 0, wb = 0, t5b = 0, c90 = 0, c10 = 0, cn = 0, f90 = 0, d90 = 0
    for (const r of rows) {
      const f = b.fin[r.simIdx]; if (f == null) continue
      pf.push(r.projFinish); af.push(f); nn++
      t10 += (cl(r.top10Pct / 100) - (f <= 10 ? 1 : 0)) ** 2
      const pw = cl(r.winPct / 100), p5 = cl(r.top5Pct / 100)
      wll += -(f === 1 ? Math.log(pw) : Math.log(1 - pw)); t5ll += -(f <= 5 ? Math.log(p5) : Math.log(1 - p5))
      wb += (r.winPct / 100 - (f === 1 ? 1 : 0)) ** 2; t5b += (r.top5Pct / 100 - (f <= 5 ? 1 : 0)) ** 2
      if (r.winPct < 3) { tlS += r.winPct / 100; tlA += f === 1 ? 1 : 0; tlN++ } else if (r.winPct < 10) { mdS += r.winPct / 100; mdA += f === 1 ? 1 : 0; mdN++ }
      const d = sc[r.simIdx], sp = d.startPos, res = f - r.projFinish
      if (sp != null && b.g !== 'SS') {
        if (elite.has(r.simIdx) && sp >= 16) cells.eliteDeep.push(res)
        if (elite.has(r.simIdx) && sp <= 5) cells.eliteFront.push(res)
        if (!elite.has(r.simIdx) && sp >= 26) cells.neP26.push(res)
      }
      if (b.hasAct) {
        const st = sp != null ? sp : f
        const actDK = dkFinishPts(f) + (st - f) + 0.25 * b.ll[r.simIdx] + 0.45 * b.fl[r.simIdx]
        pd.push(r.projDK); ad.push(actDK)
        if (smp.length >= 100) { const col = smp.map(row => row[r.simIdx]).sort((x, y) => x - y); const q90 = col[Math.floor(col.length * 0.9)], q10 = col[Math.floor(col.length * 0.1)]; c90 += actDK > q90 ? 1 : 0; c10 += actDK < q10 ? 1 : 0; cn++
          // DIAG=1: finish-only DK (finish pts + place diff, no dominator points) coverage, to locate the over-stated ceiling
          if (process.env.DIAG && rows.__finSamples) { const fcol = rows.__finSamples.map(row => row[r.simIdx]).sort((x, y) => x - y); const fq90 = fcol[Math.floor(fcol.length * 0.9)]; const actF = dkFinishPts(f) + (st - f); f90 += actF > fq90 ? 1 : 0; const dcol = smp.map((row, k) => row[r.simIdx] - rows.__finSamples[k][r.simIdx]).sort((x, y) => x - y); const dq90 = dcol[Math.floor(dcol.length * 0.9)]; d90 += (0.25 * b.ll[r.simIdx] + 0.45 * b.fl[r.simIdx]) > dq90 ? 1 : 0 } }
      }
    }
    per.push({ series: b.series, g: b.g, rho: spearman(pf, af), t10: t10 / nn, wll: wll / nn, t5ll: t5ll / nn, wb: wb / nn, t5b: t5b / nn,
      dkRho: pd.length ? spearman(pd, ad) : null, c90: cn ? c90 / cn : null, c10: cn ? c10 / cn : null, f90: cn ? f90 / cn : null, d90: cn ? d90 / cn : null })
  }
  const m = k => mean(per.filter(p => p[k] != null).map(p => p[k]))
  return { per, rho: m('rho'), t10: m('t10'), wll: m('wll'), t5ll: m('t5ll'), wb: m('wb'), t5b: m('t5b'), dkRho: m('dkRho'), c90: m('c90'), c10: m('c10'), f90: m('f90'), d90: m('d90'),
    eliteDeep: mean(cells.eliteDeep), eliteFront: mean(cells.eliteFront), neP26: mean(cells.neP26),
    favGap: (favS - favA) / Math.max(1, favN), tailGap: (tlS - tlA) / Math.max(1, tlN), midGap: (mdS - mdA) / Math.max(1, mdN) }
}
const wl = (x, a, key, better) => { let w = 0, l = 0; x.per.forEach((p, i) => { if (p[key] == null || a.per[i][key] == null) return; const d = better === 'high' ? p[key] - a.per[i][key] : a.per[i][key] - p[key]; if (d > 0) w++; else if (d < 0) l++ }); return w + '/' + l }
const SER = ['cup', 'oreilly', 'trucks']
const sub = (boards, s) => boards.filter(b => b.series === s)
const GRID = FORM === 'carVol' ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.05, 0.1, 0.15, 0.2]
const row = (nm, x) => `  ${nm.padEnd(9)} rho ${x.rho.toFixed(4)}  t10 ${x.t10.toFixed(5)}  winB ${x.wb.toFixed(5)}  t5B ${x.t5b.toFixed(5)}  winLL ${x.wll.toFixed(4)}  t5LL ${x.t5ll.toFixed(4)} | dkRho ${x.dkRho.toFixed(3)}  DK>p90 ${(100 * x.c90).toFixed(1)}%  DK<p10 ${(100 * x.c10).toFixed(1)}%${process.env.DIAG ? ` finDK>p90 ${(100 * x.f90).toFixed(1)}% domDK>p90 ${(100 * x.d90).toFixed(1)}%` : ''} | fav gap ${(100 * x.favGap).toFixed(1).padStart(5)}  mid ${(100 * x.midGap).toFixed(1)}  tail ${(100 * x.tailGap).toFixed(2)} | eliteFront ${x.eliteFront.toFixed(2)}  eliteDeep ${x.eliteDeep.toFixed(2)}  neP26 ${x.neP26.toFixed(2)}`
const fitFile = D(FORM.toLowerCase() + '-fit.json')
// fit criterion: carVol -> top-5 Brier + top-10 Brier (consistency); passDiff -> top-10 Brier (the 08-20 weight-sweep precedent)
const crit = r => FORM === 'carVol' ? r.t5b + r.t10 : r.t10

if (PHASE === 'fit') {
  const train = load('train.txt', 'train', false)
  console.log(`FIT ${FORM} on train.txt: ${train.length} boards (${SER.map(s => s + ' ' + sub(train, s).length).join(', ')}), ${SIMS} sims; engine ${E.__engineSha}`)
  const fit = { form: FORM, value: {}, sims: SIMS, engine: E.__engineSha }
  for (const s of SER) {
    const bs = sub(train, s)
    console.log(`\n${s.toUpperCase()} (${bs.length} boards) - ${FORM} -> ${FORM === 'carVol' ? 't5 Brier + t10 Brier' : 't10 Brier'} (tie within 1e-5 -> smaller)`)
    let best = null
    for (const v of GRID) { const r = arm(bs, v); const c = crit(r); console.log(row((FORM === 'carVol' ? 'g ' : 'w ') + v, r) + `  crit ${c.toFixed(5)}`); if (!best || c < best.c - 1e-5) best = { v, c } }
    fit.value[s] = best.v; console.log(`  -> ${best.v}`)
  }
  fs.writeFileSync(fitFile, JSON.stringify(fit, null, 2))
  console.log('\nFROZEN ->', JSON.stringify(fit.value))
} else {
  const fit = JSON.parse(fs.readFileSync(fitFile, 'utf8'))
  const test = load('holdout-practice.txt', 'test', true)
  console.log(`TEST ${FORM} on holdout-practice.txt: ${test.length} boards (${SER.map(s => s + ' ' + sub(test, s).length).join(', ')}), ${SIMS} sims, ${RUNS} runs; frozen ${JSON.stringify(fit.value)}; engine ${E.__engineSha}`)
  for (let run = 1; run <= RUNS; run++) {
    console.log(`\nRUN ${run}`)
    for (const s of SER) {
      const bs = sub(test, s), v = fit.value[s]
      const A = arm(bs, 0)
      console.log(` ${s.toUpperCase()} (${bs.length} boards)`)
      console.log(row('A ship', A))
      if (!v) { console.log(`  T: fitted ${FORM} = 0 - nothing to test`); continue }
      const T = arm(bs, v)
      console.log(row('T ' + v, T))
      console.log(`    T vs A: rho ${wl(T, A, 'rho', 'high')}  t10 ${wl(T, A, 't10', 'low')}  winB ${wl(T, A, 'wb', 'low')}  t5B ${wl(T, A, 't5b', 'low')}  winLL ${wl(T, A, 'wll', 'low')}  t5LL ${wl(T, A, 't5ll', 'low')}  dkRho ${wl(T, A, 'dkRho', 'high')}`)
    }
  }
}

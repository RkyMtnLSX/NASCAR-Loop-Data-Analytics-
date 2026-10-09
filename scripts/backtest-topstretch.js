// scripts/backtest-topstretch.js — REGISTERED 2026-10-09 (BACKTEST_LOG): top-end stretch of the composite.
// ONE constant per series (lambda), FITTED on train.txt (2022-24) by |eliteFront| + |eliteDeep| and SCORED
// on holdout-practice.txt (2025-26, >= 50% practice coverage, 94 boards). Control = what ships today
// (trucks carDnf k=32, domBoot INT+SHORT); S = control + buildSpeedScores(..., { topStretch: { lambda } }).
// Read the registration for the decision rule.
//
//   PHASE=fit  SIMS=10000 node scripts/backtest-topstretch.js      # writes topstretch-fit.json
//   PHASE=test SIMS=20000 RUNS=2 node scripts/backtest-topstretch.js
const fs = require('fs'), path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup,
  isRoadCourse, isSuperspeedway, DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS,
  TRUCK_ROAD_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } = E
const PHASE = process.env.PHASE || 'test', SIMS = Number(process.env.SIMS || (PHASE === 'fit' ? 10000 : 20000)), RUNS = Number(process.env.RUNS || 2)
const D = f => path.join(__dirname, 'backtest-data', f)
const FEAT = JSON.parse(fs.readFileSync(D('protocol-features.json'), 'utf8'))
const POOLS = JSON.parse(fs.readFileSync(D('dom-pools.json'), 'utf8'))
const shipped = b => ({ carDnf: b.series === 'trucks' ? { k: 32 } : null, ...(POOLS[b.series] && POOLS[b.series][b.g] ? { domBoot: POOLS[b.series][b.g] } : {}) })
const num = s => (s === '' || s == null ? null : Number(s))
function wf(se, tr) {
  if (isRoadCourse(tr)) return se === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(tr)) return se === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (se === 'trucks' && __trackGroup(tr) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
function load(file, tag, withPractice) {
  const boards = []
  fs.readFileSync(D(file), 'utf8').split('\n').forEach((line, li) => {
    if (!line.trim() || line.indexOf('#') === -1) return
    const [h, b] = line.split('#'); const hf = h.split('|'); const off = hf.length === 10 ? 1 : 0
    const [series, track, grp, pDnf, pN, pCau] = hf.slice(off)
    const fj = FEAT[tag + '|' + li]; if (!fj) return
    const base = [], fin = [], dnf = []; let i = 0, nP = 0
    for (const rec of b.split(';')) {
      const f = rec.split(','); if (f.length < 9) continue
      const v = num(f[9]); if (v != null) nP++
      const key = (f[0] === '' ? -1 : Math.round(+f[0])) + ':' + Math.round(+f[1])
      const ft = fj.feat[key] || [null, 0]
      base.push({ name: 'D' + i, startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]), nCorrRaces: num(f[5]) || 0,
        trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]), nTrackRaces: num(f[8]) || 0, lrpTime: withPractice ? v : null, pitCrewTime: null, corrWinConv: null,
        ownDnf: ft[0], ownDnfN: ft[1] })
      fin.push(num(f[1])); dnf.push(num(f[2])); i++
    }
    if (base.length < 15) return
    if (withPractice && nP < base.length * 0.5) return
    const P = getCautionPresets(series), cau = num(pCau), g = __trackGroup(track)
    boards.push({ series, track, g, base, fin, dnf, w: wf(series, track), rate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0),
      asym: series !== 'cup' && (g === 'INT' || g === 'SHORT'),
      preset: cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2] : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a) })
  })
  return boards
}
const spearman = (a, b) => { const n = a.length; const rk = v => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(n); for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; const m = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = m; i = j + 1 } return r }; const ra = rk(a), rb = rk(b); const ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (ra[i] - ma) * (rb[i] - mb); sxx += (ra[i] - ma) ** 2; syy += (rb[i] - mb) ** 2 } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0 }
const cl = p => Math.max(1e-6, Math.min(1 - 1e-6, p))
const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
// lambda -> topStretch strength (0 = shipped)
function arm(boards, lambda) {
  const per = []; const cells = { eliteDeep: [], eliteFront: [], neP26: [], neP31: [] }; let p26 = { proj: 0, act: 0, n: 0 }
  let dnfB = 0, dnfN = 0, hiSim = 0, hiAct = 0, hiN = 0, hiB = 0, favS = 0, favA = 0, favN = 0
  for (const b of boards) {
    const sc = buildSpeedScores(b.base, b.w, lambda ? { topStretch: { lambda } } : undefined)
    const rows = runRaceSim(sc, { numSims: SIMS, cautionPreset: b.preset, dnfRate: b.rate, totalRaceLaps: 300, trackGroup: b.g, startSampling: null, asymNoise: b.asym, ...shipped(b) })
    const elite = new Set(sc.map((d, ix) => ({ ix, r: d.corrAvgRating || 0 })).sort((a, c) => c.r - a.r).slice(0, 5).map(x => x.ix))
    const pf = [], af = []; let t10 = 0, wll = 0, t5ll = 0, nn = 0
    { const fv = rows.reduce((a, r) => (b.fin[r.simIdx] != null && (!a || r.winPct > a.winPct)) ? r : a, null); if (fv) { favS += fv.winPct / 100; favA += b.fin[fv.simIdx] === 1 ? 1 : 0; favN++ } }
    for (const r of rows) {
      const f = b.fin[r.simIdx]; if (f == null) continue
      pf.push(r.projFinish); af.push(f); nn++
      t10 += (cl(r.top10Pct / 100) - (f <= 10 ? 1 : 0)) ** 2
      const pw = cl(r.winPct / 100), p5 = cl(r.top5Pct / 100)
      wll += -(f === 1 ? Math.log(pw) : Math.log(1 - pw)); t5ll += -(f <= 5 ? Math.log(p5) : Math.log(1 - p5))
      const d = sc[r.simIdx], sp = d.startPos, res = f - r.projFinish, a = b.dnf[r.simIdx]
      if (a != null) { const pd = r.dnfPct / 100; dnfB += (pd - a) ** 2; dnfN++; if (d.ownDnf != null && d.ownDnf > 0.30 && (d.ownDnfN || 0) >= 3) { hiSim += pd; hiAct += a; hiN++; hiB += (pd - a) ** 2 } }
      if (sp != null && b.g !== 'SS') {
        if (elite.has(r.simIdx) && sp >= 16) cells.eliteDeep.push(res)
        if (elite.has(r.simIdx) && sp <= 5) cells.eliteFront.push(res)
        if (!elite.has(r.simIdx) && sp >= 26) { cells.neP26.push(res); p26.proj += r.projFinish; p26.act += f; p26.n++ }
        if (!elite.has(r.simIdx) && sp >= 31) cells.neP31.push(res)
      }
    }
    per.push({ series: b.series, g: b.g, rho: spearman(pf, af), t10: t10 / nn, wll: wll / nn, t5ll: t5ll / nn })
  }
  return { per, rho: mean(per.map(p => p.rho)), t10: mean(per.map(p => p.t10)), wll: mean(per.map(p => p.wll)), t5ll: mean(per.map(p => p.t5ll)),
    eliteDeep: mean(cells.eliteDeep), nED: cells.eliteDeep.length, eliteFront: mean(cells.eliteFront), nEF: cells.eliteFront.length, neP26: mean(cells.neP26), neP31: mean(cells.neP31), n26: cells.neP26.length,
    p26proj: p26.proj / Math.max(1, p26.n), p26act: p26.act / Math.max(1, p26.n),
    favStated: favS / Math.max(1, favN), favAct: favA / Math.max(1, favN), favGap: (favS - favA) / Math.max(1, favN), dnfBrier: dnfB / Math.max(1, dnfN), hiSim: hiSim / Math.max(1, hiN), hiAct: hiAct / Math.max(1, hiN), hiN, hiBrier: hiB / Math.max(1, hiN) }
}
const wl = (x, a, key, better) => { let w = 0, l = 0; x.per.forEach((p, i) => { const d = better === 'high' ? p[key] - a.per[i][key] : a.per[i][key] - p[key]; if (d > 0) w++; else if (d < 0) l++ }); return w + '/' + l }
const SER = ['cup', 'oreilly', 'trucks']
const sub = (boards, s) => boards.filter(b => b.series === s)
const LAMBDAS = [0, 0.25, 0.5, 0.75, 1, 1.5]
const row = (nm, x) => `  ${nm.padEnd(9)} rho ${x.rho.toFixed(4)}  t10 ${x.t10.toFixed(5)}  winLL ${x.wll.toFixed(4)}  t5LL ${x.t5ll.toFixed(4)} | eliteDeep ${x.eliteDeep.toFixed(2).padStart(6)} (n ${x.nED})  eliteFront ${x.eliteFront.toFixed(2).padStart(6)} (n ${x.nEF})  neP26 ${x.neP26.toFixed(2).padStart(6)} | fav ${(100 * x.favStated).toFixed(1)}%/${(100 * x.favAct).toFixed(1)}% gap ${(100 * x.favGap).toFixed(1).padStart(5)}`

if (PHASE === 'fit') {
  const train = load('train.txt', 'train', false)
  console.log(`FIT on train.txt: ${train.length} boards (${SER.map(s => s + ' ' + sub(train, s).length).join(', ')}), ${SIMS} sims; engine ${E.__engineSha}`)
  const fit = { lambda: {}, sims: SIMS, engine: E.__engineSha }
  for (const s of SER) {
    const bs = sub(train, s)
    console.log(`\n${s.toUpperCase()} (${bs.length} boards) - lambda -> |eliteFront| + |eliteDeep| (tie -> smaller lambda)`)
    let best = null
    for (const l of LAMBDAS) { const r = arm(bs, l); const v = Math.abs(r.eliteFront) + Math.abs(r.eliteDeep); console.log(row('l ' + l, r) + `  sum ${v.toFixed(2)}`); if (!best || v < best.v - 1e-9) best = { l, v } }
    fit.lambda[s] = best.l; console.log(`  -> lambda = ${best.l}`)
  }
  fs.writeFileSync(D('topstretch-fit.json'), JSON.stringify(fit, null, 2))
  console.log('\nFROZEN ->', JSON.stringify(fit.lambda))
} else {
  const fit = JSON.parse(fs.readFileSync(D('topstretch-fit.json'), 'utf8'))
  const test = load('holdout-practice.txt', 'test', true)
  console.log(`TEST on holdout-practice.txt: ${test.length} boards (${SER.map(s => s + ' ' + sub(test, s).length).join(', ')}), ${SIMS} sims, ${RUNS} runs; frozen ${JSON.stringify(fit.lambda)}; engine ${E.__engineSha}`)
  for (let run = 1; run <= RUNS; run++) {
    console.log(`\nRUN ${run}`)
    for (const s of SER) {
      const bs = sub(test, s), l = fit.lambda[s]
      const A = arm(bs, 0)
      console.log(` ${s.toUpperCase()} (${bs.length} boards)`)
      console.log(row('A ship', A))
      if (!l) { console.log('  S: fitted lambda = 0 - nothing to test'); continue }
      const T = arm(bs, l)
      console.log(row('S l=' + l, T))
      console.log(`    S vs A: rho ${wl(T, A, 'rho', 'high')}  t10 ${wl(T, A, 't10', 'low')}  winLL ${wl(T, A, 'wll', 'low')}  t5LL ${wl(T, A, 't5ll', 'low')}`)
    }
  }
}

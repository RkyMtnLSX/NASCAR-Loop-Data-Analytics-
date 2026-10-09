// scripts/backtest-lapped-half.js — REGISTERED 2026-10-09 (BACKTEST_LOG): lapped-traffic mechanism at
// half strength on the 91-board practice holdout. Arms: A shipped, H k=1 (registered), F k=2 (the
// 09-07 full-strength arm, reference). Metrics and decision rule in the registration - read it first.
//
//   SIMS=20000 RUNS=2 node scripts/backtest-lapped-half.js
const fs = require('fs'), path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup,
  isRoadCourse, isSuperspeedway, DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS,
  TRUCK_ROAD_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } = E
const SIMS = Number(process.env.SIMS || 20000), RUNS = Number(process.env.RUNS || 2)
const num = s => (s === '' || s == null ? null : Number(s))
function wf(se, tr) {
  if (isRoadCourse(tr)) return se === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(tr)) return se === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (se === 'trucks' && __trackGroup(tr) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
const boards = []
for (const line of fs.readFileSync(path.join(__dirname, 'backtest-data', 'holdout-practice.txt'), 'utf8').split('\n').filter(l => l.trim())) {
  const [h, b] = line.split('#'); if (!b) continue
  const [year, series, track, grp, pDnf, pN, pCau] = h.split('|')
  const base = [], fin = []; let i = 0, nP = 0
  for (const rec of b.split(';')) {
    const f = rec.split(','); if (f.length < 10) continue
    const v = num(f[9]); if (v != null) nP++
    base.push({ name: 'D' + i, startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]),
      nCorrRaces: num(f[5]) || 0, trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]),
      nTrackRaces: num(f[8]) || 0, lrpTime: v, pitCrewTime: null, corrWinConv: null })
    fin.push(num(f[1])); i++
  }
  if (base.length < 15 || nP < base.length * 0.5) continue
  const P = getCautionPresets(series), cau = num(pCau)
  const g = __trackGroup(track)
  boards.push({ year, series, track, base, fin, g, w: wf(series, track), rate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0),
    asym: series !== 'cup' && (g === 'INT' || g === 'SHORT'),
    preset: cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2]
      : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a) })
}
const spearman = (a, b) => { const n = a.length; const rk = v => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(n); for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; const m = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = m; i = j + 1 } return r }; const ra = rk(a), rb = rk(b); const ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (ra[i] - ma) * (rb[i] - mb); sxx += (ra[i] - ma) ** 2; syy += (rb[i] - mb) ** 2 } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0 }
const cl = p => Math.max(1e-6, Math.min(1 - 1e-6, p))
function arm(k) {
  const per = []   // per race: rho, t10 Brier, winLL, t5LL
  const cells = { eliteDeep: [], neP26: [], neP31: [] }, p26 = { proj: 0, act: 0, n: 0 }, p26s = {}
  for (const b of boards) {
    const sc = buildSpeedScores(b.base, b.w)
    const rows = runRaceSim(sc, { numSims: SIMS, cautionPreset: b.preset, dnfRate: b.rate, totalRaceLaps: 300, trackGroup: b.g,
      startSampling: null, asymNoise: b.asym, lappedTraffic: k ? { series: b.series, k } : null })
    const elite = new Set(sc.map((d, ix) => ({ ix, r: d.corrAvgRating || 0 })).sort((a, c) => c.r - a.r).slice(0, 5).map(x => x.ix))
    const pf = [], af = []; let t10 = 0, wll = 0, t5ll = 0, nn = 0
    for (const r of rows) {
      const f = b.fin[r.simIdx]; if (f == null) continue
      pf.push(r.projFinish); af.push(f); nn++
      t10 += (cl(r.top10Pct / 100) - (f <= 10 ? 1 : 0)) ** 2
      const pw = cl(r.winPct / 100), p5 = cl(r.top5Pct / 100)
      wll += -(f === 1 ? Math.log(pw) : Math.log(1 - pw)); t5ll += -(f <= 5 ? Math.log(p5) : Math.log(1 - p5))
      const d = sc[r.simIdx], sp = d.startPos, res = f - r.projFinish
      if (sp != null && b.g !== 'SS') {
        if (elite.has(r.simIdx) && sp >= 16) cells.eliteDeep.push(res)
        if (!elite.has(r.simIdx) && sp >= 26) { cells.neP26.push(res); p26.proj += r.projFinish; p26.act += f; p26.n++; const q = p26s[b.series] = p26s[b.series] || { proj: 0, act: 0, n: 0 }; q.proj += r.projFinish; q.act += f; q.n++ }
        if (!elite.has(r.simIdx) && sp >= 31) cells.neP31.push(res)
      }
    }
    per.push({ series: b.series, g: b.g, rho: spearman(pf, af), t10: t10 / nn, wll: wll / nn, t5ll: t5ll / nn })
  }
  const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
  return { per, rho: mean(per.map(p => p.rho)), t10: mean(per.map(p => p.t10)), wll: mean(per.map(p => p.wll)), t5ll: mean(per.map(p => p.t5ll)),
    eliteDeep: mean(cells.eliteDeep), neP26: mean(cells.neP26), neP31: mean(cells.neP31), nED: cells.eliteDeep.length, n26: cells.neP26.length,
    p26proj: p26.proj / Math.max(1, p26.n), p26act: p26.act / Math.max(1, p26.n),
    p26bySeries: Object.fromEntries(Object.entries(p26s).map(([k, q]) => [k, { proj: q.proj / q.n, act: q.act / q.n }])) }
}
const wl = (x, a, key, better) => { let w = 0, l = 0; x.per.forEach((p, i) => { const d = better === 'high' ? p[key] - a.per[i][key] : a.per[i][key] - p[key]; if (d > 0) w++; else if (d < 0) l++ }); return w + '/' + l }
const bySeries = (x, a, key, better) => ['cup', 'oreilly', 'trucks'].map(s => { const ix = x.per.map((p, i) => p.series === s ? i : -1).filter(i => i >= 0); const m = v => ix.reduce((t, i) => t + v.per[i][key], 0) / Math.max(1, ix.length); let w = 0, l = 0; ix.forEach(i => { const d = better === 'high' ? x.per[i][key] - a.per[i][key] : a.per[i][key] - x.per[i][key]; if (d > 0) w++; else if (d < 0) l++ }); return s + ' ' + m(a).toFixed(4) + '->' + m(x).toFixed(4) + ' (' + w + '/' + l + ')' }).join('  ')
const byGroup = (x, a, key) => ['INT', 'SHORT', 'ROAD', 'SS'].map(g => { const ix = x.per.map((p, i) => p.g === g ? i : -1).filter(i => i >= 0); if (!ix.length) return null; const m = v => ix.reduce((t, i) => t + v.per[i][key], 0) / ix.length; return g + ' ' + m(a).toFixed(4) + '->' + m(x).toFixed(4) }).filter(Boolean).join('  ')
console.log(`${boards.length} practice holdout boards (${boards.filter(b => b.series === 'cup').length} cup / ${boards.filter(b => b.series === 'oreilly').length} oreilly / ${boards.filter(b => b.series === 'trucks').length} trucks), ${SIMS} sims/arm, ${RUNS} run(s); engine ${E.__engineSha}\n`)
for (let run = 1; run <= RUNS; run++) {
  const A = arm(0), H = arm(1), F = arm(2)
  console.log(`RUN ${run}`)
  console.log('  arm      rhoFin    t10Brier   winLL     t5LL   | eliteDeep  neP26  neP31 | P26+ proj/act')
  for (const [nm, x] of [['A ship', A], ['H k=1 ', H], ['F k=2 ', F]]) {
    console.log('  ' + nm + '   ' + x.rho.toFixed(4) + '    ' + x.t10.toFixed(5) + '   ' + x.wll.toFixed(4) + '   ' + x.t5ll.toFixed(4) + '  | ' + x.eliteDeep.toFixed(2).padStart(7) + '  ' + x.neP26.toFixed(2).padStart(5) + '  ' + x.neP31.toFixed(2).padStart(5) + ' | ' + x.p26proj.toFixed(2) + ' / ' + x.p26act.toFixed(2) + (nm[0] === 'A' ? '   (n eliteDeep ' + x.nED + ', neP26 ' + x.n26 + ')' : ''))
  }
  for (const [nm, x] of [['H', H], ['F', F]]) {
    console.log(`  ${nm} vs A  rho W/L ${wl(x, A, 'rho', 'high')}  t10 W/L ${wl(x, A, 't10', 'low')}  winLL W/L ${wl(x, A, 'wll', 'low')}  t5LL W/L ${wl(x, A, 't5ll', 'low')}`)
    console.log(`     rho by series: ${bySeries(x, A, 'rho', 'high')}`)
    console.log(`     rho by group:  ${byGroup(x, A, 'rho')}`)
    console.log(`     t10 by series: ${bySeries(x, A, 't10', 'low')}`)
    // 2026-10-09 second registration (probability-primary, per series): win / t5 log-loss by series
    console.log(`     winLL by series: ${bySeries(x, A, 'wll', 'low')}`)
    console.log(`     t5LL by series:  ${bySeries(x, A, 't5ll', 'low')}`)
  }
  // per-series P26+ calibration (proj vs actual) for arms A and H
  const calib = (x) => ['cup', 'oreilly', 'trucks'].map(s => s + ' ' + (x.p26bySeries[s] ? x.p26bySeries[s].proj.toFixed(2) + '/' + x.p26bySeries[s].act.toFixed(2) : '-')).join('  ')
  console.log(`  P26+ proj/act by series  A: ${calib(A)}   H: ${calib(H)}`)
  console.log('')
}

// scripts/backtest-tilt-oneparam.js — the one-parameter tilt.
//
//   node scripts/backtest-tilt-oneparam.js
//
// Every richer version failed for the same reason: a four-anchor curve is fitted to a per-tier
// attrition profile that itself swings 4+ points between seasons. So this removes almost all of
// the thing that can overfit. ONE parameter, s, a straight line in percentile:
//
//     mult_i = 1 + 2s * (0.5 - p_i)      ->  anchors [1-.75s, 1-.25s, 1+.25s, 1+.75s]
//
// Mean 1 by construction, so the field-wide budget is untouched. s = 0 is current behaviour.
//
// The test is deliberately NOT "which s wins on the fit set". It is whether performance is FLAT
// across a broad band of s on a season the parameter never saw. A sharp optimum would not
// generalize; a broad plateau means any sane value works, which is what robustness looks like.
const fs = require('fs'), path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup,
  isRoadCourse, isSuperspeedway, DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS,
  TRUCK_ROAD_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } = E
const SIMS = Number(process.env.SIMS || 10000)
const num = s => (s === '' || s == null ? null : Number(s))
function wf(se, tr) {
  if (isRoadCourse(tr)) return se === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(tr)) return se === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (se === 'trucks' && __trackGroup(tr) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
function load(file, wantPractice) {
  const out = []
  for (const line of fs.readFileSync(path.join(__dirname, 'backtest-data', file), 'utf8').split('\n').filter(l => l.trim())) {
    const [h, b] = line.split('#'); if (!b) continue
    const H = h.split('|')
    const yr = wantPractice ? +H[0] : null
    const [series, track, grp, pDnf, pN, pCau] = wantPractice ? H.slice(1) : H
    const dr = [], dnf = [], fin = []; let i = 0, nP = 0
    for (const rec of b.split(';')) {
      const f = rec.split(','); if (f.length < 9) continue
      const lrp = wantPractice && f.length >= 10 ? num(f[9]) : null
      if (lrp != null) nP++
      dr.push({ name: 'D' + i, startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]),
        nCorrRaces: num(f[5]) || 0, trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]),
        nTrackRaces: num(f[8]) || 0, lrpTime: lrp, pitCrewTime: null, corrWinConv: null })
      dnf.push(num(f[2])); fin.push(num(f[1])); i++
    }
    if (dr.length < 15) continue
    if (wantPractice && nP < dr.length * 0.5) continue
    const P = getCautionPresets(series), cau = num(pCau)
    const sc = buildSpeedScores(dr, wf(series, track))
    const ord = sc.map((d, ix) => ({ ix, s: d.speedScore || 0 })).sort((a, x) => x.s - a.s)
    const tier = new Array(sc.length); ord.forEach((o, r) => { tier[o.ix] = Math.min(3, Math.floor(r * 4 / sc.length)) })
    out.push({ yr, sc, dnf, fin, tier, g: __trackGroup(track),
      rate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0),
      preset: cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2]
        : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a) })
  }
  return out
}
const curveFor = s => [1 - 0.75 * s, 1 - 0.25 * s, 1 + 0.25 * s, 1 + 0.75 * s]
function score(bs, s) {
  let wb = 0, t5 = 0, t10 = 0, n = 0
  const T = [0, 1, 2, 3].map(() => ({ p: 0, o: 0, n: 0 }))
  for (const b of bs) {
    const rows = runRaceSim(b.sc, { numSims: SIMS, cautionPreset: b.preset, dnfRate: b.rate,
      totalRaceLaps: 300, trackGroup: b.g, startSampling: null,
      skillTilt: s !== 0, tiltCurve: s !== 0 ? curveFor(s) : null })
    for (const r of rows) {
      const cl = p => Math.max(1e-6, Math.min(1 - 1e-6, p)), f = b.fin[r.simIdx]
      wb += (cl(r.winPct / 100) - (f === 1 ? 1 : 0)) ** 2
      t5 += (cl(r.top5Pct / 100) - (f <= 5 ? 1 : 0)) ** 2
      t10 += (cl(r.top10Pct / 100) - (f <= 10 ? 1 : 0)) ** 2
      n++
      const t = T[b.tier[r.simIdx]]; t.p += r.dnfPct / 100; t.o += b.dnf[r.simIdx]; t.n++
    }
  }
  return { wb: wb / n, t5: t5 / n, t10: t10 / n, tiers: T.map(t => ({ pred: t.p / t.n, obs: t.o / t.n })) }
}
const S = [0, 0.10, 0.20, 0.30, 0.40]
const sets = [
  ['practice-free holdout (162)', load('holdout.txt', false)],
  ['practice 2025 (47)', load('holdout-practice.txt', true).filter(b => b.yr === 2025)],
  ['practice 2026 (47)', load('holdout-practice.txt', true).filter(b => b.yr === 2026)],
]
for (const [nm, bs] of sets) {
  console.log(`\n=== ${nm} — ${bs.length} races ===`)
  console.log('  s      win Brier    top5 Brier   top10 Brier   worst tier err   rail vs s=0')
  let base = null
  for (const s of S) {
    const r = score(bs, s)
    if (s === 0) base = r
    const err = r.tiers.map((t, i) => Math.abs(t.pred - t.obs))
    const be = base.tiers.map((t, i) => Math.abs(t.pred - t.obs))
    const rail = err.every((e, i) => e <= be[i] + 0.005) ? 'PASS' : 'FAIL'
    console.log('  ' + s.toFixed(2) + '   ' + r.wb.toFixed(6) + '     ' + r.t5.toFixed(6) + '     ' +
      r.t10.toFixed(6) + '      ' + (Math.max(...err) * 100).toFixed(2).padStart(5) + ' pts        ' +
      (s === 0 ? '—' : rail))
  }
}

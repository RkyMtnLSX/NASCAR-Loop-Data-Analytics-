// scripts/gate-cliff-final.js — the caution-cliff fix, judged under REPAIRED gates.
//
//   node scripts/gate-cliff-final.js
//
// GATES ARE DEFINED HERE, IN CODE, BEFORE ANY RESULT EXISTS. Committed before first run.
//
// WHY THIS EXISTS. The first pass at this fix (BACKTEST_LOG 2026-08-31) had two defects that
// were mine, not the model's:
//   1. Gate C counted "bins degraded by >0.3pt". A NULL comparison — current against itself,
//      nothing changed — degrades 2-3 bins by that rule. The gate could not resolve anything,
//      so its FAIL was meaningless and so would a PASS have been.
//   2. To make gate A pass I widened the __wScale clamp from 2.5 to 8 MID-RUN, after seeing the
//      first result fall short. That is an unregistered parameter introduced because the test
//      was failing. It is now a separate flag and is tested on its own.
//
// REPAIRED GATE C. Instead of counting bins, score one number per market:
//     CalErr = SUM over bins of  n_b * |mean_predicted_b - mean_observed_b|   / SUM n_b
// then compare the arms' CalErr against the NULL distribution of the same statistic. A change
// only fails if its calibration error exceeds what identical-config noise produces.
//
// ARMS
//   CURRENT   shipped behaviour, including the 2026-08-31 superspeedway pin
//   EV        per-bucket WRECK_EV_EXP, clamp left at its shipped 2.5
//   EV+CLAMP  per-bucket WRECK_EV_EXP, clamp widened to 8
//   NULL      CURRENT against CURRENT — the noise floor for every statistic below
//
// PASS CONDITIONS, frozen:
//   A  cliff: delivered attrition change across the 6.0 boundary < 10% relative (now ~74%)
//   B  win/top5/top10 Brier: mean delta over N runs must not be worse than the null's own
//      mean |delta| — i.e. no degradation that noise cannot explain
//   C  CalErr per market: same rule, judged against the null distribution
//   D  schedule DNF bias moves toward zero from -0.53 cars/race
//   E  cup Talladega delivered attrition stays within 1.0pt of its 20.9% measured
const fs = require('fs'), path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup,
  isRoadCourse, isSuperspeedway, DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS,
  TRUCK_ROAD_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } = E
const SIMS = Number(process.env.SIMS || 8000)
const RUNS = Number(process.env.RUNS || 4)
const num = s => (s === '' || s == null ? null : Number(s))
function wf(se, tr) {
  if (isRoadCourse(tr)) return se === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(tr)) return se === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (se === 'trucks' && __trackGroup(tr) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
// ARMS ARE PINNED EXPLICITLY. Both flags SHIPPED as defaults on 2026-08-31, so `{}` no longer
// means "old behaviour" — it means the fix. Leaving CURRENT as `{}` would have made this script
// compare the fix against itself and report a flat zero delta as a pass. Every arm now states
// both flags outright, and this script keeps working as a historical reproduction either way.
const ARMS = {
  CURRENT:    { perBucketEV: false, wideClamp: false },
  EV:         { perBucketEV: true,  wideClamp: false },
  'EV+CLAMP': { perBucketEV: true,  wideClamp: true },
  // Ship verification: passes NO flags, so it exercises whatever the engine defaults to. It must
  // track EV+CLAMP. If it ever tracks CURRENT instead, the ship got reverted somewhere.
  SHIPPED:    {},
}
const boards = []
for (const line of fs.readFileSync(path.join(__dirname, 'backtest-data', 'holdout.txt'), 'utf8').split('\n').filter(l => l.trim())) {
  const [h, b] = line.split('#'); if (!b) continue
  const [series, track, grp, pDnf, pN, pCau] = h.split('|')
  const dr = [], dnf = [], fin = []; let i = 0
  for (const rec of b.split(';')) {
    const f = rec.split(','); if (f.length < 9) continue
    dr.push({ name: 'D' + i, startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]),
      nCorrRaces: num(f[5]) || 0, trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]),
      nTrackRaces: num(f[8]) || 0, lrpTime: null, pitCrewTime: null, corrWinConv: null })
    dnf.push(num(f[2])); fin.push(num(f[1])); i++
  }
  if (dr.length < 15) continue
  const P = getCautionPresets(series), cau = num(pCau)
  const pi = cau == null ? 1 : isSuperspeedway(track) ? 1 : (cau < 6 ? 0 : cau < 11.5 ? 1 : 2)
  boards.push({ series, track, sc: buildSpeedScores(dr, wf(series, track)), dnf, fin, P, pi,
    g: __trackGroup(track), rate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0) })
}
const BINS = [0, 0.02, 0.05, 0.10, 0.20, 0.35, 1.01]
function measure(opts) {
  let wb = 0, t5 = 0, t10 = 0, n = 0, dp = 0, dobs = 0, races = 0
  const tal = { p: 0, n: 0, o: 0 }
  const M = { win: BINS.slice(0, -1).map(() => ({ p: 0, o: 0, n: 0 })),
              t5:  BINS.slice(0, -1).map(() => ({ p: 0, o: 0, n: 0 })),
              t10: BINS.slice(0, -1).map(() => ({ p: 0, o: 0, n: 0 })) }
  for (const b of boards) {
    const rows = runRaceSim(b.sc, { numSims: SIMS, cautionPreset: b.P[b.pi], dnfRate: b.rate,
      totalRaceLaps: 300, trackGroup: b.g, startSampling: null, ...opts })
    for (const r of rows) {
      const cl = p => Math.max(1e-6, Math.min(1 - 1e-6, p)), f = b.fin[r.simIdx]
      wb += (cl(r.winPct / 100) - (f === 1 ? 1 : 0)) ** 2
      t5 += (cl(r.top5Pct / 100) - (f <= 5 ? 1 : 0)) ** 2
      t10 += (cl(r.top10Pct / 100) - (f <= 10 ? 1 : 0)) ** 2
      n++
      for (const [k, p, y] of [['win', r.winPct / 100, f === 1 ? 1 : 0],
                               ['t5', r.top5Pct / 100, f <= 5 ? 1 : 0],
                               ['t10', r.top10Pct / 100, f <= 10 ? 1 : 0]]) {
        let i = 0; while (i < BINS.length - 2 && p >= BINS[i + 1]) i++
        M[k][i].p += p; M[k][i].o += y; M[k][i].n++
      }
    }
    dp += rows.reduce((s, r) => s + r.dnfPct, 0) / 100; dobs += b.dnf.reduce((x, y) => x + y, 0); races++
    if (b.series === 'cup' && b.track.includes('Talladega')) {
      tal.p += rows.reduce((s, r) => s + r.dnfPct, 0) / 100 / rows.length
      tal.o += b.dnf.reduce((x, y) => x + y, 0) / b.dnf.length; tal.n++
    }
  }
  const cal = {}
  for (const k of ['win', 't5', 't10']) {
    let num2 = 0, den = 0
    for (const bn of M[k]) { if (bn.n < 30) continue; num2 += bn.n * Math.abs(bn.p / bn.n - bn.o / bn.n); den += bn.n }
    cal[k] = num2 / den * 100
  }
  return { wb: wb / n, t5: t5 / n, t10: t10 / n, bias: (dp - dobs) / races,
           tal: tal.p / tal.n * 100, talObs: tal.o / tal.n * 100, cal }
}
// ---------- GATE A
console.log('GATE A — synthetic INT track swept across the 6.0 boundary, budget fixed at 15.5%\n')
const fld = n => { const o = []; for (let i = 0; i < n; i++) { const t = i / (n - 1)
  o.push({ name: 'D' + i, startPos: i + 1, corrAvgRating: 110 - t * 45, corrAvgFinish: 6 + t * 26,
    trackAvgRating: 108 - t * 42, trackAvgFinish: 7 + t * 25, lrpTime: 30 + t * .9,
    pitCrewTime: 12 + t * 1.4, corrWinConv: .35 - t * .3, nCorrRaces: 12 }) } return o }
const scA = buildSpeedScores(fld(38), DEFAULT_WEIGHTS), PA = getCautionPresets('cup')
console.log('  arm         5.5(Low)  5.9(Low)  6.1(Med)  6.5(Med)   jump across boundary')
for (const [nm, opts] of Object.entries(ARMS)) {
  const v = [5.5, 5.9, 6.1, 6.5].map(c => {
    const r = runRaceSim(scA, { numSims: 20000, cautionPreset: PA[c < 6 ? 0 : 1], dnfRate: .155,
      totalRaceLaps: 300, trackGroup: 'INT', startSampling: null, ...opts })
    return r.reduce((s, x) => s + x.dnfPct, 0) / 100 / 38 * 100 })
  const jump = Math.abs(v[2] - v[1]) / v[1] * 100
  console.log('  ' + nm.padEnd(11) + v.map(x => x.toFixed(1).padStart(7) + '%').join('  ') +
    '   ' + jump.toFixed(1) + '%' + (jump < 10 ? '  PASS' : '  FAIL'))
}
// ---------- NULL + ARMS
console.log(`\nGATES B / C / D / E — holdout ${boards.length} races, ${SIMS} sims, ${RUNS} runs per arm\n`)
const res = {}
for (const nm of ['NULL', ...Object.keys(ARMS)]) res[nm] = []
for (let r = 0; r < RUNS; r++) {
  const base = measure(ARMS.CURRENT)
  res.CURRENT.push(base)
  res.NULL.push(measure(ARMS.CURRENT))
  res.EV.push(measure(ARMS.EV))
  res['EV+CLAMP'].push(measure(ARMS['EV+CLAMP']))
  res.SHIPPED.push(measure(ARMS.SHIPPED))
}
const mean = a => a.reduce((x, y) => x + y, 0) / a.length
const delta = (arm, k, sub) => mean(res[arm].map((v, i) => (sub ? v.cal[k] : v[k]) - (sub ? res.CURRENT[i].cal[k] : res.CURRENT[i][k])))
const absNull = (k, sub) => mean(res.NULL.map((v, i) => Math.abs((sub ? v.cal[k] : v[k]) - (sub ? res.CURRENT[i].cal[k] : res.CURRENT[i][k]))))
console.log('GATE B — Brier delta vs CURRENT (negative = better). Null |delta| is the noise floor.')
console.log('  metric      null |d|     EV delta      EV+CLAMP delta')
for (const k of ['wb', 't5', 't10']) {
  const nm = { wb: 'win', t5: 'top5', t10: 'top10' }[k]
  console.log('  ' + nm.padEnd(11) + (absNull(k) * 1e5).toFixed(2).padStart(7) + 'e-5' +
    (delta('EV', k) * 1e5).toFixed(2).padStart(12) + 'e-5' + (delta('EV+CLAMP', k) * 1e5).toFixed(2).padStart(14) + 'e-5')
}
console.log('\nGATE C (REPAIRED) — weighted mean calibration error, points. Lower is better.')
console.log('  market      CURRENT    null |d|      EV delta    EV+CLAMP delta')
for (const k of ['win', 't5', 't10']) {
  console.log('  ' + k.padEnd(11) + mean(res.CURRENT.map(v => v.cal[k])).toFixed(3).padStart(7) +
    absNull(k, true).toFixed(3).padStart(12) + delta('EV', k, true).toFixed(3).padStart(13) +
    delta('EV+CLAMP', k, true).toFixed(3).padStart(15))
}
console.log('\nGATES D / E')
for (const nm of ['CURRENT', 'EV', 'EV+CLAMP', 'SHIPPED']) {
  console.log('  ' + nm.padEnd(11) + 'DNF bias ' + mean(res[nm].map(v => v.bias)).toFixed(2).padStart(6) +
    '   cup Talladega ' + mean(res[nm].map(v => v.tal)).toFixed(1) + '% (measured ' +
    mean(res[nm].map(v => v.talObs)).toFixed(1) + '%)')
}

// ---------- SHIP VERIFICATION
// SHIPPED passes no flags. It must be indistinguishable from EV+CLAMP and clearly separated
// from CURRENT. If this ever flips, the engine default was reverted and every "we shipped the
// fix" claim in BACKTEST_LOG is false for the current tree.
console.log('\nSHIP VERIFICATION — default path (no flags) vs the gated arm')
let shipOk = true
for (const k of ['wb', 't5', 't10']) {
  const nm = { wb: 'win', t5: 'top5', t10: 'top10' }[k]
  const dShip = Math.abs(delta('SHIPPED', k) - delta('EV+CLAMP', k))
  const pass = dShip <= absNull(k) * 1.5
  if (!pass) shipOk = false
  console.log('  ' + nm.padEnd(7) + '|SHIPPED - EV+CLAMP| ' + (dShip * 1e5).toFixed(2).padStart(7) +
    'e-5   vs null floor ' + (absNull(k) * 1e5).toFixed(2) + 'e-5   ' + (pass ? 'PASS' : 'FAIL'))
}
const bShip = Math.abs(mean(res.SHIPPED.map(v => v.bias)) - mean(res['EV+CLAMP'].map(v => v.bias)))
console.log('  DNF bias |SHIPPED - EV+CLAMP| ' + bShip.toFixed(3) + ' cars/race   ' + (bShip < 0.08 ? 'PASS' : 'FAIL'))
if (bShip >= 0.08) shipOk = false
console.log(shipOk ? '\n  => the default path IS the fix.' : '\n  => DEFAULT PATH DOES NOT MATCH THE GATED ARM — investigate before trusting this tree.')

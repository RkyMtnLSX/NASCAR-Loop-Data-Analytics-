// scripts/calibrate-tilt-tiers.js — TRAIN-ONLY calibration of the tilt's STEEPNESS.
//
//   node scripts/calibrate-tilt-tiers.js
//
// The log-link refit corrected the estimation scale but not necessarily the delivered
// steepness: what a board actually experiences is the two layers COMBINED and weighted by
// WRECK_ACC_SHARE, run through the wreck-event machinery, not the raw betas. So this
// measures what the sim DELIVERS per field tier on TRAIN boards and searches one global
// scale factor lambda on the betas so that delivered tier rates match OBSERVED tier rates.
//
// One parameter, fitted on TRAIN 2022-2024 only, targeting exactly the quantity that failed:
// the per-tier DNF rate. The holdout is not read here.
const fs = require('fs'), path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup,
  isRoadCourse, isSuperspeedway, DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS,
  TRUCK_ROAD_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } = E
const SIMS = Number(process.env.SIMS || 6000), num = s => (s === '' || s == null ? null : Number(s))
function wf(se, tr) {
  if (isRoadCourse(tr)) return se === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(tr)) return se === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (se === 'trucks' && __trackGroup(tr) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
const boards = []
for (const line of fs.readFileSync(path.join(__dirname, 'backtest-data', 'train.txt'), 'utf8').split('\n').filter(l => l.trim())) {
  const [h, b] = line.split('#'); if (!b) continue
  const [series, track, grp, pDnf, pN, pCau] = h.split('|')
  const dr = [], dnf = []; let i = 0
  for (const rec of b.split(';')) {
    const f = rec.split(','); if (f.length < 9) continue
    dr.push({ name: 'D' + i, startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]),
      nCorrRaces: num(f[5]) || 0, trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]),
      nTrackRaces: num(f[8]) || 0, lrpTime: null, pitCrewTime: null, corrWinConv: null })
    dnf.push(num(f[2])); i++
  }
  if (dr.length < 15) continue
  const P = getCautionPresets(series), cau = num(pCau)
  const sc = buildSpeedScores(dr, wf(series, track))
  const ord = sc.map((d, ix) => ({ ix, s: d.speedScore || 0 })).sort((a, x) => x.s - a.s)
  const tier = new Array(sc.length); ord.forEach((o, r) => { tier[o.ix] = Math.min(3, Math.floor(r / (sc.length / 4))) })
  boards.push({ sc, dnf, tier, g: __trackGroup(track),
    rate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0),
    preset: cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2]
      : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a) })
}
function tiers(lambda) {
  const T = [0, 1, 2, 3].map(() => ({ p: 0, o: 0, n: 0 }))
  for (const b of boards) {
    const rows = runRaceSim(b.sc, { numSims: SIMS, cautionPreset: b.preset, dnfRate: b.rate,
      totalRaceLaps: 300, trackGroup: b.g, startSampling: null,
      skillTilt: lambda === null ? false : true, tiltScale: lambda === null ? 1 : lambda })
    for (const r of rows) { const t = T[b.tier[r.simIdx]]; t.p += r.dnfPct / 100; t.o += b.dnf[r.simIdx]; t.n++ }
  }
  return T.map(t => ({ pred: t.p / t.n, obs: t.o / t.n }))
}
const obs = tiers(null).map(t => t.obs)
console.log(`TRAIN ${boards.length} races. Observed DNF% by tier (Q4 strongest -> Q1 weakest):`)
console.log('  ' + obs.map(o => (o * 100).toFixed(1)).join('   '))
console.log('\nlambda   delivered Q4/Q3/Q2/Q1        max abs error')
let best = null
for (const lam of [0, 0.25, 0.4, 0.5, 0.6, 0.75, 1.0]) {
  const T = lam === 0 ? tiers(null) : tiers(lam)
  const err = T.map((t, i) => Math.abs(t.pred - obs[i]))
  const mx = Math.max(...err)
  console.log(String(lam).padEnd(8) + T.map(t => (t.pred * 100).toFixed(1)).join('  ').padEnd(24) + (mx * 100).toFixed(2) + ' pts')
  if (!best || mx < best.mx) best = { lam, mx }
}
console.log(`\nBEST lambda on TRAIN = ${best.lam}  (max tier error ${(best.mx * 100).toFixed(2)} pts)`)

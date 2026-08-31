// scripts/backtest-practice-tilt.js — does the tilt survive when the board carries PRACTICE?
//
//   node scripts/backtest-practice-tilt.js
//
// The open blocker on the skill tilt was: the curve is anchored on speedScore PERCENTILE, and
// every calibration so far used boards with NO practice data, where that ordering is blurrier
// than a live board's. So the anchors might be wrong for production.
//
// RECALIBRATING on practice-carrying boards is NOT POSSIBLE and that is a data fact, not a
// choice. practice_sessions starts in 2023 (1 weekend), has 12 cup weekends in 2024, and only
// reaches all three series in 2025. The 2022-2024 training era is essentially practice-free.
// A practice-era refit would have ~47 weekends to fit 12 free curve parameters, which is
// roughly 15 retirement events per group-tier cell. That fits noise, not a curve.
//
// So this VALIDATES instead of refitting, which turns out to be the better test anyway: run
// the EXISTING curve — fit entirely on practice-free boards — on boards that DO carry practice,
// and see whether the benefit survives a sharper ordering. The curve has never seen a practice
// board, so this is a clean out-of-sample question even though the races overlap the earlier
// holdout.
//
// Four arms on the same 94 races, so practice and tilt are separated:
//   no-practice + flat | no-practice + tilt | practice + flat | practice + tilt
const fs = require('fs'), path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup,
  isRoadCourse, isSuperspeedway, DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS,
  TRUCK_ROAD_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } = E
const SIMS = Number(process.env.SIMS || 12000)
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
  const [series, track, grp, pDnf, pN, pCau] = h.split('|')
  const base = [], lrp = [], dnf = [], fin = []; let i = 0, nP = 0
  for (const rec of b.split(';')) {
    const f = rec.split(','); if (f.length < 10) continue
    base.push({ name: 'D' + i, startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]),
      nCorrRaces: num(f[5]) || 0, trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]),
      nTrackRaces: num(f[8]) || 0, lrpTime: null, pitCrewTime: null, corrWinConv: null })
    const v = num(f[9]); lrp.push(v); if (v != null) nP++
    dnf.push(num(f[2])); fin.push(num(f[1])); i++
  }
  // Only races where practice actually covers most of the field — a board with 3 of 38 drivers
  // graded is not a practice board, and normalizeArr would treat the rest as neutral anyway.
  if (base.length < 15 || nP < base.length * 0.5) continue
  const P = getCautionPresets(series), cau = num(pCau)
  boards.push({ series, track, base, lrp, dnf, fin, g: __trackGroup(track),
    w: wf(series, track), rate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0),
    preset: cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2]
      : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a) })
}
function arm(usePractice, tilt) {
  let wb = 0, t5 = 0, t10 = 0, n = 0, dp = 0, dobs = 0, races = 0
  const T = [0, 1, 2, 3].map(() => ({ p: 0, o: 0, n: 0 }))
  for (const b of boards) {
    const dr = b.base.map((d, i) => usePractice ? { ...d, lrpTime: b.lrp[i] } : d)
    const sc = buildSpeedScores(dr, b.w)
    const ord = sc.map((d, ix) => ({ ix, s: d.speedScore || 0 })).sort((a, x) => x.s - a.s)
    const tier = new Array(sc.length); ord.forEach((o, r) => { tier[o.ix] = Math.min(3, Math.floor(r * 4 / sc.length)) })
    const rows = runRaceSim(sc, { numSims: SIMS, cautionPreset: b.preset, dnfRate: b.rate,
      totalRaceLaps: 300, trackGroup: b.g, startSampling: null, skillTilt: tilt })
    for (const r of rows) {
      const cl = p => Math.max(1e-6, Math.min(1 - 1e-6, p)), f = b.fin[r.simIdx]
      wb += (cl(r.winPct / 100) - (f === 1 ? 1 : 0)) ** 2
      t5 += (cl(r.top5Pct / 100) - (f <= 5 ? 1 : 0)) ** 2
      t10 += (cl(r.top10Pct / 100) - (f <= 10 ? 1 : 0)) ** 2
      n++
      const t = T[tier[r.simIdx]]; t.p += r.dnfPct / 100; t.o += b.dnf[r.simIdx]; t.n++
    }
    dp += rows.reduce((s, r) => s + r.dnfPct, 0) / 100; dobs += b.dnf.reduce((s, x) => s + x, 0); races++
  }
  return { wb: wb / n, t5: t5 / n, t10: t10 / n, dnfBias: (dp - dobs) / races,
    tiers: T.map(t => ({ pred: t.p / t.n, obs: t.o / t.n })) }
}
console.log(`${boards.length} practice-carrying races (>=50% of field graded), ${SIMS} sims/arm\n`)
const A0 = arm(false, false), B0 = arm(false, true), A1 = arm(true, false), B1 = arm(true, true)
console.log('                     win Brier    top5 Brier   top10 Brier   DNF bias')
const row = (nm, r) => console.log(nm.padEnd(20) + r.wb.toFixed(6) + '     ' + r.t5.toFixed(6) + '     ' + r.t10.toFixed(6) + '    ' + r.dnfBias.toFixed(2).padStart(6))
row('no-practice flat', A0); row('no-practice TILT', B0); row('practice    flat', A1); row('practice    TILT', B1)
console.log('\nTILT GAIN (positive = tilt better), x1e-5')
console.log('  without practice   win ' + ((A0.wb - B0.wb) * 1e5).toFixed(2).padStart(7) +
  '   top5 ' + ((A0.t5 - B0.t5) * 1e5).toFixed(2).padStart(7) + '   top10 ' + ((A0.t10 - B0.t10) * 1e5).toFixed(2).padStart(7))
console.log('  WITH practice      win ' + ((A1.wb - B1.wb) * 1e5).toFixed(2).padStart(7) +
  '   top5 ' + ((A1.t5 - B1.t5) * 1e5).toFixed(2).padStart(7) + '   top10 ' + ((A1.t10 - B1.t10) * 1e5).toFixed(2).padStart(7))
console.log('\nPER-TIER RAIL, practice boards (DNF% pred vs actual)')
console.log('tier            flat    TILT   ACTUAL   |flat-act|  |tilt-act|   rail')
const nm = ['Q4 strongest', 'Q3', 'Q2', 'Q1 weakest']; let pass = true
for (let i = 0; i < 4; i++) {
  const a = A1.tiers[i], b = B1.tiers[i]
  const ea = Math.abs(a.pred - a.obs), eb = Math.abs(b.pred - b.obs)
  const ok = eb <= ea + 0.005; if (!ok) pass = false
  console.log(nm[i].padEnd(15) + (a.pred * 100).toFixed(1).padStart(5) + (b.pred * 100).toFixed(1).padStart(8) +
    (a.obs * 100).toFixed(1).padStart(8) + (ea * 100).toFixed(2).padStart(11) + (eb * 100).toFixed(2).padStart(12) + '    ' + (ok ? 'PASS' : 'FAIL'))
}
console.log('\nPER-TIER RAIL ON PRACTICE BOARDS: ' + (pass ? 'PASS' : 'FAIL'))

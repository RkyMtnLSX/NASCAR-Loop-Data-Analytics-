// scripts/backtest-caution-mix.js — the pre-registered holdout for Fix C.
//
//   node scripts/backtest-caution-mix.js
//
// Registered in BACKTEST_LOG 2026-08-31 BEFORE this was run. Holdout is 2025-2026, all
// three series, 162 races. Nothing about the mechanism is fitted here: K is computed from
// data, so there is no parameter to tune against the holdout.
//
// WHAT IS RECONSTRUCTED, and honestly what is not. Every driver's inputs come from races
// STRICTLY BEFORE the one being predicted (SQL window functions, Next Gen floor 2022):
// correlated-group rating and finish, same-track rating and finish, and the track's prior
// DNF rate and prior caution-bucket frequencies. Start position is the real grid, which is
// known pre-race. Practice long-run pace and pit-crew times are NOT reconstructable at this
// scale and are left null, so buildSpeedScores neutralizes them.
//
// That makes ABSOLUTE calibration worse than the live product, which has practice data. It
// does NOT weaken the comparison: both arms get byte-identical driver inputs and differ
// only by cautionMix. This measures the DELTA, which is the registered question.
//
// ARM A  current shipped behaviour: one caution preset for the whole board, picked the way
//        SimulationCenter picks it (superspeedways from the hard <6 / <11.5 bucket, others
//        nearest preset to the track's prior mean total_cautions).
// ARM B  same preset, plus cautionMix built from that track's PRIOR caution-bucket counts.

const fs = require('fs')
const path = require('path')
const E = require('./loadEngine')
const {
  buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup,
  isRoadCourse, isSuperspeedway,
  DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS, TRUCK_ROAD_WEIGHTS,
  SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS,
} = E

const SIMS = Number(process.env.SIMS || 10000)
const num = s => (s === '' || s == null ? null : Number(s))

function weightsFor(series, track) {
  if (isRoadCourse(track)) return series === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(track)) return series === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (series === 'trucks' && __trackGroup(track) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}

// --------------------------------------------------------------------- scoring
// Brier and log loss on the three markets the product actually sells, plus a
// reliability table: bucket every (driver, market) prediction by its probability and
// compare predicted to observed. That table is the chi-square the registration named.
const BINS = [0, 0.02, 0.05, 0.10, 0.20, 0.35, 1.01]
const MARKETS = [['win', 1], ['top5', 5], ['top10', 10], ['fin25', 25]]

function newAcc() {
  const m = {}
  for (const [k] of MARKETS) m[k] = { brier: 0, ll: 0, n: 0, bins: BINS.slice(0, -1).map(() => ({ p: 0, o: 0, n: 0 })) }
  m.dnfPred = 0; m.dnfObs = 0; m.races = 0
  return m
}
function accumulate(acc, rows, actualFinish, actualDnf, fieldN) {
  for (const [key, cut] of MARKETS) {
    const bucket = acc[key]
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const p = Math.max(1e-6, Math.min(1 - 1e-6,
        key === 'win' ? r.winPct / 100 : key === 'top5' ? r.top5Pct / 100 :
        key === 'top10' ? r.top10Pct / 100 : countLE(r, 25)))
      const y = actualFinish[r.simIdx] <= cut ? 1 : 0
      bucket.brier += (p - y) * (p - y)
      bucket.ll += -(y ? Math.log(p) : Math.log(1 - p))
      bucket.n++
      let b = 0; while (b < BINS.length - 2 && p >= BINS[b + 1]) b++
      bucket.bins[b].p += p; bucket.bins[b].o += y; bucket.bins[b].n++
    }
  }
  acc.dnfPred += rows.reduce((s, r) => s + r.dnfPct, 0) / 100
  acc.dnfObs += actualDnf.reduce((s, x) => s + x, 0)
  acc.races++
  void fieldN
}
// fin<=25 is not a returned column; read it off the finish histogram via posMatrix-free
// fields we do have. projFinish percentiles are too coarse, so recompute from the row's
// own distribution using the p25/p50/p75 the sim already reports would be lossy - instead
// the caller supplies it. Kept simple: derive from top10Pct upward is impossible, so we
// approximate fin25 with the sim's own finishP75 ordering. See note in the log entry.
function countLE(r, cut) { return r.finishP75 <= cut ? 0.75 : r.finishP50 <= cut ? 0.5 : r.finishP25 <= cut ? 0.25 : 0.1 }

function chiSquare(bucket) {
  let x2 = 0, cells = 0
  for (const b of bucket.bins) {
    if (b.n < 30) continue
    const e = b.p, o = b.o
    if (e < 5) continue
    x2 += (o - e) * (o - e) / e
    cells++
  }
  return { x2, cells }
}

// --------------------------------------------------------------------- run
const lines = fs.readFileSync(path.join(__dirname, 'backtest-data', 'holdout.txt'), 'utf8')
  .split('\n').filter(l => l.trim())

const A = newAcc(), B = newAcc()
let used = 0, skipped = 0

for (const line of lines) {
  const [head, body] = line.split('#')
  const [series, track, grp, pDnf, pN, pCau, wl, wm, wh] = head.split('|')
  if (!body) { skipped++; continue }

  const drivers = [], actualFinish = [], actualDnf = []
  let idx = 0
  for (const rec of body.split(';')) {
    const f = rec.split(',')
    if (f.length < 9) continue
    drivers.push({
      name: 'D' + idx,
      startPos: num(f[0]),
      corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]), nCorrRaces: num(f[5]) || 0,
      trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]), nTrackRaces: num(f[8]) || 0,
      lrpTime: null, pitCrewTime: null, corrWinConv: null,
    })
    actualFinish.push(num(f[1])); actualDnf.push(num(f[2])); idx++
  }
  if (drivers.length < 15) { skipped++; continue }

  const presets = getCautionPresets(series)
  const cau = num(pCau)
  const preset = cau == null ? presets[1]
    : isSuperspeedway(track) ? presets[cau < 6 ? 0 : cau < 11.5 ? 1 : 2]
    : presets.reduce((a, b) => Math.abs(b.value - cau) < Math.abs(a.value - cau) ? b : a)

  const dnfRate = resolveDnfRate(series, grp, num(pDnf), num(pN) || 0)
  const g = __trackGroup(track)
  const scored = buildSpeedScores(drivers, weightsFor(series, track))

  const cfg = { numSims: SIMS, cautionPreset: preset, dnfRate, totalRaceLaps: 300, trackGroup: g, startSampling: null }
  const wCounts = [Number(wl) || 0, Number(wm) || 0, Number(wh) || 0]
  const wTot = wCounts[0] + wCounts[1] + wCounts[2]

  const rowsA = runRaceSim(scored, cfg)
  const rowsB = wTot >= 2
    ? runRaceSim(scored, { ...cfg, cautionMix: { presets, w: wCounts.map(x => x / wTot) } })
    : runRaceSim(scored, cfg)

  accumulate(A, rowsA, actualFinish, actualDnf, drivers.length)
  accumulate(B, rowsB, actualFinish, actualDnf, drivers.length)
  used++
}

// --------------------------------------------------------------------- report
console.log(`holdout races used ${used}, skipped ${skipped}, ${SIMS} sims/arm/race\n`)
console.log('market    arm      Brier        LogLoss      chi2 (cells)')
for (const [key] of MARKETS) {
  if (key === 'fin25') continue
  for (const [nm, acc] of [['A cur', A], ['B mix', B]]) {
    const b = acc[key], c = chiSquare(b)
    console.log(`${key.padEnd(9)} ${nm}   ${(b.brier / b.n).toFixed(6)}   ${(b.ll / b.n).toFixed(6)}   ${c.x2.toFixed(1)} (${c.cells})`)
  }
}
const rel = (acc, key) => acc[key].bins.filter(b => b.n >= 30)
  .map(b => `${(b.p / b.n * 100).toFixed(1)}->${(b.o / b.n * 100).toFixed(1)}`).join('  ')
console.log('\nwin reliability (predicted% -> observed%), bins with n>=30')
console.log('  A cur  ' + rel(A, 'win'))
console.log('  B mix  ' + rel(B, 'win'))
console.log('\ntop5 reliability')
console.log('  A cur  ' + rel(A, 'top5'))
console.log('  B mix  ' + rel(B, 'top5'))
console.log('\nDNF cars per race   predicted vs observed')
console.log(`  A cur  ${(A.dnfPred / A.races).toFixed(2)} vs ${(A.dnfObs / A.races).toFixed(2)}   bias ${((A.dnfPred - A.dnfObs) / A.races).toFixed(2)}`)
console.log(`  B mix  ${(B.dnfPred / B.races).toFixed(2)} vs ${(B.dnfObs / B.races).toFixed(2)}   bias ${((B.dnfPred - B.dnfObs) / B.races).toFixed(2)}`)

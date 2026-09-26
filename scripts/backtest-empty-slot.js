// scripts/backtest-empty-slot.js - pre-registered test of the EMPTY-SLOT rule (BACKTEST_LOG 2026-09-26).
//
//   node scripts/backtest-empty-slot.js            (SIMS=10000 default)
//
// Holdout = scripts/backtest-data/holdout.txt (2025-26, all three series, 162 races), the same
// reconstruction the caution-mix and attrition tests used: every input from races strictly before the
// one predicted; practice long-run pace and pit-crew times are NOT reconstructable and are null for
// every driver - which is exactly the condition the rule is about.
//
// ARM A  current: the practice slot (and pit slot) fill at 50 for every driver, weight kept.
// ARM B  dropEmptySlots: a slot with no data for anyone contributes to no one; its weight is
//        redistributed pro rata to the slots that have data.
// Same driver inputs, same caution preset, same DNF rate, same RNG seeding order. Scored on win /
// top-5 / top-10 Brier and log loss with reliability bins.
const fs = require('fs')
const path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup, isRoadCourse, isSuperspeedway,
  DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS, TRUCK_ROAD_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } = E
const SIMS = Number(process.env.SIMS || 10000)
const num = s => (s === '' || s == null ? null : Number(s))
function weightsFor(series, track) {
  if (isRoadCourse(track)) return series === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(track)) return series === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (series === 'trucks' && __trackGroup(track) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
const BINS = [0, 0.02, 0.05, 0.10, 0.20, 0.35, 1.01]
const MARKETS = [['win', 1], ['top5', 5], ['top10', 10]]
function newAcc() { const m = {}; for (const [k] of MARKETS) m[k] = { brier: 0, ll: 0, n: 0, bins: BINS.slice(0, -1).map(() => ({ p: 0, o: 0, n: 0 })) }; m.races = 0; m.wins = 0; m.favHit = 0; return m }
function accumulate(acc, rows, actualFinish, bySeries) {
  for (const [key, cut] of MARKETS) {
    const b = acc[key]
    rows.forEach((r) => {
      const p = Math.min(1 - 1e-6, Math.max(1e-6, (key === 'win' ? r.winPct : key === 'top5' ? r.top5Pct : r.top10Pct) / 100))
      const o = actualFinish[r.simIdx] != null && actualFinish[r.simIdx] <= cut ? 1 : 0
      b.brier += (p - o) ** 2; b.ll += -(o * Math.log(p) + (1 - o) * Math.log(1 - p)); b.n++
      const bi = BINS.findIndex((lo, j) => p >= lo && p < BINS[j + 1]); if (bi >= 0) { b.bins[bi].p += p; b.bins[bi].o += o; b.bins[bi].n++ }
    })
  }
  acc.races++
  const fav = rows.reduce((a, r) => (r.winPct > a.winPct ? r : a), rows[0])
  if (actualFinish[fav.simIdx] === 1) acc.favHit++
}
const lines = fs.readFileSync(path.join(__dirname, 'backtest-data', 'holdout.txt'), 'utf8').split('\n').filter(l => l.trim())
const A = newAcc(), B = newAcc(); const perSeries = {}
let used = 0, skipped = 0
for (const line of lines) {
  const [head, body] = line.split('#')
  const [series, track, grp, pDnf, pN, pCau] = head.split('|')
  if (!body) { skipped++; continue }
  const drivers = [], actualFinish = []
  let idx = 0
  for (const rec of body.split(';')) {
    const f = rec.split(',')
    if (f.length < 9) continue
    drivers.push({ name: 'D' + idx, startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]), nCorrRaces: num(f[5]) || 0,
      trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]), nTrackRaces: num(f[8]) || 0, lrpTime: null, pitCrewTime: null, corrWinConv: null })
    actualFinish.push(num(f[1])); idx++
  }
  if (drivers.length < 15) { skipped++; continue }
  const presets = getCautionPresets(series)
  const cau = num(pCau)
  const preset = cau == null ? presets[1] : isSuperspeedway(track) ? presets[cau < 6 ? 0 : cau < 11.5 ? 1 : 2] : presets.reduce((a, b) => Math.abs(b.value - cau) < Math.abs(a.value - cau) ? b : a)
  const dnfRate = resolveDnfRate(series, grp, num(pDnf), num(pN) || 0)
  const cfg = { numSims: SIMS, cautionPreset: preset, dnfRate, totalRaceLaps: 300, trackGroup: __trackGroup(track), startSampling: null }
  const wts = weightsFor(series, track)
  const rowsA = runRaceSim(buildSpeedScores(drivers, wts), cfg)
  const rowsB = runRaceSim(buildSpeedScores(drivers, wts, { dropEmptySlots: true }), cfg)
  accumulate(A, rowsA, actualFinish); accumulate(B, rowsB, actualFinish)
  const ps = perSeries[series] = perSeries[series] || { A: newAcc(), B: newAcc() }
  accumulate(ps.A, rowsA, actualFinish); accumulate(ps.B, rowsB, actualFinish)
  used++
}
console.log(`EMPTY-SLOT RULE  holdout races used ${used}, skipped ${skipped}, ${SIMS} sims/arm/race\n`)
console.log('market   arm        Brier       LogLoss')
for (const [key] of MARKETS) for (const [nm, acc] of [['A 50-fill', A], ['B drop   ', B]]) console.log(`${key.padEnd(8)} ${nm}  ${(acc[key].brier / acc[key].n).toFixed(6)}   ${(acc[key].ll / acc[key].n).toFixed(6)}`)
console.log(`\nfavourite won: A ${A.favHit}/${A.races}  B ${B.favHit}/${B.races}`)
const rel = (acc, key) => acc[key].bins.filter(b => b.n >= 30).map(b => `${(b.p / b.n * 100).toFixed(1)}->${(b.o / b.n * 100).toFixed(1)}`).join('  ')
console.log('\nwin reliability (pred% -> obs%)'); console.log('  A ' + rel(A, 'win')); console.log('  B ' + rel(B, 'win'))
console.log('\nper series (win logloss A -> B, top5 Brier A -> B):')
for (const s of Object.keys(perSeries)) { const p = perSeries[s]; console.log(`  ${s.padEnd(8)} n=${p.A.races}  win ll ${(p.A.win.ll / p.A.win.n).toFixed(4)} -> ${(p.B.win.ll / p.B.win.n).toFixed(4)}   top5 brier ${(p.A.top5.brier / p.A.top5.n).toFixed(4)} -> ${(p.B.top5.brier / p.B.top5.n).toFixed(4)}`) }

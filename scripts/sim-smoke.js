// scripts/sim-smoke.js — proves the race sim runs outside a browser, and checks
// the invariants a backtest would silently depend on.
//
//   node scripts/sim-smoke.js
//
// This is not a model test. It asserts nothing about whether the sim is RIGHT —
// only that it executes headlessly and that its output is internally coherent:
// every sim produces a real finishing order, the probability columns close, and
// the DNF count lands on the budget it was given. If any of those breaks, every
// backtest built on this engine is measuring garbage, so they are worth a gate.

const engine = require('./loadEngine')
const {
  buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate,
  DNF_BY_GROUP, DNF_CAP, DEFAULT_WEIGHTS, __trackGroup,
} = engine

let failures = 0
const ok = (cond, label, detail) => {
  if (cond) { console.log(`  PASS  ${label}${detail ? '  ' + detail : ''}`) }
  else { failures++; console.log(`  FAIL  ${label}${detail ? '  ' + detail : ''}`) }
}

// A deterministic pseudo-field. Ratings/finishes are spread the way a real board is
// (a few strong cars, a long tail) so the sim has something to separate.
function field(n) {
  const out = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    out.push({
      name: `Driver ${i + 1}`,
      startPos: i + 1,
      corrAvgRating: 110 - t * 45,
      corrAvgFinish: 6 + t * 26,
      trackAvgRating: 108 - t * 42,
      trackAvgFinish: 7 + t * 25,
      lrpTime: 30.0 + t * 0.9,
      pitCrewTime: 12.0 + t * 1.4,
      corrWinConv: 0.35 - t * 0.3,
      nCorrRaces: 12,
    })
  }
  return out
}

console.log(`engine: ${engine.__enginePath}`)
console.log(`sha256[0:12]: ${engine.__engineSha}\n`)

// ---------------------------------------------------------------- it loads at all
ok(typeof runRaceSim === 'function', 'runRaceSim imported into node')
ok(typeof buildSpeedScores === 'function', 'buildSpeedScores imported into node')

// ---------------------------------------------------------------- speed scores
const N = 38
const scored = buildSpeedScores(field(N), DEFAULT_WEIGHTS)
ok(scored.length === N, 'buildSpeedScores returns the whole field', `${scored.length}/${N}`)
ok(scored.every(d => Number.isFinite(d.speedScore)), 'every speedScore is finite')
ok(scored[0].speedScore > scored[N - 1].speedScore,
   'the strong end of the field outscores the weak end',
   `${scored[0].speedScore.toFixed(1)} vs ${scored[N - 1].speedScore.toFixed(1)}`)

// ---------------------------------------------------------------- one full run per track group
const presets = getCautionPresets('cup')
const preset = presets[Math.floor(presets.length / 2)]
const SIMS = 20000
const ratios = []

// TWO VOCABULARIES, ON PURPOSE — worth stating because mixing them is silent.
// resolveDnfRate is keyed by tracks.correlation_group_label ('Superspeedway'),
// because that is what the weekend row carries. runRaceSim's trackGroup is the
// engine's own short code ('SS'), which __trackGroup derives from the track name.
// Passing 'SS' to resolveDnfRate does not throw; it misses every key and quietly
// falls back to the series mean, which is how a whole group of races can end up
// simulated at the wrong attrition without anything looking broken.
const GROUPS = [
  ['SHORT', 'Short & Flat Tracks'],
  ['INT',   'Intermediate'],
  ['SS',    'Superspeedway'],
  ['ROAD',  'Road Course'],
]

for (const [grp, label] of GROUPS) {
  const dnfRate = resolveDnfRate('cup', label, null, 0)
  const t0 = Date.now()
  const rows = runRaceSim(scored, {
    numSims: SIMS,
    cautionPreset: preset,
    dnfRate,
    totalRaceLaps: 300,
    trackGroup: grp,
    startSampling: null,
  })
  const ms = Date.now() - t0

  const winSum = rows.reduce((s, r) => s + r.winPct, 0)
  const t10Sum = rows.reduce((s, r) => s + r.top10Pct, 0)
  const dnfMean = rows.reduce((s, r) => s + r.dnfPct, 0) / 100 / N // as a rate per car... see below
  const dnfCars = rows.reduce((s, r) => s + r.dnfPct, 0) / 100     // expected DNF cars per race

  console.log(`\n[${grp}]  dnfRate=${(dnfRate * 100).toFixed(1)}%  ${SIMS} sims in ${ms}ms`)
  ok(rows.length === N, 'a row per driver')
  ok(Math.abs(winSum - 100) < 0.6, 'win% sums to 100', winSum.toFixed(2))
  ok(Math.abs(t10Sum - 1000) < 3, 'top10% sums to 1000', t10Sum.toFixed(1))

  // DNF BUDGET. The sim is handed a per-car retirement rate; over the whole field
  // the realized count should land on n * rate. It does not, and the miss is a
  // function of the caution preset - see the sweep at the bottom of this file and
  // the 2026-08-31 entry in BACKTEST_LOG. This assertion is therefore only a rail
  // against gross breakage (double-counting, a cap silently binding, the wreck
  // layer not firing at all); the real number is measured and printed below.
  const expectCars = N * dnfRate
  const ratio = dnfCars / expectCars
  ratios.push([grp, ratio])
  ok(ratio > 0.4 && ratio < 1.6, 'realized DNF count is in the sane band',
     `${dnfCars.toFixed(2)} cars vs ${expectCars.toFixed(2)} budgeted (x${ratio.toFixed(3)})`)

  // Every sim must be a real finishing order: 1..n, each exactly once.
  const M = rows.posMatrix
  let permOk = true
  for (const s of [0, 1, (SIMS / 2) | 0, SIMS - 1]) {
    const seen = new Uint8Array(N + 2)
    for (let j = 0; j < N; j++) seen[M[s * N + j]]++
    for (let p = 1; p <= N; p++) if (seen[p] !== 1) permOk = false
  }
  ok(permOk, 'each sampled sim is a permutation of 1..n')

  const llSum = rows.reduce((s, r) => s + r.projLapsLed, 0)
  ok(Math.abs(llSum - 300) / 300 < 0.02, 'projected laps led sums to the race distance', llSum.toFixed(1))
  void dnfMean
}

// ---------------------------------------------------------------- the DNF constants themselves
console.log('\n[DNF constants — refreshed 2026-08-30, loop_data 2022-26]')
ok(Math.abs(resolveDnfRate('cup', 'Superspeedway', null, 0) - DNF_BY_GROUP.cup.Superspeedway) < 1e-9,
   'resolveDnfRate returns the group rate with no track history',
   `cup SS ${(DNF_BY_GROUP.cup.Superspeedway * 100).toFixed(1)}%`)
ok(resolveDnfRate('cup', 'Superspeedway', 0.9, 40) === DNF_CAP,
   'the cap binds on an absurd track average', `cap ${(DNF_CAP * 100).toFixed(0)}%`)
// A group label the caller got wrong must NOT silently become a plausible number.
// It does today - it becomes the series mean. Pinned here so the behaviour is a
// recorded decision rather than a surprise the next time someone passes 'SS'.
ok(resolveDnfRate('cup', 'SS', null, 0) === 0.145,
   'an UNKNOWN group label falls back to the series mean (silent - see comment)',
   '0.145')
// conf = min(1, n/8): 4 races is half weight, so the answer sits halfway to the group rate.
const half = resolveDnfRate('cup', 'Intermediate', 0.30, 4)
const wantHalf = 0.30 * 0.5 + DNF_BY_GROUP.cup.Intermediate * 0.5
ok(Math.abs(half - wantHalf) < 1e-9, 'shrinkage toward the group rate is half weight at 4 races',
   `${(half * 100).toFixed(2)}% vs ${(wantHalf * 100).toFixed(2)}%`)
ok(__trackGroup('Talladega Superspeedway') === 'SS', '__trackGroup classifies Talladega as SS')
ok(__trackGroup('Watkins Glen International') === 'ROAD', '__trackGroup classifies Watkins Glen as ROAD')

// ---------------------------------------------------------------- known defect, pinned
// The realized DNF count tracks the CAUTION PRESET, not the rate it was given.
// __wScale normalizes the wreck layer by WRECK_EV_EXP[group] - ONE scalar per track
// group - while WRECK_SETS[group][bucket] holds wildly different event counts per
// caution bucket. So the normalizer is a pooled average: at a low preset the sim
// draws far fewer wrecks than the pooled expectation and delivers roughly half the
// budgeted retirements; at a high preset it overshoots by a third or more.
//
// Measured 2026-08-31, 30k sims, cup/oreilly/trucks x 4 groups x 3 presets:
//     low preset   0.50 - 0.66 x budget
//     mid preset   0.84 - 0.96 x budget
//     high preset  1.19 - 1.48 x budget
//
// This is pinned, not fixed. Fixing it changes shipped win probabilities and DFS
// floors, so it goes through the registration discipline like any other model change.
// It also means the 2026-08-30 DNF constant refresh only lands at a mid preset.
//
// The corroborating detail: when a track group has NO wreck sets, runRaceSim falls
// through to `Math.random() < dnfRate` per car, which honors the budget exactly and
// has no caution dependence at all. The two paths disagree, which is why this reads
// as an accident rather than an intent.
console.log('\n[DNF budget delivery by caution preset — cup, the pinned defect]')
for (const [grp, label] of GROUPS) {
  const rate = resolveDnfRate('cup', label, null, 0)
  const line = []
  for (const p of presets) {
    const rows = runRaceSim(scored, {
      numSims: SIMS, cautionPreset: p, dnfRate: rate,
      totalRaceLaps: 300, trackGroup: grp, startSampling: null,
    })
    const cars = rows.reduce((s, r) => s + r.dnfPct, 0) / 100
    line.push(`${p.label}(${p.value}) x${(cars / (N * rate)).toFixed(2)}`)
  }
  console.log(`  ${grp.padEnd(6)} budget ${(rate * 100).toFixed(1)}%   ` + line.join('   '))
}
console.log('  ^ if these have moved to ~1.00 across the row, the defect was fixed —')
console.log('    update BACKTEST_LOG and this block rather than deleting them.')


console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)

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
// falls back to the series mean. AUDITED 2026-08-31: the only two callers in the app
// (SimulationCenter 299/302) both pass cfg.correlation_label, the long vocabulary, so
// nothing is mis-rated today. This is a latent footgun, pinned so it stays that way.
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

  // DNF BUDGET. The sim is handed a per-car retirement rate; the realized count sits
  // near n * rate but is deliberately modulated by the caution preset (wreck-v1.1-cb -
  // see the block at the bottom of this file). This assertion is therefore only a rail
  // against gross breakage (double-counting, a cap silently binding, the wreck layer
  // not firing at all); the calibrated values are measured and printed below.
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

// ------------------------------------------- calibration regression check (NOT a defect)
// The realized DNF count is modulated by the CAUTION PRESET rather than landing on the
// budget. That is wreck-v1.1-cb, shipped 2026-07-28, BY DESIGN: __wScale normalizes by
// WRECK_EV_EXP[group] (one scalar per group) while WRECK_SETS[group][bucket] holds
// calm/typical/chaotic event pools, so a calm race retires fewer cars than the track's
// mean and a chaotic one more. The Caution Rate card states this in the UI.
//
// THIS ROW CHANGED MEANING ON 2026-08-31. Read this before interpreting it.
//
// It used to PRINT a spread and tell you the spread was correct. From 2026-07-28 to
// 2026-08-31 the wreck normalizer was global per track group while the wreck pools were
// per caution bucket, so realized attrition came out ~0.5x the dnfRate budget at Low,
// ~0.9x at Medium and ~1.4x at High (archive shape: SHORT 0.58/0.87/1.48, INT
// 0.51/0.90/1.55, SS 0.51/1.01/1.38, ROAD 0.67/0.98/1.31). That was declared by design.
//
// It is no longer the design. WRECK_EV_EXP_B normalizes each pool against its OWN
// expected accident count, so every preset now delivers the budget and the caution
// preset does not move attrition at all. The spread was a cliff generator: it was
// selected by a hard <6 / <11.5 threshold on a noisy track average, and 17 of 60 track
// cells (28%) cross a threshold at least once across seasons, which swung their
// attrition ~73% for no physical reason.
//
// So this is now an ASSERTION, not a printout. All three presets must land on budget.
// If one drifts outside the band, the wreck layer changed and no backtest should be
// trusted until you know why.
console.log('\n[DNF budget delivery by caution preset — must be FLAT after the 2026-08-31 fix]')
for (const [grp, label] of GROUPS) {
  const rate = resolveDnfRate('cup', label, null, 0)
  const line = [], mults = []
  for (const p of presets) {
    const rows = runRaceSim(scored, {
      numSims: SIMS, cautionPreset: p, dnfRate: rate,
      totalRaceLaps: 300, trackGroup: grp, startSampling: null,
    })
    const cars = rows.reduce((s, r) => s + r.dnfPct, 0) / 100
    const mult = cars / (N * rate)
    mults.push(mult)
    line.push(`${p.label}(${p.value}) x${mult.toFixed(2)}`)
  }
  console.log(`  ${grp.padEnd(6)} budget ${(rate * 100).toFixed(1)}%   ` + line.join('   '))
  const spread = Math.max(...mults) - Math.min(...mults)
  ok(spread <= 0.25, `${grp} attrition is preset-independent`,
    `spread ${spread.toFixed(2)} across Low/Med/High (was ~0.90 before the fix)`)
  ok(mults.every(m => m > 0.80 && m < 1.20), `${grp} every preset lands on budget`,
    `range ${Math.min(...mults).toFixed(2)}-${Math.max(...mults).toFixed(2)}`)
}


// ---------------------------------------------------------------- caution mix (FIX C)
// The mix is OFF unless a board passes cautionMix, so the rows above are unchanged. With a
// track's own caution-bucket frequencies supplied, delivered attrition must land on the
// budget instead of on the bucket's multiplier - that is the whole point of the K
// normalization, and it is the one property worth asserting rather than printing.
console.log('\n[caution mix — delivered should land ON budget for any distribution]')
{
  const dists = [
    ['calm-heavy   [7,1,0]', [7, 1, 0]],
    ['Talladega    [4,5,0]', [4, 5, 0]],
    ['even         [1,1,1]', [1, 1, 1]],
    ['chaos-heavy  [0,1,4]', [0, 1, 4]],
  ]
  for (const [grp, label] of [['SS', 'Superspeedway'], ['INT', 'Intermediate'], ['SHORT', 'Short & Flat Tracks']]) {
    const rate = resolveDnfRate('cup', label, null, 0)
    for (const [name, cnt] of dists) {
      const tot = cnt[0] + cnt[1] + cnt[2]
      const rows = runRaceSim(scored, {
        numSims: SIMS, cautionPreset: presets[1], dnfRate: rate,
        totalRaceLaps: 300, trackGroup: grp, startSampling: null,
        cautionMix: { presets, w: cnt.map(x => x / tot) },
      })
      const got = rows.reduce((s, r) => s + r.dnfPct, 0) / 100 / N
      ok(Math.abs(got / rate - 1) < 0.06, `${grp} ${name} lands on budget`,
         `${(got * 100).toFixed(1)}% vs ${(rate * 100).toFixed(1)}%  (x${(got / rate).toFixed(3)})`)
    }
  }
  // A single-bucket mix must be a no-op, not a rescale.
  //
  // This used to assert against a hardcoded 0.51 — the INT Low multiplier under the old global
  // normalizer. That constant is exactly what the 2026-08-31 fix removes, so the test failed on
  // ship for the right reason: it was encoding the bug as the expectation. Comparing the mix
  // path to the NON-MIX path with the same preset tests the actual property ("adding a
  // one-element mix changes nothing") and cannot go stale when the multipliers move again.
  const mixCfg = {
    numSims: SIMS, cautionPreset: presets[0], dnfRate: 0.155,
    totalRaceLaps: 300, trackGroup: 'INT', startSampling: null,
  }
  const one = runRaceSim(scored, { ...mixCfg, cautionMix: { presets: [presets[0]], w: [1] } })
  const plain = runRaceSim(scored, mixCfg)
  const oneGot = one.reduce((s, r) => s + r.dnfPct, 0) / 100 / N
  const plainGot = plain.reduce((s, r) => s + r.dnfPct, 0) / 100 / N
  ok(Math.abs(oneGot - plainGot) / plainGot < 0.05, 'a single-bucket mix stays a no-op (no K rescale)',
     `mix x${(oneGot / 0.155).toFixed(3)} vs plain x${(plainGot / 0.155).toFixed(3)}`)
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)

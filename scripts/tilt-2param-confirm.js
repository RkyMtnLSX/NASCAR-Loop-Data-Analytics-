// scripts/tilt-2param-confirm.js — POST-HOC checks on the two-parameter result.
//
//   RUNS=5 SIMS=6000 node scripts/tilt-2param-confirm.js
//
// NOT GATES. The registered gates (7065fe3, amended 46950e1) already ran and passed. These two
// checks exist because the passing result raised questions the registration did not anticipate,
// and both can only argue AGAINST shipping, never for it:
//
//  A) POWER. GATE 3 reported top10 at -5.31e-5 against a 3.58e-5 null floor — "better beyond
//     noise", but only 1.5x the floor at 3 runs. Six parameterizations have now been tested and
//     five landed inside noise; a marginal beyond-noise result on the sixth is exactly what a
//     multiple-comparisons artifact looks like. More runs shrink the null floor and settle it.
//
//  B) SERIES SPLIT. Gate 0's secondary read showed the per-tier gaps are wildly heterogeneous
//     across series — cup Q4 -0.05 (essentially clean) vs trucks Q4 +5.75. The curve is keyed to
//     TRACK GROUP, not series, so one correction is applied across all three. Cup is the series
//     the operator actually sells and the one the reconstruction reproduces best (5/5 favourite
//     match vs 0/3 O'Reilly). If this change helps trucks and hurts cup, the aggregate is a lie.

const fs = require('fs')
const path = require('path')
const E = require('./loadEngine')
const {
  buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup,
  isRoadCourse, isSuperspeedway,
  DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS, TRUCK_ROAD_WEIGHTS,
  SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS,
} = E

const SIMS = Number(process.env.SIMS || 6000)
const RUNS = Number(process.env.RUNS || 5)
const num = s => (s === '' || s == null ? null : Number(s))
const CURVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'backtest-data', 'tilt-2param.json'), 'utf8')).curve

function weightsFor(series, track) {
  if (isRoadCourse(track)) return series === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(track)) return series === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (series === 'trucks' && __trackGroup(track) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
function tiersOf(scored) {
  const order = scored.map((d, i) => ({ i, s: d.speedScore == null ? 0 : d.speedScore }))
    .sort((a, b) => b.s - a.s)
  const t = new Array(scored.length)
  order.forEach((o, r) => { t[o.i] = 3 - Math.min(3, Math.floor(r / (order.length / 4))) })
  return t
}

const boards = []
for (const line of fs.readFileSync(path.join(__dirname, 'backtest-data', 'holdout.txt'), 'utf8')
  .split('\n').filter(l => l.trim())) {
  const [head, body] = line.split('#')
  if (!body) continue
  const [series, track, grp, pDnf, pN, pCau] = head.split('|')
  const drivers = [], fin = [], dnf = []
  for (const rec of body.split(';')) {
    const f = rec.split(',')
    if (f.length < 9) continue
    drivers.push({
      name: 'D' + drivers.length, startPos: num(f[0]),
      corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]), nCorrRaces: num(f[5]) || 0,
      trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]), nTrackRaces: num(f[8]) || 0,
      lrpTime: null, pitCrewTime: null, corrWinConv: null,
    })
    fin.push(num(f[1])); dnf.push(num(f[2]))
  }
  if (drivers.length < 15) continue
  const presets = getCautionPresets(series)
  const cau = num(pCau)
  const preset = cau == null ? presets[1] : isSuperspeedway(track) ? presets[1]
    : presets.reduce((a, b) => Math.abs(b.value - cau) < Math.abs(a.value - cau) ? b : a)
  const g = __trackGroup(track)
  boards.push({
    series, scored: buildSpeedScores(drivers, weightsFor(series, track)), fin, dnf, g,
    cfg: { numSims: SIMS, cautionPreset: preset, dnfRate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0),
           totalRaceLaps: 300, trackGroup: g, startSampling: null },
    tiltOpts: { skillTilt: true, tiltRescale: false, tiltCurve: CURVE[g] || null },
  })
}

const SERIES = ['cup', 'oreilly', 'trucks']
function measureArm(tilt) {
  const S = {}; for (const s of [...SERIES, 'ALL']) S[s] = { wb: 0, t5: 0, t10: 0, n: 0, dp: 0, dobs: 0, q4b10: 0, q4n: 0 }
  for (const bd of boards) {
    const rows = runRaceSim(bd.scored, tilt ? { ...bd.cfg, ...bd.tiltOpts } : bd.cfg)
    const tiers = tiersOf(bd.scored)
    for (const r of rows) {
      const y1 = bd.fin[r.simIdx] <= 1 ? 1 : 0, y5 = bd.fin[r.simIdx] <= 5 ? 1 : 0, y10 = bd.fin[r.simIdx] <= 10 ? 1 : 0
      const p1 = r.winPct / 100, p5 = r.top5Pct / 100, p10 = r.top10Pct / 100
      for (const k of [bd.series, 'ALL']) {
        const a = S[k]
        a.wb += (p1 - y1) ** 2; a.t5 += (p5 - y5) ** 2; a.t10 += (p10 - y10) ** 2; a.n++
        a.dp += r.dnfPct / 100
        if (tiers[r.simIdx] === 3) { a.q4b10 += (p10 - y10) ** 2; a.q4n++ }
      }
    }
    for (const k of [bd.series, 'ALL']) S[k].dobs += bd.dnf.reduce((s, x) => s + x, 0)
  }
  const out = {}
  for (const k of [...SERIES, 'ALL']) {
    const a = S[k]
    out[k] = a.n ? { wb: a.wb / a.n, t5: a.t5 / a.n, t10: a.t10 / a.n, q4b10: a.q4n ? a.q4b10 / a.q4n : 0 } : null
  }
  return out
}

const F = [], N = [], T = []
console.log(`POST-HOC CONFIRM — ${boards.length} races, ${SIMS} sims, ${RUNS} runs\n`)
for (let r = 0; r < RUNS; r++) {
  F.push(measureArm(false)); N.push(measureArm(false)); T.push(measureArm(true))
  process.stdout.write(`  run ${r + 1}/${RUNS}\n`)
}
const mean = a => a.reduce((x, y) => x + y, 0) / a.length
const d = (arr, k, m) => mean(arr.map((v, i) => v[k][m] - F[i][k][m]))
const nullf = (k, m) => mean(N.map((v, i) => Math.abs(v[k][m] - F[i][k][m])))

console.log('\nA) POWER — aggregate, now at ' + RUNS + ' runs\n')
console.log('metric     delta        null floor    verdict')
for (const [m, nm] of [['wb', 'win'], ['t5', 'top5'], ['t10', 'top10']]) {
  const dd = d(T, 'ALL', m), nf = nullf('ALL', m)
  console.log(`${nm.padEnd(10)} ${(dd * 1e5).toFixed(2).padStart(7)}e-5   ${(nf * 1e5).toFixed(2).padStart(6)}e-5    ` +
    (dd < -nf ? `better beyond noise (${(Math.abs(dd) / nf).toFixed(1)}x floor)` : dd > nf ? 'WORSE beyond noise' : 'inside noise'))
}

console.log('\nB) SERIES SPLIT — is the aggregate hiding a cup regression?\n')
console.log('series    n     top10 delta   null      win delta    Q4 top10 delta   verdict on cup-relevant markets')
for (const s of SERIES) {
  const n = boards.filter(b => b.series === s).length
  if (!n) continue
  const t10 = d(T, s, 't10'), nf = nullf(s, 't10'), w = d(T, s, 'wb'), q4 = d(T, s, 'q4b10')
  console.log(`${s.padEnd(9)} ${String(n).padStart(3)}   ${(t10 * 1e5).toFixed(2).padStart(8)}e-5  ${(nf * 1e5).toFixed(2).padStart(6)}e-5  ` +
    `${(w * 1e5).toFixed(2).padStart(8)}e-5  ${(q4 * 1e5).toFixed(2).padStart(10)}e-5   ` +
    (t10 < -nf ? 'better' : t10 > nf ? 'WORSE BEYOND NOISE' : 'inside noise'))
}
console.log('\n(negative = tilt better. Cup is the series that matters most and the one the')
console.log(' reconstruction reproduces best — 5/5 favourite match vs 0/3 O\'Reilly.)')

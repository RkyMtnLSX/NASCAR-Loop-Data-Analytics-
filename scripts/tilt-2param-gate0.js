// scripts/tilt-2param-gate0.js — GATE 0 of the registration pushed as 7065fe3.
//
//   node scripts/tilt-2param-gate0.js
//
// Runs FIRST and can stop the test. Splits TRAIN 2022-2024 by year into two halves and measures
// the flat fixed engine's per-tier gap (pred - actual) in each independently.
//
//   PASS if Q1 and Q4 gaps carry the SAME SIGN in both halves and |gap| >= 0.5 in both.
//   FAIL -> the form choice (pinning Q2/Q3) was holdout leakage and the line closes.
//
// Registered stopping condition: if Q2 turns out just as stable as Q1/Q4 inside train, pinning it
// was an artifact of one holdout sample and the registration is unjustified. Say so and stop.
//
// The train file is NOT ordered by date - that mistake was made and corrected earlier today. Year
// is carried explicitly from the race id prefix, never inferred from row order.

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
const num = s => (s === '' || s == null ? null : Number(s))

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

const raw = fs.readFileSync(path.join(__dirname, 'backtest-data', 'train.txt'), 'utf8')
  .split('\n').filter(l => l.trim())

// Year is carried explicitly. Probe how it is encoded rather than assuming.
function yearOf(head) {
  const m = head.join('|').match(/\b(20\d\d)\b/)
  return m ? Number(m[1]) : null
}

const halves = { 'A 2022-23': [], 'B 2024': [] }
let unyeared = 0
for (const line of raw) {
  const [head, body] = line.split('#')
  if (!body) continue
  const parts = head.split('|')
  const y = yearOf(parts)
  if (y == null) { unyeared++; continue }
  ;(y <= 2023 ? halves['A 2022-23'] : halves['B 2024']).push(line)
}

if (unyeared > 0 && halves['A 2022-23'].length + halves['B 2024'].length < raw.length * 0.5) {
  console.log(`\nSTOP: cannot recover the year for ${unyeared} of ${raw.length} train rows.`)
  console.log('GATE 0 cannot be evaluated without an explicit year. Not guessing from row order —')
  console.log('that exact mistake was made and corrected earlier today. Test halted.')
  process.exit(2)
}

function measureHalf(lines) {
  const T = [0, 1, 2, 3].map(() => ({ pred: 0, obs: 0, n: 0 }))
  let races = 0
  for (const line of lines) {
    const [head, body] = line.split('#')
    const [series, track, grp, pDnf, pN, pCau] = head.split('|')
    const drivers = [], actualDnf = []
    for (const rec of body.split(';')) {
      const f = rec.split(',')
      if (f.length < 9) continue
      drivers.push({
        name: 'D' + drivers.length, startPos: num(f[0]),
        corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]), nCorrRaces: num(f[5]) || 0,
        trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]), nTrackRaces: num(f[8]) || 0,
        lrpTime: null, pitCrewTime: null, corrWinConv: null,
      })
      actualDnf.push(num(f[2]))
    }
    if (drivers.length < 15) continue
    const presets = getCautionPresets(series)
    const cau = num(pCau)
    const preset = cau == null ? presets[1] : isSuperspeedway(track) ? presets[1]
      : presets.reduce((a, b) => Math.abs(b.value - cau) < Math.abs(a.value - cau) ? b : a)
    const scored = buildSpeedScores(drivers, weightsFor(series, track))
    const rows = runRaceSim(scored, {
      numSims: SIMS, cautionPreset: preset,
      dnfRate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0),
      totalRaceLaps: 300, trackGroup: __trackGroup(track), startSampling: null,
    })
    const tiers = tiersOf(scored)
    for (const r of rows) {
      const b = T[tiers[r.simIdx]]
      b.pred += r.dnfPct / 100; b.obs += actualDnf[r.simIdx]; b.n++
    }
    races++
  }
  return { races, tier: T.map(b => ({ pred: b.pred / b.n * 100, obs: b.obs / b.n * 100, gap: (b.pred - b.obs) / b.n * 100 })) }
}

const LBL = ['Q1 weakest', 'Q2', 'Q3', 'Q4 strongest']
const A = measureHalf(halves['A 2022-23']), B = measureHalf(halves['B 2024'])
console.log(`GATE 0 — does per-tier gap replicate INSIDE train?  (${SIMS} sims)`)
console.log(`  half A 2022-23: ${A.races} races   |   half B 2024: ${B.races} races\n`)
console.log('tier            gap A     gap B    same sign?   both >=0.5?')
const res = {}
for (let t = 3; t >= 0; t--) {
  const ga = A.tier[t].gap, gb = B.tier[t].gap
  const same = (ga > 0) === (gb > 0)
  const big = Math.abs(ga) >= 0.5 && Math.abs(gb) >= 0.5
  res[t] = { ga, gb, same, big, stable: same && big }
  console.log(`${LBL[t].padEnd(15)} ${ga.toFixed(2).padStart(6)}   ${gb.toFixed(2).padStart(6)}     ` +
    `${(same ? 'yes' : 'NO').padEnd(11)}  ${big ? 'yes' : 'no'}`)
}
console.log('\n(gap = predicted - actual, in DNF percentage points. positive = model over-predicts)\n')

const q1 = res[0], q4 = res[3], q2 = res[1], q3 = res[2]
const gate0 = q1.stable && q4.stable
console.log(`GATE 0: Q1 ${q1.stable ? 'stable' : 'NOT stable'} · Q4 ${q4.stable ? 'stable' : 'NOT stable'}  =>  ${gate0 ? 'PASS' : 'FAIL'}`)
if (!gate0) {
  console.log('\nFAIL. Per the registration, the form choice was holdout leakage and the line closes.')
  process.exit(1)
}
const middleAlsoStable = q2.stable && q3.stable
console.log(`Registered stopping check — are the PINNED tiers just as stable?`)
console.log(`  Q2 ${q2.stable ? 'STABLE' : 'not stable'} · Q3 ${q3.stable ? 'STABLE' : 'not stable'}`)
if (middleAlsoStable) {
  console.log('\nSTOP CONDITION MET: Q2 and Q3 are as stable inside train as Q1/Q4.')
  console.log('Pinning them was an artifact of one holdout sample, so this registration is')
  console.log('unjustified as written. Halting rather than proceeding to step 2.')
  process.exit(3)
}
console.log('\n=> proceed to the fit and holdout.')
fs.writeFileSync(path.join(__dirname, 'backtest-data', 'tilt-2param-gate0.json'),
  JSON.stringify({ A: A.tier, B: B.tier, res }, null, 2) + '\n')

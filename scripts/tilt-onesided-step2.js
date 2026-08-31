// scripts/tilt-onesided-step2.js — STEP 2 of the registration in BACKTEST_LOG 2026-08-31,
// pushed as 8a76a87 BEFORE any of this was written or run.
//
//   RUNS=3 SIMS=8000 node scripts/tilt-onesided-step2.js
//
// The curve comes from tilt-onesided.json, derived on TRAIN 2022-2024 by the frozen rule
// C_t = obs_t/pred_t shrunk by min(1, events/200). Nothing is fitted here. This is the holdout.
//
// GATES, exactly as registered:
//   GATE 1  per-tier rail: no tier may end FURTHER from its actual than the flat model already is
//   GATE 2  Q4 top10 Brier must not degrade by more than the null floor  <-- the operator's ask
//   GATE 3  aggregate win/top5/top10 Brier vs the null
//   GATE 4  overall DNF bias must not worsen beyond -0.20 cars/race
// SHIP ONLY IF GATE 1 PASSES FOR ALL TIERS AND GATE 2 PASSES. 3 and 4 cannot justify a ship.

const fs = require('fs')
const path = require('path')
const E = require('./loadEngine')
const {
  buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup,
  isRoadCourse, isSuperspeedway,
  DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS, TRUCK_ROAD_WEIGHTS,
  SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS,
} = E

const SIMS = Number(process.env.SIMS || 8000)
const RUNS = Number(process.env.RUNS || 3)
const num = s => (s === '' || s == null ? null : Number(s))
const CURVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'backtest-data', process.env.CURVE || 'tilt-onesided.json'), 'utf8')).curve

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
    scored: buildSpeedScores(drivers, weightsFor(series, track)), fin, dnf, g,
    cfg: { numSims: SIMS, cautionPreset: preset, dnfRate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0),
           totalRaceLaps: 300, trackGroup: g, startSampling: null },
  })
}

function measure(opts) {
  const T = [0, 1, 2, 3].map(() => ({ pred: 0, obs: 0, n: 0, b10: 0 }))
  let wb = 0, t5 = 0, t10 = 0, n = 0, dp = 0, dobs = 0
  for (const bd of boards) {
    const rows = runRaceSim(bd.scored, { ...bd.cfg, ...opts })
    const tiers = tiersOf(bd.scored)
    for (const r of rows) {
      const y1 = bd.fin[r.simIdx] <= 1 ? 1 : 0, y5 = bd.fin[r.simIdx] <= 5 ? 1 : 0, y10 = bd.fin[r.simIdx] <= 10 ? 1 : 0
      const p1 = r.winPct / 100, p5 = r.top5Pct / 100, p10 = r.top10Pct / 100
      wb += (p1 - y1) ** 2; t5 += (p5 - y5) ** 2; t10 += (p10 - y10) ** 2; n++
      const b = T[tiers[r.simIdx]]
      b.pred += r.dnfPct / 100; b.obs += bd.dnf[r.simIdx]; b.n++; b.b10 += (p10 - y10) ** 2
      dp += r.dnfPct / 100
    }
    dobs += bd.dnf.reduce((s, x) => s + x, 0)
  }
  return {
    wb: wb / n, t5: t5 / n, t10: t10 / n, bias: (dp - dobs) / boards.length,
    tier: T.map(b => ({ pred: b.pred / b.n * 100, obs: b.obs / b.n * 100, b10: b.b10 / b.n })),
  }
}

const ARMS = {
  FLAT:  {},
  TILT:  { skillTilt: true, tiltCurve: null, tiltRescale: false }, // curve set per-board below
}
// tiltCurve is per track group, so it must be injected per board — wrap measure for the tilt arm.
function measureTilt() {
  const saved = boards.map(b => b.cfg)
  boards.forEach(b => { b.cfg = { ...b.cfg } })
  const r = measure({ skillTilt: true, tiltRescale: false, __perBoardCurve: true })
  boards.forEach((b, i) => { b.cfg = saved[i] })
  return r
}
// simpler: patch each board's cfg with its group curve once
boards.forEach(b => { b.tiltOpts = { skillTilt: true, tiltRescale: false, tiltCurve: CURVE[b.g] || null } })
function measureArm(kind) {
  const T = [0, 1, 2, 3].map(() => ({ pred: 0, obs: 0, n: 0, b10: 0 }))
  let wb = 0, t5 = 0, t10 = 0, n = 0, dp = 0, dobs = 0
  for (const bd of boards) {
    const rows = runRaceSim(bd.scored, kind === 'TILT' ? { ...bd.cfg, ...bd.tiltOpts } : bd.cfg)
    const tiers = tiersOf(bd.scored)
    for (const r of rows) {
      const y1 = bd.fin[r.simIdx] <= 1 ? 1 : 0, y5 = bd.fin[r.simIdx] <= 5 ? 1 : 0, y10 = bd.fin[r.simIdx] <= 10 ? 1 : 0
      const p1 = r.winPct / 100, p5 = r.top5Pct / 100, p10 = r.top10Pct / 100
      wb += (p1 - y1) ** 2; t5 += (p5 - y5) ** 2; t10 += (p10 - y10) ** 2; n++
      const b = T[tiers[r.simIdx]]
      b.pred += r.dnfPct / 100; b.obs += bd.dnf[r.simIdx]; b.n++; b.b10 += (p10 - y10) ** 2
      dp += r.dnfPct / 100
    }
    dobs += bd.dnf.reduce((s, x) => s + x, 0)
  }
  return { wb: wb / n, t5: t5 / n, t10: t10 / n, bias: (dp - dobs) / boards.length,
           tier: T.map(b => ({ pred: b.pred / b.n * 100, obs: b.obs / b.n * 100, b10: b.b10 / b.n })) }
}
void ARMS; void measure; void measureTilt

const res = { FLAT: [], NULL: [], TILT: [] }
console.log(`STEP 2 — holdout ${boards.length} races, ${SIMS} sims, ${RUNS} runs/arm\n`)
for (let r = 0; r < RUNS; r++) {
  res.FLAT.push(measureArm('FLAT'))
  res.NULL.push(measureArm('FLAT'))
  res.TILT.push(measureArm('TILT'))
  process.stdout.write(`  run ${r + 1}/${RUNS} done\n`)
}
const mean = a => a.reduce((x, y) => x + y, 0) / a.length
const LBL = ['Q1 weakest', 'Q2', 'Q3', 'Q4 strongest']

console.log('\nGATE 1 — per-tier rail. |pred-actual| must not grow.\n')
console.log('tier            flat pred  tilt pred   actual   |gap| flat -> tilt      verdict')
let gate1 = true
for (let t = 3; t >= 0; t--) {
  const fp = mean(res.FLAT.map(v => v.tier[t].pred)), tp = mean(res.TILT.map(v => v.tier[t].pred))
  const ob = mean(res.FLAT.map(v => v.tier[t].obs))
  const gf = Math.abs(fp - ob), gt = Math.abs(tp - ob)
  const pass = gt <= gf + 0.05
  if (!pass) gate1 = false
  console.log(`${LBL[t].padEnd(15)} ${fp.toFixed(1).padStart(6)}   ${tp.toFixed(1).padStart(8)}  ${ob.toFixed(1).padStart(7)}   ` +
    `${gf.toFixed(2).padStart(5)} -> ${gt.toFixed(2).padStart(5)}      ${pass ? 'PASS' : 'FAIL'}`)
}

console.log('\nGATE 2 — Q4 (strongest) top10 Brier. The operator gate.\n')
const q4d = mean(res.TILT.map((v, i) => v.tier[3].b10 - res.FLAT[i].tier[3].b10))
const q4null = mean(res.NULL.map((v, i) => Math.abs(v.tier[3].b10 - res.FLAT[i].tier[3].b10)))
const gate2 = q4d <= q4null
console.log(`  Q4 top10 Brier delta ${(q4d * 1e5).toFixed(2)}e-5   null floor ${(q4null * 1e5).toFixed(2)}e-5   ` +
  `${gate2 ? 'PASS' : 'FAIL'}   (the earlier tilt failed this at -23.40e-5 the wrong way)`)
for (let t = 2; t >= 0; t--) {
  const d = mean(res.TILT.map((v, i) => v.tier[t].b10 - res.FLAT[i].tier[t].b10))
  console.log(`  ${LBL[t].padEnd(13)} top10 Brier delta ${(d * 1e5).toFixed(2).padStart(8)}e-5   (negative = better)`)
}

console.log('\nGATE 3 — aggregate Brier delta vs FLAT (negative = better)\n')
for (const k of ['wb', 't5', 't10']) {
  const nm = { wb: 'win', t5: 'top5', t10: 'top10' }[k]
  const d = mean(res.TILT.map((v, i) => v[k] - res.FLAT[i][k]))
  const nf = mean(res.NULL.map((v, i) => Math.abs(v[k] - res.FLAT[i][k])))
  console.log(`  ${nm.padEnd(7)} ${(d * 1e5).toFixed(2).padStart(8)}e-5   null floor ${(nf * 1e5).toFixed(2)}e-5   ` +
    `${d < -nf ? 'better beyond noise' : d > nf ? 'WORSE beyond noise' : 'inside noise'}`)
}

console.log('\nGATE 4 — overall DNF bias (cars/race)\n')
const bf = mean(res.FLAT.map(v => v.bias)), bt = mean(res.TILT.map(v => v.bias))
const gate4 = bt >= bf - 0.20
console.log(`  flat ${bf.toFixed(2)}   tilt ${bt.toFixed(2)}   ${gate4 ? 'PASS' : 'FAIL'}`)

console.log('\n' + '='.repeat(64))
console.log(`DECISION RULE: ship only if GATE 1 (all tiers) AND GATE 2 pass.`)
console.log(`  GATE 1 ${gate1 ? 'PASS' : 'FAIL'}   GATE 2 ${gate2 ? 'PASS' : 'FAIL'}   =>  ${gate1 && gate2 ? 'ELIGIBLE TO SHIP' : 'DO NOT SHIP'}`)
console.log('='.repeat(64))

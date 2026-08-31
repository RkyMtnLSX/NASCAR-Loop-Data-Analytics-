// scripts/tilt-onesided-step1.js — STEP 1 of the registration in BACKTEST_LOG 2026-08-31
// ("one-sided DNF tilt, re-tested on the FIXED engine"). Registered and pushed as 8a76a87
// BEFORE this was written.
//
//   node scripts/tilt-onesided-step1.js
//
// MEASUREMENT ONLY. No fitting, no decisions. Runs the FIXED engine flat on TRAIN 2022-2024 and
// records predicted vs actual DNF% per speedScore quartile per track group. That table determines
// the shape of C_t; it is not chosen.
//
// The old (stale-substrate) table this replaces:
//   Q4 12.8 -> 12.3 actual | Q3 14.1 -> 15.2 | Q2 14.9 -> 16.8 | Q1 15.8 -> 20.4
// Recorded prediction: the cliff fix should raise all four predictions ~1.4pts, so Q4 may now
// OVER-predict. If the table comes back looking like the old one, that is evidence against the
// whole idea and the registration says to record it as such.

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
const num = s => (s === '' || s == null ? null : Number(s))

function weightsFor(series, track) {
  if (isRoadCourse(track)) return series === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(track)) return series === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (series === 'trucks' && __trackGroup(track) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}

// tier 3 = Q4 strongest ... tier 0 = Q1 weakest, by speedScore rank within the driver's own field
function tiersOf(scored) {
  const order = scored.map((d, i) => ({ i, s: d.speedScore == null ? 0 : d.speedScore }))
    .sort((a, b) => b.s - a.s)
  const t = new Array(scored.length)
  order.forEach((o, r) => { t[o.i] = 3 - Math.min(3, Math.floor(r / (order.length / 4))) })
  return t
}

const lines = fs.readFileSync(path.join(__dirname, 'backtest-data', 'train.txt'), 'utf8')
  .split('\n').filter(l => l.trim())

const GROUPS = ['SHORT', 'INT', 'SS', 'ROAD']
const acc = {}
for (const g of [...GROUPS, 'ALL']) acc[g] = [0, 1, 2, 3].map(() => ({ pred: 0, obs: 0, n: 0 }))

let races = 0, skipped = 0
for (const line of lines) {
  const [head, body] = line.split('#')
  if (!body) { skipped++; continue }
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
  if (drivers.length < 15) { skipped++; continue }

  const presets = getCautionPresets(series)
  const cau = num(pCau)
  const preset = cau == null ? presets[1]
    : isSuperspeedway(track) ? presets[1]
    : presets.reduce((a, b) => Math.abs(b.value - cau) < Math.abs(a.value - cau) ? b : a)

  const g = __trackGroup(track)
  const scored = buildSpeedScores(drivers, weightsFor(series, track))
  const rows = runRaceSim(scored, {
    numSims: SIMS, cautionPreset: preset,
    dnfRate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0),
    totalRaceLaps: 300, trackGroup: g, startSampling: null,
  })

  const tiers = tiersOf(scored)
  for (const r of rows) {
    const t = tiers[r.simIdx]
    for (const key of [g, 'ALL']) {
      acc[key][t].pred += r.dnfPct / 100
      acc[key][t].obs += actualDnf[r.simIdx]
      acc[key][t].n++
    }
  }
  races++
}

const LBL = ['Q1 weakest', 'Q2', 'Q3', 'Q4 strongest']
console.log(`STEP 1 — FLAT fixed engine on TRAIN 2022-2024: ${races} races (${skipped} skipped), ${SIMS} sims\n`)
console.log('group  tier           pred%   actual%    gap      obs events')
const out = {}
for (const g of [...GROUPS, 'ALL']) {
  out[g] = []
  for (let t = 3; t >= 0; t--) {
    const b = acc[g][t]
    if (!b.n) { out[g][t] = null; continue }
    const pred = b.pred / b.n * 100, obs = b.obs / b.n * 100
    out[g][t] = { pred, obs, events: b.obs, n: b.n, C: obs / pred }
    console.log(`${g.padEnd(6)} ${LBL[t].padEnd(13)} ${pred.toFixed(1).padStart(6)}  ${obs.toFixed(1).padStart(7)}  ` +
      `${(obs - pred >= 0 ? '+' : '') + (obs - pred).toFixed(1).padStart(5)}   ${Math.round(b.obs)}`)
  }
  console.log('')
}

// Derived per the FROZEN rule: C_t = obs_t/pred_t, shrunk toward 1 by min(1, events/200).
console.log('DERIVED C_t (frozen rule: obs/pred, shrunk by min(1, events/200)) — TRAIN ONLY')
console.log('order is [Q4 strongest .. Q1 weakest], matching __TILT_ANCHOR\n')
const curve = {}
for (const g of GROUPS) {
  const row = []
  for (let t = 3; t >= 0; t--) {
    const c = out[g][t]
    if (!c) { row.push(1); continue }
    const sh = Math.min(1, c.events / 200)
    row.push(+(1 + (c.C - 1) * sh).toFixed(4))
  }
  curve[g] = row
  console.log(`  ${g.padEnd(6)} [${row.map(x => x.toFixed(4)).join(', ')}]`)
}
fs.writeFileSync(path.join(__dirname, 'backtest-data', 'tilt-onesided.json'),
  JSON.stringify({ curve, table: out }, null, 2) + '\n')
console.log('\nwritten to scripts/backtest-data/tilt-onesided.json')

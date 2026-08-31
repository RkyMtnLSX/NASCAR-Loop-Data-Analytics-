// scripts/fit-dnf-tilt.js — fits the skill-tilted DNF allocation on TRAIN 2022-2024 ONLY.
//
//   node scripts/fit-dnf-tilt.js
//
// Registered in BACKTEST_LOG 2026-08-31 before this was written. The frozen form is
//
//     mult_i = exp(beta * (0.5 - p_i)),   rescaled so mean(mult) = 1 over the field
//
// with p_i the driver's speedScore percentile in the field. Rescaling to mean 1 means the
// FIELD-WIDE BUDGET IS UNCHANGED and only its allocation moves — deliberate, because the
// attrition sweep showed forecast quality is sensitive to the total.
//
// beta is fitted per track group per layer (accident / mechanical) by logistic regression of
// the binary outcome on (0.5 - p_i), by IRLS. Fitted against ATTRITION DATA ONLY. The holdout
// forecast metric is not in this objective anywhere.
//
// Output is a JS literal to paste into simEngine.js, plus the fit diagnostics.

const fs = require('fs')
const path = require('path')
const E = require('./loadEngine')
const {
  buildSpeedScores, __trackGroup, isRoadCourse, isSuperspeedway,
  DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS, TRUCK_ROAD_WEIGHTS,
  SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS,
} = E

const num = s => (s === '' || s == null ? null : Number(s))
function weightsFor(series, track) {
  if (isRoadCourse(track)) return series === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(track)) return series === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (series === 'trucks' && __trackGroup(track) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}

// IRLS for a BINOMIAL GLM WITH A LOG LINK: log(p) = a + b*x, i.e. a RELATIVE-RISK model.
//
// THIS IS THE FIX (2026-08-31). The first cut used a LOGIT link — a slope on log-ODDS — and
// then applied the result at runtime as a multiplier on PROBABILITY. Those two agree while p
// is small and separate as p grows, so the strongest quartile got over-extended: fitted tilt
// produced a 2.1x Q1/Q4 spread against a realized 1.66x, dragging the best drivers' DNF rate
// to 9.5% against a 12.3% actual, and their top10 Brier got WORSE. See the tier table in
// BACKTEST_LOG 2026-08-31.
//
// The sim's tilt is multiplicative on probability. So fit it on the log-PROBABILITY scale.
// The parameterization, the runtime code and the frozen mean-1 rescaling are all unchanged —
// only the scale the slope is estimated on. mu = exp(eta), var = mu(1-mu), dmu/deta = mu,
// so the IRLS weight is mu/(1-mu) and the working response is eta + (y-mu)/mu.
function logLink(xs, ys) {
  const n = xs.length
  const base = Math.max(1e-4, ys.reduce((s, y) => s + y, 0) / n)
  let a = Math.log(base), b = 0
  for (let iter = 0; iter < 200; iter++) {
    let s00 = 0, s01 = 0, s11 = 0, t0 = 0, t1 = 0
    for (let i = 0; i < n; i++) {
      const eta = Math.min(-1e-6, a + b * xs[i])
      const mu = Math.exp(eta)
      const w = mu / (1 - mu)
      const z = eta + (ys[i] - mu) / mu
      s00 += w; s01 += w * xs[i]; s11 += w * xs[i] * xs[i]
      t0 += w * z; t1 += w * xs[i] * z
    }
    const det = s00 * s11 - s01 * s01
    if (!isFinite(det) || Math.abs(det) < 1e-14) break
    const na = (s11 * t0 - s01 * t1) / det
    const nb = (s00 * t1 - s01 * t0) / det
    const d = Math.abs(na - a) + Math.abs(nb - b)
    // damped step: the log link has no upper guard, so a full Newton step can leave the space
    a = a + 0.6 * (na - a); b = b + 0.6 * (nb - b)
    if (d < 1e-10) break
  }
  let s00 = 0, s01 = 0, s11 = 0
  for (let i = 0; i < n; i++) {
    const mu = Math.exp(Math.min(-1e-6, a + b * xs[i]))
    const w = mu / (1 - mu)
    s00 += w; s01 += w * xs[i]; s11 += w * xs[i] * xs[i]
  }
  const det = s00 * s11 - s01 * s01
  return { a, b, seB: Math.sqrt(det > 0 ? s00 / det : NaN), n, events: ys.reduce((s, y) => s + y, 0) }
}

const lines = fs.readFileSync(path.join(__dirname, 'backtest-data', 'train.txt'), 'utf8')
  .split('\n').filter(l => l.trim())

const data = {} // group -> { acc: {x,y}, mech: {x,y} }
for (const g of ['SHORT', 'INT', 'SS', 'ROAD']) data[g] = { acc: { x: [], y: [] }, mech: { x: [], y: [] } }

let races = 0
for (const line of lines) {
  const [head, body] = line.split('#')
  if (!body) continue
  const [series, track] = head.split('|')
  const drivers = [], acc = [], mech = []
  for (const rec of body.split(';')) {
    const f = rec.split(',')
    if (f.length < 11) continue
    drivers.push({
      name: 'D' + drivers.length, startPos: num(f[0]),
      corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]), nCorrRaces: num(f[5]) || 0,
      trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]), nTrackRaces: num(f[8]) || 0,
      lrpTime: null, pitCrewTime: null, corrWinConv: null,
    })
    acc.push(num(f[9])); mech.push(num(f[10]))
  }
  if (drivers.length < 15) continue
  const scored = buildSpeedScores(drivers, weightsFor(series, track))
  const order = scored.map((d, i) => ({ i, s: d.speedScore == null ? 0 : d.speedScore }))
    .sort((a, b) => b.s - a.s)
  const pct = new Array(scored.length)
  order.forEach((o, r) => { pct[o.i] = order.length > 1 ? 1 - r / (order.length - 1) : 0.5 })
  const g = __trackGroup(track)
  for (let i = 0; i < scored.length; i++) {
    const x = 0.5 - pct[i]
    data[g].acc.x.push(x); data[g].acc.y.push(acc[i])
    data[g].mech.x.push(x); data[g].mech.y.push(mech[i])
  }
  races++
}

console.log(`TRAIN fit (LOG link — relative risk) — ${races} races, 2022-2024 only\n`)
console.log('group  layer        beta      se     beta/se   n      events   Q1/Q4 implied mult')
const out = { acc: {}, mech: {} }
for (const g of ['SHORT', 'INT', 'SS', 'ROAD']) {
  for (const layer of ['acc', 'mech']) {
    const f = logLink(data[g][layer].x, data[g][layer].y)
    // Shrink toward zero when the slope is not resolved. A tilt we cannot measure should
    // not be applied: this is the same shrinkage principle resolveDnfRate already uses on
    // thin track history, and it makes SS-accident fall back toward flat if its sign is noise.
    const t = f.b / f.seB
    const shrunk = f.b * Math.min(1, Math.max(0, (Math.abs(t) - 1) / 1.5))
    out[layer][g] = +shrunk.toFixed(3)
    const ratio = Math.exp(shrunk * (0.5 - 0.875)) / Math.exp(shrunk * (0.5 - 0.125))
    console.log(
      `${g.padEnd(6)} ${layer.padEnd(12)} ${f.b.toFixed(3).padStart(6)} ${f.seB.toFixed(3).padStart(7)} ` +
      `${t.toFixed(2).padStart(8)}  ${String(f.n).padStart(5)}  ${String(f.events).padStart(6)}   ` +
      `shrunk ${shrunk.toFixed(3)} -> Q4 is ${ratio.toFixed(2)}x Q1`)
  }
}
console.log('\nFROZEN CONSTANTS (paste into simEngine.js):')
console.log('const DNF_TILT_ACC  = ' + JSON.stringify(out.acc))
console.log('const DNF_TILT_MECH = ' + JSON.stringify(out.mech))
fs.writeFileSync(path.join(__dirname, 'backtest-data', 'tilt-fit.json'), JSON.stringify(out, null, 2) + '\n')

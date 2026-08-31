// scripts/calibrate-tilt-tiers.js — TRAIN-ONLY calibration of the DNF tilt curve (v3).
//
//   node scripts/calibrate-tilt-tiers.js
//
// Iterative proportional fitting. Start flat, run the sim on train boards, compare DELIVERED
// DNF rate per field quartile against OBSERVED, multiply the curve by obs/delivered, repeat.
// Converges onto the observed profile without assuming a functional shape — which is what
// killed v1 (wrong scale) and v2 (wrong shape; see simEngine.js).
//
// Calibrating on DELIVERED, not on the raw data, is deliberate: the sim already back-loads
// attrition ~1.22x through the wreck loop's field-edge clamp. IPF absorbs that rather than
// stacking a second tilt on top of it.
//
// Thin groups are shrunk toward the pooled curve by sqrt(n), so superspeedway — which has the
// fewest driver-races and the fewest events per cell — cannot invent a steep curve from noise.
const fs = require('fs'), path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup,
  isRoadCourse, isSuperspeedway, DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS,
  TRUCK_ROAD_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } = E
const SIMS = Number(process.env.SIMS || 6000)
const num = s => (s === '' || s == null ? null : Number(s))
const GROUPS = ['SHORT', 'INT', 'SS', 'ROAD']
function wf(se, tr) {
  if (isRoadCourse(tr)) return se === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(tr)) return se === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (se === 'trucks' && __trackGroup(tr) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
function load(file) {
  const out = []
  for (const line of fs.readFileSync(path.join(__dirname, 'backtest-data', file), 'utf8').split('\n').filter(l => l.trim())) {
    const [h, b] = line.split('#'); if (!b) continue
    const [series, track, grp, pDnf, pN, pCau] = h.split('|')
    const dr = [], dnf = [], fin = []; let i = 0
    for (const rec of b.split(';')) {
      const f = rec.split(','); if (f.length < 9) continue
      dr.push({ name: 'D' + i, startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]),
        nCorrRaces: num(f[5]) || 0, trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]),
        nTrackRaces: num(f[8]) || 0, lrpTime: null, pitCrewTime: null, corrWinConv: null })
      dnf.push(num(f[2])); fin.push(num(f[1])); i++
    }
    if (dr.length < 15) continue
    const P = getCautionPresets(series), cau = num(pCau)
    const sc = buildSpeedScores(dr, wf(series, track))
    const ord = sc.map((d, ix) => ({ ix, s: d.speedScore || 0 })).sort((a, x) => x.s - a.s)
    const tier = new Array(sc.length)
    ord.forEach((o, r) => { tier[o.ix] = Math.min(3, Math.floor(r * 4 / sc.length)) })
    out.push({ sc, dnf, fin, tier, g: __trackGroup(track),
      rate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0),
      preset: cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2]
        : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a) })
  }
  return out
}
const boards = load('train.txt')

// observed tier rates per group, and the pooled profile
const obs = {}, cnt = {}
for (const g of GROUPS) { obs[g] = [0, 0, 0, 0]; cnt[g] = [0, 0, 0, 0] }
for (const b of boards) for (let i = 0; i < b.sc.length; i++) { obs[b.g][b.tier[i]] += b.dnf[i]; cnt[b.g][b.tier[i]]++ }
const obsRate = {}, nG = {}
for (const g of GROUPS) { obsRate[g] = obs[g].map((s, i) => s / cnt[g][i]); nG[g] = cnt[g].reduce((a, x) => a + x, 0) }

function deliver(curves) {
  const d = {}, c = {}
  for (const g of GROUPS) { d[g] = [0, 0, 0, 0]; c[g] = [0, 0, 0, 0] }
  for (const b of boards) {
    const rows = runRaceSim(b.sc, { numSims: SIMS, cautionPreset: b.preset, dnfRate: b.rate,
      totalRaceLaps: 300, trackGroup: b.g, startSampling: null,
      skillTilt: !!curves, tiltCurve: curves ? curves[b.g] : null })
    for (const r of rows) { d[b.g][b.tier[r.simIdx]] += r.dnfPct / 100; c[b.g][b.tier[r.simIdx]]++ }
  }
  const out = {}
  for (const g of GROUPS) out[g] = d[g].map((s, i) => s / c[g][i])
  return out
}
const norm = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return a.map(x => x / m) }

console.log('TRAIN ' + boards.length + ' races.  OBSERVED DNF% by tier (Q4 strongest -> Q1 weakest)')
for (const g of GROUPS) console.log('  ' + g.padEnd(6) + obsRate[g].map(v => (v * 100).toFixed(1).padStart(6)).join('') + '     n=' + nG[g])
const flat = deliver(null)
console.log('\nDELIVERED with tilt OFF (the accidental back-loading already in the sim)')
for (const g of GROUPS) console.log('  ' + g.padEnd(6) + flat[g].map(v => (v * 100).toFixed(1).padStart(6)).join(''))

let curves = {}; for (const g of GROUPS) curves[g] = [1, 1, 1, 1]
for (let it = 1; it <= 6; it++) {
  const del = deliver(curves)
  for (const g of GROUPS) {
    const raw = curves[g].map((c, i) => c * (obsRate[g][i] / Math.max(1e-4, del[g][i])))
    curves[g] = norm(raw)
  }
  // shrink thin groups toward the pooled curve
  const pooled = norm([0, 1, 2, 3].map(i => GROUPS.reduce((s, g) => s + curves[g][i] * nG[g], 0) / GROUPS.reduce((s, g) => s + nG[g], 0)))
  for (const g of GROUPS) {
    const lam = Math.min(1, Math.sqrt(nG[g] / 3000))
    curves[g] = norm(curves[g].map((c, i) => lam * c + (1 - lam) * pooled[i]))
  }
  const err = GROUPS.map(g => Math.max(...del[g].map((v, i) => Math.abs(v - obsRate[g][i]))))
  console.log(`\niter ${it}  max tier error by group: ` + GROUPS.map((g, i) => g + ' ' + (err[i] * 100).toFixed(2)).join('  '))
}
const fin = deliver(curves)
console.log('\nFINAL delivered vs observed (DNF%, Q4 -> Q1)')
for (const g of GROUPS) {
  console.log('  ' + g.padEnd(6) + 'sim ' + fin[g].map(v => (v * 100).toFixed(1).padStart(6)).join('') +
    '   obs ' + obsRate[g].map(v => (v * 100).toFixed(1).padStart(6)).join('') +
    '   max err ' + (Math.max(...fin[g].map((v, i) => Math.abs(v - obsRate[g][i]))) * 100).toFixed(2))
}
console.log('\nconst DNF_TILT_CURVE = {')
for (const g of GROUPS) console.log(`  ${g}: [${curves[g].map(v => v.toFixed(4)).join(', ')}],`)
console.log('}')
fs.writeFileSync(path.join(__dirname, 'backtest-data', 'tilt-curve.json'), JSON.stringify(curves, null, 2) + '\n')

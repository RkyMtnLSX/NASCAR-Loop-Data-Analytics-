// scripts/backtest-start-v4.js — the pre-registered start-projection v4 harness
// (BACKTEST_LOG 2026-09-03, "START PROJECTION v4"). Read the registration first.
//
//   SIMS=4000 node scripts/backtest-start-v4.js          # fit on 2025, then holdout 2026
//   PHASE=train ...                                       # fit + train reference only
//
// Data: scripts/backtest-data/start-v4-cup-2025-26.txt (loop_data, leak-free trailing pctiles
// computed with production's trail10 rules; last-race finish pctile; Jayski order pctile where
// draw_order exists). M2/M3 use the committed reconstruction (holdout.txt) matched by fingerprint.

const fs = require('fs')
const path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS,
  ROAD_COURSE_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, __trackGroup, isSuperspeedway, isRoadCourse } = E
const SIMS = Number(process.env.SIMS || 4000)
const PHASE = process.env.PHASE || 'all'
const SERIES = process.env.SERIES || 'cup'   // 2026-09-05: 'oreilly' runs the registered O'Reilly extension on its own data/fit
const D = p => path.join(__dirname, 'backtest-data', p)
const num = s => (s === '' || s == null ? null : Number(s))
function seedRandom(seed) { let a = seed >>> 0; Math.random = function () { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

// ---- study rows
const races = []
for (const l of fs.readFileSync(D(`start-v4-${SERIES}-2025-26.txt`), 'utf8').split('\n')) {
  if (!l.trim() || l.startsWith('#')) continue
  const [h, b] = l.split('#'); const [id, yr, rn, grp, track, date] = h.split('|')
  const rows = b.split(';').map(r => { const f = r.split(','); return { st: +f[0], fi: +f[1], tr: num(f[2]), lfp: num(f[3]), ord: num(f[4]) } })
  races.push({ id, yr: +yr, rn: +rn, grp, track, date, rows, fp: rows.map(r => r.st + ':' + r.fi).sort().join('|') })
}
const train = races.filter(r => r.yr === 2025), hold = races.filter(r => r.yr === 2026)

// ---- projection arms. pctile: 0 = pole. Re-ranked 1..K among eligible drivers (trail10-v2.1).
function project(r, arm, beta) {
  const b = arm === 'CONTROL' ? 0 : (beta[r.grp] || 0)
  return r.rows.map(d => {
    if (d.tr == null) return null
    // ARM O: Jayski order pctile runs first=0 .. last=1 and LATER is better, so it enters as 1-ord
    // (the first holdout run used d.ord directly — sign flipped; corrected 2026-09-03, logged).
    const x = arm === 'O' ? (d.ord == null ? null : 1 - d.ord) : d.lfp
    return d.tr + (x == null ? 0 : b * (x - 0.5))
  })
}
function rankOf(vals) { const idx = vals.map((v, i) => i).filter(i => vals[i] != null).sort((a, b) => vals[a] - vals[b]); const rk = new Array(vals.length).fill(null); idx.forEach((i, k) => { rk[i] = k + 1 }); return rk }
function m1(r, arm, beta) {
  const proj = project(r, arm, beta); const elig = r.rows.map((d, i) => proj[i] != null)
  const pr = rankOf(proj); const ar = rankOf(r.rows.map((d, i) => elig[i] ? d.st : null))
  let s = 0, n = 0; r.rows.forEach((d, i) => { if (elig[i]) { s += Math.abs(pr[i] - ar[i]); n++ } })
  return n ? s / n : null
}
function fitBeta(tr) {
  const beta = { INT: 0, SHORT: 0, SS: 0, ROAD: 0 }
  for (const g of ['INT', 'SHORT', 'SS']) {
    let sxy = 0, sxx = 0, n = 0
    for (const r of tr) if (r.grp === g) for (const d of r.rows) if (d.tr != null && d.lfp != null) { const x = d.lfp - 0.5, y = d.st != null ? ((d.st - 1) / (r.rows.length - 1)) - d.tr : null; if (y == null) continue; sxy += x * y; sxx += x * x; n++ }
    beta[g] = sxx ? +(sxy / sxx).toFixed(4) : 0
  }
  return beta
}
function reportM1(label, set, beta, arms) {
  console.log(`\n--- M1 rank-vs-rank start MAE, ${label} (${set.length} races) ---`)
  for (const g of ['INT', 'SHORT', 'SS', 'ROAD', 'ALL']) {
    const rs = set.filter(r => g === 'ALL' || r.grp === g); if (!rs.length) continue
    const line = [`${g.padEnd(5)} n=${String(rs.length).padStart(2)}`]
    const ctl = rs.map(r => m1(r, 'CONTROL', beta))
    for (const arm of arms) {
      const v = rs.map(r => m1(r, arm, beta))
      const mean = a => a.reduce((s, x) => s + x, 0) / a.length
      let better = 0, live = 0; v.forEach((x, i) => { if (Math.abs(x - ctl[i]) > 1e-9) live++; if (x < ctl[i] - 1e-9) better++ })
      line.push(`${arm} ${mean(v).toFixed(2)}${arm !== 'CONTROL' ? ` (d ${(mean(v) - mean(ctl)).toFixed(2)}, better ${better}/${rs.length}, live ${better}/${live})` : ''}`)
    }
    console.log('  ' + line.join('   '))
  }
}

// ---- M2/M3: the sim with projected grids (reconstruction boards, fingerprint-matched)
function weightsFor(track) { if (isRoadCourse(track)) return ROAD_COURSE_WEIGHTS; if (isSuperspeedway(track)) return SERIES === 'oreilly' ? E.ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS; return DEFAULT_WEIGHTS }
function loadBoards() {
  const out = []
  for (const line of fs.readFileSync(D('holdout.txt'), 'utf8').split('\n')) {
    if (!line.trim()) continue
    const [h, b] = line.split('#'); if (!b) continue
    const [series, track, grp, pDnf, pN, pCau] = h.split('|'); if (series !== SERIES) continue
    const recs = b.split(';').map(r => r.split(',')).filter(f => f.length >= 9)
    const fp = recs.map(f => f[0] + ':' + f[1]).sort().join('|')
    const R = hold.find(r => r.fp === fp); if (!R) continue
    const byKey = Object.fromEntries(R.rows.map((d, i) => [d.st + ':' + d.fi, i]))
    const drivers = recs.map((f, i) => ({ name: 'D' + i, startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]), nCorrRaces: num(f[5]) || 0,
      trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]), nTrackRaces: num(f[8]) || 0, lrpTime: null, pitCrewTime: null, corrWinConv: null, __ri: byKey[f[0] + ':' + f[1]], __fin: num(f[1]) }))
    if (drivers.length < 15) continue
    const P = getCautionPresets(series), cau = num(pCau)
    const preset = cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2] : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a)
    out.push({ R, track, drivers, preset, dnfRate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0) })
  }
  return out
}
function simArm(boards, arm, beta, seed) {
  seedRandom(seed)
  let wb = 0, t5 = 0, t10 = 0, n = 0, favStated = 0, favHit = 0, k = 0
  for (const b of boards) {
    const proj = project(b.R, arm === 'NULL' ? 'CONTROL' : arm, beta); const pr = rankOf(proj)
    const dr = b.drivers.map(d => ({ ...d, startPos: d.__ri != null && pr[d.__ri] != null ? pr[d.__ri] : null }))
    const sc = buildSpeedScores(dr, weightsFor(b.track))
    const rows = runRaceSim(sc, { numSims: SIMS, cautionPreset: b.preset, dnfRate: b.dnfRate, totalRaceLaps: 300, trackGroup: __trackGroup(b.track), startSampling: null })
    let fav = null
    for (const r of rows) {
      const f = dr[r.simIdx].__fin; const cl = p => Math.max(1e-6, Math.min(1 - 1e-6, p))
      wb += (cl(r.winPct / 100) - (f === 1 ? 1 : 0)) ** 2; t5 += (cl(r.top5Pct / 100) - (f <= 5 ? 1 : 0)) ** 2; t10 += (cl(r.top10Pct / 100) - (f <= 10 ? 1 : 0)) ** 2; n++
      if (!fav || r.winPct > fav.winPct) fav = { winPct: r.winPct, fin: f }
    }
    favStated += fav.winPct; favHit += fav.fin === 1 ? 100 : 0; k++
  }
  return { arm, boards: k, win: wb / n, t5: t5 / n, t10: t10 / n, favGap: (favStated - favHit) / k }
}

// ======================================================================= run
console.log(`engine ${E.__engineSha}  SERIES=${SERIES}  SIMS=${SIMS}  PHASE=${PHASE}  train ${train.length} / holdout ${hold.length} races`)
const beta = fitBeta(train)
console.log('beta (TRAIN 2025, least squares of residual on last_fp-0.5):', JSON.stringify(beta))
fs.writeFileSync(D(SERIES === 'cup' ? 'start-v4-fit.json' : `start-v4-fit-${SERIES}.json`), JSON.stringify({ beta, fitOn: '2025 ' + SERIES, registered: '2026-09-03' }))
reportM1('TRAIN 2025 (in-sample)', train, beta, ['CONTROL', 'F'])
if (PHASE !== 'train') {
  reportM1('HOLDOUT 2026 (read once)', hold, beta, ['CONTROL', 'F'])
  const withOrd = hold.filter(r => r.rows.some(d => d.ord != null))
  reportM1('HOLDOUT 2026, races carrying the Jayski order (ARM O, report only)', withOrd, beta, ['CONTROL', 'F', 'O'])
  const boards = loadBoards()
  console.log(`\n--- M2/M3 sim rail on ${boards.length} matched holdout cup boards, projected grids as startPos ---`)
  for (const [arm, seed] of [['CONTROL', 1], ['NULL', 2], ['F', 1]]) { const r = simArm(boards, arm, beta, seed); console.log(`  ${arm.padEnd(8)} win ${r.win.toFixed(5)}  t5 ${r.t5.toFixed(4)}  t10 ${r.t10.toFixed(4)}  favGap ${r.favGap.toFixed(2)} pts`) }
}

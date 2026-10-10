// scripts/backtest-ringer.js — REGISTERED 2026-10-10 (BACKTEST_LOG "#54 RINGER SHAPE"). Cup regulars moonlighting in
// O'Reilly / trucks. Ringer flags (season identity: >= 10 cup starts that season and more cup starts than starts in this
// series) are joined by race_id + start:finish fingerprint from scripts/backtest-data/ringer-features.json.
//   STAGE=1 node scripts/backtest-ringer.js                      diagnostic: shipped engine, ringer vs matched non-ringer rows
//   STAGE=2 PHASE=fit  node scripts/backtest-ringer.js           grid (b, m) on train ringer rows -> ringer-fit.json
//   STAGE=2 PHASE=test RUNS=2 node scripts/backtest-ringer.js    holdout, frozen (b, m), control = shipped
// NOPRACTICE=1 nulls practice on the holdout (the practice-free lines); default uses practice where >= 50% covered.
const fs = require('fs'), path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup,
  isRoadCourse, isSuperspeedway, DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS,
  TRUCK_ROAD_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } = E
const SIMS = Number(process.env.SIMS || 10000), RUNS = Number(process.env.RUNS || 1)
const STAGE = process.env.STAGE || '1', PHASE = process.env.PHASE || 'fit'
const D = f => path.join(__dirname, 'backtest-data', f)
const RF = JSON.parse(fs.readFileSync(D('ringer-features.json'), 'utf8'))
const POOLS = JSON.parse(fs.readFileSync(D('dom-pools.json'), 'utf8'))
const num = s => (s === '' || s == null ? null : Number(s))
const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
function wf(se, tr) {
  if (isRoadCourse(tr)) return se === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(tr)) return se === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (se === 'trucks' && __trackGroup(tr) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
const shipped = b => ({ carDnf: b.series === 'trucks' ? { k: 32 } : null, ...((b.g === 'INT' || b.g === 'SHORT') && POOLS[b.series] && POOLS[b.series][b.g] ? { domBoot: POOLS[b.series][b.g] } : {}), lappedTraffic: b.series === 'oreilly' ? { series: 'oreilly', k: 1.5 } : null })
function load(file, tag, withPractice) {
  const boards = []
  fs.readFileSync(D(file), 'utf8').split('\n').forEach((line, li) => {
    if (!line.trim() || line.indexOf('#') === -1) return
    const [h, b] = line.split('#'); const hf = h.split('|'); const off = hf.length === 10 ? 1 : 0
    const [series, track, grp, pDnf, pN, pCau] = hf.slice(off)
    if (series === 'cup') return
    const rf = RF[tag + '|' + li]; if (!rf) return
    const ring = new Set(rf.ringers)
    const recs = b.split(';').map(r => r.split(',')).filter(f => f.length >= 9)
    const base = [], fin = []; let nP = 0, nR = 0
    recs.forEach((f, i) => {
      const v = withPractice ? num(f[9]) : null; if (v != null) nP++
      const key = Math.round(+f[0]) + ':' + Math.round(+f[1]); const isR = ring.has(key); if (isR) nR++
      base.push({ name: 'D' + i, startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]), nCorrRaces: num(f[5]) || 0, trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]), nTrackRaces: num(f[8]) || 0, lrpTime: v, pitCrewTime: null, corrWinConv: null, ringer: isR })
      fin.push(num(f[1]))
    })
    if (base.length < 15) return
    if (withPractice && nP < base.length * 0.5) return
    const P = getCautionPresets(series), cau = num(pCau), g = __trackGroup(track)
    boards.push({ series, track, g, base, fin, nR, w: wf(series, track), rate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0), asym: series !== 'cup' && (g === 'INT' || g === 'SHORT'),
      preset: cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2] : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a) })
  })
  return boards
}
const spearman = (a, b) => { const n = a.length; const rk = v => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(n); for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; const m = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = m; i = j + 1 } return r }; const ra = rk(a), rb = rk(b); const ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (ra[i] - ma) * (rb[i] - mb); sxx += (ra[i] - ma) ** 2; syy += (rb[i] - mb) ** 2 } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0 }
const tierOf = r => (r <= 2 ? '1-3' : r <= 7 ? '4-8' : r <= 14 ? '9-15' : '16+')
function run(b, ringer) {
  const sc = buildSpeedScores(b.base, b.w, { lapPenalty: true })
  const withP = sc.filter(d => d.lrpTime != null)
  if (withP.length) { const ord = withP.slice().sort((x, y) => x.lrpTime - y.lrpTime); ord.forEach((d, i) => { d.__spdPct = ord.length > 1 ? 1 - i / (ord.length - 1) : 0.5 }) }
  const rows = runRaceSim(sc, { numSims: SIMS, cautionPreset: b.preset, dnfRate: b.rate, totalRaceLaps: 300, trackGroup: b.g, startSampling: null, asymNoise: b.asym, carCeilFloor: true, ...shipped(b), ...(ringer ? { ringer } : {}) })
  const order = rows.slice().sort((x, y) => y.winPct - x.winPct)
  const rank = {}; order.forEach((r, i) => { rank[r.simIdx] = i })
  const out = []
  rows.forEach(r => { const i = r.simIdx, f = b.fin[i]; out.push({ ringer: !!b.base[i].ringer, tier: tierOf(rank[i]), win: r.winPct / 100, t5: r.top5Pct / 100, t10: r.top10Pct / 100, pf: r.projFinish, fin: f, w: f === 1 ? 1 : 0, f5: f <= 5 ? 1 : 0, f10: f <= 10 ? 1 : 0 }) })
  // board-level
  const fav = order[0]; const favGap = fav.winPct - (b.fin[fav.simIdx] === 1 ? 100 : 0)
  return { out, rho: spearman(rows.map(r => r.projFinish), rows.map(r => b.fin[r.simIdx])), favGap, favHit: b.fin[fav.simIdx] === 1 ? 1 : 0 }
}
const brier = (rows, k, a) => mean(rows.map(r => (r[k] - r[a]) ** 2))
function summarise(res) {
  const all = res.flatMap(r => r.out), ring = all.filter(r => r.ringer), non = all.filter(r => !r.ringer)
  const line = (lab, rs) => rs.length ? `${lab.padEnd(18)} n ${String(rs.length).padStart(4)}  win ${(100 * mean(rs.map(r => r.win))).toFixed(1)}/${(100 * mean(rs.map(r => r.w))).toFixed(1)}  t5 ${(100 * mean(rs.map(r => r.t5))).toFixed(1)}/${(100 * mean(rs.map(r => r.f5))).toFixed(1)}  t10 ${(100 * mean(rs.map(r => r.t10))).toFixed(1)}/${(100 * mean(rs.map(r => r.f10))).toFixed(1)}  fin ${mean(rs.map(r => r.pf)).toFixed(1)}/${mean(rs.map(r => r.fin)).toFixed(1)}  B win ${brier(rs, 'win', 'w').toFixed(5)} t5 ${brier(rs, 't5', 'f5').toFixed(5)} t10 ${brier(rs, 't10', 'f10').toFixed(5)}` : `${lab} n 0`
  console.log(line('RINGERS all', ring)); console.log(line('non-ringers all', non))
  for (const t of ['1-3', '4-8', '9-15', '16+']) { console.log(line(`  ringer  ${t}`, ring.filter(r => r.tier === t))); console.log(line(`  non     ${t}`, non.filter(r => r.tier === t))) }
  return { n: ring.length, rWin: brier(ring, 'win', 'w'), rT5: brier(ring, 't5', 'f5'), rT10: brier(ring, 't10', 'f10'), aWin: brier(all, 'win', 'w'), aT10: brier(all, 't10', 'f10'), rho: mean(res.map(r => r.rho)), favGap: mean(res.map(r => r.favGap)), favHit: mean(res.map(r => r.favHit)),
    stated: { win: mean(ring.map(r => r.win)), t5: mean(ring.map(r => r.t5)), t10: mean(ring.map(r => r.t10)) }, real: { win: mean(ring.map(r => r.w)), t5: mean(ring.map(r => r.f5)), t10: mean(ring.map(r => r.f10)) } }
}
const withP = !process.env.NOPRACTICE
if (STAGE === '1') {
  for (const [file, tag, wp] of [['train.txt', 'train', false], ['holdout-practice.txt', 'test', false], ['holdout-practice.txt', 'test', true]]) {
    const boards = load(file, tag, wp)
    console.log(`\n== ${tag} ${file}${wp ? ' (with practice)' : ' (practice-free)'}: ${boards.length} boards, ${boards.reduce((s, b) => s + b.nR, 0)} ringer rows, ${SIMS} sims, engine ${E.__engineSha}`)
    summarise(boards.map(b => run(b, null)))
  }
} else if (PHASE === 'fit') {
  const boards = load('train.txt', 'train', false)
  console.log(`FIT on train.txt: ${boards.length} boards, ${boards.reduce((s, b) => s + b.nR, 0)} ringer rows, ${SIMS} sims`)
  const grid = []
  for (const b of [0, 2, 4, 6, 8]) for (const m of [0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
    const S = summarise.silent ? null : null
    const res = boards.map(x => run(x, { b, m }))
    const all = res.flatMap(r => r.out), ring = all.filter(r => r.ringer)
    const loss = brier(ring, 'win', 'w') + brier(ring, 't5', 'f5') + brier(ring, 't10', 'f10')
    grid.push({ b, m, loss, win: brier(ring, 'win', 'w'), t5: brier(ring, 't5', 'f5'), t10: brier(ring, 't10', 'f10'), aT10: brier(all, 't10', 'f10') })
    console.log(`b ${b} m ${m}  loss ${loss.toFixed(5)}  (win ${grid[grid.length - 1].win.toFixed(5)} t5 ${grid[grid.length - 1].t5.toFixed(5)} t10 ${grid[grid.length - 1].t10.toFixed(5)} | all-row t10 ${grid[grid.length - 1].aT10.toFixed(5)})`)
  }
  const best = grid.slice().sort((x, y) => x.loss - y.loss)[0]
  console.log('BEST', JSON.stringify(best))
  fs.writeFileSync(D('ringer-fit.json'), JSON.stringify({ fit: { b: best.b, m: best.m }, grid, sims: SIMS, frozen: new Date().toISOString(), engine: E.__engineSha }, null, 1))
} else {
  const fit = JSON.parse(fs.readFileSync(D('ringer-fit.json'), 'utf8')).fit
  const boards = load('holdout-practice.txt', 'test', withP)
  console.log(`TEST holdout-practice.txt${withP ? ' (with practice)' : ' (practice-free)'}: ${boards.length} boards, ${boards.reduce((s, b) => s + b.nR, 0)} ringer rows, ${SIMS} sims x ${RUNS} runs, frozen ${JSON.stringify(fit)}, engine ${E.__engineSha}`)
  const acc = { A: [], T: [] }
  for (let r = 0; r < RUNS; r++) {
    console.log(`\n--- run ${r + 1} A (shipped)`); acc.A.push(summarise(boards.map(b => run(b, null))))
    console.log(`--- run ${r + 1} T (ringer b ${fit.b} m ${fit.m})`); acc.T.push(summarise(boards.map(b => run(b, fit))))
  }
  const avg = arr => Object.fromEntries(Object.keys(arr[0]).filter(k => typeof arr[0][k] === 'number').map(k => [k, mean(arr.map(x => x[k]))]))
  const A = avg(acc.A), T = avg(acc.T)
  const floor = RUNS > 1 ? Object.fromEntries(Object.keys(A).map(k => [k, Math.abs(acc.A[0][k] - acc.A[1][k])])) : null
  console.log('\nMEAN  A', JSON.stringify(A)); console.log('MEAN  T', JSON.stringify(T)); if (floor) console.log('FLOOR |A1-A2|', JSON.stringify(floor))
  if (floor) {
    const ok = { b_t5: T.rT5 <= A.rT5 - floor.rT5, b_t10: T.rT10 <= A.rT10 - floor.rT10, c_win: T.rWin <= A.rWin + floor.rWin, d_t10all: T.aT10 <= A.aT10 + floor.aT10, d_rho: T.rho >= A.rho - floor.rho, d_winall: T.aWin <= A.aWin + floor.aWin, e_fav: Math.abs(T.favGap) <= Math.abs(A.favGap) + 1.0 }
    console.log('RAILS', JSON.stringify(ok), Object.values(ok).every(Boolean) ? 'PASS' : 'FAIL')
  }
}

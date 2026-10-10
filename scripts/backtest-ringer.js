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
const FEAT = JSON.parse(fs.readFileSync(D('protocol-features.json'), 'utf8'))
const ACT = {}
JSON.parse(fs.readFileSync(D('dom-train-actuals.json'), 'utf8')).forEach(r => { ACT['train|' + r.race_id] = r })
try { JSON.parse(fs.readFileSync(D('dominator-actuals.json'), 'utf8')).forEach(r => { ACT['test|' + r.race_id] = r }) } catch (e) {}
const num = s => (s === '' || s == null ? null : Number(s))
const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
function wf(se, tr) {
  if (isRoadCourse(tr)) return se === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(tr)) return se === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (se === 'trucks' && __trackGroup(tr) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
const shipped = b => ({ series: b.series, ringer: b.series !== 'cup' ? { b: 12, m: 1 } : null, carDnf: b.series === 'trucks' ? { k: 32 } : null, ...((b.g === 'INT' || b.g === 'SHORT') && POOLS[b.series] && POOLS[b.series][b.g] ? { domBoot: POOLS[b.series][b.g] } : {}), lappedTraffic: b.series === 'oreilly' ? { series: 'oreilly', k: 1.5 } : null })
function load(file, tag, withPractice) {
  const boards = []
  fs.readFileSync(D(file), 'utf8').split('\n').forEach((line, li) => {
    if (!line.trim() || line.indexOf('#') === -1) return
    const [h, b] = line.split('#'); const hf = h.split('|'); const off = hf.length === 10 ? 1 : 0
    const [series, track, grp, pDnf, pN, pCau] = hf.slice(off)
    if (series === 'cup' && !process.env.ALLSERIES) return
    const fj = FEAT[tag + '|' + li]; if (!fj) return
    const rf = RF[tag + '|' + li] || null
    const ring = new Set(rf ? rf.ringers : [])
    const A = ACT[tag + '|' + fj.race_id] || null; const act = {}
    if (A) A.recs.split(';').forEach(r => { const f = r.split(','); act[f[0] + ':' + f[1]] = { ll: +f[2], fl: +f[3] } })
    const recs = b.split(';').map(r => r.split(',')).filter(f => f.length >= 9)
    const base = [], fin = [], ll = [], fl = []; let nP = 0, nR = 0
    recs.forEach((f, i) => {
      const v = withPractice ? num(f[9]) : null; if (v != null) nP++
      const key = Math.round(+f[0]) + ':' + Math.round(+f[1]); const isR = ring.has(key); if (isR) nR++
      base.push({ name: 'D' + i, startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]), nCorrRaces: num(f[5]) || 0, trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]), nTrackRaces: num(f[8]) || 0, lrpTime: v, pitCrewTime: null, corrWinConv: null, ringer: isR })
      fin.push(num(f[1])); const a = act[key]; ll.push(a ? a.ll : null); fl.push(a ? a.fl : null)
    })
    if (base.length < 15) return
    if (withPractice && nP < base.length * 0.5) return
    const P = getCautionPresets(series), cau = num(pCau), g = __trackGroup(track)
    boards.push({ series, track, g, base, fin, ll, fl, hasAct: !!A, laps: A ? +A.laps || 300 : 300, nR, w: wf(series, track), rate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0), asym: series !== 'cup' && (g === 'INT' || g === 'SHORT'),
      preset: cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2] : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a) })
  })
  return boards
}
const spearman = (a, b) => { const n = a.length; const rk = v => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(n); for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; const m = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = m; i = j + 1 } return r }; const ra = rk(a), rb = rk(b); const ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (ra[i] - ma) * (rb[i] - mb); sxx += (ra[i] - ma) ** 2; syy += (rb[i] - mb) ** 2 } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0 }
const tierOf = r => (r <= 2 ? '1-3' : r <= 7 ? '4-8' : r <= 14 ? '9-15' : '16+')
function run(b, ringer, extra) {
  const sc = buildSpeedScores(b.base, b.w, { lapPenalty: true })
  const withP = sc.filter(d => d.lrpTime != null)
  if (withP.length) { const ord = withP.slice().sort((x, y) => x.lrpTime - y.lrpTime); ord.forEach((d, i) => { d.__spdPct = ord.length > 1 ? 1 - i / (ord.length - 1) : 0.5 }) }
  const rows = runRaceSim(sc, { numSims: SIMS, cautionPreset: b.preset, dnfRate: b.rate, totalRaceLaps: b.laps, trackGroup: b.g, startSampling: null, asymNoise: b.asym, carCeilFloor: true, ...shipped(b), ...(ringer ? { ringer } : {}), ...(extra || {}) })
  const order = rows.slice().sort((x, y) => y.winPct - x.winPct)
  const rank = {}; order.forEach((r, i) => { rank[r.simIdx] = i })
  const out = []
  rows.forEach(r => { const i = r.simIdx, f = b.fin[i]; out.push({ ringer: !!b.base[i].ringer, tier: tierOf(rank[i]), win: r.winPct / 100, t5: r.top5Pct / 100, t10: r.top10Pct / 100, pf: r.projFinish, fin: f, w: f === 1 ? 1 : 0, f5: f <= 5 ? 1 : 0, f10: f <= 10 ? 1 : 0, sLL: r.projLapsLed, sFL: r.avgFastLaps, aLL: b.hasAct ? b.ll[i] : null, aFL: b.hasAct ? b.fl[i] : null }) })
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
  const gaps = []; for (const t of ['1-3', '4-8', '9-15', '16+']) { const rs = ring.filter(r => r.tier === t); if (rs.length >= 10) for (const [k, a] of [['win', 'w'], ['t5', 'f5'], ['t10', 'f10']]) gaps.push(Math.abs(mean(rs.map(r => r[k])) - mean(rs.map(r => r[a])))) }
  const regTop = non.filter(r => r.tier === '1-3')
  const worstTier = gaps.length ? Math.max(...gaps) : 0, regGap = regTop.length ? mean(regTop.map(r => r.win)) - mean(regTop.map(r => r.w)) : 0
  console.log(`  worst-tier ringer gap ${(100 * worstTier).toFixed(1)} pts   regular top-3 win gap ${(100 * regGap).toFixed(1)} pts`)
  return { n: ring.length, worstTier, regGap, rWin: brier(ring, 'win', 'w'), rT5: brier(ring, 't5', 'f5'), rT10: brier(ring, 't10', 'f10'), aWin: brier(all, 'win', 'w'), aT10: brier(all, 't10', 'f10'), rho: mean(res.map(r => r.rho)), favGap: mean(res.map(r => r.favGap)), favHit: mean(res.map(r => r.favHit)),
    stated: { win: mean(ring.map(r => r.win)), t5: mean(ring.map(r => r.t5)), t10: mean(ring.map(r => r.t10)) }, real: { win: mean(ring.map(r => r.w)), t5: mean(ring.map(r => r.f5)), t10: mean(ring.map(r => r.f10)) } }
}
const withP = !process.env.NOPRACTICE
if (STAGE === 'top' && PHASE === 'fit') {
  const fitOut = {}
  for (const se of ['oreilly', 'trucks']) {
    const boards = load('train.txt', 'train', false).filter(b => b.series === se)
    console.log(`\nTOP-LIFT FIT ${se} train.txt: ${boards.length} boards, ${SIMS} sims`)
    const grid = []
    for (const [k, b] of [[0, 0], [1, 3], [1, 6], [1, 9], [1, 12], [1, 15], [2, 3], [2, 6], [2, 9], [2, 12], [3, 3], [3, 6], [3, 9]]) {
      const res = boards.map(x => run(x, null, k ? { topLift: { k, b } } : {}))
      const all = res.flatMap(r => r.out)
      const sum = brier(all, 'win', 'w') + brier(all, 't5', 'f5') + brier(all, 't10', 'f10')
      const favGap = mean(res.map(r => r.favGap)), favHit = mean(res.map(r => r.favHit))
      grid.push({ k, b, sum, favGap, favHit }); console.log(`k ${k} b ${b}  brier sum ${sum.toFixed(5)}  fav gap ${favGap.toFixed(1)} (hit ${(100 * favHit).toFixed(0)}%)`)
    }
    const best = grid.slice().sort((x, y) => x.sum - y.sum)[0]; console.log('BEST', se, JSON.stringify(best)); fitOut[se] = { k: best.k, b: best.b }
  }
  fs.writeFileSync(D('toplift-fit.json'), JSON.stringify({ fit: fitOut, sims: SIMS, frozen: new Date().toISOString(), engine: E.__engineSha }, null, 1))
} else if (STAGE === 'top') {
  const fit = JSON.parse(fs.readFileSync(D('toplift-fit.json'), 'utf8')).fit
  for (const se of ['oreilly', 'trucks']) {
    const f = fit[se]; const boards = load('holdout-practice.txt', 'test', withP).filter(b => b.series === se)
    console.log(`\nTOP-LIFT TEST ${se} holdout-practice.txt${withP ? ' (with practice)' : ' (practice-free)'}: ${boards.length} boards, ${SIMS} x ${RUNS}, frozen ${JSON.stringify(f)}, control = shipped`)
    if (!f.k) { console.log('fit is control (k 0) - nothing to judge'); continue }
    const acc = { A: [], T: [] }
    for (let r = 0; r < RUNS; r++) {
      console.log(`--- run ${r + 1} A`); acc.A.push(summarise(boards.map(b => run(b, null))))
      console.log(`--- run ${r + 1} T (k ${f.k} b ${f.b})`); acc.T.push(summarise(boards.map(b => run(b, null, { topLift: f }))))
    }
    const avg = arr => Object.fromEntries(Object.keys(arr[0]).filter(k => typeof arr[0][k] === 'number').map(k => [k, mean(arr.map(x => x[k]))]))
    const A = avg(acc.A), T = avg(acc.T)
    const floor = RUNS > 1 ? Object.fromEntries(Object.keys(A).map(k => [k, Math.abs(acc.A[0][k] - acc.A[1][k])])) : null
    console.log('MEAN  A', JSON.stringify(A)); console.log('MEAN  T', JSON.stringify(T)); if (floor) console.log('FLOOR', JSON.stringify(floor))
    if (floor) { const ok = { b_winall: T.aWin <= A.aWin - floor.aWin, c_t10all: T.aT10 <= A.aT10 + floor.aT10, d_rho: T.rho >= A.rho - floor.rho, e_fav: Math.abs(T.favGap) < Math.abs(A.favGap), f_regGap: Math.abs(T.regGap) < Math.abs(A.regGap) }
      console.log('RAILS', se, JSON.stringify(ok), Object.values(ok).every(Boolean) ? 'PASS' : 'FAIL') }
  }
} else if (STAGE === 'ss') {
  for (const [file, tag] of [['train.txt', 'train'], ['holdout-practice.txt', 'test']]) {
    for (const se of ['cup', 'oreilly', 'trucks']) {
      const boards = load(file, tag, false).filter(b => b.series === se && b.g === 'SS')
      if (!boards.length) continue
      console.log(`\n== SS ${tag} ${se}: ${boards.length} boards, ${SIMS} sims`)
      console.log('-- PRODUCTION width (series passed)'); summarise(boards.map(b => run(b, null)))
      console.log('-- HARNESS width (pre-10-10: no series multiplier)'); summarise(boards.map(b => run(b, null, { series: null })))
    }
  }
} else if (STAGE === '3a') {
  const boards = load('train.txt', 'train', false).filter(b => b.hasAct)
  console.log(`STAGE 3a dominator bias on train (shipped b 12 lift): ${boards.length} boards, ${boards.reduce((s, b) => s + b.nR, 0)} ringer rows, ${SIMS} sims`)
  const all = boards.flatMap(b => run(b, { b: 12, m: 1 }).out).filter(r => r.aLL != null)
  const line = (lab, rs) => console.log(`${lab.padEnd(18)} n ${String(rs.length).padStart(4)}  LL sim ${mean(rs.map(r => r.sLL)).toFixed(1)} / act ${mean(rs.map(r => r.aLL)).toFixed(1)}  (bias ${(mean(rs.map(r => r.aLL - r.sLL))).toFixed(1)})   FL sim ${mean(rs.map(r => r.sFL)).toFixed(1)} / act ${mean(rs.map(r => r.aFL)).toFixed(1)}  (bias ${(mean(rs.map(r => r.aFL - r.sFL))).toFixed(1)})`)
  const ring = all.filter(r => r.ringer), non = all.filter(r => !r.ringer)
  line('RINGERS all', ring); line('non-ringers all', non)
  for (const t of ['1-3', '4-8', '9-15', '16+']) { line(`  ringer  ${t}`, ring.filter(r => r.tier === t)); line(`  non     ${t}`, non.filter(r => r.tier === t)) }
} else if (STAGE === '3' && PHASE === 'fit') {
  const boards = load('train.txt', 'train', false)
  console.log(`STAGE 3 FIT on train.txt: ${boards.length} boards, ${boards.reduce((s, b) => s + b.nR, 0)} ringer rows, ${SIMS} sims`)
  const grid = []
  for (const b of [8, 10, 12, 14]) for (const slope of [0, 0.5, 1, 1.5, 2]) {
    const res = boards.map(x => run(x, { b, m: 1, slope }))
    const all = res.flatMap(r => r.out), ring = all.filter(r => r.ringer)
    const gaps = []; for (const t of ['1-3', '4-8', '9-15', '16+']) { const rs = ring.filter(r => r.tier === t); if (rs.length >= 10) for (const [k, a] of [['win', 'w'], ['t5', 'f5'], ['t10', 'f10']]) gaps.push(Math.abs(mean(rs.map(r => r[k])) - mean(rs.map(r => r[a])))) }
    const worst = Math.max(...gaps), sum = brier(ring, 'win', 'w') + brier(ring, 't5', 'f5') + brier(ring, 't10', 'f10')
    grid.push({ b, slope, worst, sum }); console.log(`b ${b} slope ${slope}  worst-tier gap ${(100 * worst).toFixed(1)}  brier sum ${sum.toFixed(5)}`)
  }
  const best = grid.slice().sort((x, y) => (x.worst - y.worst) || (x.sum - y.sum))[0]
  console.log('BEST', JSON.stringify(best))
  fs.writeFileSync(D('ringer-fit3.json'), JSON.stringify({ fit: { b: best.b, m: 1, slope: best.slope }, grid, sims: SIMS, frozen: new Date().toISOString(), engine: E.__engineSha }, null, 1))
} else if (STAGE === '3') {
  const fit = JSON.parse(fs.readFileSync(D('ringer-fit3.json'), 'utf8')).fit
  const boards = load('holdout-practice.txt', 'test', withP)
  console.log(`STAGE 3 TEST holdout-practice.txt${withP ? ' (with practice)' : ' (practice-free)'}: ${boards.length} boards, ${boards.reduce((s, b) => s + b.nR, 0)} ringer rows, ${SIMS} x ${RUNS}, control = SHIPPED b 12 flat, frozen ${JSON.stringify(fit)}, engine ${E.__engineSha}`)
  const acc = { A: [], T: [] }
  for (let r = 0; r < RUNS; r++) {
    console.log(`\n--- run ${r + 1} A (shipped b 12)`); acc.A.push(summarise(boards.map(b => run(b, { b: 12, m: 1 }))))
    console.log(`--- run ${r + 1} T (b ${fit.b} slope ${fit.slope})`); acc.T.push(summarise(boards.map(b => run(b, fit))))
  }
  const avg = arr => Object.fromEntries(Object.keys(arr[0]).filter(k => typeof arr[0][k] === 'number').map(k => [k, mean(arr.map(x => x[k]))]))
  const A = avg(acc.A), T = avg(acc.T)
  const floor = RUNS > 1 ? Object.fromEntries(Object.keys(A).map(k => [k, Math.abs(acc.A[0][k] - acc.A[1][k])])) : null
  console.log('\nMEAN  A', JSON.stringify(A)); console.log('MEAN  T', JSON.stringify(T)); if (floor) console.log('FLOOR |A1-A2|', JSON.stringify(floor))
  if (floor) {
    const ok = { b_worstTier: T.worstTier < A.worstTier, c_t5t10: (T.rT5 + T.rT10) <= (A.rT5 + A.rT10) + floor.rT5 + floor.rT10, d_winall: T.aWin <= A.aWin + floor.aWin, e_regGap: Math.abs(T.regGap) <= Math.abs(A.regGap) }
    console.log('RAILS', JSON.stringify(ok), Object.values(ok).every(Boolean) ? 'PASS' : 'FAIL')
  }
} else if (STAGE === '1') {
  for (const [file, tag, wp] of [['train.txt', 'train', false], ['holdout-practice.txt', 'test', false], ['holdout-practice.txt', 'test', true]]) {
    const boards = load(file, tag, wp)
    console.log(`\n== ${tag} ${file}${wp ? ' (with practice)' : ' (practice-free)'}: ${boards.length} boards, ${boards.reduce((s, b) => s + b.nR, 0)} ringer rows, ${SIMS} sims, engine ${E.__engineSha}`)
    summarise(boards.map(b => run(b, null)))
  }
} else if (PHASE === 'fit') {
  const boards = load('train.txt', 'train', false)
  console.log(`FIT on train.txt: ${boards.length} boards, ${boards.reduce((s, b) => s + b.nR, 0)} ringer rows, ${SIMS} sims`)
  const grid = []
  // stage 2' (10-10): level only - m fixed at 1 (stage 1 failed the (b, m) confirmation rule; BACKTEST_LOG)
  for (const b of [0, 2, 4, 6, 8, 10, 12]) for (const m of [1]) {
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

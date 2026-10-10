// scripts/backtest-preboard2.js — REGISTERED 2026-10-10 (BACKTEST_LOG): PRE-BOARD stage 2. Two one-constant
// forms per series on the pre-board condition (projected grid, no practice):
//   L   projected-start shading lam (opts.projShade) replacing the fixed 0.7       grid {.4,.5,.6,.7,.8,1}
//   D   empty-practice weight destination (opts.emptyPracticeTo)                   {prorata, corrHistory, trackHistory, startPos}
// FIT on train.txt (2022-24) with leak-free trail10 grids (train-grids.json), judged on the PRE lines of
// holdout-practice.txt (production projection, start-v4 study rows). Shipped engine throughout.
//   PHASE=fit  SIMS=10000 node scripts/backtest-preboard2.js      # writes preboard2-fit.json
//   PHASE=test SIMS=20000 RUNS=2 node scripts/backtest-preboard2.js
const fs = require('fs'), path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup,
  isRoadCourse, isSuperspeedway, DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS,
  TRUCK_ROAD_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } = E
const PHASE = process.env.PHASE || 'test', SIMS = Number(process.env.SIMS || (PHASE === 'fit' ? 10000 : 20000)), RUNS = Number(process.env.RUNS || 2)
const D = f => path.join(__dirname, 'backtest-data', f)
const FEAT = JSON.parse(fs.readFileSync(D('protocol-features.json'), 'utf8'))
const POOLS = JSON.parse(fs.readFileSync(D('dom-pools.json'), 'utf8'))
const TG = JSON.parse(fs.readFileSync(D('train-grids.json'), 'utf8'))
const BETA = { cup: JSON.parse(fs.readFileSync(D('start-v4-fit.json'), 'utf8')).beta, oreilly: JSON.parse(fs.readFileSync(D('start-v4-fit-oreilly.json'), 'utf8')).beta, trucks: null }
const num = s => (s === '' || s == null ? null : Number(s))
const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
function wf(se, tr) {
  if (isRoadCourse(tr)) return se === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(tr)) return se === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (se === 'trucks' && __trackGroup(tr) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
const shipped = b => ({ carDnf: b.series === 'trucks' ? { k: 32 } : null, ...((b.g === 'INT' || b.g === 'SHORT') && POOLS[b.series] && POOLS[b.series][b.g] ? { domBoot: POOLS[b.series][b.g] } : {}), lappedTraffic: b.series === 'oreilly' ? { series: 'oreilly', k: 1.5 } : null })
const PROJ = {}
for (const se of ['cup', 'oreilly', 'trucks']) for (const l of fs.readFileSync(D(`start-v4-${se}-2025-26.txt`), 'utf8').split('\n')) {
  if (!l.trim() || l.startsWith('#')) continue
  const [h, b] = l.split('#'); const [id, yr, rn, grp] = h.split('|')
  const rows = b.split(';').map(r => { const f = r.split(','); return { st: +f[0], fi: +f[1], tr: num(f[2]), lfp: num(f[3]) } })
  PROJ[se + '|' + rows.map(r => r.st + ':' + r.fi).sort().join('|')] = { grp, rows }
}
const TBETA = JSON.parse(fs.readFileSync(D('start-v4-fit-trucks.json'), 'utf8')).beta   // stage 4: trucks v4 (frozen 10-09, fit 2025) - judged on 2026 boards only
function projectedRankTest(series, R, useV4Trucks) {
  const beta = series === 'trucks' ? (useV4Trucks ? TBETA : null) : BETA[series]; const b = beta ? (beta[R.grp] || 0) : 0
  const vals = R.rows.map(d => d.tr == null ? null : d.tr + (d.lfp == null ? 0 : b * (d.lfp - 0.5)))
  const idx = vals.map((v, i) => i).filter(i => vals[i] != null).sort((a, c) => vals[a] - vals[c]); const rk = new Array(vals.length).fill(null); idx.forEach((i, k) => { rk[i] = k + 1 })
  return Object.fromEntries(R.rows.map((d, i) => [d.st + ':' + d.fi, rk[i]]))
}
function load(file, tag) {
  const boards = []
  fs.readFileSync(D(file), 'utf8').split('\n').forEach((line, li) => {
    if (!line.trim() || line.indexOf('#') === -1) return
    const [h, b] = line.split('#'); const hf = h.split('|'); const off = hf.length === 10 ? 1 : 0
    const [series, track, grp, pDnf, pN, pCau] = hf.slice(off)
    const fj = FEAT[tag + '|' + li]; if (!fj) return
    const recs = b.split(';').map(r => r.split(',')).filter(f => f.length >= 9)
    let pr = null
    if (tag === 'train') pr = TG[fj.race_id] || null
    let pr4 = null, yr = hf.length === 10 ? +hf[0] : null
    else_block: {
      if (tag === 'train') break else_block
      const R = PROJ[series + '|' + recs.map(f => Math.round(+f[0]) + ':' + Math.round(+f[1])).sort().join('|')]; pr = R ? projectedRankTest(series, R, false) : null; pr4 = (R && series === 'trucks') ? projectedRankTest(series, R, true) : null
    }
    if (!pr) return
    const base = [], fin = []
    recs.forEach((f, i) => {
      const key = (f[0] === '' ? -1 : Math.round(+f[0])) + ':' + Math.round(+f[1]); const ft = fj.feat[key] || [null, 0]
      base.push({ name: 'D' + i, startPos: pr[key] != null ? pr[key] : null, __proj4: pr4 ? pr4[key] : null, __startProjected: true, __realStart: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]), nCorrRaces: num(f[5]) || 0, trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]), nTrackRaces: num(f[8]) || 0, lrpTime: null, pitCrewTime: null, corrWinConv: null, ownDnf: ft[0], ownDnfN: ft[1] })
      fin.push(num(f[1]))
    })
    if (base.length < 15) return
    const P = getCautionPresets(series), cau = num(pCau), g = __trackGroup(track)
    boards.push({ series, track, g, base, fin, yr, hasV4: !!pr4, w: wf(series, track), rate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0), asym: series !== 'cup' && (g === 'INT' || g === 'SHORT'),
      preset: cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2] : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a) })
  })
  return boards
}
const spearman = (a, b) => { const n = a.length; const rk = v => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(n); for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; const m = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = m; i = j + 1 } return r }; const ra = rk(a), rb = rk(b); const ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (ra[i] - ma) * (rb[i] - mb); sxx += (ra[i] - ma) ** 2; syy += (rb[i] - mb) ** 2 } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0 }
const cl = p => Math.max(1e-6, Math.min(1 - 1e-6, p))
function arm(boards, lam, dest, x) {
  const per = []; x = x || {}
  for (const b of boards) {
    const base = x.v4 ? b.base.map(d => ({ ...d, startPos: d.__proj4 })) : b.base
    const sc = buildSpeedScores(base, b.w, { lapPenalty: b.series !== 'cup', projShade: lam, ...(x.eliteLam != null ? { projShadeElite: x.eliteLam } : {}), ...(dest && dest !== 'prorata' ? { emptyPracticeTo: dest } : {}) })
    const rows = runRaceSim(sc, { numSims: SIMS, cautionPreset: b.preset, dnfRate: b.rate, totalRaceLaps: 300, trackGroup: b.g, startSampling: null, asymNoise: b.asym, carCeilFloor: true, ...shipped(b) })
    const pf = [], af = []; let t10 = 0, wb = 0, t5b = 0, nn = 0, fav = null, winnerRank = null
    rows.slice().sort((x, y) => y.winPct - x.winPct).forEach((r, k) => { if (b.fin[r.simIdx] === 1) winnerRank = k + 1 })
    for (const r of rows) { const f = b.fin[r.simIdx]; if (f == null) continue; pf.push(r.projFinish); af.push(f); nn++; t10 += (cl(r.top10Pct / 100) - (f <= 10 ? 1 : 0)) ** 2; wb += (r.winPct / 100 - (f === 1 ? 1 : 0)) ** 2; t5b += (r.top5Pct / 100 - (f <= 5 ? 1 : 0)) ** 2; if (!fav || r.winPct > fav.winPct) fav = { winPct: r.winPct, f } }
    per.push({ series: b.series, g: b.g, rho: spearman(pf, af), t10: t10 / nn, wb: wb / nn, t5b: t5b / nn, favStated: fav.winPct / 100, favHit: fav.f === 1 ? 1 : 0, winnerRank })
  }
  const m = k => mean(per.filter(p => p[k] != null).map(p => p[k]))
  return { per, rho: m('rho'), t10: m('t10'), wb: m('wb'), t5b: m('t5b'), favGap: m('favStated') - m('favHit'), favHit: m('favHit'), winnerRank: m('winnerRank') }
}
const row = (nm, x) => `  ${nm.padEnd(14)} rho ${x.rho.toFixed(4)}  t10 ${x.t10.toFixed(5)}  winB ${x.wb.toFixed(5)}  t5B ${x.t5b.toFixed(5)} | fav gap ${(100 * x.favGap).toFixed(1).padStart(6)}  fav hits ${(100 * x.favHit).toFixed(0)}%  winner rank ${x.winnerRank.toFixed(2)}`
const wl = (x, a, key, better) => { let w = 0, l = 0; x.per.forEach((p, i) => { const d = better === 'high' ? p[key] - a.per[i][key] : a.per[i][key] - p[key]; if (d > 0) w++; else if (d < 0) l++ }); return w + '/' + l }
const SER = ['cup', 'oreilly', 'trucks'], sub = (bs, s) => bs.filter(b => b.series === s)
const STAGE3 = !!process.env.STAGE3   // 10-10 stage 3: extended lam grid beyond the stage-2 edges + corrHalf destination; control = stage-2 ship
const SHIP = { lam: { cup: 0.7, oreilly: 1, trucks: 1 }, dest: { cup: 'prorata', oreilly: 'corrHistory', trucks: 'prorata' } }
const LAMS = [0.4, 0.5, 0.6, 0.7, 0.8, 1], DESTS = ['prorata', 'corrHistory', 'trackHistory', 'startPos']
const LAMS3 = { cup: [0.2, 0.3, 0.4, 0.7], oreilly: [1, 1.2, 1.4], trucks: [1, 1.2, 1.4] }, DESTS3 = { cup: ['prorata', 'corrHalf'], oreilly: ['corrHistory', 'corrHalf', 'prorata'], trucks: ['prorata', 'corrHalf', 'corrHistory'] }
const STAGE4 = !!process.env.STAGE4
if (STAGE4 && PHASE === 'fit') {
  // cup only: rest-of-field lam with the top-5 held at the shipped .7, by t10 Brier (dest prorata)
  const train = load('train.txt', 'train'); const bs = sub(train, 'cup')
  console.log(`FIT stage 4 (cup tiered shading) on train.txt: ${bs.length} cup boards, ${SIMS} sims; engine ${E.__engineSha}`)
  let best = null
  for (const rl of [0.3, 0.4, 0.5, 0.7]) { const r = arm(bs, rl, 'prorata', { eliteLam: 0.7 }); console.log(row('rest ' + rl + ' / elite .7', r)); if (!best || r.t10 < best.v - 1e-5) best = { rl, v: r.t10 } }
  fs.writeFileSync(D('preboard4-fit.json'), JSON.stringify({ cupRestLam: best.rl, eliteLam: 0.7, sims: SIMS, engine: E.__engineSha }, null, 2)); console.log('\nFROZEN -> cup rest lam', best.rl, 'elite .7')
} else if (STAGE4) {
  const fit = JSON.parse(fs.readFileSync(D('preboard4-fit.json'), 'utf8'))
  const test = load('holdout-practice.txt', 'test')
  console.log(`TEST stage 4 on the PRE lines: cup ${sub(test, 'cup').length} boards (tiered shading), trucks ${sub(test, 'trucks').filter(b => b.yr === 2026 && b.hasV4).length} 2026 boards (v4 projection); ${SIMS} sims, ${RUNS} runs; frozen cup rest lam ${fit.cupRestLam}; engine ${E.__engineSha}`)
  for (let run = 1; run <= RUNS; run++) {
    console.log(`\nRUN ${run}`)
    { const bs = sub(test, 'cup'); const A = arm(bs, 0.7, 'prorata'); console.log(' CUP'); console.log(row('A ship', A)); const T = arm(bs, fit.cupRestLam, 'prorata', { eliteLam: 0.7 }); console.log(row('T rest=' + fit.cupRestLam, T)); console.log(`    T vs A: t10 ${wl(T, A, 't10', 'low')}  rho ${wl(T, A, 'rho', 'high')}  winB ${wl(T, A, 'wb', 'low')}  t5B ${wl(T, A, 't5b', 'low')}`) }
    { const bs = sub(test, 'trucks').filter(b => b.yr === 2026 && b.hasV4); const A = arm(bs, 1, 'prorata'); console.log(' TRUCKS 2026'); console.log(row('A ship v3.5', A)); const V = arm(bs, 1, 'prorata', { v4: true }); console.log(row('V v4 grid', V)); console.log(`    V vs A: t10 ${wl(V, A, 't10', 'low')}  rho ${wl(V, A, 'rho', 'high')}  winB ${wl(V, A, 'wb', 'low')}  t5B ${wl(V, A, 't5b', 'low')}`) }
  }
} else if (PHASE === 'fit') {
  const train = load('train.txt', 'train')
  console.log(`FIT on train.txt with trail10 projected grids: ${train.length} boards (${SER.map(s => s + ' ' + sub(train, s).length).join(', ')}), ${SIMS} sims; engine ${E.__engineSha}`)
  const fit = { lam: {}, dest: {}, sims: SIMS, engine: E.__engineSha }
  for (const s of SER) {
    const bs = sub(train, s)
    const lams = STAGE3 ? LAMS3[s] : LAMS, dests = STAGE3 ? DESTS3[s] : DESTS, d0 = STAGE3 ? SHIP.dest[s] : 'prorata', lam0 = STAGE3 ? SHIP.lam[s] : 0.7
    console.log(`\n${s.toUpperCase()} (${bs.length}) - lam -> t10 Brier (dest ${d0}; tie within 1e-5 -> closer to ${lam0})`)
    let best = null
    for (const lam of lams) { const r = arm(bs, lam, d0); console.log(row('lam ' + lam, r)); if (!best || r.t10 < best.v - 1e-5 || (Math.abs(r.t10 - best.v) <= 1e-5 && Math.abs(lam - lam0) < Math.abs(best.lam - lam0))) best = { lam, v: r.t10 } }
    fit.lam[s] = best.lam
    console.log(`${s.toUpperCase()} - destination at lam ${best.lam} -> t10 Brier (tie -> ${d0})`)
    let bd = null
    for (const d of dests) { const r = arm(bs, best.lam, d); console.log(row('dest ' + d, r)); if (!bd || r.t10 < bd.v - 1e-5) bd = { d, v: r.t10 } }
    fit.dest[s] = bd.d; console.log(`  -> lam ${best.lam}  dest ${bd.d}`)
  }
  fs.writeFileSync(D(STAGE3 ? 'preboard3-fit.json' : 'preboard2-fit.json'), JSON.stringify(fit, null, 2)); console.log('\nFROZEN ->', JSON.stringify({ lam: fit.lam, dest: fit.dest }))
} else {
  const fit = JSON.parse(fs.readFileSync(D(STAGE3 ? 'preboard3-fit.json' : 'preboard2-fit.json'), 'utf8'))
  const test = load('holdout-practice.txt', 'test')
  console.log(`TEST on the PRE lines (production projection, no practice): ${test.length} boards (${SER.map(s => s + ' ' + sub(test, s).length).join(', ')}), ${SIMS} sims, ${RUNS} runs; frozen ${JSON.stringify({ lam: fit.lam, dest: fit.dest })}; engine ${E.__engineSha}`)
  for (let run = 1; run <= RUNS; run++) {
    console.log(`\nRUN ${run}`)
    for (const s of SER) {
      const bs = sub(test, s), lam = fit.lam[s], dest = fit.dest[s], lam0 = STAGE3 ? SHIP.lam[s] : 0.7, d0 = STAGE3 ? SHIP.dest[s] : 'prorata'
      console.log(` ${s.toUpperCase()} (${bs.length} boards)`)
      const A = arm(bs, lam0, d0); console.log(row('A ship', A))
      const chL = lam !== lam0, chD = dest !== d0
      if (!chL && !chD) { console.log(`  fitted ${lam0} / ${d0} - nothing to test`); continue }
      if (chL) { const L = arm(bs, lam, d0); console.log(row('L lam=' + lam, L)); console.log(`    L vs A: t10 ${wl(L, A, 't10', 'low')}  rho ${wl(L, A, 'rho', 'high')}  winB ${wl(L, A, 'wb', 'low')}  t5B ${wl(L, A, 't5b', 'low')}`) }
      if (chD) { const Dd = arm(bs, lam0, dest); console.log(row('D ' + dest, Dd)); console.log(`    D vs A: t10 ${wl(Dd, A, 't10', 'low')}  rho ${wl(Dd, A, 'rho', 'high')}  winB ${wl(Dd, A, 'wb', 'low')}  t5B ${wl(Dd, A, 't5b', 'low')}`) }
      if (chL && chD) { const LD = arm(bs, lam, dest); console.log(row('LD', LD)); console.log(`    LD vs A: t10 ${wl(LD, A, 't10', 'low')}  rho ${wl(LD, A, 'rho', 'high')}  winB ${wl(LD, A, 'wb', 'low')}  t5B ${wl(LD, A, 't5b', 'low')}`) }
    }
  }
}

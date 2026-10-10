// scripts/backtest-dom-groups.js — REGISTERED 2026-10-10 (BACKTEST_LOG): dominance v2 carried to SHORT /
// ROAD / SS. The INT fix (09-03: green-lap FL budget + strength-keyed dealing order with sorted-share
// curves) never left intermediates; the other groups still deal laps led / fastest laps by FINISH order
// and hand out a fastest lap for every lap. Per GROUP (pooled across series, as INT was): G_FL from the
// train actuals, alpha / k_LL / k_FL from a train grid under the coupling constraint, judged once on the
// 2025-26 practice holdout. Control = shipped (trucks carDnf k32, domBoot INT+SHORT, fixed curves ROAD/SS).
//
//   PHASE=fit  SIMS=1500  node scripts/backtest-dom-groups.js      # writes dom-groups-fit.json
//   PHASE=test SIMS=20000 RUNS=2 node scripts/backtest-dom-groups.js
const fs = require('fs'), path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup, dkFinishPts,
  isRoadCourse, isSuperspeedway, DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS,
  TRUCK_ROAD_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } = E
const PHASE = process.env.PHASE || 'test', SIMS = Number(process.env.SIMS || (PHASE === 'fit' ? 1500 : 20000)), RUNS = Number(process.env.RUNS || 2)
const GROUPS = (process.env.GROUPS || 'SHORT,ROAD,SS').split(',')
const D = f => path.join(__dirname, 'backtest-data', f)
const FEAT = JSON.parse(fs.readFileSync(D('protocol-features.json'), 'utf8'))
const POOLS = JSON.parse(fs.readFileSync(D('dom-pools.json'), 'utf8'))
const ACT = {}
JSON.parse(fs.readFileSync(D('dom-train-actuals.json'), 'utf8')).forEach(r => { ACT['train|' + r.race_id] = r })
JSON.parse(fs.readFileSync(D('dominator-actuals.json'), 'utf8')).forEach(r => { ACT['test|' + r.race_id] = r })
const num = s => (s === '' || s == null ? null : Number(s))
const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
function wf(se, tr) {
  if (isRoadCourse(tr)) return se === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(tr)) return se === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (se === 'trucks' && __trackGroup(tr) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
// production parity: domBoot ships for INT + SHORT only (src/lib/domPools.js)
const shipped = b => ({ carDnf: b.series === 'trucks' ? { k: 32 } : null, ...((b.g === 'INT' || b.g === 'SHORT') && POOLS[b.series] && POOLS[b.series][b.g] ? { domBoot: POOLS[b.series][b.g] } : {}) })
function load(file, tag, withPractice) {
  const boards = []
  fs.readFileSync(D(file), 'utf8').split('\n').forEach((line, li) => {
    if (!line.trim() || line.indexOf('#') === -1) return
    const [h, b] = line.split('#'); const hf = h.split('|'); const off = hf.length === 10 ? 1 : 0
    const [series, track, grp, pDnf, pN, pCau] = hf.slice(off)
    const g = __trackGroup(track); if (GROUPS.indexOf(g) === -1) return
    const fj = FEAT[tag + '|' + li]; if (!fj) return
    const A = ACT[tag + '|' + fj.race_id]; if (!A) return
    const act = {}; A.recs.split(';').forEach(r => { const f = r.split(','); act[f[0] + ':' + f[1]] = { ll: +f[2], fl: +f[3] } })
    const base = [], ll = [], fl = [], fin = []; let i = 0, nP = 0
    for (const rec of b.split(';')) {
      const f = rec.split(','); if (f.length < 9) continue
      const v = num(f[9]); if (v != null) nP++
      const key = (f[0] === '' ? -1 : Math.round(+f[0])) + ':' + Math.round(+f[1])
      const ft = fj.feat[key] || [null, 0], a = act[key] || { ll: 0, fl: 0 }
      base.push({ name: 'D' + i, startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]), nCorrRaces: num(f[5]) || 0,
        trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]), nTrackRaces: num(f[8]) || 0, lrpTime: withPractice ? v : null, pitCrewTime: null, corrWinConv: null, ownDnf: ft[0], ownDnfN: ft[1] })
      ll.push(a.ll); fl.push(a.fl); fin.push(num(f[1])); i++
    }
    if (base.length < 15) return
    if (withPractice && nP < base.length * 0.5) return
    const P = getCautionPresets(series), cau = num(pCau)
    boards.push({ series, track, g, base, ll, fl, fin, laps: +A.laps || 300, w: wf(series, track), rate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0),
      asym: series !== 'cup' && (g === 'INT' || g === 'SHORT'),
      preset: cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2] : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a) })
  })
  return boards
}
function score(b) {
  const sc = buildSpeedScores(b.base, b.w)
  const withP = sc.filter(d => d.lrpTime != null)
  if (withP.length) { const ord = withP.slice().sort((x, y) => x.lrpTime - y.lrpTime); ord.forEach((d, i) => { d.__spdPct = ord.length > 1 ? 1 - i / (ord.length - 1) : 0.5 }) }
  return sc
}
const spearman = (a, b) => { const n = a.length; const rk = v => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(n); for (let i = 0; i < n;) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; const m = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = m; i = j + 1 } return r }; const ra = rk(a), rb = rk(b); const ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (ra[i] - ma) * (rb[i] - mb); sxx += (ra[i] - ma) ** 2; syy += (rb[i] - mb) ** 2 } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0 }
const tierOf = r => (r === 0 ? '1' : r <= 2 ? '2-3' : r <= 5 ? '4-6' : r <= 11 ? '7-12' : '13+')
// arm config: CONTROL / NULL = shipped; A = + flBudget; B = A + strength order (alpha, kLL, kFL)
function cfg(arm, b, fit) {
  const base = { numSims: SIMS, cautionPreset: b.preset, dnfRate: b.rate, totalRaceLaps: b.laps, trackGroup: b.g, startSampling: null, asymNoise: b.asym, ...shipped(b), domPool: 'finish' }
  if (arm === 'CONTROL' || arm === 'NULL') return base
  const f = fit[b.g]
  base.flBudget = f.G_FL
  if (arm === 'A') return base
  base.domPool = 'strength'; base.domAlpha = f.alpha; base.domK = f.kLL; base.domKFL = f.kFL
  return base
}
function evalArm(arm, boards, fit, extra) {
  const per = []
  for (const b of boards) {
    const sc = score(b); const diag = {}
    const c = { ...cfg(arm, b, fit), __domDiag: diag, ...(extra ? extra(b) : {}) }
    const rows = runRaceSim(sc, c)
    const by = new Map(rows.map(r => [r.simIdx, r]))
    const ord = sc.map((d, i) => ({ i, s: d.speedScore || 0 })).sort((x, y) => y.s - x.s)
    const tiers = {}; for (const t of ['1', '2-3', '4-6', '7-12', '13+']) tiers[t] = { ll: 0, fl: 0, n: 0 }
    let e1 = 0, e2 = 0, n = 0, wb = 0, t5b = 0, t10b = 0; const pd = [], ad = []
    ord.forEach((o, rank) => {
      const r = by.get(o.i); const f = b.fin[o.i]; if (!r || f == null) return
      e1 += Math.abs(r.projLapsLed - b.ll[o.i]); e2 += Math.abs(r.avgFastLaps - b.fl[o.i]); n++
      const t = tiers[tierOf(rank)]; t.ll += b.ll[o.i] - r.projLapsLed; t.fl += b.fl[o.i] - r.avgFastLaps; t.n++
      const st = b.base[o.i].startPos != null ? b.base[o.i].startPos : f
      pd.push(r.projDK); ad.push(dkFinishPts(f) + (st - f) + 0.25 * b.ll[o.i] + 0.45 * b.fl[o.i])
      wb += (r.winPct / 100 - (f === 1 ? 1 : 0)) ** 2; t5b += (r.top5Pct / 100 - (f <= 5 ? 1 : 0)) ** 2; t10b += (r.top10Pct / 100 - (f <= 10 ? 1 : 0)) ** 2
    })
    per.push({ series: b.series, g: b.g, llMAE: e1 / n, flMAE: e2 / n, dkRho: spearman(pd, ad), wb: wb / n, t5b: t5b / n, t10b: t10b / n,
      pTopWin: diag.n ? (diag.wins || 0) / diag.n : null, tiers })
  }
  const agg = (k) => mean(per.map(p => p[k]))
  const tb = {}; for (const t of ['1', '2-3', '4-6', '7-12', '13+']) { let ll = 0, fl = 0, nn = 0; per.forEach(p => { ll += p.tiers[t].ll; fl += p.tiers[t].fl; nn += p.tiers[t].n }); tb[t] = { ll: ll / Math.max(1, nn), fl: fl / Math.max(1, nn) } }
  return { arm, n: per.length, per, llMAE: agg('llMAE'), flMAE: agg('flMAE'), dkRho: agg('dkRho'), wb: agg('wb'), t5b: agg('t5b'), t10b: agg('t10b'), pTopWin: mean(per.filter(p => p.pTopWin != null).map(p => p.pTopWin)), tiers: tb }
}
const row = r => `  ${r.arm.padEnd(8)} n=${r.n}  llMAE ${r.llMAE.toFixed(2)}  flMAE ${r.flMAE.toFixed(2)}  dkRho ${r.dkRho.toFixed(3)}  pTopWin ${r.pTopWin.toFixed(3)} | winB ${r.wb.toFixed(5)} t5B ${r.t5b.toFixed(4)} t10B ${r.t10b.toFixed(4)} | tier bias LL/FL ` + Object.keys(r.tiers).map(t => `${t}: ${r.tiers[t].ll.toFixed(1)}/${r.tiers[t].fl.toFixed(1)}`).join('  ')
const wl = (x, a, key, better) => { let w = 0, l = 0; x.per.forEach((p, i) => { const d = better === 'high' ? p[key] - a.per[i][key] : a.per[i][key] - p[key]; if (d > 0) w++; else if (d < 0) l++ }); return w + '/' + l }
const sub = (boards, g) => boards.filter(b => b.g === g)
const bySeries = boards => ['cup', 'oreilly', 'trucks'].map(s => s + ' ' + boards.filter(b => b.series === s).length).join(', ')

if (PHASE === 'fit') {
  const train = load('train.txt', 'train', false)
  console.log(`FIT on train.txt: ${train.length} boards in ${GROUPS.join('/')} (${bySeries(train)}), ${SIMS} sims; engine ${E.__engineSha}`)
  const fit = {}
  for (const g of GROUPS) {
    const bs = sub(train, g); if (bs.length < 10) { console.log(`\n${g}: only ${bs.length} boards - skipped`); continue }
    // G_FL and the coupling target from the ACTUALS
    const G_FL = mean(bs.map(b => b.fl.reduce((s, x) => s + x, 0) / b.laps))
    const pTop = mean(bs.map(b => { let mi = 0; b.ll.forEach((v, i) => { if (v > b.ll[mi]) mi = i }); return b.fin[mi] === 1 ? 1 : 0 }))
    console.log(`\n${g} (${bs.length} boards: ${bySeries(bs)})  G_FL ${G_FL.toFixed(4)}  actual P(top-LL car wins) ${pTop.toFixed(3)}  -> band [${(pTop - 0.1).toFixed(2)}, ${(pTop + 0.1).toFixed(2)}]`)
    const C = evalArm('CONTROL', bs, { [g]: { G_FL } })
    console.log(row(C))
    const A = evalArm('A', bs, { [g]: { G_FL } })
    console.log(row(A))
    const table = []
    for (const alpha of [0.25, 0.5, 0.75]) for (const k of [0.25, 0.5, 0.75, 1, 1.5, 2]) {
      const r = evalArm('B', bs, { [g]: { G_FL, alpha, kLL: k, kFL: k } })
      let oLL = 0, oFL = 0; for (const t in r.tiers) { oLL += r.tiers[t].ll ** 2; oFL += r.tiers[t].fl ** 2 }
      table.push({ alpha, k, pTopWin: +r.pTopWin.toFixed(3), objLL: +oLL.toFixed(1), objFL: +oFL.toFixed(1), llMAE: +r.llMAE.toFixed(2), flMAE: +r.flMAE.toFixed(2), t1LL: +r.tiers['1'].ll.toFixed(1), t1FL: +r.tiers['1'].fl.toFixed(1) })
      console.log('   ' + JSON.stringify(table[table.length - 1]))
    }
    const feas = table.filter(r => r.pTopWin >= pTop - 0.1 && r.pTopWin <= pTop + 0.1)
    if (!feas.length) { console.log(`  ${g}: no (alpha,k) inside the coupling band - B not fitted; A only`); fit[g] = { G_FL, alpha: null, kLL: null, kFL: null, pTop }; continue }
    const bestLL = feas.slice().sort((a, b) => a.objLL - b.objLL)[0]
    const kFL = table.filter(r => r.alpha === bestLL.alpha).sort((a, b) => a.objFL - b.objFL)[0].k
    fit[g] = { G_FL, alpha: bestLL.alpha, kLL: bestLL.k, kFL, pTop }
    console.log(`  -> ${g}: alpha ${bestLL.alpha}  k_LL ${bestLL.k}  k_FL ${kFL}`)
  }
  fs.writeFileSync(D('dom-groups-fit.json'), JSON.stringify({ fit, sims: SIMS, engine: E.__engineSha }, null, 2))
  console.log('\nFROZEN ->', JSON.stringify(fit))
} else {
  const fit = JSON.parse(fs.readFileSync(D('dom-groups-fit.json'), 'utf8')).fit
  const test = load('holdout-practice.txt', 'test', !process.env.NOPRACTICE)   // NOPRACTICE=1: the 10-10 SS registration (SS has no practice sessions)
  console.log(`TEST on holdout-practice.txt${process.env.NOPRACTICE ? ' (practice-free lines)' : ''}: ${test.length} boards in ${GROUPS.join('/')} (${bySeries(test)}), ${SIMS} sims, ${RUNS} runs; frozen ${JSON.stringify(fit)}; engine ${E.__engineSha}`)
  for (let run = 1; run <= RUNS; run++) {
    console.log(`\nRUN ${run}`)
    for (const g of GROUPS) {
      const bs = sub(test, g); const f = fit[g]
      if (!bs.length || !f) { console.log(` ${g}: nothing to test`); continue }
      console.log(` ${g} (${bs.length} boards: ${bySeries(bs)})`)
      const C = evalArm('CONTROL', bs, fit); console.log(row(C))
      const A = evalArm('A', bs, fit); console.log(row(A)); console.log(`    A vs C: llMAE ${wl(A, C, 'llMAE', 'low')} flMAE ${wl(A, C, 'flMAE', 'low')} dkRho ${wl(A, C, 'dkRho', 'high')}`)
      if (f.alpha != null) { const B = evalArm('B', bs, fit); console.log(row(B)); console.log(`    B vs C: llMAE ${wl(B, C, 'llMAE', 'low')} flMAE ${wl(B, C, 'flMAE', 'low')} dkRho ${wl(B, C, 'dkRho', 'high')} winB ${wl(B, C, 'wb', 'low')} t5B ${wl(B, C, 't5b', 'low')} t10B ${wl(B, C, 't10b', 'low')}`) }
      else console.log('  B: not fitted for this group')
      // per-series view of the same boards, for the record
      for (const s of ['cup', 'oreilly', 'trucks']) { const ix = C.per.map((p, i) => p.series === s ? i : -1).filter(i => i >= 0); if (ix.length < 4) continue; const m = (r, k) => mean(ix.map(i => r.per[i][k])); console.log(`    ${s.padEnd(8)} n=${ix.length}  llMAE C ${m(C, 'llMAE').toFixed(2)} A ${m(A, 'llMAE').toFixed(2)}${f.alpha != null ? '' : ''}  flMAE C ${m(C, 'flMAE').toFixed(2)} A ${m(A, 'flMAE').toFixed(2)}`) }
    }
  }
}

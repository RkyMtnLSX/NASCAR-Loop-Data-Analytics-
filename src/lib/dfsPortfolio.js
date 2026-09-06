// src/lib/dfsPortfolio.js — PORTFOLIO BUILDER (2026-09-06, BACKTEST_LOG same date).
//
// WHY THIS EXISTS. The product built one contest in isolation. The only GPP construction that
// has beaten it on the replay ledger is the operator's cross-contest method (Darlington O'Reilly
// 09-05: 1st of 1,189): tier-two studs heavy, punts mid-priced and rotating, cap spent, and a
// different chalk stance per contest. Backtest (9 races, 3 legs x 20, realised prize on a DK-like
// curve vs 3 x the plain E[max] set):
//   RULES ONLY (all legs 50% chalk)      18.95 -> 21.57 entry-fees per 60 (+14%), W/L 7/2
//     cup 4/0, O'Reilly 3/0, TRUCKS 0/2 (the plain set was already best in both truck races)
//   rules + 0/50/50 chalk schedule       18.22, 5/4 - the fade leg ZEROES in 5 of 9 races and pays
//     only when the chalk busts (cup Iowa 109, Darlington 26); best-of-60 pctile 89 -> 94 (8/0/1)
// So: RULES are the default for cup and O'Reilly, OFF by default for trucks (ledger decides when
// there are more truck races); the chalk SCHEDULE is an optional high-variance mode, never the
// default. Every number below is the backtested value - change them and you are off the ledger.
//
// Pure module: takes the solvers as `deps` so it does not import DFSPage (which imports it).

export const PORTFOLIO_RULES = {
  chalkOwnPct: 35,      // projected own% above which a driver is "chalk" (proj-rank model, k = 2.2)
  tier2MinPct: 50,      // tier-two studs (proj rank 3-8, $8,400-$10,000): min / max exposure per leg
  tier2MaxPct: 80,
  floorMaxPct: 10,      // floor cars (salary <= floor + $500)
  puntMaxPct: 25,       // mid punts (floor + $500 < salary <= $6,200)
  maxPuntsPerLineup: 2, // floor + mid punts combined
  salaryFloor: 48800,   // candidates under this are discarded (spend the cap)
  portfolioMaxPct: 60,  // any driver across all legs
  diversifyExtra: 1500, // V4 candidate diversification under caps (DFSPage 09-06)
}
export const CHALK_SCHEDULES = {
  all50: { label: 'All legs 50% chalk (default, backtested +14%)', stance: () => 50 },
  fade1: { label: '0 / 50 / 50 — leg 1 fades the chalk (high variance: zeroes most weeks)', stance: (leg) => (leg === 0 ? 0 : 50) },
}
export function portfolioRulesDefault(series) { return series !== 'trucks' }

// Classify the pool. rows: [{ name, sal, projDK, punt }], projOwn: { name: pct }
export function classifyPortfolioPool(rows, projOwn, R) {
  R = R || PORTFOLIO_RULES
  const usable = rows.filter(r => r.sal > 0 && r.projDK > 0)
  const floorSal = Math.min.apply(null, usable.map(r => r.sal))
  const byRank = usable.slice().sort((a, b) => b.projDK - a.projDK).map(r => r.name)
  const byName = {}; usable.forEach(r => { byName[r.name] = r })
  const chalk = usable.filter(r => (projOwn[r.name] || 0) > R.chalkOwnPct).map(r => r.name)
  let t2 = byRank.slice(2, 8).filter(n => byName[n].sal >= 8400 && byName[n].sal <= 10000)
  if (t2.length < 3) t2 = byRank.slice(2, 10).filter(n => byName[n].sal >= 8400 && byName[n].sal <= 10000)
  const floor = usable.filter(r => r.sal <= floorSal + 500).map(r => r.name)
  const midPunt = usable.filter(r => r.sal > floorSal + 500 && r.sal <= 6200).map(r => r.name)
  return { chalk, t2, floor, midPunt, floorSal }
}

// Build the legs. deps = { optimize, bestLineup, makeEmaxSelector, topUpLineups, enforceMinExposure, capFor, ROSTER, CAP }
// input = { rows, samples: { drivers, rows }, simCands, legs, want, rulesOn, schedule, locks, excludes, userExpo, projOwn }
// Returns { legs: [{ lineups: [{ drivers, salary, proj, ceil, floor }], short }], exposure: { name: count }, cls, total }
export function buildPortfolio(deps, input) {
  const { optimize, makeEmaxSelector, topUpLineups, enforceMinExposure, capFor, ROSTER, CAP } = deps
  const R = Object.assign({}, PORTFOLIO_RULES, input.rules || {})
  const rows = input.rows.filter(r => r.sal > 0 && r.projDK > 0 && !input.excludes.has(r.name))
  const byName = {}; rows.forEach(r => { byName[r.name] = r })
  const cls = classifyPortfolioPool(rows, input.projOwn || {}, R)
  const isPunt = n => cls.floor.indexOf(n) !== -1 || cls.midPunt.indexOf(n) !== -1
  const want = input.want, LEGS = input.legs
  const nmIdx = {}; input.samples.drivers.forEach((nm, ix) => { nmIdx[nm] = ix })
  const lkArr = Array.from(input.locks || [])
  const feasible = names => names.length === ROSTER && names.every(nm => nmIdx[nm] != null && byName[nm]) && lkArr.every(nm => names.indexOf(nm) !== -1) &&
    names.reduce((a, nm) => a + byName[nm].sal, 0) <= CAP
  // candidate universe (once): per-draw optima + mean optimizer, projection-sorted
  const candMap = new Map()
  const addCand = names => { const k = names.slice().sort().join('|'); if (!candMap.has(k) && feasible(names)) candMap.set(k, names.slice().sort()) }
  ;(input.simCands || []).forEach(addCand)
  const pool2 = rows.map(r => ({ name: r.name, sal: r.sal, projDK: r.projDK }))
  const meanRes = optimize(pool2, input.locks || new Set(), new Set(), Math.max(300, want * 4))
  if (!meanRes.error) meanRes.lineups.forEach(lu => addCand(lu.drivers.map(d => d.name)))
  let universe = Array.from(candMap.values())
  if (input.rulesOn) universe = universe.filter(ns => ns.reduce((s, n) => s + byName[n].sal, 0) >= R.salaryFloor && ns.filter(isPunt).length <= R.maxPuntsPerLineup)
  universe = universe.map(ns => [ns, ns.reduce((a, n) => a + byName[n].projDK, 0)]).sort((x, y) => y[1] - x[1]).map(x => x[0])
  // draws
  const DRAW_TARGET = 2000
  const strideS = Math.max(1, Math.floor(input.samples.rows.length / DRAW_TARGET))
  const drawRows = []; for (let di = 0; di < input.samples.rows.length; di += strideS) drawRows.push(input.samples.rows[di])
  const nD = drawRows.length
  const stance = CHALK_SCHEDULES[input.schedule] ? CHALK_SCHEDULES[input.schedule].stance : CHALK_SCHEDULES.all50.stance
  const used = new Set(), running = {}, legs = []
  for (let L = 0; L < LEGS; L++) {
    // exposure for this leg: user settings win, then chalk stance, then rules, then the portfolio cap
    const expo = {}
    const u = input.userExpo || {}
    Object.keys(u).forEach(n => { if (u[n] && (u[n].max != null || u[n].min != null)) expo[n] = Object.assign({}, u[n]) })
    cls.chalk.forEach(n => { if (!expo[n]) expo[n] = { max: stance(L) } })
    if (input.rulesOn) {
      cls.t2.forEach(n => { if (!expo[n]) expo[n] = { min: R.tier2MinPct, max: R.tier2MaxPct } })
      cls.floor.forEach(n => { if (!expo[n]) expo[n] = { max: R.floorMaxPct } })
      cls.midPunt.forEach(n => { if (!expo[n]) expo[n] = { max: R.puntMaxPct } })
    }
    rows.forEach(r => {
      if (input.locks && input.locks.has(r.name)) return
      const room = Math.floor(R.portfolioMaxPct / 100 * want * LEGS) - (running[r.name] || 0)
      const roomPct = Math.max(0, Math.floor(100 * room / want))
      if (roomPct < 100) { const cur = expo[r.name] && expo[r.name].max != null ? expo[r.name].max : null; expo[r.name] = Object.assign({}, expo[r.name] || {}, { max: cur != null ? Math.min(cur, roomPct) : roomPct }) }
    })
    const zero = new Set(Object.keys(expo).filter(n => expo[n].max === 0))
    let cands = universe.filter(ns => !used.has(ns.join('|')) && !ns.some(n => zero.has(n)))
    let base = cands.slice(0, 2000)
    // V4 diversification under caps
    const cnt = {}; base.forEach(ns => ns.forEach(n => { cnt[n] = (cnt[n] || 0) + 1 }))
    const seen = new Set(base.map(ns => ns.join('|')))
    Object.keys(cnt).forEach(nm => {
      if (input.locks && input.locks.has(nm)) return
      const capN = capFor(nm, want, 1, expo)
      if (!isFinite(capN) || cnt[nm] / base.length <= capN / want) return
      let added = 0
      for (const ns of cands) { if (added >= R.diversifyExtra) break; if (ns.indexOf(nm) !== -1) continue; const k = ns.join('|'); if (seen.has(k)) continue; seen.add(k); base.push(ns); added++ }
    })
    if (base.length < ROSTER) { legs.push({ lineups: [], short: true, expo }); continue }
    const nC = base.length
    const Smat = new Float32Array(nC * nD), cMean = new Float64Array(nC), cCeil = new Float64Array(nC), cFloor = new Float64Array(nC), tmp = new Float64Array(nD)
    for (let c = 0; c < nC; c++) {
      const ids = base[c].map(nm => nmIdx[nm]), off = c * nD; let mu = 0
      for (let d = 0; d < nD; d++) { const rw = drawRows[d]; const v = rw[ids[0]] + rw[ids[1]] + rw[ids[2]] + rw[ids[3]] + rw[ids[4]] + rw[ids[5]]; Smat[off + d] = v; tmp[d] = v; mu += v }
      cMean[c] = mu / nD; tmp.sort(); cCeil[c] = tmp[Math.min(nD - 1, Math.floor(0.9 * (nD - 1)))]; cFloor[c] = tmp[Math.min(nD - 1, Math.floor(0.25 * (nD - 1)))]
    }
    const capOf = nm => (input.locks && input.locks.has(nm) ? Infinity : capFor(nm, want, 1, expo))
    const sel = makeEmaxSelector(nC, nD, Smat, want, base, capOf, ROSTER)
    sel.step(0)
    let picked = sel.chosen.map(c => ({
      drivers: base[c].map(nm => ({ name: nm, car: byName[nm].car, sal: byName[nm].sal, projDK: byName[nm].projDK })),
      salary: base[c].reduce((a, nm) => a + byName[nm].sal, 0), proj: cMean[c], ceil: cCeil[c], floor: cFloor[c],
    }))
    const ex = new Set(zero)
    const poolL = pool2.filter(d => !zero.has(d.name))
    picked = topUpLineups(picked, want, 1, input.locks || new Set(), poolL, ex, expo)
    picked = enforceMinExposure(picked, want, 1, input.locks || new Set(), poolL, ex, expo)
    // NO LINEUP REUSED ACROSS LEGS: top-up / min-exposure construct from the mean optimizer and can
    // rebuild a lineup an earlier leg already holds. Drop those, then top up again with the dropped
    // ones seeded in so topUpLineups' own dedupe blocks them (their drivers count toward caps for
    // that pass - conservative), and strip them at the end. Two passes, then accept short.
    const keyOfLu = lu => lu.drivers.map(d => d.name).sort().join('|')
    for (let pass = 0; pass < 2; pass++) {
      const dups = picked.filter(lu => used.has(keyOfLu(lu)))
      if (!dups.length) break
      const keep = picked.filter(lu => !used.has(keyOfLu(lu)))
      const refilled = topUpLineups(keep.concat(dups), want + dups.length, 1, input.locks || new Set(), poolL, ex, expo)
      picked = refilled.filter(lu => !used.has(keyOfLu(lu))).slice(0, want)
    }
    picked = picked.filter(lu => !used.has(keyOfLu(lu)))
    // top-ups have no draw stats: score them
    picked.forEach(lu => { if (lu.ceil == null) { const ids = lu.drivers.map(d => nmIdx[d.name]); let mu = 0; for (let d = 0; d < nD; d++) { const rw = drawRows[d]; const v = rw[ids[0]] + rw[ids[1]] + rw[ids[2]] + rw[ids[3]] + rw[ids[4]] + rw[ids[5]]; tmp[d] = v; mu += v } lu.proj = mu / nD; const t2s = tmp.slice(0, nD).sort(); lu.ceil = t2s[Math.floor(0.9 * (nD - 1))]; lu.floor = t2s[Math.floor(0.25 * (nD - 1))] } })
    picked.forEach(lu => { used.add(lu.drivers.map(d => d.name).sort().join('|')); lu.drivers.forEach(d => { running[d.name] = (running[d.name] || 0) + 1 }) })
    legs.push({ lineups: picked, short: picked.length < want, expo })
  }
  const total = legs.reduce((s, l) => s + l.lineups.length, 0)
  return { legs, exposure: running, total, cls }
}

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
// OPERATOR PRESET (registered 2026-09-13, BACKTEST_LOG same date). The three deltas between the shipped
// rules and the operator's hand-built Darlington leg that won (09-05, rule 3 there): never the $5,000
// floor, punts only from LOW-owned mid-priced cars, and every lineup carries at least one punt.
// Overlay on PORTFOLIO_RULES via input.rules; rulesOn must be true. NOT a default anywhere until the
// registered test and the forward ledger say so. `puntEligible` (a Set of names) is the NULL-arm hook:
// when present it replaces the ownership gate with an explicit eligible set of the same size.
export const OPERATOR_PRESET = {
  floorMaxPct: 0,        // never the floor car
  puntOwnMaxPct: 12,     // mid punts must be projected <= 12% owned (v3 ownership model), else 0%
  puntMaxPct: 55,        // an eligible punt can carry up to 55% of a leg (Bilicki 55 / Smithley 45 in the leg that won)
  minPuntsPerLineup: 1,  // 1-2 punts per lineup (maxPuntsPerLineup stays 2)
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
// input = { rows, samples: { drivers, rows }, simCands, legs, want, wants?, rulesOn, schedule, locks, excludes, userExpo, projOwn }
//   wants (2026-09-12, contest-file-first): per-leg entry counts, e.g. [40, 20, 20] - legs ARE contests and
//   each is built to its own contest's size. Omitted -> every leg wants `want` (unchanged behaviour).
// Returns { legs: [{ lineups: [{ drivers, salary, proj, ceil, floor }], short }], exposure: { name: count }, cls, total }
export function buildPortfolio(deps, input) {
  const { optimize, makeEmaxSelector, topUpLineups, enforceMinExposure, capFor, ROSTER, CAP } = deps
  const R = Object.assign({}, PORTFOLIO_RULES, input.rules || {})
  const rows = input.rows.filter(r => r.sal > 0 && r.projDK > 0 && !input.excludes.has(r.name))
  const byName = {}; rows.forEach(r => { byName[r.name] = r })
  const cls = classifyPortfolioPool(rows, input.projOwn || {}, R)
  const isPunt = n => cls.floor.indexOf(n) !== -1 || cls.midPunt.indexOf(n) !== -1
  const LEGS = input.legs
  const wants = Array.isArray(input.wants) && input.wants.length === LEGS ? input.wants.map(n => Math.max(1, n | 0)) : Array.from({ length: LEGS }, () => input.want)
  const want = Math.max.apply(null, wants), wantSum = wants.reduce((a, b) => a + b, 0)
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
  // punt eligibility (Operator preset / null arm): mid punts outside the eligible set count as punts but are capped at 0
  const puntOK = n => {
    if (cls.midPunt.indexOf(n) === -1) return true
    if (R.puntEligible) return R.puntEligible.has(n)
    if (R.puntOwnMaxPct != null) return ((input.projOwn || {})[n] || 0) <= R.puntOwnMaxPct
    return true
  }
  const minPunts = R.minPuntsPerLineup || 0
  if (input.rulesOn) universe = universe.filter(ns => { const np = ns.filter(isPunt).length; return ns.reduce((s, n) => s + byName[n].sal, 0) >= R.salaryFloor && np <= R.maxPuntsPerLineup && np >= minPunts })
  universe = universe.map(ns => [ns, ns.reduce((a, n) => a + byName[n].projDK, 0)]).sort((x, y) => y[1] - x[1]).map(x => x[0])
  // draws
  const DRAW_TARGET = 2000
  const strideS = Math.max(1, Math.floor(input.samples.rows.length / DRAW_TARGET))
  const drawRows = []; for (let di = 0; di < input.samples.rows.length; di += strideS) drawRows.push(input.samples.rows[di])
  const nD = drawRows.length
  const stance = CHALK_SCHEDULES[input.schedule] ? CHALK_SCHEDULES[input.schedule].stance : CHALK_SCHEDULES.all50.stance
  const t2Off = new Set(input.t2MinOffLegs || [])
  const portMaxN = Math.max(1, Math.floor(R.portfolioMaxPct / 100 * wantSum))   // >= 1 so a 1-entry plan is not capped to zero
  const running = {}
  // ---- per-leg exposure (user settings win, then chalk stance, then rules). The portfolio cap is
  // applied LIVE inside capOf below, not baked in here, because the legs are built together.
  const legExpo = []
  for (let L = 0; L < LEGS; L++) {
    const expo = {}
    const u = input.userExpo || {}
    Object.keys(u).forEach(n => { if (u[n] && (u[n].max != null || u[n].min != null)) expo[n] = Object.assign({}, u[n]) })
    cls.chalk.forEach(n => { if (!expo[n]) expo[n] = { max: stance(L) } })
    if (input.rulesOn) {
      cls.t2.forEach(n => { if (!expo[n]) expo[n] = t2Off.has(L) ? { max: R.tier2MaxPct } : { min: R.tier2MinPct, max: R.tier2MaxPct } })
      cls.floor.forEach(n => { if (!expo[n]) expo[n] = { max: R.floorMaxPct } })
      cls.midPunt.forEach(n => { if (!expo[n]) expo[n] = { max: puntOK(n) ? R.puntMaxPct : 0 } })
    }
    legExpo.push(expo)
  }
  // ---- ONE candidate base for all legs (2,000 by projection + V4 diversification against the
  // tightest cap any leg puts on a driver), scored once.
  const zeroAny = new Set(); legExpo.forEach(e => Object.keys(e).forEach(n => { if (e[n].max === 0) zeroAny.add(n) }))
  const cands = universe.filter(ns => !ns.some(n => legExpo.every(e => e[n] && e[n].max === 0)))
  let base = cands.slice(0, 2000)
  const cnt = {}; base.forEach(ns => ns.forEach(n => { cnt[n] = (cnt[n] || 0) + 1 }))
  const seen = new Set(base.map(ns => ns.join('|')))
  Object.keys(cnt).forEach(nm => {
    if (input.locks && input.locks.has(nm)) return
    const capN = Math.min.apply(null, legExpo.map((e, L) => capFor(nm, wants[L], 1, e) / wants[L]).concat([portMaxN / wantSum]))   // as a share
    if (!isFinite(capN) || cnt[nm] / base.length <= capN) return
    let added = 0
    for (const ns of cands) { if (added >= R.diversifyExtra) break; if (ns.indexOf(nm) !== -1) continue; const k = ns.join('|'); if (seen.has(k)) continue; seen.add(k); base.push(ns); added++ }
  })
  if (base.length < ROSTER) return { legs: legExpo.map(expo => ({ lineups: [], short: true, expo, why: ['no cap-legal candidates'] })), exposure: {}, total: 0, cls }
  const nC = base.length
  const Smat = new Float32Array(nC * nD), cMean = new Float64Array(nC), cCeil = new Float64Array(nC), cFloor = new Float64Array(nC), tmp = new Float64Array(nD)
  for (let c = 0; c < nC; c++) {
    const ids = base[c].map(nm => nmIdx[nm]), off = c * nD; let mu = 0
    for (let d = 0; d < nD; d++) { const rw = drawRows[d]; const v = rw[ids[0]] + rw[ids[1]] + rw[ids[2]] + rw[ids[3]] + rw[ids[4]] + rw[ids[5]]; Smat[off + d] = v; tmp[d] = v; mu += v }
    cMean[c] = mu / nD; tmp.sort(); cCeil[c] = tmp[Math.min(nD - 1, Math.floor(0.9 * (nD - 1)))]; cFloor[c] = tmp[Math.min(nD - 1, Math.floor(0.25 * (nD - 1)))]
  }
  // ---- ROUND-ROBIN selection: one pick per leg per round, so no leg is built from another's
  // leftovers and the portfolio cap bites all legs equally. A lineup picked by one leg is banned
  // in the others; capOf reads the live cross-leg count.
  const legCount = legExpo.map(() => ({}))
  const sels = legExpo.map((expo, L) => makeEmaxSelector(nC, nD, Smat, wants[L], base, nm => {
    if (input.locks && input.locks.has(nm)) return Infinity
    const legCap = capFor(nm, wants[L], 1, expo)
    const other = (running[nm] || 0) - (legCount[L][nm] || 0)
    return Math.min(legCap, Math.max(0, portMaxN - other))
  }, ROSTER))
  const legIdx = legExpo.map(() => [])
  let progress = true
  while (progress) {
    progress = false
    for (let L = 0; L < LEGS; L++) {
      const before = sels[L].chosen.length
      if (before >= wants[L]) continue
      if (!sels[L].pick()) continue
      const c = sels[L].chosen[before]
      legIdx[L].push(c); progress = true
      base[c].forEach(nm => { running[nm] = (running[nm] || 0) + 1; legCount[L][nm] = (legCount[L][nm] || 0) + 1 })
      sels.forEach((s2, L2) => { if (L2 !== L) s2.ban(c) })
    }
  }
  // ---- per-leg top-up / min exposure (mean optimizer), cross-leg dedupe, diagnostics
  const used = new Set(); legIdx.forEach(ix => ix.forEach(c => used.add(base[c].join('|'))))
  const keyOfLu = lu => lu.drivers.map(d => d.name).sort().join('|')
  const legs = []
  for (let L = 0; L < LEGS; L++) {
    const expo = legExpo[L]
    const wantL = wants[L]
    // fold the live portfolio cap into this leg's expo for the mean-optimizer passes
    rows.forEach(r => { if (input.locks && input.locks.has(r.name)) return; const other = (running[r.name] || 0) - (legCount[L][r.name] || 0); const roomPct = Math.max(0, Math.floor(100 * (portMaxN - other) / wantL)); if (roomPct < 100) { const cur = expo[r.name] && expo[r.name].max != null ? expo[r.name].max : null; expo[r.name] = Object.assign({}, expo[r.name] || {}, { max: cur != null ? Math.min(cur, roomPct) : roomPct }) } })
    const zero = new Set(Object.keys(expo).filter(n => expo[n].max === 0))
    let picked = legIdx[L].map(c => ({
      drivers: base[c].map(nm => ({ name: nm, car: byName[nm].car, sal: byName[nm].sal, projDK: byName[nm].projDK })),
      salary: base[c].reduce((a, nm) => a + byName[nm].sal, 0), proj: cMean[c], ceil: cCeil[c], floor: cFloor[c],
    }))
    picked.forEach(lu => used.delete(keyOfLu(lu)))   // this leg's own picks are not "reused"
    const ex = new Set(zero)
    const poolL = pool2.filter(d => !zero.has(d.name))
    const before = picked.length
    picked = topUpLineups(picked, wantL, 1, input.locks || new Set(), poolL, ex, expo)
    picked = enforceMinExposure(picked, wantL, 1, input.locks || new Set(), poolL, ex, expo)
    for (let pass = 0; pass < 2; pass++) {
      const dups = picked.filter(lu => used.has(keyOfLu(lu)))
      if (!dups.length) break
      const keep = picked.filter(lu => !used.has(keyOfLu(lu)))
      const refilled = topUpLineups(keep.concat(dups), wantL + dups.length, 1, input.locks || new Set(), poolL, ex, expo)
      picked = refilled.filter(lu => !used.has(keyOfLu(lu))).slice(0, wantL)
    }
    picked = picked.filter(lu => !used.has(keyOfLu(lu)))
    // Operator preset: the top-up passes build with the mean optimizer, which knows nothing about the
    // minimum-punt rule - drop any filler lineup that breaks it rather than pad (never pads, 09-06).
    if (input.rulesOn && minPunts > 0) picked = picked.filter(lu => lu.drivers.filter(d => isPunt(d.name)).length >= minPunts)
    // recount this leg after top-up (running was built from the selector picks only)
    const cntL = {}; picked.forEach(lu => lu.drivers.forEach(d => { cntL[d.name] = (cntL[d.name] || 0) + 1 }))
    Object.keys(legCount[L]).forEach(n => { running[n] -= legCount[L][n] }); legCount[L] = cntL; Object.keys(cntL).forEach(n => { running[n] = (running[n] || 0) + cntL[n] })
    picked.forEach(lu => { if (lu.ceil == null) { const ids = lu.drivers.map(d => nmIdx[d.name]); let mu = 0; for (let d = 0; d < nD; d++) { const rw = drawRows[d]; const v = rw[ids[0]] + rw[ids[1]] + rw[ids[2]] + rw[ids[3]] + rw[ids[4]] + rw[ids[5]]; tmp[d] = v; mu += v } lu.proj = mu / nD; const t2s = tmp.slice(0, nD).sort(); lu.ceil = t2s[Math.floor(0.9 * (nD - 1))]; lu.floor = t2s[Math.floor(0.25 * (nD - 1))] } })
    picked.forEach(lu => used.add(keyOfLu(lu)))
    // WHY SHORT: name the binding constraint instead of padding
    const why = []
    if (picked.length < wantL) {
      const atPort = rows.filter(r => (running[r.name] || 0) >= portMaxN).map(r => r.name)
      if (atPort.length) why.push('portfolio cap ' + R.portfolioMaxPct + '% reached on ' + atPort.join(', '))
      const t2Under = input.rulesOn && !t2Off.has(L) ? cls.t2.filter(n => (cntL[n] || 0) < Math.ceil(wantL * R.tier2MinPct / 100)) : []
      if (t2Under.length) why.push('tier-two minimum ' + R.tier2MinPct + '% not reachable for ' + t2Under.join(', '))
      const left = cands.filter(ns => !used.has(ns.join('|')) && !ns.some(n => zero.has(n))).length
      if (left < wantL - picked.length) why.push('candidate pool exhausted (' + left + ' unused cap-legal lineups left)')
      if (!why.length) why.push('per-leg exposure caps leave no legal lineup')
    }
    legs.push({ lineups: picked, short: picked.length < wantL, want: wantL, expo, why, selectorPicks: before })
  }
  const total = legs.reduce((s, l) => s + l.lineups.length, 0)
  return { legs, exposure: running, total, cls }
}

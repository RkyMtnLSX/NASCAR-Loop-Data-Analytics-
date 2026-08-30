import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const SERIES = [{ v: 'cup', label: 'Cup' }, { v: 'oreilly', label: "O'Reilly" }, { v: 'trucks', label: 'Trucks' }]
const SERIES_COLOR = { cup: 'var(--series-cup)', oreilly: 'var(--series-oreilly)', trucks: 'var(--series-trucks)' }
const __CAR_ALIAS = { '133': '33' }
function CarNum({ car, series }) {
  if (!car) return null
  const dir = series === 'oreilly' ? '/car-numbers-oreilly/' : series === 'trucks' ? '/car-numbers-trucks/' : '/car-numbers/'
  return (
    <img src={dir + (__CAR_ALIAS[String(car)] || car) + '.png'} alt={'#' + car}
      style={{ height: 20, marginRight: 7, verticalAlign: 'middle' }}
      onError={(e) => { const t = e.target; if (!t.dataset.retried) { t.dataset.retried = '1'; t.src = t.src + (t.src.indexOf('?') >= 0 ? '&r=' : '?r=') + Date.now() } else { const sp = document.createElement('span'); sp.textContent = t.alt + ' '; sp.style.fontWeight = '700'; t.replaceWith(sp) } }} />
  )
}
const CAP = 50000
const ROSTER = 6
// 2026-08-30: CAP/ROSTER and the two solvers below are EXPORTED so DfsReplay runs the replay
// through the SAME code the product builds with. Do not fork copies into the replay page - a
// forked solver would silently stop replaying what DFS Center actually does.
export { CAP as DFS_CAP, ROSTER as DFS_ROSTER }

export function optimize(pool, locks, excludes, K) {
  const usable = pool.filter(d => d.sal > 0 && d.projDK > 0 && !excludes.has(d.name))
  const locked = usable.filter(d => locks.has(d.name))
  if (locked.length > ROSTER) return { error: 'More than ' + ROSTER + ' drivers locked.' }
  const need = ROSTER - locked.length
  const lockSal = locked.reduce((a, b) => a + b.sal, 0)
  const lockProj = locked.reduce((a, b) => a + b.projDK, 0)
  const capLeft = CAP - lockSal
  if (capLeft < 0) return { error: 'Locked drivers exceed the salary cap.' }
  const cand = usable.filter(d => !locks.has(d.name)).sort((a, b) => b.projDK - a.projDK)
  const m = cand.length
  if (m < need) return { error: 'Not enough drivers with salaries to fill a lineup.' }
  const results = []; let worst = -Infinity
  const topRSumFrom = (i, r) => { let s = 0, c = 0; for (let j = i; j < m && c < r; j++) { s += cand[j].projDK; c++ } return s }
  function dfs(start, chosen, sal, proj) {
    if (chosen.length === need) {
      const tot = proj + lockProj
      if (results.length < K) { results.push({ sal: sal + lockSal, proj: tot, ids: chosen.slice() }); if (results.length === K) { results.sort((a, b) => a.proj - b.proj); worst = results[0].proj } }
      else if (tot > worst) { results[0] = { sal: sal + lockSal, proj: tot, ids: chosen.slice() }; results.sort((a, b) => a.proj - b.proj); worst = results[0].proj }
      return
    }
    const remNeed = need - chosen.length
    for (let i = start; i <= m - remNeed; i++) {
      const d = cand[i]
      if (sal + d.sal > capLeft) continue
      if (results.length >= K) { const ub = proj + d.projDK + topRSumFrom(i + 1, remNeed - 1) + lockProj; if (ub <= worst) break }
      chosen.push(i); dfs(i + 1, chosen, sal + d.sal, proj + d.projDK); chosen.pop()
    }
  }
  dfs(0, [], 0, 0)
  results.sort((a, b) => b.proj - a.proj)
  return { lineups: results.map(r => ({ drivers: locked.concat(r.ids.map(i => cand[i])), salary: r.sal, proj: r.proj })) }
}

// Per-driver exposure (2026-08-29, operator: "I cant force the optimizer to take logano so i
// have to lock him but then he is set at 100%"): expo = { name: { min, max } } in whole percents.
// max overrides the global cap per driver; min is enforced by quota construction (see
// enforceMinExposure). Locked drivers remain exempt from caps (lock = 100% by definition).
function __capFor(name, want, maxExp, expo) {
  const mx = expo && expo[name] && expo[name].max != null ? expo[name].max / 100 : maxExp
  return mx >= 1 ? Infinity : Math.max(1, Math.floor(want * mx))
}
function __hasMaxOverride(expo) {
  return !!(expo && Object.keys(expo).some(n => expo[n] && expo[n].max != null && expo[n].max < 100))
}
export function applyExposure(ranked, want, maxExp, locks, expo) {
  const lk = locks || new Set()
  if (maxExp >= 1 && !__hasMaxOverride(expo)) return ranked.slice(0, want)
  // Cap = appearances vs the REQUESTED count (floor(want x maxExp)), greedy down the
  // ranking. 2026-08-21: the 7/23 delivered-set trim loop is GONE - with a driver present
  // in ~every candidate (chalk on a small slate) it death-spiraled cap2 down to ONE lineup
  // (operator hit it: 20 @ 90% -> 1). If the pool exhausts early, delivered exposure can
  // exceed maxExp - the Exposure column shows the truth; lower the cap if that matters.
  const used = {}, picked = []
  for (const lu of ranked) {
    if (picked.length >= want) break
    if (lu.drivers.some(d => !lk.has(d.name) && (used[d.name] || 0) >= __capFor(d.name, want, maxExp, expo))) continue
    picked.push(lu); lu.drivers.forEach(d => { used[d.name] = (used[d.name] || 0) + 1 })
  }
  return picked
}

// TOP-UP (2026-08-29, operator: "why cant it just do what it needs to do to set 20 unique
// lineups?"): applyExposure only FILTERS the ranked candidates - on a chalky slate the top
// candidates all share one core, so once the core hits the cap every remaining candidate is
// blocked and the request under-delivers (20 @ 60% delivered 13). This CONSTRUCTS the missing
// lineups: re-run the optimizer with capped drivers excluded, take the best new unique lineup,
// update counts, repeat. Top-ups are ranked by projected mean (not sim ceiling) - they are the
// depth of the portfolio, and re-scoring them on samples is not worth freezing the tab for.
export function topUpLineups(picked, want, maxExp, locks, pool, excludes, expo) {
  if ((maxExp >= 1 && !__hasMaxOverride(expo)) || picked.length >= want) return picked
  const lk = locks || new Set()
  const keyOf = lu => lu.drivers.map(d => d.name).sort().join('|')
  const used = {}
  const have = new Set()
  picked.forEach(lu => { have.add(keyOf(lu)); lu.drivers.forEach(d => { if (!lk.has(d.name)) used[d.name] = (used[d.name] || 0) + 1 }) })
  let guard = 0
  while (picked.length < want && guard++ < want * 4) {
    const ex2 = new Set(excludes)
    Object.keys(used).forEach(n => { if (used[n] >= __capFor(n, want, maxExp, expo)) ex2.add(n) })
    const res = optimize(pool, lk, ex2, 60)
    if (res.error || !res.lineups || !res.lineups.length) break
    let added = false
    for (const lu of res.lineups) {
      if (have.has(keyOf(lu))) continue
      if (lu.drivers.some(d => !lk.has(d.name) && (used[d.name] || 0) >= __capFor(d.name, want, maxExp, expo))) continue
      picked.push(lu); have.add(keyOf(lu))
      lu.drivers.forEach(d => { if (!lk.has(d.name)) used[d.name] = (used[d.name] || 0) + 1 })
      added = true
      break
    }
    if (!added) break
  }
  return picked
}

// MIN exposure enforcement: for each driver with a min%, ensure they appear in at least
// ceil(want x min%) delivered lineups. Builds a fresh lineup with the under-quota driver
// forced in (plus the global locks), then swaps out the lowest-ranked lineup that does not
// contain them and whose removal strands no other driver below their own met quota. If the
// set is under-delivered it just adds. Quotas are best-effort: salary/cap conflicts stop the
// loop rather than spiraling (guard = 4x want), and the Exposure column shows the truth.
export function enforceMinExposure(picked, want, maxExp, locks, pool, excludes, expo) {
  const lk = locks || new Set()
  const mins = Object.keys(expo || {}).filter(n => expo[n] && expo[n].min > 0 && !lk.has(n))
  if (!mins.length || !picked.length) return picked
  const keyOf = lu => lu.drivers.map(d => d.name).sort().join('|')
  const quota = {}; mins.forEach(n => { quota[n] = Math.min(want, Math.ceil(want * expo[n].min / 100)) })
  const count = {}
  picked.forEach(lu => lu.drivers.forEach(d => { count[d.name] = (count[d.name] || 0) + 1 }))
  const have = new Set(picked.map(keyOf))
  let guard = 0
  while (guard++ < want * 4) {
    const under = mins.filter(n => (count[n] || 0) < quota[n]).sort((a, b) => (quota[b] - (count[b] || 0)) - (quota[a] - (count[a] || 0)))
    if (!under.length) break
    const target = under[0]
    const ex2 = new Set(excludes)
    Object.keys(count).forEach(n => { if (n !== target && !lk.has(n) && (count[n] || 0) >= __capFor(n, want, maxExp, expo)) ex2.add(n) })
    const lk2 = new Set(lk); lk2.add(target)
    const res = optimize(pool, lk2, ex2, 60)
    if (res.error || !res.lineups || !res.lineups.length) break
    let cand = null
    for (const lu of res.lineups) { if (!have.has(keyOf(lu))) { cand = lu; break } }
    if (!cand) break
    if (picked.length < want) {
      picked.push(cand); have.add(keyOf(cand))
      cand.drivers.forEach(d => { count[d.name] = (count[d.name] || 0) + 1 })
      continue
    }
    let dropIdx = -1
    for (let i = picked.length - 1; i >= 0; i--) {
      const lu = picked[i]
      if (lu.drivers.some(d => d.name === target)) continue
      const breaks = lu.drivers.some(d => quota[d.name] != null && (count[d.name] || 0) - 1 < quota[d.name])
      if (!breaks) { dropIdx = i; break }
    }
    if (dropIdx < 0) break
    const dropped = picked[dropIdx]
    dropped.drivers.forEach(d => { count[d.name] = (count[d.name] || 0) - 1 })
    have.delete(keyOf(dropped))
    picked = picked.slice(0, dropIdx).concat(picked.slice(dropIdx + 1))
    picked.push(cand); have.add(keyOf(cand))
    cand.drivers.forEach(d => { count[d.name] = (count[d.name] || 0) + 1 })
  }
  return picked
}

export function bestLineup(pool) {
  const usable = pool.filter(d => d.sal > 0 && d.val > 0)
  if (usable.length < ROSTER) return null
  const cand = usable.sort((a, b) => b.val - a.val)
  const m = cand.length
  let best = null, bestVal = -Infinity
  const topRSum = (i, r) => { let s = 0, c = 0; for (let j = i; j < m && c < r; j++) { s += cand[j].val; c++ } return s }
  const chosen = []
  function dfs(start, cnt, sal, val) {
    if (cnt === ROSTER) { if (val > bestVal) { bestVal = val; best = chosen.slice() } return }
    const rem = ROSTER - cnt
    for (let i = start; i <= m - rem; i++) {
      const d = cand[i]
      if (sal + d.sal > CAP) continue
      if (val + topRSum(i, rem) <= bestVal) break
      chosen.push(i); dfs(i + 1, cnt + 1, sal + d.sal, val + d.val); chosen.pop()
    }
  }
  dfs(0, 0, 0, 0)
  return best ? best.map(i => cand[i].name) : null
}

export default function DFSPage() {
  const [series, setSeries] = useState('cup')
  const [race, setRace] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [salaries, setSalaries] = useState({})
  const [samples, setSamples] = useState(null)
  const [loading, setLoading] = useState(false)
  const [locks, setLocks] = useState(() => new Set())
  const [excludes, setExcludes] = useState(() => new Set())
  const [numLineups, setNumLineups] = useState(20)
  // DEFAULT MAX EXPOSURE 100% -> 50% (2026-08-30). Measured, not assumed: the 20-lineup portfolio
  // was rebuilt through this same exposure machinery across all 8 replayable races at caps of
  // 100/60/50/40/30/25/20 pct and scored on the real finishes. BEST-OF-20 mean field percentile:
  //   no cap 79.8 | 60% 86.3 | 50% 87.0 | 40% 89.0 | 30% 87.3 | 25% 85.4 | 20% 86.1
  // Uncapped is the WORST setting at every level of the sweep, and it was shipping as the default.
  // The mechanism is portfolio floor, not ceiling: uncapped builds reuse one core (12-21 unique
  // drivers across 20 lineups vs 33 at a 20% cap), so when that core busts the whole portfolio
  // busts - cup R25 62.4 -> 89.8 and trucks R18 51.9 -> 79.2 are the rescues that move the mean.
  // 50% is the conservative middle of the plateau; 40% scored highest and is one control away.
  // IN-SAMPLE across 8 races - this is a UI default, not a model constant, and the replay ledger
  // tracks it forward. Operator's own method (exclusions + per-driver caps + wide spread) is what
  // prompted the measurement: "the variance is extreme at superspeedways".
  const [maxExp, setMaxExp] = useState(0.5)
  const [expo, setExpo] = useState({}) // { name: { min, max } } whole percents; see __capFor/enforceMinExposure
  const [lineups, setLineups] = useState([])
  const [optPct, setOptPct] = useState({})
  const [building, setBuilding] = useState(false)
  const [note, setNote] = useState('')
  const [mode, setMode] = useState('gpp') // 2026-08-14: GPP ceiling default
  const [simCands, setSimCands] = useState(null)
  const [entFile, setEntFile] = useState(null) // 2026-08-20: parsed DK entries file awaiting contest selection
  const [sortKey, setSortKey] = useState('value')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    let alive = true
    setLoading(true); setLineups([]); setOptPct({}); setSimCands(null); setLocks(new Set()); setExcludes(new Set()); setExpo({}); setSalaries({}); setSamples(null); setNote('')
    ;(async () => {
      const { data } = await supabase.from('sim_results').select('track_name,race_year,race_number,results').eq('series', series).order('published_at', { ascending: false }).limit(1)   // FIX 2026-07-23: id is a UUID — ordering by it is RANDOM, served stale boards
      if (!alive) return
      const row = data && data[0]
      if (!row) { setDrivers([]); setRace(null); setLoading(false); return }
      const r = { track: row.track_name, year: row.race_year, rn: row.race_number }
      setRace(r)
      const ds = (row.results || []).map(d => ({
        name: d.driver_name, car: d.car_number, mfr: d.manufacturer,
        projDK: +d.proj_dk || 0, projFinish: +d.proj_finish || 0, winPct: +d.win_pct || 0,
        lapsLed: +d.laps_led || 0, avgFast: +d.avg_fast_laps || 0,
        // Show the DK-LISTED start (2026-08-23): for a grid-penalty driver the sim races him from the
        // rear but DK keeps his qualified spot for place differential. Showing the sim start here made
        // the board disagree with DraftKings. Falls back to the sim start for everyone else.
        startPos: (d.dk_start_pos != null ? +d.dk_start_pos : +d.start_pos) || 0,
        simStartPos: +d.start_pos || 0
      })).filter(d => d.name)
      setDrivers(ds)
      let q = supabase.from('dfs_salaries').select('salaries').eq('series', series).eq('race_year', r.year)
      q = r.rn != null ? q.eq('race_number', r.rn) : q.is('race_number', null)
      const { data: sd } = await q.order('updated_at', { ascending: false }).limit(1)
      if (alive && sd && sd[0] && sd[0].salaries) setSalaries(sd[0].salaries)
      try {
        let sq = supabase.from('dfs_sim_samples').select('drivers,samples').eq('series', series).eq('race_year', r.year)
        sq = r.rn != null ? sq.eq('race_number', r.rn) : sq.is('race_number', null)
        const { data: samp } = await sq.order('created_at', { ascending: false }).limit(1)
        if (alive && samp && samp[0] && samp[0].drivers) setSamples({ drivers: samp[0].drivers, rows: samp[0].samples || [] })
      } catch (e) { /* samples table optional */ }
      if (alive) setLoading(false)
    })()
    return () => { alive = false }
  }, [series])

  // 2026-07-24: Optimal% computes automatically once samples + salaries are loaded
  // (was: only after clicking Build lineups). Chunked; cancelled cleanly on series switch.
  useEffect(() => {
    if (!samples || !samples.drivers || !samples.rows || !samples.rows.length) return
    const __outSet = new Set(salaries.__out || [])
    const salByIdx = samples.drivers.map(nm => __outSet.has(nm) ? 0 : (salaries[nm] || 0))
    if (salByIdx.filter(v => v > 0).length < ROSTER) return
    let cancel = false
    const cnt = {}, nS = samples.rows.length
    const candMap = new Map() // per-draw optimal lineups = GPP candidates
    let si = 0
    const CHUNK = 400
    const step = () => {
      if (cancel) return
      const end = Math.min(nS, si + CHUNK)
      for (; si < end; si++) {
        const rowS = samples.rows[si], p = []
        for (let j = 0; j < samples.drivers.length; j++) { const sal = salByIdx[j]; if (sal > 0) p.push({ name: samples.drivers[j], sal, val: rowS[j] }) }
        const lu = bestLineup(p)
        if (lu) { lu.forEach(nm => { cnt[nm] = (cnt[nm] || 0) + 1 }); const ck = lu.slice().sort().join('|'); if (!candMap.has(ck)) candMap.set(ck, lu) }
      }
      if (si < nS) setTimeout(step, 0)
      else if (!cancel) { const op = {}; Object.keys(cnt).forEach(nm => { op[nm] = cnt[nm] / nS * 100 }); setOptPct(op); setSimCands(Array.from(candMap.values())) }
    }
    step()
    return () => { cancel = true }
  }, [samples, salaries])

  // 2026-07-25: Ceiling DK = 90th-percentile DK score from the stored sim samples.
  // Cash games read Proj (mean); GPPs read the ceiling (Boschele IRP: proj 31, ceiling would
  // have shown the P19->top-7 tournament upside the mean hides).
  const ceilMap = useMemo(() => {
    if (!samples || !samples.drivers || !samples.rows || !samples.rows.length) return {}
    const out = {}
    const nS = samples.rows.length
    const i90 = Math.min(nS - 1, Math.floor(nS * 0.9))
    for (let j = 0; j < samples.drivers.length; j++) {
      const col = new Float64Array(nS)
      for (let s2 = 0; s2 < nS; s2++) col[s2] = samples.rows[s2][j] || 0
      col.sort()
      out[samples.drivers[j]] = col[i90]
    }
    return out
  }, [samples])

  const rows = useMemo(() => drivers.map(d => {
    // OUT drivers (withdrawn / DNQ, from dfs_salaries.__out 2026-08-20): effective salary 0
    // kills value AND drops them from every optimizer path (all pools filter sal > 0).
    const isOut = (salaries.__out || []).includes(d.name)
    const sal = isOut ? 0 : (salaries[d.name] || 0)
    const value = sal > 0 ? d.projDK / (sal / 1000) : 0
    return { ...d, sal, value, out: isOut, opt: optPct[d.name] || 0, ceil: ceilMap[d.name] || 0 }
  }), [drivers, salaries, optPct, ceilMap])

  const sorted = useMemo(() => {
    const arr = rows.slice()
    arr.sort((a, b) => { const x = a[sortKey], y = b[sortKey]; const c = (x < y ? -1 : x > y ? 1 : 0); return sortDir === 'asc' ? c : -c })
    return arr
  }, [rows, sortKey, sortDir])

  const exposure = useMemo(() => {
    const c = {}; lineups.forEach(lu => lu.drivers.forEach(d => { c[d.name] = (c[d.name] || 0) + 1 }))
    return c
  }, [lineups])

  const salCount = Object.values(salaries).filter(v => v > 0).length
  const canBuild = salCount >= ROSTER
  const toggle = (setFn, name) => setFn(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })

  // GPP CEILING MODE (2026-08-14): rank lineups by 90th-percentile TOTAL across the
  // stored correlated sim draws instead of mean projection. Candidates = every draw's
  // exact optimal lineup (deduped - each is a realizable race story, SaberSim-style)
  // plus the top mean lineups for coverage. Receipts that motivated it: Iowa replay -
  // mean-optimal cup lineup finished 1289/1417 while PD-ceiling builds won; top-heavy
  // GPP payouts pay ceiling, not average. Cash mode keeps the mean objective.
  const buildGpp = () => {
    const nmIdx = {}
    samples.drivers.forEach((nm, ix) => { nmIdx[nm] = ix })
    const salByN = {}, carByN = {}, projByN = {}
    rows.forEach(r2 => { salByN[r2.name] = r2.sal; carByN[r2.name] = r2.car; projByN[r2.name] = r2.projDK })
    const lkArr = [...locks]
    const feasible = names =>
      names.length === ROSTER &&
      names.every(nm => nmIdx[nm] != null && (salByN[nm] || 0) > 0 && !excludes.has(nm)) &&
      lkArr.every(nm => names.indexOf(nm) !== -1) &&
      names.reduce((a2, nm) => a2 + (salByN[nm] || 0), 0) <= CAP
    const candMap2 = new Map()
    const addCand = names => { const k2 = names.slice().sort().join('|'); if (!candMap2.has(k2) && feasible(names)) candMap2.set(k2, names) }
    ;(simCands || []).forEach(addCand)
    const pool2 = rows.map(r2 => ({ name: r2.name, car: r2.car, sal: r2.sal, projDK: r2.projDK }))
    const meanRes = optimize(pool2, locks, excludes, 300)
    if (!meanRes.error) meanRes.lineups.forEach(lu => addCand(lu.drivers.map(d2 => d2.name)))
    const cands = Array.from(candMap2.values())
    if (!cands.length) { setNote('No cap-legal candidate lineups under current locks/excludes.'); setBuilding(false); return }
    // perf (2026-08-14): cap candidates at 2000 (by projected mean) and score on a
    // ~2500-draw stride sample - p90 SE is fine there; full 10k sorts froze the tab.
    let cands2 = cands
    if (cands2.length > 2000) {
      cands2 = cands2.map(n3 => [n3, n3.reduce((a3, nm) => a3 + (projByN[nm] || 0), 0)])
        .sort((x3, y3) => y3[1] - x3[1]).slice(0, 2000).map(x3 => x3[0])
    }
    const strideS = Math.max(1, Math.floor(samples.rows.length / 2500))
    const drawRows = []
    for (let di = 0; di < samples.rows.length; di += strideS) drawRows.push(samples.rows[di])
    const nS2 = drawRows.length
    const idxCands = cands2.map(names => names.map(nm => nmIdx[nm]))
    const scored = []
    let ci = 0
    const CH = 100
    const step2 = () => {
      const end2 = Math.min(cands2.length, ci + CH)
      for (; ci < end2; ci++) {
        const idxs = idxCands[ci]
        const tots = new Float64Array(nS2)
        for (let si2 = 0; si2 < nS2; si2++) {
          const rw = drawRows[si2]
          tots[si2] = rw[idxs[0]] + rw[idxs[1]] + rw[idxs[2]] + rw[idxs[3]] + rw[idxs[4]] + rw[idxs[5]]
        }
        tots.sort()
        const pk = f3 => tots[Math.min(nS2 - 1, Math.floor(f3 * (nS2 - 1)))]
        let mn2 = 0; for (let x2 = 0; x2 < nS2; x2++) mn2 += tots[x2]
        mn2 /= nS2
        scored.push({
          drivers: cands2[ci].map(nm => ({ name: nm, car: carByN[nm], sal: salByN[nm], projDK: projByN[nm] || 0 })),
          salary: cands2[ci].reduce((a2, nm) => a2 + (salByN[nm] || 0), 0),
          proj: mn2, ceil: pk(0.9), floor: pk(0.25),
        })
      }
      if (ci < cands2.length) setTimeout(step2, 0)
      else {
        scored.sort((a2, b2) => b2.ceil - a2.ceil)
        let picked = applyExposure(scored, numLineups, maxExp, locks, expo)
        const nFiltered = picked.length
        picked = topUpLineups(picked, numLineups, maxExp, locks, pool2, excludes, expo)
        picked = enforceMinExposure(picked, numLineups, maxExp, locks, pool2, excludes, expo)
        setLineups(picked)
        // UNDER-DELIVERY WARNING (2026-08-23): the cash path has always reported this; GPP did not,
        // so a narrowed set could ship silently. Both real-money incidents were degenerate sets
        // uploaded before the problem was visible - see BACKTEST_LOG 2026-08-23.
        const gppShort = picked.length < numLineups
          ? 'ONLY ' + picked.length + ' of ' + numLineups + ' lineups possible at ' + Math.round(maxExp * 100) + '% max exposure even after constructing fresh lineups - lock/exclude settings leave too few drivers. '
          : (picked.length > nFiltered ? (picked.length - nFiltered) + ' of ' + picked.length + ' lineups were constructed under the exposure cap and ranked by projection (not sim ceiling). ' : '')
        setNote(gppShort + 'GPP mode: ' + cands2.length + ' candidates scored across ' + nS2 + ' sampled sim draws, ranked by p90 total.')
        setBuilding(false)
      }
    }
    step2()
  }
  const build = () => {
    setBuilding(true); setLineups([]); setNote('')
    if (mode === 'gpp' && samples && samples.drivers && samples.rows && samples.rows.length) { setTimeout(buildGpp, 30); return }
    setTimeout(() => {
      const pool = rows.map(r => ({ name: r.name, car: r.car, sal: r.sal, projDK: r.projDK }))
      const K = Math.min(1500, Math.max(numLineups * 20, 200))   // deeper pool so exposure caps can actually fill the request
      const res = optimize(pool, locks, excludes, K)
      if (res.error) { setNote(res.error); setBuilding(false); return }
      let picked = applyExposure(res.lineups, numLineups, maxExp, locks, expo)
      picked = topUpLineups(picked, numLineups, maxExp, locks, pool, excludes, expo)
      picked = enforceMinExposure(picked, numLineups, maxExp, locks, pool, excludes, expo)
      setLineups(picked)
      const expMsg = picked.length < numLineups ? 'Exposure cap: only ' + picked.length + ' of ' + numLineups + ' lineups possible at ' + Math.round(maxExp * 100) + '% max exposure even after constructing fresh lineups (locked drivers exempt) - lock/exclude settings leave too few drivers.' : ''
      setNote(expMsg)
      setBuilding(false)
    }, 30)
  }

  // FILL RESERVED ENTRIES v2 (2026-08-20): parse the DK Entries CSV, group rows by
  // contest, let the user pick WHICH contests to fill, then emit a file containing ONLY
  // the selected entries - DK edits those in place and never touches unchecked contests.
  // Two-pass trick: fill GPP contests with a ceiling build, rebuild in Cash mode, run the
  // same file again for the cash contests. v1 (2026-08-14) filled every row blindly.
  const __csvParse = (line) => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += ch } else { if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = '' } else cur += ch } } out.push(cur); return out }
  const __csvSer = (cells) => cells.map(c => /[",]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c).join(',')
  const parseEntriesFile = (file) => {
    if (!lineups.length || !file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const lines = String(ev.target.result || '').split(/\r?\n/)
        let hdrIdx = -1, eCol = -1, cCol = -1
        const dCols = []
        for (let li = 0; li < lines.length; li++) {
          const cells = __csvParse(lines[li])
          const ei = cells.findIndex(c => c.trim().toLowerCase() === 'entry id')
          if (ei !== -1) {
            hdrIdx = li; eCol = ei
            cCol = cells.findIndex(c => c.trim().toLowerCase() === 'contest name')
            if (cCol === -1) cCol = cells.findIndex(c => c.trim().toLowerCase() === 'contest id') // some DK exports carry only the ID
            cells.forEach((c, ci2) => { if (c.trim() === 'D') dCols.push(ci2) })
            break
          }
        }
        if (hdrIdx === -1 || dCols.length < ROSTER) { setNote('Could not find Entry ID / D columns. Get the right file from DraftKings: Lineups -> EDIT ENTRIES -> download CSV. (Not the entry-history export - that has Sport/Game_Type and no Entry ID.)'); return }
        const groups = {}
        for (let li = hdrIdx + 1; li < lines.length; li++) {
          if (!lines[li]) continue
          const cells = __csvParse(lines[li])
          if (!/^\d{6,}$/.test((cells[eCol] || '').trim())) continue
          const cRaw = cCol !== -1 ? (cells[cCol] || '').trim() : ''
          const cname = cRaw ? (/^\d+$/.test(cRaw) ? 'Contest #' + cRaw : cRaw) : 'All entries'
          ;(groups[cname] = groups[cname] || []).push(li)
        }
        const glist = Object.keys(groups).map(n2 => ({ name: n2, rows: groups[n2] }))
        if (!glist.length) { setNote('No reserved entries found in that file.'); return }
        setEntFile({ lines, hdrIdx, eCol, cCol, dCols, groups: glist, sel: new Set(glist.map(g => g.name)) })
        setNote('')
      } catch (err2) { setNote('Entries parse failed: ' + err2.message) }
    }
    reader.readAsText(file)
  }
  const applyEntriesFill = () => {
    if (!entFile || !lineups.length) return
    const ids = (salaries && salaries.__ids) || {}
    const missing = new Set()
    const out = entFile.lines.slice(0, entFile.hdrIdx + 1)
    let filled = 0
    // NO WRAP-AROUND WITHIN A CONTEST (2026-08-29 incident): the old `filled % lineups.length`
    // silently re-used the top lineups when the exposure cap delivered fewer than the reserved
    // entries - R24 Daytona GPP got 5 exact duplicate pairs out of 20 entries, which both wasted
    // GPP equity AND pushed real exposure back up to ~90%, defeating the cap the operator set.
    // Now: each contest gets at most one entry per unique lineup; excess rows are OMITTED from
    // the output (DK only edits rows present in the upload, so those entries stay untouched).
    // Re-using the same lineup across DIFFERENT contests remains fine and intended.
    let skipped = 0
    entFile.groups.forEach(g => {
      if (!entFile.sel.has(g.name)) return
      let gi = 0
      g.rows.forEach(li => {
        if (gi >= lineups.length) { skipped++; return }
        const cells = __csvParse(entFile.lines[li])
        const lu = lineups[gi]
        lu.drivers.forEach((d2, k2) => { const id = ids[d2.name]; if (!id) missing.add(d2.name); cells[entFile.dCols[k2]] = id ? d2.name + ' (' + id + ')' : d2.name })
        out.push(__csvSer(cells))
        gi++; filled++
      })
    })
    if (!filled) { setNote('No contests selected.'); return }
    const skipMsg = skipped ? ' SKIPPED ' + skipped + ' entr' + (skipped === 1 ? 'y' : 'ies') + ' (only ' + lineups.length + ' unique lineups at the current exposure cap - no duplicates written; those entries are untouched on DK. Raise the cap or lineup count and re-run to fill them).' : ''
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([out.join('\n')], { type: 'text/csv' }))
    const __trk2 = race && race.track ? String(race.track).replace(/[^a-zA-Z0-9]+/g, '_') : 'race'
    a.download = 'PitBoard_DK_ENTRIES_' + series + '_' + __trk2 + '_filled.csv'
    a.click(); URL.revokeObjectURL(a.href)
    setNote('Filled ' + filled + ' entr' + (filled === 1 ? 'y' : 'ies') + ' across ' + entFile.sel.size + ' contest(s) - upload back on the DK Upload Lineups page. Unselected contests untouched.' + skipMsg + (missing.size ? ' WARNING: no DK ID for ' + [...missing].join(', ') : ''))
    setEntFile(null)
  }

  const exportCsv = () => {
    if (!lineups.length) return
    const ids = (salaries && salaries.__ids) || {}
    const missing = new Set()
    const rows2 = lineups.map(lu => lu.drivers.map(d => { const id = ids[d.name]; if (!id) missing.add(d.name); return id ? (d.name + ' (' + id + ')') : d.name }).join(','))
    const csv = 'D,D,D,D,D,D\n' + rows2.join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    // 2026-08-14: filename carries race + mode so the file is findable at DK upload time
    const __trk = race && race.track ? String(race.track).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') : 'race'
    const __tag = (race && race.year ? race.year + '_' : '') + (race && race.rn != null ? 'R' + race.rn + '_' : '') + __trk
    a.download = 'PitBoard_DK_' + series + '_' + __tag + '_' + (lineups[0] && lineups[0].ceil != null ? 'GPP' : 'cash') + '_lineups.csv'
    a.click(); URL.revokeObjectURL(a.href)
    setNote(missing.size ? 'CSV exported - WARNING: no DK ID for ' + missing.size + ' driver(s) (re-paste the full DK salary CSV in Salary Admin to capture IDs; DK upload needs them)' : 'CSV exported - DK upload ready (' + lineups.length + ' lineups)')
  }
  const th = (key, label, align) => (
    <th onClick={() => { setSortKey(key); setSortDir(sortKey === key && sortDir === 'desc' ? 'asc' : 'desc') }}
      style={{ padding: '7px 8px', textAlign: align || 'right', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border,#333)', userSelect: 'none' }}>
      {label}{sortKey === key ? (sortDir === 'desc' ? ' \u25bc' : ' \u25b2') : ''}
    </th>
  )
  const card = { background: 'var(--card,#16181d)', border: '1px solid var(--border,#2a2d34)', borderRadius: 10, padding: 16, marginBottom: 16 }

  return (
    <div className="page" style={{ maxWidth: 1180, margin: '0 auto', padding: '18px 16px 60px' }}>
      <h1 style={{ margin: '0 0 4px' }}>DFS Center</h1>
      <div style={{ color: 'var(--text-secondary,#9aa0aa)', marginBottom: 16, fontSize: 14 }}>
        DraftKings Classic projections from the latest published simulation. Build optimal lineups against the posted salaries.
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        {SERIES.map(s => (
          <button key={s.v} onClick={() => setSeries(s.v)}
            style={{ padding: '7px 14px', borderRadius: 8, cursor: 'pointer', border: series === s.v ? '1px solid ' + SERIES_COLOR[s.v] : '1px solid var(--border,#2a2d34)', background: series === s.v ? SERIES_COLOR[s.v] : 'transparent', color: series === s.v ? (s.v === 'trucks' ? '#111' : '#fff') : 'var(--text-secondary,#9aa0aa)' }}>
            {s.label}
          </button>
        ))}
        {race && <span style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 13 }}>{race.track} &middot; {race.year} &middot; Race {race.rn}</span>}
      </div>

      {loading && <div style={{ color: 'var(--text-secondary,#9aa0aa)' }}>Loading projections\u2026</div>}
      {!loading && !drivers.length && <div style={card}>No published simulation found for this series yet.</div>}

      {!loading && drivers.length > 0 && <>
        {/* 2026-08-14: lineups render ABOVE the driver pool - post-build result first */}
        {lineups.length > 0 && <div style={card}>
          <div style={{ marginBottom: 10 }}><strong>{lineups.length} lineup{lineups.length === 1 ? '' : 's'}</strong> <span style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 13 }}>{lineups[0] && lineups[0].ceil != null ? 'ranked by 90th-percentile total across sim draws' : 'ranked by projected DK points'}</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ color: 'var(--text-secondary,#9aa0aa)' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>#</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Drivers</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Salary</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Proj DK</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Ceil (p90)</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Floor (p25)</th>
              </tr></thead>
              <tbody>
                {lineups.map((lu, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border,#22252b)' }}>
                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary,#9aa0aa)' }}>{i + 1}</td>
                    <td style={{ padding: '5px 8px' }}>{lu.drivers.slice().sort((a, b) => b.projDK - a.projDK).map(d => (d.car ? '#' + d.car + ' ' : '') + d.name).join(',  ')}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right' }}>{'$' + lu.salary.toLocaleString()}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>{lu.proj.toFixed(1)}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--accent,#e11d2a)' }}>{lu.ceil != null ? lu.ceil.toFixed(1) : '-'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--text-secondary,#9aa0aa)' }}>{lu.floor != null ? lu.floor.toFixed(1) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>}
        <div style={card}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>Lineups<br /><input type="number" value={numLineups} min={1} max={150} onChange={e => setNumLineups(Math.max(1, Math.min(150, +e.target.value || 1)))} style={{ width: 70, marginTop: 4, background: 'var(--bg,#0e0f13)', color: 'var(--text,#e8eaed)', border: '1px solid var(--border,#2a2d34)', borderRadius: 6, padding: '5px 7px' }} /></label>
            <label style={{ fontSize: 13 }}>Max exposure %<br /><input type="number" min={10} max={100} step={5}
              value={Math.round(maxExp * 100)}
              onChange={e => { const v = Math.max(10, Math.min(100, +e.target.value || 100)); setMaxExp(v / 100) }}
              style={{ marginTop: 4, width: 72, background: 'var(--bg,#0e0f13)', color: 'var(--text,#e8eaed)', border: '1px solid var(--border,#2a2d34)', borderRadius: 6, padding: '5px 7px' }} /></label>
            <label style={{ fontSize: 13 }}>Mode<br /><select value={mode} onChange={e => setMode(e.target.value)} style={{ marginTop: 4, background: 'var(--bg,#0e0f13)', color: 'var(--text,#e8eaed)', border: '1px solid var(--border,#2a2d34)', borderRadius: 6, padding: '5px 7px' }}>
              <option value="gpp">GPP (ceiling)</option><option value="cash">Cash (average)</option>
            </select></label>
            <button onClick={build} disabled={building || !canBuild} style={{ padding: '8px 18px', borderRadius: 8, cursor: building || !canBuild ? 'not-allowed' : 'pointer', border: 'none', background: !canBuild ? 'var(--border,#2a2d34)' : 'var(--accent,#e11d2a)', color: '#fff', fontWeight: 600 }}>
              {building ? 'Building\u2026' : 'Build lineups'}
            </button>
            {lineups.length > 0 && <button onClick={exportCsv} style={{ padding: '8px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--accent,#e11d2a)', background: 'transparent', color: 'var(--accent,#e11d2a)', fontWeight: 600 }}>Export DK CSV</button>}
            {/* CLEAR LINEUPS (2026-08-23, operator request): an undo at the point where money leaves.
                Twice now a degenerate set has been uploaded and discovered too late (cup Richmond R24
                seven-entries-one-thesis; NH trucks R18 exposure spiral). Also drops any staged
                entries-fill file so a stale "Fill which contests?" panel cannot outlive the lineups. */}
            {lineups.length > 0 && <button onClick={() => { setLineups([]); setEntFile(null); setNote('Lineups cleared - adjust locks, excludes, exposure or mode and build again.') }}
              style={{ padding: '8px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border,#2a2d34)', background: 'transparent', color: 'var(--text-muted,#9aa0a6)', fontWeight: 600 }}>Clear lineups</button>}
            {lineups.length > 0 && <label style={{ padding: '8px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--accent,#e11d2a)', color: 'var(--accent,#e11d2a)', fontWeight: 600, fontSize: 13 }}>
              Fill reserved entries
              <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => { parseEntriesFile(e.target.files && e.target.files[0]); e.target.value = '' }} />
            </label>}
            {entFile && <div style={{ width: '100%', marginTop: 10, padding: '10px 12px', border: '1px solid var(--border,#2a2d34)', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Fill which contests?</div>
              {entFile.groups.map(g => (
                <label key={g.name} style={{ display: 'block', fontSize: 13, marginBottom: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={entFile.sel.has(g.name)} onChange={() => setEntFile(p => { const sel = new Set(p.sel); if (sel.has(g.name)) sel.delete(g.name); else sel.add(g.name); return { ...p, sel } })} />{' '}
                  {g.name} <span style={{ color: 'var(--text-secondary,#9aa0aa)' }}>({g.rows.length} entr{g.rows.length === 1 ? 'y' : 'ies'})</span>
                </label>
              ))}
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button onClick={applyEntriesFill} style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--accent,#E10600)', color: '#fff', fontWeight: 600 }}>Fill selected</button>
                <button onClick={() => setEntFile(null)} style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border,#2a2d34)', background: 'transparent', color: 'var(--text,#e8eaed)' }}>Cancel</button>
              </div>
            </div>}
            <span style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 12 }}>{canBuild ? 'Cap $50,000 \u00b7 6 drivers \u00b7 Lock/Excl to steer' + (samples ? ' \u00b7 Optimal% from ' + samples.rows.length + ' sims \u00b7 Value = proj DK pts per $1K salary (higher = more points per dollar) \u00b7 Ceiling = 90th-percentile DK score (tournament upside)' : '') : 'Salaries not posted yet'}</span>
            {note && <span style={{ color: 'var(--accent,#e11d2a)', fontSize: 12 }}>{note}</span>}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ color: 'var(--text-secondary,#9aa0aa)' }}>
                <th style={{ padding: '7px 8px', textAlign: 'left' }}>Lock/Excl · Min/Max %</th>
                {th('name', 'Driver', 'left')}{th('startPos', 'Start')}{th('sal', 'Salary')}{th('projDK', 'Proj DK')}{th('ceil', 'Ceiling')}{th('value', 'Value')}{th('opt', 'Optimal%')}
                {th('winPct', 'Win%')}{th('lapsLed', 'Laps Led')}{th('avgFast', 'Fast Laps')}{th('projFinish', 'Proj Fin')}
                <th style={{ padding: '7px 8px', textAlign: 'right' }}>Exposure</th>
              </tr></thead>
              <tbody>
                {sorted.map(d => {
                  const locked = locks.has(d.name), excl = excludes.has(d.name)
                  const vBg = d.value >= 4 ? 'rgba(46,160,67,0.28)' : d.value >= 3 ? 'rgba(46,160,67,0.14)' : 'transparent'
                  const oBg = d.opt >= 30 ? 'rgba(232,185,35,0.3)' : d.opt >= 12 ? 'rgba(232,185,35,0.15)' : 'transparent'
                  return (
                    <tr key={d.name} style={{ borderBottom: '1px solid var(--border,#22252b)', opacity: excl ? 0.4 : 1 }}>
                      <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => toggle(setLocks, d.name)} title="Lock" style={{ marginRight: 4, padding: '2px 7px', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--border,#2a2d34)', background: locked ? 'var(--accent,#e11d2a)' : 'transparent', color: locked ? '#fff' : 'var(--text-secondary,#9aa0aa)' }}>L</button>
                        <button onClick={() => toggle(setExcludes, d.name)} title="Exclude" style={{ padding: '2px 7px', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--border,#2a2d34)', background: excl ? '#555' : 'transparent', color: '#fff' }}>X</button>
                        <input type="number" min={0} max={100} placeholder="min" title="Min exposure % - forces this driver into at least this share of lineups without locking to 100%"
                          value={expo[d.name] && expo[d.name].min != null ? expo[d.name].min : ''}
                          onChange={e => { const v = e.target.value === '' ? null : Math.max(0, Math.min(100, +e.target.value || 0)); setExpo(prev => ({ ...prev, [d.name]: { ...(prev[d.name] || {}), min: v } })) }}
                          style={{ width: 44, marginLeft: 6, background: 'var(--bg,#0e0f13)', color: expo[d.name] && expo[d.name].min > 0 ? 'var(--accent,#e11d2a)' : 'var(--text,#e8eaed)', border: '1px solid var(--border,#2a2d34)', borderRadius: 5, padding: '2px 4px', fontSize: 12 }} />
                        <input type="number" min={0} max={100} placeholder="max" title="Max exposure % - per-driver cap, overrides the global max exposure for this driver"
                          value={expo[d.name] && expo[d.name].max != null ? expo[d.name].max : ''}
                          onChange={e => { const v = e.target.value === '' ? null : Math.max(0, Math.min(100, +e.target.value || 0)); setExpo(prev => ({ ...prev, [d.name]: { ...(prev[d.name] || {}), max: v } })) }}
                          style={{ width: 44, marginLeft: 4, background: 'var(--bg,#0e0f13)', color: expo[d.name] && expo[d.name].max != null && expo[d.name].max < 100 ? '#e8b923' : 'var(--text,#e8eaed)', border: '1px solid var(--border,#2a2d34)', borderRadius: 5, padding: '2px 4px', fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}><CarNum car={d.car} series={series} />{d.name}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>{d.startPos ? 'P' + d.startPos : '\u2014'}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{d.out ? <span style={{ fontSize: 10, fontWeight: 800, color: '#ff5148', border: '1px solid #ff5148', borderRadius: 4, padding: '1px 5px' }}>OUT</span> : d.sal ? '$' + d.sal.toLocaleString() : '\u2014'}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>{d.projDK.toFixed(1)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--text-secondary,#9aa0aa)' }}>{d.ceil ? d.ceil.toFixed(0) : '\u2014'}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', background: vBg, fontWeight: 600 }}>{d.value ? d.value.toFixed(2) : '\u2014'}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', background: oBg }}>{d.opt ? d.opt.toFixed(1) + '%' : '\u2014'}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{d.winPct.toFixed(1)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{d.lapsLed.toFixed(0)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{d.avgFast.toFixed(0)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{d.projFinish.toFixed(1)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--text-secondary,#9aa0aa)' }}>{exposure[d.name] ? Math.round(exposure[d.name] / (lineups.length || 1) * 100) + '%' : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        
      </>}
    </div>
  )
}

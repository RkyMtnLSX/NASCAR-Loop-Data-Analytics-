// src/lib/dfsReplayRun.js - the DFS Replay computation and ledger save, moved out of DfsReplay.js
// (2026-10-11) so the DK standings upload can run the replay in the same action. The page keeps its
// UI and calls runReplay / saveReplay. Body is verbatim from the page's run() / save().
import { supabase } from './supabase'
import { optimize, bestLineup, makeEmaxSelector, topUpLineups, enforceMinExposure, dfsCapFor, projectOwnership, DFS_ROSTER, DFS_CAP } from '../pages/DFSPage'
import { buildPortfolio, portfolioRulesDefault, classifyPortfolioPool, OPERATOR_PRESET, PORTFOLIO_RULES } from './dfsPortfolio'


// DFS REPLAY (2026-08-30, operator: "should this be an admin tool that I can run instead of having
// you do it everytime? ... I always upload the contest after the race").
//
// WHAT IT DOES: rebuilds both DFS Center modes from the PRE-LOCK sim draws that were stored at
// publish time, scores them against the real finish, and places them in the real contest.
//   cash  = exact 6-of-N knapsack on mean projected DK, $50k cap        (DFSPage.optimize)
//   GPP   = every draw's exact optimal lineup, deduped, as candidates;
//           each scored across a ~2,500-draw stride sample, ranked by p90 (DFSPage.bestLineup)
// Both solvers are IMPORTED from DFSPage, not reimplemented - a forked copy would drift and the
// replay would quietly stop measuring the product.
//
// WHY IT IS HONEST: nothing here is refit after the fact. The draws were written at publish and
// the salary file at lock; the only post-race inputs are loop_data (the finish), dfs_contests
// (the payout ladder) and dfs_ownership. The leak check prints both timestamps so a board
// published after the green flag is visible rather than silently graded.
//
// NAME JOIN: board-name vs loop-data-name is a REAL cross-source join (unlike the taken-flag join
// in GradeCenter - see the 2026-08-30 retraction). It accent-folds, and every unmatched driver is
// reported on screen. A join that drops rows silently is how a wrong number survives.

export const SERIES = [{ v: 'cup', label: 'Cup' }, { v: 'oreilly', label: "O'Reilly" }, { v: 'trucks', label: 'Trucks' }]
const DKTBL = [0, 45, 42, 41, 40, 39, 38, 37, 36, 35, 34, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]

const __fold = (x) => (x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const nrm = (x) => __fold(x).replace(/[^a-z0-9]/g, '')
const __basenm = (x) => __fold(x).replace(/[^a-z0-9 ]/g, ' ').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim()
const __initLast = (x) => { const p = __basenm(x).split(' ').filter(Boolean); return p.length ? p[0][0] + '|' + p[p.length - 1] : '' }
// Cross-source name resolver (2026-08-30). The boards, the DK salary file, loop_data and the
// ownership file all spell names differently, and an exact key silently DROPS the ones that
// disagree - measured on the eight replayable races: "Nicholas Sanchez" vs loop data's "Nick
// Sanchez", "Andres Perez De Lara" vs "Andres Perez", "Michael Christopher Jr" vs "Mike
// Christopher, Jr.". Resolution order: exact -> suffix/punctuation-stripped -> one name being a
// prefix of the other -> first-initial + surname, and that last step only when it is UNIQUE in
// the source, so a genuine ambiguity fails loudly into the unmatched list instead of guessing.
function __resolver(sourceNames) {
  const byKey = {}, byBase = {}, byIL = {}
  sourceNames.forEach(n => {
    byKey[nrm(n)] = n
    byBase[__basenm(n)] = n
    const il = __initLast(n)
    byIL[il] = (il in byIL) ? '\u0000AMBIG' : n
  })
  const bases = Object.keys(byBase)
  return (n) => {
    if (byKey[nrm(n)]) return byKey[nrm(n)]
    const b = __basenm(n)
    if (byBase[b]) return byBase[b]
    for (let i = 0; i < bases.length; i++) {
      const k = bases[i]
      if (k.indexOf(b + ' ') === 0 || b.indexOf(k + ' ') === 0) return byBase[k]
    }
    const il = __initLast(n)
    if (byIL[il] && byIL[il] !== '\u0000AMBIG') return byIL[il]
    return null
  }
}
export const one = (n) => (n == null || isNaN(n) ? '—' : Number(n).toFixed(1))
export const two = (n) => (n == null || isNaN(n) ? '—' : Number(n).toFixed(2))
export const money = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString())

function dkPoints(fin, start, ll, fl) {
  if (fin == null) return null
  const f = Math.round(+fin), s = (start == null || isNaN(+start)) ? f : +start
  return (f >= 1 && f <= 40 ? DKTBL[f] : 0) + (s - f) + (+ll || 0) * 0.25 + (+fl || 0) * 0.45
}

// Spearman with average ranks for ties
function spearman(a, b) {
  const n = a.length
  if (n < 3) return null
  const rank = (v) => {
    const idx = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0])
    const r = new Array(n)
    let i = 0
    while (i < n) {
      let j = i
      while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++
      const avg = (i + j) / 2 + 1
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg
      i = j + 1
    }
    return r
  }
  const ra = rank(a), rb = rank(b)
  const ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n
  let nu = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) { const x = ra[i] - ma, y = rb[i] - mb; nu += x * y; da += x * x; db += y * y }
  return da && db ? nu / Math.sqrt(da * db) : null
}

// dfs_contests.scores_sample is a descending decile ladder [max, p90, ..., p10, min].
// Placement is linear inside whichever decile the score lands in.
// 2026-09-14: `top` = dfs_contests.scores_top (top 1,000 scores, descending). When the score lands
// inside it the rank is EXACT (1 + scores above it); the decile interpolation is only the fallback
// below the stored top. Measured error of the deciles alone: 300.0 placed ~506th, real rank 129th.
function placeIn(ladder, entries, score, top) {
  if (score == null) return { pct: null, rank: null }
  if (Array.isArray(top) && top.length && entries && score >= +top[top.length - 1]) {
    let above = 0; for (let i = 0; i < top.length; i++) { if (+top[i] > score) above++; else break }
    const rank = above + 1
    return { pct: 100 * (1 - (rank - 1) / Math.max(1, entries - 1)), rank, exact: true }
  }
  if (!ladder || ladder.length < 2) return { pct: null, rank: null }
  const L = ladder.map(Number)
  const step = 100 / (L.length - 1)
  if (score >= L[0]) return { pct: 100, rank: 1 }
  if (score <= L[L.length - 1]) return { pct: 0, rank: entries || null }
  for (let j = 0; j < L.length - 1; j++) {
    const hi = L[j], lo = L[j + 1]
    if (score <= hi && score >= lo) {
      const f = hi > lo ? (score - lo) / (hi - lo) : 0
      const pct = (100 - (j + 1) * step) + step * f
      return { pct, rank: entries ? Math.max(1, Math.round(entries * (100 - pct) / 100)) : null }
    }
  }
  return { pct: null, rank: null }
}

export const card = { background: 'var(--bg-card, #14161b)', border: '1px solid var(--border, #22252b)', borderRadius: 10, padding: 14, marginBottom: 14 }
export const lbl = { color: 'var(--text-muted, #6b7078)', fontSize: 11, letterSpacing: 0.3, textTransform: 'uppercase' }


const __missingCol = (error) => !!error && (error.code === '42703' || /does not exist|schema cache/i.test(error.message || ''))

// Returns the replay result object (what the page renders) or throws with the page's messages.
export async function runReplay({ series, year: yearIn, race: raceIn, entries: entriesWanted = 20, onProgress = () => {} }) {
      const sr = series, year = +yearIn, race = raceIn == null || raceIn === '' ? null : +raceIn
      const eqRace = (q) => (race == null ? q.is('race_number', null) : q.eq('race_number', race))

      // ---- samples (the pre-lock draws)
      // 2026-09-05: replay grades what the optimizer would have used, so only POST-board draws qualify.
      const { data: sampRows } = await eqRace(supabase.from('dfs_sim_samples').select('drivers,samples,track_name,created_at').eq('series', sr).eq('race_year', year).eq('stage', 'post'))
        .order('created_at', { ascending: false }).limit(1)
      const samp = sampRows && sampRows[0]
      if (!samp || !samp.drivers || !samp.samples || !samp.samples.length) { throw new Error('No stored sim samples for that race — the board has to be published with samples to be replayable.') }
      const draws = samp.samples, names = samp.drivers

      // ---- board (pick the publish that produced these samples)
      const { data: boards } = await eqRace(supabase.from('sim_results').select('results,published_at,stage,track_name').eq('series', sr).eq('race_year', year))
        .order('published_at', { ascending: false }).limit(6)
      let board = null
      ;(boards || []).forEach(b => {
        const d = Math.abs(new Date(b.published_at) - new Date(samp.created_at))
        if (!board || d < board.__d) board = { ...b, __d: d }
      })

      // ---- salaries
      const { data: salRows } = await eqRace(supabase.from('dfs_salaries').select('salaries').eq('series', sr).eq('race_year', year))
        .order('updated_at', { ascending: false }).limit(1)
      const salaries = (salRows && salRows[0] && salRows[0].salaries) || {}
      if (!Object.keys(salaries).length) { throw new Error('No DK salary file stored for that race.') }

      // ---- actual finish (races -> loop_data; races.race_number is the season R#)
      const trk = samp.track_name || (board && board.track_name)
      const { data: raceRows } = await supabase.from('races').select('id,race_number').eq('series', sr).eq('year', year).eq('track_name', trk)
      let target = null
      if (raceRows && raceRows.length === 1) target = raceRows[0]
      else if (raceRows && raceRows.length > 1) target = raceRows.find(r => String(r.race_number) === String(race)) || null
      if (!target) { throw new Error('No races row for ' + trk + ' ' + year + ' — load the race in Admin first.') }
      const { data: laps } = await supabase.from('loop_data').select('driver_name,finish_position,start_position,laps_led,fastest_laps').eq('race_id', target.id)
      if (!laps || !laps.length) { throw new Error('No loop data for that race yet — load the finish first.') }
      const actByN = {}
      laps.forEach(l => {
        actByN[l.driver_name] = {
          pts: dkPoints(l.finish_position, l.start_position, l.laps_led, l.fastest_laps),
          fin: l.finish_position == null ? null : Math.round(+l.finish_position),
          start: l.start_position == null ? null : Math.round(+l.start_position),
        }
      })

      // ---- contest + ownership (post-race, operator uploads)
      const __conQ = (cols) => eqRace(supabase.from('dfs_contests').select(cols).eq('series', sr).eq('race_year', year)).order('entriesWanted', { ascending: false }).limit(1)
      let { data: conRows, error: conErr } = await __conQ('entriesWanted,winner_score,median_score,scores_sample,scores_top,contest_type')
      if (__missingCol(conErr)) ({ data: conRows } = await __conQ('entriesWanted,winner_score,median_score,scores_sample,contest_type'))   // pre-migration schema
      const contest = conRows && conRows[0]
      // 2026-09-05 review fix: (a) ownership rows carry contest_type and both GPP and cash can be
      // banked for one race - the join used to take whichever arrived last, so rho(ownership) could
      // be against the wrong contest. Filter to the contest being graded when it has a type.
      // (b) dfs_ownership.fpts is DK's OFFICIAL score per driver (stored since ingest v2, 08-14) and
      // was never read; grading used the hand DK formula off loop_data, which the manual itself
      // notes runs ~1pt/driver hot. Official FPTS now wins wherever it exists.
      const { data: ownRows } = await eqRace(supabase.from('dfs_ownership').select('driver_name,own_pct,fpts,contest_type').eq('series', sr).eq('race_year', year))
      const __ct = contest && contest.contest_type
      const __ownAll = ownRows || []
      const __ownTyped = __ct ? __ownAll.filter(o => o.contest_type === __ct) : __ownAll
      const __ownUse = __ownTyped.length ? __ownTyped : __ownAll
      const ownByN = {}, fptsByN = {}
      __ownUse.forEach(o => { ownByN[o.driver_name] = +o.own_pct; if (o.fpts != null && isFinite(+o.fpts)) fptsByN[o.driver_name] = +o.fpts })
      const __actFor = __resolver(Object.keys(actByN))
      const __ownFor = __resolver(Object.keys(ownByN))

      // ---- pool: board drivers that DK actually priced
      const outSet = new Set(salaries.__out || [])
      const projByName = {}
      if (board && board.results) board.results.forEach(d => { projByName[d.driver_name] = +d.proj_dk || 0 })
      const idxOf = {}
      names.forEach((n, i) => { idxOf[n] = i })
      const nD = draws.length
      const meanOf = (i) => { let s = 0; for (let k = 0; k < nD; k++) s += draws[k][i] || 0; return s / nD }
      const pool = [], unmatched = []
      let __nOfficial = 0
      names.forEach((n, i) => {
        const sal = outSet.has(n) ? 0 : (salaries[n] || 0)
        if (!(sal > 0)) return
        const ak = __actFor(n)
        const a = ak == null ? null : actByN[ak]
        if (!a || a.pts == null) { unmatched.push(n); return }
        const ok = __ownFor(n)
        const __official = ok != null && fptsByN[ok] != null ? fptsByN[ok] : null
        if (__official != null) __nOfficial++
        pool.push({ name: n, idx: i, sal, projDK: projByName[n] != null ? projByName[n] : meanOf(i), actual: __official != null ? __official : a.pts, fin: a.fin, start: a.start, own: ok != null && ownByN[ok] != null ? ownByN[ok] : null })
      })
      if (pool.length < DFS_ROSTER) { throw new Error('Only ' + pool.length + ' drivers have both a salary and a result — cannot build a lineup.') }

      const sumA = (ds) => ds.reduce((s, d) => s + d.actual, 0)
      const sumS = (ds) => ds.reduce((s, d) => s + d.sal, 0)
      const sumP = (ds) => ds.reduce((s, d) => s + d.projDK, 0)
      const ladder = contest && Array.isArray(contest.scores_sample) ? contest.scores_sample : null
      const topScores = contest && Array.isArray(contest.scores_top) && contest.scores_top.length ? contest.scores_top : null
      const ent = contest ? contest.entriesWanted : null
      const decorate = (ds, ceil) => {
        const actual = sumA(ds)
        const p = placeIn(ladder, ent, actual, topScores)
        return { drivers: ds, proj: sumP(ds), ceil, salary: sumS(ds), actual, pct: p.pct, rank: p.rank, entries: ent }
      }

      // ---- CASH: the product's own mean optimizer, deep enough to double as GPP coverage
      const cashRes = optimize(pool.map(d => ({ name: d.name, sal: d.sal, projDK: d.projDK })), new Set(), new Set(), 300)
      if (cashRes.error) { throw new Error(cashRes.error) }
      const byName = {}
      pool.forEach(d => { byName[d.name] = d })
      const cash = decorate(cashRes.lineups[0].drivers.map(d => byName[d.name]))

      // ---- PERFECT (hindsight ceiling of the slate)
      const perfNames = bestLineup(pool.map(d => ({ name: d.name, sal: d.sal, val: d.actual })))
      const perfect = perfNames ? decorate(perfNames.map(n => byName[n])) : null

      // ---- GPP: per-draw exact optimals as candidates, then p90 across a stride sample
      const candMap = new Map()
      cashRes.lineups.forEach(lu => { const ns = lu.drivers.map(d => d.name).sort(); candMap.set(ns.join('|'), ns) })
      const salByIdx = names.map(n => (outSet.has(n) ? 0 : (salaries[n] || 0)))
      const inPool = new Set(pool.map(d => d.name))
      let si = 0
      const CHUNK = 400
      await new Promise((resolve) => {
        const step = () => {
          const end = Math.min(nD, si + CHUNK)
          for (; si < end; si++) {
            const row = draws[si], p = []
            for (let j = 0; j < names.length; j++) { if (salByIdx[j] > 0 && inPool.has(names[j])) p.push({ name: names[j], sal: salByIdx[j], val: row[j] || 0 }) }
            const lu = bestLineup(p)
            if (lu) { const k = lu.slice().sort().join('|'); if (!candMap.has(k)) candMap.set(k, lu.slice().sort()) }
          }
          onProgress('Solving per-draw optimals… ' + si.toLocaleString() + ' / ' + nD.toLocaleString() + ' draws, ' + candMap.size.toLocaleString() + ' candidates')
          if (si < nD) setTimeout(step, 0); else resolve()
        }
        step()
      })
      let cands = Array.from(candMap.values())
      if (cands.length > 2000) {
        cands = cands.map(ns => [ns, ns.reduce((a, n) => a + (byName[n] ? byName[n].projDK : 0), 0)])
          .sort((x, y) => y[1] - x[1]).slice(0, 2000).map(x => x[0])
      }
      const stride = Math.max(1, Math.floor(nD / 2500))
      const drawRows = []
      for (let i = 0; i < nD; i += stride) drawRows.push(draws[i])
      const nS = drawRows.length
      const scored = []
      let ci = 0
      await new Promise((resolve) => {
        const step2 = () => {
          const end = Math.min(cands.length, ci + 100)
          for (; ci < end; ci++) {
            const ids = cands[ci].map(n => idxOf[n])
            const tots = new Float64Array(nS)
            for (let s2 = 0; s2 < nS; s2++) {
              const rw = drawRows[s2]
              tots[s2] = rw[ids[0]] + rw[ids[1]] + rw[ids[2]] + rw[ids[3]] + rw[ids[4]] + rw[ids[5]]
            }
            tots.sort()
            scored.push({ names: cands[ci], ceil: tots[Math.min(nS - 1, Math.floor(0.9 * (nS - 1)))] })
          }
          onProgress('Scoring ceilings… ' + ci.toLocaleString() + ' / ' + cands.length.toLocaleString() + ' candidates')
          if (ci < cands.length) setTimeout(step2, 0); else resolve()
        }
        step2()
      })
      scored.sort((a, b) => b.ceil - a.ceil)
      // GPP SET: the product's own E[max] selector over the same candidates, N = the entry count.
      // Reported result is BEST-OF-N, which is what a tournament actually pays.
      const nD2 = drawRows.length, nC2 = cands.length
      const Smat = new Float32Array(nC2 * nD2)
      for (let c2 = 0; c2 < nC2; c2++) {
        const ids = cands[c2].map(n => idxOf[n]), off = c2 * nD2
        for (let d2 = 0; d2 < nD2; d2++) {
          const rw = drawRows[d2]
          Smat[off + d2] = rw[ids[0]] + rw[ids[1]] + rw[ids[2]] + rw[ids[3]] + rw[ids[4]] + rw[ids[5]]
        }
      }
      const selN = Math.max(1, Math.min(150, +entriesWanted || 20))
      const sel = makeEmaxSelector(nC2, nD2, Smat, selN, cands, () => Infinity, DFS_ROSTER)
      onProgress('Selecting the ' + selN + '-lineup set...')
      sel.step(0)
      const setIdx = sel.chosen
      const setLus = setIdx.map(c2 => ({ names: cands[c2], actual: sumA(cands[c2].map(n => byName[n])) }))
      setLus.sort((x, y) => y.actual - x.actual)
      const setUniq = new Set(); setIdx.forEach(c2 => cands[c2].forEach(n => setUniq.add(n)))
      const bestOfN = setLus[0]
      const ceilOf = {}; scored.forEach(s2 => { ceilOf[s2.names.join('|')] = s2.ceil })
      const gpp = decorate(bestOfN.names.map(n => byName[n]), ceilOf[bestOfN.names.join('|')])
      const alt = setLus.slice(1, 3).map(s2 => ({ names: s2.names, ceil: ceilOf[s2.names.join('|')], actual: s2.actual }))

      // ---- PORTFOLIO row (2026-09-06, BACKTEST_LOG): legs x N through src/lib/dfsPortfolio with the
      // series-default rules, scored as REALISED PRIZE on the real ladder with a fixed DK-like payout
      // curve (top 20% cash, prize ~ r^-0.75, entry-fee units) against legs x the plain E[max] set.
      // The curve is synthetic - fine for comparing two methods, not for reading the number as money.
      let portfolio = null
      try {
        const __E = ent || 0
        const __prize = (() => { const R = Math.floor(0.2 * __E); let Z = 0; for (let r = 1; r <= R; r++) Z += Math.pow(r, -0.75); return r => (__E && r >= 1 && r <= R) ? __E * Math.pow(r, -0.75) / Z : 0 })()
        const __own = projectOwnership(pool)   // same model as the product (v3 top-end term, 09-06)
        const __legs = 3, __N = selN
        const __rulesOn = portfolioRulesDefault(sr)
        const __pf = buildPortfolio(
          { optimize, bestLineup, makeEmaxSelector, topUpLineups, enforceMinExposure, capFor: dfsCapFor, ROSTER: DFS_ROSTER, CAP: DFS_CAP },
          { rows: pool.map(d => ({ name: d.name, sal: d.sal, projDK: d.projDK })), samples: { drivers: names, rows: draws }, simCands: cands, legs: __legs, want: __N,
            rulesOn: __rulesOn, schedule: 'all50', locks: new Set(), excludes: new Set(), userExpo: {}, projOwn: __own })
        const __score = (lus) => lus.reduce((s, ns) => { const a = ns.reduce((t, n) => t + byName[n].actual, 0); const p = placeIn(ladder, __E, a, topScores); return s + (p.rank ? __prize(p.rank) : 0) }, 0)
        const __pfLegs = __pf.legs.map(l => l.lineups.map(lu => lu.drivers.map(d => d.name)))
        const __pfPrize = __pfLegs.reduce((s, lus) => s + __score(lus), 0)
        const __basePrize = __legs * __score(setIdx.map(c2 => cands[c2]))
        const __pfBest = Math.max.apply(null, __pfLegs.flat().map(ns => placeIn(ladder, __E, ns.reduce((t, n) => t + byName[n].actual, 0), topScores).pct || 0))
        // FILL (2026-10-05): prize contributed by the slots the rules could not fill, so the ledger can show
        // what the fill is worth on its own (a filler that never cashes is harmless; one that does is the point)
        const __fillLegs = __pf.legs.map(l => l.lineups.filter(lu => lu.fill).map(lu => lu.drivers.map(d => d.name)))
        const __fillPrize = __fillLegs.reduce((s, lus) => s + __score(lus), 0)
        portfolio = { legs: __legs, n: __N, rulesOn: __rulesOn, prize: __pfPrize, basePrize: __basePrize, bestPct: __pfBest, entries: __pf.total,
          filled: __pf.legs.reduce((a, l) => a + (l.filled || 0), 0), fillPrize: +__fillPrize.toFixed(3), legSizes: __pf.legs.map(l => l.lineups.length + (l.filled ? '(' + l.filled + 'f)' : '')).join('/'),
          exposure: Object.entriesWanted(__pf.exposure).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n, c]) => ({ name: n, pct: Math.round(100 * c / Math.max(1, __pf.total)) })), chalk: __pf.cls.chalk, t2: __pf.cls.t2 }
        // ---- OPERATOR PRESET arm (registered 2026-09-13, BACKTEST_LOG): rules ON + OPERATOR_PRESET
        // (floor 0%, mid punts only if projected own <= 12%, >= 1 punt per lineup), scored exactly like the
        // Portfolio row. Reference = the Portfolio row above with rules FORCED ON (so trucks compare
        // like-for-like). NULL arm = the same preset with the ownership gate replaced by a random
        // eligible set of the same size (5 seeds, mean). Report only - nothing here is saved to the ledger.
        try {
          const __pfRows = pool.map(d => ({ name: d.name, sal: d.sal, projDK: d.projDK }))
          const __base = { rows: __pfRows, samples: { drivers: names, rows: draws }, simCands: cands, legs: __legs, want: __N, rulesOn: true, schedule: 'all50', locks: new Set(), excludes: new Set(), userExpo: {}, projOwn: __own }
          const __deps = { optimize, bestLineup, makeEmaxSelector, topUpLineups, enforceMinExposure, capFor: dfsCapFor, ROSTER: DFS_ROSTER, CAP: DFS_CAP }
          const __cls = classifyPortfolioPool(__pfRows, __own, PORTFOLIO_RULES)
          const __puntPts = (pf) => { let s2 = 0, k = 0; pf.legs.forEach(l => l.lineups.forEach(lu => lu.drivers.forEach(d => { if (__cls.floor.indexOf(d.name) !== -1 || __cls.midPunt.indexOf(d.name) !== -1) { s2 += byName[d.name].actual; k++ } }))); return { mean: k ? s2 / k : null, slots: k } }
          const __arm = (rules) => { const pf = buildPortfolio(__deps, { ...__base, rules }); const legsN = pf.legs.map(l => l.lineups.map(lu => lu.drivers.map(d => d.name))); return { prize: legsN.reduce((s2, lus) => s2 + __score(lus), 0), entries: pf.total, legs: pf.legs.map(l => l.lineups.length), bestPct: Math.max.apply(null, [0].concat(legsN.flat().map(ns => placeIn(ladder, __E, ns.reduce((t, n) => t + byName[n].actual, 0), topScores).pct || 0))), punt: __puntPts(pf), why: pf.legs.map(l => (l.why || []).join('; ')).filter(Boolean) } }
          const __ref = __rulesOn ? { prize: __pfPrize, entries: __pf.total, legs: __pf.legs.map(l => l.lineups.length), bestPct: __pfBest, punt: __puntPts(__pf) } : __arm({})
          const __op = __arm({ ...OPERATOR_PRESET })
          const __elig = __cls.midPunt.filter(n => (__own[n] || 0) <= OPERATOR_PRESET.puntOwnMaxPct)
          const __rng = (seed) => { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
          const __nulls = [1, 2, 3, 4, 5].map(seed => { const r = __rng(seed); const pool2 = __cls.midPunt.slice(); const pick = new Set(); while (pick.size < Math.min(__elig.length, pool2.length)) pick.add(pool2[Math.floor(r() * pool2.length)]); return __arm({ ...OPERATOR_PRESET, puntEligible: pick }) })
          portfolio.operator = { ref: __ref, preset: __op, nullMean: __nulls.reduce((s2, x) => s2 + x.prize, 0) / __nulls.length, nullPrizes: __nulls.map(x => +x.prize.toFixed(2)), eligiblePunts: __elig, midPunts: __cls.midPunt, floor: __cls.floor }
        } catch (e) { portfolio.operator = { error: String((e && e.message) || e) } }
      } catch (e) { portfolio = { error: String((e && e.message) || e) } }

      // ---- OPERATOR ROW (2026-09-14): the operator's real entriesWanted for this race, captured by the
      // ownership ingest into dfs_operator_entries (his DK username only). Scored on the same ladder
      // and curve as the product rows, so the ledger finally carries the construction that beat both
      // solvers at Darlington 09-05 as a weekly number instead of a hand computation.
      let operator = null
      try {
        const { data: opRows } = await eqRace(supabase.from('dfs_operator_entries').select('contest_id,contest_type,entriesWanted,contest_entries,lineups,exposure,best_rank,best_points,mean_pct,above_median,prize').eq('series', sr).eq('race_year', year))
        if (opRows && opRows.length) {
          const tot = opRows.reduce((a, r) => a + (r.entriesWanted || 0), 0)
          const prize = opRows.reduce((a, r) => a + (+r.prize || 0), 0)
          const exAll = {}; opRows.forEach(r => r.lineups.forEach(l => l.drivers.forEach(d => { exAll[d] = (exAll[d] || 0) + 1 })))
          const bestRow = opRows.slice().sort((a, b) => (a.best_rank || 1e9) - (b.best_rank || 1e9))[0]
          // per-entry prize is the comparable unit: product rows are 3 x N (portfolio) or N (E[max] set)
          const perEntry = tot ? prize / tot : null
          const pfPer = portfolio && !portfolio.error && portfolio.entriesWanted ? portfolio.prize / portfolio.entriesWanted : null
          const basePer = portfolio && !portfolio.error && portfolio.legs && selN ? portfolio.basePrize / (portfolio.legs * selN) : null
          // PRODUCT AT THE OPERATOR'S N (2026-09-14, measurement fix 2): per-entry prize falls with N on a
          // top-heavy curve, so a 120-entry Portfolio row is not comparable to 20 real entriesWanted. Build the
          // product at exactly the operator's entry counts - one Portfolio leg per operator GPP contest
          // sized to its entriesWanted, and the plain E[max] set at the same sizes - and score on the same ladder.
          let atN = null
          try {
            const gppRows = opRows.filter(r => (r.contest_type || 'gpp') === 'gpp' && r.entriesWanted > 0)
            if (gppRows.length && gppRows.length <= 6) {
              const wantsN = gppRows.map(r => Math.max(1, Math.min(150, r.entriesWanted)))
              const __E2 = ent || 0
              const __prize2 = (() => { const R = Math.floor(0.2 * __E2); let Z = 0; for (let r = 1; r <= R; r++) Z += Math.pow(r, -0.75); return r => (__E2 && r >= 1 && r <= R) ? __E2 * Math.pow(r, -0.75) / Z : 0 })()
              const __score2 = (lus) => lus.reduce((s2, ns) => { const a = ns.reduce((t, n) => t + byName[n].actual, 0); const p = placeIn(ladder, __E2, a, topScores); return s2 + (p.rank ? __prize2(p.rank) : 0) }, 0)
              const __own2 = projectOwnership(pool)
              const pfN = buildPortfolio(
                { optimize, bestLineup, makeEmaxSelector, topUpLineups, enforceMinExposure, capFor: dfsCapFor, ROSTER: DFS_ROSTER, CAP: DFS_CAP },
                { rows: pool.map(d => ({ name: d.name, sal: d.sal, projDK: d.projDK })), samples: { drivers: names, rows: draws }, simCands: cands, legs: wantsN.length, want: Math.max.apply(null, wantsN), wants: wantsN,
                  rulesOn: portfolioRulesDefault(sr), schedule: 'all50', locks: new Set(), excludes: new Set(), userExpo: {}, projOwn: __own2 })
              const pfNPrize = pfN.legs.reduce((s2, l) => s2 + __score2(l.lineups.map(lu => lu.drivers.map(d => d.name))), 0)
              // plain E[max] set at each contest's N (fresh selector each, same candidates)
              let emaxPrize = 0, emaxEntries = 0
              wantsN.forEach(nk => { const selK = makeEmaxSelector(nC2, nD2, Smat, nk, cands, () => Infinity, DFS_ROSTER); selK.step(0); emaxPrize += __score2(selK.chosen.map(c2 => cands[c2])); emaxEntries += selK.chosen.length })
              const opGppEntries = gppRows.reduce((a, r) => a + r.entriesWanted, 0), opGppPrize = gppRows.reduce((a, r) => a + (+r.prize || 0), 0)
              atN = { wants: wantsN, pfEntries: pfN.total, pfPrize: +pfNPrize.toFixed(3), pfPer: pfN.total ? +(pfNPrize / pfN.total).toFixed(4) : null,
                emaxEntries, emaxPrize: +emaxPrize.toFixed(3), emaxPer: emaxEntries ? +(emaxPrize / emaxEntries).toFixed(4) : null,
                opEntries: opGppEntries, opPrize: +opGppPrize.toFixed(3), opPer: opGppEntries ? +(opGppPrize / opGppEntries).toFixed(4) : null,
                pfLegs: pfN.legs.map(l => l.lineups.length + (l.filled ? '(' + l.filled + 'f)' : '')).join('/'), pfFilled: pfN.legs.reduce((a, l) => a + (l.filled || 0), 0) }
            }
          } catch (e2) { atN = { error: String((e2 && e2.message) || e2) } }
          operator = { atN, contests: opRows.length, entries: tot, prize: +prize.toFixed(3), perEntry: perEntry != null ? +perEntry.toFixed(4) : null, pfPer: pfPer != null ? +pfPer.toFixed(4) : null, basePer: basePer != null ? +basePer.toFixed(4) : null,
            bestRank: bestRow.best_rank, bestPoints: bestRow.best_points, bestOf: bestRow.contest_entries, meanPct: opRows.length === 1 ? opRows[0].mean_pct : +(opRows.reduce((a, r) => a + (+r.mean_pct || 0) * r.entriesWanted, 0) / Math.max(1, tot)).toFixed(1),
            aboveMedian: opRows.reduce((a, r) => a + (r.above_median || 0), 0),
            exposure: Object.entriesWanted(exAll).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n, c]) => ({ name: n, pct: Math.round(100 * c / Math.max(1, tot)) })),
            byContest: opRows.map(r => ({ id: r.contest_id, type: r.contest_type, entries: r.entriesWanted, of: r.contest_entries, best: r.best_rank, meanPct: r.mean_pct, prize: +(+r.prize).toFixed(2) })) }
        }
      } catch (e) { operator = { error: String((e && e.message) || e) } }

      // ---- calibration
      const withOwn = pool.filter(d => d.own != null)
      const cal = {
        model: spearman(pool.map(d => d.projDK), pool.map(d => d.actual)),
        salary: spearman(pool.map(d => d.sal), pool.map(d => d.actual)),
        own: withOwn.length >= 3 ? spearman(withOwn.map(d => d.own), withOwn.map(d => d.actual)) : null,
        nOwn: withOwn.length,
      }
      const same = cash.drivers.map(d => d.name).sort().join('|') === gpp.drivers.map(d => d.name).sort().join('|')
      const verdict = same ? 'tie' : (gpp.actual > cash.actual ? 'gpp' : gpp.actual < cash.actual ? 'cash' : 'tie')

      // ---- OWNERSHIP ARM (2026-10-04, BACKTEST_LOG "ownership-aware GPP objective"; report only, not saved).
      // A = E[max points] on Smat (ships). B = E[max prize] on Pmat: per draw, the field's lineup score
      // from projected ownership (mean F, variance V, independent inclusion), the candidate's percentile
      // Phi((S - F) / sqrt(V + 1)), rank in the real contest, prize on the DK-like curve. Same selector,
      // same candidates and draws. N = 20 and 70.
      let ownership = null
      try {
        if (ent) {
          const __E4 = ent
          const __prize4 = (() => { const R = Math.floor(0.2 * __E4); let Z = 0; for (let r = 1; r <= R; r++) Z += Math.pow(r, -0.75); return r => (__E4 && r >= 1 && r <= R) ? __E4 * Math.pow(r, -0.75) / Z : 0 })()
          const __score4 = (lus) => lus.reduce((s2, ns) => { const a = ns.reduce((t, n) => t + byName[n].actual, 0); const p = placeIn(ladder, __E4, a, topScores); return s2 + (p.rank ? __prize4(p.rank) : 0) }, 0)
          const __ownP = projectOwnership(pool)
          const pOf = names.map(n => Math.max(0.005, Math.min(0.95, (+__ownP[n] || 0) / 100)))
          const F = new Float64Array(nD2), V = new Float64Array(nD2)
          for (let d2 = 0; d2 < nD2; d2++) {
            const rw = drawRows[d2]; let f = 0, v = 0
            for (let i = 0; i < names.length; i++) { const sc = +rw[i] || 0; f += pOf[i] * sc; v += pOf[i] * (1 - pOf[i]) * sc * sc }
            F[d2] = f; V[d2] = v
          }
          const Phi = z => 0.5 * (1 + (z < 0 ? -1 : 1) * Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI)))   // Williams approx, |err| < .004
          const Pmat = new Float32Array(nC2 * nD2)
          for (let c2 = 0; c2 < nC2; c2++) { const off = c2 * nD2
            for (let d2 = 0; d2 < nD2; d2++) { const z = (Smat[off + d2] - F[d2]) / Math.sqrt(V[d2] + 1); const rk = Math.max(1, Math.round((1 - Phi(z)) * __E4)); Pmat[off + d2] = __prize4(rk) } }
          const meanOwn = (lus) => lus.length ? lus.reduce((s2, ns) => s2 + ns.reduce((t, n) => t + (+__ownP[n] || 0), 0) / ns.length, 0) / lus.length : null
          const topExpo = (lus) => { const ex = {}; lus.forEach(ns => ns.forEach(n => { ex[n] = (ex[n] || 0) + 1 })); return Object.entriesWanted(ex).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, c]) => n.split(' ').pop() + ' ' + Math.round(100 * c / lus.length)).join(', ') }
          ownership = { byN: {} }
          ;[20, 70].forEach(N => {
            const sA = makeEmaxSelector(nC2, nD2, Smat, N, cands, () => Infinity, DFS_ROSTER); sA.step(0)
            const sB = makeEmaxSelector(nC2, nD2, Pmat, N, cands, () => Infinity, DFS_ROSTER); sB.step(0)
            const A = sA.chosen.map(c2 => cands[c2]), B = sB.chosen.map(c2 => cands[c2])
            const bestA = Math.max.apply(null, A.map(ns => ns.reduce((t, n) => t + byName[n].actual, 0))), bestB = Math.max.apply(null, B.map(ns => ns.reduce((t, n) => t + byName[n].actual, 0)))
            ownership.byN[N] = { aPrize: +__score4(A).toFixed(3), bPrize: +__score4(B).toFixed(3), aBest: +bestA.toFixed(2), bBest: +bestB.toFixed(2), aOwn: +meanOwn(A).toFixed(1), bOwn: +meanOwn(B).toFixed(1), bDelivered: B.length, aExpo: topExpo(A), bExpo: topExpo(B) }
          })
        }
      } catch (e) { ownership = { error: String((e && e.message) || e) } }

      // ---- SATURATION ARM (2026-10-04, BACKTEST_LOG "E[max] set continuation"; report only, not saved).
      // A = levels 1 (ships), A-dup = A filled to N with duplicates of its first pick, B = levels 3.
      // Same candidates / draws / ladder / curve as the operator-N block. N = 70 and 100.
      let saturation = null
      try {
        if (ent) {
          const __E3 = ent
          const __prize3 = (() => { const R = Math.floor(0.2 * __E3); let Z = 0; for (let r = 1; r <= R; r++) Z += Math.pow(r, -0.75); return r => (__E3 && r >= 1 && r <= R) ? __E3 * Math.pow(r, -0.75) / Z : 0 })()
          const __score3 = (lus) => lus.reduce((s2, ns) => { const a = ns.reduce((t, n) => t + byName[n].actual, 0); const p = placeIn(ladder, __E3, a, topScores); return s2 + (p.rank ? __prize3(p.rank) : 0) }, 0)
          saturation = { byN: {} }
          ;[70, 100].forEach(N => {
            const sA = makeEmaxSelector(nC2, nD2, Smat, N, cands, () => Infinity, DFS_ROSTER, { levels: 1 }); sA.step(0)
            const sB = makeEmaxSelector(nC2, nD2, Smat, N, cands, () => Infinity, DFS_ROSTER, { levels: 3 }); sB.step(0)
            const A = sA.chosen.map(c2 => cands[c2]), B = sB.chosen.map(c2 => cands[c2])
            const dupFill = A.length && A.length < N ? Array.from({ length: N - A.length }, () => A[0]) : []
            saturation.byN[N] = {
              aDelivered: A.length, aPrize: +__score3(A).toFixed(3), aDupPrize: +__score3(A.concat(dupFill)).toFixed(3),
              bDelivered: B.length, bPrize: +__score3(B).toFixed(3), bLevel: sB.level, bLevelPicks: sB.levelPicks,
            }
          })
        }
      } catch (e) { saturation = { error: String((e && e.message) || e) } }

      const __res = {
        series: sr, year, race, track: trk, samplesAt: samp.created_at, boardAt: board && board.published_at, stage: board && board.stage,
        nDraws: nD, nPool: pool.length, nCands: cands.length, nScoreDraws: nS,
        cash, gpp, alt, perfect, contest, cal, verdict, unmatched, same,
        setN: setIdx.length, setUniq: setUniq.size, setEmax: sel.emax(), wantN: selN, portfolio, operator, saturation, ownership,
      }
      __res.summary = ((topScores ? 'Exact placement (top ' + topScores.length + ' scores stored). ' : 'DECILE placement only - re-upload this contest\'s standings file after running sql/dfs_operator_entries.sql for exact ranks. ') + 'Done. ' + cands.length.toLocaleString() + ' candidates, ' + nS.toLocaleString() +
        ' draws; GPP set of ' + setIdx.length + ' using ' + setUniq.size + ' unique drivers.' +
        (same ? ' Its best lineup is the cash lineup.' : '') +
        (__nOfficial ? ' Scored with official DK FPTS for ' + __nOfficial + ' of ' + pool.length + ' drivers' + (__ct ? ' (' + __ct + ' contest)' : '') + '.' : ' Scored with the hand DK formula (no official FPTS stored for this race).'))
      return __res
}

export function replayRow(res) {
  const luJson = (lu) => lu ? lu.drivers.map(d => ({ name: d.name, sal: d.sal, proj: +one(d.projDK), own: d.own, start: d.start, fin: d.fin, pts: +two(d.actual) })) : null
  const row = {
      series: res.series, race_year: res.year, race_number: res.race, track_name: res.track,
      board_published_at: res.boardAt || null, samples_created_at: res.samplesAt || null,
      cash_lineup: luJson(res.cash), cash_proj: res.cash.proj, cash_salary: res.cash.salary, cash_actual: res.cash.actual, cash_pct: res.cash.pct, cash_rank: res.cash.rank,
      gpp_lineup: luJson(res.gpp), gpp_proj: res.gpp.proj, gpp_ceil: res.gpp.ceil, gpp_salary: res.gpp.salary, gpp_actual: res.gpp.actual, gpp_pct: res.gpp.pct, gpp_rank: res.gpp.rank,
      gpp_alt: res.alt,
      perfect_lineup: luJson(res.perfect), perfect_actual: res.perfect ? res.perfect.actual : null, perfect_salary: res.perfect ? res.perfect.salary : null,
      contest_entries: res.contest ? res.contest.entries : null, contest_winner: res.contest ? res.contest.winner_score : null, contest_median: res.contest ? res.contest.median_score : null,
      rho_model: res.cal.model, rho_salary: res.cal.salary, rho_own: res.cal.own,
      verdict: res.verdict, n_candidates: res.nCands, n_draws: res.nDraws, n_pool: res.nPool,
      gpp_entries: res.setN, gpp_uniq: res.setUniq,
      // Engine era (2026-08-30, operator: "we just adopted a new dominator fastest lap spread ect
      // so those old runs were built on older DFS modeling"). Draws stored before the 2026-08-29
      // ships (SS dominator tilt v2 + SHORT/INT wreck-survival recalibration) came out of a
      // different model and must not be pooled with later rows as evidence about this one.
      engine_era: (res.samplesAt && new Date(res.samplesAt) >= new Date('2026-08-29T00:00:00Z')) ? 'post-0829' : 'pre-0829',
      unmatched: res.unmatched.length ? res.unmatched : null,
      notes: res.same ? 'GPP #1 == cash lineup' : null,
      portfolio_prize: res.portfolio && res.portfolio.prize != null ? +res.portfolio.prize.toFixed(3) : null,
      portfolio_base_prize: res.portfolio && res.portfolio.basePrize != null ? +res.portfolio.basePrize.toFixed(3) : null,
      portfolio_legs: res.portfolio && res.portfolio.legs != null ? res.portfolio.legs : null,
      portfolio_json: res.portfolio || null,
      operator_json: res.operator && !res.operator.error ? res.operator : null,
      operator_prize: res.operator && !res.operator.error ? res.operator.prize : null,
      operator_entries: res.operator && !res.operator.error ? res.operator.entries : null,
    }
  return row
}

export async function saveReplay(res) {
  const row = replayRow(res)
    let { error } = await supabase.from('dfs_replays').upsert(row, { onConflict: 'series,race_year,race_number' })
    let __legacy = false
    if (__missingCol(error)) {   // operator columns not migrated yet: save the row without them
      const { operator_json, operator_prize, operator_entries, ...rest } = row
      ;({ error } = await supabase.from('dfs_replays').upsert(rest, { onConflict: 'series,race_year,race_number' }))
      __legacy = true
    }
    if (error) throw new Error('Save failed: ' + error.message)
    return { legacy: __legacy }
}

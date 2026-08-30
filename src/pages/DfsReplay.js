import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { optimize, bestLineup, DFS_ROSTER } from './DFSPage'

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

const SERIES = [{ v: 'cup', label: 'Cup' }, { v: 'oreilly', label: "O'Reilly" }, { v: 'trucks', label: 'Trucks' }]
const DKTBL = [0, 45, 42, 41, 40, 39, 38, 37, 36, 35, 34, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]

const nrm = (x) => (x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
const one = (n) => (n == null || isNaN(n) ? '—' : Number(n).toFixed(1))
const two = (n) => (n == null || isNaN(n) ? '—' : Number(n).toFixed(2))
const money = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString())

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
function placeIn(ladder, entries, score) {
  if (!ladder || ladder.length < 2 || score == null) return { pct: null, rank: null }
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

const card = { background: 'var(--bg-card, #14161b)', border: '1px solid var(--border, #22252b)', borderRadius: 10, padding: 14, marginBottom: 14 }
const lbl = { color: 'var(--text-muted, #6b7078)', fontSize: 11, letterSpacing: 0.3, textTransform: 'uppercase' }

function LineupCard({ title, lu, tone }) {
  if (!lu) return null
  return (
    <div style={{ flex: '1 1 340px', minWidth: 320, border: '1px solid var(--border, #22252b)', borderRadius: 9, padding: 12, background: 'var(--bg, #0e0f13)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <strong style={{ color: tone || 'var(--text-primary, #e8eaed)', fontSize: 14 }}>{title}</strong>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-secondary, #9aa0aa)' }}>
          proj {one(lu.proj)}{lu.ceil != null ? ' · p90 ' + one(lu.ceil) : ''} · {money(lu.salary)}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <strong style={{ fontSize: 22, color: 'var(--accent, #e11d2a)' }}>{two(lu.actual)}</strong>
        <span style={{ color: 'var(--text-secondary, #9aa0aa)', fontSize: 13 }}>
          {lu.rank ? '~' + lu.rank.toLocaleString() + (lu.entries ? ' / ' + lu.entries.toLocaleString() : '') : ''}
          {lu.pct != null ? '  (' + (100 - lu.pct).toFixed(1) + '% from top)' : ''}
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <tbody>
          {lu.drivers.slice().sort((a, b) => (b.actual || 0) - (a.actual || 0)).map((d, i) => (
            <tr key={d.name} style={{ borderTop: i ? '1px solid var(--border, #1c1f25)' : 'none' }}>
              <td style={{ padding: '3px 4px', color: 'var(--text-primary, #e8eaed)' }}>{d.name}</td>
              <td style={{ padding: '3px 4px', textAlign: 'right', color: 'var(--text-muted, #6b7078)' }}>{money(d.sal)}</td>
              <td style={{ padding: '3px 4px', textAlign: 'right', color: 'var(--text-muted, #6b7078)' }}>{one(d.projDK)}</td>
              <td style={{ padding: '3px 4px', textAlign: 'right', color: 'var(--text-muted, #6b7078)' }}>{d.own != null ? one(d.own) + '%' : '—'}</td>
              <td style={{ padding: '3px 4px', textAlign: 'right', color: 'var(--text-secondary, #9aa0aa)' }}>
                {d.start != null ? 'P' + d.start : '—'}{'→'}{d.fin != null ? 'P' + d.fin : '—'}
              </td>
              <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 700 }}>{two(d.actual)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ ...lbl, marginTop: 6 }}>name · salary · proj · own · start→fin · actual</div>
    </div>
  )
}

export default function DfsReplay() {
  const [races, setRaces] = useState([])
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [prog, setProg] = useState('')
  const [msg, setMsg] = useState('')
  const [res, setRes] = useState(null)
  const [ledger, setLedger] = useState([])
  const [saved, setSaved] = useState(false)

  const loadLedger = () => supabase.from('dfs_replays')
    .select('series,race_year,race_number,track_name,cash_actual,cash_rank,gpp_actual,gpp_rank,perfect_actual,contest_entries,contest_median,rho_model,rho_salary,rho_own,verdict,created_at')
    .order('race_year', { ascending: false }).order('race_number', { ascending: false, nullsFirst: false })
    .limit(50).then(({ data }) => setLedger(data || []))

  useEffect(() => {
    supabase.from('dfs_sim_samples').select('series,race_year,race_number,track_name,created_at')
      .order('race_year', { ascending: false }).order('race_number', { ascending: false, nullsFirst: false })
      .limit(60)
      .then(({ data }) => {
        const rs = data || []
        setRaces(rs)
        if (rs.length) setPick(rs[0].series + '|' + rs[0].race_year + '|' + (rs[0].race_number == null ? '' : rs[0].race_number))
      })
    loadLedger()
  }, [])

  const run = async () => {
    setBusy(true); setRes(null); setSaved(false); setMsg(''); setProg('Loading…')
    try {
      const [sr, yr, rn] = pick.split('|')
      const year = +yr, race = rn === '' ? null : +rn
      const eqRace = (q) => (race == null ? q.is('race_number', null) : q.eq('race_number', race))

      // ---- samples (the pre-lock draws)
      const { data: sampRows } = await eqRace(supabase.from('dfs_sim_samples').select('drivers,samples,track_name,created_at').eq('series', sr).eq('race_year', year))
        .order('created_at', { ascending: false }).limit(1)
      const samp = sampRows && sampRows[0]
      if (!samp || !samp.drivers || !samp.samples || !samp.samples.length) { setMsg('No stored sim samples for that race — the board has to be published with samples to be replayable.'); setBusy(false); return }
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
      if (!Object.keys(salaries).length) { setMsg('No DK salary file stored for that race.'); setBusy(false); return }

      // ---- actual finish (races -> loop_data; races.race_number is the season R#)
      const trk = samp.track_name || (board && board.track_name)
      const { data: raceRows } = await supabase.from('races').select('id,race_number').eq('series', sr).eq('year', year).eq('track_name', trk)
      let target = null
      if (raceRows && raceRows.length === 1) target = raceRows[0]
      else if (raceRows && raceRows.length > 1) target = raceRows.find(r => String(r.race_number) === String(race)) || null
      if (!target) { setMsg('No races row for ' + trk + ' ' + year + ' — load the race in Admin first.'); setBusy(false); return }
      const { data: laps } = await supabase.from('loop_data').select('driver_name,finish_position,start_position,laps_led,fastest_laps').eq('race_id', target.id)
      if (!laps || !laps.length) { setMsg('No loop data for that race yet — load the finish first.'); setBusy(false); return }
      const actByN = {}
      laps.forEach(l => {
        actByN[nrm(l.driver_name)] = {
          pts: dkPoints(l.finish_position, l.start_position, l.laps_led, l.fastest_laps),
          fin: l.finish_position == null ? null : Math.round(+l.finish_position),
          start: l.start_position == null ? null : Math.round(+l.start_position),
        }
      })

      // ---- contest + ownership (post-race, operator uploads)
      const { data: conRows } = await eqRace(supabase.from('dfs_contests').select('entries,winner_score,median_score,scores_sample,contest_type').eq('series', sr).eq('race_year', year))
        .order('entries', { ascending: false }).limit(1)
      const contest = conRows && conRows[0]
      const { data: ownRows } = await eqRace(supabase.from('dfs_ownership').select('driver_name,own_pct').eq('series', sr).eq('race_year', year))
      const ownByN = {}
      ;(ownRows || []).forEach(o => { ownByN[nrm(o.driver_name)] = +o.own_pct })

      // ---- pool: board drivers that DK actually priced
      const outSet = new Set(salaries.__out || [])
      const projByName = {}
      if (board && board.results) board.results.forEach(d => { projByName[d.driver_name] = +d.proj_dk || 0 })
      const idxOf = {}
      names.forEach((n, i) => { idxOf[n] = i })
      const nD = draws.length
      const meanOf = (i) => { let s = 0; for (let k = 0; k < nD; k++) s += draws[k][i] || 0; return s / nD }
      const pool = [], unmatched = []
      names.forEach((n, i) => {
        const sal = outSet.has(n) ? 0 : (salaries[n] || 0)
        if (!(sal > 0)) return
        const a = actByN[nrm(n)]
        if (!a || a.pts == null) { unmatched.push(n); return }
        pool.push({ name: n, idx: i, sal, projDK: projByName[n] != null ? projByName[n] : meanOf(i), actual: a.pts, fin: a.fin, start: a.start, own: ownByN[nrm(n)] != null ? ownByN[nrm(n)] : null })
      })
      if (pool.length < DFS_ROSTER) { setMsg('Only ' + pool.length + ' drivers have both a salary and a result — cannot build a lineup.'); setBusy(false); return }

      const sumA = (ds) => ds.reduce((s, d) => s + d.actual, 0)
      const sumS = (ds) => ds.reduce((s, d) => s + d.sal, 0)
      const sumP = (ds) => ds.reduce((s, d) => s + d.projDK, 0)
      const ladder = contest && Array.isArray(contest.scores_sample) ? contest.scores_sample : null
      const ent = contest ? contest.entries : null
      const decorate = (ds, ceil) => {
        const actual = sumA(ds)
        const p = placeIn(ladder, ent, actual)
        return { drivers: ds, proj: sumP(ds), ceil, salary: sumS(ds), actual, pct: p.pct, rank: p.rank, entries: ent }
      }

      // ---- CASH: the product's own mean optimizer, deep enough to double as GPP coverage
      const cashRes = optimize(pool.map(d => ({ name: d.name, sal: d.sal, projDK: d.projDK })), new Set(), new Set(), 300)
      if (cashRes.error) { setMsg(cashRes.error); setBusy(false); return }
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
          setProg('Solving per-draw optimals… ' + si.toLocaleString() + ' / ' + nD.toLocaleString() + ' draws, ' + candMap.size.toLocaleString() + ' candidates')
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
          setProg('Scoring ceilings… ' + ci.toLocaleString() + ' / ' + cands.length.toLocaleString() + ' candidates')
          if (ci < cands.length) setTimeout(step2, 0); else resolve()
        }
        step2()
      })
      scored.sort((a, b) => b.ceil - a.ceil)
      const gpp = decorate(scored[0].names.map(n => byName[n]), scored[0].ceil)
      const alt = scored.slice(1, 3).map(s => ({ names: s.names, ceil: s.ceil, actual: sumA(s.names.map(n => byName[n])) }))

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

      setRes({
        series: sr, year, race, track: trk, samplesAt: samp.created_at, boardAt: board && board.published_at, stage: board && board.stage,
        nDraws: nD, nPool: pool.length, nCands: cands.length, nScoreDraws: nS,
        cash, gpp, alt, perfect, contest, cal, verdict, unmatched, same,
      })
      setProg('')
      setMsg(same
        ? 'GPP ranking returned the cash lineup as its #1 — the two modes are identical on this slate.'
        : 'Done. ' + cands.length.toLocaleString() + ' candidates scored across ' + nS.toLocaleString() + ' draws.')
    } catch (e) {
      setMsg('Replay failed: ' + (e.message || e))
      setProg('')
    }
    setBusy(false)
  }

  const save = async () => {
    if (!res) return
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
      unmatched: res.unmatched.length ? res.unmatched : null,
      notes: res.same ? 'GPP #1 == cash lineup' : null,
    }
    const { error } = await supabase.from('dfs_replays').upsert(row, { onConflict: 'series,race_year,race_number' })
    if (error) setMsg('Save failed: ' + error.message)
    else { setSaved(true); setMsg('Saved to the replay ledger.'); loadLedger() }
  }

  const tally = ledger.reduce((a, r) => { if (r.verdict) a[r.verdict] = (a[r.verdict] || 0) + 1; return a }, {})

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0, color: 'var(--text-primary, #e8eaed)' }}>DFS Replay</h2>
      <p style={{ color: 'var(--text-secondary, #9aa0aa)', fontSize: 13, marginTop: 0 }}>
        Rebuilds both DFS Center modes from the pre-lock sim draws, scores them against the real
        finish and places them in the contest you uploaded. Needs: a published board with samples,
        the DK salary file, loop data loaded, and the contest + ownership upload.
      </p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <select value={pick} onChange={e => { setPick(e.target.value); setRes(null); setMsg('') }}
          style={{ padding: '7px 9px', borderRadius: 6, background: 'var(--bg, #0e0f13)', color: 'var(--text-primary, #e8eaed)', border: '1px solid var(--border, #22252b)', minWidth: 340 }}>
          {races.map(r => {
            const v = r.series + '|' + r.race_year + '|' + (r.race_number == null ? '' : r.race_number)
            const s = SERIES.find(x => x.v === r.series)
            return <option key={v + r.created_at} value={v}>{(s ? s.label : r.series) + ' ' + r.race_year + (r.race_number != null ? ' R' + r.race_number : '') + ' — ' + (r.track_name || '?')}</option>
          })}
        </select>
        <button onClick={run} disabled={busy || !pick}
          style={{ padding: '8px 16px', borderRadius: 6, border: 'none', fontWeight: 700, cursor: busy ? 'default' : 'pointer', background: busy ? '#444' : 'var(--accent, #e11d2a)', color: '#fff' }}>
          {busy ? 'Running…' : 'Run replay'}
        </button>
        {res && !saved && <button onClick={save} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border, #22252b)', background: 'transparent', color: 'var(--text-primary, #e8eaed)', cursor: 'pointer' }}>Save to ledger</button>}
      </div>
      {prog && <div style={{ color: 'var(--text-secondary, #9aa0aa)', fontSize: 12.5, marginBottom: 8 }}>{prog}</div>}
      {msg && <div style={{ color: saved ? '#4ade80' : 'var(--text-secondary, #9aa0aa)', fontSize: 13, marginBottom: 10 }}>{msg}</div>}

      {res && (
        <div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-secondary, #9aa0aa)', marginBottom: 12 }}>
            <span><span style={lbl}>leak check </span>samples {new Date(res.samplesAt).toLocaleString()}{res.boardAt ? ' · board ' + res.stage + ' ' + new Date(res.boardAt).toLocaleString() : ''}</span>
            <span><span style={lbl}>pool </span>{res.nPool} priced &amp; finished</span>
            <span><span style={lbl}>draws </span>{res.nDraws.toLocaleString()}</span>
            <span><span style={lbl}>candidates </span>{res.nCands.toLocaleString()} @ {res.nScoreDraws.toLocaleString()} draws</span>
          </div>
          {!!res.unmatched.length && (
            <div style={{ background: 'rgba(245,166,35,0.10)', border: '1px solid rgba(245,166,35,0.35)', borderRadius: 7, padding: '8px 10px', fontSize: 12.5, color: '#f5a623', marginBottom: 12 }}>
              {res.unmatched.length} priced driver{res.unmatched.length === 1 ? '' : 's'} had no matching finish and {res.unmatched.length === 1 ? 'was' : 'were'} left out of the pool: {res.unmatched.join(', ')}.
              {' '}Expected for a withdrawal or a late substitute DK never priced — otherwise it is a name-join miss worth fixing.
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <LineupCard title="Cash (mean-optimal)" lu={res.cash} />
            <LineupCard title={'GPP #1 (p90 ceiling)' + (res.same ? ' — same lineup' : '')} lu={res.gpp} tone={res.same ? undefined : 'var(--series-oreilly, #f5a623)'} />
            <LineupCard title="Perfect (hindsight)" lu={res.perfect} tone="#4ade80" />
          </div>

          {!!res.alt.length && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary, #9aa0aa)', marginBottom: 12 }}>
              {res.alt.map((a, i) => <div key={i}>GPP #{i + 2}: p90 {one(a.ceil)} → actual {two(a.actual)} ({a.names.join(', ')})</div>)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 13, marginBottom: 10 }}>
            <div><div style={lbl}>verdict</div><strong style={{ color: res.verdict === 'gpp' ? '#4ade80' : res.verdict === 'cash' ? '#f5a623' : 'var(--text-primary, #e8eaed)' }}>
              {res.verdict === 'tie' ? 'TIE' : res.verdict.toUpperCase() + ' wins by ' + two(Math.abs(res.gpp.actual - res.cash.actual))}
            </strong></div>
            {res.contest && <div><div style={lbl}>contest</div>{res.contest.entries ? res.contest.entries.toLocaleString() + ' entries · ' : ''}median {two(res.contest.median_score)} · winner {two(res.contest.winner_score)}</div>}
            <div><div style={lbl}>ρ model</div>{res.cal.model == null ? '—' : res.cal.model.toFixed(3)}</div>
            <div><div style={lbl}>ρ DK salary</div>{res.cal.salary == null ? '—' : res.cal.salary.toFixed(3)}</div>
            <div><div style={lbl}>ρ ownership</div>{res.cal.own == null ? '— (no upload)' : res.cal.own.toFixed(3) + ' (n=' + res.cal.nOwn + ')'}</div>
          </div>
          <div style={{ ...lbl, marginBottom: 14 }}>ρ = Spearman of each ranking against actual DK points. Ownership above the model means the crowd out-ranked us.</div>
        </div>
      )}

      <h3 style={{ color: 'var(--text-primary, #e8eaed)', fontSize: 15, marginBottom: 6 }}>
        Replay ledger {ledger.length ? <span style={{ ...lbl, fontWeight: 400 }}>— GPP {tally.gpp || 0} · cash {tally.cash || 0} · tie {tally.tie || 0}</span> : null}
      </h3>
      {!ledger.length && <div style={{ color: 'var(--text-muted, #6b7078)', fontSize: 13 }}>No saved replays yet.</div>}
      {!!ledger.length && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: 'var(--text-muted, #6b7078)', textAlign: 'right' }}>
                <th style={{ textAlign: 'left', padding: '5px 6px' }}>Race</th>
                <th style={{ padding: '5px 6px' }}>Cash</th><th style={{ padding: '5px 6px' }}>GPP</th>
                <th style={{ padding: '5px 6px' }}>Median</th><th style={{ padding: '5px 6px' }}>Perfect</th>
                <th style={{ padding: '5px 6px' }}>ρ model</th><th style={{ padding: '5px 6px' }}>ρ sal</th><th style={{ padding: '5px 6px' }}>ρ own</th>
                <th style={{ padding: '5px 6px' }}>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border, #1c1f25)', textAlign: 'right', color: 'var(--text-secondary, #9aa0aa)' }}>
                  <td style={{ textAlign: 'left', padding: '5px 6px', color: 'var(--text-primary, #e8eaed)' }}>
                    {r.series} {r.race_year}{r.race_number != null ? ' R' + r.race_number : ''} · {r.track_name}
                  </td>
                  <td style={{ padding: '5px 6px' }}>{two(r.cash_actual)}{r.cash_rank ? <span style={{ color: 'var(--text-muted, #6b7078)' }}> ({r.cash_rank.toLocaleString()})</span> : null}</td>
                  <td style={{ padding: '5px 6px' }}>{two(r.gpp_actual)}{r.gpp_rank ? <span style={{ color: 'var(--text-muted, #6b7078)' }}> ({r.gpp_rank.toLocaleString()})</span> : null}</td>
                  <td style={{ padding: '5px 6px' }}>{two(r.contest_median)}</td>
                  <td style={{ padding: '5px 6px' }}>{two(r.perfect_actual)}</td>
                  <td style={{ padding: '5px 6px' }}>{r.rho_model == null ? '—' : (+r.rho_model).toFixed(3)}</td>
                  <td style={{ padding: '5px 6px' }}>{r.rho_salary == null ? '—' : (+r.rho_salary).toFixed(3)}</td>
                  <td style={{ padding: '5px 6px' }}>{r.rho_own == null ? '—' : (+r.rho_own).toFixed(3)}</td>
                  <td style={{ padding: '5px 6px', fontWeight: 700, color: r.verdict === 'gpp' ? '#4ade80' : r.verdict === 'cash' ? '#f5a623' : 'var(--text-secondary, #9aa0aa)' }}>{(r.verdict || '').toUpperCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

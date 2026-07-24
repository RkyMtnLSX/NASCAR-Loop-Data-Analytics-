import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const SERIES = [{ v: 'cup', label: 'Cup' }, { v: 'oreilly', label: "O'Reilly" }, { v: 'trucks', label: 'Trucks' }]
const CAP = 50000
const ROSTER = 6

function optimize(pool, locks, excludes, K) {
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

function applyExposure(ranked, want, maxExp) {
  if (maxExp >= 1) return ranked.slice(0, want)
  const capCount = Math.max(1, Math.floor(want * maxExp))
  const used = {}, picked = []
  for (const lu of ranked) {
    if (picked.length >= want) break
    if (lu.drivers.some(d => (used[d.name] || 0) >= capCount)) continue
    picked.push(lu); lu.drivers.forEach(d => { used[d.name] = (used[d.name] || 0) + 1 })
  }
  return picked
}

function bestLineup(pool) {
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
  const [maxExp, setMaxExp] = useState(1)
  const [lineups, setLineups] = useState([])
  const [optPct, setOptPct] = useState({})
  const [building, setBuilding] = useState(false)
  const [note, setNote] = useState('')
  const [sortKey, setSortKey] = useState('value')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    let alive = true
    setLoading(true); setLineups([]); setOptPct({}); setLocks(new Set()); setExcludes(new Set()); setSalaries({}); setSamples(null); setNote('')
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
        lapsLed: +d.laps_led || 0, avgFast: +d.avg_fast_laps || 0, startPos: +d.start_pos || 0
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

  const rows = useMemo(() => drivers.map(d => {
    const sal = salaries[d.name] || 0
    const value = sal > 0 ? d.projDK / (sal / 1000) : 0
    return { ...d, sal, value, opt: optPct[d.name] || 0 }
  }), [drivers, salaries, optPct])

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
  const build = () => {
    setBuilding(true); setLineups([]); setNote('')
    setTimeout(() => {
      const pool = rows.map(r => ({ name: r.name, car: r.car, sal: r.sal, projDK: r.projDK }))
      const K = Math.min(500, Math.max(numLineups * 6, 60))
      const res = optimize(pool, locks, excludes, K)
      if (res.error) { setNote(res.error); setBuilding(false); return }
      setLineups(applyExposure(res.lineups, numLineups, maxExp))
      if (samples && samples.drivers && samples.rows && samples.rows.length) {
        // 2026-07-23: chunked so 10k exact solves do not freeze the tab; progress in note
        const cnt = {}, nS = samples.rows.length
        const salByIdx = samples.drivers.map(nm => salaries[nm] || 0)
        let si = 0
        const CHUNK = 400
        const step = () => {
          const end = Math.min(nS, si + CHUNK)
          for (; si < end; si++) {
            const rowS = samples.rows[si], p = []
            for (let j = 0; j < samples.drivers.length; j++) { const sal = salByIdx[j]; if (sal > 0) p.push({ name: samples.drivers[j], sal, val: rowS[j] }) }
            const lu = bestLineup(p)
            if (lu) lu.forEach(nm => { cnt[nm] = (cnt[nm] || 0) + 1 })
          }
          if (si < nS) { setNote('Computing Optimal% ' + Math.round(si / nS * 100) + '%...'); setTimeout(step, 0) }
          else {
            const op = {}; Object.keys(cnt).forEach(nm => { op[nm] = cnt[nm] / nS * 100 })
            setOptPct(op)
            setNote('')
            setBuilding(false)
          }
        }
        step()
        return
      }
      setBuilding(false)
    }, 30)
  }

  const exportCsv = () => {
    if (!lineups.length) return
    const ids = (salaries && salaries.__ids) || {}
    const missing = new Set()
    const rows2 = lineups.map(lu => lu.drivers.map(d => { const id = ids[d.name]; if (!id) missing.add(d.name); return id ? (d.name + ' (' + id + ')') : d.name }).join(','))
    const csv = 'D,D,D,D,D,D\n' + rows2.join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'pitboard_dk_' + series + '_lineups.csv'
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
            style={{ padding: '7px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border,#2a2d34)', background: series === s.v ? 'var(--accent,#e11d2a)' : 'transparent', color: series === s.v ? '#fff' : 'var(--text-secondary,#9aa0aa)' }}>
            {s.label}
          </button>
        ))}
        {race && <span style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 13 }}>{race.track} &middot; {race.year} &middot; Race {race.rn}</span>}
      </div>

      {loading && <div style={{ color: 'var(--text-secondary,#9aa0aa)' }}>Loading projections\u2026</div>}
      {!loading && !drivers.length && <div style={card}>No published simulation found for this series yet.</div>}

      {!loading && drivers.length > 0 && <>
        <div style={card}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>Lineups<br /><input type="number" value={numLineups} min={1} max={150} onChange={e => setNumLineups(Math.max(1, Math.min(150, +e.target.value || 1)))} style={{ width: 70, marginTop: 4, background: 'var(--bg,#0e0f13)', color: 'var(--text,#e8eaed)', border: '1px solid var(--border,#2a2d34)', borderRadius: 6, padding: '5px 7px' }} /></label>
            <label style={{ fontSize: 13 }}>Max exposure<br /><select value={maxExp} onChange={e => setMaxExp(+e.target.value)} style={{ marginTop: 4, background: 'var(--bg,#0e0f13)', color: 'var(--text,#e8eaed)', border: '1px solid var(--border,#2a2d34)', borderRadius: 6, padding: '5px 7px' }}>
              <option value={1}>No cap</option><option value={0.75}>75%</option><option value={0.6}>60%</option><option value={0.5}>50%</option><option value={0.4}>40%</option>
            </select></label>
            <button onClick={build} disabled={building || !canBuild} style={{ padding: '8px 18px', borderRadius: 8, cursor: building || !canBuild ? 'not-allowed' : 'pointer', border: 'none', background: !canBuild ? 'var(--border,#2a2d34)' : 'var(--accent,#e11d2a)', color: '#fff', fontWeight: 600 }}>
              {building ? 'Building\u2026' : 'Build lineups'}
            </button>
            {lineups.length > 0 && <button onClick={exportCsv} style={{ padding: '8px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--accent,#e11d2a)', background: 'transparent', color: 'var(--accent,#e11d2a)', fontWeight: 600 }}>Export DK CSV</button>}
            <span style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 12 }}>{canBuild ? 'Cap $50,000 \u00b7 6 drivers \u00b7 Lock/Excl to steer' + (samples ? ' \u00b7 Optimal% from ' + samples.rows.length + ' sims' : '') : 'Salaries not posted yet'}</span>
            {note && <span style={{ color: 'var(--accent,#e11d2a)', fontSize: 12 }}>{note}</span>}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ color: 'var(--text-secondary,#9aa0aa)' }}>
                <th style={{ padding: '7px 8px', textAlign: 'left' }}>Lock/Excl</th>
                {th('name', 'Driver', 'left')}{th('sal', 'Salary')}{th('projDK', 'Proj DK')}{th('value', 'Value')}{th('opt', 'Optimal%')}
                {th('winPct', 'Win%')}{th('lapsLed', 'Laps Led')}{th('avgFast', 'Fast Laps')}{th('projFinish', 'Proj Fin')}
                <th style={{ padding: '7px 8px', textAlign: 'right' }}>Expo</th>
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
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>{d.car ? '#' + d.car + ' ' : ''}{d.name}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>{d.sal ? '$' + d.sal.toLocaleString() : '\u2014'}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>{d.projDK.toFixed(1)}</td>
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

        {lineups.length > 0 && <div style={card}>
          <div style={{ marginBottom: 10 }}><strong>{lineups.length} lineup{lineups.length === 1 ? '' : 's'}</strong> <span style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 13 }}>ranked by projected DK points</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ color: 'var(--text-secondary,#9aa0aa)' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>#</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Drivers</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Salary</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Proj DK</th>
              </tr></thead>
              <tbody>
                {lineups.map((lu, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border,#22252b)' }}>
                    <td style={{ padding: '5px 8px', color: 'var(--text-secondary,#9aa0aa)' }}>{i + 1}</td>
                    <td style={{ padding: '5px 8px' }}>{lu.drivers.slice().sort((a, b) => b.projDK - a.projDK).map(d => (d.car ? '#' + d.car + ' ' : '') + d.name).join(',  ')}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right' }}>{'$' + lu.salary.toLocaleString()}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>{lu.proj.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>}
      </>}
    </div>
  )
}

import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const SERIES = [{ v: 'cup', label: 'Cup' }, { v: 'oreilly', label: "O'Reilly" }, { v: 'trucks', label: 'Trucks' }]
const CAP = 50000
const ROSTER = 6

const norm = (s) => (s || '').toString().toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim()

function parseSalaries(text, drivers) {
  const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const out = {}, unmatched = []
  const byNorm = {}, byLast = {}
  drivers.forEach(d => { const n = norm(d.name); byNorm[n] = d.name; const p = n.split(' '); if (p.length) byLast[p[p.length - 1]] = d.name })
  lines.forEach(line => {
    let name = null, sal = null
    const cells = line.includes(',') ? line.split(',') : line.split(/\t/)
    if (cells.length > 1) {
      for (const cell of cells) { const m = cell.replace(/[$,\s]/g, '').match(/^\d{4,5}$/); if (m) { const v = +m[0]; if (v >= 2000 && v <= 20000) { sal = v; break } } }
      for (const cell of cells) { const nc = norm(cell.replace(/\(.*\)/, '')); if (byNorm[nc]) { name = byNorm[nc]; break } }
    }
    if (sal === null) { const nums = line.replace(/[$,]/g, '').match(/\b\d{4,5}\b/g) || []; for (const x of nums) { const v = +x; if (v >= 2000 && v <= 20000) { sal = v; break } } }
    if (!name) { const nl = norm(line); for (const d of drivers) { if (nl.indexOf(norm(d.name)) >= 0) { name = d.name; break } } }
    if (!name) { const nl = norm(line); for (const last in byLast) { if (last.length > 2 && new RegExp('\\b' + last + '\\b').test(nl)) { name = byLast[last]; break } } }
    if (name && sal) out[name] = sal
    else if (sal && !name) unmatched.push(line.slice(0, 44))
  })
  return { out, unmatched }
}

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
  if (m < need) return { error: 'Not enough drivers with salaries entered.' }
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

export default function DFSPage() {
  const [series, setSeries] = useState('cup')
  const [race, setRace] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [salaries, setSalaries] = useState({})
  const [loading, setLoading] = useState(false)
  const [paste, setPaste] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [pasteMsg, setPasteMsg] = useState('')
  const [locks, setLocks] = useState(() => new Set())
  const [excludes, setExcludes] = useState(() => new Set())
  const [numLineups, setNumLineups] = useState(20)
  const [maxExp, setMaxExp] = useState(1)
  const [lineups, setLineups] = useState([])
  const [building, setBuilding] = useState(false)
  const [sortKey, setSortKey] = useState('value')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    let alive = true
    setLoading(true); setLineups([]); setLocks(new Set()); setExcludes(new Set())
    supabase.from('sim_results').select('track_name,race_year,race_number,results,published_at').eq('series', series).order('id', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (!alive) return
        const row = data && data[0]
        if (!row) { setDrivers([]); setRace(null); setLoading(false); return }
        setRace({ track: row.track_name, year: row.race_year, rn: row.race_number, at: row.published_at })
        const ds = (row.results || []).map(d => ({
          name: d.driver_name, car: d.car_number, mfr: d.manufacturer, org: d.organization,
          projDK: +d.proj_dk || 0, projFinish: +d.proj_finish || 0, winPct: +d.win_pct || 0,
          top5: +d.top5_pct || 0, lapsLed: +d.laps_led || 0, avgFast: +d.avg_fast_laps || 0,
          p25: +d.finish_p25 || 0, startPos: +d.start_pos || 0
        })).filter(d => d.name)
        setDrivers(ds); setLoading(false)
      })
    return () => { alive = false }
  }, [series])

  const rows = useMemo(() => drivers.map(d => {
    const sal = salaries[d.name] || 0
    const value = sal > 0 ? d.projDK / (sal / 1000) : 0
    const lev = d.projDK + d.lapsLed * 0.25 + d.winPct * 0.4
    return { ...d, sal, value, lev }
  }), [drivers, salaries])

  const sorted = useMemo(() => {
    const arr = rows.slice()
    arr.sort((a, b) => { const x = a[sortKey], y = b[sortKey]; const c = (x < y ? -1 : x > y ? 1 : 0); return sortDir === 'asc' ? c : -c })
    return arr
  }, [rows, sortKey, sortDir])

  const exposure = useMemo(() => {
    const c = {}; lineups.forEach(lu => lu.drivers.forEach(d => { c[d.name] = (c[d.name] || 0) + 1 }))
    return c
  }, [lineups])

  const setSal = (name, val) => setSalaries(s => ({ ...s, [name]: val === '' ? 0 : Math.round(+val) || 0 }))
  const toggle = (setFn, name) => setFn(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  const doPaste = () => {
    const { out, unmatched } = parseSalaries(paste, drivers)
    setSalaries(s => ({ ...s, ...out }))
    const n = Object.keys(out).length
    setPasteMsg('Matched ' + n + ' driver' + (n === 1 ? '' : 's') + '.' + (unmatched.length ? ' Unmatched rows: ' + unmatched.length + ' (edit salaries manually).' : ''))
  }
  const build = () => {
    setBuilding(true); setLineups([])
    setTimeout(() => {
      const pool = rows.map(r => ({ name: r.name, car: r.car, sal: r.sal, projDK: r.projDK }))
      const K = Math.min(500, Math.max(numLineups * 6, 60))
      const res = optimize(pool, locks, excludes, K)
      if (res.error) { setPasteMsg(res.error); setBuilding(false); return }
      setLineups(applyExposure(res.lineups, numLineups, maxExp))
      setBuilding(false)
    }, 30)
  }

  const salCount = Object.values(salaries).filter(v => v > 0).length
  const th = (key, label, align) => (
    <th onClick={() => { setSortKey(key); setSortDir(sortKey === key && sortDir === 'desc' ? 'asc' : 'desc') }}
      style={{ padding: '7px 8px', textAlign: align || 'right', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border,#333)', userSelect: 'none' }}>
      {label}{sortKey === key ? (sortDir === 'desc' ? ' \u25bc' : ' \u25b2') : ''}
    </th>
  )
  const card = { background: 'var(--card,#16181d)', border: '1px solid var(--border,#2a2d34)', borderRadius: 10, padding: 16, marginBottom: 16 }

  return (
    <div className="page" style={{ maxWidth: 1180, margin: '0 auto', padding: '18px 16px 60px' }}>
      <h1 style={{ margin: '0 0 4px' }}>DFS Optimizer</h1>
      <div style={{ color: 'var(--text-secondary,#9aa0aa)', marginBottom: 16, fontSize: 14 }}>
        DraftKings Classic projections from the latest published simulation. Paste your DK salary export or enter salaries manually, then build optimal lineups.
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
      {!loading && !drivers.length && <div style={card}>No published simulation found for this series yet. Publish a sim in the Sim Center first.</div>}

      {!loading && drivers.length > 0 && <>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div><strong>Salaries</strong> <span style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 13 }}>{salCount} of {drivers.length} entered</span></div>
            <button onClick={() => setShowPaste(v => !v)} style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border,#2a2d34)', background: 'transparent', color: 'var(--text,#e8eaed)' }}>
              {showPaste ? 'Hide paste' : 'Paste DK salary export'}
            </button>
          </div>
          {showPaste && <div style={{ marginTop: 10 }}>
            <textarea value={paste} onChange={e => setPaste(e.target.value)} placeholder="Paste the DraftKings salary CSV (or any Name, Salary rows) here\u2026"
              style={{ width: '100%', minHeight: 90, background: 'var(--bg,#0e0f13)', color: 'var(--text,#e8eaed)', border: '1px solid var(--border,#2a2d34)', borderRadius: 8, padding: 8, fontFamily: 'monospace', fontSize: 12 }} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
              <button onClick={doPaste} style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', border: 'none', background: 'var(--accent,#e11d2a)', color: '#fff' }}>Import salaries</button>
              {pasteMsg && <span style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 13 }}>{pasteMsg}</span>}
            </div>
          </div>}
        </div>

        <div style={card}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>Lineups<br /><input type="number" value={numLineups} min={1} max={150} onChange={e => setNumLineups(Math.max(1, Math.min(150, +e.target.value || 1)))} style={{ width: 70, marginTop: 4, background: 'var(--bg,#0e0f13)', color: 'var(--text,#e8eaed)', border: '1px solid var(--border,#2a2d34)', borderRadius: 6, padding: '5px 7px' }} /></label>
            <label style={{ fontSize: 13 }}>Max exposure<br /><select value={maxExp} onChange={e => setMaxExp(+e.target.value)} style={{ marginTop: 4, background: 'var(--bg,#0e0f13)', color: 'var(--text,#e8eaed)', border: '1px solid var(--border,#2a2d34)', borderRadius: 6, padding: '5px 7px' }}>
              <option value={1}>No cap</option><option value={0.75}>75%</option><option value={0.6}>60%</option><option value={0.5}>50%</option><option value={0.4}>40%</option>
            </select></label>
            <button onClick={build} disabled={building || salCount < ROSTER} style={{ padding: '8px 18px', borderRadius: 8, cursor: building || salCount < ROSTER ? 'not-allowed' : 'pointer', border: 'none', background: salCount < ROSTER ? 'var(--border,#2a2d34)' : 'var(--accent,#e11d2a)', color: '#fff', fontWeight: 600 }}>
              {building ? 'Building\u2026' : 'Build lineups'}
            </button>
            <span style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 12 }}>Cap $50,000 &middot; 6 drivers &middot; click Lock/Excl in the table</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ color: 'var(--text-secondary,#9aa0aa)' }}>
                <th style={{ padding: '7px 8px', textAlign: 'left' }}>Lock/Excl</th>
                {th('name', 'Driver', 'left')}{th('sal', 'Salary')}{th('projDK', 'Proj DK')}{th('value', 'Value')}
                {th('winPct', 'Win%')}{th('lapsLed', 'Laps Led')}{th('avgFast', 'Fast Laps')}{th('projFinish', 'Proj Fin')}
                <th style={{ padding: '7px 8px', textAlign: 'right' }}>Expo</th>
              </tr></thead>
              <tbody>
                {sorted.map(d => {
                  const locked = locks.has(d.name), excl = excludes.has(d.name)
                  const vBg = d.value >= 4 ? 'rgba(46,160,67,0.28)' : d.value >= 3 ? 'rgba(46,160,67,0.14)' : 'transparent'
                  return (
                    <tr key={d.name} style={{ borderBottom: '1px solid var(--border,#22252b)', opacity: excl ? 0.4 : 1 }}>
                      <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => toggle(setLocks, d.name)} title="Lock" style={{ marginRight: 4, padding: '2px 7px', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--border,#2a2d34)', background: locked ? 'var(--accent,#e11d2a)' : 'transparent', color: locked ? '#fff' : 'var(--text-secondary,#9aa0aa)' }}>L</button>
                        <button onClick={() => toggle(setExcludes, d.name)} title="Exclude" style={{ padding: '2px 7px', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--border,#2a2d34)', background: excl ? '#555' : 'transparent', color: '#fff' }}>X</button>
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>{d.car ? '#' + d.car + ' ' : ''}{d.name}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                        <input value={d.sal || ''} onChange={e => setSal(d.name, e.target.value)} placeholder="\u2014"
                          style={{ width: 62, textAlign: 'right', background: 'var(--bg,#0e0f13)', color: 'var(--text,#e8eaed)', border: '1px solid var(--border,#2a2d34)', borderRadius: 5, padding: '3px 5px' }} />
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>{d.projDK.toFixed(1)}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', background: vBg, fontWeight: 600 }}>{d.value ? d.value.toFixed(2) : '\u2014'}</td>
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
                    <td style={{ padding: '5px 8px', textAlign: 'right', color: lu.salary > CAP ? 'var(--accent,#e11d2a)' : 'inherit' }}>{'$' + lu.salary.toLocaleString()}</td>
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

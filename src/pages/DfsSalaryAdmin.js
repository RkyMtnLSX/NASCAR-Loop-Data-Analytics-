import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const SERIES = [{ v: 'cup', label: 'Cup' }, { v: 'oreilly', label: "O'Reilly" }, { v: 'trucks', label: 'Trucks' }]
const norm = (s) => (s || '').toString().toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim()

function parseSalaries(text, drivers) {
  const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const out = {}, unmatched = [], ids = {}   // ids: DK player IDs from 'Name (12345678)' or ID columns
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
    if (name && sal) { out[name] = sal; const idm = line.match(/\((\d{6,10})\)/) || line.replace(/[$]/g, '').match(/(?:^|[,\t])(\d{7,9})(?:[,\t]|$)/); if (idm) ids[name] = idm[1] }
    else if (sal && !name) unmatched.push(line.slice(0, 44))
  })
  return { out, unmatched, ids }
}

export default function DfsSalaryAdmin() {
  const [series, setSeries] = useState('cup')
  const [race, setRace] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [salaries, setSalaries] = useState({})
  const [loading, setLoading] = useState(false)
  const [paste, setPaste] = useState('')
  const [msg, setMsg] = useState('')
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true); setSalaries({}); setMsg(''); setSaveMsg('')
    ;(async () => {
      const { data } = await supabase.from('sim_results').select('track_name,race_year,race_number,results').eq('series', series).order('published_at', { ascending: false }).limit(1)   // FIX 2026-07-23: id is a UUID - ordering by it is RANDOM (same bug as DFSPage)
      if (!alive) return
      const row = data && data[0]
      if (!row) { setDrivers([]); setRace(null); setLoading(false); return }
      const r = { track: row.track_name, year: row.race_year, rn: row.race_number }
      setRace(r)
      const ds = (row.results || []).map(d => ({ name: d.driver_name, car: d.car_number, projDK: +d.proj_dk || 0 })).filter(d => d.name).sort((a, b) => b.projDK - a.projDK)
      setDrivers(ds)
      let q = supabase.from('dfs_salaries').select('salaries').eq('series', series).eq('race_year', r.year)
      q = r.rn != null ? q.eq('race_number', r.rn) : q.is('race_number', null)
      const { data: sd } = await q.order('updated_at', { ascending: false }).limit(1)
      if (!alive) return
      if (sd && sd[0] && sd[0].salaries) setSalaries(sd[0].salaries)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [series])

  const salCount = Object.values(salaries).filter(v => v > 0).length
  const setSal = (name, val) => setSalaries(s => ({ ...s, [name]: val === '' ? 0 : Math.round(+val) || 0 }))
  const doPaste = () => {
    const { out, unmatched, ids } = parseSalaries(paste, drivers)
    setSalaries(s => ({ ...s, ...out, __ids: { ...(s.__ids || {}), ...ids } }))
    const n = Object.keys(out).length
    setMsg('Matched ' + n + ' driver' + (n === 1 ? '' : 's') + '.' + (unmatched.length ? ' Unmatched: ' + unmatched.length + ' (edit below).' : ''))
  }
  const clearAll = () => { setSalaries({}); setMsg('Cleared (not yet saved).') }
  const save = async () => {
    if (!race) return
    setSaveMsg('Saving\u2026')
    try {
      let del = supabase.from('dfs_salaries').delete().eq('series', series).eq('race_year', race.year)
      del = race.rn != null ? del.eq('race_number', race.rn) : del.is('race_number', null)
      await del
      const { error } = await supabase.from('dfs_salaries').insert({ series, race_year: race.year, race_number: race.rn, track_name: race.track, salaries })
      if (error) setSaveMsg('Save failed: ' + error.message)
      else setSaveMsg('Saved ' + salCount + ' salaries \u2014 live on the DFS Center for everyone.')
    } catch (e) { setSaveMsg('Save failed: ' + (e.message || e)) }
  }

  const inp = { background: 'var(--bg,#0e0f13)', color: 'var(--text,#e8eaed)', border: '1px solid var(--border,#2a2d34)', borderRadius: 6, padding: '5px 7px' }
  return (
    <div>
      <h3 style={{ margin: '4px 0 10px' }}>DFS Salaries</h3>
      <div style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 13, marginBottom: 12 }}>
        Paste the DraftKings salary export or edit manually, then Save. Salaries publish to the public DFS Center.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {SERIES.map(s => (
          <button key={s.v} onClick={() => setSeries(s.v)} style={{ padding: '6px 13px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border,#2a2d34)', background: series === s.v ? '#e8b923' : 'transparent', color: series === s.v ? '#111' : 'var(--text-secondary,#9aa0aa)', fontWeight: series === s.v ? 700 : 400 }}>{s.label}</button>
        ))}
        {race && <span style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 13 }}>{race.track} &middot; {race.year} &middot; Race {race.rn} &middot; {salCount}/{drivers.length} set</span>}
      </div>

      {loading && <div style={{ color: 'var(--text-secondary,#9aa0aa)' }}>Loading\u2026</div>}
      {!loading && !drivers.length && <div style={{ color: 'var(--text-secondary,#9aa0aa)' }}>No published sim for this series yet.</div>}

      {!loading && drivers.length > 0 && <>
        <textarea value={paste} onChange={e => setPaste(e.target.value)} placeholder="Paste DraftKings salary CSV (or Name, Salary rows)\u2026"
          style={{ width: '100%', minHeight: 80, ...inp, fontFamily: 'monospace', fontSize: 12 }} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '8px 0 14px', flexWrap: 'wrap' }}>
          <button onClick={doPaste} style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border,#2a2d34)', background: 'transparent', color: 'var(--text,#e8eaed)' }}>Import from paste</button>
          <button onClick={save} style={{ padding: '6px 16px', borderRadius: 8, cursor: 'pointer', border: 'none', background: '#e8b923', color: '#111', fontWeight: 700 }}>Save salaries</button>
          <button onClick={clearAll} style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border,#2a2d34)', background: 'transparent', color: 'var(--text-secondary,#9aa0aa)' }}>Clear</button>
          {msg && <span style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 12 }}>{msg}</span>}
          {saveMsg && <span style={{ color: 'var(--text-secondary,#9aa0aa)', fontSize: 12 }}>{saveMsg}</span>}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ color: 'var(--text-secondary,#9aa0aa)' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Driver</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Proj DK</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Salary</th>
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Value</th>
            </tr></thead>
            <tbody>
              {drivers.map(d => {
                const sal = salaries[d.name] || 0
                const val = sal > 0 ? (d.projDK / (sal / 1000)).toFixed(2) : '\u2014'
                return (
                  <tr key={d.name} style={{ borderBottom: '1px solid var(--border,#22252b)' }}>
                    <td style={{ padding: '4px 8px' }}>{d.car ? '#' + d.car + ' ' : ''}{d.name}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>{d.projDK.toFixed(1)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                      <input value={sal || ''} onChange={e => setSal(d.name, e.target.value)} placeholder="\u2014" style={{ width: 66, textAlign: 'right', ...inp }} />
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>{val}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  )
}

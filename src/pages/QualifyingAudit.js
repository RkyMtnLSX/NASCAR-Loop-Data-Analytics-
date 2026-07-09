import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SERIES = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks',  label: 'Truck Series' },
]

export default function QualifyingAudit() {
  const [series, setSeries]   = useState('cup')
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => { loadAudit() }, [series])

  async function loadAudit() {
    setLoading(true); setError(null)
    const { data, error: err } = await supabase.from('qualifying_results').select('year, track_name, race_number, driver_name').eq('series', series)
    if (err) { setError(err.message); setLoading(false); return }
    const byRace = {}
    ;(data || []).forEach(r => {
      const rn = r.race_number == null ? 0 : r.race_number
      const key = r.year + '|' + r.track_name + '|' + rn
      if (!byRace[key]) byRace[key] = { year: r.year, track: r.track_name, rn: rn, names: new Set() }
      if (r.driver_name) byRace[key].names.add(r.driver_name.trim())
    })
    const result = Object.values(byRace).map(x => ({ year: x.year, track: x.track, rn: x.rn, drivers: x.names.size }))
      .sort((a, b) => (b.year - a.year) || a.track.localeCompare(b.track) || a.rn - b.rn)
    setRows(result); setLoading(false)
  }

  const containerStyle = { padding: '24px', maxWidth: 900, margin: '0 auto', fontFamily: 'monospace', color: '#ccc' }
  const thStyle = { textAlign: 'left', padding: '6px 12px', borderBottom: '1px solid #333', color: '#888', fontSize: 12 }
  const tdStyle = (warn) => ({ padding: '5px 12px', fontSize: 13, color: warn ? '#e05c5c' : '#ccc' })

  const flagged = rows.filter(r => r.drivers < 30).length

  return (
    <div style={containerStyle}>
      <h2 style={{ color: '#fff', marginBottom: 6 }}>Qualifying Data Audit</h2>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Driver count per qualifying session. Rows in red have fewer than 30 drivers, likely a partial or failed load.</div>
      <div style={{ marginBottom: 16 }}>
        {SERIES.map(s => (
          <button key={s.value} onClick={() => setSeries(s.value)} style={{ marginRight: 8, padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', background: series === s.value ? '#f59e0b' : '#222', color: series === s.value ? '#111' : '#aaa', fontWeight: 600 }}>{s.label}</button>
        ))}
      </div>
      {loading ? <div style={{ color: '#888' }}>Loading...</div> : error ? <div style={{ color: '#e05c5c' }}>{error}</div> : (
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{rows.length} sessions, {flagged} flagged (under 30 drivers)</div>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead><tr><th style={thStyle}>Year</th><th style={thStyle}>Track</th><th style={thStyle}>Race #</th><th style={{ ...thStyle, textAlign: 'right' }}>Drivers</th></tr></thead>
            <tbody>
              {rows.map((r, i) => { const warn = r.drivers < 30; return (
                <tr key={i}>
                  <td style={tdStyle(warn)}>{r.year}</td>
                  <td style={tdStyle(warn)}>{r.track}</td>
                  <td style={tdStyle(warn)}>{r.rn || '-'}</td>
                  <td style={{ ...tdStyle(warn), textAlign: 'right', fontWeight: warn ? 700 : 400 }}>{r.drivers}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

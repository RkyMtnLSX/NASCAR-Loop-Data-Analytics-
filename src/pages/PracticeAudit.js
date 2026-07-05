import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SERIES = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks',  label: 'Truck Series' },
]

export default function PracticeAudit() {
  const [series, setSeries]   = useState('cup')
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => { loadAudit() }, [series])

  async function loadAudit() {
    setLoading(true)
    setError(null)

    const { data, error: qErr } = await supabase
      .from('practice_sessions')
      .select('year, track_name, session_number, race_number, driver_name, created_at')
      .eq('series', series)

    if (qErr) { setError(qErr.message); setLoading(false); return }

    const groups = {}
    ;(data || []).forEach(r => {
      const key = [r.year, r.race_number, r.track_name, r.session_number].join('|')
      if (!groups[key]) {
        groups[key] = {
          key, year: r.year, raceNum: r.race_number, trackName: r.track_name,
          sessionNum: r.session_number, drivers: new Set(), uploaded: r.created_at,
        }
      }
      groups[key].drivers.add(r.driver_name)
      if (r.created_at > groups[key].uploaded) groups[key].uploaded = r.created_at
    })

    const result = Object.values(groups).map(g => ({
      key: g.key, year: g.year, raceNum: g.raceNum, trackName: g.trackName,
      sessionNum: g.sessionNum, drivers: g.drivers.size,
      uploaded: g.uploaded ? String(g.uploaded).slice(0, 10) : '--',
    }))
    // sorted by year (newest first) then race number, so missing races are easy to spot
    result.sort((a, b) => (b.year - a.year) || (a.raceNum - b.raceNum))

    setRows(result)
    setLoading(false)
  }

  return (
    <div style={containerStyle}>
      <h2 style={{ color: '#fff', marginBottom: 16 }}>Practice Session Audit</h2>

      <div style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
        {SERIES.map(s => (
          <button key={s.value} onClick={() => setSeries(s.value)} style={{
            padding: '6px 14px', borderRadius: 4, border: 'none', cursor: 'pointer',
            background: series === s.value ? '#3b82f6' : '#2a2a2a',
            color: series === s.value ? '#fff' : '#aaa', fontSize: 13,
          }}>{s.label}</button>
        ))}
      </div>

      {loading && <div style={{ color: '#888' }}>Loading...</div>}
      {error   && <div style={{ color: '#e05c5c' }}>Error: {error}</div>}

      {!loading && !error && (
        <div style={{ color: '#888', fontSize: 12, marginBottom: 10 }}>
          {rows.length} session{rows.length === 1 ? '' : 's'} stored
        </div>
      )}

      {!loading && rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Year</th>
              <th style={thStyle}>R#</th>
              <th style={thStyle}>Track</th>
              <th style={thStyle}>Session</th>
              <th style={thStyle}>Drivers</th>
              <th style={thStyle}>Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.key} style={{ borderBottom: '1px solid #1a1a1a' }}>
                <td style={tdStyle(false)}>{r.year}</td>
                <td style={tdStyle(false)}>{r.raceNum || '--'}</td>
                <td style={tdStyle(false)}>{r.trackName}</td>
                <td style={tdStyle(false)}>{r.sessionNum}</td>
                <td style={tdStyle(r.drivers === 0)}>{r.drivers}</td>
                <td style={tdStyle(false)}>{r.uploaded}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !error && rows.length === 0 && (
        <div style={{ color: '#888' }}>No practice sessions stored for this series yet.</div>
      )}
    </div>
  )
}

const containerStyle = {
  padding: '24px', maxWidth: 900, margin: '0 auto',
  fontFamily: 'monospace', color: '#ccc',
}

const thStyle = {
  textAlign: 'left', padding: '6px 12px',
  borderBottom: '1px solid #333', color: '#888', fontSize: 12,
}

const tdStyle = (warn) => ({
  padding: '5px 12px', fontSize: 13,
  color: warn ? '#e05c5c' : '#ccc',
})

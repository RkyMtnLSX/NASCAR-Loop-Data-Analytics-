import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SERIES = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks',  label: 'Truck Series' },
]

export default function LoopDataAudit() {
  const [series, setSeries]   = useState('cup')
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => { loadAudit() }, [series])

  async function loadAudit() {
    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('get_loop_audit_data', { p_series: series })

    if (rpcError) { setError(rpcError.message); setLoading(false); return }

    const result = (data || []).map(r => ({
      year:      r.year,
      seasonNum: r.season_num,
      date:      r.race_date,
      trackName: r.track_name,
      raceId:    r.race_id,
      trackRn:   r.track_rn || 1,
      drivers:   Number(r.driver_count) || 0,
    }))

    setRows(result)
    setLoading(false)
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

  return (
    <div style={containerStyle}>
      <h2 style={{ color: '#fff', marginBottom: 16 }}>Loop Data Audit</h2>

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

      {!loading && rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Year</th>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Season#</th>
              <th style={thStyle}>R#</th>
              <th style={thStyle}>Track</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Drivers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const warn = r.drivers === 0
              return (
                <tr key={r.raceId} style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={tdStyle(false)}>{r.year}</td>
                  <td style={tdStyle(false)}>{r.date || '--'}</td>
                  <td style={tdStyle(false)}>{r.seasonNum || '--'}</td>
                  <td style={tdStyle(false)}>{r.trackRn}</td>
                  <td style={tdStyle(false)}>{r.trackName}</td>
                  <td style={{ ...tdStyle(warn), textAlign: 'right' }}>{r.drivers || '--'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {!loading && rows.length === 0 && !error && (
        <div style={{ color: '#666' }}>No data found for {series}.</div>
      )}
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SERIES = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'xfinity', label: 'Xfinity Series' },
  { value: 'trucks',  label: 'Truck Series' },
]

export default function LoopDataAudit() {
  const [series, setSeries] = useState('cup')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setRows([])
    supabase
      .from('loop_data')
      .select('track_name, year, driver_name')
      .eq('series', series)
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return }
        // Group by track_name + year
        const map = {}
        ;(data || []).forEach(r => {
          const key = r.year + '||' + r.track_name
          if (!map[key]) map[key] = { year: r.year, track: r.track_name, drivers: 0 }
          map[key].drivers++
        })
        const sorted = Object.values(map).sort((a, b) =>
          b.year - a.year || a.track.localeCompare(b.track)
        )
        setRows(sorted)
        setLoading(false)
      })
  }, [series])

  const pg = { padding: '24px 32px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }
  const th = { padding: '8px 14px', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', fontWeight: 700 }
  const td = { padding: '7px 14px', fontSize: '0.82rem', borderBottom: '1px solid var(--border)' }

  return (
    <div style={pg}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>Loop Data Audit</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {SERIES.map(s => (
          <button key={s.value} onClick={() => setSeries(s.value)} style={{
            padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.8rem',
            background: series === s.value ? 'var(--accent)' : 'var(--bg-card)',
            color: series === s.value ? '#000' : 'var(--text-secondary)',
          }}>{s.label}</button>
        ))}
      </div>

      {loading && <div style={{ color: 'var(--text-muted)' }}>Loading...</div>}
      {error && <div style={{ color: '#f44', marginBottom: 12 }}>Error: {error}</div>}

      {!loading && !error && (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ marginBottom: 8, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {rows.length} race{rows.length !== 1 ? 's' : ''} loaded
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 400 }}>
            <thead>
              <tr>
                <th style={th}>Year</th>
                <th style={th}>Track</th>
                <th style={{ ...th, textAlign: 'right' }}>Drivers</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{r.year}</td>
                  <td style={td}>{r.track}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.drivers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

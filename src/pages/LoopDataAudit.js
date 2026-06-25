import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SERIES = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks',  label: 'Truck Series' },
]

export default function LoopDataAudit() {
  const [series, setSeries] = useState('cup')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true); setError(null); setRows([])
    supabase
      .from('loop_data')
      .select('track_name, year, race_number, driver_name')
      .eq('series', series)
      .range(0, 99999)
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return }
        const map = {}
        ;(data || []).forEach(r => {
          const key = r.year + '||' + (r.race_number || 1) + '||' + r.track_name
          if (!map[key]) map[key] = { year: r.year, raceNum: r.race_number || 1, track: r.track_name, drivers: 0 }
          map[key].drivers++
        })
        const sorted = Object.values(map).sort((a, b) =>
          a.year !== b.year ? a.year - b.year : a.raceNum - b.raceNum
        )
        setRows(sorted)
        setLoading(false)
      })
  }, [series])

  const active = { background: 'var(--accent)', color: '#000', fontWeight: 700 }
  const inactive = { background: 'transparent', color: 'var(--text-muted)', fontWeight: 400 }

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', fontFamily: 'monospace' }}>
        Loop Data Audit
      </h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
        {SERIES.map(s => (
          <button
            key={s.value}
            onClick={() => setSeries(s.value)}
            style={{
              padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)',
              cursor: 'pointer', fontSize: '0.875rem',
              ...(series === s.value ? active : inactive)
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>Loading...</p>}
      {error && <p style={{ color: '#f87171', fontFamily: 'monospace' }}>Error: {error}</p>}
      {!loading && !error && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontFamily: 'monospace', marginBottom: '1rem' }}>
          {rows.length} races loaded
        </p>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', fontFamily: 'monospace' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['YEAR', 'RACE #', 'TRACK', 'DRIVERS'].map(h => (
              <th key={h} style={{
                textAlign: h === 'DRIVERS' ? 'right' : 'left',
                padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem'
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '5px 8px', color: 'var(--text-muted)' }}>{r.year}</td>
              <td style={{ padding: '5px 8px', color: 'var(--text-muted)' }}>{r.raceNum}</td>
              <td style={{ padding: '5px 8px' }}>{r.track}</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', color: r.drivers < 30 ? '#f87171' : 'var(--text-muted)' }}>
                {r.drivers}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

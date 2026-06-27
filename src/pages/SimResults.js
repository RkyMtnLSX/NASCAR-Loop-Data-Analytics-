import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SERIES_TABS = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'truck',   label: 'Truck Series' },
]

// Values stored as percentages (e.g. 60.9), not decimals
const fmt = (n, dec = 1) => n == null ? '—' : (+n).toFixed(dec) + '%'
const fmtDK = (n) => n == null ? '—' : (+n).toFixed(2)

export default function SimResults() {
  const [series, setSeries]     = useState('cup')
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setData(null)
    supabase
      .from('sim_results')
      .select('*')
      .eq('series', series)
      .order('published_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data: row, error: err }) => {
        if (err && err.code !== 'PGRST116') setError('No published results yet.')
        else if (row) setData(row)
        else setError('No published results yet.')
        setLoading(false)
      })
  }, [series])

  const results = data?.results || []
  // Sort by projected finish ascending (1st = best)
  const sorted  = [...results].sort((a, b) => (a.proj_finish || 99) - (b.proj_finish || 99))

  const tabStyle = (s) => ({
    padding: '8px 18px', border: 'none', borderRadius: 6, cursor: 'pointer',
    fontWeight: 600, fontSize: '0.875rem',
    background: series === s ? 'var(--accent)' : 'var(--bg-surface)',
    color: series === s ? '#111' : 'var(--text-secondary)',
  })

  const thStyle = {
    padding: '10px 12px', textAlign: 'left', fontSize: '0.7rem',
    fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em',
    textTransform: 'uppercase', whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)',
  }
  const tdStyle = {
    padding: '10px 12px', fontSize: '0.85rem',
    borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap',
  }
  const pctStyle = (v, hi) => ({
    ...tdStyle,
    color: v >= hi ? '#4ade80' : v >= hi * 0.5 ? 'var(--text-primary)' : 'var(--text-muted)',
    fontWeight: v >= hi ? 700 : 400,
  })

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {SERIES_TABS.map(t => (
          <button key={t.value} style={tabStyle(t.value)} onClick={() => setSeries(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {data && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 8, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{data.track_name}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Published {new Date(data.published_at).toLocaleString()}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{results.length} drivers</span>
        </div>
      )}

      {loading && <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loadingâ¦</div>}
      {error   && <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>{error}</div>}

      {!loading && !error && sorted.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Driver</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Start</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Proj Finish</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Proj DK</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Win%</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Top 3%</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Top 5%</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Top 10%</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Laps Led</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Fast Laps</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>DNF%</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, i) => (
                <tr key={d.driver_name} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-surface)' }}>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', width: 32 }}>{i + 1}</td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>
                      {d.car_number && <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>#{d.car_number}</span>}
                      {d.driver_name}
                    </div>
                    {d.organization && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.organization}</div>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{d.start_pos ?? '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{d.proj_finish != null ? (+d.proj_finish).toFixed(1) : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--accent)', fontWeight: 600 }}>{fmtDK(d.proj_dk)}</td>
                  <td style={{ ...pctStyle(d.win_pct, 5), textAlign: 'center' }}>{fmt(d.win_pct)}</td>
                  <td style={{ ...pctStyle(d.top3_pct, 10), textAlign: 'center' }}>{fmt(d.top3_pct)}</td>
                  <td style={{ ...pctStyle(d.top5_pct, 15), textAlign: 'center' }}>{fmt(d.top5_pct)}</td>
                  <td style={{ ...pctStyle(d.top10_pct, 25), textAlign: 'center' }}>{fmt(d.top10_pct)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{d.laps_led != null ? (+d.laps_led).toFixed(1) : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{d.avg_fast_laps != null ? (+d.avg_fast_laps).toFixed(1) : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{fmt(d.dnf_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

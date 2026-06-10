import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { gradeColor, trendLabel } from '../lib/practiceGrader'

const SERIES_TABS = [
  { value: 'cup',      label: 'Cup Series' },
  { value: 'xfinity',  label: "O'Reilly Series" },
  { value: 'trucks',   label: 'Truck Series' },
]

const GROUP_COLORS = {
  A: { bg: '#1A5276', text: '#ffffff' },
  B: { bg: '#6E2F8D', text: '#ffffff' },
}

export default function PracticeReportCard({ isSubscriber }) {
  const [series, setSeries]     = useState('cup')
  const [sessions, setSessions] = useState([])
  const [selected, setSelected] = useState(null)
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  // Load distinct sessions for this series
  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      setRows([])
      setSelected(null)

      const { data, error } = await supabase
        .from('practice_sessions')
        .select('track_name, year, session_number, series')
        .eq('series', series)
        .order('year', { ascending: false })
        .order('track_name')

      if (error) { setError(error.message); setLoading(false); return }

      const seen = new Set()
      const unique = []
      for (const row of (data || [])) {
        const key = `${row.year}|${row.track_name}|${row.session_number}`
        if (!seen.has(key)) {
          seen.add(key)
          unique.push({ ...row, key })
        }
      }
      setSessions(unique)
      if (unique.length > 0) setSelected(unique[0].key)
      setLoading(false)
    }
    load()
  }, [series])

  // Load rows for selected session
  useEffect(() => {
    if (!selected) { setRows([]); return }
    const session = sessions.find(s => s.key === selected)
    if (!session) return

    async function loadRows() {
      setLoading(true)
      const { data, error } = await supabase
        .from('practice_sessions')
        .select('*')
        .eq('series', session.series)
        .eq('year', session.year)
        .eq('track_name', session.track_name)
        .eq('session_number', session.session_number)
        .order('practice_score', { ascending: false })

      if (error) { setError(error.message); setLoading(false); return }
      setRows(data || [])
      setLoading(false)
    }
    loadRows()
  }, [selected, sessions])

  const visibleRows = isSubscriber ? rows : rows.slice(0, 10)
  const blurred     = !isSubscriber && rows.length > 10

  // Check if this session has group or car number data
  const hasGroup     = rows.some(r => r.practice_group)
  const hasCarNumber = rows.some(r => r.car_number)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Practice Report Cards</h1>
        <p className="page-subtitle">Stint-aware practice grades — long run pace, late run average, trend &amp; consistency</p>
      </div>

      {/* Series tabs */}
      <div className="tabs">
        {SERIES_TABS.map(t => (
          <button
            key={t.value}
            className={`tab ${series === t.value ? 'active' : ''}`}
            onClick={() => setSeries(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Session selector */}
      {sessions.length > 0 && (
        <div style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sessions.map(s => (
            <button
              key={s.key}
              onClick={() => setSelected(s.key)}
              className="btn btn-secondary"
              style={{
                fontSize: '0.75rem',
                padding: '5px 12px',
                background:   selected === s.key ? 'var(--bg-elevated)' : 'transparent',
                color:        selected === s.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderColor:  selected === s.key ? 'var(--accent)60'     : 'var(--border)',
              }}
            >
              {s.track_name} {s.year} — S{s.session_number}
            </button>
          ))}
        </div>
      )}

      {/* Loading / error / empty */}
      {loading && (
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p>Loading...</p>
        </div>
      )}
      {!loading && error && (
        <div className="empty-state">
          <h3>Error loading data</h3>
          <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>{error}</p>
        </div>
      )}
      {!loading && !error && sessions.length === 0 && (
        <div className="empty-state">
          <h3>No practice sessions yet</h3>
          <p>Practice data for {SERIES_TABS.find(t => t.value === series)?.label} will appear here once uploaded.</p>
        </div>
      )}

      {/* Table */}
      {!loading && rows.length > 0 && (
        <div style={{ position: 'relative' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  {hasCarNumber && <th style={{ width: 52 }}>Car</th>}
                  <th className="left">Driver</th>
                  {hasGroup && <th style={{ width: 60 }}>Group</th>}
                  <th>Start</th>
                  <th>Grade</th>
                  <th>Score</th>
                  <th>Laps</th>
                  <th>Avg Lap</th>
                  <th>Late Run</th>
                  <th>Best Lap</th>
                  <th>Stints</th>
                  <th>Longest Stint</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((d, i) => {
                  const gc    = d.practice_grade ? gradeColor(d.practice_grade) : { bg: '#333', text: '#fff' }
                  const trend = d.trend_slope !== null ? trendLabel(d.trend_slope) : null
                  const grpColors = d.practice_group ? (GROUP_COLORS[d.practice_group] || { bg: '#555', text: '#fff' }) : null
                  return (
                    <tr key={d.id}>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        {i + 1}
                      </td>
                      {hasCarNumber && (
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                          {d.car_number ? `#${d.car_number}` : '—'}
                        </td>
                      )}
                      <td className="left" style={{ fontWeight: i < 3 ? 600 : 400 }}>
                        {d.driver_name}
                      </td>
                      {hasGroup && (
                        <td>
                          {grpColors ? (
                            <span className="grade-pill" style={{ background: grpColors.bg, color: grpColors.text, fontSize: '0.7rem', padding: '2px 8px' }}>
                              {d.practice_group}
                            </span>
                          ) : '—'}
                        </td>
                      )}
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {d.qualifying_position ?? '—'}
                      </td>
                      <td>
                        <span className="grade-pill" style={{ background: gc.bg, color: gc.text }}>
                          {d.practice_grade || '—'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {d.practice_score?.toFixed(1) || '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{d.total_laps ?? '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{d.overall_avg?.toFixed(3) || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{d.late_run_avg?.toFixed(3) || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                        {d.best_lap?.toFixed(3) || '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{d.num_stints ?? '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{d.longest_stint ?? '—'}</td>
                      <td style={{ fontSize: '0.75rem', color: trend?.color }}>
                        {trend?.label || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Paywall blur */}
          {blurred && (
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              height: 160,
              background: 'linear-gradient(to bottom, transparent, var(--bg-base) 80%)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 20,
            }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Subscribe to see the full field
                </p>
                <a href="/subscribe" className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '6px 18px' }}>
                  Get Full Access
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

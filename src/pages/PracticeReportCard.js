import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { gradeColor } from '../lib/practiceGrader'

const SERIES_COLOR = { cup: 'var(--series-cup)', xfinity: 'var(--series-oreilly)', trucks: 'var(--series-trucks)' }
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

      // O'Reilly Series includes both 'xfinity' and 'oreilly' series codes
      const seriesValues = series === 'xfinity' ? ['xfinity', 'oreilly'] : [series]
            // Use get_practice_sessions RPC (queries practice_laps) to get most recently uploaded session
      const rpcResults = await Promise.all(
        seriesValues.map(sv => supabase.rpc('get_practice_sessions', { p_series: sv }))
      )

      const allSessions = []
      for (const { data: rData, error: rErr } of rpcResults) {
        if (rErr) { setError(rErr.message); setLoading(false); return }
        for (const row of (rData || [])) {
          const key = `${row.year}|${row.track_name}|${row.session_number}`
          if (!allSessions.find(s => s.key === key)) {
            allSessions.push({ ...row, key })
          }
        }
      }

      const unique = allSessions.slice(0, 1)
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
        .order('practice_score', { ascending: false, nullsFirst: false })

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
        <p className="page-subtitle">Grades weighted 50/50 on Avg Pace (run-aware) &amp; Best Lap speed &middot; scores aligned to letter bands</p>
      </div>

      {/* Series tabs */}
      <div className="tabs">
        {SERIES_TABS.map(t => (
          <button
            key={t.value}
            className={`tab ${series === t.value ? 'active' : ''}`}
            style={series === t.value ? { background: SERIES_COLOR[t.value], color: t.value === 'trucks' ? '#111' : '#fff', borderColor: 'transparent' } : undefined}
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
                fontSize: '0.89rem',
                padding: '5px 12px',
                background:   selected === s.key ? 'var(--bg-elevated)' : 'transparent',
                color:        selected === s.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderColor:  selected === s.key ? 'var(--accent)60'     : 'var(--border)',
              }}
            >
              {s.track_name} {s.year} &middot; S{s.session_number}
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
          <p style={{ fontSize: '0.89rem', fontFamily: 'var(--font-mono)' }}>{error}</p>
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
            <style>{`
              .th-tip { position: relative; cursor: help; text-decoration: underline dotted rgba(255,255,255,0.3); text-underline-offset: 3px; }
              .th-tip:hover::after { content: attr(data-tip); position: absolute; left: 50%; top: 100%; transform: translateX(-50%); margin-top: 8px; z-index: 30; width: 190px; padding: 9px 11px; background: #16181d; color: #e8e8e8; border: 1px solid #3a3d44; border-radius: 8px; font-size: 0.72rem; font-weight: 400; line-height: 1.4; letter-spacing: normal; text-transform: none; text-decoration: none; white-space: normal; text-align: left; box-shadow: 0 6px 20px rgba(0,0,0,0.55); pointer-events: none; }
              .th-tip:hover::before { content: ''; position: absolute; left: 50%; top: 100%; transform: translateX(-50%); margin-top: 3px; border: 5px solid transparent; border-bottom-color: #3a3d44; z-index: 30; }
            `}</style>
            {visibleRows.length > 0 && visibleRows[0].tire_sets != null && (
              <div style={{ margin: '4px 0 10px', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                Practice Tire Allocation: <strong>{visibleRows[0].tire_sets} set{visibleRows[0].tire_sets > 1 ? 's' : ''}</strong>
              </div>
            )}
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  {hasCarNumber && <th style={{ width: 52 }}>Car</th>}
                  <th className="left">Driver</th>
                  {hasGroup && <th style={{ width: 60 }}>Group</th>}
                  <th className="th-tip" data-tip="Starting position for this race.">Start</th>
                  <th className="th-tip" data-tip="Overall practice grade (percentile of the field), from Avg Pace 50% + Best Lap 50% (v3, 2026-07-10).">Grade</th>
                  <th className="th-tip" data-tip="Letter-aligned score: A+ 97-100, A 93-96.9 ... F 40-59.9. The session's top car is always 100.">Score</th>
                  <th className="th-tip" data-tip="Graded (clean) laps / total laps. Laps beyond 8% of the session median are excluded from grading.">Graded Laps</th>
                  <th className="th-tip" data-tip="Average of each run's average lap time - each run weighted equally, so one short outlier run can swing it. Lower is faster.">Avg Pace</th>
                  <th className="th-tip" data-tip="Simple average of every clean lap - each lap weighted equally, so a short outlier run barely moves it. Lower is faster.">All Laps</th>
                  <th className="th-tip" data-tip="Fastest single run's average lap time - peak sustained pace. Lower is faster.">Best Stint</th>
                  <th className="th-tip" data-tip="Length-weighted pace over runs of 10+ laps - worn-tire, long-run speed.">Long Run</th>
                  <th className="th-tip" data-tip="Lap-time consistency within runs (std dev). Lower is more repeatable.">Consistency</th>
                  <th className="th-tip" data-tip="Single fastest lap of the session - raw one-lap speed.">Best Lap</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((d, i) => {
                  const gc      = d.practice_grade ? gradeColor(d.practice_grade) : { bg: '#333', text: '#fff' }
                  const grpColors = d.practice_group ? (GROUP_COLORS[d.practice_group] || { bg: '#555', text: '#fff' }) : null
                  return (
                    <tr key={d.id}>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.89rem' }}>
                        {i + 1}
                      </td>
                      {hasCarNumber && (
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.96rem' }}>
                          {d.car_number && (series === 'cup' || series === 'oreilly' || series === 'trucks') ? <img src={(series === 'cup' ? '/car-numbers/' : series === 'oreilly' ? '/car-numbers-oreilly/' : '/car-numbers-trucks/') + d.car_number + '.png'} alt={'#' + d.car_number} style={{ height: 28, verticalAlign: 'middle' }} /> : '-'}
                        </td>
                      )}
                      <td className="left" style={{ fontWeight: i < 3 ? 600 : 400 }}>
                        {d.driver_name}
                      </td>
                      {hasGroup && (
                        <td>
                          {grpColors ? (
                            <span className="grade-pill" style={{ background: grpColors.bg, color: grpColors.text, fontSize: '0.83rem', padding: '2px 8px' }}>
                              {d.practice_group}
                            </span>
                          ) : '-'}
                        </td>
                      )}
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {d.qualifying_position ?? '-'}
                      </td>
                      <td>
                        <span className="grade-pill" style={{ background: gc.bg, color: gc.text }}>
                          {d.practice_grade || '-'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {d.practice_score?.toFixed(1) || '-'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{(() => { let n = null; try { n = JSON.parse(d.notes || 'null') } catch (e) { n = null }
                        const gl = n && n.gl != null ? n.gl : null
                        return <span>{gl != null ? gl + '/' : ''}{d.total_laps ?? '-'}</span> })()}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{d.avg_pace?.toFixed(3) || '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{d.overall_avg?.toFixed(3) || '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{d.best_stint?.toFixed(3) || '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{d.long_run?.toFixed(3) || <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: 4, background: '#4a3a12', color: '#e0b64f' }}>low conf</span>}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{d.consistency?.toFixed(3) || '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{d.best_lap?.toFixed(3) || '-'}</td>
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
                <p style={{ fontSize: '0.96rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Subscribe to see the full field
                </p>
                <a href="/subscribe" className="btn btn-primary" style={{ fontSize: '0.89rem', padding: '6px 18px' }}>
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

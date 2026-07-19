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
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const sortBy = (k) => { if (k === sortKey) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') } else { setSortKey(k); setSortDir('asc') } }
  const sortArrow = (k) => k === sortKey ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

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
      // Double-visit tracks share (year, track, session) — resolve the LATEST upload's race_number so
      // the card never interleaves two races' batches (Phoenix oreilly 2025 R4/R33 incident, 2026-07-17).
      for (const s of unique) {
        const { data: rn } = await supabase.from('practice_sessions')
          .select('race_number, created_at').eq('series', s.series).eq('year', s.year)
          .eq('track_name', s.track_name).eq('session_number', s.session_number)
          .order('created_at', { ascending: false }).limit(1)
        s.race_number = rn && rn.length ? rn[0].race_number : null
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
        .eq('race_number', session.race_number)
        .order('practice_score', { ascending: false, nullsFirst: false })

      if (error) { setError(error.message); setLoading(false); return }
      let out = data || []
      // CAR FALLBACK (2026-07-17): sheets often lack a Car column -> practice_sessions.car_number null.
      // loop_data carries car numbers for completed races; merge for DISPLAY only.
      try {
        if (!out.some(r => r.car_number) || !out.some(r => r.qualifying_position != null)) {
          const nn = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').replace(/\s+/g, ' ').trim()
          const { data: lc } = await supabase.from('loop_data')
            .select('driver_name, car_number, start_position')
            .eq('series', session.series).eq('year', session.year)
            .eq('track_name', session.track_name)
          const m = {}
          const ms = {}
          ;(lc || []).forEach(e => { const k = nn(e.driver_name); if (e.car_number != null && !m[k]) m[k] = e.car_number; if (e.start_position != null && ms[k] == null) ms[k] = e.start_position })
          out = out.map(r => ({ ...r, car_number: r.car_number || m[nn(r.driver_name)] || null, qualifying_position: r.qualifying_position != null ? r.qualifying_position : (ms[nn(r.driver_name)] != null ? ms[nn(r.driver_name)] : null) }))
        }
      } catch (e2) {}
      // 10/15/20-lap sustained averages from raw practice_laps (display only, falloff included)
      try {
        const { data: __pl } = await supabase.from('practice_laps')
          .select('driver_name, lap_number, lap_time')
          .eq('series', session.series).eq('year', session.year)
          .eq('track_name', session.track_name).eq('session_number', session.session_number)
        const __byDrv = {}
        ;(__pl || []).forEach(l => { const k = l.driver_name; (__byDrv[k] = __byDrv[k] || []).push([+l.lap_number, +l.lap_time]) })
        const __lapAvgs = (arr) => {
          const laps = arr.filter(([n, tt]) => !isNaN(n) && !isNaN(tt) && tt > 10 && tt < 1200).sort((a, b) => a[0] - b[0])
          const res = {}
          if (!laps.length) return res
          const stints = []; let cur = [laps[0]]
          for (let i = 1; i < laps.length; i++) { if (laps[i][0] === laps[i - 1][0] + 1) cur.push(laps[i]); else { stints.push(cur); cur = [laps[i]] } }
          stints.push(cur)
          // NASCAR method: best (fastest) average over N consecutive laps within a single run
          ;[5, 10, 15, 20, 25, 30].forEach(N => {
            let best = null
            for (const s of stints) { const tt = s.map(x => x[1]); if (tt.length < N) continue; for (let i = 0; i + N <= tt.length; i++) { let sum = 0; for (let j = 0; j < N; j++) sum += tt[i + j]; const a = sum / N; if (best === null || a < best) best = a } }
            if (best !== null) res['best' + N] = best
          })
          return res
        }
        out = out.map(r => ({ ...r, ...__lapAvgs(__byDrv[r.driver_name] || []) }))
      } catch (e3) {}
      setRows(out)
      setLoading(false)
    }
    loadRows()
  }, [selected, sessions])

  const _sorted = sortKey ? [...rows].sort((a, b) => { const av = a[sortKey], bv = b[sortKey]; if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1; return sortDir === 'asc' ? av - bv : bv - av }) : rows
  const visibleRows = isSubscriber ? _sorted : _sorted.slice(0, 10)
  const blurred     = !isSubscriber && rows.length > 10
  const _heatKeys = ['best5', 'best10', 'best15', 'best20', 'best25', 'best30']
  const _heatStats = {}
  _heatKeys.forEach(k => { const v = rows.map(r => r[k]).filter(x => x != null); _heatStats[k] = v.length ? { min: Math.min(...v), max: Math.max(...v) } : null })
  const heatBg = (val, k) => { const s = _heatStats[k]; if (val == null || !s || s.max === s.min) return 'transparent'; const tn = (val - s.min) / (s.max - s.min); return 'hsla(' + (130 - 130 * tn) + ', 58%, 46%, 0.6)' }

  // Check if this session has group or car number data
  const hasGroup     = rows.some(r => r.practice_group)
  const hasCarNumber = rows.some(r => r.car_number)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Practice Report Cards</h1>
        <p className="page-subtitle">Practice performance ranked as a percentile of the field</p>
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
              {s.track_name} {s.year}{s.race_number != null ? ' \u00B7 R' + s.race_number : ''} &middot; S{s.session_number}
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
                  <th className="th-tip" data-tip="Overall practice grade — each car's practice performance ranked as a percentile of the field.">Grade</th>
                  <th className="th-tip" data-tip="Letter-aligned score: A+ 97-100, A 93-96.9 ... F 40-59.9. The session's top car is always 100.">Score</th>
                  <th className="th-tip" data-tip="Single fastest lap of the session - raw one-lap speed." onClick={() => sortBy('best_lap')} style={{ cursor: 'pointer' }}>Best Lap{sortArrow('best_lap')}</th>
                  <th className="th-tip" data-tip="Average of each run's average lap time - each run weighted equally, so one short outlier run can swing it. Lower is faster." onClick={() => sortBy('avg_pace')} style={{ cursor: 'pointer' }}>Avg Pace{sortArrow('avg_pace')}</th>
                  <th className="th-tip" data-tip="Simple average of every clean lap - each lap weighted equally, so a short outlier run barely moves it. Lower is faster." onClick={() => sortBy('overall_avg')} style={{ cursor: 'pointer' }}>All Laps{sortArrow('overall_avg')}</th>
                  <th className="th-tip" data-tip="Number of separate runs (stints) the driver made in the session." onClick={() => sortBy('num_stints')} style={{ cursor: 'pointer' }}># Stints{sortArrow('num_stints')}</th>
                  <th className="th-tip" data-tip="Best 5 consecutive laps (fastest 5-lap run average)." onClick={() => sortBy('best5')} style={{ cursor: 'pointer' }}>5-Lap{sortArrow('best5')}</th>
                  <th className="th-tip" data-tip="Best 10 consecutive laps." onClick={() => sortBy('best10')} style={{ cursor: 'pointer' }}>10-Lap{sortArrow('best10')}</th>
                  <th className="th-tip" data-tip="Best 15 consecutive laps." onClick={() => sortBy('best15')} style={{ cursor: 'pointer' }}>15-Lap{sortArrow('best15')}</th>
                  <th className="th-tip" data-tip="Best 20 consecutive laps." onClick={() => sortBy('best20')} style={{ cursor: 'pointer' }}>20-Lap{sortArrow('best20')}</th>
                  <th className="th-tip" data-tip="Best 25 consecutive laps." onClick={() => sortBy('best25')} style={{ cursor: 'pointer' }}>25-Lap{sortArrow('best25')}</th>
                  <th className="th-tip" data-tip="Best 30 consecutive laps. Blank = no run this long. Times climbing left-to-right = the car falls off on long runs." onClick={() => sortBy('best30')} style={{ cursor: 'pointer' }}>30-Lap{sortArrow('best30')}</th>
                  <th className="th-tip" data-tip="Representative green-flag laps used in grading versus total laps run.">Graded Laps</th>
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
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{d.best_lap?.toFixed(3) || '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{d.avg_pace?.toFixed(3) || '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{d.overall_avg?.toFixed(3) || '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{d.num_stints ?? '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#f0f0f0', background: heatBg(d.best5, 'best5') }}>{d.best5 ? d.best5.toFixed(2) : '-'}</td>
                       <td style={{ fontFamily: 'var(--font-mono)', color: '#f0f0f0', background: heatBg(d.best10, 'best10') }}>{d.best10 ? d.best10.toFixed(2) : '-'}</td>
                       <td style={{ fontFamily: 'var(--font-mono)', color: '#f0f0f0', background: heatBg(d.best15, 'best15') }}>{d.best15 ? d.best15.toFixed(2) : '-'}</td>
                       <td style={{ fontFamily: 'var(--font-mono)', color: '#f0f0f0', background: heatBg(d.best20, 'best20') }}>{d.best20 ? d.best20.toFixed(2) : '-'}</td>
                       <td style={{ fontFamily: 'var(--font-mono)', color: '#f0f0f0', background: heatBg(d.best25, 'best25') }}>{d.best25 ? d.best25.toFixed(2) : '-'}</td>
                       <td style={{ fontFamily: 'var(--font-mono)', color: '#f0f0f0', background: heatBg(d.best30, 'best30') }}>{d.best30 ? d.best30.toFixed(2) : '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{(() => { let n = null; try { n = JSON.parse(d.notes || 'null') } catch (e) { n = null }
                        const gl = n && n.gl != null ? n.gl : null
                        return <span>{gl != null ? gl + '/' : ''}{d.total_laps ?? '-'}</span> })()}</td>
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

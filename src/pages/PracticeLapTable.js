import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const SERIES_COLOR = { cup: 'var(--series-cup)', oreilly: 'var(--series-oreilly)', xfinity: 'var(--series-oreilly)', trucks: 'var(--series-trucks)' }
const SERIES_TABS = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks',  label: 'Truck Series' },
]

function fmtTime(sec) {
  if (sec == null || isNaN(sec)) return null
  const m = Math.floor(sec / 60)
  const s = (sec % 60).toFixed(3).padStart(6, '0')
  return m > 0 ? `${m}:${s}` : sec.toFixed(3)
}

// Map a normalized value 0 (fastest) → 1 (slowest) to a heatmap color
function heatColor(t) {
  // Green (fastest) → yellow → red (slowest), inflection at t=0.25
  let r, g, b
  if (t <= 0.25) {
    const f = t / 0.25
    r = Math.round(f * 255)
    g = Math.round(176 + f * (215 - 176))
    b = Math.round(80 * (1 - f))
  } else {
    const f = (t - 0.25) / 0.75
    r = Math.round(255 + f * (208 - 255))
    g = Math.round(215 * (1 - f))
    b = 0
  }
  return { bg: `rgb(${r},${g},${b})`, text: '#111' }
}
export default function PracticeLapTable({ isSubscriber }) {
  const [series, setSeries]               = useState('cup')
  const [sessions, setSessions]           = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [rows, setRows]                   = useState([])
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState(null)
  const [sortByAvg, setSortByAvg]         = useState(false)
  const [sortAscAvg, setSortAscAvg]       = useState(true)

  useEffect(() => {
    let cancelled = false
    setSessions([])
    setSelectedSession(null)
    setRows([])
    setError(null)

    supabase
      .rpc('get_practice_sessions', { p_series: series })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) { setError(err.message); return }
        const unique = (data || []).slice(0, 1).map(row => ({ ...row, key: `${row.year}|${row.track_name}|${row.session_number}` }))
        setSessions(unique)
        if (unique.length > 0) setSelectedSession(unique[0])
      })

    return () => { cancelled = true }
  }, [series])

  useEffect(() => {
    if (!selectedSession) { setRows([]); return }
    let cancelled = false
    setLoading(true)
    setRows([])

    supabase
      .from('practice_laps')
      .select('driver_name, car_number, starting_position, lap_number, lap_time')
      .eq('series', selectedSession.series)
      .eq('year', selectedSession.year)
      .eq('track_name', selectedSession.track_name)
      .eq('session_number', selectedSession.session_number)
      .order('lap_number', { ascending: true })
      .limit(50000)
      .then(async ({ data, error: err }) => {
        if (cancelled) return
        setLoading(false)
        if (err) { setError(err.message); return }
        const { data: entryData } = await supabase
          .from('entry_list')
          .select('driver_name, car_number')
          .eq('series', selectedSession.series)
          .eq('race_year', selectedSession.year)
          .eq('track_name', selectedSession.track_name)
        const normName = n => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\./g,'').replace(/\s+/g,' ').replace(/\s*jr\s*$/i,'').trim()
        const carMap = {}
        ;(entryData || []).forEach(e => { carMap[normName(e.driver_name)] = e.car_number })
        // CAR FALLBACK (2026-07-17): loop_data carries car numbers for completed races -- covers
        // sessions whose sheets lacked a Car column and weeks with no entry list loaded.
        let loopCarMap = {}
        let loopStartMap = {}
        try {
          const { data: loopCars } = await supabase
            .from('loop_data')
            .select('driver_name, car_number, start_position')
            .eq('series', selectedSession.series)
            .eq('year', selectedSession.year)
            .eq('track_name', selectedSession.track_name)
          ;(loopCars || []).forEach(e => { const k = normName(e.driver_name); if (e.car_number != null && !loopCarMap[k]) loopCarMap[k] = e.car_number; if (e.start_position != null && loopStartMap[k] == null) loopStartMap[k] = e.start_position })
        } catch (e2) {}
        const merged = (data || []).map(row => ({
          ...row,
          car_number: row.car_number || carMap[normName(row.driver_name)] || loopCarMap[normName(row.driver_name)] || null,
          starting_position: row.starting_position != null ? row.starting_position : (loopStartMap[normName(row.driver_name)] != null ? loopStartMap[normName(row.driver_name)] : null)
        }))
        setRows(merged)
      })

    return () => { cancelled = true }
  }, [selectedSession])

  const { drivers, lapNumbers, globalMin, globalMax } = useMemo(() => {
    if (!rows.length) return { drivers: [], lapNumbers: [], globalMin: 0, globalMax: 1 }

    const lapSet = new Set(rows.map(r => r.lap_number))
    const lapNumbers = [...lapSet].sort((a, b) => a - b)

    const driverMap = {}
    for (const row of rows) {
      if (!driverMap[row.driver_name]) {
        driverMap[row.driver_name] = {
          name: row.driver_name,
          car: row.car_number,
          startPos: row.starting_position,
          lapTimes: {},
        }
      }
      driverMap[row.driver_name].lapTimes[row.lap_number] = row.lap_time
    }

    const drivers = Object.values(driverMap).sort((a, b) => {
      if (a.startPos != null && b.startPos != null) return a.startPos - b.startPos
      if (a.startPos != null) return -1
      if (b.startPos != null) return 1
      const aAvg = Object.values(a.lapTimes).reduce((s, t) => s + t, 0) / Object.values(a.lapTimes).length
      const bAvg = Object.values(b.lapTimes).reduce((s, t) => s + t, 0) / Object.values(b.lapTimes).length
      return aAvg - bAvg
    })

    // Use 5th–95th percentile for color scale so tight lap time ranges spread visually
    const allTimesSorted = rows.map(r => r.lap_time).sort((a, b) => a - b)
    const median = allTimesSorted[Math.floor(allTimesSorted.length / 2)]
    const validTimes = allTimesSorted.filter(t => t < median * 1.5)
    const scale = validTimes.length ? validTimes : allTimesSorted
    const globalMin = scale[Math.floor(scale.length * 0.05)] ?? scale[0]
    const globalMax = scale[Math.floor(scale.length * 0.95)] ?? scale[scale.length - 1]

    return { drivers, lapNumbers, globalMin, globalMax }
  }, [rows])

  const normalizeTime = (t) => Math.min(1, Math.max(0, (t - globalMin) / Math.max(globalMax - globalMin, 0.001)))

  const avgLap = (d) => {
    const times = Object.values(d.lapTimes)
    return times.reduce((s, t) => s + t, 0) / times.length
  }

  const displayedDrivers = useMemo(() => {
    if (!sortByAvg) return drivers
    return [...drivers].sort((a, b) => {
      const diff = avgLap(a) - avgLap(b)
      return sortAscAvg ? diff : -diff
    })
  }, [drivers, sortByAvg, sortAscAvg])

  const handleAvgSort = () => {
    if (!sortByAvg) { setSortByAvg(true); setSortAscAvg(true) }
    else if (sortAscAvg) { setSortAscAvg(false) }
    else { setSortByAvg(false) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Lap By Lap Data</h1>
        <p className="page-subtitle">
          Full lap-by-lap breakdown — color coded fastest
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: 'hsl(120,90%,40%)', verticalAlign: 'middle', margin: '0 4px' }} />
          to slowest
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: 'hsl(0,90%,40%)', verticalAlign: 'middle', margin: '0 4px' }} />
          — click <strong>Avg Lap</strong> to sort
        </p>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
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

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontSize: '0.96rem', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="empty-state">
          <h3>No lap data yet</h3>
          <p>Upload a practice session in Admin to populate individual lap times.</p>
        </div>
      )}

      {sessions.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            {sessions.map(s => (
              <button
                key={s.key}
                onClick={() => setSelectedSession(s)}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.89rem', padding: '5px 12px',
                  background: selectedSession?.key === s.key ? 'var(--bg-elevated)' : 'transparent',
                  color: selectedSession?.key === s.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderColor: selectedSession?.key === s.key ? 'var(--accent)60' : 'var(--border)',
                }}
              >
                {s.track_name} {s.year} — S{s.session_number}
              </button>
            ))}
          </div>

          {loading && (
            <div className="empty-state">
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <p>Loading lap data…</p>
            </div>
          )}

          {!loading && displayedDrivers.length > 0 && (
            <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: '0.87rem', whiteSpace: 'nowrap', minWidth: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border)' }}>
                    <th style={stickyTh(0)}>Start</th>
                    <th style={stickyTh(52)}>Car</th>
                    <th style={stickyTh(104, 160)}>Driver</th>
                    <th
                      onClick={handleAvgSort}
                      style={{ ...th, textAlign: 'right', paddingRight: 12, borderRight: '1px solid var(--border)', cursor: 'pointer', userSelect: 'none', color: sortByAvg ? 'var(--accent)' : 'var(--text-secondary)' }}
                      title="Click to sort by Avg Lap"
                    >
                      Avg Lap {sortByAvg ? (sortAscAvg ? '▲' : '▼') : '⇅'}
                    </th>
                    {lapNumbers.map(n => (
                      <th key={n} style={{ ...th, textAlign: 'center', minWidth: 64 }}>{n}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedDrivers.map((d, ri) => {
                    const avg = avgLap(d)
                    return (
                      <tr
                        key={d.name}
                        style={{ background: ri % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}
                      >
                        <td style={stickyTd(0, ri)}>
                          {d.startPos != null ? (
                            <span style={{ fontFamily: 'var(--font-mono)', color: '#f59e0b', fontWeight: 600 }}>{d.startPos}</span>
                          ) : '—'}
                        </td>
                        <td style={stickyTd(52, ri)}>
                          {d.car && ((selectedSession.series === 'cup' || selectedSession.series === 'oreilly' || selectedSession.series === 'trucks') ? <img src={(selectedSession.series === 'cup' ? '/car-numbers/' : selectedSession.series === 'oreilly' ? '/car-numbers-oreilly/' : '/car-numbers-trucks/') + (({'133':'33'})[String(d.car)] || d.car) + '.png'} alt={'#' + d.car} style={{ height: 28, verticalAlign: 'middle' }} onError={(e)=>{e.target.style.display='none'}} /> : <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>{'#' + d.car}</span>)}
                        </td>
                        <td style={{ ...stickyTd(104, ri), minWidth: 160, fontWeight: 600, color: 'var(--text-primary)', borderRight: '1px solid var(--border)' }}>
                          {d.name}
                        </td>
                        <td style={{ padding: '5px 12px 5px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)', borderRight: '1px solid var(--border)' }}>
                          {fmtTime(avg)}
                        </td>
                        {lapNumbers.map(n => {
                          const t = d.lapTimes[n]
                          if (t == null) {
                            return <td key={n} style={{ padding: '4px 0', textAlign: 'center', color: 'var(--text-muted)', opacity: 0.3 }}>—</td>
                          }
                          const norm = normalizeTime(t)
                          const { bg, text } = heatColor(norm)
                          return (
                            <td
                              key={n}
                              title={`Lap ${n}: ${fmtTime(t)}`}
                              style={{ padding: '4px 6px', textAlign: 'center', background: bg, color: text, fontFamily: 'var(--font-mono)', fontWeight: 500, cursor: 'default' }}
                            >
                              {fmtTime(t)}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const th = {
  padding: '8px 6px',
  fontWeight: 700,
  fontSize: '0.83rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-secondary)',
  textAlign: 'left',
}

function stickyTh(left, minWidth = 52) {
  return {
    ...th,
    position: 'sticky',
    left,
    zIndex: 2,
    background: 'var(--bg-elevated)',
    minWidth,
    borderRight: left === 104 ? '1px solid var(--border)' : undefined,
  }
}

function stickyTd(left, rowIndex) {
  return {
    padding: '5px 6px',
    position: 'sticky',
    left,
    zIndex: 1,
    background: rowIndex % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)',
    textAlign: 'left',
    color: 'var(--text-secondary)',
  }
}

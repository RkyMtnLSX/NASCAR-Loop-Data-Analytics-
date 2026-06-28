import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const SERIES_TABS = [
  { value: 'cup',    label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks', label: 'Truck Series' },
]

// 12 distinct colors for driver lines
const DRIVER_COLORS = [
  '#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#ec4899',
  '#8b5cf6','#f97316','#14b8a6','#a3e635','#fb923c','#38bdf8',
]

function fmtTime(sec) {
  if (sec == null || isNaN(sec)) return '--'
  const m = Math.floor(sec / 60)
  const s = (sec % 60).toFixed(3).padStart(6, '0')
  return m > 0 ? `${m}:${s}` : `${sec.toFixed(3)}`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const sorted = [...payload].sort((a, b) => a.value - b.value)
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: '0.92rem',
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
        Lap {label}
      </div>
      {sorted.map(entry => (
        <div key={entry.dataKey} style={{
          display: 'flex', justifyContent: 'space-between', gap: 16,
          color: entry.color, marginBottom: 3,
        }}>
          <span style={{ fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.name}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {fmtTime(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function LapComparison({ isSubscriber }) {
  const [series, setSeries] = useState('cup')
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [allDrivers, setAllDrivers] = useState([])   // [{driver_name, car_number, laps:[{lap,time}]}]
  const [selectedDrivers, setSelectedDrivers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [noTable, setNoTable] = useState(false)

  // Load distinct sessions from practice_laps
  useEffect(() => {
    let cancelled = false
    setSessions([])
    setSelectedSession(null)
    setAllDrivers([])
    setSelectedDrivers([])
    setError(null)
    setNoTable(false)

    async function load() {
      const { data, error: err } = await supabase
        .rpc('get_practice_sessions', { p_series: series })

      if (cancelled) return

      if (err) {
        if (err.code === '42P01' || err.message?.includes('does not exist')) {
          setNoTable(true)
        } else {
          setError(err.message)
        }
        return
      }

      const unique = (data || []).slice(0, 1).map(row => ({ ...row, key: `${row.year}|${row.track_name}|${row.session_number}` }))
      setSessions(unique)
      if (unique.length > 0) setSelectedSession(unique[0])
    }

    load()
    return () => { cancelled = true }
  }, [series])

  // Load lap data for selected session
  useEffect(() => {
    if (!selectedSession) { setAllDrivers([]); setSelectedDrivers([]); return }
    let cancelled = false
    setLoading(true)
    setAllDrivers([])
    setSelectedDrivers([])

    async function load() {
      const { data, error: err } = await supabase
        .from('practice_laps')
        .select('driver_name, car_number, lap_number, lap_time, starting_position')
        .eq('series', selectedSession.series)
        .eq('year', selectedSession.year)
        .eq('track_name', selectedSession.track_name)
        .eq('session_number', selectedSession.session_number)
        .order('lap_number', { ascending: true })
      .limit(50000)

      if (cancelled) return
      setLoading(false)

      if (err) { setError(err.message); return }

      // Fetch entry list for car numbers (fallback if practice_laps.car_number is null)
      const { data: entryData } = await supabase
        .from('entry_list')
        .select('driver_name, car_number')
        .eq('series', selectedSession.series)
        .eq('race_year', selectedSession.year)
        .eq('track_name', selectedSession.track_name)
      const entryMap = {}
      for (const e of (entryData || [])) { entryMap[e.driver_name] = e.car_number }

      // Group by driver
      const map = {}
      for (const row of (data || [])) {
        if (!map[row.driver_name]) {
          map[row.driver_name] = { driver_name: row.driver_name, car_number: row.car_number || entryMap[row.driver_name] || null, starting_position: row.starting_position, laps: [] }
        }
        map[row.driver_name].laps.push({ lap: row.lap_number, time: row.lap_time })
      }

      // Filter pit/outlaps: any lap > 1.5x the driver's best is a pit stop lap
        Object.values(map).forEach(d => {
          const best = Math.min(...d.laps.map(l => l.time))
          d.laps = d.laps.filter(l => l.time <= best * 1.15)
        })

        const drivers = Object.values(map).sort((a, b) => {
          const aAvg = a.laps.reduce((s, l) => s + l.time, 0) / a.laps.length
          const bAvg = b.laps.reduce((s, l) => s + l.time, 0) / b.laps.length
          return aAvg - bAvg
        })

      setAllDrivers(drivers)
      // Default: select first 3 drivers
      setSelectedDrivers(drivers.slice(0, 3).map(d => d.driver_name))
    }

    load()
    return () => { cancelled = true }
  }, [selectedSession])

  // Build chart data: array of { lap: N, DriverName: time, ... }
  const chartData = (() => {
    const active = allDrivers.filter(d => selectedDrivers.includes(d.driver_name))
    if (!active.length) return []
    const maxLap = Math.max(...active.flatMap(d => d.laps.map(l => l.lap)))
    const laps = Array.from({ length: maxLap }, (_, i) => i + 1)
    return laps.map(lap => {
      const point = { lap }
      active.forEach(d => {
        const l = d.laps.find(x => x.lap === lap)
        point[d.driver_name] = l ? l.time : null
      })
      return point
    })
  })()

  const toggleDriver = (name) => {
    setSelectedDrivers(prev =>
      prev.includes(name) ? prev.filter(d => d !== name) : [...prev, name]
    )
  }

  // Y-axis domain: pad around min/max of visible laps
  const yDomain = (() => {
    const active = allDrivers.filter(d => selectedDrivers.includes(d.driver_name))
    if (!active.length) return ['auto', 'auto']
    const times = active.flatMap(d => d.laps.map(l => l.time))
    if (!times.length) return ['auto', 'auto']
    const mn = Math.min(...times)
    const mx = Math.max(...times)
    const pad = (mx - mn) * 0.1 || 0.5
    return [Math.floor((mn - pad) * 1000) / 1000, Math.ceil((mx + pad) * 1000) / 1000]
  })()

  if (noTable) return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Practice Comparison Tool</h1>
        <p className="page-subtitle">Head-to-head lap time comparison for matchup and group betting</p>
      </div>
      <div className="card" style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
        <h3 style={{ fontSize: '1.06rem', fontWeight: 600, marginBottom: 8 }}>Setup required</h3>
        <p style={{ fontSize: '0.96rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          The <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.89rem' }}>practice_laps</code> table doesn't exist yet. Run this SQL in your Supabase SQL editor, then re-upload a practice session from Admin:
        </p>
        <pre style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '12px 16px', fontSize: '0.89rem',
          fontFamily: 'var(--font-mono)', color: 'var(--text-primary)',
          overflowX: 'auto', whiteSpace: 'pre',
        }}>{`CREATE TABLE practice_laps (
  id bigint generated always as identity primary key,
  series text not null,
  year int not null,
  track_name text not null,
  session_number int not null,
  driver_name text not null,
  car_number text,
  lap_number int not null,
  lap_time float not null,
  created_at timestamptz default now()
);
CREATE INDEX ON practice_laps (series, year, track_name, session_number);`}</pre>
        <p style={{ fontSize: '0.89rem', color: 'var(--text-muted)', marginTop: 10 }}>
          After creating the table, re-upload a practice Excel file in Admin to populate lap data.
        </p>
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Practice Comparison Tool</h1>
        <p className="page-subtitle">Head-to-head lap time comparison for matchup and group betting</p>
      </div>

      {/* Series tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
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

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontSize: '0.96rem', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* No sessions */}
      {!loading && !error && sessions.length === 0 && (
        <div className="empty-state">
          <h3>No lap data yet</h3>
          <p>Upload a practice session in Admin to populate individual lap times.</p>
        </div>
      )}

      {sessions.length > 0 && (
        <>
          {/* Session selector */}
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
                {s.track_name} {s.year} - S{s.session_number}
              </button>
            ))}
          </div>

          {loading && (
            <div className="empty-state">
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <p>Loading lap data...</p>
            </div>
          )}

          {!loading && allDrivers.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>

              {/* Driver selector panel */}
              <div style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 0', maxHeight: '72vh', overflowY: 'auto',
              }}>
                <div style={{
                  fontSize: '0.83rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: 'var(--text-secondary)',
                  padding: '0 14px 10px', borderBottom: '1px solid var(--border)', marginBottom: 6,
                }}>
                  Select Drivers ({selectedDrivers.length} selected)
                </div>
                <div style={{ display: 'flex', gap: 6, padding: '6px 14px 8px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                  <button onClick={() => setSelectedDrivers(allDrivers.slice(0, 8).map(d => d.driver_name))}
                    style={{ fontSize: '0.83rem', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Top 8
                  </button>
                  <button onClick={() => setSelectedDrivers([])}
                    style={{ fontSize: '0.83rem', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Clear
                  </button>
                </div>
                {allDrivers.map((d, i) => {
                  const active = selectedDrivers.includes(d.driver_name)
                  const colorIdx = selectedDrivers.indexOf(d.driver_name)
                  const color = colorIdx >= 0 ? DRIVER_COLORS[colorIdx % DRIVER_COLORS.length] : 'var(--text-muted)'
                  return (
                    <div
                      key={d.driver_name}
                      onClick={() => toggleDriver(d.driver_name)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 14px', cursor: 'pointer',
                        background: active ? 'var(--bg-elevated)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                    >
                      <div style={{
                        width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                        background: active ? color : 'var(--bg-elevated)',
                        border: `2px solid ${active ? color : 'var(--border)'}`,
                        transition: 'all 0.15s',
                      }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.94rem', fontWeight: active ? 600 : 400, color: active ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {d.car_number ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: 5 }}>#{d.car_number}</span> : null}
                          {d.driver_name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {d.starting_position ? <span style={{ color: '#f59e0b', marginRight: 6 }}>P{d.starting_position}</span> : null}
                          {d.laps.length} laps - best {fmtTime(Math.min(...d.laps.map(l => l.time)))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Chart panel */}
              <div>
                {selectedDrivers.length === 0 ? (
                  <div className="empty-state" style={{ minHeight: 300 }}>
                    <p>Select at least one driver from the panel to see their lap times.</p>
                  </div>
                ) : (
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 12px 12px 4px' }}>
                    <ResponsiveContainer width="100%" height={420}>
                      <LineChart data={chartData} margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                        <XAxis
                          dataKey="lap"
                          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                          label={{ value: 'Lap', position: 'insideBottom', offset: -2, fontSize: 11, fill: 'var(--text-muted)' }}
                        />
                        <YAxis
                          domain={yDomain}
                          tickFormatter={fmtTime}
                          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                          width={64}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                          wrapperStyle={{ fontSize: '0.92rem', paddingTop: 8 }}
                          formatter={(value) => (
                            <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
                          )}
                        />
                        {selectedDrivers.map((name, idx) => (
                          <Line
                            key={name}
                            type="linear"
                            dataKey={name}
                            name={name}
                            stroke={DRIVER_COLORS[idx % DRIVER_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                            connectNulls={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>

                    {/* Stats table below chart */}
                    <div style={{ marginTop: 16, overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.92rem' }}>
                        <thead>
                          <tr>
                            {['Driver','Start','Laps','Best','Avg','Late Run Avg (last 25%)'].map(h => (
                              <th key={h} style={{ padding: '6px 12px', textAlign: h === 'Driver' ? 'left' : 'right', color: 'var(--text-secondary)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDrivers.map((name, idx) => {
                            const d = allDrivers.find(x => x.driver_name === name)
                            if (!d) return null
                            const times = d.laps.map(l => l.time)
                            const best = Math.min(...times)
                            const avg = times.reduce((s, t) => s + t, 0) / times.length
                            const lateCount = Math.max(1, Math.ceil(times.length * 0.25))
                            const late = times.slice(-lateCount).reduce((s, t) => s + t, 0) / lateCount
                            return (
                              <tr key={name} style={{ background: idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                                <td style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ width: 10, height: 10, borderRadius: 2, background: DRIVER_COLORS[idx % DRIVER_COLORS.length], flexShrink: 0 }} />
                                  {d.car_number && <img src={'/car-numbers/' + (({'133':'33'})[String(d.car_number)] || d.car_number) + '.png'} alt={'#' + d.car_number} style={{ height: 28, marginRight: 6, verticalAlign: 'middle' }} onError={(e)=>{e.target.style.display='none'}} />}
                                  <span style={{ fontWeight: 500 }}>{name}</span>
                                </td>
                                <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#f59e0b', fontWeight: 600 }}>
                                  {d.starting_position ? `P${d.starting_position}` : '--'}
                                </td>
                                <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{times.length}</td>
                                <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600 }}>{fmtTime(best)}</td>
                                <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtTime(avg)}</td>
                                <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: late < avg ? 'hsl(120,60%,50%)' : 'hsl(0,60%,50%)' }}>
                                  {fmtTime(late)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}
          </>
        )}
    </div>
  )
}

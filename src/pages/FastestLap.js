import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const YEARS = ['2022', '2023', '2024', '2025', '2026']
const TRACK_TYPES = ['All', 'Short Track', 'Superspeedway', 'Intermediate', 'Road Course', 'Other']

const MEDAL = { 1: 'ð¥', 2: 'ð¥', 3: 'ð¥' }
const MEDAL_BG = { 1: 'rgba(255,215,0,0.15)', 2: 'rgba(192,192,192,0.15)', 3: 'rgba(205,127,50,0.15)' }

// ââ Styles âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const sectionHead = {
  fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)',
  marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
}
const stickyHead = {
  position: 'sticky', left: 0, zIndex: 3,
  background: 'var(--bg-elevated)', textAlign: 'left',
  padding: '10px 16px', fontSize: '0.75rem', fontWeight: 600,
  color: 'var(--text-secondary)', whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)',
  minWidth: 200,
}
const numHead = {
  padding: '10px 12px', fontSize: '0.75rem', fontWeight: 600,
  color: 'var(--text-secondary)', textAlign: 'right',
  whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
}
const stickyCell = (bg) => ({
  position: 'sticky', left: 0, zIndex: 1, background: bg,
  padding: '8px 16px', fontSize: '0.8125rem', whiteSpace: 'nowrap',
  borderRight: '1px solid var(--border)', minWidth: 200,
})
const numCell = {
  padding: '8px 12px', fontSize: '0.8125rem',
  fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap',
}
const pillStyle = (active) => ({
  padding: '5px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
  fontSize: '0.8125rem', fontWeight: active ? 600 : 400,
  border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
  background: active ? 'var(--accent)' : 'transparent',
  color: active ? '#000' : 'var(--text-secondary)',
  fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
})
// ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function RaceTable({ rows, raceName, track }) {
  if (!rows.length) return (
    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '24px 0' }}>
      No data for this race.
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <h3 style={sectionHead}>{raceName}</h3>
        {track && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10 }}>{track}</div>}
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 760, width: '100%' }}>
          <thead>
            <tr>
              <th style={stickyHead}>Driver</th>
              <th style={numHead}>Car #</th>
              <th style={{ ...numHead, color: 'var(--accent)', fontWeight: 700 }}>Lap Time</th>
              <th style={numHead}>Speed (mph)</th>
              <th style={numHead}>Lap #</th>
              <th style={numHead}>Start</th>
              <th style={numHead}>Finish</th>
              <th style={numHead}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const rank = parseInt(r.rank) || i + 1
              const rowBg = MEDAL_BG[rank] || (i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)')
              return (
                <tr key={i} style={{ background: rowBg }}>
                  <td style={stickyCell(rowBg)}>
                    <span style={{ marginRight: 6, fontSize: '0.75rem', fontFamily: 'var(--font-mono)',
                      color: rank <= 3 ? 'var(--accent)' : 'var(--text-muted)', minWidth: 22, display: 'inline-block' }}>
                      {MEDAL[rank] || rank}
                    </span>
                    <span style={{ fontWeight: rank <= 3 ? 700 : 400 }}>{r.driver}</span>
                  </td>
                  <td style={numCell}>{r.car}</td>
                  <td style={{ ...numCell, color: 'var(--accent)', fontWeight: rank === 1 ? 700 : 400 }}>
                    {r.fastest_time}
                  </td>
                  <td style={numCell}>{r.fastest_speed ? parseFloat(r.fastest_speed).toFixed(2) : 'â'}</td>
                  <td style={numCell}>{r.fastest_lap_num}</td>
                  <td style={numCell}>{r.start_pos}</td>
                  <td style={numCell}>{r.finish_pos}</td>
                  <td style={{ ...numCell, textAlign: 'left', fontSize: '0.75rem',
                    color: r.status === 'Running' ? 'var(--text-secondary)' : '#e74c3c' }}>
                    {r.status}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SeasonSummaryTable({ rows }) {
  // Group by race, show only rank-1 (fastest) driver per race
  const raceMap = {}
  rows.forEach(r => {
    const key = r.race_name + '|' + r.race_date
    if (!raceMap[key] || parseInt(r.rank) < parseInt(raceMap[key].rank)) {
      raceMap[key] = r
    }
  })
  const raceRows = Object.values(raceMap).sort((a, b) => (a.race_date || '') < (b.race_date || '') ? -1 : 1)

  if (!raceRows.length) return (
    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '24px 0' }}>
      No data available.
    </div>
  )

  return (
    <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: 800, width: '100%' }}>
        <thead>
          <tr>
            <th style={stickyHead}>Race</th>
            <th style={numHead}>Date</th>
            <th style={numHead}>Track Type</th>
            <th style={numHead}>Driver</th>
            <th style={numHead}>Car #</th>
            <th style={{ ...numHead, color: 'var(--accent)', fontWeight: 700 }}>Fastest Time</th>
            <th style={numHead}>Speed (mph)</th>
          </tr>
        </thead>
        <tbody>
          {raceRows.map((r, i) => {
            const bg = i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)'
            return (
              <tr key={i} style={{ background: bg }}>
                <td style={{ ...stickyCell(bg), maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.race_name}
                </td>
                <td style={numCell}>{r.race_date}</td>
                <td style={{ ...numCell, textAlign: 'left', fontSize: '0.75rem' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontFamily: 'var(--font-sans)',
                    background: TRACK_TYPE_COLORS[r.track_type] || '#444',
                    color: '#fff', whiteSpace: 'nowrap' }}>
                    {r.track_type}
                  </span>
                </td>
                <td style={{ ...numCell, textAlign: 'left', fontWeight: 600 }}>{r.driver}</td>
                <td style={numCell}>{r.car}</td>
                <td style={{ ...numCell, color: 'var(--accent)', fontWeight: 600 }}>{r.fastest_time}</td>
                <td style={numCell}>{r.fastest_speed ? parseFloat(r.fastest_speed).toFixed(2) : 'â'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const TRACK_TYPE_COLORS = {
  'Short Track': '#2D6A4F',
  'Superspeedway': '#6A0572',
  'Intermediate': '#1B4F72',
  'Road Course': '#7B3F00',
  'Other': '#555',
}

export default function FastestLap({ isSubscriber }) {
  const [year, setYear]             = useState('2026')
  const [trackType, setTrackType]   = useState('All')
  const [races, setRaces]           = useState([])
  const [selectedRace, setSelectedRace] = useState('')
  const [raceRows, setRaceRows]     = useState([])
  const [allRows, setAllRows]       = useState([])
  const [view, setView]             = useState('race')  // 'race' | 'season'
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  // Load all rows for the selected year (+trackType filter)
  useEffect(() => {
    loadYear(year, trackType)
  }, [year, trackType]) // eslint-disable-line

  async function loadYear(yr, tt) {
    setLoading(true)
    setError(null)
    setRaceRows([])
    setSelectedRace('')
    try {
      let q = supabase.from('fastest_laps').select('*').eq('year', yr).order('race_date').order('rank')
      if (tt !== 'All') q = q.eq('track_type', tt)
      const { data, error: err } = await q
      if (err) throw err
      setAllRows(data || [])
      // Extract unique races in date order
      const seen = new Set()
      const raceList = []
      ;(data || []).forEach(r => {
        const key = r.race_name + '|' + r.race_date
        if (!seen.has(key)) { seen.add(key); raceList.push({ name: r.race_name, date: r.race_date }) }
      })
      setRaces(raceList)
      if (raceList.length) setSelectedRace(raceList[raceList.length - 1].name) // default to most recent
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Filter rows for selected race
  useEffect(() => {
    if (!selectedRace || !allRows.length) { setRaceRows([]); return }
    setRaceRows(allRows.filter(r => r.race_name === selectedRace).sort((a, b) => parseInt(a.rank) - parseInt(b.rank)))
  }, [selectedRace, allRows])

  const selectedRaceTrack = raceRows[0]?.track || ''

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Fastest Laps</h1>
        <p className="page-subtitle">Lap Raptor fastest lap data â NextGen era (2022â2026)</p>
      </div>

      {/* Year pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {YEARS.map(y => (
          <button key={y} onClick={() => setYear(y)} style={pillStyle(year === y)}>{y}</button>
        ))}
      </div>

      {/* Track type pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {TRACK_TYPES.map(tt => (
          <button key={tt} onClick={() => setTrackType(tt)} style={pillStyle(trackType === tt)}>{tt}</button>
        ))}
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {[['race', 'Race View'], ['season', 'Season Summary']].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            ...pillStyle(view === v),
            padding: '6px 16px',
          }}>{label}</button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#922B2120', border: '1px solid #922B2140',
          borderRadius: 'var(--radius-md)', color: '#E74C3C', fontSize: '0.8125rem', marginBottom: 24 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '32px 0' }}>Loadingâ¦</div>
      )}

      {!loading && !error && view === 'race' && (
        <>
          {/* Race selector */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ ...sectionHead, display: 'block', marginBottom: 8 }}>Select Race</label>
            <select
              value={selectedRace}
              onChange={e => setSelectedRace(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                color: 'var(--text-primary)', fontSize: '0.8125rem',
                fontFamily: 'var(--font-sans)', minWidth: 360, cursor: 'pointer',
              }}
            >
              {races.map(r => (
                <option key={r.name + r.date} value={r.name}>{r.date} â {r.name}</option>
              ))}
            </select>
            <span style={{ marginLeft: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {raceRows.length} drivers
            </span>
          </div>

          <RaceTable rows={raceRows} raceName={selectedRace} track={selectedRaceTrack} />
        </>
      )}

      {!loading && !error && view === 'season' && (
        <>
          <h3 style={{ ...sectionHead, marginBottom: 16 }}>Fastest Lap per Race â {year}</h3>
          <SeasonSummaryTable rows={allRows} />
        </>
      )}
    </div>
  )
}

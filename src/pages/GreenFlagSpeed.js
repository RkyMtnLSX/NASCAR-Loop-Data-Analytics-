import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const YEARS = ['2022', '2023', '2024', '2025', '2026']
const SERIES = [{ v: 'cup', label: 'Cup' }, { v: 'oreilly', label: "O'Reilly" }, { v: 'trucks', label: 'Trucks' }]
const TRACK_TYPES = ['All', 'Short Track', 'Superspeedway', 'Intermediate', 'Road Course', 'Other']
const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }
const TYPE_NORM = { intermediate: 'Intermediate', superspeedway: 'Superspeedway', short_track: 'Short Track', road_course: 'Road Course', oval: 'Intermediate' }

const sectionHead = { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }
const stickyHead = { position: 'sticky', left: 0, zIndex: 3, background: 'var(--bg-elevated)', textAlign: 'left', padding: '10px 16px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }
const numHead = { padding: '10px 12px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }
const stickyCell = (bg) => ({ position: 'sticky', left: 0, zIndex: 1, background: bg, padding: '8px 16px', fontSize: '0.8125rem', whiteSpace: 'nowrap', borderRight: '1px solid var(--border)', minWidth: 180 })
const numCell = { padding: '8px 12px', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }
const pillStyle = (active) => ({ padding: '5px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: active ? 600 : 400, border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'), background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text-secondary)' })

function shortTrackName(track) {
  return (track || '').split('(')[0].replace(/International/g, '').replace(/Superspeedway/g, '').replace(/Speedway/g, '').replace(/Raceway/g, '').replace(/Motor/g, '').split(' ').filter(Boolean).join(' ')
}

function rankColor(rank) {
  if (rank === 1) return 'rgba(255,215,0,0.55)'
  if (rank === 2) return 'rgba(192,192,192,0.5)'
  if (rank === 3) return 'rgba(205,127,50,0.5)'
  if (rank <= 10) return 'rgba(46,204,113,' + (0.30 - (rank - 4) * 0.035).toFixed(3) + ')'
  if (rank <= 20) return 'rgba(46,204,113,0.05)'
  return null
}

function HeatMapView({ rows }) {
  if (!rows.length) return <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '24px 0' }}>No data available.</div>
  const raceSeen = new Set()
  const races = []
  rows.forEach(r => { const key = r.race_name + '|' + r.race_date; if (!raceSeen.has(key)) { raceSeen.add(key); races.push({ name: r.race_name, date: r.race_date, track: r.track, key }) } })
  races.sort((a, b) => (a.date < b.date ? -1 : 1))
  const trackTotal = {}
  races.forEach(r => { const s = shortTrackName(r.track); trackTotal[s] = (trackTotal[s] || 0) + 1 })
  const trackIdx = {}
  const finalLabels = races.map(r => { const s = shortTrackName(r.track); trackIdx[s] = (trackIdx[s] || 0) + 1; return { ...r, label: trackTotal[s] > 1 ? s + ' ' + trackIdx[s] : s } })
  const driverMap = new Map()
  rows.forEach(r => {
    const key = r.race_name + '|' + r.race_date
    if (!driverMap.has(r.driver)) driverMap.set(r.driver, {})
    driverMap.get(r.driver)[key] = { rank: parseInt(r.gfs_rank), short: !!r.short_run }
  })
  const drivers = [...driverMap.entries()].map(([driver, rankMap]) => {
    const valid = Object.values(rankMap).filter(v => !v.short && !isNaN(v.rank) && v.rank > 0).map(v => v.rank)
    const avg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : Infinity
    return { driver, rankMap, avg, count: valid.length }
  }).sort((a, b) => a.avg - b.avg)
  const hasMulti = finalLabels.length > 1
  const LEGEND = [{ label: '1st', color: 'rgba(255,215,0,0.55)' }, { label: '2nd', color: 'rgba(192,192,192,0.5)' }, { label: '3rd', color: 'rgba(205,127,50,0.5)' }, { label: '4-10', color: 'rgba(46,204,113,0.25)' }]
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: 4 }}>GFS Rank:</span>
        {LEGEND.map(({ label, color }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 14, height: 14, background: color, border: '1px solid var(--border)', borderRadius: 2, display: 'inline-block' }} />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{label}</span>
          </span>
        ))}
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 8 }}>{'—'} = DNP &middot; dimmed = excluded (short run / DNF)</span>
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...stickyHead, minWidth: 180, zIndex: 4 }}>Driver</th>
              {hasMulti && <th style={{ ...numHead, minWidth: 52, fontWeight: 700, color: 'var(--accent)', textAlign: 'center' }}>Avg</th>}
              {finalLabels.map(r => (
                <th key={r.key} style={{ ...numHead, minWidth: 80, fontSize: '0.65rem', fontWeight: 600, padding: '8px 6px', whiteSpace: 'nowrap', textAlign: 'center' }} title={r.name + ' - ' + r.date}>{r.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.map((d, i) => {
              const rowBg = i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)'
              const isTop = d.avg <= 5 && d.count >= 2
              return (
                <tr key={d.driver}>
                  <td style={{ ...stickyCell(rowBg), fontWeight: isTop ? 700 : 400 }}>
                    {isTop && <span style={{ marginRight: 6, fontSize: '0.7rem' }}>{'⚡'}</span>}
                    {d.driver}
                  </td>
                  {hasMulti && <td style={{ ...numCell, fontWeight: 700, background: rowBg, textAlign: 'center', color: isTop ? 'var(--accent)' : d.avg <= 15 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{isFinite(d.avg) ? d.avg.toFixed(1) : '—'}</td>}
                  {finalLabels.map(r => {
                    const cell = d.rankMap[r.key]
                    if (!cell) return <td key={r.key} style={{ padding: '7px 8px', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', textAlign: 'center', color: 'var(--text-muted)', background: rowBg }}>{'—'}</td>
                    const bg = cell.short ? rowBg : (rankColor(cell.rank) || rowBg)
                    return (
                      <td key={r.key} title={cell.short ? 'rank excluded due to DNF' : ''} style={{ padding: '7px 8px', fontSize: '0.78rem', fontFamily: 'var(--font-mono)', textAlign: 'center', background: bg, opacity: cell.short ? 0.35 : 1, fontStyle: cell.short ? 'italic' : 'normal', color: cell.rank <= 3 && !cell.short ? '#111' : 'var(--text-primary)' }}>
                        {cell.short ? cell.rank : (MEDAL[cell.rank] || cell.rank)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RaceTable({ rows }) {
  if (!rows.length) return null
  const sorted = [...rows].sort((a, b) => parseFloat(b.green_flag_speed) - parseFloat(a.green_flag_speed))
  return (
    <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr>
          <th style={{ ...numHead, textAlign: 'center', width: 60 }}>Rank</th>
          <th style={stickyHead}>Driver</th>
          <th style={numHead}>Car</th>
          <th style={numHead}>Green Flag Speed</th>
          <th style={numHead}>Finish</th>
        </tr></thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.id || i} title={r.short_run ? 'rank excluded due to DNF' : ''} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)', opacity: r.short_run ? 0.4 : 1 }}>
              <td style={{ ...numCell, textAlign: 'center' }}>{MEDAL[r.gfs_rank] || r.gfs_rank}</td>
              <td style={stickyCell(i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)')}>{r.driver}{r.short_run ? <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: 6 }}>(excluded)</span> : null}</td>
              <td style={{ ...numCell, color: 'var(--text-muted)' }}>{r.car}</td>
              <td style={numCell}>{parseFloat(r.green_flag_speed).toFixed(3)}</td>
              <td style={{ ...numCell, color: 'var(--text-muted)' }}>{r.finish_pos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function GreenFlagSpeed() {
  const [series, setSeries] = useState('cup')
  const [year, setYear] = useState('2025')
  const [trackType, setTrackType] = useState('All')
  const [allRows, setAllRows] = useState([])
  const [typeMap, setTypeMap] = useState({})
  const [selectedRace, setSelectedRace] = useState('')
  const [view, setView] = useState('heat')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.from('tracks').select('name, track_type').then(({ data }) => {
      const m = {}
      ;(data || []).forEach(t => { m[t.name] = TYPE_NORM[t.track_type] || 'Other' })
      setTypeMap(m)
    })
  }, [])

  useEffect(() => { loadData() }, [series, year]) // eslint-disable-line

  async function loadData() {
    setLoading(true); setError(null); setSelectedRace('')
    try {
      let all = []; let from = 0
      while (true) {
        const { data, error: e } = await supabase.from('green_flag_speed').select('*').eq('series', series).eq('year', parseInt(year)).order('race_date').order('gfs_rank').range(from, from + 999)
        if (e) throw e
        all = all.concat(data || [])
        if (!data || data.length < 1000) break
        from += 1000
      }
      setAllRows(all)
      if (!all.length) setError('No green flag speed data for this series/year yet.')
    } catch (e) { setError('Error: ' + (e.message || e)) }
    setLoading(false)
  }

  const typeOf = (track) => {
    if (typeMap[track]) return typeMap[track]
    const s = (track || '').toLowerCase()
    if (s.includes('road course') || s.includes('street') || s.includes('circuit') || s.includes('sonoma') || s.includes('watkins') || s.includes('road america') || s.includes('mid-ohio') || s.includes('lime rock') || s.includes('portland') || s.includes('roval')) return 'Road Course'
    if (s.includes('dirt') || s.includes('coliseum') || s.includes('bowman gray') || s.includes('wilkesboro') || s.includes('bristol') || s.includes('martinsville') || s.includes('richmond') || s.includes('iowa') || s.includes('milwaukee') || s.includes('knoxville')) return 'Short Track'
    if (s.includes('daytona') || s.includes('talladega')) return 'Superspeedway'
    return 'Other'
  }
  const filtered = trackType === 'All' ? allRows : allRows.filter(r => typeOf(r.track) === trackType)
  const raceSeen = new Set(); const raceOpts = []
  filtered.forEach(r => { const k = r.race_name + '|' + r.race_date; if (!raceSeen.has(k)) { raceSeen.add(k); raceOpts.push({ k, label: r.race_name + ' (' + (r.race_date || r.report_date) + ')' }) } })
  const raceRows = selectedRace ? filtered.filter(r => (r.race_name + '|' + r.race_date) === selectedRace) : []

  return (
    <div className="page" style={{ maxWidth: 1400, padding: '28px 24px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>Green Flag Speed</h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>Average green-flag speed rank by driver and race. Drivers who completed under 40% of a race are dimmed and excluded from their season average.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {SERIES.map(s => <span key={s.v} onClick={() => setSeries(s.v)} style={pillStyle(series === s.v)}>{s.label}</span>)}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {YEARS.map(y => <span key={y} onClick={() => setYear(y)} style={pillStyle(year === y)}>{y}</span>)}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {TRACK_TYPES.map(t => <span key={t} onClick={() => setTrackType(t)} style={pillStyle(trackType === t)}>{t}</span>)}
        <span style={{ flex: 1 }} />
        <span onClick={() => setView('heat')} style={pillStyle(view === 'heat')}>Heat Map</span>
        <span onClick={() => setView('race')} style={pillStyle(view === 'race')}>By Race</span>
      </div>

      {loading && <div style={{ color: 'var(--text-muted)', padding: 30, textAlign: 'center' }}>Loading{'…'}</div>}
      {error && !loading && <div style={{ color: 'var(--text-muted)', padding: 30, textAlign: 'center' }}>{error}</div>}
      {!loading && !error && view === 'heat' && <HeatMapView rows={filtered} />}
      {!loading && !error && view === 'race' && (
        <div>
          <select value={selectedRace} onChange={e => setSelectedRace(e.target.value)} style={{ padding: '8px 10px', marginBottom: 16, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, minWidth: 320 }}>
            <option value="">Select a race{'…'}</option>
            {raceOpts.map(o => <option key={o.k} value={o.k}>{o.label}</option>)}
          </select>
          <RaceTable rows={raceRows} />
        </div>
      )}
    </div>
  )
}

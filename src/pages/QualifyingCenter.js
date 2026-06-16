import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── Helpers ────────────────────────────────────────────────────────────────────

const TRACK_ABBR = {
  'Circuit of the Americas': 'COTA',
  'Autodromo Hermanos Rodriguez': 'Mexico',
  'Grant Park Chicago': 'Chicago',
  'Chicago Street Course': 'Chicago',
  'Sonoma Raceway': 'Sonoma',
  'Watkins Glen International': 'WG',
  'Charlotte Motor Speedway Roval': 'Roval',
  'Indianapolis Motor Speedway Road Course': 'Indy RC',
  'Indianapolis Motor Speedway': 'Indy',
  'Indianapolis Grand Prix Circuit': 'Indy GP',
  'Road America': 'Road Am',
  'Mid-Ohio Sports Car Course': 'Mid-Ohio',
  'Portland International Raceway': 'Portland',
  'Pocono Raceway': 'Pocono',
  'Bristol Motor Speedway': 'Bristol',
  'Nashville Superspeedway': 'Nashville',
  'New Hampshire Motor Speedway': 'NHMS',
  'Michigan International Speedway': 'Michigan',
  'Atlanta Motor Speedway': 'Atlanta',
  'Talladega Superspeedway': 'Talladega',
  'Daytona International Speedway': 'Daytona',
  'Las Vegas Motor Speedway': 'Las Vegas',
  'Phoenix Raceway': 'Phoenix',
  'Homestead-Miami Speedway': 'Homestead',
  'Dover Motor Speedway': 'Dover',
  'Kansas Speedway': 'Kansas',
  'Charlotte Motor Speedway': 'Charlotte',
  'Texas Motor Speedway': 'Texas',
  'Richmond Raceway': 'Richmond',
  'Martinsville Speedway': 'Martinsville',
  'North Wilkesboro Speedway': 'NWB',
}

const ROAD_COURSES = [
  'Circuit of the Americas', 'Autodromo Hermanos Rodriguez',
  'Grant Park Chicago', 'Chicago Street Course', 'Sonoma Raceway',
  'Watkins Glen International', 'Charlotte Motor Speedway Roval',
  'Indianapolis Motor Speedway Road Course', 'Road America',
  'Mid-Ohio Sports Car Course', 'Portland International Raceway',
]
const SUPERSPEEDWAYS = [
  'Daytona International Speedway', 'Talladega Superspeedway', 'Atlanta Motor Speedway',
]
const SHORT_TRACKS_2LAP = [
  'Bristol Motor Speedway', 'Iowa Speedway', 'Martinsville Speedway',
  'North Wilkesboro Speedway', 'Richmond Raceway',
]

function qualFormat(trackName) {
  if (!trackName) return 'oval'
  if (ROAD_COURSES.some(t => trackName.includes(t.split(' ')[0]))) return 'road'
  if (SUPERSPEEDWAYS.some(t => trackName.includes(t.split(' ')[0]))) return 'superspeedway'
  if (SHORT_TRACKS_2LAP.some(t => trackName.includes(t.split(' ')[0]))) return 'short-track'
  return 'oval'
}

const QUAL_FORMAT_LABELS = {
  'road': { label: 'Road Course', color: '#6366f1', desc: 'Open session per group' },
  'superspeedway': { label: 'Superspeedway', color: '#f59e0b', desc: '2 rounds - top 10 advance' },
  'short-track': { label: 'Short Track', color: '#22c55e', desc: '1 round - 2 laps' },
  'oval': { label: 'Oval', color: '#64748b', desc: '1 round - 1 lap' },
}

function trackAbbr(trackName) {
  if (!trackName) return '?'
  for (const [full, abbr] of Object.entries(TRACK_ABBR)) {
    if (trackName.toLowerCase().includes(full.toLowerCase().split(' ')[0].toLowerCase())) return abbr
  }
  const words = trackName.split(' ').filter(w => w.length > 2)
  if (words.length >= 2) return words[0].substring(0, 3)
  return trackName.substring(0, 4)
}

function eventLabel(trackName, year) {
  return trackAbbr(trackName) + " '" + String(year).slice(2)
}

function heatColor(pos, totalDrivers) {
  if (totalDrivers === undefined) totalDrivers = 40
  if (pos == null) return { bg: 'transparent', text: 'var(--text-muted)', opacity: 0.3 }
  const pct = (pos - 1) / Math.max(totalDrivers - 1, 1)
  let r, g, b
  if (pct <= 0.4) {
    r = Math.round(pct / 0.4 * 200)
    g = Math.round(180 - pct / 0.4 * 20)
    b = 0
  } else if (pct <= 0.7) {
    const t = (pct - 0.4) / 0.3
    r = Math.round(200 + t * 55)
    g = Math.round(160 - t * 100)
    b = 0
  } else {
    const t = (pct - 0.7) / 0.3
    r = 220
    g = Math.round(60 - t * 60)
    b = 0
  }
  const textColor = pct < 0.55 ? '#0a0a0a' : '#fff'
  return { bg: 'rgba(' + r + ',' + g + ',' + b + ',0.75)', text: textColor }
}

function runSimulation(drivers, numSims, nudge) {
  if (numSims === undefined) numSims = 2000
  if (nudge === undefined) nudge = 0
  const results = drivers.map(function(driver) {
    const positions = driver.historicalPositions.filter(function(p) { return p != null })
    if (positions.length === 0) return Object.assign({}, driver, { simMean: null, simP10: null, simP90: null })
    const mean = positions.reduce(function(a, b) { return a + b }, 0) / positions.length
    const variance = positions.reduce(function(s, p) { return s + (p - mean) * (p - mean) }, 0) / positions.length
    const stdDev = Math.max(Math.sqrt(variance), nudge) || 3
    const samples = []
    for (let i = 0; i < numSims; i++) {
      const u1 = Math.random(), u2 = Math.random()
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      const sample = Math.round(Math.max(1, mean + z * stdDev))
      samples.push(sample)
    }
    samples.sort(function(a, b) { return a - b })
    return Object.assign({}, driver, {
      simMean: mean,
      simExpected: Math.round(samples[Math.floor(numSims * 0.5)]),
      simP10: samples[Math.floor(numSims * 0.1)],
      simP90: samples[Math.floor(numSims * 0.9)],
      sampleCount: positions.length,
    })
  })
  return results.sort(function(a, b) {
    if (a.simMean == null) return 1
    if (b.simMean == null) return -1
    return a.simMean - b.simMean
  })
}

// Paywall stub
function SubscribePrompt() {
  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <div className="page-header">
        <h1 className="page-title">Qualifying Center</h1>
        <p className="page-subtitle">Qualifying heatmap &amp; simulation</p>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>&#127937;</div>
        <h3 style={{ marginBottom: 8 }}>Subscriber Feature</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 20 }}>
          Qualifying heatmaps, historical averages, and simulations are available to subscribers.
        </p>
        <a href="/subscribe" className="btn btn-primary">Subscribe to Unlock</a>
      </div>
    </div>
  )
}

export default function QualifyingCenter({ isSubscriber }) {
  const [config, setConfig] = useState(null)
  const [simConfig, setSimConfig] = useState(null)
  const [qualData, setQualData] = useState([])
  const [corrTracks, setCorrTracks] = useState([])
  const [entryList, setEntryList] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [simResults, setSimResults] = useState(null)
  const [simRunning, setSimRunning] = useState(false)
  const [sortBy, setSortBy] = useState('avg')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: cfg, error: cfgErr } = await supabase
        .from('featured_weekend')
        .select('*')
        .eq('series', 'cup')
        .single()
      if (cfgErr || !cfg) throw new Error('No Cup Series weekend configured yet.')
      setConfig(cfg)

      const { data: sc } = await supabase
        .from('qual_sim_config')
        .select('*')
        .eq('series', 'cup')
        .single()
      setSimConfig(sc || null)

      const { data: trackRows } = await supabase
        .from('tracks')
        .select('name')
        .eq('correlation_group_label', cfg.correlation_label)
        .order('name')
      const corrTrackNames = (trackRows || []).map(function(t) { return t.name })
      setCorrTracks(corrTrackNames)

      const allTrackNames = Array.from(new Set([cfg.track_name].concat(corrTrackNames)))
      const { data: rows, error: rowErr } = await supabase
        .from('qualifying_results')
        .select('driver_name, car_number, track_name, year, qualifying_position, qualifying_speed')
        .eq('series', 'cup')
        .in('track_name', allTrackNames)
        .order('qualifying_position')
      if (rowErr) throw rowErr
      setQualData(rows || [])

      const { data: elRows } = await supabase
        .from('entry_list')
        .select('driver_name')
        .eq('series', 'cup')
        .eq('race_year', cfg.correlation_year)
        .eq('track_name', cfg.track_name)
      setEntryList(elRows && elRows.length > 0
        ? elRows.map(function(r) { return r.driver_name.replace(/\s*\(i\)\s*$/, '').trim() })
        : null)

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(function() { loadData() }, [loadData])

  if (!isSubscriber) return <SubscribePrompt />

  if (!config) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Qualifying Center</h1>
        </div>
        {loading && (
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p>Loading...</p>
          </div>
        )}
        {error && <div style={{ color: '#ef4444', padding: 16 }}>{error}</div>}
      </div>
    )
  }

  const trackYears = config.track_years || []
  const corrYear = config.correlation_year || new Date().getFullYear()
  const simCorrYears = (simConfig && simConfig.sim_corr_years) ? simConfig.sim_corr_years : []
  const fmt = qualFormat(config.track_name)

  // Only show columns where qualifying data actually exists
  const trackYearCombosWithData = new Set(qualData.map(function(r) { return r.track_name + '_' + r.year }))

  const histCols = trackYears
    .filter(function(yr) { return trackYearCombosWithData.has(config.track_name + '_' + yr) })
    .map(function(yr) {
      return { key: 'hist_' + yr, label: eventLabel(config.track_name, yr), trackName: config.track_name, year: yr }
    })

  const corrCols = corrTracks
    .filter(function(t) { return t !== config.track_name })
    .map(function(t) {
      return { key: 'corr_' + t + '_' + corrYear, label: eventLabel(t, corrYear), trackName: t, year: corrYear }
    })
    .filter(function(col) { return trackYearCombosWithData.has(col.trackName + '_' + col.year) })

  const featuredCurrYear = (!trackYears.includes(corrYear) && trackYearCombosWithData.has(config.track_name + '_' + corrYear)) ? [{
    key: 'feat_curr_' + corrYear,
    label: eventLabel(config.track_name, corrYear),
    trackName: config.track_name,
    year: corrYear,
  }] : []

  const allCols = histCols.concat(featuredCurrYear).concat(corrCols)

  const driverMap = {}
  for (const row of qualData) {
    if (!driverMap[row.driver_name]) {
      driverMap[row.driver_name] = { driver: row.driver_name, carNumber: row.car_number, positions: {} }
    }
    driverMap[row.driver_name].positions[row.track_name + '_' + row.year] = row.qualifying_position
  }

  for (const d of Object.values(driverMap)) {
    const histPositions = trackYears
      .map(function(yr) { return d.positions[config.track_name + '_' + yr] })
      .filter(function(p) { return p != null })
    d.trackAvg = histPositions.length > 0
      ? histPositions.reduce(function(a, b) { return a + b }, 0) / histPositions.length
      : null

    const corrYearPositions = corrCols
      .map(function(col) { return d.positions[col.trackName + '_' + col.year] })
      .filter(function(p) { return p != null })
    d.corrYearAvg = corrYearPositions.length > 0
      ? corrYearPositions.reduce(function(a, b) { return a + b }, 0) / corrYearPositions.length
      : null

    if (simCorrYears.length > 0) {
      d.historicalPositions = []
      for (const yr of simCorrYears) {
        const fp = d.positions[config.track_name + '_' + yr]
        if (fp != null) d.historicalPositions.push(fp)
        for (const ct of corrTracks.filter(function(t) { return t !== config.track_name })) {
          const cp = d.positions[ct + '_' + yr]
          if (cp != null) d.historicalPositions.push(cp)
        }
      }
    } else {
      d.historicalPositions = histPositions
    }
  }

  const allPositions = qualData.map(function(r) { return r.qualifying_position }).filter(function(p) { return p != null })
  const totalDrivers = allPositions.length > 0 ? Math.max.apply(null, allPositions) : 40

  let rows = Object.values(driverMap)
  if (entryList && entryList.length > 0) {
    rows = rows.filter(function(r) { return entryList.includes(r.driver) })
  }

  if (sortBy === 'avg') {
    rows.sort(function(a, b) {
      if (a.trackAvg == null && b.trackAvg == null) return a.driver.localeCompare(b.driver)
      if (a.trackAvg == null) return 1
      if (b.trackAvg == null) return -1
      return a.trackAvg - b.trackAvg
    })
  } else {
    rows.sort(function(a, b) { return a.driver.localeCompare(b.driver) })
  }

  const nudgeVal = simConfig
    ? (fmt === 'oval' ? (simConfig.nudge_oval || 0)
      : fmt === 'short-track' ? (simConfig.nudge_short_track || 0)
      : fmt === 'superspeedway' ? (simConfig.nudge_superspeedway || 0)
      : (simConfig.nudge_road || 0))
    : 0

  function handleRunSim() {
    setSimRunning(true)
    setTimeout(function() {
      const simInput = rows.map(function(r) {
        return { driver: r.driver, carNumber: r.carNumber, trackAvg: r.trackAvg, historicalPositions: r.historicalPositions }
      })
      setSimResults(runSimulation(simInput, 2000, nudgeVal))
      setSimRunning(false)
    }, 50)
  }

  const thStyle = {
    padding: '8px 6px', fontWeight: 700, fontSize: '0.65rem',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    color: 'var(--text-secondary)', textAlign: 'center',
    whiteSpace: 'nowrap', background: 'var(--bg-elevated)',
    borderBottom: '2px solid var(--border)',
  }
  const tdBase = {
    padding: '5px 6px', textAlign: 'center',
    fontSize: '0.8rem', fontFamily: 'var(--font-mono)',
    borderBottom: '1px solid var(--border)',
  }

  const hasData = rows.length > 0 && allCols.length > 0
  const showSimPanel = simConfig ? (simConfig.show_sim || false) : false
  const showCorrAvgCol = corrCols.length > 1

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Qualifying Center</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
            Cup Series &middot; {config.track_name} &middot; {config.correlation_label}
            {(function() {
              const fmtInfo = QUAL_FORMAT_LABELS[fmt]
              return (
                <span style={{
                  display: 'inline-block', marginLeft: 10, fontSize: '0.65rem', fontWeight: 700,
                  letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 20,
                  background: fmtInfo.color + '22', color: fmtInfo.color,
                  border: '1px solid ' + fmtInfo.color + '55',
                  textTransform: 'uppercase', verticalAlign: 'middle', cursor: 'default',
                }} title={fmtInfo.desc}>{fmtInfo.label}</span>
              )
            })()}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadData} disabled={loading}
          style={{ fontSize: '0.75rem', padding: '5px 14px' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 20, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '0.8125rem' }}>
          {error}
        </div>
      )}

      {loading && !hasData && (
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p>Loading qualifying data...</p>
        </div>
      )}

      {!loading && !hasData && (
        <div className="empty-state">
          <h3>No qualifying data loaded yet</h3>
          <p>Use Admin to load qualifying results from Racing Reference.</p>
        </div>
      )}

      {hasData && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['avg', 'Avg @ ' + trackAbbr(config.track_name)], ['name', 'A-Z']].map(function(item) {
                const val = item[0], lbl = item[1]
                return (
                  <button key={val} onClick={function() { setSortBy(val) }} style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem',
                    border: '1px solid var(--border)',
                    background: sortBy === val ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: sortBy === val ? '#fff' : 'var(--text-secondary)', cursor: 'pointer',
                  }}>{lbl}</button>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>P1</span>
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map(function(pct) {
                const hc = heatColor(Math.round(pct * (totalDrivers - 1)) + 1, totalDrivers)
                return <div key={pct} style={{ width: 18, height: 12, borderRadius: 3, background: hc.bg }} />
              })}
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Last</span>
            </div>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 28 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  <th style={Object.assign({}, thStyle, { textAlign: 'center', width: 36 })}>#</th>
                  <th style={Object.assign({}, thStyle, { textAlign: 'left', paddingLeft: 14, minWidth: 170, position: 'sticky', left: 0, zIndex: 2 })}>Driver</th>
                  <th style={Object.assign({}, thStyle, { minWidth: 72, color: 'var(--accent)' })}>
                    Avg<br /><span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{trackAbbr(config.track_name)}</span>
                  </th>
                  {histCols.length > 0 && (
                    <th colSpan={histCols.length} style={Object.assign({}, thStyle, { borderLeft: '2px solid rgba(99,102,241,0.3)', color: 'var(--accent)', opacity: 0.7 })}>
                      {config.track_name.split(' ').slice(0, 2).join(' ')} History
                    </th>
                  )}
                  {featuredCurrYear.map(function(col) {
                    return <th key={col.key} style={Object.assign({}, thStyle, { borderLeft: '2px solid rgba(99,102,241,0.5)', color: 'var(--accent)' })}>{col.label}</th>
                  })}
                  {corrCols.length > 0 && (
                    <th colSpan={corrCols.length} style={Object.assign({}, thStyle, { borderLeft: '2px solid var(--border)', color: 'var(--text-secondary)' })}>
                      {config.correlation_label} &middot; {corrYear}
                    </th>
                  )}
                  {showCorrAvgCol && (
                    <th style={Object.assign({}, thStyle, { borderLeft: '2px solid rgba(99,102,241,0.2)', color: '#a78bfa' })}>
                      Corr<br />Avg
                    </th>
                  )}
                </tr>
                <tr>
                  <th style={thStyle} />
                  <th style={Object.assign({}, thStyle, { textAlign: 'left', paddingLeft: 14, position: 'sticky', left: 0, zIndex: 2 })} />
                  <th style={thStyle} />
                  {histCols.map(function(col, i) {
                    return <th key={col.key} style={Object.assign({}, thStyle, i === 0 ? { borderLeft: '2px solid rgba(99,102,241,0.3)' } : {})}>{col.label}</th>
                  })}
                  {featuredCurrYear.map(function(col) {
                    return <th key={col.key} style={Object.assign({}, thStyle, { borderLeft: '2px solid rgba(99,102,241,0.5)' })}>{col.label}</th>
                  })}
                  {corrCols.map(function(col, i) {
                    return <th key={col.key} style={Object.assign({}, thStyle, i === 0 ? { borderLeft: '2px solid var(--border)' } : {})}>{col.label}</th>
                  })}
                  {showCorrAvgCol && <th style={Object.assign({}, thStyle, { borderLeft: '2px solid rgba(99,102,241,0.2)' })} />}
                </tr>
              </thead>
              <tbody>
                {rows.map(function(row, ri) {
                  const avgColor = row.trackAvg ? heatColor(Math.round(row.trackAvg), totalDrivers) : null
                  const corrAvgColor = row.corrYearAvg ? heatColor(Math.round(row.corrYearAvg), totalDrivers) : null
                  const rowBg = ri % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)'
                  return (
                    <tr key={row.driver} style={{ background: rowBg }}>
                      <td style={Object.assign({}, tdBase, { color: 'var(--text-muted)', fontSize: '0.72rem' })}>{ri + 1}</td>
                      <td style={Object.assign({}, tdBase, {
                        textAlign: 'left', paddingLeft: 14, fontFamily: 'var(--font-sans)',
                        fontWeight: ri < 5 ? 600 : 400, color: 'var(--text-primary)',
                        position: 'sticky', left: 0, background: rowBg, zIndex: 1,
                      })}>
                        {row.carNumber && (
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.7rem', marginRight: 6 }}>#{row.carNumber}</span>
                        )}
                        {row.driver}
                      </td>
                      <td style={Object.assign({}, tdBase, {
                        background: avgColor ? avgColor.bg : 'transparent',
                        color: avgColor ? avgColor.text : 'var(--text-muted)',
                        fontWeight: 700,
                      })}>
                        {row.trackAvg != null ? row.trackAvg.toFixed(1) : '-'}
                      </td>
                      {histCols.map(function(col, i) {
                        const pos = row.positions[col.trackName + '_' + col.year]
                        const hc = heatColor(pos, totalDrivers)
                        return (
                          <td key={col.key} style={Object.assign({}, tdBase, i === 0 ? { borderLeft: '2px solid rgba(99,102,241,0.3)' } : {}, { background: hc.bg, color: hc.text })}>
                            {pos != null ? pos : '-'}
                          </td>
                        )
                      })}
                      {featuredCurrYear.map(function(col) {
                        const pos = row.positions[col.trackName + '_' + col.year]
                        const hc = heatColor(pos, totalDrivers)
                        return (
                          <td key={col.key} style={Object.assign({}, tdBase, { borderLeft: '2px solid rgba(99,102,241,0.5)', background: hc.bg, color: hc.text })}>
                            {pos != null ? pos : '-'}
                          </td>
                        )
                      })}
                      {corrCols.map(function(col, i) {
                        const pos = row.positions[col.trackName + '_' + col.year]
                        const hc = heatColor(pos, totalDrivers)
                        return (
                          <td key={col.key} style={Object.assign({}, tdBase, i === 0 ? { borderLeft: '2px solid var(--border)' } : {}, { background: hc.bg, color: hc.text })}>
                            {pos != null ? pos : '-'}
                          </td>
                        )
                      })}
                      {showCorrAvgCol && (
                        <td style={Object.assign({}, tdBase, {
                          borderLeft: '2px solid rgba(99,102,241,0.2)',
                          background: corrAvgColor ? corrAvgColor.bg : 'transparent',
                          color: corrAvgColor ? corrAvgColor.text : 'var(--text-muted)',
                          fontWeight: 600,
                        })}>
                          {row.corrYearAvg != null ? row.corrYearAvg.toFixed(1) : '-'}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.6 }}>
            Avg column = mean qualifying position at {config.track_name} across {trackYears.join(', ') || 'selected years'}.
            Lower = better qualifier. Use as baseline for PrizePicks over/under picks.
          </p>

          {showSimPanel && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0 }}>Qualifying Simulation</h2>
                <span style={{
                  fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: 20,
                  background: 'rgba(99,102,241,0.12)', color: 'var(--accent)',
                  border: '1px solid rgba(99,102,241,0.3)', textTransform: 'uppercase',
                }}>BETA</span>
                <button className="btn btn-secondary" onClick={handleRunSim} disabled={simRunning}
                  style={{ fontSize: '0.75rem', padding: '5px 14px', marginLeft: 'auto' }}>
                  {simRunning ? 'Running...' : simResults ? 'Re-run' : 'Run Simulation'}
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Monte Carlo simulation (2,000 runs) using historical qualifying positions.
                {simCorrYears.length > 0 && (
                  <span style={{ color: '#f59e0b' }}> Using {simCorrYears.join(', ')} data.</span>
                )}
                {nudgeVal > 0 && (
                  <span style={{ color: '#94a3b8' }}> StdDev floor: {nudgeVal}.</span>
                )}
              </p>
              {simResults && (
                <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border)' }}>
                        <th style={Object.assign({}, thStyle, { textAlign: 'center', width: 36 })}>#</th>
                        <th style={Object.assign({}, thStyle, { textAlign: 'left', paddingLeft: 14, minWidth: 160 })}>Driver</th>
                        <th style={Object.assign({}, thStyle, { color: '#22c55e' })}>Projected</th>
                        <th style={thStyle}>Range (P10-P90)</th>
                        <th style=
{thStyle}>Historical Avg</th>
                        <th style={thStyle}>Data pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simResults.map(function(r, ri) {
                        if (r.simMean == null) return null
                        const hc = heatColor(r.simExpected, totalDrivers)
                        return (
                          <tr key={r.driver} style={{ background: ri % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                            <td style={Object.assign({}, tdBase, { color: 'var(--text-muted)', fontSize: '0.72rem' })}>{ri + 1}</td>
                            <td style={Object.assign({}, tdBase, { textAlign: 'left', paddingLeft: 14, fontFamily: 'var(--font-sans)', fontWeight: ri < 5 ? 600 : 400 })}>{r.driver}</td>
                            <td style={Object.assign({}, tdBase, { background: hc.bg, color: hc.text, fontWeight: 700 })}>P{r.simExpected}</td>
                            <td style={Object.assign({}, tdBase, { color: 'var(--text-secondary)', fontSize: '0.75rem' })}>P{r.simP10} - P{r.simP90}</td>
                            <td style={Object.assign({}, tdBase, { color: 'var(--text-muted)' })}>{r.simMean != null ? r.simMean.toFixed(1) : ''}</td>
                            <td style={Object.assign({}, tdBase, { color: 'var(--text-muted)', fontSize: '0.72rem' })}>{r.sampleCount}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

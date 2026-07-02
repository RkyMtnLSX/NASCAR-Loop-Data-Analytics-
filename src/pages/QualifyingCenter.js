import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ââ Helpers ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
  'Naval Base Coronado': 'NBC',
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

function qualFormat(trackName, corrGroup) {
  if (corrGroup) { const cg = corrGroup.toLowerCase(); if (cg.includes('road')) return 'road'; if (cg.includes('super')) return 'superspeedway'; if (cg.includes('short')) return 'short-track'; return 'oval'; }
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
  const entries = Object.entries(TRACK_ABBR).sort((a, b) => b[0].length - a[0].length)
  for (const [full, abbr] of entries) {
    if (trackName.toLowerCase().includes(full.toLowerCase())) return abbr
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

function formatQualSpeed(speed, trackName) {
  if (speed == null) return null
  var isRoad = ROAD_COURSES.some(function(t) { return trackName && trackName.toLowerCase().indexOf(t.toLowerCase().split(' ')[0]) >= 0 })
  if (isRoad) {
    var secs = parseFloat(speed)
    if (isNaN(secs)) return String(speed)
    var m = Math.floor(secs / 60)
    var s = (secs % 60).toFixed(3)
    if (s.length < 6) s = '0' + s
    return m > 0 ? m + ':' + s : secs.toFixed(3) + 's'
  }
  return parseFloat(speed).toFixed(1) + ' mph'
}

function filterOutliers(positions) {
  if (positions.length < 3) return positions
  var sorted = positions.slice().sort(function(a, b) { return a - b })
  var mid = Math.floor(sorted.length / 2)
  var median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  var devs = positions.map(function(p) { return Math.abs(p - median) }).sort(function(a, b) { return a - b })
  var dMid = Math.floor(devs.length / 2)
  var mad = devs.length % 2 === 0 ? (devs[dMid - 1] + devs[dMid]) / 2 : devs[dMid]
  if (mad === 0) return positions
  return positions.filter(function(p) { return Math.abs(p - median) / (mad * 0.6745) <= 3.5 })
}

function runSimulation(drivers, numSims, nudge) {
  if (numSims === undefined) numSims = 2000
  if (nudge === undefined) nudge = 0
  const results = drivers.map(function(driver) {
    const rawPos = driver.historicalPositions.filter(function(p) { return p != null })
    const positions = rawPos
    if (positions.length === 0) return Object.assign({}, driver, { simMean: null, simP10: null, simP90: null })
    const mean = positions.reduce(function(a, b) { return a + b }, 0) / positions.length
    const variance = positions.reduce(function(s, p) { return s + (p - mean) * (p - mean) }, 0) / positions.length
    const stdDev = Math.max(Math.sqrt(variance), nudge) || nudge || 1
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
      sampleCount: driver.rawCount || positions.length,
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
        <div style={{ fontSize: '2.36rem', marginBottom: 12 }}>&#127937;</div>
        <h3 style={{ marginBottom: 8 }}>Subscriber Feature</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.03rem', marginBottom: 20 }}>
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
  const [show2025, setShow2025] = useState(false)
  const [sortBy, setSortBy] = useState('trackAvg')
  const [sortDir, setSortDir] = useState('asc')

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
      const unsortedTracks = (trackRows || []).map(function(t) { return t.name })
      const localCorrYear = cfg.correlation_year || new Date().getFullYear()
      const { data: raceDateRows } = await supabase
        .from('races')
        .select('track_name, race_date')
        .in('track_name', unsortedTracks)
        .gte('race_date', localCorrYear + '-01-01')
        .lte('race_date', localCorrYear + '-12-31')
      const raceDateMap = {}
      ;(raceDateRows || []).forEach(function(r) {
        if (!raceDateMap[r.track_name] || r.race_date < raceDateMap[r.track_name]) {
          raceDateMap[r.track_name] = r.race_date
        }
      })
      const corrTrackNames = unsortedTracks.slice().sort(function(a, b) {
        const da = raceDateMap[a] || '9999-12-31'
        const db = raceDateMap[b] || '9999-12-31'
        return da < db ? -1 : da > db ? 1 : a.localeCompare(b)
      })
      setCorrTracks(corrTrackNames)

      const allTrackNames = Array.from(new Set([cfg.track_name].concat(corrTrackNames)))
      const { data: rows, error: rowErr } = await supabase
        .from('qualifying_results')
        .select('driver_name, car_number, track_name, year, qualifying_position, qualifying_speed, draw_order')
        .eq('series', 'cup')
        .in('track_name', allTrackNames)
        .order('qualifying_position')
      if (rowErr) throw rowErr
      setQualData(rows || [])

      const { data: elRows } = await supabase
        .from('entry_list')
        .select('driver_name, car_number, organization')
        .eq('series', 'cup')
        .eq('race_year', cfg.correlation_year)
        .eq('track_name', cfg.track_name)
      setEntryList(elRows && elRows.length > 0
        ? elRows.map(function(r) { return ({ name: r.driver_name.replace(/\s*\(i\)\s*$/, '').trim(), carNumber: r.car_number || null, org: r.organization || null }) })
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
  const fmt = qualFormat(config.track_name, config.correlation_label)

  // Only show columns where qualifying data actually exists
  const trackYearCombosWithData = new Set(qualData.map(function(r) { return r.track_name + '_' + r.year }))

  const histCols = trackYears
    .filter(function(yr) { return trackYearCombosWithData.has(config.track_name + '_' + yr) })
    .map(function(yr) {
      return { key: 'hist_' + yr, label: eventLabel(config.track_name, yr), trackName: config.track_name, year: yr }
    })

  const corrCols = corrTracks
    .filter(function(t) { return t !== config.track_name })
    .flatMap(function(t) {
      const yrs = show2025 ? [2025, corrYear] : [corrYear]
      return yrs.map(function(yr) {
        return { key: 'corr_' + t + '_' + yr, label: eventLabel(t, yr), trackName: t, year: yr }
      })
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
    const normKey = normalizeName(row.driver_name)
    if (!driverMap[normKey]) {
      driverMap[normKey] = { driver: row.driver_name, carNumber: row.car_number, positions: {}, speeds: {} }
    }
    driverMap[normKey].positions[row.track_name + '_' + row.year] = row.qualifying_position
    if (row.qualifying_speed != null) driverMap[normKey].speeds[row.track_name + '_' + row.year] = row.qualifying_speed
  }

  const drawOrderMap = {}
  for (const row of qualData) {
    if (row.draw_order && row.track_name === config.track_name && row.year === corrYear) {
      drawOrderMap[normalizeName(row.driver_name)] = row.draw_order
    }
  }
  for (const d of Object.values(driverMap)) {
    d.drawOrder = drawOrderMap[normalizeName(d.driver)] || null
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
      d.rawCount = 0
      const yrWeight = { 2022: 1, 2023: 1, 2024: 2, 2025: 4, 2026: 5 }
      for (const yr of simCorrYears) {
        const reps = yrWeight[yr] || 1
        const fp = d.positions[config.track_name + '_' + yr]
        if (fp != null) { for (let ri = 0; ri < reps; ri++) d.historicalPositions.push(fp); d.rawCount++ }
        for (const ct of corrTracks.filter(function(t) { return t !== config.track_name })) {
          const cp = d.positions[ct + '_' + yr]
          if (cp != null) { for (let ri = 0; ri < reps; ri++) d.historicalPositions.push(cp); d.rawCount++ }
        }
      }
    } else {
      d.historicalPositions = histPositions
    }
  }

  const allPositions = qualData.map(function(r) { return r.qualifying_position }).filter(function(p) { return p != null })
  const totalDrivers = allPositions.length > 0 ? Math.max.apply(null, allPositions) : 40

  // Normalize driver names: lowercase, strip accents (SuÃ¡rezâsuarez), strip periods (A.J.âAJ)
  function normalizeName(name) {
    return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').replace(/\s+/g, ' ').trim()
  }

  // Build car-number map from entry list (current car numbers override historical)
  const elCarMap = {}
  const orgMap = {}
  if (entryList && entryList.length > 0) {
    entryList.forEach(function(el) {
      elCarMap[normalizeName(el.name)] = el.carNumber
      orgMap[normalizeName(el.name)] = el.org || null
    })
  }

  let rows = Object.values(driverMap)
  // Override historical car numbers with entry list (fixes e.g. SuÃ¡rez #99â#7)
  rows.forEach(function(r) {
    const cn = elCarMap[normalizeName(r.driver)]
    if (cn != null) r.carNumber = cn
    r.org = orgMap[normalizeName(r.driver)] || null
  })

  if (entryList && entryList.length > 0) {
    rows = rows.filter(function(r) { return entryList.some(function(el) { return normalizeName(el.name) === normalizeName(r.driver) }) })
    // Add entry-list drivers with no qualifying history (e.g. Magnussen - first Cup start)
    const inTableNorm = new Set(rows.map(function(r) { return normalizeName(r.driver) }))
    const missingDrivers = entryList
      .filter(function(el) { return !inTableNorm.has(normalizeName(el.name)) })
      .map(function(el) { return { driver: el.name, carNumber: el.carNumber, org: el.org || null, positions: {}, speeds: {}, trackAvg: null, corrYearAvg: null, historicalPositions: [], drawOrder: drawOrderMap[normalizeName(el.name)] || null } })
    rows = rows.concat(missingDrivers)
  }

  function handleSort(key) {
    if (sortBy === key) { setSortDir(sortDir === 'asc' ? 'desc' : 'asc') }
    else { setSortBy(key); setSortDir('asc') }
  }
  function sortArrow(key) { return sortBy === key ? (sortDir === 'asc' ? ' â²' : ' â¼') : '' }

  rows.sort(function(a, b) {
    var va, vb, mul = sortDir === 'asc' ? 1 : -1
    if (sortBy === 'name') return mul * a.driver.localeCompare(b.driver)
    if (sortBy === 'trackAvg') { va = a.trackAvg; vb = b.trackAvg }
    else if (sortBy === 'corrYearAvg') { va = a.corrYearAvg; vb = b.corrYearAvg }
  else if (sortBy === 'drawOrder') { va = a.drawOrder; vb = b.drawOrder }
    else { va = a.positions[sortBy]; vb = b.positions[sortBy] }
    if (va == null && vb == null) return a.driver.localeCompare(b.driver)
    if (va == null) return 1
    if (vb == null) return -1
    return mul * (va - vb)
  })

  const hasDrawOrder = rows.some(function(r) { return r.drawOrder != null })

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
    padding: '8px 6px', fontWeight: 700, fontSize: '0.77rem',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    color: 'var(--text-secondary)', textAlign: 'center',
    whiteSpace: 'nowrap', background: 'var(--bg-elevated)',
    borderBottom: '2px solid var(--border)',
  }
  const tdBase = {
    padding: '5px 6px', textAlign: 'center',
    fontSize: '0.94rem', fontFamily: 'var(--font-mono)',
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
                  display: 'inline-block', marginLeft: 10, fontSize: '0.77rem', fontWeight: 700,
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
          style={{ fontSize: '0.89rem', padding: '5px 14px' }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 20, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '0.96rem' }}>
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
            <button onClick={function() { setShow2025(!show2025) }} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: '0.89rem',
              border: '1px solid var(--border)',
              background: show2025 ? 'var(--accent)' : 'var(--bg-elevated)',
              color: show2025 ? '#fff' : 'var(--text-secondary)', cursor: 'pointer',
            }}>Show 2025</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>P1</span>
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map(function(pct) {
                const hc = heatColor(Math.round(pct * (totalDrivers - 1)) + 1, totalDrivers)
                return <div key={pct} style={{ width: 18, height: 12, borderRadius: 3, background: hc.bg }} />
              })}
              <span style={{ fontSize: '0.77rem', color: 'var(--text-muted)' }}>Last</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: 2 }}>Sort:</span>
            {[
              { key: 'trackAvg', label: 'Avg @ ' + trackAbbr(config.track_name) },
              hasDrawOrder ? { key: 'drawOrder', label: 'Draw Order' } : null,
              { key: 'name', label: 'AâZ' },
            ].filter(Boolean).map(function(opt) {
              const active = sortBy === opt.key
              return (
                <button key={opt.key} onClick={function() { handleSort(opt.key) }} style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: '0.89rem',
                  border: '1px solid ' + (active ? 'transparent' : 'var(--border)'),
                  background: active ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: active ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: active ? 600 : 400,
                }}>{opt.label}{active ? (sortDir === 'asc' ? ' â' : ' â') : ''}</button>
              )
            })}
          </div>
          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 28 }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  <th style={Object.assign({}, thStyle, { textAlign: 'center', width: 36 })}>#</th>
                  <th onClick={function() { handleSort('name') }} style={Object.assign({}, thStyle, { textAlign: 'left', paddingLeft: 14, minWidth: 170, position: 'sticky', left: 0, zIndex: 2, cursor: 'pointer', background: 'var(--bg-surface)', borderRight: '2px solid var(--border)', boxShadow: '4px 0 8px -2px rgba(0,0,0,0.6)' })}>Driver{sortArrow('name')}</th>
                  {hasDrawOrder && <th onClick={function() { handleSort('drawOrder') }} style={Object.assign({}, thStyle, { color: '#f59e0b', cursor: 'pointer', minWidth: 120 })}>Qualifying Order{sortArrow('drawOrder')}</th>}
                  <th onClick={function() { handleSort('trackAvg') }} style={Object.assign({}, thStyle, { minWidth: 72, color: 'var(--accent)', cursor: 'pointer' })}>
                    Avg{sortArrow('trackAvg')}<br /><span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{trackAbbr(config.track_name)}</span>
                  </th>
                  {histCols.length > 0 && (
                    <th colSpan={histCols.length} style={Object.assign({}, thStyle, { borderLeft: '2px solid rgba(99,102,241,0.3)', color: 'var(--accent)', opacity: 0.7 })}>
                      {config.track_name.split(' ').slice(0, 2).join(' ')} History
                    </th>
                  )}
                  {showCorrAvgCol && (
                    <th onClick={function() { handleSort('corrYearAvg') }} style={Object.assign({}, thStyle, { borderLeft: '2px solid rgba(99,102,241,0.5)', color: '#a78bfa', cursor: 'pointer' })}>
                      {show2025 ? '2026/2025' : '2026'}<br />Avg{sortArrow('corrYearAvg')}
                    </th>
                  )}
                  {featuredCurrYear.map(function(col) {
                    var pk = col.trackName + '_' + col.year
                    return <th key={col.key} onClick={function() { handleSort(pk) }} style={Object.assign({}, thStyle, { borderLeft: '2px solid rgba(99,102,241,0.5)', color: 'var(--accent)', cursor: 'pointer' })}>{col.label}{sortArrow(pk)}</th>
                  })}
                  {corrCols.length > 0 && (
                    <th colSpan={corrCols.length} style={Object.assign({}, thStyle, { borderLeft: '2px solid var(--border)', color: 'var(--text-secondary)' })}>
                      {config.correlation_label} &middot; {show2025 ? '2025/' : ''}{corrYear}
                    </th>
                  )}
                </tr>
                <tr>
                  <th style={thStyle} />
                  <th style={Object.assign({}, thStyle, { textAlign: 'left', paddingLeft: 14, position: 'sticky', left: 0, zIndex: 2, background: 'var(--bg-surface)', borderRight: '2px solid var(--border)', boxShadow: '4px 0 8px -2px rgba(0,0,0,0.6)' })} />
                  {hasDrawOrder && <th style={thStyle} />}
                  <th style={thStyle} />
                  {histCols.map(function(col, i) {
                    var pk = col.trackName + '_' + col.year
                    return <th key={col.key} onClick={function() { handleSort(pk) }} style={Object.assign({}, thStyle, i === 0 ? { borderLeft: '2px solid rgba(99,102,241,0.3)' } : {}, { cursor: 'pointer' })}>{col.label}{sortArrow(pk)}</th>
                  })}
                  {showCorrAvgCol && <th style={Object.assign({}, thStyle, { borderLeft: '2px solid rgba(99,102,241,0.5)' })} />}
                  {featuredCurrYear.map(function(col) {
                    return <th key={col.key} style={Object.assign({}, thStyle, { borderLeft: '2px solid rgba(99,102,241,0.5)' })}>{col.label}</th>
                  })}
                  {corrCols.map(function(col, i) {
                    var pk = col.trackName + '_' + col.year
                    return <th key={col.key} onClick={function() { handleSort(pk) }} style={Object.assign({}, thStyle, i === 0 ? { borderLeft: '2px solid var(--border)' } : {}, { cursor: 'pointer' })}>{col.label}{sortArrow(pk)}</th>
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map(function(row, ri) {
                  const avgColor = row.trackAvg ? heatColor(Math.round(row.trackAvg), totalDrivers) : null
                  const corrAvgColor = row.corrYearAvg ? heatColor(Math.round(row.corrYearAvg), totalDrivers) : null
                  const rowBg = ri % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-elevated)'
                  return (
                    <tr key={row.driver} style={{ background: rowBg }}>
                      <td style={Object.assign({}, tdBase, { color: 'var(--text-muted)', fontSize: '0.85rem' })}>{ri + 1}</td>
                      <td style={Object.assign({}, tdBase, {
                        textAlign: 'left', paddingLeft: 14, fontFamily: 'var(--font-sans)',
                        fontWeight: ri < 5 ? 600 : 400, color: 'var(--text-primary)',
                        position: 'sticky', left: 0, background: rowBg, zIndex: 1, borderRight: '2px solid var(--border)', boxShadow: '4px 0 8px -2px rgba(0,0,0,0.6)',
                      })}>
                        {row.carNumber && (
                          <img src={'/car-numbers/' + row.carNumber + '.png'} alt={'#' + row.carNumber} style={{ height: 28, marginRight: 6, verticalAlign: 'middle' }} />
                        )}
                        {row.driver}
                        {row.org && <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)', fontWeight: 400 }}>{row.org}</div>}
                      </td>
                      {hasDrawOrder && (
                        <td style={Object.assign({}, tdBase, { color: row.drawOrder != null ? '#f59e0b' : 'var(--text-muted)', fontWeight: row.drawOrder != null ? 700 : 400, minWidth: 120 })}>
                          {row.drawOrder != null ? row.drawOrder : 'â'}
                        </td>
                      )}
                      <td style={Object.assign({}, tdBase, {
                        background: avgColor ? avgColor.bg : 'transparent',
                        color: avgColor ? avgColor.text : 'var(--text-muted)',
                        fontWeight: 700,
                      })}>
                        {row.trackAvg != null ? row.trackAvg.toFixed(1) : '-'}
                      </td>
                      {histCols.map(function(col, i) {
                        const pos = row.positions[col.trackName + '_' + col.year]
                        const spd = row.speeds ? row.speeds[col.trackName + '_' + col.year] : null
                        const hc = heatColor(pos, totalDrivers)
                        const tip = pos != null ? ('P' + pos + (spd != null ? ' Â· ' + formatQualSpeed(spd, col.trackName) : '')) : undefined
                        return (
                          <td key={col.key} title={tip} style={Object.assign({}, tdBase, i === 0 ? { borderLeft: '2px solid rgba(99,102,241,0.3)' } : {}, { background: hc.bg, color: hc.text })}>
                            {pos != null ? pos : '-'}
                          </td>
                        )
                      })}
{showCorrAvgCol && (
                        <td style={Object.assign({}, tdBase, {
                          borderLeft: '2px solid rgba(99,102,241,0.5)',
                          background: corrAvgColor ? corrAvgColor.bg : 'transparent',
                          color: corrAvgColor ? corrAvgColor.text : 'var(--text-muted)',
                          fontWeight: 700,
                        })}>
                          {row.corrYearAvg != null ? row.corrYearAvg.toFixed(1) : '-'}
                        </td>
                      )}
                      {featuredCurrYear.map(function(col) {
                        const pos = row.positions[col.trackName + '_' + col.year]
                        const spd = row.speeds ? row.speeds[col.trackName + '_' + col.year] : null
                        const hc = heatColor(pos, totalDrivers)
                        const tip = pos != null ? ('P' + pos + (spd != null ? ' Â· ' + formatQualSpeed(spd, col.trackName) : '')) : undefined
                        return (
                          <td key={col.key} title={tip} style={Object.assign({}, tdBase, { borderLeft: '2px solid rgba(99,102,241,0.5)', background: hc.bg, color: hc.text })}>
                            {pos != null ? pos : '-'}
                          </td>
                        )
                      })}
                      {corrCols.map(function(col, i) {
                        const pos = row.positions[col.trackName + '_' + col.year]
                        const spd = row.speeds ? row.speeds[col.trackName + '_' + col.year] : null
                        const hc = heatColor(pos, totalDrivers)
                        const tip = pos != null ? ('P' + pos + (spd != null ? ' Â· ' + formatQualSpeed(spd, col.trackName) : '')) : undefined
                        return (
                          <td key={col.key} title={tip} style={Object.assign({}, tdBase, i === 0 ? { borderLeft: '2px solid var(--border)' } : {}, { background: hc.bg, color: hc.text })}>
                            {pos != null ? pos : '-'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.6 }}>
            Avg column = mean qualifying position at {config.track_name} across {trackYears.join(', ') || 'selected years'}.
            Lower = better qualifier. Use as baseline for PrizePicks over/under picks.
          </p>

          {showSimPanel && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.11rem', fontWeight: 600, margin: 0 }}>Qualifying Simulation</h2>
                <span style={{
                  fontSize: '0.71rem', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: 20,
                  background: 'rgba(99,102,241,0.12)', color: 'var(--accent)',
                  border: '1px solid rgba(99,102,241,0.3)', textTransform: 'uppercase',
                }}>BETA</span>
                <button className="btn btn-secondary" onClick={handleRunSim} disabled={simRunning}
                  style={{ fontSize: '0.89rem', padding: '5px 14px', marginLeft: 'auto' }}>
                  {simRunning ? 'Running...' : simResults ? 'Re-run' : 'Run Simulation'}
                </button>
              </div>
              <p style={{ fontSize: '0.94rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Monte Carlo simulation (2,000 runs) using historical qualifying positions.
                {simCorrYears.length > 0 && (
                  <span style={{ color: '#f59e0b' }}> Using {simCorrYears.join(', ')} data.</span>
                )}
                <span style={{ color: '#94a3b8', marginLeft: 4 }}>{QUAL_FORMAT_LABELS[fmt].label} Â· floor: {nudgeVal}</span>
              </p>
              {simResults && (
                <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.96rem' }}>
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
                          <tr key={r.driver} style={{ background: ri % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                            <td style={Object.assign({}, tdBase, { color: 'var(--text-muted)', fontSize: '0.85rem' })}>{ri + 1}</td>
                            <td style={Object.assign({}, tdBase, { textAlign: 'left', paddingLeft: 14, fontFamily: 'var(--font-sans)', fontWeight: ri < 5 ? 600 : 400 })}>{r.driver}</td>
                            <td style={Object.assign({}, tdBase, { background: hc.bg, color: hc.text, fontWeight: 700 })}>P{r.simExpected}</td>
                            <td style={Object.assign({}, tdBase, { color: 'var(--text-secondary)', fontSize: '0.89rem' })}>P{r.simP10} - P{r.simP90}</td>
                            <td style={Object.assign({}, tdBase, { color: 'var(--text-muted)' })}>{r.simMean != null ? r.simMean.toFixed(1) : ''}</td>
                            <td style={Object.assign({}, tdBase, { color: 'var(--text-muted)', fontSize: '0.85rem' })}>{r.sampleCount}</td>
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

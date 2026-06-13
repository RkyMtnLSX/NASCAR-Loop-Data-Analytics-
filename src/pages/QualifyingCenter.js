import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { qualSimilarity } from '../lib/trackSimilarity'

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
  'superspeedway': { label: 'Superspeedway', color: '#f59e0b', desc: '2 rounds · top 10 advance' },
  'short-track': { label: 'Short Track', color: '#22c55e', desc: '1 round · 2 laps' },
  'oval': { label: 'Oval', color: '#64748b', desc: '1 round · 1 lap' },
}

function trackAbbr(trackName) {
  if (!trackName) return '?'
  for (const [full, abbr] of Object.entries(TRACK_ABBR)) {
    if (trackName.toLowerCase().includes(full.toLowerCase())) return abbr
  }
  const words = trackName.split(' ').filter(w => w.length > 2)
  if (words.length >= 2) return words[0].substring(0, 3)
  return trackName.substring(0, 4)
}

function eventLabel(trackName, year) {
  return `${trackAbbr(trackName)} '${String(year).slice(2)}`
}

function heatColor(pos, totalDrivers = 40) {
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
  const alpha = 0.75
  const textColor = pct < 0.55 ? '#0a0a0a' : '#fff'
  return { bg: `rgba(${r},${g},${b},${alpha})`, text: textColor }
}

// Draw order slope: Pocono Next Gen era (2022–2025, n=146 driver-sessions)
// Raw r = −0.321; quality-controlled r = −0.101 (removes metric-score/team-quality confounding)
// Applied: nudge = slope × (median_drawPos − driver.drawPos), capped ±3 positions
const DRAW_ORDER_SLOPE = 0.101

// Correlated track similarity weights — based on wintherace.info Track Comparison Tool data
// Indianapolis: 2.5mi, 670hp, Medium-High speed, Minimal wear, 9.2° banking — near-identical to Pocono (9.3°)
// Charlotte, Kansas: 670hp, Medium-High speed tier, Low-Medium wear — same package + speed tier, different size
// Texas, Homestead, Las Vegas: 670hp but Fast speed tier or High tire wear — baseline
// Correlated track weights derived from wintherace.info similarity scores vs Pocono (score/99 × 2)
// Pocono baseline: 2.5mi, 670hp, Medium-High, Minimal wear, 9.3° avg banking
const CORR_TRACK_WEIGHTS = {
  'Indianapolis': 2.00,  // score 99 — 2.5mi, 670hp, Medium-High, Minimal, 9.2° — near-identical
  'Kansas': 1.65,        // score 82 — 670hp, Medium-High, Low-Medium wear
  'Michigan': 1.60,      // score 80 — 670hp, 2.0mi, Fast tier, Medium wear
  'Charlotte': 1.55,     // score 78 — 670hp, Medium-High, Low-Medium wear
  'Texas': 1.50,         // score 76 — 670hp, Fast tier, Low-Medium wear
  // Homestead & Las Vegas not in wintherace top-6 comps for Pocono (score <73) → weight 1.0 (default)
}

// Recency weight: more recent data reflects current equipment/team situation better
// effectiveWeight = recencyWeight(year) × trackWeight (2 for same-track, 1 for correlated)
function recencyWeight(year) {
  const age = new Date().getFullYear() - year
  if (age <= 0) return 3.0   // current year
  if (age === 1) return 2.0  // last year
  if (age === 2) return 1.0  // 2 years ago
  return 0.5                  // 3+ years ago
}

function runSimulation(drivers, numSims = 2000) {
  const median = (drivers.length + 1) / 2

  const results = drivers.map(driver => {
    // historicalPositions entries: { pos, year, trackWeight }
    const entries = driver.historicalPositions.filter(e => e != null && e.pos != null)
    if (entries.length === 0) return { ...driver, simMean: null, simP10: null, simP90: null }

    // Weighted mean + variance: recency × track-relevance combined weight
    const totalWeight = entries.reduce((s, e) => s + recencyWeight(e.year) * e.trackWeight, 0)
    const weightedMean = entries.reduce((s, e) => s + recencyWeight(e.year) * e.trackWeight * e.pos, 0) / totalWeight
    const weightedVariance = entries.reduce((s, e) => s + recencyWeight(e.year) * e.trackWeight * (e.pos - weightedMean) ** 2, 0) / totalWeight
    const stdDev = Math.sqrt(weightedVariance) || 3

    // Draw order nudge: quality-controlled Pocono slope (2022–2025)
    // Earlier than field median = penalty (worse projected pos); later = benefit
    let adjustedMean = weightedMean
    if (driver.qualOrder != null) {
      const rawNudge = DRAW_ORDER_SLOPE * (median - driver.qualOrder)
      const drawNudge = Math.max(-3, Math.min(3, rawNudge))
      adjustedMean = weightedMean + drawNudge
    }

    const samples = []
    for (let i = 0; i < numSims; i++) {
      const u1 = Math.random(), u2 = Math.random()
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      const sample = Math.round(Math.max(1, adjustedMean + z * stdDev))
      samples.push(sample)
    }
    samples.sort((a, b) => a - b)
    return {
      ...driver,
      simMean: weightedMean,
      simExpected: Math.round(samples[Math.floor(numSims * 0.5)]),
      simP10: samples[Math.floor(numSims * 0.1)],
      simP90: samples[Math.floor(numSims * 0.9)],
      sampleCount: entries.length,
    }
  })
  return results.sort((a, b) => {
    if (a.simMean == null) return 1
    if (b.simMean == null) return -1
    return a.simMean - b.simMean
  })
}

// ── Paywall stub ───────────────────────────────────────────────────────────────
function SubscribePrompt() {
  return (
    <div className="page" style={{ maxWidth: 560 }}>
      <div className="page-header">
        <h1 className="page-title">Qualifying Center</h1>
        <p className="page-subtitle">Qualifying heatmap & simulation</p>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🏁</div>
        <h3 style={{ marginBottom: 8 }}>Subscriber Feature</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 20 }}>
          Qualifying heatmaps, historical averages, and simulations are available to subscribers.
        </p>
        <a href="/subscribe" className="btn btn-primary">Subscribe to Unlock</a>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function QualifyingCenter({ isSubscriber }) {
  const [config, setConfig] = useState(null)
  const [qualData, setQualData] = useState([])
  const [corrTracks, setCorrTracks] = useState([])
  const [entryList, setEntryList] = useState(null)
  const [qualOrderData, setQualOrderData] = useState([])
  const [qualEnteredSet, setQualEnteredSet] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [simResults, setSimResults] = useState(null)
  const [simRunning, setSimRunning] = useState(false)
  const [sortBy, setSortBy] = useState('avg')
  const [sortDir, setSortDir] = useState('asc')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Featured weekend config for Cup
      const { data: cfg, error: cfgErr } = await supabase
        .from('featured_weekend')
        .select('*')
        .eq('series', 'cup')
        .single()
      if (cfgErr || !cfg) throw new Error('No Cup Series weekend configured yet.')
      setConfig(cfg)

      // 2. Correlated tracks — prefer explicit list from config, fall back to tracks table by label
      let corrTrackNames = []
      if (cfg.correlation_tracks?.length > 0) {
        corrTrackNames = cfg.correlation_tracks
      } else {
        const { data: trackRows } = await supabase
          .from('tracks')
          .select('name')
          .eq('correlation_group_label', cfg.correlation_label)
          .order('name')
        corrTrackNames = (trackRows || []).map(t => t.name)
      }
      setCorrTracks(corrTrackNames)

    // 2b. Qualifying order — all tracks/years for DNQ detection
    const allHeatmapTracks = [cfg.track_name, ...corrTrackNames]
    const { data: enteredRows } = await supabase
      .from('qualifying_order')
      .select('driver_name, track_name, year')
      .eq('series', 'cup')
      .in('track_name', allHeatmapTracks)
    setQualEnteredSet(new Set((enteredRows || []).map(r => r.driver_name + '_' + r.track_name + '_' + r.year)))

      // 3. Qualifying results — two targeted queries to stay under Supabase's 1000-row server cap
      //    Query A: featured track only, all historical years (~200 rows max)
      //    Query B: correlated tracks only, correlation years only (~280 rows max)
      const cfgCorrYears = (cfg.correlation_years?.length ? cfg.correlation_years : [cfg.correlation_year]).filter(Boolean)
      const corrOnlyTrackNames = corrTrackNames.filter(t => t !== cfg.track_name)

      const [{ data: featRows, error: featErr }, { data: corrRows, error: corrErr }] = await Promise.all([
        supabase
          .from('qualifying_results')
          .select('driver_name, car_number, track_name, year, qualifying_position, qualifying_speed')
          .eq('series', 'cup')
          .eq('track_name', cfg.track_name)
          .in('year', cfg.track_years || [])
          .not('qualifying_position', 'is', null)
          .gt('qualifying_position', 0)
          .not('qualifying_speed', 'is', null)
          .order('qualifying_position'),
        corrOnlyTrackNames.length > 0
          ? supabase
              .from('qualifying_results')
              .select('driver_name, car_number, track_name, year, qualifying_position, qualifying_speed')
              .eq('series', 'cup')
              .in('track_name', corrOnlyTrackNames)
              .in('year', cfgCorrYears)
              .not('qualifying_position', 'is', null)
              .gt('qualifying_position', 0)
              .not('qualifying_speed', 'is', null)
              .order('qualifying_position')
          : { data: [], error: null },
      ])
      if (featErr) throw featErr
      if (corrErr) throw corrErr
      setQualData([...(featRows || []), ...(corrRows || [])])

      // 4. Entry list for filtering inactive drivers
      const { data: elRows } = await supabase
        .from('entry_list')
        .select('driver_name')
        .eq('series', 'cup')
        .eq('race_year', new Date().getFullYear())
        .eq('track_name', cfg.track_name)
      setEntryList(elRows && elRows.length > 0 ? elRows.map(r => r.driver_name.replace(/\s*\(i\)\s*$/, '').replace(/\s*[#*]\s*$/, '').trim()) : null)

      // 5. Qualifying draw order
      const { data: orderRows } = await supabase
        .from('qualifying_order')
        .select('car_number, driver_name, qualifying_order, qualifying_group')
        .eq('series', 'cup')
        .eq('year', new Date().getFullYear())
        .eq('track_name', cfg.track_name)
      setQualOrderData(orderRows || [])

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (!isSubscriber) return <SubscribePrompt />

  // ── Build pivot table ────────────────────────────────────────────────────────
  if (!config) {
    return (
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Qualifying Center</h1>
        </div>
        {loading && <div className="empty-state"><div className="spinner" style={{ margin: '0 auto 12px' }} /><p>Loading…</p></div>}
        {error && <div style={{ color: '#ef4444', padding: 16 }}>{error}</div>}
      </div>
    )
  }

  const trackYears = config.track_years || []
  const corrYears = (config.correlation_years?.length
    ? config.correlation_years
    : [config.correlation_year]
  ).filter(Boolean).sort((a, b) => b - a)  // newest first — recencyWeight() handles heavier weighting
  const currentYear = new Date().getFullYear()

  const histCols = trackYears.map(yr => ({
    key: `hist_${yr}`,
    label: eventLabel(config.track_name, yr),
    trackName: config.track_name,
    year: yr,
    isFeatured: true,
  }))

  const corrCols = corrTracks
  .filter(t => t !== config.track_name)
  .flatMap(t => corrYears.map(yr => ({
    key: `corr_${t}_${yr}`,
    label: eventLabel(t, yr),
    trackName: t,
    year: yr,
    isFeatured: false,
  })))
  .filter(col => qualData.some(r => r.track_name === col.trackName && r.year === col.year))

  const featuredCurrYear = !trackYears.includes(currentYear) ? [{
  key: `feat_curr_${currentYear}`,
  label: eventLabel(config.track_name, currentYear),
  trackName: config.track_name,
  year: currentYear,
  isFeatured: true,
}] : []

  const allCols = [...histCols, ...featuredCurrYear, ...corrCols]

  // Build driver rows from qualifying results
  const driverMap = {}
  for (const row of qualData) {
    if (!driverMap[row.driver_name]) {
      driverMap[row.driver_name] = { driver: row.driver_name, carNumber: row.car_number, positions: {} }
    }
    const key = `${row.track_name}_${row.year}`
    // Only record position if a lap time was posted — excludes mechanical DNS entries
    driverMap[row.driver_name].positions[key] = row.qualifying_position
  }

  for (const d of Object.values(driverMap)) {
    // Same-track history — trackWeight:2 so same-track counts double vs correlated
    const sameTrackEntries = trackYears
      .map(yr => ({ pos: d.positions[`${config.track_name}_${yr}`], year: yr, trackWeight: 2 }))
      .filter(e => e.pos != null)
    d.trackAvg = sameTrackEntries.length > 0
      ? sameTrackEntries.reduce((a, e) => a + e.pos, 0) / sameTrackEntries.length
      : null

    // Correlated tracks (same correlation group, different venue) — trackWeight:1
    const corrEntries = corrTracks
      .filter(t => t !== config.track_name)
      .flatMap(t => corrYears.map(yr => ({ pos: d.positions[`${t}_${yr}`], year: yr, trackWeight: CORR_TRACK_WEIGHTS[t] ?? 1 })))
      .filter(e => e.pos != null)

    // Simulation pool: {pos, year, trackWeight} entries for weighted sampling
    // effectiveWeight = recencyWeight(year) × trackWeight
    d.historicalPositions = sameTrackEntries.length > 0
      ? [...sameTrackEntries, ...corrEntries]
      : corrEntries
  }

  // Merge qualifying draw order into driver rows
  const qualOrderMap = {}
  function normName(n) { return n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim() }
  const NAME_ALIASES = { 'john hunter nemechek': 'john h nemechek' }
  function resolveNorm(n) { const k = normName(n); return NAME_ALIASES[k] || k }
  for (const qo of qualOrderData) {
    const name = resolveNorm(qo.driver_name.replace(/\s*\(i\)\s*$/, '').replace(/\s*[#*]\s*$/, '').trim())
    qualOrderMap[name] = { order: qo.qualifying_order, group: qo.qualifying_group, carNumber: qo.car_number }
  }
  for (const d of Object.values(driverMap)) {
    const qo = qualOrderMap[resolveNorm(d.driver)]
    d.qualOrder = qo?.order ?? null
    d.qualGroup = qo?.group ?? null
    if (qo?.carNumber) d.carNumber = qo.carNumber
  }

  // Add entry-list drivers who have no historical data so they still appear
  // Use norm-name dedup so "AJ Allmendinger" doesn't duplicate "A.J. Allmendinger"
  const driverNormLookup = {}
  for (const key of Object.keys(driverMap)) {
    driverNormLookup[resolveNorm(key)] = key
  }
  if (entryList) {
    for (const name of entryList) {
      const norm = resolveNorm(name)
      if (!driverMap[name] && !driverNormLookup[norm]) {
        const qo = qualOrderMap[norm]
        driverMap[name] = {
          driver: name, carNumber: qo?.carNumber ?? null, positions: {},
          trackAvg: null, historicalPositions: [],
          qualOrder: qo?.order ?? null, qualGroup: qo?.group ?? null,
        }
      }
    }
  }

  const allPositions = qualData.map(r => r.qualifying_position).filter(p => p != null)
  const totalDrivers = allPositions.length > 0 ? Math.max(...allPositions) : 40

  // Filter to entry list
  let rows = Object.values(driverMap)
  if (entryList && entryList.length > 0) {
    const entryNorms = new Set(entryList.map(n => resolveNorm(n)))
    rows = rows.filter(r => entryNorms.has(resolveNorm(r.driver)))
  }

  // Sort handler
  function handleSort(key) {
    if (sortBy === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
  }
  function sortIndicator(key) {
    if (sortBy !== key) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  // Sort rows
  const dir = sortDir === 'asc' ? 1 : -1
  if (sortBy === 'avg') {
    rows.sort((a, b) => {
      if (a.trackAvg == null && b.trackAvg == null) return a.driver.localeCompare(b.driver)
      if (a.trackAvg == null) return 1
      if (b.trackAvg == null) return -1
      return dir * (a.trackAvg - b.trackAvg)
    })
  } else if (sortBy === 'name') {
    rows.sort((a, b) => dir * a.driver.localeCompare(b.driver))
  } else if (sortBy === 'qo') {
    rows.sort((a, b) => {
      if (a.qualOrder == null && b.qualOrder == null) return a.driver.localeCompare(b.driver)
      if (a.qualOrder == null) return 1
      if (b.qualOrder == null) return -1
      return dir * (a.qualOrder - b.qualOrder)
    })
  } else {
    const col = allCols.find(c => c.key === sortBy)
    if (col) {
      rows.sort((a, b) => {
        const aPos = a.positions[`${col.trackName}_${col.year}`]
        const bPos = b.positions[`${col.trackName}_${col.year}`]
        if (aPos == null && bPos == null) return a.driver.localeCompare(b.driver)
        if (aPos == null) return 1
        if (bPos == null) return -1
        return dir * (aPos - bPos)
      })
    } else {
      rows.sort((a, b) => a.driver.localeCompare(b.driver))
    }
  }

  function handleRunSim() {
    setSimRunning(true)
    setTimeout(() => {
      const simInput = rows.map(r => ({
        driver: r.driver, carNumber: r.carNumber,
        trackAvg: r.trackAvg, historicalPositions: r.historicalPositions,
        qualOrder: r.qualOrder, qualGroup: r.qualGroup,
      }))
      setSimResults(runSimulation(simInput, 2000))
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
  const thSortable = {
    ...thStyle, cursor: 'pointer', userSelect: 'none',
  }
  const tdBase = {
    padding: '5px 6px', textAlign: 'center',
    fontSize: '0.8rem', fontFamily: 'var(--font-mono)',
    borderBottom: '1px solid var(--border)',
  }

  const hasData = rows.length > 0 && allCols.length > 0
  const hasQualOrder = qualOrderData.length > 0

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Qualifying Center</h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
            Cup Series &middot; {config.track_name} &middot; {config.correlation_label}
            {(() => {
              const fmt = qualFormat(config.track_name)
              const { label, color, desc } = QUAL_FORMAT_LABELS[fmt]
              return (
                <span style={{
                  display: 'inline-block', marginLeft: 10, fontSize: '0.65rem', fontWeight: 700,
                  letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 20,
                  background: color + '22', color, border: `1px solid ${color}55`,
                  textTransform: 'uppercase', verticalAlign: 'middle', cursor: 'default',
                }} title={desc}>{label}</span>
              )
            })()}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadData} disabled={loading}
          style={{ fontSize: '0.75rem', padding: '5px 14px' }}>
          {loading ? '⟳ Loading…' : '⟳ Refresh'}
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
          <p>Loading qualifying data…</p>
        </div>
      )}

      {!loading && !hasData && (
        <div className="empty-state">
          <h3>No qualifying data loaded yet</h3>
          <p>Use Admin &rarr; Load Qualifying to fetch qualifying results from Racing Reference.</p>
        </div>
      )}

      {hasData && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Sort:</span>
            {[
              ['avg', `Avg @ ${trackAbbr(config.track_name)}`],
              ['qo', 'Draw Order'],
              ['name', 'A–Z'],
            ].map(([val, lbl]) => (
              <button key={val} onClick={() => handleSort(val)} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem',
                border: '1px solid var(--border)',
                background: sortBy === val ? 'var(--accent)' : 'var(--bg-elevated)',
                color: sortBy === val ? '#fff' : 'var(--text-secondary)', cursor: 'pointer',
              }}>{lbl}{sortBy === val ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</button>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>P1</span>
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map(pct => {
                const { bg } = heatColor(Math.round(pct * (totalDrivers - 1)) + 1, totalDrivers)
                return <div key={pct} style={{ width: 18, height: 12, borderRadius: 3, background: bg }} />
              })}
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Last</span>
            </div>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 28 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'center', width: 36 }}>#</th>
                  <th style={{ ...thSortable, textAlign: 'left', paddingLeft: 14, minWidth: 170, position: 'sticky', left: 0, zIndex: 2 }}
                    onClick={() => handleSort('name')}>Driver{sortIndicator('name')}</th>
                  {hasQualOrder && (
                    <th style={{ ...thSortable, minWidth: 52, color: '#f59e0b' }}
                      onClick={() => handleSort('qo')}>Qualifying Order{sortIndicator('qo')}</th>
                  )}
                  <th style={{ ...thSortable, minWidth: 72, color: 'var(--accent)' }}
                    onClick={() => handleSort('avg')}>
                    Avg{sortIndicator('avg')}<br /><span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{trackAbbr(config.track_name)}</span>
                  </th>
                  {histCols.length > 0 && (
                    <th colSpan={histCols.length} style={{ ...thStyle, borderLeft: '2px solid rgba(99,102,241,0.3)', color: 'var(--accent)', opacity: 0.7 }}>
                      {config.track_name.split(' ').slice(0, 2).join(' ')} History
                    </th>
                  )}
                  {featuredCurrYear.map(col => (
                    <th key={col.key} style={{ ...thStyle, borderLeft: '2px solid rgba(99,102,241,0.5)', color: 'var(--accent)' }}>{col.label}</th>
                  ))}
                  {corrCols.length > 0 && (
                    <th colSpan={corrCols.length} style={{ ...thStyle, borderLeft: '2px solid var(--border)', color: 'var(--text-secondary)' }}>
                      {config.correlation_label} &middot; {corrYears.join(', ')}
                    </th>
                  )}
                </tr>
                <tr>
                  <th style={thStyle} />
                  <th style={{ ...thStyle, textAlign: 'left', paddingLeft: 14, position: 'sticky', left: 0, zIndex: 2 }} />
                  {hasQualOrder && <th style={thStyle} />}
                  <th style={thStyle} />
                  {histCols.map(col => (
                    <th key={col.key} style={{ ...thSortable, borderLeft: col === histCols[0] ? '2px solid rgba(99,102,241,0.3)' : undefined }}
                      onClick={() => handleSort(col.key)}>{col.label}{sortIndicator(col.key)}</th>
                  ))}
                  {featuredCurrYear.map(col => (
                    <th key={col.key} style={{ ...thSortable, borderLeft: '2px solid rgba(99,102,241,0.5)' }}
                      onClick={() => handleSort(col.key)}>{col.label}{sortIndicator(col.key)}</th>
                  ))}
                  {corrCols.map((col, i) => {
                    const sim = qualSimilarity(config.track_name, col.trackName)
                    return (
                      <th key={col.key} style={{ ...thSortable, borderLeft: i === 0 ? '2px solid var(--border)' : undefined }}
                        onClick={() => handleSort(col.key)}>
                        {col.label}{sortIndicator(col.key)}
                        {sim != null && (
                          <span style={{ display: 'block', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.02em', marginTop: 2,
                            color: sim >= 90 ? '#22c55e' : sim >= 75 ? '#f59e0b' : 'var(--text-muted)' }}>
                            sim {sim}
                          </span>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const avgColor = row.trackAvg ? heatColor(Math.round(row.trackAvg), totalDrivers) : null
                  const qoLabel = row.qualOrder != null ? String(row.qualOrder) : '—'
                  return (
                    <tr key={row.driver} style={{ background: ri % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)' }}>
                      <td style={{ ...tdBase, color: 'var(--text-muted)', fontSize: '0.72rem' }}>{ri + 1}</td>
                      <td style={{
                        ...tdBase, textAlign: 'left', paddingLeft: 14, fontFamily: 'var(--font-sans)',
                        fontWeight: ri < 5 ? 600 : 400, color: 'var(--text-primary)',
                        position: 'sticky', left: 0, background: ri % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)', zIndex: 1,
                      }}>
                        {row.carNumber && (
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.7rem', marginRight: 6 }}>#{row.carNumber}</span>
                        )}
                        {row.driver}
                      </td>
                      {hasQualOrder && (
                        <td style={{ ...tdBase, color: '#f59e0b', fontWeight: 700, fontSize: '0.75rem' }}>
                          {qoLabel}
                        </td>
                      )}
                      <td style={{ ...tdBase, background: avgColor ? avgColor.bg : 'transparent', color: avgColor ? avgColor.text : 'var(--text-muted)', fontWeight: 700 }}>
                        {row.trackAvg != null ? row.trackAvg.toFixed(1) : '—'}
                      </td>
                      {histCols.map((col, i) => {
                        const pos = row.positions[`${col.trackName}_${col.year}`]
                        const { bg, text } = heatColor(pos, totalDrivers)
                        return (
                          <td key={col.key} style={{ ...tdBase, borderLeft: i === 0 ? '2px solid rgba(99,102,241,0.3)' : undefined, background: bg, color: text }}>
                            {pos != null ? pos : (qualEnteredSet.has(row.driver + '_' + col.trackName + '_' + col.year) ? 'DNQ' : '—')}
                          </td>
                        )
                      })}
                      {featuredCurrYear.map(col => {
                        const pos = row.positions[`${col.trackName}_${col.year}`]
                        const { bg, text } = heatColor(pos, totalDrivers)
                        return (
                          <td key={col.key} style={{ ...tdBase, borderLeft: '2px solid rgba(99,102,241,0.5)', background: bg, color: text }}>
                            {pos != null ? pos : (qualEnteredSet.has(row.driver + '_' + col.trackName + '_' + col.year) ? 'DNQ' : '—')}
                          </td>
                        )
                      })}
                      {corrCols.map((col, i) => {
                        const pos = row.positions[`${col.trackName}_${col.year}`]
                        const { bg, text } = heatColor(pos, totalDrivers)
                        return (
                          <td key={col.key} style={{ ...tdBase, borderLeft: i === 0 ? '2px solid var(--border)' : undefined, background: bg, color: text }}>
                            {pos != null ? pos : (qualEnteredSet.has(row.driver + '_' + col.trackName + '_' + col.year) ? 'DNQ' : '—')}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.6 }}>
            Avg column = mean qualifying position at {config.track_name} across {trackYears.join(', ') || 'selected years'}.
            Lower number = better qualifier. Use this as your baseline for PrizePicks over/under picks.
            {hasQualOrder && ' · Qualifying Order column = draw order (click to sort).'}
          </p>

          {config.show_qual_sim && (
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
                  {simRunning ? '⟳ Running…' : simResults ? '⟳ Re-run' : '▶ Run Simulation'}
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Monte Carlo simulation (2,000 runs) using each driver&apos;s historical qualifying positions at this track type.
                Correlated-track results included at 1&times; weight; same-track history at 2&times;. Recent seasons weighted higher.
                {hasQualOrder && <strong style={{ color: '#f59e0b' }}> Draw order loaded — draw position nudge applied (max ±3 positions, Pocono-calibrated).</strong>}
              </p>
              {simResults && (
                <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border)' }}>
                        <th style={{ ...thStyle, textAlign: 'center', width: 36 }}>#</th>
                        <th style={{ ...thStyle, textAlign: 'left', paddingLeft: 14, minWidth: 160 }}>Driver</th>
                        <th style={{ ...thStyle, color: '#22c55e' }}>Projected</th>
                        <th style={thStyle}>Range (P10&ndash;P90)</th>
                        <th style={thStyle}>Wtd Avg</th>
                        <th style={thStyle}>Data pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simResults.map((r, ri) => {
                        if (r.simMean == null) return null
                        const { bg, text } = heatColor(r.simExpected, totalDrivers)
                        return (
                          <tr key={r.driver} style={{ background: ri % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                            <td style={{ ...tdBase, color: 'var(--text-muted)', fontSize: '0.72rem' }}>{ri + 1}</td>
                            <td style={{ ...tdBase, textAlign: 'left', paddingLeft: 14, fontFamily: 'var(--font-sans)', fontWeight: ri < 5 ? 600 : 400 }}>{r.driver}</td>
                            <td style={{ ...tdBase, background: bg, color: text, fontWeight: 700 }}>P{r.simExpected}</td>
                            <td style={{ ...tdBase, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>P{r.simP10} &ndash; P{r.simP90}</td>
                            <td style={{ ...tdBase, color: 'var(--text-muted)' }}>{r.simMean?.toFixed(1)}</td>
                            <td style={{ ...tdBase, color: 'var(--text-muted)', fontSize: '0.72rem' }}>{r.sampleCount}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

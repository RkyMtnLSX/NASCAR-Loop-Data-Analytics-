import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const SERIES_TABS = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'xfinity', label: "O'Reilly Series" },
  { value: 'trucks',  label: 'Truck Series' },
]

const DEFAULT_WEIGHTS = {
  corrHistory:  0.35,
  longRunPace:  0.25,
  shortRunPace: 0.15,
  startPos:     0.15,
  tireFalloff:  0.10,
}

const CAUTION_PRESETS = [
  { label: 'Low',    value: 4,  noise: 8  },
  { label: 'Medium', value: 8,  noise: 13 },
  { label: 'High',   value: 15, noise: 20 },
]

const DNF_PRESETS = [
  { label: 'Low',    value: 0.05 },
  { label: 'Medium', value: 0.15 },
  { label: 'High',   value: 0.25 },
]

// ── DK scoring ─────────────────────────────────────────────────────────────
function dkFinishPts(pos) {
  if (!pos || pos <= 0 || isNaN(pos)) return 0
  const table = [0,45,42,41,40,39,38,37,36,35,34,32,31,30,29,28,27,26,25,24,23,21,20,19,18,17,16,15,14,13,12,10,9,8,7,6,5,4,3,2,1]
  return pos <= 40 ? table[pos] : 0
}

// Box-Muller gaussian noise (mean=0, std=1)
function gaussNoise() {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

// ── Normalize array to 0-100. lowerIsBetter inverts. ──────────────────────
function normalizeArr(values, lowerIsBetter = false) {
  const valid = values.filter(v => v != null && !isNaN(v))
  if (valid.length < 2) return values.map(v => (v == null ? null : 50))
  const mn = Math.min(...valid)
  const mx = Math.max(...valid)
  if (mn === mx) return values.map(v => (v == null ? null : 50))
  return values.map(v => {
    if (v == null || isNaN(v)) return null
    const raw = (v - mn) / (mx - mn)
    return (lowerIsBetter ? 1 - raw : raw) * 100
  })
}

// ── Speed scores ───────────────────────────────────────────────────────────
function buildSpeedScores(drivers, weights) {
  if (!drivers.length) return drivers

  const corrScores  = normalizeArr(drivers.map(d => d.corrAvgFinish), true)  // lower finish = better
  const lrpScores   = normalizeArr(drivers.map(d => d.lrpTime),        true)  // lower lap time = better
  const srpScores   = normalizeArr(drivers.map(d => d.srpTime),         true)
  const startScores = normalizeArr(drivers.map(d => d.startPos),        true)  // P1 = 100
  const fallScores  = normalizeArr(drivers.map(d => d.trendSlope),      true)  // lower falloff = better

  // Normalize weights to sum to 1
  const wTotal = Object.values(weights).reduce((a, b) => a + b, 0) || 1
  const w = {
    corrHistory:  weights.corrHistory  / wTotal,
    longRunPace:  weights.longRunPace  / wTotal,
    shortRunPace: weights.shortRunPace / wTotal,
    startPos:     weights.startPos     / wTotal,
    tireFalloff:  weights.tireFalloff  / wTotal,
  }

  return drivers.map((d, i) => {
    const c   = corrScores[i]  ?? 50
    const lrp = lrpScores[i]  ?? 50
    const srp = srpScores[i]  ?? 50
    const sp  = startScores[i] ?? 50
    const fl  = fallScores[i]  ?? 50

    const speedScore =
      c   * w.corrHistory  +
      lrp * w.longRunPace  +
      srp * w.shortRunPace +
      sp  * w.startPos     +
      fl  * w.tireFalloff

    return {
      ...d,
      speedScore,
      scores: {
        corr: Math.round(c),
        lrp:  Math.round(lrp),
        srp:  Math.round(srp),
        sp:   Math.round(sp),
        fall: Math.round(fl),
      },
    }
  })
}

// ── Monte Carlo simulation ─────────────────────────────────────────────────
function runRaceSim(drivers, simConfig) {
  const { numSims, cautionPreset, dnfRate, totalRaceLaps } = simConfig
  const noiseWidth = cautionPreset.noise
  // Laps led decay: more cautions = flatter distribution
  const chaosFactor = Math.min(0.85, cautionPreset.value / 20)
  const k = 0.38 * (1 - chaosFactor)

  const n = drivers.length
  if (!n) return []

  const sumFinish      = new Float64Array(n)
  const sumDK          = new Float64Array(n)
  const sumLapsLed     = new Float64Array(n)
  const fastestLapCnt  = new Int32Array(n)
  const dnfCnt         = new Int32Array(n)
  // finishHist[i][pos] = count of times driver i finished at pos
  const finishHist = Array.from({ length: n }, () => new Int32Array(n + 2))

  for (let sim = 0; sim < numSims; sim++) {
    // 1. Score + noise + DNF roll
    const scored = drivers.map((d, i) => ({
      i,
      score: d.speedScore + gaussNoise() * noiseWidth,
      dnf:   Math.random() < dnfRate,
    }))

    // 2. Sort: active cars by score desc, DNFs at back
    scored.sort((a, b) => {
      if (a.dnf !== b.dnf) return a.dnf ? 1 : -1
      return b.score - a.score
    })

    // 3. Assign finish positions and track DNFs
    const simPos = new Int32Array(n)
    scored.forEach((s, rank) => {
      simPos[s.i] = rank + 1
      sumFinish[s.i] += rank + 1
      finishHist[s.i][rank + 1]++
      if (s.dnf) dnfCnt[s.i]++
    })

    // 4. Laps led — exponential decay from P1, flattened by caution chaos
    const active = scored.filter(s => !s.dnf)
    const simLL  = new Float64Array(n)
    if (active.length > 0) {
      const totalW = active.reduce((sum, _, i) => sum + Math.exp(-k * i), 0)
      let remaining = totalRaceLaps
      active.forEach((s, i) => {
        const share = Math.exp(-k * i) / totalW
        const ll = i < active.length - 1
          ? Math.round(share * totalRaceLaps)
          : remaining
        simLL[s.i] = Math.max(0, Math.min(ll, remaining))
        remaining -= simLL[s.i]
        sumLapsLed[s.i] += simLL[s.i]
      })
    }

    // 5. Fastest lap — weighted random toward highest speed scores
    let flWinner = active.length > 0 ? active[0].i : -1
    if (active.length > 1) {
      const flW = active.map(s => Math.exp(s.score / 8))
      const flTotal = flW.reduce((a, b) => a + b, 0)
      let r = Math.random() * flTotal
      for (let i = 0; i < active.length; i++) {
        r -= flW[i]
        if (r <= 0) { flWinner = active[i].i; break }
      }
    }
    if (flWinner >= 0) fastestLapCnt[flWinner]++

    // 6. DK points for this iteration
    scored.forEach(s => {
      const finPos   = simPos[s.i]
      const startPos = drivers[s.i].startPos || finPos
      const ll       = simLL[s.i]
      const fl       = s.i === flWinner ? 1 : 0
      sumDK[s.i] += dkFinishPts(finPos) + (startPos - finPos) + (ll * 0.25) + (fl * 0.45)
    })
  }

  // ── Aggregate ────────────────────────────────────────────────────────────
  return drivers.map((d, i) => {
    const projFinish   = sumFinish[i]  / numSims
    const projLapsLed  = sumLapsLed[i] / numSims
    const flPct        = fastestLapCnt[i] / numSims * 100
    const dnfPct       = dnfCnt[i]     / numSims * 100
    const projDK       = sumDK[i]      / numSims
    const startPos     = d.startPos || Math.round(projFinish)
    const projPlaceDiff = startPos - projFinish

    // Finish distribution percentiles
    const hist = finishHist[i]
    let cum = 0, p25 = n, p50 = n, p75 = n
    for (let p = 1; p <= n + 1; p++) {
      cum += hist[p] || 0
      if (p25 === n && cum >= numSims * 0.25) p25 = p
      if (p50 === n && cum >= numSims * 0.50) p50 = p
      if (p75 === n && cum >= numSims * 0.75) p75 = p
    }

    const winPct   = (hist[1] || 0) / numSims * 100
    const top5Pct  = [1,2,3,4,5].reduce((s, p) => s + (hist[p] || 0), 0) / numSims * 100
    const top10Pct = [1,2,3,4,5,6,7,8,9,10].reduce((s, p) => s + (hist[p] || 0), 0) / numSims * 100

    return {
      ...d,
      projFinish:     +projFinish.toFixed(1),
      projLapsLed:    +projLapsLed.toFixed(1),
      flPct:          +flPct.toFixed(1),
      dnfPct:         +dnfPct.toFixed(1),
      projDK:         +projDK.toFixed(2),
      projPlaceDiff:  +projPlaceDiff.toFixed(1),
      winPct:         +winPct.toFixed(1),
      top5Pct:        +top5Pct.toFixed(1),
      top10Pct:       +top10Pct.toFixed(1),
      finishP25: p25, finishP50: p50, finishP75: p75,
    }
  }).sort((a, b) => b.projDK - a.projDK)
}

// ── Component ──────────────────────────────────────────────────────────────
export default function SimulationCenter({ isSubscriber }) {
  const [series, setSeries]                 = useState('cup')
  const [config, setConfig]                 = useState(null)
  const [rawDrivers, setRawDrivers]         = useState([])
  const [weights, setWeights]               = useState(DEFAULT_WEIGHTS)
  const [cautionPreset, setCautionPreset]   = useState(CAUTION_PRESETS[1])
  const [dnfPreset, setDnfPreset]           = useState(DNF_PRESETS[1])
  const [numSims, setNumSims]               = useState(10000)
  const [totalRaceLaps, setTotalRaceLaps]   = useState(200)
  const [simResults, setSimResults]         = useState(null)
  const [running, setRunning]               = useState(false)
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState(null)
  const [sortKey, setSortKey]               = useState('projDK')
  const [sortDir, setSortDir]               = useState('desc')
  const [showBreakdown, setShowBreakdown]   = useState(false)

  // ── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null); setConfig(null)
    setRawDrivers([]); setSimResults(null)

    async function load() {
      try {
        const s = series

        // Weekend config
        const { data: cfg, error: cfgErr } = await supabase
          .from('featured_weekend').select('*').eq('series', s).single()
        if (cfgErr) throw new Error('Weekend config not set for ' + s + ' — configure in Admin.')
        if (cancelled) return
        setConfig(cfg)

        // Parallel fetches
        const [
          { data: entries },
          { data: qualData },
          { data: practiceData },
          { data: corrTracks },
        ] = await Promise.all([
          supabase.from('entry_list')
            .select('driver_name, car_number, organization')
            .eq('series', s)
            .eq('race_year', cfg.correlation_year)
            .eq('track_name', cfg.track_name),
          supabase.from('qualifying_results')
            .select('driver_name, final_position, lap_time')
            .eq('series', s)
            .eq('track_name', cfg.track_name)
            .eq('year', cfg.correlation_year),
          supabase.from('practice_sessions')
            .select('driver_name, overall_avg, late_run_avg, trend_slope, practice_score, session_number')
            .eq('series', s)
            .eq('track_name', cfg.track_name)
            .eq('year', cfg.correlation_year)
            .order('session_number', { ascending: false }),
          supabase.from('tracks')
            .select('name')
            .eq('correlation_group_label', cfg.correlation_label),
        ])

        // Correlated track historical loop data
        const corrNames = (corrTracks || []).map(t => t.name)
        let loopRows = []
        if (corrNames.length) {
          const { data: ld } = await supabase
            .from('loop_data')
            .select('driver_name, finish_position, laps_led, fastest_laps, driver_rating')
            .in('track_name', corrNames)
            .eq('series', s)
          loopRows = ld || []
        }

        if (cancelled) return

        // ── Build lookup maps ──────────────────────────────────────────────
        const qualMap = new Map((qualData || []).map(q => [q.driver_name?.trim(), q]))

        // Practice: keep only most recent session per driver
        const practiceMap = new Map()
        ;(practiceData || []).forEach(p => {
          const name = p.driver_name?.trim()
          if (!practiceMap.has(name)) practiceMap.set(name, p)
        })

        // Correlated track avg finish per driver (lower = better)
        const loopByDriver = {}
        loopRows.forEach(r => {
          const name = r.driver_name?.trim()
          const fin  = parseFloat(r.finish_position)
          if (name && fin > 0) {
            if (!loopByDriver[name]) loopByDriver[name] = []
            loopByDriver[name].push(fin)
          }
        })
        const corrAvgMap = new Map(
          Object.entries(loopByDriver).map(([name, fins]) => [
            name, fins.reduce((a, b) => a + b, 0) / fins.length,
          ])
        )

        // ── Determine driver list ──────────────────────────────────────────
        // Priority: entry list → qualifying → practice
        const driverSource = entries && entries.length > 0
          ? entries
          : qualData && qualData.length > 0
            ? qualData.map(q => ({ driver_name: q.driver_name }))
            : [...new Set((practiceData || []).map(p => p.driver_name))].map(n => ({ driver_name: n }))

        const drivers = driverSource
          .map(e => {
            const name  = e.driver_name?.trim()
            if (!name) return null
            const qual  = qualMap.get(name)
            const prac  = practiceMap.get(name)
            return {
              name,
              carNumber:     e.car_number   || null,
              organization:  e.organization || null,
              startPos:      qual ? parseFloat(qual.final_position) || null : null,
              qualTime:      qual ? parseFloat(qual.lap_time)       || null : null,
              lrpTime:       prac ? parseFloat(prac.overall_avg)    || null : null,
              srpTime:       prac ? parseFloat(prac.late_run_avg)   || null : null,
              trendSlope:    prac ? parseFloat(prac.trend_slope)    || null : null,
              practiceScore: prac ? parseFloat(prac.practice_score) || null : null,
              corrAvgFinish: corrAvgMap.get(name) ?? null,
            }
          })
          .filter(Boolean)

        setRawDrivers(drivers)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [series])

  // ── Speed scores (recomputed when weights or drivers change) ─────────────
  const driversWithScores = useMemo(
    () => buildSpeedScores(rawDrivers, weights),
    [rawDrivers, weights]
  )

  // ── Run simulation ────────────────────────────────────────────────────────
  const handleRun = () => {
    setRunning(true)
    setSimResults(null)
    setTimeout(() => {
      const results = runRaceSim(driversWithScores, {
        numSims,
        cautionPreset,
        dnfRate: dnfPreset.value,
        totalRaceLaps,
      })
      setSimResults(results)
      setRunning(false)
    }, 50)
  }

  // ── Sort results table ────────────────────────────────────────────────────
  const displayRows = useMemo(() => {
    if (!simResults) return []
    const inf = sortDir === 'desc' ? -Infinity : Infinity
    return [...simResults].sort((a, b) => {
      const av = a[sortKey] ?? inf
      const bv = b[sortKey] ?? inf
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [simResults, sortKey, sortDir])

  const handleSort = (key) => {
    const defaultsAsc = ['projFinish', 'startPos', 'finishP50']
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir(defaultsAsc.includes(key) ? 'asc' : 'desc') }
  }

  const sortIcon = (key) => sortKey === key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''

  const adjustWeight = (key, delta) => {
    setWeights(prev => ({
      ...prev,
      [key]: Math.max(0, Math.min(1, +(prev[key] + delta).toFixed(2))),
    }))
  }

  const hasQual    = rawDrivers.some(d => d.startPos != null)
  const hasPractice = rawDrivers.some(d => d.lrpTime != null || d.srpTime != null)
  const hasCorr    = rawDrivers.some(d => d.corrAvgFinish != null)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Simulation Center</h1>
        <p className="page-subtitle">
          Monte Carlo race simulation &mdash; project finish positions &amp; DraftKings points
        </p>
      </div>

      {/* Series tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {SERIES_TABS.map(t => (
          <button key={t.value} className={`tab ${series === t.value ? 'active' : ''}`}
            onClick={() => setSeries(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontSize: '0.8125rem', marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading && (
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p>Loading race data&hellip;</p>
        </div>
      )}

      {!loading && !error && config && (
        <>
          {/* Race info bar */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16, padding: '10px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.875rem' }}>
              {config.track_label || config.track_name}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>|</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{config.correlation_label}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>|</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{rawDrivers.length} drivers</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>|</span>
            <span style={{ fontSize: '0.72rem', color: hasCorr ? '#22c55e' : 'var(--text-muted)' }}>
              {hasCorr ? 'Corr. history loaded' : 'No corr. history'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>|</span>
            <span style={{ fontSize: '0.72rem', color: hasPractice ? '#22c55e' : '#f59e0b' }}>
              {hasPractice ? 'Practice data loaded' : 'No practice data'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>|</span>
            <span style={{ fontSize: '0.72rem', color: hasQual ? '#22c55e' : '#f59e0b' }}>
              {hasQual ? 'Starting grid set' : 'Qualifying not loaded'}
            </span>
          </div>

          {/* Config row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>

            {/* Caution rate */}
            <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={labelStyle}>Caution Rate</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {CAUTION_PRESETS.map(p => (
                  <button key={p.label} onClick={() => setCautionPreset(p)} style={{
                    ...presetBtn, background: cautionPreset.value === p.value ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: cautionPreset.value === p.value ? '#111' : 'var(--text-secondary)',
                  }}>{p.label}</button>
                ))}
              </div>
              <div style={hintStyle}>~{cautionPreset.value} cautions &middot; noise width &plusmn;{cautionPreset.noise}</div>
            </div>

            {/* DNF rate */}
            <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={labelStyle}>DNF Rate</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {DNF_PRESETS.map(p => (
                  <button key={p.label} onClick={() => setDnfPreset(p)} style={{
                    ...presetBtn, background: dnfPreset.value === p.value ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: dnfPreset.value === p.value ? '#111' : 'var(--text-secondary)',
                  }}>{p.label}</button>
                ))}
              </div>
              <div style={hintStyle}>{Math.round(dnfPreset.value * 100)}% DNF probability per car</div>
            </div>

            {/* Race length */}
            <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={labelStyle}>Race Length (laps)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" value={totalRaceLaps} min={1} max={999}
                  onChange={e => setTotalRaceLaps(parseInt(e.target.value) || 200)}
                  style={{ width: 72, padding: '5px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-primary)', fontSize: '0.875rem', textAlign: 'center' }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>laps</span>
              </div>
              <div style={hintStyle}>Used for laps led distribution model</div>
            </div>
          </div>

          {/* Weights panel */}
          <div style={{ padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={labelStyle}>Speed Score Weights</div>
              <button onClick={() => setWeights(DEFAULT_WEIGHTS)} style={{ fontSize: '0.7rem', padding: '2px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>
                Reset Defaults
              </button>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { key: 'corrHistory',  label: 'Corr. Track History' },
                { key: 'longRunPace',  label: 'Long Run Pace' },
                { key: 'shortRunPace', label: 'Short Run Pace' },
                { key: 'startPos',     label: 'Starting Position' },
                { key: 'tireFalloff',  label: 'Tire Falloff' },
              ].map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 130 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => adjustWeight(key, -0.05)} style={nudgeBtn}>&#8722;</button>
                    <div style={{ width: 44, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      {Math.round(weights[key] * 100)}%
                    </div>
                    <button onClick={() => adjustWeight(key, 0.05)} style={nudgeBtn}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Run controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <button onClick={handleRun} disabled={running || !rawDrivers.length} style={{
              padding: '10px 28px', background: running ? 'var(--bg-elevated)' : 'var(--accent)',
              color: running ? 'var(--text-muted)' : '#111', border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: '0.875rem', cursor: running ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s',
            }}>
              {running && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
              {running ? `Running ${numSims.toLocaleString()} simulations…` : `Run ${numSims.toLocaleString()} Simulations`}
            </button>

            <select value={numSims} onChange={e => setNumSims(parseInt(e.target.value))}
              style={{ padding: '9px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer' }}>
              <option value={1000}>1,000 sims (fast)</option>
              <option value={10000}>10,000 sims</option>
              <option value={50000}>50,000 sims (precise)</option>
            </select>

            {simResults && (
              <button onClick={() => setShowBreakdown(v => !v)} style={{ padding: '9px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: '0.78rem', cursor: 'pointer' }}>
                {showBreakdown ? 'Hide' : 'Show'} Score Breakdown
              </button>
            )}
          </div>

          {/* Results table */}
          {simResults && (
            <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem', whiteSpace: 'nowrap', minWidth: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border)' }}>
                    {[
                      { key: null,           label: '#',        sortable: false },
                      { key: 'name',         label: 'Driver',   sortable: false, left: true },
                      { key: 'startPos',     label: 'Start',    title: 'Starting position' },
                      { key: 'projFinish',   label: 'Proj Fin', title: 'Projected average finish (25th-75th range)' },
                      { key: 'projDK',       label: 'Proj DK',  title: 'Projected DraftKings points' },
                      { key: 'projPlaceDiff',label: 'Pl Diff',  title: 'Projected place differential' },
                      { key: 'projLapsLed',  label: 'Laps Led', title: 'Projected average laps led' },
                      { key: 'flPct',        label: 'FL%',      title: 'Fastest lap probability' },
                      { key: 'winPct',       label: 'Win%',     title: 'Win probability' },
                      { key: 'top5Pct',      label: 'Top5%',    title: 'Top 5 finish probability' },
                      { key: 'top10Pct',     label: 'Top10%',   title: 'Top 10 finish probability' },
                      { key: 'dnfPct',       label: 'DNF%',     title: 'DNF probability' },
                      ...(showBreakdown ? [
                        { key: null, label: 'Hist',  sortable: false, title: 'Correlated track history score' },
                        { key: null, label: 'LRP',   sortable: false, title: 'Long run pace score' },
                        { key: null, label: 'SRP',   sortable: false, title: 'Short run pace score' },
                        { key: null, label: 'Start', sortable: false, title: 'Starting pos score' },
                        { key: null, label: 'Fall',  sortable: false, title: 'Tire falloff score' },
                        { key: 'speedScore', label: 'Speed', title: 'Composite speed score' },
                      ] : []),
                    ].map((col, ci) => (
                      <th key={ci} title={col.title}
                        onClick={() => col.sortable !== false && col.key && handleSort(col.key)}
                        style={{
                          padding: '8px 10px', fontWeight: 700, fontSize: '0.68rem',
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                          textAlign: col.left ? 'left' : 'right',
                          color: sortKey === col.key ? 'var(--accent)' : 'var(--text-secondary)',
                          cursor: col.sortable !== false && col.key ? 'pointer' : 'default',
                          userSelect: 'none',
                        }}>
                        {col.label}{col.key ? sortIcon(col.key) : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row, ri) => {
                    const bg = ri % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)'
                    const fmt = (v, d = 1) => v == null ? '—' : (+v).toFixed(d)
                    const fmtPct = v => v == null ? '—' : (+v).toFixed(1) + '%'
                    const fmtSgn = v => v == null ? '—' : (v >= 0 ? '+' : '') + (+v).toFixed(1)
                    const pdColor = row.projPlaceDiff > 2 ? '#22c55e' : row.projPlaceDiff < -2 ? '#ef4444' : 'var(--text-secondary)'
                    const finColor = row.projFinish <= 5 ? '#22c55e' : row.projFinish <= 15 ? 'var(--text-primary)' : 'var(--text-secondary)'

                    return (
                      <tr key={row.name} style={{ background: bg, borderBottom: '1px solid var(--border)' }}>
                        {/* Rank */}
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', minWidth: 32 }}>{ri + 1}</td>

                        {/* Driver */}
                        <td style={{ padding: '7px 12px', textAlign: 'left', minWidth: 190, fontWeight: ri < 5 ? 600 : 500 }}>
                          {row.carNumber && (
                            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginRight: 6 }}>#{row.carNumber}</span>
                          )}
                          {row.name}
                          {row.organization && (
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 1 }}>{row.organization}</div>
                          )}
                        </td>

                        {/* Start pos */}
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {row.startPos != null ? row.startPos : <span style={{ opacity: 0.4 }}>&mdash;</span>}
                        </td>

                        {/* Proj finish + range */}
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          <span style={{ fontWeight: 600, color: finColor }}>{fmt(row.projFinish)}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.67rem', marginLeft: 4 }}>
                            ({row.finishP25}&ndash;{row.finishP75})
                          </span>
                        </td>

                        {/* Proj DK */}
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: ri < 3 ? 'var(--accent)' : 'var(--text-primary)' }}>
                          {fmt(row.projDK, 2)}
                        </td>

                        {/* Place diff */}
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: pdColor }}>
                          {fmtSgn(row.projPlaceDiff)}
                        </td>

                        {/* Laps led */}
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: row.projLapsLed > 10 ? '#f59e0b' : 'var(--text-secondary)' }}>
                          {fmt(row.projLapsLed)}
                        </td>

                        {/* Fastest lap % */}
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: row.flPct > 12 ? '#f59e0b' : 'var(--text-secondary)' }}>
                          {fmtPct(row.flPct)}
                        </td>

                        {/* Win% */}
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: row.winPct > 8 ? '#22c55e' : 'var(--text-secondary)' }}>
                          {fmtPct(row.winPct)}
                        </td>

                        {/* Top5% */}
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {fmtPct(row.top5Pct)}
                        </td>

                        {/* Top10% */}
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {fmtPct(row.top10Pct)}
                        </td>

                        {/* DNF% */}
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: row.dnfPct > 20 ? '#ef4444' : 'var(--text-muted)' }}>
                          {fmtPct(row.dnfPct)}
                        </td>

                        {/* Score breakdown (optional) */}
                        {showBreakdown && (
                          <>
                            {['corr', 'lrp', 'srp', 'sp', 'fall'].map(k => (
                              <td key={k} style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                {row.scores?.[k] != null ? row.scores[k] : '—'}
                              </td>
                            ))}
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', fontSize: '0.78rem' }}>
                              {row.speedScore != null ? Math.round(row.speedScore) : '—'}
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!simResults && !running && (
            <div className="empty-state" style={{ marginTop: 8 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Configure settings above and click Run to generate projections.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────
const labelStyle = {
  fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 8,
}
const hintStyle = {
  fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 6,
}
const presetBtn = {
  flex: 1, padding: '5px 0', borderRadius: 5,
  border: '1px solid var(--border)', fontWeight: 600,
  fontSize: '0.78rem', cursor: 'pointer',
}
const nudgeBtn = {
  width: 24, height: 24, borderRadius: 4,
  border: '1px solid var(--border)', background: 'var(--bg-elevated)',
  color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1rem',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
}

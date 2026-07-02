import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD

const SERIES_TABS = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks',  label: 'Truck Series' },
]

const DEFAULT_WEIGHTS = {
  corrHistory:  0.30,
  longRunPace:  0.25,
  shortRunPace: 0.15,
  startPos:     0.15,
  tireFalloff:  0.10,
  raceCraft:    0.05,
  trackHistory: 0.00,
}

// Road course-specific weights.
// startPos reduced -- observed overpenalization of strong road course cars with poor qualifying
// (Hemric P32->2nd, Grala P16->3rd at San Diego 2026). raceCraft (quality pass %) added:
// captures meaningful passing in traffic, correlates with road/street course survival.
const ROAD_COURSE_WEIGHTS = {
  corrHistory:  0.35,  // strong signal, track-type history reliable
  longRunPace:  0.15,  // fewer laps at road courses, still useful
  shortRunPace: 0.05,  // near-redundant with LRP when stints are short
  startPos:     0.15,  // backed by r=0.416 correlation across 682 obs
  tireFalloff:  0.05,  // can't measure properly without long stints
  raceCraft:    0.25,  // actual race data, most meaningful at road courses
  trackHistory: 0.00,
}

const ROAD_COURSE_TRACKS = [
  'sonoma', 'watkins glen', 'cota', 'circuit of the americas',
  'road america', 'roval', 'indianapolis road', 'portland', 'chicago street',
  'coronado', 'mexico',
]

function isRoadCourse(trackName) {
  if (!trackName) return false
  const t = trackName.toLowerCase()
  return ROAD_COURSE_TRACKS.some(rc => t.includes(rc))
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

function buildSpeedScores(drivers, weights) {
  if (!drivers.length) return drivers

  const corrRatingScores = normalizeArr(drivers.map(d => d.corrAvgRating), false) // higher = better
  const corrFinishScores = normalizeArr(drivers.map(d => d.corrAvgFinish), true)  // lower = better
  const lrpScores        = normalizeArr(drivers.map(d => d.lrpTime),       true)  // lower lap time = better
  const srpScores        = normalizeArr(drivers.map(d => d.srpTime),        true)
  const startScores      = normalizeArr(drivers.map(d => d.startPos),       true)  // P1 = 100
  const fallScores       = normalizeArr(drivers.map(d => d.trendSlope),     true)  // lower falloff = better
  const raceCraftScores  = normalizeArr(drivers.map(d => d.raceCraftPct),    false) // higher pct = better
  const trackRatingScores = normalizeArr(drivers.map(d => d.trackAvgRating), false) // higher = better
  const trackFinishScores = normalizeArr(drivers.map(d => d.trackAvgFinish), true)  // lower = better

  const wTotal = Object.values(weights).reduce((a, b) => a + b, 0) || 1
  const w = {
    corrHistory:  weights.corrHistory  / wTotal,
    longRunPace:  weights.longRunPace  / wTotal,
    shortRunPace: weights.shortRunPace / wTotal,
    startPos:     weights.startPos     / wTotal,
    tireFalloff:  weights.tireFalloff  / wTotal,
    raceCraft:    (weights.raceCraft    || 0) / wTotal,
    trackHistory: (weights.trackHistory || 0) / wTotal,
  }

  return drivers.map((d, i) => {
    const rs = corrRatingScores[i]
    const fs = corrFinishScores[i]
    const hasR = d.corrAvgRating != null
    const hasF = d.corrAvgFinish != null
    const blendedC = hasR && hasF ? rs * 0.9 + fs * 0.1
                   : hasR         ? rs
                   : hasF         ? fs
                   :                null
    const rawC = blendedC ?? 50
    const conf = d.nCorrRaces > 0 ? Math.min(1, d.nCorrRaces / 4) : (blendedC != null ? 1 : 0)
    const c    = rawC * conf + 50 * (1 - conf)
    const trs = trackRatingScores[i]
    const tfs = trackFinishScores[i]
    const hasTR = d.trackAvgRating != null
    const hasTF = d.trackAvgFinish != null
    const blendedT = hasTR && hasTF ? trs * 0.9 + tfs * 0.1
                   : hasTR           ? trs
                   : hasTF           ? tfs
                   :                   null
    const rawT = blendedT ?? 50
    const tConf = d.nTrackRaces > 0 ? Math.min(1, d.nTrackRaces / 4) : (blendedT != null ? 1 : 0)
    const t    = rawT * tConf + 50 * (1 - tConf)
    const lrp = lrpScores[i]   ?? 50
    const srp = srpScores[i]   ?? 50
    const sp  = startScores[i] ?? 50
    const fl  = fallScores[i]  ?? 50
    const rc  = raceCraftScores[i] ?? 50

    const speedScore =
      c   * w.corrHistory  +
      lrp * w.longRunPace  +
      srp * w.shortRunPace +
      sp  * w.startPos     +
      fl  * w.tireFalloff +
    rc  * w.raceCraft  +
      t   * w.trackHistory

    return {
      ...d,
      speedScore,
      scores: {
        corr: Math.round(c),
        lrp:  Math.round(lrp),
        srp:  Math.round(srp),
        sp:   Math.round(sp),
        fall: Math.round(fl),
        rc:   Math.round(rc),
        track: Math.round(t),
      },
    }
  })
}

function runRaceSim(drivers, simConfig) {
  const { numSims, cautionPreset, dnfRate, totalRaceLaps } = simConfig
  const noiseWidth = cautionPreset.noise
  const chaosFactor = Math.min(0.85, cautionPreset.value / 20)
  const k = 0.38 * (1 - chaosFactor)

  const n = drivers.length
  if (!n) return []

  const sumFinish      = new Float64Array(n)
  const sumDK          = new Float64Array(n)
  const sumLapsLed     = new Float64Array(n)
  const sumFastLaps    = new Int32Array(n)
  const dfCnt          = new Int32Array(n)
  const finishHist     = Array.from({ length: n }, () => new Int32Array(n + 2))

  for (let sim = 0; sim < numSims; sim++) {
    const scored = drivers.map((d, i) => ({
      i,
      score: d.speedScore + gaussNoise() * noiseWidth,
      dnf:   Math.random() < dnfRate,
    }))

    scored.sort((a, b) => {
      if (a.dnf !== b.dnf) return a.dnf ? 1 : -1
      return b.score - a.score
    })

    const simPos = new Int32Array(n)
    scored.forEach((s, rank) => {
      simPos[s.i] = rank + 1
      sumFinish[s.i] += rank + 1
      finishHist[s.i][rank + 1]++
      if (s.dnf) dfCnt[s.i]++
    })

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

    const simFastLaps = new Int32Array(n)
    if (active.length > 0) {
      const flW = active.map(s => Math.exp(s.score / 8))
      const flTotal = flW.reduce((a, b) => a + b, 0)
      let remaining = totalRaceLaps
      active.forEach((s, idx) => {
        const fl = idx < active.length - 1
          ? Math.round((flW[idx] / flTotal) * totalRaceLaps)
          : remaining
        simFastLaps[s.i] = Math.max(0, fl)
        remaining -= simFastLaps[s.i]
      })
    }
    active.forEach(s => { sumFastLaps[s.i] += simFastLaps[s.i] })

    scored.forEach(s => {
      const finPos   = simPos[s.i]
      const startPos = drivers[s.i].startPos || finPos
      const ll       = simLL[s.i]
      sumDK[s.i] += dkFinishPts(finPos) + (startPos - finPos) + (ll * 0.25) + (simFastLaps[s.i] * 0.45)
    })
  }

  return drivers.map((d, i) => {
    const projFinish    = sumFinish[i]     / numSims
    const projLapsLed   = sumLapsLed[i]    / numSims
    const avgFastLaps   = sumFastLaps[i] / numSims
    const dnfPct        = dfCnt[i]         / numSims * 100
    const projDK        = sumDK[i]         / numSims
    const startPos      = d.startPos || Math.round(projFinish)
    const projPlaceDiff = startPos - projFinish

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
        const top3Pct  = [1,2,3].reduce((s, p) => s + (hist[p] || 0), 0) / numSims * 100
    const top10Pct = [1,2,3,4,5,6,7,8,9,10].reduce((s, p) => s + (hist[p] || 0), 0) / numSims * 100

    return {
      ...d,
      projFinish:     +projFinish.toFixed(1),
      projLapsLed:    +projLapsLed.toFixed(1),
      avgFastLaps:    +avgFastLaps.toFixed(2),
      dnfPct:         +dnfPct.toFixed(1),
      projDK:         +projDK.toFixed(2),
      projPlaceDiff:  +projPlaceDiff.toFixed(1),
      winPct:         +winPct.toFixed(1),
      top5Pct:        +top5Pct.toFixed(1),
          top3Pct:        +top3Pct.toFixed(1),
      top10Pct:       +top10Pct.toFixed(1),
      finishP25: p25, finishP50: p50, finishP75: p75,
    }
  }).sort((a, b) => b.projDK - a.projDK)
}

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
  const [published,     setPublished]       = useState(false)
  const [authed,        setAuthed]          = useState(false)
  const [password,      setPassword]        = useState('')
  const [authError,     setAuthError]       = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null); setConfig(null)
    setRawDrivers([]); setSimResults(null)

    async function load() {
      try {
        const s = series

        const { data: cfg, error: cfgErr } = await supabase
          .from('featured_weekend').select('*').eq('series', s).single()
        if (cfgErr) throw new Error('Weekend config not set for ' + s + ' -- configure in Admin.')
        if (cancelled) return
        setConfig(cfg)

        // Auto-apply track-type weights
        setWeights(isRoadCourse(cfg.track_name) ? ROAD_COURSE_WEIGHTS : DEFAULT_WEIGHTS)

        const [
          { data: entries },
          { data: qualData },
          { data: practiceData },
          { data: corrTracks },
        ] = await Promise.all([
          supabase.from('entry_list')
            .select('driver_name, car_number, organization')
            .eq('series', s)
            .eq('race_year', cfg.race_year || new Date().getFullYear())
            .eq('track_name', cfg.track_name),
          supabase.from('qualifying_results')
            .select('driver_name, final_position, lap_time')
            .eq('series', s)
            .eq('track_name', cfg.track_name)
            .eq('year', cfg.race_year || new Date().getFullYear()),
          supabase.from('practice_sessions')
            .select('driver_name, overall_avg, late_run_avg, trend_slope, practice_score, session_number, qualifying_position')
            .eq('series', s)
            .eq('track_name', cfg.track_name)
            .eq('year', cfg.race_year || new Date().getFullYear())
            .order('session_number', { ascending: false }),
          supabase.from('tracks')
            .select('name')
            .eq('correlation_group_label', cfg.correlation_label),
        ])

        const corrNames = (corrTracks || []).map(t => t.name)
        let loopRows = []
        if (corrNames.length) {
          const { data: ld } = await supabase
            .from('loop_data')
            .select('driver_name, finish_position, laps_led, fastest_laps, driver_rating, pct_quality_passes, year')
            .in('track_name', corrNames)
            .in('series', [...new Set([s, 'cup'])])
          loopRows = ld || []
        }

        // Specific track history
        let trackRows = []
        const { data: trData } = await supabase
          .from('loop_data')
          .select('driver_name, finish_position, driver_rating, year')
          .eq('track_name', cfg.track_name)
          .eq('series', s)
        trackRows = trData || []

        if (cancelled) return

        const qualMap = new Map((qualData || []).map(q => [normalizeName(q.driver_name), q]))

        const practiceMap = new Map()
        ;(practiceData || []).forEach(p => {
          const name = normalizeName(p.driver_name)
          if (!practiceMap.has(name)) practiceMap.set(name, p)
        })

        const loopByDriver = {}
        loopRows.forEach(r => {
          const name   = r.driver_name?.trim()
          const fin    = parseFloat(r.finish_position)
          const rating = parseFloat(r.driver_rating)
          const yr     = parseInt(r.year) || 0
          const qp     = parseFloat(r.pct_quality_passes)
          if (name && fin > 0) {
            const normN = normalizeName(name)
            if (!loopByDriver[normN]) loopByDriver[normN] = []
            loopByDriver[normN].push({ fin, rating: isNaN(rating) ? null : rating, qp: isNaN(qp) ? null : qp, yr })
          }
        })
        const corrAvgMap = new Map(
          Object.entries(loopByDriver).map(([name, rows]) => {
            const yrWt = yr => yr >= 2026 ? 2.0 : yr === 2025 ? 1.3 : yr === 2024 ? 0.9 : yr === 2023 ? 0.6 : 0.4
            const totalWt = rows.reduce((s, r) => s + yrWt(r.yr), 0)
            const avgFin = rows.reduce((s, r) => s + r.fin * yrWt(r.yr), 0) / totalWt
            const rRows  = rows.filter(r => r.rating != null)
            const rTotalWt = rRows.reduce((s, r) => s + yrWt(r.yr), 0)
            const avgRating = rRows.length > 0 ? rRows.reduce((s, r) => s + r.rating * yrWt(r.yr), 0) / rTotalWt : null
            const qpRows    = rows.filter(r => r.qp != null)
          const qpTotalWt = qpRows.reduce((s, r) => s + yrWt(r.yr), 0)
          const avgQP     = qpRows.length > 0 ? qpRows.reduce((s, r) => s + r.qp * yrWt(r.yr), 0) / qpTotalWt : null
          return [name, { avg: avgFin, avgRating, avgQP, n: rows.length }]
          })
        )

        const trackByDriver = {}
        trackRows.forEach(r => {
          const normN  = normalizeName(r.driver_name?.trim())
          const fin    = parseFloat(r.finish_position)
          const rating = parseFloat(r.driver_rating)
          const yr     = parseInt(r.year) || 0
          if (normN && fin > 0) {
            if (!trackByDriver[normN]) trackByDriver[normN] = []
            trackByDriver[normN].push({ fin, rating: isNaN(rating) ? null : rating, yr })
          }
        })
        const trackAvgMap = new Map(
          Object.entries(trackByDriver).map(([tname, trows]) => {
            const yrWt = yr => yr >= 2026 ? 2.0 : yr === 2025 ? 1.3 : yr === 2024 ? 0.9 : yr === 2023 ? 0.6 : 0.4
            const totalWt = trows.reduce((acc, r) => acc + yrWt(r.yr), 0)
            const avgFin = trows.reduce((acc, r) => acc + r.fin * yrWt(r.yr), 0) / totalWt
            const rRows  = trows.filter(r => r.rating != null)
            const rTotalWt = rRows.reduce((acc, r) => acc + yrWt(r.yr), 0)
            const avgRating = rRows.length > 0 ? rRows.reduce((acc, r) => acc + r.rating * yrWt(r.yr), 0) / rTotalWt : null
            return [tname, { avg: avgFin, avgRating, n: trows.length }]
          })
        )

        const driverSource = entries && entries.length > 0
          ? entries
          : qualData && qualData.length > 0
            ? qualData.map(q => ({ driver_name: q.driver_name }))
            : [...new Set((practiceData || []).map(p => p.driver_name))].map(n => ({ driver_name: n }))

        const drivers = driverSource
          .map(e => {
            const name  = e.driver_name?.trim()
            const normName = normalizeName(name)
            if (!name) return null
            const qual  = qualMap.get(normName)
            const prac  = practiceMap.get(normName)
            return {
              name,
              carNumber:     e.car_number   || null,
              organization:  e.organization || null,
              startPos:      prac && prac.qualifying_position ? parseFloat(prac.qualifying_position) : (qual ? parseFloat(qual.final_position) || null : null),
              qualTime:      qual ? parseFloat(qual.lap_time)       || null : null,
              lrpTime:       prac ? parseFloat(prac.overall_avg)    || null : null,
              srpTime:       prac ? parseFloat(prac.late_run_avg)   || null : null,
              trendSlope:    prac ? parseFloat(prac.trend_slope)    || null : null,
              practiceScore: prac ? parseFloat(prac.practice_score) || null : null,
              corrAvgFinish: corrAvgMap.get(normalizeName(name))?.avg       ?? null,
              corrAvgRating: corrAvgMap.get(normalizeName(name))?.avgRating ?? null,
              raceCraftPct:  corrAvgMap.get(normalizeName(name))?.avgQP     ?? null,
              nCorrRaces:    corrAvgMap.get(normalizeName(name))?.n         ?? 0,
              trackAvgFinish: trackAvgMap.get(normalizeName(name))?.avg       ?? null,
              trackAvgRating: trackAvgMap.get(normalizeName(name))?.avgRating ?? null,
              nTrackRaces:    trackAvgMap.get(normalizeName(name))?.n         ?? 0,
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

  const driversWithScores = useMemo(
    () => buildSpeedScores(rawDrivers, weights),
    [rawDrivers, weights]
  )

  function handleLogin(e) {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setAuthed(true)
      setAuthError('')
    } else {
      setAuthError('Incorrect password')
    }
  }

  const handleRun = () => {
    setRunning(true)
    setSimResults(null)
    setPublished(false)
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

  const publishResults = async () => {
    if (!simResults || !config) return
    const payload = {
      series,
      track_name: config.track_name,
      race_name:  config.race_name || config.track_name,
      race_year:  config.race_year || new Date().getFullYear(),
      results: simResults.map(d => ({
        driver_name:  d.name,
        car_number:   d.carNumber,
        organization: d.org,
        start_pos:    d.startPos,
        proj_finish:  d.projFinish,
        proj_dk:      +(d.projDK   || 0).toFixed(2),
        win_pct:       +(d.winPct      || 0).toFixed(4),
        top3_pct:      +(d.top3Pct     || 0).toFixed(4),
        top5_pct:      +(d.top5Pct     || 0).toFixed(4),
        top10_pct:     +(d.top10Pct    || 0).toFixed(4),
        dnf_pct:       +(d.dnfPct      || 0).toFixed(4),
        laps_led:      +(d.projLapsLed || 0).toFixed(2),
        avg_fast_laps: +(d.avgFastLaps || 0).toFixed(2),
      }))
    }
    await supabase.from('sim_results').delete().eq('series', series)
    const { error } = await supabase.from('sim_results').insert(payload)
    if (!error) setPublished(true)
    else alert('Publish failed: ' + error.message)
  }

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

  const sortIcon = (key) => sortKey === key ? (sortDir === 'desc' ? ' v' : ' ^') : ''

  const adjustWeight = (key, delta) => {
    setWeights(prev => ({
      ...prev,
      [key]: Math.max(0, Math.min(1, +(prev[key] + delta).toFixed(2))),
    }))
  }

  const roadCourse  = config ? isRoadCourse(config.track_name) : false
  const hasQual     = rawDrivers.some(d => d.startPos != null)
  const hasPractice = rawDrivers.some(d => d.lrpTime != null || d.srpTime != null)
  const hasCorr     = rawDrivers.some(d => d.corrAvgFinish != null)
  const hasRaceCraft = rawDrivers.some(d => d.raceCraftPct  != null)

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="card" style={{ width: '100%', maxWidth: 360 }}>
          <h2 style={{ fontSize: '1.18rem', fontWeight: 600, marginBottom: 20 }}>Sim Center Admin</h2>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 12 }}>
              <input type="password" placeholder="Admin password" value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '1.03rem', boxSizing: 'border-box' }}
              />
            </div>
            {authError && <div style={{ color: '#f87171', fontSize: '0.94rem', marginBottom: 10 }}>{authError}</div>}
            <button type="submit" style={{ width: '100%', padding: '9px', background: 'var(--accent)', color: '#111', border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: 'pointer', fontSize: '1.03rem' }}>
              Sign In
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Simulation Center</h1>
        <p className="page-subtitle">
          Monte Carlo race simulation &mdash; project finish positions &amp; DraftKings points
        </p>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        {SERIES_TABS.map(t => (
          <button key={t.value} className={`tab ${series === t.value ? 'active' : ''}`}
            onClick={() => setSeries(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontSize: '0.96rem', marginBottom: 20 }}>
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
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16, padding: '10px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1.03rem' }}>
              {config.track_label || config.track_name}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.89rem' }}>|</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.94rem' }}>{config.correlation_label}</span>
            {roadCourse && (
              <>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.89rem' }}>|</span>
                <span style={{ fontSize: '0.85rem', color: '#a78bfa', fontWeight: 600 }}>Road Course</span>
              </>
            )}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.89rem' }}>|</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.94rem' }}>{rawDrivers.length} drivers</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.89rem' }}>|</span>
            <span style={{ fontSize: '0.85rem', color: hasCorr ? '#22c55e' : 'var(--text-muted)' }}>
              {hasCorr ? 'Corr. history loaded' : 'No corr. history'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.89rem' }}>|</span>
            <span style={{ fontSize: '0.85rem', color: hasRaceCraft ? '#22c55e' : 'var(--text-muted)' }}>
              {hasRaceCraft ? 'Race craft loaded' : 'No race craft data'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.89rem' }}>|</span>
            <span style={{ fontSize: '0.85rem', color: hasPractice ? '#22c55e' : '#f59e0b' }}>
              {hasPractice ? 'Practice data loaded' : 'No practice data'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.89rem' }}>|</span>
            <span style={{ fontSize: '0.85rem', color: hasQual ? '#22c55e' : '#f59e0b' }}>
              {hasQual ? 'Starting grid set' : 'Qualifying not loaded'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
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

            <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={labelStyle}>Race Length (laps)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" value={totalRaceLaps} min={1} max={999}
                  onChange={e => setTotalRaceLaps(parseInt(e.target.value) || 200)}
                  style={{ width: 72, padding: '5px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-primary)', fontSize: '1.03rem', textAlign: 'center' }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.94rem' }}>laps</span>
              </div>
              <div style={hintStyle}>Used for laps led distribution model</div>
            </div>
          </div>

          <div style={{ padding: '14px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={labelStyle}>Speed Score Weights</div>
                {roadCourse && (
                  <span style={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: 600, padding: '2px 7px', background: 'rgba(167,139,250,0.12)', borderRadius: 4, border: '1px solid rgba(167,139,250,0.3)' }}>
                    Road Course Preset
                  </span>
                )}
              </div>
              <button
                onClick={() => setWeights(roadCourse ? ROAD_COURSE_WEIGHTS : DEFAULT_WEIGHTS)}
                style={{ fontSize: '0.83rem', padding: '2px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>
                Reset {roadCourse ? 'Road Course' : 'Defaults'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { key: 'corrHistory',  label: 'Corr. Track History' },
                { key: 'longRunPace',  label: 'Long Run Pace' },
                { key: 'shortRunPace', label: 'Short Run Pace' },
                { key: 'startPos',     label: 'Starting Position' },
                { key: 'tireFalloff',  label: 'Tire Falloff' },
               { key: 'raceCraft',   label: 'Race Craft'  },
              { key: 'trackHistory', label: 'Track History' },
              ].map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 130 }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => adjustWeight(key, -0.05)} style={nudgeBtn}>&#8722;</button>
                    <div style={{ width: 44, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.03rem', color: 'var(--text-primary)' }}>
                      {Math.round(weights[key] * 100)}%
                    </div>
                    <button onClick={() => adjustWeight(key, 0.05)} style={nudgeBtn}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <button onClick={handleRun} disabled={running || !rawDrivers.length} style={{
              padding: '10px 28px', background: running ? 'var(--bg-elevated)' : 'var(--accent)',
              color: running ? 'var(--text-muted)' : '#111', border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: '1.03rem', cursor: running ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s',
            }}>
              {running && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
              {running ? `Running ${numSims.toLocaleString()} simulations...` : `Run ${numSims.toLocaleString()} Simulations`}
            </button>
            {simResults && (
              <button onClick={publishResults} style={{
                padding: '10px 28px', background: published ? 'var(--bg-elevated)' : '#1a6b2e',
                color: published ? 'var(--text-muted)' : '#e8f5e9',
                border: 'none', borderRadius: 8, fontWeight: 700,
                fontSize: '1.03rem', cursor: published ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}>
                {published ? 'Published' : 'Publish Results'}
              </button>
            )}

            <select value={numSims} onChange={e => setNumSims(parseInt(e.target.value))}
              style={{ padding: '9px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.94rem', cursor: 'pointer' }}>
              <option value={1000}>1,000 sims (fast)</option>
              <option value={10000}>10,000 sims</option>
              <option value={50000}>50,000 sims (precise)</option>
            </select>

            {simResults && (
              <button onClick={() => setShowBreakdown(v => !v)} style={{ padding: '9px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: '0.92rem', cursor: 'pointer' }}>
                {showBreakdown ? 'Hide' : 'Show'} Score Breakdown
              </button>
            )}
          </div>

          {simResults && (
            <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: '0.92rem', whiteSpace: 'nowrap', minWidth: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border)' }}>
                    {[
                      { key: null,            label: '#',        sortable: false },
                      { key: 'name',          label: 'Driver',   sortable: false, left: true },
                      { key: 'startPos',      label: 'Start',    title: 'Starting position' },
                      { key: 'projFinish',    label: 'Proj Fin', title: 'Projected average finish (25th-75th range)' },
                      { key: 'projDK',        label: 'Proj DK',  title: 'Projected DraftKings points' },
                      { key: 'projPlaceDiff', label: 'Pl Diff',  title: 'Projected place differential' },
                      { key: 'projLapsLed',   label: 'Laps Led', title: 'Projected average laps led' },
                      { key: 'avgFastLaps',   label: 'Fast Laps', title: 'Avg fastest laps per race' },
                      { key: 'winPct',        label: 'Win%',     title: 'Win probability' },
                      { key: 'top3Pct',       label: 'Top3%',    title: 'Top 3 finish probability' },
        { key: 'top5Pct',       label: 'Top5%',    title: 'Top 5 finish probability' },
                      { key: 'top10Pct',      label: 'Top10%',   title: 'Top 10 finish probability' },
                      { key: 'dnfPct',        label: 'DNF%',     title: 'DNF probability' },
                      ...(showBreakdown ? [
                        { key: null, label: 'Hist',  sortable: false, title: 'Corr. history score' },
                        { key: null, label: 'LRP',   sortable: false, title: 'Long run pace score' },
                        { key: null, label: 'SRP',   sortable: false, title: 'Short run pace score' },
                        { key: null, label: 'Start', sortable: false, title: 'Starting pos score' },
                        { key: null, label: 'Fall',  sortable: false, title: 'Tire falloff score' },
                        { key: null, label: 'RC',    sortable: false, title: 'Race craft score (avg quality pass %)' },
                        { key: null, label: 'Track', sortable: false, title: 'Specific track history score' },
                        { key: 'speedScore', label: 'Speed', title: 'Composite speed score' },
                      ] : []),
                    ].map((col, ci) => (
                      <th key={ci} title={col.title}
                        onClick={() => col.sortable !== false && col.key && handleSort(col.key)}
                        style={{
                          padding: '8px 10px', fontWeight: 700, fontSize: '0.8rem',
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
                    const fmt    = (v, d = 1) => v == null ? '--' : (+v).toFixed(d)
                    const fmtPct = v => v == null ? '--' : (+v).toFixed(1) + '%'
                    const fmtSgn = v => v == null ? '--' : (v >= 0 ? '+' : '') + (+v).toFixed(1)
                    const pdColor  = row.projPlaceDiff > 2 ? '#22c55e' : row.projPlaceDiff < -2 ? '#ef4444' : 'var(--text-secondary)'
                    const finColor = row.projFinish <= 5 ? '#22c55e' : row.projFinish <= 15 ? 'var(--text-primary)' : 'var(--text-secondary)'

                    return (
                      <tr key={row.name} style={{ background: bg, borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', minWidth: 32 }}>{ri + 1}</td>

                        <td style={{ padding: '7px 12px', textAlign: 'left', minWidth: 190, fontWeight: ri < 5 ? 600 : 500 }}>
                          {row.carNumber && (
                            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', marginRight: 6 }}>#{row.carNumber}</span>
                          )}
                          {row.name}
                          {row.organization && (
                            <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)', marginTop: 1 }}>{row.organization}</div>
                          )}
                        </td>

                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {row.startPos != null ? row.startPos : <span style={{ opacity: 0.4 }}>&mdash;</span>}
                        </td>

                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          <span style={{ fontWeight: 600, color: finColor }}>{fmt(row.projFinish)}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.79rem', marginLeft: 4 }}>
                            ({row.finishP25}&ndash;{row.finishP75})
                          </span>
                        </td>

                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: ri < 3 ? 'var(--accent)' : 'var(--text-primary)' }}>
                          {fmt(row.projDK, 2)}
                        </td>

                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: pdColor }}>
                          {fmtSgn(row.projPlaceDiff)}
                        </td>

                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: row.projLapsLed > 10 ? '#f59e0b' : 'var(--text-secondary)' }}>
                          {fmt(row.projLapsLed)}
                        </td>

                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: row.avgFastLaps > 10 ? '#f59e0b' : 'var(--text-secondary)' }}>
                          {fmt(row.avgFastLaps, 1)}
                        </td>

                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: row.winPct > 8 ? '#22c55e' : 'var(--text-secondary)' }}>
                          {fmtPct(row.winPct)}
                        </td>

                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {fmtPct(row.top3Pct)}
                </td>

                <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {fmtPct(row.top5Pct)}
                        </td>

                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {fmtPct(row.top10Pct)}
                        </td>

                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: row.dnfPct > 20 ? '#ef4444' : 'var(--text-muted)' }}>
                          {fmtPct(row.dnfPct)}
                        </td>

                        {showBreakdown && (
                          <>
                            {['corr', 'lrp', 'srp', 'sp', 'fall', 'rc', 'track'].map(k => (
                              <td key={k} style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                {row.scores?.[k] != null ? row.scores[k] : '--'}
                              </td>
                            ))}
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', fontSize: '0.92rem' }}>
                              {row.speedScore != null ? Math.round(row.speedScore) : '--'}
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
              <p style={{ color: 'var(--text-muted)', fontSize: '1.03rem' }}>
                Configure settings above and click Run to generate projections.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const labelStyle = {
  fontSize: '0.83rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 8,
}
const hintStyle = {
  fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6,
}
const presetBtn = {
  flex: 1, padding: '5px 0', borderRadius: 5,
  border: '1px solid var(--border)', fontWeight: 600,
  fontSize: '0.92rem', cursor: 'pointer',
}
const nudgeBtn = {
  width: 24, height: 24, borderRadius: 4,
  border: '1px solid var(--border)', background: 'var(--bg-elevated)',
  color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.18rem',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
}

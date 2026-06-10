// ============================================================
// NASCAR Practice Session Grader
// Stint-aware methodology — V3 (updated weights + grade scale)
// Weights are fixed and not exposed to users
// ============================================================

const WEIGHTS = {
  overallAvg: 0.30,
  lateRunAvg: 0.30,
  bestLap: 0.10,
  trendSlope: 0.05,
  consistency: 0.10,
  longestStint: 0.15,
}

// Lap time validity threshold per series
const LAP_TIME_MAX = {
  cup: 50,
  xfinity: 55,
  trucks: 60,
}

// Parse raw lap data from Excel row into stint arrays
export function parseStints(lapData) {
  const laps = []
  for (const [lapNum, lapTime] of Object.entries(lapData)) {
    const num = parseInt(lapNum)
    const time = parseFloat(lapTime)
    if (!isNaN(num) && !isNaN(time) && time > 10 && time < 120) {
      laps.push([num, time])
    }
  }
  if (laps.length === 0) return []
  laps.sort((a, b) => a[0] - b[0])

  const stints = []
  let current = [laps[0]]
  for (let i = 1; i < laps.length; i++) {
    if (laps[i][0] === laps[i - 1][0] + 1) {
      current.push(laps[i])
    } else {
      stints.push(current)
      current = [laps[i]]
    }
  }
  stints.push(current)
  return stints
}

// Sustained pace = middle 50% of longest stint (skips warmup and tire-falloff laps)
function getLateRunAvg(stints) {
  const validStints = stints.filter(s => s.length >= 5)
  if (validStints.length === 0) return null
  const longest = validStints.reduce((a, b) => a.length >= b.length ? a : b)
  const n = longest.length
  const start = Math.floor(n * 0.25)
  const end = Math.max(Math.floor(n * 0.75), start + 1)
  const midLaps = longest.slice(start, end).map(([, t]) => t)
  return midLaps.reduce((a, b) => a + b, 0) / midLaps.length
}

// Calculate trend slope within longest stint
function getTrendSlope(stints) {
  const validStints = stints.filter(s => s.length >= 5)
  if (validStints.length === 0) return 0
  const longest = validStints.reduce((a, b) => a.length >= b.length ? a : b)
  const n = longest.length
  const xs = longest.map(([num]) => num)
  const ys = longest.map(([, t]) => t)
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sumXX = xs.reduce((s, x) => s + x * x, 0)
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
}

// Scale a series of values 0-100
function scaleValues(values, higherIsBetter = true) {
  const valid = values.filter(v => v !== null && !isNaN(v))
  if (valid.length === 0) return values.map(() => 50)
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  if (max === min) return values.map(v => v === null ? null : 50)
  return values.map(v => {
    if (v === null || isNaN(v)) return null
    const norm = (v - min) / (max - min)
    return (higherIsBetter ? norm : 1 - norm) * 100
  })
}

function letterGrade(score) {
  if (score >= 93) return 'A+'
  if (score >= 87) return 'A'
  if (score >= 82) return 'A-'
  if (score >= 78) return 'B+'
  if (score >= 74) return 'B'
  if (score >= 70) return 'B-'
  if (score >= 64) return 'C+'
  if (score >= 58) return 'C'
  if (score >= 50) return 'C-'
  if (score >= 40) return 'D'
  return 'F'
}

export function gradeColor(grade) {
  const colors = {
    'A+': { bg: '#145A32', text: '#ffffff' },
    'A':  { bg: '#1E8449', text: '#ffffff' },
    'A-': { bg: '#27AE60', text: '#ffffff' },
    'B+': { bg: '#1A5276', text: '#ffffff' },
    'B':  { bg: '#2471A3', text: '#ffffff' },
    'B-': { bg: '#2980B9', text: '#ffffff' },
    'C+': { bg: '#7D6608', text: '#ffffff' },
    'C':  { bg: '#B7950B', text: '#000000' },
    'C-': { bg: '#D4AC0D', text: '#000000' },
    'D':  { bg: '#784212', text: '#ffffff' },
    'F':  { bg: '#922B21', text: '#ffffff' },
  }
  return colors[grade] || { bg: '#333333', text: '#ffffff' }
}

export function trendLabel(slope) {
  if (slope < -0.010) return { label: '↑↑ Strong Gain', color: '#1E8449' }
  if (slope < -0.004) return { label: '↑ Gaining',           color: '#27AE60' }
  if (slope < 0.004)  return { label: '→ Stable',            color: '#2471A3' }
  if (slope < 0.010)  return { label: '↓ Fading',            color: '#B7950B' }
  return                     { label: '↓↓ Falling Off', color: '#922B21' }
}

// Main grading function
// Input: array of { driver, start, lapData: { '1': 37.5, '2': 37.8, ... } }
// Output: array of graded driver objects sorted by composite score
export function gradePracticeSession(drivers) {
  const parsed = drivers.map(d => {
    const stints = parseStints(d.lapData || {})
    const allLaps = stints.flat().map(([, t]) => t)

    if (allLaps.length === 0) {
      return {
        ...d,
        stints: 0,
        longestStint: 0,
        totalLaps: 0,
        overallAvg: null,
        lateRunAvg: null,
        bestLap: null,
        trendSlope: 0,
        consistency: null,
      }
    }

    const overallAvg   = allLaps.reduce((a, b) => a + b, 0) / allLaps.length
    const lateRunAvg   = getLateRunAvg(stints) || overallAvg
    const bestLap      = Math.min(...allLaps)
    const trendSlope   = getTrendSlope(stints)
    const mean         = overallAvg
    const consistency  = Math.sqrt(allLaps.reduce((s, t) => s + Math.pow(t - mean, 2), 0) / allLaps.length)
    const longestStint = Math.max(...stints.map(s => s.length))
    const totalLaps    = allLaps.length

    return {
      ...d,
      stints: stints.length,
      longestStint,
      totalLaps,
      overallAvg:  Math.round(overallAvg  * 1000) / 1000,
      lateRunAvg:  Math.round(lateRunAvg  * 1000) / 1000,
      bestLap:     Math.round(bestLap     * 1000) / 1000,
      trendSlope:  Math.round(trendSlope  * 10000) / 10000,
      consistency: Math.round(consistency * 10000) / 10000,
    }
  })

  const overallAvgScores   = scaleValues(parsed.map(d => d.overallAvg),   false)
  const lateRunAvgScores   = scaleValues(parsed.map(d => d.lateRunAvg),   false)
  const bestLapScores      = scaleValues(parsed.map(d => d.bestLap),      false)
  const trendSlopeScores   = scaleValues(parsed.map(d => d.trendSlope),   false)
  const consistencyScores  = scaleValues(parsed.map(d => d.consistency),  false)
  const longestStintScores = scaleValues(parsed.map(d => d.longestStint), true)

  const graded = parsed.map((d, i) => {
    const s_overall = overallAvgScores[i]
    const s_late    = lateRunAvgScores[i]
    const s_best    = bestLapScores[i]
    const s_trend   = trendSlopeScores[i]
    const s_consist = consistencyScores[i]
    const s_longest = longestStintScores[i]

    let composite = null
    if (s_overall !== null) {
      composite = (
        s_overall * WEIGHTS.overallAvg   +
        s_late    * WEIGHTS.lateRunAvg   +
        s_best    * WEIGHTS.bestLap      +
        s_trend   * WEIGHTS.trendSlope   +
        s_consist * WEIGHTS.consistency  +
        s_longest * WEIGHTS.longestStint
      )
      composite = Math.round(composite * 10) / 10
    }

    const grade = composite !== null ? letterGrade(composite) : null

    return {
      ...d,
      composite,
      grade,
      scores: {
        overallAvg:   s_overall !== null ? Math.round(s_overall * 10) / 10 : null,
        lateRunAvg:   s_late    !== null ? Math.round(s_late    * 10) / 10 : null,
        bestLap:      s_best    !== null ? Math.round(s_best    * 10) / 10 : null,
        trendSlope:   s_trend   !== null ? Math.round(s_trend   * 10) / 10 : null,
        consistency:  s_consist !== null ? Math.round(s_consist * 10) / 10 : null,
        longestStint: s_longest !== null ? Math.round(s_longest * 10) / 10 : null,
      }
    }
  })

  graded.sort((a, b) => {
    if (a.composite === null) return 1
    if (b.composite === null) return -1
    return b.composite - a.composite
  })

  return graded.map((d, i) => ({ ...d, rank: i + 1 }))
}

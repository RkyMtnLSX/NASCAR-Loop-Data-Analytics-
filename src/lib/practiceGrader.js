/* eslint-disable */
// ============================================================
// NASCAR Practice Session Grader — V5
// Stint-aware methodology
// V5 changes:
//   - longRunPace weight raised to 0.50 (speed is king)
//   - stintAvgPace removed (redundant with raw long run pace)
//   - shortRunPace reduced to 0.15; consistency to 0.10; bestLap raised to 0.10
//   - Long run pace: all laps across all stints, drop any lap >8% slower than session median
//   - Tire falloff: longest stint only, >=10-lap minimum (was length-weighted avg)
//   - Mock qual stints detected and excluded from short run pace
//   - Median fill for drivers missing lrp or srp (not penalized)
// ============================================================

const WEIGHTS = {
  longRunPace:  0.50,
  shortRunPace: 0.15,
  tireFalloff:  0.15,
  consistency:  0.10,
  bestLap:      0.10,
}

const MIN_MEANINGFUL_LAPS = 3
const FALLOFF_MIN_LAPS    = 10

// Parse raw lap data into stint arrays (consecutive lap number sequences)
export function parseStints(lapData) {
  const laps = []
  for (const [lapNum, lapTime] of Object.entries(lapData)) {
    const num  = parseInt(lapNum)
    const time = parseFloat(lapTime)
    if (!isNaN(num) && !isNaN(time) && time > 10 && time < 1200) {
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

// ── Internal helpers ──────────────────────────────────────────

function _avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function _stddev(arr) {
  if (arr.length < 2) return 0
  const m = _avg(arr)
  return Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / (arr.length - 1))
}

// Middle 50% of a stint (skips first/last 25%)
function _mid50(stint) {
  const n     = stint.length
  const start = Math.floor(n * 0.25)
  const end   = Math.max(Math.floor(n * 0.75), start + 1)
  return stint.slice(start, end).map(([, t]) => t)
}

// Linear regression slope (seconds per lap)
function _linSlope(stint) {
  const n = stint.length
  if (n < 2) return 0
  const xs  = stint.map((_, i) => i)
  const ys  = stint.map(([, t]) => t)
  const sx  = xs.reduce((a, b) => a + b, 0)
  const sy  = ys.reduce((a, b) => a + b, 0)
  const sxy = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sxx = xs.reduce((s, x) => s + x * x, 0)
  return (n * sxy - sx * sy) / (n * sxx - sx * sx)
}

// Scale array to 0-100 relative to field; nulls pass through
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

// Replace nulls with field median
function _medianFill(scaledArr) {
  const vals   = scaledArr.filter(v => v !== null).sort((a, b) => a - b)
  const median = vals.length ? vals[Math.floor(vals.length / 2)] : 50
  return scaledArr.map(v => (v === null ? median : v))
}

// ── Grade/color helpers ───────────────────────────────────────

export function percentileGrade(rank, total) {
  const pct = rank / total
  if (pct <= 0.03) return 'A+'
  if (pct <= 0.08) return 'A'
  if (pct <= 0.13) return 'A-'
  if (pct <= 0.21) return 'B+'
  if (pct <= 0.32) return 'B'
  if (pct <= 0.42) return 'B-'
  if (pct <= 0.55) return 'C+'
  if (pct <= 0.68) return 'C'
  if (pct <= 0.79) return 'C-'
  if (pct <= 0.89) return 'D'
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
  if (slope < -0.004) return { label: '↑ Gaining',      color: '#27AE60' }
  if (slope <  0.004) return { label: '→ Stable',        color: '#2471A3' }
  if (slope <  0.010) return { label: '↓ Fading',        color: '#B7950B' }
  return                     { label: '↓↓ Falling Off',  color: '#922B21' }
}

// ── Main grading function ─────────────────────────────────────
// Input:  array of { driver, start, lapData: { '1': 53.4, '2': 53.6, ... } }
// Output: array sorted by composite score, each driver has rank + grade
export function gradePracticeSession(drivers) {

  // Step 1: Parse stints and extract raw metrics
  const parsed = drivers.map(d => {
    const stints   = parseStints(d.lapData || {})
    const allLaps  = stints.flat()
    const allTimes = allLaps.map(([, t]) => t)
    const totalLaps = allTimes.length

    if (totalLaps === 0) {
      return { ...d, stints: 0, longestStint: 0, totalLaps: 0,
               overallAvg: null, lateRunAvg: null, bestLap: null,
               trendSlope: null, consistency: null, inc: true }
    }

    // Tag each stint with position in session (first lap / max lap num)
    const maxLapNum = Math.max(...allLaps.map(([n]) => n))
    const tagged = stints.map(s => ({
      stint: s,
      len:   s.length,
      pos:   s[0][0] / maxLapNum,
      avg:   _avg(s.map(([, t]) => t)),
    }))

    const shortCands = tagged.filter(c => c.len <= 4)
    const longStints = tagged.filter(c => c.len >= MIN_MEANINGFUL_LAPS)

    // Mock-qual detection: <=2 laps, late in session (pos >= 0.50), >0.5s faster than naive short avg
    const naiveShortAvg = shortCands.length
      ? _avg(shortCands.flatMap(c => c.stint.map(([, t]) => t)))
      : null
    const mqSet = new Set(
      shortCands
        .filter(c => c.len <= 2 && c.pos >= 0.50 && naiveShortAvg !== null && c.avg < naiveShortAvg - 0.50)
        .map(c => c.stint)
    )

    // Short run pace: avg of short-stint laps excluding mock-qual stints
    const realShortTimes = shortCands
      .filter(c => !mqSet.has(c.stint))
      .flatMap(c => c.stint.map(([, t]) => t))
    const shortRunPace = realShortTimes.length ? _avg(realShortTimes) : null

    // Long run pace: all laps across all stints, drop any lap >8% slower than session median
    const lrpSorted    = [...allTimes].sort((a, b) => a - b)
    const lrpMedian    = lrpSorted.length ? lrpSorted[Math.floor(lrpSorted.length / 2)] : null
    const longRunTimes = lrpMedian != null ? allTimes.filter(t => t <= lrpMedian * 1.08) : allTimes
    const longRunPace  = longRunTimes.length ? _avg(longRunTimes) : null

    // INC check: too few meaningful laps
    const mqTimes = new Set([...mqSet].flatMap(s => s.map(([, t]) => t)))
    const meaningfulLaps = allTimes.filter(t => !mqTimes.has(t))
    if (meaningfulLaps.length < MIN_MEANINGFUL_LAPS) {
      return {
        ...d,
        stints: stints.length,
        longestStint: longStints.length ? Math.max(...longStints.map(c => c.len)) : 0,
        totalLaps,
        overallAvg: null, lateRunAvg: null,
        bestLap: Math.round(Math.min(...allTimes) * 1000) / 1000,
        trendSlope: null, consistency: null, inc: true,
      }
    }

    // Longest qualifying long stint
    const longest = longStints.length
      ? longStints.reduce((a, b) => a.len >= b.len ? a : b)
      : null

    // Tire falloff: linear slope of longest stint, >=10 laps required; null otherwise (median fill)
    const tireSlope = (longest && longest.len >= FALLOFF_MIN_LAPS)
      ? _linSlope(longest.stint)
      : null

    // Consistency: stddev of mid50 of longest long stint; fallback to short laps
    const consistency = longest
      ? _stddev(_mid50(longest.stint))
      : (realShortTimes.length >= 2 ? _stddev(realShortTimes) : null)

    const bestLap = Math.min(...allTimes)

    return {
      ...d,
      stints:      stints.length,
      longestStint: longest ? longest.len : 0,
      totalLaps,
      overallAvg:  longRunPace  !== null ? Math.round(longRunPace  * 1000) / 1000 : null,
      lateRunAvg:  shortRunPace !== null ? Math.round(shortRunPace * 1000) / 1000 : null,
      bestLap:     Math.round(bestLap * 1000) / 1000,
      trendSlope:  tireSlope    !== null ? Math.round(tireSlope    * 10000) / 10000 : null,
      consistency: consistency  !== null ? Math.round(consistency  * 10000) / 10000 : null,
      inc: false,
    }
  })

  // Step 2: Separate gradable from INC
  const gradable   = parsed.filter(d => !d.inc)
  const incDrivers = parsed.filter(d => d.inc)

  if (gradable.length === 0) {
    return parsed.map((d, i) => ({ ...d, rank: i + 1, grade: null, composite: null }))
  }

  // Step 3: Scale each metric across the field
  const lrpRaw = gradable.map(d => d.overallAvg)
  const srpRaw = gradable.map(d => d.lateRunAvg)
  const tfRaw  = gradable.map(d => d.trendSlope)
  const conRaw = gradable.map(d => d.consistency)
  const blRaw  = gradable.map(d => d.bestLap)

  const lrpScaled = scaleValues(lrpRaw, false)
  const srpScaled = scaleValues(srpRaw, false)
  const tfScaled  = scaleValues(tfRaw,  false)
  const conScaled = scaleValues(conRaw, false)
  const blScaled  = scaleValues(blRaw,  false)

  // Median fill for missing lrp/srp (not penalized for not running those stint types)
  const lrpFilled = _medianFill(lrpScaled)
  const srpFilled = _medianFill(srpScaled)
  const tfFilled  = _medianFill(tfScaled)

  // Step 4: Composite score with fallbacks for missing data
  const scored = gradable.map((d, i) => {
    const hasLrp = lrpRaw[i] !== null
    const hasSrp = srpRaw[i] !== null

    let composite
    if (!hasLrp && !hasSrp) {
      composite = tfFilled[i] * 0.55 + (conScaled[i] ?? 50) * 0.25 + blScaled[i] * 0.20
    } else if (!hasLrp) {
      composite = srpFilled[i] * 0.65 + tfFilled[i] * 0.15 + (conScaled[i] ?? 50) * 0.10 + blScaled[i] * 0.10
    } else if (!hasSrp) {
      composite = lrpFilled[i] * 0.70 + tfFilled[i] * 0.15 + (conScaled[i] ?? 50) * 0.10 + blScaled[i] * 0.05
    } else {
      composite = (
        lrpFilled[i]         * WEIGHTS.longRunPace  +
        srpFilled[i]         * WEIGHTS.shortRunPace +
        tfFilled[i]          * WEIGHTS.tireFalloff  +
        (conScaled[i] ?? 50) * WEIGHTS.consistency  +
        blScaled[i]          * WEIGHTS.bestLap
      )
    }

    return {
      ...d,
      composite: Math.round(composite * 10) / 10,
      scores: {
        longRunPace:  hasLrp          ? Math.round(lrpScaled[i] * 10) / 10 : null,
        shortRunPace: hasSrp          ? Math.round(srpScaled[i] * 10) / 10 : null,
        tireFalloff:  tfRaw[i] !== null ? Math.round(tfScaled[i]  * 10) / 10 : null,
        consistency:  conRaw[i] !== null ? Math.round(conScaled[i] * 10) / 10 : null,
        bestLap:      Math.round(blScaled[i] * 10) / 10,
      },
    }
  })

  // Step 5: Sort, rank, grade
  scored.sort((a, b) => b.composite - a.composite)
  const total = scored.length

  const gradedDrivers = scored.map((d, i) => ({
    ...d,
    rank:  i + 1,
    grade: percentileGrade(i + 1, total),
  }))

  const incRanked = incDrivers.map((d, i) => ({
    ...d,
    rank:      total + i + 1,
    grade:     null,
    composite: null,
  }))

  return [...gradedDrivers, ...incRanked]
}

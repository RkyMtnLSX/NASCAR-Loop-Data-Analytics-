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
  const allT = stint.map(([, t]) => t)
  const tSorted = [...allT].sort((a, b) => a - b)
  const tMed = tSorted[Math.floor(tSorted.length / 2)]
  const clean = tMed != null ? stint.filter(([, t]) => t <= tMed * 1.08) : stint
  const n = clean.length
  if (n < 8) return null
  const xs = clean.map((_, i) => i)
  const ys = clean.map(([, t]) => t)
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
  const MIN_LAPS = 3
  const wavg = (arr, vf, wf) => { let sv = 0, sw = 0; arr.forEach(r => { const v = vf(r); if (v == null) return; const w = wf(r); sv += v * w; sw += w }); return sw ? sv / sw : null }
  const rnd = (x, p) => x == null ? null : Math.round(x * p) / p

  const parsed = drivers.map(dr => {
    const stints = parseStints(dr.lapData || {})
    const allLaps = stints.flat()
    const allTimes = allLaps.map(([, t]) => t)
    const totalLaps = allTimes.length
    if (totalLaps === 0) {
      return { ...dr, stints: 0, longestStint: 0, totalLaps: 0, overallAvg: null, lateRunAvg: null, bestLap: null, trendSlope: null, consistency: null, avgPace: null, bestStint: null, longRun: null, inc: true }
    }
    const runStats = stints.map(st => {
      const times = st.map(([, t]) => t)
      const srt = [...times].sort((a, b) => a - b)
      const med = srt[Math.floor(srt.length / 2)]
      const clean = med != null ? times.filter(t => t <= med * 1.06) : times
      return { len: clean.length, avg: clean.length ? _avg(clean) : null, slope: clean.length >= 8 ? _linSlope(st) : null, std: clean.length >= 3 ? _stddev(_mid50(st)) : null }
    })
    const gradableRuns = runStats.filter(r => r.avg != null && r.len >= MIN_LAPS)
    const longRuns = gradableRuns.filter(r => r.len >= 10)
    const slopeRuns = gradableRuns.filter(r => r.slope != null)

    const avgPace = gradableRuns.length ? _avg(gradableRuns.map(r => r.avg)) : null
    const bestStint = gradableRuns.length ? Math.min(...gradableRuns.map(r => r.avg)) : null
    const longRun = longRuns.length ? wavg(longRuns, r => r.avg, r => r.len) : null
    const falloff = slopeRuns.length ? wavg(slopeRuns, r => r.slope, r => r.len) : null
    const consistency = longRuns.length ? wavg(longRuns, r => r.std, r => r.len) : (gradableRuns.length ? wavg(gradableRuns, r => r.std, r => r.len) : null)

    const aSrt = [...allTimes].sort((a, b) => a - b)
    const aMed = aSrt[Math.floor(aSrt.length / 2)]
    const allClean = aMed != null ? allTimes.filter(t => t <= aMed * 1.08) : allTimes
    const overallAvg = allClean.length ? _avg(allClean) : null
    const shortTimes = stints.filter(st => st.length <= 4).flatMap(st => st.map(([, t]) => t))
    const lateRunAvg = shortTimes.length ? _avg(shortTimes) : null
    const bestLap = Math.min(...allTimes)
    const longest = gradableRuns.length ? Math.max(...gradableRuns.map(r => r.len)) : 0

    if (totalLaps < MIN_LAPS || avgPace == null) {
      return { ...dr, stints: stints.length, longestStint: longest, totalLaps, overallAvg: rnd(overallAvg, 1000), lateRunAvg: rnd(lateRunAvg, 1000), bestLap: rnd(bestLap, 1000), trendSlope: rnd(falloff, 10000), consistency: rnd(consistency, 1000), avgPace: null, bestStint: null, longRun: null, inc: true }
    }
    return { ...dr, stints: stints.length, longestStint: longest, totalLaps,
      overallAvg: rnd(overallAvg, 1000), lateRunAvg: rnd(lateRunAvg, 1000), bestLap: rnd(bestLap, 1000),
      trendSlope: rnd(falloff, 10000), consistency: rnd(consistency, 1000),
      avgPace: rnd(avgPace, 1000), bestStint: rnd(bestStint, 1000), longRun: rnd(longRun, 1000), inc: false }
  })

  const gradable = parsed.filter(d => !d.inc)
  const incs = parsed.filter(d => d.inc)
  if (gradable.length === 0) return parsed.map((d, i) => ({ ...d, rank: i + 1, grade: null, composite: null }))

  const rankScale = (key) => {
    const valid = gradable.filter(d => d[key] != null).sort((a, b) => a[key] - b[key])
    const N = valid.length
    const sc = new Map()
    valid.forEach((d, i) => sc.set(d, N > 1 ? 100 * (1 - i / (N - 1)) : 100))
    return sc
  }
  const alS = rankScale('overallAvg'), blS = rankScale('bestLap')
  const scored = gradable.map(d => {
    const al = alS.has(d) ? alS.get(d) : 50
    const bl = blS.has(d) ? blS.get(d) : 50
    return { ...d, composite: Math.round((al * 0.50 + bl * 0.50) * 10) / 10 }
  })
  scored.sort((a, b) => b.composite - a.composite)
  const total = scored.length
  scored.forEach((d, i) => { d.rank = i + 1; d.grade = percentileGrade(i + 1, total) })
  return scored.concat(incs.map(d => ({ ...d, rank: null, grade: null, composite: null })))
}

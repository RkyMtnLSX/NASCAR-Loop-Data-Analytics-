// ============================================================
// NASCAR Practice Session Grader — V4
// New methodology: Long Run Pace + Short Run Pace + Tire Falloff
//   (falloff measured per-stint across all long runs)
// Weights are fixed and not exposed to users
// ============================================================

const WEIGHTS = {
  longRunPace:  0.30,
  shortRunPace: 0.25,
  tireFalloff:  0.15,
  consistency:  0.15,
  longestStint: 0.10,
  bestLap:      0.05,
}

// Minimum meaningful laps (after mock qual exclusion) to receive a grade
const MIN_MEANINGFUL_LAPS = 5

// ── Helpers ──────────────────────────────────────────────────

function _avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function _stddev(arr) {
  if (arr.length < 2) return 0
  const m = _avg(arr)
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1))
}

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

// Middle 50% of a stint — skips warmup laps at front and anomalous laps at back
function _mid50(stint) {
  const n     = stint.length
  const start = Math.floor(n * 0.25)
  const end   = Math.max(Math.floor(n * 0.75), start + 1)
  return stint.slice(start, end).map(([, t]) => t)
}

// ── Parse lap data into stint arrays ────────────────────────

export function parseStints(lapData) {
  const laps = []
  for (const [lapNum, lapTime] of Object.entries(lapData)) {
    const num  = parseInt(lapNum)
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

// ── Scaling ──────────────────────────────────────────────────

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

// Fill null values with field median before scaling
function _medianFill(arr) {
  const vals = arr.filter(v => v !== null).sort((a, b) => a - b)
  const med  = vals.length ? vals[Math.floor(vals.length / 2)] : 50
  return arr.map(v => v === null ? med : v)
}

// ── Grade / color helpers ────────────────────────────────────

function percentileGrade(rank, total) {
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
    'A+':  { bg: '#145A32', text: '#ffffff' },
    'A':   { bg: '#1E8449', text: '#ffffff' },
    'A-':  { bg: '#27AE60', text: '#ffffff' },
    'B+':  { bg: '#1A5276', text: '#ffffff' },
    'B':   { bg: '#2471A3', text: '#ffffff' },
    'B-':  { bg: '#2980B9', text: '#ffffff' },
    'C+':  { bg: '#7D6608', text: '#ffffff' },
    'C':   { bg: '#B7950B', text: '#000000' },
    'C-':  { bg: '#D4AC0D', text: '#000000' },
    'D':   { bg: '#784212', text: '#ffffff' },
    'F':   { bg: '#922B21', text: '#ffffff' },
    'INC': { bg: '#555555', text: '#ffffff' },
  }
  return colors[grade] || { bg: '#333333', text: '#ffffff' }
}

// Tire falloff label — slope in seconds/lap (positive = degrading)
export function falloffLabel(slope) {
  if (slope === null || slope === undefined) return null
  if (slope < 0.03)  return { label: '↔ Minimal',    color: '#27AE60' }
  if (slope < 0.10)  return { label: '↓ Moderate',   color: '#2471A3' }
  if (slope < 0.18)  return { label: '↓↓ Fading',    color: '#B7950B' }
  if (slope < 0.25)  return { label: '↓↓ High',      color: '#E67E22' }
  return                    { label: '↓↓↓ Severe',   color: '#922B21' }
}

// Backward-compat alias used by PracticeReportCard
export function trendLabel(slope) {
  return falloffLabel(slope)
}

// ── Main grading function ────────────────────────────────────
// Input:  array of { driver, start, lapData: { '1': 55.1, '2': 55.3, ... } }
// Output: array of graded driver objects sorted by composite score, INC at bottom
//
// Column mapping (stored field name → new meaning):
//   overallAvg  → long run pace  (mid-50% of each ≥5-lap stint, averaged)
//   lateRunAvg  → short run pace (avg of ≤4-lap stints not flagged as mock qual)
//   trendSlope  → tire falloff   (length-weighted avg linear slope across all ≥5-lap stints)
//   consistency → std dev within mid-50% of longest long stint
export function gradePracticeSession(drivers) {

  // ── Step 1: compute raw metrics per driver ──
  const parsed = drivers.map(d => {
    const stints    = parseStints(d.lapData || {})
    const allTimes  = stints.flat().map(([, t]) => t)
    const totalLaps = allTimes.length

    if (totalLaps === 0) {
      return {
        ...d, stints: 0, longestStint: 0, totalLaps: 0,
        overallAvg: null, lateRunAvg: null, bestLap: null,
        trendSlope: null, consistency: null,
        inc: true, meaningfulLaps: 0, mqCount: 0,
      }
    }

    const maxLapNum = Math.max(...stints.flat().map(([n]) => n))

    const tagged = stints.map(s => ({
      stint: s,
      len:   s.length,
      pos:   s[0][0] / maxLapNum,        // 0 = session start, 1 = session end
      avg:   _avg(s.map(([, t]) => t)),
    }))

    // Mock qual: late in session (pos ≥ 0.50) + ≤2 laps + >0.5s faster than naive short avg
    // Early short stints are legitimate new-tire pace — NOT flagged as mock qual
    const shortCands = tagged.filter(c => c.len <= 4)
    const naiveSA    = shortCands.length
      ? _avg(shortCands.flatMap(c => c.stint.map(([, t]) => t)))
      : null
    const mqStints = shortCands.filter(c =>
      c.len <= 2 && c.pos >= 0.50 && naiveSA !== null && c.avg < naiveSA - 0.50
    )
    const mqSet   = new Set(mqStints.map(c => c.stint))
    const mqTimes = new Set(mqStints.flatMap(c => c.stint.map(([, t]) => t)))

    const meaningfulTimes = allTimes.filter(t => !mqTimes.has(t))

    if (meaningfulTimes.length < MIN_MEANINGFUL_LAPS) {
      return {
        ...d,
        stints:        stints.length,
        longestStint:  Math.max(...stints.map(s => s.length)),
        totalLaps,
        overallAvg:    null,
        lateRunAvg:    null,
        bestLap:       Math.round(Math.min(...allTimes) * 1000) / 1000,
        trendSlope:    null,
        consistency:   null,
        inc:           true,
        meaningfulLaps: meaningfulTimes.length,
        mqCount:        mqStints.length,
      }
    }

    // Short run pace: all ≤4-lap stints NOT mock qual (early fast stints count)
    const realShort    = shortCands.filter(c => !mqSet.has(c.stint))
    const shortTimes   = realShort.flatMap(c => c.stint.map(([, t]) => t))
    const shortRunPace = shortTimes.length ? _avg(shortTimes) : null

    // Long run stints: ≥5 laps
    const longStints  = tagged.filter(c => c.len >= 5)
    const longest     = longStints.length
      ? longStints.reduce((a, b) => a.len >= b.len ? a : b)
      : null
    const longRunLaps  = longStints.flatMap(c => _mid50(c.stint))
    const longRunPace  = longRunLaps.length ? _avg(longRunLaps) : null

    // Tire falloff: length-weighted avg slope across ALL ≥5-lap stints
    let tireFalloff = null
    if (longStints.length) {
      const totalLen = longStints.reduce((a, c) => a + c.len, 0)
      tireFalloff = longStints.reduce((a, c) => a + _linSlope(c.stint) * c.len, 0) / totalLen
    }

    // Consistency: std dev within mid-50% of longest long stint
    // Fallback: std dev of short run laps if no long stints exist
    let consistency = null
    if (longest) {
      consistency = _stddev(_mid50(longest.stint))
    } else if (shortTimes.length >= 2) {
      consistency = _stddev(shortTimes)
    }

    const longestStint = Math.max(...stints.map(s => s.length))
    const bestLap      = Math.min(...allTimes)

    return {
      ...d,
      stints:        stints.length,
      longestStint,
      totalLaps,
      meaningfulLaps: meaningfulTimes.length,
      mqCount:        mqStints.length,
      // Stored under legacy field names so Admin.js upsert needs no changes
      overallAvg:  longRunPace  !== null ? Math.round(longRunPace  * 1000)  / 1000  : null,
      lateRunAvg:  shortRunPace !== null ? Math.round(shortRunPace * 1000)  / 1000  : null,
      bestLap:     Math.round(bestLap * 1000) / 1000,
      trendSlope:  tireFalloff  !== null ? Math.round(tireFalloff  * 10000) / 10000 : null,
      consistency: consistency  !== null ? Math.round(consistency  * 10000) / 10000 : null,
      inc:         false,
    }
  })

  // ── Step 2: scale metrics across gradable field only ──
  const gradable   = parsed.filter(d => !d.inc)
  const incDrivers = parsed.filter(d => d.inc)

  const lrpRaw = gradable.map(d => d.overallAvg)
  const srpRaw = gradable.map(d => d.lateRunAvg)
  const tfRaw  = gradable.map(d => d.trendSlope)
  const conRaw = gradable.map(d => d.consistency)
  const lsRaw  = gradable.map(d => d.longestStint)
  const blRaw  = gradable.map(d => d.bestLap)

  const lrpScaled = scaleValues(_medianFill(lrpRaw), false)      // lower pace = better
  const srpScaled = scaleValues(_medianFill(srpRaw), false)
  const tfScaled  = scaleValues(tfRaw.map(v => v ?? 0), false)   // lower slope = better
  const conScaled = scaleValues(conRaw.map(v => v ?? 0), false)  // lower stddev = better
  const lsScaled  = scaleValues(lsRaw, true)                     // more laps = better
  const blScaled  = scaleValues(blRaw, false)

  // ── Step 3: composite score ──
  const scored = gradable.map((d, i) => {
    const lrp = lrpRaw[i] !== null ? lrpScaled[i] : null
    const srp = srpRaw[i] !== null ? srpScaled[i] : null
    const tf  = tfScaled[i]
    const con = conScaled[i]
    const ls  = lsScaled[i]
    const bl  = blScaled[i]

    let composite
    if (lrp === null && srp === null) {
      composite = tf * 0.40 + con * 0.30 + ls * 0.20 + bl * 0.10
    } else if (lrp === null) {
      composite = srp * 0.55 + tf * 0.15 + con * 0.15 + ls * 0.10 + bl * 0.05
    } else if (srp === null) {
      composite = lrp * 0.55 + tf * 0.15 + con * 0.15 + ls * 0.10 + bl * 0.05
    } else {
      composite =
        lrp * WEIGHTS.longRunPace  +
        srp * WEIGHTS.shortRunPace +
        tf  * WEIGHTS.tireFalloff  +
        con * WEIGHTS.consistency  +
        ls  * WEIGHTS.longestStint +
        bl  * WEIGHTS.bestLap
    }

    return {
      ...d,
      composite: Math.round(composite * 10) / 10,
      scores: {
        longRunPace:  lrp !== null ? Math.round(lrp * 10) / 10 : null,
        shortRunPace: srp !== null ? Math.round(srp * 10) / 10 : null,
        tireFalloff:  Math.round(tf  * 10) / 10,
        consistency:  Math.round(con * 10) / 10,
        longestStint: Math.round(ls  * 10) / 10,
        bestLap:      Math.round(bl  * 10) / 10,
      },
    }
  })

  // ── Step 4: sort + assign grades ──
  scored.sort((a, b) => b.composite - a.composite)

  const total  = scored.length
  const result = scored.map((d, i) => ({
    ...d,
    rank:  i + 1,
    grade: percentileGrade(i + 1, total),
  }))

  // INC drivers appended at bottom with no composite grade
  const incResult = incDrivers.map((d, i) => ({
    ...d,
    rank:      result.length + i + 1,
    grade:     'INC',
    composite: null,
    scores:    null,
  }))

  return [...result, ...incResult]
}

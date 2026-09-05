/* eslint-disable */
// ============================================================
// NASCAR Practice Session Grader — GRADE v6-tc (2026-08-08)
// v6-tc: all five ranked inputs are TIRE-CORRECTED copies (see gradePracticeSession).
// v6.1: pace half ranks overallTC (all corrected clean laps) - no stint-count artifact.
// v6.2: speed half ranks RAW best5/bestLap - corrected laps barred from the speed half.
// Composite = pace*.40 + speed*.40 + longRun*.20
//   pace   : avgPace rank (per-stint cleaned averages; overallAvg fallback)
//   speed  : best5 rank (5 fastest laps; bestLap fallback) — shipped 2026-07-17
//   longRun: long_run rank (worn-tire pace, all stints); drivers with NO long
//            run get 25, penalized not neutral — winning cars sustain pace.
// Backtest 2026-08-08, 41 races all series (clean 33 w/ long-run coverage):
//   winner mean grade rank 7.7->7.3, top5 mean rank 10.6->10.2, top5 hits
//   1.81->1.95, full-field Spearman .441->.447, per-race W13/L6/T12.
//   Metric = winner/top-5 identification: the card is a user-facing eyeball
//   tool and does NOT feed the simulation (sim reads raw overall_avg/best5;
//   practice_score only null-checked by the EDGE gate).
// History: 7/4 AllLaps.50/BestLap.50 (0.306 full-field); 7/17 speed->best5
//   (W47/L23); 8/8 +longRun*.20 w/ missing penalty. See BACKTEST_LOG.md.
// ============================================================

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

  // PIT LAPS AS STINT BOUNDARIES (2026-09-05). Watcher-built LAPS_RAW sheets keep every lap
  // under 300s, so a pit visit at a short track arrives as a NUMBERED 40-300s lap instead of a
  // gap in the numbering (Darlington O'Reilly practice: 40 such laps; cup NH R25 already in the
  // DB with 10). Splitting only on numbering gaps then glued run-pit-run into one stint: the
  // tire-age counter ran on through the pit and the long-run term saw one run instead of two.
  // A lap over PIT_LAP_RATIO x the driver median (6+ s slow at Darlington) is a pit or in-out lap: it ends the stint
  // and is dropped. Old-method sheets ('--' at the pit) are unchanged - they were gaps already.
  const PIT_LAP_RATIO = 1.2   // matches pitboard_practice_sheet.py page-1 flying-lap cut; the 40-57s in/out laps at Darlington sit at 1.21-1.72x
  const srtT = laps.map(x => x[1]).sort((a, b) => a - b)
  const medT = srtT[Math.floor(srtT.length / 2)]
  const isPit = (t) => medT > 0 && t > medT * PIT_LAP_RATIO

  const stints = []
  let current = []
  for (let i = 0; i < laps.length; i++) {
    if (isPit(laps[i][1])) { if (current.length) stints.push(current); current = []; continue }
    if (current.length && laps[i][0] !== current[current.length - 1][0] + 1) { stints.push(current); current = [] }
    current.push(laps[i])
  }
  if (current.length) stints.push(current)
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
export function gradePracticeSession(drivers, priorRatings) {
  const MIN_LAPS = 3
  const wavg = (arr, vf, wf) => { let sv = 0, sw = 0; arr.forEach(r => { const v = vf(r); if (v == null) return; const w = wf(r); sv += v * w; sw += w }); return sw ? sv / sw : null }
  const rnd = (x, p) => x == null ? null : Math.round(x * p) / p

  // TIRE-CORRECTED PACE (v6-tc, 2026-08-08): fit the session's falloff slope (sec per
  // lap-on-tires) via within-stint demeaned regression on clean laps, then normalize every
  // lap to lap-5 tire age for the RANKED metric copies (avgPaceTC/best5TC/longRunTC/...).
  // STORED + DISPLAY metrics stay raw. Kills fresh-tire subsidy (Gilliland 44-lap sticker
  // session out-averaging Blaney's 91-lap grind; Sieg short-burst A). Backtest 38 races:
  // winner rank 7.32->6.24, top5 10.07->8.91, hits 1.84->2.11, rho .436->.454, W25/L13
  // on rho (see BACKTEST_LOG 2026-08-08). Two tire sets per session make lap-in-stint an
  // approximate tire-age proxy - stint break resets age, which matches a set change.
  let __tcSxy = 0, __tcSxx = 0
  drivers.forEach(dr => {
    parseStints(dr.lapData || {}).forEach(st => {
      const times = st.map(x => x[1])
      const srt = [...times].sort((a, b) => a - b)
      const med = srt[Math.floor(srt.length / 2)]
      const pts = []
      st.forEach((x, i) => { if (x[1] <= med * 1.06) pts.push([Math.min(i + 1, 40), x[1]]) })
      if (pts.length < 4) return
      const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length
      const my = pts.reduce((a, p) => a + p[1], 0) / pts.length
      pts.forEach(p => { __tcSxy += (p[0] - mx) * (p[1] - my); __tcSxx += (p[0] - mx) * (p[0] - mx) })
    })
  })
  const __tcBeta = __tcSxx ? __tcSxy / __tcSxx : 0

  // SESSION-TIME CORRECTION (v6.3-st, 2026-08-14): sessions open ~1.5-2.3s fast and decay
  // over ~25min (fresh-sticker first-run window). Cup A/B experiment 2026-08-14: group B
  // re-opened exactly as fast as A despite A's rubber - each GROUP gets its own clock.
  // Tire correction is blind to this (within-stint age only, not compound freshness).
  // Method: per-driver-demeaned tire-corrected clean-lap residuals, median per 5-min
  // group-relative bucket (composition-robust), effects centered lap-weighted zero, each
  // lap corrected by minus its bucket effect. Pace/longRun get tire+session; the raw
  // speed half gets session-only (a green-track flyer is not comparable peak speed).
  // ACTIVE only when >=60% of clean laps carry dr.lapTs timestamps and >=3 buckets have
  // >=10 laps - historical sessions grade exactly as before. NO HISTORICAL BACKTEST
  // POSSIBLE (timestamps exist 2026-08-14 forward): shipped on construct validity,
  // PROSPECTIVE validation weekly vs race-day driver rating (BACKTEST_LOG 2026-08-14).
  const __stFx = (() => {
    try {
      const g0 = {}
      let nTs = 0, nClean = 0
      const drvLaps = []
      drivers.forEach(dr => {
        const ts = dr.lapTs || {}
        const gk = dr.group || '__all'
        parseStints(dr.lapData || {}).forEach(st => {
          const times = st.map(x => x[1])
          const srt = [...times].sort((a, b) => a - b)
          const med = srt[Math.floor(srt.length / 2)]
          st.forEach((x, i) => {
            if (x[1] > med * 1.06) return
            nClean++
            const tv = ts[x[0]]
            if (!tv) return
            const ms = Date.parse(tv)
            if (isNaN(ms)) return
            nTs++
            if (g0[gk] == null || ms < g0[gk]) g0[gk] = ms
            drvLaps.push({ gk, ms, y: x[1] - __tcBeta * (Math.min(i + 1, 40) - 5), dr })
          })
        })
      })
      if (!nClean || nTs / nClean < 0.6) return null
      const by = new Map()
      drvLaps.forEach(p => { const a = by.get(p.dr) || []; a.push(p); by.set(p.dr, a) })
      const buckets = {}
      by.forEach(arr => {
        if (arr.length < 2) return
        const m = arr.reduce((s2, p) => s2 + p.y, 0) / arr.length
        arr.forEach(p => {
          const bk = Math.floor(((p.ms - g0[p.gk]) / 60000) / 5)
          ;(buckets[bk] = buckets[bk] || []).push(p.y - m)
        })
      })
      const eff = {}
      const bks = Object.keys(buckets).map(Number).sort((a, b) => a - b)
      let big = 0
      bks.forEach(bk => {
        const v = buckets[bk].sort((a, b) => a - b)
        if (v.length >= 10) { eff[bk] = v[Math.floor(v.length / 2)]; big++ }
      })
      if (big < 3) return null
      bks.forEach(bk => {
        if (eff[bk] != null) return
        let best = null, bd = 1e9
        Object.keys(eff).forEach(k => { const d2 = Math.abs(k - bk); if (d2 < bd) { bd = d2; best = +k } })
        eff[bk] = best != null ? eff[best] : 0
      })
      let sw = 0, se = 0
      bks.forEach(bk => { sw += buckets[bk].length; se += eff[bk] * buckets[bk].length })
      const c0 = sw ? se / sw : 0
      bks.forEach(bk => { eff[bk] -= c0 })
      return { eff, g0 }
    } catch (e) { return null }
  })()
  const __st = !!__stFx
  const __stcMet = (dr, stints) => {
    if (!__st) return {}
    const ts = dr.lapTs || {}
    const gk = dr.group || '__all'
    const has0 = __stFx.g0[gk] != null
    const f = (lapNum) => {
      if (!has0) return 0
      const tv = ts[lapNum]
      if (!tv) return 0
      const ms = Date.parse(tv)
      if (isNaN(ms)) return 0
      const e = __stFx.eff[Math.floor(((ms - __stFx.g0[gk]) / 60000) / 5)]
      return e == null ? 0 : e
    }
    const paceCl = []
    const rawAdj = []
    stints.forEach(st => {
      const times = st.map(x => x[1])
      const srt = [...times].sort((a, b) => a - b)
      const med = srt[Math.floor(srt.length / 2)]
      const cl = []
      st.forEach((x, i) => {
        if (x[1] > med * 1.06) return
        cl.push(x[1] - __tcBeta * (Math.min(i + 1, 40) - 5) - f(x[0]))
        rawAdj.push(x[1] - f(x[0]))
      })
      if (cl.length) paceCl.push(cl)
    })
    const av = (a) => a.reduce((x, y) => x + y, 0) / a.length
    const grad = paceCl.filter(c => c.length >= MIN_LAPS)
    const lrs = paceCl.filter(c => c.length >= 10)
    const allC = [].concat(...paceCl)
    rawAdj.sort((a, b) => a - b)
    return {
      avgPaceSTC: grad.length ? av(grad.map(av)) : null,
      overallSTC: allC.length ? av(allC) : null,
      longRunSTC: lrs.length ? lrs.reduce((sv, c) => sv + av(c) * c.length, 0) / lrs.reduce((sv, c) => sv + c.length, 0) : null,
      best5ST: rawAdj.length ? av(rawAdj.slice(0, Math.min(5, rawAdj.length))) : null,
      bestLapST: rawAdj.length ? rawAdj[0] : null,
    }
  }
  const __tcMet = (stints) => {
    const stClean = []
    stints.forEach(st => {
      const times = st.map(x => x[1])
      const srt = [...times].sort((a, b) => a - b)
      const med = srt[Math.floor(srt.length / 2)]
      const cl = []
      st.forEach((x, i) => { if (x[1] <= med * 1.06) cl.push(x[1] - __tcBeta * (Math.min(i + 1, 40) - 5)) })
      if (cl.length) stClean.push(cl)
    })
    const av = (a) => a.reduce((x, y) => x + y, 0) / a.length
    const grad = stClean.filter(c => c.length >= MIN_LAPS)
    const lrs = stClean.filter(c => c.length >= 10)
    const allC = [].concat(...stClean).sort((a, b) => a - b)
    return {
      avgPaceTC: grad.length ? av(grad.map(av)) : null,
      longRunTC: lrs.length ? lrs.reduce((sv, c) => sv + av(c) * c.length, 0) / lrs.reduce((sv, c) => sv + c.length, 0) : null,
      best5TC: allC.length ? av(allC.slice(0, Math.min(5, allC.length))) : null,
      bestLapTC: allC.length ? allC[0] : null,
      overallTC: allC.length ? av(allC) : null,
    }
  }
  const parsed = drivers.map(dr => {
    const stints = parseStints(dr.lapData || {})
    const allLaps = stints.flat()
    const allTimes = allLaps.map(([, t]) => t)
    const totalLaps = allTimes.length
    if (totalLaps === 0) {
      return { ...dr, stints: 0, longestStint: 0, totalLaps: 0, overallAvg: null, lateRunAvg: null, bestLap: null, best5: null, trendSlope: null, consistency: null, avgPace: null, bestStint: null, longRun: null, inc: true }
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
    const best5 = _avg(aSrt.slice(0, Math.min(5, aSrt.length))) // SHIPPED 2026-07-16: sim practice input (cup+trucks)
    const longest = gradableRuns.length ? Math.max(...gradableRuns.map(r => r.len)) : 0

    if (totalLaps < MIN_LAPS || avgPace == null) {
      return { ...dr, stints: stints.length, longestStint: longest, totalLaps, overallAvg: rnd(overallAvg, 1000), lateRunAvg: rnd(lateRunAvg, 1000), bestLap: rnd(bestLap, 1000), best5: rnd(best5, 1000), trendSlope: rnd(falloff, 10000), consistency: rnd(consistency, 1000), avgPace: null, bestStint: null, longRun: null, inc: true }
    }
    // Report-card extras via notes JSON (2026-07-10, no schema change):
    // gl = graded laps (within 8 pct of session median); fr = estimated fresh runs
    // (run 1 + later runs whose best beats all priors by >=0.05s -- DISPLAY HINT ONLY,
    // heuristic confirmed unreliable vs true tire allocations).
    const __srt2 = [...allTimes].sort((a, b) => a - b)
    const __sessMed = __srt2[Math.floor(__srt2.length / 2)]
    const __graded = allTimes.filter(tt => tt <= __sessMed * 1.08).length
    let __fresh = 1, __prior = null
    stints.forEach((st, si) => {
      const bb = Math.min(...st.map(([, tt]) => tt))
      if (si > 0 && __prior != null && bb <= __prior - 0.05) __fresh++
      __prior = __prior == null ? bb : Math.min(__prior, bb)
    })
    return { ...dr, stints: stints.length, longestStint: longest, totalLaps,
      overallAvg: rnd(overallAvg, 1000), lateRunAvg: rnd(lateRunAvg, 1000), bestLap: rnd(bestLap, 1000), best5: rnd(best5, 1000),
      trendSlope: rnd(falloff, 10000), consistency: rnd(consistency, 1000),
      avgPace: rnd(avgPace, 1000), bestStint: rnd(bestStint, 1000), longRun: rnd(longRun, 1000),
      ...__tcMet(stints),
      ...__stcMet(dr, stints),
      notes: JSON.stringify({ gl: __graded, fr: __fresh }), inc: false }
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
  // GRADE FORMULA v3 (2026-07-10): pace half is now run-aware avgPace (each run's clean mean
  // counts once -- normalizes stickers/scuffs run composition, the user's insight). Backtest,
  // 41 cup oval races: avgPace50/bl50 = 0.326 (test 0.325) vs allLaps50/bl50 = 0.310 (test
  // 0.304). The 2026-07-04 selection sweep never tested THIS pairing (avgPace was only tried
  // with bestStint). SIM INPUT UNCHANGED: overall_avg stays (calibration, see BACKTEST_LOG).
  // GRADE-SIDE GROUP CONDITION CORRECTION (SHIPPED 2026-07-16; grade bar 0.372->0.404 monotone,
  // sim composite bar 24/24 -- see BACKTEST_LOG). When A/B groups AND prior corr ratings are supplied,
  // the RANKING runs on condition-corrected copies (__gc*) of the metrics: fit metric ~ prior rating
  // within the session (quality control), subtract each group's centered median residual (track state).
  // STORED metric fields stay RAW -- the sim applies its own correction at sim time (no double count).
  // Fail-open: any missing piece -> gc copies equal raw -> identical grades.
  let gc = false
  if (priorRatings) {
    const gmed = arr => { const s = [...arr].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] }
    const correctKey = (key, gcKey) => {
      gradable.forEach(d => { d[gcKey] = d[key] })
      const fit = gradable.filter(d => d[key] != null && d.group && priorRatings[d.driver] != null)
      const gs = [...new Set(fit.map(d => d.group))]
      if (gs.length < 2 || fit.length < 20) return false
      const x = fit.map(d => priorRatings[d.driver]), y = fit.map(d => d[key])
      const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n
      let sxy = 0, sxx = 0
      for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx) }
      const bb = sxx ? sxy / sxx : 0, a0 = my - bb * mx
      const offs = {}
      gs.forEach(g0 => { offs[g0] = gmed(fit.filter(d => d.group === g0).map(d => d[key] - (a0 + bb * priorRatings[d.driver]))) })
      const center = gs.reduce((a, g0) => a + offs[g0], 0) / gs.length
      gradable.forEach(d => { if (d[key] != null && d.group && offs[d.group] != null) d[gcKey] = d[key] - (offs[d.group] - center) })
      return true
    }
    const c1 = correctKey(__st ? 'avgPaceSTC' : 'avgPaceTC', '__gcAvgPace')
    const c2 = correctKey(__st ? 'bestLapST' : 'bestLap', '__gcBestLap')
    const c3 = correctKey(__st ? 'overallSTC' : 'overallTC', '__gcOverallAvg')
    const c4 = correctKey(__st ? 'best5ST' : 'best5', '__gcBest5') // SHIPPED 2026-07-17: grade speed half
    const c5 = correctKey(__st ? 'longRunSTC' : 'longRunTC', '__gcLongRun') // SHIPPED 2026-08-08: long-run component
    gc = c1 || c2 || c3 || c4 || c5
  }
  const apS = rankScale(gc ? '__gcOverallAvg' : (__st ? 'overallSTC' : 'overallTC')) /* v6.1 2026-08-08: pace half = corrected ALL-clean-lap mean (lap-weighted). Equal-stint avgPace demoted Blaney (Iowa 91-lap grind vs short stints). 97-race backtest: statistical tie with avgPaceTC (rhoSpeed .637 both, W50/L47) - swap chosen on construct (no stint-count artifact). */, alS = rankScale(gc ? '__gcOverallAvg' : (__st ? 'overallSTC' : 'overallTC')), blS = rankScale(gc ? '__gcBestLap' : (__st ? 'bestLapST' : 'bestLap')) /* v6.2: RAW - actual laps only */, b5S = rankScale(gc ? '__gcBest5' : (__st ? 'best5ST' : 'best5')) /* v6.2 2026-08-08: speed half is RAW best5 - pure peak speed that actually happened, same input the sim uses. Tire-corrected laps are barred from the speed half (a corrected lap-40 could impersonate a flyer: Chastain Iowa 24.65 -> 24.02 'equivalent' beating Love's real 24.12). 97-race backtest: finish rho tie (.435/.436), race-speed .640 vs .637, winner rank 6.32 vs 6.50 - equal or slightly better everywhere. Pace + longRun halves stay tire-corrected. */, lrS = rankScale(gc ? '__gcLongRun' : (__st ? 'longRunSTC' : 'longRunTC'))
  const scored = gradable.map(d => {
    const pace = apS.has(d) ? apS.get(d) : (alS.has(d) ? alS.get(d) : 50)
    // SHIPPED 2026-07-17: speed half is best5 (mean of 5 fastest laps; bestLap fallback).
    // Backtest, 70 labeled sessions: finish corr cup .320->.338, oreilly .492->.522,
    // trucks .482->.491; per-session W47/L23 vs bestLap half (see BACKTEST_LOG).
    const bl = b5S.has(d) ? b5S.get(d) : (blS.has(d) ? blS.get(d) : 50)
    // SHIPPED 2026-08-08 v5-lr20: third component longRun, missing = 25 (penalty).
    const lr = lrS.has(d) ? lrS.get(d) : 25
    return { ...d, composite: Math.round((pace * 0.40 + bl * 0.40 + lr * 0.20) * 10) / 10 }
  })
  scored.sort((a, b) => b.composite - a.composite)
  const total = scored.length
  // LETTER-ALIGNED SCORES (2026-07-10): displayed score lives inside the letter's academic
  // band (A+ 97-100 ... F 40-59.9), positioned by percentile within the band. Rank 1 is
  // always A+ / 100. Raw composite still decides the ORDERING; only the score shown changes.
  const SCORE_BANDS = { 'A+': [100, 97], 'A': [96.9, 93], 'A-': [92.9, 90], 'B+': [89.9, 87], 'B': [86.9, 83], 'B-': [82.9, 80], 'C+': [79.9, 77], 'C': [76.9, 73], 'C-': [72.9, 70], 'D': [69.9, 60], 'F': [59.9, 40] }
  const PCT_BANDS = { 'A+': [0, 0.03], 'A': [0.03, 0.08], 'A-': [0.08, 0.13], 'B+': [0.13, 0.21], 'B': [0.21, 0.32], 'B-': [0.32, 0.42], 'C+': [0.42, 0.55], 'C': [0.55, 0.68], 'C-': [0.68, 0.79], 'D': [0.79, 0.89], 'F': [0.89, 1] }
  scored.forEach((d, i) => {
    d.rank = i + 1
    d.grade = i === 0 ? 'A+' : percentileGrade(i + 1, total)
    if (i === 0) { d.composite = 100; return }
    const pct = (i + 1) / total
    const pb = PCT_BANDS[d.grade] || [0.89, 1]
    const frac = Math.min(1, Math.max(0, (pct - pb[0]) / ((pb[1] - pb[0]) || 1)))
    const sb = SCORE_BANDS[d.grade] || [59.9, 40]
    d.composite = Math.round((sb[0] - frac * (sb[0] - sb[1])) * 10) / 10
  })
  return scored.concat(incs.map(d => ({ ...d, rank: null, grade: null, composite: null })))
}

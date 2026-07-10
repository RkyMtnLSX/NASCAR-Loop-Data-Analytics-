import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD

const SERIES_TABS = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks',  label: 'Truck Series' },
]

export const DEFAULT_WEIGHTS = {
  corrHistory:  0.35,
  longRunPace:  0.15,
  shortRunPace: 0.00,
  startPos:     0.33,
  tireFalloff:  0.00,
  raceCraft:    0.02,
  trackHistory: 0.15,
}

// Road course-specific weights.
// startPos reduced -- observed overpenalization of strong road course cars with poor qualifying
// (Hemric P32->2nd, Grala P16->3rd at San Diego 2026). raceCraft (quality pass %) added:
// captures meaningful passing in traffic, correlates with road/street course survival.
export const ROAD_COURSE_WEIGHTS = {
  corrHistory:  0.60,  // race craft 0.25 folded here 2026-07-07 (Cup + 8-race truck road sweep: raceCraft redundant w/ rating)
  longRunPace:  0.15,  // fewer laps at road courses, still useful
  shortRunPace: 0.05,  // near-redundant with LRP when stints are short
  startPos:     0.15,  // backed by r=0.416 correlation across 682 obs
  tireFalloff:  0.05,  // can't measure properly without long stints
  raceCraft:    0.00,  // CUT 2026-07-07: ~0.81 corr with driver_rating; monotonic sweep, never wins a market
  trackHistory: 0.00,
}

const ROAD_COURSE_TRACKS = [
  'sonoma', 'watkins glen', 'cota', 'circuit of the americas',
  'road america', 'roval', 'indianapolis road', 'portland', 'chicago street',
  'coronado', 'mexico', 'lime rock',
]

export const SUPERSPEEDWAY_WEIGHTS = {   // Daytona / Talladega / Atlanta - pack racing (no practice; start near-noise)
  corrHistory:  0.55,  // SS-group avg rating - main pack skill signal (+0.05 from cut raceCraft)
  longRunPace:  0.00,  // practice useless at pack tracks (and absent)
  shortRunPace: 0.00,
  startPos:     0.15,  // pack racing negates qualifying; kept low
  tireFalloff:  0.00,
  raceCraft:    0.00,  // CUT 2026-07-08: zero SS effect in leak-free backtest (identical Spearman)
  trackHistory: 0.30,  // drafting instinct is persistent + track-specific
}

// O'Reilly superspeedways: adds a win-conversion signal (win=1.0, top5=0.35, year-weighted).
// Rewards pack-race CLOSERS (Austin Hill: 9/20 SS wins, 4 Atlanta wins) over steady-but-winless
// drivers whose avg driver_rating is inflated by consistency. Leak-free O'Reilly SS backtest:
// winner-market hit rate 16% -> 42% vs rating-only; matches FanDuel Hill +260 / Love +500.
export const ONEILLY_SUPERSPEEDWAY_WEIGHTS = {
  corrHistory:   0.45,
  longRunPace:   0.00,
  shortRunPace:  0.00,
  startPos:      0.15,
  tireFalloff:   0.00,
  raceCraft:     0.00,
  trackHistory:  0.20,
  winConversion: 0.20,
}

export const TRUCK_ROAD_WEIGHTS = {   // Trucks road courses (2026-07-07, 9-race sweep): startPos leans higher than Cup, raceCraft 0
  corrHistory:  0.55,
  longRunPace:  0.25,
  shortRunPace: 0.00,
  startPos:     0.20,  // sweep monotonic 10->25; trucks reward qualifying/start more than Cup road ringers
  tireFalloff:  0.00,
  raceCraft:    0.00,
  trackHistory: 0.00,
}

function isRoadCourse(trackName) {
  if (!trackName) return false
  const t = trackName.toLowerCase()
  return ROAD_COURSE_TRACKS.some(rc => t.includes(rc))
}

const CAUTION_PRESETS_BY_SERIES = {
  cup: [
    { label: 'Low',    value: 4,  noise: 10 },
    { label: 'Medium', value: 8,  noise: 16 },
    { label: 'High',   value: 15, noise: 25 },
  ],
  trucks: [
    { label: 'Low',    value: 4,  noise: 15 },
    { label: 'Medium', value: 8,  noise: 23 },
    { label: 'High',   value: 15, noise: 35 },
  ],
  oreilly: [
    { label: 'Low',    value: 4,  noise: 12 },
    { label: 'Medium', value: 8,  noise: 18 },
    { label: 'High',   value: 15, noise: 28 },
  ],
}
const getCautionPresets = (sv) => CAUTION_PRESETS_BY_SERIES[sv] || CAUTION_PRESETS_BY_SERIES.cup
const CAUTION_PRESETS = CAUTION_PRESETS_BY_SERIES.cup

function isSuperspeedway(trackName) {
  const t = (trackName || '').toLowerCase()
  return t.indexOf('daytona') >= 0 || t.indexOf('talladega') >= 0 || t.indexOf('atlanta') >= 0 || t.indexOf('echopark') >= 0
}

const DNF_PRESETS = [
  { label: 'Low',    value: 0.05 },
  { label: 'Medium', value: 0.15 },
  { label: 'High',   value: 0.25 },
]

function gaussNoise() {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function dkFinishPts(pos) {
  if (!pos || pos <= 0 || isNaN(pos)) return 0
  const table = [0,45,42,41,40,39,38,37,36,35,34,32,31,30,29,28,27,26,25,24,23,21,20,19,18,17,16,15,14,13,12,10,9,8,7,6,5,4,3,2,1]
  return pos <= 40 ? table[pos] : 0
}

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

function normalizeName(s) {
  if (!s) return ''
  return s.replace(/([A-Za-z])\./g, '$1').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
}

export function __marketValue(winTxt, t10Txt, fdTxt, hrTxt, drivers) {
  try {
    var norm = function (s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.']/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim(); };
    var amer = function (l) { var m = l.trim().replace(/[\u2212\u2013\u2014]/g, '-'); return /^[+\-]\d{2,6}$/.test(m) ? parseInt(m, 10) : null; };
    var dec = function (a) { return a > 0 ? a / 100 + 1 : 100 / (-a) + 1; };
    var impl = function (a) { return a > 0 ? 100 / (a + 100) : -a / (-a + 100); };
    var parseDK = function (txt, n) { var out = {}, name = null, buf = []; var flush = function () { if (name && buf.length >= n) out[norm(name)] = buf.slice(0, n); name = null; buf = []; }; (txt || '').split('\n').forEach(function (raw) { var l = raw.trim(); if (!l) return; var o = amer(l); if (o !== null) { if (name) buf.push(o); } else if (/[a-zA-Z]{2,}/.test(l)) { flush(); name = l; } }); flush(); return out; };
    var parseSect = function (txt, hdr) { var m = { win: {}, t3: {}, t5: {}, t10: {} }; var cur = null, name = null; (txt || '').split('\n').forEach(function (raw) { var l = raw.trim().replace(/^\*\s*/, ''); if (!l) return; for (var h = 0; h < hdr.length; h++) { if (hdr[h][0].test(l)) { cur = hdr[h][1]; name = null; return; } } if (/ford|toyota|chev|manufacturer|team of|group |chance|in-season| vs |show |MT$|betslip|matchup|special|future|single|parlay|about|career|privacy|terms|faq|responsible|house rule|setting|appearance|download|copyright|build:|server time|^eero|^winner$/i.test(l) && !/finish/i.test(l)) { name = null; return; } var o = amer(l); if (o !== null) { if (name && cur) m[cur][norm(name)] = o; name = null; } else if (/[a-zA-Z]{2,}/.test(l)) { name = l; } }); return m; };
    var FDh = [[/winner|outright/i, 'win'], [/top[\s-]*3/i, 't3'], [/top[\s-]*5/i, 't5'], [/top[\s-]*10/i, 't10']];
    var HRh = [[/winner|outright/i, 'win'], [/top[\s-]*3/i, 't3'], [/top[\s-]*5/i, 't5'], [/top[\s-]*10/i, 't10']];
    var d1 = parseDK(winTxt, 3), d2 = parseDK(t10Txt, 1);
    var dk = { win: {}, t3: {}, t5: {}, t10: {} };
    Object.keys(d1).forEach(function (k) { dk.win[k] = d1[k][0]; dk.t3[k] = d1[k][1]; dk.t5[k] = d1[k][2]; });
    Object.keys(d2).forEach(function (k) { dk.t10[k] = d2[k][0]; });
    var books = { dk: dk, fd: parseSect(fdTxt, FDh), hr: parseSect(hrTxt, HRh) };
    var MKS = [['win', 1, 'winPct'], ['t3', 3, 'top3Pct'], ['t5', 5, 'top5Pct'], ['t10', 10, 'top10Pct']];
    // Tail guard (2026-07-09): below these model probabilities the sim has no calibrated
    // resolution -- MC noise puts backmarkers at ~1pct top3, and longshot odds amplify that
    // into fake +EV (Reaume/Lime Rock case). No flag, no edge below the floor.
    var MINP = { win: 0.02, t3: 0.05, t5: 0.08, t10: 0.12 };
    var res = {};
    MKS.forEach(function (mk) {
      var key = mk[0], target = mk[1], pf = mk[2];
      var uni = {}; Object.keys(books).forEach(function (bk) { Object.keys(books[bk][key]).forEach(function (k) { uni[k] = 1; }); });
      var dvg = {}; Object.keys(books).forEach(function (bk) { var b = books[bk][key]; var s = 0, imp = {}; Object.keys(uni).forEach(function (k) { if (b[k] == null) return; var p = impl(b[k]); imp[k] = p; s += p; }); dvg[bk] = {}; Object.keys(imp).forEach(function (k) { dvg[bk][k] = s ? imp[k] / s * target : null; }); });
      (drivers || []).forEach(function (d) {
        var sk = norm(d.name);
        var fk = function (src) {
          if (src[sk] != null) return sk;
          var keys = Object.keys(src), i, k;
          for (i = 0; i < keys.length; i++) { k = keys[i]; if (k.length > sk.length && k.slice(-(sk.length + 1)) === ' ' + sk) return k; }
          for (i = 0; i < keys.length; i++) { k = keys[i]; if (sk.length > k.length && sk.slice(-(k.length + 1)) === ' ' + k) return k; }
          var sp = sk.split(' ');
          if (sp.length >= 2) {
            var sLast = sp[sp.length - 1], sFirst = sp[0], cand = null, cnt = 0;
            for (i = 0; i < keys.length; i++) {
              var kp = keys[i].split(' '); if (kp.length < 2) continue;
              if (kp[kp.length - 1] !== sLast) continue;
              var kFirst = kp[0], p = 0;
              while (p < sFirst.length && p < kFirst.length && sFirst.charAt(p) === kFirst.charAt(p)) p++;
              if (p >= 3) { cand = keys[i]; cnt++; }
            }
            if (cnt === 1) return cand;
          }
          return null;
        };
        var px = {}; Object.keys(books).forEach(function (bk) { var kk = fk(books[bk][key]); px[bk] = kk != null ? books[bk][key][kk] : null; });
        if (px.dk == null && px.fd == null && px.hr == null) return;
        var best = null, bb = ''; Object.keys(px).forEach(function (bk) { if (px[bk] != null && (best == null || dec(px[bk]) > dec(best))) { best = px[bk]; bb = bk; } });
        var cons = []; Object.keys(books).forEach(function (bk) { var kk = fk(books[bk][key]); if (kk != null && dvg[bk][kk] != null) cons.push(dvg[bk][kk]); });
        var consP = cons.length ? cons.reduce(function (a, b) { return a + b; }, 0) / cons.length : null;
        var p = (d[pf] || 0) / 100;
        res[d.name] = res[d.name] || {};
        res[d.name][key] = { dk: px.dk, fd: px.fd, hr: px.hr, best: best, bb: bb, ev: p >= MINP[key] ? +((p * dec(best) - 1) * 100).toFixed(0) : null, mev: consP != null ? +((consP * dec(best) - 1) * 100).toFixed(0) : null };
      });
    });
    return res;
  } catch (e) { return {}; }
}

var __teamCutoff = { 'chase briscoe': 2025 };

function __applyRainOut(w, on) {
  if (!on) return w;
  var freed = (w.startPos || 0) - 0.12;
  return Object.assign({}, w, { startPos: 0.12, corrHistory: (w.corrHistory || 0) + freed * 0.5, longRunPace: (w.longRunPace || 0) + freed * 0.5 });
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
  const trackFinishScores = normalizeArr(drivers.map(d => d.trackAvgFinish), true)
  const winConvScores     = normalizeArr(drivers.map(d => d.corrWinConv),    false)  // lower = better

  // EQUIPMENT PRIOR (task 118): map equipment ratings onto the SAME min-max axis as corrAvgRating
  const __crVals = drivers.map(d => d.corrAvgRating).filter(v => v != null && !isNaN(v))
  const __crMn = Math.min.apply(null, __crVals), __crMx = Math.max.apply(null, __crVals)
  const __eqScale = (__crVals.length >= 2 && __crMx > __crMn)
    ? (v => (v == null || isNaN(v)) ? null : Math.max(0, Math.min(100, (v - __crMn) / (__crMx - __crMn) * 100)))
    : null

  const wTotal = Object.values(weights).reduce((a, b) => a + b, 0) || 1
  const w = {
    corrHistory:  weights.corrHistory  / wTotal,
    longRunPace:  weights.longRunPace  / wTotal,
    shortRunPace: weights.shortRunPace / wTotal,
    startPos:     weights.startPos     / wTotal,
    tireFalloff:  weights.tireFalloff  / wTotal,
    raceCraft:    (weights.raceCraft    || 0) / wTotal,
    trackHistory: (weights.trackHistory || 0) / wTotal,
    winConversion:(weights.winConversion || 0) / wTotal,
  }

  return drivers.map((d, i) => {
    const rs = corrRatingScores[i]
    const fs = corrFinishScores[i]
    const hasR = d.corrAvgRating != null
    const hasF = d.corrAvgFinish != null
    const blendedC = hasR && hasF ? rs
                   : hasR         ? rs
                   : hasF         ? fs
                   :                null
    const rawC = blendedC ?? 50
    const conf = d.nCorrRaces > 0 ? Math.min(1, d.nCorrRaces / 4) : (blendedC != null ? 1 : 0)
    // EQUIPMENT PRIOR (task 118): thin-history fill toward EQUIPMENT instead of neutral 50;
    // quarter-strength ride-change delta for established drivers. All guards degrade to the
    // pre-118 value (rawC*conf + 50*(1-conf)) when car data is absent.
    const __eqS = __eqScale ? __eqScale(d.equipRating) : null
    const __eqM = __eqScale ? __eqScale(d.modalEquipRating) : null
    const __eqConf = d.nEquipRaces > 0 ? Math.min(1, d.nEquipRaces / 4) : 0
    const __eqFill = __eqS != null ? __eqS * __eqConf + 50 * (1 - __eqConf) : 50
    let c = rawC * conf + __eqFill * (1 - conf)
    if (conf >= 1 && __eqS != null && __eqM != null && d.modalCar && d.carNumber && String(d.carNumber).trim() !== d.modalCar) {
      const __dConf = Math.min(1, Math.min(d.nEquipRaces, d.nModalEquip) / 4)
      c = Math.max(0, Math.min(100, c + 0.25 * __dConf * (__eqS - __eqM)))
    }
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
    const wc  = winConvScores[i]   ?? 50

    const speedScore =
      c   * w.corrHistory  +
      lrp * w.longRunPace  +
      srp * w.shortRunPace +
      sp  * w.startPos     +
      fl  * w.tireFalloff +
    rc  * w.raceCraft  +
      t   * w.trackHistory +
      wc  * w.winConversion

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
        win:  Math.round(wc),
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
  const posMatrix      = new Int16Array(numSims * n)

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
    for (let j = 0; j < n; j++) posMatrix[sim * n + j] = simPos[j]

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

  const __rows = drivers.map((d, i) => {
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
      simIdx: i,
    }
  }).sort((a, b) => b.projDK - a.projDK)
  __rows.posMatrix = posMatrix
  __rows.simN = numSims
  return __rows
}

function CrossoverBorrowPanel({ series }) {
  const [rows, setRows] = useState([])
  const [driver, setDriver] = useState('')
  const [drivers, setDrivers] = useState([])
  const [sourceSeries, setSourceSeries] = useState('oreilly')
  const [weight, setWeight] = useState('0.5')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const load = () => {
    supabase.from('crossover_borrows').select('*').then(({ data }) => {
      const d = (data || []).slice().sort((a, b) => (a.series || '').localeCompare(b.series || '') || (a.driver_name || '').localeCompare(b.driver_name || ''))
      setRows(d)
    })
  }
  useEffect(() => { load() }, [])
  useEffect(() => { setDriver(''); supabase.from('entry_list').select('driver_name').eq('series', series).then(({ data }) => { setDrivers([...new Set((data || []).map(d => (d.driver_name || '').trim()).filter(Boolean))].sort()) }) }, [series])
  const cell = { padding: '4px 10px', fontSize: '0.78125rem', borderBottom: '1px solid var(--border)' }
  const hd = { ...cell, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.68rem' }
  const inp = { padding: '6px 8px', fontSize: '0.8125rem', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4 }
  const addBorrow = async () => {
    const nm = driver.trim()
    if (!nm) { setMsg('Enter a driver name'); return }
    if (series === sourceSeries) { setMsg('Source series must differ from sim series'); return }
    const w = Math.max(0, Math.min(1, parseFloat(weight) || 0.5))
    const { error } = await supabase.from('crossover_borrows').upsert({ series, driver_name: nm, source_series: sourceSeries, blend_weight: w, active: true, note: note.trim() || null }, { onConflict: 'series,driver_name' })
    if (error) { setMsg('Error: ' + error.message); return }
    setMsg('Saved ' + nm + ' (' + series + ' from ' + sourceSeries + ' @ ' + Math.round(w * 100) + '%)')
    setDriver(''); setNote(''); load()
  }
  const toggle = async (r) => { await supabase.from('crossover_borrows').update({ active: !r.active }).eq('id', r.id); load() }
  const remove = async (r) => { await supabase.from('crossover_borrows').delete().eq('id', r.id); load() }
  const fcol = { display: 'flex', flexDirection: 'column', gap: 3 }
  const lab = { fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 4 }}>Crossover Borrows ({rows.length})</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        Borrow a driver's road-course rating from another series when same-series history is thin or unrepresentative (mechanical DNFs, equipment change). Applied automatically when the matching series config loads in the Sim Center.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', marginBottom: 14 }}>
        <div style={fcol}><label style={lab}>Driver</label><select style={{ ...inp, width: 190 }} value={driver} onChange={e => setDriver(e.target.value)}><option value=''>{drivers.length ? 'Select driver...' : 'No entry list loaded'}</option>{drivers.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
        <div style={fcol}><label style={lab}>For series</label><div style={{ ...inp, width: 90, textTransform: 'capitalize', opacity: 0.85 }}>{series}</div></div>
        <div style={fcol}><label style={lab}>Borrow from</label><select style={{ ...inp, width: 100 }} value={sourceSeries} onChange={e => setSourceSeries(e.target.value)}><option value='cup'>cup</option><option value='oreilly'>oreilly</option><option value='trucks'>trucks</option></select></div>
        <div style={fcol}><label style={lab}>Weight 0-1</label><input style={{ ...inp, width: 64 }} value={weight} onChange={e => setWeight(e.target.value)} placeholder='0.5' /></div>
        <div style={{ ...fcol, flex: 1, minWidth: 120 }}><label style={lab}>Note</label><input style={{ ...inp, width: '100%' }} value={note} onChange={e => setNote(e.target.value)} placeholder='Spire upgrade; mech DNFs' /></div>
        <button onClick={addBorrow} style={{ padding: '7px 16px', cursor: 'pointer', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--text)', color: 'var(--bg)', fontWeight: 600, fontSize: '0.8rem' }}>Save</button>
      </div>
      {msg ? <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 10 }}>{msg}</p> : null}
      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
        <thead><tr>
          <th style={hd}>Driver</th>
          <th style={{ ...hd, width: 80 }}>Series</th>
          <th style={{ ...hd, width: 90 }}>Borrow</th>
          <th style={{ ...hd, width: 70, textAlign: 'center' }}>Weight</th>
          <th style={{ ...hd, width: 150 }}>Note</th>
          <th style={{ ...hd, width: 66, textAlign: 'center' }}>Active</th>
          <th style={{ ...hd, width: 50, textAlign: 'center' }}></th>
        </tr></thead>
        <tbody>
        {rows.map(r => (
          <tr key={r.id} style={r.active ? null : { opacity: 0.45 }}>
            <td style={{ ...cell, fontWeight: 600 }}>{r.driver_name}</td>
            <td style={cell}>{r.series}</td>
            <td style={{ ...cell, color: 'var(--text-secondary)' }}>{r.source_series}</td>
            <td style={{ ...cell, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{Math.round((r.blend_weight || 0) * 100)}%</td>
            <td style={{ ...cell, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.note || '-'}</td>
            <td style={{ ...cell, textAlign: 'center' }}><button onClick={() => toggle(r)} style={{ cursor: 'pointer', padding: '2px 8px', fontSize: '0.7rem', borderRadius: 4, border: '1px solid var(--border)', background: r.active ? 'rgba(34,197,94,0.15)' : 'transparent', color: r.active ? '#22c55e' : 'var(--text-muted)' }}>{r.active ? 'ON' : 'OFF'}</button></td>
            <td style={{ ...cell, textAlign: 'center' }}><button onClick={() => remove(r)} style={{ cursor: 'pointer', padding: '2px 6px', fontSize: '0.7rem', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: '#ef4444' }}>{'\u00d7'}</button></td>
          </tr>
        ))}
        {rows.length === 0 ? <tr><td colSpan={7} style={{ ...cell, color: 'var(--text-muted)', textAlign: 'center' }}>No borrows configured.</td></tr> : null}
        </tbody>
      </table>
    </div>
  )
}

export default function SimulationCenter({ isSubscriber, embedded }) {
  const [series, setSeries]                 = useState('cup')
  const [config, setConfig]                 = useState(null)
  const [rawDrivers, setRawDrivers]         = useState([])
  const [weights, setWeights]               = useState(DEFAULT_WEIGHTS)
  const [rainOut, setRainOut] = useState(false)
  const [cautionPreset, setCautionPreset]   = useState(CAUTION_PRESETS[1])
  const [dnfPreset, setDnfPreset]           = useState(DNF_PRESETS[1])
  const [numSims, setNumSims]               = useState(10000)
  const [totalRaceLaps, setTotalRaceLaps]   = useState(200)
  const [stage1Laps, setStage1Laps] = useState(0)
  const [stage2Laps, setStage2Laps] = useState(0)
  const [simResults, setSimResults]         = useState(null)
  const [running, setRunning]               = useState(false)
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState(null)
  const [sortKey, setSortKey]               = useState('projDK')
  const [sortDir, setSortDir]               = useState('desc')
  const [showBreakdown, setShowBreakdown]   = useState(false)
  const [published,     setPublished]       = useState(false)
  const [oddsWinTxt, setOddsWinTxt] = useState('')
  const [oddsT10Txt, setOddsT10Txt] = useState('')
  const [oddsFdTxt, setOddsFdTxt] = useState('')
  const [oddsHrTxt, setOddsHrTxt] = useState('')
  const [shadeLambda, setShadeLambda] = useState(0.5)
  const [showShade, setShowShade] = useState(false)
  const [showBorrows, setShowBorrows] = useState(false)
  const [simStage, setSimStage] = useState('post')
  const [raceNumMap, setRaceNumMap] = useState({})
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
        setWeights(isSuperspeedway(cfg.track_name) ? (s === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS) : isRoadCourse(cfg.track_name) ? (s === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS) : DEFAULT_WEIGHTS)
        try {
          const __cr = await supabase.from('races').select('total_cautions').eq('series', s).eq('track_name', cfg.track_name).not('total_cautions', 'is', null)
          const __cs = ((__cr && __cr.data) || []).map(function (x) { return x.total_cautions }).filter(function (v) { return v != null })
          const __ci = __cs.length ? (function () { var a = __cs.reduce(function (p, q) { return p + q }, 0) / __cs.length; return a < 6 ? 0 : a < 11.5 ? 1 : 2 })() : 1
          setCautionPreset(getCautionPresets(s)[__ci])
          const __dl = await supabase.from('loop_data').select('race_id, laps_completed').eq('series', s).eq('track_name', cfg.track_name)
          const __by = {}; (((__dl && __dl.data) || [])).forEach(function (r2) { (__by[r2.race_id] = __by[r2.race_id] || []).push(parseInt(r2.laps_completed) || 0) })
          const __dnfs = Object.keys(__by).map(function (k) { var laps = __by[k]; var mx = Math.max.apply(null, laps.concat([1])); return laps.filter(function (l) { return l < 0.9 * mx }).length / laps.length })
          const __di = __dnfs.length ? (function () { var a = __dnfs.reduce(function (p, q) { return p + q }, 0) / __dnfs.length; return a < 0.10 ? 0 : a < 0.20 ? 1 : 2 })() : (isSuperspeedway(cfg.track_name) ? 2 : 1)
          setDnfPreset(DNF_PRESETS[__di])
        } catch (e) { setDnfPreset(isSuperspeedway(cfg.track_name) ? DNF_PRESETS[2] : DNF_PRESETS[1]) }

        const [
          { data: entries },
          { data: qualData },
          { data: practiceData },
          { data: corrTracks },
        ] = await Promise.all([
          supabase.from('entry_list')
            .select('driver_name, car_number, organization, manufacturer')
            .eq('series', s)
            .eq('race_year', cfg.race_year || new Date().getFullYear())
            .eq('track_name', cfg.track_name),
          supabase.from('qualifying_results')
            .select('driver_name, qualifying_position, lap_time')
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
        let __borrowMap = {}
        try {
          const { data: __brws } = await supabase.from('crossover_borrows').select('driver_name, source_series, blend_weight, active').eq('series', s).eq('active', true)
          ;(__brws || []).forEach(b => { __borrowMap[normalizeName((b.driver_name || '').trim())] = { src: b.source_series, w: Math.max(0, Math.min(1, parseFloat(b.blend_weight))) } })
        } catch (e) {}
        const __borrowSeries = [...new Set(Object.values(__borrowMap).map(b => b.src))]
        let loopRows = []
        if (corrNames.length) {
          const { data: ld } = await supabase
            .from('loop_data')
            .select('driver_name, finish_position, laps_led, fastest_laps, driver_rating, pct_quality_passes, year, series, car_number')
            .in('track_name', corrNames)
            .in('series', [...new Set([s, 'cup', ...__borrowSeries])])
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
          const yr     = parseInt(r.year) || 0;
          if (__teamCutoff[normalizeName(r.driver_name).toLowerCase()] && yr < __teamCutoff[normalizeName(r.driver_name).toLowerCase()]) return;
          const qp     = parseFloat(r.pct_quality_passes)
          if (name && fin > 0) {
            const normN = normalizeName(name)
            if (!loopByDriver[normN]) loopByDriver[normN] = []
            loopByDriver[normN].push({ sr: r.series, fin, rating: isNaN(rating) ? null : rating, qp: isNaN(qp) ? null : qp, yr, car: (r.car_number || '').trim() || null })
          }
        })
        const corrAvgMap = new Map(
          Object.entries(loopByDriver).map(([name, rows]) => {
            const yrWt = yr => yr >= 2026 ? 2.0 : yr === 2025 ? 1.3 : yr === 2024 ? 0.9 : yr === 2023 ? 0.6 : 0.4
            const baseRows = rows.filter(r => r.sr === s || r.sr === 'cup')
            const wsum = arr => arr.reduce((a, r) => a + yrWt(r.yr), 0)
            const avgFin = baseRows.length ? baseRows.reduce((a, r) => a + r.fin * yrWt(r.yr), 0) / wsum(baseRows) : null
            // winConv: WINS-ONLY + small-sample shrinkage (2026-07-09). Attribution backtest: the top5
            // credit added nothing (signal is 100 pct Hill); shrink conf min(1,n/5) toward the ~1/38 base
            // rate kills small-sample inflation (Day 0.45->0.21, Crews 0.35->0.02). Winner-hit 42 pct kept.
            const winConvConf = Math.min(1, baseRows.length / 5)
            const winConv = baseRows.length ? (winConvConf * (baseRows.reduce((a, r) => a + (r.fin === 1 ? 1 : 0) * yrWt(r.yr), 0) / wsum(baseRows)) + (1 - winConvConf) * 0.026) : null
            const rRows = baseRows.filter(r => r.rating !== null)
            let avgRating = rRows.length > 0 ? rRows.reduce((a, r) => a + r.rating * yrWt(r.yr), 0) / wsum(rRows) : null
            const bw = __borrowMap[name]
            if (bw) {
              const srcRows = rows.filter(r => r.sr === bw.src && r.rating !== null)
              if (srcRows.length) {
                const srcRating = srcRows.reduce((a, r) => a + r.rating * yrWt(r.yr), 0) / wsum(srcRows)
                avgRating = (avgRating == null) ? srcRating : (1 - bw.w) * avgRating + bw.w * srcRating
              }
            }
            const qpRows = baseRows.filter(r => r.qp !== null)
            const avgQP = qpRows.length > 0 ? qpRows.reduce((a, r) => a + r.qp * yrWt(r.yr), 0) / wsum(qpRows) : null
            // equipment prior (task 118): driver's modal (most frequent) in-series car
            const carCnt = {}
            baseRows.forEach(r => { if (r.sr === s && r.car) carCnt[r.car] = (carCnt[r.car] || 0) + 1 })
            let modalCar = null, modalCarN = 0
            Object.keys(carCnt).forEach(cn => { if (carCnt[cn] > modalCarN) { modalCar = cn; modalCarN = carCnt[cn] } })
            return [name, { avg: avgFin, avgRating, avgQP, winConv, n: baseRows.length, modalCar }]
          })
        )

        // EQUIPMENT PRIOR (task 118, 2026-07-09): pooled rating BY CAR NUMBER, same-series only.
        // Backtest: thin-driver corr(input,finish) 0.433 -> 0.518 (test split +0.117); ride-change
        // delta k 0.25 validated on 1689 obs. Key = loop_data.car_number (RR-verified backfill,
        // 99.9 pct coverage). NULL cars simply skip -- degrades to the old neutral behavior.
        const loopByCar = {}
        loopRows.forEach(r => {
          const car = (r.car_number || '').trim()
          const rating = parseFloat(r.driver_rating)
          const yr = parseInt(r.year) || 0
          if (!car || r.series !== s || isNaN(rating)) return
          if (!loopByCar[car]) loopByCar[car] = []
          loopByCar[car].push({ rating, yr })
        })
        const carAvgMap = new Map(
          Object.entries(loopByCar).map(([car, rows]) => {
            const yrWt = yr => yr >= 2026 ? 2.0 : yr === 2025 ? 1.3 : yr === 2024 ? 0.9 : yr === 2023 ? 0.6 : 0.4
            const wsumC = rows.reduce((a, r) => a + yrWt(r.yr), 0)
            const avgRating = rows.length ? rows.reduce((a, r) => a + r.rating * yrWt(r.yr), 0) / wsumC : null
            return [car, { avgRating, n: rows.length }]
          })
        )

        const trackByDriver = {}
        trackRows.forEach(r => {
          const normN  = normalizeName(r.driver_name?.trim())
          const fin    = parseFloat(r.finish_position)
          const rating = parseFloat(r.driver_rating)
          const yr     = parseInt(r.year) || 0;
          if (__teamCutoff[normalizeName(r.driver_name).toLowerCase()] && yr < __teamCutoff[normalizeName(r.driver_name).toLowerCase()]) return;
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
              manufacturer:  e.manufacturer || null,
              startPos:      qual && qual.qualifying_position ? parseFloat(qual.qualifying_position) : (prac && prac.qualifying_position ? parseFloat(prac.qualifying_position) : null),
              qualTime:      qual ? parseFloat(qual.lap_time)       || null : null,
              lrpTime:       prac ? parseFloat(prac.overall_avg)    || null : null,
              srpTime:       prac ? parseFloat(prac.late_run_avg)   || null : null,
              trendSlope:    prac ? parseFloat(prac.trend_slope)    || null : null,
              practiceScore: prac ? parseFloat(prac.practice_score) || null : null,
              corrAvgFinish: corrAvgMap.get(normalizeName(name))?.avg       ?? null,
              corrAvgRating: corrAvgMap.get(normalizeName(name))?.avgRating ?? null,
              raceCraftPct:  corrAvgMap.get(normalizeName(name))?.avgQP     ?? null,
              corrWinConv:   corrAvgMap.get(normalizeName(name))?.winConv   ?? null,
              equipRating:   e.car_number ? (carAvgMap.get(String(e.car_number).trim())?.avgRating ?? null) : null,
              nEquipRaces:   e.car_number ? (carAvgMap.get(String(e.car_number).trim())?.n ?? 0) : 0,
              modalCar:      corrAvgMap.get(normalizeName(name))?.modalCar ?? null,
              modalEquipRating: carAvgMap.get(corrAvgMap.get(normalizeName(name))?.modalCar ?? '')?.avgRating ?? null,
              nModalEquip:   carAvgMap.get(corrAvgMap.get(normalizeName(name))?.modalCar ?? '')?.n ?? 0,
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
    () => buildSpeedScores(rawDrivers, __applyRainOut(weights, rainOut)), [rawDrivers, weights, rainOut]
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
    const __mv = __marketValue(oddsWinTxt, oddsT10Txt, oddsFdTxt, oddsHrTxt, simResults)
    let __mtxB64 = null, __mtxN = 0, __mtxOrder = null
    if (simResults.posMatrix && simResults.simN) {
      const __nD = simResults.length
      const __cap = Math.min(simResults.simN, 4000)
      __mtxOrder = new Array(__nD)
      simResults.forEach(d => { if (d.simIdx != null) __mtxOrder[d.simIdx] = d.name })
      const __packed = new Uint8Array(__cap * __nD)
      for (let __s = 0; __s < __cap * __nD; __s++) __packed[__s] = simResults.posMatrix[__s]
      let __bin = ''
      for (let __i = 0; __i < __packed.length; __i += 8192) __bin += String.fromCharCode.apply(null, __packed.subarray(__i, __i + 8192))
      __mtxB64 = btoa(__bin)
      __mtxN = __cap
    }
    const payload = {
      series,
      track_name: config.track_name,
      race_name:  config.race_name || config.track_name,
      race_year:  config.race_year || new Date().getFullYear(),
      race_number: raceNumMap[series] ? parseInt(raceNumMap[series]) : null,
      stage: simStage,
      config: { weights: weights, caution: cautionPreset, dnf: dnfPreset, rainOut: rainOut, numSims: numSims, totalLaps: totalRaceLaps, stage1Laps: stage1Laps, stage2Laps: stage2Laps, simMatrix: __mtxB64, simMatrixN: __mtxN, simOrder: __mtxOrder },
      results: simResults.map(d => ({
        driver_name:  d.name,
        car_number:   d.carNumber,
        organization: d.organization,
        start_pos:    d.startPos,
        proj_finish:  d.projFinish,
        finish_p25:   +(d.finishP25 || 0).toFixed(1),
        finish_p50:   +(d.finishP50 || 0).toFixed(1),
        finish_p75:   +(d.finishP75 || 0).toFixed(1),
        proj_dk:      +(d.projDK   || 0).toFixed(2),
        win_pct:       +(d.winPct      || 0).toFixed(4),
        top3_pct:      +(d.top3Pct     || 0).toFixed(4),
        top5_pct:      +(d.top5Pct     || 0).toFixed(4),
        top10_pct:     +(d.top10Pct    || 0).toFixed(4),
        dnf_pct:       +(d.dnfPct      || 0).toFixed(4),
        laps_led:      +(d.projLapsLed || 0).toFixed(2),
        avg_fast_laps: +(d.avgFastLaps || 0).toFixed(2), manufacturer: d.manufacturer || null, mv: (__mv[d.name] || null),
      }))
    }
    await supabase.from('sim_results').delete().eq('series', series).eq('stage', simStage)
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
    const oddsCounts = useMemo(() => {
      if (!simResults) return null
      const mv = __marketValue(oddsWinTxt, oddsT10Txt, oddsFdTxt, oddsHrTxt, simResults)
      const c = { dk: 0, fd: 0, hr: 0 }
      Object.keys(mv || {}).forEach(k => { const w = mv[k] && mv[k].win; if (w) { if (w.dk != null) c.dk++; if (w.fd != null) c.fd++; if (w.hr != null) c.hr++ } })
      return c
    }, [simResults, oddsWinTxt, oddsT10Txt, oddsFdTxt, oddsHrTxt])
  const shadeRows = useMemo(() => {
    if (!simResults || (!oddsWinTxt && !oddsT10Txt && !oddsFdTxt && !oddsHrTxt)) return null
    const mvMap = __marketValue(oddsWinTxt, oddsT10Txt, oddsFdTxt, oddsHrTxt, simResults)
    const dec = a => a > 0 ? a / 100 + 1 : 100 / Math.abs(a) + 1
    const T = 18
    const out = []
    simResults.forEach(d => {
      const mm = mvMap[d.name] && mvMap[d.name].win
      if (!mm || mm.best == null || mm.mev == null) return
      const pRaw = d.winPct
      const cons = (mm.mev / 100 + 1) / dec(mm.best) * 100
      let pSh = pRaw
      if (pRaw > T && pRaw > cons) pSh = pRaw - shadeLambda * (pRaw - cons)
      const evRaw = +((pRaw / 100 * dec(mm.best) - 1) * 100).toFixed(1)
      const evSh = +((pSh / 100 * dec(mm.best) - 1) * 100).toFixed(1)
      if (pRaw > T || evRaw > 0) out.push({ name: d.name, best: mm.best, book: (mm.bb || '').toUpperCase(), pRaw: +pRaw.toFixed(1), cons: +cons.toFixed(1), pSh: +pSh.toFixed(1), evRaw: evRaw, evSh: evSh, killed: evRaw > 0 && evSh <= 0 })
    })
    out.sort((a, b) => b.pRaw - a.pRaw)
    return out
  }, [simResults, oddsWinTxt, oddsT10Txt, oddsFdTxt, oddsHrTxt, shadeLambda])

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

  if (!authed && !embedded) {
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
        <h1 className="page-title">Sim Admin</h1>
        <p className="page-subtitle">
          Monte Carlo race simulation &mdash; project finish positions &amp; DraftKings points
        </p>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        {SERIES_TABS.map(t => (
          <button key={t.value} className={`tab ${series === t.value ? 'active' : ''}`}
            onClick={() => { setSeries(t.value); setCautionPreset(getCautionPresets(t.value)[1]) }}>
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
                {getCautionPresets(series).map(p => (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Stage 1</span>
                <input type="number" value={stage1Laps} min={0} max={999} onChange={e => setStage1Laps(parseInt(e.target.value) || 0)} style={{ width: 56, padding: '4px 7px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)' }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginLeft: 6 }}>Stage 2</span>
                <input type="number" value={stage2Laps} min={0} max={999} onChange={e => setStage2Laps(parseInt(e.target.value) || 0)} style={{ width: 56, padding: '4px 7px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)' }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>laps</span>
              </div>
              <div style={hintStyle}>Race length feeds the laps-led model. Stage lengths are captured with the sim for the future caution/pit layer but do not affect results yet.</div>
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
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 12, fontSize: 12, color: '#f5c518', cursor: 'pointer' }}><input type="checkbox" checked={rainOut} onChange={e => setRainOut(e.target.checked)} style={{ cursor: 'pointer' }} />Rain-out grid</label>
            <button
                onClick={() => setWeights(isSuperspeedway(config.track_name) ? (series === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS) : roadCourse ? (series === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS) : DEFAULT_WEIGHTS)}
                style={{ fontSize: '0.83rem', padding: '2px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>
                Reset {roadCourse ? 'Road Course' : 'Defaults'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { key: 'corrHistory',  label: 'Corr. Track History' },
                { key: 'longRunPace',  label: 'Practice Pace (All Laps)' },
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

          <div style={{ marginBottom: 14 }}>
            <button onClick={() => setShowBorrows(v => !v)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer' }}>{showBorrows ? 'Hide' : 'Show'} Crossover Borrows (admin)</button>
          </div>
          {showBorrows && <CrossoverBorrowPanel series={series} />}

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
              <><div style={{ marginTop: 12 }}>
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>DK odds - Winner / Top 3 / Top 5 (paste)</div>
  <textarea value={oddsWinTxt} onChange={e => setOddsWinTxt(e.target.value)} rows={3} style={{ width: '100%', fontFamily: 'monospace', fontSize: 11 }} />
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 4px' }}>DK odds - Top 10 (paste)</div>
  <textarea value={oddsT10Txt} onChange={e => setOddsT10Txt(e.target.value)} rows={3} style={{ width: '100%', fontFamily: 'monospace', fontSize: 11 }} /> <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 4px' }}>FanDuel odds - full page (paste)</div>
  <textarea value={oddsFdTxt} onChange={e => setOddsFdTxt(e.target.value)} rows={3} style={{ width: '100%', fontFamily: 'monospace', fontSize: 11 }} />
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 4px' }}>Hard Rock odds - full page (paste)</div>
  <textarea value={oddsHrTxt} onChange={e => setOddsHrTxt(e.target.value)} rows={3} style={{ width: '100%', fontFamily: 'monospace', fontSize: 11 }} />
      {oddsCounts ? <div style={{ fontSize: 11, marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[['DK', oddsWinTxt, oddsCounts.dk], ['FD', oddsFdTxt, oddsCounts.fd], ['HR', oddsHrTxt, oddsCounts.hr]].map(bc => (
          <span key={bc[0]} style={{ color: (bc[1] && bc[1].trim() && !bc[2]) ? '#ef4444' : 'var(--text-muted)' }}>{bc[0]}: {bc[2]} parsed{(bc[1] && bc[1].trim() && !bc[2]) ? ' \u26a0' : ''}</span>
        ))}
      </div> : null}
</div>
<div style={{ marginBottom: 10 }}><label style={{ fontSize: '0.9rem', marginRight: 8, color: 'var(--text-muted)' }}>Race #</label><input type="number" value={raceNumMap[series] || ''} onChange={e => setRaceNumMap(m => ({ ...m, [series]: e.target.value }))} placeholder="e.g. 20" title="Season round number - carried to the Grade Center" style={{ width: 90, padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(128,128,128,0.35)', background: 'transparent', color: 'inherit', boxSizing: 'border-box' }} /></div>
<div style={{ marginBottom: 10, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
  <span style={{ color: 'var(--text-muted)' }}>Sim stage:</span>
  <button onClick={() => setSimStage('pre')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: simStage === 'pre' ? '#e8b923' : 'rgba(128,128,128,0.2)', color: simStage === 'pre' ? '#000' : 'inherit', fontWeight: 600 }}>Pre</button>
  <button onClick={() => setSimStage('post')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: simStage === 'post' ? '#e8b923' : 'rgba(128,128,128,0.2)', color: simStage === 'post' ? '#000' : 'inherit', fontWeight: 600 }}>Post</button>
  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(before / after practice + qualifying) - stored separately, won't overwrite the other stage</span>
</div>
<button onClick={publishResults} style={{
                padding: '10px 28px', background: published ? 'var(--bg-elevated)' : '#1a6b2e',
                color: published ? 'var(--text-muted)' : '#e8f5e9',
                border: 'none', borderRadius: 8, fontWeight: 700,
                fontSize: '1.03rem', cursor: published ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}>
                {published ? 'Published' : 'Publish Results'}
              </button></>
            )}
            {simResults && (
              <div className="card" style={{ padding: 16, marginTop: 4, marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showShade} onChange={e => setShowShade(e.target.checked)} /> Win-market shade
                  </label>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>admin only - not published, win market only</span>
                </div>
                {showShade && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.85rem' }}>Strength (lambda) toward market: <b>{shadeLambda.toFixed(2)}</b></span>
                      <input type="range" min={0} max={1} step={0.05} value={shadeLambda} onChange={e => setShadeLambda(parseFloat(e.target.value))} style={{ flex: '1 1 200px' }} />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>0 = raw model, 1 = pinned to market. Favorites above 18% only.</span>
                    </div>
                    {!shadeRows && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Paste win-market odds above to compute the shade.</div>}
                    {shadeRows && shadeRows.length === 0 && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No favorites above 18% and no win +EV flags.</div>}
                    {shadeRows && shadeRows.length > 0 && (
                      <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}><th style={{ padding: '4px 8px' }}>Driver</th><th>Best</th><th>Model%</th><th>Market%</th><th>Shaded%</th><th>EV raw</th><th>EV shaded</th><th></th></tr></thead>
                        <tbody>
                          {shadeRows.map(s => (
                            <tr key={s.name} style={{ borderTop: '1px solid rgba(128,128,128,0.2)' }}>
                              <td style={{ padding: '4px 8px' }}>{s.name}</td>
                              <td>{s.best > 0 ? '+' : ''}{s.best} {s.book}</td>
                              <td>{s.pRaw}%</td>
                              <td style={{ color: 'var(--text-muted)' }}>{s.cons}%</td>
                              <td><b>{s.pSh}%</b></td>
                              <td style={{ color: s.evRaw >= 0 ? '#2e9e52' : '#dd3355' }}>{s.evRaw > 0 ? '+' : ''}{s.evRaw}</td>
                              <td style={{ color: s.evSh >= 0 ? '#2e9e52' : '#dd3355', fontWeight: 700 }}>{s.evSh > 0 ? '+' : ''}{s.evSh}</td>
                              <td>{s.killed ? <span style={{ color: '#dd3355', fontWeight: 700, fontSize: '0.72rem' }}>edge removed</span> : (s.evSh > 0 ? <span style={{ color: '#2e9e52', fontSize: '0.72rem' }}>survives</span> : '')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
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

          {simResults && <BettingMarkets simResults={simResults} />}

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

function fmvAmerican(p) {
  if (!p || p <= 0) return '--'
  if (p >= 0.999) return '-99999'
  return p >= 0.5 ? String(Math.round(-100 * p / (1 - p))) : '+' + Math.round(100 * (1 - p) / p)
}

const __bmTh = { padding: '6px 10px', fontSize: '0.72rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.04em' }
const __bmTd = { padding: '6px 10px', fontSize: '0.85rem', borderBottom: '1px solid var(--border)' }
const __bmBtn = { padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated, #1a1a24)', color: 'var(--text)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }

function BmTable({ data, col1 }) {
  if (!data || !data.length) return null
  const hasFin = data[0].avgFin !== undefined
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
      <thead><tr>
        <th style={{ ...__bmTh, textAlign: 'left' }}>{col1}</th>
        {hasFin ? <th style={{ ...__bmTh, textAlign: 'right' }}>Avg Finish</th> : null}
        <th style={{ ...__bmTh, textAlign: 'right' }}>Win %</th>
        <th style={{ ...__bmTh, textAlign: 'right' }}>FMV</th>
      </tr></thead>
      <tbody>
        {data.map((r, i) => (
          <tr key={i}>
            <td style={__bmTd}>{r.name}</td>
            {hasFin ? <td style={{ ...__bmTd, textAlign: 'right' }}>{r.avgFin.toFixed(1)}</td> : null}
            <td style={{ ...__bmTd, textAlign: 'right' }}>{r.winPct.toFixed(1)}%</td>
            <td style={{ ...__bmTd, textAlign: 'right', color: 'var(--accent, #22c55e)', fontWeight: 600 }}>{r.fmv}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BettingMarkets({ simResults }) {
  const [gA, setGA] = useState([])
  const [gB, setGB] = useState([])
  const [resA, setResA] = useState(null)
  const [resB, setResB] = useState(null)
  const rows = simResults || []
  const n = rows.length
  const posMatrix = simResults && simResults.posMatrix
  const simN = (simResults && simResults.simN) || 0
  function toggle(name, which) {
    const cur = which === 'A' ? gA : gB
    const set = which === 'A' ? setGA : setGB
    if (cur.indexOf(name) >= 0) set(cur.filter(x => x !== name))
    else set(cur.concat([name]))
  }
  function analyze(names) {
    if (!posMatrix || names.length < 2) return null
    const members = names.map(nm => rows.find(r => r.name === nm)).filter(Boolean)
    const idxs = members.map(m => m.simIdx)
    const wins = members.map(() => 0)
    const finSum = members.map(() => 0)
    for (let s = 0; s < simN; s++) {
      let best = 1e9, bi = 0
      for (let g = 0; g < idxs.length; g++) {
        const pos = posMatrix[s * n + idxs[g]]
        finSum[g] += pos
        if (pos < best) { best = pos; bi = g }
      }
      wins[bi]++
    }
    return members.map((m, g) => ({ name: m.name, avgFin: finSum[g] / simN, winPct: 100 * wins[g] / simN, fmv: fmvAmerican(wins[g] / simN) })).sort((a, b) => b.winPct - a.winPct)
  }
  function aggBy(key) {
    const m = {}
    rows.forEach(r => { const g = ((r[key] || 'Unknown') + '').trim() || 'Unknown'; m[g] = (m[g] || 0) + (r.winPct || 0) })
    return Object.entries(m).map(([k, v]) => ({ name: k, winPct: v, fmv: fmvAmerican(v / 100) })).sort((a, b) => b.winPct - a.winPct)
  }
  const byMfr = aggBy('manufacturer')
  const byTeam = aggBy('organization')
  const chip = (active) => ({ cursor: 'pointer', padding: '1px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, marginLeft: 5, border: '1px solid var(--border)', background: active ? 'var(--accent, #22c55e)' : 'transparent', color: active ? '#08120b' : 'var(--text-secondary)' })
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 4 }}>H2H / Group Betting</h2>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>Tag 2 drivers for a head-to-head, or 3+ for a group bet, into Group A or B, then Analyze. Win % is the chance that driver finishes best of the group; FMV is the fair no-vig American price.</div>
      <div style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: 4 }}>Group A: <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{gA.length ? gA.join(', ') : 'none'}</span></div>
      <div style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: 8 }}>Group B: <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{gB.length ? gB.join(', ') : 'none'}</span></div>
      <div style={{ maxHeight: 190, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: 6, margin: '4px 0 10px' }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
            <span style={{ fontSize: '0.82rem' }}>{r.name}</span>
            <span>
              <span style={chip(gA.indexOf(r.name) >= 0)} onClick={() => toggle(r.name, 'A')}>A</span>
              <span style={chip(gB.indexOf(r.name) >= 0)} onClick={() => toggle(r.name, 'B')}>B</span>
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ ...__bmBtn, opacity: gA.length < 2 ? 0.5 : 1 }} onClick={() => setResA(analyze(gA))} disabled={gA.length < 2}>Analyze A Matchup</button>
        <button style={{ ...__bmBtn, opacity: gB.length < 2 ? 0.5 : 1 }} onClick={() => setResB(analyze(gB))} disabled={gB.length < 2}>Analyze B Matchup</button>
      </div>
      <BmTable data={resA} col1="Group A" />
      <BmTable data={resB} col1="Group B" />
      <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '20px 0 4px' }}>Winning Manufacturer</h2>
      <BmTable data={byMfr} col1="Manufacturer" />
      <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '20px 0 4px' }}>Winning Team</h2>
      <BmTable data={byTeam} col1="Team" />
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

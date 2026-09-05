import React, { useState, useEffect, useMemo } from 'react'
import { parseSect, FD_HEADERS, HR_HEADERS, normDriver } from '../lib/oddsSectionParser'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/fetchAllRows'
import useSubscriber from '../lib/useSubscriber'


import {
  CAUTION_PRESETS,
  DEFAULT_WEIGHTS,
  DNF_PRESETS,
  ONEILLY_SUPERSPEEDWAY_WEIGHTS,
  ROAD_COURSE_WEIGHTS,
  SERIES_TABS,
  SUPERSPEEDWAY_WEIGHTS,
  TRUCK_ROAD_WEIGHTS,
  TRUCK_SHORT_WEIGHTS,
  __applyRainOut,
  __trackGroup,
  buildSpeedScores,
  getCautionPresets,
  isRoadCourse,
  isSuperspeedway,
  normalizeName,
  resolveDnfRate,
  runRaceSim,
} from '../lib/simEngine'

// __marketValue and __teamCutoff stayed HERE when the sim engine was extracted
// (2026-08-31). Neither is part of the simulation: __marketValue converts book odds
// to EV and needs the odds parser, __teamCutoff is a page-level history filter. The
// engine has to stay importable from a plain node script, so odds parsing does not
// belong in it. Same code, unchanged - only the file it lives in was decided.
export function __marketValue(winTxt, t10Txt, fdTxt, hrTxt, drivers) {
  try {
    var norm = normDriver; // shared with oddsSectionParser - maps are keyed and looked up with the same normalizer
    var amer = function (l) { var m = l.trim().replace(/[\u2212\u2013\u2014]/g, '-'); return /^[+\-]\d{2,6}$/.test(m) ? parseInt(m, 10) : null; };
    var dec = function (a) { return a > 0 ? a / 100 + 1 : 100 / (-a) + 1; };
    var impl = function (a) { return a > 0 ? 100 / (a + 100) : -a / (-a + 100); };
    var parseDK = function (txt, n) { var out = {}, name = null, buf = []; var flush = function () { if (name && buf.length >= n) out[norm(name)] = buf.slice(0, n); name = null; buf = []; }; (txt || '').split('\n').forEach(function (raw) { var l = raw.trim(); if (!l) return; var o = amer(l); if (o !== null) { if (name) buf.push(o); } else if (/[a-zA-Z]{2,}/.test(l)) { flush(); name = l; } }); flush(); return out; };
    // parseSect + section-killer regexes live in src/lib/oddsSectionParser.js (extracted
    // 2026-08-28, code-review m3) - the group-market and season-futures bug history is documented there.

    var FDh = FD_HEADERS;
    var HRh = HR_HEADERS;
    // DK COLUMN-ORDER AUTO-DETECT (2026-07-14). DK sometimes prints the 3-col winner box in a
    // different column order (seen~ Top 5 / Top 3 / Race Winner instead of Winner / Top 3 / Top 5).
    // parseDK collects the 3 numbers per row positionally; we must map columns by the HEADER CELLS
    // in the paste, not by a fixed position. Header lines are already in winTxt (parseDK discards
    // them). Reads both separate-line and tab-joined header rows. Falls back to Winner/Top3/Top5
    // when headers are absent, so normal weeks are byte-for-byte unchanged.
    var detectDkOrder = function (txt) {
      var seq = [];
      (txt || '').split('\n').forEach(function (raw) {
        var l = raw.toLowerCase(), found = [];
        var __hdr = l.replace(/race\s*-?\s*winner/g, ' ').replace(/top\s*-?\s*\d+\s*finish/g, ' ').replace(/top\s*-?\s*\d+/g, ' ').replace(/\bfinish\b/g, ' ').replace(/\bto win\b/g, ' ').replace(/\bwinner\b/g, ' ').replace(/\boutright\b/g, ' ').replace(/[^a-z0-9]+/g, '').trim();
        if (__hdr) return;
        var m5 = /top\s*-?\s*5/.exec(l);            if (m5) found.push([m5.index, 't5']);
        var m3 = /top\s*-?\s*3/.exec(l);            if (m3) found.push([m3.index, 't3']);
        var mw = /race\s*winner|outright|(^|\s)winner(\s|$)/.exec(l); if (mw) found.push([mw.index, 'win']);
        found.sort(function (a, b) { return a[0] - b[0]; });
        found.forEach(function (f) { if (seq.indexOf(f[1]) < 0) seq.push(f[1]); });
      });
      return seq.length ? seq : ['win', 't3', 't5'];   // 1, 2, or 3 markets; fallback only if none
    };
    var __dkOrder = detectDkOrder(winTxt);
    // DK may post FEWER markets than 3 (e.g. Race Winner only, early in the week). Parse exactly as
    // many columns per driver as there are detected market headers, so a winner-only page still parses.
    var d1 = parseDK(winTxt, __dkOrder.length), d2 = parseDK(t10Txt, 1);
    var dk = { win: {}, t3: {}, t5: {}, t10: {} };
    Object.keys(d1).forEach(function (k) { __dkOrder.forEach(function (mk, ci) { if (d1[k][ci] != null) dk[mk][k] = d1[k][ci]; }); });
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
        // LEAVE-ONE-OUT consensus (2026-07-12). The book we would BET (bb) is excluded: a soft
        // outlier implies a LOW probability, so leaving it in drags the consensus toward itself and
        // UNDERSTATES how soft the line is (Erik Jones Atlanta: mev +24 with FD in, +47 with FD out).
        var cons = []; Object.keys(books).forEach(function (bk) { if (bk === bb) return; var kk = fk(books[bk][key]); if (kk != null && dvg[bk][kk] != null) cons.push(dvg[bk][kk]); });
        if (!cons.length) { Object.keys(books).forEach(function (bk) { var kk = fk(books[bk][key]); if (kk != null && dvg[bk][kk] != null) cons.push(dvg[bk][kk]); }); }
        var consP = cons.length ? cons.reduce(function (a, b) { return a + b; }, 0) / cons.length : null;
        var p = (d[pf] || 0) / 100;
        res[d.name] = res[d.name] || {};
        // ev    = EV at the BEST price using OUR prob  -> what you bet on (model alpha + line-shop alpha)
        // mev   = EV at the BEST price using the SHARP (leave-one-out) consensus prob -> is the line SOFT?
        // medge = OUR prob minus the SHARP consensus prob, in probability POINTS -> do we actually beat
        //         the market? This is the ONLY one of the three that isolates model alpha. A model with
        //         zero edge still prints a fat ev whenever one book hangs a bad number.
        res[d.name][key] = { dk: px.dk, fd: px.fd, hr: px.hr, best: best, bb: bb, ev: (p >= MINP[key] && ((d.nCorrRaces === undefined && d.practiceScore === undefined) || (d.nCorrRaces || 0) >= 5 || d.practiceScore != null)) ? +((p * dec(best) - 1) * 100).toFixed(0) : null /* EDGE gate 2026-07-22: no flags on data-thin drivers */, mev: consP != null ? +((consP * dec(best) - 1) * 100).toFixed(0) : null, medge: (consP != null && p >= MINP[key] && ((d.nCorrRaces === undefined && d.practiceScore === undefined) || (d.nCorrRaces || 0) >= 5 || d.practiceScore != null)) ? +(((p - consP) * 100).toFixed(2)) : null };
      });
    });
    return res;
  } catch (e) { return {}; }
}

var __teamCutoff = { 'chase briscoe': 2025 };


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
  const [lineupState, setLineupState]       = useState('none')
  const [weights, setWeights]               = useState(DEFAULT_WEIGHTS)
  const [rainOut, setRainOut] = useState(false)
  const [lapsDownOverrides, setLapsDownOverrides] = useState({})
  const [cautionPreset, setCautionPreset]   = useState(CAUTION_PRESETS[1])
  const [cautionAutoNote, setCautionAutoNote] = useState('')
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
  const [runNote, setRunNote] = useState('') // operator note stored with published board (2026-08-08)
  const [oddsWinTxt, setOddsWinTxt] = useState('')
  const [oddsT10Txt, setOddsT10Txt] = useState('')
  const [oddsFdTxt, setOddsFdTxt] = useState('')
  const [oddsHrTxt, setOddsHrTxt] = useState('')
  const [gDk, setGDk] = useState('')
  const [gFd, setGFd] = useState('')
  const [gHr, setGHr] = useState('')
  const [shadeLambda, setShadeLambda] = useState(0.5)
  const [showShade, setShowShade] = useState(false)
  const [showBorrows, setShowBorrows] = useState(false)
  const [simStage, setSimStage] = useState('post')  // post = POST-PRACTICE final board (race-day default). 2026-07-24: briefly flipped to 'pre' on a misread of stage semantics - reverted same day
  const [raceNumMap, setRaceNumMap] = useState({})
  const { isAdminUser } = useSubscriber() // master admin passes the gate (2026-08-12)

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
        // Race # single source of truth (2026-07-11): the publish field defaults from the
        // weekend config so a stale manual value can't mislabel a published board (the R14
        // incident). Set it once per weekend in Admin -> Weekend Config; still editable here.
        if (cfg.race_number) setRaceNumMap(prev => ({ ...prev, [s]: String(cfg.race_number) }))
        // Race length + stage lengths from weekend config (2026-07-11): set once in Admin,
        // loaded on every sim session - still editable here for one-off tweaks.
        if (cfg.total_laps) setTotalRaceLaps(parseInt(cfg.total_laps))
        if (cfg.stage1_laps != null) setStage1Laps(parseInt(cfg.stage1_laps) || 0)
        if (cfg.stage2_laps != null) setStage2Laps(parseInt(cfg.stage2_laps) || 0)

        // Auto-apply track-type weights
        setWeights(isSuperspeedway(cfg.track_name) ? (s === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS) : isRoadCourse(cfg.track_name) ? (s === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS) : (s === 'trucks' && __trackGroup(cfg.track_name) === 'SHORT') ? TRUCK_SHORT_WEIGHTS : DEFAULT_WEIGHTS)
        // EXHIBITION GUARD (2026-07-14). All-Star / non-points races run a REDUCED FIELD (~20 cars).
        // That mechanically inflates driver_rating -- 'top 15 pct of laps' becomes a far larger share of a
        // small field -- and the invitational entry list creates availability bias. Such races must NEVER
        // feed corrHistory, trackHistory, the caution preset, or the race-length/DNF estimate.
        // loop_data has no exhibition column, and the sim reads it by track_name (NOT via a races join),
        // so the flag alone would not protect us. Single source of truth = races.exhibition -> race_id list.
        let __exIds = []
        try {
          const __ex = await supabase.from('races').select('id').eq('exhibition', true)
          __exIds = ((__ex && __ex.data) || []).map(function (r) { return r.id })
        } catch (e) { __exIds = [] }
        const __noEx = function (q) { return __exIds.length ? q.not('race_id', 'in', '(' + __exIds.join(',') + ')') : q }
        try {
          const __cr = await supabase.from('races').select('total_cautions').eq('series', s).eq('track_name', cfg.track_name).not('total_cautions', 'is', null).eq('exhibition', false)
          const __cs = ((__cr && __cr.data) || []).map(function (x) { return x.total_cautions }).filter(function (v) { return v != null })
          const __ci = __cs.length ? (function () { var a = __cs.reduce(function (p, q) { return p + q }, 0) / __cs.length; return a < 6 ? 0 : a < 11.5 ? 1 : 2 })() : 1
          // SUPERSPEEDWAYS ARE PINNED TO MEDIUM. The auto-preset effect below already says
          // "SS: pinned (calibrated)" — but it only set that NOTE and returned, so this line
          // bucketed SS from its caution average anyway and the pin was cosmetic. That split
          // cup Talladega (5.33 avg cautions) from Daytona (6.17) across the hard <6 boundary,
          // putting Talladega alone on the calm wreck pool: it simmed 10.4% attrition against
          // 20.9% measured, roughly half. Every other SS cell already sat on Medium.
          // Measured on the 2025-26 holdout, cup Talladega, Low -> Medium:
          //   DNF 10.4% -> 20.4% (measured 20.9%) · win Brier .02607 -> .02494
          //   top5 .11890 -> .10932 · top10 .20981 -> .18996
          // SS-wide across all 27 holdout races it also improves every market. BACKTEST_LOG 2026-08-31.
          setCautionPreset(getCautionPresets(s)[isSuperspeedway(cfg.track_name) ? 1 : __ci])
          const __dl = await __noEx(supabase.from('loop_data').select('race_id, laps_completed, finish_status').eq('series', s).eq('track_name', cfg.track_name))
          const __by = {}; (((__dl && __dl.data) || [])).forEach(function (r2) { (__by[r2.race_id] = __by[r2.race_id] || []).push({ lc: parseInt(r2.laps_completed) || 0, fs: (r2.finish_status || '').toLowerCase() }) })
          const __dnfs = Object.keys(__by).map(function (k) {
            var rws = __by[k]
            var mx = Math.max.apply(null, rws.map(function (r3) { return r3.lc }).concat([1]))
            // 2026-08-14: Lap Raptor dropped laps_completed - new rows carry REAL finish
            // statuses instead (old rows: valid laps + junk 'running'). Either signal
            // marks a DNF; null-laps rows no longer count as 100pct DNF.
            return rws.filter(function (r3) { return (r3.fs && r3.fs !== 'running') || (r3.lc > 0 && r3.lc < 0.9 * mx) }).length / rws.length
          })
          const __tAvg = __dnfs.length ? (__dnfs.reduce(function (p, q) { return p + q }, 0) / __dnfs.length) : null
          const __rate = resolveDnfRate(s, cfg.correlation_label, __tAvg, __dnfs.length)
          setDnfPreset({ label: 'Auto', value: __rate, auto: true, nTrack: __dnfs.length })
        } catch (e) {
          setDnfPreset({ label: 'Auto', value: resolveDnfRate(s, cfg.correlation_label, null, 0), auto: true, nTrack: 0 })
        }

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
          (() => {
            // Double-header guard (2026-07-10): scope lineup to the configured Race # so a
            // spring lineup at the same track/year cannot leak into the fall sim
            let q = supabase.from('qualifying_results')
              .select('driver_name, qualifying_position, lap_time, lineup_source, draw_order')
              .eq('series', s)
              .eq('track_name', cfg.track_name)
              .eq('year', cfg.race_year || new Date().getFullYear())
            if (cfg.race_number) q = q.eq('race_number', cfg.race_number)
            return q
          })(),
          (() => {
            let q = supabase.from('practice_sessions')
              .select('driver_name, overall_avg, best5, practice_group, late_run_avg, trend_slope, practice_score, session_number, qualifying_position')
              .eq('series', s)
              .eq('track_name', cfg.track_name)
              .eq('year', cfg.race_year || new Date().getFullYear())
            if (cfg.race_number) q = q.eq('race_number', cfg.race_number)
            return q.order('session_number', { ascending: false })
          })(),
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
        // PAIRING-FIRST BORROW (2026-07-17, operator-directed): a ringer's current-season rows in THIS
        // series (driver-x-equipment measured jointly, e.g. Bell in the 62) beat translated cup ratings.
        // Requires >= 2 current-season rows; otherwise the raw-cup srcRows fallback below applies.
        let __pairMap = {}
        let __entCarMap = {}
        try {
          if ((entries || []).length) {
            // car-matched pairing (2026-08-03): multi-car ringers (e.g. Chastain JRM 9 vs JAR 32) must not
            // blend rides. Prefer rows in THIS week's entered car (last 2 seasons, prior season x0.6),
            // then current-season any-car, then raw-src fallback below.
            ;(entries || []).forEach(en => { const __n2 = normalizeName((en.driver_name || '').trim()); if (en.car_number != null) __entCarMap[__n2] = String(en.car_number).trim() })
            const __py = cfg.race_year || new Date().getFullYear()
            const { data: __prs } = await supabase.from('loop_data').select('driver_name, driver_rating, year, car_number').eq('series', s).in('year', [__py, __py - 1])
            ;(__prs || []).forEach(r => {
              const __pn = normalizeName((r.driver_name || '').trim())
              if (!__entCarMap[__pn]) return
              const __rt = parseFloat(r.driver_rating)
              if (isNaN(__rt)) return
              const __pm = (__pairMap[__pn] = __pairMap[__pn] || { cur: [], byCar: {} })
              if (parseInt(r.year) === __py) { __pm.cur.push(__rt); __pm.curN = (__pm.curN || 0) + 1 }
              const __cn = String(r.car_number == null ? '' : r.car_number).trim()
              if (__cn) (__pm.byCar[__cn] = __pm.byCar[__cn] || []).push({ rt: __rt, yr: parseInt(r.year) })
            })
          }
        } catch (e) {}
        let loopRows = []
        if (corrNames.length) {
          // PAGINATED because this is the query closest to PostgREST's silent 5,000-row cap
          // (2026-09-02). It fetches the whole correlation group, unfiltered by year, and feeds
          // BOTH corrAvgMap (driver form) and carAvgMap (equipment) — the speed-score inputs.
          // Measured that day, Intermediate:
          //     cup sim      ['cup']            2,444
          //     trucks sim   ['trucks','cup']   3,971
          //     oreilly sim  ['oreilly','cup']  4,836   <- 164 rows of headroom
          // O'Reilly picks up ~800-1,000 rows a season here, so it crosses the cap during 2027,
          // and activating any crossover_borrow makes the series list three-wide (6,363) and
          // crosses it immediately. Nothing is truncated TODAY - this is not a repair, it is
          // removing a failure that would otherwise appear silently mid-season and drop the
          // NEWEST races first, which is exactly the data the age weights lean on hardest.
          const { data: ld } = await fetchAllRows(() => __noEx(supabase
            .from('loop_data')
            .select('driver_name, finish_position, laps_led, fastest_laps, driver_rating, pct_quality_passes, year, series, car_number')
            .in('track_name', corrNames)
            .in('series', [...new Set([s, 'cup', ...__borrowSeries])])))
          loopRows = ld || []
        }

        // PIT CREW (2026-07-18, task #46 PASSED): current-season median 4-tire box time per car.
        // Requires >= 5 timed stops; nulls fall to neutral 50. Data: pit_stops (raw NASCAR
        // telemetry via operator's loader). Raw seconds — never compared across series.
        let __crewMap = {}
        try {
          const __cyy = cfg.race_year || new Date().getFullYear()
          // PAGINATED 2026-09-02. This carried .limit(20000), which is meaningless - PostgREST
          // caps every response at 5,000. Measured cup 4-tire stops per season: 2022 6,507 /
          // 2023 6,043 / 2024 6,264 / 2025 6,528 / 2026 4,354. So any sim configured to a PAST
          // cup season was already computing the crew term from 5,000 of ~6,300 stops, and cup
          // 2026 (4,354) crosses 5,000 partway through this season - a cup race adds ~250
          // 4-tire stops, so roughly three races out. Verified live: cup 2025 returned 5,000 of
          // 6,528. I told the operator earlier that day this query was safe "~4k against a 20k
          // limit"; the limit was never the binding constraint.
          const { data: __pits } = await fetchAllRows(() => supabase.from('pit_stops')
            .select('car_number, box_time')
            .eq('series', s).eq('year', __cyy).eq('tires_changed', 4)
            .not('box_time', 'is', null).gt('lap', 0))
          const __byCar = {}
          ;(__pits || []).forEach(p => { const c = String(p.car_number || '').trim(); if (c && p.box_time != null) (__byCar[c] = __byCar[c] || []).push(parseFloat(p.box_time)) })
          // task #68 (2026-07-23): qualifying-stops fence — exclude crash repairs / penalty holds via
          // series-season Tukey fence (q3 + 1.5*IQR) BEFORE computing crew medians. Validated same day:
          // clean strictly dominates raw head-to-head (t 5.07 vs 1.63, n 10,868 — BACKTEST_LOG).
          const __allBt = []
          Object.keys(__byCar).forEach(c => { __byCar[c].forEach(t => __allBt.push(t)) })
          __allBt.sort((x, y) => x - y)
          const __fq1 = __allBt[Math.floor(__allBt.length * 0.25)] || 0
          const __fq3 = __allBt[Math.floor(__allBt.length * 0.75)] || 0
          const __fence = __allBt.length >= 100 ? __fq3 + 1.5 * (__fq3 - __fq1) : Infinity
          // 2026-08-31: the Tukey fence guards only the SLOW tail. NASCAR's feed emits impossible
          // box_times on rows flagged FOUR_WHEEL_CHANGE (96 of 52,737 stops 2022-26, some as low
          // as 0.02s). The floor is set from where the real distribution starts: cup 4-tire stops
          // are 5 isolated singletons below 8.75s, then 38 stops across 15 cars in 8.75-9.00 and
          // hundreds above. The median already absorbed these (shifts <= 0.042s, so no sim result
          // changes), but the floor is applied here too so the sim and PitCrewRankings agree on
          // what counts as a valid stop. Same constant, same derivation — see FLOOR_4T there.
          const __FLOOR_4T = 8.5
          Object.keys(__byCar).forEach(c => { const a = __byCar[c].filter(t => t >= __FLOOR_4T && t <= __fence).sort((x, y) => x - y); if (a.length >= 5) __crewMap[c] = a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2 })
        } catch (e) {}

        // Specific track history
        let trackRows = []
        const { data: trData } = await __noEx(supabase
          .from('loop_data')
          .select('driver_name, finish_position, driver_rating, year')
          .eq('track_name', cfg.track_name)
          .eq('series', s))
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
            // 2026-07-18: relative-age weights (matches backtest harness; frozen-2026 ladder would break in 2027).
            // Minor-series current-season bump 2.0 -> 3.0 (trucks+oreilly W82/L56 vs cw2, p ~ .03; cup keeps 2.0 — BACKTEST_LOG).
            const yrWt = yr => { const dd = ((cfg && cfg.race_year) || new Date().getFullYear()) - yr; return dd <= 0 ? (s === 'cup' ? 2.0 : 3.0) : dd === 1 ? 1.3 : dd === 2 ? 0.9 : dd === 3 ? 0.6 : 0.4 }
            // FIX 2026-07-17: own-series rows ONLY. b2c916e8 (07-08, borrow wiring) accidentally let cup rows
            // into EVERY driver's base pool (rating, avgFin, winConv) — cup enters ONLY via crossover_borrows.
            const baseRows = rows.filter(r => r.sr === s)
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
            const __pmE = __pairMap[name]
            const __carNow = __entCarMap[name]
            const __carRows = (__pmE && __carNow) ? (__pmE.byCar[__carNow] || []) : []
            const __multiCar = __pmE ? Object.keys(__pmE.byCar).length >= 2 : false
            let __pairRating = null
            let __carMatchedF = false
            if (__carRows.length >= (bw ? 2 : 3) && (bw || __multiCar)) {
              __carMatchedF = true
              // car-auto-v1 (2026-08-03): part-time multi-car drivers rate from THIS week's car - no borrow entry needed
              const __py2 = cfg.race_year || new Date().getFullYear()
              let __wS = 0, __vS = 0
              __carRows.forEach(x => { const w2 = x.yr === __py2 ? 1 : 0.6; __wS += w2; __vS += x.rt * w2 })
              __pairRating = __vS / __wS
            } else if (bw && __pmE && __pmE.cur.length >= 2) {
              __pairRating = __pmE.cur.reduce((a, v) => a + v, 0) / __pmE.cur.length
            }
            if (__pairRating != null) {
              const __wB = bw ? bw.w : 1
              avgRating = (avgRating == null) ? __pairRating : (1 - __wB) * avgRating + __wB * __pairRating
            } else if (bw) {
              const srcRows = rows.filter(r => r.sr === bw.src && r.rating !== null)
              if (srcRows.length) {
                const srcRating = srcRows.reduce((a, r) => a + r.rating * yrWt(r.yr), 0) / wsum(srcRows)
                avgRating = (avgRating == null) ? srcRating : (1 - bw.w) * avgRating + bw.w * srcRating
              }
            }
            // equipment prior (task 118): driver's modal in-series car.
            // WEIGHTED MODAL (2026-08-20): counts use the same yrWt as the rating pool - a raw
            // count kept last season's car modal deep into the new season (Garcia #13->#98:
            // 48 old rows vs 17 new could never flip in-season), so the ride-change delta kept
            // firing on drivers whose rating already absorbed the new ride. Backtest n=2813
            // ride-change obs: stale-modal delta on flipped drivers = dead tie (.523/.523,
            // mean |2.57| rating pts of pure noise); weighted modal best-or-tied on every test
            // cut (fresh-change .479 vs CUR .478; test cup .368, trucks .536). BACKTEST_LOG 2026-08-20.
            const carCnt = {}
            baseRows.forEach(r => { if (r.sr === s && r.car) carCnt[r.car] = (carCnt[r.car] || 0) + yrWt(r.yr) })
            let modalCar = null, modalCarN = 0
            Object.keys(carCnt).forEach(cn => { if (carCnt[cn] > modalCarN) { modalCar = cn; modalCarN = carCnt[cn] } })
            return [name, { avg: avgFin, avgRating, winConv, n: baseRows.length, modalCar, carMatched: __carMatchedF }]
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
          if (__borrowMap[normalizeName((r.driver_name || '').trim())]) return // 2026-07-22: ringer rows measure driver x equipment jointly (Bell/62 -> MCJ ghost value) — excluded from car pools
          if (!loopByCar[car]) loopByCar[car] = []
          loopByCar[car].push({ rating, yr })
        })
        const carAvgMap = new Map(
          Object.entries(loopByCar).map(([car, rows]) => {
            const yrWt = yr => { const dd = ((cfg && cfg.race_year) || new Date().getFullYear()) - yr; return dd <= 0 ? 2.0 : dd === 1 ? 1.3 : dd === 2 ? 0.9 : dd === 3 ? 0.6 : 0.4 } // relative-age (2026-07-18); cw2 here (untested for bump)
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
            const yrWt = yr => { const dd = ((cfg && cfg.race_year) || new Date().getFullYear()) - yr; return dd <= 0 ? 2.0 : dd === 1 ? 1.3 : dd === 2 ? 0.9 : dd === 3 ? 0.6 : 0.4 } // relative-age (2026-07-18); cw2 here (untested for bump)
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

        // task #72 (2026-07-25, backtested same day): PROJECTED start positions for pre-lineup
        // boards. pred = mean of last-10 prior start pctiles (same series, min 3 prior, 2025+
        // corpus); walk-forward corr 0.643 vs actual grid, recovers ~75% of the start term's
        // value pre-quali (BACKTEST_LOG n=13,144). Fills ONLY when neither quali nor practice
        // provides a start; raw-pctile mapping (not re-ranked) keeps the projected grid
        // compressed toward mid-field = conservative under the fixed 0.33 weight. Badge says
        // 'projected'; the real grid takes over automatically once qualifying loads.
        let __projStart = new Map()
        const __projStartH = new Map()   // task #73: last-10 lists for per-sim start sampling
        try {
          const { data: __pstarts } = await supabase.from('loop_data')
            .select('driver_name, start_position, finish_position, year, race_number, track_name, car_number')
            .eq('series', s).gte('year', 2025).not('start_position', 'is', null).limit(6000)
          const __pbr = {}
          ;(__pstarts || []).forEach(r => { const k = r.year * 100 + r.race_number; (__pbr[k] = __pbr[k] || []).push(r) })
          // trail10-v2 HYBRID (2026-07-25 sweep): SS and ROAD grids are separate disciplines —
          // condition the projection on category there (corr .563->.610 SS, .626->.660 road);
          // ovals share one qualifying skill so pooled wins (short .653 vs .639). Hybrid corr
          // .656 overall, finish-model t 22.3 vs 21.0 pooled (BACKTEST_LOG same date).
          const __cat = isSuperspeedway(cfg.track_name) ? 'SS' : (isRoadCourse(cfg.track_name) ? 'ROAD' : null)
          const __rowCat = tn => isSuperspeedway(tn) ? 'SS' : (isRoadCourse(tn) ? 'ROAD' : null)
          const __phist = {}, __phistC = {}, __phistCar = {}, __phistCars = {}, __phistCurN = {}, __phistCarAll = {} // car-auto-v1: car-matched start history for part-time multi-car drivers
          const __entCarAll = {}
          ;(entries || []).forEach(en => { if (en.car_number != null) __entCarAll[normalizeName((en.driver_name || '').trim())] = String(en.car_number).trim() })
          Object.keys(__pbr).map(Number).sort((a, b) => a - b).forEach(k => {
            const el = __pbr[k]; if (el.length < 15) return
            const rc = __rowCat(el[0].track_name)
            el.forEach(r => { const dn = normalizeName(r.driver_name); const v = r.start_position / el.length
              ;(__phist[dn] = __phist[dn] || []).push(v)
              if (__cat && rc === __cat) (__phistC[dn] = __phistC[dn] || []).push(v)
              const __cnP = String(r.car_number == null ? '' : r.car_number).trim()
              if (__cnP) { (__phistCars[dn] = __phistCars[dn] || {})[__cnP] = 1; (__phistCarAll[__cnP] = __phistCarAll[__cnP] || []).push(v) }
              if (parseInt(r.year) === (cfg.race_year || new Date().getFullYear())) __phistCurN[dn] = (__phistCurN[dn] || 0) + 1
              const __bc = __entCarAll[dn]
              if (__bc && __cnP === __bc) (__phistCar[dn] = __phistCar[dn] || []).push(v) })
          })
          Object.keys(__phist).forEach(dn => {
            const cCar = __phistCar[dn] || []
            const __mcP = Object.keys(__phistCars[dn] || {}).length >= 2 // car-auto-v2 (2026-08-07): part-time gate dropped - full-schedule two-car drivers (Caruth 88/32) were pooling rides
            const cA = __cat ? (__phistC[dn] || []) : []
            const a = (__mcP && cCar.length >= 3) ? cCar : ((cA.length >= 3) ? cA : __phist[dn])
            if (a.length >= 3) { const last = a.slice(-10); __projStart.set(dn, last.reduce((x, y) => x + y, 0) / last.length); __projStartH.set(dn, last) }
          })
        // equipment-start fallback (2026-08-03, operator-directed): drivers with NO usable loop history
          // project from THIS car number's series grid history under any driver (>=3 rows since 2025).
          ;(entries || []).forEach(en => {
            const dn = normalizeName((en.driver_name || '').trim())
            if (__projStart.has(dn)) return
            const __cn2 = en.car_number != null ? String(en.car_number).trim() : ''
            const ch = __cn2 ? (__phistCarAll[__cn2] || []) : []
            if (ch.length >= 3) { const last = ch.slice(-10); __projStart.set(dn, last.reduce((x, y) => x + y, 0) / last.length); __projStartH.set(dn, last) }
          })
          // trail10-v4-form (2026-09-03, pre-registered + holdout-passed, BACKTEST_LOG same date; CUP ONLY):
          // since 2025 the Cup qualifying ORDER is set by a metric (70% previous-race finish, 30% owner
          // points; worst go first, best go last) and recent form now moves qualifying by a lot more than
          // a ten-race average can see: 2026 holdout start MAE INT 7.56 -> 6.24 (8/8 races), SHORT 7.93 ->
          // 7.56, SS 10.03 -> 9.46, ROAD untouched (beta 0). Term: proj pctile += beta_g x (x - 0.5) where
          // x = the Jayski order for THIS race when loaded (qualifying_results.draw_order via the Admin
          // PDF panel; later = better, so x = 1 - order pctile), else previous-round finish pctile
          // (adjacent round, same season). The #73 sampling history shifts by the same term so the
          // sampled centre matches the point estimate. O'Reilly / trucks keep v3.5 (not measured).
          // 2026-09-05: O'Reilly added (same metric sets its order — operator; own fit, own holdout:
          // 2026 start MAE 6.00 -> 5.73, INT 6.43 -> 5.68 7/7, live-race share 13/17; BACKTEST_LOG).
          // Trucks: unmeasured, no term.
          const __V4_BETA = { cup: { INT: 0.2495, SHORT: 0.1649, SS: 0.1863, ROAD: 0 }, oreilly: { INT: 0.1708, SHORT: 0.1441, SS: 0.0353, ROAD: 0 } }
          if (__V4_BETA[s]) {
            const __beta = __V4_BETA[s][__trackGroup(cfg.track_name)] || 0
            if (__beta) {
              const __x = {}
              const __cy = cfg.race_year || new Date().getFullYear(), __crn = parseInt(cfg.race_number)
              if (__crn > 1) {
                const __prev = __pbr[__cy * 100 + (__crn - 1)] || []
                if (__prev.length >= 15) __prev.forEach(r => { if (r.finish_position != null) __x[normalizeName(r.driver_name)] = (r.finish_position - 1) / (__prev.length - 1) })
              }
              const __ord = (qualData || []).filter(r => r.draw_order != null && isFinite(parseFloat(r.draw_order))).sort((a, b) => parseFloat(a.draw_order) - parseFloat(b.draw_order))
              if (__ord.length >= 15) __ord.forEach((r, i) => { __x[normalizeName((r.driver_name || '').trim())] = 1 - i / (__ord.length - 1) })
              __projStart.forEach((v, dn) => {
                const x = __x[dn]; if (x == null) return
                const adj = __beta * (x - 0.5)
                __projStart.set(dn, v + adj)
                const h = __projStartH.get(dn); if (h) __projStartH.set(dn, h.map(e => e + adj))
              })
            }
          }
        } catch (e) { __projStart = new Map() }

        const drivers = driverSource
          .map(e => {
            const name  = e.driver_name?.trim()
            const normName = normalizeName(name)
            if (!name) return null
            const qual  = qualMap.get(normName)
            const prac  = practiceMap.get(normName)
            // task #70 (2026-07-28): DNQ sentinel (-1 start from the practice/quali upload)
            // hard-excludes the driver from the sim field -> board -> DFS pool. Deterministic,
            // independent of the >=20-starts trim heuristic, immune to projected-start fill.
            if ((qual && parseFloat(qual.qualifying_position) === -1) || (prac && parseFloat(prac.qualifying_position) === -1)) return null
            return {
              name,
              carNumber:     e.car_number   || null,
              organization:  e.organization || null,
              manufacturer:  e.manufacturer || null,
              __startProjected: !(qual && qual.qualifying_position) && !(prac && prac.qualifying_position) && __projStart.has(normName),
              __projPct: __projStart.has(normName) ? __projStart.get(normName) : null,
              __startHist: (!(qual && qual.qualifying_position) && !(prac && prac.qualifying_position) && __projStartH.has(normName)) ? __projStartH.get(normName) : null,
              startPos:      qual && qual.qualifying_position ? parseFloat(qual.qualifying_position) : (prac && prac.qualifying_position ? parseFloat(prac.qualifying_position) : (__projStart.has(normName) ? Math.max(1, Math.round(__projStart.get(normName) * driverSource.length)) : null)),
              qualTime:      qual ? parseFloat(qual.lap_time)       || null : null,
              lrpTime:       prac ? ((series !== 'oreilly' && parseFloat(prac.best5)) || parseFloat(prac.overall_avg) || null) : null, // SHIPPED 2026-07-16: best5 for cup+trucks (log 4-1-2 + regression); oreilly keeps overall_avg per its own evidence; falls back when best5 null
              practiceGroup: prac ? (prac.practice_group || null) : null,
              pitCrewTime:   __crewMap[String(e.car_number || '').trim()] || null, // task #46
              practiceScore: prac ? parseFloat(prac.practice_score) || null : null,
              corrAvgFinish: corrAvgMap.get(normalizeName(name))?.avg       ?? null,
              corrAvgRating: corrAvgMap.get(normalizeName(name))?.avgRating ?? null,
              corrWinConv:   corrAvgMap.get(normalizeName(name))?.winConv   ?? null,
              __carMatched:  corrAvgMap.get(normalizeName(name))?.carMatched || false,
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

        // DNQ FILTER (2026-07-18 v2): once a real lineup exists (>= 20 drivers with a start position
        // from qualifying_results OR the practice sheet), entries with NO start position are not in
        // the race (DNQ or no-show: Huffman/Hill/Schafer, NW trucks) — drop them from the sim field.
        // Pre-lineup sims (few/no starts known) keep every entry.
        const __hasStart = d => d.startPos != null && !d.__startProjected && !isNaN(parseFloat(d.startPos))   // projected starts do NOT count as being in the field (task #72)
        if (drivers.filter(__hasStart).length >= 20) {
          for (let __i = drivers.length - 1; __i >= 0; __i--) if (!__hasStart(drivers[__i])) drivers.splice(__i, 1)
        }

        // trail10-v2.1 (operator call): re-rank projected starts into a realistic 1..K grid.
        // The raw-pctile fill compressed everyone toward mid-field; the composite min-max
        // stretches start scores anyway (compression was NOT conservative in score space),
        // and DK place-differential computes start-finish literally, so a compressed pseudo
        // grid biased DFS projections. Best projected qualifier now sits on the pole.
        {
          const __pj = drivers.filter(d => d.__startProjected).sort((a, b) => (a.__projPct != null && b.__projPct != null) ? a.__projPct - b.__projPct : a.startPos - b.startPos)
          __pj.forEach((d, i) => { d.startPos = i + 1 })
        }

        // task #71 part 2 (2026-07-28): speed-conditioned dominance. Practice pace predicts
        // LL/FL share BEYOND group x finish position (residual r .121 t 7.3 LL, r .200 t 12.2 FL,
        // n 3,555; effect multiplicative, front-bucket slope/share ratio ~1.1). Pctile of the
        // sim's practice metric (lrpTime: best5 cup/trucks, overall_avg oreilly); no practice
        // -> neutral 0.5. Consumed by runRaceSim's dominator allocation.
        {
          const __wt = drivers.filter(d => d.lrpTime != null && isFinite(d.lrpTime) && d.lrpTime > 0).sort((a, b) => a.lrpTime - b.lrpTime)
          __wt.forEach((d, i) => { d.__spdPct = __wt.length > 1 ? 1 - i / (__wt.length - 1) : 0.5 })
        }

        // Lineup-state badge: what does startPos actually use for this run?
        const __lnQ = drivers.filter(d => { const q = qualMap.get(normalizeName(d.name)); return q && q.qualifying_position }).length
        const __lnPrac = drivers.filter(d => d.startPos !== null && !d.__startProjected).length
        const __lnProj = drivers.filter(d => d.__startProjected).length
        let __lnSrc = 'none'
        if (__lnQ >= Math.max(3, drivers.length * 0.5)) {
          const __srcCnt = {}
          ;(qualData || []).forEach(q => { const sv = q.lineup_source || 'qualifying'; __srcCnt[sv] = (__srcCnt[sv] || 0) + 1 })
          __lnSrc = Object.keys(__srcCnt).sort((a, b) => __srcCnt[b] - __srcCnt[a])[0] || 'qualifying'
        } else if (__lnPrac >= Math.max(3, drivers.length * 0.5)) {
          __lnSrc = 'practice fallback'
        } else if (__lnProj >= Math.max(3, drivers.length * 0.5)) {
          __lnSrc = 'projected'   // task #72: trailing-form start projection, pre-lineup only
        } else if (__lnPrac + __lnProj > 0) {
          __lnSrc = 'partial ' + (__lnPrac + __lnProj) + '/' + drivers.length
        }
        setLineupState(__lnSrc)

        __groupConditionCorrect(drivers) // group condition correction (2026-07-16): no-op without A/B labels
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

  // EQUIPMENT PRIOR overrides (task 118): per-driver influence scale, default 1.
  // PERSISTED (2026-07-11): saved to featured_weekend.eq_overrides (jsonb) per series with a
  // debounce, loaded on page load - pre-quali tweaks carry into the post-quali session. (v2)
  const [eqOverrides, setEqOverrides] = useState({})
  const __eqLoaded = React.useRef(false)
  useEffect(() => {
    __eqLoaded.current = false
    supabase.from('featured_weekend').select('eq_overrides').eq('series', series).maybeSingle()
      .then(({ data }) => { setEqOverrides((data && data.eq_overrides) || {}); __eqLoaded.current = true })
  }, [series]) // eslint-disable-line
  useEffect(() => {
    if (!__eqLoaded.current) return
    const h = setTimeout(() => {
      supabase.from('featured_weekend').update({ eq_overrides: eqOverrides }).eq('series', series)
        .then(({ error }) => { if (error && /eq_overrides/.test(error.message || '')) console.warn('Run: alter table featured_weekend add column eq_overrides jsonb') })
    }, 800)
    return () => clearTimeout(h)
  }, [eqOverrides, series]) // eslint-disable-line

  // TO-THE-REAR overrides (2026-07-11): drivers forfeiting their qualifying spot (backup
  // car, unapproved adjustments, driver change). Sim scores them as starting at field size.
  // Persisted per series in featured_weekend.rear_overrides, same pattern as eq_overrides.
  const [rearOverrides, setRearOverrides] = useState({})
  const __rearLoaded = React.useRef(false)
  useEffect(() => {
    __rearLoaded.current = false
    supabase.from('featured_weekend').select('rear_overrides').eq('series', series).maybeSingle()
      .then(({ data }) => { setRearOverrides((data && data.rear_overrides) || {}); __rearLoaded.current = true })
  }, [series]) // eslint-disable-line
  useEffect(() => {
    if (!__rearLoaded.current) return
    const h = setTimeout(() => {
      supabase.from('featured_weekend').update({ rear_overrides: rearOverrides }).eq('series', series)
        .then(({ error }) => { if (error && /rear_overrides/.test(error.message || '')) console.warn('Run: alter table featured_weekend add column rear_overrides jsonb') })
    }, 800)
    return () => clearTimeout(h)
  }, [rearOverrides, series]) // eslint-disable-line
  // CAUTION AUTO-PRESET (2026-07-22): nearest calibrated preset from track+series caution
  // history (races.total_cautions, non-exhibition); corr-group fallback under 2 races;
  // superspeedways pinned (SS noise calibration anchor). Manual clicks override.
  useEffect(() => {
    let dead = false
    if (!config) return
    ;(async () => {
      try {
        if (isSuperspeedway(config.track_name)) { if (!dead) setCautionAutoNote('SS: pinned (calibrated)'); return }
        const { data: tr } = await supabase.from('races').select('total_cautions, track_name')
          .eq('series', series).not('total_cautions', 'is', null).not('exhibition', 'is', true)
        if (dead || !tr || !tr.length) return
        let rows = tr.filter(r => r.track_name === config.track_name)
        let src = 'track avg'
        if (rows.length < 2 && config.correlation_label) {
          const { data: gts } = await supabase.from('tracks').select('name').eq('correlation_group_label', config.correlation_label)
          const names = new Set((gts || []).map(x => x.name))
          rows = tr.filter(r => names.has(r.track_name))
          src = 'group avg'
        }
        if (dead || rows.length < 2) return
        const avg = rows.reduce((sum, r) => sum + r.total_cautions, 0) / rows.length
        const presets = getCautionPresets(series)
        const pick = presets.reduce((a, b) => Math.abs(b.value - avg) < Math.abs(a.value - avg) ? b : a)
        if (!dead) { setCautionPreset(pick); setCautionAutoNote('auto: ' + src + ' ' + avg.toFixed(1) + ' -> ' + pick.label) }
      } catch (e) {}
    })()
    return () => { dead = true }
  }, [config, series]) // eslint-disable-line

  // MARKET ANCHOR source: implied win-prob field percentile (0-100) from pasted odds.
  const __mktFill = useMemo(() => {
    try {
      // v1.4 multi-market tie-averaged rank (2026-07-22). History: rank spread co-priced
      // longshots by alphabet (v1.1); log-prob let FD's +250000 junk lines stretch the scale
      // so +10000 scored mid-field (v1.2/1.3). Books' t3/t5 tails ARE calibrated — so: per
      // market, rank implied prob with TIES SHARING rank; average percentile across all
      // markets a driver is priced in. Semantics = finish-rank space (what the salary-proxy
      // backtest validated). DO NOT re-derive again by reasoning — next revision must come
      // from the odds_snapshots archive (~15 races).
      const mv = __marketValue(oddsWinTxt, oddsT10Txt, oddsFdTxt, oddsHrTxt, rawDrivers)
      const dec = a => a > 0 ? a / 100 + 1 : 100 / Math.abs(a) + 1
      const acc = {}
      ;['win', 't3', 't5', 't10'].forEach(mk => {
        const rows = []
        rawDrivers.forEach(d => {
          const m = mv[d.name] && mv[d.name][mk]
          const best = m && m.best
          if (best == null) return
          rows.push([d.name, 1 / dec(best)])
        })
        if (rows.length < 10) return
        rows.sort((a, b) => a[1] - b[1])
        let i = 0
        while (i < rows.length) {
          let k = i
          while (k + 1 < rows.length && rows[k + 1][1] === rows[i][1]) k++
          const shared = ((i + k) / 2 + 1) / rows.length * 100
          for (let z = i; z <= k; z++) { (acc[rows[z][0]] = acc[rows[z][0]] || []).push(shared) }
          i = k + 1
        }
      })
      const out = {}
      Object.keys(acc).forEach(n => { out[n] = Math.round(acc[n].reduce((s, v) => s + v, 0) / acc[n].length) })
      return Object.keys(out).length >= 10 ? out : {}
    } catch (e) { return {} }
  }, [oddsWinTxt, oddsT10Txt, oddsFdTxt, oddsHrTxt, rawDrivers])

  const driversWithScores = useMemo(
    () => {
      const __rearPos = rawDrivers.length
      return buildSpeedScores(rawDrivers.map(d => ({
        ...d,
        equipScale: eqOverrides[d.name] != null ? eqOverrides[d.name] : 1,
        startPos: rearOverrides[d.name] ? __rearPos : d.startPos,
        // DK START (2026-08-23, operator catch): a rear override is a RACE fact (grid penalty) but
        // DraftKings keeps the QUALIFIED position for place-differential scoring - DK does not
        // reprice penalties. Keep the original here so the sim races him from the rear while DK
        // points are scored off the position DK will actually use. Null for everyone else.
        dkStartPos: rearOverrides[d.name] ? d.startPos : null,
        marketFill: __mktFill[d.name] != null ? __mktFill[d.name] : null,
        lapsDown: lapsDownOverrides[d.name] || 0,
      })), __applyRainOut(weights, rainOut))
    }, [rawDrivers, weights, rainOut, eqOverrides, rearOverrides, lapsDownOverrides, __mktFill]
  )

  

  // ODDS SNAPSHOTS (2026-07-18): every distinct odds paste is captured to odds_snapshots — the last
  // one before the race IS the closing line (operator re-sims up to green flag). Grade Center computes
  // CLV from published-board odds vs the final snapshot. Debounced 4s, deduped by content hash.
  const __snapHash = React.useRef('')
  const __runOddsHash = React.useRef('')
  useEffect(() => {
    if (!rawDrivers.length || !config) return
    const txts = [oddsWinTxt, oddsT10Txt, oddsFdTxt, oddsHrTxt]
    if (!txts.some(x => (x || '').trim())) return
    const h = series + '|' + ((simResults && simResults.length) ? 'S' : 'N') + '|' + txts.map(x => (x || '').length + ':' + (x || '').slice(0, 60)).join('|')
    if (h === __snapHash.current) return
    const tmr = setTimeout(async () => {
      try {
        const __mvSrc = (simResults && simResults.length) ? simResults : rawDrivers
        const mvSnap = __marketValue(oddsWinTxt, oddsT10Txt, oddsFdTxt, oddsHrTxt, __mvSrc)
        const rows = []
        Object.keys(mvSnap || {}).forEach(nm => {
          ;['win', 't3', 't5', 't10'].forEach(mk => {
            const m = mvSnap[nm] && mvSnap[nm][mk]
            if (!m) return
            ;['dk', 'fd', 'hr'].forEach(bk => { if (m[bk] != null) rows.push({ series: series, track_name: config.track_name, race_year: config.race_year || new Date().getFullYear(), race_number: raceNumMap[series] ? parseInt(raceNumMap[series]) : null, driver_name: nm, market: mk, book: bk, odds: m[bk], ev: m.ev, mev: m.mev, medge: m.medge, best_price: m.best, best_book: m.bb }) })
          })
        })
        if (rows.length >= 10) { { const { error: __oe } = await supabase.from('odds_snapshots').insert(rows); if (__oe) { await supabase.from('odds_snapshots').insert(rows.map(({ ev, mev, medge, best_price, best_book, ...__r }) => __r)) } }; __snapHash.current = h }
      } catch (e) {}
    }, 4000)
    return () => clearTimeout(tmr)
  }, [oddsWinTxt, oddsT10Txt, oddsFdTxt, oddsHrTxt, rawDrivers, simResults, series, config, raceNumMap]) // eslint-disable-line

  const handleRun = () => {
    __runOddsHash.current = [oddsWinTxt, oddsT10Txt, oddsFdTxt, oddsHrTxt].map(x => (x || '').length + ':' + (x || '').slice(0, 40)).join('|')
    setRunning(true)
    setSimResults(null)
    setPublished(false)
    setTimeout(() => {
      // SS NOISE CALIBRATION (2026-07-11 walk-forward, ALL FOUR MARKETS - BACKTEST_LOG Archive C).
      // Per-series multipliers land each series at its measured Brier optimum (Medium preset):
      //   cup:     16 -> 48 (16 winners in 27 races; every market improves monotonically to ~48-70)
      //   oreilly: 18 -> 27 (win-Brier optimum 23-35, min 28; degrades by 48 - Hill dominance is real)
      //   trucks:  23 -> 40 (9 winners in 11 races; optimum ~35-46; n=8 scoreable, re-tune as sample grows)
      const __SS_NOISE_MULT = { cup: 3.0, oreilly: 1.5, trucks: 1.75 }
      const __simCaution = isSuperspeedway(config?.track_name)
        ? { ...cautionPreset, noise: Math.round(cautionPreset.noise * (__SS_NOISE_MULT[series] || 1)) }
        : cautionPreset
      const results = runRaceSim(driversWithScores, {
        numSims,
        cautionPreset: __simCaution,
        dnfRate: dnfPreset.value,
        totalRaceLaps,
        trackGroup: __trackGroup(config && config.track_name),
        startSampling: (() => {
          const E = []
          driversWithScores.forEach((d, i) => { if (d.__startProjected && d.__startHist && d.__startHist.length >= 3 && d.__spUsed != null) E.push({ i, hist: d.__startHist, fixed: d.__spUsed }) })
          return E.length >= 3 ? { entries: E, w: driversWithScores[0].__spW || 0 } : null
        })(),
      })
      setSimResults(results)
      setRunning(false)
    }, 50)
  }

  const publishResults = async () => {
    if (!simResults || !config) return
    if (!raceNumMap[series] || !parseInt(raceNumMap[series])) {
      alert('Enter a Race # before publishing - published boards and grading join on it.')
      return
    }
    // STAGE GUARD (2026-08-12): a trucks Richmond board went out tagged POST before any
    // practice existed. If stage is post but no practice data is loaded for this race,
    // make the operator confirm - usually it means the stage toggle is wrong.
    if (simStage === 'post') {
      try {
        const __yr = (config && config.race_year) || new Date().getFullYear()
        const { data: __ps } = await supabase.from('practice_sessions').select('id').eq('series', series).eq('race_number', parseInt(raceNumMap[series])).eq('year', __yr).limit(1)
        if (!__ps || !__ps.length) {
          if (!window.confirm('Stage is set to POST but NO practice data is loaded for ' + series + ' race #' + raceNumMap[series] + '.\n\nIf this is a pre-practice board, Cancel and switch the stage to PRE.\n\nPublish as POST anyway?')) return
        }
      } catch (e) {}
    }
    // PUBLISH GUARDS (2026-07-22): empty odds -> blank Market Value; stale odds -> anchors/flags computed on old odds.
    const __oddsTxts = [oddsWinTxt, oddsT10Txt, oddsFdTxt, oddsHrTxt]
    const __oddsHashNow = __oddsTxts.map(x => (x || '').length + ':' + (x || '').slice(0, 40)).join('|')
    if (!__oddsTxts.some(x => (x || '').trim())) {
      if (!window.confirm('No odds are pasted. Market Value will be BLANK and no bets will be flagged or logged. Publish anyway?')) return
    } else if (__runOddsHash.current !== __oddsHashNow) {
      if (!window.confirm('Odds changed since the last Run - market anchors and EV flags reflect the OLD odds. OK = publish anyway, Cancel = go re-run first.')) return
    }
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
      config: { practiceMetric: (series === 'oreilly' ? 'overall_avg' : 'best5'), poolScope: 'series-only', borrowMode: 'car-auto-v2', recencyCw: (series === 'cup' ? 2 : 3), pitCrew: 'v1-0.06-fenced', domCurves: (__trackGroup(config && config.track_name) === 'INT' ? 'int-dom-v2' : 'gxc-v3.1-dnfLL'), domSpeed: 'mult-v1', startProj: ((series === 'cup' || series === 'oreilly') ? 'trail10-v4-form' : 'trail10-v3.5-eqStart'), flagGuard: 'conf-v1', dnfModel: 'wreck-v1.1-cb', marketAnchor: 'v1.4-multimkt', gmv: __groupMarketValue(gDk, gFd, gHr, simResults, simResults && simResults.posMatrix, (simResults && simResults.simN) || 0), lineup: lineupState, rearToStart: Object.keys(rearOverrides).filter(n => rearOverrides[n]), runNote: (runNote.trim() ? runNote.trim() : null), eqOverrides: eqOverrides, weights: weights, caution: cautionPreset, dnf: dnfPreset, rainOut: rainOut, numSims: numSims, totalLaps: totalRaceLaps, stage1Laps: stage1Laps, stage2Laps: stage2Laps, simMatrix: __mtxB64, simMatrixN: __mtxN, simOrder: __mtxOrder },
      results: simResults.map(d => ({
        driver_name:  d.name,
        car_number:   d.carNumber,
        organization: d.organization,
        start_pos:    d.startPos,
        dk_start_pos: d.dkStartPos != null ? d.dkStartPos : null, // qualified spot when a grid penalty moved him; DFS shows this
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
    await supabase.from('sim_results').delete().eq('series', series).eq('stage', simStage).eq('race_year', payload.race_year).eq('race_number', payload.race_number)
    const { error } = await supabase.from('sim_results').insert(payload)
    if (!error) {
      // FULL-RUN MATRIX (2026-08-15): store ALL draws in sim_matrices so Matchup
      // Compare prices custom groups from the same run as the published markets
      // (config carries only a 4k sample - Top Ford 63.6 vs matchup 64.5 wobble).
      // Lazy-loaded by the tray only; board page loads unaffected.
      try {
        if (simResults.posMatrix && simResults.simN && __mtxOrder) {
          const __nD2 = simResults.length
          const __N2 = simResults.simN
          const __pk2 = new Uint8Array(__N2 * __nD2)
          for (let __s2 = 0; __s2 < __N2 * __nD2; __s2++) __pk2[__s2] = simResults.posMatrix[__s2]
          let __b2 = ''
          for (let __i2 = 0; __i2 < __pk2.length; __i2 += 8192) __b2 += String.fromCharCode.apply(null, __pk2.subarray(__i2, __i2 + 8192))
          await supabase.from('sim_matrices').delete().eq('series', series).eq('race_year', payload.race_year).eq('race_number', payload.race_number).eq('stage', simStage)
          await supabase.from('sim_matrices').insert({
            series, race_year: payload.race_year, race_number: payload.race_number,
            stage: simStage, track_name: payload.track_name,
            sim_n: __N2, sim_order: __mtxOrder, matrix_b64: btoa(__b2),
          })
        }
      } catch (eMx) {}
      try {
        const __samp = simResults.__dkSamples, __sdrv = simResults.__sampleDrivers
        if (__samp && __samp.length && __sdrv) {
          await supabase.from('dfs_sim_samples').delete().eq('series', series).eq('race_year', payload.race_year).eq('race_number', payload.race_number)
          await supabase.from('dfs_sim_samples').insert({ series, race_year: payload.race_year, race_number: payload.race_number, track_name: payload.track_name, drivers: __sdrv, samples: __samp })
        }
      } catch (e) {}
      try {
        const __MKTS = [['win', 'win_pct'], ['t3', 'top3_pct'], ['t5', 'top5_pct'], ['t10', 'top10_pct']]
        const __fb = []
        ;(payload.results || []).forEach(d => {
          const mv = d.mv
          if (!mv) return
          __MKTS.forEach(([mk, pf]) => {
            const b = mv[mk]
            if (!b || b.best == null || b.ev == null || b.ev <= 0) return
            // fav cap enforced at write (2026-08-08, operator rule): never log flags shorter
            // than -250 - Blaney t10 -475 class bets are not positions anyone takes
            if (b.best < 0 && b.best < -250) return
            // ev>=10 write-gate REVERTED same day (2026-08-08): sub-10 cohort holds 7 of 13
            // ledger winners (incl. operator's cashed Sawalich/Creed bets, ev 4-6) at -1.33u
            // vs the 10%+ cohort carrying ~all of -58u. Claimed edge is inversely related to
            // realized value - log everything, gate displays/reports only. See #69.
            __fb.push({ series: series, race_year: payload.race_year, race_number: payload.race_number, track_name: payload.track_name, stage: simStage, driver_name: d.driver_name, market: mk, sim_prob: (d[pf] == null ? null : d[pf]), best_price: b.best, book: (b.bb || null), ev: b.ev, mev: (b.mev == null ? null : b.mev), medge: (b.medge == null ? null : b.medge) })
          })
        })
        if (__fb.length) {
          // ONCE-ONLY POSITIONS (2026-08-09): never delete/replace. The FIRST flag for a
          // driver+market is the position, at the price actually available when it first
          // qualified - re-publishes only ADD newly-qualifying positions. Old behavior
          // (delete + reinsert) re-priced every flag on re-publish and wiped voided rows.
          const { data: __ex } = await supabase.from('flagged_bets').select('driver_name,market').eq('series', series).eq('race_year', payload.race_year).eq('race_number', payload.race_number).eq('stage', simStage)
          const __have = new Set((__ex || []).map(x => (x.driver_name || '').toLowerCase() + '|' + x.market))
          const __new = __fb.filter(f => !__have.has((f.driver_name || '').toLowerCase() + '|' + f.market))
          if (__new.length) await supabase.from('flagged_bets').insert(__new)
        }
      } catch (e) {}
      setPublished(true)
    }
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
      const __ocSrc = (simResults && simResults.length ? simResults : rawDrivers)
      if (!__ocSrc || !__ocSrc.length) return null
      const mv = __marketValue(oddsWinTxt, oddsT10Txt, oddsFdTxt, oddsHrTxt, __ocSrc)
      const c = { dk: 0, fd: 0, hr: 0 }
      Object.keys(mv || {}).forEach(k => { const w = mv[k] && mv[k].win; if (w) { if (w.dk != null) c.dk++; if (w.fd != null) c.fd++; if (w.hr != null) c.hr++ } })
      return c
    }, [simResults, rawDrivers, oddsWinTxt, oddsT10Txt, oddsFdTxt, oddsHrTxt])
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
      [key]: Math.max(0, Math.min(1, +((prev[key] || 0) + delta).toFixed(2))),
    }))
  }

  const roadCourse  = config ? isRoadCourse(config.track_name) : false
  const hasQual     = rawDrivers.some(d => d.startPos != null)
  const hasPractice = rawDrivers.some(d => d.lrpTime != null)
  const hasCorr     = rawDrivers.some(d => d.corrAvgFinish != null)

  if (!isAdminUser && !embedded) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="card" style={{ maxWidth: 400 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 10 }}>Staff only</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Sign in with the operator account to access the simulation center.</p>
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
            <span style={{ fontWeight: 700, color: 'var(--accent-text)', fontSize: '1.03rem' }}>
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
                    color: cautionPreset.value === p.value ? '#fff' : 'var(--text-secondary)',
                  }}>{p.label}</button>
                ))}
              </div>
              <div style={hintStyle}>~{cautionPreset.value} cautions &middot; noise width &plusmn;{cautionPreset.noise}{cautionAutoNote ? ' \u00b7 ' + cautionAutoNote : ''}{cautionPreset.value <= 5 ? ' \u00b7 wrecks: calm pool' : cautionPreset.value <= 8 ? ' \u00b7 wrecks: typical pool' : ' \u00b7 wrecks: chaotic pool'} &middot; shapes wrecks, not DNF count</div>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={labelStyle}>DNF Rate</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={{
                  ...presetBtn, background: dnfPreset.auto ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: dnfPreset.auto ? '#fff' : 'var(--text-secondary)',
                }}>Auto</button>
                {DNF_PRESETS.map(p => (
                  <button key={p.label} onClick={() => setDnfPreset(p)} style={{
                    ...presetBtn, background: (!dnfPreset.auto && dnfPreset.value === p.value) ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: (!dnfPreset.auto && dnfPreset.value === p.value) ? '#fff' : 'var(--text-secondary)',
                  }}>{p.label}</button>
                ))}
              </div>
              <div style={hintStyle}>
                {(dnfPreset.value * 100).toFixed(1)}% DNF budget per car \u00b7 spent as correlated wreck events + independent mechanicals (wreck-v1.1)
                {dnfPreset.auto ? (dnfPreset.nTrack > 0
                  ? ' \u00b7 measured from ' + dnfPreset.nTrack + ' prior race' + (dnfPreset.nTrack === 1 ? '' : 's') + ' at this track'
                  : ' \u00b7 no track history \u2192 ' + (config.correlation_label || 'group') + ' rate') : ' \u00b7 manual override'}
              </div>
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
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>S1 ends</span>
                <input type="number" value={stage1Laps} min={0} max={999} onChange={e => setStage1Laps(parseInt(e.target.value) || 0)} style={{ width: 56, padding: '4px 7px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)' }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginLeft: 6 }}>S2 ends</span>
                <input type="number" value={stage2Laps} min={0} max={999} onChange={e => setStage2Laps(parseInt(e.target.value) || 0)} style={{ width: 56, padding: '4px 7px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)' }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>laps</span>
              </div>
              <div style={hintStyle}>Race length feeds the laps-led model. Stage fields are the published stage END laps (e.g. Stages 70/210/350 \u2192 enter 70 and 210) \u2014 captured with the sim for the future caution/pit layer, do not affect results yet.</div>
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
                onClick={() => setWeights(isSuperspeedway(config.track_name) ? (series === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS) : roadCourse ? (series === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS) : (series === 'trucks' && __trackGroup(config.track_name) === 'SHORT') ? TRUCK_SHORT_WEIGHTS : DEFAULT_WEIGHTS)}
                style={{ fontSize: '0.83rem', padding: '2px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>
                Reset {roadCourse ? 'Road Course' : 'Defaults'}
              </button>
            </div>
            {/* EQUIPMENT PRIOR PANEL (task 118 stage 2): renders ONLY affected drivers */}
            {rawDrivers.length > 0 && (() => {
              const thinRows = rawDrivers.filter(d => d.nCorrRaces < 4 && d.equipRating != null)
              const rideRows = rawDrivers.filter(d => d.nCorrRaces >= 4 && d.modalCar && d.carNumber && String(d.carNumber).trim() !== d.modalCar && d.equipRating != null && d.modalEquipRating != null)
              const anyCar = rawDrivers.some(d => d.carNumber)
              const fmt = v => v == null ? '-' : Number(v).toFixed(1)
              return (
                <div style={{ margin: '10px 0', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'flex', gap: 10, alignItems: 'center' }}>Equipment prior{Object.keys(eqOverrides).length > 0 && <button onClick={() => setEqOverrides({})} style={{ fontSize: 11, padding: '1px 6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>reset overrides</button>}</div>
                  {!anyCar ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No car numbers on this roster - load the entry list to activate the equipment prior.</div>
                  ) : thinRows.length === 0 && rideRows.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No drivers affected - full field has established history in their usual rides.</div>
                  ) : (
                    <div style={{ fontSize: 12 }}>
                      {thinRows.length > 0 && (
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Thin history (input fills toward car pool):</div>
                          {thinRows.map(d => (
                            <div key={d.name} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              <span style={{ minWidth: 170 }}>{d.name} <span style={{ color: 'var(--text-muted)' }}>#{String(d.carNumber).trim()}</span></span>
                              <span>own {fmt(d.corrAvgRating)} (n{d.nCorrRaces})</span>
                              <span>car {fmt(d.equipRating)} (n{d.nEquipRaces})</span>
                              <span style={{ color: '#f5c518' }}>{Math.round((1 - Math.min(1, d.nCorrRaces / 4)) * 100)}% equipment</span>
                              <span style={{ color: 'var(--text-muted)' }}>infl <input type="number" min={0} max={150} step={10} value={Math.round((eqOverrides[d.name] != null ? eqOverrides[d.name] : 1) * 100)} onChange={e => setEqOverrides(o => ({ ...o, [d.name]: Math.max(0, Math.min(1.5, (parseFloat(e.target.value) || 0) / 100)) }))} style={{ width: 52, fontSize: 11, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'inherit', padding: '0 3px' }} />%</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {rideRows.length > 0 && (
                        <div>
                          <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Ride change (quarter-strength delta \u00b7 auto-skipped for car-matched drivers):</div>
                          {rideRows.map(d => (
                            <div key={d.name} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              <span style={{ minWidth: 170 }}>{d.name}</span>
                              <span>#{d.modalCar} {fmt(d.modalEquipRating)} (n{d.nModalEquip}) to #{String(d.carNumber).trim()} {fmt(d.equipRating)} (n{d.nEquipRaces})</span>
                              <span style={{ color: 'var(--text-muted)' }}>infl <input type="number" min={0} max={150} step={10} value={Math.round((eqOverrides[d.name] != null ? eqOverrides[d.name] : 1) * 100)} onChange={e => setEqOverrides(o => ({ ...o, [d.name]: Math.max(0, Math.min(1.5, (parseFloat(e.target.value) || 0) / 100)) }))} style={{ width: 52, fontSize: 11, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'inherit', padding: '0 3px' }} />%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
            {rawDrivers.length > 0 && (() => {
              const rearNames = Object.keys(rearOverrides).filter(n => rearOverrides[n])
              const withStart = rawDrivers.filter(d => d.startPos != null && !rearOverrides[d.name]).sort((a, b) => a.startPos - b.startPos)
              const noStart = rawDrivers.filter(d => d.startPos == null && !rearOverrides[d.name])
              return (
                <div style={{ margin: '10px 0', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>To the rear <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11 }}>(forfeited start {'\u2014'} sim scores them as P{rawDrivers.length})</span></div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {rearNames.map(n => (
                      <span key={n} style={{ padding: '2px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'rgba(221,136,68,0.12)', color: '#dd8844', fontSize: 12 }}>
                        {n} <span onClick={() => setRearOverrides(o => { const c = { ...o }; delete c[n]; return c })} style={{ cursor: 'pointer', marginLeft: 4, fontWeight: 700 }}>x</span>
                      </span>
                    ))}
                    <select value="" onChange={e => { const v = e.target.value; if (v) setRearOverrides(o => ({ ...o, [v]: true })) }} style={{ padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 12 }}>
                      <option value="">+ send driver to rear...</option>
                      {withStart.map(d => <option key={d.name} value={d.name}>{d.name} (P{d.startPos})</option>)}
                      {noStart.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
              )
            })()}
            {(() => {
              const ldNames = Object.keys(lapsDownOverrides).filter(n => lapsDownOverrides[n] > 0)
              const avail = rawDrivers.filter(d => !lapsDownOverrides[d.name]).sort((a, b) => (a.startPos || 999) - (b.startPos || 999))
              return (
                <div style={{ margin: '10px 0', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Laps down <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11 }}>(penalty / pass-through - finishes behind the lead lap; ~6%/caution to earn a lap back). Click the count to cycle 1/2/3.</span></div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {ldNames.map(n => (
                      <span key={n} style={{ padding: '2px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'rgba(120,90,220,0.14)', color: '#b79cff', fontSize: 12 }}>
                        {n} <span onClick={() => setLapsDownOverrides(o => ({ ...o, [n]: (o[n] % 3) + 1 }))} style={{ cursor: 'pointer', fontWeight: 700, margin: '0 4px' }}>{lapsDownOverrides[n]}L</span>
                        <span onClick={() => setLapsDownOverrides(o => { const c = { ...o }; delete c[n]; return c })} style={{ cursor: 'pointer', fontWeight: 700 }}>x</span>
                      </span>
                    ))}
                    <select value="" onChange={e => { const v = e.target.value; if (v) setLapsDownOverrides(o => ({ ...o, [v]: 2 })) }} style={{ padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 12 }}>
                      <option value="">+ start a driver laps down...</option>
                      {avail.map(d => <option key={d.name} value={d.name}>{d.name}{d.startPos ? ' (P' + d.startPos + ')' : ''}</option>)}
                    </select>
                  </div>
                </div>
              )
            })()}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { key: 'corrHistory',  label: 'Corr. Track History' },
                { key: 'longRunPace',  label: 'Practice Pace (Best 5 \/ Avg)' },
                { key: 'startPos',     label: 'Starting Position' },
              { key: 'trackHistory', label: 'Track History' },
                { key: 'pitCrew',      label: 'Pit Crew' },
                { key: 'winConversion', label: 'Win Conversion' },
              ].map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 130 }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => adjustWeight(key, -0.05)} style={nudgeBtn}>&#8722;</button>
                    <div style={{ width: 44, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.03rem', color: 'var(--text-primary)' }}>
                      {Math.round((weights[key] || 0) * 100)}%
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
              color: running ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: '1.03rem', cursor: running ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s',
            }}>
              {running && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
              {running ? `Running ${numSims.toLocaleString()} simulations...` : `Run ${numSims.toLocaleString()} Simulations`}
            </button>
            {/* ODDS PASTE moved out of the simResults conditional (2026-07-22): Paste -> Run -> Publish requires the boxes to exist BEFORE the first run (market anchors read odds at run time). */}
            {rawDrivers.length > 0 && (
              <div style={{ marginTop: 12 }}>
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>DK odds - paste incl. the header row (any column order auto-detected)</div>
  <textarea value={oddsWinTxt} onChange={e => setOddsWinTxt(e.target.value)} rows={3} style={{ width: '100%', fontFamily: 'monospace', fontSize: 11 }} />
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 4px' }}>DK odds - Top 10 (paste)</div>
  <textarea value={oddsT10Txt} onChange={e => setOddsT10Txt(e.target.value)} rows={3} style={{ width: '100%', fontFamily: 'monospace', fontSize: 11 }} /> <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 4px' }}>FanDuel odds - full page (paste)</div>
  <textarea value={oddsFdTxt} onChange={e => setOddsFdTxt(e.target.value)} rows={3} style={{ width: '100%', fontFamily: 'monospace', fontSize: 11 }} />
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 4px' }}>Hard Rock odds - full page (paste)</div>
  <textarea value={oddsHrTxt} onChange={e => setOddsHrTxt(e.target.value)} rows={3} style={{ width: '100%', fontFamily: 'monospace', fontSize: 11 }} />
  <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--border)" }}>
    <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700 }}>Group markets - Winning Manufacturer / Winning Team / Top Chevy-Ford-Toyota</div>
    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Paste each book page. DK has no top-make market and Hard Rock has no manufacturer market - blanks there are expected.</div>
  </div>
  <div style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 4px" }}>DK - group markets (paste)</div>
  <textarea value={gDk} onChange={e => setGDk(e.target.value)} rows={3} placeholder="Winning Manufacturer / Winning Team" style={{ width: "100%", fontFamily: "monospace", fontSize: 11, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: 6 }} />
  <div style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 4px" }}>FanDuel - group markets (paste)</div>
  <textarea value={gFd} onChange={e => setGFd(e.target.value)} rows={3} placeholder="Winning Manufacturer of Race / Team Of Winning Driver / Top Chevrolet-Ford-Toyota" style={{ width: "100%", fontFamily: "monospace", fontSize: 11, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: 6 }} />
  <div style={{ fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 4px" }}>Hard Rock - group markets (paste)</div>
  <textarea value={gHr} onChange={e => setGHr(e.target.value)} rows={3} placeholder="Team of Race Winner / Top Chevrolet-Ford-Toyota Car" style={{ width: "100%", fontFamily: "monospace", fontSize: 11, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: 6 }} />
      {oddsCounts ? <div style={{ fontSize: 11, marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[['DK', oddsWinTxt, oddsCounts.dk], ['FD', oddsFdTxt, oddsCounts.fd], ['HR', oddsHrTxt, oddsCounts.hr]].map(bc => (
          <span key={bc[0]} style={{ color: (bc[1] && bc[1].trim() && !bc[2]) ? '#ef4444' : 'var(--text-muted)' }}>{bc[0]}: {bc[2]} parsed{(bc[1] && bc[1].trim() && !bc[2]) ? ' \u26a0' : ''}</span>
        ))}
      </div> : null}
</div>
            )}
            {simResults && (
              <>
<div style={{ marginBottom: 10 }}><label style={{ fontSize: '0.9rem', marginRight: 8, color: 'var(--text-muted)' }}>Race #</label><input type="number" value={raceNumMap[series] || ''} onChange={e => setRaceNumMap(m => ({ ...m, [series]: e.target.value }))} placeholder="e.g. 20" title="Season round number - carried to the Grade Center" style={{ width: 90, padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(128,128,128,0.35)', background: 'transparent', color: 'inherit', boxSizing: 'border-box' }} /></div>
<div style={{ marginBottom: 10, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
  <span style={{ color: 'var(--text-muted)' }}>Sim stage:</span>
  <button onClick={() => setSimStage('pre')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: simStage === 'pre' ? '#e8b923' : 'rgba(128,128,128,0.2)', color: simStage === 'pre' ? '#000' : 'inherit', fontWeight: 600 }}>Pre</button>
  <button onClick={() => setSimStage('post')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: simStage === 'post' ? '#e8b923' : 'rgba(128,128,128,0.2)', color: simStage === 'post' ? '#000' : 'inherit', fontWeight: 600 }}>Post</button>
  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(before / after practice + qualifying) - stored separately, won't overwrite the other stage</span>
</div>
<input value={runNote} onChange={e => setRunNote(e.target.value)} placeholder="Run note - why this (re)run? saved with the board" maxLength={200} style={{ width: 300, marginRight: 10, padding: '9px 11px', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid #3a3d44', borderRadius: 6, fontSize: '0.85rem' }} />
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
            <div style={{ margin: '10px 0 6px', fontSize: '0.8rem' }}>
              <span title="Where the Start column came from when this sim ran" style={{ padding: '3px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: lineupState === 'none' ? '#dd8844' : (lineupState.indexOf('partial') === 0 || lineupState === 'practice fallback') ? '#e8c766' : '#3fb950' }}>
                lineup: {lineupState}
              </span>
            </div>
          )}
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
                        // zero-weight columns hidden per active profile (2026-07-18)
                        { key: null, label: 'Hist',  sortable: false, title: 'Corr. history score', wkey: 'corrHistory' },
                        { key: null, label: 'Prac',  sortable: false, title: 'Practice pace score \u2014 best 5-lap avg (Cup\/Trucks), overall avg (O\'Reilly)', wkey: 'longRunPace' },
                        { key: null, label: 'Start', sortable: false, title: 'Starting pos score', wkey: 'startPos' },
                        { key: null, label: 'Pit', sortable: false, title: 'Pit crew score (season median 4-tire box time)', wkey: 'pitCrew' },
                        { key: null, label: 'Track', sortable: false, title: 'Specific track history score', wkey: 'trackHistory' },
                        { key: null, label: 'Win', sortable: false, title: 'Win conversion score — active only where the preset weights it (O\'Reilly superspeedways)', wkey: 'winConversion' },
                        { key: 'speedScore', label: 'Speed', title: 'Composite speed score' },
                      ].filter(c => !c.wkey || (weights[c.wkey] || 0) > 0) : []),
                    ].map((col, ci) => (
                      <th key={ci} title={col.title}
                        onClick={() => col.sortable !== false && col.key && handleSort(col.key)}
                        style={{
                          padding: '8px 10px', fontWeight: 700, fontSize: '0.8rem',
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                          textAlign: col.left ? 'left' : 'right',
                          color: sortKey === col.key ? 'var(--accent-text)' : 'var(--text-secondary)',
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

                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: ri < 3 ? 'var(--accent-text)' : 'var(--text-primary)' }}>
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
                            {[['corr','corrHistory'],['lrp','longRunPace'],['sp','startPos'],['pit','pitCrew'],['track','trackHistory'],['win','winConversion']].filter(pp => (weights[pp[1]] || 0) > 0).map(pp => pp[0]).map(k => (
                              <td key={k} style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                {row.scores?.[k] != null ? row.scores[k] : '--'}{row.scores && row.scores.anchored && row.scores.anchored[k] ? '*' : ''}
                              </td>
                            ))}
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-text)', fontSize: '0.92rem' }}>
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

          {simResults && <BettingMarkets simResults={simResults} gDk={gDk} gFd={gFd} gHr={gHr} />}

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

// ---------------------------------------------------------------------------
// GROUP MARKETS (2026-07-12): Winning Manufacturer, Winning Team, Top {Make}.
// Kept SEPARATE from __marketValue on purpose: the outcomes are makes/teams (not drivers),
// and the books publish them on different pages. Same de-vig + LEAVE-ONE-OUT consensus.
// BOOK FORMATS OBSERVED (all paste as "Name\n+price"):
//   DK  "Winning Manufacturer" / "Winning Team"                         (no top-make market)
//   FD  "Winning Manufacturer of Race" / "Team Of Winning Driver" / "Top Chevrolet|Ford|Toyota"
//   HR  "Team of Race Winner" / "Top Chevrolet|Ford|Toyota Car"         (no manufacturer market)
// HR lists only ~10 teams plus an "Any Other Team" bucket. That row MUST be counted in the
// de-vig sum (drop it and every listed team gets inflated) but is never a bettable outcome --
// it simply never matches a model row, so it falls out.
// Top-{Make} needs the JOINT matrix (who is the best finisher of that make in each sim);
// it CANNOT be derived from marginal win%.
// ---------------------------------------------------------------------------
// GROUP CONDITION CORRECTION (SHIPPED 2026-07-16; validation log f2267c17: grade bar 0.372->0.404,
// composite bar 24/24 cells). When the fetched practice session carries A/B groups, remove the
// TRACK-STATE component of lrpTime: fit lrpTime ~ corrAvgRating within the session (quality control,
// leak-free -- corrAvgRating is prior races only), take each group's median residual as its condition
// offset, subtract the centered offset. NO-OP when labels are absent, groups < 2, or field too thin.
export function __groupConditionCorrect(drivers) {
  const withG = drivers.filter(d => d.lrpTime != null && d.practiceGroup && d.corrAvgRating != null)
  const gset = [...new Set(withG.map(d => d.practiceGroup))]
  if (gset.length < 2 || withG.length < 20) return drivers
  const x = withG.map(d => d.corrAvgRating), y = withG.map(d => d.lrpTime)
  const n = x.length
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n
  let sxy = 0, sxx = 0
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx) }
  const b = sxx ? sxy / sxx : 0, a0 = my - b * mx
  const med = arr => { const s = [...arr].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] }
  const offs = {}
  gset.forEach(gg => { offs[gg] = med(withG.filter(d => d.practiceGroup === gg).map(d => d.lrpTime - (a0 + b * d.corrAvgRating))) })
  const center = gset.reduce((a, gg) => a + offs[gg], 0) / gset.length
  drivers.forEach(d => {
    if (d.lrpTime != null && d.practiceGroup && offs[d.practiceGroup] != null) {
      d.lrpTime = d.lrpTime - (offs[d.practiceGroup] - center)
    }
  })
  return drivers
}

export function __groupMarketValue(dkTxt, fdTxt, hrTxt, drivers, posMatrix, simN) {
  try {
    var rows = drivers || [];
    if (!rows.length) return null;
    var norm = function (s) { return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.']/g, "").replace(/\s+/g, " ").trim(); };
    var amer = function (l) { var m = (l || "").trim().replace(/[\u2212\u2013\u2014]/g, "-"); return /^[+\-]\d{2,6}$/.test(m) ? parseInt(m, 10) : null; };
    var dec = function (a) { return a > 0 ? a / 100 + 1 : 100 / (-a) + 1; };
    var impl = function (a) { return a > 0 ? 100 / (a + 100) : -a / (-a + 100); };
    var HDRS = [
      [/winning\s+manufacturer|manufacturer\s+of\s+race/i, "mfr"],
      [/winning\s+team|team\s+of\s+(the\s+)?(race\s+)?winner|team\s+of\s+winning\s+driver/i, "team"],
      [/top\s+chevrolet|top\s+chevy/i, "topChevrolet"],
      [/top\s+ford/i, "topFord"],
      [/top\s+toyota/i, "topToyota"]
    ];
    var NOISE = /^(show (less|more)|singles|parlays|live|any driver|odd$|even$|under |over |grid position|car number|\d{1,2}:\d{2})/i;
    var parseGrp = function (txt) {
      var out = { mfr: {}, team: {}, topChevrolet: {}, topFord: {}, topToyota: {} };
      var cur = null, pend = null;
      (txt || "").split("\n").forEach(function (raw) {
        var line = (raw || "").replace(/^[\s*\u2022\-]+/, "").trim();
        if (!line) return;
        var hit = null;
        for (var i = 0; i < HDRS.length; i++) { if (HDRS[i][0].test(line)) { hit = HDRS[i][1]; break; } }
        if (hit) { cur = hit; pend = null; return; }
        if (!cur) return;
        var a = amer(line);
        if (a != null) { if (pend) { out[cur][pend] = a; pend = null; } return; }
        if (NOISE.test(line)) { pend = null; return; }
        pend = line;
      });
      return out;
    };
    var books = { dk: parseGrp(dkTxt), fd: parseGrp(fdTxt), hr: parseGrp(hrTxt) };
    var MKTS = ["mfr", "team", "topChevrolet", "topFord", "topToyota"];
    var model = { mfr: {}, team: {}, topChevrolet: {}, topFord: {}, topToyota: {} };
    rows.forEach(function (r) {
      var mk = ((r.manufacturer || "") + "").trim();
      var tm = ((r.organization || "") + "").trim();
      var w = (r.winPct || 0) / 100;
      if (mk) model.mfr[mk] = (model.mfr[mk] || 0) + w;
      if (tm) model.team[tm] = (model.team[tm] || 0) + w;
    });
    var MAKES = [["Chevrolet", "topChevrolet"], ["Ford", "topFord"], ["Toyota", "topToyota"]];
    var n = rows.length;
    if (posMatrix && simN) {
      MAKES.forEach(function (mm) {
        var mem = rows.filter(function (r) { return ((r.manufacturer || "") + "").trim() === mm[0]; });
        if (!mem.length) return;
        var wins = mem.map(function () { return 0; });
        for (var s = 0; s < simN; s++) {
          var best = 1e9, bi = -1;
          for (var gi = 0; gi < mem.length; gi++) {
            var pos = posMatrix[s * n + mem[gi].simIdx];
            if (pos < best) { best = pos; bi = gi; }
          }
          if (bi >= 0) wins[bi]++;
        }
        mem.forEach(function (d, gi) { model[mm[1]][d.name] = wins[gi] / simN; });
      });
    }
    var dvg = {};
    MKTS.forEach(function (mk) {
      dvg[mk] = {};
      Object.keys(books).forEach(function (bk) {
        var raw = books[bk][mk] || {}; var ks = Object.keys(raw);
        if (!ks.length) return;
        var s = 0; ks.forEach(function (k) { s += impl(raw[k]); });
        if (!s) return;
        dvg[mk][bk] = {}; ks.forEach(function (k) { dvg[mk][bk][norm(k)] = impl(raw[k]) / s; });
      });
    });
    var res = {};
    MKTS.forEach(function (mk) {
      res[mk] = [];
      Object.keys(model[mk]).forEach(function (name) {
        var key = norm(name);
        var px = {};
        Object.keys(books).forEach(function (bk) {
          var raw = books[bk][mk] || {}; var found = null;
          Object.keys(raw).forEach(function (k) { if (norm(k) === key) found = raw[k]; });
          px[bk] = found;
        });
        var p = model[mk][name];
        if (px.dk == null && px.fd == null && px.hr == null) return;
        var best = null, bb = "";
        Object.keys(px).forEach(function (bk) { if (px[bk] != null && (best == null || dec(px[bk]) > dec(best))) { best = px[bk]; bb = bk; } });
        var cons = [];
        Object.keys(books).forEach(function (bk) { if (bk === bb) return; if (dvg[mk][bk] && dvg[mk][bk][key] != null) cons.push(dvg[mk][bk][key]); });
        if (!cons.length) Object.keys(books).forEach(function (bk) { if (dvg[mk][bk] && dvg[mk][bk][key] != null) cons.push(dvg[mk][bk][key]); });
        var consP = cons.length ? cons.reduce(function (a, b) { return a + b; }, 0) / cons.length : null;
        res[mk].push({
          name: name, dk: px.dk, fd: px.fd, hr: px.hr, best: best, bb: bb,
          p: +(p * 100).toFixed(1),
          fair: p > 0 ? (p >= 0.5 ? Math.round(-100 * p / (1 - p)) : Math.round(100 * (1 - p) / p)) : null,
          ev: null, // group markets are INFORMATIONAL: model-edge suppressed, market never validated (2026-07-15)
          mev: (consP != null && best != null) ? +((consP * dec(best) - 1) * 100).toFixed(0) : null,
          medge: null // suppressed with ev (2026-07-15)
        });
      });
      res[mk].sort(function (a, b) { return (b.p || 0) - (a.p || 0); });
    });
    return res;
  } catch (e) { return null; }
}

function BettingMarkets({ simResults, gDk, gFd, gHr }) {
  const [gA, setGA] = useState([])
  const [gB, setGB] = useState([])
  const [resA, setResA] = useState(null)
  const [resB, setResB] = useState(null)
  const rows = simResults || []
  const n = rows.length
  const posMatrix = simResults && simResults.posMatrix
  const simN = (simResults && simResults.simN) || 0
  const gmv = useMemo(function () {
    if (!gDk && !gFd && !gHr) return null
    return __groupMarketValue(gDk, gFd, gHr, rows, posMatrix, simN)
  }, [gDk, gFd, gHr, rows, posMatrix, simN])
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
      <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 4px" }}>Group market odds</h2>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
          Paste each book page (Winning Manufacturer / Winning Team / Top Chevrolet-Ford-Toyota). DK has no top-make market and Hard Rock has no manufacturer market - blank columns there are expected.
        </div>
        {gmv && [["mfr", "Winning Manufacturer"], ["team", "Winning Team"], ["topChevrolet", "Top Chevrolet"], ["topFord", "Top Ford"], ["topToyota", "Top Toyota"]].map(function (m) {
          var list = (gmv[m[0]] || []).filter(function (r) { return r.best != null })
          if (!list.length) return null
          var fo = function (a) { return a == null ? "-" : (a > 0 ? "+" + a : "" + a) }
          return (
            <div key={m[0]} style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, margin: "0 0 6px" }}>{m[1]}</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead><tr>
                  {["", "Model", "Fair", "DK", "FD", "HR", "Best", "Edge", "mev", "medge"].map(function (h, i) {
                    return <th key={i} style={{ padding: "5px 6px", color: "#8a8a8a", fontSize: 11, textAlign: i === 0 ? "left" : "right", borderBottom: "0.5px solid #333" }}>{h}</th>
                  })}
                </tr></thead>
                <tbody>
                  {list.map(function (r) {
                    return (
                      <tr key={r.name}>
                        <td style={{ padding: "5px 6px" }}>{r.name}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right" }}>{r.p}%</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", color: "#888" }}>{fo(r.fair)}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", color: r.bb === "dk" ? "#3fb950" : "#888" }}>{fo(r.dk)}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", color: r.bb === "fd" ? "#3fb950" : "#888" }}>{fo(r.fd)}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", color: r.bb === "hr" ? "#3fb950" : "#888" }}>{fo(r.hr)}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700 }}>{fo(r.best)}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right" }}>{r.ev == null ? "-" : <span style={{ background: r.ev >= 10 ? "#123d24" : "transparent", color: r.ev >= 10 ? "#3fb950" : "#888", padding: "1px 6px", borderRadius: 4 }}>{(r.ev > 0 ? "+" : "") + r.ev}%</span>}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", color: (r.mev != null && r.mev > 0) ? "#3fb950" : "#888" }}>{r.mev == null ? "-" : (r.mev > 0 ? "+" : "") + r.mev + "%"}</td>
                        <td style={{ padding: "5px 6px", textAlign: "right", color: (r.medge != null && r.medge > 0) ? "#3fb950" : "#e74c3c" }}>{r.medge == null ? "-" : (r.medge > 0 ? "+" : "") + r.medge}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
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

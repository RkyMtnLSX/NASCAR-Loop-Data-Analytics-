// redeploy nudge 1784478835019
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/fetchAllRows'
import { gradeColor, parseStints, percentileGrade } from '../lib/practiceGrader'

const SERIES_COLOR = { cup: 'var(--series-cup)', xfinity: 'var(--series-oreilly)', trucks: 'var(--series-trucks)' }
const SERIES_TABS = [
  { value: 'cup',      label: 'Cup Series' },
  { value: 'xfinity',  label: "O'Reilly Series" },
  { value: 'trucks',   label: 'Truck Series' },
]

const GROUP_COLORS = {
  A: { bg: '#1A5276', text: '#ffffff' },
  B: { bg: '#6E2F8D', text: '#ffffff' },
}

// ── REPORT CARDS (2026-10-17, operator: "what if they actually looked like report cards?") ──────────
// One paper card per driver: the session grade as a red-ink stamp, four "subjects" graded by rank in
// the field (same percentile ladder as the overall grade), a one-line comment built from those marks,
// laps / runs / tyre sets as the attendance line. The table stays one click away for the numbers.
const SUBJECTS = [
  { key: 'best_lap',  label: 'Raw speed',  tip: 'Single fastest lap', fmt: v => v.toFixed(3) },
  { key: 'avg_pace',  label: 'Run pace',   tip: 'Average of each run\'s average lap', fmt: v => v.toFixed(3) },
  { key: '__long',    label: 'Long run',   tip: 'Best 20-lap average (15 / 10 when no 20-lap run)', fmt: (v, r) => v.toFixed(2) + (r.__longN ? ' (' + r.__longN + ')' : '') },
  { key: '__falloff', label: 'Tire life',  tip: 'Seconds lost from the best 5-lap run to the best 20-lap run - less is better', fmt: v => '+' + v.toFixed(2) + 's' },
]
function subjectRows(rows) {
  const out = rows.map(r => {
    const longN = r.best20 != null ? 20 : r.best15 != null ? 15 : r.best10 != null ? 10 : null
    const long = longN ? r['best' + longN] : null
    const fall = r.best5 != null && r.best20 != null ? Math.max(0, r.best20 - r.best5) : null
    return { ...r, __long: long, __longN: longN, __falloff: fall }
  })
  SUBJECTS.forEach(sub => {
    const vals = out.map(r => r[sub.key]).filter(v => v != null)
    const n = vals.length
    out.forEach(r => {
      const v = r[sub.key]
      if (v == null || n < 3) { r['__g_' + sub.key] = null; return }
      const rank = vals.filter(x => x < v).length + 1
      r['__g_' + sub.key] = percentileGrade(rank, n)
      r['__r_' + sub.key] = rank
    })
  })
  return out
}
const GRADE_RANK = { 'A+': 0, 'A': 1, 'A-': 2, 'B+': 3, 'B': 4, 'B-': 5, 'C+': 6, 'C': 7, 'C-': 8, 'D': 9, 'F': 10 }
function commentFor(r, pos, n) {
  const g = k => r['__g_' + k]; const rk = k => GRADE_RANK[g(k)]
  const parts = []
  if (pos === 1) parts.push('Top of the class.')
  else if (pos <= 3) parts.push('Honor roll.')
  if (g('best_lap') != null && g('__long') != null) {
    if (rk('best_lap') <= 2 && rk('__long') >= 6) parts.push('Flashes on new tires, fades over a run.')
    else if (rk('best_lap') >= 6 && rk('__long') <= 2) parts.push('Quiet one-lap speed, strong over the long run.')
    else if (rk('best_lap') <= 2 && rk('__long') <= 2) parts.push('Fast everywhere - speed and stamina.')
  }
  if (g('__falloff') != null && rk('__falloff') >= 8) parts.push('Tire fall-off is the worry.')
  else if (g('__falloff') != null && rk('__falloff') <= 1) parts.push('Takes care of the tires.')
  if (r.__long == null) parts.push('No long run - unknown on tire life.')
  if ((r.num_stints || 0) <= 1 && (r.total_laps || 0) < 10) parts.push('Barely on track.')
  if (!parts.length) parts.push(pos > n * 0.7 ? 'Needs to find speed before Sunday.' : 'Solid, unremarkable session.')
  return parts.slice(0, 2).join(' ')
}
function ReportCards({ rows, series, session, isSubscriber }) {
  const graded = subjectRows(rows)
  const n = graded.length
  const visible = isSubscriber ? graded : graded.slice(0, 10)
  const carDir = series === 'cup' ? '/car-numbers/' : series === 'trucks' ? '/car-numbers-trucks/' : '/car-numbers-oreilly/'
  const stripe = SERIES_COLOR[series]
  const label = SERIES_TABS.find(t => t.value === series)?.label || ''
  return (
    <div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Special+Elite&display=swap');
        .rc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }
        .rc-card { position: relative; background: linear-gradient(180deg, #f7f2e4 0%, #efe7d2 100%); color: #2a241c; border-radius: 6px; box-shadow: 0 10px 28px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(0,0,0,0.08); overflow: hidden; font-family: 'Special Elite', 'DM Mono', monospace; transition: transform .15s ease, box-shadow .15s ease; }
        .rc-card:hover { transform: translateY(-3px) rotate(-0.3deg); box-shadow: 0 16px 36px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.08); }
        .rc-card::before { content: ''; position: absolute; left: 34px; top: 0; bottom: 0; width: 1px; background: rgba(200,60,60,0.35); }
        .rc-card::after { content: ''; position: absolute; inset: 0; background-image: repeating-linear-gradient(180deg, transparent 0 27px, rgba(70,110,170,0.13) 27px 28px); background-position: 0 92px; pointer-events: none; }
        .rc-head { padding: 10px 14px 8px 44px; border-bottom: 2px solid rgba(0,0,0,0.12); display: flex; align-items: center; gap: 10px; position: relative; z-index: 1; }
        .rc-stripe { position: absolute; left: 0; top: 0; bottom: 0; width: 6px; }
        .rc-name { font-size: 1.15rem; font-weight: 700; letter-spacing: 0.01em; line-height: 1.1; }
        .rc-sub { font-size: 0.72rem; color: #6b6052; letter-spacing: 0.06em; text-transform: uppercase; margin-top: 2px; }
        .rc-stamp { position: absolute; right: 12px; top: 10px; width: 64px; height: 64px; border: 3px solid; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Caveat', cursive; font-weight: 700; font-size: 2.1rem; transform: rotate(-12deg); opacity: 0.92; mix-blend-mode: multiply; z-index: 2; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.35); }
        .rc-stamp small { position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%) rotate(0deg); font-family: 'DM Mono', monospace; font-size: 0.62rem; color: #6b6052; letter-spacing: 0.04em; white-space: nowrap; }
        .rc-body { padding: 10px 14px 12px 44px; position: relative; z-index: 1; }
        .rc-row { display: flex; align-items: baseline; justify-content: space-between; height: 28px; font-size: 0.86rem; }
        .rc-row .k { color: #4a4036; }
        .rc-row .v { font-family: 'DM Mono', monospace; font-size: 0.78rem; color: #6b6052; margin-left: auto; margin-right: 10px; }
        .rc-row .g { font-family: 'Caveat', cursive; font-weight: 700; font-size: 1.45rem; width: 34px; text-align: center; line-height: 1; }
        .rc-comment { margin-top: 8px; font-family: 'Caveat', cursive; font-size: 1.22rem; line-height: 1.15; color: #1d3e8a; min-height: 2.3em; }
        .rc-foot { display: flex; justify-content: space-between; font-family: 'DM Mono', monospace; font-size: 0.68rem; color: #7a6f60; padding: 6px 14px 10px 44px; border-top: 1px dashed rgba(0,0,0,0.18); position: relative; z-index: 1; }
        .rc-rank { position: absolute; left: 8px; top: 10px; width: 20px; text-align: center; font-family: 'DM Mono', monospace; font-size: 0.72rem; color: #9a8f80; z-index: 1; }
        .rc-start { font-family: 'DM Mono', monospace; font-size: 0.72rem; color: #6b6052; }
      `}</style>
      <div className="rc-grid">
        {visible.map((r, i) => {
          const ink = r.practice_grade && /^A/.test(r.practice_grade) ? '#1e7a3c' : r.practice_grade && /^B/.test(r.practice_grade) ? '#1d4f8a' : r.practice_grade && /^C/.test(r.practice_grade) ? '#8a6a0f' : '#b3261e'
          let notes = null; try { notes = JSON.parse(r.notes || 'null') } catch (e) { notes = null }
          return (
            <div className="rc-card" key={r.id}>
              <div className="rc-stripe" style={{ background: stripe }} />
              <div className="rc-rank">{i + 1}</div>
              <div className="rc-head">
                {r.car_number ? <img src={carDir + r.car_number + '.png'} alt={'#' + r.car_number} style={{ height: 34 }} onError={e => { e.target.style.display = 'none' }} /> : null}
                <div style={{ minWidth: 0, paddingRight: 70 }}>
                  <div className="rc-name">{r.driver_name}</div>
                  <div className="rc-sub">{label} &middot; {session.track_name}{r.practice_group ? ' · Group ' + r.practice_group : ''}</div>
                  <div className="rc-start">{r.qualifying_position == null ? '' : r.qualifying_position < 0 ? 'DNQ' : 'Starts P' + r.qualifying_position}</div>
                </div>
              </div>
              <div className="rc-stamp" style={{ color: ink, borderColor: ink }} title={'Practice score ' + (r.practice_score != null ? r.practice_score.toFixed(1) : '-')}>
                {r.practice_grade || '-'}
                <small>{r.practice_score != null ? r.practice_score.toFixed(1) + ' / 100' : ''}</small>
              </div>
              <div className="rc-body">
                {SUBJECTS.map(sub => {
                  const g = r['__g_' + sub.key], v = r[sub.key]
                  const c = g ? gradeColor(g) : null
                  return (
                    <div className="rc-row" key={sub.key} title={sub.tip + (r['__r_' + sub.key] ? ' · ranked ' + r['__r_' + sub.key] + ' of ' + n : '')}>
                      <span className="k">{sub.label}</span>
                      <span className="v">{v != null ? sub.fmt(v, r) : '—'}</span>
                      <span className="g" style={{ color: c ? c.bg : '#9a8f80' }}>{g || '–'}</span>
                    </div>
                  )
                })}
                <div className="rc-comment">&ldquo;{commentFor(r, i + 1, n)}&rdquo;</div>
              </div>
              <div className="rc-foot">
                <span>{r.total_laps != null ? r.total_laps + ' laps' : ''}{r.num_stints != null ? ' · ' + r.num_stints + ' run' + (r.num_stints === 1 ? '' : 's') : ''}{notes && notes.sets ? ' · sets ' + notes.sets : ''}</span>
                <span>PitBoard</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PracticeReportCard({ isSubscriber }) {
  const [series, setSeries]     = useState('cup')
  const [sessions, setSessions] = useState([])
  const [selected, setSelected] = useState(null)
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [view, setView] = useState('cards')   // 2026-10-17: report cards by default, table one click away
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const sortBy = (k) => { if (k === sortKey) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') } else { setSortKey(k); setSortDir('asc') } }
  const sortArrow = (k) => k === sortKey ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''

  // Load distinct sessions for this series
  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      setRows([])
      setSelected(null)

      // O'Reilly Series includes both 'xfinity' and 'oreilly' series codes
      const seriesValues = series === 'xfinity' ? ['xfinity', 'oreilly'] : [series]
            // Use get_practice_sessions RPC (queries practice_laps) to get most recently uploaded session
      const rpcResults = await Promise.all(
        seriesValues.map(sv => supabase.rpc('get_practice_sessions', { p_series: sv }))
      )

      const allSessions = []
      for (const { data: rData, error: rErr } of rpcResults) {
        if (rErr) { setError(rErr.message); setLoading(false); return }
        for (const row of (rData || [])) {
          const key = `${row.year}|${row.track_name}|${row.session_number}`
          if (!allSessions.find(s => s.key === key)) {
            allSessions.push({ ...row, key })
          }
        }
      }

      const unique = allSessions.slice(0, 1)
      // Double-visit tracks share (year, track, session) — resolve the LATEST upload's race_number so
      // the card never interleaves two races' batches (Phoenix oreilly 2025 R4/R33 incident, 2026-07-17).
      for (const s of unique) {
        const { data: rn } = await supabase.from('practice_sessions')
          .select('race_number, created_at').eq('series', s.series).eq('year', s.year)
          .eq('track_name', s.track_name).eq('session_number', s.session_number)
          .order('created_at', { ascending: false }).limit(1)
        s.race_number = rn && rn.length ? rn[0].race_number : null
      }
      setSessions(unique)
      if (unique.length > 0) setSelected(unique[0].key)
      setLoading(false)
    }
    load()
  }, [series])

  // Load rows for selected session
  useEffect(() => {
    if (!selected) { setRows([]); return }
    const session = sessions.find(s => s.key === selected)
    if (!session) return

    async function loadRows() {
      setLoading(true)
      const { data, error } = await supabase
        .from('practice_sessions')
        .select('*')
        .eq('series', session.series)
        .eq('year', session.year)
        .eq('track_name', session.track_name)
        .eq('session_number', session.session_number)
        .eq('race_number', session.race_number)
        .order('practice_score', { ascending: false, nullsFirst: false })

      if (error) { setError(error.message); setLoading(false); return }
      let out = data || []
      // CAR FALLBACK (2026-07-17): sheets often lack a Car column -> practice_sessions.car_number null.
      // loop_data carries car numbers for completed races; merge for DISPLAY only.
      try {
        if (!out.some(r => r.car_number) || !out.some(r => r.qualifying_position != null)) {
          const nn = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').replace(/\s+/g, ' ').trim()
          const { data: lc } = await supabase.from('loop_data')
            .select('driver_name, car_number, start_position')
            .eq('series', session.series).eq('year', session.year)
            .eq('track_name', session.track_name)
          const m = {}
          const ms = {}
          ;(lc || []).forEach(e => { const k = nn(e.driver_name); if (e.car_number != null && !m[k]) m[k] = e.car_number; if (e.start_position != null && ms[k] == null) ms[k] = e.start_position })
          out = out.map(r => ({ ...r, car_number: r.car_number || m[nn(r.driver_name)] || null, qualifying_position: r.qualifying_position != null ? r.qualifying_position : (ms[nn(r.driver_name)] != null ? ms[nn(r.driver_name)] : null) }))
          // CAR FALLBACK stage 2 (2026-08-12): race not run yet -> loop_data has nothing
          // at this track. Use the latest published sim board's lineup (entry-list sourced),
          // then season-wide loop_data (numbers are stable within a season).
          if (!out.every(r => r.car_number)) {
            const { data: sb } = await supabase.from('sim_results')
              .select('results')
              .eq('series', session.series).eq('race_year', session.year)
              .eq('track_name', session.track_name)
              .order('published_at', { ascending: false }).limit(1)
            const m2 = {}
            ;((((sb || [])[0] || {}).results) || []).forEach(e => { const k = nn(e.driver_name); if (e.car_number != null && !m2[k]) m2[k] = e.car_number })
            out = out.map(r => ({ ...r, car_number: r.car_number || m2[nn(r.driver_name)] || null }))
          }
          if (!out.every(r => r.car_number)) {
            const { data: ly } = await supabase.from('loop_data')
              .select('driver_name, car_number')
              .eq('series', session.series).eq('year', session.year)
            const m3 = {}
            ;(ly || []).forEach(e => { const k = nn(e.driver_name); if (e.car_number != null) m3[k] = e.car_number })
            out = out.map(r => ({ ...r, car_number: r.car_number || m3[nn(r.driver_name)] || null }))
          }
        }
      } catch (e2) {}
      // 10/15/20-lap sustained averages from raw practice_laps (display only, falloff included)
      try {
        // PAGINATED 2026-09-02 (review). Unbounded read against the 5,000-row cap; worst session
        // today is 3,866 laps (same headroom as LapComparison). A long session would silently lose
        // laps and the sustained averages would be computed from a partial run.
        const { data: __pl } = await fetchAllRows(() => supabase.from('practice_laps')
          .select('driver_name, lap_number, lap_time, est')
          .eq('series', session.series).eq('year', session.year)
          .eq('track_name', session.track_name).eq('session_number', session.session_number)
          .eq('race_number', session.race_number))   // 2026-10-04: double-visit tracks - spring Vegas laps were merged into fall's N-lap windows
        const __byDrv = {}
        ;(__pl || []).forEach(l => { const k = l.driver_name; (__byDrv[k] = __byDrv[k] || []).push([+l.lap_number, +l.lap_time, l.est ? 1 : 0]) })
        const __lapAvgs = (arr) => {
          const laps = arr.filter(([n, tt]) => !isNaN(n) && !isNaN(tt) && tt > 10 && tt < 1200).sort((a, b) => a[0] - b[0])
          const res = {}
          if (!laps.length) return res
          // 2026-10-04 (operator: "why are those averages so high? Elliott 51.17 5-lap, Blaney 38 15-lap"):
          // runs were split on lap-NUMBER gaps only, so a numbered pit / in-out lap (51-136 s) sat inside a
          // run and every N-lap window across it averaged it in. Use the grader's splitter: a lap over
          // 1.2 x the driver's median ends the run and is dropped (parseStints), same rule the grade uses.
          const stints = parseStints(Object.fromEntries(laps.map(([n2, t2]) => [n2, t2])))
          const estOf = {}; laps.forEach(([n2, , e2]) => { if (e2) estOf[n2] = 1 })
          // NASCAR method: best (fastest) average over N consecutive laps within a single run.
          // 2026-10-04: a window holding a watcher-ESTIMATED lap (feed skipped it; the lap is an even split
          // of two) is a smoothed number. Prefer windows with no estimate; if none exists for this N, fall
          // back to the best estimated window and mark it (best{N}Est = true -> shown with a ~).
          ;[5, 10, 15, 20, 25, 30].forEach(N => {
            let best = null, bestAny = null
            for (const s of stints) { if (s.length < N) continue
              for (let i = 0; i + N <= s.length; i++) { let sum = 0, hasEst = false; for (let j = 0; j < N; j++) { sum += s[i + j][1]; if (estOf[s[i + j][0]]) hasEst = true }
                const a = sum / N; if (bestAny === null || a < bestAny) bestAny = a; if (!hasEst && (best === null || a < best)) best = a } }
            if (best !== null) res['best' + N] = best
            else if (bestAny !== null) { res['best' + N] = bestAny; res['best' + N + 'Est'] = true }
          })
          return res
        }
        out = out.map(r => ({ ...r, ...__lapAvgs(__byDrv[r.driver_name] || []) }))
      } catch (e3) {}
      setRows(out)
      setLoading(false)
    }
    loadRows()
  }, [selected, sessions])

  const _sorted = sortKey ? [...rows].sort((a, b) => { const av = a[sortKey], bv = b[sortKey]; if (av == null && bv == null) return 0; if (av == null) return 1; if (bv == null) return -1; return sortDir === 'asc' ? av - bv : bv - av }) : rows
  const visibleRows = isSubscriber ? _sorted : _sorted.slice(0, 10)
  const blurred     = !isSubscriber && rows.length > 10
  const _heatKeys = ['best5', 'best10', 'best15', 'best20', 'best25', 'best30']
  const _heatStats = {}
  _heatKeys.forEach(k => { const v = rows.map(r => r[k]).filter(x => x != null); _heatStats[k] = v.length ? { min: Math.min(...v), max: Math.max(...v) } : null })
  const heatBg = (val, k) => { const s = _heatStats[k]; if (val == null || !s || s.max === s.min) return 'transparent'; const tn = (val - s.min) / (s.max - s.min); return 'hsla(' + (130 - 130 * tn) + ', 58%, 46%, 0.6)' }

  // Check if this session has group or car number data
  const hasGroup     = rows.some(r => r.practice_group)
  const hasCarNumber = rows.some(r => r.car_number)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Practice Report Cards</h1>
        <p className="page-subtitle">Practice performance ranked as a percentile of the field</p>
      </div>

      {/* Series tabs */}
      <div className="tabs">
        {SERIES_TABS.map(t => (
          <button
            key={t.value}
            className={`tab ${series === t.value ? 'active' : ''}`}
            style={series === t.value ? { background: SERIES_COLOR[t.value], color: t.value === 'trucks' ? '#111' : '#fff', borderColor: 'transparent' } : undefined}
            onClick={() => setSeries(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Session selector */}
      {sessions.length > 0 && (
        <div style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sessions.map(s => (
            <button
              key={s.key}
              onClick={() => setSelected(s.key)}
              className="btn btn-secondary"
              style={{
                fontSize: '0.89rem',
                padding: '5px 12px',
                background:   selected === s.key ? 'var(--bg-elevated)' : 'transparent',
                color:        selected === s.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderColor:  selected === s.key ? 'var(--accent)60'     : 'var(--border)',
              }}
            >
              {s.track_name} {s.year}{s.race_number != null ? ' \u00B7 R' + s.race_number : ''} &middot; S{s.session_number}
            </button>
          ))}
        </div>
      )}

      {/* Loading / error / empty */}
      {loading && (
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p>Loading...</p>
        </div>
      )}
      {!loading && error && (
        <div className="empty-state">
          <h3>Error loading data</h3>
          <p style={{ fontSize: '0.89rem', fontFamily: 'var(--font-mono)' }}>{error}</p>
        </div>
      )}
      {!loading && !error && sessions.length === 0 && (
        <div className="empty-state">
          <h3>No practice sessions yet</h3>
          <p>Practice data for {SERIES_TABS.find(t => t.value === series)?.label} will appear here once uploaded.</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ display: 'inline-flex', gap: 4, marginBottom: 14, padding: 3, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          {[['cards', 'Report cards'], ['table', 'Table']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: view === v ? 700 : 500, background: view === v ? 'var(--bg-elevated)' : 'transparent', color: view === v ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{l}</button>
          ))}
        </div>
      )}
      {!loading && rows.length > 0 && view === 'cards' && (
        <div style={{ position: 'relative' }}>
          <ReportCards rows={_sorted} series={series} session={sessions.find(x => x.key === selected) || {}} isSubscriber={isSubscriber} />
          {blurred && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 220, background: 'linear-gradient(to bottom, transparent, var(--bg-base) 75%)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.96rem', color: 'var(--text-secondary)', marginBottom: 10 }}>Subscribe to see every driver&rsquo;s card</p>
                <a href="/subscribe" className="btn btn-primary" style={{ fontSize: '0.89rem', padding: '6px 18px' }}>Get Full Access</a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {!loading && rows.length > 0 && view === 'table' && (
        <div style={{ position: 'relative' }}>
          <div className="table-wrap">
            <style>{`
              .th-tip { position: relative; cursor: help; text-decoration: underline dotted rgba(255,255,255,0.3); text-underline-offset: 3px; }
              .th-tip:hover::after { content: attr(data-tip); position: absolute; left: 50%; top: 100%; transform: translateX(-50%); margin-top: 8px; z-index: 30; width: 190px; padding: 9px 11px; background: #16181d; color: #e8e8e8; border: 1px solid #3a3d44; border-radius: 8px; font-size: 0.72rem; font-weight: 400; line-height: 1.4; letter-spacing: normal; text-transform: none; text-decoration: none; white-space: normal; text-align: left; box-shadow: 0 6px 20px rgba(0,0,0,0.55); pointer-events: none; }
              .th-tip:hover::before { content: ''; position: absolute; left: 50%; top: 100%; transform: translateX(-50%); margin-top: 3px; border: 5px solid transparent; border-bottom-color: #3a3d44; z-index: 30; }
            `}</style>
            {visibleRows.length > 0 && visibleRows[0].tire_sets != null && (
              <div style={{ margin: '4px 0 10px', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                Practice Tire Allocation: <strong>{visibleRows[0].tire_sets} set{visibleRows[0].tire_sets > 1 ? 's' : ''}</strong>
              </div>
            )}
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  {hasCarNumber && <th style={{ width: 52 }}>Car</th>}
                  <th className="left">Driver</th>
                  {hasGroup && <th style={{ width: 60 }}>Group</th>}
                  <th className="th-tip" data-tip="Starting position for this race.">Start</th>
                  <th className="th-tip" data-tip="Overall practice grade — blends avg run pace (40%), best 5-lap speed (40%) and long-run pace (20%). Every lap is tire-corrected (normalized to equal tire age using the session's falloff rate) before ranking, so fresh-tire bursts don't out-grade long-run pace. No long run counts against the grade - winning cars sustain pace.">Grade</th>
                  <th className="th-tip" data-tip="Letter-aligned score: A+ 97-100, A 93-96.9 ... F 40-59.9. The session's top car is always 100.">Score</th>
                  <th className="th-tip" data-tip="Single fastest lap of the session - raw one-lap speed." onClick={() => sortBy('best_lap')} style={{ cursor: 'pointer' }}>Best Lap{sortArrow('best_lap')}</th>
                  <th className="th-tip" data-tip="Average of each run's average lap time - each run weighted equally, so one short outlier run can swing it. Lower is faster." onClick={() => sortBy('avg_pace')} style={{ cursor: 'pointer' }}>Avg Pace{sortArrow('avg_pace')}</th>
                  <th className="th-tip" data-tip="Simple average of every clean lap - each lap weighted equally, so a short outlier run barely moves it. Lower is faster." onClick={() => sortBy('overall_avg')} style={{ cursor: 'pointer' }}>All Laps{sortArrow('overall_avg')}</th>
                  <th className="th-tip" data-tip="Number of separate runs (stints) the driver made in the session." onClick={() => sortBy('num_stints')} style={{ cursor: 'pointer' }}># Stints{sortArrow('num_stints')}</th>
                  <th className="th-tip" data-tip="Best 5 consecutive laps (fastest 5-lap run average)." onClick={() => sortBy('best5')} style={{ cursor: 'pointer' }}>5-Lap{sortArrow('best5')}</th>
                  <th className="th-tip" data-tip="Best 10 consecutive laps." onClick={() => sortBy('best10')} style={{ cursor: 'pointer' }}>10-Lap{sortArrow('best10')}</th>
                  <th className="th-tip" data-tip="Best 15 consecutive laps." onClick={() => sortBy('best15')} style={{ cursor: 'pointer' }}>15-Lap{sortArrow('best15')}</th>
                  <th className="th-tip" data-tip="Best 20 consecutive laps." onClick={() => sortBy('best20')} style={{ cursor: 'pointer' }}>20-Lap{sortArrow('best20')}</th>
                  <th className="th-tip" data-tip="Best 25 consecutive laps." onClick={() => sortBy('best25')} style={{ cursor: 'pointer' }}>25-Lap{sortArrow('best25')}</th>
                  <th className="th-tip" data-tip="Best 30 consecutive laps. Blank = no run this long. Times climbing left-to-right = the car falls off on long runs." onClick={() => sortBy('best30')} style={{ cursor: 'pointer' }}>30-Lap{sortArrow('best30')}</th>
                  <th className="th-tip" data-tip="Representative green-flag laps used in grading versus total laps run.">Graded Laps</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((d, i) => {
                  const gc      = d.practice_grade ? gradeColor(d.practice_grade) : { bg: '#333', text: '#fff' }
                  const grpColors = d.practice_group ? (GROUP_COLORS[d.practice_group] || { bg: '#555', text: '#fff' }) : null
                  return (
                    <tr key={d.id}>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.89rem' }}>
                        {i + 1}
                      </td>
                      {hasCarNumber && (
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.96rem' }}>
                          {d.car_number && (series === 'cup' || series === 'oreilly' || series === 'trucks') ? <img src={(series === 'cup' ? '/car-numbers/' : series === 'oreilly' ? '/car-numbers-oreilly/' : '/car-numbers-trucks/') + d.car_number + '.png'} alt={'#' + d.car_number} style={{ height: 28, verticalAlign: 'middle' }} /> : '-'}
                        </td>
                      )}
                      <td className="left" style={{ fontWeight: i < 3 ? 600 : 400 }}>
                        {d.driver_name}
                      </td>
                      {hasGroup && (
                        <td>
                          {grpColors ? (
                            <span className="grade-pill" style={{ background: grpColors.bg, color: grpColors.text, fontSize: '0.83rem', padding: '2px 8px' }}>
                              {d.practice_group}
                            </span>
                          ) : '-'}
                        </td>
                      )}
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {d.qualifying_position == null ? '-' : d.qualifying_position < 0 ? 'DNQ' : d.qualifying_position}
                      </td>
                      <td>
                        <span className="grade-pill" style={{ background: gc.bg, color: gc.text }}>
                          {d.practice_grade || '-'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {d.practice_score?.toFixed(1) || '-'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{d.best_lap?.toFixed(3) || '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{d.avg_pace?.toFixed(3) || '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{d.overall_avg?.toFixed(3) || '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{d.num_stints ?? '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#f0f0f0', background: heatBg(d.best5, 'best5') }}>{d.best5 ? (d.best5Est ? <span title="Includes a watcher-estimated lap (feed skipped it) - no clean 5-lap run exists">~{d.best5.toFixed(2)}</span> : d.best5.toFixed(2)) : '-'}</td>
                       <td style={{ fontFamily: 'var(--font-mono)', color: '#f0f0f0', background: heatBg(d.best10, 'best10') }}>{d.best10 ? (d.best10Est ? <span title="Includes a watcher-estimated lap (feed skipped it) - no clean 10-lap run exists">~{d.best10.toFixed(2)}</span> : d.best10.toFixed(2)) : '-'}</td>
                       <td style={{ fontFamily: 'var(--font-mono)', color: '#f0f0f0', background: heatBg(d.best15, 'best15') }}>{d.best15 ? (d.best15Est ? <span title="Includes a watcher-estimated lap (feed skipped it) - no clean 15-lap run exists">~{d.best15.toFixed(2)}</span> : d.best15.toFixed(2)) : '-'}</td>
                       <td style={{ fontFamily: 'var(--font-mono)', color: '#f0f0f0', background: heatBg(d.best20, 'best20') }}>{d.best20 ? (d.best20Est ? <span title="Includes a watcher-estimated lap (feed skipped it) - no clean 20-lap run exists">~{d.best20.toFixed(2)}</span> : d.best20.toFixed(2)) : '-'}</td>
                       <td style={{ fontFamily: 'var(--font-mono)', color: '#f0f0f0', background: heatBg(d.best25, 'best25') }}>{d.best25 ? (d.best25Est ? <span title="Includes a watcher-estimated lap (feed skipped it) - no clean 25-lap run exists">~{d.best25.toFixed(2)}</span> : d.best25.toFixed(2)) : '-'}</td>
                       <td style={{ fontFamily: 'var(--font-mono)', color: '#f0f0f0', background: heatBg(d.best30, 'best30') }}>{d.best30 ? (d.best30Est ? <span title="Includes a watcher-estimated lap (feed skipped it) - no clean 30-lap run exists">~{d.best30.toFixed(2)}</span> : d.best30.toFixed(2)) : '-'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{(() => { let n = null; try { n = JSON.parse(d.notes || 'null') } catch (e) { n = null }
                        const gl = n && n.gl != null ? n.gl : null
                        return <span title={n && n.sets ? 'Runs by tire set: ' + n.sets : undefined}>{gl != null ? gl + '/' : ''}{d.total_laps ?? '-'}{n && n.sets ? <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: 4 }}>{n.sets}</span> : null}</span> })()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Paywall blur */}
          {blurred && (
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              height: 160,
              background: 'linear-gradient(to bottom, transparent, var(--bg-base) 80%)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 20,
            }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.96rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Subscribe to see the full field
                </p>
                <a href="/subscribe" className="btn btn-primary" style={{ fontSize: '0.89rem', padding: '6px 18px' }}>
                  Get Full Access
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SEASON = 2026
const MIN_STOPS = 3        // crews with fewer timed stops are hidden (too noisy)
const LOWN = 5             // below this, sample is flagged as thin
const SERIES = [{ v: 'cup', label: 'Cup' }, { v: 'oreilly', label: "O'Reilly" }, { v: 'trucks', label: 'Trucks' }]
const SERIES_COLOR = { cup: 'var(--series-cup)', oreilly: 'var(--series-oreilly)', trucks: 'var(--series-trucks)' }
const DRIVER_OVERRIDE = { cup: { '33': 'Austin Hill' } }  // full-time driver; pin name, ignore rotating detection
const MEDAL = { 0: '\uD83E\uDD47', 1: '\uD83E\uDD48', 2: '\uD83E\uDD49' }
const __CAR_ALIAS = { '133': '33' }
const PEN_SEC = 1.75   // amortized box-time equivalent per crew penalty per race (display methodology, not a sim input)
const BOMB_X = 1.25    // a bomb = qualifying stop slower than 1.25x the series clean median (hung-lug territory)

// PHYSICAL FLOOR (2026-08-31, operator caught it: "Cindric best stop that can't be right").
// The Tukey fence below only guards the SLOW tail. NASCAR's feed emits occasional impossible
// box_times on rows flagged FOUR_WHEEL_CHANGE with all four tire booleans true — 96 of 52,737
// 4-tire stops (2022-26) come back under 8s, including values of 0.02s and 0.50s. They are
// scattered across many races, skewed toward road/street courses, so they are feed noise rather
// than one bad load.
//
// A symmetric Tukey fence does NOT work here: the distribution is right-skewed, so cup's lower
// fence lands at 4.25s and lets 4.86 straight through. The floor is set from the SHAPE of the
// distribution instead. Cup 2026 4-tire stops, 0.25s buckets:
//
//     7.75  1 stop  (1 car)     8.50   2 stops (2 cars)     9.25  323 stops (35 cars)
//     8.00  1 stop  (1 car)     8.75  38 stops (15 cars)    9.50  398 stops (36 cars)
//     8.25  1 stop  (1 car)     9.00 146 stops (29 cars)    9.75  402 stops (37 cars)
//
// The real population begins at 8.75 — density jumps ~20x there. Below it sit five isolated
// singletons, each from a different car, never repeated: the tail of the noise, not elite stops.
// 8.5 sits in that empty band, above every singleton that is clearly garbage and below the point
// where real stops start, leaving headroom if a crew ever does set a genuine record.
//
// Impact was confined to BEST STOP because it is a min — one bad row owns the column outright.
// Cup 2026 showed Cindric 4.86s (true 8.96), Logano 3.82 (9.02), #43 4.28 (9.16), #47 4.66
// (9.16), #6 6.36 (9.24). Medians moved <= 0.042s, so Adj, the rankings and the sim's crew term
// were never materially wrong.
//
// If a future season's histogram shows the population starting somewhere else, re-derive this
// the same way rather than nudging it.
const FLOOR_4T = 8.5
const FLOOR_2T = 2.5   // cup 2-tire p01 is 3.92s; the 8 rows under 2.5s are the same feed noise

// Feed driver names carry entry-list markers: a leading '*' (rookie), a trailing '(i)'
// (ineligible for points in this series), a trailing '#'. Those belong in an entry list, not in
// a rankings cell — before 2026-09-02 the page rendered "* Corey Heim(i)", "Connor Zilisch #"
// and "* Jimmie Johnson" verbatim. Strip for display; the markers are not stored here anyway.
const displayName = (n) => (n || '').replace(/^\*\s*/, '').replace(/\s*\(i\)\s*$/i, '').replace(/\s*#\s*$/, '').trim()

const median = (arr) => {
  const b = [...arr].sort((a, b) => a - b), n = b.length
  return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2
}

function CarNum({ car, series }) {
  if (!car) return null
  const dir = series === 'oreilly' ? '/car-numbers-oreilly/' : series === 'trucks' ? '/car-numbers-trucks/' : '/car-numbers/'
  return (
    <img src={dir + (__CAR_ALIAS[String(car)] || car) + '.png'} alt={'#' + car}
      style={{ height: 28, marginRight: 8, verticalAlign: 'middle' }}
      onError={(e) => { const t = e.target; if (!t.dataset.retried) { t.dataset.retried = '1'; t.src = t.src + (t.src.indexOf('?') >= 0 ? '&r=' : '?r=') + Date.now() } else { const s = document.createElement('span'); s.textContent = t.alt; s.style.fontWeight = '700'; t.replaceWith(s) } }} />
  )
}

function CrewDetail({ c }) {
  const rl = c.rlist || []
  if (!rl.length) return <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No per-race data.</div>
  const W = 760, H = 150, PX = 44, PB = 30, PT = 14
  const meds = rl.map((r) => r.med)
  const lo = Math.min.apply(null, meds), hi = Math.max.apply(null, meds)
  // robust y-scale: cap at Tukey upper fence so one wrecked/held-car race cannot flatten the chart
  const ms = [...meds].sort((a, b) => a - b)
  const mq1 = ms[Math.floor(ms.length * 0.25)], mq3 = ms[Math.floor(ms.length * 0.75)]
  const hiS = Math.max(Math.min(hi, mq3 + 1.5 * (mq3 - mq1)), lo + 0.5)
  const cl = (v) => Math.min(v, hiS)
  const xf = (i) => rl.length === 1 ? W / 2 : PX + i * (W - PX - 14) / (rl.length - 1)
  const yf = (v) => hiS === lo ? H / 2 : PT + (v - lo) * (H - PT - PB) / (hiS - lo)
  const pcol = (p) => p.c && p.d ? '#7f1d1d' : p.c ? '#b91c1c' : '#d97706'
  const pts = rl.map((r, i) => xf(i) + ',' + yf(cl(r.med))).join(' ')
  return (
    <div>
      {/* 2026-09-02: Bomb% and Drv Pen moved off the main table into this strip. Neither is a
          column you sort on — bomb rate is 0% for most crews and driver penalties are not the
          crew's doing — but both matter once you are already looking at one crew. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 28px', marginBottom: 12 }}>
        {[
          ['Best stop', c.bestStop ? c.bestStop.best.toFixed(2) + 's' : '—',
            c.bestStop ? 'R' + c.bestStop.rn + (c.bestStop.track ? ' · ' + c.bestStop.track : '') : null],
          ['Races', rl.length, null],
          ['Bomb%', (c.bomb * 100).toFixed(0) + '%', 'stops ' + BOMB_X + '× series median'],
          ['Crew penalties', c.cp, c.cp ? c.penRate.toFixed(2) + ' per race' : null],
          ['Driver penalties', c.dp, null],
        ].map(([label, val, note]) => (
          <div key={label} style={{ minWidth: 74 }}>
            <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>{label}</div>
            <div style={{ fontSize: '0.98rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>{val}</div>
            {note && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{note}</div>}
          </div>
        ))}
      </div>

      <div style={{ fontSize: '0.8rem', marginBottom: 8 }}>
        <strong>Race-by-race median 4-tire stop</strong>{' '}
        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(up = faster)</span>
      </div>
      <svg width={W} height={H} style={{ maxWidth: '100%' }}>
        <text x={4} y={yf(lo) + 4} style={{ fontSize: 10, fill: 'var(--text-secondary)' }}>{lo.toFixed(1)}s</text>
        <text x={4} y={yf(hiS) + 4} style={{ fontSize: 10, fill: 'var(--text-secondary)' }}>{hiS.toFixed(1)}s{hiS < hi ? '+' : ''}</text>
        <polyline points={pts} fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" opacity="0.55" />
        {rl.map((r, i) => {
          const p = (c.pens || {})[r.rn]
          return (
            <g key={r.rn}>
              <circle cx={xf(i)} cy={yf(cl(r.med))} r={p ? 5.5 : 4} fill={p ? pcol(p) : 'var(--bg-elevated)'} stroke={p ? pcol(p) : 'var(--text-secondary)'} strokeWidth="1.5">
                <title>{'R' + r.rn + (r.track ? ' ' + r.track : '') + ' - med ' + r.med.toFixed(2) + 's, best ' + r.best.toFixed(2) + 's, ' + r.n + ' stops' + (r.med > hiS ? ' (OFF SCALE - slow outlier race)' : '') + (p ? ' - ' + (p.c ? p.c + ' CREW PEN' : '') + (p.c && p.d ? ' + ' : '') + (p.d ? p.d + ' DRIVER PEN' : '') : '')}</title>
              </circle>
              <text x={xf(i)} y={H - 10} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--text-secondary)' }}>{r.rn}</text>
            </g>
          )
        })}
      </svg>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 4 }}>
        Filled red dot = crew penalty that race &middot; orange = driver penalty &middot; dark red = both &middot; hover any dot for race detail
      </div>
    </div>
  )
}

const wrap = { maxWidth: 1200, margin: '0 auto', padding: '24px 16px 60px' }
const h1 = { fontSize: '1.6rem', fontWeight: 700, margin: '0 0 4px' }
const sub = { fontSize: '0.95rem', color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }
// 2026-09-02: headers are spelled out rather than abbreviated. They WRAP instead of staying on
// one line (whiteSpace: nowrap is gone) — "Crew Penalties" over two lines fits the same column a
// nowrap "Crew Pen" needed, so full words cost ~76px across the whole table rather than ~170px.
// verticalAlign bottom keeps one- and two-line headers sitting on the same baseline.
// 2026-09-02 (operator: "everything on that page looks kinda small compared to the loop data
// page"). It was. LoopData runs 0.89rem sentence-case headers and 0.96rem cells; this page was on
// 0.72rem UPPERCASE headers and 0.9rem cells, which reads as a different, smaller product. Matched
// to LoopData: same header size, same casing, same cell size, same padding.
//
// Headers still wrap, but paddingTop is explicit and lineHeight is a whole number of pixels at
// this size — the earlier verticalAlign:'bottom' with a fractional line box was clipping the top
// line of the two-line headers ("Adjusted" over "Time"). Top-aligned with real padding instead.
// textTransform and letterSpacing are set EXPLICITLY here even though a global `th` rule in the
// site stylesheet already applies both (uppercase, 0.06em). That rule is why two rounds of column
// widths were wrong: this file said nothing about casing, so it was measured and sized as sentence
// case, while every visitor saw UPPERCASE — which is far wider. Restating them means the component
// describes what actually renders, and the next person sizing a column measures the right string.
const th = (o) => ({ padding: '10px 10px', fontSize: '0.89rem', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.06em',
  color: o.active ? 'var(--accent-text)' : 'var(--text-secondary)',
  borderBottom: '1px solid var(--border)', cursor: o.sortable ? 'pointer' : 'default',
  lineHeight: '18px', verticalAlign: 'top', userSelect: 'none', textAlign: o.align || 'center',
  // A header's longest word cannot wrap, so if it exceeds the column it spills sideways into the
  // neighbouring header. This makes it break instead of bleed - the widths are sized so it never
  // has to, but this is the backstop.
  overflowWrap: 'break-word' })
const td = (align) => ({ padding: '8px 12px', fontSize: '0.96rem', borderBottom: '1px solid var(--border)',
  textAlign: align || 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })

export default function PitCrewRankings() {
  const [series, setSeries] = useState('cup')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('adj')  // 'adj' | 'median' | 'iqr' | 'n'
  const [open, setOpen] = useState(null)
  const [cmp, setCmp] = useState([])
  const [showHelp, setShowHelp] = useState(false)   // glossary is opt-in: it used to push the table off a phone screen

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      // all timed 4-tire stops (green + caution): lower series pit mostly under yellow
      let all = [], from = 0
      for (;;) {
        const { data, error } = await supabase
          .from('pit_stops')
          .select('car_number, organization, driver_name, box_time, race_number, track_name, tires_changed')
          .eq('series', series).eq('year', SEASON)
          .in('tires_changed', [2, 4])
          .not('box_time', 'is', null)
          .range(from, from + 999)
        if (error || !data) break
        all = all.concat(data)
        if (data.length < 1000) break
        from += 1000
      }
      let pnl = []
      const r2 = await supabase.from('pit_penalties').select('car_number, category, race_number').eq('series', series).eq('year', SEASON).range(0, 1999)
      if (r2.data) pnl = r2.data
      const penC = {}, penD = {}
      const penR = {}
      pnl.forEach((p) => { const k = String(p.car_number); if (p.category === 'crew') penC[k] = (penC[k] || 0) + 1; else if (p.category === 'driver') penD[k] = (penD[k] || 0) + 1; if (p.category === 'crew' || p.category === 'driver') { const m = (penR[k] = penR[k] || {}); const e = (m[p.race_number] = m[p.race_number] || { c: 0, d: 0 }); if (p.category === 'crew') e.c += 1; else e.d += 1 } })
      if (cancelled) return
      const crews = {}
      all.forEach((r) => {
        const key = r.car_number + '|' + (r.organization || '?')
        const c = (crews[key] = crews[key] || { car: r.car_number, org: r.organization, dc: {}, t: [], t2: [], rs: {}, rd: {} })
        if (+r.tires_changed === 4) { c.t.push(+r.box_time); if (r.race_number != null) { c.rs[r.race_number] = 1; const rd = (c.rd[r.race_number] = c.rd[r.race_number] || { ts: [], track: r.track_name }); rd.ts.push(+r.box_time) } } else if (+r.tires_changed === 2) { c.t2.push(+r.box_time) }
        const dn = (r.driver_name || '').trim()
        if (dn) c.dc[dn] = (c.dc[dn] || 0) + 1
      })
      // crew = car + team, so a rotating driver lineup stays ONE crew. Normalize name
      // markers (leading *, trailing (i)/#) so one driver is not miscounted as several.
      const cleanName = (n) => displayName(n).toLowerCase()
      // Floor BEFORE taking quartiles: impossible sub-FLOOR_4T rows sit in the low tail and would
      // drag q1 down, widening the IQR and pushing the slow-side fence out. Small effect, but the
      // fence should be derived from stops that could physically have happened.
      const allT = all.filter((r) => +r.tires_changed === 4).map((r) => +r.box_time).filter((t) => t >= FLOOR_4T).sort((a, b) => a - b)
      const sq1 = allT[Math.floor(allT.length * 0.25)], sq3 = allT[Math.floor(allT.length * 0.75)]
      const fence = sq3 + 1.5 * (sq3 - sq1)   // series outlier fence: beyond this = repair/hold/non-competitive stop, excluded from ALL crew stats
      // ok4 is the ONLY 4-tire filter used below — both tails. See FLOOR_4T at the top of the file.
      const ok4 = (t) => t >= FLOOR_4T && t <= fence
      const seriesMed = median(allT.filter(ok4))
      const all2 = all.filter((r) => +r.tires_changed === 2).map((r) => +r.box_time).filter((t) => t >= FLOOR_2T).sort((a, b) => a - b)
      const t2q1 = all2[Math.floor(all2.length * 0.25)] || 0, t2q3 = all2[Math.floor(all2.length * 0.75)] || 0
      const fence2 = all2.length >= 30 ? t2q3 + 1.5 * (t2q3 - t2q1) : Infinity   // 2-tire stops get their OWN fence (different timescale)
      const maxRn = all.reduce((m, r) => Math.max(m, r.race_number || 0), 0)
      const out = Object.values(crews).filter((c) => c.t.filter(ok4).length >= MIN_STOPS).map((c) => {
        const ct = c.t.filter(ok4)
        const b = [...ct].sort((a, b) => a - b)
        const q1 = b[Math.floor(b.length * 0.25)], q3 = b[Math.floor(b.length * 0.75)]
        const names = Object.keys(c.dc)
        const distinct = new Set(names.map(cleanName))
        const ov = (DRIVER_OVERRIDE[series] || {})[c.car]
        const rotating = ov ? false : distinct.size > 1
        const driver = ov || (rotating ? 'Rotating' : displayName(names.sort((a, b) => c.dc[b] - c.dc[a])[0]))
        const races = Object.keys(c.rs).length || 1
        const cp = penC[String(c.car)] || 0
        const dp = penD[String(c.car)] || 0
        const med = median(ct)
        // 2026-07-28 (Brandon Jones 35.44s case): lower-series '2T' rows are often SPLIT 4-tire
        // service (rights one caution stop, lefts the next) and wait-inflated caution service
        // (35-95s), and the polluted distribution pushes the Tukey fence to ~120s (filters
        // nothing). Principle: a competitive 2-tire stop exists to be FASTER than a 4-tire
        // stop - cap the 2T filter at the series clean 4T median.
        const ct2 = c.t2.filter((t) => t >= FLOOR_2T && t <= Math.min(fence2, seriesMed))
        const rlist = Object.keys(c.rd).map(Number).sort((a, b) => a - b).map((rn) => { const cts = c.rd[rn].ts.filter(ok4); return cts.length ? { rn: rn, med: median(cts), n: cts.length, best: Math.min.apply(null, cts), track: c.rd[rn].track } : null }).filter(Boolean)
        const bestStop = rlist.reduce((m, x) => (m && m.best <= x.best ? m : x), null)
        return { car: c.car, org: c.org, driver: driver, rotating: rotating, median: med, adj: med + (cp / races) * PEN_SEC, penRate: cp / races, cp: cp, dp: dp, bomb: ct.filter((t) => t > seriesMed * BOMB_X).length / ct.length, iqr: q3 - q1, t2m: ct2.length >= 3 ? median(ct2) : null, n2: ct2.length, n: ct.length, rlist: rlist, bestStop: bestStop, pens: (penR[String(c.car)] || {}), prevAdj: (() => { const pts = Object.keys(c.rd).map(Number).filter((rn) => rn !== maxRn).reduce((acc, rn) => acc.concat(c.rd[rn].ts), []).filter(ok4); if (pts.length < MIN_STOPS) return null; const pRaces = races - (c.rs[maxRn] ? 1 : 0); if (pRaces < 1) return null; const pCp = cp - (((penR[String(c.car)] || {})[maxRn] || {}).c || 0); return median(pts) + (Math.max(0, pCp) / pRaces) * PEN_SEC })() }
      })
      // power-rank movement: rank now vs rank with the latest race excluded (2026-08-08, operator request)
      const curR = [...out].sort((a, b) => a.adj - b.adj); curR.forEach((r, i2) => { r.__cr = i2 + 1 })
      const pvR = out.filter((r) => r.prevAdj != null).sort((a, b) => a.prevAdj - b.prevAdj); pvR.forEach((r, i2) => { r.__pr = i2 + 1 })
      out.forEach((r) => { r.delta = (r.prevAdj != null && r.__pr != null) ? r.__pr - r.__cr : null })
      setRows(out)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [series])

  const cmpRows = cmp.map((k) => rows.find((r) => r.car + '|' + (r.org || '') === k)).filter(Boolean)
  const toggleCmp = (key) => setCmp((p) => p.includes(key) ? p.filter((x) => x !== key) : [...p.slice(-1), key])
  const sorted = [...rows].sort((a, b) =>
    sort === 'n' ? b.n - a.n : sort === 'iqr' ? a.iqr - b.iqr : sort === '2t' ? ((a.t2m == null ? 1e9 : a.t2m) - (b.t2m == null ? 1e9 : b.t2m)) : a.adj - b.adj)

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={h1}>Pit Crew Rankings</h1>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          {SEASON} SEASON &middot; QUALIFYING STOPS ONLY
        </span>
      </div>

      <p style={{ ...sub, margin: '0 0 12px', maxWidth: 680 }}>
        Ranked by <strong style={{ color: 'var(--text-primary)' }}>Adjusted Time</strong> &mdash; median 4-tire box time
        plus {PEN_SEC} seconds for every crew penalty. Lower is faster.
        <strong style={{ color: 'var(--text-primary)' }}> Every time on this page is in seconds.</strong> Tap
        a row for race-by-race detail, or <strong style={{ color: 'var(--text-primary)' }}>+</strong> on two crews to compare them.
      </p>

      <button onClick={() => setShowHelp((v) => !v)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: showHelp ? 10 : 18,
        padding: '5px 12px', borderRadius: 999, border: '1px solid var(--border)',
        background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.76rem',
        cursor: 'pointer', letterSpacing: '0.03em',
      }}>
        <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>{showHelp ? '−' : '+'}</span>
        What the columns mean
      </button>

      {showHelp && (
        <div style={{
          marginBottom: 18, padding: '14px 16px', background: 'var(--bg-surface)',
          border: '1px solid var(--border)', borderRadius: 10,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px 22px',
        }}>
          {[
            ['Adjusted Time', 'Median 4-tire box time + ' + PEN_SEC + 's per crew penalty per race.'],
            ['Consistency', 'Box-time spread. Lower means steadier, stop to stop.'],
            ['Two-Tire Time', 'Median two-tire stop. Hover the number for sample size.'],
            ['Crew Penalties', 'Crew-caused: loose wheel, too many men, equipment.'],
            ['Bomb%', 'In the row detail. Share of stops ' + BOMB_X + '× slower than the series median — hung-lug territory.'],
            ['Driver Penalties', 'In the row detail. Driver-caused: speeding, commitment line, missing the box.'],
            ['Move', 'Rank movement against the standings before the latest race.'],
            ['Sample', 'Crews under ' + MIN_STOPS + ' stops are hidden. Under ' + LOWN + ' is tagged “thin”.'],
          ].map(([term, def]) => (
            <div key={term}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)', marginBottom: 2 }}>{term}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{def}</div>
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1', fontSize: '0.76rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 10, lineHeight: 1.5 }}>
            Crash repairs, penalty holds and impossible sub-{FLOOR_4T}s feed errors are excluded before anything is computed.
            Times are raw seconds and are never compared across series.
            <br />
            <strong style={{ color: 'var(--text-secondary)' }}>Penalties are parsed from race-control lap notes and are not complete</strong> —
            a few races each season come back with none recorded, so a crew&rsquo;s penalty count is a floor, not a total.
          </div>
        </div>
      )}

      <div style={{ display: 'inline-flex', gap: 4, marginBottom: 18, padding: 4, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        {SERIES.map((s) => {
          const active = series === s.v
          return (
            <button key={s.v} onClick={() => setSeries(s.v)} style={{
              padding: '7px 20px', borderRadius: 7, border: 'none',
              background: active ? SERIES_COLOR[s.v] : 'transparent',
              color: active ? (s.v === 'trucks' ? '#111' : '#fff') : 'var(--text-secondary)',
              fontWeight: active ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s',
            }}>{s.label}</button>
          )
        })}
      </div>

      {cmpRows.length === 2 && (() => {
        const A = cmpRows[0], B = cmpRows[1]
        const shared = A.rlist.filter((x) => B.rlist.some((y) => y.rn === x.rn)).map((x) => x.rn).sort((a, b) => a - b)
        let aw = 0, bw = 0
        const perRace = shared.map((rn) => {
          const a = A.rlist.find((x) => x.rn === rn), b = B.rlist.find((x) => x.rn === rn)
          if (a.med < b.med) aw++; else if (b.med < a.med) bw++
          return { rn, track: (a.track || '').split(' ').slice(0, 2).join(' '), am: a.med, bm: b.med }
        })
        const WIN = '#22c55e'
        // Value cell carries a proportional bar so the SIZE of the gap reads at a glance \u2014
        // "10.12 vs 10.36" is a quarter second, which the bare numbers do not convey.
        const statRow = (label, av, bv, fmt, lower) => {
          const both = av != null && bv != null
          const aWin = both && (lower ? av < bv : av > bv)
          const bWin = both && (lower ? bv < av : bv > av)
          const mx = both ? Math.max(av, bv) || 1 : 1
          const cell = (v, win, right) => (
            <div style={{ width: '34%', textAlign: right ? 'right' : 'left' }}>
              <div style={{ fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums', fontWeight: win ? 700 : 500, color: win ? WIN : 'var(--text-primary)' }}>
                {v != null ? fmt(v) : '\u2014'}
              </div>
              {both && (
                <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', marginTop: 4, display: 'flex', justifyContent: right ? 'flex-end' : 'flex-start' }}>
                  <div style={{ width: (Math.abs(v) / mx * 100).toFixed(1) + '%', height: '100%', borderRadius: 2, background: win ? WIN : 'var(--text-muted)', opacity: win ? 0.9 : 0.4 }} />
                </div>
              )}
            </div>
          )
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
              {cell(av, aWin, false)}
              <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.07em', textAlign: 'center', flex: 1 }}>{label}</span>
              {cell(bv, bWin, true)}
            </div>
          )
        }
        const s2 = (v) => v.toFixed(2)
        const crewHead = (c, right) => (
          <div style={{ width: '38%', textAlign: right ? 'right' : 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: right ? 'flex-end' : 'flex-start', marginBottom: 3 }}>
              <CarNum car={c.car} series={series} />
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{c.driver || ('#' + c.car)}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>{c.org || ''}</div>
          </div>
        )
        const tot = Math.max(1, aw + bw)
        return (
          <div style={{ margin: '0 0 18px', padding: '16px 18px', background: 'var(--bg-surface)', border: '1px solid var(--accent)', borderRadius: 12, maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              {crewHead(A, false)}
              <div style={{ flex: 1, textAlign: 'center', paddingTop: 6 }}>
                <div style={{ fontSize: '0.68rem', letterSpacing: '0.12em', color: 'var(--text-muted)' }}>VS</div>
              </div>
              {crewHead(B, true)}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: aw > bw ? WIN : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{aw}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  head-to-head &middot; {shared.length} shared races{shared.length !== aw + bw ? ' \u00b7 ' + (shared.length - aw - bw) + ' even' : ''}
                </span>
                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: bw > aw ? WIN : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{bw}</span>
              </div>
              <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: 'var(--border)' }}>
                <div style={{ width: (aw / tot * 100).toFixed(1) + '%', background: aw > bw ? WIN : 'var(--text-muted)', opacity: aw > bw ? 0.9 : 0.45 }} />
                <div style={{ width: (bw / tot * 100).toFixed(1) + '%', background: bw > aw ? WIN : 'var(--text-muted)', opacity: bw > aw ? 0.9 : 0.45, marginLeft: 'auto' }} />
              </div>
            </div>

            {statRow('Adjusted Time', A.adj, B.adj, s2, true)}
            {statRow('Median 4-tire', A.median, B.median, s2, true)}
            {statRow('Best stop', A.bestStop && A.bestStop.best, B.bestStop && B.bestStop.best, s2, true)}
            {statRow('Median 2-tire', A.t2m, B.t2m, s2, true)}
            {statRow('Consistency', A.iqr, B.iqr, s2, true)}
            {/* 2026-08-31: this row was labelled just "Pen / race" and showed ONLY the crew rate.
                Blaney's two 2026 penalties are both driver-caused, so his card read 0.00 and the
                operator reasonably read that as "penalties are missing". Both kinds are shown now. */}
            {statRow('Crew penalties / race', A.penRate, B.penRate, s2, true)}
            {statRow('Driver penalties', A.dp, B.dp, (v) => v, true)}
            {statRow('Stops', A.n, B.n, (v) => v, false)}

            <div style={{ marginTop: 12, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 4 }}>Race by race</div>
            <div style={{ maxHeight: 168, overflowY: 'auto' }}>
              {perRace.map((r) => (
                <div key={r.rn} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '3px 0', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '30%', fontVariantNumeric: 'tabular-nums', fontWeight: r.am < r.bm ? 700 : 400, color: r.am < r.bm ? WIN : 'var(--text-secondary)' }}>{r.am.toFixed(2)}</span>
                  <span style={{ flex: 1, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem' }}>R{r.rn} {r.track}</span>
                  <span style={{ width: '30%', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: r.bm < r.am ? 700 : 400, color: r.bm < r.am ? WIN : 'var(--text-secondary)' }}>{r.bm.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <button onClick={() => setCmp([])} style={{
              marginTop: 12, padding: '5px 14px', borderRadius: 999, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.74rem', cursor: 'pointer',
            }}>Clear comparison</button>
          </div>
        )
      })()}

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading pit data&hellip;</p>
      ) : sorted.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No 4-tire stops yet for this series in {SEASON}.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
          {/* maxWidth above caps the TABLE, not the page. Without it the one flexible column
              (Driver / Team) swallowed every spare pixel — 446px at a 1280 viewport — leaving a
              canyon between a driver's name and his numbers that made a row hard to read across. */}
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              {/* Sized from the longest word of each header MEASURED ON THE LIVE PAGE, in Inter
                  at 14.24px, UPPERCASE, 0.06em tracking, + 20px padding, + >=13px headroom:
                    RANK 64  MOVE 66  COMPARE 97  ADJUSTED 104
                    CONSISTENCY 134  TWO-TIRE 98  PENALTIES 105  STOPS 72
                  Fixed columns total 933, leaving Driver / Team ~235 at a 1200px page. */}
              <col style={{ width: 80 }} />
              <col style={{ width: 82 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 70 }} />
              <col />
              <col style={{ width: 120 }} />
              <col style={{ width: 148 }} />
              <col style={{ width: 114 }} />
              <col style={{ width: 121 }} />
              <col style={{ width: 88 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={th({ align: 'center' })}>Rank</th>
                <th style={th({ align: 'center' })} title={'Rank movement vs before the latest race'}>Move</th>
                <th style={th({ align: 'center' })} title={'Select two crews to compare'}>Compare</th>
                <th style={th({ align: 'left' })}>Car</th>
                <th style={th({ align: 'left' })}>Driver / Team</th>
                {/* "(s)" is gone from these three. The operator asked what it meant, which is the
                    only evidence a unit suffix needs to be replaced with a plain sentence — the
                    subhead now says every time on the page is in seconds. */}
                <th style={th({ align: 'center', sortable: true, active: sort === 'adj' })} onClick={() => setSort('adj')}>Adjusted Time</th>
                <th style={th({ align: 'center', sortable: true, active: sort === 'iqr' })} onClick={() => setSort('iqr')}>Consistency</th>
                <th style={th({ align: 'center', sortable: true, active: sort === '2t' })} onClick={() => setSort('2t')}>Two-Tire Time</th>
                <th style={th({ align: 'center' })}>Crew Penalties</th>
                <th style={th({ align: 'center', sortable: true, active: sort === 'n' })} onClick={() => setSort('n')}>Stops</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => (
                <React.Fragment key={c.car + '|' + (c.org || '')}>
                <tr onClick={() => setOpen(open === c.car + '|' + (c.org || '') ? null : c.car + '|' + (c.org || ''))} style={{ cursor: 'pointer', background: i % 2 ? 'transparent' : 'var(--bg-elevated)' }}>
                  <td style={{ ...td('center'), fontWeight: 700, overflow: 'visible', textOverflow: 'clip' }}>{MEDAL[i] ? <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>{MEDAL[i]}</span> : (i + 1)}</td>
                  <td style={{ ...td('center'), fontWeight: 700, color: c.delta == null ? 'var(--text-muted)' : c.delta > 0 ? '#22c55e' : c.delta < 0 ? '#ef4444' : 'var(--text-muted)' }}>{c.delta == null ? '\u2014' : c.delta > 0 ? '+' + c.delta : c.delta === 0 ? '=' : c.delta}</td>
                  <td style={{ ...td('center') }} onClick={(e) => { e.stopPropagation(); toggleCmp(c.car + '|' + (c.org || '')) }}>
                    <span style={{ cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontSize: '0.78rem', border: '1px solid ' + (cmp.includes(c.car + '|' + (c.org || '')) ? 'var(--accent)' : 'var(--border)'), color: cmp.includes(c.car + '|' + (c.org || '')) ? 'var(--accent-text)' : 'var(--text-muted)' }}>{cmp.includes(c.car + '|' + (c.org || '')) ? '\u2713' : '+'}</span>
                  </td>
                  <td style={td('left')}><CarNum car={c.car} series={series} /></td>
                  {/* 2026-09-02: Organization and Driver were two columns. Merged into one "Crew"
                      cell (driver over org) to get the table off 13 columns \u2014 the fixed widths
                      alone ran past a phone's width, so Adj scrolled out of view next to the name. */}
                  <td style={td('left')}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: c.rotating ? 'italic' : 'normal' }}>{c.driver || '\u2014'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.org || '\u2014'}</div>
                  </td>
                  <td style={{ ...td('center'), fontWeight: 700 }}>{c.adj.toFixed(2)}</td>
                  <td style={{ ...td('center'), color: 'var(--text-secondary)' }}>{c.iqr.toFixed(2)}</td>
                  <td style={{ ...td('center'), color: 'var(--text-secondary)' }} title={c.n2 + ' two-tire stops'}>{c.t2m != null ? c.t2m.toFixed(2) : '\u2014'}{/* thin tag removed 2026-07-28: overflowed the 64px col into 4.4...; sample size lives in the hover title */}</td>
                  <td style={td('center')} title={c.penRate.toFixed(2) + ' crew penalties per race'}>{c.cp}</td>
                  <td style={td('center')}>
                    {c.n}{c.n < LOWN && <span style={{ marginLeft: 6, fontSize: '0.68rem', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>thin</span>}
                  </td>
                </tr>
                {open === c.car + '|' + (c.org || '') && (
                  <tr><td colSpan={10} style={{ padding: '12px 16px 18px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}><CrewDetail c={c} /></td></tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

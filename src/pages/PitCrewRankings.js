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

const median = (arr) => {
  const b = [...arr].sort((a, b) => a - b), n = b.length
  return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2
}

function CarNum({ car, series }) {
  if (!car) return null
  const dir = series === 'oreilly' ? '/car-numbers-oreilly/' : series === 'trucks' ? '/car-numbers-trucks/' : '/car-numbers/'
  return (
    <img src={dir + (__CAR_ALIAS[String(car)] || car) + '.png'} alt={'#' + car}
      style={{ height: 22, marginRight: 8, verticalAlign: 'middle' }}
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
      <div style={{ fontSize: '0.8rem', marginBottom: 8 }}>
        <strong>Race-by-race median 4-tire stop</strong> (up = faster)
        {c.bestStop && <span style={{ color: 'var(--text-secondary)' }}> &middot; best stop {c.bestStop.best.toFixed(2)}s (R{c.bestStop.rn}{c.bestStop.track ? ', ' + c.bestStop.track : ''}) &middot; {rl.length} races &middot; {c.cp} crew pen / {c.dp} driver pen</span>}
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

const wrap = { maxWidth: 1120, margin: '0 auto', padding: '24px 16px 60px' }
const h1 = { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px' }
const sub = { fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }
const th = (o) => ({ padding: '9px 14px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: o.active ? 'var(--accent-text)' : 'var(--text-secondary)',
  borderBottom: '1px solid var(--border)', cursor: o.sortable ? 'pointer' : 'default',
  whiteSpace: 'nowrap', userSelect: 'none', textAlign: o.align || 'center' })
const td = (align) => ({ padding: '9px 14px', fontSize: '0.9rem', borderBottom: '1px solid var(--border)',
  textAlign: align || 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })

export default function PitCrewRankings() {
  const [series, setSeries] = useState('cup')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('adj')  // 'adj' | 'median' | 'iqr' | 'n'
  const [open, setOpen] = useState(null)
  const [cmp, setCmp] = useState([])

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
      const cleanName = (n) => n.replace(/^\*\s*/, '').replace(/\s*\(i\)\s*$/i, '').replace(/\s*#\s*$/, '').trim().toLowerCase()
      const allT = all.filter((r) => +r.tires_changed === 4).map((r) => +r.box_time).sort((a, b) => a - b)
      const sq1 = allT[Math.floor(allT.length * 0.25)], sq3 = allT[Math.floor(allT.length * 0.75)]
      const fence = sq3 + 1.5 * (sq3 - sq1)   // series outlier fence: beyond this = repair/hold/non-competitive stop, excluded from ALL crew stats
      const seriesMed = median(allT.filter((t) => t <= fence))
      const all2 = all.filter((r) => +r.tires_changed === 2).map((r) => +r.box_time).sort((a, b) => a - b)
      const t2q1 = all2[Math.floor(all2.length * 0.25)] || 0, t2q3 = all2[Math.floor(all2.length * 0.75)] || 0
      const fence2 = all2.length >= 30 ? t2q3 + 1.5 * (t2q3 - t2q1) : Infinity   // 2-tire stops get their OWN fence (different timescale)
      const maxRn = all.reduce((m, r) => Math.max(m, r.race_number || 0), 0)
      const out = Object.values(crews).filter((c) => c.t.filter((t) => t <= fence).length >= MIN_STOPS).map((c) => {
        const ct = c.t.filter((t) => t <= fence)
        const b = [...ct].sort((a, b) => a - b)
        const q1 = b[Math.floor(b.length * 0.25)], q3 = b[Math.floor(b.length * 0.75)]
        const names = Object.keys(c.dc)
        const distinct = new Set(names.map(cleanName))
        const ov = (DRIVER_OVERRIDE[series] || {})[c.car]
        const rotating = ov ? false : distinct.size > 1
        const driver = ov || (rotating ? 'Rotating' : (names.sort((a, b) => c.dc[b] - c.dc[a])[0] || ''))
        const races = Object.keys(c.rs).length || 1
        const cp = penC[String(c.car)] || 0
        const dp = penD[String(c.car)] || 0
        const med = median(ct)
        // 2026-07-28 (Brandon Jones 35.44s case): lower-series '2T' rows are often SPLIT 4-tire
        // service (rights one caution stop, lefts the next) and wait-inflated caution service
        // (35-95s), and the polluted distribution pushes the Tukey fence to ~120s (filters
        // nothing). Principle: a competitive 2-tire stop exists to be FASTER than a 4-tire
        // stop - cap the 2T filter at the series clean 4T median.
        const ct2 = c.t2.filter((t) => t <= Math.min(fence2, seriesMed))
        const rlist = Object.keys(c.rd).map(Number).sort((a, b) => a - b).map((rn) => { const cts = c.rd[rn].ts.filter((t) => t <= fence); return cts.length ? { rn: rn, med: median(cts), n: cts.length, best: Math.min.apply(null, cts), track: c.rd[rn].track } : null }).filter(Boolean)
        const bestStop = rlist.reduce((m, x) => (m && m.best <= x.best ? m : x), null)
        return { car: c.car, org: c.org, driver: driver, rotating: rotating, median: med, adj: med + (cp / races) * PEN_SEC, penRate: cp / races, cp: cp, dp: dp, bomb: ct.filter((t) => t > seriesMed * BOMB_X).length / ct.length, iqr: q3 - q1, t2m: ct2.length >= 3 ? median(ct2) : null, n2: ct2.length, n: ct.length, rlist: rlist, bestStop: bestStop, pens: (penR[String(c.car)] || {}), prevAdj: (() => { const pts = Object.keys(c.rd).map(Number).filter((rn) => rn !== maxRn).reduce((acc, rn) => acc.concat(c.rd[rn].ts), []).filter((t) => t <= fence); if (pts.length < MIN_STOPS) return null; const pRaces = races - (c.rs[maxRn] ? 1 : 0); if (pRaces < 1) return null; const pCp = cp - (((penR[String(c.car)] || {})[maxRn] || {}).c || 0); return median(pts) + (Math.max(0, pCp) / pRaces) * PEN_SEC })() }
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
      <h1 style={h1}>Pit Crew Rankings</h1>
      <p style={sub}>
        <strong>Adj (s)</strong> = median 4-tire box time + {PEN_SEC}s per crew penalty per race &mdash; lower is faster.
        {' '}{SEASON} season, within series, qualifying stops only (crash repairs and penalty holds excluded).
        {' '}Click any row for race-by-race detail.
      </p>
      <p style={{ ...sub, fontSize: '0.78rem' }}>
        Consistency = box-time spread (lower = steadier) &middot; Bomb% = stops 1.25&times; slower than the series median
        {' '}&middot; 2T = median two-tire stop (hover for sample size) &middot; Crew Pen = crew-caused penalties &middot; Drv Pen = driver-caused (speeding, commitment, box)
        {' '}&middot; crews under {MIN_STOPS} stops hidden &middot; &ldquo;thin&rdquo; = fewer than {LOWN}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {SERIES.map((s) => {
          const active = series === s.v
          return (
            <button key={s.v} onClick={() => setSeries(s.v)} style={{
              padding: '7px 18px', borderRadius: 6, border: '1px solid var(--border)',
              background: active ? SERIES_COLOR[s.v] : 'var(--bg-surface)',
              color: active ? (s.v === 'trucks' ? '#111' : '#fff') : 'var(--text-secondary)',
              fontWeight: active ? 600 : 400, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s',
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
        const statRow = (label, av, bv, fmt, lower) => {
          const aWin = av != null && bv != null && (lower ? av < bv : av > bv)
          const bWin = av != null && bv != null && (lower ? bv < av : bv > av)
          return (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
              <span style={{ width: 110, fontWeight: aWin ? 700 : 400, color: aWin ? '#22c55e' : 'var(--text-primary)' }}>{av != null ? fmt(av) : '\u2014'}</span>
              <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>{label}</span>
              <span style={{ width: 110, textAlign: 'right', fontWeight: bWin ? 700 : 400, color: bWin ? '#22c55e' : 'var(--text-primary)' }}>{bv != null ? fmt(bv) : '\u2014'}</span>
            </div>
          )
        }
        const s2 = (v) => v.toFixed(2)
        return (
          <div style={{ margin: '0 0 18px', padding: '14px 18px', background: 'var(--bg-surface)', border: '1px solid var(--accent)', borderRadius: 8, maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CarNum car={A.car} series={series} />{A.org || ''}</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>vs</span>
              <strong style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CarNum car={B.car} series={series} />{B.org || ''}</strong>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Race-by-race median head-to-head: <strong style={{ color: aw > bw ? '#22c55e' : 'var(--text-primary)' }}>{aw}</strong>
              {' \u2013 '}
              <strong style={{ color: bw > aw ? '#22c55e' : 'var(--text-primary)' }}>{bw}</strong>
              {shared.length !== aw + bw ? ' (' + (shared.length - aw - bw) + ' even)' : ''} across {shared.length} shared races
            </div>
            {statRow('Adj (s)', A.adj, B.adj, s2, true)}
            {statRow('Median 4T', A.median, B.median, s2, true)}
            {statRow('Best stop', A.bestStop && A.bestStop.best, B.bestStop && B.bestStop.best, s2, true)}
            {statRow('2T median', A.t2m, B.t2m, s2, true)}
            {statRow('Consistency', A.iqr, B.iqr, s2, true)}
            {statRow('Pen / race', A.penRate, B.penRate, s2, true)}
            {statRow('Stops', A.n, B.n, (v) => v, false)}
            <div style={{ marginTop: 10, maxHeight: 160, overflowY: 'auto' }}>
              {perRace.map((r) => (
                <div key={r.rn} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '2px 0', color: 'var(--text-secondary)' }}>
                  <span style={{ width: 110, color: r.am < r.bm ? '#22c55e' : 'var(--text-secondary)' }}>{r.am.toFixed(2)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>R{r.rn} {r.track}</span>
                  <span style={{ width: 110, textAlign: 'right', color: r.bm < r.am ? '#22c55e' : 'var(--text-secondary)' }}>{r.bm.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading pit data\u2026</p>
      ) : sorted.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No 4-tire stops yet for this series in {SEASON}.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 50 }} />
              <col style={{ width: 52 }} />
              <col style={{ width: 58 }} />
              <col style={{ width: 68 }} />
              <col />
              <col />
              <col style={{ width: 92 }} />
              <col style={{ width: 118 }} />
              <col style={{ width: 64 }} />
              <col style={{ width: 68 }} />
              <col style={{ width: 78 }} />
              <col style={{ width: 78 }} />
              <col style={{ width: 84 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={th({ align: 'center' })}>#</th>
                <th style={th({ align: 'center' })} title={'Rank movement vs before the latest race'}>{'\u0394'}</th>
                <th style={th({ align: 'center' })} title={'Select two crews to compare'}>Cmp</th>
                <th style={th({ align: 'left' })}>Car</th>
                <th style={th({ align: 'left' })}>Organization</th>
                <th style={th({ align: 'left' })}>Driver</th>
                <th style={th({ align: 'center', sortable: true, active: sort === 'adj' })} onClick={() => setSort('adj')}>Adj (s)</th>
                <th style={th({ align: 'center', sortable: true, active: sort === 'iqr' })} onClick={() => setSort('iqr')}>Consistency</th>
                <th style={th({ align: 'center' })}>Bomb%</th>
                <th style={th({ align: 'center', sortable: true, active: sort === '2t' })} onClick={() => setSort('2t')}>2T (s)</th>
                <th style={th({ align: 'center' })}>Crew Pen</th>
                <th style={th({ align: 'center' })}>Drv Pen</th>
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
                  <td style={td('left')}>{c.org || '\u2014'}</td>
                  <td style={{ ...td('left'), color: 'var(--text-secondary)', fontStyle: c.rotating ? 'italic' : 'normal' }}>{c.driver || '\u2014'}</td>
                  <td style={{ ...td('center'), fontWeight: 700 }}>{c.adj.toFixed(2)}</td>
                  <td style={{ ...td('center'), color: 'var(--text-secondary)' }}>{c.iqr.toFixed(2)}</td>
                  <td style={{ ...td('center'), color: 'var(--text-secondary)' }}>{(c.bomb * 100).toFixed(0)}%</td>
                  <td style={{ ...td('center'), color: 'var(--text-secondary)' }} title={c.n2 + ' two-tire stops'}>{c.t2m != null ? c.t2m.toFixed(2) : '\u2014'}{/* thin tag removed 2026-07-28: overflowed the 64px col into 4.4...; sample size lives in the hover title */}</td>
                  <td style={td('center')} title={c.penRate.toFixed(2) + ' crew penalties per race'}>{c.cp}</td>
                  <td style={td('center')}>{c.dp}</td>
                  <td style={td('center')}>
                    {c.n}{c.n < LOWN && <span style={{ marginLeft: 6, fontSize: '0.68rem', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>thin</span>}
                  </td>
                </tr>
                {open === c.car + '|' + (c.org || '') && (
                  <tr><td colSpan={13} style={{ padding: '12px 16px 18px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)' }}><CrewDetail c={c} /></td></tr>
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

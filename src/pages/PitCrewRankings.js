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
const BOMB_X = 1.5     // a bomb = stop slower than 1.5x the series median
// Career driver pit-penalty rates pct (speeding/commitment/box), 2022-26 through 2026-07-23,
// shrunk k=50 toward the 3.9 pct base, min 60 races, threshold 1.8x base. Regenerate from pit_penalties periodically.
const CHRONIC = { 'ty gibbs': 8.7, 'riley herbst': 8.2, 'daniel suarez': 7.7, 'martin truex jr': 7.7, 'kyle busch': 7.7, 'shane van gisbergen': 7.4, 'john hunter nemechek': 7.2 }

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

const wrap = { maxWidth: 1120, margin: '0 auto', padding: '24px 16px 60px' }
const h1 = { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px' }
const sub = { fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }
const th = (o) => ({ padding: '9px 14px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: o.active ? 'var(--accent)' : 'var(--text-secondary)',
  borderBottom: '1px solid var(--border)', cursor: o.sortable ? 'pointer' : 'default',
  whiteSpace: 'nowrap', userSelect: 'none', textAlign: o.align || 'center' })
const td = (align) => ({ padding: '9px 14px', fontSize: '0.9rem', borderBottom: '1px solid var(--border)',
  textAlign: align || 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })

export default function PitCrewRankings() {
  const [series, setSeries] = useState('cup')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('adj')  // 'adj' | 'median' | 'iqr' | 'n'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      // all timed 4-tire stops (green + caution): lower series pit mostly under yellow
      let all = [], from = 0
      for (;;) {
        const { data, error } = await supabase
          .from('pit_stops')
          .select('car_number, organization, driver_name, box_time, race_number')
          .eq('series', series).eq('year', SEASON)
          .eq('tires_changed', 4)
          .not('box_time', 'is', null)
          .range(from, from + 999)
        if (error || !data) break
        all = all.concat(data)
        if (data.length < 1000) break
        from += 1000
      }
      let pnl = []
      const r2 = await supabase.from('pit_penalties').select('car_number, category').eq('series', series).eq('year', SEASON).range(0, 1999)
      if (r2.data) pnl = r2.data
      const penC = {}, penD = {}
      pnl.forEach((p) => { const k = String(p.car_number); if (p.category === 'crew') penC[k] = (penC[k] || 0) + 1; else if (p.category === 'driver') penD[k] = (penD[k] || 0) + 1 })
      if (cancelled) return
      const crews = {}
      all.forEach((r) => {
        const key = r.car_number + '|' + (r.organization || '?')
        const c = (crews[key] = crews[key] || { car: r.car_number, org: r.organization, dc: {}, t: [], rs: {} })
        c.t.push(+r.box_time); if (r.race_number != null) c.rs[r.race_number] = 1
        const dn = (r.driver_name || '').trim()
        if (dn) c.dc[dn] = (c.dc[dn] || 0) + 1
      })
      // crew = car + team, so a rotating driver lineup stays ONE crew. Normalize name
      // markers (leading *, trailing (i)/#) so one driver is not miscounted as several.
      const cleanName = (n) => n.replace(/^\*\s*/, '').replace(/\s*\(i\)\s*$/i, '').replace(/\s*#\s*$/, '').trim().toLowerCase()
      const seriesMed = median(all.map((r) => +r.box_time))
      const out = Object.values(crews).filter((c) => c.t.length >= MIN_STOPS).map((c) => {
        const b = [...c.t].sort((a, b) => a - b)
        const q1 = b[Math.floor(b.length * 0.25)], q3 = b[Math.floor(b.length * 0.75)]
        const names = Object.keys(c.dc)
        const distinct = new Set(names.map(cleanName))
        const ov = (DRIVER_OVERRIDE[series] || {})[c.car]
        const rotating = ov ? false : distinct.size > 1
        const driver = ov || (rotating ? 'Rotating' : (names.sort((a, b) => c.dc[b] - c.dc[a])[0] || ''))
        const races = Object.keys(c.rs).length || 1
        const cp = penC[String(c.car)] || 0
        const dp = penD[String(c.car)] || 0
        const med = median(c.t)
        const chronic = CHRONIC[(driver || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()]
        return { car: c.car, org: c.org, driver: driver, rotating: rotating, median: med, adj: med + (cp / races) * PEN_SEC, penRate: cp / races, cp: cp, dp: dp, bomb: c.t.filter((t) => t > seriesMed * BOMB_X).length / c.t.length, chronic: chronic, iqr: q3 - q1, n: c.t.length }
      })
      setRows(out)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [series])

  const sorted = [...rows].sort((a, b) =>
    sort === 'n' ? b.n - a.n : sort === 'iqr' ? a.iqr - b.iqr : sort === 'median' ? a.median - b.median : a.adj - b.adj)

  return (
    <div style={wrap}>
      <h1 style={h1}>Pit Crew Rankings</h1>
      <p style={sub}>
        Ranked by <strong>penalty-adjusted median 4-tire stop</strong> &mdash; median box time (seconds) plus {PEN_SEC}s per crew penalty per race. Bomb% is the share of stops slower than 1.5&times; the series median. Drv Pen counts driver-caused pit penalties (speeding, commitment line, pitting outside the box) &mdash; charged to the driver, not the crew; &ldquo;chronic&rdquo; marks drivers with elevated career rates. Lower is faster.
        {' '}{SEASON} season, within series. Consistency = interquartile range of box times (lower = steadier).
        Crews with fewer than {MIN_STOPS} timed stops are hidden; a &ldquo;thin&rdquo; tag marks fewer than {LOWN}.
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

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading pit data\u2026</p>
      ) : sorted.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No 4-tire stops yet for this series in {SEASON}.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 50 }} />
              <col style={{ width: 68 }} />
              <col />
              <col />
              <col style={{ width: 96 }} />
              <col style={{ width: 78 }} />
              <col style={{ width: 118 }} />
              <col style={{ width: 64 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 84 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={th({ align: 'center' })}>#</th>
                <th style={th({ align: 'left' })}>Car</th>
                <th style={th({ align: 'left' })}>Organization</th>
                <th style={th({ align: 'left' })}>Driver</th>
                <th style={th({ align: 'center', sortable: true, active: sort === 'median' })} onClick={() => setSort('median')}>Median (s)</th>
                <th style={th({ align: 'center', sortable: true, active: sort === 'adj' })} onClick={() => setSort('adj')}>Adj (s)</th>
                <th style={th({ align: 'center', sortable: true, active: sort === 'iqr' })} onClick={() => setSort('iqr')}>Consistency</th>
                <th style={th({ align: 'center' })}>Bomb%</th>
                <th style={th({ align: 'center' })}>Crew Pen</th>
                <th style={th({ align: 'center' })}>Drv Pen</th>
                <th style={th({ align: 'center', sortable: true, active: sort === 'n' })} onClick={() => setSort('n')}>Stops</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => (
                <tr key={c.car + c.org} style={{ background: i % 2 ? 'transparent' : 'var(--bg-elevated)' }}>
                  <td style={{ ...td('center'), fontWeight: 700 }}>{MEDAL[i] || (i + 1)}</td>
                  <td style={td('left')}><CarNum car={c.car} series={series} /></td>
                  <td style={td('left')}>{c.org || '\u2014'}</td>
                  <td style={{ ...td('left'), color: 'var(--text-secondary)', fontStyle: c.rotating ? 'italic' : 'normal' }}>{c.driver || '\u2014'}</td>
                  <td style={{ ...td('center'), color: 'var(--text-secondary)' }}>{c.median.toFixed(2)}</td>
                  <td style={{ ...td('center'), fontWeight: 700 }}>{c.adj.toFixed(2)}</td>
                  <td style={{ ...td('center'), color: 'var(--text-secondary)' }}>{c.iqr.toFixed(2)}</td>
                  <td style={{ ...td('center'), color: 'var(--text-secondary)' }}>{(c.bomb * 100).toFixed(0)}%</td>
                  <td style={td('center')}>{c.cp} <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>({c.penRate.toFixed(2)}/rc)</span></td>
                  <td style={td('center')}>{c.dp}{c.chronic ? <span style={{ marginLeft: 6, fontSize: '0.68rem', color: '#fff', background: '#7f1d1d', borderRadius: 4, padding: '1px 5px' }}>chronic</span> : null}</td>
                  <td style={td('center')}>
                    {c.n}{c.n < LOWN && <span style={{ marginLeft: 6, fontSize: '0.68rem', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>thin</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

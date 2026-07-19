import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SEASON = 2026
const MIN_STOPS = 3        // crews with fewer timed stops are hidden (too noisy)
const LOWN = 5             // below this, sample is flagged as thin
const SERIES = [{ v: 'cup', label: 'Cup' }, { v: 'oreilly', label: "O'Reilly" }, { v: 'trucks', label: 'Trucks' }]
const MEDAL = { 0: '\uD83E\uDD47', 1: '\uD83E\uDD48', 2: '\uD83E\uDD49' }

const median = (arr) => {
  const b = [...arr].sort((a, b) => a - b), n = b.length
  return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2
}

const wrap = { maxWidth: 940, margin: '0 auto', padding: '24px 16px 60px' }
const h1 = { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 4px' }
const sub = { fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 }
const toggleWrap = { display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }
const th = (active) => ({ padding: '8px 12px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: active ? 'var(--accent)' : 'var(--text-secondary)', borderBottom: '1px solid var(--border)',
  cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' })
const td = { padding: '9px 12px', fontSize: '0.9rem', borderBottom: '1px solid var(--border)' }

export default function PitCrewRankings() {
  const [series, setSeries] = useState('cup')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('median')  // 'median' | 'iqr' | 'n'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      // green-flag 4-tire timed stops only = the crew-skill signal
      let all = [], from = 0
      for (;;) {
        const { data, error } = await supabase
          .from('pit_stops')
          .select('car_number, organization, driver_name, box_time')
          .eq('series', series).eq('year', SEASON)
          .eq('green_flag', true).eq('tires_changed', 4)
          .not('box_time', 'is', null)
          .range(from, from + 999)
        if (error || !data) break
        all = all.concat(data)
        if (data.length < 1000) break
        from += 1000
      }
      if (cancelled) return
      const crews = {}
      all.forEach((r) => {
        const key = r.car_number + '|' + (r.organization || '?')
        ;(crews[key] = crews[key] || { car: r.car_number, org: r.organization, driver: r.driver_name, t: [] }).t.push(+r.box_time)
        crews[key].driver = r.driver_name || crews[key].driver
      })
      const out = Object.values(crews).filter((c) => c.t.length >= MIN_STOPS).map((c) => {
        const b = [...c.t].sort((a, b) => a - b)
        const q1 = b[Math.floor(b.length * 0.25)], q3 = b[Math.floor(b.length * 0.75)]
        return { car: c.car, org: c.org, driver: c.driver, median: median(c.t), iqr: q3 - q1, n: c.t.length }
      })
      setRows(out)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [series])

  const sorted = [...rows].sort((a, b) =>
    sort === 'n' ? b.n - a.n : sort === 'iqr' ? a.iqr - b.iqr : a.median - b.median)

  return (
    <div style={wrap}>
      <h1 style={h1}>Pit Crew Rankings</h1>
      <p style={sub}>
        Ranked by <strong>median green-flag 4-tire pit stop</strong> (box time, seconds) &mdash; lower is faster.
        {' '}{SEASON} season, within series. Consistency = interquartile range of box times (lower = steadier).
        Crews with fewer than {MIN_STOPS} timed stops are hidden; a &ldquo;thin&rdquo; tag marks fewer than {LOWN}.
      </p>

      <div style={toggleWrap}>
        {SERIES.map((s) => (
          <button key={s.v} onClick={() => setSeries(s.v)} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--border)',
            background: series === s.v ? 'var(--accent)' : 'var(--bg-elevated)',
            color: series === s.v ? '#111' : 'var(--text-secondary)',
          }}>{s.label}</button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading pit data\u2026</p>
      ) : sorted.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No qualifying green-flag 4-tire stops yet for this series in {SEASON}.</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th(false)}>#</th>
                <th style={{ ...th(false), textAlign: 'left' }}>Car</th>
                <th style={{ ...th(false), textAlign: 'left' }}>Organization</th>
                <th style={{ ...th(false), textAlign: 'left' }}>Driver</th>
                <th style={th(sort === 'median')} onClick={() => setSort('median')}>Median (s)</th>
                <th style={th(sort === 'iqr')} onClick={() => setSort('iqr')}>Consistency</th>
                <th style={th(sort === 'n')} onClick={() => setSort('n')}>Stops</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => (
                <tr key={c.car + c.org} style={{ background: i % 2 ? 'transparent' : 'var(--bg-elevated)' }}>
                  <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{MEDAL[i] || (i + 1)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>#{c.car}</td>
                  <td style={td}>{c.org || '\u2014'}</td>
                  <td style={{ ...td, color: 'var(--text-secondary)' }}>{c.driver || '\u2014'}</td>
                  <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{c.median.toFixed(2)}</td>
                  <td style={{ ...td, textAlign: 'center', color: 'var(--text-secondary)' }}>{c.iqr.toFixed(2)}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
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

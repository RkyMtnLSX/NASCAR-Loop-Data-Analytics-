import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// OPTIMAL LINEUP ARCHIVE (2026-08-29, operator: "a dfs page that shows previous optimal
// lineups for customers" + "users want to see previous races optimals and what each drivers
// salaries were"). PUBLIC page - operator decision: a past optimal is worthless to a
// freeloader (the race already ran) and the archive is the strongest conversion asset we
// have, so a prospect can audit the record before paying.
//
// Reads two public tables, no joins to gated data:
//   dfs_optimal_history (kind='perfect') - the best cap-legal 6 for each race
//   dfs_race_field                        - EVERY priced driver: salary, start, finish, DK pts
// The stored kind='model' rows are internal and deliberately NOT rendered: a single
// projection-max lineup is not the GPP product actually played.
// Provenance + verification: BACKTEST_LOG 2026-08-29.

const SERIES = [
  { v: 'all', label: 'All' },
  { v: 'cup', label: 'Cup' },
  { v: 'oreilly', label: "O'Reilly" },
  { v: 'trucks', label: 'Trucks' },
]
const SERIES_LABEL = { cup: 'Cup', oreilly: "O'Reilly", trucks: 'Trucks' }
const SERIES_COLOR = {
  cup: 'var(--series-cup, #e11d2a)',
  oreilly: 'var(--series-oreilly, #f5a623)',
  trucks: 'var(--series-trucks, #4a9eff)',
}

const card = {
  background: 'var(--bg-card, #14161b)',
  border: '1px solid var(--border, #22252b)',
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
}
const money = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString())
const one = (n) => (n == null ? '—' : Number(n).toFixed(1))
const th = { padding: '6px 8px', textAlign: 'left', fontWeight: 600 }
const thR = { ...th, textAlign: 'right' }
const td = { padding: '5px 8px' }
const tdR = { ...td, textAlign: 'right' }

export default function OptimalLineups() {
  const [opt, setOpt] = useState([])
  const [fields, setFields] = useState({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)   // 2026-09-05: read errors used to render as 'no optimals'
  const [series, setSeries] = useState('all')
  const [open, setOpen] = useState(() => new Set())
  const [sortBy, setSortBy] = useState('sal')

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      supabase
        .from('dfs_optimal_history')
        .select('series, race_year, race_number, track_name, lineup, score, salary')
        .eq('kind', 'perfect'),
      supabase.from('dfs_race_field').select('series, race_year, race_number, field'),
    ]).then(([o, f]) => {
      if (!alive) return
      if (o.error || f.error) setErr('Could not load: ' + ((o.error && o.error.message) || (f.error && f.error.message)))
      const rows = (o.data || []).slice().sort(
        (a, b) => b.race_year - a.race_year || b.race_number - a.race_number
      )
      const map = {}
      ;(f.data || []).forEach((r) => {
        map[r.series + '-' + r.race_year + '-' + r.race_number] = r.field || []
      })
      setOpt(rows)
      setFields(map)
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  const shown = useMemo(
    () => (series === 'all' ? opt : opt.filter((r) => r.series === series)),
    [opt, series]
  )

  const stats = useMemo(() => {
    if (!shown.length) return null
    const s = shown.map((r) => Number(r.score)).filter(isFinite)
    return {
      races: shown.length,
      avg: s.length ? s.reduce((a, b) => a + b, 0) / s.length : null,
      best: s.length ? Math.max(...s) : null,
    }
  }, [shown])

  const keyOf = (r) => r.series + '-' + r.race_year + '-' + r.race_number
  const toggle = (k) =>
    setOpen((p) => {
      const n = new Set(p)
      n.has(k) ? n.delete(k) : n.add(k)
      return n
    })

  return (
    <div className="page" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 60px' }}>
      <h1 style={{ color: 'var(--text-primary, #e8eaed)', marginBottom: 4 }}>Optimal Lineup Archive</h1>
      <p style={{ color: 'var(--text-secondary, #9aa0aa)', fontSize: 14, marginTop: 0, marginBottom: 18 }}>
        Every 2026 race: the highest-scoring DraftKings lineup that fit under the $50,000 cap,
        plus the full field — what every driver was priced at and what they actually scored.
        Free to browse.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {SERIES.map((s) => (
          <button key={s.v} onClick={() => setSeries(s.v)}
            style={{
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13,
              border: '1px solid var(--border, #2a2d34)',
              background: series === s.v ? 'var(--accent, #e11d2a)' : 'transparent',
              color: series === s.v ? '#fff' : 'var(--text-secondary, #9aa0aa)',
            }}>
            {s.label}
          </button>
        ))}
      </div>

      {stats && (
        <div style={{ ...card, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <Stat label="Races" value={stats.races} />
          <Stat label="Avg optimal score" value={one(stats.avg)} />
          <Stat label="Best optimal" value={one(stats.best)} />
        </div>
      )}

      {loading && <div style={{ color: 'var(--text-secondary, #9aa0aa)' }}>Loading archive…</div>}
      {err && <div style={{ padding: '10px 14px', background: '#922B2120', border: '1px solid #922B2140', borderRadius: 8, color: '#E74C3C', fontSize: '0.8125rem', marginBottom: 12 }}>{err}</div>}
      {!loading && !shown.length && <div style={card}>No races recorded yet for this series.</div>}

      {!loading && shown.map((r) => {
        const k = keyOf(r)
        const isOpen = open.has(k)
        const lu = Array.isArray(r.lineup) ? r.lineup : []
        const field = fields[k] || []
        const inOpt = new Set(lu.map((d) => (d.name || '').toLowerCase()))
        const sorted = field.slice().sort((a, b) => {
          if (sortBy === 'pts') return (b.pts ?? -999) - (a.pts ?? -999)
          if (sortBy === 'val') {
            const v = (x) => (x.pts != null && x.sal ? (x.pts / x.sal) * 1000 : -999)
            return v(b) - v(a)
          }
          return (b.sal || 0) - (a.sal || 0)
        })
        return (
          <div key={k} style={card}>
            <div onClick={() => toggle(k)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', cursor: 'pointer' }}>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 0.4, padding: '3px 8px',
                borderRadius: 5, color: '#fff', background: SERIES_COLOR[r.series] || '#555',
              }}>
                {(SERIES_LABEL[r.series] || r.series).toUpperCase()}
              </span>
              <strong style={{ color: 'var(--text-primary, #e8eaed)', fontSize: 15 }}>
                {r.track_name || 'Race ' + r.race_number}
              </strong>
              <span style={{ color: 'var(--text-muted, #6b7078)', fontSize: 12 }}>
                {r.race_year} · Race {r.race_number}
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 18, alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary, #9aa0aa)', fontSize: 12 }}>{money(r.salary)}</span>
                <strong style={{ color: 'var(--accent, #e11d2a)', fontSize: 17 }}>{one(r.score)}</strong>
                <span style={{ color: 'var(--text-muted, #6b7078)', fontSize: 12 }}>{isOpen ? '▴' : '▾'}</span>
              </span>
            </div>

            {isOpen && (
              <>
                <div style={{ marginTop: 14, marginBottom: 6, color: 'var(--text-primary, #e8eaed)', fontWeight: 600, fontSize: 13 }}>
                  Optimal lineup
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary, #9aa0aa)' }}>
                        <th style={th}>Driver</th><th style={thR}>Salary</th>
                        <th style={thR}>Start</th><th style={thR}>Finish</th><th style={thR}>DK Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lu.map((d, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border, #22252b)' }}>
                          <td style={{ ...td, color: 'var(--text-primary, #e8eaed)' }}>{d.name}</td>
                          <td style={tdR}>{money(d.sal)}</td>
                          <td style={{ ...tdR, color: 'var(--text-secondary, #9aa0aa)' }}>
                            {d.start == null ? '—' : 'P' + Math.round(d.start)}
                          </td>
                          <td style={{ ...tdR, color: 'var(--text-secondary, #9aa0aa)' }}>
                            {d.fin == null ? '—' : 'P' + Math.round(d.fin)}
                          </td>
                          <td style={{ ...tdR, fontWeight: 600 }}>{one(d.pts)}</td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: '1px solid var(--border, #2a2d34)' }}>
                        <td style={{ ...td, fontWeight: 700 }}>Total</td>
                        <td style={{ ...tdR, fontWeight: 700 }}>{money(r.salary)}</td>
                        <td colSpan={2} />
                        <td style={{ ...tdR, fontWeight: 700, color: 'var(--accent, #e11d2a)' }}>{one(r.score)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {!!sorted.length && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-primary, #e8eaed)', fontWeight: 600, fontSize: 13 }}>
                        Full field &amp; salaries
                      </span>
                      <span style={{ color: 'var(--text-muted, #6b7078)', fontSize: 12 }}>
                        {sorted.length} drivers · sort
                      </span>
                      {[['sal', 'Salary'], ['pts', 'DK Pts'], ['val', 'Value']].map(([v, lab]) => (
                        <button key={v} onClick={() => setSortBy(v)}
                          style={{
                            padding: '2px 9px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                            border: '1px solid var(--border, #2a2d34)',
                            background: sortBy === v ? 'var(--accent, #e11d2a)' : 'transparent',
                            color: sortBy === v ? '#fff' : 'var(--text-secondary, #9aa0aa)',
                          }}>
                          {lab}
                        </button>
                      ))}
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ color: 'var(--text-secondary, #9aa0aa)' }}>
                            <th style={th}>Driver</th><th style={thR}>Salary</th>
                            <th style={thR}>Start</th><th style={thR}>Finish</th>
                            <th style={thR}>Led</th><th style={thR}>Fast</th>
                            <th style={thR}>DK Pts</th><th style={thR}>Pts / $1K</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map((d, i) => {
                            const hit = inOpt.has((d.name || '').toLowerCase())
                            const val = d.pts != null && d.sal ? (d.pts / d.sal) * 1000 : null
                            return (
                              <tr key={i} style={{
                                borderTop: '1px solid var(--border, #22252b)',
                                background: hit ? 'rgba(225,29,42,0.10)' : 'transparent',
                              }}>
                                <td style={{ ...td, color: 'var(--text-primary, #e8eaed)', fontWeight: hit ? 600 : 400 }}>
                                  {hit && <span style={{ color: 'var(--accent, #e11d2a)', marginRight: 5 }}>★</span>}
                                  {d.name}
                                </td>
                                <td style={tdR}>{money(d.sal)}</td>
                                <td style={{ ...tdR, color: 'var(--text-secondary, #9aa0aa)' }}>
                                  {d.start == null ? '—' : 'P' + Math.round(d.start)}
                                </td>
                                <td style={{ ...tdR, color: 'var(--text-secondary, #9aa0aa)' }}>
                                  {d.fin == null ? 'DNP' : 'P' + Math.round(d.fin)}
                                </td>
                                <td style={{ ...tdR, color: 'var(--text-muted, #6b7078)' }}>{d.ll ?? '—'}</td>
                                <td style={{ ...tdR, color: 'var(--text-muted, #6b7078)' }}>{d.fl ?? '—'}</td>
                                <td style={{ ...tdR, fontWeight: 600 }}>{one(d.pts)}</td>
                                <td style={{ ...tdR, color: 'var(--text-secondary, #9aa0aa)' }}>
                                  {val == null ? '—' : val.toFixed(2)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )
      })}

      <p style={{ color: 'var(--text-muted, #6b7078)', fontSize: 12, marginTop: 20, lineHeight: 1.6 }}>
        Scoring: DraftKings NASCAR classic — finish-position points, place differential
        (start − finish), 0.25 per lap led, 0.45 per fastest lap. The optimal lineup is the best
        six-driver roster that fit under the cap, known only after the race. ★ marks the drivers
        who made it. DNP = priced on the slate but did not take the green.
      </p>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ color: 'var(--text-muted, #6b7078)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ color: 'var(--text-primary, #e8eaed)', fontSize: 20, fontWeight: 700, marginTop: 2 }}>
        {value}
      </div>
    </div>
  )
}

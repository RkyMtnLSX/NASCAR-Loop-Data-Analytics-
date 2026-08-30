import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// OPTIMAL LINEUP HISTORY (2026-08-29, operator request: "a dfs page that shows previous
// optimal lineups for customers"). PUBLIC page - operator decision, same night: past
// optimal lineups are worthless to a freeloader (the race already happened) and the page
// is the best conversion asset we have, so a prospect can audit the archive before paying.
// Reads dfs_optimal_history (kind='perfect') only. The stored 'model' rows are internal
// and deliberately NOT rendered: a single projection-max lineup is not the GPP product.
// Provenance: 36 races parsed from the operator's shared 2026 Loop Data / Optimal Lineup
// workbooks, cross-checked 36/36 against those sheets' own stated DK optimal totals, plus
// 4 races computed here from salaries x results. See BACKTEST_LOG 2026-08-29.

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

export default function OptimalLineups() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [series, setSeries] = useState('all')
  const [open, setOpen] = useState(() => new Set())

  useEffect(() => {
    let alive = true
    setLoading(true)
    supabase
      .from('dfs_optimal_history')
      .select('series, race_year, race_number, track_name, lineup, score, salary')
      .eq('kind', 'perfect')
      .order('race_year', { ascending: false })
      .order('race_number', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return
        if (error) { setRows([]); setLoading(false); return }
        setRows(data || [])
        setLoading(false)
      })
    return () => { alive = false }
  }, [])

  const shown = useMemo(
    () => (series === 'all' ? rows : rows.filter((r) => r.series === series)),
    [rows, series]
  )

  const stats = useMemo(() => {
    if (!shown.length) return null
    const scores = shown.map((r) => Number(r.score)).filter((n) => isFinite(n))
    const sals = shown.map((r) => Number(r.salary)).filter((n) => isFinite(n))
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
    return {
      races: shown.length,
      avgScore: avg(scores),
      bestScore: scores.length ? Math.max(...scores) : null,
      avgSalary: avg(sals),
    }
  }, [shown])

  const toggle = (k) =>
    setOpen((prev) => {
      const n = new Set(prev)
      n.has(k) ? n.delete(k) : n.add(k)
      return n
    })

  const keyOf = (r) => r.series + '-' + r.race_year + '-' + r.race_number

  return (
    <div className="page" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 60px' }}>
      <h1 style={{ color: 'var(--text-primary, #e8eaed)', marginBottom: 4 }}>Optimal Lineup Archive</h1>
      <p style={{ color: 'var(--text-secondary, #9aa0aa)', fontSize: 14, marginTop: 0, marginBottom: 18 }}>
        The highest-scoring DraftKings lineup that was buildable under the $50,000 cap for each
        2026 race, scored on official results. Free to browse — every race here is already run.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {SERIES.map((s) => (
          <button
            key={s.v}
            onClick={() => setSeries(s.v)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              border: '1px solid var(--border, #2a2d34)',
              background: series === s.v ? 'var(--accent, #e11d2a)' : 'transparent',
              color: series === s.v ? '#fff' : 'var(--text-secondary, #9aa0aa)',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {stats && (
        <div style={{ ...card, display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <Stat label="Races" value={stats.races} />
          <Stat label="Avg optimal score" value={one(stats.avgScore)} />
          <Stat label="Best optimal" value={one(stats.bestScore)} />
          <Stat label="Avg salary used" value={money(Math.round(stats.avgSalary))} />
        </div>
      )}

      {loading && <div style={{ color: 'var(--text-secondary, #9aa0aa)' }}>Loading archive…</div>}
      {!loading && !shown.length && (
        <div style={card}>No optimal lineups recorded yet for this series.</div>
      )}

      {!loading &&
        shown.map((r) => {
          const k = keyOf(r)
          const isOpen = open.has(k)
          const lu = Array.isArray(r.lineup) ? r.lineup : []
          return (
            <div key={k} style={card}>
              <div
                onClick={() => toggle(k)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    padding: '3px 8px',
                    borderRadius: 5,
                    color: '#fff',
                    background: SERIES_COLOR[r.series] || '#555',
                  }}
                >
                  {(SERIES_LABEL[r.series] || r.series).toUpperCase()}
                </span>
                <strong style={{ color: 'var(--text-primary, #e8eaed)', fontSize: 15 }}>
                  {r.track_name || 'Race ' + r.race_number}
                </strong>
                <span style={{ color: 'var(--text-muted, #6b7078)', fontSize: 12 }}>
                  {r.race_year} · Race {r.race_number}
                </span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 18, alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary, #9aa0aa)', fontSize: 12 }}>
                    {money(r.salary)}
                  </span>
                  <strong style={{ color: 'var(--accent, #e11d2a)', fontSize: 17 }}>
                    {one(r.score)}
                  </strong>
                  <span style={{ color: 'var(--text-muted, #6b7078)', fontSize: 12 }}>
                    {isOpen ? '▴' : '▾'}
                  </span>
                </span>
              </div>

              {isOpen && (
                <div style={{ overflowX: 'auto', marginTop: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary, #9aa0aa)', textAlign: 'left' }}>
                        <th style={{ padding: '6px 8px' }}>Driver</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Salary</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Start</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>Finish</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>DK Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lu.map((d, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border, #22252b)' }}>
                          <td style={{ padding: '6px 8px', color: 'var(--text-primary, #e8eaed)' }}>
                            {d.name}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{money(d.sal)}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary, #9aa0aa)' }}>
                            {d.start == null ? '—' : 'P' + Math.round(d.start)}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary, #9aa0aa)' }}>
                            {d.fin == null ? '—' : 'P' + Math.round(d.fin)}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>
                            {one(d.pts)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: '1px solid var(--border, #2a2d34)' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>Total</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                          {money(r.salary)}
                        </td>
                        <td colSpan={2} />
                        <td
                          style={{
                            padding: '6px 8px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: 'var(--accent, #e11d2a)',
                          }}
                        >
                          {one(r.score)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}

      <p style={{ color: 'var(--text-muted, #6b7078)', fontSize: 12, marginTop: 20, lineHeight: 1.6 }}>
        Scoring: DraftKings NASCAR classic — finish-position points, place differential
        (start − finish), 0.25 per lap led, 0.45 per fastest lap. The optimal lineup is the
        best six-driver roster that fit under the salary cap, known only after the race.
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

import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// OPTIMALS (2026-08-30, operator: "a page under the DFS tab called optimals ... show the last 5
// optimal lineups for each series at that race track set in the weekend configuration").
// Reads featured_weekend for each series' configured track, then the last 5 DK optimal lineups
// at THAT track for THAT series from dfs_optimal_history (kind='perfect', 2022-2026).
// Race naming per operator: "Daytona 1 / Daytona 2", never Winter/Summer - built from
// race_seq/race_cnt (ordinal of the race at that track within its year).
// Subscriber page (sits behind the paywall with the rest of the DFS tab).

const SERIES = [
  { v: 'cup', label: 'Cup' },
  { v: 'oreilly', label: "O'Reilly" },
  { v: 'trucks', label: 'Trucks' },
]
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
  marginBottom: 18,
}
const money = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString())
const one = (n) => (n == null ? '—' : Number(n).toFixed(1))

// "Daytona International Speedway" -> "Daytona"; leaves names like "Circuit of the Americas" alone
function shortTrack(t) {
  if (!t) return ''
  return t
    .replace(/\s+(International|Motor)?\s*(Speedway|Superspeedway|Raceway|Motorsports Park)$/i, '')
    .replace(/\s+Raceway Park$/i, '')
    .trim() || t
}
function raceLabel(r) {
  const s = shortTrack(r.track_name)
  return (r.race_cnt > 1 && r.race_seq) ? `${s} ${r.race_seq}` : s
}

export default function DfsOptimals() {
  const [weekend, setWeekend] = useState({})
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    supabase
      .from('featured_weekend')
      .select('series, track_name')
      .then(({ data }) => {
        if (!alive) return
        const wk = {}
        ;(data || []).forEach((w) => { wk[w.series] = w.track_name })
        setWeekend(wk)
        const tracks = [...new Set(Object.values(wk).filter(Boolean))]
        if (!tracks.length) { setLoading(false); return }
        supabase
          .from('dfs_optimal_history')
          .select('series, race_year, race_number, track_name, lineup, score, salary, race_seq, race_cnt')
          .eq('kind', 'perfect')
          .in('track_name', tracks)
          .then(({ data: d2 }) => {
            if (!alive) return
            setRows(d2 || [])
            setLoading(false)
          })
      })
    return () => { alive = false }
  }, [])

  const lastFive = (series) => {
    const track = weekend[series]
    if (!track) return []
    return rows
      .filter((r) => r.series === series && r.track_name === track)
      .sort((a, b) => b.race_year - a.race_year || (b.race_seq || 0) - (a.race_seq || 0))
      .slice(0, 5)
  }

  return (
    <div className="page" style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 60px' }}>
      <h1 style={{ color: 'var(--text-primary, #e8eaed)', marginBottom: 4 }}>Optimals</h1>
      <p style={{ color: 'var(--text-secondary, #9aa0aa)', fontSize: 14, marginTop: 0, marginBottom: 22 }}>
        The last five DraftKings optimal lineups at this weekend's track, for each series — what
        the perfect $50,000 roster was, and what it paid.
      </p>

      {loading && <div style={{ color: 'var(--text-secondary, #9aa0aa)' }}>Loading…</div>}

      {!loading && SERIES.map((s) => {
        const track = weekend[s.v]
        const list = lastFive(s.v)
        return (
          <div key={s.v} style={card}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 0.4, padding: '3px 8px',
                borderRadius: 5, color: '#fff', background: SERIES_COLOR[s.v],
              }}>
                {s.label.toUpperCase()}
              </span>
              <strong style={{ color: 'var(--text-primary, #e8eaed)', fontSize: 16 }}>
                {track || 'No weekend configured'}
              </strong>
              {!!list.length && (
                <span style={{ color: 'var(--text-muted, #6b7078)', fontSize: 12 }}>
                  last {list.length} {list.length === 1 ? 'race' : 'races'} here
                </span>
              )}
            </div>

            {!track && (
              <div style={{ color: 'var(--text-secondary, #9aa0aa)', fontSize: 13 }}>
                No track set for this series in the weekend configuration.
              </div>
            )}
            {track && !list.length && (
              <div style={{ color: 'var(--text-secondary, #9aa0aa)', fontSize: 13 }}>
                No optimal lineups recorded at {shortTrack(track)} for this series yet.
              </div>
            )}

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {list.map((r) => {
                const lu = Array.isArray(r.lineup) ? r.lineup : []
                return (
                  <div key={r.race_year + '-' + r.race_number}
                    style={{
                      flex: '1 1 320px', minWidth: 300,
                      border: '1px solid var(--border, #22252b)', borderRadius: 10, padding: 12,
                      background: 'var(--bg, #0e0f13)',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                      <strong style={{ color: 'var(--text-primary, #e8eaed)', fontSize: 14 }}>
                        {raceLabel(r)}
                      </strong>
                      <span style={{ color: 'var(--text-muted, #6b7078)', fontSize: 12 }}>{r.race_year}</span>
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'baseline' }}>
                        <span style={{ color: 'var(--text-secondary, #9aa0aa)', fontSize: 11 }}>
                          {money(r.salary)}
                        </span>
                        <strong style={{ color: 'var(--accent, #e11d2a)', fontSize: 15 }}>
                          {one(r.score)}
                        </strong>
                      </span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <tbody>
                        {lu.map((d, i) => (
                          <tr key={i} style={{ borderTop: i ? '1px solid var(--border, #1c1f25)' : 'none' }}>
                            <td style={{ padding: '4px 4px', color: 'var(--text-primary, #e8eaed)' }}>{d.name}</td>
                            <td style={{ padding: '4px 4px', textAlign: 'right', color: 'var(--text-secondary, #9aa0aa)' }}>
                              {money(d.sal)}
                            </td>
                            <td style={{ padding: '4px 4px', textAlign: 'right', color: 'var(--text-muted, #6b7078)' }}>
                              {d.start == null ? '—' : 'P' + Math.round(d.start)}
                              {' → '}
                              {d.fin == null ? '—' : 'P' + Math.round(d.fin)}
                            </td>
                            <td style={{ padding: '4px 4px', textAlign: 'right', fontWeight: 600 }}>
                              {one(d.pts)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <p style={{ color: 'var(--text-muted, #6b7078)', fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
        Tracks follow the weekend configuration — each series shows its own configured track. Where a
        track hosts a series twice in a year the races are numbered in calendar order (Daytona 1,
        Daytona 2). Scoring is DraftKings classic: finish points, place differential, 0.25 per lap
        led, 0.45 per fastest lap. Full archive under DFS → Optimal Archive.
      </p>
    </div>
  )
}

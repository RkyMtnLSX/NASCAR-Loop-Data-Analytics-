import React, { useState, useEffect, useCallback } from 'react'

// ── Sportsbook config ─────────────────────────────────────────────────────────
const BOOKS = [
  { key: 'fanduel',     label: 'FanDuel',    abbr: 'FD',  color: '#1493FF', dark: '#001533' },
  { key: 'draftkings',  label: 'DraftKings', abbr: 'DK',  color: '#63BE0A', dark: '#0A1A00' },
  { key: 'betmgm',      label: 'BetMGM',     abbr: 'MGM', color: '#C9A84C', dark: '#1A1200' },
  { key: 'betrivers',   label: 'BetRivers',  abbr: 'BR',  color: '#3E9FD4', dark: '#001525' },
  { key: 'hardrockbet', label: 'Hard Rock',  abbr: 'HR',  color: '#F5A623', dark: '#1A0E00' },
  { key: 'bet365',      label: 'Bet365',     abbr: '365', color: '#027B5B', dark: '#001510' },
  { key: 'thescore',    label: 'theScore',   abbr: 'SCR', color: '#E5003D', dark: '#1A0008' },
]

const SERIES_TABS = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks',  label: 'Truck Series' },
]

const MARKETS = [
  { key: 'outrights',            label: 'Outright Winner' },
  { key: 'top_3_finish',         label: 'Top 3 Finish' },
  { key: 'top_5_finish',         label: 'Top 5 Finish' },
  { key: 'top_10_finish',        label: 'Top 10 Finish' },
  { key: 'top_ford_driver',      label: 'Top Ford' },
  { key: 'top_chevrolet_driver', label: 'Top Chevy' },
  { key: 'top_toyota_driver',    label: 'Top Toyota' },
]

function fmtOdds(n) {
  if (n == null) return '—'
  return n >= 0 ? `+${n}` : `${n}`
}

function impliedProb(n) {
  if (n == null) return null
  if (n > 0) return 100 / (n + 100)
  return Math.abs(n) / (Math.abs(n) + 100)
}

function BookLogo({ book, size = 'md' }) {
  const pad = size === 'sm' ? '2px 6px' : '4px 10px'
  const fs  = size === 'sm' ? '0.6rem'  : '0.7rem'
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: pad, borderRadius: 5,
      background: book.dark, border: `1px solid ${book.color}50`,
      fontWeight: 800, fontSize: fs, color: book.color,
      letterSpacing: '0.04em', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
    }}>
      {book.abbr}
    </div>
  )
}

function OddsCell({ value, isBest }) {
  if (value == null) {
    return <td style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--text-muted)', opacity: 0.35, fontSize: '0.75rem' }}>—</td>
  }
  return (
    <td style={{
      padding: '7px 8px', textAlign: 'center',
      fontFamily: 'var(--font-mono)', fontWeight: isBest ? 700 : 500,
      fontSize: '0.8125rem',
      color: isBest ? '#22c55e' : value >= 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
      background: isBest ? 'rgba(34,197,94,0.08)' : 'transparent',
    }}>
      {fmtOdds(value)}
    </td>
  )
}

export default function OddsPage() {
  const [series, setSeries]   = useState('cup')
  const [market, setMarket]   = useState('outrights')
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchOdds = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/odds?series=${series}&market=${market}`)
      const json = await resp.json()
      if (!resp.ok) { setError(json); setData(null) }
      else { setData(json); setLastUpdated(new Date()) }
    } catch (err) {
      setError({ error: err.message }); setData(null)
    } finally {
      setLoading(false)
    }
  }, [series, market])

  useEffect(() => { fetchOdds() }, [fetchOdds])

  const rows = data?.odds || []

  return (
    <div className="page" style={{ maxWidth: 1300 }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 className="page-title" style={{ margin: 0 }}>Betting Odds</h1>
            <span style={{
              fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
              padding: '2px 8px', borderRadius: 20,
              background: 'rgba(34,197,94,0.12)', color: '#22c55e',
              border: '1px solid rgba(34,197,94,0.3)', textTransform: 'uppercase',
            }}>FREE</span>
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Line shopping across {BOOKS.length} major sportsbooks — best price highlighted in green
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button className="btn btn-secondary" onClick={fetchOdds} disabled={loading}
            style={{ fontSize: '0.75rem', padding: '5px 14px' }}>
            {loading ? '⟳ Refreshing…' : '⟳ Refresh'}
          </button>
        </div>
      </div>

      {/* Series tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {SERIES_TABS.map(t => (
          <button key={t.value} className={`tab ${series === t.value ? 'active' : ''}`}
            onClick={() => setSeries(t.value)}>{t.label}</button>
        ))}
      </div>

      {/* Market selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {MARKETS.map(m => (
          <button key={m.key} onClick={() => setMarket(m.key)} style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)',
            background: market === m.key ? 'var(--accent)' : 'var(--bg-elevated)',
            color: market === m.key ? '#fff' : 'var(--text-secondary)',
            fontSize: '0.775rem', fontWeight: market === m.key ? 600 : 400,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}>{m.label}</button>
        ))}
      </div>

      {/* Setup notice */}
      {error?.setup && (
        <div style={{ padding: '20px 24px', borderRadius: 10, marginBottom: 24,
          background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.25)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 10, color: 'var(--accent)' }}>
            ⚙ One-time setup required
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
            <li>Go to <strong style={{ color: 'var(--text-primary)' }}>theoddsapi.com</strong> and create a free account (500 req/month)</li>
            <li>Copy your API key from the dashboard</li>
            <li>In Vercel → your project → Settings → Environment Variables, add:<br />
              <code style={{ background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem' }}>ODDS_API_KEY = your_key_here</code>
            </li>
            <li>Redeploy (Vercel → Deployments → Redeploy)</li>
          </ol>
        </div>
      )}

      {/* Generic error */}
      {error && !error.setup && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 20,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444', fontSize: '0.8125rem' }}>
          {error.error || 'Failed to load odds'}
          {error.sport && <span style={{ opacity: 0.7 }}> — sport: {error.sport}</span>}
        </div>
      )}

      {/* No events */}
      {data && rows.length === 0 && (
        <div className="empty-state">
          <h3>No odds available</h3>
          <p>{data.message || 'No upcoming events or odds posted yet for this series.'}</p>
        </div>
      )}

      {/* Odds table */}
      {rows.length > 0 && (
        <>
          {data?.event && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data.event.name}</span>
                {data.event.commenceTime && (
                  <span style={{ marginLeft: 10, color: 'var(--text-muted)' }}>
                    {new Date(data.event.commenceTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {rows.length} drivers · {MARKETS.find(m => m.key === market)?.label}
              </span>
            </div>
          )}

          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border)' }}>
                  <th style={th}>#</th>
                  <th style={{ ...th, textAlign: 'left', paddingLeft: 14, minWidth: 180 }}>Driver</th>
                  {BOOKS.map(b => (
                    <th key={b.key} style={{ ...th, minWidth: 72 }}><BookLogo book={b} /></th>
                  ))}
                  <th style={{ ...th, color: '#22c55e', minWidth: 78 }}>Best</th>
                  <th style={{ ...th, minWidth: 68 }}>Win %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const prob = impliedProb(row.best)
                  return (
                    <tr key={row.driver} style={{
                      background: ri % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <td style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{ri + 1}</td>
                      <td style={{ padding: '7px 14px', fontWeight: ri < 3 ? 600 : 400, color: 'var(--text-primary)' }}>{row.driver}</td>
                      {BOOKS.map(b => <OddsCell key={b.key} value={row.books[b.key] ?? null} isBest={row.books[b.key] != null && row.books[b.key] === row.best} />)}
                      <td style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.875rem', color: '#22c55e', background: 'rgba(34,197,94,0.06)', borderLeft: '1px solid rgba(34,197,94,0.2)' }}>
                        {fmtOdds(row.best)}
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {prob != null ? `${(prob * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Book key */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16, alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: 4 }}>Books:</span>
            {BOOKS.map(b => (
              <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <BookLogo book={b} size="sm" />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{b.label}</span>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 16, fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Odds sourced via The Odds API. Always confirm current lines at each sportsbook before wagering. Must be 21+ and in a legal sports betting state. Problem gambling? Call 1-800-GAMBLER.
          </p>
        </>
      )}

      {loading && !data && (
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p>Fetching latest odds…</p>
        </div>
      )}
    </div>
  )
}

const th = {
  padding: '10px 8px', fontWeight: 700, fontSize: '0.68rem',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'var(--text-secondary)', textAlign: 'center',
}

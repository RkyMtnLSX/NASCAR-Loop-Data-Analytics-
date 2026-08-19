import React from 'react'
import { Link } from 'react-router-dom'
import PitBoardLogo from '../components/PitBoardLogo'

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, #23262c 0%, #17181d 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '64px 20px 56px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
            <PitBoardLogo height={150} />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/subscribe" className="btn btn-primary" style={{ padding: '10px 24px', border: 'none' }}>
              Get Full Access
            </Link>
            <Link to="/sim-results" className="btn btn-secondary" style={{ padding: '10px 24px' }}>
              Find This Week{'\u2019'}s Edges
            </Link>
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '48px 20px' }}>
        <h2 style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 24,
          letterSpacing: '-0.02em',
        }}>
          What's inside
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}>
          {[
            {
              icon: '🏆',
              title: 'Race Simulations',
              desc: '50,000-run Monte Carlo projections for every Cup, O\u2019Reilly, and Truck race \u2014 win, top-3/5/10, laps led, and DK points.',
              tag: 'Subscriber',
              link: '/sim-results',
            },
            {
              icon: '💰',
              title: 'Market Value',
              desc: 'Model probabilities priced against the best line across DraftKings, FanDuel, and Hard Rock.',
              tag: 'Subscriber',
              link: '/sim-results',
            },
            {
              icon: '⚔️',
              title: 'Matchup Compare',
              desc: 'Build head-to-head and group matchups from the same simulation \u2014 fair win odds for any driver combination.',
              tag: 'Subscriber',
              link: '/sim-results',
            },
            {
              icon: '🏁',
              title: 'Practice Report Cards',
              desc: 'Run-aware grading scores every driver A+ through F on clean-lap pace and best-lap speed, with graded-lap counts and tire-allocation context for every session.',
              tag: 'Subscriber',
              link: '/practice',
            },
            {
              icon: '📈',
              title: 'Practice Comparison Tool',
              desc: 'Compare drivers side-by-side on practice lap times. Spot pace gaps and consistency trends before race day.',
              tag: 'Subscriber',
              link: '/lap-comparison',
            },
            {
              icon: '⚡',
              title: 'Speed Pages',
              desc: 'Fastest-lap heat maps and green-flag speed ranks across the NextGen era \u2014 filter by track, year, and this weekend\u2019s entry list.',
              tag: 'Subscriber',
              link: '/fastest-laps',
            },
            {
              icon: '📊',
              title: 'Loop Data Browser',
              desc: 'Filter historical loop data by track, driver, series, and year. Average Running Position, green flag passes, driver rating, and more.',
              tag: 'Free preview',
              link: '/loop-data',
            },
            {
              icon: '🎯',
              title: 'DFS Tools',
              desc: 'Salary data, ownership projections, and value plays \u2014 all informed by the same simulations. Built for DraftKings and FanDuel.',
              tag: 'Coming soon',
              link: '/subscribe',
            },
          ].map(card => (
            <Link
              key={card.title}
              to={card.link}
              style={{ textDecoration: 'none' }}
            >
              <div className="card" style={{
                height: '100%',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)50'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: 12 }}>{card.icon}</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {card.title}
                  </h3>
                  <span style={{
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: card.tag === 'Free preview' ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                    color: card.tag === 'Free preview' ? 'var(--accent-text)' : 'var(--text-muted)',
                    border: `1px solid ${card.tag === 'Free preview' ? 'var(--accent)30' : 'var(--border)'}`,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>
                    {card.tag}
                  </span>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {card.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Subscribe CTA */}
      <div style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        padding: '48px 20px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 12, letterSpacing: '-0.02em' }}>
            Ready to get an edge?
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 24, lineHeight: 1.6 }}>
            Subscribe to unlock practice report cards, comparison tools, and everything we add going forward.
          </p>
          <Link to="/subscribe" className="btn btn-primary" style={{ padding: '10px 28px' }}>
            Subscribe — Coming Soon
          </Link>
        </div>
      </div>
    </div>
  )
}

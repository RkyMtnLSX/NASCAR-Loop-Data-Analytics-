import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Landing() {
  const [stats, setStats] = useState({ races: 0, drivers: 0, series: 3 })

  useEffect(() => {
    async function fetchStats() {
      const [{ count: races }, { count: drivers }] = await Promise.all([
        supabase.from('races').select('*', { count: 'exact', head: true }),
        supabase.from('loop_data').select('*', { count: 'exact', head: true }),
      ])
      setStats({ races: races || 0, drivers: drivers || 0, series: 3 })
    }
    fetchStats()
  }, [])

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-base) 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '64px 20px 56px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent)30',
            borderRadius: 20,
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: 'var(--accent)',
            textTransform: 'uppercase',
            marginBottom: 20,
          }}>
            NASCAR Analytics Platform
          </div>

          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            color: 'var(--text-primary)',
            lineHeight: 1.1,
            marginBottom: 16,
          }}>
            The data edge for<br />
            <span style={{ color: 'var(--accent)' }}>serious NASCAR bettors</span>
          </h1>

          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            marginBottom: 32,
          }}>
            Loop data, practice grades, and track correlations — all in one place.
            Built for DFS lineups and race betting.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/subscribe" className="btn btn-primary" style={{ padding: '10px 24px' }}>
              Get Full Access
            </Link>
            <Link to="/loop-data" className="btn btn-secondary" style={{ padding: '10px 24px' }}>
              Browse Loop Data
            </Link>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
      }}>
        <div style={{
          maxWidth: 1400,
          margin: '0 auto',
          padding: '20px',
          display: 'flex',
          justifyContent: 'center',
          gap: 48,
          flexWrap: 'wrap',
        }}>
          {[
            { value: stats.races.toLocaleString(), label: 'Races Loaded' },
            { value: stats.drivers.toLocaleString(), label: 'Driver Records' },
            { value: '4 Years', label: 'Of Cup Data' },
            { value: '3', label: 'Series Covered' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.02em' }}>
                {s.value}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {s.label}
              </div>
            </div>
          ))}
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
              icon: '📊',
              title: 'Loop Data Browser',
              desc: 'Filter historical loop data by track, driver, series, and year. Average Running Position, green flag passes, driver rating, and more.',
              tag: 'Free preview',
              link: '/loop-data',
            },
            {
              icon: '🏁',
              title: 'Practice Report Cards',
              desc: 'Stint-aware grading algorithm scores every driver A+ through F on long-run pace, late-run average, trend, and consistency.',
              tag: 'Subscriber',
              link: '/practice',
            },
            {
              icon: '🔗',
              title: 'Track Correlations',
              desc: 'See how drivers perform across correlated track packages. Identify who goes well at similar tracks heading into race week.',
              tag: 'Coming soon',
              link: '/correlations',
            },
            {
              icon: '🎯',
              title: 'DFS Tools',
              desc: 'Salary data, ownership projections, and value plays — all informed by loop data. Built for DraftKings and FanDuel.',
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
                    color: card.tag === 'Free preview' ? 'var(--accent)' : 'var(--text-muted)',
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
            Subscribe to unlock practice report cards, track correlations, and everything we add going forward.
          </p>
          <Link to="/subscribe" className="btn btn-primary" style={{ padding: '10px 28px' }}>
            Subscribe — Coming Soon
          </Link>
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import { Link, useLocation } from 'react-router-dom'

const NAV_LINKS = [
  { path: '/',            label: 'Race Weekend' },
  { path: '/practice',   label: 'Practice Report Cards' },
  { path: '/loop-data',  label: 'Loop Data' },
  { path: '/correlations', label: 'Track Correlations' },
]

export default function Nav({ isAdmin, onAdminClick }) {
  const location = useLocation()

  return (
    <nav style={{
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 52,
      }}>
        {/* Logo */}
        <Link to="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          textDecoration: 'none',
        }}>
          <span style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--accent)',
            textTransform: 'uppercase',
          }}>
            ⬡ PitBoard
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {NAV_LINKS.map(link => (
            <Link
              key={link.path}
              to={link.path}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: location.pathname === link.path
                  ? 'var(--text-primary)'
                  : 'var(--text-secondary)',
                background: location.pathname === link.path
                  ? 'var(--bg-elevated)'
                  : 'transparent',
                textDecoration: 'none',
                transition: 'color 0.15s, background 0.15s',
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAdmin ? (
            <Link to="/admin" className="btn btn-ghost" style={{ fontSize: '0.75rem' }}>
              Admin
            </Link>
          ) : (
            <>
              <button
                onClick={onAdminClick}
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem' }}
              >
                Sign In
              </button>
              <Link to="/subscribe" className="btn btn-primary" style={{ fontSize: '0.75rem' }}>
                Subscribe
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

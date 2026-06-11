import React, { useState, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'

const PRACTICE_LINKS = [
  { path: '/practice', label: 'Practice Report Cards' },
  { path: '/lap-comparison', label: 'Lap by Lap Practice Data' },
]

const TOP_LINKS = [
  { path: '/', label: 'Race Weekend' },
  { path: '/loop-data', label: 'Loop Data' },
  { path: '/correlations', label: 'Track Correlations' },
]

export default function Nav({ isAdmin, onAdminClick }) {
  const location = useLocation()
  const [practiceOpen, setPracticeOpen] = useState(false)
  const closeTimer = useRef(null)

  function openDropdown() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setPracticeOpen(true)
  }

  function scheduleClose() {
    closeTimer.current = setTimeout(() => setPracticeOpen(false), 200)
  }

  const isPracticePage = location.pathname === '/practice' || location.pathname === '/lap-comparison'

  const linkStyle = (active) => ({
    padding: '6px 12px',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    background: active ? 'var(--bg-elevated)' : 'transparent',
    textDecoration: 'none',
    transition: 'color 0.15s, background 0.15s',
    whiteSpace: 'nowrap',
  })

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

          {/* Race Weekend */}
          <Link to="/" style={linkStyle(location.pathname === '/')}>
            Race Weekend
          </Link>

          {/* Practice Center dropdown */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={openDropdown}
            onMouseLeave={scheduleClose}
          >
            <button style={{
              ...linkStyle(isPracticePage),
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'var(--font-sans)',
            }}>
              Practice Center
              <span style={{ fontSize: '0.55rem', opacity: 0.7, marginTop: 1 }}>▾</span>
            </button>

            {practiceOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                minWidth: 210,
                zIndex: 200,
                padding: '4px 0',
              }}>
                {PRACTICE_LINKS.map(link => (
                  <Link
                    key={link.path}
                    to={link.path}
                    style={{
                      display: 'block',
                      padding: '8px 16px',
                      fontSize: '0.8125rem',
                      fontWeight: location.pathname === link.path ? 600 : 400,
                      color: location.pathname === link.path ? 'var(--accent)' : 'var(--text-primary)',
                      textDecoration: 'none',
                      background: location.pathname === link.path ? 'var(--bg-elevated)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = location.pathname === link.path ? 'var(--bg-elevated)' : 'transparent' }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Loop Data */}
          <Link to="/loop-data" style={linkStyle(location.pathname === '/loop-data')}>
            Loop Data
          </Link>

          {/* Track Correlations */}
          <Link to="/correlations" style={linkStyle(location.pathname === '/correlations')}>
            Track Correlations
          </Link>

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
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

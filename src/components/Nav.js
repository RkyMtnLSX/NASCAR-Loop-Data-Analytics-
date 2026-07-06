import React, { useState, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'

const PRACTICE_LINKS = [
  { path: '/practice',           label: 'Practice Report Cards' },
  { path: '/lap-comparison',     label: 'Practice Comparison Tool' },
  { path: '/practice-lap-table', label: 'Lap by Lap Data' },
]

const LOOP_LINKS = [
  { path: '/loop-data',       label: 'Loop Data' },
  { path: '/fastest-laps',    label: 'Fastest Laps' },
]

const SIM_LINKS = [
  { path: '/sim-results',       label: 'Sim Results' },
]

export default function Nav({ isAdmin, onAdminClick }) {
  const location = useLocation()
  const [practiceOpen, setPracticeOpen] = useState(false)
  const [loopOpen, setLoopOpen]         = useState(false)
  const [simOpen, setSimOpen]           = useState(false)
  const practiceTimer = useRef(null)
  const loopTimer     = useRef(null)
  const simTimer      = useRef(null)

  function makeHover(setter, timer) {
    return {
      onMouseEnter: () => { if (timer.current) clearTimeout(timer.current); setter(true) },
      onMouseLeave: () => { timer.current = setTimeout(() => setter(false), 200) },
    }
  }

  const isPracticePage = PRACTICE_LINKS.some(l => location.pathname === l.path)
  const isLoopPage     = LOOP_LINKS.some(l => location.pathname === l.path)
  const isSimPage      = SIM_LINKS.some(l => location.pathname === l.path)

  const linkStyle = (active) => ({
    padding: '6px 12px', borderRadius: 'var(--radius-md)',
    fontSize: '0.8125rem', fontWeight: 500,
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    background: active ? 'var(--bg-elevated)' : 'transparent',
    textDecoration: 'none', transition: 'color 0.15s, background 0.15s',
    whiteSpace: 'nowrap',
  })

  function Dropdown({ links, open }) {
    return open ? (
      <div style={{
        position: 'absolute', top: '100%', left: 0,
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        minWidth: 220, zIndex: 200, padding: '4px 0',
      }}>
        {links.map(link => (
          <Link key={link.path} to={link.path} style={{
            display: 'block', padding: '8px 16px', fontSize: '0.8125rem',
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
    ) : null
  }

  const dropBtn = (active) => ({
    ...linkStyle(active), border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-sans)',
  })

  return (
    <nav style={{
      background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{
        maxWidth: 1400, margin: '0 auto', padding: '0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52,
      }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em',
            color: 'var(--accent)', textTransform: 'uppercase' }}>
            ⬡ PitBoard
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>

          <Link to="/" style={linkStyle(location.pathname === '/')}>Race Weekend</Link>

          {/* Practice Center dropdown */}
          <div style={{ position: 'relative' }} {...makeHover(setPracticeOpen, practiceTimer)}>
            <button style={dropBtn(isPracticePage)}>
              Practice Center
              <span style={{ fontSize: '0.55rem', opacity: 0.7, marginTop: 1 }}>▾</span>
            </button>
            <Dropdown links={PRACTICE_LINKS} open={practiceOpen} />
          </div>

          {/* Loop Data dropdown */}
          <div style={{ position: 'relative' }} {...makeHover(setLoopOpen, loopTimer)}>
            <button style={dropBtn(isLoopPage)}>
              Loop Data
              <span style={{ fontSize: '0.55rem', opacity: 0.7, marginTop: 1 }}>▾</span>
            </button>
            <Dropdown links={LOOP_LINKS} open={loopOpen} />
          </div>

          <Link to="/qualifying" style={linkStyle(location.pathname === '/qualifying')}>
            Qualifying
          </Link>

          {/* Simulation dropdown */}
          <div style={{ position: 'relative' }} {...makeHover(setSimOpen, simTimer)}>
            <button style={dropBtn(isSimPage)}>
              Simulation
              <span style={{ fontSize: '0.55rem', opacity: 0.7, marginTop: 1 }}>▾</span>
            </button>
            <Dropdown links={SIM_LINKS} open={simOpen} />
          </div>

        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAdmin ? (
            <>
              <Link to="/admin" className="btn btn-ghost" style={{ fontSize: '0.75rem' }}>Admin</Link>
              <Link to="/simulation-center" className="btn btn-ghost" style={{ fontSize: '0.75rem' }}>Sim Center</Link>
            </>
          ) : (
            <>
              <button onClick={onAdminClick} className="btn btn-ghost" style={{ fontSize: '0.75rem' }}>
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

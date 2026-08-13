import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import './styles/global.css'

import Nav                from './components/Nav'
import RacingStripes      from './components/RacingStripes'
import Landing            from './pages/Landing'
import PracticeReportCard from './pages/PracticeReportCard'
import LapComparison      from './pages/LapComparison'
import PracticeLapTable   from './pages/PracticeLapTable'
import LoopData           from './pages/LoopData'
import LoopDataAudit      from './pages/LoopDataAudit'
import PracticeAudit      from './pages/PracticeAudit'
import QualifyingAudit    from './pages/QualifyingAudit'
import FastestLap         from './pages/FastestLap'
import GreenFlagSpeed     from './pages/GreenFlagSpeed'
import PitCrewRankings   from './pages/PitCrewRankings'
import QualifyingCenter   from './pages/QualifyingCenter'
import SimulationCenter   from './pages/SimulationCenter'
import GradeCenter        from './pages/GradeCenter'
import SimResults         from './pages/SimResults'
import DFSPage            from './pages/DFSPage'
import Admin              from './pages/Admin'
import Subscribe          from './pages/Subscribe'
import Account            from './pages/Account'
import useSubscriber      from './lib/useSubscriber'

const ADMIN_PW = 'pitboard2026'

// HARD PAYWALL (2026-08-09): everything except the landing page and /subscribe
// requires an active membership. KILL-SWITCH below stays false until the Stripe
// flow is verified end-to-end in test mode - flipping it live is a one-word change.
const PAYWALL_ENABLED = false

function PaywallGate({ ok, loading }) {
  const loc = useLocation()
  if (!PAYWALL_ENABLED || ok || loading) return null
  if (loc.pathname === '/' || loc.pathname === '/subscribe' || loc.pathname === '/account') return null
  return <Navigate to="/subscribe" replace />
}

function AdminGate() {
  return (
    <div className="page" style={{ maxWidth: 400, textAlign: 'center', paddingTop: 80 }}>
      <h2 style={{ color: 'var(--text-primary)' }}>Admin Access Required</h2>
      <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Sign in via the nav to continue.</p>
    </div>
  )
}

export default function App() {
  // Subscriber state — controls feature access (must remain true for all users)
  const [isSubscriber] = useState(true) // per-page prop stays permissive; access enforced by PaywallGate redirect
  const __sub = useSubscriber()

  const [pwAdmin, setPwAdmin]     = useState(false)
  // master admin (2026-08-12): the operator's signed-in account grants admin via the
  // admins table - the password modal is a legacy fallback slated for removal (#64)
  const isAdmin = pwAdmin || __sub.isAdminUser
  const [showLogin, setShowLogin] = useState(false)
  const [pw, setPw]               = useState('')
  const [pwError, setPwError]     = useState(false)

  const handleLogin = () => {
    if (pw === ADMIN_PW) {
      setPwAdmin(true)
      setShowLogin(false)
      setPw('')
      setPwError(false)
    } else {
      setPwError(true)
    }
  }

  return (
    <BrowserRouter>
      <RacingStripes />
      <Nav
        isAdmin={isAdmin}
        onAdminClick={() => setShowLogin(true)}
        onSignOut={() => setPwAdmin(false)}
      />
      <PaywallGate ok={__sub.isSubscriber || isAdmin} loading={__sub.loading} />

      {showLogin && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLogin(false)
              setPwError(false)
              setPw('')
            }
          }}
        >
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 32,
            width: 320, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <h2 style={{ margin: '0 0 20px', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
              Admin Sign In
            </h2>
            <input
              type="password"
              placeholder="Password"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setPwError(false) }}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: pwError ? '1px solid #f87171' : '1px solid var(--border)',
                background: 'var(--bg-surface)', color: 'var(--text-primary)',
                fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: 8,
              }}
            />
            {pwError && (
              <p style={{ color: '#f87171', fontSize: '0.8rem', margin: '0 0 12px' }}>
                Incorrect password
              </p>
            )}
            <button
              onClick={handleLogin}
              style={{
                width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: '#111', fontWeight: 700,
                fontSize: '0.9rem', cursor: 'pointer', marginTop: pwError ? 0 : 8,
              }}
            >
              Sign In
            </button>
          </div>
        </div>
      )}

      <Routes>
        <Route path="/"                   element={<Landing />} />
        <Route path="/practice"           element={<PracticeReportCard isSubscriber={isSubscriber} />} />
        <Route path="/lap-comparison"     element={<LapComparison isSubscriber={isSubscriber} />} />
        <Route path="/practice-lap-table" element={<PracticeLapTable isSubscriber={isSubscriber} />} />
        <Route path="/loop-data"          element={<LoopData isSubscriber={isSubscriber} />} />
        <Route path="/loop-data-audit"    element={<LoopDataAudit />} />
        <Route path="/practice-audit"    element={<PracticeAudit />} />
        <Route path="/qualifying-audit"  element={<QualifyingAudit />} />
        <Route path="/fastest-laps"       element={<FastestLap />} />
            <Route path="/green-flag-speed"   element={<GreenFlagSpeed />} />
          <Route path="/pit-crew-rankings"  element={<PitCrewRankings />} />
        <Route path="/qualifying"         element={<QualifyingCenter isSubscriber={isSubscriber} />} />
        <Route path="/simulation-center"  element={isAdmin ? <SimulationCenter isSubscriber={isSubscriber} /> : <AdminGate />} />
        <Route path="/grade-center"     element={isAdmin ? <GradeCenter /> : <AdminGate />} />
        <Route path="/sim-results"        element={<SimResults />} />
        <Route path="/subscribe"          element={<Subscribe />} />
        <Route path="/account"           element={<Account />} />
        <Route path="/admin"              element={isAdmin ? <Admin /> : <AdminGate />} />
        <Route path="/dfs"             element={<DFSPage />} />
      </Routes>
    </BrowserRouter>
  )
}

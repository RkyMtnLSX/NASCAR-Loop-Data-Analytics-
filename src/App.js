import React, { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import QualifyingCenter   from './pages/QualifyingCenter'
import SimulationCenter   from './pages/SimulationCenter'
import GradeCenter        from './pages/GradeCenter'
import SimResults         from './pages/SimResults'
import Admin              from './pages/Admin'

const ADMIN_PW = 'pitboard2026'

function Subscribe() {
  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="page-header">
        <h1 className="page-title">Subscribe</h1>
        <p className="page-subtitle">Get full access to all features</p>
      </div>
      <div className="card">
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Subscription payments coming soon via Stripe.
        </p>
      </div>
    </div>
  )
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
  const [isSubscriber] = useState(true)

  const [isAdmin, setIsAdmin]     = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [pw, setPw]               = useState('')
  const [pwError, setPwError]     = useState(false)

  const handleLogin = () => {
    if (pw === ADMIN_PW) {
      setIsAdmin(true)
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
        onSignOut={() => setIsAdmin(false)}
      />

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
        <Route path="/qualifying"         element={<QualifyingCenter isSubscriber={isSubscriber} />} />
        <Route path="/simulation-center"  element={isAdmin ? <SimulationCenter isSubscriber={isSubscriber} /> : <AdminGate />} />
        <Route path="/grade-center"     element={isAdmin ? <GradeCenter /> : <AdminGate />} />
        <Route path="/sim-results"        element={<SimResults />} />
        <Route path="/subscribe"          element={<Subscribe />} />
        <Route path="/admin"              element={isAdmin ? <Admin /> : <AdminGate />} />
      </Routes>
    </BrowserRouter>
  )
}

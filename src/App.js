import React, { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './styles/global.css'

import Nav from './components/Nav'
import Landing from './pages/Landing'
import PracticeReportCard from './pages/PracticeReportCard'
import LapComparison from './pages/LapComparison'
import PracticeLapTable from './pages/PracticeLapTable'
import LoopData from './pages/LoopData'
import LoopDataAudit from './pages/LoopDataAudit'
import FastestLap from './pages/FastestLap'
import QualifyingCenter from './pages/QualifyingCenter'
import SimulationCenter from './pages/SimulationCenter'
import SimResults from './pages/SimResults'
import Admin from './pages/Admin'

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
    <div className="page" style={{ maxWidth: 480 }}>
      <div className="page-header">
        <h1 className="page-title">Admin Access Required</h1>
        <p className="page-subtitle">Click Sign In in the nav to authenticate.</p>
      </div>
    </div>
  )
}

export default function App() {
  // Subscriber state — controls feature access (must remain true for all users)
  const [isSubscriber] = useState(true)
  const [isAdmin, setIsAdmin]         = useState(false)
  const [showLogin, setShowLogin]     = useState(false)
  const [pw, setPw]                   = useState('')
  const [pwError, setPwError]         = useState(false)

  function handleAdminLogin(e) {
    e.preventDefault()
    if (pw === ADMIN_PW) {
      setIsAdmin(true); setShowLogin(false); setPw(''); setPwError(false)
    } else {
      setPwError(true)
    }
  }

  const modalOverlay = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  const modalBox = {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '28px 32px', minWidth: 320,
  }

  return (
    <BrowserRouter>
      <Nav isAdmin={isAdmin} onAdminClick={() => setShowLogin(true)} />

      {showLogin && (
        <div style={modalOverlay} onClick={() => setShowLogin(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 700 }}>Admin Sign In</h2>
            <form onSubmit={handleAdminLogin}>
              <input
                type="password" value={pw} autoFocus
                onChange={e => { setPw(e.target.value); setPwError(false) }}
                placeholder="Password"
                style={{
                  width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                  background: 'var(--bg-elevated)', fontSize: '0.875rem',
                  border: `1px solid ${pwError ? '#ef4444' : 'var(--border)'}`,
                  borderRadius: 6, color: 'var(--text-primary)',
                  marginBottom: pwError ? 6 : 16,
                }}
              />
              {pwError && <p style={{ color: '#ef4444', fontSize: '0.78rem', margin: '0 0 12px' }}>Incorrect password</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" style={{ flex: 1, padding: 9, background: 'var(--accent)', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', color: '#111' }}>Sign In</button>
                <button type="button" onClick={() => { setShowLogin(false); setPw(''); setPwError(false) }} style={{ flex: 1, padding: 9, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
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
        <Route path="/fastest-laps"       element={<FastestLap />} />
        <Route path="/qualifying"         element={<QualifyingCenter isSubscriber={isSubscriber} />} />
        <Route path="/simulation-center"  element={isAdmin ? <SimulationCenter isSubscriber={isSubscriber} /> : <AdminGate />} />
        <Route path="/sim-results"        element={<SimResults />} />
        <Route path="/subscribe"          element={<Subscribe />} />
        <Route path="/admin"              element={isAdmin ? <Admin /> : <AdminGate />} />
      </Routes>
    </BrowserRouter>
  )
}

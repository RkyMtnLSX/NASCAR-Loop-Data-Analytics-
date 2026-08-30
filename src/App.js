import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import './styles/global.css'

import Nav                from './components/Nav'
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
import OptimalLineups     from './pages/OptimalLineups'
import Admin              from './pages/Admin'
import Subscribe          from './pages/Subscribe'
import Account            from './pages/Account'
import useSubscriber      from './lib/useSubscriber'


// HARD PAYWALL (2026-08-09): everything except the landing page and /subscribe
// requires an active membership. KILL-SWITCH below stays false until the Stripe
// flow is verified end-to-end in test mode - flipping it live is a one-word change.
const PAYWALL_ENABLED = true

function PaywallGate({ ok, loading }) {
  const loc = useLocation()
  if (!PAYWALL_ENABLED || ok || loading) return null
  // PUBLIC FUNNEL PAGE (2026-08-23, operator decision): Lap By Lap is free to everyone.
  // It is served entirely by the get_public_* RPCs, which join featured_weekend and so
  // can only ever return the CURRENT configured weekend — no archive, no bulk pull.
  if (loc.pathname === '/' || loc.pathname === '/subscribe' || loc.pathname === '/account' || loc.pathname === '/practice-lap-table' || loc.pathname === '/optimal-lineups') return null
  return <Navigate to="/subscribe" replace state={{ gated: true }} />
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

  // master admin only (2026-08-12): password auth fully removed
  const isAdmin = __sub.isAdminUser

  return (
    <BrowserRouter>
      <Nav
        isAdmin={isAdmin}
        />
      <PaywallGate ok={__sub.isSubscriber || isAdmin} loading={__sub.loading} />

      

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
        <Route path="/optimal-lineups" element={<OptimalLineups />} />
      </Routes>
    </BrowserRouter>
  )
}

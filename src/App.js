import React, { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './styles/global.css'

import Nav from './components/Nav'
import Landing from './pages/Landing'
import PracticeReportCard from './pages/PracticeReportCard'
import LapComparison from './pages/LapComparison'
import PracticeLapTable from './pages/PracticeLapTable'
import LoopData from './pages/LoopData'
import OddsPage from './pages/OddsPage'
import Admin from './pages/Admin'
import QualifyingCenter from './pages/QualifyingCenter'
import FastestLap from './pages/FastestLap'
import LoopDataAudit from './pages/LoopDataAudit'

function Correlations({ isSubscriber }) {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Track Correlations</h1>
        <p className="page-subtitle">Current year loop data across correlated tracks â coming soon</p>
      </div>
      <div className="empty-state">
        <h3>Coming soon</h3>
        <p>Track correlation tool is being built.</p>
      </div>
    </div>
  )
}

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

export default function App() {
  // Temporary subscriber state â will be replaced with real auth
  const [isSubscriber] = useState(true)

  return (
    <BrowserRouter>
      <Nav isAdmin={false} />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/practice" element={<PracticeReportCard isSubscriber={isSubscriber} />} />
        <Route path="/lap-comparison" element={<LapComparison isSubscriber={isSubscriber} />} />
        <Route path="/practice-lap-table" element={<PracticeLapTable isSubscriber={isSubscriber} />} />
        <Route path="/loop-data" element={<LoopData isSubscriber={isSubscriber} />} />
        <Route path="/correlations" element={<Correlations isSubscriber={isSubscriber} />} />
        <Route path="/qualifying"   element={<QualifyingCenter isSubscriber={isSubscriber} />} />
        <Route path="/fastest-laps" element={<FastestLap isSubscriber={isSubscriber} />} />
        <Route path="/loop-audit" element={<LoopDataAudit />} />
        <Route path="/odds" element={<OddsPage />} />
        <Route path="/subscribe" element={<Subscribe />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  )
}

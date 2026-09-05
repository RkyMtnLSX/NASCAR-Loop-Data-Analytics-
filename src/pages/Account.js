import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useSubscriber from '../lib/useSubscriber'

// My Profile (2026-08-12): account + membership state + Stripe billing portal.
export default function Account() {
  const { user, row, isSubscriber, loading } = useSubscriber()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const portal = async () => {
    setBusy(true); setMsg('')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data && data.session ? data.session.access_token : null
      const r = await fetch('/api/create-portal-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      })
      const j = await r.json()
      if (!r.ok || !j.url) throw new Error(j.error || 'could not open billing portal')
      window.location.href = j.url
    } catch (e) { setMsg(String((e && e.message) || e)); setBusy(false) }
  }

  if (loading) return <div className="page" style={{ maxWidth: 600 }}><div className="card">Loading...</div></div>

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">Account and membership</p>
      </div>
      {!user ? (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>You are not signed in.</p>
          <Link to="/subscribe" className="btn-primary" style={{ display: 'inline-block', padding: '8px 18px' }}>Sign in or create an account</Link>
        </div>
      ) : (
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Signed in as</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, margin: '2px 0 10px' }}>{user.email}</div>
            <span style={{ cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem', color: 'var(--text-secondary)' }} onClick={() => supabase.auth.signOut()}>Sign out</span>
          </div>
          <div className="card">
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Membership</div>
            {isSubscriber ? (
              <div>
                <div style={{ color: '#22c55e', fontWeight: 700, marginBottom: 6 }}>Active</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                  {row && row.plan === 'beta'
                    ? 'Beta access - free through ' + (row.access_until ? new Date(row.access_until).toLocaleDateString() : '-') + '. Thanks for testing - send feedback to ' + 'atmmstrs2@gmail.com'
                    : row && row.plan === 'week'
                    ? 'Race week pass - renews weekly, paid through ' + (row.access_until ? new Date(row.access_until).toLocaleString() : '-')
                    : 'Founding monthly - $24.99/mo, locked in for life' + (row && row.access_until ? ' - paid through ' + new Date(row.access_until).toLocaleDateString() : '')}
                </div>
                {row && row.plan !== 'beta' && (   // beta rows have no Stripe customer - no portal (2026-09-05)
                  <button className="btn-primary" disabled={busy} onClick={portal} style={{ padding: '8px 18px' }}>Manage billing</button>
                )}
                {msg && <div style={{ marginTop: 10, fontSize: '0.85rem', color: '#ef4444' }}>{msg}</div>}
              </div>
            ) : (
              <div>
                <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>{row && row.status ? 'Inactive (' + row.status + ')' : 'No membership'}</div>
                <Link to="/subscribe" className="btn-primary" style={{ display: 'inline-block', padding: '8px 18px' }}>See plans</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

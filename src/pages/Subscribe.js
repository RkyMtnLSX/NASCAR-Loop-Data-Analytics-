import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import useSubscriber from '../lib/useSubscriber'

// Subscribe page (2026-08-09): account + Stripe Checkout. Founding $24.99/mo
// (list $34.99) and $9.99 week pass. No trials. Card entry happens on Stripe's
// hosted page - no payment data ever touches this app.
export default function Subscribe() {
  const { user, row, isSubscriber, refresh } = useSubscriber()
  const [mode, setMode] = useState('signup')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const status = new URLSearchParams(window.location.search).get('status')

  useEffect(() => { if (status === 'success') refresh() }, [status, refresh])

  const auth = async () => {
    setBusy(true); setMsg('')
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password: pw })
        if (error) throw error
        setMsg(data && data.session ? 'Account created - pick a plan below.' : 'Check your email to confirm your account, then sign in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
        if (error) throw error
      }
    } catch (e) { setMsg(String((e && e.message) || e)) }
    setBusy(false)
  }

  const checkout = async (plan) => {
    setBusy(true); setMsg('')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data && data.session ? data.session.access_token : null
      const r = await fetch('/api/create-checkout-session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, token }),
      })
      const j = await r.json()
      if (!r.ok || !j.url) throw new Error(j.error || 'Could not start checkout.')
      window.location.href = j.url
    } catch (e) { setMsg(String((e && e.message) || e)); setBusy(false) }
  }

  const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', marginBottom: 10 }
  const planCard = { flex: '1 1 240px', maxWidth: 300, padding: 22, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)' }

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <div className="page-header">
        <h1 className="page-title">Subscribe</h1>
        <p className="page-subtitle">The model behind every bet and lineup - full access</p>
      </div>

      {status === 'success' && (
        <div className="card" style={{ borderColor: '#22c55e', marginBottom: 16 }}>
          <b style={{ color: '#22c55e' }}>Payment received.</b> Your access is live - if a page still shows locked, refresh once (the payment confirmation can take a few seconds).
        </div>
      )}
      {status === 'cancelled' && (
        <div className="card" style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>Checkout cancelled - no charge was made.</div>
      )}

      {!user ? (
        <div className="card" style={{ maxWidth: 420 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[['signup', 'Create account'], ['signin', 'Sign in']].map(t => (
              <button key={t[0]} onClick={() => { setMode(t[0]); setMsg('') }} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: mode === t[0] ? 'var(--accent)' : 'transparent', color: mode === t[0] ? '#111' : 'var(--text-secondary)', fontWeight: 600 }}>{t[1]}</button>
            ))}
          </div>
          <input style={inp} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={inp} type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && auth()} />
          <button className="btn-primary" disabled={busy} onClick={auth} style={{ width: '100%' }}>{mode === 'signup' ? 'Create account' : 'Sign in'}</button>
          {msg && <div style={{ marginTop: 10, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{msg}</div>}
        </div>
      ) : isSubscriber ? (
        <div className="card">
          <b style={{ color: '#22c55e' }}>Membership active</b>
          <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {row && row.plan === 'week'
              ? 'Week pass - access until ' + (row.access_until ? new Date(row.access_until).toLocaleString() : '-')
              : 'Founding monthly - $24.99/mo, locked in for life.'}
          </div>
          <div style={{ marginTop: 14, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Signed in as {user.email} - <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => supabase.auth.signOut()}>sign out</span>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ ...planCard, borderColor: 'var(--accent)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Founding rate - locked for life</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, margin: '8px 0 2px' }}>$24.99<span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}>/mo</span></div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}><s>$34.99</s> after launch - founding members keep this price forever</div>
              <button className="btn-primary" disabled={busy} onClick={() => checkout('monthly')} style={{ width: '100%' }}>Become a founding member</button>
            </div>
            <div style={planCard}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Race week pass</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, margin: '8px 0 2px' }}>$9.99<span style={{ fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)' }}> one-time</span></div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>7 days of full access - every board, flag and tool for one race weekend</div>
              <button className="btn-primary" disabled={busy} onClick={() => checkout('week')} style={{ width: '100%', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>Get a week pass</button>
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Signed in as {user.email} - <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => supabase.auth.signOut()}>sign out</span>
          </div>
          {msg && <div style={{ marginTop: 10, fontSize: '0.85rem', color: '#ef4444' }}>{msg}</div>}
        </div>
      )}
    </div>
  )
}

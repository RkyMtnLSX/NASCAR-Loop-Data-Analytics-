import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
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
  const loc = useLocation()
  const gated = !!(loc.state && loc.state.gated)

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
  const planCard = { flex: '1 1 280px', maxWidth: 340, padding: 26, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)' }

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <div className="page-header">
        <h1 className="page-title">Subscribe</h1>
        <p className="page-subtitle">Full access to PitBoard Analytics</p>
      </div>

      {status !== 'success' && !isSubscriber && (user && row ? (
        <div className="card" style={{ borderColor: 'var(--series-cup)', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: '#ff5148', letterSpacing: '.02em', marginBottom: 4 }}>
            {row.plan === 'beta' ? 'YOUR BETA ACCESS HAS ENDED' : row.plan === 'week' ? 'YOUR RACE WEEK PASS HAS ENDED' : 'YOUR MEMBERSHIP IS INACTIVE'}
          </div>
          <div style={{ color: 'var(--text-muted)' }}>
            {row.plan === 'beta'
              ? 'Thanks for testing PitBoard. Pick a plan below to keep going, or ask Aaron to extend your beta.'
              : row.plan === 'week'
              ? 'Grab a new week pass below, or lock in the founding monthly rate before it goes up.'
              : 'Renew below to get back to every board, flag and tool.'}
          </div>
        </div>
      ) : gated ? (
        <div className="card" style={{ borderColor: 'var(--series-cup)', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: '#ff5148', letterSpacing: '.02em', marginBottom: 4 }}>
            MEMBERSHIP REQUIRED
          </div>
          <div style={{ color: 'var(--text-muted)' }}>
            PitBoard content is members-only. {user ? 'Pick a plan below for full access.' : 'Sign in or create an account, then pick a plan below.'}
          </div>
        </div>
      ) : null)}

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
              <button key={t[0]} onClick={() => { setMode(t[0]); setMsg('') }} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: mode === t[0] ? 'var(--accent)' : 'transparent', color: mode === t[0] ? '#fff' : 'var(--text-secondary)', fontWeight: 600 }}>{t[1]}</button>
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
            {row && row.plan === 'beta'
              ? 'Beta tester - free access through ' + (row.access_until ? new Date(row.access_until).toLocaleDateString() : '-') + '.'
              : row && row.plan === 'week'
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
            {[
              {
                key: 'week', chip: 'RACE WEEK', chipHot: false, name: 'Weekly',
                price: '$9.99', per: ' /week',
                note: 'Full access, billed weekly - cancel anytime.',
                cta: 'GET WEEKLY ACCESS',
              },
              {
                key: 'monthly', chip: 'FOUNDING RATE', chipHot: true, name: 'Monthly',
                price: '$24.99', per: ' /month',
                note: <span><s>$34.99</s> after launch - founding members keep this price for life.</span>,
                cta: 'GET MONTHLY ACCESS',
              },
            ].map(p => (
              <div key={p.key} style={{ ...planCard, display: 'flex', flexDirection: 'column' }}>
                <div style={{ alignSelf: 'flex-start', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', padding: '6px 14px', borderRadius: 999, background: p.chipHot ? 'var(--series-cup)' : 'var(--bg-elevated)', color: p.chipHot ? '#fff' : 'var(--text-secondary)', border: p.chipHot ? 'none' : '1px solid var(--border)', marginBottom: 16 }}>{p.chip}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>{p.name}</div>
                <div style={{ fontSize: '2.6rem', fontWeight: 800, marginBottom: 10 }}>{p.price}<span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-muted)' }}>{p.per}</span></div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 18, minHeight: 40 }}>{p.note}</div>
                <button disabled={busy} onClick={() => checkout(p.key)} style={{ width: '100%', marginTop: 'auto', padding: '16px 0', fontWeight: 800, letterSpacing: '0.05em', borderRadius: 8, fontSize: '1rem', background: 'var(--series-cup)', color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>{p.cta}</button>
              </div>
            ))}
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

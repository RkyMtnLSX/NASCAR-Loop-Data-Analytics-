import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Beta Access (2026-09-05). Beta testers are ordinary Supabase accounts (they sign up on /subscribe)
// plus a subscribers row of plan='beta' with an access_until date. Nothing else is needed: the
// has_access() predicate and useSubscriber() already honor access_until > now(), the Stripe webhook
// never touches an account that never checked out, and an expired row falls to the normal
// "membership inactive" state on its own. All four RPCs re-check is_admin() server-side.
const DEFAULT_UNTIL = '2026-11-30'   // through the end of the 2026 season (Phoenix is early Nov)

export default function BetaAccessAdmin() {
  const [rows, setRows] = useState([])
  const [pending, setPending] = useState([])
  const [email, setEmail] = useState('')
  const [until, setUntil] = useState(DEFAULT_UNTIL)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_beta_access')
    if (error) setMsg('Could not list beta rows: ' + error.message)
    setRows(data || [])
    const { data: p, error: e2 } = await supabase.rpc('list_unassigned_accounts')
    if (e2) setMsg(m => (m ? m + ' ' : '') + 'Could not list unassigned accounts: ' + e2.message)
    setPending(p || [])
  }, [])
  useEffect(() => { load() }, [load])

  const grant = async (em) => {
    const target = (em || email).trim()
    if (!target) { setMsg('Enter the tester\'s email.'); return }
    if (!until) { setMsg('Pick an end date.'); return }
    setBusy(true); setMsg('')
    // end of the chosen day, local time
    const iso = new Date(until + 'T23:59:59').toISOString()
    const { data, error } = await supabase.rpc('grant_beta_access', { p_email: target, p_until: iso })
    if (error) setMsg('Grant failed: ' + error.message)
    else { setMsg('Granted: ' + (data && data[0] ? data[0].email + ' through ' + new Date(data[0].access_until).toLocaleDateString() : target)); setEmail('') }
    await load(); setBusy(false)
  }
  const revoke = async (r) => {
    setBusy(true); setMsg('')
    const { error } = await supabase.rpc('revoke_beta_access', { p_user_id: r.user_id })
    setMsg(error ? 'Revoke failed: ' + error.message : 'Revoked ' + r.email)
    await load(); setBusy(false)
  }

  const inp = { padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(128,128,128,0.35)', background: 'transparent', color: 'inherit', boxSizing: 'border-box' }
  const btn = (bg) => ({ padding: '8px 14px', borderRadius: 6, border: 'none', cursor: busy ? 'default' : 'pointer', background: bg, color: '#fff', fontWeight: 600, opacity: busy ? 0.6 : 1 })
  const th = { textAlign: 'left', padding: '6px 8px', fontSize: '0.78rem', color: 'var(--text-muted)', borderBottom: '1px solid rgba(128,128,128,0.25)' }
  const td = { padding: '6px 8px', fontSize: '0.88rem', borderBottom: '1px solid rgba(128,128,128,0.12)' }
  const now = Date.now()

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 6 }}>Beta Access</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 12 }}>
          How it works: the tester creates an account on <b>/subscribe</b> (email + password, no card). Then grant them here by email.
          They get full member access until the end date, no Stripe involved. Granting again extends or shortens; Revoke ends it now.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="tester@email.com" style={{ ...inp, width: 260 }} onKeyDown={e => { if (e.key === 'Enter') grant() }} />
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>through</label>
          <input type="date" value={until} onChange={e => setUntil(e.target.value)} style={inp} />
          <button disabled={busy} onClick={() => grant()} style={btn('#1a6b2e')}>Grant beta access</button>
        </div>
        {msg && <div style={{ marginTop: 10, fontSize: '0.85rem', color: /failed|Could not|Enter|Pick/.test(msg) ? '#e57373' : '#81c784' }}>{msg}</div>}
      </div>

      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 600, marginBottom: 8 }}>Signed up, no access yet ({pending.length})</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Email</th><th style={th}>Signed up</th><th style={th}>Email confirmed</th><th style={th}></th></tr></thead>
            <tbody>{pending.map(p => (
              <tr key={p.user_id}>
                <td style={td}>{p.email}</td>
                <td style={td}>{new Date(p.created_at).toLocaleDateString()}</td>
                <td style={td}>{p.confirmed ? 'yes' : 'no'}</td>
                <td style={td}><button disabled={busy} onClick={() => grant(p.email)} style={btn('#1a6b2e')}>Grant through {new Date(until + 'T12:00:00').toLocaleDateString()}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h3 style={{ fontSize: '0.92rem', fontWeight: 600, marginBottom: 8 }}>Beta testers ({rows.length})</h3>
        {!rows.length && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No beta rows yet.</div>}
        {rows.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Email</th><th style={th}>Status</th><th style={th}>Access through</th><th style={th}>Last sign-in</th><th style={th}></th></tr></thead>
            <tbody>{rows.map(r => {
              const live = r.access_until && new Date(r.access_until).getTime() > now
              return (
                <tr key={r.user_id}>
                  <td style={td}>{r.email}{!r.confirmed && <span style={{ color: '#e8b923', fontSize: '0.75rem', marginLeft: 6 }}>(email unconfirmed)</span>}</td>
                  <td style={{ ...td, color: live ? '#81c784' : '#e57373', fontWeight: 600 }}>{live ? 'active' : (r.status === 'revoked' ? 'revoked' : 'expired')}</td>
                  <td style={td}>{r.access_until ? new Date(r.access_until).toLocaleDateString() : '-'}</td>
                  <td style={td}>{r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleString() : 'never'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button disabled={busy} onClick={() => grant(r.email)} style={{ ...btn('#2f4f8f'), marginRight: 6 }}>Set through {new Date(until + 'T12:00:00').toLocaleDateString()}</button>
                    {live && <button disabled={busy} onClick={() => revoke(r)} style={btn('#8b2c2c')}>Revoke</button>}
                  </td>
                </tr>
              )
            })}</tbody>
          </table>
        )}
      </div>
    </div>
  )
}

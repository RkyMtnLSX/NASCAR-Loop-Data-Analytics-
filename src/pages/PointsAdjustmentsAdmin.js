// src/pages/PointsAdjustmentsAdmin.js - the ledger the race feed does not carry (2026-10-12).
// NASCAR's weekend feed records points as scored at the track; a Tuesday inspection penalty (-25,
// -75, loss of stage points) never changes it, so standings computed from the feed drift by the
// penalty. This panel is where those few rows a season are entered. Standings = feed + sum(delta).
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const SERIES = [['cup', 'Cup'], ['oreilly', "O'Reilly"], ['trucks', 'Trucks']]
const inp = { padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.875rem', width: '100%' }
const lbl = { display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }

export default function PointsAdjustmentsAdmin() {
  const yearNow = new Date().getFullYear()
  const [series, setSeries] = useState('cup')
  const [year, setYear] = useState(yearNow)
  const [rows, setRows] = useState([])
  const [drivers, setDrivers] = useState([])
  const [races, setRaces] = useState([])
  const [form, setForm] = useState({ driver_name: '', nascar_race_id: '', delta: '', reason: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('points_adjustments').select('*').eq('series', series).eq('year', year).order('created_at', { ascending: false })
    setRows(data || [])
  }
  useEffect(() => {
    load()
    // Driver and race names come from the same standings feed the page uses, so the spelling matches.
    fetch('/api/nascar-feed?type=standings&sk=' + series + '&year=' + year).then(r => r.json()).then(j => {
      setDrivers((j.rows || []).map(r => r.name).sort())
      setRaces(j.races || [])
    }).catch(() => { setDrivers([]); setRaces([]) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, year])

  const add = async () => {
    const delta = parseInt(form.delta, 10)
    if (!form.driver_name || !Number.isInteger(delta) || delta === 0) { setMsg('Driver and a non-zero points delta are required.'); return }
    setBusy(true); setMsg('')
    const { error } = await supabase.from('points_adjustments').insert({ series, year, driver_name: form.driver_name, nascar_race_id: form.nascar_race_id ? +form.nascar_race_id : null, delta, reason: form.reason || null })
    setBusy(false)
    if (error) { setMsg('Error: ' + error.message); return }
    setForm({ driver_name: '', nascar_race_id: '', delta: '', reason: '' })
    setMsg('Saved. The standings page picks it up within 30 minutes (edge cache) - add ?fresh=1 to the feed URL to see it now.')
    load()
  }
  const del = async (id) => {
    const { error } = await supabase.from('points_adjustments').delete().eq('id', id)
    if (error) setMsg('Error: ' + error.message); else load()
  }
  const raceLabel = (id) => { const r = races.find(x => x.race_id === id); return r ? r.track + ' (' + r.date + ')' : (id || 'season') }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 8 }}>Points Adjustments</h2>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        Post-race penalties and credits NASCAR levies after the feed is final (they never change the feed). Negative for a penalty. The Standings page adds these to the computed points.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div><label style={lbl}>Series</label><select value={series} onChange={e => setSeries(e.target.value)} style={inp}>{SERIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label style={lbl}>Year</label><input type="number" value={year} onChange={e => setYear(+e.target.value || yearNow)} style={inp} /></div>
        <div><label style={lbl}>Driver</label>
          <input list="pa-drivers" value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} placeholder="As the feed spells it" style={inp} />
          <datalist id="pa-drivers">{drivers.map(d => <option key={d} value={d} />)}</datalist>
        </div>
        <div><label style={lbl}>Race (optional)</label>
          <select value={form.nascar_race_id} onChange={e => setForm(f => ({ ...f, nascar_race_id: e.target.value }))} style={inp}>
            <option value="">Season (no race)</option>
            {races.map(r => <option key={r.race_id} value={r.race_id}>{r.track} · {r.date}</option>)}
          </select>
        </div>
        <div><label style={lbl}>Points (+/-)</label><input type="number" value={form.delta} onChange={e => setForm(f => ({ ...f, delta: e.target.value }))} placeholder="-25" style={inp} /></div>
        <div><label style={lbl}>Reason</label><input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="L1 penalty, unapproved parts" style={inp} /></div>
      </div>
      <button className="btn btn-primary" onClick={add} disabled={busy} style={{ fontSize: '0.8125rem' }}>{busy ? 'Saving…' : 'Add adjustment'}</button>
      {msg ? <div style={{ fontSize: '0.8rem', color: msg.startsWith('Error') ? '#f85149' : 'var(--text-secondary)', marginTop: 8 }}>{msg}</div> : null}
      {rows.length ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14, fontSize: '0.8125rem' }}>
          <thead><tr>{['Driver', 'Race', 'Points', 'Reason', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(r => <tr key={r.id}>
            <td style={{ padding: '6px 8px' }}>{r.driver_name}</td>
            <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{raceLabel(r.nascar_race_id)}</td>
            <td style={{ padding: '6px 8px', fontWeight: 600, color: r.delta < 0 ? '#f85149' : '#3fb950' }}>{r.delta > 0 ? '+' : ''}{r.delta}</td>
            <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{r.reason || ''}</td>
            <td style={{ padding: '6px 8px', textAlign: 'right' }}><button onClick={() => del(r.id)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: '0.75rem' }}>remove</button></td>
          </tr>)}</tbody>
        </table>
      ) : <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 12 }}>No adjustments for {year} {SERIES.find(s => s[0] === series)[1]}.</div>}
    </div>
  )
}

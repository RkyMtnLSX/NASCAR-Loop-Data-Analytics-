import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const NEED = { win: 1, t3: 3, t5: 5, t10: 10 }
const LBL = { win: 'Win', t3: 'Top 3', t5: 'Top 5', t10: 'Top 10', group: 'Group' }
const am = (o) => (o == null ? '-' : (o > 0 ? '+' + o : String(o)))
const nrm = (x) => (x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '') // A.J. == AJ, Suárez == Suarez (2026-08-09)

export default function FlaggedBetsAdmin() {
  const [races, setRaces] = useState([])
  const [sel, setSel] = useState('')
  const [rows, setRows] = useState([])
  const [fin, setFin] = useState({})
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [showVoided, setShowVoided] = useState(true)
  const [dedupeStages, setDedupeStages] = useState(true)
  const [onePerDriver, setOnePerDriver] = useState(false)
  const [sortKey, setSortKey] = useState('ev')
  const [sortDir, setSortDir] = useState('desc')

  async function loadRaces() {
    const { data } = await supabase.from('flagged_bets')
      .select('series,race_year,race_number,track_name,stage')
      .order('race_year', { ascending: false }).order('race_number', { ascending: false }).limit(5000)
    const m = {}
    ;(data || []).forEach(r => {
      const k = r.series + '|' + r.race_year + '|' + r.race_number
      if (!m[k]) m[k] = { key: k, series: r.series, race_year: r.race_year, race_number: r.race_number, track_name: r.track_name, n: 0, stages: {} }
      m[k].n++; m[k].stages[r.stage] = 1
    })
    const list = Object.keys(m).map(k => Object.assign({}, m[k], { stageList: Object.keys(m[k].stages).sort().join(' / ') }))
    list.sort((a, b) => (b.race_year - a.race_year) || (b.race_number - a.race_number) || a.series.localeCompare(b.series))
    setRaces(list)
    setSel(prev => prev || (list.length ? list[0].key : ''))
  }

  async function loadRows(key) {
    if (!key) { setRows([]); return }
    setLoading(true); setMsg('')
    const parts = key.split('|')
    const series = parts[0], yr = +parts[1], rn = +parts[2]
    const { data } = await supabase.from('flagged_bets').select('*')
      .eq('series', series).eq('race_year', yr).eq('race_number', rn).limit(2000)
    const { data: ld } = await supabase.from('loop_data')
      .select('driver_name,finish_position').eq('series', series).eq('year', yr).eq('race_number', rn).limit(200)
    const f = {}
    ;(ld || []).forEach(r => { f[nrm(r.driver_name)] = r.finish_position })
    setFin(f); setRows(data || []); setLoading(false)
  }

  useEffect(() => { loadRaces() }, []) // eslint-disable-line
  useEffect(() => { loadRows(sel) }, [sel]) // eslint-disable-line

  async function voidOne(id) {
    const reason = window.prompt('Reason for voiding this flag? (recorded permanently)')
    if (reason === null) return
    if (!reason.trim()) { window.alert('A reason is required.'); return }
    const { error } = await supabase.from('flagged_bets').update({ voided_at: new Date().toISOString(), void_reason: reason.trim() }).eq('id', id)
    setMsg(error ? ('Void failed: ' + error.message) : 'Flag voided.')
    loadRows(sel)
  }

  async function voidDriver(driver) {
    const liveOnes = rows.filter(r => r.driver_name === driver && !r.voided_at)
    if (!liveOnes.length) return
    const reason = window.prompt('Void ALL ' + liveOnes.length + ' live flag(s) for ' + driver + '. Reason?')
    if (reason === null) return
    if (!reason.trim()) { window.alert('A reason is required.'); return }
    const stamp = new Date().toISOString()
    for (let i = 0; i < liveOnes.length; i++) {
      await supabase.from('flagged_bets').update({ voided_at: stamp, void_reason: reason.trim() }).eq('id', liveOnes[i].id)
    }
    setMsg('Voided ' + liveOnes.length + ' flag(s) for ' + driver + '.')
    loadRows(sel)
  }

  async function unvoid(id) {
    const { error } = await supabase.from('flagged_bets').update({ voided_at: null, void_reason: null }).eq('id', id)
    setMsg(error ? ('Restore failed: ' + error.message) : 'Flag restored.')
    loadRows(sel)
  }

  const view = useMemo(() => {
    const out = rows.filter(r => showVoided || !r.voided_at).map(r => {
      const fp = fin[nrm(r.driver_name)]
      const nd = NEED[r.market]
      let hit = (fp != null && nd) ? fp <= nd : null
      // custom group bets (2026-08-09): win the group = beat every listed rival's finish
      if (r.market === 'group' && r.group_drivers && fp != null) {
        const rv = r.group_drivers.split(',').map(x => fin[nrm(x)]).filter(x => x != null)
        hit = rv.length ? rv.every(x => fp < x) : null
      }
      const pl = hit == null ? null : (hit ? (r.best_price > 0 ? r.best_price / 100 : 100 / Math.abs(r.best_price)) : -1)
      return Object.assign({}, r, { fp: fp == null ? null : fp, hit: hit, pl: pl })
    })
    out.sort((a, b) => {
      const x = a[sortKey] == null ? -1e9 : a[sortKey]
      const y = b[sortKey] == null ? -1e9 : b[sortKey]
      const c = x < y ? -1 : (x > y ? 1 : 0)
      return sortDir === 'asc' ? c : -c
    })
    return out
  }, [rows, fin, showVoided, sortKey, sortDir])

  const liveRows = rows.filter(r => !r.voided_at)
  const voidedRows = rows.filter(r => r.voided_at)
  const effective = useMemo(() => {
    let L = rows.filter(r => !r.voided_at)
    if (dedupeStages) {
      const m = {}
      L.forEach(r => {
        const k = r.driver_name + '|' + r.market
        if (!m[k]) { m[k] = r; return }
        if (m[k].stage !== 'pre' && r.stage === 'pre') m[k] = r
      })
      L = Object.keys(m).map(k => m[k])
    }
    if (onePerDriver) {
      const m = {}
      L.forEach(r => {
        const k = r.driver_name
        if (!m[k] || (+r.medge || 0) > (+m[k].medge || 0)) m[k] = r
      })
      L = Object.keys(m).map(k => m[k])
    }
    return L
  }, [rows, dedupeStages, onePerDriver])
  const collapsed = liveRows.length - effective.length
  const graded = effective.filter(r => fin[r.driver_name] != null && NEED[r.market])
  const wins = graded.filter(r => fin[r.driver_name] <= NEED[r.market]).length
  const pl = graded.reduce((a, r) => {
    const h = fin[r.driver_name] <= NEED[r.market]
    return a + (h ? (r.best_price > 0 ? r.best_price / 100 : 100 / Math.abs(r.best_price)) : -1)
  }, 0)

  const th = (k, label, align) => (
    <th onClick={() => { setSortKey(k); setSortDir(sortKey === k && sortDir === 'desc' ? 'asc' : 'desc') }}
      style={{ padding: '6px 8px', textAlign: align || 'right', cursor: 'pointer', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', userSelect: 'none' }}>
      {label}{sortKey === k ? (sortDir === 'desc' ? ' \u25bc' : ' \u25b2') : ''}
    </th>
  )
  const td = { padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid rgba(128,128,128,0.15)' }
  const btn = { padding: '2px 8px', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.72rem' }

  return (
    <div>
      <h3 style={{ margin: '4px 0 6px' }}>Flagged Bets</h3>
      <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
        Every +EV bet the simulation flagged, archived automatically at publish. Voiding removes a flag from grading, ROI and threshold sweeps \u2014 the row and your reason are kept permanently.
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select value={sel} onChange={e => setSel(e.target.value)}
          style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', minWidth: 340 }}>
          {races.map(r => (
            <option key={r.key} value={r.key}>
              {r.series + ' R' + r.race_number + ' ' + (r.track_name || '') + ' \u00b7 ' + r.n + ' flags (' + r.stageList + ')'}
            </option>
          ))}
        </select>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showVoided} onChange={e => setShowVoided(e.target.checked)} /> show voided
        </label>
        <button onClick={() => loadRows(sel)} style={Object.assign({}, btn, { fontSize: '0.8rem', padding: '5px 12px' })}>Reload</button>
        {msg && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{msg}</span>}
      </div>

      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 12, fontSize: '0.85rem' }}>
        <span><b>{liveRows.length}</b> live</span>
        <span style={{ color: 'var(--text-muted)' }}>{collapsed > 0 ? ('\u2212' + collapsed + ' collapsed') : ''}</span>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><input type="checkbox" checked={dedupeStages} onChange={e => setDedupeStages(e.target.checked)} /> one per driver+market</label>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><input type="checkbox" checked={onePerDriver} onChange={e => setOnePerDriver(e.target.checked)} /> one per driver (best medge)</label>
        <span style={{ color: 'var(--text-muted)' }}><b>{voidedRows.length}</b> voided</span>
        {graded.length ? (
          <span>graded <b>{graded.length}</b> \u00b7 <b>{wins}-{graded.length - wins}</b> \u00b7{' '}
            <b style={{ color: pl >= 0 ? '#22c55e' : '#ef4444' }}>{(pl >= 0 ? '+' : '') + pl.toFixed(2)}u</b>{' '}
            ({((pl / graded.length) * 100).toFixed(1)}% ROI)
          </span>
        ) : <span style={{ color: 'var(--text-muted)' }}>no results loaded yet</span>}
      </div>

      {loading && <div style={{ color: 'var(--text-secondary)' }}>Loading\u2026</div>}
      {!loading && !view.length && <div style={{ color: 'var(--text-secondary)' }}>No flags for this race.</div>}

      {!loading && view.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ color: 'var(--text-secondary)' }}>
              {th('driver_name', 'Driver', 'left')}
              {th('market', 'Mkt', 'left')}
              {th('stage', 'Stage', 'left')}
              {th('sim_prob', 'Sim %')}
              {th('best_price', 'Price')}
              {th('book', 'Book', 'left')}
              {th('ev', 'EV')}
              {th('mev', 'MEV')}
              {th('medge', 'Medge')}
              {th('fp', 'Fin')}
              <th style={{ padding: '6px 8px' }}>Result</th>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '6px 8px' }}>Action</th>
            </tr></thead>
            <tbody>
              {view.map(r => {
                const dead = !!r.voided_at
                return (
                  <tr key={r.id} style={{ opacity: dead ? 0.45 : 1 }}>
                    <td style={Object.assign({}, td, { textAlign: 'left', textDecoration: dead ? 'line-through' : 'none' })}>{r.driver_name}</td>
                    <td style={Object.assign({}, td, { textAlign: 'left' })}>{LBL[r.market] || r.market}</td>
                    <td style={Object.assign({}, td, { textAlign: 'left', color: 'var(--text-muted)' })}>{r.stage}</td>
                    <td style={td}>{r.sim_prob == null ? '-' : (+r.sim_prob).toFixed(1)}</td>
                    <td style={td}>{am(r.best_price)}</td>
                    <td style={Object.assign({}, td, { textAlign: 'left', color: 'var(--text-muted)' })}>{r.book || '-'}</td>
                    <td style={Object.assign({}, td, { fontWeight: 600 })}>{r.ev == null ? '-' : r.ev}</td>
                    <td style={Object.assign({}, td, { color: 'var(--text-muted)' })}>{r.mev == null ? '-' : r.mev}</td>
                    <td style={Object.assign({}, td, { color: (r.medge || 0) >= 8 ? '#22c55e' : 'inherit' })}>{r.medge == null ? '-' : (+r.medge).toFixed(2)}</td>
                    <td style={Object.assign({}, td, { color: 'var(--text-muted)' })}>{r.fp == null ? '-' : r.fp}</td>
                    <td style={Object.assign({}, td, { fontWeight: 600, color: r.hit == null ? 'var(--text-muted)' : (r.hit ? '#22c55e' : '#ef4444') })}>
                      {r.hit == null ? '-' : (r.hit ? ('+' + r.pl.toFixed(2) + 'u') : '-1.00u')}
                    </td>
                    <td style={Object.assign({}, td, { textAlign: 'left', fontSize: '0.75rem', color: dead ? '#ef4444' : '#22c55e' })}>
                      {dead ? ('VOID \u2014 ' + (r.void_reason || '')) : 'live'}
                    </td>
                    <td style={Object.assign({}, td, { whiteSpace: 'nowrap' })}>
                      {dead
                        ? <button onClick={() => unvoid(r.id)} style={btn}>restore</button>
                        : (<span>
                            <button onClick={() => voidOne(r.id)} style={Object.assign({}, btn, { marginRight: 4 })}>void</button>
                            <button onClick={() => voidDriver(r.driver_name)} style={btn} title={'Void every live flag for ' + r.driver_name}>void driver</button>
                          </span>)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

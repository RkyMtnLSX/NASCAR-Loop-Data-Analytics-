import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// My Bets - personal bet ledger (2026-08-09). Moved out of Sim Admin to its own tab
// (operator request). Bets log against the latest published board for the series;
// past races grade from loop data, including custom group bets (beat all rivals).
const NEED = { win: 1, t3: 3, t5: 5, t10: 10 }
const LBL = { win: 'Win', t3: 'Top 3', t5: 'Top 5', t10: 'Top 10', group: 'Group' }
const am = (o) => (o == null ? '-' : (o > 0 ? '+' + o : String(o)))
const dec = (o) => (o > 0 ? o / 100 + 1 : 100 / Math.abs(o) + 1)
const impl = (o) => (o == null ? null : (o > 0 ? 100 / (o + 100) : (-o) / ((-o) + 100)))

export default function MyBetsAdmin() {
  const [series, setSeries] = useState('cup')
  const [board, setBoard] = useState(null)
  const [races, setRaces] = useState([])
  const [viewRace, setViewRace] = useState('')
  const [rows, setRows] = useState([])
  const [fin, setFin] = useState({})
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ driver: '', market: 'win', odds: '', stake: '', rivals: [] })

  useEffect(() => { loadBoard(); loadRaces() /* eslint-disable-line */ }, [series]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (viewRace) loadRows() /* eslint-disable-line */ }, [viewRace]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadBoard() {
    const { data } = await supabase.from('sim_results').select('*').eq('series', series).order('published_at', { ascending: false }).limit(1)
    const b = (data && data[0]) || null
    setBoard(b)
    if (b) setViewRace(b.race_year + '|' + b.race_number)
  }
  async function loadRaces() {
    const { data } = await supabase.from('my_bets').select('race_year,race_number,track_name').eq('series', series).order('race_year', { ascending: false }).order('race_number', { ascending: false }).limit(2000)
    const seen = {}
    const out = []
    ;(data || []).forEach(r => { const k = r.race_year + '|' + r.race_number; if (!seen[k]) { seen[k] = 1; out.push({ k, label: r.race_year + ' R' + r.race_number + ' ' + (r.track_name || '') }) } })
    setRaces(out)
  }
  async function loadRows() {
    const [yr, rn] = viewRace.split('|').map(Number)
    const { data } = await supabase.from('my_bets').select('*').eq('series', series).eq('race_year', yr).eq('race_number', rn).order('id', { ascending: true })
    setRows(data || [])
    const { data: ld } = await supabase.from('loop_data').select('driver_name,finish_position').eq('series', series).eq('year', yr).eq('race_number', rn).limit(60)
    const m = {}
    ;(ld || []).forEach(r => { m[r.driver_name] = r.finish_position })
    setFin(m)
  }
  async function addBet() {
    if (!board) { setMsg('No published board for this series yet.'); return }
    if (!form.driver || form.odds === '') { setMsg('Pick a driver and enter odds.'); return }
    if (form.market === 'group' && !form.rivals.length) { setMsg('Pick at least one rival for a group bet.'); return }
    const { error } = await supabase.from('my_bets').insert({
      series, race_year: board.race_year, race_number: board.race_number, track_name: board.track_name,
      driver_name: form.driver, market: form.market, odds: parseInt(form.odds), stake: form.stake ? parseFloat(form.stake) : null,
      group_drivers: form.market === 'group' ? form.rivals.join(', ') : null,
    })
    setMsg(error ? 'Save failed: ' + error.message : 'Logged.')
    if (!error) { setForm({ driver: '', market: 'win', odds: '', stake: '', rivals: [] }); setViewRace(board.race_year + '|' + board.race_number); loadRows(); loadRaces() }
  }
  async function delBet(id) {
    await supabase.from('my_bets').delete().eq('id', id)
    loadRows()
  }
  const drivers = ((board && board.results) || []).map(d => d.driver_name)
  const simP = (nm, mk) => {
    if (mk === 'group' || !board || !viewRace || viewRace !== board.race_year + '|' + board.race_number) return null
    const r = ((board && board.results) || []).find(x => x.driver_name === nm)
    if (!r) return null
    return mk === 'win' ? r.win_pct : mk === 't3' ? r.top3_pct : mk === 't5' ? r.top5_pct : r.top10_pct
  }
  const graded = rows.map(r => {
    const fp = fin[r.driver_name]
    let hit = (fp != null && NEED[r.market]) ? fp <= NEED[r.market] : null
    if (r.market === 'group' && r.group_drivers && fp != null) {
      const rv = r.group_drivers.split(',').map(x => fin[x.trim()]).filter(x => x != null)
      hit = rv.length ? rv.every(x => fp < x) : null
    }
    const st = r.stake != null ? r.stake : 1
    const pl = hit == null ? null : (hit ? +(st * (dec(r.odds) - 1)).toFixed(2) : -st)
    return Object.assign({}, r, { fp, hit, pl })
  })
  const settled = graded.filter(g => g.pl != null)
  const net = +settled.reduce((s, g) => s + g.pl, 0).toFixed(2)

  const inp = { padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 12 }
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['cup', 'Cup'], ['oreilly', "O'Reilly"], ['trucks', 'Trucks']].map(t => (
          <button key={t[0]} onClick={() => setSeries(t[0])} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: series === t[0] ? 'var(--accent)' : 'transparent', color: series === t[0] ? '#111' : 'var(--text-secondary)', fontWeight: 600 }}>{t[1]}</button>
        ))}
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Log a bet {board ? <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11 }}>vs {board.track_name} R{board.race_number} ({board.stage} board) - logged at your price, survives odds moves</span> : null}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <select value={form.driver} onChange={e => setForm(f => ({ ...f, driver: e.target.value }))} style={inp}>
            <option value="">driver...</option>
            {drivers.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={form.market} onChange={e => setForm(f => ({ ...f, market: e.target.value }))} style={inp}>
            <option value="win">Win</option><option value="t3">Top 3</option><option value="t5">Top 5</option><option value="t10">Top 10</option><option value="group">Group (beat rivals)</option>
          </select>
          {form.market === 'group' ? (
            <div style={{ width: '100%', order: 5 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0' }}>Click each rival {form.driver || 'your driver'} must beat:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxWidth: 720 }}>
                {drivers.filter(d => d !== form.driver).map(d => {
                  const on = form.rivals.includes(d)
                  return (
                    <span key={d} onClick={() => setForm(f => ({ ...f, rivals: on ? f.rivals.filter(x => x !== d) : [...f.rivals, d] }))}
                      style={{ cursor: 'pointer', padding: '3px 10px', borderRadius: 999, fontSize: 12, border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border)'), background: on ? 'rgba(232,185,35,0.15)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {d}{on ? ' x' : ''}
                    </span>
                  )
                })}
              </div>
              {form.rivals.length ? <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{(form.driver || '?') + ' to beat: ' + form.rivals.join(', ')}</div> : null}
            </div>
          ) : null}
          <input value={form.odds} onChange={e => setForm(f => ({ ...f, odds: e.target.value }))} placeholder="odds e.g. +115" style={{ ...inp, width: 90 }} />
          <input value={form.stake} onChange={e => setForm(f => ({ ...f, stake: e.target.value }))} placeholder="stake" style={{ ...inp, width: 64 }} />
          <button className="btn-primary" onClick={addBet} style={{ padding: '5px 14px', fontSize: 12 }}>+ Log bet</button>
        </div>
        {msg ? <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{msg}</div> : null}
      </div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Bets</span>
          <select value={viewRace} onChange={e => setViewRace(e.target.value)} style={inp}>
            {board && !races.some(r => r.k === board.race_year + '|' + board.race_number) ? <option value={board.race_year + '|' + board.race_number}>{board.race_year + ' R' + board.race_number + ' ' + board.track_name}</option> : null}
            {races.map(r => <option key={r.k} value={r.k}>{r.label}</option>)}
          </select>
          {settled.length ? <span style={{ fontSize: 12, color: net >= 0 ? '#3fb950' : '#dd3355', fontWeight: 600 }}>{settled.length} settled, {net >= 0 ? '+' : ''}{net}u</span> : null}
        </div>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}><th style={{ padding: '2px 6px' }}>Driver</th><th>Mkt</th><th>Odds</th><th>Impl</th><th>Sim</th><th>Stake</th><th>Fin</th><th>Result</th><th>P/L</th><th></th></tr></thead>
          <tbody>
            {graded.map(b => {
              const sp = simP(b.driver_name, b.market)
              return (
                <tr key={b.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '3px 6px' }}>{b.driver_name}</td>
                  <td style={{ padding: '3px 6px' }} title={b.group_drivers ? 'beats: ' + b.group_drivers : undefined}>{LBL[b.market] || b.market}{b.market === 'group' ? '*' : ''}</td>
                  <td style={{ padding: '3px 6px', fontFamily: 'var(--font-mono)' }}>{am(b.odds)}</td>
                  <td style={{ padding: '3px 6px' }}>{impl(b.odds) != null ? (impl(b.odds) * 100).toFixed(1) + '%' : '-'}</td>
                  <td style={{ padding: '3px 6px' }}>{sp != null ? sp.toFixed(1) + '%' : '-'}</td>
                  <td style={{ padding: '3px 6px' }}>{b.stake != null ? b.stake : '-'}</td>
                  <td style={{ padding: '3px 6px' }}>{b.fp != null ? 'P' + b.fp : '-'}</td>
                  <td style={{ padding: '3px 6px', color: b.hit == null ? 'var(--text-muted)' : b.hit ? '#3fb950' : '#dd3355', fontWeight: 600 }}>{b.hit == null ? 'open' : b.hit ? 'WIN' : 'loss'}</td>
                  <td style={{ padding: '3px 6px', color: b.pl == null ? 'var(--text-muted)' : b.pl >= 0 ? '#3fb950' : '#dd3355' }}>{b.pl == null ? '-' : (b.pl >= 0 ? '+' : '') + b.pl}</td>
                  <td style={{ padding: '3px 6px' }}><span style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => delBet(b.id)} title="delete">x</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!graded.length ? <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 6px' }}>No bets logged for this race.</div> : null}
      </div>
    </div>
  )
}

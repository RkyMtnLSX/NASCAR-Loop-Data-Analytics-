import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/fetchAllRows'

const LBL = { win: 'Win', t3: 'Top 3', t5: 'Top 5', t10: 'Top 10' }
const MKTS = ['win', 't3', 't5', 't10']
const am = (o) => (o == null ? '-' : (o > 0 ? '+' + o : String(o)))
const impl = (o) => (o == null ? null : (o > 0 ? 100 / (o + 100) * 100 : Math.abs(o) / (Math.abs(o) + 100) * 100))
const ts = (s) => { try { const d = new Date(s); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') } catch (e) { return String(s).slice(5, 16) } }

export default function LineMovementAdmin() {
  const [races, setRaces] = useState([])
  const [sel, setSel] = useState('')
  const [rows, setRows] = useState([])
  const [mkt, setMkt] = useState('win')
  const [loading, setLoading] = useState(false)
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const [flags, setFlags] = useState({})

  async function loadRaces() {
    // 2026-09-02: THIS PICKER WAS SHOWING ONE RACE INSTEAD OF TWELVE. It derives the race list by
    // scanning snapshot ROWS, and .limit(6000) never applied - the cap is 5,000. odds_snapshots is
    // 68,832 rows across 12 races and the newest race alone holds ~10,000, so ordering newest-first
    // meant all 5,000 returned rows came from that single race. Measured: 1 distinct race visible
    // out of 12.
    //
    // Paginated so the list is complete. It is ~69 requests for 4 narrow columns, which is heavy
    // for a page that only needs DISTINCT races - the better fix is a DB-side distinct (a small
    // view, or an RPC), but that is a schema addition and needs the operator's say-so, so this
    // takes the correct-but-chatty route rather than leaving the picker wrong.
    const { data } = await fetchAllRows(() => supabase.from('odds_snapshots')
      .select('series,race_year,race_number,track_name')
      .order('race_year', { ascending: false }).order('race_number', { ascending: false }))
    const m = {}
    ;(data || []).forEach(r => {
      const k = r.series + '|' + r.race_year + '|' + r.race_number
      if (!m[k]) m[k] = { key: k, series: r.series, race_year: r.race_year, race_number: r.race_number, track_name: r.track_name, n: 0 }
      m[k].n++
    })
    const list = Object.keys(m).map(k => m[k])
    list.sort((a, b) => (b.race_year - a.race_year) || (b.race_number - a.race_number) || a.series.localeCompare(b.series))
    setRaces(list)
    setSel(prev => prev || (list.length ? list[0].key : ''))
  }

  async function loadRows(key) {
    if (!key) { setRows([]); return }
    setLoading(true)
    const p = key.split('|'), series = p[0], yr = +p[1], rn = +p[2]
    let out = [], off = 0
    while (true) {
      const { data } = await supabase.from('odds_snapshots')
        .select('driver_name,market,book,odds,ev,mev,medge,captured_at')
        .eq('series', series).eq('race_year', yr).eq('race_number', rn)
        // .order('id') is a UNIQUE tiebreaker and this query needs it more than any other in
        // the app. Snapshots are written in BATCHES, so hundreds of rows share an identical
        // captured_at: of the 63 page boundaries across the 12 races big enough to paginate,
        // ALL 63 land inside a tie group. Ordering by captured_at alone therefore duplicated
        // and dropped rows on every paginated race (the largest is 10,082 rows = 11 requests),
        // which silently distorts the line-movement series. Verified 2026-09-02.
        .order('captured_at', { ascending: true }).order('id', { ascending: true }).range(off, off + 999)
      if (!data || !data.length) break
      out = out.concat(data)
      if (data.length < 1000) break
      off += 1000
      if (off > 20000) break
    }
    const { data: fb } = await supabase.from('flagged_bets')
      .select('driver_name,market').eq('series', series).eq('race_year', yr).eq('race_number', rn).is('voided_at', null).limit(2000)
    const f = {}
    ;(fb || []).forEach(x => { f[x.driver_name + '|' + x.market] = true })
    setFlags(f); setRows(out); setLoading(false)
  }

  useEffect(() => { loadRaces() }, []) // eslint-disable-line
  useEffect(() => { loadRows(sel) }, [sel]) // eslint-disable-line

  const model = useMemo(() => {
    const caps = []
    const seen = {}
    rows.forEach(r => { if (!seen[r.captured_at]) { seen[r.captured_at] = 1; caps.push(r.captured_at) } })
    caps.sort()
    const byDriver = {}
    rows.filter(r => r.market === mkt).forEach(r => {
      const d = r.driver_name
      if (!byDriver[d]) byDriver[d] = { driver: d, caps: {} }
      const c = byDriver[d].caps
      if (!c[r.captured_at]) c[r.captured_at] = { best: null, book: null, medge: null, ev: null }
      const cell = c[r.captured_at]
      if (r.odds != null && (cell.best == null || r.odds > cell.best)) { cell.best = r.odds; cell.book = r.book }
      if (r.medge != null) cell.medge = +r.medge
      if (r.ev != null) cell.ev = +r.ev
    })
    let list = Object.keys(byDriver).map(d => {
      const o = byDriver[d]
      const pts = caps.map(c => o.caps[c]).filter(Boolean)
      const first = pts.length ? pts[0] : null
      const last = pts.length ? pts[pts.length - 1] : null
      const move = (first && last && first.best != null && last.best != null) ? +(impl(last.best) - impl(first.best)).toFixed(2) : null
      const medge0 = first ? first.medge : null
      return { driver: d, caps: o.caps, first, last, move, medge0, flagged: !!flags[d + '|' + mkt] }
    })
    if (onlyFlagged) list = list.filter(x => x.flagged)
    list.sort((a, b) => (b.move == null ? -1e9 : b.move) - (a.move == null ? -1e9 : a.move))
    return { caps, list }
  }, [rows, mkt, onlyFlagged, flags])

  const withBoth = model.list.filter(x => x.medge0 != null && x.move != null)
  const corr = (() => {
    const n = withBoth.length
    if (n < 3) return null
    const X = withBoth.map(x => x.medge0), Y = withBoth.map(x => x.move)
    let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0
    for (let i = 0; i < n; i++) { sx += X[i]; sy += Y[i]; sxy += X[i] * Y[i]; sxx += X[i] * X[i]; syy += Y[i] * Y[i] }
    const cov = sxy - sx * sy / n, vx = sxx - sx * sx / n, vy = syy - sy * sy / n
    if (vx <= 0 || vy <= 0) return null
    return +(cov / Math.sqrt(vx * vy)).toFixed(3)
  })()

  const td = { padding: '4px 8px', textAlign: 'right', borderBottom: '1px solid rgba(128,128,128,0.15)', whiteSpace: 'nowrap' }
  const th = { padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }

  return (
    <div>
      <h3 style={{ margin: '4px 0 6px' }}>Line Movement</h3>
      <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
        Best price per driver at each odds capture, with our medge at the first capture. Move = change in implied % from first to last capture (positive = the line came toward us). The headline question: does a bigger medge predict a bigger move?
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <select value={sel} onChange={e => setSel(e.target.value)}
          style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', minWidth: 330 }}>
          {races.map(r => <option key={r.key} value={r.key}>{r.series + ' R' + r.race_number + ' ' + (r.track_name || '') + ' \u00b7 ' + r.n + ' rows'}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {MKTS.map(m => (
            <button key={m} onClick={() => setMkt(m)}
              style={{ padding: '5px 12px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border)', background: mkt === m ? '#e8b923' : 'transparent', color: mkt === m ? '#111' : 'var(--text-secondary)', fontWeight: mkt === m ? 700 : 400, fontSize: '0.8rem' }}>
              {LBL[m]}
            </button>
          ))}
        </div>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={onlyFlagged} onChange={e => setOnlyFlagged(e.target.checked)} /> flagged only
        </label>
        <button onClick={() => loadRows(sel)} style={{ padding: '5px 12px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Reload</button>
      </div>

      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 12, fontSize: '0.85rem' }}>
        <span><b>{model.caps.length}</b> captures</span>
        <span><b>{model.list.length}</b> drivers</span>
        <span style={{ color: corr == null ? 'var(--text-muted)' : (corr > 0 ? '#22c55e' : '#ef4444') }}>
          corr(medge, move) = <b>{corr == null ? 'n/a' : corr}</b> <span style={{ color: 'var(--text-muted)' }}>(n={withBoth.length})</span>
        </span>
      </div>

      {loading && <div style={{ color: 'var(--text-secondary)' }}>Loading\u2026</div>}
      {!loading && !model.list.length && <div style={{ color: 'var(--text-secondary)' }}>No snapshots for this race / market.</div>}

      {!loading && model.list.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse', fontSize: 13, whiteSpace: 'nowrap' }}>
            <thead><tr style={{ color: 'var(--text-secondary)' }}>
              <th style={{ ...th, textAlign: 'left' }}>Driver</th>
              <th style={th}>Medge @1st</th>
              {model.caps.map((c, i) => <th key={c} style={th} title={c}>{ts(c)}</th>)}
              <th style={th}>Move</th>
            </tr></thead>
            <tbody>
              {model.list.map(r => (
                <tr key={r.driver} style={{ background: r.flagged ? 'rgba(232,185,35,0.07)' : 'transparent' }}>
                  <td style={{ ...td, textAlign: 'left' }}>
                    {r.flagged ? <span style={{ color: '#e8b923', marginRight: 4 }}>{'\u2605'}</span> : null}{r.driver}
                  </td>
                  <td style={{ ...td, color: (r.medge0 || 0) >= 8 ? '#22c55e' : 'var(--text-muted)' }}>{r.medge0 == null ? '-' : r.medge0.toFixed(2)}</td>
                  {model.caps.map(c => {
                    const cell = r.caps[c]
                    return <td key={c} style={{ ...td, color: cell ? 'inherit' : 'var(--text-muted)' }}>{cell && cell.best != null ? am(cell.best) : '-'}</td>
                  })}
                  <td style={{ ...td, fontWeight: 600, color: r.move == null ? 'var(--text-muted)' : (r.move > 0 ? '#22c55e' : (r.move < 0 ? '#ef4444' : 'inherit')) }}>
                    {r.move == null ? '-' : ((r.move > 0 ? '+' : '') + r.move)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

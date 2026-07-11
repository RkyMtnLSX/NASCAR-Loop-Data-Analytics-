import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const SERIES_TABS = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks',   label: 'Truck Series' },
]

// Values stored as percentages (e.g. 60.9), not decimals
const fmt    = (n, dec = 1) => n == null ? '-' : (+n).toFixed(dec) + '%'
const fmtDK  = (n)          => n == null ? '' : (+n).toFixed(2)
const fmtNum = (n, dec = 1) => n == null ? '' : (+n).toFixed(dec)

function fmvAmerican(p) {
  if (!p || p <= 0) return '--'
  if (p >= 0.999) return '-99999'
  return p >= 0.5 ? String(Math.round(-100 * p / (1 - p))) : '+' + Math.round(100 * (1 - p) / p)
}
function __decodeMtx(cfg) {
  if (!cfg || !cfg.simMatrix || !cfg.simMatrixN || !cfg.simOrder) return null
  try {
    const bin = atob(cfg.simMatrix)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    return { mtx: arr, simN: cfg.simMatrixN, order: cfg.simOrder, nD: cfg.simOrder.length }
  } catch (e) { return null }
}
const __srTh = { padding: '6px 10px', fontSize: '0.72rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.04em' }
const __srTd = { padding: '6px 10px', fontSize: '0.85rem', borderBottom: '1px solid var(--border)' }
const __srBtn = { padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface, #1a1a24)', color: 'var(--text)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }
function SrTable({ data, col1 }) {
  if (!data || !data.length) return null
  const hasFin = data[0].avgFin !== undefined
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
      <thead><tr>
        <th style={{ ...__srTh, textAlign: 'left' }}>{col1}</th>
        {hasFin ? <th style={{ ...__srTh, textAlign: 'right' }}>Avg Finish</th> : null}
        <th style={{ ...__srTh, textAlign: 'right' }}>Win %</th>
        <th style={{ ...__srTh, textAlign: 'right' }}>FMV</th>
      </tr></thead>
      <tbody>
        {data.map((r, i) => (
          <tr key={i}>
            <td style={__srTd}>{r.name}</td>
            {hasFin ? <td style={{ ...__srTd, textAlign: 'right' }}>{r.avgFin.toFixed(1)}</td> : null}
            <td style={{ ...__srTd, textAlign: 'right' }}>{r.winPct.toFixed(1)}%</td>
            <td style={{ ...__srTd, textAlign: 'right', color: 'var(--accent, #22c55e)', fontWeight: 600 }}>{r.fmv}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
function CompareTray({ sel, config, onToggle, onClear }) {
  const [res, setRes] = useState(null)
  useEffect(() => {
    const M = __decodeMtx(config)
    if (!M || sel.length < 2) { setRes(null); return }
    const cols = sel.map((nm) => M.order.indexOf(nm)).filter((c) => c >= 0)
    if (cols.length < 2) { setRes(null); return }
    const wins = cols.map(() => 0), finSum = cols.map(() => 0)
    for (let s = 0; s < M.simN; s++) {
      let best = 1e9, bi = 0
      for (let g = 0; g < cols.length; g++) { const p = M.mtx[s * M.nD + cols[g]]; finSum[g] += p; if (p < best) { best = p; bi = g } }
      wins[bi]++
    }
    setRes(cols.map((c, g) => ({ name: M.order[c], avgFin: finSum[g] / M.simN, winPct: 100 * wins[g] / M.simN, fmv: fmvAmerican(wins[g] / M.simN) })).sort((a, b) => b.winPct - a.winPct))
  }, [sel, config])
  const hasMtx = !!__decodeMtx(config)
  return (
    <div className="card" style={{ marginBottom: 16, borderColor: sel.length >= 2 ? 'var(--accent)' : 'var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Matchup Compare</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 8 }}>{sel.length < 2 ? 'Tick 2+ drivers in the table to build a head-to-head or group bet' : (sel.length === 2 ? 'Head-to-head' : sel.length + '-driver group bet')}</span>
        </div>
        {sel.length > 0 ? <button style={{ ...__srBtn, background: 'transparent' }} onClick={onClear}>Clear</button> : null}
      </div>
      {sel.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {sel.map((nm) => (
            <span key={nm} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, background: 'var(--bg-surface)', fontSize: '0.8rem' }}>{nm}<span style={{ cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 700 }} onClick={() => onToggle(nm)}>x</span></span>
          ))}
        </div>
      ) : null}
      {!hasMtx && sel.length >= 2 ? <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 10 }}>Re-run and publish this sim to enable exact matchup math (per-sim data isn't stored on this older board).</div> : null}
      {res ? <SrTable data={res} col1="Driver" /> : null}
    </div>
  )
}
function MarketTables({ results }) {
  function aggBy(key) {
    const m = {}
    ;(results || []).forEach((r) => { const g = ((r[key] || 'Unknown') + '').trim() || 'Unknown'; m[g] = (m[g] || 0) + (r.win_pct || 0) })
    return Object.entries(m).map(([k, v]) => ({ name: k, winPct: v, fmv: fmvAmerican(v / 100) })).sort((a, b) => b.winPct - a.winPct)
  }
  return (
    <div>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '4px 0' }}>Winning Manufacturer</h2>
      <SrTable data={aggBy('manufacturer')} col1="Manufacturer" />
      <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '22px 0 4px' }}>Winning Team</h2>
      <SrTable data={aggBy('organization')} col1="Team" />
    </div>
  )
}
export default function SimResults() {
  const [series, setSeries]       = useState('cup')
  const [mvMkt, setMvMkt] = useState('Win')
  const [mvUnits, setMvUnits] = useState('odds')
  const [mvSort, setMvSort] = useState('edge')
  const [mvQual, setMvQual] = useState(false)
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [sortAsc, setSortAsc]     = useState(true)
  const [tab, setTab] = useState('proj')
  const [sel, setSel] = useState([])
  const togSel = (name) => setSel((cur) => cur.indexOf(name) >= 0 ? cur.filter((x) => x !== name) : cur.concat([name]))

  useEffect(() => {
    setLoading(true)
    setError(null)
    setData(null)
    supabase
      .from('sim_results')
      .select('*')
      .eq('series', series)
      .order('published_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data: row, error: err }) => {
        if (err && err.code !== 'PGRST116') setError('No published results yet.')
        else if (row) setData(row)
        else setError('No published results yet.')
        setLoading(false)
      })
  }, [series])

  const results = data?.results || []

  // Ceiling = TRUE 10th-percentile finish, computed from the stored sim matrix at display
  // time (2026-07-11) - no republish needed. Boards without a matrix fall back to p25.
  const __p10Map = useMemo(() => {
    const M = __decodeMtx(data && data.config)
    if (!M) return null
    const out = {}
    const fins = new Uint8Array(M.simN)
    for (let c = 0; c < M.nD; c++) {
      for (let s = 0; s < M.simN; s++) fins[s] = M.mtx[s * M.nD + c]
      fins.sort()
      out[M.order[c]] = fins[Math.floor(M.simN * 0.10)]
    }
    return out
  }, [data])

  const sorted = [...results].sort((a, b) => {
    const aVal = a.proj_finish ?? 99
    const bVal = b.proj_finish ?? 99
    return sortAsc ? aVal - bVal : bVal - aVal
  })

  const SERIES_COLOR = { cup: 'var(--series-cup)', oreilly: 'var(--series-oreilly)', trucks: 'var(--series-trucks)' }
  const __fmvTh = { title: 'Fair market value: the break-even American odds implied by the model probability. Shop your books for anything better.' }
  const __fmvCell = p => {
    if (p == null || p <= 0) return <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>-</span>
    const v = fmvAmerican(p / 100)
    return <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{v}</span>
  }
  const tabStyle = (s) => ({
    padding: '8px 18px', border: 'none', borderRadius: 6, cursor: 'pointer',
    fontWeight: 600, fontSize: '0.875rem',
    background: series === s ? (SERIES_COLOR[s] || 'var(--accent)') : 'var(--bg-surface)',
    color: series === s ? (s === 'trucks' ? '#111' : '#fff') : 'var(--text-secondary)',
  })

  const thStyle = {
    padding: '10px 12px', textAlign: 'left', fontSize: '0.7rem',
    fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em',
    textTransform: 'uppercase', whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)',
  }
  const tdStyle = {
    padding: '10px 12px', fontSize: '0.85rem',
    borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap',
  }
  const pctStyle = (v, hi) => ({
    ...tdStyle,
    color: v >= hi ? '#4ade80' : v >= hi * 0.5 ? 'var(--text-primary)' : 'var(--text-muted)',
    fontWeight: v >= hi ? 700 : 400,
  })

  const sortableThStyle = {
    ...thStyle,
    textAlign: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {SERIES_TABS.map(t => (
          <button key={t.value} style={tabStyle(t.value)} onClick={() => setSeries(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {data && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 8, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{data.track_name}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Published {new Date(data.published_at).toLocaleString()}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{results.length} drivers</span>
          {data.config && data.config.lineup && (
            <span title="Where the Start column came from when this board was published" style={{ padding: '2px 10px', borderRadius: 999, border: '1px solid var(--border)', fontSize: '0.75rem', color: data.config.lineup === 'none' ? '#dd8844' : data.config.lineup === 'qualifying' ? '#3fb950' : '#e8c766' }}>
              lineup: {data.config.lineup}
            </span>
          )}
        </div>
      )}

      {loading && <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading</div>}
      {error   && <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>{error}</div>}

      {!loading && !error && sorted.length > 0 && (
        <>
          <CompareTray sel={sel} config={data && data.config} onToggle={togSel} onClear={() => setSel([])} />
          <div style={{ display: 'flex', gap: 6, margin: '2px 0 14px', flexWrap: 'wrap' }}>
            {[['proj', 'Projections'], ['mv', 'Market Value'], ['markets', 'Mfr & Team']].map((ct) => (
              <button key={ct[0]} onClick={() => setTab(ct[0])} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', background: tab === ct[0] ? 'var(--accent)' : 'var(--bg-surface)', color: tab === ct[0] ? '#111' : 'var(--text-secondary)' }}>{ct[1]}</button>
            ))}
          </div>
          {tab === 'proj' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={thStyle}></th><th style={thStyle}>#</th>
                <th style={thStyle}>Driver</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Start</th>
                <th
                  style={sortableThStyle}
                  onClick={() => setSortAsc(v => !v)}
                  title="Click to flip sort order"
                >
                  Proj Finish {sortAsc ? '' : ''}
                </th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Median</th>
                <th style={{ ...thStyle, textAlign: 'center' }} title="Best case: 10th-percentile finish across all sims (older boards without a stored matrix show the 25th percentile)">Ceiling</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Proj DK</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Win%</th>
                <th style={{ ...thStyle, textAlign: 'center' }} {...__fmvTh}>FMV</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Top 3%</th>
                <th style={{ ...thStyle, textAlign: 'center' }} {...__fmvTh}>FMV</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Top 5%</th>
                <th style={{ ...thStyle, textAlign: 'center' }} {...__fmvTh}>FMV</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Top 10%</th>
                <th style={{ ...thStyle, textAlign: 'center' }} {...__fmvTh}>FMV</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Laps Led</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Fast Laps</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>DNF%</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, i) => (
                <tr key={d.driver_name} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-surface)' }}>
                  <td style={{ ...tdStyle, width: 30, textAlign: 'center' }}><input type="checkbox" checked={sel.indexOf(d.driver_name) >= 0} onChange={() => togSel(d.driver_name)} style={{ cursor: 'pointer' }} /></td><td style={{ ...tdStyle, color: 'var(--text-muted)', width: 32 }}>{i + 1}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      {(series === 'cup' || series === 'oreilly' || series === 'trucks') && d.car_number ? (
                        <img
                          src={series === 'cup' ? `/car-numbers/${d.car_number}.png` : series === 'oreilly' ? `/car-numbers-oreilly/${d.car_number}.png` : `/car-numbers-trucks/${d.car_number}.png`}
                          alt={`#${d.car_number}`}
                          style={{ height: 28, width: 'auto', objectFit: 'contain' }}
                          onError={(e) => {
                            e.target.style.display = 'none'
                            if (e.target.nextSibling) e.target.nextSibling.style.display = 'inline'
                          }}
                        />
                      ) : null}
                      {(series === 'cup' || series === 'oreilly' || series === 'trucks') && d.car_number ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'none' }}>
                          #{d.car_number}
                        </span>
                      ) : d.car_number ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          #{d.car_number}
                        </span>
                      ) : null}
                      {d.driver_name}
                    </div>
                    {d.organization && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {d.organization}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{d.start_pos ?? ''}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{d.proj_finish != null ? (+d.proj_finish).toFixed(1) : ''}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{d.finish_p50 != null ? (+d.finish_p50).toFixed(1) : '-'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{(__p10Map && __p10Map[d.driver_name] != null) ? (+__p10Map[d.driver_name]).toFixed(1) : d.finish_p25 != null ? (+d.finish_p25).toFixed(1) : '-'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--accent)', fontWeight: 600 }}>{fmtDK(d.proj_dk)}</td>
                  <td style={{ ...pctStyle(d.win_pct, 5), textAlign: 'center' }}>{fmt(d.win_pct)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{__fmvCell(d.win_pct)}</td>
                  <td style={{ ...pctStyle(d.top3_pct, 10), textAlign: 'center' }}>{fmt(d.top3_pct)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{__fmvCell(d.top3_pct)}</td>
                  <td style={{ ...pctStyle(d.top5_pct, 15), textAlign: 'center' }}>{fmt(d.top5_pct)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{__fmvCell(d.top5_pct)}</td>
                  <td style={{ ...pctStyle(d.top10_pct, 25), textAlign: 'center' }}>{fmt(d.top10_pct)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{__fmvCell(d.top10_pct)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{fmtNum(d.laps_led)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{fmtNum(d.avg_fast_laps)}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{fmt(d.dnf_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
            </div>
          )}
          {tab === 'mv' && (
            <div style={{ overflowX: 'auto' }}>
              {(() => {
  var withMv = (sorted || []).filter(function (d) { return d && d.mv; });
  if (!withMv.length) return null;
  var MK = { Win: 'win', 'Top 3': 't3', 'Top 5': 't5', 'Top 10': 't10' };
  var SF = { Win: 'win_pct', 'Top 3': 'top3_pct', 'Top 5': 'top5_pct', 'Top 10': 'top10_pct' };
  var key = MK[mvMkt] || 'win';
  var dec = function (a) { return a > 0 ? a / 100 + 1 : 100 / (-a) + 1; };
  var fairOdds = function (p) { if (p <= 0) return null; if (p >= 1) return -100000; return p >= 0.5 ? Math.round(-100 * p / (1 - p)) : Math.round(100 * (1 - p) / p); };
  var fo = function (a) { return a == null ? '-' : (a > 0 ? '+' + a : '' + a); };
  var MINP = { win: 2, t3: 5, t5: 8, t10: 12, win_pct: 2, top3_pct: 5, top5_pct: 8, top10_pct: 12 }; // tail guard 2026-07-09 (see SimulationCenter __marketValue)
  var rows = withMv.map(function (d) { var m = d.mv[key]; if (!m) return null; var p = (d[SF[mvMkt]] || 0) / 100; return { name: d.driver_name, dk: m.dk, fd: m.fd, hr: m.hr, best: m.best, bb: (m.bb || '').toUpperCase(), modelPct: d[SF[mvMkt]] || 0, fair: fairOdds(p), ev: m.ev, mev: m.mev }; }).filter(function (r) { return r && r.best != null && r.modelPct >= (MINP[key] != null ? MINP[key] : 0); });
  rows.sort(function (a, b) { return mvSort === 'best' ? (dec(b.best) - dec(a.best)) : mvSort === 'model' ? (b.modelPct - a.modelPct) : (b.ev - a.ev); });
  var MIN_EDGE_PUBLIC = 10; var MAX_FAV_PUBLIC = -250; // house rule 2026-07-10: public boards never surface edges below 10% or favs shorter than -250
  if (mvQual) { rows = rows.filter(function (r) { return r.ev !== null && r.ev >= MIN_EDGE_PUBLIC && r.mev > 0 && !(r.best < 0 && r.best < MAX_FAV_PUBLIC); }); }
  var odds = mvUnits === 'odds';
  var thc = { padding: '7px 6px', color: '#8a8a8a', fontSize: 11, fontWeight: 500, borderBottom: '0.5px solid #333' };
  var seg = function (cur, set, val, label) { return <button onClick={function () { set(val); }} style={{ padding: '5px 10px', fontSize: 12, border: 'none', background: cur === val ? '#262626' : 'transparent', color: cur === val ? '#fff' : '#9a9a9a', cursor: 'pointer' }}>{label}</button>; };
  var oc = function (o, best) { return <span style={{ color: (o != null && o === best) ? '#3fb950' : '#9a9a9a', fontWeight: (o != null && o === best) ? 500 : 400 }}>{fo(o)}</span>; };
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Market value - best line across DK / FD / Hard Rock</div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Edge = model EV at the best available price. The mkt tag means the best price also beats the no-vig consensus - model and market agree.</div>
      <div style={{ marginBottom: 10 }}>{['Win', 'Top 3', 'Top 5', 'Top 10'].map(function (k) { return <button key={k} onClick={function () { setMvMkt(k); }} style={{ padding: '6px 14px', borderRadius: 999, border: '0.5px solid ' + (mvMkt === k ? '#e8c766' : '#333'), background: mvMkt === k ? '#262626' : 'transparent', color: mvMkt === k ? '#f5c518' : '#9a9a9a', fontSize: 13, cursor: 'pointer', marginRight: 4 }}>{k}</button>; })}</div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 12, color: '#888', marginBottom: 10 }}>
        <span>units <span style={{ border: '0.5px solid #333', borderRadius: 6, overflow: 'hidden', display: 'inline-flex' }}>{seg(mvUnits, setMvUnits, 'odds', 'Odds')}{seg(mvUnits, setMvUnits, 'pct', '%')}</span></span>
        <span>sort <span style={{ border: '0.5px solid #333', borderRadius: 6, overflow: 'hidden', display: 'inline-flex' }}>{seg(mvSort, setMvSort, 'edge', 'Edge')}{seg(mvSort, setMvSort, 'best', 'Best')}{seg(mvSort, setMvSort, 'model', 'Model')}</span></span> <span style={{ marginLeft: 4 }}>bets <button onClick={function () { setMvQual(!mvQual); }} style={{ cursor: 'pointer', border: '0.5px solid #333', borderRadius: 6, padding: '2px 8px', background: mvQual ? '#123d24' : 'transparent', color: mvQual ? '#3fb950' : '#888', fontSize: 12 }}>Qualified only</button></span><span style={{ color: '#666' }}>qualified = 10%+ edge, market agrees, no favs past -250</span><span style={{ marginLeft: 8, color: '#3fb950' }}>{rows.length} qualify</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
        <thead><tr>
          <th style={{ ...thc, textAlign: 'left', width: 24 }}>#</th>
          <th style={{ ...thc, textAlign: 'left' }}>Driver</th>
          <th style={{ ...thc, textAlign: 'right' }}><img src="/book-dk.png" alt="DK" style={{ maxHeight: 34, maxWidth: 78, verticalAlign: 'middle' }} /></th>
          <th style={{ ...thc, textAlign: 'right' }}><img src="/book-fd.png" alt="FD" style={{ maxHeight: 34, maxWidth: 78, verticalAlign: 'middle' }} /></th>
          <th style={{ ...thc, textAlign: 'right' }}><img src="/book-hr.png" alt="HR" style={{ maxHeight: 34, maxWidth: 78, verticalAlign: 'middle' }} /></th>
          <th style={{ ...thc, textAlign: 'right' }}>Best</th>
          <th style={{ ...thc, textAlign: 'right' }}>{odds ? 'Fair' : 'Model %'}</th>
          <th style={{ ...thc, textAlign: 'right' }}>Edge</th>
        </tr></thead>
        <tbody>
          {rows.map(function (r, i) {
            var mod = odds ? fo(r.fair) : (r.modelPct.toFixed(1) + '%');
            return <tr key={i}>
              <td style={{ padding: '7px 6px', textAlign: 'left', color: '#8a8a8a' }}>{i + 1}</td>
              <td style={{ padding: '7px 6px', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</td>
              <td style={{ padding: '7px 6px', textAlign: 'right' }}>{oc(r.dk, r.best)}</td>
              <td style={{ padding: '7px 6px', textAlign: 'right' }}>{oc(r.fd, r.best)}</td>
              <td style={{ padding: '7px 6px', textAlign: 'right' }}>{oc(r.hr, r.best)}</td>
              <td style={{ padding: '7px 6px', textAlign: 'right', color: '#3fb950', fontWeight: 500 }}>{fo(r.best)}<img src={'/book-' + r.bb.toLowerCase() + '.png'} alt={r.bb} style={{ maxHeight: 26, maxWidth: 60, verticalAlign: 'middle', marginLeft: 3 }} /></td>
              <td style={{ padding: '7px 6px', textAlign: 'right' }}>{mod}</td>
              <td style={{ padding: '7px 6px', textAlign: 'right' }}>{(r.ev != null && r.ev >= 10) ? <span><span style={{ background: '#123d24', color: '#3fb950', padding: '2px 6px', borderRadius: 999, fontWeight: 500 }}>+{r.ev}%</span>{(r.mev != null && r.mev > 0) ? <span style={{ fontSize: 9, color: '#3fb950', marginLeft: 3 }}>mkt</span> : null}</span> : <span style={{ color: '#555' }}>-</span>}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
})()}
            </div>
          )}
          {tab === 'markets' && <MarketTables results={results} />}
        </>
      )}
    </div>
  )
}
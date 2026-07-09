import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { __marketValue } from './SimulationCenter'

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
function __impl(a){ if(a==null||isNaN(a))return null; return a>0 ? 100/(a+100) : (-a)/((-a)+100); }
function __amFmt(a){ if(a==null)return '-'; return a>0?'+'+a:''+a; }
const __CLV_MKTS=[['win','Win','win_pct'],['t3','Top 3','top3_pct'],['t5','Top 5','top5_pct'],['t10','Top 10','top10_pct']];
function ClvPanel({ data, results }) {
  const [win,setWin]=useState(''); const [t10,setT10]=useState(''); const [fd,setFd]=useState(''); const [hr,setHr]=useState('');
  const [rows,setRows]=useState(null); const [msg,setMsg]=useState(''); const [season,setSeason]=useState(null);
  const meta = data || {};
  function loadSeason(){
    supabase.from('clv_log').select('clv').then(({ data:d })=>{
      if(!d){ setSeason(null); return; }
      const n=d.length, pos=d.filter(x=>x.clv>0).length, avg=n?d.reduce((a,b)=>a+(+b.clv||0),0)/n:0;
      setSeason({ n, pos, avg });
    });
  }
  useEffect(()=>{ loadSeason() },[]);
  function compute(){
    const mapped=(results||[]).map(d=>({ name:d.driver_name, winPct:d.win_pct, top3Pct:d.top3_pct, top5Pct:d.top5_pct, top10Pct:d.top10_pct }));
    const closeMv=__marketValue(win,t10,fd,hr,mapped);
    const out=[];
    (results||[]).forEach(d=>{
      const bet=d.mv||{};
      __CLV_MKTS.forEach(([mk,lbl,pf])=>{
        const b=bet[mk]; if(!b||b.best==null||b.ev==null||b.ev<=0)return;
        const cm=closeMv[d.driver_name]&&closeMv[d.driver_name][mk];
        const closeOdds=cm?cm.best:null;
        const bi=__impl(b.best), ci=__impl(closeOdds);
        const clv=(bi!=null&&ci!=null)?(ci-bi)*100:null;
        out.push({ driver:d.driver_name, market:lbl, mk, simProb:d[pf], betOdds:b.best, closeOdds, clv, ev:b.ev });
      });
    });
    out.sort((a,b)=>((b.clv==null?-999:b.clv)-(a.clv==null?-999:a.clv)));
    setRows(out);
    const graded=out.filter(x=>x.clv!=null);
    setMsg(graded.length?('Computed '+graded.length+' bets. Positive CLV '+graded.filter(x=>x.clv>0).length+'/'+graded.length):'No closing lines matched the flagged bets.');
  }
  async function logSeason(){
    if(!rows)return; const graded=rows.filter(x=>x.clv!=null);
    if(!graded.length){ setMsg('Nothing to log.'); return; }
    await supabase.from('clv_log').delete().eq('series',meta.series).eq('race_year',meta.race_year).eq('race_number',meta.race_number);
    const ins=graded.map(x=>({ series:meta.series, race_year:meta.race_year, race_number:meta.race_number, track_name:meta.track_name, driver_name:x.driver, market:x.mk, sim_prob:x.simProb, bet_odds:x.betOdds, close_odds:x.closeOdds, bet_implied:__impl(x.betOdds), close_implied:__impl(x.closeOdds), clv:x.clv, edge_at_bet:x.ev }));
    const { error }=await supabase.from('clv_log').insert(ins);
    setMsg(error?('Log error: '+error.message):('Logged '+ins.length+' bets to season CLV.'));
    loadSeason();
  }
  const ta={ width:'100%', minHeight:52, fontSize:12, background:'var(--bg-surface)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:6, padding:6 };
  const th={ padding:'6px 10px', fontSize:'0.72rem', color:'var(--text-secondary)', textAlign:'right', borderBottom:'1px solid var(--border)' };
  const td={ padding:'6px 10px', fontSize:'0.85rem', textAlign:'right', borderBottom:'1px solid var(--border)' };
  return (
    <div style={{ maxWidth:780 }}>
      <div style={{ fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:10 }}>Paste the closing odds (right before the race). CLV diffs them against the bet-time odds saved when this sim was published, for every bet the sim flagged +EV. Positive = the line moved your way. No re-run needed.</div>
      {season ? <div style={{ fontSize:'0.8rem', marginBottom:12, color:'var(--text-secondary)' }}>Season CLV: <b>{season.n}</b> logged bets, <b style={{ color: (season.n && season.pos/season.n>=0.5)?'#22c55e':'var(--text)' }}>{season.n?Math.round(100*season.pos/season.n):0}%</b> positive, avg <b>{season.avg>=0?'+':''}{season.avg.toFixed(1)} pts</b></div> : null}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
        <div style={{ flex:1, minWidth:210 }}><div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>DK - Winner / Top 3 / Top 5</div><textarea style={ta} value={win} onChange={e=>setWin(e.target.value)} /></div>
        <div style={{ flex:1, minWidth:210 }}><div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>DK - Top 10</div><textarea style={ta} value={t10} onChange={e=>setT10(e.target.value)} /></div>
        <div style={{ flex:1, minWidth:210 }}><div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>FanDuel</div><textarea style={ta} value={fd} onChange={e=>setFd(e.target.value)} /></div>
        <div style={{ flex:1, minWidth:210 }}><div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>Hard Rock</div><textarea style={ta} value={hr} onChange={e=>setHr(e.target.value)} /></div>
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <button onClick={compute} style={{ padding:'7px 14px', borderRadius:6, border:'none', background:'var(--accent)', color:'#111', fontWeight:600, cursor:'pointer' }}>Compute CLV</button>
        {rows ? <button onClick={logSeason} style={{ padding:'7px 14px', borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--text)', cursor:'pointer' }}>Log to season CLV</button> : null}
        <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{msg}</span>
      </div>
      {rows && rows.length ? (
        <table style={{ width:'100%', borderCollapse:'collapse', marginTop:12 }}>
          <thead><tr><th style={{ ...th, textAlign:'left' }}>Driver</th><th style={{ ...th, textAlign:'left' }}>Market</th><th style={th}>Sim %</th><th style={th}>Bet line</th><th style={th}>Close line</th><th style={th}>CLV</th></tr></thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i}>
                <td style={{ ...td, textAlign:'left' }}>{r.driver}</td>
                <td style={{ ...td, textAlign:'left' }}>{r.market}</td>
                <td style={td}>{r.simProb!=null?(+r.simProb).toFixed(1)+'%':'-'}</td>
                <td style={td}>{__amFmt(r.betOdds)}</td>
                <td style={td}>{__amFmt(r.closeOdds)}</td>
                <td style={{ ...td, fontWeight:600, color: r.clv==null?'var(--text-muted)':(r.clv>0?'#22c55e':'#ef4444') }}>{r.clv==null?'-':(r.clv>0?'+':'')+r.clv.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

export default function SimResults() {
  const [series, setSeries]       = useState('cup')
  const [mvMkt, setMvMkt] = useState('Win')
  const [mvUnits, setMvUnits] = useState('odds')
  const [mvSort, setMvSort] = useState('edge')
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

  const sorted = [...results].sort((a, b) => {
    const aVal = a.proj_finish ?? 99
    const bVal = b.proj_finish ?? 99
    return sortAsc ? aVal - bVal : bVal - aVal
  })

  const tabStyle = (s) => ({
    padding: '8px 18px', border: 'none', borderRadius: 6, cursor: 'pointer',
    fontWeight: 600, fontSize: '0.875rem',
    background: series === s ? 'var(--accent)' : 'var(--bg-surface)',
    color: series === s ? '#111' : 'var(--text-secondary)',
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
        </div>
      )}

      {loading && <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading</div>}
      {error   && <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>{error}</div>}

      {!loading && !error && sorted.length > 0 && (
        <>
          <CompareTray sel={sel} config={data && data.config} onToggle={togSel} onClear={() => setSel([])} />
          <div style={{ display: 'flex', gap: 6, margin: '2px 0 14px', flexWrap: 'wrap' }}>
            {[['proj', 'Projections'], ['mv', 'Market Value'], ['markets', 'Mfr & Team'], ['clv', 'CLV']].map((ct) => (
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
                <th style={{ ...thStyle, textAlign: 'center' }}>Ceiling</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Proj DK</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Win%</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Top 3%</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Top 5%</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Top 10%</th>
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
                      {(series === 'cup' || series === 'oreilly') && d.car_number ? (
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
                  <td style={{ ...tdStyle, textAlign: 'center' }}>{d.finish_p25 != null ? (+d.finish_p25).toFixed(1) : '-'}</td>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--accent)', fontWeight: 600 }}>{fmtDK(d.proj_dk)}</td>
                  <td style={{ ...pctStyle(d.win_pct, 5), textAlign: 'center' }}>{fmt(d.win_pct)}</td>
                  <td style={{ ...pctStyle(d.top3_pct, 10), textAlign: 'center' }}>{fmt(d.top3_pct)}</td>
                  <td style={{ ...pctStyle(d.top5_pct, 15), textAlign: 'center' }}>{fmt(d.top5_pct)}</td>
                  <td style={{ ...pctStyle(d.top10_pct, 25), textAlign: 'center' }}>{fmt(d.top10_pct)}</td>
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
  var rows = withMv.map(function (d) { var m = d.mv[key]; if (!m) return null; var p = (d[SF[mvMkt]] || 0) / 100; return { name: d.driver_name, dk: m.dk, fd: m.fd, hr: m.hr, best: m.best, bb: (m.bb || '').toUpperCase(), modelPct: d[SF[mvMkt]] || 0, fair: fairOdds(p), ev: m.ev, mev: m.mev }; }).filter(function (r) { return r && r.best != null; });
  rows.sort(function (a, b) { return mvSort === 'best' ? (dec(b.best) - dec(a.best)) : mvSort === 'model' ? (b.modelPct - a.modelPct) : (b.ev - a.ev); });
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
        <span>sort <span style={{ border: '0.5px solid #333', borderRadius: 6, overflow: 'hidden', display: 'inline-flex' }}>{seg(mvSort, setMvSort, 'edge', 'Edge')}{seg(mvSort, setMvSort, 'best', 'Best')}{seg(mvSort, setMvSort, 'model', 'Model')}</span></span>
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
              <td style={{ padding: '7px 6px', textAlign: 'right' }}>{r.ev > 0 ? <span style={{ background: '#123d24', color: '#3fb950', padding: '2px 6px', borderRadius: 999, fontWeight: 500 }}>+{r.ev}%</span> : <span style={{ color: '#8a8a8a' }}>{r.ev}%</span>}{(r.mev != null && r.mev > 0) ? <span style={{ fontSize: 9, color: '#3fb950', marginLeft: 3 }}>mkt</span> : null}</td>
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
          {tab === 'clv' && <ClvPanel data={data} results={results} />}
        </>
      )}
    </div>
  )
}
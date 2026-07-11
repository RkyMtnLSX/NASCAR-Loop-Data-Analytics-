import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { __marketValue } from './SimulationCenter'

function __parseFinish(txt, board) {
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\b(jr|sr|iii|ii|iv)\b/g, '').replace(/\s+/g, ' ').trim()
  const byFull = {}, byCar = {}, lastCount = {}, byLast = {}
  board.forEach(d => {
    const full = norm(d.driver_name)
    byFull[full] = d
    byCar[String(d.car_number)] = d
    const last = full.split(' ').slice(-1)[0]
    lastCount[last] = (lastCount[last] || 0) + 1
    byLast[last] = d
  })
  const lines = txt.split('\n').map(l => l.trim()).filter(Boolean)
  const actualMap = {}, matched = [], unmatched = []
  let pos = 0
  lines.forEach(line => {
    const nl = norm(line)
    let d = null
    for (const f in byFull) { if (f && nl.indexOf(f) >= 0) { d = byFull[f]; break } }
    if (!d) { const toks = nl.split(' '); for (const t of toks) { if (lastCount[t] === 1) { d = byLast[t]; break } } }
    if (!d) { const cars = line.match(/\b\d{1,2}\b/g) || []; for (const cc of cars) { if (byCar[cc]) { d = byCar[cc]; break } } }
    if (d) { if (!actualMap[String(d.car_number)]) { pos++; actualMap[String(d.car_number)] = pos; matched.push(d.driver_name) } }
    else unmatched.push(line.slice(0, 40))
  })
  return { actualMap, matched, unmatched }
}

function __gradeRace(board, actualMap, preOwned) {
  const dec = a => a > 0 ? a / 100 + 1 : 100 / Math.abs(a) + 1
  const Ncut = { win: 1, t3: 3, t5: 5, t10: 10 }
  const rows = board.map(d => ({ name: d.driver_name, car: String(d.car_number), pf: d.proj_finish, win: d.win_pct, t3: d.top3_pct, t5: d.top5_pct, t10: d.top10_pct, mv: d.mv, act: actualMap[String(d.car_number)] })).filter(d => d.act != null)
  const n = rows.length
  const spearman = (a, b) => { const rk = x => { const idx = x.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = Array(x.length); idx.forEach((p, i) => r[p[1]] = i + 1); return r }; const ra = rk(a), rb = rk(b); let d2 = 0; for (let i = 0; i < a.length; i++) d2 += (ra[i] - rb[i]) * (ra[i] - rb[i]); return +(1 - 6 * d2 / (a.length * (a.length * a.length - 1))).toFixed(3) }
  const act = rows.map(r => r.act)
  const mae = +(rows.reduce((s, r) => s + Math.abs(r.pf - r.act), 0) / n).toFixed(2)
  const ind = N => rows.map(r => r.act <= N ? 1 : 0)
  const brier = (probs, ii) => +(probs.reduce((s, p, i) => s + (p / 100 - ii[i]) * (p / 100 - ii[i]), 0) / n).toFixed(4)
  const metrics = { n: n, mae: mae, spearman_pf: spearman(rows.map(r => r.pf), act), win_brier: brier(rows.map(r => r.win), ind(1)), top3_brier: brier(rows.map(r => r.t3), ind(3)), top5_brier: brier(rows.map(r => r.t5), ind(5)), top10_brier: brier(rows.map(r => r.t10), ind(10)) }
  const prec = (key, N) => rows.slice().sort((a, b) => b[key] - a[key]).slice(0, N).filter(d => d.act <= N).length
  metrics.prec = { win: prec('win', 1), t3: prec('t3', 3), t5: prec('t5', 5), t10: prec('t10', 10) }
  const evFlags = []
  var MIN_EDGE_BET = 10; var MAX_FAV_BET = -250; // house rule 2026-07-10: only edges >= 10% (and no favs shorter than -250) count as logged bets
  rows.forEach(r => { if (!r.mv) return; ['win', 't3', 't5', 't10'].forEach(mk => { const m = r.mv[mk]; if (!m || m.ev == null || m.ev < MIN_EDGE_BET) return; if (m.best != null && m.best < 0 && m.best < MAX_FAV_BET) return; if (preOwned && preOwned.has(r.name + '|' + mk)) return; evFlags.push({ driver: r.name, market: mk, price: m.best, book: (m.bb || '').toUpperCase(), ev: m.ev, mev: m.mev, hit: r.act <= Ncut[mk] }) }) })
  const roiOf = fl => { if (!fl.length) return { bets: 0, profit: 0, roi: 0 }; const ret = fl.reduce((s, f) => s + (f.hit ? dec(f.price) : 0), 0); return { bets: fl.length, profit: +(ret - fl.length).toFixed(2), roi: +(((ret - fl.length) / fl.length) * 100).toFixed(1) } }
  const roi = { all: roiOf(evFlags), win: roiOf(evFlags.filter(f => f.market === 'win')), exwin: roiOf(evFlags.filter(f => f.market !== 'win')), consensus: roiOf(evFlags.filter(f => f.mev > 0)) }
  const detail = rows.slice().sort((a, b) => a.act - b.act).map(r => ({ name: r.name, car: r.car, pf: r.pf, act: r.act, win: r.win, flags: evFlags.filter(f => f.driver === r.name).map(f => f.market) }))
  return { metrics: metrics, evFlags: evFlags, roi: roi, detail: detail }
}

const SERIES_TABS = [{ id: 'cup', label: 'Cup Series' }, { id: 'oreilly', label: "O'Reilly Series" }, { id: 'trucks', label: 'Truck Series' }]

// Pre-board bet ownership (2026-07-11): when grading a POST sim, bets already flagged on the
// PRE board (same race) are NOT re-logged - the position was taken at the better pre price
// (that gap is CLV, tracked in the CLV panel), so re-flagging at post odds double-counts.
async function __preOwnedFlags(series, postRow) {
  try {
    const { data } = await supabase.from('sim_results').select('results, race_number, race_year')
      .eq('series', series).eq('stage', 'pre').order('published_at', { ascending: false }).limit(1)
    const pre = (data || [])[0]
    if (!pre || !pre.results) return null
    if (postRow && postRow.race_number != null && pre.race_number != null && String(pre.race_number) !== String(postRow.race_number)) return null
    const owned = new Set()
    pre.results.forEach(d => {
      if (!d.mv) return
      ;['win', 't3', 't5', 't10'].forEach(mk => {
        const m = d.mv[mk]
        if (m && m.ev != null && m.ev >= 10 && !(m.best != null && m.best < 0 && m.best < -250)) owned.add(d.driver_name + '|' + mk)
      })
    })
    return owned.size ? owned : null
  } catch (e) { return null }
}

function __impl(a){ if(a==null||isNaN(a))return null; return a>0 ? 100/(a+100) : (-a)/((-a)+100); }
function __amFmt(a){ if(a==null)return '-'; return a>0?'+'+a:''+a; }
const __CLV_MKTS=[['win','Win','win_pct'],['t3','Top 3','top3_pct'],['t5','Top 5','top5_pct'],['t10','Top 10','top10_pct']];
function ClvPanel({ series, stage }) {
  const [sim,setSim]=useState(null);
  const [win,setWin]=useState(''); const [t10,setT10]=useState(''); const [fd,setFd]=useState(''); const [hr,setHr]=useState('');
  const [rows,setRows]=useState(null); const [msg,setMsg]=useState(''); const [season,setSeason]=useState(null); const [hist,setHist]=useState([]);
  function loadSeason(){ supabase.from('clv_log').select('*').order('race_year',{ ascending:false }).order('race_number',{ ascending:false }).order('clv',{ ascending:false }).then(({ data:d })=>{ if(!d){ setSeason(null); setHist([]); return; } const n=d.length,pos=d.filter(x=>x.clv>0).length,avg=n?d.reduce((a,b)=>a+(+b.clv||0),0)/n:0; setSeason({ n, pos, avg }); setHist(d); }); }
  useEffect(()=>{ loadSeason() },[]);
  useEffect(()=>{ setSim(null); setRows(null); },[series,stage]);
  async function loadSim(){
    const { data } = await supabase.from('sim_results').select('*').eq('series',series).eq('stage',stage).order('published_at',{ ascending:false }).limit(1);
    const row=(data||[])[0];
    if(!row||!row.results){ setSim(null); setMsg('No published '+stage+' sim for '+series+'.'); return; }
    setSim(row); setRows(null); setMsg('Loaded '+row.track_name+' ('+stage+' sim, '+row.results.length+' drivers). Paste closing odds, then Compute.');
  }
  function compute(){
    if(!sim){ setMsg('Load a sim first.'); return; }
    const mapped=(sim.results||[]).map(d=>({ name:d.driver_name, winPct:d.win_pct, top3Pct:d.top3_pct, top5Pct:d.top5_pct, top10Pct:d.top10_pct }));
    const closeMv=__marketValue(win,t10,fd,hr,mapped);
    const out=[];
    (sim.results||[]).forEach(d=>{
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
    setMsg(graded.length?('Computed '+graded.length+' bets. Positive CLV '+graded.filter(x=>x.clv>0).length+'/'+graded.length):'No closing lines matched the flagged +EV bets.');
  }
  async function logSeason(){
    if(!sim||!rows)return; const graded=rows.filter(x=>x.clv!=null);
    if(!graded.length){ setMsg('Nothing to log.'); return; }
    await supabase.from('clv_log').delete().eq('series',sim.series).eq('race_year',sim.race_year).eq('race_number',sim.race_number);
    const ins=graded.map(x=>({ series:sim.series, race_year:sim.race_year, race_number:sim.race_number, track_name:sim.track_name, driver_name:x.driver, market:x.mk, sim_prob:x.simProb, bet_odds:x.betOdds, close_odds:x.closeOdds, bet_implied:__impl(x.betOdds), close_implied:__impl(x.closeOdds), clv:x.clv, edge_at_bet:x.ev }));
    const { error } = await supabase.from('clv_log').insert(ins);
    setMsg(error?('Log error: '+error.message):('Logged '+ins.length+' bets to season CLV.'));
    loadSeason();
  }
  const ta={ width:'100%', minHeight:50, fontSize:12, background:'var(--bg-surface)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:6, padding:6 };
  const th={ padding:'6px 10px', fontSize:'0.72rem', color:'var(--text-secondary)', textAlign:'right', borderBottom:'1px solid var(--border)' };
  const td={ padding:'6px 10px', fontSize:'0.85rem', textAlign:'right', borderBottom:'1px solid var(--border)' };
  const btn={ padding:'7px 14px', borderRadius:6, border:'none', background:'var(--accent)', color:'#111', fontWeight:600, cursor:'pointer' };
  return (
    <div style={{ maxWidth:800 }}>
      <div style={{ fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:10 }}>Load the sim you bet off (uses the series + stage selected above), then paste the closing odds. CLV diffs them against the bet-time odds saved on that sim, for every +EV bet it flagged. No re-run needed.</div>
      {season ? <div style={{ fontSize:'0.8rem', marginBottom:12, color:'var(--text-secondary)' }}>Season CLV: <b>{season.n}</b> logged bets, <b style={{ color:(season.n && season.pos/season.n>=0.5)?'#22c55e':'var(--text)' }}>{season.n?Math.round(100*season.pos/season.n):0}%</b> positive, avg <b>{season.avg>=0?'+':''}{season.avg.toFixed(1)} pts</b></div> : null}
      <div style={{ marginBottom:10 }}><button onClick={loadSim} style={{ ...btn, background:'var(--bg-surface)', color:'var(--text)', border:'1px solid var(--border)' }}>Load latest {stage} sim ({series})</button></div>
      {sim ? (
        <div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
            <div style={{ flex:1, minWidth:210 }}><div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>DK - Winner / Top 3 / Top 5</div><textarea style={ta} value={win} onChange={e=>setWin(e.target.value)} /></div>
            <div style={{ flex:1, minWidth:210 }}><div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>DK - Top 10</div><textarea style={ta} value={t10} onChange={e=>setT10(e.target.value)} /></div>
            <div style={{ flex:1, minWidth:210 }}><div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>FanDuel</div><textarea style={ta} value={fd} onChange={e=>setFd(e.target.value)} /></div>
            <div style={{ flex:1, minWidth:210 }}><div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>Hard Rock</div><textarea style={ta} value={hr} onChange={e=>setHr(e.target.value)} /></div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <button onClick={compute} style={btn}>Compute CLV</button>
            {rows ? <button onClick={logSeason} style={{ ...btn, background:'transparent', color:'var(--text)', border:'1px solid var(--border)' }}>Log to season CLV</button> : null}
            <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{msg}</span>
          </div>
        </div>
      ) : <div style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>{msg}</div>}
      {rows && rows.length ? (
        <table style={{ width:'100%', borderCollapse:'collapse', marginTop:12 }}>
          <thead><tr><th style={{ ...th, textAlign:'left' }}>Driver</th><th style={{ ...th, textAlign:'left' }}>Market</th><th style={th}>Sim %</th><th style={th}>Bet line</th><th style={th}>Close line</th><th style={{ ...th, cursor: 'help' }} title="Closing Line Value in points - how much the closing implied % beat your bet-time price. Positive = the line moved your way">CLV</th></tr></thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i}>
                <td style={{ ...td, textAlign:'left' }}>{r.driver}</td>
                <td style={{ ...td, textAlign:'left' }}>{r.market}</td>
                <td style={td}>{r.simProb!=null?(+r.simProb).toFixed(1)+'%':'-'}</td>
                <td style={td}>{__amFmt(r.betOdds)}</td>
                <td style={td}>{__amFmt(r.closeOdds)}</td>
                <td style={{ ...td, fontWeight:600, color:r.clv==null?'var(--text-muted)':(r.clv>0?'#22c55e':'#ef4444') }}>{r.clv==null?'-':(r.clv>0?'+':'')+r.clv.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {hist && hist.length ? (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8 }}>CLV history ({hist.length})</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...th, textAlign: 'left' }}>Race</th><th style={{ ...th, textAlign: 'left' }}>Driver</th><th style={{ ...th, textAlign: 'left', cursor: 'help' }} title="Market - Win / Top 3 / Top 5 / Top 10">Mkt</th><th style={th}>Sim %</th><th style={th}>Bet</th><th style={th}>Close</th><th style={{ ...th, cursor: 'help' }} title="Closing Line Value in points - how much the closing implied % beat your bet-time price. Positive = the line moved your way">CLV</th></tr></thead>
              <tbody>
                {hist.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...td, textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{'R' + r.race_number + ' ' + (r.track_name || '').replace(/ (Motor )?Speedway| International| Superspeedway| Raceway/, '') + " '" + String(r.race_year).slice(2) + ' ' + (r.series || '')}</td>
                    <td style={{ ...td, textAlign: 'left' }}>{r.driver_name}</td>
                    <td style={{ ...td, textAlign: 'left' }}>{({ win: 'Win', t3: 'Top 3', t5: 'Top 5', t10: 'Top 10' })[r.market] || r.market}</td>
                    <td style={td}>{r.sim_prob != null ? (+r.sim_prob).toFixed(1) + '%' : '-'}</td>
                    <td style={td}>{__amFmt(r.bet_odds)}</td>
                    <td style={td}>{__amFmt(r.close_odds)}</td>
                    <td style={{ ...td, fontWeight: 600, color: r.clv > 0 ? '#22c55e' : '#ef4444' }}>{(r.clv > 0 ? '+' : '') + (+r.clv).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function GradeCenter() {
  const [series, setSeries] = useState('cup')
  const [gradeTxt, setGradeTxt] = useState('')
  const [raceNum, setRaceNum] = useState('')
  const [gradeStage, setGradeStage] = useState('post')
  const [prev, setPrev] = useState(null)
  const [msg, setMsg] = useState('')
  const [log, setLog] = useState([])
  const loadLog = () => supabase.from('sim_grades').select('*').order('race_year', { ascending: false }).order('race_number', { ascending: false, nullsFirst: false }).order('graded_at', { ascending: false }).limit(100).then(({ data }) => setLog(data || []))
  useEffect(() => { loadLog() }, [])
  const runGrade = async () => {
    setMsg('Grading...')
    const { data } = await supabase.from('sim_results').select('*').eq('series', series).eq('stage', gradeStage).order('published_at', { ascending: false }).limit(1)
    const row = (data || [])[0]
    if (!row || !row.results) { setPrev(null); setMsg('No published sim found for ' + series + '.'); return }
    if (row.race_number != null) setRaceNum(String(row.race_number))
    const parsed = __parseFinish(gradeTxt, row.results)
    if (Object.keys(parsed.actualMap).length < 3) { setPrev(null); setMsg('Could not read the finishing order - paste one driver per line, winner first.'); return }
    const __preOwned = gradeStage === 'post' ? await __preOwnedFlags(series, row) : null
    const g = __gradeRace(row.results, parsed.actualMap, __preOwned)
    setPrev({ metrics: g.metrics, evFlags: g.evFlags, roi: g.roi, detail: g.detail, parsed: parsed, simId: row.id, track: row.track_name, year: row.race_year, config: row.config })
    setMsg(parsed.matched.length + ' matched' + (parsed.unmatched.length ? ', ' + parsed.unmatched.length + ' skipped' : '') + '.')
  }
  const gradeFromDB = async () => {
    setMsg('Loading finish from loop data...')
    const { data } = await supabase.from('sim_results').select('*').eq('series', series).eq('stage', gradeStage).order('published_at', { ascending: false }).limit(1)
    const row = (data || [])[0]
    if (!row || !row.results) { setPrev(null); setMsg('No published sim found for ' + series + '.'); return }
    const res = await supabase.from('loop_data').select('driver_name, finish_position, race_number').eq('series', series).eq('track_name', row.track_name).eq('year', row.race_year)
    let laps = res.data || []
    if (!laps.length) { setPrev(null); setMsg('No loop data found for ' + row.track_name + ' ' + row.race_year + ' (' + series + '). Load it in Admin, or paste the finish above.'); return }
    const rns = Array.from(new Set(laps.map(l => l.race_number)))
    if (rns.length > 1) { if (row.race_number != null && rns.indexOf(row.race_number) >= 0) { laps = laps.filter(l => l.race_number === row.race_number) } else { setPrev(null); setMsg('Two races found for this track/year (R' + rns.join(', R') + '). Set the sim Race # to match one, then re-import.'); return } }
    const nrm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean).join(' ')
    const byName = {}
    row.results.forEach(d => { byName[nrm(d.driver_name)] = String(d.car_number) })
    const actualMap = {}
    laps.forEach(l => { const car = byName[nrm(l.driver_name)]; if (car && l.finish_position != null) actualMap[car] = l.finish_position })
    if (Object.keys(actualMap).length < 3) { setPrev(null); setMsg('Could not match loop-data drivers to the published sim.'); return }
    const __preOwned2 = gradeStage === 'post' ? await __preOwnedFlags(series, row) : null
    const g = __gradeRace(row.results, actualMap, __preOwned2)
    if (row.race_number != null) setRaceNum(String(row.race_number))
    setPrev({ metrics: g.metrics, evFlags: g.evFlags, roi: g.roi, detail: g.detail, parsed: { actualMap: actualMap }, simId: row.id, track: row.track_name, year: row.race_year, config: row.config })
    setMsg('Imported ' + Object.keys(actualMap).length + ' finishes from loop data.')
  }
  const saveGrade = async () => {
    if (!prev) return
    setMsg('Saving...')
    const actualArr = Object.keys(prev.parsed.actualMap).map(car => ({ car_number: car, finish: prev.parsed.actualMap[car] }))
    const rn = raceNum ? parseInt(raceNum) : null
    const rowData = { sim_id: prev.simId, series: series, track_name: prev.track, race_year: prev.year, race_number: rn, actual: actualArr, metrics: prev.metrics, ev_flags: prev.evFlags, roi: prev.roi, shade_on: false, stage: gradeStage, config: prev.config }
    let existing = []
    if (rn != null) { const q = await supabase.from('sim_grades').select('id').eq('series', series).eq('race_year', prev.year).eq('race_number', rn).eq('stage', gradeStage); existing = q.data || [] }
    const resp = existing.length ? await supabase.from('sim_grades').update(rowData).eq('id', existing[0].id) : await supabase.from('sim_grades').insert(rowData)
    if (resp.error) { setMsg('Save error: ' + resp.error.message); return }
    setMsg(existing.length ? 'Updated R' + rn + '.' : 'Saved.'); setPrev(null); setGradeTxt(''); loadLog()
  }
  const pill = v => ({ color: v >= 0 ? '#2e9e52' : '#dd3355', fontWeight: 700 })
  const cfgSummary = c => { if (!c) return '-'; const w = c.weights || {}; const prac = (w.longRunPace || 0) + (w.shortRunPace || 0); return 'corr ' + (w.corrHistory != null ? w.corrHistory : '?') + ' / start ' + (w.startPos != null ? w.startPos : '?') + ' / track ' + (w.trackHistory != null ? w.trackHistory : '?') + ' / prac ' + prac + '  |  DNF ' + ((c.dnf && c.dnf.label) || '?') + ' / Caution ' + ((c.caution && c.caution.label) || '?') + (c.rainOut ? '  |  Rain-out grid' : ''); }
  const cfgShort = c => { if (!c) return '-'; const w = c.weights || {}; const prac = (w.longRunPace || 0) + (w.shortRunPace || 0); let reg = 'Oval'; if ((w.trackHistory || 0) >= 0.25 && prac === 0) reg = 'SuperS'; else if ((w.trackHistory || 0) === 0 && (w.corrHistory || 0) >= 0.5) reg = 'Road'; return reg + ' / ' + ((c.dnf && c.dnf.label) || '?') + (c.rainOut ? ' / RO' : ''); }
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>Sim Grader</h1>
      <div style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Grade a published sim against the actual finish and log it.</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid rgba(128,128,128,0.25)' }}>
        {SERIES_TABS.map(t => (
          <button key={t.id} onClick={() => { setSeries(t.id); setRaceNum(''); setPrev(null) }} style={{ padding: '8px 14px', border: 'none', background: 'none', borderBottom: series === t.id ? '2px solid #e8b923' : '2px solid transparent', color: series === t.id ? '#e8b923' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}>{t.label}</button>
        ))}
      </div>
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>Grades the latest published {series.toUpperCase()} sim. Paste the finishing order, winner first (driver names or car numbers both work).</div>
        <textarea value={gradeTxt} onChange={e => setGradeTxt(e.target.value)} rows={8} placeholder={'1 Chase Briscoe\n2 Christopher Bell\n3 Denny Hamlin\n...'} style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', padding: 10, borderRadius: 6, boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Stage:</span>
          <button onClick={() => setGradeStage('pre')} style={{ padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: gradeStage === 'pre' ? '#e8b923' : 'rgba(128,128,128,0.2)', color: gradeStage === 'pre' ? '#000' : 'inherit', fontWeight: 600 }}>Pre</button>
          <button onClick={() => setGradeStage('post')} style={{ padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: gradeStage === 'post' ? '#e8b923' : 'rgba(128,128,128,0.2)', color: gradeStage === 'post' ? '#000' : 'inherit', fontWeight: 600 }}>Post</button>
          <input type="number" value={raceNum} onChange={e => setRaceNum(e.target.value)} placeholder="Race #" title="Season round number, e.g. 19" style={{ width: 90, padding: '9px 10px', borderRadius: 6, border: '1px solid rgba(128,128,128,0.35)', background: 'transparent', color: 'inherit', boxSizing: 'border-box' }} />
          <button onClick={runGrade} style={{ padding: '9px 20px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Grade</button>
          <button onClick={gradeFromDB} style={{ padding: '9px 20px', borderRadius: 6, border: '1px solid #2563eb', background: 'transparent', color: '#2563eb', fontWeight: 600, cursor: 'pointer' }}>Import from loop data</button>
          {prev && <button onClick={saveGrade} style={{ padding: '9px 20px', borderRadius: 6, border: 'none', background: '#1f7a3d', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Save to log</button>}
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{msg}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>Race # = season round (Chicagoland Cup 2026 = 19). Re-grading the same race # updates its row instead of duplicating.</div>
      </div>
      {prev && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 10 }}>{prev.track} {prev.year}{raceNum ? ' R' + raceNum : ''} &mdash; preview</h3>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10 }}>Config: {cfgSummary(prev.config)}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 12, fontSize: '0.9rem' }}>
            <span>MAE <b>{prev.metrics.mae}</b></span>
            <span>Spearman <b>{prev.metrics.spearman_pf}</b></span>
            <span>Win Brier <b>{prev.metrics.win_brier}</b></span>
            <span>Top3 Brier <b>{prev.metrics.top3_brier}</b></span>
            <span>Top5 Brier <b>{prev.metrics.top5_brier}</b></span>
            <span>Top10 Brier <b>{prev.metrics.top10_brier}</b></span>
            <span>Prec 3/5/10 <b>{prev.metrics.prec.t3}/{prev.metrics.prec.t5}/{prev.metrics.prec.t10}</b></span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginBottom: 16, fontSize: '0.9rem' }}>
            <span>+EV all ({prev.roi.all.bets}) <b style={pill(prev.roi.all.roi)}>{prev.roi.all.roi}%</b></span>
            <span>ex-win ({prev.roi.exwin.bets}) <b style={pill(prev.roi.exwin.roi)}>{prev.roi.exwin.roi}%</b></span>
            <span>win-only ({prev.roi.win.bets}) <b style={pill(prev.roi.win.roi)}>{prev.roi.win.roi}%</b></span>
            <span>consensus ({prev.roi.consensus.bets}) <b style={pill(prev.roi.consensus.roi)}>{prev.roi.consensus.roi}%</b></span>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 380px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 6 }}>Full field (proj vs actual)</div>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}><th style={{ padding: '3px 6px' }}>Fin</th><th>Driver</th><th>Proj</th><th>Delta</th><th>Win%</th></tr></thead>
                <tbody>
                  {prev.detail.map(d => (
                    <tr key={d.car} style={{ borderTop: '1px solid rgba(128,128,128,0.18)' }}>
                      <td style={{ padding: '3px 6px' }}>{d.act}</td>
                      <td>{d.name}{d.flags.length ? ' *' : ''}</td>
                      <td>{d.pf}</td>
                      <td style={{ color: (d.pf - d.act) >= 0 ? '#2e9e52' : '#dd3355' }}>{(d.pf - d.act) > 0 ? '+' : ''}{(d.pf - d.act).toFixed(1)}</td>
                      <td>{d.win}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ flex: '1 1 380px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 6 }}>+EV flags ({prev.evFlags.length})</div>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}><th style={{ padding: '3px 6px' }}>Mkt</th><th>Driver</th><th>Price</th><th>EV</th><th>Res</th></tr></thead>
                <tbody>
                  {prev.evFlags.map((f, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(128,128,128,0.18)' }}>
                      <td style={{ padding: '3px 6px', textTransform: 'uppercase' }}>{f.market}</td>
                      <td>{f.driver.split(' ').slice(-1)[0]}</td>
                      <td>{f.price > 0 ? '+' : ''}{f.price} {f.book}</td>
                      <td>+{f.ev}{f.mev > 0 ? ' c+' + f.mev : ''}</td>
                      <td style={{ color: f.hit ? '#2e9e52' : '#dd3355', fontWeight: 600 }}>{f.hit ? 'HIT' : 'miss'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ fontWeight: 600, marginBottom: 10 }}>Season log ({log.length})</h3>
        {log.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No graded races yet.</div>}
        {log.length > 0 && (
          <table style={{ width: '100%', fontSize: '0.83rem', borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}><th style={{ padding: '4px 8px' }}>R#</th><th title="Sim stage - pre = before practice/qualifying, post = after" style={{ cursor: 'help' }}>Stage</th><th title="Weight config used for this sim" style={{ cursor: 'help' }}>Config</th><th>Race</th><th title="Mean Absolute Error - average positions off between projected and actual finish (lower is better)" style={{ cursor: 'help' }}>MAE</th><th title="Spearman rank correlation of projected vs actual finish, -1 to 1 (higher = closer order)" style={{ cursor: 'help' }}>Spear</th><th title="Win Brier score - calibration of the win probabilities vs the actual result (lower is better)" style={{ cursor: 'help' }}>WinBr</th><th title="Flat-bet ROI% on every bet the sim flagged +EV that race (1 unit each, at the best book price)" style={{ cursor: 'help' }}>+EV</th><th title="ROI% excluding the win market (Top 3/5/10 bets only) - a cleaner read on edge, since the win market overshoots" style={{ cursor: 'help' }}>ex-win</th><th title="ROI% on win-market +EV bets only - the overshoot-prone bucket" style={{ cursor: 'help' }}>win</th><th title="Consensus ROI% - only bets that were +EV against the de-vigged market price (higher conviction)" style={{ cursor: 'help' }}>cons</th></tr></thead>
            <tbody>
              {log.map(g => (
                <tr key={g.id} style={{ borderTop: '1px solid rgba(128,128,128,0.2)' }}>
                  <td style={{ padding: '4px 8px', fontWeight: 600 }}>{g.race_number != null ? 'R' + g.race_number : '-'}</td><td style={{ textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{g.stage || 'post'}</td><td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{cfgShort(g.config)}</td>
                  <td>{(g.track_name || '').replace(' Speedway', '')} {g.race_year} <span style={{ textTransform: 'uppercase', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{g.series}</span></td>
                  <td>{g.metrics && g.metrics.mae}</td>
                  <td>{g.metrics && g.metrics.spearman_pf}</td>
                  <td>{g.metrics && g.metrics.win_brier}</td>
                  <td style={pill(g.roi && g.roi.all ? g.roi.all.roi : 0)}>{g.roi && g.roi.all && g.roi.all.roi}%</td>
                  <td style={pill(g.roi && g.roi.exwin ? g.roi.exwin.roi : 0)}>{g.roi && g.roi.exwin && g.roi.exwin.roi}%</td>
                  <td style={pill(g.roi && g.roi.win ? g.roi.win.roi : 0)}>{g.roi && g.roi.win && g.roi.win.roi}%</td>
                  <td style={pill(g.roi && g.roi.consensus ? g.roi.consensus.roi : 0)}>{g.roi && g.roi.consensus && g.roi.consensus.roi}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 10 }}>Closing Line Value (CLV)</h2>
          <ClvPanel series={series} stage={gradeStage} />
        </div>
      </div>
    </div>
  )
}

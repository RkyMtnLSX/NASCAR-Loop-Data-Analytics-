import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/fetchAllRows'
import { __marketValue } from './SimulationCenter'

import { __nmName, __parseFinish, __gradeRace, __preOwnedFlags, gradeBoardFromLoopData, resolveRaceRow } from '../lib/gradeRace'
const SERIES_TABS = [{ id: 'cup', label: 'Cup Series' }, { id: 'oreilly', label: "O'Reilly Series" }, { id: 'trucks', label: 'Truck Series' }]

function __impl(a){ if(a==null||isNaN(a))return null; return a>0 ? 100/(a+100) : (-a)/((-a)+100); }
function __amFmt(a){ if(a==null)return '-'; return a>0?'+'+a:''+a; }
const __CLV_MKTS=[['win','Win','win_pct'],['t3','Top 3','top3_pct'],['t5','Top 5','top5_pct'],['t10','Top 10','top10_pct']];
function ClvPanel({ series, stage }) {
  const [sim,setSim]=useState(null);
  const [win,setWin]=useState(''); const [t10,setT10]=useState(''); const [fd,setFd]=useState(''); const [hr,setHr]=useState('');
  const [rows,setRows]=useState(null); const [msg,setMsg]=useState(''); const [season,setSeason]=useState(null); const [hist,setHist]=useState([]);
  function loadSeason(){ supabase.from('clv_log').select('*').order('race_year',{ ascending:false }).order('race_number',{ ascending:false }).order('clv',{ ascending:false }).then(async ({ data:d })=>{ if(!d){ setSeason(null); setHist([]); return; }
    const __need={ win:1, t3:3, t5:5, t10:10 };
    try {
      const __yrs=[...new Set(d.map(x=>x.race_year).filter(Boolean))];
      // PAGINATED 2026-09-02. .limit(20000) never applied - the real cap is 5,000. __yrs comes
      // from the flagged bets on screen; those are all 2026 today (2,533 rows, safe), but
      // loop_data runs ~3,400 rows per season, so the FIRST bet graded across two seasons pushes
      // this over the cap and silently drops finishes - which show up as ungradeable bets, not
      // as an error.
      const { data:__ld } = await fetchAllRows(() => supabase.from('loop_data').select('series,year,race_number,driver_name,finish_position').in('year', __yrs.length?__yrs:[0]));
      const __f={}; (__ld||[]).forEach(r=>{ __f[r.series+'|'+r.year+'|'+r.race_number+'|'+r.driver_name]=r.finish_position });
      d.forEach(r=>{ const fp=__f[r.series+'|'+r.race_year+'|'+r.race_number+'|'+r.driver_name]; const nd=__need[r.market];
        r.__fin=(fp==null?null:fp);
        r.__hit=(fp!=null&&nd)?(fp<=nd):null;
        r.__pl=(r.__hit==null)?null:(r.__hit?(r.bet_odds>0?r.bet_odds/100:100/Math.abs(r.bet_odds)):-1);
      });
    } catch(e){}
    const n=d.length,pos=d.filter(x=>x.clv>0).length,avg=n?d.reduce((a,b)=>a+(+b.clv||0),0)/n:0;
    const gr=d.filter(x=>x.__hit!=null); const w=gr.filter(x=>x.__hit).length; const pl=gr.reduce((a,b)=>a+(b.__pl||0),0);
    setSeason({ n, pos, avg, graded:gr.length, w, l:gr.length-w, pl });
    setHist(d); }); }
  useEffect(()=>{ loadSeason() },[]);
  useEffect(()=>{ setSim(null); setRows(null); },[series,stage]);
  async function loadSim(){
    const { data } = await supabase.from('sim_results').select('*').eq('series',series).eq('stage',stage).order('published_at',{ ascending:false }).limit(1);
    const row=(data||[])[0];
    if(!row||!row.results){ setSim(null); setMsg('No published '+stage+' sim for '+series+'.'); return; }
    setSim(row); setRows(null); setMsg('Loaded '+row.track_name+' ('+stage+' sim, '+row.results.length+' drivers). Close from snapshots, or paste closing odds and compute.');
  }
  // CLOSE FROM SNAPSHOTS (2026-10-11): no paste needed. Each book's close = its own last odds_snapshots
  // row before the green (Kalshi ticks to green+15 on its own; DK/FD/HR = the last paste). The close used
  // per play is the BEST across books (the operator shops every bet); the same-book close is kept too.
  async function closeFromSnaps(){
    if(!sim){ setMsg('Load a sim first.'); return; }
    let q=supabase.from('odds_snapshots').select('driver_name, market, book, odds, captured_at').eq('series',sim.series).eq('track_name',sim.track_name).eq('race_year',sim.race_year);
    if(sim.race_number!=null) q=q.eq('race_number',sim.race_number);
    const { data:snaps }=await q.order('captured_at',{ ascending:false }).limit(5000);
    if(!snaps||!snaps.length){ setMsg('No odds snapshots for this race.'); return; }
    const green=sim.config&&sim.config.raceStartUtc?new Date(sim.config.raceStartUtc).getTime():null;
    const close={}, at={};
    snaps.forEach(s2=>{ if(green!=null&&new Date(s2.captured_at).getTime()>green+20*60*1000)return; const k=s2.driver_name.toLowerCase()+'|'+s2.market+'|'+s2.book; if(!(k in close)){ close[k]=s2.odds; at[k]=s2.captured_at; } });
    const dec=a=>a>0?a/100+1:100/Math.abs(a)+1;
    const out=[]; const ages=[];
    (sim.results||[]).forEach(d=>{
      const bet=d.mv||{};
      __CLV_MKTS.forEach(([mk,lbl,pf])=>{
        const b=bet[mk]; if(!b||b.best==null||b.ev==null||b.ev<=0)return;
        let best=null, bk=null, bat=null; ['dk','fd','hr','kalshi'].forEach(x=>{ const k=d.driver_name.toLowerCase()+'|'+mk+'|'+x; if(close[k]!=null&&(best==null||dec(close[k])>dec(best))){ best=close[k]; bk=x; bat=at[k]; } });
        const same=close[d.driver_name.toLowerCase()+'|'+mk+'|'+b.bb];
        const bi=__impl(b.best), ci=__impl(best);
        const clv=(bi!=null&&ci!=null)?(ci-bi)*100:null;
        if(green!=null&&bat) ages.push((green-new Date(bat).getTime())/60000);
        out.push({ driver:d.driver_name, market:lbl, mk, simProb:d[pf], betOdds:b.best, betBook:b.bb, closeOdds:best, closeBook:bk, closeSame:(same==null?null:same), clv, ev:b.ev });
      });
    });
    out.sort((a,b)=>((b.clv==null?-999:b.clv)-(a.clv==null?-999:a.clv)));
    setRows(out);
    const graded=out.filter(x=>x.clv!=null);
    const med=ages.length?ages.slice().sort((a,b)=>a-b)[Math.floor(ages.length/2)]:null;
    setMsg(graded.length?('Close from snapshots: '+graded.length+' bets, positive CLV '+graded.filter(x=>x.clv>0).length+'/'+graded.length+(med!=null?(' - median close '+Math.round(med)+' min before green'):' - no green time on this board')):'No closing snapshots matched the flagged +EV bets.');
  }
  function compute(){
    if(!sim){ setMsg('Load a sim first.'); return; }
    if(!(win||t10||fd||hr).trim()){ closeFromSnaps(); return; }
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
    // stage-scoped replace (2026-08-08): pre and post are SEPARATE bet sets - logging one
    // must never erase the other (operator caught pre rows vanishing after post log)
    const delQ = supabase.from('clv_log').delete().eq('series',sim.series).eq('race_year',sim.race_year).eq('race_number',sim.race_number)
    await (sim.stage ? delQ.eq('stage', sim.stage) : delQ.is('stage', null));
    const ins=graded.map(x=>({ series:sim.series, race_year:sim.race_year, race_number:sim.race_number, stage:sim.stage||null, track_name:sim.track_name, driver_name:x.driver, market:x.mk, sim_prob:x.simProb, bet_odds:x.betOdds, close_odds:x.closeOdds, bet_implied:__impl(x.betOdds), close_implied:__impl(x.closeOdds), clv:x.clv, edge_at_bet:x.ev }));
    const { error } = await supabase.from('clv_log').insert(ins);
    setMsg(error?('Log error: '+error.message):('Logged '+ins.length+' bets to season CLV.'));
    loadSeason();
  }
  const ta={ width:'100%', minHeight:50, fontSize:12, background:'var(--bg-surface)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:6, padding:6 };
  const th={ padding:'6px 10px', fontSize:'0.72rem', color:'var(--text-secondary)', textAlign:'right', borderBottom:'1px solid var(--border)' };
  const td={ padding:'6px 10px', fontSize:'0.85rem', textAlign:'right', borderBottom:'1px solid var(--border)' };
  const btn={ padding:'7px 14px', borderRadius:6, border:'none', background:'var(--accent)', color:'#fff', fontWeight:600, cursor:'pointer' };
  return (
    <div style={{ maxWidth:800 }}>
      <div style={{ fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:10 }}>Load the sim you bet off (uses the series + stage selected above), then paste the closing odds. CLV diffs them against the bet-time odds saved on that sim, for every +EV bet it flagged. No re-run needed.</div>
      {season ? <div style={{ fontSize:'0.8rem', marginBottom:12, color:'var(--text-secondary)' }}>Season CLV: <b>{season.n}</b> logged bets, <b style={{ color:(season.n && season.pos/season.n>=0.5)?'#22c55e':'var(--text)' }}>{season.n?Math.round(100*season.pos/season.n):0}%</b> positive, avg <b>{season.avg>=0?'+':''}{season.avg.toFixed(1)} pts</b>{season.graded ? (<span> &middot; <b>{season.w}-{season.l}</b>, <b style={{ color: season.pl >= 0 ? '#22c55e' : '#ef4444' }}>{(season.pl>=0?'+':'')+season.pl.toFixed(2)}u</b> ({((season.pl/season.graded)*100).toFixed(1)}% ROI)</span>) : null}</div> : null}
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
            <button onClick={closeFromSnaps} style={btn} title="Each book's last snapshot before the green; best close across books per play">Close from snapshots</button>
            <button onClick={compute} style={{ ...btn, background:'transparent', color:'var(--text)', border:'1px solid var(--border)' }}>Compute from paste</button>
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
                <td style={td}>{__amFmt(r.betOdds)}{r.betBook?<span style={{ fontSize:'0.68rem', color:'var(--text-muted)', marginLeft:4 }}>{String(r.betBook).toUpperCase()}</span>:null}</td>
                <td style={td} title={r.closeSame!=null&&r.closeBook!==r.betBook?('Same-book close '+__amFmt(r.closeSame)):''}>{__amFmt(r.closeOdds)}{r.closeBook?<span style={{ fontSize:'0.68rem', color:r.closeBook==='kalshi'?'#79c0ff':'var(--text-muted)', marginLeft:4 }}>{String(r.closeBook).toUpperCase()}</span>:null}</td>
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
              <thead><tr><th style={{ ...th, textAlign: 'left' }}>Race</th><th style={{ ...th, textAlign: 'left' }}>Driver</th><th style={{ ...th, textAlign: 'left', cursor: 'help' }} title="Market - Win / Top 3 / Top 5 / Top 10">Mkt</th><th style={th}>Sim %</th><th style={th}>Bet</th><th style={th}>Close</th><th style={{ ...th, cursor: 'help' }} title="Closing Line Value in points - how much the closing implied % beat your bet-time price. Positive = the line moved your way">CLV</th><th style={{ ...th, cursor: 'help' }} title="Actual finishing position. Blank until loop data for that race is loaded.">Fin</th><th style={{ ...th, cursor: 'help' }} title="Did the bet cash? Units won or lost at a 1 unit stake.">Result</th></tr></thead>
              <tbody>
                {hist.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...td, textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{'R' + r.race_number + ' ' + (r.track_name || '').replace(/ (Motor )?Speedway| International| Superspeedway| Raceway/, '') + " '" + String(r.race_year).slice(2) + ' ' + (r.series || '')}</td>
                    <td style={{ ...td, textAlign: 'left' }}>{r.driver_name}</td>
                    <td style={{ ...td, textAlign: 'left' }}>{({ win: 'Win', t3: 'Top 3', t5: 'Top 5', t10: 'Top 10' })[r.market] || r.market}</td>
                    <td style={td}>{r.sim_prob != null ? (+r.sim_prob).toFixed(1) + '%' : '-'}</td>
                    <td style={td}>{__amFmt(r.bet_odds)}</td>
                    <td style={td}>{__amFmt(r.close_odds)}</td>
                    <td style={{ ...td, fontWeight: 600, color: r.clv > 0 ? '#22c55e' : '#ef4444' }}>{(r.clv > 0 ? '+' : '') + (+r.clv).toFixed(1)}</td><td style={{ ...td, color: 'var(--text-muted)' }}>{r.__fin != null ? r.__fin : '-'}</td><td style={{ ...td, fontWeight: 600, color: r.__hit == null ? 'var(--text-muted)' : (r.__hit ? '#22c55e' : '#ef4444') }}>{r.__hit == null ? '-' : (r.__hit ? ('WIN +' + r.__pl.toFixed(2) + 'u') : '-1.00u')}</td>
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
    const { data: __tf } = await supabase.from('flagged_bets').select('driver_name,market,best_price,ev,mev,medge,sim_prob,book,group_drivers,created_at').eq('series', series).eq('race_year', row.race_year).eq('race_number', row.race_number).eq('stage', gradeStage).is('voided_at', null).order('created_at', { ascending: true })
    const g = __gradeRace(row.results, parsed.actualMap, __preOwned, undefined, __tf || [])
    setPrev({ metrics: g.metrics, evFlags: g.evFlags, roi: g.roi, detail: g.detail, parsed: parsed, simId: row.id, track: row.track_name, year: row.race_year, config: row.config })
    setMsg(parsed.matched.length + ' matched' + (parsed.unmatched.length ? ', ' + parsed.unmatched.length + ' skipped' : '') + '.')
  }
  const gradeFromDB = async () => {
    setMsg('Loading finish from loop data...')
    const { data } = await supabase.from('sim_results').select('*').eq('series', series).eq('stage', gradeStage).order('published_at', { ascending: false }).limit(1)
    const row = (data || [])[0]
    if (!row || !row.results) { setPrev(null); setMsg('No published sim found for ' + series + '.'); return }
    // Grading core moved to src/lib/gradeRace.js (2026-10-11) so Load Race can grade in the same click.
    let g, actualMap
    try { const target = await resolveRaceRow(series, row); ({ g, actualMap } = await gradeBoardFromLoopData(series, gradeStage, row, target)) } catch (e) { setPrev(null); setMsg(e.message); return }
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
  const cfgSummary = c => { if (!c) return '-'; const w = c.weights || {}; const prac = (w.longRunPace || 0) + (w.shortRunPace || 0); return 'corr ' + (w.corrHistory != null ? w.corrHistory : '?') + ' / start ' + (w.startPos != null ? w.startPos : '?') + ' / track ' + (w.trackHistory != null ? w.trackHistory : '?') + ' / prac ' + prac + '  |  DNF ' + ((c.dnf && c.dnf.label) || '?') + ' / Caution ' + ((c.caution && c.caution.label) || '?') + (c.rainOut ? '  |  Rain-out grid' : '') + (c.lineup ? '  |  lineup: ' + c.lineup : '') + (c.runNote ? '  |  note: ' + c.runNote : ''); }
  const cfgShort = c => { if (!c) return '-'; const w = c.weights || {}; const prac = (w.longRunPace || 0) + (w.shortRunPace || 0); let reg = 'Oval'; if ((w.trackHistory || 0) >= 0.25 && prac === 0) reg = 'SuperS'; else if ((w.trackHistory || 0) === 0 && (w.corrHistory || 0) >= 0.5) reg = 'Road'; return reg + ' / ' + ((c.dnf && c.dnf.label) || '?') + (c.rainOut ? ' / RO' : '') + (c.lineup && c.lineup !== 'qualifying' ? ' / ' + c.lineup : '') + (c.runNote ? ' / "' + (c.runNote.length > 40 ? c.runNote.slice(0, 40) + '…' : c.runNote) + '"' : ''); }
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
            {prev.roi.medge5 ? <span>medge5+ ({prev.roi.medge5.bets}) <b style={pill(prev.roi.medge5.roi)}>{prev.roi.medge5.roi}%</b></span> : null}
            {prev.roi.medge10 ? <span>medge10+ ({prev.roi.medge10.bets}) <b style={pill(prev.roi.medge10.roi)}>{prev.roi.medge10.roi}%</b></span> : null}
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 380px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 6 }}>Full field (proj vs actual)</div>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}><th style={{ padding: '3px 6px' }}>Fin</th><th>Driver</th><th>Proj</th><th>Mdl Rk</th><th>Rk Δ</th><th>Delta</th><th>Win%</th></tr></thead>
                <tbody>
                  {(() => { const __rk = new Map([...prev.detail].sort((a, b) => a.pf - b.pf).map((x, i) => [x.car, i + 1])); return prev.detail.map(d => (
                    <tr key={d.car} style={{ borderTop: '1px solid rgba(128,128,128,0.18)' }}>
                      <td style={{ padding: '3px 6px' }}>{d.act}</td>
                      <td>{d.name}{d.flags.length ? ' *' : ''}</td>
                      <td>{d.pf}</td>
                      <td>{__rk.get(d.car)}</td>
                      <td style={{ color: (__rk.get(d.car) - d.act) >= 0 ? '#2e9e52' : '#dd3355' }}>{(__rk.get(d.car) - d.act) > 0 ? '+' : ''}{__rk.get(d.car) - d.act}</td>
                      <td style={{ color: (d.pf - d.act) >= 0 ? '#2e9e52' : '#dd3355' }}>{(d.pf - d.act) > 0 ? '+' : ''}{(d.pf - d.act).toFixed(1)}</td>
                      <td>{d.win}%</td>
                    </tr>
                  )) })()}
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
                      <td>+{f.ev}{f.mev > 0 ? ' c+' + f.mev : ''}{f.medge != null ? ' m' + (f.medge > 0 ? '+' : '') + f.medge : ''}</td>
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
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 1120, fontSize: '0.83rem', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}><th style={{ padding: '4px 8px' }}>R#</th><th title="Sim stage - pre = before practice/qualifying, post = after" style={{ cursor: 'help' }}>Stage</th><th title="Weight config used for this sim" style={{ cursor: 'help' }}>Config</th><th>Race</th><th title="Mean Absolute Error - average positions off between projected and actual finish (lower is better)" style={{ cursor: 'help' }}>MAE</th><th title="MAE against the median projection (finish_p50) instead of the mean. MAE is mathematically minimised by the median, so this is the matched estimator." style={{ cursor: 'help' }}>MAE-Md</th><th title="MAE after converting projections to a 1..N running order. Removes the compression penalty on expected values - pure ordering skill." style={{ cursor: 'help' }}>MAE-Rk</th><th title="Spearman rank correlation of projected vs actual finish, -1 to 1 (higher = closer order)" style={{ cursor: 'help' }}>Spear</th><th title="Win Brier score - calibration of the win probabilities vs the actual result (lower is better)" style={{ cursor: 'help' }}>WinBr</th><th title="Flat-bet ROI% on every bet the sim flagged +EV that race (1 unit each, at the best book price)" style={{ cursor: 'help' }}>+EV</th><th title="ROI% excluding the win market (Top 3/5/10 bets only) - a cleaner read on edge, since the win market overshoots" style={{ cursor: 'help' }}>ex-win</th><th title="ROI% on win-market +EV bets only - the overshoot-prone bucket" style={{ cursor: 'help' }}>win</th><th title="Consensus ROI% - only bets that were +EV against the de-vigged market price (higher conviction)" style={{ cursor: 'help' }}>cons</th></tr></thead>
            <tbody>
              {log.map(g => (
                <tr key={g.id} style={{ borderTop: '1px solid rgba(128,128,128,0.2)' }}>
                  <td style={{ padding: '4px 8px', fontWeight: 600 }}>{g.race_number != null ? 'R' + g.race_number : '-'}</td><td style={{ textTransform: 'uppercase', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{g.stage || 'post'}</td><td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{cfgShort(g.config)}</td>
                  <td>{(g.track_name || '').replace(' Speedway', '')} {g.race_year} <span style={{ textTransform: 'uppercase', color: 'var(--text-muted)', fontSize: '0.7rem' }}>{g.series}</span></td>
                  <td>{g.metrics && g.metrics.mae}</td><td style={{ color: 'var(--text-muted)' }}>{g.metrics && g.metrics.mae_median != null ? g.metrics.mae_median : '-'}</td><td style={{ color: 'var(--text-muted)' }}>{g.metrics && g.metrics.mae_rank != null ? g.metrics.mae_rank : '-'}</td>
                  <td>{g.metrics && g.metrics.spearman_pf}</td>
                  <td>{g.metrics && g.metrics.win_brier}</td>
                  <td style={pill(g.roi && g.roi.all ? g.roi.all.roi : 0)}>{g.roi && g.roi.all && g.roi.all.roi}%</td>
                  <td style={pill(g.roi && g.roi.exwin ? g.roi.exwin.roi : 0)}>{g.roi && g.roi.exwin && g.roi.exwin.roi}%</td>
                  <td style={pill(g.roi && g.roi.win ? g.roi.win.roi : 0)}>{g.roi && g.roi.win && g.roi.win.roi}%</td>
                  <td style={pill(g.roi && g.roi.consensus ? g.roi.consensus.roi : 0)}>{g.roi && g.roi.consensus && g.roi.consensus.roi}%</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 10 }}>Closing Line Value (CLV)</h2>
          <ClvPanel series={series} stage={gradeStage} />
        </div>
      </div>
    </div>
  )
}

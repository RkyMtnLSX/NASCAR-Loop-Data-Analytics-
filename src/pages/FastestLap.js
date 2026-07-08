import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const YEARS = ['2022', '2023', '2024', '2025', '2026']
const TRACK_TYPES = ['All', 'Short Track', 'Superspeedway', 'Intermediate', 'Road Course', 'Other']
const MEDAL = { 1: '\uD83E\uDD47', 2: '\uD83E\uDD48', 3: '\uD83E\uDD49' }
const MEDAL_BG = { 1: 'rgba(255,215,0,0.15)', 2: 'rgba(192,192,192,0.15)', 3: 'rgba(205,127,50,0.15)' }
const TRACK_TYPE_COLORS = { 'Short Track': '#2D6A4F', 'Superspeedway': '#6A0572', 'Intermediate': '#1B4F72', 'Road Course': '#7B3F00', 'Other': '#555' }
const sectionHead = { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }
const stickyHead = { position: 'sticky', left: 0, zIndex: 3, background: 'var(--bg-elevated)', textAlign: 'left', padding: '10px 16px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', minWidth: 180 }
const numHead = { padding: '10px 12px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }
const stickyCell = (bg) => ({ position: 'sticky', left: 0, zIndex: 1, background: bg, padding: '8px 16px', fontSize: '0.8125rem', whiteSpace: 'nowrap', borderRight: '1px solid var(--border)', minWidth: 180 })
const numCell = { padding: '8px 12px', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }
const pillStyle = (active) => ({ padding: '5px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: active ? 600 : 400, border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'), background: active ? 'var(--accent)' : 'transparent', color: active ? '#000' : 'var(--text-secondary)', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' })

function shortTrackName(track) {
  return (track || '').split('(')[0].replace(/\bInternational\b/g,'').replace(/\bMotor\b/g,'').replace(/\bSuperspeedway\b/g,'').replace(/\bSpeedway\b/g,'').replace(/\bRaceway\b/g,'').replace(/\bMemorial\b/g,'').replace(/\bCircuit\b/g,'').replace(/\s+/g,' ').trim().split(' ').slice(0,2).join(' ').trim()
}

function rankColor(rank) {
  if (!rank || isNaN(rank)) return null
  const r = parseInt(rank)
  if (r === 1) return 'rgba(255,215,0,0.55)'
  if (r === 2) return 'rgba(192,192,192,0.5)'
  if (r === 3) return 'rgba(205,127,50,0.5)'
  if (r <= 6) return `rgba(46,204,113,${0.55-(r-4)*0.05})`
  if (r <= 12) return `rgba(46,204,113,${0.35-(r-7)*0.03})`
  if (r <= 20) return `rgba(241,196,15,${0.45-(r-13)*0.03})`
  if (r <= 28) return `rgba(230,126,34,${0.45-(r-21)*0.025})`
  return 'rgba(231,76,60,0.42)'
}

function RaceTable({ rows, raceName, track }) {
  if (!rows.length) return <div style={{color:'var(--text-muted)',fontSize:'0.875rem',padding:'24px 0'}}>No data for this race.</div>
  return (
    <div>
      <div style={{marginBottom:10}}>
        <h3 style={sectionHead}>{raceName}</h3>
        {track && <div style={{fontSize:'0.75rem',color:'var(--text-muted)',marginBottom:10}}>{track}</div>}
      </div>
      <div style={{overflowX:'auto',borderRadius:'var(--radius-md)',border:'1px solid var(--border)'}}>
        <table style={{borderCollapse:'collapse',minWidth:760,width:'100%'}}>
          <thead><tr>
            <th style={stickyHead}>Driver</th>
            <th style={numHead}>Car #</th>
            <th style={{...numHead,color:'var(--accent)',fontWeight:700}}>Lap Time</th>
            <th style={numHead}>Speed (mph)</th>
            <th style={numHead}>Lap #</th>
            <th style={numHead}>Start</th>
            <th style={numHead}>Finish</th>
            <th style={numHead}>Status</th>
          </tr></thead>
          <tbody>
            {rows.map((r,i) => {
              const rank = parseInt(r.rank)||i+1
              const rowBg = MEDAL_BG[rank]||(i%2===0?'rgb(10,10,15)':'#1a1a24')
              return (
                <tr key={i} style={{background:rowBg}}>
                  <td style={stickyCell(rowBg)}>
                    <span style={{marginRight:6,fontSize:'0.75rem',fontFamily:'var(--font-mono)',color:rank<=3?'var(--accent)':'var(--text-muted)',minWidth:22,display:'inline-block'}}>{MEDAL[rank]||rank}</span>
                    <span style={{fontWeight:rank<=3?700:400}}>{r.driver}</span>
                  </td>
                  <td style={numCell}>{r.car}</td>
                  <td style={{...numCell,color:'var(--accent)',fontWeight:rank===1?700:400}}>{r.fastest_time}</td>
                  <td style={numCell}>{r.fastest_speed?parseFloat(r.fastest_speed).toFixed(2):'\u2014'}</td>
                  <td style={numCell}>{r.fastest_lap_num}</td>
                  <td style={numCell}>{r.start_pos}</td>
                  <td style={numCell}>{r.finish_pos}</td>
                  <td style={{...numCell,textAlign:'left',fontSize:'0.75rem',color:r.status==='Running'?'var(--text-secondary)':'#e74c3c'}}>{r.status}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SeasonSummaryTable({ rows }) {
  const raceMap = {}
  rows.forEach(r => { const key=r.race_name+'|'+r.race_date; if(!raceMap[key]||parseInt(r.rank)<parseInt(raceMap[key].rank)) raceMap[key]=r })
  const raceRows = Object.values(raceMap).sort((a,b)=>(a.race_date||'')<(b.race_date||'')?-1:1)
  if (!raceRows.length) return <div style={{color:'var(--text-muted)',fontSize:'0.875rem',padding:'24px 0'}}>No data available.</div>
  return (
    <div style={{overflowX:'auto',borderRadius:'var(--radius-md)',border:'1px solid var(--border)'}}>
      <table style={{borderCollapse:'collapse',minWidth:800,width:'100%'}}>
        <thead><tr>
          <th style={stickyHead}>Race</th>
          <th style={numHead}>Date</th>
          <th style={numHead}>Track Type</th>
          <th style={numHead}>Driver</th>
          <th style={numHead}>Car #</th>
          <th style={{...numHead,color:'var(--accent)',fontWeight:700}}>Fastest Time</th>
          <th style={numHead}>Speed (mph)</th>
        </tr></thead>
        <tbody>
          {raceRows.map((r,i) => {
            const bg=i%2===0?'rgb(10,10,15)':'#1a1a24'
            return (
              <tr key={i} style={{background:bg}}>
                <td style={{...stickyCell(bg),maxWidth:280,overflow:'hidden',textOverflow:'ellipsis'}}>{r.race_name}</td>
                <td style={numCell}>{r.race_date}</td>
                <td style={{...numCell,textAlign:'left',fontSize:'0.75rem'}}>
                  <span style={{padding:'2px 8px',borderRadius:4,fontSize:'0.7rem',fontFamily:'var(--font-sans)',background:TRACK_TYPE_COLORS[r.track_type]||'#444',color:'#fff',whiteSpace:'nowrap'}}>{r.track_type}</span>
                </td>
                <td style={{...numCell,textAlign:'left',fontWeight:600}}>{r.driver}</td>
                <td style={numCell}>{r.car}</td>
                <td style={{...numCell,color:'var(--accent)',fontWeight:600}}>{r.fastest_time}</td>
                <td style={numCell}>{r.fastest_speed?parseFloat(r.fastest_speed).toFixed(2):'\u2014'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function HeatMapView({ rows, year, trackType }) {
  if (!rows.length) return <div style={{color:'var(--text-muted)',fontSize:'0.875rem',padding:'24px 0'}}>No data available.</div>
  const raceSeen = new Set()
  const races = []
  rows.forEach(r => { const key=r.race_name+'|'+r.race_date; if(!raceSeen.has(key)){raceSeen.add(key);races.push({name:r.race_name,date:r.race_date,track:r.track,key})} })
  races.sort((a,b)=>a.date<b.date?-1:1)
  const trackTotal={}
  races.forEach(r=>{const s=shortTrackName(r.track);trackTotal[s]=(trackTotal[s]||0)+1})
  const trackIdx={}
  const finalLabels=races.map(r=>{const s=shortTrackName(r.track);trackIdx[s]=(trackIdx[s]||0)+1;return{...r,label:trackTotal[s]>1?s+' '+trackIdx[s]:s}})
  const driverMap=new Map()
  rows.forEach(r=>{const key=r.race_name+'|'+r.race_date;if(!driverMap.has(r.driver))driverMap.set(r.driver,{});const existing=driverMap.get(r.driver)[key];const rank=parseInt(r.rank);if(!existing||rank<existing)driverMap.get(r.driver)[key]=rank})
  const drivers=[...driverMap.entries()].map(([driver,rankMap])=>{const ranks=Object.values(rankMap).filter(v=>!isNaN(v)&&v>0);const avg=ranks.length?ranks.reduce((a,b)=>a+b,0)/ranks.length:Infinity;return{driver,rankMap,avg,count:ranks.length}}).sort((a,b)=>{if(a.avg===Infinity&&b.avg===Infinity)return a.driver.localeCompare(b.driver);return a.avg-b.avg})
  const hasMulti=finalLabels.length>1
  const LEGEND=[{label:'1st',color:'rgba(255,215,0,0.55)'},{label:'2nd',color:'rgba(192,192,192,0.5)'},{label:'3rd',color:'rgba(205,127,50,0.5)'},{label:'4\u201312',color:'rgba(46,204,113,0.4)'},{label:'13\u201320',color:'rgba(241,196,15,0.4)'},{label:'21\u201328',color:'rgba(230,126,34,0.4)'},{label:'29+',color:'rgba(231,76,60,0.42)'}]
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        <span style={{fontSize:'0.7rem',color:'var(--text-muted)',marginRight:4}}>Rank:</span>
        {LEGEND.map(({label,color})=>(
          <span key={label} style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{width:14,height:14,background:color,border:'1px solid var(--border)',borderRadius:2,display:'inline-block'}}/>
            <span style={{fontSize:'0.7rem',color:'var(--text-secondary)'}}>{label}</span>
          </span>
        ))}
        <span style={{fontSize:'0.7rem',color:'var(--text-muted)',marginLeft:8}}>{'\u2014'} = did not participate</span>
      </div>
      <div style={{overflowX:'auto',borderRadius:'var(--radius-md)',border:'1px solid var(--border)'}}>
        <table style={{borderCollapse:'collapse',width:'100%'}}>
          <thead>
            <tr>
              <th style={{...stickyHead,minWidth:180,zIndex:4}}>Driver</th>
              {hasMulti&&<th style={{...numHead,minWidth:52,fontWeight:700,color:'var(--accent)',textAlign:'center'}}>Avg</th>}
              {finalLabels.map(r=>(
                <th key={r.key} style={{...numHead,minWidth:80,fontSize:'0.65rem',fontWeight:600,padding:'8px 6px',whiteSpace:'nowrap',cursor:'default',textAlign:'center'}} title={r.name+' \u00B7 '+r.date}>{r.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.map((d,i)=>{
              const rowBg=i%2===0?'rgb(10,10,15)':'#1a1a24'
              const isTop=d.avg<=5&&d.count>=2
              return (
                <tr key={d.driver}>
                  <td style={{...stickyCell(rowBg),fontWeight:isTop?700:400}}>
                    {isTop&&<span style={{marginRight:6,fontSize:'0.7rem'}}>{'\u26A1'}</span>}
                    {d.driver}
                  </td>
                  {hasMulti&&<td style={{...numCell,fontWeight:700,background:rowBg,color:isTop?'var(--accent)':d.avg<=15?'var(--text-primary)':'var(--text-muted)'}}>{isFinite(d.avg)?d.avg.toFixed(1):'\u2014'}</td>}
                  {finalLabels.map(r=>{
                    const rank=d.rankMap[r.key]
                    const bg=rank?rankColor(rank):null
                    return <td key={r.key} style={{padding:'7px 8px',fontSize:'0.78rem',fontFamily:'var(--font-mono)',textAlign:'center',background:bg||rowBg,color:rank<=3?'#000':'var(--text-primary)',fontWeight:rank<=3?700:400,minWidth:44,borderLeft:'1px solid var(--border)'}}>{rank||<span style={{color:'var(--text-muted)',fontSize:'0.7rem'}}>{'\u2014'}</span>}</td>
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{marginTop:10,fontSize:'0.7rem',color:'var(--text-muted)'}}>{drivers.length} drivers \u00B7 {finalLabels.length} {finalLabels.length===1?'race':'races'}{trackType!=='All'&&` \u00B7 ${trackType} only`}</div>
    </div>
  )
}

export default function FastestLap({ isSubscriber }) {
  const [year, setYear] = useState('2026')
  const [trackType, setTrackType] = useState('All')
  const [races, setRaces] = useState([])
  const [selectedRace, setSelectedRace] = useState('')
  const [raceRows, setRaceRows] = useState([])
  const [allRows, setAllRows] = useState([])
  const [view, setView] = useState('heat')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { loadYear(year, trackType) }, [year, trackType]) // eslint-disable-line

  async function loadYear(yr, tt) {
    setLoading(true); setError(null); setRaceRows([]); setSelectedRace('')
    try {
      let q = supabase.from('fastest_laps').select('*').eq('year', yr).order('race_date').order('rank')
      if (tt !== 'All') q = q.eq('track_type', tt)
      const { data, error: err } = await q
      if (err) throw err
      setAllRows(data || [])
      const seen = new Set(); const raceList = []
      ;(data || []).forEach(r => { const key=r.race_name+'|'+r.race_date; if(!seen.has(key)){seen.add(key);raceList.push({name:r.race_name,date:r.race_date})} })
      setRaces(raceList)
      if (raceList.length) setSelectedRace(raceList[raceList.length-1].name)
    } catch(e) { setError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => {
    if (!selectedRace||!allRows.length){setRaceRows([]);return}
    setRaceRows(allRows.filter(r=>r.race_name===selectedRace).sort((a,b)=>parseInt(a.rank)-parseInt(b.rank)))
  }, [selectedRace, allRows])

  const selectedRaceTrack = raceRows[0]?.track || ''

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Fastest Laps</h1>
        <p className="page-subtitle">Lap Raptor fastest lap data \u2014 NextGen era (2022\u20132026)</p>
      </div>
      <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
        {YEARS.map(y=><button key={y} onClick={()=>setYear(y)} style={pillStyle(year===y)}>{y}</button>)}
      </div>
      <div style={{display:'flex',gap:6,marginBottom:24,flexWrap:'wrap'}}>
        {TRACK_TYPES.map(tt=><button key={tt} onClick={()=>setTrackType(tt)} style={pillStyle(trackType===tt)}>{tt}</button>)}
      </div>
      <div style={{display:'flex',gap:6,marginBottom:24}}>
        {[['heat','\uD83D\uDD25 Heat Map'],['race','Race View'],['season','Season Summary']].map(([v,label])=>(
          <button key={v} onClick={()=>setView(v)} style={{...pillStyle(view===v),padding:'6px 16px'}}>{label}</button>
        ))}
      </div>
      {error&&<div style={{padding:'12px 16px',background:'#922B2120',border:'1px solid #922B2140',borderRadius:'var(--radius-md)',color:'#E74C3C',fontSize:'0.8125rem',marginBottom:24}}>{error}</div>}
      {loading&&<div style={{color:'var(--text-muted)',fontSize:'0.875rem',padding:'32px 0'}}>Loading...</div>}
      {!loading&&!error&&view==='heat'&&<HeatMapView rows={allRows} year={year} trackType={trackType}/>}
      {!loading&&!error&&view==='race'&&(
        <>
          <div style={{marginBottom:24}}>
            <label style={{...sectionHead,display:'block',marginBottom:8}}>Select Race</label>
            <select value={selectedRace} onChange={e=>setSelectedRace(e.target.value)} style={{padding:'8px 12px',borderRadius:'var(--radius-md)',border:'1px solid var(--border)',background:'var(--bg-elevated)',color:'var(--text-primary)',fontSize:'0.8125rem',fontFamily:'var(--font-sans)',minWidth:360,cursor:'pointer'}}>
              {races.map(r=><option key={r.name+r.date} value={r.name}>{r.date} \u2014 {r.name}</option>)}
            </select>
            <span style={{marginLeft:12,fontSize:'0.75rem',color:'var(--text-muted)'}}>{raceRows.length} drivers</span>
          </div>
          <RaceTable rows={raceRows} raceName={selectedRace} track={selectedRaceTrack}/>
        </>
      )}
      {!loading&&!error&&view==='season'&&(
        <>
          <h3 style={{...sectionHead,marginBottom:16}}>Fastest Lap per Race \u2014 {year}</h3>
          <SeasonSummaryTable rows={allRows}/>
        </>
      )}
    </div>
  )
}

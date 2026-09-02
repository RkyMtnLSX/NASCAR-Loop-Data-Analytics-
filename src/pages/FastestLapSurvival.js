import XScroll from '../components/XScroll'
import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Fastest Lap Survival (2026-09-02). Reads the fastest_lap_holder_checkpoints view: for every
// race, who held the race-fastest lap at 2 / 5 / 10 / 25 / 50 / 75 / 90 % distance and whether that
// driver still held it at the checkered. Answers: "a lap was just set at X% of the race at this
// track - how often does the holder at that point keep it?"
//
// Limitation (by construction of fastest_laps): we only know each driver's single best lap and the
// lap it came on. A driver who led early and later beat his own time is only seen at his later
// lap, so an early checkpoint can be missing a holder (race is dropped from that checkpoint) and
// early survival rates run a little HIGH. Read them as an upper bound.

const SERIES_OPTS = [['cup', 'Cup'], ['oreilly', "O'Reilly"], ['trucks', 'Trucks']]
const SERIES_COLOR = { cup: 'var(--series-cup)', oreilly: 'var(--series-oreilly)', trucks: 'var(--series-trucks)' }
const CHECKPOINTS = [2, 5, 10, 25, 50, 75, 90]

const sectionHead = { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }
const stickyHead = { position: 'sticky', left: 0, zIndex: 3, background: 'var(--bg-elevated)', textAlign: 'left', padding: '10px 16px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', minWidth: 180 }
const numHead = { padding: '10px 12px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }
const stickyCell = (bg) => ({ position: 'sticky', left: 0, zIndex: 1, background: bg, padding: '8px 16px', fontSize: '0.8125rem', whiteSpace: 'nowrap', borderRight: '1px solid var(--border)', minWidth: 180 })
const numCell = { padding: '8px 12px', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }
const pillStyle = (active) => ({ padding: '5px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: active ? 600 : 400, border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'), background: active ? 'var(--accent)' : 'transparent', color: active ? '#fff' : 'var(--text-secondary)', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' })

function shortTrackName(track) {
  return (track || '').split('(')[0].replace(/\bInternational\b/g, '').replace(/\bMotor\b/g, '').replace(/\bSuperspeedway\b/g, '').replace(/\bSpeedway\b/g, '').replace(/\bRaceway\b/g, '').replace(/\bMemorial\b/g, '').replace(/\bCircuit\b/g, '').replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' ').trim()
}
function isoDate(d) { return String(d || '').replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$1-$2') }

// survival % -> cell colour. Green = the lap usually holds from here; red = it usually gets beaten.
function survColor(p) {
  if (p == null) return null
  if (p >= 75) return 'rgba(46,204,113,0.5)'
  if (p >= 55) return 'rgba(46,204,113,0.28)'
  if (p >= 40) return 'rgba(241,196,15,0.35)'
  if (p >= 25) return 'rgba(230,126,34,0.35)'
  return 'rgba(231,76,60,0.42)'
}

function pct(held, n) { return n ? Math.round(100 * held / n) : null }

// rows -> { track: { n: races, cp: { 2: {n, held}, ... } } }
function summarise(rows) {
  const out = {}
  rows.forEach(r => {
    const t = out[r.track] || (out[r.track] = { races: new Set(), cp: {} })
    t.races.add(r.race_date)
    const c = t.cp[r.pct] || (t.cp[r.pct] = { n: 0, held: 0 })
    c.n += 1; if (r.survived) c.held += 1
  })
  return out
}

function SurvivalCell({ n, held }) {
  const p = pct(held, n)
  if (p == null) return <td style={{ ...numCell, color: 'var(--text-muted)' }}>{'—'}</td>
  return (
    <td title={`${held} of ${n} races`} style={{ ...numCell, background: survColor(p), color: p >= 55 ? '#000' : 'var(--text-primary)', fontWeight: p >= 75 ? 700 : 400, textAlign: 'center' }}>
      {p}%<span style={{ fontSize: '0.65rem', color: p >= 55 ? '#222' : 'var(--text-muted)', marginLeft: 4 }}>{n}</span>
    </td>
  )
}

function AllTracksTable({ summary, onPick }) {
  const tracks = Object.keys(summary).sort((a, b) => (pct(summary[b].cp[2]?.held, summary[b].cp[2]?.n) ?? -1) - (pct(summary[a].cp[2]?.held, summary[a].cp[2]?.n) ?? -1))
  return (
    <XScroll style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: 760, width: '100%' }}>
        <thead><tr>
          <th style={stickyHead}>Track</th>
          <th style={numHead}>Races</th>
          {CHECKPOINTS.map(c => <th key={c} style={{ ...numHead, textAlign: 'center' }} title={`Holder at ${c}% of race distance - how often that driver still had the fastest lap at the finish`}>@{c}%</th>)}
        </tr></thead>
        <tbody>
          {tracks.map((t, i) => {
            const bg = i % 2 === 0 ? 'rgb(10,10,15)' : '#1a1a24'
            const s = summary[t]
            return (
              <tr key={t} style={{ background: bg }}>
                <td style={{ ...stickyCell(bg), cursor: 'pointer', color: 'var(--accent-text)' }} onClick={() => onPick(t)} title={t}>{shortTrackName(t) || t}</td>
                <td style={numCell}>{s.races.size}</td>
                {CHECKPOINTS.map(c => <SurvivalCell key={c} n={s.cp[c]?.n || 0} held={s.cp[c]?.held || 0} />)}
              </tr>
            )
          })}
        </tbody>
      </table>
    </XScroll>
  )
}

function TrackDetail({ track, rows }) {
  // one row per race, columns = holder at each checkpoint
  const byRace = {}
  rows.filter(r => r.track === track).forEach(r => {
    const k = r.race_date
    const o = byRace[k] || (byRace[k] = { race_date: r.race_date, race_name: r.race_name, total_laps: r.total_laps, cp: {} })
    o.cp[r.pct] = r
  })
  const races = Object.values(byRace).sort((a, b) => isoDate(b.race_date).localeCompare(isoDate(a.race_date)))
  if (!races.length) return <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '24px 0' }}>No data for this track.</div>
  const summary = summarise(rows.filter(r => r.track === track))[track]
  return (
    <div>
      <h3 style={sectionHead}>{track} {'—'} holder of the fastest lap at each checkpoint</h3>
      <XScroll style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 900, width: '100%' }}>
          <thead><tr>
            <th style={stickyHead}>Race</th>
            <th style={numHead}>Laps</th>
            {CHECKPOINTS.map(c => <th key={c} style={{ ...numHead, textAlign: 'left' }}>@{c}%</th>)}
            <th style={{ ...numHead, textAlign: 'left' }}>Final (lap)</th>
          </tr></thead>
          <tbody>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              <td style={{ ...stickyCell('var(--bg-elevated)'), fontWeight: 700 }}>Holder survives</td>
              <td style={numCell}>{summary.races.size}</td>
              {CHECKPOINTS.map(c => <SurvivalCell key={c} n={summary.cp[c]?.n || 0} held={summary.cp[c]?.held || 0} />)}
              <td />
            </tr>
            {races.map((r, i) => {
              const bg = i % 2 === 0 ? 'rgb(10,10,15)' : '#1a1a24'
              const fin = r.cp[90] && r.cp[90].survived ? r.cp[90] : Object.values(r.cp).find(x => x.survived)
              return (
                <tr key={r.race_date} style={{ background: bg }}>
                  <td style={stickyCell(bg)} title={r.race_name}><span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginRight: 8 }}>{r.race_date}</span>{r.race_name}</td>
                  <td style={numCell}>{r.total_laps}</td>
                  {CHECKPOINTS.map(c => {
                    const h = r.cp[c]
                    if (!h) return <td key={c} style={{ ...numCell, color: 'var(--text-muted)', textAlign: 'left' }}>{'—'}</td>
                    return (
                      <td key={c} title={`${h.holder_time}s on lap ${h.holder_lap}`} style={{ ...numCell, textAlign: 'left', fontFamily: 'var(--font-sans)', background: h.survived ? 'rgba(46,204,113,0.18)' : 'rgba(231,76,60,0.14)', color: h.survived ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {h.holder}<span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>L{h.holder_lap}</span>
                      </td>
                    )
                  })}
                  <td style={{ ...numCell, textAlign: 'left', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>{fin ? <>{fin.holder}<span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 6 }}>L{fin.holder_lap}</span></> : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </XScroll>
      <div style={{ marginTop: 10, fontSize: '0.7rem', color: 'var(--text-muted)' }}>Green = that driver still held the fastest lap at the finish. Red = it got beaten later. Only each driver's own best lap is known, so early checkpoints can miss a holder who later improved on himself - early survival reads slightly high.</div>
    </div>
  )
}

export default function FastestLapSurvival() {
  const [series, setSeries] = useState('cup')
  const [track, setTrack] = useState('All')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null)
      try {
        const data = []
        for (let pg = 0; pg < 10; pg++) {
          const res = await supabase.from('fastest_lap_holder_checkpoints').select('*').eq('series', series).order('race_date').range(pg * 1000, pg * 1000 + 999)
          if (res.error) throw res.error
          data.push(...(res.data || []))
          if (!res.data || res.data.length < 1000) break
        }
        setRows(data.filter(r => !/duel|clash|all.?star/i.test(r.race_name || '')))
      } catch (e) { setError(e.message) } finally { setLoading(false) }
    })()
  }, [series])

  const summary = summarise(rows)
  const trackOptions = ['All', ...Object.keys(summary).sort()]
  if (track !== 'All' && !summary[track] && !loading) { /* series changed; track absent */ }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Fastest Lap Survival</h1>
        <p className="page-subtitle">If a driver holds the race's fastest lap at X% distance, how often does it hold to the finish? (2022{'–'}2026)</p>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {SERIES_OPTS.map(([v, label]) => <button key={v} onClick={() => setSeries(v)} style={{ ...pillStyle(series === v), ...(series === v ? { background: SERIES_COLOR[v], borderColor: SERIES_COLOR[v], color: v === 'trucks' ? '#111' : '#fff' } : {}) }}>{label}</button>)}
        <select value={track} onChange={e => setTrack(e.target.value)} style={{ marginLeft: 8, padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 999, color: track === 'All' ? 'var(--text-secondary)' : 'var(--accent)', fontSize: '0.85rem', cursor: 'pointer' }}>
          {trackOptions.map(t => <option key={t} value={t}>{t === 'All' ? 'All tracks' : t}</option>)}
        </select>
      </div>
      {error && <div style={{ padding: '12px 16px', background: '#922B2120', border: '1px solid #922B2140', borderRadius: 'var(--radius-md)', color: '#E74C3C', fontSize: '0.8125rem', marginBottom: 24 }}>{error}</div>}
      {loading && <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '32px 0' }}>Loading...</div>}
      {!loading && !error && track === 'All' && (
        <>
          <h3 style={sectionHead}>Holder survival by track {'—'} click a track for race-by-race</h3>
          <AllTracksTable summary={summary} onPick={setTrack} />
          <div style={{ marginTop: 10, fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cell = % of races where the driver holding the fastest lap at that point still had it at the finish; small number = races in the sample. Sorted by the @2% column: green at the top means "buy the lap-2 leader", red means wait.</div>
        </>
      )}
      {!loading && !error && track !== 'All' && <TrackDetail track={track} rows={rows} />}
    </div>
  )
}

// src/components/WeekendSchedule.js - "This weekend" on the home page (2026-10-09).
//
// Operator: "on the home page put all three series logos and list the schedule for all track
// activities this weekend ... and it'll just refresh every week automatically". Reads
// /api/nascar-feed?type=weekend (NASCAR's schedule feed, cached an hour at the edge): the next race per
// series with its practice / qualifying / race times, venue, TV and radio. Times are shown in the
// viewer's own time zone (the feed's start_time_utc is real UTC). Nothing to configure week to week.
//
// LOGOS: NASCAR's series marks are NASCAR's trademarks. This renders /series-logos/{series}.png when
// such a file exists in public/ (the operator decides what he has rights to use) and falls back to a
// PitBoard-styled wordmark in the series colour otherwise.
import React, { useEffect, useState } from 'react'

const SERIES = [
  { key: 'cup', label: 'Cup Series', short: 'CUP', color: 'var(--series-cup, #e10600)', fg: '#fff' },
  { key: 'oreilly', label: "O'Reilly Auto Parts Series", short: "O'REILLY", color: 'var(--series-oreilly, #f5a623)', fg: '#fff' },
  { key: 'trucks', label: 'Craftsman Truck Series', short: 'TRUCKS', color: 'var(--series-trucks, #ffd400)', fg: '#111' },
]
const RUN_LABEL = { 1: 'Practice', 2: 'Qualifying', 3: 'Race' }

// 2026-10-09: the operator supplied the official marks as SVG (public/series-logos/{cup,oreilly,trucks}.svg).
// .svg is tried first, then .png, then the wordmark.
export function SeriesLogo({ series, height = 44 }) {
  const s = SERIES.find(x => x.key === series) || SERIES[0]
  const [ext, setExt] = useState('svg')
  if (ext) {
    return <img src={`/series-logos/${s.key}.${ext}`} alt={s.label} height={height} style={{ height, width: 'auto', display: 'block' }} onError={() => setExt(ext === 'svg' ? 'png' : null)} />
  }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height }}>
      <span style={{ background: s.color, color: s.fg, fontWeight: 900, fontSize: Math.round(height * 0.42), letterSpacing: 1, padding: `0 ${Math.round(height * 0.3)}px`, height: Math.round(height * 0.78), display: 'inline-flex', alignItems: 'center', borderRadius: 6, fontStyle: 'italic' }}>
        {s.short}
      </span>
      <span style={{ color: 'var(--text-secondary, #9aa0aa)', fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s.label.replace(/^Cup Series$/, 'NASCAR Cup')}</span>
    </div>
  )
}

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

export default function WeekendSchedule() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => {
    let alive = true
    fetch(`/api/nascar-feed?type=weekend&year=${new Date().getFullYear()}`)
      .then(r => r.json())
      .then(j => { if (!alive) return; if (j.error) setErr(j.error); else setData(j.weekend || {}) })
      .catch(e => { if (alive) setErr(e.message) })
    return () => { alive = false }
  }, [])
  if (err) return null   // the home page must never break on a feed hiccup
  const now = Date.now()
  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '40px 20px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>This weekend</h2>
        <span style={{ color: 'var(--text-muted, #6b7078)', fontSize: 12 }}>On-track schedule from NASCAR, shown in your time zone</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {SERIES.map(s => {
          const w = data ? data[s.key] : null
          return (
            <div key={s.key} style={{ background: 'var(--bg-card, #14161b)', border: '1px solid var(--border, #22252b)', borderTop: `3px solid ${s.color}`, borderRadius: 12, padding: 16 }}>
              <SeriesLogo series={s.key} height={56} />
              {!data && <div style={{ color: 'var(--text-muted, #6b7078)', fontSize: 13, marginTop: 12 }}>Loading schedule…</div>}
              {data && !w && <div style={{ color: 'var(--text-muted, #6b7078)', fontSize: 13, marginTop: 12 }}>No race on the schedule.</div>}
              {w && <>
                <div style={{ marginTop: 12, color: 'var(--text-primary, #e8eaed)', fontWeight: 700, fontSize: 16, lineHeight: 1.25 }}>{w.race_name}</div>
                <div style={{ color: 'var(--text-secondary, #9aa0aa)', fontSize: 13, marginTop: 2 }}>
                  {w.track}{w.laps ? ` · ${w.laps} laps` : ''}{w.stages && w.stages.length === 3 ? ` (${w.stages.join(' / ')})` : ''}{w.race_number ? ` · Race ${w.race_number}` : w.exhibition ? ' · exhibition' : ''}
                </div>
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'auto 1fr auto', rowGap: 6, columnGap: 10, fontSize: 13, alignItems: 'baseline' }}>
                  {w.events.map((e, i) => {
                    const d = e.start_utc ? new Date(e.start_utc) : null
                    const past = d && d.getTime() < now - 4 * 3600 * 1000
                    const label = RUN_LABEL[e.run_type] || e.name
                    return (
                      <React.Fragment key={i}>
                        <span style={{ color: 'var(--text-muted, #6b7078)', fontWeight: 600, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5, opacity: past ? 0.5 : 1 }}>{d ? dayFmt.format(d) : ''}</span>
                        <span style={{ color: e.run_type === 3 ? 'var(--text-primary, #e8eaed)' : 'var(--text-secondary, #9aa0aa)', fontWeight: e.run_type === 3 ? 700 : 500, opacity: past ? 0.5 : 1 }} title={e.name + (e.notes ? ' - ' + e.notes : '')}>
                          {label}{/impound/i.test(e.name) ? <span style={{ color: 'var(--text-muted, #6b7078)', fontWeight: 400 }}> (impound)</span> : null}
                        </span>
                        <span style={{ color: 'var(--text-primary, #e8eaed)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', opacity: past ? 0.5 : 1 }}>{d ? timeFmt.format(d) : 'TBA'}</span>
                      </React.Fragment>
                    )
                  })}
                </div>
                <div style={{ marginTop: 12, color: 'var(--text-muted, #6b7078)', fontSize: 12, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {w.events.find(e => e.run_type === 3 && e.start_utc) && <span>{dateFmt.format(new Date(w.events.find(e => e.run_type === 3).start_utc))}</span>}
                  {w.tv && <span>TV: <b style={{ color: 'var(--text-secondary, #9aa0aa)' }}>{w.tv}</b></span>}
                  {w.radio && <span>Radio: <b style={{ color: 'var(--text-secondary, #9aa0aa)' }}>{w.radio}</b></span>}
                </div>
              </>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

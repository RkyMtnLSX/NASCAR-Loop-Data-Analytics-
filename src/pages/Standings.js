// src/pages/Standings.js - season standings for all three series (2026-10-12, operator: "build it for
// each series"). Computed from NASCAR's race feeds by api/_standings.js (points_earned per car, the
// 2026 Chase reset ladder) plus the points_adjustments table for penalties the feed never records.
// Verified against nascar.com after Cup R32 before it shipped (see pitboard.md 2026-10-12).
import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const SERIES = [{ v: 'cup', label: 'Cup' }, { v: 'oreilly', label: "O'Reilly" }, { v: 'trucks', label: 'Trucks' }]
const SERIES_COLOR = { cup: 'var(--series-cup)', oreilly: 'var(--series-oreilly)', trucks: 'var(--series-trucks)' }
const wrap = { maxWidth: 1200, margin: '0 auto', padding: '24px 16px 60px' }
const h1 = { fontSize: '1.6rem', fontWeight: 700, margin: '0 0 4px' }
const sub = { fontSize: '0.95rem', color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.5 }
const th = (align) => ({ padding: '10px 10px', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
  color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', textAlign: align || 'right', whiteSpace: 'nowrap' })
const td = (align, extra) => ({ padding: '8px 10px', fontSize: '0.93rem', borderBottom: '1px solid var(--border)', textAlign: align || 'right', whiteSpace: 'nowrap', ...(extra || {}) })
const displayName = (n) => (n || '').replace(/^\*\s*/, '').replace(/\s*\(i\)\s*$/i, '').replace(/\s*#\s*$/, '').trim()

function CarNum({ car, series }) {
  if (!car) return null
  const dir = series === 'oreilly' ? '/car-numbers-oreilly/' : series === 'trucks' ? '/car-numbers-trucks/' : '/car-numbers/'
  return <img src={dir + car + '.png'} alt={'#' + car} style={{ height: 24, marginRight: 8, verticalAlign: 'middle' }}
    onError={(e) => { const t = e.target; const s = document.createElement('span'); s.textContent = '#' + car; s.style.fontWeight = '700'; s.style.marginRight = '8px'; t.replaceWith(s) }} />
}

export default function Standings() {
  const [sp, setSp] = useSearchParams()
  const series = ['cup', 'oreilly', 'trucks'].includes(sp.get('series')) ? sp.get('series') : 'cup'
  const year = Number(sp.get('year')) || new Date().getFullYear()
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [open, setOpen] = useState(null)
  const [showAll, setShowAll] = useState(false)
  useEffect(() => {
    let on = true
    setData(null); setErr(null); setOpen(null)
    fetch('/api/nascar-feed?type=standings&sk=' + series + '&year=' + year).then(r => r.json()).then(j => {
      if (!on) return
      if (j.error) setErr(j.error); else setData(j)
    }).catch(e => on && setErr(e.message))
    return () => { on = false }
  }, [series, year])
  const setSeries = (v) => { const n = new URLSearchParams(sp); n.set('series', v); setSp(n) }

  const rules = data && data.rules
  const chase = data && data.phase === 'chase'
  const rows = data ? data.rows : []
  const field = rows.filter(r => r.inChase)
  const rest = rows.filter(r => !r.inChase)
  const raceById = {}; (data ? data.races : []).forEach(r => { raceById[r.race_id] = r })
  const nextRace = data && rules && rules.regularRaces && !chase ? rules.regularRaces - data.racesRun : null

  const Row = ({ r, cutBelow }) => {
    const isOpen = open === r.name
    return [
      <tr key={r.name} onClick={() => setOpen(isOpen ? null : r.name)} style={{ cursor: 'pointer', background: isOpen ? 'var(--bg-elevated)' : 'transparent', borderBottom: cutBelow ? '2px dashed var(--accent-text)' : undefined }} title="Click for race-by-race points">
        <td style={td('right', { color: 'var(--text-secondary)' })}>{r.pos}</td>
        <td style={td('left')}><CarNum car={r.car} series={series} />{displayName(r.name)}{r.adj ? <span title={'Includes ' + (r.adj > 0 ? '+' : '') + r.adj + ' from NASCAR penalties / credits'} style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--accent-text)', cursor: 'help' }}>{(r.adj > 0 ? '+' : '') + r.adj}</span> : null}</td>
        <td style={td('left', { color: 'var(--text-secondary)', fontSize: '0.85rem' })}>{r.team || ''}</td>
        <td style={td('right', { fontWeight: 700 })}>{r.points}</td>
        <td style={td('right', { color: 'var(--text-secondary)' })}>{r.behind === 0 ? '—' : r.behind}</td>
        {chase ? <td style={td('right', { color: 'var(--text-secondary)' })}>{r.inChase ? r.reset : '-'}</td> : null}
        <td style={td('right', { color: 'var(--text-secondary)' })}>{r.starts}</td>
        <td style={td('right')}>{r.wins || '-'}</td>
        <td style={td('right')}>{r.top5 || '-'}</td>
        <td style={td('right')}>{r.top10 || '-'}</td>
        <td style={td('right', { color: 'var(--text-secondary)' })}>{r.dnf || '-'}</td>
        <td style={td('right', { color: 'var(--text-secondary)' })}>{r.stagePts || '-'}</td>
        <td style={td('right', { color: 'var(--text-secondary)' })}>{r.lapsLed || '-'}</td>
      </tr>,
      isOpen ? <tr key={r.name + '|d'}><td colSpan={chase ? 13 : 12} style={{ padding: '6px 10px 14px 44px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(r.perRace || []).map(p => { const rc = raceById[p.race_id] || {}; return (
            <div key={p.race_id} title={(rc.name || '') + ' · ' + (rc.date || '') + (p.stage ? ' · ' + p.stage + ' stage pts' : '')} style={{ minWidth: 58, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', textAlign: 'center', background: p.finish === 1 ? 'rgba(63,185,80,0.15)' : 'transparent' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 70 }}>{(rc.track || '').replace(/ (Motor )?Speedway| Raceway| Superspeedway| International/g, '')}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>P{p.finish}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.points}{p.stage ? <span style={{ color: 'var(--text-muted)' }}> ({p.stage})</span> : null}</div>
            </div>) })}
        </div>
      </td></tr> : null,
    ]
  }

  const head = (
    <tr>
      <th style={th('right')}>Pos</th><th style={th('left')}>Driver</th><th style={th('left')}>Team</th>
      <th style={th('right')}>Points</th><th style={th('right')}>Behind</th>
      {chase ? <th style={th('right')} title="Points each Chase driver was reset to after the regular season">Reset</th> : null}
      <th style={th('right')}>Starts</th><th style={th('right')}>Wins</th><th style={th('right')}>Top 5</th><th style={th('right')}>Top 10</th>
      <th style={th('right')}>DNF</th><th style={th('right')} title="Stage points earned, already included in Points">Stage</th><th style={th('right')}>Laps led</th>
    </tr>
  )

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={h1}>Standings</h1>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
          {year} SEASON{data ? ` · AFTER RACE ${data.racesRun} OF ${data.totalPointsRaces}` : ''}
        </span>
      </div>
      <p style={{ ...sub, maxWidth: 760 }}>
        Computed from NASCAR&rsquo;s race scoring after every race{rules ? <>. {chase
          ? <>The Chase: the top {rules.chaseDrivers} after race {rules.regularRaces} were reset to {rules.ladder[0]}, {rules.ladder[1]}, {rules.ladder[2]}&hellip; {rules.ladder[rules.ladder.length - 1]} and race the last {rules.chaseRaces} on normal points.</>
          : <>Top {rules.chaseDrivers} after race {rules.regularRaces} make the Chase{nextRace != null ? ` (${nextRace} race${nextRace === 1 ? '' : 's'} to go)` : ''}; the dashed line is the provisional cut.</>}</> : null} Click a driver for race-by-race points.
      </p>
      <div style={{ display: 'inline-flex', gap: 4, marginBottom: 18, padding: 4, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        {SERIES.map((s) => { const active = series === s.v; return (
          <button key={s.v} onClick={() => setSeries(s.v)} style={{ padding: '7px 20px', borderRadius: 7, border: 'none', background: active ? SERIES_COLOR[s.v] : 'transparent',
            color: active ? (s.v === 'trucks' ? '#111' : '#fff') : 'var(--text-secondary)', fontWeight: active ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer' }}>{s.label}</button>) })}
      </div>
      {err ? <div style={{ color: '#f85149' }}>Could not load standings: {err}</div> : null}
      {!data && !err ? <div style={{ color: 'var(--text-secondary)' }}>Loading {year} {SERIES.find(s => s.v === series).label} standings&hellip;</div> : null}
      {data ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>{head}</thead>
            <tbody>
              {field.map((r, i) => <Row key={r.name} r={r} cutBelow={i === field.length - 1 && rest.length > 0} />)}
              {(showAll ? rest : rest.slice(0, chase ? 14 : 24)).map(r => <Row key={r.name} r={r} />)}
            </tbody>
          </table>
          {rest.length > (chase ? 14 : 24) ? <button onClick={() => setShowAll(v => !v)} style={{ marginTop: 10, padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}>{showAll ? 'Show fewer' : 'Show all ' + rows.length + ' drivers'}</button> : null}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.5 }}>
            Points are NASCAR&rsquo;s own scoring from each race feed; drivers not declared for points in this series score zero and are not listed.
            {data.adjustments && data.adjustments.length ? ' ' + data.adjustments.length + ' post-race adjustment' + (data.adjustments.length === 1 ? '' : 's') + ' applied (marked beside the driver).' : ' No post-race penalties recorded this season.'}
            {data.skipped ? ' ' + data.skipped + ' race' + (data.skipped === 1 ? '' : 's') + ' not yet scored by NASCAR.' : ''}
            {(() => { const rb = (data.races || []).filter(r => r.scored === 'rulebook'); return rb.length ? ' NASCAR never published points for ' + rb.map(r => r.track.replace(/ (Motor )?Speedway| Raceway| Superspeedway/g, '') + ' (' + r.date + ')').join(', ') + ' - scored here from the finishing order by the rulebook.' : '' })()}
          </div>
        </div>
      ) : null}
    </div>
  )
}

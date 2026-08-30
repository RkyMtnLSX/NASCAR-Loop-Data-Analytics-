// src/pages/NascarFeedAdmin.js
//
// Race ingestion from NASCAR's own JSON feeds, replacing the Racing Reference
// Ctrl+A/Ctrl+C paste.
//
// WHY
//   The paste parser has broken three times in seven weeks (2026-07-12,
//   2026-07-26, 2026-08-14) because Lap Raptor kept changing the table layout,
//   and the 08-14 redesign dropped mid-race position, laps completed and driver
//   rating site-wide - so the fallback regex writes them as NULL. The feed is
//   NASCAR's own source for the same numbers and has no layout.
//
// VERIFIED before this was written, against cup 2026 R26 Daytona:
//   * all 15 loopstats fields reproduce loop_data exactly, 40/40 drivers
//   * car_number 40/40, qualifying_position 40/40, qualifying_speed exact
//   * cautions 4, caution laps 23, lead changes 41, average speed 154.69 - all
//     equal to what the paste had stored
//   * the three pct_ columns are exact ratios (quality/passes_gf, top15/laps,
//     led/laps) to one decimal
//   * coverage is 100% of every points race in all three series back to 2022
//
// AND IT FIXES THREE THINGS THE PASTE GOT WRONG
//   1. total_laps held SCHEDULED laps. 142 of 436 races have a driver who
//      completed more laps than the race supposedly had (R26: 160 stored, 166
//      run). finish_status is derived from that number, so DNF flags were wrong
//      wherever a race went to overtime.
//   2. finish_status was a laps<90% guess. The feed states it: Running,
//      Accident, Engine, Suspension.
//   3. avg_position and driver_rating were being rounded (9.59 -> 10.00).
//
// WRITES STAY IN THE BROWSER. api/nascar-feed.js only fetches and shapes,
// because the browser cannot reach cf.nascar.com. Every insert and update below
// goes through the operator's own authenticated Supabase session, so RLS
// enforces exactly what it always has and no privileged write endpoint exists.

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const SERIES_ID = { cup: 1, oreilly: 2, trucks: 3 }
const SERIES_OPTS = [['cup', 'Cup'], ['oreilly', "O'Reilly"], ['trucks', 'Trucks']]

// Racing Reference reports the three percentage columns to ONE decimal. Verified:
// 223/340 -> 65.6, 126/166 -> 75.9, 5/166 -> 3.0, 22/24 -> 91.7, 6/151 -> 4.0.
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0)

// NASCAR spells some drivers differently than loop_data does ("John H. Nemechek"
// vs "John Hunter Nemechek", "AJ Allmendinger" vs "A.J. Allmendinger", "Daniel
// Suárez" vs "Daniel Suarez"). driver_name is the join key for most of the
// product, so OUR spelling wins and the feed only supplies the id.
const fold = s => (s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[.,'’]/g, '')
  .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const initialSurname = s => {
  const parts = fold(s).split(' ').filter(Boolean)
  if (parts.length < 2) return ''
  return parts[0][0] + parts[parts.length - 1]
}

// Resolve a feed name to the spelling already in our database.
//   1. the NASCAR id, once any race has been loaded with it   (exact, free)
//   2. accent/punctuation/suffix-folded exact match           (Suárez, A.J.)
//   3. unique first-initial + surname                          (John H. Nemechek)
//   4. the feed's own spelling, and say so                     (genuinely new driver)
function makeResolver(existing) {
  const byId = new Map()
  const byFold = new Map()
  const byInitial = new Map()
  const initialDupes = new Set()
  for (const r of existing) {
    if (r.nascar_driver_id && !byId.has(r.nascar_driver_id)) byId.set(r.nascar_driver_id, r.driver_name)
    const f = fold(r.driver_name)
    if (f && !byFold.has(f)) byFold.set(f, r.driver_name)
    const k = initialSurname(r.driver_name)
    if (k) {
      if (byInitial.has(k) && byInitial.get(k) !== r.driver_name) initialDupes.add(k)
      else byInitial.set(k, r.driver_name)
    }
  }
  return d => {
    const hitId = byId.get(d.driver_id)
    if (hitId) return { name: hitId, how: 'id' }
    const hitFold = byFold.get(fold(d.driver_fullname))
    if (hitFold) return { name: hitFold, how: 'fold' }
    const k = initialSurname(d.driver_fullname)
    if (k && !initialDupes.has(k) && byInitial.has(k)) return { name: byInitial.get(k), how: 'initial' }
    return { name: d.driver_fullname, how: 'new' }
  }
}

async function feed(params) {
  const qs = Object.entries(params).filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  const r = await fetch(`/api/nascar-feed?${qs}`)
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
  return j
}

// One race's feed payload -> the rows we store. Pure, so the backfill and the
// loader cannot drift apart.
function mapRace(payload, ctx) {
  const { series, year, raceNumber, trackName, resolve } = ctx
  const R = payload.race

  // Stage results only publish the points-paying top ten, so most drivers get
  // null here. That is the feed's shape, not a load failure.
  const stagePos = {}
  for (const st of payload.stageResults || []) {
    for (const row of st.results || []) {
      stagePos[row.driver_id] = stagePos[row.driver_id] || {}
      stagePos[row.driver_id][st.stage_number] = row.finishing_position
    }
  }

  const rows = payload.drivers.map(d => {
    const L = d.loop
    const { name, how } = resolve(d)
    return {
      __how: how,
      __feedName: d.driver_fullname,
      driver_name: name,
      nascar_driver_id: d.driver_id,
      series,
      year,
      race_number: raceNumber,
      track_name: trackName,
      car_number: d.car_number != null ? String(d.car_number).trim() : null,
      team_name: d.team_name || null,
      start_position: L.start_ps,
      mid_race_position: L.mid_ps,
      finish_position: L.ps,
      high_position: L.best_ps,
      low_position: L.worst_ps,
      avg_position: L.avg_ps,
      pass_diff: L.passing_diff,
      green_flag_passes: L.passes_gf,
      green_flag_times_passed: L.passed_gf,
      quality_passes: L.quality_passes,
      pct_quality_passes: pct(L.quality_passes, L.passes_gf),
      fastest_laps: L.fast_laps,
      top15_laps: L.top15_laps,
      pct_top15_laps: pct(L.top15_laps, L.laps),
      laps_led: L.lead_laps,
      pct_laps_led: pct(L.lead_laps, L.laps),
      laps_completed: L.laps,
      driver_rating: L.rating,
      closing_ps: L.closing_ps,
      // Lowercased so it matches both vocabularies already in the column, and
      // so SimulationCenter's `fs && fs !== 'running'` DNF test keeps working.
      finish_status: (d.finishing_status || '').trim().toLowerCase() || null,
      stage1_finish: (stagePos[d.driver_id] || {})[1] ?? null,
      stage2_finish: (stagePos[d.driver_id] || {})[2] ?? null,
    }
  })

  const winner = rows.find(r => r.finish_position === 1)
  const mov = parseFloat(R.margin_of_victory)

  const race = {
    race_name: `${trackName} ${year}`,
    track_name: trackName,
    year,
    race_number: raceNumber,
    series,
    race_date: (R.race_date || R.date_scheduled || '').slice(0, 10) || null,
    nascar_race_id: R.race_id,
    winning_driver: winner ? winner.driver_name : null,
    winning_car_number: winner ? winner.car_number : null,
    // ACTUAL laps, not scheduled. This is the 142-race correction.
    total_laps: R.actual_laps || null,
    scheduled_laps: R.scheduled_laps || null,
    total_cautions: R.number_of_cautions,
    total_caution_laps: R.number_of_caution_laps,
    lead_changes: R.number_of_lead_changes,
    avg_speed: R.average_speed,
    // Not published as a race total; it is the sum of the driver rows, verified
    // against races.green_flag_passes for cup 2026 R25 and R26.
    green_flag_passes: rows.reduce((s, r) => s + (r.green_flag_passes || 0), 0),
    margin_of_victory: Number.isFinite(mov) ? mov : null,
    margin_of_victory_text: R.margin_of_victory != null ? String(R.margin_of_victory) : null,
  }

  return { race, rows }
}

const card = { marginBottom: 20 }
const inputStyle = { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.85rem', width: '100%' }
const labelStyle = { fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 14 }
const mono = { fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: '0.75rem' }

// ===========================================================================
// LOAD ONE RACE
// ===========================================================================

export function LoadRaceFromFeed() {
  const [series, setSeries] = useState('cup')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [raceNum, setRaceNum] = useState('')
  const [raceDate, setRaceDate] = useState('')
  const [trackName, setTrackName] = useState('')
  const [tracks, setTracks] = useState([])
  const [candidates, setCandidates] = useState([])
  const [nascarId, setNascarId] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    supabase.from('tracks').select('name').order('name')
      .then(({ data }) => setTracks((data || []).map(t => t.name)))
  }, [])

  async function findRace() {
    setBusy(true); setStatus(null); setPreview(null); setCandidates([]); setNascarId('')
    try {
      const j = await feed({ type: 'schedule', year, series: SERIES_ID[series], date: raceDate || undefined })
      const list = raceDate ? (j.matches || []) : j.races
      setCandidates(list)
      if (j.match) {
        setNascarId(String(j.match.nascar_race_id))
        if (!trackName) setTrackName(j.match.track_name)
        setStatus({ ok: `Matched ${j.match.race_name} at ${j.match.track_name} (${j.match.race_date})` })
      } else if (raceDate) {
        setStatus({ err: `${list.length} races within a day of ${raceDate} — pick one below.` })
      } else {
        setStatus({ ok: `${j.races.length} races in ${year}. Pick one, or enter a date to match automatically.` })
      }
    } catch (e) { setStatus({ err: e.message }) } finally { setBusy(false) }
  }

  async function fetchRace() {
    setBusy(true); setStatus(null); setPreview(null)
    try {
      const payload = await feed({ type: 'race', year, series: SERIES_ID[series], race: nascarId })
      if (payload.join.weekendOnly || payload.join.loopOnly) {
        setStatus({ err: `Feeds disagree on the field: ${payload.join.weekendOnly} in results but not loop data, ${payload.join.loopOnly} the other way. Not loading — look at this first.` })
        return
      }
      const { data: existing } = await supabase.from('loop_data')
        .select('driver_name, nascar_driver_id').eq('series', series).limit(20000)
      const resolve = makeResolver(existing || [])
      const mapped = mapRace(payload, {
        series, year: parseInt(year, 10), raceNumber: parseInt(raceNum, 10),
        trackName: trackName || payload.race.track_name, resolve,
      })
      setPreview({ ...mapped, payload })
      const nw = mapped.rows.filter(r => r.__how === 'new')
      setStatus({
        ok: `${mapped.rows.length} drivers, ${payload.dnq.length} DNQ. `
          + (nw.length ? `${nw.length} name(s) not already in loop_data: ${nw.map(r => r.__feedName).join(', ')}` : 'Every name matched an existing spelling.'),
      })
    } catch (e) { setStatus({ err: e.message }) } finally { setBusy(false) }
  }

  async function load() {
    if (!preview) return
    setBusy(true); setStatus(null)
    try {
      const { race, rows } = preview
      const seriesCode = { cup: 'W', oreilly: 'B', trucks: 'C' }[series] || 'W'
      const rrId = `${year}-${String(raceNum).padStart(2, '0')}-${seriesCode}`

      const { data: dupe } = await supabase.from('races').select('id, track_name')
        .eq('racing_reference_id', rrId).maybeSingle()
      if (dupe) { setStatus({ err: `Already loaded: ${dupe.track_name} ${year} (${rrId})` }); return }

      // Adopt a stub row the practice uploader may have created for this weekend.
      const { data: stubs } = await supabase.from('races').select('id')
        .eq('series', series).eq('year', parseInt(year, 10)).eq('track_name', race.track_name)
        .eq('race_number', parseInt(raceNum, 10)).is('racing_reference_url', null)
        .order('id', { ascending: true })
      const stubId = stubs && stubs.length ? stubs[0].id : null

      const fields = { ...race, racing_reference_id: rrId }
      const { data: raceRow, error: raceErr } = stubId
        ? await supabase.from('races').update(fields).eq('id', stubId).select('id').single()
        : await supabase.from('races').insert(fields).select('id').single()
      if (raceErr) { setStatus({ err: `Race write failed: ${raceErr.message}` }); return }

      for (const r of rows) {
        await supabase.from('drivers').upsert(
          { name: r.driver_name, series, nascar_driver_id: r.nascar_driver_id },
          { onConflict: 'name,series', ignoreDuplicates: true })
      }

      const insertRows = rows.map(({ __how, __feedName, ...keep }) => ({ ...keep, race_id: raceRow.id }))
      const { error: ldErr } = await supabase.from('loop_data').insert(insertRows)
      if (ldErr) { setStatus({ err: `loop_data write failed: ${ldErr.message}` }); return }

      setStatus({ ok: `Loaded ${insertRows.length} drivers for ${race.track_name} ${year} — ${race.total_laps} actual laps (${race.scheduled_laps} scheduled), ${race.total_cautions} cautions.` })
      setPreview(null)
    } catch (e) { setStatus({ err: e.message }) } finally { setBusy(false) }
  }

  return (
    <div className="card" style={card}>
      <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Load Race from NASCAR Feed</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 14px' }}>
        No paste. Enter the weekend, match the race, review, load. Source is NASCAR's
        own loopstats and weekend feeds — the same numbers Racing Reference publishes,
        plus real finish statuses, actual (not scheduled) laps, and closing position.
      </p>

      <div style={grid}>
        <div><label style={labelStyle}>Series</label>
          <select value={series} onChange={e => setSeries(e.target.value)} style={inputStyle}>
            {SERIES_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
        <div><label style={labelStyle}>Year</label>
          <input value={year} onChange={e => setYear(e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Race # (season round)</label>
          <input value={raceNum} onChange={e => setRaceNum(e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Race date</label>
          <input type="date" value={raceDate} onChange={e => setRaceDate(e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Track (canonical)</label>
          <select value={trackName} onChange={e => setTrackName(e.target.value)} style={inputStyle}>
            <option value="">From feed…</option>
            {tracks.map(t => <option key={t} value={t}>{t}</option>)}
          </select></div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="btn btn-secondary" disabled={busy || !year} onClick={findRace}>1. Find race</button>
        <button className="btn btn-secondary" disabled={busy || !nascarId || !raceNum} onClick={fetchRace}>2. Fetch &amp; preview</button>
        <button className="btn" disabled={busy || !preview} onClick={load}>3. Load</button>
      </div>

      {candidates.length > 0 && !preview && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>NASCAR race</label>
          <select value={nascarId} onChange={e => setNascarId(e.target.value)} style={inputStyle}>
            <option value="">Select…</option>
            {candidates.map(c => (
              <option key={c.nascar_race_id} value={c.nascar_race_id}>
                {c.race_date} — {c.track_name} — {c.race_name} (#{c.nascar_race_id})
              </option>
            ))}
          </select>
        </div>
      )}

      {status && (
        <div style={{ padding: '8px 10px', borderRadius: 6, marginBottom: 12, fontSize: '0.8rem', background: status.err ? 'rgba(220,38,38,0.12)' : 'rgba(34,197,94,0.12)', color: status.err ? '#fca5a5' : '#86efac' }}>
          {status.err || status.ok}
        </div>
      )}

      {preview && (
        <div>
          <div style={{ ...mono, marginBottom: 10, color: 'var(--text-muted)' }}>
            {preview.race.track_name} {preview.race.year} · {preview.race.total_laps} laps run
            ({preview.race.scheduled_laps} scheduled) · {preview.race.total_cautions} cautions /
            {' '}{preview.race.total_caution_laps} laps · {preview.race.lead_changes} lead changes ·
            {' '}{preview.race.avg_speed} mph · margin {preview.race.margin_of_victory_text}
          </div>
          <div style={{ maxHeight: 380, overflow: 'auto' }}>
            <table style={{ ...mono, width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                {['Fin', 'Driver', '#', 'Team', 'Start', 'Avg', 'Close', 'Led', 'Laps', 'Rtg', 'Status', 'S1', 'S2'].map(h => (
                  <th key={h} style={{ padding: '3px 6px', borderBottom: '1px solid var(--border)' }}>{h}</th>))}
              </tr></thead>
              <tbody>
                {preview.rows.map(r => (
                  <tr key={r.nascar_driver_id}>
                    <td style={{ padding: '2px 6px' }}>{r.finish_position}</td>
                    <td style={{ padding: '2px 6px' }} title={r.__how === 'id' ? 'matched by NASCAR id' : r.__how === 'new' ? 'NOT already in loop_data' : `matched by ${r.__how} from "${r.__feedName}"`}>
                      {r.driver_name}{r.__how === 'new' ? ' ⚠' : ''}
                    </td>
                    <td style={{ padding: '2px 6px' }}>{r.car_number}</td>
                    <td style={{ padding: '2px 6px' }}>{r.team_name}</td>
                    <td style={{ padding: '2px 6px' }}>{r.start_position}</td>
                    <td style={{ padding: '2px 6px' }}>{r.avg_position}</td>
                    <td style={{ padding: '2px 6px' }}>{r.closing_ps}</td>
                    <td style={{ padding: '2px 6px' }}>{r.laps_led}</td>
                    <td style={{ padding: '2px 6px' }}>{r.laps_completed}</td>
                    <td style={{ padding: '2px 6px' }}>{r.driver_rating}</td>
                    <td style={{ padding: '2px 6px' }}>{r.finish_status}</td>
                    <td style={{ padding: '2px 6px' }}>{r.stage1_finish ?? ''}</td>
                    <td style={{ padding: '2px 6px' }}>{r.stage2_finish ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.payload.dnq.length > 0 && (
            <div style={{ ...mono, marginTop: 8, color: 'var(--text-muted)' }}>
              DNQ (not stored): {preview.payload.dnq.map(d => `${d.driver_fullname} #${d.car_number}`).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ===========================================================================
// BACKFILL EXISTING RACES
// ===========================================================================
//
// Repairs and enriches races already in the database, one race per request.
//
// Rows are matched on FINISH POSITION, not on name. Finish position is unique
// within a race, so the match is exact and self-checking: if the feed's set of
// finish positions is not identical to ours, the race is skipped and reported
// rather than partially written. No fuzzy logic anywhere in this path.
//
// It reads each existing row in full and merges the new fields in before
// upserting, so nothing that is not listed here can be nulled by omission.

export function FeedBackfill() {
  const [series, setSeries] = useState('cup')
  const [year, setYear] = useState('2026')
  const [dryRun, setDryRun] = useState(true)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState([])
  const [summary, setSummary] = useState(null)
  const stop = React.useRef(false)

  const say = useCallback(line => setLog(l => [...l.slice(-400), line]), [])

  async function run() {
    setRunning(true); setLog([]); setSummary(null); stop.current = false
    const tally = { races: 0, skipped: 0, rows: 0, lapsFixed: 0, statusFixed: 0, carMismatch: 0, newNames: 0 }
    try {
      const { data: races, error } = await supabase.from('races')
        .select('id, race_number, track_name, race_date, total_laps, nascar_race_id, exhibition')
        .eq('series', series).eq('year', parseInt(year, 10))
        .order('race_number')
      if (error) throw new Error(error.message)
      if (!races || !races.length) { say(`No races for ${series} ${year}.`); return }

      const sched = await feed({ type: 'schedule', year, series: SERIES_ID[series] })
      const byDate = new Map()
      for (const r of sched.races) if (r.race_date) byDate.set(r.race_date, r)

      const { data: existingNames } = await supabase.from('loop_data')
        .select('driver_name, nascar_driver_id').eq('series', series).limit(20000)
      const resolve = makeResolver(existingNames || [])

      say(`${races.length} races in the registry for ${series} ${year}. ${dryRun ? 'DRY RUN — nothing will be written.' : 'WRITING.'}`)

      for (const race of races) {
        if (stop.current) { say('Stopped.'); break }
        const label = `R${race.race_number} ${race.track_name}`

        let nid = race.nascar_race_id
        if (!nid) {
          const d = (race.race_date || '').slice(0, 10)
          const hit = byDate.get(d)
            || sched.races.find(r => r.race_date && Math.abs(Date.parse(r.race_date) - Date.parse(d)) <= 86400000
                                     && r.track_name === race.track_name)
          if (!hit) { say(`  SKIP ${label}: no NASCAR race matches ${d || '(no date)'}`); tally.skipped++; continue }
          nid = hit.nascar_race_id
        }

        let payload
        try {
          payload = await feed({ type: 'race', year, series: SERIES_ID[series], race: nid })
        } catch (e) { say(`  SKIP ${label}: feed ${e.message}`); tally.skipped++; continue }

        const { data: ours } = await supabase.from('loop_data').select('*').eq('race_id', race.id)
        if (!ours || !ours.length) { say(`  SKIP ${label}: no loop_data rows`); tally.skipped++; continue }

        const mapped = mapRace(payload, {
          series, year: parseInt(year, 10), raceNumber: race.race_number,
          trackName: race.track_name, resolve,
        })

        // The bijection test. Both directions, so an extra row on either side fails.
        const ourPos = new Set(ours.map(r => r.finish_position))
        const feedPos = new Set(mapped.rows.map(r => r.finish_position))
        const same = ourPos.size === ours.length && feedPos.size === mapped.rows.length
          && ourPos.size === feedPos.size && [...ourPos].every(p => feedPos.has(p))
        if (!same) {
          say(`  SKIP ${label}: finish positions do not correspond (ours ${ours.length}, feed ${mapped.rows.length})`)
          tally.skipped++; continue
        }

        const feedByPos = new Map(mapped.rows.map(r => [r.finish_position, r]))
        const merged = ours.map(row => {
          const f = feedByPos.get(row.finish_position)
          if (f.__how === 'new') tally.newNames++
          if (row.car_number && f.car_number && String(row.car_number) !== String(f.car_number)) {
            tally.carMismatch++
            say(`    car# ${row.driver_name}: stored #${row.car_number}, feed #${f.car_number} — feed wins`)
          }
          if ((row.finish_status || '') !== (f.finish_status || '')) tally.statusFixed++
          return {
            ...row,                       // every existing column preserved
            nascar_driver_id: f.nascar_driver_id,
            closing_ps: f.closing_ps,
            team_name: f.team_name,
            car_number: f.car_number ?? row.car_number,
            stage1_finish: f.stage1_finish,
            stage2_finish: f.stage2_finish,
            finish_status: f.finish_status,
            // Precision the paste threw away.
            avg_position: f.avg_position,
            driver_rating: f.driver_rating,
            mid_race_position: f.mid_race_position ?? row.mid_race_position,
            laps_completed: f.laps_completed ?? row.laps_completed,
          }
        })

        const lapsWrong = race.total_laps !== mapped.race.total_laps
        if (lapsWrong) {
          say(`    laps ${label}: stored ${race.total_laps}, actually ran ${mapped.race.total_laps}`)
          tally.lapsFixed++
        }

        if (!dryRun) {
          const { error: e1 } = await supabase.from('loop_data').upsert(merged, { onConflict: 'id' })
          if (e1) { say(`  FAIL ${label}: loop_data ${e1.message}`); tally.skipped++; continue }
          const { error: e2 } = await supabase.from('races').update({
            nascar_race_id: mapped.race.nascar_race_id,
            total_laps: mapped.race.total_laps,
            scheduled_laps: mapped.race.scheduled_laps,
            total_cautions: mapped.race.total_cautions,
            total_caution_laps: mapped.race.total_caution_laps,
            lead_changes: mapped.race.lead_changes,
            avg_speed: mapped.race.avg_speed,
            green_flag_passes: mapped.race.green_flag_passes,
            margin_of_victory: mapped.race.margin_of_victory,
            margin_of_victory_text: mapped.race.margin_of_victory_text,
          }).eq('id', race.id)
          if (e2) { say(`  FAIL ${label}: races ${e2.message}`); tally.skipped++; continue }
        }

        tally.races++; tally.rows += merged.length
        say(`  ok   ${label}: ${merged.length} rows`)
      }
      setSummary(tally)
    } catch (e) {
      say(`ERROR: ${e.message}`)
    } finally { setRunning(false) }
  }

  return (
    <div className="card" style={card}>
      <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Feed Backfill (existing races)</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 14px' }}>
        Adds <code>nascar_driver_id</code>, <code>closing_ps</code>, <code>team_name</code> and
        stage finishes to races already loaded, and repairs <code>total_laps</code> (which has
        been holding scheduled laps) and <code>finish_status</code> (which was a laps&lt;90% guess).
        Rows are matched on finish position — a race whose positions do not correspond exactly is
        skipped, never partially written. Run it dry first.
      </p>

      <div style={grid}>
        <div><label style={labelStyle}>Series</label>
          <select value={series} onChange={e => setSeries(e.target.value)} style={inputStyle} disabled={running}>
            {SERIES_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
        <div><label style={labelStyle}>Year</label>
          <select value={year} onChange={e => setYear(e.target.value)} style={inputStyle} disabled={running}>
            {[2022, 2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select></div>
        <div><label style={labelStyle}>Mode</label>
          <select value={dryRun ? 'dry' : 'write'} onChange={e => setDryRun(e.target.value === 'dry')} style={inputStyle} disabled={running}>
            <option value="dry">Dry run</option>
            <option value="write">Write</option>
          </select></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={dryRun ? 'btn btn-secondary' : 'btn'} disabled={running} onClick={run}>
          {running ? 'Running…' : dryRun ? 'Dry run' : `Write ${series} ${year}`}
        </button>
        {running && <button className="btn btn-secondary" onClick={() => { stop.current = true }}>Stop</button>}
      </div>

      {summary && (
        <div style={{ ...mono, padding: '8px 10px', borderRadius: 6, marginBottom: 10, background: 'rgba(34,197,94,0.12)', color: '#86efac' }}>
          {summary.races} races, {summary.rows} rows · total_laps corrected on {summary.lapsFixed} ·
          finish_status changed on {summary.statusFixed} · car# disagreements {summary.carMismatch} ·
          unmatched names {summary.newNames} · skipped {summary.skipped}
        </div>
      )}

      {log.length > 0 && (
        <pre style={{ ...mono, maxHeight: 320, overflow: 'auto', background: 'var(--bg-elevated)', padding: 10, borderRadius: 6, margin: 0 }}>
          {log.join('\n')}
        </pre>
      )}
    </div>
  )
}

export default LoadRaceFromFeed

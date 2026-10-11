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
import { fetchAllRows } from '../lib/fetchAllRows'
import { SERIES_ID, SERIES_OPTS, fold, makeResolver, feed, mapRace } from '../lib/nascarFeedMap'
import { autoGradeRace } from '../lib/gradeRace'
import { shapeBundle, applyBundle } from '../lib/weekendBundle'

const card = { marginBottom: 20 }
const inputStyle = { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.85rem', width: '100%' }
const labelStyle = { fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 4 }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 14 }
const mono = { fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: '0.75rem' }

// ===========================================================================
// LOAD ONE RACE
// ===========================================================================

// LAST LOADED PER SERIES (2026-09-12, operator: "show me the last race loaded for each series so
// I'll know if I forgot one"). Reads `races` for the year (rows the loaders stamped with a
// racing_reference_id - practice-uploader stubs have none) and, best-effort, NASCAR's schedule feed
// for all three series in one call; any scheduled race dated after the last loaded one and before
// today is listed as MISSING. The strip re-reads after every successful Load.
function LoadedStatus({ year, tick }) {
  const [rows, setRows] = useState(null)
  const [sched, setSched] = useState(null)
  useEffect(() => {
    let live = true
    setRows(null)
    supabase.from('races').select('series, race_number, track_name, race_date')
      .eq('year', parseInt(year, 10)).not('racing_reference_id', 'is', null).not('total_laps', 'is', null)   // 2026-10-05: a registry row is not a load
      .order('race_number', { ascending: false }).limit(200)
      .then(({ data }) => { if (live) setRows(data || []) })
    feed({ type: 'schedule', year }).then(j => { if (live) setSched(j.races || []) }).catch(() => { if (live) setSched([]) })
    return () => { live = false }
  }, [year, tick])
  const today = new Date().toISOString().slice(0, 10)
  const fmt = d => d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      {SERIES_OPTS.map(([v, l]) => {
        const mine = (rows || []).filter(r => r.series === v)
        const last = mine[0]
        const missing = !sched ? null : sched.filter(r => r.series === v && r.race_date && r.race_date < today && (!last || !last.race_date || r.race_date > last.race_date))
        const behind = missing && missing.length > 0
        return (
          <div key={v} style={{ flex: '1 1 200px', padding: '8px 12px', borderRadius: 8, border: '1px solid ' + (behind ? '#ef4444' : 'var(--border)'), background: behind ? 'rgba(239,68,68,0.08)' : 'var(--bg-surface)', fontSize: '0.78rem' }}>
            <div style={{ ...labelStyle, marginBottom: 2 }}>{l} — last loaded</div>
            {rows == null ? <div style={{ color: 'var(--text-muted)' }}>…</div>
              : !last ? <div style={{ color: '#ef4444' }}>nothing loaded for {year}</div>
              : <div><strong>R{last.race_number}</strong> {last.track_name}{last.race_date ? ' (' + fmt(last.race_date) + ')' : ''} · {mine.length} race{mine.length === 1 ? '' : 's'}</div>}
            {sched == null ? null
              : behind ? <div style={{ color: '#ef4444', marginTop: 2 }}>MISSING {missing.length}: {missing.map(m => m.track_name + ' (' + fmt(m.race_date) + ')').join(', ')}</div>
              : rows != null && last ? <div style={{ color: '#22c55e', marginTop: 2 }}>up to date</div> : null}
          </div>
        )
      })}
    </div>
  )
}

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
  const [loadedTick, setLoadedTick] = useState(0)

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
      if (payload.join.weekendOnly) {
        setStatus({ err: `Feeds disagree on the field: ${payload.join.weekendOnly} driver(s) scored in the weekend results but absent from loop data. Not loading — look at this first.` })
        return
      }
      // PAGINATED 2026-09-02. .limit(20000) is not real - the cap is 5,000, and cup loop_data is
      // 6,348 rows. Which rows the cap drops is NOT predictable (an earlier note here said "the
      // newest"; a live unordered read lost rows from every season, and the set changed between
      // requests). Measured live in review: 4 of 101 cup drivers absent from the map - Will Brown,
      // Loris Hezemans, Scott Heckert, Kevin Magnussen. An unresolved driver on ingest is a
      // mis-attributed or duplicated row, so this is data integrity, not display.
      const { data: existing } = await fetchAllRows(() => supabase.from('loop_data')
        .select('driver_name, nascar_driver_id').eq('series', series))
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

  // PIT DATA (2026-10-11): pit stops + pit-road penalties from NASCAR's feeds, written through the
  // operator's session. Replaces POST_RACE_UPDATE.bat steps 1-2 (pitboard_pit_backfill.py /
  // pitboard_penalties_backfill_v3.py); shaping and the parser live in src/lib/pitFeeds.js. Delete-
  // then-insert per race so a re-run never duplicates. Returns a one-line summary.
  async function loadPitData(raceRowId, nascarRaceId, yr, seriesKey, trackName, raceNumber) {
    const reg = { race_id: raceRowId, nascar_race_id: nascarRaceId, series: seriesKey, year: yr, track_name: trackName, race_number: raceNumber }
    const parts = []
    try {
      const pj = await feed({ type: 'pits', year: yr, series: SERIES_ID[seriesKey], race: nascarRaceId })
      if (!pj.available) parts.push('pit stops: feed not published yet')
      else {
        await supabase.from('pit_stops').delete().eq('race_id', raceRowId)
        const rows = (pj.rows || []).map(r => ({ ...reg, ...r }))
        for (let i = 0; i < rows.length; i += 500) {
          const { error } = await supabase.from('pit_stops').insert(rows.slice(i, i + 500))
          if (error) throw new Error('pit_stops: ' + error.message)
        }
        parts.push(`pit stops: ${rows.length} (${pj.cars} cars${pj.dropped ? ', ' + pj.dropped + ' dupes dropped' : ''})`)
      }
    } catch (e) { parts.push('pit stops FAILED: ' + e.message) }
    try {
      const nj = await feed({ type: 'penalties', year: yr, series: SERIES_ID[seriesKey], race: nascarRaceId })
      if (!nj.available) parts.push('penalties: no lap notes yet')
      else {
        await supabase.from('pit_penalties').delete().eq('race_id', raceRowId)
        const rows = (nj.rows || []).map(r => ({ ...reg, ...r }))
        if (rows.length) { const { error } = await supabase.from('pit_penalties').insert(rows); if (error) throw new Error('pit_penalties: ' + error.message) }
        const t = nj.totals || {}
        parts.push(`penalties: ${rows.length} (crew ${t.crew || 0}, driver ${t.driver || 0}, grid ${t.grid || 0}, other ${t.other || 0}${(nj.unparsed || []).length ? ', ' + nj.unparsed.length + ' unparsed' : ''})`)
      }
    } catch (e) { parts.push('penalties FAILED: ' + e.message) }
    return parts.join(' · ')
  }

  // FASTEST LAPS (2026-10-11, operator: fold it into Load Race): the lap archive -> fastest_laps rows,
  // Lap Raptor rule on (the stored history was built on it), written through /api/load-fastest-laps
  // exactly as the old panel did. Returns a one-line summary.
  async function loadFastestLaps(nascarRaceId, yr, seriesKey, trackName) {
    try {
      const payload = await feed({ type: 'laps', year: yr, series: SERIES_ID[seriesKey], race: nascarRaceId })
      if (!payload || !(payload.drivers || []).length) return 'fastest laps: lap archive not published yet'
      const { data: known } = await fetchAllRows(() => supabase.from('loop_data').select('driver_name, nascar_driver_id').eq('series', seriesKey))
      const built = buildFastestLapRows(payload, makeResolver(known || []), { lapRaptorRule: true })
      const race = payload.race || {}
      const rn = race.race_name || '', rd = mdy(race.race_date || race.date_scheduled)
      if (!rn || !rd) return 'fastest laps: feed gave no race name/date'
      const rows = built.rows.map(({ __how, __feedName, __laps, __junk, __caution, ...r }) => r)
      const res = await fetch('/api/load-fastest-laps', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series: seriesKey, year: yr, track_type: guessType(race), race_name: rn, race_date: rd, track: trackName, rows }) })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      return `fastest laps: ${rows.length} drivers (fastest ${j.topDriver || '?'}${j.topSpeed ? ' ' + j.topSpeed + ' mph' : ''}${built.skipped.length ? ', skipped ' + built.skipped.length : ''})`
    } catch (e) { return 'fastest laps FAILED: ' + e.message }
  }

  // Pit data for an already-loaded race: find its registry row by series / year / race number.
  async function pitOnly() {
    setBusy(true); setStatus(null)
    try {
      const { data: rr } = await supabase.from('races').select('id, track_name, nascar_race_id').eq('series', series).eq('year', parseInt(year, 10)).eq('race_number', parseInt(raceNum, 10)).not('total_laps', 'is', null).order('id', { ascending: true }).limit(1)
      const row = rr && rr[0]
      if (!row) { setStatus({ err: `No loaded race for ${series} ${year} R${raceNum} - load the race first (step 3).` }); return }
      const nid = row.nascar_race_id || parseInt(nascarId, 10)
      if (row.nascar_race_id !== nid) await supabase.from('races').update({ nascar_race_id: nid }).eq('id', row.id)
      const msg = await loadPitData(row.id, nid, parseInt(year, 10), series, row.track_name, parseInt(raceNum, 10))
      const fl = await loadFastestLaps(nid, parseInt(year, 10), series, row.track_name)
      const g = await autoGradeRace(series, parseInt(year, 10), parseInt(raceNum, 10))
      setStatus({ ok: `${row.track_name} ${year} R${raceNum}: ${msg}. ${fl}. Boards — ${g}` })
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
        .eq('racing_reference_id', rrId).not('total_laps', 'is', null).maybeSingle()   // 2026-10-05: a registry row with no results is not "already loaded"
      if (dupe) { setStatus({ err: `Already loaded: ${dupe.track_name} ${year} (${rrId})` }); return }

      // Adopt a stub row the practice uploader may have created for this weekend.
      const { data: stubs } = await supabase.from('races').select('id')
        .eq('series', series).eq('year', parseInt(year, 10)).eq('track_name', race.track_name)
        .eq('race_number', parseInt(raceNum, 10)).is('racing_reference_url', null).is('total_laps', null)
        .order('id', { ascending: true })
      const stubId = stubs && stubs.length ? stubs[0].id : null

      // weekendAvailable is a mapper flag, not a races column (added 2026-09-05 for the bulk path; the
      // single-race Load spread it into the write and PostgREST refused: 'Could not find the weekendAvailable column').
      const { weekendAvailable: __wkFlag, ...__raceCols } = race
      const fields = { ...__raceCols, racing_reference_id: rrId }
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

      // Caution timing. Delete-then-insert so a re-load cannot leave stale segments,
      // and a failure here is reported but does not fail the race load - the loop
      // data is the deliverable, cautions are an enrichment.
      const cautions = (preview.cautions || []).map(c => ({ ...c, race_id: raceRow.id, nascar_race_id: race.nascar_race_id }))
      await supabase.from('caution_segments').delete().eq('race_id', raceRow.id)
      if (cautions.length) {
        const { error: cErr } = await supabase.from('caution_segments').insert(cautions)
        if (cErr) setStatus({ err: `loop_data loaded, but caution segments failed: ${cErr.message}` })
      }

      const __pit = await loadPitData(raceRow.id, race.nascar_race_id, parseInt(year, 10), series, race.track_name, parseInt(raceNum, 10))
      // ONE CLICK (2026-10-11): grade every published board for this race and log season CLV.
      const __fl = await loadFastestLaps(race.nascar_race_id, parseInt(year, 10), series, race.track_name)
      setStatus({ ok: `Loaded ${insertRows.length} drivers. ${__pit}. ${__fl}. Grading boards...` })
      const __grade = await autoGradeRace(series, parseInt(year, 10), parseInt(raceNum, 10))
      setStatus({ ok: `Loaded ${insertRows.length} drivers for ${race.track_name} ${year} — ${race.total_laps} actual laps (${race.scheduled_laps} scheduled), ${race.total_cautions} cautions. ${__pit}. ${__fl}. Boards — ${__grade}` })
      setPreview(null); setLoadedTick(t => t + 1)
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

      <LoadedStatus year={year} tick={loadedTick} />

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
        <button className="btn btn-secondary" disabled={busy || !nascarId || !raceNum} onClick={pitOnly} title="Everything after the loop data, for a race already in the registry: pit stops + penalties, fastest laps, grade every published board, log CLV. Use it when a feed was not out yet at load time (NASCAR posts pit data and the lap archive within hours of the finish).">Post-race data only</button>
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

const ALL_YEARS = [2022, 2023, 2024, 2025, 2026]


const stripMarkers = n => (n || '').replace(/\(\s*[A-Za-z]\s*\)/g, ' ').replace(/[#*]/g, ' ').replace(/\s+/g, ' ').trim()
const pctile = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))] : null
const mdy = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[2]}/${m[3]}/${m[1]}` : '' }

function guessType(race) {
  if (!race) return 'Other'
  const nm = (race.track_name || '').toLowerCase()
  if (race.restrictor_plate) return 'Superspeedway'
  if (/road|circuit|glen|sonoma|cota|roval|street|mexico/.test(nm)) return 'Road Course'
  const len = race.actual_laps && race.actual_distance ? race.actual_distance / race.actual_laps
    : race.scheduled_laps && race.scheduled_distance ? race.scheduled_distance / race.scheduled_laps : null
  if (len == null) return 'Other'
  if (len < 1.1) return 'Short Track'
  if (len <= 2.0) return 'Intermediate'
  return 'Superspeedway'
}

// LAP RAPTOR-COMPATIBLE MODE (2026-09-26, Richmond diff): the archive and Lap Raptor agree on the race
// fastest lap and on 31 of 37 drivers to the thousandth. The 6 that differ are all lap-down cars whose
// first green lap after a stage restart is NUMBERED inside the leaders' caution window (a lap-down
// car's lap 79 is run while the leaders are on 80). Lap Raptor drops every lap numbered inside a
// caution window, so it discards those real laps; the archive keeps them. Four years of stored
// history and the fastest-lap-rank handicapping were built on Lap Raptor's rule, so the panel
// applies it by default (opts.lapRaptorRule) and offers the raw archive as the alternative.
export function buildFastestLapRows(payload, resolve, opts = {}) {
  const byId = new Map(), byNum = new Map()
  for (const r of payload.results || []) { if (r.driver_id) byId.set(r.driver_id, r); if (r.number) byNum.set(r.number, r) }
  const cautions = opts.lapRaptorRule ? (payload.cautions || []) : []
  const underCaution = lap => cautions.some(c => lap >= c.start_lap && lap <= c.end_lap)
  const rows = []
  const skipped = []
  for (const d of payload.drivers || []) {
    const eligible = d.laps.filter(l => !underCaution(l.lap))
    const times = eligible.map(l => l.time).filter(t => t > 0).sort((a, b) => a - b)
    if (!times.length) { skipped.push(d.name + ' (no laps)'); continue }
    const med = times[Math.floor(times.length / 2)]
    const valid = eligible.filter(l => l.time >= 0.75 * med)
    const flying = valid.filter(l => l.time <= 1.2 * med).map(l => l.time).sort((a, b) => a - b)
    if (!valid.length) { skipped.push(d.name + ' (all laps junk)'); continue }
    const best = valid.reduce((a, l) => (l.time < a.time ? l : a), valid[0])
    const poss = d.laps.map(l => l.pos).filter(p => p > 0)
    const res = byId.get(d.driver_id) || byNum.get(d.number) || null
    const who = resolve({ driver_id: d.driver_id, driver_fullname: stripMarkers(d.name) })
    const p50 = pctile(flying, 0.5), p95 = pctile(flying, 0.95)
    const k = best.speed && best.time ? best.speed * best.time : null      // mph x sec = 3600 x track length
    rows.push({
      driver: who.name, __how: who.how, __feedName: d.name, car: d.number,
      start_pos: res ? res.start : null, finish_pos: res ? res.finish : null, status: res ? res.status : null,
      fastest_lap_num: best.lap, fastest_time: best.time.toFixed(3), fastest_speed: best.speed,
      arp: poss.length ? +(poss.reduce((a, b) => a + b, 0) / poss.length).toFixed(2) : null,
      cpoms: null, lsp: null,
      p50_time: p50 != null ? +p50.toFixed(3) : null, p95_time: p95 != null ? +p95.toFixed(3) : null,
      p50_speed: k && p50 ? +(k / p50).toFixed(3) : null, p95_speed: k && p95 ? +(k / p95).toFixed(3) : null,
      __laps: d.laps.length, __junk: eligible.length - valid.length, __caution: d.laps.length - eligible.length,
    })
  }
  rows.sort((a, b) => parseFloat(a.fastest_time) - parseFloat(b.fastest_time))
  rows.forEach((r, i) => { r.rank = i + 1 })
  return { rows, skipped }
}


// ---------------------------------------------------------------------------------------------------
// WEEKEND FROM NASCAR FEED (2026-10-03). Operator: "automate the website so I don't have to manually
// upload so much, such as entry lists, qualifying orders". One panel, three series: what the feed has
// for the featured race (entries / draw / qualifying) against what is loaded, and one button per
// series (or all three) that writes it through the operator's session - the same shapeBundle /
// applyBundle the daily cron uses, so a race the cron already loaded shows as loaded here.
export function WeekendFromFeed() {
  const [rows, setRows] = useState([])      // per series: cfg, bundle, loaded counts, status
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const year = new Date().getFullYear()

  const refresh = useCallback(async () => {
    setBusy(true); setMsg('')
    try {
      const [{ data: cfgs }, nx] = await Promise.all([
        supabase.from('featured_weekend').select('series,track_name,track_label,race_number,correlation_year'),
        fetch('/api/nascar-feed?type=next&year=' + year).then(r => r.json()).catch(() => null),
      ])
      const out = []
      for (const series of ['cup', 'oreilly', 'trucks']) {
        const cfg = (cfgs || []).find(c => c.series === series)
        const p = nx && nx.proposed && nx.proposed[series]
        if (!cfg) { out.push({ series, err: 'no Weekend Config' }); continue }
        const raceId = p && p.ok && p.track_name === cfg.track_name ? p.nascar_race_id : null
        const row = { series, cfg, raceId, bundle: null, loaded: {} }
        const yr = cfg.correlation_year || year
        const [{ count: nEntries }, { data: q }] = await Promise.all([
          supabase.from('entry_list').select('id', { count: 'exact', head: true }).eq('series', series).eq('race_year', yr).eq('track_name', cfg.track_name),
          supabase.from('qualifying_results').select('draw_order,qualifying_position,lineup_source').eq('series', series).eq('year', yr).eq('track_name', cfg.track_name).eq('race_number', cfg.race_number || 0),
        ])
        row.loaded = { entries: nEntries || 0, draw: (q || []).filter(r => r.draw_order != null).length, qualifying: (q || []).filter(r => r.qualifying_position != null).length, source: ((q || []).find(r => r.lineup_source) || {}).lineup_source || null }
        if (raceId) {
          try {
            const r = await fetch(`/api/nascar-feed?type=bundle&year=${year}&series=${SERIES_ID[series]}&race=${raceId}`).then(r => r.json())
            row.bundle = r.error ? null : r; if (r.error) row.err = r.error
          } catch (e) { row.err = e.message }
        } else row.err = p && p.ok ? `schedule says ${p.track_label} R${p.race_number} but the Weekend Config is ${cfg.track_label || cfg.track_name} R${cfg.race_number} - sync the config first` : 'race not mapped in the schedule'
        out.push(row)
      }
      setRows(out)
    } catch (e) { setMsg('Error: ' + e.message) }
    setBusy(false)
  }, [year])
  useEffect(() => { refresh() }, [refresh])

  const load = async (which) => {
    setBusy(true); setMsg('')
    const done = []
    for (const row of rows) {
      if (which !== 'all' && row.series !== which) continue
      if (!row.bundle || !row.cfg) continue
      try {
        const ctx = { series: row.series, year: row.cfg.correlation_year || year, race_number: row.cfg.race_number, track_name: row.cfg.track_name }
        const r = await applyBundle(supabase, ctx, row.bundle, {})
        done.push(`${row.series}: entries ${r.entries}, draw ${r.draw}, qualifying ${r.qualifying}${r.lineup_source ? ' (' + r.lineup_source + ')' : ''}${r.skipped.length ? ' - ' + r.skipped.join('; ') : ''}`)
      } catch (e) { done.push(`${row.series}: FAILED - ${e.message}`) }
    }
    setMsg(done.join(' · ') || 'Nothing to load.')
    await refresh()
  }

  const cell = (have, loaded) => <span style={{ color: have >= 20 ? (loaded >= have ? '#4ade80' : '#f5a623') : 'var(--text-muted, #6b7078)' }}>{have >= 20 ? have : '—'} <span style={{ color: 'var(--text-muted, #6b7078)' }}>/ {loaded}</span></span>
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Weekend from NASCAR Feed</h3>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary, #9aa0aa)' }}>
        Entry list, qualifying draw and qualifying result for each series' featured race, straight from NASCAR's weekend feed - no PDF.
        Feed / loaded per piece; amber = the feed has it and we don't. The daily sync (06:00 and 17:00 MT) loads these on its own; this is the "now" button.
        Practice lap times are not in the feed - that upload stays.
      </p>
      <table style={{ fontSize: 13, borderCollapse: 'collapse', marginBottom: 10 }}>
        <thead><tr style={{ color: 'var(--text-muted, #6b7078)', textAlign: 'left' }}><th style={{ padding: '4px 10px 4px 0' }}>Series</th><th style={{ padding: '4px 10px' }}>Race</th><th style={{ padding: '4px 10px' }}>Entries</th><th style={{ padding: '4px 10px' }}>Draw</th><th style={{ padding: '4px 10px' }}>Qualifying</th><th></th></tr></thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.series}>
              <td style={{ padding: '4px 10px 4px 0', fontWeight: 600 }}>{(SERIES_OPTS.find(o => o[0] === row.series) || [])[1] || row.series}</td>
              <td style={{ padding: '4px 10px' }}>{row.cfg ? `${row.cfg.track_label || row.cfg.track_name} R${row.cfg.race_number}` : '—'}{row.bundle && row.bundle.raced ? ' · raced' : ''}</td>
              {row.bundle ? <>
                <td style={{ padding: '4px 10px' }}>{cell(row.bundle.entries.length, row.loaded.entries)}</td>
                <td style={{ padding: '4px 10px' }}>{cell(row.bundle.draw.length, row.loaded.draw)}</td>
                <td style={{ padding: '4px 10px' }}>{cell(row.bundle.qualifying.length, row.loaded.qualifying)}{row.bundle.lineup_source ? <span style={{ color: 'var(--text-muted, #6b7078)' }}> {row.bundle.lineup_source}</span> : null}</td>
                <td style={{ padding: '4px 10px' }}><button disabled={busy || row.bundle.raced} onClick={() => load(row.series)} style={{ fontSize: 12, padding: '4px 10px' }}>Load</button></td>
              </> : <td colSpan={4} style={{ padding: '4px 10px', color: '#f5a623' }}>{row.err || 'loading…'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button disabled={busy || !rows.some(r => r.bundle && !r.bundle.raced)} onClick={() => load('all')} style={{ fontSize: 13, padding: '6px 14px', fontWeight: 600 }}>{busy ? 'Working…' : 'Load all 3 now'}</button>
        <button disabled={busy} onClick={refresh} style={{ fontSize: 13, padding: '6px 14px' }}>Refresh</button>
        {msg && <span style={{ fontSize: 12.5, color: /FAILED|Error/.test(msg) ? '#f87171' : 'var(--text-secondary, #9aa0aa)' }}>{msg}</span>}
      </div>
    </div>
  )
}

export default LoadRaceFromFeed

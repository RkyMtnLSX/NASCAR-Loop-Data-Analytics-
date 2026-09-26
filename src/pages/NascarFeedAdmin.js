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
      .eq('year', parseInt(year, 10)).not('racing_reference_id', 'is', null)
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

      setStatus({ ok: `Loaded ${insertRows.length} drivers for ${race.track_name} ${year} — ${race.total_laps} actual laps (${race.scheduled_laps} scheduled), ${race.total_cautions} cautions.` })
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

export function FeedBackfill() {
  const [series, setSeries] = useState('all')
  const [year, setYear] = useState('all')
  const [dryRun, setDryRun] = useState(true)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState([])
  const [summary, setSummary] = useState(null)
  const stop = React.useRef(false)

  const say = useCallback(line => setLog(l => [...l.slice(-800), line]), [])

  // One pass over one season of one series. Returns its own tally so the
  // all-seasons run can add them up without the inner loop knowing about it.
  async function runOne(sr, yr, tally) {
    const { data: races, error } = await supabase.from('races')
      .select('id, race_number, track_name, race_date, total_laps, nascar_race_id, exhibition')
      .eq('series', sr).eq('year', yr)
      .order('race_number')
    if (error) throw new Error(error.message)
    if (!races || !races.length) { say(`${sr} ${yr}: no races in the registry.`); return }
    await runRaces(races, sr, String(yr), tally)
  }

  async function run() {
    setRunning(true); setLog([]); setSummary(null); stop.current = false
    const tally = { races: 0, skipped: 0, rows: 0, lapsFixed: 0, statusFixed: 0, carMismatch: 0, newNames: 0, nameConflict: 0, exhibitions: 0, cautions: 0, stageLaps: 0 }
    const seriesList = series === 'all' ? Object.keys(SERIES_ID) : [series]
    const yearList = year === 'all' ? ALL_YEARS : [parseInt(year, 10)]
    say(`${dryRun ? 'DRY RUN — nothing will be written.' : 'WRITING.'} `
      + `${seriesList.length} series x ${yearList.length} season(s).`)
    try {
      for (const yr of yearList) {
        for (const sr of seriesList) {
          if (stop.current) break
          say(`--- ${sr} ${yr} ---`)
          await runOne(sr, yr, tally)
        }
        if (stop.current) break
      }
      setSummary(tally)
    } catch (e) {
      say(`ERROR: ${e.message}`)
      setSummary(tally)
    } finally { setRunning(false) }
  }

  async function runRaces(races, series, year, tally) {
    {
      const sched = await feed({ type: 'schedule', year, series: SERIES_ID[series] })
      const byDate = new Map()
      for (const r of sched.races) if (r.race_date) byDate.set(r.race_date, r)

      // Re-read the name index for every season pass: once a season is written,
      // its NASCAR ids are in the table, so later seasons resolve by id rather
      // than by name folding.
      const { data: existingNames } = await fetchAllRows(() => supabase.from('loop_data')
        .select('driver_name, nascar_driver_id').eq('series', series))   // same cap, see above
      const resolve = makeResolver(existingNames || [])

      say(`  ${races.length} races in the registry.`)

      for (const race of races) {
        if (stop.current) { say('Stopped.'); break }
        const label = `R${race.race_number} ${race.track_name}`

        // Exhibitions (the Clash, the Duels, the All-Star race) are excluded from
        // the registry by the era rules, so they carry no loop_data and never
        // will. Counting them as skips made the 2026 Dover All-Star stub look
        // like a failure on every run. Note the practice laps from those weekends
        // ARE kept - practice_laps keys on series/year/track/race_number, not on
        // race_id - so excluding the race does not discard the pace data.
        if (race.exhibition) {
          say(`  --   ${label}: exhibition, excluded by design`)
          tally.exhibitions++
          continue
        }

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

        // POSITION MATCH, with a name cross-check as the real guard.
        //
        // Finish position is unique within a race on both sides, so it is an exact
        // key. It does NOT have to be a bijection: 10 of 436 races are missing a
        // driver from loop_data (n=38 rows but positions running to 39). Those gaps
        // are PRESERVED rather than renumbered - which is exactly what proves the
        // two sides still refer to the same positions - so requiring set equality
        // would skip ten repairable races for no gain.
        //
        // What is required: our positions unique, and a subset of the feed's. Then
        // every row is checked by NAME before anything is written. A renumbering
        // would show up immediately as a wall of name mismatches, and any single
        // row that disagrees is left untouched rather than overwritten.
        const ourPos = new Set(ours.map(r => r.finish_position))
        const feedByPos = new Map(mapped.rows.map(r => [r.finish_position, r]))
        if (ourPos.size !== ours.length) {
          say(`  SKIP ${label}: duplicate finish positions in loop_data`); tally.skipped++; continue
        }
        const missing = [...ourPos].filter(p => !feedByPos.has(p))
        if (missing.length) {
          say(`  SKIP ${label}: ${missing.length} stored position(s) absent from the feed (${missing.slice(0, 6).join(', ')})`)
          tally.skipped++; continue
        }
        if (ourPos.size !== feedByPos.size) {
          say(`    note ${label}: feed has ${feedByPos.size} drivers, loop_data has ${ourPos.size} — enriching the ${ourPos.size} we hold`)
        }

        // The name check is a test of ALIGNMENT, not of spelling.
        //
        // First pass over the real data settled what these disagreements are: all
        // 51 were five drivers whose names we simply store differently - "Andres
        // Perez" for NASCAR's "Andres Perez De Lara" (40 rows), "Garrett Mitchell"
        // and "Cleetus McFarland" for the same person NASCAR itself files under
        // both "Cleetus McFarland" and "Cleetus Mitchell", and so on. NASCAR's own
        // feed is inconsistent here too; pit_stops holds "Andes Perez De Lara #",
        // a NASCAR typo, against the same driver id.
        //
        // Refusing those rows was the wrong response. When 38 of 39 rows agree,
        // the positions are DEMONSTRABLY aligned, and a lone disagreement is a
        // spelling variant rather than a misalignment. So above the threshold the
        // race is skipped (a renumbering would misalign most rows, which is the
        // thing actually worth catching); below it, every row is enriched and each
        // variant is printed.
        //
        // Our stored driver_name is never changed. Only the id and the new columns
        // are attached, and the id is the more trustworthy identifier of the two.
        // Without a weekend feed there are no names to compare, so alignment is
        // checked against the ids already stored from other races instead: the
        // resolver's first rung maps a NASCAR id to the name we hold for it.
        // Rows whose id we have never seen are simply not evidence either way.
        const wkOk = mapped.race.weekendAvailable !== false
        if (!wkOk) {
          say(`    ${label}: NASCAR published no weekend feed for this race — enriching from loopstats only (ids, closing_ps, precision, laps); car numbers, teams, finish status and stage results left as they are`)
        }
        const comparable = ours.filter(row => {
          const f = feedByPos.get(row.finish_position)
          return f.__how === 'id' || (wkOk && f.driver_name)
        })
        if (!wkOk && comparable.length < ours.length * 0.5) {
          say(`  SKIP ${label}: no weekend feed and only ${comparable.length}/${ours.length} drivers have a known id — cannot confirm the rows line up`)
          tally.skipped++; continue
        }
        const nameMismatch = comparable.filter(row =>
          fold(row.driver_name) !== fold(feedByPos.get(row.finish_position).driver_name))
        if (nameMismatch.length > Math.max(2, ours.length * 0.2)) {
          say(`  SKIP ${label}: ${nameMismatch.length}/${ours.length} names disagree at the same finish position — positions are not comparable`)
          tally.skipped++; continue
        }
        if (nameMismatch.length) {
          say(`    ${label}: ${ours.length - nameMismatch.length}/${ours.length} names agree, so positions are aligned; enriching the ${nameMismatch.length} variant(s) too`)
        }

        const merged = ours.map(row => {
          const f = feedByPos.get(row.finish_position)
          if (fold(row.driver_name) !== fold(f.driver_name)) {
            say(`    variant P${row.finish_position}: keeping "${row.driver_name}", NASCAR calls id ${f.nascar_driver_id} "${f.driver_name}"`)
            tally.nameConflict++
          }
          if (f.__how === 'new') tally.newNames++
          if (row.car_number && f.car_number && String(row.car_number) !== String(f.car_number)) {
            tally.carMismatch++
            say(`    car# ${row.driver_name}: stored #${row.car_number}, feed #${f.car_number} — feed wins`)
          }
          // Only count a change that will actually happen. Where there is no
          // weekend feed f.finish_status is undefined and the merge preserves
          // the stored value, so counting it made every re-run report dozens of
          // status changes it was not making.
          if (f.finish_status !== undefined && (row.finish_status || '') !== f.finish_status) tally.statusFixed++
          // `?? row.x` on every weekend-sourced field. mapRace leaves those
          // UNDEFINED when NASCAR published no weekend feed, so a race missing
          // one can never blank a value we already hold. The loopstats-sourced
          // fields below it are always present and always win.
          return {
            ...row,                       // every existing column preserved
            nascar_driver_id: f.nascar_driver_id,
            closing_ps: f.closing_ps,
            team_name: f.team_name ?? row.team_name,
            car_number: f.car_number ?? row.car_number,
            stage1_finish: f.stage1_finish ?? row.stage1_finish,
            stage2_finish: f.stage2_finish ?? row.stage2_finish,
            finish_status: f.finish_status ?? row.finish_status,
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
          // Same rule at race level: send only the keys that are actually known.
          // Laps and green-flag passes survive a missing weekend feed (loopstats
          // carries sch_laps/act_laps, and the passes total is the sum of the
          // driver rows), so the scheduled-vs-actual fix still lands.
          const raceUpdate = {
            nascar_race_id: mapped.race.nascar_race_id,
            total_laps: mapped.race.total_laps,
            scheduled_laps: mapped.race.scheduled_laps,
            green_flag_passes: mapped.race.green_flag_passes,
            total_cautions: mapped.race.total_cautions,
            total_caution_laps: mapped.race.total_caution_laps,
            lead_changes: mapped.race.lead_changes,
            avg_speed: mapped.race.avg_speed,
            margin_of_victory: mapped.race.margin_of_victory,
            margin_of_victory_text: mapped.race.margin_of_victory_text,
            // Stage boundaries. These were added to mapRace but missed here on the
            // first pass, because this update names its keys explicitly while the
            // one-race loader spreads the whole race object — so the loader wrote
            // them and the backfill silently did not. If you add a race-level field
            // to mapRace, add it HERE too.
            stage_1_laps: mapped.race.stage_1_laps,
            stage_2_laps: mapped.race.stage_2_laps,
            stage_3_laps: mapped.race.stage_3_laps,
            stage_4_laps: mapped.race.stage_4_laps,
          }
          Object.keys(raceUpdate).forEach(k => {
            if (raceUpdate[k] === undefined) delete raceUpdate[k]
          })
          const { error: e2 } = await supabase.from('races').update(raceUpdate).eq('id', race.id)
          if (e2) { say(`  FAIL ${label}: races ${e2.message}`); tally.skipped++; continue }

          // Caution timing: the restart lap is what the wreck model has never had.
          const cautions = (mapped.cautions || []).map(c =>
            ({ ...c, race_id: race.id, nascar_race_id: mapped.race.nascar_race_id }))
          await supabase.from('caution_segments').delete().eq('race_id', race.id)
          if (cautions.length) {
            const { error: e3 } = await supabase.from('caution_segments').insert(cautions)
            if (e3) say(`    caution segments failed for ${label}: ${e3.message}`)
            else tally.cautions += cautions.length
          }
          if (raceUpdate.stage_1_laps != null) tally.stageLaps++
        }

        tally.races++; tally.rows += merged.length
        say(`  ok   ${label}: ${merged.length} rows`)
      }
    }
  }

  return (
    <div className="card" style={card}>
      <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Feed Backfill (existing races)</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 14px' }}>
        Adds <code>nascar_driver_id</code>, <code>closing_ps</code>, <code>team_name</code> and
        stage finishes to races already loaded, repairs <code>total_laps</code> (which has been
        holding scheduled laps) and <code>finish_status</code> (which was a laps&lt;90% guess), and
        captures <strong>caution timing</strong> — every caution's start and end lap, so the restart
        lap exists in the database for the first time.
        Rows are matched on finish position, cross-checked by name. A race where names disagree at
        more than 20% of positions is skipped entirely — that is what a renumbering looks like.
        Below that the positions are demonstrably aligned, so spelling variants are enriched too and
        printed; your stored driver names are never changed. Run it dry first.
      </p>

      <div style={grid}>
        <div><label style={labelStyle}>Series</label>
          <select value={series} onChange={e => setSeries(e.target.value)} style={inputStyle} disabled={running}>
            <option value="all">All three</option>
            {SERIES_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
        <div><label style={labelStyle}>Year</label>
          <select value={year} onChange={e => setYear(e.target.value)} style={inputStyle} disabled={running}>
            <option value="all">All seasons (2022-26)</option>
            {ALL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select></div>
        <div><label style={labelStyle}>Mode</label>
          <select value={dryRun ? 'dry' : 'write'} onChange={e => setDryRun(e.target.value === 'dry')} style={inputStyle} disabled={running}>
            <option value="dry">Dry run</option>
            <option value="write">Write</option>
          </select></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className={dryRun ? 'btn btn-secondary' : 'btn'} disabled={running} onClick={run}>
          {running ? 'Running…' : dryRun
            ? `Dry run ${series === 'all' ? 'all series' : series} ${year === 'all' ? '2022-26' : year}`
            : `Write ${series === 'all' ? 'all series' : series} ${year === 'all' ? '2022-26' : year}`}
        </button>
        {running && <button className="btn btn-secondary" onClick={() => { stop.current = true }}>Stop</button>}
      </div>

      {summary && (
        <div style={{ ...mono, padding: '8px 10px', borderRadius: 6, marginBottom: 10, background: 'rgba(34,197,94,0.12)', color: '#86efac' }}>
          {summary.races} races, {summary.rows} rows · total_laps corrected on {summary.lapsFixed} ·
          finish_status changed on {summary.statusFixed} · car# disagreements {summary.carMismatch} ·
          unmatched names {summary.newNames} · name variants kept {summary.nameConflict} · exhibitions excluded {summary.exhibitions} · caution segments {summary.cautions} · stage laps {summary.stageLaps} · skipped {summary.skipped}
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

// ===========================================================================
// FASTEST LAPS FROM THE LAP ARCHIVE (2026-09-26)
// ===========================================================================
//
// Operator: "with our loop data the fastest lap data is loaded via Lap Raptor but can't we just load
// it with the data we already have?" Yes: cf.nascar.com's per-lap archive (lap-times.json, every lap
// of every car, created when the race runs and permanent afterwards) is what the O'Reilly / Trucks
// fastest_laps backfill used on 2026-09-02. Cup was the only series still going through the Lap
// Raptor paste. This panel builds the same fastest_laps rows for any series from the archive:
// fastest lap number / time / speed, rank, P50 / P95 lap time and speed, ARP (mean running
// position), start / finish / status from the weekend feed, driver spelling resolved to loop_data
// through the same resolver Load Race uses. cPOMS / LSP are Lap Raptor-only metrics and are left
// null (cPOMS stopped at the gate 2026-08-29; neither feeds the sim or a page).
//
// JUNK-LAP FILTER (same rule as the backfill and race_watch): a lap under 75% of the driver's median
// lap is a timing-line glitch (2-second "laps" on pit road), not a fastest lap. P50 / P95 are taken
// over flying laps only (75% - 120% of the driver's median) so caution laps do not define the
// distribution. The write goes through /api/load-fastest-laps exactly like the paste loader
// (delete the race's rows, insert the new set) so the two paths cannot drift.

const FL_TYPES = ['Short Track', 'Intermediate', 'Superspeedway', 'Road Course', 'Other']
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

export function FastestLapsFromArchive() {
  const [series, setSeries] = useState('cup')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [candidates, setCandidates] = useState([])
  const [nascarId, setNascarId] = useState('')
  const [tracks, setTracks] = useState([])
  const [trackName, setTrackName] = useState('')
  const [trackType, setTrackType] = useState('Other')
  const [raceName, setRaceName] = useState('')
  const [raceDate, setRaceDate] = useState('')
  const [preview, setPreview] = useState(null)
  const [existing, setExisting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const [lrRule, setLrRule] = useState(true)
  const [resolver, setResolver] = useState(null)

  useEffect(() => {
    supabase.from('tracks').select('name').order('name').then(({ data }) => setTracks((data || []).map(t => t.name)))
  }, [])

  // Re-derive the preview when the rule toggle changes (no refetch).
  useEffect(() => {
    if (!preview || !resolver) return
    const built = buildFastestLapRows(preview.payload, resolver, { lapRaptorRule: lrRule })
    setPreview(p => ({ ...p, ...built }))
  }, [lrRule]) // eslint-disable-line

  async function listRaces() {
    setBusy(true); setStatus(null); setPreview(null); setExisting(null)
    try {
      const j = await feed({ type: 'schedule', year, series: SERIES_ID[series] })
      const today = new Date().toISOString().slice(0, 10)
      const run = (j.races || []).filter(r => r.race_date && r.race_date <= today).reverse()
      setCandidates(run)
      if (run.length) setNascarId(String(run[0].nascar_race_id))
      setStatus({ ok: `${run.length} ${series} races run in ${year} - newest first.` })
    } catch (e) { setStatus({ err: e.message }) } finally { setBusy(false) }
  }

  async function fetchLaps() {
    setBusy(true); setStatus(null); setPreview(null); setExisting(null)
    try {
      const payload = await feed({ type: 'laps', year, series: SERIES_ID[series], race: nascarId })
      const { data: known } = await fetchAllRows(() => supabase.from('loop_data')
        .select('driver_name, nascar_driver_id').eq('series', series))
      const resolve = makeResolver(known || [])
      setResolver(() => resolve)
      const built = buildFastestLapRows(payload, resolve, { lapRaptorRule: lrRule })
      const race = payload.race || {}
      const sched = candidates.find(c => String(c.nascar_race_id) === String(nascarId)) || {}
      const rn = race.race_name || sched.race_name || ''
      const rd = mdy(race.race_date || race.date_scheduled || sched.race_date)
      const feedTrack = race.track_name || sched.track_name || ''
      const canon = tracks.find(t => t === feedTrack) || tracks.find(t => fold(t) === fold(feedTrack))
        || tracks.find(t => fold(feedTrack).includes(fold(t).split(' ')[0]) && fold(t).split(' ')[0].length > 4) || ''
      setRaceName(rn); setRaceDate(rd); setTrackName(canon); setTrackType(guessType(race))
      setPreview({ ...built, payload, feedTrack })
      if (rn && rd) {
        const { data: ex } = await supabase.from('fastest_laps').select('driver, rank, fastest_lap_num, fastest_time, fastest_speed')
          .eq('series', series).eq('race_name', rn).eq('race_date', rd).order('rank').limit(5)
        setExisting(ex || [])
      }
      const nw = built.rows.filter(r => r.__how === 'new')
      setStatus({ ok: `${built.rows.length} drivers from ${payload.lapsTotal.toLocaleString()} laps, ${(payload.cautions || []).length} caution windows` + (built.skipped.length ? `, skipped ${built.skipped.join(', ')}` : '')
        + (nw.length ? `. ${nw.length} name(s) not in loop_data: ${nw.map(r => r.__feedName).join(', ')}` : '. Every name matched loop_data.')
        + (canon ? '' : ` Track "${feedTrack}" is not in the tracks table - pick it below.`) })
    } catch (e) { setStatus({ err: e.message }) } finally { setBusy(false) }
  }

  async function write() {
    if (!preview || !raceName || !raceDate || !trackName) { setStatus({ err: 'Race name, date and a canonical track are required.' }); return }
    setBusy(true); setStatus(null)
    try {
      const rows = preview.rows.map(({ __how, __feedName, __laps, __junk, __caution, ...r }) => r)
      const res = await fetch('/api/load-fastest-laps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series, year: parseInt(year, 10), track_type: trackType, race_name: raceName, race_date: raceDate, track: trackName, rows }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setStatus({ ok: `${j.message} Fastest: ${j.topDriver} ${j.topSpeed ? j.topSpeed + ' mph' : ''}.` })
      setExisting(null)
    } catch (e) { setStatus({ err: e.message }) } finally { setBusy(false) }
  }

  const top = preview ? preview.rows.slice(0, 5) : []
  return (
    <div className="card" style={card}>
      <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Fastest Laps from the Lap Archive</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 14px' }}>
        Builds the <code>fastest_laps</code> rows for a race from NASCAR's per-lap archive (every lap of every car -
        the source the O'Reilly / Trucks history came from) instead of the Lap Raptor paste. Fastest lap, rank,
        P50 / P95 pace and average running position; start / finish / status from the weekend feed. The archive
        exists only once the race has run. Loading a race that is already stored replaces its rows.
      </p>
      <div style={grid}>
        <div><label style={labelStyle}>Series</label>
          <select value={series} onChange={e => { setSeries(e.target.value); setCandidates([]); setPreview(null) }} style={inputStyle}>
            {SERIES_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
        <div><label style={labelStyle}>Year</label>
          <input value={year} onChange={e => setYear(e.target.value)} style={inputStyle} /></div>
        <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Race</label>
          <select value={nascarId} onChange={e => setNascarId(e.target.value)} style={inputStyle} disabled={!candidates.length}>
            {!candidates.length && <option value="">— list races first —</option>}
            {candidates.map(c => <option key={c.nascar_race_id} value={c.nascar_race_id}>{c.race_date} · {c.race_name} · {c.track_name}</option>)}
          </select></div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" disabled={busy} onClick={listRaces}>List races</button>
        <button className="btn btn-secondary" disabled={busy || !nascarId} onClick={fetchLaps}>{busy ? 'Working…' : 'Fetch laps'}</button>
        {preview && <button className="btn" disabled={busy} onClick={write}>Load {preview.rows.length} drivers into fastest_laps</button>}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }} title="Lap Raptor drops every lap numbered inside a caution window. For lap-down cars that discards real green laps (their lap N runs while the leaders are on N+1), but it is the rule the stored history was built on. Off = the raw archive.">
          <input type="checkbox" checked={lrRule} onChange={e => setLrRule(e.target.checked)} /> Lap Raptor-compatible (drop laps numbered under caution)
        </label>
      </div>
      {preview && (
        <div style={grid}>
          <div><label style={labelStyle}>Race name</label><input value={raceName} onChange={e => setRaceName(e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Race date (MM/DD/YYYY)</label><input value={raceDate} onChange={e => setRaceDate(e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Track (canonical)</label>
            <select value={trackName} onChange={e => setTrackName(e.target.value)} style={inputStyle}>
              <option value="">-- select track --</option>{tracks.map(t => <option key={t} value={t}>{t}</option>)}
            </select></div>
          <div><label style={labelStyle}>Track type</label>
            <select value={trackType} onChange={e => setTrackType(e.target.value)} style={inputStyle}>
              {FL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select></div>
        </div>
      )}
      {status && status.ok && <div style={{ ...mono, padding: '8px 10px', borderRadius: 6, marginBottom: 10, background: 'rgba(34,197,94,0.12)', color: '#86efac' }}>{status.ok}</div>}
      {status && status.err && <div style={{ ...mono, padding: '8px 10px', borderRadius: 6, marginBottom: 10, background: 'rgba(239,68,68,0.12)', color: '#fca5a5' }}>{status.err}</div>}
      {preview && (
        <div style={{ display: 'grid', gridTemplateColumns: existing && existing.length ? '1fr 1fr' : '1fr', gap: 14 }}>
          <div>
            <div style={labelStyle}>From the archive (top 5 of {preview.rows.length})</div>
            <pre style={{ ...mono, background: 'var(--bg-elevated)', padding: 10, borderRadius: 6, margin: 0, overflow: 'auto' }}>
              {top.map(r => `${String(r.rank).padStart(2)}  ${r.driver.padEnd(22)} #${String(r.car).padEnd(3)} lap ${String(r.fastest_lap_num).padStart(3)}  ${r.fastest_time}s${r.fastest_speed ? '  ' + r.fastest_speed + ' mph' : ''}  P50 ${r.p50_time}  ARP ${r.arp}  ${r.start_pos != null ? 'P' + r.start_pos + '->' + r.finish_pos : ''}${r.__junk ? '  (' + r.__junk + ' junk laps dropped)' : ''}`).join('\n')}
            </pre>
          </div>
          {existing && existing.length > 0 && (
            <div>
              <div style={labelStyle}>Already stored for this race (will be replaced)</div>
              <pre style={{ ...mono, background: 'var(--bg-elevated)', padding: 10, borderRadius: 6, margin: 0, overflow: 'auto' }}>
                {existing.map(r => `${String(r.rank).padStart(2)}  ${(r.driver || '').padEnd(22)} lap ${String(r.fastest_lap_num).padStart(3)}  ${r.fastest_time}s${r.fastest_speed ? '  ' + r.fastest_speed + ' mph' : ''}`).join('\n')}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default LoadRaceFromFeed

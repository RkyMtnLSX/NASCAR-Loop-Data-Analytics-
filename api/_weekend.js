// api/_weekend.js - propose each series' Weekend Config from NASCAR's schedule feed (2026-10-01).
//
// Operator: "automate the pitboard weekend configurations so I don't have to do it every week".
// race_list_basic.json carries, per race: track_name, date_scheduled, scheduled_laps, stage_1_laps,
// stage_2_laps, race_type_id (1 = points race). From that: race_number = count of points races through
// the race, total_laps = scheduled_laps, stage1 = stage_1_laps, stage2 = stage_1 + stage_2 (the config
// stores stage END laps), track = the tracks-table name (NASCAR's spelling mapped below), correlation
// label from the tracks table. Verified against the hand-set Kansas week: cup R30 267 80/165, trucks
// R20 134 30/54, O'Reilly R27 200 45/90.
//
// Shared by api/nascar-feed.js (type=next, the Weekend Config "Use schedule" button) and
// api/weekend-sync.js (the Monday cron). CommonJS because Vercel functions are.

const NASCAR = 'https://cf.nascar.com'
const SERIES = { 1: 'cup', 2: 'oreilly', 3: 'trucks' }
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'application/json', Referer: 'https://www.nascar.com/',
}

// NASCAR's schedule spelling -> the tracks-table (canonical) spelling. Anything not listed must match
// exactly (case-insensitive) or the series is reported unmapped and left alone.
const ALIAS = {
  'world wide technology raceway': 'Gateway',
  'circuit of the americas': 'Circuit of the Americas',
  'grand prix of st. petersburg': 'Streets of St. Petersburg',
  'san diego street course': 'Naval Base Coronado',
  'chicago street race': 'Chicago Street Course',
  'chicago street course': 'Chicago Street Course',
  'autodromo hermanos rodriguez': 'Autodromo Hermanos Rodriguez',
}

function canonTrack(race, trackNames) {
  const nm = String(race.track_name || '').trim()
  const low = nm.toLowerCase()
  const rn = String(race.race_name || '').toLowerCase()
  // Same NASCAR track name, two layouts: the race name / lap count tells them apart.
  if (low === 'charlotte motor speedway' && (/roval/.test(rn) || (race.scheduled_laps && race.scheduled_laps < 150))) return 'Charlotte Motor Speedway Road Course'
  if (low === 'indianapolis motor speedway' && /grand prix|road/.test(rn)) return 'Indianapolis Grand Prix Circuit'
  if (low === 'daytona international speedway' && /road/.test(rn)) return 'Daytona International Speedway Road Course'
  if (ALIAS[low]) return ALIAS[low]
  const hit = trackNames.find(t => t.toLowerCase() === low)
  return hit || null
}

const trackLabel = name => name.replace(/ Raceway| Motor Speedway| Superspeedway| International Speedway| Speedway/g, '').trim()

async function fetchSchedule(year) {
  const r = await fetch(`${NASCAR}/cacher/${year}/race_list_basic.json`, { headers: HEADERS })
  if (r.status !== 200) throw new Error(`NASCAR schedule HTTP ${r.status}`)
  return r.json()
}

// tracks: [{name, correlation_group_label}]. now: Date (tests pass one). Returns {cup, oreilly, trucks}
// each {ok, series, nascar_race_id, race_name, race_date, track_name, track_label, correlation_label,
// race_number, total_laps, stage1_laps, stage2_laps, feed_track, reason}.
function propose(schedule, tracks, now) {
  const names = tracks.map(t => t.name)
  const corr = {}; tracks.forEach(t => { corr[t.name] = t.correlation_group_label || '' })
  // A race stays "this weekend" until 36h after its scheduled start, so Sunday night / Monday morning
  // still point at the race just run (the replay + post-race loads need that config), and Monday noon on
  // points at the next one.
  const cutoff = new Date((now || new Date()).getTime() - 36 * 3600 * 1000)
  const out = {}
  for (const [sid, series] of Object.entries(SERIES)) {
    const list = (schedule[`series_${sid}`] || []).slice().sort((a, b) => String(a.date_scheduled).localeCompare(String(b.date_scheduled)))
    let n = 0, pick = null, pickN = null
    for (const r of list) {
      if (r.race_type_id === 1) n++
      if (!pick && new Date(r.date_scheduled) >= cutoff) { pick = r; pickN = r.race_type_id === 1 ? n : null }
    }
    if (!pick) { out[series] = { ok: false, series, reason: 'no upcoming race on the schedule' }; continue }
    const track = canonTrack(pick, names)
    const s1 = Number(pick.stage_1_laps) || null, s2 = Number(pick.stage_2_laps) || null
    out[series] = {
      ok: !!track && pick.race_type_id === 1,
      series, nascar_race_id: pick.race_id, race_name: pick.race_name,
      race_date: String(pick.date_scheduled || '').slice(0, 10),
      feed_track: pick.track_name,
      track_name: track, track_label: track ? trackLabel(track) : null,
      correlation_label: track ? (corr[track] || '') : null,
      race_number: pickN, total_laps: Number(pick.scheduled_laps) || null,
      stage1_laps: s1, stage2_laps: s1 && s2 ? s1 + s2 : null,
      reason: !track ? `track "${pick.track_name}" is not in the tracks table` : pick.race_type_id !== 1 ? 'exhibition race (not a points round)' : null,
    }
  }
  return out
}

module.exports = { fetchSchedule, propose, canonTrack, SERIES }

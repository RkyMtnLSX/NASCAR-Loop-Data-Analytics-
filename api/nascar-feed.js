// api/nascar-feed.js — read-only proxy for NASCAR's public JSON feeds.
//
// WHY THIS EXISTS AS A SERVERLESS FUNCTION
// The browser cannot fetch cf.nascar.com directly (no CORS headers), and this
// deployment CAN reach it (measured 107ms from iad1 on 2026-08-30). So the
// function fetches and shapes; the BROWSER still does every database write,
// through the operator's own authenticated Supabase session, exactly as the
// Racing Reference paste path did.
//
// That split is deliberate. This endpoint holds no service-role key, performs
// no writes, and touches no table, so RLS keeps enforcing what it always has
// and no new privileged write surface appears on the public internet.
//
// NOT AN OPEN PROXY: every URL is built from a fixed template with
// range-checked integer parameters, so it can only ever fetch a NASCAR
// schedule, loopstats, or weekend-feed path.
//
//   ?type=schedule&year=2026[&series=1][&date=2026-08-29]
//       The season's races. With date, the ±1-day match is resolved here so
//       the browser never has to guess a NASCAR race id.
//
//   ?type=race&year=2026&series=1&race=5623
//       Everything needed to load one race: the race-level row, the stage
//       results, and the driver rows with loopstats joined to weekend results
//       ON driver_id — an integer join, no name matching anywhere.
//
// Verified against cup 2026 R26 on 2026-08-30: all 15 loopstats fields
// reproduce loop_data exactly, car_number 40/40, qualifying_position 40/40,
// qualifying_speed exact, and the race-level cautions / caution laps / lead
// changes / average speed all match what the paste had stored.

const NASCAR = 'https://cf.nascar.com'
const SERIES_NAME = { 1: 'cup', 2: 'oreilly', 3: 'trucks' }

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'application/json',
  Referer: 'https://www.nascar.com/',
}

function intInRange(v, lo, hi) {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  if (!Number.isInteger(n) || n < lo || n > hi) return null
  return n
}

async function getJson(url) {
  const r = await fetch(url, { headers: HEADERS })
  if (r.status !== 200) {
    const e = new Error(`NASCAR returned HTTP ${r.status}`)
    e.status = r.status
    e.url = url
    throw e
  }
  return r.json()
}

const dayDiff = (a, b) =>
  Math.abs((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000)

// ---------------------------------------------------------------- schedule

async function schedule(res, year, series, date) {
  const data = await getJson(`${NASCAR}/cacher/${year}/race_list_basic.json`)

  const races = []
  for (const [key, list] of Object.entries(data || {})) {
    const sid = Number(String(key).split('_')[1])
    if (!SERIES_NAME[sid] || !Array.isArray(list)) continue
    if (series && sid !== series) continue
    for (const r of list) {
      if (!r.race_id) continue
      races.push({
        nascar_race_id: r.race_id,
        series_id: sid,
        series: SERIES_NAME[sid],
        race_name: r.race_name,
        track_name: r.track_name,
        race_date: String(r.race_date || r.date_scheduled || '').slice(0, 10),
      })
    }
  }
  races.sort((a, b) => (a.race_date || '').localeCompare(b.race_date || ''))

  let matches = null
  if (date) {
    matches = races.filter(r => r.race_date && dayDiff(r.race_date, date) <= 1)
  }

  return res.status(200).json({
    type: 'schedule', year, series: series || null, date: date || null,
    count: races.length,
    // Exactly one match is the only safe answer; the caller must handle 0 or 2+
    // rather than silently taking the first.
    match: matches && matches.length === 1 ? matches[0] : null,
    matches,
    races,
  })
}

// ---------------------------------------------------------------- one race

const LOOP_FIELDS = [
  'start_ps', 'mid_ps', 'ps', 'best_ps', 'worst_ps', 'avg_ps', 'passing_diff',
  'passes_gf', 'passed_gf', 'quality_passes', 'fast_laps', 'top15_laps',
  'lead_laps', 'laps', 'rating', 'closing_ps', 'closing_laps_diff',
]

const RACE_FIELDS = [
  'race_id', 'race_name', 'race_season', 'series_id', 'race_type_id',
  'track_id', 'track_name', 'race_date', 'date_scheduled',
  'scheduled_laps', 'actual_laps', 'scheduled_distance', 'actual_distance',
  'number_of_cautions', 'number_of_caution_laps', 'number_of_lead_changes',
  'number_of_leaders', 'number_of_cars_in_field',
  'average_speed', 'margin_of_victory', 'total_race_time', 'restrictor_plate',
  'pole_winner_driver_id', 'pole_winner_speed',
  'stage_1_laps', 'stage_2_laps', 'stage_3_laps', 'stage_4_laps',
]

const RESULT_FIELDS = [
  'driver_id', 'driver_fullname', 'car_number', 'official_car_number',
  'team_id', 'team_name', 'owner_fullname', 'crew_chief_fullname', 'car_make',
  'starting_position', 'finishing_position', 'finishing_status', 'disqualified',
  'laps_completed', 'laps_led', 'times_led', 'diff_laps', 'diff_time',
  'qualifying_order', 'qualifying_position', 'qualifying_speed',
  'points_earned', 'playoff_points_earned',
]

const pick = (obj, keys) =>
  Object.fromEntries(keys.map(k => [k, obj?.[k] === undefined ? null : obj[k]]))

async function race(res, year, series, raceId) {
  const [loopRaw, weekRaw] = await Promise.all([
    getJson(`${NASCAR}/loopstats/prod/${year}/${series}/${raceId}.json`),
    getJson(`${NASCAR}/cacher/${year}/${series}/${raceId}/weekend-feed.json`),
  ])

  const loopRec = Array.isArray(loopRaw) ? loopRaw[0] : loopRaw
  const loopDrivers = loopRec?.drivers || []
  if (!loopDrivers.length) {
    return res.status(502).json({ error: 'loopstats had no drivers — the race may not be scored yet' })
  }

  // LOOPSTATS IS THE SPINE; THE WEEKEND FEED IS AN ENRICHMENT.
  //
  // NASCAR publishes some races with complete loopstats and an EMPTY weekend
  // feed - the file exists but weekend_race and weekend_runs are both null.
  // Confirmed on cup 2025 R34 Talladega (loopstats: 40 drivers; weekend feed:
  // nulls), oreilly 2024 R7 Martinsville and trucks 2022 R5 Martinsville.
  //
  // Refusing those races would forfeit everything loopstats carries - the 15
  // loop columns, closing_ps, the driver id, full-precision average position
  // and rating - to gain nothing. So build from loopstats first and merge the
  // weekend results in only if they exist. weekendAvailable tells the caller
  // which fields it may trust; the backfill uses it to avoid nulling stored
  // values it cannot re-source.
  const wkRace = weekRaw?.weekend_race?.[0] || null
  const results = (wkRace && wkRace.results) || []
  const weekendAvailable = results.length > 0

  const resultByDriver = new Map()
  const dnq = []
  for (const r of results) {
    // A DNQ carries a qualifying position but starts and finishes at 0. It has
    // no loop row and must not become one — this is the Sutton/Baldwin case
    // made visible: entered, failed to qualify, sometimes raced another car.
    if (!r.finishing_position) { dnq.push(pick(r, RESULT_FIELDS)); continue }
    resultByDriver.set(r.driver_id, r)
  }

  const drivers = loopDrivers.map(l => {
    const r = resultByDriver.get(l.driver_id)
    if (r) resultByDriver.delete(l.driver_id)
    return { ...pick(r || {}, RESULT_FIELDS), driver_id: l.driver_id, loop: pick(l, LOOP_FIELDS) }
  }).sort((a, b) => a.loop.ps - b.loop.ps)

  // Anyone the weekend feed scored but loopstats did not. Non-empty means the
  // two feeds disagree about who was in the race — worth stopping for.
  const weekendOnly = [...resultByDriver.values()].map(r => pick(r, RESULT_FIELDS))

  // Laps come from loopstats when the weekend feed is absent, so the
  // scheduled-vs-actual correction still lands for these races.
  const race = wkRace ? pick(wkRace, RACE_FIELDS) : pick({}, RACE_FIELDS)
  race.race_id = raceId
  if (race.race_name == null) race.race_name = loopRec.race_name ?? null
  if (race.series_id == null) race.series_id = loopRec.series_id ?? series
  if (race.scheduled_laps == null) race.scheduled_laps = loopRec.sch_laps ?? null
  if (race.actual_laps == null) race.actual_laps = loopRec.act_laps ?? null

  return res.status(200).json({
    type: 'race',
    year, series_id: series, series: SERIES_NAME[series], nascar_race_id: raceId,
    weekendAvailable,
    race,
    stageResults: (wkRace && wkRace.stage_results) || [],
    cautionSegments: (wkRace && wkRace.caution_segments) || [],
    raceLeaders: (wkRace && wkRace.race_leaders) || [],
    drivers,
    dnq,
    join: {
      matched: drivers.length,
      withWeekendRow: drivers.filter(d => d.finishing_position != null).length,
      weekendOnly: weekendOnly.length,
      weekendOnlySample: weekendOnly.slice(0, 5),
    },
  })
}

// ---------------------------------------------------------------- handler

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  const q = req.query || {}
  const year = intInRange(q.year, 2015, 2030)
  const series = intInRange(q.series, 1, 3)
  const raceId = intInRange(q.race, 1, 999999)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q.date || '') ? q.date : undefined

  if (year === null || series === null || raceId === null) {
    return res.status(400).json({ error: 'year 2015-2030, series 1-3, race 1-999999 — integers only' })
  }
  if (q.date && !date) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' })
  }
  if (year === undefined) return res.status(400).json({ error: 'year is required' })

  try {
    if (q.type === 'schedule') return await schedule(res, year, series, date)
    if (q.type === 'race') {
      if (series === undefined || raceId === undefined) {
        return res.status(400).json({ error: 'type=race needs series and race' })
      }
      return await race(res, year, series, raceId)
    }
    return res.status(400).json({ error: "type must be 'schedule' or 'race'" })
  } catch (err) {
    return res.status(err.status === 404 ? 404 : 502).json({
      error: err.message, url: err.url || null,
    })
  }
}

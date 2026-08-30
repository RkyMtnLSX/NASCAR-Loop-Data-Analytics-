// api/probe-nascar.js — one-off diagnostic. READ-ONLY. No database, no writes.
//
// Two modes.
//
//   (no params)            — single-race reachability check. Answered 2026-08-30:
//                            Vercel reaches cf.nascar.com in ~107ms, so
//                            api/load-race.js can fetch loopstats directly and
//                            loop-data ingestion stays serverless.
//
//   ?mode=sweep&year=YYYY  — coverage sweep. Pulls the season's race list and
//                            probes loopstats/prod/{year}/{series}/{race}.json
//                            for every race in all three series, plus one
//                            weekend-feed per series to confirm the
//                            driver_id -> car_number mapping exists.
//
// The sweep is what decides whether we can backfill nascar driver_id across all
// 16,130 existing loop_data rows (integer join works historically) or only from
// here forward (the name-match layer has to stay for older races).
//
// Safety, because this is a public endpoint on a live site:
//   * Not an open proxy. Every URL is built from a fixed template with
//     range-checked integer parameters, so it can only ever fetch a NASCAR
//     loopstats / race-list / weekend-feed path.
//   * Returns metadata only — counts, statuses, field names, one sample driver
//     object — never a feed body.
//   * Reads no environment variables and touches no Supabase table.
//
// Delete this file once the ingestion decision is made.

const DEFAULTS = { year: 2026, series: 1, race: 5623 } // cup 2026 R26 Daytona
const SERIES_NAME = { 1: 'cup', 2: 'oreilly', 3: 'trucks' }

// The 15 fields verified on 2026-08-30 to reproduce loop_data exactly for cup R26.
const CORE_FIELDS = [
  'start_ps', 'mid_ps', 'ps', 'best_ps', 'worst_ps', 'avg_ps', 'passing_diff',
  'passes_gf', 'passed_gf', 'quality_passes', 'fast_laps', 'top15_laps',
  'lead_laps', 'laps', 'rating',
]

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const HEADERS = { 'User-Agent': UA, Accept: 'application/json', Referer: 'https://www.nascar.com/' }

// Serverless wall clock. Leave room to serialise and return a partial answer
// rather than being killed mid-sweep with nothing to show for it.
const BUDGET_MS = 8500
const CONCURRENCY = 12

function intInRange(v, lo, hi, dflt) {
  if (v === undefined || v === null || v === '') return dflt
  const n = Number(v)
  if (!Number.isInteger(n) || n < lo || n > hi) return null
  return n
}

async function getJson(url) {
  try {
    const r = await fetch(url, { headers: HEADERS })
    if (r.status !== 200) return { data: null, status: r.status }
    try {
      return { data: await r.json(), status: 200 }
    } catch {
      return { data: null, status: 'not-json' }
    }
  } catch (err) {
    return { data: null, status: `${err.name}:${err.cause?.code || err.message}` }
  }
}

// Run tasks with a concurrency cap, stopping cleanly when the budget runs out.
async function pool(items, limit, deadline, worker) {
  const out = []
  let i = 0
  let stopped = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const idx = i++
      if (idx >= items.length) return
      if (Date.now() > deadline) {
        stopped++
        return
      }
      out.push(await worker(items[idx]))
    }
  })
  await Promise.all(runners)
  return { out, truncated: stopped > 0 }
}

// ---------------------------------------------------------------- probes

async function probeLoopstats(year, series, race) {
  const url = `https://cf.nascar.com/loopstats/prod/${year}/${series}/${race}.json`
  const { data, status } = await getJson(url)
  if (!data) return { ok: false, status }
  const rec = Array.isArray(data) ? data[0] : data
  const drivers = (rec && rec.drivers) || []
  if (!drivers.length) return { ok: false, status: 'empty' }
  const d0 = drivers[0]
  return {
    ok: true,
    n: drivers.length,
    hasDriverId: 'driver_id' in d0,
    hasClosingPs: 'closing_ps' in d0,
    missingCore: CORE_FIELDS.filter(f => !(f in d0)),
    extraKeys: Object.keys(d0).filter(
      k => !CORE_FIELDS.includes(k) &&
           !['driver_id', 'closing_ps', 'closing_laps_diff'].includes(k)
    ),
  }
}

// Any object anywhere in the weekend feed carrying BOTH a driver id and a car
// number. That pairing is the whole reason to switch feeds, so find it rather
// than assume where NASCAR puts it.
function findDriverMap(node, path = '', hits = {}, depth = 0) {
  if (depth > 8 || Object.keys(hits).length > 3) return hits
  if (Array.isArray(node)) {
    for (const v of node.slice(0, 60)) findDriverMap(v, `${path}[]`, hits, depth + 1)
  } else if (node && typeof node === 'object') {
    const k = Object.keys(node)
    const idKey = k.includes('driver_id') ? 'driver_id'
      : k.includes('nascar_driver_id') ? 'nascar_driver_id' : null
    if (idKey && k.includes('car_number')) {
      const nameKeys = k.filter(x =>
        ['driver_name', 'full_name', 'first_name', 'last_name'].includes(x))
      hits[path || '/'] = {
        idKey,
        nameKeys,
        // Every key on the matched object. We need to know whether the feed
        // carries a name at all (for cross-checking the driver_id backfill)
        // and whether it carries team/manufacturer, which loop_data lacks.
        allKeys: k.sort(),
        sample: Object.fromEntries(
          [idKey, 'car_number', ...nameKeys].map(x => [x, node[x]])),
      }
      return hits
    }
    for (const kk of k) findDriverMap(node[kk], `${path}/${kk}`, hits, depth + 1)
  }
  return hits
}

async function probeWeekend(year, series, race) {
  const url = `https://cf.nascar.com/cacher/${year}/${series}/${race}/weekend-feed.json`
  const { data, status } = await getJson(url)
  if (!data) return { ok: false, status }
  const hits = findDriverMap(data)
  const paths = Object.keys(hits)
  if (!paths.length) {
    return {
      ok: true, mapping: false,
      topKeys: Array.isArray(data) ? 'list' : Object.keys(data).slice(0, 12),
    }
  }
  return { ok: true, mapping: true, path: paths[0], ...hits[paths[0]] }
}

// ---------------------------------------------------------------- handlers

async function sweep(res, year, deadline) {
  const listUrl = `https://cf.nascar.com/cacher/${year}/race_list_basic.json`
  const { data: list, status } = await getJson(listUrl)
  if (!list) {
    return res.status(200).json({ mode: 'sweep', year, error: `race list unavailable [${status}]`, url: listUrl })
  }

  // race_list_basic is keyed "series_1" / "series_2" / "series_3".
  const bySeries = {}
  for (const [key, races] of Object.entries(list)) {
    const sid = Number(String(key).split('_')[1])
    if (![1, 2, 3].includes(sid) || !Array.isArray(races)) continue
    bySeries[sid] = races
      .map(r => ({
        race_id: r.race_id,
        track: r.track_name,
        name: r.race_name,
        date: String(r.race_date || r.date_scheduled || '').slice(0, 10),
      }))
      .filter(r => r.race_id)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  }

  const out = {}
  let anyTruncated = false

  for (const sid of [1, 2, 3]) {
    const races = bySeries[sid] || []
    if (!races.length) { out[SERIES_NAME[sid]] = { races: 0 }; continue }

    // One weekend-feed per series/season proves the id -> car_number mapping.
    const mid = races[Math.floor(races.length / 2)]
    const wk = await probeWeekend(year, sid, mid.race_id)

    const { out: results, truncated } = await pool(
      races, CONCURRENCY, deadline,
      async r => ({ r, p: await probeLoopstats(year, sid, r.race_id) })
    )
    anyTruncated = anyTruncated || truncated

    const have = results.filter(x => x.p.ok)
    const missing = results.filter(x => !x.p.ok)
    const shapeIssues = have.filter(x => x.p.missingCore.length || !x.p.hasDriverId)

    out[SERIES_NAME[sid]] = {
      racesInSeason: races.length,
      probed: results.length,
      have: have.length,
      withClosingPs: have.filter(x => x.p.hasClosingPs).length,
      withDriverId: have.filter(x => x.p.hasDriverId).length,
      driverCountRange: have.length
        ? [Math.min(...have.map(x => x.p.n)), Math.max(...have.map(x => x.p.n))]
        : null,
      shapeIssues: shapeIssues.slice(0, 5).map(x => ({
        date: x.r.date, track: x.r.track,
        missingCore: x.p.missingCore, hasDriverId: x.p.hasDriverId,
      })),
      extraFieldsSeen: [...new Set(have.flatMap(x => x.p.extraKeys))].sort(),
      missing: missing.slice(0, 8).map(x => ({
        date: x.r.date, track: x.r.track, name: x.r.name,
        race_id: x.r.race_id, status: x.p.status,
      })),
      missingCount: missing.length,
      weekendFeed: { ...wk, probedRace: mid.race_id, track: mid.track },
    }
  }

  return res.status(200).json({
    mode: 'sweep',
    year,
    truncated: anyTruncated,
    note: anyTruncated
      ? 'Serverless budget hit — some races were not probed. Re-run; counts below are partial.'
      : 'Complete sweep of every race in the season list.',
    series: out,
  })
}

async function single(res, year, series, race) {
  const url = `https://cf.nascar.com/loopstats/prod/${year}/${series}/${race}.json`
  const started = Date.now()

  let resp
  try {
    resp = await fetch(url, { headers: HEADERS })
  } catch (err) {
    return res.status(200).json({
      reachable: false,
      verdict: 'BLOCKED — Vercel cannot open a connection to cf.nascar.com',
      url, ms: Date.now() - started,
      error: `${err.name}: ${err.message}`,
      cause: err.cause ? String(err.cause.code || err.cause.message || err.cause) : null,
      next: 'Loop-data ingestion moves to the Python loader on the local machine.',
    })
  }

  const ms = Date.now() - started
  if (!resp.ok) {
    return res.status(200).json({
      reachable: true, httpOk: false, url, status: resp.status, ms,
      verdict: `Connection SUCCEEDED but NASCAR answered HTTP ${resp.status}`,
      note: resp.status === 403
        ? 'The network path works and NASCAR is refusing the request itself — ' +
          'likely datacenter-IP filtering. Blocked for ingestion, but a ' +
          'different failure than no route.'
        : 'Check that year/series/race identify a real race.',
    })
  }

  let body
  try { body = await resp.json() } catch {
    return res.status(200).json({
      reachable: true, httpOk: true, parsed: false, url, ms,
      verdict: 'Reached NASCAR and got 200, but the body was not JSON',
    })
  }

  const rec = Array.isArray(body) ? body[0] : body
  const drivers = (rec && rec.drivers) || []
  const first = drivers[0] || {}

  return res.status(200).json({
    reachable: true, httpOk: true, parsed: true,
    verdict: 'REACHABLE — api/load-race.js can fetch loopstats directly',
    url, ms,
    race: {
      race_id: rec && rec.race_id, race_name: rec && rec.race_name,
      series_id: rec && rec.series_id,
      sch_laps: rec && rec.sch_laps, act_laps: rec && rec.act_laps,
    },
    driverCount: drivers.length,
    driverFields: Object.keys(first).sort(),
    hasDriverId: 'driver_id' in first,
    hasClosingPs: 'closing_ps' in first,
    missingCore: CORE_FIELDS.filter(f => !(f in first)),
    next: 'Swap the fetch in api/load-race.js; keep our driver_name spellings.',
  })
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')

  const q = req.query || {}
  const year = intInRange(q.year, 2015, 2030, DEFAULTS.year)
  const series = intInRange(q.series, 1, 3, DEFAULTS.series)
  const race = intInRange(q.race, 1, 999999, DEFAULTS.race)

  if (year === null || series === null || race === null) {
    return res.status(400).json({
      error: 'year 2015-2030, series 1-3, race 1-999999 — integers only',
    })
  }

  const deadline = Date.now() + BUDGET_MS
  if (q.mode === 'sweep') return sweep(res, year, deadline)
  return single(res, year, series, race)
}

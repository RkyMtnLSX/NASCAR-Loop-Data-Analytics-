// api/probe-nascar.js — one-off diagnostic. READ-ONLY. No database, no writes.
//
// Answers exactly one question: can a Vercel serverless function reach
// cf.nascar.com? That decides where loop-data ingestion lives.
//
//   reachable  -> api/load-race.js swaps its fetch from Racing Reference to
//                 loopstats and everything else about the Admin flow stays.
//   blocked    -> loop-data ingestion moves into the Python loader on the
//                 operator's machine and becomes a .bat like the rest of the
//                 pipeline (one place, one key, one button).
//
// Safety notes, because this is a public endpoint on a live site:
//   * It is NOT an open proxy. The URL is built from a fixed template and the
//     three parameters are range-checked integers, so it can only ever fetch
//     https://cf.nascar.com/loopstats/prod/<year>/<series>/<race>.json.
//   * It returns metadata only — status, latency, driver count, field names —
//     never the feed body.
//   * It reads no environment variables and touches no Supabase table.
//
// Delete this file once the decision is made.

const DEFAULTS = { year: 2026, series: 1, race: 5623 } // cup 2026 R26 Daytona

function intInRange(v, lo, hi, dflt) {
  if (v === undefined || v === null || v === '') return dflt
  const n = Number(v)
  if (!Number.isInteger(n) || n < lo || n > hi) return null
  return n
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')

  const year = intInRange(req.query?.year, 2015, 2030, DEFAULTS.year)
  const series = intInRange(req.query?.series, 1, 3, DEFAULTS.series)
  const race = intInRange(req.query?.race, 1, 999999, DEFAULTS.race)

  if (year === null || series === null || race === null) {
    return res.status(400).json({
      error: 'year 2015-2030, series 1-3, race 1-999999 — integers only',
    })
  }

  const url = `https://cf.nascar.com/loopstats/prod/${year}/${series}/${race}.json`
  const started = Date.now()

  let resp
  try {
    resp = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'application/json',
        Referer: 'https://www.nascar.com/',
      },
    })
  } catch (err) {
    return res.status(200).json({
      reachable: false,
      verdict: 'BLOCKED — Vercel cannot open a connection to cf.nascar.com',
      url,
      ms: Date.now() - started,
      error: `${err.name}: ${err.message}`,
      cause: err.cause ? String(err.cause.code || err.cause.message || err.cause) : null,
      next: 'Loop-data ingestion moves to the Python loader on the local machine.',
    })
  }

  const ms = Date.now() - started

  if (!resp.ok) {
    return res.status(200).json({
      reachable: true,
      httpOk: false,
      verdict: `Connection SUCCEEDED but NASCAR answered HTTP ${resp.status}`,
      note:
        resp.status === 403
          ? 'A 403 here means the network path works and NASCAR is refusing the ' +
            'request itself — likely datacenter-IP filtering. Treat as blocked ' +
            'for ingestion purposes, but it is a different failure than no route.'
          : 'Check that year/series/race identify a real race.',
      url,
      status: resp.status,
      ms,
    })
  }

  let body
  try {
    body = await resp.json()
  } catch (err) {
    return res.status(200).json({
      reachable: true,
      httpOk: true,
      parsed: false,
      verdict: 'Reached NASCAR and got 200, but the body was not JSON',
      url,
      ms,
    })
  }

  const rec = Array.isArray(body) ? body[0] : body
  const drivers = (rec && rec.drivers) || []
  const first = drivers[0] || {}

  return res.status(200).json({
    reachable: true,
    httpOk: true,
    parsed: true,
    verdict: 'REACHABLE — api/load-race.js can fetch loopstats directly',
    url,
    ms,
    race: {
      race_id: rec && rec.race_id,
      race_name: rec && rec.race_name,
      series_id: rec && rec.series_id,
      sch_laps: rec && rec.sch_laps,
      act_laps: rec && rec.act_laps,
    },
    driverCount: drivers.length,
    driverFields: Object.keys(first).sort(),
    hasDriverId: 'driver_id' in first,
    hasClosingPs: 'closing_ps' in first,
    next: 'Swap the fetch in api/load-race.js; keep our driver_name spellings.',
  })
}

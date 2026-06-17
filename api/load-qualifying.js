// api/load-qualifying.js — Vercel serverless function
// Fetches qualifying results from Racing Reference and stores in Supabase

const { createClient } = require('@supabase/supabase-js')

const SERIES_CODES = { cup: 'W', oreilly: 'B', trucks: 'C' }

function getSupabase() {
  const url = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not configured')
  return createClient(url, key)
}

// Pull plain text from an HTML string — strips all tags
function stripTags(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '').trim()
}

// Parse Racing Reference qualifying results page HTML
function parseQualifyingPage(html) {
  const drivers = []

  // Racing Reference wraps the results in a <table> with class "tb"
  // Columns (typical): Pos | Car # | Driver | Make | Speed | On
  // We look for rows containing a position number + driver name

  // Extract all <tr> blocks
  const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []

  for (const tr of trMatches) {
    const cells = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map(td => stripTags(td))

    if (cells.length < 3) continue

    // First cell should be a position number
    const pos = parseInt(cells[0])
    if (isNaN(pos) || pos < 1 || pos > 100) continue

    // Find car number and driver name
    // Typical: cells[0]=Pos, cells[1]=Car#, cells[2]=Driver, cells[3]=Make, cells[4]=Speed
    let carNumber = null
    let driverName = null
    let speed = null

    if (cells.length >= 3) {
      const carCandidate = cells[1].replace('#', '').trim()
      const driverCandidate = cells[2].trim()

      // Car number is typically numeric (or numeric+letter like "23XI")
      if (/^\d/.test(carCandidate)) carNumber = carCandidate
      if (driverCandidate && /[A-Za-z]/.test(driverCandidate) && driverCandidate.length > 2) {
        driverName = driverCandidate
      }
    }

    // Speed — usually in column 4 or 5
    for (let i = 3; i < Math.min(cells.length, 6); i++) {
      const spd = parseFloat(cells[i])
      if (!isNaN(spd) && spd > 50 && spd < 300) {
        speed = spd
        break
      }
    }

    if (driverName && pos) {
      drivers.push({ position: pos, carNumber, driverName, speed })
    }
  }

  return drivers
}

// Try to extract track name from the Racing Reference page
function parseTrackName(html) {
  // Look for <title> or <h1> containing the track name
  const titleMatch = html.match(/<title>(.*?)<\/title>/i)
  if (titleMatch) {
    const title = stripTags(titleMatch[1])
    // Title is usually like "2026 Watkins Glen Qualifying Results — Racing Reference"
    const m = title.match(/^\d{4}\s+(.+?)\s+(Qualifying|qual)/i)
    if (m) return m[1].trim()
  }
  // Fallback: look for <h1> or <h2>
  const h1 = html.match(/<h[12][^>]*>(.*?)<\/h[12]>/i)
  if (h1) {
    const text = stripTags(h1[1])
    const m = text.match(/^\d{4}\s+(.+?)\s+(Qualifying|qual)/i)
    if (m) return m[1].trim()
  }
  return null
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { year, raceNumber, series = 'cup', trackName } = req.body || {}

  if (!year || !raceNumber) {
    return res.status(400).json({ error: 'year and raceNumber are required' })
  }
  if (!trackName) {
    return res.status(400).json({ error: 'trackName is required' })
  }

  const raceNumPadded = String(raceNumber).padStart(2, '0')
  const seriesCode = SERIES_CODES[series] || 'W'
  const racingRefId = `${year}-${raceNumPadded}-qual-${series}`
  // Racing Reference uses /qual-results/ (with hyphen) — not /qualresults/
  const url = `https://www.racing-reference.info/qual-results/${year}-${raceNumPadded}/${seriesCode}`

  // Fetch the page with browser-like headers to avoid 403 blocks
  let html
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.racing-reference.info/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
      }
    })
    if (!resp.ok) {
      return res.status(502).json({
        error: `Racing Reference returned ${resp.status}`,
        url,
      })
    }
    html = await resp.text()
  } catch (err) {
    return res.status(502).json({ error: `Fetch failed: ${err.message}`, url })
  }

  // Check for no data
  if (html.includes('No qualifying results') || html.includes('no results')) {
    return res.status(404).json({ error: 'No qualifying results found for this race', url })
  }

  // ── Cancelled / metric qualifying check ─────────────────────────────────────
  // When qualifying is rained out or cancelled, NASCAR sets the grid by owner
  // points (the "metric" system). Racing Reference pages for those events
  // either lack speed data entirely or contain phrases like:
  //   "set by metric", "owner points", "qualifying cancelled", "rain"
  // We refuse to load metric lineups because they don't reflect qualifying skill.
  const htmlLower = html.toLowerCase()
  const METRIC_SIGNALS = [
    'set by metric',
    'metric qualifying',
    'owner points',
    'qualifying cancelled',
    'qualifying rained out',
    'no qualifying',
    'starting lineup set',
    'lineup set by',
  ]
  for (const signal of METRIC_SIGNALS) {
    if (htmlLower.includes(signal)) {
      return res.status(422).json({
        error: `Qualifying was cancelled or set by metric — not loaded (detected: "${signal}")`,
        url,
        hint: 'Only real on-track qualifying sessions are stored.',
      })
    }
  }

  // Parse drivers
  const drivers = parseQualifyingPage(html)
  if (drivers.length === 0) {
    return res.status(422).json({
      error: 'Could not parse any drivers from the page',
      url,
      hint: 'Check that the race number and series are correct',
    })
  }

  // Reject if fewer than half the drivers have speed data — strong signal
  // that this is a metric/owner-points lineup (no actual lap times recorded)
  const driversWithSpeed = drivers.filter(d => d.speed != null)
  if (driversWithSpeed.length < drivers.length * 0.4 && drivers.length > 5) {
    return res.status(422).json({
      error: `Only ${driversWithSpeed.length}/${drivers.length} drivers have speed data — this appears to be a metric/cancelled qualifying lineup`,
      url,
      hint: 'Only real on-track qualifying sessions are stored.',
    })
  }

  // Connect to Supabase
  let supabase
  try {
    supabase = getSupabase()
  } catch (err) {
    return res.status(503).json({ error: err.message })
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from('qualifying_results')
    .select('id')
    .eq('racing_reference_id', racingRefId)
    .limit(1)

  if (existing && existing.length > 0) {
    // Delete existing and re-insert (allows re-loading if data changed)
    await supabase
      .from('qualifying_results')
      .delete()
      .eq('racing_reference_id', racingRefId)
  }

  // Build rows
  const rows = drivers.map(d => ({
    series,
    year: parseInt(year),
    race_number: parseInt(raceNumber),
    track_name: trackName,
    racing_reference_id: racingRefId,
    driver_name: d.driverName,
    car_number: d.carNumber || null,
    qualifying_position: d.position,
    qualifying_speed: d.speed || null,
  }))

  // Insert in batches
  const errors = []
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
    const { error } = await supabase.from('qualifying_results').insert(batch)
    if (error) errors.push(error.message)
  }

  if (errors.length > 0) {
    return res.status(500).json({
      error: 'Some rows failed to insert',
      details: errors,
      driversFound: drivers.length,
    })
  }

  return res.json({
    success: true,
    message: `Loaded ${rows.length} qualifying results for ${trackName} ${year}`,
    trackName,
    year,
    racingRefId,
    driversLoaded: rows.length,
    url,
    pole: drivers[0] ? `${drivers[0].driverName} (${drivers[0].speed ? drivers[0].speed + ' mph' : 'no speed'})` : null,
  })
}

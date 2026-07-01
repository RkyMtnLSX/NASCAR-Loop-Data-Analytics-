// api/load-race.js â Vercel serverless function
// Fetches a Racing Reference loop data page and inserts into Supabase

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY
)

// Strip HTML tags and decode common entities
function textOf(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .trim()
}

// Parse <td> cells from a <tr> HTML block
function parseCells(rowHtml) {
  const cells = []
  const re = /<td[^>]*>([\s\S]*?)<\/td>/gi
  let m
  while ((m = re.exec(rowHtml)) !== null) {
    cells.push(textOf(m[1]))
  }
  return cells
}

// Extract all <tr> rows that have at least minCols <td> cells
function parseDataRows(html, minCols = 17) {
  const rows = []
  const re = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let m
  while ((m = re.exec(html)) !== null) {
    const cells = parseCells(m[1])
    if (cells.length >= minCols) rows.push(cells)
  }
  return rows
}

// Safe integer parse â returns null for blanks, dashes, NaN
function toInt(s) {
  if (!s || s === '--' || s === '-' || s.trim() === '') return null
  const n = parseInt(s.replace(/[^0-9-]/g, ''), 10)
  return isNaN(n) ? null : n
}

// Safe float parse
function toFloat(s) {
  if (!s || s === '--' || s === '-' || s.trim() === '') return null
  const n = parseFloat(s.replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? null : n
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { year, raceNumber, series, raceDate } = req.body || {}
  if (!year || raceNumber == null || !series) {
    return res.status(400).json({ error: 'year, raceNumber, and series are required' })
  }

  const seriesCodeMap = { cup: 'W', xfinity: 'B', oreilly: 'B', trucks: 'C' }
  const seriesCode = seriesCodeMap[series]
  if (!seriesCode) return res.status(400).json({ error: `Unknown series: ${series}` })

  const raceNumStr = String(raceNumber).padStart(2, '0')
  const racingRefId = `${year}-${raceNumStr}-${seriesCode}`
  const url = `https://www.racing-reference.info/loopdata/${year}-${raceNumStr}/${seriesCode}`

  const { data: existingRace } = await supabase
    .from('races')
    .select('id, track_name')
    .eq('racing_reference_id', racingRefId)
    .maybeSingle()

  if (existingRace) {
    return res.status(409).json({
      error: 'Already loaded',
      message: `${existingRace.track_name} ${year} (${racingRefId}) is already in the database.`,
    })
  }

  let html
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.racing-reference.info/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
      },
    })
    if (!resp.ok) {
      return res.status(404).json({
        error: `Racing Reference returned HTTP ${resp.status}. Verify year, race number, and series.`,
        url,
      })
    }
    html = await resp.text()
  } catch (err) {
    return res.status(502).json({ error: `Failed to fetch page: ${err.message}`, url })
  }

  let trackName = null
  const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleM) {
    let t = titleM[1]
      .replace(/\s*[|\u2013-].*Racing Reference.*/i, '')
      .replace(/^\d{4}\s+/, '')
      .replace(/\s*Loop\s*Data\s*$/i, '')
      .trim()
    if (t.length > 2) trackName = t
  }
  if (!trackName) {
    const h1M = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    if (h1M) {
      const t = textOf(h1M[1]).replace(/\d{4}/, '').replace(/Loop\s*Data/i, '').trim()
      if (t.length > 2) trackName = t
    }
  }
  if (!trackName) trackName = `Race ${raceNumber} ${year}`

  const allRows = parseDataRows(html, 17)
  const driverRows = allRows.filter(cells => {
    const first = (cells[0] || '').trim()
    return (
      first.length > 0 &&
      first.toLowerCase() !== 'driver' &&
      /[A-Za-z]/.test(first) &&
      !/^(pos|place|rank)/i.test(first)
    )
  })

  if (driverRows.length === 0) {
    return res.status(404).json({
      error: 'No driver data found. The race may not have loop data posted yet, or the race number is incorrect.',
      url,
      debugRowCount: allRows.length,
    })
  }

  let winningDriver = null
  let totalLaps = 0
  for (const row of driverRows) {
    const finish = toInt(row[3])
    const laps = toInt(row[17])
    if (finish === 1 && !winningDriver) winningDriver = row[0]
    if (laps && laps > totalLaps) totalLaps = laps
  }

  const { data: raceRecord, error: raceErr } = await supabase
    .from('races')
    .insert({
      racing_reference_id: racingRefId,
      race_name: `${trackName} ${year}`,
      track_name: trackName,
      year: parseInt(year),
      race_number: parseInt(raceNumber),
      series,
      race_date: raceDate || null,
      winning_driver: winningDriver,
      total_laps: totalLaps || null,
      racing_reference_url: url,
    })
    .select('id, race_number')
    .single()

  if (raceErr) {
    return res.status(500).json({ error: `Failed to insert race: ${raceErr.message}` })
  }

  const raceId = raceRecord.id
  const trackRaceNumber = raceRecord.race_number || 1
  const errorLog = []
  let inserted = 0

  for (const row of driverRows) {
    const driverName = (row[0] || '').trim()
    if (!driverName) continue

    await supabase
      .from('drivers')
      .upsert({ name: driverName, series }, { onConflict: 'name,series', ignoreDuplicates: true })

    const lapsComp = toInt(row[17])
    const finishPos = toInt(row[3])
    let finishStatus = 'running'
    if (lapsComp != null && totalLaps > 0 && lapsComp < totalLaps * 0.9) {
      finishStatus = 'dnf'
    }

    const { error } = await supabase.from('loop_data').insert({
      race_id: raceId,
      driver_name: driverName,
      series,
      year: parseInt(year),
      track_name: trackName,
      race_number: trackRaceNumber,
      start_position:          toInt(row[1]),
      mid_race_position:       toInt(row[2]),
      finish_position:         finishPos,
      high_position:           toInt(row[4]),
      low_position:            toInt(row[5]),
      avg_position:            toFloat(row[6]),
      pass_diff:               toInt(row[7]),
      green_flag_passes:       toInt(row[8]),
      green_flag_times_passed: toInt(row[9]),
      quality_passes:          toInt(row[10]),
      pct_quality_passes:      toFloat(row[11]),
      fastest_laps:            toInt(row[12]),
      top15_laps:              toInt(row[13]),
      pct_top15_laps:          toFloat(row[14]),
      laps_led:                toInt(row[15]),
      pct_laps_led:            toFloat(row[16]),
      laps_completed:          lapsComp,
      driver_rating:           toFloat(row[18]),
      finish_status:           finishStatus,
    })

    if (error) {
      errorLog.push(`${driverName}: ${error.message}`)
    } else {
      inserted++
    }
  }

  return res.json({
    success: true,
    message: `Loaded ${inserted} drivers for ${trackName} ${year}`,
    raceId,
    racingRefId,
    trackName,
    winningDriver,
    driversLoaded: inserted,
    errors: errorLog.length,
    errorLog: errorLog.slice(0, 10),
    url,
  })
}

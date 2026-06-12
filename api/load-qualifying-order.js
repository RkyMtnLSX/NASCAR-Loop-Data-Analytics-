// api/load-qualifying-order.js
const { createClient } = require('@supabase/supabase-js')
// Use lib path directly to avoid pdf-parse test-file initialization crash in Vercel
const pdfParse = require('pdf-parse/lib/pdf-parse.js')

function getSupabase() {
  const url = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not configured')
  return createClient(url, key)
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { jayskiUrl, pdfUrl: directPdfUrl, parsedEntries, year, trackName, series = 'cup', raceNumber } = req.body || {}
  if ((!jayskiUrl && !directPdfUrl && !parsedEntries) || !year || !trackName) {
    return res.status(400).json({ error: 'Provide parsedEntries, pdfUrl, or jayskiUrl — plus year and trackName' })
  }

  try {
    let entries

    if (parsedEntries && Array.isArray(parsedEntries) && parsedEntries.length > 0) {
      // Client already parsed the PDF — skip fetch/parse entirely
      entries = parsedEntries
    } else {
      let resolvedPdfUrl

      if (directPdfUrl) {
        resolvedPdfUrl = directPdfUrl.trim()
      } else {
        // Fetch Jayski page to find PDF link
        const pageRes = await fetch(jayskiUrl)
        if (!pageRes.ok) throw new Error(`Jayski fetch failed: ${pageRes.status}`)
        const html = await pageRes.text()

        const pdfMatch = html.match(/href="([^"]*qualifying[^"]*\.pdf[^"]*)"/i)
        if (!pdfMatch) throw new Error('No qualifying PDF link found on Jayski page')

        resolvedPdfUrl = pdfMatch[1]
        if (resolvedPdfUrl.startsWith('/')) resolvedPdfUrl = 'https://www.jayski.com' + resolvedPdfUrl
      }

      // Download and parse PDF
      const pdfRes = await fetch(resolvedPdfUrl)
      if (!pdfRes.ok) throw new Error(`PDF download failed: ${pdfRes.status}`)
      const buffer = await pdfRes.arrayBuffer()
      const data = await pdfParse(Buffer.from(buffer))
      entries = parseQualifyingOrderPdf(data.text)
    }

    if (!entries.length) throw new Error('No entries parsed from PDF')

    // Match to qualifying_results rows and update
    const supabase = getSupabase()
    const firstWord = trackName.split(' ')[0]

    let query = supabase
      .from('qualifying_results')
      .select('id, car_number, qualifying_position')
      .eq('series', series)
      .eq('year', year)
      .ilike('track_name', `${firstWord}%`)

    if (raceNumber) query = query.eq('race_number', raceNumber)

    const { data: rows, error: fetchErr } = await query
    if (fetchErr) throw fetchErr

    if (!rows || rows.length === 0) {
      return res.status(200).json({
        ok: true,
        updated: 0,
        hint: 'No qualifying_results rows found for this race. Load qualifying results first, then re-run this.'
      })
    }

    // Build lookup map: carNumber -> row id
    const carMap = {}
    for (const row of rows) {
      carMap[String(row.car_number).padStart(2, '0')] = row.id
      carMap[String(row.car_number)] = row.id
    }

    let updated = 0
    for (const entry of entries) {
      const id = carMap[entry.carNumber] || carMap[String(parseInt(entry.carNumber, 10))]
      if (!id) continue

      const { error: upErr } = await supabase
        .from('qualifying_results')
        .update({
          qualifying_order: entry.order,
          qualifying_group: entry.group || null,
          metric_score: entry.metricScore || null
        })
        .eq('id', id)

      if (!upErr) updated++
    }

    return res.status(200).json({ ok: true, updated, total: entries.length, entries })
  } catch (err) {
    console.error('[load-qualifying-order]', err)
    return res.status(500).json({ error: err.message || String(err) })
  }
}

function parseQualifyingOrderPdf(text) {
  const hasGroup = /Group/i.test(text.slice(0, 300))
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const entries = []

  if (hasGroup) {
    const lineRe = /^(\d+)\s+(\d+)\s+(.+?)\s+([\d.]+)\s+(A|B|1|2)$/i
    for (const line of lines) {
      const m = line.match(lineRe)
      if (!m) continue
      const groupRaw = m[5].toUpperCase()
      entries.push({
        order: parseInt(m[1], 10),
        carNumber: m[2].padStart(2, '0'),
        driverName: cleanName(m[3]),
        metricScore: parseFloat(m[4]),
        group: groupRaw === 'A' || groupRaw === '1' ? 1 : 2
      })
    }
  } else {
    const lineRe = /^(\d+)\s+(\d+)\s+(.+?)\s+([\d.]+)$/
    for (const line of lines) {
      const m = line.match(lineRe)
      if (!m) continue
      entries.push({
        order: parseInt(m[1], 10),
        carNumber: m[2].padStart(2, '0'),
        driverName: cleanName(m[3]),
        metricScore: parseFloat(m[4]),
        group: null
      })
    }
  }

  return entries.sort((a, b) => a.order - b.order)
}

function cleanName(name) {
  return name.replace(/^\*\s*/, '').replace(/\s*\(i\)\s*$/, '').replace(/\s+/g, ' ').trim()
}

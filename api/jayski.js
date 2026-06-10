// Vercel serverless function — CORS proxy for Jayski entry list PDFs
// Usage: GET /api/jayski?url=<jayski_entry_list_page_url>
// Returns the raw PDF bytes with CORS headers so the browser can parse with pdf.js

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const { url } = req.query
  if (!url) {
    return res.status(400).json({ error: 'url param required' })
  }
  if (!url.includes('jayski.com')) {
    return res.status(400).json({ error: 'Only jayski.com URLs are supported' })
  }

  try {
    // 1. Fetch the Jayski entry list page HTML
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    if (!pageRes.ok) {
      return res.status(502).json({ error: 'Jayski returned HTTP ' + pageRes.status })
    }
    const html = await pageRes.text()

    // 2. Extract the PDF URL from the page HTML
    const pdfMatch = html.match(/https?:[^\s"'<>]*\.pdf/i)
    if (!pdfMatch) {
      return res.status(404).json({ error: 'No PDF found on the Jayski page. Make sure the entry list has been published.' })
    }
    const pdfUrl = pdfMatch[0]

    // 3. Fetch and proxy the PDF bytes
    const pdfRes = await fetch(pdfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.jayski.com/',
      },
    })
    if (!pdfRes.ok) {
      return res.status(502).json({ error: 'Could not fetch PDF: HTTP ' + pdfRes.status })
    }

    const buffer = Buffer.from(await pdfRes.arrayBuffer())
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', buffer.length)
    res.setHeader('X-PDF-Source', pdfUrl.split('/').pop()) // filename for debugging
    res.status(200).send(buffer)
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error' })
  }
}

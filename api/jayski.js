// Vercel serverless function — PDF proxy for Jayski entry list scraping
//
// Two modes:
//   GET /api/jayski?pdfUrl=<direct_pdf_url>   — proxy a known PDF URL (used by browser after
//                                               it extracts the PDF URL via allorigins CORS proxy)
//   GET /api/jayski?url=<jayski_page_url>      — legacy: fetch page + proxy PDF in one step
//
// The browser-side flow (Admin.js) uses the two-step approach:
//   1. Browser fetches Jayski HTML via allorigins.win (CORS proxy) — bypasses Jayski bot detection
//   2. Browser extracts PDF URL from HTML with regex
//   3. Browser calls /api/jayski?pdfUrl=<url> — Vercel proxies the CDN-hosted PDF bytes

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }

  const { url, pdfUrl } = req.query

  // Mode 1: direct PDF proxy (preferred)
  if (pdfUrl) {
    if (!pdfUrl.includes('jayski.com')) {
      return res.status(400).json({ error: 'Only jayski.com PDF URLs are supported' })
    }
    try {
      const pdfRes = await fetch(pdfUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.jayski.com/',
          'Accept': 'application/pdf,*/*',
        },
      })
      if (!pdfRes.ok) {
        return res.status(502).json({ error: 'PDF fetch failed: HTTP ' + pdfRes.status })
      }
      const buffer = Buffer.from(await pdfRes.arrayBuffer())
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Length', buffer.length)
      res.setHeader('X-PDF-Source', pdfUrl.split('/').pop())
      return res.status(200).send(buffer)
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Unknown error' })
    }
  }

  // Mode 2: fetch page HTML to find PDF URL, then proxy it (may hit bot protection)
  if (url) {
    if (!url.includes('jayski.com')) {
      return res.status(400).json({ error: 'Only jayski.com URLs are supported' })
    }
    try {
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
      const pdfMatch = html.match(/https?:[^.\s"'<>]*\.pdf/i)
      if (!pdfMatch) {
        return res.status(404).json({ error: 'No PDF found on the Jayski page. Make sure the entry list has been published.' })
      }
      const resolvedPdfUrl = pdfMatch[0]
      const pdfRes = await fetch(resolvedPdfUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.jayski.com/',
        },
      })
      if (!pdfRes.ok) {
        return res.status(502).json({ error: 'PDF fetch failed: HTTP ' + pdfRes.status })
      }
      const buffer = Buffer.from(await pdfRes.arrayBuffer())
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Length', buffer.length)
      res.setHeader('X-PDF-Source', resolvedPdfUrl.split('/').pop())
      return res.status(200).send(buffer)
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Unknown error' })
    }
  }

  return res.status(400).json({ error: 'Provide either ?pdfUrl= or ?url= parameter' })
}

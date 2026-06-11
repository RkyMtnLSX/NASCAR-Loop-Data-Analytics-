// api/load-qualifying-order.js
// Fetches a Jayski qualifying order page, extracts the PDF link,
// downloads + parses the PDF, and upserts qualifying_order / qualifying_group / metric_score
// into qualifying_results rows matched by (series, year, track_name, car_number).

import { createClient } from '@supabase/supabase-js';
import * as pdfParse from 'pdf-parse/lib/pdf-parse.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { jayskiUrl, year, trackName, series = 'cup' } = req.body;

  if (!jayskiUrl || !year || !trackName) {
    return res.status(400).json({ error: 'jayskiUrl, year, and trackName are required' });
  }

  const log = [];
  const push = (msg) => { log.push(msg); console.log(msg); };

  try {
    // 1. Fetch the Jayski qualifying order page
    push(`Fetching Jayski page: ${jayskiUrl}`);
    const pageRes = await fetch(jayskiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NASCAR-Analytics/1.0)' }
    });
    if (!pageRes.ok) throw new Error(`Page fetch failed: ${pageRes.status}`);
    const pageHtml = await pageRes.text();

    // 2. Extract PDF URL from the page HTML
    const pdfMatch = pageHtml.match(/href="(https?:\/\/[^"]+\.pdf)"/i)
      || pageHtml.match(/href="([^"]+QUAL[^"]*\.pdf)"/i)
      || pageHtml.match(/href="([^"]+\.pdf)"/i);

    if (!pdfMatch) throw new Error('Could not find PDF link on page');
    const pdfUrl = pdfMatch[1];
    push(`Found PDF: ${pdfUrl}`);

    // 3. Download the PDF
    const pdfRes = await fetch(pdfUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NASCAR-Analytics/1.0)' }
    });
    if (!pdfRes.ok) throw new Error(`PDF fetch failed: ${pdfRes.status}`);
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    push(`Downloaded PDF: ${pdfBuffer.length} bytes`);

    // 4. Parse PDF text
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text;
    push(`Extracted ${text.length} chars from PDF`);

    // 5. Parse the table rows
    const rows = parseQualifyingOrderPdf(text);
    push(`Parsed ${rows.length} driver rows`);

    if (rows.length < 10) {
      return res.status(422).json({
        error: 'Too few rows parsed from PDF — check format',
        log,
        rawText: text.slice(0, 2000)
      });
    }

    // 6. Upsert into qualifying_results
    let updated = 0;
    let notFound = 0;
    for (const row of rows) {
      const { data, error } = await supabase
        .from('qualifying_results')
        .update({
          qualifying_order: row.order,
          qualifying_group: row.group,
          metric_score: row.metricScore
        })
        .eq('series', series)
        .eq('year', parseInt(year))
        .ilike('track_name', `%${trackName.split(' ')[0]}%`)
        .eq('car_number', row.carNumber)
        .select('id');

      if (error) {
        push(`Error updating car #${row.carNumber}: ${error.message}`);
      } else if (data && data.length > 0) {
        updated++;
      } else {
        notFound++;
        push(`No match for car #${row.carNumber} (${row.driverName})`);
      }
    }

    push(`Done: ${updated} updated, ${notFound} not found`);
    return res.status(200).json({
      success: true,
      updated,
      notFound,
      total: rows.length,
      pdfUrl,
      log
    });

  } catch (err) {
    push(`Error: ${err.message}`);
    return res.status(500).json({ error: err.message, log });
  }
}

function parseQualifyingOrderPdf(text) {
  const results = [];
  const rowRegex = /^(\d+)\s+(\w+)\s+(.+?)\s+([\d]+\.[\d]+)\s+([12])\s*$/;
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  for (const line of lines) {
    const m = line.match(rowRegex);
    if (m) {
      const order = parseInt(m[1]);
      const carNumber = m[2].replace(/^0+/, '') || m[2];
      const driverName = cleanDriverName(m[3]);
      const metricScore = parseFloat(m[4]);
      const group = parseInt(m[5]);
      if (order >= 1 && order <= 50 && metricScore >= 0) {
        results.push({ order, carNumber, driverName, metricScore, group });
      }
    }
  }

  if (results.length < 5) {
    const globalRegex = /(\d{1,2})\s+(\w{1,3})\s+([A-Z][A-Za-z .*()-#]+?)\s+([\d]+\.[\d]{3})\s+([12])/g;
    let m;
    const seen = new Set();
    while ((m = globalRegex.exec(text)) !== null) {
      const order = parseInt(m[1]);
      const carNumber = m[2].replace(/^0+/, '') || m[2];
      const key = `${order}-${carNumber}`;
      if (!seen.has(key) && order >= 1 && order <= 50) {
        seen.add(key);
        results.push({
          order,
          carNumber,
          driverName: cleanDriverName(m[3]),
          metricScore: parseFloat(m[4]),
          group: parseInt(m[5])
        });
      }
    }
  }

  results.sort((a, b) => a.order - b.order);
  return results;
}

function cleanDriverName(name) {
  return name
    .replace(/^\*\s*/, '')
    .replace(/\s*\(i\)\s*$/, '')
    .replace(/\s*#\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

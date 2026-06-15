const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY
)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { year, track_type, race_name, race_date, track, rows } = req.body || {}
  if (!year || !race_name || !race_date || !track || !Array.isArray(rows) || !rows.length) {
    return res.status(400).json({ error: 'Missing required fields: year, race_name, race_date, track, rows[]' })
  }
  const sorted = [...rows].sort((a, b) => (parseFloat(b.fastest_speed) || 0) - (parseFloat(a.fastest_speed) || 0))
  const records = sorted.map((r, i) => ({
    year: parseInt(year), track_type: track_type || null, race_name, race_date, track,
    rank: i + 1, driver: (r.driver || '').trim(), car: r.car ? String(r.car).trim() : null,
    fastest_lap_num: r.fastest_lap_num ? parseInt(r.fastest_lap_num) : null,
    fastest_time: r.fastest_time ? String(r.fastest_time).trim() : null,
    fastest_speed: parseFloat(r.fastest_speed) || null,
    start_pos: r.start_pos ? parseInt(r.start_pos) : null,
    finish_pos: r.finish_pos ? parseInt(r.finish_pos) : null,
    status: r.status ? String(r.status).trim() : null,
  })).filter(r => r.driver)
  if (!records.length) return res.status(400).json({ error: 'No valid driver rows after filtering' })
  const { error: delError } = await supabase.from('fastest_laps').delete().eq('race_name', race_name).eq('race_date', race_date)
  if (delError) return res.status(500).json({ error: `Delete failed: ${delError.message}` })
  const { error: insertError } = await supabase.from('fastest_laps').insert(records)
  if (insertError) return res.status(500).json({ error: insertError.message })
  return res.json({ success: true, inserted: records.length, message: `Loaded ${records.length} drivers for ${race_name} (${race_date})`, topDriver: records[0]?.driver, topSpeed: records[0]?.fastest_speed })
}

const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { name, correlation_group_label } = req.body || {}
  if (!name) return res.status(400).json({ error: 'name required' })

  const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { error } = await supabase
    .from('tracks')
    .upsert({ name, correlation_group_label }, { onConflict: 'name' })

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ success: true, name, correlation_group_label })
}

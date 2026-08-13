// Vercel serverless function - opens a Stripe Billing Portal session so subscribers
// manage cards / cancel themselves. Requires the customer portal to be SAVED once in
// Stripe dashboard settings (test + live separately) or Stripe returns an error.
// Env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
const Stripe = require('stripe')

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const { token } = req.body || {}
    const uRes = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (token || '') },
    })
    if (!uRes.ok) return res.status(401).json({ error: 'sign in first' })
    const user = await uRes.json()
    const q = await fetch(process.env.SUPABASE_URL + '/rest/v1/subscribers?user_id=eq.' + user.id + '&select=stripe_customer_id', {
      headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY },
    })
    const rows = await q.json()
    const cust = rows && rows[0] && rows[0].stripe_customer_id
    if (!cust) return res.status(404).json({ error: 'no billing profile on file (week passes have nothing to manage)' })
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const origin = req.headers.origin || 'https://nascar-loop-data-analytics.vercel.app'
    const session = await stripe.billingPortal.sessions.create({ customer: cust, return_url: origin + '/account' })
    return res.status(200).json({ url: session.url })
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) })
  }
}

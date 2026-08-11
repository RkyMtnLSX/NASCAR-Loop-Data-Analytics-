// Vercel serverless function - creates a Stripe Checkout session for a signed-in
// Supabase user. Plans: 'monthly' (subscription) | 'week' (one-time 7-day pass).
// Env: STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_WEEKPASS,
//      SUPABASE_URL, SUPABASE_ANON_KEY
const Stripe = require('stripe')

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const { plan, token } = req.body || {}
    const price = plan === 'week' ? process.env.STRIPE_PRICE_WEEKPASS : process.env.STRIPE_PRICE_MONTHLY
    if (!price) return res.status(500).json({ error: 'price not configured' })
    // verify the Supabase user from their access token - checkout is tied to this
    // verified identity via client_reference_id, never to client-sent ids
    const uRes = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (token || '') },
    })
    if (!uRes.ok) return res.status(401).json({ error: 'sign in first' })
    const user = await uRes.json()
    const origin = req.headers.origin || 'https://nascar-loop-data-analytics.vercel.app'
    const session = await stripe.checkout.sessions.create({
      mode: plan === 'week' ? 'payment' : 'subscription',
      line_items: [{ price, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      allow_promotion_codes: true,
      success_url: origin + '/subscribe?status=success',
      cancel_url: origin + '/subscribe?status=cancelled',
    })
    return res.status(200).json({ url: session.url })
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) })
  }
}

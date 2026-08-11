// env nudge 1786417174341
// Vercel serverless function - Stripe webhook. Verifies signature against the RAW
// body, then writes subscription state to Supabase (service role; RLS blocks all
// client writes). Handles: checkout.session.completed (monthly + week pass),
// customer.subscription.updated / .deleted (renewals, cancels, payment failures).
// Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
const Stripe = require('stripe')

const sb = (path, opts) => fetch(process.env.SUPABASE_URL + '/rest/v1/' + path, Object.assign({
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates',
  },
}, opts))

const upsert = async (row) => {
  const r = await sb('subscribers?on_conflict=user_id', { method: 'POST', body: JSON.stringify([row]) })
  if (!r.ok) {
    const t = await r.text()
    console.error('subscribers upsert failed', r.status, t)
    throw new Error('supabase write failed ' + r.status + ': ' + t.slice(0, 300))
  }
}

module.exports = async (req, res) => {
  // env guard (2026-08-10): a present-but-EMPTY env var fails as a cryptic 401 downstream
  for (const k of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[k] || !String(process.env[k]).trim()) return res.status(500).send('env missing or empty: ' + k)
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const chunks = []
  for await (const c of req) chunks.push(c)
  let event
  try {
    event = stripe.webhooks.constructEvent(Buffer.concat(chunks), req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)
  } catch (e) {
    return res.status(400).send('bad signature')
  }
  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object
      if (s.client_reference_id) {
        const email = (s.customer_details && s.customer_details.email) || null
        if (s.mode === 'payment') {
          // week pass: 7 days of access from purchase
          await upsert({ user_id: s.client_reference_id, email: email, stripe_customer_id: s.customer || null, plan: 'week', status: 'active', access_until: new Date(Date.now() + 7 * 86400000).toISOString(), updated_at: new Date().toISOString() })
        } else {
          await upsert({ user_id: s.client_reference_id, email: email, stripe_customer_id: s.customer, plan: 'monthly', status: 'active', access_until: null, updated_at: new Date().toISOString() })
        }
      }
    }
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const sub = event.data.object
      const active = sub.status === 'active' || sub.status === 'trialing'
      const q = await sb('subscribers?stripe_customer_id=eq.' + sub.customer + '&select=user_id')
      const rows = await q.json()
      if (rows && rows[0]) {
        await upsert({
          user_id: rows[0].user_id,
          status: active ? 'active' : sub.status,
          access_until: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
      }
    }
    return res.status(200).json({ received: true })
  } catch (e) {
    console.error('webhook handler error', e)
    return res.status(500).send('handler error: ' + String((e && e.message) || e).slice(0, 400))
  }
}

module.exports.config = { api: { bodyParser: false } }

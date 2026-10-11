// api/kalshi.js - read-only proxy for Kalshi's PUBLIC market data (2026-10-11). No key, no account,
// no writes: Kalshi's /markets and /markets/{ticker}/orderbook endpoints are public for reads. The
// browser cannot call api.elections.kalshi.com directly (CORS), the deployment can. Fixed URL
// templates with validated parameters - this is not an open proxy.
//
//   ?series=KXNASCARRACE[&status=open][&limit=200]   markets in a Kalshi series (yes_bid/yes_ask in cents)
//   ?ticker=KXNASCARRACE-26OCT11-XXX                  one market's order book
//
// American odds from a cents price p (0-100): p >= 50 ? -100*p/(100-p) : 100*(100-p)/p.
const KALSHI = 'https://api.elections.kalshi.com/trade-api/v2'
const SERIES_OK = /^[A-Z0-9]{3,32}$/
const TICKER_OK = /^[A-Z0-9-]{3,64}$/

function american(cents) {
  const p = Number(cents)
  if (!(p > 0 && p < 100)) return null
  return p >= 50 ? Math.round(-100 * p / (100 - p)) : Math.round(100 * (100 - p) / p)
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
  const q = req.query || {}
  try {
    if (q.ticker) {
      if (!TICKER_OK.test(q.ticker)) return res.status(400).json({ error: 'bad ticker' })
      const r = await fetch(`${KALSHI}/markets/${q.ticker}/orderbook?depth=5`, { headers: { Accept: 'application/json' } })
      if (!r.ok) return res.status(502).json({ error: `kalshi ${r.status}` })
      return res.status(200).json(await r.json())
    }
    const series = String(q.series || 'KXNASCARRACE').toUpperCase()
    if (!SERIES_OK.test(series)) return res.status(400).json({ error: 'bad series' })
    const status = ['open', 'closed', 'settled'].includes(q.status) ? q.status : 'open'
    const limit = Math.min(Math.max(parseInt(q.limit) || 200, 1), 1000)
    const r = await fetch(`${KALSHI}/markets?series_ticker=${series}&status=${status}&limit=${limit}`, { headers: { Accept: 'application/json' } })
    if (!r.ok) return res.status(502).json({ error: `kalshi ${r.status}`, body: (await r.text()).slice(0, 300) })
    const j = await r.json()
    const markets = (j.markets || []).map(m => ({
      ticker: m.ticker, event: m.event_ticker, title: m.title, subtitle: m.yes_sub_title || m.subtitle || null,
      close_time: m.close_time, status: m.status,
      yes_bid: m.yes_bid, yes_ask: m.yes_ask, last: m.last_price, volume: m.volume, open_interest: m.open_interest,
      american_ask: american(m.yes_ask), american_mid: american((m.yes_bid + m.yes_ask) / 2),
    }))
    return res.status(200).json({ series, status, count: markets.length, cursor: j.cursor || null, markets })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}

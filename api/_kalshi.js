// api/_kalshi.js - read-only proxy for Kalshi's PUBLIC market data (2026-10-11). Served as
// /api/nascar-feed?type=kalshi (Hobby plan: 12-function cap, so it rides inside the feed proxy).
// No key, no account, no writes: /markets and /markets/{ticker}/orderbook are public for reads.
// Fixed URL templates with validated parameters - not an open proxy.
//
//   ?type=kalshi&series=KXNASCARRACE[&status=open][&limit=200]   markets in a series (cents)
//   ?type=kalshi&ticker=KXNASCARRACE-...                           one market's order book
//
// American odds from a cents price p: p >= 50 ? -100*p/(100-p) : 100*(100-p)/p.
const KALSHI = 'https://api.elections.kalshi.com/trade-api/v2'
const SERIES_OK = /^[A-Z0-9]{3,32}$/
const TICKER_OK = /^[A-Z0-9-]{3,64}$/

function american(cents) {
  const p = Number(cents)
  if (!(p > 0 && p < 100)) return null
  return p >= 50 ? Math.round(-100 * p / (100 - p)) : Math.round(100 * (100 - p) / p)
}

async function kalshi(req, res) {
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
    return res.status(200).json({ type: 'kalshi', series, status, count: markets.length, cursor: j.cursor || null, markets })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}

module.exports = { kalshi, american }

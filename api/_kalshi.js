// api/_kalshi.js - read-only proxy for Kalshi's PUBLIC market data (2026-10-11). Served as
// /api/nascar-feed?type=kalshi (Hobby plan: 12-function cap, so it rides inside the feed proxy).
// No key, no account, no writes: /markets and /markets/{ticker}/orderbook are public for reads.
// Fixed URL templates with validated parameters - not an open proxy.
//
//   ?type=kalshi&ks=KXNASCARRACE[&status=open][&limit=200]   markets in a Kalshi series (cents)
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
    if (q.trades) {
      // Public trade tape for one market (2026-10-11): price, count, taker side, time. Up to 1000/page.
      if (!TICKER_OK.test(q.trades)) return res.status(400).json({ error: 'bad ticker' })
      const lim = Math.min(Math.max(parseInt(q.limit) || 1000, 1), 1000)
      const r = await fetch(`${KALSHI}/markets/trades?ticker=${q.trades}&limit=${lim}${q.cursor ? '&cursor=' + encodeURIComponent(q.cursor) : ''}${q.min_ts ? '&min_ts=' + parseInt(q.min_ts) : ''}${q.max_ts ? '&max_ts=' + parseInt(q.max_ts) : ''}`, { headers: { Accept: 'application/json' } })
      if (!r.ok) return res.status(502).json({ error: `kalshi ${r.status}` })
      return res.status(200).json(await r.json())
    }
    if (q.candles) {
      // Hourly / minute candlesticks for one market: /series/{series}/markets/{ticker}/candlesticks.
      if (!TICKER_OK.test(q.candles)) return res.status(400).json({ error: 'bad ticker' })
      const ser = String(q.ks || q.candles.split('-')[0]).toUpperCase()
      if (!SERIES_OK.test(ser)) return res.status(400).json({ error: 'bad series' })
      const pi = [1, 60, 1440].includes(parseInt(q.period)) ? parseInt(q.period) : 60
      const end = parseInt(q.end_ts) || Math.floor(Date.now() / 1000), start = parseInt(q.start_ts) || end - 7 * 86400
      const r = await fetch(`${KALSHI}/series/${ser}/markets/${q.candles}/candlesticks?start_ts=${start}&end_ts=${end}&period_interval=${pi}`, { headers: { Accept: 'application/json' } })
      if (!r.ok) return res.status(502).json({ error: `kalshi ${r.status}`, body: (await r.text()).slice(0, 200) })
      return res.status(200).json(await r.json())
    }
    const series = String(q.ks || 'KXNASCARRACE').toUpperCase()
    if (!SERIES_OK.test(series)) return res.status(400).json({ error: 'bad series' })
    const status = ['open', 'closed', 'settled'].includes(q.status) ? q.status : 'open'
    const limit = Math.min(Math.max(parseInt(q.limit) || 200, 1), 1000)
    const r = await fetch(`${KALSHI}/markets?series_ticker=${series}&status=${status}&limit=${limit}`, { headers: { Accept: 'application/json' } })
    if (!r.ok) return res.status(502).json({ error: `kalshi ${r.status}`, body: (await r.text()).slice(0, 300) })
    const j = await r.json()
    // Kalshi moved prices from integer cents (yes_bid) to dollar strings (yes_bid_dollars, 2026);
    // read either, in cents.
    const cents = (m, k) => { const d = m[k + '_dollars']; if (d != null && d !== '') return Math.round(parseFloat(d) * 100); const c = m[k]; return (c == null || c === '') ? null : Number(c) }
    const evF = q.ev ? String(q.ev).toUpperCase() : null
    const markets = (j.markets || []).filter(m => !evF || String(m.event_ticker || '').toUpperCase() === evF).map(m => {
      const bid = cents(m, 'yes_bid'), ask = cents(m, 'yes_ask'), last = cents(m, 'last_price')
      return {
        ticker: m.ticker, event: m.event_ticker, title: m.title, subtitle: m.yes_sub_title || m.subtitle || null,
        close_time: m.close_time, status: m.status,
        yes_bid: bid, yes_ask: ask, last, volume: m.volume_fp != null ? parseFloat(m.volume_fp) : m.volume, open_interest: m.open_interest_fp != null ? parseFloat(m.open_interest_fp) : m.open_interest,
        american_ask: american(ask), american_mid: (bid != null && ask != null) ? american((bid + ask) / 2) : null,
      }
    })
    return res.status(200).json({ type: 'kalshi', series, status, count: markets.length, cursor: j.cursor || null, markets })
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}

module.exports = { kalshi, american }

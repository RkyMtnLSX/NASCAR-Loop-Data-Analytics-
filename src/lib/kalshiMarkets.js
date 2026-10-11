// src/lib/kalshiMarkets.js - shape Kalshi's public NASCAR markets for the sim (2026-10-11).
// CommonJS on purpose: api/_kalshi_snap.js require()s it and CRA imports it the same way.
//
// Kalshi facts (verified on the live feed 2026-10-11): one event per race per series ticker
// (KXNASCARRACE = winner, KXNASCARTOP3/5/10/20 = place markets), one market per driver; titles name
// the series ("Cup Series: Kyle Larson wins", "Auto Parts: ..." for O'Reilly); prices are dollar
// strings (yes_bid_dollars) - older fields were integer cents; close_time is the SETTLEMENT deadline,
// about a week after the green, not the start time.
const MARKET_OF = { KXNASCARRACE: 'win', KXNASCARTOP3: 't3', KXNASCARTOP5: 't5', KXNASCARTOP10: 't10', KXNASCARTOP20: 't20' }
const TICKERS = Object.keys(MARKET_OF)
const SERIES_PAT = { cup: /\bcup\b/i, oreilly: /auto parts|o'?reilly|xfinity/i, trucks: /truck|craftsman/i }

function american(c) {
  const p = Number(c)
  if (!(p > 0 && p < 100)) return null
  return p >= 50 ? Math.round(-100 * p / (100 - p)) : Math.round(100 * (100 - p) / p)
}
function cents(m, k) {
  const d = m[k + '_dollars']
  if (d != null && d !== '') return Math.round(parseFloat(d) * 100)
  const c = m[k]
  return (c == null || c === '') ? null : Number(c)
}
function eventKey(m) { return String(m.event_ticker || '').replace(/^(KXNASCAR\w+?)-/, '') }
function driverOf(m) { return m.yes_sub_title || m.subtitle || String(m.title || '').replace(/^.*?:\s*/, '').replace(/\s+(wins|finishes.*)$/i, '') }

// The race's markets: series named in the title; if raceStart is known, close within [green - 1d,
// green + 9d]; the earliest-closing event wins when two qualify (next week's race is also open).
function pickRaceMarkets(markets, seriesKey, raceStart) {
  const pat = SERIES_PAT[seriesKey]
  if (!pat) return []
  const start = raceStart ? new Date(raceStart).getTime() : null
  const lo = start != null ? start - 86400e3 : -Infinity, hi = start != null ? start + 9 * 86400e3 : Infinity
  const cand = (markets || []).filter(m => pat.test(m.title || '') && (() => { const t = new Date(m.close_time).getTime(); return t >= lo && t <= hi })())
  const evClose = {}
  cand.forEach(m => { const ev = eventKey(m); const t = new Date(m.close_time).getTime(); if (!(ev in evClose) || t < evClose[ev]) evClose[ev] = t })
  const first = Object.keys(evClose).sort((a, b) => evClose[a] - evClose[b])[0]
  return cand.filter(m => eventKey(m) === first)
}

// Book map for __marketValue: { win: { <normName>: americanAsk }, t3: {...}, ... } plus raw cents.
// norm = the same normalizer the odds parsers key on. Markets must already carry __mk (see api).
function bookMap(raceMarkets, norm) {
  const book = { win: {}, t3: {}, t5: {}, t10: {}, t20: {} }, raw = {}
  ;(raceMarkets || []).forEach(m => {
    const mk = m.__mk || MARKET_OF[String(m.ticker || '').split('-')[0]]
    if (!book[mk]) return
    const bid = cents(m, 'yes_bid'), ask = cents(m, 'yes_ask'), a = american(ask)
    if (a == null) return
    const k = norm(driverOf(m))
    book[mk][k] = a
    raw[mk + '|' + k] = { bid, ask, ticker: m.ticker }
  })
  return { book, raw }
}

module.exports = { MARKET_OF, TICKERS, SERIES_PAT, american, cents, eventKey, driverOf, pickRaceMarkets, bookMap }

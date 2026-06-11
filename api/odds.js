// api/odds.js — Vercel serverless function
// Proxies The Odds API (theoddsapi.com) for NASCAR betting odds
// Required env var: ODDS_API_KEY  (get a free key at theoddsapi.com)

const SPORT_KEYS = {
  cup:     'motorsport_nascar_cup_series',
  oreilly: 'motorsport_nascar_xfinity_series',
  trucks:  'motorsport_nascar_craftsman_truck_series',
}

const MARKET_KEYS = {
  outrights:             'outrights',
  top_3_finish:          'outrights',
  top_5_finish:          'outrights',
  top_10_finish:         'outrights',
  top_ford_driver:       'outrights',
  top_chevrolet_driver:  'outrights',
  top_toyota_driver:     'outrights',
}

const BOOKMAKERS = ['fanduel','draftkings','betmgm','betrivers','hardrockbet','bet365','thescore']

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { series = 'cup', market = 'outrights' } = req.query

  const apiKey = process.env.ODDS_API_KEY
  if (!apiKey) {
    return res.status(503).json({
      error: 'ODDS_API_KEY not configured',
      setup: 'Add ODDS_API_KEY to your Vercel environment variables. Get a free key at theoddsapi.com',
    })
  }

  const sport = SPORT_KEYS[series] || SPORT_KEYS.cup
  const oddsMarket = MARKET_KEYS[market] || 'outrights'

  // Fetch available events
  let events
  try {
    const eventsResp = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/events?apiKey=${apiKey}`
    )
    if (!eventsResp.ok) {
      const body = await eventsResp.json().catch(() => ({}))
      return res.status(eventsResp.status).json({
        error: body.message || `The Odds API returned ${eventsResp.status}`,
        sport,
      })
    }
    events = await eventsResp.json()
  } catch (err) {
    return res.status(502).json({ error: `Failed to fetch events: ${err.message}` })
  }

  if (!events || events.length === 0) {
    return res.json({
      odds: [], event: null, market, series,
      message: 'No upcoming events found for this series.',
    })
  }

  const event = events[0]

  // Fetch odds for that event
  let oddsData
  try {
    const booksParam = BOOKMAKERS.join(',')
    const oddsResp = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/events/${event.id}/odds?apiKey=${apiKey}&regions=us&markets=${oddsMarket}&bookmakers=${booksParam}&oddsFormat=american`
    )
    if (!oddsResp.ok) {
      const body = await oddsResp.json().catch(() => ({}))
      return res.status(oddsResp.status).json({ error: body.message || `The Odds API returned ${oddsResp.status}` })
    }
    oddsData = await oddsResp.json()
  } catch (err) {
    return res.status(502).json({ error: `Failed to fetch odds: ${err.message}` })
  }

  // Flatten to { driverName: { bookmakerKey: americanOdds } }
  const byDriver = {}
  for (const bookmaker of (oddsData.bookmakers || [])) {
    for (const mkt of (bookmaker.markets || [])) {
      for (const outcome of (mkt.outcomes || [])) {
        const name = outcome.name
        if (!byDriver[name]) byDriver[name] = {}
        byDriver[name][bookmaker.key] = outcome.price
      }
    }
  }

  // Sort by best available odds (highest American number = longest shot at top; you can invert)
  const rows = Object.entries(byDriver).map(([driver, books]) => {
    const vals = Object.values(books).filter(v => typeof v === 'number')
    const best = vals.length > 0 ? Math.max(...vals) : null
    return { driver, books, best }
  })
  rows.sort((a, b) => {
    if (a.best == null) return 1
    if (b.best == null) return -1
    return b.best - a.best
  })

  return res.json({
    odds: rows,
    event: {
      id: event.id,
      name: event.home_team || event.name || 'Upcoming Race',
      commenceTime: event.commence_time,
    },
    market,
    series,
    bookmakers: BOOKMAKERS,
    remainingRequests: oddsData.remainingRequests,
  })
}

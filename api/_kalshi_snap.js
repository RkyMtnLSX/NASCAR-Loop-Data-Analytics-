// api/_kalshi_snap.js - Kalshi price snapshots for the sim's markets (2026-10-11). Served as
// /api/kalshi-snap (vercel.json rewrite -> admin-track?job=kalshi-snap; Hobby 12-function cap).
//
// WHO CALLS IT: Supabase pg_cron every 10 minutes (Vercel Hobby crons are daily and imprecise;
// the database is free and minute-accurate). Authorization: Bearer <SNAP_SECRET>.
//
// WHAT IT DOES: for each series in featured_weekend, if the race is inside its window - a board has
// been published for it and the scheduled green (race_start_utc, from the Monday schedule sync) is
// less than 15 minutes past - pull Kalshi's open markets for win / top 3 / 5 / 10 / 20, match the
// event to the race (title names the series, close_time sits within 2 days after the green), match
// each driver to the entry list by normalized name, and append rows to odds_snapshots as book
// 'kalshi' with odds = the AMERICAN ASK (the price a buyer gets) and the raw bid / ask in cents.
// More than 3 hours before the green it only writes on the top of the hour. Outside the window it
// returns immediately. Grade Center's CLV close = the last snapshot cluster before the green.
//
// Operator (2026-10-11): "we really only need it to fire when we run the simulation and we know what
// time the race is supposed to start" - the publish opens the window, the schedule closes it.
const { createClient } = require('@supabase/supabase-js')
const { american } = require('./_kalshi')

const KALSHI = 'https://api.elections.kalshi.com/trade-api/v2'
const MARKETS = { KXNASCARRACE: 'win', KXNASCARTOP3: 't3', KXNASCARTOP5: 't5', KXNASCARTOP10: 't10', KXNASCARTOP20: 't20' }
// Kalshi titles: "Cup Series: Kyle Larson wins", "Auto Parts: ..." (O'Reilly Auto Parts Series), trucks TBC.
const SERIES_PAT = { cup: /\bcup\b/i, oreilly: /auto parts|o'?reilly|xfinity/i, trucks: /truck|craftsman/i }

const nrm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
const cents = (m, k) => { const d = m[k + '_dollars']; if (d != null && d !== '') return Math.round(parseFloat(d) * 100); const c = m[k]; return (c == null || c === '') ? null : Number(c) }

async function fetchMarkets(seriesTicker) {
  const out = []; let cursor = null
  for (let i = 0; i < 5; i++) {
    const r = await fetch(`${KALSHI}/markets?series_ticker=${seriesTicker}&status=open&limit=1000${cursor ? '&cursor=' + cursor : ''}`, { headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error(`kalshi ${seriesTicker} ${r.status}`)
    const j = await r.json()
    out.push(...(j.markets || []))
    cursor = j.cursor; if (!cursor || !(j.markets || []).length) break
  }
  return out
}

module.exports = async function handler(req, res) {
  const secret = process.env.SNAP_SECRET || process.env.CRON_SECRET
  const auth = req.headers['authorization'] || ''
  if (!secret || auth !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' })
  const force = (req.query || {}).force === '1'
  const sb = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const now = new Date(), year = now.getFullYear()
  const result = {}
  try {
    const { data: cfgs } = await sb.from('featured_weekend').select('series, track_name, race_number, race_start_utc')
    let markets = null   // fetched once, only if some series is in window
    for (const c of (cfgs || [])) {
      const r = { race: `${c.track_name} R${c.race_number}` }
      result[c.series] = r
      if (!c.race_number) { r.skip = 'no race number'; continue }
      const start = c.race_start_utc ? new Date(c.race_start_utc) : null
      if (!start) { r.skip = 'no race_start_utc (run the weekend sync)'; continue }
      const minsToGreen = (start - now) / 60000
      if (!force) {
        if (minsToGreen < -15) { r.skip = 'race started'; continue }
        if (minsToGreen > 180 && now.getUTCMinutes() >= 10) { r.skip = 'hourly only until 3h out'; continue }
        const { data: pub } = await sb.from('sim_results').select('id').eq('series', c.series).eq('race_year', year).eq('race_number', c.race_number).limit(1)
        if (!pub || !pub.length) { r.skip = 'no board published yet'; continue }
      }
      if (!markets) {
        markets = []
        for (const [tk, mk] of Object.entries(MARKETS)) {
          try { (await fetchMarkets(tk)).forEach(m => markets.push({ ...m, __mk: mk })) } catch (e) { r.err = (r.err || '') + e.message + '; ' }
        }
      }
      // this race's event: series named in the title; Kalshi's close_time is the SETTLEMENT deadline,
      // about a week after the green (Charlotte R32 2026-10-11 -> close 10-19), so accept
      // [green - 1d, green + 9d] and, if two events of the series fall in it, keep the earliest close.
      const lo = start.getTime() - 86400e3, hi = start.getTime() + 9 * 86400e3
      const cand = markets.filter(m => SERIES_PAT[c.series] && SERIES_PAT[c.series].test(m.title || '') && (() => { const t = new Date(m.close_time).getTime(); return t >= lo && t <= hi })())
      const evClose = {}; cand.forEach(m => { const ev = (m.event_ticker || '').replace(/^(KXNASCAR\w+?)-/, ''); const t = new Date(m.close_time).getTime(); if (!(ev in evClose) || t < evClose[ev]) evClose[ev] = t })
      const firstEv = Object.keys(evClose).sort((a, b) => evClose[a] - evClose[b])[0]
      const mine = cand.filter(m => (m.event_ticker || '').replace(/^(KXNASCAR\w+?)-/, '') === firstEv)
      if (!mine.length) { r.skip = 'no Kalshi markets matched this race'; continue }
      const { data: ent } = await sb.from('entry_list').select('driver_name').eq('series', c.series).eq('race_year', year).eq('track_name', c.track_name)
      const byN = {}; (ent || []).forEach(e => { byN[nrm(e.driver_name)] = e.driver_name })
      // Fallback (Kalshi "John Hunter Nemechek" vs entry list "John H. Nemechek"): same last name and
      // same first initial, and only one entry fits.
      const byLast = {}; (ent || []).forEach(e => { const t = String(e.driver_name || '').trim().split(/\s+/); const k = nrm(t[t.length - 1]) + '|' + nrm(t[0]).slice(0, 1); (byLast[k] = byLast[k] || []).push(e.driver_name) })
      const match = who => { const d = byN[nrm(who)]; if (d) return d; const t = String(who || '').trim().split(/\s+/); const c = byLast[nrm(t[t.length - 1]) + '|' + nrm(t[0]).slice(0, 1)]; return c && c.length === 1 ? c[0] : null }
      const rows = [], unmatched = new Set(), ts = now.toISOString()
      mine.forEach(m => {
        const who = m.yes_sub_title || m.subtitle || String(m.title || '').replace(/^.*?:\s*/, '').replace(/\s+(wins|finishes.*)$/i, '')
        const name = match(who)
        if (!name) { unmatched.add(who); return }
        const bid = cents(m, 'yes_bid'), ask = cents(m, 'yes_ask')
        const odds = american(ask)
        if (odds == null) return
        rows.push({ series: c.series, track_name: c.track_name, race_year: year, race_number: c.race_number, driver_name: name, market: m.__mk, book: 'kalshi', odds, captured_at: ts, kalshi_bid: bid, kalshi_ask: ask })
      })
      if (rows.length) {
        let { error } = await sb.from('odds_snapshots').insert(rows)
        if (error && /kalshi_bid|kalshi_ask/.test(error.message)) ({ error } = await sb.from('odds_snapshots').insert(rows.map(({ kalshi_bid, kalshi_ask, ...x }) => x)))
        if (error) r.err = (r.err || '') + error.message
      }
      r.written = rows.length; r.markets = mine.length; r.minsToGreen = Math.round(minsToGreen)
      if (unmatched.size) r.unmatched = [...unmatched].slice(0, 12)
    }
    return res.status(200).json({ at: now.toISOString(), force, result })
  } catch (e) {
    return res.status(500).json({ error: e.message, result })
  }
}

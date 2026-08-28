// oddsSectionParser (extracted from SimulationCenter.__marketValue 2026-08-28, code-review m3).
// Parses full-page Ctrl+A sportsbook pastes (FanDuel / Hard Rock) into per-market odds maps.
// BEHAVIOR IS FROZEN: every regex below is verbatim from the inline original; the extraction was
// verified byte-equivalent on fixtures (see oddsSectionParser.test.js) before shipping. If you
// change ANY pattern here, add a fixture reproducing the page that motivated the change.
//
// Bug history this file carries (do not re-learn these the hard way):
//
// GROUP MARKETS (2026-07-12): books publish group markets (Top Chevrolet / Top Ford / Top Toyota /
// Winning Manufacturer / Team of Winner) on the SAME page, AFTER the Top 10 section. Skipping only
// the group HEADER line left `cur` pointing at t10, so every driver under "Top Chevrolet" OVERWROTE
// that driver's top-10 price (Bowman t10 +200 became his top-Chevy +1400) and 34 junk bets
// "qualified". A group header must set cur = null, not just name = null.
//
// SEASON FUTURES (2026-08-28, operator catch, oreilly Daytona): FanDuel put the season futures
// section ("O'Reilly Auto Parts Series 2026 Winner" / "...2026 Outright Winner") on the race page.
// Both headers match the win-market test /winner|outright/i, re-armed cur='win', and the 14
// championship prices OVERWROTE race-winner prices (Hill +300 -> +700, Allgaier +800 -> +125).
// FanDuel never prints the word "futures", so the junk filter missed it. A championship /
// season-long / year+winner line now KILLS the section before header matching. Market headers
// never contain years. DraftKings is exempt by book behavior (operator-confirmed 2026-08-28:
// DK never lists championship futures on the race-odds page).

// Driver-name normalizer shared by every odds map producer and consumer. The maps produced here
// are keyed with THIS function; SimulationCenter looks drivers up with the same one. Change them
// together or not at all.
export function normDriver(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.']/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim()
}

// American odds on a line of their own ("+300", "-115"; unicode minus variants normalized).
function americanOdds(line) {
  const m = line.trim().replace(/[\u2212\u2013\u2014]/g, '-')
  return /^[+\-]\d{2,6}$/.test(m) ? parseInt(m, 10) : null
}

// Section-killer: a championship / season-long futures header. Sets cur = null BEFORE header
// matching, so "…2026 Winner" cannot re-arm the win market. Market headers never contain years.
const FUTURES_SECTION = /championship|season\s*long|20\d\d\s*(winner|outright)|(winner|outright).{0,20}20\d\d/i

// Section-killer: group / novelty markets that share the page below the driver markets.
const GROUP_MARKET = /winning\s+manufacturer|manufacturer\s+of\s+race|top\s+(chevrolet|chevy|ford|toyota)|team\s+of\s+|winning\s+team|odd\s+vs\s+even|grid\s+position|car\s+number\s+of|in-season|matchup/i

// Junk-line filter: page chrome and non-driver text that must clear a pending name (but NOT the
// section) - the !/finish/i exception protects "To Finish Top N" headers that contain these words.
const JUNK_LINE = /ford|toyota|chev|manufacturer|team of|group |chance|in-season| vs |show |MT$|betslip|matchup|special|future|single|parlay|about|career|privacy|terms|faq|responsible|house rule|setting|appearance|download|copyright|build:|server time|^eero|^winner$/i

// Market-header tables per book. Order matters: first match wins.
export const FD_HEADERS = [[/winner|outright/i, 'win'], [/top[\s-]*3/i, 't3'], [/top[\s-]*5/i, 't5'], [/top[\s-]*10/i, 't10']]
export const HR_HEADERS = [[/winner|outright|^race$/i, 'win'], [/top[\s-]*3/i, 't3'], [/top[\s-]*5/i, 't5'], [/top[\s-]*10/i, 't10']]

// Parse one book's full-page paste into { win: {driverKey: odds}, t3: {...}, t5: {...}, t10: {...} }.
// State machine over lines: `cur` = which market section we are inside (null = none), `name` = a
// pending driver name waiting for its price on a following line.
export function parseSect(txt, hdr) {
  const m = { win: {}, t3: {}, t5: {}, t10: {} }
  let cur = null
  let name = null
  ;(txt || '').split('\n').forEach(function (raw) {
    const l = raw.trim().replace(/^\*\s*/, '')
    if (!l) return
    if (FUTURES_SECTION.test(l)) { cur = null; name = null; return }
    for (let h = 0; h < hdr.length; h++) {
      if (hdr[h][0].test(l)) { cur = hdr[h][1]; name = null; return }
    }
    if (GROUP_MARKET.test(l)) { cur = null; name = null; return }
    if (JUNK_LINE.test(l) && !/finish/i.test(l)) { name = null; return }
    const o = americanOdds(l)
    if (o !== null) {
      if (name && cur) m[cur][normDriver(name)] = o
      name = null
    } else if (/[a-zA-Z]{2,}/.test(l)) {
      name = l
    }
  })
  return m
}

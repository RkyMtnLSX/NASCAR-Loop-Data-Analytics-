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

// ---- DraftKings multi-column box (moved here from SimulationCenter.__marketValue 2026-09-05).
// DK COLUMN-ORDER AUTO-DETECT (2026-07-14) -> DK MULTI-PAGE PASTE (2026-09-05). DK prints the driver
// markets as a multi-column box whose header cells name the columns (Race Winner / Top 3 / Top 5
// usually; the order varies). 2026-09-05 (operator, Darlington): DK split the markets across pages -
// cup: Winner / Top 3 / Top 10 on one page and Top 5 alone on another; O'Reilly: Winner / Top 3 on one
// page and Top 5 alone. Both pages pasted together gave a 3-market header set for drivers who each
// carried 2 or 1 numbers, and nothing parsed. The paste is now read as SEGMENTS: every header run (one
// or more consecutive lines made only of market words) sets the column order for the drivers that
// follow until the next header run, and each segment collects exactly its own column count. Top 10 is
// recognised as a column too (it used to be dropped from the winner box). `dflt` is the column order
// used before any header is seen (winner box: win/t3/t5; Top 10 box: t10), so a header-less paste
// behaves exactly as it did before.
function isDkHeaderLine(l) {
  var rest = l.replace(/race\s*-?\s*winner/g, ' ').replace(/top\s*-?\s*\d+\s*finish/g, ' ').replace(/top\s*-?\s*\d+/g, ' ').replace(/\bfinish\b/g, ' ').replace(/\bto win\b/g, ' ').replace(/\bwinner\b/g, ' ').replace(/\boutright\b/g, ' ').replace(/[^a-z0-9]+/g, '').trim();
  return !rest;
}
function dkHeaderMarkets(l) {
  var found = [];
  var m10 = /top\s*-?\s*10/.exec(l);           if (m10) found.push([m10.index, 't10']);
  var m5 = /top\s*-?\s*5(?!\d)/.exec(l);       if (m5) found.push([m5.index, 't5']);
  var m3 = /top\s*-?\s*3(?!\d)/.exec(l);       if (m3) found.push([m3.index, 't3']);
  var mw = /race\s*winner|outright|(^|\s)winner(\s|$)/.exec(l); if (mw) found.push([mw.index, 'win']);
  found.sort(function (a, b) { return a[0] - b[0]; });
  return found.map(function (f) { return f[1]; });
}
export function parseDkPages(txt, dflt) {
  var out = { win: {}, t3: {}, t5: {}, t10: {} }, order = dflt.slice(), inHdr = false, name = null, buf = [];
  var flush = function () { if (name && buf.length >= order.length) { order.forEach(function (mk, ci) { out[mk][normDriver(name)] = buf[ci]; }); } name = null; buf = []; };
  (txt || '').split('\n').forEach(function (raw) {
    var l = raw.trim(); if (!l) return;
    var low = l.toLowerCase();
    if (isDkHeaderLine(low)) {
      var mks = dkHeaderMarkets(low); if (!mks.length) return;   // e.g. a bare "Finish" cell
      if (!inHdr) { flush(); order = []; inHdr = true; }
      mks.forEach(function (mk) { if (order.indexOf(mk) < 0) order.push(mk); });
      return;
    }
    inHdr = false;
    var o = americanOdds(l);
    if (o !== null) { if (name) buf.push(o); }
    else if (/[a-zA-Z]{2,}/.test(l)) { flush(); name = l; }
  });
  flush();
  return out;
}

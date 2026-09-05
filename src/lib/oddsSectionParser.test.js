// Fixture tests for the sportsbook paste parser. Every fixture reproduces a REAL incident -
// if you touch a regex in oddsSectionParser.js, these must pass, and any new book-layout bug
// gets its page added here as the regression fixture. Run: CI=true npm test
import { parseSect, parseDkPages, FD_HEADERS, HR_HEADERS, normDriver } from './oddsSectionParser'

// FIXTURE 1 - the 2026-08-28 FanDuel futures incident (oreilly Daytona, Winn-Dixie 250).
// FanDuel put "O'Reilly Auto Parts Series 2026 Winner" on the race page; the championship
// prices overwrote race-winner prices (Hill +300 -> +700, Allgaier +800 -> +125).
const FD_FUTURES_PAGE = `* Winn-Dixie 250
* Race Winner
* Austin Hill
+300
Jesse Love
+500
Justin Allgaier
+800
* Carson Kvapil
+1000
Brent Crews
+2000
Parker Retzlaff
+3000
* Joey Gase
+40000
1:00pm MT
* Show less
*
* O'Reilly Auto Parts Series 2026 Winner
* O'Reilly Auto Parts Series 2026 Outright Winner
* Justin Allgaier
+125
Brent Crews
+500
Austin Hill
+700
* Parker Retzlaff
+25000
Nov 7, 3:00pm MT
* Show less`

test('season futures section never re-arms the win market (2026-08-28 incident)', () => {
  const r = parseSect(FD_FUTURES_PAGE, FD_HEADERS)
  expect(r.win[normDriver('Austin Hill')]).toBe(300)      // race price, not +700 championship
  expect(r.win[normDriver('Jesse Love')]).toBe(500)
  expect(r.win[normDriver('Justin Allgaier')]).toBe(800)   // not +125
  expect(r.win[normDriver('Brent Crews')]).toBe(2000)      // race price, not +500 futures
  expect(r.win[normDriver('Parker Retzlaff')]).toBe(3000)  // not +25000
  expect(r.win[normDriver('Joey Gase')]).toBe(40000)
  expect(Object.keys(r.win)).toHaveLength(7)               // futures section contributed nothing
})

// FIXTURE 2 - the 2026-07-12 group-market incident. "Top Chevrolet" after the Top 10 section
// left cur='t10' in the old code, so group prices overwrote top-10 prices (Bowman +200 -> +1400).
const GROUP_MARKET_PAGE = `To Finish Top 10
Alex Bowman
+200
Kyle Larson
-150
Top Chevrolet
Alex Bowman
+1400
Kyle Larson
+250`

test('group markets kill the section instead of leaking into it (2026-07-12 incident)', () => {
  const r = parseSect(GROUP_MARKET_PAGE, FD_HEADERS)
  expect(r.t10[normDriver('Alex Bowman')]).toBe(200)   // not his top-Chevy +1400
  expect(r.t10[normDriver('Kyle Larson')]).toBe(-150)
})

// FIXTURE 3 - Hard Rock bare "Race" header (renamed from the winner market, 2026-08-14) plus
// name normalization (accents, suffixes, periods) and unicode minus.
const HR_PAGE = `Race
Daniel Suárez Jr.
+1200
A.J. Allmendinger
−400
To Finish Top 3
Ricky Stenhouse Jr
+800`

test('HR bare Race header, accents/suffixes/periods, unicode minus', () => {
  const r = parseSect(HR_PAGE, HR_HEADERS)
  expect(r.win[normDriver('Daniel Suarez')]).toBe(1200)
  expect(r.win[normDriver('AJ Allmendinger')]).toBe(-400)
  expect(r.t3[normDriver('Ricky Stenhouse')]).toBe(800)
})

test('empty and null input return empty markets', () => {
  for (const txt of ['', null, undefined]) {
    const r = parseSect(txt, FD_HEADERS)
    expect(r).toEqual({ win: {}, t3: {}, t5: {}, t10: {} })
  }
})

test('legitimate market headers are never killed by the futures guard', () => {
  // The exact headers both books use today - none may match the section-killer.
  for (const h of ['Race Winner', 'To Finish Top 3', 'To Finish Top 5', 'To Finish Top 10', 'Race', 'Top 10 Finish']) {
    const r = parseSect(h + '\nKyle Larson\n+100', h === 'Race' ? HR_HEADERS : FD_HEADERS)
    const total = Object.keys(r.win).length + Object.keys(r.t3).length + Object.keys(r.t5).length + Object.keys(r.t10).length
    expect(total).toBe(1)
  }
})

// ---- DraftKings multi-page pastes (2026-09-05, Darlington). DK split the driver markets across
// two pages: cup Winner / Top 3 / Top 10 + a Top 5 page; O'Reilly Winner / Top 3 + a Top 5 page.
// Pasted one after the other, the old single-header parser produced nothing.
const DK_CUP_P1 = `Cook Out Southern 500
Race Winner
Top 3
Top 10
Denny Hamlin
+600
+180
-200
Tyler Reddick
+900
+250
-150
Chase Briscoe
+1200
+330
-120`
const DK_CUP_P2 = `Cook Out Southern 500
Top 5
Denny Hamlin
-110
Tyler Reddick
+120
Chase Briscoe
+150`
const DK_ORE_P1 = `Sport Clips Haircuts VFW Help A Hero 200
Race Winner
Top 3
Justin Allgaier
+400
+110
Jesse Love
+550
+140`
const DK_ORE_P2 = `Sport Clips Haircuts VFW Help A Hero 200
Top 5
Justin Allgaier
-180
Jesse Love
-140`

test('DK cup: Winner/Top3/Top10 page + Top 5 page pasted together', () => {
  const m = parseDkPages(DK_CUP_P1 + '\n' + DK_CUP_P2, ['win', 't3', 't5'])
  expect(m.win['denny hamlin']).toBe(600)
  expect(m.t3['denny hamlin']).toBe(180)
  expect(m.t10['denny hamlin']).toBe(-200)
  expect(m.t5['denny hamlin']).toBe(-110)
  expect(m.t5['chase briscoe']).toBe(150)
  expect(Object.keys(m.win)).toHaveLength(3)
  expect(Object.keys(m.t5)).toHaveLength(3)
})

test('DK oreilly: Winner/Top3 page + Top 5 page pasted together (either order)', () => {
  for (const txt of [DK_ORE_P1 + '\n' + DK_ORE_P2, DK_ORE_P2 + '\n' + DK_ORE_P1]) {
    const m = parseDkPages(txt, ['win', 't3', 't5'])
    expect(m.win['jesse love']).toBe(550)
    expect(m.t3['jesse love']).toBe(140)
    expect(m.t5['jesse love']).toBe(-140)
    expect(Object.keys(m.t10)).toHaveLength(0)
  }
})

test('DK normal week: one header run, unchanged behaviour; tab-joined header; no header at all', () => {
  const one = `Race Winner\nTop 3\nTop 5\nKyle Larson\n+500\n+150\n-130\nWilliam Byron\n+700\n+200\n-110`
  const m = parseDkPages(one, ['win', 't3', 't5'])
  expect(m.win['kyle larson']).toBe(500); expect(m.t3['kyle larson']).toBe(150); expect(m.t5['kyle larson']).toBe(-130)
  const tab = `Top 5\tTop 3\tRace Winner\nKyle Larson\n-130\n+150\n+500`
  const t = parseDkPages(tab, ['win', 't3', 't5'])
  expect(t.win['kyle larson']).toBe(500); expect(t.t5['kyle larson']).toBe(-130)
  const none = parseDkPages(`Kyle Larson\n+500\n+150\n-130\nJunk Line\n+100`, ['win', 't3', 't5'])
  expect(none.win['kyle larson']).toBe(500); expect(none.win['junk line']).toBeUndefined()
  const t10 = parseDkPages(`Kyle Larson\n-300\nWilliam Byron\n-250`, ['t10'])
  expect(t10.t10['william byron']).toBe(-250)
})

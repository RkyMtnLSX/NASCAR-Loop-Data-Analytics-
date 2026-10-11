// scripts/test-penalties.js - regression suite for the pit-penalty parser in src/lib/pitFeeds.js.
// Port of the operator's test_penalties_v3.py (2026-08-31): the parser has to be right before it
// touches the table. Three groups: RECOVERED (phrasings v2 dropped), NO REGRESSION (v2 got right),
// NO FALSE PENALTY (a car merely MENTIONED must never be charged - the important one, since the
// rankings add 1.75s per crew penalty). Exits 1 on any failure. Run: node scripts/test-penalties.js
const { parseNote } = require('../src/lib/pitFeeds')
const parse = s => { const o = {}; parseNote(s).pairs.forEach(([car, , cat]) => { o[car] = cat }); return o }
const eq = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())

const RECOVERED = [
  ['Pit road speeding penalty for #12 Blaney.', { 12: 'driver' }],
  ['A penalty for too fast entering pit road goes to #12.', { 12: 'driver' }],
  ['Uncontrolled tire penalty on #12.', { 12: 'crew' }],
  ['Too many men over the wall for #20.', { 20: 'crew' }],
  ['A penalty is issued to #12.', { 12: 'other' }],
  ['Safety violation on the #47 crew.', { 47: 'crew' }],
  ['Uncontrolled tire for #20 as #5 takes the lead.', { 20: 'crew' }],
  ['Speeding penalty for #12 as #43 cycles to the front.', { 12: 'driver' }],
  ['Too many men over the wall for #20, and #5 restarts second.', { 20: 'crew' }],
]
const GRID = [
  ['To the rear: #4, #22 (unapproved adjustments)', { 4: 'grid', 22: 'grid' }],
  ['To the rear: #6, #23, #60 (unapproved adjustments)', { 6: 'grid', 23: 'grid', 60: 'grid' }],
  ['To the rear: #10, #51 (unapproved adjustments)', { 10: 'grid', 51: 'grid' }],
  ['To the rear: #1, #5, #12, #20 (unapproved adjustments)', { 1: 'grid', 5: 'grid', 12: 'grid', 20: 'grid' }],
  ['#48 goes to the rear for unapproved adjustments.', { 48: 'grid' }],
  ['#5, #12, #20 and #43 were all caught speeding.', { 5: 'driver', 12: 'driver', 20: 'driver', 43: 'driver' }],
  ['#1, #5, #12, #20, #22, #24 and #43 were all caught speeding.', { 43: 'driver' }],
  ['#71 will start from the tail end of the field after failing inspection.', { 71: 'grid' }],
]
const NO_REGRESSION = [
  ['NASCAR has penalized #12 Blaney for speeding on pit road.', { 12: 'driver' }],
  ['#12 is penalized for an uncontrolled tire.', { 12: 'crew' }],
  ['#20 penalized for too many men over the wall.', { 20: 'crew' }],
  ['#5 is penalized for speeding and #20 for an uncontrolled tire.', { 5: 'driver', 20: 'crew' }],
  ['#43 serves his penalty while #12 takes the lead.', { 43: 'other' }],
  ['#5 and #12 are both penalized for speeding.', { 5: 'driver', 12: 'driver' }],
]
const REAL_PIT_LISTS = [
  ['#41, #43, #19, #48, #6, #10, #15, #8, #16, #9, #31, #34, #20, #4, #23, #38, #21, #18, #3, #42, #47 all pit with two to go #42 penalized for crew over the wall too soon', { 42: 'crew' }],
  ['#16, #7, #98, #97, #00, #29, #10, #9, #39, #26, #81, #11, #44, #43, #345, #42, #4, #6, #36 stay out with others pitting, #5 had an uncontrolled tire, #21 slid through his box', { 5: 'crew' }],
  ['#11, #18, #10, #3, #21, #23, #42, #47, #77, #24, #50, #45, #6, #7, #66, #51, #27, #99 pit #45 long stop as crew works on right rear #42 penalized for improper fueling', { 42: 'crew' }],
  ['#2, #20, #23, #22, #12, #19, #31, #14, #17, #77, #42, #9, #15, #4, #21, #34, #7, #41 pit with others staying out, #42 was removing equipment after the gas can got stuck', { 42: 'crew' }],
]
const NO_FALSE_PENALTY = [
  ['Uncontrolled tire for #20 as #5 takes the lead.', '5'],
  ['#20 penalized for an uncontrolled tire while #5 stays out.', '5'],
  ['Too many men over the wall for #20, and #5 restarts second.', '5'],
  ['Speeding penalty for #12 as #43 cycles to the front.', '43'],
  ['#12 leads #5 by two seconds at the line.', '5'],
  ['#43 pits from the lead as #12 stays out.', '12'],
]
const NO_GRID_LEAK = [
  'To the rear: #4, #22 (unapproved adjustments)',
  'To the rear: #6, #23, #60 (unapproved adjustments)',
  '#48 goes to the rear for unapproved adjustments.',
  '#71 will start from the tail end of the field after failing inspection.',
]

let failures = 0
for (const [title, cases] of [['RECOVERED', RECOVERED], ['GRID (pre-race)', GRID], ['REAL PIT-LISTS (mass-attribution guard)', REAL_PIT_LISTS], ['NO REGRESSION', NO_REGRESSION]]) {
  console.log(title)
  for (const [sent, want] of cases) {
    const got = parse(sent); const ok = eq(got, want); failures += ok ? 0 : 1
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${sent.slice(0, 56).padEnd(58)} -> ${JSON.stringify(got)}${ok ? '' : '   wanted ' + JSON.stringify(want)}`)
  }
}
console.log('NO FALSE PENALTY')
for (const [sent, car] of NO_FALSE_PENALTY) { const got = parse(sent); const ok = !(car in got); failures += ok ? 0 : 1; console.log(`  ${ok ? 'PASS' : 'FAIL'}  #${car} absent? ${sent.slice(0, 44).padEnd(46)} -> ${JSON.stringify(got)}`) }
console.log('NO GRID LEAK into crew/driver')
for (const sent of NO_GRID_LEAK) { const got = parse(sent); const leaked = Object.entries(got).filter(([, k]) => k === 'crew' || k === 'driver').map(([c]) => c); const ok = !leaked.length; failures += ok ? 0 : 1; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${sent.slice(0, 54).padEnd(56)} -> ${leaked.length ? leaked : 'clean'}`) }
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASS')
process.exit(failures ? 1 : 0)

// src/lib/simEngine.js
//
// The race simulation, extracted from SimulationCenter.js on 2026-08-30.
//
// WHY: every model change we have discussed - the DNF constant refresh, the
// leader-wreck laps-led gap, any future caution layer - can only be VALIDATED by
// running the sim over historical boards and comparing its output to what actually
// happened. That was impossible while the engine lived inside a React component:
// it only ran in a browser, one board at a time, with a human clicking.
//
// Nothing here was rewritten. This is the same code, moved. It had no React, DOM,
// or Supabase dependency at all - it was pure already, just co-located with a UI.
// Keeping it pure is the point: scripts/ can import it, and so can the page.
//
// The two entry points are buildSpeedScores(drivers, weights) and
// runRaceSim(drivers, simConfig). Everything else is the constants and curves they
// need. If you change a constant here you are changing the product - see
// BACKTEST_LOG for which ones are measurements and which are fitted parameters.

const SERIES_TABS = [
  { value: 'cup',     label: 'Cup Series' },
  { value: 'oreilly', label: "O'Reilly Series" },
  { value: 'trucks',  label: 'Truck Series' },
]

export const DEFAULT_WEIGHTS = {
  pitCrew:      0.06, // SHIPPED 2026-07-18: task #46 passed (crew t~7.5 pooled, + in all series/track groups; weight from sweep plateau shrunk ~30% — BACKTEST_LOG)
  corrHistory:  0.35,
  longRunPace:  0.15,
  startPos:     0.23, // 2026-08-20 (was 0.33): 230-race full-model sweep, all series INT+SHORT ovals 2023+ — 0.23 beats 0.33 on t10 Brier 134W/96L (p~.01), wins/ties t5+win; 0.43 loses badly. Old 0.33 came from 11/29/40-race mostly-cup sets. EXCEPTION: trucks short/flat keeps 0.33 (TRUCK_SHORT_WEIGHTS — .23 loses t5 12W/19L there). BACKTEST_LOG 2026-08-20.
  trackHistory: 0.15,
}

// Trucks short/flat ovals: the ONE cell where the 2026-08-20 sweep favored HIGH start weight
// (t5 12W/19L against lowering; .43 slightly beat .33 but n=31 — keep the validated 0.33).
export const TRUCK_SHORT_WEIGHTS = {
  pitCrew:      0.06,
  corrHistory:  0.35,
  longRunPace:  0.15,
  startPos:     0.33,
  trackHistory: 0.15,
}

// Road course-specific weights.
// startPos reduced -- observed overpenalization of strong road course cars with poor qualifying
// (Hemric P32->2nd, Grala P16->3rd at San Diego 2026). raceCraft (quality pass %) added:
// captures meaningful passing in traffic, correlates with road/street course survival.
export const ROAD_COURSE_WEIGHTS = {
  pitCrew:      0.06, // SHIPPED 2026-07-18: task #46 passed (crew t~7.5 pooled, + in all series/track groups; weight from sweep plateau shrunk ~30% — BACKTEST_LOG)
  corrHistory:  0.60,  // race craft 0.25 folded here 2026-07-07 (Cup + 8-race truck road sweep: raceCraft redundant w/ rating)
  longRunPace:  0.25,  // CONSOLIDATED 2026-07-12: absorbs shortRun+falloff (practice total unchanged at 0.25)  // fewer laps at road courses, still useful
  startPos:     0.15,  // backed by r=0.416 correlation across 682 obs
  trackHistory: 0.00,
}

const ROAD_COURSE_TRACKS = [
  'sonoma', 'watkins glen', 'cota', 'circuit of the americas',
  'road america', 'roval', 'indianapolis road', 'portland', 'chicago street',
  'coronado', 'mexico', 'lime rock',
]

export const SUPERSPEEDWAY_WEIGHTS = {
  pitCrew:      0.06, // SHIPPED 2026-07-18: task #46 passed (crew t~7.5 pooled, + in all series/track groups; weight from sweep plateau shrunk ~30% — BACKTEST_LOG)   // Daytona / Talladega / Atlanta - pack racing (no practice; start near-noise)
  corrHistory:  0.55,  // SS-group avg rating - main pack skill signal (+0.05 from cut raceCraft)
  longRunPace:  0.00,  // practice useless at pack tracks (and absent)
  startPos:     0.15,  // pack racing negates qualifying; kept low
  trackHistory: 0.30,  // drafting instinct is persistent + track-specific
}

// O'Reilly superspeedways: adds a win-conversion signal (win=1.0, top5=0.35, year-weighted).
// Rewards pack-race CLOSERS (Austin Hill: 9/20 SS wins, 4 Atlanta wins) over steady-but-winless
// drivers whose avg driver_rating is inflated by consistency. Leak-free O'Reilly SS backtest:
// winner-market hit rate 16% -> 42% vs rating-only; matches FanDuel Hill +260 / Love +500.
export const ONEILLY_SUPERSPEEDWAY_WEIGHTS = {
  pitCrew:      0.06, // SHIPPED 2026-07-18: task #46 passed (crew t~7.5 pooled, + in all series/track groups; weight from sweep plateau shrunk ~30% — BACKTEST_LOG)
  corrHistory:   0.45,
  longRunPace:   0.00,
  startPos:      0.15,
  trackHistory:  0.20,
  winConversion: 0.20,
}

export const TRUCK_ROAD_WEIGHTS = {
  pitCrew:      0.06, // SHIPPED 2026-07-18: task #46 passed (crew t~7.5 pooled, + in all series/track groups; weight from sweep plateau shrunk ~30% — BACKTEST_LOG)   // Trucks road courses (2026-07-07, 9-race sweep): startPos leans higher than Cup, raceCraft 0
  corrHistory:  0.55,
  longRunPace:  0.25,
  startPos:     0.20,  // sweep monotonic 10->25; trucks reward qualifying/start more than Cup road ringers
  trackHistory: 0.00,
}

function isRoadCourse(trackName) {
  if (!trackName) return false
  const t = trackName.toLowerCase()
  return ROAD_COURSE_TRACKS.some(rc => t.includes(rc))
}

const CAUTION_PRESETS_BY_SERIES = {
  cup: [
    { label: 'Low',    value: 4,  noise: 10 },
    { label: 'Medium', value: 8,  noise: 16 },
    { label: 'High',   value: 15, noise: 25 },
  ],
  trucks: [
    { label: 'Low',    value: 4,  noise: 15 },
    { label: 'Medium', value: 8,  noise: 23 },
    { label: 'High',   value: 15, noise: 35 },
  ],
  oreilly: [
    { label: 'Low',    value: 4,  noise: 12 },
    { label: 'Medium', value: 8,  noise: 18 },
    { label: 'High',   value: 15, noise: 28 },
  ],
}
const getCautionPresets = (sv) => CAUTION_PRESETS_BY_SERIES[sv] || CAUTION_PRESETS_BY_SERIES.cup
const CAUTION_PRESETS = CAUTION_PRESETS_BY_SERIES.cup

function isSuperspeedway(trackName) {
  const t = (trackName || '').toLowerCase()
  return t.indexOf('daytona') >= 0 || t.indexOf('talladega') >= 0 || t.indexOf('atlanta') >= 0 || t.indexOf('echopark') >= 0
}

function __trackGroup(trackName) {
  const t = (trackName || '').toLowerCase()
  if (isSuperspeedway(trackName)) return 'SS'
  if (isRoadCourse(trackName)) return 'ROAD'
  if (/bristol|martinsville|richmond|wilkesboro|bowman|iowa|phoenix|raceway park|milwaukee|lucas oil|memphis|dover|new hampshire|rockingham/.test(t)) return 'SHORT'
  return 'INT'
}

const DNF_PRESETS = [
  { label: 'Low',    value: 0.05 },
  { label: 'Medium', value: 0.15 },
  { label: 'High',   value: 0.25 },
]

// EMPIRICAL DNF RATES by series x correlation group (2026-07-14).
// Measured from loop_data, 2022-2026, exhibition races excluded, DNF = completed < 90 pct of the
// winner's laps. n is large (390-2405 driver-races per cell) and the Cup cells are stable across
// eras (cup Intermediate 12.8 -> 12.5, cup Superspeedway 17.8 -> 19.4).
// Used as the FALLBACK when a track has little or no history of its own -- e.g. North Wilkesboro,
// where Cup has ZERO races, so the old code fell through to a hard-coded Medium (0.15) against a
// true short-track rate of 0.081. That is ~2x the real attrition, and it buries every contender's
// floor. See BACKTEST_LOG.
// REFRESHED 2026-08-30 to match the live rule. These are FALLBACKS only: a track
// with 8+ races of its own history has conf = 1 and the measured rate wins outright.
//
// Why they had to move. The live rate is `(status !== 'running') || (laps < 90% of
// winner)`. Until 2026-08-30 finish_status was a laps<90% guess, so the status
// branch was inert and the two agreed. loop_data now carries NASCAR's real
// classification on every row (zero left on the old 'running'/'dnf' vocabulary),
// so the status branch fires and the measured rate rose - while these constants,
// taken on 2026-07-14, still encoded the OLD rule. The function was blending a
// new-rule trackAvg against an old-rule base: 0.255 vs 0.184 at cup superspeedways,
// a 7-point contradiction inside one function, worst exactly where the fallback
// matters (a low-history track like North Wilkesboro).
//
// Measured under the live rule, 2022-2026, exhibitions excluded, per-race rates
// averaged. Race counts per cell: cup 46/27/66/29, oreilly 34/31/63/28,
// trucks 38/13/44/14.
//
// Sanity-checked before adopting: the rows the status branch newly counts finish at
// 77.6% of field on average, 60.7% in the bottom quarter, 2.0% in the top half -
// genuinely back-of-field, which is what the sim's dnf flag means.
//
// STILL OPEN, deliberately: whether the sim's DNF BUDGET should equal the observed
// retirement rate at all. A late wreck that is classified 29th is a retirement but
// not the same object as a car parked at half distance; dnfLap ordering absorbs some
// of that difference and it has not been shown to absorb all of it. That question
// wants the registered treatment the 2026-08-29 placement-tail calibration got.
// This change only removes the self-contradiction, in the direction of the more
// accurate measurement. To revert, the pre-2026-08-30 values are in git history.
const DNF_BY_GROUP = {
  cup:     { 'Short & Flat Tracks': 0.091, 'Road Course': 0.095, 'Intermediate': 0.155, 'Superspeedway': 0.255 },
  oreilly: { 'Short & Flat Tracks': 0.163, 'Road Course': 0.187, 'Intermediate': 0.135, 'Superspeedway': 0.284 },
  trucks:  { 'Short & Flat Tracks': 0.147, 'Road Course': 0.214, 'Intermediate': 0.149, 'Superspeedway': 0.240 },
}
const DNF_SERIES_MEAN = { cup: 0.145, oreilly: 0.178, trucks: 0.168 }
// DNF_CAP raised 0.30 -> 0.40 on 2026-08-30, in the same motion as the constant
// refresh above and for the same reason. The cap is a rail against a garbage
// measurement, not a modelling opinion, and 0.30 was set when the old rule put the
// worst cell at ~0.22. Under the live rule three REAL track cells now exceed it -
// oreilly Daytona 0.329, cup Daytona 0.319, trucks Talladega 0.306 - so leaving it
// would have silently truncated the highest-attrition tracks on the schedule, which
// are the plate races where the DNF model matters most. Raising the base rates
// without raising the rail would have been a quiet distortion of exactly the wrong
// races. 0.40 clears the observed maximum (0.329) with headroom while still
// catching an obviously broken value.
const DNF_FLOOR = 0.03, DNF_CAP = 0.40

// #51 wreck-v1 (2026-07-28): event-based accident DNFs. The accident share of the DNF budget
// is spent through multi-car wreck events bootstrapped from 359 real races (lap-note accident
// events >=2 cars joined to weekend-feed finishing_status). Victims are position-adjacent
// clusters in running order; involved survivors lose ~1.6-2.9 positions; mechanical DNFs stay
// independent draws. dnfRate remains the TOTAL calibrated budget. Toy gate PASSED (BACKTEST_LOG
// 2026-07-28): sim accDNF/race matches observed within ~1 at every quartile, SS mean 8.18 vs 8.24.
const WRECK_ACC_SHARE = { SHORT: 0.63, INT: 0.70, SS: 0.85, ROAD: 0.50 }
// SHORT surv 1.6 -> 16 (2026-08-29 pre-registered placement-tail calibration, BACKTEST_LOG):
// at 1.6 a wrecked-but-running car lost ~2 score pts vs noise 16 (~1 position) - elites never
// failed, so mid-pack top10s starved (slots are conserved). Fit 2022-24 on win+t5+t10+fin25
// bands jointly (noise mult stayed 1.0); holdout 2025-26 chi-sq 182 -> 20, 21/24 cells within
// 1.25 SE; 2 cells just past 2 SE - operator-approved ship 2026-08-29. DO NOT retune in-sample.
// INT surv 2.5 -> 18 (same registered protocol, same day): elite fin>=25 was 9.5 sim vs 14.3
// real, backmarkers over-buried. Holdout chi-sq 165 -> 36, 23/24 cells better/equal; known
// residual: t10 ranks 16-20 overshoots (traces to Indy-board harness mid-pack strength).
// Operator-approved ship 2026-08-29. Forward judge: reliability on future SHORT/INT boards.
const WRECK_SURV_COST = { SHORT: 16, INT: 18, SS: 2.9, ROAD: 2.7 }
const WRECK_P = { SHORT: { a: 0.165, b: 0.179, c: 0.261 }, INT: { a: 0.200, b: 0.189, c: 0.235 }, SS: { a: 0.270, b: 0.321, c: 0.335 }, ROAD: { a: 0.090, b: 0.070, c: 0.128 } }
// Overlap-corrected normalizer (2026-07-28): raw sum(size x P) per group is SHORT 2.90 /
// INT 3.47 / SS 10.57 / ROAD 3.07, but cluster overlap + field-edge clamping eat 6-17% of
// draws (30k-sim MC), undershooting the dnfRate budget. Values below are raw x realized
// factor (0.940 / 0.895 / 0.829 / 0.926) so realized accident DNFs land ON budget.
const WRECK_EV_EXP = { SHORT: 2.73, INT: 3.11, SS: 8.76, ROAD: 2.84 }
// PER-BUCKET normalizers (derived 2026-08-31, same method as the 2026-07-28 originals: raw
// sum(size x P) over the pool times the MC-realized overlap/field-edge factor, 200k iters, n=38).
//
// WHY THESE EXIST. The globals above were calibrated on 2026-07-28 when there was ONE wreck pool
// per group. The calm/typical/chaotic pools landed the SAME DAY (wreck-v1.1-cb) and the normalizer
// was never re-derived, so it became a pooled average across three pools whose expected accident
// counts differ 3-5x. That is the whole of the 0.5x / 0.9x / 1.4x attrition spread — and, via the
// hard <6 / <11.5 caution bucketing, the cliff that put cup Talladega on half its real attrition.
//
// The archive's one-line justification ("Normalizer stays GLOBAL per group, so the preset now
// modulates realized attrition around the dnfRate budget BY DESIGN") is a declaration, not an
// argument, and it was written the same day the pools were introduced. Per-bucket was proposed
// once (BACKTEST_LOG 2026-08-31, "a proposal, not a decision") and never built until now.
//
// This scales the ACCIDENT layer only. dnfRate's mechanical share is untouched — which is what
// makes it a different intervention from the levelNormalize path that failed gate C by scaling
// both layers and flattening the low probability bins.
//
// SHIPPED 2026-08-31, operator-approved. Five repaired gates at 6 runs each: boundary jump
// 73.2% -> 3.0%; DNF bias -0.53 -> -0.11 cars/race; top10 Brier -9.10e-5 against a null of
// 6.81e-5 (real); win and top5 inside the null band in both directions; fin>=25 placement band
// moved less than the null's own movement. The case for it is STABILITY, not accuracy: 17 of 60
// track cells (28%) flip caution preset at least once as their prior mean updates across
// seasons — cup Martinsville ranges 4.00-7.00, cup Las Vegas 7.00-12.00 — and under the old
// pooled normalizer every one of those flips swung simmed attrition by ~73%.
const WRECK_EV_EXP_B = {
  SHORT: { low: 0.921, mid: 2.209, high: 4.779 },
  INT:   { low: 0.976, mid: 2.741, high: 5.593 },
  SS:    { low: 3.737, mid: 8.621, high: 12.069 },
  ROAD:  { low: 0.948, mid: 2.693, high: 4.608 },
}
// gxc-v3.1-dnfLL (2026-07-28): DNF'd drivers keep the laps they led before wrecking. Measured
// share of laps led by eventual DNFers (weekend-feed statuses x loop laps_led, 370 races):
// SHORT 2.0% / INT 8.2% / SS 17.3% / ROAD 4.1% — old sim credited 0%. DNFers join LL/FL
// allocation ranked by score at weight min(1, dnfLap x B), B calibrated per group by MC.
// B >= 6 saturates (full credit past ~17% distance): at INT/SS led laps are effectively banked.
// Saturated fit lands SS ~14% vs 17.3 measured — residual is unmodeled leader-wreck correlation.
const WRECK_LL_B = { SHORT: 0.71, INT: 6, SS: 6, ROAD: 0.77 }
// wreck-v1.1 (2026-07-28): pools bucketed by event count terciles (calm/typical/chaotic) and
// selected by the caution preset bucket (__cb low/mid/high) so wreck frequency, dominator LL
// curves, and noise tell ONE story per sim. [size, lapFraction] per event, one inner array per
// historical race. Budget note (REVISED 2026-08-31): the normalizer used to stay GLOBAL per
// group, so a low-caution forecast simmed UNDER the dnfRate budget and a high one OVER it, with
// only the unconditional mean on budget. That is no longer true — WRECK_EV_EXP_B normalizes each
// pool against its own expected accident count, so every preset lands on budget and the caution
// preset no longer moves attrition at all. It still selects the wreck pool (so wreck SHAPE, who
// gets collected and when), the noise width, and the LL/FL dominator curves. dnfRate is now the
// only dial that changes how many cars retire.
const WRECK_SETS = {"SHORT":{"low":[[],[],[],[],[],[],[],[[4,0.96]],[[5,0.52]],[[5,0.23]],[[4,0.95]],[[2,0.33]],[[8,0.3]],[[2,0.48]],[[3,0.19],[2,0.9]],[[3,0.23],[3,0.93]],[[2,0.98],[4,1]],[[2,0],[3,0.88]],[[4,0.92],[8,0.96]],[[4,0.54],[6,0.88]],[[2,0.08],[3,0.34]],[[3,0.16],[4,0.98]],[[2,0.66],[4,0.72]],[[3,0.03],[16,0.7]],[[5,0.33],[3,0.34]],[[3,0.17],[3,0.51]],[[3,0.29],[2,0.36]],[[2,0],[2,0.36]],[[2,0.45],[15,0.5]]],"mid":[[[2,0.43],[4,0.76]],[[3,0],[4,0.71]],[[2,0.56],[2,0.76]],[[5,0.96],[7,1]],[[6,0],[2,0.34]],[[2,0],[3,0.64],[2,0.87]],[[2,0.01],[9,0.61],[2,0.63]],[[2,0.05],[5,0.67],[2,1]],[[3,0.24],[5,0.43],[5,0.95]],[[3,0.02],[2,0.33],[3,0.83]],[[4,0.56],[3,0.61],[3,0.83]],[[2,0.65],[2,0.77],[3,0.93]],[[9,0.06],[2,0.62],[6,0.74]],[[5,0.17],[6,0.41],[2,0.69]],[[3,0.55],[2,0.78],[3,0.91]],[[2,0.2],[3,0.26],[14,0.81]],[[2,0.12],[4,0.32],[5,0.62]],[[2,0.09],[3,0.41],[3,0.44]],[[3,0.27],[8,0.62],[7,0.64],[2,0.86]],[[2,0],[3,0.02],[6,0.66],[2,0.69]],[[4,0.01],[3,0.23],[5,0.54],[5,0.63]],[[3,0.17],[9,0.9],[9,0.93],[2,0.97]],[[3,0.18],[3,0.5],[2,0.58],[2,0.88]],[[11,0.6],[2,0.67],[2,0.9],[3,0.95]],[[8,0.03],[13,0.32],[2,0.69],[2,0.85]],[[3,0.04],[3,0.26],[2,0.88],[4,0.92]],[[2,0.07],[8,0.21],[2,0.32],[2,0.64]],[[2,0],[2,0.36],[5,0.6],[4,0.8]],[[6,0.01],[4,0.59],[4,0.74],[11,0.96]]],"high":[[[7,0.01],[2,0.83],[10,0.86],[9,0.87]],[[2,0],[2,0.18],[2,0.28],[5,0.39],[7,0.55]],[[2,0.2],[5,0.28],[2,0.42],[5,0.75],[2,1]],[[3,0.21],[2,0.27],[4,0.37],[13,0.39],[3,0.73]],[[2,0],[2,0.13],[6,0.76],[2,0.87],[4,0.9]],[[3,0],[5,0.19],[12,0.24],[2,0.73],[10,0.75]],[[5,0.33],[3,0.67],[11,0.7],[9,0.81],[9,0.94]],[[5,0.21],[2,0.43],[5,0.54],[9,0.55],[2,0.61],[2,0.65]],[[4,0],[3,0.43],[3,0.78],[9,0.82],[11,0.96],[13,1]],[[2,0.34],[3,0.6],[5,0.73],[2,0.81],[15,0.95],[10,1]],[[2,0.15],[3,0.29],[2,0.32],[3,0.39],[2,0.74],[2,0.8]],[[2,0.19],[3,0.54],[4,0.73],[5,0.79],[4,0.88],[2,0.91]],[[3,0.28],[3,0.39],[5,0.63],[12,0.66],[2,0.74],[6,0.79]],[[4,0.1],[2,0.18],[2,0.5],[4,0.75],[2,0.77],[2,0.79]],[[2,0.58],[7,0.6],[2,0.63],[2,0.65],[2,0.69],[4,0.72]],[[3,0],[3,0.47],[2,0.58],[6,0.62],[2,0.68],[6,0.72]],[[2,0],[2,0],[2,0.01],[4,0.04],[3,0.5],[2,0.68],[2,0.97]],[[2,0.03],[2,0.31],[5,0.67],[3,0.73],[5,0.82],[7,0.91],[12,0.95]],[[4,0.5],[2,0.56],[5,0.64],[2,0.66],[2,0.69],[6,0.87],[8,0.96]],[[2,0.2],[3,0.29],[2,0.54],[2,0.56],[2,0.59],[2,0.71],[3,0.73]],[[2,0],[6,0.32],[3,0.85],[8,0.91],[3,0.95],[7,0.97],[5,1]],[[3,0.01],[3,0.07],[2,0.36],[2,0.55],[6,0.86],[3,0.89],[2,1]],[[2,0],[2,0.03],[2,0.36],[5,0.76],[2,0.88],[3,0.92],[4,0.96]],[[3,0.1],[2,0.23],[2,0.26],[2,0.53],[3,0.62],[4,0.73],[2,0.77],[5,0.8]],[[3,0.19],[3,0.3],[4,0.33],[4,0.49],[2,0.79],[8,0.83],[5,0.89],[3,0.95]],[[2,0.07],[2,0.12],[2,0.57],[3,0.74],[4,0.79],[2,0.84],[3,0.9],[3,0.94]],[[2,0.13],[3,0.23],[2,0.53],[4,0.57],[4,0.79],[21,0.94],[4,0.96],[4,1]],[[6,0.02],[6,0.26],[4,0.3],[2,0.49],[5,0.51],[2,0.55],[4,0.55],[2,0.69],[13,0.69]],[[10,0],[11,0],[17,0],[3,0.2],[2,0.37],[5,0.39],[8,0.45],[4,0.53],[6,0.65],[4,1]]]},"INT":{"low":[[],[],[],[],[],[],[],[],[],[],[],[],[[13,0.13]],[[2,0.31]],[[2,0.1]],[[3,0.43]],[[2,0.54]],[[10,0.83]],[[2,0.64]],[[8,0.27]],[[7,0.45]],[[3,0.16]],[[2,0.84]],[[6,0.72]],[[3,0.3]],[[4,0.49]],[[2,0]],[[2,0.81]],[[2,0.57]],[[2,0.57]],[[5,0.01]],[[8,0.67]],[[2,0.78]],[[5,0.86]],[[2,0.37]],[[2,0.79]],[[5,0.38]],[[13,0.14]],[[6,0.24]],[[2,0.17],[3,0.2]],[[2,0.37],[4,0.95]],[[6,0.2],[3,0.7]],[[4,0.67],[7,1]],[[3,0],[9,0.49]],[[2,0.02],[2,0.45]],[[2,0.32],[4,0.51]],[[7,0.5],[3,0.87]],[[7,0.27],[10,0.49]],[[6,0.01],[3,0.41]],[[8,0.67],[2,0.78]],[[2,0.51],[2,0.59]],[[2,0],[2,0.69]],[[2,0],[12,0.76]],[[15,0.56],[7,0.97]],[[7,0.34],[2,0.73]]],"mid":[[[16,0.01],[2,0.67]],[[3,0.87],[8,0.9]],[[2,0.01],[3,0.23]],[[2,0],[7,0.51]],[[3,0],[4,0.64]],[[6,0.71],[10,0.73]],[[6,0],[8,0.31]],[[2,0.3],[6,0.34]],[[3,0],[5,0.52]],[[11,0.33],[19,0.92]],[[3,0.72],[3,0.82]],[[7,0.01],[11,0.52]],[[9,0.6],[5,0.7]],[[5,0.01],[4,0.87]],[[5,0.01],[4,0.87]],[[2,0],[6,0.25]],[[8,0],[2,0.18]],[[2,0.82],[4,0.97]],[[2,0.84],[2,0.91]],[[3,0.06],[9,0.6]],[[11,0.79],[2,0.92],[3,0.92]],[[2,0.13],[5,0.39],[13,0.66]],[[5,0.49],[3,0.86],[3,0.95]],[[2,0.42],[3,0.49],[3,0.55]],[[2,0.03],[10,0.08],[4,0.26]],[[2,0.05],[2,0.7],[3,0.96]],[[5,0.66],[5,0.69],[6,0.74]],[[2,0.02],[2,0.08],[3,0.59]],[[3,0.86],[3,0.88],[13,0.94]],[[2,0.06],[2,0.87],[2,0.92]],[[4,0.02],[8,0.83],[2,0.92]],[[3,0.1],[2,0.54],[9,0.96]],[[4,0.64],[6,0.97],[9,0.98]],[[7,0.17],[11,1],[10,1]],[[2,0.76],[5,0.8],[4,0.88]],[[2,0.81],[13,0.84],[8,0.93]],[[5,0.01],[6,0.51],[2,0.67]],[[4,0.14],[3,0.85],[6,0.88]],[[13,0.42],[7,0.45],[17,0.77]],[[3,0],[5,0.26],[11,0.29]],[[5,0.35],[7,0.64],[6,0.84]],[[8,0.01],[2,0.04],[3,0.09]],[[6,0.06],[3,0.56],[4,0.6]],[[6,0.01],[3,0.02],[13,0.57]],[[6,0.37],[5,0.41],[3,0.46]],[[6,0],[5,0.13],[2,0.47],[2,1]],[[2,0.21],[2,0.38],[4,0.41],[14,0.44]],[[3,0.01],[6,0.22],[3,0.81],[4,0.84]],[[2,0],[2,0.07],[2,0.32],[4,0.63]],[[3,0.31],[5,0.61],[7,0.87],[6,0.9]],[[2,0],[8,0.1],[11,0.49],[2,0.69]],[[5,0.64],[3,0.81],[2,0.92],[6,0.96]],[[6,0.07],[4,0.62],[3,0.7],[3,0.93]],[[2,0],[2,0.1],[2,0.8],[7,0.82]],[[8,0.66],[2,0.75],[2,0.95],[6,0.99]],[[5,0],[6,0.31],[4,0.7],[3,0.96]]],"high":[[[2,0.2],[7,0.29],[6,0.39],[6,1]],[[2,0.04],[6,0.27],[5,0.35],[3,0.46]],[[3,0.28],[2,0.66],[4,0.98],[6,1]],[[3,0.07],[8,0.75],[6,0.78],[10,0.8]],[[2,0.35],[3,0.38],[5,0.4],[2,0.43]],[[10,0],[10,0.42],[2,0.55],[6,0.57]],[[2,0.15],[2,0.32],[2,0.56],[11,0.65]],[[2,0.33],[2,0.77],[16,0.79],[16,0.98]],[[7,0],[6,0.92],[8,0.96],[5,1]],[[4,0.55],[2,0.6],[15,0.87],[9,0.95]],[[3,0.28],[4,0.6],[18,0.75],[2,0.85]],[[9,0.01],[3,0.19],[5,0.51],[7,0.51]],[[10,0.01],[3,0.09],[2,0.36],[2,0.92]],[[4,0],[4,0.01],[2,0.19],[3,0.67],[12,0.89]],[[3,0.33],[8,0.42],[6,0.51],[5,0.53],[2,0.91]],[[2,0],[9,0.17],[5,0.26],[2,0.52],[6,0.79]],[[12,0.36],[5,0.39],[4,0.85],[5,0.9],[8,0.92]],[[5,0.63],[12,0.66],[2,0.94],[14,0.95],[5,0.98]],[[6,0],[4,0.06],[4,0.28],[11,0.49],[3,0.6]],[[9,0],[5,0.56],[3,0.59],[3,0.89],[3,0.91]],[[2,0],[3,0.16],[3,0.55],[7,0.88],[7,0.93]],[[10,0.01],[6,0.4],[3,0.58],[3,0.75],[2,0.94]],[[4,0.11],[3,0.28],[3,0.39],[6,0.5],[8,0.61]],[[3,0.19],[6,0.24],[2,0.32],[13,0.53],[2,0.72]],[[2,0.3],[4,0.33],[2,0.37],[3,0.89],[2,0.94]],[[2,0],[2,0],[3,0.46],[6,0.58],[3,0.69],[5,0.79]],[[5,0],[3,0.22],[2,0.47],[2,0.61],[4,0.84],[3,1]],[[4,0],[4,0.04],[2,0.11],[3,0.84],[4,0.96],[16,0.98]],[[2,0],[2,0.17],[2,0.5],[3,0.8],[2,0.9],[6,0.92]],[[3,0.27],[4,0.33],[2,0.37],[2,0.65],[2,0.76],[5,1]],[[2,0],[3,0.05],[2,0.3],[4,0.46],[11,0.85],[4,0.9]],[[3,0],[4,0.07],[8,0.09],[5,0.2],[4,0.82],[3,0.95]],[[4,0.18],[3,0.2],[4,0.3],[2,0.78],[4,0.93],[12,0.96]],[[2,0.03],[2,0.06],[2,0.37],[4,0.58],[2,0.93],[8,1]],[[4,0.01],[3,0.41],[3,0.54],[3,0.77],[2,0.93],[4,1]],[[3,0.38],[4,0.73],[2,0.9],[13,0.92],[15,0.95],[7,1]],[[3,0.03],[6,0.33],[2,0.41],[7,0.72],[2,0.79],[8,0.84]],[[4,0.01],[2,0.07],[4,0.16],[2,0.29],[2,0.59],[2,0.66]],[[6,0.01],[2,0.43],[2,0.62],[2,0.8],[5,0.88],[2,0.96]],[[11,0.16],[2,0.23],[4,0.38],[4,0.49],[3,0.52],[4,0.8],[3,0.97]],[[4,0],[9,0.02],[3,0.55],[10,0.61],[5,0.66],[3,0.72],[5,0.81]],[[7,0.32],[7,0.62],[8,0.63],[3,0.81],[2,0.85],[4,0.87],[5,0.91]],[[8,0],[7,0.03],[2,0.1],[5,0.5],[2,0.75],[11,0.91],[8,0.97]],[[3,0.27],[4,0.49],[4,0.61],[9,0.64],[12,0.71],[3,1],[5,1]],[[9,0.21],[2,0.41],[4,0.54],[2,0.67],[4,0.73],[4,0.94],[8,0.99],[5,1]],[[3,0],[4,0.26],[4,0.29],[2,0.57],[2,0.89],[2,0.93],[9,0.96],[7,0.99]],[[5,0.02],[2,0.84],[3,0.86],[5,0.91],[8,0.93],[7,0.97],[6,1],[2,1]],[[2,0],[10,0.01],[6,0.05],[2,0.09],[3,0.35],[3,0.53],[2,0.93],[5,0.96],[6,1]],[[9,0],[4,0.32],[16,0.43],[12,0.49],[4,0.51],[5,0.57],[6,0.61],[5,0.64],[12,0.85]],[[9,0],[6,0.01],[5,0.08],[10,0.25],[4,0.38],[6,0.42],[4,0.83],[12,0.88],[3,0.94]],[[3,0],[4,0.06],[7,0.28],[4,0.58],[3,0.6],[2,0.74],[10,0.81],[15,0.92],[16,0.98]],[[2,0.19],[7,0.41],[5,0.44],[2,0.5],[2,0.58],[6,0.69],[4,0.9],[7,0.91],[5,0.93],[8,0.94]],[[2,0],[5,0.18],[3,0.37],[2,0.44],[3,0.52],[5,0.63],[2,0.66],[8,0.94],[7,0.96],[6,0.98],[3,1]],[[6,0.07],[6,0.1],[8,0.25],[2,0.26],[2,0.27],[6,0.5],[2,0.54],[8,0.69],[3,0.72],[3,0.73],[2,0.9]],[[5,0],[4,0],[3,0.05],[6,0.2],[3,0.25],[5,0.43],[6,0.62],[6,0.8],[5,0.89],[7,0.95],[3,0.98]],[[2,0],[4,0.33],[5,0.35],[7,0.37],[8,0.43],[3,0.47],[6,0.55],[27,0.58],[3,0.67],[8,0.88],[4,0.95],[6,0.97]]]},"SS":{"low":[[[20,0.58]],[[2,0.34]],[[6,0.9]],[[3,0.36]],[[8,0.7]],[[9,0.55]],[[10,0.13],[6,0.53]],[[4,0.28],[14,1]],[[13,0.32],[2,0.87]],[[3,0.83],[6,1]],[[21,0.96],[2,1]],[[2,0.48],[2,0.86]],[[3,0.77],[2,0.98]],[[8,0.01],[11,1]],[[2,0.28],[5,0.8]],[[14,0.19],[12,0.78],[5,0.82]],[[2,0],[3,0.59],[5,0.67]],[[3,0],[12,0.73],[6,0.8]],[[3,0.23],[3,0.55],[6,0.71]],[[7,0.44],[8,0.78],[13,0.93]]],"mid":[[[11,0.23],[5,0.28],[16,0.6]],[[8,0.04],[5,0.11],[2,0.93]],[[27,0.61],[3,0.96],[6,1]],[[2,0.19],[6,0.41],[8,0.8],[3,1]],[[4,0.16],[11,0.33],[4,0.49],[12,0.6]],[[8,0.37],[5,0.48],[9,0.51],[6,0.73]],[[3,0.07],[12,0.48],[4,0.87],[30,0.95]],[[3,0.21],[12,0.54],[5,0.98],[2,1]],[[11,0.45],[20,0.67],[7,0.84],[8,1]],[[9,0.05],[6,0.9],[9,0.94],[12,1]],[[13,0.15],[5,0.42],[7,0.45],[8,0.93]],[[3,0.04],[2,0.49],[8,0.83],[4,1]],[[8,0.03],[4,0.65],[11,0.87],[7,1]],[[7,0.31],[4,0.62],[6,0.64],[5,0.93],[7,1]],[[12,0.18],[4,0.3],[13,0.48],[3,0.56],[11,0.85]],[[18,0.18],[14,0.56],[10,0.86],[19,0.96],[10,1]],[[3,0.07],[3,0.25],[3,0.42],[2,0.72],[9,1]],[[3,0],[2,0.3],[11,0.52],[2,0.94],[2,0.95]],[[6,0.31],[14,0.35],[9,0.93],[11,0.98],[17,1]],[[10,0.22],[33,0.27],[3,0.42],[3,0.68],[2,0.87]],[[3,0.08],[3,0.12],[14,0.17],[2,0.93],[9,1]]],"high":[[[2,0.04],[6,0.74],[3,0.77],[7,0.88],[12,1]],[[6,0.03],[11,0.29],[17,0.43],[22,0.62],[27,1]],[[7,0.61],[2,0.74],[3,0.92],[9,0.97],[8,1]],[[6,0.3],[11,0.35],[18,0.65],[2,0.73],[6,0.95],[8,0.97]],[[3,0.18],[25,0.21],[10,0.72],[5,0.94],[14,0.97],[9,1]],[[7,0.34],[2,0.43],[4,0.5],[8,0.66],[3,0.84],[2,0.96]],[[19,0.01],[2,0.21],[2,0.52],[2,0.68],[2,0.77],[5,0.93]],[[11,0.33],[4,0.59],[2,0.69],[10,0.76],[8,0.94],[4,1]],[[4,0.1],[12,0.56],[2,0.7],[6,0.86],[14,0.93],[19,1]],[[3,0.35],[3,0.57],[2,0.58],[5,0.86],[6,0.94],[11,0.99]],[[15,0.19],[4,0.2],[13,0.31],[7,0.75],[8,0.95],[9,0.97],[8,1]],[[6,0.39],[10,0.52],[6,0.6],[5,0.64],[4,0.81],[14,0.86],[17,0.93]],[[2,0.38],[7,0.56],[9,0.69],[4,0.77],[2,0.88],[4,0.97],[12,1]],[[7,0.02],[17,0.25],[2,0.42],[6,0.5],[8,0.53],[6,0.96],[4,1]],[[11,0.3],[8,0.38],[2,0.46],[9,0.59],[12,0.83],[3,0.88],[14,0.95]],[[14,0.01],[4,0.23],[7,0.25],[2,0.62],[8,0.77],[18,0.83],[5,0.96]],[[7,0.26],[5,0.35],[2,0.7],[2,0.85],[12,0.88],[11,0.93],[5,0.97]],[[4,0.31],[8,0.39],[4,0.53],[4,0.62],[5,0.67],[3,0.78],[12,0.92],[7,1]],[[13,0.38],[10,0.57],[3,0.65],[4,0.84],[17,0.9],[13,0.95],[5,0.99],[12,1]],[[5,0.19],[13,0.31],[4,0.38],[4,0.43],[5,0.81],[9,0.86],[7,0.93],[4,1]],[[15,0.06],[2,0.16],[5,0.56],[2,0.72],[6,0.78],[3,0.85],[7,0.93],[18,1]]]},"ROAD":{"low":[[[3,1]],[[4,0.59],[2,0.92]],[[4,0.03],[7,0.99]],[[2,0.32],[2,0.99]],[[2,0.44],[3,0.58],[6,0.8]],[[5,0.08],[6,0.39],[4,0.56]],[[2,0.16],[5,0.23],[4,0.84]],[[4,0],[9,0.17],[6,0.36]],[[2,0.31],[9,0.44],[3,0.58]],[[3,0.82],[2,0.97],[5,1]],[[5,0.19],[2,0.58],[5,0.76],[2,0.92]],[[2,0],[3,0.07],[5,0.9],[4,0.94]],[[6,0],[4,0.71],[8,0.87],[4,0.97]],[[2,0],[5,0.55],[8,0.58],[3,0.6]]],"mid":[[[2,0],[6,0.35],[6,0.87],[2,0.96],[8,0.99]],[[5,0],[2,0],[7,0.01],[3,0.28],[3,0.82]],[[4,0.02],[7,0.07],[2,0.37],[2,0.7],[2,0.82]],[[2,0],[2,0.54],[2,0.74],[9,0.92],[10,0.99]],[[2,0.22],[7,0.35],[14,0.47],[2,0.64],[3,0.81]],[[8,0.01],[6,0.09],[2,0.3],[6,0.53],[10,1]],[[8,0],[6,0.02],[10,0.09],[14,0.71],[3,0.78]],[[8,0.44],[3,0.71],[2,0.86],[5,0.9],[3,1]],[[4,0.24],[2,0.45],[8,0.88],[3,0.95],[3,1]],[[2,0],[2,0],[4,0.02],[2,0.36],[2,0.71],[4,0.91]],[[6,0.28],[2,0.36],[3,0.37],[4,0.51],[2,0.64],[2,0.83]],[[2,0.4],[20,0.49],[4,0.8],[8,0.85],[12,0.9],[11,0.95]],[[10,0],[4,0],[4,0.88],[10,0.96],[6,0.96],[11,0.99],[5,1]],[[10,0.22],[11,0.43],[11,0.52],[3,0.86],[3,0.88],[3,0.93],[6,1]]],"high":[[[3,0],[11,0.01],[5,0.27],[3,0.41],[2,0.66],[5,0.8],[10,0.96]],[[2,0.33],[10,0.5],[2,0.61],[7,0.89],[8,0.93],[11,0.99],[5,1]],[[4,0],[3,0.06],[11,0.45],[12,0.62],[2,0.72],[7,0.95],[2,0.97]],[[2,0.08],[2,0.16],[9,0.32],[2,0.34],[7,0.43],[4,0.51],[2,0.67]],[[11,0],[2,0.04],[3,0.7],[6,0.72],[5,0.73],[8,0.81],[2,0.84],[4,0.92]],[[6,0],[2,0.03],[5,0.32],[2,0.37],[11,0.5],[2,0.59],[2,0.6],[2,0.78]],[[13,0.26],[6,0.28],[19,0.44],[4,0.55],[3,0.72],[7,0.83],[4,0.86],[4,1]],[[4,0],[3,0.14],[5,0.26],[3,0.49],[7,0.64],[2,0.74],[5,0.83],[5,0.87],[8,1]],[[3,0.01],[3,0.02],[3,0.09],[7,0.15],[9,0.23],[4,0.31],[3,0.6],[2,0.83],[11,0.93],[9,0.99]],[[8,0],[8,0],[11,0.05],[12,0.33],[3,0.39],[5,0.45],[2,0.53],[11,0.84],[3,0.93],[4,1]],[[2,0.22],[3,0.28],[3,0.42],[4,0.55],[5,0.56],[3,0.67],[11,0.91],[5,0.95],[8,0.97],[4,0.98]],[[7,0],[4,0],[3,0.05],[2,0.12],[9,0.3],[6,0.63],[4,0.79],[18,0.9],[3,0.91],[9,0.96]],[[3,0],[9,0.01],[3,0.03],[5,0.11],[14,0.29],[6,0.36],[5,0.4],[6,0.64],[9,0.99],[3,1]],[[13,0.01],[4,0.04],[4,0.05],[18,0.18],[2,0.22],[14,0.53],[4,0.82],[8,0.87],[5,0.89],[9,0.96],[3,1]],[[4,0],[8,0.01],[4,0.04],[3,0.09],[17,0.15],[5,0.24],[2,0.71],[11,0.8],[6,0.83],[8,0.91],[14,0.95],[12,0.99]]]}}

// Resolve a CONTINUOUS dnf rate. The old code bucketed the measured rate into Low/Medium/High,
// which injected up to +/-5 pts of rounding error (cup Superspeedway measures 18.4 pct and was
// being rounded DOWN to the 15 pct Medium bucket; cup Short & Flat measures 8.1 pct and was
// rounded DOWN to the 5 pct Low bucket). Buckets are kept only as manual overrides.
// trackAvg is shrunk toward the group rate by conf = min(1, nTrackRaces / 8).
// SKILL-TILTED DNF ALLOCATION (2026-08-31). OFF unless a board passes skillTilt:true.
// Registered study — BACKTEST_LOG 2026-08-31. NOT SHIPPED without reading that.
//
// The sim gives every car the same retirement probability. Reality does not, and the shape of
// the difference is the whole problem. Two earlier parameterizations failed:
//
//   v1  logistic slope on log-ODDS, applied as a multiplier on PROBABILITY. Wrong scale; the
//       strong end over-extended and the best quartile's top10 Brier got WORSE.
//   v2  same thing refit with a LOG link. Correct scale, still wrong SHAPE — the observed
//       profile is STEEP THROUGH THE MIDDLE and FLAT AT BOTH ENDS, and an exponential in
//       percentile is the opposite. No scale factor reconciles the two ends; turning it down
//       to save the favourites collapses the tail, and vice versa.
//
// v3, this one, does not assume a shape. It is a MULTIPLIER CURVE anchored at the four field
// quartiles and calibrated by iterative proportional fitting against what the sim DELIVERS on
// train boards (scripts/calibrate-tilt-tiers.js). Calibrating on delivered rather than on the
// raw data matters, because the sim ALREADY back-loads attrition by ~1.22x on its own: wreck
// victims are ord[Math.min(n-1, seed+j)], so events seeded near the end of the running order
// clamp repeatedly onto the last car. IPF absorbs that artifact instead of stacking on it.
//
// Anchors are at percentile 0.875 / 0.625 / 0.375 / 0.125 (quartile midpoints), linear between,
// flat outside. Rescaled to mean 1 over the field, so THE BUDGET IS UNCHANGED and only its
// allocation moves.
const DNF_TILT_CURVE = {
  SHORT: [0.5005, 0.9912, 1.0662, 1.4421],
  INT: [0.9084, 0.8314, 1.0935, 1.1668],
  SS: [0.8210, 1.0315, 1.1764, 0.9711],
  ROAD: [0.7895, 0.7940, 1.1552, 1.2613],
}
const __TILT_ANCHOR = [0.875, 0.625, 0.375, 0.125]

// LEVEL correction, calibrated on TRAIN with the curve in place (max tier error 0.49 pts).
// This is the OTHER half of the fix and the two only work together. The sim under-delivers
// its own budget by ~13% because of the caution-preset interaction found earlier the same day
// (BACKTEST_LOG 2026-08-31): the preset is auto-set from a track's MEAN cautions and the
// wreck pools modulate around the budget, so a point estimate lands under it.
//
// Fix C tried to correct that level UNIFORMLY and failed its holdout — raising a flat rate
// retires the favourites more, which is the wrong direction. With the curve in place the extra
// attrition lands on the cars that actually retire, so the same level correction now PASSES.
// Do not apply one without the other.
const DNF_TILT_LEVEL = 1.15

// rescale=false implements the ONE-SIDED form registered in BACKTEST_LOG 2026-08-31 (commit
// 8a76a87). The mean-1 normalization below is what forces the strongest tier DOWN whenever the
// weak tiers are raised — under a fixed field budget you cannot lift the bottom without cutting
// the top, and that is the mechanism behind the -23.40e-5 Q4 top10 regression that stopped the
// earlier tilt from shipping. With C_t = obs_t/pred_t each tier lands on its own observed rate
// and the field total follows automatically, so normalizing here would UNDO the calibration.
// Default stays true: the legacy DNF_TILT_CURVE path is unchanged.
function __tiltMults(pct, curve, rescale) {
  const n = pct.length
  const m = new Float64Array(n)
  if (!curve) { m.fill(1); return m }
  let sum = 0
  for (let i = 0; i < n; i++) {
    const p = pct[i]
    let v
    if (p >= __TILT_ANCHOR[0]) v = curve[0]
    else if (p <= __TILT_ANCHOR[3]) v = curve[3]
    else {
      let k = 0
      while (k < 2 && p < __TILT_ANCHOR[k + 1]) k++
      const t = (__TILT_ANCHOR[k] - p) / (__TILT_ANCHOR[k] - __TILT_ANCHOR[k + 1])
      v = curve[k] + t * (curve[k + 1] - curve[k])
    }
    m[i] = v; sum += v
  }
  if (rescale === false) return m
  const k = n / sum
  for (let i = 0; i < n; i++) m[i] *= k
  return m
}

function resolveDnfRate(series, groupLabel, trackAvg, nTrackRaces) {
  const grp = (DNF_BY_GROUP[series] || DNF_BY_GROUP.cup)[groupLabel]
  const base = (grp != null) ? grp : (DNF_SERIES_MEAN[series] || 0.13)
  let v = base
  if (trackAvg != null && isFinite(trackAvg) && nTrackRaces > 0) {
    const conf = Math.min(1, nTrackRaces / 8)
    v = trackAvg * conf + base * (1 - conf)
  }
  return Math.max(DNF_FLOOR, Math.min(DNF_CAP, v))
}

function gaussNoise() {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function dkFinishPts(pos) {
  if (!pos || pos <= 0 || isNaN(pos)) return 0
  const table = [0,45,42,41,40,39,38,37,36,35,34,32,31,30,29,28,27,26,25,24,23,21,20,19,18,17,16,15,14,13,12,10,9,8,7,6,5,4,3,2,1]
  return pos <= 40 ? table[pos] : 0
}

// 2026-07-23: caution-bucket dominator curves (loop_data 2022-26, share of race laps led /
// fastest laps by finish position, bucketed by races.total_cautions: low <=5 n122, mid 6-8 n138,
// high >=9 n97; races with <50 total laps-led rows excluded). REPLACES pooled curve + flatten:
// the pooled curve already embedded caution spreading, so flatten diluted dominance TWICE
// (sim winner share ~24% vs measured 36.7% at low cautions). BACKTEST_LOG 2026-07-23.
const LL_CURVES = { low: [0.3652,0.135,0.0746,0.0669,0.0327,0.0448,0.0248,0.0152,0.0127,0.0213,0.0121,0.0143,0.0107,0.0048,0.0116,0.011,0.0172,0.0092,0.0064,0.0095,0.0028,0.007,0.008,0.0053,0.0074,0.0047,0.0041,0.0072,0.003,0.0093,0.0036,0.0043,0.0043,0.0047,0.0066,0.0113,0.0048,0.0007,0.0003,0.0007], mid: [0.3199,0.1027,0.0724,0.0751,0.031,0.0394,0.0288,0.0198,0.0196,0.0157,0.0184,0.0109,0.0098,0.0096,0.0154,0.0098,0.0143,0.0106,0.0082,0.0069,0.0097,0.0061,0.0128,0.0179,0.011,0.0081,0.0044,0.0186,0.0115,0.0082,0.0134,0.0097,0.0073,0.0057,0.0077,0.0051,0.0029,0.0014,0.0002,0], high: [0.2415,0.0965,0.0664,0.071,0.0471,0.0482,0.0233,0.0366,0.0264,0.0181,0.0152,0.0216,0.0135,0.013,0.0097,0.0133,0.0096,0.0198,0.0079,0.0082,0.0169,0.0112,0.0073,0.0166,0.0127,0.0165,0.0063,0.012,0.0063,0.0135,0.0124,0.0189,0.0095,0.0043,0.0157,0.0102,0.0019,0.0009,0,0] }
const FL_CURVES = { low: [0.2025,0.1217,0.0676,0.0642,0.0408,0.0458,0.029,0.0349,0.0213,0.0257,0.0217,0.0186,0.0208,0.0173,0.0125,0.0171,0.0202,0.0144,0.0128,0.0143,0.0103,0.0142,0.0119,0.0095,0.0098,0.0141,0.0106,0.0097,0.0081,0.0119,0.0093,0.0098,0.0085,0.0092,0.0129,0.0094,0.0051,0.0012,0.0012,0.0002], mid: [0.1858,0.0948,0.0755,0.0583,0.0429,0.0392,0.0338,0.028,0.0252,0.0208,0.0254,0.019,0.0161,0.0161,0.0177,0.0166,0.0145,0.0124,0.0111,0.0107,0.0122,0.0111,0.017,0.0176,0.0143,0.0155,0.015,0.0167,0.016,0.012,0.0182,0.0183,0.0099,0.011,0.0094,0.0119,0.0062,0.0032,0.0002,0.0004], high: [0.1647,0.0831,0.0734,0.0642,0.0491,0.0517,0.0244,0.0312,0.0258,0.0264,0.0187,0.0212,0.0211,0.0169,0.0212,0.0164,0.0143,0.0205,0.0133,0.0137,0.0168,0.0154,0.0111,0.0168,0.0166,0.0173,0.0123,0.0133,0.0106,0.019,0.0149,0.0155,0.0098,0.0101,0.0137,0.0088,0.0032,0.003,0.0004,0] }

// gxc-v3 (2026-07-25, task #71 part 1): dominator curves by TRACK GROUP x caution bucket.
// Winner LL share varies wildly by group (SS 18.2 / INT 30.4 / SHORT 37.2 / ROAD 42.5 pct) -
// the pooled cbucket curves starved road/short dominators and overfed SS leaders. Cells with
// n<20 races fall back to the group-pooled curve at GENERATION time (SS-low/high, ROAD-mid/high).
// Global cbucket curves retained below as runtime fallback for unmapped groups.
const LL_CURVES_G = { SHORT: { low: [0.4099,0.1578,0.0781,0.073,0.0496,0.0502,0.0251,0.0127,0.003,0.0238,0.0097,0.0069,0.0084,0.0011,0.0121,0.008,0.0044,0.0132,0.0062,0.0017,0.0037,0.0028,0.0004,0.0073,0,0.0001,0.0087,0.009,0,0,0,0.0001,0.0031,0.003,0.0044,0,0.0023,0,0,0], mid: [0.4121,0.1152,0.0492,0.0741,0.0516,0.0492,0.0231,0.0059,0.0307,0.0258,0.0339,0.0044,0.0021,0.0016,0.0078,0.0036,0.0244,0.0074,0.0048,0.0051,0.0097,0.0002,0.0047,0.0092,0.0028,0.004,0.0017,0.0093,0.0073,0.0104,0.0002,0.0008,0,0.0072,0.0006,0,0,0,0,0], high: [0.3073,0.1048,0.0765,0.0612,0.0499,0.0681,0.0207,0.0319,0.0286,0.0291,0.0096,0.0185,0.0219,0.0074,0.0069,0.0026,0.0094,0.0208,0.0099,0.0015,0.0114,0.009,0.0025,0.0103,0.007,0.0084,0.0039,0.0117,0.01,0.0026,0.0063,0.0067,0.0064,0.0027,0.0091,0.0056,0,0,0,0] }, INT: { low: [0.3526,0.1519,0.0857,0.0904,0.0224,0.0456,0.0152,0.0136,0.0181,0.0198,0.0161,0.0057,0.0133,0.0047,0.0119,0.0209,0.0134,0.0065,0.0012,0.0099,0.0019,0.0049,0.013,0.0051,0.0041,0.0033,0.001,0.0063,0.0011,0.0086,0,0.0026,0.0029,0.0079,0.0026,0.0153,0.0003,0.0001,0,0], mid: [0.3198,0.1333,0.0974,0.0809,0.0236,0.0292,0.0212,0.0262,0.0107,0.0118,0.015,0.0052,0.0153,0.0085,0.0155,0.0117,0.0059,0.0064,0.0056,0.0035,0.005,0.0019,0.0054,0.0144,0.0187,0.0067,0.0023,0.0224,0.01,0.0056,0.0149,0.0114,0.0038,0.006,0.0073,0.0093,0.0052,0.0031,0,0], high: [0.1959,0.0934,0.0585,0.0889,0.0475,0.0395,0.0224,0.0402,0.0225,0.0102,0.0195,0.0192,0.0067,0.0118,0.0139,0.0275,0.0086,0.0139,0.0068,0.0103,0.0207,0.0091,0.0097,0.022,0.013,0.0202,0.01,0.0046,0.0035,0.0243,0.0157,0.0254,0.0136,0.0069,0.0266,0.013,0.0034,0.0009,0,0] }, SS: { low: [0.1798,0.0531,0.057,0.0551,0.0279,0.0372,0.0418,0.021,0.0244,0.021,0.0126,0.038,0.0106,0.0218,0.0175,0.0102,0.0216,0.0182,0.019,0.0156,0.0153,0.0258,0.019,0.0278,0.0187,0.02,0.0093,0.0243,0.0183,0.0223,0.0218,0.0187,0.0188,0.0045,0.0127,0.009,0.0064,0.0012,0.0011,0.0015], mid: [0.1723,0.0574,0.0504,0.0608,0.0283,0.0519,0.0492,0.0201,0.0261,0.0177,0.0106,0.0223,0.0093,0.0235,0.0233,0.0167,0.0241,0.0231,0.0198,0.0095,0.0155,0.0224,0.0198,0.0396,0.0083,0.0178,0.0127,0.021,0.023,0.0137,0.0259,0.0071,0.0245,0.0056,0.0182,0.0046,0.0031,0.0002,0.001,0], high: [0.1798,0.0531,0.057,0.0551,0.0279,0.0372,0.0418,0.021,0.0244,0.021,0.0126,0.038,0.0106,0.0218,0.0175,0.0102,0.0216,0.0182,0.019,0.0156,0.0153,0.0258,0.019,0.0278,0.0187,0.02,0.0093,0.0243,0.0183,0.0223,0.0218,0.0187,0.0188,0.0045,0.0127,0.009,0.0064,0.0012,0.0011,0.0015] }, ROAD: { low: [0.4505,0.132,0.055,0.028,0.036,0.0469,0.0367,0.0257,0.0115,0.0118,0.0085,0.0083,0.0073,0.0086,0.0084,0.0013,0.0356,0.0112,0.0035,0.0111,0,0.0006,0.0021,0,0.0037,0.0071,0.0014,0,0.0008,0.0008,0.002,0,0.0011,0.0005,0.0133,0.0175,0.0093,0.002,0,0], mid: [0.4491,0.1032,0.0611,0.046,0.0297,0.0413,0.0342,0.0265,0.0121,0.0083,0.009,0.0141,0.0073,0.0063,0.0106,0.0009,0.0249,0.0101,0.0024,0.0144,0.0053,0.0007,0.0178,0.0009,0.0037,0.0052,0.0012,0.0061,0.0006,0.0005,0.0047,0.0103,0.0008,0.0004,0.01,0.0122,0.0065,0.0014,0,0], high: [0.4491,0.1032,0.0611,0.046,0.0297,0.0413,0.0342,0.0265,0.0121,0.0083,0.009,0.0141,0.0073,0.0063,0.0106,0.0009,0.0249,0.0101,0.0024,0.0144,0.0053,0.0007,0.0178,0.0009,0.0037,0.0052,0.0012,0.0061,0.0006,0.0005,0.0047,0.0103,0.0008,0.0004,0.01,0.0122,0.0065,0.0014,0,0] } }
const FL_CURVES_G = { SHORT: { low: [0.1965,0.1289,0.0818,0.0653,0.0565,0.0503,0.0263,0.0353,0.0214,0.0271,0.0219,0.0209,0.0166,0.0115,0.0158,0.0118,0.0184,0.0187,0.0198,0.0131,0.0074,0.0123,0.0091,0.0092,0.007,0.0103,0.0111,0.0069,0.0117,0.0065,0.0083,0.0078,0.014,0.0044,0.0113,0.0029,0.0015,0.0004,0.0001,0], mid: [0.2655,0.1051,0.0815,0.0661,0.0546,0.045,0.0376,0.0208,0.0197,0.0216,0.0344,0.0138,0.0115,0.0087,0.0141,0.0065,0.0176,0.0116,0.0062,0.0054,0.0133,0.0092,0.0135,0.0131,0.0056,0.0096,0.01,0.0104,0.0131,0.0129,0.0086,0.0043,0.0032,0.0132,0.0084,0.0004,0.0036,0.0001,0,0], high: [0.2085,0.0973,0.0852,0.0619,0.0545,0.0611,0.0203,0.029,0.0246,0.0285,0.0162,0.0161,0.0248,0.0168,0.0195,0.0141,0.0156,0.0193,0.0122,0.0078,0.0119,0.018,0.0094,0.0091,0.0166,0.0085,0.0091,0.0133,0.0117,0.0068,0.0098,0.0108,0.007,0.0048,0.0103,0.0069,0.0016,0.001,0.0001,0] }, INT: { low: [0.2216,0.1312,0.0789,0.0855,0.0404,0.0484,0.0297,0.0368,0.0217,0.0237,0.0236,0.0136,0.0237,0.0158,0.0063,0.0193,0.0188,0.0103,0.0063,0.0083,0.0078,0.0103,0.0151,0.0079,0.0102,0.0061,0.0061,0.0081,0.0048,0.0154,0.0038,0.0066,0.0063,0.0096,0.0064,0.0075,0.0027,0.0012,0,0], mid: [0.1904,0.1222,0.0968,0.0694,0.0432,0.0445,0.0341,0.0266,0.0212,0.0159,0.0179,0.0135,0.0136,0.0153,0.0175,0.0168,0.0064,0.0065,0.0057,0.0078,0.0061,0.0057,0.0139,0.0164,0.0152,0.0159,0.0108,0.0165,0.0153,0.0077,0.0193,0.0195,0.0111,0.0081,0.0078,0.0161,0.0049,0.0041,0.0001,0.0001], high: [0.158,0.0839,0.0725,0.0733,0.0509,0.0455,0.0241,0.0314,0.0264,0.0219,0.0181,0.0246,0.0156,0.0131,0.0209,0.0152,0.0122,0.0187,0.0094,0.0131,0.0199,0.0093,0.0099,0.0218,0.0154,0.0169,0.01,0.0106,0.0064,0.0305,0.0204,0.0166,0.0107,0.0164,0.0174,0.0119,0.0035,0.0037,0,0] }, SS: { low: [0.0302,0.0329,0.0319,0.032,0.032,0.0347,0.0277,0.0368,0.0318,0.0321,0.0364,0.0308,0.0291,0.0316,0.0281,0.0304,0.0253,0.0253,0.0286,0.0266,0.0268,0.027,0.0234,0.0266,0.0241,0.0306,0.0287,0.0254,0.0196,0.0213,0.0229,0.0266,0.0148,0.0162,0.0154,0.0165,0.0108,0.0055,0.0019,0.0013], mid: [0.0283,0.0287,0.0324,0.0309,0.0356,0.0323,0.025,0.0374,0.0367,0.0349,0.0372,0.0298,0.0253,0.0298,0.0258,0.0314,0.0311,0.0243,0.027,0.021,0.0242,0.0237,0.0228,0.0278,0.0249,0.0268,0.0296,0.027,0.0202,0.0226,0.0268,0.0293,0.0153,0.017,0.0158,0.0191,0.0136,0.006,0.0009,0.0016], high: [0.0302,0.0329,0.0319,0.032,0.032,0.0347,0.0277,0.0368,0.0318,0.0321,0.0364,0.0308,0.0291,0.0316,0.0281,0.0304,0.0253,0.0253,0.0286,0.0266,0.0268,0.027,0.0234,0.0266,0.0241,0.0306,0.0287,0.0254,0.0196,0.0213,0.0229,0.0266,0.0148,0.0162,0.0154,0.0165,0.0108,0.0055,0.0019,0.0013] }, ROAD: { low: [0.2834,0.143,0.056,0.0488,0.0282,0.0418,0.0308,0.0302,0.0163,0.0264,0.0081,0.015,0.0119,0.0181,0.008,0.0129,0.0251,0.0077,0.005,0.0167,0.0039,0.0094,0.0024,0.0039,0.0037,0.0244,0.01,0.0071,0.0049,0.0071,0.0111,0.0098,0.0078,0.007,0.0229,0.0143,0.0122,0.0015,0.0032,0], mid: [0.3034,0.1318,0.0598,0.0502,0.0276,0.0336,0.0351,0.0306,0.0204,0.0199,0.0071,0.0202,0.0135,0.0142,0.0079,0.0108,0.0179,0.009,0.0063,0.0155,0.0049,0.0094,0.0099,0.0055,0.0046,0.0174,0.0103,0.0075,0.0083,0.0058,0.0134,0.0139,0.0081,0.0058,0.017,0.0115,0.0085,0.001,0.0022,0], high: [0.3034,0.1318,0.0598,0.0502,0.0276,0.0336,0.0351,0.0306,0.0204,0.0199,0.0071,0.0202,0.0135,0.0142,0.0079,0.0108,0.0179,0.009,0.0063,0.0155,0.0049,0.0094,0.0099,0.0055,0.0046,0.0174,0.0103,0.0075,0.0083,0.0058,0.0134,0.0139,0.0081,0.0058,0.017,0.0115,0.0085,0.001,0.0022,0] } }

function normalizeArr(values, lowerIsBetter = false) {
  const valid = values.filter(v => v != null && !isNaN(v))
  if (valid.length < 2) return values.map(v => (v == null ? null : 50))
  const mn = Math.min(...valid)
  const mx = Math.max(...valid)
  if (mn === mx) return values.map(v => (v == null ? null : 50))
  return values.map(v => {
    if (v == null || isNaN(v)) return null
    const raw = (v - mn) / (mx - mn)
    return (lowerIsBetter ? 1 - raw : raw) * 100
  })
}

const NAME_ALIASES = { 'nicholas sanchez': 'nick sanchez' } // entry-sheet name -> loop-data name. 2026-08-03 audit: only cross-source mismatch across all three series' current entries.
function normalizeName(s) {
  if (!s) return ''
  const n = s.replace(/([A-Za-z])\./g, '$1').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  return NAME_ALIASES[n] || n
}

function __applyRainOut(w, on) {
  if (!on) return w;
  var freed = (w.startPos || 0) - 0.12;
  return Object.assign({}, w, { startPos: 0.12, corrHistory: (w.corrHistory || 0) + freed * 0.5, longRunPace: (w.longRunPace || 0) + freed * 0.5 });
}

function buildSpeedScores(drivers, weights) {
  if (!drivers.length) return drivers

  const corrRatingScores = normalizeArr(drivers.map(d => d.corrAvgRating), false) // higher = better
  const corrFinishScores = normalizeArr(drivers.map(d => d.corrAvgFinish), true)  // lower = better
  const lrpScores        = normalizeArr(drivers.map(d => d.lrpTime),       true)  // lower lap time = better
  const startScores      = normalizeArr(drivers.map(d => d.startPos),       true)  // P1 = 100
  // trail10-v2.2 (2026-07-25 overshoot backtest, operator challenge): projected grids carried
  // real-grid-sized confidence with worse favorite identification (toy-MC favorite gap +4.1 pts
  // vs actual grid, 319 races 2023+, 2022 Next Gen year excluded per operator). Shading projected
  // start influence lam=0.7 matches the actual-grid calibration profile (21.4 vs 20.9). Real
  // lineups untouched - this only softens forecasts of a grid we have not seen yet.
  for (let __i = 0; __i < drivers.length; __i++) if (drivers[__i].__startProjected && startScores[__i] != null) startScores[__i] = 50 + (startScores[__i] - 50) * 0.7
  const trackRatingScores = normalizeArr(drivers.map(d => d.trackAvgRating), false) // higher = better
  const trackFinishScores = normalizeArr(drivers.map(d => d.trackAvgFinish), true)
  const winConvScores     = normalizeArr(drivers.map(d => d.corrWinConv),    false)  // lower = better
  const pitScores = normalizeArr(drivers.map(d => d.pitCrewTime), true) // lower box time = better crew (task #46)

  // EQUIPMENT PRIOR (task 118): map equipment ratings onto the SAME min-max axis as corrAvgRating
  const __crVals = drivers.map(d => d.corrAvgRating).filter(v => v != null && !isNaN(v))
  const __crMn = Math.min.apply(null, __crVals), __crMx = Math.max.apply(null, __crVals)
  const __eqScale = (__crVals.length >= 2 && __crMx > __crMn)
    ? (v => (v == null || isNaN(v)) ? null : Math.max(0, Math.min(100, (v - __crMn) / (__crMx - __crMn) * 100)))
    : null

  const wTotal = Object.values(weights).reduce((a, b) => a + b, 0) || 1
  const w = {
    corrHistory:  weights.corrHistory  / wTotal,
    longRunPace:  weights.longRunPace  / wTotal,
    pitCrew:      (weights.pitCrew || 0) / wTotal,
    startPos:     weights.startPos     / wTotal,
    trackHistory: (weights.trackHistory || 0) / wTotal,
    winConversion:(weights.winConversion || 0) / wTotal,
  }

  return drivers.map((d, i) => {
    const rs = corrRatingScores[i]
    const fs = corrFinishScores[i]
    const hasR = d.corrAvgRating != null
    const hasF = d.corrAvgFinish != null
    const blendedC = hasR && hasF ? rs
                   : hasR         ? rs
                   : hasF         ? fs
                   :                null
    const rawC = blendedC ?? 50
    const conf = d.nCorrRaces > 0 ? Math.min(1, d.nCorrRaces / 4) : (blendedC != null ? 1 : 0)
    // EQUIPMENT PRIOR (task 118): thin-history fill toward EQUIPMENT instead of neutral 50;
    // quarter-strength ride-change delta for established drivers. All guards degrade to the
    // pre-118 value (rawC*conf + 50*(1-conf)) when car data is absent.
    const __eqS = __eqScale ? __eqScale(d.equipRating) : null
    const __eqM = __eqScale ? __eqScale(d.modalEquipRating) : null
    const __eqScl = d.equipScale != null ? d.equipScale : 1
    const __eqConf = (d.nEquipRaces > 0 ? Math.min(1, d.nEquipRaces / 4) : 0) * __eqScl
    const __mkA = d.marketFill != null ? d.marketFill : 50
    const __thinD = ((d.nCorrRaces || 0) < 5) && d.practiceScore == null // v1.1: thin = same def as the EDGE gate // MARKET ANCHOR 2026-07-22: de-vigged win-odds pctile replaces neutral as the ignorance fill (salary-proxy backtest: MAE .204 vs .282, level miss 24pts — BACKTEST_LOG)
    const __eqFill = __eqS != null ? __eqS * __eqConf + __mkA * (1 - __eqConf) : __mkA
    let c = rawC * conf + __eqFill * (1 - conf)
    if (conf >= 1 && !d.__carMatched && __eqS != null && __eqM != null && d.modalCar && d.carNumber && String(d.carNumber).trim() !== d.modalCar) { // car-auto-v2: delta skipped when rating already car-matched (double-count guard)
      const __dConf = Math.min(1, Math.min(d.nEquipRaces, d.nModalEquip) / 4)
      c = Math.max(0, Math.min(100, c + 0.25 * __dConf * __eqScl * (__eqS - __eqM)))
    }
    const trs = trackRatingScores[i]
    const tfs = trackFinishScores[i]
    const hasTR = d.trackAvgRating != null
    const hasTF = d.trackAvgFinish != null
    const blendedT = hasTR && hasTF ? trs * 0.9 + tfs * 0.1
                   : hasTR           ? trs
                   : hasTF           ? tfs
                   :                   null
    const rawT = blendedT ?? 50
    const tConf = d.nTrackRaces > 0 ? Math.min(1, d.nTrackRaces / 4) : (blendedT != null ? 1 : 0)
    const t    = rawT * tConf + (__thinD ? __mkA : 50) * (1 - tConf) // thin drivers: track ignorance = market too (2026-07-22); NOTE shrink-to-corr for ESTABLISHED drivers tested + REJECTED 07-18 — do not 'fix' this to HIST
    const lrp = lrpScores[i]   ?? (__thinD ? __mkA : 50) // v1.1: thin drivers' ignorance fills = market everywhere
    const sp  = startScores[i] ?? (__thinD ? __mkA : 50)
    const wc  = winConvScores[i]   ?? 50
    const pit = pitScores[i] ?? 50

    const speedScore =
      c   * w.corrHistory  +
      lrp * w.longRunPace  +
      sp  * w.startPos     +
      t   * w.trackHistory +
      wc  * w.winConversion +
      pit * w.pitCrew

    return {
      ...d,
      speedScore,
      __spW: w.startPos,
      __spUsed: sp,
      scores: {
        corr: Math.round(c),
        lrp:  Math.round(lrp),
        sp:   Math.round(sp),
        win:  Math.round(wc),
        pit:  Math.round(pit),
        track: Math.round(t),
        anchored: { corr: d.marketFill != null && conf < 1 && __eqS == null, lrp: d.marketFill != null && __thinD && lrpScores[i] == null, sp: d.marketFill != null && __thinD && startScores[i] == null }, // '*' in breakdown = market-anchored fill, not measured data
      },
    }
  })
}

// SS NOISE CALIBRATION (2026-08-29, pre-registered - BACKTEST_LOG same date): the MC's
// rank->win curve at superspeedways was uniformly too steep vs 59 SS races / 1,989 driver-obs
// (sim top-3 16.5 pct vs real 12.4; ranks 16-20 sim 0.8 vs real 2.7 - reality is FLAT ~2.5 pct
// from rank 7 to 20). One dial, fit 2022-24 / validated 2025-26 holdout (all bands within 1.25
// SE, winner log-likelihood +0.94, R24 board win-Brier improved 0.0299 -> 0.0277): multiply the
// outcome noise by 1.75 at SS only. Flows through win/t3/t5/t10, medge, DFS samples - one story.
// DO NOT retune from in-sample results; the forward judge is SS board win-Brier + the CLV ledger.
const GROUP_NOISE_MULT = { SS: 1.75 }

// COUNT-ONLY DNF ESTIMATOR (2026-08-31). Replays exactly the wreck + mechanical
// assignment runRaceSim performs, and counts retirements. Nothing else - no scores, no
// sorting, no laps led.
//
// It is EXACT for the count, and that is not an approximation claim: victim identity
// depends on the running order, but the NUMBER of victims does not. Each event takes sz
// adjacent slots from a random seed, clamped at the field edge (which is where overlap
// eats draws), each occupant retires with probability p, already-retired occupants are
// skipped. None of that reads a driver's score. The survivor position penalty does not
// retire anyone. So this loop and the real one draw the same distribution of counts.
//
// Exists so the caution mix can be normalized against the sim's ACTUAL delivered rate at
// the ACTUAL budget, rather than against a hardcoded table. That matters: the per-bucket
// multipliers are NOT constant in the budget. Measured 2026-08-31, SS mid runs 2.10x at a
// 4% budget and 0.89x at 40% (the 0.3 lower clamp on __wScale binds hard at low budgets).
// A constants table would have been wrong at both ends of the schedule.
// ONE definition of the accident scale. This used to be written out twice — here and in the
// per-bucket state builder — and on 2026-08-31 the ship of the wide clamp updated only the
// other copy, so the K estimator measured a clipped scale while the sim ran an unclipped one
// and cautionMix delivered INT 24% over budget. sim-smoke caught it. Do not inline this again.
function __wScaleOf(n, dnfRate, wm, wide) {
  return Math.max(0.3, Math.min(wide ? 8 : 2.5, (n * dnfRate * wm.accShare) / wm.pre))
}

function __dnfFraction(n, dnfRate, wm, iters, wide) {
  if (!wm) return dnfRate
  const scale = __wScaleOf(n, dnfRate, wm, wide)
  const mech = dnfRate * (1 - wm.accShare)
  const dnf = new Uint8Array(n)
  let total = 0
  for (let it = 0; it < iters; it++) {
    dnf.fill(0)
    const evs = wm.sets[(Math.random() * wm.sets.length) | 0]
    for (let e = 0; e < evs.length; e++) {
      const sz = evs[e][0]
      const bkt = sz <= 4 ? 'a' : (sz <= 9 ? 'b' : 'c')
      const p = Math.min(0.95, wm.P[bkt] * scale)
      const seed = (Math.random() * n) | 0
      for (let j = 0; j < sz; j++) {
        const k = Math.min(n - 1, seed + j)
        if (dnf[k]) continue
        if (Math.random() < p) dnf[k] = 1
      }
    }
    for (let x = 0; x < n; x++) if (!dnf[x] && Math.random() < mech) dnf[x] = 1
    for (let x = 0; x < n; x++) total += dnf[x]
  }
  return total / (iters * n)
}

function runRaceSim(drivers, simConfig) {
  const { numSims, cautionPreset, totalRaceLaps, trackGroup, startSampling, cautionMix, skillTilt } = simConfig
  let dnfRate = simConfig.dnfRate
  // SS dominator tilt keys off the sim's own speedScore percentile, NOT practice __spdPct:
  // SS races often have no practice (everyone defaulted to neutral 0.5, making any tilt a no-op),
  // and the empirical rank-share targets are strength-ranked anyway. Computed once per run.
  const __ssSpd = new Map()
  if (trackGroup === 'SS') { const __so = drivers.map((d, i) => ({ i, s: (d.speedScore != null ? d.speedScore : 0) })).sort((a, b) => b.s - a.s); __so.forEach((o, r) => { __ssSpd.set(o.i, __so.length > 1 ? 1 - r / (__so.length - 1) : 0.5) }) }
  

  const n = drivers.length
  if (!n) return []

  // Per-driver DNF multipliers. Mean 1 by construction, so the budget is untouched.
  const __pct = new Float64Array(n)
  {
    const ord = drivers.map((d, i) => ({ i, s: d.speedScore != null ? d.speedScore : 0 })).sort((a, b) => b.s - a.s)
    ord.forEach((o, r) => { __pct[o.i] = n > 1 ? 1 - r / (n - 1) : 0.5 })
  }
  // tiltCurve overrides the table — the calibration script passes candidates through it.
  const __curve = skillTilt ? (simConfig.tiltCurve || DNF_TILT_CURVE[trackGroup] || null) : null
  const __tilt = __tiltMults(__pct, __curve, simConfig.tiltRescale)
  if (skillTilt && simConfig.tiltCurve == null) dnfRate = Math.min(0.6, dnfRate * DNF_TILT_LEVEL)

  // CAUTION MIX (2026-08-31). Optional. Without it this runs exactly as before: ONE bucket,
  // no extra RNG draw, byte-for-byte the old behaviour.
  //
  // WHAT IT FIXES. wreck-v1.1-cb calibrated the caution bucket as a property of a RACE - a
  // calm race retires fewer cars, a chaotic one more. The board hands the sim a track-level
  // AVERAGE, so every one of the 30,000 draws was a copy of the average race, and a
  // modulation meant to vary ACROSS races became a constant offset on a budget that already
  // encoded the track's typical chaos. Talladega was simmed at 0.51x its own measured
  // attrition on exactly that double-application.
  //
  // cautionMix = { presets: [low, mid, high], w: [wLow, wMid, wHigh] } where w is the
  // track's OWN empirical frequency of each caution bucket. Each sim draws its bucket from
  // w, so calm sims still retire fewer cars and chaotic ones more - the spread wreck-v1.1-cb
  // bought is kept, and gains the per-race variance the sim never had.
  //
  // K makes the mix mean-preserving: the effective budget is dnfRate / K where
  // K = SUM_b w_b r_b, so the track's own distribution averages to exactly the budget.
  // r_b is MEASURED at this budget by __dnfFraction rather than looked up, because the
  // multipliers are not constant in the budget (see that function). Solved by fixed point -
  // r_b depends on the budget, which depends on K - which converges in 2-3 passes.
  const __mixPresets = (cautionMix && cautionMix.presets && cautionMix.presets.length)
    ? cautionMix.presets : [cautionPreset]
  let __mixW = (cautionMix && cautionMix.w && cautionMix.w.length === __mixPresets.length)
    ? cautionMix.w.slice() : [1]
  const __wSum = __mixW.reduce((a, b) => a + (b > 0 ? b : 0), 0)
  __mixW = __wSum > 0 ? __mixW.map(x => (x > 0 ? x : 0) / __wSum) : __mixPresets.map(() => 1 / __mixPresets.length)
  const __mixOn = __mixPresets.length > 1
  // levelNormalize (2026-08-31): the CLIFF FIX. Applies the same K normalization to a SINGLE
  // preset, so the chosen bucket sets the SHAPE (wreck pool, dominator curves, noise width) and
  // stops setting the attrition LEVEL as a side effect. dnfRate already carries the level, measured
  // from this same track, so the bucket setting it again is a double application — and it is what
  // made a fraction of one caution swing attrition ~80% across the <6 / <11.5 boundaries.
  // Registered in BACKTEST_LOG 2026-08-31. Off unless the caller asks.
  const __lvlNorm = !!simConfig.levelNormalize

  // SHIPPED 2026-08-31 (operator-approved). Both were opt-in flags while under test; they are
  // now the DEFAULT and a caller must opt OUT to get the old path. The old path is retained
  // only so a backtest can still build the CURRENT arm for comparison — nothing in src/pages/
  // passes either, and nothing should.
  const __perBucketEV = simConfig.perBucketEV !== false
  const __wideClamp = simConfig.wideClamp !== false

  const __bucketOf = p => (p.value <= 5 ? 'low' : p.value <= 8 ? 'mid' : 'high')
  const __wmFor = p => {
    const cb = __bucketOf(p)
    const sp = WRECK_SETS[trackGroup] ? WRECK_SETS[trackGroup][cb] : null
    const pre = __perBucketEV && WRECK_EV_EXP_B[trackGroup]
      ? WRECK_EV_EXP_B[trackGroup][cb] : WRECK_EV_EXP[trackGroup]
    return sp && sp.length ? { sets: sp, P: WRECK_P[trackGroup], surv: WRECK_SURV_COST[trackGroup], accShare: WRECK_ACC_SHARE[trackGroup], pre } : null
  }

  let __K = 1
  if (__mixOn || __lvlNorm) {
    const wms = __mixPresets.map(__wmFor)
    for (let pass = 0; pass < 4; pass++) {
      const eff = dnfRate / __K
      let k = 0
      for (let b = 0; b < wms.length; b++) {
        if (__mixW[b] <= 0) continue
        k += __mixW[b] * (__dnfFraction(n, eff, wms[b], 4000, __wideClamp) / eff)
      }
      if (!(k > 0.05) || !isFinite(k)) { __K = 1; break }
      __K = k
    }
  }
  const __effRate = dnfRate / __K

  // Per-bucket state. Everything the sim loop reads that depends on the caution level lives
  // here, so the loop just indexes one of these instead of closing over a single value.
  const __B = __mixPresets.map(p => {
    const cb = __bucketOf(p)
    const wm = __wmFor(p)
    return {
      cautionValue: p.value,
      noiseWidth: p.noise * (GROUP_NOISE_MULT[trackGroup] || 1),
      LLC: ((LL_CURVES_G[trackGroup] || {})[cb]) || LL_CURVES[cb],
      FLC: ((FL_CURVES_G[trackGroup] || {})[cb]) || FL_CURVES[cb],
      // 2026-09-03 INT dominance-level study (BACKTEST_LOG, pre-registered). EXPERIMENTAL, OFF
      // unless simConfig sets them; nothing in src/pages/ passes them until the study ships.
      //   domCurves: { LL: {low,mid,high}, FL: {...} }  strength-rank (sorted-share) curves
      //   domBoot:   { LL: {low: [vec,...]}, FL: {...} }  per-draw bootstrap of real share vectors
      cb,
      domLL: simConfig.domCurves && simConfig.domCurves.LL ? (simConfig.domCurves.LL[cb] || null) : null,
      domFL: simConfig.domCurves && simConfig.domCurves.FL ? (simConfig.domCurves.FL[cb] || null) : null,
      bootLL: simConfig.domBoot && simConfig.domBoot.LL ? (simConfig.domBoot.LL[cb] || null) : null,
      bootFL: simConfig.domBoot && simConfig.domBoot.FL ? (simConfig.domBoot.FL[cb] || null) : null,
      wm,
      // The 2.5 upper clamp was set when wm.pre was a GLOBAL per-group normalizer. With the
      // per-bucket normalizer the sparse calm pool legitimately needs a larger scale (INT low
      // wants ~4.2 at a 15.5% budget), and clamping it there is what left the residual cliff:
      // per-bucket EV alone closed the boundary jump 73.2% -> 40.1%, and unclipping closed it
      // to 3.0%. This is a GUARD RAIL, not a fitted value — over all 162 holdout boards the
      // largest scale actually required is 4.35 and ZERO boards reach 8, while the old 2.5
      // ceiling was binding on ~15% of them. Per-victim probability is still guarded by the
      // min(0.95, ...) saturation downstream. If a future board ever needs >8, that is a
      // signal about the pool, not a reason to raise this again.
      wScale: wm ? __wScaleOf(n, __effRate, wm, __wideClamp) : 0,
      mechRate: wm ? __effRate * (1 - wm.accShare) : 0,
    }
  })
  // Cumulative weights for the per-sim bucket draw.
  const __cumW = []
  { let acc = 0; for (const w of __mixW) { acc += w; __cumW.push(acc) } }
  // trail10-v3.1 (2026-07-28): per-sim sampled starts also feed DK place differential.
  // Eligible drivers' grid slots are permuted by the sim's sampled order (grid stays
  // collision-free); null/missing slots disable the override (falls back to fixed start).
  const __ssSlots = (startSampling && startSampling.entries.length >= 3) ? (() => { const v = startSampling.entries.map(e => drivers[e.i].startPos); return v.every(x => x != null && isFinite(x)) ? v.slice().sort((a, b) => a - b) : null })() : null

  const sumFinish      = new Float64Array(n)
  const sumDK          = new Float64Array(n)
  const SAMPLE_TARGET = 10000  // 2026-07-23: was 1000; Optimal% SE at 10k ~ +/-0.3pct (50k would cost 7MB rows + minutes of solver for negligible gain)
  const sampleStride = Math.max(1, Math.floor(numSims / SAMPLE_TARGET))
  const dkSamples = []
  const sumLapsLed     = new Float64Array(n)
  const sumFastLaps    = new Int32Array(n)
  const dfCnt          = new Int32Array(n)
  const finishHist     = Array.from({ length: n }, () => new Int32Array(n + 2))
  const posMatrix      = new Int16Array(numSims * n)

  for (let sim = 0; sim < numSims; sim++) {
    // This sim's caution bucket. Drawn ONLY when a mix was supplied, so a single-bucket run
    // consumes exactly the RNG stream it always did and reproduces prior results.
    let __bi = 0
    if (__mixOn) { const __r = Math.random(); __bi = __cumW.length - 1; for (let b = 0; b < __cumW.length; b++) if (__r < __cumW[b]) { __bi = b; break } }
    const S = __B[__bi]
    // task #73 (2026-07-28): DISTRIBUTIONAL START SAMPLING on projected-lineup boards.
    // Each sim draws every projected driver's start from his trailing-10 (hybrid) history,
    // ranks the draws into a coherent grid, and adjusts scores by w*(sampled - fixed).
    // The 0.7 shade on the fixed component cancels exactly, so sampling runs unshaded -
    // toy-MC favorite gap 14.8 vs shade 18.3 vs actual-grid 19.1 (BACKTEST_LOG same date).
    let __adj = null, __simStart = null
    if (startSampling && startSampling.entries.length >= 3) {
      const E = startSampling.entries
      const draws = E.map(e => e.hist[(Math.random() * e.hist.length) | 0] + gaussNoise() * 0.03)
      const ord2 = E.map((e, x) => x).sort((a, b) => draws[a] - draws[b])
      __adj = new Float64Array(n)
      const km = E.length
      if (__ssSlots) __simStart = new Float64Array(n).fill(-1)
      ord2.forEach((ei, r2) => { const e = E[ei]; __adj[e.i] = startSampling.w * ((km > 1 ? (1 - r2 / (km - 1)) * 100 : 50) - e.fixed); if (__simStart) __simStart[e.i] = __ssSlots[r2] })
    }
    const scored = drivers.map((d, i) => {
      let effLap = 0
      const __ld = d.lapsDown || 0
      if (__ld > 0) {
        let __rec = 0
        for (let __c = 0; __c < S.cautionValue; __c++) if (Math.random() < 0.06) __rec++
        effLap = Math.max(0, __ld - __rec)
      }
      return {
        i,
        score: d.speedScore + (__adj ? __adj[i] : 0) + gaussNoise() * S.noiseWidth,
        dnf: S.wm ? false : (Math.random() < __effRate * __tilt[i]), dnfLap: 0,
        effLap,
      }
    })

    // #51 wreck-v1: event-based accident DNFs + independent mechanical layer
    if (S.wm) {
      const ord = scored.map((s, x) => x).sort((a, b) => scored[b].score - scored[a].score)
      let __sMin = Infinity, __sMax = -Infinity
      for (let x = 0; x < n; x++) { const sc = scored[x].score; if (sc < __sMin) __sMin = sc; if (sc > __sMax) __sMax = sc }
      const __pen = S.wm.surv * ((__sMax - __sMin) / Math.max(1, n - 1))
      const evs = S.wm.sets[(Math.random() * S.wm.sets.length) | 0]
      for (let e = 0; e < evs.length; e++) {
        const sz = evs[e][0], frac = evs[e][1]
        const bkt = sz <= 4 ? 'a' : (sz <= 9 ? 'b' : 'c')
        const p = Math.min(0.95, S.wm.P[bkt] * S.wScale)
        const seed = (Math.random() * n) | 0
        for (let j = 0; j < sz; j++) {
          const sv = scored[ord[Math.min(n - 1, seed + j)]]
          if (sv.dnf) continue
          if (Math.random() < p * __tilt[sv.i]) { sv.dnf = true; sv.dnfLap = frac }
          else sv.score -= __pen
        }
      }
      for (let x = 0; x < n; x++) { const sv = scored[x]; if (!sv.dnf && Math.random() < S.mechRate * __tilt[sv.i]) { sv.dnf = true; sv.dnfLap = Math.random() } }
    }

    scored.sort((a, b) => {
      if (a.dnf !== b.dnf) return a.dnf ? 1 : -1
      if (a.dnf && b.dnf && a.dnfLap !== b.dnfLap) return b.dnfLap - a.dnfLap
      if (a.effLap !== b.effLap) return a.effLap - b.effLap
      return b.score - a.score
    })

    const simPos = new Int32Array(n)
    scored.forEach((s, rank) => {
      simPos[s.i] = rank + 1
      sumFinish[s.i] += rank + 1
      finishHist[s.i][rank + 1]++
      if (s.dnf) dfCnt[s.i]++
    })
    for (let j = 0; j < n; j++) posMatrix[sim * n + j] = simPos[j]

    const active = scored.filter(s => !s.dnf)
    const __bLL = WRECK_LL_B[trackGroup] || 0
    const __wLL = (sv) => sv.dnf ? Math.min(1, (sv.dnfLap || 0) * __bLL) : 1
    // ARM B/C (2026-09-03 study): dominance order = pre-race strength + independent noise, so the
    // car that leads is not by construction the car that wins (real INT: the top-LL car is not the
    // winner 61% of the time). Control path (domPool unset) is byte-for-byte the old finish order.
    let __pool
    if (simConfig.domPool === 'strength') {
      const __sd = (simConfig.domK != null ? simConfig.domK : 1) * S.noiseWidth
      const __ds = new Float64Array(n)
      // domAlpha (0..1): share of the draw's realized finish noise (score - speedScore, which
      // includes wreck survivor penalties) that carries into the dominance order. 0 = pure
      // pre-race strength; 1 = the realized draw score (finish order) plus independent noise.
      const __al = simConfig.domAlpha != null ? simConfig.domAlpha : 0
      for (let x = 0; x < n; x++) __ds[x] = 0
      for (let x = 0; x < n; x++) { const sv = scored[x]; __ds[sv.i] = drivers[sv.i].speedScore + __al * (sv.score - drivers[sv.i].speedScore) + gaussNoise() * __sd }
      __pool = scored.slice().sort((a, b) => __ds[b.i] - __ds[a.i])
    } else {
      __pool = scored.slice().sort((a, b) => b.score - a.score)
    }
    const __lead = __pool.findIndex(sv => !sv.dnf)
    if (simConfig.__domDiag && __lead >= 0) { const d = simConfig.__domDiag; d.n = (d.n || 0) + 1; const tp = __pool[__lead]; if (simPos[tp.i] === 1) d.wins = (d.wins || 0) + 1; d.finSum = (d.finSum || 0) + simPos[tp.i] }
    // Curve source per draw: bootstrap vector (ARM C) > strength-rank curve (ARM B) > finish-rank curve.
    const __LLC = S.bootLL ? S.bootLL[(Math.random() * S.bootLL.length) | 0] : (S.domLL || S.LLC)
    const __FLC = S.bootFL ? S.bootFL[(Math.random() * S.bootFL.length) | 0] : (S.domFL || S.FLC)
    // ARM A: fastest laps exist only on green laps; deal the measured fraction, not every lap.
    const __flTotal = simConfig.flBudget != null ? Math.round(totalRaceLaps * simConfig.flBudget) : totalRaceLaps
    const simLL = new Float64Array(n)
    const simFastLaps = new Int32Array(n)
    if (active.length > 0) {
      // rounding remainder goes to the LEADER (was: last active driver - caused tail FL artifact)
      // SS dominator tilts (2026-08-29, race-day fit on cup SS 2022-26 rank-share bands, BACKTEST_LOG;
      // corrected same night: v1 keyed off practice __spdPct, which is neutral 0.5 when SS has no
      // practice - a no-op. Now keyed off __ssSpd (speedScore percentile), refit with tilt-inactive
      // attribution): LL was ~2.6x too flat at the top (real top-3 strength cars lead 8.7% of laps
      // each); FL sloped the WRONG direction (real FL share RISES down the field: 1.87 -> 2.80).
      // LL: beta 1.5 + 1.5x elite kick (top speed decile) -> bands 7.1/4.7/3.6/2.9/2.4/1.2 vs real
      // 8.7/3.9/3.0/3.1/2.3/1.4. FL: beta -0.45 -> 2.2/2.2/2.3/2.4/2.5/2.7 vs real 1.9/2.4/2.5/2.6/2.8.
      // Other groups untouched. Judge: DK proj vs actual dominator points on SS races.
      const __llTilt = (sp) => (trackGroup === 'SS' ? Math.max(0.1, 1 + 1.5 * (sp - 0.5)) * (sp > 0.9 ? 1.5 : 1) : Math.max(0.1, 1 + 1.1 * (sp - 0.5)))
      const __flTilt = (sp) => (trackGroup === 'SS' ? Math.max(0.1, 1 - 0.45 * (sp - 0.5)) : Math.max(0.1, 1 + 1.0 * (sp - 0.5)))
      const __domSp = (i) => (trackGroup === 'SS' ? (__ssSpd.get(i) != null ? __ssSpd.get(i) : 0.5) : (drivers[i].__spdPct != null ? drivers[i].__spdPct : 0.5))
      let llW = 0
      const llw = __pool.map((s, r) => { const c = r < __LLC.length ? __LLC[r] : __LLC[__LLC.length - 1] * Math.pow(0.75, r - __LLC.length + 1); const sp = __domSp(s.i); const w = c * __llTilt(sp) * __wLL(s); llW += w; return w })
      let remLL = totalRaceLaps
      for (let r = __pool.length - 1; r >= 0; r--) { if (r === __lead) continue; const ll = Math.max(0, Math.min(Math.round(llw[r] / llW * totalRaceLaps), remLL)); simLL[__pool[r].i] = ll; remLL -= ll }
      simLL[__pool[__lead].i] = remLL
      scored.forEach((s) => { sumLapsLed[s.i] += simLL[s.i] })
      if (simConfig.__domDiag) { let mx = 0; for (let x = 0; x < n; x++) if (simLL[x] > mx) mx = simLL[x]; simConfig.__domDiag.topShare = (simConfig.__domDiag.topShare || 0) + mx / totalRaceLaps; simConfig.__domDiag.draws = (simConfig.__domDiag.draws || 0) + 1 }
      let flWt = 0
      const flw = __pool.map((s, r) => { const c = r < __FLC.length ? __FLC[r] : __FLC[__FLC.length - 1] * Math.pow(0.85, r - __FLC.length + 1); const sp = __domSp(s.i); const w = c * __flTilt(sp) * __wLL(s); flWt += w; return w })
      let remFL = __flTotal
      for (let r = __pool.length - 1; r >= 0; r--) { if (r === __lead) continue; const fl = Math.max(0, Math.min(Math.round(flw[r] / flWt * __flTotal), remFL)); simFastLaps[__pool[r].i] = fl; remFL -= fl }
      simFastLaps[__pool[__lead].i] = remFL
      scored.forEach((s) => { sumFastLaps[s.i] += simFastLaps[s.i] })
    }

    const __srow = (sim % sampleStride === 0 && dkSamples.length < SAMPLE_TARGET) ? new Array(n).fill(0) : null
    scored.forEach(s => {
      const finPos = simPos[s.i]
      const startPos = (__simStart && __simStart[s.i] >= 0) ? __simStart[s.i] : (drivers[s.i].startPos ?? finPos)
      const ll = simLL[s.i]
      // Place differential is scored off the DK-LISTED start, which differs from the sim start only
      // for grid-penalty (rear override) drivers - DK never reprices a penalty. Without this a
      // rear-overridden driver projects a huge fake place-diff and reads as a value play when DK
      // will actually score him NEGATIVE. Feeds dkSamples too, so the GPP optimizer inherits the fix.
      const __dkStart = (drivers[s.i].dkStartPos != null) ? drivers[s.i].dkStartPos : startPos
      const __dk = dkFinishPts(finPos) + (__dkStart - finPos) + (ll * 0.25) + (simFastLaps[s.i] * 0.45)
      sumDK[s.i] += __dk
      if (__srow) __srow[s.i] = Math.round(__dk)
    })
    if (__srow) dkSamples.push(__srow)
  }

  const __rows = drivers.map((d, i) => {
    const projFinish    = sumFinish[i]     / numSims
    const projLapsLed   = sumLapsLed[i]    / numSims
    const avgFastLaps   = sumFastLaps[i] / numSims
    const dnfPct        = dfCnt[i]         / numSims * 100
    const projDK        = sumDK[i]         / numSims
    const startPos      = d.startPos || Math.round(projFinish)
    const projPlaceDiff = startPos - projFinish

    const hist = finishHist[i]
    let cum = 0, p25 = n, p50 = n, p75 = n
    for (let p = 1; p <= n + 1; p++) {
      cum += hist[p] || 0
      if (p25 === n && cum >= numSims * 0.25) p25 = p
      if (p50 === n && cum >= numSims * 0.50) p50 = p
      if (p75 === n && cum >= numSims * 0.75) p75 = p
    }

    const winPct   = (hist[1] || 0) / numSims * 100
    const top5Pct  = [1,2,3,4,5].reduce((s, p) => s + (hist[p] || 0), 0) / numSims * 100
        const top3Pct  = [1,2,3].reduce((s, p) => s + (hist[p] || 0), 0) / numSims * 100
    const top10Pct = [1,2,3,4,5,6,7,8,9,10].reduce((s, p) => s + (hist[p] || 0), 0) / numSims * 100

    return {
      ...d,
      projFinish:     +projFinish.toFixed(1),
      projLapsLed:    +projLapsLed.toFixed(1),
      avgFastLaps:    +avgFastLaps.toFixed(2),
      dnfPct:         +dnfPct.toFixed(1),
      projDK:         +projDK.toFixed(2),
      projPlaceDiff:  +projPlaceDiff.toFixed(1),
      winPct:         +winPct.toFixed(1),
      top5Pct:        +top5Pct.toFixed(1),
          top3Pct:        +top3Pct.toFixed(1),
      top10Pct:       +top10Pct.toFixed(1),
      finishP25: p25, finishP50: p50, finishP75: p75,
      simIdx: i,
    }
  }).sort((a, b) => b.projDK - a.projDK)
  __rows.posMatrix = posMatrix
  __rows.simN = numSims
  __rows.__dkSamples = dkSamples
  __rows.__sampleDrivers = drivers.map(d => d.name)
  return __rows
}

export {
  CAUTION_PRESETS,
  CAUTION_PRESETS_BY_SERIES,
  DNF_BY_GROUP,
  DNF_TILT_CURVE,
  WRECK_EV_EXP_B,
  DNF_TILT_LEVEL,
  DNF_CAP,
  DNF_FLOOR,
  DNF_PRESETS,
  DNF_SERIES_MEAN,
  FL_CURVES,
  FL_CURVES_G,
  GROUP_NOISE_MULT,
  LL_CURVES,
  LL_CURVES_G,
  NAME_ALIASES,
  ROAD_COURSE_TRACKS,
  SERIES_TABS,
  WRECK_ACC_SHARE,
  WRECK_EV_EXP,
  WRECK_LL_B,
  WRECK_P,
  WRECK_SETS,
  WRECK_SURV_COST,
  __applyRainOut,
  __trackGroup,
  buildSpeedScores,
  dkFinishPts,
  gaussNoise,
  getCautionPresets,
  isRoadCourse,
  isSuperspeedway,
  normalizeArr,
  normalizeName,
  resolveDnfRate,
  runRaceSim,
}

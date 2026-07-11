# PitBoard — Backtest & Reconstruction Archive

> Detail relocated out of CLAUDE.md on 2026-07-06 to keep the auto-loaded handoff lean.
> This file is NOT auto-loaded — read it on demand (it holds every dated backtest, the
> exact numbers, and what was rejected and why). CLAUDE.md §6/§7.5 carry the summaries
> and point here. Nothing was deleted; this is the full record.

---

## ARCHIVE A — SimulationCenter.js corruption & reconstruction (2026-07-02)

## 6. SimulationCenter.js — State & Reconstruction Plan

### Current state: CORRUPTED

The file on GitHub is **1.6 MB** (blob SHA `6827ca9b...`). Structure:

| Byte range (chars) | Content |
|---|---|
| 0 – ~3,800 | **Valid JS** — imports, constant definitions |
| ~3,800 – ~619,700 | **GARBAGE** — repeating `ÂÃÂÃÂÃÂÃ...` pattern, ~615 k chars |
| ~619,700 – end | **Valid JS** — `runRaceSim`, `buildSpeedScores`, `SimulationCenter` component, JSX, styles |

The garbage block is corrupted binary data (likely a large embedded data constant that was pushed with the wrong encoding and then grew through multiple bad re-pushes).

### Reconstruction plan

```javascript
// 1. Fetch full file via blob API (returns raw text, no atob needed for raw endpoint)
const text = await fetch(
  `https://api.github.com/repos/RkyMtnLSX/NASCAR-Loop-Data-Analytics-/git/blobs/6827ca9b468c165267da04704721d27eb27bbe7d`,
  { headers: { Authorization: 'token <TOKEN>', Accept: 'application/vnd.github.raw' } }
).then(r => r.text())

// 2. Extract valid parts
const lines = text.split('\n')
const lastGoodLine = 58  // last valid line before garbage (~line 58 = end of constant defs)
const header = lines.slice(0, lastGoodLine + 1).join('\n')

const tailStart = text.indexOf('\nfunction runRaceSim')
const tail = text.slice(tailStart)

// 3. Splice together + apply corruption fix if needed
let clean = header + '\n' + tail
// Apply 2-round E2 corruption fix (see §3)
clean = clean.replace(/Ã¢Â([-¿])Â([-¿])/g,
  (_, b1, b2) => new TextDecoder().decode(new Uint8Array([0xE2, b1.charCodeAt(0), b2.charCodeAt(0)])))

// 4. Push with correct encoding
const encoded = btoa(unescape(encodeURIComponent(clean)))
// PUT to GitHub...
```

> **Warning:** the tail itself may also be partially duplicated (the file structure repeats).
> After splicing, verify the tail ends with `export default function SimulationCenter` rendered JSX and closing `}`.

### What was in the garbage block

Almost certainly a large embedded data constant — likely a DraftKings salary lookup table or historical correlation data — that was pasted as a raw JSON/array literal and corrupted on the first bad push. The reconstruction discards it entirely. If the sim needs that data, re-source it from Supabase instead (preferred approach).

### RECONSTRUCTION COMPLETED (2026-07-02, commit `67f4711`)

The file was reconstructed and the clean version is live. Final size: **44,895 bytes** (down from 1.66 MB), zero corruption. Sequence of what happened, and the lessons:

**The corrupted file was still compiling and deploying "Ready".** Every deploy before the fix built successfully — bloat/encoding corruption did NOT break the build. So the Simulation Center page was live all along; it was just unmaintainable (any browser-workflow edit risked compounding the corruption). Do not assume a garbage-filled file is a broken build.

**Recovered code fragments (all salvaged intact from the original blob):**
- Header: imports, `ADMIN_PASSWORD`, `SERIES_TABS`, `DEFAULT_WEIGHTS`, `ROAD_COURSE_WEIGHTS`, `isRoadCourse`, `CAUTION_PRESETS`, `DNF_PRESETS`
- Functions: `buildSpeedScores`, `runRaceSim`, `SimulationCenter` component
- Helpers stranded *inside* the garbage zone (had to be recovered individually): `normalizeArr`, `normalizeName`, `dkFinishPts`, `gaussNoise`

**Key lesson — small helpers hide inside the discarded block.** Concatenating only the obvious clean fragments will miss helper functions that were interspersed with the garbage, causing `no-undef` build failures. Fastest recovery loop:
1. Reconstruct from the clean fragments and push.
2. Read the Vercel build log's `no-undef` errors — they name **every** missing helper in one pass (ESLint doesn't stop at the first error). Pull them via the events API to avoid the virtualized log UI:
   `fetch('/api/v2/deployments/<deployment-host>/events?direction=backward&limit=300')` then read each event's `payload.text`.
3. For each missing name, locate `function <name>` / `const <name>` in the original blob, brace-match to extract the complete definition (bail if a non-ASCII char appears inside — that means the definition itself is corrupted), and splice it back in.

**Method that worked:** fetch the original blob via the raw endpoint (proper UTF-8, no `atob`), map clean ASCII runs vs. garbage by scanning `charCodeAt > 127`, extract complete brace-matched functions, reassemble (function declarations hoist, so order is flexible), verify zero non-ASCII + all anchors present exactly once, then push with the standard `btoa(unescape(encodeURIComponent(text)))` encoding. Round-trip verified: the pushed file decoded byte-for-byte identical to the staged string.

**Open item:** confirm at runtime whether the removed data block fed the sim. If any sim output is blank/wrong, re-source that data from Supabase. If the sim runs correctly, the block was dead weight.

---

## ARCHIVE B — Calibration & Backtest Findings (full dated log)

## 7.5 Calibration & Backtest Findings (2026-07-02)

A leak-free backtest harness was built to validate and tune the model. It replays
~300 historical races from `loop_data` using the **real** `buildSpeedScores` /
`runRaceSim` functions (fetched from source and run against past races), rebuilding
each driver's inputs from *prior* correlated-group races only (no look-ahead).

**Reduced-model caveat (important).** Practice data exists for only ~7 races, so the
backtest cannot compute `lrpTime` / `srpTime` / `trendSlope` historically. All tests
ran a REDUCED weight set: practice weights zeroed, remainder renormalized to
`corrHistory 0.60, startPos 0.30, raceCraft 0.10`. So backtest MAE (~7.8) is NOT the
production number, and tuned values were validated on the reduced model — direction is
robust, exact optima should be re-confirmed on the full model where practicable.

Metrics used: finish-position MAE; calibration via reliability bins (ECE) and
"favorite gap" = predicted minus actual win% among drivers projected >=20% to win
(0 = perfect, positive = overconfident); winner hit-rate.

### What SHIPPED
- **Per-series caution noise (commit 0dc3893).** Old global Medium=13 was badly
  overconfident (Cup favorite gap +14.7 — model said 45% win, drivers won ~21%).
  Per-series calibration optima: **Cup ~22, Trucks ~23, O'Reilly ~18**. Fixing this was
  ~free on accuracy (MAE flat). This is the single most important change for betting,
  since overconfident win% creates fake "value" vs sportsbook lines. See §7 presets.
- **Merged correlation Groups 2 & 3** (Vegas + Homestead -> group 2 via SQL). The six
  1.5-mile intermediates are near-identical by trait similarity AND empirical
  correlation. Merging nearly doubled intermediate history per driver (2.4 -> 4.5
  tracks) and cut intermediate favorite overconfidence from +11 to +3. NOTE: the
  component groups by `tracks.correlation_group` (not `featured_weekend.correlation_tracks`,
  which is unused), so this SQL change is live immediately, no deploy.
- **Track metadata fixes (SQL).** `banking_angle` populated for all 33 tracks (was
  empty); Chicagoland regrouped to grp 2 + track_type intermediate; Auto Club to grp 1;
  missing road-course lengths + null track_types filled. See `populate_track_specs.sql`.

### What we TESTED and REJECTED (don't re-invest without new data)
- **Momentum (L5 recent-form trend).** Within-correlation-group, recency-weighted, on
  both `driver_rating` and `avg_position`. No MAE or calibration benefit at any weight;
  degrades slightly as you lean on it. Two seasons isn't enough same-group history for a
  stable trend. Revisit with more data.
- **Similarity-weighted history.** Weighting each historical race by trait/empirical
  track similarity instead of hard-group membership = a wash (hard groups already
  capture it). KEEP the trait-similarity score only for *assigning* new/unassigned
  tracks (e.g. Chicagoland), not for reweighting history.
- **Race craft, in every form.** `pct_quality_passes` is ~97% correlated with driver
  rating at the driver level (quality passes are top-15-only, so it just re-encodes
  "runs up front"). Weight-sweeping it 0->35% on ovals AND 0->60% on road courses barely
  moves MAE. Finish-independent replacements (running-position-adjusted residual;
  `pass_diff`) did NOT help either — both slightly worse. On road courses the current
  25% weight is mildly TOO HIGH (winner-picking best at 0%, MAE min ~10%) — candidate to
  trim toward ~10%, but that's a 56-race sample, so validate first.

### The load-bearing insight
The model's predictive power comes almost entirely from **corr history + start
position.** Passing stats are decorative. Practical implications:
- **Start position matters and is missing when qualifying isn't loaded** (e.g.
  Chicagoland). Loading a qualifying lineup is worth more than any race-craft tuning.
- **Corr history is the engine** — the correlation-group structure and merge are where
  gains live.

### Current correlation groups (post-merge)
```
GRP 1 (670hp):        Pocono, Indianapolis MS, Michigan, Auto Club
GRP 2 (670hp/interm): Chicagoland, Charlotte, Kansas, Texas, Las Vegas, Homestead  <- merged 2+3
GRP 4 (Superspeedway):Daytona, Talladega, Atlanta
GRP 5 (750hp Speedways):   Darlington, Dover, Nashville, Bristol, Rockingham
GRP 6 (750hp Flat Tracks): Phoenix, Richmond, New Hampshire, North Wilkesboro, Martinsville, Gateway, Iowa, Bowman Gray
GRP 7:                EMPTY (all members moved to 5/6 in the 2026-07-03 regroup)
GRP 8 (Road Course):  COTA, Sonoma, Watkins Glen, Chicago Street, Naval Base Coronado, Portland, Road America
Unassigned (road):    Charlotte Roval, Indy GP, St. Petersburg, Mexico City  <- should join GRP 8 eventually
```

### 750hp regroup (SQL-only, live immediately, 2026-07-03) — `regroup_750hp_tracks.sql`
User restructured the 750hp short/flat tracks by hand (their domain call, not a backtest).
Old GRP 5 (750hp Oval) / 6 / 7 (Short Tracks) were dissolved into two:
- **GRP 5 "750hp Speedways"**: Darlington, Dover, Nashville Superspeedway, Bristol, Rockingham
- **GRP 6 "750hp Flat Tracks"**: Phoenix, Richmond, New Hampshire, North Wilkesboro,
  Martinsville, Gateway, Iowa, Bowman Gray Stadium

GRP 7 is now empty. Grouping is by the user's read of how tracks race, NOT strictly banking
(Nashville 14deg and Bristol 26deg both sit in "Speedways"). Sim reads `tracks.correlation_group`
live, so no deploy was needed. Group labels are cosmetic; correlation is by group NUMBER.

Four tracks were MISSING from the `tracks` table and were added by this SQL. Their `name`
must match `races.track_name` exactly or the practice/loop lookups spawn stub rows:
- **Gateway** (1.25mi, ~11deg, intermediate, 750hp). DB was normalized 2026-07-03 from
  "World Wide / Worldwide Technology Raceway at Gateway" to just **"Gateway"** across
  races/loop_data/qualifying_results, and the LoopData.js abbrev-map key -> 'Gateway'
  (commit `5e2c7102`). See `normalize_gateway.sql`.
- **Iowa Speedway** (0.875mi, ~14deg, short_track, 750hp)
- **Bowman Gray Stadium** (0.25mi, flat, short_track, 750hp) — exhibition venue; no
  loop_data/qualifying rows exist yet.
- **Rockingham Speedway** (1.017mi, ~22deg, intermediate, 750hp)
Banking on the 4 new rows is approximate metadata (sim groups by correlation_group, not banking).

### Empirical track correlation (method, for future work)
Skill-adjusted: per driver, residual = performance at a track minus their own overall
baseline; correlate residuals across drivers who ran both tracks. This isolates
track character from raw driver talent. Works great for road courses (strong signal);
noisy for intermediates (weaker signal + small samples). Chicagoland has NO empirical
correlation (no Next Gen races) — trait similarity only.

### Data notes for backtesting
- `loop_data`: 13,315 rows, ~360 races, Cup back to 2022 (Next Gen debut — correct floor;
  do NOT pull pre-2022, different car). Cup 162 / O'Reilly 117 / Trucks 81 races.
  Per-driver actuals incl. `finish_position`, `driver_rating`, `pct_quality_passes`,
  `quality_passes`, `green_flag_passes`, `pass_diff`, `avg_position`, `laps_led`,
  `fastest_laps`. This is the source for both actuals AND historical inputs.
- `practice_laps`: only ~9 races have practice; ~7 overlap with results (the only races
  the FULL model can be backtested on).
- `runRaceSim` output fields (camelCase): `projFinish, projLapsLed, avgFastLaps, dnfPct,
  projDK, projPlaceDiff, winPct, top3Pct, top5Pct, top10Pct, finishP25/50/75`. The
  snake_case names (`proj_finish`, `win_pct`) only appear AFTER the component maps them
  for the `sim_results` insert. `projPlaceDiff` exists — DK place differential IS modeled.

### FULL-MODEL backtest — real practice data (2026-07-03)
First backtest on REAL practice metrics (not the reduced-model stub). Set = 15 Cup 2026
races that have practice_sessions (R3-R9, R11-R18); sweeps run on the 11 OVALS (grp!=8,
the DEFAULT_WEIGHTS domain). Harness = real buildSpeedScores/runRaceSim fetched from source,
leak-free driver inputs (corr/track history from PRIOR same-group races only), practice from
that race's own session, actuals from loop_data. Rebuildable in-browser via the REST reads.

1. **NOISE (#110) — SHIPPED (commit 9d86286d).** Cup Medium 22 -> 14. On the full model,
   noise 22 is UNDER-confident (favorite gap -24.6, top favorite only 21% win). Sweep: MAE
   min at low noise, Brier min ~12, favorite gap crosses 0 at ~14. Landed 14. This REVERSES
   the reduced-model tuning (which was over-confident and needed 22) — richer model needs
   less noise. Low/High scaled to keep the curve; only Medium directly tested.

2. **PRACTICE WEIGHT — confirmed it doesn't help finish.** Sweeping total practice weight
   (folded, srp=0) at noise 14: MAE and Brier BOTH minimized at 0% and rise monotonically
   (0%: MAE 7.32/Brier 0.0203; 15%: 7.35/0.0207; 40%: 7.57/0.0217). Same verdict as the
   reduced-model and exact-metric runs, now on real data. Current 15% costs a hair vs 0.
   Kept for now; not a value lever.

3. **Long-run-pace DEFINITION test — current method wins, do NOT change the grader.** Tested
   recomputing "long run pace" from raw practice_laps as (a) single longest green stint and
   (b) pooled long stints (>=5/8/10 laps) vs the current "all session clean laps within 8% of
   median." Current has the best finish correlation (Spearman 0.276 vs 0.21-0.27 for the
   alternatives). Restricting to long runs throws away data and adds per-run noise. The
   grader's flagship metric, despite the imprecise name, is the most robust estimator.

4. **Grader vs sim — same numbers, different use.** practiceGrader V5 WEIGHTS = longRunPace
   0.50, shortRunPace 0.15, tireFalloff 0.15, consistency 0.10, bestLap 0.10 -> a practice-ONLY
   composite grade. It COMPUTES overallAvg/lateRunAvg/trendSlope and stores them; the sim READS
   those exact values (no recompute) but uses only 3 of them, weighted ~15% inside a model
   dominated by corr history (0.40) + startPos (0.33), and IGNORES consistency, bestLap, and the
   composite grade. So the 3 shared metrics are calculated identically; the difference is which
   metrics + weighting.

5. **PRACTICE-EDGE (differential) — real signal but redundant; NOT added.** The relative signal
   (practice-pace rank vs qualifying rank) is strong in isolation: corr 0.435 with place
   differential; partial corr with finish controlling for QUAL = +0.195; "sleepers" (started
   outside top-10 but top-5 in practice) gained avg 5.9 places vs 2.3 for others. BUT the
   residual test is decisive: the full model's residuals (actual - projFinish) correlate ~0
   with practice pace (-0.009) and edge (-0.022). The signal is already captured by corr
   history + startPos (the 0.195 partial only controlled for qual, not ratings). Adding an
   explicit edge term to speedScore HURTS MAE (double-counts qual+pace). Verdict: do not ship.

   OPEN / worth revisiting at scale: with practice STRIPPED from the model, edge-vs-residual
   nudged to -0.077 (right sign, too weak to trust on 11 races). User is backfilling ALL 2025
   Next Gen practice (~3x the sample). FIRST re-run when that lands = this residual test on the
   differential. The sleeper +5.9 result is the reason to keep chasing this at scale.

6. **TOP-N MARKETS + ALL-MARKETS WEIGHT AUDIT (commit c6188f73).** User bets top-3/5/10,
   not just win — so every weight was re-scored on win/top3/top5/top10 Brier, not just MAE.
   - **Calibration is good.** At noise 14, high-confidence picks land close to actual: top-3
     66%->67%, top-10 74%->72% (near perfect), top-5 67%->74% (slightly UNDER-confident — a
     mild value lean: model's top-5 favorites hit more than it says).
   - **Noise 14 is best for top-N too** (not just win/MAE) — confirms the #110 ship.
   - **Practice 15% HELPS top-N** (top3/5/10 Brier all better at 15% than 0%) even though it's
     neutral/negative on finish MAE. MAE averages the whole field; top-N only cares about the
     front, where practice pace lives. => KEEP practice at 15% (do NOT trim to 0 as MAE implied).
   - **trackHistory 0.10 -> 0.15** (corr 0.40 -> 0.35): strictly better on win + top3 + top5 +
     top10 + MAE. 20% helps win/top3 more but hurts top5/top10; 15% is the balanced optimum.
   - **startPos 0.33 CONFIRMED** — top-N all peak at 0.33; MAE alone wanted 0.43 but that hurts
     top3/top10 (MAE over-credits qualifying because it predicts the full 38-car order). Kept.
   - **METHOD LESSON (important for all future tuning): score weights on win/top-N Brier, not
     finish MAE.** MAE systematically over-weights qualifying and washes out top-of-board signal
     (it flatters startPos, buries practice). The betting markets are the right objective.
   Not yet re-scored this way: raceCraft (0.02), tireFalloff (0.05) — small, likely immaterial.

### 2024+2025+2026 RE-TUNE — 40 oval races (2026-07-04, later same day)
User added 11 more 2024 oval practice races -> 40 total (1500 driver-obs). Re-ran the weight
suite. RESULT: **all DEFAULT_WEIGHTS held, only the noise preset moved.**
- startPos 0.33: confirmed (win/top3/5 flat 0.25-0.40, MAE best at 0.33).
- trackHistory 0.15: confirmed (0.10-0.20 within noise).
- practice (longRunPace) 0.15: confirmed AND STRENGTHENED — vs 0 it now improves every top-N
  market + MAE (7.75->7.70) + favorite gap (6.9->4.8). The 11 new real-practice races firmed up
  the signal. 0.25 nudges top-N but hurts win Brier + calibration, so 0.15 stays.
- NOISE: optimum crept 14 -> ~16 (see §7 caution presets). Shipped Cup Medium 14->16 (commit
  723fd754). This is the ONLY change from the 40-race re-tune.
So DEFAULT_WEIGHTS are unchanged (corr 0.35 / lrp 0.15 / startPos 0.33 / raceCraft 0.02 /
trackHistory 0.15); the sim's practice input remains overall_avg (all clean laps, 8% cut).

### 2025+2026 RE-TUNE — full weight sweep on 29 oval races (2026-07-04)
User backfilled 2025 practice, expanding the full-model backtest from 11 races (2026-only) to
29 (2025+2026, 18 of them fresh 2025 races the model was NEVER tuned on). Re-ran the entire
weight suite on the all-markets standard (win/top3/5/10 Brier + MAE + favorite gap). RESULT:
**every current weight confirmed, nothing changed** — the 11-race tuning held up out-of-sample.
- Noise 14: still optimal (best win Brier 0.022, favorite gap +0.5). Top5/top10 would take a
  hair more (16-18) but win/MAE/calibration peak at 14.
- Practice 15%: confirmed — improves top3/5/10 vs 0% (top10 0.153 -> 0.150).
- trackHistory 15%: confirmed (15-20% is the flat optimum).
- startPos 33%: confirmed balance point (28-33% favors win/MAE/top10; 38%+ favors top3/5).
Absolute MAE is higher on this set (~7.65 vs ~7.28 on 2026-only) because 2025 adds more varied
races — only the relative sweeps matter. Harness rebuildable via REST; join practice_sessions
to loop by (year, race_number), history from prior same-group races, year-weighted (age0=1.3...).
NOTE: 2026 practice_LAPS all carry race_number=1 (backfilled pre-column); practice_SESSIONS have
correct R# so the sim backtest is clean. Re-stamp 2026 laps eventually for two-race-track safety.

### PRACTICE GRADER REWRITE (commit 19f7bd68, 2026-07-04) — run-aware
Old grader pooled all laps + graded a 5-metric composite (longRunPace 0.50, shortRunPace 0.15,
tireFalloff 0.15, consistency 0.10, bestLap 0.10). REWRITTEN to be run-aware after the SVG
Chicagoland case (a single-stint falloff artifact from one traffic lap inflated his B-). New grader:
- Segments laps into runs; computes avgPace (mean of run averages), bestStint (fastest run),
  longRun (len-weighted 10+ lap runs), run-aware falloff (avg per-run slope), consistency.
- GRADE = Avg Pace 0.70 / Best Stint 0.30, RANK-scaled (not min-max), -> percentile letter.
- Chosen via a 27-race metric backtest: avgPace best predictor of finish (0.255 correlation);
  longRun/bestStint worse; FALLOFF (0.03) and CONSISTENCY (-0.03) near-zero -> NOT graded.
- Backward-compat: still outputs overallAvg (All Laps, for the sim), lateRunAvg, trendSlope,
  bestLap, stints, longestStint so Admin.js storage/interface is unchanged.
- KNOWN TRADE-OFF: avgPace rewards fresh-tire speed (Larson graded A+ on Chicagoland despite
  mid-pack long-run pace + bad falloff), because raw speed correlates with talent/finish. User
  chose avgPace (most predictive) over blending longRun (more worn-tire-honest but predicts worse).
- ROLLOUT STATUS: COMPLETE (2026-07-04). Columns avg_pace/best_stint/long_run/consistency added
  to practice_sessions (SQL run by user); Admin.js stores them (commit bb20e601);
  PracticeReportCard.js now shows Avg Pace/Best Stint/Long Run/Falloff/Consistency/Best Lap and
  DROPS All Laps + Short Run (commit 6ea4551c, deploy verified live in bundle main.421e224d.js).
- Practice_laps race_number: added (commit 373cb917 + SQL) so two-race-track raw laps separate.

### SIM PRACTICE INPUT: overall_avg vs avg_pace A/B (2026-07-04) — REJECTED, keep overall_avg
Question: since the GRADE was rewritten to use avgPace (run-aware, best finish predictor), should the
SIM's longRunPace input (`lrpTime`) also switch from the stored `overall_avg` (all clean laps, 8% cut)
to `avg_pace` (mean of per-run averages)? Ran a CONTROLLED head-to-head on the FULL 29 oval races
(2025+2026) that have raw practice_laps, BOTH metrics computed from the IDENTICAL laps via the real
gradePracticeSession, fed through the real buildSpeedScores/runRaceSim at production weights
(practice 0.15, noise 14). 1089 driver-obs/race-set, 6 reps @ 6000 sims to kill MC noise. RESULT
(overall_avg vs avg_pace):
- overall_avg WINS EVERY BETTING MARKET (small but consistent across all 4): win Brier 0.0223 vs
  0.0227, top3 0.0576 vs 0.0581, top5 0.0865 vs 0.0869, top10 0.1499 vs 0.1505. MAE trivially better
  for avg_pace (7.708 vs 7.701 — a rounding error).
- CALIBRATION seals it: favorite gap +4.2 (overall_avg) vs +9.2 (avg_pace). avg_pace's >=20%-win
  favorites won only 20.4% vs 25.4% for overall_avg. This is the known avgPace-rewards-fresh-tire
  effect leaking into the sim: it inflates top drivers -> overconfident favorites -> fake value vs
  sportsbook lines (the exact failure mode we tune against). VERDICT: keep the sim on overall_avg.
  It is NOT an inconsistency that the grade uses avg_pace while the sim uses overall_avg — each uses
  what's best for its job (grade = most predictive of finish; sim = best-calibrated favorites for
  betting). No code change shipped.
- BACKFILL WAS COMPLETE, not partial. An initial run mistakenly concluded only 16 races had raw laps;
  root cause was a HARNESS BUG, not missing data: the REST pagination helper used Range headers with
  NO `order=` clause, so PostgREST returned unstable page windows that silently SKIPPED most 2025 rows
  and DUPLICATED 2026 ones (landed on a plausible-looking 41,529 total that was the wrong set). 2025
  cup practice_laps actually has 22,148 rows across all 14 tracks; every stored 2025 session has its
  raw laps. LESSON for any future REST backtest harness: ALWAYS add `&order=id.asc` to Range-paginated
  fetches or you get a corrupted subset that fails silently. (The earlier 29-race weight re-tune read
  practice_SESSIONS, small enough to fit one page, so it was unaffected — consistent with "it tested
  fine earlier".) avg_pace IS still null in stored practice_sessions (column just added; only re-uploads
  populate it), so this A/B recomputed both metrics from raw laps rather than reading stored columns.

### GRADE FORMULA -> All Laps .50 / Best Lap .50 (commit 789c58b8, 2026-07-04)
Superseded the run-aware grade (avgPace .70 / bestStint .30). Full-field grade-vs-finish backtest:
1220 driver-obs across 33 Cup races (29 ovals), 98% avg field coverage, ALL Cup practice sessions
except the 1 upcoming race (Chicagoland 2026, no finish to score). Metric = avg within-race Spearman
of the rank-scaled composite vs actual finish_position. Sweep (ovals):
- CURRENT avgPace.70/bestStint.30: 0.246
- pure All Laps (overall_avg): 0.265  (All Laps alone beats avgPace 0.262 and the current grade)
- All Laps.70 / Best Lap.30: 0.296
- **All Laps.50 / Best Lap.50: 0.306  <- SHIPPED (+24% vs current)**  (55/45 & 60/40 ~tied 0.304/0.299)
KEY INSIGHT: All Laps = sustained pace, Best Lap = raw car speed (single fastest lap) — complementary,
so blending them beats either alone. Best Lap catches drivers who fake a fast short fresh-tire average
but have no outright speed: e.g. Chastain (25 laps, no long run, All Laps 7th but Best Lap 29th) drops
7th->17th; Erik Jones (12 laps, Best Lap 35th) 20th->26th; Larson (fast both ways) stays 1st; Chase
(good outright speed) 25th->22nd. A "no-long-run" penalty was also tested (+, 0.273) but becomes
REDUNDANT once Best Lap is in (Best Lap already catches no-long-run short-runners) so it was NOT shipped.
Best Stint is the WEAKEST single predictor (0.215) — dropped from the grade. avgPace/bestStint/longRun
remain as DISPLAY columns only. Implementation: rankScale('overallAvg') & rankScale('bestLap'),
composite = al*0.50 + bl*0.50 (practiceGrader.js gradePracticeSession).
- ROLLOUT: grade is computed at UPLOAD and STORED (practice_score/practice_grade); the report card
  READS stored values. So existing grades are unchanged until sessions are RE-UPLOADED via Admin.
  overall_avg + best_lap are already stored, so no schema change — just re-upload to apply.

### SIM Best-Lap test -> REJECTED, sim unchanged (2026-07-04)
Tested whether the grade's Best-Lap win also helps the SIM. Real buildSpeedScores/runRaceSim, 29 oval
races, best-lap blended into speedScore at beta=.15/.30/.50, scored on all-markets Brier + favorite gap.
- QUALI ON (normal): +BL.15 gives a marginal, within-noise gain (win 0.0222->0.0219, top10 0.1497->
  0.1485) but MAE slightly worse; BL.30 worse across the board. Redundant with startPos (0.33) — the
  sim already has the REAL qualifying result, strictly better than a practice best-lap proxy.
- QUALI OFF (startPos nulled, "quali not loaded"): best lap STILL doesn't help — win/top-N barely move
  and calibration breaks (favorite gap -5.8 -> -17.6 at BL.20). Corr+track history already carry the
  load when qualifying is missing.
VERDICT: grade and sim value Best Lap oppositely — the grade has NO qualifying input (Best Lap is gold),
the sim HAS it (Best Lap is redundant). No sim change. LESSON: a signal that's great for the finish-
prediction GRADE can be noise for the calibrated betting SIM; always test in the sim's own harness.

### SHORT-RUN practice inflation safeguard -> TESTED, REJECTED (2026-07-04)
Concern: sim practice input is overall_avg (all clean laps); a driver who runs 5 fast fresh-tire laps
and parks it gets a flattering avg vs drivers whose avgs include worn-tire long-run laps. STEP 1
(residual test, 40 races / 1498 obs): bias is REAL (unlike the grader, where it wasn't). corr(laps,
residual) = -0.141; by lap bucket monotonic: <15 laps +4.5 (over-rated), 15-35 +2.4, 35+ -6.0
(under-rated). BUT the fast-practice-short-run cohort (+31 resid, finishes 16.7) is barely worse than
fast-practice-LONG-run (+29, finishes 17.0) -- so the dominant effect is that fast practice pace
over-predicts finish for EVERYONE (~30 pts), and short runs add only ~3 pts on top. That general
over-optimism is already absorbed by practice being only 15% weight. STEP 2 (fix backtest, noise 16,
40 races): lap-count confidence shrinkage (L0=8/12/20) and hard floors (<10, <15 laps -> neutral) ALL
leave win/top3/5/10 Brier flat within noise. Aggressive shrink tightens favorite gap (3.5->0.5) but
only by broadly diluting practice (a backdoor weight cut) at a small Brier/MAE cost -- and the sweep
already says 0.15 is optimal. VERDICT: leave sim practice input alone. Bias is real but immaterial;
targeted fix doesn't move the betting markets. (long_run column only populated 322/1498 rows -- newly
added, fills on re-upload -- so lap count was the reliable signal.) METHOD NOTE: this is the grader
discipline in reverse -- Step 1 confirmed a real bias, Step 2 proved the fix doesn't help the actual
objective, so ship nothing.

### RAIN-OUT GRID TOGGLE — SHIPPED (commit c3f75c0c, 2026-07-05)
When qualifying rains out, the grid is a points/owner draw with ZERO speed signal, yet the sim weights
startPos 0.33 — so fast cars that draw deep get buried. Added a **"Rain-out grid" checkbox** to
SimulationCenter (next to Reset Defaults). Checked -> `__applyRainOut(weights, rainOut)` remaps the
ACTIVE weights: startPos -> 0.12, freed 0.21 split 50/50 into corrHistory + longRunPace. Wired into the
`buildSpeedScores` useMemo (rainOut added to deps). Default OFF, so normal races are byte-identical to
before (no regression). It is a TOGGLE, NOT a permanent weight change — the 29/40-race sweeps already
proved startPos 0.33 is optimal on NORMAL grids; the gain is purely top-of-board on draw grids.

VALIDATION (O'Reilly Chicagoland 2026, rain-out, n=1): reconstructed the exact published board via REST
(buildSpeedScores/runRaceSim fetched from source; corr history from prior grp-2 O'Reilly loop_data,
start from practice_sessions.qualifying_position since qualifying_results was empty). Reconstruction vs
published projFin = **Spearman 0.966** (harness = production math on production inputs). Then graded
production (start 0.33) vs low-start (0.12) against the actual 38-car finish:
- Whole-field accuracy: a WASH. MAE 6.42 -> 6.50, Spearman-vs-actual 0.726 -> 0.733. startPos still
  predicts the mid/back fine, and MAE averages the whole field, so it barely moves.
- TOP OF BOARD (where bets live): materially better. The 4 deep-start cars that ran top-7 (Jones 29->1st,
  Gray 25->7th led 55, Hill 16->5th, Allgaier 17->6th) went from a combined 12.3% -> 25.1% win prob. It
  correctly COOLED the front-starters who faded (Day P4->19th 8.2->5.6; Creed P8->16th 5.8->4.5). Cost:
  softened Crews (legit, P2->4th) 8.3->5.2.
- Does NOT fix Chase Elliott (start 11 -> 2nd, led 78, stayed ~2%): his miss is THIN DATA (Cup crossover,
  almost no O'Reilly intermediate history -> weak corrAvgRating), not a start problem. Separate lever:
  borrow a crossover driver's rating from another series / a track-type prior.
LESSON (re-confirms the season theme): judge on the BETTING MARKETS (top-of-board win/top-N calibration),
not finish MAE. MAE said "no change"; the win-prob shift said "big improvement where it matters." n=1 —
re-validate as more rain-out/draw-grid races accumulate.

RAIN-OUT LIVE GRADE #2 — O'Reilly Chicagoland R20 (2026-07-06, via the Sim Grader tool). Re-ran the
O'Reilly sim with rain-out grid ON + corr history bumped to 0.50 (no prior Chicagoland O'Reilly track
history), published, and graded vs the actual finish through the Grade Center. Full field n=35: MAE 6.38,
Spearman(projFinish) 0.797, win Brier 0.0286, top-10 precision 9/10. Betting columns blank (no odds logged).
KEY: proj-vs-finish corr 0.77 >> start-vs-finish corr 0.54 -- on a draw grid the model added real signal
BEYOND the grid, which is the toggle's whole purpose. Deep starters correctly NOT buried: Jones
start29->proj12 (won), Allgaier start17->proj8.2 (top win pick 25.9%, finished 6th), Gray 25->13->7th,
Custer 21->18->9th, Hill 16->14->5th; polesitter Zilisch start1->proj12.8 (not over-credited)->10th.
Residual misses are the CROSSOVER-driver gap (Elliott proj11->2nd, thin O'Reilly history -- task #116), NOT
start. Stronger grade than Cup R19 (Spearman 0.797 vs 0.539, MAE 6.38 vs 7.16) and beats the earlier
reconstruction of this race (~0.73 / 6.42). Second n=1 for the rain-out toggle -- accumulating in sim_grades.

### FAVORITE CALIBRATION + FAT-TAIL NOISE TEST (2026-07-05) — tested, HELD (keep gaussian)
User's instinct: sim runs "a touch high" on favorites in the WIN market. Corroborated two ways this week —
a friend's sim was much flatter at the top (Hamlin 13.5% vs ours 30.5%) and the DK/FD/HR de-vig sat below us
too (Hamlin ~19.5%, Larson ~13.7%). Two tests on the reduced model (practice 0; corr 0.50 / start 0.33 /
raceCraft 0.02 / track 0.15; noise 16; leak-free corr from prior seasons; MC winPct).

1. FAVORITE CALIBRATION (does projected win% match actual win rate?).
   - 64 OVAL races: >20%-projected bin OVERSHOOTS (proj ~28% / actual ~22%, favGap +3.1) -> looked
     overconfident. BUT the single top favorite per race is calibrated (proj 23.9% / actual 25.0%). The
     overshoot is a MULTI-favorite artifact: two 20%+ drivers can't both win (this week = Hamlin+Larson 1-2).
   - 91 races (FULL Next Gen, ALL track types incl superspeedway grp4 + road grp8): overconfidence MUCH
     milder — favGap +1.8, >20% bin proj 27.7 / actual 25.3 (~2pt overshoot). The oval-only cut OVERSTATED it
     (it concentrated the strong-favorite intermediates). LESSON: calibrate on the full track-type mix, not an
     oval subset — the subset exaggerated a favorite bias that's actually small.

2. FAT-TAIL NOISE (the proposed fix for favorite overconfidence). Swapped gaussian for Laplace and Student-t
   (df 3/4/6), all scaled to unit variance x 16. On 91 races:
   - WIN Brier FLAT across every arm (0.0261). Fat tails don't sharpen winner prediction at all.
   - Fat tails DEGRADE top-5/top-10: top10 gaussian 0.1866 -> Laplace 0.1911 -> t3 0.1955 (worse as tails
     fatten). Global fat tails add chaos to EVERY finishing slot, blurring top-N.
   - favGap: Laplace zeroes it (1.8 -> -0.4) but at the top-10 cost above; t3 overshoots the other way (+3.0).
   VERDICT: keep gaussian, ship nothing. Favorite overconfidence is small (~2pt) and largely a small-sample
   artifact; fat tails trade a sliver of favorite calibration for real top-N accuracy loss — net negative for
   a 4-market tool. Same efficient-frontier wall as the recency / DNF-rate / short-run / DNF-pollution tests.
   - OPTIONAL surgical alternative (not built): shrink DISPLAYED win% >~20% a few points toward the field
     (output-only patch) — fixes the win-market favorite shading without touching the finishing-order sim, so
     top-N is unaffected. Judgment polish, not a model change.
   - This week's Hamlin/Larson (30/27 vs market 19.5/13.7) is a genuine OUTLIER race (two elite cars start
     1-2), NOT a systematic bias — aggregate calibration says the engine is fine. Shade by hand if wanted.

### FIRST REAL-RACE BETTING VALIDATION — Cup Chicagoland 2026 (2026-07-05, race day)
First live grade of a PUBLISHED sim + its market-value board against an actual finish (Briscoe won;
Byron P4, Bowman P5). Ground truth = 38-car timing sheet. Graded via REST: pulled sim_results.results
(which persists proj_finish, win/top3/5/10 %, start_pos, AND the full `mv` odds object per driver —
{dk,fd,hr,best,bb,ev,mev} per market), joined actual finish by car number.

OUR SIM vs actual (full field): finish MAE 7.16, Spearman(projFinish) 0.539, win Brier 0.0289;
top-3 hit 1/3, top-5 3/5, top-10 6/10. In-band for our normal range. This was a HIGH-VARIANCE race
for the chalk: our two top win picks Larson (27% -> P34) and Reddick (6.6% -> P36) both faded/wrecked,
which drags every whole-field metric. Winner Briscoe: we had 4.4% win / projFin 11.7 (fine for a ~4%
longshot; the team-cutoff is what made 4.4% believable vs the old 1.4%).

FRIEND HEAD-TO-HEAD (common 15 drivers, Brier lower=better): WIN you 0.0732 / friend 0.0654 (FRIEND
better); TOP3 you 0.1319 / friend 0.140 (you); TOP5 you 0.1487 / friend 0.174 (you, clear); TOP10 you
0.265 / friend 0.261 (tie); Spearman win%->finish you 0.196 / friend 0.121 (you). => Confirms the
"you concentrate, friend spreads" split IN LIVE DATA: his flatter board won the pure WIN market this
week (both loved Hamlin/Larson, Larson busted, his lower numbers ate less Brier), but your sharper
top-of-board beat him on top-3, top-5, and ordering. You win 3 of 5 columns; he wins the one market
that punishes concentration when a favorite busts.

+EV BETS the market-value tool flagged (26 flags, flat 1u at best price): 11 hit / 15 miss, +15.4u,
+59% ROI overall. BUT the split is the whole story:
- WIN market: 0/4, -100% ROI. Larson +500 (our biggest edge, ev+62), Byron +1600, Hamlin +300,
  Buescher +2500 — ALL lost. This is the favorite-overconfidence flaw hitting exactly where predicted.
- EX-WIN (top-3/5/10, 22 bets): 11/11, +19.4u, +88% ROI. The value engine PRINTS where it's calibrated.
- MODEL+CONSENSUS agree (5 bets): +14.1u, +282% ROI — all Bowman (T5 +1300 ev+83, T10 +410 ev+100,
  both consensus-backed, finished P5). Bowman was the model's masterpiece and the "major value" call.
- Briscoe nuance: NOT flagged in WIN (correct — we had him at market), but flagged +EV in T3 (+490),
  T5 (+210), T10 (-135) and he WON, so all three cashed. The model DID find Briscoe value — in the
  placement markets, correctly, not outright.
CAVEAT (matters for calibration): Larson (P34) and Buescher (P19, 4 flags all missed) were
PROCESS-GOOD / RESULT-BAD — Larson ran up front before his issue; Buescher was strong until a bad
green-flag pit stop. Those win-market misses are variance/operational, NOT the model misreading speed,
so they OVERSTATE the model flaw. But the DIRECTION (favorites priced high) still matches the 91-race
favGap +1.8, so the conclusion stands. n=1 race — accumulate before trusting the magnitude.
VERDICT: strongest evidence yet for the WIN-MARKET-ONLY output shade (top-N needs nothing). Build a
results-log so this becomes n-many, not n=1 (sim board + odds already persist in sim_results.results;
the gap is capturing ACTUAL finish + a per-race grades table). See win-shade design in Next candidates.

### WIN-MARKET SHADE — SHIPPED as admin-only diagnostic (commit f4ad0212, 2026-07-06)
Built the win-market favorite shade as an ADMIN-ONLY, OUTPUT-ONLY panel in Sim Admin (SimulationCenter).
It is NOT on the public board and NOT in the publish payload -- it never touches sim_results, the
finishing-order sim, or the top-N markets. UI: a "Win-market shade" checkbox below the odds/publish
section (only rendered when a sim has been run), a lambda slider (0 = raw model, 1 = pinned to market),
and a table of every favorite (win% > 18%) + any win +EV flag showing Model% / Market% / Shaded% / EV raw /
EV shaded, tagging which win +EV edges get "edge removed". MATH: shades favorites DOWNWARD toward the
de-vigged consensus, pSh = pRaw - lambda*(pRaw - cons) for pRaw > 18 and pRaw > cons, where
cons = (mv.win.mev/100 + 1)/decimal(best) [same de-vig the value tool already computes; mev is the stored
consensus-EV-vs-best]. Reads simResults.winPct + the pasted odds via __marketValue; requires win odds
pasted (else "paste win-market odds"). DEFAULT lambda 0.5 is a PLACEHOLDER off the ~2pt / n-few favGap --
do NOT trust the magnitude; tune from the sim_grades log as win-market races accumulate. SELF-FADING: if
the favorite bias shrinks (better data / crossover fix), slide lambda -> 0 and it no-ops. Rationale for
output-only vs an in-model fix (the fat-tail efficient-frontier wall; part of the "bias" is legit
model-vs-market disagreement) is in the FAVORITE CALIBRATION + FAT-TAIL sections above. It is a decision
lens for the operator, not a change to what users see.

### SUPERSPEEDWAY WEIGHTS + Pre/Post stage + shade UI (2026-07-06, commits 3b01a5b7 / 30f500fe)
Wired a 3rd auto-selected weight regime for pack tracks. isSuperspeedway(trackName) matches daytona /
talladega / atlanta / ECHOPARK (Atlanta was renamed EchoPark Speedway in 2024 -- both names live in the DB,
so the substring check MUST include echopark or the current Atlanta race silently gets oval weights).
Selection order in the config-load effect: isSuperspeedway ? SUPERSPEEDWAY_WEIGHTS : isRoadCourse ?
ROAD_COURSE_WEIGHTS : DEFAULT_WEIGHTS. On a superspeedway load it also auto-sets DNF preset -> High and
leaves caution at Medium (user override still works).
SUPERSPEEDWAY_WEIGHTS: corrHistory 0.50, trackHistory 0.30, startPos 0.15, raceCraft 0.05, longRunPace 0,
shortRunPace 0, tireFalloff 0. Rationale: pack racing is draft-skill + luck; qualifying is near-noise
(startPos slashed 0.33->0.15), practice is useless AND absent for Atlanta (->0), so the freed weight loads
onto the two skill signals (corr-group avg rating 0.50 + specific-track drafting history 0.30). PROVISIONAL
-- reasoned, NOT backtested (superspeedways were excluded from the oval sweeps because luck dominates and
MAE is uninformative). Validate via the grader on Atlanta; the tell is win-market calibration (favorites
must NOT be over-confident on a pack track).
DNF/CAUTION RESEARCH (Cup 2022+, my DNF proxy laps_completed < 0.9*max):
  Atlanta(+EchoPark) DNF 20.7% (9 races, range 7.9-32.5), cautions avg 9.4 / 57 caution laps.
  Daytona DNF 20.1% (one 51% outlier fall 2022), cautions avg 6.3.  Talladega DNF 15.8%, cautions avg 5.3.
  => High DNF (25%) is the CLOSER preset to Atlanta's ~21% (true rate a hair below High; presets are fixed
  15/25 so High wins vs Medium). Medium caution (Cup Medium count=8) fits Atlanta's 9.4 well. So the shipped
  default (High DNF / Medium caution) is data-validated FOR ATLANTA. NOTE: Atlanta has MORE cautions (9.4)
  than Daytona/Talladega (5-6) -- it's a hybrid (pack-race style but intermediate-track caution frequency),
  so Daytona/Talladega actual cautions sit Low-Medium; per-track caution precision is a future refinement.
Also shipped same day: Pre/Post SIM STAGE (sim_results.stage + sim_grades.stage columns; stage toggle in Sim
Admin, stage-aware delete so pre+post coexist; stage selector + Stage column + per-(race,stage) dedup in the
Grade Center) to measure the marginal value of practice+qualifying (pre-MAE vs post-MAE). And the win-market
shade panel (see section above).
GAP FLAGGED: the grade does NOT store the weight set / caution / DNF presets that produced the sim -- so the
sim_grades log can't yet tell you WHICH config gave a given MAE. Important now that weights vary by track
type + pre/post. Next: snapshot {weights, caution, dnf, rainOut, stage} onto the published sim and copy into
the grade row.

### Next candidates (not yet built)
- **Win-market favorite shade (output-only, PROTOTYPE)**: shade DISPLAYED win% only; leave the
  finishing-order sim and all top-N markets byte-identical. Two-part: (1) when odds are loaded, pull
  favorites (win% above ~18%) a fraction lambda toward the no-vig CONSENSUS, downward only, never below
  consensus — this directly kills FALSE favorite edges (the Larson +500/ev+62 type) while leaving
  mid/longshot value untouched; (2) no-odds fallback = parametric compression p' = t + (p-t)*k for p>t
  (t~0.18, k~0.7), redistribute shaved mass to sub-threshold field so win% still sums to ~100. Recompute
  ONLY win-market EV/fair from the shaded prob. Show raw + shaded side by side; make it a labeled toggle.
  Do NOT hard-set lambda/k from one race — default from 91-race favGap (~2pt) and tune on the results-log.
- **Results-log / grade archive**: sim board + odds ALREADY persist in sim_results.results. Gap =
  (a) record ACTUAL finishing order per race (Admin "Grade Race": paste order or import from loop_data
  once it lands), (b) append a per-race grades row (MAE/Brier/ROI-by-market, +EV flag hit/miss detail,
  shade on/off) to a new table so the betting sample accumulates for tuning.
- **Crossover-driver prior**: fix the Elliott-type miss — Cup regulars with thin O'Reilly/Truck history
  get a weak corrAvgRating. Borrow their rating from their primary series or a track-type prior.
- **Bigger practice sample**: user backfilling 2025 Next Gen practice; re-run the practice-edge
  residual test (item 5 above) once loaded — the one practice lever that hinted at signal.
- **Betting-value engine**: de-vig sportsbook odds, compute edge/EV/Kelly vs the now-
  calibrated win/top-N. Highest-differentiation feature; currently absent.
- **DFS value layer**: DK salary, value (pts/$), projected ownership, leverage, optimizer
  with ceiling/floor from the finish percentiles.

---

## ARCHIVE C — Post-trim backtests (added after the 2026-07-06 split)

### TRUCK ROAD-COURSE WEIGHT SWEEP -> raceCraft cut, per-series road weights (2026-07-07)
First per-series tuning run kept STRICTLY within the Truck series (user's discipline: don't
mix series). Question: is road-course raceCraft (0.25) earning its keep? Cup analysis had
already flagged it as ~redundant with driver_rating.

SAMPLE: truck road-course loop_data, found by track_type='road_course' (NOT correlation_group,
which missed the Charlotte Roval + St. Pete + Mexico that were unassigned -- since fixed to
grp 8). 11 races, 9 gradeable leak-free: 2022 Sonoma (relabeled from a bad cup load) + 2022
Mid-Ohio + 2023 COTA + 2023 Mid-Ohio + 2024 COTA + 2025 Roval/Lime Rock/Watkins + 2026
Coronado/St.Pete/Watkins. Mid-Ohio had loop_data but no tracks row (added). Ordered
leak-free by RACE DATE (loop_data race_numbers are unreliable, e.g. 2022 Mid-Ohio stamped R1).

METHOD: small-sample-appropriate. NOT win/top-N Brier (8-9 winners = noise); used leak-free
RANKING (Spearman of projected rank vs actual finish) + precision@N (of projected top-N, how
many actually finished top-N). Harness replicates buildSpeedScores essentials: year-weighted
corr rating (shrunk by nCorr/4), normalized inputs, weighted composite, rank. startPos from
loop_data.start_position (VALID pre-race input -- known before green flag; this is why the
sweep could judge startPos even though trucks have no qualifying_results).

RESULTS (9 gradeable):
- raceCraft sweep (startPos .15): craft0 Spearman 0.462 / top10 0.600; craft25 0.440 / 0.578.
  MONOTONIC -- every step off raceCraft onto corr improves. craft25 is the WORST. Directional
  signal check (212 rows): quality-pass% 0.81 corr with driver_rating; partial corr w/ finish
  controlling for rating = +0.15 (WRONG sign for a helpful predictor). => raceCraft redundant.
- startPos sweep (craft0): 10->0.449, 15->0.462, 20->0.466, 25->0.471 Spearman (MONOTONIC UP);
  top5 0.444->0.467. top10 slightly DOWN (0.611->0.589). Trucks reward startPos MORE than Cup
  road -- the OPPOSITE direction from Cup (where startPos was cut for poor-qualifying ringers).
- trackHistory sweep: track15 top5 0.467 (marginal help), Spearman ~flat.
- Market view (precision@N, earlier 8-race run): WIN flat 4/8 across ALL configs (raceCraft
  irrelevant to winner pick), top3 flat ~0.458, top5 noisy, top10 monotonic w/ raceCraft cut.

SHIPPED:
1. raceCraft CUT 0.25 -> 0 on ALL road courses, folded into corrHistory (Cup/O'Reilly
   ROAD_COURSE_WEIGHTS corr 0.35 -> 0.60). commit a8c28e46.
2. PER-SERIES road weights: added TRUCK_ROAD_WEIGHTS (corr 0.55 / startPos 0.20 / raceCraft 0
   / practice 0.25), selected when s==='trucks' at the config-load setWeights. Cup/O'Reilly
   unchanged. commits 5f9b21e3 + ff85bd30 (formula panel got a "Road: Trucks" column).

CAVEATS: 9 races is directional, not definitive -- gains are small (Spearman +0.02) but
monotonic (not noise). startPos finding is moot for the LIVE truck sim until a lineup is
loaded (qualifying_results via qual PDF, or practice_sessions.qualifying_position via the
practice uploader) -- trucks have no historical quali. Re-run as 2022 backfill + more truck
road races accumulate. Truck PRACTICE weights (longRun/shortRun/tireFalloff) still untuned --
sit neutral until truck practice is loaded, then sweep those next.

### ARP vs DRIVER RATING ABLATION (task #46) -> EQUIVALENT, keep Driver Rating (2026-07-07)
Fable + our own review flagged that corrHistory uses driver_rating (outcome-heavy, may double-count
ARP). Hypothesis (Fable): ARP alone beats Driver Rating alone. Tested it as the corr-history metric,
Cup OVALS only (grp != 4 superspeedway, != 8 road), leak-free (corr from prior same-group races,
year-weighted), inside a corr(0.52)+startPos(0.48) composite with the production nCorr/4 shrinkage.
FIRST run with a proper TRAIN/TEST split (walk-forward discipline): train 2022-2024 (67 races),
test 2025-2026 (35 races). Configs: Rating, ARP, Blend50, Blend70-rating.
RESULT -- statistically indistinguishable:
  TRAIN: Spearman 0.479 for ALL four; p10 Rating 0.564 / ARP 0.552 (noise); MAE 8.16-8.17.
  TEST:  Spearman 0.472-0.474 all four; p5 0.446-0.457; p10 0.551 all; MAE 8.49-8.52.
Driver Rating and ARP predict finish equally well -- and the blends add nothing. Makes sense:
NASCAR Driver Rating is heavily built FROM avg running position, so they're near-substitutes; the
rating's extra components (laps led, fastest laps) don't add ranking signal beyond ARP but don't
hurt either. VERDICT: keep Driver Rating (incumbent, no churn for zero gain); do NOT switch to ARP
or blend. Fable's hypothesis rejected. META: the train->test consistency (0.479 -> 0.472, same
config ordering) confirms the null is robust out-of-sample -- and this is the reusable walk-forward
harness the Fable exchange called the #1 methodological gap. Use this split structure for future tuning.

### PASS_DIFF (net green-flag passing) as a corr signal -> ADDS NOTHING, keep rating (2026-07-07)
Hunt for a signal orthogonal to position. pass_diff = green_flag_passes - green_flag_times_passed
(net on-track passing = "car on the move"). Tested historical avg pass_diff as a corr input, same
Cup-ovals leak-free harness + train/test split as the ARP ablation. Configs (corr budget 0.52 /
startPos 0.48): Rating (baseline), Rating+PD 0.10, Rating+PD 0.20, PD-only.
RESULT: rating alone wins the primary metrics; pass_diff doesn't help.
  TRAIN: Spearman Rating 0.479 -> PD10 0.476 -> PD20 0.473 -> PDonly 0.426. MAE 8.16 -> 8.21 -> 8.62.
  TEST:  Spearman Rating 0.472 / PD10 0.472 / PD20 0.470 / PDonly 0.436. MAE ~8.5 -> 8.77 (PDonly).
Only wrinkle: a 10% pass_diff slice nudged top-5 (train 0.400->0.415, test 0.457->0.463) but cost
top-10 and overall ordering, and it's inconsistent across splits -- noise-level, not worth it.
pass_diff ALONE is clearly weaker than rating. VERDICT: reject, keep driver_rating alone.
PATTERN (now conclusive): every position/passing metric tested -- ARP (equivalent), pct_quality_passes
(redundant, cut on road), pass_diff (adds nothing) -- is <= driver_rating. The position/passing signal
family is SATURATED by driver_rating (which the formula confirms is ARP x2 + speed + finish + passing
bonuses). No further data-driven signal to extract from the loop data we store. The only orthogonal
lever left is PACE (green-flag speed -- not stored, needs PDF matching, labor-intensive), plus non-metric
improvements: team/manufacturer priors for thin-sample drivers (crossover gap), and the win-market
variance layer (Fable's late-race lottery). Train/test consistency held again -- validation discipline working.

### TRACK CORRELATION GROUPS -> keep current groupings, relabel only (2026-07-08)
Trigger: refine the sim's track correlation groups. User proposed a 1.5mi/2mi intermediate split
and a Bristol/Dover "Concrete Banked Ovals" group, but pushed back that Kansas correlates strongly
with Michigan. Ran a 3-part empirical dial-in BEFORE changing anything.

MECHANISM NOTE (important): the sim pools corr history by `tracks.correlation_group_label`
(SimulationCenter line 452 `.eq('correlation_group_label', cfg.correlation_label)`), NOT the group
number. The old "670hp Package" label spanned group NUMBERS 1 AND 2, so Michigan (grp1) and Kansas
(grp2) were already pooled together via the shared label. The number is vestigial.

1) DE-MEANED CORRELATION. Raw driver_rating correlation across tracks is dominated by "good teams are
good everywhere" (inflates every pair to 0.6-0.9). De-meaned each driver (subtract their own cross-track
mean) to isolate TRACK-SPECIFIC skill, correlated across ~45-65 cup drivers (loop_data driver_rating).
Raw -> de-meaned:
  Kansas-Michigan   0.83 -> 0.40  (strongest real pair -- user right, keep together)
  Phoenix-Dover     0.77 -> 0.18  (collapses -- race nothing alike)
  Bristol-Dover     0.76 -> 0.22  ("concrete banked" idea is ~noise)
  Martinsville-Phx  0.87 -> 0.43  (real flat-track link)
  Kansas-Auto Club  0.50 -> -0.21 (Auto Club a genuine outlier, goes negative)
De-meaning ~halved every raw number; the apparent "short/flat supercluster" was mostly the talent artifact.

2) EXTERNAL CROSS-CHECK. ifantasyrace.com Similar Track Guide agreed on every contested call:
Kansas = Michigan's PRIMARY comp ("mini-Michigan"); Dover a "skill intermediate" NOT grouped with Phoenix;
Bristol/Dover "a stretch, study each as unique"; Atlanta "ultimately unique." Independent corroboration.

3) LEAK-FREE BACKTEST (the arbiter). Per cup oval race, pooled each driver's PRIOR same-group
driver_rating (year-weighted, prior races only) under CURRENT groups vs a finer 7-group synthesis
(Superspeedway / Intermediate / Big Flat=Indy+Pocono / Skill Ovals / Shorter-Flat / Short Track /
Road Course). Metric: Spearman(pooled rating, actual finish), drivers rateable under BOTH, >=8/race.
  2024-26 test (75 races):  current 0.363 vs finer 0.352
  2023-26 test (103 races, 2022 as seed history): current 0.389 vs finer 0.377
  Per-type (2023-26): SS 0.15/0.15, ShortFlat 0.51/0.51, Inter 0.41/0.40, ShortTrk 0.54/0.50,
  Skill 0.38/0.36, BigFlat 0.40/0.36. NOT ONE type improved; smallest new groups (BigFlat n=2,
  ShortTrk n=4) lost most -- thin-sample penalty > better-matched-track benefit.
VERDICT: KEEP current groupings. Similarity analysis correctly ID'd which tracks resemble each other,
but pooling that finely starves each group's history and the sim gets slightly worse. Only change made:
cosmetic RELABEL (Cup-jargon -> series-neutral), groupings untouched -> 670hp Package=Intermediate,
750hp Speedways=Speedways, 750hp Flat Tracks=Short & Flat Tracks (Superspeedway/Road Course kept);
group number normalized so Intermediate isn't split across grp 1/2. Predictive power unchanged (0.389).
NOTABLE: superspeedway corr-history barely predicts finish (Spearman 0.10 -- pack racing near-random);
short tracks / shorter-flats most predictable (~0.5). LESSON: raw cross-track correlation is a
talent-contaminated lens -- always DE-MEAN before drawing track-similarity conclusions.

### SINGLE-TRACK MOVES -> all noise; SPEEDWAYS+INTERMEDIATE MERGE -> real gain, SHIPPED (2026-07-08)
Follow-up to the group audit above (Fable). The 7-group test confounded better-matching with
thinner samples, so it couldn't rule out single-track reassignments between EXISTING large groups
(no sample penalty). Built a full de-meaned track-to-group AFFINITY matrix (Cup, driver_rating,
drivers with >=6 tracks, pairs with >=15 common drivers, dirt Bristol races excluded), then
backtested every flagged move in the leak-free walk-forward harness (pooled prior same-group
rating, year-weighted 1.3/1.0/0.75/0.55/0.4, >=2 prior races, >=8 rateable/race, per-race
Spearman vs finish, PAIRED diff on affected races only, train 2022-24 / test 2025-26).

AFFINITY FINDINGS (de-meaned): Road Course, Superspeedway, Short & Flat all self-cohere
(own-group is best fit for every member; Daytona/Talladega 0.47, Phoenix 0.39, Sonoma 0.46).
The Intermediate/Speedways boundary is where all 8 misfit flags live: Charlotte [Inter] prefers
Speedways (own 0.04 vs 0.23) while Darlington [Spdwy] prefers Intermediate (0.05 vs 0.19) -- an
apparent swap; Auto Club own-affinity NEGATIVE (-0.02, best SS 0.30); Indy oval leans SS
(0.03 vs 0.21); Nashville, Bristol, Kansas, Pocono all cross-flagged with small gaps.

SINGLE-MOVE BACKTESTS -- ALL NOISE (paired diff, train/test): AutoClub->SS +0.005/-0.001;
AutoClub QUARANTINE +0.002/+0.001; Charlotte->Spdwy +0.001/+0.006; Darlington->Inter
+0.007/+0.002; Char+Darl SWAP +0.000/+0.003; Nashville->Inter +0.002/+0.000; IndyOval->SS
+0.000/-0.002; Bristol->Inter -0.005/+0.002. VERDICT: no single reassignment cashes. The
affinity structure is real but the pooled history is robust to boundary placement -- moving one
track just swaps which highly-similar races enter the pool. Assignment lever now CLOSED both
ways (finer groups lose, moves are flat).

MERGE TEST -- Speedways absorbed into Intermediate (one 11-track pool). Motivated by the
two-way cross-affinity (both groups' members prefer or nearly-prefer the other) + the grp 2+3
merge precedent (more history -> better calibration). RESULT: train +0.013 (42r), test +0.020
(25r) -- positive BOTH splits, test stronger, ~3x any single move. Robustness: positive EVERY
year (2022 +0.032, 2023 +0.012, 2024 +0.002, 2025 +0.026, 2026 +0.011); races improved 39 /
worse 23 / flat 5; COMMON-DRIVER paired (isolates matching from coverage) still +0.006/+0.011;
coverage +0.7 rateable drivers/race (35.6 -> 36.3). Gain is ~half depth/matching, ~half
coverage, biggest where history is thinnest (2022, 2025) -- the depth mechanism, as predicted.

CAVEATS: corr-component-only harness (Spearman on pooled rating, not the full sim) -- at corr
weight 0.35 the realized board impact will be smaller; validate on betting markets via the
grader as graded races accumulate. Short & Flat and Superspeedway stay separate (self-cohering;
SS pack racing shares nothing with flat tracks).

SHIPPED 2026-07-08 via SQL editor (anon-key REST writes are blocked -- PATCH returns 200 with 0
rows, so DB changes must go through the SQL editor): Bristol/Darlington/Dover/Nashville/
Rockingham relabeled 'Speedways' -> 'Intermediate' (grp 1), featured_weekend re-synced (no-op --
Atlanta Superspeedway + Lime Rock Road Course were active). REMINDER (label string-equality
fragility): the sim pools by correlation_group_label matched against
featured_weekend.correlation_label -- a typo'd weekend label silently empties corr history.
Consider a Sim Admin guard when the correlated-track list comes back empty, or switch the
line-452 query to group number (now 1:1 with labels).

### BRISTOL -> SHORT & FLAT TRACKS, out of the merged Intermediate (2026-07-08, same day)
User pushed back on Bristol landing in Intermediate via the merge (domain call: half-mile
bullring, not a 1.5-miler). Data supported it: Bristol was the merge's weakest link -- max
affinity 0.16 to ANY group (own old group 0.09), it rode in with Darlington/Dover/Nashville
rather than on its own signal. Targeted 3-way test on Bristol's 7 non-dirt Cup races
(Intermediate vs Short & Flat vs standalone pooling):
  Bristol as Intermediate 0.401, as SHORT & FLAT 0.440 (+0.039, better in 5 of 7 races,
  spring 2024 +0.23), standalone 0.415.
Side-effect checks both neutral: other 14 Intermediates with Bristol removed -0.002/-0.001
(train/test); 8 Short & Flats with Bristol added +0.002/+0.001 (10 improved / 10 worse).
SHIPPED via SQL editor: Bristol -> 'Short & Flat Tracks' (grp 6). n=7 is directional -- but the
move is free everywhere else and matches how the track races. FINAL GROUPS (verified via REST):
Intermediate(14) / Road Course(13) / Short & Flat Tracks(9) / Superspeedway(3).
LESSON: group-level merges can carry weak members along -- after any merge, spot-check each
member's own races against the alternative pools. And the user's track instincts keep grading
out (Kansas-Michigan, now Bristol): treat domain pushback as a test trigger, not a veto target.

### GREEN FLAG SPEED as a sim weight -> REJECTED, saturated by rating (2026-07-08)
User loaded per-race green flag speed into a new `green_flag_speed` table (cup 2022-2026, 173
races, 6336 rows: gfs_rank, mph, finish_pos, short_run flag). This was "the one orthogonal
lever left" (PACE) from the saturation analysis -- now tested and CLOSED.
METHOD: per-race GFS percentile (speeds not comparable across tracks), pooled as a leak-free
historical input exactly like corrHistory (prior same-group races, year-weighted, min 2), Cup
non-SS ovals, 102 races / 3591 driver-obs, train 2022-24 / test 2025-26.
RESULTS:
- corr(pooledGFS, pooledRating) 0.972 -- a near-clone. Only 4-6 pct of GFS variance is unique
  after controlling rating + startPos.
- GFS alone per-race Spearman vs finish: 0.460 train / 0.445 test -- WORSE than rating alone
  (0.479 / 0.472 from the ARP ablation). Never better, so no substitution case.
- PARTIAL CORR (the decisive gate): residualize BOTH GFS and finish on rating+startPos,
  correlate leftovers: train +0.0397, test -0.0451. SIGN FLIPS across splits -> noise. No
  stable orthogonal signal; no weight sweep run (gate failed).
VERDICT: do NOT add GFS to the sim. The saturation pattern now covers PACE too: NASCAR's
driver_rating formula contains speed components, and race-pace rank tracks running position
(clean air), so historical GFS re-encodes rating. The loop-data-derived driver-strength lever
family is now FULLY closed: ARP, quality passes, pass_diff, Best Lap, momentum, and GFS all
<= driver_rating. Remaining levers are structural: team/manufacturer priors for thin-sample
drivers (task #116) and the win-market variance layer.
METHOD TRAP (important, cost one wrong number this session): corr(X, rawResidual) is INVALID
when X correlates with the model's inputs -- any composite-correlated variable mechanically
anti-correlates with the composite's raw residual (we measured -0.41, identical across splits
to 4 decimals = the artifact fingerprint). Always use PROPER partial correlation (residualize
both sides). The practice-EDGE test got away with raw residuals because edge was near-orthogonal
to the model inputs; GFS at 0.97 was maximally not.
DATA FLAGS: (a) green_flag_speed.track has PDF-scraped NAME DRIFT ('Circuit of The Americas',
'Chicago Street Race', 'World Wide Technology Raceway', accented 'Autódromo...') -- violates the
2026-07-06 track-name unification; harness joined by RACE DATE (+/-3 days, cup single-race
weekends) at 96.3 pct driver coverage instead. Normalize the table or fix its loader before any
UI joins on track name (pending task #117). (b) Dirt Bristol arrives as 'Bristol Motor Speedway
Dirt' (separate name, conveniently self-excluding). (c) 3 loop races lack GFS entirely (2022
Sonoma, 2022 + 2025 fall Bristol).

### O'REILLY SUPERSPEEDWAY TUNE -> raceCraft cut + WIN-CONVERSION signal added, SHIPPED (2026-07-08)
User: "back test the start position weight for O'Reilly on superspeedways... try the track
history correlation again, I still think we're low on Austin Hill (5 Atlanta O'Reilly wins,
every book has him favorite). Sim: Hill 16.3% / Love 26.3%. FanDuel: Hill +260 (~27.6%) /
Love +500 (~16.7%) -- roughly inverted. Race craft still 5% on SS, remove it. Grade Winner/
Top3/Top5/Top10." Tracks: Daytona/Talladega/Atlanta, series=oreilly, 20 races 2023-2026,
759 driver-rows. Leak-free harness: year-weighted (2026=2.0/25=1.3/24=0.9/23=0.6) prior-only
pooling of the SS correlation group; composite = normalized weighted sum -> rank; scored
Spearman + precision@1/3/5/10 on the 4 markets; test races require >=15 drivers with prior
history (19 test races).
RESULTS:
- SPEARMAN IS ~0.23 FOR EVERY CONFIG (0.2320-0.2342). Superspeedways are a near-lottery; no
  weight arrangement meaningfully predicts full-field finish order. Expected (pack racing).
- RACE CRAFT = 0 IS FREE: current c50/t30/s15/cr05 = 0.2327 Spearman; c55/t30/s15/cr0 = 0.2327,
  identical to 4 decimals. Race craft (pct_quality_passes) contributes literally nothing on SS.
  CUT it, fold 0.05 into corrHistory (matches the road-course decision).
- START POS is near-noise but NOT harmful: sweep of startPos 0.00-0.25 flat-to-marginally
  positive; 0.20-0.25 appears in several top-market configs. Kept 0.15 (no real edge to moving it).
- TRACK HISTORY WEIGHT CANNOT FIX HILL. Raising trackHistory 0.30->0.50 leaves Hill BELOW Love
  (softmax replication: Hill 7.6% vs Love 10.4% at t50). Reason: track history is built on avg
  driver_rating, and Love's Atlanta rating (110.4) and SS rating (107.9) are BOTH higher than
  Hill's (107.2 / 104.8). The signal itself rates Love above Hill -- no weight on it flips them.
THE REAL FINDING (why the market disagrees with the sim): Atlanta record -- Hill 7 races, 4
WINS, avg fin 7.7, avg rating 111.5; Love 5 races, 0 wins, 0 top-3, avg fin 9.0, avg rating
112.2. All SS -- Hill 20 races / 9 WINS; Love 15 / 2 wins. Hill is boom-or-bust (winning
ratings 141/147 but also a 26th and two 12ths) so his AVERAGE rating washes out to ~Love's,
while Love is steady-good-never-wins. Average driver_rating rewards Love's consistency and
completely ignores Hill's ~45% SS win conversion (Love ~13%). The betting market prices WINS;
our track signal prices average running. That is the entire Hill/Love inversion.
FIX (validated + SHIPPED): add a superspeedway WIN-CONVERSION signal = year-weighted
(win=1.0, top5=0.35, else 0) pooled over the SS correlation group, at 0.20 weight, O'Reilly
only. Leak-free market grade: WINNER-market hit rate 16% -> 42% (nearly 3x) vs rating-only;
combined market avg 0.289 -> 0.366. Spearman dips 0.234 -> 0.219 (trades a little broad-field
accuracy for much sharper top-end/podium calls -- exactly what Winner/Top3 markets reward).
Projection replication under shipped weights: Hill 15.5% > Love 9.4% (~1.65x), matching
FanDuel's +260/+500 (27.6/16.7 = 1.65x); current weights had Love 10.5% > Hill 7.7%.
NEW WEIGHTS: SUPERSPEEDWAY_WEIGHTS (all series) -> corrHistory 0.55 / startPos 0.15 /
trackHistory 0.30 / raceCraft 0.00. NEW ONEILLY_SUPERSPEEDWAY_WEIGHTS -> corrHistory 0.45 /
startPos 0.15 / trackHistory 0.20 / winConversion 0.20 / raceCraft 0.00 (used when
isSuperspeedway && series==='oreilly').
IMPLEMENTATION: SimulationCenter.js commit 4814eb0c (live, bundle main.345252f9.js). Added
corrWinConv to the corrAvgMap pipeline (from loopRows finish_position, already fetched),
winConvScores to buildSpeedScores, a winConversion weight field, and the O'Reilly SS branch at
both weight-selection sites. Guarded with (weights.winConversion||0) so non-O'Reilly/non-SS
races are unaffected. Babel-verified before push.
FOLLOW-UPS: (a) consider extending win-conversion to Cup/Truck superspeedways (mechanism is
series-agnostic; only O'Reilly was backtested here). [ANSWERED same day -- see next entry: Cup
NO, Trucks inconclusive.] (b) the Formula display panel doesn't yet surface the winConversion
row. (c) live in-app numeric verification pending (sim page is subscriber-gated; code +
replication confirm the flip).

### WIN-CONVERSION CROSS-SERIES TEST + SMALL-SAMPLE SHRINKAGE (2026-07-08, Fable)
User asked: does the O'Reilly winConversion signal hold on Cup + Truck superspeedways? Plus two
driver hunches on the live Atlanta 2026 pre board (Day 12.0% win / Caruth 1.1%): Day over-lifted
(3 SS races, already won one), Caruth under-lifted (rt110 at Atlanta 2026 but 1.1%).
HARNESS: replicated the O'Reilly SS harness per series (SS tracks, leak-free prior-only pooling,
absolute year weights 2.0/1.3/0.9/0.6, corr shrunk nR/4 toward 50, trackHist shrunk nT/2, min-max
normalized composite, test races 2023+ with >=15 historied drivers). Configs: A rating-only
(c55/s15/t30), B +winConv raw (c45/s15/t20/wc20), C = B with SHRUNK winConv
(conf min(1, nSS/5), shrunk toward field base rate 0.07).
RESULTS (winner hit / top3 / top5 / top10 / Spearman):
  CUP (21r):     A 5% / .159 / .229 / .352 / .161   B 5% / .143 / .219 / .362 / .160  -> NO transfer.
                 winConv adds nothing and mildly hurts top3. Cup SS has no Hill-type repeat
                 converter; purer lottery (winner hit 5% vs O'Reilly's 21% even rating-only).
  OREILLY (19r): A 21% winner -> B 42% -- REPLICATES the Opus result independently.
                 C (shrunk) KEEPS 42% winner, all other markets within noise -> shrinkage is FREE.
  TRUCKS (9r):   A 11% / .222 / .267  B 11% / .259 / .289 -- directional whisper, 9 races,
                 not shippable. Re-run when the truck SS sample grows.
VERDICT: winConversion stays O'REILLY-ONLY. Do not extend to Cup (tested, negative). Trucks: hold.
DRIVER DIAGNOSIS (both user hunches CONFIRMED, Atlanta 2026 field):
- Corey Day: wcRaw 0.450 on n=3 (fin 27/4/1) -- the #1 winConv score in the FIELD, above Hill's
  0.441 on n=20. Brent Crews same failure mode: 0.35 on n=1. Unshrunk small samples inflate.
  Shrinkage: Day 0.450 -> 0.298 (-34%), Crews -> 0.126 (-64%), Hill/Love UNCHANGED (n>=15).
- Rajah Caruth: wcRaw 0 (oreilly SS line 29/10/8/30, no wins/top5s) -- a hard floor on 20% of
  his composite -- plus pooledRating only 79.3 (the rt110 Atlanta IS in his pool but diluted by
  rt48 + rt54.9 wrecks). Shrinkage barely helps (0 -> 0.014). His real missing info is 9 TRUCK
  SS races (fin 2/4/9 in 2024-25, ratings 84-97) invisible across the series silo -- that is
  exactly what the manual crossover_borrows mechanism (#116) exists for. RECOMMENDATION: add a
  Caruth trucks->oreilly borrow row rather than bending the weight.
TO SHIP (code, O'Reilly SS branch of SimulationCenter): shrink winConversion by sample size --
conf = min(1, nSSraces/5); wcShrunk = conf*wcRaw + (1-conf)*0.07. Backtest-free on all markets,
kills the Day/Crews inflation, changes nothing for established drivers. NOT yet in the code as
of bundle main.345252f9.js.

ATTRIBUTION FOLLOW-UP (user: "is this just an Austin Hill factor?") -- YES, 100 PERCENT.
Race-by-race attribution of the 19 O'Reilly SS test races: config B (+winConv) picks Hill in
ALL 19; Hill won 8; that IS the 42 percent. Rating-only (A) also picked Hill 16/19 but drifted
to Love in races Hill went on to win -- the entire measured gain is "never drift off Hill."
Non-Hill-won races: 0/11 hits under BOTH configs; the signal has never correctly picked a
second winner. REFRAME: winConversion is not a general predictor, it is a calibrated
HILL-CONVERSION PRIOR whose real function is killing the false Love edge at the top of the
board (which the market confirmed). It self-neutralizes if Hill leaves the series or converts
less (everyone else sits near base rate). ALSO: the top5 credit (0.35) contributed NOTHING
measurable in-sample -- its only observed effect is inflating small samples (Crews 0.35 off ONE
top-5, never won; Day #1 in the field off 3 races).
VARIANTS TESTED (both keep winner 42 percent):
  C: win 1.0 / top5 0.35, SHRUNK (conf n/5, prior 0.07): top3 .228 / top5 .337 / top10 .453 /
     spear .232. Day 0.450 -> 0.298, Crews 0.35 -> 0.126, Hill/Love unchanged.
  D: WINS-ONLY, SHRUNK (prior 0.026): top3 .228 / top5 .305 / top10 .447 / spear .230.
     Day -> 0.210, Crews -> 0.021 (base rate -- never won = no credit), Caruth 0.005.
C vs D on markets is within noise (top5 diff ~3 slots over 19 races); winner market identical.
RECOMMENDED SHIP: D (wins-only + shrinkage). Where the data cannot distinguish, take the
variant whose failure mode is proven-absent: the top5 credit's only demonstrated effect is
small-sample inflation, and "hasn't won a race" scoring ~zero on a WIN-conversion signal is the
defensible semantics. Caruth verdict unchanged: his fix is a crossover_borrows row (truck SS
fin 2/4/9), not this weight.
SHIPPED 2026-07-09: variant D live in SimulationCenter.js (commit d48cab96, bundle
main.5673d1fd.js, round-trip verified). winConv is now wins-only, shrunk conf min(1,n/5) toward
0.026. PENDING: re-run + republish the O'Reilly Atlanta board (published board predates this);
optional Caruth crossover_borrows row.

### TRUCK ROAD PRACTICE WEIGHT -> 0.25 VALIDATED (2026-07-09, first data on this weight)
User uploaded the 5 truck road practice sessions (2025 Lime Rock R15 / Watkins R17 / Roval R22,
2026 St. Pete R3 / Watkins R8 -- all full fields with overall_avg; 2026 Watkins has no stored
qualifying_position, grid taken from loop_data.start_position). The TRUCK_ROAD_WEIGHTS practice
0.25 had been set NEUTRAL/untuned pending exactly this data.
HARNESS: leak-free truck road corr history (prior road races, year-weighted, nCorr/4 shrink) +
startPos + practice (overall_avg per-race percentile, lower better), corr:start held at 55:20
ratio of the non-practice remainder, practice weight swept 0 to 0.40. 5 races, 10+ matched
drivers each (20-32).
RESULTS:
- PRACTICE IS THE STRONGEST TRUCK ROAD SIGNAL: alone Spearman 0.551 (per race 0.84 Lime Rock /
  0.30 Watkins25 / 0.46 Roval / 0.72 St.Pete / 0.44 Watkins26) vs 0.476 for corr+start composite.
  Consistent with thin truck road history making practice relatively more informative.
- SWEEP (avg Spearman): 0 -> .476, .10 -> .488, .15 -> .494, .20 -> .501, .25 -> .510,
  .30 -> .514, .40 -> .514. Monotonic to a plateau at 0.30+.
- PRECISION: p5/p10 IDENTICAL at .25/.30/.40 (0.440/0.560), worse at .15 (0.400/0.540).
VERDICT: KEEP practice 0.25 -- it sits on the plateau; 0.30 gains +0.004 Spearman and zero
top-N on 5 races (noise). Re-sweep when the truck road sample doubles. The provisional weight
is no longer provisional.
ALSO SHIPPED (commit a13ec713): Sim Admin formula panel label renamed 'Long Run Pace' ->
'Practice Pace (All Laps)' -- the metric was always overall_avg (ALL clean laps within 8 pct of
median), not a long-run-only figure; the old name was flagged misleading back in the 2026-07-03
definition test. Weight KEY (longRunPace) unchanged -- display label only, no logic touched.

### TRUCK ROAD PRACTICE SPLIT -> CONSOLIDATED 25/0/0, SHIPPED (2026-07-09, same day)
User caught that the road weight sets still carried shortRunPace 0.05 + tireFalloff 0.05 --
signals folded to 0 on OVALS (2026-07-02) but never re-tested on road; they survived by inertia,
not decision (trackHistory 0 on road IS the decided design). Head-to-head on the same 5 truck
road races, production split (longRun .15 / shortRun .05 / falloff .05, real late_run_avg +
trend_slope inputs) vs consolidated (longRun .25 / shortRun 0 / falloff 0):
  SPLIT 15/5/5: Spearman 0.501, p5 0.400   CONSOLIDATED 25/0/0: Spearman 0.510, p5 0.440
Consolidated wins BOTH metrics, and the falloff input barely exists for trucks (trend_slope
populated 35/177 driver-sessions; late_run_avg 136/177) -- 5 pct weight on a mostly-null column
is neutral-fill dead weight. SHIPPED commit c7980361: TRUCK_ROAD_WEIGHTS longRunPace 0.25 /
shortRunPace 0 / tireFalloff 0 (sum re-verified 1.00).
OPEN: Cup/O'Reilly ROAD_COURSE_WEIGHTS still carry the 15/5/5 split -- same structural question,
needs its own check on cup/oreilly road practice sessions before consolidating (do NOT assume
the truck result transfers; test first). Also fixed pitboard.md section 7 ROAD_COURSE_WEIGHTS
block, which was stale (still showed pre-2026-07-07 corr 0.35 / raceCraft 0.25).

### MARKET-VALUE TAIL GUARD -> SHIPPED (2026-07-09, the Reaume case)
Lime Rock truck board flagged Josh Reaume +12000 top-3 as +57 pct edge. User (correctly): "he
will never finish there." DIAGNOSIS from the published board: Reaume and Mini Tyrrell have
IDENTICAL model lines (top3 1.3 / win 0.2 / projFin 20.3) -- both are no-history drivers on the
fully-shrunk neutral composite. The 1.3 pct top-3 is pure MC tail: under truck caution noise
(Medium 23, STILL the reduced-model tuning -- task #115) a P20-projected car lucks into a podium
~1 in 80 sims. DK's +12000 implies 0.83 pct; model 1.30 vs market 0.83 is a HALF-POINT absolute
difference -- far below the sim's tail resolution -- but longshot decimal odds amplify it to
"+57 pct EV". The whole scrub tier (Garcia/Queen 1.1) sits within noise of each other. The
model has no opinion about Reaume; the edge is arithmetic on noise.
FIX SHIPPED (two layers):
1. __marketValue tail guard (SimulationCenter commit 5b3e477e): ev is NULL when model prob is
   below MINP = win 2 / top3 5 / top5 8 / top10 12 pct. Downstream flag logic (ev > 0) is
   null-safe, so sub-floor drivers can never be flagged +EV at publish time.
2. Display-time floor (SimResults commit 6539783e): the public Market Value table filters rows
   below the same floor via stored modelPct -- this retroactively cleans ALREADY-PUBLISHED
   boards (the live Lime Rock board fixes itself on deploy, no republish needed).
THRESHOLD RATIONALE: the value engine's validation (Chicagoland 11/11 ex-win, +88 pct ROI) was
earned entirely on real-contender flags; the tail was never validated. Floors chosen at ~the
probability where the sim's calibration evidence ends. Adjustable in one place (MINP) if they
prove too tight/loose as the sim_grades value log accumulates.
ROOT CAUSE STILL OPEN: truck noise re-tune (task #115) -- Medium 23 is reduced-model era and
inflates every backmarker tail. Guard treats the symptom safely; re-tune when truck practice
backfill is deep enough.

### EQUIPMENT/CAR PRIOR -> VALIDATED, implementation pending (2026-07-09, new task #118)
Direction hunt ("what signal are we missing"). The loop-data driver-strength family is saturated,
but EQUIPMENT IDENTITY is orthogonal information the model never sees -- and it targets the
documented failure class: no-history drivers currently shrink to neutral 50 (Reaume/Tyrrell
identical lines, Day, Caruth, the Elliott crossover case).
KEY DISCOVERY: green_flag_speed.team is SPONSOR-of-the-week (Wallace shows 20 "teams") -- useless.
But green_flag_speed.car is the stable equipment key (Wallace 23/45; Caruth's ride history reads
cleanly). Car number maps 95.5 pct of ALL loop rows (13,459, all 3 series) via the race-date join.
So the GFS table earns its keep after all -- as a driver->car map, not a pace signal.
METHOD: per-series car histories (pooled prior driver_rating BY CAR, any driver, same correlation
group, year-weighted, leak-free). BLEND: replace the neutral fallback -- corr input becomes
  conf_d*driverPooled + (1-conf_d)*(conf_e*carPooled + (1-conf_e)*50),  conf min(1, n/4).
Established drivers (conf_d 1) are byte-identical; only thin-history drivers change.
RESULTS (2023+ non-SS races, train 22-24 / test 25-26):
- Full-race paired Spearman: cup +0.000/-0.002 (veteran fields, prior rarely activates);
  oreilly +0.012/+0.000; trucks +0.004/+0.011. Small and mostly positive -- thin drivers are a
  minority of each field.
- THIN-DRIVER SUBSET (nD<4, the target, 2303 obs): corr(input, finish) 0.433 -> 0.518.
  OUT-OF-SAMPLE STRONGER THAN IN-SAMPLE: train 0.441 -> 0.507, TEST 0.423 -> 0.540 (+0.117).
  Every series improves: cup 0.206 -> 0.376 (crossovers/subs in known equipment -- biggest
  relative gain), oreilly 0.442 -> 0.532, trucks 0.408 -> 0.488.
VERDICT: the first genuinely new signal since the saturation analysis -- it works because it
covers drivers who don't HAVE a rating yet, not by out-predicting rating. SHIP RECOMMENDATION
(task #118): in SimulationCenter's corr pipeline, fetch green_flag_speed (series + group tracks)
alongside loopRows, build the car map by (normalized driver, race date), pool car ratings like
corrAvgMap, blend per the formula when nCorrRaces < 4; current-race car numbers from
entry_list.car_number. ~40-60 line change in the data-load effect -- implement in a fresh
code-focused session, verify on the Reaume/Tyrrell lines (they should differentiate by ride).
Also subsumes the manual crossover_borrows for most cases (keep borrows for cross-SERIES).

EXTENSION VALIDATED same day -- RIDE-CHANGE EQUIPMENT DELTA for ESTABLISHED drivers (the
Kligerman question: veteran with deep history earned in OLD equipment, now in a better ride --
the thin-prior never fires for him because conf_d is 1). Mechanism: adjusted = driverPooled +
k * confE * (pool(currentCar) - pool(modalHistoricCar)), confE = min(1, min(nNew, nOld)/4).
Trigger is CAR NUMBER, never team name (green_flag_speed.team is sponsor drift). Tested on
1,689 ride-change obs (established, current car differs from modal prior car, both pools n>=2
-- ~1 in 5 established driver-races qualifies):
  k 0.00: train .528 / test .535   k 0.25: train .547 / test .545  <- BEST both splits
  k 0.50: .543/.533   k 0.75: .518/.505   k 1.00: .483/.468 (full delta OVER-attributes badly)
SHIP k = 0.25: quarter-strength equipment credit -- driver skill dominates, equipment shifts
the mean. A veteran moving to equipment that pools 8 points better gets ~+2. Include in #118.
UI SPEC (user request): admin-only "Equipment prior" panel below the weights panel, win-shade
pattern -- renders ONLY affected drivers. Thin-history rows: driver, car, driver-hist (n),
car-hist (n), source-split bar (driver/equipment/neutral), blended corr input + "was X"
counterfactual vs old neutral-shrink. Ride-change rows: old car -> new car, both pools, the
k*delta applied. Established unchanged drivers never render. Numbers must expose the recipe so
the operator can audit any driver's input at a glance. Current-weekend car numbers come from
entry_list (user loads it pre-weekend) -- panel needs a "load entry list" empty state.

STAGE 1 SHIPPED (2026-07-09, commit b24d7beb, bundle main.52d386eb.js, Babel-verified +
round-trip byte-identical): equipment prior LIVE in SimulationCenter. Implementation: corr
history query now selects car_number; loopByCar/carAvgMap pools rating BY CAR (same-series
only, same year weights); corrAvgMap entries carry the driver's modal in-series car; driver
objects get equipRating/nEquipRaces (current car via entry_list.car_number) +
modalEquipRating/nModalEquip; buildSpeedScores scales equipment ratings onto the corrAvgRating
min-max axis (__eqScale) and the shrink line becomes: c = rawC*conf + eqFill*(1-conf), where
eqFill = eqScore*eqConf + 50*(1-eqConf); plus for conf>=1 drivers whose current car differs
from modal car: c += 0.25 * min(1, min(nEquip,nModalEquip)/4) * (eqCurScore - eqModalScore),
clamped 0-100. GUARDS: no car data anywhere -> eqFill 50 -> byte-identical to pre-118. DQ-race
patch applied first (99.93 pct car coverage, 10 permanent NULLs). STAGE 2 PENDING: the admin
Equipment-prior panel (UI spec above) incl. "load entry list" empty state.

STAGE 2 SHIPPED (2026-07-09, commit f851e3cb, bundle main.c66a70de.js, Babel-verified):
Equipment-prior panel live in Sim Admin, below the weights row (next to Rain-out/Reset).
Renders ONLY affected drivers from rawDrivers: thin-history rows (own pool + n, car pool + n,
pct-equipment share) and ride-change rows (modal car pool -> current car pool). Empty states:
"load the entry list" when no roster car numbers; "no drivers affected" otherwise. #118
remaining: loop-loader car_number stamping on new race loads (RR results pages carry the
car column; loader parses those pages already).

### GRADE FORMULA v3 SHIPPED -- avgPace50/bl50 + letter-aligned scores (2026-07-10)
User's stickers/scuffs question reopened the grade-formula grid and found A HOLE IN THE
2026-07-04 SELECTION: avgPace was only ever tested paired with bestStint (0.246, lost); the
avgPace + BestLap pairing was NEVER RUN. Backtests (41 cup oval races 2024-26, rank-scaled
composite vs finish, train 2024 / test 2025-26):
- FULL SAMPLE: avgPace50/bl50 = 0.326 (train .330 / test .325) vs incumbent allLaps50/bl50 =
  0.310 (train .326 / test .304). Consistent both splits, +0.021 out-of-sample.
- Mechanism = the user's stickers/scuffs insight: avgPace weights each RUN's clean mean equally,
  so a long scuffs run cannot drown the stickers run the way lap-weighted All Laps allows.
  Direct check on true 1-set sessions: run1(stickers) alone 0.241 > later(scuffs) alone 0.206.
- 8 PCT MEDIAN CUT CONFIRMED: threshold sweep 4/6/8/10/12 pct -> 0.302/.309/.310/.310/.310.
  Plateau 6-12; only tightening hurts. No change.
- Explicit 2-bucket run-balanced variant (avg of stickers-pace and scuffs-pace): 0.304 -- NOT
  better than avgPace; rejected.
SHIPPED (practiceGrader.js commit 50e90bfb / verified sha 201ef278 -- NOTE: GitHub contents API
served a STALE read on the round-trip check; cache-bust with ?t= before declaring mismatch):
grade v3 = rankScale(avgPace)*.5 + rankScale(bestLap)*.5 (falls back to overallAvg when avgPace
missing). LETTER-ALIGNED SCORES (user request): displayed score now lives in the letter's
academic band (A+ 97-100, A 93-96.9, ... F 40-59.9), positioned by percentile within band;
rank 1 is ALWAYS A+/100 (no more B- at 62.2). Raw composite still orders the field. Grades
recompute ON RE-UPLOAD only, per standing rule. SIM INPUT UNCHANGED (overall_avg -- the
2026-07-04 calibration A/B still governs; grade and sim lanes diverge by design).
ALSO SHIPPED (PracticeReportCard commit 1cc826ff): graded-laps/total in the Laps column +
~fresh-runs hint (both via grader notes JSON, no schema change; heuristic labeled DISPLAY HINT
ONLY), tire-allocation badge from practice_sessions.tire_sets with fresh-rubber comparability
note, low-conf chip for missing long runs, updated tooltips/subtitle.

### CONDITIONED TEST ON TRUE LABELS -> the interaction DISSOLVES; #119 closed-pending-data (2026-07-10)
The definitive rerun with operator-verified tire_sets labels. VERDICT: the earlier "multi-set
sessions favor filt103/best5" finding was AN ARTIFACT OF DETECTOR MISLABELS -- its "multi"
bucket contained Kansas x4, Michigan 2024, Bristol x2, Martinsville 2026, all actually 1-set.
On TRUE labels:
- TRUE MULTI (3 sets, n=2 scoreable): SPLIT. 2025 Indy R22: f103 0.296 / overall 0.161 /
  best5 0.082. 2024 Phoenix R4: overall 0.373 / f103 0.273 / best5 0.255. No conclusion at n=2.
- TRUE SINGLE (37 races): overall 0.249 / f103 0.256 / best5 0.260 -- ALL WITHIN NOISE. Even
  the "incumbent wins single-set" half of the earlier story doesn't hold cleanly.
- 2026 Chicagoland (the 3rd verified multi race) CANNOT score yet: its cup loop_data was never
  loaded (PDF is in the user's NASCAR Loop Data folder -- load it to add the data point).
- Mixed-compound Phoenix R36 shown for reference only: overall 0.328 best there, fittingly.
DISPOSITION: #119 CLOSED-PENDING-DATA. Keep overall_avg unconditionally (incumbent, never
beaten on trustworthy labels). The infrastructure survives and accrues: tire_sets ground truth
per session (uploader field pending), three seasons labeled, mixed-compound exclusion rule.
REOPEN trigger: >= ~8 verified homogeneous multi-set races with practice + finishes.
META-LESSON (the day's biggest): an exciting conditional finding survived TWO backtest reruns
while resting on silent label noise, and died the moment ground truth arrived. Label quality
gates EVERYTHING downstream -- validate the conditioning variable before trusting the
condition. The operator's fact-check (allocations, prime/option) did what no harness could.

### FULL 2024-25 ALLOCATION GROUND TRUTH RETRIEVED + stamped (2026-07-10)
Scraped Jayski Goodyear Fast Facts for every 2024-25 cup race (user's source suggestion; three
article formats handled: "Set limits: Cup: N set(s) for practice" -> "Total Sets: N (... / N
practice)" -> "Total Dry Weather Sets"; late-2025 pages are client-rendered, scraped via
same-origin IFRAMES). RESULTS stamped into practice_sessions.tire_sets by (year, race_number):
- 2025: ALL 1 set except Indianapolis R22 (3) and fall Phoenix R36 (see correction below).
- 2024: multi-set at spring Phoenix R4 (3), COTA R6 (3), Sonoma R16 (3), Iowa R17 (3), Indy
  R22 (3), fall Phoenix R36 (3); TWO-set at Watkins R28, fall Bristol R29, fall Charlotte R32,
  fall Martinsville R35; everything else 1.
DETECTOR FINAL SCORECARD vs truth: false positives Kansas 2024+2025 (both visits 1 set --
Kansas rubbers so fast it fools pace-jump detection every year), Michigan 2024, Martinsville
2026, Coronado 2026; false negative Dover 2026 (2 allowed, unused); under-called Phoenix 2024
(true 3+3, read as ambiguous); correct only on extremes (Chicagoland 3, Indy 79 pct). CONFIRMED
DEAD as a classifier.
USER FACT-CHECK CORRECTION: fall Phoenix 2025 was NOT 4 sets -- it was the PRIME/OPTION
compound experiment (1 prime + 1 option = 2 sets of DIFFERENT compounds: option = short-run
speed with falloff, prime = long-run). Corrected to 2 via SQL. NEW CATEGORY RULE: mixed-compound
sessions must be EXCLUDED from the multi-set treatment in #119 -- cross-driver pace is
confounded by compound choice, worse than tire-age mixing. Ask/flag any other prime-option
points races in the data. LESSON: scraped ground truth still needs domain fact-checking --
the operator caught what the parser could not.

### GROUND-TRUTH CORRECTION -- detector demoted, conditioned finding UNVERIFIED (2026-07-10)
User retrieved TRUE 2026 practice tire allocations (from entry blanks): everything 1 set
EXCEPT Chicagoland (3 sets -- track unvisited 7 years) and Dover (2 sets). Scoring the
fresh-set detector against truth:
- Chicagoland: NAILED (87 pct field, median 3 -- matched the actual 3-set allocation).
- FALSE POSITIVES: Martinsville 2026 (68 pct "multi" -- actually 1 set; short-track rubber-in)
  and Coronado (90 pct "multi" -- actually 1 set; new street course, surface evolved all
  session). Coronado's 90 pct exceeds Chicagoland's TRUE 87 pct -> NO threshold separates
  track evolution from real fresh sets. Detector is DEAD as a session classifier.
- FALSE NEGATIVE: Dover 2026 (2 sets ALLOWED, detector 0 pct -- teams banked the second set,
  likely for qualifying). ALLOWED is not USED; the detector measures usage, entry blanks
  measure allowance, and they disagree in both directions.
CONSEQUENCES: (1) the conditioned backtest below used heuristic labels -- its MULTI bucket
contains at least one confirmed false positive (Martinsville 2026) and all 2024-25 labels are
unverified -> the best5/filt103-on-multi-set finding is DEMOTED TO UNVERIFIED. Only ONE
verified multi-set race with a finish exists (Chicagoland 2026, n=1). (2) practice_sessions
gains a tire_sets column (ALLOWED sets, manual ground truth; 2026 cup fully stamped via SQL;
2024-25 NULL pending retrieval -- the flagged sessions that matter: Kansas 24 x2, Michigan 24,
Bristol 25 x2, Indy 25, Kansas 25 x2, Phoenix 25 x2). (3) Detector demoted to per-driver
"estimated fresh runs" display hint on the report card -- never a classifier. (4) Practice
uploader should gain a Tire Sets input (user enters from the entry blank, 2 seconds/weekend).
STRATEGIC NOTE: multi-set allocations happen when NASCAR expects data-starved weekends (new
tracks, long absences) -- rare, but exactly the weekends where corr history is thinnest and a
practice edge is worth the most. The #119 market test now WAITS for verified multi-set
weekends to accumulate (or 2024-25 allocation retrieval).

### ALLOCATION-CONDITIONED FOLLOW-UP -> real interaction found, market test pending (2026-07-10)
User corrected the era framing: tire allocation varies PER SESSION (1/2/multi sets), not by
year. Built a FRESH-SET DETECTOR from raw practice_laps (runs at lap_number gaps; later run
flagged fresh if its best beats all prior bests by >=0.05s; session-level allocation = share of
field with 2+ est. sets: >=40 pct MULTI, <20 pct SINGLE, else AMBIG). Detector validates
cleanly: sessions split bimodally (0-16 pct vs 51-90 pct); Chicagoland 2026 (the known
multi-set session) flags at 87 pct / median 3 sets; 2026 is NOT uniformly multi-set (8 of its
sessions are single-set) -- the earlier year-based cut was mixing regimes. NOTE: no session
timestamps in practice_laps, so no track-evolution correction possible; the AMBIG band
absorbs the cooling-effect cases.
CONDITIONED HEAD-TO-HEAD (cup ovals 2024-2026, Spearman practice-metric vs finish):
  MULTI-SET (11r):  overall_avg 0.206 | best5 0.242 | filt103 0.250  <- BOTH challengers win
  SINGLE-SET (16r): overall_avg 0.282 | best5 0.275 | filt103 0.273  <- incumbent wins
  AMBIG (9r):       overall_avg 0.293 | best5 0.242 | filt103 0.275  <- best5 punished (cooling)
COHERENT MECHANISM: fresh sets for everyone -> fresh pace is apples-to-apples -> filtered/
short-run metrics gain; single worn set -> all-clean-laps average is the fair comparison. This
also explains why every archive practice test favored overall_avg: the historical sample was
mostly single-set sessions.
CANDIDATE DESIGN (task #119): allocation-conditioned practice input -- overall_avg for
single/ambig sessions, filt103 for detector-flagged multi-set sessions. DO NOT SHIP until it
clears the full-market + favorite-gap bar in the MC harness (11 multi-set races is thin, and
filt103's anchor-to-best is the avg_pace hazard profile). Detector should ship to the
grader/report card NOW (display + stored per-session allocation) so labeled data accrues.
ALSO FLAGGED: practice_laps track_name drift persists (three Vegas spellings, Homestead-MIami
typo) even though practice_sessions was normalized -- normalize before any laps-based joins.
DONE 2026-07-10 (SQL run by user, REST-verified): 4 drift names fixed (Homestead-MIami 1177,
Las Vegas Motorspeedway 1036, Las Vegas Speedway 962 -> Las Vegas Motor Speedway, Nashville
Speedway 1447 -> Nashville Superspeedway); zero orphans remain, 25 distinct names all
canonical. Vegas 3754 / Nashville 2270 / Homestead 2254 laps now unified. NOTE: the earlier
fresh-set detector run computed Vegas allocation on FRAGMENTED sessions -- re-run the detector
after this fix before trusting Vegas session labels.

### EXTERNAL PRACTICE-METRIC PROPOSAL vs INCUMBENT -> archive holds; ONE watch item (2026-07-10)
User brought a Fable-extension Excel analysis of Chicagoland practice recommending: base pace =
best-10-lap window, plus tire deg + consistency as sim inputs, traffic filter at 103 pct of
session best. RECONCILIATION FIRST: (a) its "all-lap average" critique targets a RAW mean --
our overall_avg already cuts laps beyond 8 pct of median (the Wallace 36.2/33.9 examples are
already excluded); (b) run segmentation/falloff/consistency already exist in practiceGrader +
practice_sessions since 19f7bd68; (c) deg (~0.03 corr) and consistency (-0.03) are settled
rejections; (d) "self-selects the freshest set" is the avg_pace calibration failure mode
restated as a feature. NEW and untested: the 103pct filter definition, fresh-set awareness
under the 2026 MULTI-TIRE-SET rules change (satisfies the new-data clause), track evolution.
HEAD-TO-HEAD (36 cup oval practice races from raw practice_laps, 50,310 laps; per-race Spearman
of metric vs finish; replica of stored overall_avg validated at 0.262 vs 0.264 stored):
                 ALL     2024-25  2026-only(10)
  overall_avg    0.264   0.259    0.276
  filt-103pct    0.270   0.265    0.284   <- mild consistent upgrade, BUT fresh-tire-leaning
  best10 w/fb    0.263   0.255    0.285
  best5          0.257   0.234    0.318   <- WATCH ITEM (see below)
  best10 strict  0.229   0.215    0.261   <- loses again, replicating the 2026-07-03 test
VERDICTS: (1) keep overall_avg as the sim input -- the proposal's recommended base pace fails
the same way pooled-long-stints did. (2) filt-103 is a CANDIDATE but must clear the
betting-market + favorite-gap bar in the full-sim harness before any swap (its anchor to
session-best is exactly the avg_pace hazard profile) -- do NOT ship on Spearman alone.
(3) BEST-5 IN THE MULTI-SET ERA is the genuine new signal candidate: 0.318 vs 0.276 on the 10
races run under the 2026 multiple-tire-set rule, while being clearly WORSE (0.234) in the
single-set era. Mechanism plausible: fresh sets for everyone = short-run pace becomes
apples-to-apples. n=10 -- RE-RUN when the 2026 sample reaches ~20 races; if it holds, consider
an ERA-CONDITIONED practice input (overall_avg pre-2026, blend in best5 for multi-set sessions)
tested on full markets. (4) Report-card side is free to adopt display metrics (fresh-set flags,
filtered long-run, per-run views) -- grade and sim serve different masters, per the standing
principle.

STAGE 4 SHIPPED -- LOADER STAMPING, #118 COMPLETE (2026-07-10, commit 19003614, bundle
main.ae1487c6.js): Load New Race (Admin.js) now stamps loop_data.car_number at insert by
joining the PRE-LOADED entry_list (series + race_year + track_name, normalized-name match).
Chosen over scraping RR race-results in the loader: the RR loopdata page the user pastes has
NO car column, RR blocks cross-origin browser fetches (would have needed the serverless), and
entry_list is the same source RR reflects -- already in-house, loaded every weekend per user
workflow. Missing entry list or driver substitution -> NULL (equipment prior degrades to
neutral; backfillable). WORKFLOW ORDER NOW MATTERS: entry list BEFORE loop data load.

STAGE 3 SHIPPED (2026-07-09, commit 4e1d7209, bundle main.9ca65ae6.js): per-driver equipment
INFLUENCE OVERRIDES. Every affected row in the Equipment-prior panel has an "infl" input
(0-150 pct, default 100) + a reset-overrides button in the header. Scale multiplies eqConf in
the thin fill (0 pct -> fill collapses to neutral 50) and multiplies the ride-change delta
directly. Session-only state (eqOverrides in the component, applied in the driversWithScores
useMemo via d.equipScale) -- intentionally NOT persisted, same philosophy as weight nudges:
operator judgment per weekend, model stays the model. NOTE: overrides only affect drivers the
prior touches -- an established driver in their usual ride (Honeycutt) has nothing to scale.

POST-SHIP AUDIT + TWO REFINEMENTS TESTED AND REJECTED (2026-07-09, first live board):
First equipment-prior truck board (Lime Rock). User flagged: Eckes dumped to P17 (correct
mechanism -- ride-change delta vs his #19 championship truck, #91 pool 60.1 dragged by Jack
Wood 2024-25 AND Eckes' own weak 2026 road form rt 72/59/77); Annunziata P5 looked hot (n1
road race, conf 0.25, so 75 pct of his input is the TRICON #1 pool of 98.4 built by ROAD
RINGERS Grala/Hawksworth/Crews); Honeycutt untouched by design (n7 own road races, conf 1,
modal car IS the #11 -- his own record in Heim's truck is the evidence: rt 100-116, good not
Heim); Kligerman has borrow (60 pct oreilly) + ride delta STACKING -- watch for over-adjust.
REFINEMENT 1 -- DE-MEANED car pools (rating minus each contributing driver's own norm, the
track-affinity trick): REJECTED DECISIVELY. Thin fill test corr 0.542 raw -> 0.378 de-meaned
(BELOW the neutral baseline 0.417); ride delta 0.531 -> 0.525. WHY: seat ASSIGNMENT is signal
-- teams consistently staff a given car (TRICON's road truck gets road-capable drivers), so
the raw pool predicts the next occupant partly via hiring policy. De-meaning strips selection
signal and keeps a noisy equipment residual. "Contamination" is doing predictive work.
REFINEMENT 2 -- car pools EXCLUDING the driver's own rows (kill the Eckes double-count):
ALSO worse. Thin 0.545 -> 0.539 test, ride 0.546 -> 0.533. Own recent races in the car are the
freshest evidence; removing them costs more than the double-count distorts.
VERDICT: shipped RAW implementation confirmed against both principled challengers. Individual
eye-test discomfort (Eckes/Annunziata) is the price of the aggregate gain -- arbitrate vs
market odds and the sim_grades log, not by weight surgery. Operator levers for case-by-case
disagreement: crossover_borrows, and visibility via the stage-2 panel.

CAR-NUMBER BACKFILL, FINAL METHOD (2026-07-09, user precision requirement): user correctly
rejected join-trust and proposed Racing Reference as source of record -- RIGHT CALL. RR
race-results URLs are CONSTRUCTIBLE from (year, race_number, series letter W/B/C) via
/race-results/{yyyy}-{rr}/{L}, killing race-identity inference entirely (my GFS date-window
join was the weak link -- it silently mismapped cup 2022 Dover, caught only by validation).
Scraped all 366 races in-browser (same-origin fetch from an RR tab, throttled, ZERO failures),
parsed the results table (car col confirmed against user's screenshot: Sanchez 2 / Heim 11 /
Caruth 71). Validation tiers: VERIFIED 12,861 (RR finish == loop finish); TRUSTED 144 (finish
differs -- post-race DQ/penalty revisions across 25 races, e.g. 2025 Martinsville off-by-one
cascade below the DQ'd car -- but race identity proven by 10+ verified rows + unique name);
NULL 454 (Jason White duplicate-name race, corrupted 'Daniel Su - rez' loop row, name variants).
Alias: John Hunter Nemechek == RR's John H. Nemechek (142 rows). CORROBORATION: 100.00 pct car
agreement with the independent GFS mapping on all 12,473 overlapping rows, zero disagreements.
Deliverable: backfill_loop_car_numbers_rr.sql (13,005 rows, 96.6 pct coverage, self-verifying
queries included). LESSONS: (1) constructed identity beats inferred identity; (2) loop_data
finishes are AS-RACED -- RR reflects official post-penalty revisions; any future finish-based
join must expect ~25 revision races; (3) RR results pages carry car numbers for the loader fix.

### PRACTICE-EDGE AT SCALE (#114) -> CLOSED, sleepers are real but ALREADY PRICED (2026-07-09)
The queued re-run, now on the full sample: 40 cup oval practice races, 1403 driver-obs,
production-shape composite (corr .36 / practice .15 / start .34 / track .15).
- SLEEPER EFFECT CONFIRMED REAL: started outside top-10 + practiced top-5 (n 117) gained avg
  +5.1 places vs -0.5 for everyone else. The +5.9 from the 11-race sample was no fluke.
- BUT: proper PARTIAL correlation of edge vs model residual (controlling corr/start/practice,
  both sides residualized) = -0.0003. Absolute zero. The raw corr(edge, residual) of +0.13 is
  the same mechanical artifact as the GFS -0.41 (edge is BUILT from two model inputs; never
  trust raw-residual correlations for input-derived signals).
INTERPRETATION: the model already prices sleepers -- practice pace and startPos are both inputs,
so "fast in practice + deep in the grid" already projects forward. There is no residual sleeper
alpha to add. VERDICT: task #114 CLOSED, practice lever fully exhausted (input choice, weight,
definition, edge term -- all settled). Do not revisit without a structurally new practice metric.

### ATLANTA: track history vs corr-group history -- pooling WINS, hypothesis rejected (2026-07-10)
User hypothesis: Atlanta post-repave "is its own beast," so pure Atlanta history might pick
winners better than the Superspeedway corr group (Daytona/Talladega/Atlanta). Walk-forward,
leak-free (prior races only by race_date, same-series pooling, age weights 1.3/1.0/.75/.55/.4,
year-weighted mean driver_rating; eligible = drivers with >=1 prior Atlanta AND >=1 prior other-SS
so all variants score the same field). 20 Atlanta races 2022-26 all series; 14 scoreable.
- Winner-hit@1: atl-only 1/14, full group 2/14, group-minus-Atlanta 3/14. Winner-in-top3:
  5/14, 5/14, 4/14. Counts this small are noise -- no winner-picking edge for track history.
- Full-field Spearman: atl-only 0.221 < group-minus-Atl 0.236 < FULL GROUP 0.248. Pure track
  history is the WORST variant tested.
- Blend sweep w*AtlHist + (1-w)*otherSS: Spearman peaks at w=0.30 (0.253); w=1.0 is the floor
  (0.221). The sim's effective Atlanta share at Atlanta (corr 0.55 with Atl inside the pool +
  trackHistory 0.30 on top) ~= 0.45-0.50 -> 0.241 -- inside noise of the 0.30 peak on n=14.
- COVERAGE KILLER: 6 of 20 races skipped because the WINNER had no prior Atlanta start (5 of
  them trucks -- one Atlanta/yr). A track-history-heavy model literally cannot see those
  winners; pooling can.
VERDICT: hypothesis REJECTED. Do NOT raise trackHistory at Atlanta; SS weights stay
(corr 0.55 / trackHistory 0.30 / startPos 0.15). If anything the data leans toward LESS
Atlanta-specific weight, but n=14 with 0.01-magnitude Spearman gaps does not justify a
per-track weight fork. Revisit only if a per-track fork is ever on the table for other reasons.

### CUP SS NOISE CALIBRATION -- favorite 26.3% -> ~10%, 3x noise SHIPPED (2026-07-11)
Trigger: fall-Atlanta cup board (post double-header fix, lineup:none) put Logano at 26.3%
win / fair +280 vs books +1100 (+216% "edge"), Blaney 14.8%. User called it high; DATA AGREES:
- Base rates: cup SS 2022-26 = 16 DIFFERENT winners in 27 races. Logano 2/27 wins, Blaney
  2/27. Books' 8.3% implied ~= his 7.4% base rate. Contrast O'REILLY SS: Hill 9/20 (45%) --
  the two series have OPPOSITE concentration; one noise value cannot fit both.
- Walk-forward noise sweep (proxy composite: corr .647 / trackHist .353 min-max scaled like
  buildSpeedScores, prior-races-only, age wts, MC argmax(score + N(0,noise)) x3000):
  CUP SS (26 races): model favorite won 2/26 (8%) at EVERY noise. Win Brier monotonically
  improves 28.6 (noise 16) -> 25.6-25.8 FLAT across noise 42-90; fav pred matches realized
  ~8-10% at noise 55-70. Noise 16 predicts fav 37% (proxy) / 26.3% (real sim) -- indefensible.
  OREILLY SS (19 races): Brier optimum noise ~28 (24.83), fav pred 28.7% ~ Hill's real 35.3%
  only mildly warm. Flattening further HURTS O'Reilly. Confirms leaving O'Reilly unscaled.
SHIPPED (SimulationCenter commit cfbf464c): handleRun scales cautionPreset.noise x3 when
isSuperspeedway AND series==='cup' (Medium 16 -> 48, inside the flat optimum). O'Reilly + trucks
SS unscaled (trucks sample too small to tune; revisit when it grows). Expected effect: cup SS
favorite ~9-12% win, fair odds near books; the Logano/Blaney "+216%/+78% edges" evaporate.
ACTION: re-run + republish the cup Atlanta board. NOTE: the proxy omits winConv/equipment/
practice, so magnitude is directional -- validate the republished fav% vs books and grade it.
FULL-MARKET EXTENSION (user asked; win-only was not enough):
- CUP SS Brier x1e-3 by market: noise 16 -> 48 improves EVERY market monotonically:
  win 28.65->25.69, top3 89.4->73.7, top5 145.3->116.6, top10 242.6->194.8 (70 adds little).
  Even top-10 -- where flattening was most likely to hurt -- improves, because cup SS
  top-10s are also lottery-spread. The x3 ship is validated on all four markets.
- OREILLY SS: win Brier optimum 23-35 (25.07 at 28) and DEGRADES at 48 (25.62); top3/5/10
  drift slightly better toward 48 but the win market -- where the Hill bets live -- says
  don't flatten to cup levels. NOTE: O'Reilly Medium preset is 18 (NOT inside the optimum).
- TRUCKS SS (user asked to extend): 9 different winners in 11 races; 8 scoreable walk-forward.
  Optimum ~35-46 (win min at 35: 30.21; top3 min 46: 77.8; top10 min 60: 188.7). Preset 23
  is too sharp. Small n -- re-tune when the truck SS sample grows.
DNF RATE CHECK (user asked; never previously tested): actual cup SS DNF rate from
fastest_laps.status, 28 points races 2022-26, 1,044 entries = 25.4% (226 accidents + mech).
The sim's 25% SS preset is VALIDATED as-is. Per track: Daytona 31.8% / Atlanta 24.0% /
Talladega 20.1% -- per-track presets possible but differences too small to bother.
SUPERSEDED SHIP -> per-series multipliers (commit 2532418d, replaces the cup-only x3):
  __SS_NOISE_MULT = cup 3.0 (Medium 16->48), oreilly 1.5 (18->27), trucks 1.75 (23->40) --
  each lands at its measured optimum. Applied in handleRun when isSuperspeedway; noise ONLY
  (caution value/chaos untouched); UI still shows the base preset. Republishing O'Reilly
  Atlanta will pull Hill from 35.3% to roughly upper-20s%, consistent with his real
  dominance priced at the win-Brier optimum rather than above it.

### LIME ROCK TRUCKS DEBRIEF -- chaos race vs Low/Low settings (2026-07-11, race day)
Outcome: Enfinger WON at 1.2% model (longshot tail); Landen Lewis P2 (model had him 5th on
win%, proj 8.6 -- good call); the top of the board (Riggs 34.1%, Majeski 18.1%, Chandler
Smith 12.2%) all crushed by incidents. User: "much more chaotic than last year's race."
CONFIG SNAPSHOT (from the published board -- the new config stamping paying off):
caution LOW (4, noise 15), DNF LOW (5%), lineup practice-fallback. Ex-ante defensible:
2025 Lime Rock had ONE DNF in 34 trucks (3%) -- Low matched the only prior. Ex-post: n=1
race history is a terrible basis for chaos settings, and the asymmetry matters -- under-
estimating chaos concentrates the board (34% road-course favorite) and torches win bets;
overestimating just flattens edges. WORKING RULE going forward: trucks never run below
MEDIUM caution/noise regardless of prior-year cleanliness; bump to High at tight circuits
on judgment. NOT a model change -- run-settings doctrine. Revisit truck ROAD noise with
the SS-style sweep when the sample reaches ~8-10 races (currently ~6).
ACTION: load Lime Rock 2026 loop data when posted, grade the race (ev_flags will honestly
record the losing Riggs/Majeski win flags if odds were attached), and note Lewis P2 as an
ordering win beneath the chaos.
POST-RACE ADDENDUM (loop data loaded): the model's PACE read was RIGHT -- Riggs led 48/100
laps (finished P23 anyway), Ruggiero led 21 (P20), Honeycutt led 14 (P3); the top-2 lap
leaders combined for 69% of the race and finished 23rd/20th. Majeski brake failure from
P6, Annunziata fire from top-5. Attrition: 15% hard DNF vs the 5% preset (3x), 11/33 a lap
down or worse. Finish-order Spearman ~0 while lap-led order matched the board -- the miss
was the ATTRITION/translation layer (run settings), not driver ordering. Grades: pre bets
7 flags, 1 hit (Kligerman t5 +125), net -3.75u; post added ZERO new bets under the pre-
ownership rule (first live use, worked as designed). Post board was WORSE than pre (MAE
9.49->10.27) -- practice weight pushed Riggs up and Kligerman down (P4!); noted, not
actionable at n=1 against the 5-race validation. CAVEAT (operator): the pre and post runs
used DIFFERENT equipment-prior infl values -- the post run's overrides were reconstructed
from memory (persistence shipped between the two runs), so the pre-vs-post delta is
CONFOUNDED and cannot cleanly blame practice inputs. Not diagnosable retroactively (the
config snapshot didn't capture eqOverrides until commit f7e2cd39, which now stamps them
into every published board's config -- future pre/post comparisons are auditable).
sim_grades save needed `alter table sim_grades add column config jsonb` (grader stores
the config snapshot now).

### BET ATTRIBUTION DOCTRINE -- pre board owns the bet (commit d85aa8cf, 2026-07-11)
User insight from Lime Rock grading: the POST-stage grade logged Majeski WIN +700 as a
"miss," but the actual position was taken off the PRE board at better numbers -- the post
flag isn't a bet anyone placed, and logging it double-counts the driver and poisons ROI.
SHIPPED (GradeCenter): grading a post sim now fetches the matching pre board (same series
+ race #), builds its qualified-flag set (same 10%-edge / -250-fav house rule), and
EXCLUDES those driver+market combos from post ev_flags. Post logs only NEWLY qualified
bets (post-P&Q information). The pre-vs-close price gap is CLV (clv_log panel), the pre
grade records the bet outcome, the post grade records only incremental bets. Re-grading a
race # updates its sim_grades row, so re-grade Lime Rock post to strip the phantom flag --
and grade the PRE stage so the real Majeski bet enters the record at its true odds.
Audit of QualifyingCenter.js (user request). Architecture: per-driver NORMAL fit to actual
qualifying positions (track history + corr-group, recency by replication 2026x5..2022x1,
MAD outlier trim), sd floored at per-format "nudge" (qual_sim_config), 2000 draws ->
expected + P10-P90. History keys are track_year_R# (double-header safe BEFORE the race sim
was). Cup only.
- SHIPPED (commit 887b4a7a): fetch now excludes lineup_source metric/rain/practice rows
  (keeps null + 'qualifying'). No contamination existed yet (934 tagged qualifying, 4066
  pre-tag null, 0 synthetic) -- this is a forward guard; the first rain-out metric lineup
  loaded would have become fake qualifying history.
- DRAW ORDER: only 3 events stored (Sonoma/Chicagoland/Atlanta 2026, 90 rows) -- CANNOT
  test draw-order effects (user's hunch confirmed). NOTE FOUND: Atlanta 2026 draw order is
  stored R20 but the cup sim board published as R21 -- reconcile before grading.
- NUDGE BACKTEST (walk-forward, 154 real cup qualifying events, 5.4k driver-events, page
  recipe emulated: same-track all prior + corr-group <=2yr, reps 5/4/2/1, MAD trim, normal
  P10-P90, target 80% coverage):
  CONFIGURED NUDGES FAIL EVERYWHERE: oval 3 -> 59.4%, short 2 -> 56.7%, SS 1 -> 45.6%,
  road 0 -> 50.2% coverage. Bands are ~half as wide as honest. Worst exactly where nudge is
  smallest (SS). Expected-position MAE ~6.6-7.3 across formats -- per-driver qualifying
  history is simply high-variance; the sim was displaying false precision.
  Multiplicative sd*k needs k~2.0-2.4 for 80% but yields WIDER bands (25-31 positions) than
  an additive floor at equal coverage -- floor is the better mechanism (it doesn't further
  inflate already-erratic drivers). Floor sweep: 80% lands at nudge 9 (oval 83.0 / short
  82.4 / road 81.8) and 10 for superspeedway (82.4).
  RECOMMENDED CONFIG (SQL, no code): nudge_oval 9, nudge_short_track 9, nudge_superspeedway
  10, nudge_road 9. Caveat: backtest emulates the page recipe (sim_corr_years window
  approximated); treat 9/10 as calibrated-band values, not decimals.

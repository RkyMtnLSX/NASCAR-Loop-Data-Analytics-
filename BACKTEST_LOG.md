> SESSION START: read PITBOARD_MANUAL.md + PITBOARD_STATE.md first. This file is an append-only ARCHIVE of model evidence (~90k tokens) - SEARCH it for specific backtests; do not read it in full.

# PitBoard — Backtest & Reconstruction Archive

<!-- ============================ SHARED-FILE PROTOCOL ============================
THREE AI sessions edit this file concurrently via the GitHub Contents API. On 2026-07-14 one
session silently REVERTED 665 lines by pairing a stale local copy with a fresh sha. To make that
impossible, EVERY session MUST follow these rules when writing this file~

  1. APPEND ONLY. Never rewrite or delete existing lines. Add your entry at the END. If you must
     correct an earlier entry, append a new dated CORRECTION that quotes it -- do not edit it in place.

  2. GET IMMEDIATELY BEFORE PUT. Read the file (content + sha) as the LAST thing you do before
     writing. Do not build your edit on a copy you fetched earlier in the session.

  3. PUT WITH THE SHA YOU READ THE CONTENT AT -- never a separately re-fetched sha. Pairing old
     content with a newer sha is EXACTLY the clobber that caused the 2026-07-14 loss. If the two
     do not come from the same GET, you are doing it wrong.

  4. ON HTTP 409 (conflict), the file moved under you~ re-GET, re-apply your append to the NEW
     content, and retry. A 409 is the safety net working -- never defeat it by grabbing a new sha.

  5. VERIFY AFTER WRITE~ re-read and confirm both your new entry AND the prior tail are present.

One-time recovery~ if you find your own past entries missing, they are in git history, not gone.
Diff the current HEAD against your last commit, extract the missing sections, and APPEND them back
(see the RECONCILIATION banner further down for how this was done on 2026-07-15).
============================================================================= -->


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

### HARNESS DISCIPLINE: 2022 BURN-IN (formalized 2026-07-14, user-prompted)
The user flagged an unlogged "burn-in" concept (a claimed 2026-07-14 log entry titled "THE
2022 BURN-IN ARTEFACT" does NOT exist in this file -- whichever chat wrote it never pushed;
this section formalizes the idea from first principles + fresh measurement).
MEASURED: 2022 target races grade at composite Spearman ~0.385-0.388 vs ~0.412 for 2023-24
(intermediates, group-scoped, scheme-independent) -- early walk-forward races are predicted
off nearly-empty pools and are LOW-QUALITY EVALUATION POINTS by construction. Since 2022
always lands in TRAIN splits, this explains the recurring test>train pattern across our runs
(decay 0.39/0.42, lottery Brier 26.7/23.8, DNF 24.2/21.9) -- structural, not suspicious.
STANDING RULE: walk-forward harnesses EXCLUDE 2022 target races from SCORING (still used as
history). Splits become clean-train 2023-24 vs test 2025-26. Applied from today.
ADDENDUM to the decay rejection below: under the clean split, the intermediates train
disagreement dissolves to a WASH (buckets 0.4124 vs 4mo 0.4115 vs 6mo 0.4133), test still
favors decay (+0.017). Verdict unchanged (sparse-regime reversals still bar a global swap)
but the revisit clause strengthens.

### WRECK-DECONTAMINATED RATING POOLS -- promising in LUCK regimes, not shippable yet (2026-07-14)
The untested estimator idea (motivating case: Caruth diagnosis 2026-07-09 -- his rt110
Atlanta diluted by rt48/rt54.9 wrecks). Corr pools recomputed 3 ways: incumbent (all races),
EXCL (drop rows where driver completed <90 pct of race laps -- 11.9 pct of all rows), DW03
(down-weight wreck rows x0.3). Walk-forward, group-scoped, 2022 burn-in excluded, clean
23-24 vs test 25-26, composite Spearman:
- SUPERSPEEDWAY: EXCL wins BOTH splits -- clean 0.2014 vs 0.1990, test 0.1387 vs 0.1184
  (+0.020, ~15 pct relative on the regime's weak signal). DW03 in between.
- ROAD: both variants beat incumbent on both splits, modestly (excl +0.007 clean / +0.003
  test; dw03 +0.004 / +0.005).
- INTERMEDIATE + SHORT-FLAT: wash with sign flips (differences +-0.005, noise).
MECHANISM (clean split along luck vs skill): at pack tracks and roads, wrecks are mostly
COLLECTED (someone else's crash) -> wreck-race ratings are noise, removing sharpens. At
intermediates/short tracks wrecks are more often CAUSED -> the low rating carries real
information, deleting it costs what it cleans. Same lesson as the equipment de-meaning
rejection: apparent contamination can be signal.
VERDICT: DO NOT SHIP YET -- the SS gain rests on 10 test races. But this is the most
promising estimator refinement tested (4/4 cells positive in luck regimes, documented prior
case, sensible mechanism). REVISIT end of 2026 season with the fuller sample; candidate ship
shape = wreck-EXCLUSION in corr pools at SS (and possibly road) ONLY, incumbent elsewhere.

### CONTINUOUS RECENCY DECAY vs YEAR BUCKETS -- REJECTED as global swap (2026-07-12)
Estimator-refinement test (first of the "improve the measurement, not add terms" series):
replace the year-bucket age weights (1.3/1.0/.75/.55/.4) with smooth exponential decay by
DAYS, half-life swept 2-18 months. Walk-forward, composite Spearman vs finish, per regime,
GROUP-SCOPED history (matching the sim's corr pooling; an initial all-cup-history run
overstated the gain -- scope the history like production or the result lies).
- INTERMEDIATES (63r, dense group): decay mildly better -- 4mo: train 0.4033 vs bucket
  0.4052 (worse!), test 0.4367 vs 0.4192 (better). Split disagreement. Plateau 3-9mo. Only
  ~52% of races improved (magnitude not breadth). Burn-in diagnostic: decay helps MORE in
  Feb-May (+0.0084) than Jun-Nov (+0.0027) -- dense groups never starve, early-season fear
  refuted HERE.
- SHORT-FLAT (40r): wash (bucket 0.5403 / 6mo 0.5404 / 4mo 0.5355).
- SUPERSPEEDWAY (26r): buckets clearly better (0.1610 vs 0.1475-0.1509).
- ROAD (23r): buckets clearly better (0.4238 vs 0.4050-0.4103).
MECHANISM: sparse groups (road ~5, SS ~6 races/yr) starve under short half-lives -- 1-2
meaningfully-weighted races left in the pool; buckets keep last season alive. Dense groups
can afford aggressive recency.
VERDICT: KEEP YEAR BUCKETS everywhere. A dense-group-only decay fork is not justified by a
test-split-only gain with train disagreement. REVISIT: if the intermediates test-era gain
(+0.017) persists as 2026 accrues, reconsider an intermediates-only half-life ~4-6mo.
NOTE: "burn-in" is not otherwise documented in this log -- all harnesses implicitly skip
races until drivers have >=2-3 prior races and the walk-forward starts several races into
2022; if a prior chat discussed a formal burn-in rule, it was never logged.

### CROSS-SESSION REVIEW NOTE (Fable, 2026-07-12) -- two flags from re-reading the archive
(1) DEPENDENCY WARNING for task #115 (trucks/oreilly base-noise re-tune once practice is
backfilled): the SS noise multipliers (commit 2532418d: cup 3.0 / oreilly 1.5 / trucks 1.75)
were fit to ABSOLUTE optima (cup ~48, oreilly ~27, trucks ~40) as multiples of the
then-current Medium bases (16 / 18 / 23). If #115 changes a base, the effective SS noise
shifts silently (multiplier x new base). Whoever executes #115 must RE-DERIVE the SS
multipliers against the new bases, or convert the mechanism to absolute SS noise values.
(2) STALE NOTE in the Stage-3 equipment entry below: "intentionally NOT persisted" was
superseded 2026-07-11 at operator request -- eqOverrides (and rearOverrides) now PERSIST in
featured_weekend jsonb and are stamped into every published board's config for audit. The
philosophy shifted from "model stays the model" to "operator judgment persists + is
auditable"; the historical entry stands as history.
Review verdicts on the Opus-logged tests, for the record: #114 closure SOLID (its both-sides
partial doctrine underpins the pit-crew test); equipment de-mean/own-exclude rejections
SOLID; allocation-conditioned interaction SUPERSEDED by the true-labels dissolution (arc
complete, reopen trigger stands); filt-103 gate MOOT (its edge dissolved to noise on true
labels); best5-in-2026-era is the ONE live watch item -> re-run at ~20 races of 2026 on true
labels, full-market bar (~September).

### SS STAKING DOCTRINE (operator, 2026-07-11 -- Atlanta O'Reilly destruction derby)
Race: Allgaier won; Sanchez crashed from P2 on the LAST LAP; 17 cars finished 1+ laps down;
top of the board wrecked again (same weekend as the Lime Rock chaos race). Operator policy,
now formal: BET LOW VOLUME AT SUPERSPEEDWAYS. Justification is analytic, not emotional:
(1) variance drag -- SS outcomes are correlated wipeouts (whole slates die together), so
equal EV arrives on a much bumpier path; (2) SS is where model signal is thinnest (fav won
2/26 cup SS; ordering ~noise), so stated edges carry the widest error bars of any we flag.
Lower reliability x higher variance = smaller stakes even under flat-unit doctrine (e.g.
half units, and/or skip win markets, keep placement/matchups). The model PRICED the chaos
(25% DNF validated, flattened noise) -- calibrated edges at chaotic tracks are honest but
should be bet small, which is different from fake edges not bet at all. FUTURE TEST: once
the graded sample is big enough, split realized flag ROI by track type -- if SS flags
underperform other regimes at equal stated edge, the low-volume rule gets a number.

### PIT CREW DATA (pitcrewrank.com) -- STRONGEST RESIDUAL SIGNAL YET; accrue, don't ship (2026-07-11)
User sourced pitcrewrank.com: fan-built, transparent methodology -- trimmed-mean 4-tire stop
times per crew per race, RACE-NORMALIZED z-scores (handles hot-day/track effects), from
NASCAR public timing. Cup 2026 only, 19 races (17 points; Duels + All-Star excluded).
JSON API discovered: /api/races (index) + /api/races/{id}/detail (per-car trimmed_mean,
z_score, stop_count, best/worst). Race numbering matches season R#; join by car or driver.
- PERSISTENCE: corr(first-half z, second-half z) = 0.671 across 35 crews. By far the most
  stable trait tested (cf. DNF propensity's weak terciles). Crews are who they are.
- RESIDUAL TEST (walk-forward, 13 2026 races, prior-races-only crew z, partial Spearman vs
  finish controlling the history composite BOTH-SIDES per doctrine): mean partial +0.073,
  POSITIVE IN 11/13 races (binomial p~0.01). Compare practice-EDGE -0.0003. The two
  negatives are diagnostic: Talladega (pack racing neutralizes pit deltas) and Texas.
- MARKET DIRECTION (12 non-SS races, blend w 0-0.15, descriptive -- no split possible at
  this n): top10 Brier improves monotonically 169.0 -> 165.2; t5 flat; WIN unmoved/worse.
  Consistent with mechanism: crews grind track position, they don't decide wins.
VERDICT: DO NOT SHIP YET (n=12-13, single season, no out-of-sample split possible) but this
clears every bar the rejected ideas failed. PLAN: build pit_crew schema + weekly scrape of
the API after each race; re-test with proper split at ~25 accrued races; design as a
PLACEMENT-market input gated to non-SS tracks. Site updates weekly after each race.
Suggested schema: pit_crew_race(series, year, race_date, race_name, car_number, driver_name,
trimmed_mean, z_score, stop_count, best_stop). Data also enables the passing-difficulty
interaction test (crew value should rise where passing is hardest).
STATUS UPDATE (same night): pit_crew_race table CREATED (user-run SQL, unique on
pcr_race_id+car_number, permissive RLS) and BACKFILLED -- 633 rows, all 17 points races
through Chicago 07-05. Their API is same-origin only (no CORS), so weekly sync is a
BOOKMARKLET the user clicks while on pitcrewrank.com (diffs pcr_race_id against the table,
inserts only new races, merge-duplicates upsert, auto-skips Duels/All-Star) -- delivered
2026-07-11. Fallback: any chat session can sync in-browser. SCOPE DECISION (operator):
track per-CAR crew performance only; crew_assignments member-level tracking deemed not
worth the complexity. Season-scoped rolling window design stands. Re-test with proper
split at ~25 points races (~late August); until then the data accrues weekly.

### RECENT-FORM SLOPE (last 5 in-group races) -- REJECTED out-of-sample (2026-07-11)
User-spec'd: linear slope of driver_rating over the last 5 races WITHIN the correlation
group, min-maxed per race (no-slope drivers neutral 50), blended at w 0-0.22 into the
history composite. Cup intermediates, 63 races (40 train 22-24 / 23 test 25-26), noise 20.
- TRAIN teased: t5 113.7 -> 110.2, t10 181.6 -> 174.6 improving with w; win flat.
- TEST killed it: win Brier DEGRADES monotonically (23.93 -> 24.27), t5 degrades
  (100.3 -> 102.3); only t10 keeps a faint gain (168.7 -> 166.8) -- one sub-market's
  2 pts does not carry a new input.
Interpretation: form is largely redundant with the existing recency year-weighting in corr
(current season already 1.3-2x); the slope adds a noisy second derivative. VERDICT: no
form input. Tonight's tally: lottery, per-driver DNF, form slope -- 3 challengers tested
honestly, 3 rejected out-of-sample, incumbent structure unchanged and stronger for it.

### PER-DRIVER DNF PROPENSITY -- signal REAL but too weak to price; REJECTED (2026-07-11)
Idea: replace the flat per-track DNF rate with per-driver attrition (crash propensity is a
trait; would tax Mayer-class boom/bust drivers and rookies personally). Two-stage test on
all cup loop data (6,085 rows, 163 races, DNF = laps_completed < 90% of race max):
- STAGE A (persistence, walk-forward from 2023-06, 113 races, age-weighted rate shrunk
  k=8/12/18 toward field base): terciles realized DNF 9.0 / 10.4 / 12.8 pct -- monotone,
  stable across k, calibrated (pred 11.5 vs realized 10.8). Crash propensity EXISTS.
- STAGE B (market impact, cup intermediates 64 races, MC with DNF layer flat-vs-personal,
  train 22-24 / test 25-26): NO improvement anywhere. Win Brier train 24.15 vs 24.15,
  test 21.91 flat vs 22.08 personal (worse); t5/t10 slightly worse both splits. A ~4pt
  spread around an 11pct base is too weak -- individual estimation noise cancels the signal
  at market level.
VERDICT: keep flat per-track DNF presets (they're validated: SS 25.4 pct actual vs 25
preset). Possible future refinements if ever revisited: status-based crash-only rates
(fastest_laps.status, cup only), track-type-specific propensity -- but each adds estimator
noise against an already-weak base. Not worth knob risk now.

### LATE-RACE LOTTERY (fable_response.md design) -- MECHANISM SOUND, REJECTED OUT-OF-SAMPLE (2026-07-11)
The gated "pack-only winner reshuffle" (in-sim two-stage draw: with p=chaos_rate the winner
is re-drawn from the top-8 running order, weights score^0.7 -- taxes ONLY the win condition).
Gate was "walk-forward first, then fit chaos_rate" -- the harness now exists; fit was run
honestly: ONE knob (chaos_rate), pack/alpha fixed at 8/0.7, train 2022-24 / test 2025-26,
cup INTERMEDIATES (60 scoreable races, history-only proxy corr .7/track .3, noise 24).
- Realized winner model-rank (all 60): rank1 9 (15%), rank2-3 13, rank4-5 5, rank6-10 18,
  rank11+ 15 -- winners spread deep. Proxy favorite overshoots at every noise (21.7-37%).
- LOTTERY FIT: TRAIN improves monotonically with chaos (winBrier 26.72 -> 26.21 at 0.55;
  era favorites won 2/37 = 5.4%). TEST DEGRADES monotonically (23.77 -> 24.12; era
  favorites won 6/23 = 26%, matching the untaxed sim's 23% favP). The intermediate
  favorite-overshoot was a 2022-24 PARITY-ERA artifact; the 2025-26 era converts favorites
  at rates the incumbent already predicts. Fitting chaos on pooled data would have shipped
  a knob tuned on a dead market regime -- the exact trap the gating anticipated.
- Mechanism validation: placement Briers unchanged across all chaos levels (t5 +-0.5,
  t10 +-1.4) -- the surgical win-tax architecture WORKS; it just has no current target at
  intermediates. SS favorite-overshoot was real but is handled by the per-series noise
  multipliers (SS top-10s are lottery-spread too, so the global flatten was correct there).
VERDICT: do NOT implement. Keep the design on the shelf with this calibration recipe.
REOPEN trigger: if the graded-race favorite gap at intermediates drifts positive (favorites
winning materially less than predicted) over 15+ current-era races. Caveat: proxy omits
startPos/practice; era-split finding is about the TARGET's existence, not exact magnitudes.
The parked "option 4" (ceiling term for bimodal SS drivers), triggered by the Mayer case:
Sam Mayer O'Reilly Atlanta, model 3.4% win (FMV +2841) vs DK +800 (11.1%). His 20-race SS
profile is textbook boom/bust: P2/P3/P5 near-wins (all 2025) + P36/P38/P31 wrecks, 0 wins.
Hypothesis: mean-rating + wins-only winConv under-prices right-tail drafters.
BACKTEST (walk-forward, proxy composite corr .647/track .353 min-maxed, MC at series-optimal
noise, winConv variants year-weighted + shrunk n/5 toward field mean, blended at w 0-0.2):
- OREILLY SS (17 scoreable): variant D (WINS-ONLY) best at w=0.2 -- Brier 24.47, winner-
  assigned prob 19.0%. E1 (podium half-credit) ties Brier at w=0.1 but winnerP only 16.4%;
  E2 (top5 rate) worse everywhere (25.0+). Near-win credit does NOT beat wins-only.
- CUP SS (24 scoreable, noise 48): ALL variants at ALL weights within +-0.15 Brier of
  no-term (MC jitter floor), winnerP ~4.7% flat. No conversion term of any flavor helps
  cup SS. Current cup SS weights (no winConv) stay.
VERDICT: hypothesis REJECTED, option 4 CLOSED. Mayer's 3.4% is what a validated structure
says: O'Reilly SS winners have been repeat closers (Hill 9/20), and near-wins carry no
incremental win signal on this sample. The books' +800 prices reputation/upside the data
does not support -- no model change; bet-against-the-model calls on Mayer-class drivers
are operator discretion, not model error. Caveats: proxy omits practice/equipment, n=17/24.
O'Reilly Atlanta board: Jake Finch (1 prior SS start, P17 in the 55; now in the 9 JRM)
model top-5 21.2% vs market 12-13% (+650/+750, DK-only price). Data: the "elite" 9 car has
0 top-5s in 11 O'Reilly SS races (all B.Jones 23-24, avg fin ~21); drivers with <=1 prior
SS start hit top-5 at 9.8% (18/184) vs field avg ~13% -- rookies UNDERPERFORM at SS, while
thin-history fill pulls them TOWARD equipment level. Even at infl 0 (neutral fill) Finch
sits ~mid-15s: the model has no rookie-penalty concept. OPERATOR ACTION: infl 0, published,
bet PASSED despite displayed edge (model missing a known variable does not get to call
edges on drivers that variable describes; his ARCA Talladega win noted but ARCA SS wins
translate weakly). CANDIDATE TASK: backtest regressing n<=2 drivers toward the SS debut
base rate instead of equipment/neutral fill; validate on the 184-entry sample (win/t3/t5
Briers, walk-forward). His Saturday result is data point #185.

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


=====================================================================================
## RECONCILIATION — 2026-07-14 ENTRIES RESTORED AFTER A CROSS-SESSION REVERT (restored 2026-07-15)
=====================================================================================
A concurrent session pushed BACKTEST_LOG.md from a STALE base copy (commit 9bcfb74, 02:45),
which silently reverted 20 sections written earlier — 665 lines, my entire 2026-07-12 and
2026-07-14 block. The GitHub Contents API only guards against SHA conflicts, not against writing
stale CONTENT under a fresh SHA, so the commit chain stayed linear and the revert was invisible.
The SHIPPED CODE for these entries (exhibitionGuard.js, resolveDnfRate, the DK column-order fix)
was never affected — only this documentation was lost. Recovered verbatim from commit 513f104.

NOTE FOR THE OTHER SESSION~ your new entries (HARNESS DISCIPLINE 2022 BURN-IN, WRECK-DECONTAMINATED
RATING POOLS, CONTINUOUS RECENCY DECAY) are PRESERVED above and NOT touched. Two of the restored
entries below overlap yours~ (1) my "THE 2022 BURN-IN ARTEFACT" has the raw coverage numbers
(2022 75.7pct zero track-history, then 10.0/18.8/6.1/14.0) behind your HARNESS DISCIPLINE rule —
merge as you see fit. (2) my "RECENCY WEIGHTING SWEEP" (07-12) and your "CONTINUOUS RECENCY DECAY"
are independent tests of the same idea, both rejecting it — keep both. Nothing here should overwrite
your work; if anything conflicts, yours is newer on those two topics.

--- RESTORED SECTIONS (verbatim, chronological, from commit 513f104) ---
### CUP/O'REILLY ROAD PRACTICE SPLIT -> CONSOLIDATED 25/0/0, SHIPPED (2026-07-12, commit `0281bc19`)
Closes the open item from the 2026-07-09 truck-road entry ('needs its own check on cup/oreilly road
practice sessions before consolidating -- do NOT assume'). THE DIRECT CHECK IS NOT RUNNABLE, and that
is itself the finding: cup has only 4 ROAD practice sessions and O'Reilly has ONE practice session in
the entire DB (2026 Chicagoland R20 -- an intermediate, not even a road course). A market-scored
train/test weight sweep on n=4 is not a test.
SHIPPED ANYWAY on three independent converging lines, none of which is the missing cup-road sweep:
1. CUP OVALS (large sample, 14 -> 29 -> 40 races): shortRunPace was FOLDED OUT entirely ('redundant
   with longRunPace -- sustained pace is one signal, not two') and tireFalloff DROPPED to 0 ('noisy
   dead weight', the SVG Chicagoland case). Both validated on the betting markets.
2. TRUCK ROAD (5 races, 2026-07-09): consolidated 15/5/5 -> 25/0/0 won BOTH metrics (Spearman 0.501
   -> 0.510, p5 0.400 -> 0.440).
3. COVERAGE on cup road: late_run_avg populated 50 pct of driver-rows, trend_slope only 39 pct. The
   majority of the field is NEUTRAL-FILLED 50 on both inputs -- the same dead-weight profile that
   justified the truck consolidation (trend_slope 35/177 there).
TWO MECHANISMS WORSE THAN PLAIN DILUTION, worth recording:
- AVAILABILITY BIAS (partial coverage): a driver who actually ran a long run and posted real falloff
  is ranked against drivers who simply have NO falloff data sitting at neutral 50. The weight
  effectively penalises teams for gathering data. That is an artifact, not a signal.
- SPREAD COMPRESSION (zero coverage, i.e. O'Reilly road): 25 pct of the composite becomes a constant.
  A constant does not change RANKING, but it shrinks the score spread, and against a FIXED caution-noise
  term a compressed spread means noise dominates more -> the field prices flatter than it is. Missing
  practice is therefore NOT a harmless no-op; it is a calibration effect.
CHANGE: ROAD_COURSE_WEIGHTS longRunPace 0.15 -> 0.25, shortRunPace 0.05 -> 0, tireFalloff 0.05 -> 0.
Practice TOTAL is unchanged at 0.25 and corr/startPos are untouched -- this is a consolidation WITHIN
practice, not a rebalance of the load-bearing inputs, so it cannot disturb them. Sum re-verified 1.00.
shortRunPace and tireFalloff are now 0 in ALL THREE weight sets (ovals, cup/oreilly road, truck road).
HONESTY NOTE: this is a REMOVAL of a provably-mostly-null input, not the ADDITION of a knob -- the
burden of proof is asymmetric, which is why it ships without the out-of-sample split that (correctly)
killed the lottery / per-driver-DNF / form-slope challengers. Re-open only if cup road practice ever
accrues enough sessions to run the real sweep.

### NEUTRAL-FILL RENORMALISATION -> REJECTED; the dead constant is LOAD-BEARING (2026-07-12)
Trigger: North Wilkesboro. Cup has ZERO races there (only trucks 2023-25 -- Cup runs the non-points
All-Star, never loaded), so trackHistory conf = min(1, nTrackRaces/4) = 0 for the ENTIRE field and 15
pct of the composite becomes a CONSTANT 50. Hypothesis (mine): a constant cannot rank anyone but it
COMPRESSES the composite spread 15 pct, and against a FIXED caution-noise term a narrower spread means
noise dominates more -> the board prices flatter than it should. Proposed fix: when an input has no
coverage, redistribute its weight across the inputs that DO have data instead of filling with 50.
HARNESS: 107 cup races, DEFAULT_WEIGHTS tracks only (Intermediate 65 + Short & Flat 42 -- road courses
EXCLUDED because ROAD_COURSE_WEIGHTS already has trackHistory 0.00, so the effect cannot exist there;
superspeedways excluded, different weight set). Leak-free (history from PRIOR races only by race_date,
age weights 1.3/1.0/.75/.55/.4), reduced model (no practice: corr .35 / startPos .33 / track .15),
MC 2000 sims, noise 16. Train 2022-24 (71) / test 2025-26 (36). Scored on the BETTING MARKETS.
  ARM                          TRAIN win/t3/t5/t10 + favGap        TEST win/t3/t5/t10 + favGap
  A baseline (shrink to 50)    25.84 / 68.6 / 103.5 / 167.0  +12.5   22.71 / 61.3 / 91.8 / 158.8  +2.2
  B renorm trackHistory        26.03 / 69.4 / 105.3 / 171.0  +14.5   22.79 / 61.5 / 92.0 / 159.7  +2.7
  C renorm corr AND track      26.25 / 70.2 / 106.8 / 174.3  +15.2   22.79 / 61.5 / 92.1 / 159.9  +2.9
VERDICT: REJECTED. Renormalisation is WORSE on EVERY market in BOTH splits, and degrades MONOTONICALLY
the more you renormalise. Ship nothing.
MECHANISM (the finding worth keeping): the shrink-to-50 is an accidental REGULARISER. The model is
OVERCONFIDENT at the top (train: favourite predicted 22.4 pct, favourites actually win 9.9 pct). The
neutral fill compresses the spread, which FLATTENS the favourites and pulls that overconfidence back
down. Remove it and favourites sharpen -- favPred climbs 22.4 -> 24.3 -> 25.1 and the gap WIDENS. The
spread compression was diagnosed correctly; the SIGN was backwards. It is not costing calibration, it
is BUYING it. Same lesson as the de-meaned car pools: 'contamination is doing predictive work'.
CONSEQUENCE: North Wilkesboro (and every future debut track) runs on STOCK weights. A flat board at a
track nobody has history at is CORRECT, not a bug. Do not 'fix' it.
NOTE the equipment prior (#118) fixed the SAME neutral-50 fill for corrHistory (car-pooled fill, thin-
driver corr .433 -> .518). It does NOT follow that trackHistory wants the same treatment -- corr's fill
was replaced with REAL INFORMATION (car pools); this test replaced trackHistory's fill with NOTHING
(reweighting). Substituting information helps; deleting shrinkage hurts.

### PRE-RACE STANDARD (no grid loaded) -> LEAVE startPos AT FULL WEIGHT; do NOT use the rain-out toggle (2026-07-12)
Operator question: what should a PRE sim do when qualifying has not run? With no grid, startPos is null
for everyone -> neutral-filled to 50 -> 33 pct of the oval model becomes a constant. Same mechanism as
above but TWICE the size. Options: keep 0.33 (status quo), rain-out toggle (0.12, redistribute 0.21),
or drop startPos entirely. Because the fill is identical for every driver, the RANKING is the same in
all three arms -- only the SPREAD (i.e. the confidence) changes. Pure calibration question.
Same harness/splits as above:
  ARM                       TRAIN win/t3/t5/t10 + favGap        TEST win/t3/t5/t10 + favGap
  A keep startPos 0.33      26.03 / 68.5 / 100.6 / 161.4  +7.3    23.57 / 61.9 / 93.4 / 152.4  -9.0
  B rain-out (0.12)         26.47 / 70.0 / 103.0 / 166.8 +12.3    23.54 / 63.4 / 96.6 / 159.7  -2.3
  C drop startPos           26.80 / 71.3 / 105.1 / 170.9 +14.9    23.65 / 65.0 / 99.4 / 164.8  +1.0
VERDICT: A. Keep startPos at full weight and let it neutral-fill. A wins EVERY placement market in BOTH
splits; win Brier is a dead heat (23.57 vs 23.54). STANDARD: a pre-race sim with no grid needs NO
setting changes -- run it stock.
WHY THE RAIN-OUT TOGGLE IS THE WRONG TOOL (the distinction that matters):
  - NO GRID (pre-quali): startPos is ABSENT -> constant 50 -> cannot mislead the ranking, only
    compresses the spread. That compression is APPROPRIATE: you genuinely know less before qualifying,
    so the board SHOULD be flatter.
  - RAIN-OUT GRID: startPos is PRESENT but is NOISE (draw/metric, not speed) -> it actively CORRUPTS
    the ranking because the model reads a lottery draw as speed. That is what the toggle is for.
  Using the toggle pre-race SHARPENS a board that has LESS information. Exactly backwards.
CAVEAT (live consequence): in the 2025-26 era the pre board runs UNDER-confident on the win market
(favGap -9.0: predicts favourites win 18.8 pct, they actually win 27.8 pct -- note favReal is 7.0 pct in
2022-24, the same parity-era split the lottery test found). Safe direction (you under-bet favourites,
never over-bet them) but two live consequences: (1) you will rarely find value ON favourites pre-race,
their fair line comes out too long and ev goes negative -- expected, not a bug; (2) BE SKEPTICAL OF
LONGSHOT WIN FLAGS ON A PRE BOARD -- a flat board inflates tail probabilities and can manufacture fake
+EV at long prices. Live example, Atlanta post: Josh Berry +7500 and Stenhouse +5500 both flagged to
WIN, finished P25/P23. The MINP tail guard catches the worst of it; pre-race win longshots still
deserve an extra squint.

### RACECRAFT -> 0 ON OVALS, the last survivor (2026-07-12, commit `75602460`)
DEFAULT_WEIGHTS still carried raceCraft 0.02 -- pure inertia. raceCraft is ~97 pct correlated with
driver_rating, sits on the permanent do-not-re-test list, and was already cut to 0 on road (2026-07-07)
and superspeedways (2026-07-09). Now 0 on ovals too. buildSpeedScores divides by wTotal, so the four
survivors renormalise over 0.98 and their RATIOS are UNCHANGED -- this is a ratio-preserving removal,
not a rebalance. shortRunPace / tireFalloff / raceCraft are now 0 in EVERY weight set, so all three
nudge controls were removed from the Sim Center weights panel (they could only mislead the operator).
ACTIVE OVAL WEIGHTS: corrHistory .35 / longRunPace .15 / startPos .33 / trackHistory .15.

### RECENCY WEIGHTING SWEEP -> we are NOT under-weighting recency; MORE recency is WORSE (2026-07-12)
Trigger: North Wilkesboro pre board flagged Josh Berry at +153 pct edge (fair +3900, HR +10000) -- the
SECOND straight longshot WIN flag on him (Atlanta post: +7500, finished P25). Operator: 'he has been
terrible this season'. He is right about the form. What the model actually sees for Berry:
  JOSH BERRY, Short & Flat group (corrHistory pool)
    2023   2 races  avg rating 76.9   age wt 0.55    5 pct of his corr weight
    2024  11 races  avg rating 76.2   age wt 0.75   35 pct
    2025  10 races  avg rating 79.4   age wt 1.00   43 pct
    2026   3 races  avg rating 71.6   age wt 1.30   17 pct
    -> year-weighted corrAvgRating = 76.8
  Full 2026 season (all tracks): 20 races, avg rating 53.4, avg finish 26.9.
DIAGNOSIS (mine, and it was WRONG): age weights are applied PER RACE, not per season, so his collapsed
2026 form carries only 17 pct of his rating while 2024-25 carry 78 pct -- recency 'diluted by sample
count'. Proposed fixes: steepen the age curve, and/or season-normalise (each season contributes its MEAN
so a 3-race season is not swamped by an 11-race one).
SWEEP (same 107-race leak-free harness as the neutral-fill test; corr .35 / startPos .33 / track .15;
MC 2000 x noise 16; train 2022-24 / test 2025-26; scored on the BETTING MARKETS):
  SCHEME                                  TEST win / t3 / t5 / t10
  D flat (no recency at all)              22.62 / 61.0 / 91.2 / 158.4   <- BEST
  A current (1.3/1.0/.75/.55/.4)          22.71 / 61.2 / 91.5 / 158.4
  B steeper (2.0/1.0/.50/.25/.12)         22.83 / 61.6 / 92.0 / 159.0
  C steepest (3.0/1.0/.35/.12/.05)        22.94 / 62.0 / 92.6 / 159.7
  E season-normalised (current age wts)   23.04 / 61.8 / 92.8 / 160.0
  F season-normalised + steeper           23.25 / 62.4 / 93.9 / 161.3   <- WORST
PERFECTLY MONOTONE: the more you weight recency, the worse it predicts, on EVERY market. Season-
normalisation -- the direct fix for the Berry dilution -- is WORSE than the incumbent, and steepening it
on top is the worst arm tested. BOTH hypotheses rejected.
MECHANISM: driver_rating is NOISY per race. Averaging more races cuts variance. Recency weighting
deliberately throws away effective sample size to chase freshness, and driver/team performance does not
shift fast enough for that trade to pay -- the variance cost exceeds the staleness benefit. This is an
INDEPENDENT corroboration of the 2026-07-11 recent-form-slope rejection, from the opposite direction:
form is not the lever, and the corr pool is right to ignore it.
VERDICT: SHIP NOTHING. Flat beats current by 0.4 pct relative -- inside noise, not worth touching a
settled weight. The VALUE is the DIRECTION: do not add recency, do not season-normalise, do not reopen.
DO NOT 'FIX' JOSH BERRY. His 76.8 pooled short-track rating is empirically the BETTER estimator than one
leaning on his 3 bad 2026 short-track races. And he is not a model error: his 2026 SHORT-TRACK form
(71.6, incl. Martinsville rating 93.7 / P10) is genuinely far better than his season-wide 53.4.

### OPERATOR DOCTRINE -- LONGSHOT CONFIRMATION RULE (2026-07-12, user)
'For longshots I need practice confirmation that the speed is actually there from someone like him who
has not had much speed this year.' Correct, and the two tests above explain WHY it is structurally
sound rather than merely cautious. Inventory what a PRE board actually knows about a driver:
  corrHistory  -> a multi-year pooled rating that DELIBERATELY does not chase recent form (validated
                  above: every attempt to weight recency harder made predictions WORSE).
  trackHistory -> neutral for the whole field at a debut track (North Wilkesboro: zero cup races).
  startPos     -> no grid yet. Zero information.
  practice     -> NOT RUN YET. Zero information.
=> A PRE BOARD HAS NO CURRENT-SPEED INFORMATION AT ALL. It is a pooled multi-year prior by construction
(and that is CORRECT for ranking). So a driver whose speed has collapsed is still priced off what he was
two seasons ago, and the model is DEFINITIONALLY BLIND to the disagreement. PRACTICE IS THE ONLY INPUT
IN THE ENTIRE MODEL THAT REFLECTS THIS WEEK'S SPEED.
This stacks with the pre-board calibration finding (same day): the pre board runs UNDER-confident on
favourites (favGap -9), which mathematically pushes probability INTO THE TAIL -- inflating exactly the
longshots that look tempting. Berry has now been flagged as a longshot WIN twice (Atlanta +7500 -> P25;
North Wilkesboro +10000).
RULE: (1) PRE board -> back only real contenders whose edge is structural (North Wilkesboro: Byron
+1600 vs +1438 fair). Do not take a 2-3 pct longshot off a pre board. (2) LONGSHOTS -> wait for
practice, then bet off the POST board. You surrender some CLV; that is the CORRECT trade, because the
pre-board tail probability is not reliable enough to be worth the closing-line value.
Same category as the SS staking doctrine: an operator selection/staking rule, NOT a model change.

### BRISTOL OUT OF SHORT & FLAT -> NO CONTAMINATION; leave it (2026-07-12)
Operator: 'toss Bristol out of this track group, really dont think the correlation is there' (24-30 deg
CONCRETE vs North Wilkesboro's 14 deg worn asphalt -- physically a different animal). NOTE this is a
DIFFERENT question from the 2026-07-08 test, which asked 'does moving Bristol INTO Short & Flat help
BRISTOL races?' (yes, +0.039 Spearman). This asks: does Bristol's presence CONTAMINATE THE OTHER short
tracks -- i.e. is it poisoning the pool North Wilkesboro will draw on? Never tested.
Same 107-race leak-free harness. Three schemes, scored by SUBSET:
  SHORT & FLAT excluding Bristol (n=35)  <- the North Wilkesboro question
    A Bristol IN (current)      win 25.30  t3 65.0  t5 95.4  t10 155.7
    B Bristol isolated          win 25.20  t3 65.0  t5 95.7  t10 156.2
    C Bristol -> Intermediate   win 25.20  t3 65.0  t5 95.7  t10 156.2
  BRISTOL only (n=7)
    A 21.90 / 63.1 / 92.1 / 159.3   B 22.02 / 63.4 / 95.6 / 160.0   C 20.85 / 63.8 / 91.9 / 161.6
  INTERMEDIATE (n=65)
    A 24.78 / 67.0 / 102.5 / 169.5   B same   C 24.74 / 66.9 / 102.1 / 168.9
VERDICT: LEAVE BRISTOL WHERE IT IS. Removing it makes the win market 0.1 BETTER and t5/t10 0.3-0.5
WORSE, with t3 identical -- ~0.3 pct relative, MIXED IN DIRECTION. That is noise, not contamination.
Bristol-only (n=7) is far too thin to read; do not over-interpret its win-Brier flicker.
WHY THE LEVER DOES NOT EXIST (the reusable insight): corrHistory pools DRIVER_RATING, and driver_rating
is overwhelmingly 'WHO IS GOOD'. Good short-track drivers are good at Bristol AND Martinsville AND
Richmond. The track-SPECIFIC component -- the part where banking and surface actually matter -- is small
next to the general-skill component that transfers regardless. So shuffling which tracks are in the pool
barely moves the ratings, because the ratings are mostly measuring the DRIVER, not the TRACK. Physical
dissimilarity between tracks is REAL and still does not matter here. Third independent confirmation of
'every single-track reassignment is noise (+-0.007)' (2026-07-08). The assignment lever stays CLOSED.
North Wilkesboro's board is not limited by group composition -- it is limited by cup never having raced
there.

### PER-DRIVER VARIANCE / "CEILING" (heteroscedastic noise) -> REJECTED (2026-07-14)
The hypothesis Fable parked and never tested. The sim applies ONE noise sigma to the whole field, so a
volatile driver (Mayer type) and a metronome (Keselowski type) get identical spread around their
composite. Give each driver his OWN sigma and, in theory, you fix a two-sided systematic error.

IMPLEMENTATION (leak-free, 107-race harness, train 2022-24 / test 2025-26, NSIM 3000):
  sd_i   = SD of driver_rating across that driver`s PRIOR in-group races (strictly before this race)
  shrink = conf * sd_i + (1-conf) * field_mean_sd,  conf = min(1, n_prior/5)
  noise_i = NOISE * (1 - k + k * (sd_i / mean_sd))     k swept 0 / 0.25 / 0.5 / 0.75 / 1.0
  k=0 reproduces today`s uniform noise exactly. Scored win / t3 / t5 / t10 Brier + favGap.

FALSIFIABLE PREDICTION (stated BEFORE the run): a high-variance driver has a fatter UPPER tail, so he
should WIN more often but finish TOP-10 less often. If the ceiling signal is real, win Brier and t10
Brier improve SIMULTANEOUSLY from opposite causes. If only one moves, it is noise.

RESULT -- THE PREDICTION WAS FALSIFIED. The effect ran BACKWARDS, monotone in train AND test:
  TEST (2025-26), Brier x1000, base NOISE 16, lower is better
  k       win     t3     t5      t10
  0      22.71   61.1   91.7    158.9
  0.5    22.77   60.5   90.4    156.9
  1.0    22.93   60.1   89.6    155.7
  Win gets WORSE as drivers get personal sigmas. The place markets get better. Opposite of the theory.

CONTROL 1 -- UNIFORM NOISE LADDER. The place-market gain is NOT a ceiling signal, it is a dispersion
artefact (Jensen): heterogeneous sigmas raise effective field spread. Simply turning the uniform noise
dial up reproduces the whole gain and BEATS it:
  uniform NOISE 19, k=0      22.69   60.1   89.8   154.1   <- ties/beats k=1 on every market
  k=1 real sigma, NOISE 16    22.93   60.1   89.6   155.7

CONTROL 2 -- PERMUTATION. Same sigma multiset, randomly reassigned to the WRONG drivers (3 seeds).
Permuted is worse than real sigma (t10 160-162 vs 155.7), so driver identity does carry a whisper of
information. But the whisper is worth LESS than one click of the uniform noise dial. Swamped.

CONTROL 3 -- JOINT 2-D GRID (k x NOISE), best-on-TRAIN noise per k, scored on TEST. This is the only
apples-to-apples comparison, because k and NOISE are confounded:
  market   k=0      k=0.5    k=1
  win     22.83    23.03    23.28    <- k hurts, monotone
  t10    149.8    149.1    148.9     <- k gains 0.9 (0.6 pct)
At matched, tuned noise k=1 buys 0.6 pct on top-10 and pays 2.0 pct on win. That is not a signal, it is
a dispersion knob with a bad exchange rate.

VERDICT~ DO NOT SHIP. Keep one sigma for the field. Fable was right to park it. This is the 7th
challenger rejected in the 2026-07-12/14 block (trackHistory renormalization, pre-race rain-out grid,
recency re-weighting, season-normalization, Bristol out of Short & Flat, late-race lottery, per-driver
DNF -- now per-driver variance).

SPIN-OFF LEAD (worth chasing, NOT a result)~ every place market improved MONOTONICALLY as uniform noise
rose, straight through NOISE 24, in BOTH train and test. This harness is feature-poor (no practice, no
equipment prior) so its noise optimum does NOT transfer -- but it hints the live noise may have been
tuned on win/MAE and left the TOP-3/5/10 markets UNDER-DISPERSED, which is precisely where most of the
betting volume sits. Next~ per-market noise sweep on the FULL live model.

### PER-MARKET NOISE SWEEP ON THE LIVE MODEL -> NO CHANGE; live noise 16 is correctly placed (2026-07-14)
Follow-up to the spin-off lead from the per-driver-variance rejection above ("place markets look
UNDER-dispersed; every one improved monotonically as noise rose"). That lead is now DEAD. It was an
artefact. Two things were missing from the reduced harness and both mattered~
  (1) DNF. Live runRaceSim does `dnf = Math.random() < dnfRate` and sorts DNFs to the bottom.
      Cup Medium dnfRate = 0.15 -- a 15 pct per-driver knockout the reduced harness did not have AT ALL.
      That is a large, speed-uncorrelated source of bottom-tail mass. Uniform noise was proxying for it.
  (2) ERA POOLING. Train (2022-24) and test (2025-26) were being read as one regime. They are not.

Re-ran with DNF wired in (mirrors live~ score = comp + gauss*noise, dnf sorted last), dnfRate swept
0 / .05 / .15 / .25, noise 10..36, and the test set SPLIT BY SEASON. Cup, 107 races, NSIM 1500.

HEADLINE~ THE NOISE OPTIMUM DRIFTS DOWNWARD OVER TIME. It is not a constant.
  argmin noise, dnfRate .15 (live)
  market   TRAIN(n71)   2025(n24)   2026(n12)
  win        N32          N19         N13
  t3         N25          N25         N16
  t5         N25          N25         N16
  t10        N25          N32         N19
Tuning noise on TRAIN would have set it at 25-32. The CURRENT season wants 13-19. Train-selected noise
is systematically TOO HIGH, and the older the training data the worse the overshoot.
MECHANISM (hypothesis)~ the composite SHARPENS as history accumulates -- every driver has more prior
in-group races, so the neutral-50 shrink fill (conf = min(1, n/4)) bites less and the speed score
separates more. A sharper composite needs LESS noise. Early seasons are blurry and want more.

CONSEQUENCE FOR THE LIVE SETTING~ Cup Medium noise = 16 sits essentially ON the 2026 optimum for t3 and
t5 (both N16), one notch under t10 (N19), one notch over win (N13). It is well placed. DO NOT RETUNE.
The "place markets are under-dispersed" story was TRAIN leaking its thin-history noise appetite into a
pooled average. On 2026 alone the place markets want 16, which is exactly what we already run.

REAL FINDING THAT SURVIVES -- 2026 favGap is strongly NEGATIVE~
  favGap (+ = model OVERconfident on the favourite), dnfRate .15
  N     TRAIN   2025    2026
  13    13.7    10.5    -14.3
  16     8.6     5.9    -19.8   <- live setting
  19     5.9     2.5    -23.9
  25     2.3    -6.5    -29.7
In 2026 the top-projected driver WINS FAR MORE OFTEN than the sim says he will, and raising noise makes
it worse. Corroborates the independently-logged pre-board finding (favGap -9). Chalk is live in 2026 and
the sim is pushing probability into the tail that does not belong there -- which is precisely WHY
pre-board longshots keep looking tempting and keep losing (Berry, twice). This REINFORCES the existing
operator rule~ do not take a 2-3 pct longshot off a pre board.

CAVEATS~ 2026 is only n=12 races -- the drift is directionally consistent across all four markets and
all four dnfRates, but the 2026 LEVEL is not precise. Harness is DEFAULT oval weights, no practice /
equipment prior, so absolute Brier is not comparable to the live sim. Do NOT port a noise number from
this table. The DIRECTION (optimum falls as history accrues) is the result; the levels are not.

NEXT (unresolved)~ if the noise optimum really is a function of composite sharpness, noise should scale
with mean driver confidence rather than being a fixed preset. Do not build this on n=12. Revisit at
~25 races of 2026.

### DOCTRINE~ EXHIBITION / ALL-STAR RACES ARE EXCLUDED FROM THE MODEL (2026-07-14) -- SHIPPED
Operator~ "Dover was run as an all star race this year with a reduced field size so its data is not
something I want contaminating everything else since its its own animal." Correct, and now enforced in
code rather than by memory.

WHY (same argument that kept the North Wilkesboro All-Star OUT)~
  1. REDUCED FIELD MECHANICALLY INFLATES driver_rating. All-Star fields are ~20 cars vs ~38. The rating
     formula has percentile components (pct_top15_laps and friends) measured AGAINST THE FIELD. In a
     20-car field the "top 15 pct of laps" is a far larger share of the grid, so EVERY driver`s rating
     drifts up. It is not a real speed signal, it is a denominator artefact.
  2. AVAILABILITY BIAS. The entry list is invitational (winners / past champs), so the sample is not a
     random draw from the field we are actually simulating.
  3. UNFALSIFIABLE. Non-points, different format, different tyre/aero packages. There is no clean way to
     validate whether it helped, so it cannot earn its way in.

HOW IT WAS FOUND~ operator said "there`s been 20 Cup races this year"; the harness reported n=12 for
2026. The reconciliation~ 12 ovals + 4 superspeedway + 4 road = 20 POINTS races, +1 extra row = Dover.
The oval harness was correct and complete all along. But the audit turned up two real defects~
  (a) races id 399 (Dover 2026) was tagged correlation_group = Intermediate with 0 loop_data rows.
      Inert TODAY only because nobody has loaded its loop data yet. The moment anyone did, a 20-car
      All-Star field would have poured straight into the LARGEST correlation group we have.
  (b) race_number 11 was used TWICE in 2026 Cup (Texas id 349 AND Dover id 399).

THE TRAP -- READ THIS BEFORE "FIXING" IT~ flagging races.exhibition ALONE DOES NOT PROTECT THE MODEL.
loop_data has NO exhibition column, and BOTH the sim and the LoopData page read loop_data by
track_name + series WITHOUT ever joining races. A races-level flag is invisible to them. The guard must
resolve races.exhibition -> a race_id list and exclude on loop_data.race_id.

SHIPPED~
  SQL (operator ran)~ ALTER TABLE races ADD COLUMN exhibition boolean NOT NULL DEFAULT false;
                      UPDATE races SET exhibition = true, race_number = 0 WHERE id = 399;
                      (race_number 0 is now the convention for non-points; it also clears the R11 dup)
  src/lib/exhibitionGuard.js  NEW. getExhibitionRaceIds() (cached) + excludeExhibition(query, ids).
                              SINGLE SOURCE OF TRUTH. Do not duplicate this logic.
  SimulationCenter.js  guard applied to ALL FOUR contamination paths~ corrHistory pool, trackHistory
                       pool, the caution-preset average, and the race-length/DNF estimate.
  LoopData.js          guard applied to the track table, the correlation-group averages, and the
                       driver-compare histories.

NET EFFECT~ exhibition races can still be LOADED and VIEWED, but can never feed the model or the
aggregate averages. Adding a future All-Star is now a one-row UPDATE, not a code change.

STANDING RULE~ any non-points / reduced-field / invitational event gets exhibition = true AT LOAD TIME.
This includes the Clash, the All-Star Race, and any future exhibition. Do NOT load the North Wilkesboro
Cup All-Star as if it were a points race.

### DNF RATE~ MEASURE IT, DO NOT BUCKET IT -- SHIPPED, BRIER-NEUTRAL (2026-07-14)
NOT a model improvement. Shipped on measurement + operator-error grounds. Do NOT count it as a win.

ORIGIN~ chasing the "sim under-rates its own favourite" lead. That lead LARGELY DIED (see below), but
the hunt turned up a real defect in how dnfRate is chosen.

FIRST~ THE FAVOURITE LEAD IS MOSTLY NOISE. Own the correction~
  era          n    pWin(model)  actualWin   favGap    pTop4(model)  actualTop4  worstFinish
  TRAIN 22-24  71   21.0         9.9         +11.2     53.8          38.0        P36
  2025         24   26.8         20.8         +6.0     62.7          45.8        P35
  2026         12   30.5         41.7        -11.2     65.4         100.0        P4
The 2026 favGap of -11.2 is z = 0.84. NOISE. Over the well-sampled 95 races the model is OVER-confident
on its favourite, not under. 2026 flips the sign on 12 races and means nothing on its own.
Model-free check~ the sport did NOT get chalkier. Winner`s median prior-form rank~ 2022 9, 2023 6,
2024 8, 2025 7, 2026 8. Winner in prior-form top-5~ 2026 = 35 pct, LOWER than 2023 (46) and 2025 (44).
What actually changed is win CONCENTRATION (HHI .145 vs .090-.122 sample-controlled) -- one driver
(Hamlin) took 5 of 20. That is a Hamlin season, NOT a regime change. Do not tune to it.
The only stat with teeth was the favourite`s FLOOR~ top-4 in all 12 (z = 2.52, P = 0.006) -- and even
that is post-hoc, and its sign contradicts train/2025. Treated as a hint, not a finding.

THE HINT PAID OFF ANYWAY -- ACTUAL DNF RATES (loop_data 2022-26, exhibition excluded,
DNF = completed < 90 pct of winner`s laps)~
  series x group            n      rate    22-24   25-26
  cup Short & Flat        1540    8.1     7.2     9.9
  cup Road Course         1022    8.5     9.1     7.4
  cup Intermediate        2405   12.7    12.8    12.5
  cup Superspeedway       1083   18.4    17.8    19.4
  oreilly Intermediate    1784   10.8    11.0    10.6
  oreilly Short & Flat     986   13.4    15.6    10.3
  oreilly Road Course      945   15.9    16.0    15.7
  oreilly Superspeedway    797   22.0    21.8    22.1
  trucks Short & Flat      915   13.3    10.5    19.8   (era-unstable)
  trucks Intermediate     1205   14.0    13.1    15.0
  trucks Road Course       425   17.6    17.9    17.5
  trucks Superspeedway     390   18.7    21.1    15.8   (era-unstable)
A 2.3x spread. Cup cells are stable across eras.

REJECTED SUB-HYPOTHESIS~ "elite drivers DNF less, so the flat rate buries the favourite`s floor."
FALSE as stated. Within track groups the tier gradient is weak and REVERSES~
  group           elite(1-3)  strong  mid    back   tail(26+)
  Intermediate      11.1       13.0   11.3   11.6   13.6    <- flat, no elite edge
  Superspeedway     19.2       16.9   17.0   16.5   18.9    <- elite DNF the MOST (they run in the pack)
  Short & Flat       4.1        5.9    4.5    7.8   11.6    <- real gradient only here
  Road Course        6.2        4.4    6.3   10.4    7.4
This is WHY Fable`s per-driver DNF test failed~ the effect is TRACK-TYPE CONDITIONAL and cancels in
the pool. Do not retry per-driver DNF as a global term.

THE REAL DEFECT~ the sim ALREADY measured the per-track DNF rate -- then THREW THE PRECISION AWAY by
bucketing it into Low(.05) / Medium(.15) / High(.25)~
    __di = avg < 0.10 ? 0 : avg < 0.20 ? 1 : 2
Rounding error up to +/-5 pts~ cup Superspeedway measures 18.4 and was rounded DOWN to 15. Cup Short &
Flat measures 8.1 and was rounded DOWN to 5. And when a track had NO history the code fell through to a
hard-coded Medium (0.15) -- which is exactly the NORTH WILKESBORO case, where Cup has ZERO races. The
sim was about to run NW at 15 pct attrition against a true short-track rate of 8.1 pct. ~2x too high,
burying every contender`s floor.

BACKTEST (107 Cup ovals, train 22-24 / test 25-26, NOISE RE-TUNED PER MODE -- the fair comparison,
because dnf and noise are dispersion SUBSTITUTES and freezing noise rigs the test)~
  market   flat15(old)   group-empirical   group+tier
  win      23.01         23.01             23.00
  t3       60.1          60.0              60.0
  t5       89.0          88.9              88.9
  t10     148.6         148.4             148.5
DEAD NEUTRAL. Brier CANNOT distinguish these. The DNF rate was only ever acting as a noise substitute.
Favourite`s top-5 calibration (which Brier barely sees)~ flat15 predicts 69.3 vs 72.2 actual (-2.9);
group-empirical 71.8 vs 72.2 (-0.4). Directionally right, but n=36 and SE ~7.5 pts -- NOT significant,
and NOT the justification.

SHIPPED ANYWAY, and here is the honest reason~ dnfRate is a parameter we can MEASURE (6k+ driver-races
per series) rather than guess. Using the measured value is free (Brier-neutral, proven above), removes
a rounding artefact, and removes a real live error (North Wilkesboro). That is not overfitting; there
is nothing to overfit to.

CODE~ SimulationCenter.js
  DNF_BY_GROUP + DNF_SERIES_MEAN + resolveDnfRate(series, group, trackAvg, nTrackRaces)
  dnfRate is now CONTINUOUS~ trackAvg shrunk toward the group rate by conf = min(1, nTrackRaces/8),
  clamped to [0.03, 0.30]. Low/Medium/High remain as MANUAL OVERRIDES only. UI shows the resolved
  rate to 1dp and states its provenance ("measured from N prior races" vs "no track history -> group").
  Resolved values~ NW cup 8.1 pct (was 15.0). Talladega cup ~19.0 (was 15.0). Bristol cup ~7.0 (was 5.0).

### !! CORRECTION !! THE "SHRINK-TO-50 IS A LOAD-BEARING REGULARIZER" CLAIM IS FALSE (2026-07-14)
RETRACTS the trackHistory zero-coverage renormalization entry from earlier the same day. That entry
concluded renormalization was "worse on every market, monotone" and that the neutral-50 fill is an
"accidental regularizer that flattens favourite overconfidence". BOTH CONCLUSIONS ARE WRONG.
They were an artefact of a CONFOUNDED TEST.

THE CONFOUND (discovered while testing DNF, same day)~ NOISE AND ANY DISPERSION CHANGE ARE SUBSTITUTES,
AND BRIER CANNOT TELL THEM APART. Renormalizing WIDENS the composite spread (the neutral-50 fill pulls
low-coverage drivers toward the middle; dropping the weight does not). Scored at FIXED noise, that extra
spread reads as damage. It is not damage -- it is a dispersion change that the noise term should absorb.
ANY test that alters spread while holding noise constant is RIGGED. The original test did exactly that.

RE-AUDIT, noise RE-TUNED per mode (best N on TRAIN, scored on TEST 2025-26), DNF = group empirical~
  trackHistory (weight 0.15)
  market   fill50(current)  renorm0   renormFull        [train 22-24]
  win       23.15           23.17     23.16
  t3        60.0            60.3      60.3
  t5        88.9            89.3      89.3
  t10      148.6           148.5     148.6
  ... and with the 2022 BURN-IN YEAR DROPPED (train 23-24), identical~ 23.15 / 23.17 / 23.16.

  corrHistory (weight 0.35 -- the big one, also flagged load-bearing)
  market   fill50          renorm0   renormFull
  win       23.14           23.14     23.14
  t3        60.2            60.2      60.2
  t5        89.6            89.6      89.6
  t10      149.6           149.6     149.5

VERDICT~ DEAD NEUTRAL, both terms. The neutral-50 fill is NOT doing secret work. It is simply ONE OF
SEVERAL EQUIVALENT ways to handle missing coverage. KEEP IT -- but keep it because it is SIMPLE, not
because it is load-bearing. Anyone who believes the regularizer story will preserve neutral-fill in
places where it is actively wrong. That is the damage this correction prevents.

WHY corrHistory was always going to be inert~ coverage is 87.9 pct FULL, only 3.5 pct zero. The fill
branch almost never fires. (trackHistory is the sparse one~ 25.5 pct zero, 49.4 pct thin.)

### THE 2022 BURN-IN ARTEFACT -- READ BEFORE TRUSTING ANY TRAIN-SELECTED PARAMETER (2026-07-14)
trackHistory ZERO-COVERAGE RATE BY YEAR, in the harness~
  2022  75.7 pct   <-- the DATABASE STARTS in 2022, so 3/4 of drivers have NO prior track history
  2023  10.0 pct
  2024  18.8 pct
  2025   6.1 pct
  2026  14.0 pct
2022 IS A BURN-IN YEAR. Its composite is mostly NEUTRAL FILL -- a state the live model NEVER sees.
TRAIN = 2022-24 is therefore contaminated by a degenerate year, and a degenerate composite CRAVES NOISE.
This is very likely the true cause of the "noise optimum drifts downward over time" finding logged
earlier today (train wants N25-32, 2026 wants N13-19). I attributed it to "the composite sharpens as
history accrues". The honest version is narrower~ the composite is GARBAGE IN 2022 BECAUSE THE DB HAD
NO HISTORY YET, and that is a data-warmup artefact, not a property of the sport.
CONSEQUENCE~ do NOT select noise (or any dispersion parameter) on a train set that includes 2022.
It will always overshoot. Prefer train = 2023-24.
STILL UNRESOLVED~ whether any real drift remains after dropping 2022. Do not claim one until tested.

### SUPERSPEEDWAY HARNESS -- FIRST EVER. THE SS MODEL BARELY BEATS GUESSING. (2026-07-14)
Every backtest before this one was OVALS ONLY (Intermediate + Short & Flat). Superspeedway and Road
Course had NEVER been in a harness. Built the SS one~ Cup, Daytona/Talladega/Atlanta, 2022 burn-in
dropped, train 2023-24 (n=12) / test 2025-26 (n=10). Live SS weights (corr .55 / trackHistory .30 /
startPos .15). SMALL SAMPLE -- read every number below with that in mind.

1) FABLE`S SS NOISE MULTIPLIER (cup x3.0) IS VALIDATED. Independently confirmed, no change.
   noise   TEST win/t3/t5/t10            favGap
   16      26.01  82.2  128.4  215.6      32.0    <- x1, no multiplier
   40      24.00  70.3  109.5  185.3      12.5
   48      23.98  69.6  108.3  183.3      10.4    <- LIVE (x3 x Medium). ON the optimum.
   60      24.03  69.1  107.5  181.9       8.3
   75      24.10  69.0  107.3  181.5       6.9    <- LIVE (x3 x High)
   Train and test both bottom out at 40-48. Good call. LEAVE IT ALONE.

2) !!! THE HEADLINE !!! AT NOISE 48 THE SS MODEL IS BARELY BETTER THAN A UNIFORM GUESS.
                          win     t3     t5      t10
   UNIFORM (no model)     24.63   70.1   110.4   188.8
   SS model @ noise 48    23.98   69.6   108.3   183.3
   improvement             0.65    0.5     2.1     5.5
                          (2.6%)  (0.7%)  (1.9%)  (2.9%)
   That is the WHOLE edge at superspeedways~ ~2-3 pct over literally assigning every car 1/n.
   And note the circularity~ the x3 multiplier is "correct" PRECISELY BECAUSE pack racing is near-random.
   Tuning noise correctly at SS means tuning the model into near-irrelevance. Both things are true.

   OPERATOR DOCTRINE (this is the actionable part)~ A MODEL "EDGE" AT A SUPERSPEEDWAY IS MOSTLY NOISE.
   Do not size up on model edge (ev/medge) at Daytona/Talladega/Atlanta -- there is almost no signal
   behind it. This CORROBORATES and STRENGTHENS the existing SS staking doctrine.
   IMPORTANT DISTINCTION~ this kills MODEL alpha at SS, NOT line-shop alpha. mev (soft-book detection)
   is a property of the BOOKS, not the model, and is unaffected. Erik-Jones-type outlier-line plays
   remain valid. What is dead is trusting the sim to tell you WHO is live at a pack track.

3) THE SS DNF REVERSAL -> REJECTED (9th rejection). Elite drivers really do DNF MORE at SS (19.2 pct vs
   16.5 pct for back-markers -- they run up front in the pack, where the Big One collects them). The
   effect is REAL in the data and USELESS in the model~
   mode      TEST win/t3/t5/t10          favGap   favT5 pred/act
   flat15    23.98  69.6  108.3  183.3    10.4    34.9/20.0
   emp184    23.96  69.6  108.2  183.0    10.3    34.5/20.0
   tierSS    23.95  69.5  108.0  182.8    10.2    34.1/20.0   <- the measured reversal
   placebo   23.97  69.7  108.3  183.2    10.4    35.0/20.0   <- SAME numbers, SCRAMBLED order
   PLACEBO CONTROL~ the real reversal and a deliberately wrong-ordered version perform IDENTICALLY.
   At a +/-48 shock, a 2.7-point DNF spread is invisible. Do not retry this.

4) SS FAVOURITE~ flagged, NOT actionable. Model says the favourite wins 10.3 pct; he won 0 of 10.
   Model says top-5 34.6 pct; he did it 2 of 10. favGap z = -1.07 -- n=10 has NO POWER. Directionally
   the model over-rates SS chalk (opposite of the oval picture), but this CANNOT be acted on. Revisit
   at ~30 SS races. DO NOT tune to it.

STILL UNTESTED~ ROAD COURSE has never been in a harness either. Same gap.

### ROAD COURSE HARNESS -- FIRST EVER. ROAD IS WHERE THE MODEL IS STRONGEST. (2026-07-14)
Cup road, 2022 burn-in dropped, train 2023-24 (n=11) / test 2025-26 (n=10). SMALL SAMPLE.

!!! HARNESS LIMITATION, STATE IT EVERY TIME~ PRACTICE PACE IS NOT IN ANY HARNESS. !!!
practice_sessions distinct tracks by year~ cup 2022~0, 2023~0, 2024~10, 2025~14, 2026~17.
PRACTICE DATA DOES NOT EXIST BEFORE 2024. It CANNOT go in a train=2023-24 harness. Of 27 cup road
races, only 4 have practice pace (all 2026). So every harness today is corr + startPos + trackHistory,
NOT the live model (which carries practice at 0.15 ovals / 0.25 road).
NOTE ON THE NAME~ the weight key is still `longRunPace` but it is fed by practice_sessions.overall_avg
-- i.e. PRACTICE PACE across all laps. The key name is a STALE MISNOMER. (srpTime = late_run_avg is
still wired but its weight is 0.00 everywhere -- dead code.)
MITIGATION~ the live model fills a missing practice value with neutral-50 and KEEPS the weight; the
harness DROPS the weight and renormalises. The renormalisation re-audit (logged above) proves those two
are DISPERSION-EQUIVALENT once noise is re-tuned. So the harness is a fair proxy for pre-2024 races.
For 2025-26 test races that DO have practice, it is NOT the live model. Treat test numbers accordingly.

1) THE CAUTION-PRESET AUTO-LOGIC IS EXCELLENT. Independently verified, all four groups~
   group           avgCautions  preset -> live noise      harness optimum
   Road Course        4.8       Low    -> 10              10       EXACT
   Superspeedway      7.1       Medium -> 16 x3.0 = 48    40-48    EXACT
   Intermediate       8.4       Medium -> 16              16       matches
   Short & Flat       6.9       Medium -> 16              16       matches
   Every group lands on its measured optimum. NO CHANGES. Do not touch the caution presets.

2) ROAD IS THE MODEL`S STRONGEST GROUP BY A MILE. Test set, noise 10 (live)~
                        win     t3     t5      t10
   UNIFORM (no model)   25.85   73.3   115.1   194.9
   road model @ N10     12.80   50.8    83.6   154.2
   improvement          50.5%   30.7%   27.4%   20.9%
   Compare SUPERSPEEDWAY, same measurement~ 2.6% / 0.7% / 1.9% / 2.9%.

   >>> STAKING HIERARCHY (the actionable output of both harnesses) <<<
   ROAD COURSE      model edge is HUGE      -- trust the sim, size up
   INTERMEDIATE     model edge is REAL      -- normal sizing
   SHORT & FLAT     model edge is REAL      -- normal sizing
   SUPERSPEEDWAY    model edge is ~NOTHING  -- do not size on model edge; line-shop (mev) only

3) TRAIN AND TEST WANT OPPOSITE NOISE AT ROAD -- AND THE CAUSE HAS A NAME~ SHANE VAN GISBERGEN.
   noise   TRAIN win   TEST win
   10      30.98       12.80    <- test LOVES low noise
   25      25.56       17.35
   40      25.00       20.84    <- train LOVES high noise
   Perfect inversion. The model picks SVG as favourite in 8 of the 10 test road races and he WON 6
   (Mexico, Chicago, Sonoma, Watkins Glen, Charlotte Roval 2025; Watkins Glen 2026). Train (2023-24)
   had no dominant road ace -- Reddick was favourite and converted once -- so a blurry field wanted
   noise. TRAIN-SELECTING ROAD NOISE ON 2023-24 WOULD PICK 40 AND COST 8 BRIER POINTS ON TEST.
   The live setting (Low/10, from 4.8 avg cautions) is right for the RIGHT REASON~ road courses
   genuinely have few cautions and low pack randomness. It is not luck that it matches.
   CAUTION~ the test-set brilliance is ONE DRIVER. If SVG regresses or leaves, road win Brier will
   deteriorate sharply. Do not read 12.80 as a durable property of the model.

4) startPos AT ROAD~ model-free Pearson r(start, finish) = 0.448 on 794 obs 2023-26. The live comment
   cites r=0.416 -- CONFIRMED, and it has if anything strengthened. The startPos weight sweep was
   UNINFORMATIVE because train-selection picks N40 for every weight (see 3). Cannot resolve the road
   startPos weight until there is a train set that is not SVG-inverted. LEAVE AT 0.15.

STILL UNTESTED~ practice pace, in any harness, at any track type. Blocked on data (starts 2024).
Earliest a practice-inclusive harness is possible~ train 2024-25 / test 2026. Thin but doable.

### PRACTICE PACE IS REAL. AND A METHODOLOGY WARNING THAT ALMOST COST US. (2026-07-14)
First ever validation of the practice input. Cup ovals, 47 races with practice coverage >=20 drivers
(2024~15, 2025~20, 2026~12). practice = practice_sessions.overall_avg, LATEST session per driver,
lower lap time = better. Missing -> neutral 50 (matches live).

1) PRACTICE PACE CARRIES GENUINE INDEPENDENT SIGNAL. KEEP THE 0.15 WEIGHT.
   Multiple regression, finish ~ f(all four inputs ranked within race), n = 1497 driver-races~
     input             coef     SE      t       verdict
     PRACTICE pace    0.1099  0.0271   4.06    SIGNIFICANT
     corr history     0.2658  0.0482   5.51    SIGNIFICANT
     start position   0.1951  0.0277   7.04    SIGNIFICANT
     track history    0.0474  0.0478   0.99    not significant
   partial r (practice | corr, start, track) = 0.104. It SURVIVES controlling for everything else.
   MISATTRIBUTION CORRECTED (see below)~ I originally wrote that this "contradicts the older practice
   edge is only 0.0003 note". IT DOES NOT. The 0.0003 figure is NOT a practice-edge measurement at all.
   It is the SLEEPER RESIDUAL partial correlation from #114. Different quantity entirely. See the
   correction entry at the end of this log.
   Weight sweep (noise re-tuned, train 2024-25 / test 2026, n=12 test -- underpowered)~ raising the
   weight to 0.30 or 0.50 is CLEARLY WORSE on every market. 0.15 is right. DO NOT RAISE IT.
   Standalone predictive power (rank vs finish, 47 races)~ practice r=0.278, corr r=0.473,
   startPos r=0.425, trackHistory r=0.405. Practice is the WEAKEST input -- but not a useless one.

2) !!! METHODOLOGY WARNING -- I ALMOST KILLED trackHistory ON A COLLINEARITY ARTEFACT !!!
   The regression above says trackHistory is NOT significant (t=0.99; and t=1.68 on 2025-26 alone,
   t=1.82 on Intermediate). That looks like a 0.15 weight doing nothing. IT IS NOT.
   BACKTEST, noise re-tuned, train 2023-24 / test 2025-26, 107 oval races~
     wTrack   TEST win    t3      t5      t10
     0.000    23.07       60.7    89.3    152.7   <- trackHistory OFF
     0.075    22.96       60.4    89.0    151.3
     0.150    22.89       60.2    88.7    150.3   <- LIVE
     0.220    22.88       60.1    88.9    149.4
   Dropping it is WORSE on EVERY market, MONOTONICALLY. It is earning its keep. KEEP 0.15.

   WHY THE REGRESSION LIED~ corrHistory and trackHistory are THE SAME QUANTITY (driver_rating history)
   sliced two ways -- one pooled by correlation group, one by exact track. They are heavily COLLINEAR.
   Under collinearity OLS splits the credit between them and INFLATES BOTH STANDARD ERRORS, which
   crushes the t-stat. NON-SIGNIFICANCE UNDER COLLINEARITY DOES NOT MEAN THE VARIABLE IS USELESS FOR
   PREDICTION. It only means the credit cannot be cleanly ATTRIBUTED. The Monte Carlo does not care
   about attribution -- it cares about the RANKING, and both terms together rank better than either.

   >>> STANDING RULE~ NEVER drop a sim input on the strength of a regression t-stat. The inputs are
   >>> collinear by construction. ALWAYS confirm in the harness with noise re-tuned. This is now the
   >>> SECOND methodology trap found today (the first~ noise absorbs any dispersion change). <<<

STILL UNTESTED~ practice pace in O`Reilly / Trucks (coverage is 1 and 3 tracks respectively -- not
enough). Practice at road courses (4 races, all 2026). Both blocked on data.

### PRACTICE EDGE -- THE PRECISE NUMBER (amends the entry above, same day 2026-07-14)
The entry above led with the regression t-stat (4.06) and OVERCLAIMED. Operator asked the right
question~ "what IS the practice edge if not 0.0003?" Here is the actual measured edge.

PAIRED per-race Brier, practice ON (0.153) vs OFF (0.00), ALL 47 practice races, noise fixed at live 16.
POSITIVE = practice HELPS. Brier x1000.
  market   mean gain   SE      t       95% CI            verdict
  win      -0.213     0.250   -0.85   [-0.70, 0.28]     NO EFFECT (slightly negative)
  t3       +0.598     0.538    1.11   [-0.46, 1.65]     no effect detected
  t5       +0.630     0.875    0.72   [-1.08, 2.35]     no effect detected
  t10      +2.937     1.013    2.90   [ 0.95, 4.92]     HELPS  (~1.8 pct of a ~160 baseline)

ON WIN, PRACTICE DOES NOTHING~ -0.21 +/- 0.25, indistinguishable from zero, if anything negative.
(I originally tied this to the "0.0003" note. That was a MISATTRIBUTION -- see the correction at the
end of this log. 0.0003 is the SLEEPER RESIDUAL from #114, not a practice-edge number.)

THE RECONCILIATION (both things are true)~
  - The regression signal IS real~ practice survives controlling for corr + startPos + trackHistory
    (t=4.06, partial r=0.104, n=1497).
  - But it converts ALMOST ENTIRELY INTO PLACE-MARKET ACCURACY, not win-market accuracy.
  - Physically obvious in hindsight~ practice pace tells you WHO HAS A GOOD CAR (who avoids a bad day).
    It does NOT tell you who WINS. Winning needs the tail; a good car only moves the body.

OPERATOR RULE~ PRACTICE MATTERS FOR TOP-10 (and marginally t3/t5). IT DOES NOT MATTER FOR WIN.
If you are pricing a win bet, practice pace should not change your mind. If you are pricing a top-10,
it should. KEEP the 0.15 weight either way~ it costs nothing on win and pays ~1.8 pct on t10.
DO NOT RAISE IT -- 0.30 and 0.50 are clearly worse on every market.

### CLV TOOL EXISTS AND IS NOT BEING USED (2026-07-14)
clv_log + the GradeCenter CLV tool were shipped 2026-07-09. Current contents~
  16 rows TOTAL, all from ONE race (oreilly R21). mean CLV +0.24, SE 0.22, t=1.11.
  positive CLV on 3 of 16 bets (19 pct).
n=16 from a single race tells us NOTHING yet. But CLV is the ONLY instrument that measures the REAL
model (equipment prior, crossover borrows, practice, the actual weights) rather than the stripped-down
backtest harness. Every harness number in this log is a PROXY. CLV is not.
ACTION~ run the CLV tool EVERY race week. It is already built. It just needs feeding.

### PRACTICE DOMINANCE vs THE WIN MARKET -- UNRESOLVED, AND THE BLOCKER IS DATA (2026-07-14)
Operator~ "I have spotted winners myself simply observing how good a car is in practice."
That is a real hypothesis and it is NOT refuted by the earlier finding. Here is where it actually stands.

THE DISTINCTION THAT MATTERS~ RANK vs MARGIN. My earlier test ranked drivers by practice pace within
the race. RANK THROWS AWAY MARGIN. P1-by-0.004s and P1-by-three-tenths get the identical input. The
operator`s eye is reading DOMINANCE, not rank -- and dominance is exactly the kind of thing that shows
up in WIN and not in TOP-10, because winning needs the TAIL and a dominant car IS the tail.

LOGISTIC MODELS, run SEPARATELY (rank and margin are collinear -- NEVER put both in one model; I did
that first and margin came out with the WRONG SIGN, a pure collinearity artefact. Same trap as
trackHistory. Twice in one day.) n=1366 driver-races, controls~ corr rank + start rank.
  WIN  (40 events)
    practice RANK        z = -1.43   not sig     logL -141.1
    MARGIN, avg pace     z =  0.80   not sig     logL -141.8
    MARGIN, BEST LAP     z =  1.52   not sig     logL -140.9   <- BEST FIT, CORRECT SIGN
  TOP-5  (197 events)~ RANK z=-3.59 SIG (best fit). MARGIN pace z=2.54.
  TOP-10 (392 events)~ RANK z=-3.95 SIG (best fit). MARGIN pace z=3.30.

READ THIS CAREFULLY~ for the PLACE markets, RANK is the right representation and the sim already uses
it. For WIN, BEST-LAP DOMINANCE leads (right sign, best fit) but does NOT reach significance on 40 win
events. THAT IS NOT EVIDENCE AGAINST THE HYPOTHESIS. It is NO POWER. Different thing entirely.
Note it is BEST-LAP margin, not avg-pace margin -- closer to what an eye reads~ "that car has speed
nobody else has".

POWER CALCULATION -- HOW MUCH DATA DO WE NEED?
  z scales with sqrt(n). To take z=1.52 to z=2.6 needs (2.6/1.52)^2 = 2.93x the races.
  47 x 2.93 = ~138 Cup oval races with practice.
  Currently~ 47 with, 60 MISSING (2022~23, 2023~23, 2024~10, 2025~4). Backfilling all 60 -> 107 races,
  which projects to z ~ 2.29. CLOSE, PROBABLY STILL SHORT on its own.
  => BACKFILL THE 60 CUP OVAL RACES, *AND* LOAD O`REILLY + TRUCKS PRACTICE (currently 1 and 3 tracks).
     The extra series add win events and let us test whether the effect is series-specific.
  THEN re-run~ WIN ~ best_lap MARGIN + corr + startPos.

REJECTED ALONG THE WAY (10th rejection)~ PRACTICE NORMALIZATION.
normalizeArr is MIN-MAX, anchored on the single slowest car. Lap times are the most outlier-prone input
we have (a broken practice run is SECONDS off, not tenths). Measured contamination~
  mean scale eaten by the gap from P90 to the SLOWEST car~  32.7 pct
  mean scale separating the FASTEST car from the MEDIAN~    39.6 pct
  worst~ Indianapolis 2025 -- competitive field spans 0.77s, scale spans 4.4s, slowest car alone eats
         83 pct of the 0-100 range. The real order is crushed into 17 pct of the scale.
THE CONTAMINATION IS REAL. IT IS ALSO IMMATERIAL. Harness (noise re-tuned, train 24-25 / test 26)~
  minmax(LIVE) 21.82 / z-score 21.79 / winsorize p5-p95 22.07 / rank 21.85  (win Brier)
All within noise on every market. At a 15 pct weight, compressing the practice scale is just a slightly
smaller effective weight, and the weight curve is FLAT there. No change. Do not retry.

STATUS~ the operator`s observation is the most promising UNTESTED idea we have. It is blocked purely on
sample size, and the fix is a DATA LOAD, not a model change.

### CORRECTION~ WHAT "0.0003" ACTUALLY IS (2026-07-14)
I misattributed this number TWICE today and then built a "retraction" on top of the misattribution.
Correcting the record because Fable reads this log.

0.0003 IS NOT A PRACTICE-EDGE MEASUREMENT.
It is the SLEEPER RESIDUAL partial correlation from #114 (PRACTICE-EDGE AT SCALE, closed 2026-07-09)~
  partial corr( sleeper edge , model residual ), both sides residualised on corr/start/practice = -0.0003
MEANING~ the sleeper effect has NO RESIDUAL ALPHA. Not "practice is worthless".

THE SLEEPER EFFECT ITSELF IS REAL AND WAS NEVER IN DOUBT. Re-confirmed today on the current data~
  SLEEPERS (started outside top-10, practiced top-5)  n=117  P22.3 -> P16.4   GAINED +5.9
  everyone else                                       n=1259 P18.3 -> P18.9   GAINED -0.6
  (#114 measured +5.1 vs -0.5 on its sample. Consistent.)
CASE~ Ross Chastain, Charlotte 2025 (Coca-Cola 600). Practice P1 by 0.177s -- biggest margin in the
field. Started P40 (LAST). WON. Gained 39 places. He IS the sleeper term, textbook.

WHY THERE IS STILL NOTHING TO SHIP~ practice pace and startPos are BOTH already model inputs, so
"fast in practice + deep on the grid" ALREADY projects forward in the composite. The model prices the
sleeper. The -0.0003 residual says there is nothing LEFT OVER to harvest. #114 was closed correctly.

MY ERROR, FOR THE RECORD~ I first measured sleepers by ABSOLUTE FINISH (avg P18.3) and concluded the
effect ran BACKWARDS. That was the wrong measurement -- cars starting deeper finish deeper, trivially.
The correct measurement is POSITIONS GAINED. Operator caught it. ALWAYS measure sleeper effects as
gain-vs-grid, never as absolute finish.

THE PRACTICE FINDING FROM TODAY STANDS ON ITS OWN MEASUREMENT (it never depended on the 0.0003 note)~
  practice pace~ NOTHING on win (-0.21 +/- 0.25). +2.9 Brier on top-10 (t=2.90). Keep 0.15, do not raise.
### LONG-RUN COLUMN BACKFILL -> DEAD; sustained-pace win test stays BLOCKED (2026-07-15, operator call)
CLOSES the 2026-07-14 open thread "backfill the long-run columns (late_run_avg, long_run) INSIDE
existing races, worth more than adding races." Operator confirms the nulls are STRUCTURAL, not
upload-vintage: a driver with no 10+ lap stint has no long run to measure, and the underlying laps are
NOT recoverable. Coverage tops out roughly where it sits (~42 pct late_run_avg). With about half the
field on neutral-fill, the sustained-pace WIN test cannot be powered. Do NOT re-raise the backfill.

TWO CAVEATS that must ride along with any future test of late_run_avg / long_run:
1. INFORMATIVE MISSINGNESS (operator insight, 2026-07-15): a driver who LIKES his car stays out on a
   sustained run; a driver fighting the car pits repeatedly for adjustments. Long runs are therefore
   SELF-SELECTED by happy cars -- the populated rows are a biased sample, and neutral-filling the
   no-long-run drivers at 50 is GENEROUS to exactly the cars whose teams pulled in because they were
   bad. Any measured late_run_avg effect is entangled with this selection. Do not test it naively.
2. Run length AS a signal is already dead: laps-run / longest-stint die once pace is controlled
   (2026-07-14 rejected list). The car-happiness is already inside the pace number.

NET: the win-market gap stands (practice converts to PLACE accuracy only; nothing on win) with no
currently viable practice-side test on existing data. The still-live path is PRACTICE DOMINANCE
(best-lap margin), which needs the ~60-race 2024 cup oval practice backfill of NEW races -- a
different, unaffected workstream.


### MANUFACTURER / GROUP MARKETS -> INFORMATIONAL ONLY; model-edge badges removed (2026-07-15, SHIPPED)
Trigger: Top Chevrolet board flagged Cody Ware +145 pct (model 0.5 vs HR +50000), Stenhouse +124, Ty
Dillon +109, Custer +104 -- while the actual contenders ran negative (Larson model 24 vs ~34 devigged
market). Operator: "I think we are way off here."
DIAGNOSIS -- three stacked problems, only the first cosmetic:
1. TAIL ARITHMETIC (the Reaume case in an unguarded market). The 2026-07-09 MINP tail guard covers
   win/t3/t5/t10 ONLY. Group markets had NO probability floor, so a 0.3pp sub-resolution disagreement
   (Ware) rendered as +145 pct. Note the board's own medge column already said no-bet (-0.03) -- the
   badge and the staking column contradicted each other.
2. STRUCTURAL AMPLIFICATION. Group markets RENORMALIZE the documented pre-board favourite softness
   (favGap -9) into the tail: a modest win-market miss on Larson becomes ~10pp inside a 17-car
   Chevy-only subset, and every leaked point inflates the mid tier (Bowman +73 / McDowell +93 were
   partly Larson-leak, not information about Bowman). A MINP floor CANNOT fix this -- the mid-tier
   badges survive any sane floor. This market type is the worst possible surface for the model's one
   known calibration weakness.
3. NEVER VALIDATED + HUGE VIG. The value engine's record (Chicagoland 11/11, +88 pct ROI) was earned
   on win/place contender flags. Group markets have ZERO graded history -- GradeCenter has no gmv path
   at all (verified: zero refs) -- and DK's overround on this market summed to ~128 pct.
DECISION (operator): INFORMATIONAL treatment, deliberately stronger than a floor.
SHIPPED:
  SimResults.js (commit 201d31d0): GmTable drops the Edge and medge columns entirely; keeps
    Model / Fair / DK / FD / HR / Best / mev; rows now sorted by MODEL PROB desc (was ev desc, which
    put the scrub tier on top). Display-time, so ALREADY-PUBLISHED boards clean themselves on deploy.
  SimulationCenter.js (commit a7d4d5fc): __groupMarketValue publishes ev:null / medge:null; sort by
    model prob. mev (de-vigged consensus vs best price -- model-free line-shop) is KEPT: it is the only
    number on these boards with a defensible basis. Admin preview keeps its columns and renders dashes
    for new publishes -- deliberate, signals suppression.
  Deploy verified in bundle main.b1249648.js (new GmTable header present; the old header string
  survives exactly once = the SC admin preview, by design).
STANDING RULE: no model-edge display on ANY market until that market has a graded record. If group
markets are ever to be bettable: (1) wire gmv into GradeCenter first, (2) accrue a season of grades,
(3) then decide. Same discipline that earned the win/place badges their credibility.
NOTE ON THE MODEL: the tail numbers themselves were defensible (Ware 0.5 pct is a fine estimate). The
failure was PRESENTATION -- converting sub-tail-resolution disagreements into buy signals -- compounded
by pre-board favourite softness. No model change shipped; nothing here contradicts noise 16 or any
validated setting.

### TEAM-CORRELATED NOISE, STEP 1: ORG-LEVEL CO-MOVEMENT IS REAL; MANUFACTURER ADDS NOTHING (2026-07-15)
Motivation: group markets (Top Chevrolet et al) price JOINT events, but runRaceSim draws every driver
INDEPENDENTLY -- marginals right, joint distribution wrong. Operator hypothesis: correlation lives in
the team groupings (Hendrick / Trackhouse / RCR / Spire ...), nested inside manufacturer.
METHOD (measurement only, no sim change): cup 2022-26 loop_data (6,123 driver-races), exhibitions
excluded. car_number -> organization map, year-scoped: 2026 from entry_list ground truth (NOTE the data
says Haas Factory Team runs CHEVROLET in 2026 -- trust the entry list, not memory); 2025 gaps (4, 10,
41) backfilled from 2026 orgs since those moves happened at the 2025 boundary, with 41/2025 forced back
to Ford; scrub part-timers left unmapped (single-car orgs cannot contribute to within-org ICC anyway).
Coverage ~96 pct of driver-races. LEAK-FREE residual: prior = mean driver_rating over the driver's own
CORR-GROUP races strictly before race_date (min 3); races with >=8 usable drivers; residual = actual
finish rank pct minus prior-predicted rank pct within the usable subset. n = 5,209 obs (4,448 in
2023-26; 2022 reported separately per burn-in doctrine).
ICC, one-way ANOVA on (race, org) cells with k>=2 cars; permutation control = 200 within-race shuffles
of org labels:
  ORG 2023-26 (HEADLINE)   ICC 0.106   perm null -0.032 (p95 -0.002)   p 0.000   <- REAL
  by track group: Superspeedway 0.217 / Short&Flat 0.104 / Intermediate 0.086 / ROAD -0.003 (zero)
  by era: 2023-24 0.134 / 2025-26 0.077 -- halved but both far outside the null
  2022 alone: 0.245 -- burn-in artefact direction: thin priors make shared org-quality rating error
  masquerade as weekly co-movement; do not average it in.
  MAKE BEYOND ORG (unit = org-mean residual, cells = (race, make) with >=2 orgs):
  2023-26 real -0.064 vs perm mean -0.060, p 0.61; SS-only p 0.89  ->  ZERO. Nothing there.
VERDICTS:
1. Teammates co-move. ~10.6 pct of residual variance is a shared per-org-per-race factor (common draw
   ~0.33 of residual SD); at superspeedways 0.217 (~0.47) -- teammates run and wreck in the same packs.
2. The manufacturer umbrella adds NOTHING once orgs are accounted for. Operator's grouping instinct
   confirmed: model ORGS, skip the make factor entirely.
3. Road courses show NO team factor -- driver-dominated, consistent with everything else road.
NEXT (step 2, NOT yet run): prototype correlated noise in the harness sim~
   score_i = comp_i + sigma * (sqrt(rho_g) * z_org + sqrt(1 - rho_g) * z_i)
with rho_g by track group (SS .22 / short .10 / inter .09 / road 0). Marginal variance is unchanged by
construction, but noise still gets RE-TUNED per variant (dispersion-substitute rule). Gate: the four
driver markets must NOT degrade, and the JOINT-event calibration must improve -- scored with no odds
needed (e.g. how often the model's top-ranked Chevy actually finishes top Chevy, independent vs
correlated). Ship only if both hold. Either way group markets stay INFORMATIONAL until graded (see
doctrine entry above).

### WITHIN-GROUP TRACK-SIMILARITY WEIGHTING (the "Bristol discount" lambda) -> REJECTED; flat pooling wins a THIRD time (2026-07-15)
Operator, still stuck on Bristol in Short & Flat (competition comps NW off Phoenix/Martinsville/Iowa/
Richmond/Loudon; "if we show Bristol as a comp people are going to laugh"): proposed the CONTINUOUS
version of removal -- weight cross-subtype races (Bristol <-> flat) by lambda instead of the tested 0/1.
lambda 1 = current flat pool, lambda 0 = full removal. Swept 0 / .25 / .5 / .75 / 1.
METHOD: leak-free reduced harness, cup SHORT & FLAT target races only (42: 2022 = burn-in history only,
train/select 2023-24 n=20, test 2025-26 n=13), corr .35 / start .33 / track .15, neutral-50 shrink
fills, DNF 8.1 pct (group empirical), NSIM 1500. PAIRED RANDOM DRAWS (race-seeded, identical across
lambda and noise) so lambda differences are exact, not MC flicker. Noise RE-TUNED per lambda per market
(dispersion-substitute rule).
TEST at train-selected noise:
  lambda   win     t3     t5      t10
  0.00    22.44   58.5   85.7   142.5
  0.25    22.62   58.5   84.9   141.4
  0.50    22.27   59.0   84.7   141.6
  0.75    22.31   58.9   84.6   141.6
  1.00    22.33   58.4   84.2   141.7   <- current flat pool: best or tied on t3 AND t5
No monotone structure anywhere; win flickers 0.35 wide with no ordering; train winners scatter across
lambda by market (0 / .25 / 0 / .75) -- classic noise-fitting.
THE DECISIVE CUT -- FLAT-TRACK TARGETS ONLY (the North Wilkesboro question), fixed noise, paired draws:
  win 22.45-22.48 across the ENTIRE lambda dial (total spread 0.03); t5 84.8 at every lambda;
  t10 137.4-137.7; t3 lambda=1 59.6 BEST vs lambda=0 60.4 WORST.
Discounting Bristol does not help the flat tracks AT ALL, and full removal is the worst arm on t3.
VERDICT: SHIP NOTHING. Flat pooling survives its THIRD independent test (discrete move-out 2026-07-12,
contamination check 2026-07-12, continuous discount today). Companion measurement (same day): excluding
Bristol moves the median driver's short-flat rating only 1.7 pts, but real movers exist -- Ty Gibbs
-6.6, Hocevar -4.4, Larson -3.7 vs Logano +5.8, Byron +5.7, Berry +3.3. Those per-driver differences
CANCEL at the market level; the paired test proves the dial does nothing on flat-track boards.
DOCTRINE UNCHANGED: among defensible groupings, pool composition is not a lever -- driver_rating
measures the DRIVER. The Bristol OPTICS concern is legitimate and is being handled at DISPLAY level
only (proposed display_group column so public LoopData never shows Bristol as a flat-track comp);
the model does not change for optics.

### THE HEIM CASE (trucks NW pre-board) + TRUCK SHORT-FLAT NOISE SLICE OF #115 (2026-07-15/16)
Operator: NW trucks pre-board has Heim FMV +835 (model 10.7 pct win) vs market +225/+230 (~27 devig);
"we are way off considering how elite he has been." Forensics on the published board (sim_results
b454b779, PRE stage), decomposed cause by cause:
1. NOT noise 23. First truck short-flat noise sweep ever run (26 races 2023-26, train 23-24 n~18 /
   test 25-26 n~8, reduced harness, DNF 13.3, paired seeds):
     train win Brier~ N16 24.27 / N19 24.21 / N23 24.27 (flat); t3/t5/t10 best N16.
     test (n~8, weak)~ prefers HIGHER noise, contradicting train.
     FAVORITE CALIBRATION AT N23 ON TEST~ model 24.6 vs actual 25.0 -- DEAD ON.
   VERDICT~ no clean evidence to retune truck short-flat noise; N23 defensible. #115 remains open for
   intermediates/SS but this slice is NOT the Heim explanation. Do not port numbers; reduced harness.
2. NOT the Bristol wreck (alone). Heim's ONLY 2026 short-flat race is Bristol P30 (rating 78.5), which
   drags his pool to a TIE with Eckes (118.8 vs 118.8). But dropping that race moves the age-weighted
   pool only ~+1 pt -- 25-race pools do not move on one race. Wreck-decontamination (#48) would not
   close this gap. (His NW trackHistory is elite: 125.6/P6 2023, 140.8/WIN 2024, 130.7/P17 2025 --
   and it IS lifting him; he leads the board.)
3. THE ACTUAL MECHANISM~ PRE-BOARD INPUT DARKNESS. lineup 'none' -> startPos (0.33) carries zero
   information; practice not run -> longRunPace (0.15) neutral. HALF the composite weight is dark, the
   live half (corr 0.35 + track 0.15) is min-max compressed, and at noise 23 the top of a 39-truck
   field lands ~10-11 pct mechanically. The harness shows the SAME model with real grids puts the
   favorite at ~24-25 pct -- which is the market's number for Heim. The market is pricing the
   post-information favorite; the pre board is pricing a fog. Both are internally consistent.
4. PROCESS BUG FOUND (real, fix regardless)~ STALE EQUIPMENT OVERRIDES. The NW board carries Lime Rock
   road-course eq decisions via featured_weekend persistence~ Heim 0, Majeski 0, Eckes 1, Garcia 0.5,
   Annunziata 0.05. Heim/Majeski/Eckes are history-rich (equipment prior inert -> harmless), but
   Garcia 0.5 and Annunziata 0.05 are thin-history drivers being actively dampened at NW by LAST
   WEEK'S ROAD judgments. RECOMMENDATION~ clear eq_overrides + rear_overrides automatically whenever
   weekend config track/race# changes (auto-reset guard, not yet shipped).
DOCTRINE (restating, because this is the third market this week)~ pre-board win numbers are
pre-information placeholders, not opinions. Do not bet the favorite gap in either direction off a pre
board; judge the model vs market AFTER P and Q load. Expect Heim to rise sharply post-P&Q (48 pct of
weight lights up; his quali/practice should be elite).

### !! CORRECTION !! THE NW TRUCK EQ OVERRIDES ARE NOT STALE -- DO NOT SHIP THE AUTO-RESET GUARD (2026-07-16)
RETRACTS point 4 of the Heim entry directly above. I called the persisted eq overrides a "process bug"
(stale Lime Rock leftovers) and recommended auto-clearing eq_overrides/rear_overrides on weekend-config
change. WRONG on both. Operator explains they are DELIBERATE, SEASON-LONG number-swap corrections:
  - Heim now drives the 5, previously fielded for a weak driver -> infl 0 so the polluted car pool
    cannot drag him.
  - Garcia now drives the 98 -- MAJESKI's old number in a pure number swap, not a team move -> infl 0.5
    because Garcia must not inherit Majeski's elite car history wholesale.
  - Majeski now drives the 88, previously a weak driver's number -> infl 0, same logic as Heim.
These are correct patches for a REAL structural limitation~ the equipment prior pools BY CAR NUMBER,
same-series (SimulationCenter task-118 code, line ~790). Car numbers do not carry equipment identity
across driver swaps within/between orgs -- the operator understands the fleet better than the key does.
STANDING GUIDANCE (replaces the retracted recommendation):
  1. eq_overrides PERSIST BY DESIGN and must NEVER be auto-cleared. An auto-reset would silently destroy
     season-long operator judgments every week. DO NOT SHIP IT.
  2. The right guard is VISIBILITY, not deletion~ the sim/publish flow should surface active overrides
     for review (it already stamps them into config; a review chip at run time would complete this).
  3. Note the asymmetry~ infl overrides on RICH-history drivers (Heim, Majeski) are harmless insurance
     (the prior's thin-history fill barely touches them); the ones doing real work are on thin-history
     drivers (Garcia 0.5, Annunziata 0.05) -- these deserve a weekly glance, by the operator, manually.
STRUCTURAL FIX CANDIDATE (unranked, not urgent)~ key the equipment pool by ORGANIZATION instead of car
number (orgs survive number swaps; entry_list carries org for 2026 all series; historical car->org maps
needed for 2022-25 -- built for cup 2026-07-15, trucks/oreilly would need their own). The modal-car
blend already mitigates the driver side; the org key would fix the car side. Overrides remain the
mechanism until then. Points 1-3 of the Heim entry (noise 23 stands; Bristol wreck immaterial;
pre-board input darkness is the gap) are UNCHANGED.

### PROJECTED START POSITIONS FOR PRE BOARDS -> REJECTED, DEAD NEUTRAL; the grid's value is unprojectable (2026-07-16)
Follow-up to the Heim case. Operator: "are pre-race simulations essentially worthless unless we start
projecting start positions?" Tested the honest version: fill pre-board startPos with each driver's
PRIOR GROUP-SCOPED AVERAGE START (qualifying-skill history, min 3 prior races, 96 pct coverage) instead
of the neutral fill. This is NOT circular (quali history is a distinct signal from race rating).
METHOD: 107 cup non-SS ovals, leak-free, corr .35 / start .33 / track .15, group-empirical DNF
(SF 8.1 / Int 12.7), NSIM 1200, paired race seeds across arms, noise re-tuned per arm per market
(train 2023-24, test 2025-26, 2022 burn-in history only).
TEST at train-selected noise:
  arm                     win     t3     t5      t10     fav model vs actual
  NEUTRAL (current)      23.90   62.2   93.4   151.5      13.1 / 22.2
  PROJECTED (quali hist) 23.94   62.2   93.5   152.1      15.3 / 19.4
  TRUE GRID (reference)  23.10   59.8   89.2   147.9      17.7 / 30.6
VERDICT: PROJECTED IS DEAD NEUTRAL vs the blank fill -- identical on every market (win +0.04, t3 tie,
t5/t10 marginally worse). SHIP NOTHING.
WHY (the reusable insight): prior average start is mostly the SAME quantity as corrHistory -- good
drivers qualify well -- so the composite already contains it; the residual "pure quali skill" component
is too small to move a betting market. Same collinearity graveyard as trackHistory-vs-corr, laps-run,
best-stint. Meanwhile the TRUE grid is worth a LOT (win -0.8, t3 -2.4, t5 -4.2, t10 -3.6; favorite hit
rate 22 -> 31): the grid's information is THIS-WEEK CAR SPEED, which cannot be projected from history
BY CONSTRUCTION. Identical lesson to practice-is-the-only-current-speed-input.
DOCTRINE SETTLED: pre boards are not broken and cannot be "fixed" -- their compression IS the honest
representation of what is knowable pre-weekend. Their job is CLV capture on structural contender edges
(the Majeski case), full stop. The pre->post gap is the price of information that only Friday's track
sessions can deliver. Quantified: ~0.8 win Brier / ~9pp favorite hit rate between blank grid and real
grid on 2025-26 cup ovals.

### PRELIMINARY -- CAREER-STAGE TRAJECTORY: young drivers systematically BEAT their pool rating (2026-07-16)
NOT A RESULT YET. A diagnostic that survived its first two controls and now needs the full harness.
Trigger: operator, on Hocevar cup NW pre-board FMV +3471 vs DK +700 ("we are doing something wrong").
Observation that motivated it: Berry (collapsing veteran) runs BELOW the model while Hocevar (ascending
sophomore) runs ABOVE the market's read of our number -- SAME failure, opposite signs, i.e.
NON-STATIONARITY. The global recency fix for this was rejected TWICE (recency sweep, form slope) because
it paid a variance cost on ~30 stationary veterans to chase ~5 changing drivers. The UNTESTED version is
CONDITIONAL: trajectory adjustment only where trajectories exist (early careers).
DIAGNOSTIC (cup non-SS ovals 2024-26, n=2092 driver-races, leak-free prior = group-scoped age-weighted
pool WITH the live shrink, STRICT >=8 prior in-group races so thin-sample regression-to-mean cannot
produce it; resid = predicted rank pct minus actual rank pct, >0 = beat the pool):
  career starts (since 2022)    n     mean resid    t
  < 40                          81     +20.1       6.5
  40 - 80                      450     +10.1       7.2
  80 - 120                     914      -3.0      -2.8
  120+                         647      -5.3      -4.3
MONOTONE by career stage, enormous t. Hocevar specifically: 2025 resid -6.8 (ran below pool), 2026
+6.9 on n=12 (running above it) -- the market's 7-1 prices the turn, the pool is designed to lag it.
TWO CONFOUNDS STILL ALIVE (why this is not shipped, and must not be until they die):
  1. SURVIVORSHIP: rookies who keep their rides are exactly the ones who improved; the failed ones exit
     the sample. Inflates young-bucket outperformance by construction.
  2. RATING-COMPOSITION BIAS: driver_rating rewards laps led / fastest laps. Veterans DOMINATE races ->
     rating overstates their finish (Larson 2025-26 resid = -24, the extreme case). Youngsters rarely
     lead -> rating understates them. This produces a career-stage gradient WITHOUT any improvement.
DECISIVE TEST (task #53): career-stage uplift term fitted on train 2023-24, walk-forward 2025-26, four
betting markets, noise re-tuned per arm; plus a WITHIN-DRIVER version (same driver's resid vs his own
career age) to separate real improvement from composition bias. If it clears, first pool-side change
since the equipment prior. If it dies, the pre-board doctrine covers the residue (do not fade young
breakouts off multi-year pools; the market prices trajectory and we do not).

### CAREER-STAGE TRAJECTORY TERM -> REJECTED IN WALK-FORWARD; the gradient is real BACKWARD and unbettable FORWARD (2026-07-16, resolves the PRELIMINARY above; task #53 closed)
CONTROL 1 (composition bias) -- PASSED, confound DEAD. Rebuilt the diagnostic with a FINISH-ONLY pool
(prior = age-weighted mean finish rank pct, zero driver_rating content, so no laps-led flattery):
  <40 starts +19.7 (t 6.6) / 40-80 +11.6 (t 8.1) / 80-120 -2.9 / 120+ -6.4.
  Identical gradient. Young drivers genuinely finish better than their own past finishes predict.
CONTROL 2 (the decisive one) -- WALK-FORWARD, FAILED. Uplift term comp_i += k * shape(bucket), shape
from the diagnostic (+1.0 / +0.5 / -0.15 / -0.26), k swept 0/3/6/9/12, joint k x noise grid (noise
re-tuned per k per market on train 2023-24), scored on TEST 2025-26, 107 cup non-SS ovals, paired seeds:
  GLOBAL~ k=0 best or tied on every market; test win 23.10 (k0) -> 23.18 (k12) MONOTONE WORSE;
  t10 147.9 -> 149.9. No optimum anywhere inside the sweep.
  SUBPOPULATION-SCOPED (young rows ONLY, n=299 test driver-races -- the fair lens, no 25:1 dilution)~
  young win 3.28 -> 3.30 -> 3.32, young t10 77.2 -> 77.7 -> 79.0 for k 0/3/6. THE UPLIFT MAKES THE
  YOUNG DRIVERS' OWN PREDICTIONS WORSE.
WHY A t=7 BACKWARD SIGNAL HAS ZERO FORWARD VALUE -- SURVIVORSHIP, exactly as flagged in the preliminary:
retrospectively, the young drivers still generating rows are the ones who improved (the others lost
their rides and exited the sample), so the backward average is +20 pct of field. Prospectively you
cannot know WHICH kid is the improver, so a uniform uplift adds signal for the improvers and equal
noise for the rest -- and nets negative. The gradient is a property of the SAMPLE, not of any
identifiable driver standing in front of you.
VERDICT~ SHIP NOTHING. 4th non-stationarity fix rejected (global recency, season-norm, form slope, now
career-conditional uplift). The pool's refusal to chase is now tested from every direction we can
construct.
WHAT SURVIVES AS DOCTRINE~ (1) Model numbers on <80-career-start drivers are LOW-CONFIDENCE in a way
the sim cannot fix -- the market prices trajectory using information (which kid is real) that is not in
loop data. Do NOT fade young breakouts at model fair (Hocevar +3471 vs +700 is an unresolvable
disagreement, not an edge either way). (2) Do not lay veterans purely because the pool loves them --
the 120+ bucket runs -5 pct vs pool, but the same survivorship logic caps what a term can capture.
(3) Candidate PRODUCT change (display, not model)~ flag <80-start drivers' rows on public boards as
trajectory-uncertain, same spirit as the group-market suppression. Operator's call.

### CUP RINGERS IN TRUCKS: floor is REAL and underpriced (places), win is NOT -- cross-series borrow HOLD (2026-07-16)
Trigger: Hocevar TRUCK NW pre-board 3.1 pct win / proj P17.8 vs DK +700. (NB the earlier Hocevar
decomposition same day used his CUP pool by mistake -- truck board pools trucks-only. His TRUCK
short-flat pool: 2023 Niece elite year (NW 121.3/P4, Richmond 121.1/WIN) at 0.55 age weight, nothing
2024-25 (moved up), one 2026 Bristol cameo. And the operator's fresh 2022 truck season load LOWERS him
102.3 -> 96.0 -- his teenage 2022 avg ~81. Republish will price him WORSE.)
DIAGNOSTIC 1 (raw resid): ringers (>=10 cup races same season) resid -17.6 (t 3.7) -- but this is a
CEILING ARTIFACT (drivers predicted at rank 1 can only under-deliver). Do not read it raw.
DIAGNOSTIC 2 (matched by pool-predicted rank, the fair lens, trucks ovals 2023-26):
  pool rank   ringers                      non-ringers
  1-3   n26   win 19.2 / t5 38.5 / avg 12.5    win 18.2 / t5 50.3 / avg 9.4
  4-8   n13   win  0.0 / t5 38.5 / avg  8.5    win  3.8 / t5 29.5 / avg 12.3
  9-15  n9    win 11.1 / t5 55.6 / avg  9.0    win  1.6 / t5 15.4 / avg 15.2
=> Mid/low-ranked ringers finish like top-3 cars (FLOOR massively underpriced) but won 1 of 22.
   Top-ranked ringers (Busch/Chastain type) win at the same rate as truck aces with a WORSE floor.
CLASS-STRENGTH OFFSET (needed for any cross-series borrow; naive max(truck,cup) is INERT because cup
ratings run on a harder scale): same driver-year, >=3 races both series, <=2024 only (no test leakage):
mean truck-minus-cup rating = +28.9 (n 13; Heim +70, Busch +51/+30, Z.Smith +56/+50; noisy, SD ~23).
HARNESS (borrow = if cupPool+29 > truckPool, blend by phi; 77 truck oval races, train 23-24 / test
25-26, paired seeds, N23):
  TEST ringer-scoped, phi 0 -> 0.5 -> 1:  R_t10 270.7 -> 262.6 -> 255.7 (-5.5 pct, monotone)
                                          R_t5 234.7 -> 232.0 -> 230.5 (-1.8 pct)
                                          R_t3 flat; R_win 94.2 -> 95.7 (WORSE +1.6 pct)
  Global: t10/t5 slightly better, win slightly worse. Train agrees on t5/t10 direction.
VERDICT: HOLD, do not ship yet. The borrow (phi 1, offset +29) demonstrably fixes the ringer FLOOR on
place markets and slightly damages win -- consistent with the matched diagnostic (floor real, win not).
45 test rows is thin, the offset is noisy, and one composite drives all markets so the win cost is
real. RE-TEST at end of 2026 (more ringer rows accrue every truck weekend a cup driver moonlights).
OPERATOR GUIDANCE FOR NW (actionable now): Hocevar's WIN number (~3 pct) is roughly RIGHT per matched
evidence (mid-rank ringers 1/22) -- DK +700 is retail narrative, not value. His TOP-5/TOP-10 board
numbers are TOO LOW -- matched ringers at his slot run avg P8.5-9.0 with 38-56 pct t5. If books hang
plus-money t5/t10 lines on ringers priced off stale truck pools, THAT is the bet. Same logic: Bell.

### #47 RE-RUN: BEST-5 IN THE MULTI-SET ERA -- CONFIRMED AND PROMOTED; first practice variant to touch the WIN market (2026-07-16)
The 2026-07-10 watch item, re-run at its pre-set trigger (~20 cup races of 2026; 12 have practice).
DATA HYGIENE FOUND ON THE WAY~ most 2026 practice_laps rows carry race_number = 1 (column default --
they were uploaded before the loader had a Race# field). Joined tolerantly by (year, track) since no
2026 track has hosted twice yet. REPAIR SQL eventually; the Race#-guard era makes new uploads correct.
SPEARMAN RE-RUN (40 cup oval practice races, latest session, replica overall 0.256 vs stored ~0.26)~
              ALL(40)   2024-25(28)   2026(12)
  overall_avg  0.256      0.243        0.286
  best5        0.300      0.269        0.375   <- gap GREW from +0.042 (n10) to +0.089 (n12)
  filt-103     0.244      0.247        0.238   <- filt-103 candidate FADED; drop it
  Sign test 2026~ 7/12 races favor best5 (weak alone; the magnitude carries the result).
  CAVEAT~ in THIS replica best5 also edges the incumbent in 2024-25 (+0.026), where the 07-10 test had
  it losing (-0.025). The era-CONTRAST is methodology-sensitive; the 2026 advantage is robust.
FULL-COMPOSITE A/B (the real bar; 12 races 2026, corr .35/start .33/track .15/practice .15, paired
seeds, noise 13/16/19, group-empirical DNF; practice input swapped overall_avg -> best5)~
  market   overall(N16)   best5(N16)   direction at ALL THREE noises
  win        21.55          21.06      best5 BETTER (~2-3.5 pct rel)   <- !!
  t10       127.5          126.8       best5 better
  t5         78.6           79.8       best5 worse (~1.5 pct)
  t3         53.0           54.1       best5 worse (~2 pct)
  FAVORITE~ best5's top pick WON 6/12 races vs 4/12 for overall (favM identical ~29 -- it picks BETTER
  favourites, not more confident ones).
WHY THIS MATTERS~ practice pace was validated 07-14 as a PLACE-ONLY signal (nothing on win). best5 is
the first practice variant to move the WIN market -- consistent with the practice-DOMINANCE hypothesis
arriving through a side door: under the 2026 multi-tire-set rule everyone gets fresh rubber, so peak
laps become apples-to-apples and peak speed is what wins races.
VERDICT~ DO NOT SHIP ON n=12. PROMOTED to top model candidate with a PRE-REGISTERED confirmatory
re-test at ~18 cup practice races of 2026 (roughly 6 more weekends). REGISTERED PREDICTIONS (written
BEFORE the data)~ (1) win Brier improves, (2) t10 improves, (3) t3/t5 cost stays <= ~2 pct rel.
ARMS~ best5 pure, and a 50/50 best5/overall blend of the practice input (blend may keep the place
accuracy; alpha is NOT to be tuned on the test set). If predictions hold -> ship ERA-CONDITIONED
practice input (overall_avg pre-2026 / best5 or blend for multi-set-era sessions).
filt-103 is CLOSED (faded to 0.238 in the era it was supposed to help).

### !! CORRECTION !! THE "MULTI-SET ERA" MECHANISM FOR BEST5 IS FALSE -- operator falsified it (2026-07-16)
AMENDS both the 2026-07-10 watch item and the #47 RE-RUN entry directly above. Both attributed best5's
advantage to "the 2026 multiple-tire-set rules change." THE PREMISE IS WRONG. Operator (who manually
fact-checked every tire allocation from Jayski): NASCAR issues ONE practice set ~95 pct of the time,
past AND future. The tire_sets labels agree~ 2026 is 15-of-17 single-set; 2025 16-of-18; 2024 10-of-12.
There is no era. There are ~5 outlier weekends total (Chicagoland -- the race that spawned the metric
debate -- is one of them). An "era-conditioned input" would condition on ~1 race a year. DEAD FRAMING.
WHAT SURVIVES~ the NUMBERS, now mechanism-less~ best5 2026 Spearman 0.375 vs 0.286 (n=12), full-
composite A/B win Brier -2 to -3.5 pct rel at all noises, model favourite won 6/12 vs 4/12. All real
measurements. But an UNEXPLAINED signal ranks below an explained one, and there is a LIVE CONFOUND~
2026 is the chalk year (HHI .145, Hamlin 5/20). best5 sharpens favourites; in a year where favourites
win, a favourite-sharpening metric scores well WITHOUT being better in general. If that is the story,
best5 will not generalize.
REFRAMED CONFIRMATORY TEST (task #55, predictions UNCHANGED because they were mechanism-agnostic)~
straight input-swap question on NEW 2026 oval practice races (nearly all single-set, i.e. the real
world)~ (1) win Brier improves, (2) t10 improves, (3) t3/t5 cost <= ~2 pct rel. Arms~ best5 pure +
50/50 blend, alpha never tuned on test. NO era-conditioning in any shipped version -- if best5 wins,
it wins as THE input; if it only wins in chalk conditions, it dies at the re-test.
LESSON (again)~ the operator's domain knowledge falsified in one sentence a mechanism two AI sessions
had built into the record. Check rule-change claims against the person who watches the races.

### BEST5 EXTENSION: composite A/B run on 2025 AND 2024 (operator asked the right question) (2026-07-16)
Operator: "did you test it on 2025 races?" The Spearman runs had 2024-25; the COMPOSITE A/B (the bar
that matters) had only been run on 2026. Now run on all three seasons, same pipeline, paired seeds,
noise 13/16/19, corr .35/start .33/track .15/practice .15:
  2025 (16 races)~ BEST5 SWEEPS ALL FOUR MARKETS at all noises. win 21.59 vs 21.91 (N16), t3 57.3 vs
    57.7, t5 86.9 vs 87.7, t10 160.8 vs 161.2; favourite won 7/16 vs 5/16.
    => THE CHALK CONFOUND IS BADLY WOUNDED~ 2025 was NOT a chalk year and the win gain replicates.
    => the t3/t5 cost seen in 2026 does NOT replicate in 2025 -- likely 2026 noise, drop it from the
       registered predictions? NO -- predictions stay as written; note only.
  2024 (12 races)~ WASH, slight lean AGAINST~ win 26.48 vs 26.36 (+0.5 pct rel worse), t3 slightly
    worse, t5 slightly better, t10 slightly worse; favourite 1/12 vs 2/12.
THREE-SEASON AGGREGATE (40 races)~ model favourite won 14/40 (best5) vs 11/40 (overall); win Brier
better in 2025+2026 (28 races, consistent at every noise), neutral-negative in 2024 (12).
READ~ real and strengthening but not unanimous -- 2024 keeps it honest (and 12-race year-slices flip
signs easily; see the favGap sign flip at n=12). Alternatives for the 2024 wash~ thin early practice
coverage, or a genuine time trend (practice formats/car maturity), or 2025-26 luck. Cannot distinguish
at this n.
DECISION UNCHANGED~ NOT shipped. The pre-registered #55 confirmatory (new 2026 races, ~6 weekends)
remains the gate, now with better priors~ chalk confound weakened, aggregate favours best5, one
contrary season on record. If #55 passes, ship best5 (or the 50/50 blend) as THE practice input --
no era/tire conditioning (see correction above).

### ADDENDUM: the 2024 best5 wash is NOT explained by thin sessions (2026-07-16)
Operator (reasonably): "I dont think our 2024 practice database is as full as 2025 and 2026." Tested
the mechanical version of that excuse -- if 2024 sessions were short, best5 (5 of N laps) converges on
overall_avg and CANNOT differentiate, making the wash inevitable and uninformative. MEASURED:
  year   median laps/driver   best5-vs-overall within-session agreement (Spearman)
  2024        26                    0.662
  2025        34                    0.568
  2026        24                    0.621
2024 drivers ran MORE laps than 2026, and the metrics disagreed comparably in all three years. The
convergence excuse is FALSE -- best5 had full room to win in 2024 and did not.
WHAT SURVIVES of the concern~ COVERAGE SELECTION. Only 12 of 36 races of 2024 are loaded, chosen by
sheet availability, not at random. A hand-picked third of a season is a weak arm -- keep 2024 as
genuine neutral-contrary evidence, weighted accordingly, not dismissed.
(Also within-session agreement ~0.57-0.66 everywhere is itself informative~ best5 and overall_avg
genuinely rank drivers DIFFERENTLY in every era -- these are two distinct signals, not variants.)

### #55 DECISION RULE, FIXED BEFORE THE DATA (2026-07-16, operator + Fable)
To close the "best5 or the blend" ambiguity in the promotion entry -- the shipping rule is now
PRE-SPECIFIED and no other outcome may be chosen after seeing the confirmatory numbers:
  1. If BEST5 PURE passes all three registered predictions on the new races (win Brier improves,
     t10 improves, t3/t5 cost <= ~2 pct rel) -> SHIP BEST5 PURE as the practice input.
  2. If best5 improves win/t10 but BLOWS the t3/t5 cap -> ship the 50/50 BLEND only if the blend
     itself passes all three. (Rationale: within-session agreement between the metrics is only
     0.57-0.66 -- they are distinct signals; the blend may keep the incumbent's place accuracy while
     capturing best5's win signal.)
  3. Anything else -> NOTHING SHIPS; entry gets its tombstone.
No alpha tuning, no new arms, no era/tire conditioning, no post-hoc subsetting. Trigger: ~18 cup oval
practice races of 2026 (currently 12).

### STANDING CAVEAT: TRACK-STATE / GROUP BIAS IN ALL PRACTICE METRICS (2026-07-16, operator)
Operator: best laps are partly created by favourable track conditions -- the first car on track
typically gains from the green track, and when practice splits into groups A/B, one group gets a track
advantage. TRUE, and currently UNMEASURABLE~ practice_group is empty in every upload (checked all
years) and practice_laps carry no wall-clock/session-order, so neither correction nor quantification is
possible with present data.
CONSEQUENCES~
  1. The bias hits BOTH metrics~ a driver whose whole session sits in the good window is flattered on
     overall_avg exactly as on best5. It is a SHARED error floor on the practice input, not a tiebreak
     between the candidates -- and one more reason practice weight caps at 0.15.
  2. FIX-FORWARD (free if the source sheets show it)~ populate practice_group at upload. After a
     season of labels, within-group normalization becomes testable. If sheets lack group info, the
     confound is irreducible; do not attempt to infer groups from lap ordering (not stored).
  3. Nobody should later "discover" a session-order artefact and treat it as new -- it is known,
     operator-identified, and priced into the practice input's weight ceiling.
Same session also per operator~ NO best5/Peak-Speed display column on the report card (users will not
care). The best5 plumbing, if built, is BACKEND ONLY (stored column + upload computation + backfill)
so a #55 pass flips the sim input in one line.

### FIRST-EVER TRUCK PRACTICE VALIDATION: the signal is ~2x CUP's (2026-07-16, operator backfill)
Operator backfilled 2026 truck OVAL practice (7 sessions~ Darlington R4, Rockingham R5, Bristol R6,
Texas R7, Dover R9, Nashville R11, Michigan R12; 33-38 drivers each; race numbers all CORRECT -- no
default-1 issue in this batch). Per-race Spearman of practice metric vs finish, latest session,
same replica as the cup runs~
  race            n    overall_avg   best5
  R4 Darlington   33     0.354       0.438
  R5 Rockingham   34     0.803       0.773   <- practice nearly WAS the race
  R6 Bristol      35     0.330       0.278
  R7 Texas        31     0.304       0.446
  R9 Dover        35     0.511       0.530
  R11 Nashville   35     0.554       0.533
  R12 Michigan    33     0.575       0.504
  MEAN                   0.490       0.500   (cup benchmark ~0.26-0.30)
FINDING 1 -- TRUCK PRACTICE IS ROUGHLY TWICE THE SIGNAL OF CUP PRACTICE. Plausible mechanism~ truck
equipment spread >> cup parity, so 20 minutes of track time separates the field far more. CONSEQUENCE~
the truck sim's practice weight (0.15) is BORROWED FROM CUP and may be materially UNDERWEIGHTED --
potentially the largest available truck-sim improvement. NOT actioned~ n=7, no train/test split
possible within 2026 alone, and weight changes must clear the full-composite betting-market bar with
noise re-tuned (dispersion rule).
FINDING 2 -- best5 vs overall in trucks~ WASH at n=7 (0.500 vs 0.490, 3/7 races). Neither confirms nor
contradicts the cup best5 candidate. Cross-series verdict waits on sample.
GATE FOR BOTH~ operator backfills 2025 TRUCK OVALS next (-> ~15-20 races). Then~ practice weight sweep
for trucks (train 2025 / test 2026, weights .15/.25/.35, noise re-tuned per arm, all four markets) AND
the truck best5 A/B on the full sample. Do not touch the truck weight before that test.

### O'REILLY PRACTICE VALIDATION: ~2x CUP, CONFIRMING THE TRUCKS -- the finding is LOWER-SERIES-WIDE (2026-07-16)
Operator backfilled 10 O'Reilly 2026 oval sessions (37-41 drivers each, race numbers clean). Same
replica~ per-race Spearman vs finish, latest session~
  R4 Phoenix .532/.400  R5 Vegas .121/.280  R6 Darlington .453/.720  R7 Martinsville .078/.150
  R8 Rockingham .470/.560  R9 Bristol .771/.706  R12 Texas .590/.641  R14 Dover .480/.459
  R17 Pocono .514/.439  R20 Chicagoland .670/.596        (overall_avg / best5)
  MEANS~ overall 0.468, best5 0.495 (best5 wins 5/10 -- ANOTHER WASH; best5 remains a cup-only signal).
HEADLINE, now TWICE-CONFIRMED~ practice signal in the lower series runs ~0.47-0.50 vs cup's ~0.26-0.30.
Two independent series, same magnitude -> the equipment-spread mechanism holds (wide machinery gaps ->
20 minutes of track time photographs the field). The 0.15 practice weight borrowed from cup is now
SUSPECT-LOW for BOTH trucks and O'Reilly.
CAVEAT (before anyone sweeps weights on this)~ wider true spread lifts ALL signals -- corr pools are
stronger in the lower series too. The sweep must answer the MARGINAL question at the betting markets
with noise re-tuned, not compare raw Spearmans.
TEST DESIGN NOW AVAILABLE (no more data needed)~ CROSS-SERIES SPLIT -- select the lower-series practice
weight (.15/.25/.35) on TRUCKS 2026 (7 races), score on O'REILLY 2026 (10 races). Leak-free by
construction (different series, different drivers/trucks). Low power (7/10) but honest; 2025 sheet
backfills for either series upgrade it whenever the operator finds them.

### LOWER-SERIES PRACTICE WEIGHT SWEEP (cross-series split) -> KEEP 0.15; the 2x raw signal does NOT cash at the composite (2026-07-16)
The test the two backfills unlocked. Design~ select practice weight (.15/.25/.35, other weights
rescaled to keep sum) and noise (16/19/23/27) per market on TRUCKS 2026 (7 oval races), score on
O'REILLY 2026 (10 oval races). Leak-free by construction (disjoint series). Paired seeds, NSIM 2000,
group-empirical DNF per series.
TRAIN (trucks)~ place markets prefer MORE practice (w.35 best on t3/t5/t10), win prefers LESS (w.15) --
the cup pattern (practice is a PLACE signal) reappears in trucks.
TEST (oreilly), train-picked (weight,noise) per market~
  win~ pick w.15 -> 21.65; raising weight is MONOTONE WORSE on test (21.65 / 21.87 / 22.26). KEEP .15.
  t10~ pick w.35@N19 -> 123.5 vs 124.4 at w.15 (-0.7 pct, and monotone -1.9 pct at N16). CONFIRMS.
  t3~  pick w.35 -> 56.8 vs 56.3 at w.15. CONTRADICTS its own train pick.
  t5~  pick w.35 -> 84.1 vs 83.2 at w.15. CONTRADICTS.
VERDICT~ SHIP NOTHING. Only t10 wants more practice weight cross-series; t3/t5 flip sign out of
sample and win is monotone against. The ~2x raw Spearman does NOT translate to composite gains --
EXACTLY the pre-logged caveat~ wide equipment spread lifts ALL inputs (corr pools are stronger in the
lower series too), so practice's MARGINAL value is already priced at 0.15. The borrowed cup weight is
now a VALIDATED setting for trucks + oreilly, not a hand-me-down.
CAVEATS~ 7 train / 10 test races, one season, reduced harness (no equipment prior). UPGRADE PATH~
operator backfills 2025 truck/oreilly practice (no lineups needed -- loop_data carries start_position)
-> within-series train(2025)/test(2026) re-run. Trigger~ ~15 oval sessions per series in 2025.

### TRUCKS WITHIN-SERIES: weight 0.15 confirmed a THIRD time; best5 REPLICATES the cup win signal (2026-07-16, operator backfilled trucks 2025)
Operator loaded trucks 2025 practice (11 usable oval sessions after integrity audit; zero registry
orphans except Phoenix R25 -- the 2025 truck FINALE is missing from loop_data entirely, uploader
stubbed races id 433 with the CORRECT race number; operator to run Phoenix 2025 truck loop through
Load New Race to adopt the stub). Cross-year lap-time sanity: all clean.
1. WEIGHT SWEEP, the proper within-series design (train trucks 2025 n=11 / test trucks 2026 n=7,
   weights .15/.25/.35 rescaled, noise 16-27 per arm, paired seeds):
   TRAIN prefers w.15 on win/t3/t10 (win 25.43/25.46/25.63 monotone); only t5 marginally likes .25.
   TEST win at N19: 21.54 / 21.85 / 22.14 -- MONOTONE AGAINST raising weight, identical shape to the
   cross-series and cup sweeps. VERDICT: KEEP 0.15. Three independent designs (cup 07-14, cross-series
   07-16, within-series 07-16) all agree: the win market pays for every extra point of practice weight,
   the place gains are small, one composite serves all markets. THREAD CLOSED absent structural change.
2. TRUCKS BEST5 COMPOSITE A/B (18 races, w.15, N19+N23, paired seeds) -- the cup pattern REPLICATES:
   WIN better in ALL FOUR cells~ 2025: 25.19 vs 25.43 (N19), 25.39 vs 25.54 (N23);
                                  2026: 21.33 vs 21.54, 22.18 vs 22.44. (~1 pct rel, consistent.)
   t10 better 3 of 4; t3/t5 wash. The earlier trucks Spearman wash concealed this; the composite is
   the bar. BEST5 WIN-MARKET TALLY across series/years~ cup25 YES, cup26 YES, cup24 wash,
   trucks25 YES, trucks26 YES. First genuine cross-series replication.
   DISCIPLINE~ #55 (cup, ~18 races, pre-registered) still decides the cup input per its fixed rule --
   this entry does NOT unlock early shipping. But the prior just moved a lot. If #55 passes, trucks
   adopt with this entry as their evidence; O'Reilly gets its composite A/B when the operator's NOAPS
   2025 backfill (in progress) lands.

### O'REILLY WITHIN-SERIES (operator's NOAPS 2025 backfill): weight thread FULLY CLOSED; best5 MISSES here (2026-07-16)
Cleanest backfill batch yet (15 usable 2025 oval sessions, zero orphans/stubs/lap mismatches -- the new
uploader guards + operator care). Train 2025 n=15 / test 2026 n=10, same harness, paired seeds.
1. WEIGHT SWEEP -- 4th independent confirmation, the strongest~ train selects w0.15 on ALL FOUR markets;
   test win curve monotone against raising (21.99 / 22.21 / 22.50 at N19); t3/t5 worse, t10 marginal.
   PRACTICE WEIGHT 0.15 IS NOW CONFIRMED IN EVERY SERIES BY EVERY DESIGN (cup sweep 07-14, cross-series,
   trucks-within, oreilly-within). CLOSED. Do not reopen without structural change.
2. BEST5 COMPOSITE A/B -- O'REILLY SAYS NO. Win Brier WORSE in all four cells~
   2025: 23.43 vs 23.32 (N19), 23.43 vs 23.35 (N23); 2026: 22.38 vs 21.99, 22.62 vs 22.32.
   t3/t5 worse in 2026; t10 flat. UPDATED CROSS-SERIES TALLY for best5 on the WIN market~
   cup24 wash / cup25 YES / cup26 YES / trucks25 YES / trucks26 YES / oreilly25 no / oreilly26 NO.
   4 yes, 1 wash, 2 no. The trucks replication is now bracketed by an oreilly ANTI-replication of
   comparable size. Candidate explanations (none testable tonight)~ oreilly practice programs differ
   (more quali-sim vs race-trim mix), field composition, or plain noise at 10-15 races per cell.
DISCIPLINE~ #55 (cup pre-registered) still decides the CUP input, unchanged. If it passes, adoption is
now SERIES-SPECIFIC on each series' own evidence~ trucks would adopt (2 seasons supporting), O'Reilly
would NOT (2 seasons opposing). No blanket rollout. The mixed tally is exactly why the gate exists.

### PRACTICE-DOMINANCE INTERIM (task #52 trigger CROSSED early via lower-series backfills) -- the signal is REAL; the "margin beats rank" half is NOT (2026-07-16)
The operator's backfills put the pooled sample over the pre-set ~75-race interim threshold months ahead
of schedule~ 86 oval practice races across THREE series (cup ~43 / trucks 18 / oreilly 25), n=2,563
driver-races, 76 WIN EVENTS (vs 40 at the 07-14 cup-only attempt). Design replicated~ win logistic,
controls corr rank + start rank + series dummies, rank and margin fitted SEPARATELY (collinearity rule).
  encoding of practice BEST LAP          z (practice term)   logL
  RANK (within race)                        -2.43            -258.2   <- best fit
  MARGIN, z-scored within race              -2.21            -258.8
  MARGIN, pooled-standardized               -2.09            -259.0
  (controls~ corr z ~ -6.2, start z ~ -3.6/-3.7 across all three)
FINDING 1 -- THE SIGNAL IS REAL. Best-lap practice speed carries WIN-market information beyond history
and grid, significant in EVERY encoding (p < .05). The 07-14 "no power" verdict resolves the right way~
z grew 1.52 -> 2.1-2.4 as the sample doubled, exactly what a true effect does and noise does not.
FINDING 2 -- THE DOMINANCE FRAMING IS WEAKENED. Margin does NOT beat rank~ plain best-lap RANK is the
best-fitting carrier at this power. "P1 by three tenths vs P1 by nothing" adds no measurable win
information over "P1". The operator's eye may still read margin, but the data says the eye's edge is
in reading BEST-LAP SPEED AT ALL (which overall_avg dilutes), not the gap size.
CONVERGENCE NOTE (the practical upshot)~ the sim-side implementation of this exact signal ALREADY EXISTS
in the pipeline -- best5 (#55). best5 is a best-lap-family metric; its composite win gains in cup+trucks
are the Brier-level expression of this regression's z. These are ONE thread now, not two. #55's
pre-registered cup gate + series-specific adoption rule remain the decision mechanism.
DECISIVE RE-RUN~ at ~130+ pooled races (projected z ~ 2.6+; ~1-2 months at three sessions/week), or
moot if #55 resolves first. Task #52 updated.

### ADDENDUM to the dominance interim: ALL FOUR MARKETS (2026-07-16)
Same pooled sample (2,563 driver-races, 3 series), same controls, rank and margin fitted separately~
  market  events   rank z   margin z     (corr z / start z for scale)
  win       76     -2.43    -2.21        (-6.1 / -3.6)
  t3       227     -1.69    -1.60        (-9.8 / -5.8)   <- NOT significant
  t5       377     -2.58    -2.22        (-11.3 / -7.6)
  t10      746     -3.91    -3.71        (-13.9 / -7.4)
READS~ (1) t10 is best-lap info's stronghold, as always. (2) The U-SHAPE~ win clears significance on
just 76 events while t3 FAILS on 227. Mechanism visible in the corr column~ podiums are the most
history-predictable outcome (corr z -9.8), so practice has nothing left to add at t3; WHICH elite car
wins is the question history cannot answer and this-week peak speed partially can. (3) Rank >= margin
on every market -- the dominance-gap framing loses uniformly, not just at win.
CROSS-INSTRUMENT AGREEMENT~ this outcome-regression silhouette (win + t10 yes, t3/t5 weak) MATCHES the
best5 composite A/B silhouette in cup and trucks. Two unrelated instruments agree on WHERE in the
finish order best-lap information lives. Strongest form of corroboration we have for the #55 candidate.

### FIRST GREEN-TRACK MEASUREMENT: the group offset is REAL, MATERIAL, and NOT CONSTANT (2026-07-16)
Chain completed same night~ operator identified the confound, parser gap found and fixed (Group column
was advertised in the UI and mapped in Admin but NEVER parsed -- commit dd27c1ba), report card group
chips were pre-built and dormant, operator re-uploaded 3 group-bearing cup 2026 sheets.
MEASUREMENT (median laps by practice group, A runs first)~
  session          nA/nB   bestLap offset (B vs A)   overall offset   top-10 best laps in A
  Darlington R6    19/18        +0.32 pct               +0.87 pct          8 of 10
  Bristol R8       19/18        +0.28 pct               +0.17 pct          7 of 10
  Charlotte R13    20/19        -0.15 pct (REVERSED)    -0.31 pct          5 of 10
VERDICTS~
1. The operator's green-track claim is CONFIRMED in 2 of 3 sessions and the effect is MATERIAL~
   0.3 pct of a lap is ~0.09s at Darlington vs typical 0.02-0.05s gaps between adjacent practice
   ranks -- group membership alone can move a driver 2-5 practice positions.
2. THE SIGN FLIPS (Charlotte) -> the correction must be PER-SESSION (shift by that session's own
   measured A-B median offset), never a fixed rule. Track evolution cuts both ways.
3. BEST5 IS THE MOST GROUP-CONTAMINATED METRIC~ 8/10 fastest Darlington laps came from one group.
   The operator's HOLD on the best5 ship (task #58) is vindicated -- part of best5's edge could be
   group luck. Group-corrected best5 is now the ship candidate.
NEXT~ operator accumulates ~8-10 group-labeled sessions -> validation~ (a) group-corrected GRADE vs raw
on Spearman-vs-finish (grade bar), (b) group-corrected best5 vs raw best5 vs overall_avg on the
composite betting markets (sim bar). Those two tests decide the grade change AND the held ship.
NOTE~ groups exist only where the source sheets carry them; many weekends are single-group -- the
correction is a no-op there by construction.

### GROUP VALIDATION AT 9 SESSIONS: the offset is mostly CAR QUALITY, not track state -- naive correction REJECTED; best5 hold RESOLVED (2026-07-16)
Operator re-uploaded 9 group-labeled cup 2026 sessions (Phoenix R4, Vegas R5, Darlington R6, Bristol R8,
Kansas R9, Texas R11, Charlotte R13, Michigan R15, Pocono R16; balanced ~19/18 splits).
OFFSETS (B vs A best-lap medians)~ mean ~ -0.18 pct i.e. ZERO on average, but HUGE variance both ways~
  A faster~ Darlington +0.32, Vegas +0.31, Bristol +0.28, Texas +0.17
  B faster~ Pocono -1.21 (0/10 top laps in A), Kansas -0.79 (1/10), Michigan -0.42, Charlotte -0.15, Phoenix -0.14
THE DECISIVE MEASUREMENT~ GROUP B OUTFINISHES GROUP A BY 8.4 POSITIONS (avg finish 14.62 vs 22.99,
n=156/155, consistent in ALL NINE races). Groups are PERFORMANCE-SORTED (faster half runs later), so
the measured lap offset ~ (real quality gap) + (track-state effect), inseparable at session level.
NAIVE CORRECTION (align group medians per session) -- REJECTED BY THE GRADE BAR~
  grade Spearman vs finish~ raw 0.381 vs corrected 0.353 (corrected wins only 4/9).
  PERFECT FAILURE PATTERN~ correction HELPED at all four A-faster tracks (Darlington 0.381->0.586!) and
  HURT at all five B-faster tracks (Pocono 0.731->0.469). Reading~ where A (the slower cars) ran faster,
  a REAL track-state effect had overpowered the quality gap -> correcting helps; where B was faster the
  offset was mostly their genuine speed -> correcting erases signal.
VERDICTS~
1. DO NOT ship any group correction now. Group chips remain DISPLAY-ONLY (still valuable~ users can see
   who practiced in the compromised window).
2. REFINED CORRECTION = future candidate~ estimate each group's EXPECTED gap from driver quality (corr
   priors), correct only the RESIDUAL (condition part). Needs more labeled sessions; design logged here.
3. BEST5 HOLD (task #58) RESOLVED~ in every composite A/B, best5 and overall_avg were computed from the
   SAME contaminated laps -- the comparison was fair and the contamination cost is already inside
   best5's measured record (4 yes / 1 wash / 2 no + regression convergence). Tonight's finding explains
   noise in that record; it does not change it. Ship decision returns to the operator as-is.
4. Group membership itself predicts finish (8.4 positions) but is quality-sorted -> almost certainly
   redundant with corr history. Do not chase as an input without a residual test.
CREDIT~ the entire thread -- groups exist, A runs first, sheets carry them -- is operator field
knowledge. Fifth operator-driven correction/discovery of the day.

### ADDENDUM (operator): practice groups are assigned by THE METRIC FORMULA (2026-07-16)
Closes the assignment question. Consequences~
1. Confirms the 8.4-position finish gap mechanism~ metric sorts by performance; better-metric half runs
   LATER (group B). Group A first = the slower-metric cars on the greenest track.
2. Group membership is a DETERMINISTIC function of pre-race data the model already holds -> it can
   never be an input (redundant BY CONSTRUCTION, stronger than the residual-test presumption).
3. The refined condition-correction is now FULLY SPECIFIED~ expected group gap ~ computable from
   metric-implied quality (the site already computes metric scores for rain-out lineups);
   TRACK-STATE OFFSET ~ measured group gap MINUS metric-implied gap. Correct only that residual.
   Runs when labeled-session count supports it; no estimation step needed.

### THE 50/50 BLEND, MEASURED (operator asked "use both as weights?") -- it is the midpoint, exactly (2026-07-16)
Three-arm cup composite A/B (overall / best5 / blend as two half-weight inputs 0.075+0.075), 40 races,
paired seeds, N16. WIN Brier by year (overall / blend / best5)~
  2024~ 26.36 / 26.40 / 26.48   (wash year -- all arms tied within noise)
  2025~ 21.91 / 21.73 / 21.59   (best5 sweeps ALL markets; blend second everywhere)
  2026~ 21.55 / 21.18 / 20.87   (best5 best on win/t10; t3/t5 cost ~1.0 for best5, ~0.5 for blend)
Favourites picked correctly across 40 races~ overall 11, blend 14, best5 14.
READ~ linear algebra delivered as promised -- the blend is the midpoint on every market in every year.
It halves best5's win gain AND halves its only cost (2026 t3/t5, which does not replicate in 2025).
No arm dominates; the choice is a risk slider~
  PURE BEST5~ maximum win-market gain (the model's strategic weakness), small place cost in one year.
  BLEND~ half the gain, half the cost.
  OVERALL~ incumbent, best t3 in 2026 only.
DECISION~ operator's, task #58. All three options now fully measured on identical races and seeds.

### REFINED GROUP CORRECTION (quality-controlled) -- IT WORKS; monotone dose-response; hold for sample (2026-07-16)
The naive median-alignment failed (see 9-session entry). The refined version~ within each labeled
session, fit best_lap/avg_pace ~ prior corr rating (leak-free priors), take each GROUP's median
RESIDUAL as the condition offset (quality removed by construction -- handles elite-cars-in-A), correct
only that. Grade bar (Spearman vs finish, same 9 sessions, prior-covered drivers only)~
  correction strength lambda~   0 (raw)   0.5     0.75    1.0 (full)
  mean grade Spearman~          0.372     0.384   0.395   0.404     <- MONOTONE, full strength best
  Per race (raw -> refined)~ Darlington .338->.571, Phoenix .319->.434, Bristol .215->.303,
  Vegas .382->.457, Texas .336->.390 improve; Charlotte/Kansas/Michigan mild losses; POCONO .711->.508
  remains the adverse outlier (condition gap measured -0.496s B-favoured even after quality control --
  either 2026 form beyond priors, or a real mid-session condition shift e.g. weather; unresolved).
CONDITION GAPS after quality control are physically believable~ Phoenix +0.143s / Darlington +0.101 /
Texas +0.097 (A-track advantage); Kansas -0.141 (B); others small.
VERDICT~ VALIDATED-PRELIMINARY, DO NOT SHIP YET~ n=9, one adverse outlier, lambda=1 partially selected
on the evaluation set (it was also the a-priori default), and the composite/sim bar is untested.
SHIP PATH~ accumulate ~4-6 more labeled sessions (NW onward; sheets carry groups when NASCAR splits),
re-run BOTH bars (grade Spearman + composite markets), ship the grader-level correction if it holds --
it is a no-op on unlabeled sessions by construction, so blast radius is only the group weekends.
NOTE~ this correction, if shipped, applies BEFORE metric storage -> cleans grades AND sim inputs
(overall_avg, best5, blend) in one place.

### !! SHIPPED !! BEST5 IS THE SIM PRACTICE INPUT FOR CUP + TRUCKS (2026-07-16, operator decision)
OPERATOR CALL, EXPLICITLY SUPERSEDING THE #55 PRE-REGISTERED GATE~ "lets go with best 5 and ship the
changes to the sim now. lets not wait I think weve seen enough. we went as far back as we could with
all the practice data we have." He is right that the retrospective well is dry~ every year-series with
practice data has been tested at the composite level (cup 24/25/26, trucks 25/26, oreilly 25/26), the
blend was measured (exact midpoint), and the group-contamination concern was resolved (fair to both
arms). Evidence at ship time~ win-market tally 4 yes / 1 wash / 2 no; favourites 14/40 vs 11/40;
outcome-regression convergence (best-lap rank z -2.43 win, -3.91 t10); known cost ~1 Brier t3/t5 in
cup 2026 only (did not replicate in 2025).
SHIPPED (bundle main.987b9eaa.js)~
  practiceGrader.js `409e5c72`~ computes best5 (mean of 5 fastest laps, latest session) for ALL series;
    stored on every upload from now on.
  Admin.js `74c799de`~ stores practice_sessions.best5 (SQL column operator-run).
  SimulationCenter.js `c5d34fa1`~ lrpTime ~ best5 for cup+trucks, FALLBACK overall_avg when best5 null;
    O'REILLY STAYS overall_avg (its own two seasons said no). config now stamps practiceMetric on every
    published board -- the live-verification hook.
LIVE VERIFICATION (replaces #55's role)~ weekly grading now accrues the shipped model's record with
practiceMetric stamped per board. REVIEW at ~6 graded cup/truck boards~ if win-market grades degrade
vs the season's pre-ship baseline, REVERT is the one lrpTime line.
NOTE~ sessions uploaded BEFORE this ship have best5 NULL -> sims on them use the fallback (identical to
pre-ship behaviour). Friday uploads onward carry best5 natively. Re-upload any current-week session to
activate best5 for it immediately.

### GROUP CORRECTION, COMPOSITE BAR: PASSES -- corrected best5 beats raw in ALL 24 CELLS (2026-07-16, night 2)
Completes the two-bar validation the refined-correction entry required. Same 9 labeled races, shipped
config (best5 practice input), paired seeds, quality-controlled condition correction (lam 1) applied to
best5 values before normalization~
  N16~  raw win 20.33 / t3 54.4 / t5 75.0 / t10 125.0
   corrected win 20.29 / t3 54.1 / t5 74.5 / t10 124.2
  Same uniform direction at N13 and N19 -- corrected wins EVERY market at EVERY noise (24/24 cells);
  favourite hit 5/9 both arms. Gains small (0.2-0.9 pct rel) but with zero contrary cells.
STATE OF THE CORRECTION~ grade bar +0.032 Spearman (monotone in lambda), composite bar 24/24 -- both
instruments agree at n=9. Implementation note~ the natural home is SIM-SIDE (SimulationCenter already
holds corr priors + practice rows; correct prac values when practice_group present -- ~20 lines,
NO-OP whenever labels are absent). Grade-side (report card) needs priors at upload time -- separate,
later. Ship/hold = operator's call; the logged hold-for-more-sessions plan remains the conservative
default, the 24/24 uniformity is the case for shipping now.

### !! SHIPPED !! GROUP CONDITION CORRECTION, SIM-SIDE (2026-07-16, operator; second model change of the day)
SimulationCenter `cc0e12e1`, bundle main.344a1ecc.js. __groupConditionCorrect(drivers) runs before
setRawDrivers~ when fetched practice rows carry A/B practice_group labels, fits lrpTime ~ corrAvgRating
within the session (leak-free quality control), subtracts each group's centered median residual (the
track-state component). NO-OP when labels absent / one group / field < 20. Applies to whatever practice
metric feeds lrpTime (best5 now, per the earlier ship).
EVIDENCE AT SHIP~ grade bar +0.032 Spearman monotone in lambda; composite bar 24/24 cells; mechanism
measured (metric-formula group sorting + track-state offsets up to 1.2 pct, sign varies by session).
Caveats accepted by operator~ n=9 labeled sessions, lambda 1 partially selected in-sample. LIVE
VERIFICATION rides the same practiceMetric-stamped grading loop as best5; labeled weekends only.
REPORT CARD UNCHANGED~ grade-side correction (which WOULD re-rank condition-flattered grades, per
operator's question) is a separate validated-pending project -- needs priors at upload time.
OPERATOR LABELING PLAN~ forward labels priority (live benefit + verification); historical backfills
casual (sharpen the ~15-session lambda re-check).

### !! SHIPPED !! GRADE-SIDE GROUP CORRECTION -- the report card now re-ranks condition-flattered grades (2026-07-16, third model-adjacent ship of the day)
practiceGrader `a9a6029b` + Admin `dbdf15e5`, bundle main.d87e3697.js.
HOW IT WORKS~ when an uploaded sheet carries A/B groups, Admin fetches LEAK-FREE prior corr ratings for
the parsed drivers (group-scoped, age-weighted, races strictly before the uploaded race's date when the
Race# resolves -- proper for backfills too), passes them to gradePracticeSession. The grader ranks the
composite on condition-corrected COPIES (__gcAvgPace/__gcBestLap/__gcOverallAvg~ fit metric ~ prior
within session, subtract each group's centered median residual). STORED METRICS STAY RAW -- the sim
applies its own identical correction at sim time; no double counting. FAIL-OPEN everywhere~ any error,
missing priors (<20 matched), single group, or unlabeled sheet -> grades identical to uncorrected.
EFFECT~ exactly the operator's ask~ a driver who graded A because his group had the favourable track
comes down; a driver punished by the slow-track group comes up -- per session, only where labels exist.
Grades recompute ON UPLOAD (standing rule)~ existing stored grades change only when a session is
re-uploaded; the preview shows the corrected ranking at file-select time.
VALIDATION carried~ grade bar +0.032 Spearman monotone (264d9d6b), sim composite 24/24 (f2267c17).
LIVE REVIEW~ rides the labeled-weekend grading loop with the sim-side correction; lambda re-check at
~15 labeled sessions still stands.

### REVIEW RECIPE -- BEST5 LIVE VERIFICATION (self-contained; executable by ANY session or the operator alone) (2026-07-16)
The operator may lose Fable access. This recipe is the complete review; no other context needed.
TRIGGER~ >= 6 graded CUP or TRUCK boards published after 2026-07-17 (these carry config.practiceMetric
= 'best5'). O'Reilly boards are NOT part of this review (they still run overall_avg by design).
DATA~ sim_grades rows (one per graded board)~ columns series, stage, graded_at, metrics, ev_flags, roi,
config. The practiceMetric stamp lives in the board's config json (sim_grades.config; if absent there,
join sim_results by sim_id and read sim_results.config). Boards WITHOUT the stamp are PRE-SHIP.
COMPARISON (prefer stage 'post' boards -- the model's real face)~
  cohort A~ pre-ship cup+truck boards (graded before 2026-07-17, no practiceMetric stamp)
  cohort B~ post-ship cup+truck boards (practiceMetric ~ 'best5')
  compare per cohort~ (1) win-market results in roi json (roi.win.profit / roi.win.bets) and any
  win/t10 Brier fields present in metrics json; (2) exwin ROI as the place-market check.
OPERATOR-RUNNABLE SQL (Supabase SQL editor)~
  SELECT series, stage, graded_at, config->>'practiceMetric' AS pm,
         roi->'win' AS win_roi, roi->'exwin' AS exwin_roi, metrics
  FROM sim_grades
  WHERE series IN ('cup','trucks')
  ORDER BY graded_at;
DECISION RULE (fixed now, from the pre-registered predictions)~
  PASS~ cohort B win-market results >= cohort A's (Brier lower and/or win ROI not worse), t10 same-or-
        better, exwin ROI within ~2 pct rel of cohort A. -> best5 stays; log the review.
  FAIL~ cohort B win-market clearly worse across >= 6 post boards. -> REVERT~ in SimulationCenter.js
        find the line containing "lrpTime:" and "prac.best5" and replace with~
        lrpTime:       prac ? parseFloat(prac.overall_avg)    || null : null,
        (one line; also remove or keep the practiceMetric stamp -- keep, set to 'overall_avg').
        Log the reversion referencing this entry.
  SMALL N HONESTY~ 6 boards is a screen, not a proof -- only act on CLEAR degradation; re-review at 12.
GROUP-CORRECTION REVIEW RIDES ALONG~ among cohort B, compare boards from GROUP-LABELED weekends vs
unlabeled (labels visible in practice_sessions.practice_group for that race). Same pass/fail logic;
revert ~ remove the __groupConditionCorrect(drivers) call in SimulationCenter (one line).
LAMBDA RE-CHECK~ at ~15 labeled sessions total, re-run the refined-correction validation (design in the
2026-07-16 entries~ fit metric ~ prior corr rating within session, group median residual, grade Spearman
+ composite bars). If lambda 1 no longer optimal, adjust in __groupConditionCorrect.


---

## 2026-07-17 — !! SHIPPED !! GRADE COMPOSITE SPEED HALF: bestLap -> best5 (ALL THREE SERIES)

**Question (operator):** sim now uses best5 — should the report card grade off best5 too? And is best5 better than overall_avg? Anything else worth adding to the grade formula?

**Design:** 70 labeled sessions (23 cup / 23 oreilly / 24 trucks; every practice session with a completed race and >=15 drivers matched to finish). best5 computed from practice_laps (mean of 5 fastest laps, all laps considered) for the 96 sessions predating the best5 column. Metric = per-session Spearman(grade order, race finish order), averaged by series. Stored avg_pace/best_lap/overall_avg used as-is (raw, matching what the grader ranks pre-correction).

**Composites (avg Spearman vs finish):**

| variant | cup | oreilly | trucks |
|---|---|---|---|
| v0 CURRENT: avgPace50/bestLap50 | 0.320 | 0.492 | 0.482 |
| v1 SHIPPED: avgPace50/best5-50 | **0.338** | **0.522** | **0.491** |
| v2 best5-50/overallAvg50 | 0.335 | 0.518 | 0.502 |
| v4 ap+b5+oa thirds | 0.321 | 0.512 | 0.498 |
| v5 ap+b5+consistency thirds | 0.283 | 0.455 | 0.423 |

Per-session head-to-head v1 vs v0: **W47 / L23** (sign test z ~ 2.9, p ~ 0.004). v2 is a statistical tie with v1 (W50/L20 vs v0) — not enough to justify dropping the avgPace component; one-metric swap kept.

**Singles (avg Spearman):** best5 is the strongest single practice metric: cup .332 / oreilly .508 / trucks .484, beating bestLap everywhere (.295/.454/.467) and overall_avg in cup+oreilly (.280/.476; trucks tie at .492). Flyer-lap noise is the mechanism: best5 is the same speed signal with 5x the laps.

**Rejected candidates:** consistency (lap stdev) has ZERO standalone signal (-0.007/.004/.055) and actively hurts as a third component (W16/L54) — validates its earlier removal from the display. best_stint dominated by best5 everywhere. Three-way blends dilute (b5 and oa overlap). long_run promising (0.405 with n=4 cup sessions) but far too thin — REVISIT when ~20+ sessions store it.

**Doctrine note:** oreilly IMPROVES under best5 for GRADING even though the sim kept overall_avg there. No conflict: sim adoption was judged on win-market ROI, grading on finish correlation — different objectives, different winners. Grade uses best5 in ALL THREE series.

**Shipped (commit 24584c71, bundle verified via __gcBest5 literal):** practiceGrader.js — speed half of the composite ranks best5 (fallback chain b5S -> blS -> 50 for short sessions); group condition correction extended with correctKey('best5','__gcBest5') so A/B sessions correct the ranked copy; STORED metrics stay raw (sim still applies its own correction — no double count). Report card subtitle + Grade tooltip updated to v4 wording (commit 8c27bd7b). Best Lap COLUMN unchanged (still displays raw fastest lap).

**Operator action:** re-upload North Wilkesboro trucks practice (uploaded pre-ship) to regrade under v4. Older stored grades regrade only on re-upload.


---

## 2026-07-17 — !! BUG FIX !! CORR POOL CUP LEAK (regression from b2c916e8, 2026-07-08)

**Symptom (operator):** NW trucks post board had Hocevar at 6.8% win (fair +1371) vs market +450/+700, despite P2 start and best5 rank 3 in practice.

**Root cause:** commit b2c916e8 ("Wire crossover borrow into corr rating", 07-08) widened the corr-pool loop fetch to include cup AND changed the base-pool filter to (series ~ own OR series ~ cup). Intended design: cup history enters ONLY via the explicit crossover_borrows table (1 active row: Chase Elliott, forced by operator). Actual behavior since 07-08: raw cup rows at corr-group tracks silently blended into EVERY driver's base pool — rating, avgFin, AND winConv (cup wins counted toward truck win conversion, e.g. Bell).

**Case study (NW trucks, Short & Flat pool):** Hocevar truck-only pool 96.2 (won Richmond '23, 4th NW '23, ratings 116-122) vs cup short-flat 73.7 across 28 rows at 1.3-2.0x recency weights -> blended 78.8 fed to sim (below Honeycutt 83.9). Rockingham NOT in pool (initially suspected, exonerated). Market +700 ~ the pool you get with the #54 borrow offset (+29 on cup rows -> 101.2), i.e. the market was pricing the correctly-translated number. NOTE: raw-cup contamination is NOT a valid borrow — it applies offset 0 (wrong per #54 research) and fires on unforced drivers.

**Fix (4e92f3d6, bundle verified):** baseRows filter back to OWN-SERIES ONLY. Fetch still includes cup (needed for srcRows), explicit borrow path unchanged (srcRating computed from rows by source series, blend per crossover_borrows). Config now stamps poolScope: 'series-only' on every published board (live-verification hook alongside practiceMetric).

**Blast radius:** trucks/oreilly boards published 07-08 -> 07-17 with cup-crossover drivers in field. Cup boards unaffected (filter was a no-op there). Sim_grades from that window: practice-grade side unaffected (grader does not use corr pools' cup rows... grader priors DO use corr-group loop_data via Admin gcPriors fetch — that fetch is series-scoped, verified unaffected). Operator re-ran + republished NW trucks post board same night.

**Open question rolled into #54:** the market-aligned Hocevar number under offset +29 is one more data point that the borrow translation is roughly right for win markets — but Elliott (+29 would say ~12% vs market ~6%) cuts the other way. Re-test on schedule.


---

## 2026-07-17 — !! SHIPPED !! PAIRING-FIRST BORROW (operator-directed calibration, 5755e02a)

**Context:** post cup-leak fix, Bell sat 5th on the NW trucks board (fair +1182) vs FD +340. Diagnosis: his borrow (w=1) substituted RAW cup short-flat rating 101.2 for his truck evidence — no series translation. But blanket +29 offset overshoots (Elliott counterexample) and #54 win-validation is still HOLD.

**What shipped instead — pairing evidence:** when a FORCED borrow driver has >= 2 current-season rows in the sim's own series, srcRating ~ mean driver_rating of those rows (driver x equipment measured jointly), overriding the raw-cup path. Fallback unchanged otherwise. Fires ONLY inside crossover_borrows (operator-gated; 2 active drivers). Config stamps borrowMode: 'pairing-first'.

**Evidence for the design (62 truck case):** Halmar #62 without Bell 2022-26: ratings 30-92, avg fin 20s (Slimp 32-38, Bodine 44, Roper 30). Bell in it 2026: n4, avg rating 109.7, fins 6/1/5/6 (Bristol WIN). Org-history equipment terms are structurally wrong here — the operator's insight: elite ringer arrival CAUSES equipment effort (endogenous). Pairing rows sidestep the decomposition entirely.

**Expected effects:** Bell srcRating 101.2 -> 109.7 (Majeski/Riggs tier, NOT favorite — pairing data does not support the raw +29's 130.2). Elliott: only 1 career truck row -> rule doesn't fire -> unchanged. Everyone else: unchanged.

**Honest status: NOT backtest-validated** — operator-directed, low blast radius (borrow-gated), replaces a known-mistranslated input with directly-relevant measurements. Full ringer-borrow validation (incl. this design vs +29 offset vs raw) stays queued as #54, end of 2026. Market note logged: truck win markets shade cup stars short (name tax) — FD +340 on Bell is part fair price, part public-money shading; fair likely between +340 and the old +1182.


---

## 2026-07-18 — TRACK-HISTORY SHRINK TARGET: shrink-to-corr REJECTED (keep neutral-50)

**Hypothesis:** the track-history term shrinks thin samples toward field-neutral 50; shrinking toward the driver's own corr score seemed more coherent ("absent track evidence, assume he's as good as at similar tracks"). Would have lifted strong drivers with thin track history (Bell/NW archetype).

**Design:** leak-free chronological walk over all loop_data (14,287 rows, 3 series, 2022-2026). Per race: corr prior (own-series group pool, >= 3 prior races, age-weighted) + track prior; composite at deployed weight ratio (corr .35 / track .20 renormalized); tConf ~ min(1, nTrack/4) exactly as shipped. V0 shrinks track term to field mean, V1 to driver's corr prior. Scored per-race Spearman vs finish (348 races) + pooled percentile analysis on thin-track (nTrack < 4) drivers.

**Results:** V1 ahead by noise-level margins everywhere: cup .390 -> .391, trucks .512 -> .513, oreilly .492 -> .495; race head-to-head W155/L125 (p ~ .07). Thin-subset pooled corr .474 -> .476. Below every bar we ship on.

**The decisive cut — calibration on ELITE-corr + thin-track driver-races (n=2,041):** predicted finish percentile ~ .14 under BOTH variants; ACTUAL mean finish percentile .342. The composite already over-predicts strong drivers at unfamiliar tracks, and shrink-to-corr makes it MORE aggressive (.139 vs .142) — wrong direction. Mirror on weak-corr side (predicted .88, actual .69). Neutral-50 is a partial correction for genuine regression-to-field at unfamiliar tracks, not a lazy default. KEEP AS IS.

**Caveats logged:** thin-track subset is mostly rookies/part-timers, not cup ringers specifically (ringers too rare to isolate); elite over-prediction partly reflects finish-position wreck asymmetry (elites lose more percentile to DNFs than they can gain), not purely track-newness — a controlled comparison vs thick-track elites would be needed before building any "newness penalty" term. Not pursued tonight.

**Doctrine note (Bell, NW 2026):** the outside view (base rates) sides with the sim's skepticism about elite-form/thin-track drivers, against market consensus. Operator eq_override remains the channel for inside-view information (All-Star win, equipment) — with the season ledger (market vs sim vs override) as the eventual judge. Config stamps (practiceMetric, poolScope, borrowMode, eqOverrides) make all three auditable per board.


---

## 2026-07-18 — ADAPTIVE PRACTICE WEIGHT (thin-history drivers): REJECTED — ratio is constant

**Hypothesis (operator-motivated, Bell/NW):** practice should carry MORE weight for drivers with thin corr history (practice ~ most of the real information about them). Would lift elite-practice/thin-history drivers via evidence.

**Design:** leak-free walk-forward corr priors (own-series group pools, >= 3 prior races, age-weighted) joined to practice best5 percentiles and finish percentiles across all labeled sessions (2,810 driver-races in races with >= 15 qualified drivers). Pooled 2-var OLS finishPct ~ b5Pct + corrPct, split by corr-history depth.

**Results:**

| history band | n | practice coef | corr coef | ratio corr:practice |
|---|---|---|---|---|
| thin (<8 corr races) | 417 | 0.177 | 0.509 | 2.88 |
| mid (8-24) | 884 | 0.125 | 0.419 | 3.35 |
| thick (25+) | 1,509 | 0.136 | 0.391 | 2.87 |

BOTH signals are stronger for thin-history drivers (their quality spread is wider), but the corr:practice RATIO — what the weights encode — is essentially constant (2.88 vs 2.87 thin vs thick). Reallocating weight from corr to practice for thin drivers trades the stronger signal for the weaker one. The global fixed ratio is validated; adaptivity adds nothing. (Deployed 0.35/0.15 ~ 2.33 is modestly practice-heavier than fitted ~2.9 — other composite terms absorb the difference; no change recommended.)

**Accrual note:** thin band n=417 only; the elevated practice coef (0.177) is worth a re-look when truck/oreilly practice sessions accrue (pair with #52-style re-runs).

**Bell postscript:** with this, every principled path to lifting him has been tested tonight: cup leak (fixed, real bug), borrow translation (pairing-first shipped), track-history shrink target (rejected), adaptive practice weight (rejected). The sim's number stands on evidence; residual disagreement with market consensus is inside-view information -> operator override channel.


---

## 2026-07-18 — PRACTICE WEIGHT RE-SWEEP UNDER BEST5: 0.15 RECONFIRMED (operator catch)

**Operator question:** the 0.15 practice weight was closed BEFORE best5 replaced overall_avg as the input — a better signal could justify a bigger weight. Legitimate gap: the best5 promotion tests held weight fixed.

**Design:** walk-forward corr priors (as in tonight's other tests) + best5 percentiles; two-term predictor (1-w)*corrPct + w*b5Pct, w swept 0.10-0.50; per-race Spearman vs finish. Deployed corr:practice 0.35:0.15 = practice share 0.30.

**Results (avg Spearman by practice share):** cup (40 races) flat plateau .15-.35 (~.446-.449, peak .20, deployed .30 -> .447); trucks (24) plateau .20-.35 (~.524-.526, deployed .30 -> .525, at optimum); oreilly (24) peaks at .15 (.609 vs deployed-share .602 — slightly practice-LIGHT preference, consistent with all prior oreilly evidence). All series degrade sharply past .40.

**Verdict:** better input raised the whole curve, did not move the optimum. 0.15 stands for cup+trucks under best5. Oreilly hint (lighter practice) noted but oreilly's sim input is overall_avg anyway — no action. Caveat: two-term proxy (start/track omitted), same design class as the original closure. Weight question CLOSED again, now metric-consistent.


---

## 2026-07-18 — !! SHIPPED !! MINOR-SERIES RECENCY BUMP (042a4dd4) + DNQ FIELD FILTER (a4cab1f0)

**Recency (Honeycutt case):** current-season weight in CORR pools swept 1.5-6.0 in the walk-forward harness. Trucks rise monotonically to ~4.0 (.512 -> .517), oreilly mildly agrees (.495 -> .496), cup mildly prefers LESS (.394 at 1.5). Head-to-head trucks+oreilly cw4 vs cw2: W82/L56 T60 (p ~ .03). SHIPPED cw = 3.0 for trucks+oreilly (middle of plateau, avoids the 4.0 peak), cup stays 2.0. Mechanism: winter ride churn makes minor-series history decay faster. ALSO: all three age ladders (corr, car/equipment, track) were frozen to "yr >= 2026" — would silently misweight in 2027; converted to RELATIVE ages (identical behavior today; matches how every backtest computed them). Car + track ladders keep cw 2.0 (untested for the bump). Config stamps recencyCw (2 cup / 3 minors). NOTE: barely moves Honeycutt himself (1 short-flat 2026 row) — fleet calibration, not a single-driver fix. Honeycutt market verdict logged: DK +600 rich (misattribution: the "fast #11 at NW" 2023-25 was Corey Heim driving it — led 75/66/162 laps; Heim now in the #5), FD +850 ~ fair-if-you-buy-the-breakout, our +1718 too long; truth ~ +1000; no bet.

**DNQ filter (Huffman/Timmy Hill/Schafer case):** sim field was ALL entry_list rows — DNQ'd/no-show entries kept getting simulated placements. v1 keyed on qualifying_results (wrong: NW trucks has ZERO quali rows; lineup lives in practice_sessions.qualifying_position — "practice fallback"). v2 SHIPPED: once >= 20 drivers have a start position from ANY source, drivers with NO start position are dropped from the sim field. Catches marked DNQs (null start) AND forgotten ones (Schafer: entry_list only, no practice row). Pre-lineup sims unaffected (few/no starts known -> keep all).


---

## 2026-07-18 — PRE-RACE BASELINE: NW trucks R15 — four forecasters on the record

Published post board (16:10 UTC; stamps: best5 / series-only / pairing-first / cw3; equipment-infl dials: Bell 1.5, Honeycutt 1.5, Eckes 1.0, Garcia 0.5, Queen 0.5, Annunziata 0.05, Heim/Majeski/Riggs/Hocevar 0 — operator-tuned equipment-delta influence, ride-changers up, established rides muted) vs competitor Monte Carlo (Google Sheet) vs market:

| driver | PitBoard win% | competitor win% | market implied% |
|---|---|---|---|
| Heim P4 | 17.9 (our fav) | 10.1 | 22.2 |
| Riggs P1 | 13.2 | 25.7 (their fav) | 16.7 |
| C. Smith P9 | 10.3 | 3.0 | 6.7 |
| Hocevar P2 | 9.8 | 14.5 | 15.4 |
| Bell P3 | 9.8 (fair +920) | 6.4 | 23.3 |
| Honeycutt P7 | 6.8 | 4.5 | 14.3 |

**Convergent skepticism:** two independent sims both far UNDER market on Bell (9.8/6.4 vs 23.3) and Honeycutt (6.8/4.5 vs 14.3) — the market premium on those two is narrative (name tax + #11-truck misattribution), not model-recoverable signal. **Structural contrasts:** competitor more concentrated (top-3 win share 50.3% vs our 41.4%), their bet ~ Riggs dominance (46.6 proj laps led from pole); our bet ~ Heim + C. Smith (track history: Smith won NW '25 — they price him 3.0% with 18.6% DNF). Boards agree broadly otherwise (win rank corr .718, projFin .722, laps-led budgets 235 vs 238 of ~250). Their DK projections ~40% below ours on identical finish/led — likely different/incomplete DK scoring, not a race-model difference. **Race result grades: our board, their board, the books, and the operator dial settings.**

**DK gap DIAGNOSED (addendum):** both boards define DK as avg points scored per sim (ours: dkFinishPts + placeDiff + led*0.25 + fastLaps*0.45). The ~40% gap is their FASTEST-LAP engine: their sheet projects ~0.05 fast laps per driver (~1 lap total across 36 trucks) vs the ~250 that must be scored (112.5 DK pts field-wide). Heim reconciles exactly: our 53.6 minus our 18.3 fast-lap pts ~ 35 ~ their 32.4. Their DFS projections systematically underweight dominators at short tracks; ours distributes the full fast-lap budget (235-250 laps). Competitive edge noted for the DFS product.


---

## 2026-07-18 — !! SHIPPED !! DK PROJECTION ACCURACY TRACKING (77c6b4db) + first retro readings

**Operator ask:** compare projected DK scores to actuals every race. Verified both sides use the same definition first (avg DK per sim: finish pts + place diff + led*0.25 + fastest*0.45; place table 45/42/41...).

**Shipped (GradeCenter.js):** loop-data grading path now computes actual DK per driver (widened select to start/led/fastest laps) and stores metrics.dk ~ { n, mae, bias, corr, spearman } in every sim_grades row. Paste-finish path skips DK (no lap data). Threshold n >= 10 matched drivers.

**Retro baseline (only 2 completed boards, BOTH superspeedways):** oreilly Atlanta R21: corr -0.224, MAE 23.1, bias +1.2. cup Atlanta R20: corr 0.167, MAE 20.0, bias +0.5. Read: level calibration good (bias ~ 0), ordering destroyed by SS wreck lottery — expected worst case; NOT representative. NW trucks R15 will be the first intermediate/short-track reading via the new automatic path.

**Review guidance for future sessions:** track dk.corr and dk.bias by track type as grades accrue; SS races will drag corr toward 0 regardless of model quality — judge short/intermediate tracks separately. Competitor context (same day): their DK projections omit fastest-lap points entirely (~0.05 laps/driver projected) — our full fast-lap budget is a structural DFS edge worth protecting.


---

## 2026-07-18 — !! SHIPPED !! CLV TRACKING (odds snapshots 06d5be47 + grade metrics 30b50e2a)

**Problem (operator):** re-simming up to race time means repasting odds; each paste overwrote the last, so no record of the closing line -> no CLV measurement on published edges.

**Insight:** the operator's habit IS the capture mechanism — the last paste before green flag ~ the close. Ship: stop discarding pastes.

**Shipped:** (1) SimulationCenter — every distinct odds paste inserts a timestamped snapshot to odds_snapshots (new table, SQL run by operator): driver x market (win/t3/t5/t10) x book (dk/fd/hr), debounced 4s, deduped by content hash, keyed to series/track/year/race#. (2) GradeCenter — grading now fetches the LAST snapshot cluster (10-min window ending at the newest row) as the closing line and stores metrics.clv ~ { plays (count of +EV flags at publish), playsAvgPct (avg CLV% on those plays, published best-book odds vs same-book close), playsPosPct (share beating the close), fieldAvgPct, fieldN }.

**Interpretation doctrine:** CLV converges far faster than ROI (~dozens of races, not hundreds). playsAvgPct persistently > 0 -> published edges beat the close -> real edge even through result variance. playsAvgPct ~ <= 0 with positive fieldAvg -> our flags are the market's steam, not ahead of it. OPERATOR HABIT: paste freshest odds + Run one final time at the green flag (no publish needed) — that snapshot is the official close.

**Coverage note:** snapshots begin 2026-07-18; NW trucks R15 will have a thin closing record (post-ship pastes only). First fully-covered weekend is next week.


---

## 2026-07-18 — !! SHIPPED !! PIT CREW TERM (task #46 PASSED — first new validated model input since best5)

**Six years of waiting on pitcrewranks ends here.** Test run same-day on the operator's fresh raw-telemetry corpus (pit_stops: 367 usable races, 73,923 stops, 2022-2026, all 3 series).

**Design (leak-free walk-forward):** crew metric = median 4-tire box_time per CAR per SEASON from strictly prior races (>= 5 timed stops; delete-then-insert corpus; raw seconds, never pooled across series). Within-race percentile vs finish percentile, residual to the walk-forward corr prior. 9,813 driver-races.

**Signal test (OLS finishPct ~ corrPct + crewPct):**

| cut | n | crew coef | t | corr coef | t |
|---|---|---|---|---|---|
| cup | 4,982 | 0.068 | 3.93 | 0.356 | 20.7 |
| trucks | 1,758 | 0.103 | 3.85 | 0.440 | 16.4 |
| oreilly | 3,073 | 0.142 | 5.44 | 0.391 | 15.0 |
| Short-Flat | 2,728 | 0.052 | 2.28 | 0.515 | 22.4 |
| Intermediate | 4,430 | 0.107 | 5.27 | 0.394 | 19.4 |
| Superspeedway | 1,085 | **0.111** | 2.80 | 0.068 | 1.7 |
| Road | 1,570 | 0.092 | 3.41 | 0.383 | 14.2 |
| POOLED | 9,813 | 0.095 | **7.54** | 0.386 | 30.6 |

Positive and significant EVERYWHERE. Headline: at superspeedways the crew term is STRONGER than driver history — pit road is a skill expression that survives the plate lottery (dovetails with the ringer-floor and SS-noise findings).

**Weight sweep (per-race Spearman, crew share of the corr+crew pair):** plateau at 0.15-0.25 in all three series (cup best 0.20, trucks 0.15, oreilly 0.25); head-to-head share-0.2 vs 0: W171/L136 (p ~ .046). Fitted OLS ratio 0.095/0.386 ~ 0.25 agrees. Implied sim weight ~ 0.085; SHIPPED AT 0.06 (deliberate ~30% first-season shrink, winConv precedent).

**Shipped (8bab6b69, bundle verified):** SimulationCenter — pitCrew: 0.06 in ALL FIVE weight profiles (signal significant in every group; renormalized via wTotal so ratios of other terms unchanged); sim-time fetch computes current-season median 4-tire box_time per car from pit_stops (>= 5 stops, else neutral 50); new 'Pit' breakdown column (auto-hides if weight zeroed); config stamps pitCrew: 'v1-0.06'. Crew keyed by CAR — ringers correctly inherit the truck team's crew.

**Review hooks:** boards stamp pitCrew version; #55-style live check applies. SS weight upside (their 0.111 vs flat 0.06) is a deliberate conservatism — revisit with the ringer/SS items end of 2026. NOTE pit_stops must stay loaded weekly (operator runs the .bat post-race) or current-season medians go stale — falls back to neutral harmlessly if not.


---

## 2026-07-18 — FIRST LIVE GRADE OF THE NEW-MODEL ERA: NW trucks R15 (winner: Chandler Smith — flagged and CASHED)

**#55 counter starts: graded board 1 of ~6.** The stamp chain works live — the post grade carries practiceMetric best5 / poolScope series-only / borrowMode pairing-first / recencyCw 3 (pit crew shipped after this board published; first pit-stamped board is next).

**Pre (Wed, pre-overhaul) vs Post (race-day, all of today's ships):** spearman_pf .608 -> .696, projFin MAE 7.44 -> 6.24, win Brier .0256 -> .0254, t3 .0721 -> .0681, t10 .1539 -> .1470 (t5 only pre-favoring cell .1114 vs .1172). Every structural change shipped today made the same board better against the same race.

**ROI — the discipline story:** pre board flagged 24 plays into soft midweek prices: -19.75u (-82%). Post board, against sharp post-quali prices, flagged FOUR: +13.3u (+332%), anchored by Chandler Smith WIN at book +1200 — the board's largest stated disagreement vs both the market (~7%) and the competitor MC (3.0% w/ inflated DNF; our 10.3% via the track-history term: he won NW 2025). Operator beat the board's price and got +1400. One race proves nothing; a flagged 11-1 winner is still a hell of a first row.

**DK accuracy, first short-track reading:** corr .536 / spearman .512 / MAE 15.0 / bias +0.31 (n35). Confirms the Atlanta near-zero corr was SS variance, not model failure — on a short track the DK projections rank the field properly with near-perfect level calibration. Competitor's missing fast-lap engine remains a standing DFS edge.

**CLV: absent this race (expected)** — snapshots began mid-afternoon; first full CLV row accrues next weekend once the paste-Run-at-green habit is in effect.


---

## 2026-07-22 — !! SHIPPED !! MCJ INCIDENT BUNDLE: edge gate, market anchor (VALIDATED), ringer exclusion, caution auto, P-R-P guards

**Incident:** IRP trucks pre board flagged Michael Christopher Jr (1 career start) as t3/t5 VALUE. Root causes, in layers: (1) the 62's short-flat equipment pool was 100 PCT Christopher Bell rows (97.1 — his NW+Bristol) feeding MCJ's thin-history fill (the operator's Bell/62 endogeneity insight, now a live bug); (2) with equipment zeroed, the NEUTRAL ignorance fill still overrates unknowns at longshot prices. Operator product ruling: value flags on data-thin drivers destroy credibility. Board republished clean before grading — nothing bad logged.

**Ship 1 — EDGE confidence gate (62417f84, flagGuard 'conf-v1'):** ev/medge flags require >= 5 corr-group races OR practice data present. Prices/probs still display; the VALUE claim is gated. Fail-open if fields absent.

**Ship 2 — MARKET ANCHOR for thin drivers (13f3754d, marketAnchor 'v1'), operator-proposed + BACKTESTED same day:** the ignorance fill (previously neutral 50) becomes the de-vigged win-odds field percentile. Fill priority: equipment (when valid) -> market -> 50. Confidence-weighted: full-data drivers get ZERO market influence (independence where edge lives — the anti-SpeedGeeks doctrine: market speaks only in our silence; flags mean OUR DATA disagrees with the price). VALIDATION (salary proxy, cup 2026, 44 thin driver-races): thin drivers actually finish 73.7 pctile; neutral predicts 50.0 (6-sigma level miss); market predicts 70.2; MAE .204 vs .282; pooled corr .43; within-race thin-cluster ordering .40. Re-test on real odds once odds_snapshots accrue (~15 races).

**Ship 3 — RINGER EXCLUSION from car equipment pools:** rows by active crossover-borrow drivers (Bell, Elliott) excluded from loopByCar — pairing doctrine: those rows measure driver x equipment jointly, not what the car gives a journeyman. Kills the Bell/62 class of ghost value at the root.

**Ship 4 — CAUTION AUTO-PRESET:** nearest calibrated preset (Low/Medium/High anchors only — noise calibration untouched) from track+series races.total_cautions (>= 2 races, non-exhibition; corr-group fallback; superspeedways pinned). Note displayed in panel; manual clicks override. Measured spread: truck tracks 3.5-11.0 avg cautions (IRP 5.5 -> Low); all series-tracks 0-14.

**Ship 5 — P-R-P PUBLISH GUARDS:** publishing with empty odds boxes -> confirm (tonight's blank Market Value cause: page remount cleared unpersisted odds text between paste 04:05 and publish 04:13); odds changed since last Run -> confirm (market anchors + flags reflect old odds). New operator rhythm: PASTE -> RUN -> PUBLISH.

**Doctrine addition:** market-as-ignorance-prior is IN (validated, confidence-bounded); market-as-calibration-target stays OUT. A flag now always means: the model has data AND that data disagrees with the price.


---

## 2026-07-22 — MARKET ANCHOR v1.1 -> v1.3 (same-night iteration, operator-driven QA)

The v1 anchor shipped correct in principle and wrong in two particulars; the operator's screen-reading found both within the hour. Final state:

- **v1.1 (dfe6a66b) all-fills:** v1 anchored only the corr-history slot (~34% of score); pre-practice/pre-quali thin drivers kept neutral-50 in practice/start slots -> t3/t5 stayed inflated. v1.1: thin drivers (gate def: <5 corr races AND no practice) use the market anchor in ALL ignorance fills.
- **v1.2 (b87407d4) log-prob scale:** rank-percentile spread the co-priced +10000 longshot cluster uniformly (MCJ's anchor came out 51 — the ALPHABET set it). Ratings ~ linear in log win-prob -> anchor = log-prob min-max (co-priced drivers get co-equal anchors; favorites 100).
- **v1.3 (92eda3ba) track fallback:** thin drivers' track-history ignorance also anchors to market. CROSS-REF: shrink-to-corr for ESTABLISHED drivers was tested and REJECTED 07-18 (regression-to-field at unfamiliar tracks is real) — the code comment warns future sessions not to "fix" the 50 to HIST for established drivers.
- **Breakdown honesty marker (5d4266c1):** '*' on any market-anchored cell — measured data vs borrowed prior is now visible at a glance (also the diagnostic that caught v1.2's bug: '51*' = anchor firing with wrong scale).

**Meta-note for the record:** four ships in one evening on one feature, each triggered by the operator reading actual numbers off the actual screen. Backtests validate designs; operators validate implementations.


---

## 2026-07-22 — MARKET ANCHOR v1.4 FINAL (4fb6bc84) + THE CONVERGENCE FINDING. ANCHOR FROZEN.

**v1.4 (shipped):** multi-market tie-averaged rank — per market (win/t3/t5/t10), implied-prob rank with ties SHARING rank, percentiles averaged across every market a driver is priced in. Fixes both prior defects: co-priced longshots get identical anchors (Muniz 9, was alphabet-random), and the calibrated t3/t5 ladders outvote the junk win tail (FD +250000 filler lines).

**THE FINDING that ended the night:** MCJ's anchor is ~48 under EVERY reasonable scale — because that IS the market's multi-market opinion of him in THIS field (win +10000 with 8 trucks longer; t3 +2500; t5 +1100; weak standalone IRP field; Halmar equipment). The author's "should be ~20" was a personal prior overriding the market — the exact failure the anchor exists to prevent. For data-less drivers the market's surprising answers are still the best available answers; the gate ensures no VALUE claim rides on them either way.

**FROZEN:** no further anchor scale revisions by reasoning. Next revision, if any, comes from the odds_snapshots archive (~15 races): test scale variants (rank / log-prob / multi-market) against thin-driver finish percentiles, same harness as the salary-proxy validation. Live review addition: thin-driver calibration (did anchored drivers finish where their anchors said?) rides the #55-style review.

**Post-mortem of the evening (for future sessions):** one incident (a phantom flag) -> nine ships in one night (gate, anchor v1-v1.4, ringer exclusion, caution auto, P-R-P guards + UI, honesty stars). Ships v1.2/v1.3 fixed bugs that v1.4 revealed were partially misdiagnoses of a surprising-but-correct market opinion. Lesson logged: when a validated system produces a surprising number, CHECK WHAT THE INPUT ACTUALLY SAYS before re-deriving the mechanism. The star markers (diagnosis instrument) and the reproduce-from-snapshots method (ground truth) are the tools that finally cracked it — use them first next time.


---

## 2026-07-23 — PENALTY DATA vs THE MODEL: persistence tests. CREW -> DISPLAY ONLY. DRIVER SPEEDING -> candidate (queued).

**Question (operator):** how should the new pit_penalties data affect pit crew rankings in the simulation?

**Sparsity frame first:** crew penalties ~ 2.5-2.7 pct per car-race. Even at ~10 positions cost per event, expected impact ~ 0.25 positions/race — a TAIL event. If modeled at all it belongs as a per-sim event (like DNF), not a mean shift. But any model use requires the trait to be STICKY.

**Persistence tests (split-half by odd/even race number, Spearman-Brown full-season reliability):**

| unit | n units | mean rate | split-half r | reliability |
|---|---|---|---|---|
| CREW penalties, car+series+season (>=14 races) | 457 | 2.7 pct | 0.122 | 0.217 |
| CREW penalties, ORG+series+season (>=20 car-races) | 207 | 2.5 pct | 0.099 | 0.179 |
| DRIVER penalties, by driver career (>=24 races) | 151 | 4.0 pct | 0.162 | 0.279 |

**CREW verdict: real but unactionable.** Trait exists (r significant at n=457) but ~80 pct of a season's rate is luck; org pooling makes it WORSE (penalty-proneness is crew-local, not org-cultural). Shrunken estimates cluster at base rate -> cross-crew spread ~0.05-0.1 expected positions — invisible under sim noise. DECISION: crew penalties stay OUT of the sim. They are excellent DISPLAY content (rankings page, task #66) — raw attributed counts are product differentiation, not model claims.

**DRIVER SPEEDING verdict: genuine candidate, queued.** Field-wide reliability modest (0.279) BUT the tail is individually solid: chronic speeders at 2.5x base over huge samples — Ty Gibbs 10.5 pct/124 races, Kyle Busch 10.3/145, Suarez 9.3/151, Blaney 8.9/124 (Gibbs z ~ 3.7 vs base). For those names, expected impact ~ 0.5-1.0 positions/race + tail variance — pit-crew-term scale, concentrated in a handful of stars whose t10/DK tails matter. DESIGN (not shipped, freeze holds): empirical-Bayes shrunken driver penalty rate -> per-sim penalty event with position setback; walk-forward test = does the shrunken prior rate predict finish/DK residual to all existing terms? Run after this weekend.

**Doctrine:** persistence testing BEFORE predictive testing for sparse-event data — if the trait doesn't repeat, there is nothing to predict with. (Crew penalties failed here; driver speeding partially passed via its tail.)

## 2026-07-23 — TASK #67 RESOLVED EARLY: driver speeding sim term — NO SHIP (display only)

Two-stage sparse-event test (probability x cost decomposition, run in-browser vs pit_penalties + pit_stops + loop_data 2022-26):

**1) Probability side — walk-forward penalty prediction.** Per-driver chronological history; shrunken prior rate (k=25 toward base) computed from strictly-prior races (min 15); predicting 2025-26 driver-races. Base driver-race penalty rate 3.9% (523/13,474). Calibration by prior bucket: low predicted 1.8% -> actual 3.0% (n 1,680); mid 4.1% -> 4.2% (n 2,041); high 7.2% -> 6.0% (n 1,011). MONOTONIC and real — the trait predicts out-of-sample. k=25 slightly under-shrinks (actuals compress toward middle); k~50 would calibrate if ever needed.

**2) Cost side — within-driver net finish cost of a penalty race.** 86 drivers with >=20 races and >=2 penalty races (435 penalty races used): finish percentile in penalty races vs same driver's clean races = +1.8 pctile ~ 0.7 positions in a 36-car field, t ~ 1.58 (not significant). Drivers recover most of the mid-race hit.

**Verdict: probability x cost = expected finish impact ~0.02 positions/race (high vs low risk), ~0.04 for a true chronic vs base. Order of magnitude below sim resolution, and the cost estimate itself is not significant. NO sim term — driver penalties join crew penalties as DISPLAY ONLY (task #66 pit crew rankings page). The planned walk-forward-vs-DK gate is moot: the effect ceiling kills it before the harness matters.**

Method note (doctrine confirmed): persistence -> probability -> cost decomposition is the right ladder for sparse events. Persistence passed (07-22: split-half r .162, S-B .279, chronic tail solid), probability passed, cost failed to matter. A trait can be perfectly real and still not worth a model term.

## 2026-07-23 — FINDING: sim pit-crew term (v1-0.06) uses CONTAMINATED medians — fence fix queued post-freeze (task #68)

Checked whether the sim's task-#46 crew term needs the qualifying-stops fence shipped to the rankings page (5b05b664). ANSWER: YES. The sim fetch (SimulationCenter ~47.5k: series+season, tires_changed=4, lap>0, box_time not null) has NO flag filter and NO outlier fence — contrary to a prior session note claiming green-flag-only. Contamination measured (2026 season, Tukey fence q3+1.5IQR per series): cup 13.4% of stops excluded (fence 18.4s), trucks 11.0% (39.2s), oreilly 11.3% (33.0s). Cars whose sim median moves >0.15s clean-vs-raw: cup 29, trucks 23, oreilly 29. Worst: cup #6 Keselowski 11.22->10.58 (-0.64s, wreck repairs), #33 11.52->10.75, trucks #2 31.12->26.96 (-4.2s). Wreck-prone cars are unfairly slow on a CREW-skill term.

NOT shipped now: (a) model freeze through IRP weekend; (b) the #46 validation that set weight 0.06 ran on the contaminated medians — swapping the input requires re-validation. TASK #68: after freeze lifts, add the same series-level Tukey fence to the sim's __byCar accumulation (3-line change) AND re-run the #46-style correlation check on clean medians before the next published board. Expectation: equal or better (removes noise uncorrelated with crew skill).

## 2026-07-23 — TASK #68 VALIDATION PASSED: fenced crew medians strictly dominate raw (clean input ready to ship)

Re-ran a #46-style walk-forward on the fence question, per operator ("cant we just backtest it to validate it?"). Design: within series-season, crew metric = median 4-tire box_time per car from STRICTLY PRIOR races (>=5 stops, >=100 prior stops in pool); RAW variant vs CLEAN variant (Tukey fence q3+1.5IQR computed from the same prior-race pool — fully walk-forward, no lookahead); within-race tie-shared percentiles; finish pctile via loop_data; identical sample for both variants: 10,868 driver-races (2022-26, all 3 series, races with >=8 scored cars). DISCLOSED DEVIATION from #46: control = driver trailing avg finish pctile (walk-forward, >=3 prior races), not the full corr prior — weaker control inflates both crew coefs equally (~0.22 vs #46's 0.095) but the A/B comparison is clean since both variants face the identical control.

RESULTS:
- Separate models: RAW coef .2161 t 18.61 | CLEAN coef .2225 t 19.24. Clean wins.
- HEAD-TO-HEAD (both in one model): ctrl t 21.45 | rawP coef .0552 t 1.63 (NOISE) | clnP coef .1708 t 5.07. The clean metric absorbs ALL the crew signal; raw retains nothing incremental. Strict dominance.
- Materiality: fence shifts 3,904/10,868 driver-races (36%) by >5 within-race percentile points; avg abs shift 4.5 pts.

VERDICT: task #68 fence fix is VALIDATED — the #46 term was originally validated at a handicap (wreck noise in its own input). Ship decision (now vs post-freeze) = operator's call; the change is 3 lines in SimulationCenter __byCar + config stamp bump pitCrew 'v1-0.06-fenced'.

## 2026-07-23 — QUICK CHECK: 2T vs 4T crew skill agreement (display question, no model change)

Operator asked whether the new 2T column changes rankings. It cannot (Adj rank is 4T-only) — but measured the agreement: cup 2026, crews with >=20 clean 4T + >=5 clean 2T (n 33): Spearman rho 0.73 between 4T and 2T median ranks. Same crews are good at both; divergers exist (#24: 4T rank 8 / 2T rank 26; #60: 18/2; #12: 19/4). O'Reilly rho 0.23 on n 19 — treated as sample noise (median crew has ~5 2T stops), not signal. VERDICT: 2T stays a standalone display lens; do NOT fold into Adj (thin samples, rho 0.73 means it would barely reorder anyway).

## 2026-07-23 — SHIPPED: dominator curves v2 (caution-bucket) — pooled+flatten was double-diluting dominance (48908af6)

Operator flagged DFS laps-led/fast-laps projections as not credible (Hamlin, top Brickyard win prob, projected 9 of 160 laps led). AUDIT of the parallel session's dominator design found TWO defects:

1) DOUBLE DILUTION (the big one): LL/FL allocated per-sim by finish position from a POOLED empirical curve (winner .313), then blended toward uniform by flatten = cautions/20. But the pooled curve was measured on real races that already contain caution-driven spreading. Measured winner laps-led share by races.total_cautions bucket: low (<=5) 36.7%, mid (6-8) 32.4%, high (>=9) 25.0%. The sim's effective winner share at a low-caution race was ~24% — dominance understated ~35% relative, conditional-on-winning laps led understated ~50%. At 0.25 DK pts/lap led this is multiple DK points off every dominator.

2) REMAINDER ARTIFACT: rounding leftovers were dumped on the LAST active finisher — visible in published boards as tail cars (P33) carrying MORE projected fast laps than midfield (P25).

FIX (48908af6, stamp domCurves 'cbucket-v2'): six empirical curves embedded — LL and FL x low/mid/high caution buckets, full 40 finish positions, derived from loop_data 2022-26 (n 122/138/97 races, <50 total-laps-led races excluded, each curve sums to 1.000); bucket selected by cautionPreset.value (<=5/<=8/else — same breakpoints as the measurement); flatten and chaosFactor REMOVED; rounding remainder goes to the leader. Verified in live bundle.

KNOWN LIMITATION logged for future work: dominance is still allocated purely by realized finish rank — no driver-speed input (a plodder winning a fuel-mileage sim gets winner-share laps led; GFS/practice pace unused). Fixing that is a real modeling project (speed-rank-conditioned curves), queued as candidate work post-freeze — NOT a quick patch.

OPERATOR ACTION REQUIRED: re-run + republish all three weekend boards (trucks IRP R16, cup Indy R22, oreilly Indy R21) so sim_results / DFS pick up the new curves. Win/T3/T5/T10 probabilities are UNCHANGED by this fix (finish sim untouched) — only laps_led, avg_fast_laps, proj_dk move.

## 2026-07-23 — TESTED @ REJECTED: recency-weighting the track-history term (Majeski/Riggs IRP question)

Operator challenged the IRP trucks pre board: Majeski 14.0% win over Riggs 13.1% when Riggs dominated IRP 2025 (won from P11, led 160, rt 149.7) and holds far better 2026 form (avgFin 10.5 vs 17.3; market t3 Riggs -150 vs Majeski +180). Diagnosis confirmed the track term drives Majeski's edge: IRP career ratings Majeski ~129 (wins 2023+2024, 179 laps led in 2023) vs Riggs ~110 (76.5 rookie 2022 drags it). Trends oppose: Riggs rising 76->109->104->150, Majeski 116->150->133->115.

TEST — is recent track history more predictive than career average? All series 2022-26, driver-track lines with >=2 prior same-track visits, walk-forward, n 5,316. Corr(prior metric, finish pctile): career MEAN rating -0.394 (best) | recency-weighted (2^k) -0.385 | most-recent-race-only -0.339 (worst). VERDICT: flat career average WINS — recency-weighting track history REJECTED (joins the 07-18 track-history-shrink rejection; single dominant races are noisy evidence). The sim's Majeski edge is empirically grounded; the 0.9pt gap correctly reads track history (Majeski) vs current form (Riggs) as near-cancelling. Board stands. Friday practice (best5) will inject current speed via P-R-P rerun. NOTE: sim vs market disagreement (we ~even, market Riggs -150) is the product working, not a bug — same shape as the Chandler Smith NW flag that cashed.

## 2026-07-24 — MATCHUP TAIL INVESTIGATION (Burton +15900 case) + FMV display cap shipped (24b06757)

Operator flagged a 4-way Matchup Compare price of +15900 on Harrison Burton (0.6% group win vs Eckes/Sanchez/Ruggiero, trucks IRP practice-fallback board) as unrealistic, then sharpened it: "if each truck has a 12% DNF rate shouldn't that be mathematically wrong?"

FINDINGS:
1. The computation is honest: CompareTray counts group wins in the stored JOINT sim matrix (4000 stored sims) — no independence shortcut. Verified: joint accounts for correlation properly (independence product 6.25% vs joint 14.57% on the current board's same 4 drivers — shared-race correlation matters and IS captured).
2. The DNF floor math: all-3-DNF-and-Burton-survives = 0.12^3 x 0.88 ~ 0.15%. The sim's 0.6% is ABOVE the floor — not mathematically impossible.
3. The REAL structural critique (operator's instinct correct in substance): sim DNFs are drawn INDEPENDENTLY per truck. Real short-track DNFs are correlated (multi-truck wrecks collect contenders together), which fattens exactly these longshot-vs-contenders tails. This is parked task #51 (correlated noise; org ICC already measured) — SECOND live case pointing at it; priority raised for post-season.
4. Tail calibration has never been validated: Brier tuning targeted the win market's top end; nothing has ever tested 0.5-3% matchup tails. BLOCKER for testing: sim_results is delete-then-insert per series+stage — historical board matrices are destroyed, so matchup calibration cannot be tested retroactively. DESIGN NEED (new task): archive pre-board matrices (append-only) so tail calibration accrues; revisit when ~15-20 archived boards exist.
5. SHIPPED meanwhile (display honesty per operator credibility doctrine): fmvAmerican caps below 2% probability at "+5000+" (24b06757, build green) — a 0.5pct model error at these probs swings thousands of odds points; books cap for the same reason. Applies to all FMV renders on SimResults incl. Matchup Compare.

ALSO: operator's screenshot board (practice-fallback lineup, Burton 23.2 avgFin) is not the current DB board (Burton 15.0 avgFin, group win 14.6%) — republish with the QUALIFYING lineup resolves the stale view.

## 2026-07-24 — RINGER-EQUIPMENT LIVE LEDGER opened (feeds task #54 re-test, end of 2026)

Case 1: Michael Christopher Jr, #62 Niece (Bell's ringer truck), IRP trucks R16. Pre-fix sim flagged t3/t5 VALUE at DK t3 +2500 / t5 +1100 (win +10000) — operator vetoed 07-22, fixes shipped (gate/anchor/ringer exclusion). Post-fix final board: proj fin 15.2, win 0.7%, start P11. Closing essentially unchanged (t3 +2500 / t5 +1200 — market never moved). Live: P9 at lap 85. Pre-registered grading: vetoed flags "won" ONLY on actual top-3/top-5; top-10 = consistent with post-fix 15.2, NOT vindication of the raw fill. Accumulate cases for #54; singles prove nothing. FINISH: P10 (veto CORRECT — both flags lose; post-fix proj 15.2 vs actual 10; kid drove over his data but nowhere near t5. Race: Riggs won from pole, Majeski P3 — the Riggs/Majeski coin-flip read aged fine both ways. Sim grade: MAE 5.92 pre / 5.55 post. Bets 0-for: Eckes alternator from P2, Enfinger wrecked from P9 with 2 to go — result variance, not process.)

## 2026-07-25 — DFS grade, trucks IRP R16: proj Spearman 0.416 vs salary benchmark 0.513 (first loss to salary)

n 34, DK-pts MAE 13.4. Two projected-top-6 busts (Eckes alternator from P2, Enfinger lap-198 wreck) + Riggs dominance concentration (actual 130 vs EV-proj 49 — EV projections can't match a realized dominator; salary "called it" via P1 pricing on a chalk night). Historical salary benchmark ~0.29 — salaries ran hot. Running ledger: NW us 0.51 (win), IRP 0.42 vs 0.51 (loss); both inside single-race noise (SE ~0.17). Judge at 8-10 slates. No action.

## 2026-07-25 — PASSED: projected start positions for pre-lineup boards (task #72, implement post-weekend)

Operator insight (books repriced Riggs +250 -> -140 across practice/quali): books bake EXPECTED start into pre-quali prices; our pre-lineup boards ran the 0.33-weight startPos term at NEUTRAL — systematic blind spot when early-week flags fire (good qualifiers underrated / bad overrated; plausible contributor to the 44%-positive CLV rate).

TEST (walk-forward, 2022-26 all series, n 13,144): predicted start = mean of last-10 prior start pctiles (min 3 prior). Predictability: corr(pred, actual) 0.643. Value: Model A ctrl-only RMSE .2608 (= current pre-board); B + PREDICTED start coef .390 t 21.0 RMSE .2565 (+3.2%); C + ACTUAL start t 24.3 RMSE .2551 (+4.3%). Predicted start recovers ~75% of the real grid's value pre-quali. Shared-ctrl A/B/C bracket makes the recovery finding robust to the weak-control caveat.

VERDICT: implement post-weekend as 'lineup: projected' state (badged), trailing-10 fill, auto-handoff at quali load, <3-race drivers neutral, full-vs-shaded (~0.75x) weight decided at implementation. Un-neutralizing a validated term, not a new signal.

## 2026-07-25 — start-projection SWEEP: hybrid category conditioning WINS -> trail10-v2-hybrid shipped (a2164f79)

Operator: should projections carry across track types? HALF — pooled vs group-conditioned (n 13,144): SHORT pooled .653 > grp .639; INT .676 > .670 (oval quali skill transfers); SS grp .610 > pooled .563; ROAD grp .660 > .626 (separate disciplines). HYBRID (pooled ovals, conditioned SS/road, pooled fallback <3): corr .656, finish-model t 22.3 RMSE .2560 (vs 21.0/.2565). Shipped: projection conditions on isSuperspeedway/isRoadCourse when current race is SS/road; stamp startProj 'trail10-v2-hybrid'. Build green, bundle verified.

## 2026-07-25 — TESTED & REJECTED: track-specific blend + oval-only history for start projections (Byron case)

Byron projected P14 at Indy vs 5.0 Indy quali avg (n=2); outright flag died. Tested vs shipped hybrid (n 13,144): oval-only .656 = no gain; track blend (lam=n/(n+2)) .655 = slightly worse — 1-4-start track samples too noisy in aggregate; shrinkage that avoids flukes also mutes the Byrons. Hybrid stands. Flag note: pre-projection boards were start-BLIND, not Byron-believers; the real grid restores honest flags at quali load. Pattern (3rd entry): discipline-level conditioning (SS/road) survives testing; per-track conditioning does not.

## 2026-07-25 — OVERSHOOT BACKTEST (operator challenge) -> trail10-v2.2 shade shipped (4301ea97)

Do projected grids overshoot favorites? Toy-MC (relative comparisons only), 319 races 2023+ (2022 Next Gen excluded per operator): ACTUAL grid favorite gap 20.9 (pred 37.8/real 16.9); PROJECTED unshaded gap 25.0 (pred 38.1/real 13.2) — real-grid confidence, worse favorite ID, +4.1 pts overshoot. CONFIRMED. Shade sweep: lam 0.7 -> gap 21.4 ~= actual-grid profile. SHIPPED lam=0.7 on startScores for projected drivers only; stamp 'trail10-v2.2-shaded'. Final design: hybrid conditioning + 1..K re-rank + 0.7 shade, each separately tested.

## 2026-07-25 — SHIPPED task #71 part 1: dominator curves by TRACK GROUP x caution bucket (gxc-v3, 880ee02a)

Winner LL share by group: SS 18.2 (n62) / INT 30.4 (n160) / SHORT 37.2 (n110) / ROAD 42.5 (n52) — pooled cbucket-v2 starved road/short dominators, overfed SS. New LL_CURVES_G/FL_CURVES_G [group][bucket], 40 positions; n<20 cells (SS-low/high, ROAD-mid/high) fall back to group-pooled at generation; global cbucket = runtime fallback. __trackGroup classifier reuses isSuperspeedway/isRoadCourse + SHORT keywords (same list as derivation). trackGroup via simConfig. Stamp 'gxc-v3', bundle verified. Win markets unchanged. Part 2 (speed-conditioned) stays queued. Operator: re-run + republish today's boards.


## 2026-07-26 - EDGE MAGNITUDE IS UNINFORMATIVE (n=87, 4 races) - the most important measurement so far

**Question asked by operator:** is something wrong with the model if it flags 23 bets as value in a single race (23 pre / 25 post on cup R22 Indy, out of ~39 drivers x 4 markets = ~156 combos, so ~15-16% of the board)?

**Test 1 - internal coherence: PASSED, hypothesis killed.** Summed every probability column across all six retained boards. Targets 100/300/500/1000. Actuals: cup R22 post 99.9/299.8/500.1/1000.1; cup R22 pre 99.7/300.1/500.1/1000.2; oreilly R22 post 99.9/299.7/500.1/1000.2; oreilly R22 pre 100/300.1/499.9/1000; trucks R16 post 100/299.9/499.9/1000.2; trucks R16 pre 100.2/300.1/500/1000.1. The sim is NOT inflating probabilities - it cannot manufacture edge in aggregate, every point given to one driver is taken from another. Mass flagging is not an over-confidence artifact.

**Test 2 - where the flags come from.** 19 of 25 cup R22 post flags have NON-POSITIVE mev, i.e. at the best available price the market CONSENSUS says the bet is -EV. The flag exists purely because our probability exceeds the market's. Disagreement is per-driver and therefore hits all four of that driver's markets at once - which is why flags cluster (Allmendinger x3, Bowman x4, Reddick x4 with medge +15.36/+14.86/+15.27). So the 23 flags are not a bug and not a line-shopping artifact; they are systematic model-vs-market disagreement on specific drivers.

**Test 3 - THE DECISIVE ONE: does claimed edge predict realized CLV? NO.** Across all 87 gradeable clv_log rows: corr(edge_at_bet, clv) = -0.029, Spearman -0.026, corr(edge, profit) = -0.053. By claimed-edge quartile: Q1 (edge 2-18) n=22 avgCLV +2.47, 55% pos, 4 wins, ROI +34.1%; Q2 (19-38) avgCLV +0.68, 55%, 2 wins, -53.4%; Q3 (39-83) avgCLV +0.62, 41%, ZERO wins, -100%; Q4 (87-1229) avgCLV +0.80, 52%, 1 win, -38.1%. The SMALLEST claimed edges performed best on both CLV and ROI. The loudest ones did not outperform at all.

**Interpretation.** This is the signature of SELECTING ON NOISE: per-driver probabilities are noisy, the flag rule only ever picks the side where noise pushed the probability UP, and the biggest 'edges' are simply the biggest noise excursions. It explains the >+2500 bucket going 0-for-19 with negative CLV (Q4's range runs to 1229%, and the largest claimed edges live at the longest prices, where probability estimates are least reliable). NOTE the direction of the model is NOT dead - the North Wilkesboro board produced Gibbs +17.5, Blaney +16.8, Logano +14.2 CLV. It is the MAGNITUDE that carries no information.

**Consequence for staking (revises the same-day Kelly work).** Fractional Kelly sizes proportional to claimed edge, so it systematically bets MOST on the bets whose edge number is least trustworthy. The earlier finding still stands that a per-driver correlation cap is the single biggest lever (quarter-Kelly uncapped -33.4% ROI vs -6.8% with a 1% per-driver cap), but edge-proportional sizing should be treated as suspect until magnitude is shown to carry signal.

**CAVEATS (do not over-read).** n=87 across only FOUR races (cup R21 NW 39, trucks R15 NW 30, oreilly R22 Indy 10, trucks R16 IRP 9), two of them the same weekend/track, and only 7 winners total. The ROI column is very noisy - Q1's +34% leans on a few hits. The CLV column is result-independent and agrees with the correlation, so 'edge magnitude is uninformative' is the finding to carry; 'small edges are actively better' is an unproven curiosity. RE-RUN THIS once flagged_bets (shipped 4ae7a4b, now 90 rows across 3 races x both stages, auto-written at publish) has 15-20 boards - that is also the #69 threshold sweep sample.

**No model changes made.** Operator's standing call: too early, and he wants the sim continuing to take longshot stabs. Measurement and visibility only.


## 2026-07-26 - TWO SOURCES OF CLV: medge tested as a selection metric (n=52, INCONCLUSIVE but instructive)

**Setup.** clv_log stores edge_at_bet (= ev, computed at BEST price) but not medge, so medge had never been tested against realized CLV. Reconstructed a medge proxy for 52 of the 87 CLV bets: took the earliest odds_snapshots capture per race, de-vigged each book/market to its target sum (win 100 / t3 300 / t5 500 / t10 1000), averaged across books for a consensus probability, then medge_proxy = sim_prob - consensus. NOTE this differs from live medge, which uses a LEAVE-ONE-OUT consensus; treat as a proxy. Coverage: odds_snapshots exists for cup R21, trucks R16, oreilly R22 (58 clv rows), 52 reconstructable.

**Result - medge did NOT validate as a selection metric.** corr(ev, clv) = -0.139 / Spearman -0.101. corr(medge, clv) = -0.398 / Spearman -0.053. corr(ev, medge) = 0.267 (they do measure different things). Both metrics show essentially NO monotonic rank relationship with CLV. The medge Pearson is negative, driven entirely by Q1.

**Quartiles by medge:** Q1 (-7.4..0.9) n=13 avgCLV +4.81, 54% pos, ROI -26.9%. Q2 (1.4..3.5) n=13 avgCLV +1.30, 54% pos, -53.8%. Q3 (3.6..6.3) n=13 avgCLV +0.79, 54% pos, -100%. Q4 (6.8..14.1) n=13 avgCLV +1.23, 77% POSITIVE, ROI 0.0%. So the top medge quartile was the only bucket not losing money and the only one to beat 54% CLV-positive - but n=13.

**THE ACTUAL INSIGHT: CLV has two independent sources and we have been conflating them.** (1) STALE-PRICE CLV - you take a lone outlier book price and it corrects back toward the field. You 'win CLV' with zero model input. This is what Q1 is: low or NEGATIVE medge with the highest average CLV (+4.81). (2) MODEL CLV - your probability disagrees with consensus and the whole market subsequently moves your way. That is Q4: 77% CLV-positive vs a flat 54% everywhere else. EV (computed at best price) selects for source 1. MEDGE selects for source 2. Both produce positive CLV, only source 2 is model skill, and source 1 does not scale with only three books loaded.

**Consequence for the flag board (display, not doctrine).** EV should stop being the headline number - it tells you WHERE TO GET THE PRICE, not WHETHER THE BET IS GOOD. Present/sort by medge, keep EV visible as the execution detail. Concrete example from the live cup R22 post board: Allmendinger t3 ev 217 / medge 2.79 (a lone FanDuel +6000, no conviction) vs his t10 ev 94 / medge 14.06 and Bowman t10 ev 40 / medge 15.23 (real disagreement). EV rank and medge rank are close to INVERTED at the top of the board.

**NOT changed.** No medge floor imposed - 13 bets is a hint, not a finding, and per standing doctrine the #69 archive decides thresholds. The FlaggedBetsAdmin tab highlights medge >= 8 green, which happens to sit almost exactly on the Q4 boundary. RE-RUN THIS TEST once flagged_bets has 10-15 races: it stores real (not proxy) medge alongside ev, mev, price and book at publish, so the comparison can be done properly and with enough n to trust.


## 2026-07-26 - MAE IS MEASURED AGAINST THE WRONG POINT ESTIMATE (mae_median + mae_rank now stored, 916b383)

**Finding.** __gradeRace computes mae = mean(|proj_finish - actual|), i.e. against proj_finish, which is the MEAN simulated finish. Two problems. (1) MAE is minimised by the MEDIAN, not the mean - grading a mean projection with MAE is a mismatched estimator and self-penalising. (2) proj_finish is an expected value, so it is COMPRESSED toward mid-pack (regression to the mean): Hamlin's Indy board showed proj 8.7 vs median 4.0, and no driver's mean is ever 1st or 38th while actual finishes span the full field. Raw MAE therefore charges the model for compression, not just inaccuracy.

**Measured on the four retained boards with results:** trucks R16 pre (n=32) mean 5.81 / median 5.41 / rank 5.53. trucks R16 post (n=33) mean 5.40 / median 4.91 / rank 5.15. oreilly R22 pre (n=35) mean 5.35 / median 4.43 / RANK 3.54. oreilly R22 post (n=36) mean 4.49 / median 4.00 / RANK 3.58. Median beats mean on ALL FOUR (by 0.40-0.92, avg ~0.58). Rank beats mean on all four, hugely so for O'Reilly (-1.81 pre, -0.91 post). Conclusion: the reported season MAE (7.57 avg) OVERSTATES error.

**THIS REVISES THE SAME-DAY QUALIFYING CONCLUSION.** Earlier tonight I credited the pre->post MAE gain to the sim converting qualifying correctly (rho(grid informativeness, gain) = -0.78). But on RANK-MAE, oreilly R22 went 3.54 pre -> 3.58 post, i.e. slightly WORSE, while raw-mean MAE said it improved 5.35 -> 4.49. Trucks R16 improved on both (5.53 -> 5.15). So much of the apparent 'qualifying helps' effect was the mean projection becoming LESS COMPRESSED once the grid was known - a CALIBRATION gain - not the model ORDERING the field better. Downgrade: qualifying demonstrably improves calibration; its effect on ordering is UNPROVEN at n=2 graded pairs.

**Shipped (916b383).** rows now carry p50 (= finish_p50); grader computes and stores mae_median (against finish_p50) and mae_rank (project to a 1..N ordering by proj_finish, compare to actual position) alongside the existing mae. All three land in sim_grades.metrics from the next grade forward. No existing metric changed or removed.

**DECISION RULE (agreed with operator, important).** Do NOT pick the variant with the lowest number - rank-MAE will nearly always win because it is immune to the compression penalty, so 'lowest wins' just selects the most flattering metric. They answer different questions: mean = is expected finish calibrated incl. DNF risk; median = the MAE-matched estimator; rank = pure ordering skill. The empirical question the data CAN settle is which variant best predicts the outcomes we care about (CLV, bet ROI, DFS points correlation). Once ~10-15 graded races exist, correlate each MAE variant per race against that race's betting/DFS performance and steer by the one that tracks profitability - that is also the one to optimise in future weight sweeps, since whatever is optimised is what gets produced.

## 2026-07-26 - THE MODEL HAS SKILL AT SOME TRACK TYPES AND NONE AT OTHERS, AND BETS THE SAME AT BOTH
Graded all 18 boards in sim_grades, grouped by tracks.correlation_group_label.

  GROUP              BOARDS   MAE    SPEARMAN   BETS   UNITS
  Intermediate         6      6.67     0.666      67    -6.6
  Short & Flat         6      6.66     0.631      71   -26.5
  Superspeedway        4      9.68     0.193      41   -28.0
  Road Course          2      9.88     0.026       7    -3.8

Spearman is the honest test (did we get the ORDER right). 0.63-0.67 at intermediates and short
tracks is a real signal. 0.193 at superspeedways. 0.026 at road courses = the finishing order is
statistically unrelated to what the model predicted. O'Reilly Atlanta R21 posted Spearman -0.015
pre / 0.036 post and STILL generated 18 bets across the two stages, both -100% ROI.

THE FINDING THAT COSTS MONEY: corr(Spearman, bet count) = 0.017, n=18. The model bets exactly as
heavily where it has no skill as where it has skill. Superspeedways are the single largest loss
bucket in the archive: 41 bets, -28.0 units.
Brier confirms the probabilities themselves break down, not just the ranking: top-10 Brier 0.2563
at O'Reilly Atlanta vs 0.0946 at O'Reilly Indy -- nearly 3x worse.

PROPOSED NEXT TEST (not yet run): raise the chaos/noise parameter at superspeedways until Brier is
MINIMIZED, not until flags disappear. If the output distribution goes near-flat the flag count
collapses on its own without a hand-coded track blacklist -- the model simply stops claiming to
know something it does not. Principled and directly testable.
CAVEATS: n=4 superspeedway boards, n=2 road course. Road course stays parked until the offseason
per operator (n=2 proves nothing). The superspeedway case is the stronger one -- 4 boards, 41
bets, corroborated independently by Spearman AND Brier.
Also note: Trucks' apparent edge (mean MAE 7.48 vs Cup 8.01) is NOT a series effect. Trucks IRP
and North Wilkesboro are short tracks, where the model is good in every series.

## 2026-07-26 - CUP R22 INDIANAPOLIS GRADED: INPUTS VINDICATED, CONVERSION FAILED
Betting: 2 of 28, -22.64u, -80.8% ROI. Win 0/4, T3 0/9, T5 0/8, T10 2/7.
Accuracy: MAE 8.24 post / 8.42 pre, vs a START-POSITION-ONLY BASELINE of 9.54. Beats naive by 1.3.
Season Cup MAE band is 7.16 (Chicagoland) to 8.79 (Atlanta), so 8.24 is mid-to-poor, not a collapse.

CALIBRATION ON THE SELECTIONS (the number that matters): sim expected 6.9 hits across those 28
bets, market implied 5.7, actual 2. The sim was ~3.5x optimistic on the drivers it specifically
chose, and more optimistic than the book on every one of them -- which IS the +EV claim.
(NOTE: full-board calibration -- win_pct summing to 1.0, top5_pct to 5 -- is MECHANICALLY FORCED
and is NOT evidence of anything. Do not cite it.)

WHY IT LOST, from loop_data + the Lap Raptor caution log:
  Caution lap 121-126, 'accident, #1 12 16 33 35 38 42 62 88 turn 3' -- a NINE-CAR wreck at 75%
  distance, preceded by a debris caution at 115-119. That sequence vaulted Bell (start 23 -> fin 2,
  avg running position 13), Logano (19->3, ARP 12), Berry (26->7, ARP 15) and Preece (34->8, ARP 17,
  he ran 24th at mid-race) while burying the cars that had actually run up front: Reddick ran 97.5%
  of laps in the top 15 and finished 10th; Hocevar led at mid-race and finished 9th.
  By driver rating the sim bet Hamlin (#2 in field), Hocevar (#3), Reddick (#5), Keselowski (#6),
  Buescher (#7) -- five of the seven fastest cars, identified before green.
  Miss distribution: 2 hits, 4 missed by 1-2 (Briscoe T3 fin 4, Keselowski T5 fin 6, Buescher T10
  fin 11, Hamlin T3 fin 5), 4 by 3-5, 18 by 6+. Had only the by-1s landed: -3.69u not -22.64u.
  Of the 10 drivers bet: 6 ran where projected, 1 was wrecked (Allmendinger, #16 in the turn-3
  crash -- ran as high as 7th, finished 25th ON THE LEAD LAP with a POSITIVE pass differential;
  his rating of 60.5 is an artifact of the wreck, NOT evidence of a bad flag), and only 3 were
  genuine pace misreads (Bowman 72.5% top-15, Suarez and McDowell both 55%).
CORRECTION to my own first read: I initially called the Allmendinger flag 'just wrong' on the
basis of his rating and top-15%. Both are downstream of the wreck. That was grading a bet on
outcome-contaminated stats. The flag was defensible.

## 2026-07-26 - SEASON CLV IS NOT YET SIGNIFICANT; DO NOT TUNE ON IT
clv_log, 116 bets across 5 races: sum +109.7, mean +0.946, sd 4.62.
  Cup R21 North Wilkesboro  n39  +78.6   Trucks R16 IRP     n9  +18.3
  O'Reilly R22 Indy         n10  +19.6   Cup R22 Indy      n28  +12.4
  Trucks R15 North Wilkesboro n30 -19.3
WHY IT IS WEAKER THAN IT LOOKS:
  - The top 5 individual bets are +78.8 = 72% of all CLV ever logged.
  - Positive rate among bets that MOVED is 52%. A coin flip. The mean is positive because the
    winners are larger, not more frequent.
  - Naive t = 2.20, but the 116 bets are not independent; they are 5 races. Clustered at the race
    level t = 2.14 on 4 df, p ~ 0.10. NOT significant.
BY MARKET: T5 n41 avg +2.60 / 68% positive; Win n28 +0.25 / 39%; T10 n18 -0.05 / 67%;
T3 n29 -0.10 / 35%. T5 looks strong but T3 is nearly the same bet and is the WORST market --
if the T5 edge were structural it should bleed into T3. Treat as noise until the archive grows.
Consistent with the earlier finding corr(edge, CLV) = -0.029: the model still cannot tell you
which of its own flags to trust.
DOCTRINE UNCHANGED: threshold stays 10% until the #69 archive reaches 15-20 boards, then ONE
sweep. New: bet COUNT (not weights) is now the leading hypothesis for that sweep to test first.

## 2026-07-26 - MEASUREMENT CAVEAT ON EVERYTHING ABOVE
Every board graded this season was produced by a model reading partly corrupted inputs (see
pitboard 2026-07-26 NAME_MAP entry): two Cup drivers split into duplicate identities on every
load, 15 practice rows invisible at Dover/Charlotte/Nashville, fastest-lap history split across
7 duplicate track names. All of that was fixed 2026-07-26. Pre-07/26 grades are a floor, not a
clean read of the model.

## 2026-07-26 - GREEN FLAG SPEED IS INFLATED BY PARTIAL RACES (exposure bias)
TRIGGER: operator disputed Landen Lewis ranking 2nd in GFS at Trucks IRP off 135 of 200 laps,
having started 20th and run in traffic all day. Correct instinct.

TWO TESTS I RAN FIRST, BOTH FLAWED -- recorded so nobody repeats them:
  (1) Predictiveness: correlated a driver's GFS percentile against their NEXT race's GFS
      percentile (n=12,862 pairs). Got 0.451 full-race vs 0.359 for sub-50%, and concluded
      partial races were 'degraded but usable'. CIRCULAR -- the same bias sits on both sides
      of the correlation, so a biased metric predicting itself still correlates.
  (2) Deviation from the driver's own full-race baseline. Underpowered and confounded
      (drivers who crash are disproportionately drivers who were fast and pushing).

THE TEST THAT SETTLES IT: compare GFS percentile against AVERAGE RUNNING POSITION percentile
within the SAME race. ARP is an independent yardstick from loop_data. n=13,346 driver-races.
  GFS pct minus ARP pct (negative = GFS flatters the driver):
    laps >=99%   n9,972  +4.1   t 26.8
    90-99%       n1,670  -0.1   t -0.3
    75-90%       n475    -8.7   t -9.2
    50-75%       n545   -19.2   t -16.4
    40-50%       n161   -26.2   t -11.8
    <40%         n523   -39.2   t -26.5
Monotonic dose-response. A truck running 50-75% of distance ranks ~19 percentile points
better than its running position justifies.

MECHANISM IS EXPOSURE, NOT TRAFFIC. GFS averages green-flag laps; the laps you miss by
exiting early are the LATE ones -- hot track, old tyres, more lapped traffic. Finish the race
and those slow laps drag your average down. Crash at 135 and you keep only the fast ones.
CONCRETE: Trucks IRP 2026 -- Lewis GFS 2nd / ARP 23rd / 25.9% top-15 laps / rating 68.2, and
Hemric (out in the same incident, same lap) GFS 5th / ARP 22nd. Burton and Rhodes ran
comparable traffic for 199 laps and landed 11th and 12th.

THRESHOLD SET AT 90%, not 40%. Bias is already -8.7 at 75-90% and does not clear until 90%.
Shipped in both display (5db8709) and ingest (87e29bb).

IMPORTANT DISTINCTION THE OPERATOR DREW AND THE DATA SUPPORTS: this is a PACE metric. It is
not trying to tell you why a driver stopped. A short run says something about ATTRITION RISK,
which belongs in the DNF side of the sim, not as a correction to the speed number. Do not
launder one variable through the other -- dim the cell, show the lap count, let the operator
make the Lewis-crashed vs Eckes-battery call.

## 2026-07-26 - CORRECTION to the same-day GFS numbers
An earlier entry tonight cited 2,071 short runs. That figure was inflated by a bug in my own
backfill (pass 2 filling from the wrong race -- see pitboard 2026-07-26). Post-repair and
post-manual-loads the honest figure is 2,072 short runs / 375 null / 15,954 total, which is
coincidentally close but arrived at correctly. Any analysis run against GFS between the
backfill and the repair should be re-run.

## 2026-07-28 - PASSED & SHIPPED: speed-conditioned dominance (task #71 part 2, mult-v1, 0d39c236)

TEST: does pre-race practice pace predict laps-led / fastest-laps share BEYOND track group x finish position? Sample: 101 practice-covered races (2024-26, all series), 3,555 driver-races with practice + laps data. Method: residualize each driver's LL/FL share against the mean share for (group, finish position) cells (n>=5), correlate residual with practice speed pctile (best5, fallback overall_avg; same-weekend pre-race data - no leakage). RESULT: LL residual r .121 t 7.3; FL residual r .200 t 12.2 - FL more speed-driven, as hypothesized. Structure: multiplicative (slope/mean-share ratio ~1.10 P1-3, 1.47 P4-8, 1.54 P9-15; tail higher on trivial shares).

SHIPPED: __spdPct = within-field pctile of the sim's practice metric (lrpTime: best5 cup/trucks, overall_avg oreilly; no practice -> 0.5 neutral); dominator allocation weight = curve[rank] * max(0.1, 1 + K*(spdPct - 0.5)) with K=1.1 LL / 1.0 FL (front-bucket fitted slopes); renormalization unchanged. Stamp domSpeed 'mult-v1'. Bundle verified. Win/T3/T5/T10 untouched - LL/FL/projDK only. Effect: fastest-practice car ~1.5x the dominance share of the slowest at equal finish - the Mosack/Riggs shape from IRP. Boards with no practice loaded degrade to pure gxc-v3 curves. TASK #71 COMPLETE (both parts).

ALSO 2026-07-28: operator backfilled O'Reilly 2022 loop data (old task #65 DONE - he said #64, means #65; #64 RLS tightening still open). FOLLOW-UP for operator: run pit + penalties backfills for oreilly 2022 (python pitboard_pit_backfill.py --year 2022 --series oreilly, penalties likewise) so pit_stops/pit_penalties cover the new season; corr pools pick the races up automatically.

## 2026-07-28 - CLARIFICATION (operator, correct): Riggs IRP is an ANECDOTE, not a benchmark

Riggs proj-49/actual-130 motivated the dominator fixes but must NOT be a target: mean projections structurally cannot match realized dominators (49 = EV across futures; 130 = one draw). Tuning any single mean toward a realized dominator night = overconfidence. Evidence is the AGGREGATE record (group winner shares n 52-160/group; speed conditioning n 3,555, t 7.3/12.2). Success metrics: DFS Spearman vs salary over 8-10 slates; realized winner LL inside the per-track-type sim distribution; Ceiling coverage of dominator nights. Never grade on one race.

## 2026-07-28 - PENALTY COVERAGE INVESTIGATED: parser exonerated, SOURCE incomplete (no fix possible)

Cup Indy R22 raw lap-notes contain exactly ONE real penalty (No.10 blend line - captured correctly); parser got 1/1 available. No official penalty feed exists (all candidate endpoints 403). NASCAR lap-note penalty coverage is scorer-dependent by race (NW rich, Indy near-empty) -> pit_penalties is a FLOOR, not a census. Display-only status unchanged. CAVEAT on 07-23 speeding work: direction stands (under-capture attenuates), chronic rates are lower bounds, race-varying capture adds unseen noise. 19% 'other' = classification margin, separate from coverage. No code change.

## 2026-07-28 - PASSED & SHIPPED: task #73 distributional start sampling (trail10-v3, 77b5ad69)

Pre-registered gate: toy-MC favorite calibration, 333 races 2023+, per-sim draws from trailing-10 hybrid start history ranked into a coherent grid. RESULT: favorite gap 14.8 vs shade 18.3 vs actual-grid 19.1 - beats both. Implementation: __projStartH lists -> __startHist on drivers; __spW/__spUsed exposed; startSampling {entries,w} into runRaceSim; per-sim adj = w*(sampled - fixed) so the 0.7 shade CANCELS exactly when sampling engages; <3-eligible boards degrade to v2.2 unchanged; DNQ excluded pre-sampling; real lineups untouched. Stamp 'trail10-v3-sampled', bundle verified. Live check queued: Iowa pre-vs-post quali deltas.

## 2026-07-28 - TASK #51 REVIVED: wreck-event distributions MEASURED (lap-notes archive, 361 races 2022-26)

Per track group (multi-car accident notes, sizes = upper envelope pending severity join):
SHORT n96: 3.68 wrecks/race, size 3/5/11/21 (med/p75/p95/max), 1.13 wrecks>=5/race, 31% late.
INT n159: 3.38, 4/6/12/27, 1.50, 32%. SS n63: 4.27, 6/11/18/33, 2.76, 43% late. ROAD n43: 5.86, 4/8/12/20, 2.81, 36%.
Headline: SS averages ~3 five-plus-car wrecks/race with p95 = half the field, 43% in the final quarter - vs 38 independent DNF coins in the sim. One phenomenon behind SS Spearman .19, Burton tail thinness, Indy 9-car conversion failure. Next: severity join (P(DNF|wreck), survivor position loss) + finish_status cause split. Gates pre-registered: reproduce measured distributions, pin total DNF rate, INT Brier must not degrade.


## 2026-07-28 — #51 measurement phase 2: wreck severity join (weekend-feed statuses)

**Source correction.** loop_data.finish_status is unusable for DNF measurement: zero DNFs recorded in cup 2022-24, oreilly 2023-25, trucks 2023-24 (only the 2022 backfills carry real statuses — oreilly 2022 18.7%, trucks 2022 13.0% — plus partial 2026). Severity source switched to NASCAR weekend-feed.json finishing_status: all 370 races harvested, joins to lap-note DriverIDs directly on driver_id (no name mapping). Status vocabulary across 370 races: Accident 1,366 + DVP 93 vs ~600 mechanical across ~45 cause labels, Running 11,536.

**Severity by track group** (wreck = accident/spin/crash note with >=2 DriverIDs; accDNF = Accident/DVP/Damage):

| group | races | DNFs/race | accident share | mech/race | P(accDNF given in wreck) | notes capture of accDNFs | survivor cost (pos) |
|---|---|---|---|---|---|---|---|
| SHORT | 87 | 4.60 | 63% | 1.69 | 19.1% | 67% | +1.6 |
| INT | 167 | 4.89 | 70% | 1.44 | 20.6% | 61% | +2.5 |
| SS | 62 | 9.69 | 85% | 1.45 | 32.4% | 79% | +2.9 |
| ROAD | 43 | 4.70 | 50% | 2.35 | 9.8% | 69% | +2.7 |

Size dependence is modest (SHORT 16.5% at size 2-4 -> 26.1% at 10+; SS flat 27-34%; INT 19-24%). Timing: SS early wrecks are deadlier (36% early vs 28% late); ROAD reversed (8% vs 13%). Involved drivers' start pctile 0.462 — involvement is near-uniform across the grid, slight back bias.

**Gate targets** (distributions the event sim must reproduce). accDNF/race p25/50/75/95: SHORT 1/2/4/9 max 13; INT 1/3/5/10 max 15; SS 5/9/11/14 max 19; ROAD 0/1/4/7 max 10. Wreck-count/race p25/50/75/95: SHORT 2/3/6/8; INT 2/3/5/9; SS 3/4/6/8; ROAD 4/5/8/10 (full histograms measured).

**Design locked by measurement:** mechanical DNFs stay independent draws pinned at ~1.4-1.7/race (2.35 ROAD); accident DNFs become event-based — draw wreck count + sizes from group histograms, victims picked as position-adjacent clusters, each involved driver DNFs at P(accDNF|group,size), survivors take a small score penalty (+1.6 to +2.9 positions). Notes capture only 61-79% of accident DNFs, so the residual ~25-35% remains as independent accident draws. Pre-registered gates unchanged: reproduce wreck count/size dists; accDNF/race distribution per group (esp. the SS tail); INT win-market Brier must NOT degrade; Burton-tail longshot frequencies move toward observed. Next: toy prototype, then runRaceSim.


## 2026-07-28 — #51 toy prototype PASSES distribution gate

Event-based accident sampler (bootstrap a real race's event-size list per group, victims = position-adjacent clusters from a uniform seed, each involved driver DNFs at measured P(accDNF|group,size), dedupe within race) reproduces observed accDNF/race distributions with NO residual term needed — the noted events' size x P already covers the full accident budget (cluster overlap absorbs the notes-capture gap):

| group | sim mean / obs mean | sim p25/50/75/95 | obs p25/50/75/95 |
|---|---|---|---|
| SHORT | 2.69 / 2.91 | 1/2/4/8 | 1/2/4/9 |
| INT | 3.10 / 3.44 | 1/2/5/9 | 1/3/5/10 |
| SS | 8.18 / 8.24 | 4/8/12/17 | 5/9/11/14 |
| ROAD | 2.79 / 2.35 | 1/2/4/8 | 0/1/4/7 |

(5,000 sims/group; sim tails slightly fatter than obs max, expected from n=43-167 observed races.) Mechanical DNFs to be layered as independent draws pinned at group means (SHORT 1.69, INT 1.44, SS 1.45, ROAD 2.35 per race). One earlier bug caught in-session: expected event DNFs must sum size x P per DRIVER, not P per event — first pass double-counted via an inflated residual.

Remaining for #51 step 1: implement in runRaceSim (inline per-group event-set bootstrap table ~370 compact arrays, survivor score penalty, mechanical layer), then full gates: INT win-market Brier non-degradation + Burton-tail check vs current independent-DNF baseline.


## 2026-07-28 — SHIPPED #51 step 1: wreck-v1 event-based correlated DNFs (a4f838ce + budget fix f916b2d1)

**What changed in runRaceSim.** The per-driver independent \`Math.random() < dnfRate\` draw is replaced (when trackGroup is known; old behavior is the fallback) by: (1) accident share of the budget spent through wreck events — each sim bootstraps one real race's full event list from WRECK_SETS (87 SHORT / 167 INT / 62 SS / 43 ROAD races, [size, lapFraction] per event), victims are position-adjacent clusters in that sim's running order, each involved driver DNFs at P(accDNF|group,size) scaled to budget, survivors lose the group survivor cost (1.6-2.9 positions, converted via the sim's own score gradient); (2) mechanical DNFs stay independent at dnfRate x (1 - accident share); (3) wrecked drivers' finish order follows wreck lap timing — early wrecks finish worse (dnfLap sort). dnfRate remains the single calibrated TOTAL budget; wreck-v1 only changes its correlation structure. Stamp: dnfModel 'wreck-v1'.

**Budget fix (f916b2d1).** Cluster overlap + field-edge clamping ate 6-17% of event draws (worst at SS), undershooting total DNFs. WRECK_EV_EXP normalizers replaced with overlap-corrected values (raw x MC-realized factor): SHORT 2.73, INT 3.11, SS 8.76, ROAD 2.84. Verified post-fix (30k sims/group, n=38): total DNFs/race SHORT 3.06 vs budget 3.08, INT 4.85 vs 4.86, SS 7.23 vs 7.37, ROAD 5.08 vs 5.09.

**Gate proxy A/B (20k sims, same synthetic field, old vs new).** Favorite win prob INT 28.40 -> 29.29 (+0.9pt), SS 16.09 -> 16.83, SHORT 28.27 -> 28.46 — no degradation-scale movement; the small favorite gain is the expected effect of correlated (vs independent) attrition sparing the leader more often. Longshot P30 top-10 appears where it should. Full pre-registered gates that need live data remain OPEN: INT win-market Brier non-degradation and Burton-tail frequencies must be checked against boards as they accrue (first read: Iowa). Preserving the bootstrap of full per-race event lists (not independent count x size draws) is what keeps the 'calm INT race vs one big restart pileup' bimodality — the Big One only exists in groups whose history contains it.

**Next for #51:** step 2 org-correlated performance noise (ICC already measured) — sequenced after wreck events prove out on live boards.


## 2026-07-28 — SHIPPED wreck-v1.1-cb caution coupling + dead-metric removal (9a3d4e09, 6f863f74)

**Caution-wreck coupling (audit finding #1).** WRECK_SETS pools are now bucketed into calm/typical/chaotic terciles by event count per group and selected by the caution preset bucket (low/mid/high) — the same __cb that already picks the dominator LL/FL curves. One sim now tells one story: a high-caution INT sim draws from races averaging 6.2 wrecks, a low one from races averaging 1.1. Normalizer stays GLOBAL per group, so the preset now modulates realized attrition around the dnfRate budget BY DESIGN (MC, n=38): SHORT 1.8/2.7/4.6 vs budget 3.1; INT 2.5/4.4/7.6 vs 4.9; SS 3.8/7.5/10.2 vs 7.4; ROAD 3.4/5.0/6.7 vs 5.1. Mid tercile sits slightly under budget (wreck counts are right-skewed). Bucket pools: SHORT 29/29/29, INT 55/56/56, SS 20/21/21, ROAD 14/14/15 races. Stamp: dnfModel 'wreck-v1.1-cb'.

**Dead metrics removed (operator request).** shortRunPace, tireFalloff, raceCraft carried 0.00 weight in ALL five presets (raceCraft formally cut 2026-07-12, do-not-re-test list) — now fully removed: preset entries, normalize passes, per-driver fills, composite terms, scores breakdown, assembly fields (srpTime/trendSlope/raceCraftPct), avgQP aggregation, hasRaceCraft status badge, board columns (SRP/Fall/RC), weight nudge buttons. KEPT per operator correction and audit: longRunPace (0.15-0.25 weight + drives __spdPct dominator tilt) and winConversion (0.20 in O'Reilly SS preset). Historical comments referencing the cut metrics preserved as provenance. One build failure en route: scores breakdown still referenced removed vars (srp/fl/rc) — Babel passes syntax but CRA lint caught the no-undef; fixed in 6f863f74. Behavior of the composite is UNCHANGED (removed terms were 0 x normalized-score; wTotal renormalizes identically).

**Audit finding #2 still open:** DK place-differential uses fixed projected start while #73 samples per-sim starts — within-sim start/PD correlation lost in DFS sample rows. Small fix, queued next.


## 2026-07-28 — winConversion surfaced in UI (72e8cf03)

Operator audit of the weight table revealed winConversion (0.20 raw / 18.9% effective in the O'Reilly SS preset ONLY) had zero UI presence — no weight-panel row, no board column, not adjustable. It was never cut (that was raceCraft, 07-12); it was just invisible. Now: weight panel row 'Win Conversion' (shows 0% outside O'Reilly SS), board column 'Win' + score cell (weight-gated — renders only when the active preset weights it), and guards added so nudging a key absent from the current preset starts from 0 instead of NaN. Verified live. Also confirmed for the record: lrpTime ('long-run pace') IS practice pace — best5 for cup/trucks (overall_avg fallback), overall_avg for oreilly; the long/short naming is a fossil now that shortRunPace is deleted. Weight panel already labels it 'Practice Pace (All Laps)'.


## 2026-07-28 — practice pace rename (a33a1003)

All UI labels for the practice metric now say Practice Pace: weight panel 'Practice Pace (Best 5 / Avg)' (was 'Practice Pace (All Laps)' — inaccurate for cup/trucks which use best5), board column 'Prac' with tooltip 'Practice pace score — best 5-lap avg (Cup/Trucks), overall avg (O'Reilly)' (was 'LRP' / 'Long run pace score'). Internal keys (longRunPace, lrpTime, scores.lrp) deliberately UNCHANGED — they are persisted in published board rows and payload configs; renaming them would orphan historical boards for zero visible gain. Verified live.


## 2026-07-28 — admin card notes for wreck-v1.1 semantics (4a6df603)

Caution Rate card hint now shows which wreck pool the preset selects: <=5 cautions 'wrecks: calm pool (sims land under DNF budget)', <=8 'typical pool (~on DNF budget)', else 'chaotic pool (sims land over DNF budget)' — mirrors the __cb bucket runRaceSim actually uses. DNF Rate card hint changed from 'X% DNF probability per car' to 'X% DNF budget per car - spent as correlated wreck events + independent mechanicals (wreck-v1.1)'. Operator-facing semantics now match the model. Verified live.


## 2026-07-28 — SHIPPED trail10-v3.1-sampledPD: DK place diff uses per-sim sampled start (ff93ac90)

Audit finding #2 closed. Under #73 start sampling, each sim's finish reflected a SAMPLED start but DK place differential was computed off the FIXED projected start — the within-sim start/PD correlation was lost, miscalibrating pre-quali DFS sample rows (ceilings/floors), which feed the optimizer. Fix: the sampling-eligible drivers' projected grid slots are sorted once, then permuted per sim by the sampled order — grid stays collision-free, PD now co-varies with the start that actually drove the sim's finish. Guards: any null/non-finite slot disables the override (falls back to fixed start); drivers outside the sampling set and real-lineup runs are untouched (sampling only engages pre-quali with >=3 eligible). Mean projDK barely moves (mean sampled slot ~ fixed slot); the fix is to the JOINT distribution. Stamp startProj 'trail10-v3.1-sampledPD'. First live use: Iowa pre-practice sims.


## 2026-07-28 — SHIPPED gxc-v3.1-dnfLL: wrecked drivers keep pre-crash laps led (ca005bac)

**Measurement.** Share of laps led by eventual DNFers (weekend-feed statuses joined to loop laps_led on driver_id->name, 370 races): SHORT 2.0% / INT 8.2% / SS 17.3% / ROAD 4.1% (accident DNFs dominate the share: SS 16.1 of the 17.3). Fastest laps nearly identical (SS 17.7%). Old sim credited eventual DNFers ZERO laps led — systematically underpricing LL props and DK ceilings for dominators at wreck-heavy tracks.

**Change.** LL/FL allocation pool now includes DNF'd drivers, ranked by score, at curve weight x min(1, dnfLap x B). B calibrated per group by MC against the measured shares: SHORT 0.71, INT 6, SS 6, ROAD 0.77. B >= 6 saturates — at INT/SS a wreck past ~17% distance costs you nothing in led-lap credit (led laps are banked in reality). Saturated fit: SS sim share ~14.2% LL / 17.4% FL vs 17.3/17.7 measured; INT 7.3/8.1 vs 8.2/7.6; SHORT and ROAD land exact. The residual SS LL gap is unmodeled leader-wreck correlation (dominators are overrepresented in end-race crashes) — documented, not hacked. Remainder lap goes to the best-scored NON-DNF driver. Non-wreck-model groups fall back to old behavior (B=0). Stamp domCurves 'gxc-v3.1-dnfLL'.

**Market effect expected:** higher LL/FL tails for favorites at SS/INT (DK ceiling realism), slight LL redistribution away from mid-pack survivors. Win/finish markets untouched (allocation happens after finish order). First live read: Iowa.


## 2026-08-03 — stage fields defined as published stage END laps (e8361b9f + 32dc9817)

Operator caught label ambiguity setting up Iowa (Stages 70/210/350): Admin's 'Stage 1/2 Laps' fields implied LENGTHS but the natural entry (and what was entered) is NASCAR's published stage END laps — stage 2 'laps: 210' is really end-lap 210, length 140. Official semantic is now END LAPS, matching the broadcast format: Admin labels 'Stage 1/2 Ends (Lap)', SimulationCenter race-length card shows 'S1 ends / S2 ends' with hint 'published stage END laps (e.g. Stages 70/210/350 -> enter 70 and 210)'. No stored data changes (existing values were already end laps); DB columns stage1_laps/stage2_laps and payload keys stage1Laps/stage2Laps keep their names but now unambiguously hold end laps — any future caution/pit layer must read them as such. Nothing computes with them yet. Verified live.


## 2026-08-03 — Iowa Cup pre-practice board: first live output of the new stack (board 10c71c9b)

First board ever produced by wreck-v1.1-cb + gxc-v3.1-dnfLL + trail10-v3.1-sampledPD together. Config: projected lineup (sampling engaged), Medium caution (typical wreck pool), DNF Auto 7.12% (2 Iowa races), 350 laps, stages 70/210 (end-lap semantics), 50k sims, Hard Rock the only book posted (Monday).

Sanity: LL and FL each sum to exactly 350 (dnfLL allocation conserves the race). Hierarchy: Blaney 17.9% / Hamlin 15.0% / Larson 12.3%, clean tier break after. Burton-tail present — backmarkers carry 1-2% top-10 (Hill 1.1, Zilisch 1.2) vs the old hard zeros. Realized DNF mean 6.2% vs 7.12% budget = ratio 0.87, EXACTLY the documented mid-pool under-budget prediction (SHORT mid 2.7 vs 3.1 = 0.87) — wreck-v1.1 behaving as shipped. Observation (emergent, not measured): per-driver DNF runs a 5.3% -> 8.1% front-to-tail gradient, partly wreck-cluster field-edge behavior; directionally realistic but keep an eye on it.

Flags: Larson win EV +23 vs HR only 10%+ flag. Single-book Monday caveat — watch-item until DK/FD post and re-run; real candidate only if it survives a multi-book anchor.

Gates still open (need post-race): INT Brier N/A this week (SHORT track); Burton-tail vs observed and trail10-v3.1 pre-vs-post-quali delta get their first data points from this weekend.


## 2026-08-03 — projected-start accuracy measured: trail10 is at the history-method ceiling (no change shipped)

Operator asked whether start projections are accurate. Direct backtest, 338 races 2023+ (all three series, rank-vs-rank MAE among projection-eligible drivers): trail10 hybrid 6.36 positions overall (SHORT 6.19 / INT 6.35 / SS 6.98 / ROAD 6.02). Beats last-race-start baseline (7.51) everywhere; ties season-average at SHORT/INT; the shipped SS/ROAD conditioning earns its keep exactly there (SS 6.98 vs 7.42 unconditioned, ROAD 6.02 vs 6.43). Rear-start-penalty filtering variant (drop history entries pctile>0.72 when trailing median<0.45, 3.6% of entries) improves ALL by only 0.02 positions — NOT shipped, negligible.

Conclusion: ~6.3-6.4 positions is the practical ceiling for history-based grid projection; the residual is qualifying's own noise. This is precisely the error bar #73 sampling was built for (sampled grids reproduce the actual-grid favorite-gap profile, 14.8 vs 19.1) — the point estimate is mediocre BY NATURE, the distribution around it is honest, and the sim consumes the distribution. Only new information (practice speed) beats it, and the practice-to-quali window is minutes on modern schedules — not worth building. Question considered answered pending the routine live pre-vs-post-quali delta at Iowa.


## 2026-08-03 — SHIPPED pairing-first-car: multi-car ringer fix (0d1ec125)

**Operator caught it live.** O'Reilly Iowa pre-board priced Ross Chastain (JRM #9) at 4.2% win / FMV 22-1 while 365 hung +450. Diagnosis chain: (1) crossover_borrows was empty — operator added Chastain<-cup (panel clamps weight to max 1.0; his '2.0' saved as 1.0); (2) STILL 4.3% because pairing-first blended ALL his 2026 O'Reilly rows across cars — JRM #9 rows avg 108 (Charlotte WIN, Indy 130.5, Iowa-25 139.2) diluted by JAR #32 rows avg 82 into a ~92 blend, pricing a top-5 car like a midfield part-timer. Raw-cup fallback can't help either (cup ratings are scaled vs cup fields — 77 avg at short-flats — cross-series raw comparison is invalid).

**Change (borrowed drivers only).** Pairing now prefers rows in THIS week's entered car (from entry_list), last 2 seasons, prior season x0.6, min 2 rows; falls back to current-season any-car blend, then raw-src as before. Stamp borrowMode 'pairing-first-car'. Chastain's car-matched rating ~108 (vs 91.6 blended) — expect low-to-mid-teens win pct on re-run, consistent with the +450 market. Blast radius: only names present in crossover_borrows.

**Also noted:** borrow panel silently clamps blend weight to [0,1] — operator entered 2.0, stored 1.0. Board mv was null (no O'Reilly odds pasted at publish) so no market-anchor safety net on the bad price. Re-run required to take effect.


**2026-08-03 addendum:** operator re-ran O'Reilly Iowa — Chastain FMV +658 (13.2%) post pairing-first-car, inside the predicted low-to-mid-teens window vs 365's +450 (~15-16% de-vigged). Model slightly longer than market on a public-name favorite = expected calibration posture; no flag. Fix verified live end-to-end.


**2026-08-03 (UI):** Sim results pages (all three series) now show a stage badge on the published board — yellow 'Pre-Practice/Quali (projected grid)' vs green 'Post-Practice/Quali' — from the stored stage field (a29746a0). Operator request; subscribers can now tell projected-grid boards from real-grid boards at a glance.


## 2026-08-03 — SHIPPED trail10-v3.2-sampledPD-car: start projection car-matched for ringers (37bcd5ec)

Second limb of the multi-car ringer disease: Chastain projected P17 on the O'Reilly Iowa grid because trailing-10 blended JRM #9 qualifying (avg P9-10: 8/9/1/14 in 2026) with JAR #32 (avg P24: 30/21/29/15) and a P38 Martinsville outlier in a third car. Fix mirrors pairing-first-car exactly: the start-projection history now prefers rows in THIS week's entered car (>=3 rows since 2025) for drivers in crossover_borrows; falls back to category-conditioned then pooled history unchanged. Car-matched, he projects ~P9 — what a JRM 9 actually does. Per-sim sampling (#73) inherits the car-matched history list automatically, so his sampled grid distribution tightens to the correct car too. Blast radius: borrowed drivers only; regular drivers and post-quali real grids untouched. Stamp startProj 'trail10-v3.2-sampledPD-car'. Re-run needed.


## 2026-08-03 — NAME_ALIASES + start-projection diagnostic (f200b2ae, 8e887309)

**Sanchez orphaned by a nickname.** Operator noticed no projected start for Nicholas Sanchez (and Carson Brown). Sanchez's 40 loop rows are under 'Nick Sanchez'; his entry-sheet name 'Nicholas Sanchez' normalizes differently, orphaning his ENTIRE profile (corr, track, projection, pit — all name-keyed) onto neutral fills. Fix: NAME_ALIASES map inside normalizeName ('nicholas sanchez' -> 'nick sanchez'), the single choke point every lookup passes through. Full three-series audit of current entries vs loop names: this was the ONLY cross-source mismatch; Carson Brown and Derek Lemke have zero loop rows anywhere (genuinely new — neutral fills are correct for them).

**Chastain P17 mystery still open.** Car-matched projection replicates offline to P3 (pooled 0.465 ranks EXACTLY P17 between Caruth and Clements — pooled path confirmed at runtime despite v3.2 stamp and hard refresh). All static checks pass: entry row #9 correct, borrow row active, code verbatim-correct in live bundle, execution order correct. Shipped a TEMPORARY diagnostic (8e887309): projection-block runtime state (borrow keys, entCarMap, entries count, car-hist lengths) now captured into the publish payload as config.startDiag. Next operator publish tells us exactly what the runtime sees. REMOVE the diagnostic once solved.


## 2026-08-03 — SHIPPED car-auto-v1: automatic car-matching, borrow dependency removed (c9cb76ce)

Root cause of the persistent Chastain P17 finally isolated via the payload diagnostic: config.startDiag showed borrowKeys [] at runtime — the app's AUTHED session cannot read crossover_borrows (RLS asymmetry: anon reads work, authenticated blocked; writes work — row saved but invisible to the sim). Every borrow-gated feature has silently never functioned in production, including July's pairing-first work. Operator also decided borrow entries shouldn't be needed for car-matching anyway ("dialed in just using his 9 JRM rating starts") and deleted the row.

Redesign per operator intent: car-matching is now AUTOMATIC — any entered driver with <=15 current-season series races (part-timer), >=2 distinct cars in the 2-season window, and >=3 rows in THIS week's entered car gets rating (pairing) and start projection from that car only. Full-time regulars untouched (single car, or >15 races). crossover_borrows now only drives the raw-cup-translation fallback for drivers with NO usable series data — the RLS fix (grant authenticated SELECT) is still needed for THAT path but nothing else. Stamps: borrowMode 'car-auto-v1', startProj 'trail10-v3.3-carAuto'. Diagnostic (config.startDiag) left in for one verification cycle — REMOVE after confirmed.

Expected on re-run: Chastain rating ~108 car-matched + projected start ~P3 (car-matched pooled pctile 0.251 vs blended 0.465/P17). Sanchez alias fix already verified live (start P21 on 04:39 board).


**2026-08-03 addendum — car-auto-v1 VERIFIED LIVE, diagnostic removed (d3a29ea8).** Operator re-ran + published: Chastain projected start P2 (was P17), win 11.0% — co-favorite with Allgaier 11.1%, in line with a Cup star in JRM equipment. Sanchez alive at P19 with real profile (alias fix). Diagnostic (config.startDiag + window.__pbStartDiag) removed from the bundle. Final Iowa O'Reilly stack: car-auto-v1 + trail10-v3.3-carAuto + NAME_ALIASES. Standing note: crossover_borrows RLS still blocks authenticated SELECT — only matters if the raw-cup-translation fallback is ever needed; SQL fix already provided to operator (create policy for select to authenticated).


**2026-08-03 observation (no action):** Pre-practice O'Reilly board with HR odds pasted: market anchor lifted Chastain 11.0 -> 20.2% and Crews -> 16.2% (fills for empty practice slots draw from win-odds pctile; top-2 market rank fills near ceiling). 20.2% exceeds de-vigged market ~15-16% — possible anchor overshoot for extreme favorites on pre-practice boards. Flag guard correctly suppressed (mev -32, no circular flag). By doctrine (anecdote-not-benchmark) NOT retuned; logged as measurable watch item: test across accruing pre-practice boards whether anchored favorites systematically price above de-vigged market; if so, shade the fill mapping. Self-corrects post-practice when real laps replace fills.


## 2026-08-03 — SHIPPED trail10-v3.4-eqStart: equipment-start fallback (36a16e48, operator-directed)

Drivers with no usable loop history (Carson Brown #32, Derek Lemke #91, Tyler Tomassi #53 at Iowa) had NO projected start — null startPos, excluded from grid sampling. Operator's call: fall back on the equipment — the car number's series grid history under ANY driver. Implementation: projection block now also aggregates start pctiles per car number (2025+); entered drivers missing a projection after all driver-history paths get the car's last-10 grid history (>=3 rows required). Per-sim start sampling inherits the car's distribution — appropriate spread for an unknown driver in known equipment. Chain is now: own car-matched (part-time multi-car) -> own category-conditioned -> own pooled -> CAR's history -> null (truly new car+driver). Stamp startProj 'trail10-v3.4-eqStart'. Re-run picks it up.


**2026-08-03 (UI x2):** Pit Crew Rankings medal-cell ellipsis fixed (rank column clipped the 1.35rem emoji at 50px -> stray dots; now overflow visible + 1.15rem, 526252b3). Site-wide scroll affordance: permanently visible high-contrast scrollbars on all scroll containers via global.css (Windows overlay scrollbars hid the fact that wide tables scroll; e725fb93). Verified live on Loop Data.


**2026-08-07 (launch polish 1):** Qualifying Center header cleanup (afdeedd7) — removed static rainbow (orange Qualifying Order, gold Avg, purple 2026 Avg, accent history group); all headers uniform var(--text-secondary), accent now RESERVED for the active sort column (sort-aware conditional on every sortable th). Draw-order data cells orange -> primary; sim-note orange -> secondary. Design rule going forward, applied page-by-page as touched: muted uniform headers, color only for meaning (active sort, heatmaps, badges).


## 2026-08-07 — SHIPPED car-auto-v2: part-time gate dropped (d93aa82b, operator catch)

Operator spotted the second multi-car pattern car-auto-v1 missed: Rajah Caruth, entered in the #88 at Iowa, has run a FULL 22-race 2026 O'Reilly schedule split across two rides — #88 (12 races, avg rating 84.5, quali P1-P13) and #32 (12 races, avg 61.8, quali P25-P38). A 23-point rating split between his own cars, but v1's part-timer gate (<=15 season races) excluded him, so both rides pooled into a ~73 midfielder. Fix: gate is now simply >=2 distinct cars in the 2-season window AND >=3 rows in THIS week's entered car — no schedule-size condition. Single-car regulars unchanged; one-off relief drives harmless (entered car dominates); mid-season team switchers now rate in their current ride (consistent with driver-x-equipment doctrine). Stamps: borrowMode 'car-auto-v2', startProj 'trail10-v3.5-eqStart'. Expected on re-run: Caruth rating ~84.5 car-matched, projected start ~P8 from #88 grid history. Ringer-handling lineage now: pairing-first (RLS-dead, never ran) -> pairing-first-car -> car-auto-v1 (part-timers) -> car-auto-v2 (any multi-car).


## 2026-08-07 — SHIPPED ride-change delta double-count guard (8732bb92, operator catch)

Second interplay bug from car-auto-v2, operator-spotted on the Equipment Prior panel: the task-118 quarter-strength ride-change delta (applies +0.25 x (entered-car pool - modal-car pool) for established drivers whose entered car differs from modal) was firing ON TOP of car-matched ratings — Caruth showed '#44 -> #88 at 100%' while his rating already came directly from #88 races. Paying for the ride change twice. Fix: corrAvgMap now carries carMatched flag from the pairing blend -> threaded to driver as __carMatched -> ride-change delta skipped when true. Panel section relabeled 'auto-skipped for car-matched drivers'. The delta remains active ONLY for drivers with <3 rows in the entered car (true fresh switches) — exactly the population it was designed for. Thin-history equipment FILL untouched (regression toward car pool for low-conf corr remains correct).


**2026-08-07 observation (no action):** Operator asked whether the equipment-prior FILL double-counts like the ride-change delta did. It does not — the delta was additive (bonus on top of a car-matched rating = same info twice, now guarded); the fill is shrinkage (regresses a low-confidence corr score toward the car's all-driver pool = insurance against small-sample car-matched ratings). Working as designed and validated (task 118). One refinement noted for a future measured pass: conf counts corr-scoped races (Chastain n3 -> 75%) while the car-matched rating rests on 9 races — car-matched drivers arguably deserve conf from the pairing sample size, which would lighten shrinkage. Conservative as-is; not retuned without a backtest.


## 2026-08-08 — SHIPPED Pit Crew Rankings: rank-movement delta + two-crew comparison (dbd0b653, 8feebdd9)

Operator request for H2H matchup betting support. (1) Delta column: rank now vs rank with the latest race's stops (and its crew penalties) excluded — +N green / -N red / '=' / em-dash when no prior sample. Computed from the same fenced clean-4T pipeline (prevAdj = prev median + prev penRate x 1.75s), rank both, diff. (2) Cmp column: select any two crews -> comparison panel with per-stat winner highlights (Adj, median, best stop, 2T, consistency, pen/race, stops) + race-by-race median head-to-head record across shared races with scrollable per-race table. Verified live: #54 vs #20 JGR renders 10-10 across 20 shared races, Adj 9.80 vs 9.81. Columns 11 -> 13 (colgroup + drilldown colSpan updated). Data note: this is exactly the joint view the future matchup pricer (sim posMatrix) complements — crew H2H covers pit road, posMatrix covers the race.


## 2026-08-08 — practice capture v4: miss root cause fixed between sessions (operator-directed)

Iowa O'Reilly practice logged 71 missed laps (~30%). Root cause was NOT the 8s poll cadence: v3 polled all three series serially in one round with a 20s fetch timeout, so cup's dead feed (unreachable x50 that morning) stretched every round past an Iowa lap and starved the live xfinity capture. v4 (installed to cockpit, v3 backed up): FETCH_TIMEOUT 20->4s, per-series error backoff (3 fails -> 30s sit-out, others unaffected), ACTIVE_POLL 8->4s, gap reconstruction via vehicle_elapsed_time (elapsed delta across a lap-counter jump = missed laps' exact total; per-lap estimates flagged est=1 in a new trailing CSV column; overall averages stay exact through stalls), and best-lap recovery via best_lap/best_lap_time (missed personal bests inserted exactly - best5 integrity survives gaps). Logic validated by synthetic harness (3-lap gap: full coverage, exact best recovered, idempotent). Also verified live: lap-times.json is 403 during sessions (both browser + fetch), confirming live-feed state-diffing remains the only practice capture path. Operator restarts CAPTURE_PRACTICE.bat before cup practice.


## 2026-08-08 — SHIPPED DFS salary admin: DK CSV file upload + ID coverage (080ec7ed)

Operator caught the chain: the lineup optimizer's export writes DK's bulk-upload format 'Name (ID)' from salaries.__ids — but IDs only exist if the SALARY ingest saw them, and pasting from the DK website table carries no IDs (only the DK CSV export file does: Position, Name + ID, Name, ID, Roster Position, Salary...). Silent degradation: no IDs -> export emits bare names -> DK rejects the upload. Fix: 'Upload DK CSV file' button on the salary admin (FileReader -> same parseSalaries pipeline, which already captured IDs from ID columns), plus explicit coverage messaging: file import reports 'matched N drivers, M DK IDs captured' with a WARNING when IDs < drivers; paste import now reports ID count and nudges toward the CSV file when zero. Paste path unchanged for quick salary-only entry.


## 2026-08-08 — SHIPPED ownership ground-truth pipeline: step 1 of ownership projections (d5b1a40a)

dfs_ownership table created (operator ran dfs_ownership_schema.sql — select policy covers anon AND authenticated per the crossover_borrows lesson; verified 200 via anon REST). DFS Salary Admin gains an 'Ownership (post-contest)' section: upload or paste the DK contest-standings CSV (contains %Drafted per driver), pick contest type (GPP/Cash), rows upsert keyed series+year+race+driver+type. Parser is layout-agnostic (any line containing a known driver name + a percentage cell). Errors surface loudly incl. a missing-table hint. Ritual addition: after each race, export contest standings from DK and upload — Iowa is data point one. Steps 2-3 (regression on salary/value/start/last-finish/win-odds features once ~6-8 weeks accrue -> Own% + Leverage columns + GPP ownership-penalized builder mode) queued behind data accrual.


## 2026-08-08 — watcher validated vs ground truth + practice sheet builder shipped

**Tier-2 validation (operator's independent lap source, O'Reilly Iowa practice, 1,503 truth laps):** watcher TIMES are exact — measured laps match at the 0.01s level for all alignment-clean drivers; best laps 37/37 (the one 'mismatch' was the truth sheet's own rounding: Poole 24.5 vs our 24.48). Reconstructed (est=1) laps: median error 0.004s on steady runs; big misses only on pit-spanning gaps. The 304 missing laps scatter across the entire v3 era (episodic cup-feed poisoning), confirming the v4 root-cause diagnosis; v4's stretch shows no holes. Six backmarkers 'misalign' vs the third-party sheet purely by numbering convention (feed counts garage sits as laps; 57 laps >300s in capture) — filter >60s before computing metrics. VERDICT: v4 certified.

**New tool: pitboard_practice_sheet.py + MAKE_PRACTICE_SHEET.bat (cockpit).** Converts any watcher capture into the operator's upload-sheet format (POS/Driver/AVG LAP/LAP 1..N): flying-laps-only (>1.5x driver median dropped), sequential renumbering, sorted by avg; xlsx via openpyxl or csv fallback. Validated against the manual O'Reilly sheet: 37/37 drivers, median AVG-LAP diff 0.017s (worst 0.46s = Love, v3-era coverage holes). Ritual: after each practice, run the bat -> upload the SHEET file.

### GRADE FORMULA -> v5-lr20: pace .40 / speed .40 / longRun .20 (commit 6a5dc1c5, 2026-08-08)
Trigger: operator flagged Kyle Sieg graded 95/P2 on Iowa O-Reilly card with stored long_run 25.098
vs Jesse Love 24.647 (~0.45s off) - "cars with no long run speed rarely win."
NEW QUESTION, not a re-litigation: all prior grader backtests scored FULL-FIELD Spearman. Operator
doctrine stated 2026-08-08: the card is a user-facing eyeball tool for betting decisions and does
NOT feed the sim - so the right metric is winner/top-5 identification, never previously tested.
Backtest: 41 races, all 3 series 2026, final session per race, rank-scaled within practice_group,
finish joined from loop_data. Clean sample = 33 races with >=30% long_run coverage (column only
stored since 7/4; all-null races are neutral ties, low-coverage early races excluded).
Variants (missing longRun -> 50 neutral unless noted):
- CURRENT pace.50/speed.50:           winner mean rank 7.66, top5 10.60, hits 1.81, rho .444
- pace.40/speed.40/LR.20 neutral:     winner 7.32, top5 10.36, hits 1.85, rho .446
- pace.35/speed.35/LR.30 neutral:     winner 7.56, top5 10.28, hits 1.98, rho .442
- LR.50/speed.50 (replace pace half): winner 8.66 - WORSE, reconfirms 7/4 rejection of LR-as-pace
- **pace.40/speed.40/LR.20 missing->25 PENALTY: winner 7.32, top5 10.24, hits 1.95, rho .450 <- SHIPPED**
Clean-sample head-to-head vs current: winner rank 7.71->7.32, W13/L6/T12 (p~.08); full-field rho
.441->.447 (W18/L13). Directional, NOT significant - shipped anyway because: (1) display-only blast
radius (sim reads raw overall_avg/best5; practice_score only NULL-checked by the 7/22 EDGE gate -
verified in code this session); (2) wins or ties every metric including the old full-field one;
(3) penalty variant beat neutral, confirming the domain prior. Iowa spot check: Sieg 95.8->79.2
(P2->P7), Love stays P1, Chastain ~80.6 unchanged.
NOT SHIPPED TO SIM: this backtest scored the grade composite alone and says nothing about sim
calibration. Precedent: 7/4 sim A/B rejected avg_pace input (favorite gap +4.2 -> +9.2) - a metric
that helps the grade can hurt sim calibration. QUEUED: proper sim A/B (long-run-blended practice
input vs current, finish MAE + favorite calibration) after wreck-model gates grade.
Also removed: stale "V5 WEIGHTS" header in practiceGrader.js (longRunPace .50/shortRun .15/falloff
.15/consistency .10/bestLap .10) - dead doc describing a formula that never survived 7/4; it nearly
caused an unvalidated "fix" this session. The log outranks code comments.
Grades are computed at upload: stored grades unchanged until sessions are re-uploaded.

### GRADE FORMULA -> v6-tc: tire-corrected ranked metrics (commit 1fec32de, 2026-08-08)
Trigger: Gilliland A+/100 over Blaney at Iowa Cup - 44 laps in 10-15 lap sticker bursts (2 tire
sets allocated, operator confirmed set change) out-averaging Blaney 91-lap grind incl. 30-lap
runs at 24.05. Same mechanism as Sieg case same day: per-lap averages subsidize fresh tires.
FIX SHIPPED: per session, fit field-wide falloff slope beta (s per lap-on-tires) by pooled
within-stint demeaned regression on clean laps (x = lap-in-stint capped 40, stint >= 4 clean);
normalize every clean lap to lap-5 tire age (t - beta*(idx-5)); recompute all five ranked
inputs (avgPaceTC/best5TC/bestLapTC/overallTC/longRunTC) on corrected laps. Composite weights
unchanged (.40/.40/.20, missing longRun -> 25). gc group correction retargeted to TC keys.
STORED + DISPLAY metrics stay raw (same doctrine as gc: correct the ranked copy only).
BACKTEST (38 races w/ lap-level data in practice_laps, final session per race, ranked within
practice_group, finishes from loop_data; baseline = identical pipeline with beta=0 = v5-lr20):
- winner mean grade rank: 7.32 -> 6.24
- top5 finishers mean rank: 10.07 -> 8.91
- grade-top5 hitting finish-top5: 1.84 -> 2.11 per race
- full-field Spearman: .436 -> .454
- per-race W/L: winner rank W17/L10/T11; rho W25/L13 (sign test p ~ .04)
- median fitted beta 0.035 s/lap (physically sensible)
Wins every metric simultaneously - largest grader improvement on record. Iowa sanity: Cup ->
Gibbs 1 / Blaney 2 / Gilliland 3 / Bell 4; Oreilly -> Chastain 1 (30-lap runs finally priced),
Love 2, K.Sieg 7 -> 11.
LIMITATION: lap-in-stint is a tire-age PROXY - a stint break resets age even if tires kept;
with 2-set allocations the reset usually matches a set change. Track-evolution correction
(needs the new per-lap timestamps) remains queued separately and stacks on top later.
Grades computed at upload: re-upload a session sheet to regrade it under v6-tc.

### v6-tc CONFIRMED AT 97 RACES + v6.1 pace swap (commit 8a0b30ff, 2026-08-08)
Operator flagged the 38-race sample was too thin - practice_laps backfill actually spans
2023-2026 (97 scoreable races: 1x2023, 12x2024, 46x2025, 38x2026). Full-sample rerun, plus a
NEW validation target: grade rank vs RACE-DAY DRIVER RATING rank (race speed), which practice
actually measures - finish adds strategy/wreck lottery (rho .66 vs .45 on 2026 data).
97-race results (per-race Spearman means):
- v5 (uncorrected):        rhoSpeed .602, rhoFinish .407, winner rank 7.50
- v6-tc (tire-corrected):  rhoSpeed .637, rhoFinish .439, winner rank 6.73 - W63/L33 vs v5
  on rhoSpeed (p < .002). Tire correction CONFIRMED at scale, strongest result in this log.
- pace-swap variants (overallTC pace half, and .5/.3/.2 reweight): rhoSpeed .637/.636 -
  statistical ties (W50/L47, W51/L46), winner rank 6.50/6.43.
SHIPPED v6.1: pace half now ranks overallTC (mean of ALL corrected clean laps, lap-weighted)
instead of avgPaceTC (equal-weighted stints). Backtest tie -> tiebreak on construct: equal
stint weighting was the last structural bias (Blaney 91-lap Iowa session ranked below
50-lap sessions despite being faster in every window; avgPace historical edge over the
plain mean existed only because worn laps used to poison the mean - tire correction removed
that). Weights unchanged (.40/.40/.20). Reweight (.5/.3/.2) NOT shipped - logged for re-test
at ~150 races. Shrinkage by lap count tested and REJECTED (rhoSpeed .643, W12/L26).
Iowa sanity post-swap: Cup Blaney/Gibbs/Bell/Gilliland/Chastain; Oreilly Chastain/Love/
Allgaier/Creed/Sawalich.

### v6.2: speed half = RAW best5 (commit db25d6f2, 2026-08-08) + saturation/personal-slope tests
Operator disputed Chastain 100/P1 over Love on the Iowa Oreilly card (Love faster on every
window he ran, 42 vs 45 laps). Investigation found the corrected speed half let extrapolated
laps impersonate flyers (Chastain lap-40 24.65 -> 24.02 "equivalent" outranking Love real
24.12). Three fixes tested on the 97-race harness (rhoSpeed = grade rank vs race driver
rating; all vs live v6.1):
1. PERSONAL-slope correction (shrunken own falloff): rhoSpeed .631, W39/L53 - REJECTED.
   Flat personal falloff IS race-speed signal; correcting it away hurts.
2. Saturation cap sweep (A=15/20/25/30/40): monotone worse as cap shrinks (.632->.637);
   A=25 within noise (W30/L35/T32) but arbitrary knob - NOT shipped.
3. OPERATOR PROPOSAL - speed half ranks RAW best5 (bestLap fallback), like the sim input;
   pace + longRun halves stay tire-corrected at A=40:
   finish rho .435 vs .436 (tie, W46/L51); top5 rank 9.63/9.65 (tie); winner rank 6.32 vs
   6.50; rhoSpeed .640 vs .637 (W49/L48). Equal-or-slightly-better everywhere. <- SHIPPED
   Rationale: statistical tie + cleanest construct (only actually-driven laps in the speed
   half) + card credibility both series (Oreilly: Love/Creed/Allgaier/Chastain; Cup:
   Blaney/Gibbs/Bell/Gilliland). NOT claimed as a prediction improvement - it is a tie.
gc correction retargeted back to raw bestLap/best5 for the speed half.

## 2026-08-14 - v6.3-st SESSION-TIME CORRECTION (shipped WITHOUT historical backtest - impossible by construction)
Timestamps (practice_laps.captured_at) exist 2026-08-14 forward only; the 97-race harness cannot score this term. Shipped on construct validity (mirrors validated tire-correction architecture: pooled per-driver-demeaned residuals, 5-min group-relative bucket medians, effects centered, laps corrected by minus bucket effect; pace/longRun tire+session, speed half session-only on raw; ACTIVE only when >=60% clean-lap ts coverage + >=3 buckets w/ >=10 laps - all historical grading byte-identical). Evidence basis: 3 sessions (trucks + cup A/B Richmond 2026-08-14) show ~1.5-2.3s open-fast decay, near-identical shape; cup A/B natural experiment proves per-group reset (fresh-sticker window, not surface rubber). Trucks Richmond before/after harness: new top6 = Riggs/Honeycutt/C.Smith/Tyrrell/Majeski/SVG - contains 5 of the market's top 6 (old top6 had Hill 4th, Garcia 6th; market had them +50000/+6000). Early-window milkers demoted (Hemric 2->7, Hill 4->8, Garcia 6->19, Lewis 11->30), mid-session runners promoted (C.Smith 19->3, Ankrum 18->9, Haley 17->10). PROSPECTIVE VALIDATION PROTOCOL: each race weekend, corrected vs uncorrected grade rank-corr vs race-day driver rating; revert if it loses 2 consecutive weekends. Commit e0d1e8d2.

## 2026-08-14 - DFS GPP CEILING MODE vs MEAN-OPTIMAL (Iowa replay, real contest fields)
Method: identical inputs (pre-race published sim samples + posted salaries, Iowa R23); GPP pipeline = per-draw exact-optimal candidates (~1200 draws) scored by p90 total across ~2500 draws; scored with OFFICIAL DK FPTS from contest standings files; placed in the real entry distributions. CUP: mean-optimal 175.30 -> 1289/1417 (bottom decile) vs GPP#1 288.15 -> 635/1417 (top 45pct, +654 spots; cash line 337.75 missed - needed Bell 108-led monster). OREILLY: mean-optimal 201.15 -> 2412/4756 (median) vs GPP#1 264.55 -> 504/4756 (top 10.6pct - cashes standard GPP payout structures). Caveats on record: n=2 same-weekend, ceiling builds are high-variance BY DESIGN (GPP#2/#3 ranked 584-4383) - claim is structurally better tournament lineups from identical inputs, not weekly cashes. Ongoing: replay every uploaded standings file (dfs_contests) vs both modes.

## 2026-08-15 - v6.3-st PROSPECTIVE WEEK 1 (trucks Richmond R17): CORRECTED WINS (narrow)
vs race-day driver rating (protocol target, n=21 harness-ranked drivers): corrected rho 0.169, uncorrected 0.143. vs raw finish: both ~0 (-.07/-.01) - low-signal session (Heim sandbagged practice, finished P2 from 16th; Honeycutt led 225/250 and won, only true practice standout). Direction calls validated: Hill 3->8 (fin 33), C.Smith 19->3 (fin 7, 4th-best rating), SVG 14->6 (fin 4). Corrected's miss: Riggs #1 finished 15th. Sim MAE 5.26 pre / 5.29 post (fine, short track). Week 1 to v6.3-st; revert trigger = 2 consecutive losses. Standing lesson: no practice correction beats deliberate sandbagging - market input carries that signal.

## 2026-08-15 - DFS REPLAY RACE 3 (trucks Richmond R17, real field 2378 entries)
Official FPTS scoring, pre-lock sim samples + posted salaries. GPP-mode 294.00 vs mean-mode 288.60 - GPP >= mean for the 3RD STRAIGHT race (cup Iowa +113, oreilly Iowa +63, trucks Richmond +5; close because both builds shared 4 trucks incl. Honeycutt 132.4 who carried). Both ~top 30 pct, above median 234.15, winner 376.75. CHALK LESSON: Majeski 55.6 pct owned scored 27.3 (sank half the field; our sim liked him too - both builds had him but paired with survivors); Honeycutt 43.7 pct owned was hero chalk. Leverage overlay (upgrade 3) would have flagged Majeski-at-55 as fade of the week - ownership ground truth now 3 races deep.

## 2026-08-15 - v6.3-st PROSPECTIVE WEEK 2 (cup Richmond R24): UNCORRECTED WINS CLEARLY
vs race-day driver rating, n=36 (full DB harness: practice_laps WITH captured_at + practice_group, grader run corrected + uncorrected): UNCORRECTED rho 0.755 (excellent - above 97-race historical ~.64), CORRECTED 0.656 (-0.099). The correction's thesis inverted this week: Bowman (early-window poster child, uncorrected no.1) finished 10th from P25 - his early speed was REAL; corrected promoted Suarez to no.1 who delivered nothing. LEDGER: 1-1 (wk1 trucks corrected +.026, wk2 cup corrected -.099). Revert trigger = 2 consecutive losses - NOT hit; week 3 decides trajectory. Noted for diagnosis if wk3 loses: bucket-median correction magnitude may be too aggressive, or early-window speed carries genuine signal the correction erases. Sim: MAE 5.79, Logano won at 4th-best win prob (10.3), Briscoe P2 at 5th (5.1); Blaney 39.6 pct -> fin 13 (result, not model error); Cindric proj 20.2 -> fin 3 (strategy/track position - sims' weakest axis at Richmond).

## 2026-08-15 - DFS REPLAY RACE 4 (cup Richmond R24, 14268 entries): BOTH MODES FAIL TOGETHER
GPP and mean built the IDENTICAL lineup (Blaney/Byron/Berry/Wallace/Keselowski/Suarez) - 183.50, ~12875/14268 (bottom decile). Operator's 7 live entries shared this core = real-money loss. ROOT CAUSE UPSTREAM: sim 39.6 pct win on Blaney (fin 13) made every per-draw optimal contain the same chalk core - candidate diversity collapses under high sim conviction, ceiling-mode differentiation goes to zero. FINDING: GPP mode's edge is proportional to board uncertainty (Iowa flat board = big wins; Richmond conviction board = no differentiation). Fix path = ownership-leverage overlay (upgrade 3) forcing diversification off concentrated chalk. ALSO: field out-called sim on Cindric (our proj 20.2, field 37 pct owned no.2 chalk, fin 3 / 69.55 FPTS) - first case in 4 races of ownership carrying signal sim missed; watch for repeat. Ledger: GPP > mean 3 races, tie 1; ~2 cash-line builds, 1 near-miss, 1 faceplant.

CORRECTION (operator, race 4): Blaney was NOT the lineup killer - 55.3 FPTS (lineup's best; P13 but pole-stint dominator points paid his salary). Killers were the correlated support cluster: Keselowski 3.5 + Wallace 15.25 (two slots = 18.75 combined), Byron/Suarez mediocre. Sim's error = liking the whole Ford/practice-fast CLUSTER, which sagged together when the race broke toward Logano/Briscoe/PD plays (Logano 87.65, Larson 80.5, Cindric 69.55 - we rostered none). Refined finding: build lacked cross-script diversification, not a better anchor. Leverage-overlay fix path unchanged.

## 2026-08-19 - TRACK-TYPE-CONDITIONED RATINGS PRE-TEST: BLEND WINS DECISIVELY (queue no.3 DONE)
Method: 390 races 2022-26 all 3 series, 15,943 loop rows; per race predict race-day driver_rating from trailing-10 prior ratings (min 5 all / 3 same-type), per-race Spearman, chronological (no leakage). Results: ALL-tracks pooled (current-style) rho .6923; SAME-TYPE only .7041 (W214/L172 vs all); 50/50 BLEND .7205 - beats all-only in 278/390 races (71 pct). Weight sweep 0/.25/.4/.5/.6/.75/1 -> .692/.712/.718/.7205/.720/.717/.704: smooth concave, optimum .4-.6 type weight. READ: cross-type form carries real signal (reliability/team execution) - don't drop it - but same-type form deserves ~equal weight. Motivating case: Eckes NH pre board rank 12 vs market 4th-5th; his trailing-10 all=95.0 (Michigan 79/WG 59 drag) vs flat-type=114.5 (Martinsville 150, Bristol 134) - blend ~105 moves him several spots toward market. NEXT: sim A/B wiring 50/50 type blend into rating construction, board-level paired backtest before ship (fresh session task).

CORRECTION (2026-08-19, operator-prompted code check): the sim's corrAvgRating pool is ALREADY track-type-conditioned - loopRows filtered .in(track_name, corrNames) where corrNames = same correlation_group_label. Michigan/Atlanta never touched Eckes' NH rating; his rank-12 comes from 1 low-conf NH race (84.8), P15 start proj, no win conversion, strong flat field in normalization. REINTERPRETATION of the pre-test: sim ~= the TYPE-ONLY predictor (.704); the improvement is ADDING an all-tracks trailing component at ~half weight into corr - blend vs type-only: .7205 vs .7041, blend W244/L138/T8 (64 pct, p<1e-7). A/B spec flips accordingly: corr* = ~0.5 x same-group + ~0.5 x all-tracks trailing form (year-weighting kept), board-level paired backtest before ship.

CORRECTION (operator, wk2 narrative): 'Bowman's early speed was real' was backwards - uncorrected ranked Bowman no.1, he raced ~top-10 (fin 10 from P25): an OVERRATING that the corrected card improved (Bowman 6th). Corrected's aggregate loss was driven by its own no.1 (Suarez, delivered nothing), not by Bowman. Verdict unchanged (field-wide rho .755 vs .656, n=36) but the lesson refines: BOTH cards overrated Richmond's early-window runners; the open question is correction STRENGTH, not direction. On/off protocol stands until the timestamped pool (~8-10 sessions) supports fitting strength.

## 2026-08-20 — longRun missing-penalty RE-TEST at 3x sample: 25 HOLDS, no series split (no ship)
Trigger: operator questioned the missing-longRun -> 25 penalty after NH trucks S1 (qualifying-sim
short-runners + DNQ stakes make skipping long runs rational); asked for penalty re-test overall
AND cup-only / trucks-only splits.
Method: browser harness reimplementing v6-tc ranked pipeline (parseStints -> pooled within-stint
demeaned tire slope -> overallTC pace / RAW best5 speed / longRunTC >=10-lap; rank-scaled within
practice_group; composite .40/.40/.20). Final session per race, all stored sessions; finish joined
via RACES table race_id (loop_data.race_number never trusted). 98 scoreable races: 44 cup, 26
oreilly, 28 trucks (vs 33 clean in the 8/8 ship test). Variants: missing lr -> 25 / 35 / 50.
- ALL n98:  p25 win 6.38 t5 9.62 rho .442 | p35 6.34/9.64/.441 | p50 6.35/9.64/.440
- CUP n44:  p25 win 8.14 rho .342 | p50 8.09/.341 - flat wash
- ORE n26:  p25 win 4.61 rho .552 | p50 4.70/.550 - penalty best
- TRK n28:  p25 win 4.96 t5 8.97 rho .498 | p50 4.88/9.09/.493 - neutral better on WINNER only,
  penalty better on t5 + rho, per-race rho 14W/12L - noise, not a truck effect
- Per-race rho 25v50: 52W/35L/11T (p~.07, same direction as 8/8 at 3x n). Winner rank TIES in
  75/93 races - the penalty almost never touches the top of the card (top graders long-ran
  anyway); its work is midfield ordering.
VERDICT: NO CHANGE. missing->25 reproduces its edge at n98; no series-conditional penalty
justified. Sieg doctrine ("no long run rarely wins") re-confirmed. Note: harness skips gc prior-
rating correction (matches 8/8 method); NH trucks S1 itself unscored (race not run).

ADDENDUM (operator asked for depth beyond winner/t5): same 98 races, t3/t5/t10 mean rank + hits.
ALL n98: t3 8.56/8.55/8.55 h3 .86/.86/.88 | t5 9.62/9.64/9.64 h5 1.79/1.78/1.80 | t10
12.07/12.09/12.12 h10 4.73/4.73/4.74 (order p25/p35/p50). PATTERN: variants identical at
winner/t3 (neutral +.02 h3 ~ 1 hit per 50 races), penalty pulls ahead as depth increases (t10) -
consistent with mechanism: no-long-run drivers are midfield, penalty only reorders there. CUP:
neutral hair better at h3/h5 (.80/.77, 1.66/1.64), penalty better t10 - offsetting noise. TRK:
penalty best at depth (t5 8.97v9.09, t10 11.20v11.30, h10 4.75v4.71), gives back .04 h3. ORE:
penalty-or-tie everywhere. Verdict unchanged: keep 25.

## 2026-08-20 — RIDE-CHANGE STALE-MODAL FIX: weighted modal SHIPPED (k=0.25 delta reconfirmed)
Trigger: operator flagged Garcia (#13->#98) still in the ride-change panel 18 races into his
#98 season, and Majeski (#98->#88 cosmetic team renumbering) appearing at all.
Harness: leak-free chronological rebuild of the 7/9 ride-change study, now on loop_data.car_number
stamps (87.7 pct coverage) instead of the GFS join. Per driver-race: established (>=4 prior rows),
prior-only year-weighted driver pool + car pools (n>=2 both), obs = current car differs from RAW
modal. n=2813 obs (vs 1689 in 7/9): train 22-24 1143 / test 25-26 1670; cup 833 / ore 1369 / trk 611.
Metric: pooled Spearman(adjusted rating, finish), sign-flipped.
- REPRODUCTION: k0 test .485 -> CUR (k.25, raw modal) .496. Original k=0.25 ship reconfirmed.
- DECISIVE SPLIT: FRESH changes (weighted history still in old car, n1927, shareNew mean .21):
  k0 .462 -> CUR .478 -> WMODAL .479. The delta's entire edge lives here.
  GARCIA CLASS (weighted history already flipped, n885, shareNew mean .54): k0 .523 vs
  stale-delta .523 DEAD TIE (train +.002 / test -.002) while shifting ratings mean |2.57| pts.
  Pure noise on ~31 pct of all ride-change obs.
- Variants on test: CUR .496, DECAY (k*(1-shareNew)) .496, WMODAL .496 aggregate; WMODAL best
  on test cup (.368 v .365) and trucks (.536 v .533). DECAY adds complexity, no measured gain.
SHIPPED: modal car count now uses yrWt (same weights as the rating pool) in SimulationCenter -
one-line change, delta formula untouched. Garcia flips to #98 within ~a race (weighted 51 v 53.2
full-season; corr-window proportional); fresh movers (Kligerman case) unchanged - WMODAL is
best-or-tied on every test cut. Evidence class = same harness family that shipped k=0.25.
MANUAL infl OVERRIDES STAY: car-number-keyed pools cannot see team renumbering (Majeski #98->#88
same truck - his 105.4 "old pool" is his own history under the old number; delta semantics
nonsense there). Operator zeroed him by hand - that context lives in the operator's head, exactly
the crossover_borrows doctrine. Weighted modal will ALSO retire renumbered veterans from the
panel within ~a season-third, but week-one after a renumbering the manual zero is the only fix.

## 2026-08-20 — startPos PRE-TEST (operator "overvaluing start" hunch): raw vs MARGINAL, by series/type
Cheap loop-data scan (no sim), 432 races: per-race Spearman(start, finish) raw, and PARTIAL
controlling walk-forward prior driver rating (last-20 mean, >=4 prior races) - the marginal
value start adds beyond driver quality.
RAW: trucks S/F .576 (NH class - highest anywhere), ore Int .509, cup S/F .474, cup Int .373
(weakest non-SS oval), SS .10-.26. Series: cup .370 ore .441 trk .455. 2026 .398 vs prior .420.
PARTIAL: cup Road .333 (HIGHEST - yet ROAD_COURSE_WEIGHTS runs startPos 0.15), cup S/F .240,
cup Int .170, trk S/F .154, trk Int .141, ore Int .111, ore S/F .112, SS .03-.06.
Series partial: cup .195, trk .138, ore .120.
READ: most raw grid predictiveness is SPEED SELECTION (fast cars qualify well - corr already
knows); pure position value is ~.11-.19 on ovals. BUT sim startPos double-serves as this-
weekend current-form speed (freshest speed data on the board) - which is why three full-model
sweeps (11/29/40-race, win/top-N Brier standard) kept 0.33: they score the bundle. "Overvalued
overall" NOT supported; HETEROGENEITY is real and unmatched by current sets: ore ovals lowest
marginal (case to trim), cup road highest marginal on the LOWEST weight set (possibly backward).
NEXT (queued, behind ownership overlay): per-series/track-type startPos sweep in the FULL model
on market Briers (Chicagoland-reconstruction harness family). No weight changes from this
pre-test alone - it cannot see the bundled current-form role.

## 2026-08-20 — startPos FULL-MODEL CONDITIONED SWEEP (230 races) — SHIPPED 0.23 default + trucks-short 0.33 exception
Follow-up to same-day pre-test; the sweep the pre-test said was required. PRODUCTION sim, not a
proxy model: buildSpeedScores + runRaceSim evaled from repo source (lines 0-610, JSX stripped),
so every yrWt/lrpTime/corr rule is the real one. 230 races 2023+ with published-grid + loop-data
coverage: cup INT 52 / SHORT 36, ore INT 49 / SHORT 27, trk INT 35 / SHORT 31 (SS + road excluded
- they have their own weight sets). Walk-forward leak-free inputs, actual starting grids, 2000
draws/race, Medium caution preset, dnfRate 0.12. Scored on win/top5/top10 Brier vs actuals,
paired per race. PROXY CAVEATS: no equipment prior, no winConv, no market anchor - relative
weight comparison only, same harness family as the 3 prior startPos sweeps.
- GLOBAL: startPos 0.23 beats 0.33 per-race t10 134W/96L (p~.01 sign test), t5 123W/107L,
  win 127W/103L. Lower still (0.13) mixed; HIGHER 0.43 loses 92W/138L. Prior "0.33 optimal"
  came from 11/29/40-race mostly-cup samples - at n230 the bundle is overweighted.
- BY CELL: cut helps or ties everywhere EXCEPT trucks SHORT/flat (NH class): there 0.23 LOSES
  t5 12W/19L, t10 11W/20L - consistent with pre-test raw .576 (trucks short grids stay put).
  0.43 marginally beat 0.33 there but n=31 - kept validated 0.33, no new weight invented.
- PRACONLY subset (n95, boards built pre-qualifying): same direction, 0.23 wins - not a
  qualifying-leak artifact.
SHIPPED: DEFAULT_WEIGHTS.startPos 0.33 -> 0.23; new TRUCK_SHORT_WEIGHTS (identical but startPos
0.33) auto-applied when series=trucks and __trackGroup=SHORT, in both the config auto-apply and
the Reset button. SS/ROAD/TRUCK_ROAD sets untouched. Operator hunch ("we overvalue start") =
CONFIRMED at scale, with one real exception cell. NH impact: cup board now runs 0.23, trucks
board unchanged 0.33. Prospective watch: same ledger discipline as v6.3-st - if the cup boards
go 0-fer two straight weekends on t5/t10 vs books, revisit.

## 2026-08-22 — CLARIFICATION to the 8/20 startPos ship: the cut RENORMALIZED every other weight (no revert; result stands)
Code check prompted by a review of the 8/20 entry. buildSpeedScores computes
`wTotal = sum(weights)` and divides each term by it, and DEFAULT_WEIGHTS does NOT sum to 1.
Cutting startPos .33 -> .23 moved the total 1.04 -> 0.94, so every OTHER term's effective
share rose even though its literal value never changed:
  startPos     .33/1.04 = 31.73%  ->  .23/0.94 = 24.47%   (-7.26 pts, not the -10 the entry implies)
  corrHistory  .35/1.04 = 33.65%  ->  .35/0.94 = 37.23%   (+3.58)
  longRunPace  .15/1.04 = 14.42%  ->  .15/0.94 = 15.96%   (+1.54)
  trackHistory .15/1.04 = 14.42%  ->  .15/0.94 = 15.96%   (+1.54)
  pitCrew      .06/1.04 =  5.77%  ->  .06/0.94 =  6.38%   (+0.61)
THE SWEEP RESULT STANDS - it ran the PRODUCTION sim, which renormalizes, so the arm labelled
"0.23" was scored as this exact bundle. Nothing to revert. What the entry got wrong is the
DESCRIPTION: it reads as a startPos-only change, when mechanically it is "cut startPos share
7.3 pts, redistribute proportionally to corr/longRun/track/crew". Anyone tuning from that
entry would mis-state the arms.
DOCTRINE (new, general): a weight edit that changes wTotal silently re-weights every other
term. Contrast the 2026-07-04 trackHistory move (corr .40->.35, track .10->.15) which held
the total at 1.04 and was therefore a clean two-term trade. Future weight changes should
state whether they are share-preserving or total-changing, and sweeps should report effective
shares, not raw values.
CONSEQUENCE (queued, not urgent): corrHistory has never been swept at its new 37.2% share -
0.35 is a leftover from the 7/04 trade, validated at 33.7% on n=40 mostly-cup. The 0.30 arm
is the one that restores the old effective share. Same for longRun/trackHistory at +1.5 each.
SCOPE: all DEFAULT_WEIGHTS boards (cup INT+SHORT, oreilly INT+SHORT, trucks INT).
TRUCK_SHORT_WEIGHTS still sums to 1.04, so trucks short/flat shares are untouched - NH trucks
runs the old bundle exactly, NH cup runs the new one.

## 2026-08-22 — stint-splitting "missing lap" hypothesis REFUTED by timestamps; duplicate lap numbers found instead (data bug, 10.4% of sessions)
HYPOTHESIS UNDER TEST: parseStints splits a run on any lap-number discontinuity
(`laps[i][0] === laps[i-1][0] + 1`), so a single missing lap would cut a 20-lap run into
10+9, both below the >=10-clean-lap longRun cut, dropping the driver to the missing->25 fill
- a 20%-of-composite swing. Prevalence looked large: on 60,000 practice_laps rows / 1,956
driver-sessions, 700 sessions have no long run, and bridging one-lap gaps rescues 499 of them
(25.5% of ALL sessions). Big enough to matter if the gaps were artifacts.
THEY ARE NOT. captured_at (2026-08-14+) labels them directly: of 90 single-lap gaps in the
timestamped era, 90 are REAL PIT VISITS - wall clock 167-435s against 24-25s laps - and ZERO
look like a dropped lap (which would show ~2 lap times of wall clock). The strict split is
CORRECT; bridging would merge runs across a pit stop and corrupt long-run pace exactly where
it is load-bearing. No change shipped. This also re-confirms the 8/20 n=98 finding from a
different direction: those 25s are mostly drivers who genuinely never ran 10 clean laps.
CAVEAT ON THE LABELS (do not over-read): the timestamped era is ~3.6k rows, short tracks only,
and begins AFTER capture v4 (2026-08-08) fixed upstream misses - i.e. it is precisely the era
where artifacts are least likely. Pre-08/08 sessions cannot be labelled this way. The claim is
"gaps are real where we can check", not "the historical pool is clean".
WHAT THE SCAN FOUND INSTEAD - DUPLICATE LAP NUMBERS: 204 of 1,956 driver-sessions (10.4%)
contain the same lap_number twice for the same driver/session. 4,476 pairs carry DIFFERENT
times (two sessions or two uploads interleaved under one session_number - e.g. cup 2025
Phoenix lap3 27.424 vs 27.46, lap4 27.54 vs 27.708) and 1,438 pairs are byte-identical (true
double-inserts). Effect is severe and silent: after the sort, laps read 1,1,2,2,3,3..., and
since a repeat is not prev+1 the parser emits a chain of 1-2 lap stints. 133 of the 204
affected sessions therefore have NO gradable long run at all and take the 25 fill wrongly,
with avgPace/consistency corrupted alongside. By year: 2024 x34, 2025 x132, 2026 x38 - still
occurring. Sample counts, from 60k of an unfinished full-table pull; treat as a floor.
NEW HAMPSHIRE IS CLEAN: 0 duplicated sessions across both uploaded R18 sessions (trucks S1 41
drivers, cup S1 36). 12 of 77 NH driver-sessions take the 25 fill and all inspected cases are
legitimate (Ankrum 35 laps, LaJoie 32, Queen 32 - laps run, never 10 consecutive clean).
Tomorrow's boards are NOT affected; no pre-race action taken, deliberately - v6.3-st week 3 is
judged this weekend and a grader-side change now would make that ledger unattributable.
NEXT (post-NH, in order): (1) full-table duplicate audit + a dedupe rule keyed on
(series, year, track_name, session_number, driver_name, lap_number); (2) decide whether
historical dedupe is applied - it CHANGES historical grades and therefore the 97-race harness
baseline, so it needs its own before/after grade-bar run rather than a silent cleanup;
(3) an upload-time guard so a re-upload replaces rather than interleaves.

## 2026-08-22 (later) — CORRECTION (operator-prompted) to the entry above: these are NOT duplicates, they are TWO SESSIONS UNDER ONE session_number. Dedupe would destroy real data.
The entry above calls the repeated lap_numbers "duplicate lap numbers" and frames the fix as a
dedupe keyed on (series,year,track_name,session_number,driver_name,lap_number). That framing is
WRONG and the operator's question ("what exactly is stored in the tables?") is what surfaced it.
WHAT IS ACTUALLY STORED. Worked example, cup 2025 Phoenix (3,866 rows): two upload batches 52
minutes apart on 2026-07-04, BOTH written with session_number = 1.
  07:07 -> 2,276 rows, 37 drivers, lap numbers to 78
  07:59 -> 1,590 rows, 38 drivers, lap numbers to 68
Tested whether batch B is a re-scrape of batch A: it is not. Of 1,346 (driver, lap_number) pairs
present in both, only 64.3% agree within 0.5s (median diff -0.074s), and batch B contains FIVE
drivers absent from batch A entirely (Van Gisbergen, Stenhouse Jr., Herbst, Yeley, Mears). A
re-scrape adds no drivers and does not move a third of its laps by >0.5s. These are two DIFFERENT
practice sessions stacked into one session_number.
WHY THE LAP NUMBERS COLLIDE: lap numbering restarts at 1 in every session, so once two sessions
share a session_number every driver who ran both has two lap 1s, two lap 2s, and so on. The rows
are all REAL LAPS. Nothing is duplicated in the "same fact stored twice" sense.
THE DOWNSTREAM DAMAGE IS UNCHANGED and still the point: parseStints continues a run only on
prev+1, so a sorted 1,2,3,3,4,4,5,5 shatters the session into 1-2 lap fragments, no run clears the
>=10-clean-lap bar, and the driver takes the missing-longRun->25 fill after a 70-lap day. 133 of
204 affected driver-sessions in the 60k sample lose their long run this way.
THE FIX FLIPS COMPLETELY: RE-LABEL the later batch (session_number 2, or the true session index),
do not delete. The candidate dedupe in practice_duplicate_audit.sql section 5 would have deleted
an entire real practice session per affected track. It was commented out and marked DO NOT RUN, so
nothing was lost, but it is being replaced with a batch-identification query rather than left as a
trap for a future session. The 1,438 byte-identical pairs are a genuinely separate and much smaller
class (true double-inserts) and only those are dedupe-eligible.
STANDING LESSON: "the same key appears twice" has at least two causes with OPPOSITE remedies -
the same fact written twice (delete one), and two different facts sharing a key that is not
actually unique (fix the key). Establish WHICH before writing any cleanup, by checking whether the
second batch carries information the first does not - new entities, systematically different
values. Row counts alone would not have separated these.
NH R18 remains clean (0 affected sessions) - no change to the race-day picture.

## 2026-08-22 (final) — !! RETRACTION !! (operator-prompted, 2nd catch same day): there is NO practice-lap data bug. Both entries above are VOID — the collisions were my own grouping error.
RETRACTS the 2026-08-22 "duplicate lap numbers" entry AND its same-day CORRECTION. Both are
wrong. The operator asked "there is always only 1 practice session in 2026 — are you only talking
about Phoenix 2025?" My explanation REQUIRED two practice sessions per weekend; he knew that is
false for 2026, and the premise collapsed under three queries.
WHAT ACTUALLY HAPPENED: practice_laps carries a race_number column. I keyed my scan on
(series, year, track_name, session_number, driver_name) and OMITTED it. Phoenix hosts two Cup
races per season — the spring race is race_number 1, the championship race is race_number 36.
Both practices are legitimately session_number 1. Byron's "two lap 3s" are one lap 3 from each
RACE. Same for every other supposed collision.
CONTROLLED PROOF, identical 60,000 rows, only the key changed:
  key WITHOUT race_number -> 1,956 driver-sessions, 204 colliding
  key WITH    race_number -> 2,160 driver-sessions,   0 colliding
CODE CHECK (should have come first): the app has always been correct. Admin.js scopes its
delete-then-insert upload replace with .eq('race_number', practiceRaceNum); LapComparison.js and
PracticeLapTable.js both filter reads on race_number. The application never saw a collision
because there was never one to see.
EVERYTHING DOWNSTREAM IS VOID: the "133 of 204 sessions wrongly take the missing-longRun->25
fill" claim, the year counts (2024 x34 / 2025 x132 / 2026 x38), the "10.4% of sessions" figure,
the relabel prescription, and practice_duplicate_audit.sql — the file is DELETED from the repo
rather than left as a trap. NH R18 being "clean" was also meaningless: nothing was dirty anywhere.
WHAT SURVIVES from the whole thread: exactly one small positive result — single-lap gaps in the
timestamped era are REAL PIT VISITS (90/90, wall clock 167-435s against 24-25s laps), so
parseStints' strict prev+1 split is correct and bridging gaps would corrupt long-run pace. That
finding stands on its own evidence and is unaffected. The separate startPos-renormalization
clarification (same day, earlier) also stands — it was verified in code arithmetic, not from this
scan.
THE LESSON, and it is the expensive one: I invented a defect by analysing the table with a
weaker key than the application uses. Before reporting ANY data-integrity finding, read how the
code queries the table and reproduce its grouping exactly — a scan key that is coarser than the
production key will always manufacture collisions. I also compounded it by examining ONE example
(Phoenix 2025) and generalising a mechanism from it, which is the same single-case error the log
warns about elsewhere ("never grade on one race"). The operator's domain knowledge caught this,
as it caught the best5 multi-set-era mechanism and the NW truck equipment overrides. Third
instance on record of a mechanism built by a model session and falsified by one sentence from
the person who watches the races.

## 2026-08-23 — QUEUE #3 ALL-TRACKS BLEND INTO corrAvgRating: NO SHIP (341 races, all four track groups). The pre-test's estimator gain does NOT reach the market bar.
Closes queue item #3, owed since the 2026-08-19 pre-test + correction. Pre-test finding being
tested: ADD all-tracks trailing form at ~half weight into the (already type-conditioned)
corr rating — rating-prediction Spearman blend .7205 vs type-only .7041, W244/L138/T8, p<1e-7,
smooth concave optimum at w=.4-.6. That was a cheap loop-data scan; the entry required a
BOARD-LEVEL paired backtest in the full sim before ship. This is that run.
METHOD: production buildSpeedScores + runRaceSim evaled from repo source. 341 races 2023+,
ALL FOUR track groups (not just INT+SHORT), each scored with the weight set production would
actually use — DEFAULT / TRUCK_SHORT / ROAD_COURSE / TRUCK_ROAD / SUPERSPEEDWAY /
ONEILLY_SUPERSPEEDWAY — so superspeedways (corr .55) and road courses (corr .60) are included,
where corr carries the most weight. Walk-forward, prior races only, actual grids, 2000 paired
race-seeded draws, Medium preset, dnfRate .12. Same proxy caveats as the startPos family: no
equipment prior, no winConv, no market anchor, no pit crew — relative comparison only.
ARM CONSTRUCTION (one variable): corrAvgRating = (1-w)*group-pool + w*all-tracks-pool, both
year-weighted with the live ladder. nCorrRaces stays the GROUP count in every arm, so
confidence/shrinkage is identical and only the rating VALUE moves. w = 0 (current) /.25/.4/.5/.6/.75.
VALIDATION GATE (run BEFORE the new arms, on the same harness): startPos 0.23 vs 0.33 on
INT+SHORT reproduced at 134W/64L t10, p<.001 — the THIRD independent reproduction of the 8/20
result from a from-scratch harness. The rig is sound before it is trusted on anything new.
RESULT — EVERY ARM IS A TIE vs current on all four markets:
  blend .25   win 180W/161L p.33 | t3 176/165 p.59 | t5 188W/153L p.066 | t10 179/162 p.39
  blend .40   win 182/159 p.23   | t3 173/168     | t5 180/161 p.33     | t10 176/165
  blend .50   win 179/162 p.39   | t3 170/171     | t5 178/163 p.45     | t10 174/167
  blend .60   win 177/164 p.52   | t3 167/174     | t5 180/161 p.33     | t10 169/172
  blend .75   win 172/169        | t3 162/179     | t5 171/170          | t10 165/176
Best single cell is blend .25 on t5 at p=.066 — one of 20 arm x market comparisons, exactly what
chance produces. MEAN win Brier DEGRADES MONOTONICALLY with w: 23.71 / 23.78 / 23.85 / 23.92 /
24.00 / 24.13. A clean dose-response in the WRONG direction on the sharpest market.
BY GROUP (blend .25): Superspeedway 30W/24L p.50, Road 25W/31L p.50, Intermediate 73W/63L p.20.
All ties. POST-HOC NOTE, NOT A FINDING: cup superspeedway alone showed win 17W/5L (n=22), which
is the intuitive story — SS specialists (Blaney group 95.2 vs all-tracks 88.2) diverge most where
corr weight is highest. It DISSOLVES at group level because trucks SS runs 3W/8L the other way.
Logged as a hypothesis for a pre-registered test, not as evidence; mining cells after seeing the
aggregate is the post-hoc subsetting this log warns about elsewhere.
VERDICT: NO SHIP. corrAvgRating stays type-only. Queue #3 CLOSED.
DOCTRINE (the point of the entry): the pre-test predicted race-day driver_rating decisively
better — W244/L138 at p<1e-7 — and that gain did not survive contact with the betting markets.
Predicting a driver's rating is not the same objective as pricing his win probability. This is
the two-bar rule (grade bar vs composite/market bar) applied to an ESTIMATOR change, and it is
the second time this season a decisive estimator result failed the market bar. Plausible
mechanism: the sim already routes cross-type information through trackHistory, the equipment
prior and the market anchor, and type-conditioning is a FEATURE when pricing at that track type
rather than a limitation to be corrected. Any future "widen the pool" proposal should be scored
on Briers directly and should not treat a rating-prediction improvement as sufficient.

## 2026-08-23 — v6.3-st PROSPECTIVE WEEK 3 (cup New Hampshire R25): PRE-REGISTERED, both cards frozen BEFORE the race
Ledger stands 1-1 (wk1 trucks Richmond corrected +.026; wk2 cup Richmond corrected -.099).
Revert trigger = 2 CONSECUTIVE losses, and WEEK 2 WAS A LOSS — so a week-3 loss reverts v6.3-st.
Both orderings are written below BEFORE race-day driver_rating exists (loop_data has 0 rows for
cup R25 at time of writing), which is the pre-registered-confirmatory discipline this log uses.
WHY NH IS THE CLEAN TEST: NASCAR has dropped A/B practice groups, so the grade-side group-condition
correction self-disables (single group). Week 3 therefore isolates the session-time correction with
no gc confound — the first time that has been true.
PRECONDITIONS VERIFIED (this is what killed wk1 trucks): cup NH has 2,083 laps / 36 drivers at
100% captured_at coverage, a 48.8-minute session spanning 10 five-minute buckets — comfortably past
the >=60% clean-lap + >=3 bucket activation gate. The correction IS active on the live cup card.
TRUCKS NH HAS ZERO TIMESTAMPS (1,455 laps, 0 captured_at). Second consecutive truck session with no
timestamps, so no truck card has EVER been corrected in live use. Week 3 is cup-only. Operational
fix owed: the practice watcher has to run for truck sessions too, not just cup.
FROZEN ORDERINGS (n=36 gradable):
  CORRECTED  : Byron | Gibbs | Berry | Blaney | Wallace | Logano | Larson | Buescher | Briscoe |
               Elliott | Keselowski | Bell | Allmendinger | E.Jones | Preece | Cindric | Hamlin |
               Gragson | Herbst | JHN | Chastain | SVG | Zilisch | Reddick | Bowman | McDowell |
               Z.Smith | Suarez | Gilliland | Hocevar | T.Dillon | A.Dillon | Custer | Hill |
               Stenhouse | Ware
  UNCORRECTED: Gibbs | Blaney | Berry | Byron | Buescher | Wallace | E.Jones | Larson | Elliott |
               Logano | Bell | Cindric | Preece | Briscoe | Allmendinger | JHN | Hamlin | ...
BIGGEST DISAGREEMENTS (uncorrected -> corrected): Keselowski 19->11, Erik Jones 7->14,
Briscoe 14->9, Herbst 25->19, Logano 10->6, Cindric 12->16, JHN 16->20, Z.Smith 22->27.
Byron 4->1 and Gibbs 1->2 at the top. Erik Jones is the motivating case for the mechanism: he ran
one unbroken 40-lap stint, and the correction reads that as window-advantaged and demotes him 7 spots.
SCORING RECIPE (operator-runnable, no session context needed): after the race, pull driver_rating
from loop_data for (series cup, year 2026, track New Hampshire Motor Speedway, race_number 25).
Compute Spearman(grade rank, driver_rating) for BOTH orderings above over the drivers present in
both. DECISION RULE, FIXED NOW: higher rho wins week 3. If CORRECTED loses, that is two consecutive
losses and v6.3-st REVERTS per the standing trigger. If CORRECTED wins, ledger goes 2-1 and the
protocol continues to week 4. No other outcome is a result — no re-cutting by driver subset, no
switching the target from driver_rating to finish.

## 2026-08-23 — !! PROTOCOL CORRECTION !! the v6.3-st "2 consecutive losses" revert trigger is a COUNTDOWN, not a test. Replacing it (operator-prompted).
CORRECTS the decision rule stated in the 2026-08-14 v6.3-st entry and restated in the wk1/wk2
ledger entries and in the same-day week-3 pre-registration above. The measurements in all of
those stand; only the RULE is wrong.
OPERATOR'S CATCH: "I don't think after today's results it will be enough to decide - that is still
a small sample size." Correct, and the arithmetic is worse than small-sample. Treating each
weekend as one paired win/loss, the expected number of weekends until a 2-consecutive-loss streak
appears is (1+q)/q^2 where q = P(loss):
    correction truly neutral (wins 50 pct) -> reverted after ~6.0 weekends
    wins 60 pct                            -> reverted after ~8.7 weekends
    wins 70 pct                            -> reverted after ~14.4 weekends
    wins 80 pct                            -> reverted after ~30.0 weekends
The streak occurs eventually with probability 1 for ANY win rate below 100 pct. The rule does not
measure whether the feature works; it measures how long the feature has been running. If the
correction is neutral, the chance of tripping the trigger is already 38 pct by weekend 3, 67 pct
by weekend 6, 86 pct by weekend 10. Week 2 was a loss, so the CURRENT pre-registered rule would
revert on a single further loss tomorrow at an effective false-positive rate near coin-flip.
SECOND DEFECT, independent of the first: one rho per weekend is ONE BIT per weekend. A session
carries ~36 drivers each with a rank error under both cards; collapsing that to win/loss discards
nearly all of it. Driver ranks are coupled (zero-sum), so 36 is NOT 36 independent observations —
but a within-session PERMUTATION test respects the coupling and yields a per-weekend effect size
WITH uncertainty instead of a coin flip. That is the difference between accruing evidence and
accruing anecdotes.
THIRD ISSUE, operational: trucks sessions keep uploading with no captured_at (Richmond wk1, NH wk3),
so the pool accrues at HALF the available rate. Fix the watcher for truck practice.
THE RULE THAT REPLACES IT, fixed now:
 1. EMERGENCY STOP (keeps the original safety intent, which was risk management for a change that
    could not be backtested): revert immediately if CORRECTED loses by more than 0.15 rho in any
    single weekend. That is a MAGNITUDE trigger — it catches a feature that is actively harmful
    without firing on noise. Neither wk1 (+.026) nor wk2 (-.099) would have tripped it.
 2. NO STREAK-BASED REVERT. Weekly results accrue; they do not adjudicate.
 3. JUDGE AT 8-10 TIMESTAMPED SESSIONS, which is the threshold the original 2026-08-14 entry
    already committed to ("on/off protocol stands until the timestamped pool ~8-10 sessions
    supports fitting strength"). The protocol drifted off its own stated plan; this restores it.
 4. Judge on POOLED EFFECT SIZE (mean paired delta with its uncertainty across sessions), not a
    W/L tally. Report the sign test alongside as a secondary.
 5. Per weekend, record the effect size and a within-session permutation interval, not just which
    card won.
WEEK 3 IS RESCORED UNDER THE NEW RULE: tomorrow's cup NH result is a DATA POINT, not a verdict.
The frozen orderings in the pre-registration above are unchanged and still binding.
OPERATOR POSITION ON RECORD: he expects time-correction to be right long term. That is a prior,
not evidence, and it is logged as such — it does not change the decision rule, and the pooled
judgment at 8-10 sessions stands whichever way it goes.
STANDING LESSON, generalizes past this feature: a streak-based revert trigger on a noisy weekly
metric is a countdown dressed as a test. Any future prospective protocol on this project should
use a magnitude trigger for emergencies plus a pre-committed sample size for the verdict. This
log already contains the principle it violated here — "THAT IS NOT EVIDENCE AGAINST THE
HYPOTHESIS. It is NO POWER. Different thing entirely."

## 2026-08-23 — DFS REPLAY RACE 5 (trucks New Hampshire R18, 2,378-entry GPP): GPP beats mean a 4th time, but BOTH lose badly — and DK's salary line out-predicted our projections
LEAK CHECK FIRST: sim samples written 2026-08-22 15:45 (with the post-qualifying board), salaries
15:05, results not uploaded until 23:53 and ownership 00:26 next day. Samples predate the race by
~8h — this is a pre-lock replay, not hindsight. 36 drivers, 10,000 draws, official DK FPTS from the
contest-standings upload, placed in the real 2,378-entry field.
RESULT: GPP-mode p90-ranked build 175.60 vs mean-optimal 141.40. GPP +34.2 — GPP >= mean for the
4TH time in 5 replays (ledger: GPP 4 wins, 1 tie). But both are well under the 196.25 median:
  mean-optimal 141.40 -> ~1945/2378 (bottom 18 pct)
  GPP no.1     175.60 -> ~1512/2378 (bottom 36 pct)
  contest winner 319.40 | perfect-hindsight optimal 330.90 (Riggs/C.Smith/Haley/Friesen/Eatmon/Tyrrell)
DIAGNOSIS — PROJECTION FAILURE, NOT CONSTRUCTION. Both modes shared a bad core, so mode choice was
never going to save the slate. The model's own top of board busted:
  JHN        proj rank 2  -> 28.0 actual (48.8 pct owned - chalk bust, in BOTH lineups)
  Ruggiero   proj rank 5  -> -3.85 actual (in BOTH lineups)
  Eckes      proj rank 6  ->  5.0 actual (38.5 pct owned)
  Perez      proj rank 10 -> 17.0 actual (33.9 pct owned, in BOTH lineups)
while the points came from drivers we ranked 11-22: Zilisch (11) 64.35, Friesen (17) 50.0,
Haley (22) 51.0, plus Eatmon at 2.99 pct owned.
THE RIGGS CASE IS NOT A PROJECTION MISS: the model ranked Layne Riggs 3rd and he was the slate's
top scorer at 88.6. He carried a $13,000 salary — the most expensive truck on the board — and never
fit under the $50k cap alongside the rest of our top projections. We identified him and could not
afford him. That is a cap-allocation failure, a different disease from mis-ranking.
CALIBRATION vs THE STANDING BENCHMARK (Spearman vs actual FPTS, n=36):
  our projections  0.291
  DK salary line   0.384   <-- the market beat us
  field ownership  0.369   <-- the crowd beat us
FIRST TIME ON RECORD the DK salary line has out-predicted our projections on a slate. The benchmark
this log set for DFS is beating salary Spearman; this week we did not.
VALUE INVERSION (the mechanism worth remembering): our value metric, projected points per $1k,
correlated -0.346 with actual outcome. NEGATIVE. The optimizer maximises projection under a cap,
which structurally tilts it toward high points-per-dollar drivers — and on this slate those were
systematically the worst plays (Ruggiero -3.85, Perez 17.0, Hall 25.0 at 5,700). The cap did not
just prevent us from rostering Riggs; it actively pushed us into the drivers that sank the lineup.
CAVEATS — do not over-read: n=1 SLATE. Spearman SE at n=36 is ~0.17, so the 0.291-vs-0.384 gap and
the -0.346 value figure are each about half to two SE. This is an ANECDOTE with a mechanism, not a
verdict; the log's own rule is never grade on one race. What earns a re-check is whether value
inversion REPEATS — if proj-per-dollar keeps landing negative, the optimizer's objective is wrong
for truck slates, which would be a much bigger finding than any mode comparison.
LEDGER: DFS replay now 5 races (GPP 4 wins, 1 tie). Ownership ground truth now 6 contests banked
against the 8-10 refit target. Ownership-leverage overlay (queue no.1) would not have rescued this
slate — the chalk we rostered was OUR OWN top-of-board, not a leverage error.

ADDENDUM to DFS REPLAY RACE 5 (operator challenge, same day): "our projections for trucks last race
were kind of broken because the exposure tool wasn't working properly." CHECKED — the premise does
not hold for this replay, but the check sharpens the finding.
(1) TIMING: the exposure death-spiral fix (8a48b136) landed 2026-08-21 and the JHN entry-name fix
(e3b7ec39) landed 2026-08-19. The samples replayed here were generated 2026-08-22 15:45. Both fixes
predate the board. JHN reads correctly in entry_list (TRICON Garage) with 5 prior truck races pooled.
(2) SCOPE: applyExposure shapes how a SET of lineups is delivered. It never touches dfs_sim_samples
or the single optimal lineup. The replay built one build per mode straight from the raw draws and
never entered that code path — the bug could not have contaminated it either way.
(3) BOARD QUALITY, from sim_grades rather than assertion: trucks NH R18 post graded MAE 6.62 /
mae_rank 6.29 (pre 7.11 / 6.35). Season context: trucks Richmond R17 5.59, cup Richmond R24 5.79,
oreilly Iowa R23 7.64-7.77, cup Iowa R23 8.09-8.18. NH trucks sits MID-RANGE. This was a normal
board, not a degraded one.
WHERE THE OPERATOR IS RIGHT: his REAL-MONEY entries that weekend are a separate surface. If he built
them before 8/21, the spiral was live and his delivered set would have been degenerate — that is a
genuine problem and it is not what this replay measured.
WHAT THE CHECK CHANGES: the finding gets STRONGER, not weaker. A working finish model with normal
MAE still lost the FPTS ranking to the DK salary line (.291 vs .384), and it had the slate's top two
scorers at proj ranks 1 and 3 — it SAW Riggs and C.Smith. The failure was not perception. Riggs at
$13,000 would not fit under the cap, and the money saved by skipping him went into the highest
points-per-dollar drivers available, who were exactly the busts (value corr -0.346). That is a
DK-points-and-cap-allocation problem sitting ON TOP OF a functioning finish model — a narrower and
more tractable target than "the projections are broken". NOTE the distinction for future entries:
finish-position accuracy and DK-points ranking are different objectives; DK points add place
differential, laps led and fastest laps, and dominator points are lumpy in a way finish MAE hides.

CORRECTION to the addendum above (operator, same day): the conditional is now CONFIRMED FACT. He did
build and upload the NH trucks entries BEFORE noticing the exposure spiral, and could not fix them
after upload — his delivered set WAS degenerate. So his real-money result that weekend carries no
information about the model, and should not be pooled with the replay ledger or read as a board
failure. The replay (one build per mode from raw pre-lock samples) remains the clean model test and
its numbers are unaffected.
SECOND OCCURRENCE OF THE SAME REAL-MONEY FAILURE MODE, different cause: cup Richmond R24 delivered
7 entries that all shared one thesis because exposure was left uncapped (habit); NH trucks R18
delivered a degenerate set because applyExposure was spiralling (bug, since fixed 8a48b136). Both
times the operator uploaded before the problem was visible, and both times the money was already
committed when it surfaced.
THE MISSING CONTROL IS NOT THE BUG FIX — it is that nothing inspects the SET before it leaves the
tool. Proposed guardrail (queue candidate, small): a pre-export check on the lineup set that reports
distinct-lineup count vs requested, realized max exposure vs requested cap, and the count of drivers
appearing in >X pct of builds — and refuses/warns on export when the delivered set is materially
narrower than asked for. The exposure bug is fixed; the failure CLASS (ship a degenerate set,
discover it after upload) has now cost real money twice and has no detector.

## 2026-08-24 — CUP NEW HAMPSHIRE R25 POST-RACE: board grades, v6.3-st week 3 (CORRECTED WINS, ledger 2-1), and DFS replay race 6 (FIRST GPP LOSS)
Result: Blaney won from P8; Wallace P2 from P23; Berry P3; Bell P4; Larson P5.

### BOARD GRADES (sim_grades, both stages graded 08-24 00:11)
                    PRE (08-20)      POST (08-23 17:25)
  mae                  7.46             7.13   <- post better
  mae_rank             8.44             7.67   <- post better
  spearman_pf          0.477            0.523  <- post better
  win Brier            0.0199           0.0211 <- PRE better
  top3 Brier           0.0743           0.0748 <- pre marginally
  top5 Brier           0.0910           0.0805 <- post better
  top10 Brier          0.1593           0.1440 <- post better
  precision t10        6                7      <- post better
  DK mae              17.38            18.22   <- PRE better
  DK corr              0.413            0.356  <- PRE better
  DK spearman          0.407            0.336  <- PRE better
READ: practice/qualifying input improved FINISH-POSITION accuracy and the top-5/top-10 markets,
but made the WIN market and every DK-points measure worse. The operator's observation is the
mechanism: pre had Blaney alone at the top (19.6 pct win); post moved BELL from 10.0 -> 18.8 pct,
tying him with Blaney at 18.8 and displacing Blaney from the outright top slot. Blaney won, Bell
finished 4th. Practice also HELPED Berry (proj finish 18.2 -> 11.0, finished 3rd) and HURT Wallace
(win 1.0 -> 0.3 pct, proj ~17, finished 2nd from P23). Season context for mae 7.13: mid-range
(trucks Richmond 5.59, cup Richmond 5.79, oreilly Iowa 7.64, cup Iowa 8.09). Normal board.
CLV: the PRE board DOES carry CLV - 24 plays, 83.3 pct positive, plays avg +20.17 pct vs field
+14.74 pct. The POST board reads all zeros, but that is NOT a logging failure: its flags were
written 17:19, minutes before lock, so there was no window for the market to move. Structural,
not operator error. Flags written that close to the close cannot generate CLV by construction.

### v6.3-st PROSPECTIVE WEEK 3 (cup NH R25) — CORRECTED WINS
Scored against the pre-registered frozen orderings (BACKTEST_LOG 2026-08-23). The uncorrected list
was TRUNCATED at 17 names when logged - my error - so both cards were REGENERATED from the same
practice_laps and verified byte-identical to the frozen prefixes (uncorrected first 17 and corrected
first 10 both match exactly) before scoring the full 36.
  PROTOCOL TARGET, Spearman vs race-day driver_rating, n=36:
    CORRECTED 0.624   UNCORRECTED 0.596   delta +0.028  -> CORRECTED WINS
  Secondary vs raw finish, n=36: corrected 0.445 vs uncorrected 0.448 (dead tie, -0.003)
LEDGER 2-1 (wk1 trucks +0.026, wk2 cup -0.099, wk3 cup +0.028). Under the RETIRED streak rule this
would have been "no second consecutive loss, continue"; under the corrected protocol it is simply a
data point. POOLED so far: mean delta -0.0150, sd 0.0728, sem 0.0420 across 3 sessions - i.e. the
pooled effect is indistinguishable from zero and is dominated by the single wk2 loss. 3 of the 8-10
sessions needed. Emergency stop (single-week loss worse than 0.15 rho) NOT approached in any week.
NOTE: week 3 was the first CLEAN test - A/B practice groups are gone from the format, so the
group-condition correction self-disabled and only the session-time term was in play.

### DFS REPLAY RACE 6 (cup NH R25, 14,268-entry GPP) — MEAN BEATS GPP, first GPP loss
Leak check: samples 08-23 17:25, results 08-24 00:09 (~7h gap). Pre-lock.
  mean-optimal 207.80 -> ~9080/14268 (63.6 pct from top)
  GPP no.1     150.70 -> ~11674/14268 (81.8 pct from top)   GPP#2 148.3, GPP#3 157.3
  contest median 225.90 | winner 392.20 | perfect hindsight 409.30
Both under median, and GPP lost to mean by 57.1 - the FIRST clear GPP loss. Ledger: GPP 4 wins,
1 tie, 1 loss in 6 replays.
CAUSE: GPP faded the winner. Mean-optimal rostered Blaney (101.45 pts, the slate's top score);
the p90-ranked GPP build did not, taking Bell/Wallace/Chastain instead. This was a CHALK-DELIVERS
slate - the top three scorers were ALL 30 pct+ owned (Blaney 37.3, Berry 35.6, Wallace 30.5) - which
is precisely the condition where ceiling-mode differentiation is a liability. This CONFIRMS the
standing finding from the other direction: GPP's edge is proportional to board uncertainty. Iowa
(flat board, chalk busted) was its big win; here the field's chalk was correct and fading it cost 57.
CALIBRATION - THE REPEAT FINDING, now 2 for 2 (Spearman vs actual FPTS):
    our projections 0.322 | DK salary 0.426 | field ownership 0.430
  Last week (trucks): ours 0.291 | DK salary 0.384 | ownership 0.369.
  The DK salary line and the crowd have now BOTH out-predicted our DK-points ranking on two
  consecutive slates, in two different series. At n=2 this stops being a slate anecdote and starts
  being a pattern worth a real investigation. Note this sits ON TOP of normal finish-position
  accuracy (mae 7.13, mid-range) - the model ranks FINISH fine and ranks DK POINTS poorly, which
  points at the DK-specific terms (place differential, laps led, fastest laps) rather than the
  core speed model.
VALUE INVERSION DID NOT REPEAT: proj-per-$1k vs actual was +0.256 here against -0.346 at trucks NH.
So last week's negative value correlation was slate-specific, not structural. Good - that kills the
scarier of the two hypotheses and leaves the narrower one (DK-points ranking) standing.
DATA CAVEAT: these samples came from the 17:25 board, which was published from a STALE TAB and
therefore carries no dk_start_pos - Ty Dillon (rear-overridden, real start P33, sim P36) has a DK
projection inflated by ~3 pts. He appears in neither replayed lineup, so the comparison is unaffected.
NEXT: (1) a DK-points-specific diagnostic - decompose our FPTS error into finish pts vs place
differential vs laps led vs fastest laps, to find which term is mis-ranked; that is the actual
lever, and it is now cheap with the connector. (2) Ownership pool is 7 contests, refit at 8-10.

## 2026-08-24 — DK FPTS DECOMPOSITION at 9 races: no broken component; compounding is real but modest; "the market beats us" was a 2-slate artifact — the real signal is TRUCKS-ONLY
CORRECTS two claims I made earlier the same day off a 2-race sample. Operator pushed back ("can't
you use a bigger sample than just these two races?") and he was right — the sample was available
the whole time. The decomposition needs only published boards + loop_data; it never needed contest
or ownership data, which is what I had wrongly treated as the binding constraint.
METHOD: all 9 POST boards with results (cup Indy R22, cup Iowa R23, cup Richmond R24, cup NH R25,
ore Indy R22, ore Iowa R23, trk IRP R16, trk Richmond R17, trk NH R18), 32-37 drivers each.
DK scoring split into its four terms: finish points (DK table), place differential (start-finish),
laps led x0.25, fastest laps x0.45. Projected components from the board (proj_finish, start_pos,
laps_led, avg_fast_laps); actual from loop_data. Per-race Spearman on each component and on the
total, then averaged across races (races have different field sizes, so pooling raw ranks would be
wrong). Variance shares computed per race on ACTUAL component values.
COMPONENT RESULTS (mean rho across 9 races, and mean share of actual FPTS variance):
    finish points     0.605    26 pct
    place differential0.573    19 pct
    laps led          0.461     7 pct   <- weakest component
    fastest laps      0.665     4 pct   <- strongest, counterintuitively
    TOTAL FPTS        0.475     --
    mean of the four  0.576
    covariance between terms   45 pct of variance
FINDING 1 — NO COMPONENT IS BROKEN. Everything sits 0.46-0.67. Laps led is the weakest, which was
the original hypothesis, but it carries only 7 pct of the variance: ranking it perfectly would barely
move the total. Fastest laps, which I expected to be noise, is the strongest term. The "find the
broken term and patch the dominator curve" plan is DEAD — do not spend a weekend on it.
FINDING 2 — ERRORS COMPOUND, MODESTLY. The total ranks BELOW the average of its components by
-0.101, in 7 of 9 races. (Below EVERY component in 5 of 9 — my 2-race claim that this was universal
was overstated.) Summing four estimates whose errors were independent would beat the parts; getting
worse than the parts means one per-driver error contaminates all four terms in the same direction.
Consistent with 45 pct of actual variance being covariance: in a real race the four terms move
together, and so do our misses.
FINDING 3 — THE CORRECTION THAT MATTERS. "DK salary out-predicts our DK-points ranking" does NOT
hold at 9 races. Head to head (per-race Spearman vs actual FPTS, drivers with both a salary and a
result): WE WIN 4, SALARY WINS 5, and one of those losses is 0.362 vs 0.365 (a tie). Means: ours
0.480, salary 0.499. Essentially even. The earlier 2-slate claim sampled a truck race plus one of
the worst cup boards of the season.
    cup      (4 races)  ours 0.402  salary 0.404   dead even
    oreilly  (2 races)  ours 0.619  salary 0.597   we win
    trucks   (3 races)  ours 0.492  salary 0.562   SALARY WINS ALL THREE, mean gap -0.070
THE SURVIVING SIGNAL IS TRUCKS-ONLY: 0-3 against the DK salary line, every truck race on record.
n=3, so this is a lead and not a finding - but it is a well-targeted lead, and it is the only part
of the earlier "market beats us" story that survives contact with the full sample.
ALSO WORTH RECORDING: our DK ranking is 0.475 on average, not the 0.32 quoted from NH. Range across
boards is 0.288 (cup Indy) to 0.826 (ore Indy). NH cup and Indy cup were two of the worst boards of
the season; Richmond (0.637 cup, 0.722 trucks) and ore Indy (0.826) are what a good week looks like.
Single-slate DK correlations are extremely noisy - do not read one.
NEXT if trucks repeats: compare truck projDK vs salary at 5+ races before acting. If it holds, the
question is whether truck DK projections should carry a salary/market anchor the way the win market
already does (marketAnchor v1.4) - a market term is a cheaper fix than a model term and it is the
one place the market has demonstrably out-predicted us.
METHOD LESSON, third instance today: I twice drew a conclusion from the smallest sample in reach
when a 4x sample was one query away. The operator caught it both times. Before reporting any
cross-race pattern, count the available races FIRST and state n in the same sentence as the claim.

### PRE vs POST BOARD SWEEP — does practice+qualifying actually improve the board? (2026-08-24)
QUESTION the operator raised after New Hampshire: the pre board had Blaney projected to win and he
won; the post board dropped him to second. Is the post-practice board actually better, or are we
publishing a downgrade? The pre/post stage was shipped 2026-07-06 to measure "the marginal value of
practice+qualifying" and has never been scored across races.

SAMPLE — STATED FIRST (method lesson from 2026-08-24 applied). NINE paired boards, every race in the
DB that has BOTH a pre and a post publish: cup Indy R22 / Iowa R23 / Richmond R24 / NH R25; oreilly
Indy R22 / Iowa R23; trucks IRP R16 / Richmond R17 / NH R18. All 2026. 327 paired driver-rows joined
to loop_data (about 95 pct of board rows; misses are name variants — A.J. Allmendinger, Daniel
Suarez, J.J. Yeley, Nick Sanchez, Andres Perez, Jackson MacEnko, Mike Christopher Jr — all resolved
by a normalizing join, plus Christopher Bell listed on the trucks R17 pre board and never started).
All 9 races have their winner inside the matched set. Probabilities renormalized per board over the
matched set so the pre board is not punished for carrying a non-starter; RAW (unrenormalized) results
are reported alongside and are indistinguishable.

HEADLINE — POST IS BETTER ORDERED, NOT BETTER CALIBRATED.

FINDING 1 (STRONGEST). The eventual winner's rank on the win board improves or ties in 9 of 9 races
and REGRESSES IN NONE. Pre -> post: 21->13, 7->4, 4->4, 1->1, 7->6, 5->4, 2->1, 3->1, 2->1. Seven
strict improvements, two ties, zero regressions (exact binomial on the 7 non-ties, p=0.008). The
same direction shows in a wider ordering metric: the actual top-5 finishers sit at mean board rank
7.04 pre and 6.40 post (-0.64 slots), improving in 7 of 9 races. CAVEAT: winner-rank was chosen
AFTER looking at the Brier table, while chasing the mechanism — it is not a pre-registered metric.
It is reported first because it is the most natural single ordering statistic and because the
top-5-finisher version, computed independently, agrees.

FINDING 2. Brier says "post, probably" and cannot prove it at n=9. Paired per-race deltas
(post minus pre, negative = post better):
    win    post 5 / pre 4   mean -0.00158   t=-1.24
    top3   post 6 / pre 3   mean -0.00146   t=-0.77
    top5   post 7 / pre 2   mean -0.00455   t=-1.17
    top10  post 5 / pre 4   mean -0.00416   t=-0.85
Directionally post on all four markets, significant on none. RAW check: win 5/4 -0.00160 t=-1.25,
top5 7/2 -0.00463 t=-1.19, top10 5/4 -0.00449 t=-0.95 — renormalization changes nothing.

FINDING 3. Post boards are much SHARPER. Top favorite's win pct averages 17.8 pre and 25.3 post;
Shannon entropy of the win distribution falls in 8 of 9 boards. Cup is where it is extreme: Iowa
18.1 -> 39.5 and Richmond 28.0 -> 39.6. Practice data does not merely reorder the board, it
concentrates it.

FINDING 4 — WHERE THE SHARPENING IS NOT EARNED. High-confidence win picks (model >= 12 pct):
    cup      pre  n=11  predicted 16.8  hit 9.1      post  n=12  predicted 20.8  hit 8.3
    non-cup  pre  n=11  predicted 14.8  hit 9.1      post  n=13  predicted 17.5  hit 23.1
Cup favorites were ALREADY over-confident pre (16.8 stated vs 9.1 realized — consistent with the
long-standing win-market overconfidence that marketAnchor and the favorite-shade tool exist to
address), and the post board makes it WORSE, not better. This is the one place the post board is a
genuine downgrade, and it is the win market only — top-N calibration is fine in both stages (top-10
reliability, pooled 9 races: pre 0.077 predicted / 0.102 observed in the 0-20 band, post 0.055 /
0.076; both bands above 20 pct track within a few points).

FINDING 5 — THE SERIES SPLIT IS REAL IN DIRECTION AND OVERSOLD IN SIZE. Brier by series:
    cup (n=4)      win 0-4 PRE WINS (+0.00160, t=+2.38)   t3 2-2   t5 2-2   t10 2-2   MAE 3-1 post
    non-cup (n=5)  win 5-0 POST (-0.00413, t=-2.96)  t3 4-1 (t=-2.60)  t5 5-0 (-0.01085, t=-3.60)
Tempting story: practice matters more in trucks/Xfinity (thin history, wide talent spread) than in
Cup (rich history, practice adds little). DO NOT BANK IT. The non-cup edge is largely favorite-hit
luck: the post favorite WON ALL THREE truck races at a stated ~25 pct each (3-for-3 at 25 pct is a
1.6 pct event). Strip that and the Brier advantage mostly evaporates. Conversely, on FULL-FIELD
ordering the split runs the OTHER WAY — Spearman(proj_finish, actual finish) improves post in 4 of 4
CUP races (+0.029/+0.039/+0.021/+0.045, mean +0.034) and in only 1 of 5 non-cup. Two metrics, two
opposite series splits, both at n=4/n=5. Neither is a finding. Subgroup was not pre-registered.

THE OPERATOR'S CASE, RESOLVED. NH cup R25: pre had Blaney at projFin 7.50, top of the board. Post
had Blaney 7.10 with Christopher Bell 6.90 — Blaney to second by 0.20 of a position. Real, and a
coin flip, not a systematic downgrade; on win pct both sat at 18.8 and Blaney stayed the co-favorite,
and that same post board scored the BEST full-field Spearman gain of the four cup races (+0.045).
The instructive miss on that board is elsewhere: William Byron 4.7 pct pre -> 14.3 pct post, finished
30th. That is Finding 4 in one driver — practice pushed a Cup driver up and the confidence was not
earned.

VERDICT. Nothing to ship; this is a measurement of an existing feature, not a candidate change.
Keep publishing post as the operative board — it is better ordered on every ordering statistic tested
and never once ranked the winner worse. Do NOT read post-board CUP win percentages at face value for
win-market bets; that is where the added confidence is demonstrably unearned. Concrete candidate for
later (NOT built, NOT tested): make the favorite shade / marketAnchor STAGE-AWARE, leaning harder on
post cup boards than pre. That is a real proposal with a real mechanism behind it, and it needs its
own pre-registered test before anything moves.

NEXT DATA. This sweep gains a pair every race weekend that gets both publishes. Re-run at 15-18
pairs; the Brier deltas are the metric that needs the sample, the winner-rank result is already
past its bar. Two of the four cup pairs came from boards flagged elsewhere as season-worst (Indy,
NH) — watch whether the cup win-market gap narrows as board quality regresses to mean.
NOTE: three temporary DB objects (pb_norm, pb_prepost, pb_delta) were created for this analysis and
DROPPED at the end. No schema, model, or code change was made.

### CORRECTION + FOLLOW-ON to the pre/post sweep: THE BOARD READS PACE, NOT FINISH (2026-08-24)
CORRECTION, operator catch. I used William Byron (cup NH R25, 4.7 pct pre -> 14.3 pct post, finished
30th) as the one-driver illustration of "post boards are over-confident in cup." That was WRONG.
Operator: "Byron lost a wheel while inside the top 5." The loop data agrees — 26 laps led, high
position 1, mid-race 11, 296 of 301 laps, status running. That is a fast car that broke. The post
board rating him 14.3 pct was VINDICATED by pace and refuted only by attrition. Strike the example.

That prompted the right question: how much of the cup "over-confidence" in FINDING 4 is really
attrition rather than bad speed reads? Auditing the 12 cup post picks at >=12 pct win: of the 11 that
did not win, Larson accounts for two (a lap-43 DNF at Indy, 18 laps down at Iowa), Byron is the wheel,
and Blaney TWICE led the race decisively and lost it late (129 laps led -> P3 at Iowa, 88 laps led ->
P13 at Richmond). Only a minority were genuine pace misses.

NEW TEST (9 paired boards, same sample). Rank-correlate each board's win pct against TWO targets:
finishing position, and average running position (pace). Result, in ALL NINE RACES, the board tracks
PACE better than it tracks FINISH:
                          pre vs FINISH  post vs FINISH   pre vs PACE  post vs PACE   post gap
    cup Indy R22              0.407          0.385           0.515        0.632         +0.247
    cup Iowa R23              0.311          0.358           0.303        0.507         +0.149
    cup Richmond R24          0.698          0.616           0.704        0.706         +0.090
    cup NH R25                0.497          0.504           0.578        0.593         +0.089
    ore Indy R22              0.905          0.856           0.898        0.926         +0.070
    ore Iowa R23              0.398          0.355           0.798        0.785         +0.430
    trk IRP R16               0.618          0.634           0.812        0.796         +0.163
    trk Richmond R17          0.762          0.697           0.824        0.833         +0.136
    trk NH R18                0.642          0.598           0.823        0.854         +0.256
9 of 9, gap +0.070 to +0.430, mean +0.181. And the gap WIDENS from pre to post: mean pace-minus-finish
is +0.113 on pre boards and +0.181 on post boards.

WHAT THIS MEANS. Practice data buys PACE KNOWLEDGE and almost none of it survives into finishing
position. In cup the pace read improves in 4 of 4 races (mean rho 0.525 -> 0.610) while the finish
read does not move at all (0.478 -> 0.466). The post board genuinely knows which cars are fast; the
sim then converts that into a finishing order and the conversion throws most of it away.

THIS REVISES FINDING 4, IT DOES NOT ERASE IT. The cup high-confidence win rate is still 8.3 pct
realized on 20.8 pct stated (n=12) and the practical advice is unchanged — do not read post cup win
percentages at face value. But the DIAGNOSIS changes, and so does the fix. It is NOT "the weights are
over-confident after practice." It is "we model speed well and model attrition, caution timing and
track position badly, and the post board's extra speed knowledge just makes that gap more visible."

WHERE TO AIM NEXT (candidate, NOT built, NOT tested). The target is the pace-to-finish CONVERSION
layer, not the weight set: DNF modelling tiered by equipment/organization (already queue item 8), and
whether a dominant car's late-race loss (Blaney twice, 129 and 88 laps led, finished 3rd and 13th) is
caution-sequence variance the sim already contains or a systematic miss. The cheap first cut: score
proj_finish against avg_position instead of finish across the full board archive - if the model is
near its ceiling on pace, every remaining point of finish accuracy has to come from the conversion,
and the weight sweeps we keep running are polishing the wrong half of the pipeline.

METHOD NOTE. Both the bad example and the better test came from the operator knowing what happened on
track. Loop data says "finished 30th"; it does not say "wheel came off while running fifth." Before
using any single driver as evidence of a calibration failure, check whether the car was FAST and
UNLUCKY - avg_position, laps led and laps completed are all sitting in the same row.

### RETRACTION (same day): "AIM AT THE PACE-TO-FINISH CONVERSION" IS WRONG (2026-08-24)
Operator: "we have backtested average run position against driver rating and I thought we concluded
that driver rating predicted better." Two things came out of checking that, and the second one kills
the recommendation I made an hour earlier.

ONE — THE RECORD, PRECISELY. The 2026-07-07 ARP vs DRIVER RATING ABLATION (task #46) concluded
EQUIVALENT, not "rating better." Spearman 0.479 for all four configs on train, 0.472-0.474 on test;
p10 0.564 rating vs 0.552 ARP is noise. Rating was kept as the INCUMBENT (no churn for zero gain),
and Fable's "ARP beats rating" hypothesis was rejected. Nobody showed rating beats ARP. The log's own
explanation of the null is the key fact for what follows: NASCAR Driver Rating is built largely FROM
average running position (roughly ARP x2 plus speed, finish and passing bonuses), so the two are
near-substitutes.

TWO — WHY THAT BREAKS MY TEST. corrHistory is our largest weight term (about 37 pct effective share
post-8/20) and its metric IS driver_rating. So the board's biggest input is substantially made of
average running position. Scoring the board AGAINST avg running position is therefore partly
CIRCULAR - it will beat its correlation with finish for mechanical reasons, on any board, in any
race. This is the same trap the 2026-07-07 GFS entry already logged verbatim ("corr(X, rawResidual)
is INVALID when X correlates with the model's inputs") and I walked straight into it. The "9 of 9
races track pace better than finish, mean +0.181" number is real arithmetic but it is NOT evidence
that the sim reads pace well.

THREE — THE TEST THAT ACTUALLY SETTLES IT, AND IT POINTS THE OTHER WAY. Decompose the chain per race
on the 9 post boards: board->pace, pace->finish, and compare the product against the observed
board->finish.
                    board->pace   pace->finish   chain est   ACTUAL board->finish   surplus
    cup Indy R22       0.632          0.847        0.535           0.385            -0.151
    cup Iowa R23       0.507          0.896        0.454           0.358            -0.096
    cup Rich R24       0.706          0.943        0.666           0.616            -0.050
    cup NH R25         0.593          0.798        0.473           0.504            +0.031
    ore Indy R22       0.926          0.883        0.818           0.856            +0.038
    ore Iowa R23       0.785          0.594        0.466           0.355            -0.111
    trk IRP R16        0.796          0.897        0.714           0.634            -0.081
    trk Rich R17       0.833          0.885        0.737           0.697            -0.040
    trk NH R18         0.854          0.719        0.614           0.598            -0.017
PACE-TO-FINISH IS 0.72 TO 0.94 (mean 0.83). Across the whole archive it is 0.760 over 434 races
(cup 0.735 n=169, oreilly 0.772 n=155, trucks 0.782 n=110). Meanwhile BOARD-TO-PACE in cup is 0.61.
The weak link in the chain is PREDICTING pace, not CONVERTING it. Our board falls short of the naive
chain product by a mean of only 0.053 (7 of 9 races) - and chain composition is an approximation, so
a 0.05 deviation is inside the formula's own error, not a smoking gun.
And the circularity above makes this WORSE for my old claim, not better: board-to-pace of 0.61 is
INFLATED by inputs that are already ARP-shaped, so true pace-prediction skill is below 0.61, and the
gap I attributed to a broken conversion belongs even more firmly to pace prediction.

RETRACTED: "practice buys pace knowledge and the conversion layer throws it away; aim the next model
effort at conversion (DNF tiering, caution sequencing) rather than weight sweeps." That was wrong in
DIRECTION, not just in confidence. The conversion is the healthy part of the pipeline at ~0.83 within
race. Predicting how fast a car will run is the weak part, and that IS what the weight and signal work
has always targeted. The weight sweeps are polishing the right half after all.

STILL STANDING from the pre/post sweep (none of these use pace as a target): winner's board rank
improves or ties 9 of 9 with zero regressions; Brier directionally post on all four markets and
significant on none; post boards concentrate hard (top favorite 17.8 -> 25.3 pct); cup high-confidence
win picks 8.3 pct realized on 20.8 pct stated, n=12, now known to be heavily attrition-driven (Byron's
wheel, two Larson failures, and Blaney leading 129 and 88 laps in two races he did not win). The
practical advice is unchanged: keep publishing post, discount post cup win percentages.
ALSO NOTE: the DNF/attrition question is NOT closed by this - it is simply not supported by the
evidence I offered. Queue item 8 stands on its own merits, unpromoted.

METHOD LESSON, and this is the fourth operator catch in two days. Twice now the operator has corrected
this same thread from race knowledge and archive memory, and both times the correction reversed a
conclusion. The specific failure here is that I proposed a NEW yardstick (avg running position) without
first asking whether the model's own inputs are made of it - and the answer was sitting in this very
log, 4000 lines up, in an entry that names the trap. BEFORE adopting any new evaluation target, check
it against the input list first. A yardstick built from your own inputs measures nothing.

### FLAG SWEEP (#69 / queue 5) -> THE MODEL'S BEST-LOOKING BETS ARE ITS WORST BETS (2026-08-24)
Operator question, and it is the right one to be asking before launch: is this sellable? He framed it
against Speedgeeks, who only publish 5-star plays to subscribers, never borderline value. So: grade
every flag we have ever produced and find out whether a conviction tier exists.

SAMPLE, STATED FIRST. 332 flags total, 9 races (cup Indy R22 / Iowa R23 / Richmond R24 / NH R25,
oreilly Indy R22 / Iowa R23, trucks IRP R16 / Richmond R17 / NH R18), pre and post boards both. 40
voided (39 of them the NH cup post board killed by the bad DK odds paste on 8/23, 1 other), leaving
292 live; 290 joined to loop_data and graded. Flat 1 unit per flag at the flagged best_price.
CAVEAT THROUGHOUT: 9 races, and flags inside one race are heavily correlated - if the favorite holds,
a dozen resolve together. Treat unit counts as descriptive and the per-cell significance below as the
only inferential claims.

HEADLINE: 290 bets, 51 hits (17.6 pct) against a mean model probability of 26.0 pct. ROI -35.2 pct,
-101.95 units. By market: win -65.8 pct (3 of 60), t3 -50.6 pct (10 of 80), t5 -24.3 pct (21 of 94),
t10 +1.7 pct (17 of 56, and only 4 races of coverage). Pre-stage flags beat post-stage flags in every
market, which is its own uncomfortable note.

FINDING 1 - THE TAIL IS FABRICATED, AND IT IS NOT VARIANCE.
  Model probability under 10 pct:  72 bets, ZERO hits, model said 5.9 pct.  -72.0 units.
  Odds +1000 or longer, win/t3/t5: 99 bets, ZERO hits, model said ~7.5 pct.  -99.0 units.
  Odds +2000 or longer:            49 bets, ZERO hits, model said 5.0 pct.
P(0 hits | true 5.9 pct, n=72) = 0.013. P(0 hits | true 7.5 pct, n=99) = 0.0004, about 1 in 2300.
This is a real defect, not a cold streak. The whole loss lives here: 103 flags (35 pct of the book)
account for -88 of the -102 units. Everything else combined is -14 units on 187 bets.
NOTE the tail flags are not stupid picks - the sub-10 pct WIN flags averaged a 12.4 finish with 16 of
35 finishing top-10 and a best of P2. The model is right that these cars are live. It is wrong about
how often live converts to a WIN at 30-1. That is exactly the MC tail-noise failure the 2026-07-09
MARKET VALUE TAIL GUARD was built for - and the guard's MINP floors (win 2 / t3 5 / t5 8 / t10 12 pct)
are set FAR too low. Every one of the 0-for-99 sat above the current floor.

FINDING 2 - THE IMPORTANT ONE. EV IS INVERSELY RELATED TO RELIABILITY. Monotonic, four straight bands:
    EV under 10 pct   71 bets   model 26.7   ACTUAL 25.4   ROI -12.6   (essentially CALIBRATED)
    EV 10-24 pct      78 bets   model 25.2   ACTUAL 23.1   ROI -23.6
    EV 25-49 pct      68 bets   model 29.4   ACTUAL 16.2   ROI -48.0
    EV 50-99 pct      56 bets   model 24.0   ACTUAL  5.4   ROI -71.4
    EV 100 pct+       17 bets   model 18.8   ACTUAL  5.9   ROI -11.8  (n=17, one longshot hit)
The flags the model is MOST excited about are the ones it is MOST wrong about. Where we claim a small
edge we are nearly calibrated (25.4 actual vs 26.7 claimed). Where we claim a huge edge we are
fantasising (5.4 actual vs 24.0 claimed). This is textbook adverse selection: EV = model_prob x payout
- 1, so a big EV requires either long odds or a big disagreement with the market, and both select
precisely for our own largest errors. The market is not asleep at those prices; we are.
CONSEQUENCE FOR THE PRODUCT, AND IT INVERTS THE OBVIOUS DESIGN: a star rating that awards MORE stars
for MORE EV would be a machine for surfacing our worst plays. If we ship a tiered recommendation, the
tier must be built on MODEL CONFIDENCE AND PRICE - high sim_prob, short-to-medium odds, modest edge -
and NOT on edge size. Ranking the current flag list by EV descending is close to ranking it worst-first.

FINDING 3 - CLV AGREES, AND IS BLUNTER. 273 logged bets: mean CLV +1.03, beat close 92, lost to close
101. A coin flip. Against a mean CLAIMED edge of 41.9 points. We tell ourselves we have a 42-point
edge and the closing line moves one point our way. CLV is far lower-variance than ROI, so this is the
strongest single statement in the entry: there is NO demonstrated edge in the flag list as it stands.

WHAT A FILTER BUYS (IN-SAMPLE, NOT A RESULT). Cutting to sim_prob >= 10 pct AND odds <= +900:
    KEEP  187 bets, 50 hits, ROI -7.5 pct   |   CUT  103 bets, 1 hit, ROI -85.4 pct
So the filter turns a catastrophe into roughly the vig. It does NOT turn it into a winner. Those two
thresholds were chosen after looking at these same 290 bets and are worth nothing until they survive
forward. They are recorded here to be FROZEN and tested prospectively, not to be tuned further.

VERDICT ON THE OPERATOR'S QUESTION. He is right to hold. As a bet-recommendation product the flag list
is not sellable today: unfiltered it loses 35 pct, and the best honest statement about the filtered
version is "indistinguishable from no edge." What IS shippable-adjacent is the defect fix - the tail
guard is demonstrably too permissive and 35 pct of our flags have a measured hit rate of 1 pct.
Separately, none of this touches the parts of PitBoard that are not bet recommendations (the board
itself, practice grading, DFS, lap data), and the pre/post sweep earlier today says the board's
ORDERING is sound. The weak product is the betting overlay, not the analytics.

NEXT, IN ORDER, NOTHING BUILT YET:
1. Raise MINP hard, and add an absolute odds ceiling per market. Pre-register the numbers BEFORE the
   next race; do not fit them further on these 9 races.
2. Re-grade prospectively for 6-8 weekends against the frozen filter. ROI and CLV both.
3. Only if CLV turns positive is a subscriber-facing "5-star" list defensible. Until then the honest
   product is the board and the tools, with flags shown as model opinion rather than recommendation.
4. If a star system ships, stars track sim_prob and price. NEVER EV. See Finding 2.
METHOD NOTE: the EV-band monotonicity is 5 buckets I chose, so treat the exact ROI ladder as
descriptive - but the DIRECTION was predicted in advance by adverse selection, and the two extreme
cells (0-for-72 and 0-for-99) carry their own p-values independent of any bucketing choice.

### WHERE THE FIX CAN COME FROM: CLV HAS NO SOFT SPOT, MATCHUPS ARE THE OPEN DOOR (2026-08-24)
Follow-up to the flag sweep, same day. Two questions: is there ANY slice where we beat the close, and
is there a market shaped like our actual strength?

Q1 - IS THERE A SOFT MARKET? No, not in outrights. CLV by series (273 logged bets):
    cup       n=156  mean CLV +1.13  beat 54 / lost 56
    oreilly   n=29   mean CLV +1.13  beat 12 / lost 7
    trucks    n=88   mean CLV +0.81  beat 26 / lost 38   <- NEGATIVE on counts
And by claimed edge: <10 pts n=63 CLV +1.95 (20/25), 10-24 n=79 +0.60 (26/35), 25-49 n=64 +0.42
(19/20), 50+ n=67 +1.24 (27/21). No monotonic structure, no slice meaningfully positive. The hoped-for
"trucks and Xfinity are softer books" story is NOT there - trucks is the worst of the three. Do not
expect to tune the outright flags into profit; there is no measured edge to concentrate.

Q2 - PAIRWISE ORDERING (the matchup hypothesis). Today's pre/post sweep established that ORDERING is
the model's strength (winner rank improved or tied 9 of 9) while ABSOLUTE PROBABILITY is its weakness
(flags -35 pct). Matchup betting needs only ordering. So: for every driver pair on the 9 post boards,
does the better proj_finish actually finish ahead? Baseline = same question using STARTING POSITION.
    gap <1.0     389 pairs   model 51.7   startpos 48.6   (+3.1)
    gap 1.0-1.9  426 pairs   model 60.8   startpos 50.9   (+9.9)
    gap 2.0-3.9  794 pairs   model 63.2   startpos 56.2   (+7.0)
    gap 4.0-6.9 1119 pairs   model 70.7   startpos 65.5   (+5.2)
    gap 7.0+    2908 pairs   model 81.5   startpos 79.8   (+1.7)
    ALL         5636 pairs   model 73.2   startpos 69.3   (+3.9)
The model beats the naive baseline at every gap, and the lift is LARGEST at 1-4 projected positions -
which is exactly the range where books actually offer matchups, since they pair similar drivers.
THIS IS A HYPOTHESIS, NOT A RESULT, and two caveats are load-bearing. (1) Starting position is a WEAK
proxy for what a book knows; books price matchups off their own power ratings, which are far better
than the grid. Beating startpos is not beating the market. (2) We have ZERO matchup prices in the
database, so the actual test - our pick rate against the book's implied probability - CANNOT BE RUN.
BLOCKER AND THE ACTION IT IMPLIES: start capturing matchup lines (and stage-winner / fastest-lap lines
while we are at it) every weekend from now on. It costs one habit and nothing else, and without it this
question stays permanently untestable. 9 races of published boards is also the whole archive - the
pre-07-24 boards are gone (pitboard.md 1617) - so the pairwise test should be re-run through the
historical harness the way the startPos sweep was, not just on these 18 boards.

FRAMING FOR THE FIX, and the two tracks must not be blurred:
TRACK A, CALIBRATION - certain, cheap, creates NO edge. Our BOARD is calibrated (top-10 reliability
holds in both stages) while our FLAGS are not, and the difference between them is the SELECTION: a
flag is by definition the subset where the model most exceeds the market, so flagging selects the
model's own errors. The fix is a disagreement-scaled shrink toward the market at flag time - the
larger our disagreement, the harder we shrink - which kills the tail by construction and leaves the
small-edge flags, where we are already calibrated, alone. marketAnchor and the win-market favorite
shade are the same idea in prototype; this extends them to all four markets and FITS them instead of
reasoning them. But shrinking toward the market converges to the market. You cannot calibrate your
way to profit. Track A makes the product HONEST, not PROFITABLE, and it must be sold as such.
TRACK B, EDGE - uncertain, slow, and the only thing that would justify selling picks. On present
evidence that means matchups (ordering, soft market) or a genuinely new pace input, not more weight
sweeps on outrights.

### THE BOARD IS CALIBRATED. THE FLAGS ARE NOT. THOSE ARE DIFFERENT CLAIMS (2026-08-24)
Recorded because the operator, reading the flag sweep, concluded "the model needs to get better
calibrated and we can't seem to do it" and raised scrapping the project. That premise is measurably
wrong and the distinction is worth stating precisely, in the log, with numbers.

BOARD-LEVEL RELIABILITY. 644 driver-rows per market (9 races, pre and post boards, joined to results):
  TOP 5    band 0-5    n=298  says  1.2  happens  1.0
           band 5-10   n=85   says  7.4  happens  7.1
           band 10-20  n=87   says 14.6  happens 16.1
           band 20-35  n=88   says 26.4  happens 23.9
           band 35-60  n=71   says 45.8  happens 50.7
           band 60+    n=15   says 67.9  happens 66.7
  TOP 10   1.6/2.4 | 7.4/8.2 | 15.1/21.7 | 27.1/25.0 | 46.4/44.5 | 73.0/69.6
  WIN      0.9/0.6 (n=533) | 6.8/11.8 (n=51) | 14.4/13.0 (n=54) | above 20 pct n=6, unreadable
Every top-5 band lands within about 5 points of truth across the full range. Top-10 is close, mildly
UNDER-confident at 10-20. Win is fine where n supports a read. The honest exception, unchanged from
earlier findings: cup favorites at the very top of the win market are over-confident (12 picks at
20.8 pct stated, 8.3 pct realized), which is what marketAnchor and the favorite shade exist for.
This is a well-calibrated board. It is not a model that "can't be calibrated."

SO WHY DID THE FLAGS LOSE 35 PCT? Not because the probabilities are wrong - because of WHICH
probabilities get selected. A flag fires where model prob exceeds market prob. Filtering on
"we exceed the market" filters on the model's own upward errors: at any given true probability, the
draws where our estimate came in high are exactly the draws that clear the bar. The board average is
right; the selected subset is biased upward by construction. This is winner's curse / adverse
selection, it is arithmetic rather than a modelling defect, and it is why FINDING 2 of the flag sweep
came out monotonic - the larger the claimed edge, the larger the selected error.
The standard correction is equally well known: shrink toward the market as a function of disagreement
size before flagging. See the flag sweep TRACK A. It is a bolt-on at flag time and touches no weights.

WHAT IS GENUINELY UNRESOLVED, AND IT IS NOT CALIBRATION. Whether we BEAT the market. CLV is 92 beat /
101 lost over 273 bets, no soft slice by series or by claimed edge. That question is open and may
resolve as "no." But it is a question about EDGE, not about calibration, and the two must not be
collapsed - a perfectly calibrated model with no edge is a normal and useful object (it prices the
board correctly, it just does not beat a market that also prices it correctly). The parts of PitBoard
that do not require beating a market - the board, practice grading, lap data, DFS - do not depend on
that question resolving favorably at all.
FOR THE NEXT SESSION READING THIS COLD: do not let a bad flag ROI be quoted as evidence that the
simulation is miscalibrated. Cite this entry. They are different measurements of different objects.

### CORRECTION: I ANALYSED CLV AT THE WRONG UNIT. CLUSTERED PROPERLY IT IS POSITIVE (2026-08-24)
Operator, on being told CLV was 92 beat / 101 lost and therefore no edge: "I think we can't beat CLV
because it flags so many bets, it's probably mathematically impossible for all of them to become
positive CLV." He is right about the mechanism, the precise version is stronger than he put it, and
following it reverses my conclusion from an hour earlier.

THE MECHANISM. Flags inside one race are NOT independent bets. Win probabilities sum to 1 across the
field, so flagging k drivers as underpriced is ONE claim - that the market has misallocated
probability - expressed as k tickets. Measured directly (claimed misallocation = sum of medge over
flagged drivers, win market, per race-stage):
    cup Iowa R23 post      3 flags   our combined win prob 73.0 pts   claimed misallocation +34.7
    cup Richmond R24 pre   3 flags   our combined win prob 65.0 pts   claimed misallocation +35.7
    cup Richmond R24 post  3 flags   our combined win prob 55.2 pts   claimed misallocation +33.2
Three tickets carrying 73 points of win probability against a market pricing them near 38 is not
three opinions. It is one opinion, and its CLV resolves as one opinion. Counting 273 tickets as 273
trials - which is exactly what I did - overweights the races that happened to generate the most
tickets and treats a correlated cluster as a coin-flip sequence.

RE-RUN AT THE RACE LEVEL (the conservative unit; 10 races in clv_log, 2026-07-18 to 08-22, all 273
rows have close_odds captured, 80 are exactly zero = genuinely unmoved lines, no nulls):
    mean race CLV +1.264, sem 0.514, t=2.46 (9 df, p about .036), 8 races positive / 2 negative.
By race-market cell (34 cells): 24 positive / 10 negative, mean +1.31. By market: t5 +1.57 (8/2),
win +1.31 (7/3), t3 +1.14 (6/4), t10 +1.05 (3/1). Every market positive.

SKEPTICAL CHECK - IS THE EDGE JUST LONGSHOT NOISE? This was the obvious way for the result to be
worthless, since CLV on longshots is unreliable (stale lines, limits, steam). It is NOT:
    under +300      n=71   mean CLV +1.48   beat 21 / lost 23 / unmoved 27
    +300 to +999    n=86   mean CLV +1.50   beat 33 / lost 30 / unmoved 23
    +1000 or longer n=116  mean CLV +0.40   beat 38 / lost 48 / unmoved 30
The CLV signal is STRONGEST in the short and medium bands and near-absent in the tail. Excluding
+1000 and longer entirely: 157 bets, 10 races, mean race CLV +1.696, t=2.35, 7 positive / 3 negative.
The edge lives precisely where the flag sweep said our probabilities are calibrated, and the tail is
bad on BOTH measures - 0-for-99 on results AND no line movement. The two analyses now agree.

WHAT THIS DOES AND DOES NOT CHANGE.
CHANGES: "there is NO demonstrated edge in the flag list" was wrong, or at least far stronger than the
data supports. The correct statement is that there is a POSITIVE CLV SIGNAL in the sub-+1000 body,
nominally significant at the race level, in a sample of 10 races.
DOES NOT CHANGE: the tail is still fabricated and still has to go. The -35 pct ROI is still real
(positive CLV with negative ROI over 9 races is ordinary variance - it means we bought good prices and
lost anyway - it does not validate the ROI). And the filtered set's -7.5 pct is now consistent with a
small positive edge rather than evidence against one.
THREATS TO THE RESULT, STATED PLAINLY. (1) 10 races, one nominal test, not pre-registered. (2) The
BIGGEST risk is that clv_log is captured MANUALLY and incompletely - the operator missed NH cup
entirely because the race started first. If logging is even slightly more diligent when a line has
moved our way, this whole result is selection. That is not a hypothetical; it is the single thing
most likely to be wrong here. (3) clv_log covers 10 races that only partly overlap the 9 flag races.
THE FIX FOR ALL THREE IS THE SAME AND IT IS THE HIGHEST-VALUE ITEM ON THE BOARD: capture close odds
AUTOMATICALLY for EVERY flag, no operator discretion, starting next race. Until capture is systematic
and complete, this number is promising and inadmissible.

METHOD LESSON, and it is the same failure as the ARP one this morning in a different costume: I chose
an analysis unit without asking whether the observations were independent. Correlated observations
counted as independent trials will mislead in whichever direction the cluster sizes happen to point.
Both of today's reversals came from the operator applying domain knowledge to a number I had computed
correctly and framed wrongly.

### CLV DONE PROPERLY: odds_snapshots, pre-sim -> post-sim, WHOLE FIELD. FLAGGED BEAT THE FIELD 9/9 (2026-08-24)
Two operator corrections drove this and both were right. (1) I offered to BUILD automatic close-odds
capture. It already exists - odds_snapshots, 57,587 rows, the full board every time he pastes odds
into a sim, 6-19 capture moments per race-market, 36-39 drivers, 2-3 books. I proposed building
something we have had all along. (2) I had the WINDOW wrong. The operator: "look at the odds board
from our pre-simulation... compare it to our last post simulation, and there's our CLV. Logging CLV
from post practice/qualifying up until the race usually doesn't move because there is a short gap
between practice and the race." Correct on the domain: the practice-to-green window is minutes on a
modern schedule, so bet-to-close is a dead window. The live window is PRE-SIM to POST-SIM.

METHOD. Anchor each race's pre and post board to its nearest odds capture moment (NH cup: pre
2026-08-20 03:54, post 08-23 17:25 - the board publishes are 03:54:21 and 17:25:14). Convert every
driver's price to implied probability and NORMALIZE the field to the market's true total (1 / 3 / 5 /
10), which strips vig and vig drift; by construction the field's movement then sums to zero, so this
measures purely WHO GAINED AT WHOSE EXPENSE. CLV = normalized post minus normalized pre, in
probability points. NH cup t10 DK excluded (the 8/23 bad outright paste). This is the COMPLETE
POPULATION - every driver on every board - so the manual-logging selection worry that made the
earlier clv_log result inadmissible does not apply here at all.

RESULT. Drivers flagged off the PRE board vs everyone else, 9 races, 1,128 driver-market rows:
    market   n flagged   flagged CLV   unflagged CLV
    t3          31          +1.955        -0.184
    t5          41          +1.723        -0.195
    t10         31          +1.650        -0.437
    win         28          +1.082        -0.097
    ALL        131          +1.623        -0.191
Clustered by race, lift = (flagged mean - unflagged mean): mean +1.731 pts, sem 0.440, t=3.93 (8 df,
p about .004), POSITIVE IN ALL NINE RACES, negative in none.

CONFOUND 1 - STALE LINES. Flags fire on BEST price across books, which is a max and therefore selects
the most extreme (possibly stale) book. A briefly-long price would trigger a flag and then "correct,"
manufacturing CLV with no model content. Re-ran the whole thing on CONSENSUS pricing (mean implied
across books) instead: flagged +1.441 vs unflagged -0.165, all four markets still positive (t3 +1.809,
t5 +1.569, t10 +1.251, win +1.055). The effect barely moves. NOT stale-line reversion.
CONFOUND 2 - FAVORITE DRIFT. If probability mass drifts toward favorites and we flag favorites, the
zero-sum normalization would hand us a spurious positive. Stratified by the driver's PRE market
probability, flagged beat unflagged in EVERY stratum:
    <5 pct      flagged +0.527   unflagged +0.216   (n flag 27)
    5-15 pct    flagged +1.321   unflagged -0.110   (n flag 52)
    15-35 pct   flagged +2.159   unflagged -0.620   (n flag 39)
    35 pct+     flagged +1.660   unflagged -2.126   (n flag 13)
Not favorite drift. And note the shape: the lift is WEAKEST in the sub-5 pct tail and strongest in the
15-35 pct band - the same split every other analysis today produced.

WHAT IT MEANS, STATED CAREFULLY. These are PRE-board flags, made BEFORE practice, and the market moves
toward them by post-practice. That is information the market did not have at pre time, which is the
actual definition of edge. It is also mechanistically coherent with this morning's pre/post sweep:
practice genuinely improves the board's ordering, and the market is arriving at the same conclusion a
few days later.
WHAT IT DOES NOT MEAN. +1.73 points of relative line movement is REAL BUT MODEST - roughly the vig,
maybe a bit more, not a crushing edge. It does not rescue the -35 pct flag ROI (positive CLV with
negative ROI over 9 races is ordinary variance; CLV is the better long-run predictor, which is the
point, but 9 races is 9 races). It does not save the longshot tail, which is the WEAKEST stratum here
and was 0-for-99 on results - the tail is bad on every measure we own. And it is 9 races of one
season, un-pre-registered.

EVERYTHING NOW AGREES, WHICH IS THE PART THAT MATTERS MOST. Four independent analyses today, three of
which I initially got backwards, converge on one picture: the board is CALIBRATED in the body and
FABRICATED in the tail; the flags are worthless in the tail and roughly break-even in the body; and
the body carries a small but consistent informational edge over the market. The disagreements between
these analyses were all mine - wrong yardstick (ARP), wrong unit (ticket-level CLV), wrong window
(bet-to-close). The data has been telling one story throughout.
NEXT: re-run this every weekend - it is now zero marginal work, the capture already happens. Track the
race-level lift as a running ledger. If it holds above zero through 15-20 races, a subscriber-facing
product is defensible on evidence rather than hope. Pre-register that threshold NOW, before more data
arrives, and do not tune the window or the strata again.

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

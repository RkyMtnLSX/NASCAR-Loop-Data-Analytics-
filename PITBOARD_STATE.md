# PITBOARD STATE
Volatile snapshot — REPLACE on change (git history is the archive). Updated: 2026-08-31. **LAUNCH IS PUSHED TO NEXT SEASON (operator, 2026-08-31) — the Chase starts Sunday and we are not ready.** The sim now runs OUTSIDE the browser: src/lib/simEngine.js + scripts/, see scripts/README.md. Nine model studies were registered and run this session; the DNF-tilt line is CLOSED. **TWO changes shipped: the SS caution pin, and the cliff fix — the caution buttons no longer move attrition, `dnfRate` is now the only attrition dial (operator-approved).** Both remaining blockers are the same blocker — one season of accumulated data. PIT DATA BLOCKER IS CLOSED (verified against the database 2026-08-31, not against a doc): `pit_stops` holds 81,647 rows / 413 races / 2022-2026, last loaded 2026-08-30. The 24 races still without pit rows are tracks where NASCAR publishes no pit timing at all — Bristol dirt, Lime Rock, IRP, Portland, Road America, Rockingham; 17 of the 24 are trucks. Nothing to backfill. pitcrewrank.com is retired and its table dropped; pit crew is live via `pit_stops` (`pitCrew: 0.06` in every weight set).

## 2026-08-31 — THE SIM RUNS HEADLESSLY; LAUNCH PUSHED; NINE STUDIES, ZERO SHIPS

**LAUNCH PUSHED TO NEXT SEASON.** Operator's call, 2026-08-31: the Chase starts Sunday and the product
is not ready. Everything in "Launch runway" below is still correct as a checklist and WRONG as a
schedule — read it as next-season work, not as ~2-3 weekends out. Nothing in it was invalidated.

**THE ONE DURABLE THING BUILT.** `src/lib/simEngine.js` — `runRaceSim` and `buildSpeedScores` and every
constant they use, extracted verbatim from SimulationCenter. The page imports it and so do node
scripts, so a backtest and the live site cannot disagree. `scripts/loadEngine.js` transforms it
ESM→CJS in memory. **`scripts/README.md` is the operator-facing setup: git clone, npm install, done —
no DB credentials, no keys.** Two checks after ANY sim change:

    npm run lint:undef    # free-variable check — NOT optional, see below
    npm run sim:smoke     # engine invariants + ASSERTS attrition is preset-independent

`lint:undef` exists because `npm run build` COMPILES a page that references a name which no longer
exists — webpack does not flag free variables. That shipped-green-and-crashes case happened this
session with eight names at once during the extraction.

**ONE MODEL CHANGE SHIPPED: the superspeedway caution pin, which was cosmetic.** SS carried a
"pinned (calibrated)" note that only set the note — the config loader bucketed SS from its caution
average regardless. Cup Talladega (5.33 mean cautions) sat the wrong side of the hard <6 boundary from
Daytona (6.17), drew the CALM wreck pool, and simmed 10.4% attrition against 20.9% measured — half.
`setCautionPreset` now pins SS to Medium for real (one line, no constant or curve moved, manual clicks
still override). Holdout, cup Talladega: DNF 10.4% -> 20.4% · win Brier .02607 -> .02494 · top5 .11890
-> .10932 · top10 .20981 -> .18996. It was the only SS cell affected — the other 26 holdout SS races
were already on Medium. Shipped as a bug fix rather than through a registration because it restores
behaviour the code and UI already claimed.

**SECOND MODEL CHANGE SHIPPED — THE CLIFF FIX. THE CAUTION BUTTONS NO LONGER MOVE ATTRITION.**
`perBucketEV` + `wideClamp` now DEFAULT TO ON (`simConfig.x !== false`). Each wreck pool is
normalized against its own expected accident count, so every caution preset delivers the `dnfRate`
budget. The preset still sets wreck SHAPE, noise width and dominator curves; **`dnfRate` is now the
only dial that changes how many cars retire.** Operator-approved with that consequence disclosed
("I almost never use the caution button").

The case is STABILITY, not accuracy, and it came from the operator's own challenge that caution
rates are a moving target. Measured: **17 of 60 track cells (28%) flip caution preset at least
once** as their prior mean updates across seasons (cup Martinsville 4.00-7.00, cup Las Vegas
7.00-12.00), and each flip swung attrition ~73% under the old pooled normalizer. Gate A boundary
jump 73.7% → 3.3%; DNF bias −0.53 → −0.11 cars/race; top10 Brier −11.02e-5 against a 3.09e-5 null.
**Win and top5 are INSIDE the null band and wobble sign between runs — do not quote them as gains.**

Two bugs the ship itself surfaced, both from the same shape (*a default flip silently re-points
everything that built a baseline from an empty config*): `__dnfFraction` held a duplicate copy of
the wScale formula with the old 2.5 clamp hardcoded (caught by sim-smoke, now one `__wScaleOf`),
and `gate-cliff-final.js` had `CURRENT: {}` which would have compared the fix to itself.

**NO OTHER MODEL CHANGE SHIPPED.** Two experiments sit in the engine behind flags, unreachable from
`src/pages/` (verified): `cautionMix` (TESTED AND REJECTED on holdout) and `skillTilt` (passed some
gates, failed others, blocked on data). Kept rather than deleted so the next session does not
rediscover the symptoms and rebuild them. Full history in BACKTEST_LOG 2026-08-31.

**WHAT WAS CONFIRMED (the session's real gain).** The 2026-08-30 DNF constant refresh had never been
tested through the SIM — only on retirement counts. It now is, on 29 cup tracks: MAE 4.41→3.10, bias
−4.29→−2.27, better at 26 of 29 tracks. It stands, and now on both error and bias rather than bias alone.

**WHAT WAS CLOSED — the DNF-tilt line, now after SIX parameterizations.** Four failed earlier; two
more were registered and run on the FIXED engine after the cliff fix changed the substrate (the old
studies all ran on an engine under-delivering its DNF budget ~13%, which `DNF_TILT_LEVEL = 1.15`
existed to paper over). Neither shipped:

- **Four-parameter one-sided** (BACKTEST_LOG 8a76a87 / 2605629): FAILED the Q2 rail. Its train gap
  did not replicate out of sample. **But it proved the mechanism** — removing the mean-1 rescaling
  removed the harm to the strong tier that killed every earlier version.
- **Two-parameter, Q1/Q4 only** (7065fe3 / 46950e1 / e24a808): **PASSED EVERY REGISTERED GATE** and
  was still not shipped. Two post-hoc checks, both declared in advance as able to argue only against
  shipping, killed it: the lone forecast gain went from 1.5x its null floor at 3 runs to 1.0x at 5
  (it moved TOWARD noise, and top5 flipped sign), and the entire effect turned out to be trucks —
  **cup top10 is −0.52e-5 against a 7.94e-5 floor, i.e. zero**, with Q4 trending the wrong way for
  cup and O'Reilly.

**The standing conclusion, now six-for-six: every parameterization improves DNF calibration by tier
and NONE moves win/top5/top10 at adequate power.** Getting the right cars to retire is not the same
as getting the finishing order right. DO NOT reopen this on a tier table. Reopen only if the SIM's
sensitivity to retirement identity changes — that is the actual blocker and it is upstream of any
tilt. The frozen two-parameter curve is in `scripts/backtest-data/tilt-2param.json` and is
defensible if per-driver DNF% is ever displayed or sold; it is not a forecasting improvement.

Two process lessons logged with it: run power checks before believing a marginal beyond-noise result
(3 runs would have shipped a false positive), and **any per-tier work needs a PER-SERIES rail** —
cup/O'Reilly/trucks have wildly different tier gaps and a single aggregate gate hid a trucks-only
effect. `train.txt`/`holdout.txt` should carry an explicit year and race id at next regeneration;
their absence cost two separate tests today.

**TWO CORRECTIONS I HAD TO MAKE TO MYSELF, recorded because the pattern repeats.** (1) I called the
caution/DNF coupling a defect; it was `wreck-v1.1-cb`, shipped 2026-07-28, by design, documented in
BACKTEST_ARCHIVE — I searched BACKTEST_LOG and not the ARCHIVE. *(Later the same day it was fixed on
its merits, with a registered harness and operator approval — but "it turned out to be worth changing"
does not retroactively justify calling it a bug before reading the archive.)* (2) I described a
train/test split as temporal when the file was not ordered by date. Both are in the log as corrections.

**THE INSTRUMENT'S LIMITS, which constrain all future backtesting.** The reconstruction was validated
against the 11 stored live boards in `sim_results`: it names the same favourite on **5/5 cup, 0/3
O'Reilly, 2/3 trucks**, and runs 2.53 points LESS confident than the live board. Weight cup results
more heavily or validate per series first. This failed its registered gate (7/11, needed 8), which
CLOSED the win-market confidence study and VOIDED this session's "favourite predicted 23.6% → won
34.0%" as evidence about the engine.

**BOTH REMAINING BLOCKERS ARE ONE BLOCKER: a season of data.**
  * `practice_sessions` only reaches all three series in 2025 — 94 usable races total, and the
    per-tier attrition profile swings 4+ points between 2025 and 2026, more than the effect being
    fitted. Another season makes the skill tilt testable.
  * `sim_results` holds 11 boards from a five-week window. Every published board is stored; at ~3 per
    weekend a season is 100+, at which point favourite calibration is answerable ON REAL BOARDS with
    no reconstruction and no fidelity gap — the correct way to ask it.

**THEREFORE THE BETWEEN-NOW-AND-LAUNCH JOB IS NOT MODELLING.** It is running the weekends and letting
practice + published boards accumulate. Keep publishing boards through the Chase even with no
subscribers watching — that IS the dataset.

## 2026-08-30 (late) — SIM DNF CONSTANTS CHANGED; TWO MORE STUDIES CLOSED

**SHIPPED AND LIVE — the only model change of the session.** `resolveDnfRate` was blending a new-rule
live measurement against old-rule constants. Resolved toward the measurement:

    DNF_BY_GROUP  cup     SHORT .081->.091  ROAD .085->.095  INT .127->.155  SS .184->.255
                  oreilly SHORT .134->.163  ROAD .159->.187  INT .108->.135  SS .220->.284
                  trucks  SHORT .133->.147  ROAD .176->.214  INT .140->.149  SS .187->.240
    DNF_SERIES_MEAN  cup .118->.145 · oreilly .141->.178 · trucks .149->.168
    DNF_CAP          0.30 -> 0.40

**DNF_CAP had become binding on real cells** — oreilly Daytona .329, cup Daytona .319, trucks
Talladega .306 — so raising the rates without the rail would have silently truncated the plate races
where attrition matters most. These are FALLBACKS: a track with 8+ races of its own history ignores
them. `WRECK_ACC_SHARE`, `WRECK_SETS`, `WRECK_SURV_COST`, `WRECK_LL_B` all UNTOUCHED and all
independently re-validated tonight.

**THE OPEN QUESTION IS ANSWERED: yes, the DNF budget should equal the observed retirement rate.**
96.1% of real retirements finish inside the band the sim assigns them (the last D positions) — by
group 97.4 / 97.3 / 96.6 / 92.9. The weakest cell is superspeedways, which is the Zane Smith case,
and it is still 93%. The refresh above is therefore correct, not just consistent.

**Restart proximity: CLOSED.** Two registered designs, both failed bar 3 (mechanical control < 1.2):
v1 pooled 1.590, v2 1.589. The compromised-car rule fixed superspeedways (1.23 -> 1.03) and did
nothing at intermediates (1.40 -> 1.49). Accident clustering is real and large (2.0-5.2x, all four
track types, ~55% of accident DNFs in 23.8% of green car-laps) but could not be shown to be a
RESTART effect rather than a retirement-timing one. **Do not reopen** - the likely reason (mechanical
failures may genuinely cluster at restarts, so the control was never valid) is recorded in
BACKTEST_LOG and is NOT grounds to retry.

**STILL OPEN, and now the best remaining lead:** leader-wreck correlation. DNFers who led wreck at
0.71-0.78 of distance, those who did not at 0.55-0.60, consistent in all four groups. The sim picks
victims by running-order adjacency without conditioning on event timing. That is victim SELECTION,
a different question from event timing, and it was a documented residual before tonight.

## 2026-08-30 — CAUTION TIMING CAPTURED (restart lap now exists)

New `caution_segments` table: 3,036 segments across 434 races with start/end lap, reason, comment,
beneficiary, and **`restart_lap`** generated. Validated against `races.total_cautions` (independent
field, same feed): **434/434 agree, 0 disagree.** `races` also gains stage lengths plus generated
`stage_N_end` cumulative columns.

**Read the stage-lap trap in PITBOARD_SCRIPTS.md before using them.** The feed publishes LENGTHS;
SimulationCenter's convention is cumulative ENDS. Stage 1 matches under both, stage 2+ does not.
Use `stage_N_end`.

**Nothing in the model reads any of this.** It exists because SimulationCenter's stage inputs are
labelled "for the future caution/pit layer, do not affect results yet" and that layer had no
training data. Whether wrecks cluster after restarts is now MEASURABLE and has NOT been measured —
that wants a pre-registration written first.

Operator decision on record: NASCAR feed requests keep the current browser User-Agent and referer.
Weighed and chosen; do not change it without asking.

## 2026-08-30 — ORGANIZATION STUDY CLOSED (registered, failed on materiality not existence)

`team_name` (100 organisations, 16,052 rows) tested as recent-org-strength at a track type, all four
track types registered in advance. **Fails everywhere.** Pooled delta **+0.0051** against a +0.05
bar; best group Road Course +0.0098. Per track type: Road 0.0098 (67.9% positive) · Short & Flat
0.0076 · Superspeedway 0.0052 · **Intermediate 0.0014, the weakest.**

Unlike closing_ps this is a REAL effect (pooled t=2.31, consistently positive in all five cuts) —
just ~10x too small. Pooled 95% CI [0.0008, 0.0095]: even the optimistic end is 5x under the bar, so
this is not "underpowered, revisit later" — the data now rules out an effect of the size that would
matter.

**My stage-1 prediction was wrong and is recorded as such:** I argued organisation would matter most
at intermediates because equipment and aero matter most there. Intermediate came back weakest.

`team_name` stays a stored column for grouping/filtering/display, no model role. Contemporaneous
team pace, teammate practice speed and crew-chief identity were NOT tested and would each need their
own pre-registration.

## 2026-08-30 — closing_ps STUDY CLOSED (registered, failed)

`closing_ps` is populated on all 16,130 rows and **no model uses it.** Registered study ran the same
day: train 2022-24 (n=10,019), holdout 2025-26 (162 races). Mean per-race Spearman delta **-0.0001**
against a +0.05 bar; positive in **48.8%** of races against a 60% bar. Superspeedway subgroup
identical (-0.0003, 48.1%). Both bars missed, effect is zero.

Cause: averaged over a driver's prior races, `priorClose` and `priorFin` correlate **0.9668** — the
race-to-race gap between running position at the end and classified finish is noise, and averaging
cancels it. The in-sample coefficient shift (priorFin 0.411 -> 0.162) was OLS splitting credit
between interchangeable variables, not closing position being better.

**Do not re-open on the back of this.** A contemporaneous (within-race) use of closing_ps was not
tested and would need its own pre-registration written before looking.

Second convergent result: baseline per-race Spearman is 0.44 overall but **0.17 at superspeedways**,
matching the separately-registered SS finish-quality study. Two independent studies now say
superspeedway finish is near-unpredictable from what we hold — which supports the SS variance
multiplier rather than indicting it.

## 2026-08-30 (final) — BACKFILL COMPLETE; ONE REAL DEFECT FOUND

**16,094 of 16,130 loop_data rows enriched.** `total_laps` short on 1 race (down from 142).
`car_number` NULLs 8 (down from 120). 436 of 437 races carry `nascar_race_id`.

**The last holdout was a genuine defect, not a tooling problem.** trucks 2022 R5 Martinsville had
`race_date` 2022-03-26 — COTA's date. The pit loader matches by date +/-1, so it had loaded **COTA's
117 pit stops under Martinsville** (all 117 identical to COTA's, laps 0-42 under a 200-lap race).
Fixed: date -> 2022-04-07, `nascar_race_id` -> 5222, the 117 wrong stops deleted.
**Martinsville's real 2022 pit data has never been loaded — re-run PIT_BACKFILL_ALL_YEARS.bat.**
Swept the whole database after: no other duplicate `nascar_race_id`, no other same-date pair.

**Remaining, both benign:** cup 2026 "R0" Dover is a stub row (no date, no loop_data) that should
probably be deleted. `drivers.nascar_driver_id` is still NULL for pre-existing driver rows.

## 2026-08-30 (backfill run) — RESULT AND THE TWO RESIDUES

**First write:** 432 races, 15,977 rows. `total_laps` corrected on **143** races. `finish_status`
changed on **2,598** rows — 16% of the table. `loop_data.car_number` NULLs fell 120 -> 8.
`finish_status` now carries real causes: accident 1,606 · engine 162 · suspension 123 · dvp 102 ·
electrical 65 · brakes 60 · transmission 45. **SimulationCenter's auto DNF rate reads this column,
so its output has moved.**

**Second write** (after the variant fix): 16,016 of 16,130 rows enriched.

**The 51 "name conflicts" were five drivers, not misalignments.** 40 were "Andres Perez", which
NASCAR spells "Andres Perez De Lara"; the rest Cleetus McFarland / Garrett Mitchell (one person;
NASCAR files him under both "Cleetus McFarland" and "Cleetus Mitchell" against id 4530), Conner
Dean, William Dean, Tim Viens. NASCAR's own feed is inconsistent — `pit_stops` holds "Andes Perez
De Lara #", their typo, against the same id. Rows are now enriched anyway when the rest of the race
aligns; **our stored `driver_name` is never changed.**

**4 of 5 skipped races were matcher misses.** cup 2026 R17 is ours vs theirs: we call it "Naval Base
Coronado", NASCAR calls it "San Diego Street Course", and our date is a day later. Seeded
`races.nascar_race_id` from `pit_stops`, which agreed with the feed **410/410** where both existed.

**3 races then still failed, for a different reason:** NASCAR publishes them with complete loopstats
and a NULL weekend feed. Handled — see PITBOARD_SCRIPTS.md §5. **One more backfill run picks up
those ~114 rows.**

**Still open:** cup 2026 "R0" Dover is a stub row (no date, no loop_data) that should be looked at
and probably deleted. `drivers.nascar_driver_id` is still NULL for pre-existing driver rows.

## 2026-08-30 (later) — RACE INGESTION MOVED OFF RACING REFERENCE

**Shipped.** Admin -> Load Data has two new panels: **Load Race from NASCAR Feed** (replaces the
Ctrl+A/Ctrl+C paste) and **Feed Backfill** (repairs races already stored). Full detail in
PITBOARD_SCRIPTS.md §5.

**Blocking operator action, one click:** open Admin -> Load Data -> Feed Backfill, leave it on
*all series / all seasons*, run it **dry first**, read the log, then switch Mode to Write and run it
again. Until that runs, `nascar_driver_id`, `closing_ps`, `team_name` and the stage finishes are all
still empty and `total_laps` is still wrong on 142 races.

**What is now FALSE in older sections of this file:**

- "We cannot join loop_data to pit_stops without name matching." False after the backfill runs -
  `pit_stops.nascar_driver_id` already exists on 80,978 rows and `loop_data.nascar_driver_id` now
  exists to meet it.
- "No team/organization column on loop_data" - the deviation the superspeedway study declared. False
  after the backfill; `team_name` covers all 436 races.
- "`races.total_laps` is the race distance." False today, for 142 of 436 races: it holds SCHEDULED
  laps, so any race that went to overtime is short. One race holds 0. The backfill corrects it.
- "`finish_status` marks DNFs." Only roughly - it was `laps < 90% of total_laps`, computed against
  the wrong total. Hocevar and Erik Jones both wrecked out of Daytona R26 and are stored "running".

**New, open:** `closing_ps` is pre-registered in BACKTEST_LOG.md (train 2022-24, holdout 2025-26,
bars +0.05 mean per-race Spearman delta AND positive in >=60% of holdout races; superspeedways the
only named subgroup). **Nothing has been fitted and no model uses it.** The study cannot run until
the backfill lands.

**Corrected before it caused damage:** `loop_data.driver_id` is a FK to `drivers(id)` (37 rows, ids
1..37), not a NASCAR id. My original plan was to put NASCAR ids there. It would have failed the FK
on nearly every row and silently mis-linked the one id that collides. NASCAR ids live in
`nascar_driver_id`.

**Loose ends this created:**
- `drivers.nascar_driver_id` exists but stays NULL for drivers already in the table, because the
  loader upserts with `ignoreDuplicates`. Cosmetic - `loop_data` carries the id - but worth a
  one-line SQL backfill after the main one runs.
- `api/probe-nascar.js` is a live public diagnostic endpoint. Read-only and not an open proxy, but
  it should be deleted now that the questions it answered are answered.
- `api/load-race.js` (the old serverless Racing Reference scraper) and the `LoadNewRace` paste panel
  are both still present. Deliberate - the feed path should have a few weekends behind it first.
- `package-lock.json` is untracked. Committing it switches Vercel from `npm install` to `npm ci`;
  not done in passing.
- Still manual: the Jayski pill-draw PDF (the feed's `qualifying_order` is the qualifying RUN order,
  not the draw - verified different) and the Lap Raptor fastest-lap paste.

## 2026-08-30 SESSION HANDOFF — WHAT CHANGED, AND WHAT BELOW IS NOW FALSE
Long session, heavy shipping, and FIVE corrections of my own work - read this before trusting any
pre-08-30 line in this file.

### SHIPPED
- **GPP IS A SET OBJECTIVE.** Was: rank each lineup by its own p90, then filter by exposure cap.
  Now: greedy maximisation of E[max] - the expected score of the BEST lineup in the delivered set -
  across the stored draws. No tuning parameter (at N=1 it returns the cash lineup). Best-of-20 field
  percentile over the 8 replayable races: 79.8 old uncapped, 87.0 old + 50% cap, 90.0 E[max]. Holds
  at every entry count (wins 5-7 of 8 races at N=5..150); at 150 entries it reaches the 96.5th
  percentile. Selector is exported (makeEmaxSelector), resumable, used by the page AND the replay.
- **MAX EXPOSURE DEFAULT: 100% -> 50% -> back to 100%, same night.** The 50% was measured against
  the OLD objective, where the cap was the only thing forcing spread. Under E[max] spread is
  endogenous (22.4 unique drivers vs 18.5) and the cap buys nothing (90.0 vs 90.0) while costing
  delivery (20/20 -> 18.1). The control stays for manual use.
- **DFS REPLAY admin tool** (Admin -> DFS Replay) + `dfs_replays` table. Rebuilds both modes from the
  pre-lock draws through DFSPage's own solvers, grades BEST-OF-N against loop_data, places it in the
  uploaded contest, reports the three calibration correlations, stamps engine_era. Eight rows seeded.
- **PROJECTED OWNERSHIP** column in the DFS pool (600 * exp(2.2 * proj percentile) / sum, fitted LORO,
  MAE 6.11 ownership points; the 600 total is measured, not assumed).
- **/dfs-optimals + /optimal-lineups** pages and a 2022-26 optimal-lineup corpus (dfs_optimal_history,
  330 rows; dfs_race_field, 41 races).
- **GradeCenter name-join hardening** (shared __nmName) - see the retraction below.
- **PITBOARD_SCRIPTS.md** created; pipeline operations move out of BACKTEST_LOG.

### CORRECTED OR RETRACTED THIS SESSION (five)
1. **GradeCenter "accent bug" - RETRACTED.** I claimed an accent-folding miss was silently dropping
   Suárez's flags and costing +25u. The pre-fix grade row already contained them: both sides of that
   join carry BOARD spellings, so the fold was consistently wrong and still matched. The commit is
   hardening, not a fix. LESSON: go find a record the bug should have suppressed before claiming it.
2. **DFS replay 7 (Daytona) - my harness was not the product.** It optimised on the draw mean instead
   of the board's proj_dk and used a thin candidate set. Corrected by the tool: cash 230.25 beats GPP
   202.40, not a tie.
3. **THE WHOLE REPLAY LEDGER - 4-1-1 becomes 3-2-3.** All eight races re-run through the product
   solvers. Biggest single correction: cup NH R25, logged as "first GPP loss, GPP faded Blaney", is
   actually a TIE on IDENTICAL lineups at 171.30. The fade-the-winner pattern is one instance, not a
   trend, so the top-k-by-mean patch was never built.
4. **SS "car quality survives" - RETRACTED.** Argued from one race; 27 held-out races say no.
5. **"We can't project ownership" - WRONG HEADLINE.** We can (MAE 6.1). What we cannot do is get an
   EDGE from it, because it is derived from proj_dk. Different claim.

### WHAT IS NOW FALSE IN THE OLDER SECTIONS
- "DFS replay ledger: 6 races - GPP 4 wins, 1 tie, 1 LOSS" -> **3 wins, 2 ties, 3 losses over 8
  races**, and SEVEN of those eight ran on pre-2026-08-29 draws (old SS dominator allocator, old
  SHORT/INT wreck survival). As evidence about the CURRENT engine the ledger is n=1. Neither the old
  4-1 nor the corrected 3-2-3 justifies a default-mode change.
- "Operator's cup DK entries used no-cap exposure -> habit fix = exposure ~50%" -> superseded; under
  E[max] the cap is not the mechanism.
- "Ownership ground truth: 7 contests banked. Refit at 8-10." -> 8 banked, and the refit question is
  ANSWERED: our own proj_dk predicts ownership at LORO Spearman 0.762 and every added feature made it
  worse (salary 0.755, +optimal% 0.750, +value 0.754). There is no ownership model to build.
- Queue 1 (ownership-leverage overlay) and Queue 2 (replay report UI) - see the queue notes below.

### CLOSED THIS SESSION
- **Superspeedway finish-quality** - registered holdout FAILED both bars (see the pre-registered
  section). GROUP_NOISE_MULT SS 1.75 is now supported by a holdout, not just the win curve.
- **Leverage as an edge** - our best estimate of the crowd IS our board, so optimal% minus ownership
  restates our own projection error. Reopens only with an ownership signal independent of proj_dk.
  Drive was swept for one (Phil's sheets: none; the FCFM "Interest" column is the analyst's own play
  preferences, not an ownership read - operator checked and corrected me).

### BLOCKING, OPERATOR ACTION
Four races have loop data but NO pit stops or penalties - trucks R18 NH (8/22), cup R25 NH (8/23),
oreilly R24 Daytona (8/28), cup R26 Daytona (8/29). The local backfills fall back to the publishable
key when SUPABASE_KEY is unset, and RLS grants those tables to `authenticated` only, so PostgREST
returned 200 + an empty array and the script reported "0 races in scope" and exited clean for eight
days. FIX: `setx SUPABASE_KEY "<service role key>"`, new terminal, run POST_RACE_UPDATE.bat once.
Both scripts now refuse to run silently in that state. Full detail: PITBOARD_SCRIPTS.md.

## 2026-08-24 SESSION HANDOFF — READ THIS BEFORE ACTING ON ANY 2026-08-24 ENTRY
Whole session was ANALYSIS ONLY. Zero changes to src/, api/, package.json, the database, or any
model logic. DOC SPLIT (2026-08-24, Fable): BACKTEST_LOG.md was ~129k tokens and unreadable whole; entries
before 2026-08-03 moved VERBATIM to BACKTEST_ARCHIVE.md (~86k tok, CLOSED - never append there).
Active log is now ~44k tok. Verified line-for-line: archive+log content == pre-split file (096acad). All commits are BACKTEST_LOG.md + PITBOARD_STATE.md. Verified: no src/api diff across
the whole day, working tree clean, no leftover DB objects.

### EVERY UNIT AND ROI FIGURE BELOW IS A **PAPER RECORD** — NOTHING WAS EVER STAKED
Operator: "I don't bet everything the model flags; this is all hypothetical data logging until we get
this thing dialed in." Correct, and I wrote it wrong all day. "-102 units", "-8.56 units",
"ROI -35.2%" etc. are computed by staking 1 flat unit on EVERY flag. That is the right way to
evaluate the FLAGGING RULE — it is what a backtest is — but they are NOT losses. Read every one as
"what the rule would have produced if bet blindly," which is exactly what the operator declined to do.

### SAMPLE SIZE: IT WAS NEVER 9 RACES — sim_grades HOLDS 16 (operator's catch, late in session)
sim_results has 18 rows / 9 races (pre-07-24 boards genuinely lost). sim_grades SURVIVED that erasure: 30 graded boards over **16 races** back to 07-06. Several 08-24 entries say "n=9" and are UNDERSTATED. What extends: `metrics{}` (per-board Brier/Spearman/MAE) -> pre/post sweep at **14 paired races**; `ev_flags{}` (ev/mev/price/hit) -> flag sweep at **377 flags / 15-16 races**. What does NOT extend: `actual{}` kept only car_number+finish, so the per-driver board is truly gone — calibration-by-band, winner-rank and #1-pick distribution STAY at 9. ev_flags carries no medge, so medge/tail work STAYS at 290 flags.
RE-RUNS: pre/post at 14 races — Brier still non-significant on all four markets, but SPEARMAN t=2.07 and MAE t=-1.84 both favour post. Conclusion unchanged, ordering half stronger. Flag sweep at 377 — total -31.5%, EV inversion HOLDS and sharpens (ev 10-24 -4.7% on 175; 25-49 -69.3%; 50-99 -60.9%; the 100+ band's +6.8% is n=31 longshot noise, was -11.8% at n=9). mev>0 goes -11.4% (35 bets) -> +18.9% (64 bets) — BUT 5 races positive / 6 negative and EXCLUDING THE BEST RACE IT IS -2.0 UNITS. Quote it as "removes the bleeding (-41.8% -> ~break-even)", NEVER as "+18.9%". BACKTEST_LOG 2026-08-24.

### TEN OF MY OWN CONCLUSIONS WERE CORRECTED OR RETRACTED THE SAME DAY
The BACKTEST_LOG entries are chronological, so an early entry may be overturned 300 lines later.
Do NOT act on an 08-24 entry without checking this list first. The operator caught nine of the ten.
1. "Byron 14.3% post was over-confidence" — WRONG. He lost a wheel running top 5 (26 laps led,
   high pos 1, 296/301). Fast car, killed by attrition. Example struck.
2. "The board reads pace well; the pace-to-finish CONVERSION throws it away; aim at conversion not
   weight sweeps" — RETRACTED, WRONG IN DIRECTION. Scoring the board against ARP is circular
   (corrHistory ~37% weight IS driver_rating, built largely FROM ARP). Chain decomposition points
   the other way: pace->finish 0.83 in-sample / 0.760 over 434 archive races, board->pace only 0.61
   in cup. PREDICTING pace is the weak link. Weight/signal work aims at the right half after all.
3. "No demonstrated CLV edge (92 beat / 101 lost)" — WRONG UNIT. Flags in one race are ONE
   correlated claim, not many trials. See 5A-PRIME: clustered properly it is positive.
4. "medge is computed off RAW implied, we don't de-vig" — RETRACTED. We DO de-vig
   (SimulationCenter.js:285, proportional per book, leave-one-out sharp consensus). I inferred a
   defect from one row landing 0.6 points apart without reading the function.
5. "The flags lose 35%" — that is the DEFAULT view (green badge, ev>=10). The tight filter
   (mev>0) exists at SimResults.js:443 but mvQual defaults FALSE. Qualified list is -11.4% on 35
   bets. I scored the loose list all day.
6. "Ingest LSP, the new orthogonal speed signal" — BACKWARDS. LSP is a RANK metric and the
   rank-metric family is already closed by the 2026-07-07 saturation finding. cPOMS is the one that
   matters — it is a RATIO and preserves margin. Operator supplied the definitions.
7. "We only have 9 boards" — WRONG, sim_grades holds 16 races. See the sample-size block above.
8. "We lost N units" — WRONG FRAMING. Paper record, nothing staked. See the block above.
9. Misread the HighLine table as "how deep on their board was the winner." It is "where did their #1
   projected driver FINISH." The first row is identical either way so the 47.6% analysis stands; rows
   2-6 are what I got wrong, and they are where the signal is (their #1 is top-5 85.7% but wins
   47.6% — that gap IS the pace-to-finish conversion noise).
10. THE POLE-SITTER BENCHMARK IS INSIDE OUR OWN MODEL. DEFAULT_WEIGHTS.startPos 0.23 (0.33 truck
   short/flat), so our #1 pick is partly made of it. "We beat pole by 6.2 points" measures the sim
   against one of its own terms. Fourth yardstick-inside-the-model error of the day. DISCOUNT every
   pole comparison. The right benchmark is the MARKET FAVOURITE — see below.

### WHAT IS ESTABLISHED (survived scrutiny, safe to build on)
- BOARD CALIBRATION IS SOUND. 644 driver-rows/market, 9 races, both stages. Top-5 within ~5pts of
  truth in every band. Flag ROI is NOT evidence of a miscalibrated sim — different objects.
- POST BOARDS ARE BETTER ORDERED. Winner's rank improves or ties 9/9, regresses in none (p=.008).
- FLAGGED DRIVERS BEAT THE FIELD ON CLV, 9/9 races, +1.731pts, t=3.93. Complete population
  (odds_snapshots), pre-sim -> post-sim window, two confounds killed (consensus pricing +1.441;
  beats unflagged in every pre-probability stratum). Modest — roughly the vig, maybe a bit more.
- THE TAIL IS FABRICATED. sim_prob<10% went 0-for-72; odds>=+1000 in win/t3/t5 went 0-for-99.
  Reality 0.76% | market 1.54% | PitBoard 5.0% at +2000 and longer.
- EV IS INVERSELY RELATED TO RELIABILITY, monotonic. corr(ev, line move) = -0.139 while
  corr(medge, line move) = +0.101. A star rating keyed to EV would surface our worst plays first.
- ABSOLUTE POINTS BEAT A RELATIVE RATIO for any medge floor — monotonic, settled.

### OUR #1 PROJECTION'S ACTUAL RECORD (sim_grades.metrics.prec, back to 07-06)
GradeCenter.js:55 — prec('win',1) sorts by WIN PROBABILITY, takes the top driver, checks if he
finished 1st. Same question HighLine's first row answers.
POST boards, 16 races: #1 WON 4 = 25.0% overall | cup 1 of 7 (14.3) | xfinity 0 of 4 | trucks 3 of 5
(60.0). Precision at 5 = 2.44/5 (48.8%). PRE boards, 14 races: 1 of 14 = 7.1%. Post crushes pre on
this metric (25.0 v 7.1) — the pre/post finding in its bluntest form.
BENCHMARK — MARKET FAVOURITE (independent of our model; covers 10 of the 16 graded races):
    ALL  market 3/10 = 30.0%   ours 4/10 = 40.0%
    cup  market 1/5  = 20.0%   ours 1/5  = 20.0%   DEAD EVEN
    ore  market 0/2            ours 0/2            DEAD EVEN
    trk  market 2/3  = 66.7%   ours 3/3  = 100%
THE ENTIRE MARGIN OVER THE MARKET IS ONE TRUCK RACE (Richmond R17, Honeycutt over Majeski). Ten races,
one-race difference — statistically nothing. Our four wins are cup NH R25 plus trucks R16/R17/R18,
three CONSECUTIVE truck races: the same streak already carrying two other analyses today. 60% is not
a truck capability. IF WE EVER PUBLISH A SCORECARD, publish precision-at-5 and mean finish, NOT the
win row — the win row is the most luck-dominated, which pace->finish 0.83-0.87 predicts.

### PROPOSED AND UNBUILT — nothing here has been written
Priority order as of end of session:
1. [SHIPPED 2026-08-29 - THE TAIL FIX] Green badge + Qualified filter now require mev>0 AND the
   backstop (model prob >= 10, no prices past +1000) on top of ev>=10. Retro partition on the 324
   logged flags: old badge showed 238, new shows 20 (~1.3/race); the 0-for-72 sub-10% and
   0-for-99 +1000 groups are structurally excluded. Write-side logging stays ungated (doctrine
   2026-08-08 #69). Judged forward by the CLV lift ledger, as pre-registered.
2. [DONE 2026-08-28/29] Lap Raptor capture shipped (forward parser) AND 139-race backfill
   executed. Note the OUTCOME (BACKTEST_LOG 2026-08-29): all lap_performance metrics closed for
   finish ordering; dominator gate also stopped. The data collection paid off in certainty, not
   in a new input.
3. [SHIPPED 2026-08-29] medge surfaced: badge chip (m+X, green at >=5) on SimResults, flag rows
   in GradeCenter show m+X, medge added to flagged_bets fetches.
4. medge FLOOR — DO NOT PICK ONE YET (unchanged). Ladder non-monotonic at 9 races. PARALLEL
   LEDGERS NOW LIVE in GradeCenter roi: consensus (mev>0, tight), medge5+ (principled), medge10+
   (fitted - forward-test ONLY). The CLV ledger decides; do not adopt 10 from the 9-race data.
5. [RUN 2026-08-29 - STOPPED AT THE GATE] cPOMS gated test executed exactly as pre-registered:
   finish gate passed weakly then the sweep failed OOS; dominator gate stopped (LL wrong sign,
   FL under the 0.05 floor). Nothing ships. One narrow re-run permitted on FUTURE data only
   (FL-share x cPOMS/P95) - see BACKTEST_LOG 2026-08-29.
6. CAPTURE MATCHUP LINES (operator habit). Zero matchup prices exist, so the one hypothesis with a
   real shot cannot be tested at all. Matchups need ORDERING only — the model's proven strength.

### STANDING RULE, FOUR INCIDENTS DEEP
Before adopting ANY evaluation target or benchmark, check it against the model's INPUT LIST. ARP was
inside driver_rating. Start position is inside the weight set. Both looked like independent yardsticks
and neither was. Corollary, three incidents deep: count the races in EVERY table that could hold them
before stating n.

### PRE-REGISTERED — DO NOT RE-TUNE THESE ON EXISTING DATA

- [CLOSED 2026-08-30 — FAIL, registered holdout] SUPERSPEEDWAY FINISH-QUALITY. Does a driver's prior
  SS record predict his SS finish beyond starting position? 71 races, train 2022-24 / holdout 2025-26,
  coefficients frozen and pushed before the holdout was read. Holdout delta -0.0041 mean per-race
  Spearman (bar +0.05), positive in 13/27 races (bar 60%). Secondary on DK points +0.0030. CLOSED —
  do not re-open without genuinely new features (not new weightings of these). Baseline rho(start,
  finish) at SS is only +0.186, so the ceiling on SS finish-rank skill is low for structural reasons:
  the race is near-unpredictable, and GROUP_NOISE_MULT SS 1.75 is correct rather than lazy.
  Consequence: our SS proj_dk correlating ~0.93 with the starting grid is faithful, not a defect.
- CLV lift ledger: race-level, re-run every weekend (zero marginal work, odds_snapshots already
  captures it). BAR = holds above zero through 15-20 races. Do not re-tune the window or the strata.
- medge floor 5 is the PRINCIPLED value (below it, two independent measures say no model content).
  10 is the FITTED sweet spot and must not be adopted on these 9 races — forward-test it alongside.
- cPOMS gate is inherited from the GFS test (BACKTEST_ARCHIVE.md, 2026-07-07 GFS entry). I did not design it and it must not be modified.
- SS noise multiplier m=1.75 (GROUP_NOISE_MULT, runRaceSim) is FROZEN per the 2026-08-29
  pre-registered calibration (fit 2022-24, validated 2025-26). Do NOT refit from in-sample
  results; next legitimate refit after ~10 new SS races, same split discipline rolled forward.
  Judge: win-Brier on future graded SS boards + CLV ledger.
- SHORT and INT noise mult CERTIFIED at m=1 (2026-08-29 win-curve fits), but the WIN test was
  too narrow: the same day's placement-tail calibration (win+t5+t10+fin25 jointly) found the
  real defect in WRECK_SURV_COST and shipped SHORT 1.6→16, INT 2.5→18 (operator-approved with
  disclosed holdout residuals — see BACKTEST_LOG 2026-08-29). All four constants (SS m=1.75,
  SHORT/INT surv, m=1 elsewhere) are FROZEN; no in-sample retuning; next refit after ~8-10
  fresh races per group. Forward judge: reliability (pred-vs-actual t10 buckets) on future
  boards. Known residual: INT t10 ranks 16-20 may over-flag mid-pack. ROAD untestable (no
  graded boards yet; surv 2.7 unexamined — same mechanism suspect when boards exist).

### OPEN QUESTIONS FOR THE OPERATOR
- driver_rating: pitboard.md 2026-07-26 says new-format rows store it NULL because Lap Raptor
  dropped it site-wide, but loop_data has it 36/36 populated through cup NH R25. Old parser still
  matching, or another source? Changes the urgency of everything in #5 if it IS drying up.
- What are GR / LR / GR-LR on the Advanced report? If they are green-run / long-run splits that is a
  RACE-derived version of shortRunPace / longRunPace / tireFalloff — potentially more valuable than
  cPOMS. Undefined publicly.
- Product shape (see #4): few high-conviction plays, or a broader research-grade list?

## Launch runway (target: NEXT SEASON — pushed 2026-08-31; list is current, the timing is not)
- [x] #64 table-lockdown SQL — RUN + LIVE-VERIFIED 2026-08-19 (anon 0 rows everywhere; RPCs
      converted to security invoker; loop_data_dk view security_invoker; week-pass expiry
      predicate fixed both sides). The API paywall is UP.
- [x] PAYWALL_ENABLED = true (9b9d72f) — signed-out redirect + admin pass verified live.
- [x] Flip test COMPLETE 2026-08-19: subscriber pass, admin block, expired-pass lockout,
      cancel→webhook→paid-through, portal opens. Subscribe-page gated/expired callout shipped
      (9a67572). Cancel policy: paid-through kept even on immediate cancel; refunds = manual row edit.
- [x] Stripe Customer Portal settings SAVE — test mode done + verified via Manage billing.
      Live mode still needed at cutover.
- [ ] Stale-sample landing check: landing no longer queries Supabase at all (stats bar
      removed 2026-08-19 close) — remaining work is just a signed-out visual pass to confirm,
      then close.
- [ ] Weekly auto-renew activation (operator): recurring $9.99/wk price in Stripe test
      dashboard -> swap STRIPE_PRICE_WEEKPASS env in Vercel -> redeploy -> test purchase.
      Weekly buy button BROKEN until done (code shipped 98a86ba). Repeat in live at cutover.
- [ ] Vercel Hobby → Pro (~$20/mo, commercial use rights) — at live cutover, not before.
- [ ] LIVE Stripe cutover: recreate products + webhook in live mode, swap 4 env values,
      real-card test.
- Optional: delete inert REACT_APP_ADMIN_PASSWORD env var.

- [x] PUBLIC FUNNEL PAGE (2026-08-23, b09d06c): Lap By Lap is free to everyone, scoped to the
      configured weekend by three get_public_* DEFINER RPCs that join featured_weekend. No table
      opened to anon (verified: all direct reads 0 rows). CONSEQUENCE: featured_weekend is now
      PUBLIC-FACING - stale config shows to the world (oreilly still on Iowa R23 from 8/04).
- [x] RPC hardening: anon EXECUTE revoked on has_access()/is_admin(); get_practice_sessions
      DEFINER gap closed by the public-RPC design instead of INVOKER (INVOKER attempt timed out
      the page and was reverted - see pitboard.md 2026-08-23).

## Open experiments (ledgers)
- v6.3-st session-time correction: LEDGER 2-1 (wk1 trucks +.026, wk2 cup -.099, wk3 cup NH +.028 CORRECTED WINS, protocol target rho .624 v .596 n=36). POOLED mean delta -0.0150, sem 0.0420 over 3 sessions - indistinguishable from zero, dominated by wk2. Verdict deferred to 8-10 sessions per the 2026-08-23 protocol correction; emergency stop (single week worse than -0.15 rho) never approached. Wk3 was the FIRST CLEAN test (A/B groups gone, gc correction self-disabled). BLOCKER unchanged: truck sessions still upload with no captured_at, so the pool fills at half rate - fix the watcher for truck practice.
- DFS replay ledger: **SUPERSEDED 2026-08-30 - the 6-race 4-1-1 does not reproduce.** All 8 replayable races re-run through the product's own solvers: GPP 3 wins, 2 ties, 3 losses; mean best-of-20 field percentile cash 40.6 v GPP 39.0. The cup NH R25 entry above is WRONG - both modes build the identical lineup and score 171.30, a tie, so 'GPP faded Blaney' is not a finding. Seven of the eight ran on pre-08-29 draws (engine_era stamped in dfs_replays), so as evidence about today's engine this is n=1. Ledger rebuilds from here through Admin -> DFS Replay.
- DK FPTS decomposition (9 post boards, 2026-08-24): NO broken component - finish .605, place .573, laps led .461 (weakest, but only 7% of variance), fastest laps .665 (strongest), TOTAL .475; 45% of variance is covariance between terms. Errors compound: total ranks below the component average by -0.101 in 7 of 9 races. CORRECTION to the earlier 2-slate claim: DK salary does NOT generally out-predict us (we win 4, salary 5, one a tie; means .480 v .499). The surviving signal is TRUCKS-ONLY - salary wins all 3 truck races, mean gap -.070, n=3. Watch for a 4th/5th truck race; if it holds, consider a market anchor on truck DK projections.
- Pre/post board sweep (9 paired boards, 2026-08-24): POST IS BETTER ORDERED, NOT BETTER CALIBRATED. Winner's win-board rank improves or ties 9/9, regresses in NONE (7 strict, p=.008); actual top-5 finishers gain 0.64 board slots. Brier favors post on all four markets but proves nothing at n=9 (|t| <= 1.24; robust to renormalization). Post boards are much sharper - top favorite 17.8% -> 25.3%, entropy down 8/9. THE SHARPENING IS UNEARNED IN THE CUP WIN MARKET: cup picks >=12% predict 20.8% and hit 8.3% post (pre was already bad at 16.8/9.1). Series split is NOT a finding - trucks' Brier edge is 3-for-3 favorite luck at ~25% each, and full-field Spearman splits the OTHER way (post better 4/4 cup, 1/5 non-cup). Keep publishing post; discount post CUP win pct for win-market bets. Re-run at 15-18 pairs. BACKTEST_LOG 2026-08-24.
- [BYRON CORRECTION, same day - STANDS] Operator corrected my "over-confident" example: Byron lost a wheel running top 5 (26 laps led, high pos 1, 296/301), so the 14.3% post rating was right on speed and killed by attrition. The cup high-confidence gap (8.3% realized on 20.8% stated, n=12) is heavily ATTRITION-driven - also two Larson failures and Blaney leading 129 and 88 laps in two races he didn't win. Practical advice unchanged (discount post cup win pct), diagnosis softened.
- [RETRACTED same day - I WAS WRONG IN DIRECTION] I claimed "the board reads pace well and the pace-to-finish conversion throws it away; aim at conversion, not weight sweeps." Operator challenged it from the ARP-vs-driver-rating archive. Two problems: (1) CIRCULARITY - corrHistory (~37% effective weight) IS driver_rating, which is built largely FROM avg running position, so scoring the board against ARP is scoring it against its own input. The 2026-07-07 GFS entry logs this exact trap and I walked into it. (2) The chain decomposition points the OTHER way: pace->finish is 0.83 within these 9 races and 0.760 across 434 archive races (cup .735/oreilly .772/trucks .782), while board->pace in cup is only 0.61. The weak link is PREDICTING pace, not converting it; our shortfall vs the naive chain product is just 0.053. Weight/signal work is aimed at the right half of the pipeline after all. Queue 8 (DNF tiering) stands on its own merits, unpromoted. For the record the 2026-07-07 ablation concluded ARP and driver_rating EQUIVALENT (.472-.474 test, all configs), not "rating better" - rating was kept as incumbent. METHOD: before adopting any new evaluation target, check it against the model's input list. BACKTEST_LOG 2026-08-24.
- Ownership ground truth: 8 contests banked (+ cup Daytona R26). QUESTION ANSWERED 2026-08-30, no refit needed: our proj_dk predicts field ownership at LORO Spearman 0.762 and NOTHING we hold improves it (+salary 0.755, +optimal% 0.750, +value 0.754). Shipped as a Proj Own% column (MAE 6.11 pts). The residual (actual minus predicted) is the only place a real crowd bias could show; per-driver residuals are 1.5-2 SE at n=3-5, revisit at ~20 races.

- BOARD CALIBRATION IS SOUND (2026-08-24, 644 driver-rows/market over 9 races, both stages). Top-5 lands within ~5pts of truth in EVERY band (says 1.2/happens 1.0 ... says 67.9/happens 66.7); top-10 close and mildly UNDER-confident at 10-20; win fine where n supports it. Known exception: cup favourites at the top of the win market are over-confident (12 picks, 20.8% stated v 8.3% realised). THE FLAGS' -35% ROI IS NOT EVIDENCE OF A MISCALIBRATED SIM - flagging selects where model>market, which selects the model's own upward errors (winner's curse, arithmetic not defect). Different objects, different measurements. Do not let one be quoted against the other. BACKTEST_LOG 2026-08-24.

## Queue (rough priority)
1. [SPLIT 2026-08-30] Ownership-leverage overlay: the PROJECTED-OWNERSHIP half is SHIPPED (Proj Own% column, MAE 6.1). The LEVERAGE half is CLOSED - it is derived from proj_dk, so chalk-trap flags would restate our own projection error as a market inefficiency. Build diversification is also done, differently and better: E[max] diversifies endogenously. WHAT REMAINS AND IS NOW THE TOP DFS ITEM: a DUPLICATION-weighted objective - E[max] currently maximises our score as if we were the only entrant, when a tournament pays on beating other entries. Needs no new model (proj-rank is the ownership proxy); needs pre-registration.
2. [SHIPPED 2026-08-30] DFS replay report UI - Admin -> DFS Replay. Picks a race, rebuilds both modes from the stored draws via the product's own exported solvers, grades BEST-OF-N against loop_data, places it in the uploaded contest, reports rho vs model/salary/ownership, flags unmatched names, and saves to dfs_replays with an engine_era stamp. Ledger table with the running tally is on the same panel.
3. [CLOSED 2026-08-23 - NO SHIP] All-tracks blend into corrAvgRating tested at board level: 341 races, all four track groups, production weight set per race. EVERY arm (w .25-.75) ties current on win/t3/t5/t10; mean win Brier degrades monotonically with w. The pre-test's decisive rating-prediction gain (W244/L138 p<1e-7) did NOT reach the market bar. corrAvgRating stays type-only. Harness validated first by reproducing the startPos result 134W/64L p<.001. BACKTEST_LOG 2026-08-23.
4. Sim A/B: long-run practice input.
4b. [SHIPPED 2026-08-20] startPos conditioned sweep: 230-race full-model sweep ->
    DEFAULT_WEIGHTS.startPos 0.33 -> 0.23 (t10 134W/96L p~.01) + TRUCK_SHORT_WEIGHTS
    exception keeping 0.33 on trucks short/flat (cut loses there, raw corr .576).
    PROSPECTIVE WATCH: revert-review if cup boards go 0-fer t5/t10 vs books two straight
    weekends. Leftover thread: cup ROAD runs the lowest startPos set despite highest
    marginal value - road sweep candidate for 2027 (no road races left this year).
5. [RUN 2026-08-24 — NO EDGE DEMONSTRATED, DO NOT SELL FLAGS YET] 290 graded flags, 9 races, both stages: 17.6% hit vs 26.0% claimed, ROI −35.2%, −102u. (a) THE TAIL IS FABRICATED: sim_prob<10% went 0-for-72 (p=.013); odds>=+1000 in win/t3/t5 went 0-for-99 (p=.0004). 103 flags = 35% of the book carry −88 of the −102 units. Existing MINP floors (win 2/t3 5/t5 8/t10 12) are far too low — every one of the 0-for-99 cleared them. (b) EV IS INVERSELY RELATED TO RELIABILITY, monotonic: EV<10% is calibrated (25.4 actual v 26.7 claimed), EV 50-99% is fantasy (5.4 v 24.0). SO A STAR RATING MUST TRACK sim_prob AND PRICE, NEVER EV — ranking by EV descending is close to ranking worst-first. (c) [CLV CLAIM CORRECTED SAME DAY - see 5b below] I read CLV at the ticket level (92 beat / 101 lost) and called it no edge. WRONG UNIT: flags inside a race are one correlated claim, not many trials. In-sample filter (sim_prob>=10% AND odds<=+900) turns −35.2% into −7.5% (~the vig), NOT into a winner; thresholds must be FROZEN and forward-tested 6-8 weekends, not tuned further. The weak product is the betting overlay, not the analytics — the board's ordering tested sound the same day. BACKTEST_LOG 2026-08-24.
5A-4. [EXPANDED 2026-08-24 — THE medge FLOOR IS **NOT** THE FIRST MOVE. Supersedes 5A-3's recommendation] FRAMING ERROR I carried all day: the -35% ROI is the DEFAULT SimResults view (green badge = ev>=10). SimResults.js:197 sets mvQual=FALSE — the tight filter at line 443 (ev>=10 AND mev>0 AND no fav past -150) is an OPT-IN toggle nobody has on. Two very different lists: (1) green badge default 276 bets, 30.7/race, ROI -36.2%; (2) +mev>0 toggle 35 bets, 3.9/race, ROI -11.4%; (3) 2+medge>=5 13 bets, +15.4% (n=13, meaningless); (4) badge+medge>=5 no mev 141 bets, 15.7/race, -16.1%. THE BIGGEST AVAILABLE IMPROVEMENT IS A DEFAULTS CHANGE TO CODE THAT ALREADY EXISTS AND IS ALREADY CORRECT.
  medge floor ladder is NON-MONOTONIC (0:-34.5, 3:-19.3, 5:-16.0, 6:-24.1, 8:-9.5, 10:-1.7, 12:-12.2, 15:-13.8) — that wobble is noise at 9 races; NO floor makes it profitable; do NOT adopt the fitted 10. SETTLED CLEANLY: absolute points beat a RELATIVE ratio, monotonically (medge/consP floors get worse: 0.25 -34.0, 0.5 -39.2, 0.75 -70.6, 1.5 -100). By market the floor is uneven: t3 -50.6->-16.2 (big win), win -65.8->-41.7 (still awful, cuts 42 of 60), t5 -24.3->-24.0 (NO HELP), t10 doesn't need it. Cost is real: floor 5 cuts 8 of 51 winners, mostly SHORT prices where small medge was correct (Honeycutt WON trucks R17 at +900, medge 3.59; Briscoe t5 +155 medge 4.61 finished 2nd).
  DO IN ORDER: (1) make market agreement the DEFAULT — default mvQual true, or better require mev>0 for the green badge at SimResults.js:479 so the visual 'bet this' signal can't fire against sharp consensus. Zero new code, biggest measured effect. (2) SURFACE medge on flag rows — computed, stored, never shown in the badge path. (3) DO NOT pick a medge floor yet: at 35 bets the qualified list is indistinguishable from zero or from -30%, and choosing between '3.9 tight plays/race' and '15.7 medium plays/race' is a PRODUCT SHAPE call for the operator, not a number for me to fit. Run both as parallel ledgers 15-20 races. BACKTEST_LOG 2026-08-24.
5A-3. [superseded by 5A-4 on the recommendation; the medge/ev diagnosis below still stands] [THE FIX, 2026-08-24 — ONE CHANGE. Supersedes 5A-2 item 2, which was RETRACTED] Operator: "I thought we were devigging the price?" WE ARE — SimulationCenter.js:285 `dvg[bk][k] = imp[k]/s*target` is proportional de-vig per book, and consP is the LEAVE-ONE-OUT sharp consensus excluding the book we'd bet. medge = our p minus consP, de-vigged AND sharp. My "no de-vig" claim came from one row of arithmetic landing 0.6pts apart. RETRACTED.
  THE REAL DEFECT: we gate on **ev**, not medge. GradeCenter.js:58/89 MIN_EDGE_BET=10 on m.ev; SimResults.js:442/443 MIN_EDGE_PUBLIC=10 on r.ev. ev = our prob x BEST RAW price, so it fires whenever ONE BOOK HANGS A LONG NUMBER regardless of whether we disagree with sharp consensus. SimulationCenter.js:320-322 says so in a comment: medge "is the ONLY one of the three that isolates model alpha. A model with zero edge still prints a fat ev whenever one book hangs a bad number." We compute the right diagnostic, store it, gate on the wrong one.
  TWO INDEPENDENT MEASURES AGREE. ROI by medge band: <5 = -57.1% (135 bets, odds +1808), 5-10 = -31.8%, 10-20 = +20.8% (50 bets, odds +194), 20-35 = -37.1%, 35+ = -43.8%. Line movement by medge band: <5 +0.895 (35/34 coin flip), 5-10 +1.320, 10-20 +3.381 (12/7), 20+ +1.979. corr(medge,move)=+0.101 vs corr(ev,move)=-0.139 — THE SIGN FLIP IS THE HEADLINE. medge<5 is 135 of 290 flags and carries -77 of -102 units (76% of the loss): line-shop artifacts, not model calls.
  PROPOSED (needs approval, nothing built): add a **medge floor** alongside the ev floor at the two gate sites. Pre-register 5 (defensible on principle — below it two independent measures say no model content). Do NOT adopt 10 on this data (n=50, one band of five, chosen after looking) — forward-test it alongside. Old item 1 (disagreement shrink) drops to SECONDARY since medge already IS that measure; old item 3 (backstop 10%/+1000) survives but is largely redundant. JUDGE BY the race-level CLV lift ledger, not in-sample ROI.
5A-2. [TAIL DIAGNOSIS 2026-08-24 — item 2 RETRACTED, see 5A-3 — AWAITING OPERATOR APPROVAL, NOTHING BUILT] The tail is NOT a separate defect and needs no special-case rule: it is the same winner's-curse selection at the point where RELATIVE disagreement is largest. Market-vs-reality on the whole field: at +2000 or longer the market prices 1.54% where reality is 0.76% (n=655, 5 hits v 10.1 expected) — so favourite-longshot bias is real but modest; short bands show a steady -3 to -4pts which is just the vig. THE NUMBER: reality 0.76% | market 1.54% (2x high) | PITBOARD 5.0% (6.6x high). We take the worst side of an already-shaded price. NOT a calibration failure — the board's own 0-5% buckets are fine (win says 0.9/happens 0.6, n=533). What fails is the SUBSET the market prices far lower. PROPOSED (needs approval): (1) disagreement-scaled shrink toward DE-VIGGED market in log-odds, lambda set from the MEASURED CLV-information ladder (<5% +0.31, 5-15% +1.43, 15-35% +2.78, 35%+ +3.79) not fitted to ROI — tail collapses on its own, 15-35% band barely touched; (2) DE-VIG before computing edge at all — medge appears to use RAW implied (Byron t10: sim 88.1, +125 = 44.4 raw, medge 44.25), overstating every edge by the vig — straight defect; (3) hard backstop: no flag under 10% model prob or longer than +1000. JUDGE BY the race-level CLV lift ledger, NOT in-sample ROI. Sanity-check against the 9 races; do NOT tune lambda there. BACKTEST_LOG 2026-08-24.
5A-PRIME. [STRONGEST RESULT OF 2026-08-24 — COMPLETE POPULATION, TWO CONFOUNDS KILLED] Operator corrected me twice: auto-capture ALREADY EXISTS (odds_snapshots, 57,587 rows, full board at every sim paste), and the CLV window is PRE-SIM -> POST-SIM, not bet-to-close (practice-to-green is minutes, so that window is dead). Redone properly: anchor each board to its nearest capture moment, normalize the field to the market's true total (strips vig; field movement then sums to zero, so this measures who gained at whose expense). RESULT: drivers flagged off the PRE board beat the field by +1.731 pts, sem 0.440, t=3.93, POSITIVE IN ALL 9 RACES, none negative. By market: t3 +1.955, t5 +1.723, t10 +1.650, win +1.082 (unflagged all negative). CONFOUND 1 stale lines — re-run on CONSENSUS pricing, +1.441 v -0.165, effect barely moves, NOT stale-line reversion. CONFOUND 2 favorite drift — flagged beats unflagged in EVERY pre-probability stratum (<5% +0.53/+0.22, 5-15% +1.32/-0.11, 15-35% +2.16/-0.62, 35%+ +1.66/-2.13). These are PRE-PRACTICE flags the market moves toward BY post-practice = information the market lacked. CAVEATS: +1.73pts is real but MODEST (~the vig, maybe a bit more); does NOT rescue the -35% ROI; the tail is the WEAKEST stratum here and was 0-for-99 on results; 9 races, un-pre-registered. ACTION: re-run every weekend (zero marginal work, capture already happens), keep a race-level lift ledger, PRE-REGISTER NOW that holding above zero through 15-20 races is the bar for a subscriber-facing product. Do not tune the window or strata again. BACKTEST_LOG 2026-08-24.
5a. [superseded by 5A-PRIME above, kept for the reasoning] [CLV IS POSITIVE WHEN CLUSTERED PROPERLY — 2026-08-24, operator's catch] Flags in one race are NOT independent: win probs sum to 1, so 3 win flags carrying 73 combined points against a market pricing them at 38 is ONE claim on 3 tickets (cup Iowa R23 post; Richmond R24 pre 65.0pts/+35.7). Counting 273 tickets as 273 trials overweights whichever races generated most tickets. AT RACE LEVEL (10 races): mean CLV +1.264, sem .514, t=2.46, 8 pos/2 neg. Every market positive (t5 +1.57, win +1.31, t3 +1.14, t10 +1.05). NOT longshot noise — CLV is +1.48/+1.50 under +1000 and only +0.40 in the +1000 tail; excluding the tail, mean race CLV +1.696, t=2.35. The edge sits exactly where probabilities are calibrated, and the tail is bad on BOTH measures. Does NOT rescue the -35% ROI (positive CLV + negative ROI over 9 races is ordinary variance) and does NOT save the tail. BIGGEST THREAT: clv_log is captured MANUALLY and incompletely (NH cup missed entirely) — if logging is even slightly more diligent when the line moved our way, the whole result is selection. INADMISSIBLE until capture is automatic.
5b. [CORRECTED — auto-capture already exists in odds_snapshots; I proposed building what we had. Operator captures it by pasting odds into pre and post sims, which is the whole point.] Still worth doing on the same trip: CAPTURE MATCHUP LINES (plus stage-winner / fastest-lap) every race. We have ZERO matchup prices, so the one hypothesis with a real shot cannot be tested at all. Rationale: matchups need ORDERING only, which is the model's proven strength, while absolute probability — the thing flags sell — is its proven weakness. First read on 5,636 pairs from the 9 post boards: model picks the right driver 73.2% overall vs 69.3% for start position, and the lift peaks at +9.9pts in the 1-2 projected-position gap band where books actually offer pairs. HYPOTHESIS ONLY — start position is a weak proxy for what a book knows, and without real matchup prices there is no test. Also re-run pairwise through the historical harness (pre-07-24 boards are gone; 18 boards is the whole published archive).
6. Staking layer (¼-Kelly display, ladder-aware, per-race cap).
7. CLV-vs-close-consensus method change (forward-only).
8. Mech DNF tiered by equipment; tire-management earned/dashed column; matchup pricer; RR+LR loop-data merge mode; PENALTIES_BACKFILL_ALL history run (operator); best-5 tooltip wording.

## Loose ends
- [NEW 2026-08-30] `loop_data.car_number` stamping is a NAME join against the rolling `entry_list`
  (Admin.js ~903) and `api/load-race.js` never writes it at all - 1,962 rows over 72 races had NULL,
  which silently drops those drivers from every pit-crew analysis (crew key = car+org+season). 650
  repaired from `pit_stops` (exact/prefix only, single-candidate, additive); 2026 went 21 -> 5. The
  1,312 left are 2022 races and races with no NASCAR pit feed - no second source exists. FIX AT
  SOURCE, not built: give the stamp DfsReplay's resolution ladder and fall back to pit_stops.
  UNRESOLVED BY DESIGN: trucks NH R18 - loop says Sutton #27 / Baldwin #2, the pit feed says #26 /
  #33. Sources disagree on the truck; needs an eyeball, not a merge rule. pitboard.md 2026-08-30.
- [RETRACTED 2026-08-22] The "practice duplicate/session-collision" loose end was MY OWN
  grouping error - I scanned practice_laps without race_number, and Phoenix-type tracks host two
  races a season under session_number 1. Same 60k rows: 204 collisions without race_number, 0
  with it. App always filtered correctly (Admin upload replace + both read pages). No bug, no
  action, audit SQL deleted. BACKTEST_LOG 2026-08-22 RETRACTION. Surviving result from that
  thread: single-lap gaps are real pit visits (90/90 timestamped), so parseStints' strict split
  is correct.
- corrHistory has never been swept at its post-8/20 effective share (33.7% → 37.2%; the startPos
  cut changed wTotal and renormalized every term). Sweep result stands, but 0.30 is the arm that
  restores the validated share — queue candidate behind the ownership overlay.
- [OWED TO FABLE] practice sheet page 1 renumbers laps (pit gaps invisible) while LAPS_RAW keeps
  original numbering. QA-only - DB, grader and the live Lap By Lap page are all correct (NH cup
  mean 2.75 runs/driver, zero single-run drivers) - but page 1 is the tab eyeballed before upload,
  so it is the one view that hides dropped laps and over-long runs. Fix in pitboard_practice_sheet.py:
  write page 1 on original lap numbers with blanks at gaps. pitboard.md 2026-08-23.
- ~~pit_crew_race bookmarklet RLS re-test~~ CLOSED MOOT 2026-08-31: pitcrewrank.com was abandoned
  once we could pull the telemetry ourselves. Table dropped, bookmarklet retired, CSV backup in the
  Handoff folder. PIT CREW IS LIVE AND CURRENT via `pit_stops` — weekly loader, `pitCrew: 0.06` in
  every sim weight set, PitCrewRankings reads it. Do not read the retired scrape as a data gap.
- Trucks Richmond practice never re-uploaded with timestamps — live truck card still uncorrected (cup wk2 check was run via harness instead).
- sim_matrices exists only for boards published after 2026-08-15 evening; older boards fall back to 4k sample in Matchup Compare.
- [SUPERSEDED 2026-08-30] The 'one thesis x7' failure is now handled by the objective, not by a cap: E[max] selects a SET, so it only duplicates a core where the draws say duplication pays. Default max exposure is back at 100% deliberately - see the handoff. The operator's own method (exclusions + per-driver caps + wide spread) still works on top and is what produced his 301.45 / rank 179 at Daytona.
- [DONE] New Hampshire week: v6.3 wk3 check + DFS replay both completed (the replay was later recomputed - see the handoff). Trucks R18 board accidentally published as 'post' 8/19 — retagged to 'pre' (board + 9 flags + sim_matrices); stage-guard confirm didn't stop it, consider defaulting stage selector to 'pre' when no practice exists.

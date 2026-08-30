> SESSION START: read PITBOARD_MANUAL.md + PITBOARD_STATE.md first. This file is append-only model
> evidence from 2026-08-03 onward (~44k tokens; earlier entries: BACKTEST_ARCHIVE.md, CLOSED).
> SEARCH it; do not read in full. CANARY: the FIRST entry below must be `## 2026-08-03`. If your
> copy shows July entries first, it is PRE-SPLIT and STALE — re-GET before any write.

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


<!-- ARCHIVE SPLIT 2026-08-24: entries before 2026-08-03 moved VERBATIM to BACKTEST_ARCHIVE.md
     (~86k tokens: the v1-v6.3 model builds, weight sweeps, market anchor, CLV/DK tracking ship
     notes, practice-edge closure, ARP/GFS/pass_diff saturation findings). SEARCH there for
     anything pre-August. This file continues the same append-only protocol from that point. -->

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

### DIALLING IN THE TAIL: IT IS THE SAME SELECTION BUG, NOT A SEPARATE DEFECT (2026-08-24)
Operator: "how do we dial in the tail?" Answer: it needs no special-case rule, because it is not a
separate problem. It is the winner's-curse selection effect at the point where relative disagreement
with the market is largest. One fix covers it and everything else.

FALSE START, RECORDED SO NOBODY REPEATS IT. I first hypothesised favourite-longshot bias in the VIG -
that books load overround onto longshots, so our EV calc (which uses raw implied, not de-vigged) would
manufacture fake edge worst at long prices. The test I wrote for it was CIRCULAR: proportional
de-vigging scales every driver by the same constant, so the "vig multiplier" it produced was fixed
within a race-market by construction, and the band differences were just composition. Discarded before
reporting. The valid test needs REALISED OUTCOMES, not a de-vigged number.

MARKET PRICE vs REALITY, whole field, last capture before each race, 9 races:
    band              n     market implied   actually hit   reality - price
    negative (fav)    89        62.90            59.55         -3.35
    +100-399         210        32.48            29.05         -3.43
    +400-999         171        14.34            10.53         -3.81
    +1000-1999       172         7.21             7.56         +0.35
    +2000 or longer  655         1.54             0.76         -0.77   (5 hits, 10.1 expected)
The steady -3 to -4 points in the short bands IS the vig, as expected. The real finding is the bottom
row: at +2000 and longer the market prices 1.54 pct where reality is 0.76 pct. In RELATIVE terms the
market is 2x too high there - so a genuine favourite-longshot bias does exist, just modest in absolute
points (n=655, 5 hits vs 10.1 expected, p about .05 - real but not overwhelming).

THE NUMBER THAT MATTERS. In that same band our model was flagging at 5.0 pct. So:
    reality 0.76 pct   |   market 1.54 pct (2x high)   |   PITBOARD 5.0 pct (6.6x high)
We are not finding value the market missed. We are wrong in the SAME DIRECTION as the vig and far
further. That is why the tail went 0-for-99: we were taking the worst side of an already-shaded price.

BUT IT IS NOT A MODEL CALIBRATION FAILURE, AND THIS IS THE KEY POINT. The board's own low-probability
buckets are FINE - win 0-5 pct band says 0.9 happens 0.6 (n=533); top-5 says 1.2 happens 1.0 (n=298).
The model's 5 pct drivers are not systematically 5 pct wrong. What fails is the SUBSET of the model's
5 pct drivers that the market prices at 1.5 pct - i.e. exactly where we most disagree. Same selection
mechanism as everywhere else, at its most violent because RELATIVE disagreement is largest when both
numbers are tiny (5 vs 1.5 is a 3.3x gap; no such gap is possible at 40 vs 30).
And the CLV evidence lines up precisely: measured lift by pre-market-probability stratum was
    <5 pct +0.31   |   5-15 pct +1.43   |   15-35 pct +2.78   |   35 pct+ +3.79
Our disagreement carries essentially NO information below 5 pct and increasing information above it.
We have independently measured where our opinion is worth something, on the complete population.

PROPOSED FIX - NOT BUILT, NEEDS OPERATOR APPROVAL. One mechanism, three parts:
1. DISAGREEMENT-SCALED SHRINK toward the de-vigged market before EV, in log-odds space:
   p_used = logistic( (1-lambda)*logit(p_model) + lambda*logit(p_market_devig) ), with lambda set from
   the MEASURED information-by-stratum ladder above rather than fitted to ROI: lambda near 1 (defer to
   market) below 5 pct, tapering to small at 35 pct+. The tail then collapses on its own - no separate
   longshot rule needed - and the 15-35 pct band, where we have demonstrated edge, is barely touched.
2. DE-VIG THE MARKET PRICE before computing edge at all. medge currently appears to be computed off
   RAW implied (Byron t10: sim 88.1, +125 = 44.4 raw, medge 44.25) which overstates every edge by the
   vig, ~3-4 points in the bands that matter. This is a straight defect, independent of everything else.
3. HARD BACKSTOP, dumb and immediate: no flag below 10 pct model probability, none at prices longer
   than +1000. Not a substitute for 1 and 2 - a floor under them in case they are mis-tuned.
JUDGED BY: the race-level CLV lift ledger, pre-registered at "holds above zero through 15-20 races."
NOT by in-sample ROI on these 9 races. Sanity-check the shrink against the 9 races to confirm it kills
the 0-for-99 group and spares the 15-35 pct band - but do NOT tune lambda there.

### RETRACTION: WE DO DE-VIG. THE REAL DEFECT IS THAT WE GATE ON ev INSTEAD OF medge (2026-08-24)
Operator: "I thought we were devigging the price?" We are. I claimed otherwise from a single row's
arithmetic and I was wrong. Reading the actual code:
    SimulationCenter.js:285
    dvg[bk][k] = s ? imp[k] / s * target : null
Each book's raw implied is summed across the field and rescaled to the market's TRUE total (1/3/5/10).
That is proportional de-vigging, per book - the identical method I used in my own CLV analysis today.
consP is then the LEAVE-ONE-OUT mean of the OTHER books' de-vigged probabilities (excluding the book we
would actually bet, added 2026-07-12 for exactly the right reason), and medge = (our p - consP)*100.
So medge is de-vigged AND sharp. My Byron "proof" was a coincidence: consP came to 43.85 against a raw
+125 implied of 44.44, and I read a 0.6-point near-miss as evidence of a missing de-vig. Proposal item
2 from the previous entry is RETRACTED in full.

THE ACTUAL DEFECT, AND THE CODE PREDICTED IT. Flagging gates on ev, not medge:
    GradeCenter.js:58/89   MIN_EDGE_BET = 10 ... if (m.ev == null || m.ev < MIN_EDGE_BET) return
    SimResults.js:442/443  MIN_EDGE_PUBLIC = 10 ... r.ev >= MIN_EDGE_PUBLIC && r.mev > 0
ev = our probability x the BEST RAW price. So it fires whenever ONE BOOK HANGS A LONG NUMBER, whether
or not we disagree with the sharp consensus at all. The comment sitting directly above the computation
(SimulationCenter.js:320-322) says it outright: medge "is the ONLY one of the three that isolates
model alpha. A model with zero edge still prints a fat ev whenever one book hangs a bad number."
We compute the right diagnostic, store it on every flag row, and then gate on the wrong one.

TWO INDEPENDENT MEASURES, SAME ANSWER. Graded flags by medge band:
    band            bets  hits  hit pct   ROI      units   mean odds
    medge <5         135    8     5.9    -57.1    -77.1     +1808
    medge 5-9.9       74   10    13.5    -31.8    -23.5      +713
    medge 10-19.9     50   22    44.0    +20.8    +10.4      +194
    medge 20-34.9     27   10    37.0    -37.1    -10.0        +49
    medge 35+          4    1    25.0    -43.8     -1.8       +110
And the same flags by subsequent PRE->POST line movement (better powered, complete population):
    medge <5      n=69  move +0.895  (35 toward us / 34 away - a coin flip)   odds +1599
    medge 5-9.9   n=34  move +1.320  (17 / 17)                                odds  +578
    medge 10-19.9 n=19  move +3.381  (12 / 7)                                 odds  +195
    medge 20+     n=9   move +1.979  (4 / 5)                                  odds   +99
    corr(medge, move) = +0.101      corr(ev, move) = -0.139      (n=131)
THE SIGN FLIP IS THE HEADLINE. Bigger medge predicts the line coming TOWARD us; bigger ev predicts it
moving AWAY. That is the flag sweep's EV ladder restated in a completely independent measurement, and
it is the mechanical consequence of ev rewarding a long raw price rather than a real disagreement.
medge<5 is 135 of 290 flags - nearly half the book - and carries -77 of the -102 units, 76 pct of the
entire loss. Those flags exist ONLY because one book hung a number; at mean odds +1599 they are
line-shop artifacts wearing a model's clothes.

REVISED PROPOSAL - ONE CHANGE, NOT THREE. Gate on medge. Not a shrink function, not a calibration
layer, not a new model: add a medge floor alongside the existing ev floor in the two gate sites above.
A floor of 5 is defensible on principle (below it, two independent measures say there is no model
content) and does not depend on picking the best-looking cell. A floor of 10 is the fitted sweet spot
and MUST NOT be adopted on this data - n=50 in one band out of five, chosen after looking. Pre-register
5, forward-test 10 alongside it.
The earlier proposal's item 1 (disagreement-scaled shrink) is now SECONDARY, not headline - medge
already IS the disagreement-against-sharp-consensus measure, so gating on it captures most of what the
shrink was for. Item 3 (hard backstop at 10 pct model prob / +1000) survives, but note it becomes
largely redundant: the medge<5 group has mean odds +1599 and would mostly be cut anyway.
JUDGED BY the race-level CLV lift ledger as before. Not by in-sample ROI on these 9 races.

METHOD LESSON, fifth operator catch in two days and the most expensive kind. I inferred a defect in
code I had not read, from one row of arithmetic that happened to land 0.6 points apart, and built a
three-part remediation plan on top of it. The correct move - READ THE FUNCTION - took one grep. Before
asserting that a system does not do X, open the file where X would live.

### EXPANDING THE medge FLOOR -> IT IS NOT THE FIRST MOVE. THE BETTER FILTER ALREADY SHIPS, TURNED OFF (2026-08-24)
Operator asked me to expand the medge-floor proposal before building anything. Doing the work changed
the recommendation, and turned up a framing error that runs through everything I said today.

FRAMING ERROR FIRST. The -35 pct ROI I have quoted all day is the DEFAULT SimResults view - every row
above MINP, green EV badge on anything with ev>=10. But SimResults.js:197 defines mvQual = false, and
line 443 applies a much tighter filter ONLY when the subscriber clicks "Qualified only":
ev>=10 AND mev>0 AND no favourite past -150. That toggle is OFF BY DEFAULT. So the product has two
very different lists and I have been scoring the loose one:
    1. GREEN BADGE (default)              276 bets   30.7/race   ROI -36.2   -99.8u
    2. + market agrees, mev>0 (the TOGGLE)  35 bets    3.9/race   ROI -11.4    -4.0u
    3. 2 + medge floor 5                    13 bets    1.4/race   ROI +15.4    +2.0u
    4. BADGE + medge floor 5, no mev       141 bets   15.7/race   ROI -16.1   -22.7u
The single largest improvement available is a DEFAULTS CHANGE to code that already exists and is
already correct. Requiring market agreement takes the list from -36.2 to -11.4 pct. Nobody has to
build anything; the green badge just has to stop appearing on rows the sharp consensus disagrees with.

THE medge FLOOR LADDER (all rows already pass ev>=10, so this is the conjunction):
    floor  kept  ROI     units   per race        floor  kept  ROI     units   per race
      0     287  -34.5   -99.0     31.9            6     134  -24.1   -32.3     14.9
      2     239  -23.8   -57.0     26.6            8     103   -9.5    -9.8     11.4
      3     211  -19.3   -40.8     23.4           10      81   -1.7    -1.4      9.0
      4     176  -19.8   -34.8     19.6           12      67  -12.2    -8.2      7.4
      5     155  -16.0   -24.9     17.2           15      51  -13.8    -7.1      5.7
NON-MONOTONIC - improves to 5, WORSENS at 6, improves to 10, worsens after. That wobble is the tell
that this curve is noise at 9 races with correlated within-race bets. NO floor makes the book
profitable; the best cell (-1.7 at floor 10) is fitted and flanked by -24.1 and -12.2. Do not adopt 10.

RELATIVE vs ABSOLUTE - a clean answer, and the only monotonic result here. Flooring on medge/consP
(relative disagreement) instead of medge (points) gets steadily WORSE: ratio 0 -34.5, 0.25 -34.0,
0.5 -39.2, 0.75 -70.6, 1.0 -63.1, 1.5 and 2.0 both -100 pct. Winner's curse again - relative
disagreement is largest exactly where we are most wrong. USE ABSOLUTE POINTS, NOT A RATIO. Settled.

BY MARKET, the floor's benefit is uneven: t10 mean medge 12.5, already +1.7 pct, does not need it.
t3 -50.6 -> -16.2 (cuts -34.5u of losers, the big win). win -65.8 -> -41.7 (cuts -32.0u, still awful;
win's mean medge is only 4.4, so a floor of 5 removes 42 of 60 win flags). t5 -24.3 -> -24.0, i.e. NO
HELP AT ALL. A per-market floor is the obvious next thought and is exactly the kind of tuning 9 races
cannot support - flat floor now, revisit at 20+.

WHAT THE FLOOR ACTUALLY CUTS, in one row: Jeremy Clements t3, our model 5.2 pct, sharp consensus
1.1 pct, medge 4.15 points, price +7500, EV +295 pct. Finished 30th. The +295 comes from the price,
not from a real disagreement. That is the artifact in a single line.
WHAT IT COSTS, honestly: floor 5 cuts 8 of the 51 winners, and they are mostly SHORT prices where a
small medge was still correct - Honeycutt WON the trucks R17 race at +900 with medge 3.59; Friesen t5
twice at +750/+900; Briscoe t5 at +155 with medge 4.61, finished 2nd. Real winners, genuinely skipped.

REVISED RECOMMENDATION, in order:
1. MAKE MARKET AGREEMENT THE DEFAULT. Either default mvQual to true, or - better - require mev>0 for
   the green badge itself at SimResults.js:479 so the visual "bet this" signal cannot fire on a row the
   sharp books disagree with. Biggest measured effect of anything on this page, zero new code.
2. SURFACE medge on the flag rows. It is computed and stored and never shown in the badge path. The
   operator cannot see the number that separates model alpha from line-shopping.
3. DO NOT PICK A medge FLOOR YET. At 35 bets the qualified list is indistinguishable from zero OR from
   -30 pct, and the choice between "3.9 tight plays a race" (option 2) and "15.7 medium plays a race"
   (option 4) is a PRODUCT SHAPE decision the operator should make, not a number I should fit. The
   Speedgeeks 5-star framing points at option 2/3; the research log wants option 4. Run both as parallel
   ledgers for 15-20 races and let the data choose.
METHOD NOTE, sixth catch of the day and this one was mine to find: I scored a product for a full day
without checking which list the product actually shows by default. Before measuring a system's output,
confirm which output the user sees.

### LAP RAPTOR ADVANCED STATS: WHAT THEY ACTUALLY ARE, AND A WEAKER CASE THAN I PITCHED (2026-08-24)
I proposed cPOMS/LSP/SS ingestion as "the first candidate in months that isn't structurally guaranteed
to be redundant," on the strength of the phrase "speed stats" in a handoff note. Operator asked me to
expand. I went and read the source first. The case is real but NARROWER than I sold it.

WHAT LSP ACTUALLY IS (verified, blog.lapraptor.com). Lap Speed Percentile scores every eligible
green-flag lap 0 to 1 by comparing its speed to the other cars' speeds ON THE SAME LAP NUMBER.
Cautions, pit stops and anomalous laps excluded. Percentile rather than raw speed because raw speed
is not comparable across venues (Daytona ~200mph vs Martinsville ~90mph). Same family: RSP (Restart
Speed Percentile, same construction applied to restart speeds).
WHAT cPOMS AND SS ARE: UNKNOWN. Not publicly defined anywhere I could find. Lap Raptor says only that
cPOMS is "theoretically superior" to LSP because it better rewards frontrunners who gap the field, and
that LSP has larger ranges. Also undefined: GR, LR, GR-LR on the same advanced report. Do NOT plan
around metrics whose definitions we do not have.

WHY MY ORIGINAL PITCH WAS TOO STRONG. The log ALREADY killed a green-flag-speed metric. 2026-07-07:
GFS alone per-race Spearman vs finish 0.460 train / 0.445 test, WORSE than rating alone (0.479/0.472);
partial correlation after residualising both GFS and finish on rating+startPos came out +0.0397 train
and -0.0451 test - SIGN FLIP, declared noise. The stated reason: "race-pace rank tracks running
position (clean air), so historical GFS re-encodes rating." LSP is a green-flag speed metric. That
objection applies to it too, and per-lap percentiling does NOT remove clean air - it removes fuel
load, tyre age and track condition, which are COMMON to the whole field on that lap. The car in clean
air still posts the fast lap. So LSP is not obviously orthogonal to driver_rating, and I implied it was.

THE ARGUMENT THAT SURVIVES, AND IT IS A GOOD ONE. There are two possible reasons GFS failed:
  (a) speed is genuinely redundant with driver_rating - the log's stated conclusion; or
  (b) GFS MEASURED SPEED BADLY and the null was a measurement failure.
We have direct evidence for (b), from the operator, in this same log. 2026-07-26, Landen Lewis ranked
2nd in GFS at Trucks IRP off 135 of 200 laps having started 20th and run in traffic - "my first two
tests were wrong," and a 90 pct partial-run rule had to be shipped. GFS averages raw green-flag laps,
so WHO you are on track with and WHEN you exit distorts it. LSP scores each lap against the field on
that same lap, which is precisely the defect that case exposed. GFS is a crude estimator of the thing
LSP measures properly.
So the question is NOT "is speed orthogonal to rating" (answered: probably not). It is "did GFS fail
because speed is redundant, or because GFS was a bad thermometer?" Those are distinguishable and the
test already exists.

THE GATE IS PRE-REGISTERED BY PRECEDENT, which is the best feature of this whole idea. Run LSP through
the IDENTICAL 2026-07-07 structure that GFS failed: residualise both LSP and finish on rating+startPos,
correlate the leftovers, train 2022-2024 / test 2025-2026. Sign flip across splits = noise = stop and
log it. I cannot tune that gate because I did not design it and GFS already ran it.

HEADROOM, from today's own numbers. Board->pace is 0.61 in cup while pace->finish is 0.83-0.87, so
pace PREDICTION is the binding constraint. Ceiling is bounded though: perfect pace foresight only
reaches rho 0.760 to finish across 434 archive races, and we sit near 0.47. Room exists; whether it is
reachable from history is exactly what the saturation finding says it is not.

COST, STATED HONESTLY. Advanced-report ingestion needs loop_data columns plus a paste section
(pitboard.md 2026-07-26 already queued it), AND a historical backfill - LSP for past races at
correlated tracks - or there is nothing to train on. Lap Raptor has seasons back to 2017, so the data
exists, but pasting it race by race is real operator labour. That backfill is the expensive part and it
happens BEFORE we learn whether the signal is worth anything.
MORE INTERESTING THAN LSP, IF THEY ARE WHAT THEY MIGHT BE: GR / LR / GR-LR. If those are green-run
and long-run splits, that is a RACE-derived version of shortRunPace / longRunPace / tireFalloff, which
we currently estimate from a single practice session. Historical run-length behaviour at correlated
tracks would be a genuinely different input rather than another driver-strength proxy. UNVERIFIED -
find out what they mean before costing any of this.
OPEN QUESTION FOR THE OPERATOR: pitboard.md 2026-07-26 says new-format rows store driver_rating NULL
because Lap Raptor dropped it site-wide. But loop_data has driver_rating populated 36/36 through cup
NH R25. Either the old-format parser still matches, or it is coming from elsewhere. Worth knowing,
because "our biggest weight term's input is drying up" would change the priority of all of this, and
right now it does not appear to be drying up.
BOTTOM LINE: worth ONE gated test, not a project. And it is a multi-weekend bet with a coin-flip prior,
against a defaults change (2026-08-24 entry above) that is measured, free and available today.

### cPOMS IS THE ONE THAT MATTERS, AND WE ARE ALREADY THROWING IT AWAY (2026-08-24)
Operator supplied the definitions I could not find published. They change the assessment I wrote an
hour ago, and they flip which column is worth having.
    ARP    average running position
    cPOMS  CONTINUOUSLY GRADED POMS - like rPOMS but instead of dividing by the fastest lap of the
           RACE, it divides by the fastest lap AT THAT LAP NUMBER. Scoring a driver's lap 30, the
           denominator is the fastest lap-30 speed anyone ran.
    LSP    average PERCENTILE RANK of each eligible lap speed among same-lap-number speeds, 0 to 1
    P50/P95  median and 95th-percentile lap time (and speed)

THE DISTINCTION THAT MATTERS, AND IT IS NOT THE ONE I DREW. Both cPOMS and LSP normalise per lap
number, so both fix the GFS measurement defect (fuel load, tyre age, track state, partial runs - the
Landen Lewis case). But:
    cPOMS IS A RATIO. It preserves MAGNITUDE. Leading by a nose scores differently from leading by a
      second.
    LSP IS A RANK. It discards magnitude. Both of those are just "first."
And here is the point: EVERY INPUT THE MODEL CURRENTLY USES IS ORDINAL. ARP is position. driver_rating
is built largely from ARP. Finish is position. LSP is a rank. GFS was raw speed but unnormalised,
which is why it broke. cPOMS is the ONLY metric in this family that measures MARGIN.
RANK METRICS SATURATE AT THE FRONT. Once you are leading you are P1 and the measurement stops carrying
information - it cannot distinguish a car that is dominant from a car that merely got track position.
cPOMS keeps measuring. And the front of the field is EXACTLY where this product is weakest: cup
favourites over-confident (20.8 pct stated, 8.3 pct realised), the win market the worst of the four,
board->pace only 0.61 in cup. The place where ordinal data carries least information is the place our
board fails. That is a far better orthogonality argument than the "speed not position" one I made,
which I then correctly undercut with the clean-air objection.
CLEAN AIR STILL APPLIES, but it degrades gracefully rather than catastrophically: clean air is worth
some bounded fraction of a percent, which cPOMS records as a small ratio difference, whereas in a rank
metric clean air can flip a car from 5th-fastest to 1st - full saturation from a small real effect.
SO: IF WE INGEST ONE COLUMN, IT IS cPOMS, NOT LSP. I had that backwards, purely because LSP was the
one with a published definition. LSP is a rank metric and the 2026-07-07 saturation finding already
closed the rank-metric family.

THE PART THAT CHANGES THE COST STORY COMPLETELY. I told the operator the historical backfill was the
expensive part and happened before we learn anything. That is wrong for future races. Admin.js:1529:
    const RE = /^(.+?)\s+(?:Number\s+)?(\d{1,3})\s+(?:(?:Chevy|...)\s+)?(\d+)\s+(\d+)\s+(\w+)\s+
               (?:[\d.]+\s+){1,3}(\d+)\s+([\d.]+)\s+[\d.]+\s+[\d.]+\s+([\d.]+)/gm
(?:[\d.]+\s+){1,3} is a NON-CAPTURING group that swallows ARP, cPOMS and LSP. The \s+[\d.]+\s+[\d.]+
before the last capture swallows P50 and P95. Every Lap Performance paste the operator ALREADY MAKES,
every race, contains all five - matched by the regex, and deliberately discarded. fastest_laps stores
only fastest_lap_num, fastest_time, fastest_speed.
We keep the EXTREMES (one outlier lap on optimal conditions) and throw away the MEDIAN. For estimating
race pace that is backwards.

REVISED PLAN, and step 1 is not a model change at all:
1. STOP DISCARDING. Add capture groups for ARP, cPOMS, LSP, P50, P95 and columns on fastest_laps.
   ZERO extra operator work per race - the data is already in the clipboard. This is data collection,
   not modelling, and it is the prerequisite for every other step. Do it before anything else.
2. BACKFILL what is feasible. He has already pasted 2022-2025 once, so this is known labour, not
   unknown - but it is still labour and it can wait behind step 1.
3. THE GATED TEST, unchanged in structure: the identical 2026-07-07 partial-correlation gate GFS
   failed - residualise cPOMS and finish on rating+startPos, train 2022-24 / test 2025-26, sign flip
   across splits = noise = stop. Test cPOMS. Do not bother testing LSP first.
4. FREE BONUS, needs no backfill: cPOMS is a better EVALUATION TARGET than ARP. This morning's
   board-reads-pace analysis was retracted because ARP sits inside driver_rating, making the yardstick
   circular. cPOMS is NOT inside driver_rating. The same question can be asked honestly with it.
CREDIT WHERE DUE: I could not find these definitions published anywhere and would have ingested the
wrong column. Fourth time today operator domain knowledge changed a conclusion.

### HEAD TO HEAD vs AN OUTSIDE MODEL - NEW HAMPSHIRE CUP R25 (2026-08-24)
Operator shared a friend's public value report for the Dollar Tree 301 (josephsrigley.com, dated
2026-08-21). n=1 RACE - this is an anecdote, not a test, and it is logged as a lead only. Also
NOTE A LIMITATION: the fetched text did not cleanly separate his model's own probabilities from the
quoted market odds, so this compares NAMES AND CALLS, not probability against probability.
TIMING: his report is 08-21 and he states he waits for practice and qualifying before finalising, so
it is PRE-PRACTICE - comparable to our PRE board (published 08-20 03:54), not our post (08-23 17:25).

                    FIN   HIS CALL                        OUR PRE BOARD        OUR PRE FLAGS
  Ryan Blaney         1    value: win +357/T3-104/T5-229   19.6 pct win, OUR #1  win, t3, t5 all flagged
  Joey Logano        14    value: win/T3/T5                10.7 win / 70.0 t10   none
  William Byron      30    PRIMARY BET T10 +100, 0.25u      4.7 win / 55.8 t10   t10 flagged at -110
  Chase Elliott      25    pivot: T10 +100                  3.9 win / 48.8 t10   none (just under 50)
  Carson Hocevar     19    "insufficient value" - PASSED    1.9 win / 37.4 t10   t10 ev+57, t3 +66, t5 +56

1. BOTH MODELS HAD BLANEY AND HE WON. He listed Blaney first. Our pre board had him at the very top,
   19.6 pct win, and we flagged win/t3/t5. Strongest agreement of the day and both right.
2. HE BEAT US ON PRICE ON THE ONE PLAY WE BOTH LIKED. Byron top-10: he got +100, our best available
   was -110 (Hard Rock). Same play, same side; his price needs 50.0 pct to break even and ours needs
   52.4. We logged it at ev+7; at his number it is ev+12. Pure line shopping, and he won that
   exchange. Both lost anyway - Byron led 26 laps, ran as high as P1, and lost a wheel (finished 30th
   off ARP 15). Neither model was wrong about the car.
3. HOCEVAR IS WHERE HE CLEARLY BEAT US, AND IT IS DIAGNOSTIC. He looked at Hocevar and said
   insufficient value at current prices. We flagged him in THREE markets - t10 ev+57, t3 ev+66, t5
   ev+56 - the largest single-driver block on our pre slate. Hocevar finished 19th, led 0 laps, ARP
   21st. THE TELL: our OWN post board collapsed him from 37.4 pct t10 to 13.5 pct once practice and
   the real grid landed (he started 22nd, not the 3rd our pre grid assumed). His pre-practice read
   matched our POST-practice read. He got there a day earlier without the practice data.
4. THE EXPOSURE GAP IS THE WHOLE ARGUMENT IN ONE RACE. His slate: ONE 0.25-unit bet plus a named
   pivot. Our slate: 23 flags, 5 hits, -8.56 units, -37.2 pct ROI. Both had a losing New Hampshire.
   He lost a quarter of a unit; we lost 8.56. That is NOT a model-quality difference - it is a
   SELECTION AND STAKING difference, which is exactly what the flag sweep concluded and exactly what
   the operator meant by the Speedgeeks 5-star framing. 10 of our 23 pre flags carried medge < 5,
   the band that went 0-for-72 season-wide.
5. THE MOST IMPORTANT SENTENCE IN HIS WRITEUP, for us: "The model predicts SPEED rather than FINISHING
   POSITION," off "15 proprietary metrics straight from lap-by-lap data." That is the cPOMS
   conversation arriving from outside. Our board predicts finishing position from ORDINAL inputs (ARP,
   driver_rating which is built from ARP, start position). Today's own chain decomposition said the
   binding constraint is PREDICTING pace (board->pace 0.61 in cup) and NOT converting it (pace->finish
   0.83-0.87). An independent practitioner has built toward the thing our own data points at. That is
   weak evidence - one person's design choice - but it is INDEPENDENT weak evidence, and it lands on
   the same square as the cPOMS argument and today's decomposition.
6. HE SIZES AT 0.25 UNITS. We have no staking layer at all (queue item 6, ¼-Kelly display, unbuilt).

TAKEAWAY, kept deliberately small because n=1: nothing here is evidence our model is worse. On the
race's biggest question - who wins - we were at least as right as he was, and our post board caught
the Hocevar collapse he called a day early. What this race illustrates is the two gaps we already
measured today: WE BET TOO MANY THINGS (23 vs 1) and WE DO NOT SHOP PRICE (+100 vs -110 on an
identical play). Both are fixable without touching the model.

### CORRECTION TO MY OWN LANGUAGE: THE FLAG RECORD IS A PAPER RECORD (2026-08-24)
Operator: "I didn't lose anything because I don't bet everything the model flags - as far as I'm
concerned this is all just hypothetical data logging until we get this thing more dialed in."
Correct, and I have been writing it wrong all day. Every "-102 units", "-8.56 units", "ROI -35.2 pct"
in today's entries is a PAPER RECORD computed by staking 1 flat unit on every flag. Nothing was
staked. The flag log is a research instrument, not a bet slip. The numbers are still the right way to
evaluate the FLAGGING RULE - that is what a backtest is - but they are not losses, and no entry above
should be read as money lost. Read them as "what the rule would have produced if bet blindly," which
is precisely the thing the operator has correctly declined to do.

### AN OUTSIDE CLAIM CHECKED: "PREDICTION FINISHER NUMBER 1 IS NOW 50 PCT ON THE SEASON" (2026-08-24)
Operator shared a HighLine Betting (@HighLineBetting) post-New-Hampshire claim. Their table, through
21 cup races: winner was their #1 pick 10 times (47.62 pct), top-2 12 (57.14), top-3 14 (66.67),
top-4 15 (71.43), top-5 18 (85.71), outside top-5 3 (14.29). Xfinity 19 races: #1 5 (26.32), top-5
15 (78.95). Trucks 15 races: #1 3 (20.00), top-5 10 (66.67). With Blaney that is 11 of 22 = 50 pct.

MY FIRST INSTINCT WAS WRONG AND I CHECKED BEFORE SAYING IT. I assumed ~48 pct was implausible because
cup favourites win maybe 15-20 pct, and I was ready to call the cross-series pattern a red flag on the
grounds that cup should be the HARDEST series to predict. Both assumptions failed against 2026 data:
    2026 POLE SITTER WIN RATE (the dumbest available benchmark, full season, our loop_data):
      cup     9 of 25 = 36.0 pct        oreilly 3 of 23 = 13.0 pct      trucks 4 of 18 = 22.2 pct
    2026 WINNER CONCENTRATION: cup 11 distinct winners in 25 races, one driver took 5 (20 pct).
So 2026 cup has been an unusually front-runner-dominant, concentrated season. Against a 36 pct pole
baseline, 47.6 pct is about 1.3x the naive benchmark - not 3x. And their cross-series ORDERING tracks
this season's actual difficulty: their edge over the pole baseline is cup +11.6, xfinity +13.3,
trucks -2.2. My "cup should be hardest" prior was a general belief about series parity, not a fact
about this season. Checking it saved a seventh error, and an unfair one aimed at someone else's work.

OUR COMPARABLE NUMBER, same metric, post boards, n FAR too small to compare:
    ALL 9 RACES   winner was our #1 in 4 (44.4 pct), top-3 4 (44.4), top-5 7 (77.8)
    CUP ONLY (4)  winner was our #1 in 1 (25.0 pct), top-5 3 (75.0)
Same neighbourhood on top-5, but 9 races against their 21 and our set is simply "the races we have
boards for." No conclusion available. Recorded so the number exists when the sample grows.

THE PART THAT ACTUALLY MATTERS, AND IT IS NOT THE HIT RATE. This metric is SILENT ON PRICE. "How
often was the winner our #1" measures DISCRIMINATION - can you sort the field - and says nothing about
whether the market already knew. Two observations follow:
1. Taken at face value the claim implies an enormous profit. Cup favourites go off around +350 to
   +600. Betting a pick that wins 47.6 pct at even +350 returns about +114 pct ROI. Nobody in this
   sport has that. So either the pick is far shorter than the field's favourite, or the hit rate does
   not survive contact with the prices, or 22 races is running hot. All three are ordinary; none of
   them require anyone to be wrong or dishonest. It is simply not a claim about money.
2. IT IS AN ORDERING METRIC - which is the exact metric OUR model looks BEST on. Today established
   the post board improves the winner's rank in 9 of 9 races (p=.008) while the betting overlay shows
   no proven edge. If we published a "winner was our #1 44 pct of the time" graphic it would be true,
   flattering, and would not establish that the product makes a dollar. Same applies to theirs.
GENUINE LEAD, unrelated to the claim: pole sitters won 36 pct of 2026 cup races. If that is not what
they were priced at, that is a market inefficiency worth measuring. We only hold odds for 5 cup races
(21-25) so it cannot be tested here - but it is a cheap question the moment the odds archive is deeper,
and it is a far more interesting number than anyone's hit-rate graphic.

### CORRECTION: I READ THE HIGHLINE TABLE WRONG, AND THE INTERESTING ROW IS NOT THE ONE I ANALYSED (2026-08-24)
Operator: "his model's number one projected driver has won the race 50 pct of the time." Correct. I
read the table as "how deep on their board did the WINNER sit" (cumulative, winner-found-by-rank-N).
It is the other way round: WHERE DID THEIR #1 PROJECTED DRIVER FINISH. Both readings are
arithmetically consistent (top-5 18 + other 3 = 21) and the FIRST ROW IS IDENTICAL EITHER WAY - "their
#1 won" and "the winner was their #1" are the same event - so the 47.6 pct analysis in the entry above
stands unchanged. What I got wrong is rows 2 through 6, and that is where the actual signal lives.

RE-DONE PROPERLY. Their #1 projected driver's finishing distribution, 21 cup races:
    1st 10 (47.6)  top-2 12 (57.1)  top-3 14 (66.7)  top-4 15 (71.4)  top-5 18 (85.7)  other 3 (14.3)
THE NAIVE BENCHMARK on the same metric - where did the POLE SITTER finish, full 2026 season, our
loop_data. This is the fairest "dumbest possible #1 pick" comparison:
    cup     25 races  1st 36.0  top-3 56.0  top-5 64.0  outside-5 36.0  MEAN FINISH 7.0
    oreilly 23 races  1st 13.0  top-3 17.4  top-5 21.7  outside-5 78.3  MEAN FINISH 14.7
    trucks  18 races  1st 22.2  top-3 27.8  top-5 50.0  outside-5 50.0  MEAN FINISH 11.5
OURS, post boards, n=9 races (10 rows on the win-pct cut - cup NH had Blaney and Bell TIED at 18.8):
    #1 by WIN PCT       1st 4 (40.0)  top-3 5 (50.0)  top-5 9 (90.0)  outside 1  MEAN FINISH 3.7
    #1 by PROJ FINISH   1st 3 (33.3)  top-3 4 (44.4)  top-5 8 (88.9)  outside 1  MEAN FINISH 4.0

THE REFRAME THAT MATTERS. The WIN row is the LEAST informative row in the table and it is the one
everybody quotes, including me an hour ago. Compare the gaps over the pole baseline:
    WIN RATE   HighLine 47.6 vs pole 36.0  = +11.6
    TOP-5 RATE HighLine 85.7 vs pole 64.0  = +21.7
The top-5 row separates a model from the naive pick almost TWICE as decisively as the win row.
Winning is dominated by variance the model cannot see - caution timing, fuel, a restart, a wheel
coming off a car running fifth. Finishing top-5 is where a model demonstrates it identified the fast
car. This is the same thing today's chain decomposition said in different clothes: pace->finish is
0.83-0.87, so even a perfect pace read loses a chunk of finishing accuracy to luck, and the WIN
market is where that loss is worst.
Note their own table shows the pattern plainly: their #1 is top-5 85.7 pct of the time but wins 47.6
pct. The gap between those two numbers IS the conversion noise. It is not a flaw in their model, it
is the sport.
OUR NUMBERS SIT IN THE SAME NEIGHBOURHOOD - top-5 88.9-90 pct, mean finish 3.7-4.0 against the cup
pole benchmark's 64.0 pct and 7.0. But n=9 mixed-series vs their n=21 cup-only, and our races are
simply the ones we have boards for. NOT A COMPARISON. Recorded so the number exists when the sample
grows, and because MEAN FINISH OF THE #1 PICK is a better single-number scorecard than any hit rate -
it uses the whole result instead of a threshold, and it is not silent on how badly you miss.
STILL TRUE FROM THE ENTRY ABOVE: none of these metrics say anything about PRICE. A model can top this
table and still have no betting edge if the market already knows.

### SAMPLE SIZE, THIRD CATCH: IT WAS NEVER 9 RACES. sim_grades HOLDS 16 (2026-08-24)
Operator: "Are you sure we only have 9 boards?" No. I checked sim_results (18 rows, 9 races, 07-24 to
08-23 - the pre-07-24 boards really were lost) and stopped there. sim_grades is a SEPARATE table that
SURVIVED that erasure: 30 graded boards across 16 RACES back to 2026-07-06. Seven races I never
touched: cup 19 Chicagoland, ore 20 Chicagoland, trk 14 Lime Rock, ore 21 Atlanta, cup 20 Atlanta,
trk 15 North Wilkesboro, cup 21 North Wilkesboro.
This is the THIRD sample-size catch by the operator in two days, and I logged the lesson MYSELF this
morning - "count the available races FIRST and state n in the same sentence as the claim." I counted
one table and called it the sample.

WHAT EXTENDS AND WHAT DOES NOT. The jsonb columns decide it:
  actual   = {car_number, finish} ONLY. The per-driver board (win/t3/t5/t10 pct, proj finish) is
             genuinely gone, confirming pitboard.md 1617. So BOARD CALIBRATION BY BAND, WINNER-RANK,
             and the #1-PICK FINISH DISTRIBUTION all STAY AT 9 RACES. Cannot be extended.
  metrics  = {win_brier, top3_brier, top5_brier, top10_brier, spearman_pf, mae, clv, dk, prec, n}
             per board -> THE PRE/POST SWEEP EXTENDS TO 14 PAIRED RACES.
  ev_flags = {driver, market, price, book, ev, mev, hit} -> THE FLAG SWEEP EXTENDS TO 377 FLAGS over
             15-16 races. But NO medge and NO sim_prob, so the medge/tail analysis STAYS at 290
             flags / 9 races.

PRE/POST RE-RUN AT 14 PAIRED RACES (was 9). Direction unchanged, ORDERING evidence strengthens:
    win     post 8 / pre 6    mean -0.00115   t=-1.24
    top3    post 11 / pre 3   mean -0.00206   t=-1.50
    top5    post 9 / pre 5    mean -0.00391   t=-1.29
    top10   post 9 / pre 5    mean -0.00171   t=-0.37
    MAE     post 10 / pre 3   mean -0.227 positions   t=-1.84
    SPEARMAN post 10 / pre 4  mean +0.0231    t=2.07   <- nominally significant
So at 14 races the four BRIER markets remain non-significant exactly as at 9, while FULL-FIELD
ORDERING crosses into nominal significance and MAE approaches it. That is the same conclusion the
9-race sweep reached - post is better ORDERED, not better calibrated - now on a bigger sample with
the ordering half strengthened rather than weakened. CAVEAT: these metrics were computed by
GradeCenter at grading time under its own conventions, NOT by me. Do not splice them with my own
numbers in one table; compare directionally only.

FLAG SWEEP AT 377 FLAGS (was 290). Total: 61 hits, 16.2 pct, ROI -31.5 pct, -118.7 paper units
(PAPER - nothing staked, see the correction entry above). THE EV INVERSION HOLDS AND SHARPENS:
    ev 10-24   175 flags   26.9 pct hit   ROI  -4.7   <- near break-even
    ev 25-49   100 flags    8.0 pct hit   ROI -69.3
    ev 50-99    71 flags    4.2 pct hit   ROI -60.9
    ev 100+     31 flags    9.7 pct hit   ROI  +6.8   <- longshot band, n=31, was -11.8 at 9 races. NOISE.
The monotonic collapse across the first three bands is now on 346 flags instead of 273. The lowest-EV
flags are nearly break-even; everything claiming 25-99 pct EV is a disaster. Unchanged conclusion,
much firmer footing.

THE mev>0 FILTER - AND THE CHECK THAT STOPS ME CELEBRATING IT.
    mev <= 0   313 flags   ROI -41.8   -130.8 units
    mev >  0    64 flags   ROI +18.9   +12.1 units   4.0 per race
At 9 races this filter was -11.4 pct on 35 bets. At 16 races it is POSITIVE on 64. That looked like
the story of the day for about ninety seconds. Then: 11 races carry qualified flags, 5 POSITIVE and
6 NEGATIVE, best race +14.1 units, and EXCLUDING THAT ONE RACE THE SET IS -2.0 UNITS. The entire
positive ROI is a single race. This is exactly the finding I would have shipped an hour ago.
HONEST STATEMENT: the mev>0 filter reliably REMOVES THE BLEEDING (-41.8 pct to roughly break-even
ex-outlier) and is NOT demonstrated profitable. 5-6 on races is a coin flip.

NET EFFECT ON THE RECOMMENDATIONS. #1 (make market agreement the default / require mev>0 for the green
badge) is STRENGTHENED - it is still the only cut that stops the bleeding, now measured on 64 flags
across 11 races instead of 35 across 9, and it is still zero new code. But "+18.9 pct ROI" MUST NOT be
quoted as evidence of profit; quote "-41.8 to break-even" instead. Everything else in the priority
list is unchanged. The medge floor still cannot be evaluated beyond 9 races because ev_flags does not
carry medge - which is itself an argument for recommendation #3, surfacing and STORING medge.

### OUR #1 PROJECTION, EVERY RACE WE HAVE, BY SERIES (2026-08-24)
Operator asked how our number-one projected driver has actually done, as far back as the data goes.
It goes back to 2026-07-06 via sim_grades.metrics.prec - 16 post boards and 14 pre. GradeCenter.js:55
defines it exactly: prec('win',1) sorts the field by WIN PROBABILITY, takes the top driver, and checks
whether he finished 1st. Same question HighLine's first row answers. (Their rows 2-6 are one driver's
finish distribution; our prec.t3/t5/t10 are SET OVERLAP - how many of our top N finished top N - so
only the WIN row is directly comparable between us.)

POST BOARDS - our final prediction, 16 races:
    ALL       16 races   #1 WON 4   25.0 pct    prec5 2.44/5 (48.8)   prec10 5.63/10 (56.3)
    cup        7 races   #1 WON 1   14.3 pct    prec5 2.14/5 (42.9)
    oreilly    4 races   #1 WON 0    0.0 pct    prec5 2.50/5 (50.0)
    trucks     5 races   #1 WON 3   60.0 pct    prec5 2.80/5 (56.0)
PRE BOARDS, 14 races: ALL 1 of 14 (7.1 pct); cup 1 of 6 (16.7); oreilly 0 of 3; trucks 0 of 5.
POST BEATS PRE BY A MILE ON THIS METRIC - 25.0 vs 7.1 pct - which is the same story as the pre/post
sweep, in the bluntest possible form.

THE BENCHMARK, ON THE SAME 16 RACES (pole sitter - the dumbest possible "#1 pick"):
    ALL   3 of 16 = 18.8 pct   |  cup 1 of 7 = 14.3  |  oreilly 0 of 4 = 0.0  |  trucks 2 of 5 = 40.0
So against the naive pick on identical races we are +6.2 points overall - AND DEAD EVEN IN CUP
(14.3 vs 14.3) AND DEAD EVEN IN XFINITY (0 vs 0). THE ENTIRE EDGE IS TRUCKS, 60 vs 40, ON FIVE RACES.

WHICH FOUR RACES WE ACTUALLY WON: cup NH R25 (Blaney), and trucks R16, R17, R18 - THREE CONSECUTIVE
TRUCK RACES AT THE END OF THE SAMPLE. That is the same hot streak flagged this morning in the pre/post
sweep ("trucks' Brier edge is 3-for-3 favourite luck at ~25 pct each"). It is one streak, counted twice
in two different analyses, and it is carrying the headline number in both. Do not treat 60 pct as a
truck capability.

ON COMPARING THIS TO HIGHLINE'S 47.6 PCT CUP NUMBER - IT IS NOT APPLES TO APPLES, IN BOTH DIRECTIONS.
Our 7 cup races are a stretch in which the POLE SITTER ALSO WON ONLY 1 OF 7 (14.3 pct) against 9 of 25
(36.0 pct) season-wide. We happened to cover a low-front-runner stretch of the season; their 21 races
span more of it, including the front-runner-heavy portion. Our cup #1 matched the benchmark on our own
races EXACTLY. That is neither a defence nor a boast - it is the only honest way to read 7 races.

THE STEADIER NUMBER IS PRECISION AT 5: 2.44 of 5 (48.8 pct) on post boards, range 1 to 4 per race, and
far less streak-dependent than the win row - cup 2.14, xfinity 2.50, trucks 2.80. Post MAE runs 4.49
(ore Indy) to 10.46 (ore Atlanta). If we ever publish a scorecard, publish precision-at-5 and mean
finish, not the win row. The win row is the one everybody quotes and the one most dominated by luck -
today's chain decomposition (pace->finish 0.83-0.87) is the reason why.
CAVEATS: 16 races, 7/4/5 by series. Trucks 3-of-5 is one streak; xfinity 0-of-4 is one cold patch.
Neither means anything yet. These metrics were computed by GradeCenter at grading time, not by me.

### THE POLE-SITTER BENCHMARK WAS A BAD CHOICE. IT IS INSIDE OUR OWN MODEL (2026-08-24)
Operator: "Why are you so infatuated with the pole sitter?" Because it was the only zero-model #1 pick
available for the full 2026 season in our data, and I never asked the one question I had already
learned to ask today. THE POLE SITTER IS AN INPUT TO OUR SIM. DEFAULT_WEIGHTS.startPos is 0.23, and
0.33 under TRUCK_SHORT_WEIGHTS. Our #1 pick is PARTLY MADE OF the pole sitter, so "we beat the pole
sitter by 6.2 points" measures what the rest of the sim adds over ONE OF ITS OWN TERMS. That is not an
outside benchmark. It is a milder replay of the ARP circularity retracted this morning, and it is the
FOURTH time today I adopted a yardstick without checking it against the model's input list.
Two further problems, independent of the circularity: (1) the pole is not known until qualifying, so
it is not even available at PRE-board time; (2) 2026 is an outlier season for it - cup poles won 36
pct - which inflates the baseline and understates any model measured against it.
DISCOUNT the pole comparisons in the two entries above accordingly.

THE RIGHT BENCHMARK IS THE MARKET FAVOURITE - the free pick any bettor gets by looking at a price, and
genuinely independent of our model. I used pole only because our odds archive is thin. It covers 10 of
the 16 graded races. Market favourite = shortest win price at the last capture before each race:
    cup R21 Bell 19th | R22 Hamlin 5th | R23 Blaney 3rd | R24 Blaney 13th | R25 Blaney 1st
    ore R22 Allgaier 2nd | R23 Allgaier 24th
    trk R16 Riggs 1st | R17 Majeski 19th | R18 Riggs 1st
                        MARKET FAVOURITE      OUR POST #1
    ALL 10 races        3 of 10 = 30.0 pct    4 of 10 = 40.0 pct
    cup  5 races        1 of 5  = 20.0        1 of 5  = 20.0    DEAD EVEN
    ore  2 races        0 of 2  =  0.0        0 of 2  =  0.0    DEAD EVEN
    trk  3 races        2 of 3  = 66.7        3 of 3  = 100.0
THE ENTIRE MARGIN OVER THE MARKET IS ONE TRUCK RACE - Richmond R17, where we had Honeycutt (won) and
the market had Majeski (19th). Cup is dead even at 1 of 5 each. Xfinity is 0 and 0. Ten races, a
one-race difference: statistically this is nothing, and it is the honest reading.

WHY THIS MATTERS MORE THAN THE POLE VERSION. Against a component of our own model we looked +6.2 and
flattering. Against the actual competitive alternative we are +1 RACE IN TEN, concentrated in the same
truck streak that is already carrying two other analyses today. That is fully consistent with
everything else measured today: the CLV lift is real but modest, outright flag ROI shows no edge, and
the board's strength is ORDERING rather than winner-picking. Nothing here contradicts those; it just
removes a benchmark that was quietly flattering us.
STANDING RULE, now four incidents deep: before adopting ANY evaluation target or benchmark, check it
against the model's input list. ARP was inside driver_rating. Start position is inside the weight set.
Both looked like independent yardsticks and neither was.


## 2026-08-28 - LAP RAPTOR GLOSSARY READ (operator-directed) + FORWARD-CAPTURE START DATE
Two things every future analysis of fastest_laps must know:
CAPTURE START: cpoms/lsp/arp/p50/p95 columns exist in fastest_laps as of today but are NULL for
all rows loaded before 2026-08-28. Do not treat NULL as "driver lacked pace shape" - it means
"parser discarded the column back then." Backfill pending (browser path).
ARP IS SYNTHETIC (glossary, lapraptor.com/glossary): Lap Raptor's ARP is an ESTIMATE -
((1 x laps led) + 0.5(start + finish)(laps run - laps led)) / laps run. It is a FORMULA OF LAPS
LED, START AND FINISH POSITION, not a measured average of per-lap running positions. This lands on
the standing benchmark rule (5th instance of the class): ARP was already known to sit inside
driver_rating; now we know it is not even an independent measurement OF pace - it is start/finish
restated. Any future temptation to use Lap Raptor ARP as a pace input or evaluation yardstick dies
here. cPOMS remains the genuinely new cardinal input: glossary confirms the operator's definition
(rPOMS-style averaging, each lap graded against the FASTEST LAP OF THAT LAP NUMBER, ratio not
rank). POMS family context: POMS = each lap's speed as a fraction of the race's fastest, averaged;
cPOMS swaps the denominator to per-lap-number fastest, removing fuel-run/phase bias. Also in the
glossary and possibly useful later, NOT now: Speed Score (1000 x driver P95 / race P95 - another
ratio metric, coarser than cPOMS), WARP (finish-prediction-weighted running position), delta-POMS
(last-segment vs first-segment pace), segment stats. Logged so nobody re-derives these.

## 2026-08-29 - cPOMS BACKFILL EXECUTED: 139 CUP OVAL RACES 2022-2026 NOW CARRY PACE-SHAPE METRICS
DATA PROVENANCE (read this before analyzing cpoms/lsp/arp/p50/p95 in fastest_laps):
SOURCE + METHOD: Lap Raptor race pages (lapraptor.com/races/{id}/?report=lap_performance),
server-rendered and carrying the FULL current column set for historical races - cPOMS/LSP exist
site-wide, not just post-07/26. Fetched same-origin inside the operator's Chrome (extension),
DOM-extracted (not regex - car numbers recovered from img alt), staged to a temp table via the
app's public client key, validated set-based in Postgres, then UPDATE-only into the 7 new metric
columns of EXISTING fastest_laps rows (row keys the app queries were never touched). All pb_ temp
objects dropped after.
VALIDATION RESULTS (140 races incl. 08-28 pilot = 2024 Coca-Cola 600): row-count parity vs
loop_data 140/140; name-join 100% (zero unmatched rows anywhere); start/finish/car agreement
exact except the adjudicated cases below; winner check vs races.winning_driver passed everywhere
except one adjudicated DQ case; cPOMS/LSP ranges clean (cPOMS 0.859-0.997; LSP is a 0-1 FRACTION
in this data, not 0-100).
ADJUDICATIONS (all verified benign, none blocked the load):
- DQ races (Pocono-22, Martinsville-22/25, Talladega-23x2/24/25): LR carries OFFICIAL post-penalty
  finishes, loop_data the as-timed order. Not touched - we wrote pace columns only. NOTE: our own
  races.winning_driver for Pocono 2022 holds the pre-DQ winner (Hamlin) - latent data wart.
- Michigan 2023 (rain-postponed): 5 adjacent-pair start-position swaps LR vs loop_data; row
  identity certain via name+finish+car.
- ARP-corr vs loop_data avg_position: report-only criterion; 0.90+ in 101 races, 0.53-0.90 in 39
  (17 of them superspeedway pack races). Definitional divergence - LR ARP is green-flag-measured,
  avg_position is all laps. NEVER a blocker; row integrity was proven by the exact-match gates.
- 3 crash-DNF drivers have NULL cpoms/lsp (too few green laps to grade) - legitimate, keep NULL.
- Suarez 2026 x4: loop_data car_number is NULL (our gap, LR right). Nemechek NH-26 ran 40 not 42.
REPAIRS BEYOND THE UPDATE (operator's fastest_laps had pre-existing holes, filled from the same
source his pastes use): date remaps to his entries for Dover-22 (05/01), Michigan-23 (08/06),
Pocono-26 (06/15 typo); Richmond 08/11/2024 COMPLETED from 3 rows to 37 and Richmond 08/16/2025
from 2 to 38 (old partial pastes); 5 single missing driver rows inserted (Stenhouse Richmond-22,
Williams Atlanta-24, Berry Kansas-24, Zilisch Chicagoland-26, Finchum NW-26); ranks recomputed for
affected races by fastest_speed desc (API convention). 75 rows inserted total, everything else
UPDATE-only. NOT LOADED: New Hampshire 2026-08-23 (operator never pasted it; his next normal Admin
paste captures cPOMS via the 08-28 forward-capture parser).
COVERAGE: 2022:29 races/1058 rows, 2023:29/1059, 2024:31/1161, 2025:30/1142, 2026:20/754 =
139 races, 5,174 rows with cPOMS. Scope was CUP OVALS (road/street/dirt excluded, exhibitions
excluded). oreilly/trucks backfill NOT done - same pipeline works if wanted.
NEXT: the pre-registered cPOMS gated test (BACKTEST_ARCHIVE.md 2026-07-07 GFS partial-correlation
structure, DO NOT MODIFY) now has its data. Operator 5-race manual-paste cross-check still open.

## 2026-08-29 - THE PRE-REGISTERED cPOMS TEST: GATE PASSED (WEAKLY), SWEEP FAILED - DO NOT ADD TO THE COMPOSITE
Ran the 2026-07-07/08 pre-registered structure UNMODIFIED: cup non-SS ovals (Intermediate + Short
& Flat), leak-free pooling exactly like corrHistory (prior same-group races, production yrWt
2.0/1.3/0.9/0.6/0.4, min 2 prior with cPOMS), train 2022-24 (67 races / 2,362 obs) vs test
2025-26 (41 / 1,508). Encoding decision fixed BEFORE results: raw ratio is the registered thesis
(percentiling = LSP = rank); percentile ran as reference only.
GATE (proper partial correlation, both sides residualized on pooledRating + startPos):
  RAW cPOMS:   train -0.0378 (t -1.84), test -0.0259 (t -1.00) - SAME SIGN, right direction. PASS.
  PERCENTILE:  train -0.0694, test +0.0295 - SIGN FLIP, dies exactly like GFS. 
  corr(pooledCPOMS, pooledRating) = 0.815/0.856 - NOT the 0.972 GFS near-clone; ~25-30 pct of its
  variance is unshared with rating. The thesis half-confirmed: the cardinal margin carries the
  only surviving orthogonal signal, and rank encodings of pace are conclusively dead.
WEIGHT SWEEP (protocol next step after a gate pass; production composite z-sum, startPos 0.48
fixed, corr budget 0.52 split rating/cPOMS; per-race Spearman + p5/p10, races >=10 obs):
  TRAIN Spearman: rating .4825 / +c10 .4842 / +c20 .4825 / c-only .4797
  TEST  Spearman: rating .4805 / +c10 .4789 / +c20 .4755 / c-only .4658
  The +0.002 train gain at 10 pct REVERSES out-of-sample; every cPOMS config <= rating on test
  p10; c-only strictly worse everywhere. Same shape as the pass_diff "wrinkle": in-sample dust.
VERDICT: cPOMS does NOT enter the finish composite. The saturation family now includes it: ARP,
quality passes, pass_diff, GFS, and cPOMS all <= driver_rating for FINISH ORDERING on ovals. The
orthogonal sliver is real (stable -0.03 partial) but too small to move a rank composite.
WHAT THIS DOES NOT SAY (queue material, each needs its own pre-registered test): cPOMS as a
DOMINATOR input (laps-led/fastest-laps share for DFS - pace shape plausibly matters more there
than for finish rank); cPOMS for matchup markets; cPOMS tails for the win-variance layer. The
backfilled columns stay - they cost nothing and any future test now has 139 races of history.
DISCIPLINE NOTE: gate rule was written 7 weeks before the data existed, ran once, unmodified,
and the answer is a clean negative on the primary question. That is the system working.

## 2026-08-29 - ADDENDUM (operator follow-up): cPOMS as a full REPLACEMENT for rating
Two variants, same harness. (1) In the composite with startPos 0.48: cPOMS 0.52 / rating 0 was
already config D of the sweep - worst line (test Spearman .4658 vs .4805, p10 .532 vs .561).
(2) Pure single-signal head-to-head, NO startPos: train rating .4625 vs cPOMS .4566 (near tie);
test rating .4644 vs cPOMS .4400 (rating clearly better). Test p10 nudged cPOMS .541 vs .534 -
one race worth, noise. Same shape as the ARP ablation: pace metrics tie in-sample and lose
out-of-sample. cPOMS cannot replace driver_rating any more than it can supplement it for finish
ordering. Substitution question CLOSED alongside the addition question.

## 2026-08-29 - REMAINING LAP RAPTOR COLUMNS ALL TESTED, ALL CLOSED FOR FINISH ORDERING
Operator: "what about any of the other metrics lap raptor stores?" Ran all four remaining
backfilled columns through the identical gate + sweep, candidates and bar declared before
results (4 candidates at once = family-wise false-pass risk; bar = same-sign both splits AND
survive the sweep OOS).
GATES (partial corr vs finish, residualized on pooledRating + startPos, train/test):
  LSP:          -0.046 / -0.018  same sign, but a 0.97-0.98 rating clone (as predicted for ranks)
  P50-ratio:    -0.023 / -0.034  same sign (median-lap pace vs race best)
  P95-ratio:    -0.024 / -0.034  same sign (= Lap Raptor Speed Score construction)
  CONSISTENCY:  +0.005 / +0.017  (p50_time/p95_time spread) - the most ORTHOGONAL input ever
    tested here (rating corr only 0.27/0.47), and it carries ZERO finish information once
    rating+start are controlled. Its raw -0.13/-0.20 corr with finish is entirely mediated.
SWEEP (production composite, startPos 0.48, corr budget split with rating; P50 and P95 at
10/20 pct): NO config beats rating baseline on EITHER split - not even the in-sample mirage
cPOMS showed. Train: rating .4825 vs .4814-.4822 all configs. Test: .4805 vs .4765-.4800.
p10 ties within noise.
VERDICT - the lap_performance table is now FULLY adjudicated for finish ordering: ARP (closed
twice), cPOMS (add + replace), LSP, P50, P95/Speed Score, consistency spread. All <= driver
rating. The saturation family is complete across every level AND dispersion statistic of lap
pace. Nothing in this table will improve finish projection; do not re-test without a new target.
NOT STORED (would need a different LR report harvest, and are position-derived = presumptively
saturated): WARP, PFARP/PFAE, gain/loss/net ratings, delta-POMS, segment stats. Do not harvest
on a finish-ordering hypothesis; only a DOMINATOR-target or matchup-target hypothesis justifies
new collection.
STANDING DOOR (the one left): cPOMS/P95/consistency vs DOMINATOR SHARE (laps led, fastest laps)
for DFS - different target, plausibly pace-shaped, pre-register before running.

## 2026-08-29 - PRE-REGISTERED: THE DOMINATOR GATE (written before any data examined - DO NOT MODIFY)
Question: does pace shape predict DOMINATOR SHARE (what DFS pays for) beyond what the sim and the
trivial incumbent already know? Registered in full before running; a future session runs this
EXACTLY as written or not at all.
TARGETS (separate tests): T1 laps-led share = ld.laps_led / races.total_laps; T2 fastest-laps
share = ld.fastest_laps / race sum of ld.fastest_laps.
SCOPE/SPLIT/POOLING: cup non-SS ovals (Intermediate + Short & Flat), leak-free pooling exactly as
all prior harnesses (prior same-group races, yrWt 2.0/1.3/0.9/0.6/0.4, min 2 prior with cPOMS),
train 2022-24 / test 2025-26.
PRIMARY CANDIDATE: pooled RAW cPOMS only. Secondaries (reference, cannot ship from this run,
would need fresh confirmation): pooled P95-ratio, pooled consistency (p50_time/p95_time).
STAGE 1 GATE: partial SPEARMAN (rank-transform all variables per split - declared now because
shares are zero-inflated; midranks for the zero mass) of pooled cPOMS vs target share,
controlling THREE variables: pooledRating, startPos, and pooled PAST share of the same target
(same pooling - the incumbent-beater control, stricter than the finish gate on purpose).
PASS REQUIRES ALL OF: positive sign both splits AND |partial| >= 0.05 in BOTH splits (floor
added because 2026-08-29 proved |r|~0.03 stable-sign signals fail integration). Wrong sign,
flip, or sub-floor anywhere = STOP.
STAGE 2 UTILITY (only on a Stage-1 pass): incumbent = rank from linear combo of the three
controls, weights fit on TRAIN only; challengers add cPOMS at 10 and 20 pct. SHIP only if a
challenger beats incumbent on the TEST split on BOTH per-race Spearman of share ranks AND
precision@2 (top-2 actual dominators per race). Any test-split loss on either metric = STOP.
DATA PRECHECK (allowed before gating, integrity only): confirm ld.laps_led / ld.fastest_laps
population rates and races.total_laps coverage; no looking at candidate-target relationships.

## 2026-08-29 - DOMINATOR GATE EXECUTED AS REGISTERED: BOTH TARGETS STOP AT STAGE 1
Precheck clean (4,130 obs full population; no missing total_laps). Obs after pooling: train
1,726 / 49 races, test 1,394 / 38. Zero-inflation as expected (27 pct led any lap, 67 pct set
any fastest lap) - midrank Spearman per the registration.
STAGE 1 partial Spearman (controls: pooledRating + startPos + pooled PAST share of same target):
  LL-SHARE, cPOMS (primary):  train -0.0338, test -0.0657 -> STOP, WRONG SIGN (registration
    required positive). Sign-consistent but negative: given the controls, higher pooled cPOMS
    associates with marginally FEWER laps led. Not interpreted further per protocol.
  FL-SHARE, cPOMS (primary):  train +0.0636 (t +2.64), test +0.0345 (t +1.28) -> STOP, UNDER
    THE 0.05 FLOOR on test. Positive both splits - the closest any pace metric has come in this
    program - but the floor exists because this exact magnitude class (0.03-0.06) passed the
    finish gate and then failed integration. Rules are rules; that is their job.
  Secondaries (reference only, unshippable from this run): P95 on FL-share +0.0655/+0.0494
    (also just under floor, sign-consistent); CONS sign-flips on FL, dead on LL.
VERDICT: nothing ships. The dominator door closes on current data. The full Lap Raptor program
is now COMPLETE: six metrics x two target families, every path adjudicated, zero model changes -
and that is a finding: the sim's existing inputs already contain everything the lap_performance
table knows, for every target we pay for.
PERMITTED FUTURE RE-RUN (one, narrow): FL-share x cPOMS/P95 may be re-tested ONCE on FUTURE
data only (2026 playoff + 2027 races, as fresh confirmation - never by re-pooling or re-splitting
the data above). If a fresh sample independently clears +0.05 both splits, Stage 2 unlocks.
Anything else requires a new registration.

## 2026-08-29 - TAIL FIX SHIPPED: BACKSTOP + mev>0 DEFAULT + medge SURFACED + PARALLEL LEDGERS
Operator: "I still want to fix the tail of the simulation." Built exactly what the 08-24 analyses
settled on - display/report gates only, write-side logging untouched (doctrine #69), no medge
floor picked (STATE item 4: ladder non-monotonic at 9 races).
SHIPPED (SimResults.js + GradeCenter.js):
- BACKSTOP, deterministic: no green badge / Qualified row below 10 pct model probability or at
  prices past +1000. This alone structurally excludes both fabricated-tail cells (0-for-72
  sub-10 pct, 0-for-99 >= +1000).
- mev>0 REQUIRED ON THE DEFAULT VIEW (was opt-in via Qualified only): ev alone fires whenever one
  book hangs a number (corr(ev, line move) -0.139 vs medge +0.101).
- medge SURFACED everywhere flags appear: badge chip m+X (green at >=5), GradeCenter flag rows,
  fetches now carry medge + sim_prob.
- PARALLEL LEDGERS live in GradeCenter roi: consensus (mev>0) / medge5+ / medge10+ - 10 is the
  fitted value and is forward-test ONLY. The pre-registered CLV lift ledger remains the judge.
RETRO PARTITION (sanity check, not tuning; 324 logged flags, 16 races): old badge would show 238;
new gate shows 20 (~1.3 suggestions/race). Killed by backstop: 86 sub-10 pct prob, 104 past
+1000 (overlapping). Ledger cohorts: medge>=5 n=166, >=10 n=86, zero null-medge rows.
WHAT THIS IS AND IS NOT: it does not recalibrate the simulator's tail probabilities - it stops
SELLING them. The 08-24 finding stands: the model's low-prob buckets are fine in aggregate; what
fails is the subset where we most disagree with the sharp consensus at tiny probabilities
(winner's curse). The suggestion surface now refuses exactly that subset. Sim-internals work
(variance layer) remains a separate, unscheduled project.

## 2026-08-29 - REPLAY: OREILLY R24 DAYTONA (Winn-Dixie 250) + WHAT MAE 10 MEANS AT A SUPERSPEEDWAY
Race graded vs loop_data (race_id 480, 35/37 board drivers joined both stages). Winner: Ryan
Sieg from P38 at model 0.5-0.6 pct (FD morning price +40000 = 0.25 pct implied - we were 2x the
market on the actual winner; a lottery ticket either way).
BOARD: MAE pre 10.28 / post 10.19; Spearman 0.10 / 0.12; top pick finished P2; p5 hits 0,
p10 hits 1.
THE BASELINE FINDING (the point of this entry): projecting EVERY driver at P19 flat scores MAE
9.83 on this race. The model scored 10.19 - AT/BELOW the no-information floor. Start-as-
projection scores 12.66 (start is anti-signal in the draft). Historical SS boards (n=4 + these
2): MAE 8.64-10.83, avg ~9.7, vs the ~9.5-9.8 constant-projection floor; other tracks avg 7.02
vs the same floor - real signal. CONCLUSION: at superspeedways the sim's proj_finish carries
approximately ZERO point-estimate information, and MAE ~10 is not a performance level to improve
- it IS the floor. Pack racing, not a defect. Ordering retains a pulse (top pick P2; SS Spearman
0.19 avg) but point projections do not. OPERATOR'S "MAE 10 consistently at SS" observation is
confirmed and now explained.
PRODUCT IMPLICATION (queue): on SS weekends the sellable content is ordering/probabilities/DFS/
matchups, never finish projections; consider surfacing per-track-type MAE context so subscribers
see SS uncertainty honestly.
TAIL FIX, FIRST OUT-OF-SAMPLE RACE: 9 flags logged; the OLD badge would have shown 4 (1 hit);
the NEW gate showed ZERO suggestions. Given the floor finding above, zero is the CORRECT number
of SS finish-market suggestions - the gate refused to sell noise on its first live weekend.
DFS: 925-entry GPP, winner 314.4, median 201.3. Our 10,000-iteration per-driver samples give an
UNCAPPED best-6-sum distribution of p50 338 (p5 310 / p95 370); the actual winner sits at the
9th pctile of that - coherent, since the true winner is salary-capped and the field imperfect.
No red flag; a proper DFS calibration test needs salary-capped optimals (future work, not now).

## 2026-08-29 - CORRECTION (operator catch, 13th of the class): both halves of the Sieg anecdote were wrong
The previous entry said Sieg won "from P38" at "FD +40000 = 0.25 pct, we were 2x the market."
BOTH claims came from memory, not data, and both are false. Loop data (race 480): Ryan Sieg,
car 38, STARTED P12. The P38 was a ghost of the corrupted qualifying load scrubbed earlier that
day - I quoted data I had personally deleted as wrong. And odds_snapshots says his real win
price was DK +2800 / HR +3000 at the final capture (~3.4 pct raw, ~2+ pct de-vigged); the +40000
belonged to Joey Gase in the FanDuel fixture. DIRECTION REVERSES: the model's 0.5-0.6 pct was
roughly a THIRD of the market on the actual winner - we underrated him, the market had him as a
live longshot (car 38 RSS Racing plate program - the market knew).
UNCHANGED: every computed number in the entry (MAE/baselines/Spearman/gate counts/DFS
percentiles) came from queries and stands. The two wrong sentences were color commentary written
from memory in the same entry. STANDING RULE (restating 08-24's, which this violated twice in
one paragraph): every driver-level factual claim in a log entry gets pulled from the table it
lives in, in the same session that writes it - especially details touching data that was
corrected or deleted the same day, where memory is BY CONSTRUCTION stale.

## 2026-08-29 - DATA FIX + CORRECTION: Jankowiak raced (operator). RR omitted him; row inserted; DFS re-answered
Racing Reference's results page omitted Andy Jankowiak from R24 Daytona (oreilly); loop_data's
finish column had exactly P30 vacant, corroborating the operator: car 39, started 38, finished
30. Row inserted manually (lap-level stats null - no source). CORRECTED NUMBERS: replay MAE
(full 37 joins + Sanchez name patch) pre 10.17 / post 10.01 vs const-baseline 9.69 - conclusion
unchanged. DFS: there was NO DNS - the previous entry's "swap scenario 278, top decile" is
retracted as an artifact of the missing row. The actual projection-optimal lineup scored ~235.0
(Jankowiak 20+ pts; his fastest-lap count unknown) = just under the GPP p75 (237.3). Honest
verdict: top ~27 pct of a 925-entry field, good-not-great; 5 of 6 picks scored 39-63, the miss
was Clements (3.9). The Honeyman salary name-join gap stands (bug class, 3rd sighting).
LOAD GUARD QUEUED: the race loader should count results rows vs the qualifying grid and warn on
a gap - a missing driver on RR's page silently corrupted a replay and a DFS verdict today.

## 2026-08-29 - DFS ENTRY-FILL BUG: wrap-around defeated the exposure cap and printed duplicates (FIXED)
Operator uploaded the R24 Daytona GPP standings (925 entries, his 20 optimizer entries,
username-verified). Portfolio results: best rank 33 (96.5 pctile, 294.10), 13/20 above field
median, median entry 235 vs field 201. BUT 5 exact duplicate PAIRS among his 20, and 4 drivers
at 18/20 exposure despite a cap being set. ROOT CAUSE (DFSPage.js applyEntriesFill):
`lineups[filled % lineups.length]` - when the exposure cap delivered fewer unique lineups than
reserved entries, the fill wrapped around and re-used the TOP lineups, simultaneously creating
in-contest duplicates (wasted GPP equity) and pushing exposure back to ~90 pct (defeating the
cap). The cap logic itself (applyExposure) worked as configured. FIX SHIPPED: one entry per
unique lineup per contest; excess rows OMITTED from the upload file (DK leaves them untouched)
with an explicit SKIPPED note; cross-contest reuse preserved. Real-money path - third incident
class on it (see 2026-08-23 under-delivery warnings).
NOTED, not built (operator to weigh in): max-exposure default for GPP builds; market-vs-model
disagreement exposure rule (Sieg 56.5 pts at 0 pct exposure while the market priced him 3x our
sim - one pivot from winning the contest outright).

## 2026-08-29 - DFS BUILDER: exposure cap now CONSTRUCTS missing lineups instead of under-delivering
Operator (fresh build, no locks): 20 lineups @ 60 pct cap delivered only 13. Cause: applyExposure
only FILTERS the ranked candidates - on a chalky slate every top candidate shares one core, so
once the core caps, all remaining candidates are blocked. FIX: topUpLineups() - when the filter
pass under-delivers, re-run the optimizer with capped drivers EXCLUDED, take the best new unique
lineup, update counts, repeat to the requested count. Top-ups rank by projected mean (not sim
ceiling; noted in the UI). Verified on the actual R24 slate offline: 12 after filtering -> 20/20
unique, max exposure exactly at the cap. Both cash and GPP paths; under-delivery warning now
fires only when truly infeasible (locks/excludes leave too few drivers).

## 2026-08-29 - PRE-REGISTERED: SS VARIANCE CALIBRATION (written before any fitting - DO NOT MODIFY)
FINDING THAT MOTIVATES IT (measured first, no parameters touched): the sim's rank->win curve at
superspeedways is uniformly too steep vs 59 SS races / 1,989 driver-obs (all 3 series 2022-2026,
leak-free pooled-rating strength ranks):
  band 01-03: sim 16.5 vs real 12.4 | 04-06: 7.0 vs 5.1 | 07-10: 3.4 vs 2.5
  band 11-15: 1.7 vs 2.4 | 16-20: 0.8 vs 2.7 | 21+: 0.20 vs 0.62
Reality is FLAT ~2.5 pct from rank 7 to rank 20. One defect, both tail failures: overconfident
favorites (fake-value flags) and 3x-starved mid-pack (Sieg 0.5 pct vs real ~2.5).
PROTOCOL:
- PARAMETER: the SS-group MC variance/upset dial only (whatever form it takes in runRaceSim).
  Nothing else moves - no weights, no inputs, no other groups.
- FIT: 2022-2024 SS races ONLY (~35 races). Target: minimize distance between the sim's
  rank->win curve and the empirical 2022-24 curve, rank->top5 as joint target.
- VALIDATE (untouched until fit is frozen): 2025-2026 SS races. PASS = the fitted parameter's
  curve matches the 2025-26 empirical curve within band SEs AND win-Brier on the graded SS
  boards does not degrade vs current. One shot; no refitting after seeing holdout.
- SHIP only on pass; the change applies to SUPERSPEEDWAY_WEIGHTS group sims across series.
- JUDGED FORWARD by: SS board win-Brier on future graded boards + the CLV ledger unchanged rules.

## 2026-08-29 - SS VARIANCE CALIBRATION EXECUTED AND SHIPPED (m = 1.75, protocol followed exactly)
METHOD: python port of runRaceSim's SS path (Box-Muller noise, SS mid wreck sets/P/surv/accShare
extracted verbatim from source, dnfRate + noise 18 from the R24 stored config). Score vector
reconstructed by inverting the R24 post board's per-rank win curve at m=1 - reconstruction
reproduced the real board's bands to 0.1 pt (16.34/7.08/3.43/1.70/0.82/0.20 vs actual
16.53/6.97/3.38/1.72/0.82/0.20), validating the port. FIT on 2022-24 empirical bands only
(n-weighted log-loss): surface flat 1.5-1.9, minimum m = 1.75. FROZEN.
HOLDOUT (2025-26, untouched during fit): all six bands within 1.25 SE (current model: two bands
at ~1.0 SE and the shape systematically off); pooled chi-sq 2.75 vs 2.92; holdout winner
log-likelihood +0.94 nats for fitted (~2.6:1 likelihood ratio over 24 races); R24 board win-Brier
0.02994 -> 0.02773 (improved, did not degrade). PASS on all registered criteria - stated
honestly: the holdout is directionally supportive but small; the decisive evidence is the pooled
59-race curve and the mechanism.
SHIPPED: GROUP_NOISE_MULT = { SS: 1.75 } multiplying cautionPreset.noise inside runRaceSim, SS
group only, everything else untouched. New expected SS shape: top car ~14 pct (was 26.6 on R24),
band 16-20 ~1.8 (was 0.8), 21+ ~0.8 (was 0.2). Flows through the board, medge, flags, and DFS
samples together.
FORWARD JUDGE (pre-registered, do not retune): win-Brier on future graded SS boards vs the old
engine's grades + the CLV ledger's unchanged rules. m is not to be refit from in-sample data;
next legitimate refit is after ~10 new SS races, on the same fit/holdout discipline rolled
forward.

## 2026-08-29 - PRE-REGISTERED: SHORT + INT VARIANCE CALIBRATION (written before any fitting - DO NOT MODIFY)
Extension of the SS protocol to the other simulated groups, on operator instruction ("do this for
all track types"). DIAGNOSTIC MEASURED FIRST (pooled-rating strength ranks, sim __trackGroup
regex, dirt excluded; sim curves from the graded post boards - SHORT n=7 boards, INT n=2):
  INT:   sim 15.68/7.68/3.93/1.64/0.67/0.04 vs real 14.65/6.76/4.46/1.55/0.60/0.25 - near-calibrated
  SHORT: sim 19.00/7.43/3.06/1.01/0.25/0.03 vs real 15.52/9.48/3.45/1.21/0.00/0.13 - top-heavy
         (band 01-03 +1.8 SE high, but 04-06 is LOW by -1.3 SE: shape differs from the SS signature)
  ROAD:  zero graded post boards exist - UNTESTABLE until boards accumulate; nothing fit, nothing shipped.
PROTOCOL (identical to SS): parameter = per-group entry in GROUP_NOISE_MULT only, nothing else
moves. FIT on 2022-24 empirical bands (n-weighted log loss), per group. VALIDATE one-shot on
2025-26: bands within SEs + board Brier non-degradation. m ~= 1 at the fit stage = the group is
CERTIFIED as-is and nothing ships - that is a success outcome, not a failure. An honest "defect
is shape, not scale" no-ship verdict for SHORT is acceptable and expected as a possibility.
Boards used for score reconstruction: cup25 (NH R25, SHORT, noise 16 cval 8 dnf .10647 n=36) and
cup22 (Indy R22, INT, noise 16 cval 8 dnf .13692 n=39).

## 2026-08-29 - SHORT + INT CALIBRATION EXECUTED: NOTHING SHIPS (both groups certified at m=1)
Same harness as SS (python port per group, group constants + mid wreck sets verbatim from source;
score vectors reconstructed from the cup25/NH and cup22/Indy boards at m=1 - both reconstructions
reproduced their boards' bands to ~0.2 pt, validating the ports).
SHORT: fit minimum lands exactly at m=1.00 (loss 753 vs 801 at 0.85, 851 at 1.15). Holdout
2025-26 at m=1: all six bands within 1 SE (chi-sq 1.84). CERTIFIED CLEAN. The +1.8 SE top-heavy
signature in the pooled 7-board diagnostic is SHAPE, not scale (band 04-06 is UNDER, so widening
noise cannot fix band 01-03 without breaking 04-06) - exactly the no-ship outcome the
pre-registration named as acceptable.
INT: fit (2022-24) preferred m=1.30, but the one-shot holdout REJECTED it: chi-sq degrades
monotonically with m (4.50 at m=1.0 -> 7.33 at 1.3), winner log-likelihood flat (-156.7 vs
-156.8). Registered pass required holdout non-degradation; m=1.3 fails it. NO SHIP - the 2022-24
vs 2025-26 empirical bands disagree with each other (band 01-03: 12.3 vs 18.9), i.e. the fit
signal was era noise, not engine miscalibration. INT stays at m=1.
ROAD: zero graded post boards - untestable, documented, revisit when boards exist.
NET: GROUP_NOISE_MULT stays { SS: 1.75 } only. SS remains the one group where the engine's
variance was measurably wrong; SHORT/INT engines are certified against 5 years of empirical
rank->win data. No code changed; no re-fit permitted from this data (same freeze rules as SS).

## 2026-08-29 - PRE-REGISTERED: SHORT PLACEMENT-TAIL CALIBRATION (written before fitting - DO NOT MODIFY)
MOTIVATION (measured first; operator: tails still feel wrong at SHORT/INT despite win certification).
The win-only certification was too narrow - it asked "can noise fix the WIN curve" and the answer
(m=1) was correct for that question. The full finish distribution tells a different story:
- Direct reliability, sim's own 7 SHORT boards vs actual finishes (no rank proxy): drivers given
  70+pct top10 hit 71.4 actual (pred avg 81.9, n=28); drivers given 5-15 hit 15.0 (pred 8.7, n=40);
  pooled sub-30pct buckets: predicted 7.9 actual 11.5 - longshots hit top10s ~1.5x the board rate.
- 5yr rank curves (same strength-rank machinery): sim t10 84/76/55/38/17/1.6 vs real 69/59/50/38/20/5.4;
  elite blowups (fin>=25) real 10.1 vs sim 7.6. Era-STABLE: fit vs holdout empirical bands agree.
- MECHANISM: top-10 slots are conserved, so elite overconfidence IS mid-pack starvation - one defect.
  WRECK_SURV_COST.SHORT=1.6 makes a wreck cost ~2 score pts vs noise sigma 16: a collected car loses
  ~1 position. Elites never fail; everyone below starves. (INT: no defect signature - board reliability
  and rank curves both within noise; INT placement checked and left alone.)
PROTOCOL:
- PARAMETERS: exactly two, SHORT group only: GROUP_NOISE_MULT.SHORT and WRECK_SURV_COST.SHORT.
  Nothing else moves.
- FIT: 2022-24 SHORT empirical bands, JOINT target = win + top5 + top10 + fin25plus curves
  (n-weighted squared log-ratio, all 24 cells). Grid over (m, surv).
- VALIDATE one-shot on 2025-26: all 24 holdout cells within 2 SE, at least 18/24 within 1.25 SE,
  and pooled holdout chi-sq improves vs current (m=1, surv=1.6). No refit after seeing holdout.
- HONESTY NOTE: an exploratory sweep saw pooled 2022-26 curves before this registration (that is
  how the surv mechanism was found); the fit below uses 2022-24 targets only and the holdout
  criteria above were set before the fit ran.
- SHIP on pass; judged forward by reliability on future SHORT boards + the unchanged CLV/DFS ledgers.

## 2026-08-29 - PRE-REGISTERED: INT PLACEMENT-TAIL CALIBRATION (written before fitting - DO NOT MODIFY)
CORRECTION to today's earlier "INT placement looks fine": that clearance rested on top5/top10 from
the 2 stored INT boards and board reliability (n=75, weak). The blowup curve is NOT stored on
boards; the harness (Indy cup22 reconstruction, port validated on NH/R24 boards) exposes the same
surv-mechanism defect at INT: elite fin>=25 sim ~9.5 vs real 14.3 (z~3 on n=505), backmarkers
over-buried (21+ band f25 sim 66 vs real 50.5, partly the wreck-seed clamp piling hits onto the
tail of the running order). Placement curves are ERA-STABLE across 2022-24 vs 2025-26 (unlike
INT's win band 01-03, which is why the win-only fit's holdout failed - wins were the noisy metric).
PROTOCOL (identical to SHORT): parameters = GROUP_NOISE_MULT.INT and WRECK_SURV_COST.INT only.
FIT 2022-24, joint win+t5+t10+f25 bands, n-weighted squared log-ratio, grid over (m, surv).
VALIDATE one-shot 2025-26: all 24 cells within 2 SE, >=18/24 within 1.25 SE, pooled chi-sq
improves vs current (m=1, surv=2.5). No refit after holdout. Ship on pass; marginal misses go to
the operator with the failure disclosed, as with SHORT.

## 2026-08-29 - SHORT + INT PLACEMENT CALIBRATION EXECUTED AND SHIPPED (surv 16 / 18, noise untouched)
SHORT: fit minimum (m=1.00, surv~16; basin flat 15-18, noise dial confirmed clean at 1.0).
Holdout: chi-sq 182 -> 20, 21/24 cells within 1.25 SE, blowup curve essentially exact. Two cells
just past 2 SE (t10 band 04-06 z=2.25, band 21+ z=-2.01) -> strict criterion technically failed;
disclosed to operator, operator approved ship. WRECK_SURV_COST.SHORT = 16 (was 1.6).
INT: fit basin flat (m 1.0-1.1 x surv 18-26); froze parsimonious m=1.00, surv=18. Holdout:
chi-sq 165 -> 36, 20/24 within 1.25 SE, 23/24 cells better or equal; elite blowups 13.0 vs real
14.4 (was 9.5). Two cells ~3.4 SE, one degrading (t10 ranks 16-20, 30.2 vs real 21.3, was 27.7)
- traces to the Indy reconstruction board's unusually strong mid-pack (pooled stored-sim value
for that band is 23.5, near reality, so the live-engine error is likely smaller than the harness
shows); residual direction is conservative (over-flags mid-pack, does not hide it). Disclosed;
operator approved ship. WRECK_SURV_COST.INT = 18 (was 2.5).
MECHANISM NOTE for future sessions: the wreck-seed clamp (victims = consecutive run-order slots,
seed+j clamped at N-1) piles hits onto the tail of the running order - part of the backmarker
over-burial. Not touched in this calibration; a structural candidate if f25 band 21+ residuals
persist on forward boards.
FORWARD JUDGE (pre-registered): prediction-vs-actual reliability on future SHORT/INT graded
boards (the t10-bucket table in today's entries is the template) + unchanged CLV/DFS ledgers.
Constants frozen; no in-sample retuning; next legitimate refit after ~8-10 fresh races per group.
ROAD: same engine, surv 2.7, zero graded boards - untestable, flagged when boards exist.

## 2026-08-29 - PRE-REGISTERED: PER-GROUP DRIVER ATTRITION (Stage A all groups) - written before running
CONTEXT: per-driver DNF propensity was tested and REJECTED 2026-07-11 (archive) as a GLOBAL term,
with a standing "do not retry as a global term" rule. This registration is the refinement that
entry itself named as legitimate: TRACK-TYPE-SPECIFIC propensity. Two things have changed since
July: (1) the July Stage B was judged on cup INTERMEDIATES, the one group whose own tier table
shows a flat gradient (11.1 elite vs 13.6 tail); the gradient is real only at short/flat (4.1 vs
11.6, ~3x); (2) the engine could not express the trait before today - surv 1.6 meant bad days
cost ~1 position; now they destroy finishes. Operator asked to test ALL groups, agreed protocol:
measure everywhere, fit only where measurement passes.
STAGE A (persistence, pure measurement, no knobs) - ALL FOUR GROUPS, declared before running:
- Data: loop_data 2022-2026, all 3 series, exhibitions + dirt excluded, sim __trackGroup regex.
  DNF := laps_completed < 90 pct of the race winner's laps (July definition, unchanged).
- Walk-forward personal rate per (driver, series, group): age-weighted (2.0/1.3/0.9/0.6/0.4 by
  year gap, same as pooled-rating), shrunk k in {8,12,18} toward the trailing same-series+group
  field base, prior races only, min 5 prior races in group.
- PASS BAR (per group, declared now): terciles of predicted rate monotone in realized DNF for
  ALL THREE k values AND (T3 - T1 realized) >= 3.0 pts AND the T3>T1 sign holds in both halves
  (2022-24 vs 2025-26). Fail any leg = that group is CLOSED for personal attrition.
- EXPECTATIONS stated ex ante: SHORT live candidate; ROAD maybe (non-monotone July bump, and no
  boards to validate Stage B against - a ROAD Stage A pass is LOGGED, not acted on, until ROAD
  boards exist); INT and SS expected fails confirming the July picture.
STAGE B (only for Stage A passers, separate registration before it runs): market + placement
impact on the NEW engine (surv 16/18), train 2022-24 / test 2025-26, ship only on pass.

## 2026-08-29 - STAGE A EXECUTED: per-group attrition persistence (registered bar applied verbatim)
15,981 driver-races -> 11,129 scoreable (min 5 prior in series+group). Walk-forward, all 3 series.
Registered bar: monotone terciles at k=8/12/18 AND realized T3-T1 >= 3.0 AND sign holds both eras.
- SHORT (n=3215, base 10.0): monotone all k; spreads +4.5/+4.8/+4.8; eras +5.4/+3.3. PASS.
- INT (n=5011, base 10.7): monotone all k BUT spreads +2.1/+2.5/+2.2 < 3.0. FAIL - confirms the
  July picture with a sharper instrument: the gradient exists at INT but is too thin to price.
- SS (n=1552, base 16.8): non-monotone at k=8/12, spread -1.2 to +0.4, era sign FLIPS. FAIL
  decisively - pack racing erases the trait, as the July reversal suggested.
- ROAD (n=1351, base 11.3): monotone all k; spreads +5.1/+7.0/+6.8 (LARGEST of any group); eras
  +5.3/+7.5. PASS - but per the registration this is LOGGED AND PARKED: zero graded ROAD boards
  exist to validate a Stage B against. Revisit when ROAD boards accumulate.
CALIBRATION NOTE for Stage B design: predicted tercile spreads overshoot realized ~2-3x (pred T3
~17 vs real ~12.5 at SHORT) - the k=8-18 shrinkage is too weak; Stage B's personal term must be
scaled to REALIZED spreads or shrunk harder, or it will overtax high-propensity drivers.
NEXT: Stage B for SHORT only (separate registration before running): personal attrition layer in
the new engine (surv 16), train 2022-24 / test 2025-26, driver-level judges. INT and SS are
CLOSED for personal attrition (this supersedes nothing - July's global rejection stands too).

## 2026-08-29 - PRE-REGISTERED: STAGE B, SHORT PERSONAL ATTRITION (written before running - DO NOT MODIFY)
DESIGN (all declared now):
- Personal hazard: walk-forward p_i (k=12, age-weighted, min 5 prior SHORT races in series; else
  flat), CALIBRATED p_cal = clamp(b + alpha*(p_i - b), .005, .6) with the single scalar alpha fit
  on 2022-24 by Bernoulli likelihood (Stage A showed raw spreads overshoot ~2-3x). In the MC each
  driver's wreck-DNF and mech-DNF channel probabilities scale by w_i = p_cal/b, clipped [0.3, 3],
  RENORMALIZED so the race-mean hazard equals the flat base - total attrition identical, only its
  distribution across drivers moves. Flat config: w_i = 1 for all.
- Harness: the validated SHORT python port (new engine, surv 16, noise 16, mid wreck sets);
  per-race score vector = canonical reconstructed SHORT score shape assigned by leak-free pooled-
  rating strength rank (interpolated to field size); race base hazard = trailing series+SHORT
  field DNF rate, walk-forward. All SHORT races 2022-26, fld >= 25, all 3 series.
- JUDGES on test split 2025-26 only (train 2022-24 fits alpha, nothing else):
  J1: driver-level DNF Brier, p_cal vs flat base - personal must IMPROVE.
  J2: driver-level fin>=25 Brier from the MC, personal vs flat - personal must IMPROVE.
  J3: driver-level top10 AND win Brier - personal must NOT DEGRADE (within 2 SE of zero diff).
  PASS = J1 and J2 improve and J3 holds. One shot; no refitting after seeing test.
- SHIP path if pass: per-driver hazard multiplier in runRaceSim for SHORT group only, computed
  from prior same-series SHORT loop_data at sim time (machinery already pulls history), alpha and
  clips frozen from this fit. Expectation stated ex ante: ~coin flip; a fail closes personal
  attrition everywhere and redirects signal-hunting to new data sources.

## 2026-08-29 - STAGE B EXECUTED: SHORT PERSONAL ATTRITION FAILS - personal attrition CLOSED (all groups)
alpha fit on 2022-24: 0.5 (exactly the ~2x overshoot correction Stage A predicted). Test split
2025-26, 1,628 driver-obs, judges applied verbatim:
  J1 DNF Brier:  flat .10123 vs personal .10101 - point improvement, z=-0.52: NOISE, not signal.
  J2 f25 Brier:  flat .18732 vs personal .18766 - WORSE (+z 1.07). FAIL.
  J3 t10 Brier:  +z 1.81 (holds under 2 SE, leaning bad); win Brier flat.
VERDICT: FAIL on J2, J1 indistinguishable from zero. In the BEST-CASE group (largest stable
gradient, calibrated engine that can express the trait), honestly-shrunk personal attrition adds
nothing at the driver level out of sample. This is the definitive close: personal attrition is
CLOSED everywhere - SHORT (this test), INT/SS (Stage A), global (2026-07-11 archive). ROAD stays
parked with a now-strong prior of unpriceability; do not run its Stage B without new evidence
plus graded ROAD boards. No redesign/refit after test per registration - clip/renorm choices die
with the test.
IMPLICATION (the real yield of tonight): the existing tables are mined out - inputs (LR program),
variance (calibrations), and now trait layers all adjudicated. Future signal-hunting goes to NEW
data only: Lap Raptor GR/LR columns (operator question open), pit-stop data, road boards when
they exist, and the one permitted dominator re-test on future races.

## 2026-08-29 - TAIL GUARD DECISION (Daytona R26, Dye case): guards STAY, write path STAYS AS IS
Post-qualifying board surfaced Dye t10 model 10.6 vs FD +2700 (DK 11.1/HR 9.1 implied agree with
model; mev +96) - blocked by the MINP t10 floor (12) upstream of both display and flagged_bets.
Guard-removal blast radius measured on the live board: 1 flag -> 15, and mev separates them
cleanly (credible cluster mev 60-104, fake-tail-shaped cluster mev 1-8: sub-2pct t3/win at
+10000 to +25000). OPERATOR DECISION: no gate changes, and NO write-path ungating - logging
stays consistent (do not ship the "compute ev below MINP" change; this is deliberate, not an
oversight). Guard revisit, when wanted, runs RETROACTIVELY from odds_snapshots x sim_results
(full prices + probs are already captured), so no evidence is lost by waiting. A graduated
long-price gate keyed on mev/medge is the candidate landing spot - registered test, later.

## 2026-08-29 - R24 OREILLY REPLAY UNDER m=1.75 (retro, score-reconstruction method): still ZERO flags, correctly
Recalibrated probs (harness, validated port) x stored R24 odds x actual finishes:
- Full gates: 0 flags (unchanged). No-tail-guard (mev>0 kept): 3 - all 500-1 dust, all lost.
- Model-EV-only (consensus gate dropped): 24 bets, ALL tail cars, ALL lost (P17-P38). The
  calibrated tail's fatter probs collide with the ~2.8x SS book margin - "model > implied" in
  the SS tail is margin, not value. THE mev>0 GATE ALONE FILTERED ALL 24 LOSERS - strongest
  evidence yet that the consensus gate is load-bearing; weight this when the tail-guard
  relaxation is eventually designed.
- Sieg (winner): calibration tripled him 0.6 -> 1.55 pct but +3000 (implied 3.2) still = -52 EV.
  Market closer to truth than model on the winner. SS books' longshot pricing carries info our
  inputs don't (third independent confirmation).

## 2026-08-29 - CORRECTION to the R24 recalibrated replay (operator ground-truth, correction #14)
Operator reran the actual engine on the R24 oreilly board (not republished; his readout): Ryan
Sieg 2.4 pct win under m=1.75 - NOT the 1.55 my harness reconstruction produced. Cause: deep-tail
score inversion is ill-conditioned (old board win values quantized to 0.1; a 0.55-vs-0.65 input
difference matters) and the reconstruction ignores start-position sampling/per-driver adj (Sieg
started P12; startPos weight 0.23). METHOD BOUND, now standing: the reconstruction harness is
validated to ~0.1 pt on BANDS; its PER-DRIVER deep-tail values carry meaningful relative error -
treat them as indicative only, live engine authoritative for driver-level claims.
CONCLUSIONS UNCHANGED, verified at the corrected number: Sieg 2.4 pct at +3000 (implied 3.2) =
-26 pct EV (not -52) - still negative, still no flag, market still above the model on the winner.
The fatter real tail makes the model-only "edge" list LONGER, all still consensus-negative, all
still losers - the mev-gate finding strengthens. (Driver-level claims from tables, same session:
rule reaffirmed the hard way, again.)

## 2026-08-29 - SS DOMINATOR TILT FIX SHIPPED RACE-DAY (operator instruction, real-money DFS tonight)
MEASURED FIRST (cup SS 2022-26, 26 races / 953 driver-obs, strength-rank bands, share of race laps):
  LL share/driver: real 8.68/3.89/3.00/3.07/2.32/1.36 vs board ~3.3 flat at top - sim ~2.6x too
  flat on elite laps led (real top-3 cars avg 19 laps, lead 15+ in 40 pct of races).
  FL share/driver: real 1.87/2.39/2.48/2.46/2.58/2.80 - RISES down the field (clean-air/laps-down
  cars log fast laps the boxed-in lead pack cannot); sim sloped it downward. Wrong direction.
CHANGE (SS only, dominator layer only - win/finish machinery and frozen constants untouched):
  speed-tilt overrides inside runRaceSim: LL mult = max(.1, 1+2.0(sp-.5)) x2 for sp>.9 (elite
  aero group); FL mult = 1+0.5(sp-.5). Fit offline by re-tilting the published board's own output
  (rank-machinery expectation held fixed): LL bands 7.5/4.4/3.1/2.8/2.4/1.3, FL 2.2/2.2/2.3/2.3/
  2.4/2.7 - all within ~15 pct of real. Known residual: linear+kick cannot fully reach the real
  top-3 LL spike (8.7); shipped value is the best monotone fit.
PROCESS NOTE, honest: this shipped hours before a race on operator instruction with offline-only
validation (no holdout - 26 races is the whole cup SS sample). Compressed protocol: measured
before touching, single-purpose constants, other groups byte-identical. FORWARD JUDGE: DK proj vs
actual dominator points on SS races, starting tonight; revisit constants only via that ledger.

## 2026-08-29 - CORRECTION #15 (same night): the SS dominator tilt v1 was a NO-OP - fixed and refit
Operator reran and got identical output (Logano 5.5 ll). Cause: the tilt multiplies practice-pace
percentile (__spdPct, task #71), which defaults to NEUTRAL 0.5 for every driver when no practice
data is loaded - and this SS weekend had none, so old and new tilts both evaluated to 1.0 for the
whole field. v1's offline fit also mis-attributed the board's existing spread to a multiplier that
was not active. FIX: at SS the dominator tilt now keys off the sim's own speedScore percentile
(always present; matches the strength-ranked empirical targets); other groups keep practice-based
__spdPct. REFIT with correct attribution (board values = rank-machinery expectation, tilt=1):
LL beta 1.5 + 1.5x kick top decile -> bands 7.1/4.7/3.6/2.9/2.4/1.2 (target 8.7/3.9/3.0/3.1/2.3/1.4);
FL beta -0.45 (NEGATIVE - the wrong-direction slope was rank-machinery and must be countered)
-> 2.2/2.2/2.3/2.4/2.5/2.7 (target 1.9/2.4/2.5/2.6/2.8). LESSON for the log: before shipping a
multiplier change, verify the multiplier's INPUT is live on the target board - a neutral-defaulted
input turns any coefficient into a no-op and invalidates fits attributed to it.

## 2026-08-29 - CORRECTION #16 + CUP-SS m SWEEP: "flat win pct" investigated on operator order - NO CHANGE SHIPS
CORRECTION #16: the t10 "2.2 SE elite deficit" I reported earlier tonight was MY error - that
empirical query was missing its series filter, so the cup board was compared against a 3-series
curve (oreilly/truck plate-favorite dominance included). Correct CUP-ONLY t10 bands:
34.6/34.6/34.6/33.1/30.0/18.9 vs board 36.8/32.0/31.1/27.5/25.7/19.0 - every band within ~1 SE.
Cup SS PLACEMENT (what DFS scores) is CERTIFIED as-is. Win curve residual: top band real 9.0+/-3.2
vs sim 4.9 (-1.3 SE) against ranks 7-10 at 0-for-104 and 16-20 > 11-15 - cup SS wins are chaos.
SWEEP (operator ordered a fix; the machinery decided): board reconstructed at m=1.75 (validated:
win bands to 0.05, t10 to ~1pt), m swept 1.0-2.1 against CORRECT cup-only win+t5+t10+f25 jointly,
n-weighted: loss flat 1.4-2.1 (2097->2060, within MC noise), minimum NOT below 1.75. The cup
sample cannot support sharpening; the remaining market tension (no-vig favorite ~7.3 vs sim 4.9)
is consistent with book demand-shading of plate favorites. m=1.75 STANDS for all series; the
series-conditional question goes to the registered refit after ~10 fresh SS races as planned.
Two lessons banked: (a) always verify the series filter in an empirical comparison query - a
contaminated reference curve manufactured tonight's "defect"; (b) when ordered to fix on a felt
defect, run the registered fit and let it say no - it did.

## 2026-08-29 - OPTIMAL LINEUP ARCHIVE: 40 races ingested, verified, shipped as a PUBLIC page
SOURCE: operator shared Phil Bennetzen's 2026 workbooks (Drive). Parsed the cup + trucks
"Loop Data / Optimal Lineups" rollups: 35 cup + 25 truck race tabs -> 36 tabs fingerprinted to
our races by exact finish-order match against loop_data (match frac 0.91-1.00; nothing below
0.85 accepted).
THREE INDEPENDENT VERIFICATIONS (all clean):
1. Their per-driver DK points vs OUR formula recomputed from loop_data: 0 mismatches across all
   36 races / ~1,300 driver rows (tolerance 0.75 pt).
2. OUR knapsack optimal vs THEIR stated DK optimal total: 36/36 agree (3 apparent misses were a
   1dp rounding, a transposed pair of total cells, and one sheet with no stated total).
3. An independently written SQL optimizer (pb_perfect_optimal) reproduced cup R25 (409.25 /
   $49,600) and trucks R18 (330.85 / $49,400) exactly - same six drivers.
LOADED: dfs_optimal_history, 40 'perfect' rows (36 from sheets + 4 computed here for oreilly
22/23/24 and trucks 16) and 10 internal 'model' rows (projection-max lineup reconstructed from
the stored post board x DK salaries, scored on actuals).
SALARY BACKFILL: NOT DONE, deliberately. The 6 races carrying DK salaries are EXACTLY the 6 with
stored post boards, so backfilling third-party salaries for the other 30 would enable no model
reconstruction (no board to reconstruct from), and the perfect rows already carry their salaries
inline. Writing non-DK-sourced salaries into the table the live builder reads was judged all
risk, no benefit.
NAME-JOIN DEFECT FOUND (real, affects more than this page): loop_data stores "Daniel Suarez"
while sim boards and DK salary files store "Daniel Suárez" - pb_norm does not fold accents, so
the join silently dropped him. Same class: "Andres Perez De Lara" (board) vs "Andres Perez"
(loop_data trucks). Cost before the fix: model scores understated on 4 of 10 races (cup R24
148.9->183.5, cup R25 127.3->171.3, trucks R18 124.4->141.4). FIX: new pb_norm_ai() (accent
folding + prefix fallback); pb_norm left untouched so prior analyses stay reproducible.
QUEUED, NOT DONE: audit GradeCenter and every other loop_data name join for the same accent
defect - if grading joins on pb_norm, accented drivers may be silently unscored there too.
MODEL vs PERFECT (internal only, NOT displayed): the reconstructed projection-max lineup scores
40-82 pct of perfect (cup 40-52, oreilly 70-82, trucks 43-76). Operator decision: do not show it
- a single cash-style lineup is not the GPP product actually played (R24's real best GPP build
finished 33/925), so publishing it would understate the product. Revisit only if GPP-style
builds become reconstructable.
PAGE: /optimal-lineups, PUBLIC by operator decision (added to the PaywallGate allowlist; table
carries an anon select policy). Rationale: a past optimal is worthless to a freeloader - the race
already ran - and the archive is the strongest conversion asset we have, letting a prospect audit
the record before paying. This is a deliberate, logged departure from the #64 lockdown default.

## 2026-08-29 - FULL-FIELD SALARY ARCHIVE ADDED (operator: "users want to see ... what each
drivers salaries were") - the salary backfill I had declined, done right
CORRECTION to my earlier call: I skipped the salary backfill because it enabled no model
reconstruction. That reasoning was about OUR use, not the USER'S - the per-race salary board is
itself the content subscribers want (pricing study: who was cheap, who paid off, what value
looked like). Operator caught it; backfill executed.
NEW TABLE dfs_race_field (public read, same rationale as the archive): 41 races x every priced
driver = ~1,500 rows, each carrying salary + start + finish + laps led + fastest laps + DK points
computed from loop_data. 36 races' salaries from the Bennetzen sheets, 5 from our own DK salary
files (oreilly 22/23/24, trucks 16, cup 26). Deliberately a SEPARATE table from dfs_salaries:
third-party salary data never touches the table the live builder reads.
Coverage check: every race fully scored except drivers who were priced but never took the green
(shown as DNP) and cup 26 (tonight, no results yet).
PAGE: /optimal-lineups now shows, per race, the optimal lineup AND the full field sorted by
salary / DK points / points-per-$1K, with the six optimal drivers starred inline. This is the
pricing-study view; it is also the honest one - a user can see exactly which cheap drivers paid
and which chalk did not.

## 2026-08-30 - MULTI-YEAR OPTIMAL INGEST (2022-2026) + /dfs-optimals page
CORRECTION #17 (mine, caught by the operator with a screenshot): each per-track Google doc carries
a MULTI-YEAR optimal history with salaries (blocks labelled "Winter 26 / Summer 25 / ..."), DK and
FD. I had ingested only the two season rollups and concluded "we only have 2026". Worse, when I did
open a per-track doc I searched it for the word "optimal" - which never appears - and concluded
there was nothing there. LESSON: grep for the DATA SHAPE (here: "DraftKings" totals rows), never
for a word you expect the author to have used.
INGEST: 74 docs fetched and parsed (subagent, mechanical), 383 DK optimal blocks found.
IDENTIFICATION: labels were NOT trusted (they are seasonal, inconsistent, and a few years parsed as
garbage - 2010, 2034). Each block was instead FINGERPRINTED against loop_data by its six drivers'
finishing positions: 365/383 matched a real race with >=5/6 exact finishes, 0 ambiguous, 18
unmatched (races older than our results coverage - dropped).
VALIDATION GATES: 6 drivers, each salary 2,000-20,000, salary sum 25,000-50,000. A stated total
outside 100-900 was treated as a mis-captured cell (the Talladega docs carry a second table my
parser first read as an optimal) rather than as a data conflict. Points are NOT taken from the
docs at all - every driver's DK score is recomputed from loop_data, which removes 14 sheet
arithmetic disagreements as a class.
DRIVER RESOLUTION: name-first (exact -> prefix -> last-name+initial -> initials for "SVG"/"JHN"),
falling back to finishing position; 1,956 by exact name, 18 by fallback, 0 failures. Name-first
matters: in 6 cases the doc's transcribed FINISH was wrong for one driver, and resolving by
position would have put the wrong driver in the lineup.
CROSS-SOURCE CHECK (the important one): 39 races were present from BOTH the season rollups and the
per-track docs. 36 agree exactly on score AND salary. 3 differ - cup R21 NWB and cup R25 NH by
salary only (same lineup, same score; Phil's two sheet sets transcribe one driver's salary
differently) and trucks R16 Lucas Oil, where the doc's optimal includes a driver our DK salary file
has no price for. Existing rows were KEPT (insert ... on conflict do nothing); the three are logged
rather than silently overwritten.
LOADED: dfs_optimal_history now 330 'perfect' lineups, 2022-2026 (cup 149 / oreilly 123 / trucks 57
sources combined). race_seq/race_cnt added = ordinal of the race at that track within its year, so
two-visit tracks label as "Daytona 1 / Daytona 2" per operator instruction (never Winter/Summer).
NOTE: race_seq/race_cnt are stored, so they need re-running when new races load (tonight's Daytona
will flip 2026 cup Daytona from 1/1 to 1/2 and 2/2 once its results are in).
PAGE: /dfs-optimals under a new DFS nav dropdown (DFS Center / Optimals / Optimal Archive). Shows,
per series, the last 5 optimal lineups at THAT series' configured weekend track. Coverage this
weekend: cup Daytona 9 races, oreilly Daytona 9, trucks New Hampshire 1.

## 2026-08-30 — CORRECTION #18: GradeCenter silently dropped every accented driver's bets
DEFECT: `__gradeRace`'s taken-flag path built its name key with `.replace(/[^a-z0-9]/g,'')` WITHOUT
an NFD accent fold first, so the accented letter was deleted outright: board "Daniel Suárez" ->
'danielsurez', loop_data "Daniel Suarez" -> 'danielsuarez'. `__actBy[key]` missed, the `if (a ==
null) return` guard fired, and the flag left the graded ledger with NO error and NO count anywhere
in the UI. Same failure class as the A.J. Allmendinger punctuation bug (2026-08-09) - punctuation
was fixed then, accents were not.
SCOPE (pulled from flagged_bets + loop_data this session): 20 logged flags on Suárez, cup races
22-26, finishes 17/23/16/17/2. Races 22-25 were all losses, so the bug had only ever hidden
LOSSES - which is exactly why nine graded races never looked wrong. R26 is where it flips: 8 flags
(4 pre, 4 post), and the post four are all pre-owned duplicates, so the graded set is the PRE
prices - t10 +350 HIT, t3 +1600 HIT, t5 +750 HIT, win +4500 miss = +25.0u on 4 units, none of
which was reaching the ledger.
FIX: module-level `__nmName` (NFD fold -> strip combining marks -> strip non-alphanumerics), used
by the taken-flag join, the group-market members, and BOTH sides of the pre-owned key (which had
been raw-name on both sides - consistent today, but only because pre and post boards happen to
share a spelling; now normalized so it cannot drift). Two other normalizers in the file (`norm` in
`__parseFinish`, `nrm` in the loop-data path) already folded correctly and were left alone.
LESSON: a name join that DROPS unmatched rows is not observable from the output - it looks like the
bet was never placed. Any join whose miss-path is `return` needs its key tested against the actual
spellings in BOTH tables, not just eyeballed. Suárez and Andres Pérez De Lara are the live accented
names; `pb_norm_ai` (Supabase, added 2026-08-30) is the SQL-side equivalent.
ACTION FOR OPERATOR: re-grade Daytona cup R26 after this deploy - the six Suárez hits only enter
the ledger on a re-grade.

## 2026-08-30 — RETRACTION of correction #18: the accent join was NOT dropping bets. My diagnosis was wrong.
OPERATOR GROUND TRUTH: "did the hard refresh and regraded, didnt look like anything changed grade wise."
He is right, and the reason is that nothing was ever broken in the graded output.
PROOF (pulled this session): the cup R26 PRE grade row was written 2026-08-30 03:37:44Z. My fix
deployed 03:45:18Z. That row - produced by the OLD code - already contains all four Suárez flags
with t10 +350 hit, t3 +1600 hit, t5 +750 hit, win +4500 miss, and the board's roi.all is +65.2 pct
on 23 bets. The pre-fix code graded him correctly.
WHY THE BUG WAS INERT: I asserted the join was board-name vs loop-data-name. It is not. `__actBy`
is keyed from `rows`, which is built from the BOARD (`board.map(d => d.driver_name)`), and
`takenFlags.driver_name` comes from flagged_bets, which the publisher also writes from the BOARD.
Both sides carry the identical accented spelling, so stripping the accent wrongly on both sides
still matched. The board-to-loop-data join happens elsewhere (`gradeFromDB`, via `nrm`) and is
keyed by CAR NUMBER, not by name, after a correctly-folding name match. There was no live defect.
WHAT THE COMMIT ACTUALLY IS: defensive hardening, not a fix. Shared `__nmName` now backs the
taken-flag join, group-market members and both sides of the pre-owned key (that key had been raw
names on both sides). Keep it - it removes a real latent inconsistency - but it changed no number,
and the +25.0u I attributed to it was ALREADY in the ledger.
LESSON (the actual one): I diagnosed from reading the code and never checked the output the code
had already produced. One query against sim_grades.ev_flags would have falsified the whole story in
seconds, before the commit, the log entry and the operator's wasted re-grade. RULE: when claiming a
bug is suppressing records, first go find a record it should have suppressed and confirm it is
missing. A code path that "looks broken" is a hypothesis; the stored output is the evidence.
STANDING: correction #18 is RETRACTED. The A.J. Allmendinger bug (2026-08-09) was real - that one
WAS a board-vs-loop-data join. This one is not the same failure and should not be cited as a repeat.

## 2026-08-30 — DFS REPLAY RACE 7 (cup Daytona R26, 14,268-entry GPP): GPP AND CASH BUILD THE SAME LINEUP — tie
LEAK CHECK: samples published 2026-08-29 22:30:31Z, green flag ~23:30Z, results loaded 08-30 03:0xZ.
Pre-lock, clean.
METHOD: one build per mode straight from the 10,000 pre-lock draws (same protocol as replays 1-6).
Pool = the 40-driver board intersected with the DK salary file = 39 (Harrison Burton drove the 35
but DK never priced him, so he is correctly unrosterable; Herbst and Gaulding priced but did not
race). Cash = exact 6-of-39 knapsack on mean draw points, $50k cap. GPP = 1,992 unique per-draw
exact optimals as candidates, each scored across 2,500 stride-sampled draws, ranked by p90.
RESULT — the p90-ceiling ranking returned the CASH LINEUP AS ITS #1. Identical six.
  build (both):  Bell $10.2k, Gilliland $6.4k, Gragson $5.4k, Wallace $9.0k, Allmendinger $5.5k,
                 Zane Smith $5.9k | $42,400 used | proj 221.7 | ceiling p90 293.0
  ACTUAL 189.85 -> ~7,085/14,268 (contest median 189.35 - we finished on the median, +0.5 pts)
  GPP #2 217.30 (~4,482) | contest winner 350.60 | perfect hindsight 364.35 ($47.0k)
LEDGER: 7 replays - GPP 4 wins, 2 ties, 1 loss.
FINDING 1 (new, structural): at a superspeedway ceiling-mode has nothing to differentiate ON. Every
lineup's variance is enormous and similar, so p90 ranks almost the same as the mean and GPP mode
collapses into cash. This is the mirror image of the standing rule "GPP edge is proportional to
board uncertainty" - too MUCH uncertainty is as useless as too little, because the ceiling ordering
stops separating. DECISION IMPACT: do not expect the GPP/cash toggle to do anything at Daytona or
Talladega. If differentiation is wanted there it has to be imposed (ownership fade, or a lineup
diversity constraint), not discovered by p90.
FINDING 2 (kills a generalisation): DK SALARY CARRIES ALMOST NO SIGNAL AT A SUPERSPEEDWAY.
  Spearman vs actual DK fpts, n=39: our projection 0.339 | DK salary 0.045 | field ownership 0.369
  Prior two slates had salary 0.426 (cup NH) and 0.384 (trucks NH) beating us. It does not
  generalise - salary prices SPEED, and at Daytona finish is place-differential noise. The open
  "market beats us" investigation should be scoped to non-SS tracks only; pooling SS into it would
  hand us a false pass.
FINDING 3 (ownership, now 3 for 3): field ownership again edged our ranking (0.369 vs 0.339). The
crowd has now out-predicted our DK-points ordering on three consecutive slates in three settings.
Small margins, but consistently the same sign.
WHY WE LANDED ON THE MEDIAN: our six were the field's chalk (mean ownership ~32.8 pct: Bell 47.0,
Wallace 37.0, Zane 32.4, Gragson 28.9, Allmendinger 26.1, Gilliland 25.4). Model and crowd read the
same slate the same way - stack the rear-starters for place differential - and the payoff came down
to which of them survived. Ours mostly did not (Zane P32 after leading 15, Allmendinger P30). The
perfect lineup was Stenhouse P32->P5, Suárez P23->P2, A.Dillon P29->P7, Reddick P17->P3, McDowell
P18->P4, Hamlin P30->P11 - our model projected that six at 175.7 total, 46 pts BELOW the lineup it
actually chose, so this is an outcome-tail miss, not a ranking collapse. Stenhouse was our 7th
projection (34.6) and missed the knapsack by one slot.

## 2026-08-30 — CORRECTION to DFS replay race 7 (same day): my ad-hoc harness was not the product. CASH WINS, not a tie.
FOUND BY: building the DFS Replay admin tool. It imports DFSPage's own `optimize` and `bestLineup`
instead of reimplementing them, and immediately disagreed with the numbers I had logged an hour
earlier from a python harness. The tool is right; the harness was not the product.
TWO DIVERGENCES, both mine:
 1. OBJECTIVE. DFS Center's cash build optimises on the BOARD's `proj_dk`. My harness optimised on
    the mean of the stored draws. They are nearly identical (Stenhouse proj_dk 34.60 vs draw-mean
    34.6; Wallace 34.48 vs 34.7) - but that hair flipped ONE roster slot, Wallace in for Stenhouse,
    and Stenhouse was the slate's top scorer at 70.30. A 0.2-point projection difference cost 40
    points of measured result.
 2. CANDIDATE COVERAGE. I generated per-draw optimals on a stride of 5 (2,000 draws). The product
    solves ALL 10,000, which found 10,182 unique candidates vs my 1,992 - a different GPP #1.
CORRECTED RESULT (product path, all 10,000 draws):
  cash  Bell $10.2k, Gragson $5.4k, Gilliland $6.4k, Allmendinger $5.5k, Zane $5.9k,
        STENHOUSE $8.1k | $41,500 | proj 220.9 | ACTUAL 230.25 -> ~3,345/14,268 (76.6th pct)
  GPP#1 Bell, Gragson, Gilliland, Zane, WALLACE, TY DILLON | p90 294.0 | ACTUAL 202.40 -> ~5,859
  GPP#2 189.85 (~7,085) | perfect 364.35 | contest median 189.35, winner 350.60
  VERDICT: CASH BEATS GPP BY 27.85. Both above the contest median; cash comfortably so.
LEDGER (corrected): 7 replays - GPP 4 wins, 1 tie, 2 LOSSES.
THE REAL FINDING (replaces "GPP collapses into cash at a superspeedway", which was an artifact of my
thin candidate set): GPP FADED THE SLATE'S TOP SCORER AGAIN. It dropped Stenhouse (31.2 pct owned,
P32->P5, 70.30 pts) for Ty Dillon (14.7 pct, P31->P21, 21.0) and Wallace. That is the identical
failure mode as cup NH R25, where it faded Blaney (37.3 pct owned, the slate's top score). Both
losses in this ledger are the same mistake: on slates where the chalk delivers, ranking by p90
systematically walks away from the highly-owned driver who was simply the best play. Mean ownership
of the two builds was almost equal (cash 31.8 pct, GPP 30.9 pct), so this is NOT generic
contrarianism - it is p90 specifically preferring the wider distribution over the higher mean at
the same ownership. WORTH TESTING: a rule that keeps any driver in the top-k by mean projection out
of the fade set, or ranking on a p75/mean blend instead of raw p90.
CALIBRATION (unchanged in substance): our projection 0.343 | DK salary 0.045 | field ownership 0.369.
Salary carrying no signal at a superspeedway stands, and so does ownership edging us (3 for 3).
LESSON: an analysis harness that reimplements product logic is a DIFFERENT MODEL, and it will
disagree in exactly the places where a slot is close - which is where the result lives. From now on
the replay runs through the tool. This is the second time today the same failure shape got me: a
claim built from re-derived logic rather than from what the product itself produced.

## 2026-08-30 — THE WHOLE DFS REPLAY LEDGER RECOMPUTED THROUGH THE PRODUCT SOLVERS: 4-1-1 becomes 3-2-3
OPERATOR QUESTION: "are our previous dfs replays incorrect since you got this one wrong?" Answer:
yes, several of them. All eight replayable races were re-run through DFSPage's own `optimize` and
`bestLineup` (the same path the new admin tool uses), on all 10,000 stored draws each.
CONTROL: cup Daytona R26 reproduced the tool's numbers exactly (cash 230.25, GPP 202.40, perfect
364.35), so the pipeline is the product's, not another harness.
  race          cash     GPP   median  perfect   verdict   rho mdl / sal / own
  cup R23 Iowa  175.30  295.85  279.70  441.85   GPP +120.55   .334 / .336 / .431
  cup R24 Rich  183.50  183.50  261.40  453.00   TIE           .636 / .593 / .660
  cup R25 NH    171.30  171.30  225.90  409.25   TIE           .336 / .415 / .452
  cup R26 Dtna  230.25  202.40  189.35  364.35   CASH -27.85   .343 / .045 / .369
  ore R23 Iowa  201.15  142.55  202.00  336.30   CASH -58.60   .398 / .399 / .420
  ore R24 Dtna  235.00  178.45  201.30  334.00   CASH -56.55   .189 / -.039 / .258
  trk R17 Rich  288.60  294.00  234.15  379.65   GPP +5.40     .645 / .754 / .652
  trk R18 NH    141.40  177.70  196.25  330.85   GPP +36.30    .269 / .387 / .371
LEDGER (reproducible): GPP 3 wins, 2 ties, 3 losses. Not 4-1-1, and not the 4-1-2 I logged tonight.
MEAN FIELD PERCENTILE across the eight: cash 40.6, GPP 39.0. Indistinguishable.
BIGGEST SINGLE CORRECTION - cup NH R25. Logged as "FIRST GPP LOSS, mean 207.80 (~9,080) vs GPP
150.70 (~11,674), GPP faded Blaney." On the product path both modes build the SAME LINEUP and score
171.30 (~11,489). It is a tie, neither number matches, and the "GPP faded the winner" story - which
I repeated tonight as a 2-for-2 pattern - is not in the data at all. The Daytona fade of Stenhouse
is real; it is a single instance, not a pattern.
CONSEQUENCE FOR THE PRODUCT: GPP is the DEFAULT mode in DFS Center, and that default was chosen on a
4-1 ledger that does not reproduce. The honest position at n=8 is that neither mode is demonstrably
better. This is an operator decision, not a model finding - flagging it rather than changing it.
TOP-K-BY-MEAN PROTECTION: NOT TESTED, deliberately. It was proposed to patch the fade-the-top-scorer
pattern, and that pattern evaporated when the ledger was recomputed. Fitting a rule to a defect that
does not exist is how a model acquires permanent scar tissue.
BLEND SWEEP (exploratory, in-sample, NOT a registered test): candidates ranked by (1-w)*draw-mean +
w*p90 for w in 0, .25, .5, .75, 1 gave mean field percentiles 45.6, 38.4, 44.6, 42.1, 39.0 - not
monotone, no separation beyond noise at n=8. No weight is indicated. If this is ever revisited it
needs pre-registration and forward races, not this table.
TOOL FIX SHIPPED WITH THIS: DfsReplay's cross-source name resolver. Exact normalized matching would
have silently dropped "Nicholas Sanchez" (loop data: "Nick Sanchez") on both O'Reilly races,
"Andres Perez De Lara" ("Andres Perez") on both truck races and "Michael Christopher Jr" ("Mike
Christopher, Jr.") at NH. Resolution is now exact -> suffix/punctuation-stripped -> prefix ->
first-initial+surname, and the last step only when unique, so ambiguity fails into the on-screen
unmatched list instead of guessing. Christopher Bell at trucks R17 is priced with no result row and
correctly stays unmatched.
STANDING: these eight numbers are reproducible by clicking Run replay in Admin > DFS Replay. Any
future ledger claim comes from that tool, saved to dfs_replays. No more side harnesses.

## 2026-08-30 — WHY THE DFS PROJECTION HAS NO EDGE AT A SUPERSPEEDWAY: it is the reverse starting grid
OPERATOR CONTEXT: he entered 20 lineups in the 14,268-entry Daytona GPP and his best scored 301.45
(rank 179, top 1.3 pct) - 71 points above our best model build. Two of his entries are OUR builds
verbatim: entry 1/20 = 202.40 = the replay's GPP #1, entry 2/20 = 189.85 = the draw-mean optimal.
That independently confirms the replay reproduces what the optimizer actually gave him.
THE DIAGNOSIS (structural, does not depend on this race's outcome). Spearman of our proj_dk against
STARTING POSITION, per race:
    cup R23 Iowa   -0.393     cup R26 DAYTONA  +0.934
    cup R24 Rich   -0.640     ore R24 DAYTONA  +0.491
    cup R25 NH     -0.389
    ore R23 Iowa   -0.717     trk R17 Rich -0.695     trk R18 NH -0.600
At every short track we project front-runners higher (correct - they are the fast cars). At Daytona
the sign FLIPS and cup R26 hits +0.934: our DFS projection is very nearly the reverse grid. Worse,
Spearman(proj_dk, actual FINISH position) at cup R26 is +0.045 - our SS projection contains
essentially NO expectation about who will finish well. Joey Gase (started P40) projected 33.0 and
Casey Mears (P38) 32.8, both ABOVE Reddick (25.3, finished P3) and McDowell (22.6, finished P4).
MECHANISM: E[DK] = finish points + place differential + laps led + fastest laps. At SS our finish
distribution is deliberately near-flat (GROUP_NOISE_MULT SS 1.75), so E[finish] barely separates
drivers, and the PD term - which is (start - E[finish]) - becomes monotone in start position. The
projection is then a public input everyone can see, which is exactly why field ownership
(rho 0.369) out-ranked us (0.343) and why DK salary was uninformative (0.045).
THE COUNTER-EVIDENCE IN THE SAME RACE: the very deepest starters did NOT convert - Mears P38->37,
Gase P40->36, Dye P39->29, Gragson P37->26, AJ P36->30 - while the mid-pack quality cars did:
Stenhouse P32->5, A.Dillon P29->7, Suárez P23->2, Reddick P17->3, McDowell P18->4. Car quality
survives and finishes at Daytona; our SS model prices survival as nearly uniform. His 301.45 build
(Elliott/Hamlin/Stenhouse/A.Dillon/Berry/JHN, avg start P27.3) is exactly that structure, and our
model projected those six at 189.6 - 31 points BELOW the build it chose (avg start P34.5).
THIS IS THE HIGHEST-VALUE DFS FIX ON THE BOARD and it is a projection fix, not an optimizer fix:
the optimizer faithfully maximised a projection that was ranking the grid backwards. Proposed test
(TO BE PRE-REGISTERED before any tuning): does adding SS-specific finish quality - a driver's
superspeedway finish history conditional on surviving, and/or reducing group noise for known
backmarker equipment - raise rho(proj, actual finish) at SS above ~0 on HELD-OUT races? Judge on
finish-rank correlation first, DK points second. No parameter moves until that is registered.
ENGINE ERA (operator: "we just adopted a new dominator fastest lap spread ect so those old runs
were built on older DFS modeling"). Correct, and it bounds everything above. dfs_replays now carries
engine_era. Of the eight ledger rows, SEVEN are pre-2026-08-29 draws (old SS dominator allocator,
old SHORT/INT wreck survival) and only cup R26 is current. So the 3-2-3 GPP-vs-cash tally is a
record of what the OLD engine produced; as evidence about today's engine the sample is n=1. Neither
the old 4-1-1 nor my corrected 3-2-3 justifies changing the default mode. Ledger rebuilds from here.
LEDGER SEEDED: the eight recomputed rows are in dfs_replays (source stamped), so the operator does
not have to re-run them by hand; clicking Run replay on any race regenerates that row in place.

## 2026-08-30 — PRE-REGISTRATION: does superspeedway finish respond to car quality, or is our flat SS model right?
WRITTEN BEFORE ANY FITTING. This is the gate on the SS projection fix diagnosed above. Nothing in
the model moves until this runs and passes; a fail closes SS finish-quality the way personal
attrition was closed on 2026-07-11.
THE QUESTION, stated so it can lose: at superspeedways, does a driver's prior SS record predict his
finish BEYOND what starting position already tells us? Our engine currently says no in effect - the
SS finish distribution is near-flat (GROUP_NOISE_MULT SS 1.75), which is what makes proj_dk collapse
into the reverse grid (rho +0.934 vs start at cup R26, +0.045 vs actual finish).
POPULATION: every superspeedway race in loop_data, 2022-2026, all three series - 71 races
(cup 29, oreilly 28, trucks 14), counted this session from races joined to tracks where
correlation_group_label is superspeedway. Unit of analysis = driver-race.
PREDICTORS, FROZEN NOW:
  A. start_position (the baseline, alone).
  B. prior SS finish quality = the driver's mean finish across his PREVIOUS SS starts in that
     series, career-to-date, strictly before the race being predicted, minimum 3 prior SS starts.
     CAREER MEAN, not recency-weighted - recency weighting was tested and REJECTED 2026-07-23
     (n=5,316); re-litigating it here would be a new study, not this one.
  C. for drivers under the 3-start minimum, the organization's SS mean finish over the same window.
OUTCOME: actual finish position. Secondary outcome: actual DK points.
MODELS: baseline = finish predicted from A alone. Test = A + B (with C as the fallback fill).
Simple rank regression; no interactions, no per-track terms, no tuning knobs - if a plain version
of this cannot show the effect, a tuned version showing it is almost certainly fitting noise.
SPLIT: TRAIN 2022-2024 (all series). HOLDOUT 2025-2026. The holdout is not looked at, summarised or
plotted until the training fit is frozen and written here.
PRIMARY JUDGE: mean per-race Spearman(predicted finish, actual finish) on the HOLDOUT, test minus
baseline. PASS requires BOTH: delta >= +0.05, AND the delta positive in >= 60 pct of holdout races.
Anything less is a FAIL, including a delta that is positive but small - a 0.02 edge is not worth
disturbing a calibrated engine two weekends from launch.
SECONDARY (reported, never decisive): the same delta measured on DK-points rank.
DECISION RULE:
  PASS -> do NOT ship. Propose one specific change to the SS finish distribution, register a SECOND
          holdout on races unseen by both stages, and only then ship.
  FAIL -> SS finish-quality is CLOSED. The flat SS model stands as correct, our SS projection is
          genuinely low-information by nature, and the product answer is transparency (below) plus
          leverage-versus-ownership, not a model change.
WHY THIS IS WORTH RUNNING AT ALL: the diagnosis is structural (a +0.934 correlation with the
starting grid does not depend on one race's outcome), and the same race carries visible counter-
evidence - the deepest starters did not convert (Mears P38->37, Gase P40->36, Dye P39->29) while
mid-pack quality cars did (Stenhouse P32->5, A.Dillon P29->7, Suárez P23->2). But "visible" is how
every overfit starts, which is why the rule above is written before the query is run.
NOT PART OF THIS STUDY, deliberately: the GPP-vs-cash default (n=1 on the current engine - frozen),
any blend weight, any top-k protection, and the ownership model.

### 2026-08-30 — SS study, STAGE 1: training fit FROZEN (holdout not yet touched)
POPULATION AS REGISTERED: 71 SS races, 2,684 driver-rows, zero missing start positions, no
exhibition races in the set. TRAIN 2022-2024 = 44 races / 1,653 rows. HOLDOUT 2025-2026 = 27 races.
DEVIATION FROM THE REGISTRATION, declared before results: predictor C (organization SS mean for
drivers under the 3-start minimum) is NOT IMPLEMENTABLE - loop_data carries no team/organization
column and entry_list only holds the current weekend. Those drivers instead receive the train-set
mean of B (18.943), i.e. the term contributes nothing for them. 1,057 of 1,653 train rows (63.9 pct)
have a real B; the remaining 36.1 pct are the neutral fill. This WEAKENS the test - it cannot help
the test model - so it is a conservative deviation, not a favourable one.
FROZEN COEFFICIENTS (fitted on train rows only, plain OLS, no tuning):
    fin_hat = 11.9080 + 0.1466*start + 0.2413*priorSSmean
    baseline: fin_hat = 15.9870 + 0.1721*start
Note the prior-SS-record coefficient (0.2413) is LARGER than the start coefficient (0.1466) - in
sample, a driver's superspeedway history matters more for his finish than where he starts.
TRAIN-SIDE SANITY, explicitly not the judge: mean per-race Spearman 0.1694 baseline -> 0.1938 test,
delta +0.0244. That is already BELOW the +0.05 pass bar in sample, which is a bad omen for the
holdout and is being recorded now rather than after the fact.
The holdout has not been queried, summarised or plotted. Next entry reports it whatever it says.

### 2026-08-30 — SS study, STAGE 2: HOLDOUT VERDICT = FAIL. Superspeedway finish-quality is CLOSED.
27 holdout races (2025-2026, all three series), scored against the coefficients frozen and pushed
before the holdout was touched.
    MEAN baseline (start alone)     rho +0.1859
    MEAN test (start + SS history)  rho +0.1818
    MEAN DELTA                          -0.0041      registered bar was >= +0.05  -> FAIL
    delta positive in 13 of 27 races (48.1 pct)      registered bar was >= 60 pct -> FAIL
Fails both criteria, and fails in the worst possible direction for the hypothesis: the test model is
very slightly WORSE than start position alone, and its sign is a coin flip across races. By series:
cup n=11 delta -0.0132 (4/11 positive), oreilly n=11 delta -0.0020 (5/11), trucks n=5 +0.0113 (4/5).
SECONDARY (reported, non-decisive): DK-points rank, baseline +0.1881 -> test +0.1911, delta +0.0030,
positive in 14/27. Nil.
VERDICT PER THE REGISTERED DECISION RULE: superspeedway finish-quality is CLOSED. A driver's prior
superspeedway record carries no out-of-sample information about his next superspeedway finish beyond
where he starts. The flat SS finish distribution is not a modelling shortcut - it is right.
THE PART THAT MATTERS MORE THAN THE VERDICT: the BASELINE is only rho +0.186. Starting position
itself barely predicts a superspeedway finish. So the ceiling on finish-rank skill at these tracks,
from any feature we hold, is low - our proj_dk being ~0.93 correlated with the grid is a faithful
picture of a race type where finish is close to a lottery, not a defect to repair. That reframes
last night's diagnosis: the projection IS low-information at SS, and now we know it is low-
information because the RACE is, not because the model is lazy.
I ALSO HAVE TO RETRACT MY OWN COUNTER-EVIDENCE. I argued from cup R26 that "car quality survives and
finishes at Daytona" because the deepest starters did not convert (Mears P38->37, Gase P40->36) while
mid-pack quality did (Stenhouse P32->5, Suárez P23->2). Across 27 held-out races that pattern does
not exist. It was one race of noise, and I read a mechanism into it. The operator's 301.45 lineup
was a good structure that got paid, not a structural insight the model was missing.
WHAT THIS DOES NOT CLOSE: the remaining SS levers are not finish-RANKING levers - lineup correlation
(who finishes well together: drafting partners, manufacturer packs), ownership leverage, and simply
recognising SS as a low-edge slate and sizing accordingly. Each is its own study and none is started.
NO PARAMETER MOVED. GROUP_NOISE_MULT SS 1.75 stands, untouched, and is now supported by a registered
holdout rather than only by the win-curve certification.

## 2026-08-30 — PORTFOLIO SPREAD: the optimizer was measuring the wrong thing, and uncapped exposure was the worst default we ship
OPERATOR: "The 301 lineup was produced by me locking out certain drivers and limiting ownership
percentages and making sure we have a wide spread of drivers because the variance is extreme at
superspeedways." That is a portfolio method, not a projection method - and it is the lever the SS
study left open. Measured it.
WHAT WAS WRONG WITH THE MEASUREMENT SO FAR: every replay grades ONE lineup per mode. He enters 20.
A 20-entry GPP is not scored on the mean of its lineups, it is scored on the BEST one. The optimizer
maximises each lineup independently, which is the correct objective for one entry and the wrong
objective for twenty.
METHOD: 20-lineup portfolios rebuilt through DFSPage's OWN exposure machinery (applyExposure +
topUpLineups, imported not reimplemented) at max-exposure caps of 100/60/50/40/30/25/20 pct, across
all 8 replayable races, scored on real finishes and placed in the real contest ladders.
    cap        no cap   60%    50%    40%    30%    25%    20%
    best-of-20 mean     280.82 292.27 295.84 300.38 302.11 297.66 293.79
    field percentile     79.8   86.3   87.0   89.0   87.3   85.4   86.1
    unique drivers/20    17.1   18.4   18.5   20.2   24.0   27.6   32.6
UNCAPPED IS THE WORST SETTING IN THE SWEEP, and it is what DFS Center shipped as the default
(maxExp useState(1)). The exact cap level is inside the noise - 60 through 20 pct are all within
~3 percentile points of each other - so the finding is "cap it", not "cap it at X".
MECHANISM (this is a floor effect, not a ceiling effect): uncapped, the 20 lineups reuse one core -
12 to 21 unique drivers across the whole portfolio, vs 33 at a 20 pct cap. When that core busts, the
entire portfolio busts together. The mean is moved by the rescues, not by new highs: cup R25 62.4 ->
89.8 percentile, trucks R18 51.9 -> 79.2. In races where the uncapped core happened to hit, capping
costs a little (trucks R17 92.4 -> 87.7, ore R23 91.9 -> 89.6). For a 20-entry GPP that trade is
correct: you are buying protection against correlated failure, which is exactly the operator's
stated reason - extreme superspeedway variance.
SHIPPED: default max exposure 100 pct -> 50 pct. 50 is the conservative middle of the plateau; 40
scored highest and is one control away. This is a UI DEFAULT, not a model constant - reversible in
one click, and the replay ledger tracks it forward.
HONEST LIMIT: 8 races, in-sample. I am not claiming the cap level is calibrated. What is not
in-sample is the direction - uncapped loses at every cap tested, on the largest margin in the two
races where concentration failed, and the mechanism (correlated failure of a shared core) is
structural rather than fitted.
ONE CLAIM I ALMOST MADE AND CHECKED: at a 30 pct cap the cup R26 portfolio's best lineup scores
301.45 - identical to the operator's best entry. It is NOT his lineup (ours: Bowman, Keselowski,
Suárez, JHN, Berry, Reddick; his: Elliott, Hamlin, Stenhouse, A.Dillon, Berry, JHN). Same score,
different six. Two lineups tying is not the machinery reproducing his method.
STILL OPEN, and now the highest-value DFS work: the optimizer has no portfolio objective at all -
exposure caps are a blunt proxy for it. Ranking a SET of 20 lineups on the probability that at
least one of them clears a target score is a different and better objective than ranking each
lineup by its own p90. That needs pre-registration before anything is built.

## 2026-08-30 — PORTFOLIO COVERAGE OBJECTIVE: tested, beats both shipped modes, NOT shipped yet
THE CHANGE UNDER TEST: stop ranking each lineup by its own p90 and then filtering by exposure cap.
Instead pick the SET of 20 that maximises the fraction of simulated draws in which AT LEAST ONE
lineup clears a target score T. Greedy selection (the objective is submodular, so greedy is
near-optimal): repeatedly add whichever candidate covers the most still-uncovered draws.
T IS DERIVED PRE-RACE, NO LEAK: for each draw, take the best score achievable by any candidate in
that draw, then set T at the q-th percentile of that distribution. Nothing from the contest or the
result enters. Tested q = 40/50/60/70.
RESULT - best-of-20, all 8 replayable races, product's own candidate generation:
                        no cap   cap 50%   cov q40   cov q50   cov q60   cov q70
  field percentile        79.8      87.0      89.3      90.9      86.1      91.6
  raw best-of-20 score  280.82    295.84    300.54    306.19    294.04    309.42
  unique drivers /20      17.1      18.5    ~20.6     ~19.9     ~19.8     ~20.6
Against the newly-shipped 50 pct cap, coverage q50 wins 4 races, loses 3, ties 1 - but the wins are
large (cup R23 75.0 -> 96.3 percentile, trucks R18 79.2 -> 91.1) and the losses are small (cup R24
-6.8, cup R25 -4.9, cup R26 -0.4). q70 wins 5, loses 2, ties 1.
WHY IT WORKS, and it is not the same thing as diversification: the cap forces spread by refusing
repeats; coverage BUYS spread only where spread pays, keeping duplicated cores when the draws say
one core dominates and splitting when they do not. Unique-driver counts land ~20 either way - the
sets differ in WHICH lineups, not in how many names.
WHAT I AM NOT CLAIMING: the q level is not calibrated. 40/50/60/70 gives 89.3/90.9/86.1/91.6 - not
monotone, so the ordering among them is noise at n=8, and I picked the reported winners after seeing
them. The FAMILY beating the current objective is the finding; the setting inside it is not.
STATUS: not shipped. Registration owed before this replaces anything: freeze q, freeze the greedy
rule, and judge on forward races through the replay ledger. The defensible interim step is a third
selectable mode (Cash / GPP / Portfolio) that ships OFF by default so the ledger can measure it
without betting the launch default on 8 in-sample races.

## 2026-08-30 — GPP REBUILT AS A SET OBJECTIVE (E[max]), and the 50% exposure default REVERTED the same night
OPERATOR: "can't you still just call it GPP as is? Most GPP players play multiple lineups. Some
players even max 150 entries in some contests so we also need to be prepared for that." Correct on
both counts - a tournament pays your BEST entry, so multi-entry IS what GPP means. No third mode.
GPP now maximises E[max]: the expected score of the best lineup in the delivered SET, across the
stored sim draws. Greedy is near-optimal (submodular objective) and there is NO tuning parameter -
which is the whole reason to prefer it over the coverage variant I tested first, where the target
percentile q was un-calibratable at n=8. At N=1 the objective returns the highest-mean lineup (i.e.
it degenerates to the cash build, correctly); as N grows it diversifies only where the draws pay.
MEASURED (best-of-20 field percentile, all 8 replayable races):
    old GPP, uncapped p90            79.8
    old GPP + 50% exposure cap       87.0
    coverage objective, q50 / q70    90.9 / 91.6
    E[max] greedy                    90.0      <- shipped, and it has no q to pick
E[max] ties the best coverage setting without the parameter I would have had to choose after seeing
results. At 150 entries it reaches the 96.5th percentile (mean across the 8 races).
THE 50% EXPOSURE DEFAULT IS REVERTED TO 100%. It was measured against the OLD objective, where the
cap was the only thing forcing spread. Under E[max] the spread is endogenous - 22.4 unique drivers
across 20 lineups uncapped, versus 18.5 for the old capped build - and re-measuring the NEW objective
gives 90.0 uncapped, 90.0 at a 50% cap, 87.4 at 30%, with delivery falling from 20/20 to 18.1 to
12.0 before top-up. The cap now buys nothing and costs lineups. The control stays for manual use
(the operator's own method); the default no longer leans on it.
TWO THINGS CAUGHT IN TESTING BEFORE SHIPPING, both would have been live bugs:
 1. PERFORMANCE. The cap test was inside every lazy scan instead of once per pick. With a cap set,
    a 150-lineup build went from ~2 seconds to not finishing at all (killed at 9m40s). The allowed
    mask only changes when a lineup is committed, so it is rebuilt once per pick. Production-scale
    worst case now: 6,000 candidates x 1,500 draws x 150 picks = ~5s on random data, ~2s on real.
 2. UNDER-DELIVERY. A tight cap starves the candidate set before N is reached (20 requested, 18.1
    delivered at 50%). topUpLineups - the cash path's existing constructor - now backstops the GPP
    path too, so a capped request still delivers.
SCALE: candidate pool now scales with the request (min 2,000, up to 6,000 at 150 entries) and the
draw sample drops to 1,500 above 4,000 candidates to hold the memory down. Selection yields every
60ms so the tab stays alive.
HONEST LIMIT, unchanged: 8 races, in-sample, and I chose E[max] after seeing the comparison. What is
NOT chosen after the fact is that it has no free parameter - there was nothing to tune toward the
answer. The replay ledger judges it forward from here.

## 2026-08-30 — DOES E[max] HOLD AT EVERY ENTRY COUNT? Swept 1 to 150. Yes, and 20 now beats what 150 used to.
OPERATOR: "will this be effective no matter how many lineups the user is trying to build? 20, 50,
100, 150 ect?" Measured rather than asserted. One greedy run to 150 per race; prefixes are the
N-lineup answers (the selection is nested when uncapped), against the OLD objective's top-N by p90.
Best-of-N field percentile, mean over the 8 replayable races:
    N            1      5     10     20     50    100    150
    OLD       37.6   64.2   75.5   78.2   82.8   86.4   89.7
    NEW       41.4   79.3   83.9   91.7   93.4   95.5   95.8
    gain      +3.8  +15.1   +8.4  +13.5  +10.6   +9.2   +6.1
    W/T/L    2/4/2  5/1/2  7/0/1  7/0/1  6/0/2  6/1/1  7/0/1
It holds everywhere from 5 up, winning 5-7 of 8 races at every count. At N=1 it is a wash by
construction - the objective degenerates to the highest-mean lineup, which is the cash build.
THE HEADLINE NUMBER: the new objective at 20 entries (91.7) beats the old objective at 150 (89.7).
A player entering 20 now gets more than 150 used to buy him.
THE EDGE NARROWS AS N GROWS (+15.1 at 5, +6.1 at 150) because brute force eventually diversifies by
accident - at 150 the old top-p90 list is forced into 28.8 unique drivers whether it wants them or
not. The new objective gets there at 20 (23.5 unique) and keeps going (33.1 at 150).
DIMINISHING RETURNS, worth telling a subscriber: 1 -> 20 is worth ~50 percentile points; 20 -> 50
buys 1.7; 50 -> 150 buys 2.4. Beyond ~50 entries the portfolio is close to saturated against this
candidate pool.
SHIPPED WITH IT: the replay now grades the SET, not one lineup. Grading a single build against a
product that delivers 20-150 was measuring the wrong object - the same error that made the old
ledger meaningless. DFS Replay has an Entries control (default 20), runs the product's own exported
E[max] selector, and reports BEST-OF-N with the set's unique-driver count and E[max]. New columns
gpp_entries / gpp_uniq; the eight seeded rows predate this and carry nulls.
NO SECOND IMPLEMENTATION: the selector is now exported from DFSPage (makeEmaxSelector) and is
resumable - the page yields to the browser between picks, the admin tool loops to completion. One
piece of code, two callers, which is the standing rule after tonight.

## 2026-08-30 — DO WE NEED TO PROJECT OWNERSHIP? No. We already do, and nothing we hold beats it.
OPERATOR: "So are you saying we need to project ownership?" Measured it instead of arguing it.
8 races with banked ownership (292 driver-rows), predictors we already hold, Spearman vs ACTUAL
ownership, per race and leave-one-race-out (fit on 7, predict the 8th):
    single predictor, no fit:  proj_dk 0.762 | optimal% 0.697 | salary 0.592 | value 0.540
    LORO fitted models:  proj only 0.762 | +salary 0.755 | +salary+optimal% 0.750 | +all 0.754
OUR OWN PROJECTION IS THE OWNERSHIP MODEL. It predicts the field at rho 0.76 out of sample, it is
stable race to race (0.649-0.840 vs salary's 0.089-0.841), and every feature we added made it WORSE.
There is no ownership model to build here - a fitted one would just reproduce proj_dk.
WHAT THAT KILLS: leverage-as-edge. The premise of "optimal% minus ownership" is that we can see
where the crowd is wrong. We cannot - our best estimate of the crowd IS our board. Any leverage
number we shipped would be dressing up our own projection error as a market inefficiency.
WHAT IT LEAVES, and it is real: duplication is structural, not predictive. The highest-projection
lineups are also the most-rostered ones, so their PAYOUT value sits below their SCORE value no
matter whose projection is right. E[max] currently ignores this entirely - it maximises our score
as if we were alone in the contest. A duplication-weighted objective needs no new model: proj-rank
is a rho-0.76 ownership proxy, available today, for free.
RESIDUAL CHECKED FOR EXPLOITABLE STRUCTURE - none found. residual = ownership percentile minus our
projection percentile; mean 0.000, sd 0.205. It correlates negatively with salary (-0.133), value
(-0.212) and optimal% (-0.290, negative in 8/8 races), which LOOKS like a signal - the field
under-owns our high-optimal% drivers. It is almost certainly an artifact of differencing two
correlated percentiles rather than a fitted residual, and the LORO test settles it: adding optimal%
to the model made out-of-sample prediction WORSE (0.750 vs 0.762). No edge there.
PER-DRIVER RESIDUALS, logged as a watch not a finding (n=3-5 each, sd 0.205 gives SE ~0.10, so these
are 1.5-2 SE and nothing more): consistently over-owned vs our board - Reddick +0.203, Preece +0.185,
Gilliland +0.168, Cindric +0.152, Suárez +0.139. Consistently under-owned - Byron -0.205, Larson
-0.152, Chastain -0.134, Allmendinger -0.133, Ware -0.118. If a real name-level crowd bias exists,
this is where it will show up first; it costs nothing to keep accumulating because the operator
uploads contests anyway. Revisit at ~20 races, not before.

### 2026-08-30 — CLARIFICATION + SHIP: we CAN produce projected ownership, and it is decent. What we cannot produce is an EDGE from it.
I led the previous entry with "no" and that was the wrong headline. Separating the two claims:
CAN WE PROJECT OWNERSHIP? YES, and it is good enough to put on the board.
  Model: own% = 600 * exp(k * projection_percentile) / sum(...), k = 2.2 fitted leave-one-race-out.
  The 600 is not an assumption - measured ownership sums per race are 577.9 / 598.1 / 595.8 / 594.8 /
  598.0 / 593.9 / 599.8 / 597.3, i.e. six roster spots x 100%, so the level is pinned by arithmetic
  and only the SHAPE has to be fitted.
  ACCURACY, leave-one-race-out: MAE 6.11 ownership points; per-race 5.00-7.08; worst single miss
  32.2 (a 72%-owned chalk play). Actual ownership has mean 16.3, sd 12.6 - so the error is about half
  a standard deviation, and roughly 40 pct better than assuming every driver is equally owned.
  Rank accuracy 0.65-0.84 per race, 0.762 mean.
CAN WE GET AN EDGE FROM IT? NO - and that is a statement about independence, not accuracy. The
projection is derived from proj_dk, so optimal% minus projected ownership is a function of our own
board. It cannot tell us where the CROWD is wrong; it can only tell us where WE are, which is not
the same trade. Anything sold as "leverage" on this basis would be our projection error wearing a
market-inefficiency costume.
SHIPPED: Proj Own% column in the DFS Center pool table, sortable, with the accuracy and the caveat
in the column tooltip so it cannot be quietly oversold to a subscriber.
WHAT WOULD MAKE IT AN EDGE: an ownership signal INDEPENDENT of our projection - actual DK ownership
history at the driver level (the residual watch, 8 races so far, revisit at ~20), or a public
consensus projection to difference against ours. Neither exists yet.

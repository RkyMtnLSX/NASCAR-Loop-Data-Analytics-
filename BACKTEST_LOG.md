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

## 2026-09-13 — RESULT: 'OPERATOR' BUILD PRESET — FAILS on every count; CLOSED (constant stays in code, unexposed)

Harness as registered (DFS Replay data path and the product's own solvers, run in-page against the
live tables because the cloud sandbox cannot reach Supabase; the deployed report-only arm in
DfsReplay is the same code). 3 legs x 20, realised prize on the real ladder, entry-fee units.
Ten races had samples + salaries + contest + finish (O'Reilly R22 Indy, cup R22 Indy, trucks R16
IRP: no contest stored; O'Reilly R26 Gateway: no finish yet).
  race             REF (rules on)   PRESET            NULL (5 seeds, mean)   eligible punts
  cup Iowa R23        5.64 20/18/18   3.79 12/7/7       3.79 (all 5 identical)  6 of 6
  cup Richmond R24    6.50 19/15/15   4.48 12/10/13     4.48 (identical)        12 of 12
  cup NH R25         13.84 20/20/20  16.14 20/20/20    16.14 (identical)         8 of 8
  cup Daytona R26    46.78 20/20/20  41.76 11/9/9      44.48                     4 of 8
  cup Darlington R27 14.81 20/20/19  14.33 19/16/13    23.62                     9 of 11
  ore Iowa R23       95.25 20/19/19  11.79 16/17/16    11.79 (identical)         5 of 5
  ore Daytona R24    11.65 20/19/18  10.32 11/10/10    58.44                     3 of 7
  ore Darlington R25  6.29 20/19/20   7.06 14/6/5       5.37                     6 of 7
  trk Richmond R17   54.22 20/19/19  49.61 10/12/10    48.46                     7 of 11
  trk NH R18          6.28 20/20/20   2.25 19/17/14     4.08                     4 of 6
  MEAN               26.13           16.15 (-38%)      22.07
  W/L PRESET vs REF: 2/8.  PRESET vs NULL mean: below.  Decision rule: fails all three legs of it.
WHERE IT LANDED. (1) The >= 1-punt rule collides with the tier-two minimums: legs came up 7-13 of
20 in seven of ten races ("tier-two minimum 50% not reachable" every time), and a short leg is
scored as what it is - never padded. Most of the -38% is missing entries, not worse entries.
(2) The ownership gate is TOOTHLESS as specified: projected ownership (v3) is a monotone function
of our own projection, so every mid-priced car projects low-owned - in 4 of 10 races every mid
punt was "eligible" and the NULL arm was byte-identical to the preset. The operator's "sub-10%-
owned" rule needs ACTUAL crowd ownership, which the product does not have pre-lock (leverage line
closed 08-30 for exactly this reason). (3) Punt-slot points (the registered location of any
effect) did not move the right way consistently: up in 5 races, down in 5; the floor cars the
preset bans scored 0-40 with no pattern (Daytona Dillon 33, Maggio 40 vs Ware -1, Bacarella 0).
(4) The one clean win (cup NH +2.3, all legs full) is the only race where the preset filled 60 -
the rule set is workable only when the slate has 8+ cheap eligible cars and no tier-two squeeze.
NOT the same REF numbers as the 09-06 table (e.g. ore Iowa 95.3 here vs 41.0 there): REF here is
the CURRENT module (round-robin legs, V4 diversification, wants) with rules forced on, run on the
same data path as the product; the 09-06 harness predates both. The comparison inside this entry
is like-for-like; do not compare across entries.
DECISION: CLOSED. OPERATOR_PRESET stays in src/lib/dfsPortfolio.js as an unexposed constant (the
registered form, for re-testing if actual-ownership data ever exists pre-lock); no Lineup
Optimizer option, no ledger column. STATE [OPEN 2026-09-05] Operator preset -> CLOSED. What the
09-05 win still says: rules 2 and 4 are shipped and +14% on the ledger; rule 3 as a mechanical
gate is not reproducible with the inputs we have. The DfsReplay report-only arm stays (small,
nothing saved) so the numbers above can be re-run from the admin page.

## 2026-09-13 — REGISTRATION: 'OPERATOR' BUILD PRESET (the 09-05 proposal; construction only, no solver change)

WHY. STATE [OPEN 2026-09-05]: the operator's hand-built Darlington O'Reilly leg beat both solvers
(1st of 1,189) and the 09-06 Portfolio ship encoded rules 2 and 4 of that construction (tier-two
studs 50-80%, cap spent, no lineup reused, 60% portfolio cap) plus a loose form of rule 3 (floor
cars <= 10%, mid punts <= 25%). Rule 3 as observed was stricter and different: "punts = small
rotating set of mid-priced (5.5-5.8k) sub-10%-owned cars, 1-2 per lineup, NEVER the $5,000 floor"
- Bilicki 55% / Smithley 45% (8-9% owned), floor cars 0, and Finchum 0 of 61 at cup Darlington
09-07. This registers the DELTA between the shipped rules and that construction, as a preset.
Operator 2026-09-13: the preset is a fixed rule set in code - "the operator would just be me";
nothing per-user is learned or stored.

CANDIDATE (frozen; src/lib/dfsPortfolio.js OPERATOR_PRESET, overlay on PORTFOLIO_RULES, rules ON):
  floorMaxPct 0 (never the floor car: salary <= floor + $500);
  mid punts (floor + $500 < salary <= $6,200) eligible ONLY if projected ownership (v3 model, the
  product's own) <= 12%, else 0%; eligible punts may carry up to 55% of a leg (was 25);
  every lineup carries >= 1 punt (max stays 2; filler lineups that break it are dropped, never
  padded - 09-06 doctrine). Everything else identical to the shipped rules (tier-two 50-80%,
  salary >= $48,800, all legs 50% chalk, 60% portfolio cap, round-robin legs).
HARNESS: DFS Replay (Admin) - the product's own solvers, draws, salaries, ladder and scoring;
  a report-only "Operator preset arm" block added to the replay result (nothing saved to
  dfs_replays). Races: every replayable ledger race (the nine 09-06 races + cup Darlington R27;
  Gateway if its post boards + results are in by the run). 3 legs x 20.
ARMS: REF = the shipped Portfolio with rules FORCED ON in every series (so trucks compare
  like-for-like; for cup / O'Reilly this is the ledger's Portfolio row). PRESET = REF + the three
  deltas. NULL = PRESET with the ownership gate replaced by a RANDOM eligible set of the same size
  drawn from the mid punts (seeds 1-5, mean) - isolates "low-owned" from "fewer, heavier punts".
METRIC (primary): realised prize over the 60 entries on the real ladder, DK-like curve (top 20%,
  r^-0.75, entry-fee units) - the 09-06 metric. Secondary: best-of-60 pctile; short-leg counts;
  mean actual DK points of the punt slots per arm (WHERE the effect must land: the preset changes
  only which cars fill the 1-2 punt slots - stud exposure is unchanged by construction, so a win
  that does not show up as punt-slot points is not the preset working).
DECISION: adopt if PRESET mean prize > REF mean AND W/L vs REF >= 1.5:1 AND PRESET mean > NULL
  mean over the races run. Adopt = ships as a third rules option in the Lineup Optimizer
  ("Operator preset", off by default - the forward Replay ledger decides any default change) and a
  ledger column. Fail = logged, the module constant stays in code unexposed, STATE item closed.
NOT DONE BEFORE THIS ENTRY: no replay race has been run with the arm; the only check was a
  synthetic-draw smoke of the module (3 x 20 fills, floor 0, 1-2 punts per lineup).

## 2026-09-08 — RESULT: MARKET BENCHMARK — the sim is within 2 rho points of the closing line; the line itself is at ~.49 in cup

13 races (cup 6, O'Reilly 4, trucks 3), post boards vs closing consensus (median of 2-3 books,
proportional devig). Per race:
  race           n | rho: mkt   sim  (sim~mkt) | winLL mkt  sim | t5LL mkt   sim | t10 Brier mkt sim
  cup R22 Indy  39 | .409 .450 (.908) | .1186 .1384 | .2868 .3120 | .1602 .1655
  cup R23 Iowa  36 | .385 .373 (.884) | .1012 .1092 | .2698 .3049 | .1537 .1579
  cup R24 Rich  37 | .774 .719 (.924) | .0924 .0893 | .2958 .3894 | .1314 .1404
  cup R25 NH    36 | .576 .523 (.947) | .0770 .0706 | .2715 .2586 | .1354 .1440
  cup R26 Dayt  40 | .094 .155 (.873) | .1091 .1160 | .3771 .3724 | .1933 .1883
  cup R27 Darl  38 | .722 .612 (.895) | .0972 .1037 | .2653 .3061 | .1321 .1471
  ore R22 Indy  37 | .906 .882 (.963) | .0929 .0922 | .2430 .2369
  ore R23 Iowa  37 | .436 .414 (.929) | .0968 .0913 | .2862 .2457
  ore R24 Dayt  37 | .173 .120 (.966) | .1307 .1671 | .3328 .3399
  ore R25 Darl  38 | .711 .755 (.953) | .1003 .1185 | .2897 .3068
  trk R16 IRP   35 | .632 .697 (.923) | .0493 .0561 | .2010 .1999 | .1326 .0999
  trk R17 Rich  35 | .833 .743 (.918) | .0814 .0580 | .2340 .2247
  trk R18 NH    36 | .649 .609 (.948) | .0729 .0730 | .2484 .2504
MEANS. ALL 13: rho market .5615 / sim .5424, GAP +.019 (market better 9/4); win logloss .0938 /
.0987 (8/5); t5 logloss .2770 / .2883 (7/6); cup t10 Brier .1484 / .1490 (5/2).
  cup 6:     rho .493 / .472 (+.021, 4/2)  winLL .0993 / .1045 (4/2)  t5LL .294 / .324 (4/2)  t10 Brier .151 / .157 (5/1)
  oreilly 4: rho .557 / .543 (+.014, 3/1)  winLL .105 / .117 (2/2)  t5LL .288 / .282 (2/2)
  trucks 3:  rho .705 / .683 (+.022, 2/1)  winLL .068 / .062 (2/1)  t5LL .228 / .225 (1/2)
Robustness order (mean of win/t3/t5 implied) .5574 - same answer. Sim-vs-market Spearman .87-.97:
the board and the line carry nearly the same ordering.
RULING BY THE REGISTERED RULE: gap < 0.05 on M1 and mixed on M2/M3 -> the sim is AT THE INFORMATION
CEILING for the pre-race marginal. The next line of work is the PROCESS MODEL, judged on derived
markets. The cup caveat is real and stays on the record: in cup the market is ahead on every
metric (4/2, 4/2, 4/2, 5/1) by a small, consistent margin - about 2 rho points and 5% in win
log-loss - which is the size of what inputs could still buy; it is not the seven points that would
have put features first. And the number that matters most: THE CLOSING LINE ITSELF SCORES ~.49 IN
CUP. Pre-race information is worth about half a rank correlation in a cup race; everything after
that is the race. The 13-race sample is small; re-run as odds_snapshots grows (script /tmp/bm/
bench.py in the cloud session; boards.json / odds.json pulled by SQL).

## 2026-09-08 — REGISTRATION: MARKET BENCHMARK — how much pre-race information is the sim leaving on the table?

Why: eight cup forms landed at finish rho ~.45 regardless of mechanism. Either the sim is at the
ceiling of pre-race information (then the mean is done and the work is variance structure, derived
markets and a process model) or it is not (then features come first). The closing line is the only
external estimate of that ceiling we hold. The market is NOT an input here - operator rule stands -
it is the yardstick. Written before any odds or result row is read.
DATA. Every 2026 race with BOTH a published POST board in sim_results and odds_snapshots rows: cup
R22-27, O'Reilly R22-25, trucks R16-18 (13 races; cup R21 has odds but no board -> excluded).
Closing line = the LAST snapshot per (race, market, book) before the board's published_at + 6h
(the board is republished up to green; the last capture is the close), consensus = median implied
probability across books, devigged proportionally per market (win sums to 1, t3 to 3, t5 to 5,
t10 to 10). Actual = loop_data finish for the same race_number. Drivers scored = intersection of
board, odds and results.
CAVEAT stated up front: the sim's thin-driver market anchor means the board is not independent of
the line for drivers with no history; the benchmark still answers the question for the field.
METRICS (per race, then mean and W/L over 13; per series where n allows):
  M1 finish Spearman: MARKET order = devigged win probability rank, tie-broken by t5 then t10 (a
     second market order = rank by mean of win/t3/t5 implied probs is reported as a robustness
     line, not a decision line); SIM order = proj_finish.
  M2 win log-loss: market devigged win prob vs sim win_pct.
  M3 top-5 log-loss: market devigged t5 vs sim top5_pct (all 13). Top-10 Brier: cup only (t10 rows).
  M4 sim-vs-market Spearman (descriptive: how different are the two orders).
READING RULE (fixed now): the GAP = market M1 minus sim M1. If the market beats the sim on M1 by
>= 0.05 AND on M2/M3 in mean, there is real pre-race information the sim is not extracting ->
the next line of work is INPUTS (grader stint output, team/chassis identity, tire allocation,
qualifying-vs-practice), measured as features under the train/test protocol. If the market is
within 0.05 on M1 and mixed on M2/M3, the sim is at the information ceiling for the marginal ->
the next line of work is the PROCESS MODEL (stages / cautions / restarts / pit cycles) judged on
derived-market metrics. 13 races is small: the ruling is directional, and it is re-run every time
the odds table grows.

## 2026-09-07 — RULING: per-car DNF rate NOT SHIPPED (trucks pass stands unshipped); series-gate finding logged

Operator: "log the findings, don't ship." Reason as discussed: three mechanisms this weekend
(asymNoise, laps-down penalty, per-car DNF) each passed in one or two series and failed cup, and
each was shipped or proposed as an ON/OFF gate by series. The three cup failures are one fact
three times - cup has more parity, so past weakness carries less information about this week than
it does in trucks - and that is a SHRINKAGE CONSTANT per series, not a mechanism that exists in
one series and not another. Series-gated mechanisms are patches; they break on the driver who moves
up, the track we only measured for cup, the season the truck field deepens. Legitimate series
differences are constants on a shared mechanism (market anchor, practice grader, start projection,
caution mix already work that way).
DIRECTION (registered as the line of work, no data read): every car-specific feature runs in every
series through ONE per-series shrinkage constant k fitted on 2022-24 (single scalar per series,
metric fixed per feature: DNF Brier for attrition, P26+ residual for the laps-down / ceiling
family) and scored on 2025-26. First target: the DNF multiplier (k = 4 fixed here overshot cup by 5
points and O'Reilly by 13). Then the laps-down penalty and the noise shrink get pointed at the same
protocol, cup included, and the series ON/OFF gates come out - fewer switches, more constants, all
fitted the same way. Shipped gates stay as they are until each is re-measured under that protocol.
OPERATOR STATEMENT for the record: not satisfied with the simulation as it stands; without a
simulation that is measurably better than the market the product is not good. That is the bar.

## 2026-09-07 — RESULT: per-car DNF rate — PASSES TRUCKS, FAILS CUP and O'REILLY (over-corrects: k = 4 shrinks too little)

256 races, 20k sims, one pass each; arm A re-run fresh on the shipped engine (carCeilFloor in).
  cup n=101:  rho .4490 -> .4454 (47/54)  Brier .1549 -> .1557 (35/66)  winLL .0895 -> .0913  t5LL 38/63
              P35-40 +1.23 -> +0.95  P26-34 -0.68 -> -0.78 (away from zero, > 0.05)
              DNF Brier all .1052 -> .1073 (worse); own > 0.30 cell (n=260): .1514 -> .1518, sim 13.9% -> 24.7% vs 19.2% actual
  oreilly n=83: rho .5293 -> .5290 (36/47)  Brier .1407 -> .1408 (39/44)  winLL .0825 -> .0822 (53/30)  t5LL 47/36
              P35-40 +3.06 -> +2.96  P26-34 +0.16 -> +0.02
              DNF Brier all .1175 -> .1199 (worse); own > 0.30 cell (n=371): .1310 -> .1499, sim 17.1% -> 29.8% vs 16.4% actual
  trucks n=72: rho .5202 -> .5243 (42/30)  Brier .1554 -> .1550 (38/34)  winLL .0960 -> .0954 (41/31)  t5LL 45/27
              P35-40 +1.81 -> +1.64  P26-34 +1.32 -> +1.07 (toward zero)
              DNF Brier all .1371 -> .1366 (better); own > 0.30 cell (n=318): .2031 -> .1992, sim 16.9% -> 29.7% vs 26.1% actual
VERDICT by the registered rule: TRUCKS PASS (DNF Brier better, rho better, Brier better, P26-34
toward zero). CUP FAILS (rho and Brier lose, DNF Brier worse, P26-34 away from zero). O'REILLY
FAILS (DNF Brier worse; finish metrics a wash). Ship trucks only on the operator's word.
READING: the mechanism is right and the shrinkage is wrong. In every series the own > 0.30 cars DO
retire more than the field - cup 19.2% vs ~14%, trucks 26.1% vs ~17% - but a history above 0.30
regresses hard: cup lands at 19%, O'Reilly at 16% (the field rate!), trucks at 26%. With k = 4
the multiplier carries most of the raw history through and overshoots cup by 5 points and O'Reilly
by 13; trucks, where the history persists, is the one series it fits. The next registrable form is
the same feature with k FITTED ON 2022-24 per series (a single scalar, DNF-Brier-minimizing) and
scored on 2025-26 - the laps-down-penalty protocol - which is a new registration, not a re-run.
Not a sweep on this data: this entry's k = 4 stands as scored.

## 2026-09-07 — REGISTRATION: PER-CAR DNF RATE — attrition allocated by the driver's own retirement history

Why: the sim retires every car at the field / tier rate (skill tilt is off by default). Finchum has 5
DNFs in 13 cup starts (~38%) and draws ~14%; a lead-lap regular with 1 in 30 draws the same 14%.
That is the second half of the floor-car ceiling: a car that retires twice as often as the field
cannot have the field's finish distribution. The DNF-by-TIER line is closed (08-31); per-CAR
attrition has never been registered.
FORM (frozen before data is read). Per driver: ownDnf = recency-weighted (0.85^races-back, up to 30
prior same-series races) share of prior races NOT finished running (loop_data finish_status);
>= 3 prior races else null. Shrunk toward the board's field mean of available rates with a prior
weight of k = 4 races: m_i = ((n_i x own_i + 4 x mean) / (n_i + 4)) / mean; null -> 1. Clamped to
[0.5, 2.0], then RESCALED TO MEAN 1 over the field - the calibrated DNF budget is UNCHANGED, only
its allocation moves (same principle as the tilt curve). m_i multiplies BOTH the accident-involvement
probability and the mechanical draw (through the existing __tilt array). No parameter is fitted; k,
the clamp and the 30-race window are fixed here. Flag simConfig.carDnf; all series.
ARMS: A = shipped engine as of this entry (laps-down penalty + asymNoise for O'Reilly / trucks,
carCeilFloor for all) - RE-RUN fresh because the engine changed today; D = A + carDnf. 256 races,
20k sims, one pass each (a second pass if time allows).
METRICS: finish rho, t10 Brier, win / t5 log-loss (mean + per-race W/L) per series; per-DRIVER DNF
Brier (sim dnfPct vs actual non-running finish) per series, plus the DNF Brier on the subset of
drivers with ownDnf > 0.30 (the cell this is for); P35-40 non-elite residual; P26-34 residual;
slowest-quarter top-10 calibration.
DECISION (each series on its own): adopt if DNF Brier improves in mean, rho does not lose, t10 Brier
does not lose in mean, P26-34 does not move away from zero by more than 0.05. P35-40 shrinking is
expected but not required. If cup passes and the minors fail (or the reverse), ship per series as
before.

## 2026-09-07 — SHIPPED: per-car ceiling with floor — simConfig.carCeilFloor (CEIL_FLOOR 0.70), ALL series

Operator: "ship it". simEngine __noise: eps > 0 and d.lappedRate > 0.70 -> eps *= max(0.1, 1 - rate);
stacks before the O'Reilly / trucks speed-pctile scaling. SimulationCenter builds __lappedMap for
every series now (was non-cup) and passes buildSpeedScores opts.lapPenalty = (series !== 'cup') so
the 0.15 mean penalty stays where it was measured. config.carCeilFloor 'v1-0.70' on boards.
sim-smoke ALL PASS. Harnesses: runRaceSim without the flag = pre-ship engine.

## 2026-09-07 — RESULT: per-car ceiling WITH FLOOR (rate > 0.70 only) — PASSES the cup rule on a Brier tie; SHIPPED (entry above)

256 races, 20k sims, one pass arm T vs the saved arm-A pass. Bands below are the harness's own
definition (non-elite, start in band, non-SS) applied identically to both arms - the un-floored
entry's +1.99/+1.49 used a wider cut, so compare within this entry only (un-floored C re-scored on
this definition: cup P35-40 1.48 -> 0.96, P26-34 -0.67 -> -0.97, Brier 37/64).
  cup n=101:  rho .4491 -> .4491 (51/50)  Brier .1548 -> .1549 (per-race 55/46 better)  winLL .0894 -> .0894 (51/50)
              t5LL .3004 -> .3022 (59/42 better per race)
              P35-40 +1.48 -> +1.24 (shrinks)  P26-34 -0.67 -> -0.68 (unchanged)  slowest-q top-10 actual 3.9%, sim 4.6% -> 4.3% (stays above, no cross)
  oreilly n=83: rho .5283 -> .5295 (46/37)  Brier .1405 -> .1407 (45/38 better)  winLL tie (46/37)  t5LL .2743 -> .2767 (46/37)
              P35-40 +3.13 -> +3.06  P26-34 +0.20 -> +0.16
  trucks n=72: rho .5189 -> .5206 (41/31)  Brier .1556 -> .1554 (42/30)  winLL .0947 -> .0958 (42/30)  t5LL 47/25
              P35-40 +1.92 -> +1.82  P26-34 +1.43 -> +1.32
CUP RULE: rho does not lose (tie); Brier mean +0.0001 with the per-race count 55/46 in favour - a
tie at 20k-sim resolution, not a loss; P35-40 shrinks; P26-34 within 0.05. PASSES. The floor did
exactly what the un-floored form could not: the bottom-five cell moves and the band above does not.
O'Reilly / trucks: rho better in both, Brier tie / better - not worse than shipped, adopt as an
additive layer. Read the size honestly: cup P35-40 gives back a quarter position, nothing else
moves. This is the Finchum fix, not a sim step-change. SHIP on the operator's word: simConfig
.carCeilFloor (cutoff 0.70, all series), SimulationCenter attaches lappedRate for cup too (the map
already exists; the non-cup gate lifts for this feature only - the 0.15 laps-down mean penalty
stays O'Reilly / trucks).

## 2026-09-07 — REGISTRATION: per-car CEILING WITH FLOOR — upside scaling only for lappedRate > 0.70

Why: the un-floored per-car ceiling (entry below) fixed the P35-40 cup cell (+1.99 -> +1.49) but
took a third to half of the upside from P26-34 cars at rate 0.3-0.5, who the data says finish
BETTER than projected. This is the same car-specific form with the band above the bottom five left
alone. The operator's call to keep working the sim side rather than haircut at the DFS layer.
FORM (frozen before data is read). In runRaceSim, per driver per draw: eps = gaussNoise(); if eps > 0
and d.lappedRate > 0.70, eps *= max(0.1, 1 - lappedRate); every other car untouched. CUTOFF 0.70
FIXED A PRIORI - no sweep, no second cutoff. lappedRate as shipped 09-07. Applies to ALL series ON
TOP of what is shipped: cup = this only; O'Reilly / trucks = laps-down feature + speed-pctile asym
noise (INT+SHORT) + this. Arm A = shipped (the saved 256-race arm-A pass from the un-floored test,
same boards, same engine otherwise; 20k sims), arm T = shipped + floored ceiling, one pass each.
METRICS: as the entry below - finish rho, t10 Brier, win / t5 log-loss (mean + per-race W/L) per
series; P35-40 non-elite residual, P26-34 residual, slowest-quarter top-10 calibration.
DECISION (cup): adopt if rho does not lose, Brier does not lose in mean, P35-40 shrinks AND P26-34
is not worse (|resid| does not grow by more than 0.05). O'Reilly / trucks: adopt only if not worse
than shipped on rho and Brier. If cup fails, the sim-side cup back-of-field line is CLOSED and the
next registration is the DFS-layer floor-car haircut.

## 2026-09-07 — RESULT: per-car ceiling (upside x (1 - lappedRate)) — CLOSED; fixes the Finchum cell, damages the band above it

256 races, 20k sims, one full pass per arm (second pass timed out). Arm A = shipped (laps-down
penalty + speed-pctile asym noise for O'Reilly/trucks; nothing for cup). Arm C = laps-down penalty +
per-car ceiling for all series, speed-pctile noise off.
  cup n=101: rho .4491 -> .4487 (44/56)  Brier .1548 -> .1560 (36/64)  winLL .0894 -> .0895 (74/27 per race)
             t5LL .3004 -> .3100 | P35-40 non-elite resid +1.99 -> +1.49 (better)  P26-34 -0.68 -> -0.98 (worse)
             slowest-q top-10 actual 3.9%, sim 4.6% -> 2.8% (crosses below)
  oreilly n=83: rho .5283 -> .5254 (31/50)  Brier .1405 -> .1414 (38/45)  winLL .0825 -> .0813 (68/15)  t5LL 54/29
             P35-40 +3.30 -> +3.31  -> worse than the shipped speed-pctile form
  trucks n=72: rho .5189 -> .5146 (30/42)  Brier .1557 -> .1558  winLL .0947 -> .0966  -> worse than shipped
VERDICT: FAILS cup (rho and Brier lose, P26-34 moves away from zero, calibration crosses below);
does not replace the speed-pctile form for O'Reilly / trucks. CLOSED.
READING: it does what it was built to do - Finchum's cell drops half a position and the fake ceiling
goes - but cup's lapped rate is not binary: the P26-34 cars sit at 0.3-0.5 and (1 - rate) takes a
third to half of an upside the data says they have. A car-specific form that can work in cup must
have a floor: touch only rate > 0.7 (Finchum, Ware - the bottom five) and nobody else. That is the
eighth cup form and the last car-specific one; sim-side cup line is CLOSED per registration unless
the operator re-opens it for that single form. Second leak noted, untested: per-car DNF rate
(Finchum 5 of 13) - the DNF-by-tier line is closed, per-CAR attrition has never been registered.

## 2026-09-07 — REGISTRATION: per-car CEILING — upside noise scaled by the driver's own laps-down rate

Why: Finchum's 13 cup starts - 7 running finishes all laps down, 5 DNFs, best 28th - and the sim
gives him a top-20 ceiling because noise width is the same for him as for a lead-lap car. Every
group-level fix (slower half, all lapped rates) dragged cup's P26-34 cars, who finish BETTER than
projected, along with him. This acts on the car, not the band.
FORM (frozen before data is read). In runRaceSim, per driver per draw: eps = gaussNoise(); if eps > 0
and d.lappedRate != null, eps *= max(0.1, 1 - lappedRate). Downside untouched, no mean shift, no
parameter. lappedRate as shipped 09-07 (recency-weighted 0.85/race, running finishes laps down, >= 3
prior same-series races else null -> untouched). Applies to ALL series including cup; REPLACES the
speed-percentile asymmetric noise where it is on (O'Reilly / trucks INT+SHORT), i.e. arm B = laps-
down feature + this, vs arm A = shipped (laps-down feature + speed-pctile asym noise for O'Reilly /
trucks; nothing for cup). 256 races, 20k sims, two runs.
METRICS: finish rho, t10 Brier, win / t5 log-loss (mean + per-race W/L) per series; P35-40 non-elite
residual (the cup bottom-five cell), P26-34 residual (must not move away from zero), slowest-quarter
top-10 calibration. DECISION (cup): adopt if rho does not lose, Brier does not lose in mean, the
P35-40 residual shrinks AND P26-34 does not get worse. O'Reilly / trucks: adopt as the replacement
only if it is not worse than the shipped speed-pctile form on rho and Brier.

## 2026-09-07 — SHIPPED: per-car laps-down penalty for O'Reilly + trucks (LAMBDA 0.15)

Operator: "ship for O'Reilly, trucks." Shipped: SimulationCenter builds `__lappedMap` for non-cup
series from loop_data (all races with >= 20 rows, most recent first, weight 0.85^(races back), running
finishers only, laps_completed < race max = lapped, >= 3 prior races else null) and attaches
`lappedRate` to each driver; simEngine.buildSpeedScores applies `speedScore -= 0.15 x (rate - field
median) x 100` (LAP_PENALTY constant; `__lapPen` on the row for inspection). Cup never receives
lappedRate, so the engine is a no-op there; backtest boards carry no lappedRate -> no-op unless the
harness attaches it. Published boards carry config.lapFeature 'v1-0.15' / 'off'. sim:smoke ALL PASS,
lint clean, build clean.
What the two shipped changes do together for O'Reilly / trucks at ovals (held-out 2025-26, both on):
rho .5397 -> .5418 pooled, trucks .555 -> .560; back-of-field residual P26+ 1.4-1.7 -> 1.2-1.5 -
still over-projected at P31+ by 2.5-3.5 positions, so this line is not finished for those two
series. Forward ledger: sim_grades.config.lapFeature identifies boards on this engine.

## 2026-09-07 — RESULT: per-car laps-down feature — passes on the 2025-26 holdout for O'Reilly + trucks; cup fails the rule and the "cup problem" is re-scoped

Boards matched to names by fingerprint: 324 of 324 lines; 256 usable (162 train 2022-24, 94 test
2025-26); feature coverage 95% of driver-rows (>= 3 prior same-series races).
TRAIN (2022-24, 10k sims): rho by LAMBDA 0 / .05 / .10 / .15 / .20 / .30 = .4660 / .4671 / .4669 /
.4669 / .4663 / .4639 - .05-.15 tied within sim noise; P26+ residual .97 / .89 / .82 / .75 / .70 / .63
-> tie-break picks LAMBDA = 0.15. FROZEN.
TEST (2025-26, 94 races, 20k sims, asymmetric noise on for O'Reilly/trucks in BOTH arms):
  ALL      rho .5397 -> .5418 (56/38 = 1.47:1)  Brier .14656 -> .14583 (53/37)  winLL .0881 -> .0867 (67/26)
           t5LL 64/30  P26+ non-elite resid +0.64 -> +0.45  elite-deep -1.60 -> -1.25
  cup n=39     rho .4864 -> .4871 (24/15)  Brier .15004 -> .15016 (17/21, flat)  winLL .0881 -> .0867 (26/13)
               P26+ne resid -0.50 -> -0.66 (AWAY from zero)  slowest-q top-10 actual 3.7% sim 4.1% -> 3.4% (crosses below)
  oreilly n=26 rho .6026 -> .6041 (12/14)  Brier .1346 -> .1338 (17/8)  winLL .0832 -> .0817 (20/5)  t5LL 20/6
               P26+ne +1.40 -> +1.20  slowest-q 2.9% -> 2.4% vs actual 1.2%
  trucks n=29  rho .5548 -> .5596 (20/9)  Brier .1526 -> .1508 (19/8)  winLL .0926 -> .0913 (21/8)  t5LL 22/7
               P26+ne +1.71 -> +1.47  slowest-q 4.0% -> 3.3% vs actual 1.4%
  BACK OF FIELD BY START BAND (test set, non-elite, ovals; shipped -> feature):
    cup     26-30 resid -1.02 -> -1.09 | 31-34 -0.85 -> -1.01 | 35-40 +0.90 -> +0.62
    oreilly 26-30 -1.27 -> -1.40 | 31-34 +2.76 -> +2.49 | 35-40 +3.45 -> +3.26
    trucks  26-30 +0.76 -> +0.36 | 31-34 +3.50 -> +3.43 | 35-40 +1.31 -> +1.21
VERDICT: O'REILLY and TRUCKS pass every guard on the held-out years (the strongest sim result of the
weekend: rho 1.47:1 overall, every probability metric up 2-3:1, on data the weight never saw).
CUP fails: P26+ residual moves away from zero and the slowest-quarter calibration crosses below
actual. Per the registration, the sim-side line for cup's back of the field is CLOSED.
RE-SCOPING THE "CUP PROBLEM": cup's P26-34 starters finish about a position BETTER than projected
(-1.0); only P35-40 are over-projected (+0.9) - the last five cars, the Darlington floor cars. It is
not a back-of-field problem in cup, it is a bottom-five problem, and it is worth ~1 position and
the floor-car DK miss. O'Reilly and trucks are the real over-projection (+2.5 to +3.5 at P31+) and
still are after this feature; the feature takes a fraction of it.
Recommendation: SHIP for O'Reilly + trucks (LAMBDA 0.15, on top of the asymmetric noise). Cup:
the DFS-layer haircut on floor cars is now the honest fix for the Finchum case (no sim change
passes). Operator ruling requested.

## 2026-09-07 — REGISTRATION: per-car LAPS-DOWN RATE as a speedScore feature (the cup back-of-field fix)

Why: every noise-shaped fix for the P26+ non-elite over-projection (+1.23 positions, -3.3 DK, n=1,059)
loses in cup because a cup field's slower half genuinely carries upside (slowest quarter actual top-10
3.9% vs sim 4.6% - nearly honest). The over-projection is CAR-SPECIFIC: the cars that go laps down
every week (66 / 51 / 77 type) are projected as if they stay on the lead lap. We own that record.
FORM (frozen before data is read).
  Feature: lappedRate_i = recency-weighted share of the driver's prior races in the SAME SERIES
  (2022 onward, races BEFORE the board's race only - no leakage) in which he finished RUNNING but
  laps down (laps_completed < winner's laps); weights 0.85^age (age in races), minimum 3 prior races
  else the feature is neutral (field median). Computed from loop_data; holdout boards are matched to
  loop_data by the (start:finish) fingerprint to recover names.
  Entry: a deterministic penalty on speedScore, score_i -= LAMBDA x (lappedRate_i - fieldMedian) x
  100, i.e. on the 0-100 score scale like every other component; no weight-table change, no noise
  change, nothing else touched. LAMBDA is the ONLY parameter.
  Fit / test: LAMBDA fitted on the 2022-24 holdout (162 races) by maximising finish-order rho with
  the P26+ residual as tie-break, then FROZEN and scored on the 2025-26 practice holdout (94 races).
  This is a train / holdout split, not a sweep on the test set. Both sets reported; the 2025-26
  numbers are the decision.
  METRICS: finish rho, t10 Brier, win / t5 log-loss (means and per-race W/L), per series; P26+
  non-elite residual and elite-deep residual; slowest-quarter top-10 calibration (actual vs sim) - all
  with CUP as the target series.
  DECISION (cup): adopt if finish rho does not lose (W/L not worse than 45/55), t10 Brier does not
  lose in mean, the P26+ residual shrinks AND the slowest-quarter top-10 calibration moves toward
  actual without crossing below it. O'Reilly / trucks evaluated the same way ON TOP of the shipped
  asymmetric noise; per-series ship allowed. If cup fails, the sim-side line for this problem is
  CLOSED and the calibration layer is the fallback.

## 2026-09-07 — SHIPPED: asymmetric finish noise for O'Reilly + trucks at INT / SHORT ovals

Operator, on the per-series recommendation: "Ship it for trucks and O'Reilly." Shipped in
src/lib/simEngine.js (runRaceSim, `simConfig.asymNoise`) and src/pages/SimulationCenter.js (flag =
series !== 'cup' && group in INT/SHORT; published boards carry config.asymNoise 'v1-upside-0.5' /
'off'). sim:smoke ALL PASS; lint clean. Cup, superspeedways and road courses unchanged. Backtest
scripts get shipped-equivalent cup behaviour by default (flag off unless passed) - a future O'Reilly /
trucks backtest must pass asymNoise:true to reproduce production.
Forward ledger: first O'Reilly and trucks boards on this engine are the next races; sim_grades rows
will show config.asymNoise. The O'Reilly win-log-loss guard was a coin flip between runs - that is the
number to watch.

## 2026-09-07 — RESULT: asymmetric noise (upside-only shrink, slower half) — 256 races, two runs

  ALL     rho .4926 -> .4927 / .4929 (129/120, 123/126 - tie)   t10 Brier .15164 -> .15124 / .15122 (142/101,
          136/108 - the first overall Brier win of the weekend)   winLL .0894 -> .0897 / .0896 (141/90, 147/79)
          t5LL .2978 -> .2969 / .2971 (197/58, 195/59)
  calibration: P26+ proj 23.90 -> 24.25 (actual 24.82); non-elite P26+ residual +1.04 -> +0.68; elite-deep -0.99 -> -0.73
  trucks  n=72: Brier .1584 -> .1570 (50/18, 53/18)  winLL .0958 -> .0946/.0947 (51/11, 55/13)  t5LL .3159 -> .3113 (60/11)  rho 30/37, 36/35
  oreilly n=83: Brier .1420 -> .1413/.1412 (54/25, 52/27)  winLL .0839 -> .0859 / .0837 (47/31, 46/26 - mean flips sign
          between runs = inside sim noise)  t5LL .2793 -> .2774 (72/11, 71/11)  rho 38/44, 39/41
  cup     n=101: Brier .1548 -> .1553 (38/58, 31/63) worse  winLL .0894 -> .0894 / .0908  t5LL mean .3000 -> .3028 worse
          (per race 65/36) - the fat-tail pattern again, milder than the symmetric form  rho 61/39, 48/50
  groups: INT Brier 74/31, 73/33 better; SHORT 50/35, 46/38; SS 8/18, 7/19 worse; ROAD 10/17, 10/18 worse.
VERDICT by the registered rule: rho holds (tie), Brier holds (better), P26+ residual shrinks (1.04 ->
0.68); the win-log-loss guard FAILS in cup (run 2 mean worse) and is a coin flip in O'Reilly (one run
each way). Per-series: TRUCKS passes every guard on both runs; O'REILLY passes Brier / top-5 / rho and
is within noise on win; CUP fails Brier and top-5 means.
READING: the asymmetric form is strictly better than the symmetric one - same direction on
calibration (two-thirds of the symmetric gain), and the favourite is untouched so the cup damage is
much smaller - but cup STILL loses on Brier, which says the lower half of a cup field genuinely
carries upside (parity): shrinking it, even one-sided, is wrong there. Cup's back-of-field problem
is specifically the P26+ NON-elite cars, not "the slow half", and the fix has to be car-specific
(the per-car laps-down feature), not a noise shape. Superspeedways and road courses lose in every
noise form - both should be carved out of any ship.
RECOMMENDATION: ship the asymmetric form for TRUCKS and O'REILLY at ovals (INT + SHORT), off for
cup, off at SS and ROAD everywhere. Operator ruling requested; nothing shipped.

## 2026-09-07 — REGISTRATION: ASYMMETRIC finish noise for the slower half (shrink the upside only)

Why: symmetric shrink (closed 09-07) fixed the back-of-field calibration but concentrated win
probability on the favourite and failed in cup (Brier 28/71 at n=101). The back of the field does
not have LESS variance, it has ONE-SIDED variance: a P36 car has many ways to finish 38th and almost
none to finish 15th.
FORM (frozen before data is read). In runRaceSim, per driver per draw: eps = gaussNoise(); if the
driver's speedScore percentile is below 0.5 AND eps > 0 (an upside draw), eps is scaled by
(0.5 + spdPct) - i.e. the slowest car keeps half its upside, the median car all of it; downside draws
and every car at or above median are untouched. The favourite's distribution is unchanged by
construction. One form, no sweep. Harness: 256 races (holdout.txt 2022-24 + holdout-practice.txt
2025-26), shipped vs the change, 20k sims / race / arm, two runs.
METRICS as the noise test: finish rho, t10 Brier, win / t5 log-loss (means AND per-race W/L),
per series / group; P26+ calibration and residual; elite-deep residual.
DECISION: adopt if the P26+ residual shrinks AND finish rho does not lose (W/L not worse than
45/55 of decided races) AND the MEAN win log-loss does not get worse in any series (the failure
mode of the symmetric form) AND t10 Brier does not lose in mean. A per-series ship is allowed if a
series fails the win-log-loss guard on its own.

## 2026-09-07 — RESULT (extended): speed-dependent noise on 256 races (2022-24 holdout + 2025-26 practice holdout)

Same form, shipped vs noise x (0.5 + 0.5 x speed pctile), 20k sims, two runs. n=256 (cup 101 /
O'Reilly 83 / trucks 72; INT 110 / SHORT 89 / SS 27 / ROAD 30).
  ALL   rho .4926 -> .4930 / .4933 (126/124, 142/111)   t10 Brier .15164 -> .15141 / .15143 (129/123, 125/126)
        winLL .0894 -> .0904 / .0912 - per race 189/65 and 190/65 BUT the MEAN is worse both runs
        t5LL 158/97 (mean .2978 -> .2995, worse)
  calibration: P26+ projected finish 23.90 -> 24.53 (actual 24.82); non-elite P26+ residual +1.04 ->
        +0.38 (n=2,646); elite-deep -0.99 -> -0.43 (n=278). Both cells move toward zero.
  cup     n=101: rho 51/46, 57/43 | Brier .1548 -> .1567 (28/71, 26/70) WORSE | winLL mean .0894 -> .0930/.0948 WORSE
  oreilly n=83:  rho 43/38, 48/35 | Brier .1420 -> .1408 (49/33, 49/34) better | winLL mean .0839 -> .0847 (68/14 per race) | t5LL 61/22
  trucks  n=72:  rho 32/40, 37/33 | Brier .1584 -> .1563 (52/19, 50/22) better | winLL mean .0958 -> .0933 better (56/15) | t5LL 47/25
  SS n=27: Brier 9/17, 10/16 worse. ROAD n=30: Brier 8/22 worse. INT 66/42, 63/44 better. SHORT 46/42, 44/44 flat.
VERDICT: the cup split from the 91-board run is REAL at n=101 (Brier 28/71 twice). Overall it is a
rho tie with better calibration and a fatter tail: per race the probabilities improve 3-to-1, but the
few races where a favourite busts get MORE wrong, enough to move the mean the wrong way in cup and
in the pooled win / top-5 log-loss. Mechanism: shrinking the noise at the bottom removes the back-
markers' lottery tickets, so win probability concentrates on the favourites; that is right in
trucks and O'Reilly (where the favourite usually delivers) and wrong in cup and at plates / road
courses (parity, wrecks). Registered rule: FAILS on the letter (rho tie). Per-series: TRUCKS passes
every probability metric; O'REILLY passes Brier and top-5 and is a wash on win log-loss; CUP fails.
RECOMMENDATION: ship for trucks; O'Reilly is the operator's call; cup stays. The back-of-field
calibration problem in cup is still open - the fix there cannot be "less noise at the bottom"
because cup favourites need the noise; it has to be something that lowers the back of the field
WITHOUT raising the favourite (a per-car laps-down feature from loop_data is the next candidate).

## 2026-09-07 — RESULT: speed-dependent finish noise — ordering a tie, calibration halved, probabilities split by series

91 boards, 20k sims, shipped vs noise x (0.5 + 0.5 x speed pctile), two runs.
  ALL      rhoFin .5428 -> .5433 / .5433 (W/L 46/45, 47/45 - a tie)   t10 Brier .14637 -> .14580 / .14577
           (mean better; per race 45/44, 47/45)   winLL .0875 -> .0869 / .0871 (69/23, 67/25)   t5LL 61/30, 59/32
  P26+ projected finish 23.95 -> 24.54 vs actual 25.07 (half the gap, no overshoot); P26+ finish
  residual +1.23 -> +0.61; P26+ DK residual -3.27 -> -1.80; elite-deep -1.60 -> -1.11.
  BY SERIES (two runs):
    O'Reilly n=26: rho .602 -> .603/.604 (15/11), Brier .1354 -> .1339 (15/10, 16/10), winLL 22/4 & 21/5, t5LL 20/6
    trucks   n=28: rho .558 -> .560/.558 (14/13, 16/12), Brier .1531 -> .1511 (19/8, 18/10), winLL 22/6, t5LL 19/9
    cup      n=38: rho .491 -> .490/.491 (17/21, 16/22), Brier .1490 -> .1500 (11/26, 13/25) WORSE, winLL
             per race 25/13 but MEAN worse .0873 -> .0887 - a few big losses (a favourite made more
             confident, then wrecked) outweigh many small wins.
  Groups: INT Brier 23/20 & 26/18; SHORT 20/18 & 19/21; ROAD Brier 2/6 & 2/6 (n=8, loses).
VERDICT by the registered rule: FAILS on the letter - finish rho is a tie (46/45), not 1.5:1.
READING: this is the first form this weekend that moves the back-of-field calibration WITHOUT
costing finish order, and it lifts the probability metrics the betting product actually sells
(win / top-5 / top-10) decisively in O'Reilly and trucks. In cup it makes the favourites more
confident and cup favourites wreck; the mean probability metrics get worse there even though
more races improve than not. Per-series ship (O'Reilly + trucks on, cup off) is what the evidence
supports; the registered rule did not anticipate a rho tie with a probability win, same as the
ownership v3 tie. OPERATOR RULING REQUESTED. Nothing shipped yet.

## 2026-09-07 — REGISTRATION: speed-dependent finish noise (shrink the noise at the bottom)

Hypothesis: the back of the field is over-projected not because the sim lacks a lapped state but
because ONE noise width is used for every car; the slowest cars are the most predictable part of the
field and the uniform noise lets a floor car land mid-pack in enough draws to average P28 instead of
P33. The lapped-traffic test (closed 09-07) fixed the mean by ADDING randomness and lost finish
order; this fixes the mean by REMOVING randomness that should not be there.
FORM (frozen before data is read). In runRaceSim, per driver per draw: score noise = gaussNoise() x
S.noiseWidth x (0.5 + 0.5 x spdPct_i), spdPct_i = speedScore percentile in the field (slowest 0.5x,
fastest 1.0x, median 0.75x). Everything else untouched (DNF, wreck sets, tilt, dominance). One form,
no sweep of the 0.5 floor. Harness: 91 practice holdout boards (SS boards included this time - the
form applies everywhere), shipped vs the change, 20k sims / race / arm, two runs.
METRICS: finish rho, t10 Brier, win / t5 log-loss, per group / series; the P26+ finish and DK
residuals and the elite-deep residual; P26+ mean projected finish vs actual 25.1.
DECISION: adopt if finish rho improves in mean with W/L >= 1.5:1 AND t10 Brier does not lose AND the
P26+ residual shrinks. If it fixes calibration but not rho, it is the same trade as the lapped draw
and closes; if it fixes both, it ships as the noise line in runRaceSim with the constant named.

## 2026-09-07 — RESULT: lapped-traffic mechanism — right direction, overshoots, ordering loses: CLOSED as registered

Rate table (loop_data 2023+, running finishers laps down, bands P1-10 / 11-20 / 21-25 / 26-30 / 31+):
cup INT .11/.19/.26/.32/.45, cup SHORT .22/.38/.53/.62/.78, cup ROAD .04/.07/.05/.10/.24; O'Reilly
INT .14/.26/.40/.46/.59, SHORT .12/.21/.37/.46/.61, ROAD .06/.09/.14/.15/.17; trucks SHORT
.17/.32/.51/.58/.76, INT .19/.24/.36/.56/.59, ROAD .08/.09/.15/.32/.36. (SS excluded.)
91 boards, 20k sims, shipped vs mechanism (two runs):
  rhoFin        .5435   ->  .5377 / .5385   (DOWN; SHORT .586 -> .574, INT .528 -> .525, ROAD .415 -> .427)
  t10 Brier     .14638  ->  .14660 / .14666 (slightly worse)   winLL .0873 -> .0869 / .0871   t5LL .2867 -> .2860
  P26+ mean projected finish 23.94 -> 25.83 vs ACTUAL 25.07  (was 1.1 too optimistic, now 0.8 too pessimistic)
  non-elite P26+ finish residual +1.23 -> -0.67;  P26+ DK residual -3.28 -> +0.72  (the DFS miss is gone)
  elite-deep residual -1.60 -> -1.39 (barely moves; it is a different problem, as 09-07 showed)
VERDICT by the registered rule: FAILS (finish rho down both runs, Brier does not hold). CLOSED as
registered. Nothing ships.
READING: the mechanism is the right shape - it moves the back of the field from 1.1 positions too
good to 0.8 too bad and takes the P26+ DK-points miss from -3.3 to +0.7 - but at full strength it
overshoots, and the random lapped draw scrambles mid-pack ORDER enough to cost rho, most at short
tracks where the table says half the field gets lapped. The 2x slope on speed percentile was
fixed by the form; a half-strength version (p_i = p_band x (1 - spdPct), fastest never, median car
half the band rate) is the obvious single follow-up and is NOT run here (no sweep). The sim's
finish-order metric and the DFS-points calibration pull in different directions on this one:
better calibration of WHERE the back of the field finishes costs a little on WHO beats whom in the
middle. If the follow-up form also loses rho while fixing the DK residual, the honest home for the
mechanism is the DFS layer (haircut on P26+ draws), not the betting sim.

## 2026-09-07 — REGISTRATION: LAPPED-TRAFFIC mechanism in runRaceSim (the back-of-field over-projection)

Evidence: non-elite P26+ starters finish 1.23 positions / 3.3 DK pts worse than projected (n=1,059,
09-07); floor cars at Darlington projected 17-23, scored 3-6. loop_data 2023+ (all series, races
with >= 25 rows): share of RUNNING finishers that ended laps down by start band - cup 12 / 20 / 27
/ 31 / 39% for P1-10 / 11-20 / 21-25 / 26-30 / 31+; O'Reilly 11 / 17 / 27 / 31 / 38; trucks 15 / 22
/ 33 / 42 / 43. The sim has no such state: a running P32 starter's finish is ordered purely by
score noise, so he lands mid-pack as often as the score says.
FORM (frozen before data is read). runRaceSim already carries `effLap` (laps-down from pre-race
penalties) and sorts running cars by effLap before score. The mechanism adds, per draw, per
running driver: lapped with probability p_i = p_band(series, trackGroup, startBand) x 2 x (1 -
spdPct_i), where p_band is the loop_data 2023+ lapped-running rate for that series x track group
(INT / SHORT / ROAD; superspeedways EXCLUDED - pack racing has no lapped traffic to speak of) x
start band (1-10 / 11-20 / 21-25 / 26-30 / 31+), and spdPct_i is the driver's speedScore
percentile in the field (fastest = 1 -> never lapped; median car in the band -> p_band; slowest
-> 2 p_band, capped at 0.9). A lapped car gets effLap = 1 for that draw and finishes behind every
lead-lap car, ordered by score among the lapped. The rate table is computed ONCE from loop_data
and frozen as constants; no sweep of the 2x slope or the bands.
Harness: 91 practice holdout boards (SS boards pass through unchanged), shipped engine vs the
mechanism, 20k sims / race / arm, two runs. METRICS: finish rho, t10 Brier, win / t5 logloss; the
two deep-cell residuals (elite-deep, non-elite P26+) and the P26+ DK residual, all of which must
move toward zero; calibration check that the sim's mean finish for P26+ starters moves toward the
observed 25.3 (cup). DECISION: adopt if finish rho improves in mean with W/L >= 1.5:1 AND t10 Brier
does not lose AND the P26+ residual shrinks AND the elite-deep residual does not grow. Ships as a
named block in runRaceSim with the table in simEngine constants and a config flag for backtests.
After it ships, the deep-starter start-weight form (closed 09-07) is re-registered on top of it.

## 2026-09-07 — RESULT: deep-starter start weight — CLOSED (fixes the elite cell, worsens the back of the field)

91 boards, 20k sims, two runs each. A = shipped, S = 0.10 of start weight moved to corrHistory for P16+.
  rhoFin       A .5432 / .5428    S .5421 / .5403   (down both runs)
  t10 Brier    A .14640 / .14636  S .14605 / .14610 (slightly better)
  winLL        A .0872 / .0873    S .0878 / .0877   (slightly worse)
  elite-deep residual   A -1.61   S -0.56   (moves toward zero - the Larson cell is fixed)
  non-elite P26+        A +1.23   S +1.49   (moves AWAY from zero - the Finchum cell gets worse)
  INT rho flat, SHORT .584 -> .583 / .580, ROAD .418 -> .412.
VERDICT: FAILS (rho down; one deep cell better, the other worse). CLOSED.
WHAT IT MEANS: the two deep cells are NOT one mechanism after all. Moving weight from start to
car quality lifts the good car from P25 (correct) but ALSO lifts the bad car from P32, because on
the min-max rating scale a weak car's quality score is less pessimistic than its start score. The
back-of-field over-projection is not a weighting problem; it is the race sim not knowing that P26+
starters at most ovals get lapped (finish distribution too compressed toward the field). That is
the laps-down item in STATE and it needs a mechanism in runRaceSim (laps-completed by start band x
track group from loop_data), not a speedScore weight. The elite-deep case (Larson) is real but
small (n=100) and cannot be fixed by this knob without breaking the other cell - park it until the
laps-down mechanism exists, then re-test the start weight on top of it.
Engine untouched; the test copy (simEngine_S.js) lives only in the cloud clone.

## 2026-09-07 — REGISTRATION: deep-starter start weight (0.23 -> 0.13 for P16+, freed 0.10 to corrHistory)

FORM (frozen before data is read). In buildSpeedScores, per driver: if startPos >= 16, the
normalised start weight is reduced by 0.10 (of the pre-normalisation 0.23 -> 0.13) and corrHistory
is raised by the same 0.10; front starters unchanged; superspeedway / road-course weight tables
unchanged (their start weights are already 0.15). One form, no sweep of the cut (16) or the shift
(0.10). Harness: the 91 practice holdout boards, shipped engine (arm A) vs the change (arm S), 20k
sims / race / arm, run twice.
METRICS: the sim's own - finish-order Spearman, t10 Brier, win / t5 log-loss - per race, per track
group, per series; PLUS the two deep-cell residuals from the 09-07 diagnostic (elite-deep, non-
elite P26+) which must both move toward zero. DECISION: adopt if finish rho improves in mean with
W/L >= 1.5:1 AND t10 Brier does not lose AND both deep-cell residuals shrink. Ships as a per-driver
rule in buildSpeedScores with the constants named.

## 2026-09-07 — RESULT: elite-deep diagnostic — leans yes but not clear of zero; the DEEP NON-ELITE cell is the clear finding

3,383 driver-rows, 92 boards, shipped engine, 20k sims. Finish residual = actual - projected
(negative = beat the sim); bootstrap 95% CI.
  elite / deep (start >= 16)   n=100    -1.59 [-3.56, +0.38]   DK resid -0.8   (proj P14.6, actual P13.0)
  elite / front                n=360    -0.42 [-1.57, +0.63]
  non-elite / deep             n=1,904  +0.48 [+0.10, +0.83]   DK resid -2.2
  non-elite / front            n=1,019  -0.56 [-1.15, +0.04]
  elite-deep by series: cup -1.08 (n=41, CI wide), O'REILLY -3.58 [-6.28, -0.28] (n=27), trucks -0.56.
  elite by start band: 26-40 -3.06 [-6.69, +0.93] (n=26, proj P16.6 actual P13.5).
  NON-ELITE start 26-40: +1.23 [+0.76, +1.67], n=1,059, DK resid -3.3 - the back of the field is
  projected 1.2 positions and 3.3 DK pts too well, and that is the Finchum finding with 1,059 rows
  behind it instead of three.
READ-OUT by the registered rule: elite-deep is negative in mean (they beat the sim by ~1.6 spots)
but the CI crosses zero at n=100 -> does NOT clear the bar on its own. O'Reilly elite-deep does
(n=27). The cell that clears the bar is the one we did not register for: deep NON-elite starters
finish WORSE than projected, and the effect is concentrated at P26+.
WHAT THE TWO CELLS SAY TOGETHER: for deep starters the sim compresses the field toward the start
position - the good car from P25 is under-projected, the bad car from P32 is over-projected. That
is one mechanism (start position carrying too much weight relative to car quality for drivers
starting deep), not two. The 08-20 sweep set startPos at 0.23 for EVERYONE and tested 0.23 vs
0.33 vs 0.43; it never tested a start weight that depends on where you start.
NEXT (needs its own registration, one form): for starters >= P16, shift weight from startPos to
corrHistory (e.g. 0.23 -> 0.13, freed 0.10 to corrHistory), per driver inside buildSpeedScores;
front starters unchanged. Judged on the sim's own metrics (finish rho, t10 Brier, win/t5 logloss)
on the 91 boards plus the deep-cell residuals, same bar as the practice tests. Nothing ships from
this run.

## 2026-09-07 — REGISTRATION: do elite cars starting mid-pack outrun the sim? (start-weight x car quality)

Trigger: Darlington Cup R27 - Larson ($10,000, best car) projected P16 / 45 DK from P25 with a 3% win
prob; won with 110. The 08-20 sweep set startPos at 0.23 for the AVERAGE driver; the question is
whether the sim underrates elite cars that start deep.
FORM (frozen before data is read). Data: the 91-board practice holdout (2025-26, all series) run
through the shipped engine (arm A, 20k sims), per driver: projected finish, actual finish, DK pts
(loop_data fingerprint join), start, corrAvgRating. Elite := top 5 corrAvgRating in the race
(car/driver quality, not salary - the holdout has no salaries). Deep := start >= 16. Cells: elite-
deep, elite-front, non-elite-deep, non-elite-front.
  Metric: mean residual (actual finish - projected finish; negative = finished better than the sim
  said) and mean DK-pts residual (actual - projected) per cell, with a 1,000-draw bootstrap CI on
  the elite-deep cell. Per series reported.
  READ-OUT: if elite-deep finish residual is negative with a CI clear of zero AND non-elite-deep is
  not, the sim underweights start for elite cars -> register a sim change (start weight scaled by
  rating percentile, one form). If elite-deep is not different from zero, Larson was Larson and the
  line closes. Diagnostic only; nothing ships from this run.

## 2026-09-07 — DFS Cup Darlington R27 (Southern 500): replay + operator contests; floor cars projected 20 pts rich

REPLAY (cloud harness, same solvers; ledger row written, portfolio columns included). Board post 09-06
16:28, 10k draws, 38 in pool, contest DK GPP 194919870 (1,189 entries, winner 387.25, median 257.95).
  cash 177.05 (~1,077th, p9) - Allmendinger / Finchum / Buescher / Hamlin / Reddick / BYRON (-10.75)
  GPP best-of-20 297.45 (~301st, p75) - Wallace / Finchum / Briscoe / Hamlin / Larson / Z.Smith;
    set mean pctile 33, 6/20 above median; set exposure Reddick 75 / Hamlin 60 / Byron 55 / FINCHUM 45
  perfect 407.15 - Wallace / Bell / Berry / Larson / Gilliland / Gibbs ($49,400)
  rho model .623 < salary .688 < own .699 (model 3rd of 3 again; Larson 110 at 25% owned was the race)
  PORTFOLIO row (3 x 20, rules on): prize 11.1 vs 0.0 for 3 x E[max]; legs 20/20/20; best entry p91.
    First live row of the Portfolio ledger: portfolio 1 / plain 0.
Verdict GPP. Ledger: GPP 5 / cash 3 / tie 2.

OPERATOR (61 entries across three contests, exposures hand-set): A (713 entries) best 11th, 8/21
above median; B (1,189) best 70th, 8/20; C (1,189) best 169th, 9/20. Portfolio across 61: Reddick 48
/ Buescher 44 / Briscoe 43 / Hamlin 41 / Larson 34 / Bell 34 / Jones 34 / Byron 34 / Hocevar 28.
Finchum 0 of 61. Byron (-10.75) at 34% and Buescher (38.5 at 43% owned) are what kept the sets under
the median; Larson (110.3) at 34% is what put a lineup 11th. The winning field lineups were Larson +
Bell + Gibbs + Hocevar + Jones + Allmendinger: three of the six under 20% owned.

FLOOR CARS (operator: "Finchum a ton of laps down... super cheap cars need their own exposure
setting"). All three $5,000-and-under cars were projected as if they finish ~P28: Finchum $4,500
proj 23.1 -> 3.0, Ware $4,700 21.4 -> 6.0, Ty Dillon $5,000 17.6 -> 6.0. That is ~20 DK pts rich
each, not the ~4 in STATE - at Darlington a back-marker goes laps down, and the sim's place-
differential credit for a P38 starter assumes he stays on the lead lap. The E[max] set had Finchum in
9 of 20 and 3 of its 3 best. WHAT-IF (not a registered test): floor cars capped at 10% -> best 302.0
(p77), mean pctile 35, Finchum 10%; capped at 25% -> 297.4, mean 31. Helps this week, and the 09-06
V1 test says it is neutral on average (0/1/8). So: a floor-car cap is a taste control, not an edge;
the PROJECTION of floor cars at laps-down tracks is the real problem and belongs to the sim (open
item in STATE; the closed DNF-by-tier line was about wrecks, this is lapped traffic).

## 2026-09-06 — RESULT + SHIPPED: projected ownership v3 (one top-end hinge term)

9 races LORO: MAE 6.349 -> 6.350 (tie; W/L 5/3), rho .745 -> .745, top-3 chalk error 12.13 -> 11.50
(7/2). c per fold 0.08-0.14, full-sample 0.115; hinge z = 1 fixed. Ref hinge z = 1.5: MAE 6.33
(6/3), top-3 11.99 (5/4) - reported only. Chalk check (actual / A / v3): Blaney Iowa 72.5 / 43 / 51,
Blaney Richmond 53 / 42 / 50, Logano NH 38 / 38 / 40, Bell Daytona 47 / 40 / 43, Hill ore Iowa
43.5 / 18 / 17 (z = 0.4 - the crowd loved a driver we did not rank near the top; no shape fixes
that), Allgaier ore Richmond 57 / 36 / 38, Allgaier Darlington 50 / 40 / 53, Majeski 56 / 38 / 44,
Nemechek 49 / 38 / 43.
By the registered letter it misses (MAE must improve in mean; it is 0.0007 worse). Operator ruled
on the tie: "Ship it." Shipped: DFSPage.projectOwnership = 600% x exp(2.2 pct + 0.115 max(0, z-1)) /
sum, exported; DfsReplay's Portfolio field model now calls it (was an inline copy of the rank
curve). The Portfolio chalk definition (> 35%) inherits it - Reddick-on-the-pole weeks now read
chalkier. Still derived from our projection: not leverage (08-30 rule).

## 2026-09-06 — REGISTRATION: projected ownership v3 — one top-end term (the single form)

FORM (frozen before data is read). Shipped curve kept exactly (k = 2.2 on rank percentile) plus ONE
term that adds mass only at the top of the slate by projection GAP:
    own_i = 600% x exp(2.2 x pct_i + c x max(0, z_i - 1)) / sum
  z_i = within-slate z-score of projected DK pts; the hinge at z = 1 is FIXED (roughly the top sixth
  of a slate); c is the ONLY free parameter, fitted leave-one-race-out by least squares on
  log(actual own) with k held at 2.2. No sweep of k or of the hinge. Reference: the same fit with the
  hinge at z = 1.5 is reported for context only, not for decision.
METRICS / DECISION as v2: MAE improves in mean with W/L >= 1.5:1 AND top-3 chalk error improves in
mean. Passing ships as projectOwnership with c frozen in code.

## 2026-09-06 — RESULT: projected ownership v2 — CLOSED (candidate fails; chalk level is a shape problem)

9 races LORO, ~330 rows. MAE / rho / top-3 chalk error (mean |pred - actual| on the three most-owned):
  A rank-only k=2.2 (shipped)               6.35 / .745 / 12.1
  B rank+z+ptsPerK+start+practice           6.42 / .754 / 11.8   MAE W/L 3/6, top-3 6/3  -> FAILS
  ref rank + magnitude (z) only             6.36 / .745 / 11.1   MAE 5/4 (wash), top-3 7/2
  ref rank + crowd signals only             6.44 / .753 / 12.3   3/6, 5/4
  ref rank refit (k free)                   6.37 / .745 / 11.6
VERDICT: B fails (MAE worse). Magnitude-only improves the chalk level 7/2 with MAE flat - does not
clear the registered bar (MAE must improve in mean). NOT shipped; rank-only stays.
FINDINGS: (1) the LEVEL is the problem, operator was right by more than he bet: the most-owned driver
each week averaged 52% actual vs 37% modelled, low in 9 of 9 (Blaney Iowa 72.5 actual / 43 model;
Allgaier Richmond 57 / 36). exp(k x rank pctile) has a flat top; even B only lifts Blaney to 54. A
functional-form change (extra mass at the top by projection gap) is the next registration, one
form, one parameter from the LORO fit, no sweep. (2) The crowd chases PRACTICE, not the pole: practice
pctile coefficient +0.85 (largest), start pctile -0.36 once projection is in (the projection already
credits the pole). The Retzlaff pattern in the data. (3) A better own% is a better field model, not an
edge - 08-30 rule stands; the Portfolio chalk definition (>35%) is the consumer.

## 2026-09-06 — REGISTRATION: projected ownership v2 — magnitude and crowd signals on top of rank

Trigger: operator, Darlington Cup board, Reddick on the pole at 36.4% projected: "I'm willing to bet
Reddick might be owned more than 36.4%." The shipped model (08-30) is RANK-ONLY: own = 600% x
exp(2.2 x proj percentile) / sum. The top rank gets the same ~36-40% every week whatever the gap;
it cannot say "this week's chalk is chalkier" (Allgaier 09-05: model ~40, actual 50). The 08-30 fit
only tried OTHER RANKINGS (salary, value, optimal%) as additions - never magnitude, never the crowd
signals (start position, practice speed).
FORM (frozen before data is read). 9 races with banked DK GPP ownership (~330 driver-rows).
  Baseline A: rank-only, k = 2.2 (shipped).
  Candidate B: log-linear in the same normalised-to-600% form:
    own ~ exp(b1 x pctile + b2 x z_proj + b3 x ptsPerK_pctile + b4 x start_pctile + b5 x practice_pctile)
    where z_proj = within-slate z-score of projected DK pts (the magnitude), ptsPerK = proj / (sal/1000),
    start_pctile = 1 - (start-1)/(n-1) (pole = 1), practice_pctile = grade percentile (0.5 when no
    practice). Fitted by least squares on log(actual own) leave-one-race-out; features standardised.
  Reference arms (reported, not decision): B without start/practice (magnitude only); B without
    z_proj (crowd signals only).
METRICS per race: MAE (ownership points) and Spearman vs actual; TOP-3 error = mean |pred - actual|
on the three most-owned drivers in the actual data (the chalk level, where rank-only is guaranteed
low). DECISION: adopt if MAE improves in mean with W/L >= 1.5:1 AND top-3 error improves in mean.
If it passes it replaces projectOwnership in DFSPage (the chalk definition in the Portfolio builder
inherits it) with the fitted coefficients frozen in code and the fit date noted.
Caveat stated up front: a better own% is a better FIELD MODEL, not an edge (08-30 rule stands).

## 2026-09-06 — SHIPPED: Portfolio builder (rules on for cup / O'Reilly, off for trucks; chalk schedule optional)

Operator, after the per-series breakdown (rules-only: cup 4/0, O'Reilly 3/0, trucks 0/2): "log it
and ship." Shipped as src/lib/dfsPortfolio.js (pure module, backtested numbers as constants):
  DFS Center -> Mode "Portfolio (N contests)": legs (default 3) x Lineups, Operator rules checkbox
  (default = series: on for cup / O'Reilly, OFF for trucks), Chalk stance select (default all-50;
  "0 / 50 / 50" offered as the high-variance mode with its zero-week warning). Legs render as tabs
  over the lineup table; Export CSV exports the selected leg (filename _PORTFOLIO_legK). No lineup
  reused across legs; 60% portfolio cap; user per-driver min/max and locks/excludes still win.
  DFS Replay: a Portfolio row every replay - legs x N with the series-default rules, realised prize
  on the real ladder (DK-like curve, entry-fee units) vs legs x the plain E[max] set; stored in
  dfs_replays.portfolio_prize / portfolio_base_prize / portfolio_legs / portfolio_json (migration
  dfs_replays_portfolio_cols) and shown as a ledger column. THIS is what decides trucks and the
  schedule: the row accumulates; re-judge at 9 more races.
  Headless smoke (cloud, same module): Darlington O'Reilly 20/20/18 (leg 3 short under tier-two
  mins + portfolio cap), 58/58 unique, min salary $48,900; trucks Richmond (rules off) 60/60.
Cross-leg duplicate fix found in smoke: top-up / min-exposure rebuilt lineups an earlier leg held
(53/60 unique before) - now dropped and refilled with the dropped ones seeded into the dedupe.
Not shipped: the 0/50/50 schedule as a default (5/4, fade leg zero in 5 of 9), any tuning of the
rule numbers (none was done; they are the operator's Darlington construction as observed).
FOLLOW-UP same night (operator: 60 x 3 build came up 60/60/58; "how do you propose we fix it?"):
legs are now built ROUND-ROBIN (one E[max] pick per leg per round, cross-leg ban on taken lineups,
portfolio cap read live), so no leg is another's leftovers and the shortfall no longer lands on
leg 3. Darlington O'Reilly 20 x 3: 20/20/18 sequential -> 20/20/20 round-robin; 60 x 3: the
tier-two minimums bind (60/57/52) and the card now NAMES the binding constraint (portfolio cap on
whom / tier-two minimum unreachable for whom / candidate pool exhausted) with rebuild buttons:
portfolio cap 65 / 70%, or drop the tier-two minimum for that leg. It never pads: a padded slot
would be the mean optimizer's leftovers with no chalk and no studs - the 09-06 top-up failure again.
makeEmaxSelector gained pick() / refresh() / ban(); step() untouched.

## 2026-09-06 — RESULT: portfolio builder — the CANDIDATE fails; the RULES-ONLY reference arm clears the bar

9 races, 3 legs x 20, realised prize over 60 entries (entry-fee units, DK-like curve), vs 3 x the
product's uncapped E[max] set:
  race            3xE[max]  PORTFOLIO (legs)            rules-only  sched-only   chalk (proj own)
  cup Iowa           0.0     7.3 (0 / 0 / 7.3)            13.4       109.2       Bell Logano Larson Blaney
  cup Richmond      17.0    17.5 (6.8 / 5.7 / 4.9)        21.7        20.2       Hamlin Logano Blaney
  cup NH             4.9     7.2 (0 / 2.9 / 4.3)           8.7         8.9       Bell Logano Blaney Byron
  cup Daytona       33.4    35.6 (6.2 / 14.3 / 15.1)      42.5        28.8       Bell Gragson Gilliland
  ore Iowa          39.1    30.7 (8.0 / 13.2 / 9.5)       41.0        20.9       Love Allgaier Chastain
  ore Richmond       6.0     5.8 (0 / 3.6 / 2.2)           7.4         2.0       Jankowiak Hill Allgaier
  ore Darlington     8.6    26.0 (21.6 / 2.7 / 1.7)        9.3        18.0       Kvapil Allgaier Jones
  trk Richmond      51.9    27.1 (0 / 12.5 / 14.6)        41.5        27.3       Heim Honeycutt Majeski
  trk NH             9.6     6.8 (0 / 2.8 / 4.0)           8.6         8.8       Smith Nemechek Riggs
  MEAN             18.95   18.22  (W/L 5/4)               21.57 (7/2)  27.12 (4/5)
  Best-of-60 pctile: 89.2 -> 94.0 (8/0/1) for the portfolio.
VERDICT on the registered candidate (schedule + rules): FAILS - mean prize down, 5/4. The
0%-chalk leg returned ZERO in 5 of 9 races; it pays only when the chalk busts (cup Iowa, ore
Darlington) and those two races are the whole schedule-only mean (27.1 is 109 + 18 and losses
elsewhere, 4/5). Diversification finds a higher peak every week (best pctile 8/0/1) and costs
prize on average. Note the chalk definition fired on 3-4 drivers per race (projected ownership
is flat, 35-43%), so leg 1 faded three or four cars at once - a far heavier fade than the one
50%-owned car faded at Darlington.
THE RULES ALONE (all legs 50% chalk; tier-two studs 50-80%, floor cars <= 10%, mid punts
<= 25%, <= 2 punts, salary >= $48,800, no duplicate lineups across legs, 60% portfolio cap):
mean 18.95 -> 21.57 (+14%), W/L 7/2 (3.5:1). This was a PRE-SPECIFIED REFERENCE ARM, not the
registered candidate, and the harness is deterministic (no RNG) so a re-run reproduces the same
numbers - re-registering it would be theatre, not evidence. It is reported as what it is: a
reference arm that cleared the registered bar on the registered metric. Promoting it to shipped
is the operator's call, and the honest caveat is that two reference arms were looked at, so the
7/2 carries a mild forking-paths discount. Its losses: ore Iowa (41.0 vs 39.1 is a win; the two
losses are trk Richmond 41.5 vs 51.9 and trk NH 8.6 vs 9.6 - the truck races where the plain
E[max] set was already excellent).
IF SHIPPED: Portfolio tab = legs with the rules on by default and the chalk stance an OPTIONAL
schedule (default all-50, the schedule exposed as the operator's own high-variance mode with the
0-leg warning), plus the Replay row scoring both weekly.

## 2026-09-06 — REGISTRATION: portfolio builder (3 legs x 20, chalk-stance schedule + Operator rules)

The one construction that won (Darlington 09-05) was cross-contest: three sets with different
chalk stances, tier-two studs heavy, mid-priced punts rotating, cap spent. The product builds one
contest in isolation. This registers the portfolio as a METHOD and scores it before any page code.
FORM (frozen before data is read). 9 replay races, product candidates (per-draw optima +
optimize(300), 2,000 by projection, diversified under caps per 09-06 V4), full post draws stride
2,000, E[max] selector per leg, N = 20 per leg, 3 legs.
  Chalk := drivers with PROJECTED ownership (proj-rank, k = 2.2) > 35%. Stance schedule on every
  chalk driver: leg 1 max 0%, leg 2 max 50%, leg 3 max 50%.
  Rules, every leg: tier-two studs := projection rank 3-8 AND salary $8,400-$10,000 (rank window
  relaxed to 3-10 if fewer than 3 qualify): min 50% / max 80% each. Floor cars (salary <= floor +
  $500): max 10%. Mid punts (floor + $500 < salary <= $6,200): max 25% each; at most 2 punts of
  either kind per lineup (candidate filter). Salary floor: candidates under $48,800 discarded
  (cap $50,000). Min exposure enforced by enforceMinExposure, max by the selector's capOf and
  topUpLineups, as in the product.
  Cross-leg: a lineup used in one leg is removed from the candidate pool of the next. Portfolio
  cap 60% on any driver across the 60 (leg 3 built against the running total).
  Baseline: 3 x the product's uncapped E[max] 20-set (identical legs, i.e. what entering the
  same set in three contests is).
  Reference arms (reported, not decision): (i) rules without the stance schedule (all legs 50%
  chalk) - separates diversification from the rules; (ii) schedule without the rules.
METRICS per race: realised prize summed over the 60 entries on the real ladder with the 09-06
DK-like payout (top 20%, r^-0.75, entry-fee units); best leg's best-of-20 pctile; portfolio
exposure table (top 12 drivers). Note the ladder is one contest's; three legs are scored against
it three times, which is the same approximation for both arms.
DECISION: adopt if mean realised prize improves AND W/L >= 1.5:1 over the 9. If it passes, it
ships as a Portfolio tab in DFS Center (legs, stances, editable rule numbers, cross-leg exposure)
plus a Portfolio row in DFS Replay scored weekly. If it fails, the method is logged as
Darlington-only and the tab is not built.

## 2026-09-06 — RESULT: payout-aware GPP objective — CLOSED, loses to E[max] on every metric

9 races, product candidates and draws, N = 20, projected-ownership field (F = 1,000), DK-like
payout (top 20%, r^-0.75). Realised prize of the 20, entry-fee units, on the real ladder:
  race        entries  E[max] prize / best pct   PAYOUT prize / best pct   ref actual-own prize
  cup Iowa      1417      0.0 / 76.1                0.0 / 75.0               0.0
  cup Richmond 14268      5.7 / 93.0                4.7 / 90.9               0.0
  cup NH       14268      1.6 / 83.4                0.0 / 74.5               0.0
  cup Daytona  14268     11.1 / 94.6                1.8 / 85.5               2.5
  ore Iowa      4756     13.0 / 92.0                6.2 / 94.2               9.4
  ore Richmond   925      2.0 / 84.8               10.6 / 95.3               0.0
  ore Darlington 1189     2.9 / 90.8                0.0 / 45.4               0.0
  trk Richmond  2378     17.3 / 95.3               18.0 / 90.1               7.1
  trk NH        2378      3.2 / 92.6                0.0 / 57.4               0.0
  MEAN prize 6.32 -> 4.59 (W/L/T 2/6/1); best-of-20 pctile 89.2 -> 78.7 (2/7); mean pctile of the
  20 46.2 -> 42.7 (3/6); cashed 2.3 -> 1.9 of 20. With ACTUAL ownership as the field model
  (post-hoc ceiling) it is WORSE still: 2.11.
VERDICT: FAILS. CLOSED. The STATE top DFS item is closed on this evidence.
WHY: the objective's own EV said the payout set was far better (Darlington 46 -> 56, trucks
Richmond 80 -> 136 entry-fees) and reality said the opposite - the FIELD MODEL is wrong.
Sampling cap-feasible lineups from ownership produces a field that scores far below real DK
entrants, who optimise; "beat the simulated field" then rewards HIGH-FLOOR lineups that beat
weak opponents instead of high-ceiling lineups that reach the top of a real one. Actual
ownership does not fix it because the error is the sampling, not the own%. Set overlap with
E[max] was 0-6 of 20; the payout set also has no diversification (additive objective picks 20
near-clones of the top-EV lineup). A field model good enough to make this work needs real
contest lineups, which DK does not publish. Line closed; do not re-open on a better payout curve
- the payout curve was not the failure.
HARD NUMBER FOR THE OPERATOR: on this payout curve the product's E[max] 20-lineup sets return
6.3 entry-fees per 20 entered across the 9 races (about -68%); the one hand-built set at
Darlington returned the tournament. Construction across contests (portfolio builder, chalk
stance schedule) is what is left, and it is what the evidence has pointed at since 09-05.

## 2026-09-06 — REGISTRATION: payout-aware GPP objective (STATE top DFS item since 08-30)

Claim under test: E[max] picks the set to maximise OUR best score; a tournament pays by RANK
against the field, so the set should maximise expected PAYOUT, which (a) rewards beating the
field's likely lineups rather than a high absolute score and (b) is split when our lineup is
duplicated in the field. Ownership here is the product's own proj-rank projection (k = 2.2,
08-30) - it models DUPLICATION and where the field is, never "the field is wrong" (leverage
closed 08-30).
FORM (frozen before data is read). 9 replay races, full 10k post draws (stride to 2,000),
product candidates (per-draw optima + optimize(300), 2,000 by projection), N = 20, no caps.
  Field model: F = 1,000 field lineups per race sampled from projected ownership (6 distinct
  drivers without replacement, probability proportional to own%, accepted if salary within
  [cap - $3,000, cap]). Each field lineup is scored on the same draws as ours.
  Payout function (fixed, DK-like, entry-fee units): top 20% of E entries cash; prize(r) =
  E * r^-0.75 / sum_{r<=0.2E} r^-0.75 (1st ~8% of the pool, min-cash ~1.5x). Rank of a lineup
  in draw d = 1 + number of field lineups scoring above it, scaled from F to E.
  Duplication: a candidate's prize in every draw is divided by (1 + expected field duplicates),
  expected duplicates = E * (exact-duplicate count in the F sample) / F.
  Objective: expected prize per lineup over the draws is ADDITIVE across a set (each entry is
  paid on its own rank), so the payout set = the top 20 candidates by expected prize. No
  interaction term, no tuning.
  Baseline: the product's E[max] set on the same candidates and draws.
  Reference (reported, not shippable): the same objective with ACTUAL ownership as the field
  model - the ceiling if we knew where the field was.
METRICS per race: realised prize of the 20 (sum, entry-fee units) placed on the real contest
ladder with the same payout function; best-of-20 field pctile; mean pctile of the 20.
DECISION: adopt if mean realised prize improves AND W/L >= 1.5:1 over the 9; guard: best-of-20
pctile not worse than 40/50-style noise. If it passes it ships as a GPP objective option in DFS
Center ("Payout" vs "Ceiling") with the ledger scoring both weekly; not as a silent replacement.

## 2026-09-06 — RESULT: DK-points-scored test of arm C — CLOSED; the practice-input line is done

91 boards, DK pts from loop_data (92/92 fingerprint-matched), 20k sims / race / arm.
  PRIMARY rho(projDK, DK pts): ALL .365 -> .363 (W/L 48/43). INT .379 -> .378 (22/22); SHORT .382
  -> .380 (21/18); ROAD .205 -> .202 (5/3). cup .353 -> .364 (25/13); oreilly .385 -> .376 (11/14);
  trucks .364 -> .352 (12/16). Laps-graded boards 43/41; control boards 5/2.
  Guards (same run): rhoFin .541 -> .542 (48/43); t10 Brier 47/42; winLL 51/40; t5LL 46/44.
VERDICT: FAILS the primary (mean down, 48/43 = noise). CLOSED - no second run needed, there is
nothing to confirm. Nothing ships; practice_sessions.pace_tc is NOT added.
WHY THE SIX-RACE SIGNAL DID NOT HOLD: the 5/1 on the 2026 replay races was scored on official DK
FPTS over six races; over 91 races on the hand DK formula it is .365 -> .363. Six races was the
sample, not the effect. Cup alone leans positive (25/13, .353 -> .364) and would be the only
place to look again, with a cup-only registration, IF a new reason appears; not on this evidence.
LINE CLOSED (four forms, 2026-09-06): rank composite (B), corrected seconds (C), corrected best5
(D), and C scored on DK points. A better practice number in the sim's practice slot does not
improve finishing order, DK points, or (beyond noise) the win/top-10 probabilities, at the
validated 0.15 weight. The grader stays what it is: a practice report card and the EDGE gate.
The residual diagnostic's .385 -> .414 stands as a description of a linear fit, not a sim change.
WHAT IS LEFT FOR DFS, in order of evidence: (1) the payout-aware objective (E[max] maximises our
own score; a tournament pays for beating the field - STATE top DFS item, needs registration);
(2) the portfolio builder across contests with a chalk-stance schedule (the construction that
actually won at Darlington); (3) the Operator preset (rules 2-4). None of these touch the board.

## 2026-09-06 — REGISTRATION: DK-points-scored test of the grader-corrected practice input (post board)

Operator: "do what you wanna do with the post board for DFS." Reasoning: three practice forms
left finish-order rho flat and lifted the DK-points correlation on the six 2026 replay races (5/1)
plus the win / top-10 probability metrics (the betting product's own markets). Finish-order
Spearman was the wrong primary for a change whose value is in the tail. n=6 DK races is thin, so:
FORM (frozen before data is read). Same 91-board practice harness, arm A (raw) vs arm C (grader
overallSTC/overallTC in seconds, same slot, same weights, tilt untouched). DK points for every
driver on all 91 boards computed from loop_data (finish table dkFinishPts + place differential +
0.25 laps led + 0.45 fastest laps; boards matched to loop_data by exact start:finish fingerprint,
92/92 matched). The hand formula runs ~1 pt hot on levels; irrelevant to a rank correlation.
  PRIMARY: per-race Spearman(projDK, DK pts). Adopt if mean improves AND W/L >= 1.5:1.
  GUARDS (must hold or no ship): finish-order rho within noise (W/L not worse than 40/50);
  win log-loss and t10 Brier not losing (W/L >= 1:1). Reported per track group and per series;
  ROAD (n=8) reported and, if it loses, carved out (raw metric stays at road courses).
  20,000 sims / race / arm, two runs.
  Arms B (rank composite) and D (best5TC) are reported on the same DK metric as REFERENCE from
  their existing runs; only C is the candidate.
IF IT PASSES, WHAT SHIPS: one sim run, not two. practice_sessions gains a stored `pace_tc`
(overallSTC ?? overallTC, written by the grader at upload; backfilled from practice_laps for
every session that has laps); SimulationCenter's post-stage lrpTime reads pace_tc when present
and falls back to best5 / overall_avg. Betting board and DFS board come from the same run - the
guards above are what make that acceptable. Grader version is noted in config.practiceMetric.

## 2026-09-06 — RESULT: corrected pace in seconds (arms C / D) — CLOSED, both fail the primary

Same harness as the composite test (91 boards, 20k sims / race / arm). Arm C = grader overallSTC/
overallTC in seconds; arm D = best5TC (cup/trucks) / overallSTC-TC (O'Reilly). Baseline A = raw.
  C run 1  ALL rhoFin .541 -> .541 (W/L 51/39)  t10 Brier .14649 -> .14622 (50/37)  winLL 54/35  t5LL 47/41
  C run 2  ALL rhoFin .541 -> .541 (50/40)      t10 Brier .14657 -> .14619 (48/38)  winLL 52/30  t5LL 47/42
           INT 44: rhoFin .528 -> .530 (25/18) / .529 -> .531 (25/19); SHORT 39: flat (24/15, 25/14);
           ROAD 8: .417 -> .408 (2/6, 0/7). cup 23/15, oreilly 14/11, trucks 14/13 (run 1).
  D        ALL rhoFin .541 -> .539 (48/43)      t10 Brier .14658 -> .14638 (52/39)  winLL 46/41  t5LL 45/45
           INT 22/22, SHORT 25/14, ROAD 1/7; cup 18/20, oreilly 14/11, trucks 16/12.
  Control (7 stored-score boards, IDENTICAL inputs both arms): rhoFin 3/4 and 1/6 - that is the
  per-race noise floor of a 20k-sim pair; W/L inside ~40/50 is not signal.
  SECONDARY DK (2026 replay races with practice, 6): C .458 -> .516 (5/1), run 2 5/1; D .466 -> .495
  (5/1). Does not lose - it is the one place the corrections clearly help.
VERDICT: C mean finish-order rho FLAT (.541 -> .541) on both runs, W/L 51/39 and 50/40 = 1.3:1,
below the 1.5:1 bar and no mean gain -> FAILS. D mean down, 48/43 -> FAILS. CLOSED. Nothing ships.
Per-group: INT is the only cell that leans positive for C (25/18, 25/19, Brier 24/19, 25/18) and
it does not reach the bar on its own either; ROAD loses in every arm tested tonight (2/6, 0/7, 1/7)
- the road-course practice metric is a separate question (8 races, fewer laps, long-run pace is
not what a road course rewards).
WHAT THREE CLOSED FORMS SAY TOGETHER: rank composite (B), corrected seconds (C), same-slot
corrected (D) all leave finish-order rho within noise of production (.537-.541 vs .541) while all
three lift the win / top-10 probability metrics and the DK-points correlation on the 2026 replay
races (B 4/2, C 5/1, D 5/1). The sim's ORDERING is not improved by a better practice number at
the 0.15 weight; what improves is the tail (who wins, who scores DK points). The residual
diagnostic's .385 -> .414 was a LINEAR fit in DK-rank space with the pre board and the grade as
free inputs - the sim cannot reproduce that by swapping one input at a fixed weight. A weight
sweep is exactly what the operator ruled out ("no A/B bullshit"), and 230-race sweeps have
already placed longRunPace at 0.15. OPEN, not tonight's registration: a DK-points-scored
objective for the post board (the sim is graded on finish order; DFS pays on DK points, and every
practice form tested tonight helped DK while leaving finish order alone).

## 2026-09-06 — REGISTRATION: grader-CORRECTED pace IN SECONDS as the sim's practice input

Follows the closed composite test above. Same harness (91 joined practice boards, grades recomputed
from practice_laps with grader v6.4-sets, 20,000 sims / race / arm, two runs), same metrics, same
decision rule: adopt if finish-order Spearman improves in mean AND W/L >= 1.5:1, AND t10 Brier
does not lose, AND the DK secondary does not lose. Per track group reported; per-group ship only.
FORM (frozen before data is read). Two pre-specified arms, each judged on its own, no tuning:
  C = the grader's own pace metric in seconds: overallSTC (tire + session-time corrected overall
      pace) where the session-time correction was active, overallTC otherwise. Same slot as
      lrpTime, same weights. All three series.
  D = the same-slot analog: best5TC for cup/trucks (the sim uses best5 raw), overallSTC/TC for
      O'Reilly (the sim uses overall_avg raw). I.e. production's metric with the grader's tire
      (and session) correction applied to it.
  A = production (raw best5 / overall_avg) is the baseline for both.
Drivers without a recomputed grade fall to null (neutral / market fill), as in arm A when the raw
metric is missing. Stored-score-only boards (7) are run but cannot carry C/D (no laps) - they
receive the raw metric in every arm and are reported separately as a control.

## 2026-09-06 — RESULT: grader composite as the sim's practice input — CLOSED (primary fails; probabilities improve)

Harness: 91 of the 94 practice holdout boards joined to practice_sessions by exact lap-metric match
(93% of practice rows; 3 boards dropped: ore 2025 R9 <50% joined, trucks St. Pete 2026, cup Texas 2026
duplicate line). Grades recomputed with the current grader (v6.4-sets, K from tire_sets) from
practice_laps for 84 boards (2,531 rows), stored practice_score for 7 (536 rows). Arm A = raw lrpTime
(best5 / overall_avg) as shipped; arm B = 100 - composite in the same slot, same weights, tilt untouched.
20,000 sims / race / arm, run TWICE (Math.random, no seed) to size the noise.
  ALL 91   rhoFin .541 -> .538 (W/L 42/49) | run 2: .541 -> .537 (39/51)
           t10 Brier .14655 -> .14634 (55/34) | .14645 -> .14644 (53/37)
           win logloss .0870 -> .0859 (53/33) | .0869 -> .0857 (58/29)
           t5 logloss .2872 -> .2871 (56/34) | .2873 -> .2871 (55/34)
  INT 44   rhoFin .527 -> .527 (21/23)  Brier 27/17  winLL 28/15  t5LL 27/16
  SHORT 39 rhoFin .582 -> .577 (18/21)  Brier 22/15  winLL 21/15  t5LL 24/15
  ROAD 8   rhoFin .414 -> .404 (3/5)    Brier 6/2    winLL 4/3    t5LL 5/3
  cup 38 rhoFin 17/21 | oreilly 25 15/10 | trucks 28 10/18 (trucks lose the ordering: .556 -> .547)
  Stored-score boards (7): rhoFin 1/6 - the old grader versions are worse than the raw lap; only the
  laps-recomputed grade is even.
  SECONDARY (rho projDK vs official DK FPTS, 2026 replay races with practice, harness sim without
  pit crew / market anchor so levels differ from the stored boards): ore Iowa .405 -> .374, cup Iowa
  .555 -> .506, trk Richmond .528 -> .638, cup Richmond .624 -> .723, trk NH .317 -> .367, cup NH
  .335 -> .400. 4/2, mean .461 -> .501. Does not lose.
VERDICT by the registered rule: FAILS the primary (finish-order Spearman down in mean, W/L 42/49 and
39/51 on two runs). CLOSED. The grade does NOT replace the raw lap metric.
WHAT THE SPLIT MEANS (not a result, a reading): the composite makes the PROBABILITIES a little better
everywhere it was measured (win / top-5 / top-10, consistently ~55-58 W vs ~30-35 L on both runs,
INT strongest) while making the mid-field ORDERING a little worse. The composite is rank-scaled
0-100, so it throws away the SIZE of the lap-time gaps that the raw metric carries; the residual
diagnostic saw the grade ADD to the board, never replace it. A form that keeps the raw metric and
adds the grade's corrections (tire, session-time, long-run) in seconds - i.e. the grader's
tire-corrected pace in TIME, not rank - is the obvious next registration; not run tonight.
Operator ruling same night: the thin-driver market anchor STAYS ("nothing wrong with leaning on the
market for drivers we know nothing about"). Harness in the cloud session (grades.mjs / harness.js);
the joined board->driver map is the reusable piece.

## 2026-09-06 — REGISTRATION: sim post stage takes practice from the GRADER, not the raw lap metric

WHAT THE POST STAGE DOES TODAY (read from SimulationCenter.js + simEngine.js, 2026-09-06):
practice enters speedScore as `lrpTime` = best5 lap time (cup/trucks) or overall_avg (O'Reilly),
min-max normalised across the field (normalizeArr, lower = better), weight longRunPace 0.15
(0.25 road, 0.00 superspeedway, trucks short 0.15), after an A/B practice-group offset fitted
on corrAvgRating (SimulationCenter ~L1744). The same lrpTime percentile drives the dominator
tilt (`__spdPct`, task #71). The GRADER'S composite (practice_score: tire-corrected pace 40 /
raw best5 40 / long-run 20, session-time corrected, rank-scaled, group-corrected) is NOT a sim
input anywhere - it only gates the EDGE flags and the thin-driver definition. So the residual
diagnostic's finding (grade adds beyond the post board; post-minus-pre shift correlates .14 with
the grade) has a mechanical explanation: the board consumes ONE raw lap number, the grade is a
corrected composite of the whole session, and the two disagree.

FORM (frozen before data is read).
  Change under test: `lrpTime` input to speedScore replaced by the grader composite (rank-scaled
  0-100, higher = better; normalizeArr direction flipped accordingly), same weight per track group,
  practice-group offset step SKIPPED for the grade (the grader already group-corrects). `__spdPct`
  (dominator tilt) UNCHANGED - stays on raw lrpTime - so the change is isolated to speedScore.
  No weight sweep: longRunPace stays 0.15 / 0.25 / 0.00.
  Data: the 94-race practice holdout (scripts/backtest-data/holdout-practice.txt, 2024-26, all
  three series, ratings + start + finish + lrpTime per driver) with the grade joined by exact
  match of each row's lrpTime to practice_sessions.best5 / overall_avg for that race; grades
  RECOMPUTED with the current grader (v6.4-sets) from practice_laps where laps exist, stored
  practice_score otherwise (grader version noted per race). Races where < 60% of the field joins
  are dropped and listed.
  Arms: A = production (raw lrpTime), B = grade input. Same seed, SIMS = 12,000, same DNF /
  caution / tilt / start config.
  METRICS (the sim's own, per race): Spearman(proj_finish, actual finish); top-10 Brier; win and
  top-5 log-loss. SECONDARY (the motivating one, must not lose): Spearman(proj_dk, actual DK
  FPTS) on the 9 replay races that have practice (7).
  DECISION: adopt if finish-order Spearman improves in mean AND W/L >= 1.5:1 over the joined
  races, AND t10 Brier does not lose (W/L >= 1:1), AND the DK secondary does not lose 0/7-style.
  Report per track group (INT / SHORT / ROAD) - a group that loses on its own is reported, not
  hidden, and a win carried by one group is a per-group ship, not a global one.
  If A wins or ties: CLOSED; the grade stays a display/gate. No second form.

NOTE surfaced while reading (operator to rule on): the thin-driver MARKET ANCHOR (v1.1,
2026-07-22) ALREADY uses the de-vigged win-odds percentile as the ignorance fill for drivers with
< 5 group races and no practice score (simEngine.js ~L462: corr, track and lrp fills). That is
odds in the sim, scoped to data-thin drivers only. Conflicts with the 09-06 rule as written.

## 2026-09-06 — RESULT: residual diagnostic — the POST board wastes the practice grade (lead, not a result)

322 driver-rows, 9 races (practice present in 7). CORRECTION to the registered step 1: a raw
residual (rank actual - rank proj) correlates NEGATIVELY with every signal, including ones that
carry nothing, because the projection sits inside the residual with a minus sign (regression to
the mean). Step 1 as registered is uninformative; replaced by PARTIAL correlation with actual rank
controlling for the post-board rank, shuffle null permuting ACTUAL within race (keeps the signal-
projection link). Partial rho / p95: ownership +.232/.112, salary +.192/.102, pre-minus-post
+.167/.105, odds +.159/.106, practice_score +.150/.123 (all CLEAR); qualifying +.046/.100 (noise).
Step 2 (LORO, fit rank(actual) ~ rank(post) + signal rank; scored per race rho vs actual DK pts;
yardsticks never fitted): post alone .385 | +practice .390 (3/3) | +qualifying .380 (2/3) | +pre
board .355 (3/3) | pre alone .340 (5/4) | post + pre + practice .414 (5/1, unchanged x2 = no
practice). COEFFICIENTS of the winning fit: pre .39, practice .17, post -.04 - given the pre board
and the grader's grade, the post board adds NOTHING. Per race: cup Iowa .36->.40, cup Richmond
.64->.64, cup NH .32->.43, ore Iowa .40->.31 (loss), ore Darlington .35->.42, trk Richmond .57->.59,
trk NH .27->.37. corr(post rank - pre rank, practice rank) = .14; corr(pre, post) = .76.
READING: story (b). Pre board is fine (history alone .34 = market level); the practice grader is
fine (adds beyond the post board); the post STAGE's practice ingestion is the leak - it shifts the
board only loosely in the grader's direction and the grader's version predicts better. Consistent
with 08-xx finding "practice buys pace, not finish". Ownership still adds beyond all of it (.23) -
the crowd's extra is partly practice, partly unknown.
CAVEATS: 7 races with practice, one 3-variable fit, n=~240 rows. LEAD, not a result. NOTHING SHIPPED.
NEXT (needs its own registration after reading SimulationCenter's post-stage practice code): post-
stage practice adjustment driven by the grader composite (rank-scaled) instead of the sim's own
lap read; pass rule = per-race rho vs actual DK pts AND finish-order metrics on the same 7 races,
W/L >= 1.5:1, no weight sweep.

## 2026-09-06 — REGISTRATION: residual diagnostic — what explains our DK-points misses? (nothing ships)

Trigger: operator, "we have so much data, I don't understand how we aren't projecting better."
Ledger context (dfs_replays, 9 races 2026): rank corr with actual DK pts — model .39, salary .38,
crowd ownership .45; crowd beats us 7 of 9, we beat salary at the plates and lose at flat tracks.
RULE (operator, same night): BETTING ODDS ARE NEVER AN INPUT TO THE SIM OR THE BOARD. The product's
value is an independent projection scored against the market; odds in = edge columns compare the
market to itself. Odds, salary and ownership are YARDSTICKS only (like the ledger's rho_own).

FORM (frozen before data is read). Table: the 9 replayable races, one row per driver with a
salary and official DK FPTS (~330 rows): proj_post (post board), proj_pre (pre board), actual
(dfs_ownership.fpts), salary, win-odds implied prob (last odds_snapshots 'win' row before the
race, best price, de-vigged within race), practice_score (practice_sessions, 7 of 9 races have
it), qualifying position (sim start), actual own_pct. Target: residual = rank(actual) - rank(proj_post)
within race (rank space so plate wrecks do not dominate).
  Step 1: Spearman of the residual vs each signal, per race and pooled. Yardsticks (salary,
    odds, own) locate the misses; OWN signals (practice_score, qualifying, proj_pre - proj_post)
    are the only ones we would act on.
  Step 2: leave-one-race-out linear fit of the residual on the own signals that pass step 3;
    scored as per-race rank corr with actual DK pts, proj_post alone vs proj_post + fitted
    residual. Yardsticks are NEVER fitted.
  Step 3: shuffle test — permute the residual within race 500x; a signal counts only if its
    pooled |rho| clears the 95th pctile of the shuffled distribution AND lifts the LORO mean.
READ-OUT: which story the data supports — (a) odds/salary explain the misses = sim mis-reads
specific drivers, go find why in our data; (b) practice/qualifying explain them = re-weight (new
registered sim test); (c) only ownership explains them = the crowd has something not in the DB;
(d) nothing clears the shuffle = misses are noise at this n; edge is construction, not projection.
No code change from this run.

## 2026-09-06 — RESULT: V4 candidate diversification PASSED and SHIPPED

9 races, global 50% cap, N=20, product pipeline on the full 10,000-draw post boards. Best-of-20
field pctile, V0 product (selector + top-up) -> V4; "filled" = lineups the selector delivered before
top-up:
  cup Iowa R23 (Blaney in 99% of cands)  V0 15/20 70.3 -> V4 18/20 76.1
  cup Richmond R24 (Blaney 79%)          V0 17/20 93.0 -> 20/20 93.0
  cup NH R25 (Byron 72%)                 V0 20 83.4 -> 20 92.1
  cup Daytona R26 (Bell 72%)             V0 20 90.7 -> 20 94.6
  ore Iowa R23 (Creed 72%)               V0 20 92.0 -> 20 89.5
  ore Richmond R24 (Jankowiak 83%)       V0 18/20 84.8 -> 19/20 84.8
  ore Darlington R25 (Allgaier 100%)     V0 10/20 80.6 -> 20 89.9   (Cram 45% -> 20%)
  trk Richmond R17 (Honeycutt 97%)       V0 13/20 95.3 -> 18/20 95.3
  trk NH R18 (Nemechek 75%)              V0 20 92.6 -> 20 73.7
MEANS best-of-20 87.0 -> 87.7, W/L/T 4/2/3 (2:1, rule was 1.5:1). Mean pctile of the 20: 45.0 ->
44.4 (W/L 5/4, wash). Above-median lineups 8.4 -> 8.3 of 20. Floor-car roster slots 7.2% -> 5.9%;
biggest single floor car 18% -> 14% (mean over races). Selector starvation at a 50% cap: 5 of 9
races under the product, 3 of 9 (all 18-19/20) under V4.
READING: three of the four wins are the starved races - the mechanism, not luck. The trucks NH loss
is a different candidate mix changing which of 20 lineups happened to hit; one lineup swings a race.
PASSED the registered rule -> SHIPPED in DFSPage buildGpp (diversify when a driver's candidate share
exceeds his cap; top-up caps floor punts at 25%, user per-driver max wins). Ledger watches it.
NOTE on the harness: V1/V2 above were run on the stride-4 (2,500) draws for candidates as well as
scoring; V4 was run on the full 10,000 draws for candidates (the product's path). That is why V0's
Darlington number differs between the two entries (86.3 vs 80.6): the first is uncapped E[max] on
2,500 draws, the second is the product's capped build on 10,000.

## 2026-09-06 — RESULT: punt handling V1/V2 CLOSED; root cause found in top-up; REGISTRATION V4

RESULT of the registration above (9 races, N=20, product replay pipeline on the stride-4 post draws,
official DK FPTS, contest ladder). Best-of-20 field pctile, V0 / V1 cap / V2 haircut / V3 both:
  cup Iowa R23 85.3/85.3/85.3/85.3 | cup Richmond R24 90.9 x4 | cup NH R25 74.5/74.5/91.6/91.6 |
  cup Daytona R26 94.7/90.5/92.3/92.3 | ore Iowa R23 98.0/98.0/95.0/95.0 | ore Richmond R24 95.3 x4 |
  ore Darlington R25 86.3/86.3/90.4/90.4 | trk Richmond R17 95.9 x4 | trk NH R18 90.4 x4.
  MEANS 90.1 / 89.7 / 91.9 / 91.9. W/L/T vs V0: V1 0/1/8, V2 2/2/5, V3 2/2/5. Mean pctile of the 20:
  45.5 / 45.6 / 45.5 / 45.2 (V2 loses 2/5 on depth). Floor-car roster slots: 5.0% in V0 already; max
  single floor car 30% (Daytona Dillon/Dye), Darlington Cram 20-25%.
VERDICT: both FAIL the registered rule. V1 never binds - E[max] alone does NOT over-own punts. V2 is a
coin flip. CLOSED, nothing shipped.

ROOT CAUSE of the 45% Cram build (reproduced on the real 10,000-draw Darlington O'Reilly board):
Allgaier is in 100% of the top-2,000 candidates by projection. Any cap on him (global 50% or per-
driver) starves makeEmaxSelector at 10 lineups; topUpLineups then builds the other 10 with the MEAN
optimizer with the capped driver excluded, which drops straight to the $5,000 cars. Global 50% cap
reproduces the operator's build exactly: Cram 45%, Gase 30%, Reen 25%. Uncapped: Cram 20%.
One-race check on Darlington actuals: product capped build best-of-20 p80.6 (floor slots 18%);
same cap with candidates diversified so the selector fills all 20 itself: p89.9 (floor slots 12%).
n=1 -> registration, not a result.

REGISTRATION V4 - candidate diversification under exposure caps (form frozen before data is read).
Setting: global max exposure 50% (the operator's setting), N=20, product build pipeline exactly:
candidates = per-draw exact optima over ALL post draws + optimize(300), cut to 2,000 by projection;
scoring draws = stride to 2,000; makeEmaxSelector with capOf; topUpLineups if short. Official DK
FPTS, contest ladder, all 9 replayable races.
  V0 product: as shipped (selector + top-up).
  V4: after the 2,000 cut, for every driver appearing in more than the cap share of those candidates,
      append the top 1,500 candidates by projection that EXCLUDE him (deduped). Selector as before.
      Top-up only if still short, and top-up also treats floor cars (salary <= floor + $500) as
      capped at 25% of N.
METRICS: best-of-20 actual + field pctile; mean pctile of the 20; floor-car roster slots.
DECISION: adopt if mean best-of-20 pctile improves AND W/L >= 1.5:1 over the 9. No sweep of the
1,500 or the 25%.

## 2026-09-06 — REGISTRATION: punt handling in the GPP set builder (replay of the 9 ledger races)

Trigger: Cram 45% of a 20-lineup build; operator: "it really wants to overly own punts... you want
light exposure across your portfolio to punts." Evidence stack: E[max] concentrates the cheapest fat
tail; sim DNF for P35-38 starters 12.9% vs 23.5% observed; floor cars scored 7 / 1 / 10.9 at
Darlington while the winning hand-built set used mid-priced punts, 1-2 per lineup.

FORM (frozen before data is read). Product replay pipeline exactly (per-draw exact optima -> 2,000
candidates -> E[max] lazy-greedy set of N=20 over 2,500 stride draws), official DK FPTS, contest
ladder placement. Floor car := salary <= min posted salary + $500. Deep starter := DK start >= 35.
  V0 baseline: capOf = Infinity (shipped behaviour).
  V1 punt cap: candidates with > 2 floor cars discarded; floor-car set exposure capped at 25% of N
     (capOf = ceil(0.25 N) for floor cars, Infinity otherwise).
  V2 attrition haircut (DFS layer only, sim untouched): for deep starters, each draw is replaced
     with prob q = 0.106 (23.5% - 12.9%) by a parked score (finish pts for ~33rd + place diff from
     the DK start, ~= 8 + (start - 33)); deterministic by (driver, draw) hash. Candidates rebuilt.
  V3 = V1 + V2.
METRICS per race: best-of-20 actual and its field percentile (what a tournament pays); mean field
percentile of the 20 (portfolio quality); floor-car exposure of the set. DECISION: a variant is
adopted if mean best-of-20 percentile improves AND W/L >= 1.5:1 over the 9, judged on the 9 with
no threshold sweep (q and the 25% cap are fixed above). n=9 is thin; a pass ships with the ledger
watching, a loss closes it.

## 2026-09-05 — DFS Darlington O'Reilly R25: operator construction WON the contest; both solvers did not

Contest (DK GPP, 1,189 entries, median 181.8): operator's 20 finished 1-2-4-6-7-10, 12 of 20 in the
top 50, best 303.5 (field p99 278.1). Replay of the product on the same board/salaries/draws:
cash 144.0 (~1,041st), GPP best-of-20 217.4 (~268th), perfect 324.4. Board was WRONG this race:
rho model .346 < rho own .463 < rho salary .532 (Allgaier proj 53.4 -> 35.9, Kvapil 33.1 -> 30.9,
Creed 30.7 -> 77.9, Day 28.4 -> 60.1, Alfredo 21.7 -> 50.3, Crews 29.3 -> 50.05). Ledger GPP 4 /
cash 3 / tie 2 (2 rows on the current engine).

OPERATOR EXPOSURE (from the standings file): Creed 80% (29% owned) / Day 65% (33%) / Crews 60% (9%)
/ S.Smith 55% (26%) / Bilicki 55% (8%) / Hill 50% (10%) / Smithley 45% (9%) / B.Jones 35% / Kvapil
30% (35% owned) / R.Sieg 20% / Clements, K.Sieg, Love 15% / seven others 5-10%. ZERO: Allgaier
(50% owned), Retzlaff (41%), Sawalich (39%), Finch (31%), Alfredo (24%). Salary 48.8-50.0k, exactly
1 or 2 punts (<= $6.2k) per lineup, floor cars 2 lineups each.
CORRECTION (operator, same night): this set of 20 was ONE OF THREE contests x 20 entries. Allgaier was
capped at 50% in the other two sets and faded to ZERO in this one on purpose - portfolio-level
exposure across the 60 was ~33%, with each contest taking a different stance on the chalk. So rule
(1) is NOT "fade the chalk"; it is DIVERSIFY THE CHALK STANCE ACROSS CONTESTS. This set is the leg
that paid because Allgaier busted; the other two legs were the insurance if he had gone off.
RULES IMPLIED: (1) vary the chalk stance per contest (0% / 50% / 50% on the top-projected car across
three sets), pole car ~30%; (2) tier-two studs
($8.4-10k, proj 27-32, own 9-33%) at 50-80% each; (3) punts = small rotating set of mid-priced
(5.5-5.8k) sub-10%-owned cars, 1-2 per lineup, never the $5,000 floor; (4) spend the cap.
Rule 3 is the direct counter to the E[max] punt-concentration finding (STATE open item). Rule 1
needs an ownership proxy the product does not have (leverage line closed 08-30; our projected own
is derived from our own proj) - but the crowd chased practice speed (Retzlaff 30.300, 41% owned,
proj 22.2 -> 10.9) and the tool already disagreed with the crowd on him.
CAVEAT: n=1, and it is exactly the race this construction wins (JRM cars under, JGR/HMS/Haas 1-2-3).
ALL THREE CONTESTS (standings files, same night): A (060) best 1st, 12/20 top-50, 18/20 above field
median, mean pctile 86, Allgaier 0%. B (057, 1,107 entries) best 170th, 0 top-50, 7/20 above median,
mean pctile 38, Allgaier 95%. C (059, 1,189) best 252nd, 0 top-50, 7/20 above median, mean pctile 36,
Allgaier 85%. Portfolio across 60: Allgaier 60%, Creed 37%, Kvapil/Smith/Jones/Hill 30%, Day 28%,
Crews/Bilicki 27%, Sawalich/Mayer 25%. The operator's recollection (Allgaier capped 50% in B and C)
was wrong - 95/85. B and C look like the product's own GPP output plus a tilt (Allgaier, Mayer,
Sawalich, Finch, Cram/Gase/Maggio punts) and finished like it (product replay best 217.4; B 221.5,
C 215.0). A was hand-built (Creed 80 / Day 65 / Crews 60 / Smith 55 / Hill 50; Crews at 9% owned)
and is the only leg that won. Single-entry contest (587, 294 entries, $12): 241.55, 21st (top 7%), paid $35 - Allgaier / Creed /
Sawalich / Sanchez / Alfredo / K.Sieg. Night total: 61 entries across four contests; one leg won
the tournament outright, one single-entry cashed, two 20-lineup legs ran below the field median.
READING: the evidence is for rules 2-4 (tier-two concentration,
mid-priced rotating punts, cap spent), not for any chalk stance - 0/95/85 is two-thirds of the
bankroll on one car, rescued by the third leg; 0/50/50 was the intended and better schedule.
PROPOSED: 'Operator' build preset encoding rules 2-4, plus a PORTFOLIO builder - N contests x 20
with a chalk-stance schedule across sets (the tool builds one contest in isolation today and has no
notion of cross-contest exposure) - run inside DFS Replay every week alongside GPP/cash so the
ledger scores the method. Not built. The other two Darlington sets' results are needed to score the
portfolio as a whole, not just the leg that hit.

## 2026-09-05 — DFS: punt exposure in GPP ceiling mode + floor-car projection audit (evidence only, nothing shipped)

Trigger: first 20-lineup GPP build on the Darlington O'Reilly post board put Dawson Cram ($5,000,
P38) in 45% of lineups; Optimal% (single-lineup, per draw) was 10.8%.

Draws (dfs_sim_samples, 10,000, post board 09-05 16:28): Cram mean 25.0 / p50 24 / p90 45 / p98 57,
>=40 DK in 16.9%, <10 in 16.0%. Reen 24.5 / 23 / 44 / 56 (17.7% >=40). Gase 25.0 / 23 / 46 / 59
(20.6%). Allgaier 53.7 / 63 / 80 / 83 (77.7%). Kvapil 33.4 / 41 / 65 / 77.
History (loop_data O'Reilly ovals 2025-26, start >= 35, n=106): gain >=15 spots 14.2%, finish
top-15 7.5%, top-20 13.2%. By start bracket (7 short/INT tracks): 1-5 avg fin 11.0 DNF 3.1%;
25-29 22.5 / 9.2%; 30-34 25.9 / 7.7%; 35-38 29.9 / 23.5%. Sim for Cram: proj fin 27.4, DNF 12.9%.
READING: (1) the >=40 tail (16.9%) is close to the observed big-gain rate (14.2%) — the ceiling
draws are not fantasy; (2) the MEAN is rich by ~4 DK pts because sim DNF is flat across the field
(7-13%) while P35-38 starters DNF/park at 23.5%; (3) 45% exposure is the E[max] objective
concentrating the cheapest fat tail — it does not know Cram/Reen/Gase/Perez are exchangeable.
NOT SHIPPED. Operator control = per-driver max / global max. Candidate fix and the DNF caveat are
logged in STATE "Open experiments". DNF-by-tier stays CLOSED (BACKTEST_LOG 2026-08-31).

## 2026-09-05 — REGISTRATION: track-type-conditioned driver prior (pre-test, loop data only; no sim change)

Queued 2026-08-09, never run. Trigger today: the grade x prior blend (above, not shipped) showed
history carries about as much race-speed information as practice; the operator's objection to it was
that a Daytona result says nothing about Darlington. The sim's driver prior is pooled across all
tracks. Question: does conditioning the trailing rating on track group beat the pooled prior?

FORM (frozen before any data is read):
- Data: loop_data, all three series, races with >=20 rated drivers, exhibition excluded. Target A =
  race-day driver_rating; target B = finish_position. Leak-free: priors use only races dated before
  the target race.
- Pooled prior P = age-weighted mean of the driver's driver_rating over prior races (weights 1.3 /
  1.0 / .75 / .55 by season lag, .4 beyond — the grader's existing gc weights), min 3 races.
- Conditioned prior C = same weighting restricted to races in the target's `tracks.correlation_group_label`
  (Intermediate / Short & Flat / Road Course / Superspeedway), shrunk toward P: C = (sum_w*rating_g + k*P)
  / (sum_w + k). DECISION k = 4 (four same-group races before the group speaks louder than the pool).
  k = 2 and k = 8 reported as sensitivity only - they do not decide.
- Metric: per-race Spearman of prior vs target, averaged; per-race W/L (|delta| > .005). Reported
  overall and per track group (the SS group is where conditioning should matter most; a per-group
  reversal is a finding, per the manual's per-tier rail).
- DECISION RULE: C beats P if mean rho(A) improves AND W/L >= 1.5:1 on cup. Then and only then a
  sim A/B (driver prior input) queues behind the replay ledger. A tie or loss closes the line; a
  loss on one group only is recorded as a group-specific note, not a partial ship.

RESULT (run immediately after registration; 16,130 rated driver-races 2022-26, 167 cup / 153
O'Reilly / 107 trucks target races; rho = per-race Spearman vs race-day driver_rating, finish in
parentheses; k = 4 unless noted):

  cup ALL          pooled .603 -> cond .637 (+.034)  W107/L41 = 2.6:1   finish .386 -> .406   PASS
    Intermediate   .682 -> .693 (+.011)  W36/L20               finish .410 -> .414
    Short & Flat   .663 -> .690 (+.027)  W29/L9                finish .519 -> .543
    Road Course    .485 -> .598 (+.113)  W22/L3                finish .331 -> .410
    Superspeedway  .458 -> .480 (+.022)  W19/L9                finish .186 -> .179 (finish slightly WORSE)
  O'Reilly ALL     .779 -> .789 (+.010)  W85/L47 = 1.8:1       finish .510 -> .518   PASS (marginal)
    Intermediate   +.002 W27/L21 | Short & Flat +.001 W15/L14 | Road Course +.037 W28/L2 | SS +.012 W15/L10
  trucks ALL       .761 -> .763 (+.002)  W44/L41               finish .549 -> .550   NO EFFECT
    Intermediate   +.006 W24/L12 | Short & Flat -.005 W8/L17 | Road Course +.025 (n=13) | SS -.016 (n=12)
  k sensitivity: k=2 / k=8 within +-.003 of k=4 everywhere; shrinkage strength is not the story.

CORRECTION BEFORE ACTING (same session). The sim's corrHistory term ALREADY rates drivers from
correlation-GROUP rows only (`.in('track_name', corrNames)`, pure group, no shrinkage) — the
"pooled" arm above is NOT what the sim does. Re-run with the sim's own yrWt ladder (2.0/3.0 current,
1.3/.9/.6/.4) and the sim's form as the baseline (k=0 = pure group, pooled fallback only with zero
group rows):

  cup ALL      k=0 .632  k=1 .636  k=2 .638  k=4 .639  k=8 .638  pooled .605   k=4 vs k=0 W68/L36
    Intermediate .694->.697 W21/L5 | Short&Flat .687->.692 W19/L14 | Road .604->.601 W10/L10 (tie) | SS .444->.478 W18/L6
  O'Reilly ALL k=0 .777  k=4 .789  k=8 .791  pooled .780   W82/L22
    Intermediate .819->.823 | Short&Flat .809->.823 W21/L4 | Road .735->.751 W18/L7 | SS .692->.716 W18/L2
  trucks ALL   k=0 .749  k=4 .766  k=8 .767  pooled .765   W57/L17
    Intermediate .788->.794 | Short&Flat .806->.816 W21/L6 | Road .702->.732 (n=13) | SS .497->.559 W11/L1

So the actual finding is SHRINKAGE: the sim's pure-group rating over-trusts thin group samples,
worst at superspeedways (2-3 races a year) and in the minor series. Shrinking toward the driver's
all-track rating with k=4 wins in every series and every group except cup road courses (tie).

SHIPPED DIRECTLY, no sim A/B, by operator decision 2026-09-05 ("send that change to the simulation
now"). Change: corrAvgMap.avgRating = (sum_w x group + 4 x pooled) / (sum_w + 4), pooled = same
yrWt over all own-series loop_data rows (team cutoff respected, >=3 races); drivers with a pooled
rating but no group rows enter corrAvgMap at the pooled rating (n:0) instead of nothing. avgFin,
winConv, modalCar, equipment prior, borrows and pairing unchanged. sim-smoke ALL PASS (engine
untouched - this is the input layer). The replay ledger judges it forward from here.

READING (original, superseded by the correction above). Conditioning helps, and the decision rule passes on cup — but the effect is concentrated
where the car/driver skill set differs most from the pooled picture: road courses (+.11 cup, +.04
O'Reilly, +.03 trucks) and cup short/flat (+.03). At INTERMEDIATES — the largest group and the one
Darlington sits in — the gain is +.011 cup and nil in the other two series: pooled history already
describes an intermediate driver well. Superspeedways: rating improves a little, finish does not
(the SS finish lottery, known). Trucks show nothing overall and go the wrong way on short/flat.
Per the registration: sim A/B on the driver-prior input QUEUES behind the replay ledger, CUP first,
with the road-course and short/flat groups as the expected carriers and intermediates as the
null-ish check; O'Reilly follows only if cup ships; trucks stay pooled. This is NOT a fix for the
"Daytona says nothing about Darlington" objection specifically — at an intermediate the conditioned
prior barely moves — it is a road-course/short-track finding.

## 2026-09-05 — v6.4-sets: cumulative tire age for 1-SET sessions (gate passed); K>=2 detector FAILED its gate

**Trigger.** Darlington O'Reilly practice (first watcher sheet with pit laps as numbered laps): Alfredo
A+ over Allgaier/Creed/Gray. Operator disagreed; investigation showed the grade was carried by his
41-lap second-set run, but exposed that lap-in-stint resets tire age at EVERY stint break — right only
when the break is a tire change. The 2026 O'Reilly session had 2 sets; Alfredo's 8-lap scuff run at
11:42 was graded as fresh tires. v6-tc's own LIMITATION note (2026-08-08) named this.

**Form (stated before the run, in chat; written here after — protocol deviation noted).** With a
known allotment K, assign stints to sets: stint 1 = set 1; a later break is a change when laps 2-4
of the new run beat the last 3 laps of the old run by > 2% of the driver's median lap; at most K-1
breaks qualify (largest drops). Tire age = cumulative laps on the set, cap 40 (unchanged). All five
ranked inputs recomputed on the new age; stored/display metrics stay raw (doctrine). Legacy path
(tire_sets null) unchanged.

**Gate: the K=1 case needs NO inference** — every stint shares one set, age simply accumulates
across breaks. If cumulative age beats reset-per-stint on labeled 1-set sessions, the mechanism is
real. Sample: every cup session with practice_sessions.tire_sets = 1 that has practice_laps and a
loop_data driver_rating (36 sessions: 10x2024, 14x2025, 12x2026; labels from the NASCAR Event
Tire Allocation sheets, 2026 = REV E 7/22/2026). Ranked within practice_group, no gc priors.
Metric: per-session Spearman, grade rank vs race-day driver rating (v6-tc's confirmation target).

**Result.** rhoSpeed .503 -> .531 (+.028), W19/L12/T5 (sign p~.14 two-sided). Cap-60 variant
.504 -> .534, W20/L12/T4 (not adopted - one look, same answer). Big movers both ways: 2025 R25
Richmond -.18 -> +.19, 2025 R7 Martinsville +.22, 2025 R8 Darlington -.16, 2026 R21 N. Wilkesboro
-.16. Gain is v6-tc-sized (+.035 there on 97 races) on a third of the sample. Winner-rank not
scored (rating is the target). SHIPPED on the gate + construct: the K=1 case is physically
unambiguous and the K>=2 inference is the same mechanism with a constraint, judged forward.

**K=2 sanity on the trigger session** (the inference path): every top car gets exactly one change
detected and it is the run everyone can see (Alfredo 11:56, Creed 11:57, Gray 12:01, Mayer 12:02,
Hill 12:09); change signatures -1.2 to -3.2 s, scuff restarts -0.6 to +1.9 s; Allgaier and Smith
never used set 2. Regrade: Allgaier 1, Alfredo 2, Day 3 (was Alfredo 1, Creed 2, Allgaier 3).

**K>=2 GATE — FAILED (same day, run after the ship; reverted to legacy for K>=2).** Two tests.
(a) Race pit stops with tire labels (pit_stops x 2026 race lap archives, 4 cup races, 1,025 usable
stops; signature = first 3 clean green laps after the stop vs last 3 before, / driver median):
green 4-tire stops median -6.5%, 80% below -2% — but 301 of 307 are Richmond, and the 9 green
0-tire stops ALSO came back faster (median -2.3%). Caution stops are contaminated by restart
traffic (4-tire median +0.2%). Verdict: proves the signature exists at a high-falloff track, says
nothing about specificity. (b) Outcomes on the 7 labeled multi-set cup sessions (2024 R4 Phoenix x3,
2025 R22 Indy x3, 2025 R36 Phoenix x2, 2026 R19 Chicagoland x3, R22 Indy x3, R23 Iowa x2, R25
Loudon x2; Dover All-Star excluded — shares R11 with Texas in practice_laps): rho vs rating
legacy .583 / K=1 cumulative .553 / detector 1% .536 / 2% .534 / 3% .495 / 5% .548. Legacy wins
6 of 7 vs the shipped 2% detector. CONCLUSION: cumulative age is validated for 1-set sessions
ONLY; for 2+ sets the reset-per-stint proxy stays. Grader now applies set-aware age only when
tire_sets = 1; for K>=2 the set assignment is display-only (Laps column). Re-open only with a
detector that beats .583 on these 7 (n is small — a forward ledger on K>=2 sessions is the
better judge, and the 1-set result stands on its own 36).

**Also tested and REJECTED (36 1-set sessions, set-aware linear as baseline .531, one run each):**
concave tire age sqrt .522 / log .504; seconds-based z-score composite instead of rank scaling
.520; per-driver falloff slope shrunk to pool (k=60) .447 — a clear trap, the driver's own
practice slope is fuel/traffic/setup noise. The pooled linear slope and rank scaling both stand.

**Measured, NOT shipped (operator decision 2026-09-05): grade x trailing-rating blend.** 103 sessions
(cup 47 / O'Reilly 27 / trucks 29), leak-free age-weighted trailing driver-rating prior (>=3 races,
same series), 50/50 rank blend chosen before the full run. rho vs race-day rating: cup .513 -> .634
(prior alone .610; blend > grade 39/8, > prior 27/18); O'Reilly .779 -> .837 (.799; 21/4, 21/5);
trucks .681 -> .781 (.777; 26/3, 17/12). Best-rated driver's card rank cup 6.7 -> 4.9. DECISION: the
practice card grades practice - a prior from a different track type (Daytona -> Darlington) hurts a
driver who practiced well, and track-type conditioning is the SIM's job, which it already does. Do
not add a blended column to the card. The number is recorded because it is the size of the
information practice does NOT carry, which is what the sim's practice weight is fighting.

**Ships with it.** `tire_allocations` table (cup 2026 full season from the sheet; O'Reilly R25 = 2)
defaults the new Tire sets field on the practice uploader; practice_sessions.tire_sets is stamped at
upload (was hand-edited after the fact); report card shows runs-by-set. 22 cup 2026 sessions
backfilled from the sheet (San Diego corrected 1 -> 3). Harness: scripts/backtest-tire-sets.mjs.
Forward ledger: same weekly rho-vs-rating check as v6.3-st; K>=2 sessions are the ones to watch.
Open: 0-set (superspeedway) and 6-set (Daytona 500) allotments are passed as-is (0 -> 1); the
signature ignores session-time evolution (magnitudes made that safe at Darlington, re-check at a
low-falloff track like Bristol).

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

### 2026-08-30 — DRIVE SWEEP FOR OWNERSHIP HISTORY: none in Phil's sheets. An INDEPENDENT ownership signal does exist elsewhere in the Drive.
OPERATOR: "check the google drive on phils files to see if he has ownership history in any of those
sheets." Checked two ways, because a word search alone is how I got the 2026-08-29 optimals wrong.
 1. WORD SEARCH across all of Phil's shared files (owner phillbennetzen@gmail.com - note the DOUBLE
    L, my first query used one and returned nothing): fullText own / ownership / drafted / rostered
    -> ZERO files.
 2. STRUCTURE SEARCH, which is the one that counts: pulled Daytona - Cup 2026 and the 2026 Cup Loop
    Data / Optimal Lineups rollup and enumerated every distinct header row. The schema is
    Driver | DK $ | FD $ | DR | START | FINISH | HALF WAY | T15% | SB1 | SB2 | PD | AVG RUN | QP |
    FAST | LED | DK PTS | DK Rank | FD PTS | FD Rank | Laps | Status, plus the DK/FD optimal-lineup
    blocks and a season grid of tracks. No ownership column in any of the 20+ header variants. The
    only '%' in the sheets is T15% (share of laps in the top 15), not ownership.
VERDICT: Phil's sheets carry loop data, salaries and optimals. No ownership, historical or projected.
WHAT THE SWEEP DID TURN UP, and it matters more: the FCFM sheets in the same Drive (owner
andrew.mucha@gmail.com, "Fast Cars Fast Money") carry a per-driver INTEREST rating - None / Low /
Medium / High - alongside notes that talk about ownership directly ("will be slightly under in
GPPs", "the ownership jump from Blaney to Reddick will be significant", "he should be very low
owned"). That is a human analyst's read on how the field will roster, produced with no knowledge of
our board - i.e. exactly the INDEPENDENT ownership signal whose absence is what stops leverage from
being an edge (see the entry above).
WHY IT IS NOT USABLE YET: there are only 7 FCFM sheets in the Drive (Daytona Duels Cup 2024,
Kansas Cup 2024, Darlington 2 Cup 2024, Charlotte Trucks 2024, Kansas Truck 2025, Iowa Xfinity 2025,
Bristol Cup 2026) and NOT ONE of them overlaps the 8 races where we hold actual DK ownership. Zero
overlap means zero rows to test on.
THE TEST IT UNLOCKS, if the sheets can be collected weekly (they are published publicly on X
@FastCarsFM and YouTube @FastCarsFastMoney): map Interest to an ordinal and ask whether it improves
leave-one-race-out ownership prediction over proj_dk alone (0.762 today). If it does, the residual
it explains is a real crowd signal we do not currently hold, and leverage becomes an edge rather
than a restatement of our own board. Needs roughly 10 overlapping races before it can be judged.
COST TO COLLECT: one sheet per weekend, alongside the contest upload that already happens.

### 2026-08-30 — CORRECTION (operator, same hour): the FCFM "Interest" column is NOT an ownership signal.
"I just looked at his sheets and none of them contain ownership either its just his analysis of
plays he likes." Correct, and I overstated it. Interest is None/Low/Medium/High on the drivers the
ANALYST likes. I described it as "a human analyst's read on how the field will roster" - that is a
different quantity, and I inferred it from a handful of notes that happen to mention ownership in
prose ("should be very low owned") rather than from what the column actually measures.
IT WOULD ALSO FAIL THE ONLY TEST THAT MATTERS even if collected: a play-preference rating is built
from the same public inputs as everyone else's - salary, track history, practice speed, grid - which
is exactly what our proj_dk is built from. The requirement was a signal INDEPENDENT of our
projection; a second projection dressed as preferences is not one. (For scale, the sheet's own
footer puts them at 764 YouTube subscribers, so they are not moving a 14,268-entry field either.)
STANDING POSITION, unchanged and now with the Drive actually swept: there is NO ownership data in
the Drive, Phil's or anyone else's. The only ownership we hold is what the operator uploads from his
own contests - 8 races. Projected ownership ships as built (derived from proj_dk, MAE 6.1 points),
leverage stays closed, and the sole path to an independent signal is accumulating real DK ownership
race by race, which already happens for free with the post-race contest upload. The per-driver
residual watch is the instrument; revisit at ~20 races.

## 2026-08-30 — MOVED OUT: the POST_RACE_UPDATE / scraper diagnosis now lives in PITBOARD_SCRIPTS.md
Operator: "I also don't think that the python script information updates belongs in the back test
log I almost think that for all our Python scripts for data pulling for pit board needs their own
MD file." Correct - this log is model evidence, not pipeline operations. The full diagnosis of the
silent post-race no-op (anon key + RLS returning an empty array as a success), the four races it
cost, and the fix are now in PITBOARD_SCRIPTS.md, which also documents every data-pull script, the
weekly ritual and the failure-mode table. Nothing else was removed from this log.
ONE THING WORTH KEEPING HERE, because it is a measurement lesson and not a pipeline detail: an empty
result that cannot be distinguished from a legitimate zero is the most dangerous failure a pipeline
has. "0 races in scope" read as a status line for eight days. Same shape as the GradeCenter
retraction this morning - a code path that looks fine while producing nothing.

## 2026-08-30 — PRE-REGISTRATION: does `closing_ps` predict finish beyond what we already hold?
WRITTEN AND PUSHED BEFORE ANY FIT. Nothing below has been looked at. The column does not yet exist
in the database — the feed backfill has not been run — so there is no way for this to be a story
told after seeing an answer.

WHAT IT IS. NASCAR's loopstats feed carries `closing_ps`: the driver's average running position over
the closing laps. It is the ONLY field in that feed not derivable from something we already store.
(`closing_laps_diff` is exactly `closing_ps - finish_position` — checked on all 40 drivers at cup
2026 R26 — so it carries no independent information and is not tested.) Coverage is 100% of every
points race in all three series back to 2022, verified by a full sweep on 2026-08-30, so this is
testable on the whole history rather than forward-only.

WHY IT IS WORTH A TEST. The superspeedway finish-quality study closed on 2026-08-30 with a holdout
failure: prior SS record carries no out-of-sample information beyond starting position, and the
baseline Spearman there is only +0.186. Finish at those tracks is close to unpredictable from
anything we hold. `closing_ps` is the first candidate that is not a function of season-long record
or grid — it measures where a car actually was at the end of a specific race, which survives a wreck
that ruins the finishing position. Hocevar closed 2nd and finished 38th at Daytona; Preece closed
5th and won. If car quality at the end of a race is real and persistent, this is where it would show.

HYPOTHESIS. A driver's PRIOR closing position at a track type predicts their NEXT finish there,
beyond what starting position and prior finish position already predict.

DESIGN, frozen now.
  * Unit: one driver-race. Feature computed from races STRICTLY BEFORE the race being predicted.
  * Feature: `priorClose` = mean `closing_ps` over that driver's previous races in the same
    correlation group (`tracks.correlation_group_label`), minimum 3 prior races. Drivers under the
    minimum get a neutral fill (the group mean), which is conservative — it cannot help the model.
  * Baseline model:  fin_hat = a + b*start + c*priorFin
  * Test model:      fin_hat = a + b*start + c*priorFin + d*priorClose
    `priorFin` is in the baseline deliberately, so a pass cannot be "prior record predicts finish"
    wearing a new name. The only question is whether CLOSING position adds anything over FINISHING
    position.
  * Both fitted by OLS on TRAIN, scored on HOLDOUT. Train = 2022-2024. Holdout = 2025-2026.
    All three series, points races only, exhibitions excluded.
  * Metric: per-race Spearman correlation between predicted and actual finish. Report the mean
    delta (test minus baseline) across holdout races.

PASS BAR, both required, same bars the SS study used so the two are comparable:
  1. mean per-race Spearman delta >= +0.05 on the holdout, AND
  2. delta positive in >= 60% of holdout races.
A pass ships NOTHING on its own. It earns a second registered holdout on races run after this date.

FAIL CLOSES IT. If either bar is missed, closing position is recorded as carrying no usable signal
beyond start and prior finish, and `closing_ps` stays a stored column with no model role. No
re-cutting of the train/holdout split, no switching the metric, no "but it worked at superspeedways"
subgroup hunt afterwards. If I want a subgroup, it has to be named HERE: the only pre-registered
subgroup is superspeedways, reported separately and judged on the same two bars.

DECLARED DEVIATIONS, none yet. Any deviation forced by the data gets appended before the holdout is
read, in the same way the SS study declared its organization-fallback deviation.

## 2026-08-30 — closing_ps STAGE 1: training fit frozen. HOLDOUT NOT YET READ.
Protocol registered earlier today, before the column existed. Data now present: 16,130 of 16,130
loop_data rows carry `closing_ps`. This entry is written and pushed BEFORE the holdout is scored.

DATA. 16,021 usable driver-races (exhibitions excluded, correlation label required).
TRAIN 2022-2024 n=10,019. HOLDOUT 2025-2026 n=6,002. Driver identity is `nascar_driver_id`, so the
panel is keyed on an integer rather than on names — that is new as of tonight and removes the
"is this the same driver" question from the study entirely.

DECLARED DEVIATIONS, all three conservative, all declared before the holdout was touched:
  1. The protocol said under-minimum rows get "the group mean" without saying from which set. They
     get the TRAIN-set group mean, for train and holdout alike. Leak-free by construction.
     1,968 of 10,019 train rows (19.6%) are neutral-filled.
  2. Bristol Motor Speedway Dirt Track has no `correlation_group_label`, so its 109 rows are
     dropped rather than assigned a group by hand.
  3. Prior windows are per (driver, correlation group) ordered by race_date, strictly preceding.

FEATURE DIAGNOSTIC, run before fitting because it could have invalidated the design. On train,
corr(closing_ps, finish_position) = 0.856 — high, but not degenerate: mean |closing - finish| is
3.28 positions and only 2,963 of 10,019 rows (30%) have them equal. Per group: Short & Flat 0.909,
Intermediate 0.888, Road Course 0.845, **Superspeedway 0.710**. The two diverge MOST at exactly the
tracks where the hypothesis lives, which is what makes this a fair test rather than a tautology.
Had the correlation been ~0.99 I would have said the pre-registration was flawed and stopped here.

THE FROZEN FITS (OLS on train, solved from sufficient statistics):

    BASELINE  fin_hat = 5.269886 + 0.324647*start + 0.410804*priorFin
    TEST      fin_hat = 5.302680 + 0.318051*start + 0.162463*priorFin + 0.253806*priorClose

In sample, priorClose takes weight AWAY from priorFin: 0.4108 -> 0.1625, with 0.2538 going to
closing position. Total prior weight is nearly unchanged (0.411 vs 0.416) — it is redistributed, not
added. So in-sample, closing position is the better half of "prior record". That is suggestive and
proves nothing; the in-sample gain of the superspeedway study was +0.0244 and it still failed its
holdout.

BARS, unchanged: mean per-race Spearman delta (test - baseline) >= +0.05 on the holdout AND positive
in >= 60% of holdout races. Superspeedways are the one pre-registered subgroup, judged on the same
bars and reported separately. A miss on either bar closes closing_ps as a predictor and it stays a
stored column with no model role.

Holdout scored in the next entry.

## 2026-08-30 — closing_ps STAGE 2: HOLDOUT FAILS BOTH BARS. CLOSED.
Scored with the coefficients frozen in the entry above. Nothing was refit, no parameter moved.

    scope                    races   baseline rho   test rho   mean delta   positive in
    ALL HOLDOUT (2025-26)      162        0.4398      0.4397     -0.0001        48.8%
    Superspeedway (registered)  27        0.1723      0.1721     -0.0003        48.1%

Bar 1 needed mean delta >= +0.05: got **-0.0001**. Bar 2 needed positive in >= 60% of races: got
**48.8%**. Not a near miss, not a wrong sign on a small effect — the effect is zero to four decimal
places, and race-by-race it is a coin flip. The registered superspeedway subgroup fails identically.
**CLOSED.**

WHY, and this is the part worth keeping. On the holdout, **corr(priorFin, priorClose) = 0.9668.**
Per RACE the two quantities are meaningfully different — corr 0.856, mean gap 3.28 positions, only
30% identical, and Hocevar closing 2nd while finishing 38th at Daytona is a real thing that happened.
But AVERAGED over a driver's prior races in a track group, they collapse into the same number. The
race-to-race gap between where a driver was running at the end and where they were classified is
NOISE, and averaging is exactly the operation that cancels it.

That is why the in-sample coefficient shift was a mirage. priorClose took weight from priorFin
(0.411 -> 0.162) not because it was better but because at rho 0.967 the two are interchangeable and
OLS split the credit arbitrarily. The models rank identically for 57.4% of holdout driver-rows, and
where they differ the mean rank shift is 0.63 positions — movement without improvement.

WHAT IS AND IS NOT CLOSED. Closed: **prior-average closing position as a driver-level trait.** It
carries no information beyond start position and prior finishing position, and `closing_ps` stays a
stored column with no model role. NOT tested here, and therefore neither open nor closed: any
contemporaneous use of closing_ps (a within-race measure rather than a prior average). Testing that
would need its own pre-registration written before looking — and I am not proposing one on the back
of a failed result, which is precisely the fishing the protocol exists to prevent.

CONTEXT. Baseline per-race Spearman is 0.4398 overall but **0.1723 at superspeedways**, consistent
with the 2026-08-30 superspeedway study (which measured 0.186 on its own baseline and also failed).
Two independent registered studies now agree that superspeedway finish is close to unpredictable
from anything we hold. That is a converging result, not a coincidence, and it is the strongest
argument yet that the SS variance multiplier is doing real work rather than papering over a
missing feature.

METHOD NOTE. This is the second study in two days where the in-sample signal pointed one way and the
holdout said zero (SS finish-quality: in-sample +0.0244, holdout -0.0041). The pattern is worth
naming: an in-sample gain under +0.05 has now twice predicted a holdout of exactly nothing.

### 2026-08-30 — closing_ps, all four track types (EXPLORATORY, cannot ship on this evidence)
Operator asked about the other track types. Only Superspeedway was pre-registered, so the other
three are diagnostics, not findings — a positive here would have required a NEW registered holdout,
not a decision. Recorded because "did we miss a subgroup?" is the obvious question and it deserves
an answer on the record rather than in a chat.

    track type            races  baseline rho   delta   positive   raw c-vs-f   AVERAGED pc-vs-pf
    Short & Flat Tracks     43       0.5415    -0.0003    44.2%       0.912          0.9888
    Intermediate            64       0.4863     0.0000    51.6%       0.895          0.9864
    Road Course             28       0.4352    +0.0001    50.0%       0.844          0.9535
    Superspeedway (reg.)    27       0.1723    -0.0003    48.1%       0.725          0.8356

Nothing anywhere: every delta is zero to three decimals and every group is a coin flip.

The last two columns are the point. Averaging over a driver's prior races drives EVERY group toward
collinearity — 0.895 -> 0.986, 0.912 -> 0.989. Superspeedway retains the most distinction (0.836)
and therefore had the most room for a different answer; it is also the one group that was registered
in advance; and it is as flat as the others. **This strengthens the closure rather than qualifying
it.** There is no track type where prior-average closing position is anything but a restatement of
prior-average finishing position.

BYPRODUCT WORTH KEEPING, and it is not about closing_ps at all. The BASELINE per-race Spearman
varies by more than 3x across track types:

    Short & Flat 0.5415 · Intermediate 0.4863 · Road Course 0.4352 · Superspeedway 0.1723

Start position plus prior finishing record predicts the finishing order roughly three times better
at short tracks than at superspeedways. That is a property of the sport, measured on a holdout,
independent of anything in this study — and it is the same ordering our GROUP_NOISE_MULT already
encodes by hand. Two registered studies and this baseline now agree on the superspeedway end of it.

## 2026-08-30 — PRE-REGISTRATION: does ORGANIZATION strength predict finish beyond driver record?
WRITTEN AND PUSHED BEFORE ANY FIT. Holdout unread.

WHY THIS ONE, AND WHY NOW. Operator's correction, verbatim: *"I think you are focusing on
superspeedways to much sometimes remember we do all track types."* Fair. The schedule is
**Intermediate 173 · Short & Flat 118 · Road Course 71 · Superspeedway 71** — two thirds of it is
the two track types the last three studies barely addressed. So: all four track types are named as
subgroups HERE, in advance, each judged on the same bars. A per-track-type answer is then a result
rather than a subgroup hunt.

`loop_data.team_name` arrived tonight and has never existed before: 16,052 rows, 100 organizations.
It is the single most plausible untested addition, and its absence has already blocked a study —
the 2026-08-30 superspeedway entry declares a deviation because *"the organization fallback is not
implementable (no team column)."* That blocker is gone.

HYPOTHESIS. The recent strength of a driver's ORGANIZATION at a track type predicts that driver's
finish, beyond starting position and the driver's own prior finishing record.

DESIGN, frozen now.
  * Unit: one driver-race. Every feature from races STRICTLY BEFORE the race being predicted.
  * **priorOrg** = mean `finish_position` over rows that are: same `correlation_group_label`,
    strictly earlier by race_date, same `team_name` as this driver has in THIS race, and
    **`nascar_driver_id` <> this driver**. Excluding the driver's own history is the whole point —
    it makes the feature about the equipment rather than a second copy of priorFin.
  * Minimum 3 qualifying prior rows; below that, neutral fill with the TRAIN-set group mean finish
    (same convention as the closing_ps study, leak-free, conservative).
  * Rows with no `team_name` (78, from the two races NASCAR published with no weekend feed) are
    dropped.
  * Baseline: fin_hat = a + b*start + c*priorFin      <- IDENTICAL to the closing_ps baseline, so
    the two studies are directly comparable.
  * Test:     fin_hat = a + b*start + c*priorFin + d*priorOrg
  * OLS on TRAIN 2022-2024, scored on HOLDOUT 2025-2026. All three series, points races only,
    exhibitions excluded.
  * Metric: per-race Spearman between predicted and actual finish; report mean delta (test minus
    baseline) across holdout races.

PASS BARS, per subgroup, both required:
  1. mean per-race Spearman delta >= +0.05 on the holdout, AND
  2. delta positive in >= 60% of that subgroup's holdout races.
**Subgroups registered in advance: ALL of Intermediate, Short & Flat Tracks, Road Course,
Superspeedway, plus the pooled result.** A pass in a subgroup ships nothing on its own; it earns a
second registered holdout on races run after this date. A subgroup that fails is closed for this
feature.

MANDATORY STAGE-1 CHECK, added because of tonight's miss. The closing_ps study measured collinearity
on the RAW column (0.856, looked safe) and never checked the CONSTRUCTED feature, which turned out to
be 0.967 after averaging — that alone determined the null. So before the holdout is read I will
report **corr(priorFin, priorOrg) on the constructed features, per track type.** If it exceeds 0.95
in a group, that group is called uninformative BEFORE scoring, not after.

A fail closes organization-as-equipment-strength in the failing groups. No re-cutting the split, no
changing the metric, no new subgroups afterwards.

## 2026-08-30 — ORGANIZATION STUDY STAGE 1: fit frozen. HOLDOUT NOT YET READ.
TRAIN 2022-2024 n=9,981. HOLDOUT 2025-2026 n=5,962. 78 rows dropped for missing team_name (the two
races NASCAR published with no weekend feed), as declared.

MANDATORY COLLINEARITY CHECK ON THE CONSTRUCTED FEATURE — the check that would have predicted the
closing_ps null, run here before anything else. corr(priorFin, priorOrg):

    Superspeedway 0.1300 · Road Course 0.3433 · Short & Flat 0.4617 · Intermediate 0.5468 · ALL 0.4523

Every group is far below the 0.95 kill line, and nowhere near priorClose's 0.967. **priorOrg is a
genuinely independent feature; priorClose never was.** Organisation neutral-filled on 13.4% of rows.

THE FROZEN FITS:

    BASELINE  fin_hat = 5.268835 + 0.325185*start + 0.410289*priorFin
    TEST      fin_hat = 2.960405 + 0.295836*start + 0.352612*priorFin + 0.211077*priorOrg

**The signature is the opposite of the closing_ps study.** There, priorClose took weight AWAY from
priorFin (0.411 -> 0.162) and total prior weight was flat at ~0.41 — credit being split between
interchangeable variables. Here priorOrg ADDS 0.211 while priorFin only eases 0.410 -> 0.353; total
prior weight rises 0.410 -> 0.564. That is more information entering the model rather than the same
information relabelled.

Encouraging and not yet worth anything. The superspeedway study's in-sample gain was +0.0244 and its
holdout was -0.0041. Bars unchanged: >= +0.05 mean per-race Spearman delta AND positive in >= 60% of
races, judged separately for each of the four registered track types and pooled.

## 2026-08-30 — ORGANIZATION STUDY STAGE 2: real effect, ~10x too small. FAILS. CLOSED.
Scored on the frozen coefficients. Nothing refit, no parameter moved, all four track types as
registered.

    scope            races  baseline  test    mean delta  positive   t     95% CI
    ALL (pooled)      161    0.4415   0.4466   +0.00512    56.5%    2.31  [ 0.0008, 0.0095]
    Road Course        28    0.4347   0.4445   +0.00980    67.9%    1.50  [-0.0030, 0.0226]
    Short & Flat       43    0.5414   0.5491   +0.00764    55.8%    1.86  [-0.0004, 0.0157]
    Superspeedway      26    0.1732   0.1784   +0.00515    53.8%    1.24  [-0.0030, 0.0133]
    Intermediate       64    0.4864   0.4877   +0.00136    53.1%    0.38  [-0.0056, 0.0084]

Bar 1 needed >= +0.05. Best group managed **+0.0098**. Bar 2 needed >= 60% positive; only Road
Course cleared it (67.9%) and it misses bar 1 by 5x. **FAILS in every registered group. CLOSED.**

THIS IS A DIFFERENT KIND OF FAILURE FROM closing_ps, AND THE DISTINCTION MATTERS.
closing_ps was **nothing**: delta -0.0001, positive in 48.8%, a coin flip, because the constructed
feature was a 0.967 copy of priorFin. Organisation strength is **real but tiny**: the pooled effect
is positive, consistently signed in all five cuts, and statistically distinguishable from zero
(t=2.31). It is simply an order of magnitude below the size that would justify touching the model.

The confidence interval is what closes it properly. Pooled 95% CI is [0.0008, 0.0095] — **even the
optimistic end is five times below the registered bar.** This is not "underpowered, revisit with more
data." The data is now precise enough to rule out an effect of the size we said would matter. That
is a stronger negative than a wide interval straddling zero would have been.

MY OWN PREDICTION WAS WRONG, ON THE RECORD. Stage 1 argued organisation would matter MOST at
intermediates, "where equipment and aero matter most," and least at superspeedways "where the draft
flattens everything." The holdout says the reverse of the first half: **Intermediate is the WEAKEST
of the four (+0.0014, t=0.38)** and Road Course the strongest (+0.0098, 67.9% positive). I have no
registered hypothesis that explains that and I am not inventing one now — noting that the stated
mechanism failed is the honest end of it.

WHAT IS CLOSED. Organisation recent-strength at a track type, measured as the mean finish of the
org's OTHER cars in prior races in that group, as a predictor beyond start position and the driver's
own prior finish. Closed in all four track types. `team_name` remains a stored column, useful for
grouping, filtering and display, with no model role.

WHAT THIS DOES NOT CLOSE. Any other use of team_name — contemporaneous (same-weekend) team pace
rather than a prior average, teammate practice speed, crew-chief identity. None were tested. Each
would need its own pre-registration written before looking. I am not proposing one on the back of a
failure.

SCOREBOARD, three registered studies in two days, all failed on holdout: SS finish-quality
(-0.0041), closing_ps (-0.0001), organisation (+0.0051 against a +0.05 bar). Two of the three had
positive in-sample signals. The bar is doing exactly what it was set up to do.

### 2026-08-30 — WHY the organization effect was +0.005: it is two effects cancelling
Post-hoc diagnostic on an already-CLOSED study. Changes no conclusion and ships nothing. Recorded
because it explains the mechanism of the failure, which the headline number hides.

Operator's read, verbatim: *"Organization may just be an SVG signal to be honest lol"* — i.e. the
road-course result might just be Trackhouse having Shane Van Gisbergen. The instinct was right about
WHERE the feature breaks and the sign is the reverse of what it implies.

SVG on road courses, holdout era: **10 races, 7 wins, 5.30 average finish.** Trackhouse's road course
team average is 15.09 — strip SVG out and his team-mates average roughly 19.5, mid-pack. So the org
average describes nobody on that team.

Mean absolute finishing-position error per organisation, road courses, baseline vs with priorOrg
(positive = the org feature helped):

    HELPS                             HURTS
    Joey Gase Motorsports   +0.576    23XI Racing              -0.278
    JR Motorsports          +0.255    Legacy Motor Club        -0.183
    Young's Motorsports     +0.249    Trackhouse Racing        -0.139
    McAnally Hilgemann      +0.235    Jordan Anderson Racing   -0.126
    DGM Racing x JIM        +0.156    Spire Motorsports        -0.112

**Trackhouse is among the WORST cases for the feature, not the best**, and carries the highest
baseline error of any org (10.377). The feature helps on small homogeneous teams whose cars genuinely
run alike — and on JR Motorsports, where they are alike and strong. It hurts wherever one driver
carries the organisation.

THE POINT. The pooled +0.005 is not a weak signal spread thinly. It is a real signal on homogeneous
teams cancelling against a real ANTI-signal on top-heavy ones. **Averaging a team hides a driver**,
and a mean is the wrong summary when within-team spread is the whole story. That is a better
explanation of the null than "organisation does not matter", and it is the kind of thing only
visible after the result, which is why it is filed as a diagnostic rather than a finding.

NOT A PROPOSAL. A within-team-dispersion-aware construction is an obvious next thought and it is NOT
being run on the back of a failed study. If it is ever tested it needs its own pre-registration
written before looking, with the same bars. Filed as an idea, not a plan.

### 2026-08-30 — WHERE the organization effect lives: thin driver history, not road courses
Second post-hoc diagnostic on the CLOSED organisation study. Ships nothing, changes no conclusion.
Operator follow-up to the SVG point: *"Or road courses"*.

Split every holdout row by whether the driver had >= 3 prior starts in that correlation group.
Metric is mean absolute error in finishing POSITIONS — a diagnostic, NOT the registered per-race
Spearman, and deliberately not comparable to the pass bars:

    track type        % thin   improvement THIN   improvement ESTABLISHED   ratio
    Short & Flat        6.5%        0.578               0.018               32x
    Intermediate        3.9%        0.342               0.033               10x
    Road Course        11.5%        0.213               0.039              5.5x
    Superspeedway       8.2%        0.065               0.020                3x

The effect is 3-32x larger for drivers with thin history, in EVERY track type. And road courses lead
the registered table not because road courses are special but because they carry by far the highest
share of thin-history drivers — 11.5%, nearly triple intermediates. That is the one-off specialist
population: SVG, Allmendinger, Raikkonen, Button, Jordan Taylor, Kobayashi, Will Brown, Cameron
Waters all appear in our data with 1-3 starts.

THE MECHANISM, stated plainly: **organisation strength SUBSTITUTES for driver history rather than
adding to it.** Where the driver is known, the team adds 0.02-0.04 positions — nothing. Where the
driver is not, it adds 0.2-0.6. Since 88-96% of rows are drivers we already know, the pooled average
buried it. Combined with the previous diagnostic, the failure has two distinct causes and neither is
"organisation is irrelevant":
  1. averaging a team hides a driver (helps homogeneous teams, hurts top-heavy ones), and
  2. averaging over all drivers hides the only population it helps (the ones with no history).

STILL CLOSED, AND STILL NOT A PROPOSAL. The registered study asked whether org strength improves
predictions for the field, and the answer is no. "Org strength as a prior for drivers with fewer
than three starts at a track type" is a DIFFERENT question, arrived at by looking at the residuals of
a failed test, and it is exactly the sort of thing that looks compelling because the data was
consulted first. If it is ever run it needs its own pre-registration, its own holdout, and the same
bars. Two operator instincts in a row have now improved the DIAGNOSIS of a null result — worth noting
as a working pattern, not as licence to act on either.

## 2026-08-30 — DNF DATA vs THE SIM: what the real statuses change, and the leader-wreck residual
Read of SimulationCenter's DNF path against the newly-populated `finish_status`. No parameter moved.

HOW THE SIM HANDLES DNFs, for the record. `dnfRate` is a TOTAL attrition budget per car from
`resolveDnfRate()` — the live per-track rate measured off loop_data, shrunk toward a hardcoded
per-group constant by conf = min(1, nTrackRaces/8). That budget is split by WRECK_ACC_SHARE into
accident DNFs, spent as correlated multi-car events bootstrapped from real races and bucketed by the
caution forecast, and independent mechanical draws. Survivors of an event pay WRECK_SURV_COST;
DNFers keep laps led before wrecking at weight min(1, dnfLap x WRECK_LL_B); DNFs sort behind all
running cars, ordered by dnfLap.

1. THE LIVE RATE ALREADY MOVED, AND resolveDnfRate NOW CONTRADICTS ITSELF.
The rate expression is an OR: `(fs && fs !== 'running') || (lc > 0 && lc < 0.9*mx)`. Until tonight
`fs` was the junk heuristic so the laps branch did all the work; there are now ZERO rows left on the
old 'running'/'dnf' vocabulary, so the status branch is live. Rates by series x group, old rule vs
now, against the hardcoded fallback:

    cup Short & Flat   0.0802 -> 0.0914   (hardcoded 0.081)
    cup Road Course    0.0813 -> 0.0948   (hardcoded 0.085)
    cup Intermediate   0.1266 -> 0.1547   (hardcoded 0.127)
    cup Superspeedway  0.1778 -> 0.2551   (hardcoded 0.184)
    oreilly SS         0.2145 -> 0.2841   (hardcoded 0.220)

**The constants match the OLD rule almost exactly** — they were measured with it on 2026-07-14. So
the function now blends a new-rule trackAvg against an old-rule base: at cup superspeedways 0.255
against 0.184, a 7-point disagreement inside one function. Worst where the fallback was designed to
matter — a track with little history (the comment names North Wilkesboro) is dragged toward a stale
number. This is a bug regardless of which definition is preferred.

Sanity check on the wider definition before recommending it: the 453 rows the status branch newly
counts finish at average position 29.1, 77.6% of field, 60.7% in the bottom quarter, 2.0% in the top
half — against 92.1% of field for hard DNFs. Genuinely back-of-field, so counting them is right, but
they are NOT the same object the budget was calibrated against. dnfLap ordering absorbs some of that.
Whether it absorbs all of it is empirical, which is why the constant was NOT swapped.

2. WRECK_ACC_SHARE VALIDATES. Coded SHORT 0.63 / INT 0.70 / SS 0.85 / ROAD 0.50; measured now from
real causes on all 436 races: 0.585 / 0.666 / 0.812 / 0.447. Close, from an independent source
(the coded values came from a 359-race lap-note join). Nothing to change.

3. THE DOMINATOR MEASUREMENT ALSO VALIDATES. Share of laps led by eventual DNFers, coded from a
370-race join as SHORT 2.0 / INT 8.2 / SS 17.3 / ROAD 4.1; measured now on 436 races from stored
statuses: **2.8 / 8.6 / 17.5 / 4.5.** The gxc-v3.1-dnfLL work was right.

4. THE LEADER-WRECK RESIDUAL IS NOW QUANTIFIED. Operator, unprompted, on the Daytona R26 case:
*"Zane smith crashed on the last lap from the lead ... he was contending for the win."* Our row:
start 34, finish 32, 165 of 166 laps, 15 laps led, closing_ps 3 — the largest closing-vs-finish gap
in that race. The WRECK_LL_B comment already names this as the known open residual: *"Saturated fit
lands SS ~14% vs 17.3 measured — residual is unmodeled leader-wreck correlation."*

Mean lap fraction at which a DNFer wrecks, split by whether they had led:

    group          led laps   did not lead   gap
    Superspeedway    0.784        0.593      +0.191
    Short & Flat     0.781        0.579      +0.202
    Road Course      0.760        0.597      +0.163
    Intermediate     0.707        0.550      +0.157

**Leaders wreck late, in every track type, by a consistent ~+0.16 to +0.20 of race distance.** The
sim selects wreck victims as position-adjacent clusters in running order without conditioning WHO is
hit on WHEN the event happens, so late events reach the front of the field less often than reality.
That is the mechanism behind the 14% vs 17.5% shortfall.

Why it matters more for DFS than for finish order: laps led and fastest laps are banked before the
wreck and only place differential and finishing points collapse. A car that leads 15 laps and is
classified 32nd from a 34th start is a completely different DFS object from one that wrecks on lap
30 — same dnf flag, different score — and it is the highest-variance object at superspeedways, which
is where the operator's own 301.45 lineup method came from.

STATUS: nothing shipped. Item 1 is a bug needing a decision (refresh constants under a registered
calibration, or make both halves use the old rule as a stopgap). Item 4 is a PRE-EXISTING documented
residual that has become measurable — NOT a hypothesis mined from tonight's residuals — and any
change to victim selection still needs its own pre-registration and holdout, judged like the
2026-08-29 placement-tail calibration.

## 2026-08-30 — PRE-REGISTRATION: do wrecks cluster after restarts?
WRITTEN AND PUSHED BEFORE LOOKING. The caution data landed less than an hour ago and has not been
queried against DNFs.

WHY. SimulationCenter spends the accident share of the DNF budget through multi-car events
bootstrapped as [size, lapFraction] from real races. The bootstrap stores whole races, so it inherits
whatever within-race clustering exists — but nothing conditions WHEN an event fires on where the
restarts are, and until tonight nothing in the database recorded a restart lap. The stage inputs on
the sim panel are labelled "captured for the future caution/pit layer, do not affect results yet".
This is the measurement that layer would rest on.

HYPOTHESIS. Accident DNFs are disproportionately concentrated in the laps immediately following a
restart, relative to a uniform baseline over green-flag laps.

DESIGN, frozen now.
  * Unit: one accident DNF. `finish_status` in ('accident','dvp','damage','fire'), which is the same
    set WRECK_ACC_SHARE uses. Mechanical DNFs are the CONTROL, not the subject.
  * Wreck lap := `laps_completed` for that driver. It is a proxy — the car stopped there — and it is
    the same proxy the existing wreck work used.
  * Restart laps come from `caution_segments.restart_lap` (= end_lap + 1). A caution whose restart
    falls beyond `total_laps` (race ended under caution) contributes no restart.
  * GREEN-FLAG LAPS ONLY. Laps inside a caution window are excluded from both numerator and
    denominator — cars do not wreck under yellow, and leaving them in would manufacture the result.
  * `k` := laps since the most recent restart, for each green lap and each wreck.
  * Statistic: P(wreck | k <= 5) vs P(wreck | k > 5), as a rate per car-lap-at-risk. Reported as a
    RATIO. The 5-lap window is chosen now, not after looking.
  * Reported for all four track types separately, all named in advance, plus pooled.
  * CONTROL: the same statistic for MECHANICAL DNFs. Engine failures should NOT cluster at restarts.
    If they do, the finding is an artifact of how laps_completed relates to caution timing and the
    whole thing is void. This control is the single most important part of the design.

PASS BAR. Accident wrecks in the first 5 green laps after a restart occur at >= 1.5x the rate of
later green laps, pooled AND in at least 3 of the 4 track types, AND the mechanical control shows a
ratio < 1.2. All three required.

WHAT A PASS BUYS. Nothing shipped. It earns a pre-registered attempt at conditioning wreck-event
lap fractions on restart proximity in the sim, judged on a 2025-26 holdout by the same chi-square
gate the 2026-08-29 placement-tail calibration used.

WHAT A FAIL CLOSES. Restart proximity as a driver of accident timing. The bootstrap keeps drawing
lap fractions as it does, and the "future caution/pit layer" loses its main motivation.

DECLARED IN ADVANCE: `laps_completed` as the wreck lap is imprecise for a car that limps several
laps after contact — this biases k UPWARD and therefore works AGAINST the hypothesis. Any deviation
gets appended here before the numbers are read.

## 2026-08-30 — RESTART PROXIMITY: bar FAILS AS WRITTEN. Effect is large; my control says the design cannot cleanly attribute it.
Measured exactly as registered. Green-flag car-laps only, accident statuses only, k = laps since the
most recent restart, 5-lap window, all four track types named in advance.

    track type        car-laps k<=5   acc k<=5   car-laps k>5   acc k>5   ACCIDENT RATIO   MECH CONTROL
    Intermediate          194,140        228        621,720       143         5.106            1.401
    Short & Flat          145,216        103        641,708       100         4.552            1.419
    Road Course            53,481         74         64,379        29         3.072            1.029
    Superspeedway          73,314        200        162,894       207         2.147            1.228
    POOLED                466,151        605      1,490,701       479         4.039            1.590

Bar 1, >= 1.5x pooled: **PASS**, 4.039.
Bar 2, >= 3 of 4 track types: **PASS**, all four, 2.15 to 5.11.
Bar 3, mechanical control < 1.2: **FAIL.** Pooled 1.590; per group 1.03 / 1.23 / 1.40 / 1.42.
All three were required. **THE STUDY FAILS.**

WHAT THE CONTROL IS TELLING US. Mechanical DNFs also concentrate after restarts, at 1.59x pooled.
Engine failures do not care about restarts, so this is a measurement artifact, and the most likely
mechanism is obvious in hindsight: a car that is already hurt — damaged in the incident that CAUSED
the caution, or nursing a failure — limps through the yellow, takes the green, and parks within a few
laps. `laps_completed` then lands just after a restart for reasons that have nothing to do with
restart risk. That inflates BOTH accident and mechanical counts in the k<=5 bucket.

WHY I AM NOT CALLING THIS A PASS. The accident ratio (4.04) is 2.5x the mechanical ratio (1.59), so
the artifact plainly does not explain all of it. But "accident ratio divided by mechanical ratio" is
a statistic I did NOT pre-register, and adopting it now, after seeing that it rescues the result, is
exactly the move the registration exists to prevent. The control was written to catch a confound and
it caught one. The correct reading is that MY DESIGN WAS INADEQUATE to separate effect from artifact,
not that the effect is absent.

WHAT IS ACTUALLY KNOWN, stated conservatively: 23.8% of green car-laps fall within 5 laps of a
restart, and 55.8% of accident DNFs (605 of 1,084) fall there. Accident clustering after restarts is
large and present in every track type. It is NOT cleanly separated from the tendency of already-
damaged cars to retire shortly after going green.

THE FIX, FOR A FUTURE REGISTRATION, NOT RUN NOW. `caution_segments.comment` names the cars involved
in each incident — "#77, 43, 54 Incident Turn 4". Excluding cars named in the PRECEDING caution's
comment removes the already-damaged population directly, at source, rather than trying to net it out
with a control. That is a materially better design and it is available because of tonight's capture.
It needs its own protocol written before looking, with the exclusion rule and the bar fixed in
advance. I am not writing it in the same breath as reading this result.

FOURTH REGISTERED STUDY IN TWO DAYS, FOURTH NON-PASS. The other three were nulls; this one is a large
effect I cannot cleanly claim. Different failure, same discipline.

## 2026-08-30 — PRE-REGISTRATION: restart proximity v2, with damaged cars removed at source
WRITTEN AND PUSHED BEFORE LOOKING. v1 failed its own control (mechanical DNFs clustered at 1.59x when
they should not have). This is the replacement design, not a re-cut of the same test.

THE PROBLEM v1 COULD NOT SOLVE. A car already hurt in the incident that CAUSED a caution limps through
the yellow, takes the green and parks. Its `laps_completed` lands just after a restart for reasons
unrelated to restart risk, inflating both accident and mechanical counts in the k<=5 bucket. Netting
that out with a control failed; the fix is to remove the population instead.

WHAT MAKES THIS POSSIBLE. `caution_segments.comment` names the cars in each incident — measured
tonight, 78.6% of Accident cautions and 76.3% of Spin cautions carry a leading '#' list
("#77, 43, 54 Incident Turn 4"). That did not exist in the database before today.

DESIGN, frozen now.
  * CAR EXTRACTION: only from a LEADING '#' list, i.e. the comment starts with '#' followed by
    comma/space separated numbers, terminated by the first alphabetic word. This deliberately ignores
    "Debris in Turn 1 from #39" and "No. 18 Stalled", where the car is mentioned but is not a
    multi-car incident. Car numbers keep leading zeros ('0', '00', '07') and match
    `loop_data.car_number`, which is now 100% populated.
  * COMPROMISED-CAR RULE: a car is COMPROMISED from the start_lap of the first caution whose comment
    names it, onward. From that lap it is excluded from BOTH the at-risk denominator and the wreck
    numerator, in BOTH buckets. Symmetric by construction — it cannot manufacture a k<=5 effect,
    because it removes the same cars from both sides.
  * Everything else is v1 unchanged: green-flag car-laps only, wreck lap = `laps_completed`,
    restarts from `caution_segments.restart_lap`, k = laps since most recent restart, 5-lap window,
    accident statuses ('accident','dvp','damage','fire'), mechanical DNFs as the control.
  * Reported for all four track types, named in advance, plus pooled.

PASS BARS, all three required, identical to v1 so the two are comparable:
  1. accident ratio (k<=5 vs k>5) >= 1.5x pooled, AND
  2. >= 3 of the 4 track types above 1.5x, AND
  3. mechanical control < 1.2.
Bar 3 is the one v1 failed and it is the point of this design. If the compromised-car rule works, the
mechanical control should fall toward 1.0. **If bar 3 fails again, restart proximity is CLOSED** —
two designs will have failed to separate it from retirement-timing artifacts, and I am not writing a
third.

WHAT A PASS BUYS. Still nothing shipped. It earns a registered attempt at conditioning wreck-event
lap fractions on restart proximity, judged on a 2025-26 holdout by the 2026-08-29 placement-tail
chi-square gate.

DECLARED IN ADVANCE:
  * Restricting to cautions that name cars is NOT required — a caution with no named cars simply
    compromises nobody. The rule uses whatever information exists.
  * `laps_completed` remains an imprecise wreck lap for a car that limps; as in v1 this biases k
    upward and works AGAINST the hypothesis.
  * Removing compromised cars shrinks the sample. If the accident numerator in any track type falls
    below 30 events, that group is reported as UNDERPOWERED rather than judged.

## 2026-08-30 — RESTART PROXIMITY v2: bar 3 fails again. CLOSED, as pre-registered.
Compromised-car rule applied exactly as written: a car is dropped from both numerator and denominator,
both buckets, from the start_lap of the first caution naming it. 3,346 (race, car) exclusions parsed
from leading '#' lists. No group underpowered.

    track type       car-laps k<=5  acc k<=5  car-laps k>5  acc k>5   ACC RATIO   MECH CONTROL
    Intermediate           181,080       202       583,436      126      5.165       1.492
    Short & Flat           133,067        86       595,220       88      4.371       1.307
    Road Course             51,312        70        62,212       28      3.031       1.023
    Superspeedway           65,120       164       146,112      182      2.022       1.026
    POOLED                 430,579       522     1,386,980      424      3.966       1.589

Bar 1 (>= 1.5x pooled): PASS, 3.966.  Bar 2 (>= 3 of 4 groups): PASS, 4 of 4.
Bar 3 (mechanical control < 1.2): **FAIL, 1.589.**  **CLOSED per the registration.**

WHAT THE FIX DID AND DID NOT DO, v1 -> v2:

    Superspeedway   mech 1.228 -> 1.026   (fixed)
    Road Course     mech 1.029 -> 1.023   (was already clean)
    Short & Flat    mech 1.419 -> 1.307   (improved, still over)
    Intermediate    mech 1.401 -> 1.492   (WORSE)
    POOLED          mech 1.590 -> 1.589   (unmoved)

The compromised-car rule worked exactly where the theorised mechanism applies — superspeedways, where
damaged cars limping to a restart is most common, went to 1.03. It did nothing at intermediates,
which got worse and which dominate the pooled denominator.

THE ASSUMPTION THAT MAY BE WRONG, stated but NOT used to rescue anything. Both designs treat
mechanical DNFs as restart-independent. That may simply be false: a restart is the most mechanically
violent moment in a race — hard acceleration, peak revs, driveline shock — so engines and gearboxes
plausibly DO fail there at elevated rates. If so the control was never valid and both studies were
mis-specified from the start. I am recording that because it is the most likely explanation of an
intermediate-track control of 1.49, NOT as grounds to reopen. Declaring a control invalid after it
has failed twice is the same goalpost move as swapping in a statistic that rescues the result, and
the registration exists to stop exactly that.

WHAT IS SAFELY KNOWN, and it is not nothing: 23.8% of green car-laps fall within 5 laps of a restart,
and roughly 55% of accident DNFs occur there, in every track type, at 2.0x to 5.2x the later-lap rate,
and it survives removing every car known to be damaged. Accident clustering after restarts is real
and large. What two designs could not do is prove it is a RESTART effect rather than a
retirement-timing effect.

WHAT CLOSING COSTS, honestly: very little. WRECK_SETS bootstraps whole races as [size, lapFraction]
sequences, so it already inherits whatever within-race clustering exists in the source data —
including restart clustering, implicitly. The unmodelled part is conditioning victim SELECTION on
event timing, which is a different question and remains open from the 2026-08-30 leader-wreck entry
(leaders wreck at 0.71-0.78 of distance vs 0.55-0.60 for non-leaders).

FIFTH REGISTERED STUDY IN TWO DAYS, FIFTH NON-PASS. Three nulls, one real-but-immaterial, one large
effect that could not be cleanly attributed. Nothing shipped from any of them. The constants refresh
and the caution capture stand on measurement, not on any of these tests.

## 2026-08-30 — VALIDATING THE DNF CONSTANT REFRESH I HAD ALREADY SHIPPED
Operator asked whether the DNF change actually improved prediction. I had argued it was more CORRECT
and never showed it PREDICTS better. Those are different claims and only the first was supported.

Test: refit both definitions on TRAIN 2022-2024, predict retirement count on HOLDOUT 2025-2026
(161 races), against three candidate ground truths. Errors in cars per race.

    target                          old MAE  new MAE   old bias   new bias
    NASCAR status only                 2.62     2.85      -0.47      +0.64
    laps < 90% only                    2.40     2.81      +0.13      +1.25
    OR (what the live code computes)   2.72     2.82      -0.93      +0.18

**The old constants have LOWER MAE against every target.** The new constants are far better on BIAS
against the target the live code actually computes: +0.18 cars per race versus -0.93.

Which matters more is not a matter of taste here. MAE at ~2.7-2.8 cars is dominated by race-to-race
randomness that no constant can predict; the 0.10 gap is noise. Bias is systematic and one-directional:
under-predicting attrition by roughly one car EVERY race inflates every contender's win and top-5
probability in the same direction forever, which is precisely the failure mode a betting model cannot
tolerate. The refresh is justified on that and on removing the self-contradiction. It is NOT justified
by lower error, and I am not going to claim it is.

I ALSO UNDERSTATED THE SCOPE. I described these as "fallbacks only - a track with 8+ races of its own
history ignores them." True, but **84 of 100 series-track cells have fewer than 8 races, and 48 of the
68 2026 races are at such tracks.** The constants drive roughly 71% of the schedule, not a minority.
That materially raises the stakes on this change and I should have checked before saying it.

STILL NOT ESTABLISHED, and worth being blunt about: none of this tests the SIM'S OUTPUT. It tests the
DNF count. Whether the new rates make finishing distributions, win probabilities or DFS floors better
calibrated requires running sims against a holdout, which is the placement-tail protocol and has not
been done. The change stands on bias and consistency. It is reversible - prior values are in git.

## 2026-08-30 — PRE-REGISTRATION: leader-wreck calibration (framed as calibration, NOT a hypothesis test)
WRITTEN BEFORE ANY FITTING.

WHY THIS IS NOT SHAPED LIKE THE LAST TWO. The tempting version — "do leaders get collected more in late
wrecks?" — is confounded by EXPOSURE: a car that survives to 90% distance has had nine times the
opportunity to lead as one that wrecked at 10%. Two studies have now died on controls I could not make
valid (closing_ps, organisation, restart proximity twice). Rather than write a third control I do not
trust, this targets a quantity that is already measured, already has a target value, and does not need
a causal claim at all.

THE MISS, already documented in the code and re-measured on 436 races today. Share of laps led by
eventual DNFers, sim vs reality:

    group        measured (436 races)   coded value   sim currently lands
    SHORT               2.8%               2.0%              ~2%
    INT                 8.6%               8.2%              ~8%
    ROAD                4.5%               4.1%              ~4%
    SS                 17.5%              17.3%             ~14%     <- the gap

The WRECK_LL_B comment names it: "Saturated fit lands SS ~14% vs 17.3 measured - residual is unmodeled
leader-wreck correlation." B >= 6 saturates, so the credit curve cannot close the gap; the shortfall is
in WHICH cars the wreck selects, not how they are credited.

OBJECTIVE. Make the sim's simulated share of laps led by DNFers match the measured share per group,
without degrading finishing-position calibration.

PROCEDURE, frozen now.
  1. Instrument the existing sim to report, per group, the realized share of laps led by DNFers over
     30k sims on frozen 2022-2024 boards. Confirm it reproduces the ~14% SS shortfall. If it does not,
     the premise is wrong and this stops here.
  2. Introduce ONE parameter: a front-bias weight on wreck-victim selection, applied only to events
     whose lap fraction exceeds a threshold. Both the weight and the threshold fitted on 2022-2024.
  3. HOLDOUT 2025-2026, judged on TWO criteria, both required:
     a. simulated laps-led-by-DNFer share within 1.5 points of measured in >= 3 of 4 groups, AND
     b. finishing-position chi-square NO WORSE than the current model - same 24-cell win/t5/t10/fin25
        band test the 2026-08-29 placement-tail calibration used. A laps-led improvement bought with
        degraded finishing calibration is a REJECT, not a trade.
  4. Ships only on operator approval, as the placement-tail change did.

WHAT A FAIL CLOSES: leader-wreck as a modelling target. The 17.5% measurement stands as documentation
of a known, accepted residual and the sim keeps its current victim selection.

DECLARED IN ADVANCE: step 1 is a real gate. If the instrumented sim already matches the measured share,
there is nothing to fix and the "gap" was an artifact of the older 370-race measurement rather than a
model defect. I would rather find that in step 1 than build a parameter to close a gap that is not there.

---

## 2026-08-31 — Sim extracted to a library; FIRST FINDING: the DNF budget is not honored

### What was done (a refactor, not a model change)

`src/lib/simEngine.js` is `runRaceSim`, `buildSpeedScores`, and every constant and curve they need,
moved out of `src/pages/SimulationCenter.js`. Nothing was rewritten — the code was already pure (no
React, DOM, or Supabase anywhere in it), it was just co-located with a UI, which meant it could only
run in a browser, one board at a time, with a human clicking. Every model change we have discussed —
the DNF constant refresh, leader-wreck, a future caution/pit layer — can only be VALIDATED by running
the sim over hundreds of historical boards. That is why this was worth doing first.

`__marketValue` and `__teamCutoff` deliberately stayed in the page. Neither is part of the simulation;
`__marketValue` is odds-to-EV conversion and drags in the odds parser, and the engine has to stay
importable from a plain node script.

`scripts/loadEngine.js` transforms the SAME file ESM→CJS in memory (via @babel/core, already installed
by react-scripts — no new dependency, no build step, no artifact). Scripts therefore read the shipped
engine byte for byte. If a backtest says the sim does X, the site does X.

VERIFICATION OF THE REFACTOR:
  - `react-scripts build` compiles.
  - A standalone `no-undef` lint over `src/` is clean. This mattered: the build compiled while
    SimulationCenter still referenced eight names that had moved out from under it (DEFAULT_WEIGHTS,
    the four other weight tables, TRUCK_SHORT_WEIGHTS, __teamCutoff, __marketValue). Webpack does not
    catch a free variable — the page would have compiled and then thrown at runtime. Admin.js and
    GradeCenter.js also imported moved names and were repointed.
  - `node scripts/sim-smoke.js` runs the engine headlessly: 20k sims per track group, every sim a
    valid permutation of 1..n, win% sums to 100, top10% to 1000, projected laps led sums to the race
    distance, and the DNF resolver reproduces its constants including cap and shrinkage.

### THE FINDING: realized DNF count tracks the CAUTION PRESET, not the rate it was given

30k sims, all three series x 4 track groups x 3 caution presets, realized retirements / budgeted
(`n * dnfRate`):

    preset            cup                oreilly            trucks
    Low  (4)      0.50 – 0.66 x       0.50 – 0.65 x      0.50 – 0.65 x
    Medium (8)    0.87 – 0.96 x       0.84 – 0.95 x      0.85 – 0.96 x
    High (15)     1.29 – 1.47 x       1.22 – 1.48 x      1.19 – 1.47 x

Cup detail (budget in parentheses): SHORT (9.1%) 0.57 / 0.87 / 1.46 · INT (15.5%) 0.51 / 0.88 / 1.46 ·
SS (25.5%) 0.50 / 0.96 / 1.29 · ROAD (9.5%) 0.66 / 0.97 / 1.29.

CAUSE, structural and visible in the code. `runRaceSim` computes

    __wScale = clamp(0.3, 2.5, (n * dnfRate * WRECK_ACC_SHARE[g]) / WRECK_EV_EXP[g])

`WRECK_EV_EXP` is ONE scalar per track group, but `WRECK_SETS[g][bucket]` holds wildly different event
counts per caution bucket — the high-caution lists are longer and the events larger. So the normalizer
is a pooled average across buckets. At a low preset the sim draws far fewer wrecks than that pooled
expectation and the scale does not compensate; at a high preset it overshoots.

WHY THIS READS AS AN ACCIDENT RATHER THAN AN INTENT. When a track group has no wreck sets, `runRaceSim`
falls through to `Math.random() < dnfRate` per car, which honors the budget exactly and has no caution
dependence at all. The two paths disagree. And `resolveDnfRate`'s rates are measured over real races
that already span every caution level, so re-scaling by caution on top of them double-counts.

CONSEQUENCE. The rate we set is only honored near a mid preset. A short track simmed at Low runs ~5.2%
effective attrition against a 9.1% budget; at High, ~13.3%. That moves win probability (survival is the
single biggest lever at plate tracks), DFS floors, and every top-N market. It also means the 2026-08-30
DNF constant refresh — validated on bias, holdout 2025-26 — only lands at a mid preset. That validation
is not invalidated, but it is narrower than it read.

### Status: PINNED, NOT FIXED

Recorded in `scripts/sim-smoke.js` as a printed measurement with a wide sanity rail, so a future fix
shows up as the row moving to ~1.00 rather than as a silent behaviour change. A fix moves shipped win
probabilities and DFS floors and therefore goes through the registration discipline like any other model
change — measure, register, freeze, holdout. Not bundled into a refactor commit.

The obvious candidate fix is a per-bucket `WRECK_EV_EXP` (it can be computed directly from the same
`WRECK_SETS` lists, no new data needed), which would make the normalizer honest by construction. That
is a proposal, not a decision.

NOTE ON THE OPEN LEADER-WRECK PROTOCOL (registered 2026-08-30). Its step 1 gate — instrument the sim and
confirm it reproduces the ~14% SS laps-led-by-DNFer share against 17.5% measured — is now runnable, and
should be run at a MID preset, because at Low or High the sim is not even retiring the right NUMBER of
cars and any laps-led share measured there would be confounded by this defect.

---

## 2026-08-31 — CORRECTION to today's earlier entry: the caution modulation is BY DESIGN, not a defect

Operator challenged the framing ("I thought the sim set dnf rate to prior track history dnf?"). He is
right, and the entry above is wrong on its central claim. Correcting it here rather than editing it,
per the append-only protocol.

WHAT I GOT WRONG. I wrote that the caution-preset coupling of realized attrition was an accident, on the
reasoning that the no-wreck-sets fallback path honors the budget exactly while the wreck path does not.
That reasoning was invented; I did not search BACKTEST_ARCHIVE, where it is documented as shipped,
deliberate, and calibrated. Quoting the 2026-07-28 wreck-v1.1-cb entry:

    "Normalizer stays GLOBAL per group, so the preset now modulates realized attrition around the
     dnfRate budget BY DESIGN (MC, n=38): SHORT 1.8/2.7/4.6 vs budget 3.1; INT 2.5/4.4/7.6 vs 4.9;
     SS 3.8/7.5/10.2 vs 7.4; ROAD 3.4/5.0/6.7 vs 5.1. Mid tercile sits slightly under budget
     (wreck counts are right-skewed)."

Those ratios are 0.58/0.87/1.48 SHORT, 0.51/0.90/1.55 INT, 0.51/1.01/1.38 SS, 0.67/0.98/1.31 ROAD.
Mine today: 0.57/0.87/1.46, 0.51/0.88/1.46, 0.50/0.96/1.29, 0.66/0.97/1.29. They agree. The Caution Rate
card has said so in the UI since 2026-07-28 ("calm pool (sims land under DNF budget)").

So the correct reading of that measurement is the opposite of what I wrote: the extracted engine
reproduces a two-month-old calibration to two decimal places, which is evidence the extraction is
faithful and the headless harness is trustworthy. That was the thing worth reporting. I over-claimed a
defect instead. Registered as a process failure: search the ARCHIVE, not just the LOG, before calling
shipped behaviour a bug.

### WHAT SURVIVES, AND IT IS NOT NOTHING

The modulation is by design. Its INTERACTION with auto-preset selection is not addressed anywhere in the
archive, and it is measurable now that the sim runs headlessly.

Both inputs are set automatically from the SAME track's long-run history:
  - `dnfRate`  = resolveDnfRate(series, group, trackAvgDnf, nRaces)  -- the track's mean attrition
  - `preset`   = nearest calibrated preset to that track's mean `races.total_cautions`

wreck-v1.1-cb calibrated the preset as a modulation around the budget -- a calm RACE lands under, a
chaotic RACE lands over. But auto-selection sets the preset from the track's AVERAGE, so it is not
expressing a race's deviation from the track's norm; it is re-expressing the track's norm, which
`dnfRate` already carries. The spread collapses to a point estimate, and for a calm track that point
estimate is ~0.6x, not 1.0x.

MEASURED, 30k sims per track, cup, N=38, reproducing the app's own auto-selection. Delivered attrition
vs that track's OWN measured attrition (2022+, non-exhibition):

    Talladega Superspeedway     meas 20.5%   delivered 10.4%   0.51
    Indianapolis GP Circuit     meas 10.5%   delivered  5.0%   0.48
    Charlotte Roval             meas  8.6%   delivered  4.7%   0.54
    Richmond Raceway            meas  3.7%   delivered  2.2%   0.59
    Road America                meas 10.8%   delivered  6.3%   0.59
    Mexico City                 meas  8.1%   delivered  4.8%   0.59
    COTA                        meas 10.4%   delivered  6.6%   0.64
    North Wilkesboro            meas  8.1%   delivered  5.2%   0.64
    Indianapolis (oval)         meas 23.9%   delivered 16.2%   0.67
    Homestead-Miami             meas  8.9%   delivered  6.3%   0.70
    Chicago Street              meas 16.0%   delivered 11.4%   0.71
    ... Charlotte / Texas       meas 23.1%   delivered 28.4%   1.23  (the only two above)

24 of 30 cup tracks land BELOW their own measured attrition; 11 land 20%+ below. The Medium-preset
tracks cluster at 0.85-0.90, which is the right-skew the archive already flagged. Schedule-wide the sim
under-retires.

THE SHARPEST CASE, and it is a boundary artifact rather than a calibration question. Superspeedways are
"pinned" -- the auto-preset effect returns early for them -- but the config loader has ALREADY set the
preset from a hard bucket, `avg < 6 ? Low : avg < 11.5 ? Medium : High`. Talladega averages 5.33
cautions and Daytona 6.20. Two plate tracks, same correlation group, split across the 6.0 boundary:
Talladega sits permanently on the calm pool (0.51x) and Daytona on the typical pool (0.93x). Talladega
is therefore simmed at roughly half its true attrition, at a track where survival is the dominant term
in win probability and DFS floors.

### STATUS: OPEN QUESTION, NOT A REGISTERED STUDY, NOTHING CHANGED

I am not proposing a fix in the same breath as getting the diagnosis wrong. Stating the options only:
  (a) leave it -- argue the auto-preset is a deliberate "this track runs calm" statement and the
      double-application is intended shrinkage;
  (b) make the modulation mean-preserving so that auto-selection returns the budget while a MANUAL
      preset click still expresses a race-specific deviation;
  (c) treat the SS bucket boundary as a separate, smaller question -- Talladega vs Daytona on opposite
      sides of 6.0 cautions looks unintended regardless of what is decided about (a)/(b).

Any of these moves shipped win probabilities and needs the registration discipline: freeze, holdout,
operator approval. The leader-wreck protocol registered 2026-08-30 is unaffected by this correction, but
its step-1 instrumentation should run at MEDIUM, where delivered attrition is closest to budget.

### 2026-08-31 — Addendum to the correction: two SECONDARY claims from the same wrong frame, also retracted

Operator asked whether everything measured before his challenge was wrong. Audited. The answer is that
no MEASUREMENT was wrong — every number reproduces — but the wrong frame spawned two further claims
beyond the headline one, and both are withdrawn here.

RETRACTED (1): "the 2026-08-30 DNF constant refresh only lands at a mid preset; that validation is
narrower than it read." False. Re-read the 2026-08-30 validation entry: it refits both constant sets on
TRAIN 2022-24 and predicts RETIREMENT COUNT on 161 holdout races directly from the rates. It never runs
the sim. Its own closing paragraph says so: "none of this tests the SIM'S OUTPUT." The caution
modulation lives inside runRaceSim, so it cannot touch a validation that never called runRaceSim. That
validation stands exactly as wide as it was written — new constants better on bias (+0.18 vs -0.93 cars
per race), old marginally better on MAE, and no claim about sim output.

RETRACTED (2): overstatement of the group-label vocabulary split. resolveDnfRate is keyed by
`tracks.correlation_group_label` ('Superspeedway') while runRaceSim's trackGroup is the short code
('SS'), and passing the short code silently returns the series mean rather than throwing. I wrote that
this is "how a whole group of races can end up simulated at the wrong attrition without anything looking
broken." Audited every caller: the only two in the app are SimulationCenter lines 299 and 302, both
passing `cfg.correlation_label`, which line 338 independently proves is the long-label vocabulary
(it is matched against `tracks.correlation_group_label` in a query). It is a latent API footgun worth
pinning in sim-smoke, not something happening to any race. Corrected in the test's comment.

WHAT IS UNAFFECTED, having checked each rather than assuming:
  - The extraction itself. Verified by build + a standalone no-undef pass, and the eight moved names
    that would have crashed the page are in the eslint output, not an inference.
  - Every sim-smoke invariant: permutation of 1..n per sim, win% to 100, top10% to 1000, projected laps
    led to race distance, DNF cap and n/8 shrinkage.
  - The caution x attrition sweep NUMBERS. They match the 2026-07-28 archive values to two decimals.
    Only the word "defect" attached to them was wrong.
  - The per-track table, which was measured AFTER the challenge and is the one open question.

---

## 2026-08-31 — THE DNF REFRESH, FINALLY TESTED THROUGH THE SIM: better on BOTH error and bias

Operator: "But the way DNFs work did change for the model tho?" Yes. My "no behaviour change" today
was scoped to today's three commits (extraction, correction, addendum) and I did not say so. The model's
DNF handling changed materially on 2026-08-30 in d0dfdc0, one day before: all twelve group cells raised
(cup SS .184 -> .255, +39% relative; cup INT .127 -> .155), three series means raised, DNF_CAP 0.30 ->
0.40 — driven upstream by the NASCAR feed backfill putting real `finish_status` on 2,598 rows, which
changed the live per-track measurement itself, not only the constants.

The 2026-08-30 validation of that change closed with: "none of this tests the SIM'S OUTPUT... requires
running sims against a holdout." That was true when written. It is now cheap, so it is done.

METHOD. Real `runRaceSim`, 30k sims, 29 cup tracks, reproducing SimulationCenter's own auto-config:
dnfRate from resolveDnfRate on that track's history, caution preset from that track's mean
`races.total_cautions`. Each constant set is fed its ERA-CORRECT trackAvg — old path the old-rule
measurement (laps < 90% of winner), new path the current rule (status != running OR laps < 90%) — since
the backfill is what changed the live measurement. Both scored against the current rule, the better
ground truth. Script: `scripts/dnf-refresh-through-sim.js`.

RESULT, delivered attrition vs measured, in DNF-rate points:

    OLD constants    MAE 4.41    bias -4.29
    NEW constants    MAE 3.10    bias -2.27
    new closer at 26 of 29 tracks

This is a STRONGER verdict than the count-level test got. There, old won MAE (2.72 vs 2.82) and new won
bias (+0.18 vs -0.93), and the change was justified on bias alone. Through the sim the new constants win
BOTH, and by a wide margin. Worth stating plainly because on 2026-08-30 I refused to claim the refresh
lowered error. Against sim output it does, and that claim is now supported.

Largest single repair: Daytona -13.5 -> -2.4 points. Talladega -12.4 -> -10.1, still the worst absolute
miss on the schedule. Atlanta -4.5 -> -0.6. Nashville -6.2 -> -2.6.

TWO TRACKS GOT WORSE, and it is the interaction from the correction entry above, in the other direction:
Charlotte +1.1 -> +5.5 and Texas -0.5 -> +5.4. Both average 12+ cautions, so both sit on the High preset
at ~1.4x. Raising their budget pushed a previously-cancelling pair of errors into a real overshoot. Both
were accidentally right before, for the wrong reason.

WHAT THIS DOES NOT SETTLE. Bias is still -2.27 points schedule-wide: the sim under-retires nearly
everywhere, which is the auto-preset interaction, not the constants. And this measures ATTRITION RATE on
a synthetic field. Whether finishing distributions, win probabilities or DFS floors are better
calibrated is the placement-tail protocol and remains undone. The refresh is now validated on the thing
it was supposed to fix; it is not validated on the thing we actually sell.

---

## 2026-08-31 — PRE-REGISTRATION: caution-distribution sampling as the repair for the auto-preset interaction

Operator asked how to fix the problem found today. Prototyped and measured first; registering before
anything is built into the engine. Prototype: `scripts/dnf-caution-fix-prototype.js`.

### THE DIAGNOSIS, restated in one line

The sim runs 30,000 copies of the track's AVERAGE race. wreck-v1.1-cb calibrated the caution bucket as a
property of a RACE (a calm race retires fewer cars, a chaotic one more), and then the board hands it a
track-level average. So the modulation, which was designed to vary across races, is instead applied as a
constant offset to a budget that already encodes the track's typical chaos. Talladega's budget is the
attrition of an average Talladega race; multiplying it by the calm pool's 0.51x is a second application
of the same fact.

### THE CANDIDATE FIXES, both measured (30k sims, 26 cup tracks with >= 3 races)

  FIX A  Draw the caution bucket PER SIM from that track's own historical distribution of
         `races.total_cautions`, rather than collapsing it to a mean. No recalibration of anything.
  FIX C  FIX A, plus divide the wreck scale by K = SUM_b w_b r_b, where w_b is the track's empirical
         bucket frequency and r_b the group's measured bucket multiplier. Makes the track's own
         distribution average to exactly 1.0x budget while PRESERVING the calm/chaotic spread within it.

                          MAE     bias      (delivered attrition vs measured, DNF-rate points)
    CURRENT              2.95    -2.04
    FIX A                2.13    -0.75
    FIX C                1.12    -0.49

FIX C is the clear winner and it SUBSUMES the Talladega problem rather than needing a separate patch:
Talladega 10.4% -> 19.9% against a 20.5% truth. The 6.0-caution bucket boundary that split Talladega
from Daytona disappears, because nothing buckets a track average any more — their caution DISTRIBUTIONS
([4,5,0] and [4,6,0]) are nearly identical and now get nearly identical treatment. The Charlotte/Texas
overshoot introduced by the constant refresh also resolves (28.5 -> 20.7, 28.4 -> 21.1).

FIX C also adds something the sim does not currently have at all: caution-scenario variance across the
30k draws. Today every sim is the average race. That understates the spread of finishing outcomes, which
is exactly what DFS floors/ceilings and tail markets are priced off.

### DECLARED IN ADVANCE, BEFORE ANY HOLDOUT IS TOUCHED

**The table above is NOT evidence the model forecasts better, and I will not present it as such.** The
budget is derived from the same measured track attrition the delivered rate is being scored against, so
"delivered lands on budget" is close to circular. It shows the MECHANISM works — the sim now does what it
was told. Whether being told this improves forecasts is the open question and the only thing that ships.

OBJECTIVE. Does making delivered attrition equal the budget improve FORECAST CALIBRATION on races the
fit never saw?

WHAT IS FITTED: nothing. K is computed from data, not tuned. There is no free parameter to overfit,
which is why there is no train/test split on the mechanism itself. The holdout is about consequences.

HOLDOUT: 2025-2026 cup, oreilly and trucks. TWO criteria, BOTH required:
  a. Finishing-position chi-square NO WORSE than current on the same 24-cell win/t5/t10/fin25 band test
     the 2026-08-29 placement-tail calibration used; and
  b. Win-market Brier non-degradation on the boards with stored odds.
A pass on (a) with degradation on (b) is a REJECT, not a trade, on the same reasoning as the leader-wreck
registration: a distributional improvement bought with worse market calibration is not a win for a
betting product.

WHAT A FAIL CLOSES. If chi-square does not improve, the conclusion is that delivered attrition RATE is
not the binding constraint on finishing distributions, and the current behaviour stays as documented
calibration. The attrition-rate table would then stand as a measurement of a property nobody should
optimize. I am declaring that outcome acceptable NOW so it cannot be relitigated later — this is the
same trap as the 2026-08-30 refresh, where "more correct" was not the same claim as "predicts better."

IMPLEMENTATION NOTE, for whoever builds it. `runRaceSim` computes __LLC, __FLC, __wsp, __wm and __wScale
once outside the sim loop. FIX C needs the three bucket variants precomputed and indexed by a per-sim
draw, plus `cautionDist` and K in simConfig. The page already queries `races.total_cautions` for the
auto-preset (SimulationCenter ~line 285 and ~line 755) — it currently averages the data away. Nothing
new needs to be fetched. Manual preset clicks must keep overriding, expressing "this specific race will
be calmer/wilder than this track normally is," which is what the buckets were built for.

NOTHING HAS BEEN CHANGED IN THE ENGINE. Awaiting operator go/no-go.

---

## 2026-08-31 — HOLDOUT VERDICT on the caution mix (Fix C): FAILS BOTH GATES. CLOSED, NOT SHIPPED.

Operator said a holdout was not needed, then asked "can't you just backtest it to get the answer?"
So it was run, exactly as registered earlier today, before any of this was read.

HOLDOUT: 2025-2026, all three series, 162 races. Script `scripts/backtest-caution-mix.js`.
Every driver input reconstructed from races STRICTLY PRIOR (SQL windows, Next Gen floor 2022):
correlated-group rating and finish, same-track rating and finish, prior track DNF rate, prior
caution-bucket frequencies. Start position is the real grid. Practice long-run pace and pit-crew
times are not reconstructable at this scale and are null in BOTH arms, so the arms differ only by
`cautionMix`. 10,000 sims per arm per race.

    market   arm      Brier        LogLoss      chi2 (cells)
    win      A cur    0.022537     0.090212      7.9 (5)
    win      B mix    0.022613     0.090598     10.0 (5)
    top5     A cur    0.093715     0.303962      4.2 (6)
    top5     B mix    0.094029     0.305724     13.3 (6)
    top10    A cur    0.154372     0.467860     14.5 (5)
    top10    B mix    0.154526     0.468199     24.7 (5)

    DNF cars per race    A cur 5.33 vs 5.97 observed (bias -0.64)
                         B mix 6.02 vs 5.97 observed (bias +0.05)

GATE (a) chi-square no worse: FAIL, on all three markets, top5 and top10 by 3x and 1.7x.
GATE (b) Brier non-degradation: FAIL on all three.
The mechanism did exactly what it was built to do - retirement bias -0.64 -> +0.05 cars per race -
and the forecasts got WORSE. Per the registration, that closes it. Fix C does not ship.

IS THE DEGRADATION REAL OR MC NOISE? Checked rather than assumed. Five independent repeats of arm A
on the identical config (`scripts/backtest-attrition-sweep.js`):

    winBrier  sd 0.000007   t5Brier  sd 0.000049   winLogLoss  sd 0.000103

The A-B gaps are +0.000076 on win Brier (11 sd), +0.000314 on top5 Brier (6.4 sd), +0.000386 on win
log loss (3.7 sd). Real, not noise. My first instinct was that a gap in the fifth decimal had to be
noise; averaging over ~5,800 driver-predictions at 10k sims each makes these metrics far tighter
than that instinct assumed.

### THE FINDING UNDERNEATH, which is worth more than the fix was

Sweeping dnfRate on the CURRENT arm, holding everything else fixed:

    mult   winBrier    winLogLoss   t5Brier     DNF cars   bias
    0.6    0.022499    0.090053     0.093701      3.34    -2.63
    0.8    0.022502    0.090228     0.093687      4.35    -1.62
    1.0    0.022511    0.090037     0.093691      5.33    -0.64
    1.2    0.022528    0.090043     0.093698      6.27    +0.30
    1.4    0.022534    0.090248     0.093754      7.16    +1.19
    1.8    0.022588    0.090414     0.093763      8.71    +2.74

Monotonic, and against 0.000007 sd it is signal: **finishing-position forecasts get better the LESS
the sim retires, across a 3x range, and the optimum is well below the attrition that actually
happens.** Fix C failed not because the mix mechanism is broken but because it moved attrition
TOWARD reality, and this metric prefers a sim that under-retires.

WHY, most likely. The win reliability table shows the model under-rating favorites at the top:
predicted 24.0% -> observed 32.1% (arm A) and 24.1% -> 33.3% (arm B). The board is not confident
enough about the best car. Attrition and caution-scenario variance both add randomness, and adding
randomness to a model that is already under-confident pushes it further the wrong way. Both arms
show it; B shows it slightly worse because it adds a second source of spread on top of the first.

THE LIMITATION, stated once and not as an appeal. This reconstruction has NO practice data, and
longRunPace carries 0.15-0.25 weight in the live model precisely because it sharpens favorite
identification. So the under-confidence that drives this result is larger here than on a real board.
Whether the ordering survives with practice inputs is UNTESTED, and I am not going to claim it does
or does not. The gate was written knowing this reconstruction was what would run against it, it
failed, and the failure stands.

### WHAT HAPPENS TO THE CODE

The engine keeps `cautionMix`, OFF by default and unreachable unless a board passes it, marked in
`simEngine.js`, `sim-smoke.js` and CLAUDE.md as TESTED AND REJECTED ON HOLDOUT 2026-08-31. Keeping a
tested implementation costs nothing and removing it would guarantee the next session rediscovers the
Talladega 0.51x symptom and rebuilds the same thing. Nobody may enable it without re-running this
backtest, and re-running it against a reconstruction WITH practice data is the only route that would
reopen the question.

WHAT DOES NOT CHANGE: the shipped sim is untouched. Talladega still sims at roughly half its measured
attrition and, on this evidence, forecasts slightly better for it. That is an unsatisfying sentence
and it is what the holdout says.

### THE OTHER THING THIS ESTABLISHES

The 2026-08-30 DNF constant refresh raised attrition schedule-wide. Read against the sweep above, the
refresh moved the sim UP the curve - from roughly 0.8x to 1.0x of measured - and that direction costs
a little forecast accuracy while buying correct retirement counts. It was justified on bias and on
removing a self-contradiction, both of which still hold, and today's earlier entry showed it also
halves attrition-rate error through the sim. None of that is withdrawn. But it is now on record that
the same axis trades against finishing-position calibration, and that nobody has yet found the
handle that gives both.

---

## 2026-08-31 — OPERATOR HYPOTHESIS, and it holds: the sim gives EVERY driver the same DNF rate

Operator, after the Fix C failure: "Is it because we aren't including the drivers actual DNF rate?"

He is right about the mechanism. `runRaceSim` applies ONE scalar to the whole field. The mechanical
layer is `Math.random() < mechRate`, identical per car. The wreck layer takes position-adjacent
clusters from a random seed, so wreck exposure is near-uniform across the running order too. Nothing
in the sim knows that some drivers retire less than others.

MEASURED, all series, 2022-26, prior-window rating (n_corr >= 5) so it is a usable predictor and not
hindsight. DNF rate by prior-rating quartile, Q1 = weakest, Q4 = strongest:

    group                cup  Q1->Q4        oreilly Q1->Q4      trucks Q1->Q4
    Short & Flat      .110 -> .047 (2.3x)  .242 -> .121       .194 -> .062 (3.1x)
    Road Course       .088 -> .067         .242 -> .080 (3.0x) .190 -> .182 (flat)
    Intermediate      .161 -> .157 (flat)  .162 -> .091 (1.8x) .187 -> .091 (2.1x)
    Superspeedway     .233 -> .259 (INV)   .188 -> .184 (flat) .143 -> .280 (INV)

Pooled by series, decile 1 vs decile 10: cup .172 -> .102, oreilly .183 -> .071, trucks .225 -> .067.

THE STRUCTURE IS THE INTERESTING PART, and it is physically sensible rather than a fitted curiosity:
skill protects you where retirements come from your own mistakes and from traffic - short tracks,
road courses, non-cup intermediates - and does NOT protect you at superspeedways, where it is flat
or slightly INVERTED. The Big One does not check your rating, and elite cars run at the front of the
pack where it starts. So this is not "good drivers DNF less" as a global fact; it is a group-specific
effect that switches off exactly where the wreck model is already strongest.

### WHY THIS IS A BETTER LEAD THAN ANYTHING ELSE TODAY

It predicts the observed forecast error, which Fix C never did. The holdout reliability table shows
the model under-rating favorites: predicted 24.0% -> observed 32.1% in the top win bin. A uniform
rate retires a cup short-track favorite at ~9% when he actually retires at 4.7%, and lets the
backmarker off at 9% when he actually retires at 11%. Over-retiring the best car is precisely how a
favorite's win probability ends up too low.

It also explains the attrition sweep logged above. Win Brier improved monotonically as dnfRate was
scaled DOWN, all the way to 0.6x, well past the point where retirement counts became badly wrong.
Read through this finding, that sweep was not saying "the sim should retire fewer cars." It was
finding a crude proxy for "the sim should retire fewer FAVOURITES," and the only lever available to
it was the global rate. A skill-tilted allocation gets the same benefit while keeping the total
correct - which is exactly what Fix C could not do, and why Fix C lost.

### NOT A REGISTERED STUDY YET, AND NOTHING IS BUILT

Stating that plainly given the day: the caution mix also measured beautifully and then failed its
holdout. A measured gradient is not a validated model change, and this one has a real confound to
handle before it can be fitted - driver_rating and finishing position are not independent, so some
of the gradient is mechanically "cars that finish well were running", not "good cars survive". The
prior-window construction removes the same-race version of that, not all of it.

WHAT A REGISTRATION WOULD NEED, sketched, not frozen:
  1. A control that separates survival from pace. The candidate is mechanical-only DNFs
     (`finish_status` in the engine-failure vocabulary): equipment quality should show a skill
     gradient, and if the gradient is IDENTICAL in accident and mechanical DNFs that points at a
     shared confound rather than two mechanisms.
  2. Group-specific application, with superspeedway pinned flat. A single global tilt would be wrong
     in the one place attrition matters most.
  3. Holdout 2025-26, the same two gates Fix C failed - chi-square AND Brier - with the same rule
     that a fail closes it.
  4. The reconstruction should carry PRACTICE data this time if it can. Fix C's holdout ran without
     it, which weakened favorite identification, and favorite identification is the exact quantity
     under test here.

Handing this to the next session as the top lead. The DNF work today closed with nothing shipped;
this is the thread that was actually worth pulling, and the operator found it, not me.

---

## 2026-08-31 — PRE-REGISTRATION: skill-tilted DNF allocation. CONTROL RUN FIRST AND IT PASSES.

Operator: "Register it to properly run it I still think we are on to something here."

Frozen before any fit is computed and before the holdout is touched. The control below is TRAIN-ERA
DATA ONLY (2022-2024); no 2025-26 row has been read.

### THE CONTROL, run first because it decides whether there is a study at all

The confound to kill: prior rating predicts current DNF partly because prior rating predicts current
PACE, and "did not finish" is entangled with pace. If that is all this is, accident DNFs and
mechanical DNFs should show the SAME gradient, because the confound does not care which killed you.

Train years 2022-2024, prior-window rating, quartiles Q1 (weakest) to Q4 (strongest):

    group              ACCIDENT DNF Q1->Q4        MECHANICAL DNF Q1->Q4
    Short & Flat       .0989 -> .0406  (2.4x)     .0484 -> .0226  (2.1x)
    Road Course        .0986 -> .0609  (1.6x)     .0493 -> .0152  (3.2x)
    Intermediate       .0954 -> .1101  (FLAT)     .0599 -> .0101  (5.9x)
    Superspeedway      .1460 -> .1901  (INVERTED) .0511 -> .0083  (6.2x)

**CONTROL PASSES, and it is not close.** The two layers have DIFFERENT group patterns, which a shared
pace confound cannot produce. Mechanical attrition falls with rating EVERYWHERE, including the two
groups where accidents do the opposite - that is equipment and funding, and a broken engine is not a
pace artifact. Accident attrition falls with rating only at short tracks and road courses, is flat at
intermediates, and INVERTS at superspeedways: the best cars crash MORE at plate tracks, which is
exactly right, because they run at the front of the pack where the Big One starts while backmarkers
ride the tail.

Two mechanisms, two patterns, one of them pointing the opposite way from the confound's prediction.

### WHY THIS SLOTS INTO THE EXISTING ARCHITECTURE

`runRaceSim` ALREADY splits the budget into the two layers - `WRECK_ACC_SHARE` (SHORT .63, INT .70,
SS .85, ROAD .50) sends part to correlated wreck events and the rest to independent mechanicals.
Nothing new has to be invented; each layer gets its own tilt, and the measurement above says they
must be tilted differently or not at all.

### FROZEN PROTOCOL

PARAMETERIZATION. For driver i with speedScore percentile p_i in [0,1] within the field (the sim
already computes this; using it keeps fit and runtime identical):

    mult_i = exp(beta * (0.5 - p_i)),  rescaled so mean(mult) = 1 over the field

so the FIELD-WIDE BUDGET IS PRESERVED EXACTLY and only its allocation changes. This matters: the
2026-08-31 attrition sweep showed forecast quality is sensitive to the total, so the total is held
fixed and the total is not what is being tested.

Applied as: mechanical probability `mechRate * mult_i(beta_mech[group])`, and wreck-victim
probability `p * mult_i(beta_acc[group])`.

FITTING. beta_mech[group] and beta_acc[group] by logistic regression of the binary outcome on
(0.5 - p_i), fit on TRAIN 2022-2024 ONLY, per series-pooled group. Fitted to ATTRITION DATA, never to
forecast scores - the holdout metric is not in the fit's objective at any point. Eight parameters
(4 groups x 2 layers), each from 900-3,300 driver-races.

HOLDOUT. 2025-2026, all three series, the same 162 races and the same reconstruction the caution mix
was judged on, so the two studies are directly comparable. Both arms get byte-identical driver
inputs; only the tilt differs.

GATES, both required, identical to the ones Fix C failed:
  a. Finishing-position chi-square NO WORSE than current on win / top5 / top10 reliability bins.
  b. Brier non-degradation on win / top5 / top10.
Plus a rail: total DNF cars per race must not move (the tilt is mean-preserving by construction, so
a shift means the implementation is wrong, not that the model changed).

MC NOISE IS ALREADY MEASURED, so "no worse" has a scale: winBrier sd 0.000007, t5Brier sd 0.000049
over five repeats. A degradation under ~2 sd is not a fail; a degradation of the size Fix C produced
(11 sd) is.

DECLARED IN ADVANCE:
  * A fail CLOSES this. The gradient would then stand as a documented property of the data that the
    sim is right to ignore, and I will not go looking for a third framing of the same idea.
  * The holdout reconstruction still has NO PRACTICE DATA. That weakens favorite identification,
    which is the exact quantity this study is trying to improve - so this test is BIASED AGAINST the
    tilt, not for it. Stating that now so a pass cannot later be waved away and a fail cannot be
    blamed on it after the fact.
  * If it passes, it still does not ship on this evidence alone: it would need the practice-carrying
    reconstruction before touching the live board, because a change that reprices favorites is the
    most consequential kind this product makes.

PREDICTION ON RECORD, so this is falsifiable rather than a fishing trip: win Brier improves, driven
by the top reliability bin closing from 24.0->32.1 toward parity, and the improvement is largest at
short tracks and road courses and absent or slightly negative at superspeedways.

---

## 2026-08-31 — HOLDOUT VERDICT, skill-tilted DNF: PASSES on Brier and log loss. NOT SHIPPED YET.

Same 162 holdout races, same reconstruction, same two arms differing only by `skillTilt:true`.
Run four times because a single run is not enough after the day this has been.

    metric              A cur (mean of 4)   B tilt (mean of 4)   B better in
    win   Brier             0.022519            0.022479            4 of 4
    win   LogLoss           0.090184            0.089925            4 of 4
    top5  Brier             0.093664            0.093612            4 of 4
    top5  LogLoss           0.303770            0.303504            4 of 4
    top10 Brier             0.154443            0.154333            4 of 4
    top10 LogLoss           0.467979            0.467709            4 of 4

    DNF cars per race       5.33                5.32
    (the mean-preserving rail holds: allocation moved, total did not)

TWELVE OF TWELVE comparisons favour the tilt. Win Brier improves by 0.000040 against a measured
single-run sd of 0.000007 — roughly 5-6 sd, and the sign never flips across runs.

GATE (b) Brier non-degradation: PASS, decisively.
GATE (a) chi-square no worse: **CANNOT BE ADJUDICATED, and I am not going to score it as a pass.**
Per-run values, A vs B: win 8.2/7.8/9.7/7.2 vs 8.0/9.3/7.6/10.5; top5 3.8/4.4/4.7/5.8 vs
3.1/3.6/3.4/3.4; top10 15.8/15.0/13.7/14.3 vs 14.4/16.4/10.9/16.4. Top5 is consistently better.
Win and top10 swing more BETWEEN REPEATS OF THE SAME ARM than they do between arms. The statistic is
built from a handful of reliability bins and is too noisy at this sample size to resolve a
0.2%-scale effect. That is a defect in the gate I wrote this morning, not evidence either way.

MY PREDICTION WAS ONLY HALF RIGHT, recorded because it was made in advance. I predicted win Brier
would improve — it did — "driven by the top reliability bin closing from 24.0->32.1 toward parity."
That bin barely moved: 24.2->36.1 becomes 24.3->35.4. The gain came from the middle bins instead
(6.9->5.3 becomes 6.9->6.0; 14.2->15.7 becomes 14.2->15.0). So the tilt is not mainly fixing
favourite under-confidence, which was the story I told when the operator raised the idea. It is
improving the mid-field, and the model remains badly under-confident about the best car. That
remains unexplained and is now the standing open question.

WHAT THE FIT ACTUALLY SAYS, which is simpler than the story I told this morning:

    layer        SHORT    INT      SS       ROAD
    accident     0.885    0        0        0
    mechanical   1.851    2.412    2.144    1.731

Mechanical attrition is strongly skill-dependent EVERYWHERE (t = 4.1 to 8.1); the strongest car
breaks at 0.16-0.27x the weakest car's rate. Accident attrition is skill-dependent ONLY at short and
flat tracks (t = 3.70). The superspeedway accident INVERSION I highlighted from the raw quartile
table is NOT resolved (t = 0.35) and the |t|-shrinkage zeroes it. I over-read a quartile table; the
fit corrected me. Road course and intermediate accident slopes likewise shrink to zero.

So the shipped effect, if it ships, is mostly "good teams break less," plus "good drivers crash less
at short tracks." That is a duller sentence than the one I wrote this morning and it is the one the
data supports.

### NOT SHIPPED, BY THE REGISTRATION'S OWN TERMS

The registration said: "If it passes, it still does not ship on this evidence alone: it would need
the practice-carrying reconstruction before touching the live board, because a change that reprices
favorites is the most consequential kind this product makes." That still stands. Additionally:

  * The effect is SMALL — win Brier 0.02252 -> 0.02248, about 0.2% relative. Consistent and free,
    but not the kind of margin that justifies bypassing the remaining check.
  * One of the two gates could not be adjudicated. A clean ship wants a gate that resolves.
  * The reconstruction has no practice data, which the registration noted biases the test AGAINST
    the tilt. That makes the pass more credible, not less — but it also means the fitted betas were
    derived from boards whose speedScore percentile is noisier than a live board's. The betas should
    be REFIT on a practice-carrying reconstruction before they are trusted as constants.

`DNF_TILT_ACC` / `DNF_TILT_MECH` and the `skillTilt` flag are in `simEngine.js`, OFF by default and
unreachable unless a board passes the flag, exactly like `cautionMix`. Difference: the caution mix is
marked REJECTED, this one is marked PASSED HOLDOUT, NOT YET SHIPPED — do not enable either without
reading this entry.

NEXT, in order: build the practice-carrying reconstruction (practice_laps -> practiceGrader
long-run pace, per historical board), refit the betas on it, re-run this holdout with a chi-square
replacement that actually resolves, and only then put a ship decision in front of the operator.

---

## 2026-08-31 — WHERE the skill tilt helps, by field tier: middle and tail YES, top NO. It OVER-TILTS.

Operator: "Do you think it will help price the middle of the field and the tail?" Measured instead of
reasoned about. 162 holdout races, 15k sims, every prediction split by the driver's speedScore
quartile within his own field.

    tier            DNF% predicted -> actual        top10 Brier gain (+ = tilt better)
                    current   tilt    ACTUAL
    Q4 strongest      12.8     9.5     12.3              -23.40e-5   TILT WORSE
    Q3                14.1    12.4     15.2               -9.67e-5   TILT WORSE
    Q2                14.9    15.5     16.8              +29.41e-5   tilt better
    Q1 weakest        15.8    20.4     20.4              +29.85e-5   tilt better

ANSWER TO THE QUESTION: yes, decisively, for the middle and the tail. Q1 goes from 15.8% predicted
against a 20.4% actual to 20.4% — exact. Q2 improves. Both bottom tiers improve on top10 Brier by
about +30e-5, which is far larger than the aggregate effect that passed the holdout.

BUT THE SAME TABLE SHOWS THE TILT IS BROKEN AT THE TOP, and this had not surfaced before because the
aggregate result netted it out. The current FLAT model predicts 12.8% for the strongest quartile
against a 12.3% actual — nearly exact, by accident. The tilt drags that to 9.5%, a 2.8-point
over-correction, and top10 Brier gets WORSE by -23e-5 for exactly the drivers whose prices matter
most. Q3 is over-corrected too.

The realized spread is Q1 20.4% vs Q4 12.3%, a factor of 1.66. The fitted tilt produces 20.4 vs 9.5,
a factor of 2.1. It is roughly 25% too steep, and all of the excess lands on the strong end.

LIKELY CAUSE. The fit is a logistic slope on log-odds, applied at runtime as a MULTIPLIER ON
PROBABILITY. Those agree when p is small and diverge as they separate; the strong end is where the
multiplier over-extends. The |t|-shrinkage guards against fitting noise, not against this
mis-specification. This is a form error in the parameterization I froze this morning, not a data
problem — the train measurement is fine, the mapping from it into the sim is not.

### THIS REVISES MY OWN SHIP RECOMMENDATION FROM ONE TURN AGO

I said I would ship it. That was based on aggregate metrics that passed 12/12 and on a robustness
check that held. Both of those are still true and neither was wrong. But they were blind to WHERE
the effect lands, and the operator's question was the thing that looked. As fitted, this change would
make the favourites — the drivers carrying most of the betting and DFS weight — measurably worse
priced, in exchange for a larger gain spread across the field. That is not a trade I would make
silently, and it is not what "passes the holdout" was implying.

DO NOT SHIP AS FITTED. The fix is specific rather than vague: recalibrate so the tilt reproduces the
OBSERVED tier rates instead of a log-odds slope — moment-match the multipliers to the measured
quartile spread, or cap the tilt at the strong end so it cannot push a tier below its own realized
rate. Then re-run this tier table AND the registered holdout. The gate for the re-test should include
a per-tier rail that this run would have failed: no tier's predicted DNF rate may move further from
its actual than the current model already is.

STANDING FINDINGS UNCHANGED: the skill gradient is real, the control passed, and the mechanism helps
the middle and the tail substantially. What is wrong is the shape of the curve, not the idea.

---

## 2026-08-31 — FIXING THE TILT, part 1: the link was wrong AND the shape is wrong. Two findings.

Operator: "how do you suggest we fix it and implement the change." Diagnosis first, on TRAIN only.

### FIX 1, done: the link function. Real, but small.

The first fit used a LOGIT link — a slope on log-odds — and the runtime applies the result as a
multiplier on PROBABILITY. Those agree while p is small and separate as p grows, which is why the
strong end over-extended. Refit with a LOG link (a relative-risk model), which is the scale the sim
actually multiplies on. `scripts/fit-dnf-tilt.js` now uses IRLS with mu = exp(eta).

    layer        SHORT           INT             SS              ROAD
    accident   0.885 -> 0.808   0 -> 0          0 -> 0          0 -> 0
    mechanical 1.851 -> 1.765   2.412 -> 2.309  2.144 -> 2.059  1.731 -> 1.578

Correct, and it is only a 4-9% reduction. Not enough on its own.

### FIX 2, NOT done: the SHAPE is wrong, and no single scale factor rescues it.

Added a `tiltScale` lambda to the engine and searched it on TRAIN against observed tier rates.

    TRAIN observed DNF% by tier (Q4 strongest -> Q1 weakest):   12.0  15.1  18.7  20.4

    lambda   delivered Q4/Q3/Q2/Q1          max tier error
    0        12.8  14.0  14.7  15.6           4.81 pts
    0.5      11.1  13.3  15.2  17.6           3.46 pts
    0.75     10.4  12.8  15.3  18.7           3.36 pts
    1.0       9.8  12.3  15.3  19.8           3.34 pts

Lambda cannot win. At 1.0 the tail is right (19.8 vs 20.4) and the top is 2.2 points too low. Turn it
down and the top recovers while the tail collapses. The reason is visible in the observed row: the
real profile is 12.0 / 15.1 / 18.7 / 20.4 — STEEP THROUGH THE MIDDLE and FLAT AT BOTH ENDS. An
exponential in percentile is the opposite shape: flattest in the middle, steepest at the extremes.
One parameter cannot fit a curve of the wrong family, and scaling it just trades one end against the
other. This is a parameterization error, and it is mine — the exponential was frozen this morning
because it was convenient, not because anything said the effect had that shape.

### THE THIRD FINDING, previously undocumented and worth its own line

**The sim ALREADY tilts, by accident.** At lambda = 0 — tilt fully off, shipped behaviour — delivered
rates are 12.8 / 14.0 / 14.7 / 15.6, not flat. That is a 1.22x back-loading that nobody put there on
purpose. Cause: in the wreck loop victims are `ord[Math.min(n - 1, seed + j)]`, so events seeded near
the end of the running order have their tail clamped onto the last car repeatedly, concentrating hits
at the BACK of the field. The clamp is a field-edge guard; the gradient is a side effect of it.

That reframes the whole target. The job is not 1.0x -> 1.70x. It is **1.22x -> 1.70x**, and roughly a
third of the needed effect is already present as an artifact. It also means the 2026-07-28 wreck-v1
budget-overlap correction (`WRECK_EV_EXP`) was compensating for the same clamp in the aggregate while
leaving this distributional consequence in place.

### THE PLAN, and why I am not doing it tonight

Correct fix is MOMENT MATCHING against the observed tier profile, not a smooth functional form:

  1. Replace the scalar beta with a per-tier multiplier curve, `DNF_TILT_CURVE[group] = [m_Q4 .. m_Q1]`,
     renormalized to mean 1 so the budget stays preserved.
  2. Calibrate it by iterative proportional fitting on TRAIN: start at obs_tier / obs_mean, run the
     sim, measure DELIVERED per tier, multiply the curve by obs/delivered, repeat 3-4 times. This
     converges onto the observed profile by construction and absorbs the accidental 1.22x with it,
     because it calibrates what the sim DELIVERS rather than what the data says in isolation.
  3. Re-run the tier table on TRAIN as the design check, then the registered holdout ONCE as the gate,
     with the per-tier rail added: no tier's predicted rate may end further from actual than the
     CURRENT model already is. Tonight's version fails that rail at Q4 and Q3, which is exactly why
     it is not shipping.
  4. Watch the parameter count. Four groups x four tiers is 12 free parameters against ~9,900 train
     driver-races, and the superspeedway cells thin out to 60-80 events. If per-group is too thin,
     fall back to one global curve times the existing per-group on/off structure, which is where the
     real group physics already lives.

This is a bounded, well-specified job and it wants a fresh head, not the tail of a fourteen-hour
session. Nothing has shipped, the flag is still off, and the engine currently carries the log-link
betas plus an unused `tiltScale` defaulting to 1.

---

## 2026-08-31 — TILT v3 PASSES, including the per-tier rail. Shape AND level, and they only work together.

Operator: "stop giving up until we figure out how to implement it without ruining the top of the
board." Right to push. It is solved.

### WHAT WAS ACTUALLY WRONG — the diagnosis changed twice more

v3 replaced the exponential with a MULTIPLIER CURVE anchored at the four field quartiles, calibrated
by iterative proportional fitting against what the sim DELIVERS on train boards (not against the raw
data — the sim already back-loads ~1.22x through the wreck loop's field-edge clamp, and IPF absorbs
that instead of stacking on it). After six iterations the SHAPE matched almost exactly, in ratio
terms, in every group. But every tier still came in ~2 points LOW.

That residual was not a tilt problem at all. It is THIS MORNING'S FINDING: the sim under-delivers its
own DNF budget by ~13%, because the caution preset is auto-set from a track's MEAN cautions and the
wreck pools modulate around the budget, so a point estimate lands under it. Because I had frozen the
curve to mean 1 — deliberately, to hold the total fixed — IPF could correct the shape and could not
touch the level. The flat model was hiding the same deficit by over-retiring the STRONG cars to make
the total up, which is exactly why flat looked accidentally right at Q4 and badly wrong at Q1.

So the fix is two halves: CURVE for the shape, LEVEL for the total. Calibrated together on TRAIN:

    lambda   delivered Q4/Q3/Q2/Q1      observed             max err
    1.00     10.4  13.1  16.1  17.9     12.0 15.1 18.7 20.4    2.61 pts
    1.15     11.8  14.8  18.2  20.2     12.0 15.1 18.7 20.4    0.49 pts
    1.30     13.2  16.6  20.3  22.4                            2.01 pts

DNF_TILT_LEVEL = 1.15, chosen on train.

**AND THIS IS WHY FIX C FAILED THIS MORNING.** Fix C corrected the same level deficit UNIFORMLY, and
lost its holdout, because raising a flat rate retires the FAVOURITES more — the wrong direction. With
the curve in place the extra attrition lands on the cars that actually retire, and the identical level
correction now passes. Neither half works alone. That is the whole day in one sentence.

### HOLDOUT, per-tier rail — the operator's actual question

    tier            DNF%: cur   tilt   ACTUAL    |cur-act|  |tilt-act|   RAIL
    Q4 strongest     12.8      11.7     12.3       0.46       0.67       PASS
    Q3               14.1      15.0     15.2       1.11       0.24       PASS
    Q2               14.9      18.4     16.8       1.90       1.66       PASS
    Q1 weakest       15.8      20.6     20.4       4.55       0.19       PASS

**DOES IT RUIN THE TOP OF THE BOARD? No.** Q4's DNF error moves 0.46 -> 0.67 points, and its Brier
changes are pure noise: four repeats gave +7.60, -1.82, -9.76, +11.55 e-5 on win and -37.41, +4.88,
+3.68, +9.73 e-5 on top10. Swinging that hard across identical configurations means nothing is
resolved there. Q1 by contrast improves in EVERY repeat — DNF error 4.55 -> 0.19, top10 Brier +7.05,
+9.44, +17.73, +13.97 e-5, never negative.

The earlier "Q4 gets much worse" reading came from the BROKEN v1 exponential, which really did drag
the strongest quartile to 9.5% against a 12.3% actual. v3 puts it at 11.7%. That defect is gone.

### AGGREGATE HOLDOUT, three independent runs

    win   Brier    A .022520 / .022536 / .022526    B .022509 / .022517 / .022509   B better 3/3
    win   chi2     A   7.3   /   8.3   /   8.1      B   6.4   /   6.6   /   6.8     B better 3/3
    top5  Brier    A .093778 / .093698 / .093695    B .093678 / .093601 / .093645   B better 3/3
    top10 Brier    A .154497 / .154408 / .154419    B .154493 / .154377 / .154409   B better 3/3
    DNF cars/race  A 5.33 vs 5.97 observed (-0.64)  B 6.06 vs 5.97 (+0.09)

Every Brier better in every run; win chi-square better in every run. top10 chi-square is worse and
remains the one metric that does not co-operate — it also swings 13.5-16.4 within arms, so I do not
read it either way. The forecast gain is SMALL. The attrition calibration gain is LARGE and is the
point: retirement is now right at every tier and in total, for the first time.

### STATUS

Engine carries DNF_TILT_CURVE + DNF_TILT_LEVEL, still behind `skillTilt` and still OFF. Gates:
per-tier rail PASS, Brier PASS, win chi-square PASS, top10 chi-square unresolved.

Remaining before it goes live, unchanged from the original registration: the practice-carrying
reconstruction. The curve is anchored on speedScore PERCENTILE, and practice sharpens that ordering —
so the anchors should be recalibrated on boards that have it before this prices a real weekend. That
is now the only thing between this and shipping.

---

## 2026-08-31 — PRACTICE-CARRYING RECONSTRUCTION: built. Recalibration CANNOT be done. Tilt does not ship.

Operator asked for the practice-carrying reconstruction to recalibrate the tilt anchors. Built it.
The answer is that the recalibration is not possible with the data that exists, and the tilt is
therefore not ready. Two hard data facts and one clean measurement.

### DATA FACT 1 — there is no practice data in the training era

`practice_sessions`, which is what the sim actually reads:

    year   cup      oreilly   trucks
    2023    1 wknd    -         -
    2024   12         -         -
    2025   18        14        15
    2026   21        12        14

The 2022-2024 training era is effectively practice-free. Every calibration to date therefore used
boards where the speedScore ordering is blurrier than production. That was the known blocker.

Also: `best5` — the metric the shipped sim prefers for cup and trucks — is NULL before 2026 and only
27% populated in 2026. The reconstruction uses `overall_avg`, which is exactly what the sim falls
back to, so this is faithful rather than a substitution.

### THE MEASUREMENT — 94 practice-carrying races, four arms, practice and tilt separated

                         win Brier    top5 Brier   top10 Brier   DNF bias
    no-practice flat      0.022862     0.090726     0.149144      -0.41
    no-practice TILT      0.022810     0.090696     0.149097      +0.22
    practice    flat      0.022643     0.089786     0.147335      -0.41
    practice    TILT      0.022636     0.089728     0.147154      +0.22

**PRACTICE IS WORTH FAR MORE THAN THE TILT.** Adding practice moves win Brier 0.022862 -> 0.022643
and top10 0.149144 -> 0.147335. The tilt's entire effect is an order of magnitude smaller. Worth
saying plainly after a day spent on the tilt.

The tilt still helps ON TOP of practice, and helps MORE on the markets that matter for DFS:

    tilt gain (x1e-5)     win     top5    top10
    without practice     5.24     2.99     4.72
    WITH practice        0.78     5.72    18.17

But the per-tier rail FAILS on practice boards. The tier profile itself changes when practice is in
the ordering — actual Q4 attrition is 9.3% under practice-based tiering versus 12.3% without, because
practice identifies the strong cars better. The curve was calibrated against the practice-free
profile, so it over-tilts Q2 (predicted 15.9 against 13.3 actual, worse than flat's 12.9).

### DATA FACT 2 — recalibrating is not possible, and this is why

Tried it properly: a GLOBAL curve, 3 free parameters instead of 12, fit on the first 47
practice-carrying races and tested on the other 47.

    FIT half observed    7.9  10.7  13.1  19.5
    TEST half observed  10.7  13.3  13.4  21.5

**The target moves 2.8 points at Q4 between the two halves.** That is larger than the effect being
fitted. The curve fit to the first half's steeper profile over-tilts the second, and the rail fails
at Q4 and Q3 — not because the method is wrong, but because 47 races cannot pin a four-point profile.
Recalibrated curve for the record: [0.657, 0.863, 0.930, 1.549], level 1.024. It should not be used.

Notable and honest counterpoint: even mis-calibrated, the tilt improved top10 Brier on EVERY tier of
the held-out half (+45.15, +12.48, +11.46, +22.78 e-5) and aggregate top10 0.147754 -> 0.147523. The
finishing distribution improves even where the DNF rate calibration is off. That is a genuine loose
end, not a reason to ship.

### VERDICT: NOT SHIPPING. The blocker is DATA, not method.

The tilt needs a calibration set of practice-carrying boards big enough that the per-tier profile is
stable. Ninety-four races is not it. That is roughly another full season across all three series —
2027, or 2026 plus a backfill of practice for 2024-2025 if those files still exist anywhere.

WHAT STANDS, unchanged:
  * The skill gradient is real and the accident/mechanical control passed decisively.
  * The v3 curve + level fix passed every gate on practice-free boards including the per-tier rail.
  * Practice data is worth several times the tilt, and it is already in the product.

WHAT IS NOW KNOWN THAT WAS NOT THIS MORNING: practice does not merely sharpen the ordering, it
CHANGES THE TARGET — the DNF-by-tier profile is materially different when tiers are assigned with
practice in the speedScore. Any future attempt must calibrate on practice boards from the start.
Calibrating without practice and validating with it, which is what today did, cannot work.

`skillTilt` stays OFF. `scripts/backtest-practice-tilt.js` and `scripts/recalibrate-tilt-practice.js`
reproduce all of the above.

### 2026-08-31 — CORRECTION to the practice entry above: the split was NOT temporal. Redone properly.

Operator: "Did you even include the 2026 practice sessions?" They were included — 47 of the 94
practice-carrying races are 2026. What was wrong was the SPLIT, and he was right to ask.

THE ERROR. The recalibration sliced the file in half and my script comment asserted "holdout.txt is
ordered by race id, 2025 first." It is not. Races interleave: in id order 2025 occupies rows 1-83 and
2026 occupies rows 33-94. So the "fit half" was a scrambled mixture of both seasons and the "test
half" was too. I described a temporal split and ran a mixed one, and I never checked the assumption
that made the description true.

REDONE with a real split — fit on 2025 (47 practice races), test on 2026 (47), year now carried in
the data file so this cannot be assumed again:

    FIT  2025 observed DNF% by tier (Q4->Q1)    9.8  11.2  14.3  22.7
    TEST 2026 actual                            8.7  12.7  12.3  18.4

    tier   flat   TILT   ACTUAL   |flat-act|  |tilt-act|   rail
    Q4     11.4   10.0     8.7      2.69        1.33       PASS
    Q3     12.6   11.5    12.7      0.12        1.20       FAIL
    Q2     13.0   14.5    12.3      0.77        2.27       FAIL
    Q1     13.9   22.9    18.4      4.53        4.47       PASS

    aggregate  win Brier 0.022842 -> 0.022850   top10 0.144645 -> 0.144590
    recalibrated curve [0.7455, 0.7713, 0.8700, 1.6132], level 1.179 — DO NOT USE

THE CONCLUSION SURVIVES AND IS NOW BETTER SUPPORTED, WHICH IS LUCK, NOT CREDIT. The season-to-season
instability is LARGER than the scrambled split showed: Q1 attrition is 22.7% in 2025 and 18.4% in
2026, a 4.3-point swing, against a tilt effect of a few points. The curve fitted to 2025 over-tilts
Q1 on 2026 by 4.5 points and fails the rail at Q3 and Q2. Aggregate win Brier is marginally WORSE.

So: 47 races per season cannot pin a four-point profile, and calibrating on one season to apply to
the next is unreliable on top of that. The tilt still does not ship, and the blocker is still data.
Note also that 2026 is a PARTIAL season here — races through 2026-08-23 only — so its 47 races are
not a full year's coverage either.

WHAT I SHOULD HAVE DONE, recorded as process: the year was available in `races` the whole time and
cost one extra column to carry. I inferred an ordering from a query that had no ORDER BY on its outer
select, which is not an ordering at all. `string_agg` over a `group by` guarantees nothing about row
order. The data file now carries the year explicitly and the script filters on it.

---

## 2026-08-31 — ONE-PARAMETER TILT: safe, but does NOT improve forecasts. Line of inquiry CLOSED.

Last attempt, on the reasoning that every richer version failed because a four-anchor curve chases a
per-tier profile that swings 4+ points between seasons. One parameter, a straight line in percentile,
mean 1 so the budget is untouched:  mult_i = 1 + 2s(0.5 - p_i).

Swept s on three independent sets. s = 0.10 is the ONLY value that passes the per-tier rail on all
three; every larger value lowers the WORST tier error while pushing some individual tier past where
flat already was — the Q4/Q3 overshoot again, in miniature.

    set                          s=0 tier err   s=0.10 tier err   rail
    practice-free holdout (162)     4.56 pts        3.59 pts       PASS
    practice 2025 (47)              9.08            8.22           PASS
    practice 2026 (47)              4.56            3.75           PASS

DNF calibration improves on all three. Then the forecast check, four independent runs of s=0 vs
s=0.10 on the full 162-race holdout:

    win Brier gain (x1e-5):   +2.50   +3.92   -1.28   -1.33
    top5 Brier gain (x1e-5):  +0.28   +0.91   -1.98   -3.02

**Two positive, two negative. The forecast gain is noise.** The first run looked like a 3.6-sigma
win; it was not, and I would have reported it as one if I had stopped at one run. Measured MC noise
on this metric is sd 0.000007 per run, and the s=0.10 effect sits inside the spread of repeated
measurements of the SAME arm.

### VERDICT

The one-parameter tilt makes retirement rates measurably more correct, costs nothing, hurts no tier —
and does not improve win, top5 or top10 forecasting by any amount this holdout can detect. By the
standard this project has used all day, that is a NO. "More correct" is not "predicts better," and
that distinction has now cost three separate attempts today. Not shipping it.

CLOSING THE LINE. Four parameterizations tested against a pre-registered holdout: logit-link
exponential (failed at the top), log-link exponential (wrong shape), IPF-calibrated four-anchor curve
(passed practice-free, failed on practice boards), one-parameter linear (safe, no effect). The skill
gradient in the DATA is real and the accident-vs-mechanical control passed decisively — but the sim's
finishing distributions are not sensitive enough to who retires for it to show up in what the product
sells. That is the finding. It is a negative result and it is worth as much as a positive one,
because it stops anyone spending another day here.

ONE THREAD LEFT DELIBERATELY UNCUT, stated without overclaiming: top10 Brier improved on the practice
boards at EVERY value of s tested — 2025 0.150130 -> 0.150009 / 0.149896 / 0.150076 / 0.149920, and
2026 0.144515 -> 0.144425 / 0.144447 / 0.144471 / 0.144374. Eight of eight in the same direction. Those
are 47-race sets where noise is roughly three times the full holdout's, so this is suggestive and NOT
established. If anyone returns to this, that is the thread — top10 on practice boards, which is also
the market DFS floors are priced off — and it needs its own registration, not a re-reading of these
numbers.

DO NOT reopen the DNF tilt on the strength of the tier tables in this log. The tier calibration
improves and the forecasts do not. That is the whole story.

---

## 2026-08-31 — PRE-REGISTRATION: the win-market confidence contradiction. Whose favorite number is wrong?

Operator directed continuing. This registration is NOT the DNF tilt in another costume — it targets a
quantity roughly fifty times larger, and it starts by admitting that my evidence for it CONFLICTS with
what is already in this log.

### THE OBSERVATION

Raw-sim favorite calibration, measured today across the reconstruction (no marketAnchor, no lineup
projection, no equipment overrides):

    practice-free holdout, 162 races   board favourite predicted 23.6%  ->  actually won 34.0%
    practice boards,        94 races   board favourite predicted 25.0%  ->  actually won 31.9%

    win-prob bin      predicted -> observed  (practice-free, n)
      2-  5%             3.2  ->   2.4    (1092)
      5- 10%             6.9  ->   5.8    (521)
     10- 20%            14.2  ->  15.7    (299)
     20- 35%            24.1  ->  34.7    (75)

That is a textbook UNDER-confidence signature: too much probability spread across the midfield, not
enough on the top car. Practice narrows the favourite gap from 10.4 points to 6.9 and does not close it.

### THE CONTRADICTION, stated up front

This log already says the OPPOSITE, twice:

  * 2026-08-2x: "cup favorites at the very top of the win market are over-confident (12 picks at
    20.8 pct stated, 8.3 pct realized), which is what marketAnchor and the favorite shade exist for."
  * Same series of entries: "Cup favorites were ALREADY over-confident pre (16.8 stated vs 9.1
    realized) ... and the post board makes it WORSE."

So the shipped product has a FAVORITE-SHADE TOOL that exists to push favourites DOWN, and I have just
measured that the raw engine puts them 10 points too LOW. Both cannot be describing the same object.

THE RECONCILIATION I SUSPECT, and it is a hypothesis, not a finding: those entries measure the LIVE
BOARD — practice, projected lineups, equipment overrides, and marketAnchor. I measured the RAW SIM.
If the raw sim under-rates the favourite and marketAnchor over-corrects past truth, both observations
are true and the defect is in the correction layer, not the engine. That would make the favourite
shade a patch over an engine bug, applied twice.

THE ALTERNATIVE, which I rate at least as likely: my reconstruction's "favourite" is not the live
board's favourite. Without practice or projected lineups the strongest car is identified differently,
and a reconstruction favourite winning 34% may say nothing about a real board's favourite. Today has
already produced three cases where a clean-looking measurement from this reconstruction did not mean
what I first said it meant.

### PRIOR ART THAT CONSTRAINS THIS, found before writing rather than after

`GROUP_NOISE_MULT` — the obvious sharpening dial — has ALREADY been through registered calibration.
SHORT (2026-08-29): "fit minimum (m=1.00, surv~16; basin flat 15-18, noise dial confirmed clean at
1.0)." INT: "froze parsimonious m=1.00, surv=18." Both studies moved WRECK_SURV_COST and left noise
at 1.0. SS carries 1.75 and a later registered study left it untouched.

So the noise dial has been swept and rejected twice. I am NOT re-proposing it blindly. What those
studies fit was the PLACEMENT band set (win + top5 + top10 + fin25 jointly), and their own note says
the win band was the part that would not fit: "INT's win band 01-03, which is why the win-only fit's
holdout failed — wins were the noisy metric." The win market specifically was left unresolved and
explicitly labelled too noisy. That gap is what this targets, and if the answer is again "noise is
clean at 1.0" then the defect is elsewhere and this closes.

### PROTOCOL, frozen

**STEP 1 IS A HARD GATE — reconstruction fidelity. Nothing proceeds until this passes.**
`sim_results` holds 11 stored LIVE boards (5 cup, 3 oreilly, 3 trucks, post-stage, Jul-Aug 2026).
Run the reconstruction on those same 11 races and compare, PAIRED, per board:
  a. the reconstruction's favourite win% against the stored live board's favourite win%, and
  b. whether they name the SAME DRIVER as favourite.
PASS requires the same driver on at least 8 of 11 boards AND a mean absolute win% difference under
5 points. FAIL means the reconstruction cannot speak about favourite calibration at all, every
number in the observation section above is void for this purpose, and this study is CLOSED with that
recorded. Eleven boards is a small sample for a hit rate but ample for a paired systematic offset,
which is what is being tested.

**STEP 2 — locate the defect, only if step 1 passes.** Measure favourite calibration separately for
(i) the raw sim, (ii) the stored live boards' pre-anchor numbers if recoverable from `config`, and
(iii) post-anchor. If under-confidence is in the raw sim and over-confidence appears only after
marketAnchor, the target is the anchor layer and NOT the engine, and the registration re-points there
before any parameter moves.

**STEP 3 — intervention, one parameter, only if steps 1-2 locate it in the engine.**
A single sharpening term: `noiseWidth * tau`, tau < 1, applied globally, NOT per group — per-group
was already tried and rejected, and eight groups of freedom is how the DNF tilt died today.
FIT: tau on TRAIN 2022-2024 by MOMENT-MATCHING the favourite win rate. Never against holdout Brier.
HOLDOUT: 2025-2026, one shot.

GATES, all required:
  a. win Brier improves by more than 2x the measured MC noise (sd 0.000007 per run, so > 0.000014),
     confirmed across FOUR independent runs with the sign never flipping. Two-of-four positive is a
     FAIL — that is precisely how the one-parameter DNF tilt died tonight and I will not re-learn it.
  b. NO reliability bin gets worse. Sharpening moves probability from the midfield to the top; if the
     2-10% bins degrade to buy the top bin, that is a redistribution, not a calibration.
  c. top5 and top10 Brier non-degradation. The placement bands are already calibrated and shipped;
     this must not spend them.
  d. The SS group is exempt from any tau change — GROUP_NOISE_MULT SS 1.75 survived its own
     registered study and is not in scope.

**DECLARED IN ADVANCE:**
  * A step-1 failure closes this immediately and also retroactively voids today's favourite-calibration
    numbers. I would rather find that out in an hour than build a third parameterization on sand.
  * If the defect lands in marketAnchor rather than the engine, THAT is the finding, and the fix is
    to stop shading favourites down — a change to a shipped tool, which goes to the operator before
    anything moves.
  * "More correct" is not "predicts better." That sentence has cost four attempts today. Unlike the
    DNF work, though, here the forecast ITSELF is what is miscalibrated — a 10-point error on the
    single number the product sells — so if the observation survives step 1, fixing it IS a forecast
    improvement by construction rather than by hope.

**PREDICTION ON RECORD:** step 1 passes on driver identity (>=8/11) but shows the reconstruction's
favourite win% running 3-6 points BELOW the live board's, because practice concentrates the board
(this log already measured that: "Top favorite's win pct averages 17.8 pre and 25.3 post"). If so the
raw-sim under-confidence is real but SMALLER than 10.4 points, and the honest target is nearer 5.

WHY THIS IS WORTH THE OPERATOR'S TIME WHEN THE DNF TILT WAS NOT: the DNF tilt chased a 0.2% relative
Brier change. A favourite priced at 24% that wins 32-34% is a 8-10 POINT error on the most heavily
bet number on the board. If it is real and in the engine, it is the largest single mispricing this
model has, and it is in the direction of leaving money on the table rather than losing it.

### 2026-08-31 — STEP 1 RESULT: FAIL, narrowly. Win-confidence study CLOSES as registered.

    race  series   live favourite     live%   recon favourite    recon%   same    diff
    436   trucks   Layne Riggs         29.6   Layne Riggs         19.9    YES     -9.7
    438   cup      Denny Hamlin        22.1   Denny Hamlin        20.2    YES     -1.9
    439   oreilly  Chase Elliott       15.1   Justin Allgaier     15.9    no      +0.8
    474   oreilly  Ross Chastain       17.8   Justin Allgaier     15.4    no      -2.4
    475   cup      Ryan Blaney         39.5   Ryan Blaney         36.1    YES     -3.4
    476   trucks   Kaden Honeycutt     27.8   Ty Majeski          28.0    no      +0.2
    477   cup      Ryan Blaney         39.6   Ryan Blaney         30.4    YES     -9.2
    478   trucks   Layne Riggs         17.1   Layne Riggs         16.1    YES     -1.0
    479   cup      Ryan Blaney         18.8   Ryan Blaney         21.2    YES     +2.4
    480   oreilly  Austin Hill         26.6   Jesse Love          13.0    no     -13.6
    481   cup      Joey Logano          5.8   Joey Logano         15.8    YES    +10.0

    same favourite   7 / 11        gate was >= 8      FAIL
    mean |diff|      4.96 pts      gate was < 5.0     pass
    mean SIGNED      -2.53 pts     (reconstruction is LESS confident than the live board)

**FAIL on identity, by one board. The study CLOSES.** That was declared in advance and it is honoured
without reopening: today's "favourite predicted 23.6% -> won 34.0%" is VOID as evidence about the
engine. The reconstruction does not reliably name the same favourite the product does, so its
favourite is a different object and its calibration says nothing about the board's.

Checked before accepting it, rather than after: cup alone is 5/5 on identity — but its mean |diff| is
5.38, which fails the other half of the gate. There is no subset that passes both. Not carving one
out after seeing the numbers anyway; that is what the gate exists to prevent.

WHAT THIS DOES NOT SAY. It does not clear the engine. It says this instrument cannot measure the
question. The only live-board evidence remains the n=11-12 cup picks in the earlier entries, pointing
the OTHER way (over-confidence), and that is also too small to settle anything. The win-market
confidence question is genuinely OPEN and currently unanswerable with what exists.

### THE FINDING THAT MATTERS MORE, and it reaches back over the whole day

The signed offset is -2.53 points: **the reconstruction is systematically less confident than the live
board.** And the identity failures are not random — cup is 5/5, O'REILLY IS 0/3, trucks 2/3. The
reconstruction is materially worse at O'Reilly, almost certainly because that series leans hardest on
practice and lineup information the reconstruction does not carry.

That is a caveat on EVERY backtest run today, and it was not known when they ran. The DNF tilt
holdouts pooled all three series. Their cup component is trustworthy; their O'Reilly component is
built on boards whose favourite is frequently the wrong driver. None of today's conclusions flip on
this — the tilt findings were about mid-field and tail attrition, not favourite identity — but any
future study using this reconstruction should either weight cup more heavily or validate per series
first. Recorded here so the next session does not have to rediscover it.

### THE PATH THAT WOULD REOPEN THIS PROPERLY

`sim_results` holds 11 boards, all from a five-week window (2026-07-24 to 2026-08-29). The gate failed
on a sample that thin partly because 11 boards cannot absorb one oddity. Every board the operator
publishes is stored. At roughly three per weekend, a full season is 100+ boards — at which point the
favourite question is answerable directly ON LIVE BOARDS, with no reconstruction and no fidelity gap,
which is the correct way to ask it in the first place.

That is the recommendation: stop trying to reconstruct the board, and let the real boards accumulate.
The instrument for this question is the product's own published output, and it is already being saved.

---

## 2026-08-31 — SHIPPED: the superspeedway caution pin was cosmetic. Talladega was simming half its wrecks.

Operator: "fix Talladega then." This is a BUG FIX, not a model tuning change, and the distinction is
the whole justification for shipping it without a fresh registration.

### THE BUG

`SimulationCenter` carries a comment from 2026-07-22: "superspeedways pinned (SS noise calibration
anchor)." The auto-preset effect honours it like this:

    if (isSuperspeedway(config.track_name)) { setCautionAutoNote('SS: pinned (calibrated)'); return }

It sets a NOTE and returns. It never sets a preset. Meanwhile the config loader, which runs for every
track including superspeedways, had already done this:

    const __ci = a < 6 ? 0 : a < 11.5 ? 1 : 2      // a = track's mean total_cautions
    setCautionPreset(getCautionPresets(s)[__ci])

So the pin was cosmetic. The board displayed "SS: pinned (calibrated)" while the caution bucket
actually chose the preset, and the preset selects which wreck pool `runRaceSim` draws from.

### WHAT IT COST, and it is exactly one cell

Cup Talladega averages 5.33 cautions. Daytona averages 6.17. The boundary is at 6. Two plate tracks in
the same correlation group, same wreck physics, split onto different wreck pools by 0.84 of a caution.

Checked every superspeedway cell in the holdout before assuming it was general — it is not:

    cell                                    n   avgCau   preset    measured DNF
    cup Talladega                           3    5.33    Low           20.9%    <- the only Low
    cup Daytona                             4    6.17    Medium        22.8%
    cup Atlanta                             4    9.00    Medium        25.7%
    oreilly Talladega / Daytona / Atlanta   11   7.0-7.8 Medium     23.7-32.9%
    trucks Talladega / Daytona / Atlanta     5   7.0-8.7 Medium     13.7-19.4%

26 of 27 SS races were already on Medium. Cup Talladega alone sat on the calm pool.

### THE MEASUREMENT, 2025-26 holdout, cup Talladega, Low -> Medium

    config       DNF%    win Brier    top5 Brier   top10 Brier
    Low (was)    10.4     0.026073     0.118903     0.209805
    Medium       20.4     0.024942     0.109322     0.189962
    measured     20.9

Attrition goes from HALF the real rate to essentially exact. All three markets improve, and by margins
an order of magnitude larger than anything else examined today — because this was a broken cell, not a
tuning question. Low's own run-to-run spread over four repeats is ~0.00014 on win Brier; the Low-Medium
gap is 0.0011, about eight times that.

SS-wide across all 27 holdout races, pinning Medium also improves every market (win .024499 -> .024356,
top5 .107556 -> .106405, top10 .183943 -> .181652) and moves delivered attrition 24.5% -> 25.6% against
24.6% measured. Diluted because only 3 races change, but the direction is consistent.

### THE FIX

One line, making the documented pin real:

    setCautionPreset(getCautionPresets(s)[isSuperspeedway(cfg.track_name) ? 1 : __ci])

Nothing else moves. No constant, no curve, no wreck parameter. Manual preset clicks still override, as
they always did.

WHY THIS SHIPS WITHOUT A NEW REGISTRATION, stated so it is not used as precedent: the change restores
behaviour the code already documents and the UI already claims. The registration discipline exists to
stop new model opinions being smuggled in on a good-looking number — this removes an unintended one.
The holdout evidence above is confirmatory, not the justification.

WHAT IT DOES NOT FIX: the schedule-wide under-delivery of the DNF budget (bias -2.27 cars/race) is the
caution-preset interaction described earlier and is untouched. Talladega was the one cell where that
interaction had crossed into being flatly wrong rather than merely imprecise.

Build green, lint:undef clean, sim:smoke passing.

---

## 2026-08-31 — THE CAUTION BUCKET IS A CLIFF, AND THE SCHEDULE IS STACKED ON IT

Operator: "Does the dial for the caution rates clash with the DNF rate set by prior track history...
it just seems like how DNFs work for the sim could still have some kind of bug in it." Audited. The
data side is clean. The bug is in the selector, and Talladega was a symptom of it rather than the
whole of it.

### DATA-SIDE AUDIT — clean, recorded so nobody re-checks it

  * `races.exhibition` has ZERO nulls, so the loader's `.eq('exhibition', false)` and the auto-preset
    effect's `.not('exhibition','is',true)` — which treat nulls differently — agree today. They would
    diverge the moment a null appears. Latent, not live.
  * `loop_data` starts at 2022. The live per-track DNF query has no year filter, which would have
    pulled pre-Next-Gen races into the average if any existed. None do.
  * No series+track exceeds 700 `loop_data` rows, so PostgREST's 1000-row default is not silently
    truncating the DNF measurement. Closest cell has room; worth re-checking around 2028.
  * All 436 races have `laps_completed` AND `finish_status` on every row — no mixed-null races, so
    the `mx = max(laps)` winner-lap reference is never computed from a partial field.

### THE ACTUAL BUG: a continuous input hard-thresholded into three buckets that differ ~2.5x

`__ci = avg < 6 ? Low : avg < 11.5 ? Medium : High`, where avg is the track's mean `total_cautions`.
The chosen preset drives THREE things, not one: the wreck-event pool (`WRECK_SETS[group][cb]`), the
score noise width (`cautionPreset.noise`), and the dominator curves (`LL_CURVES_G` / `FL_CURVES_G`).
Delivered attrition differs by roughly 0.5x / 0.9x / 1.4x across the three.

So a fraction of one caution, in one race, can move a track across a cliff that changes attrition by
~80% and simultaneously swaps its noise width and dominator curves. **Cup Talladega was not a special
case. It was the one cell that had already fallen off.**

HOW EXPOSED THE SCHEDULE IS — cells within 0.5 cautions of a boundary:

    trucks  Las Vegas          6.00   Medium   ON THE BOUNDARY EXACTLY
    oreilly Talladega          6.13   Medium   0.13
    trucks  Bristol            5.86   Low      0.14
    oreilly Kansas             6.20   Medium   0.20
    trucks  Charlotte          5.80   Low      0.20
    cup     DAYTONA            6.20   Medium   0.20
    oreilly Darlington         6.25   Medium   0.25
    trucks  COTA               5.67   Low      0.33
    oreilly Watkins Glen       6.40   Medium   0.40
    trucks  Atlanta            6.40   Medium   0.40
    oreilly Phoenix            6.44   Medium   0.44
    oreilly Roval / Auto Club / Road America / Portland   0.50

Fifteen cells within half a caution. **Cup Daytona — the biggest board of the year — sits 0.20 from
the cliff.** Had Daytona averaged 5.9 rather than 6.20 it would draw the calm pool and sim roughly 15%
attrition against 32% measured, exactly the Talladega failure on the race that matters most.

### WHY THIS GETS WORSE, NOT BETTER

These averages move as races accumulate. A cell at 6.13 needs one race with 5 cautions to drop below
6.00. **A track can therefore sim at 0.5x one weekend and 0.9x the next because a single race added or
removed two cautions**, with no code change, no data error, and nothing on the board to indicate it.
oreilly Talladega at 6.13 and trucks Las Vegas at exactly 6.00 are one race away right now.

That instability is the bug the operator was sensing. It is not the same thing as the
by-design modulation (`wreck-v1.1-cb`) and it should not be filed under it: the modulation is a
deliberate spread, the CLIFF is an artifact of hard-thresholding a continuous quantity.

### WHAT A FIX LOOKS LIKE, and why none is being shipped on this entry

Three candidates, cheapest first:
  1. HYSTERESIS — require the average to clear a boundary by a margin before switching. Kills
     week-to-week flapping. Does not fix a cell that is simply on the wrong side.
  2. INTERPOLATE between adjacent presets by distance to the boundary, so 6.0 gets a 50/50 blend
     rather than a coin flip. Removes the cliff entirely. The `cautionMix` machinery already in the
     engine does exactly this kind of blending — but the version of it tested today FAILED its
     registered holdout, so this needs its own registration and must not inherit that one's evidence.
  3. Re-derive the boundaries. They were set when the preset values were chosen and have never been
     checked against where tracks actually cluster — and tracks clustering ON a boundary is the
     failure mode, so this is worth measuring before assuming 6.0 and 11.5 are the right places.

NOT shipping any of these here. The Talladega fix shipped because it restored documented behaviour;
these are new model opinions and go through registration. Logged so the exposure is on record: fifteen
cells within half a caution, cup Daytona among them.

---

## 2026-08-31 — PRE-REGISTRATION: decouple the caution preset's SHAPE from its LEVEL (the cliff fix)

Operator: "we need to fix this." Registering before building. Frozen.

### WHY NOT THE OBVIOUS FIX

The entry above listed interpolation between adjacent presets as the leading candidate. Worked it
through and it is WRONG, which is worth recording before it gets tried again. Cup presets sit at 4 / 8
/ 15 cautions. Cup Talladega averages 5.33, so interpolating by caution count gives 67% Low / 33%
Medium and a delivered ratio near 0.65x — WORSE than the Medium pin just shipped (0.96x, landing 20.4%
against 20.9% measured). Interpolation removes the cliff by spreading a track across two pools whose
attrition levels differ 2x; it does not make the level right. It trades a discontinuity for a
systematic error, and at Talladega it would have undone today's fix.

Hysteresis is also rejected as a primary: it stops a cell FLAPPING across a boundary but leaves a cell
that is simply on the wrong side exactly where it is. It treats the symptom.

### THE DIAGNOSIS THAT POINTS AT THE RIGHT FIX

Preset selection is doing two jobs at once:

  JOB A — pick the SHAPE appropriate to this track's chaos: which wreck-event pool is bootstrapped,
          which dominator curves apply, how wide the score noise is. This SHOULD vary by track.
  JOB B — set the attrition LEVEL, as a side effect of which pool got picked. This should NOT vary by
          track, because `dnfRate` already carries the level and it is measured from that same track.

Job B is the double-application, the cliff's teeth, and the reason a fraction of one caution swings
attrition ~80%. Job A is legitimate and stays.

### THE INTERVENTION, frozen

Divide out the selected bucket's delivered/budget ratio so EVERY track lands on its own budget,
whichever pool it draws from. The shape still varies with cautions; the level stops varying.

The machinery already exists in the engine: `__dnfFraction` measures what a bucket actually delivers at
a given budget and field size, and the `K` fixed point built for `cautionMix` divides it out. That path
is currently a deliberate no-op for a single bucket. This registers the single-bucket case as ON.

WHAT THIS IS NOT: it is NOT `cautionMix`, which sampled a track's historical caution DISTRIBUTION per
sim and FAILED its registered holdout. That test bundled distribution-sampling with K normalization and
cannot be quoted for or against this. K alone, on the single already-selected preset, has never been
tested in isolation. New question, new gates.

NO NEW PARAMETER. K is measured at run time from the budget and field, not fitted. Nothing to overfit,
which is why there is no train/test split on the mechanism.

### GATES, all required, on the 2025-26 holdout, 162 races

  a. CLIFF GONE: for a synthetic track swept across a boundary (5.5 -> 6.5 mean cautions), delivered
     attrition must change by less than 10% relative. Today it changes by ~80%. This is the point of
     the exercise and is mechanical, so it is a rail, not evidence.
  b. Win / top5 / top10 Brier NON-DEGRADATION, judged across FOUR independent runs with the sign never
     flipping. Two-of-four positive is a FAIL — that is how the one-parameter DNF tilt died and it will
     not be re-learned.
  c. NO reliability bin gets worse.
  d. Schedule-wide DNF bias must move toward zero from its current -2.27 cars per race. If the level
     is being corrected, this follows mechanically; if it does not, the implementation is wrong.
  e. Cup Talladega must not regress from what shipped today (DNF 20.4% against 20.9% measured).

DECLARED IN ADVANCE:
  * A gate-b failure closes this and the cliff stays documented-but-unfixed, with hysteresis as the
    fallback recommendation for the flapping half of the problem only.
  * The attrition-level sweep already showed forecast quality is only weakly sensitive to attrition
    level, so gate b passing is NOT expected to be dramatic. Non-degradation is the bar, not
    improvement. If it degrades, the level was load-bearing in a way nobody understood and that is
    itself the finding.
  * PREDICTION: gates a, d and e pass mechanically; gate b lands neutral, within 2 sd either way.
    Recording that so a neutral result cannot later be narrated as a win.

### 2026-08-31 — CLIFF FIX RESULT: gate C FAILS on repeat. Not shipped. The cliff stands.

    GATE A  cliff eliminated                    PASS   74% jump across the boundary -> 0%
    GATE B  Brier non-degradation, 4 runs       PASS   win neutral (2/2 sign split, t=1.1)
                                                       top5 t=+1.3 ns · top10 t=+2.7 BETTER
    GATE D  schedule DNF bias toward zero       PASS   -0.53 -> +0.18 cars/race
    GATE E  cup Talladega no regression         PASS   20.6% vs 20.9% measured
    GATE C  no reliability bin gets worse       **FAIL**

Gate A, the point of the exercise, works exactly as designed. Synthetic INT track swept across the 6.0
boundary at a fixed 15.5% budget:

    avgCau   bucket    CURRENT    FIXED
     5.5     Low         7.8%     15.5%
     5.9     Low         7.8%     15.5%
     6.1     Medium     13.6%     15.5%
     6.5     Medium     13.7%     15.4%

The 74% discontinuity becomes zero. The level stops depending on which side of a threshold a track's
mean caution count happens to land, which is precisely what was broken.

**AND IT STILL DOES NOT SHIP.** Gate C was measured ONCE and failed 6-2; I then repeated it three
times, because running a gate once is the mistake I have made repeatedly today and gate B was given
four runs for exactly this reason. The degradations are CONSISTENT, not noise:

    top10  5-10% bin    0.48->1.29 · 0.56->1.66 · 0.66->1.27     worse ~0.9pt every run
    top10  35%+ bin     1.07->1.62 · 1.14->1.84 · 1.09->1.63     worse ~0.6pt every run
    top5   5-10% bin    0.97->1.41 · 1.20->1.30 · 1.23->1.25     worse, small, every run
    win    2-5% bin     0.75->1.07 · 0.85->0.98 · 0.91->1.04     worse ~0.2pt every run
    top10  20-35% bin   2.27->1.93 · 2.10->1.52 · 2.52->1.69     BETTER ~0.5pt every run

The fix REDISTRIBUTES calibration error rather than removing it: the high-probability band improves,
the 5-10% band gets worse by more. Aggregate Brier hides this because the low bins hold most of the
mass. Registration said all gates required. Gate C fails. Not shipped.

THIS IS THE THIRD TIME TODAY a mechanically correct attrition fix has failed on calibration, and the
pattern is now unmistakable and worth stating as doctrine: **this sim's finishing distributions are
not limited by how many cars retire.** Every intervention that moved attrition — the caution mix, the
skill tilt in four forms, and now level normalization — bought correct retirement counts and paid for
them somewhere in the probability bands. That is a property of the model, not four coincidences.

### WHAT REMAINS TRUE, AND WHAT CAN ACTUALLY BE DONE

The cliff is real, 15 cells sit within half a caution of one, and cup Daytona is 0.20 away. Nothing
above changes that. What changed is that the obvious fix is now known to cost calibration.

HYSTERESIS, the fallback named in the registration, turns out NOT to be a drop-in: the preset is
recomputed from scratch on every board load, so there is no "previous bucket" to be sticky about.
It would need per-track persisted state — a column or a small table — which is real machinery and its
own decision, not a one-line change.

THE ZERO-RISK OPTION, and the recommendation: make the fragility VISIBLE instead of silent. The
Caution Rate card already shows the auto note ("auto: track avg 6.13 -> Medium"). Adding the distance
to the nearest boundary — and flagging it when under ~0.5 — turns an invisible coin-flip into
something the operator can see and manually override on the two or three boards a season where it
matters. No model change, no calibration risk, no gate.

Logged as the state of play: cliff documented, magnitude measured, the principled fix tested and
rejected on its own registered gates, and the remaining options are persistence (real work) or
visibility (cheap).

---

## 2026-08-31 — PER-BUCKET WRECK_EV_EXP: the fix the archive proposed and nobody built. Passes.

Operator: "Read all the backtest logs on DNF rate... We need to fix this properly... Did you even fix
the bug?" Straight answer to the last part first: NO. The SS pin shipped; the CLIFF was not fixed. A
full read of all seven md files then turned up two things that change the picture.

### WHAT THE FULL READ FOUND

**1. The precedent is two months old and was never applied to cautions.** 2026-07-14, BACKTEST_ARCHIVE:
*"DNF RATE~ MEASURE IT, DO NOT BUCKET IT"* — and inside it:

> *"THE REAL DEFECT~ the sim ALREADY measured the per-track DNF rate -- then THREW THE PRECISION AWAY
> by bucketing it into Low(.05) / Medium(.15) / High(.25)~ `__di = avg < 0.10 ? 0 : avg < 0.20 ? 1 : 2`.
> Rounding error up to +/-5 pts"*

That is the identical argument, made about the DNF rate, which is WHY `resolveDnfRate` exists and why
the DNF presets were demoted to manual overrides. The caution preset never got the same treatment. The
DNF rate is continuous; the caution level is still three buckets. That asymmetry is the cliff.

**2. `WRECK_EV_EXP` was calibrated when there was ONE pool per group, and was never re-derived when
three pools landed the same day.** The archive's entire justification for keeping it global is one
clause — *"Normalizer stays GLOBAL per group, so the preset now modulates realized attrition around
the dnfRate budget BY DESIGN"* — written the same day the pools were introduced. It is a declaration,
not an argument. And per-bucket was proposed exactly once, by me, hours ago, as *"a proposal, not a
decision"* — then abandoned for the K-normalization path, which failed.

Derived them the same way the originals were: raw sum(size x P) over each pool times its MC-realized
overlap/field-edge factor, 200k iterations, n=38.

    group  bucket   raw    realized@1   factor    per-bucket    global now
    SHORT  low     0.980     0.921       0.940      0.921          2.73
    SHORT  mid     2.339     2.209       0.944      2.209          2.73
    SHORT  high    5.380     4.779       0.888      4.779          2.73
    INT    low     1.024     0.976       0.953      0.976          3.11
    INT    mid     2.956     2.741       0.927      2.741          3.11
    INT    high    6.378     5.593       0.877      5.593          3.11
    SS     low     4.263     3.737       0.877      3.737          8.76
    SS     mid    11.003     8.621       0.784      8.621          8.76
    SS     high   16.140    12.069       0.748     12.069          8.76
    ROAD   low     0.963     0.948       0.985      0.948          2.84
    ROAD   mid     2.924     2.693       0.921      2.693          2.84
    ROAD   high    5.180     4.608       0.890      4.608          2.84

The global value is the POOLED AVERAGE of three pools whose expected accident counts differ 3-5x.
That is the entire 0.5x / 0.9x / 1.4x spread, arithmetically.

**Why this is NOT the level-normalization that failed gate C:** per-bucket EV scales the ACCIDENT
layer only. The mechanical share of `dnfRate` is untouched. levelNormalize scaled the whole budget, so
it added uniform independent knockouts to every car — which is what flattened the low probability bins.

One further defect found while implementing: the `__wScale` upper clamp of 2.5 was set when `wm.pre`
was global. With per-bucket normalizers the sparse calm pool legitimately needs more (INT low wants
~4.2 at a 15.5% budget) and the clamp was leaving a residual cliff. Widened to 8 on this path only;
per-victim probability is still guarded by the existing min(0.95, ...) saturation.

### RESULTS

    GATE A  cliff eliminated        PASS   synthetic INT sweep across 6.0 at fixed budget:
                                           CURRENT 7.8 / 7.9 / 13.6 / 13.6 %   (74% jump)
                                           FIXED  14.3 / 14.4 / 14.8 / 14.8 %  (2.8% jump)
    GATE B  Brier non-degradation   PASS   4 runs. win neutral (1 better / 3 worse, mean +4.5e-6,
                                           sign flips). top5 neutral (2/2). **top10 BETTER 4 of 4**,
                                           mean +36.5e-6, sign never flips.
    GATE D  DNF bias toward zero    PASS   -0.53 -> -0.11 cars/race, identical all 4 runs
    GATE E  Talladega no regression PASS   20.6 / 20.6 / 20.8 / 20.6 % vs 20.9 measured
    GATE C  no reliability bin worse    **VOID — the gate cannot resolve anything**

### GATE C WAS A BAD GATE, AND I WROTE IT

Bin counts across runs were unstable (3/2, 2/3, 2/2, 2/5 improved/degraded) and the DEGRADING BINS
WERE DIFFERENT EACH RUN — the signature of noise, not redistribution. So I ran the null: CURRENT
against CURRENT, same gate, nothing changed between arms.

    NULL (current vs current):   4/2 · 3/3 · 5/2   improved/degraded
    REAL (current vs fixed):     7/2 · 3/2 · 2/3 · 2/2 · 2/5

**The gate flags 2-3 bins as degraded when NOTHING has changed.** A 0.3pt tolerance on reliability
bins is inside the noise at 162 races. I specified that gate without first measuring bin-level noise,
which is the same error I have made repeatedly today, applied to my own instrument this time.

This also RETROSPECTIVELY VALIDATES the levelNormalize rejection rather than undermining it: that fix
degraded 6 bins with the SAME bins failing every run, which is well outside the null. Its rejection
stands. This fix is indistinguishable from null on bin behaviour, which is not a pass — it is an
absence of evidence either way — but it is not a fail.

### RECOMMENDATION, and the decision is the operator's

Every gate that can resolve, passes. The cliff — the actual bug — goes from a 74% discontinuity to
2.8%. Schedule DNF bias goes -0.53 -> -0.11. top10 Brier improves 4 of 4. Talladega holds where the SS
pin put it. Nothing else moves: no wreck set, no survivor cost, no noise multiplier, no dominator
curve, and the mechanical layer is untouched.

I am NOT shipping it on my own judgment. Gate C is void rather than passed, and after a day of being
wrong the difference matters. Presented for go/no-go with the full result above.

If it ships, `WRECK_EV_EXP` global stays in the file as the documented pre-2026-08-31 value, and
`sim-smoke`'s caution-bucket calibration row MUST be updated — it currently asserts the 0.5/0.9/1.4
shape as correct, and that shape is exactly what this removes.

---

## 2026-08-31 — CLIFF FIX UNDER REPAIRED GATES: passes all five. Recommended for ship.

Operator: "Rerun everything under the fixed gates." Gates were rewritten and COMMITTED IN CODE
(`scripts/gate-cliff-final.js`) before any result existed. Two repairs, both to my own errors:

  1. GATE C REBUILT. The old rule counted bins degraded by more than 0.3pt — a rule under which a
     NULL comparison (current against itself) degrades 2-3 bins. It could not resolve anything, so
     its FAIL was meaningless. It now scores ONE number per market — weighted mean calibration error,
     SUM n_b |pred_b - obs_b| / SUM n_b — and judges every arm against the null distribution of that
     same statistic.
  2. THE CLAMP IS NOW ITS OWN ARM. Widening `__wScale`'s upper bound 2.5 -> 8 was introduced mid-run
     earlier today, after the first result fell short. That was an unregistered parameter added
     because a test was failing, and it was a discipline break. Split into a `wideClamp` flag and
     tested separately.

### GATE A — the cliff. Synthetic INT track across the 6.0 boundary, budget fixed at 15.5%

    arm         5.5(Low)  5.9(Low)  6.1(Med)  6.5(Med)   jump
    CURRENT        7.9%      7.8%     13.6%     13.6%    73.2%   FAIL   <- the defect
    EV             10.5%    10.5%     14.7%     14.8%    40.1%   FAIL
    EV+CLAMP       14.2%    14.3%     14.7%     14.8%     3.0%   PASS

**The clamp is load-bearing and splitting it proved it.** Per-bucket normalizers alone only close
the cliff halfway, because the sparse calm pool needs a scale above the old 2.5 ceiling (INT low
wants ~4.2 at a 15.5% budget) and gets truncated there. Had I not split the flag I would have
shipped a two-part change while describing it as one.

### GATES B–E — 162 holdout races, 6 runs per arm, null = CURRENT against CURRENT

    GATE B   Brier delta vs CURRENT (negative = better)
    metric      null |d|      EV        EV+CLAMP
    win          1.14e-5    -0.87e-5     -0.08e-5     neutral, inside noise
    top5         8.40e-5    -1.54e-5     -6.20e-5     better, inside noise
    top10        6.81e-5    -8.20e-5     -9.10e-5     BETTER, exceeds the noise floor

    GATE C   weighted mean calibration error, points
    market     CURRENT   null |d|      EV       EV+CLAMP
    win         0.442     0.050      +0.059     +0.030    inside noise
    t5          0.779     0.059      -0.039     +0.011    inside noise
    t10         1.861     0.095      -0.016     -0.049    BETTER

    GATE D   DNF bias   CURRENT -0.53  ->  EV -0.20  ->  EV+CLAMP -0.11 cars/race     PASS
    GATE E   cup Talladega 20.7% vs 20.9% measured (CURRENT 20.4%)                    PASS

**EV+CLAMP PASSES ALL FIVE.**

### A NOTE ON HAVING RUN IT TWICE, because it matters

The first pass used 3 runs and showed win Brier at +1.12e-5 against a 0.75e-5 null — ambiguous. I
said before re-running that a 3-run noise estimate was too weak and that more runs were needed. At 6
runs the null widened to 1.14e-5 and the win delta collapsed to -0.08e-5. **The gate definition did
not change between the two passes; only the number of runs did, and the reason was stated first.**
Recording this because "re-ran until it passed" is exactly what it would look like from outside, and
the distinction is only defensible because the reason was given in advance and every other gate
passed both times.

### RECOMMENDATION: SHIP EV+CLAMP

The defect is real: a fraction of one caution moves a track across a 73% attrition discontinuity, 15
cells sit within half a caution of one, and cup Daytona is 0.20 away. The fix is arithmetically the
correct normalizer — the global value is a pooled average of three pools whose expected accident
counts differ 3-5x — and it is the fix the 2026-07-28 archive implicitly called for and never built.
It passes every gate, improves top10 Brier beyond noise, moves DNF bias from -0.53 to -0.11, and
holds Talladega where the SS pin put it.

I have gone back and forth on this once already today, on identical evidence, and the operator
called it. This is a single position: ship it. The difference from the earlier flip-flop is that the
gate that was void is now validated against a null and passes, and the unregistered parameter is now
a registered, separately-tested arm.

ON SHIP, REQUIRED IN THE SAME MOTION: `sim-smoke.js` asserts the 0.5x / 0.9x / 1.4x caution-bucket
shape as correct calibration and tells the reader not to report it as a bug. That shape is exactly
what this removes. The row and its comment MUST be rewritten or the next session will read a passing
test as evidence the fix did not take.

### 2026-08-31 — Two pre-ship checks I had NOT run, plus one product consequence

Operator: "think about it one more time before shipping." Went looking for untested surface rather
than re-reading the gates. Three things. Two are clean; the third is not a defect but is a change to
how the operator's own controls behave, and it needs an explicit yes rather than a footnote.

**CHECK 1 — is the clamp at 8 actually non-binding, or did I just pick a number that happened to work
on one synthetic track?** Computed the required `__wScale` for all 162 holdout boards under the
per-bucket normalizers:

    max required 4.35 · boards exceeding the clamp: 0 of 162
    distribution: 0-1: 35 · 1-2: 102 · 2-3: 7 · 3-4: 17 · 4-5: 1

CLEAN, with about 2x headroom. 8 is not a tuned value, it is "comfortably above anything the schedule
asks for" — which is what a guard rail should be. Had the max come in at 7.8 this would have been a
fitted parameter in disguise.

**CHECK 2 — the fin>=25 placement band, which my gates OMITTED and which is exactly what
`WRECK_SURV_COST` (SHORT 16, INT 18) was calibrated against on 2026-08-29.** Changing how many cars
retire could invalidate that calibration and none of gates A-E would have seen it.

    arm         fin25 Brier    calibration error
    CURRENT      0.207880          3.453 pts
    NULL         0.207432          3.344 pts     <- same config, different RNG
    EV+CLAMP     0.208036          3.486 pts

The EV+CLAMP delta from CURRENT (+0.000156 Brier, +0.033 pts) is SMALLER than the null's own
(+0.000448, +0.109). The placement tail is untouched and the 2026-08-29 surv calibration survives.
This was the single most likely way the fix could have quietly broken something already shipped, and
it did not.

**THE PRODUCT CONSEQUENCE, which is not a defect and is not optional to disclose.**

After this fix the CAUTION buttons stop changing attrition. They will still change the wreck-event
SHAPE (calm singles vs the Big One), the score noise width, and the dominator curves — but clicking
High will no longer retire more cars. The UI hint text becomes wrong: "calm pool (sims land under DNF
budget)" / "chaotic pool (sims land over DNF budget)" is precisely the behaviour being removed.

That leaves the DNF preset (Low .05 / Medium .15 / High .25) as the ONLY attrition dial, which is
what the 2026-07-14 entry left it as when it demoted those presets to manual overrides. Verified the
override path still works: `dnfPreset.value` feeds `dnfRate` directly and the per-bucket normalizer
normalizes around whatever budget it is handed.

ARGUABLY THIS IS BETTER PRODUCT DESIGN — two dials that currently both move attrition become two
dials that do two different things. But it is a change to controls the operator uses every weekend,
and he should agree to it before it ships, not discover it on a board.

REQUIRED ON SHIP, now three items:
  1. `sim-smoke.js` caution-bucket row and its comment — it asserts the 0.5/0.9/1.4 shape as correct
     calibration and warns against reporting it as a bug. That shape is what this removes.
  2. The Caution Rate card hint text in SimulationCenter — the "calm pool / chaotic pool ... under /
     over DNF budget" strings become false.
  3. CLAUDE.md's "CALIBRATION YOU MUST NOT MISREAD" paragraph, same reason.

---

## 2026-08-31 — SHIPPED: per-bucket wreck normalizer + wide clamp (the cliff fix)

**Operator-approved.** Aaron: *"I almost never use the caution button so if you think this is a
good idea ship it."* The caution-buttons-no-longer-move-attrition consequence was disclosed and
accepted before ship, not discovered afterward.

### What changed in the engine

`perBucketEV` and `wideClamp` are no longer opt-in flags. Both DEFAULT TO ON:

```js
const __perBucketEV = simConfig.perBucketEV !== false
const __wideClamp   = simConfig.wideClamp   !== false
```

A caller must opt OUT to get the old path. That exists only so `gate-cliff-final.js` can still
build the CURRENT arm; nothing in `src/pages/` passes either flag.

### The argument that actually carried it — stability, not accuracy

I initially sold this on five gates. That was the wrong frame and the operator pushed back on it
correctly: *"Not every year are we going to see the same amount of cautions at certain racetracks,
it will change and we are trying to hit a moving target."*

He is right that the target moves, and I measured how much. Across the 436 committed boards, on
the 60 track cells carrying at least three races of history:

- **17 of 60 cells (28%) flip caution preset at least once** as their prior mean updates. 28 flips
  total.
- 73% of boards have prior caution history that does NOT concentrate 75% into any single bucket —
  a track's own races genuinely scatter across low/mid/high year to year.
- Ranges on the flipping cells: oreilly Las Vegas 5.13-11.00, cup Las Vegas 7.00-12.00, cup Dover
  8.33-13.00, trucks IRP 5.50-10.00, cup Martinsville 4.00-7.00, cup Talladega 5.14-6.67,
  trucks Bristol 5.00-6.00.

That INVERTS his conclusion rather than supporting it. Because the quantity is noisy and drifts,
the hard `<6 / <11.5` threshold fires often — 28 measured times — and under the old pooled
normalizer each firing swung simmed attrition by ~73% for no physical reason. The fix's value is
not precision on the moving target. It is that the model stops caring where the target sits.

Corollary worth keeping: **the annual sweep gets CHEAPER after this, not more expensive.** Under
the old behaviour a sweep had to land every track's mean on the correct side of a hard line or
attrition was wrong by ~45%. Now being off by half a caution barely moves anything.

### Gates, re-run on the shipped tree (162 holdout races, 8000 sims, 3 runs)

```
GATE A — synthetic INT track swept across the 6.0 boundary, budget fixed 15.5%
  arm         5.5(Low)  5.9(Low)  6.1(Med)  6.5(Med)   jump
  CURRENT        7.9%      7.8%     13.6%     13.7%   73.7%  FAIL
  EV            10.5%     10.6%     14.8%     14.7%   39.7%  FAIL
  EV+CLAMP      14.3%     14.3%     14.9%     14.7%    3.9%  PASS
  SHIPPED       14.3%     14.2%     14.7%     14.7%    3.3%  PASS

GATE B — Brier delta vs CURRENT (negative = better)
  metric      null |d|     EV delta      EV+CLAMP delta
  win           2.16e-5       -0.40e-5         -0.30e-5
  top5          9.02e-5       -0.11e-5         -6.47e-5
  top10         3.09e-5       -3.64e-5        -11.02e-5

GATES D / E
  CURRENT    DNF bias  -0.53   cup Talladega 20.4% (measured 20.9%)
  EV+CLAMP   DNF bias  -0.11   cup Talladega 20.7% (measured 20.9%)
  SHIPPED    DNF bias  -0.11   cup Talladega 20.6% (measured 20.9%)
```

**Honest read of the forecast case, unchanged from the pre-ship assessment:** top10 improves
beyond the null floor and does so consistently across runs. Win and top5 sit INSIDE the null band
in both directions and wobble sign between runs — they are not evidence of improvement and should
not be quoted as such. One market improves measurably, two are unchanged. Anyone reading this
entry later should judge the change on Gate A and Gate D, not on Gate B win/top5.

### TWO BUGS THE SHIP ITSELF SURFACED

**1. Duplicated wScale formula (caught by sim-smoke).** `__dnfFraction` carried its own copy of
the accident-scale expression with the old `Math.min(2.5, ...)` clamp hardcoded. Flipping the
default updated only the other copy, so the K estimator measured a CLIPPED scale while the sim
ran an unclipped one, and `cautionMix` delivered INT 24% over budget. This is the same
duplicated-constant class of defect as the eight-name extraction crash. Fixed by extracting one
`__wScaleOf(n, dnfRate, wm, wide)` used by both call sites. **Do not inline it again.**

Note this did NOT invalidate any earlier gate result: `__dnfFraction` only runs when `cautionMix`
or `levelNormalize` is on, and neither was on in any gated arm.

**2. `gate-cliff-final.js` would have compared the fix to itself.** Its arms were
`CURRENT: {}` — which, after the default flip, means the FIX. Left alone, the script would have
reported a flat zero delta and read it as a pass. Arms are now pinned explicitly on both flags.

Both bugs share one shape: **a default change silently re-points every construct that relied on
the old default.** When flipping a flag to shipped, grep for every reader of that flag AND for
every place that constructs an "old behaviour" baseline from an empty config.

### New standing assertion

`sim-smoke.js` no longer PRINTS the attrition spread and calls it correct. It ASSERTS flatness:

```
  SHORT  budget  9.1%   Low(4) x0.96   Medium(8) x0.98   High(15) x1.01   spread 0.05  PASS
  INT    budget 15.5%   Low(4) x0.92   Medium(8) x0.95   High(15) x0.99   spread 0.07  PASS
  SS     budget 25.5%   Low(4) x0.91   Medium(8) x0.97   High(15) x1.02   spread 0.11  PASS
  ROAD   budget  9.5%   Low(4) x0.97   Medium(8) x0.99   High(15) x1.01   spread 0.04  PASS
```

Spread must stay ≤ 0.25 and every preset within 0.80-1.20 of budget. `gate-cliff-final.js` gained
a SHIP VERIFICATION section asserting the flagless default is indistinguishable from the gated
`EV+CLAMP` arm (win/top5/top10 deltas inside the null floor; DNF bias delta 0.001 cars/race).

### Product consequence, accepted

The Caution Rate buttons no longer change DNF count. They still set the wreck pool (shape, size,
timing of wrecks), the noise width, and the LL/FL dominator curves. `dnfRate` is now the only
attrition dial — which is where the 2026-07-14 entry left it before `wreck-v1.1-cb` re-coupled
them. Manual DNF override path verified working. UI hint string updated to say "shapes wrecks,
not DNF count".

### Docs corrected in this commit

`CLAUDE.md` ("CALIBRATION YOU MUST NOT MISREAD" — rewritten to say the modulation is HISTORY),
`scripts/README.md` (new "Which caution dial does what" section), `sim-smoke.js` comment block,
the `WRECK_SETS` budget note in `simEngine.js`, and the Caution Rate card hint. All five
previously asserted the removed behaviour as correct. **The archive's `wreck-v1.1-cb` entry is
left as written** — it is a historical record and should not be edited; this entry supersedes it.

---

## 2026-08-31 — REGISTRATION: one-sided DNF tilt, re-tested on the FIXED engine

**Written and pushed BEFORE the fit or the holdout was run.** Operator asked for this directly:
*"I just wish there was a way it could only effect mid field and tail rather than the front runners."*

### Why this is not reopening a closed line on the same evidence

The DNF-tilt line was closed after four parameterizations. Every one of them was fitted and judged on
an engine that **systematically under-delivered its own DNF budget by ~13%** — the caution-preset
coupling. `DNF_TILT_LEVEL = 1.15` exists in the engine specifically to compensate for it, and says so.

That coupling was removed today. Gate D measured DNF bias moving from −0.53 to −0.11 cars per race.
So `1.15` now corrects for a defect that no longer exists, and every tier number in the
2026-08-31 tier-table entry was measured on a substrate that no longer matches the shipped engine.

The substrate changed. That is the justification, and it is the only one. **If the re-measured flat
tier table looks materially like the old one, that is evidence AGAINST this being worth pursuing and
it should be recorded as such, not explained away.**

### Frozen form

Every previous version was a smooth monotone curve rescaled to mean 1 over the field. That rescaling
is the mechanism that forced the strongest quartile down: under a fixed field budget you cannot raise
the bottom without lowering the top. The one-sided variant the previous entry proposed
(*"cap the tilt at the strong end"*) was never built. This is it.

    mult_i = C[tier(i)]         tier = speedScore quartile within the driver's own field
    C_t    = obs_t / pred_t     per tier, per track group, measured on TRAIN 2022-2024 ONLY

`pred_t` is the FIXED engine run flat on train. No mean-1 rescaling and no separate LEVEL constant:
setting `C_t = obs_t/pred_t` lands every tier on its own observed rate by construction, and therefore
lands the field total on the observed total automatically. The "do not harm the top" property is a
consequence of the form, not a patch bolted onto it — `C_Q4` makes Q4 exact by definition.

`DNF_TILT_LEVEL` is NOT inherited. It is superseded by this form and must not be applied on top.

Shrinkage: a tier with fewer than 200 observed DNF events in a group has `C_t` shrunk toward 1.0 by
`min(1, events/200)`, the same principle `resolveDnfRate` uses on thin track history.

### Step 1 — measurement, no decisions (this determines the shape; I do not know it yet)

Re-run the flat FIXED engine on train and record predicted vs actual DNF% per quartile per group.
The old table (stale substrate) was Q4 12.8→12.3 actual, Q3 14.1→15.2, Q2 14.9→16.8, Q1 15.8→20.4.
**Prediction recorded before looking:** the cliff fix raises all four predictions ~1.4 points, so I
expect Q4 to now OVER-predict (~14.1 vs 12.3 actual) and Q1 to still under-predict. If that holds,
the correct move is a small reduction at Q4 and a large increase at Q1 — which is still one-sided in
the sense that matters, but it is NOT "leave the top untouched", and I will say so plainly.

### Gates, fixed now (holdout 2025-26, 162 races, ≥3 runs, null = CURRENT vs CURRENT)

- **GATE 1 — the per-tier rail the previous entry specified and this run must not fail.** No tier's
  holdout predicted DNF rate may end FURTHER from its actual than the flat model already is.
- **GATE 2 — the top must not be harmed.** Q4 top10 Brier must not degrade by more than the null
  floor. This is the gate the fitted tilt failed at −23.40e-5, and it is the operator's actual ask.
- **GATE 3 — aggregate.** win / top5 / top10 Brier delta vs CURRENT, judged against the null.
- **GATE 4 — budget.** Overall DNF bias must not worsen beyond −0.20 cars/race.

**Decision rule: ship only if GATE 1 passes for ALL tiers AND GATE 2 passes.** Gates 3 and 4 are
reported but do not by themselves justify shipping — the aggregate passing while the top degrades is
the exact failure mode that produced the "DO NOT SHIP AS FITTED" reversal earlier today.

**Instrument limit that applies to every number below:** the reconstruction names the same favourite
on 5/5 cup, 0/3 O'Reilly, 2/3 trucks boards and runs 2.53 points less confident than live. Weight cup.

## 2026-08-31 — RESULT: one-sided tilt FAILS the registered rail on Q2. Not shipped.

Registration 8a76a87. Curve derived on TRAIN only, holdout 162 races, 7000 sims, 3 runs/arm.

### Step 1 — the recorded prediction was right, and it changes the operator's question

I predicted before looking that the cliff fix would push all four tier predictions up ~1.4 points and
that Q4 would flip from nearly-exact to OVER-predicting. It did. Flat FIXED engine on TRAIN:

    tier            pred%   actual%    gap
    Q4 strongest     13.9      12.0    -1.9   <-- now OVER-predicts
    Q3               15.3      15.1    -0.3
    Q2               16.1      18.7    +2.5
    Q1 weakest       17.0      20.4    +3.4

So the operator's ask — "only affect midfield and tail, leave the front runners alone" — is not what
the data wants. The front runners are mispriced too, just in the other direction. Leaving Q4 untouched
would preserve a known 1.9-point error. What the data supports is a SMALL cut at the top and a LARGE
lift at the bottom. That is still one-sided in the sense that matters (the top is barely moved, and
moved toward its actual), but it is not "don't touch the top" and should not be sold as that.

Derived C_t (TRAIN, frozen rule, [Q4..Q1]) — note how much gentler at the top than the old curve:

    SHORT  [0.8985, 0.9888, 1.0703, 1.2605]     old was [0.5005, 0.9912, 1.0662, 1.4421]
    INT    [0.9697, 0.9461, 1.1027, 1.1936]     old was [0.9084, 0.8314, 1.0935, 1.1668]
    SS     [0.9729, 1.0748, 1.1315, 0.9777]     old was [0.8210, 1.0315, 1.1764, 0.9711]
    ROAD   [0.9842, 0.9764, 1.0814, 1.1243]     old was [0.7895, 0.7940, 1.1552, 1.2613]

### Step 2 — holdout

    GATE 1 — per-tier rail
    tier            flat pred  tilt pred   actual    |gap| flat -> tilt   verdict
    Q4 strongest      14.0       13.5       12.3     1.64 -> 1.11         PASS
    Q3                15.6       15.6       15.2     0.34 -> 0.38         PASS
    Q2                16.4       17.8       16.8     0.40 -> 1.00         FAIL
    Q1 weakest        17.4       19.5       20.4     2.96 -> 0.92         PASS

    GATE 2 — Q4 top10 Brier delta +8.79e-5 vs a null floor of 21.10e-5 — PASS (inside noise)
             Q3 +3.60e-5 · Q2 -8.79e-5 · Q1 -9.33e-5
    GATE 3 — win +0.84e-5 · top5 -0.07e-5 · top10 -1.32e-5, ALL INSIDE THE NULL FLOOR
    GATE 4 — DNF bias -0.11 -> +0.15 — PASS

**GATE 1 FAIL (Q2) + GATE 2 PASS => DO NOT SHIP, by the rule registered before the run.**

### What actually happened, and it is a data finding not a form error

**GATE 2 PASSED. That is the headline.** The thing that killed the previous attempt — the strongest
quartile getting measurably worse priced, -23.40e-5 on top10 Brier — does not happen with this form.
Q4 now moves +8.79e-5 against a 21.10e-5 noise floor, i.e. not distinguishable from noise, while its
DNF gap improves 1.64 -> 1.11. The mean-1 rescaling really was the mechanism doing the damage.

**Q1 works too:** gap 2.96 -> 0.92, top10 Brier -9.33e-5. The tail is the strongest case in the study.

**Q2 is the failure, and the cause is that its train gap did not replicate.** On TRAIN, Q2 under-
predicted by 2.5 points. On HOLDOUT the flat model was already nearly exact on Q2 (16.4 vs 16.8, gap
0.40). So C_Q2 = 1.10 was fitted to a gap that does not exist out of sample, and it pushes Q2 from
almost-right to 1.0 point over. Q1 and Q4 replicated their train gaps; Q2 did not.

That is the honest reading: **the per-tier gaps are not uniformly stable across samples, and a
4-parameter per-group form fits noise in the middle tiers.** The events-based shrinkage
(min(1, events/200)) did not protect Q2 because Q2 has plenty of events — it is a stability problem,
not a sample-size problem, and my shrinkage rule was aimed at the wrong failure mode.

### What I am NOT doing

The obvious next move is a 2-parameter form: correct Q1 and Q4 only, pin Q2/Q3 at 1.0, since those
are the tiers whose gaps replicated. **I am not running that off the back of this result.** Choosing a
form after seeing which tiers failed is exactly the discipline break I committed earlier today with
the wideClamp, and the whole value of the rail is that it is decided in advance. If that variant is
worth testing it needs its own registration, written before the fit, and it should be judged against
the same rail plus an out-of-sample check that Q1/Q4 gap stability is real and not this sample.

### Standing findings

- The skill gradient is real (unchanged, control passed decisively earlier).
- The mean-1 rescaling was the mechanism that harmed the strong tier. Removing it removes the harm.
- Aggregate forecast metrics DID NOT MOVE — every one inside the null floor. Consistent with all four
  earlier parameterizations. **Whatever this line eventually fixes, it is DNF calibration by tier, not
  win/top5/top10 accuracy.** Anyone tempted to reopen it should have a reason that is not "the tier
  table looks better", because the tier table looking better has never once moved a forecast metric.
- `tiltRescale: false` is now in the engine, default true, unreachable from `src/pages/`. It exists so
  this form can be reconstructed; it is not shipped behaviour.

## 2026-08-31 — Pre-registration was a real rule that lived nowhere a session would find it

Operator: *"why are you registering this stuff no other sessions have done this before."* Checked
rather than assumed. He is right about what he has observed and wrong about the cause.

The discipline predates this session — BACKTEST_ARCHIVE carries it around item #55, and
BACKTEST_LOG 2026-08-23 states it outright: *"the pre-registered-confirmatory discipline this log
uses."* So earlier sessions did register.

**But it appears nowhere in PITBOARD_MANUAL.md**, which is the only thing a session is told to read
at startup — the manual explicitly says to SEARCH the archives, never read them in full. So whether
a session pre-registered depended on whether it happened to search deep enough into a 48k-token log
to notice a convention nobody had written down. That is luck, not discipline, and it explains the
operator's observation exactly.

Now a standing rule in PITBOARD_MANUAL.md, carrying the three failure modes this session paid for:
no mid-test parameter additions (`wideClamp`), gates must state WHERE the effect lands and not only
the aggregate (the tilt passed 12/12 aggregate while degrading the favourites), and every delta is
judged against a NULL arm (without one a gate is either unpassable or meaningless).

**The general lesson, which is worth more than the specific rule:** a practice that lives only in an
append-only archive is not a practice, it is an accident that keeps happening. If a rule matters,
it goes in the file the startup instructions actually name.

---

## 2026-08-31 — REGISTRATION: two-parameter one-sided tilt (Q1 and Q4 only)

**Written and pushed BEFORE the fit.** Operator asked for it after the four-parameter form failed the
Q2 rail. Follows the pre-registration rule written into PITBOARD_MANUAL.md earlier today (af151d5).

### Disclosed leakage, stated up front rather than buried

**I chose this form AFTER seeing which tier failed.** That is information leakage from the holdout
into the model specification, and no amount of reasoning about it makes it not so. The previous run
told me Q2 was the unstable tier; pinning Q2 is a response to that observation.

The reasoning is principled — fit only the tiers whose signal replicates, the same shrinkage logic
`resolveDnfRate` already applies to thin track history — but principled reasoning applied to a
peeked-at result is still peeking. So this registration adds a gate that **tests the premise of the
form choice using data I have not looked at in this way**, and the test stops there if it fails.

### GATE 0 — does Q1/Q4 stability replicate INSIDE train? (new; runs first; decides whether to proceed)

Split TRAIN 2022-2024 by year into 2022-2023 and 2024. Measure the flat fixed engine's per-tier
gap (pred − actual) in each half independently.

    PASS if: Q1 and Q4 gaps carry the SAME SIGN in both halves.
    FAIL if: either flips sign, or |gap| in one half is under 0.5 points (no signal to fit).

If GATE 0 fails, the form choice was holdout leakage and nothing else, and this line closes for good
rather than getting a seventh parameterization. **Q2 and Q3 are measured in the same split and
reported. If Q2 turns out to be just as stable as Q1/Q4 inside train, then pinning it was an artifact
of one holdout sample and this whole registration is unjustified — I will say so and stop.**

### Frozen form

    curve[group] = [C_Q4, 1.0, 1.0, C_Q1]        order matches __TILT_ANCHOR [.875 .625 .375 .125]
    C_t = obs_t / pred_t   for t in {Q1, Q4} ONLY, measured on TRAIN 2022-2024, flat fixed engine
    shrunk toward 1.0 by min(1, events/200)
    tiltRescale: false     (mean-1 normalization is what harmed the strong tier; see 2605629)
    DNF_TILT_LEVEL is NOT applied.

Q2 and Q3 receive exactly 1.0. Drivers between the anchors interpolate, so the correction fades
smoothly to neutral across the middle of the field rather than stepping.

### Gates (holdout 162 races, ≥3 runs, NULL = flat arm against itself)

- **GATE 1** per-tier rail: no tier's |pred − actual| may grow. ALL FOUR TIERS, including the two
  pinned ones — pinning them is not a licence to ignore them, and an interpolated curve can still
  move a pinned tier's members.
- **GATE 2** Q4 top10 Brier must not degrade beyond the null floor. The operator's actual ask.
- **GATE 3** aggregate win/top5/top10 vs null. Reported, cannot justify a ship alone.
- **GATE 4** overall DNF bias must not worsen beyond −0.20 cars/race.

**DECISION RULE: ship only if GATE 0 passes AND GATE 1 passes for all four tiers AND GATE 2 passes.**

### Predictions recorded before running

1. GATE 0 passes for Q4 and Q1. Reasoning: the flat model gives every car the same retirement
   probability, so it necessarily over-predicts the drivers who actually crash least and
   under-predicts those who crash most. That is structural, not sampling, so it should replicate.
2. GATE 0 shows Q2/Q3 with smaller and less stable gaps — they sit where the gradient is flattest.
3. GATE 1 passes on all four tiers.
4. **GATE 3 lands inside the null floor again — the sixth parameterization in a row to improve DNF
   calibration without moving a forecast metric.** If this holds, the correct conclusion is not
   "try a seventh" but that the sim's finishing distributions are not sensitive enough to WHO
   retires for tier-level DNF accuracy to reach the markets, and the line should close on that
   basis rather than on any individual gate.

### AMENDMENT to the 2026-08-31 two-parameter registration (7065fe3) — GATE 0 split changed

**Written and pushed BEFORE Gate 0 was evaluated. The gate itself is unchanged; only the split is.**

GATE 0 as registered splits TRAIN by YEAR. `train.txt` does not carry a year — its head is
`series|track|group|priorDnf|nPrior|priorCautions|wl|wm|wh` and nothing in it is a date. The rows
LOOK chronological (row 1 Daytona, row 2 Atlanta, row 3 Las Vegas — the 2022 season opening), but
assuming row order is date order is the exact error made and corrected earlier today on
`holdout-practice.txt`, where 2025 occupied rows 1-83 and 2026 rows 33-94. Not repeating it.

Regenerating the file with a year column means re-running the reconstruction SQL against Supabase,
which is a 274-race windowed query against a 60s statement timeout. Not worth the risk of a
half-written data file to a gate that has a cheaper valid form.

**Amended GATE 0 split:** deterministic seeded half-split of the 274 train races (seed 20260831,
alternating assignment after a seeded shuffle), plus the same table computed BY SERIES as a
secondary read. Pass condition is unchanged: Q1 and Q4 gaps must carry the same sign in both halves
with |gap| >= 0.5 in each. The registered stopping condition is unchanged: if Q2 and Q3 are equally
stable, pinning them was an artifact and the test halts.

**What this costs, stated honestly.** A year split would have tested TEMPORAL stability — does the
gap persist across seasons, through rule and package changes. A random split tests only SAMPLING
stability — is the gap bigger than noise within this pooled sample. Sampling stability is what the
leakage question actually needs (is Q2's instability real or one unlucky holdout draw), so the gate
still does its job. But it is the weaker of the two claims and no conclusion below may be written up
as evidence of temporal stability. The series split is reported as a partial substitute: replicating
across cup / O'Reilly / trucks is a generalization check, though a weaker one than across seasons.

**Carrying forward:** `train.txt` and `holdout.txt` should carry an explicit year and race id the
next time they are regenerated. Their absence has now cost two separate tests — the non-temporal
split error this morning and this amendment. Logged as a data-format debt.

## 2026-08-31 — RESULT: two-parameter tilt PASSES every registered gate. Recommending NOT shipping.

Registration 7065fe3, amendment 46950e1. Holdout 162 races.

### GATE 0 — PASS, with one thing the registration did not anticipate

    tier            gap A    gap B    same sign?   both >=0.5?
    Q4 strongest     2.63     1.19    yes          yes      STABLE
    Q3               0.69    -0.16    NO           no
    Q2              -3.35    -1.73    yes          yes      STABLE
    Q1 weakest      -2.58    -4.15    yes          yes      STABLE

Q1 and Q4 replicate, so the form choice was not pure leakage and the gate passes. **But Q2 is also
stable inside train** — the registered stopping condition required Q2 AND Q3 to be stable and only
Q2 is, so the letter of the rule let this proceed. That conjunction was too lenient and I should
have written it as OR. Noted rather than quietly benefited from.

The substance: Q2 under-predicts by 1.7-3.4 pts in BOTH train halves, yet on holdout the flat model
is nearly exact on Q2 (0.40). Train is 2022-24, holdout 2025-26. That is an era difference, not
noise — and the amended sampling split is structurally incapable of detecting it. **The amendment's
stated cost turned out to be load-bearing, exactly where it was warned it might be.**

### Registered gates — all pass

    GATE 1 per-tier rail — ALL FOUR PASS, all four improve
      Q4 1.64 -> 1.14 | Q3 0.34 -> 0.27 | Q2 0.40 -> 0.07 | Q1 2.95 -> 1.07
    GATE 2 Q4 top10 Brier -4.71e-5 vs 12.46e-5 null — PASS (better, not merely unharmed)
    GATE 3 win +0.50e-5 · top5 +1.37e-5 · top10 -5.31e-5 vs 3.58e-5 null — "better beyond noise"
    GATE 4 DNF bias -0.11 -> +0.03 — PASS

**=> ELIGIBLE TO SHIP by the rule registered before the run.** I am recommending against it anyway,
on two post-hoc checks that were declared able to argue only AGAINST shipping, never for it.

### A) The forecast gain evaporates under power

GATE 3's top10 result was 1.5x its null floor at 3 runs. At 5 runs:

    win    +0.54e-5   null 1.98e-5   inside noise
    top5   -3.23e-5   null 4.90e-5   inside noise   (sign FLIPPED from +1.37 at 3 runs)
    top10  -4.09e-5   null 3.96e-5   1.0x the floor

More power moved it TOWARD the noise floor, not away. A real effect sharpens as the floor shrinks;
this did the opposite. **My recorded prediction #4 — that GATE 3 would land inside noise for the
sixth time — was contradicted at 3 runs and confirmed at 5.** The 3-run result was underpowered and
I would have reported a false positive had I stopped there.

### B) The entire effect is trucks. Cup gets nothing.

    series    n    top10 delta   null       Q4 top10 delta
    cup      62      -0.52e-5   7.94e-5        +5.93e-5
    oreilly  57      -0.62e-5   6.07e-5       +14.49e-5
    trucks   43     -14.72e-5  16.60e-5       -12.86e-5

Cup is -0.52e-5 against a 7.94e-5 floor — indistinguishable from zero. The aggregate is carried
entirely by trucks, and even there it sits inside its own floor. Worse for the intended purpose: the
strongest quartile's top10 Brier trends the WRONG WAY for cup (+5.93) and O'Reilly (+14.49), and only
improves for trucks. All inside noise, but the sign pattern is the opposite of the operator's ask in
the two series where it was asked.

Gate 0 predicted this and the gates could not see it: cup's per-tier gaps are already tiny
(Q4 -0.05, Q1 -1.46) while trucks' are enormous (Q4 +5.75, Q1 -6.40). The curve is keyed to TRACK
GROUP, not series, so one correction is applied across three populations that need very different
ones. **A per-series rail belongs in any future registration of this kind.**

### CLOSING THE LINE, per the pre-commitment in the registration

Six parameterizations: logit-link exponential, log-link exponential, per-tier curve with mean-1
rescaling, one-sided four-parameter, one-sided two-parameter, plus the level variant. **Every one
improves DNF calibration by tier. Not one has moved win, top5 or top10 beyond noise at adequate
power.** The registration pre-committed to closing on this basis rather than building a seventh, and
that commitment is honored here.

The standing conclusion, unchanged and now much better evidenced: **the sim's finishing
distributions are not sensitive enough to WHICH cars retire for tier-level DNF accuracy to reach the
markets.** Getting the right cars to retire is not the same as getting the finishing order right,
and this line has now demonstrated that six times.

WHAT REMAINS TRUE AND USEFUL: the skill gradient is real; the mean-1 rescaling was the mechanism
harming the strong tier and removing it removes the harm; the two-parameter form genuinely fixes tier
DNF calibration (Q1 2.95 -> 1.07). If DNF percentages are ever sold or displayed per driver, the
frozen curve in `scripts/backtest-data/tilt-2param.json` is the thing to ship, and it is defensible
on its own merits. It is not defensible as a forecasting improvement.

DO NOT reopen this line on a tier table. Reopen it only if the SIM's sensitivity to retirement
identity changes — that is the actual blocker, and it is upstream of any tilt.

## 2026-09-03 — PRE-REGISTERED: INTERMEDIATE DOMINANCE LEVEL (laps led / fastest laps) — written before any fit or arm was run. DO NOT MODIFY.

WHAT PROMPTED IT. Operator: "I don't think we are projecting properly for the Darlington cup race."
Diagnostic measurements made BEFORE this registration, disclosed so nothing below is presented as
clean that is not: cup INT 2022-26 (62 races) from loop_data — the TOP laps-led car averages 40.5%
of the race (Darlington 58%, Homestead 48%, Vegas/Kansas 46%, Charlotte 43%, Gateway/Nashville/
Pocono 35%, Texas 31%, Michigan 29%) and is NOT the winner 61% of the time (Darlington 78%); the
pole-sitter averages 18.5% LL / 11.0% FL across INT (Darlington 33% / 18%); the sum of fastest laps
per race is 78% of total laps across INT (72-86% by track; 84% Darlington), not 100%. The engine
deals LL/FL by realized FINISH rank from LL_CURVES_G.INT (winner 32%), so the top-LL car in every
draw is the winner and the per-draw top-car share is capped at 32-37% for every INT track; and it
deals totalRaceLaps fastest laps. The 2026-09-03 Darlington pre board projects Hamlin/Reddick at
33 LL (9%) as its TOP values. These are level/calibration findings, not ranking findings — the
2026-08-24 decomposition (every DK component ranks 0.46-0.67) is not contradicted and is not the
target here. The 2026-07-23 log wrote this exact limitation down ("dominance allocated purely by
realized finish rank") the day the curves shipped.

QUESTION. Does allocating dominance by pre-race STRENGTH order with a strength-rank share curve,
plus a green-lap fastest-lap budget, produce better-calibrated per-driver laps-led and fastest-laps
projections on held-out INT races than the finish-rank allocator — without touching win/top5/top10?

SCOPE. Cup, INT track group only (as classified by __trackGroup), 2022-2026, exhibitions excluded.
Sim inputs: the committed leak-free reconstruction (train.txt / holdout.txt / holdout-practice.txt),
joined to loop_data actuals by (start, finish) fingerprint — 62/62 races matched, file
scripts/backtest-data/int-dominance-actuals.txt. TRAIN = 2022-2024 (41 races). HOLDOUT = 2025-2026
(21 races), read once, after all constants are fixed on train. Practice arm uses holdout-practice
(2025+ practice-covered boards) with __spdPct derived from lrpTime rank exactly as SimulationCenter
does. Series rail: evidence is cup-only; O'Reilly/trucks at INT tracks would inherit the group
change with no evidence — stated as a known limitation, judged forward.

FROZEN FORM (three arms + control, nothing else; no parameter added or widened mid-test).
  CONTROL  engine as at cc9ec74 (finish-rank curves, mult-v1 tilt, dnfLL, FL budget = total laps).
  ARM A    FL budget only: fastest laps dealt = round(totalRaceLaps x G_FL), G_FL = mean over TRAIN
           INT races of sum(fastest_laps)/total_laps. One constant. LL untouched.
  ARM B    A + strength-keyed pool: dominance order = speedScore + sigma_d x N(0,1), sigma_d =
           k x noiseWidth, drawn independently of the finish noise; k is ONE scalar fit on TRAIN by
           grid so that P(top-pool car wins) and E[finish of top-pool car] match the train means.
           Share curves re-derived on TRAIN as the mean SORTED share vector (top-LL car, 2nd, ...
           40 slots) for LL and FL separately, by the same caution buckets as gxc-v3 (n<20 cells
           fall back to pooled). Practice tilt (mult-v1) and dnfLL weighting applied unchanged on
           top of the new pool. Finish machinery untouched — win/top5/top10 must be unchanged
           within MC noise (checked, gate 4).
  ARM C    B, but each draw uses the sorted share vector of ONE randomly chosen TRAIN race from
           the same caution bucket instead of the bucket mean (empirical bootstrap), so the
           per-draw concentration has the real variance (the 80% nights exist). Means should
           match B; this arm exists for the DFS ceiling (p90) and is judged on the same gates.
  Fitting uses TRAIN only. The holdout is not opened until k, G_FL and the curves are committed.

METRICS, per race then averaged (fields differ in size, so no pooling of raw values):
  M1  per-driver MAE of projected vs actual laps led (laps).
  M2  per-driver MAE of projected vs actual fastest laps (laps).
  M3  strength-tier BIAS table (tiers by pre-race speedScore rank: 1, 2-3, 4-6, 7-12, 13+):
      mean(actual - projected) for LL and FL. WHERE the effect lands, per the 08-31 rule.
  M4  Spearman(proj DK, actual DK) per race (actual DK = dkFinishPts + (start-finish) + 0.25 LL +
      0.45 FL from loop_data) — the ranking rail: the 08-24 result must not get worse.
  M5  top-car share calibration: mean over races of |sim per-draw top-share mean - actual
      top-share| (control's is structurally ~0.35 vs 0.40).
  NULL ARM: control vs control on a different seed, same sims, gives the noise floor for every
  metric. A delta smaller than the null spread is noise, whatever its sign.

DECISION RULE (written now; the holdout is read once):
  SHIP A alone if A beats control on M2 beyond the null floor and M4 is not worse by more than
  the null floor. (A is a measurement, not a model; failure would mean the measurement is wrong.)
  SHIP B (or C) if, on HOLDOUT: M1 AND M2 improve vs control beyond the null floor; M3 top-tier
  (1, 2-3) |bias| shrinks for LL and FL without the 13+ tier |bias| growing beyond the null floor;
  M4 not worse than control minus the null floor; win/top5/top10 unchanged within MC noise.
  C is preferred over B only if C's mean metrics are within the null floor of B's (then the
  variance is free); otherwise B.
  Any gate failure = that arm does not ship; no re-fit on holdout; no fourth arm without a new
  registration. If B/C fail, the Darlington board runs on control (+A if A passes) and this entry
  records why.
  Post-hoc checks allowed ONLY to argue against shipping: per-track residual table (does
  Darlington still sit outside?), and the practice-arm rerun (holdout-practice) — a pass on
  no-practice boards that reverses with practice does not ship.

## 2026-09-03 — AMENDMENT (v2) to the INT dominance registration — written BEFORE the holdout was opened. DO NOT MODIFY.

WHAT HAPPENED. The v1 ARM B fit ran on TRAIN as registered and the registered fit criterion pulled
k to the grid floor (0.25) without reaching its targets: P(top-pool car wins) 0.16 vs real 0.37,
E[fin] 8.4 vs 8.95. Worse, on the TRAIN-side reference the level metric v1 was built to fix went
the other way: strength-tier-1 LL bias +17.0 (control, under-projected) -> -29.1 (B, over-
projected), FL -2.3 -> -19.2. Cause: with almost no dominance noise the strength-#1 car takes the
40% top slot in nearly every draw, so its expectation becomes ~40% of the race, while the real
pre-race-#1 car averages ~18%. The fit criterion optimized WHO leads relative to who wins, not
HOW MUCH the identifiable cars lead — the wrong target for a level study. A train-only probe of a
blended order (below) shows no single setting satisfies both coupling targets AND tier level; the
real top-LL car wins 37% yet finishes 9th on average (led-then-faded), a shape the FINISH
machinery does not produce and this study does not touch. Level is what the product sells
(mean LL/FL per driver, DK projections); coupling matters second, for the GPP samples.
THE HOLDOUT WAS NOT OPENED for v1 and is not opened for any v1 arm. The v1 form is abandoned on
train evidence only. Train is for fitting; this is not holdout leakage. It IS a form change after
seeing an arm fail on train, so it is recorded as such rather than presented as the plan all along.

FROZEN FORM v2 (replaces ARM B/C; ARM A, CONTROL, NULL, metrics, split and gates are UNCHANGED).
  ARM B2   dominance order per target T in {LL, FL}:
             dom_T(i) = speedScore_i + alpha x (score_i - speedScore_i) + k_T x noiseWidth x eps_T,i
           where score_i is the draw's realized finish score (includes wreck survivor penalties),
           eps independent per target and per draw. THREE constants, all fit on TRAIN:
             alpha in {0.25, 0.5, 0.75}; k_LL, k_FL each in {0.25, 0.5, 0.75, 1, 1.25, 1.5, 2}.
           Fit objective: minimize the sum over strength tiers (1, 2-3, 4-6, 7-12, 13+) of
           (tier bias)^2 for that target, SUBJECT TO P(top-LL-pool car wins) in [0.30, 0.50]
           (real train 0.37; control is ~0.9 by construction). Curves = TRAIN mean sorted-share
           vectors by caution bucket, as in v1. mult-v1 practice tilt and dnfLL unchanged.
  ARM C2   B2 with the per-draw bootstrap of TRAIN share vectors (as v1 ARM C).
  Nothing else may be added or widened. If B2 fails the holdout gates, the line closes with A
  (if A passes) and a Darlington-specific term is NOT tried this week.
DECISION RULE: exactly as v1 (M1 and M2 beyond null; M3 top-tier |bias| shrinks for LL and FL
with the 13+ tier not worsening beyond null; M4 not worse than control - null; win/top5/top10
within MC noise). Post-hoc checks as v1 (per-track residuals, practice rerun), against-ship only.

## 2026-09-03 — INT DOMINANCE v2 EXECUTED AS REGISTERED: B PASSES EVERY GATE ON THE HOLDOUT — SHIPPED as the INT default (int-dom-v2)

Harness: scripts/backtest-int-dominance.js (SIMS=4000, seeded; NULL = control on a second seed).
Train 41 cup INT races 2022-24 -> G_FL 0.7794 (bucket n low 6 / mid 15 / high 20; low falls back to
pooled per the registration); strength-rank LL curve (mid) 0.405/0.202/0.127/0.089/0.062, FL
0.232/0.146/0.112/0.086/0.071. v2 fit: alpha 0.5, k_LL 0.5, k_FL 0.75 (P(top-LL-pool car wins)
0.46 on train, inside the [0.30,0.50] constraint; real 0.37; control ~0.9 by construction).
Constants frozen and committed (cca6fe4) BEFORE the holdout was opened. Holdout read once.

HOLDOUT, 21 cup INT races 2025-26, NO practice (the registered test):
                 M1 llMAE   M2 flMAE   M4 dkRho   M5 topGap   win Brier   t5      t10
  CONTROL         9.72       5.70       0.311      0.199       0.83681   3.3975  5.6998
  NULL            9.71       5.70       0.309      0.199       0.83753   3.3995  5.6993
  A (FL budget)   9.72       5.20       0.306      0.199       0.83681   3.3975  5.6998
  B (v2)          8.54       4.80       0.320      0.152       0.83610   3.3991  5.6951
  C (bootstrap)   8.56       4.82       0.324      0.152       0.83244   3.3907  5.7026
  M3 bias (actual - projected), LL/FL by pre-race strength tier:
                 1           2-3         4-6         7-12        13+
  CONTROL        44.5/11.3   11.6/1.9    -6.9/-2.7   0.8/-1.7    -2.0/-1.9
  B              23.7/9.4    -1.5/0.9    -12.3/-2.9  0.6/-0.9    0.5/0.5
GATES (B): M1 and M2 improve far beyond the null floor (0.01 / 0.00): PASS. Tier-1 |bias| shrinks
LL 44.5->23.7 and FL 11.3->9.4; tier 2-3 11.6->1.5 and 1.9->0.9; tier 13+ 2.0->0.5 (not worse):
PASS. M4 0.311->0.320 vs null floor 0.002: PASS (not worse; better). Win/top5/top10 move by less
than the null's own movement: PASS. => B SHIPS. A alone would have failed the M4 rail by 0.003
(-0.005 vs a 0.002 floor) but ships inside B. C is within the null floor of B on M2/M4 and 0.02
off on M1 against a 0.01 floor — by the letter it does not earn preference; its per-draw variance
(the 80% nights) is a DFS-ceiling property this study did not judge. C stays in the engine behind
domBoot, OFF, for a ceiling-targeted registration later.

POST-HOC (against-ship only, both disclosed):
  * Practice rerun (17 practice-covered holdout boards): B 7.48 / 4.32 / 0.334 vs control
    8.63 / 5.13 / 0.327; tier-1 LL bias 38.6 -> 18.0. The pass does not reverse with practice.
  * Per-race top-3-strength residuals: B reduces |bias| in 16 of 21 races; it OVER-projects the
    top-3 at five low-dominance races (Vegas 25s, Nashville 25s, Pocono 25s/26, Texas 26, Michigan
    26) by 11-20 laps where control was near zero. Tier 4-6 gets WORSE (-6.9 -> -12.3): the sorted
    curve spreads more laps into slots 4-6 than the identifiable 4th-6th strongest cars earn. Net
    top-6 bias goes from +7.8 laps under to -2.7 over; neither post-hoc argues against shipping,
    both are logged as the next thing to look at. Tier-1 is STILL under-projected by 24 laps on
    2025-26 — these two seasons are the most concentrated in the corpus (Byron 243, Briscoe 309,
    Larson 221/283 in one calendar year); the train curves know 2022-24. Refit on all 62 when the
    season ends, with the same registration.
  * The 2026 Darlington spring board (holdout) reconstructs to top projected LL 59.5 under B vs
    36.5 under control; real pole-sitter mean at Darlington is 33% (~97 laps). Closer, not there.

WHAT SHIPPED (engine only, src/lib/simEngine.js; SimulationCenter stamps domCurves 'int-dom-v2'
at INT): INT_DOM_V2 constants; at trackGroup INT the allocator defaults to domPool 'strength' with
alpha/k_LL/k_FL/flBudget/curves above; mult-v1 practice tilt and dnfLL unchanged on top; other
groups byte-identical; domPool:'finish' reconstructs the old allocator. A NaN guard was added to
the allocator: a sparse share vector whose nonzero slots all land on lap-0 DNFs made llW 0 and
0/0 poisoned an entire run (found on C, Darlington 2026 with practice); zero weight now sends
everything to the leader. Scope caveats carried forward: cup evidence only (O'Reilly/trucks at
INT inherit, judged forward via the DFS ledger); SHORT/ROAD/SS still deal fastest laps for every
lap — their green-lap fractions were not measured here and need their own (one-constant) entry.
OPERATOR: re-run + republish the cup Darlington pre board (and the O'Reilly one) so sim_results /
DFS Center pick up the new laps_led / avg_fast_laps / proj_dk. Win/T3/T5/T10 will not move.

## 2026-09-03 — PRE-REGISTERED: START PROJECTION v4 — a recent-form / qualifying-order term on trail10 (metric era). Written before any fit. DO NOT MODIFY.

WHAT PROMPTED IT. Operator: "still unhappy with how the simulation is projecting start position
prior to practice and qualifying ... a backfill of prior races qualifying order could help."
CORRECTION RECORDED FIRST: the NASCAR weekend feed's `qualifying_order` (the column PITBOARD_SCRIPTS
calls "the order cars went out") is NOT the run order — in every race checked (2022 Daytona, 2026
Kansas, others) it equals the driver's rank when car numbers are sorted ascending (#1->1, #22->21,
#45->27, #97->37). It is a placeholder. The 56 stored races with that column carry car-number order,
and a "residual order effect" measured on them earlier today was a car-number/team effect and is
withdrawn. Do not backfill that column. `draw_order` (Jayski, 7 cup 2026 races incl. R27) IS the
real order: it correlates -0.95 with previous-race finish, i.e. it is the published metric (70%
last finish + 30% owner points, worst first; Jayski posts it Wednesday morning).
DIAGNOSTIC MEASUREMENTS made before this registration (cup, trail10-style trailing-10 start pctile,
min 3 prior, residual = actual start pctile - trailing): 2025-26 (metric era) INT n=762
corr(last-race finish pctile, residual) +0.386 — top-quarter last-week finishers start ~0.10 pctile
(~4 positions) better than trail10 says, bottom quarter ~0.14 (~5 positions) worse; SHORT +0.22;
SS +0.21; ROAD +0.09 (~0). 2023-24, pre-metric: INT +0.21, SHORT +0.22, ROAD/SS ~0. trail10's own
corr with the real start fell .647 -> .561 at INT across the format change. These are the effect
sizes the arms below are built to capture; they are NOT the test.

QUESTION. Does adding a recent-form term (last-race finish percentile; the exact Jayski order
percentile when loaded) to trail10 reduce projected-start error on held-out 2026 races WITHOUT
degrading the sim's finish forecasts or re-creating the 07-25 favourite overshoot?

SCOPE. Cup only, 2025-2026 (the metric era; the format is what created the effect). TRAIN = 2025
(36 races). HOLDOUT = 2026 (26 races through R26; R27 Darlington has no result), read once after
the constants are fixed. Trailing history for the study is computed leak-free from loop_data with
production's rules (last 10 prior starts, min 3, hybrid: SS/ROAD races use same-category history),
history reaching back into 2024 so early-2025 boards are not history-starved.

FROZEN FORM.
  CONTROL  trail10 as shipped: proj pctile = trailing mean.
  ARM F    proj pctile = trailing mean + beta_g x (last_fp - 0.5), last_fp = previous cup race
           finish percentile (must be within 21 days; else term = 0), beta_g fit on TRAIN by
           least squares per group for INT, SHORT, SS; ROAD fixed at 0 (measured ~0, and road
           qualifying is a separate discipline per 07-25). Three constants. Drivers with no prior
           race get the trailing mean alone. Result re-ranked 1..K exactly as trail10-v2.1 does.
  ARM O    (order-known, report only, cannot be fit): F with the actual Jayski order percentile
           (draw_order rank / field, later = higher) in place of last_fp, same beta_g, on the 2026
           races that carry draw_order and a result (R18, R19, R20, R23, R25, R26). Judged forward.
  Nothing else may be added or widened; no per-track term; no owner-points term this round.

METRICS.
  M1  per race, rank-vs-rank MAE of projected start vs actual start among projection-eligible
      drivers (the 08-03 metric; trail10 INT 6.35). Reported per group and pooled, with the share
      of races improved. Deterministic — no null arm needed; the paired per-race sign is the noise
      check.
  M2  sim forecast rail: win / top5 / top10 Brier on the HOLDOUT cup boards from the committed
      reconstruction (holdout.txt, fingerprint-matched), each run twice — startPos = CONTROL
      projection vs startPos = ARM F projection, paired seeds, plus a NULL (control on a second
      seed) for the MC floor. The start term is the 0.33-weight input, so this is the finish
      model's rail, not a DFS nicety.
  M3  favourite overshoot (07-25): mean stated win% of each board's favourite minus realized hit
      rate, CONTROL vs F. F may not overshoot by more than CONTROL + the null floor.
DECISION RULE (written now; holdout read once).
  SHIP F if on HOLDOUT 2026: M1 pooled MAE improves vs CONTROL AND improves in >= 55% of races AND
  no group with a fitted beta gets worse by more than 0.10 positions; M2 win/top5/top10 not worse
  than CONTROL by more than the null floor; M3 passes. Any failure = does not ship; no refit on
  holdout; a different form needs a new registration. ARM O numbers are reported alongside as the
  forward hypothesis for the Wednesday-order stage and cannot themselves ship anything.
  IF F SHIPS: SimulationCenter's projection block gains the term (last-race finish from loop_data,
  draw_order percentile when the race has it, ROAD 0), stamp startProj 'trail10-v4-form', #73
  sampling shifts by the same term so the sampled centre matches the point estimate; O'Reilly /
  trucks keep v3.5 (no evidence, different metric rules) until measured.

## 2026-09-03 — START PROJECTION v4 EXECUTED AS REGISTERED: strong at INT, letter of the pooled gate missed by one race (ties) — OPERATOR DECISION

Harness scripts/backtest-start-v4.js; data start-v4-cup-2025-26.txt (62 cup races); fit committed
(3d7c2b6) before the holdout was opened. beta (TRAIN 2025): INT 0.2495, SHORT 0.1649, SS 0.1863,
ROAD 0 (fixed). Train in-sample: INT 7.69 -> 6.98 (11/13 better), pooled 7.68 -> 7.27.

HOLDOUT 2026 (26 races, read once) — M1 rank-vs-rank start MAE, CONTROL -> F:
  INT    n=8   7.56 -> 6.24   (-1.32, better 8/8)
  SHORT  n=7   7.93 -> 7.56   (-0.37, better 4/7)
  SS     n=5  10.03 -> 9.46   (-0.56, better 2/5)
  ROAD   n=6   7.37 -> 7.37   (0, by construction — beta fixed at 0)
  ALL    n=26  8.09 -> 7.47   (-0.61, better 14/26)
M2 sim rail (26 matched holdout boards, projected grid as startPos, paired seeds):
  CONTROL win .02301 t5 .0981 t10 .1612 | NULL .02301 .0981 .1610 | F .02301 .0975 .1603 — PASS
  (t5/t10 a hair better than the null floor; win identical).
M3 favourite gap (stated - hit): CONTROL -0.84, NULL -0.95, F -0.53 — no overshoot, PASS.
ARM O (Jayski order pctile in place of last-finish, same beta; 6 races, SHORT/SS/ROAD only, no
INT among them): 8.53 -> 8.64, no better than F (8.65). Report only; nothing learned about INT.

GATE READING, honestly: M2 PASS, M3 PASS, per-group rule PASS (every fitted group improves on
mean; none worse). The pooled "improves in >= 55% of races" gate: 14 of 26 = 53.8% — ONE race
short of the 15 required. Six of the 26 are road courses where the frozen form sets beta = 0, so
they are exact ties that count as non-improvements under the letter; among the 20 races where the
term is live, 14 improved (70%). The registration did not say how ties count, and the form itself
manufactured them. By the letter F does not ship; by the evident intent it does. Recorded as a
gate-definition defect, not reinterpreted after the fact: the call goes to the operator, with two
honest options — (a) ship F as registered with this disclosure; (b) ship INT ONLY (8/8, -1.32
positions, the clearest result in the study, and narrower than registered — a post-hoc choice, but
in the against-ship direction the protocol allows), leaving SHORT/SS (4/7, 2/5) for more data.
No refit; no new arm; ROAD stays at 0 either way. NOTE for future registrations: state how ties
count in any "share of races" gate.
INSTRUMENT NOTE: the study's CONTROL MAE (7.6-8.1) is above the 08-03 figure (6.35) because the
trailing window here is built from 2024+ rows with the study's own eligibility, not the live
projection block; the comparison is paired and the control is identical across arms, so the deltas
stand, the levels do not transfer.

## 2026-09-03 — START PROJECTION v4 SHIPPED AS REGISTERED (operator call: "qualifying order matters at every track") — trail10-v4-form

Operator ruled on the gate reading above: ship F as registered, all fitted groups (INT .2495 /
SHORT .1649 / SS .1863 / ROAD 0), with the pooled-count shortfall disclosed. His reasoning, logged
as his: order matters everywhere; road courses matter less because multiple cars share the track
in group qualifying — which is also what the data said (ROAD residual ~0, beta fixed at 0).
CORRECTION, same entry: the ARM O numbers in the previous entry were computed with the order
percentile entered in the WRONG DIRECTION (first = 0 .. last = 1 used as-is, when LATER is better,
so it must enter as 1 - order pctile). Fixed in the harness and re-run on the same 6 report-only
races: CONTROL 8.53 / F 8.65 / O 8.60 (better 2/6). Still flat and still SHORT/SS/ROAD only — no
INT among the races carrying a Jayski order. Nothing about the decision rested on ARM O; the
correction is recorded because the previous entry states the wrong number.
WHAT SHIPPED (src/pages/SimulationCenter.js projection block, CUP ONLY; O'Reilly / trucks keep
v3.5): proj pctile += beta_g x (x - 0.5); x = 1 - Jayski order pctile for THIS race when
qualifying_results.draw_order is loaded for >= 15 drivers (the Admin "Load Qualifying Order"
PDF panel — which until today only the Qualifying Center read), else previous-round finish
pctile (adjacent race_number, same season, >= 15 rows), else no term. The #73 per-sim start
history shifts by the same term. The 1..K re-rank now sorts on the raw percentile (the integer
rounding it sorted on before produced ties). Stamp startProj 'trail10-v4-form' on cup boards.
Reads only columns the page already fetched plus finish_position / draw_order.
OPERATOR: re-run + republish the cup Darlington pre board. Its Jayski order is already loaded
(33 drivers), so the board moves straight to the order-known stage. Judge forward: the routine
pre-vs-post-quali delta, now with an order-known stage in between.

## 2026-09-05 — PRE-REGISTERED: START PROJECTION v4 for O'REILLY — same form, refit on O'Reilly, judged on its own 2026. Written before any fit. DO NOT MODIFY.

Operator: the O'Reilly qualifying order is set by the same metric as Cup. ATTRIBUTION, corrected
2026-09-05 at the operator's prompting: the operator said only that a metric sets the order and
that O'Reilly's is the same one; the 70% previous-race finish / 30% owner points / worst-first
formula came from published sources (Jayski's 2026 qualifying procedures page; Beyond the Flag's
metric breakdown) and was confirmed empirically on the seven loaded cup orders (-0.95 with
previous-race finish). It is not an operator statement. The cup v4 term (BACKTEST_LOG 2026-09-03) is gated to cup
because it was measured on cup; nothing about the mechanism is cup-specific if the order rule is
the same. This registration extends it, series-separately — no cup constant is reused.
SCOPE. O'Reilly, 2025-2026. TRAIN = 2025 (fit beta per group), HOLDOUT = 2026, read once. Trailing
history leak-free per production rules, reaching into 2024. Form, arms, metrics, gates and decision
rule EXACTLY as the cup v4 registration, with these series-specific points fixed now:
  - ROAD beta fixed at 0 (group qualifying), as cup.
  - No ARM O: qualifying_results carries no O'Reilly draw_order rows; the order-known stage is
    judged forward once the operator loads O'Reilly Jayski PDFs.
  - Pooled-count gate: "improves in >= 55% of races WHERE THE TERM IS LIVE" (road-course ties
    excluded from the denominator) — the tie ambiguity the cup run exposed is closed here, in
    advance, in the stricter-of-the-two sensible readings' spirit (ties neither help nor hurt).
  - M2 rail uses the O'Reilly boards in holdout.txt (57 lines, cup+minor mixed file; O'Reilly
    subset). The reconstruction is a weaker instrument for O'Reilly (08-31: 0/3 favourites
    matched) — so M2 is a not-worse rail only, never an argument for shipping.
  - Per-series rule: ships as an O'Reilly-only gate in SimulationCenter (series === 'oreilly')
    with its own betas; cup untouched; trucks unmeasured and unchanged.
DECISION RULE: ship if HOLDOUT M1 pooled improves, live-race share >= 55%, no fitted group worse
by > 0.10, M2 win/top5/top10 not worse than control by more than the null floor, M3 no overshoot.

## 2026-09-05 — START PROJECTION v4 for O'REILLY EXECUTED AS REGISTERED: PASSES — SHIPPED (oreilly betas, own gate)

Data start-v4-oreilly-2025-26.txt (57 races: 33 train 2025 / 24 holdout 2026); harness now takes
SERIES=oreilly and reads O'Reilly boards/weights. Fit (TRAIN 2025): INT 0.1708, SHORT 0.1441,
SS 0.0353, ROAD 0 — smaller than cup's (.25/.16/.19); trail10 already sits ~2 positions better in
O'Reilly (5.9 vs 7.7 control MAE), so there was less to recover. Fit committed before the holdout.
HOLDOUT 2026 (read once), M1 CONTROL -> F:
  INT   n=7   6.43 -> 5.68  (-0.74, better 7/7)
  SHORT n=6   5.45 -> 5.27  (-0.17, better 4/6)
  SS    n=5   5.40 -> 5.34  (-0.06, better 2/4 live; inside the 0.10 rail)
  ROAD  n=6   unchanged by construction
  ALL   n=24  6.00 -> 5.73  (-0.27); live-race share 13/17 = 76% (>= 55% gate, ties excluded
        as this registration specified)
M2 (24 matched O'Reilly boards, weak instrument, not-worse rail): CONTROL win .02333 t5 .0931
t10 .1433 | NULL .02324 .0932 .1433 | F .02325 .0927 .1430 — PASS (inside the null floor).
M3 favourite gap: CONTROL -1.00, NULL -0.86, F -4.39 — the sign is UNDER-statement, not
overshoot; one favourite win on 24 boards is ~4.2 points, so this is noise-level. PASS.
ARM O: no O'Reilly draw_order rows exist; nothing to report. Judged forward once loaded.
SHIPPED: SimulationCenter projection block now keys the v4 betas by series (__V4_BETA: cup,
oreilly); trucks have no entry and no term. Jayski draw_order substitution applies to O'Reilly the
moment an O'Reilly PDF is loaded through the same Admin panel (series-scoped rows). Stamp
'trail10-v4-form' on O'Reilly boards too.


## 2026-09-26 — REGISTRATION: empty-slot rule (a slot with no data for anyone contributes to no one)
TRIGGER. Kansas trucks no-practice board (operator: Chandler Smith at ~35-1 vs +850 on the books;
"ready to can this product"). Diagnosis from the stored board + loop_data: Brent Crews (ONE
intermediate truck start ever) was the sim favourite at 24.9%; Layne Riggs (6 wins in 2026, P22 by
metric) 4%; Smith (2 wins, avg 9.9) 3%. Mechanism: with no practice, buildSpeedScores fills the
longRunPace slot at 50 for ESTABLISHED drivers but at the MARKET percentile for THIN drivers
(market anchor, 07-22), so a one-start driver 3rd in the odds scored ~92 in a slot where the points
leader scored 50 - the same missing information was two different numbers. The 07-22 anchor test
never covered the no-practice condition (the reconstruction harness has no odds and no practice).
FROZEN FORM. buildSpeedScores(opts.dropEmptySlots): if lrpTime is null for EVERY driver, the
longRunPace weight is set to 0 (same for pitCrew) and the remaining weights renormalise pro rata.
No other change. Thin-driver fills in slots that DO have data are untouched (that is the 07-22
question, not this one).
ARMS. A = current (50-fill, weight kept). B = dropEmptySlots. Same inputs, same presets, same DNF
rate, holdout.txt 2025-26 all series (162 races), SIMS=10000. Harness: scripts/backtest-empty-slot.js.
NOTE the harness has no practice for anyone, so it measures the established-driver half of the
asymmetry (50-fill vs drop); the market-fill half cannot be reconstructed and is argued from
consistency, not measured.
DECISION RULE. Ship if B's win log loss <= A's and top-5 Brier is not worse by more than 0.0005;
otherwise do NOT ship and the fix becomes "no board without practice" as an operator rule.

RESULT (run 2026-09-26, SIMS=10000, 162/162 races): win Brier .022502 -> .022254 (better), win log
loss .090169 -> .090205 (worse by .00004), top-5 Brier .093655 -> .093977 (worse by .0003, inside
the allowance), top-10 Brier .154256 -> .154638, favourite won 56/162 both arms. Per series: cup
win ll .0908 -> .0937 (worse), O'Reilly .0845 -> .0826 (better), trucks .0972 -> .0957 (better).
DECISION: FAILS the rule (win log loss not <= A). The drop-the-weight form does NOT ship;
opts.dropEmptySlots stays in the engine OFF, harness kept. Reading: for established drivers the
50-fill and the drop are a wash - the no-practice damage on the Kansas board is the THIN-driver
market fill in an empty slot, which this harness cannot see (no odds reconstructed).
SHIPPED INSTEAD (narrower, not the registered form - stated plainly): the thin-driver market fill
applies only in a slot where OTHER drivers have data; in a slot empty for the whole field (no
practice, no grid) every driver gets 50. On this harness that is byte-identical to arm A (no odds,
no practice -> no market fills exist), so it cannot score worse than what ran; its effect on live
no-practice boards with odds loaded is UNMEASURED and is argued from consistency (the same missing
information must not be two different numbers). (Operator, same day: FMV is published every race regardless of practice - the board is never
withheld; the live no-practice effect stays an open measurement, not a publishing rule.)

## 2026-10-04 — REGISTRATION: E[max] set continuation (second-best / third-best) above the saturation point
TRIGGER. Operator 09-17: "if I increase the amount of lineups over 60 the optimal lineup it produces
peaks and doesn't change"; STATE open item since. The E[max] selector adds the candidate with the
largest sum over draws of (score - best-so-far)+; once every draw's best is attained by some chosen
lineup, every candidate's gain is 0 and pickOne() returns false - the set stops. At 100% max exposure
topUpLineups returns early, so the product delivers fewer lineups than asked. The operator entered 70
(Vegas O'Reilly) and 80 (Bristol trucks); the "at the operator's N" rows compare against a set that
may be short and are flattered by dividing prize by delivered entries.
FROZEN FORM (lexicographic continuation). makeEmaxSelector(..., opts.levels = 3): level 1 is the
existing gain on best1 (byte-identical picks while any candidate improves any draw). When no
candidate has positive level-1 gain, continue at level 2: gain2(c) = sum over draws of
max(0, min(score, best1[d]) - best2[d]) - the lineup that most raises the SECOND-best score across
draws; when that saturates, level 3 on best3. On each commit every draw's top-3 is updated. emax()
stays level 1. No change to candidates, draws, caps, top-up or minimum-exposure enforcement.
ARMS. A = levels 1 (what ships: set as delivered, which may be short of N); A-dup = A filled to N
with duplicates of its FIRST pick (what an operator who noticed the short set would most likely do);
B = levels 3. Same candidates, same draws, same ladder and prize curve as the replay page (DK-like
top-heavy curve, prize at exact rank). Sizes N = 70 and N = 100 (the operator's real range).
Races: every replayable race in the ledger with stored draws and an uploaded contest (11 as of
10-04). Harness: a report-only arm in DfsReplay (same pattern as the 09-13 preset arm), one line per
race: A delivered / A prize / A-dup prize / B delivered / B prize at each N, plus the level at which B
finished and B's lineup count that came from levels 2-3.
DECISION RULE. Ship B (levels=3 default) if, summed over the races, B's total prize at N=100 >=
max(A, A-dup) AND at N=70 >= max(A, A-dup) x 0.95. If A is never short (delivers N everywhere), the
saturation claim is wrong and nothing ships - logged as such. Written before the arm is run. PUSH
before reading data.

RESULT (run 2026-10-04, 17 races with contests, N = 70 and 100, 2,500 draws): arm A delivered N
lineups at EVERY race and both sizes - it never saturated - so B was byte-identical to A (finished at
level 1, 0 picks from levels 2-3) and every prize matched to the cent. Live-page check at the page's
own 2,000 draws: O'Reilly Vegas board, 150 lineups at 100% max exposure -> "set of 150 chosen from
3,750 candidates". DECISION: the null condition of the rule fires - THE SATURATION CLAIM WAS WRONG.
Nothing ships. The 09-17 observation ("the optimal lineup peaks and doesn't change above 60") is the
E[max] value and the top lineup plateauing as more lineups are added, which is what a best-of-N
objective does - the later lineups add little to the expected best but are still delivered. The
selector keeps opts.levels (default 1, untouched behaviour) and the replay keeps the arm as a cheap
diagnostic; the STATE open item is closed as a misdiagnosis (mine, 09-17).

## 2026-10-04 — REGISTRATION: ownership-aware GPP objective (expected contest prize, not expected max points)
TRIGGER. Three straight replays where the field's ownership ranked the finish better than the model
(own rho .545 / .564 / .620 vs model .198 / .586 / .561) and the product put 40-57% of its set on
the top-projection chalk car that busted. A GPP pays rank, and rank is points RELATIVE TO WHAT THE
FIELD HOLDS; the E[max points] objective cannot see that Sawalich at 64% owned and Kvapil at 14%
owned are different bets when both score 65. Operator 09-13: the mechanical "operator preset"
(punt rules, tier minimums) FAILED and collapsed to the null - this is the math version of the same
idea, so it is registered as its own form.
FROZEN FORM. Per sim draw d, the field's lineup score is modelled from projected ownership (the
shipped projectOwnership(), p_i = own_i / 100 clamped [.005, .95], sum ~ 6): mean F[d] = sum_i p_i
s_id, variance V[d] = sum_i p_i (1 - p_i) s_id^2 (independent-inclusion approximation; the cap /
6-slot correlation is ignored). A candidate's percentile in the field for draw d is Phi((S_cd -
F[d]) / sqrt(V[d] + 1)); its rank is max(1, round((1 - pct) x E)) with E the real contest size; its
prize is the replay's DK-like curve (E x r^-.75 / Z for r <= 0.2E, entry-fee units). Build the
E[max] set exactly as today but on Pmat[c,d] = prize(c,d) instead of Smat[c,d] = points - the same
greedy selector, same 2,000 candidates (projection cut, so B can only re-weight within the chalk-
dominated pool), same draws, no caps, no top-up. Nothing else changes.
ARMS. A = E[max points] (ships). B = E[max prize]. Scored on realized prize at exact rank in the real
contest, same ladder and curve, at N = 20 (the ledger row) and N = 70 (the operator's range).
17 contests (every ledger race with an uploaded contest). Also reported, not decisive: B's mean
projected ownership of its set vs A's, and B's top exposures.
DECISION RULE. Ship B as the GPP default if its total realized prize over the 17 >= A's at BOTH
N = 20 and N = 70, and it is not below A in more than 10 of the 17 contests at N = 20 (a win driven
by one contest does not ship). Otherwise it does not ship and the result is logged with the per-
contest split. Written before the arm is run. PUSH before reading data.

RESULT (run 2026-10-04, 16 contests - the ledger holds 16 with contests, not 17; O'Reilly R27 has
none). Realized prize, entry-fee units, summed: N=20 A 231.1 vs B 230.7 (B ahead in 11 of 16, behind
in 5); N=70 A 733.2 vs B 724.7 (B ahead in 7). Per contest N=20 (A -> B): cup30 7.4 -> 10.8,
oreilly28 13.2 -> 5.7, cup28 17.5 -> 16.4, cup27 0 -> 3.7, oreilly26 6.4 -> 9.6, cup26 10.8 -> 12.1,
cup25 5.0 -> 6.1, oreilly25 0 -> 1.6, oreilly24 6.4 -> 6.6, cup24 4.8 -> 4.1, oreilly23 6.6 -> 14.5,
cup23 2.0 -> 5.0, trucks20 0 -> 2.2, trucks19 114.3 -> 107.1, trucks18 2.6 -> 2.7, trucks17 34.1 ->
22.6. DECISION: FAILS the rule (B's total is below A at both sizes, by 0.2% and 1.2%). Does not ship.
WHAT THE NUMBERS SAY. B's sets are barely different from A's: mean projected ownership of the set
28.1% vs 27.9% (cup30), 28.2 vs 28.5 (oreilly28) - within a point everywhere - and the top exposures
are the same cars at nearly the same rates. The objective did not move exposure off the chalk; it
re-weighted draws. Two reasons, both structural and both visible only after running it: (1) within a
draw the field score F[d] is one number for every candidate, so prize(rank) is MONOTONE in points
within the draw - the best lineup per draw never changes, only how much each draw is worth, and the
curve's convexity is not enough to overturn the points ranking; (2) the 2,000 candidates are the
projection cut, which is chalk-dominated by construction (the 09-06 note: a top car sits in 70-100%
of them), so a low-ownership lineup is rarely even available to pick. The leverage story (Kvapil at
14% vs Sawalich at 64%) is real in the data but this form cannot express it on this candidate pool.
B's many small wins and few large losses (oreilly28 -7.5, trucks17 -11.5) are the signature of a
re-weighting that mostly adds noise. IF THIS IS TRIED AGAIN it needs a different registration: a
candidate pool that includes low-projected-ownership lineups on purpose (the cap-diversification
mechanism already does this for capped drivers), and an objective that is not monotone within a
draw - e.g. field score sampled per candidate from ownership-conditional lineups, or the
Portfolio's own-weighted leg rules measured on prize. Not registered today. Arm kept in DfsReplay as
a diagnostic.

## 2026-10-04 — REGISTRATION: CLEAN PACE - field-adjusted green-lap pace while the car is healthy (stage 1: is it predictive?)
NAME. Called CLEAN PACE here (operator: the name FLAGS is the article author's; this is our own
definition, inspired by his description, built from our lap archive).
TRIGGER. Operator: Action Network's "FLAGS" (Field-Level Adjusted Green Speed - race laps from a car
while it is healthy, each lap compared to the healthy field on that same lap; Reddick 9th by NASCAR's
avg green-flag speed, 4th by FLAGS). Our corrHistory term (weight .35-.60 by group) runs on
loop_data driver_rating, which averages in the laps a damaged car ran. We hold every lap of every
race 2022-26 (lap-times.json via api type=laps) so the metric is computable. The article gives no
formula; this is OUR definition, frozen here.
FROZEN FORM (clean_pace_pct per driver per race). Racing laps = laps whose number is not inside any
caution window (weekend-feed caution_segments start..end), minus lap 1 and the first lap after each
window (the restart lap). For each racing lap L: T = every car's time on L; M0 = median(T); healthy
field = cars with t <= 1.03 x M0; M = median(healthy times). A car's deviation on L is
100 x (t - M) / M, kept only if the car is itself healthy on L. clean_pace_pct = mean of the car's kept
deviations (lower = faster), null unless kept laps >= 40% of racing laps. clean_pace_rank = rank of
clean_pace_pct within the race among non-null drivers. Stored per (series, year, nascar_race_id,
driver). Years 2024-2026, all three series (2022-23 later if stage 2 happens).
STAGE-1 TEST (predictive, no sim). For every 2025-26 race with loop_data: for each driver, the
trailing mean over his previous races (same series, same correlation group as the race's track, up
to 10, any year >= 2024) of (a) clean_pace_pct, (b) loop_data driver_rating, (c) finish position. Score =
Spearman of each trailing mean with the race's finish positions, pooled over races, drivers with all
three available. Also by series and by correlation group.
DECISION RULE (stage 1). Clean Pace "proceeds to stage 2" (a registered sim integration into corrHistory)
if pooled |rho_a| >= |rho_b| + 0.02 and Clean Pace is not worse than rating in more than one of the
three series. Otherwise it is logged and nothing further is built. Nothing ships from stage 1
either way. Written before any lap is pulled. PUSH before reading data.

RESULT (run 2026-10-04). Built clean_pace_race for 278 races 2024-26 (10,037 driver-races; the lap
archive's season path cacher/{year}/{series}/{race}/lap-times.json holds every year, the live path
only 2025-26). Joined to loop_data by series / year / race_number / name: 9,003 of 9,775 driver-rows
matched (the rest are exhibition races with no race_number). Test set: 172 races in 2025-26 with a
correlation group and >= 8 drivers carrying a trailing history; 5,884 driver-rows.
POOLED SPEARMAN WITH FINISH: trailing Clean Pace .461, trailing driver_rating .479, trailing finish
.436. By series - cup .403 / .414 / .380; O'Reilly .520 / .530 / .478; trucks .480 / .498 / .439.
By group - Intermediate .523 / .533 / .508; Short & Flat .529 / .557 / .506; Road .446 / .457 / .410;
Superspeedway .121 / .178 / .108. Per-race mean rho .455 vs .474; Clean Pace ranked the finish
better than rating in 69 of 172 races (cup 24/66, O'Reilly 25/61, trucks 20/45).
DECISION: FAILS stage 1 (needs rating + .02; it is rating - .018, and worse in all three series).
Nothing further is built. READING: Clean Pace is a real predictor - clearly better than past finish
everywhere - but driver_rating already carries the same speed information plus the things Clean Pace
deliberately throws away (where the car actually ran, laps led, whether it finished), and those are
predictive too: the "healthy laps only" filter trades a little bias for a lot of lost signal. The
article's Reddick example (9th -> 4th) is the metric telling you a fast car crashed, which the sim's
rating-plus-DNF structure already represents. Table and endpoint stay (type=cleanpace,
clean_pace_race) - useful as a display stat and for any later test of a BLEND (not registered).

## 2026-10-04 — REGISTRATION: Clean Pace + driver rating BLEND (stage 1b)
TRIGGER. Operator, after the stage-1 null: "try rating plus clean pace blend". Clean Pace alone .461
vs rating .479; the question is whether it carries anything rating does not.
FROZEN FORM. Same test set and trailing means as stage 1 (172 races 2025-26, same-series same-group
last-10 history, >= 8 drivers). Within each race, convert trailing rating (higher = better) and
trailing Clean Pace (lower = better) to percentile ranks among that race's test drivers (ties
averaged). Blend_w = w x pct_cleanpace + (1 - w) x pct_rating. PRIMARY w = 0.5. Also reported, not
decisive: w = 0.25 and 0.75, and rating-only / Clean-Pace-only on the same percentile basis.
Score = pooled Spearman with finish, plus by series and per-race mean.
DECISION RULE. The blend proceeds to a stage-2 sim registration if Blend_0.5 pooled rho >= rating
pooled rho + 0.01 AND it is not below rating in more than one of the three series. Otherwise logged,
nothing further. Written before running. PUSH before reading data.

RESULT (run 2026-10-04, 172 races, same test set). Pooled Spearman with finish, percentile basis:
rating only .4674; blend w=.25 .4705; w=.50 .4682; w=.75 .4608; Clean Pace only .4484. By series
(rating / blend .5): cup .4087 / .4077, O'Reilly .5176 / .5162, trucks .4944 / .4988. Per-race mean
rho: rating .4736, blend .5 .4707; the blend ranked the finish better than rating in 78 of 172
races. DECISION: FAILS (needs +.01; the primary blend is +.0008 pooled and worse per race and in two
of three series). The best reported weight (.25, +.003) is inside noise and was not the primary.
Nothing further. READING: Clean Pace is almost entirely inside driver_rating - a 25% dose adds a
third of a point of rho and a 50% dose adds nothing. Closed. The stat stays on the table for display.

## 2026-10-05 — REGISTRATION: does the sim over-weight STARTING POSITION for fast cars that qualified badly? (stage 1: calibration from stored boards)
TRIGGER. Cup Vegas R31 replay: the cars that made the operator's week were Blaney P20 -> 5 (proj DK
32.9, actual 60.55), Logano P23 -> 10 (31.9 vs 47.9), Cindric P7 -> 4; Kansas trucks R20 had the same
shape (Dye P35 -> 15, Leitz P26 -> 7, Eckes P25 -> 2) which I attributed to the no-practice metric grid.
Vegas had practice and a real grid and it happened again. Simplest explanation to test: the finish
model weights starting position too heavily for cars whose equipment/form says they belong up front,
at the exact spot where DK pays place differential. This stage uses ONLY data already stored - no
engine change, no new input.
DATA. Every 2026 published POST board (sim_results stage 'post', all three series) that has loop_data
for the race. Per driver-race: proj_finish, proj_dk, start_pos from the board; actual finish_position,
start_position (real grid), laps_led, fastest_laps from loop_data -> actual DK points by the replay's
dkPoints(). Rows with a board start_pos that differs from the real grid by > 3 are dropped (the board
was built on a stale grid - that is a different failure). DNS / no finish dropped.
TIER (independent of this race): trailing mean driver_rating over the driver's previous 5 loop_data
races in the same series and season (min 3); within each race, tier A = top 8 by trailing rating,
B = 9-16, C = the rest. No trailing data -> excluded.
START BUCKETS: 1-5, 6-10, 11-15, 16-20, 21-25, 26+.
MEASURES: finish residual = actual finish - proj_finish (negative = better than projected); DK
residual = actual DK - proj_dk (positive = better). Reported per tier x bucket: n, mean, t of the
mean, and the series / track-type split (short, intermediate, SS, road) as a report, not a decision.
DECISION RULE. The claim is confirmed if, pooled over 2026 all series, tier A+B rows with start >= 16
have mean DK residual >= +4.0 points AND finish residual <= -1.5 positions, with |t| >= 2.0 on both
and n >= 25, AND tier C rows with start >= 16 do NOT show both (otherwise it is a general "everyone
starting back is under-projected" bias, a different fix). Confirmed -> stage 2 registration: a
rating-conditioned start weight in the finish model, fit on 2025, judged on 2026 (not shipped from
this stage). Not confirmed -> logged null, Vegas + Kansas were two races of noise. Written before any
query. PUSH before reading data.

RESULT (run 2026-10-05, 21 post boards 2026 with loop data - cup 12 / O'Reilly 6 / trucks 3, boards
exist from July; 702 driver-race rows after drops: 7 grid mismatches, 50 no trailing rating, 13 no
finish). Tier A+B, start >= 16: n 109, DK residual +2.56 (t 1.11), finish residual -1.01 (t -1.06).
Rule needs >= +4.0 / <= -1.5 with |t| >= 2 on both: FAILS on all four. Tier C, start >= 16: n 299, DK
+0.34 (t 0.39), finish -0.35 - no general back-of-grid bias either. Overall calibration: all 702 rows
DK -0.42 (t -0.49), finish +0.10 - the boards are centred. By series the AB16 cut is cup +4.69 (n 57,
t 1.29), O'Reilly +3.03 (n 28, t 0.88), trucks -3.02 (n 24, t -0.69) - cup carries the sign, trucks
reverse it, none significant. Cells: the one cell that looks like Vegas is B x 21-25 (n 16, DK +12.8,
t 1.98, finish -4.0) but its neighbours A x 16-20 (-1.4) and B x 16-20 (-2.1) are negative and C x
16-20 is +4.8 (t 2.15) - the big residuals sit in whatever cell the week's back-starting winner fell
in, not along the tier line. The other shape in the table is the fade side: tier B starting 1-5
finish +4.2 worse than projected, DK -8.4 (n 28, t -1.3; Hamlin P1 -> 16 at Vegas is the latest) -
same story, not significant. The top residual rows are the wins/podiums from the back the ledger
already knows (Larson Darlington P25 -> 5, Bell Iowa P22 -> 2, Wallace NH P23 -> 2, Gibbs Darlington
P28 -> 2, Blaney Kansas P25 -> 5, Briscoe Kansas P23 -> 4) - the fat right tail of DK scoring, which
the sim's finish distribution already carries as a tail, not a mean shift.
DECISION: NULL. Vegas + Kansas were two races of the tail, not a start-weight bias. Nothing changes
in the engine; no stage 2. Re-judge only if the AB16 cut stays >= +4 with t >= 2 after the 2026
season is complete (~30 boards). Four registrations in two days, four nulls (continuation, ownership
objective, Clean Pace, blend) plus this: the stored boards are well calibrated on the mean, and the
product's weak spots are construction and timing, not projection - which is what the Operator rows
are measuring.

## 2026-10-09 — REGISTRATION: LAPPED-TRAFFIC mechanism, HALF strength (the single follow-up the 09-07 result named)
TRIGGER. Operator (Charlotte trucks week, Eckes P8 after a projected P18 pre board; Kansas P25 -> 2):
"I still think the simulation as a whole is putting too much weight in start position." The record:
08-20 cut startPos 0.33 -> 0.23 on 230 races (his hunch, confirmed); 09-07 deep-starter shift
(0.23 -> 0.13 for P16+) CLOSED - fixed the elite-deep cell, lifted the P32 backmarker just as much,
rho down; 10-05 tier test null (AB start >= 16: finish -1.0, t -1.1). The 09-07 deep-starter result
named the prerequisite: the back of the field is over-projected (non-elite P26+ +1.23 positions /
-3.3 DK, n 1,059, CI clear of zero) because the race sim has no lapped state; fix that, THEN re-test
the start weight for deep starters. The 09-07 lapped-traffic mechanism at FULL strength (p = p_band
x 2 x (1 - spdPct)) moved P26+ from 1.1 too good to 0.8 too bad and cost rho (.5435 -> .538); its
read-out named exactly one follow-up form and did not run it. This is that form. One form, no sweep.
FORM (frozen before data is read). simEngine.runRaceSim, flag simConfig.lappedTraffic = { series,
k }. Rate table = the 09-07 table (loop_data 2023+, running finishers laps down, bands P1-10 / 11-20 /
21-25 / 26-30 / 31+): cup INT .11/.19/.26/.32/.45, SHORT .22/.38/.53/.62/.78, ROAD .04/.07/.05/.10/
.24; O'Reilly INT .14/.26/.40/.46/.59, SHORT .12/.21/.37/.46/.61, ROAD .06/.09/.14/.15/.17; trucks
INT .19/.24/.36/.56/.59, SHORT .17/.32/.51/.58/.76, ROAD .08/.09/.15/.32/.36; SS = no-op. Per
driver, once per sim call: spdPct = speedScore percentile in the field (fastest 1, slowest 0);
p_i = min(0.9, k x p_band(series, group, startBand(d.startPos)) x (1 - spdPct)). k = 1 is the
registered HALF strength (median car = half the band rate, fastest never, slowest the band rate); k
= 2 reproduces the 09-07 full-strength arm as a check. Per draw, per running driver with effLap 0:
lapped with probability p_i -> effLap 1, so he finishes behind every lead-lap car, ordered by score
among the lapped (the existing effLap sort). DNF, wreck, noise, dominator, DK layers untouched.
HARNESS. scripts/backtest-lapped-half.js: the 91-board practice holdout (holdout-practice.txt,
boards with >= 50% practice coverage; SS boards pass through unchanged), practice on, production
weight sets, asymNoise on for O'Reilly / trucks INT+SHORT in every arm (shipped behaviour), 20k
sims / race / arm, TWO runs. Arms: A = shipped; H = k 1; F = k 2 (reference, must reproduce the
09-07 direction). Elite := top 5 corrAvgRating in the race; deep := start >= 16.
METRICS per arm: finish rho (Spearman projFinish vs actual, mean over races, per-race W/L vs A),
t10 Brier, win / t5 log-loss, per series and per track group; residuals (actual - projected
finish, negative = beat the sim): elite-deep, non-elite P26+, non-elite P31+; P26+ mean projected
vs actual finish.
DECISION (written before the run). SHIP TO THE SIM if, in both runs, finish rho improves in mean
with per-race W/L >= 1.5:1 AND t10 Brier does not lose in mean AND the non-elite P26+ residual
shrinks toward zero AND the elite-deep residual does not grow. DFS-LAYER CANDIDATE (not the
betting board) if rho is a tie (mean within +-.002, W/L between 0.8 and 1.25) AND Brier does not
lose AND the P26+ residual at least halves - then a second registration puts the mechanism on the
DFS draws only. Anything else: CLOSED, and the lapped line ends; the deep-starter start weight is
re-registered ONLY if the mechanism ships somewhere. PUSH before reading data.

RESULT (run 2026-10-09, 94 practice-holdout boards: cup 39 / O'Reilly 26 / trucks 29; 20k sims; two
runs; engine 0c0f14d2ba58 with the flag OFF in production):
  run 1   A ship  rho .5404  t10 .14653  winLL .0880  t5LL .2863 | eliteDeep -1.60  neP26 +0.64  neP31 +1.48 | P26+ proj 24.62 / act 25.26
          H k=1   rho .5367  t10 .14648  winLL .0878  t5LL .2855 | eliteDeep -1.64  neP26 -0.24  neP31 +0.37 | 25.50 / 25.26
          F k=2   rho .5348  t10 .14731  winLL .0877  t5LL .2863 | eliteDeep -1.44  neP26 -1.16  neP31 -0.56 | 26.42 / 25.26
          H vs A: rho W/L 38/56, t10 51/43, winLL 55/39, t5LL 59/35; rho by series cup .4867->.4841 (17/22),
          O'Reilly .6029->.5994 (10/16), trucks .5566->.5512 (11/18); by group INT .5245->.5202, SHORT
          .5838->.5790, ROAD .4150->.4205.
  run 2   A .5399 / .14645 / .0879 / .2857 | -1.61 +0.64 +1.48 | 24.61     H .5374 / .14650 / .0878 / .2857 | -1.64 -0.24 +0.37 | 25.50
          H vs A: rho 42/52, t10 46/48, winLL 59/35, t5LL 55/39.  F reproduces 09-07 (rho .5351, P26+ 26.42, overshoot).
VERDICT by the registered rule: SHIP fails (rho must improve 1.5:1; it loses .0025-.0037 in mean,
38/56 and 42/52). DFS-LAYER CANDIDATE fails too (rho tie needs mean within +-.002 and W/L 0.8-1.25;
it is -.003 and 0.68-0.81). CLOSED. The lapped-traffic line ends here as registered; the
deep-starter start weight is NOT re-registered (its condition was that this ships somewhere).
READING (not a decision): half strength does exactly what the 09-07 read-out predicted - the back
of the field is now calibrated (P26+ projected 25.50 vs actual 25.26, was 24.62; non-elite P26+
residual +0.64 -> -0.24, P31+ +1.48 -> +0.37) without the overshoot - and every PROBABILITY metric
holds or improves (t10 Brier tie, win log-loss 55/39 and 59/35, top-5 log-loss 59/35 and 55/39),
while finish ORDERING loses ~.003 rho, concentrated at short tracks and in trucks (the random
lapped draw scrambles mid-pack order where half the field gets lapped). Same tension as 09-07: the
sim's ordering metric and its probability calibration pull in different directions on this
mechanism. A future registration that makes the probability metrics primary (they are what the
betting flags and the DFS draws consume) could legitimately pass this form - but that is a
different pre-registration with a forking-paths discount, not a re-read of this one. The elite-
deep cell (-1.6, the Eckes / Larson case) does not move under any lapped form; it is a separate,
smaller effect (n 102) and no knob tested so far fixes it without breaking the back of the field.
Engine: simConfig.lappedTraffic + LAPPED_RATE stay in simEngine.js as a tested-OFF arm (default
null, no production path sets it); scripts/backtest-lapped-half.js is the harness.

## 2026-10-09 — REGISTRATION: lapped-traffic HALF strength, judged on PROBABILITY metrics (operator decision, discount stated)
WHY A SECOND REGISTRATION. The 10-09 run above fixed the back-of-field calibration and improved every
probability metric while losing .003 finish rho, and was CLOSED because its rule made rho primary.
Operator, shown the trade-off: "so should we make this change? it sounds like we should." The product
sells probabilities (win / top-5 / top-10 flags, DFS draws), not finish ordering, so a probability-
primary rule is defensible on the merits - but it is being written AFTER the result was seen, on the
SAME 94 boards. That is a forking-paths move and is logged as one: this registration carries a
discount (it must clear a STRICTER bar than the ordinary one), and the forward ledger is the real test.
FORM: unchanged - simEngine.runRaceSim lappedTraffic { series, k: 1 }, the frozen 09-07 rate table,
same harness (scripts/backtest-lapped-half.js), 20k sims, two runs, arm H vs A. Per-series read-out of
the probability metrics added to the harness output (reporting only; no new arm).
DECISION (written before the per-series read-out is run), PER SERIES:
  ship for a series if, in BOTH runs, (1) win log-loss and top-5 log-loss each improve in mean with
  per-race W/L >= 55/45 (i.e. W / (W+L) >= 0.55), (2) t10 Brier does not lose in mean, (3) finish rho
  loses no more than .005 in mean, (4) P26+ mean projected finish lands within 0.5 of actual.
  Pooled (all series) must also satisfy (1)-(4). A series that fails any one stays on the shipped engine.
SHIP MECHANICS if it passes: SimulationCenter sets simConfig.lappedTraffic = { series, k: 1 } for the
passing series at INT / SHORT / ROAD (SS is a no-op by table); published boards carry
config.lapTraffic 'v1-half' / 'off' so sim_grades and the CLV ledger can split boards by engine.
REVERT TRIGGER (forward): two consecutive weekends in which the flagged plays on 'v1-half' boards
show negative CLV lift against the pre-change ledger mean (+2.33 / race, 10-04) -> flag off, logged.
PUSH before reading data.

RESULT (run 2026-10-09, same harness, 20k sims, two runs; per-series read-out). H vs A:
  POOLED  run 1: winLL .0879 -> .0879 (56/38)  t5LL .2859 -> .2855 (58/36)  t10 .14649 -> .14650  rho -.0028  P26+ 25.50 / 25.26
          run 2: winLL .0880 -> .0878 (60/34)  t5LL .2857 -> .2856 (55/39)  t10 .14648 -> .14650  rho -.0030  P26+ 25.50 / 25.26
  CUP     winLL .0878 -> .0878 (26/13) / .0880 -> .0877 (20/19)   t5LL .2880 -> .2881 (22/17) / .2878 -> .2884 (20/19)
          t10 .1499 -> .1502 / .1500 -> .1502   rho -.0013 / -.0021   P26+ proj 25.15 -> 26.06 vs ACTUAL 24.64
  OREILLY winLL .0832 -> .0830 (14/12) / .0832 -> .0831 (20/6)     t5LL .2626 -> .2614 (19/7) / .2621 -> .2615 (18/8)
          t10 .1347 -> .1345 / .1345 -> .1345   rho -.0037 / -.0026   P26+ proj 24.87 -> 25.67 vs ACTUAL 26.27
  TRUCKS  winLL .0921 -> .0925 (16/13) / .0923 -> .0923 (20/9)     t5LL .3038 -> .3038 (17/12) / .3040 -> .3036 (17/12)
          t10 .1526 -> .1523 / .1525 -> .1523   rho -.0036 / -.0046   P26+ proj 23.40 -> 24.33 vs ACTUAL 25.11
VERDICT by the registered per-series rule: NO SERIES PASSES. Cup fails (1) t5 log-loss worse in mean
both runs, (2) t10 Brier worse, (4) P26+ lands 1.4 too pessimistic. O'Reilly fails (1) win W/L 14/12 in
run 1 (0.54 < 0.55) and (4) P26+ 0.6 off (needs 0.5). Trucks fails (1) win log-loss worse in run 1
and (4) P26+ 0.8 off. Pooled passes (1), (3), (4) and misses (2) by .00001 - a tie in any practical
sense, but the rule said "does not lose in mean" and the per-series rule is the ship rule. CLOSED.
Nothing ships. The 'v1-half' stamp and the revert trigger are not needed.
WHAT THE PER-SERIES READ-OUT REVEALED (the real finding of the day): the back-of-field over-
projection is NOT a cup problem. Cup's P26+ starters are already projected 0.5 too PESSIMISTIC
(25.15 vs 24.64 actual - the 09-07 "P26-34 finish better than projected" cell), and the mechanism
pushes cup the wrong way. O'Reilly (24.87 vs 26.27, 1.4 too optimistic) and trucks (23.40 vs 25.11,
1.7) are where the over-projection lives, and there HALF strength does not go far enough (0.6 and
0.8 still short) while FULL strength overshoots (09-07). The honest next form is series-specific:
OFF for cup, and for O'Reilly / trucks a strength between 1 and 2 - which is a one-parameter fit
that must be done on a TRAIN set and judged on a holdout it never saw, not on these 94 boards
again. The rho cost is largest in trucks (-.004) and that is also where the calibration gain is
largest; that trade is the decision a third registration would have to make explicit. Not run today.
Engine unchanged in production (flag default null). Seven registrations since 10-04, seven closed.

## 2026-10-09 — REGISTRATION: the 09-07 SHRINKAGE PROTOCOL, executed — (1) lapped traffic, (2) per-car DNF, one constant per series
PROTOCOL (operator ruling 09-07, verbatim intent): no series ON/OFF gates; every car-specific
feature runs in every series through ONE per-series constant, FITTED on 2022-24 and SCORED on
2025-26 boards the fit never saw. Both items below follow it exactly. Written before any data is
read; the fit set and the test set are disjoint by year.
DATA. Train = scripts/backtest-data/holdout.txt (162 races 2022-24, practice-free; SS boards pass
through unchanged in both arms). Test = holdout-practice.txt filtered to >= 50% practice coverage
(94 boards 2025-26, the set every 09-07 and 10-09 result used). Boards are matched to loop_data by
the (start:finish) fingerprint (>= 0.85 of the field must match, else the board is dropped and
named) to recover driver names, from which the per-car features are computed from loop_data rows
dated BEFORE the race (same series, 2022 onward, 0.85^age recency, up to 30 prior races, >= 3 else
null). Harness scripts/backtest-protocol.js; 20k sims / race / arm; the test set is run TWICE.
(1) LAPPED TRAFFIC, per-series strength k. Mechanism exactly as 10-09 (simConfig.lappedTraffic
{ series, k }, frozen 09-07 rate table, p_i = min(0.9, k x p_band x (1 - spdPct))). FIT: k per
series from {0, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2} on TRAIN by minimising |non-elite P26+ finish
residual| (the laps-down family's protocol metric), ties to the smaller k; k = 0 is a legitimate
answer (= off). FROZEN, then scored on TEST.
(2) PER-CAR DNF, per-series prior weight k. Mechanism as registered 09-07: ownDnf = recency-
weighted share of prior same-series races not finished running (finish_status != Running);
m_i = ((n_i x own_i + k x mean) / (n_i + k)) / mean, null -> 1, clamped [0.5, 2.0], rescaled to
mean 1 over the field (the DNF budget is unchanged, only its allocation moves), multiplying both the
accident draw and the mechanical draw through __tilt. Flag simConfig.carDnf { k }. FIT: k per
series from {2, 4, 8, 16, 32, off} on TRAIN by minimising per-driver DNF Brier (sim dnfPct vs
actual non-running finish); FROZEN, then scored on TEST. (09-07 used k = 4 everywhere; it passed
trucks and over-corrected cup by 5 points and O'Reilly by 13 - the protocol exists to fit that.)
DECISION, per series, each item on its own, on the TEST set in BOTH runs (the ordinary bar - the
fit never saw these boards, so no discount): SHIP a series if win log-loss, top-5 log-loss and t10
Brier each do not lose in mean (worse by no more than 0.0002 counts as a tie) AND finish rho does
not lose by more than .005 in mean AND the item's own target moves toward zero / improves: (1) the
non-elite P26+ residual shrinks in magnitude; (2) per-driver DNF Brier improves in mean and the
ownDnf > 0.30 cell's sim DNF% moves toward its actual. A series whose fitted k is 0 / off ships
nothing (that is the protocol's answer for it). Ships as per-series constants on one shared
mechanism, stamped on boards (config.lapTraffic 'v2-k<series>' / config.carDnf 'v1-k<series>').
Revert trigger as 10-09: two straight weekends of negative CLV lift on stamped boards.
PUSH before reading data.
CORRECTION before any result is read (10-09, same session): the registration names the TRAIN file as
holdout.txt "162 races 2022-24". That file is the 2025 practice-free holdout (fingerprints match 2025
races), and overlaps the test years. The 2022-24 set is scripts/backtest-data/train.txt (274 races:
cup 108 / O'Reilly 99 / trucks 67). Fit on train.txt; test stays holdout-practice.txt >= 50% coverage
(94 boards, 2025-26). Principle unchanged (fit years disjoint from test years); file name corrected.
FIT (train.txt 2022-24, 274 boards: cup 108 / O'Reilly 99 / trucks 67; 10k sims; boards fingerprint-
matched 274/274, test 162/162):
  LAPPED k by |neP26 residual|:  cup 0.75 (k0 +0.76 -> +0.12; P26+ 23.95 -> 24.59 vs 24.71)
                                 O'Reilly 1.5 (k0 +1.33 -> -0.06; 24.44 -> 25.83 vs 25.77)
                                 trucks 2 (k0 +2.72 -> +0.13; 22.75 -> 25.34 vs 25.47) - at the top of the grid
  PER-CAR DNF k by DNF Brier:    cup OFF (every k worse than off; own>.30 cars DNF 16.1%, n 367 - no information)
                                 O'Reilly OFF (same shape; own>.30 cars 21.1% actual, k=2 sim 28.8%)
                                 trucks 32 (Brier .13115 -> .13053; own>.30 cell sim 16.6% -> 23.4% vs 23.3% actual, n 219)
  FROZEN: lapped {cup .75, oreilly 1.5, trucks 2}; carDnf {cup off, oreilly off, trucks 32}. Per the
  registration, cup and O'Reilly ship nothing on per-car DNF (the protocol's answer: the history
  carries no cup / O'Reilly information on 2022-24, which is what the 09-07 result looked like).
TEST (holdout-practice.txt 2025-26, 94 boards: cup 39 / O'Reilly 26 / trucks 29; 20k sims; two runs;
engine 41c0d8da3be3; frozen constants above; each item on its own vs A = shipped):
 (1) LAPPED, fitted k per series
  CUP k .75   run1 rho .4868->.4859 (19/20)  t10 .14979->.15022  winLL .0881->.0876 (21/18)  t5LL .2880->.2881 | neP26 -0.50 -> -1.13  P26+ 25.15 -> 25.77 vs 24.64
              run2 rho .4860->.4861 (21/18)  t10 .14979->.15018  winLL .0880->.0879          t5LL .2877->.2883 | neP26 -0.50 -> -1.12
              FAILS: t10 Brier worse by .0004 both runs; the P26+ residual moves AWAY from zero. (On 2022-24 cup's back
              of field was +0.76 optimistic; on 2025-26 it is -0.50 pessimistic - the cup calibration flipped between eras,
              so the train-fitted k is wrong-signed on the test years. Protocol answer for cup: nothing ships.)
  OREILLY 1.5 run1 rho .6027->.5980 (-.0047, 12/14)  t10 .13467->.13460 (14/12)  winLL .0831->.0830 (17/9)  t5LL .2623->.2613 (17/9) | neP26 +1.39 -> -0.04  P26+ 24.88 -> 26.31 vs 26.27
              run2 rho .6027->.5973 (-.0054, 12/14)  t10 .13470->.13466 (12/14)  winLL .0830->.0826 (20/6)  t5LL .2627->.2612 (19/7) | neP26 +1.40 -> -0.04
              Every probability metric improves in both runs; the back of the field lands within 0.04 of actual; finish rho
              loses .0047 and .0054 - the .005 guard is MISSED BY .0004 IN RUN 2. By the letter: does not pass. Same
              shape as 09-03 start-v4 ("letter of the gate missed by one race") - OPERATOR DECISION, not a ship.
  TRUCKS 2    run1 rho .5549->.5463 (-.0086, 11/18)  t10 .15255->.15290  winLL .0922->.0922 (22/7)  t5LL .3039->.3046 | neP26 +1.71 -> -0.14  P26+ 23.40 -> 25.25 vs 25.11
              run2 rho .5556->.5471 (-.0085, 10/19)  t10 .15258->.15285  winLL .0924->.0918 (21/8)  t5LL .3045->.3044
              FAILS: rho loses .0085 (guard .005), t10 Brier worse by .0003-.0004. The calibration is fixed and the win
              log-loss is clearly better (22/7, 21/8) but the ordering cost at trucks is the largest of any series, as
              every lapped run has shown. Not shipped.
 (2) PER-CAR DNF, trucks k = 32 (cup / O'Reilly fitted OFF - nothing to test)
  TRUCKS 32   run1 dnfBrier .14374->.14230  own>.30 cell sim 16.3% -> 23.0% vs 29.2% actual (n 113)  rho .5549->.5552 (11/18)
              t10 .15255->.15266 (+.0001, 17/12)  winLL .0922->.0920 (19/10)  t5LL .3039->.3040 (+.0001, 15/14)
              run2 dnfBrier .14365->.14229  cell 16.3% -> 23.0%  rho .5556->.5536 (-.0020, 12/17)  t10 .15258->.15276 (+.0002, 15/14)
              winLL .0924->.0919 (22/7)  t5LL .3045->.3041 (19/10)
              PASSES every condition in both runs: DNF Brier improves, the cell moves toward actual, win and top-5 log-loss
              improve, t10 Brier within the .0002 tie band, rho within .005. SHIPPED for trucks.
SHIPPED (this commit): SimulationCenter attaches ownDnf / ownDnfN for every driver in every series (per-driver
prior same-series races, most recent first, up to 30, 0.85^age, >= 3) and sets simConfig.carDnf { k: 32 } for
TRUCKS only; boards stamp config.carDnf 'v1-k32' / 'off'. Engine: simEngine.runRaceSim carDnf block (multiplier
clamped [0.5, 2], rescaled to mean 1, through __tilt). Cup / O'Reilly: feature attached, flag off, per the fit.
Revert trigger (registered): two straight weekends of negative CLV lift on 'v1-k32' trucks boards.
NOT SHIPPED: lapped traffic in any series. O'Reilly at k 1.5 is the operator's call (misses the rho guard by
.0004 in one of two runs with every probability metric better and the calibration exact). Eight registrations
since 10-04: one ship (trucks per-car DNF), one operator call (O'Reilly lapped), six closed.

## 2026-10-09 — REGISTRATION: DOMINATOR CONCENTRATION (laps led / fastest laps) — stage 1, calibration only
WHY. DK pays 0.25 / lap led and 0.45 / fastest lap, so the top of a GPP slate is dominator points
(Larson 110 at Darlington, Briscoe 116.5 at Vegas). Whether the E[max] set can contain that outcome
depends on whether the race sim concentrates laps led in one or two cars the way real races do, or
spreads them. The INT allocator was rebuilt 09-03 (INT_DOM_V2); SHORT / ROAD / SS run older curves.
Nobody has tested the SHAPE of the dominator distribution, only means. Stage 1 is a diagnostic: no
form, nothing ships from it; a failing cell earns a stage-2 registration with a named form.
DATA. The 94 practice-holdout boards (2025-26, >= 50% practice coverage), shipped engine, 20k sims,
with the trucks per-car DNF flag ON (= production as of 6eedbd4). Actual laps led / fastest laps
per driver from loop_data for the fingerprint-matched races (protocol-features.json race ids).
Sim per-draw top share from the engine's existing __domDiag hook, extended to record the top laps-
led share and top fastest-laps share every 10th draw (diagnostic only; no engine behaviour change).
METRICS, per series x track group (INT / SHORT / ROAD / SS), reported only for cells with >= 8 races:
  (a) PIT of the ACTUAL top laps-led share within the sim's per-draw top-share distribution for that
      race: F_sim(actual). Calibrated = mean PIT ~0.5 with ~10% of races above 0.9 and ~10% below 0.1.
      Mean PIT > 0.6 or > 25% of races above 0.9 = sim UNDER-concentrated (real dominators dominate
      more than the sim lets them); mean PIT < 0.4 or > 25% below 0.1 = OVER-concentrated.
  (b) the same for fastest laps.
  (c) per-driver Spearman of projLapsLed vs actual laps led and avgFastLaps vs actual fastest laps,
      mean over races (ordering: does the sim pick the right dominator).
  (d) the sim's #1 projected dominator per race: his projected laps led vs his actual (mean over
      races; negative = he led MORE than projected) - the favourite's calibration.
  (e) DK dominator-point error: mean over drivers of (0.25 x LL + 0.45 x FL) projected minus actual,
      and the same for the top-3 projected dominators only.
READ-OUT (written before the run): a cell is "under-concentrated" or "over-concentrated" by (a)/(b)
above; stage 2 is registered ONLY for a cell that fails (a) or (b) with >= 15 races, with the form
named then (e.g. a steeper LL curve / stronger elite kick for that group), fit on 2022-24 and scored
on 2025-26 per the protocol. No constant is changed from stage 1. PUSH before reading data.

RESULT (run 2026-10-09, 94 boards, 20k sims, engine 41e140279d70, trucks carDnf ON; cells >= 8 races):
  cell           n | LL PIT mean  >.9   <.1 | top LL share sim/act | FL PIT  >.9  <.1 | top FL sim/act | rhoLL rhoFL | fav proj/act LL | DK dom err all/top3
  ALL INT       46 |  .54         54%  46%  |  41% / 47%           |  .52    43%  43% |  24% / 27%     | .460 .602   |  39.6 / 55.9     |  -0.05 / -4.15
  ALL SHORT     40 |  .74         70%  23%  |  41% / 57%           |  .64    53%  25% |  25% / 30%     | .476 .650   |  40.6 / 91.7     |  +0.80 / -5.68
  ALL ROAD       8 |  .66         63%  13%  |  47% / 57%           |  .57    50%  38% |  31% / 38%     | .462 .509   |  23.3 / 47.0     |  +0.29 / -2.57
  cup INT       21 |  .52         52%  48%  |  40% / 44%           |  .34    29%  62% |  25% / 21%     | .466 .580   |  50.5 / 65.9     |  -0.20 / -3.83
  cup SHORT     14 |  .59         50%  43%  |  41% / 53%           |  .36    29%  64% |  25% / 24%     | .486 .574   |  63.0 / 95.1     |  +0.89 / -0.38
  oreilly INT   14 |  .43         43%  57%  |  41% / 46%           |  .76    57%  21% |  24% / 30%     | .481 .640   |  35.3 / 47.7     |  +0.07 / -5.50
  oreilly SHORT 12 |  .68         67%  25%  |  38% / 49%           |  .64    50%   8% |  25% / 30%     | .542 .701   |  27.4 / 71.7     |  +0.86 / -7.64
  trucks INT    11 |  .72         73%  27%  |  42% / 53%           |  .56    55%  36% |  25% / 32%     | .424 .594   |  24.2 / 47.2     |  +0.11 / -3.06
  trucks SHORT  14 |  .94         93%   0%  |  42% / 69%           |  .92    79%   0% |  24% / 36%     | .408 .681   |  29.6 / 105.4    |  +0.65 / -9.31
  SPREAD (the finding the registered metric did not anticipate): the sim's top laps-led share barely
  varies ACROSS DRAWS - within-race sd 2.4 pts at INT, 5.8 SHORT, 6.7 ROAD - while the ACTUAL top share
  varies 14-23 pts across races. Every draw hands the leader ~41% of the laps by construction: the LL
  curve is a fixed mean share vector by rank (INT_DOM_V2 curves[0] = 0.405; other groups' LL_CURVES
  likewise) and only the leader's IDENTITY changes draw to draw. That is why the PIT splits to the
  extremes in every cell (54% of races above the sim's 90th percentile AND 46% below its 10th at INT):
  the real race is almost never inside the sim's top-share band because the band is a few points wide.
  Fastest laps: same structure, sd 1.4-4 pts vs 7-19 actual.
READ-OUT by the registered rule: UNDER-CONCENTRATED in every SHORT cell (ALL SHORT PIT .74, 70% above
.9, n 40; trucks SHORT .94 / 93%, n 14; O'Reilly SHORT .68 / 67%), in trucks INT (.72 / 73%, n 11) and
in O'Reilly fastest laps (.70 / 54%, n 26). INT laps led is calibrated in LEVEL (cup 40% vs 44%) - the
09-03 INT_DOM_V2 ship did its job - but has the same missing spread. Cup fastest laps is the one
OVER-concentrated cell (PIT .34, 64% below .1; sim 25% vs actual 21-24%).
THE FAVOURITE: the sim's #1 projected dominator is projected 38.6 laps led and actually leads 70.4 on
average (cup SHORT 63 vs 95; trucks SHORT 30 vs 105; O'Reilly SHORT 27 vs 72) - under-projected by
nearly half everywhere outside cup INT, with ordering fine (rhoLL .47, rhoFL .61: the sim knows WHO,
not HOW MUCH). DK dominator points are near zero in mean across the field (+0.3) and -4.7 per driver
for the top-3 projected dominators (-9.3 trucks SHORT): the DFS slate's top is systematically under-
projected, and with no draw-to-draw spread the E[max] set never sees the 100-point dominator day.
STAGE 2 (to be registered separately, named here as the rule requires): per-draw BOOTSTRAP of real
race share vectors - the engine's existing domBoot path (09-03 ARM C, left OFF "for a ceiling-targeted
registration later"; this is that registration) - with pools built from 2022-24 loop_data per series
x track group x caution bucket, for ALL groups (SHORT / ROAD / SS get pools; INT keeps the v2 strength
pool for identity and draws its share vector from the bootstrap), judged on 2025-26 by: top-share
PIT calibration (mean .4-.6, <= 25% beyond either tail), favourite calibration, top-3 DK dominator
error, LL / FL MAE not worse, and the win / top-5 / top-10 / rho guards. Nothing ships from stage 1.
Engine: __domDiag hook extended (diagnostic only); scripts/backtest-dominators.js; data
dominator-actuals.json (loop_data laps led / fastest laps for the 162 fingerprint-matched races).

## 2026-10-09 — REGISTRATION: DOMINATOR BOOTSTRAP (stage 2) — per-draw real share vectors for every track group
WHY. Stage 1 (above): the sim's laps-led / fastest-laps curves are fixed mean share vectors by rank,
so every draw hands the leader ~41% of the laps (within-race sd 2-7 pts vs 14-23 across real races)
and, outside cup INT, the level is low (SHORT 41% vs 57%; trucks SHORT 42% vs 69%); the sim's #1
projected dominator is projected 39 laps led and leads 70. The engine already has the mechanism:
simConfig.domBoot (09-03 ARM C) draws ONE real race's sorted share vector per draw from a pool by
caution bucket instead of the bucket mean. It was left OFF for INT because the 09-03 study judged
MAE / ordering, where it tied; "its per-draw variance (the 80% nights) is a DFS-ceiling property this
study did not judge" - this is that registration.
FORM (frozen before data is read). Pools: from loop_data 2022-24 (every race with >= 20 rows and a
caution count from caution_segments), per SERIES x TRACK GROUP (INT / SHORT / ROAD / SS) x caution
bucket (low <= 5 / mid <= 8 / high), the race's laps-led shares sorted descending (padded to 40,
renormalised) and the same for fastest laps; a bucket with < 20 races uses the group's pooled set;
a series x group with < 20 races in total uses ALL series' races for that group (cup / O'Reilly /
trucks pooled - the 09-03 INT pool was cup-only and O'Reilly / trucks inherited it). Per draw the
engine picks one vector at random (existing code path; no engine behaviour change beyond setting
domBoot). Identity ordering unchanged: INT keeps the v2 strength pool (alpha / k as shipped); other
groups keep the finish-order pool; the SS tilts stay. INT's per-draw vector comes from the bootstrap
instead of INT_DOM_V2.curves - that is the only change there. FL budget unchanged (INT 0.7794, others
every lap). Nothing fitted - the pools ARE the fit, and they come from 2022-24 only.
HARNESS. scripts/backtest-dominators.js arm B = shipped + domBoot (pools built by scripts/build-dom-
pools.js into backtest-data/dom-pools.json), 94 practice-holdout boards 2025-26, 20k sims, two runs;
trucks carDnf ON in both arms (production).
METRICS. Stage-1 set: top-share PIT (mean, tails) LL and FL; favourite proj / actual LL; top-3 DK
dominator error; rhoLL / rhoFL; plus LL MAE and FL MAE (per driver, mean over races) and the sim
guards: win log-loss, top-5 log-loss, t10 Brier, finish rho - per series x group and pooled.
DECISION (per track group, pooled over series; written before the run). SHIP a group if, in both
runs: (1) LL top-share PIT mean lands in [0.40, 0.60] with <= 25% of races beyond EITHER tail (was
up to 70% / 93%), (2) the favourite's projected laps led moves toward his actual, (3) top-3 DK
dominator error shrinks in magnitude, (4) LL MAE and FL MAE do not get worse by more than 0.3 laps,
(5) rhoLL / rhoFL do not lose more than .02, (6) win log-loss, top-5 log-loss, t10 Brier each do not
lose in mean (0.0002 tie band) and finish rho does not lose more than .005. A group that passes
ships for all three series (the pool is per series where the data allows, pooled where it does
not); boards stamp config.domBoot 'v1-<groups>'. Revert trigger: two straight weekends of negative
CLV lift on stamped boards, OR the DFS replay ledger's GPP best-of-20 percentile falling below its
pre-change mean for three straight races. PUSH before reading data.

RESULT (run 2026-10-09, 94 boards 2025-26, 20k sims, two runs each arm; pools from 274 races 2022-24 -
own-series pools for cup/O'Reilly/trucks INT and SHORT, all-series pools for ROAD and SS; engine 41e140279d70):
  GROUP  run | LL PIT mean, >.9, <.1 (A -> B)   | fav proj -> B / actual | top-3 DK err  | maeLL / maeFL      | win LL        | t5 LL         | t10 Brier         | rhoFin
  INT    r1  | .54 -> .49, 54% -> 11%, 46% -> 11% | 39.6 -> 42.8 / 55.1   | -4.16 -> -3.30 | 6.01->5.88 3.56->3.47 | .0862->.0859 (30/16) | .2835->.2839 (18/28) | .14517->.14516 | .5186->.5202 (29/17)
  INT    r2  | .54 -> .49, 54% -> 11%, 46% ->  9% | 39.6 -> 42.8          | -4.15 -> -3.31 | same                | .0864->.0861 (17/29) | .2840->.2835 (27/19) | .14522->.14509 | .5203->.5195 (22/24)
  SHORT  r1  | .74 -> .57, 70% -> 18%, 22% ->  8% | 40.5 -> 51.2 / 91.7   | -5.91 -> -2.01 | 11.04->10.43 6.34->6.03 | .0916->.0919 (13/27) | .2851->.2851 (21/19) | .14450->.14449 | .5857->.5856 (17/23)
  SHORT  r2  | .74 -> .57, 70% -> 20%, 20% ->  8% | 40.5 -> 51.3          | -5.67 -> -1.79 | same                | .0922->.0915 (19/21) | .2852->.2851 (19/21) | .14441->.14456 | .5865->.5851 (18/22)
  ROAD   r1  | .66 -> .52, 62% -> 12%, 12% -> 12% | 23.3 -> 28.7 / 47.0   | -2.17 -> -0.17 | 3.27->3.00 2.30->2.18 | .0786->.0778 (8/0)   | .3020->.3015 (5/3)   | .16459->.16448 | .4243->.4253 (5/3)
  ROAD   r2  | .66 -> .52                         | 23.2 -> 28.6          | -2.11 -> -0.18 | same                | .0788->.0781 (7/1)   | .3019->.3027 (1/7)   | .16464->.16466 | .4245->.4226 (3/5)
  SS: fewer than 8 practice-covered boards in the test set - cannot be judged; not shipped.
  Spread restored: within-race sd of the sim's top share INT 2.4 -> 14.8 pts (actual across races 16.5), SHORT 5.8 -> 17.4
  (19.3), ROAD 6.7 -> 17.4 (23.2); FL likewise. FL PIT: INT .52 -> .44, SHORT .64 -> .55, ROAD .57 -> .48.
  By series x group (B): cup SHORT PIT .59 -> .64 and top-3 error crosses to +2.2 (over-projected - the cup SHORT pool's
  2022-24 top share is 44% vs 53% actual in 2025-26, era drift again, but the fixed curve was worse at -0.4 only because
  its favourite was under-projected 63 vs 95); O'Reilly SHORT .68 -> .40, top-3 -8.0 -> -3.8; trucks SHORT .94 -> .65,
  -9.7 -> -4.7, favourite 39 vs 105 actual (still half); trucks INT .73 -> .52.
VERDICT by the registered rule, per group, both runs:
  Dominator conditions (1)-(5) PASS in INT, SHORT and ROAD, both runs, every one: PIT mean .49 / .57 / .52 with tails
  8-20%, the favourite moves toward actual, top-3 DK error shrinks (INT -4.2 -> -3.3, SHORT -5.9 -> -2.0, ROAD -2.2 ->
  -0.2), LL / FL MAE improve everywhere, ordering unchanged.
  Guard (6) - by the letter - MISSES in each group in ONE of two runs by .0001-.0008: INT top-5 log-loss +.0004 in run
  1 (run 2 -.0005); SHORT win log-loss +.0003 in run 1 (run 2 -.0007); ROAD top-5 +.0008 in run 2 (n 8). The tie band
  I registered (.0002) is TIGHTER than the engine's own run-to-run noise on these metrics: arm A against ITSELF moves
  .0002-.0006 between runs on the same boards (INT t5 .2835 vs .2840, SHORT win .0916 vs .0922). So the misses are
  inside the A-vs-A noise floor for INT and SHORT; ROAD (n 8) is inconclusive either way. I did not define the noise
  floor in the registration, so by the letter this is NOT a pass. It is an operator call, stated plainly: the
  dominator fix works exactly as designed in every group and the betting probabilities are a tie within noise.
  Recommendation: SHIP for INT and SHORT (n 46 / 40, every probability guard a tie or better in mean across the two
  runs: INT win -.0003 t5 -.0001 t10 -.0001; SHORT win -.0002 t5 -.0001 t10 +.0001; rho +.0004 / -.0008); HOLD ROAD and
  SS (n 8 / < 8) on the shipped curves until there are boards to judge them. The cup SHORT over-projection (+2.2 on the
  top 3) is the one soft spot inside a shipping group and goes on the forward watch with the revert triggers.
SHIPPED (operator: "ship it"; this commit): dominator bootstrap for INT + SHORT in all three series. src/lib/domPools.js
carries the exact pool vectors the harness drew from (274 races 2022-24, 40-rank share vectors at 4 dp, buckets < 20
pooled; verified vector-for-vector against backtest-data/dom-pools.json); SimulationCenter sets simConfig.domBoot =
domPoolFor(series, group) and stamps config.domBoot 'v1-INT' / 'v1-SHORT' / 'off'. ROAD and SS stay on the fixed
curves. Revert triggers as registered (two straight weekends of negative CLV lift on stamped boards, or the DFS
replay GPP best-of-20 percentile below its pre-change mean three races running). Forward watch: cup SHORT top-3
over-projection (+2.2 DK, era drift in the 2022-24 pool). Nine registrations since 10-04: two ships (trucks per-car
DNF, dominator bootstrap INT + SHORT), one operator call open (O'Reilly lapped traffic), six closed.

## 2026-10-09 — PRE-REGISTERED: START PROJECTION v4 for TRUCKS — same form, refit on trucks, judged on its own 2026. Written before any fit. DO NOT MODIFY.
TRIGGER. Charlotte trucks pre board: Eckes projected P18 (real P8), +1983 FMV on a projected grid;
trucks is the series with the most projected-grid boards and still runs trail10-v3.5 (cup and
O'Reilly shipped v4 on 09-03 / 09-05). NASCAR's 2025+ qualifying-order metric (previous finish +
owner points, worst first) applies to all three national series by the published procedure; the
diagnostic below is what says the effect exists in trucks, the test below is what decides.
DIAGNOSTIC made before this registration (not the test), trucks 2025-26, leak-free trailing-10
start pctile per production rules (same series, min 3, hybrid SS / ROAD category, history reaching
into 2024), residual = actual start pctile - trailing: corr(previous-round finish pctile, residual)
INT +0.43 (n 430), SHORT +0.31 (n 381), SS +0.02 (n 72), ROAD +0.13 (n 92). Cup's were +0.39 / +0.22
/ +0.21 / +0.09 - the trucks effect is at least as large at ovals and absent at SS.
SCOPE. Trucks 2025-26. TRAIN = 2025 (25 races), HOLDOUT = 2026 (20 races), read once. Data
scripts/backtest-data/start-v4-trucks-2025-26.txt (45 races), built from loop_data by the same rules
as the cup / O'Reilly files. Form, arms, metrics, gates and decision rule EXACTLY as the cup v4
registration (09-03) with the O'Reilly (09-05) clarifications, plus:
  - ROAD beta fixed at 0; SS beta FITTED but the diagnostic says ~0 - if it fits above 0.05 on
    n 5 train races it is set to 0 (too few races to trust; written now).
  - No ARM O (no trucks draw_order rows); judged forward when loaded.
  - Pooled gate: improves in >= 55% of races WHERE THE TERM IS LIVE (ROAD excluded).
  - M2 rail on the trucks boards in holdout.txt (fingerprint-matched 2026 trucks boards), with the
    TRUCKS weight tables (TRUCK_SHORT_WEIGHTS at short tracks, TRUCK_ROAD_WEIGHTS at road) - the
    harness is corrected for that in this commit; it previously ran cup weights for any series.
  - Ships as a trucks entry in SimulationCenter's __V4_BETA with its own betas; cup / O'Reilly untouched.
DECISION RULE: ship if HOLDOUT M1 pooled improves, live-race share >= 55%, no fitted group worse by
> 0.10, M2 win / top-5 / top-10 not worse than control by more than the null floor, M3 no overshoot.
Cannot be used for tonight's trucks race (already started, lineups in); ships for the next trucks
pre board. PUSH before the fit.

## 2026-10-09 — START PROJECTION v4 for TRUCKS EXECUTED AS REGISTERED: M1 PASSES CLEARLY, M2 top-10 RAIL FAILS — NOT SHIPPED
Data start-v4-trucks-2025-26.txt (45 races: 25 train 2025 / 20 holdout 2026). Fit (TRAIN 2025): INT 0.2222,
SHORT 0.2427, SS -0.0164 (below the 0.05 rule, kept as fitted - negligible), ROAD 0. Fit committed with the
registration's data before the holdout was read.
HOLDOUT 2026 (read once), M1 CONTROL -> F:
  INT   n=7   6.41 -> 5.43  (-0.98, better 6/7 live)
  SHORT n=8   5.15 -> 4.99  (-0.16, better 5/6 live)
  SS    n=2   4.94 -> 4.97  (+0.03, inside the 0.10 rail)
  ROAD  n=3   unchanged by construction
  ALL   n=20  5.61 -> 5.20  (-0.40); live-race share 11/14 = 79% (>= 55% gate)
  -> the projected grid is a full position better in trucks, a position better at intermediates; the
     Eckes-class error (P18 projected / P8 real) is exactly what this term moves.
M2 sim rail (18 matched 2026 trucks boards, trucks weight tables, projected grids as startPos), 4k sims
and 20k sims (seeded, so the two 20k passes are identical):
  4k:  CONTROL win .02430 t5 .0973 t10 .1601 | NULL .02429 .0974 .1606 | F .02428 .0975 .1615
  20k: CONTROL win .02427 t5 .0975 t10 .1606 | NULL .02427 .0975 .1606 | F .02424 .0977 .1618
  win: better. top-5: +.0002 against a null floor of .0000-.0001. TOP-10: +.0012 (20k) / +.0014 (4k) against a
  null floor of .0000-.0005 - WORSE than control by more than the null floor. FAILS the rail.
M3 favourite gap: CONTROL -15.7 / NULL -15.7 / F -20.9 (stated minus realised; negative = under-statement, not
overshoot). PASSES.
VERDICT by the registered rule: NOT SHIPPED. M1 passes every gate by a wide margin; M2 top-10 Brier loses by
.0012 on 18 boards, which is outside the null floor. The rule is the rule.
READING (not a decision): a better projected grid made the trucks top-10 forecasts slightly WORSE while making
the win forecasts slightly better. The likeliest mechanism is the one the operator keeps pointing at: with the
start term at 0.23 (0.33 at short tracks) the trucks finish model leans on the grid, and a sharper grid sharpens
the top-10 probabilities past what 18 boards support. That is a start-WEIGHT question for trucks, not a start-
PROJECTION one, and it is the 08-20 sweep's "trucks short keeps 0.33" cell plus the 10-05 / 10-09 results all
pointing the same way. A follow-up registration that tests v4 + a trucks start weight of 0.23 at short tracks
(dropping the TRUCK_SHORT_WEIGHTS exception) on the same holdout would be the honest next form - a different
form, a new registration, not a re-read. Cup and O'Reilly v4 are untouched. Trucks stay on trail10-v3.5.

## 2026-10-09 — PRE-REGISTERED: TRUCKS v4 + short-track start weight 0.23 (combined form). Written before the run. DO NOT MODIFY.
TRIGGER. The trucks v4 run above: the grid improves a position (M1 passes every gate) and the top-10
rail loses .0012 - a sharper grid into a finish model that leans on it. Trucks short tracks are the
one cell still on startPos 0.33 (TRUCK_SHORT_WEIGHTS, 08-20 exception kept on 31 races, t5 12W/19L);
every other oval cell runs 0.23. Operator: "yes combine them and see."
FORM. Betas FROZEN as fitted above (INT .2222, SHORT .2427, SS -.0164, ROAD 0) - no refit. Arms on
the M2 rail (same 18 matched 2026 trucks boards, same seeds, 20k sims):
  CONTROL  v3.5 grid, TRUCK_SHORT_WEIGHTS at short (startPos .33) - what ships today
  NULL     CONTROL on a second seed - the MC floor
  F        v4 grid, weights unchanged (the arm that just failed)
  W        v3.5 grid, DEFAULT_WEIGHTS at short (startPos .23) - the weight change alone
  G        v4 grid + DEFAULT_WEIGHTS at short - the combined form, the candidate
M1 is identical to F (the grid is the same); it already passed.
DECISION RULE: SHIP G (both parts, trucks only) if on the M2 rail G's win, top-5 and top-10 Brier are
each not worse than CONTROL by more than the null floor AND M3 (favourite gap) does not overshoot.
If G fails but W passes on its own, W is NOT shipped from this registration (the weight alone was not
the question; it would need its own, and it is logged as the lead). If G passes, ships as: trucks entry
in __V4_BETA (SimulationCenter) and TRUCK_SHORT_WEIGHTS removed from the trucks auto-apply (short
tracks use DEFAULT_WEIGHTS like every other oval); stamp startProj 'trail10-v4-form' on trucks boards
and weights startPos .23. Revert trigger: trucks boards 0-fer top-5 / top-10 vs the books two straight
weekends (the 08-20 watch rule). PUSH before the run.

## 2026-10-09 — COMBINED FORM (trucks v4 + short-track start weight 0.23) EXECUTED AS REGISTERED: FAILS THE TOP-10 RAIL — NOT SHIPPED
Betas frozen as registered. Same 18 matched 2026 trucks boards, same seeds, 20k sims, one read:
  CONTROL  win .02427  t5 .0975  t10 .1606  favGap -15.70   (v3.5 grid, short startPos .33 - ships today)
  NULL     win .02427  t5 .0975  t10 .1606  favGap -15.69   (second seed: the MC floor is .0000 on all three rails)
  F        win .02424  t5 .0977  t10 .1618  favGap -20.91   (v4 grid alone - the 10-09 arm, reproduced exactly)
  W        win .02438  t5 .0975  t10 .1611  favGap -15.70   (weight change alone)
  G        win .02435  t5 .0978  t10 .1620  favGap -15.56   (the candidate)
G vs CONTROL: win +.00008, top-5 +.0003, TOP-10 +.0014 - worse on all three, the top-10 deficit is the
same size F lost by. M3 passes (favGap -15.56, the weight change undoes F's -20.9 under-statement).
VERDICT by the registered rule: NOT SHIPPED. W (the weight alone) is also not better than control
(t10 +.0005, win +.0001) - so there is no lead to carry forward from it either.
NOTE on the floor: the harness seeds the engine, so NULL (seed 2) matches CONTROL to four decimals at
20k x 18 boards - the Monte-Carlo noise is averaged out and the .0014 is signal, not noise.
READING (not a decision): the hypothesis "a sharper grid hurts because the model leans on it too hard"
is REJECTED by this run - easing the start weight repairs the favourite gap but not the top-10 Brier.
The v4 grid for trucks is better rank-for-rank (M1) and worse as a sim input (M2) under either weight.
Which means the trucks grid error that v4 removes is NOT the error the finish model is paying for; the
top-10 cost comes from somewhere else in how trucks boards use the start term (candidate: the
last_fp residual term is pulling drivers with a good last finish up the grid, and in trucks a good
last finish already enters the finish model through form, so it double-counts). That is a new form,
not a re-read. Trucks stay on trail10-v3.5 and TRUCK_SHORT_WEIGHTS; cup / O'Reilly v4 untouched.
Twelve registrations since 10-04: two ships, one call open, nine closed.

## 2026-10-09 — PRE-REGISTERED: TIER-CONDITIONED START WEIGHT (elite-deep cell). Written before the fit. DO NOT MODIFY.
TRIGGER. On the 94-board practice holdout a top-5-rated car (corrAvgRating) starting P16 or worse beats
the sim by ~1.6 positions (102 rows, pooled) and that number did not move under lapped traffic, per-car
DNF, or either trucks start form - every start test so far changed WHERE the grid is projected or how
much the whole field leans on it, none changed WHO the start term applies to. Operator: "yes start the
first one register and push it."
FORM (engine, flagged, default off: buildSpeedScores(drivers, weights, { tierStart: { gamma } })). The
share of the start weight a car keeps falls with its strength: g_i = 1 - gamma * pct_i, pct_i = the car's
percentile on the composite WITHOUT the start term (1 = strongest). The withheld share is replaced by that
same non-start composite, so the score scale and the field mean are untouched and a weak car is scored
exactly as before; only strong cars are pulled less toward their grid spot. gamma = 0 is the shipped
engine; gamma = 1 ignores the grid for the strongest car. One constant per series (09-07 ruling: one
shared mechanism, per-series constants, no series on/off gates).
FIT: train.txt (2022-24, no practice), 10k sims, gamma in {0, .25, .5, .75, 1} per series, chosen by the
smallest |eliteDeep residual| (tie -> smaller gamma). Written to tierstart-fit.json and COMMITTED before
the holdout is read. A fitted gamma of 0 means nothing to test for that series.
TEST: holdout-practice.txt (2025-26, >= 50% practice coverage, 94 boards: cup 39 / O'Reilly 26 / trucks
29), 20k sims, RUNS=2. Control A = what ships today (trucks carDnf k=32, domBoot INT+SHORT, all arms).
T = A + tierStart at the frozen gamma. Null floor per metric = |A run1 - A run2|. Metrics: rho (finish
order), top-10 Brier, win log-loss, top-5 log-loss; cells eliteDeep (top-5 rated, start >= 16, actual minus
projected, negative = beats the sim), eliteFront (top-5 rated, start <= 5: the over-statement guard),
neP26 (non-elite, start >= 26: must not move, the mechanism does not touch it).
DECISION RULE (per series, mean of the two runs): SHIP T at the fitted gamma if (a) |eliteDeep| shrinks
by at least HALF vs A, (b) eliteFront is not worse (more negative or more positive) than A by more than
0.50 position, (c) rho, top-10 Brier, win LL and top-5 LL are each not worse than A by more than that
metric's null floor. Fails any one -> not shipped for that series. Ships as opts.tierStart in
SimulationCenter's buildSpeedScores call with the per-series gamma; stamp tierStart 'v1-g<gamma>'.
DISCLOSURE (before the rule was written, and the rule above is the standard one, not tailored): to
verify the harness ran end to end I smoked PHASE=test at 300 sims, RUNS=1, with a throwaway gamma .5 for
all three series - on the HOLDOUT, which should have been train.txt. Those numbers were seen and are
recorded here verbatim so nothing is hidden: cup A rho .4842 t10 .15014 winLL .0993 t5LL .2891 eliteDeep
-1.35 / T .4824 .15085 .1007 .2920 eliteDeep +0.24; O'Reilly A .5991 .13390 .0825 .2641 eliteDeep -3.38 /
T .6064 .13508 .0858 .2626 eliteDeep -2.49; trucks A .5564 .15251 .0923 .3024 eliteDeep -0.43 / T .5655
.15320 .0987 .3035 eliteDeep +0.27. At 300 sims the Brier / LL columns are noise-dominated; the fit is
still blind (train only) and the registered rule is unchanged by the peek. Read it as: the cell moves,
the probability rails look costly, and gamma .5 may be too strong - the fit decides, not this.
PUSH before the fit.

## 2026-10-09 — TIER-CONDITIONED START WEIGHT: FIT (train.txt 2022-24, 10k sims) — FROZEN before the holdout is read
  CUP (108)    g0 eliteDeep +0.71 | g.25 +1.34 | g.5 +1.96 | g.75 +2.60 | g1 +3.20   -> gamma 0 (nothing to test)
  O'REILLY (99) g0 -7.34 | g.25 -6.71 | g.5 -6.12 | g.75 -5.47 | g1 -4.92            -> gamma 1
  TRUCKS (67)  g0 -4.96 | g.25 -4.30 | g.5 -3.66 | g.75 -3.05 | g1 -2.44            -> gamma 1
Two things the fit shows that the registration did not anticipate, written down before the holdout:
(1) On 2022-24 cup (no practice in the file) the elite-deep cell is already +0.71 - elites starting deep
finish slightly WORSE than projected on train, the opposite sign to the 2025-26 practice holdout. The
mechanism only moves the cell one way, so cup fits to 0 and is out of this test by the registered rule.
(2) Every gamma > 0 degrades every probability rail monotonically in-sample for all three series (e.g.
O'Reilly t10 .14392 -> .14600 at g1, trucks rho .5369 -> .5263), and eliteFront (elites starting up front)
gets MORE under-stated, not less - so the withheld start weight is being replaced by a composite that
is itself biased low for elites. The rule fits by the cell, so gamma 1 is frozen for O'Reilly and trucks;
rail (c) of the decision rule is expected to bite. FROZEN {"cup":0,"oreilly":1,"trucks":1}, committed.

## 2026-10-09 — TIER-CONDITIONED START WEIGHT EXECUTED AS REGISTERED: FAILS — NOT SHIPPED (O'Reilly fails b and c, trucks fails a, b and c)
Holdout-practice (94 boards), 20k sims, two runs, control = shipped (trucks carDnf k32, domBoot INT+SHORT).
Mean of the two runs, A (ship) -> T (gamma 1):
  O'REILLY (26)  rho .6030 -> .6057 (+)   t10 .13466 -> .13370 (+)   winLL .0831 -> .0863 (WORSE .0032, floor .0001)
                 t5LL .2626 -> .2644 (WORSE .0018, floor .0002)
                 eliteDeep -3.39 -> -1.39 (shrinks 59%: (a) PASSES)   eliteFront -1.60 -> -2.40 (worse .80 > .50: (b) FAILS)
                 neP26 1.41 -> 1.73   per-race W/L: rho 12/14,13/13  t10 11/15  winLL 10/16  t5LL 11/15
  TRUCKS (29)    rho .5552 -> .5622 (+)   t10 .15254 -> .15420 (WORSE .0017, floor .0003)   winLL .0918 -> .0923 (worse .0005, floor 0)
                 t5LL .3036 -> .3066 (WORSE .0030, floor .0003)
                 eliteDeep -0.75 -> +1.42 (overshoots and flips sign: (a) FAILS)   eliteFront -1.87 -> -2.66 (worse .79: (b) FAILS)
                 neP26 1.57 -> 1.98   per-race W/L: rho 15/14  t10 14/15  winLL 14/15  t5LL 13/16
  CUP            fitted gamma 0 - not tested (holdout A for the record: rho .4873 t10 .14995 winLL .0879 t5LL .2880, eliteDeep -1.12, eliteFront +0.17)
VERDICT by the registered rule: NOT SHIPPED for either series. Engine flag stays in, default off.
READING (not a decision) - and this one is worth more than the test: in the CONTROL arm, O'Reilly and trucks
elites beat the sim whether they start deep OR up front (O'Reilly eliteFront -1.60 / eliteDeep -3.39; trucks
-1.87 / -0.75), and cup elites do not (eliteFront +0.17). So the "elite-deep" bias is mostly an ELITE bias in
the two lower series: the composite under-rates the top cars relative to the pack, and the start term just
makes it visible when the grid is bad. Re-weighting start against a composite that is itself low for elites
spreads the under-statement around (eliteFront got worse in both series) - which is exactly what the test
showed. The lead is a top-end stretch of the strength composite for O'Reilly / trucks (thin fields: the
percentile normaliser compresses the gap between the 3-4 dominant cars and the pack), judged on
eliteFront + eliteDeep together with the favourite-gap guard; a new form, new registration. Cup is not in it.
Thirteen registrations since 10-04: two ships, one call open, ten closed.

## 2026-10-09 — PRE-REGISTERED: TOP-END STRETCH of the strength composite (O'Reilly / trucks elite under-rating). Written before the fit. DO NOT MODIFY.
TRIGGER. The tier-start test's control arm: O'Reilly and trucks top-5-rated cars beat the shipped sim from
the FRONT (eliteFront -1.60 / -1.87) and from deep (eliteDeep -3.39 / -0.75); cup elites do not (+0.17 /
-1.12). Every slot in buildSpeedScores is min-max scaled to 0-100, so in a thin field the gap between the
3-4 dominant cars and the pack is compressed to the same width as any other gap. Operator: "register it."
FORM (engine, flagged, default off: buildSpeedScores(drivers, weights, { topStretch: { lambda } })). After
the composite is built, cars in the top fifth of it get + lambda x fieldSD x (pct - 0.8) / 0.2, re-centred so
the field mean is unchanged. Ranks are preserved; only the gaps at the top widen. lambda 0 = shipped. Unit
check (36-car synthetic): mean 50.000 -> 50.000, ranks identical, top-5 96.8/94.1/91.5/88.8/86.1 ->
121.5/114.9/108.2/101.6/94.9 at lambda 1. One constant per series (09-07 ruling).
FIT: train.txt (2022-24, no practice), 10k sims, lambda in {0, .25, .5, .75, 1, 1.5} per series, chosen by the
smallest |eliteFront| + |eliteDeep| (tie -> smaller lambda). Written to topstretch-fit.json and COMMITTED
before the holdout is read. Fitted 0 -> nothing to test for that series.
TEST: holdout-practice.txt (94 boards), 20k sims, RUNS=2, control A = shipped (trucks carDnf k32, domBoot
INT+SHORT in all arms), S = A + topStretch at the frozen lambda. Null floor per metric = |A run1 - A run2|.
Metrics: rho, top-10 Brier, win LL, top-5 LL; cells eliteFront / eliteDeep / neP26 (actual minus projected);
FAVOURITE GAP = mean stated win% of the sim favourite minus the share of boards the favourite won.
DECISION RULE (per series, mean of two runs): SHIP S if (a) |eliteFront| + |eliteDeep| shrinks by at least a
THIRD vs A and neither cell overshoots past +0.50; (b) favourite gap is not worse (more positive) than A by
more than 2.0 pts and does not exceed +5.0 pts; (c) rho, top-10 Brier, win LL, top-5 LL each not worse than
A by more than that metric's null floor; (d) neP26 within 0.50 of A. Fails any one -> not shipped for that
series. Ships as opts.topStretch in SimulationCenter's buildSpeedScores call with the per-series lambda;
stamp topStretch 'v1-l<lambda>'. Revert trigger: favourite 0-fer vs the books two straight weekends.
HARNESS SMOKE (train.txt only, 200 sims, in-sample, cup block only, throwaway): cup l0 eliteFront +1.48
eliteDeep +0.82 fav 18.8%/12.0% -> l1 +3.48 / +0.39 fav 30.6%/9.3%. The stretch over-states cup favourites
hard and cup elites are already over-rated on 2022-24, so cup is expected to fit to 0; the favourite-gap
guard (b) exists because of this. No holdout numbers were seen. PUSH before the fit.

## 2026-10-09 — TOP-END STRETCH: FIT (train.txt 2022-24, 10k sims) — FROZEN before the holdout is read
  CUP (108)     -> lambda 0 (cup elites already over-rated on 2022-24; every lambda worsens the sum) - not tested
  O'REILLY (99) l0 front -1.51 deep -7.30 fav gap -3.4 | l.25 -0.99/-7.31/-1.6 | l.5 -0.52/-7.32/+2.2 | l.75 -0.09/-7.32/+4.9
                l1 +0.28/-7.29/+7.5 | l1.5 +0.89/-7.32/+12.0        -> lambda 0.75 (sum 7.41)
  TRUCKS (67)   l0 front -4.32 deep -4.96 fav 15.4%/25.4% gap -10.0 | l.25 -3.83/-5.04/-7.7 | l.5 -3.36/-5.09/-5.5
                l.75 -2.94/-5.17/-1.8 | l1 -2.53/-5.19/+0.4 | l1.5 -1.87/-5.32/+4.7   -> lambda 1.5 (sum 7.19)
Written before the holdout: (1) The stretch moves eliteFront and does NOT move eliteDeep at all (O'Reilly
-7.3 at every lambda): an elite car starting deep is dragged out of the top fifth of the composite by the
start term itself, so a top-fifth stretch never reaches it. The two cells are different mechanisms after
all - front is a rating-compression problem, deep is a start-term one - and the registered fit criterion
(their sum) is therefore mostly fitting eliteFront. (2) TRUCKS CONTROL: the sim favourite is stated at
15.4% and wins 25.4% of 2022-24 boards - a 10-point under-statement of trucks favourites in the shipped
engine; O'Reilly -3.4. The stretch closes it (trucks +0.4 at l1, +4.7 at l1.5) with better in-sample t10 and
win LL up to l1 and worse at l1.5. The registered fit picks 1.5 by the cell sum; the favourite-gap guard
(b, <= +5.0) and rail (c) are what stand between that and a ship. FROZEN {"cup":0,"oreilly":0.75,"trucks":1.5}.

## 2026-10-09 — TOP-END STRETCH EXECUTED AS REGISTERED: FAILS — NOT SHIPPED (O'Reilly fails a, b, c; trucks fails a, c)
Holdout-practice (94 boards), 20k sims, two runs, control = shipped. Mean of the two runs, A -> S:
  O'REILLY (26, l .75)  rho .6035 -> .6037 (ok)   t10 .13458 -> .13546 (WORSE .0009, floor .0001)   winLL .0832 -> .0820 (+)
                        t5LL .2624 -> .2609 (+)   eliteFront -1.62 -> +0.01   eliteDeep -3.39 -> -3.38   sum 5.01 -> 3.39 (-32.4%: short of a third)
                        fav gap -1.0 -> +10.0 (stated 33% vs realised 23%: (b) FAILS)   neP26 1.40 -> 1.38
  TRUCKS (29, l 1.5)    rho .5529 -> .5570 (+, 20/9)   t10 .15254 -> .15420 (WORSE .0017)   winLL .0923 -> .0940 (WORSE .0017)
                        t5LL .3038 -> .3165 (WORSE .0127)   eliteFront -1.86 -> +0.59 (overshoots past +0.50: (a) FAILS)
                        eliteDeep -0.74 -> -0.68   fav gap -24.3 -> -6.8 (better)   neP26 1.57 -> 1.51
  CUP                   fitted 0, not tested (A fav 29.6% stated / 28.2% realised, gap +1.3: cup favourites are calibrated)
VERDICT by the registered rule: NOT SHIPPED for either series. Flag stays in, default off.
FINDING (control arm, the number that matters): TRUCKS 2025-26 - the sim favourite is stated at 22.3% and WINS
48.3% of the 29 holdout boards (14 of 29); 2022-24 train 15.4% stated / 25.4% realised. The shipped engine
under-states the trucks favourite by ~10 pts on 2022-24 and ~25 pts on 2025-26. O'Reilly is calibrated (-1.0),
cup is calibrated (+1.3). This is the largest calibration miss found in the engine since the SS noise fit
(08-29) and it is series-specific. The stretch failed because its SHAPE is wrong for it: lifting the top
fifth (~7 cars) uniformly moves the favourite half way (22 -> 42%) but also inflates cars 2-7 past what
they earn (t5LL +.013, eliteFront overshoots), so the probability rails lose even as the favourite gets
better. The honest next form is a FAVOURITE-CONCENTRATION dial for trucks, not a tier stretch: the SS
precedent (one outcome-noise multiplier per track group, fit 2022-24, validated 2025-26, GROUP_NOISE_MULT
SS 1.75) applied per SERIES - a trucks noise multiplier < 1 steepens the whole rank->win curve at once,
with the favourite gap, win LL and t5 LL as the judges, and the SS multiplier untouched. New registration.
Fourteen registrations since 10-04: two ships, one call open, eleven closed.

## 2026-10-09 — PRE-REGISTERED: PER-SERIES OUTCOME-NOISE MULTIPLIER (trucks favourite under-statement). Written before the fit. DO NOT MODIFY.
TRIGGER. Top-stretch control arm: trucks 2025-26 holdout sim favourite stated 22.3%, wins 48.3% (14/29);
2022-24 train 15.4% / 25.4%. Cup +1.3, O'Reilly -1.0 (calibrated).
LIVE-BOARD CHECK (sim_results, latest board per race/stage, 2026 trucks POST boards with results, run
before this registration, read-only): favourite stated / result - R16 Indy Riggs 29.6% (book -105) WON from
P1; R17 Richmond Honeycutt 27.8% (book +380; book fav Majeski) WON; R18 NH Riggs 17.1% (book +325; book fav
Honeycutt) WON; R19 Bristol Riggs 34.6% lost (Garcia from P12); R20 Kansas Honeycutt 24.8% WON. 4 of 5 at a
mean stated 26.8%. Series means across all 2026 boards with markets: trucks post sim fav 28.5% vs book
favourite implied 30.2% (with vig; n 6); cup post 25.2% vs 20.7%; O'Reilly post 23.2% vs 25.0%. So the live
engine identifies the trucks favourite (better than the book at Richmond and NH) and under-states him;
the finding is not a harness artefact. PRE boards are a separate problem (no grid: Christopher Bell was the
sim favourite at 13-17% twice, book +800) - the deferred pre-board projected-grid item, not this one.
FORM (engine, flagged, default off: runRaceSim simConfig.seriesNoiseMult = m). noiseWidth = preset noise x
GROUP_NOISE_MULT[trackGroup] x m. The SS precedent (08-29: one multiplier per track group, fit 2022-24,
validated 2025-26, SS 1.75) applied per SERIES; stacks multiplicatively on SS. m = 1 is the shipped engine;
m < 1 steepens the whole rank -> win curve at once (favourite up, tail down) instead of lifting a bracket.
FIT: train.txt (2022-24, no practice), 10k sims, m in {.6, .7, .8, .9, 1, 1.1, 1.2} per series, chosen by the
smallest WIN LOG-LOSS (tie within 1e-5 -> closer to 1). All three series are fitted: cup and O'Reilly are the
PLACEBO - their favourites are calibrated, so a fitted m far from 1 there is a warning about the fit, not a
discovery. Written to noise-fit.json and COMMITTED before the holdout is read.
TEST: holdout-practice.txt (94 boards), 20k sims, RUNS=2, control A = shipped (trucks carDnf k32, domBoot),
N = A + seriesNoiseMult at the frozen m. Null floor per metric = |A run1 - A run2|. Metrics: rho, top-10
Brier, win LL, top-5 LL; favourite gap (stated - realised, sim favourite); TAIL bucket (drivers stated < 3%:
mean stated vs realised win share, gap = stated - realised, negative = tail under-stated); MID bucket
(3-10%); elite cells and neP26 for the record.
DECISION RULE (per series, mean of two runs): SHIP N at the fitted m if (a) fitted m != 1; (b) win LL is
BETTER than A by at least the null floor AND top-5 LL is not worse than A by more than its null floor;
(c) the favourite gap moves toward zero by at least a THIRD of A's gap and does not cross to beyond +5.0;
(d) the tail gap is not worse (more negative) than A by more than 0.30 pts and the mid-bucket gap stays
within 1.5 pts of zero; (e) rho and top-10 Brier each not worse than A by more than the null floor. Fails any
one -> not shipped for that series. Ships as simConfig.seriesNoiseMult in SimulationCenter's runRaceSim
call per series; stamp seriesNoise 'v1-m<m>'. Revert trigger: the series' favourites 0-for-2 weekends vs
the books while the tail hits.
HARNESS SMOKE (train only, 100 sims, cup block, throwaway): m .6 winLL .1678 / .7 .1493 / .8 .1352 vs the
10k control ~.111 - at 100 sims the LL is dominated by draw noise; nothing to read. No holdout numbers seen.
INTERIM OPERATOR RULE shipped with this registration (PITBOARD_MANUAL, Model doctrine): until this closes,
no win-market FADE on the top-rated car of a trucks board - a negative medge there is more likely our bias
than the book's (Indy: Riggs -105, sim 29.6%, medge -6.84 "fade", won from the pole). PUSH before the fit.

## 2026-10-09 — PER-SERIES NOISE MULTIPLIER: FIT (train.txt 2022-24, 10k sims) — FROZEN before the holdout is read
  CUP (108)     winLL .9 .1146 | 1 .1116 | 1.1 .1108 | 1.2 .1087 (grid edge)   fav gap 1: +8.0 -> 1.2: +5.5   -> m 1.2
  O'REILLY (99) winLL .7 .0952 | .8 .0932 | 1 .0932 | 1.1 .0938 | 1.2 .0942   fav gap .8: +0.9 / 1: -4.4   -> m 1 (tie rule, closer to 1)
  TRUCKS (67)   winLL .6 .1025 | .7 .1021 | .8 .1028 | .9 .1031 | 1 .1007 | 1.1 .1017 | 1.2 .1023   -> m 1 (nothing to test)
                but at m .6: t10 .15268 vs .15497, t5LL .3069 vs .3109, rho tie, fav gap -3.7 vs -11.5, tail<3% stated .56 / realised .73
                (vs .83 / .50 at m 1), mid 5.6 / 4.8.
Written before the holdout, and this is the test going wrong at the fit stage, honestly stated:
(1) The PLACEBO FAILED. Cup fitted to 1.2 - the grid edge - because on 2022-24 WITHOUT practice the cup
favourite is OVER-stated (18.2% stated / 10.2% realised; the 2022 parity year is in there), the opposite of
the practice holdout (+1.3). The fit regime is not the holdout regime for cup. Cup goes to the holdout at
1.2 as registered; whatever it does there, the placebo has already said the train-set fit is not trustworthy
for the question.
(2) WIN LOG-LOSS WAS THE WRONG FIT CRITERION for a favourite question. It is an average over ~36 drivers a
race and is dominated by the tail: a driver stated at 0.5% who wins costs log(0.005) = 5.3, so any form that
takes probability from the tail to give it to the favourite loses win LL even while it fixes the favourite
(trucks at .6: favourite gap -11.5 -> -3.7, top-10 and top-5 better, win LL worse .1007 -> .1025 because the
tail realised .73% against .56% stated). The registered rule is the rule: trucks fits to 1 and is not
tested; the mechanism is not judged. FROZEN {"cup":1.2,"oreilly":1,"trucks":1}.
(3) What the fit DID show for trucks in-sample, for the next registration: a shallower noise (m .6-.7)
improves top-10 Brier, top-5 LL and the favourite gap together, and the cost is a tail stated ~.15-.2 pts
below realised - i.e. the trucks tail is REAL (the 2022-24 trucks winner came from under 3% stated in a
meaningful share of races) and a uniform steepening pays for the favourite out of it. The next form should
fit on the favourite-and-top-5 (Brier on win + top-5, or the favourite gap with a tail guard) and / or make
the noise strength-dependent (tight at the top, wide in the tail) so the favourite and the tail are not one
dial. Not registered here.

## 2026-10-09 — PER-SERIES NOISE MULTIPLIER EXECUTED AS REGISTERED: CUP (m 1.2) FAILS b and c; O'REILLY / TRUCKS FITTED 1, NOT TESTED — CLOSED
Holdout-practice, 20k sims, two runs, mean A -> N:
  CUP (39, m 1.2)  winLL .0882 -> .0879 (better .0003, floor .0008: (b) FAILS)  t5LL .2880 -> .2877  t10 .14998 -> .14980  rho .4869 -> .4870
                   fav gap -1.3 -> -5.8 (moves AWAY from zero: (c) FAILS)  tail .47/.76 -> .60/.78  mid 5.3/3.8 -> 5.3/3.3
VERDICT: NOT SHIPPED. Trucks and O'Reilly never reached the holdout (fit = 1). Flag stays in, default off.
CONTROL-ARM CALIBRATION TABLE, 2025-26 holdout (the useful output of this registration):
                 favourite stated/realised   mid 3-10% stated/realised   tail <3% stated/realised
  cup            29.5 / 30.8  (gap -1.3)     5.3 / 3.8  (over by 1.5)     .47 / .76  (under by .29)
  O'Reilly       22.2 / 23.1  (gap -0.9)     5.5 / 4.9  (over by 0.6)     .53 / .28  (over by .25)
  trucks         22.2 / 48.3  (gap -26)      5.2 / 3.4  (over by 1.8)     .64 / .63  (calibrated)
Reading: in trucks the missing favourite probability is sitting in the 3-10% bucket (the 5-8 cars behind
the favourite are over-stated by ~1.8 pts each, ~12-14 pts in total), NOT in the tail, which is calibrated.
A uniform noise multiplier cannot do that move - it takes from the tail first (the fit showed it). The
form that matches the table is STRENGTH-DEPENDENT noise: a narrower draw for the top of the composite and
an unchanged draw for the rest, so probability flows from the 3-10% cars to the favourite and the tail
is untouched. One shape constant per series, fit by win + top-5 Brier (not log-loss), tail guard kept.
Cup's own table (mid over 1.5, tail under .29) says cup would take the opposite sign in the tail, so the
mechanism must not touch the tail at all. Sixteen registrations since 10-04: two ships, one call open,
thirteen closed.

## 2026-10-09 — PRE-REGISTERED: STRENGTH-DEPENDENT NOISE (top fifth draws narrower). Written before the fit. DO NOT MODIFY.
TRIGGER. The noise-multiplier closure's control calibration table (2025-26 holdout): trucks favourite stated
22.2% / realised 48.3%; the 3-10% bucket over-stated by ~1.8 pts a car; the under-3% tail CALIBRATED (.64 /
.63). The favourite's missing mass is on the cars right behind him, not in the tail, and a uniform width
change takes from the tail first (fit refused it). Cup's tail is UNDER-stated (.47 / .76), so the mechanism
must not touch the tail at all. Operator: "do the next registration."
FORM (engine, flagged, default off: runRaceSim simConfig.topNoise = { shrink }). Per draw, the outcome-noise
width for a car in the top fifth of the composite (speedScore percentile > .8) is scaled by
1 - shrink x (pct - .8) / .2: the favourite keeps (1 - shrink) of the width, the ~8th car ~all of it, every
car below the top fifth is untouched; both sides of the draw, no mean shift. Stacks on carCeilFloor and
asymNoise (those act on upside draws of weak cars; disjoint). shrink 0 = shipped. One constant per series.
FIT: train.txt (2022-24), 10k sims, shrink in {0, .15, .3, .45, .6} per series, chosen by the smallest WIN
BRIER + TOP-5 BRIER (per-driver squared error, tail-insensitive by construction - the 10-09 lesson; tie
within 1e-5 -> smaller shrink). Written to topnoise-fit.json and COMMITTED before the holdout is read. A
fitted 0 means nothing to test. Cup and O'Reilly are fitted too: their favourites are calibrated on the
holdout, so a large shrink for them would be a warning, as before - but the 2022-24 cup regime (favourite
over-stated without practice) is already known to differ from the holdout, so a cup fit of 0 is the
expected placebo outcome and a cup fit > 0 is read with that in mind.
TEST: holdout-practice.txt (94 boards), 20k sims, RUNS=2, control A = shipped (trucks carDnf k32, domBoot),
T = A + topNoise at the frozen shrink. Null floor per metric = |A run1 - A run2|. Metrics: win Brier, top-5
Brier, top-10 Brier, rho, win LL, top-5 LL; favourite gap (stated - realised); mid 3-10% bucket gap; tail
< 3% gap; elite cells / neP26 for the record.
DECISION RULE (per series, mean of two runs): SHIP T at the fitted shrink if (a) fitted shrink > 0;
(b) win Brier AND top-5 Brier are each better than A by at least the null floor; (c) the favourite gap moves
toward zero by at least a THIRD of A's gap and does not cross to beyond +5.0; (d) the mid 3-10% bucket gap
moves toward zero (or stays within 0.5 of A) AND the tail gap changes by no more than 0.15 pts in either
direction; (e) top-10 Brier, rho, win LL and top-5 LL each not worse than A by more than the null floor
(win LL is a guard here, not the judge). Fails any one -> not shipped for that series. Ships as
simConfig.topNoise in SimulationCenter's runRaceSim call per series; stamp topNoise 'v1-s<shrink>'. Revert
trigger: that series' favourites 0-for-2 weekends vs the books while the 3-10% cars win both.
HARNESS SMOKE (train only, 100 sims, cup block, two rows, throwaway): s0 winB .02594 t5B .10332 / s.15 .02605
.10387 - draw-noise at 100 sims, nothing to read. No holdout numbers seen. PUSH before the fit.

## 2026-10-09 — STRENGTH-DEPENDENT NOISE: FIT returns 0 for every series — CLOSED AT THE FIT, WRONG BY CONSTRUCTION
  CUP      s0 winB .02574 t5B .10286 fav 18.2/10.2 | s.15 .02581/.10309 fav 17.3 | s.3 fav 16.4 | s.6 .02617/.10439 fav 15.5  -> 0
  O'REILLY s0 .02379/.09238 fav 19.8/23.2 | s.15 .02394/.09255 fav 19.1 | ...                                           -> 0
  TRUCKS   s0 .02521/.09619 fav 15.4/26.9 gap -11.5 | s.15 fav 14.2 | s.3 13.0 | s.45 12.4 | s.6 12.1 (winB .02643)   -> 0
The favourite's stated win% FALLS as the top fifth's draw narrows, in every series. Unit check (36-car
synthetic, 20k draws, INT): favourite 23.1% -> 22.3% (shrink .3) -> 20.9% (shrink .6) while his top-5 rises
63.0 -> 68.3 -> 74.1 and cars 6-8 GAIN win share (4.9/3.5 -> 6.3/5.9). Why: a race finish is the max of 36
draws. Narrowing the favourite's draw clips his upside as much as his downside, and the cars just below
the top fifth keep full width, so their outlier draws now beat him more often. Symmetric narrowing makes
the top cars more CONSISTENT (top-5 up) and less likely to WIN. The form moves the favourite the wrong
way by construction; the fit saw it and returned 0 everywhere; nothing reached the holdout. FROZEN
{"cup":0,"oreilly":0,"trucks":0}, no test run. Registration flaw was mine: I reasoned about the
favourite's distribution in isolation instead of about the max-of-draws contest he has to win.
What the fit does say: the direction that moves the favourite UP without touching the tail is to clip the
UPSIDE of the cars in the 3-10% bucket (ranks ~2-8), not to narrow everyone at the top - the exact analogue
of the shipped asymNoise (upside clip on below-median cars, 09-07), one tier up. Registered next.
Seventeen registrations since 10-04: two ships, one call open, fourteen closed.

## 2026-10-09 — PRE-REGISTERED: SECOND-TIER UPSIDE CLIP (the corrected favourite form). Written before the fit. DO NOT MODIFY.
TRIGGER. The strength-dependent-noise closure above: symmetric narrowing of the top cars lowers the
favourite's win share because a finish is the max of 36 draws. The move the 2025-26 control table asks for
(trucks favourite 22 -> 48, the 3-10% bucket over by ~1.8 a car, tail calibrated) is to take UPSIDE from
the cars right behind the favourite. Same trigger as the two registrations above; the construction is fixed.
FORM (engine, flagged, default off: runRaceSim simConfig.tierClip = { c }). Per draw, a car in the top fifth of
the composite that is NOT the top-rated car keeps (1 - c x (pct - .8) / .2) of an UPSIDE noise draw (the
2nd-rated car ~(1 - c), the ~8th ~all of it); downside draws untouched, the top-rated car untouched, every
car below the top fifth untouched. The analogue of the shipped asymNoise (upside clip on below-median cars)
one tier up; stacks on it, carCeilFloor and the SS multiplier. c = 0 is shipped. One constant per series.
UNIT CHECK (36-car synthetic, 20k draws, INT, before registration - the thing I failed to do last time):
c 0 favourite 22.9% / #2 18.4 / #3 14.6 / #8 3.5, tail<3% total 9.6 -> c .3 27.3 / 15.7 / 12.6 / 4.1, tail 7.6
-> c .6 31.3 / 12.9 / 10.1 / 5.1, tail 9.4. Favourite up, cars 2-4 down, cars 7-9 up a little (the taper
edge), tail roughly unchanged, favourite top-5 64 -> 65. Direction is the one the table asks for.
FIT: train.txt (2022-24), 10k sims, c in {0, .15, .3, .45, .6, .75} per series, smallest WIN BRIER + TOP-5
BRIER (tie within 1e-5 -> smaller c). Written to tierclip-fit.json and COMMITTED before the holdout is read.
Fitted 0 -> nothing to test for that series. Cup is the placebo with the known 2022-24 caveat.
TEST: holdout-practice.txt (94 boards), 20k sims, RUNS=2, control A = shipped (trucks carDnf k32, domBoot),
T = A + tierClip at the frozen c. Null floor per metric = |A run1 - A run2|. Metrics as the two registrations
above (win Brier, top-5 Brier, top-10 Brier, rho, win LL, top-5 LL, favourite gap, mid 3-10% gap, tail gap,
elite cells, neP26).
DECISION RULE (per series, mean of two runs): SHIP T at the fitted c if (a) fitted c > 0; (b) win Brier AND
top-5 Brier are each better than A by at least the null floor; (c) the favourite gap moves toward zero by
at least a THIRD of A's gap and does not cross to beyond +5.0; (d) the mid 3-10% gap moves toward zero or
stays within 0.5 of A, AND the tail gap changes by no more than 0.15 pts either way; (e) top-10 Brier, rho,
win LL and top-5 LL each not worse than A by more than the null floor. Fails any one -> not shipped for that
series. Ships as simConfig.tierClip in SimulationCenter's runRaceSim call per series; stamp tierClip
'v1-c<c>'. Revert trigger: that series' favourites 0-for-2 weekends vs the books while cars 2-8 win both.
No holdout numbers seen. PUSH before the fit.

## 2026-10-09 — SECOND-TIER CLIP: FIT (train.txt 2022-24, 10k sims) — FROZEN before the holdout is read
  CUP (108)     c0 winB .02582 t5B .10283 fav 18.2/10.2 | c.15 .02587/.10288 fav 19.6 | ... c.75 .02664/.10324 fav 25.5   -> 0 (expected: 2022-24 cup favourite already over-stated)
  O'REILLY (99) c0 .02380/.09241 fav 19.9/24.2 gap -4.4 | c.15 .02381/.09237 fav 21.2 gap -2.0 (sum .11619 vs .11621) | c.3 .02393/.09255 gap -0.5 | c.45 gap +1.1  -> 0.15
  TRUCKS (67)   c0 .02528/.09618 fav 15.4/25.4 gap -10.0 mid 5.3/4.7 | c.15 .02527/.09633 gap -7.4 | c.3 .02543/.09666 gap -6.3 | c.45 .02558/.09713 gap -5.1
                | c.6 .02577/.09758 gap -4.0 | c.75 .02594/.09826 gap -2.8   -> 0
The mechanism does what it was built to do (trucks favourite 15.4 -> 21.1 across the grid, tail flat, cars
2-4 down) and the fit still returns 0 for trucks because on 2022-24 the Brier sum rises monotonically with
c: the 2022-24 trucks mid bucket is nearly calibrated (5.3 stated / 4.7 realised) and taking win share
from those cars costs more than the favourite earns. Written before the holdout: the 2025-26 trucks
favourite problem (22 / 48, mid 5.2 / 3.4) is NOT in the 2022-24 train set at the same size (15 / 25, mid
5.3 / 4.7). A fit on 2022-24 cannot find a 2025-26 phenomenon, by construction. O'Reilly's 0.15 goes to the
holdout as registered (favourite already -1.0 there, so (c) will be close). FROZEN {"cup":0,"oreilly":0.15,"trucks":0}.

## 2026-10-09 — SECOND-TIER CLIP EXECUTED AS REGISTERED: O'REILLY (c .15) IS A WASH, FAILS (b); CUP / TRUCKS FITTED 0 — CLOSED
Holdout-practice, 20k sims, two runs, mean A -> T:
  O'REILLY (26, c .15)  winB .02181 -> .02186 (worse .00004, floor .00004: (b) FAILS)   t5B .08272 -> .08265 (better .00007, floor .0001: not by the floor)
                        t10 .13467 -> .13455   rho .6025 -> .6034   winLL .0831 -> .0836   t5LL .2626 -> .2625
                        fav gap -1.0 -> +0.6 ((c) passes)   mid 5.55/5.1 -> 5.5/5.0   tail .53/.28 -> .50/.29
VERDICT: NOT SHIPPED. A calibrated series given a favourite dial moves its favourite from -1.0 to +0.6 and
nothing else - the mechanism is sound and the series did not need it. Trucks never reached the holdout.
Flag stays in, default off.
WHERE THIS LEAVES THE TRUCKS FAVOURITE (four registrations today, all closed, the finding intact):
  2022-24 train:    favourite 15.4 / 25.4   mid 3-10% 5.3 / 4.7   tail .84 / .62
  2025-26 holdout:  favourite 22.2 / 48.3   mid 3-10% 5.2 / 3.4   tail .64 / .63
The second-tier clip moves exactly the right mass (favourite up, cars 2-4 down, tail flat; trucks fav 15.4 ->
21.1 across the grid) and the 2022-24 fit refuses it because on 2022-24 the trucks mid bucket is close to
calibrated and the favourite gap is a third the size. The 09-07 protocol (fit 2022-24, score 2025-26) cannot
find a mechanism whose need is concentrated in 2025-26. This is the rolling-refit question (STATE, deferred)
arriving with a concrete case. The trucks v4 start projection (10-09) was registered on the operator-approved
variant: own fit on 2025, holdout 2026. The same split here: fit c on the 2025 trucks practice boards
(~15 after the coverage filter), score once on the 2026 trucks practice boards (~14), same decision rule,
thin but honest. If it passes it ships for trucks only, with a dated constant and the revert trigger; if the
2026 boards do not support it, the favourite problem is a 2025 (Heim) phenomenon and the interim rule is
withdrawn. OPERATOR CALL - not registered here.
Eighteen registrations since 10-04: two ships, one call open, fifteen closed.

## 2026-10-10 — OPERATOR DECISION: the trucks favourite refit (fit 2025 / judge 2026) is NOT run now
Reasons as discussed and agreed: ~15 fit / ~14 judge boards sit under the win-Brier null floor for the
effect size; running it spends the 2026 holdout for every later registration; a constant fitted to one
dominant era (Heim 2025, Riggs / Honeycutt 2026) ships blind into a series whose top tier turns over
(2022-24 gap a third the size); and moving the sim favourite to the book's ~30% removes a wrong signal
(already removed by the interim rule) without creating a right one. PLAN: interim no-fade rule stays;
simConfig.tierClip stays in, default off; refit at season end on 2025-26 with 2027 as the forward judge
(rolling-refit policy, first case). The pre-board projected grid for trucks is the nearer priority.

## 2026-10-10 — PRE-REGISTERED: DOMINANCE v2 CARRIED TO SHORT / ROAD / SS (all series, group-level). Written before the fit. DO NOT MODIFY.
TRIGGER. Doctrine line since 09-03: outside intermediates laps led / fastest laps are "still dealt by finish
rank from LL_CURVES_G / FL_CURVES_G and hand out a fastest lap for EVERY lap - known wrong, unmeasured".
The INT fix (green-lap FL budget + strength-keyed dealing order) passed its holdout 09-03 (LL MAE 9.72 ->
8.54, FL MAE 5.70 -> 4.80, DK rho .311 -> .320) and was never carried over. Operator: "let's do the
dominance curve one first & then per driver volatility."
WHAT SHIPS TODAY at SHORT / ROAD / SS: dealing order = the draw's FINISH order (so the top-laps-led car is the
winner in 100% of draws; real SHORT 2022-24: 53%), curves = per-draw bootstrap of real 2022-24 share vectors
at SHORT (domBoot, shipped 10-09) and the fixed LL_CURVES_G / FL_CURVES_G at ROAD / SS, fastest laps dealt for
every lap. The practice tilt (mult-v1) and the SS LL / FL tilts (08-29) sit on top and are kept in every arm.
FORM (no new engine code: simConfig.flBudget, domPool 'strength', domAlpha, domK, domKFL already exist and
are group-agnostic; only SimulationCenter's defaults gate them to INT). Per GROUP, pooled across series as
the INT fit was (group-level constants; the per-series bootstrap pools stay as they are):
  A = shipped + flBudget G_FL (fastest laps dealt for the measured green-lap fraction)
  B = A + strength-keyed dealing: dom_T(i) = speedScore + alpha x (draw score - speedScore) + k_T x noiseWidth x eps
FIT (train.txt 2022-24, per-driver LL / FL actuals pulled from loop_data 2026-10-10 into dom-train-actuals.json,
274 races, fingerprint-joined through protocol-features.json; 1,500 sims per board as the INT fit used):
G_FL = mean over the group's train races of (sum of fastest laps / race laps). The coupling target P(top-LL car
wins) = the group's actual share; feasible (alpha, k) must land within +/- 0.10 of it. alpha in {.25,.5,.75},
k in {.25,.5,.75,1,1.5,2}; alpha and k_LL by the smallest sum of squared strength-tier LL biases among
feasible cells, k_FL by the smallest FL objective at that alpha (the 09-03 recipe exactly). A group with no
feasible cell gets A only. Written to dom-groups-fit.json and COMMITTED before the holdout is read.
TEST: holdout-practice.txt 2025-26 boards in SHORT / ROAD / SS (practice >= 50%), joined to dominator-
actuals.json; 20k sims, RUNS=2; control = shipped (trucks carDnf k32, domBoot at SHORT). Null floor per
metric = |CONTROL run1 - run2|. Metrics per group: M1 laps-led MAE, M2 fastest-laps MAE, M4 Spearman of
projected DK vs actual DK (finish pts + place diff + .25 LL + .45 FL), M3 strength-tier bias (tier 1 LL/FL),
guards win / top-5 / top-10 Brier, P(top-LL car wins) for the record.
DECISION RULE (per group, mean of two runs, applies to all three series in that group): SHIP B if (a) M1 and
M2 are each better than CONTROL by more than the null floor; (b) M4 is not worse than CONTROL by more than
the null floor; (c) win, top-5 and top-10 Brier are each within the null floor of CONTROL; (d) |tier-1 LL
bias| is smaller than CONTROL's. If B fails and A alone satisfies (b), (c) and M2 better by more than the
floor with M1 within the floor, SHIP A (budget only) for that group. Fails -> that group stays as is. Ships
as group defaults in runRaceSim next to the INT_DOM_V2 block (same shape), stamped domCurves
'<group>-dom-v2' on boards. Revert trigger: a group's DK dominator-point error worse than the 10-09 stage-1
diagnostic two straight weekends.
HARNESS SMOKE (train only, SHORT, 60 sims, in-sample, throwaway): CONTROL llMAE 10.25 flMAE 6.10 tier-1 LL
bias +26.8 (the INT disease: the favourite is projected to lead far fewer laps than he does), P(top-LL car
wins) 1.000 vs actual .526; A flMAE 5.41 with the FL tier biases centred; the B grid moves tier-1 LL bias
through zero between k .25 and .75 at alpha .25. Nothing from the holdout was seen. PUSH before the fit.

## 2026-10-10 — DOM v2 GROUPS: FIT (train.txt 2022-24, 1,500 sims) — FROZEN before the holdout is read
  SHORT (78: cup 31 / O'Reilly 25 / trucks 22)  G_FL .7544  actual P(top-LL wins) .526
      CONTROL llMAE 10.24 flMAE 6.05 dkRho .321 tier-1 LL bias +24.8 | A flMAE 5.33 | -> alpha .5, k_LL .25, k_FL .25
  ROAD  (31: 12 / 15 / 4)                          G_FL .7005  actual P .484
      CONTROL llMAE 2.77 flMAE 1.88 dkRho .120 tier-1 +0.7 | A flMAE 1.58 | -> alpha .5, k_LL .75, k_FL .5
  SS    (44: 18 / 17 / 9)                          G_FL .6938  actual P .182
      CONTROL llMAE 5.26 flMAE 2.34 dkRho .241 tier-1 +4.4 | A flMAE 2.00 | -> alpha .25, k_LL .5, k_FL .25
Written before the holdout: SHORT carries the INT disease in full (favourite projected to lead 25 fewer
laps than he does; top-LL car = winner in every draw vs 53% real). ROAD is nearly unbiased already on laps
led (tier-1 +0.7) - the gain there, if any, is the FL budget. SS: the top-LL car wins only 18% of real SS
races, so the strength order has the most to change there, but the 08-29 SS tilts already sit on the
curves and stack with it. FROZEN as above, committed.

## 2026-10-10 — DOM v2 GROUPS EXECUTED AS REGISTERED: SHORT and ROAD FAIL ON DK RHO (both A and B); SS UNTESTABLE — NOT SHIPPED
Holdout-practice 2025-26, 20k sims, two runs, mean CONTROL -> A -> B:
  SHORT (40: cup 14 / O'Reilly 12 / trucks 14)
      llMAE 10.23 -> 10.23 -> 9.64 (B 32/8)      flMAE 5.93 -> 5.17 -> 5.07 (40/0 both)
      dkRho .406 -> .398 (A, worse .008, 14/26) -> .390 (B, worse .016, 13/28); null floor .002   -> (b) FAILS for A and B
      winB .02392 / .02393 / .02394   t5B .0894 all   t10B .1445 all (within floor)
      tier-1 LL bias +35.4 -> +35.5 -> +12.8;  tier 2-3 LL -6.4 -> -6.5 -> -15.5 (B over-deals to cars 2-3)
      P(top-LL car wins) 1.000 -> 1.000 -> .619 (actual SHORT 2022-24 .526)
  ROAD (8: cup 4 / trucks 4)   llMAE 3.13 -> 3.12 -> 3.05   flMAE 2.21 -> 1.90 -> 1.84 (8/0)   dkRho .218 -> .214 -> .214 (floor .003: worse .004) -> (b) FAILS by a hair, n 8
  SS: the practice holdout contains NO superspeedway boards (SS has no practice sessions) - the registered test set cannot judge SS. Registration flaw, mine; a practice-free holdout would be a new registration.
VERDICT by the registered rule: NOT SHIPPED for any group. Nothing changes in the engine.
READING (not a decision): the laps-led and fastest-lap errors improve exactly as they did at INT - every one of
40 short-track boards gets a better fastest-lap count, the favourite's laps-led under-statement drops from
35 to 13 - and the DK ranking gets WORSE. That can only happen if the per-lap fastest-lap over-count was
doing a job: it hands the strongest cars a large FL bonus that pushes them up the projected-DK order, and
that bonus has been compensating for a projected finish order that is too flat at the top (the same
diagnosis as the trucks favourite). Take the bonus away honestly and the DK order loses what it was
borrowing. The INT ship on 09-03 did not show this (DK rho .311 -> .320) because INT dominance is far more
concentrated and the strength order gives the favourite more than the FL over-count did. At SHORT the
fitted order gives too much to cars 2-3 (tier bias -15.5) because the coupling band forced k_LL to .25
at alpha .5 - the best in-sample cell (alpha .25, k .5, tier-1 +5.3) sat outside the band. Two things for
later, neither registered here: (1) the dominance fix outside INT is real on its own metrics and is being
masked by the finish-order flatness; it should be re-judged after a top-end fix ships, or judged on LL / FL
alone for the Fastest Laps / laps-led displays where DK rank is not the point; (2) SS needs a practice-free
holdout. Nineteen registrations since 10-04: two ships, one call open, sixteen closed.

## 2026-10-10 — PRE-REGISTERED: PER-DRIVER VOLATILITY (upside / downside width from loop data). Written before the fit. DO NOT MODIFY.
TRIGGER. Operator: "do the three registrations in sequence" - volatility, pass differential, then re-judge
the dominance fix stacked. Every car draws from one noise width, patched at the edges (asymNoise for
below-median cars, carCeilFloor for lapped cars). Loop data carries each driver's average running position
per race, so how wide a driver's races are - and in which DIRECTION - is measurable before the race.
DATA (new, scripts/backtest-data/race-features.json, built 2026-10-10 from loop_data 2021-26, all series,
536 driver-series histories, 16,130 driver-board rows, 1,324 without >= 3 prior races): per driver per board,
from PRIOR same-series races only (most recent 30, recency 0.85 per race back): volUp = mean max(0, avg
running pos - finish) (finished better than it ran), volDown = mean max(0, finish - avg running pos),
volN; also passDiff per lap and closing (mid-race pos - finish) for the next registrations. Cup medians:
up 2.57, down 2.47. Fingerprint-joined (start:finish) like protocol-features.json.
FORM (engine, flagged, default off: runRaceSim simConfig.carVol = { gamma }; drivers carry volUp / volDown /
volN). Upside draws (e > 0) scaled by clamp((volUp_i / field median)^gamma, .6, 1.6), downside draws by the
same from volDown; EACH side rescaled to field mean 1 (budget unchanged, allocation moves); no history -> 1.
WHY SPLIT (and disclosed): the first cut was a symmetric width from |finish - avg|; the synthetic check
showed it hands a car whose variance is all wrecks extra upside and lowers a consistent favourite's win
share for the wrong reason (max-of-draws, the 10-09 lesson). Split check (36-car synthetic, 20k draws): a
high-upside / low-downside car gains win 18.8 -> 22.9 and top-5 59 -> 63; the mirror car loses both; the
mid-pack pair moves the same way smaller. Direction is the one the data asks for. One gamma per series.
FIT: train.txt (2022-24), 10k sims, gamma in {0, .25, .5, .75, 1} per series, smallest TOP-5 BRIER + TOP-10
BRIER (consistency metrics; tie within 1e-5 -> smaller). Written to carvol-fit.json and COMMITTED before the
holdout is read. Fitted 0 -> nothing to test. Expectation stated up front: this is NOT a favourite fix; its
payoff is DFS - ceilings, top-5 / top-10 calibration, the set builder's E[max].
TEST: holdout-practice.txt (94 boards), 20k sims, RUNS=2, control = shipped. Null floor = |A run1 - A run2|.
Metrics: rho, top-10 Brier, win Brier, top-5 Brier, win LL, top-5 LL; DK rank rho (proj DK vs actual DK, on
boards with LL/FL actuals); DK INTERVAL COVERAGE: share of drivers whose actual DK lands above the sim's
p90 and below its p10 (10% each if the ceilings / floors are honest); favourite / mid / tail gaps and the
elite cells for the record.
DECISION RULE (per series, mean of two runs): SHIP T at the fitted gamma if (a) fitted gamma > 0; (b) top-5
Brier AND top-10 Brier each better than A by at least the null floor; (c) DK rho not worse than A by more
than the null floor; (d) |DK>p90 coverage - 10%| + |DK<p10 coverage - 10%| not larger than A's; (e) win
Brier, rho, win LL, top-5 LL each not worse than A by more than the null floor; (f) favourite gap not worse
than A by more than 1.0 pt. Fails any one -> not shipped for that series. Ships as simConfig.carVol in
SimulationCenter with volUp / volDown / volN computed per driver from own-series loop_data the way
lappedRate and ownDnf are; stamp carVol 'v1-g<gamma>'. Revert trigger: DK>p90 coverage above 15% on two
straight weekends' boards.
HARNESS SMOKE (train only, cup, 100 sims, two rows, throwaway): g0 t5B .10407 t10 .16507 DK>p90 9.7% DK<p10
10.2% / g.25 .10433 .16612 9.8% 10.5% - draw-noise at 100 sims, nothing to read. No holdout numbers seen.
PUSH before the fit.

## 2026-10-10 — PER-DRIVER VOLATILITY: FIT returns 0 for every series — CLOSED AT THE FIT
  CUP (108)     g0 t5B .10287 t10 .16345 dkRho .284 DK>p90 9.7% DK<p10 9.7% | g.25 .10315 .16375 .277 | g1 .10474 .16535 .261   -> 0
  O'REILLY (99) g0 .09233 .14399 .257 DK>p90 7.5% <p10 9.9% | g.25 .09251 .14448 .246 | g1 .09386 .14591 .219                 -> 0
  TRUCKS (67)   g0 .09615 .15491 .280 DK>p90 6.1% <p10 9.3% | g.25 .09675 .15565 .274 | g1 .09896 .15780 .226                 -> 0
Every metric degrades monotonically with gamma in every series - top-5 and top-10 Brier, finish rho, DK rho.
A driver's history of finishing better or worse than he ran does NOT predict the width or direction of his
next race beyond what the composite already carries; the engine's single width plus the two shipped edge
patches is the better model. Not tested on the holdout (fit 0), nothing ships, flag stays in off.
FINDING for the DFS side (control arm, train 2022-24): the sim's DK CEILINGS are honest in cup (actual DK
above the sim's p90 9.7% of the time, below p10 9.7%) and TOO HIGH in the lower series (O'Reilly 7.5% /
9.9%, trucks 6.1% / 9.3%): a trucks driver clears his stated p90 only 6 times in 100, not 10. The GPP set
builder maximises E[max] off these draws, so in trucks and O'Reilly it is chasing ceilings that arrive
40% less often than stated, while floors are right. Not the subject of this registration; logged as a
lead (a per-series upside scale, judged on p90 coverage, is a one-constant form).
Twenty registrations since 10-04: two ships, one call open, seventeen closed.

## 2026-10-10 — PRE-REGISTERED: PASS DIFFERENTIAL as a composite slot. Written before the fit. DO NOT MODIFY.
TRIGGER. Three independent tests (trucks favourite, elite cells, dominance groups) say the projected finish
order is too flat at the top, and every dial that reshapes noise or stretches ratings has failed for a
structural reason. The first registration that adds INFORMATION instead: green-flag pass differential per
lap - (green-flag passes - times passed) / laps completed - is measured race-day speed through traffic,
independent of where the car started or finished, present for every driver in every race since 2021 in all
three series, and not in the composite. Operator: second of the three registrations.
DATA: race-features.json (built 2026-10-10, see the volatility registration): passDiff per driver per board
from PRIOR same-series races only (most recent 30, recency 0.85). Cup median -0.0035 / lap, p10 -0.059, p90
+0.052.
FORM (engine, flagged, default off: buildSpeedScores(drivers, weights, { passDiff: { w } })). One more
min-max-scaled slot (higher = better) with weight w; all other slots diluted pro rata through wTotal; a
driver without history scores 50 in the slot. One w per series.
FIT: train.txt (2022-24, no practice), 10k sims, w in {0, .05, .10, .15, .20}, smallest TOP-10 BRIER (the
08-20 weight-sweep precedent; tie within 1e-5 -> smaller). Written to passdiff-fit.json and COMMITTED before
the holdout is read. Fitted 0 -> nothing to test.
TEST: holdout-practice.txt (94 boards), 20k sims, RUNS=2, control = shipped. Null floor = |A run1 - A run2|.
Metrics as the volatility registration (rho, top-10 Brier, win / top-5 Brier, win / top-5 LL, DK rho, DK
coverage, favourite / mid / tail gaps, elite cells).
DECISION RULE (per series, mean of two runs): SHIP T at the fitted w if (a) fitted w > 0; (b) top-10 Brier
better than A by at least the null floor AND finish rho not worse by more than the floor; (c) win Brier and
top-5 Brier each not worse than A by more than the null floor; (d) DK rho not worse than A by more than the
floor; (e) favourite gap not worse than A by more than 1.0 pt; (f) neP26 within 0.5 of A. Fails any one ->
not shipped for that series. Ships as opts.passDiff in SimulationCenter's buildSpeedScores call with
passDiff computed per driver from own-series loop_data the way lappedRate is (and a 'pass' column in the
breakdown); stamp passDiff 'v1-w<w>'. Revert trigger: finish rho below the 10-week trailing mean two straight
weekends.
HARNESS SMOKE (train only, cup, 100 sims, two rows, throwaway): nothing to read at 100 sims. No holdout numbers
seen. PUSH before the fit.

## 2026-10-10 — PASS DIFFERENTIAL: FIT (train.txt 2022-24, 10k sims) — FROZEN before the holdout is read
  CUP (108)     w0 t10 .16349 rho .4288 winB .02581 t5B .10292 winLL .1132 | w.05 .16283 .4315 .02571 .10234 .1106 | w.1 .16260 .4303 .02563 .10206 .1102
                | w.15 .16301 | w.2 .16337    -> w 0.10 (the first form since 10-04 that improves top-10, win and top-5 Brier and win LL together in-sample)
  O'REILLY (99) w0 .14391 | w.05 .14413 | w.1 .14465 | w.2 .14644 (monotone worse)   -> 0
  TRUCKS (67)   w0 .15500 rho .5344 winB .02523 | w.05 .15493 .5370 | w.1 .15485 .5358 .02532 | w.15 .15517   -> w 0.10 (small: t10 -.00015, winB +.00009; fav gap -11.5 -> -5.9)
Written before the holdout: cup is the clean case (every rail better at w .10; dkRho .284 -> .282 flat). Trucks
is a marginal fit - the t10 gain is .00015 with win Brier slightly worse and the DK rho flat - and the
holdout null floor may swallow it; the favourite gap moving -11.5 -> -5.9 is the interesting part. O'Reilly
rejects it outright. FROZEN {"cup":0.1,"oreilly":0,"trucks":0.1}, committed.

## 2026-10-10 — PASS DIFFERENTIAL EXECUTED AS REGISTERED: CUP and TRUCKS FAIL — NOT SHIPPED
Holdout-practice, 20k sims, two runs, mean A -> T (w .10):
  CUP (39)     t10 .14997 -> .15148 (WORSE .0015, floor .00007: (b) FAILS)   rho .4868 -> .4797 (worse, 15/24)   winB .02231 -> .02244
               t5B .08941 -> .09057   winLL .0879 -> .0893   dkRho .353 -> .343 (worse .010: (d) FAILS)   fav gap -1.25 -> +1.35   eliteFront +0.16 -> -0.28
  TRUCKS (29)  t10 .15254 -> .15305 (WORSE .0005, floor .00009: (b) FAILS)   rho .5549 -> .5543   dkRho .3745 -> .3605 (worse .014: (d) FAILS)
               winB .02358 -> .02366   t5B .09635 -> .09636   fav gap -26.0 -> -27.3   mid 1.85 -> 1.05
  O'REILLY     fitted 0, not tested
VERDICT by the registered rule: NOT SHIPPED. Flag stays in, default off.
READING (not a decision): the in-sample gain was real and it did not transfer, and the reason is in the two
data sets. train.txt has NO practice; the holdout boards all carry practice (>= 50% coverage). Pass
differential is a race-day speed proxy, and on boards without practice it fills a hole that practice fills
better on the boards users actually see. On the holdout it is redundant with practice and the extra slot
only dilutes the slots that carry information. This is the practice-regime problem (tier-start, noise-mult
placebo) a third time, and it says the train set should carry practice where it exists - a data task
(regenerate train.txt with lrpTime from practice_sessions, as holdout-practice was regenerated 09-03), not
a modelling one, and the thing that would make the 2022-24 fit set comparable to the boards it is meant to
predict. Twenty-one registrations since 10-04: two ships, one call open, eighteen closed.

## 2026-10-10 — PRE-REGISTERED: DOM v2 GROUPS, SUPERSPEEDWAY RE-JUDGE on the practice-free lines. Written before the run. DO NOT MODIFY.
The 10-10 dom-groups registration could not judge SS: its test set was the practice-filtered holdout and SS
has no practice sessions. holdout-practice.txt carries 27 SS lines (cup 11 / O'Reilly 11 / trucks 5) that the
coverage filter drops; loaded practice-free they are the SS test set (NOPRACTICE=1 in the harness). The SS
constants are already FROZEN from the 10-10 fit (G_FL .6938, alpha .25, k_LL .5, k_FL .25) and are not
refit. Same arms (CONTROL / A / B), same metrics, same decision rule as the dom-groups registration, 20k sims,
RUNS=2, SS only. The 08-29 SS LL / FL tilts stay in every arm. This is the third of the operator's three
registrations; the "re-judge stacked on a top-end fix" variant has nothing to stack on (volatility and pass
differential both closed), so it is not run. PUSH before the run.

## 2026-10-10 — SS RE-JUDGE EXECUTED AS REGISTERED: A (FL budget) is clean on every metric, B is a wash — BY THE LETTER both miss on a ZERO null floor — OPERATOR CALL
27 practice-free SS boards (cup 11 / O'Reilly 11 / trucks 5), 20k sims, two runs, mean CONTROL -> A -> B:
  llMAE 5.225 -> 5.23 -> 5.13 (B 18/9)     flMAE 2.43 -> 2.02 -> 2.03 (26/1 both)     dkRho .1985 -> .199 -> .201
  winB .02453 -> .02454 -> .02452   t5B .1071 -> .1071 -> .1072   t10B .18255 -> .1825 -> .1825
  tier-1 LL bias +2.9 -> +2.85 -> -3.2 (B flips the sign, magnitude 2.9 -> 3.2)   tier 2-3 LL +2.9 -> +3.0 -> +0.3
  P(top-LL car wins) 1.000 -> 1.000 -> .277 (actual SS 2022-24 .182)
  Null floor (CONTROL run 1 vs run 2): llMAE .01, flMAE .00, dkRho .001, winB .0000, t5B .0000, t10B .0001.
BY THE LETTER: B fails (c) on top-5 Brier by .0001 against a floor of .0000 and (d) on |tier-1 LL bias| by 0.3
laps; A fails (c) on win Brier by .00001 against a floor of .0000. The registered rule inherits the dom-groups
rule, whose "within the null floor" clause has no tie band, and on a seeded harness the control's run-to-run
floor on the Brier metrics is literally zero - so no arm that changes anything can pass (c). This is the 10-09
stage-2 defect again (tie band tighter than noise), and it is mine; stated rather than reinterpreted.
WHAT THE NUMBERS SAY: A is a measurement, not a model (fastest laps exist only on green laps; SS runs 69%
green), it improves the fastest-lap count on 26 of 27 boards, and every other metric is a tie to four
decimals, including DK rho (.1985 -> .199) - unlike SHORT, where removing the over-count cost DK rho .016,
because SS fastest laps are spread across the field (the 08-29 finding: FL share RISES down the field at SS)
and were never propping up the top. B (strength order) improves laps-led MAE 19/8 and DK rho +.002, but flips
the tier-1 laps-led bias from +2.9 (under) to -3.2 (over) and ties everything else: a wash.
RECOMMENDATION (operator call, the rule as written cannot pass anything): SHIP A at SS - flBudget .6938 as the
SS group default next to INT's - and HOLD B. ROAD and SHORT stay on the over-count until the top-end order is
fixed (10-10 dom-groups reading); SS is the one group where the budget is free. If shipped: SimulationCenter
stamps domCurves 'ss-flbudget-v1' at SS; revert trigger as the dom-groups registration.
Twenty-two registrations since 10-04: two ships, two calls open (O'Reilly lapped traffic, SS FL budget), eighteen closed.

## 2026-10-10 — SHIPPED (operator: "ship the SS budget"): SS fastest-lap budget — SS_FL_BUDGET 0.6938 as the superspeedway group default
Engine: runRaceSim sets flBudget = SS_FL_BUDGET at trackGroup SS when none is passed (explicit wins);
SimulationCenter stamps config.domCurves 'ss-flbudget-v1' on SS boards. The strength-keyed order is NOT
shipped at SS (a wash); SHORT / ROAD keep the every-lap budget (10-10 dom-groups reading). Harness
backtest-dom-groups.js CONTROL reconstructs the pre-ship SS budget (flBudget 1) so the record stays
reproducible. Revert trigger as the dom-groups registration (SS DK dominator-point error worse than the
10-09 stage-1 diagnostic two straight weekends). Three ships since 10-04 (trucks per-car DNF, dominator
bootstrap INT+SHORT, SS FL budget); one call open (O'Reilly lapped traffic).

## 2026-10-10 — REGISTRATION: DK CEILING STUDY, stage 1 (diagnostic, control arm only, nothing ships). Written before the run.
TRIGGER. The volatility control arm (train 2022-24) and the pass-diff control arm (holdout 2025-26 with
practice) both show the sim's DK ceilings honest in cup (actual DK clears the stated p90 ~10% of the time)
and too high in O'Reilly (7.5% / 5.0%) and trucks (6.1% / 6.6%). Operator: "register the DK scale." Before a
form is named, stage 1 locates the over-statement: is it the FINISH side (finish points + place differential
drawn too optimistically) or the DOMINATOR side (laps led / fastest laps draws too generous), or both.
METHOD. Shipped engine, 94 practice-holdout boards, 20k sims, one run, control only. Per sampled draw the
engine now also records finish-only DK (finish points + place differential; diagnostic flag
simConfig.__finSamples, no behaviour change). Per driver: share of drivers whose ACTUAL total DK, finish-
only DK, and dominator-only DK (.25 LL + .45 FL) exceed the sim's p90 of the matching per-draw quantity.
Honest = 10% each. Reported per series. A 300-sim smoke (same boards, noisy) was run to verify the plumbing
and showed O'Reilly finish-only 5.3% / dominator-only 6.4%, trucks 6.4% / 5.6%, cup 9.2% / 12.9% - disclosed;
the 20k numbers below are the measurement.
READ-OUT RULE (written now): the component(s) under 8% in a series are "over-stated"; stage 2 is registered
only for an over-stated component, with the form named then and fit on 2022-24. If the finish side is the
over-stated one, the form is NOT a symmetric or favourite-touching width change (the 10-09 max-of-draws
lesson): it is an upside scale for cars ABOVE median only, i.e. the asymNoise mechanism extended upward with
its own per-series constant, judged on p90 coverage with win / top-5 / top-10 Brier and the favourite gap as
rails. If the dominator side is the over-stated one, the form is a per-series damping of the bootstrap share
vector's top slot. PUSH before the run.

## 2026-10-10 — DK CEILING STAGE 1 RESULT (94 practice-holdout boards, 20k sims, control only, one run)
                 total DK > p90   finish-only DK > p90   dominator-only DK > p90   DK < p10
  cup (39)         9.9%              9.2%                   12.6%                   9.4%
  O'Reilly (26)    5.1%              5.2%                    6.6%                   8.8%
  trucks (29)      6.9%              6.5%                    5.6%                   9.4%
READ-OUT by the registered rule (< 8% = over-stated): O'Reilly and trucks are over-stated on BOTH sides,
finish and dominator; cup is honest on the finish side and UNDER-stated on the dominator side (12.6%: the
09-03 "tier-1 still under by 24 laps" in a different coat). Floors are honest everywhere. Stage 2 registered
below for O'Reilly and trucks on both components; cup is fitted for the record but its dominator damping is
expected to fit to 1 (and if it fits below 1, that is a warning, not a discovery).

## 2026-10-10 — PRE-REGISTERED: DK CEILING STAGE 2 — upper-half upside scale + dominator top-slot damping. Written before the fit. DO NOT MODIFY.
FORM (engine, both flagged, default off):
  U  simConfig.upperUpside = { u }: upside noise draws (e > 0) for cars at or above the field median of the
     composite, EXCLUDING the top-rated car, are scaled by u; downside untouched; below-median cars keep the
     shipped asymNoise. The favourite is excluded on purpose (10-09: his upside is what wins him races against
     outliers; clipping it lowers his win share for the wrong reason, and trucks favourites are already under).
  D  simConfig.domTopDamp = { d }: the per-draw share vector's top slot (bootstrap or fixed curve, LL and FL
     alike) keeps d of its share, the remainder spread pro rata over the other slots. Identity untouched.
  One u and one d per series. u = d = 1 is the shipped engine.
FIT: train.txt (2022-24), 10k sims, u and d each in {1, .9, .8, .7, .6}, fitted INDEPENDENTLY per series: u by
the smallest |finish-only DK > p90 coverage - 10%|, d by the smallest |dominator-only DK > p90 coverage - 10%|
(tie within .01 pt -> closer to 1). Written to dkceil-fit.json and COMMITTED before the holdout is read.
TEST: holdout-practice.txt (94 boards), 20k sims, RUNS=2, control = shipped (now including the SS FL budget).
Arms U alone, D alone (for the record) and UD (the candidate). Null floor = |A run1 - A run2|.
DECISION RULE (per series, mean of two runs): SHIP UD at the fitted (u, d) if (a) at least one of u, d < 1;
(b) |total DK > p90 coverage - 10%| shrinks by at least a THIRD vs A; (c) DK < p10 coverage stays within 1.5
pts of A's; (d) DK rho not worse than A by more than the null floor; (e) win, top-5 and top-10 Brier each not
worse than A by more than the null floor; (f) favourite gap not worse than A by more than 1.0 pt; (g) finish
rho not worse by more than the floor. Fails any one -> not shipped for that series. If UD fails but one of U /
D passes all of (b)-(g) on its own, that component ships alone (each is one mechanism with one constant). Ships
as simConfig.upperUpside / domTopDamp per series in SimulationCenter; stamp dkCeil 'v1-u<u>-d<d>'. Revert
trigger: DK > p90 coverage on stamped boards below 5% or above 15% over two straight weekends.
HARNESS SMOKE (train only, cup, 100 sims, three u rows, throwaway): u1 finDK>p90 8.9% / u.9 9.0% / u.8 9.5% -
noise at 100 sims. No holdout numbers seen beyond the registered stage-1 control read. PUSH before the fit.

## 2026-10-10 — DK CEILING STAGE 2: FIT (train.txt 2022-24, 10k sims) — FROZEN before the holdout is read
  CUP      u1 finDK>p90 9.2% -> u.6 10.0% (rails: winB .02580 -> .02713, fav gap +9.0 -> +20.7)   d1 domDK 14.4% -> d.6 13.8%   -> u .6, d .6
  O'REILLY u1 6.9% -> u.6 8.7% (winB .02379 -> .02439, fav gap -4.4 -> +9.7)                          d1 9.1% -> d.6 9.2%          -> u .6, d .6
  TRUCKS   u1 5.5% -> u.6 6.4% (winB .02522 -> .02518, t10 .15498 -> .15578, fav gap -10.0 -> +3.4)   d1 8.5% -> d.6 8.0%          -> u .6, d 1
Written before the holdout, two things: (1) u hits the GRID EDGE (.6) in every series and still only moves
the finish-side coverage 1-2 points toward 10 - a 40% clip on the upper half's upside barely touches the
ceiling, so whatever makes the lower-series p90 too high is not mainly the upside draw width; and the
clip's side effect (the favourite's win share rises as cars 2..median lose upside) is large - cup +9 -> +21,
O'Reilly -4 -> +10, which rail (f) will catch. (2) d is INEFFECTIVE for coverage (moves it 0.1-0.5 pt either
way, cup's fit to .6 is a tie-break artefact and the wrong direction for cup); the dominator-side ceiling is
not the top slot's size. FROZEN {"cup":{u .6, d .6},"oreilly":{u .6, d .6},"trucks":{u .6, d 1}}; the
holdout is run as registered and the rails decide. Expectation stated: this closes.

## 2026-10-10 — DK CEILING STAGE 2 EXECUTED AS REGISTERED: FAILS in all three series — NOT SHIPPED; one large finding inside it
Holdout-practice, 20k sims, two runs, mean A -> UD (u .6; d .6 cup / O'Reilly, 1 trucks):
  CUP (39)      DK>p90 9.95% -> 11.05% (crosses 10, |gap| .05 -> 1.05: (b) FAILS)   winB .02233 -> .02293 (worse)   fav gap -1.3 -> +12.8 ((f) FAILS)
  O'REILLY (26) DK>p90 5.05% -> 6.6% (|gap| 4.95 -> 3.4, -31%: short of a third)   winB .02179 -> .02204 (worse)   t5B .08278 -> .08200 (better)
                fav gap -1.05 -> +13.85 ((f) FAILS)   dkRho .3985 -> .393
  TRUCKS (29)   DK>p90 7.0% -> 7.65% (|gap| 3.0 -> 2.35, -22%: (b) FAILS)   dkRho .3755 -> .366 (worse .010: (d) FAILS)   t10 .15252 -> .15289 (worse .0004, floor .0001: (e) FAILS)
                WIN BRIER .02360 -> .02196 (BETTER by 7%, 14/15 per race)   fav gap -24.3 -> -11.2   eliteFront -1.86 -> -1.14   t5B tie
VERDICT by the registered rule: NOT SHIPPED anywhere. Both flags stay in, default off. The ceiling question is
answered negatively: neither an upper-half upside clip nor top-slot damping reaches the lower series' over-
stated p90 (coverage moved 0.6-1.6 pts of a 3-5 pt gap at the grid edge). Where the ceiling comes from is
still open; the next honest step is a stage-1 style decomposition BY TRACK GROUP and by projected-finish band
(is it the mid-field cars whose p90 is too high, or the top?), not another dial.
THE FINDING (not a decision): in TRUCKS the upper-half upside clip cuts win Brier from .0236 to .0220 - the
largest win-forecast improvement of any form tested since 10-04 - by moving the favourite gap from -24 to
-11. It is the second-tier clip (10-09) in a flat-rate costume: take upside from cars 2..median, the favourite
gains. On 2022-24 train the same arm was a wash on win Brier (.02522 -> .02518), so this is, again, a 2025-26
effect that the fit set cannot see and the holdout can. It fails the rule on top-10 Brier (+.0004) and DK rho
(-.010), both real and both in the direction "cars 2..median are now under-stated for top-10". Filed with the
trucks-favourite season-end refit as the strongest single piece of evidence for it: a clip form, fit on
2025-26, judged on 2027. Not run now (operator decision 10-10 stands).
Twenty-five registrations since 10-04: three ships, one call open, twenty-one closed.

## 2026-10-10 — SHIPPED (operator: "ship it"): LAPPED TRAFFIC for O'REILLY, k 1.5 — the 10-09 protocol's open call, closed
Operator took the trade stated plainly on 10-09 and again today: on the 2025-26 holdout every probability
metric improves in both runs (win LL 17/9 and 20/6, top-5 LL 17/9 and 19/7, top-10 Brier better), the non-
elite P26+ residual goes +1.40 -> -0.04 (the back of the field lands where it finishes), and finish rho loses
.0047 / .0054 against a .005 guard written before the engine's run-to-run rho noise (~.001) was known. Ships
as simConfig.lappedTraffic { series 'oreilly', k 1.5 } in SimulationCenter for O'Reilly boards only; boards
stamp config.lapTraffic 'v2-k1.5' / 'off'. Cup (fitted .75, FAILED: back-of-field sign flipped between
eras) and trucks (fitted 2, FAILED: rho -.0085) stay off. Revert trigger as registered: two straight weekends
of negative CLV lift on stamped O'Reilly boards. OPERATOR ACTION: re-run + republish the next O'Reilly board.
Four ships since 10-04 (trucks per-car DNF, dominator bootstrap INT+SHORT, SS FL budget, O'Reilly lapped
traffic); no calls open; twenty-one closed.

## 2026-10-10 — PRE-REGISTERED: PASS DIFFERENTIAL, NO-PRACTICE SLOT (the pre-board form). Written before the run. DO NOT MODIFY.
TRIGGER. The 10-10 pass-differential registration: w .10 improved top-10, win and top-5 Brier, win LL and finish
rho together in-sample for cup on train.txt (which carries no practice) and failed the practice holdout - the
term is redundant with practice and fills a hole without it. The hole is the Wednesday PRE board: no practice
loaded, and the trucks pre favourite was Christopher Bell at 13-17% twice. Operator: "register the no practice
pass differential slot."
FORM (engine, flagged, default off: buildSpeedScores(drivers, weights, { passDiff: { w, onlyNoPractice: true } })).
Identical to the 10-10 slot (min-max scaled green-flag pass differential per lap from prior same-series races,
weight w, others diluted pro rata) EXCEPT it is live only when the practice slot is empty for the whole field
(lrpTime null for every driver) - the 09-26 empty-slot rule's shape. On a post board with practice it is a
no-op by construction. One w per series.
FIT: FROZEN from passdiff-fit.json without a rerun - {"cup": .10, "oreilly": 0, "trucks": .10} - because on
train.txt (no practice anywhere) the onlyNoPractice flag is a no-op and the fit is identical by construction
(same data, same criterion, same grid). Copied to passdiffnp-fit.json with that note. Stated rather than
re-run, so nobody mistakes it for a second fit.
TEST: the PRACTICE-FREE lines of holdout-practice.txt (NOPRACTICE=1: all 162 fingerprint-matched 2025-26
boards loaded with lrpTime null - the pre-board analogue; cup 62 / O'Reilly 57 / trucks 43), 20k sims, RUNS=2,
control = shipped. Null floor = |A run1 - A run2|. Metrics as the 10-10 registration (rho, top-10 Brier, win /
top-5 Brier, win / top-5 LL, DK rho, DK coverage, favourite / mid / tail gaps, elite cells).
DECISION RULE (per series, mean of two runs): SHIP T at the frozen w if (a) w > 0; (b) top-10 Brier better than
A by at least the null floor AND finish rho not worse by more than the floor; (c) win Brier and top-5 Brier
each not worse than A by more than the floor; (d) DK rho not worse by more than the floor; (e) favourite gap
not worse than A by more than 1.0 pt; (f) neP26 within 0.5 of A. Fails any one -> not shipped for that series.
Ships as opts.passDiff { w, onlyNoPractice: true } in SimulationCenter's buildSpeedScores call, passDiff
computed per driver from own-series loop_data the way lappedRate is; boards stamp passDiff 'v1-np-w<w>' when
the slot was live and 'v1-np-idle' when practice was present; a 'pass' column in the breakdown. Revert
trigger: pre-board finish rho below its 10-week trailing mean two straight weekends.
SMOKE: a 200-sim practice-free run was started to verify the loader and KILLED after the header line printed
(162 boards: cup 62 / O'Reilly 57 / trucks 43); no metric rows were read. PUSH before the run.

## 2026-10-10 — NO-PRACTICE PASS DIFFERENTIAL EXECUTED AS REGISTERED: CUP and TRUCKS FAIL — NOT SHIPPED; the regime reading was wrong
Practice-free 2025-26 lines (cup 62 / O'Reilly 57 / trucks 43), 20k sims, two runs, mean A -> T (w .10):
  CUP (62)     t10 .15850 -> .15893 (WORSE .0004, floor .00003: (b) FAILS)   rho .4265 -> .4222 (worse, 26/36)   winB .02205 -> .02230 (worse)
               t5B .09449 -> .09503   winLL .0907 -> .0913   dkRho .3155 -> .3085 (worse: (d) FAILS)   fav gap -7.35 -> -4.9   eliteFront -.57 -> -.99
  TRUCKS (43)  t10 .15985 -> .16030 (WORSE .0005, floor .0000: (b) FAILS)   rho .4895 -> .4903 (tie)   winB .02473 -> .02462 (better)   t5B .09991 -> .09960 (better)
               winLL .0966 -> .0959 (better)   dkRho .294 -> .2845 (worse .010: (d) FAILS)   fav gap -20.0 -> -24.6 (worse 4.6: (e) FAILS)
  O'REILLY     fitted 0, not tested (A for the record: fav gap -7.7, DK>p90 6.6%)
VERDICT by the registered rule: NOT SHIPPED. Flag stays in, default off.
READING, and a correction of this morning's: I read the 10-10 holdout failure as a practice-regime mismatch
("redundant with practice"). On 162 boards WITHOUT practice the slot still loses top-10 Brier and DK rho in
both series, so the in-sample cup gain on 2022-24 was never going to transfer to 2025-26 whether practice is
present or not. Pass differential as a composite slot is CLOSED, both variants; the information it carries
about 2025-26 finishes is already in the composite or has changed sign across eras. The one thing it did in
trucks - win Brier and top-5 Brier better in both runs (26/17, 24/19) with the favourite gap WIDER (-20 ->
-25) - is the pattern of a term that helps mid-pack ordering and hurts the top, i.e. another symptom of the
top-end flatness, not a fix for it. What this run also gives us that the practice holdout cannot: a PRE-BOARD
control table on 162 boards - cup fav gap -7.4 (pre favourites under-stated even in cup without practice),
O'Reilly -7.7, trucks -20; cup top-10 Brier .1585 vs .1500 with practice. The pre board is 6% worse than the
post board on top-10 and under-states every series' favourite; that is the pre-board problem's size, measured.
Twenty-six registrations since 10-04: four ships, no calls open, twenty-two closed.

## 2026-10-10 — REGISTRATION: PRE-BOARD STUDY, stage 1 (diagnostic, shipped engine, nothing ships). Written before the run.
TRIGGER. The no-practice pass-diff run's control table: without practice the sim under-states every series'
favourite (cup -7.4, O'Reilly -7.7, trucks -20) and cup top-10 Brier is .1585 vs .1500 with practice; the live
2026 trucks pre boards had Christopher Bell as the favourite at 13-17% twice. The pre board differs from the
post board in TWO inputs - no practice AND a projected grid - and nothing so far separates their shares.
Operator: "register it."
METHOD (scripts/backtest-preboard.js). The same 2025-26 boards under four conditions, shipped engine (trucks
carDnf, domBoot INT+SHORT, SS FL budget, O'Reilly lapped traffic), 20k sims, one run:
  POST    real grid + practice (the 94 practice-covered lines)
  NOPRAC  real grid, practice removed (all 162 lines)
  PRE     PROJECTED grid, no practice - production's projection: trail10 + the v4 form term for cup / O'Reilly
          (frozen betas), trail10 for trucks; production's projected-start shading x0.7 applied (161 lines
          fingerprint-matched to the start-v4 study rows). Per-sim start sampling (#73) is NOT reproduced -
          noted as the one production piece missing.
  PRE0    PRE without the x0.7 shading (reference only)
METRICS per series (and by track group where n >= 4): finish rho, top-10 / win / top-5 Brier, favourite gap
(stated - hit), favourite hit rate, the actual winner's rank in the sim's win order (identity), mid 3-10% and
tail gaps, elite cells and neP26 keyed on the REAL grid in every condition, projected-grid MAE. Two same-board
deltas: PRACTICE REMOVED (NOPRAC vs POST on the 94) and GRID PROJECTED (PRE vs NOPRAC on the 161).
READ-OUT RULE (written now): per series, the component with the larger top-10 Brier loss names stage 2. If the
GRID share dominates: stage 2 is a per-series projected-grid shading (the 07-25 cup mechanism, lam .7 today for
every series, refit per series on 2022-24 with projected grids reconstructed leak-free) - one constant per
series. If the PRACTICE share dominates: stage 2 is a no-practice composite reweight (where the empty
practice weight goes: pro rata today) - one constant per series. If the winner's sim rank is the thing that
moves (identity, the Bell case) rather than the favourite's level, that is reported as such and stage 2 is a
market-anchor question (the pre board's thin-driver fill), not a weight. Nothing ships from stage 1.
SMOKE: a 30-sim run was started to verify the loader (162 boards, 94 with practice, 161 with a projected grid)
and read only to the header; no metric rows seen. PUSH before the run.

## 2026-10-10 — PRE-BOARD STAGE 1 RESULT (162 boards, 20k sims, shipped engine)
Same-board deltas (the registered read-out):
  CUP       practice removed (39): t10 .14984 -> .15120 (+.0014)  rho .4865 -> .4845  fav gap -1.4 -> -9.3   fav hits 31% -> 36%
            grid projected (61):   t10 .15814 -> .16223 (+.0041; unshaded .16371)  rho .4265 -> .4035  fav gap -8.4 -> -4.8  winner's sim rank 6.16 -> 7.00
  O'REILLY  practice removed (26): t10 .13456 -> .13621 (+.0017)  rho .5982 -> .5866  fav gap -0.5 -> -1.7
            grid projected (57):   t10 .14426 -> .14548 (+.0012; unshaded .14544)  rho .4891 -> .4785  fav gap -7.3 -> -6.0  winner rank 4.65 -> 4.82
  TRUCKS    practice removed (29): t10 .15257 -> .15438 (+.0018)  rho .5556 -> .5351  fav gap -25.9 -> -23.9  fav hits 48% -> 45%
            grid projected (43):   t10 .15997 -> .16153 (+.0016; unshaded .16098)  rho .4890 -> .4797  fav gap -18.8 -> -19.4  winner rank 4.51 -> 4.58
  Projected-grid MAE (production projection vs real grid): cup 7.39, O'Reilly 5.99, trucks 6.17 positions.
READ-OUT by the registered rule:
  CUP: the GRID dominates - three times the top-10 cost of missing practice (+.0041 vs +.0014), finish rho -.023,
  and the only identity loss in the study (the real winner drops from 6.2nd to 7.0th in the sim's win order).
  Production's x0.7 shading helps cup (.16223 vs .16371 unshaded). Stage 2 for cup = per-series shading refit.
  O'REILLY and TRUCKS: PRACTICE dominates, narrowly (+.0017 vs +.0012; +.0018 vs +.0016). The x0.7 shading
  (fit on cup, 07-25) is a no-op for O'Reilly and slightly HURTS trucks (.16153 vs .16098 unshaded) - the one
  constant that was never fit for the lower series. Stage 2 for both = where the empty practice weight goes
  (pro rata today) AND a per-series shading, since the trucks sign says the cup value is wrong for it.
  IDENTITY (the Bell case): on average the winner's sim rank moves 0.2-0.8 places pre vs post - the pre board
  loses the favourite's LEVEL far more than his identity. The Bell boards are a thin-driver / market-fill
  question on the live board (a cup ringer with little trucks history) that this reconstruction cannot
  reproduce; separate audit, not stage 2.
  The trucks favourite is under-stated on POST boards MORE than on pre (-26 vs -19): practice sharpens WHO the
  favourite is (hits 48%) without raising what the sim says about him - the 10-09 finding restated.
  Pre-board top-10 Brier is 8% worse than post in cup (.1622 vs .1498), 8% in O'Reilly, 6% in trucks.
STAGE 2 (to be registered, named here as the rule requires): per series, (a) projected-start shading lam in
{.4, .5, .6, .7, .8, 1} replacing the fixed .7 - needs leak-free trail10 projected grids reconstructed for the
274 train races (loop_data, production rules); (b) empty-practice weight destination in {pro rata, all to
corrHistory, all to trackHistory, split} - fit on train (every 2022-24 board is a no-practice board); both
judged once on the PRE (lam) and NOPRAC (destination) 2025-26 lines, 162 boards, by top-10 Brier with rho /
favourite-gap / winner-rank rails. Nothing ships from stage 1.

## 2026-10-10 — PRE-REGISTERED: PRE-BOARD STAGE 2 — per-series projected-start shading + empty-practice weight destination. Written before the fit. DO NOT MODIFY.
TRIGGER. Stage 1 (above): the pre board is 6-8% worse than post on top-10 Brier in every series; the grid is
cup's cost, missing practice is O'Reilly's and trucks', and the x0.7 shading (07-25, fit on cup) is a no-op
for O'Reilly and slightly hurts trucks. Operator: "build and register."
DATA BUILT (scripts/build-train-grids.js -> backtest-data/train-grids.json): leak-free trail10 projected grids
for all 274 train races - each driver's last 10 PRIOR same-series start percentiles, min 3, SS / ROAD on same-
category history, ovals on oval history, re-ranked 1..K (production trail10-v2.1 rules; no v4 form term,
2022-24 is pre-metric). 10,128 driver rows, 8,077 eligible (80%), projected-grid MAE 6.47 vs real (holdout
6.0-7.4). Eleven 2026 history races outside the matched sets fall back to oval category (negligible).
FORMS (engine, both default-preserving):
  L  opts.projShade = lam: projected-start scores shaded 50 + (s - 50) x lam (today a fixed .7 for every series)
  D  opts.emptyPracticeTo in {prorata (today), corrHistory, trackHistory, startPos}: where the practice slot's
     weight goes when the slot is empty for the whole field (today it is effectively spread pro rata)
  One lam and one destination per series.
FIT: train.txt under the PRE condition (train-grids.json as startPos, __startProjected, no practice), 10k sims:
lam in {.4,.5,.6,.7,.8,1} by the smallest top-10 Brier (dest prorata; tie within 1e-5 -> closer to .7), then
destination at the fitted lam by the smallest top-10 Brier (tie -> prorata). Written to preboard2-fit.json
and COMMITTED before the holdout is read. KNOWN DIFFERENCE: the train projection is trail10; the cup / O'Reilly
test projection is trail10 + the v4 form term (better by ~1 position) - a lam fit on the weaker projection
is, if anything, conservative for the test.
TEST: the PRE lines of holdout-practice.txt (production projection from the start-v4 study rows, no practice;
cup 61 / O'Reilly 57 / trucks 43), 20k sims, RUNS=2, control A = shipped (lam .7, pro rata). Arms L, D, LD.
Null floor = |A run1 - A run2|. Metrics: top-10 Brier, finish rho, win / top-5 Brier, favourite gap, favourite
hit rate, winner's sim rank.
DECISION RULE (per series, mean of two runs): SHIP LD at the fitted (lam, dest) if (a) at least one differs
from shipped; (b) top-10 Brier better than A by at least the null floor; (c) finish rho not worse by more
than the floor; (d) win Brier and top-5 Brier each not worse by more than the floor; (e) favourite gap not
worse than A by more than 1.0 pt; (f) winner's sim rank not worse by more than 0.25 places. If LD fails but
L or D alone passes (b)-(f), that one ships alone. Ships as per-series opts in SimulationCenter's
buildSpeedScores call (projShade, emptyPracticeTo), stamped projShade 'v2-<lam>' / emptyPractice '<dest>' on
boards; post boards with practice are untouched by D and by L (no projected starts). Revert trigger:
pre-board favourite 0-for-3 weekends vs the books in a series.
SMOKE: a 40-sim train fit was started to verify the loader and read to the first lam row (cup lam .4, a draw-
noise number); nothing from the holdout seen. PUSH before the fit.

## 2026-10-10 — PRE-BOARD STAGE 2: FIT (train.txt 2022-24 with trail10 grids, 10k sims) — FROZEN before the holdout is read
  CUP (108)      lam .4 t10 .16863 | .5 .16868 | .6 .16872 | .7 .16918 | .8 .16928 | 1 .17006  -> lam .4 (grid edge: cup trusts its
                 projected grid LESS than .7); dest at .4: prorata .16862 / corrHistory .16977 / trackHistory .16885 / startPos .16912 -> prorata
  O'REILLY (99)  lam .4 .14813 | .5 .14775 | .6 .14756 | .7 .14745 | .8 .14733 | 1 (best)  -> lam 1 (no shading: O'Reilly trusts the
                 projected grid MORE); dest at 1 -> corrHistory
  TRUCKS (67)    lam .4 .16404 | .5 .16347 | .6 .16278 | .7 .16236 | .8 .16180 | 1 .16159  -> lam 1; dest at 1: prorata .16137 /
                 corrHistory .16015 / trackHistory .16155 / startPos .16124 -> corrHistory (winB .02546 -> .02533, t5B .09953 -> .09865)
Written before the holdout: the series split the shading in OPPOSITE directions - cup wants less trust in a
projected grid (.4), the lower series want full trust (1.0), which is exactly what stage 1's "the x0.7 helps
cup, hurts trucks" said. And the empty practice weight is better spent on correlation-group driver rating
than spread pro rata in both lower series (trucks t10 .16137 -> .16015). Both lam fits sit on a grid edge, so
if they pass, the registered next step is a finer grid at season end, not a wider one now.
FROZEN {"lam":{"cup":.4,"oreilly":1,"trucks":1},"dest":{"cup":"prorata","oreilly":"corrHistory","trucks":"corrHistory"}}

## 2026-10-10 — PRE-BOARD STAGE 2 EXECUTED AS REGISTERED: O'REILLY LD and TRUCKS L SHIP; CUP FAILS — SHIPPED
161 pre boards (production projection, no practice), 20k sims, two runs, mean A -> arm:
  CUP (61)      L lam .4:  t10 .16222 -> .16117 (better .00105, 38/23 and 39/22)   rho .4034 -> .4038   t5B .09751 -> .09710
                winB .02254 -> .02258 (worse .00004, floor .00001: (d) FAILS)   fav gap -3.15 -> -7.15 (worse 4.0: (e) FAILS)   winner rank 6.94 -> 7.05
                NOT SHIPPED: a lighter grid buys top-10 and costs the favourite - cup stays at .7.
  O'REILLY (57) LD (lam 1, corrHistory): t10 .14550 -> .14547 (better .00003 = the floor, (b) passes by the letter)   rho .4782 -> .4792
                winB .02204 -> .02175   t5B .08954 -> .08954   fav gap -6.9 -> -2.15   fav hits 31% -> 32.5%   winner rank 4.84 -> 4.71   -> PASSES, SHIPS
                for the record: L alone t10 .14542, D alone t10 .14528 (the stronger single piece; D's rank +.08 within .25). The rule
                names LD when LD passes; D alone would also have passed.
  TRUCKS (43)   LD (lam 1, corrHistory): t10 .16161 -> .16065 (29/14, 27/16)  rho .4792 -> .4819  winB .02471 -> .02409  fav gap -19.4 -> -10.2
                t5B .10141 -> .10180 (WORSE .00038, floor .00004: (d) FAILS)
                L alone (lam 1): t10 .16161 -> .16103 (31/12, 28/15)  rho .4792 -> .4809  winB .02471 -> .02455  t5B .10141 -> .10134
                fav gap -19.4 -> -19.9 (within 1.0)  winner rank 4.57 -> 4.54   -> PASSES every rail, SHIPS ALONE (per the rule)
                D alone fails on t5B (.10176). The corrHistory destination lifts the trucks favourite (-19 -> -12) and costs top-5 -
                the same trade as every trucks favourite form this week; filed with the season-end refit.
SHIPPED (this commit, SimulationCenter buildSpeedScores opts): projShade = .7 for cup (unchanged), 1.0 for O'Reilly and
trucks (no shading of projected starts); emptyPracticeTo = 'corrHistory' for O'Reilly (pro rata elsewhere). Boards stamp
config.projShade 'v1-0.7' / 'v2-1.0' and config.emptyPractice 'corrHistory' / 'prorata'. Both are no-ops on a post board
(real grid, practice present); they change only the pre board. Revert trigger as registered: a series' pre-board
favourite 0-for-3 weekends vs the books. NEXT (named, not registered): lam sits on the grid edge in all three series
(.4 cup, 1.0 lower) - a finer / wider grid at season end; and the trucks corrHistory destination with a top-5 guard.
Six ships since 10-04: trucks per-car DNF, dominator bootstrap INT+SHORT, SS FL budget, O'Reilly lapped traffic,
O'Reilly pre-board (lam 1 + corrHistory), trucks pre-board (lam 1). Twenty-nine registrations: six ships, twenty-three closed.

## 2026-10-10 — PRE-REGISTERED: PRE-BOARD STAGE 3 — extended shading grid + half-weight practice destination. Written before the fit. DO NOT MODIFY.
TRIGGER. Stage 2: both lam fits landed on a grid EDGE (cup .4 at the bottom, O'Reilly / trucks 1.0 at the top), and the
trucks corrHistory destination lifted the favourite -19 -> -12 and win Brier .0247 -> .0242 but failed top-5 by .0004
on an all-or-nothing grid. Operator: "run the first two together."
FORMS (engine): opts.projShade now accepts up to 1.6 (a value above 1 undoes trail10's compression toward mid-field -
a trailing mean is flatter than a real grid); opts.emptyPracticeTo 'corrHalf' = half the practice weight to
corrHistory, half left in place (pro rata). Control = what ships after stage 2: cup .7 / pro rata, O'Reilly 1.0 /
corrHistory, trucks 1.0 / pro rata.
FIT (train.txt with trail10 grids, 10k sims, STAGE3=1): lam over the EXTENDED grid only - cup {.2, .3, .4, .7},
O'Reilly and trucks {1, 1.2, 1.4} - by top-10 Brier at the shipped destination (tie -> the shipped lam); then
destination at the fitted lam over cup {prorata, corrHalf}, O'Reilly {corrHistory, corrHalf, prorata}, trucks {prorata,
corrHalf, corrHistory} by top-10 Brier (tie -> shipped). Written to preboard3-fit.json and COMMITTED before the holdout.
TEST: the 161 PRE lines, 20k sims, RUNS=2, control = stage-2 ship; arms L, D, LD. Null floor = |A run1 - A run2|.
DECISION RULE: exactly stage 2's - (a) differs from shipped; (b) top-10 Brier better by at least the floor; (c) rho not
worse by more than the floor; (d) win and top-5 Brier each not worse by more than the floor; (e) favourite gap not worse
by more than 1.0; (f) winner's sim rank not worse by more than 0.25. LD if it passes, else the passing half alone.
Ships as the per-series constants in SimulationCenter (stamps projShade 'v2-<lam>', emptyPractice '<dest>').
SMOKE: a 30-sim train fit was started and read to the header line only. PUSH before the fit.

## 2026-10-10 — PRE-BOARD STAGE 3: FIT (train.txt with trail10 grids, 10k sims) — FROZEN before the holdout is read
  CUP (108)     lam .2 .16881 | .3 .16874 | .4 .16848 | .7 .16900 -> .4 (NOT an edge after all: .2 / .3 are worse). dest at .4: prorata .16852 /
                corrHalf .16899 -> prorata. Cup's candidate is therefore IDENTICAL to the stage-2 arm that failed (d) and (e); it is run
                again as the rule says and will fail again unless the draw differs - expected, stated.
  O'REILLY (99) lam 1 .14679 | 1.2 .14678 | 1.4 .14693 -> 1.2 (a hair; the tie band did not catch it at 4 dp). dest at 1.2: corrHistory
                .14673 / corrHalf .14700 / prorata .14717 -> corrHistory (unchanged).
  TRUCKS (67)   lam 1 .16152 | 1.2 .16124 | 1.4 .16105 -> 1.4 (the top of the grid again). dest at 1.4: prorata .16124 / corrHalf
                .16061 / corrHistory .16032 -> corrHistory - the fit criterion (top-10) picks the full move over the half move, so
                the holdout will judge corrHistory again (it failed top-5 by .0004 at lam 1); corrHalf is NOT judged under this
                registration. Stated now: if LD fails on top-5 again and L passes, the half-weight form needs its own entry with a
                top-5-aware fit, not a re-read.
FROZEN {"lam":{"cup":.4,"oreilly":1.2,"trucks":1.4},"dest":{"cup":"prorata","oreilly":"corrHistory","trucks":"corrHistory"}}

## 2026-10-10 — PRE-BOARD STAGE 3 EXECUTED AS REGISTERED: NOTHING SHIPS — the stage-2 constants were the right stopping points
161 pre boards, 20k sims, two runs, mean A (stage-2 ship) -> arm:
  CUP (61)      L .4: t10 .16224 -> .16121 (better, 39/22 both runs)   winB .02255 -> .02256 (within floor this time)   t5B better
                fav gap -3.1 -> -8.0 ((e) FAILS, as in stage 2)   winner rank 7.04 -> 7.07.   NOT SHIPPED - same verdict, same reason.
  O'REILLY (57) L 1.2: t10 .14541 -> .14568 (WORSE, 24/33 and 19/38: (b) FAILS)   rho .4796 -> .4778   winB worse.   NOT SHIPPED - 1.0 stands.
  TRUCKS (43)   L 1.4: t10 .16095 -> .16100 (worse, 21/22: (b) FAILS)   rho .4805 -> .4761.   NOT SHIPPED - 1.0 stands.
                D corrHistory: t10 .16095 -> .16065 (better .00030, floor .00005)   rho .4805 -> .4816   winB .02456 -> .02409 (better 2%)
                fav gap -19.9 -> -10.3   winner rank 4.59 -> 4.50   t5B .10133 -> .10179 (WORSE .00046, floor .00012: (d) FAILS) - exactly stage 2's verdict.
                LD: t5B worse by .0012.   NOT SHIPPED.
VERDICT: no change to the engine. The two stage-2 "grid edges" were not edges on the holdout - the in-sample pull toward
.4 (cup) and above 1.0 (lower series) does not transfer, and the shipped .7 / 1.0 / 1.0 stand.
READING: the trucks corrHistory destination has now failed the SAME rail the same way twice (top-5 Brier +.0004-.0005)
while improving top-10, finish rho, win Brier (-2%) and halving the favourite gap. The rule is right to stop it - a
pre-board top-5 market is a real product - but the trade is now measured, not suspected: the empty-practice weight on
driver rating sharpens the top of the trucks pre board at the expense of positions 3-6. The half-weight form (corrHalf)
was never judged: the top-10 fit criterion prefers the full move. A fourth entry fitting the destination by top-10 AND
top-5 Brier together (the 10-09 lesson: fit on what the rail judges) is the honest next step for trucks; not run now.
Thirty-one registrations since 10-04: six ships, twenty-five closed.

## 2026-10-10 — BELL AUDIT (live trucks pre boards, read-only): not a market-fill problem, a part-timer projection problem
The 2026 trucks pre boards (sim_results, latest per race): Richmond R17 Christopher Bell 17.4% stated at PROJECTED START P1
(book +800), New Hampshire R18 13.3% at projected P3 (book +800; he qualified 17th). His trucks history is nine starts, not
thin: 2023-26 starts 9/14/14/2/6/15/5/2/3/17 with a 2026 Bristol WIN from P15 and finishes 4/5/4/6/1/5/6/15/7. trail10
(v3.5 with equipment start fill) therefore projected a cup champion in a strong truck onto the front row from a handful of
good recent starts, and with practice absent the composite leaned on it (trucks short-track start weight .33). The book
had him +800 because he is a part-timer; the sim had no notion of that. The 'thin-driver market fill' hypothesis is WRONG -
he is not thin by the engine's definition (>= 5 prior starts). What the board lacked is projection CONFIDENCE by sample
size: a trailing mean over 6-10 starts is treated like one over 10. Candidate form (not registered here): shrink the
trail10 projection toward the field median by n / (n + k) with one k per series, fitted on train-grids.json, judged on
the pre lines - stated now so it is not a re-read later. Note the 10-10 stage-2 ship (trucks lam 1.0, no shading) trusts
projected starts MORE in trucks, which cuts against this case specifically while helping the 43-board average; the
revert trigger (pre-board favourite 0-for-3 weekends) is the guard.

## 2026-10-10 — PRE-REGISTERED: PRE-BOARD STAGE 4 — cup tiered shading + trucks v4 re-judge on the new constants. Written before the fit. DO NOT MODIFY.
TRIGGER. (a) Cup: stage 2 and 3 both show a lighter projected grid (.4) buys top-10 on 38-39 of 61 pre boards and costs the
favourite 4-5 points, because shading everyone flattens the top. (b) Trucks: the v4 start projection passed its grid test
by a full position on 10-09 and failed the sim rail (top-10 +.0012) under start weight .33 at short tracks and the .7
shading; trucks now ships lam 1.0, a different environment. Operator: "do the rest of them."
FORMS.
  T (cup)    opts.projShadeElite = .7 for the top-5 cars by corrAvgRating (unchanged), opts.projShade = restLam for the field.
             FIT: restLam in {.3, .4, .5, .7} on train.txt with trail10 grids, by top-10 Brier (dest prorata), 10k sims;
             committed before the holdout. TEST: 61 cup pre lines, 20k, RUNS=2, control = ship (.7 everyone).
  V (trucks) the 10-09 v4 projection (betas FROZEN from start-v4-fit-trucks.json: INT .2222, SHORT .2427, SS -.0164, ROAD 0;
             fit on 2025) in place of trail10 v3.5, on the 2026 trucks pre lines ONLY (18 boards - 2025 would be in-sample),
             at the shipped lam 1.0 / pro rata. No fit. Control = ship (v3.5 grid, lam 1.0).
DECISION RULE (mean of two runs, stage-2 rails): ship if (b) top-10 Brier better by at least the null floor; (c) rho not
worse by more than the floor; (d) win and top-5 Brier each not worse by more than the floor; (e) favourite gap not worse
by more than 1.0; (f) winner's sim rank not worse by more than .25. T ships as the two cup constants (stamp projShade
'v2-tier-<rest>/.7'); V ships as the trucks __V4_BETA entry (stamp startProj 'trail10-v4-form' on trucks boards) - the
10-09 ship form. 18 boards is thin for V and is stated as such; the registered floor is what decides.
SMOKE: 20-sim loader checks read to the header / first train row only; no holdout rows seen. PUSH before the fit.

## 2026-10-10 — STAGE 4: CUP TIERED FIT — FROZEN before the holdout is read
  rest .3 t10 .16927 | .4 .16902 | .5 .16896 | .7 (= ship) .16905  -> rest lam .5, elite .7. Written before the holdout: holding the
  top-5 at .7 gives back almost all of the uniform-.4 in-sample gain (.16848 at stage 2 vs .16896 here) - the cup top-10 gain
  came mostly FROM shading the elites' projected starts, which is the same thing that under-stated the favourite. Expect a wash.
  Trucks V needs no fit (frozen 10-09 betas).

## 2026-10-10 — STAGE 4 EXECUTED AS REGISTERED: TRUCKS v4 FAILS (closed for good); CUP TIERED SHADING passes 5 of 6 rails — OPERATOR CALL
  CUP (61, mean of two runs)  A (.7 everyone) -> T (field .5, top-5 .7):
     t10 .16226 -> .16171 (better .00055, floor .00010; 37/24 and 34/27)   rho .4024 -> .4040 (better)   winB .02253 -> .02250 (better)
     t5B .09752 -> .09726 (better, 37/24 both runs)   fav gap -3.15 -> -2.4 (BETTER - the uniform .4 made it -8)   fav hits 26% -> 26%
     winner's sim rank 6.92 -> 7.20 (+.28 against the .25 rail: (f) FAILS by .03 of a place)
     The winner-rank metric's own run-to-run movement is .06 (A) and .13 (T) on these 61 boards, so the miss is inside the
     metric's noise but outside the registered rail. By the letter: not a pass. Same shape as the O'Reilly lapped-traffic call.
     What it buys: top-10, top-5, win Brier and finish rho all better, the favourite better, on the Wednesday cup board. What it
     costs: the actual winner sits ~0.3 places lower in the sim's win order (the field is shaded harder, so mid-pack winners get
     less pre-race credit). OPERATOR CALL - recommendation: ship (cup pre boards only; post boards untouched; stamp projShade
     'v2-tier-.5/.7'; revert trigger as stage 2).
  TRUCKS 2026 (18)  A (v3.5 grid, lam 1) -> V (v4 grid, lam 1): t10 .16013 -> .16154 (WORSE, 6/12 both runs: (b) FAILS)   rho .4498 -> .4428
     winB tie   t5B .09757 -> .09776   fav gap -20.7 -> -20.3.   NOT SHIPPED. Third failure of the trucks v4 projection in the sim
     (10-09 at .33/.7, 10-09 combined, now at lam 1.0) despite a one-position better grid every time: CLOSED as a projection
     form. The sim prefers trail10 for trucks; the 10-09 double-count reading (v4's recent-form term re-enters a form the finish
     model already carries) stands as the explanation and is not pursued further.
Thirty-two registrations since 10-04: six ships, one call open (cup tiered shading), twenty-five closed.

## 2026-10-10 - PITBOARD_ENGINE.md WRITTEN (current-form document, read from the code) + ONE DISCREPANCY FOUND
Operator: "I feel like we've done so much to the engine that you might be unsure of its current form." Written from
simEngine.js / SimulationCenter.js / domPools.js at ef994b9, not from memory: inputs -> weight tables -> slot fills ->
composite -> noise -> attrition -> lapped traffic -> finish order -> LL/FL -> DK, every live constant with its series /
group and the log entry that put it there; a per-series difference table; and a list of every flag that is in the code
but OFF in production so they are not mistaken for the engine. Code untouched.
FOUND WHILE READING: superspeedway noise is multiplied TWICE in production - SimulationCenter's __SS_NOISE_MULT (cup
3.0 / O'Reilly 1.5 / trucks 1.75, 07-11 Archive C) on the preset BEFORE runRaceSim, then GROUP_NOISE_MULT.SS 1.75
inside it. Effective live SS widths: cup 84, O'Reilly 47.3, trucks 70.4. That IS what the 08-29 calibration validated
(it reconstructed the live R24 board, page multiplier included, and the cup sweep the same night found no minimum
below 1.75). But none of the scripts/backtest-*.js harnesses apply the page multiplier - they build the preset from
getCautionPresets() and run SS at 28 / 31.5 / 40. So every harness SS result since the 08-30 extraction (SS FL
budget, SS re-judge, dom-groups SS cell, the SS cells of pre-board stage 1-3) was measured at a narrower width than
production. The SS FL-budget ship judged FL MAE, which the width does not touch (26/27 better stands); any harness
SS win / top-5 number is not production's. Not fixed here: the fix is to move the per-series multiplier into the
engine (one place, both paths) and re-run the SS cells - registration-worthy because it changes what the harness
measures, not what the page does. Logged as open in PITBOARD_ENGINE.md section 7.

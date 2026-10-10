# PITBOARD_ENGINE.md — the sim engine as it runs today

Written 2026-10-10 from the code, not from memory: `src/lib/simEngine.js` (ef994b9), `src/pages/SimulationCenter.js`,
`src/lib/domPools.js`. One document, one walk from the raw inputs to a DK projection. Every constant that is live in
production is named with its value, the series/track groups it applies to, and the BACKTEST_LOG entry that put it
there. Flags that exist in the code but are OFF in production are listed once, at the end, so nobody mistakes them
for the engine.

If this document and the code disagree, the code is the engine and this document has a bug. Update it in the same
commit as any constant change.

Track groups used throughout (`__trackGroup`): **SS** = Daytona / Talladega / Atlanta (EchoPark); **ROAD** = the road
and street course list; **SHORT** = Bristol, Martinsville, Richmond, North Wilkesboro, Bowman Gray, Iowa, Phoenix,
IRP, Milwaukee, Lucas Oil, Memphis, Dover, New Hampshire, Rockingham; **INT** = everything else.

---

## 0. The two calls

```
driversWithScores = buildSpeedScores(rawDrivers, weights, opts)   // one number per car: speedScore (0-100 scale)
results           = runRaceSim(driversWithScores, simConfig)       // numSims draws -> finish dist, LL, FL, DK
```

`SimulationCenter.js` prepares `rawDrivers` (section 1), picks `weights` and `opts` (section 2), and builds
`simConfig` (section 3). The engine itself has no series logic except through those two argument sets; that is what
keeps the backtest harnesses and the page on one code path.

---

## 1. Inputs — what SimulationCenter attaches to each car

All history comes from `loop_data` (NASCAR loop data per driver-race), plus `entry_list`, `qualifying_results`,
`practice_sessions`, `pit_stops`, `races`, `tracks`, `crossover_borrows`, `featured_weekend`.

**Field.** `entry_list` for this series / year / track. Fallback: qualifying names, then practice names. A `-1`
qualifying position is the DNQ sentinel and removes the car (07-28). Once >= 20 cars have a real start position,
every car without one is dropped as a DNQ / no-show (07-18 v2; projected starts do not count).

**Age weights** (every history average below): relative to the board's season, cup `2.0` current / minor series
`3.0` current, then `1.3 / 0.9 / 0.6 / 0.4` for 1 / 2 / 3 / 4+ seasons back (07-18; minor-series bump 3.0 same day).
`__teamCutoff` drops Briscoe's pre-2025 rows (ride change).

**corrAvgRating / corrAvgFinish / corrWinConv** — the driver's age-weighted mean driver rating, finish and win rate
over every race in the track's *correlation group* (`tracks.correlation_group_label`), same series only (07-17 fix:
cup rows enter only through `crossover_borrows`). The group rating is shrunk toward the driver's all-track same-series
rating with prior weight `__CORR_SHRINK_K = 4` in age-weight units (09-05, operator ship; drivers with no group rows
enter at the pooled rating with n = 0). winConv is wins only, shrunk `min(1, n/5)` toward a 2.6% base rate (07-09).
`nCorrRaces` = group rows.

**Ringers / multi-car drivers** (car-auto-v2, 08-03 / 08-07): if a driver has >= 3 rows (>= 2 with a borrow entry) in
*this week's car number* over the last two seasons and drives more than one car, his rating comes from that car
(prior season × 0.6) and `__carMatched` is set. Otherwise an active `crossover_borrows` row blends in the source
series at `blend_weight`.

**Equipment prior** (task 118, 07-09): `equipRating` = age-weighted mean rating of *this car number* under any
driver, same series (ringer rows excluded 07-22); `modalEquipRating` = same for the driver's age-weighted modal car
(08-20). `nEquipRaces`, `nModalEquip`. `equipScale` = operator override per driver (default 1, persisted in
`featured_weekend.eq_overrides`).

**trackAvgRating / trackAvgFinish / nTrackRaces** — age-weighted means at *this track*, same series.

**startPos** — qualifying position, else the practice sheet's position, else a **projected start** (task #72, 07-25):
mean of the last 10 prior start percentiles since 2025 (SS and ROAD condition on their own category, trail10-v2
hybrid; a multi-car driver uses his history in this week's car; a driver with no history uses the car number's grid
history, eqStart 08-03), re-ranked into a 1..K grid (trail10-v2.1). Cup and O'Reilly add the **form term**
(trail10-v4-form, 09-03 / 09-05): proj pctile += beta × (x − 0.5), x = this race's Jayski qualifying order when
loaded, else previous-round finish pctile; beta cup INT .2495 / SHORT .1649 / SS .1863 / ROAD 0, O'Reilly INT .1708 /
SHORT .1441 / SS .0353 / ROAD 0. Trucks have no form term (stamp `trail10-v3.5-eqStart`). `__startProjected` marks the
car; `__startHist` keeps the last-10 list for per-sim start sampling (section 3.2). A **rear override**
(`featured_weekend.rear_overrides`) races the car from the back but keeps `dkStartPos` = the qualified spot, because
DK scores place differential off the listed grid (08-23).

**lrpTime** (practice) — `best5` for cup and trucks, `overall_avg` for O'Reilly (07-16); null when no practice.
`practiceGroup` feeds the A/B group correction (`__groupConditionCorrect`, 07-16; no-op without group labels).
`__spdPct` = the car's practice-pace percentile (1 = fastest), neutral 0.5 without practice — this is the
`domSpeed: mult-v1` input to the dominator tilt (section 3.6).

**pitCrewTime** (task #46, 07-18) — current-season median 4-tire box time for the car number, >= 5 stops, Tukey fence
q3 + 1.5 IQR on the slow side (#68) and an 8.5 s floor (08-31). Null → neutral.

**lappedRate** (09-07) — recency-weighted (0.85 per race back) share of the driver's prior same-series races finished
running but laps down; >= 3 running races else null. Built for every series.

**ownDnf / ownDnfN** (10-09) — the driver's last 30 same-series races, weight 0.85^age, share not finished running;
>= 3 races else absent. Built for every series; consumed only for trucks (section 3.3).

**marketFill** (market anchor v1.4, 07-22) — from pasted odds: per market (win / t3 / t5 / t10) rank the de-vigged
implied probability with ties sharing rank, convert to a field percentile, average across the markets a driver is
priced in. Needs >= 10 priced drivers. This is the *ignorance fill* for thin drivers, never a signal for established
ones.

**lapsDown** — operator override (cars starting laps down).

---

## 2. buildSpeedScores — one strength number per car

### 2.1 Weight table (chosen by series × track)

| table | pitCrew | corrHistory | longRunPace | startPos | trackHistory | winConversion | used for |
|---|---|---|---|---|---|---|---|
| DEFAULT | .06 | .35 | .15 | .23 | .15 | — | INT and SHORT ovals, cup / O'Reilly; trucks INT |
| TRUCK_SHORT | .06 | .35 | .15 | .33 | .15 | — | trucks SHORT (the one cell where .33 beat .23, 08-20) |
| ROAD_COURSE | .06 | .60 | .25 | .15 | 0 | — | cup / O'Reilly road courses |
| TRUCK_ROAD | .06 | .55 | .25 | .20 | 0 | — | trucks road courses (07-07) |
| SUPERSPEEDWAY | .06 | .55 | 0 | .15 | .30 | — | cup / trucks SS |
| ONEILLY_SUPERSPEEDWAY | .06 | .45 | 0 | .15 | .20 | .20 | O'Reilly SS (Hill-class closers, 07-09) |

startPos .23 (from .33) is the 08-20 230-race sweep; pitCrew .06 is task #46 (07-18). A **rain-out** (`rainOut`) sets
startPos to .12 and splits the freed weight half to corrHistory, half to longRunPace (`__applyRainOut`).

### 2.2 Slot scores

Each input is min-max scaled across the field to 0–100 (`normalizeArr`; a slot with < 2 values, or all equal, is 50
for everyone). Direction: rating higher = better; finish, lap time, start position, box time lower = better.

- **corr (c)**: rating if present, else finish, else null. Confidence `conf = min(1, nCorrRaces / 4)`. Fill for the
  missing share: equipment rating (scaled onto the same axis as the field's driver ratings) weighted
  `min(1, nEquipRaces/4) × equipScale`, remainder the market fill (or 50 with no odds). Established drivers in a
  non-modal car get a ride-change delta `+0.25 × conf × equipScale × (equip − modalEquip)` (skipped when the rating
  is already car-matched).
- **track (t)**: rating × 0.9 + finish × 0.1 when both exist; confidence `min(1, nTrackRaces/4)`; the missing share
  fills to the market percentile for thin drivers, 50 otherwise (shrink-to-corr for established drivers was tested
  and rejected 07-18 — do not "fix").
- **lrp, sp**: the scaled value, or — for a thin driver (`nCorrRaces < 5` and no practice score) in a slot that has
  data for *someone* — the market fill; otherwise 50. A slot empty for the whole field is 50 for everyone (09-26,
  Kansas trucks).
- **win, pit**: the scaled value or 50.

**Projected-start shading.** For `__startProjected` cars the start slot is pulled toward the middle:
`sp = 50 + (sp − 50) × lam`, lam = **0.7 for cup** (trail10-v2.2, 07-25) and **1.0 for O'Reilly and trucks**
(pre-board stage 2, 10-10). Real grids are never shaded.

**Empty-practice destination** (10-10): on O'Reilly, when no car has practice, the longRunPace weight moves to
corrHistory instead of being spread pro rata. Cup and trucks spread pro rata (`emptyPractice: prorata`).

The weights in force are re-normalised to sum 1 after those adjustments (`wTotal`).

### 2.3 The composite and the laps-down penalty

```
speedScore = c·w.corr + lrp·w.lrp + sp·w.start + t·w.track + win·w.winConv + pit·w.pit   − lapPen
lapPen     = 0.15 × (lappedRate − field median lappedRate) × 100      O'Reilly and trucks only (cup: off)
```

LAP_PENALTY 0.15 is the 09-07 fit (2022-24) and holdout (rho .5397 → .5418). Cup failed it and stays off
(`opts.lapPenalty: series !== 'cup'`; stamp `lapFeature`).

The row also carries `__spW`, `__spUsed` (for start sampling) and the `scores` breakdown shown on the board, with
`anchored` marking market-filled slots (`*` in the UI).

---

## 3. runRaceSim — the draws

`simConfig` from the page: `numSims` (operator; default 10,000; published matrix capped at 4,000 draws), `cautionPreset`, `dnfRate`, `totalRaceLaps`,
`trackGroup`, `asymNoise`, `carCeilFloor: true`, `carDnf`, `lappedTraffic`, `domBoot`, `startSampling`.

### 3.1 Noise width

`cautionPreset` is auto-picked as the calibrated preset nearest the track's mean `races.total_cautions`
(correlation-group fallback under 2 races; 07-22), **pinned to Medium at SS** (08-31, Talladega cliff). Presets:

| series | Low (≤5) | Medium (6–8) | High (≥9) |
|---|---|---|---|
| cup | 4 / noise 10 | 8 / 16 | 15 / 25 |
| O'Reilly | 4 / 12 | 8 / 18 | 15 / 28 |
| trucks | 4 / 15 | 8 / 23 | 15 / 35 |

The preset's *value* chooses the caution bucket (low / mid / high → wreck pool and dominator curves); its *noise* is
the finish-draw width. At SS the width is multiplied **twice**: in the page by `__SS_NOISE_MULT` = cup **3.0** /
O'Reilly **1.5** / trucks **1.75** (07-11 walk-forward, Archive C), and in the engine by `GROUP_NOISE_MULT.SS =
1.75` (08-29, fit 2022-24 / holdout 2025-26). Effective SS widths in production: cup 16 × 3.0 × 1.75 = **84**,
O'Reilly 18 × 1.5 × 1.75 = **47.3**, trucks 23 × 1.75 × 1.75 = **70.4**. The 08-29 calibration reconstructed the live
R24 board (so the page multiplier is inside its baseline) and the cup sweep the same night found the minimum not
below 1.75, so production is what was validated. **Known discrepancy:** the `scripts/backtest-*.js` harnesses build
`cautionPreset` from `getCautionPresets()` directly and do *not* apply `__SS_NOISE_MULT` — every SS backtest since the
08-30 extraction (SS FL budget, SS re-judge, dom-groups SS cell) ran at 28 / 31.5 / 40 instead of 84 / 47 / 70. The
SS FL-budget ship judged FL MAE, which does not depend on the width, but any SS win / t5 result from a harness is not
production's number. Flagged 10-10 in this document; not yet fixed (fix = move the per-series multiplier into the
engine so both paths see it).

Per draw: `score_i = speedScore_i + startAdj_i + eps_i × noiseWidth`, eps standard normal, shaped by:

- **asymNoise** (09-07; O'Reilly and trucks at INT and SHORT only): a below-median car keeps `0.5 + speedPct` of an
  upside draw. Downside and the top half untouched. Cup lost on Brier (parity), SS and ROAD lose under every form.
- **carCeilFloor** (09-07; all series, all groups): a car with `lappedRate > 0.70` keeps `max(0.1, 1 − lappedRate)` of
  an upside draw. Everyone at or under 0.70 untouched.

### 3.2 Start sampling on projected grids (task #73, 07-28)

When >= 3 cars have projected starts with history, each draw samples every such car's start from his last-10 list
(+ N(0, .03)), ranks the samples into a grid, and adds `w.start × (sampledScore − fixedScore)` to the score. The
sampled grid also feeds DK place differential for those cars. The 0.7 cup shade on the fixed component cancels here;
sampling runs unshaded.

### 3.3 Attrition (who retires, and when)

**Budget.** `dnfRate` = the track's own measured DNF rate (`finish_status` not running, or laps < 90% of the winner;
per-race rates averaged) shrunk toward the series × correlation-group base with `conf = min(1, nTrackRaces/8)`,
clamped [0.03, 0.40] (08-30 refresh; cap raised for Daytona-class cells). Bases (`DNF_BY_GROUP`):

| | Short & Flat | Road | Intermediate | Superspeedway |
|---|---|---|---|---|
| cup | .091 | .095 | .155 | .255 |
| O'Reilly | .163 | .187 | .135 | .284 |
| trucks | .147 | .214 | .149 | .240 |

**Wreck model** (wreck-v1 / v1.1-cb, 07-28; per-bucket normaliser 08-31). The accident share of the budget
(`WRECK_ACC_SHARE` SHORT .63 / INT .70 / SS .85 / ROAD .50) is spent through multi-car events bootstrapped from real
races: each draw picks one race's event list from the pool for this track group × caution bucket (`WRECK_SETS`,
calm / typical / chaotic by total-caution terciles). An event of size `sz` at lap fraction `frac` seeds a random slot
in the running order and takes the next `sz` cars; each is retired with `p = min(.95, WRECK_P[bucket by size] ×
wScale)`; a survivor loses `WRECK_SURV_COST × (score range / (n−1))` points (SHORT 16 / INT 18 / SS 2.9 / ROAD 2.7 —
the 08-29 placement-tail calibration). `wScale = clamp((n × dnfRate × accShare) / WRECK_EV_EXP_B[group][bucket],
0.3, 8)` so realised accident DNFs land on budget for every bucket (08-31: boundary jump 73% → 3%). The mechanical
share `dnfRate × (1 − accShare)` retires each remaining car independently at a random lap. `WRECK_LL_B` (SHORT .71 /
INT 6 / SS 6 / ROAD .77) is how much of his laps led a DNF keeps, `min(1, dnfLap × B)` (gxc-v3.1-dnfLL).

**Per-car DNF, trucks only** (10-09, k = 32): the attrition multiplier for car i is
`clamp(((n_i × ownDnf_i + 32 × fieldMean) / (n_i + 32)) / fieldMean, 0.5, 2)` with `n_i = min(30, ownDnfN)`, rescaled
to mean 1 across the field so the budget is unchanged. Cup and O'Reilly fitted off (no information). `skillTilt`
(the 08-31 tilt curve) is **off** — the page never passes it.

`cautionMix` / `levelNormalize` are not passed by the page: one bucket per run, chosen by the preset.

### 3.4 Lapped traffic, O'Reilly only (10-10, k = 1.5)

A running lead-lap car is lapped in a draw with `p = min(.9, 1.5 × LAPPED_RATE[oreilly][group][start band] ×
(1 − speedPct))`; start bands P1-10 / 11-20 / 21-25 / 26-30 / 31+; a lapped car finishes behind every lead-lap car.
SS has no table (no-op). Cup and trucks fitted and failed — off. Operator-set `lapsDown` cars start laps down, and
each caution recovers a lap with p = .06.

### 3.5 Finish order

Sort: running before DNF; DNFs by later lap first; fewer laps down first; then score descending. Position 1..n per
draw accumulates `finishHist`, `posMatrix` (published, capped at 4,000 draws), win / t3 / t5 / t10, P25 / P50 / P75.

### 3.6 Laps led and fastest laps

Three questions per draw: **who is in what order**, **what share vector**, **how many laps are dealt**.

*Order.* INT: the strength pool (INT_DOM_V2, 09-03) — `dom(i) = speedScore + 0.5 × (score − speedScore) + k ×
noiseWidth × N(0,1)` with k = 0.5 for LL and 0.75 for FL, a separate order per target, so the leader is not by
construction the winner. SHORT / ROAD / SS: the draw's finish order.

*Share vector.* INT and SHORT, all series: **dominator bootstrap** (10-09, `domPools.js`) — one real 2022-24 race's
sorted LL and FL share vectors for this series × group × caution bucket (buckets with < 20 races pool the group).
ROAD and SS: the fixed mean curves `LL_CURVES_G` / `FL_CURVES_G` by group × bucket (gxc-v3, 07-25; SS low / high and
ROAD mid / high fall back to the pooled group curve). Beyond the vector's length the share decays × .75 (LL) / × .85
(FL) per rank.

*Tilt by speed* (`domSpeed: mult-v1`, task #71 part 2, 07-28; SS version 08-29): each rank's share is multiplied by
`1 + 1.1 × (spdPct − .5)` for LL and `1 + 1.0 × (spdPct − .5)` for FL, spdPct = practice-pace percentile (0.5 without
practice). At SS spdPct is the *speedScore* percentile instead, LL tilt `1 + 1.5 × (sp − .5)` × 1.5 for the top decile,
FL tilt `1 − 0.45 × (sp − .5)` (FL share rises down the field at plate tracks). DNF'd cars keep `__wLL` of their
weight.

*Laps dealt.* LL: every race lap. FL: `round(totalRaceLaps × flBudget)` with flBudget = **.7794 at INT** (INT_DOM_V2)
and **.6938 at SS** (`SS_FL_BUDGET`, 10-10); SHORT and ROAD deal every lap (the over-count props up the flat top-end
order there — 10-10 dom-groups, deliberately not shipped). Rounding remainder goes to the leader.

### 3.7 DK points per draw

`dkFinishPts(finish) + (dkStart − finish) + 0.25 × lapsLed + 0.45 × fastestLaps`, with `dkStart` = the listed grid
spot (qualified spot for rear-override cars; the sampled start on projected boards). Up to 10,000 sampled rows feed
the GPP optimizer (`__dkSamples`).

Outputs per car: projFinish, projLapsLed, avgFastLaps, dnfPct, projDK, projPlaceDiff, win / t3 / t5 / t10 %, finish
quartiles; sorted by projDK.

---

## 4. What the published config stamps mean

`lapFeature` v1-0.15 / off · `carCeilFloor` v1-0.70 · `carDnf` v1-k32 / off · `lapTraffic` v2-k1.5 / off ·
`projShade` v1-0.7 (cup) / v2-1.0 · `emptyPractice` corrHistory (O'Reilly) / prorata · `domBoot` v1-INT|SHORT / off ·
`asymNoise` v1-upside-0.5 / off · `practiceMetric` best5 / overall_avg · `poolScope` series-only · `borrowMode`
car-auto-v2 · `recencyCw` 2 / 3 · `pitCrew` v1-0.06-fenced · `domCurves` int-dom-v2 / ss-flbudget-v1 /
gxc-v3.1-dnfLL · `domSpeed` mult-v1 · `startProj` trail10-v4-form / trail10-v3.5-eqStart · `dnfModel` wreck-v1.1-cb ·
`marketAnchor` v1.4-multimkt. A board's `config.caution` is the *base* preset; at SS the run used base × series
multiplier (section 3.1).

---

## 5. Per-series summary (the differences, in one place)

| mechanism | cup | O'Reilly | trucks |
|---|---|---|---|
| current-season age weight | 2.0 | 3.0 | 3.0 |
| practice metric | best5 | overall_avg | best5 |
| projected-start form term | v4 (beta by group) | v4 (own betas) | none |
| projected-start shade | 0.7 | 1.0 | 1.0 |
| empty practice weight | pro rata | → corrHistory | pro rata |
| laps-down mean penalty | off | 0.15 | 0.15 |
| asymmetric noise (INT/SHORT) | off | on | on |
| per-car ceiling (rate > .70) | on | on | on |
| per-car DNF | off | off | k 32 |
| lapped traffic | off | k 1.5 | off |
| SS page noise multiplier | 3.0 | 1.5 | 1.75 |
| SS weights | SUPERSPEEDWAY | ONEILLY_SS (+winConv) | SUPERSPEEDWAY |
| trucks SHORT start weight | — | — | .33 |
| dominator bootstrap INT+SHORT | on | on | on |
| interim manual rule | — | — | no win FADE on the top-rated car (10-09) |

Everything else (wreck model, DNF bases, dominator curves and tilts, FL budgets, DK scoring) is per *track group* and
shared by the three series.

---

## 6. Stripped 10-10 — nothing in the code is OFF any more

Every registered-study flag that never shipped was removed from `simEngine.js` on 10-10 (commit after f3f8405; that
commit has all of them): tierStart, topStretch, passDiff, projShadeElite, dropEmptySlots, the trackHistory / startPos
/ corrHalf empty-practice destinations, skillTilt / DNF_TILT_CURVE / DNF_TILT_LEVEL, cautionMix, levelNormalize, the
perBucketEV / wideClamp opt-outs, seriesNoiseMult, topNoise, tierClip, carVol, upperUpside, domTopDamp, __finSamples.
The harnesses whose only purpose was one of those arms were deleted with them (tierstart, topstretch, noise, topnoise,
tierclip, empty-slot, caution-mix, the six tilt scripts, gate-cliff-final, features, preboard2); their results stay in
BACKTEST_LOG and `scripts/backtest-data/*-fit.json`. Verified on a seeded RNG stream: the stripped engine's output is
identical to f3f8405 at INT / SHORT / SS / ROAD with the production configs.

What remains configurable in `simConfig` is the shipped mechanism set and its carriers: `asymNoise`, `carCeilFloor`,
`carDnf {k}`, `lappedTraffic {series,k}`, `domBoot`, `domPool` / `domAlpha` / `domK` / `domKFL` / `domCurves` /
`flBudget` (the INT and SS defaults flow through these), `startSampling`, and the `__domDiag` diagnostic hook. In
`opts`: `lapPenalty`, `projShade`, `emptyPracticeTo: 'corrHistory'`.

---

## 7. Open decisions touching the engine (as of 10-10)

- **Cup tiered pre-board shading** (field lam .5, top-5 lam .7): passes 5 of 6 registered rails on the 2025-26 cup
  pre boards, misses the winner's-sim-rank rail by .03 of a place (6.92 → 7.20 vs a .25 allowance) where that metric's
  own run-to-run noise is .06–.13. Cup pre boards only; post boards unaffected. Operator call open; the engine runs
  the 07-25 flat 0.7 until it is made.
- **Harness vs production SS noise** (section 3.1) — decide whether to move `__SS_NOISE_MULT` into the engine.
- **Trucks favourite** (stated 22% / realised 48% on 2025-26): season-end refit on 2025-26 with 2027 as judge; the
  interim rule is manual (PITBOARD_MANUAL).
- Season-end refits queued: trucks favourite clip family, INT / SHORT dominance curves, strength order outside INT,
  finer shading grid.

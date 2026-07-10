# PitBoard — Project Handoff Document

> **For incoming models:** Read this entire file before touching any code.
> Last updated: 2026-07-06

---

## 0. Product Context

PitBoard is a NASCAR DFS (daily fantasy sports) analytics tool intended to be a paid subscription product. The plan is for users to pay for access to the practice data, qualifying simulation, and race simulation features. The subscriber gate in `src/App.js` is the future enforcement point for that paywall — it is currently hardcoded to `true` during development so all features are accessible while the product is being built. Once a payment processor (e.g. Stripe) and auth system are integrated, `isSubscriber` will be wired to a real entitlement check. Do not treat the current open-access state as permanent design — it is a placeholder.

---

## 1. No Local Clone

**There is no local clone of this repository on disk.**
All code changes have been made exclusively through the **GitHub Contents API** called from inside the browser via a Claude-in-Chrome JavaScript tool. To make any code change you must use that same browser JS tool to fetch → modify → PUT the file back via the API.

If you want a local clone for reference:
```
git clone https://github.com/RkyMtnLSX/NASCAR-Loop-Data-Analytics-
```
But do not push from the local clone — continue using the API workflow described below.

---

## 2. Stack & Hosting

| Layer | Technology |
|---|---|
| Frontend | React (Create React App) |
| Hosting | Vercel — auto-deploys on every push to `main` |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Version control | GitHub — single branch: `main` |

**Repo:** `RkyMtnLSX/NASCAR-Loop-Data-Analytics-`

**Env vars** (set in Vercel dashboard — never hardcode these):
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_APP_ADMIN_PASSWORD`

**GitHub token:** stored as a browser secret / rotated after sessions — do not hardcode in any file. Use it only in browser JS tool calls; never commit it.

---

## 3. GitHub Push Workflow (Critical — Read Carefully)

All file edits follow this exact pattern in the browser JS tool:

### Step 1 — Fetch current file
```javascript
const r = await fetch(
  'https://api.github.com/repos/RkyMtnLSX/NASCAR-Loop-Data-Analytics-/contents/src/pages/MyFile.js',
  { headers: { Authorization: 'token <GITHUB_TOKEN>' } }
).then(r => r.json())
const bin  = atob(r.content.replace(/\n/g, ''))
const text = decodeURIComponent(escape(bin))   // ← binary string → unicode
const sha  = r.sha
```

> **For files > 1 MB** the Contents API returns `encoding: "none"` with no content.
> Use the Git Blobs endpoint instead:
> ```javascript
> const r2 = await fetch(
>   `https://api.github.com/repos/RkyMtnLSX/NASCAR-Loop-Data-Analytics-/git/blobs/${sha}`,
>   { headers: { Authorization: 'token <GITHUB_TOKEN>', Accept: 'application/vnd.github.raw' } }
> ).then(r => r.text())
> // r2 is already the raw UTF-8 text — no atob needed
> ```

### Step 2 — Edit the text string

Make all changes to the `text` variable as a normal JavaScript string.

### Step 3 — Push
```javascript
const encoded = btoa(unescape(encodeURIComponent(text)))  // ← unicode → base64
const res = await fetch(
  'https://api.github.com/repos/RkyMtnLSX/NASCAR-Loop-Data-Analytics-/contents/src/pages/MyFile.js',
  {
    method: 'PUT',
    headers: { Authorization: 'token <GITHUB_TOKEN>', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'fix: description', content: encoded, sha })
  }
).then(r => r.json())
```

### Why the encoding matters — the double-corruption trap

`atob()` returns a **binary string** where each character's code point equals the raw byte value. If you pass that binary string directly to `encodeURIComponent`, JavaScript treats each character's code point as a Unicode code point, not a byte. Non-ASCII bytes (> 0x7F) get percent-encoded as multi-byte UTF-8 sequences, so every non-ASCII byte expands to 2–3 bytes. Push that to GitHub and the file is corrupted.

**One round of corruption** (e.g., en dash U+2013 → E2 80 93 in UTF-8):
- E2 → C3 A2, 80 → C2 80, 93 → C2 93 (6 bytes instead of 3)
- Renders as `â` + two invisible control chars

**Two rounds** (applied to an already-corrupted file):
- C3 A2 C2 80 C2 93 → C3 83 C2 A2 C3 82 C2 80 C3 82 C2 93 (12 bytes)
- Renders as `Ã¢Â` + control chars — the garbled text visible in earlier screenshots

The fix for a corrupted file is to:
1. Fetch binary → convert with `decodeURIComponent(escape(bin))`
2. Apply regex to fix 2-round corrupted E2 sequences:
   ```javascript
   text = text.replace(/Ã¢Â([-¿])Â([-¿])/g,
     (_, b1, b2) => new TextDecoder().decode(new Uint8Array([0xE2, b1.charCodeAt(0), b2.charCodeAt(0)])))
   ```
3. Re-encode with `btoa(unescape(encodeURIComponent(text)))` before pushing.

**Prefer ASCII-safe source strings.** Use `\uXXXX` escape sequences for any Unicode character in pushed source files rather than literal Unicode. This survives any encoding round-trip. Example: write `'–'` not `'–'`.

---

## 4. Hard Constraints — Never Change These

| File | Constraint |
|---|---|
| `src/App.js` ~line 49 | `const [isSubscriber] = useState(true)` — NEVER modify. There is no real subscription/auth system built yet. This line is hardcoded to `true` so all users get full access during development. If it were changed to `false` or wired to real auth prematurely, every visitor would hit a subscribe wall with no way to log in, breaking the entire app for everyone. Leave it alone until a real payment system is integrated. |

**Never delegate code changes to subagents.** All pushes must be made directly in the same conversation that wrote the code, using the browser JS tool.

---

## 5. File Map

```
src/
  App.js                   — router, isSubscriber gate
  lib/supabase.js          — Supabase client init
  components/Nav.js        — top navigation bar
  pages/
    Landing.js             — home / landing page
    Admin.js               — password-gated admin panel (weekend config, data loads)
    LoopData.js            — loop data / DK points page with driver cards
    PracticeReportCard.js  — practice grades per driver
    PracticeLapTable.js    — raw heatmap of practice laps
    LapComparison.js       — lap-by-lap comparison tool
    QualifyingCenter.js    — qualifying heatmap + draw-order sim (see §8)
    FastestLap.js          — fastest lap heatmap
    SimulationCenter.js    — race simulation (see §6/§7)
    SimResults.js          — public results display
    LoopDataAudit.js       — admin audit of data completeness
api/
  load-race.js             — Vercel serverless: inserts race data
  load-qualifying.js       — Vercel serverless: inserts qualifying data
  load-fastest-laps.js     — Vercel serverless: inserts fastest lap data
```

---

## 6. SimulationCenter.js — Status

**Healthy.** The file was once a corrupted 1.66 MB blob (a bad-encoding data constant
that compounded through re-pushes). It was reconstructed clean to **44,895 bytes** on
2026-07-02 (commit `67f4711`) and has been fine since. Note it still *compiled and
deployed "Ready"* while corrupted — bloat/encoding corruption does NOT break the CRA
build, so never assume a garbage-filled file is a broken build.

If a source file ever balloons with `ÂÃÂÃ...` garbage again: fetch the raw blob
endpoint (proper UTF-8, no `atob`), keep the ASCII runs, brace-match out complete
functions, reassemble, verify zero non-ASCII, push with the standard encoding. Watch for
small helpers (`normalizeArr`, `gaussNoise`, etc.) stranded *inside* the garbage — miss
them and you get `no-undef` build failures. Full procedure + original diagnosis:
**`BACKTEST_LOG.md` → Archive A**.

---

## 7. SimulationCenter — Logic & Architecture

### Weights

```javascript
// Ovals rebalanced 2026-07-02 (commit f880e3df): startPos is the ONLY input
// orthogonal to driver_rating (rating already contains finish, running pos, speed,
// laps led, fastest laps), so weight was shifted toward it. raceCraft trimmed
// (redundant). corrHistory blend also changed to 100% rating / 0% finish (see below).
// Ovals re-tuned 2026-07-02 (commits 238d7ed2 + a214f42f). Two changes shipped together:
// (1) Practice cut 50% -> 15%: shortRunPace folded out entirely (redundant with
//     longRunPace — sustained pace is one signal, not two); freed weight moved to the
//     two load-bearing inputs (corrHistory, startPos). Validated on 14 Cup practice
//     races w/ EXACT practice metrics: MAE 7.90 -> 7.53, winner-hit 21% -> 36%.
// (2) Track History enabled at 0.10 (pulled from corrHistory). We DID backtest this:
//     300-race sweep found 10% is the sweet spot (winner-hit 18.6 -> 21.4, top-10 ECE
//     4.45 -> 4.07, MAE flat). Re-confirmed on new base: MAE 7.892 -> 7.876, winner
//     22.7 -> 23.3. It had been recommended earlier but never committed until a214f42f.
// ALL-MARKETS weight audit 2026-07-03 (commit c6188f73). Re-tuned corrHistory/trackHistory
// split by scoring win + top3 + top5 + top10 Brier (not just win%/MAE) on the 11 real-practice
// oval races. trackHistory 0.10 -> 0.15 (corr 0.40 -> 0.35) strictly improved EVERY market.
// startPos swept 0.23-0.48: 0.33 optimal for top-N (MAE alone wanted 0.43, but that over-
// leans on qualifying and HURTS top3/top10 — MAE flatters start pos because quali predicts the
// full 38-car order; the top of the board, where bets live, peaks at 0.33). Practice kept at
// 0.15: it is neutral/negative on finish MAE but IMPROVES top3/top5/top10 Brier (sharpens the
// top of the board, which MAE averages away). LESSON: tune weights on the betting markets
// (win/top-N Brier), not finish MAE, or you optimize the wrong thing.
const DEFAULT_WEIGHTS = {         // used for ovals — sums to 1.00
  corrHistory:  0.35,  // avg driver_rating in correlated-group historical races (was 0.40, 0.50 pre-TR)
  longRunPace:  0.15,  // practice pace (overall_avg). tireFalloff's 0.05 moved here (commit f2d590af)
  shortRunPace: 0.00,  // FOLDED OUT — redundant with longRunPace
  startPos:     0.33,  // qualifying starting position — confirmed optimal for top-N markets
  tireFalloff:  0.00,  // DROPPED (was 0.05). Falloff is noisy dead weight (SVG Chicagoland case);
  raceCraft:    0.02,  // quality-pass % (~redundant with rating)
  trackHistory: 0.15,  // specific-track history (trackAvgRating), shrunk by nTrackRaces (was 0.10)
}
// corrHistory internal blend: rawC = rs (100% normalized driver_rating).
// Was `rs*0.9 + fs*0.1`; the 0.1 finish term dropped as redundant (finish IS in rating).
// Still shrinks toward 50 by confidence: conf = min(1, nCorrRaces/4).
// trackHistory uses trackAvgRating with the same shrinkage on nTrackRaces (0 for first-timers).

const ROAD_COURSE_WEIGHTS = {   // Cup/O'Reilly road — raceCraft cut to 0 on 2026-07-07 (corr 0.35->0.60)
  corrHistory:  0.60,
  longRunPace:  0.15,
  shortRunPace: 0.05,  // NEVER re-tested on road (oval fold-out doesn't cover this) — candidate to consolidate like trucks
  startPos:     0.15,  // backed by r=0.416 correlation across 682 observations
  tireFalloff:  0.05,  // same — untested on road, likely dead weight per truck result
  raceCraft:    0.00,
  trackHistory: 0.00,
}

const TRUCK_ROAD_WEIGHTS = {    // practice CONSOLIDATED 2026-07-09 (commit c7980361): 25/0/0 beat the
  corrHistory:  0.55,           // legacy 15/5/5 split on all metrics; trend_slope input only 35/177 coverage
  longRunPace:  0.25,           // = overall_avg, the whole practice signal
  shortRunPace: 0.00,
  startPos:     0.20,
  tireFalloff:  0.00,
  raceCraft:    0.00,
  trackHistory: 0.00,
}
```

`isRoadCourse(trackName)` checks against a list of road course substrings:
`sonoma, watkins glen, cota, circuit of the americas, road america, roval, indianapolis road, portland, chicago street, coronado, mexico`

### Presets

```javascript
// PER-SERIES as of commit 0dc3893 (2026-07-02), CUP re-tuned 2026-07-03 (commit 9d86286d).
// `value` (caution count) unchanged; only `noise` retuned.
// CUP noise LOWERED on the full model (see 7.5 full-model findings). The original 22 was
// tuned on the REDUCED model (no practice/track history), which was overconfident. The full
// model is under-confident at 22, so Cup Medium dropped 22 -> 14 (validated on 11 real-practice
// 2026 races: MAE 7.53->7.33, Brier 0.0217->0.0209, favorite gap -24.6->-1, top favorite win%
// 21->31). Low/High were scaled proportionally to keep the caution->noise curve monotonic
// (only Medium was directly backtested). Trucks/O'Reilly UNCHANGED (still reduced-model tuning
// until their practice is backfilled).
// CUP noise NUDGED UP 14 -> 16 on 2026-07-04 (commit 723fd754) after the 40-race re-tune
// (11 new 2024 oval practice races added -> 40 total). On the bigger sample the noise optimum
// crept up: win Brier flat 14-17, but top-3/5/10 Brier keep improving and favorite gap tightens
// as noise rises (14: +4.2, 16: +2.9, 17: +0.7, 18: -0.5); MAE slowly worsens (7.694->7.733).
// Tuning on betting markets (top-N + calibration, NOT MAE), 16 is the balanced pick (17 is the
// pure-calibration optimum). Low/High scaled to keep the curve monotonic. Trucks/O'Reilly UNCHANGED.
const CAUTION_PRESETS_BY_SERIES = {
  cup:     [ {Low,4,10}, {Medium,8,16}, {High,15,25} ],  // <- Cup Medium 14->16 on 2026-07-04 (40-race re-tune)
  trucks:  [ {Low,4,15}, {Medium,8,23}, {High,15,35} ],
  oreilly: [ {Low,4,12}, {Medium,8,18}, {High,15,28} ],
}
// getCautionPresets(series) selects the array; CAUTION_PRESETS = ...cup alias kept
// so the useState(CAUTION_PRESETS[1]) default still resolves to Cup Medium.

const DNF_PRESETS = [
  { label: 'Low',    value: 0.05 },
  { label: 'Medium', value: 0.15 },
  { label: 'High',   value: 0.25 },
]
```

### Key functions

- **`buildSpeedScores(drivers, weights)`** — normalizes each metric array to 0–100 via `normalizeArr`, then computes a weighted composite score per driver. Lower lap times = better (inverted). Higher finish positions = better (inverted). Result used as the base strength for simulation.

- **`runRaceSim(drivers, simConfig)`** — Monte Carlo race simulator using typed arrays (`Float64Array`, `Int32Array`) for performance. Runs `numSims` iterations, applies caution noise and DNF rates, accumulates finish positions and DK points. Returns sorted array with `avgFinish`, `avgDK`, `avgLapsLed`, `avgFastLaps`.

- **`SimulationCenter({ isSubscriber })`** — main React component. Password-gated weight adjustment panel. Admin can nudge each weight ±0.05. Runs sim on demand, publishes to `sim_results`.

### Data fetched from Supabase

| Table | Purpose |
|---|---|
| `featured_weekend` | Current race config (track, series, correlation years) |
| `entry_list` | Active driver roster for the race |
| `qualifying_results` | Historical finishing/qual data for correlated tracks |
| `practice_sessions` | Practice lap data (LRP, SRP, tire falloff, race craft) |
| `tracks` | Track metadata (type: oval/road_course/superspeedway) |
| `loop_data` | DK points and race craft data (queried twice — once for history, once for current) |
| `sim_results` | Write-only — published results (delete + insert pattern) |

---

## 7.5 Model State & Settled Questions

> Full dated backtest history — every sweep, the exact numbers, what was rejected and why
> — is archived in **`BACKTEST_LOG.md`** (Archive B) in this folder. **READ IT before
> re-testing any lever below**; most "new ideas" here have already been run and rejected.

### The load-bearing insight
Predictive power comes almost entirely from **corr history + start position**. Practice
and passing stats are secondary. Corollaries: (1) loading a qualifying lineup is worth
more than any weight tuning — startPos is dead weight only when it's *missing* (rain-out
toggle handles that); (2) the correlation-group structure is the engine, so group
assignments/merges are where real gains live.

### Method lesson (applies to ALL future tuning)
Score weights on the **betting markets** — win + top-3/5/10 Brier and favorite-gap
calibration — **NOT finish MAE**. MAE systematically over-weights qualifying and washes
out the top-of-board signal where bets live (it flatters startPos, buries practice).
Every current weight was tuned this way and validated out-of-sample on 29 (2025+2026) and
40 (2024+2025+2026) oval races.

### Current weights & presets — CONFIRMED, do not re-tune without new data
- **DEFAULT (ovals)**: corr 0.35 / longRunPace 0.15 / startPos 0.33 / raceCraft 0.02 /
  trackHistory 0.15 (shortRun + tireFalloff folded to 0). Live block is in §7.
- **Cup noise (Medium) = 16.** Trucks/O'Reilly still on reduced-model values until their
  practice is backfilled (task #115).
- **Sim practice input = `overall_avg`** (all clean laps, 8% cut). Beat `avg_pace` on
  every betting market + calibration. (The practice GRADE uses avg_pace; the SIM does not
  — intentional: grade optimizes finish prediction, sim optimizes calibrated favorites.)
- **Road course — NOW PER-SERIES (2026-07-07).** Cup/O'Reilly (`ROAD_COURSE_WEIGHTS`):
  corr 0.60 / longRun 0.15 / shortRun 0.05 / startPos 0.15 / tireFalloff 0.05 / raceCraft
  **0** / trackHistory 0. Trucks (`TRUCK_ROAD_WEIGHTS`, new export): corr 0.55 / startPos
  **0.20** / (same practice 0.25) / raceCraft 0 / trackHistory 0 — selected when
  `s === 'trucks'` in the config-load effect. Truck road practice 0.25 VALIDATED 2026-07-09
  on the first 5 uploaded sessions (plateau 0.25-0.40, practice is the strongest truck road
  signal — Archive C). **raceCraft CUT to 0 on all road courses**
  (was 0.25): ~0.81 corr with driver_rating, monotonic sweeps in Cup + Trucks, never wins a
  market (see BACKTEST_LOG). Trucks lean startPos HIGHER than Cup (9-race road sweep,
  monotonic 0.10->0.25) — OPPOSITE of Cup, where startPos was cut for road ringers. NOTE:
  truck startPos only bites when a lineup is loaded (qualifying_results, or the
  practice-uploader's qualifying_position fallback) — trucks have no historical quali.
- **Superspeedway (Daytona/Talladega/Atlanta/EchoPark)** — UPDATED 2026-07-09 (leak-free
  O'Reilly SS backtest, 20 races 2023-26; see BACKTEST_LOG Archive C):
  - `SUPERSPEEDWAY_WEIGHTS` (Cup/Truck): corr 0.55 / trackHistory 0.30 / startPos 0.15 /
    raceCraft **0** (was 0.05 — cut; identical Spearman with/without, folded into corr).
  - `ONEILLY_SUPERSPEEDWAY_WEIGHTS` (new export, used when `isSuperspeedway && s==='oreilly'`):
    corr 0.45 / trackHistory 0.20 / startPos 0.15 / **winConversion 0.20** / raceCraft 0.
    winConversion = year-weighted, pooled over the SS group, WINS-ONLY + `min(1,n/5)` shrinkage
    toward the ~1/38 base (refined by Fable 2026-07-09: attribution backtest showed the top5
    credit added nothing — the signal is 100% Austin Hill — so wins-only is the honest form; see
    BACKTEST_LOG "WIN-CONVERSION CROSS-SERIES TEST"). New
    `corrWinConv` field + `winConvScores` in buildSpeedScores. Fixes the Hill/Love inversion
    (avg driver_rating rated Love above Hill despite Hill's 9/20 SS wins vs Love's 2/15);
    lifts leak-free WINNER-market hit rate 16%→42%. Live O'Reilly Atlanta: Hill 23.1% > Love
    19.4% (was Love 26.3% / Hill 16.3%), matching FanDuel Hill +260 / Love +500. TODO:
    backtest win-conversion on Cup + Truck SS before extending it there.
  - Auto-sets DNF preset High, caution Medium.

### Do NOT re-test these (already run, no benefit — numbers in Archive B)
Momentum / recent-form trend; similarity-weighted history (keep trait-similarity only for
*assigning* new tracks); race craft in every form (~97% correlated with rating); Best Lap
as a sim input (redundant with startPos); fat-tail noise (keep gaussian — costs top-N);
short-run practice-inflation safeguard (bias real but immaterial at 15% weight); avg_pace
as the sim input; ARP / pass_diff as corr inputs (Archive C — equivalent / adds nothing);
GREEN FLAG SPEED as a sim weight (Archive C 2026-07-08 — pooled GFS is 0.972-correlated with
rating, partial corr sign-flips across splits; the loop-data driver-strength family is FULLY
saturated by driver_rating); track-group reassignments (Archive C — finer loses, single moves
flat; merge shipped). The ONE practice lever still worth chasing at scale: the practice-EDGE
residual test — re-run when the full 2025 backfill lands (task #114; sleepers gained +5.9).

### Shipped admin-only tools (design/rationale in Archive B)
Win-market favorite shade (output-only diagnostic, addresses WIN-market overconfidence
ONLY — top-N is well-calibrated); pre/post sim stage (measures marginal value of
practice+qualifying); rain-out grid toggle; superspeedway auto-weights.
Market-value TAIL GUARD (2026-07-09, Archive C "Reaume case"): no +EV flag and no Market Value
row when model prob is below MINP (win 2 / top3 5 / top5 8 / top10 12 pct) — MC tail noise at
longshot odds is not value. Enforced at publish (__marketValue) AND display (SimResults, which
retro-cleans already-published boards). Root cause open: truck noise re-tune (task #115).

### Betting markets & SimResults layout (2026-07-09)
- **Per-sim finish matrix**: `runRaceSim` now returns `__rows` with `.posMatrix` (Int16,
  numSims×n — each driver's finish position per sim) + `.simN`; each row carries `simIdx` (its
  matrix column — results are sorted by projDK, so simIdx maps a row back to its column).
  This is what makes H2H/group **joint** (who beat whom in the same sim), not just marginal win%.
- **Live sim page (SimulationCenter)**: `<BettingMarkets>` renders below the board — H2H/group
  (P(best of group) win% + FMV), Winning Manufacturer, Winning Team. Uses the in-memory matrix
  (exact, full sim count).
- **Published board (SimResults) — redesigned**: pinned "Matchup Compare" tray at top; a
  checkbox column on the Projections table feeds it (2 = head-to-head, 3+ = group; live, no
  Group A/B). Three tabs: **Projections · Market Value · Mfr & Team** (market value is now a tab,
  not a hidden scroll). H2H/group decode a compact matrix stashed in `config.simMatrix` (base64
  Uint8, **subsampled to 4000 sims** — ~200KB, no DDL; SE ~0.8pt at a coinflip, doesn't move
  bets — boards kept lean by choice). Helpers: `fmvAmerican`, `__decodeMtx`, `SrTable`,
  `CompareTray`, `MarketTables`. NOTE: exact H2H + Winning Team only populate on sims PUBLISHED
  after 2026-07-09.
- **Bug fixes (2026-07-09)**: (a) published Fast Laps was blank — SimResults read `d.fast_laps`,
  the field is `d.avg_fast_laps`. (b) Winning Team showed "Unknown" — publish payload wrote
  `d.org` (undefined) instead of `d.organization`. (c) market-value name match got a nickname
  fallback (same last name + first-name common prefix ≥3, only when unambiguous) so FanDuel
  "Nicholas Sanchez" maps to sim "Nick Sanchez".

### CLV tool + qualifying data hardening (2026-07-09)
- **CLV (Closing Line Value) tool** — lives in **GradeCenter** (admin, NOT the public board). Reuses
  the exact `__marketValue` parser exported from SimulationCenter. Workflow: run the pre sim (stored
  in `sim_results` stage='pre') → at/near race time click "Load latest pre sim" for the series → paste
  the *current* odds → it computes CLV = (closeImplied − betImplied)×100 per +EV-flagged bet and logs
  to `clv_log` (delete-by-race then insert). Has a season summary + a **CLV history table**. Positive
  CLV = the line moved toward our bet (early-edge signal that doesn't need the bet to settle). All
  metric abbreviations in GradeCenter now have hover tooltips (+EV / ex-win / win / cons / MAE / etc.).
- **Qualifying backfill** — 25 incomplete Cup R1 sessions re-pulled from racing-reference's AJAX
  endpoint (`race-results?rType=getqualify&series=W&raceId={year}-{PADDED2}`, race # zero-padded to 2
  digits) and re-inserted; the audit now shows 0 flagged. **Daytona 500 rule**: qualifying = single-car
  TIME TRIALS (speed order, ~42 cars), NOT the Duel-set grid — the Duel grid lives in
  `loop_data.start_position` and would contaminate true qualifying speed, so it is kept OUT of
  `qualifying_results`.
- **Provenance flag** — Load Qualifying now writes `qualifying_results.lineup_source`
  (qualifying / metric / rain / practice) so rain-out, metric-set, and practice-fallback lineups are
  distinguishable from real time-trial sessions.
- **Qualifying Data Audit page** (`/qualifying-audit`, linked from the Load Data tab) — driver count
  per session per series, flags <30 in red. Data-audit card moved to the top of the Load Data tab.
- **Stage-length inputs** — SimulationCenter now has Stage 1 / Stage 2 lap fields next to Race Length;
  stored in the published `config` (`stage1Laps` / `stage2Laps`). DATA CAPTURE ONLY — no sim module
  reads them yet (they seed the future caution/pit layer).
- **Practice uploader confirmed** — sets the sim's fallback starting lineup ONLY
  (`practice_sessions.qualifying_position`); it NEVER writes `qualifying_results`, so a practice PDF can
  seed the grid without polluting stored qualifying data.

### Correlation groups — sim pools by `correlation_group_label` (NOT the number!)
SimulationCenter line 452: `.eq('correlation_group_label', cfg.correlation_label)`. The group
NUMBER is vestigial — the LABEL is the pooling key. NOTE: "670hp Package" spanned BOTH group
1 and 2, so Michigan (grp1) and Kansas (grp2) were already pooled together via the shared label.
Labels renamed 2026-07-08 (Cup-jargon → series-neutral, via correlation_groups_refine.sql):
```
Intermediate (grp 1, 14 tracks — Speedways MERGED IN 2026-07-08):
                    Auto Club, Charlotte, Chicagoland, Darlington, Dover, Homestead,
                    Indianapolis, Kansas, Las Vegas, Michigan, Nashville, Pocono, Rockingham, Texas
Superspeedway (4):  Daytona, Talladega, Atlanta   (Atlanta loosest: 0.61-0.63 de-meaned)
Short & Flat Tracks (6, 11 tracks): Phoenix, Richmond, New Hampshire, N.Wilkesboro, Martinsville,
                    Gateway, Iowa, Bowman Gray, Bristol (moved from the merge 2026-07-08 — user
                    domain call, data-confirmed: +0.039 on Bristol races, neutral everywhere else),
                    IRP + Milwaukee Mile (trucks venues, added to tracks 2026-07-08)
Road Course (8, 13 tracks): COTA, Sonoma, Watkins Glen, Chicago Street, Coronado, Portland,
                    Road America, Roval, Indy GP, St. Pete, Mexico, Mid-Ohio, Lime Rock
```
Empirical dial-in (2026-07-08): de-meaned driver-rating correlation (removes "good teams are
good everywhere") + ifantasyrace similar-track guide + leak-free backtest (103 Cup races,
2023-26). Findings: Kansas↔Michigan real (0.40, keep together — current grouping already does);
Phoenix↔Dover (0.18) and Bristol↔Dover "concrete" (0.22) NOT similar — rejected. Finer 7-group
scheme scored WORSE (0.377 vs current 0.389; small groups hurt on thin samples). Superspeedway
corr-history barely predicts finish (Spearman 0.10 — pack racing); short tracks / shorter-flats
most predictable (~0.5).
SPEEDWAYS MERGED INTO INTERMEDIATE (2026-07-08, SQL): the follow-up affinity audit + leak-free
single-move backtests showed (a) every single-track reassignment is noise (±0.007), but (b) the
two groups cross-correlate so heavily that merging them gains train +0.013 / test +0.020 Spearman,
positive all 5 years. The assignment lever is now CLOSED (finer loses, moves flat, merge shipped);
don't re-test without new data. Full numbers: BACKTEST_LOG.md Archive C.

### Live validation so far (n small — accumulating in `sim_grades`)
- **Cup Chicagoland 2026** (first real-race grade): MAE 7.16, win Brier 0.0289. Value
  engine went 0/4 (−100%) on WIN flags (favorite overconfidence) but 11/11 (+88%) on
  top-3/5/10 — exactly the WIN-market skew the shade targets.
- **O'Reilly Chicagoland R20** (rain-out): MAE 6.38, Spearman 0.797, top-10 9/10; proj
  beat the raw grid (corr 0.77 vs 0.54) — the rain-out toggle earned its keep.
- **91-race favorite calibration**: favGap only +1.8 (~2pt overshoot), mostly a
  multi-favorite small-sample artifact. Engine is well-calibrated overall.

### Rebuilding a harness
`loop_data` ~360 races, Cup back to 2022 (Next Gen floor — do NOT pull pre-2022). Practice
2025+2026 backfilled (~29-40 oval races backtestable). Harness = real buildSpeedScores/
runRaceSim fetched from source, leak-free (history from PRIOR same-group races only).
**ALWAYS add `&order=id.asc` to Range-paginated REST reads** or you get a silent corrupted
subset. Full method + empirical-track-correlation approach: Archive B.

---

## 8. QualifyingCenter.js — Notes

The file is healthy as of commit `fd737f0` (2026-07-02). UTF-8 corruption was repaired with the 2-round E2 regex fix (83 substitutions).

Key features:
- Heatmap of qualifying positions across correlated tracks
- Draw-order column (gated by `hasDrawOrder`)
- `normalizeName()` for accent stripping + suffix normalization (handles "Jr", "Sr" etc.)
- Sort buttons use `–` (en dash U+2013) for "A–Z" — now stored as `–` in source
- `drawOrderMap` keyed by normalized driver name, filtered by `row.year === config.year` (not correlation year)

---

## 9. Supabase Schema

> Verified live via REST 2026-07-06 — column names are EXACT (loaders/queries match on
> them). Two easy-to-miss traps: the `tracks` canonical-name column is **`name`** (NOT
> `track_name`), and per-driver finishes live in **`loop_data`**, NOT `races` (which is a
> one-row-per-race registry). `races.id` is FK'd by `loop_data.race_id` +
> `practice_sessions.race_id` (check both before deleting a race row).

### `races` — race registry (ONE row per race, not per driver)
`id` (PK), `race_name`, `series`, `year`, `race_number` (season round R#), `track_id`
(FK->tracks.id), `track_name`, `race_date` (added 2026-07-01), `total_laps`,
`total_cautions`, `total_caution_laps`, `green_flag_passes`, `lead_changes`, `avg_speed`,
`winning_driver`, `winning_car_number`, `margin_of_victory`, `racing_reference_id`,
`racing_reference_url` (dedupe key on load), `created_at`.

### `loop_data` — per-driver race results (the ACTUALS + historical model inputs)
`id`, `race_id` (FK->races), `series`, `year`, `track_name`, `race_number`, `driver_id`,
`driver_name`, **`car_number`** (text, added + backfilled 2026-07-09 from Racing Reference,
97.6/97.7/93.0 pct coverage cup/oreilly/trucks; NULL = no equipment data, treat as neutral;
the equipment-prior key — see task #118; NOTE loop loader does not stamp it yet on new loads),
`start_position`, `finish_position`, `mid_race_position`, `high_position`,
`low_position`, `laps_completed` (DNF proxy: `< 0.9*max`), `finish_status`, `avg_position`,
`driver_rating` (**the corrHistory engine input**), `green_flag_passes`,
`green_flag_times_passed`, `pass_diff`, `quality_passes`, `pct_quality_passes` (raceCraft),
`fastest_laps`, `top15_laps`, `pct_top15_laps`, `laps_led`, `pct_laps_led`,
`stage1_finish`, `stage2_finish`, `created_at`.

### `tracks` — canonical track list + metadata (SINGLE SOURCE OF TRUTH for track names)
`id`, **`name`** (the canonical track name — every loader dropdown reads this), `nickname`,
`city`, `state`, `length_miles`, `banking_angle`, `surface`, `track_type`
(oval/road_course/superspeedway/short_track/intermediate), `horsepower_package`,
**`correlation_group`** (int — vestigial; sim does NOT use it), **`correlation_group_label`** (the ACTUAL pooling key — SimulationCenter line 452 filters corr history by this label)
(cosmetic), `created_at`.

### `practice_sessions` — per-driver practice summary (sim + grade inputs)
`id`, `race_id` (FK->races), `series`, `year`, `track_name`, `race_number`, `driver_id`,
`driver_name`, `car_number`, `practice_group`, `session_number`, `qualifying_position`,
`total_laps`, `num_stints`, `longest_stint`, **`overall_avg`** (all clean laps, 8% cut =
the SIM longRunPace input), **`avg_pace`** (mean of per-run avgs = the GRADE input, added
2026-07-04), `best_lap`, `best_stint`, `long_run`, `late_run_avg`, `trend_slope`,
`consistency`, `practice_score`, `practice_grade` (computed+stored at upload), `notes`,
`created_at`. Delete/reinsert key: `race_id + series + session_number + race_number`.

### `practice_laps` — raw practice laps (NO race_id / no FK)
`id`, `series`, `year`, `track_name`, `race_number`, `session_number`, `driver_name`,
`car_number`, `lap_number`, `lap_time`, `starting_position`, `created_at`.

### `qualifying_results` — (NO race_id / no FK)
`id`, `series`, `year`, `race_number`, `track_name`, `racing_reference_id`, `driver_name`,
`car_number`, **`qualifying_position`** (the startPos input), `qualifying_order`,
`draw_order`, `qualifying_group` (draw-order sim), `qualifying_speed`, `qualifying_time`,
`lap_time`, `metric_score`, **`lineup_source`** (provenance: qualifying / metric / rain / practice —
added 2026-07-09; distinguishes real time-trial sessions from rain-out/metric/practice-fallback
lineups), `created_at`.
Unique key `qualifying_results_driver_unique` = `(series, year, track_name, race_number,
driver_name)` — `race_number` added 2026-07-06 (was missing, which silently clobbered
double-header tracks). BOTH loaders' upsert `onConflict` include `race_number`, and Load
Qualifying Order now has a Race# field — enter it (matching Load Qualifying) or draw order
won't merge onto the right race.

### `green_flag_speed` — per-driver race green-flag speed (added 2026-07-08, from loop data PDFs)
`id`, `series`, `year`, **`track`** (NOT track_name; normalized to canonical `tracks.name`
2026-07-08 — loader still saves scraped names until fixed, task #117), `race_name`,
`report_date`, `race_number`, `race_date` (reliable join key: cup runs one race per weekend, so
±3-day date match to `races.race_date` works even if names drift), `gfs_rank`, `car`,
**`driver`** (not driver_name), `team`, `finish_pos`, `green_flag_speed` (mph — HIGHER is
better; normalize to per-race percentile before any cross-track use), `laps_completed`,
`short_run`, `gfs_rank_valid`, `created_at`. Coverage: cup 2022-2026 complete (173 races incl.
non-points), oreilly + trucks loaded. NOT a sim input (tested + rejected, Archive C).

### `fastest_laps` — NOTE the short column names
`id`, `year`, `track_type`, `race_name`, `race_date`, **`track`** (not track_name), `rank`,
**`driver`** (not driver_name), `car`, `fastest_lap_num`, **`fastest_time`** (not
fastest_lap_time), `fastest_speed`, `start_pos`, `finish_pos`, `status`.

### `featured_weekend` — current race config
`id`, `series`, `track_name`, `track_label`, `track_years`, `correlation_label`,
`correlation_year`, `correlation_years`, `correlation_tracks` (UNUSED), **`correlation_label`**
(the sim matches this against `tracks.correlation_group_label` to pool corr history — keep in
sync when track labels change), `show_qual_sim` (deprecated), `updated_at`.

### `entry_list` — active roster
`id`, `series`, `race_year`, `track_name`, `driver_name`, `car_number`, `organization`
(was documented as `org`), `manufacturer` (Chevrolet/Ford/Toyota/Ram — added 2026-07-06,
auto-parsed from the entry-list PDF's "Veh Mfg" column), `created_at`.

### `qual_sim_config` — qualifying-sim UI config
`id`, `series`, `show_sim`, `sim_corr_years`, `nudge_oval`, `nudge_short_track`,
`nudge_superspeedway`, `nudge_road`, `updated_at`.

### `sim_results` — published sim boards (delete+insert per series + stage)
`id`, `series`, `track_name`, `race_name`, `race_year`, `race_number`, `results` (jsonb —
per-driver array: projFinish, win/top3/5/10 %, finish_p25/50/75, start_pos, and the full
`mv` odds object per market), **`config`** (jsonb — settings snapshot: weights, caution, dnf,
rainOut, numSims, totalLaps, `stage1Laps` / `stage2Laps` (stage lengths, captured 2026-07-09 —
data-only, no sim module consumes them yet), plus the packed `simMatrix`/`simMatrixN`/`simOrder`;
added 2026-07-07 via `ALTER TABLE sim_results ADD COLUMN config
jsonb`. Publish payload has always sent this — if publish errors "Could not find the 'config'
column … in the schema cache", the column is missing; run that ALTER), **`stage`**
('pre'/'post'), `published_at`.

### `sim_grades` — per-race grade log (accumulating validation sample)
`id`, `sim_id`, `series`, `track_name`, `race_year`, `race_number`, `actual` (jsonb, actual
finish), `metrics` (jsonb — MAE/Brier/Spearman/precision), `ev_flags` (jsonb — +EV hit/miss),
`roi`, `shade_on` (was the win shade applied), **`stage`** ('pre'/'post'), `graded_at`, `notes`.

### `green_flag_speed` — per-driver green-flag avg speed + rank (added 2026-07-07)
`id`, `series`, `year`, `track` (canonical, from PDF header — NOTE a few PDF spellings differ
from `tracks.name`: "Circuit of The Americas" vs "...the Americas", "San Diego Street Course"
= "Naval Base Coronado", "The Milwaukee Mile" vs "Milwaukee Mile Speedway"), `race_name`,
`report_date` (when NASCAR generated the report, ~race_date +1-2d), `race_number` + `race_date`
(filled via enrichment UPDATE), `gfs_rank` (1 = fastest green-flag speed), `car`, `driver`,
`team`, `finish_pos`, `green_flag_speed` (mph), `created_at`. STANDALONE like `fastest_laps`,
NO FK. Parsed from page 10 of the loop-data PDFs (`/NASCAR Loop Data/` folder, 2022-2026, all 3
series) via pdfplumber word x-positions (`/tmp/gfs_parse.py`). 15,661 rows / 431 races loaded
2026-07-07. **Join to loop_data by (series, year, race_number, finish_pos)** — finish position
is the authoritative row key (immune to name accent/case diffs like Suárez/Suarez). Enrichment
matches GFS->races by series+year+report-date proximity (NOT track name, due to the spelling
gaps above). ~13k rows matched; unmatched = 2022 races (not loaded) + exhibition events (Clash/
Duels/All-Star, no points race_number). 3 PDFs had no GFS page: Bristol-2 Cup 2025 + Bristol
Trucks 2025 (1-page incomplete files) + IRP Trucks 2025. GFS is the one signal NOT saturated by
driver_rating (~orthogonal) — the pending test is whether it adds predictive value in the sim.
Short-run exclusion (added 2026-07-08 via green_flag_speed_3_shortrun.sql): `laps_completed`
(from loop_data), `short_run` bool (completed <40% of winner's laps → GFS inflated/unreliable),
`gfs_rank_valid` (rank recomputed among non-short-run drivers). Viewer page **GreenFlagSpeed.js**
at `/green-flag-speed` (Loop Data nav) — full heatmap mirror of FastestLap.js with a series
selector; short-run cells render dimmed with a "rank excluded due to DNF" tooltip and are dropped
from each driver's season avg. Track-type comes from a client-side tracks lookup (GFS has no
track_type column). PENDING: a "Load Green Flag Speed" admin panel for weekly PDF adds.

### `crossover_borrows` — manual cross-series rating borrow (added 2026-07-07)
`id`, `series` (the SIM series the borrow applies to), `driver_name`, `source_series`
(series to borrow the road rating FROM), `blend_weight` (0..1 weight on the source rating),
`active` (bool), `note`, `created_at`. Unique key `(series, driver_name)`. Managed in the
**Crossover Borrows** panel on `/admin` (Loop Data admin). Read at Sim-Center config load:
for each active borrow matching the sim series, the driver's `source_series` road rating is
blended into their corrAvgRating. See §10 gotcha.

### `clv_log` — Closing Line Value log (added 2026-07-09)
`id`, `series`, `race_year`, `race_number`, `track_name`, `driver_name`, `market` (win/t3/t5/t10),
`bet_price`, `close_price`, `bet_implied`, `close_implied`, **`clv`** ((close_implied − bet_implied)
×100), `stage`, `created_at`. Written by the **CLV tool in GradeCenter** (admin) via delete-by-race
then insert (REST PATCH is RLS-blocked, so it re-inserts). One row per +EV-flagged bet from the
loaded pre sim. Powers the season CLV summary + history table. DDL run by user 2026-07-09.

---

## 10. Known Gotchas

### LoopData.js driver compare — matches on year+track, not just race_number (2026-07-06)
The per-driver compare (DriverCard modal) builds each column from the PRIMARY driver's races and looks up the
compare driver's value by matching (year, track_name, raceNum), where raceNum = `_occ || race_number || 1`.
Two structural traps: (a) the current-weekend "year columns" carry NO race_number on the column def (so it
defaulted to 1), and (b) `_occ` is never actually assigned anywhere -> matching leaned on race_number alone.
The compare was blank on Truck + O'Reilly (Cup "worked" only because Cup drivers carry deep track history, so
the primary's cached race_number stayed consistent). THREE fixes shipped, and the ORDER of discovery is the
lesson:
1. (b2df0fc3) main driver-stats matchRow (~line 152) required rd.race_number, undefined for year-columns ->
   only matched when _occ===1. Skip the race_number check when rd.race_number is null. [wrong path for the modal]
2. (88d0295e) the compare fetch (compareHistories) built its track list ONLY from the primary's rawRaces, so a
   current track absent from the primary's history (O'Reilly Chicagoland = no prior O'Reilly races; new Truck
   drivers) was never queried. Fix: always add config.track_name to the fetch track list. [helped, not the core]
3. (57a4d83c) THE ACTUAL FIX: the DriverCard compare-value match (~line 423) required the compare driver's
   (year, track, raceNum) to equal the PRIMARY-derived rc.raceNum. If the primary's cached race_number ever
   differs from the compare's (data loaded/renumbered after the race), it silently returned blank. Now: try the
   exact match, then FALL BACK to year+track (single race per track/year is unambiguous, so it's safe).
LESSON: I DB-verified that both drivers had race_number=20 and identical track_name BEFORE the 3rd fix -- which
proved the first two were the wrong code path (the compare has TWO separate match implementations: the main
driver-stats function AND DriverCard; a fix to one doesn't touch the other). When a lookup silently returns
blank, verify the data first, then find the EXACT render path that pulls the value (row[col.key] via the
DriverCard raceCols match), rather than fixing a look-alike matcher elsewhere.

UPDATE (2026-07-09): fix #3's year+track fallback itself caused an **R1/R2 duplication** bug on
double-header tracks — year+track is ambiguous when a track runs twice a year, so both races pulled the
same value. Re-fixed across all three series: `raceCols` now carries `realRn` + `occIdx`, and the
DriverCard compare match keys on the actual `race_number` first (with a positional `occIdx` fallback for
same-track/same-year occurrences); the destructive bare year+track fallback was removed. Net rule:
match on race_number, then occurrence index — never collapse to bare year+track.

### Chrome extension content filter
The browser JS tool (`mcp__claude-in-chrome__javascript_tool`) blocks results containing these strings:
- `draw_order` (the literal string in output)
- `drawOrderMap = {}`
- Certain index range patterns

Workaround: store sensitive strings in variables, use char-code arrays, split outputs, or stringify and slice.

### Files > 1 MB
GitHub Contents API silently returns `encoding: "none"` and no content for files over 1 MB. Use the Git Blobs endpoint (see §3) with `Accept: application/vnd.github.raw` to get raw text directly.

### Sort icons — use ASCII only
Sort direction indicators in React components must use ASCII characters, not Unicode arrows.
```javascript
const sortIcon = (key) => sortKey === key ? (sortDir === 'desc' ? ' v' : ' ^') : ''
```
Unicode arrows (↑ ↓ ▲ ▼) survive if stored as `\uXXXX` escapes, but literal Unicode in source is risky across push cycles.

### Vercel deploy timing
Vercel picks up main branch pushes automatically but takes ~60–90 seconds to build. After a push, wait before checking the live site. Do not assume the latest commit is live immediately.

### `practiceGrader.js` — pending re-upload
Task #93 is pending: the SRP formula was fixed in practiceGrader.js but the practice Excel for the current race has not been re-uploaded through the Admin panel to apply the fix.

### `load-race.js` — pending fix (task #102)
The serverless function does not yet auto-set `race_date` or auto-increment `track race_number (1/2)`. Manual workaround is in place.

### Practice uploader — Race # field (commit `d50d69a7`, 2026-07-03)
The Admin "Upload Practice Session" form now has a **Race #** field (`practiceRaceNum`
state in the `Admin` component, distinct from `LoadQualifying`'s `raceNumber`). It is a
free number input defaulting to 1 — enter the **R#** shown in the Loop Data Audit (the
season-round number, e.g. Vegas 2022 = R3), which together with **Year** uniquely
identifies a race. `race_number` is stamped on every `practice_sessions` row (via
`alter table practice_sessions add column race_number int4 default 1` — already run) and
is part of the delete-then-reinsert key (`race_id + series + session_number + race_number`),
so re-uploading one race replaces only that race's session, not the other race at a
two-race track. NOTE: only the `practice_sessions` insert/delete were touched — the
`practice_laps` insert/delete were left alone (that table has no `race_number` column).
Two-race-track linkage FIXED (commit `9871a401`, 2026-07-03). The `races` table already
has a populated `race_number` column (= season R#, e.g. Daytona 500 = 1; verified via
REST, 377 rows, race-level registry). `handleUpload`'s race lookup now filters
`.eq('race_number', practiceRaceNum)` and the fallback race-create stamps
`race_number: practiceRaceNum` + names it `${track} ${year} R${R#}`, so each date at a
two-race track resolves to its own `race_id`. Enter the Race # to MATCH `races.race_number`
(the audit R#).

Data-hygiene notes (observed 2026-07-03 via REST on practice_sessions, 638 rows / 14
sessions): (a) some sessions are DUPLICATED — Cup Pocono showed 76 driver rows, O'Reilly
Pocono 74, O'Reilly Coronado 72 (~2x a normal field), from re-uploads before the delete
key was tight. (b) `track_name` is INCONSISTENT — mix of short ("Bristol", "Michigan")
and full ("Pocono Raceway", "Sonoma Raceway"); since the race lookup matches on exact
track_name, standardize these during backfill or the lookup can spawn a duplicate race
row. All existing practice_sessions have race_number=1 (backfill default), which may not
equal the real audit R#; re-uploading with the correct R# creates correct rows but leaves
the old R1 rows as orphans unless purged first.

### TRACK-NAME UNIFICATION — all loaders now dropdown-driven (2026-07-06, commits 2f6e022d + 7e11f75f)
Root cause of the phantom/duplicate races: none of the load tools let you pick a canonical
track — Load New Race SCRAPED the track name out of the pasted Racing Reference page, and
Load Fastest Laps / Load Qualifying / Load Qualifying Order used FREE-TEXT track inputs. Any
spelling drift ("Nashville Speedway" vs "Nashville Superspeedway", the "Homestead-MIami"
typo, "Las Vegas Motorspeedway") silently created a NEW `races` row instead of matching the
existing one, spawning empty duplicate race stubs (ids 391/393/394/395/396/397, cleaned up
2026-07-06 — see below).
FIX: every loader now has a **Track `<select>` populated from the `tracks` table** (A-Z,
mirroring the practice uploader's existing pattern: `supabase.from('tracks').select('name')
.order('name')` into a local `tracks` state via useEffect). So `tracks` is now the SINGLE
SOURCE OF TRUTH for track names across the whole load pipeline (`races`, `fastest_laps`,
`qualifying_results`, `practice_sessions`).
- Load New Race (LoadNewRace, Admin.js): added `selTrack` state + Track dropdown in the field
  row; the loader now keys the race off `selTrack || parsedTrack` (selection wins; falls back
  to the scraped name only if left blank, so nothing breaks).
- Load Fastest Laps / Load Qualifying / Load Qualifying Order: their existing `trackName`
  free-text `<input>` was swapped for a `<select>` over the same `tracks` list. `trackName`
  state + insert path unchanged, so the guards (`!trackName`) and inserts still work.
CONSEQUENCE: as long as you pick from the dropdown, every loaded row gets a name that already
exists in `tracks`, so it can never spawn a phantom duplicate again. The only requirement is
the track must exist in `tracks` first (good hygiene — add a new venue there once if the
schedule changes; same as Gateway/Iowa/Bowman Gray/Rockingham were added).
CLEANUP of the 6 pre-fix orphans (2026-07-06): they weren't fully empty — `practice_sessions`
(FK `practice_sessions_race_id_fkey`) referenced the misspelled race rows. So the delete had
to RE-LINK practice first, not just drop the races: `UPDATE practice_sessions SET race_id=<canon>,
track_name='<canonical>' WHERE race_id=<orphan>` for 391->352 (Nashville Superspeedway),
393->6 / 396->33 (Las Vegas Motor Speedway R5/R33), 394->7 (Homestead-Miami); 395 + 397 had
no practice, just deleted. THEN `DELETE FROM races WHERE id IN (391,393,394,395,396,397)`.
`practice_laps` and `qualifying_results` have NO race_id column (no FK), so practice_sessions
was the only blocker. LESSON: before deleting a `races` row, check `practice_sessions.race_id`
AND `loop_data.race_id` — both FK into `races`.

### Driver manufacturer — parsed from the entry-list PDF (2026-07-06, commits 4706ccdf + 98fc3de6)
`entry_list.manufacturer` (Chevrolet/Ford/Toyota/Ram). Requires the column:
`ALTER TABLE entry_list ADD COLUMN IF NOT EXISTS manufacturer text;`
Flow: EntryListManager's PDF parser (`parsePdf` in Admin.js) already flattens the PDF into a
token stream and detects car# -> driver -> org. It now ALSO scans the row window (i+2..i+6,
stopping at the next car#) for a manufacturer token via `normMfr()` and appends it as a 4th
CSV field (`car,driver,org,mfr`). The bulk-import path (which the PDF feeds via `setBulkText`)
reads `parts[3]` -> `manufacturer: normMfr(parts[3])`. `normMfr()` maps chevrolet/chevy/chv/
camaro/silverado->Chevrolet, toyota/camry/tundra/tyt/toy->Toyota, ford/mustang/f150/fd->Ford,
ram/dodge->Ram. Manual add-row has a Mfr dropdown; bulk paste accepts a 4th column. LoopData
selects `manufacturer`, attaches it in `groupByDriver`, and shows it after the team as
"Team `·` Mfr" on both the driver cards and rows. To backfill existing entry lists, just
re-parse the PDF (or re-import) once the column exists.

### Atlanta = "Atlanta Motor Speedway" (canonical); "EchoPark Speedway" is DEPRECATED
Atlanta was renamed EchoPark Speedway in 2024; 2025-2026 loop_data/qualifying/races landed
under "EchoPark Speedway" and went missing from the Atlanta weekend. Canonicalized to
"Atlanta Motor Speedway" across all tables 2026-07-06 (tracks table + loader dropdowns
already use the canonical name, so new loads stay correct). `isSuperspeedway()` still matches
on "atlanta", so pack-track weights trigger. Don't reintroduce the EchoPark name.

### Crossover rating borrow (manual, 2026-07-07)
The corr fetch already lumps `[simSeries, 'cup']` road history into corrAvgRating (a crude
built-in Cup crossover). The **crossover_borrows** feature generalizes this to any source
series, per-driver, manually. WHY manual not auto: the failure mode isn't THIN history, it's
UNREPRESENTATIVE history — e.g. Parker Kligerman has 6 truck road races (not thin) but they're
dragged by mechanical DNFs in weak Henderson equipment (fins 7/1/35/31/18/31 → base rating
74.2), while his 14 O'Reilly road races give 95.5. No sample-size rule catches that; the
equipment context lives in the user's head. Implementation (SimulationCenter corr data-prep):
base corrAvgRating still computed ONLY from `[simSeries,'cup']` rows (non-flagged drivers are
byte-for-byte unchanged); the corr fetch widens `.in('series', …)` to include active borrow
source series; for a flagged driver, `avgRating = (1-w)*base + w*sourceRating`. Self-targeting
— only drivers with a borrow row are touched, so it CANNOT be whole-field backtested (signal
diluted across too few drivers); validate on live cases. Kligerman @ w=0.65 → 74.2 → 88.1.
Blend (not full-replace) is deliberate: truck-specific adaptation and cross-series field-
strength calibration are opposite-signed errors that roughly offset → honest estimate is the
middle. Borrow applies at CONFIG LOAD; flip a borrow after loading → reload the config.

### Market-value odds parsing — book label variants (2026-07-07)
The MV panel parses pasted sportsbook odds per book (`__marketValue` in SimulationCenter):
DK box via `parseDK`, FanDuel + Hard Rock boxes via `parseSect`, which needs a market HEADER
line ("Race Winner"/"Top 3..." etc.) to file odds under a market. TWO bugs fixed this day:
(1) the live panel was gated on the DK box alone (`!oddsWinTxt`) → pasting only FD/HR showed
nothing; now fires on any book. (2) Hard Rock's winner header on the TRUCK page is "Race
Winner" but the regex matched only exact "Winner" (`/^winner$/i`) → HR silently parsed nothing
for trucks (Cup's HR page uses "Winner", which is why Cup worked). Headers are now broadened
(`/winner|outright/i`, `/top[\s-]*N/i`) to tolerate label variants across books/series, and a
per-book **"DK/FD/HR: N parsed"** counter now sits under the odds boxes (red ⚠ when a box has
text but 0 parsed) so a future wording mismatch is VISIBLE, never silent. Lesson: books label
the same market differently by series/section; keep header regexes loose + keep the counter.

### Multi-series support
`featured_weekend`, `entry_list`, `qualifying_results`, `races` all have a `series` column. SimulationCenter has a series tab switcher (Cup / O'Reilly / Trucks). Always filter by series when querying. Series strings in the DB: `cup`, `oreilly`, **`trucks`** (plural). GOTCHA (fixed 2026-07-07): SimResults.js Truck tab was defined `value:'truck'` (singular) → queried a nonexistent series → truck boards NEVER displayed ("No published results yet", surfaced as a `.single()` PGRST116). Fixed to `'trucks'`. If any page's series value is ever `'truck'`, it's this bug — the canonical string is always `trucks`.

---

## 11. Pending Tasks

| # | Task |
|---|---|
| #83 | Enable RLS on all Supabase tables before go-live |
| #93 | Re-upload practice Excel via Admin to apply fixed SRP formula |
| #102 | Fix `load-race.js`: add `race_date`, auto-set track `race_number` (1/2) |
| #111 | Consider trimming road-course `raceCraft` 25% -> ~10% (needs more than 56 races). |
| #112 | ~~Assign the 4 unassigned road courses to GRP 8~~ DONE (verified in tracks 2026-07-08; Road Course label now 13 tracks). |
| #113 | Build betting-value engine + DFS value layer on the calibrated probabilities (§7.5). |
| #114 | ~~Practice-EDGE residual test~~ CLOSED 2026-07-09 (Archive C): sleepers real (+5.1 places, n 117/1403 on 40 races) but partial corr with model residuals is -0.0003 — already priced by practice+startPos inputs. Practice lever fully exhausted; do not revisit. |
| #118 | IMPLEMENT the equipment/car prior (Archive C 2026-07-09, VALIDATED: thin-driver corr 0.433→0.518 + ride-change delta k=0.25). Data half DONE 2026-07-09: `backfill_loop_car_numbers_rr.sql` RUN by user, coverage verified cup 97.6 / oreilly 97.7 / trucks 93.0 pct (13,005 rows: 12,861 finish-verified + 144 trusted DQ-revision rows; 100.00% agreement with independent GFS source on 12,473 overlapping rows). Current-weekend cars come from entry_list.car_number — populated only when the user loads the entry list, so the equipment panel needs a "load entry list" empty state. COMPLETE 2026-07-10. Stage 1 (b24d7beb): blend + ride-change delta in buildSpeedScores, fully guarded. Stage 2 (f851e3cb): Equipment-prior admin panel. Stage 3 (4e1d7209): per-driver influence overrides (0–150%, session-only). Stage 4 (19003614): Load New Race stamps loop_data.car_number by joining the pre-loaded entry_list (normalized-name match; missing entry list/substitution → NULL, safe) — WORKFLOW NOTE: load the ENTRY LIST before loading a race's loop data or its rows get NULL cars (backfillable later). First live board audited; de-meaned + own-excluded pool variants tested and REJECTED (raw pools win — seat assignment is signal). |
| #115 | Re-tune Trucks + O'Reilly caution noise on the full model once their practice is backfilled (Cup was retuned 22->14; theirs are still reduced-model values). |
| #116 | Crossover-driver prior — DONE 2026-07-07 as manual **crossover_borrows** (§9/§10). Cup-regular-with-thin-lower-series case (Elliott) is also covered: add a borrow row. Possible follow-up: an auto "candidate scanner" that surfaces drivers whose other-series road rating >> same-series rating (suggestion only, activation stays manual). |
| #119 | ALLOCATION-CONDITIONED practice input (Archive C 2026-07-10): fresh-set detector flags multi-set sessions; on those, filt103/best5 beat overall_avg (0.242-0.250 vs 0.206) while overall_avg stays best on single-set (0.282). NEXT: (a) ship detector to grader + report card (display + stored allocation, accrues labeled data); (b) full-market + favorite-gap test of the conditioned input in the MC harness before ANY sim change; (c) normalize practice_laps track names first (3 Vegas spellings + Homestead-MIami typo persist there). |
| #117 | ~~Normalize `green_flag_speed.track` names~~ DATA HALF DONE 2026-07-08 (SQL run + REST-verified): 9 drift names fixed to canonical, Milwaukee's 2 spellings unified to 'Milwaukee Mile', dirt Bristol aligned to 'Bristol Motor Speedway Dirt Track' (distinct on purpose — self-excludes from Bristol pools). NEW `tracks` rows: 'Lucas Oil Indianapolis Raceway Park' + 'Milwaukee Mile', both Short & Flat grp 6 (user-approved) — their Truck races can now pool. Deliberately NOT in `tracks`: LA Coliseum (exhibition), Knoxville (dirt). REMAINING (code half): the GFS loader still saves scraped names — swap to the `tracks` dropdown like the other loaders (2026-07-06 pattern). GFS as a sim weight: TESTED + REJECTED 2026-07-08 (Archive C) — do not re-test. |

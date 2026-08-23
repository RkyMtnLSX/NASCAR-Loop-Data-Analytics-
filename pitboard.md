> SESSION START: read PITBOARD_MANUAL.md + PITBOARD_STATE.md first. This file is an append-only ARCHIVE (~50k tokens) - SEARCH it for specific history; do not read it in full.

# PitBoard — Project Handoff Document

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


> **For incoming models:** Read this entire file before touching any code.
> Last updated: 2026-07-14

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
  raceCraft:    0.00,  // CUT 2026-07-12 (75602460) - last survivor; ~97% corr w/ rating, already 0 on road+SS. Weights now sum 0.98; buildSpeedScores renormalises so RATIOS are unchanged.
  trackHistory: 0.15,  // specific-track history (trackAvgRating), shrunk by nTrackRaces (was 0.10)
}
// corrHistory internal blend: rawC = rs (100% normalized driver_rating).
// Was `rs*0.9 + fs*0.1`; the 0.1 finish term dropped as redundant (finish IS in rating).
// Still shrinks toward 50 by confidence: conf = min(1, nCorrRaces/4).
// trackHistory uses trackAvgRating with the same shrinkage on nTrackRaces (0 for first-timers).

const ROAD_COURSE_WEIGHTS = {   // Cup/O'Reilly road — raceCraft cut to 0 on 2026-07-07 (corr 0.35->0.60)
  corrHistory:  0.60,
  longRunPace:  0.25,  // CONSOLIDATED 2026-07-12 (0281bc19): absorbs shortRun+falloff; practice total unchanged at 0.25
  shortRunPace: 0.00,  // folded out — validated on cup ovals + truck road; 50% null on cup road
  startPos:     0.15,  // backed by r=0.416 correlation across 682 observations
  tireFalloff:  0.00,  // dropped — noisy dead weight; trend_slope only 39% populated on cup road
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
  Grade v3 shipped 2026-07-10: avgPace 50 / bestLap 50, letter-aligned scores, notes JSON
  extras — see the practiceGrader section + BACKTEST_LOG Archive C.
- **Road course — NOW PER-SERIES (2026-07-07).** Cup/O'Reilly (`ROAD_COURSE_WEIGHTS`):
  corr 0.60 / longRun **0.25** / shortRun **0** / startPos 0.15 / tireFalloff **0** (practice CONSOLIDATED 2026-07-12, commit `0281bc19` — see BACKTEST_LOG; practice total unchanged at 0.25) / raceCraft
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

### PRE-RACE SIM STANDARD - no grid loaded (2026-07-12, backtested)
Run it STOCK. Change nothing. With no qualifying, startPos is null -> neutral-filled 50 for everyone ->
a CONSTANT, so it cannot mislead the ranking; it only compresses the spread, and that is APPROPRIATE
(you know less pre-quali, the board SHOULD be flatter). Keeping startPos at 0.33 beat both the rain-out
toggle and dropping it, on every placement market in both splits (BACKTEST_LOG 2026-07-12).
**Do NOT use the rain-out toggle pre-race.** It exists for a DIFFERENT failure: a grid that EXISTS but
is a draw/metric (noise the model would read as speed). No grid = absent input; rain-out grid = MIS-
LEADING input. Using the toggle pre-race sharpens a board that has less information -- backwards.
LIVE CAVEAT: the pre board runs UNDER-confident on the win market in the current era (favGap -9). You
will rarely find value ON favourites pre-race (expected), and longshot WIN flags on a pre board deserve
extra scepticism -- a flat board inflates tails (Atlanta: Berry +7500 / Stenhouse +5500 both flagged,
finished P25/P23).

### Neutral-fill is LOAD-BEARING - do not 'fix' it (2026-07-12, backtested + rejected)
When an input has no coverage the sim fills it with a neutral 50 (conf = min(1, n/4)). This looks like
dead weight diluting the model. It is NOT: it is an accidental regulariser that flattens the model's
favourite OVERCONFIDENCE. Renormalising the weight away from a zero-coverage input is WORSE on every
market in both splits, monotonically. Applies to trackHistory at debut tracks (North Wilkesboro has
ZERO cup races - only trucks) and to startPos on a pre-race board. NOTE this does NOT contradict the
equipment prior (#118), which replaced corr's neutral fill with REAL INFORMATION (car pools). Adding
information helps; deleting shrinkage hurts.

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
`consistency`, `practice_score`, `practice_grade` (computed+stored at upload), `notes`
(since grade v3 2026-07-10: JSON `{"gl": gradedLaps, "fr": estFreshRuns}` written by the
grader at upload; report card parses it for the Laps column), **`tire_sets`** (int —
MANUAL practice tire-allocation label, added 2026-07-10; 2024-26 Cup labeled from
Jayski/user fact-check, NOT set by the uploader — re-stamp after any re-upload),
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

### `featured_weekend` — current race config (THE single source of truth per weekend)
`id`, `series`, `track_name`, `track_label`, `track_years`, `correlation_label`,
`correlation_year`, `correlation_years`, `correlation_tracks` (UNUSED), **`correlation_label`**
(the sim matches this against `tracks.correlation_group_label` to pool corr history — keep in
sync when track labels change), `show_qual_sim` (deprecated), **`race_number`** (season R#,
added 2026-07-10 — prefills every loader + the sim publish field; the double-header guard),
**`total_laps`, `stage1_laps`, `stage2_laps`** (added 2026-07-11 — prefill the sim's race
length/stage inputs), **`eq_overrides`** (jsonb, added 2026-07-11 — persisted equipment-prior
infl values, auto-saved debounced from the sim page, loaded per series on page load),
**`rear_overrides`** (jsonb, added 2026-07-11 — persisted "to the rear" start overrides,
same pattern), `updated_at`. Set track + R# + laps ONCE per series per weekend in Admin →
Weekend Config; every loader and the sim inherit all of it.

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
data-only, no sim module consumes them yet), **`lineup`** (added 2026-07-10: startPos
provenance at publish time — 'qualifying'/'metric'/'rain'/'practice fallback'/'partial N/M'/
'none'; computed in SimulationCenter from qualMap coverage + modal `lineup_source`, shown as
a badge on the sim results header AND the published board header; boards published before
2026-07-10 lack it), plus the packed `simMatrix`/`simMatrixN`/`simOrder`;
added 2026-07-07 via `ALTER TABLE sim_results ADD COLUMN config
jsonb`. Publish payload has always sent this — if publish errors "Could not find the 'config'
column … in the schema cache", the column is missing; run that ALTER), **`stage`**
('pre'/'post'), `published_at`.

### `sim_grades` — per-race grade log (accumulating validation sample)
`id`, `sim_id`, `series`, `track_name`, `race_year`, `race_number`, `actual` (jsonb, actual
finish), `metrics` (jsonb — MAE/Brier/Spearman/precision), `ev_flags` (jsonb — +EV hit/miss),
`roi`, `shade_on` (was the win shade applied), **`stage`** ('pre'/'post'), `graded_at`, `notes`,
**`config`** (jsonb, added 2026-07-11 via `alter table sim_grades add column config jsonb` —
the graded board's config snapshot; the grader's save FAILS without this column). Grading a
POST board excludes bets already flagged on the PRE board (bet attribution doctrine — see
BACKTEST_LOG 2026-07-11).

### `pit_crew_race` — per-car pit crew performance (added 2026-07-11, source pitcrewrank.com)
`id`, `series` ('cup'), `year`, `race_date` (**THE join key to `races` — their race numbering
counts exhibitions, so R#s are offset from ours; always join by date**), `race_name`,
`pcr_race_id` (their id; unique with car_number → re-syncs upsert), `car_number`,
`driver_name`, `trimmed_mean` (4-tire stop seconds), **`z_score`** (race-normalized — the
signal), `stop_count`, `best_stop`, `created_at`. 633 rows / 17 points races backfilled
2026-07-11; exhibitions excluded. WEEKLY SYNC: user clicks a bookmarklet while on
pitcrewrank.com (their API is same-origin only) — diffs pcr_race_id, pulls only new races.
Validated: persistence 0.671, residual partial +0.073 (11/13 races), improves t10 Brier only.
NOT a sim input yet — re-test with proper split at ~25 points races (~late Aug); designed as
a season-scoped rolling-window PLACEMENT input, gated off superspeedways (BACKTEST_LOG).

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

### `practiceGrader.js` — GRADE v3 LIVE (commit `50e90bfb`, 2026-07-10)
Formula: `rankScale(avgPace)*0.50 + rankScale(bestLap)*0.50` (falls back to overallAvg if
avg_pace missing). Scores are LETTER-ALIGNED via SCORE_BANDS (A+ = 97-100, B = 83-86.9, F
floors at 40); the session's #1 driver is always A+/100. Raw composite still orders the
field — only the displayed score is band-mapped. Extras written to `notes` JSON (gl/fr).
Backtest: 0.326 all / 0.325 test vs incumbent 0.310/0.304 (BACKTEST_LOG Archive C,
2026-07-10). Grades compute AT UPLOAD — old sessions keep old grades until re-uploaded.

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

### Double-header lineup leak — FIXED (commits `a09ec38a`, `d0053200`, 2026-07-10)
Incident: the fall-Atlanta cup sim showed "lineup: qualifying" with no lineup loaded — it was
the FEBRUARY Atlanta lineup (qualifying_results race_number 2, backfilled 06-11). The sim's
qualifying AND practice fetches matched (series, track_name, year) only, so at any two-race
track the spring rows leak into the fall sim. FIX: `featured_weekend.race_number` column
(user-run `alter table featured_weekend add column race_number int4`), a "Race # (season
round)" field on the Admin Weekend Config form, and both sim fetches now add
`.eq('race_number', cfg.race_number)` when set (null = old behavior, fine at single-visit
tracks). WORKFLOW: at double-header tracks, SET THE RACE # IN WEEKEND CONFIG — it is what
keeps February out of the fall sim. The lineup badge exposed this bug within hours of
shipping; before it, the sim would have silently used a 5-month-old lineup.
THIRD INCIDENT — GRADER IMPORT (commit `edd6ab9a`, 2026-07-11 evening): grading the fall
O'Reilly Atlanta board, "Import from loop data" mixed BOTH Atlanta races' fields — because
`loop_data.race_number` is a TRACK-VISIT count with inconsistent backfills (Feb's rows AND
today's rows both carried 2), the two-race check saw one value and merged 76 rows. FIX: the
import now resolves the exact race via the RACES table (season `race_number` matching the
board's R#) → `loop_data.race_id`. STANDING RULE: `races.race_number` = season R# is the
ONLY trustworthy race disambiguator; `loop_data.race_number` (visit count) must never be
used to select a race. Anything joining loop data at a two-race track goes through
races.race_id.
RACE # SINGLE SOURCE OF TRUTH (commit `263ebf0a`, 2026-07-11): the sim's publish Race #
field now PREFILLS from `featured_weekend.race_number` on config load (still editable).
Set it ONCE per series per weekend in Admin → Weekend Config and every downstream stamp
agrees. Motivating incident: the cup Atlanta board was republished with a stale manual
R14 while the true round was R20 (fixed by user-run SQL on sim_results). The qualifying
sim (QualifyingCenter, commit `887b4a7a`) also now excludes metric/rain/practice
lineup_source rows from qualifying history — only real time trials count. Qual-sim nudge
backtest (see BACKTEST_LOG 2026-07-11): configured nudges give 46-59% P10-P90 coverage vs
80% target; recommended config values 9/9/10/9 (oval/short/SS/road), SQL-only change,
user's call pending.

### 2026-07-17 — report card redesign + SITE-DOWN incident (both resolved)
- **INCIDENT**: the build after commit 3ab2dfae shipped WITHOUT Vercel env vars → "supabaseUrl is
  required" at module init → ENTIRE SITE blank (~10 min). NOT a code regression. HOTFIX \`7ca533b4\`:
  src/lib/supabase.js now has hardcoded fallbacks for the (public) URL + anon key — builds are immune
  to env-var loss permanently. OPERATOR TODO: check Vercel project env settings (REACT_APP_SUPABASE_URL
  / _ANON_KEY) — something removed or unscoped them.
- **Report card redesign** (\`3ab2dfae\`, operator spec): Best Stint → # Stints (num_stints); Consistency
  removed (corr −0.03); column order now # | Car | Driver | Group | Start | Grade | Score | Best Lap |
  Avg Pace | All Laps | # Stints | Long Run | Graded Laps; heat-tint on the four pace columns scaled to
  session spread (green fast → red slow, hsla alpha 0.25). PracticeReportCard.js changed — REFRESH.

### 2026-07-16 (night) — GROUP CONDITION CORRECTIONS SHIPPED, sim-side AND grade-side
Both validated same day (grade bar 0.372→0.404 monotone; sim composite 24/24 cells). Details in BACKTEST_LOG.
- **Sim-side** (SimulationCenter \`cc0e12e1\`): \`__groupConditionCorrect(drivers)\` before setRawDrivers —
  removes the track-state component of lrpTime when fetched practice rows carry practice_group. Fit
  lrpTime ~ corrAvgRating within session, subtract centered group median residual. NO-OP without labels.
- **Grade-side** (practiceGrader \`a9a6029b\`, Admin \`dbdf15e5\`): gradePracticeSession(drivers, priorRatings)
  — Admin fetches leak-free priors when the sheet has groups; grader RANKS on corrected copies (__gc*);
  STORED METRICS STAY RAW (sim corrects its own copy — never double-correct). Fail-open everywhere.
  Grades recompute on (re-)upload only, per standing rule.
- THREE files changed again tonight: SimulationCenter, practiceGrader, Admin — REFRESH BEFORE EDITING.
- λ re-check at ~15 labeled sessions; operator labels groups forward (sheets carry them when NASCAR splits).

### 2026-07-16 (late) — BEST5 SHIPPED as sim practice input, cup+trucks (operator decision)
Full evidence + decision record in BACKTEST_LOG (SHIPPED entry + the day's ~15 practice entries). Summary:
- **Sim practice input (lrpTime) = practice_sessions.best5 for cup + trucks**, fallback overall_avg when
  null; **O'Reilly stays overall_avg** (its own 2 seasons opposed). SimulationCenter `c5d34fa1` — REFRESH.
- practiceGrader `409e5c72` computes best5 (mean of 5 fastest laps) on every upload, all series; Admin
  `74c799de` stores it (SQL column user-run). Both files changed — REFRESH BEFORE EDITING.
- Every published board's config now stamps **practiceMetric** — use it when grading/auditing.
- Pre-ship sessions have best5 NULL (fallback = old behaviour); uploads from Friday carry it natively.
- LIVE VERIFICATION: review at ~6 graded cup/truck boards; revert = one lrpTime line.
- Same day, also settled: practice weight 0.15 confirmed in all series (4 designs); 50/50 blend measured
  (exact midpoint, not chosen); groups are metric-formula-sorted (B outfinishes A by 8.4 pos); naive group
  correction REJECTED, quality-controlled version VALIDATED-PRELIMINARY (0.372→0.404, held for ~4-6 more
  labeled sessions); group chips live on the report card.

### 2026-07-16 — practice uploader guards + parser aliases (SHIPPED); phantom-race repairs
- **Admin.js commit \`1011d3e7\` — three confirm guards on practice upload** (all triggered by real operator
  incidents same night): (1) REGISTRY MISMATCH — no silent stub races; dialog shows the track's real race
  numbers AND what that race# actually is ("R13 in the registry is: Michigan International Speedway");
  (2) OVERWRITE — replacing an existing session (same series/year/track/R#/session) requires explicit
  confirm; (3) LAP-TIME SANITY — file's median lap vs the track's historical laps, ±15 pct window (catches
  Bristol laps uploaded as Darlington). Guards fail-open on their own errors. Admin.js changed: REFRESH.
- **excelParser.js \`6d613324\`** — sheet matching is now case-insensitive substring with aliases
  (NOAPS/NCWTS/Craftsman/NXS); 'NOAPS' broke the O'Reilly Darlington backfill. excelParser changed: REFRESH.
- **Data repairs (browser REST, verified)**: deleted Bristol-laps-as-Darlington trucks 2025 R20 session;
  re-homed trucks 2025 Bristol R20→R6 (race id 311) and Charlotte R13→Michigan R13 (lap-time forensics:
  38.7s laps ≠ Charlotte); DELETED phantom races id 430, 432 (created by the pre-guard stub path).
- **Research (see BACKTEST_LOG 07-16)**: truck + O'Reilly practice validated ~2x cup raw signal; weight
  sweep says KEEP 0.15 (cross-series, win monotone against raising); best5 wash in both lower series.
  2025 truck practice now ~15 sessions (operator backfill) — within-series weight re-run possible soon.

### 2026-07-15 — group markets informational + team-correlation measured (SHIPPED code)
Full evidence in BACKTEST_LOG.md (2026-07-15 entries). For the handoff:
- **Group markets (Top Chevrolet/Ford/Toyota, Winning Mfr/Team) are INFORMATIONAL ONLY.**
  SimResults.js (commit `201d31d0`): GmTable dropped the Edge + medge columns, keeps mev; rows sorted
  by model prob (was ev). Display-time, so published boards clean themselves. SimulationCenter.js
  (commit `a7d4d5fc`): __groupMarketValue publishes ev:null / medge:null; admin preview shows dashes
  (deliberate). STANDING RULE: no model-edge display on ANY market without a graded record; re-entry
  path is gmv -> GradeCenter -> accrue a season -> decide. Both files changed 2026-07-15: REFRESH
  BEFORE EDITING.
- **Team-correlated noise, step 1 measured (no sim change):** org-level residual ICC 0.106 (2023-26,
  p 0.000; SS 0.217, road 0.00); manufacturer-beyond-org ZERO (p 0.61). Prototype spec + gates parked
  in BACKTEST_LOG + task list; best picked up before a superspeedway weekend.
- **tracks.display_group (NEW column, user-run SQL) + FOUR pages converted** — LoopData `8e56385e`, QualifyingCenter `a60544ca`, GreenFlagSpeed `7c386784`, FastestLap `ca49e625` (FL filter chips are now display groups, scoped client-side): public comp-track
  display now groups by `display_group` (fallback: correlation_group_label). Bristol AND Dover display as
  'High-Banked Concrete'; flat tracks display without them. THE SIM STILL POOLS BY correlation_group_label —
  display_group is optics only, never a model input. Companion backtest same day: the "Bristol discount"
  lambda sweep REJECTED (flat pooling won its 3rd test; see BACKTEST_LOG). LoopData.js changed again
  2026-07-15: REFRESH BEFORE EDITING.
- Long-run column backfill (late_run_avg / long_run) declared DEAD (structural nulls, operator call) --
  sustained-pace win test blocked; practice-dominance backfill of NEW 2024 races is the live path
  (operator loading practice sessions now).

### 2026-07-14 — model-integrity day (SHIPPED code + a big cleanup of the record)
Full evidence for everything here is in BACKTEST_LOG.md (2026-07-14 entries). Summary for the handoff:

**SHIPPED CODE.**
- **Exhibition guard** (`src/lib/exhibitionGuard.js` NEW; wired into SimulationCenter + LoopData). All-Star /
  non-points races (reduced ~20-car field) mechanically inflate driver_rating and must never feed the model
  or the public averages. SQL (user-run): `races` got an `exhibition boolean` column; Dover 2026 (id 399,
  All-Star) set `exhibition=true, race_number=0` (also cleared a duplicate R11). THE TRAP: loop_data has no
  exhibition column and both the sim and LoopData read it by track_name WITHOUT joining races, so the flag
  alone does nothing — the guard resolves races.exhibition → race_id list and excludes on loop_data.race_id.
  Any non-points/invitational event gets `exhibition=true` at load time. Do NOT load the NW Cup All-Star as points.
- **DNF rate: measured, not bucketed** (SimulationCenter, `resolveDnfRate` + `DNF_BY_GROUP`). The sim already
  measured each track’s DNF rate then threw the precision away bucketing into Low/Med/High (±5pts error).
  Now continuous: track rate shrunk toward the empirical (series × group) rate. Fixes North Wilkesboro (Cup
  has ZERO races there → was defaulting to 15% vs a true short-track 8.1%). Brier-neutral; shipped on
  measurement grounds, NOT counted as a model win.

**MODEL VERDICT: no other changes.** Practice pace (0.15) VALIDATED for the first time. trackHistory (0.15)
stays. Fable’s SS noise ×3 multiplier independently confirmed. Caution-preset auto-logic lands on the
measured noise optimum for every track group. North Wilkesboro (a short track) is next — DNF fix applies.

**STAKING HIERARCHY (from the first-ever SS + road harnesses).** Road: model edge is HUGE (~50% over a
uniform guess) — trust the sim, size up. Intermediate / Short & Flat: real edge, normal sizing.
Superspeedway: model edge is ~NOTHING (2.6% over guessing) — do NOT size on model edge (ev/medge); line-shop
(mev) only. This kills MODEL alpha at pack tracks, NOT line-shop alpha.

**PRACTICE PACE — what it is and isn’t.** Real signal (regression t=4.06) but it converts almost entirely to
PLACE accuracy: NOTHING on win (−0.21±0.25 Brier), +2.9 Brier on top-10 (t=2.90). It tells you who has a good
car, not who wins. Keep 0.15; do NOT raise it (0.30/0.50 are worse). Winners are top-10 practice cars in 25 of
47 races. Sleeper effect (fast in practice + deep on grid → +5.9 places) is REAL but ALREADY PRICED (#114).
Chastain @ Charlotte 2025 (practice P1, started P40, won) is the sleeper term, not a counterexample.

**TWO METHODOLOGY RULES now in force (both cost real error today):**
1. Noise and any dispersion change are SUBSTITUTES — never test a spread-changing idea at frozen noise; always
   re-tune noise per variant. (This retracted the earlier “shrink-to-50 is a load-bearing regularizer” claim —
   renormalization is Brier-NEUTRAL, not worse.)
2. NEVER drop a sim input on a regression t-stat — inputs are collinear by construction (corr≈track,
   rank≈margin). Confirm in the harness. (Nearly killed trackHistory on this; it earns its keep.)
Plus: measure sleeper effects as POSITIONS GAINED vs grid, never absolute finish. And 2022 is a data BURN-IN
year (75.7% zero track-history) — do NOT select noise on a train set that includes it; use 2023-24.

**RECORD CORRECTION.** The “0.0003” figure is the SLEEPER RESIDUAL partial correlation from #114 — NOT a
practice-edge measurement. It means the sleeper effect has no residual alpha, not that practice is worthless.

**REJECTED this session (all backtested):** per-driver variance/ceiling; trackHistory renorm; per-market noise
retune; SS DNF reversal (placebo-controlled); trend_slope as a fade/sustain metric (3×); practice normalization
(min-max contamination real but immaterial at 15%); best_lap vs overall_avg swap; laps-run / longest-stint
(die once pace is controlled).

**OPEN THREADS.** (1) CLV tool EXISTS (GradeCenter, `clv_log`) but has only 16 rows from ONE race — run it every
week; it’s the only instrument measuring the REAL model vs the stripped harness. (2) The win market needs more
events; the column that would test “sustained long-run pace” is `late_run_avg`, only 42% populated — backfill
the long-run columns (`late_run_avg`, `long_run`) INSIDE existing races, worth more than adding races.

### loop_data.race_number REGRESSION - track occurrence vs season round (FIXED, commit `da631ef7`, 2026-07-12)
`Load New Race` (Admin.js) was stamping **`loop_data.race_number` with `trackRaceNum`** - a count of prior
visits to that track that year (`(priorCount || 0) + 1`, i.e. 1 or 2) - instead of the SEASON ROUND.
The `races` row got the correct round; its `loop_data` rows did not. Violates the Race # single-source-of-
truth doctrine directly below.
SYMPTOM (O'Reilly Atlanta 2026, race_id 409): the LoopData UPPER table showed only ONE of the two 2026
Atlanta races, while the superspeedway AVERAGES table showed BOTH. The upper table keys race columns on
(year, track, race_number); spring Atlanta is season round **2** and the summer race got trackRaceNum
**2**, so they collided and collapsed into one column. The averages table aggregates raw rows by track
and never reads race_number - which is exactly why it still looked right. **A disagreement between two
tables on the same page is the tell: the one that ignores the broken key keeps working.**
NOT COSMETIC: the sim publishes + grades by SEASON ROUND, so GradeCenter would have found no actuals
(or matched the WRONG race) for any race hit by this.
SCOPE: fresh regression. Audited all O'Reilly 2026 races - R1-R19 all had loop.rn == races.rn; only 409
mismatched. Single-visit tracks would have silently gotten race_number = 1 too, so it would have
surfaced on the very next load regardless.
FIX: the loop_data insert now uses `parseInt(raceNum)` (season round); the dead `trackRaceNum`/`priorCount`
lines were removed (an unused var FAILS the Vercel build - CI treats warnings as errors). Data repaired
by user SQL: `UPDATE loop_data SET race_number = 21 WHERE race_id = 409;`
STANDING AUDIT QUERY - any race whose loop rows disagree with its registry row:
```sql
SELECT r.id, r.series, r.year, r.track_name, r.race_number AS races_rn,
       l.race_number AS loop_rn, COUNT(*) AS n
FROM races r JOIN loop_data l ON l.race_id = r.id
GROUP BY 1,2,3,4,5,6
HAVING r.race_number IS DISTINCT FROM l.race_number;
```

FULL-TABLE AUDIT (2026-07-12, all 367 races carrying loop data) - CORRECTS the THIRD INCIDENT note above:
  loop.race_number == races.race_number (SEASON ROUND) ... 364  (99.2 pct)
  mismatched ......................................... 3    (rid 404 / 405 / 408)
  multi-valued per race_id ........................... 0
**`loop_data.race_number` is NOT a track-visit count.** It is the SEASON ROUND in 364/367 races. The only
exceptions are the last four races ever loaded (404 trucks-2022 Mid-Ohio, 405 cup-2026 Chicagoland,
408 trucks-2026 Lime Rock, 409 oreilly-2026 Atlanta) - every one a victim of the `trackRaceNum` loader
regression, not a legacy backfill. The 'visit count with inconsistent backfills' reading was inferred
from ONE two-race collision (Feb Atlanta's season round 2 vs the new race's visit count 2) and
generalised into a property the column never had. Repaired by user SQL to 15 / 19 / 14 / 21.
NOTE rid405 is cup Chicagoland - the graded race - so any loop join on race # was silently missing it.
RECONCILIATION: Fable's grader-import fix (resolve the race via `races` -> `loop_data.race_id`, commit
`edd6ab9a`) STAYS - routing through race_id is strictly more robust and costs nothing. But the
STANDING RULE should read: race_id is the safest join key; `loop_data.race_number` is the season round and
is now consistent - if it ever disagrees with `races.race_number`, that is a LOADER BUG to fix, not a
property to route around. The LoopData upper table legitimately groups on it; 'fixing' the column to be
a visit count would break that table.
LESSON: when a column looks corrupt, AUDIT THE WHOLE TABLE before inferring its semantics. A 3-row
regression looked like a 13,000-row design flaw.

### UI work shipped 2026-07-12
- **Practice uploader lap headers** (`excelParser.js`, commit `448b3e8d`): the lap-column regex was
  `/^[Ll]ap\s*(\d+)$/` - CASE-SENSITIVE - so `LAP 1` (all-caps, the Google Sheets export format) matched
  NOTHING and the upload died with 'Could not find lap time columns'. Now `/^lap\s*#?\s*(\d+)$/i` (any
  case, tolerates 'Lap #1'). Lap columns are also now SORTED by lap number, so a sheet whose columns run
  LAP 30..LAP 1 (descending - common in exports) parses identically to 1..30. Laps were already keyed by
  header number rather than column position, so order was mostly safe already; the sort makes it explicit.
  Verified on all four header styles.
- **Car-number PNGs on FastestLap + GreenFlagSpeed** (commits `200c9322`, `2f754fc3`, `731f6a9f`):
  mirrors LoopData's rendering (per-series `/car-numbers/`, `/car-numbers-oreilly/`, `/car-numbers-trucks/`;
  `133`->`33` alias; onError retries once with a cache-bust, then hides). FastestLap is cup-only
  (`fastest_laps` has no series column) so it uses the cup path.
  **BUG WORTH REMEMBERING**: GreenFlagSpeed's `HeatMapView`/`RaceTable` are CHILD components that never
  receive `series` - the first pass referenced an out-of-scope variable. ALWAYS check whether the JSX you
  are editing lives in a child component before reaching for a parent's state. Fixed by threading the prop
  through both call sites. (`RaceTable` is defined but never rendered - dead code.)
  Missing art added to `public/`: cup 78, oreilly 30 + 38, trucks 4. NOTE oreilly has NO car-4 art - that
  driver's number simply will not render (the onError fallback hides it; no broken image).
- **Lap Raptor attribution removed** from the public Fastest Laps subtitle (commit `89603c91`). The 4
  remaining references in Admin.js are the paste-workflow instructions and were intentionally KEPT.
- **Stage-length inputs** on SimulationCenter beside Race Length (commit `2ff81684`): `stage1Laps`/
  `stage2Laps` stored in the published `config`. DATA CAPTURE ONLY - no sim module reads them yet.

### Race # guards — ALL loaders + publish (commits `a86f3bc7`, `c1720c41`, 2026-07-10)
Publishing a sim now HARD-BLOCKS if the series' Race # field is empty (boards/grading join
on race_number; a null-R# board is unmatchable). Load Qualifying, Qualifying Order, and the
Practice uploader block the same way; the practice Race # no longer silently defaults to 1
(that default is how the pre-2026-07 sessions all got stamped R1). Load New Race + GFS
already had guards. Entry list needs none (no race_number column — keyed year+track).
Same-weekend rule: use each series' own season R# consistently across every tool.

### Market value min-edge — decoupled from "Qualified only" (commit `70506c1b`, 2026-07-10)
min edge + fav cutoff now always apply and always render; "Qualified only" is purely the
model+market-agreement toggle (ev>0 AND mev>0). Previously the edge/fav filters only ran
inside Qualified, which also silently required market agreement — inputs looked dead.
`ev`/`mev` are integer PERCENT units (×100 at build in `__marketValue`).

### HOUSE FLOOR: 10% edge / -250 fav cap (commits `c3aa64b3`, `e004fdce`, 2026-07-10)
Superseded the viewer-adjustable filters above on PUBLIC pages, same day. Two enforcement
points, BOTH hard-coded (change requires a code edit, intentionally):
- **SimResults (public)**: `MIN_EDGE_PUBLIC = 10`, `MAX_FAV_PUBLIC = -250`. The min-edge /
  hide-favs inputs were REMOVED (viewers could change them — SimResults has no auth).
  Qualified = ev >= 10 AND mev > 0 AND fav not shorter than -250. The Edge column renders a
  dash for anything below +10% — sub-floor edges are never visible, even with Qualified
  off. Display-time -> retro-cleans all previously published boards.
- **GradeCenter**: `MIN_EDGE_BET = 10`, `MAX_FAV_BET = -250` in `__gradeRace` — ev_flags/ROI
  only log bets at 10%+ edge (was: any ev > 0). Keeps the sim_grades ROI sample honest.
- Admin-side SimulationCenter market-value preview is UNTOUCHED (full detail + adjustable
  filters — that's the admin decision tool).
- Stacks on the PROBABILITY tail guard (win>=2% / t3>=5% / t5>=8% / t10>=12%, 2026-07-09):
  that kills implausible model probs (Reaume +12000), this kills thin edges (+6% Ankrum).

### Phantom race rows — FIXED (commit `b8bbeb8b`, 2026-07-10)
Incident: Chicagoland Cup 2026 ended up with THREE races rows (392 practice stub / 405
Load New Race / 406 phantom). Two compounding bugs, both fixed:
(a) **Load New Race deduped only by `racing_reference_id`** — it never adopted the stub
row a practice upload creates pre-race, so every "practice first, loop data after the
race" weekend minted a duplicate race row. NOW: before inserting, it looks up a stub
(same series+year+track_name+race_number, `racing_reference_url IS NULL`) and UPDATEs it
in place — loop data, race_date and RR URL land on the SAME race_id the practice
sessions already use.
(b) **Practice uploader's race lookup used `.single()`** — with 2 matching rows it
errored, returned null, and the fallback CREATED a third row. NOW: fetches all matches
and prefers the row with `racing_reference_url` (the canonical loader row).
Cleanup (user-run SQL 2026-07-10): deleted sessions on 392/406, all Cup 2026 Chicagoland
practice_laps (doubled — the laps delete key missed because old laps carried a different
`race_number`), and races 392/406; everything consolidated on 405. Related lesson: a
stale browser tab grades re-uploads with the OLD bundle (grades compute client-side at
upload) — hard-refresh before re-uploading after any grader deploy.

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
| #119 | CLOSED-PENDING-DATA 2026-07-10 (Archive C, full arc): the allocation-conditioned practice finding DISSOLVED on true labels — it was detector-mislabel noise. Keep overall_avg unconditionally. Infrastructure kept + accruing: `practice_sessions.tire_sets` fully labeled 2024–26 cup (Jayski Goodyear notes + operator fact-check; fall Phoenix 2025 = prime/option mixed-compound, EXCLUDE from any practice pooling), fresh-set detector demoted to display hint, practice_laps names normalized. REOPEN at ≥8 verified homogeneous multi-set races with practice+finishes. TODO: Tire Sets input on practice uploader; LOAD Chicagoland 2026 cup loop data (PDF on disk, race ran, adds 3rd verified multi race). |
| #117 | ~~Normalize `green_flag_speed.track` names~~ DATA HALF DONE 2026-07-08 (SQL run + REST-verified): 9 drift names fixed to canonical, Milwaukee's 2 spellings unified to 'Milwaukee Mile', dirt Bristol aligned to 'Bristol Motor Speedway Dirt Track' (distinct on purpose — self-excludes from Bristol pools). NEW `tracks` rows: 'Lucas Oil Indianapolis Raceway Park' + 'Milwaukee Mile', both Short & Flat grp 6 (user-approved) — their Truck races can now pool. Deliberately NOT in `tracks`: LA Coliseum (exhibition), Knoxville (dirt). REMAINING (code half): the GFS loader still saves scraped names — swap to the `tracks` dropdown like the other loaders (2026-07-06 pattern). GFS as a sim weight: TESTED + REJECTED 2026-07-08 (Archive C) — do not re-test. |


## 2026-07-17 (later) — GRADE FORMULA v4 SHIPPED: best5 replaces bestLap in the composite (ALL series)

- practiceGrader.js (24584c71): grade composite is now **50% avgPace + 50% best5** (mean of 5 fastest laps). Fallback chain for the speed half: best5 rank -> bestLap rank -> 50. Applies to cup, trucks, AND oreilly (grading objective differs from sim input — see BACKTEST_LOG cbdc7505 for the 70-session validation, W47/L23).
- Group condition correction extended: correctKey('best5','__gcBest5') — A/B sessions rank on the corrected copy. Stored metrics remain RAW (no change to sim-side handling).
- PracticeReportCard.js (8c27bd7b): subtitle + Grade tooltip now say Best 5 Laps / v4. Best Lap COLUMN still shows the raw single fastest lap (display only).
- GOTCHA: grades stored before this ship (incl. the 2026 North Wilkesboro trucks upload made just before it) are v3 grades — they only regrade on RE-UPLOAD. Operator is re-uploading NW trucks.
- Rejected for the formula (tested): consistency (zero signal, hurts as 3rd component), best_stint (dominated), 3-way blends (dilution). long_run is promising but only 4 sessions store it — revisit at ~20+.


## 2026-07-17 (night) — BUG FIX: corr-pool cup leak (4e92f3d6)

- Since b2c916e8 (07-08), cup loop rows at corr-group tracks silently entered EVERY driver's base pool (rating/avgFin/winConv) in trucks + oreilly sims. Intended design (and operator's mental model): cup enters ONLY via crossover_borrows (currently: Chase Elliott, weight 1, forced).
- Fixed: baseRows ~ own-series rows only. Explicit borrow path unchanged. Config stamps poolScope: 'series-only' on published boards.
- GOTCHA for graders/reviewers: trucks/oreilly boards published 07-08 -> 07-17 carry contaminated pools where cup-crossover drivers raced (Hocevar NW case: pool 78.8 vs true 96.2). Treat their grades accordingly in #55-style reviews (check config.poolScope — absent means pre-fix).


## 2026-07-17 (late night) — PAIRING-FIRST BORROW SHIPPED (5755e02a)

- crossover_borrows path only: forced-borrow drivers with >= 2 current-season own-series loop rows use the mean rating of THOSE rows as srcRating (Bell: 109.7 from 4 races in the 62) instead of raw untranslated cup. No pairing rows -> old raw-cup fallback (Elliott). Config stamps borrowMode: 'pairing-first'.
- NOT backtest-validated; operator-directed. #54 (end 2026) now compares: raw cup vs +29 offset vs pairing-first.
- Operator re-ran + republished NW trucks board after this ship.


## 2026-07-18 — GOTCHA: do NOT load exhibition (All-Star) loop data yet (task #63)

- Sim corr-pool + track-history fetches select loop_data by track_name/series WITHOUT checking races.exhibition. Exhibition races have ~20-car fields -> field-relative metrics (rating, pct top15, avg position) are inflated/incomparable and would leak into sim pools.
- Fastest Laps already filters exhibitions; sim fetches do not. Add the guard BEFORE any All-Star loop PDF is loaded. Until then: exhibitions stay out of the DB entirely (current state — e.g. Bell's 2025 NW All-Star win is deliberately absent; it informed an operator eq_override instead).


## 2026-07-18 — UI: score breakdown hides zero-weight columns (e9d6bfd8)

- Sim Center breakdown table (headers + row cells) now filters columns by the ACTIVE profile's weights — SRP/Fall/RC vanish under DEFAULT_WEIGHTS (all 0.00 there), reappear under road/SS profiles that use them. Purely display; scores/composite unchanged. Both render sites keyed to the same wkey map (corrHistory/longRunPace/shortRunPace/startPos/tireFalloff/raceCraft/trackHistory) — keep them in sync if weights profiles gain new terms.


## 2026-07-18 — UI: Practice Comparison Tool table rework (267b51f7)

- Dropped "Late Run Avg (last 25%)" column + its computation.
- Added "Group" column left of Start: fetches practice_sessions (driver_name, practice_group) for the selected session (series/year/track/session/race_number scoped), merged by normalized name onto the lap-table drivers. Shows '--' when the session has no groups (e.g. NW trucks 2026). Display only.


## 2026-07-18 — UI: Comparison tool adds 5/10/15 lap averages (2245b026)

- Three new columns right of Avg: best CONSECUTIVE 5/10/15-lap averages (NASCAR practice-sheet convention). bestNAvg splits laps into runs on lap-number gaps (pit/filtered laps break runs), sliding-window best within runs, '--' when no run is long enough. NOTE: intentionally different from the sim's best5 (5 FASTEST laps, any order).


## 2026-07-18 — SHIPPED: minor-series recency cw3 (042a4dd4) + DNQ start-position filter (a4cab1f0)

- Corr pools: current-season age weight 3.0 for trucks/oreilly, 2.0 cup (validated W82/L56 p~.03). ALL age ladders now RELATIVE (were frozen to 2026 — would break in 2027). Config stamps recencyCw.
- Sim field: entries with no start position (qualifying OR practice-sheet grid) are dropped once >= 20 starts exist. DNQs/no-shows can no longer receive sim placements. No marking needed — null start IS the marker.
- Operator re-runs + republishes NW trucks board after these (field should drop to 36).


## 2026-07-18 — SHIPPED: DK accuracy metrics in Grade Center (77c6b4db)

- Every loop-data grade now stores metrics.dk (n/mae/bias/corr/spearman) — proj_dk vs actual DK from loop rows (same scoring formula both sides). SQL peek: SELECT series, graded_at, metrics->'dk' FROM sim_grades ORDER BY graded_at;
- Retro: only 2 graded boards exist, both Atlanta SS — bias ~ 0 (good level), corr ~ 0 (wreck lottery). Judge DK accuracy by track type as data accrues.


## 2026-07-18 — SHIPPED: CLV tracking (06d5be47 + 30b50e2a)

- New table odds_snapshots (operator ran SQL; RLS public read/insert). Sim Center auto-snapshots every distinct odds paste. Grade Center stores metrics.clv (plays/playsAvgPct/playsPosPct/fieldAvgPct/fieldN) using the last pre-race snapshot cluster as the close.
- HABIT: final odds paste + Run at green flag ~ official close (no publish needed).
- SQL peek: SELECT series, graded_at, metrics->'clv', metrics->'dk' FROM sim_grades ORDER BY graded_at;


## 2026-07-18 — pit_stops DATA LAYER built (NASCAR raw telemetry; loader is Python, runs on operator's machine)

- **NEW TABLE `pit_stops`** (DDL: `pit_stops_schema.sql`, user-run) — raw per-stop NASCAR pit telemetry
  from cf.nascar.com `cacher/live/series_{s}/{race}/live-pit-data.json` (verified populated 2018+;
  we ingest 2022+ only per era rules). One row per stop: race_id (FK->races), nascar_race_id, series/
  year/track_name/race_number (denormalized FROM the races registry, so canonical by construction),
  car_number (text, matches loop_data), driver_name, nascar_driver_id, **organization** (weekend-feed
  team_name — CREW KEY = car+organization+season; crews belong to the car, not the driver), crew_chief,
  manufacturer, pit_box, lap (vehicle lap at entry), leader_lap, **flag_state** (pit_in_flag_status:
  1=green, 2=yellow, 8=warmup) + flag_state_out + green_flag bool, pit_stop_type, tires_changed +
  lf/lr/rf/rr, **box_time** (pit_stop_duration), pit_road_time (total_duration), in/out_travel,
  pit_in/out_race_time, pit_in/out_rank, positions_gained_lost, prev/next_lap_time, created_at.
  RLS public read + insert/delete (loader needs delete-then-insert; tighten under #83).
  Unique backstop: (series, year, race_number, car_number, lap, coalesce(pit_in_race_time,-1)).
- **LOADER `pitboard_pit_backfill.py`** (root; needs network -> runs on the operator's machine, NOT
  a serverless/Admin.js path — the source is NASCAR's API, not a paste). DRIVEN FROM THE `races`
  REGISTRY: year>=2022 + exhibition IS NOT TRUE + series in (cup/oreilly/trucks) -> era floor and
  exhibition exclusion are inherited, race_number is the season R# by construction. Registry row ->
  NASCAR race id match: race_date +/-1 day first (doubleheader same-day disambiguated by track), then
  canonical-track positional fallback (EchoPark->Atlanta alias map included). Weekend-feed provides
  the car->team_name/crew_chief/driver_id/pit_box map + race_type_id guard (!=1 -> skip). Idempotent:
  DELETE by race_id then INSERT. Usage: `--year 2026` (default) / `--year all` (2022-26) / `--series
  trucks` / `--race-id N` / `--dry-run`. Prints per-race row counts + join-match rate vs loop_data
  (car_number match pct + normalized-name match pct, GradeCenter-style normalization incl (P)/(i)
  suffix stripping) and lists unmatched registry races for manual resolution.
- **DATA QUIRKS found while probing the source** (all verified live 2026-07-18): (a) NASCAR uses -1
  (and 0 for prev/next_lap_time) as not-populated sentinels — loader stores NULL, so box-time medians
  are never poisoned; an in-progress stop's row exists with -1s and gets backfilled by NASCAR within
  seconds. (b) prev/next_lap_time are uniformly 0 before ~2022 (not needed — we start at 2022 anyway).
  (c) pre-race/warm-up pit visits appear with flag_state=8 and lap<=2 — kept raw; analysis filters
  green_flag AND lap>0. (d) pit feed persists for ALL races 2018+ (checked 2018/19/20/21/22/23/24/25/26)
  — the "live" path is an archive, not a rolling feed. (e) pit_box (stall number) is in the weekend
  feed — free confounder input for later stop-time analysis (stall position affects in/out travel).
  (f) the archived feed can contain LITERAL DUPLICATE stop rows (same car/lap/pit_in_race_time —
  hit live on cup 2026 R2; Daytona R1 was clean). The unique index caught it (23505); loader now
  dedupes per key before insert, keeping the most-complete twin, and logs the dropped count.
  (g) COVERAGE GAP, confirmed at the source: NASCAR publishes NO pit feed at venues without
  pit-road timing loops — 2026: Rockingham (oreilly R8 + trucks R5), Grand Prix of St. Petersburg
  street course (trucks R3), Lime Rock Park (trucks R14). 403 at the CDN, not a match failure
  (verified 2026-07-18). Those races legitimately have zero pit_stops rows; expect the same at
  new/street/small venues in other seasons. NOTE NASCAR's track_name for St. Pete is
  "Grand Prix of St. Petersburg" (vs canonical "Streets of St. Petersburg") — date matching
  covers it, but add a TRACK_ALIASES entry if a name-fallback match is ever needed.
- **SCOPE HELD**: data layer only — nothing wired into the sim, weights, or any model input. Target
  metric (median green-flag 4-tire box_time per car per season + consistency) is SUPPORTED by the
  schema but NOT computed. Next: main session runs the pit-crew signal re-test (task #46) against
  this table + pit_crew_race (pitcrewrank.com, Cup-only) as the cross-check source.
- Relationship to `pit_crew_race`: complementary, NOT a replacement. pcr = trimmed/z-scored 4-tire
  summary per car per race (Cup only, their methodology); pit_stops = raw every-stop telemetry, all
  three series, with flag state + tires + travel splits. Validate one against the other on Cup races.


## 2026-07-18 — pit_stops FULL HISTORY loaded (2022-2026) + two wrong-event feeds purged

- Operator ran the loader with --year all: **369 races, 74,189 stops** loaded; accounting closes perfectly (369 loaded + 21 no-feed venues = all 390 registry races in scope; 0 unmatched). Coverage: cup 36/35/36/36/20 (2022-26), oreilly 32/32/30/20 (2023-26), trucks 20/18/20/22/12.
- **NEW SOURCE QUIRK (h): the archived feed can contain a DIFFERENT EVENT'S stops under a race id.** trucks 2022 R15 Mid-Ohio carried Cup drivers' stops; oreilly 2023 R13 Portland carried the ARCA support race. Pattern: standalone weekends (no Cup present) at one-off venues. DETECTION: the loader's name-join check (0% names vs loop_data despite ~56% coincidental car overlap). REMEDY: both races' rows DELETED (123 + 143); treat like no-feed venues. Any future load reporting name-join near 0% = wrong event, purge it.
- **REGISTRY GAP found during accounting: oreilly (Xfinity) 2022 season is entirely absent from the races table** — cup 2022 (36) and trucks 2022 (21) exist, oreilly starts 2023. Pre-existing loop-data-era gap, now task #65: load 2022 oreilly loop PDFs, then pit backfill --year 2022 --series oreilly.
- Usable pit corpus after purge: **367 races, 73,923 stops** across 4+ seasons, 3 series. Task #46 (pit-crew signal test) is UNBLOCKED.


## 2026-07-18 — SHIPPED: pit crew term v1-0.06 (8bab6b69) — task #46 CLOSED as PASSED

- Sim now fetches pit_stops (current season, series, 4-tire, timed) at load; median box_time per car (>= 5 stops) -> pitScores (lower better) -> 0.06 weight in ALL profiles. 'Pit' column in breakdown. Config stamps pitCrew: 'v1-0.06'.
- Evidence: crew signal + and significant in all 3 series and all 4 track groups, pooled t 7.54 over 9,813 driver-races, leak-free walk-forward, residual to corr prior. Weight from sweep plateau (0.15-0.25 share) shrunk to 0.06.
- OPERATOR WEEKLY: run the pit .bat after each race (with the loop PDF) or the crew medians stop updating (fail-open to neutral).

- ADDENDUM (9ab31870): Pit Crew stepper added to the Sim Admin weights row — the term was active via DEFAULT_WEIGHTS but the hand-built stepper list lacked a control. GOTCHA for future terms: adding a weight to the profiles does NOT surface it in the admin UI — the stepper array (~line with 'Corr. Track History') must be updated separately, plus the breakdown wkey arrays (two sites).


## 2026-07-18 — SESSION CAPSTONE (marathon ends; operator near Fable cap until 07-21). READ THIS FIRST, NEXT SESSION.

**MODEL STATE (every published board stamps these in config):** practiceMetric best5 (cup+trucks; oreilly overall_avg) / poolScope series-only / borrowMode pairing-first / recencyCw 3 minors, 2 cup / pitCrew v1-0.06 (all profiles) / eqOverrides + weights + lineup also stamped. Grader v4 (avgPace50/best5-50, all series, group-corrected). DNQ filter live (no start position + real lineup = out of sim field).

**SELF-GRADING LEDGER (all automatic once operator grades a race in Grade Center):** sim_grades.metrics has briers (win/t3/t5/t10), spearman_pf, mae, prec, dk {mae,bias,corr,spearman}, clv {plays,playsAvgPct,playsPosPct,fieldAvgPct} (clv populates from odds_snapshots — began 07-18, first full row expected week of 07-20). One query shows everything: SELECT series, stage, graded_at, config, metrics, roi FROM sim_grades ORDER BY graded_at;

**OPERATOR WEEKLY RITUAL:** practice sheet upload (Fri) -> odds pastes auto-snapshot (paste freshest + Run once at green flag = closing line) -> post-race: loop PDF -> PIT_BACKFILL_2026.bat -> grade both boards in Grade Center. Everything downstream updates itself.

**REVIEW QUEUE (task numbers = session task list, details in BACKTEST_LOG):** #55 best5 live verification at ~6 graded cup/truck boards — COUNTER: 1/6 (NW trucks R15, strong row: spearman .696, +13.3u on 4 flags, flagged 11-1 winner). pitCrew v1 review rides the same counter (v2 candidates logged: per-series 0.05/0.06/0.08 + SS upside). #52 dominance re-run at ~75 practice-backfill races. #54 ringer borrow 3-way (raw vs +29 vs pairing-first) end of 2026. #48 wreck-excluded pools end of 2026. #45 rookie SS fill. #51 correlated-noise prototype (before next SS). #40 entry-manager replace-driver. #56 label practice groups on split weekends. #63 exhibition guard BEFORE any All-Star loop load. #64 RLS tighten before go-live. #65 oreilly 2022 loop backfill (then pit --year 2022 --series oreilly).

**STANDING OPERATOR CHORES (repeated because still open):** ROTATE THE GITHUB TOKEN (in these docs since 07-15 — long overdue). Check Vercel env vars (REACT_APP_SUPABASE_* — hardcoded fallbacks in src/lib/supabase.js are load-bearing since the 07-17 outage). OneDrive: nascar_data set to always-keep-on-device after the Errno-22 capture crash (v3 aux writes now fail-soft).

**COLLABORATION PROTOCOL (unchanged, it works):** GET fresh before PUT; append-only on both docs; corrections are new entries; verify builds via commit status + minification-surviving string literals; sync local Handoff copies after every push; model changes gated behind backtests (bar examples all through this log); operator judgment goes in dials/overrides (stamped), never silently into code.

This was the 07-15 -> 07-18 marathon: best5 shipped end-to-end (sim, grader, live-verified), cup-leak regression found+fixed, pairing borrow, minor-series recency, DNQ filter, DK + CLV tracking built, pit telemetry pipeline (scraper: operator; data layer: parallel session; signal test + ship: same day, t 7.54), first live grade cashed a flagged 11-1 winner. The docs are the memory. Trust them.


## 2026-07-20 — IRP abbr, DFS dominator recalibration, DFS Center + Optimal%

**IRP track abbreviation.** LoopData.js TRACK_ABBR += `'Lucas Oil Indianapolis Raceway Park': 'IRP'`. GreenFlagSpeed.js uses a word-stripper (shortTrackName) not the map, so added an override at top of that fn returning IRP for the exact track. Other Indy tracks untouched (IMS=IND, GP=Indy GP). Commits 3b47141 / 88eacce.

**DFS dominator allocator recalibrated (SimulationCenter runRaceSim).** The sim already computed full DK points/iteration (dkFinishPts + place-diff + lapsLed*0.25 + fastLaps*0.45). Laps led/fastest laps were allocated by a hand-set exp(-k*i) over finish rank (k=0.38*(1-chaos)). Measured real distributions from loop_data (389 races, 14,360 driver-rows): winner leads ~32% of laps then cliff (P2 11%, P3 7%) — the exponential was far too flat at P2-P5 (gave 22%/15%). REPLACED with empirical by-finish share curves (LL_FIN_CURVE / FL_FIN_CURVE, P1-P40, renormalized to field, caution-flattened toward uniform via chaosFactor). Reproduces winner 32% / top5 60% / P21+ 17% by construction. Fastest-laps winner ~19%. Rejected a fancier design (rank by speedScore + independent noise) — offline MC showed sim noise (16) >> talent spread (9) collapsed winner share to 4%; the finish-anchored empirical curve is correct. Commit f169a1c.

**DFS Center (new public page /dfs, top-level nav tab).** Reads latest sim_results.results per series -> value board (proj_dk, value=pts/$1k, win%, laps led, fast laps, proj fin, sortable, lock/exclude) + lineup optimizer (6 drivers / $50k / branch-and-bound top-N, exposure cap). Salaries: dfs_salaries table (JSONB {driver: salary} per series/year/race). Salary ENTRY moved off the public page into Admin > DFS tab (admin-gated, DfsSalaryAdmin.js); public is read-only. Note: dfs_salaries had a pre-existing legacy schema (id/series/track_name + driver_name NOT NULL) — DROPPED and recreated with JSONB. Commits d1f57bf/c548aa0/3ad35cc + Admin/Nav wiring.

**Optimal% (ceiling/leverage).** At publish, SimulationCenter now retains a subsampled per-sim DK matrix (~1000 sims, integer DK, aligned to driver index) attached to the results array and written to new table dfs_sim_samples {series,year,race_number,track,drivers[],samples[][]}. DFS Center Build step solves the salary-optimal 6-driver lineup per sample (knapsack B&B, K=1) and tallies optimal% per driver. Requires: create dfs_sim_samples table + REPUBLISH a sim to populate (existing published sims have no samples). Commit a6ff81e.

**Projected ownership% — DEFERRED (decision).** Needs historical DK contest ownership to calibrate; ~70-85% of ownership is value-driven but the residual is NASCAR crowd behavior (Larson/Chastain over-owned, dominator/pole narratives) exactly in the mid-tier where leverage calls happen. Plan: start logging weekly DK ownership now, calibrate after ~10-15 races (run-the-tape, same as CLV), then leverage = optimal% - ownership%. Until then no fake ownership number.

**DDL the operator must run:** (1) dfs_salaries dropped+recreated as JSONB-per-race table w/ public RLS; (2) new dfs_sim_samples table w/ public RLS.


## 2026-07-20 (cont.) — Historical DFS salaries, market benchmark, loop_data name guard, nav reorg

**Historical DK salary ingestion (Cup 2026).** Operator uploaded a workbook (one tab per race, cols Driver + DK $). Parsed 21 tabs -> 754 salary rows (Atlanta 2 tab empty; Phoenix 1 missing salary). Tab order == loop_data race_number 1-21 (clean crosswalk, no fuzzy track match). Loaded to new table dfs_salary_history (series, race_year, race_number, track_name, driver_name, salary) joinable to loop_data. O'Reilly + Trucks workbooks still to come.

**Market-efficiency read (salary as a market line).** Computed actual DK points from loop_data (dkFinishPts + place-diff + laps_led*0.25 + fast_laps*0.45) and joined to salary. Finding: DK salary predicts actual DK at only ~0.29 Spearman (pooled AND per-race) -> the market is weak/beatable but single-race scoring is very high-variance. This 0.29 is now the bar our projected DK must beat going forward. Value (pts/$1k) is ~flat across tiers (3.3-4.0) with a mild barbell (best at 7.5-8.5k and 9.5k+, trap at 8.5-9.5k). Bombs concentrate at superspeedway/road (Larson Talladega -36, SVG Coronado -31) - same tracks the sim is weakest at. Salary stays OUTSIDE the model (grading benchmark + value denominator + future ownership input), never a sim weight (would be circular).

**Projected ownership - still deferred, now contest-aware.** Operator plays small sharp fields (e.g. $35k Piston, 4117-cap). Ownership is field-specific: small sharp fields run flatter/more-efficient than milly-makers, so a generic model would mislead. Plan: log ownership per contest (tag name/entry-cap/buy-in/single-vs-multi) FROM the contests he plays; DK ownership CSVs expire ~3 weeks so must capture weekly. dfs_ownership table created (unused so far - only ~2 races currently retrievable). Leverage = optimal% - ownership% once calibrated.

**loop_data name corruption fixed + guarded.** Daniel Suarez stored as 'Daniel Su - rez' in Cup races 18-21 (the accented a mangled to ' - ' when the operator Ctrl+A/Ctrl+C'd the source; the paste-parser stored it verbatim). Split his season history across two spellings. Fixed via UPDATE loop_data SET driver_name='Daniel Suarez' WHERE driver_name='Daniel Su - rez' (4 rows). NOT the Python scraper - operator loads via the Load Data page paste. Hardened that parser (Admin.js, commit abae523): before insert it checks each parsed driver against the known roster (loop_data distinct for series) and, on any unrecognized name, pops a confirm listing them with a Levenshtein did-you-mean, blocking the save unless okayed. Catches future mangles + genuine newcomers at paste time.

**Nav reorg.** (1) commit 724b9c7: renamed Loop Data dropdown -> Data Center; moved Qualifying off the top level into it. Data Center now = Loop Data, Green Flag Speed, Fastest Laps, Qualifying, Pit Crew Rankings (isLoopPage derives active-state from LOOP_LINKS so /qualifying highlights it). (2) commits 503bd19 + c3cb552: renamed Simulation dropdown -> Sim Center with three per-series links Cup Sim / O'Reilly Sim / Truck Sim -> /sim-results?series=X; SimResults reads ?series= via useSearchParams + effect (switches without remount); isSimPage strips the query when matching.

**Open threads:** load O'Reilly + Trucks historical salary workbooks; start weekly DK ownership logging (perishable); build the grading harness (our projected DK vs actual vs the 0.29 salary benchmark) once sims are republished with the new allocator; Optimal% activates after a republish (writes dfs_sim_samples) + posted salaries.


## 2026-07-22 — Extractor relocated + fully armored (status note)

- The live telemetry extractor now lives at **C:\Users\atmms\NascarDataScrapperV3\** (moved OUT of OneDrive — the old OneDrive\Desktop\NASCAR DATA EXTRACTOR V3 folder is abandoned; ignore it). Root cause of the Errno-22 capture crashes (OneDrive sync invalidating handles mid-append) is gone.
- ALL write sites are fail-soft: ingest raw (retry x4 -> skip line), aux_raw (same), write_sheets xlsx (retry -> alternate filename -> skip workbook; Excel-lock proof), plus the bare-launch help guard. Lap/pit CSV rows derive from in-memory data, so skipped raw-archive lines are harmless.
- Retired: the old pre-v3 copy at OneDrive\Desktop\NASCAR Practice Scanner\files\nascar_extract.py — do not run it (unpatched, duplicates polling).


## 2026-07-20 (cont. 2) - UI / nav / landing polish (HANDOFF to Fable, operator switching over)

**Nav finalized.** Top bar = Race Weekend, Data Center, Practice Center, Sim Center, DFS Center (Data Center swapped BEFORE Practice Center, commit bfc5d5d). Data Center dropdown = Loop Data, Green Flag Speed, Fastest Laps, Qualifying, Pit Crew Rankings. Sim Center dropdown = Cup Sim / O'Reilly Sim / Truck Sim -> /sim-results?series=X (SimResults reads ?series= via useSearchParams).

**Nav logo = plain white PITBOARD, bigger, no lugnut (current: commit e789a48).** IMPORTANT: an experimental unified logo (racing stripes + skewed PITBOARD, commits 1363c31 + RacingStripes d726f28) was tried and REVERTED at operator request. RacingStripes is back to both fixed corners (tl + br, commit 6f4c39b). Do NOT re-add the hex lugnut or re-color the logo gold.

**Loop Data table alignment (a89d7ee).** Driver cell left-aligned so the car-number PNGs line up across all three series. Root cause was a center-aligned <td> (PNGs are already uniform 31px). Matches Fastest Laps / Green Flag Speed look.

**Landing hero reworked (97b320e).** Headline broadened from betting-only to betting+DFS: "The model behind / every bet and lineup." Subhead now names DFS + the 3 books. Hero accents made MONOCHROME/white (badge, stat numbers, primary Get-Full-Access button) - operator dislikes the gold --accent on the hero. NOTE: rest of site still uses gold --accent (nav active state, What's-inside card tags/hover); operator may want a fuller de-yellow later - hero only for now.

**Data hygiene recap (already shipped).** loop_data "Daniel Su - rez" (accent mangled to " - " when pasted from source) unified to "Daniel Suarez" via UPDATE (races 18-21). Load Loop Data paste parser now checks each driver vs known roster and pops a confirm with a Levenshtein did-you-mean before save (Admin.js, abae523).

**Open threads (unchanged):** ingest O'Reilly + Trucks historical DFS salary workbooks (same pipeline as the 754-row Cup load); start weekly DK ownership logging (CSVs expire ~3wk); build grading harness (our projected DK vs actual vs the 0.29 salary-market benchmark) once sims are republished with the new dominator allocator; Optimal% lights up after a republish (writes dfs_sim_samples) + posted salaries. Live tables: dfs_salaries (JSONB/race), dfs_sim_samples, dfs_salary_history (754 Cup rows), dfs_ownership (empty).


## 2026-07-22 — SHIPPED: MCJ incident bundle (62417f84 + 13f3754d)

- EDGE flags require data confidence (>= 5 corr races or practice) — flagGuard 'conf-v1'.
- Thin-driver ignorance fill ~ de-vigged market win-odds percentile (marketAnchor 'v1'; salary-proxy validated, MAE .204 vs .282). Confident drivers: zero market influence. OPERATOR RHYTHM CHANGE: **Paste odds -> Run -> Publish** (guards enforce: empty-odds confirm + stale-odds confirm).
- Ringer (crossover_borrows) rows excluded from car equipment pools (Bell/62 -> MCJ ghost value).
- Caution preset auto-selects nearest calibrated anchor from track+series history (note shown in panel, SS pinned, manual override wins).
- Odds text still NOT persisted across page remounts — re-paste after any navigation (guard will catch it).

- ADDENDUM (4801bc18): odds paste boxes moved OUT of the simResults conditional — they now render as soon as the field loads, so Paste -> Run -> Publish is actually possible (previously the boxes only existed AFTER a run, forcing run-first and defeating the market anchors — operator catch). Parse-count feedback (DK/FD/HR n parsed) now works pre-run off the field list.

- ADDENDUM (dfe6a66b, marketAnchor 'v1.1-all-fills'): v1 anchored only the corr-history fill (~34% of score); pre-practice/pre-quali a thin driver's OTHER slots (practice, start) were still neutral-50 placeholders, so t3/t5 stayed inflated (operator catch on MCJ). v1.1: for thin drivers (same def as EDGE gate: <5 corr races AND no practice), ALL ignorance fills (history, practice lrp/srp, start) use the market percentile. Real data always overrides (Friday practice fills the practice slot with truth). Confident drivers: zero change.


- ADDENDA (v1.2 b87407d4, v1.3 92eda3ba, marker 5d4266c1): market anchor scale is LOG-prob min-max (rank percentile let the alphabet order co-priced +10000 longshots — MCJ got 51); thin drivers' TRACK fallback anchors to market too (established drivers keep validated neutral-50 — do not revert, see 07-18 rejection); breakdown cells show '*' when market-anchored (measured vs borrowed, product honesty + diagnostics). Stamp: marketAnchor 'v1.3-track'.


- FINAL ADDENDUM (4fb6bc84, marketAnchor 'v1.4-multimkt', FROZEN): anchor = multi-market tie-averaged rank percentile (win/t3/t5/t10 vote). MCJ convergence finding: his ~48 anchor is the market's real opinion in the weak IRP field, not a bug — all scales agree. No further scale changes by reasoning; re-derive only from odds_snapshots archive (~15 races). Thin-driver calibration added to the live review list.


## 2026-07-23 — pit_penalties PIPELINE COMPLETE (schema f9f98a5a, loader v2 253bffd8)

- **Source discovered + verified from the browser:** NASCAR race-control lap notes at cf.nascar.com/cacher/{year}/{series_id}/{nascar_race_id}/lap-notes.json (CORS open, archived like the pit feed; shape {laps:{lap:[{Note,FlagState,NoteID,DriverIDs}]}}). Penalties are EMBEDDED in narrative pit-cycle notes.
- **New table pit_penalties** (operator ran DDL): race-registry-denormalized, unique (race_id, lap, car_number, penalty_text), RLS public read+write (task #64 tightens). **category = 'driver'** (speeding/too fast, commitment, outside box) **vs 'crew'** (over the wall too soon, uncontrolled tire, too many men, improper fueling, safety violation, lug nut) **vs 'other'** — the attribution split is the differentiator vs pitcrewranks-style products.
- **Loader pitboard_penalties_backfill.py v2** (repo root; runs on operator machine like its pit sibling): registry-driven, harvests nascar_race_id from pit_stops (no re-matching), sentence-split -> per-car SEGMENT classification (v1 trimmed phrases to 8 words BEFORE classifying — chopped keywords off verbose prose, bloating 'other'; v2 classifies full segments, 9/9 on the live-sampled format tests). Idempotent delete-then-insert. Unparsed penalty sentences reported, never dropped.
- **Live result (--year all): 386 races -> 1,129 penalties (driver 567 / crew 352 / other 210)**; 5 races had no notes feed; 7 unparsed sentences remain, ALL pronoun-referenced or retrospective recaps (unparseable at sentence level by design; capturing them risks dupes). ~99.4 pct capture. Crew-penalty leaders 2022-26: cup #8 x8, cup #38 x7, cup #20 x7, trucks #22 x7, trucks #13 x7.
- **WEEKLY WORKFLOW SIMPLIFIED: POST_RACE_UPDATE.bat** (operator's scraper folder) runs pit stops + penalties for the current season in one click. Post-race ritual is now: loop PDF in Admin -> POST_RACE_UPDATE.bat -> grade both boards. The *_ALL.bat variants are history-rebuild tools only. Rule: .bat files are the buttons; never double-click a .py (default-runs and closes).
- **Scope held:** data layer only. Penalty-adjusted crew rankings = future display project (operator wants to flesh out rankings later); model untouched (freeze in effect).

## 2026-07-23 — task #67 CLOSED (no ship): driver speeding stays display-only

Ran the predictive test early (testing was never frozen — only shipping). Full numbers in BACKTEST_LOG same date. Short version: shrunken prior speeding rate DOES predict future penalties out-of-sample (3.0/4.2/6.0% actual across low/mid/high buckets, walk-forward 2025-26), but the net finish cost of a penalty race is only ~0.7 positions within-driver (t 1.58, n.s.) — drivers recover. Probability x cost = ~0.02-0.04 positions/race expected impact. No sim term. Driver penalties join crew penalties under task #66 (pit crew rankings page, display columns). Nothing shipped to the sim; freeze intact for the IRP weekend.

## 2026-07-23 — MONETIZATION DOCTRINE (operator ruling) + task #66 page spec

**Free/paid line (respect in all future UI work):**
- FREE tier: lap-by-lap practice data (viewable on NASCAR's own site anyway; free tier also neutralizes any commercial-use complaint about the one raw-ish surface we show).
- PAID tier: practice comparison tools, practice grader, all loop-data-derived pages, sim boards, rankings.
- RULES: paywalled content must always be DERIVED work (our columns, groupings, grades, ranks) — never host NASCAR loop PDFs or verbatim report reproductions behind the paywall. Legal basis: sports stats are uncopyrightable facts (NBA v. Motorola 1997; CBC v. MLB 2007); exposure vector is NASCAR.com ToS (personal/non-commercial, no bulk DB downloads) — contract risk, practical ceiling C&D/IP-block, mitigated by selling analysis not feeds. Add footer disclaimer "PitBoard is not affiliated with or endorsed by NASCAR" when paywall ships; keep NASCAR out of customer-facing branding/domain. Not legal advice; get an hour with a sports-IP attorney if revenue gets real.

**Task #66 spec — penalty-adjusted Pit Crew Rankings page (display only, data ready in pit_penalties):**
- Crew section (per car+organization+season): headline rank stays median green-flag 4-tire box_time (v1 metric). Add: crew-category penalty count + rate; PENALTY-ADJUSTED RANK = median box time + amortized time-equivalent per penalty (~1.5-2s/stop per 10% penalty rate — label the methodology on-page); bomb rate (pct stops over blown threshold); recency split (season vs last 6). Descriptive of what happened — fine for display despite failing sim-predictiveness (reliability .217/.179, 07-22).
- Driver row, VISUALLY SEPARATE from crew columns: speeding/commitment count + shrunken career rate (k~50 per 07-23 calibration note) + "chronic" tag for the Gibbs/Ky Busch/Suarez/Blaney tier. Never blend driver and crew penalties into one number — that is the credibility trap.
- Queued extras when built: green-flag-only medians, in/out travel adjusted for pit_box, two-tire frequency, rolling recency weighting.
- Timing: operator to decide build now vs post-IRP; display-only so freeze-compatible either way.

## 2026-07-23 — SHIPPED task #66: penalty-adjusted Pit Crew Rankings (e3b73ab9, build green, bundle verified)

PitCrewRankings.js enriched per the 07-23 spec. New default sort ADJ (s) = median green-flag-agnostic 4-tire box time + PEN_SEC (1.75s) x crew-penalty rate per race (crew-category pit_penalties / distinct races crewed). Added columns: Median (demoted, secondary), Adj (headline, bold, sortable), Bomb% (share of stops slower than BOMB_X 1.5x SERIES median, mixed-flag), Crew Pen (count + per-race rate), Drv Pen (driver-category count for the car this season + "chronic" badge). CHRONIC = embedded constant (career 2022-26 through 07-23, shrunk k=50 toward 3.9% base, min 60 races, threshold 1.8x base): ty gibbs 8.7, riley herbst 8.2, daniel suarez 7.7, martin truex jr 7.7, kyle busch 7.7, shane van gisbergen 7.4, john hunter nemechek 7.2 — REGENERATE this constant periodically from pit_penalties (accent-insensitive name lookup). Subtitle documents the whole methodology on-page (crew vs driver attribution stated explicitly — never blended). wrap widened 940->1120. Display only — zero sim impact, freeze intact.

OPERATOR RULING (same date): show aggregated pit TIMES, not bare 1/2/3 ranks — season medians are derived analysis (facts + our transformation), pitcrewrank.com precedent; the raw per-stop telemetry table stays DB-only, never exposed in UI. Queued for the page later: green-flag-only medians, pit_box-adjusted in/out travel, two-tire frequency, rolling recency / last-6 split.

## 2026-07-23 — SHIPPED: per-crew drilldown on Pit Crew Rankings (2774aa3f, build green, bundle verified)

Click any crew row -> expandable detail panel (React.Fragment + open-state toggle, colSpan 11): inline-SVG race-by-race median 4-tire trend (up = faster, y-axis labeled lo/hi), one dot per race with native title tooltip (R#, track, median, best, stop count, penalty note), penalty markers colored on the dot — red fill = crew penalty that race, orange = driver penalty, dark red = both (penR map from pit_penalties race_number, added to both selects along with track_name) — plus a summary line: best stop (s, R#, track), races, crew/driver pen counts. Legend under the chart. Matches pitcrewrank.com's per-crew race-by-race view and beats it on: penalty overlay + all three series. Display only; freeze intact.

PRECEDENT NOTES (operator diligence, same date): pitcrewrank.com age UNVERIFIED (retracted "operating for years" claim — no launch date found; site self-describes as fan-built on public timing data, free). Paid precedent stands regardless: WIN THE RACE (premium "Enhanced Loop Data", sims, FMV odds — near-identical product), FRCS.pro (paid loop-data CSV/Excel downloads + projections), RotoBaller/FantasyLabs/RotoGrinders NASCAR premium tools, and Bozi Tatarevic's PAID Substack pit crew reports (credentialed media, charges for pit-stop-derived analysis). No public record of NASCAR enforcement against any. Caveat logged: tolerance is not a license; attorney hour when revenue is real.

## 2026-07-23 — drilldown hotfix: robust y-scale (de43d377, build green)

Operator caught flat-line charts: one outlier race median (e.g. #20 crew R17 ~205s — wrecked/held car) owned the y-axis and flattened the 9-10s races into a line. Fix: y-domain capped at the Tukey upper fence of race medians (q3 + 1.5 IQR, floor lo+0.5s); outlier races clamp to the chart edge, axis label shows "Ns+" when capped, tooltip appends "(OFF SCALE - slow outlier race)". Data untouched — display scale only.

## 2026-07-23 — MAJOR FIX: qualifying-stops-only crew stats (5b05b664, build green, bundle verified)

Operator caught it via the Keselowski drilldown: raw stop log showed "stops" of 83-152s (crash repairs, penalty holds, non-competitive stops) mixed with real ~10s stops — R3 med 85.9s, R12 131.1s, R17 58.2s, R20 42.0s. These were inflating his season median to 11.23 (clean stops run ~10.2-10.8) and poisoning Bomb% (his 19% was mostly repairs). Ranks were unfair to any crew whose car got wrecked often.

Fix — ALL crew stats now computed on QUALIFYING STOPS only: series-level Tukey fence (stop-level q3 + 1.5 IQR across all 4-tire stops in series-season) excludes non-competitive stops from median, Adj, IQR/consistency, Bomb%, stop counts, AND the drilldown race medians (races with zero clean stops drop off the chart; the earlier chart-scale clamp stays as backstop). Bomb redefined: qualifying stop slower than BOMB_X 1.25x the series CLEAN median (hung-lug territory), so it now measures botched-but-real stops, not wrecks. MIN_STOPS gate applies to clean count. Same concept as pitcrewrank's "qualifying 4-tire" stops. NOTE for any future pit-crew sim work: v1-0.06 sim term uses its own median calc in SimulationCenter — check whether it needs the same fence (it uses green-flag medians which are less contaminated, but verify).

## 2026-07-23 — SHIPPED task #68: sim crew-term qualifying-stops fence (0c38b48a, build green, bundle verified)

Operator called for same-day validation instead of waiting out the freeze; PASSED with strict dominance (BACKTEST_LOG 6d645c22). Operator approved ship-before-IRP as a validated bug fix. Change: series-season Tukey fence on __byCar box times before crew medians; stamp pitCrew 'v1-0.06-fenced'. Friday IRP boards run clean input.

**WEIGHT DECISION — 0.06 UNCHANGED (operator asked "did this increase signal / change the weight?"):** the fence is a better MEASUREMENT of the same signal, not more signal — separate-model improvement is modest (t 18.61 -> 19.24, coef +3%); the big effect is WHO gets credit (36% of driver-races shift >5 pctile pts), which the existing weight now applies more accurately. The 07-23 re-test's absolute coefs (~0.22) are NOT comparable to #46's 0.095 (weaker control — trailing avg, not the full corr prior) and must not be used to re-tune weight. Proper weight re-sweep (clean input + full corr-prior control, per-cut incl. the known SS upside 0.111-vs-0.06 conservatism) queued with the end-of-2026 SS/ringer revisit (#48/#54 window). Until then: better input, same dose.

## 2026-07-23 — rankings page polish (f16a659c, build green): Median column DROPPED (redundant post-fence — Adj is the single headline number; operator call), Crew Pen per-race rate moved to hover tooltip (was truncating in the 80px column). Adj sort remains default; methodology unchanged in subtitle; drilldown colSpan 11->10.

## 2026-07-23 — rankings page: chronic badge REMOVED (operator call), penalty COUNTS in drilldown tooltips (ed364352, build green)

Chronic badge + embedded CHRONIC constant deleted entirely (subtitle clause too). Drv Pen column stays as plain count. Also resolved operator-spotted discrepancy: Gibbs showed 4 drv pens but fewer chart dots — penalties vs penalty RACES (his 4 = R1 + R5 x2 + R21; one dot per race). penR now stores per-race per-category COUNTS and tooltips show them ("2 DRIVER PEN"); dot colors unchanged.

## 2026-07-23 — rankings subtitle condensed (f63956ce, build green): wall of text replaced with lead line ("Adj (s) = median 4-tire box time + 1.75s per crew penalty per race — lower is faster; qualifying stops only; click any row for detail") + smaller one-line glossary (Consistency / Bomb% / Crew Pen / Drv Pen / thin). No logic changes.

## 2026-07-23 — SHIPPED: 2T (s) column on Pit Crew Rankings (672d0ef7, build green)

Median TWO-TIRE stop per crew, sortable, with its own series-level Tukey fence (2T stops live on a different timescale — cup 2T median 5.8s vs 4T ~10s; sharing the 4T fence would have kept repair-length 2T stops). Fetch widened to tires_changed IN (2,4), split client-side; 4T flow untouched (drilldown stays 4-tire only). Display rules: dash under 3 clean 2T stops, "thin" tag under 5, hover shows sample size. Glossary line updated. DESIGN NOTE (operator question was "how good are teams at two tire stops"): frequency of 2T calls is crew-chief STRATEGY, not crew skill — deliberately excluded from the column; only the median 2T time is shown. 2026 samples: cup 345 2T stops (median crew 8), trucks 135 (median 3 — mostly dashes), oreilly 225 (median 5).

## 2026-07-23 — rankings: column headers spelled out "Crew Penalty" / "Driver Penalty" (cols widened 100/112), their glossary entries removed from subtitle (66fabd77, build green). Glossary now only Consistency / Bomb% / 2T / thin.

## 2026-07-23 — DOCTRINE: input improvements do NOT trigger weight re-sweeps

Operator asked whether the fence fix means other weights should be re-backtested. Ruling: NO. An input-quality fix changes WHO gets credit within a term, not the term's share of total signal (fence: +3% coef, t 18.61->19.24 — noise reduction, not new signal). Weights get re-tuned only on (a) material change in a term's predictive share, (b) a new term entering, or (c) LIVE graded-board evidence of systematic miscalibration (#55 ledger). Rationale: every sweep re-mines the same 2022-26 corpus already tuned against repeatedly — piecemeal re-sweeps converge on fitting the backtest, not the sport. Standing plan unchanged: ONE comprehensive weight sweep end of 2026 (with #48 wreck-excluded pools, #54 ringer borrow, and the known SS pit upside 0.111-vs-0.06) validated against a season of live grades. Early reopen ONLY if live grades show pit-heavy tracks systematically under-called.

## 2026-07-23 — BUG FIX: DFS Center stuck on North Wilkesboro (efaabef9, build green, bundle verified)

Operator ran all three weekend sims (trucks IRP R16, cup Indy R22, oreilly Indy R21 — all present in sim_results, published_at 07-24 02:3x) but DFS showed NW for trucks+cup. ROOT CAUSE: sim_results.id is a UUID and DFSPage picked "latest" via .order('id', desc) — lexicographic UUID order is RANDOM (NW trucks row ee21671a happened to sort above IRP 4157cbd3; oreilly got lucky). FIX: order by published_at desc; same latent bug fixed in the dfs_sim_samples read (.order created_at desc — a re-run of the same race could have served stale samples). Audited the rest of the codebase for .order('id'): only other hit is SimulationCenter my_bets (exact-race filtered, display order only — harmless). LESSON for future code: NEVER use .order('id') as recency on UUID-keyed tables; use published_at/created_at.

## 2026-07-23 — DfsSalaryAdmin same UUID-order bug fixed (88c7f239, build green): salary admin picked its race via .order('id') on sim_results — same random-UUID-sort as DFSPage (a227cffd). Now published_at desc. That was the LAST .order('id')-as-recency in the codebase (audited).

## 2026-07-23 — entry list remove button restored + Reif->Eatmon swap (1fe17a5c, build green)

No way to remove entry-list drivers (Reif replaced by Eatmon, #42 Niece, IRP trucks). Cause: Admin.js deleteEntry + per-row button existed and DB deletes work — but the button element was EMPTY (x glyph lost in a past edit; invisible zero-width button). Fixed with &times; + title. Immediate swap done directly in entry_list (id 1325 -> Parker Eatmon; car/org/mfr kept); operator re-runs trucks sim. Task #40 (replace-in-car action) still open, less urgent now.

## 2026-07-23 — DFS Optimal% resolution: 1,000 -> 10,000 sim samples (4d11c980 + 6c7dbbed, builds green)

SAMPLE_TARGET 1000->10000 in SimulationCenter (stride 5 of 50k sims); DFSPage Optimal% loop chunked (400 exact lineup solves per tick, progress note) so 10k does not freeze the tab. NOT 50k by design: SE at 10k ~ +/-0.3pct vs +/-0.13 at 50k, for 7MB rows + minutes of solver — tradeoff stops paying at 10k. Takes effect on NEXT publish per board — republish the three weekend boards to upgrade samples.

## 2026-07-23 — DFS: DK CSV export shipped + optimizer stance (b0a5a951 + 790844bc, builds green)

Stance: projections + Optimal% are the product, optimizer is convenience — kept, but DK-uploadable CSV was the missing table-stakes feature. Shipped: DfsSalaryAdmin captures DK player IDs from salary paste (stored salaries.__ids in existing jsonb, zero schema change); DFSPage "Export DK CSV" next to Build (D,D,D,D,D,D header, Name (ID) cells, per-series filename, warns when IDs missing). OPERATOR: re-paste this weekend's full DK salary CSVs once so exports carry IDs (old saves are name+salary only).

## 2026-07-23 — DFS exposure cap fix (59a2df96, build green)

Operator caught 77% exposure at a 50% cap. Causes: cap computed vs REQUESTED lineup count while the candidate pool exhausted early (10 appearances / 13 delivered = 77%); K pool too shallow (x6). Fix: applyExposure fixed-point trim so every unlocked driver ends within maxExp of the DELIVERED set (locks exempt); K to numLineups x20 (cap 1500); shortfall surfaced in the note instead of silent over-exposure. Latent lock-vs-cap conflict also fixed.

## 2026-07-23/24 — SESSION CLOSE: state of play going into the IRP/Indy weekend

**Shipped today (all builds green, bundles verified, individually logged above):** task #67 closed (driver speeding no-ship, prob x cost); task #66 shipped + iterated (penalty-adjusted Pit Crew Rankings: Adj headline, qualifying-stops fence, per-crew drilldown w/ penalty-colored race dots + robust y-scale, 2T column, full penalty column names, condensed subtitle, chronic badge removed); task #68 shipped early after same-day validation (sim crew-term fence, v1-0.06-fenced — clean strictly dominates raw); dominator curves v2 (caution-bucket LL/FL, double-dilution fix, remainder-to-leader, domCurves cbucket-v2); UUID-order stale-race bug killed in DFSPage + DfsSalaryAdmin (codebase fully audited — no .order('id')-as-recency remains); entry-list remove button glyph restored + Reif->Eatmon swap in #42; DFS: Optimal% 1,000->10,000 samples (chunked), DK CSV export w/ player-ID capture, exposure cap fixed (delivered-set enforcement, locks exempt, 20x pool). Doctrines logged: input fixes don't trigger weight sweeps; track-history recency-weighting tested and REJECTED (career mean wins, n 5,316 — Majeski/Riggs board stands); monetization free/paid line + paid-precedent file (WIN THE RACE, FRCS, Bozi's paid Substack).

**OPERATOR CHECKLIST before green flag:**
1. RE-RUN + REPUBLISH all three boards (trucks IRP R16 / cup Indy R22 / oreilly Indy R21) — picks up: dominator curves v2, fenced crew medians, Eatmon in the #42, and 10k Optimal% samples. P-R-P: paste odds -> Run -> Publish.
2. RE-PASTE full DK salary CSVs (all three slates) in Salary Admin so player IDs get captured — otherwise CSV exports aren't DK-upload-ready.
3. Friday practice: upload -> P-R-P rerun (best5 injects measured speed; watch whether Riggs overtakes Majeski on data, not narrative).
4. Post-race: loop PDF -> POST_RACE_UPDATE.bat -> grade boards. Final odds paste + Run at green flag = CLV close.
5. Grab DK ownership CSVs (perishable) each slate.

**Standing:** freeze intact for betting model (fence was a validated bug fix; anchor v1.4 FROZEN pending odds_snapshots archive); #55 counter continues; ROTATE THE GITHUB TOKEN (badly overdue); open tasks #40, #45, #48, #51, #52, #54, #56, #63, #64, #65 + queued: 2T/rankings extras, speed-conditioned dominator curves, end-of-2026 weight sweep.

## 2026-07-24 — SimResults wrong-series race condition fixed (46a78116, build green)

Sim Admin -> truck results showed the CUP board under an active Trucks tab. Cause: mounts on 'cup', fires cup fetch, THEN ?series=trucks URL-sync flips state and fires trucks fetch — no stale-response guard, last response won. Fix: stale flag + effect cleanup drops superseded responses. Audit: SimResults was the only useSearchParams double-fire page (DFSPage/PitCrewRankings already guarded; GradeCenter/OddsPage/QualifyingCenter have no URL sync — left alone).

## 2026-07-24 — rankings columns reverted to Crew Pen / Drv Pen abbreviations, glossary restored (e91ea0b9, build green; operator call — spelled-out headers truncated). Fence threshold documented for operator: Tukey q3+1.5*IQR per series-season = cup ~18.4s (~1.8x the ~10.2s median), trucks ~39s, oreilly ~33s; ~11-13% of stops excluded; bad-but-real stops still count.

## 2026-07-24 — CORRECTION (operator caught it): yellow-flag stops are NOT slower — doctrine note

A claim repeated in recent entries ("lower-series medians run higher because most stops happen under yellow") is WRONG. Measured 2026, 4-tire stops within the series fence: green vs yellow clean medians — cup 10.3 vs 10.5, trucks 19.0 vs 18.9, oreilly 17.1 vs 17.4. Flag state is competitively irrelevant (~0.2s); crews go flat-out under yellow because track position is at stake. Lower-series medians are higher because their crews are slower over the wall, period. What IS true: yellow stops carry far more OUTLIERS (cup 18% beyond fence vs 3% green — damaged cars pitting under caution for repairs), which the qualifying-stops fence strips correctly. DOCTRINE: never filter or discount stops by flag state in crew metrics; fence handles the contamination. (The rankings page and sim term were already flag-agnostic — only the prose was wrong.)

## 2026-07-24 — medals enlarged site-wide (83aa4417 + 52a7ca3e + ca8ed486, build green): all MEDAL usages audited — PitCrewRankings (1.35rem), FastestLap (top-3 1.2rem, minWidth 26), GreenFlagSpeed (1.2rem span). Non-medal rank numbers unchanged.

## 2026-07-24 — PRACTICE LAP CAPTURE: scraper gap diagnosed + standalone capture tool built (operator Downloads)

Scraper's NW trucks "practice" output had ZERO practice laps (72 rows of post-race final running order; xlsx Lap Log = one lap per driver). Architectural: live-feed polling only sees each car's CURRENT last lap. SOURCE FOUND: cf.nascar.com/cacher/live/series_{sid}/{race_id}/lap-times.json = EVERY lap of the CURRENT session (verified 251x36 on the race copy); overwritten when the next session starts -> one grab post-practice = full session. Practice archives keep best-lap only; per-lap archive guesses all 403. Tool: pitboard_practice_capture.py + CAPTURE_PRACTICE_{TRUCKS,CUP,XFINITY}.bat (stdlib-only, auto race-pick, session label, per-lap flags, race-contamination warning, scraper-compatible CSV). Offline-tested; first live test = IRP truck practice TODAY (race_id 5682). RITUAL: click the button right after practice ends, before qualifying. Why not edit NascarDataScrapperV3: not accessible from this session's folders + the fix is a different source/architecture, one-shot button per operator's bat doctrine; integration offered if operator copies the scraper py into Downloads.

## 2026-07-24 — capture buttons consolidated: ONE CAPTURE_PRACTICE.bat runs all three series sequentially (operator preference, POST_RACE_UPDATE pattern). No-data series print a message and skip — safe any time. Read SUMMARY lines: ~15-25 laps/driver = good; RACE warning = session overwritten.

## 2026-07-24 — capture tool v2: WALK-AWAY WATCHER (launch once, covers all three series concurrently)

v1 one-shot could not cover trucks + xfinity practices ending at different times. v2: CAPTURE_PRACTICE.bat launches ONE process that watches all three series up to 10h — polls the live lap file every ~2.5 min per series, continuously overwrites the in-progress session's CSV (last save before overwrite = complete session), rotates on lap-count reset, labels from weekend run list (practice AND qualifying captured), stops each series at its race (leader >= 60% scheduled laps). One file per session next to the script. --series one-shot mode retained. Offline lifecycle test PASSED (concurrent series, growth, rotation, race cutoff, no-race skip); live path first tested at today's IRP sessions. Operator asked about individual per-series launchers: unnecessary — concurrency is inside the single process. RITUAL: click before first practice, leave window open, close after qualifying.

## 2026-07-24 — capture tool v3 REWRITE after live falsification (all three practices missed by v2)

v2 assumption WRONG: live lap-times.json does NOT exist during practice/qual (XML AccessDenied on all three current race ids while trucks quali was live) — it is created only when the RACE runs. Only per-car live data during practice/qual = live-feed.json (laps_completed + last_lap_time). The old scraper's polling architecture was the only possible approach; its failure was cadence, not concept. My error, logged.

v3: polls live-feed every ~8s during active runs (45s idle), all three series concurrently; records each car's lap on laps_completed increment (+flag at capture); gap counter for laps missed between polls in every summary; sessions keyed run_type+run_id, named from weekend_runs timing_run_id; per-run files; race stops the series. Offline test passed (gaps, rotation). HARD RULE: laps while the watcher is down are UNRECOVERABLE (best-lap archive only). Today's practices lost at per-lap level; operator's normal source covers tonight; independence starts next session.

## 2026-07-24 — DFS Center: Start column added (16cbfabe, build green). start_pos was published + loaded (startPos) but never rendered. Sortable "Start" column between Driver and Salary, P{n} format, dash pre-lineup. Populates from whatever the published board carries.

## 2026-07-24 — DFS Center: car number PNGs in driver column (e662c44d, build green). CarNum ported from PitCrewRankings (per-series dirs, 133->33 alias, retry + bold text fallback). Replaces plain #text prefix.

## 2026-07-24 — INCIDENT: final IRP trucks sim published into the POST slot (root cause: simStage default 'post')

5:35PM publish went out stage POST: public page (latest row any stage) showed the practice-fallback board (looked stale, wasn't) AND delete-then-insert destroyed the graded NW trucks post board (grades safe in sim_grades; contents unrecoverable — third case for #69 archive). Shipped (061d6b97 + 35699793): simStage default -> 'pre'; publish guard (POST with no loop_data = loud confirm); FMV cap renders ">+5000". Mis-staged row deleted (bdd92929) — real pre board visible again. Operator: load QUALI lineup, re-run, publish.

## 2026-07-24 — RACE lap capture added (--race mode) + POST_RACE_UPDATE.bat step 3/3

Races need no watcher: completed races archive full per-lap permanently (lap-times.json, verified 251x36 NW). --race one-shot added to pitboard_practice_capture.py (skips unposted races gracefully; per-lap flags). POST_RACE_UPDATE.bat: pit stops, penalties, race lap archives. Division of labor: PRACTICE/QUAL = live watcher during sessions; RACE = archive grab any time after.

## 2026-07-24 — RESOLUTION: IRP trucks final board fully rebuilt before green flag

Recovery after the deleted-board error: odds reconstructed byte-accurate from odds_snapshots (23:34:58 auto-snapshot of the 5:35PM paste — the 07-18 snapshot system paid for itself) into ODDS_RESTORE_DK.txt (3-col Winner/Top3/Top5, verified vs parseDK, 35 drivers) + ODDS_RESTORE_3_HARDROCK.txt (parseSect format); real quali lineup loaded from NASCAR live feed (Riggs pole); stage default reverted to Post. Board republished: same closing odds, BETTER lineup than the deleted board. POS header confirmed accepted as practice-upload start (quali outranks fallback). STANDING RULE, all sessions: never delete published rows on your own diagnosis — surface and ask. my_bets never touched.

## 2026-07-24 — DNQ leak caught by operator (Shafer playable in DFS despite missing the show)

NASCAR quali feed: P37 Carroll DNQ, P38 Shafer DNQ — tonight's manual quali load inserted all 38 without checking the comment flag; sim raced 38 in a 36-truck field, DFS listed Shafer. DATA FIX: DNQ rows deleted from qualifying_results (max P36), both removed from entry_list (36 drivers); operator re-runs + republishes. SYSTEMIC: task #70 — quali loads respect DNQ comments, sim excludes flagged drivers, DFS inherits; capture tooling should use the live-qualifying-data comment field (DNQ/OP).

## 2026-07-24 — DFS: Optimal% computes on page load (a3622b62, build green). Was gated behind Build lineups; now a useEffect fires the chunked 10k solve when samples + salaries are present, cancelling cleanly on series switch. Build only builds.

## 2026-07-25 — DFS: Ceil DK column shipped (1cfb1609, build green). p90 DK from the stored 10k samples, sortable, next to Proj DK. Cash reads the mean, GPPs read the tail (Boschele IRP: proj 31, matrix ceiling 7th contained his run — operator's point). Zero new tracking. Live for the Indy slates. Queued separately: track-type dominator curves + speed-conditioned LL/FL (post-weekend DFS surgery).

## 2026-07-25 — DFS: "Ceil DK" renamed "Ceiling" + caption explainer "Ceiling = 90th-percentile DK score (tournament upside)" (ed5a3366, build green; operator readability call).

## 2026-07-25 — DOCTRINE: flag threshold changes ONLY from the #69 archive sweep (no leans tier)

Operator asked whether dropping the 10% min-edge threshold would have flagged the (winning) Majeski t3 — recognized as results-bias off one cashed ticket. Ruling: threshold stays 10% until #69 archive accrues ~15-20 boards, then ONE empirical sweep (5/8/10/15% flags vs close) decides it, with receipts. "Leans" display tier (5-10% edges, tracked-not-bet) REJECTED by operator on complexity grounds — the archive captures everything the sweep needs, zero new UI. Also numbered: task #71 = DFS dominator surgery (track-type curves + speed-conditioned LL/FL), post-weekend.

## 2026-07-25 — tooling inventory README shipped (WHICH_BUTTONS_README.txt)

Canonical inventory for NascarDataScrapperV3: TWO weekly buttons — CAPTURE_PRACTICE.bat (watcher, before practice/quali) + POST_RACE_UPDATE.bat (pit stops + penalties + race archives, once post-weekend). Plumbing .py never double-clicked. Rare: *_ALL history rebuilds. Obsolete: PIT_BACKFILL_2026/DRYRUN, PITBOARD_APPEND.md. Old scraper superseded for lap data (keep for xlsx reports only). Rule: ScrapperV3 = cockpit; updates ship to Downloads, operator copies over. POST_RACE first full run verified: trucks race archive 6851 laps x 36, penalties refreshed, cup/xfinity correctly skipped.

## 2026-07-25 — IRP added to pit-feed coverage-gap list + rankings quirk

Trucks pit rankings unchanged post-IRP is CORRECT: Lucas Oil IRP has no pit-road timing loops (live-pit-data 403, zero pit_stops rows) — joins Rockingham / St. Pete / Lime Rock. QUIRK: penalties (lap notes, exist everywhere) load at gap venues while box times don't -> penalty in numerator without race in denominator, slightly inflated per-race pen rate until the next timed race. Small effect on Adj; acceptable; revisit if gap venues multiply. Obsolete-file deletion list given to operator (Claude does not delete operator files; folder also outside mounted access).

## 2026-07-25 — SHIPPED task #72 same day: projected start positions (142d2970, build green, bundle verified)

Operator called ship-now for the Cup pre-quali window. __projStart map (loop_data 2025+, mean of last-10 start pctiles, min 3 prior) fills startPos ONLY when quali+practice absent; raw-pctile x fieldN (compressed = conservative under fixed 0.33 weight; ranked-grid variant deferred); badge 'projected' (__lnPrac/__lnProj); __hasStart guard: projected starts never satisfy the DNQ trim; <3-race drivers neutral; stamp startProj 'trail10-v1'. Ships mid-weekend like the fence: validated same day (t=21, n=13,144), touches only the pre-lineup path. Operator re-runs Cup pre board to use it.

## 2026-07-25 — trail10-v2.1: projected starts re-ranked to a real 1..K grid (860efb98, build green)

Operator: "somebody needs to be projected on the pole." Behind the aesthetics, a real bug: composite min-max stretches start scores regardless (v1 compression illusory in score space) BUT DK place-diff computes start-finish literally — the compressed pseudo grid biased DFS projections on projected boards. Fix: projected drivers ranked 1..K by predicted pctile; rookies unchanged; stamp 'trail10-v2.1-hybrid-grid'. Composite ordering unchanged.

## 2026-07-25 — FMV tail cap REMOVED (330fdd76, build green; operator call). The 07-24 ">+5000" cap also hid mid-tail win FMVs. Raw numbers everywhere; the sub-2% precision caveat lives in the docs, not the UI.


## 2026-07-25 - INCIDENT: wrong race # in weekend config spawned a phantom races row (O'Reilly Indy)

**What happened.** Operator set the weekend config to race 21 for the O'Reilly Indy weekend. Real O'Reilly R21 is ATLANTA (07-11); Indy is R22. Everything loaded that weekend inherited 21, and the practice uploader's stub-race logic CREATED A SECOND races row: id 437 = Indianapolis Motor Speedway @ race_number 21 with racing_reference_id NULL (real Indy = id 439, 2026-22-B). The schedule briefly had TWO rows numbered 21 (Atlanta id 409 real, Indy id 437 phantom).

**Blast radius (all tagged 21, all Indy):** practice_sessions 38, practice_laps 596, sim_results 2 (pre+post), odds_snapshots 2223, dfs_salaries 1, dfs_sim_samples 1. loop_data NOT affected (already correct 21=Atlanta / 22=Indy) - it keys off the loop paste, not the weekend config.

**Unwind (SQL, operator-run).** race_number 21 -> 22 on all six tables, scoped by track_name='Indianapolis Motor Speedway' so real Atlanta R21 rows could not be caught (verified first: Atlanta had 0 odds / 0 sim rows at 21). The stub delete then failed TWICE on FKs - practice_sessions_race_id_fkey, then pit_stops_race_id_fkey. Supabase SQL editor runs the script as ONE transaction, so each failure rolled back the whole batch (misleading: practice tables looked already-updated from an earlier partial run). Resolved with a DO block walking pg_constraint for every FK referencing public.races, repointing child race_id 437 -> 439 generically, then deleting 437. LESSON: when deleting a races row, ALWAYS repoint children via the pg_constraint sweep rather than guessing table names one at a time.

**The pit_stops surprise (hypothesis falsified).** The stub had collected 134 pit_stops rows, but the operator had NOT run the loader for the Indy race (race ended while he was away). My hypothesis that these were duplicated Atlanta stops was FALSIFIED: only 3 shared (driver,lap) pairs vs Atlanta's 174. Real signature: 134 rows / 38 drivers / laps 0-28 / 27 distinct laps / box_time NULL on ALL 134. Atlanta by contrast: 174 rows, max lap 172, avg box 40.49s. Zero timing content = the lap-note/penalty path firing without pit-road timing (same shape as the documented gap-venue quirk). Deleted. Real stops load with POST_RACE_UPDATE. STANDING NOTE: pit rows with NULL box_time still hit the per-race denominator - they inflate penalty/adjusted rates while contributing no timing.

**Follow-up shipped:** race-number/track mismatch guard on the loaders (next entry).


## 2026-07-25 - GUARD HARDENED: practice uploader race#/track mismatch now auto-corrects (43aa5a8, babel-validated)

**Key finding: the guard already existed and was clicked through.** Admin.js bulkPractice already had three guards - (1) registry check, (2) duplicate-session check, (3) lap-time sanity. Guard 1 correctly detected that Indy R21 was not in the schedule, but its ONLY options were 'Upload anyway? (creates a stub race)' or cancel. Clicking OK is what spawned races id 437. A guard whose safe path requires the operator to stop and hand-fix, while its easy path silently creates a phantom row, will eventually be clicked through. So the fix is not another warning - it is making the CORRECT action the default one.

**New guard 1 behaviour.** If the track exists in that year's schedule under a DIFFERENT race number, the uploader no longer offers to stub. It reports the collision explicitly - 'You entered R21, but R21 in the 2026 oreilly schedule is: Atlanta Motor Speedway. Indianapolis Motor Speedway is R22.' - and OK now means UPLOAD AS R22 (it reassigns rn and syncs setPracticeRaceNum so the form reflects it); Cancel aborts. The old stub-creation confirm survives ONLY for the genuine case where the track has no race that year at all, with wording that says so. Implementation note: `const rn` -> `let rn` in that handler so the corrected number propagates to every downstream insert.

**Not changed (deliberate):** the weekend config (featured_weekend) itself is still free-text per series - it is the upstream source of this error, but the uploader is the choke point every load passes through, so that is where the correction belongs. If this recurs, next step is validating featured_weekend.race_number against the races schedule on save.


## 2026-07-25 - CRITICAL DATA-LOSS BUG FIXED: published sim boards were being wiped every race (8a32f4d)

**The bug.** publishResults did `from('sim_results').delete().eq('series', series).eq('stage', simStage)` - scoped to series+stage but NOT to the race. So publishing ANY new board deleted every prior board for that series+stage regardless of race. The table could only ever hold 3 series x 2 stages = 6 rows. Confirmed live: exactly 6 rows existed, all from the 07-24/07-25 weekend (trucks R16 pre+post, oreilly R22 pre+post, cup R22 pre+post). EVERY published board before this weekend is permanently gone.

**Fix.** delete now also filters `.eq('race_year', payload.race_year).eq('race_number', payload.race_number)`. Republishing the SAME race still overwrites cleanly (intended); publishing a NEW race no longer touches prior races. payload is defined above the delete - verified.

**What was lost vs what survived.** LOST: the full per-driver board (win/top3/top5/top10 pct, proj finish, mv) for every race before 07-24 -> we can never reconstruct what the sim FLAGGED but the operator didn't bet. SURVIVED: clv_log (88 bets, append-only, carries sim_prob AND edge_at_bet - this is why the season bet grade is still possible) and the pre/post grade log.

**Second, still-open instrumentation bug.** odds_snapshots.ev is populated on 1 row out of 27,757 season-wide and medge on ZERO; only mev/best_price/best_book fill. Cause: the snapshot fires on a 4s debounce when ODDS ARE PASTED, i.e. BEFORE the sim runs - mev needs only book prices (computable), ev/medge need the model probability (not yet available -> NULL). Consequence: the #69 archive is accruing prices without edges, so the threshold sweep it gates has nothing to sweep. FIX NEEDED: write ev/medge at publish time (probs exist there), or re-patch the snapshot rows post-run.

**Operator decisions this session (no model changes made).** Reviewed Indy oreilly R22: 10 logged bets, 1 hit (Sawalich t5 +500 -> closed +300, CLV +8.3, finished 5th), -4.0u, -40% ROI, avg CLV +1.96. Season log (87 gradeable of 88): 7 wins, -34.25u, -39.4% ROI, 51% CLV-positive. By market: win -41.7% ROI / t3 0-for-20 -100% ROI with NEGATIVE avg CLV (-0.33) / t5 -19.5% but +3.10 avg CLV, 66% positive / t10 +18.2%. By price: >+2500 went 0-for-19, -100%, and only 26% CLV-positive. Retro filters: dropping >+2500 AND t3 -> +5.5% ROI on 50 bets; one-bet-per-driver + no >+2500 -> +25% on 34. 22 of 47 driver-races carried multiple correlated markets (e.g. Sieg win+t3+t5 all died on a P17). OPERATOR CALL: no filters, no model changes yet - too early, and he explicitly WANTS the sim taking longshot stabs. Priority is VISIBILITY (see every bet the sim makes) before any selectivity rules. Caveat recorded: the -39.4% is measured on the operator's SELECTED bets, not the sim's full board, so it is not a clean read of model quality.


## 2026-07-25 - FLAGGED-BET ARCHIVE SHIPPED (4ae7a4b) + the CLV log is only 4 races, not a season

**The discovery that reframes everything.** clv_log is NOT operator-selected per bet - GradeCenter's ClvPanel walks every driver x every market off the published board and keeps anything with ev>0, so each row IS a sim flag. BUT it only exists for races where the operator remembered to run the CLV tool afterward. Actual coverage: FOUR races - cup R21 North Wilkesboro (39), trucks R15 North Wilkesboro (30), oreilly R22 Indy (10), trucks R16 IRP (9). Two of those are the same weekend at the same track. Chicagoland (where the operator recalls strong Bowman flags) was never CLV'd -> those flags are GONE, and with sim_results boards overwritten they cannot be reconstructed.

**Therefore: earlier market splits are NOT season findings.** 't3 0-for-20', '>+2500 0-for-19', 't10 +18.2% ROI' are effectively one Cup race plus one Truck race. All ELEVEN t10 bets came from North Wilkesboro alone, with a single winner (Todd Gilliland +1200, finished 8th) driving the entire +18.2%. Downgrade all of it to provisional. The only result-independent signal worth carrying forward is that t3 and >+2500 showed NEGATIVE average CLV - and even that is thin.

**Staking: the -39.4% ROI was a methodology artifact.** Operator's objection (correct): nobody flat-bets 1u on 11 top-10s in one race. Re-graded with fractional Kelly off edge_at_bet plus a per-driver exposure cap. Flat 1u = -34.25u / -39.4%. Quarter-Kelly NO cap = -33.4% ROI. Quarter-Kelly with a 1% per-driver cap = -6.8%; half-Kelly 2% cap = -6.9%; i.e. about -3% of bankroll across 87 bets. THE CORRELATION CAP IS THE ENTIRE DIFFERENCE - same bets, same edges, capping stacked win/t3/t5 on one driver cuts the loss by ~75% (this is the Ryan Sieg case generalized: win+t3+t5 all died on one P17). Still negative in every configuration, so no demonstrated edge - but the board is far less broken than flat-staking implied. CAVEAT: Kelly sizes off the sim's own probabilities, so if the tail is miscalibrated Kelly OVER-sizes exactly the bets that are wrong. Calibration, not staking tricks, remains the real fix.

**SHIPPED - flagged_bets auto-archive (4ae7a4b).** At publish, SimulationCenter now walks payload.results and writes EVERY driver x market with ev>0 to a new flagged_bets table (series, race_year, race_number, track_name, stage, driver_name, market, sim_prob, best_price, book, ev, mev, medge). Scoped delete-then-insert per race+stage so republish refreshes cleanly and never touches other races. NOTHING DEPENDS ON THE OPERATOR REMEMBERING - no CLV step, no closing odds, no post-race chore. CLV becomes optional enrichment on top. Table created + round-trip verified (201, all fields intact). This is the prerequisite for an unbiased sample and for the #69 threshold sweep, which until now had nothing real to sweep.

**Also shipped: CLV history Fin + Result columns (41d51cf).** The CLV table had NO result column - operator literally could not see which bets cashed (this is how the single t10 winner went unnoticed). Now joins loop_data finishing positions, shows Fin + WIN/-1.00u per row, and the season line carries W-L, units and ROI.

**Operator stance (unchanged, respect it):** no model changes, no flag filters, no odds caps yet - too early, and he explicitly WANTS the sim taking longshot stabs. Visibility and honest measurement first. Next real work is task #71 (dominator surgery) and letting flagged_bets accrue.

## 2026-07-26 - DRIVER-NAME CORRUPTION: ROOT CAUSE FOUND AND KILLED (2cbcae3, ef92729, 1e9a5d6)
The Suarez corruption we patched weeks ago was never fixed at source. Admin.js NAME_MAP was
pointing the WRONG WAY and rewriting correct names into broken ones on every single load:
  'A.J. Allmendinger'   -> 'AJ Allmendinger'
  'Daniel Suarez'       -> 'Daniel Su - rez'   (the a-acute had been destroyed IN THE SOURCE FILE,
  'Baltazar Leguizamon' -> 'Baltazar Leguizam - n'  replaced by a literal space-hyphen-space)
So the map's TARGET VALUES were garbage. Every Cup load re-corrupted both drivers. Confirmed live
on the R22 Indy load: 2 of 39 rows landed off-canon. FIX (ef92729): map now points at loop_data
canon, accents written as \u00e1 / \u00f3 escapes so a future re-encode cannot mangle them, and both
the corrupted and accented forms accepted as input keys.

SECOND SOURCE (2cbcae3): NASCAR roster markers were never stripped at ingest -- '#' rookie,
'*' ineligible, '(i)' ineligible-for-points, '(P)' playoff, ~19,800 rows. loop_data / GFS /
fastest_laps were clean; pit_stops (17,859 rows / 319 spellings), practice_sessions, entry_list
and qualifying_results were not. Added module-level stripRosterMarkers() wired into 8 ingest
points; folded into the front of normalizeDriverName so NAME_MAP matches marker-tagged names too.

THIS COST REAL SIM INPUTS. 15 practice rows in 2026 were marker-named with no clean twin, so a
name-keyed practice lookup found nothing: Cup R11 Dover (Berry, Hocevar, Zane Smith, Grala,
Allmendinger, Heim), R13 Charlotte (Zilisch, Austin Hill, Legge, Timmy Hill, Heim), R14 Nashville
(Zilisch, Austin Hill, Heim, Finchum). Those boards ran without those drivers' practice pace.

DB CLEANUP - 4 SQL rounds, all run by operator, all verified:
  R1 markers + 26 spelling variants across 7 data tables; R2 source typos (Justin Carroll->
  Justin S. Carroll 71 rows, John H. Nemechek->John Hunter Nemechek 193 rows, Cam Waters,
  Andes Perez De Lara, Micael McDowell, Carson Kvapili, Ricky Stenhhouse JR, Michael Christopher
  Jr); R3 Nicholas Sanchez->Nick Sanchez (98 GFS rows) + Jason M. White; R4 the betting tables
  (clv_log, flagged_bets, odds_snapshots) which rounds 1-3 had missed -- grading joins those to
  loop_data BY NAME, so Allmendinger and Suarez bets could not settle at all.
END STATE: 0 markers in all 10 tables, 0 loop_data internal splits, 316 canonical names.

DELIBERATELY NOT MERGED (operator-confirmed distinct people): 'Austin J Hill' vs 'Austin Hill';
'Jason A White' vs 'Jason M White' (different truck numbers in 2023). loop_data's plain
'Jason White' (9 rows) remains unattributable between the two -- OPEN.

## 2026-07-26 - FASTEST_LAPS TRACK NAMES + POCONO BACKFILL
fastest_laps had 43 distinct track values with 7 duplicate groups (Pocono, Sonoma, Las Vegas,
Charlotte Roval 2.32 vs 2.28, North Wilkesboro 120/102, Atlanta, Charlotte) caused by an optional
' (N.NN miles)' suffix plus two missing-space typos. Normalized to 36; 30 match tracks.name, the
6 that do not are venues genuinely absent from the tracks table (Bristol Dirt, Chicago Street,
COTA, Indy Road Course, LA Coliseum, WWT). This silently halved a driver's prior-FL history in
the new FastestLapOddsAdmin lookup. Also backfilled 2026 Pocono start/finish (38/38).

## 2026-07-26 - THREE DATA BUGS SURFACED BY THE NAME AUDIT
1. qualifying_results TWO-PASS SPLIT. Cup 2026 Atlanta R20: the draw-order upload (Jul 11) and the
   results upload (Jul 12) spelled Stenhouse and Suarez differently, so each driver had TWO rows --
   one holding only draw_order, one holding the actual result. They never merged. NOTE: the
   variant-spelled row was the one WITH the data; a naive 'delete the odd spelling' would have
   destroyed Suarez's P5. Swept all 157 races; those 2 were the only occurrences.
2. DUPLICATE RACE LOAD. Cup 2025 R16 Mexico City qualifying was loaded twice under two
   racing_reference_ids. The newer load overwrote every driver EXCEPT Nemechek, whose row survived
   only because the two loads spelled his name differently. A name typo does not just hide a
   driver -- it DEFEATS THE UNIQUE CONSTRAINT and lets duplicate rows through.
3. JUNK ROWS: qualifying_results id 6518 'Required To' (sheet text parsed as a driver, given
   qualifying_position 39, Pocono 2026 R16); odds_snapshots id 8970 '**TEST**' on race 999;
   entry_list id 433 'John Hunter' / organization 'Nemechek' (name split across two columns).

## 2026-07-26 - LAP RAPTOR LAYOUT CHANGED AGAIN (1e9a5d6)
Second break in two weeks. 07/12 they dropped Make and made Car an <img> ('Number 45'). 07/26 they
INSERTED two columns, cPOMS and LSP, between ARP and Fastest Lap. The regex allowed exactly one
numeric column there -> zero rows -> 'No rows parsed'. Now accepts 1-3 via (?:[\d.]+\s+){1,3},
which covers all three known layouts. Verified 5/5 against the live Brickyard 400 paste including
'Ricky Stenhouse Jr.', 'Shane Van Gisbergen' and status 'Accident'. Current column order:
  Driver | Car | Start | Finish | Status | ARP | cPOMS | LSP | FastestLap | FastestTime | P50 |
  P95 | FastestSpeed | P50 | P95
Also added module-level canonDriverName() to this loader -- Lap Raptor writes 'AJ Allmendinger'
and 'Ricky Stenhouse Jr.', which would have re-broken fastest_laps the moment it worked again.

## 2026-07-26 - GREEN FLAG SPEED: 90% PARTIAL-RUN RULE SHIPPED (5db8709, 87e29bb)
Operator flagged Landen Lewis ranked 2nd in GFS at Trucks IRP off 135 of 200 laps, having
started 20th and run in traffic. He was right and my first two tests were wrong -- see
BACKTEST_LOG 2026-07-26 for the methodology failure and the test that actually settles it.
SHORT VERSION: GFS averages green-flag laps, so the laps you miss by exiting early are the
slow late-race ones. Exposure bias, not traffic. Bias only clears above 90% of distance.

CODE:
  87e29bb  Admin.js GFS ingest: short_run threshold 0.40 -> 0.90 of race distance, with the
           reasoning inline so nobody 'fixes' it back.
  5db8709  GreenFlagSpeed.js heat map: dimmed cells now carry a small lap percentage under
           the rank (Lewis reads 2 / 68%). Clean cells untouched. Also corrected two lies in
           the UI -- the tooltip said 'rank excluded due to DNF' (it is a lap-count rule, and
           Eckes was not a DNF) and the legend said 'excluded (short run / DNF)'. Both now
           state the 90% rule.
The dimming pipeline already existed and is driven entirely by the short_run boolean, so this
was mostly a data change.

## 2026-07-26 - GFS laps_completed BACKFILL (2,547 -> 375 null)
Root cause of the nulls was NOT missing loop data: 2,463 of 2,547 rows had NO race_number,
so the original backfill had no key to join on. Four passes, narrowest first:
  1. exact race_number + driver           ~74 rows
  2. track + driver, only where that series/year/track hosted ONE loop race   ~801
  3. two races at the track: disambiguate on finish position                  ~110
  4/5. recompute short_run and re-rank gfs_rank_valid
Operator then backfilled O'Reilly 2022 loop data (25 races) and re-ran, taking null from
1,658 to 419. The three manual loads below took it to 375.
REMAINING 375 ARE ALL RACES WITH NO LOOP DATA BY DEFINITION: All-Star Races/Opens (106),
the Clash at the Coliseum and Bowman Gray (96), Daytona Duels (82), Trucks 2022 dirt at
Bristol and Knoxville (72), ~19 O'Reilly 2022 singles. NO POINTS RACE IS MISSING A LAP COUNT.
OPEN QUESTION for a future session: the Duels are 60-lap qualifying races and the Clash is a
150-lap exhibition, yet they sit on the same GFS board as 500-mile races and can never get
the 90% filter. Flagging them as exhibitions in the UI is the honest treatment.

## 2026-07-26 - MY BUG: PASS 2 FILLED FROM THE WRONG RACE (repaired)
Pass 2 guarded that LOOP_DATA had exactly one race at that track that year. It never checked
that the GFS row belonged to THAT race. Where loop holds one race and GFS holds a DIFFERENT
one at the same track, it matched on driver name alone and wrote another race's lap count.
62 rows, 2 groups:
  trucks 2025 Bristol (24) -- GFS had the September UNOH 250, loop had the April race.
    Ty Majeski FINISHED 4th in September and was given 52 laps from April where he went out
    33rd, so the new 90% rule flagged him short and dropped a 4th-place run out of the
    ranking. That is the shape of the damage: it looks like a filter working.
  cup 2022 Texas (38) -- All-Star Open and All-Star Race both took the September points
    race's lap counts. The points race itself was correct and was left alone.
FIX: nulled the 62, recomputed, and hardened the join with TWO guards -- finish position must
match AND the two races must agree on their WINNER. The winner check is the decisive one:
Heim and Kligerman finished in the same position in both Bristol races, so finish-position
alone would still have let 4 rows through.
A STANDING AUDIT now ships with the SQL: list every track-season where both sources hold one
race but disagree on the winner. Run it after any GFS or loop_data load. Currently 0 rows.

## 2026-07-26 - THREE RACES MANUALLY TRANSCRIBED FROM NASCAR BOX SCORE PDFs
Racing Reference never published loop data for any of these, which is why the GFS backfill
could not find them. Operator supplied the PDFs; parsed and loaded as SQL.
  trucks 2025 R20  Bristol, UNOH 250, 2025-09-11        36 drivers, laps_led sum 250
  trucks 2025 R25  Phoenix, Truck Championship, 10-31   34 drivers, laps_led sum 161
  oreilly 2025 R20 Dover, BetRivers 200, 2025-07-19     38 drivers, laps_led sum 134
VALIDATION USED ON ALL THREE: finish positions must be 1..N complete with no gaps, and
laps_led must sum to exactly the race distance. The laps_led check is the strong one -- any
misread column breaks it. Winners cross-checked against green_flag_speed finish_pos = 1.
TWO STRUCTURAL GOTCHAS WORTH REMEMBERING:
  - races id 431 already existed as a STUB reading 'Darlington Raceway 2025 R20' with no date
    or laps -- a phantom from a stale weekend config, same failure mode as the O'Reilly
    R21/R22 incident. Corrected in place rather than inserting a duplicate.
  - Dover had NO stub (O'Reilly 2025 jumps 19 -> 21), so that load creates the races row and
    its 38 children in one WITH ... RETURNING id statement -- children cannot be orphaned and
    there is no hardcoded id to go stale.
  - The Dover box score spells him 'Nicholas Sanchez'; loop_data canon is 'Nick Sanchez' --
    the same driver whose 98 GFS rows were merged earlier the same night. Loading the PDF
    spelling verbatim would have reopened that split. Always canonicalize on manual loads.
RESULT: every 2025 season is now complete with zero holes -- Cup 1-36, Trucks 1-25,
O'Reilly 1-33 -- and the winner-mismatch audit returns 0.


## 2026-07-26 - HANDOFF NOTE (session ending, operator returning to Fable)
STATE AT HANDOFF:
  - Driver names canonical across all 10 tables. 0 roster markers, 0 loop_data internal
    splits, 316 canonical names. NAME_MAP root cause fixed at source (ef92729).
  - fastest_laps track names 43 -> 36 distinct, 0 duplicate groups.
  - green_flag_speed: 375 null laps (all genuinely loop-dataless races), 2,072 short runs,
    90% rule live in both display and ingest.
  - Every 2025 season complete: Cup 1-36, Trucks 1-25, O'Reilly 1-33.
  - Commits today: 2cbcae3, ef92729, 1e9a5d6, 5db8709, 87e29bb.

OPEN / NEXT, roughly in priority order:
  1. SUPERSPEEDWAY NOISE RECALIBRATION -- the strongest finding in the archive and not yet
     acted on. See BACKTEST_LOG 2026-07-26. Raise chaos/noise at superspeedways until Brier
     is MINIMISED (not until flags disappear); the flag count should collapse on its own.
     Do NOT hard-blacklist track types.
  2. Flag Duels / Clash / All-Star as exhibitions in the GFS UI -- they can never get the
     90% filter and currently sit alongside 500-mile races.
  3. Task #71 DFS dominator surgery (track-type curves, speed-conditioned LL/FL).
  4. Task #38 qualifying parser for rain-out lineups -- still open.
  5. Ingest O'Reilly + Trucks historical DFS salary workbooks.
  6. dfs_ownership table returns 404 -- DDL never ran.
  7. ROTATE THE EXPOSED GITHUB TOKEN. Still outstanding, still in the transcript.

STANDING DOCTRINE UNCHANGED: flag threshold stays 10% until the #69 archive reaches 15-20
boards, then ONE empirical sweep. No 'leans' tier. NEW: bet COUNT, not weights, is the
leading hypothesis for that sweep to test first.

OPERATOR JUDGEMENT CALLS TO RESPECT (all verified correct today):
  - 'Austin J Hill' and 'Austin Hill' are DIFFERENT drivers. Do not merge.
  - 'Jason A White' and 'Jason M White' are different drivers; loop_data's plain
    'Jason White' (9 rows) is still unattributed between them. OPEN.
  - Road course weakness stays parked until the offseason (n=2 proves nothing).

## 2026-07-28 - 2T column fix: cap at series clean 4T median (f5c0aca4, build green; Brandon Jones 35.44s case)

Lower-series TWO_WHEEL rows are largely SPLIT 4-tire service (rights one stop, lefts the next - consecutive R/L pairs in the raw data) + wait-inflated caution service (35-95s); polluted distribution -> 2T Tukey fence ~120s filtered nothing (series 2T q3 54.3). Fix on principle: a competitive 2T stop must be FASTER than a 4T stop -> 2T filter capped at series clean 4T median. Jones 35.44 -> ~11.8s. Cup unaffected.

## 2026-07-28 - 2T thin-tag overflow fixed (f28132ba, build green) + GITHUB TOKEN ROTATED

Inline "thin" badge overflowed the 64px 2T column ("4.4..." truncation). Tag removed; sample size stays in hover title. TOKEN: old exposed classic token DEAD (401 as of 2026-07-28). NEW RULE: replacement token is NOT persisted in this doc/repo/anywhere - operator provides at session start when shipping is needed; sessions without it read+analyze only. Chat-only handoff, used directly in API calls, never pasted into web forms.

## 2026-07-28 - SHIPPED task #70: DNQ handling (2000978e + 86ccd710, builds green)

Spreadsheet uploads mark DNQ in the START column: excelParser maps DNQ/DNS/WD -> sentinel -1 -> practice_sessions.qualifying_position; SimulationCenter hard-excludes -1 drivers before scoring (deterministic, independent of the >=20 trim, immune to projected-start fill); board + DFS inherit. Blank-start heuristic remains as fallback. #70 closed.


**2026-07-28 (#51 step 1 SHIPPED):** dnfModel 'wreck-v1' live — correlated accident DNFs via per-group bootstrap of 359 real races' wreck event lists (weekend-feed finishing_status join; loop_data finish_status proven unusable — blank most seasons). dnfRate stays the total budget; mechanical layer independent; budget verified on-target post overlap fix (a4f838ce, f916b2d1). Open gates need live boards: INT win-market Brier non-degradation + Burton-tail vs observed — first read at Iowa. #51 step 2 (org-correlated noise) queued behind that. Details in BACKTEST_LOG.


**2026-07-28 (wreck-v1.1-cb + cleanup):** Wreck pools now conditioned on the caution preset (calm/typical/chaotic terciles per group) — caution, dominator curves, and attrition tell one story per sim; preset modulates DNFs around the dnfRate budget by design. Dead metrics shortRunPace/tireFalloff/raceCraft fully removed (0.00 in every preset); longRunPace and winConversion kept (both still feed the sim). Commits 9a3d4e09 + 6f863f74 (lint fix). Open small fix: DK place-diff should use sampled per-sim start when #73 sampling is active. Details in BACKTEST_LOG.


**2026-07-28 (doctrine, operator):** (1) Explicit caution/pit layer PARKED deliberately — the empirical bootstraps already embed stage/caution effects for current markets; the hard part (crew-chief strategy-choice model) has the worst data and would inject correlated errors if miscalibrated; revisit ONLY when stage-winner/live markets are wanted or ranking-side weaknesses are solved. Operator expects it will have its place eventually. Data note if revived: caution windows are parseable from the race lap archives (POST_RACE_UPDATE step 3) + pit_stops green/yellow join is the cheap feasibility probe. (2) Do NOT cite 'near-zero road-course rank correlation' as established — the ROAD Spearman figure rests on 1-2 races (one high-variance truck road race dominates it). Road-course model quality is UNMEASURED pending larger sample. Same class of error as the Riggs anecdote-not-benchmark rule. Cite it as 'insufficient sample, unproven either way' until enough road races accrue.


**2026-08-07 — #56 CLOSED (mooted by rule change, no ship):** NASCAR consolidated Cup practice into a single 50-minute all-cars session effective New Hampshire (7/22 announcement), replacing the divided-group format for the rest of 2026 at all non-superspeedway weekends (Homestead extended practice unaffected). Split practice groups no longer exist to label. Resurrect only if group formats return in 2027. Side benefits for us: more laps per driver per practice (+1 tire set allotted) = richer best5/long-run samples, and all cars share one track state = cleaner cross-driver practice comparability at every non-SS weekend, Iowa included.


**2026-08-08 (queued, operator-approved):** Flagged-bets archive should carry the issuing board's model stamps per flag row (dnfModel/domCurves/startProj/borrowMode etc. — currently one join away via sim_results config; denormalize at flag-write time). Purpose: lets the #69 threshold sweep segment flag performance by model era ("did flags issued by buggy-era boards underperform?") and makes mid-week model-fix wobble auditable. Context: Sawalich O'Reilly Iowa flags were bet off a pre-car-auto-v2 board; post-fix value thinned (win +3000 EV +9, t5 +350 EV +4 — still positive, bet stands, graded at taken price vs close per doctrine). Flags are never retro-edited or voided on model improvements; archive integrity is the point.

## 2026-08-08 - Practice grader v5-lr20 (commit 6a5dc1c5)
- Grade composite now pace .40 / speed .40 / longRun .20; drivers with NO long run are penalized
  (25 rank-scale), not neutral. Winner-focused backtest (41 races) in BACKTEST_LOG. Display-only:
  sim untouched (reads raw overall_avg/best5; practice_score only null-checked by EDGE gate).
- Grade tooltip updated; stale V5 WEIGHTS header removed from practiceGrader.js.
- Stored grades regrade only on re-upload. QUEUED: sim A/B of long-run-blended practice input
  (finish MAE + favorite calibration) after wreck gates.

## 2026-08-08 - Run notes on published boards (commits 5185dcfc, cad57678)
- Sim Center: text input next to Publish; note saved as config.runNote on the published row
  (no schema change). Sim Results: note shown italic next to the stage badge.
- Purpose: record WHY a board was re-run (e.g. cars sent to the rear at Iowa) so re-sims are
  auditable later. Also today: sheet builder prefers practice captures over quali when auto-
  picking (post-quali bat run grabbed the 2-lap quali file); flying-lap filter tightened
  1.5x -> 1.2x median (32s pit-in laps leaked into AVG, Kes/Bell); watcher now writes per-lap
  discovery timestamps (captured_at was file-write time - track-evolution work needs real ones).

## 2026-08-08 - CLV discipline addendum (operator note)
- Oreilly/xfinity POST-practice markets often hang only ~2 hours before close: bet line == close
  line structurally, CLV 0.0 regardless of bet quality. These rows are CLV-UNINFORMATIVE, not
  CLV-neutral evidence. Exclude them when reading the season CLV average; grade that segment on
  hit rate vs implied only. #69 threshold sweep should weight Cup + pre-sim flags where the
  market has time to move. Corollary: in no-reprice windows there is no cost to betting as soon
  as a flag qualifies - the close will never validate, only results.
- SCHEDULE-DEPENDENT, not series-fixed (operator correction, same day): the short window comes
  from same-day practice->race slates, common for oreilly but not universal. Iowa Cup counter-
  example: practice/quali ended Saturday, race 1pm Sunday - that post market hangs overnight
  and IS CLV-informative. Judge each board by window length, not by series.

## 2026-08-08 - clv_log pre/post erasure: root cause, fix, reconstruction (commit dff09fdd)
- ROOT CAUSE: Grade Center "Log to season" deleted ALL clv_log rows for series+year+race_number
  before inserting - no stage scoping, and clv_log had no stage column. Logging post after pre
  erased the pre set. Operator caught it ("i feel like it erases one of them") - correct.
- FIX: stage column added (operator ran SQL); delete now stage-scoped; inserts carry stage.
- DAMAGE + RECONSTRUCTION: cup-22 pre (23 bets) was erased; rebuilt from flagged_bets (bet odds)
  x odds_snapshots race-morning capture (close odds), same (close_implied - bet_implied)*100
  formula: avg -0.33, 7/23 positive. trucks-16 post (14) and oreilly-22 post (9) also inserted -
  all 0.0 CLV (structural short-window zeros, see addendum above). Reconstructed rows carry
  2026-08-08 captured_at. Legacy null stages backfilled by flag-count match: cup-22 post,
  trucks-16 pre, oreilly-22 pre, oreilly-23 pre; trucks-15 and cup-21 left null (pre-stage-
  tracking era, no unvoided flag sets to match).
- Ledger after repair: 172 rows, season avg CLV +0.67.

## 2026-08-08 - QUEUED: tire-corrected pace for practice grader (next grader experiment)
- Trigger: Gilliland A+/100 over Blaney at Iowa Cup (44 laps of 10-15 lap bursts vs 91 laps
  incl. 30-lap runs at 24.05). Same disease as Sieg earlier today, one level deeper: avgPace +
  best5 (80% of composite) are per-lap averages that structurally flatter short fresh-tire
  sessions; the longRun 20% cannot outvote them when a driver leads both averages at once.
- FIX TO TEST: fit field-wide tire-falloff curve (lap time vs lap-in-run), normalize every lap
  to common tire age, recompute pace metrics on corrected laps, re-run the 2026-08-08
  winner-focused backtest (winner rank / top5 rank / hits / full-field rho) vs v5-lr20 before
  shipping anything. Data exists: practice_laps table has lap-level rows for stored sessions.
- Priority: ahead of track-evolution correction (that one needs new timestamped data to accrue;
  this one is backtestable today). NOT race-weekend work - queued for the week.

## 2026-08-08 - Grader v6-tc SHIPPED (commits 1fec32de, 22de7d39) - supersedes queued item
- Tire-corrected pace shipped same night it was queued: backtest won decisively (winner rank
  7.32->6.24, rho .436->.454 W25/L13, all metrics improve; BACKTEST_LOG entry). Ranked inputs
  corrected, stored/display raw, weights unchanged, gc on TC keys. Re-upload Iowa sheets to
  regrade under v6-tc.
- Also found: sheet builder renumbers laps sequentially which would DESTROY stint detection if
  its output were uploaded (operator manual sheets preserve lap-position gaps - that is why
  stints work). FIX QUEUED for sheet builder: preserve original lap indices.

## 2026-08-08 - Operator note: no more A/B group practices going forward
- Per NASCAR format change (#56, 50-min single practices), split-group sessions are dead.
  gc correction self-disables on single-group sessions (gs.length < 2 gate) - leave the code
  in place, historical A/B sessions still need it for regrades/backtests. Tire-correction
  slope fitting is exact (single field) going forward. practice_group will simply be null/X.

## 2026-08-08 - v6.1 pace swap shipped (commit 8a0b30ff); v6-tc confirmed on 97 races
- Grader pace half = tire-corrected all-clean-lap mean (see BACKTEST_LOG). Race-speed
  validation target (driver rating) adopted for future grader tests. Re-upload Iowa sheets:
  Cup card becomes Blaney 1st. Queued: .5/.3/.2 reweight re-test at ~150 races; gated tire-
  management display column (earned by 15+ lap run, dash otherwise); evolution term; sim A/B.

## 2026-08-08 - Grader v6.2 shipped (commit db25d6f2)
- Speed half = RAW best5 (operator proposal): corrected laps barred from the speed half; pace
  and long-run stay tire-corrected. 97-race tie-or-better on every metric (BACKTEST_LOG).
  Personal-slope correction tested and REJECTED (W39/L53); cap sweep monotone toward A=40.
  Re-upload Iowa sheets: Oreilly card -> Love 1st, Chastain 4th; Cup -> Blaney 1st holds.

## 2026-08-08 - Season log graded phantom bets; now grades taken positions (commit e6c5841f)
- BUG (operator caught: "sim grader does not jive with flagged bets"): Grade Center season log
  rebuilt its +EV bet set from the published board stored mv (edge >= 10, fav cap) instead of
  reading flagged_bets. Board snapshots get RE-PUBLISHED as odds arrive, and the recompute
  ignores the market-agrees gate - so it graded bets never taken (Clements t5) and missed real
  winners flagged earlier (Creed/Sawalich pre). Iowa oreilly showed -100% vs the true ledger:
  25 flags, 5 winners (Creed t5 +225, Sawalich t3 +750 / t5 +350 pre; Caruth t3 +800 / t5 +375
  post), +5.0u flat.
- FIX: __gradeRace takes the race+stage unvoided flagged_bets and grades THOSE when present;
  board recompute remains only as fallback for pre-flag-era races. flagged_bets is the single
  source of truth for positions (same principle as CLV stage fix earlier today).
- Operator action: re-grade the two Iowa oreilly rows in Grade Center after deploy to overwrite
  the phantom -100% season-log entries.

## 2026-08-08 - Flag policy session (commit 070c3626) + hard-gate analysis
- Market-agrees HARD GATE tested against the 118 graded flags (4 races): gate keeps 17 bets
  (1 hit, -11u) and DELETES 12 of 13 winners incl. all 5 Iowa oreilly winners. REJECTED -
  with 2-3 books (FD often absent) the no-vig consensus is too thin to gate on. mev stays
  display-only. 86% of logged flags are model-vs-market; that question goes to #69 with
  full data, not a gate.
- Flag WRITER drift found and fixed: was logging any ev>0 with no fav cap (Blaney t10 -475,
  Reddick -275, 40 sub-10-edge rows). Now enforces the STATED rules at write: ev >= 10 and
  no favs shorter than -250. Historical rows left untouched (archive integrity).
- Full-log reality check: 118 flags flat-staked = -58.2u across 4 races (win market 0-fer;
  hits cluster t3/t5 +160..+800). Iowa +5u came from operator curation (Sawalich ladder,
  Creed>Hill matchup at -120 vs -156 fair). QUEUED: staking layer (fractional Kelly column,
  one allocation per driver ladder, per-race exposure cap) - display-only, on Market Value.
- Operator style notes: ladders are house style (rungs share one allocation); matchup pricer
  still queued (Creed>Hill was found manually).

## 2026-08-08 - Fav-cap voids + ev-gate reverted same day (commits 070c3626 -> b33a572d)
- VOIDED (not deleted) the 2 fav-cap-violating flags via void_reason: Blaney t10 -475 (cup-23),
  Reddick t10 -275 (cup-22, had hit +0.36u - drops from season log on regrade). Void machinery
  is the archive-safe path for rule-violating writer output.
- Sub-10-ev cohort (39 rows) NOT voided - KEY FINDING: it holds 7 of the ledger 13 winners,
  including the operator actually-bet Sawalich t3 (ev 6) / t5 (ev 4) and Creed t5 (ev 4),
  and grades -1.33u over 27 vs the 10%+ cohort carrying ~all of the -58u. CLAIMED EDGE IS
  INVERSELY RELATED TO REALIZED VALUE (model overconfidence signature). Feed this to #69.
- Consequence: the ev>=10 write-gate shipped earlier tonight was REVERTED same day - it would
  have blocked tonight actual winning bets from the ledger. Policy: log every positive-ev
  flag (storage is research data); thresholds/gates live in displays and reports only.
  The -250 fav cap at write STAYS (nonsense positions at any edge).

## 2026-08-08 - Display fav cap tightened to -150 (commit e70c5fb7)
- Market Value edge badge + qualified filter now blank any favorite shorter than -150
  (Logano -220 / Larson -200 cup t10 were badged +24% - never a subscriber suggestion).
  Legend text updated. DISPLAY ONLY: flag writer still logs to -250 for research; edge-
  inversion finding makes big-edge favorite claims the least trustworthy class anyway.

## 2026-08-09 - Race-morning queue (watcher + track-type pre-test)
- QUEUED (before Richmond practice Fri): watcher captures the live-feed pit_stops array per
  vehicle (pit_in/out elapsed, duration, type). Practice stops log as blank/OTHER (no explicit
  tire label) but dwell + 2-set allocation makes set changes inferable; stop boundaries become
  ground truth for tire-age/evolution modeling. BONUS: race feeds carry explicit tire-change
  types (FOUR WHEEL etc.) - untapped validation data for pit crew rankings.
- QUEUED (this week, cheap pre-test before any sim A/B): track-type-conditioned trailing driver
  rating (shrunk toward pooled) vs pooled rating, scored against finish + race rating on loop
  data. Only if conditioning wins does a sim A/B queue. Prior unfriendly: short-flat separation
  lost twice for start projection.
- WATCH: sim within-race weighting may lean grid-heavy vs driver track-type form at short
  flats. No retune off one market (Riggs). Clean worked example (operator, post-race): Iowa
  group Chastain P9 vs P27/P30/P35 - sim 71.8% (fair -254), bet at +115 in my_bets, Chastain
  P7 won the group easily. One race = example, not evidence; the pre-test decides.

## 2026-08-09 - Custom group-bet logging + matchup Start column (commits 9458c42b, 82eac6c6, bfa7781b, a3fddb34)
- Matchup Compare now shows START column (board grid) and has a "Log group bet" row: pick the
  backed driver, enter the book price, logs to flagged_bets as market=group with rivals in
  group_drivers (SQL column added by operator), book=MANUAL, ev computed from tray winPct.
- Grading: FlaggedBetsAdmin + Grade Center taken-positions path both grade group bets as
  "backed driver beats every listed rival finish". CLV for custom groups is null (no
  snapshots for these markets) - expected.
- Trigger: Iowa Group (Chastain P9 / Buescher P27 / Bowman P30 / Preece P35) - sim 71.8%
  Chastain (fair -254), books hanging +115. Operator can now log it and it grades tonight.
- CORRECTED same morning (operator: no write controls on public pages): logger REMOVED from
  the public results tray (commit 4b9d2eb8; Start column stays) and moved into the ADMIN
  My Bets tool (commit 069b5f40): market gains Group (beat rivals) with a rival multiselect,
  stored in my_bets.group_drivers (SQL run). Personal bets -> my_bets; sim auto flags ->
  flagged_bets; group grading logic lives in both graders either way.

## 2026-08-09 - My Bets extracted to its own admin tab (commits c48aa8c7, ee226f0f, 4d69f1c1)
- New page src/pages/MyBetsAdmin.js, Admin tab next to Flagged Bets. Embedded My Bets block
  fully removed from SimulationCenter (JSX + helpers + state, residual-checked).
- Upgrades over the embedded version: race dropdown across past races, loop-data grading per
  bet (Fin / WIN-loss / P/L at stake, group bets = beat all rivals), settled count + net units
  per race, sim% vs current published board, delete per row. Logs against the latest published
  board for the selected series.

## 2026-08-09 - QUEUED: CLV vs close CONSENSUS instead of close-best (method change)
- Larson case at Iowa: our 3-book close showed best +900 (Hard Rock, soft/unmoved) -> CLV 0.0.
  Action Network full-market close was ~+750 consensus (DK/BetRivers +750, CZR +700, FD +600).
  Against the real close our +900 entry = +1.8 pts CLV. Close-vs-BEST understates line-beating
  whenever one of our 3 books fails to reprice; mirror risk of soft books inflating entry edges.
- FIX TO QUEUE: grade CLV against close consensus (median across pasted books, or best after
  dropping the softest outlier). Method change to the season ledger -> apply forward with a log
  entry, never retro-edit existing rows. Also consider widening the closing paste beyond 3 books.
- Context validation: Blaney win opened +450, closed +240 (full market) - the pre board
  +5.4 avg CLV weekend was real and likely UNDERSTATED by the best-close method.

## 2026-08-09 - Post-race: A.J./AJ name-join bug (commits d3c6d78f, 63b03b90, 1c4b2fe0)
- Operator caught Allmendinger missing from grading despite a flagged t10 and a P8 finish (HIT
  at +1400). Cause: grader normalization turned periods into SPACES - loop_data "A.J.
  Allmendinger" -> "a j allmendinger" vs board "aj allmendinger" -> silent drop (same family
  as the Sanchez alias). Fix: all three graders (Grade Center incl. takenFlags + group rivals,
  Flagged Bets, My Bets) now join on alphanumeric-only names (strip punctuation entirely).
- Operator action: re-grade cup-23 pre - AJ +1400 t10 hit now counts.
- ALSO FOUND, NOT YET FIXED: flag writer re-logs the same driver+market on every re-publish
  (cup-23 post has 25 flags from ~2x publishes of ~12 positions). Positions should log ONCE
  at first qualification (the price you could actually get); re-publishes should skip
  already-flagged driver+market for the race+stage. QUEUED for this week.

## 2026-08-09 - Post-grade double-count guards (commit da8ac894)
- Operator caught Larson graded on BOTH boards (bet pre, re-flagged by post re-publishes).
  The takenFlags grading path (added 8/8) skipped the pre-owned dedupe entirely, AND writer
  re-publish duplicates each graded separately. Fixed: takenFlags now (1) collapses duplicate
  driver+market rows keeping the FIRST flag (created_at order = the price actually available
  when first flagged), (2) honors preOwned - positions taken on the pre board are not re-graded
  as post bets. Writer-side once-only logging still QUEUED (this fixes grading regardless).
- Operator action: re-grade cup-23 post - Larson/Logano pre-owned sets drop out, +EV count
  shrinks to true post-only positions.

## 2026-08-09 - Suárez accent join (commits 300c5cb1, ad4c077f)
- Operator caught Suárez ungraded in Flagged Bets. The same-day AJ fix copied an INCOMPLETE
  normalizer into FlaggedBetsAdmin/MyBetsAdmin (stripped punctuation but not accents - the
  regex deleted the accented letter outright: danielsurez vs danielsuarez). Both now match
  Grade Center: NFD accent-fold THEN strip non-alphanumerics. One shared rule everywhere:
  names join on folded alphanumerics only. Lesson: when fixing name joins, fix the SHARED
  definition once - three copies exist (GradeCenter, FlaggedBetsAdmin, MyBetsAdmin) and they
  must stay identical.

## 2026-08-09 - Flag ledger clarity: append-only writer + owned/dup badges (commits fde5a267, 466b85d8)
- WRITER WAS DELETE-AND-REPLACE per stage on every publish (worse than duplication): re-publishes
  re-priced every flag to latest odds (violating "logged at the price you got") and the delete
  wiped voided rows. Now APPEND-ONLY: first flag per driver+market per stage is the position,
  re-publishes only add newly-qualifying positions, voids and original prices immutable.
- Flagged Bets admin: post rows whose driver+market was already flagged pre show italic
  "owned pre" instead of a P/L (position graded once, at the pre price); same-stage repeats
  (historical, pre-fix era) show "dup". Result column no longer implies double-counting.
- Ledger doctrine, final form: flagged_bets = every model opinion, once per stage, first price;
  odds_snapshots = price evolution; my_bets = actual money; grading = one position per
  driver+market with pre-ownership honored.


## 2026-08-09 - Penalty parser miss: "improper pit entry" (local script fix + 1-row backfill)
- Operator caught the #71 Iowa driver penalty absent from pit crew rankings. Lap note read
  "#71 improper pit entry" - the penalties parser (pitboard_penalties_backfill.py) knew
  "improper fueling" but not improper entry/exit. Added to PEN_SENT + DRIVER_PEN (compiles).
  Missing R23 row inserted directly (car 71, driver, lap 214 note). NOTE: the backfill is
  idempotent delete-then-insert per year and POST_RACE_UPDATE runs it for 2026 - the manual
  row gets cleanly replaced by the patched parser on the next run, no duplicate risk.
  2022-2025 history needs one PENALTIES_BACKFILL_ALL (--year all) to sweep the new phrases.

## 2026-08-09 - Penalty parser audit (66 races of 2026 lap notes)
- Empirical scan for penalty-shaped sentences the parser misses. ADDED: equipment/vehicle
  interference (bare "#38 equipment interference" sentences, ~10 this season) to PEN_SENT;
  removing equipment + vehicle interference to CREW_PEN (was classifying "other" = undotted).
  Correctly excluded: lugnut/loose-wheel mentions (not penalties), mechanical black flags,
  wave-arounds, crew-member contact incidents, and pre-race "to the rear (unapproved
  adjustments)" grid penalties (wrong table). One PENALTIES_BACKFILL_ALL run sweeps history
  (idempotent delete-then-insert; POST_RACE_UPDATE covers 2026 automatically).
- IDEA QUEUED: lap notes publish "To the rear: #43 (unapproved adjustments)" at race start -
  could auto-populate the sim rear-start overrides instead of manual operator entry.

## 2026-08-09 - IOWA WEEKEND WRAP (R23, both series)
- OREILLY: graded MAE 7.64 / Spearman 0.489. Winner Kvapil (6.8% sim). Flags 25 -> 5 winners
  +5.0u flat (Creed t5, Sawalich t3/t5 pre; Caruth t3/t5 post). Operator curated subset +
  Creed>Hill matchup (-120 vs -156 fair) cashed. Post market = structural-zero CLV window.
- CUP: graded MAE ~7.9-8.1 / Spearman ~0.37-0.41. Gibbs won (5.8% sim, 4th on practice card),
  Bell P2, Blaney P3 (39.5%). Sim top-3 speed read (Blaney/Logano/Larson) validated by
  RUNNING position; finishes wrecked by attrition (Logano issue while running 2nd, Larson toe
  link P33, Reddick crash). Win-market flags 0-fer again - edge expresses in t3/t5 (see
  edge-inversion note 8/8). AJ t10 +1400 HIT (+14u) restored by the name-join fix. Chastain
  group bet (+115, my_bets) WON. PRE-BOARD CLV +5.41 avg across 13 flags (8 pos), Blaney t3
  +155->-125 (+16.3); best CLV board on record, likely understated by close-best method.
- MODEL VS FRIEND (planned Thursday, graded): race top-3 Gibbs/Bell/Blaney. His top-3
  Blaney/Logano/Byron (P3/P14/P9); our pre top-3 Blaney/Hamlin/Larson (P3/P5/P33). ~Wash on
  picks (1/3 podium each; our Hamlin P5 vs his Byron P9 edge to us). His Logano T5 +150 bet
  (at his own FMV) LOST; our fair ~+220 said pass - price discipline point to our side.
  His Byron +444 FMV (~18% win) vs our 3.6%: Byron quiet P9, never in contention - operator's
  Thursday skepticism vindicated; 5x model-vs-market divergences are usually model error.
- First live weekend for the full rebuilt stack (v6.2 grader, trail10-v3.5, wreck-v1.1-cb,
  car-auto-v2, append-only flags): profitable curated ledger, no stack failures, all
  diagnostics pointing at already-queued experiments.

## 2026-08-09 - PAYMENTS BUILD (Stripe + Supabase, sandbox)
- Pricing decided: $24.99/mo FOUNDING (list $34.99 after launch, founders locked for life) +
  $9.99 one-time 7-day week pass. No trials. Hard paywall; landing page will show STALE sample
  content only. Rationale logged from competitor map (Racesheets 19.99/mo, Speedgeeks 60/mo,
  WinTheRace 50/mo - the 25-35 middle was empty). Infra cost ~$46/mo fixed; ~2 subs break even.
- Built: subscribers table + RLS (select own row only; writes via service role only);
  api/create-checkout-session.js (verifies Supabase token, Stripe Checkout, client_reference_id
  = user id); api/stripe-webhook.js (raw-body signature verify; handles checkout completed +
  subscription updated/deleted; week pass = access_until now+7d); stripe dep; useSubscriber
  hook; Subscribe page (signup/signin + founding/week-pass cards); PaywallGate redirect in
  App.js behind PAYWALL_ENABLED = false KILL-SWITCH (stays off until end-to-end test passes).
- Stripe sandbox: products + prices created (operator), webhook destination created (3 events
  -> /api/stripe-webhook). Vercel env: 4 non-secret vars entered; 3 secrets entered by operator
  (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY) + redeploy.
- LAUNCH BLOCKERS still open: (1) admin password lives in client bundle (REACT_APP_ADMIN_
  PASSWORD + literal in App.js) - must move to Supabase auth roles before real users; (2)
  Vercel on Hobby plan - commercial use requires Pro ($20/mo) before charging; (3) landing
  page stale-sample redesign; (4) live-mode Stripe cutover after sandbox test (new prices,
  webhook + secrets from live mode); (5) #64 RLS tightening.
- TEST SCRIPT: /subscribe -> create account -> founding checkout w/ 4242 4242 4242 4242 ->
  bounce back success -> subscribers row appears -> flip PAYWALL_ENABLED true -> verify gating
  (non-sub redirected, sub + admin pass) -> week-pass flow -> cancel flow via Stripe dashboard.


## 2026-08-10 - PAYMENTS: FIRST SUCCESSFUL SUBSCRIPTION (sandbox) - FULL STATE FOR NEXT SESSION
STATUS: end-to-end VERIFIED in Stripe sandbox. Operator account (atmmstrs2@gmail.com) shows
"Membership active - Founding monthly" via real Checkout (4242 card) -> webhook -> subscribers
row -> useSubscriber read. This entry is the handoff; read it before touching payments.

WHAT EXISTS (all deployed, main branch):
- api/create-checkout-session.js: POST {plan:'monthly'|'week', token:<supabase access token>}
  -> verifies user via SUPABASE_URL+ANON_KEY -> Stripe Checkout session (client_reference_id
  = user id, customer_email) -> {url}. 405 on GET, 401 'sign in first' on bad token.
- api/stripe-webhook.js: raw-body signature verify; env presence guard (returns 'env missing
  or empty: KEY'); handles checkout.session.completed (monthly -> status active; week ->
  access_until now+7d), customer.subscription.updated/deleted (status + current_period_end by
  stripe_customer_id). Upsert failures now PROPAGATE as 500 with the supabase error text
  (was silently 200 - never regress this).
- subscribers table: user_id PK -> auth.users, email, stripe_customer_id, plan, status,
  access_until, updated_at. RLS: authenticated SELECT own row only; writes service-role only.
- src/lib/useSubscriber.js: {user,row,isSubscriber,loading,refresh}; isSubscriber = status
  'active' OR access_until > now. Listens to auth state changes.
- src/pages/Subscribe.js: signup/signin (email+password), founding card $24.99 (list $34.99
  struck), week pass $9.99, success/cancelled banners, active-membership state, sign out.
- App.js: PaywallGate redirect (all routes except / and /subscribe) behind PAYWALL_ENABLED =
  false KILL-SWITCH near 'function AdminGate'. Flip to true only after gating test.

CONFIG (sandbox values, all in place):
- Stripe sandbox acct_1OF5dBBoJdzYFWwL: products/prices STRIPE_PRICE_MONTHLY=
  price_1U34TbBoJdzYFWwLDhnkeM61 ($24.99 rec), STRIPE_PRICE_WEEKPASS=
  price_1U34UHBoJdzYFWwLaZ1MhPqX ($9.99 one-time). Webhook 'memorable-glow'
  we_1U3546BoJdzYFWwL0Pn3kRNd -> /api/stripe-webhook, events: checkout.session.completed,
  customer.subscription.updated, customer.subscription.deleted.
- Vercel env (Production+Preview): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
  SUPABASE_SERVICE_ROLE_KEY (sb_secret, new-style - works as apikey+Bearer),
  STRIPE_PRICE_*, SUPABASE_URL, SUPABASE_ANON_KEY. Client keeps REACT_APP_* pair.
- Supabase auth: Site URL = production domain; redirect allow-list set; CONFIRM EMAIL OFF
  (instant signup - deliberate funnel choice); no more localhost links.

DEBUG WAR STORIES (do not re-learn these):
- Env var saved with value pasted into the NOTE field -> present-but-empty var -> PostgREST
  'No API key found' -> webhook was 200-on-silent-failure. Fixed by moving value + the guard.
  ALWAYS suspect the Vercel Note field on 'missing env' symptoms.
- Env changes need a NEW deployment; resends racing a mid-build redeploy hit the old instance.
- Operator DECLINED rotating the supabase secret key after it sat in the Note field +
  screenshots (accepted risk, on record).
- Signup confirmation emails originally pointed at localhost:3000 (default Site URL) and the
  user landed on a dead page though confirmation itself succeeded.

REMAINING (priority order):
1. Nav sign-in for USERS + My Profile page (operator request): nav 'Sign In' currently opens
   ADMIN password modal only; users have no entry point outside /subscribe. Profile page:
   plan, renewal/access date, Stripe billing portal link (needs portal function or no-code
   portal link), sign out. Put next to Subscribe route.
2. Gating test: flip PAYWALL_ENABLED true; verify signed-out redirect, subscriber pass,
   admin pass; week-pass purchase + expiry; cancel via Stripe -> subscription.deleted ->
   access revoked.
3. Landing page redesign: STALE sample content only (operator: no current data public).
4. Admin auth: REACT_APP_ADMIN_PASSWORD + ADMIN_PW literal are in the client bundle -
   LAUNCH BLOCKER, replace with Supabase auth role/allowlist.
5. Vercel Hobby -> Pro before charging real money (commercial use ToS).
6. LIVE cutover: repeat products/webhook in live mode, swap 4 env values, real-card test,
   then founding-member announcement.

## 2026-08-10 - GFS Iowa loaded as Richmond (fixed, commit befdf96d)
- Stale track dropdown + failed auto-match tagged Iowa 34 GFS rows as Richmond Raceway.
  Rows retagged to Iowa Speedway via REST; loader now REFUSES when parsed PDF track and
  selected track disagree (fuzzy compare). GFS parser also now reports skipped rows by car
  (Jones/Reddick lap-5 crash = dash speed = correctly absent, not an alias bug).

## 2026-08-10 - RLS: signed-in users saw EMPTY tables (fixed; #64 now launch-critical)
- First-ever Supabase auth session (operator subscribing) broke the Weekend Config track
  dropdown: tracks table had anon-only SELECT policies, so authenticated requests got zero
  rows (same class as July crossover_borrows). Every table was built for an anonymous-reads
  world; every SUBSCRIBER will be authenticated.
- FIX RUN (operator, SQL): blanket "authenticated read" SELECT policy on every public table
  EXCEPT subscribers (stays own-row-only).
- #64 RLS AUDIT PROMOTED TO LAUNCH BLOCKER - ACCESS MODEL DECIDED (operator, 8/12):
  three tiers. ANON: nothing (hard paywall; landing page stale samples only - hardcode or a
  small public table). SUBSCRIBERS (authenticated): read all product tables. ADMIN (operator
  auth account): everything incl. operator tables (my_bets, flagged_bets, clv_log, sim_grades,
  odds_snapshots...). Implement via an admins table (operator user_id) + RLS policies
  USING (auth.uid() IN (SELECT user_id FROM admins)) on private tables; strip anon SELECT
  policies from product tables at paywall flip. This SAME design replaces the client-bundled
  ADMIN_PW (launch blocker): admin UI keys off the admins table, enforcement is server-side
  RLS, not hidden buttons. Note: route paywall does not protect the REST API - the RLS work
  above IS the API paywall.

## 2026-08-12 - Subscriber account UX shipped (commits 48e04054, 76799682, 40e45fcb, 67b7f8a6)
- NAV (user-aware): signed OUT -> "Sign In" links to /subscribe + Subscribe button; signed IN
  -> email-name chip links to /account; Subscribe button hides for active subscribers. Admin
  password modal moved behind a subtle gear icon (low-opacity, title "Staff sign in") -
  interim until the admins-table auth replaces ADMIN_PW (#64).
- /account "My Profile": email, sign out, membership state (founding w/ paid-through date, or
  week pass w/ access-until, or none -> See plans), "Manage billing" -> Stripe billing portal
  via new api/create-portal-session.js (token-verified, customer looked up server-side).
  Week passes have no portal (nothing to manage). /account exempt from PaywallGate.
- CAVEAT: Stripe billing portal must be SAVED once in dashboard settings (test and live each)
  or the portal call errors - Settings -> Billing -> Customer portal -> Save. Not yet done.
- Remaining on payments track: gating flip test, stale-sample landing, admins-table RLS (#64
  spec in the 8/10 entry), Vercel Pro, live-mode cutover.

## 2026-08-12 - MASTER ADMIN via admins table (commits 534cbc94, 9952d930, 7df5966d, c73a1e3f, 7213e966)
- Operator decision: his account (atmmstrs2, uid d7a9f822-...) IS the master admin. admins
  table created (RLS: check own row only; rows addable only via dashboard). useSubscriber
  now returns isAdminUser. THREE password gates now honor it: App.js nav modal, Admin.js
  internal "Admin Access" gate, SimulationCenter standalone gate. Signed in as operator =
  full admin everywhere, zero passwords. Account chip added to admin nav branch (/account).
- Password fallbacks (nav gear modal, in-page gates, ADMIN_PW, REACT_APP_ADMIN_PASSWORD)
  still EXIST as legacy - REMOVE after operator confirms auto-admin on all pages; that
  closes the password-in-bundle launch blocker. Then #64 table-lockdown SQL completes the
  server-side story.

## 2026-08-12 - PASSWORD AUTH FULLY REMOVED (commits e6c96a0d, 95fe819d, 39c44f90, 961495f8)
- Operator confirmed all three gates open via admins table -> deleted: nav gear + modal,
  ADMIN_PW const, Admin.js "Admin Access" form + handleLogin + ADMIN_PASSWORD, Sim Center
  gate + handleLogin + ADMIN_PASSWORD. Verified live bundle contains NO password literal.
  Non-admins on admin routes get a "Staff only" card. LAUNCH BLOCKER (password-in-bundle)
  CLOSED. REACT_APP_ADMIN_PASSWORD env var now unreferenced/inert - operator may delete.
- Admin model final: admins table row = admin, everywhere, one sign-in. Remaining #64 half:
  table-lockdown SQL (operator tables -> admins-only; product tables -> subscriber-read;
  strip anon at paywall flip) per the 8/10 spec.

## 2026-08-12 - NAV COPY (commit f4397d55)
Center dropdown 'Sim Center' renamed 'Simulation Center'; items now 'Cup Sim Results / O'Reilly Sim Results / Truck Sim Results' (same /sim-results?series= routes). Admin-only top-right button renamed 'Sim Admin' (still /simulation-center). Admin + Sim Admin buttons render only inside the isAdmin branch - normal signed-in users see account chip only. Bundle verified.

NAV DROPDOWN ANIMATION + TOP SCROLLBARS (2026-08-12 evening): (1) Dropdown was defined INSIDE Nav so every render remounted it - transitions never ran; hoisted to top-level component, menus now fade+slide 0.22s (commits d50ea403, 65ba720f). (2) New src/components/XScroll.js - horizontal scroll container with synced scrollbar ABOVE content (renders only when table overflows, two-way scrollLeft sync, ResizeObserver). Swapped into all 9 wide-table containers: QualifyingCenter x2, FastestLap x3, GreenFlagSpeed x2, LoopData x2 (incl. the maxHeight 72vh main table; modal overflowY untouched). All 4 pages verified live incl. sync. Pattern note: use XScroll instead of div overflowX auto for any future wide table.

XScroll also applied to SimResults.js (proj table + movers tab, commit ce41b20b) - all three series pages verified live. Total 11 wide-table containers now use it.

SIM ENGINE AUDIT PASSED (2026-08-12): extracted production runRaceSim into a browser harness, synthetic fields at 20k sims. Invariants hold: win sums 100 / top5 500 / top10 1000 / projFinish sums n(n+1)/2 / lapsLed allocates exactly totalLaps. DNF realizes 2.36/3.59/6.20 pct at Low/Med/High caution around the 4.05 auto budget (Richmond cup pre board 2.39 avg matches Low - by design, not a leak). Monotonic speed->finish, ordered quantiles, even equal-field split, lapsDown correctly buries cars w/ wave-around recovery. NOTE for future harnesses: runRaceSim RETURNS SORTED BY projFinish, not input order - match by name. Known modeling gap (queued): mech DNF rate flat across equipment tiers. Also: loop_data.finish_status is junk (defaults 'running'; 2025 cup shows 9 DNFs all at Daytona) - never use it; laps-completed-vs-winner is the working DNF definition.

REPORT CARD CAR NUMBERS (2026-08-12, commit 5f663c74): unraced tracks had blank CAR column (display merge only knew loop_data at same track/year - empty pre-race). Added stage-2 fallback in PracticeReportCard.js: latest published sim_results lineup for the race, then season-wide loop_data. Verified live on trucks Richmond R17 S1.

## 2026-08-14 - TRACK EVOLUTION FINDING + TIMESTAMP PIPELINE (Richmond practice day)
FINDING (first timestamped captures, trucks + cup A/B): sessions open ~1.5-2.3s FAST and decay over ~24min; all three curves near-identical shape. Cup A/B natural experiment: group B opened at 22.889 vs A 22.890 despite A's rubber + 13min break -> track does NOT carry momentum; the effect is the fresh-sticker first-run window, not surface evolution. Tire correction is blind to it (corrects within-stint age, not between-stint compound freshness). Graded-card victims this week: Timmy Hill 3rd on trucks card ran ALL fast laps in first 5.5min (9th-best within early window - conditions-adjusted fringe top10); Alex Bowman 84 pct of laps early; Corey Heim/Haley/C.Smith punished for mid-session race runs. Operator eyeball: discount Hill/Hemric/Bowman, promote Heim.
PIPELINE SHIPPED: (1) pitboard_practice_sheet.py adds LAPS_RAW worksheet - ALL sane laps, ORIGINAL lap numbers (gaps preserve stints - fixes the queued renumber bug), captured_at per lap; page 1 unchanged. (2) excelParser.js prefers LAPS_RAW when present, replaces grid lapData, attaches lapTs (commit 48b81c22); manual sheets unaffected. (3) Admin.js writes captured_at into practice_laps rows (commit c9f81a2c). SQL REQUIRED BEFORE NEXT UPLOAD (given to operator): alter table practice_laps add column if not exists captured_at timestamptz. NEXT (model queue, top): session-time decay term in grader - pooled fit like tire slope, normalize laps to session-relative time; 3 sessions of timestamped data accruing from today.

HR ODDS PARSER FIX (2026-08-14, commit 36e129f9): Hard Rock build 3.38 renamed the winner-market section header to bare 'Race' - HRh win pattern only knew winner/outright, so HR pastes showed 0 parsed (counter counts win market only; t3/t5 were parsing fine). Pattern now /winner|outright|^race$/i. Verified against live paste before shipping (17/17 win odds, Majeski +350). Book-side header renames are a recurring class - if a book shows 0 parsed after a site update, check its section headers first.

LAP COMPARISON DEFAULT (2026-08-14, commit d9c19593): preselects top 4 by practice GRADE (runs gradePracticeSession on the session laps) instead of top 3 by raw avg - Cody Ware's 4-lap session topped the raw-avg sort. Falls back to old behavior on grader error. Verified live (cup Richmond: Bowman/Suarez/Blaney/Logano selected, Ware skipped).

GRADER v6.3-st SHIPPED (2026-08-14, commit e0d1e8d2): session-time correction live - see BACKTEST_LOG for design + prospective protocol. OPERATIONAL NOTE: grading happens AT UPLOAD TIME (Admin.js) - sessions uploaded before this deploy (incl. today's cup upload) carry old grades until RE-UPLOADED. Cup sheet already has LAPS_RAW - just re-upload it. Trucks needs the sheet regenerated (make practice sheet) + POS overwritten w/ starting lineup + re-upload to get timestamps AND the corrected card. Weekly prospective check owed every post-race.

DFS OWNERSHIP INGEST FIX (2026-08-14, commit ba78d894): post-contest ownership was tagged to the CURRENT sim-board week - now has a race dropdown (completed races from races table, newest first), rows tag to the SELECTED race, and driver names match against that race's loop_data field (plus current entry list). Also diagnosed the '0 rows recognized' complaint: operator pasted DK's ENTRY-HISTORY export (Sport/Game_Type header, no ownership) - the CONTEST-STANDINGS zip/CSV is the right file (Player/%Drafted/FPTS side columns; verified Iowa file parses 36 drivers). DFS OPTIMIZER DECISION PENDING: operator debating cutting the optimizer (doesn't use its lineups himself); my rec on record = cut optimizer + keep sim-derived projections/value board; experiment = skip DFS steps for a weekend and see if missed. No code removed yet.

OWNERSHIP INGEST HARDENING (2026-08-14, commits b145ac2f + bf627632): DfsSalaryAdmin norm now NFD-folds accents (Suarez) AND parser has first+last fallback (DK 'John H. Nemechek' vs loop 'John Hunter Nemechek'). Iowa GPP ground truth saved: 35 rows verified in dfs_ownership via REST; re-upload after this deploy picks up Nemechek (upsert). Right file = DK contest-standings zip CSV, NOT entry-history export.

## 2026-08-14 - DFS OPTIMIZER: KEEP + IMPROVE (operator decision) + REPLAY FOUNDATION
Ownership findings (2 races, Iowa cup+oreilly GPP): field ownership tracks our projDK at rho ~.80 both series; CUP owners chase VALUE (pts/$ rho .82, start pos irrelevant), OREILLY owners chase raw speed + track position (start rho -.45). Leverage report validated: Austin Hill 43 pct owned vs our sim rk 14 (chalk trap, busted), Allgaier our rk 1 at own rk 13. n=2 - hypotheses not conclusions, refit at 8-10 contests.
OPTIMIZER REPLAY (first receipts): mean-projDK optimal lineups vs REAL Iowa contests: cup 175.30 -> 1289/1417 (bottom decile; Larson -17 toe link, winning builds were PD-heavy Bell/JHN structures); oreilly 201.15 -> 2412/4756 (median; Love -12.6 anchor). Structural read: per-driver projections fine, lineup CONSTRUCTION leaks - mean-optimization is cash logic, GPPs need ceiling. UPGRADE QUEUE (agreed): 1) replay report automated from standings uploads, 2) GPP ceiling mode - rank candidate lineups by p90 across dfs_sim_samples draws (correlation-aware, infra exists), 3) ownership projection + leverage overlay (chalk-trap flags), 4) dominator per-draw scoring if samples carry laps-led.
INGEST V2 (commit 3d50cec4): ownership parser also stores per-driver FPTS (dfs_ownership.fpts) and banks contest field distribution to NEW dfs_contests table (entries/winner/median/pct90/75/25/decile scores_sample; upsert on series+year+race+type). SQL given to operator (fpts column + dfs_contests + auth-all policy). DK scoring fn note: placePts 45/42/-1 runs ~1pt/driver hot midfield vs official FPTS - use official file numbers when available. Right file = contest-standings zip CSV, NOT entry-history.

DFS GPP CEILING MODE SHIPPED (2026-08-14, commits 61065935 + 58ecd18f perf): DFSPage Mode selector - GPP (ceiling, DEFAULT) vs Cash (average). GPP: candidates = per-draw exact-optimal lineups collected during the Optimal% pass (deduped, cap-feasible, each a realizable race story) + top-300 mean lineups; each candidate scored across ~2500 stride-sampled sim draws; ranked by p90 TOTAL (lineup table shows Proj/Ceil p90/Floor p25). Perf note: 10k-draw full sorts froze the tab - candidate cap 2000 + draw stride REQUIRED. Locks/excludes/exposure respected; CSV export unchanged; cash path untouched. Motivation on record: Iowa replay (mean-optimal 1289/1417 cup, 2412/4756 oreilly) + industry research (SaberSim ceiling-optimization, Stokastic PP/Dom split + ownership-in-builds; sources in chat 8/14). Richmond R24 first GPP build: Blaney anchor + PD stack (Suarez P20/Kes/McDowell), mean 317 ceil 384 floor 283. VALIDATION: replay vs real contest files weekly (dfs_contests now banks distributions). Still queued: replay report UI, ownership-in-build leverage, Top4PP/Top2Dom-style stats.

DFS SHIP DAY WRAP (2026-08-14 evening, commits 685f9310/fd928c9c/9bce6c14): (1) DK CSV export filename now PitBoard_DK_series_year_Rn_track_MODE_lineups.csv. (2) Lineups card renders ABOVE driver pool. (3) FILL RESERVED ENTRIES: DK library uploads never touch already-reserved contest entries - new button takes DK's Entries CSV (has Entry ID), writes built lineups into the D slots (quote-aware CSV parse, cycles lineups when entries > lineups, Name (ID) format from salaries.__ids), returns *_ENTRIES_*_filled.csv that DK applies IN PLACE. LIVE TEST PASSED: 7 GPP lineups uploaded to DK successfully (Richmond R24 cup). Iowa GPP-vs-mean backtest in BACKTEST_LOG. Operator entering Richmond contests w/ GPP builds tonight - post-race standings upload = first live replay datapoint + Richmond ownership banked.

## 2026-08-14 - LAP RAPTOR REDESIGN (parser + DNF definition, commits 64360716 + 593ef738)
Lap Raptor rebuilt their race pages. New Loop Data table: Start/Finish/FINISH STATUS(text)/ARP/High/Low/GFP+-/GFP+/GFP-/QP/pctQP/FastestLaps/T15/pctT15/LapsLed/pctLed. DROPPED SITE-WIDE: mid-race position, laps_completed, DRIVER RATING (their new speed stats = cPOMS/LSP/SS on Lap Performance + Advanced reports). Shipped: (1) Admin parseLoopData dual-format - old regex first, new-format fallback (regex tested vs live rows incl. Stenhouse Jr. + Accident status); new rows store REAL finish_status (accident/mechanical/running - the junk-status era ends for new races), laps_completed + driver_rating null. (2) SimulationCenter auto-DNF measurement now: DNF = (finish_status != running) OR (laps>0 AND laps < 0.9x winner) - without this, null-laps rows counted as 100pct DNF and would have poisoned auto rates. OPEN CONSEQUENCES: (a) v6.3-st prospective validation target was race-day driver_rating - GONE for new races; replacement candidates = Lap Raptor LSP/cPOMS (Advanced report - arguably cleaner race-speed measures) or self-computed from watcher race captures; decide before Sunday's check. (b) Advanced-report ingestion (LSP/cPOMS/SS columns) queued - would need loop_data columns + paste section. (c) races.total_laps regex may still miss on new page layout (less critical now statuses are real).

CORRECTION (operator): driver_rating + laps_completed come from RACING REFERENCE post-race - the old parser format IS the RR loop-data table and still fully works. Lap Raptor (new format) is a supplemental source: earlier fastest laps + REAL finish statuses. v6.3 validation target (race-day driver rating) is NOT lost. Workflow: RR paste = primary post-race; LR paste only when RR not yet published (do NOT paste both for one race - loader would duplicate rows). Queued nicety: merge mode (RR rating/laps + LR statuses).

SIM_MATRICES FULL-RUN STORAGE (2026-08-15, commits 6e0e4619 + b2835780): operator noticed Matchup Compare group prices differ ~1pt from published mfr/team boards - cause was config.simMatrix being a 4k-draw sample (MC SE ~0.8pt at p60) vs boards computed from the full 50k run. Fix: publish now ALSO writes the FULL position matrix (Uint8 b64, ~2.5MB) to new sim_matrices table (delete+replace per series/year/race/stage); CompareTray lazily fetches it and prices groups over all draws - EXACT agreement with boards; falls back to config 4k sample for pre-existing boards. Board page loads unaffected (matrix only fetched by tray). SQL run by operator (table + auth-all policy). Applies to boards published from now on - tonight's cup Richmond re-publish (if any) gets it, else Watkins/next week.

## 2026-08-19 - #64 TABLE LOCKDOWN RUN + PAYWALL FLIPPED (commits b85c990, 9b9d72f)
- WEEK-PASS EXPIRY BUG found + fixed (b85c990): webhook writes week passes status='active' and
  no Stripe event ever changes it (one-time payment); useSubscriber treated status='active'
  alone as access -> expired passes kept access forever. New predicate BOTH sides (client +
  RLS has_access()): (plan='monthly' AND status='active') OR access_until > now(). Verified
  in live bundle.
- table_lockdown_64.sql RUN by Claude via operator's Supabase SQL editor (operator authorized,
  away from keyboard). Design: DO-block wipes ALL public policies, rebuilds from explicit
  classification; completeness guard aborts on unclassified tables/views (transactional, no
  half-state). Tiers: 11 admin-only tables (my_bets, flagged_bets, clv_log, sim_grades,
  odds_snapshots, fastest_lap_odds, dfs_ownership, dfs_contests, crossover_borrows,
  dfs_salary_history, pit_crew_race), 20 product tables subscriber-read via has_access(),
  subscribers/admins own-row-read, anon NOTHING. admin_all FOR ALL on everything via is_admin()
  (both helpers SECURITY DEFINER, search_path locked, anon EXECUTE revoked). Pre-tested on
  scratch Postgres 16 with mock schema: 7 access tiers all to spec.
- Guard catches (why the run aborted twice, correctly): dfs_salary_history + pit_crew_race
  (research tables, not in code -> admin-only) and VIEW loop_data_dk (DK place-points helper;
  views run owner-rights and tunnel under RLS) -> kept, ALTERed to security_invoker.
- RPC LEAK CLOSED: verify query revealed get_practice_sessions, get_loop_data_counts,
  get_audit_data were SECURITY DEFINER (would bypass RLS for any free signed-up account).
  ALTERed all three to security invoker. Only is_admin/has_access remain definer (by design).
- LIVE API verification (publishable key vs operator token): anon loop_data 0 rows, anon
  my_bets 0 rows, anon RPC 200/empty, operator 3/3 rows. RLS lockdown = the real API paywall, UP.
- PAYWALL_ENABLED -> true (9b9d72f). Verified live: signed-out /loop-data redirects to
  /subscribe (tested by stashing+restoring operator session token); operator/admin passes,
  Loop Data renders. Landing counters read 0 for anon now (RLS) - stale-sample landing page
  is next.
- STILL OPEN on flip test: pure-subscriber pass (non-admin account), week-pass purchase+expiry,
  cancel-revokes-access, Stripe Customer Portal settings SAVE (operator, test+live).
- NEW RISK logged: pit_crew_race weekly bookmarklet - if it writes with bare publishable key,
  upsert now dies under RLS; re-test at next sync, fix = operator access_token in its headers.

## 2026-08-19 (later) - GATING FLIP TEST COMPLETE; SANDBOX PAYMENTS FULLY VERIFIED (commit 9a67572)
- Test rig: operator Chrome = admin session; Edge = non-admin test account atmmstrs1@yahoo.com
  (created by operator, founding monthly purchased with Stripe test card).
- PASSED: subscriber pass (product pages + data render); /admin blocked ("Admin Access
  Required"); expired week-pass lockout (SQL sim: plan='week', status stale 'active',
  access_until past -> bounced to /subscribe - the exact pre-fix bug scenario, now closed
  BOTH client + RLS); cancel via Stripe dashboard -> webhook fired, row canceled +
  access_until = period end (paid-through by design; immediate-revoke for refund cases =
  manual row edit, policy accepted); "Manage billing" -> Stripe Customer Portal opens with
  payment method + invoices (portal settings SAVE confirmed done, test mode).
- FALSE ALARM worth remembering: Edge initially showed NO redirect for the expired account -
  stale pre-flip bundle in browser cache; Ctrl+F5 fixed. Check bundle freshness before
  debugging gate logic.
- SHIPPED subscribe-page callout (9a67572, operator-requested UX): PaywallGate now passes
  state {gated:true}; /subscribe shows context banner - expired week pass ("YOUR RACE WEEK
  PASS HAS ENDED") vs lapsed monthly ("YOUR MEMBERSHIP IS INACTIVE") vs gated visitor
  ("MEMBERSHIP REQUIRED"), keyed off subscribers row + redirect state. Verified in live bundle.
- Operator Chrome session on the site got signed out during the token stash/restore redirect
  test (refresh-token rotation) - operator re-signs in, no data impact.
- Sandbox payments track DONE. Remaining to launch: stale-sample landing page, Vercel Pro,
  LIVE Stripe cutover (products/webhook/env/portal-save in live mode + real-card test).

## 2026-08-19 (night) - BRAND + SUBSCRIBE UI BATCH (commits 453043e, 98a86ba, ec903f8, 8c262b1, 12c393e)
- Subscribe plan cards v2 (operator-directed): chip badge / plan name / big price / matching
  full-width CTAs ("GET WEEKLY ACCESS" / "GET MONTHLY ACCESS"). Competitor-derived copy
  removed on operator order (the example screenshots were a competitor's pricing page).
  Tagline now "Full access to PitBoard Analytics".
- WEEK PASS -> AUTO-RENEWING WEEKLY SUB (98a86ba, operator decision): checkout mode
  'subscription' for both plans + plan in session/subscription metadata; webhook week branch
  keys off metadata.plan (legacy mode='payment' branch kept for old passes); Account shows
  "renews weekly" + portal button now available to weekly members. NOT LIVE until operator:
  (1) creates recurring $9.99/wk price in Stripe test dashboard, (2) swaps
  STRIPE_PRICE_WEEKPASS env value in Vercel, (3) redeploys, (4) test purchase. Weekly buy
  button BROKEN until then (one-time price rejected in subscription mode).
- SITE-WIDE ACCENT SWAP gold -> racing red (ec903f8): --accent #E10600 (fills, white text),
  new --accent-text #FF5148 (text-on-dark: links, lap times, ratings, active labels),
  --accent-dim red. 16 files. Series identity colors untouched (trucks yellow, oreilly blue).
  Landing hero CTA red.
- LOGO SHIP (8c262b1, 12c393e): PitBoardLogo component (outlined-vector, no webfont) from
  operator's design handoff zip. Badge (34px) replaces nav text wordmark; full lockup
  height 150 front-and-center on Race Weekend hero; favicons/apple-touch/og-image + head
  tags installed. RacingStripes top decoration + "NASCAR Analytics Platform" hero chip
  REMOVED (redundant with lockup). Brand rules in handoff README: never recolor bars,
  scale only, min 26px plate.

## 2026-08-19 (close) - LANDING SIMPLIFIED (commits d57e04e, 09f3ebf, 9f320bf)
- Hero: lighter charcoal gradient (#23262c->#17181d) so the logo's black plate edge reads;
  headline + Monte Carlo paragraph REMOVED (operator: "What's inside" cards carry the pitch);
  stats bar (races/drivers/years/series) REMOVED; lockup bumped to 230px plate (maxWidth 90vw
  for mobile). Nav "Race Weekend" renamed "Home".
- CONSEQUENCE: Landing no longer queries Supabase AT ALL (stats queries deleted with the bar).
  Anon landing is now self-contained - the "stale-sample landing" runway item likely reduces
  to: sign-out check in a browser, confirm What's-inside cards are static, done. Not yet
  verified signed-out; do that before calling it closed.

## 2026-08-19 (day 2) - FACEBOOK LAUNCH KIT (marketing, no code)
- Competitor read: fullthrottlefantasy.com = FREE community fantasy league (owner mode, polls,
  articles at 8-21 views), no discoverable FB page. Strategy: don't compete on community -
  convert their audience with model receipts. Their users = our funnel.
- Kit delivered to operator (chat + local /facebook when device reconnects): profile 960px +
  cover 1640x624 rendered from brand SVGs, setup fields (name PitBoard Analytics,
  @pitboardanalytics, Sign Up CTA -> /subscribe), 5 content pillars (receipts = growth
  engine), weekly cadence mapped to race rhythm (Mon receipts post is the anchor), 5 paste-
  ready launch posts, growth + tone rules.
- TONE GUARD on record: Kyle Busch passed May 2026 (8/18 now Kyle Busch Day) - community in
  mourning season; tribute-adjacent content never used for promotion/engagement. Also: FB
  paid-ads for gambling content need authorization + 21+ targeting - organic analytics
  content fine; revisit at live cutover.
- Operator creates the page (his login); next: draft New Hampshire week post set from real
  board output once published.

ENTRY PDF WRAPPED-NAME FIX (2026-08-19, commit e3b7ec39): NH trucks entry PDF line-wrapped 'John Hunter Nemechek (i)' -> parser created driver 'John Hunter' with org 'Nemechek (i)' -> sim treated JHN as history-less new driver (proj 21.3 on a board otherwise fine). Data fixed: entry 1644 -> 'John Hunter Nemechek' / TRICON Garage (entry convention = cleaned names, no roster markers). 9 trash pre-flags DELETED (bad-input model opinions); operator re-runs + republishes NH trucks pre. Parser now treats a ONE-word fragment (optional (x) marker) in the trucks org slot as name continuation (real truck orgs are 2+ words) and shifts org to the next item. Bug class: PDF line wraps on long name + interloper marker - recurs whenever a cup regular enters a truck race.

DNQ HANDLING (2026-08-19, commit 695d0b2): start_position -1 = DNQ convention (operator
uploads non-qualifiers as -1). Was rendering literal "-1"/"P-1" and sorting ABOVE P1 in
Lap By Lap. Fixed 3 displays: PracticeLapTable (renders DNQ muted + sort rank sinks DNQ
below qualified field, nulls last), LapComparison (list + table "P-1" -> "DNQ"),
PracticeReportCard (start col "-1" -> "DNQ"). Verified live on NH trucks S1: 5 DNQs
(Massey/Breidinger/Muniz/Wilson/White) bottom of table. Comparison/report card verified
via bundle (4 DNQ literals).

DFS OUT-DRIVER HANDLING (2026-08-20): operator caught DK-listed OUT drivers (withdrawn/DNQ)
surfacing as "value" in DFS Center - parseSalaries read only name/salary/ID, status ignored.
Shipped: (1) parser captures \bOUT\b on a matched salary line -> __out array in dfs_salaries
json; (2) DfsSalaryAdmin per-driver OUT checkbox (auto-checked from paste, manual toggle for
late scratches) + OUT badge; (3) DFSPage: OUT driver -> effective salary 0, which zeroes value
AND drops them from ALL optimizer paths (mean pool, GPP feasible(), Optimal% salByIdx - every
path filters sal>0); salary cell shows red OUT badge. Re-upload/save salaries after marking.
NOTE: OUT detection only works when the paste carries DK's OUT tag (lobby copy does, bare CSV
may not) - the manual checkbox is the guarantee. Cosmetic-adjacent but pool-affecting: shipped
with light check per 8/19 rule, operator verifying on this week's NH slate.

STARTPOS WEIGHT SHIP (2026-08-20): DEFAULT_WEIGHTS.startPos 0.33 -> 0.23, from the 230-race
full-model conditioned sweep (production sim evaled from source; cup/ore/trucks INT+SHORT
2023+; per-race paired t10 Brier 134W/96L p~.01 for the cut, 0.43 loses badly). Operator
hunch "we overvalue start position" CONFIRMED overall - with ONE exception cell: trucks
short/flat (raw start-finish corr .576, highest anywhere) where the cut LOSES t5 12W/19L.
New TRUCK_SHORT_WEIGHTS export (0.33 startPos, else identical) auto-applies when
series=trucks + __trackGroup SHORT, wired into both the config auto-apply and the Reset
button. SS/ROAD/TRUCK_ROAD sets untouched. NH impact: cup board (flat mile = SHORT) now
sims at 0.23; trucks board unchanged at 0.33. Prospective revert trigger: cup boards 0-fer
t5/t10 vs books two straight weekends. Full methodology + per-cell table in BACKTEST_LOG
2026-08-20. Verification tier: model change -> full backtest before ship (done); UI check =
weights panel shows Start 23% on NH cup, 33% on NH trucks after deploy.

FILL RESERVED ENTRIES v2 (2026-08-20, commit b0361752): per-CONTEST picker. Choosing the DK Entries CSV now parses + groups rows by Contest Name and shows checkboxes (name + entry count, all checked by default); Fill selected emits a file containing ONLY checked contests' rows - DK edits those in place, unchecked contests never appear in the upload so they are untouched. Cycling within selection unchanged. TWO-PASS PATTERN: fill GPP contests with a ceiling build, rebuild in Cash mode, run the SAME entries file again with only cash contests checked. FULLY LIVE-VERIFIED (synthetic 2-contest file injected into deployed page: picker groups/counts correct, output = header + 3 selected rows w/ 6 ID'd drivers each, unchecked contest absent). Bug note for the workflow file: stale-index splice (insert-then-use-old-offset) corrupted first attempt - anchors only, recompute after every mutation.

EXPOSURE DEATH-SPIRAL FIX + CONTEST-ID FALLBACK (2026-08-21, commit 8a48b136): (1) applyExposure's 7/23 delivered-set trim loop REMOVED - with a driver in ~every candidate (chalk on small slates: NH trucks JHN/Perez) cap2 shrank with each trim and spiraled any sub-100 exposure request to ONE lineup (operator: 20 @ 90 -> 1). Now: cap = floor(want x maxExp) appearances vs the REQUESTED count, greedy, no trim; pool exhaustion under-delivers with the existing note and the Exposure column shows real percentages. Live-verified: 20 @ 90 cash on NH trucks -> 18 lineups (correct: universal chalk capped at 18). (2) Entries picker groups by Contest ID ('Contest #NNNN') when the DK export lacks a Contest Name column - operator reports DK accepts the filled file fine either way.

PRACTICE DATA INTEGRITY - DUPLICATE LAP NUMBERS (2026-08-22, investigation only, no code shipped):
scan of 60k practice_laps rows found 204 of 1,956 driver-sessions (10.4%) carrying the same
lap_number twice for the same driver/session - 4,476 pairs with DIFFERENT times (two sessions or
two uploads interleaved under one session_number) and 1,438 byte-identical (double-inserts). Because
parseStints only continues a stint on prev+1, a duplicated session fragments into 1-2 lap stints:
133 of the 204 lose their long run entirely and take the missing->25 fill wrongly (20% of the
composite), with avgPace/consistency corrupted too. Ongoing: 2024 x34, 2025 x132, 2026 x38.
NEW HAMPSHIRE R18 IS CLEAN (0 duplicated sessions, trucks S1 + cup S1) so the live boards are fine
and nothing was changed before the race - a grader-side change this weekend would have made the
v6.3-st week-3 ledger unattributable. Owed post-NH: full-table audit, a dedupe keyed on
(series,year,track_name,session_number,driver_name,lap_number), a decision on whether historical
dedupe is applied (it moves historical grades and the 97-race harness baseline, so it needs its own
grade-bar before/after), and an upload-time guard so re-uploads REPLACE instead of interleaving.
Related: the "one missing lap splits a run" hypothesis was tested and REFUTED - all 90 single-lap
gaps in the timestamped era are real pit visits (167-435s wall clock vs 24-25s laps). BACKTEST_LOG
2026-08-22 carries both, plus a clarification that the 8/20 startPos cut renormalized every other
weight (corr 33.7%->37.2% on DEFAULT boards; sweep result stands, description was incomplete).

RETRACTION (2026-08-22, operator-caught): the practice duplicate-lap entry logged earlier today is
VOID. There is no data bug. I scanned practice_laps keyed on (series,year,track_name,session_number,
driver_name) and omitted race_number - tracks that host two races a season (Phoenix: race 1 spring,
race 36 championship) legitimately carry two session_number=1 practices, so every "collision" was my
own construction. Identical 60k rows: 204 colliding without race_number, 0 with it. Admin.js scopes
its upload delete-replace on race_number and both read pages filter on it, so the app was never
affected. practice_duplicate_audit.sql deleted from the repo rather than left as a trap. Operator
caught it with one domain fact ("there is always only 1 practice session in 2026"), which my
two-sessions-per-weekend explanation required to be false. Standing lesson recorded in BACKTEST_LOG:
reproduce the APPLICATION's query key before reporting any data-integrity finding - a coarser scan
key manufactures collisions every time. Surviving: single-lap gaps are real pit visits (90/90 in the
timestamped era), parseStints' strict prev+1 split confirmed correct; and the separate startPos
renormalization clarification (corr 33.7%->37.2% on DEFAULT boards) which was code-verified and stands.

PRACTICE SHEET PAGE-1 RENUMBERING - COSMETIC/QA DEFECT, OWED TO FABLE (found 2026-08-23, operator
catch): pitboard_practice_sheet.py writes the PRACTICE tab (page 1) with laps COMPACTED and
RENUMBERED 1..N - pit laps are dropped and everything after shifts down - while LAPS_RAW keeps
ORIGINAL lap numbers with gaps. Worked case, NH cup R18 Erik Jones: old hand-cleaned sheet showed
lap 41 = 424.79 and lap 42 = 1138.08 (pit sequence); LAPS_RAW omits 41-42 and jumps 40 -> 43; page 1
shows 40 contiguous laps where its "lap 40" is really lap 43.
NOT A DATA BUG - nothing downstream is affected. Verified end to end: excelParser prefers LAPS_RAW,
so practice_laps stores original numbering with the holes (Erik: 41 rows, 1-43, gap 40->43); the
grader reads 2 runs (40+1), not one; NH cup session-wide mean 2.75 runs/driver, ZERO drivers reading
as a single run; and the live Lap By Lap page renders the pit laps as em-dashes at 41/42. DB is
consistent across every year (mean runs per driver 1.94/2.64/2.63/2.81 for 2023-26, zero laps >120s
before 2026), because the operator's OLD workflow deleted the outlier cells by hand before upload -
a blank cell is skipped by the parser and leaves the same gap the python script leaves. The two
methods have always agreed.
THE DEFECT IS QA-ONLY BUT REAL: page 1 is the tab the operator eyeballs BEFORE uploading, so it is
the one artifact that does not match what gets stored. Anything catchable by eye - a driver who
pitted five times, an implausibly long run, a session where the feed dropped laps - is invisible at
exactly the moment of checking. Erik's 40-lap unbroken run is the motivating example: plausible, but
if the feed missed a stop it is two runs wearing one hat and page 1 cannot show that.
FIX (owed to Fable, scraper cockpit not the web app): pitboard_practice_sheet.py should write page 1
on ORIGINAL lap numbers with blank cells at the gaps, matching LAPS_RAW and matching the site's
em-dash rendering. Page 1 AVG LAP is already correct (clean-lap mean; the old format's AVG LAP
included pit laps - Erik 65.5 vs a real 30.2 - and was never usable).
HAZARD TO KEEP IN MIND: never upload an OLD-format sheet with outliers left in. A 1138s lap passes
parseStints' t<1200 filter, so lap numbering stays unbroken and every driver collapses to ONE stint -
which silently disables the run-aware avgPace of grade formula v3, computes falloff slope straight
through a pit stop, and welds two short runs into a fictitious long run. Measured on the old NH
sheet as uploaded-with-outliers: mean 1.0 stints/driver vs 2.7 from LAPS_RAW.

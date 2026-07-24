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

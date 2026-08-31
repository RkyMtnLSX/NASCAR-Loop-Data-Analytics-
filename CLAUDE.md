# NASCAR Loop Data Analytics — CLAUDE.md

This file gives any new Claude session enough context to work on this codebase without re-reading conversation history.

---

## Project Overview

A React web app (hosted on Vercel) for NASCAR Cup Series analytics. Built for a single subscriber/owner. Uses Supabase as the database and Vercel serverless functions for data-loading operations. The codebase lives at: **https://github.com/RkyMtnLSX/NASCAR-Loop-Data-Analytics-**

Live URL: **https://nascar-loop-data-analytics.vercel.app**

---

## CRITICAL SECURITY CONSTRAINT — NEVER CHANGE

```js
// src/App.js line ~49
const [isSubscriber] = useState(true)
```

This line must remain **verbatim** at all times. It gates subscriber-only pages. Do not refactor it, rename it, or make it dynamic under any circumstances.

---

## Tech Stack

- **React** (Create React App) — frontend
- **Vercel** — hosting + serverless functions (`/api/*.js`)
- **Supabase** — Postgres database (accessed via `@supabase/supabase-js`)
- **react-router-dom** — client-side routing
- **No Redux** — all state is local useState/useEffect

Environment variables (set in Vercel dashboard):
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_APP_ADMIN_PASSWORD`

---

## File Structure

```
/
├── api/                          # Vercel serverless functions
│   ├── load-race.js              # Loads loop data race results into Supabase
│   ├── load-qualifying.js        # Loads qualifying results from Racing Reference
│   ├── load-qualifying-order.js  # Loads draw/pill order from Jayski PDFs
│   ├── load-fastest-laps.js      # Loads fastest lap data per race into fastest_laps table
│   ├── jayski.js                 # Fetches Jayski qualifying order PDF
│   └── odds.js                   # Betting odds (unused/hidden)
│
├── src/
│   ├── App.js                    # Routes + isSubscriber gate (DO NOT TOUCH line ~49)
│   ├── components/
│   │   └── Nav.js                # Navigation bar with dropdown menus
│   ├── pages/
│   │   ├── Admin.js              # Admin control panel (password protected)
│   │   ├── Landing.js            # Home page
│   │   ├── LoopData.js           # Entry list + race finish history table
│   │   ├── PracticeReportCard.js # Practice session grader output (subscriber)
│   │   ├── LapComparison.js      # Lap-by-lap heatmap comparison (subscriber)
│   │   ├── PracticeLapTable.js   # Raw practice lap data table (subscriber)
│   │   ├── QualifyingCenter.js   # Qualifying heatmap + simulation (subscriber)
│   │   ├── FastestLap.js         # Historical fastest lap heatmap (subscriber)
│   │   └── OddsPage.js           # Betting odds page (hidden from nav)
│   └── lib/
│       ├── supabase.js           # Supabase client init
│       ├── excelParser.js        # Parses NASCAR Loop Data Excel files
│       ├── practiceGrader.js     # V5 grading model for practice sessions
│       └── trackSimilarity.js    # Track correlation logic for qualifying sim
```

---

## Routes (src/App.js)

| Path | Component | Gated? |
|------|-----------|--------|
| `/` | Landing | No |
| `/practice` | PracticeReportCard | isSubscriber |
| `/lap-comparison` | LapComparison | isSubscriber |
| `/lap-table` | PracticeLapTable | isSubscriber |
| `/loop-data` | LoopData | No |
| `/qualifying` | QualifyingCenter | isSubscriber |
| `/fastest-lap` | FastestLap | isSubscriber |
| `/admin` | Admin | Password (REACT_APP_ADMIN_PASSWORD) |
| `/odds` | OddsPage | isSubscriber (hidden from nav) |

---

## Supabase Tables

### `featured_weekend`
Stores the currently active race weekend configuration.
- `id`, `series`, `race_name`, `track`, `race_id`, `year`, `correlation_group_label`, `correlation_years` (array), `sim_enabled` (bool)

### `entry_list`
Driver/team entry list for the featured weekend.
- `id`, `car_number`, `driver`, `organization`, `practice_group`, `series`

### `practice_laps`
Raw lap times uploaded from NASCAR Loop Data Excel.
- `id`, `race_id`, `driver`, `car_number`, `lap_number`, `lap_time`, `starting_position`, `practice_group`, `series`, `year`

### `qualifying_results`
Historical qualifying results (2022-2026, loaded from Racing Reference).
- `id`, `race_id`, `driver`, `qualifying_position`, `qualifying_time`, `series`, `year`, `track`

### `fastest_laps`
Historical fastest lap data per race, loaded from Lap Raptor.
- `id`, `race_id`, `driver`, `car_number`, `fastest_lap_num`, `fastest_time`, `fastest_speed`, `series`, `year`, `created_at`

### `tracks`
Track metadata including correlation groupings.
- `id`, `name`, `correlation_group_label` (e.g., `'superspeedway'`, `'short_track'`, `'intermediate'`, `'road_course'`)

---

## Admin Panel (Admin.js)

Password-protected page at `/admin`. Contains these components (all top-level functions rendered in the Admin return):

1. **WeekendConfig** — Set the featured weekend (series, track, race ID, correlation group/years, sim toggle)
2. **EntryListManager** — Paste/upload the entry list for the weekend
3. **LoadQualifyingPdf** — Upload a Jayski qualifying order PDF; calls `/api/load-qualifying-order`
4. **LoadNewRace** — Upload NASCAR Loop Data Excel; parses via `excelParser.js`, inserts into `practice_laps`
5. **LoadFastestLaps** — Paste Lap Raptor Lap Performance data (Ctrl+A then Ctrl+C from the rendered page); calls `/api/load-fastest-laps`

### LoadFastestLaps — parseSource format

The `parseSource` function inside `LoadFastestLaps` handles three input formats:
1. **HTML table** — from Ctrl+U page source
2. **Tab-separated** — from Ctrl+A on the rendered `?report=lap_performance` page (primary format). 14 cols with manufacturer, 13 without: Driver, Car, [Manu], Start, Finish, Status, ARP, FastestLap, FastestTime, P50, P95, FastestSpeed...
3. **Regex fallback** — space-separated "1 Kyle Larson 168.080 53.546"

---

## QualifyingCenter — Simulation Logic

Located in `src/pages/QualifyingCenter.js`. Key concepts:

- Pulls `qualifying_results` for the correlated track group + years configured in `featured_weekend`
- `historicalPositions` builds a per-driver distribution of historical qualifying spots
- `runSimulation` runs N iterations, applying a draw-order nudge (oval tracks only) weighted by historical draw position
- Correlation group labels come from `tracks.correlation_group_label` — set via Supabase SQL
- Road course tracks form their own correlation group and do NOT get the oval draw nudge

---

## practiceGrader.js — V5 Model

Grades NASCAR Cup practice sessions from Loop Data Excel files. Key metrics:
- **stintAvgPace** — average lap time within stints (consecutive laps), excludes outlaps
- **stintConfidence** — how consistent the stint paces are
- **longestStintLen** — display-only, longest consecutive lap run
- **speed** — raw lap speed
- Outputs letter grades (A-F) + overall score per driver

---

## Key Patterns

### GitHub commits via CM6 editor
The GitHub web editor (CodeMirror 6) can be driven programmatically:
```js
const view = document.querySelector('.cm-content').cmTile.view;
view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newContent } });
// Then click "Commit changes..." button
```

### Fetching files from GitHub API
```js
fetch('https://api.github.com/repos/RkyMtnLSX/NASCAR-Loop-Data-Analytics-/contents/src/pages/Admin.js')
  .then(r => r.json())
  .then(d => ({ sha: d.sha, content: atob(d.content.replace(/\n/g,'')) }))
```

### Vercel deployments
- Check status: https://vercel.com/aaron-masters-projects/nascar-loop-data-analytics/deployments
- If builds break: find last Ready commit in deployment list and use that as the base
- Failures are almost always JSX syntax errors in Admin.js or QualifyingCenter.js

### Supabase client
```js
// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
)
```

---

## Things to Know

- **OddsPage** exists but is hidden from nav — waiting for a betting API integration
- **Correlations** page is a stub ("coming soon") — not yet built
- The `tracks` table `correlation_group_label` must be set manually in Supabase SQL for new tracks
- `qualifying_results` has data for 2022-2026 loaded from Racing Reference
- `fastest_laps` has 2022-2025 historical data; 2026 races loaded manually via Admin as they occur
- The `series` field throughout uses values: `'cup'`, `'oreilly'`, `'trucks'`
- All years arrays in `featured_weekend.correlation_years` are Postgres integer arrays


---

## Where the full docs live (added 2026-07-09)

**Data-pull scripts (the Python scrapers on the operator's machine) are documented in
`PITBOARD_SCRIPTS.md` at the repo root — prerequisites (notably the SUPABASE_KEY service-role
requirement), the weekly ritual, every script, and the failure-mode table. Pipeline operations go
there, not in BACKTEST_LOG.md.**


The COMPLETE handoff doc (`pitboard.md`) and the backtest evidence (`BACKTEST_LOG.md`, 2026-08-03
onward; earlier seasons' entries in `BACKTEST_ARCHIVE.md`, closed 2026-08-24)
are now IN THIS REPO at the root, synced from the local PitBoard Handoff folder on
2026-07-09. If you are a model session working via the GitHub API: fetch those two files
before touching model logic or re-testing anything. They supersede the summaries in this
file. Local folder and repo copies are kept in sync manually; the repo copies were
hash-verified identical at sync time.

---

## The sim runs outside the browser (added 2026-08-31)

`src/lib/simEngine.js` holds `runRaceSim` and `buildSpeedScores` plus every constant and curve they
need. It was extracted from `src/pages/SimulationCenter.js` unchanged — the code was already pure, it
was just trapped in a React component, which meant no model change could be validated over historical
boards. `__marketValue` and `__teamCutoff` stayed in the page on purpose: they are odds/EV and page
history filtering, not simulation, and the engine has to stay importable from a plain node script.

Two commands, both worth running after ANY edit to the engine or its callers:

    npm run lint:undef    # free-variable check across src/
    npm run sim:smoke     # runs the engine headlessly and checks its invariants

`lint:undef` is not optional politeness. `react-scripts build` COMPILES a page that references a name
which no longer exists — webpack does not flag a free variable — so a moved constant produces a green
build and a runtime crash. That is exactly what happened during the extraction: eight names.

`scripts/loadEngine.js` transforms `simEngine.js` ESM→CJS in memory so node can require it. It reads the
same file the site ships, so a script and the site cannot disagree. No new dependency, no build step.

CALIBRATION YOU MUST NOT MISREAD: the sim's realized DNF count is modulated by the caution preset —
~0.5x the budget at Low, ~0.9x at Medium, ~1.4x at High. This is `wreck-v1.1-cb`, shipped 2026-07-28,
BY DESIGN, and documented in BACKTEST_ARCHIVE. The Caution Rate card says so in the UI. `npm run
sim:smoke` prints the current numbers so a future change to them is visible. Do NOT report this as a
bug — a session did exactly that on 2026-08-31 and had to append a correction.

The OPEN question, which is different: both `dnfRate` and the caution preset are auto-set from the same
track's long-run history, so the modulation is applied to the track's baseline rather than to a race's
deviation from it. Result: most cup tracks sim somewhat below their own measured attrition (schedule
bias about -2.27 cars per race). Four parameterizations were tested against a pre-registered holdout
and NONE shipped — see BACKTEST_LOG 2026-08-31, and do not reopen it on the strength of the tier
tables there: DNF calibration improves and the forecasts do not.

TALLADEGA IS FIXED (shipped). It was a separate defect, not part of the above. Superspeedways carry a
"pinned (calibrated)" note, but the pin only ever set the note — the config loader bucketed SS from its
caution average anyway, and cup Talladega (5.33 mean cautions) fell the wrong side of the hard <6
boundary from Daytona (6.17). It drew the calm wreck pool and simmed 10.4% attrition against 20.9%
measured. `setCautionPreset` now pins SS to Medium for real. Holdout, cup Talladega: DNF 10.4% -> 20.4%,
win Brier .02607 -> .02494, top5 .11890 -> .10932, top10 .20981 -> .18996. It was the ONE SS cell
affected; the other 26 holdout SS races already sat on Medium.

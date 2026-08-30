# PITBOARD DATA-PULL SCRIPTS

Operations doc for the Python scrapers that feed PitBoard from NASCAR's public JSON feeds.
Created 2026-08-30 (operator: *"for all our Python scripts for data pulling for pit board needs
their own MD file"*). **Model evidence goes in BACKTEST_LOG.md; how the pipes work goes here.**

**Where they live:** `C:\Users\atmms\NascarDataScrapperV3\` on the operator's machine.
They are NOT in the repo and NOT serverless — they read `cf.nascar.com` directly, which needs a
real network egress, so they run locally.

---

## 0. PREREQUISITES — read this before anything else

| | |
|---|---|
| Python | 3.x on PATH, with `requests` (`pip install requests`) and `openpyxl` for the sheet builder |
| `SUPABASE_URL` | optional — defaults to the project URL in the scripts |
| **`SUPABASE_KEY`** | **REQUIRED. Must be the SERVICE ROLE key.** |

### Why SUPABASE_KEY is not optional any more

Every script resolves its key as:

```python
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_publishable_...")
```

`races`, `pit_stops`, `pit_penalties` and `loop_data` all have **RLS on**, and every policy on them
is granted to the `authenticated` role only (`admin_all` via `is_admin()`, `subscriber_read` via
`has_access()`). **There is no `anon` policy.** With the publishable key PostgREST answers
`200` with an **empty array** — a success, not an error — so a script reads zero races, reports
"0 points races in registry scope / Nothing to do", and exits clean having written nothing.

That is exactly what happened between 2026-08-23 and 2026-08-30: four race weekends of pit data
went missing with no error anywhere. See **Failure modes** below.

**Setting it (operator only — the key never goes in a file, a repo, or a chat):**

```
setx SUPABASE_KEY "<service role key>"
```

`setx` writes the user environment permanently but does **not** affect terminals that are already
open. Close the terminal and open a new one, then run the `.bat`.

Verify without printing the key:

```
echo %SUPABASE_KEY:~0,6%...      (should print the first 6 chars, not "%SUPABASE_KEY...")
```

---

## 1. THE WEEKLY RITUAL

| When | Action |
|---|---|
| Before practice starts | double-click **CAPTURE_PRACTICE.bat** and leave it running. Laps that happen while it is not running are gone forever — NASCAR only archives best-lap for practice/qualifying. |
| After practice ends | **MAKE_PRACTICE_SHEET.bat** (optionally `cup` / `oreilly` / `trucks`), then upload the .xlsx in PitBoard Admin. |
| After the race, once the loop-data PDF is loaded in Admin | **POST_RACE_UPDATE.bat** — pit stops, then penalties, then race lap archives. ~5-10 min. Leave it open until all three summaries print. |

**Rule: the `.bat` files are the buttons. Never double-click a `.py`** — it runs with default args
and closes on completion, so you never see the summary.

---

## 2. THE SCRIPTS

### `pitboard_pit_backfill.py` — pit stops → `pit_stops`
Loads raw NASCAR pit telemetry (`cacher/live/series_{s}/{race}/live-pit-data.json`, populated 2018+;
we ingest 2022+ per era rules). **Driven from the `races` registry**, so canonical `track_name`,
season `race_number`, `race_id` FK, the 2022 era floor and the exhibition exclusion are inherited
rather than re-derived. Registry row → NASCAR race id by `race_date ±1 day`, then a canonical-track
positional fallback. Idempotent: DELETE by `race_id`, then INSERT.

```
python pitboard_pit_backfill.py --year 2026              # default
python pitboard_pit_backfill.py --year all               # 2022-2026
python pitboard_pit_backfill.py --series trucks
python pitboard_pit_backfill.py --race-id 481            # one race
python pitboard_pit_backfill.py --year 2026 --dry-run    # no writes
```
Wrappers: `PIT_BACKFILL_2026.bat`, `PIT_BACKFILL_ALL_YEARS.bat`, `PIT_BACKFILL_DRYRUN.bat`.
One-time setup: run `pit_stops_schema.sql` in the Supabase SQL editor.

### `pitboard_penalties_backfill.py` — pit-road penalties → `pit_penalties`
Parses penalty calls out of race-control lap notes (`cacher/{year}/{series}/{race}/lap-notes.json`).
v2 classifies on each car's FULL text segment and trims only for storage — v1 trimmed to 8 words
first and lost keywords in verbose prose. Re-running is safe (delete-then-insert).

```
python pitboard_penalties_backfill.py --year 2026 | --year all | --dry-run
```
Wrapper: `PENALTIES_BACKFILL_ALL.bat`. One-time setup: `pit_penalties_schema.sql`.

### `pitboard_practice_capture.py` — live lap capture (v4)
Polls `live-feed.json` every ~4s while any session is live, for all three series at once, and
records each car's lap as `laps_completed` ticks up. Necessary because during practice/qualifying
the per-lap archive does not exist (`lap-times.json` is 403 during sessions); it is only created
when the RACE runs. v4 fixed serial-poll poisoning (one dead feed used to starve the live series),
tightened cadence 8s → 4s, and reconstructs gaps from `vehicle_elapsed_time` so averages stay exact
through feed stalls.

```
python pitboard_practice_capture.py --watch [--minutes 600]   # CAPTURE_PRACTICE.bat
python pitboard_practice_capture.py --race                    # race lap archives (step 3 of post-race)
```
Output: `{YYYYMMDD}_{series}_{track}_{run}_laps_FULL.csv` in the script folder.

### `pitboard_practice_sheet.py` — capture CSV → practice sheet
Converts a `*_laps_FULL.csv` into `POS | Driver | AVG LAP | LAP 1..N`. Flying laps only (drops laps
> 1.2× that driver's median, and anything outside 5-300s), laps renumbered sequentially, drivers
sorted by AVG LAP. Writes .xlsx when openpyxl is present, else .csv — the site parser reads both.
A second worksheet `LAPS_RAW` carries every sane lap with ORIGINAL lap numbers plus `captured_at`
timestamps; the site parser prefers it when present.

```
python pitboard_practice_sheet.py                 # newest capture in the folder
python pitboard_practice_sheet.py <file.csv>
python pitboard_practice_sheet.py --series cup
```
Wrapper: `MAKE_PRACTICE_SHEET.bat [series]`.

### `nascar_extract_v3.py` — the original extractor
Broad tool: `auto`, `list`, `today`, `sessions`, `export`, `live`, `laps`, `pits`, `post`.
Wrappers `RUN_AUTO.bat` and `RUN_LIVE_TONIGHT.bat` (the latter has a hardcoded race id — edit before
use). Superseded for the weekly ritual by the scripts above; kept for ad-hoc pulls.

---

## 3. FAILURE MODES

| Symptom | Cause | Fix |
|---|---|---|
| `0 points races in registry scope ... Nothing to do.` and a clean exit | `SUPABASE_KEY` unset → publishable/anon key → RLS returns an empty array, which is a SUCCESS | `setx SUPABASE_KEY "<service role key>"`, new terminal, re-run. **Guarded since 2026-08-30** — the scripts now probe `races` first and exit with this explanation instead of reporting a zero count. |
| `Supabase DELETE ... failed [401/403]` | key can read but not write | same fix — it must be the service role key, not anon |
| `0 pit rows (date-matched nascar_id=...)` for one race | NASCAR has no pit feed for that race | not a bug. Street courses and some short-field races have no `live-pit-data.json`. Confirm on the feed before chasing it. |
| `no race within 4 days - skip` in step 3 | that series did not race this weekend | expected |
| Practice laps missing for a session | the watcher was not running during it | unrecoverable — NASCAR keeps best-lap only. Launch CAPTURE_PRACTICE.bat before the session. |

---

## 4. OUTSTANDING BACKFILL (as of 2026-08-30)

Four races have loop data but no pit stops or penalties — every weekend processed after the
2026-08-23 RLS lockdown:

| series | race | date |
|---|---|---|
| trucks | R18 New Hampshire | 2026-08-22 |
| cup | R25 New Hampshire | 2026-08-23 |
| oreilly | R24 Daytona | 2026-08-28 |
| cup | R26 Daytona | 2026-08-29 |

One `POST_RACE_UPDATE.bat` run with `SUPABASE_KEY` set fills all four (the loaders are idempotent
and sweep the whole season, not just the last race).

Separately, five older 2026 races have zero pit stops and predate the lockdown — trucks R3
St. Petersburg, trucks R5 and oreilly R8 Rockingham, trucks R14 Lime Rock, trucks R16 IRP. Some
carry penalties, so they were reachable at the time; these look like races with no NASCAR pit feed
rather than a permissions failure. Check them once, after the four above are in.

---

## 5. STANDING RULES

- **No secrets in any file, repo, or chat.** Keys live in the operator's environment only. Every
  script reads `SUPABASE_KEY` from `os.environ`; the in-file fallback is the public publishable key
  and is deliberately not privileged.
- **The `.bat` files are the buttons.** Never double-click a `.py`.
- **Loaders are idempotent** (delete-then-insert by `race_id`), so re-running a season is always
  safe and is the normal way to repair a gap.
- **A count is not a status.** Any query whose empty result could mean "not permitted" must assert
  its preconditions rather than report a zero — that is what cost four races here.

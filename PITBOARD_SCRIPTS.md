# PITBOARD DATA-PULL SCRIPTS

Operations doc for the Python scrapers that feed PitBoard from NASCAR's public JSON feeds.
Created 2026-08-30. Section 6 (race loading from NASCAR's feeds) added the same day.
(operator: *"for all our Python scripts for data pulling for pit board needs
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

**Setting it — double-click `SET_KEY.bat`.** It prompts, hides your typing, and writes the key to
your Windows user environment with `setx`. The key never goes into a file, a repo, or a chat, and
this is a ONE-TIME step — after it, `POST_RACE_UPDATE.bat` works on its own every week forever.

Equivalent by hand if you prefer:

```
setx SUPABASE_KEY "<service role key>"
```

Either way: `setx` writes the user environment permanently but does **not** affect terminals that
are already open. **Close the window and open a fresh one**, then run the `.bat`.

Verify without printing the key:

```
echo %SUPABASE_KEY:~0,6%...      (should print the first 6 chars, not "%SUPABASE_KEY...")
```

---

## 1. THE WEEKLY RITUAL

| When | Action |
|---|---|
| Once, ever | **SET_KEY.bat** — paste the service role key. Without it every loader silently writes nothing (see §0). |
| Before practice starts | double-click **CAPTURE_PRACTICE.bat** and leave it running. Laps that happen while it is not running are gone forever — NASCAR only archives best-lap for practice/qualifying. |
| After practice ends | **MAKE_PRACTICE_SHEET.bat** (optionally `cup` / `oreilly` / `trucks`), then upload the .xlsx in PitBoard Admin. |
| After the race | **Admin -> Load Data -> Load Race from NASCAR Feed** (see §5). No paste, no PDF. |
| Then | **POST_RACE_UPDATE.bat** — pit stops, then penalties, then race lap archives. ~5-10 min. Leave it open until all three summaries print. |

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

**It also reconciles `loop_data.car_number` (added 2026-08-30).** After the stops for a race are
inserted, the pit feed's car numbers are pushed back onto `loop_data`. This exists because
`loop_data.car_number` is stamped at load time from the **entry list**, which is a *pre-race
intention*, while the pit feed is *race-day truth* — and they legitimately disagree when a driver
swaps cars after failing to qualify. Real case, trucks New Hampshire R18 2026: **Dawson Sutton was
entered in the 27, DNQ'd, and raced the 26** after Toni Breidinger was pulled from it; **Luke Baldwin
was entered in the 2, DNQ'd, and raced the 33** after Frankie Muniz stepped out. The crew key is
car + organization + season, so the entry-list number files those stops under a crew that never
touched the truck.

Rules it follows: the pit feed wins; a loop row is only touched when its driver resolves to exactly
**one** car number in that race's feed; resolution is exact → suffix/punctuation-stripped → prefix →
unique first-initial+surname (so "Mike Christopher, Jr." finds "Michael Christopher Jr.", and
"Andres Perez" finds "Andres Perez De Lara"). Every change prints, and a swap prints loudly:

```
  car_number reconciled: 2 filled, 2 SWAPPED  (trucks 2026 R18 New Hampshire Motor Speedway)
      SWAP Dawson Sutton: entry #27 -> raced #26
      SWAP Luke Baldwin: entry #2 -> raced #33
      fill Mike Christopher, Jr.: #72
```

**Read those SWAP lines when they appear.** They are rare and they mean a driver changed cars —
worth knowing for its own sake, not just as a data repair. Races with no pit feed keep the entry-list
number; there is no second source for them.

### `pitboard_penalties_backfill.py` — pit-road penalties → `pit_penalties`
Parses penalty calls out of race-control lap notes (`cacher/{year}/{series}/{race}/lap-notes.json`).
v2 classifies on each car's FULL text segment and trims only for storage — v1 trimmed to 8 words
first and lost keywords in verbose prose. Re-running is safe (delete-then-insert).

```
python pitboard_penalties_backfill.py --year 2026 | --year all | --dry-run
```
Wrapper: `PENALTIES_BACKFILL_ALL.bat`. One-time setup: `pit_penalties_schema.sql`.

#### v3 (2026-08-31) — USE THIS ONE. `pitboard_penalties_backfill_v3.py`

Two changes. Click `PENALTIES_FIX_ALL_YEARS.bat` (all seasons, 10-20 min) or
`PENALTIES_FIX_2026.bat` (current season only). Both run `test_penalties_v3.py` FIRST and abort
before touching the database if any check fails — that is the stand-in for a dry run.

**1. A 4th category, `grid`.** Pre-race calls: "To the rear: #4, #22 (unapproved adjustments)",
tail-end-of-field, failed inspection. v2 had no vocabulary for these and recorded ZERO of them —
2022-2025 sat at 0 while the notes carried ~150-175 per season. They are NOT crew and NOT driver:
unapproved adjustments is a technical call against the team's setup, and the Pit Crew Rankings add
1.75s per CREW penalty, so mixing them in would demote crews for what the engineers did.

Why they matter beyond bookkeeping: a car sent to the rear appears at its QUALIFIED spot in both
`loop_data.start_position` and `qualifying_results.qualifying_position`. Verified at cup 2026
Kansas R9 — the notes say #22 went to the rear, his recorded start is 15th in a 37-car field. The
backtest reads `loop_data.start_position` (confirmed by matching holdout.txt against the DB), so
those driver-races carry a wrong start. Cup 2026: 30 of 39 lap-0 grid calls show start == qual,
average qualifying spot 25.7 in a 37.6-car field. Roughly 3% of driver-races, off by ~10 spots.

**2. Multi-car sentences.** v2 only saw a penalty whose keyword FOLLOWED the car number, and
credited only the cars whose own text segment carried it. v3 adds leading context (first car
only), list-member inheritance, and a whole-sentence fallback. Recovery is modest and consistent:
crew +3 to +8 per season, driver +15 to +30.

**THE TRAP, and it is in the test suite now.** Older lap notes list every car that pitted before
naming the one penalised:

> `#41, #43, #19, ... #3, #42, #47 all pit with two to go #42 penalized for crew over the wall too soon`

Only #42 earned it. An uncapped list-inheritance handed a crew penalty to all 21 and DOUBLED crew
for 2022-2024 (avg 8-10.6 cars per multi-car sentence, max 21). It looked fine on 2026 because
modern notes do not use that style. Fixed with a 6-car cap plus a requirement that an unresolved
car be joined to a resolved MENTION by an unbroken chain of separators. Post-fix: avg 2.2-2.8 cars,
max 4-5. Four of those real sentences are permanent regression cases in `test_penalties_v3.py`.

**Never trust a parser change validated on one season.** Note style varies by era, and 2026 is the
one that hides this failure.

`POST_RACE_UPDATE.bat` still calls v2. Switch it to v3 once you have seen a clean weekend run.

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

---

## 5. RACE LOADING MOVED TO NASCAR'S FEEDS (2026-08-30)

**The Racing Reference Ctrl+A/Ctrl+C paste is no longer the source for race loading.**
Admin -> Load Data now has **Load Race from NASCAR Feed** and **Feed Backfill**.

### Why

The paste parser broke three times in seven weeks (2026-07-12, 2026-07-26, 2026-08-14) as Lap
Raptor changed the table layout, and the 08-14 redesign **dropped mid-race position, laps completed
and driver rating site-wide** - the fallback regex writes them as NULL. NASCAR's own JSON has no
layout to change.

Verified against cup 2026 R26 Daytona before anything was written: all 15 loopstats fields reproduce
`loop_data` exactly for 40/40 drivers, car numbers 40/40, qualifying position 40/40, qualifying speed
exact, and the race-level cautions / caution laps / lead changes / average speed all equal what the
paste had stored. A full sweep found **100% coverage of every points race in all three series back
to 2022**, so history is reachable, not just new races.

### What it fixes that the paste got wrong

| | |
|---|---|
| `total_laps` | held **scheduled** laps. **142 of 436 races** have a driver who completed more laps than the race supposedly had (R26: 160 stored, 166 run; one race stored 0). `finish_status` is derived from that number, so DNF flags were wrong wherever a race went to overtime. Now actual laps, with the scheduled figure kept in `scheduled_laps`. |
| `finish_status` | was a `laps < 90% of total` guess. The feed states it - Hocevar and Erik Jones both wrecked out at Daytona and were stored as "running". Stored lowercased, so SimulationCenter's existing `fs && fs !== 'running'` DNF test keeps working. |
| precision | `avg_position` and `driver_rating` were rounded (9.59 -> 10.00). |
| `margin_of_victory` | numeric column, so a caution finish parsed to NULL. The verbatim string now goes to `margin_of_victory_text`. |

### What it adds

- **`nascar_driver_id`** on `loop_data` - the same identifier `pit_stops` already carries on 80,978
  rows. This is the join that removes name matching from the pipeline.
- **`closing_ps`** - average running position over the closing laps. The only feed field not
  derivable from something we already store. Pre-registered as a study in BACKTEST_LOG.md before the
  column existed; **no model uses it until that holdout is read.**
- **`team_name`** on `loop_data` for all 436 races (pit_stops has it for the 414 with a pit feed).
- **`stage1_finish` / `stage2_finish`** - null on all 16,130 rows until now. The feed publishes the
  points-paying top ten only, so drivers outside it stay null. That is the feed's shape, not a
  failure.
- **`races.nascar_race_id`** - the pit loader currently re-derives this every run by date matching
  with a positional fallback. Stored once, that guesswork can go.

### A trap worth recording

`loop_data.driver_id` is a **FOREIGN KEY to `drivers(id)`** - our own 37-row surrogate table with ids
1..37. It is NOT a NASCAR id. NASCAR's driver ids run 34..4554, so writing them there would have
failed the FK on nearly every row and, for the one NASCAR id that falls inside 1..37, **silently
pointed the row at the wrong driver instead of erroring.** The NASCAR id has its own column.

### How the two panels work

**Load Race from NASCAR Feed** - pick series/year/race number/date, *Find race* (resolves the NASCAR
race id from the schedule, +/-1 day, and refuses to guess if the match is not unique), *Fetch &
preview* (full table, with any name it could not match to an existing spelling flagged), *Load*.

**Feed Backfill** - repairs races already stored. Defaults to all three series, all seasons, dry run.
**Run it dry first and read the log.**

Rows are matched on **finish position** - unique within a race, so it is an exact key, and no name
matching happens in this path. It is deliberately NOT a strict bijection: 10 of 436 races are
missing a driver from `loop_data` (38 rows but positions running to 39). Those gaps are *preserved*
rather than renumbered, which is what proves both sides still mean the same positions, so requiring
set equality would skip ten repairable races for nothing. What is required is that our positions are
unique and a subset of the feed's.

The real guard is a **name cross-check on every row**: if the stored name and the feed's name at the
same finish position do not fold-match, that row is **left untouched** and printed. If more than 20%
of a race's rows disagree, the whole race is skipped - which is what a renumbering would look like.
Existing rows are read in full and merged, so no column can be nulled by omission.

Expected before the first run: 426 of 436 races are clean 1..N, 0 have duplicate or null finish
positions, and 142 will report a `total_laps` correction.

### Where the writes happen

`api/nascar-feed.js` only fetches and shapes, because the browser cannot reach `cf.nascar.com`
(no CORS). **Every write is done by the browser through the operator's own authenticated Supabase
session**, exactly as the paste path did. That endpoint holds no service-role key, performs no
writes and touches no table, so RLS enforces what it always has and no privileged write surface
appears on the public internet. It is not an open proxy either - every URL comes from a fixed
template with range-checked integer parameters.

### Still manual

- **Jayski pill-draw PDF.** The feed's `qualifying_order` is the order cars went out to qualify, NOT
  the draw. Checked: Chastain is 1 in the feed and 9 in our `draw_order`, Buescher 13 vs 29. Different
  quantities. `qualifying_order` does fill a column we only have on 1,980 of 6,093 rows.
- **Lap Raptor fastest-lap paste.** Different source. `lap-times.json` may cover it; unverified.

### When NASCAR publishes no weekend feed

Some races have complete loopstats and an **empty weekend feed** — the file exists but
`weekend_race` and `weekend_runs` are both `null`. Confirmed on cup 2025 R34 Talladega, oreilly
2024 R7 Martinsville and trucks 2022 R5 Martinsville.

Loopstats is treated as the spine and the weekend feed as an enrichment, so those races still load:
the 15 loop columns, `closing_ps`, `nascar_driver_id`, full-precision average position and rating,
and the scheduled-vs-actual lap correction all come from loopstats alone. What is unavailable —
car number, team, finish status, stage results, and the race-level cautions / lead changes /
average speed / margin — is **left exactly as stored**, never blanked.

The mechanism is a deliberate `undefined` vs `null` distinction in `src/lib/nascarFeedMap.js`:
`undefined` means *unknown, do not touch*; `null` means *the feed answered and had nothing there*.
The backfill merges with `?? stored` on every weekend-sourced field and strips `undefined` keys from
the race-level update.

Alignment is still verified in that case — the resolver's first rung maps a NASCAR driver id to the
name we already hold for it, so rows are checked against ids learned from other races. A race where
fewer than half the drivers have a known id is skipped. The check degrades; it does not disappear.

### A defect the feed backfill exposed: one wrong race_date, three consequences

**trucks 2022 R5 Martinsville carried `race_date` 2022-03-26 — which is COTA's date.** Everything
below followed from that single wrong field:

1. `pitboard_pit_backfill.py` matches a registry race to a NASCAR race by `race_date` +/-1 day, so
   it bound Martinsville to NASCAR race **5221 (XPEL 225, Circuit of The Americas)** and loaded
   **COTA's 117 pit stops under Martinsville**. Verified duplicates: 117 rows on each race, all 117
   identical, none unique to Martinsville. Laps 0-42, under a race scored at 200 laps.
2. Seeding `races.nascar_race_id` from `pit_stops` then propagated 5221 onto the race row.
3. The feed backfill's name cross-check refused to write the race — **which is how this surfaced.**

Corrected to NASCAR's own schedule: **5222, "Blue-Emu Maximum Pain Relief 200", 2022-04-07.** The
117 wrong stops were deleted; they already exist correctly under COTA, and Martinsville's real pit
data was never loaded at all. **Re-run `PIT_BACKFILL_ALL_YEARS.bat` to fetch it now that the date is
right.**

Checked across the whole database afterwards: **no other race shares a `nascar_race_id`, and no two
races in the same series and season share a date.** This was the only instance.

The lesson for the loaders: date matching is only as good as the date. A same-day, same-series pair
is the exact condition under which +/-1 day matching silently binds the wrong race, and nothing in
the pit loader could have noticed — the stops it wrote were internally consistent. It took a second
independent source disagreeing about *who finished where* to expose it.

### Caution timing and stage boundaries (added 2026-08-30)

`caution_segments` holds every caution's `start_lap`, `end_lap`, `reason`, `comment` and
`beneficiary_car_number`, with **`restart_lap`** and `caution_laps` as generated columns. 3,036
segments across 434 races. Cross-checked on capture: the per-race segment count agrees with
`races.total_cautions` — a different field from the same feed — **434 of 434, zero disagreements.**

This existed nowhere before. `pit_stops` cannot substitute: tested on cup 2026 R26 (true cautions
36-43, 97-101, 156-164, 166), yellow-flag pit stops recover roughly when a caution STARTED and never
when it ENDED, and the race-ending caution has no stops at all. The restart lap is the whole point.

**TRAP — stage laps are LENGTHS, not end laps.** NASCAR publishes `stage_N_laps` as the length of
stage N. They sum exactly to `total_laps` including overtime — verified 434/434 (R26 Daytona
35+60+71 = 166 against 160 scheduled). **SimulationCenter uses the opposite convention**; its own
hint reads *"published stage END laps (e.g. Stages 70/210/350 -> enter 70 and 210)"*. Stage 1 is the
same number either way, so a mismatch looks correct at a glance and is wrong from stage 2 on: R26
stage 2 ends on lap 95, not 60.

Both readings are stored and neither can drift: **`stage_N_laps` = length as published,
`stage_N_end` = the lap the stage ends on (generated, and what the sim means).** Using the right one
took identified stage-end cautions from 64 to 778.

Why it was captured: SimulationCenter's stage inputs are labelled *"captured with the sim for the
future caution/pit layer, do not affect results yet"* — that layer had no training data. It does now.
**No model uses any of this yet.**

### Egress

`cf.nascar.com` is reachable from **Vercel** (measured 107ms from iad1) and from the operator's
native Windows shell. It is **blocked** from the cloud container and from the desktop bridge's Linux
VM. So: race loading runs in the browser/Vercel, and the Python loaders run natively.

### Verifying a change

`node scripts/verify-feed-mapping.js` runs the real mapping in `src/lib/nascarFeedMap.js` against a
fixture of real R26 rows and compares every derived value to what the database holds. No network, no
database. Run it after touching that file.

## 6. STANDING RULES

- **No secrets in any file, repo, or chat.** Keys live in the operator's environment only. Every
  script reads `SUPABASE_KEY` from `os.environ`; the in-file fallback is the public publishable key
  and is deliberately not privileged.
- **The `.bat` files are the buttons.** Never double-click a `.py`.
- **Loaders are idempotent** (delete-then-insert by `race_id`), so re-running a season is always
  safe and is the normal way to repair a gap.
- **A count is not a status.** Any query whose empty result could mean "not permitted" must assert
  its preconditions rather than report a zero — that is what cost four races here.

# PITBOARD MANUAL
Stable operating rules. Edit ONLY when a rule actually changes. Session start: read this + PITBOARD_STATE.md (~5k tokens total). The archives — pitboard.md (operational log, ~68k tok), BACKTEST_LOG.md (model evidence 2026-08-03 onward, ~48k tok), and BACKTEST_ARCHIVE.md (model evidence season-start through 2026-07-28, ~86k tok, CLOSED — never append) — are append-only history: SEARCH them for specific answers, never read in full. Topic docs (read when the topic is live, not at session start): STRIPE_CUTOVER.md (sandbox->live launch runbook + domain-change impact, 2026-08-29); scripts/README.md (running the sim headlessly in node — setup, the two mandatory checks, what each backtest script answers, and the reconstruction's known weaknesses; 2026-08-31); PITBOARD_SCRIPTS.md (the local Python data-pull scripts — prerequisites incl. the SUPABASE_KEY service-role requirement, weekly ritual, per-script reference, failure modes; 2026-08-30). Pipeline operations belong in PITBOARD_SCRIPTS.md, NOT in BACKTEST_LOG.md.

## What this is
PitBoard — NASCAR betting + DFS analytics product approaching subscriber launch. Operator: Aaron (atmmstrs2@gmail.com; master admin uid d7a9f822-1237-4660-9e17-0b8b526e3c44; DK username atmmstrs2). Stack: React CRA on Vercel (https://nascar-loop-data-analytics.vercel.app) + Supabase (https://dqexnylexbypjtiuctxd.supabase.co, publishable key sb_publishable_pVrtVEoQD1i9LiIvaXhS4g_ZDaUUccj). Repo: RkyMtnLSX/NASCAR-Loop-Data-Analytics- (main branch, Vercel auto-deploys). Local scraper cockpit: NascarDataScrapperV3 folder (practice watcher w/ per-lap timestamps, sheet builder w/ LAPS_RAW tab, penalties backfill).

## Writing to GitHub — pick the path your session actually has (rewritten 2026-08-31)

There are THREE write paths. Which one you have depends on the session, not on preference, and
two sessions disagreeing about "the only way" usually means each had a different toolset. Check
in this order:

| condition | path | what it is |
|---|---|---|
| `mcp__remote-devices__device_bash` present | **B — PATCH VIA THE OPERATOR'S PC** | preferred |
| Chrome connected, no device bridge | **A — GITHUB CONTENTS API** | fallback |
| session created WITH the repo attached | **C — plain `git push`** | rare here |

**Prefer B whenever the device bridge is up.** It is one atomic operation per COMMIT: real message,
real history, and git confirms the SHA so you know it landed. A is per FILE — a six-file change is
six GET/edit/verify/PUT/poll cycles, and if the blob SHA moves between the GET and the PUT you start
that file over.

**What is actually blocked in a Cowork sandbox is the GIT PROTOCOL, not writing.** The proxy refuses
any repo not attached at session creation, and a repo cloned by hand inside a running session is
never attached:

    remote: access denied by the git proxy: RkyMtnLSX/NASCAR-Loop-Data-Analytics- is not in this
    session's authorized repository set, so the proxy will not inject a credential for it.

The error says to "add the repository to the session's sources." **There is no such control** — no
UI, no slash command, no config. Do not go looking; a session burned an hour on 2026-08-31 doing
exactly that, and a user-supplied PAT does not help because the proxy blocks the write before it
reaches GitHub. READS work fine (`git ls-remote`, `git fetch`), so it presents as an auth failure
and is not one. **But path A goes over HTTPS from a browser and never touches that proxy** — the
first version of this section said a Cowork session "CANNOT push to this repo" full stop, which
generalised one dead end into a rule and is how the two-sessions-disagreeing problem started.

### PATH B — patch via the operator's PC (preferred)

**`device_bash` HAS NETWORK. It clones from and pushes to github.com.** Verified end to end on
2026-09-02: `git clone https://github.com/...` into `/tmp`, `git am`, `git push` — two commits
landed that way (`81dce8f..308199a`, `308199a..d10960f`). If you are about to tell the operator
that path B needs him to run three lines himself, you are about to be wrong, and he has had to
correct a session on exactly this.

Two true facts get combined into a false one, so state them separately:

- The device shell is a **Linux VM with his folders mounted**, not his Windows environment, and it
  is NOT sitting in his Windows clone. TRUE — and irrelevant. **You do not need his clone.** Clone
  the repo fresh inside the VM at `/tmp/pb2`, `git am` the patch there, push from there. His clone
  is never touched and never needs to be.
- The **cloud sandbox's** git proxy refuses this repo. TRUE, and separate. That is the sandbox, not
  the device shell. Do not generalise it into "I have no route with network + write."

If some OTHER host tool has no network from the device shell (a data feed, an API), that says
nothing about github.com. Test the specific host before concluding anything.

Path A (browser + token) is the FALLBACK. A safety classifier can block a browser script that
combines a raw token with a repo write — that is a guardrail, not a bug to route around, and it is
one more reason to use B, which never puts a token in a page script.

1. Commit in the cloud sandbox as usual.
2. `git format-patch -1 HEAD --stdout > /tmp/x.patch`, `SendUserFile` it, then
   `device_commit_files` it into the PitBoard Handoff folder.
3. In `device_bash`: keep a clone at `/tmp/pb`, `git am` the patch, push with the operator's token
   in the URL. Redact the token from ALL output (`sed -E 's/ghp_[A-Za-z0-9]+/REDACTED/g'`).
4. **Realign the cloud clone**: `git fetch origin && git reset --hard origin/main`. Rebuilt commits
   get new SHAs, so without this the branch looks permanently "ahead" and the unpushed-commit
   warning cries wolf until a real one is invisible.
5. Delete the patch from the Handoff folder — `device_bash` cannot `rm` under mounts until
   `device_request_delete_permission` is granted for that folder.

The device sandbox does not persist, so its clone and any `safe.directory` config are gone next
session; if `/tmp/pb` throws "dubious ownership" or permission errors after a restart, clone fresh
to a new path rather than fighting it. **Batch the pushes** — work the session, push once at the end.

### PATH A — GitHub Contents API from a Chrome tab (fallback, and the long-standing method)

Work from a Chrome tab on a PitBoard-origin page (Vercel-origin pages' fetch wrapper can break
api.github.com calls). Operator provides the token in chat each session — NEVER written to any file.
If several browsers are connected, ask which one before driving it.

1. GET contents API → decodeURIComponent(escape(atob(content)))
2. Counted split/join edits: `if (s.split(anchor).length !== 2) throw` — never blind-replace
3. Babel-standalone verify (cdnjs, presets [['env',{modules:false}],'react']) BEFORE every PUT
4. PUT with btoa(unescape(encodeURIComponent(s))) + current sha
5. Poll commits/{sha}/status with sleeps <=40s (45s+ hits CDP timeout); builds run ~60-120s
6. Verify the LIVE bundle with FUNCTIONAL string literals (comments are minifier-stripped; regexes
   can match display code ambiguously — verify at source when unsure)

Quirks: the content filter blocks tool OUTPUTS containing = & ? : ; together — sanitize outputs with
replace maps (inputs unaffected). Tabs die frequently — recreate, renavigate, never rely on window.*
state across turns. Supabase REST from browser: publishable key as apikey + operator session
access_token from the localStorage auth-token entry (JWT expires — renavigate to refresh).

### PATH C — plain `git push`

Works only in a session created WITH the repo attached (the desktop app's Code tab: Environment
Cloud, then pick the repository). Cowork sessions are never repo-attached. Worth knowing it exists,
but a Code session may not carry the Supabase/Vercel connectors this project leans on.

## Running the sim outside the browser (added 2026-08-31)
`src/lib/simEngine.js` holds `runRaceSim` + `buildSpeedScores` and every constant they use. The website imports it and so do node scripts, so a backtest and the live site cannot disagree about what the model does. Setup is `git clone` + `npm install` — no DB credentials, no keys; backtest data is committed. Full guide: scripts/README.md.

AFTER ANY CHANGE TO THE SIM OR ITS CALLERS, both of these, every time:
```
npm run lint:undef    # free-variable check across src/
npm run sim:smoke     # engine invariants + ASSERTS attrition is preset-independent
```
`lint:undef` is NOT optional politeness: `npm run build` compiles a page that references a name which no longer exists (webpack does not flag free variables), so a moved constant gives a green build and a page that crashes on load. That happened 2026-08-31 with eight names at once.

Two engine flags are deliberately OFF and unreachable from `src/pages/`: `cautionMix` (tested and REJECTED on holdout) and `skillTilt` (blocked on data). Do not enable either without reading BACKTEST_LOG 2026-08-31.

## Standing rules (non-negotiable)
- NO secrets/tokens/passwords in any file, repo doc, or web form — operator pastes secrets himself. Vercel gotcha: values pasted into the "Note (Optional)" field present as empty env vars.
- Backtest before ship for model changes. When history can't score it (new data), ship gated + prospective protocol with an explicit revert trigger, logged in BACKTEST_LOG.
- PRE-REGISTER MODEL TESTS. This log has used pre-registered-confirmatory discipline since ~July
  (archive #55; explicit in BACKTEST_LOG 2026-08-23) but it was never written here, so whether a
  session followed it depended on searching deep enough to notice. It is a rule, not a convention.
  Before running a holdout: write the frozen form, the gates, and the DECISION RULE into
  BACKTEST_LOG, commit and push, THEN fit and run. Fit on train only; the holdout is read once.
  Three specifics that were each learned the hard way:
  (1) No parameter may be added or widened mid-test — that happened 2026-08-31 with `wideClamp`
      and had to be split out and re-registered as its own arm.
  (2) Gates must include WHERE the effect lands, not just the aggregate. A tilt passed 12/12 on
      aggregate while making the favourites measurably worse priced; only a per-tier table caught
      it. State a per-tier or per-segment rail in the registration.
  (3) Judge every delta against a NULL arm (the control run against itself). Without it a gate is
      unpassable or meaningless — MC noise alone moves most metrics.
  Choosing a form AFTER seeing which arm failed is leakage even when the reasoning is sound. It is
  sometimes still worth doing; say so in the registration rather than presenting it as clean.
- md discipline: code changes, doctrine, and queued work earn entries — no color commentary. Corrections are logged as corrections. Every entry dual-written: repo + local PitBoard Handoff mirror. Update PITBOARD_STATE.md in the same motion when the live picture changes.
- Verify every ship on the live site before reporting done. EXCEPTION (operator, 2026-08-19):
  COSMETIC fixes (labels, colors, sort order, copy) get the light check only - build green +
  string in deployed bundle; operator eyeballs the page himself. Full live-drive verification
  stays mandatory for anything touching money, auth, gating, data writes, or model output.
- Check `date` via bash before narrating day/time.
- Sportskeeda is not a legitimate source.
- STALE-COPY GUARD (2026-08-24 split): before ANY write to BACKTEST_LOG.md, verify the first
  entry header in the copy you are editing is `## 2026-08-03`. If you see July entries, you
  hold a PRE-SPLIT copy — STOP and re-GET; pushing it would resurrect the 129k-token file.
  Contents-API sessions: PUT only with the sha from the same GET as your content (protocol
  rule 3 — the sha check is the enforcement; re-fetching a fresh sha defeats it). Git
  sessions: pull --rebase before push (a conflict is the guard working).

## Data map (Supabase — the quirks that bite)
- loop_data: Racing Reference paste (Admin loop-data box) = full rows incl. laps_completed + driver_rating (old 19-col regex). Lap Raptor new-format paste = real finish_status text but NULL laps_completed/driver_rating. Never paste both for one race (duplicate rows). finish_status before 2026-08-15 is junk ('running' default). DNF definition everywhere: status!='running' OR laps_completed<0.9×winner.
- races: total_laps sometimes 0 (header regex miss) — don't trust blindly. fastest_laps table stores race_date as TEXT MM/DD/YYYY.
- practice_laps: captured_at timestamps exist from 2026-08-14 forward (LAPS_RAW sheets). Practice grading happens AT UPLOAD TIME (Admin.js) — a card only regrades on re-upload.
- Practice sheets: page-1 POS column doubles as the START column on upload — operator overwrites it with the real lineup before uploading. LAPS_RAW tab holds original lap numbers (gaps = stints) + timestamps; never edit it.
- sim_results: per-driver results jsonb + config (with 4k-draw simMatrix sample). sim_matrices: FULL 50k-draw matrix per board (lazy-loaded by Matchup Compare only; boards from 2026-08-15 evening onward).
- DFS: dfs_sim_samples (per-draw DK points, ~10k rows sampled), dfs_salaries (json + __ids for DK export), dfs_ownership (own_pct + official fpts per driver/contest), dfs_contests (field distributions incl. decile scores_sample — accurate to ~±1 rank when interpolated).
- Betting: flagged_bets append-only, one flag per driver+market per stage at first price; my_bets = actual money; clv_log stage-scoped.
- Name-join rule (identical copies in GradeCenter, FlaggedBetsAdmin, MyBetsAdmin; DfsSalaryAdmin adds first+last fallback for DK middle-initials): lowercase → NFD accent-fold → strip non-alphanumerics.

## Paginated Supabase reads need a UNIQUE ORDER BY (added 2026-09-02)

`.range()` pagination issues one HTTP request per page. Postgres guarantees NO row order without
an `ORDER BY`, and ordering by a NON-UNIQUE key is only half a guarantee — rows tied on that key
may come back in any order, so a tie group split across a page boundary can hand you the same row
twice and never hand you another. **Every paginated query must end in a unique column** (`id`, or
a verified-unique composite for a view). All of `src/` was audited and fixed on 2026-09-02;
`Admin.js` was already correct. `pit_penalties` in PitCrewRankings is deliberately NOT ordered:
it is a single request, not a loop, so it has no boundary.

### PostgREST silently caps EVERY response at 5,000 rows

No error, no warning, no flag — a query matching 6,363 rows returns 5,000 and the code has no way
to know. Verified live 2026-09-02: `loop_data` cup = 5,000 of 6,348; `qualifying_results` cup =
5,000 of 5,943. Which rows get dropped is NOT predictable - an earlier version of this section said
"the newest"; an independent live re-test (2026-09-02) found an unordered cup `loop_data` read lost
rows from EVERY season (2022: 517 of 1,322; 2026: 494 of 981) and returned a different set on the
next request. Updated rows move in the heap. Treat it as a random sample with no error flag.

**`src/lib/fetchAllRows.js` is the fix — use it for any query whose result set can grow.** It pages
with a unique `ORDER BY`, so it defeats the cap AND the non-unique-order bug above in one call.
Pass a FUNCTION returning a fresh builder (supabase builders are single-use).

**A `.limit(N)` ABOVE 5,000 IS A LIE.** `.limit(20000)` and `.limit(50000)` read like generous
bounds and deliver 5,000. Four queries in this app carried one and three were truncating or about
to. Never treat a large `.limit()` as proof a query is safe — measure the row count.

Current headroom, measured 2026-09-02 — re-measure before assuming a query is still safe:

| query | rows | cap | note |
|---|---|---|---|
| SimulationCenter speed scores, oreilly Intermediate | 4,836 | 5,000 | **PAGINATED** — was 164 rows short; ~800-1,000/season, crosses in 2027 |
| same, cup / trucks Intermediate | 2,444 / 3,971 | 5,000 | covered by the same fix |
| QualifyingCenter, worst correlation group | 2,360 | 5,000 | safe for years |
| PracticeReportCard, worst session | 3,866 | 5,000 | safe |
| SimulationCenter track+series reads | 398 | 5,000 | safe |
| **SimulationCenter CREW TERM** (`pit_stops`, had `.limit(20000)`) | cup 2025 **6,528** / 2026 4,354 | 5,000 | **PAGINATED** — past seasons were truncating; 2026 crosses ~3 races out |
| **NascarFeedAdmin ingest resolver** (`loop_data`, had `.limit(20000)`) | cup **6,348** | 5,000 | **PAGINATED** — 2 of 101 cup drivers were missing from the map |
| **GradeCenter finishes** (`loop_data`, had `.limit(20000)`) | 2,533 today | 5,000 | **PAGINATED** — ~3,400/season, breaks on the first two-season grade |
| LapComparison practice_laps (had `.limit(50000)`) | 3,866 | 5,000 | **PAGINATED** — 1,134 rows of headroom |
| GradeCenter `odds_snapshots` `.limit(2000)` | window 2,965 max | 2,000 | **NOT a bug — verified.** Rows truncate, KEYS never do: it keeps the first row per driver\|market\|book inside a 10-min close window, and all 429-676 keys sit inside the newest 2,000 on every race. The publish-side odds come from `row.results`, not this query. |
| **LineMovementAdmin race picker** (`odds_snapshots`, had `.limit(6000)`) | 68,832 rows / 12 races | 5,000 | **WAS SHOWING 1 RACE OF 12** — newest race alone is ~10k rows, so all 5,000 came from it. First fix paginated the rows and STILL showed 11 of 12: `fetchAllRows` bailed at its 60k default and the caller discarded the error. Now reads the `odds_snapshot_races` view (one row per race, `security_invoker`), one request. `fetchAllRows` default raised to 200k and overflow logs `console.error`. |
| Admin track-median sanity check | up to 15,555 | 1,000 | bound KEPT (it is a sanity check) but now `.order('id', desc)` — was an arbitrary, oldest-skewed subset |

Note the sim's series list is `[s, 'cup', ...__borrowSeries]` and `__borrowSeries` comes from
`crossover_borrows WHERE active`. That table is EMPTY, so the list is at most two wide today.
**Activating one crossover borrow makes it three wide and takes Intermediate to 6,363** — over the
cap instantly. That is a real coupling between a config row and a silent data loss, now defused.

### Correction to what commit 2debbe4 implied

That commit fixed five queries and its message let the reader infer all five were actively
corrupting data. **Only two of six were ever shown to be.** The operator asked "are you sure those
were bugs?" and re-testing said no:

| page | evidence | verdict |
|---|---|---|
| PitCrewRankings | live page read against the DB: Hamlin 192 stops vs 107 real | **PROVEN broken** |
| LineMovementAdmin | 3 pages fetched 3,000 rows, 2,944 distinct — 56 duplicated | **PROVEN broken** |
| FastestLapOddsAdmin | same reproduction: 0 duplicates, despite NO order key at all | not observed |
| GreenFlagSpeed | 0 duplicates | not observed |
| FastestLapSurvival | 0 duplicates | not observed |
| FastestLap | 0 duplicates (0 of 14 boundaries in a tie) | not observed |

**The lesson is the one that cost four wrong answers today: a PRECONDITION IS NOT A SYMPTOM.**
"A page boundary sits inside a tie group" means corruption is possible, not that it is happening.
I measured the precondition and reported it as damage. Verify the symptom — read the deployed page,
or reproduce the actual fetch — before telling the operator his numbers are wrong.

Two caveats that keep the four fixes justified anyway. The reproduction ran all pages inside ONE
SQL statement: one planner invocation, one snapshot, no concurrent writes — the friendliest
possible case. The real pages issue separate requests in separate transactions while the loader may
be writing. And undefined ordering is undefined: it can change when statistics update, an index
starts being used, autovacuum moves pages, or the server version changes — silently, with no error.
The fixes cost nothing and remove the class of failure. They were insurance, not repairs.

## Model doctrine (current truths — evidence lives in BACKTEST_LOG)
- Practice grader v6.3-st: pace 40% = tire-corrected all-clean-lap mean; speed 40% = RAW best5; longRun 20% = TC ≥10-lap runs (missing → 25). Tire correction = pooled within-stint demeaned slope, laps normalized to lap-5 age. Session-time correction (group-relative 5-min bucket medians of per-driver-demeaned residuals) activates only on timestamped sessions — UNDER PROSPECTIVE REVIEW, see STATE. Validation target: race-day driver_rating (Racing Reference).
- Sim: 50k draws; correlated wreck events + independent mechanical DNFs; auto-DNF calibrated from track history; caution preset intentionally scales realized DNFs around the budget (low under, high over). Group A/B practice is gone from NASCAR formats going forward.
- DFS optimizer: GPP ceiling mode default — candidates = per-draw exact optima, ranked by p90 total across draws. Known limit: high-conviction boards collapse candidate diversity (mean ≡ GPP) — use exposure caps for multi-entry until the ownership-leverage overlay ships. DK place-points helper runs ~1pt/driver hot midfield — always prefer official FPTS from contest standings files. Right DK file = contest-standings zip CSV, NOT the entry-history export.
- Flags: every positive-EV opinion logged except favorites shorter than −250 (write-time cap); display fav cap −150; EV≥10 thresholds live in displays/reports only (edge-inversion finding: small-edge flags have been the profitable cohort).
- Odds pastes: books rename section headers after site updates — a book showing "0 parsed" means check its headers first (Hard Rock renamed winner market to bare "Race", 2026-08-14).

## Payments / access (sandbox — launch items in STATE)
Three tiers: anon = nothing (stale-sample landing TBD); authenticated subscriber = product-table read (blanket RLS policy); admins table = everything. Stripe sandbox verified end-to-end: $24.99/mo founding (list $34.99) + $9.99 7-day pass, no trials; webhook checks raw-body signature; env changes require a fresh deployment. Password auth fully removed from the app. The route paywall (PAYWALL_ENABLED flag in App.js) does NOT protect the REST API — the RLS lockdown is the real paywall.

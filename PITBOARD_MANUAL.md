# PITBOARD MANUAL
Stable operating rules. Edit ONLY when a rule actually changes. Session start: read this + PITBOARD_STATE.md (~5k tokens total). The archives — pitboard.md (operational log, ~68k tok), BACKTEST_LOG.md (model evidence 2026-08-03 onward, ~48k tok), and BACKTEST_ARCHIVE.md (model evidence season-start through 2026-07-28, ~86k tok, CLOSED — never append) — are append-only history: SEARCH them for specific answers, never read in full. Topic docs (read when the topic is live, not at session start): STRIPE_CUTOVER.md (sandbox->live launch runbook + domain-change impact, 2026-08-29).

## What this is
PitBoard — NASCAR betting + DFS analytics product approaching subscriber launch. Operator: Aaron (atmmstrs2@gmail.com; master admin uid d7a9f822-1237-4660-9e17-0b8b526e3c44; DK username atmmstrs2). Stack: React CRA on Vercel (https://nascar-loop-data-analytics.vercel.app) + Supabase (https://dqexnylexbypjtiuctxd.supabase.co, publishable key sb_publishable_pVrtVEoQD1i9LiIvaXhS4g_ZDaUUccj). Repo: RkyMtnLSX/NASCAR-Loop-Data-Analytics- (main branch, Vercel auto-deploys). Local scraper cockpit: NascarDataScrapperV3 folder (practice watcher w/ per-lap timestamps, sheet builder w/ LAPS_RAW tab, penalties backfill).

## How to edit code (browser workflow — no local clone)
Work from a Chrome tab on a PitBoard-origin page (Vercel-origin pages' fetch wrapper can break api.github.com calls). Operator provides the GitHub token in chat each session — it is NEVER written to any file.
1. GET contents API → decodeURIComponent(escape(atob(content)))
2. Counted split/join edits: `if (s.split(anchor).length !== 2) throw` — never blind-replace
3. Babel-standalone verify (cdnjs, presets [['env',{modules:false}],'react']) BEFORE every PUT
4. PUT with btoa(unescape(encodeURIComponent(s))) + current sha
5. Poll commits/{sha}/status with sleeps ≤40s (45s+ hits CDP timeout); builds run ~60-120s
6. Verify the LIVE bundle with FUNCTIONAL string literals (comments are minifier-stripped; regexes can match display code ambiguously — verify at source when unsure)

Quirks: the content filter blocks tool OUTPUTS containing = & ? : ; together — sanitize outputs with replace maps (inputs unaffected). Tabs die frequently — recreate, renavigate, never rely on window.* state across turns. Supabase REST from browser: publishable key as apikey + operator session access_token from the localStorage auth-token entry (JWT expires — renavigate to refresh).

## Standing rules (non-negotiable)
- NO secrets/tokens/passwords in any file, repo doc, or web form — operator pastes secrets himself. Vercel gotcha: values pasted into the "Note (Optional)" field present as empty env vars.
- Backtest before ship for model changes. When history can't score it (new data), ship gated + prospective protocol with an explicit revert trigger, logged in BACKTEST_LOG.
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

## Model doctrine (current truths — evidence lives in BACKTEST_LOG)
- Practice grader v6.3-st: pace 40% = tire-corrected all-clean-lap mean; speed 40% = RAW best5; longRun 20% = TC ≥10-lap runs (missing → 25). Tire correction = pooled within-stint demeaned slope, laps normalized to lap-5 age. Session-time correction (group-relative 5-min bucket medians of per-driver-demeaned residuals) activates only on timestamped sessions — UNDER PROSPECTIVE REVIEW, see STATE. Validation target: race-day driver_rating (Racing Reference).
- Sim: 50k draws; correlated wreck events + independent mechanical DNFs; auto-DNF calibrated from track history; caution preset intentionally scales realized DNFs around the budget (low under, high over). Group A/B practice is gone from NASCAR formats going forward.
- DFS optimizer: GPP ceiling mode default — candidates = per-draw exact optima, ranked by p90 total across draws. Known limit: high-conviction boards collapse candidate diversity (mean ≡ GPP) — use exposure caps for multi-entry until the ownership-leverage overlay ships. DK place-points helper runs ~1pt/driver hot midfield — always prefer official FPTS from contest standings files. Right DK file = contest-standings zip CSV, NOT the entry-history export.
- Flags: every positive-EV opinion logged except favorites shorter than −250 (write-time cap); display fav cap −150; EV≥10 thresholds live in displays/reports only (edge-inversion finding: small-edge flags have been the profitable cohort).
- Odds pastes: books rename section headers after site updates — a book showing "0 parsed" means check its headers first (Hard Rock renamed winner market to bare "Race", 2026-08-14).

## Payments / access (sandbox — launch items in STATE)
Three tiers: anon = nothing (stale-sample landing TBD); authenticated subscriber = product-table read (blanket RLS policy); admins table = everything. Stripe sandbox verified end-to-end: $24.99/mo founding (list $34.99) + $9.99 7-day pass, no trials; webhook checks raw-body signature; env changes require a fresh deployment. Password auth fully removed from the app. The route paywall (PAYWALL_ENABLED flag in App.js) does NOT protect the REST API — the RLS lockdown is the real paywall.

# PITBOARD STATE
Volatile snapshot — REPLACE on change (git history is the archive). Updated: 2026-08-24. DFS multi-entry toolchain COMPLETE: fill-by-contest picker (b0361752), exposure cap fixed - sub-100% no longer collapses to 1 lineup (8a48b136); NH entry JHN fix + parser hardened (e3b7ec39). NH weekend live: v6.3 wk3 + startPos watch both judged Sunday.

## Launch runway (target: The Chase, ~2-3 race weekends out)
- [x] #64 table-lockdown SQL — RUN + LIVE-VERIFIED 2026-08-19 (anon 0 rows everywhere; RPCs
      converted to security invoker; loop_data_dk view security_invoker; week-pass expiry
      predicate fixed both sides). The API paywall is UP.
- [x] PAYWALL_ENABLED = true (9b9d72f) — signed-out redirect + admin pass verified live.
- [x] Flip test COMPLETE 2026-08-19: subscriber pass, admin block, expired-pass lockout,
      cancel→webhook→paid-through, portal opens. Subscribe-page gated/expired callout shipped
      (9a67572). Cancel policy: paid-through kept even on immediate cancel; refunds = manual row edit.
- [x] Stripe Customer Portal settings SAVE — test mode done + verified via Manage billing.
      Live mode still needed at cutover.
- [ ] Stale-sample landing check: landing no longer queries Supabase at all (stats bar
      removed 2026-08-19 close) — remaining work is just a signed-out visual pass to confirm,
      then close.
- [ ] Weekly auto-renew activation (operator): recurring $9.99/wk price in Stripe test
      dashboard -> swap STRIPE_PRICE_WEEKPASS env in Vercel -> redeploy -> test purchase.
      Weekly buy button BROKEN until done (code shipped 98a86ba). Repeat in live at cutover.
- [ ] Vercel Hobby → Pro (~$20/mo, commercial use rights) — at live cutover, not before.
- [ ] LIVE Stripe cutover: recreate products + webhook in live mode, swap 4 env values,
      real-card test.
- Optional: delete inert REACT_APP_ADMIN_PASSWORD env var.

- [x] PUBLIC FUNNEL PAGE (2026-08-23, b09d06c): Lap By Lap is free to everyone, scoped to the
      configured weekend by three get_public_* DEFINER RPCs that join featured_weekend. No table
      opened to anon (verified: all direct reads 0 rows). CONSEQUENCE: featured_weekend is now
      PUBLIC-FACING - stale config shows to the world (oreilly still on Iowa R23 from 8/04).
- [x] RPC hardening: anon EXECUTE revoked on has_access()/is_admin(); get_practice_sessions
      DEFINER gap closed by the public-RPC design instead of INVOKER (INVOKER attempt timed out
      the page and was reverted - see pitboard.md 2026-08-23).

## Open experiments (ledgers)
- v6.3-st session-time correction: LEDGER 2-1 (wk1 trucks +.026, wk2 cup -.099, wk3 cup NH +.028 CORRECTED WINS, protocol target rho .624 v .596 n=36). POOLED mean delta -0.0150, sem 0.0420 over 3 sessions - indistinguishable from zero, dominated by wk2. Verdict deferred to 8-10 sessions per the 2026-08-23 protocol correction; emergency stop (single week worse than -0.15 rho) never approached. Wk3 was the FIRST CLEAN test (A/B groups gone, gc correction self-disabled). BLOCKER unchanged: truck sessions still upload with no captured_at, so the pool fills at half rate - fix the watcher for truck practice.
- DFS replay ledger: 6 races - GPP 4 wins, 1 tie, 1 LOSS. R6 cup NH: mean 207.8 (~9080/14268) BEAT GPP 150.7 (~11674) - GPP faded Blaney (winner, 101.45pts, 37.3% owned) on a CHALK-DELIVERS slate (top 3 scorers all 30%+ owned). Confirms GPP edge is proportional to board uncertainty.
- DK FPTS decomposition (9 post boards, 2026-08-24): NO broken component - finish .605, place .573, laps led .461 (weakest, but only 7% of variance), fastest laps .665 (strongest), TOTAL .475; 45% of variance is covariance between terms. Errors compound: total ranks below the component average by -0.101 in 7 of 9 races. CORRECTION to the earlier 2-slate claim: DK salary does NOT generally out-predict us (we win 4, salary 5, one a tie; means .480 v .499). The surviving signal is TRUCKS-ONLY - salary wins all 3 truck races, mean gap -.070, n=3. Watch for a 4th/5th truck race; if it holds, consider a market anchor on truck DK projections.
- Pre/post board sweep (9 paired boards, 2026-08-24): POST IS BETTER ORDERED, NOT BETTER CALIBRATED. Winner's win-board rank improves or ties 9/9, regresses in NONE (7 strict, p=.008); actual top-5 finishers gain 0.64 board slots. Brier favors post on all four markets but proves nothing at n=9 (|t| <= 1.24; robust to renormalization). Post boards are much sharper - top favorite 17.8% -> 25.3%, entropy down 8/9. THE SHARPENING IS UNEARNED IN THE CUP WIN MARKET: cup picks >=12% predict 20.8% and hit 8.3% post (pre was already bad at 16.8/9.1). Series split is NOT a finding - trucks' Brier edge is 3-for-3 favorite luck at ~25% each, and full-field Spearman splits the OTHER way (post better 4/4 cup, 1/5 non-cup). Keep publishing post; discount post CUP win pct for win-market bets. Candidate (unbuilt, untested): stage-aware favorite shade / marketAnchor. Re-run at 15-18 pairs. BACKTEST_LOG 2026-08-24.
- Ownership ground truth: 7 contests banked (Iowa cup+ore, Richmond trucks+cup, NH trucks+cup). Refit at 8-10.

## Queue (rough priority)
1. Ownership-leverage overlay in DFS: projected-ownership model + chalk-trap flags + build diversification (fixes the conviction-collapse failure; Majeski 55%-owned bust + Blaney fade are the motivating cases).
2. DFS replay report UI — auto compute/place both modes from each standings upload.
3. [CLOSED 2026-08-23 - NO SHIP] All-tracks blend into corrAvgRating tested at board level: 341 races, all four track groups, production weight set per race. EVERY arm (w .25-.75) ties current on win/t3/t5/t10; mean win Brier degrades monotonically with w. The pre-test's decisive rating-prediction gain (W244/L138 p<1e-7) did NOT reach the market bar. corrAvgRating stays type-only. Harness validated first by reproducing the startPos result 134W/64L p<.001. BACKTEST_LOG 2026-08-23.
4. Sim A/B: long-run practice input.
4b. [SHIPPED 2026-08-20] startPos conditioned sweep: 230-race full-model sweep ->
    DEFAULT_WEIGHTS.startPos 0.33 -> 0.23 (t10 134W/96L p~.01) + TRUCK_SHORT_WEIGHTS
    exception keeping 0.33 on trucks short/flat (cut loses there, raw corr .576).
    PROSPECTIVE WATCH: revert-review if cup boards go 0-fer t5/t10 vs books two straight
    weekends. Leftover thread: cup ROAD runs the lowest startPos set despite highest
    marginal value - road sweep candidate for 2027 (no road races left this year).
5. #69 flag sweep at 15–20 boards (edge-inversion + win-market-0fer + CLV-window inputs).
6. Staking layer (¼-Kelly display, ladder-aware, per-race cap).
7. CLV-vs-close-consensus method change (forward-only).
8. Mech DNF tiered by equipment; tire-management earned/dashed column; matchup pricer; RR+LR loop-data merge mode; PENALTIES_BACKFILL_ALL history run (operator); best-5 tooltip wording.

## Loose ends
- [RETRACTED 2026-08-22] The "practice duplicate/session-collision" loose end was MY OWN
  grouping error - I scanned practice_laps without race_number, and Phoenix-type tracks host two
  races a season under session_number 1. Same 60k rows: 204 collisions without race_number, 0
  with it. App always filtered correctly (Admin upload replace + both read pages). No bug, no
  action, audit SQL deleted. BACKTEST_LOG 2026-08-22 RETRACTION. Surviving result from that
  thread: single-lap gaps are real pit visits (90/90 timestamped), so parseStints' strict split
  is correct.
- corrHistory has never been swept at its post-8/20 effective share (33.7% → 37.2%; the startPos
  cut changed wTotal and renormalized every term). Sweep result stands, but 0.30 is the arm that
  restores the validated share — queue candidate behind the ownership overlay.
- [OWED TO FABLE] practice sheet page 1 renumbers laps (pit gaps invisible) while LAPS_RAW keeps
  original numbering. QA-only - DB, grader and the live Lap By Lap page are all correct (NH cup
  mean 2.75 runs/driver, zero single-run drivers) - but page 1 is the tab eyeballed before upload,
  so it is the one view that hides dropped laps and over-long runs. Fix in pitboard_practice_sheet.py:
  write page 1 on original lap numbers with blanks at gaps. pitboard.md 2026-08-23.
- pit_crew_race bookmarklet may write with bare publishable key → now blocked by RLS; re-test
  at next weekly sync, fix = operator access_token in headers (2026-08-19).
- Trucks Richmond practice never re-uploaded with timestamps — live truck card still uncorrected (cup wk2 check was run via harness instead).
- sim_matrices exists only for boards published after 2026-08-15 evening; older boards fall back to 4k sample in Matchup Compare.
- Operator's 7 cup DK entries used no-cap exposure → one thesis ×7; habit fix = exposure ~50% for multi-entry.
- New Hampshire week owed: v6.3 wk3 check + weekly DFS replay after standings upload. Trucks R18 board accidentally published as 'post' 8/19 — retagged to 'pre' (board + 9 flags + sim_matrices); stage-guard confirm didn't stop it, consider defaulting stage selector to 'pre' when no practice exists.

# PITBOARD STATE
Volatile snapshot — REPLACE on change (git history is the archive). Updated: 2026-08-19 late, sandbox payments track COMPLETE.

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

## Open experiments (ledgers)
- v6.3-st session-time correction: PROSPECTIVE 1–1 (wk1 trucks Richmond corrected +.026; wk2 cup Richmond corrected −.099 — Bowman's early speed was real). Revert trigger = 2 consecutive losses. Next test: NEW HAMPSHIRE (R18 — flat mile, first single-group cup practice weekend; gc correction self-disables).
- DFS replay ledger (GPP ceiling vs mean, official FPTS, real fields): GPP wins 3, tie 1 (cup Richmond: both built the identical Blaney/Kes cluster lineup, bottom decile — conviction boards collapse diversity). Findings: GPP edge ∝ board uncertainty; winners at cup Richmond were selective chalk that faded the 53%-owned Blaney.
- Ownership ground truth: 5 contests banked (Iowa cup+ore, Richmond trucks+cup GPP). Early reads: field tracks our projDK ρ≈.8; cup owners chase value, O'Reilly owners chase raw speed/track position. Refit at 8–10 contests.

## Queue (rough priority)
1. Ownership-leverage overlay in DFS: projected-ownership model + chalk-trap flags + build diversification (fixes the conviction-collapse failure; Majeski 55%-owned bust + Blaney fade are the motivating cases).
2. DFS replay report UI — auto compute/place both modes from each standings upload.
3. [PRE-TEST DONE 8/19 - BLEND WINS .721 vs .692, 71pct of races] Sim A/B: wire 50/50 track-type rating blend into rating construction, board-level paired backtest before ship. See BACKTEST_LOG 2026-08-19.
4. Sim A/B: long-run practice input.
5. #69 flag sweep at 15–20 boards (edge-inversion + win-market-0fer + CLV-window inputs).
6. Staking layer (¼-Kelly display, ladder-aware, per-race cap).
7. CLV-vs-close-consensus method change (forward-only).
8. Mech DNF tiered by equipment; tire-management earned/dashed column; matchup pricer; RR+LR loop-data merge mode; PENALTIES_BACKFILL_ALL history run (operator); best-5 tooltip wording.

## Loose ends
- pit_crew_race bookmarklet may write with bare publishable key → now blocked by RLS; re-test
  at next weekly sync, fix = operator access_token in headers (2026-08-19).
- Trucks Richmond practice never re-uploaded with timestamps — live truck card still uncorrected (cup wk2 check was run via harness instead).
- sim_matrices exists only for boards published after 2026-08-15 evening; older boards fall back to 4k sample in Matchup Compare.
- Operator's 7 cup DK entries used no-cap exposure → one thesis ×7; habit fix = exposure ~50% for multi-entry.
- New Hampshire week owed: v6.3 wk3 check + weekly DFS replay after standings upload. Trucks R18 board accidentally published as 'post' 8/19 — retagged to 'pre' (board + 9 flags + sim_matrices); stage-guard confirm didn't stop it, consider defaulting stage selector to 'pre' when no practice exists.

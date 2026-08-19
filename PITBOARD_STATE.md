# PITBOARD STATE
Volatile snapshot — REPLACE on change (git history is the archive). Updated: 2026-08-15 late night, post cup Richmond R24.

## Launch runway (target: The Chase, ~3 race weekends out)
- [ ] #64 table-lockdown SQL — admin tables → admins-only, product tables → subscriber-read, strip anon. THE real API paywall. (I write SQL, operator runs.)
- [ ] Stripe Customer Portal settings SAVE (test + live modes, dashboard → Settings → Billing → Customer portal) — "Manage billing" errors until done. Operator, 2 min.
- [ ] PAYWALL_ENABLED flip test: signed-out redirect, subscriber pass, week-pass purchase/expiry, cancel-revokes-access.
- [ ] Stale-sample landing page for anon.
- [ ] Vercel Hobby → Pro (~$20/mo, commercial use rights) — at live cutover, not before.
- [ ] LIVE Stripe cutover: recreate products + webhook in live mode, swap 4 env values, real-card test.
- Optional: delete inert REACT_APP_ADMIN_PASSWORD env var.

## Open experiments (ledgers)
- v6.3-st session-time correction: PROSPECTIVE 1–1 (wk1 trucks Richmond corrected +.026; wk2 cup Richmond corrected −.099 — Bowman's early speed was real). Revert trigger = 2 consecutive losses. Next test: Watkins Glen (road course — watch whether activation gates even fire).
- DFS replay ledger (GPP ceiling vs mean, official FPTS, real fields): GPP wins 3, tie 1 (cup Richmond: both built the identical Blaney/Kes cluster lineup, bottom decile — conviction boards collapse diversity). Findings: GPP edge ∝ board uncertainty; winners at cup Richmond were selective chalk that faded the 53%-owned Blaney.
- Ownership ground truth: 5 contests banked (Iowa cup+ore, Richmond trucks+cup GPP). Early reads: field tracks our projDK ρ≈.8; cup owners chase value, O'Reilly owners chase raw speed/track position. Refit at 8–10 contests.

## Queue (rough priority)
1. Ownership-leverage overlay in DFS: projected-ownership model + chalk-trap flags + build diversification (fixes the conviction-collapse failure; Majeski 55%-owned bust + Blaney fade are the motivating cases).
2. DFS replay report UI — auto compute/place both modes from each standings upload.
3. Track-type-conditioned ratings pre-test on loop data (cheap, before any sim A/B).
4. Sim A/B: long-run practice input.
5. #69 flag sweep at 15–20 boards (edge-inversion + win-market-0fer + CLV-window inputs).
6. Staking layer (¼-Kelly display, ladder-aware, per-race cap).
7. CLV-vs-close-consensus method change (forward-only).
8. Mech DNF tiered by equipment; tire-management earned/dashed column; matchup pricer; RR+LR loop-data merge mode; PENALTIES_BACKFILL_ALL history run (operator); best-5 tooltip wording.

## Loose ends
- Trucks Richmond practice never re-uploaded with timestamps — live truck card still uncorrected (cup wk2 check was run via harness instead).
- sim_matrices exists only for boards published after 2026-08-15 evening; older boards fall back to 4k sample in Matchup Compare.
- Operator's 7 cup DK entries used no-cap exposure → one thesis ×7; habit fix = exposure ~50% for multi-entry.
- Watkins Glen week owed: v6.3 wk3 check + weekly DFS replay after standings upload.

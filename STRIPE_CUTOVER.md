# Stripe Sandbox → Live Cutover Runbook (PitBoard subscriber launch)

Written 2026-08-29 from a live audit via the Stripe connector (account acct_1OF5dBBoJdzYFWwL
"Pitboard"). SECURITY STANDING RULE: no secret ever passes through chat, a file, or a web form
filled by a model session. Every step marked **[OPERATOR]** involves a secret or a payment and is
done by the operator alone. NO SECRETS APPEAR IN THIS FILE — env var NAMES only.

## Verified state as of 2026-08-29

SANDBOX (testmode) — healthy, end-to-end proven:
- Products/prices: "Pitboard-monthy Founding" $24.99/mo (price_1U34TbBoJdzYFWwLDhnkeM61),
  "Pitboard Weekly Pass" $9.99/wk recurring (price_1U34UHBoJdzYFWwLaZ1MhPqX).
- Webhook endpoint: https://nascar-loop-data-analytics.vercel.app/api/stripe-webhook, enabled,
  exactly the 3 events the handler consumes (checkout.session.completed,
  customer.subscription.updated, customer.subscription.deleted), api_version 2023-10-16.
- End-to-end proof: one ACTIVE monthly test subscription (8/11) and one tested CANCEL flow
  (8/19) — both mirrored exactly in the Supabase subscribers table (webhook -> DB verified).
- Serverless: create-checkout-session (verifies Supabase user token, ties checkout to verified
  identity), stripe-webhook (raw-body signature verification, env guard), create-portal-session.

LIVE (livemode) — EMPTY. No products, no prices, no webhook endpoint. Everything below creates it.

## GAP found in the audit (close BEFORE launch week)

- [ ] **Weekly-pass flow has NEVER been tested end-to-end** since it became a recurring
  subscription on 2026-08-19. Sandbox has zero subscriptions on the weekly price. Test (2 min,
  operator): Subscribe page -> Weekly -> Stripe test card 4242 4242 4242 4242 -> confirm the
  subscribers row appears with plan='week', status='active', access_until ~7 days out. Then
  cancel it via the portal and confirm status flips.

## Pre-cutover (any time before launch week)

- [ ] Weekly sandbox test above.
- [ ] **The launch code change**: flip src/App.js from the hardcoded `const [isSubscriber] =
  useState(true)` to the real useSubscriber() gate. This is the one intentional exception to the
  NEVER-CHANGE rule, made once, at launch, deliberately. Review useSubscriber.js first; ship
  behind its own commit so rollback is a one-line revert.
- [ ] [OPERATOR] Vercel Hobby -> Pro (before real traffic).
- [ ] Code review of the flip commit (standard practice).

## Cutover day — order matters

1. [CONNECTOR, on operator's go] Create LIVE product + price for Monthly ($24.99/mo) and Weekly
   ($9.99/wk recurring). Live prices charge nobody by existing; still done only on explicit go.
2. [CONNECTOR, on operator's go] Create LIVE webhook endpoint: same URL, same 3 events.
3. [OPERATOR] Copy the live webhook SIGNING SECRET from the Stripe dashboard (shown once).
4. [OPERATOR] Vercel dashboard env swap (Production scope): STRIPE_SECRET_KEY (live sk_...),
   STRIPE_WEBHOOK_SECRET (live whsec_...), STRIPE_PRICE_MONTHLY + STRIPE_PRICE_WEEKPASS (the live
   price ids from step 1). TRAP (2026-08 lesson): the Vercel UI's "Note (Optional)" field sits
   where a value field is expected — paste values into VALUE, never Note. Redeploy after saving
   (env changes need a fresh deployment).
5. Verify deploy READY (connector). Hit /api/stripe-webhook with a bare GET/POST: a "bad
   signature" 400 (NOT an "env missing" 500) proves live envs are present and non-empty.
6. [OPERATOR] First live transaction decision: either a real self-purchase of the $9.99 weekly
   (then refund + cancel from the dashboard) as a smoke test, or trust sandbox proof and watch
   the first real subscriber closely. Operator's call - it is real money either way.

## Post-cutover watch (first 48h)

- [ ] Stripe dashboard -> webhook endpoint -> delivery log: all 2xx. Any 4xx/5xx = investigate
  immediately (signature secret mismatch is the classic).
- [ ] Vercel get_runtime_errors via connector after the first live checkout (standing note from
  the 2026-08-28 retrospective: the webhook is the first serverless path that will ever run in
  production).
- [ ] subscribers table row appears within seconds of each checkout; portal cancel flips status.

## Rollback triggers + plan

TRIGGERS: webhook deliveries failing (non-2xx) / subscribers rows not appearing after a real
checkout / env-guard 500s / any paying customer locked out.
PLAN: (a) re-flip the App.js gate to hardcoded true (one-line revert commit - paying users keep
access while debugging; this fails OPEN, which is correct for a subscriber product at launch
scale); (b) fix webhook/env issue; (c) re-flip. Never leave a paying subscriber locked out while
debugging infra.

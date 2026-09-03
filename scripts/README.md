# Running the sim outside the browser

Everything here runs on your own machine with no AI session involved. You need Node 18 or
newer (built and tested on 22) and one `npm install`.

```bash
git clone https://github.com/RkyMtnLSX/NASCAR-Loop-Data-Analytics-.git pitboard
cd pitboard
npm install          # this is what provides @babel/core, which loadEngine needs
```

That's the whole setup. No database credentials, no API keys, no Vercel. The backtest data is
committed in `scripts/backtest-data/` (828 KB), so the scripts below are self-contained.

---

## The two you should run after ANY change to the sim

```bash
npm run lint:undef    # free-variable check across src/
npm run sim:smoke     # runs the engine headlessly and checks its invariants
```

**`lint:undef` is not optional politeness.** `npm run build` will happily COMPILE a page that
references a name which no longer exists — webpack does not flag a free variable — so a moved
constant gives you a green build and a page that crashes on load. That happened on 2026-08-31
with eight names at once. Thirty seconds here saves a broken deploy.

`sim:smoke` runs 20,000 simulations per track group and checks that every sim produces a real
finishing order, the probability columns close, projected laps led sums to the race distance,
and the DNF resolver reproduces its constants. It also **asserts that the caution preset does
not move attrition** — all three presets must deliver the `dnfRate` budget, spread ≤ 0.25. That
assertion is new on 2026-08-31 and it replaced a row that used to print a 0.5x/0.9x/1.4x spread
and call it correct. If it fails, the wreck normalizer changed; find out why before trusting any
result.

---

## How it works, in one paragraph

`src/lib/simEngine.js` is the sim — `runRaceSim` and `buildSpeedScores` plus every constant and
curve they use. The website imports that file, and so do these scripts. There is exactly one
copy, so a backtest and the live site cannot disagree about what the model does.

Node can't normally `require` that file, because it's an ES module inside a Create React App
tree. `scripts/loadEngine.js` transforms it in memory (ESM to CommonJS, via Babel, which
`npm install` already gave you) and hands it back. No build step, no second copy, no artifact
on disk.

---

## The backtest scripts

All read from `scripts/backtest-data/`. All safe to run — none of them touch the database, the
site, or anything you'd have to undo.

| script | what it answers |
|---|---|
| `sim-smoke.js` | Does the engine run, and are its outputs internally coherent? |
| `dnf-per-track.js` | Does the sim retire the right number of cars at each track? |
| `dnf-refresh-through-sim.js` | Did the 2026-08-30 DNF constant refresh actually improve the sim? |
| `backtest-attrition-sweep.js` | How much does attrition level move forecast quality, and how much of a gap is just noise? |
| `backtest-caution-mix.js` | The registered holdout harness. `MODE=tilt` switches arms. |
| `backtest-practice-tilt.js` | Does a change survive when boards carry practice data? |
| `validate-vs-stored-boards.js` | Does the reconstruction match your real published boards? |
| `backtest-int-dominance.js` | The registered 2026-09-03 laps-led / fastest-laps study (INT). `PHASE=train` never opens the holdout. Shipped as `INT_DOM_V2`; `domPool:'finish'` reconstructs the old allocator. |
| `backtest-start-v4.js` | The registered 2026-09-03 start-projection study (cup): trail10 + recent-form / Jayski-order term. Data in `start-v4-cup-2025-26.txt`, fit in `start-v4-fit.json`. |

Most take a `SIMS=` environment variable, e.g. `SIMS=20000 node scripts/dnf-per-track.js`.
Lower is faster and noisier. A full holdout run at 10,000 sims takes a couple of minutes.

**Read `BACKTEST_LOG.md` before drawing a conclusion from any of these.** Several of them produce
numbers that look like findings and are not.

`gate-cliff-final.js` is the pre-registered harness for the 2026-08-31 cliff fix. Its arms pin
`perBucketEV` and `wideClamp` explicitly because both SHIPPED as engine defaults that day — an
arm that passes no flags now gets the FIX, not the old behaviour. Its last section verifies
exactly that: the default path must be indistinguishable from the gated `EV+CLAMP` arm. If that
section ever fails, someone reverted the ship and the log entries no longer describe the tree.

---

## Refreshing the backtest data

The committed data is a snapshot: races through 2026-08-23, reconstructed so every driver's
inputs come only from races BEFORE the one being predicted. It does not need refreshing to run
the scripts. It only needs refreshing when you want newer races included, and the SQL that
builds it is quoted in the BACKTEST_LOG entries for 2026-08-31.

Two things worth knowing about that snapshot:

- It carries no pit-crew times, and practice only where `practice_sessions` has it (2025 on).
- It is a weaker instrument for O'Reilly than for Cup. Measured on 2026-08-31 against 11 stored
  live boards: it named the same favourite on 5 of 5 Cup boards and 0 of 3 O'Reilly ones.
  Weight Cup results more heavily, or validate per series first.

---

## Which caution dial does what (changed 2026-08-31)

The **Caution Rate** buttons no longer change how many cars retire. They set the wreck pool
(which wrecks happen, how big, when), the noise width, and the dominator curves. **`dnfRate` is
the only dial that moves attrition.** Before this date the preset also swung attrition roughly
0.5x/0.9x/1.4x around the budget, selected off a hard `<6 / <11.5` threshold on a noisy track
average — 28% of track cells cross a threshold across seasons, and each crossing moved attrition
~73%. Operator-approved ship; full evidence in `BACKTEST_LOG.md` under 2026-08-31.

## What is deliberately switched OFF in the engine

Two experiments live in `simEngine.js` behind flags. Neither is reachable from the website —
nothing in `src/pages/` passes either flag, and that is on purpose.

- **`cautionMix`** — TESTED AND REJECTED on holdout, 2026-08-31. Do not enable.
- **`skillTilt`** — passed some gates, failed others, blocked on data. Do not enable.

`perBucketEV` and `wideClamp` used to be listed here. They are no longer flags in the "off" sense
— both default to ON as of 2026-08-31. They still accept an explicit `false` so a backtest can
reconstruct the old arm; nothing in `src/pages/` passes either, and nothing should.

Both are kept rather than deleted so a future session doesn't rediscover the same symptoms and
rebuild the same thing. The full history for both is in `BACKTEST_LOG.md` under 2026-08-31.

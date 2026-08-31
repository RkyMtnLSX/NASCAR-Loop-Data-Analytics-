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
and the DNF resolver reproduces its constants. It prints the caution-bucket calibration row too
— if those numbers have drifted from what the comments say, something changed the wreck layer
and you should find out what before trusting any result.

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

Most take a `SIMS=` environment variable, e.g. `SIMS=20000 node scripts/dnf-per-track.js`.
Lower is faster and noisier. A full holdout run at 10,000 sims takes a couple of minutes.

**Read `BACKTEST_LOG.md` before drawing a conclusion from any of these.** Several of them
produce numbers that look like findings and are not — the caution-bucket row in `sim-smoke` is
deliberate calibration, not a bug, and it has already been misreported once.

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

## What is deliberately switched OFF in the engine

Two experiments live in `simEngine.js` behind flags. Neither is reachable from the website —
nothing in `src/pages/` passes either flag, and that is on purpose.

- **`cautionMix`** — TESTED AND REJECTED on holdout, 2026-08-31. Do not enable.
- **`skillTilt`** — passed some gates, failed others, blocked on data. Do not enable.

Both are kept rather than deleted so a future session doesn't rediscover the same symptoms and
rebuild the same thing. The full history for both is in `BACKTEST_LOG.md` under 2026-08-31.

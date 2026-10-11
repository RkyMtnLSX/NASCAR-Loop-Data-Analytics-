// scripts/backtest-dfs-seed.js — REGISTERED 2026-10-11 (BACKTEST_LOG "PER-USER LINEUP BUILDS"). Reproduces the
// product's GPP build (DFSPage: per-draw optimal candidates + mean-optimizer top-ups, projection cut, stride draws,
// E[max] selector) in node through the SAME exported functions, then compares the deterministic build (D) with seeded
// per-user builds (S0 subset only / S2 / S4 subset + projection jitter) on the 17 graded replay races.
//   DATA=<dir with meta.json + samples_<series>_<rn>.json> USERS=30 SEEDS=20 node scripts/backtest-dfs-seed.js
const fs = require('fs'), path = require('path')
const D = require('./loadDfs')
const E = require('./loadEngine')
const { optimize, bestLineup, makeEmaxSelector, DFS_ROSTER, DFS_CAP } = D
const DATA = process.env.DATA
const USERS = +(process.env.USERS || 30), SEEDS = +(process.env.SEEDS || 20)
const meta = JSON.parse(fs.readFileSync(path.join(DATA, 'meta.json'), 'utf8'))
const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
const rng = (seed) => { let a = (seed * 2654435761) >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const gauss = (r) => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
const dkPts = (fin, st, ll, fl) => E.dkFinishPts(+fin) + ((+st || +fin) - +fin) + 0.25 * (+ll || 0) + 0.45 * (+fl || 0)
const base = n => E.normalizeName(n).replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim()
function resolver(names) { const by = {}; names.forEach(n => { by[base(n)] = n }); return n => by[base(n)] || null }
function placeIn(ladder, entries, score, top) {
  if (score == null) return { pct: null, rank: null }
  if (Array.isArray(top) && top.length && entries && score >= +top[top.length - 1]) { let above = 0; for (let i = 0; i < top.length; i++) { if (+top[i] > score) above++; else break } const rank = above + 1; return { pct: 100 * (1 - (rank - 1) / Math.max(1, entries - 1)), rank } }
  if (!ladder || ladder.length < 2) return { pct: null, rank: null }
  const L = ladder.map(Number), step = 100 / (L.length - 1)
  if (score >= L[0]) return { pct: 100, rank: 1 }
  if (score <= L[L.length - 1]) return { pct: 0, rank: entries || null }
  for (let j = 0; j < L.length - 1; j++) { const hi = L[j], lo = L[j + 1]; if (score <= hi && score >= lo) { const f = hi > lo ? (score - lo) / (hi - lo) : 0; const pct = (100 - (j + 1) * step) + step * f; return { pct, rank: entries ? Math.max(1, Math.round(entries * (100 - pct) / 100)) : null } } }
  return { pct: null, rank: null }
}
function loadRace(key) {
  const m = meta[key]; const [series, rn] = key.split('|')
  const S = JSON.parse(fs.readFileSync(path.join(DATA, `samples_${series}_${rn}.json`), 'utf8'))
  const names = S.drivers, draws = S.samples
  const sal = m.salaries || {}; const outSet = new Set(sal.__out || [])
  const actByN = {}; (m.loop || []).forEach(r => { actByN[r[0]] = dkPts(r[1], r[2], r[3], r[4]) })
  const fp = m.fpts || {}; const rAct = resolver(Object.keys(actByN)), rFp = resolver(Object.keys(fp)), rProj = resolver(Object.keys(m.proj || {}))
  const pool = []
  names.forEach((n, i) => {
    const s = outSet.has(n) ? 0 : (sal[n] || 0); if (!(s > 0)) return
    const kf = rFp(n), ka = rAct(n); const actual = kf != null ? +fp[kf] : (ka != null ? actByN[ka] : null); if (actual == null) return
    const kp = rProj(n); let proj = kp != null ? +m.proj[kp] : NaN; if (!(proj > 0)) { let t = 0; for (let k = 0; k < draws.length; k++) t += draws[k][i] || 0; proj = t / draws.length }
    pool.push({ name: n, idx: i, sal: s, projDK: proj, actual })
  })
  return { key, names, draws, pool, contest: m.contest || {}, nD: draws.length }
}
// one build. drawIdx = the draws used for candidates and the E[max] matrix; jitter = sigma on projDK (per-user)
function build(R, N, drawIdx, sigma, seed) {
  const { names, draws, pool } = R
  const r = rng(seed + 7919)
  const projJ = {}; pool.forEach(d => { projJ[d.name] = sigma > 0 ? d.projDK * (1 + sigma * gauss(r)) : d.projDK })
  const salByIdx = names.map(n => { const d = pool.find(x => x.name === n); return d ? d.sal : 0 })
  const idxOf = {}; names.forEach((n, i) => { idxOf[n] = i })
  // per-draw optimals are a property of the draw, not the user: solved once per race and cached
  if (!R.__opt) { R.__opt = draws.map(row => { const p = []; for (let j = 0; j < names.length; j++) if (salByIdx[j] > 0) p.push({ name: names[j], sal: salByIdx[j], val: row[j] || 0 }); const lu = bestLineup(p); return lu ? lu.slice().sort() : null }) }
  const candMap = new Map()
  for (const di of drawIdx) { const lu = R.__opt[di]; if (lu) { const k = lu.join('|'); if (!candMap.has(k)) candMap.set(k, lu) } }
  const meanRes = optimize(pool.map(d => ({ name: d.name, sal: d.sal, projDK: projJ[d.name] })), new Set(), new Set(), Math.max(300, N * 4))
  if (!meanRes.error) meanRes.lineups.forEach(lu => { const ns = lu.drivers.map(d => d.name); const k = ns.slice().sort().join('|'); if (!candMap.has(k)) candMap.set(k, ns) })
  let cands = Array.from(candMap.values())
  const CAND_MAX = Math.min(6000, Math.max(2000, N * 25))
  if (cands.length > CAND_MAX) cands = cands.map(ns => [ns, ns.reduce((a, n) => a + (projJ[n] || 0), 0)]).sort((x, y) => y[1] - x[1]).slice(0, CAND_MAX).map(x => x[0])
  // E[max] matrix on the (sub)set of draws, like production's DRAW_TARGET stride (2000)
  const T = cands.length > 4000 ? 1500 : 2000
  const stride = Math.max(1, Math.floor(drawIdx.length / T)); const rows = []; for (let i = 0; i < drawIdx.length; i += stride) rows.push(draws[drawIdx[i]])
  const nD = rows.length, nC = cands.length
  const Smat = new Float32Array(nC * nD)
  cands.forEach((ns, c) => { const ids = ns.map(n => idxOf[n]), off = c * nD; for (let d = 0; d < nD; d++) { const rw = rows[d]; Smat[off + d] = rw[ids[0]] + rw[ids[1]] + rw[ids[2]] + rw[ids[3]] + rw[ids[4]] + rw[ids[5]] } })
  const sel = makeEmaxSelector(nC, nD, Smat, N, cands, () => Infinity, DFS_ROSTER); sel.step(0)
  return sel.chosen.map(c => cands[c].slice().sort())
}
const keyOf = ns => ns.join('|')
function emaxFull(R, set) { const { draws, names } = R; const idxOf = {}; names.forEach((n, i) => { idxOf[n] = i }); const ids = set.map(ns => ns.map(n => idxOf[n])); let e = 0; for (const rw of draws) { let b = -Infinity; for (const id of ids) { const v = rw[id[0]] + rw[id[1]] + rw[id[2]] + rw[id[3]] + rw[id[4]] + rw[id[5]]; if (v > b) b = v } e += b } return e / draws.length }
function realised(R, set) { const byN = {}; R.pool.forEach(d => { byN[d.name] = d.actual }); const best = Math.max(...set.map(ns => ns.reduce((a, n) => a + byN[n], 0))); const c = R.contest; return placeIn(c.scores_sample, c.entries, best, c.scores_top).pct }
const allIdx = n => Array.from({ length: n }, (_, i) => i)
const subsetIdx = (n, k, seed) => { const r = rng(seed); const a = allIdx(n); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t } return a.slice(0, k).sort((x, y) => x - y) }
const ARMS = { S0: 0, S2: 0.02, S4: 0.04 }
const out = {}
for (const key of Object.keys(meta)) {
  const R = loadRace(key); if (R.pool.length < DFS_ROSTER) { console.log(key, 'skipped: pool', R.pool.length); continue }
  for (const N of [20, 150]) {
    const t0 = Date.now()
    const Dset = build(R, N, allIdx(R.nD), 0, 0)
    const Dkeys = new Set(Dset.map(keyOf)); const Dtop = keyOf(Dset[0])
    const row = { D: { emax: emaxFull(R, Dset), pct: realised(R, Dset) } }
    for (const arm of Object.keys(ARMS)) {
      const sets = []; for (let u = 1; u <= USERS; u++) sets.push(build(R, N, subsetIdx(R.nD, 2500, u * 1000 + 1), ARMS[arm], u))
      // reproducibility
      const again = build(R, N, subsetIdx(R.nD, 2500, 1 * 1000 + 1), ARMS[arm], 1); if (again.map(keyOf).join(';') !== sets[0].map(keyOf).join(';')) throw new Error('not reproducible ' + key + ' ' + arm)
      const count = {}; sets.forEach(s => new Set(s.map(keyOf)).forEach(k => { count[k] = (count[k] || 0) + 1 }))
      const shared = mean(sets.map(s => s.filter(ns => count[keyOf(ns)] > 1).length))
      const maxHold = Math.max(...Object.values(count)); const holdDtop = sets.filter(s => s.some(ns => keyOf(ns) === Dtop)).length
      const qs = sets.slice(0, SEEDS); const em = mean(qs.map(s => emaxFull(R, s))); const pc = qs.map(s => realised(R, s)).filter(x => x != null)
      row[arm] = { shared, maxHold, holdDtop, emax: em, emaxRel: em / row.D.emax - 1, pct: pc.length ? mean(pc) : null, pctMin: pc.length ? Math.min(...pc) : null, pctMax: pc.length ? Math.max(...pc) : null }
    }
    out[key + '|' + N] = row
    console.log(`${key} N${N}  D emax ${row.D.emax.toFixed(1)} pct ${row.D.pct == null ? '-' : row.D.pct.toFixed(1)} | ` + Object.keys(ARMS).map(a => `${a}: shared ${row[a].shared.toFixed(1)}/${N} maxHold ${row[a].maxHold}/${USERS} Dtop ${row[a].holdDtop} emax ${(100 * row[a].emaxRel).toFixed(2)}% pct ${row[a].pct == null ? '-' : row[a].pct.toFixed(1)} [${row[a].pctMin == null ? '' : row[a].pctMin.toFixed(0)}-${row[a].pctMax == null ? '' : row[a].pctMax.toFixed(0)}]`).join(' | ') + `  (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
  }
}
fs.writeFileSync(path.join(__dirname, 'backtest-data', 'dfs-seed-result.json'), JSON.stringify(out, null, 1))
console.log('\nSUMMARY (mean over races)')
for (const N of [20, 150]) { const rows = Object.keys(out).filter(k => k.endsWith('|' + N)).map(k => out[k])
  for (const arm of Object.keys(ARMS)) console.log(`N${N} ${arm}: shared ${mean(rows.map(r => r[arm].shared)).toFixed(2)}/${N}  maxHold ${mean(rows.map(r => r[arm].maxHold)).toFixed(1)}/${USERS}  Dtop held by ${mean(rows.map(r => r[arm].holdDtop)).toFixed(1)}  emax vs D ${(100 * mean(rows.map(r => r[arm].emaxRel))).toFixed(2)}%  realised pct D ${mean(rows.map(r => r.D.pct).filter(x => x != null)).toFixed(1)} vs ${mean(rows.map(r => r[arm].pct).filter(x => x != null)).toFixed(1)}`) }

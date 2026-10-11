// scripts/backtest-dfs-prize.js — REGISTERED 2026-10-11 (BACKTEST_LOG "CONTEST-AWARE LINEUP SELECTION"). The product's
// GPP candidate pool (per-draw optimals + mean top-ups, projection cut) scored two ways on the 17 replay races:
//   D  = today's E[max] set (makeEmaxSelector)
//   P  = top-N candidates by expected PRIZE against a simulated field built from PROJECTED ownership, with dupes priced in
//   PA = same with ACTUAL ownership (oracle arm, reported only)
// Realised prize / best-of-N percentile on the real contest ladder decide (same synthetic payout curve as DfsReplay).
//   DATA=<dir> node scripts/backtest-dfs-prize.js
const fs = require('fs'), path = require('path')
const D = require('./loadDfs'); const E = require('./loadEngine')
const { optimize, bestLineup, makeEmaxSelector, projectOwnership, DFS_ROSTER, DFS_CAP } = D
const DATA = process.env.DATA
const meta = JSON.parse(fs.readFileSync(path.join(DATA, 'meta.json'), 'utf8'))
const OWN = JSON.parse(fs.readFileSync(path.join(DATA, 'own.json'), 'utf8'))
// REAL FIELD (2026-10-11 re-run): FIELD=real uses the actual contest entries (every lineup, duplicates expanded) from the
// operator's DK standings exports (field/<contest>.json, mapped to races in field-map.json). Races without a file are skipped.
const REAL = process.env.FIELD === 'real'
const TIE = process.env.TIE === '1'   // stage 3: DK tie rule - tied block's average prize instead of prize/(1+k)
const FMAP = REAL ? JSON.parse(fs.readFileSync(path.join(DATA, 'field-map.json'), 'utf8')) : {}
const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
const rng = (seed) => { let a = (seed * 2654435761) >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const dkPts = (fin, st, ll, fl) => E.dkFinishPts(+fin) + ((+st || +fin) - +fin) + 0.25 * (+ll || 0) + 0.45 * (+fl || 0)
const base = n => E.normalizeName(n).replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim()
const resolver = names => { const by = {}; names.forEach(n => { by[base(n)] = n }); return n => by[base(n)] || null }
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
// the DfsReplay prize curve: top 20% cash, prize ~ r^-0.75, entry-fee units, normalised to the entry count
const prizeFn = (E_) => { const R = Math.floor(0.2 * E_); let Z = 0; for (let r = 1; r <= R; r++) Z += Math.pow(r, -0.75); return r => (E_ && r >= 1 && r <= R) ? E_ * Math.pow(r, -0.75) / Z : 0 }
function loadRace(key) {
  const m = meta[key]; const [series, rn] = key.split('|')
  const S = JSON.parse(fs.readFileSync(path.join(DATA, `samples_${series}_${rn}.json`), 'utf8'))
  const names = S.drivers, draws = S.samples; const sal = m.salaries || {}; const outSet = new Set(sal.__out || [])
  const actByN = {}; (m.loop || []).forEach(r => { actByN[r[0]] = dkPts(r[1], r[2], r[3], r[4]) })
  const fp = m.fpts || {}; const rAct = resolver(Object.keys(actByN)), rFp = resolver(Object.keys(fp)), rProj = resolver(Object.keys(m.proj || {})), rOwn = resolver(Object.keys(OWN[key] || {}))
  const pool = []
  names.forEach((n, i) => {
    const s = outSet.has(n) ? 0 : (sal[n] || 0); if (!(s > 0)) return
    const kf = rFp(n), ka = rAct(n); const actual = kf != null ? +fp[kf] : (ka != null ? actByN[ka] : null); if (actual == null) return
    const kp = rProj(n); let proj = kp != null ? +m.proj[kp] : NaN; if (!(proj > 0)) { let t = 0; for (let k = 0; k < draws.length; k++) t += draws[k][i] || 0; proj = t / draws.length }
    const ko = rOwn(n); pool.push({ name: n, idx: i, sal: s, projDK: proj, actual, ownAct: ko != null ? +OWN[key][ko] : null })
  })
  return { key, names, draws, pool, contest: m.contest || {}, nD: draws.length, entries: (m.contest || {}).entries || 1000 }
}
function candidates(R, N) {
  const { names, draws, pool } = R; const salByIdx = names.map(n => { const d = pool.find(x => x.name === n); return d ? d.sal : 0 })
  if (!R.__opt) R.__opt = draws.map(row => { const p = []; for (let j = 0; j < names.length; j++) if (salByIdx[j] > 0) p.push({ name: names[j], sal: salByIdx[j], val: row[j] || 0 }); const lu = bestLineup(p); return lu ? lu.slice().sort() : null })
  const candMap = new Map(); for (const lu of R.__opt) { if (lu) { const k = lu.join('|'); if (!candMap.has(k)) candMap.set(k, lu) } }
  const mr = optimize(pool.map(d => ({ name: d.name, sal: d.sal, projDK: d.projDK })), new Set(), new Set(), Math.max(300, N * 4)); if (!mr.error) mr.lineups.forEach(lu => { const ns = lu.drivers.map(d => d.name).sort(); const k = ns.join('|'); if (!candMap.has(k)) candMap.set(k, ns) })
  let cands = Array.from(candMap.values()); const pj = {}; pool.forEach(d => { pj[d.name] = d.projDK }); const CM = Math.min(6000, Math.max(2000, N * 25))
  if (cands.length > CM) cands = cands.map(ns => [ns, ns.reduce((a, n) => a + pj[n], 0)]).sort((x, y) => y[1] - x[1]).slice(0, CM).map(x => x[0])
  const stride = Math.max(1, Math.floor(draws.length / 2000)); const rows = []; for (let i = 0; i < draws.length; i += stride) rows.push(draws[i])
  const idxOf = {}; names.forEach((n, i) => { idxOf[n] = i })
  const nD = rows.length, nC = cands.length; const Smat = new Float32Array(nC * nD)
  cands.forEach((ns, c) => { const ids = ns.map(n => idxOf[n]), off = c * nD; for (let d = 0; d < nD; d++) { const rw = rows[d]; Smat[off + d] = rw[ids[0]] + rw[ids[1]] + rw[ids[2]] + rw[ids[3]] + rw[ids[4]] + rw[ids[5]] } })
  return { cands, rows, Smat, nD, nC, idxOf }
}
// FIELD: F lineups sampled by ownership (6 distinct drivers, cap-legal), once per race per ownership source
function sampleField(R, ownMap, F, seed) {
  const r = rng(seed); const pool = R.pool.filter(d => (ownMap[d.name] || 0) > 0); const w = pool.map(d => ownMap[d.name]); const W = w.reduce((a, b) => a + b, 0)
  const out = []; let tries = 0
  while (out.length < F && tries < F * 50) {
    tries++; const pick = new Set(); let sal = 0
    for (let k = 0; k < 40 && pick.size < DFS_ROSTER; k++) { let u = r() * W; let j = 0; while (j < pool.length - 1 && (u -= w[j]) > 0) j++; if (!pick.has(j)) { pick.add(j); sal += pool[j].sal } }
    if (pick.size === DFS_ROSTER && sal <= DFS_CAP) out.push(Array.from(pick).map(j => pool[j].name).sort())
  }
  return out
}
function prizeMatrix(R, C, field) {   // stage 2: per-draw prize / (1 + dupes) as the selector's matrix
  const { rows, nD, cands, nC, idxOf } = C; const F = field.length; const E_ = R.entries; const prize = prizeFn(E_)
  const fIds = field.map(ns => ns.map(n => idxOf[n])); const fCount = {}; field.forEach(ns => { const k = ns.join('|'); fCount[k] = (fCount[k] || 0) + 1 })
  const dupes = cands.map(ns => (fCount[ns.join('|')] || 0) * E_ / F)
  const M = new Float32Array(nC * nD); const fs_ = new Float64Array(F)
  for (let d = 0; d < nD; d++) {
    const rw = rows[d]; for (let f = 0; f < F; f++) { const id = fIds[f]; fs_[f] = rw[id[0]] + rw[id[1]] + rw[id[2]] + rw[id[3]] + rw[id[4]] + rw[id[5]] }
    const sorted = Float64Array.from(fs_).sort()
    for (let c = 0; c < nC; c++) { const v = C.Smat[c * nD + d]; let lo = 0, hi = F; while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] > v) hi = mid; else lo = mid + 1 } const rank = 1 + Math.round((F - lo) * E_ / F); if (TIE) { const k = Math.round(dupes[c]); let t = 0; for (let j = 0; j <= k; j++) t += prize(rank + j); M[c * nD + d] = t / (k + 1) } else M[c * nD + d] = prize(rank) / (1 + dupes[c]) }
  }
  return { M, dupes }
}
function prizeScores(R, C, field) {
  const { rows, nD, cands, nC, idxOf } = C; const F = field.length; const E_ = R.entries; const prize = prizeFn(E_)
  const fIds = field.map(ns => ns.map(n => idxOf[n]))
  // dupes: exact matches in the sampled field, scaled to entries
  const fCount = {}; field.forEach(ns => { const k = ns.join('|'); fCount[k] = (fCount[k] || 0) + 1 })
  const dupes = cands.map(ns => (fCount[ns.join('|')] || 0) * E_ / F)
  // per draw: sorted field scores
  const exp = new Float64Array(nC)
  const fs_ = new Float64Array(F)
  for (let d = 0; d < nD; d++) {
    const rw = rows[d]
    for (let f = 0; f < F; f++) { const id = fIds[f]; fs_[f] = rw[id[0]] + rw[id[1]] + rw[id[2]] + rw[id[3]] + rw[id[4]] + rw[id[5]] }
    const sorted = Float64Array.from(fs_).sort()
    for (let c = 0; c < nC; c++) {
      const v = C.Smat[c * nD + d]
      // number of field lineups strictly above v -> rank among entries
      let lo = 0, hi = F; while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] > v) hi = mid; else lo = mid + 1 }
      const above = F - lo; const rank = 1 + Math.round(above * E_ / F)
      exp[c] += prize(rank) / (1 + dupes[c])
    }
  }
  for (let c = 0; c < nC; c++) exp[c] /= nD
  return { exp, dupes }
}
function realised(R, set) { const byN = {}; R.pool.forEach(d => { byN[d.name] = d.actual }); const c = R.contest; const prize = prizeFn(R.entries)
  let tot = 0, best = -Infinity; for (const ns of set) { const a = ns.reduce((s, n) => s + byN[n], 0); const p = placeIn(c.scores_sample, R.entries, a, c.scores_top); if (p.rank) tot += prize(p.rank); if (p.pct != null && p.pct > best) best = p.pct }
  return { prize: tot, pct: best === -Infinity ? null : best } }
const out = {}; const sums = {}
for (const key of Object.keys(meta)) {
  const R = loadRace(key); if (R.pool.length < DFS_ROSTER) continue
  const ownP = projectOwnership(R.pool.map(d => ({ name: d.name, sal: d.sal, projDK: d.projDK })))
  const ownA = {}; R.pool.forEach(d => { if (d.ownAct != null) ownA[d.name] = d.ownAct })
  const F = Math.min(R.entries, 5000)
  let fieldP, fieldA = null
  if (REAL) {
    if (!FMAP[key]) { console.log(key, 'no real field file - skipped'); continue }
    const FF = JSON.parse(fs.readFileSync(path.join(DATA, 'field', FMAP[key] + '.json'), 'utf8'))
    const rF = resolver(R.pool.map(d => d.name)); const okN = new Set(R.pool.map(d => d.name))
    fieldP = []; let dropped = 0
    FF.lineups.forEach(([names, count]) => { const ns = names.map(n => rF(n)); if (ns.every(n => n && okN.has(n))) { const srt = ns.slice().sort(); for (let i = 0; i < count; i++) fieldP.push(srt) } else dropped += count })
    R.entries = FF.entries; console.log(`${key} real field ${FF.contest_id}: ${fieldP.length} entries (${dropped} dropped on name match), ${FF.unique} unique, max dupe ${Math.max(...FF.lineups.map(l => l[1]))}`)
  } else { fieldP = sampleField(R, ownP, F, 11); fieldA = Object.keys(ownA).length >= DFS_ROSTER ? sampleField(R, ownA, F, 11) : null }
  for (const N of [20, 150]) {
    const t0 = Date.now(); const C = candidates(R, N)
    const sel = makeEmaxSelector(C.nC, C.nD, C.Smat, N, C.cands, () => Infinity, DFS_ROSTER); sel.step(0); const Dset = sel.chosen.map(c => C.cands[c])
    const PS = prizeScores(R, C, fieldP); const Pidx = Array.from({ length: C.nC }, (_, c) => c).sort((a, b) => PS.exp[b] - PS.exp[a]).slice(0, N); const Pset = Pidx.map(c => C.cands[c])
    let PAset = null, PAS = null; if (fieldA) { PAS = prizeScores(R, C, fieldA); PAset = Array.from({ length: C.nC }, (_, c) => c).sort((a, b) => PAS.exp[b] - PAS.exp[a]).slice(0, N).map(c => C.cands[c]) }
    const chalk = set => mean(set.map(ns => mean(ns.map(n => ownP[n] || 0))))
    const dupeTop = (set, S_) => { const k = set[0].join('|'); const c = C.cands.findIndex(ns => ns.join('|') === k); return c >= 0 ? S_.dupes[c] : null }
    const expOf = (set, S_) => mean(set.map(ns => { const c = C.cands.findIndex(x => x.join('|') === ns.join('|')); return S_.exp[c] }))
    let PXset = null; if (REAL) { const PM = prizeMatrix(R, C, fieldP); const selX = makeEmaxSelector(C.nC, C.nD, PM.M, N, C.cands, () => Infinity, DFS_ROSTER); selX.step(0); PXset = selX.chosen.map(c => C.cands[c]) }
    const rPX = PXset ? realised(R, PXset) : null
    const rD = realised(R, Dset), rP = realised(R, Pset), rPA = PAset ? realised(R, PAset) : null
    const row = { entries: R.entries, D: { ...rD, exp: expOf(Dset, PS), chalk: chalk(Dset), dupeTop: dupeTop(Dset, PS) }, P: { ...rP, exp: expOf(Pset, PS), chalk: chalk(Pset), dupeTop: dupeTop(Pset, PS), overlap: Pset.filter(ns => Dset.some(d => d.join('|') === ns.join('|'))).length },
      PA: rPA ? { ...rPA, exp: expOf(PAset, PAS), chalk: chalk(PAset), dupeTop: dupeTop(PAset, PAS) } : null,
      PX: rPX ? { ...rPX, chalk: chalk(PXset), dupeTop: dupeTop(PXset, PS), overlap: PXset.filter(ns => Dset.some(d => d.join('|') === ns.join('|'))).length } : null }
    out[key + '|' + N] = row
    const s = sums[N] = sums[N] || { D: 0, P: 0, PA: 0, PX: 0, wP: 0, lP: 0, wPA: 0, lPA: 0, wPX: 0, lPX: 0, pD: [], pP: [], pPA: [], pPX: [] }
    if (rPX) { s.PX += rPX.prize; if (rPX.prize > rD.prize) s.wPX++; else if (rPX.prize < rD.prize) s.lPX++; s.pPX.push(rPX.pct) }
    s.D += rD.prize; s.P += rP.prize; if (rP.prize > rD.prize) s.wP++; else if (rP.prize < rD.prize) s.lP++; s.pD.push(rD.pct); s.pP.push(rP.pct)
    if (rPA) { s.PA += rPA.prize; if (rPA.prize > rD.prize) s.wPA++; else if (rPA.prize < rD.prize) s.lPA++; s.pPA.push(rPA.pct) }
    console.log(`${key.padEnd(11)} N${String(N).padEnd(3)} ent ${String(R.entries).padStart(5)} | D prize ${rD.prize.toFixed(1).padStart(6)} pct ${rD.pct == null ? '  -' : rD.pct.toFixed(0).padStart(3)} chalk ${row.D.chalk.toFixed(0)}% dupe#1 ${row.D.dupeTop == null ? '-' : row.D.dupeTop.toFixed(1)} | P prize ${rP.prize.toFixed(1).padStart(6)} pct ${rP.pct == null ? '  -' : rP.pct.toFixed(0).padStart(3)} chalk ${row.P.chalk.toFixed(0)}% dupe#1 ${row.P.dupeTop == null ? '-' : row.P.dupeTop.toFixed(1)} overlap ${row.P.overlap}/${N} | PA ${rPA ? rPA.prize.toFixed(1) : '-'}/${rPA && rPA.pct != null ? rPA.pct.toFixed(0) : '-'} | PX prize ${rPX ? rPX.prize.toFixed(1).padStart(6) : '-'} pct ${rPX && rPX.pct != null ? rPX.pct.toFixed(0) : '-'} chalk ${rPX ? row.PX.chalk.toFixed(0) + '%' : '-'} dupe#1 ${rPX && row.PX.dupeTop != null ? row.PX.dupeTop.toFixed(1) : '-'} overlap ${rPX ? row.PX.overlap : '-'}/${N}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
  }
}
fs.writeFileSync(path.join(__dirname, 'backtest-data', `dfs-prize-result${REAL ? '-real' : ''}${TIE ? '-tie' : ''}.json`), JSON.stringify(out, null, 1))
console.log('\nSUMMARY (realised prize summed over races, synthetic curve in entry-fee units; W/L by race vs D)')
for (const N of [20, 150]) { const s = sums[N]; console.log(`N${N}: D ${s.D.toFixed(1)} | P ${s.P.toFixed(1)} (W/L ${s.wP}/${s.lP}) | PA ${s.PA.toFixed(1)} (W/L ${s.wPA}/${s.lPA}) | PX ${s.PX.toFixed(1)} (W/L ${s.wPX}/${s.lPX}) | best-of-N pct D ${mean(s.pD.filter(x => x != null)).toFixed(1)} P ${mean(s.pP.filter(x => x != null)).toFixed(1)} PA ${mean(s.pPA.filter(x => x != null)).toFixed(1)} PX ${mean(s.pPX.filter(x => x != null)).toFixed(1)}`) }

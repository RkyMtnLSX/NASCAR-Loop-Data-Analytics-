// Fade test: users who EXCLUDE a chalk driver. Same build as production with an exclude set: candidates = per-draw
// optimals not containing him + mean optimizer with him excluded. Scenario A: all 30 users fade the #1 projected driver.
// Scenario B: each user fades one of the top-5 projected drivers at random. Scenario C: half fade #1, half fade nobody.
const fs = require('fs'), path = require('path')
const D = require('./loadDfs'); const E = require('./loadEngine')
const { optimize, bestLineup, makeEmaxSelector, DFS_ROSTER } = D
const DATA = process.env.DATA; const meta = JSON.parse(fs.readFileSync(path.join(DATA, 'meta.json'), 'utf8'))
const mean = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length)
const rng = (seed) => { let a = (seed * 2654435761) >>> 0; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const base = n => E.normalizeName(n).replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim()
const resolver = names => { const by = {}; names.forEach(n => { by[base(n)] = n }); return n => by[base(n)] || null }
function loadRace(key) { const m = meta[key]; const [series, rn] = key.split('|'); const S = JSON.parse(fs.readFileSync(path.join(DATA, `samples_${series}_${rn}.json`), 'utf8'))
  const names = S.drivers, draws = S.samples; const sal = m.salaries || {}; const outSet = new Set(sal.__out || []); const rProj = resolver(Object.keys(m.proj || {}))
  const pool = []; names.forEach((n, i) => { const s = outSet.has(n) ? 0 : (sal[n] || 0); if (!(s > 0)) return; const kp = rProj(n); let proj = kp != null ? +m.proj[kp] : NaN; if (!(proj > 0)) { let t = 0; for (let k = 0; k < draws.length; k++) t += draws[k][i] || 0; proj = t / draws.length } pool.push({ name: n, idx: i, sal: s, projDK: proj }) })
  const salByIdx = names.map(n => { const d = pool.find(x => x.name === n); return d ? d.sal : 0 })
  const opt = draws.map(row => { const p = []; for (let j = 0; j < names.length; j++) if (salByIdx[j] > 0) p.push({ name: names[j], sal: salByIdx[j], val: row[j] || 0 }); const lu = bestLineup(p); return lu ? lu.slice().sort() : null })
  return { key, names, draws, pool, opt } }
function build(R, N, excl) { const { names, draws, pool, opt } = R; const idxOf = {}; names.forEach((n, i) => { idxOf[n] = i })
  const candMap = new Map(); for (const lu of opt) { if (!lu || lu.some(n => excl.has(n))) continue; const k = lu.join('|'); if (!candMap.has(k)) candMap.set(k, lu) }
  const mr = optimize(pool.map(d => ({ name: d.name, sal: d.sal, projDK: d.projDK })), new Set(), excl, Math.max(300, N * 4)); if (!mr.error) mr.lineups.forEach(lu => { const ns = lu.drivers.map(d => d.name).sort(); const k = ns.join('|'); if (!candMap.has(k)) candMap.set(k, ns) })
  let cands = Array.from(candMap.values()); const pj = {}; pool.forEach(d => { pj[d.name] = d.projDK }); const CM = Math.min(6000, Math.max(2000, N * 25))
  if (cands.length > CM) cands = cands.map(ns => [ns, ns.reduce((a, n) => a + pj[n], 0)]).sort((x, y) => y[1] - x[1]).slice(0, CM).map(x => x[0])
  const stride = Math.max(1, Math.floor(draws.length / 2000)); const rows = []; for (let i = 0; i < draws.length; i += stride) rows.push(draws[i])
  const nD = rows.length, nC = cands.length; const Smat = new Float32Array(nC * nD)
  cands.forEach((ns, c) => { const ids = ns.map(n => idxOf[n]), off = c * nD; for (let d = 0; d < nD; d++) { const rw = rows[d]; Smat[off + d] = rw[ids[0]] + rw[ids[1]] + rw[ids[2]] + rw[ids[3]] + rw[ids[4]] + rw[ids[5]] } })
  const sel = makeEmaxSelector(nC, nD, Smat, N, cands, () => Infinity, DFS_ROSTER); sel.step(0); return sel.chosen.map(c => cands[c].join('|')) }
const USERS = 30, N = 20; const res = { A: [], B: [], C: [] }
for (const key of Object.keys(meta)) {
  const R = loadRace(key); const top5 = R.pool.slice().sort((a, b) => b.projDK - a.projDK).slice(0, 5).map(d => d.name)
  const stats = sets => { const count = {}; sets.forEach(s => new Set(s).forEach(k => { count[k] = (count[k] || 0) + 1 })); return { shared: mean(sets.map(s => s.filter(k => count[k] > 1).length)), maxHold: Math.max(...Object.values(count)) } }
  const cache = {}; const bx = (ex) => { const k = [...ex].sort().join(','); if (!cache[k]) cache[k] = build(R, N, ex); return cache[k] }
  const A = Array.from({ length: USERS }, () => bx(new Set([top5[0]])))
  const r = rng(99); const B = Array.from({ length: USERS }, () => bx(new Set([top5[Math.floor(r() * 5)]])))
  const C = Array.from({ length: USERS }, (_, u) => bx(u % 2 ? new Set([top5[0]]) : new Set()))
  const sA = stats(A), sB = stats(B), sC = stats(C); res.A.push(sA); res.B.push(sB); res.C.push(sC)
  console.log(`${key.padEnd(12)} fade#1(${top5[0]}): all-fade shared ${sA.shared.toFixed(1)}/20 hold ${sA.maxHold}/30 | random top-5 fade: shared ${sB.shared.toFixed(1)}/20 hold ${sB.maxHold}/30 | half fade #1: shared ${sC.shared.toFixed(1)}/20 hold ${sC.maxHold}/30`)
}
for (const k of ['A', 'B', 'C']) console.log(k, 'mean shared', mean(res[k].map(x => x.shared)).toFixed(2), 'mean maxHold', mean(res[k].map(x => x.maxHold)).toFixed(1))

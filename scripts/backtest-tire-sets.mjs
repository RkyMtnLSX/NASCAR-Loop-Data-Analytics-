// backtest-tire-sets.mjs (2026-09-05) - v6.4-sets gate: set-aware tire age vs legacy reset-per-stint.
// Data (pulled by SQL into ../backtest-data/tire-sets/): laps.txt "year|rn|driver|lap|time|captured_at"
// for every cup session labeled tire_sets=1 in practice_sessions; ratings.txt "year|rn|driver|driver_rating"
// from loop_data; groups.txt "year|rn|driver|practice_group". Ranked within practice_group, no gc priors
// (the gc correction is orthogonal). Metric: per-session Spearman of grade rank vs race-day driver rating.
//   node scripts/backtest-tire-sets.mjs [K=1] [thr=0.02]
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { gradePracticeSession, assignTireSets } from '../src/lib/practiceGrader.js'
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'backtest-data', 'tire-sets')
const laps = fs.readFileSync(path.join(dir, 'laps.txt'), 'utf8').split('\n').map(l => l.split('|'))
const ratings = {}; fs.readFileSync(path.join(dir, 'ratings.txt'), 'utf8').split('\n').forEach(l => { const [y, r, d, v] = l.split('|'); ratings[y + '|' + r + '|' + d] = +v })
const groups = {}; fs.readFileSync(path.join(dir, 'groups.txt'), 'utf8').split('\n').forEach(l => { const [y, r, d, g] = l.split('|'); groups[y + '|' + r + '|' + d] = g || null })
const sess = {}
laps.forEach(([y, r, d, n, t, ts]) => { const k = y + '|' + r; const S = sess[k] = sess[k] || {}; const D = S[d] = S[d] || { driver: d, lapData: {}, lapTs: {}, group: groups[k + '|' + d] || null }; D.lapData[n] = +t; if (ts) D.lapTs[n] = ts })
function spearman(a, b) { const n = a.length; const rk = v => { const idx = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(n); idx.forEach((p, i) => { r[p[1]] = i + 1 }); return r }; const ra = rk(a), rb = rk(b); let d2 = 0; for (let i = 0; i < n; i++) d2 += (ra[i] - rb[i]) ** 2; return 1 - 6 * d2 / (n * (n * n - 1)) }
const K = +process.argv[2] || 1, thr = +(process.argv[3] || 0.02)
const res = []
for (const k of Object.keys(sess).sort()) {
  const all = Object.values(sess[k]); const gs = [...new Set(all.map(d => d.group || '__all'))]
  let sA = 0, sB = 0, n = 0
  for (const g of gs) {
    const drivers = all.filter(d => (d.group || '__all') === g)
    const outA = gradePracticeSession(drivers.map(d => ({ ...d })), null)
    const outB = gradePracticeSession(drivers.map(d => ({ ...d, lapAge: assignTireSets(d.lapData, K, thr).age })), null, { tireSets: K })
    const rho = (out) => { const rows = out.filter(d => d.rank != null && ratings[k + '|' + d.driver] != null); if (rows.length < 8) return null; return spearman(rows.map(d => d.rank), rows.map(d => -ratings[k + '|' + d.driver])) }
    const rA = rho(outA), rB = rho(outB); if (rA == null) continue
    sA += rA * drivers.length; sB += rB * drivers.length; n += drivers.length
  }
  if (n) res.push({ k, rA: sA / n, rB: sB / n })
}
let W = 0, L = 0, T = 0; res.forEach(r => { const d = r.rB - r.rA; if (d > 0.005) W++; else if (d < -0.005) L++; else T++ })
const mean = a => a.reduce((x, y) => x + y, 0) / a.length
console.log(`K=${K} thr=${thr}  sessions ${res.length}  rhoSpeed legacy ${mean(res.map(r => r.rA)).toFixed(4)}  set-aware ${mean(res.map(r => r.rB)).toFixed(4)}  W${W}/L${L}/T${T}`)
res.forEach(r => console.log(r.k.padEnd(9), r.rA.toFixed(3), r.rB.toFixed(3), (r.rB - r.rA >= 0 ? '+' : '') + (r.rB - r.rA).toFixed(3)))

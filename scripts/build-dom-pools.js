// scripts/build-dom-pools.js — REGISTERED 2026-10-09 stage 2 (BACKTEST_LOG): per-draw dominator bootstrap pools.
// Source: backtest-data/dom-pool-source.json = loop_data 2022-24, one row per race (>= 20 rows): sorted laps-led
// and fastest-laps counts, caution count, race laps. Output: backtest-data/dom-pools.json keyed
// series -> group -> { LL: {low, mid, high: [vector x N]}, FL: {...} }, each vector = 40 shares summing to 1.
// Bucket with < 20 races -> the group's pooled set; series x group with < 20 races -> all-series pool for the group.
const fs = require('fs'), path = require('path')
const E = require('./loadEngine')
const D = f => path.join(__dirname, 'backtest-data', f)
const src = JSON.parse(fs.readFileSync(D('dom-pool-source.json'), 'utf8'))
const bucket = c => (c == null ? 'mid' : c <= 5 ? 'low' : c <= 8 ? 'mid' : 'high')
const pad = v => { const o = new Array(40).fill(0); for (let i = 0; i < Math.min(40, v.length); i++) o[i] = v[i]; const t = o.reduce((a, c) => a + c, 0); return t > 0 ? o.map(x => x / t) : null }
const raw = {}   // series|group -> {LL:{low,mid,high}, FL:{...}}
const add = (key, T, cb, vec) => { const k = raw[key] = raw[key] || { LL: { low: [], mid: [], high: [] }, FL: { low: [], mid: [], high: [] } }; k[T][cb].push(vec) }
let used = 0
for (const r of src) {
  const g = E.__trackGroup(r.track_name)
  const ll = r.ll.split(',').map(Number), fl = r.fl.split(',').map(Number)
  if (ll.reduce((a, c) => a + c, 0) < 20) continue   // no lap data for this race
  const vLL = pad(ll), vFL = pad(fl); if (!vLL || !vFL) continue
  const cb = bucket(r.cau)
  add(r.series + '|' + g, 'LL', cb, vLL); add(r.series + '|' + g, 'FL', cb, vFL)
  add('all|' + g, 'LL', cb, vLL); add('all|' + g, 'FL', cb, vFL)
  used++
}
const out = {}, report = []
for (const series of ['cup', 'oreilly', 'trucks']) {
  out[series] = {}
  for (const g of ['INT', 'SHORT', 'ROAD', 'SS']) {
    const own = raw[series + '|' + g], all = raw['all|' + g]
    const total = own ? own.LL.low.length + own.LL.mid.length + own.LL.high.length : 0
    const srcSet = total >= 20 ? own : all
    if (!srcSet) continue
    const o = { LL: {}, FL: {} }
    for (const T of ['LL', 'FL']) {
      const pooled = [].concat(srcSet[T].low, srcSet[T].mid, srcSet[T].high)
      for (const cb of ['low', 'mid', 'high']) o[T][cb] = srcSet[T][cb].length >= 20 ? srcSet[T][cb] : pooled
    }
    out[series][g] = o
    report.push(`${series} ${g}: ${total} own races -> ${total >= 20 ? 'own' : 'ALL-series'} pool (low ${srcSet.LL.low.length} / mid ${srcSet.LL.mid.length} / high ${srcSet.LL.high.length}); mean top LL share ${(100 * [].concat(srcSet.LL.low, srcSet.LL.mid, srcSet.LL.high).reduce((s, v) => s + v[0], 0) / [].concat(srcSet.LL.low, srcSet.LL.mid, srcSet.LL.high).length).toFixed(1)}%`)
  }
}
fs.writeFileSync(D('dom-pools.json'), JSON.stringify(out))
console.log(used + ' races pooled'); report.forEach(l => console.log('  ' + l))

// src/lib/gradeRace.js - grading a published board against the loop data (2026-10-11). Moved out of
// GradeCenter.js verbatim so the Load Race button can grade and log CLV in the same click (operator:
// "we need to focus on streamlining the processes"). GradeCenter keeps its UI and calls these.
import { supabase } from './supabase'

// Shared driver-name key (2026-08-30). NFD-folds accents BEFORE stripping non-alphanumerics.
// Every name join in this file goes through this - see the accent-bug note in __gradeRace.
export const __nmName = x => (x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')

export function __parseFinish(txt, board) {
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\b(jr|sr|iii|ii|iv)\b/g, '').replace(/\s+/g, ' ').trim()
  const byFull = {}, byCar = {}, lastCount = {}, byLast = {}
  board.forEach(d => {
    const full = norm(d.driver_name)
    byFull[full] = d
    byCar[String(d.car_number)] = d
    const last = full.split(' ').slice(-1)[0]
    lastCount[last] = (lastCount[last] || 0) + 1
    byLast[last] = d
  })
  const lines = txt.split('\n').map(l => l.trim()).filter(Boolean)
  const actualMap = {}, matched = [], unmatched = []
  let pos = 0
  lines.forEach(line => {
    const nl = norm(line)
    let d = null
    for (const f in byFull) { if (f && nl.indexOf(f) >= 0) { d = byFull[f]; break } }
    if (!d) { const toks = nl.split(' '); for (const t of toks) { if (lastCount[t] === 1) { d = byLast[t]; break } } }
    if (!d) { const cars = line.match(/\b\d{1,2}\b/g) || []; for (const cc of cars) { if (byCar[cc]) { d = byCar[cc]; break } } }
    if (d) { if (!actualMap[String(d.car_number)]) { pos++; actualMap[String(d.car_number)] = pos; matched.push(d.driver_name) } }
    else unmatched.push(line.slice(0, 40))
  })
  return { actualMap, matched, unmatched }
}

export function __gradeRace(board, actualMap, preOwned, dkActMap, takenFlags) {
  const dec = a => a > 0 ? a / 100 + 1 : 100 / Math.abs(a) + 1
  const Ncut = { win: 1, t3: 3, t5: 5, t10: 10 }
  const rows = board.map(d => ({ name: d.driver_name, car: String(d.car_number), pf: d.proj_finish, p50: (d.finish_p50 != null ? +d.finish_p50 : null), win: d.win_pct, t3: d.top3_pct, t5: d.top5_pct, t10: d.top10_pct, mv: d.mv, dkp: d.proj_dk != null ? d.proj_dk : null, dka: dkActMap ? dkActMap[String(d.car_number)] : null, act: actualMap[String(d.car_number)] })).filter(d => d.act != null)
  const n = rows.length
  const spearman = (a, b) => { const rk = x => { const idx = x.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = Array(x.length); idx.forEach((p, i) => r[p[1]] = i + 1); return r }; const ra = rk(a), rb = rk(b); let d2 = 0; for (let i = 0; i < a.length; i++) d2 += (ra[i] - rb[i]) * (ra[i] - rb[i]); return +(1 - 6 * d2 / (a.length * (a.length * a.length - 1))).toFixed(3) }
  const act = rows.map(r => r.act)
  const mae = +(rows.reduce((s, r) => s + Math.abs(r.pf - r.act), 0) / n).toFixed(2)
  const __p50rows = rows.filter(r => r.p50 != null)
  const mae_median = __p50rows.length ? +(__p50rows.reduce((s, r) => s + Math.abs(r.p50 - r.act), 0) / __p50rows.length).toFixed(2) : null
  const __ranked = rows.slice().sort((a, b) => a.pf - b.pf)
  const mae_rank = +(__ranked.reduce((s, r, i) => s + Math.abs((i + 1) - r.act), 0) / n).toFixed(2)
  const ind = N => rows.map(r => r.act <= N ? 1 : 0)
  const brier = (probs, ii) => +(probs.reduce((s, p, i) => s + (p / 100 - ii[i]) * (p / 100 - ii[i]), 0) / n).toFixed(4)
  const metrics = { n: n, mae: mae, mae_median: mae_median, mae_rank: mae_rank, spearman_pf: spearman(rows.map(r => r.pf), act), win_brier: brier(rows.map(r => r.win), ind(1)), top3_brier: brier(rows.map(r => r.t3), ind(3)), top5_brier: brier(rows.map(r => r.t5), ind(5)), top10_brier: brier(rows.map(r => r.t10), ind(10)) }
  // DK projection accuracy (2026-07-18): only when loop-data actuals available
  const __dkRows = rows.filter(r => r.dkp != null && r.dka != null)
  if (__dkRows.length >= 10) {
    const dn = __dkRows.length
    const mp = __dkRows.reduce((s, r) => s + r.dkp, 0) / dn, ma2 = __dkRows.reduce((s, r) => s + r.dka, 0) / dn
    let nu = 0, da = 0, db = 0
    __dkRows.forEach(r => { nu += (r.dkp - mp) * (r.dka - ma2); da += (r.dkp - mp) * (r.dkp - mp); db += (r.dka - ma2) * (r.dka - ma2) })
    metrics.dk = { n: dn, mae: +(__dkRows.reduce((s, r) => s + Math.abs(r.dkp - r.dka), 0) / dn).toFixed(2), bias: +(mp - ma2).toFixed(2), corr: +(nu / Math.sqrt(da * db)).toFixed(3), spearman: spearman(__dkRows.map(r => -r.dkp), __dkRows.map(r => -r.dka)) }
  }
  const prec = (key, N) => rows.slice().sort((a, b) => b[key] - a[key]).slice(0, N).filter(d => d.act <= N).length
  metrics.prec = { win: prec('win', 1), t3: prec('t3', 3), t5: prec('t5', 5), t10: prec('t10', 10) }
  const evFlags = []
  var MIN_EDGE_BET = 10; var MAX_FAV_BET = -250; // house rule 2026-07-10: only edges >= 10% (and no favs shorter than -250) count as logged bets
  // 2026-08-08: grade TAKEN positions (flagged_bets) when available - board snapshots get
  // re-published as odds arrive, so recomputing edges graded bets never taken and missed
  // real winners (Iowa oreilly pre showed -100% vs actual +5u across 25 flags).
  if (takenFlags && takenFlags.length) {
    // 2026-08-30: NFD accent-fold BEFORE stripping non-alphanumerics. Without it an accented
    // name loses the letter entirely - board "Daniel Suárez" -> 'danielsurez' vs loop data
    // "Daniel Suarez" -> 'danielsuarez' - so __actBy misses and the flag is silently DROPPED
    // from grading (same failure mode as the A.J. Allmendinger punctuation bug fixed 2026-08-09).
    // Cost when found: all 15 logged Suárez flags ungraded, including his P2 at Daytona R26
    // where t10 +350, t3 +1600 and t5 +750 all HIT.
    const __nm = __nmName
    const __actBy = {}
    rows.forEach(r => { __actBy[__nm(r.name)] = r.act })
    // 2026-08-09 double-count guards (operator caught Larson graded on BOTH boards):
    // 1) re-publish duplicates: the writer re-logs each publish - FIRST flag is the position
    // 2) pre-owned: positions taken on the PRE board are not new bets on the POST board
    const __seen = new Set()
    takenFlags.forEach(f => {
      const __key = __nm(f.driver_name) + '|' + f.market
      if (__seen.has(__key)) return
      __seen.add(__key)
      if (preOwned && preOwned.has(__nmName(f.driver_name) + '|' + f.market)) return
      const a = __actBy[__nm(f.driver_name)]
      if (a == null) return
      let __hit
      if (f.market === 'group' && f.group_drivers) {
        const rv = f.group_drivers.split(',').map(x => __actBy[__nm(x)]).filter(x => x != null)
        if (!rv.length) return
        __hit = rv.every(x => a < x)
      } else {
        if (!Ncut[f.market]) return
        __hit = a <= Ncut[f.market]
      }
      evFlags.push({ driver: f.driver_name, market: f.market, price: f.best_price, book: (f.book || '').toUpperCase(), ev: f.ev, mev: f.mev, medge: (f.medge == null ? null : f.medge), hit: __hit })
    })
  } else {
  rows.forEach(r => { if (!r.mv) return; ['win', 't3', 't5', 't10'].forEach(mk => { const m = r.mv[mk]; if (!m || m.ev == null || m.ev < MIN_EDGE_BET) return; if (m.best != null && m.best < 0 && m.best < MAX_FAV_BET) return; if (preOwned && preOwned.has(__nmName(r.name) + '|' + mk)) return; evFlags.push({ driver: r.name, market: mk, price: m.best, book: (m.bb || '').toUpperCase(), ev: m.ev, mev: m.mev, medge: (m.medge == null ? null : m.medge), hit: r.act <= Ncut[mk] }) }) })
  }
  const roiOf = fl => { if (!fl.length) return { bets: 0, profit: 0, roi: 0 }; const ret = fl.reduce((s, f) => s + (f.hit ? dec(f.price) : 0), 0); return { bets: fl.length, profit: +(ret - fl.length).toFixed(2), roi: +(((ret - fl.length) / fl.length) * 100).toFixed(1) } }
  // PARALLEL LEDGERS (2026-08-29 tail fix, STATE item 4): floor NOT picked - ladder non-monotonic
  // at 9 races. consensus = mev>0 (tight, ~4 plays/race); medge5 = principled floor; medge10 = the
  // FITTED sweet spot, forward-test ONLY, never adopt from the 9-race data. CLV ledger decides.
  const roi = { all: roiOf(evFlags), win: roiOf(evFlags.filter(f => f.market === 'win')), exwin: roiOf(evFlags.filter(f => f.market !== 'win')), consensus: roiOf(evFlags.filter(f => f.mev > 0)), medge5: roiOf(evFlags.filter(f => f.medge != null && f.medge >= 5)), medge10: roiOf(evFlags.filter(f => f.medge != null && f.medge >= 10)) }
  const detail = rows.slice().sort((a, b) => a.act - b.act).map(r => ({ name: r.name, car: r.car, pf: r.pf, act: r.act, win: r.win, flags: evFlags.filter(f => f.driver === r.name).map(f => f.market) }))
  return { metrics: metrics, evFlags: evFlags, roi: roi, detail: detail }
}


// Pre-board bet ownership (2026-07-11): when grading a POST sim, bets already flagged on the
// PRE board (same race) are NOT re-logged - the position was taken at the better pre price
// (that gap is CLV, tracked in the CLV panel), so re-flagging at post odds double-counts.
export async function __preOwnedFlags(series, postRow) {
  try {
    const { data } = await supabase.from('sim_results').select('results, race_number, race_year')
      .eq('series', series).eq('stage', 'pre').order('published_at', { ascending: false }).limit(1)
    const pre = (data || [])[0]
    if (!pre || !pre.results) return null
    if (postRow && postRow.race_number != null && pre.race_number != null && String(pre.race_number) !== String(postRow.race_number)) return null
    const owned = new Set()
    pre.results.forEach(d => {
      if (!d.mv) return
      ;['win', 't3', 't5', 't10'].forEach(mk => {
        const m = d.mv[mk]
        if (m && m.ev != null && m.ev >= 10 && !(m.best != null && m.best < 0 && m.best < -250)) owned.add(__nmName(d.driver_name) + '|' + mk)
      })
    })
    return owned.size ? owned : null
  } catch (e) { return null }
}


// Grade ONE published board (series + stage) against loop data for a race row. Returns
// { row, g, actualMap } or throws with the same messages Grade Center shows.
export async function gradeBoardFromLoopData(series, stage, row, target) {
    // Resolve the exact race via the RACES table (2026-07-11): loop_data.race_number is a
    // TRACK-VISIT count with inconsistent backfills - at double-header tracks both races can
    // carry the same value, silently mixing fields (the Feb-Atlanta grading incident).
    // races.race_number is the season R# and matches the published board.
    const res = await supabase.from('loop_data').select('driver_name, car_number, finish_position, start_position, laps_led, fastest_laps').eq('race_id', target.id)
    let laps = res.data || []
    if (!laps.length) { throw new Error('No loop data found for ' + row.track_name + ' ' + row.race_year + ' (' + series + '). Load it in Admin, or paste the finish above.'); }
    const nrm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '') // 2026-08-09: strip punctuation ENTIRELY - 'A.J. Allmendinger' (loop data) vs 'AJ Allmendinger' (board) became 'a j ...' vs 'aj ...' and silently dropped his P8 t10 +1400 HIT from grading
    const byName = {}
    row.results.forEach(d => { byName[nrm(d.driver_name)] = String(d.car_number) })
    // 2026-10-11: fall back to the CAR NUMBER when the loop-data name does not match the board (trucks Charlotte: 'Andres
    // Perez De Lara' on the board vs 'Andres Perez' in loop data, and a mislabelled #42 row - 34 of 36 imported). The car is
    // the race fact; a name split must not drop a finish from the grade.
    const boardCars = new Set(row.results.map(d => String(d.car_number)))
    const carOf = l => byName[nrm(l.driver_name)] || (l.car_number != null && boardCars.has(String(l.car_number).trim()) ? String(l.car_number).trim() : null)
    const actualMap = {}
    laps.forEach(l => { const car = carOf(l); if (car && l.finish_position != null) actualMap[car] = l.finish_position })
    // DK ACTUALS (2026-07-18): same scoring as the sim's proj_dk — finish pts + place diff + led*0.25 + fastest*0.45
    const __dkTbl = [0,45,42,41,40,39,38,37,36,35,34,32,31,30,29,28,27,26,25,24,23,21,20,19,18,17,16,15,14,13,12,10,9,8,7,6,5,4,3,2,1]
    const dkActMap = {}
    laps.forEach(l => { const car = carOf(l); if (!car || l.finish_position == null) return
      const fin = parseFloat(l.finish_position); const st = parseFloat(l.start_position) || fin
      dkActMap[car] = (fin <= 40 ? __dkTbl[fin] : 0) + (st - fin) + (parseFloat(l.laps_led) || 0) * 0.25 + (parseFloat(l.fastest_laps) || 0) * 0.45 })
    if (Object.keys(actualMap).length < 3) { throw new Error('Could not match loop-data drivers to the published sim.'); }
    const __preOwned2 = stage === 'post' ? await __preOwnedFlags(series, row) : null
    const { data: __tf2 } = await supabase.from('flagged_bets').select('driver_name,market,best_price,ev,mev,medge,sim_prob,book,group_drivers,created_at').eq('series', series).eq('race_year', row.race_year).eq('race_number', row.race_number).eq('stage', stage).is('voided_at', null).order('created_at', { ascending: true })
    const g = __gradeRace(row.results, actualMap, __preOwned2, dkActMap, __tf2 || [])
    // CLV (2026-07-18): closing line = last odds snapshot cluster for this race; CLV compares the
    // odds stamped on the published board (bettable at publish) vs the close.
    // CLOSE FROM SNAPSHOTS (2026-10-11): each book's close is ITS OWN last snapshot before the green
    // (Kalshi ticks every 10 min until green+15 via pg_cron; DK/FD/HR are whatever was pasted last), so
    // clusters no longer apply. Two numbers per play: clvSame (the book the flag was priced at) and clv
    // (the BEST close across books - the operator shops every bet, so that is the line he would have
    // closed against). The age of each close vs the green is kept so a stale paste is visible.
    try {
      let __sq = supabase.from('odds_snapshots').select('driver_name, market, book, odds, captured_at')
        .eq('series', series).eq('track_name', row.track_name).eq('race_year', row.race_year)
      if (row.race_number != null) __sq = __sq.eq('race_number', row.race_number)
      const { data: __snaps } = await __sq.order('captured_at', { ascending: false }).limit(5000)
      if (__snaps && __snaps.length) {
        const __green = row.config && row.config.raceStartUtc ? new Date(row.config.raceStartUtc).getTime() : null
        const __close = {}, __closeAt = {}
        __snaps.forEach(s2 => {
          if (__green != null && new Date(s2.captured_at).getTime() > __green + 20 * 60 * 1000) return   // nothing after the green counts as a close
          const k = nrm(s2.driver_name) + '|' + s2.market + '|' + s2.book
          if (!(k in __close)) { __close[k] = s2.odds; __closeAt[k] = s2.captured_at }
        })
        const __dec = a => a > 0 ? a / 100 + 1 : 100 / Math.abs(a) + 1
        const __bestClose = (dn, mk) => { let b = null, bk = null, at = null; ['dk', 'fd', 'hr', 'kalshi'].forEach(x => { const c = __close[nrm(dn) + '|' + mk + '|' + x]; if (c != null && (b == null || __dec(c) > __dec(b))) { b = c; bk = x; at = __closeAt[nrm(dn) + '|' + mk + '|' + x] } }); return { odds: b, book: bk, at } }
        const __plays = [], __field = [], __playsSame = [], __ages = []
        row.results.forEach(d => {
          const mvv = d.mv || {}
          ;['win', 't3', 't5', 't10'].forEach(mk => {
            const m = mvv[mk]
            if (!m || !m.bb || m.best == null) return
            const bc = __bestClose(d.driver_name, mk)
            if (bc.odds == null) return
            const clvPct = +(((__dec(m.best) / __dec(bc.odds)) - 1) * 100).toFixed(2)
            __field.push(clvPct)
            if (__green != null && bc.at) __ages.push((__green - new Date(bc.at).getTime()) / 60000)
            if (m.ev != null && m.ev > 0) {
              __plays.push(clvPct)
              const cs = __close[nrm(d.driver_name) + '|' + mk + '|' + m.bb]
              if (cs != null) __playsSame.push(+(((__dec(m.best) / __dec(cs)) - 1) * 100).toFixed(2))
            }
          })
        })
        if (__field.length >= 10 && g && g.metrics) {
          const __avg = a => a.reduce((x, y) => x + y, 0) / a.length
          g.metrics.clv = { plays: __plays.length, playsAvgPct: __plays.length ? +__avg(__plays).toFixed(2) : null, playsPosPct: __plays.length ? +((__plays.filter(v => v > 0).length / __plays.length) * 100).toFixed(1) : null, fieldAvgPct: +__avg(__field).toFixed(2), fieldN: __field.length,
            closeBasis: 'best-of-books', playsSameBookAvgPct: __playsSame.length ? +__avg(__playsSame).toFixed(2) : null, playsSameBookN: __playsSame.length, closeAgeMinMedian: __ages.length ? +__ages.slice().sort((a, b) => a - b)[Math.floor(__ages.length / 2)].toFixed(0) : null }
        }
      }
    } catch (e) {}

  return { row, g, actualMap }
}

// Resolve the races row for a board the way Grade Center does (season R# from the registry).
export async function resolveRaceRow(series, row) {
  const { data: raceRows } = await supabase.from('races').select('id, race_number, race_date')
    .eq('series', series).eq('track_name', row.track_name).eq('year', row.race_year)
  let target = null
  if (raceRows && raceRows.length === 1) target = raceRows[0]
  else if (raceRows && raceRows.length > 1) {
    target = raceRows.find(r => String(r.race_number) === String(row.race_number)) || null
    if (!target) throw new Error('Multiple races at this track/year (R' + raceRows.map(r => r.race_number).join(', R') + ') and none match the board R' + row.race_number + '. Fix the race # first.')
  }
  if (!target) throw new Error('No race row found for ' + row.track_name + ' ' + row.race_year + ' (' + series + '). Load the race in Admin first.')
  return target
}

export async function saveGradeRow({ row, g, actualMap, series, stage, raceNumber }) {
  const actualArr = Object.keys(actualMap).map(car => ({ car_number: car, finish: actualMap[car] }))
  const rn = raceNumber != null ? parseInt(raceNumber) : null
  const rowData = { sim_id: row.id, series, track_name: row.track_name, race_year: row.race_year, race_number: rn, actual: actualArr, metrics: g.metrics, ev_flags: g.evFlags, roi: g.roi, shade_on: false, stage, config: row.config }
  let existing = []
  if (rn != null) { const q = await supabase.from('sim_grades').select('id').eq('series', series).eq('race_year', row.race_year).eq('race_number', rn).eq('stage', stage); existing = q.data || [] }
  const resp = existing.length ? await supabase.from('sim_grades').update(rowData).eq('id', existing[0].id) : await supabase.from('sim_grades').insert(rowData)
  if (resp.error) throw new Error('sim_grades: ' + resp.error.message)
  return existing.length ? 'updated' : 'saved'
}

// Season CLV log from snapshots - same rows the CLV tab's "Close from snapshots" writes (stage-scoped replace).
export async function logClvFromSnaps(series, stage, row) {
  const __impl = a => (a == null || isNaN(a)) ? null : (a > 0 ? 100 / (a + 100) : (-a) / ((-a) + 100))
  const MK = [['win', 'win_pct'], ['t3', 'top3_pct'], ['t5', 'top5_pct'], ['t10', 'top10_pct']]
  let q = supabase.from('odds_snapshots').select('driver_name, market, book, odds, captured_at').eq('series', series).eq('track_name', row.track_name).eq('race_year', row.race_year)
  if (row.race_number != null) q = q.eq('race_number', row.race_number)
  const { data: snaps } = await q.order('captured_at', { ascending: false }).limit(5000)
  if (!snaps || !snaps.length) return { logged: 0, reason: 'no odds snapshots' }
  const green = row.config && row.config.raceStartUtc ? new Date(row.config.raceStartUtc).getTime() : null
  const close = {}
  snaps.forEach(s2 => { if (green != null && new Date(s2.captured_at).getTime() > green + 20 * 60 * 1000) return; const k = s2.driver_name.toLowerCase() + '|' + s2.market + '|' + s2.book; if (!(k in close)) close[k] = s2.odds })
  const dec = a => a > 0 ? a / 100 + 1 : 100 / Math.abs(a) + 1
  const ins = []
  ;(row.results || []).forEach(d => {
    const bet = d.mv || {}
    MK.forEach(([mk, pf]) => {
      const b = bet[mk]; if (!b || b.best == null || b.ev == null || b.ev <= 0) return
      let best = null; ['dk', 'fd', 'hr', 'kalshi'].forEach(x => { const c = close[d.driver_name.toLowerCase() + '|' + mk + '|' + x]; if (c != null && (best == null || dec(c) > dec(best))) best = c })
      if (best == null) return
      const bi = __impl(b.best), ci = __impl(best)
      ins.push({ series, race_year: row.race_year, race_number: row.race_number, stage: stage || null, track_name: row.track_name, driver_name: d.driver_name, market: mk, sim_prob: d[pf], bet_odds: b.best, close_odds: best, bet_implied: bi, close_implied: ci, clv: (ci - bi) * 100, edge_at_bet: b.ev })
    })
  })
  if (!ins.length) return { logged: 0, reason: 'no flagged plays with a close' }
  const delQ = supabase.from('clv_log').delete().eq('series', series).eq('race_year', row.race_year).eq('race_number', row.race_number)
  await (stage ? delQ.eq('stage', stage) : delQ.is('stage', null))
  const { error } = await supabase.from('clv_log').insert(ins)
  if (error) throw new Error('clv_log: ' + error.message)
  return { logged: ins.length, pos: ins.filter(x => x.clv > 0).length }
}

// ONE CLICK (2026-10-11): after Load Race, grade every published board for this race (pre and post)
// and log season CLV for each. Returns a one-line summary; never throws (the loop data is the
// deliverable, grading is an enrichment).
export async function autoGradeRace(series, year, raceNumber) {
  const parts = []
  for (const stage of ['pre', 'post']) {
    try {
      const { data } = await supabase.from('sim_results').select('*').eq('series', series).eq('stage', stage).eq('race_year', year).eq('race_number', raceNumber).order('published_at', { ascending: false }).limit(1)
      const row = (data || [])[0]
      if (!row || !row.results) { parts.push(stage + ': no board'); continue }
      const target = await resolveRaceRow(series, row)
      const { g, actualMap } = await gradeBoardFromLoopData(series, stage, row, target)
      const how = await saveGradeRow({ row, g, actualMap, series, stage, raceNumber })
      const m = g.metrics || {}
      const clv = await logClvFromSnaps(series, stage, row)
      parts.push(stage + ': graded ' + Object.keys(actualMap).length + ' (' + how + (m.top10_brier != null ? ", t10 Brier " + (+m.top10_brier).toFixed(4) : "") + (m.clv && m.clv.playsAvgPct != null ? ', CLV ' + (m.clv.playsAvgPct > 0 ? '+' : '') + m.clv.playsAvgPct + '% on ' + m.clv.plays + ' plays' : '') + '), season CLV ' + (clv.logged ? clv.logged + ' logged' : clv.reason))
    } catch (e) { parts.push(stage + ' FAILED: ' + e.message) }
  }
  return parts.join(' · ')
}

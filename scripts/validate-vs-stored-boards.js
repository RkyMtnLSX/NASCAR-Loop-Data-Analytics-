// scripts/validate-vs-stored-boards.js — STEP 1 GATE of the win-confidence registration.
//
//   node scripts/validate-vs-stored-boards.js
//
// Registered in BACKTEST_LOG 2026-08-31. Everything in that registration depends on whether the
// backtest reconstruction can speak about FAVOURITE calibration at all. It has no marketAnchor, no
// projected lineup, no equipment overrides — so its "favourite" may simply not be the live board's
// favourite, in which case today's 23.6%-predicted / 34.0%-won number means nothing.
//
// PASS REQUIRES, both, set before running:
//   a. same favourite driver on >= 8 of 11 stored boards, and
//   b. mean absolute favourite win% difference < 5 points.
// A FAIL closes the study and retroactively voids the favourite-calibration numbers.
const fs = require('fs'), path = require('path')
const E = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, __trackGroup,
  isRoadCourse, isSuperspeedway, DEFAULT_WEIGHTS, TRUCK_SHORT_WEIGHTS, ROAD_COURSE_WEIGHTS,
  TRUCK_ROAD_WEIGHTS, SUPERSPEEDWAY_WEIGHTS, ONEILLY_SUPERSPEEDWAY_WEIGHTS } = E
const SIMS = Number(process.env.SIMS || 30000)
const num = s => (s === '' || s == null ? null : Number(s))
const key = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
function wf(se, tr) {
  if (isRoadCourse(tr)) return se === 'trucks' ? TRUCK_ROAD_WEIGHTS : ROAD_COURSE_WEIGHTS
  if (isSuperspeedway(tr)) return se === 'oreilly' ? ONEILLY_SUPERSPEEDWAY_WEIGHTS : SUPERSPEEDWAY_WEIGHTS
  if (se === 'trucks' && __trackGroup(tr) === 'SHORT') return TRUCK_SHORT_WEIGHTS
  return DEFAULT_WEIGHTS
}
// stored live boards: [race_id, favourite, favourite win%]
const STORED = {
  '438': ['Denny Hamlin', 22.1], '475': ['Ryan Blaney', 39.5], '477': ['Ryan Blaney', 39.6],
  '479': ['Ryan Blaney', 18.8], '481': ['Joey Logano', 5.8], '439': ['Chase Elliott', 15.1],
  '474': ['Ross Chastain', 17.8], '480': ['Austin Hill', 26.6], '436': ['Layne Riggs', 29.6],
  '476': ['Kaden Honeycutt', 27.8], '478': ['Layne Riggs', 17.1],
}
console.log(`STEP 1 GATE — reconstruction vs ${Object.keys(STORED).length} stored live boards, ${SIMS} sims\n`)
console.log('race  series   track                    live favourite      live%   recon favourite     recon%   same  diff')
let same = 0, tot = 0, absSum = 0, signSum = 0
for (const line of fs.readFileSync(path.join(__dirname, 'backtest-data', 'stored-boards.txt'), 'utf8').split('\n').filter(l => l.trim())) {
  const [h, b] = line.split('#')
  const [rid, series, track, grp, pDnf, pN, pCau] = h.split('|')
  const st = STORED[rid]; if (!st) continue
  const drivers = []
  for (const rec of b.split(';')) {
    const [nm, rest] = rec.split('~'); if (!rest) continue
    const f = rest.split(','); if (f.length < 10) continue
    drivers.push({ name: nm.trim(), startPos: num(f[0]), corrAvgRating: num(f[3]), corrAvgFinish: num(f[4]),
      nCorrRaces: num(f[5]) || 0, trackAvgRating: num(f[6]), trackAvgFinish: num(f[7]),
      nTrackRaces: num(f[8]) || 0, lrpTime: num(f[9]), pitCrewTime: null, corrWinConv: null })
  }
  if (drivers.length < 15) continue
  const P = getCautionPresets(series), cau = num(pCau)
  const preset = cau == null ? P[1] : isSuperspeedway(track) ? P[cau < 6 ? 0 : cau < 11.5 ? 1 : 2]
    : P.reduce((a, x) => Math.abs(x.value - cau) < Math.abs(a.value - cau) ? x : a)
  const rows = runRaceSim(buildSpeedScores(drivers, wf(series, track)), {
    numSims: SIMS, cautionPreset: preset, dnfRate: resolveDnfRate(series, grp, num(pDnf), num(pN) || 0),
    totalRaceLaps: 300, trackGroup: __trackGroup(track), startSampling: null })
  const top = rows.reduce((a, r) => (r.winPct > a.winPct ? r : a), rows[0])
  const ok = key(top.name) === key(st[0])
  const diff = top.winPct - st[1]
  same += ok ? 1 : 0; tot++; absSum += Math.abs(diff); signSum += diff
  console.log(rid.padEnd(5) + series.padEnd(9) + track.slice(0, 24).padEnd(25) +
    st[0].padEnd(20) + st[1].toFixed(1).padStart(5) + '   ' + top.name.slice(0, 19).padEnd(20) +
    top.winPct.toFixed(1).padStart(5) + '   ' + (ok ? ' YES' : ' no ') + '  ' + (diff >= 0 ? '+' : '') + diff.toFixed(1))
}
console.log(`\nsame favourite: ${same}/${tot}   (gate: >= 8)`)
console.log(`mean |win% diff|: ${(absSum / tot).toFixed(2)} pts   (gate: < 5.0)`)
console.log(`mean SIGNED diff: ${(signSum / tot >= 0 ? '+' : '')}${(signSum / tot).toFixed(2)} pts   (negative = reconstruction is LESS confident than the live board)`)
const pass = same >= 8 && absSum / tot < 5
console.log(`\nSTEP 1: ${pass ? 'PASS — the reconstruction can speak about favourite calibration' : 'FAIL — study CLOSES, today\'s favourite numbers are void for this purpose'}`)

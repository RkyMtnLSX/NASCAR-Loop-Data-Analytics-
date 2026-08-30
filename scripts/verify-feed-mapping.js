// scripts/verify-feed-mapping.js
//
// Runs the REAL mapping from src/lib/nascarFeedMap.js against a fixture of real
// cup 2026 R26 Daytona feed rows, and checks every derived value against what
// the database actually holds for that race.
//
//   node scripts/verify-feed-mapping.js
//
// Run it after touching nascarFeedMap.js. It needs no network and no database:
// the expected values are the ones read out of Supabase on 2026-08-30 and
// written down here, so a regression shows up as a diff rather than as a
// weekend of quietly wrong loop data.
//
// The lib is ES modules (the app imports it) and this script is plain node, so
// the `export` keywords are stripped before evaluation. The file is pure - no
// React, no Supabase, no fetch at module scope - which is what makes that safe.

const fs = require('fs')
const path = require('path')
const vm = require('vm')

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'nascarFeedMap.js'), 'utf8')
const sandbox = { module: { exports: {} }, console, fetch: undefined }
sandbox.exports = sandbox.module.exports
vm.createContext(sandbox)
vm.runInContext(
  src.replace(/^export /gm, '')
    + '\nmodule.exports = { pct, fold, initialSurname, makeResolver, mapRace }\n',
  sandbox, { filename: 'nascarFeedMap.js' })
const { makeResolver, mapRace } = sandbox.module.exports

// Real R26 rows, transcribed from the deployed endpoint's response.
const D = (id,name,car,team,st,fin,status,laps,led,tl,q,pg,pd,t15,avg,rtg,close,mid,best,worst) => ({
  driver_id:id, driver_fullname:name, car_number:car, official_car_number:car,
  team_name:team, owner_fullname:team, crew_chief_fullname:'x', car_make:'Chevrolet',
  starting_position:st, finishing_position:fin, finishing_status:status, disqualified:false,
  laps_completed:laps, laps_led:led, times_led:tl,
  qualifying_order:1, qualifying_position:st, qualifying_speed:180,
  points_earned:0, playoff_points_earned:0,
  loop:{ start_ps:st, mid_ps:mid, ps:fin, best_ps:best, worst_ps:worst, avg_ps:avg,
         passing_diff:pd, passes_gf:pg, passed_gf:pg-pd, quality_passes:q,
         fast_laps:0, top15_laps:t15, lead_laps:led, laps:laps, rating:rtg,
         closing_ps:close, closing_laps_diff:close-fin },
})

const payload = {
  race: { race_id:5623, race_name:'Coke Zero Sugar 400', track_name:'Daytona International Speedway',
          race_date:'2026-08-29T19:30:00', scheduled_laps:160, actual_laps:166,
          number_of_cautions:4, number_of_caution_laps:23, number_of_lead_changes:41,
          average_speed:154.69, margin_of_victory:'Under Caution' },
  stageResults: [
    { stage_number:1, results:[{driver_id:4070, finishing_position:8}] },
    { stage_number:2, results:[{driver_id:4070, finishing_position:2}] },
  ],
  dnq: [],
  drivers: [
    D(4070,'Ryan Preece','60','RFK Racing',4,1,'Running',166,5,3,223,340,46,126,9.59,115.36,5,4,1,39),
    D(4113,'Daniel Suárez','7','Spire Motorsports',23,2,'Running',166,0,0,174,425,12,69,17.14,81.2,4,15,2,36),
    D(4092,'John H. Nemechek','42','Legacy Motor Club',27,15,'Running',166,2,1,200,413,41,91,15.89,80.87,6,26,1,38),
    D(3774,'AJ Allmendinger','16','Kaulig Racing',36,30,'Running',166,0,0,16,160,4,5,31.77,51.73,35,28,10,40),
    D(4326,'Carson Hocevar','77','Spire Motorsports',28,38,'Accident',154,1,1,18,190,25,16,28.28,40.7,2,32,1,39),
    D(3989,'Chris Buescher','17','RFK Racing',2,40,'Running',151,6,2,22,24,1,35,31.99,74.65,40,40,1,40),
    D(4451,'Daniel Dye','78','Live Fast Motorsports',39,29,'Running',166,0,0,0,108,-8,0,33.78,33.37,23,38,7,40),
  ],
}

// The spellings already in loop_data.
const existing = [
  {driver_name:'Ryan Preece', nascar_driver_id:null},
  {driver_name:'Daniel Suarez', nascar_driver_id:null},
  {driver_name:'John Hunter Nemechek', nascar_driver_id:null},
  {driver_name:'A.J. Allmendinger', nascar_driver_id:null},
  {driver_name:'Carson Hocevar', nascar_driver_id:null},
  {driver_name:'Chris Buescher', nascar_driver_id:null},
  {driver_name:'Daniel Dye', nascar_driver_id:null},
]

const out = mapRace(payload, { series:'cup', year:2026, raceNumber:26,
  trackName:'Daytona International Speedway', resolve: makeResolver(existing) })

// What the database actually holds for cup 2026 R26.
const STORED = {
  'Ryan Preece':          {pq:65.60, pt:75.90, pl:3.00, avg:9.59,  rtg:115.36},
  'Daniel Suarez':        {pq:40.90, pt:41.60, pl:0.00, avg:17.14, rtg:81.20},
  'John Hunter Nemechek': {pq:48.40, pt:54.80, pl:1.20, avg:15.89, rtg:80.87},
  'A.J. Allmendinger':    {pq:10.00, pt:3.00,  pl:0.00, avg:31.77, rtg:51.73},
  'Carson Hocevar':       {pq:9.50,  pt:10.40, pl:0.60, avg:28.28, rtg:40.70},
  'Chris Buescher':       {pq:91.70, pt:23.20, pl:4.00, avg:31.99, rtg:74.65},
  'Daniel Dye':           {pq:0.00,  pt:0.00,  pl:0.00, avg:33.78, rtg:33.37},
}

let bad = 0
console.log('name resolution and derived percentages vs stored values')
console.log('feed name'.padEnd(22), 'resolved'.padEnd(22), 'how'.padEnd(8), '%QP', '%T15', '%Led', 'status')
for (const r of out.rows) {
  const s = STORED[r.driver_name]
  const chk = (a, b, label) => {
    if (Math.abs(a - b) > 0.051) { console.log(`   MISMATCH ${r.driver_name} ${label}: got ${a} stored ${b}`); bad++ }
  }
  if (!s) { console.log(`   UNRESOLVED: ${r.driver_name}`); bad++; continue }
  chk(r.pct_quality_passes, s.pq, '%QP')
  chk(r.pct_top15_laps,     s.pt, '%T15')
  chk(r.pct_laps_led,       s.pl, '%Led')
  chk(r.avg_position,       s.avg, 'avg')
  chk(r.driver_rating,      s.rtg, 'rating')
  console.log(r.__feedName.padEnd(22), r.driver_name.padEnd(22), r.__how.padEnd(8),
    String(r.pct_quality_passes).padStart(5), String(r.pct_top15_laps).padStart(5),
    String(r.pct_laps_led).padStart(5), ' ', r.finish_status)
}

console.log('\nrace-level')
const R = out.race
const expect = { total_laps:166, scheduled_laps:160, total_cautions:4, total_caution_laps:23,
                 lead_changes:41, avg_speed:154.69, margin_of_victory:null,
                 margin_of_victory_text:'Under Caution', winning_driver:'Ryan Preece' }
for (const [k,v] of Object.entries(expect)) {
  const ok = R[k] === v || (v===null && R[k]===null)
  if (!ok) { console.log(`   MISMATCH ${k}: got ${JSON.stringify(R[k])} expected ${JSON.stringify(v)}`); bad++ }
  else console.log(`   ok ${k} = ${JSON.stringify(R[k])}`)
}

console.log('\nstage finishes (feed publishes top 10 only)')
const p = out.rows.find(r => r.driver_name === 'Ryan Preece')
console.log('   Preece S1', p.stage1_finish, 'S2', p.stage2_finish, '(expect 8, 2)')
if (p.stage1_finish !== 8 || p.stage2_finish !== 2) bad++
const nul = out.rows.find(r => r.driver_name === 'Daniel Dye')
console.log('   Dye S1', nul.stage1_finish, '(expect null - outside the top 10)')
if (nul.stage1_finish !== null) bad++

console.log('\nDNF test used by SimulationCenter: fs && fs !== "running"')
for (const r of out.rows) {
  const dnf = !!(r.finish_status && r.finish_status !== 'running')
  console.log(`   ${r.driver_name.padEnd(22)} ${String(r.finish_status).padEnd(9)} -> ${dnf ? 'DNF' : 'running'}`)
}

console.log(bad === 0 ? '\nALL CHECKS PASSED' : `\n${bad} FAILURES`)
process.exit(bad === 0 ? 0 : 1)

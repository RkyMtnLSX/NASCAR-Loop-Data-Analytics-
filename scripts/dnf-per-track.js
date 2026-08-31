// scripts/dnf-per-track.js — does the sim retire the right number of cars AT EACH TRACK?
//
//   node scripts/dnf-per-track.js
//
// Reproduces SimulationCenter's OWN automatic configuration for every cup track and
// compares delivered attrition to that track's measured attrition. Both inputs are
// auto-set from the same track's long-run history: dnfRate via resolveDnfRate, and the
// caution preset via the track's mean races.total_cautions. wreck-v1.1-cb calibrated the
// preset as a modulation around the budget - a calm RACE under, a chaotic RACE over - but
// auto-selection sets it from the track's AVERAGE, which dnfRate already carries.
//
// Result (2026-08-31): 24 of 30 cup tracks sim below their own measured attrition,
// Talladega at 0.51x. Written up in BACKTEST_LOG. UNRESOLVED - nothing has been changed.
//
// The data file is a snapshot from Supabase (2022+, non-exhibition), columns:
//   [track_name, avg_total_cautions, measured_dnf_rate, n_races, correlation_group_label]
// Re-snapshot it if you want current numbers; the query is in the BACKTEST_LOG entry.

const e = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, DEFAULT_WEIGHTS, __trackGroup, isSuperspeedway } = e
const rows = require('./dnf-per-track-data.json')
function field(n){const o=[];for(let i=0;i<n;i++){const t=i/(n-1);o.push({name:'D'+i,startPos:i+1,corrAvgRating:110-t*45,corrAvgFinish:6+t*26,trackAvgRating:108-t*42,trackAvgFinish:7+t*25,lrpTime:30+t*0.9,pitCrewTime:12+t*1.4,corrWinConv:0.35-t*0.3,nCorrRaces:12})}return o}
const N=38, presets=getCautionPresets('cup'), sc=buildSpeedScores(field(N),DEFAULT_WEIGHTS)
console.log('track                                  cau  preset  measured  budget  delivered  ratio')
const out=[]
for (const [name,avgCau,meas,n,label] of rows){
  // reproduce the app: line 287 bucket, then the auto-preset effect (nearest) for non-SS
  const bucketIdx = avgCau<6?0:avgCau<11.5?1:2
  const nearest = presets.reduce((a,b)=>Math.abs(b.value-avgCau)<Math.abs(a.value-avgCau)?b:a)
  const preset = isSuperspeedway(name) ? presets[bucketIdx] : nearest
  const budget = resolveDnfRate('cup', label, meas, n)
  const grp = __trackGroup(name)
  const r = runRaceSim(sc,{numSims:30000,cautionPreset:preset,dnfRate:budget,totalRaceLaps:300,trackGroup:grp,startSampling:null})
  const delivered = r.reduce((s,x)=>s+x.dnfPct,0)/100/N
  const ratio = delivered/meas
  out.push([name,ratio])
  console.log(name.padEnd(38), String(avgCau).padStart(5), preset.label.padStart(7),
    (meas*100).toFixed(1).padStart(8)+'%', (budget*100).toFixed(1).padStart(6)+'%',
    (delivered*100).toFixed(1).padStart(9)+'%', ratio.toFixed(2).padStart(6))
}
const bad = out.filter(([,r])=>r<0.8||r>1.25).sort((a,b)=>a[1]-b[1])
console.log('\nOUTSIDE +/-20-25%: '+bad.length+' of '+out.length)
for (const [n,r] of bad) console.log('   '+n.padEnd(40)+r.toFixed(2))

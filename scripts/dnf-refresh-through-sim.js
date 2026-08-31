// scripts/dnf-refresh-through-sim.js — did the 2026-08-30 DNF constant refresh improve
// the SIM, not just the arithmetic?
//
//   node scripts/dnf-refresh-through-sim.js
//
// The 2026-08-30 validation predicted retirement COUNT directly from the rates and closed
// with "none of this tests the SIM'S OUTPUT." This does that test. It runs the real
// runRaceSim under both constant sets, per cup track, reproducing SimulationCenter's own
// auto-configuration (dnfRate from that track's history, caution preset from that track's
// mean total_cautions), and scores delivered attrition against the track's measured
// attrition under the current rule.
//
// Both trackAvg inputs are era-correct: the OLD path is fed the old-rule measurement
// (laps < 90% of winner), the NEW path the current rule (status != running OR laps < 90%),
// because the finish_status backfill is what changed the live measurement in the first
// place. Scoring both against the current rule is the point - it is the better ground truth.
//
// LIMIT: this measures ATTRITION RATE on a synthetic field. It says nothing about whether
// finishing distributions, win probabilities or DFS floors are better calibrated. That is
// the placement-tail protocol and is still not done.

const e = require('./loadEngine')
const { buildSpeedScores, runRaceSim, getCautionPresets, resolveDnfRate, DEFAULT_WEIGHTS, __trackGroup, isSuperspeedway } = e
// track, avgCautions, oldRuleDnf, newRuleDnf, nRaces, correlationLabel
const T=[
["Road America",2.00,0.0811,0.1081,1,"Road Course"],
["Indianapolis Grand Prix Circuit",3.00,0.0921,0.1053,2,"Road Course"],
["Watkins Glen International",4.00,0.0470,0.0626,5,"Road Course"],
["Sonoma Raceway",4.60,0.0535,0.0643,5,"Road Course"],
["Charlotte Motor Speedway Road Course",4.75,0.0863,0.0863,4,"Road Course"],
["Richmond Raceway",4.88,0.0338,0.0372,8,"Short & Flat Tracks"],
["North Wilkesboro Speedway",5.00,0.0811,0.0811,1,"Short & Flat Tracks"],
["Homestead-Miami Speedway",5.00,0.0826,0.0895,4,"Intermediate"],
["Circuit of the Americas",5.20,0.0832,0.1037,5,"Road Course"],
["Talladega Superspeedway",5.33,0.1565,0.2053,9,"Superspeedway"],
["Daytona International Speedway",6.20,0.1837,0.3186,10,"Superspeedway"],
["Las Vegas Motor Speedway",6.56,0.0818,0.1058,9,"Intermediate"],
["Martinsville Speedway",6.78,0.0608,0.0789,9,"Short & Flat Tracks"],
["Indianapolis Motor Speedway",7.00,0.1709,0.2393,3,"Intermediate"],
["Chicago Street Course",7.00,0.1354,0.1604,3,"Road Course"],
["Phoenix Raceway",7.11,0.0993,0.1144,9,"Short & Flat Tracks"],
["Darlington Raceway",7.33,0.1221,0.1496,9,"Intermediate"],
["Pocono Raceway",8.00,0.1463,0.1572,5,"Intermediate"],
["Kansas Speedway",8.11,0.0784,0.0903,9,"Intermediate"],
["Bristol Motor Speedway",8.14,0.1122,0.1235,7,"Short & Flat Tracks"],
["Michigan International Speedway",8.20,0.1961,0.2069,5,"Intermediate"],
["Dover Motor Speedway",8.25,0.1233,0.1573,4,"Intermediate"],
["Gateway",9.00,0.0764,0.1042,4,"Short & Flat Tracks"],
["Iowa Speedway",9.00,0.0556,0.0556,3,"Short & Flat Tracks"],
["Atlanta Motor Speedway",9.20,0.1911,0.2364,10,"Superspeedway"],
["Nashville Superspeedway",9.40,0.1164,0.1693,5,"Intermediate"],
["New Hampshire Motor Speedway",9.60,0.1278,0.1278,5,"Short & Flat Tracks"],
["Charlotte Motor Speedway",12.20,0.1936,0.2312,5,"Intermediate"],
["Texas Motor Speedway",12.40,0.1716,0.2313,5,"Intermediate"],
]
// the PRE-2026-08-30 resolver, verbatim shape, old constants and old cap
const OLD_G={'Short & Flat Tracks':0.081,'Road Course':0.085,'Intermediate':0.127,'Superspeedway':0.184}
function resolveOld(label, trackAvg, n){
  const base = OLD_G[label] != null ? OLD_G[label] : 0.118
  let v = base
  if (trackAvg != null && isFinite(trackAvg) && n > 0){ const c = Math.min(1, n/8); v = trackAvg*c + base*(1-c) }
  return Math.max(0.03, Math.min(0.30, v))
}
function field(n){const o=[];for(let i=0;i<n;i++){const t=i/(n-1);o.push({name:'D'+i,startPos:i+1,corrAvgRating:110-t*45,corrAvgFinish:6+t*26,trackAvgRating:108-t*42,trackAvgFinish:7+t*25,lrpTime:30+t*0.9,pitCrewTime:12+t*1.4,corrWinConv:0.35-t*0.3,nCorrRaces:12})}return o}
const N=38, P=getCautionPresets('cup'), sc=buildSpeedScores(field(N),DEFAULT_WEIGHTS)
const deliver=(budget,preset,grp)=>{const r=runRaceSim(sc,{numSims:30000,cautionPreset:preset,dnfRate:budget,totalRaceLaps:300,trackGroup:grp,startSampling:null});return r.reduce((s,x)=>s+x.dnfPct,0)/100/N}
console.log('track                                truth   OLD-sim  err    NEW-sim  err')
let so=0,sn=0,bo=0,bn=0,win=0
for(const [name,cau,oldD,newD,n,label] of T){
  const bi=cau<6?0:cau<11.5?1:2
  const nearest=P.reduce((a,b)=>Math.abs(b.value-cau)<Math.abs(a.value-cau)?b:a)
  const preset=isSuperspeedway(name)?P[bi]:nearest
  const grp=__trackGroup(name)
  const dOld=deliver(resolveOld(label,oldD,n),preset,grp)
  const dNew=deliver(resolveDnfRate('cup',label,newD,n),preset,grp)
  const eo=dOld-newD, en=dNew-newD
  so+=Math.abs(eo); sn+=Math.abs(en); bo+=eo; bn+=en
  if(Math.abs(en)<Math.abs(eo)) win++
  console.log(name.padEnd(36),(newD*100).toFixed(1).padStart(6)+'%',
    (dOld*100).toFixed(1).padStart(7)+'%',(eo*100).toFixed(1).padStart(6),
    (dNew*100).toFixed(1).padStart(7)+'%',(en*100).toFixed(1).padStart(6))
}
const k=T.length
console.log('\nvs measured truth (new rule), in DNF-rate points:')
console.log('  OLD constants   MAE '+(so/k*100).toFixed(2)+'   bias '+(bo/k*100).toFixed(2))
console.log('  NEW constants   MAE '+(sn/k*100).toFixed(2)+'   bias '+(bn/k*100).toFixed(2))
console.log('  new closer at '+win+' of '+k+' tracks')

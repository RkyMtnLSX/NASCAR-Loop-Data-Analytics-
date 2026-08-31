// scripts/dnf-caution-fix-prototype.js — PROTOTYPE, NOT SHIPPED.
//
//   node scripts/dnf-caution-fix-prototype.js
//
// Tests two candidate repairs for the auto-preset interaction (BACKTEST_LOG 2026-08-31)
// WITHOUT modifying the shipped engine, by blending runs analytically:
//
//   FIX A  sample the caution bucket per sim from the track's OWN historical caution
//          distribution, instead of running 30,000 copies of the track's AVERAGE race.
//   FIX C  FIX A, plus divide the wreck scale by K = sum_b w_b r_b, so the track's own
//          caution distribution averages to exactly 1.0x the budget while calm sims still
//          retire fewer cars and chaotic sims more.
//
// WHAT THIS MEASURES, and what it does NOT. It shows the sim delivering the budget it was
// handed. That is MECHANICAL. The budget is itself derived from the same measured track
// attrition being scored against, so a good number here is close to circular and is NOT
// evidence the model forecasts better. See the pre-registration in BACKTEST_LOG.

const e=require('./loadEngine')
const {buildSpeedScores,runRaceSim,getCautionPresets,resolveDnfRate,DEFAULT_WEIGHTS,__trackGroup,isSuperspeedway}=e
// name, avgCau, [low,mid,high], measuredDnf, nDnfRaces, label
const T=[
["Watkins Glen International",4.00,[4,1,0],0.0626,5,"Road Course"],
["Sonoma Raceway",4.60,[3,2,0],0.0643,5,"Road Course"],
["Charlotte Motor Speedway Road Course",4.75,[3,1,0],0.0863,4,"Road Course"],
["Richmond Raceway",4.88,[7,1,0],0.0372,8,"Short & Flat Tracks"],
["Homestead-Miami Speedway",5.00,[3,1,0],0.0895,4,"Intermediate"],
["Circuit of the Americas",5.20,[3,1,1],0.1037,5,"Road Course"],
["Talladega Superspeedway",5.33,[4,5,0],0.2053,9,"Superspeedway"],
["Daytona International Speedway",6.20,[4,6,0],0.3186,10,"Superspeedway"],
["Las Vegas Motor Speedway",6.56,[4,3,2],0.1058,9,"Intermediate"],
["Martinsville Speedway",6.78,[4,2,3],0.0789,9,"Short & Flat Tracks"],
["Chicago Street Course",7.00,[1,1,1],0.1604,3,"Road Course"],
["Indianapolis Motor Speedway",7.00,[1,1,1],0.2393,3,"Intermediate"],
["Phoenix Raceway",7.11,[3,3,3],0.1144,9,"Short & Flat Tracks"],
["Darlington Raceway",7.33,[1,6,2],0.1496,9,"Intermediate"],
["Pocono Raceway",8.00,[1,2,2],0.1572,5,"Intermediate"],
["Kansas Speedway",8.11,[1,3,5],0.0903,9,"Intermediate"],
["Bristol Motor Speedway",8.14,[2,1,4],0.1235,7,"Short & Flat Tracks"],
["Michigan International Speedway",8.20,[0,3,2],0.2069,5,"Intermediate"],
["Dover Motor Speedway",8.25,[1,2,1],0.1573,4,"Intermediate"],
["Iowa Speedway",9.00,[0,2,1],0.0556,3,"Short & Flat Tracks"],
["Gateway",9.00,[1,0,3],0.1042,4,"Short & Flat Tracks"],
["Atlanta Motor Speedway",9.20,[1,3,6],0.2364,10,"Superspeedway"],
["Nashville Superspeedway",9.40,[1,1,3],0.1693,5,"Intermediate"],
["New Hampshire Motor Speedway",9.60,[0,2,3],0.1278,5,"Short & Flat Tracks"],
["Charlotte Motor Speedway",12.20,[0,2,3],0.2312,5,"Intermediate"],
["Texas Motor Speedway",12.40,[0,1,4],0.2313,5,"Intermediate"],
]
function field(n){const o=[];for(let i=0;i<n;i++){const t=i/(n-1);o.push({name:'D'+i,startPos:i+1,corrAvgRating:110-t*45,corrAvgFinish:6+t*26,trackAvgRating:108-t*42,trackAvgFinish:7+t*25,lrpTime:30+t*0.9,pitCrewTime:12+t*1.4,corrWinConv:0.35-t*0.3,nCorrRaces:12})}return o}
const N=38,P=getCautionPresets('cup'),sc=buildSpeedScores(field(N),DEFAULT_WEIGHTS)
const deliver=(b,p,g)=>{const r=runRaceSim(sc,{numSims:30000,cautionPreset:p,dnfRate:b,totalRaceLaps:300,trackGroup:g,startSampling:null});return r.reduce((s,x)=>s+x.dnfPct,0)/100/N}
console.log('track                                truth  CURRENT  FIX-A(dist)  FIX-C(dist+renorm)')
let a={c:0,a:0,f:0},b={c:0,a:0,f:0}
for(const [name,cau,cnt,truth,n,label] of T){
  const g=__trackGroup(name), bud=resolveDnfRate('cup',label,truth,n)
  const bi=cau<6?0:cau<11.5?1:2
  const nearest=P.reduce((x,y)=>Math.abs(y.value-cau)<Math.abs(x.value-cau)?y:x)
  const cur=deliver(bud, isSuperspeedway(name)?P[bi]:nearest, g)
  const tot=cnt[0]+cnt[1]+cnt[2], w=cnt.map(x=>x/tot)
  const r=P.map(p=>deliver(bud,p,g)/bud)              // this track's bucket ratios
  const K=w[0]*r[0]+w[1]*r[1]+w[2]*r[2]
  const dA=w[0]*deliver(bud,P[0],g)+w[1]*deliver(bud,P[1],g)+w[2]*deliver(bud,P[2],g)
  const dC=w[0]*deliver(bud/K,P[0],g)+w[1]*deliver(bud/K,P[1],g)+w[2]*deliver(bud/K,P[2],g)
  for(const [k,v] of [['c',cur],['a',dA],['f',dC]]){a[k]+=Math.abs(v-truth); b[k]+=v-truth}
  console.log(name.padEnd(36),(truth*100).toFixed(1).padStart(6)+'%',
    (cur*100).toFixed(1).padStart(7)+'%',(dA*100).toFixed(1).padStart(11)+'%',(dC*100).toFixed(1).padStart(17)+'%')
}
const k=T.length
console.log('\n                       MAE      bias   (DNF-rate points, vs measured)')
console.log('  CURRENT           '+(a.c/k*100).toFixed(2).padStart(5)+'   '+(b.c/k*100).toFixed(2).padStart(6))
console.log('  FIX A dist-sample '+(a.a/k*100).toFixed(2).padStart(5)+'   '+(b.a/k*100).toFixed(2).padStart(6))
console.log('  FIX C +renorm     '+(a.f/k*100).toFixed(2).padStart(5)+'   '+(b.f/k*100).toFixed(2).padStart(6))

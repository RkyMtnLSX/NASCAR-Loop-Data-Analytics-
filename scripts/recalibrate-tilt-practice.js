// scripts/recalibrate-tilt-practice.js — the attempt to recalibrate the tilt curve on
// practice-carrying boards, and the evidence that it CANNOT be done with existing data.
//
//   node scripts/recalibrate-tilt-practice.js
//
// Fits a GLOBAL curve (3 free parameters, not the 12 the per-group version needs) on the first
// half of the practice-carrying races and tests on the second. Result: FAILS, because the
// target itself is not stable at this sample size — the fit half's strongest quartile retires
// at 7.9% and the test half's at 10.7%. The tier profile moves 2.8 points between halves,
// which is larger than the effect being fitted. See BACKTEST_LOG 2026-08-31.

// Recalibrate a GLOBAL curve (3 free params, not 12) on 2025 practice boards; test on 2026.
const fs=require('fs'),path=require('path')
const E=require('./loadEngine')
const {buildSpeedScores,runRaceSim,getCautionPresets,resolveDnfRate,__trackGroup,isRoadCourse,isSuperspeedway,
DEFAULT_WEIGHTS,TRUCK_SHORT_WEIGHTS,ROAD_COURSE_WEIGHTS,TRUCK_ROAD_WEIGHTS,SUPERSPEEDWAY_WEIGHTS,ONEILLY_SUPERSPEEDWAY_WEIGHTS}=E
const SIMS=Number(process.env.SIMS||8000),num=s=>(s===''||s==null?null:Number(s))
function wf(se,tr){if(isRoadCourse(tr))return se==='trucks'?TRUCK_ROAD_WEIGHTS:ROAD_COURSE_WEIGHTS
 if(isSuperspeedway(tr))return se==='oreilly'?ONEILLY_SUPERSPEEDWAY_WEIGHTS:SUPERSPEEDWAY_WEIGHTS
 if(se==='trucks'&&__trackGroup(tr)==='SHORT')return TRUCK_SHORT_WEIGHTS;return DEFAULT_WEIGHTS}
const all=[]
for(const line of fs.readFileSync(__dirname+'/backtest-data/holdout-practice.txt','utf8').split('\n').filter(l=>l.trim())){
  const [h,b]=line.split('#');if(!b)continue
  const [yr,series,track,grp,pDnf,pN,pCau]=h.split('|')
  const dr=[],dnf=[],fin=[];let i=0,nP=0
  for(const rec of b.split(';')){const f=rec.split(',');if(f.length<10)continue
    const v=num(f[9]); if(v!=null)nP++
    dr.push({name:'D'+i,startPos:num(f[0]),corrAvgRating:num(f[3]),corrAvgFinish:num(f[4]),nCorrRaces:num(f[5])||0,
      trackAvgRating:num(f[6]),trackAvgFinish:num(f[7]),nTrackRaces:num(f[8])||0,lrpTime:v,pitCrewTime:null,corrWinConv:null})
    dnf.push(num(f[2]));fin.push(num(f[1]));i++}
  if(dr.length<15||nP<dr.length*0.5)continue
  const P=getCautionPresets(series),cau=num(pCau)
  const sc=buildSpeedScores(dr,wf(series,track))
  const ord=sc.map((d,ix)=>({ix,s:d.speedScore||0})).sort((a,x)=>x.s-a.s)
  const tier=new Array(sc.length);ord.forEach((o,r)=>{tier[o.ix]=Math.min(3,Math.floor(r*4/sc.length))})
  all.push({yr:+yr,sc,dnf,fin,tier,g:__trackGroup(track),rate:resolveDnfRate(series,grp,num(pDnf),num(pN)||0),
    preset:cau==null?P[1]:isSuperspeedway(track)?P[cau<6?0:cau<11.5?1:2]:P.reduce((a,x)=>Math.abs(x.value-cau)<Math.abs(a.value-cau)?x:a)})
}
// TEMPORAL split. The earlier version sliced the file in half and ASSUMED that separated the
// seasons. It did not — races interleave by id (2025 occupies id-order rows 1-83, 2026 rows
// 33-94), so that "fit half" was a scrambled mix of both years. Corrected 2026-08-31 after the
// operator asked whether 2026 practice was even included. It was; the SPLIT was wrong.
const FIT=all.filter(b=>b.yr===2025), TEST=all.filter(b=>b.yr===2026)
function tiers(bs,curve,lvl){
  const T=[0,1,2,3].map(()=>({p:0,o:0,n:0,win:0,t10:0}))
  for(const b of bs){
    const rows=runRaceSim(b.sc,{numSims:SIMS,cautionPreset:b.preset,dnfRate:Math.min(0.6,b.rate*(lvl||1)),
      totalRaceLaps:300,trackGroup:b.g,startSampling:null,skillTilt:!!curve,tiltCurve:curve})
    for(const r of rows){const t=T[b.tier[r.simIdx]],f=b.fin[r.simIdx]
      const cl=p=>Math.max(1e-6,Math.min(1-1e-6,p))
      t.p+=r.dnfPct/100;t.o+=b.dnf[r.simIdx];t.n++
      t.win+=(cl(r.winPct/100)-(f===1?1:0))**2;t.t10+=(cl(r.top10Pct/100)-(f<=10?1:0))**2}}
  return T.map(t=>({pred:t.p/t.n,obs:t.o/t.n,win:t.win/t.n,t10:t.t10/t.n,n:t.n}))
}
const norm=a=>{const m=a.reduce((x,y)=>x+y,0)/a.length;return a.map(x=>x/m)}
console.log('FIT = 2025, '+FIT.length+' races.  TEST = 2026, '+TEST.length+' races. (practice boards)')
const o=tiers(FIT,null,1)
console.log('FIT 2025 observed  '+o.map(t=>(t.obs*100).toFixed(1).padStart(6)).join(''))
let curve=[1,1,1,1], lvl=1
for(let it=1;it<=5;it++){
  const d=tiers(FIT,curve,lvl)
  curve=norm(curve.map((c,i)=>c*(o[i].obs/Math.max(1e-4,d[i].pred))))
  const tot=d.reduce((s,t)=>s+t.pred*t.n,0)/d.reduce((s,t)=>s+t.n,0)
  const totO=o.reduce((s,t)=>s+t.obs*t.n,0)/o.reduce((s,t)=>s+t.n,0)
  lvl=lvl*(totO/tot)
  console.log(`  iter ${it}  curve [${curve.map(v=>v.toFixed(3)).join(', ')}]  level ${lvl.toFixed(3)}`)
}
console.log('\n=== TEST half (never used in the fit above) ===')
const A=tiers(TEST,null,1), B=tiers(TEST,curve,lvl)
console.log('tier            flat    TILT   ACTUAL   |flat-act| |tilt-act|  rail   win gain   top10 gain')
const nm=['Q4','Q3','Q2','Q1'];let pass=true
for(let i=0;i<4;i++){const ea=Math.abs(A[i].pred-A[i].obs),eb=Math.abs(B[i].pred-B[i].obs)
  const ok=eb<=ea+0.005;if(!ok)pass=false
  console.log(nm[i].padEnd(15)+(A[i].pred*100).toFixed(1).padStart(5)+(B[i].pred*100).toFixed(1).padStart(8)+
   (A[i].obs*100).toFixed(1).padStart(8)+(ea*100).toFixed(2).padStart(10)+(eb*100).toFixed(2).padStart(11)+'   '+
   (ok?'PASS':'FAIL').padEnd(6)+((A[i].win-B[i].win)*1e5).toFixed(2).padStart(9)+'e-5'+((A[i].t10-B[i].t10)*1e5).toFixed(2).padStart(11)+'e-5')}
const wA=A.reduce((s,t)=>s+t.win*t.n,0)/A.reduce((s,t)=>s+t.n,0), wB=B.reduce((s,t)=>s+t.win*t.n,0)/B.reduce((s,t)=>s+t.n,0)
const tA=A.reduce((s,t)=>s+t.t10*t.n,0)/A.reduce((s,t)=>s+t.n,0), tB=B.reduce((s,t)=>s+t.t10*t.n,0)/B.reduce((s,t)=>s+t.n,0)
console.log('\nRAIL: '+(pass?'PASS':'FAIL'))
console.log('aggregate  win Brier '+wA.toFixed(6)+' -> '+wB.toFixed(6)+'   top10 '+tA.toFixed(6)+' -> '+tB.toFixed(6))
console.log('\nRECALIBRATED (practice boards, global curve):')
console.log('  curve ['+curve.map(v=>v.toFixed(4)).join(', ')+']   level '+lvl.toFixed(3))

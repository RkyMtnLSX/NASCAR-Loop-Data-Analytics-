// scripts/backtest-attrition-sweep.js — how much does ATTRITION LEVEL actually move
// finishing-position forecast quality, and how much of any A/B gap is just MC noise?
//
//   node scripts/backtest-attrition-sweep.js
//
// Written when Fix C failed its registered holdout, to find out whether the failure was
// real or an artifact. Two parts:
//   1. sweep dnfRate x {0.6 .. 1.8} on the current arm and score win/top5 forecasts
//   2. run the SAME config five times to measure run-to-run noise in those metrics
// Part 2 is the one that makes part 1 readable. Without it a 0.00008 Brier gap is
// uninterpretable.
//
// Same holdout and same reconstruction as backtest-caution-mix.js - see that file's header
// for what is and is not reconstructed (no practice data).

process.env.SIMS = process.env.SIMS || '10000'
const fs=require('fs'),path=require('path')
const E=require('./loadEngine')
const {buildSpeedScores,runRaceSim,getCautionPresets,resolveDnfRate,__trackGroup,isRoadCourse,isSuperspeedway,
DEFAULT_WEIGHTS,TRUCK_SHORT_WEIGHTS,ROAD_COURSE_WEIGHTS,TRUCK_ROAD_WEIGHTS,SUPERSPEEDWAY_WEIGHTS,ONEILLY_SUPERSPEEDWAY_WEIGHTS}=E
const SIMS=Number(process.env.SIMS)
const num=s=>(s===''||s==null?null:Number(s))
function wf(series,track){if(isRoadCourse(track))return series==='trucks'?TRUCK_ROAD_WEIGHTS:ROAD_COURSE_WEIGHTS
 if(isSuperspeedway(track))return series==='oreilly'?ONEILLY_SUPERSPEEDWAY_WEIGHTS:SUPERSPEEDWAY_WEIGHTS
 if(series==='trucks'&&__trackGroup(track)==='SHORT')return TRUCK_SHORT_WEIGHTS; return DEFAULT_WEIGHTS}
const lines=fs.readFileSync(path.join(__dirname + '/backtest-data','holdout.txt'),'utf8').split('\n').filter(l=>l.trim())
const boards=[]
for(const line of lines){
  const [head,body]=line.split('#'); if(!body)continue
  const [series,track,grp,pDnf,pN,pCau,wl,wm,wh]=head.split('|')
  const drivers=[],fin=[],dnf=[]; let idx=0
  for(const rec of body.split(';')){const f=rec.split(','); if(f.length<9)continue
    drivers.push({name:'D'+idx,startPos:num(f[0]),corrAvgRating:num(f[3]),corrAvgFinish:num(f[4]),nCorrRaces:num(f[5])||0,
      trackAvgRating:num(f[6]),trackAvgFinish:num(f[7]),nTrackRaces:num(f[8])||0,lrpTime:null,pitCrewTime:null,corrWinConv:null})
    fin.push(num(f[1])); dnf.push(num(f[2])); idx++}
  if(drivers.length<15)continue
  const P=getCautionPresets(series), cau=num(pCau)
  const preset=cau==null?P[1]:isSuperspeedway(track)?P[cau<6?0:cau<11.5?1:2]:P.reduce((a,b)=>Math.abs(b.value-cau)<Math.abs(a.value-cau)?b:a)
  boards.push({series,track,preset,P,g:__trackGroup(track),rate:resolveDnfRate(series,grp,num(pDnf),num(pN)||0),
    sc:buildSpeedScores(drivers,wf(series,track)),fin,dnf,w:[+wl||0,+wm||0,+wh||0]})
}
function score(mk){ // mk(board)->rows
  let wb=0,wl2=0,t5b=0,n=0,dp=0,dobs=0,races=0
  for(const b of boards){
    const rows=mk(b)
    for(const r of rows){
      const p=Math.max(1e-6,Math.min(1-1e-6,r.winPct/100)), y=b.fin[r.simIdx]===1?1:0
      wb+=(p-y)*(p-y); wl2+=-(y?Math.log(p):Math.log(1-p)); n++
      const p5=Math.max(1e-6,Math.min(1-1e-6,r.top5Pct/100)), y5=b.fin[r.simIdx]<=5?1:0
      t5b+=(p5-y5)*(p5-y5)
    }
    dp+=rows.reduce((s,r)=>s+r.dnfPct,0)/100; dobs+=b.dnf.reduce((s,x)=>s+x,0); races++
  }
  return {winBrier:wb/n,winLL:wl2/n,t5Brier:t5b/n,dnfBias:(dp-dobs)/races,dnfPred:dp/races}
}
console.log('ATTRITION LEVEL SWEEP — current single-preset arm, dnfRate x mult')
console.log('mult   winBrier    winLogLoss   t5Brier     DNFcars  bias')
for(const m of [0.6,0.8,1.0,1.2,1.4,1.8]){
  const s=score(b=>runRaceSim(b.sc,{numSims:SIMS,cautionPreset:b.preset,dnfRate:Math.min(0.6,b.rate*m),totalRaceLaps:300,trackGroup:b.g,startSampling:null}))
  console.log(String(m).padEnd(6),s.winBrier.toFixed(6),' ',s.winLL.toFixed(6),' ',s.t5Brier.toFixed(6),' ',s.dnfPred.toFixed(2),' ',s.dnfBias.toFixed(2))
}

console.log('\nRUN-TO-RUN NOISE — identical config, 5 independent repeats of arm A')
const rep=[]
for(let i=0;i<5;i++){
  const s=score(b=>runRaceSim(b.sc,{numSims:SIMS,cautionPreset:b.preset,dnfRate:b.rate,totalRaceLaps:300,trackGroup:b.g,startSampling:null}))
  rep.push(s); console.log('  run'+(i+1),s.winBrier.toFixed(6),s.winLL.toFixed(6),s.t5Brier.toFixed(6))
}
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length
const sd=a=>{const m=mean(a);return Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/(a.length-1))}
for(const k of ['winBrier','winLL','t5Brier']){
  const v=rep.map(r=>r[k]); console.log('  '+k.padEnd(9)+' mean '+mean(v).toFixed(6)+'  sd '+sd(v).toFixed(6)+'  range '+(Math.max(...v)-Math.min(...v)).toFixed(6))
}

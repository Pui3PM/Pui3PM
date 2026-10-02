'use strict';
// Historical post-repair oracle retained as INPUT-REVERSAL INVARIANCE only.
// Optimality is tested separately by projector_optimality_oracle.cjs (10,000 brute-force cases).
const assert=require('assert');const {project25}=require('../../shadow/projector/logical25');const F=require('./_shadow_fixture');
let checked=0;const timeline={masterClockId:'m',anchor:{status:'verified',start:100000,end:100016,refs:['a']}};
for(let mask=0;mask<4096;mask++){
 const times=[mask%16,Math.floor(mask/16)%16,Math.floor(mask/256)%16].map(t=>100000+t);if(new Set(times).size<3)continue;
 const candidates=times.map((t,i)=>F.candidate(i+1,t,{candidateId:`c${i}`,derivationId:'d',measuredFPS:100000}));
 const args={runId:'r',cycleId:'c',masterClockId:'m',role:'side',timeline,roleBindings:[F.binding({startMasterTime:90000,endMasterTime:110000,capturePeriodUs:10,jitterUs:0})],projectionId:'inv',configDigest:'cfg'};
 const p1=project25({...args,candidates}),p2=project25({...args,candidates:[...candidates].reverse()});
 assert.deepEqual(p1.slots.map(x=>x.actualFrameUID),p2.slots.map(x=>x.actualFrameUID));checked++;
}
console.log(JSON.stringify({kind:'input-reversal-invariance',checked,counterexample:null,optimalityClaim:false}));

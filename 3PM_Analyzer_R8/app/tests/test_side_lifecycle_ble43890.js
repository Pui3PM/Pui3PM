'use strict';
const assert=require('assert');
const L=require('../static/side_lifecycle_core.js');

function frame(t,o={}){return Object.assign({
  epochMs:t,phaseQuality:.95,phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.98,
  phaseShootingPosture:false,phaseBowExtended:false,setReady:true,wristsLow:true,neutralEvidence:true,
  bowPlaneReady:false,bowPlaneStable:false,setAdmissionReady:false,drawSideVisible:true,
  bowSpeed:.08,drawSpeed:.08,faceHandSpeed:.08,bowArmDeg:112,phaseFaceDist:2.2
},o);}
function run(rows){let s=L.fresh(),events=[];for(const [input,native={}] of rows){const r=L.update(s,input,native,input.epochMs);s=r.state;if(r.event)events.push(r.event);}return{state:s,events};}
function quietSet(t0=0){return [0,55,110,165].map(dt=>[frame(t0+dt),{}]);}
function setupProof(t,o={}){return frame(t,{wristsLow:false,neutralEvidence:false,phaseShootingPosture:true,phaseBowExtended:true,bowPlaneReady:true,bowPlaneStable:true,setAdmissionReady:true,bowArmDeg:138,bowSpeed:1.15,drawSpeed:.25,faceHandSpeed:.3,...o});}
function drawProof(t,o={}){return frame(t,{wristsLow:false,neutralEvidence:false,phaseShootingPosture:true,phaseBowExtended:true,bowPlaneReady:true,bowPlaneStable:true,setAdmissionReady:true,bowArmDeg:145,bowSpeed:.5,drawSpeed:1.15,faceHandSpeed:1.05,phaseFaceDist:1.15,...o});}

// Trust-first invariant: arm/head/face movement without a credible shot plane stays private/provisional.
{
 const rows=[...quietSet(1000),
  [frame(1210,{wristsLow:false,neutralEvidence:false,bowSpeed:1.4,drawSpeed:1.1,faceHandSpeed:1.2,bowArmDeg:145,phaseFaceDist:1.1}),{phase:'Draw'}],
  [frame(1280,{wristsLow:false,neutralEvidence:false,bowSpeed:1.2,drawSpeed:1.0,faceHandSpeed:1.1,bowArmDeg:150,phaseFaceDist:1.0}),{phase:'Draw'}],
  [frame(1380),{phase:'Setup'}],[frame(1660),{phase:'Setup'}]
 ];
 const r=run(rows);
 assert.equal(r.events.filter(e=>e.type==='shot-start').length,0,'ordinary head/arm movement must never open a verified shot');
 assert.equal(r.state.shotActive,false);assert.equal(r.state.authorityPhase,'Set');
}

// Raise-first: Setup becomes public only after sustained real shot-plane evidence.
{
 const rows=[...quietSet(2000),
  [setupProof(2210,{drawSpeed:.15,faceHandSpeed:.2}),{}],
  [setupProof(2280,{drawSpeed:.18,faceHandSpeed:.22}),{}],
  [setupProof(2340,{drawSpeed:.2,faceHandSpeed:.25}),{}]
 ];
 const r=run(rows),start=r.events.find(e=>e.type==='shot-start');
 assert(start,'credible raise-first sequence must open a verified Setup cycle');
 assert.equal(start.verifiedStart,true);assert.equal(start.verifiedDraw,false);assert.equal(start.raiseIntent,true);
 assert.equal(r.state.authorityPhase,'Setup');
}

// Draw-first/preload may begin before a big raise, but it remains provisional until shot geometry arrives.
{
 let s=L.fresh(),events=[];const step=(input,native={})=>{const r=L.update(s,input,native,input.epochMs);s=r.state;if(r.event)events.push(r.event);return r;};
 for(const row of quietSet(3000))step(...row);
 step(frame(3210,{wristsLow:false,neutralEvidence:false,drawSpeed:1.25,faceHandSpeed:1.05,bowSpeed:.2,phaseFaceDist:1.05}),{phase:'Draw'});
 step(frame(3280,{wristsLow:false,neutralEvidence:false,drawSpeed:1.2,faceHandSpeed:1.0,bowSpeed:.25,phaseFaceDist:.98}),{phase:'Draw'});
 assert.equal(events.length,0,'draw-looking motion without shot plane must remain provisional');assert.equal(s.authorityPhase,'Set');
 step(drawProof(3350),{phase:'Draw',primaryPhase:'Draw',phaseTimeline:[{phase:'Draw',epochMs:3350}]});
 const r=step(drawProof(3430),{phase:'Draw',primaryPhase:'Draw',phaseTimeline:[{phase:'Draw',epochMs:3350}]});
 assert(events.some(e=>e.type==='shot-start'),'real draw geometry must promote the physical shot');
 assert.equal(r.snapshot.verifiedDraw,true);assert.equal(r.snapshot.authorityPhase,'Draw');
}

// Terminal lock: lowering after Release/Follow is recovery, never a new shot. Then next verified shot is clean.
{
 let s=L.fresh(),events=[];const step=(input,native={})=>{const r=L.update(s,input,native,input.epochMs);s=r.state;if(r.event)events.push(r.event);return r;};
 for(const row of quietSet(4000))step(...row);
 step(drawProof(4210),{phase:'Draw',phaseTimeline:[{phase:'Draw',epochMs:4210}]});
 step(drawProof(4290),{phase:'Draw',phaseTimeline:[{phase:'Draw',epochMs:4210}]});
 assert(events.some(e=>e.type==='shot-start'),'first verified shot must start');
 step(drawProof(5000),{releaseConfirmed:true,shotComplete:true,phase:'Follow Through',releaseEpochMs:4980,followThroughConfirmed:true});
 assert.equal(s.terminal,true,'Release must terminal-lock lifecycle');
 step(frame(5080,{setReady:false,bowSpeed:2.4,drawSpeed:1.4,bowArmDeg:120}),{phase:'Follow Through',releaseConfirmed:true,followThroughConfirmed:true});
 step(frame(5260,{setReady:false,bowSpeed:1.8,drawSpeed:1.0,bowArmDeg:105}),{phase:'Follow Through',releaseConfirmed:true,followThroughConfirmed:true,followThroughEnded:true});
 assert.equal(events.filter(e=>e.type==='shot-start').length,1,'recovery/lowering must not create a false next shot');
 assert(events.some(e=>e.type==='recovery-complete'),'terminal path must return to Set');assert.equal(s.shotActive,false);
 for(const t of [5400,5460,5520,5580])step(frame(t));
 step(drawProof(5650),{phase:'Draw',phaseTimeline:[{phase:'Draw',epochMs:5650}]});step(drawProof(5730),{phase:'Draw',phaseTimeline:[{phase:'Draw',epochMs:5650}]});
 assert.equal(events.filter(e=>e.type==='shot-start').length,2,'next physical shot must start only from fresh verified evidence');
}

assert.equal(L.VERSION,'BLE4.3.8.9.5.5-side-lifecycle-v7');
assert.equal(L.displayPhase('Setup'),'Set');assert.equal(L.displayPhase('Set'),'Setup');
assert.equal(L.authorityPhase({terminal:true,shotActive:true,mode:'follow'},{phase:'Expansion'}),'Follow Through');
assert.equal(L.authorityPhase({terminal:true,shotActive:true,mode:'recovery'},{phase:'Setup'}),'Recovery');
assert.equal(L.authorityPhase({terminal:false,shotActive:false,mode:'set'},{phase:'Setup'}),'Set');
console.log('BLE4.3.8.9.4.1 Side Lifecycle QA PASS · provisional false-start guard · verified Setup/Draw · terminal authority · clean next shot');

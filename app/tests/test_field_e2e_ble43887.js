'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const edge=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/ble43886_field_edgecases.json'),'utf8'));
const legacy=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/ble43883_zero_capture_field_regression.json'),'utf8'));
const C=require('../static/capture_integrity_core.js');
const I=require('../static/shot_intent_core.js');
const A=require('../static/adaptive_release_core.js');
const G=require('../static/foundation_guard_core.js');

function makeContext(){
  const appCommits=[],evidenceHandoffs=[],uiPhases=[],dummyClass={add(){},remove(){},toggle(){}};
  const document={readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},getElementById(id){if(id==='sideVideo')return{srcObject:{getVideoTracks(){return[]}}};return null},body:{classList:dummyClass,dataset:{}}};
  const ctx={console:{log(){},warn(){},error(){}},Date,Math,JSON,Number,String,Array,Object,Set,Map,Promise,
    queueMicrotask:fn=>fn(),setInterval:()=>0,clearInterval(){},setTimeout:()=>0,clearTimeout(){},innerWidth:1280,innerHeight:720,
    document,navigator:{userAgent:'ble43888-field-e2e',vendor:'3PM'},Blob:function(){},URL:{createObjectURL(){return''},revokeObjectURL(){}},indexedDB:{},CustomEvent:function(){},Event:function(){}};
  ctx.window=ctx;ctx.globalThis=ctx;ctx.addEventListener=()=>{};ctx.dispatchEvent=()=>{};
  ctx.CaptureIntegrityCore=C;ctx.ShotIntentCore=I;ctx.AdaptiveReleaseCore=A;ctx.FoundationGuardCore=G;
  ctx.TemporalEvidenceLayer={
    beginCycle(){},phase(){},
    release(m,cycleId){evidenceHandoffs.push({cycleId,releaseEpochMs:Number(m?.releaseEpochMs||m?.releaseAlignedEpochMs)});},
    endCycle(){},diagnostics(){return{}},browserInfo(){return{}}
  };
  ctx.CoreEngine={createAthleteShotEngine(){return{update(role,input){return input.__result},reset(){}}},AuthorityTracker:function(){},selectAuthorityRole(){},evidenceScore(){return 1}};
  ctx.FormAnalyzer={getCurrentSessionId(){return 1},onPoseMetrics(){},updateLivePhase(p,m){uiPhases.push({t:Number(m?.epochMs)||0,p})},onShotEvidence(m){appCommits.push(m)},isAutoMarkEnabled(){return true}};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../static/capture_integrity_layer.js'),'utf8'),ctx,{filename:'capture_integrity_layer.js'});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../static/foundation_guard_layer.js'),'utf8'),ctx,{filename:'foundation_guard_layer.js'});
  ctx.CaptureIntegrityLayer.installFormAnalyzer();ctx.FoundationGuardLayer.installFormAnalyzer();
  ctx.CaptureIntegrityLayer.registry.side.active=true;ctx.CaptureIntegrityLayer.registry.side.generation=1;
  return{ctx,appCommits,evidenceHandoffs,uiPhases,engine:ctx.CoreEngine.createAthleteShotEngine()};
}
function resultFrom(r){return{...r,epochMs:r.t,role:'side',metricConfidence:{drawElbow:1,bowArm:1},quality:1};}
function rawFrom(r,result){return{__result:result,epochMs:r.t,setReady:r.nativeSetReady===true,phaseQuality:r.phaseQuality,
  phaseShootingPosture:r.phaseShootingPosture===true,shootingPosture:r.phaseShootingPosture===true,
  phaseBowExtended:r.phaseBowExtended===true,bowExtended:r.phaseBowExtended===true,
  phaseFaceDist:r.phaseFaceDist,phaseDrawWristVisibility:r.phaseDrawWristVisibility,phaseDrawElbowVisibility:r.phaseDrawElbowVisibility,
  bowWristRel:{x:r.bowWristRelX,y:r.bowWristRelY},bowArmDeg:r.bowArmDeg,measurementTrustScore:r.measurementTrust,
  criticalTrackingOK:(r.measurementTrust??1)>0,wristsLow:r.wristsLow===true,bowSpeed:r.bowSpeed,trackingDrop:r.trackingDrop,visibilityDrop:r.visibilityDrop,
  visualMotionCorroborated:r.visualMotionCorroborated,visualMotionRatio:r.visualMotionRatio,visualMotionLocalGlobal:r.visualMotionLocalGlobal};}
function feed(h,r){const out=h.engine.update('side',rawFrom(r,resultFrom(r)));h.ctx.FormAnalyzer.onPoseMetrics('side',out);h.ctx.FormAnalyzer.updateLivePhase(out.phase,out);if(out.shotComplete)h.ctx.FormAnalyzer.onShotEvidence(out);return out;}

// A. Exact BLE43886 field false-negative: a strong genuine release impulse occurred before native arming,
// then frozen core emitted letDown on the next terminal frame. BLE43887 must rescue exactly one transaction at original T0.
{
  const h=makeContext();let last=null;
  for(const r of edge.fast_genuine)last=feed(h,r);
  const run=h.ctx.CaptureIntegrityLayer.run(),commits=run.events.filter(e=>e.type==='capture_committed');
  assert.equal(h.appCommits.length,1,'fast genuine field shot must Capture exactly once through full wrappers');
  assert.equal(commits.length,1,'CaptureIntegrity transaction must commit exactly once');
  assert.equal(Number(h.appCommits[0].releaseEpochMs),1790398499178,'fast genuine shot must preserve original release impulse T0');
  assert.equal(h.evidenceHandoffs.length,1,'TemporalEvidence release handoff must occur exactly once');
  assert.equal(h.evidenceHandoffs[0].releaseEpochMs,1790398499178);
  assert.equal(last.releaseConfirmed,true);assert.equal(last.shotComplete,true);assert.equal(last.letDown,false);
  const c=run.currentCycle;assert(c?.captureCommitted===true,'field rescue must remain inside the verified ShotIntent cycle');
  const phases=c.timeline.map(x=>x.phase);for(const p of ['Draw','Anchor','Aim / Hold','Release','Follow Through'])assert(phases.includes(p),`fast genuine transaction missing ${p}`);
}

// B. Exact BLE43886 early false-Capture edge. Through the old false latch point there must be zero
// transaction/evidence commits. A later true Release (same cycle) must then commit once, preserving Expansion.
{
  const h=makeContext();
  const prefix=edge.expansion_then_real_release.filter(r=>r.t<=1790398541544);
  for(const r of prefix)feed(h,r);
  assert.equal(h.appCommits.length,0,'Expansion motion must be 0 Capture at the BLE43886 false-latch edge');
  assert.equal(h.evidenceHandoffs.length,0,'Expansion motion must not create evidence release handoff');
  assert.equal(h.ctx.CaptureIntegrityLayer.run().events.filter(e=>e.type==='capture_committed').length,0);
  const premature=h.uiPhases.filter(x=>x.t<=1790398541544&&['Release','Follow Through'].includes(x.p));
  assert.equal(premature.length,0,'Live Phase must not expose Release/Follow Through before validated release');
  for(const r of edge.expansion_then_real_release.filter(r=>r.t>1790398541544))feed(h,r);
  const run=h.ctx.CaptureIntegrityLayer.run(),commits=run.events.filter(e=>e.type==='capture_committed');
  assert.equal(h.appCommits.length,1,'later true release must Capture exactly once');
  assert.equal(commits.length,1);assert.equal(h.evidenceHandoffs.length,1);
  assert.equal(Number(h.appCommits[0].releaseEpochMs),1790398541660,'true release T0 must replace earlier Expansion pulse');
  const c=run.currentCycle;assert(c?.captureCommitted===true);
  const phases=c.timeline.map(x=>x.phase);assert(phases.includes('Expansion'),'validated cycle must retain Expansion evidence');assert(phases.includes('Release'));assert(phases.includes('Follow Through'));
}

// C. Existing trace-backed deliberate/unsupported terminal movement must remain zero through the same
// ShotIntent + Foundation + CaptureIntegrity path, guarding against broad rescue thresholds.
{
  const seg=legacy.segments.find(x=>x.name==='shot4');assert(seg,'shot4 fixture missing');
  const h=makeContext();for(const r of seg.samples)feed(h,r);
  const commits=h.ctx.CaptureIntegrityLayer.run().events.filter(e=>e.type==='capture_committed');
  assert.equal(h.appCommits.length,0,'deliberate/unsupported let-down must remain 0 Capture through full wrappers');
  assert.equal(commits.length,0);assert.equal(h.evidenceHandoffs.length,0);
}
console.log('BLE4.3.8.8.7 CURRENT-FIELD REAL-LAYER E2E PASS · missed genuine release rescued 1 · Expansion false-Capture 0 · later real Release 1 · deliberate/unsupported let-down 0 · ShotIntent + Foundation + CaptureIntegrity + commit + TemporalEvidence handoff');

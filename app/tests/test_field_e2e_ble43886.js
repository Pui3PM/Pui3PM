'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/ble43885_latest_rolling90s_regression.json'),'utf8'));
const C=require('../static/capture_integrity_core.js');
const I=require('../static/shot_intent_core.js');
const A=require('../static/adaptive_release_core.js');
const G=require('../static/foundation_guard_core.js');
const L=require('../static/side_lifecycle_core.js');

function makeContext(){
  const appCommits=[],evidenceReleases=[],uiPhases=[],dummyClass={add(){},remove(){},toggle(){}};
  const document={readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},getElementById(id){if(id==='sideVideo')return{srcObject:{getVideoTracks(){return[]}}};return null},body:{classList:dummyClass,dataset:{}}};
  const ctx={console:{log(){},warn(){},error(){}},Date,Math,JSON,Number,String,Array,Object,Set,Map,Promise,
    queueMicrotask:fn=>fn(),setInterval:()=>0,clearInterval(){},setTimeout:()=>0,clearTimeout(){},innerWidth:1280,innerHeight:720,
    document,navigator:{userAgent:'ble43886-field-e2e',vendor:'3PM'},Blob:function(){},URL:{createObjectURL(){return''},revokeObjectURL(){}},indexedDB:{},CustomEvent:function(){},Event:function(){}};
  ctx.window=ctx;ctx.globalThis=ctx;ctx.addEventListener=()=>{};ctx.dispatchEvent=()=>{};
  ctx.CaptureIntegrityCore=C;ctx.ShotIntentCore=I;ctx.AdaptiveReleaseCore=A;ctx.FoundationGuardCore=G;ctx.SideLifecycleCore=L;
  ctx.TemporalEvidenceLayer={beginCycle(){},phase(){},release(e){evidenceReleases.push(Number(e?.releaseEpochMs||e))},endCycle(){},diagnostics(){return{}},browserInfo(){return{}}};
  ctx.CoreEngine={createAthleteShotEngine(){return{update(role,input){return input.__result},reset(){}}},AuthorityTracker:function(){},selectAuthorityRole(){},evidenceScore(){return 1}};
  ctx.FormAnalyzer={getCurrentSessionId(){return 1},onPoseMetrics(){},updateLivePhase(p,m){uiPhases.push({t:Number(m?.epochMs)||0,p})},onShotEvidence(m){appCommits.push(m)},isAutoMarkEnabled(){return true}};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../static/capture_integrity_layer.js'),'utf8'),ctx,{filename:'capture_integrity_layer.js'});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../static/foundation_guard_layer.js'),'utf8'),ctx,{filename:'foundation_guard_layer.js'});
  ctx.CaptureIntegrityLayer.installFormAnalyzer();ctx.FoundationGuardLayer.installFormAnalyzer();
  ctx.CaptureIntegrityLayer.registry.side.active=true;ctx.CaptureIntegrityLayer.registry.side.generation=1;
  return{ctx,appCommits,evidenceReleases,uiPhases,engine:ctx.CoreEngine.createAthleteShotEngine()};
}
function resultFrom(r){return{...r,epochMs:r.t,role:'side',metricConfidence:{drawElbow:1,bowArm:1},quality:1};}
function rawFrom(r,result){return{__result:result,epochMs:r.t,setReady:r.nativeSetReady===true,phaseQuality:r.phaseQuality,
  phaseShootingPosture:r.phaseShootingPosture===true,shootingPosture:r.phaseShootingPosture===true,
  phaseBowExtended:r.phaseBowExtended===true,bowExtended:r.phaseBowExtended===true,
  phaseFaceDist:r.phaseFaceDist,phaseDrawWristVisibility:r.phaseDrawWristVisibility,phaseDrawElbowVisibility:r.phaseDrawElbowVisibility,
  bowWristRel:{x:r.bowWristRelX,y:r.bowWristRelY},bowArmDeg:r.bowArmDeg,measurementTrustScore:r.measurementTrust,
  criticalTrackingOK:(r.measurementTrust??1)>0,wristsLow:false,bowSpeed:r.bowSpeed,trackingDrop:r.trackingDrop,visibilityDrop:r.visibilityDrop,
  visualMotionCorroborated:r.visualMotionCorroborated,visualMotionRatio:r.visualMotionRatio,visualMotionLocalGlobal:r.visualMotionLocalGlobal};}
function feed(h,r){const out=h.engine.update('side',rawFrom(r,resultFrom(r)));h.ctx.FormAnalyzer.onPoseMetrics('side',out);h.ctx.FormAnalyzer.updateLivePhase(out.phase,out);if(out.shotComplete)h.ctx.FormAnalyzer.onShotEvidence(out);return out;}

const h=makeContext();
let firstShotCompleteByRelease=new Map();
for(const r of fixture.samples){
  const out=feed(h,r);
  if(out.releaseConfirmed===true&&out.shotComplete===true){
    const rel=Number(out.releaseEpochMs);if(!firstShotCompleteByRelease.has(rel))firstShotCompleteByRelease.set(rel,{t:r.t,out});
  }
}
const run=h.ctx.CaptureIntegrityLayer.run();
const commits=run.events.filter(e=>e.type==='capture_committed');
assert.equal(h.appCommits.length,5,'rolling 90 s field window must produce exactly five real release transactions');
assert.equal(commits.length,5,'CaptureIntegrity commit count must exactly match app commit count');
assert.equal(h.evidenceReleases.length,5,'TemporalEvidence release handoff must occur exactly once per commit');
assert.equal(new Set(commits.map(e=>e.cycle_id)).size,5,'no cycle may double Capture');
assert.equal(run.events.filter(e=>e.type==='shot_veto').length,0,'accepted genuine releases must not be vetoed by downstream transaction guard');
const completed=run.cycles.filter(c=>c.captureCommitted===true),letdowns=run.cycles.filter(c=>c.letDown===true&&!c.captureCommitted);
assert.equal(completed.length,5,'five field cycles in the rolling window must close as captured');
assert(letdowns.length>=1&&letdowns.length<=2,'weak/aborted field actions must remain 0 Capture without manufacturing extra verified cycles');
for(const c of completed){
  const phases=c.timeline.map(x=>x.phase);
  for(const p of ['Draw','Anchor','Aim / Hold','Release','Follow Through'])assert(phases.includes(p),`${c.id}: transaction evidence missing ${p}`);
}
for(const m of h.appCommits){
  const rel=Number(m.releaseEpochMs),edge=firstShotCompleteByRelease.get(rel);assert(edge,`release ${rel}: commit must originate at shotComplete edge`);
  assert.equal(edge.out.followThroughEnded,false,`release ${rel}: Capture must be committed before Recovery / follow-through end`);
}
// Foundation UI may return to Setup after a completed transaction but must never regress to Draw after the
// same release has already been committed and before its recovery edge.
for(const m of h.appCommits){
  const rel=Number(m.releaseEpochMs),edge=firstShotCompleteByRelease.get(rel);const cycle=completed.find(c=>Number(c.captureReleaseEpoch)===rel);if(!cycle?.followEnd)continue;
  const between=h.uiPhases.filter(x=>x.t>=edge.t&&x.t<=cycle.followEnd).map(x=>x.p);
  assert.equal(between.includes('Draw'),false,`release ${rel}: Live Phase regressed to Draw after Capture`);
}
console.log('BLE4.3.8.8.6 REAL-LAYER FIELD E2E PASS · exact rolling trace window: 5 Capture exactly-once + weak/aborted actions remain zero-capture · ShotIntent + Foundation + CaptureIntegrity + commit + TemporalEvidence handoff · Capture precedes Recovery');

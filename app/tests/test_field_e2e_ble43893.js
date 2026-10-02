'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const fx=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/ble43893_real_bow_release_readiness.json'),'utf8'));
const C=require('../static/capture_integrity_core.js');
const I=require('../static/shot_intent_core.js');
const A=require('../static/adaptive_release_core.js');
const G=require('../static/foundation_guard_core.js');
const L=require('../static/side_lifecycle_core.js');
const B=require('../static/real_bow_anchor_bridge_core.js');

function makeContext(){
  const appCommits=[],evidenceHandoffs=[],uiPhases=[],dummyClass={add(){},remove(){},toggle(){}};
  const document={readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},getElementById(id){if(id==='sideVideo')return{srcObject:{getVideoTracks(){return[]}}};return null},body:{classList:dummyClass,dataset:{}}};
  const ctx={console:{log(){},warn(){},error(){}},Date,Math,JSON,Number,String,Array,Object,Set,Map,Promise,
    queueMicrotask:fn=>fn(),setInterval:()=>0,clearInterval(){},setTimeout:()=>0,clearTimeout(){},innerWidth:1280,innerHeight:720,
    document,navigator:{userAgent:'ble43893-field-e2e',vendor:'3PM'},Blob:function(){},URL:{createObjectURL(){return''},revokeObjectURL(){}},indexedDB:{},CustomEvent:function(){},Event:function(){}};
  ctx.window=ctx;ctx.globalThis=ctx;ctx.addEventListener=()=>{};ctx.dispatchEvent=()=>{};
  ctx.CaptureIntegrityCore=C;ctx.ShotIntentCore=I;ctx.AdaptiveReleaseCore=A;ctx.FoundationGuardCore=G;ctx.SideLifecycleCore=L;ctx.RealBowAnchorBridgeCore=B;
  ctx.TemporalEvidenceLayer={beginCycle(){},phase(){},release(m,cycleId){evidenceHandoffs.push({cycleId,releaseEpochMs:Number(m?.releaseEpochMs||m?.releaseAlignedEpochMs)});},endCycle(){},diagnostics(){return{}},browserInfo(){return{}}};
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
function rawFrom(r,result){
  const neutral=result.phase==='Setup'&&!result.detected;
  const x=Number.isFinite(r.bowWristRelX)?r.bowWristRelX:(neutral?.1:.92);
  const y=Number.isFinite(r.bowWristRelY)?r.bowWristRelY:(neutral?1.75:.55);
  return{__result:result,epochMs:r.t,setReady:r.nativeSetReady===true,phaseQuality:r.phaseQuality??.96,
    phaseShootingPosture:r.phaseShootingPosture===true,shootingPosture:r.phaseShootingPosture===true,
    phaseBowExtended:r.phaseBowExtended===true,bowExtended:r.phaseBowExtended===true,
    phaseFaceDist:r.phaseFaceDist,phaseDrawWristVisibility:r.phaseDrawWristVisibility??.96,phaseDrawElbowVisibility:r.phaseDrawElbowVisibility??.96,
    bowWristRel:{x,y},bowArmDeg:r.bowArmDeg??(neutral?105:165),measurementTrustScore:r.measurementTrust??1,
    criticalTrackingOK:(r.measurementTrust??1)>0,wristsLow:neutral,bowSpeed:r.bowSpeed??0,drawSpeed:r.drawSpeed??0,faceHandSpeed:r.faceHandSpeed??0,
    trackingDrop:r.trackingDrop??0,visibilityDrop:r.visibilityDrop??0,visualMotionCorroborated:r.visualMotionCorroborated===true,
    visualMotionRatio:r.visualMotionRatio??0,visualMotionLocalGlobal:r.visualMotionLocalGlobal??0};
}
function feed(h,r){const out=h.engine.update('side',rawFrom(r,resultFrom(r)));h.ctx.FormAnalyzer.onPoseMetrics('side',out);h.ctx.FormAnalyzer.updateLivePhase(out.phase,out);if(out.shotComplete)h.ctx.FormAnalyzer.onShotEvidence(out);return out;}
function prelude(t){return[
  {t:t-1320,phase:'Setup',primaryPhase:'Setup',detected:true,phaseQuality:.96,phaseShootingPosture:false,phaseBowExtended:false,nativeSetReady:false,measurementTrust:1,phaseDrawWristVisibility:.95,phaseDrawElbowVisibility:.95,bowSpeed:0,drawSpeed:0,faceHandSpeed:0,bowWristRelX:.10,bowWristRelY:1.75,bowArmDeg:105},
  {t:t-1180,phase:'Setup',primaryPhase:'Setup',detected:true,phaseQuality:.96,phaseShootingPosture:false,phaseBowExtended:false,nativeSetReady:false,measurementTrust:1,phaseDrawWristVisibility:.95,phaseDrawElbowVisibility:.95,bowSpeed:0,drawSpeed:0,faceHandSpeed:0,bowWristRelX:.10,bowWristRelY:1.75,bowArmDeg:105},
  {t:t-1080,phase:'Setup',primaryPhase:'Setup',detected:true,phaseQuality:.96,phaseShootingPosture:false,phaseBowExtended:false,nativeSetReady:false,measurementTrust:1,phaseDrawWristVisibility:.95,phaseDrawElbowVisibility:.95,bowSpeed:0,drawSpeed:0,faceHandSpeed:0,bowWristRelX:.10,bowWristRelY:1.75,bowArmDeg:105},
  {t:t-900,phase:'Set',primaryPhase:'Set',detected:true,phaseQuality:.97,phaseShootingPosture:true,phaseBowExtended:true,nativeSetReady:true,measurementTrust:1,phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.98,bowSpeed:.4,drawSpeed:.2,faceHandSpeed:.2,bowWristRelX:.92,bowWristRelY:.55,bowArmDeg:160},
  {t:t-760,phase:'Set',primaryPhase:'Set',detected:true,phaseQuality:.97,phaseShootingPosture:true,phaseBowExtended:true,nativeSetReady:true,measurementTrust:1,phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.98,bowSpeed:.4,drawSpeed:.2,faceHandSpeed:.2,bowWristRelX:.92,bowWristRelY:.55,bowArmDeg:160},
  {t:t-620,phase:'Set',primaryPhase:'Set',detected:true,phaseQuality:.97,phaseShootingPosture:true,phaseBowExtended:true,nativeSetReady:true,measurementTrust:1,phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.98,bowSpeed:.4,drawSpeed:.2,faceHandSpeed:.2,bowWristRelX:.92,bowWristRelY:.55,bowArmDeg:160},
  {t:t-480,phase:'Set',primaryPhase:'Set',detected:true,phaseQuality:.97,phaseShootingPosture:true,phaseBowExtended:true,nativeSetReady:true,measurementTrust:1,phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.98,bowSpeed:.4,drawSpeed:.2,faceHandSpeed:.2,bowWristRelX:.92,bowWristRelY:.55,bowArmDeg:160},
  {t:t-300,phase:'Draw',primaryPhase:'Draw',detected:true,phaseQuality:.97,phaseShootingPosture:true,phaseBowExtended:true,nativeSetReady:true,measurementTrust:1,phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.98,bowSpeed:1.0,drawSpeed:1.1,faceHandSpeed:1.0,blocker:'waiting_anchor',letDown:false,bowWristRelX:.92,bowWristRelY:.55,bowArmDeg:165},
  {t:t-190,phase:'Draw',primaryPhase:'Draw',detected:true,phaseQuality:.97,phaseShootingPosture:true,phaseBowExtended:true,nativeSetReady:true,measurementTrust:1,phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.98,bowSpeed:.9,drawSpeed:1.0,faceHandSpeed:.9,blocker:'waiting_anchor',letDown:false,bowWristRelX:.92,bowWristRelY:.55,bowArmDeg:165},
  {t:t-90,phase:'Draw',primaryPhase:'Draw',detected:true,phaseQuality:.97,phaseShootingPosture:true,phaseBowExtended:true,nativeSetReady:true,measurementTrust:1,phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.98,bowSpeed:.9,drawSpeed:1.0,faceHandSpeed:.9,blocker:'waiting_anchor',letDown:false,bowWristRelX:.92,bowWristRelY:.55,bowArmDeg:165}
];}
function runCycle(c){const h=makeContext();for(const r of prelude(c.samples[0].t))feed(h,r);let last=null;for(const r of c.samples)last=feed(h,r);return{h,last,run:h.ctx.CaptureIntegrityLayer.run()};}

// Full-wrapper field regression: two representative real-bow releases that BLE43892 labelled let-down
// must now traverse ShotIntent + Foundation + CaptureIntegrity and commit exactly one shot/evidence handoff.
for(const idx of [0,1]){
  const c=fx.real_bow_missed_releases[idx],{h,last,run}=runCycle(c),commits=run.events.filter(e=>e.type==='capture_committed');
  assert.equal(h.appCommits.length,1,`${c.id} must Capture exactly once through full wrappers`);
  assert.equal(commits.length,1,`${c.id} CaptureIntegrity transaction must commit once`);
  assert.equal(h.evidenceHandoffs.length,1,`${c.id} TemporalEvidence handoff must occur once`);
  assert.equal(last.shotComplete,true);assert.equal(last.releaseConfirmed,true);assert.equal(last.letDown,false);
  assert.equal(last.adaptiveReleaseSource,'hold-watch-terminal');
  const cycle=run.currentCycle;assert(cycle?.captureCommitted===true,`${c.id} must remain inside verified ShotIntent cycle`);
  for(const p of ['Draw','Anchor','Aim / Hold','Release','Follow Through'])assert(cycle.timeline.map(x=>x.phase).includes(p),`${c.id} missing ${p}`);
}

// Full-wrapper hard negative: confirmed deep deliberate let-down must still produce no app commit or evidence handoff.
{
  const {h,run}=runCycle(fx.confirmed_deep_let_down),commits=run.events.filter(e=>e.type==='capture_committed');
  assert.equal(h.appCommits.length,0,'confirmed deep let-down must remain 0 Capture through full wrappers');
  assert.equal(commits.length,0);assert.equal(h.evidenceHandoffs.length,0);
}

console.log('BLE4.3.8.9.3 CURRENT-FIELD REAL-LAYER E2E PASS · 2 trace-backed real-bow misses rescued exactly once · deep deliberate let-down 0 · ShotIntent + Foundation + CaptureIntegrity + commit + TemporalEvidence handoff');

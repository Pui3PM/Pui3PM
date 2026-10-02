'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/ble43884_latest_e2e_regression.json'),'utf8'));
const C=require('../static/capture_integrity_core.js');
const I=require('../static/shot_intent_core.js');
const A=require('../static/adaptive_release_core.js');
const G=require('../static/foundation_guard_core.js');
const html=fs.readFileSync(path.join(__dirname,'../static/index.html'),'utf8');
assert(html.indexOf('capture_integrity_layer.js?v=mac20260930r7')<html.indexOf('app.js?v=ble43888'),'CaptureIntegrity must load before app so it can install Core authority');
assert(html.indexOf('app.js?v=ble43888')<html.indexOf('foundation_guard_layer.js?v=mac20260930r7'),'Foundation must wrap after app in the shipped runtime order');
assert(html.indexOf('foundation_guard_layer.js?v=mac20260930r7')<html.indexOf('CaptureIntegrityLayer?.installFormAnalyzer?.()'),'explicit CaptureIntegrity FormAnalyzer install must remain after Foundation script tag');

function makeContext({disableForwardIntent=false}={}){
  const commits=[],dummyClass={add(){},remove(){},toggle(){}};
  const document={readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},getElementById(id){if(id==='sideVideo')return{srcObject:{getVideoTracks(){return[]}}};return null},body:{classList:dummyClass,dataset:{}}};
  const ctx={console:{log(){},warn(){},error(){}},Date,Math,JSON,Number,String,Array,Object,Set,Map,Promise,
    queueMicrotask:fn=>fn(),setInterval:()=>0,clearInterval(){},setTimeout:()=>0,clearTimeout(){},innerWidth:1280,innerHeight:720,
    document,navigator:{userAgent:'e2e-test',vendor:'3PM'},Blob:function(){},URL:{createObjectURL(){return''},revokeObjectURL(){}},indexedDB:{},CustomEvent:function(){},Event:function(){}};
  ctx.window=ctx;ctx.globalThis=ctx;ctx.addEventListener=()=>{};ctx.dispatchEvent=()=>{};
  ctx.CaptureIntegrityCore=C;
  ctx.ShotIntentCore=disableForwardIntent?{...I,startProof(){return null}}:I;
  ctx.AdaptiveReleaseCore=A;ctx.FoundationGuardCore=G;
  ctx.TemporalEvidenceLayer={beginCycle(){},phase(){},release(){},endCycle(){},diagnostics(){return{}},browserInfo(){return{}}};
  ctx.CoreEngine={createAthleteShotEngine(){return{update(role,input){return input.__result},reset(){}}},AuthorityTracker:function(){},selectAuthorityRole(){},evidenceScore(){return 1}};
  ctx.FormAnalyzer={getCurrentSessionId(){return 1},onPoseMetrics(){},updateLivePhase(){},onShotEvidence(m){commits.push(m)},isAutoMarkEnabled(){return true}};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../static/capture_integrity_layer.js'),'utf8'),ctx,{filename:'capture_integrity_layer.js'});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../static/foundation_guard_layer.js'),'utf8'),ctx,{filename:'foundation_guard_layer.js'});
  // Match index.html runtime order: CaptureIntegrity is explicitly installed after app.js, then Foundation wraps it on DOMContentLoaded.
  ctx.CaptureIntegrityLayer.installFormAnalyzer();ctx.FoundationGuardLayer.installFormAnalyzer();
  ctx.CaptureIntegrityLayer.registry.side.active=true;ctx.CaptureIntegrityLayer.registry.side.generation=1;
  return{ctx,commits,engine:ctx.CoreEngine.createAthleteShotEngine()};
}
function resultFrom(r){return{...r,epochMs:r.t,role:'side',metricConfidence:{drawElbow:1,bowArm:1},quality:1};}
function rawFrom(r,result){return{__result:result,epochMs:r.t,setReady:r.nativeSetReady===true,phaseQuality:r.phaseQuality,
  phaseShootingPosture:r.phaseShootingPosture===true,shootingPosture:r.phaseShootingPosture===true,
  phaseBowExtended:r.phaseBowExtended===true,bowExtended:r.phaseBowExtended===true,
  phaseDrawWristVisibility:r.phaseDrawWristVisibility,phaseDrawElbowVisibility:r.phaseDrawElbowVisibility,
  bowWristRel:{x:r.bowWristRelX,y:r.bowWristRelY},bowArmDeg:r.bowArmDeg,measurementTrustScore:r.measurementTrust,
  criticalTrackingOK:(r.measurementTrust??1)>0,wristsLow:false};}
function feed(h,r){const result=resultFrom(r),out=h.engine.update('side',rawFrom(r,result));h.ctx.FormAnalyzer.onPoseMetrics('side',out);h.ctx.FormAnalyzer.updateLivePhase(out.phase,out);if(out.shotComplete)h.ctx.FormAnalyzer.onShotEvidence(out);return out;}

// A. Replay the exact latest field run THROUGH THE ACTUAL CaptureIntegrity + Foundation wrapper chain.
// This run contains 3 native genuine releases and 1 explicit Hold/Expansion -> let-down between them.
{
  const h=makeContext(),terminalUi=[];
  for(const r of fixture.samples){
    feed(h,r);
    if(r.releaseConfirmed===true&&fixture.expected_native_releases.includes(Number(r.releaseEpochMs))){
      const fg=h.ctx.FoundationGuardLayer.traceState();
      terminalUi.push({t:r.t,release:Number(r.releaseEpochMs),phase:fg.currentPhase,lock:fg.terminalLock,postCapture:fg.postCaptureReady});
    }
  }
  const run=h.ctx.CaptureIntegrityLayer.run(),releaseList=h.commits.map(x=>Number(x.releaseEpochMs));
  assert.deepStrictEqual(releaseList,fixture.expected_native_releases,'latest real field trace must commit exactly the 3 genuine releases');
  assert.equal(run.events.filter(e=>e.type==='shot_veto').length,0,'genuine field releases must not be vetoed');
  const eventReleases=Array.from(run.events.filter(e=>e.type==='capture_committed'),e=>Number(e.release));
  assert.deepStrictEqual(eventReleases,fixture.expected_native_releases,'transaction commits must match persisted app commits exactly');
  const letdowns=run.cycles.filter(c=>c.letDown===true);assert.equal(letdowns.length,1,'known deliberate let-down must remain one let-down cycle');
  assert.equal(letdowns[0].captureCommitted,false,'Hold/Expansion -> lower must be 0 Capture');
  const captured=run.cycles.filter(c=>c.captureCommitted===true);assert.equal(captured.length,3,'exactly three completed field cycles must Capture');
  assert(terminalUi.length>0,'field replay must inspect terminal UI state');
  assert.equal(terminalUi.filter(x=>x.phase==='Draw').length,0,'after a confirmed release the Live UI must never bounce backwards to Draw');
  const fg=h.ctx.FoundationGuardLayer.traceState();assert.equal(fg.currentPhase,'Setup','after completed shot UI state must be Set/Setup, never Draw');assert.equal(fg.terminalLock,false);
}

// B. Force forward ShotIntent cycle admission OFF. The real field trace must still be rescued by the
// strict trace-backed transaction proof (Draw -> Anchor -> Hold -> native Release), not by Anchor-only reconstruction.
{
  const h=makeContext({disableForwardIntent:true}),firstRelease=fixture.expected_native_releases[0];
  const r=h.ctx.CaptureIntegrityLayer.run();r.id='run-recovery-test';r.startedAt=fixture.samples[0].t;r.sessionId=1;
  for(const s of fixture.samples){if(s.t>firstRelease+450)break;feed(h,s);}
  assert.equal(h.commits.length,1,'strict trace-backed recovery must commit a genuine orphan release exactly once');
  assert.equal(Number(h.commits[0].releaseEpochMs),firstRelease);
  assert(h.ctx.CaptureIntegrityLayer.run().events.some(e=>e.type==='cycle_recovered_from_trace'),'orphan transaction must be explicitly diagnosed as trace recovery');
}

// C. Anchor/Hold/Release with NO Draw must remain 0 Capture. After rejection, terminal lock must hold
// Release/Follow-through until recovery and must never bounce backwards to Draw.
{
  const h=makeContext({disableForwardIntent:true}),base=900000;
  const r=h.ctx.CaptureIntegrityLayer.run();r.id='run-terminal-lock-test';r.startedAt=base;r.sessionId=1;
  const common={detected:true,nativeSetReady:true,setAdmissionReady:true,phaseShootingPosture:true,phaseBowExtended:true,phaseQuality:.98,phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.98,bowArmDeg:160,bowPlaneReady:true,bowPlaneStable:true,bowWristRelX:2.1,bowWristRelY:0,drawSideVisible:true,measurementTrust:1};
  feed(h,{...common,t:base,phase:'Anchor',primaryPhase:'Anchor',armed:false,releaseConfirmed:false,shotComplete:false,postReleaseEvidence:false,sequenceQualified:false,followThroughConfirmed:false,followThroughEnded:false,letDown:false});
  feed(h,{...common,t:base+100,phase:'Aim / Hold',primaryPhase:'Aim / Hold',armed:true,releaseConfirmed:false,shotComplete:false,postReleaseEvidence:false,sequenceQualified:true,followThroughConfirmed:false,followThroughEnded:false,letDown:false});
  const terminal=feed(h,{...common,t:base+200,phase:'Follow Through',primaryPhase:'Release',armed:true,releaseConfirmed:true,shotComplete:true,postReleaseEvidence:true,sequenceQualified:true,followThroughConfirmed:true,followThroughEnded:false,letDown:false,releaseEpochMs:base+180});
  assert.equal(h.commits.length,0,'Anchor-only/face-touch style sequence must never Capture');
  let fg=h.ctx.FoundationGuardLayer.traceState();assert.equal(fg.terminalLock,true,'rejected confirmed release must enter terminal lock');assert.notEqual(fg.currentPhase,'Draw','rejected terminal shot must never bounce back to Draw');
  feed(h,{...common,t:base+260,phase:'Follow Through',primaryPhase:'Follow Through',armed:true,releaseConfirmed:true,shotComplete:false,postReleaseEvidence:true,sequenceQualified:true,followThroughConfirmed:true,followThroughEnded:false,letDown:false,releaseEpochMs:base+180});
  fg=h.ctx.FoundationGuardLayer.traceState();assert(['Release','Follow Through'].includes(fg.currentPhase),'rejected terminal motion must remain terminal and never regress to Hold/Draw');assert.equal(fg.terminalLock,true);
  feed(h,{...common,t:base+420,phase:'Setup',primaryPhase:'Setup',armed:true,releaseConfirmed:true,shotComplete:false,postReleaseEvidence:true,sequenceQualified:true,followThroughConfirmed:true,followThroughEnded:true,letDown:false,releaseEpochMs:base+180});
  fg=h.ctx.FoundationGuardLayer.traceState();assert.equal(fg.terminalLock,false);assert.equal(fg.currentPhase,'Setup','recovery must return directly to Set/Setup, not Draw');
}
console.log('BLE4.3.8.8.5 REAL-LAYER E2E PASS · latest field trace 3 genuine Capture / 1 let-down 0 · orphan release recovery PASS · terminal Draw-bounce blocked');

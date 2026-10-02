'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const A=require('../static/adaptive_release_core.js');
const I=require('../static/shot_intent_core.js');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/ble43882_false_positive_regression.json'),'utf8'));

function replay(c){
  let s=A.fresh(),n=0;
  for(const x of c.samples){
    const tl=c.timeline.filter(e=>e.epochMs<=x.t);
    const m={...x,phaseTimeline:tl};
    const input={...x,epochMs:x.t,measurementTrustScore:x.measurementTrust,setReady:x.setAdmissionReady,shotIntentVerified:c.shot_intent_verified};
    const r=A.update(s,m,input,x.t);s=r.state;
    if(r.override&&r.patch?.shotComplete)n++;
  }
  return n;
}
for(const c of fixture.cases)assert.equal(replay(c),c.expect_adaptive_capture,`${c.name} must not be manufactured by the adaptive sentinel; native-confirmed genuine shots remain owned by the frozen core`);

// A valid fresh-shot adaptive rescue still exists when the core misses a sharp release.
{let st=A.fresh(),n=0;const tl=[{phase:'Draw',epochMs:3000},{phase:'Anchor',epochMs:3300},{phase:'Aim / Hold',epochMs:3500}];const rows=[
 {t:3600,phase:'Aim / Hold',primaryPhase:'Aim / Hold',armed:true,releaseCandidate:true,releaseRearStep:.085,releaseRearThreshold:.04,releaseFrameSpeed:1.8,releaseSpeedThreshold:1,releaseElbowRearStep:.055,phaseFaceDist:.62,bowSpeed:.22,visualMotionCorroborated:true,letDownDirectional:false},
 {t:3660,phase:'Aim / Hold',primaryPhase:'Aim / Hold',armed:true,releaseCandidate:false,releaseRearStep:.022,releaseRearThreshold:.04,releaseFrameSpeed:.75,releaseSpeedThreshold:1,releaseElbowRearStep:.018,phaseFaceDist:.68,bowSpeed:.32,visualMotionCorroborated:true,letDownDirectional:false},
 {t:3740,phase:'Setup',primaryPhase:'Setup',armed:true,releaseCandidate:false,releaseRearStep:0,releaseRearThreshold:.04,releaseFrameSpeed:.2,releaseSpeedThreshold:1,releaseElbowRearStep:0,phaseFaceDist:.95,bowSpeed:.8,visualMotionCorroborated:true,letDown:false,letDownDirectional:false}
 ];for(const x of rows){const m={detected:true,phaseQuality:.98,phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.99,...x,phaseTimeline:tl};const input={...m,epochMs:x.t,measurementTrustScore:.95,setReady:true,phaseShootingPosture:true,phaseBowExtended:true,shotIntentVerified:true};const r=A.update(st,m,input,x.t);st=r.state;if(r.override&&r.patch?.shotComplete)n++;}assert.equal(n,1,'fresh verified shot with real release continuation must still be rescued exactly once');}

// Standing/face-touch geometry: a straight elbow or visible arms without lateral bow-wrist plane is never Set-up proof.
let s=I.fresh();
I.admission(s,{epochMs:1000,phaseQuality:.99,phaseDrawWristVisibility:.99,phaseDrawElbowVisibility:.99,phaseShootingPosture:false,phaseBowExtended:true,bowWristRel:{x:.12,y:1.1},setReady:false},1000);
let d=I.admission(s,{epochMs:1200,phaseQuality:.99,phaseDrawWristVisibility:.99,phaseDrawElbowVisibility:.99,phaseShootingPosture:true,phaseBowExtended:true,bowWristRel:{x:.18,y:.1},setReady:true},1200);
assert.equal(d.ready,false,'face touch / straight elbow must not admit Set-up');
I.observePhase(s,'Anchor',1250,d);assert.equal(I.startProof(s,'Anchor',1250),null,'late Anchor must not fabricate Draw intent');

// Real fresh bow-side raise: neutral -> stable lateral bow plane -> Draw is admissible.
s=I.fresh();
I.admission(s,{epochMs:2000,phaseQuality:.99,phaseDrawWristVisibility:.99,phaseDrawElbowVisibility:.99,phaseShootingPosture:false,phaseBowExtended:false,bowWristRel:{x:.15,y:1.2},setReady:false},2000);
I.admission(s,{epochMs:2050,phaseQuality:.99,phaseDrawWristVisibility:.99,phaseDrawElbowVisibility:.99,phaseShootingPosture:true,phaseBowExtended:true,bowWristRel:{x:1.25,y:.05},setReady:true},2050);
d=I.admission(s,{epochMs:2150,phaseQuality:.99,phaseDrawWristVisibility:.99,phaseDrawElbowVisibility:.99,phaseShootingPosture:true,phaseBowExtended:true,bowWristRel:{x:1.25,y:.05},setReady:true},2150);
assert.equal(d.ready,true,'stable bow shooting plane must admit Set-up');
I.observePhase(s,'Draw',2160,d);const proof=I.startProof(s,'Draw',2160);assert(proof?.verified&&proof?.bowPlaneReady,'real Draw must create fresh shot-intent proof');
I.consumeDraw(s);assert.equal(I.startProof(s,'Anchor',2500),null,'consumed/stale Draw must not allow late Anchor-only cycle start');

// Static wiring contract for current build.
const html=fs.readFileSync(path.join(__dirname,'../static/index.html'),'utf8');
const ci=fs.readFileSync(path.join(__dirname,'../static/capture_integrity_layer.js'),'utf8');
const fg=fs.readFileSync(path.join(__dirname,'../static/foundation_guard_layer.js'),'utf8');
const fgc=fs.readFileSync(path.join(__dirname,'../static/foundation_guard_core.js'),'utf8');
assert(html.includes('shot_intent_core.js?v=ble43890'),'shot intent core not wired');
assert(html.includes('adaptive_release_core.js?v=mac20260930r7')&&html.includes('capture_integrity_layer.js?v=mac20260930r7'),'new runtime cache keys missing');
assert(ci.includes("const BUILD_VERSION='BLE4.3.8.9.5.4';")&&ci.includes('shot_intent_not_verified'),'capture truth gate missing');
assert(ci.includes('if(c.captureCommitted)completeSuccessfulRearm'),'successful-only immediate rearm missing');
assert(fg.includes('hardSetReset')&&fg.includes('markRecoveryReady')&&fg.includes('lockRejectedRelease')&&fg.includes('beginShotCycle'),'atomic terminal-lock / cycle API missing');
assert(!fg.includes('snap.confirmed.Set===true&&snap.confirmed.Release'),'old post-capture auto-clear path still present');
assert(!fgc.includes('Draw reconstructed from mature shot evidence')&&!fgc.includes('Set reconstructed from mature shot evidence'),'late phase backfill must be removed');
console.log('BLE4.3.8.8.7 Shot Truth Guard QA PASS · genuine fast release 1 · body twist 0 · face touch 0 · hold settle 0 · fresh Draw intent enforced');

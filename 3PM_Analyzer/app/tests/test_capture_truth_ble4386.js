const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const G=require('../static/foundation_guard_core.js');
const fg=fs.readFileSync(path.join(root,'static','foundation_guard_layer.js'),'utf8');
const ci=fs.readFileSync(path.join(root,'static','capture_integrity_layer.js'),'utf8');
const html=fs.readFileSync(path.join(root,'static','index.html'),'utf8');
function metric(t,o={}){return Object.assign({epochMs:t,detected:true,identityAmbiguous:false,phaseQuality:.99,metricConfidence:{drawElbow:.95,bowArm:.95},debugSetReady:true,debugPhaseShootingPosture:true,debugPhaseBowExtended:true,debugPhaseFaceDist:1.20,drawSpeed:.12,faceHandSpeed:.12,armed:false,releaseConfirmed:false,releaseInvalidated:false,postReleaseEvidence:false,sequenceQualified:false,shotComplete:false,releaseEpochMs:null},o);}
function buildQualified(){
  const s=G.fresh('verified_shot');let t=1000;
  // Setup + Set dwell.
  for(let i=0;i<4;i++,t+=50)G.update(s,metric(t,{phase:'Setup',debugSetReady:false,debugPhaseShootingPosture:false,debugPhaseBowExtended:false,debugPhaseFaceDist:1.25}),'verified_shot',t);
  for(let i=0;i<4;i++,t+=50)G.update(s,metric(t,{phase:'Set',debugPhaseShootingPosture:false,debugPhaseBowExtended:false,debugPhaseFaceDist:1.25}),'verified_shot',t);
  // Extension edge + genuine travel.
  G.update(s,metric(t,{phase:'Set',debugPhaseFaceDist:1.20}),'verified_shot',t);t+=50;
  for(let i=0;i<7;i++,t+=50)G.update(s,metric(t,{phase:'Draw',debugPhaseFaceDist:1.20-.03*(i+1),drawSpeed:.18,faceHandSpeed:.18}),'verified_shot',t);
  for(let i=0;i<5;i++,t+=50)G.update(s,metric(t,{phase:'Anchor',debugPhaseFaceDist:.72,drawSpeed:.03,faceHandSpeed:.03}),'verified_shot',t);
  for(let i=0;i<7;i++,t+=50)G.update(s,metric(t,{phase:'Aim / Hold',debugPhaseFaceDist:.70,holdTimeS:.25+i*.05,armed:i>=2}),'verified_shot',t);
  return {s,t};
}
let {s,t}=buildQualified();
assert(s.confirmed.Setup&&s.confirmed.Set&&s.confirmed.Draw&&s.confirmed.Anchor&&s.confirmed['Aim / Hold']&&s.armedEver,'pre-release proof must be fully qualified');
// Reproduce the field failure class: diagnostic activity remains Unknown, but complete camera proof must still pass.
const done=metric(t,{phase:'Follow Through',debugPhaseFaceDist:.73,armed:true,releaseConfirmed:true,postReleaseEvidence:true,sequenceQualified:true,shotComplete:true,releaseEpochMs:t-180,followThroughConfirmed:true});
G.update(s,done,'verified_shot',t);
let gate=G.captureGate(s,done,'verified_shot');
assert(gate.accepted,'complete camera shot must capture even when equipment classifier is Unknown');
// Missing central release proof still blocks.
for(const [key,label] of [['releaseConfirmed','confirmed Release'],['postReleaseEvidence','post-release evidence'],['sequenceQualified','qualified shot sequence'],['shotComplete','shot completion']]){
  const bad={...done,[key]:false};
  gate=G.captureGate(s,bad,'verified_shot');
  assert(!gate.accepted&&gate.missing.includes(label),`${key}=false must block Capture`);
}
// No stale activity-confirmation wait/veto is allowed in live Capture path.
assert(!fg.includes('pendingActivityCapture'),'Foundation layer must not wait for classifier confirmation');
assert(!fg.includes('classifierAllowsCapture'),'Foundation layer must not use classifier as Capture authority');
assert(!ci.includes('activity confirmation timeout'),'Capture layer must not contain the old activity-timeout veto');
assert(ci.includes("activity_detection:'diagnostic-only-hidden-never-gates-capture'"),'trace policy must expose the new truth contract');
// Evidence strip must only turn green from persisted records / evidence contract, not phase flags.
assert(ci.includes('renderLiveEvidenceRecord(record)'),'persisted evidence renderer missing');
assert(ci.includes('evidenceRowsForSession(sid)'),'live evidence must verify IndexedDB persistence');
assert(ci.includes('C.evidenceContract(record,adv)'),'live evidence must use the same evidence contract as Review');
assert(html.includes('Amber = collecting / not yet persisted')&&html.includes('green = real frame verified in saved evidence'),'evidence legend must describe persistence truth');
const activityLayer=fs.readFileSync(path.join(root,'static','activity_classifier_layer.js'),'utf8');
const launcher=fs.readFileSync(path.join(root,'../internal/start_services.sh'),'utf8');
assert(activityLayer.includes("3pm-experimental-activity-detection")&&activityLayer.includes('running=AUTO_DIAGNOSTIC'),'experimental activity classifier must be opt-in and idle by default');
assert(activityLayer.includes('if(AUTO_DIAGNOSTIC)setTimeout(loop,650)'),'activity classifier must not start a second pose model during normal Live');
assert(launcher.includes('Native helper build failed: $BUILD_ERR'),'native capture build failure must surface the actual compiler error in diagnostics');

assert(ci.includes('postReleaseEvidence:!!m?.postReleaseEvidence')&&ci.includes('sequenceQualified:m?.sequenceQualified===undefined?null:!!m?.sequenceQualified'),'Capture Trace must expose central proof fields');
assert(ci.includes('updateLiveEvidenceFromMetrics(m);}const out=original.onPoseMetrics'),'Evidence strip must start/update from live Side metrics, not wait until DB save');
console.log('BLE4.3.8.6 Capture Truth + classifier-decoupling QA PASS');

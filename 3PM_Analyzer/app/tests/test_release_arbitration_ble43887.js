'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const A=require('../static/adaptive_release_core.js');
const fx=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/ble43886_field_edgecases.json'),'utf8'));

function inputFrom(x){return {...x,epochMs:x.t,measurementTrustScore:x.measurementTrust,setReady:x.setAdmissionReady===true,shotIntentVerified:true};}
function replay(rows){
  let s=A.fresh(),caps=[];
  for(const x of rows){
    const r=A.update(s,x,inputFrom(x),x.t);s=r.state;
    const out=r.override&&r.patch?{...x,...r.patch}:x;
    if(out.shotComplete===true)caps.push({t:x.t,releaseEpochMs:out.releaseEpochMs,event:r.event||'native',out});
  }
  return {caps,state:s};
}

// Field false negative: the genuine release impulse happened before native arming and the next
// frozen-core frame was let_down_reset. BLE43887 must rescue exactly once from the terminal edge.
{
  const r=replay(fx.fast_genuine);
  assert.equal(r.caps.length,1,'fast genuine release must be rescued exactly once');
  assert.equal(r.caps[0].releaseEpochMs,1790398499178,'release timestamp must stay at the genuine impulse T0, not the let-down/reset frame');
  assert.equal(r.caps[0].t,1790398499235,'commit may occur on the next terminal edge but must preserve T0');
  assert.equal(r.caps[0].out.adaptiveReleaseProof,true,'fast rescue must be explicitly adaptive proof');
}

// Field false positive: the archer was still expanding. The old build captured at 1544.
// BLE43887 must remain at 0 captures through that exact frame, then capture once when a later
// synthetic true release edge is appended.
{
  let s=A.fresh(),caps=[];
  for(const x of fx.expansion_then_real_release){
    const r=A.update(s,x,inputFrom(x),x.t);s=r.state;
    const out=r.override&&r.patch?{...x,...r.patch}:x;
    if(out.shotComplete===true)caps.push({t:x.t,releaseEpochMs:out.releaseEpochMs});
    if(x.t<=1790398541544)assert.equal(caps.length,0,`must not Capture during Expansion at ${x.t}`);
  }
  assert.equal(caps.length,1,'later true release must Capture exactly once');
  assert.equal(caps[0].releaseEpochMs,1790398541660,'later true release must own the release timestamp');
}

// Tentative native Release must be display-inert until post-release validation commits.
{
  const base={t:5000,epochMs:5000,phase:'Release',primaryPhase:'Release',releaseConfirmed:true,shotComplete:false,postReleaseEvidence:false,armed:true,
    phaseQuality:.98,measurementTrust:.95,measurementTrustScore:.95,phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.99,phaseShootingPosture:true,phaseBowExtended:true,setReady:true,
    shotIntentVerified:true,phaseTimeline:[{phase:'Draw',epochMs:4200},{phase:'Anchor',epochMs:4500},{phase:'Aim / Hold',epochMs:4700},{phase:'Expansion',epochMs:4850},{phase:'Release',epochMs:5000}]};
  let s=A.fresh();s.reachedAnchor=true;s.reachedHold=true;
  const pending=A.update(s,base,base,5000);
  assert.equal(pending.override,true,'tentative native Release must be intercepted');
  assert.equal(pending.patch.releaseConfirmed,false,'tentative native Release must not be public Release');
  assert.equal(pending.patch.phase,'Expansion','display must remain at the highest proven pre-release phase');
  assert.equal(pending.patch.phaseTimeline.some(e=>e.phase==='Release'),false,'tentative Release must not enter public timeline');
  const final={...base,t:5110,epochMs:5110,phase:'Follow Through',primaryPhase:'Follow Through',shotComplete:true,postReleaseEvidence:true,followThroughConfirmed:true};
  const done=A.update(s,final,final,5110);
  assert.equal(done.override,false,'validated native Release must pass through unchanged');
}

// Deliberate lowering remains a hard negative even when a strong motion pulse occurs first.
{
  const rows=[
    {t:7000,phase:'Aim / Hold',primaryPhase:'Aim / Hold',armed:false,releaseCandidate:false,releaseConfirmed:false,letDown:false,holdTimeS:.16,phaseQuality:.98,measurementTrust:.98,
      releaseRearStep:.10,releaseFaceRearStep:.10,releaseElbowRearStep:.05,releaseRearThreshold:.0045,releaseSpeedThreshold:.07,releaseFrameSpeed:2.1,visualMotionCorroborated:true,
      phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.99,phaseShootingPosture:true,phaseBowExtended:true,setAdmissionReady:true,phaseFaceDist:.49,bowSpeed:1.7},
    {t:7060,phase:'Aim / Hold',primaryPhase:'Aim / Hold',armed:false,releaseCandidate:false,releaseConfirmed:false,letDown:true,phaseQuality:.98,measurementTrust:.98,
      phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.99,phaseShootingPosture:false,phaseBowExtended:false,setAdmissionReady:false,phaseFaceDist:.70,bowSpeed:1.8}
  ];
  assert.equal(replay(rows).caps.length,0,'deliberate lowering must remain 0 Capture');
}

console.log('BLE4.3.8.8.7 release arbitration QA PASS · field fast-release rescue 1 · field Expansion false-Capture 0 · later true release 1 · tentative native Release hidden · deliberate let-down 0');

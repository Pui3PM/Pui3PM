'use strict';
const assert=require('assert');
const fs=require('fs'),path=require('path');
const A=require('../static/adaptive_release_core.js');

function base(t,o={}){
  return Object.assign({
    t,epochMs:t,phase:'Aim / Hold',primaryPhase:'Aim / Hold',armed:false,
    releaseCandidate:false,releaseConfirmed:false,letDown:false,letDownDirectional:false,
    phaseQuality:.98,measurementTrust:.96,measurementTrustScore:.96,
    phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.98,
    phaseShootingPosture:true,phaseBowExtended:true,setReady:true,setAdmissionReady:true,
    physicalSetReady:true,phaseFaceDist:.62,bowSpeed:.5,visualMotionCorroborated:true,
    releaseRearStep:0,releaseFaceRearStep:0,releaseElbowRearStep:0,
    releaseRearThreshold:.0045,releaseFrameSpeed:.2,releaseSpeedThreshold:.07,
    shotIntentVerified:true,
    phaseTimeline:[
      {phase:'Draw',epochMs:t-700},{phase:'Anchor',epochMs:t-420},{phase:'Aim / Hold',epochMs:t-220}
    ]
  },o);
}
function replay(rows){
  let s=A.fresh(),caps=[];
  for(const x of rows){
    const r=A.update(s,x,x,x.t);s=r.state;
    const out=r.override&&r.patch?{...x,...r.patch}:x;
    if(out.shotComplete===true)caps.push({t:x.t,releaseEpochMs:out.releaseEpochMs,decision:s.lastDecision,out});
  }
  return{caps,state:s};
}

// Exact signal shape from BLE43889 real-bow cycle-1790435185179 around the suspected fast release.
// The draw hand was stable at Hold before a coherent compact impulse. The frozen core had not armed
// yet and later called it let-down. BLE43890 should preserve T0 but MUST NOT commit on an ordinary
// post-impulse frame; it confirms only at the quick terminal edge while shooting posture is still intact.
{
  const T=1790435185179;
  const rows=[
    base(T+508,{phase:'Anchor',primaryPhase:'Anchor',phaseFaceDist:.7294079448,bowSpeed:.5537102269,releaseRearStep:null,releaseFaceRearStep:null,releaseElbowRearStep:null,releaseFrameSpeed:null}),
    base(T+565,{phaseFaceDist:.7151620067,bowSpeed:.5219899148,releaseRearStep:null,releaseFaceRearStep:null,releaseElbowRearStep:null,releaseFrameSpeed:null}),
    base(T+625,{phaseFaceDist:.7161050831,bowSpeed:.7379744139,releaseRearStep:-.0722391183,releaseFaceRearStep:-.0392643554,releaseElbowRearStep:-.0130725425,releaseFrameSpeed:1.9115893444}),
    base(T+679,{phaseFaceDist:.5401695631,bowSpeed:.5479510588,letDownDirectional:true,releaseRearStep:.1903922087,releaseFaceRearStep:.1861224431,releaseElbowRearStep:.1124021493,releaseFrameSpeed:3.9389734767}),
    base(T+732,{phaseFaceDist:.5575347997,bowSpeed:.4566410466,letDownDirectional:true,releaseRearStep:-.0337866846,releaseFaceRearStep:-.0417562232,releaseElbowRearStep:.0112538477,releaseFrameSpeed:.8630480266}),
    base(T+783,{phaseFaceDist:.5801028761,bowSpeed:.4681355388,letDownDirectional:true,releaseRearStep:-.0232390481,releaseFaceRearStep:-.0328809502,releaseElbowRearStep:.0416017131,releaseFrameSpeed:1.4097770856}),
    base(T+837,{phaseFaceDist:.5675933659,bowSpeed:.6551326373,letDown:true,letDownDirectional:false,releaseRearStep:null,releaseFaceRearStep:null,releaseElbowRearStep:null,releaseFrameSpeed:null})
  ];
  const r=replay(rows);
  assert.equal(r.caps.length,1,'compact pre-arm multi-signal release must Capture exactly once');
  assert.equal(r.caps[0].releaseEpochMs,T+679,'compact rescue must preserve the physical impulse T0');
  assert.equal(r.caps[0].t,T+837,'compact rescue must wait for the quick terminal edge before commit');
}

// Exact BLE43885 aborted Hold/return pattern that the first BLE43890 draft falsely promoted.
// It has a strong pre-arm impulse, but then the hand travels materially away from the anchor and the
// native let-down edge arrives ~500 ms later. It must stay 0 Capture and must not consume the next shot.
{
  const T=1790349231297;
  const rows=[
    base(T+383,{phase:'Anchor',primaryPhase:'Anchor',phaseFaceDist:.5388357162,bowSpeed:1.0271,releaseRearStep:null,releaseFaceRearStep:null,releaseElbowRearStep:null,releaseFrameSpeed:null}),
    base(T+584,{phaseFaceDist:.5084986189,bowSpeed:.92584,releaseRearStep:null,releaseFaceRearStep:null,releaseElbowRearStep:null,releaseFrameSpeed:null}),
    base(T+739,{phaseFaceDist:.4043470670,bowSpeed:1.1719353909,releaseRearStep:.2063935003,releaseFaceRearStep:.1989890172,releaseElbowRearStep:.0629108562,releaseFrameSpeed:4.3673211191}),
    base(T+787,{phaseFaceDist:.4221966546,bowSpeed:1.1422,letDownDirectional:true,releaseRearStep:-.0324840131,releaseFaceRearStep:-.0221696605,releaseElbowRearStep:-.0315598808,releaseFrameSpeed:1.5837881381}),
    base(T+838,{phaseFaceDist:.4365625335,bowSpeed:1.0873,letDownDirectional:true,releaseRearStep:.0440750331,releaseFaceRearStep:.0592067928,releaseElbowRearStep:-.0250173951,releaseFrameSpeed:1.2873566154}),
    base(T+886,{phaseFaceDist:.5746088078,bowSpeed:1.2823,letDownDirectional:true,releaseRearStep:.0604726294,releaseFaceRearStep:.0539289475,releaseElbowRearStep:.0165183428,releaseFrameSpeed:1.4258214279}),
    base(T+937,{phaseFaceDist:.6205735258,bowSpeed:1.4006,releaseRearStep:.0859597108,releaseFaceRearStep:.0749355796,releaseElbowRearStep:.0402699303,releaseFrameSpeed:1.6856633434}),
    base(T+1246,{phaseFaceDist:1.0254525141,bowSpeed:1.5123,letDown:true,releaseRearStep:null,releaseFaceRearStep:null,releaseElbowRearStep:null,releaseFrameSpeed:null})
  ];
  assert.equal(replay(rows).caps.length,0,'aborted Hold/return with delayed let-down must remain 0 Capture');
}

// Existing field hard-negative: unarmed Hold/return motion contains a deceptively similar positive
// impulse, but face distance was already drifting outward before it. It must remain 0 Capture.
{
  const fx=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/ble4387_field_capture_regression.json'),'utf8'));
  const c=fx.cycles.find(x=>x.id==='cycle-1790333259512');
  assert(c,'hard-negative fixture missing');
  let s=A.fresh(),caps=0;
  for(const x of c.samples){
    const tl=c.timeline.filter(e=>e.epochMs<=x.t);
    const m={...x,phaseTimeline:tl};
    const input={...x,epochMs:x.t,measurementTrustScore:x.measurementTrust,setReady:x.setAdmissionReady,physicalSetReady:x.setAdmissionReady,shotIntentVerified:true};
    const r=A.update(s,m,input,x.t);s=r.state;
    const out=r.override&&r.patch?{...m,...r.patch}:m;
    if(out.shotComplete===true)caps++;
  }
  assert.equal(caps,0,'pre-existing Hold/return face drift must veto compact release promotion');
}

// Deliberate deep let-down after Expansion: strong motion is in the lowering direction and must not Capture.
{
  const T=9000;
  const rows=[
    base(T,{phase:'Expansion',primaryPhase:'Aim / Hold',armed:true,phaseFaceDist:.6246,bowSpeed:.255,releaseRearStep:-.0107,releaseFaceRearStep:-.0128,releaseElbowRearStep:-.0066,releaseFrameSpeed:.859,letDownDirectional:true}),
    base(T+52,{phase:'Expansion',primaryPhase:'Aim / Hold',armed:true,phaseFaceDist:.8732,bowSpeed:1.049,releaseRearStep:-.7440,releaseFaceRearStep:-.7001,releaseElbowRearStep:-.1430,releaseFrameSpeed:14.538,letDownDirectional:true}),
    base(T+102,{phase:'Expansion',primaryPhase:'Aim / Hold',armed:true,phaseFaceDist:.9298,bowSpeed:1.413,releaseRearStep:-.2148,releaseFaceRearStep:-.2182,releaseElbowRearStep:.0539,releaseFrameSpeed:4.486,letDownDirectional:true}),
    base(T+154,{phase:'Aim / Hold',primaryPhase:'Aim / Hold',armed:true,phaseShootingPosture:false,phaseBowExtended:false,setReady:false,physicalSetReady:false,phaseFaceDist:1.50,bowSpeed:3.32,letDown:true,releaseRearStep:null,releaseFaceRearStep:null,releaseElbowRearStep:null,releaseFrameSpeed:null})
  ];
  assert.equal(replay(rows).caps.length,0,'deep deliberate let-down must remain 0 Capture');
}

console.log('BLE4.3.8.9.0 release multi-signal QA PASS · compact terminal rescue 1 · aborted Hold/return 0 · prior hard-negative 0 · deep let-down 0');

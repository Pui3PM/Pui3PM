'use strict';
const assert=require('assert'),A=require('../static/adaptive_release_core.js');
function frame(t,phase,extra={}){return {epochMs:t,phase,primaryPhase:'Aim / Hold',armed:false,
  phaseTimeline:[{phase:'Draw',epochMs:500},{phase:'Anchor',epochMs:700},{phase:'Aim / Hold',epochMs:800},...(phase==='Expansion'?[{phase:'Expansion',epochMs:900}]:[])],
  shotIntentVerified:true,phaseQuality:1,measurementTrustScore:1,phaseDrawWristVisibility:1,phaseDrawElbowVisibility:1,
  phaseShootingPosture:true,phaseBowExtended:true,physicalSetReady:true,setReady:true,wristsLow:false,
  phaseFaceDist:.6,bowArmDeg:165,bowSpeed:0,visualMotionCorroborated:true,releaseRearThreshold:.0045,releaseSpeedThreshold:.07,
  releaseRearStep:0,releaseFaceRearStep:0,releaseElbowRearStep:0,releaseFrameSpeed:0,...extra};}
function captures(rows){const s=A.fresh();let n=0;for(const x of rows){const r=A.update(s,x,x,x.epochMs);if((r.override?r.patch:x).shotComplete)n++;}return n;}
const impulse={releaseRearStep:.13,releaseFaceRearStep:.12,releaseElbowRearStep:.065,releaseFrameSpeed:2.8};
let supported=0,negative=0,ambiguous=0;
// Face distance is a normalized landmark proxy, NOT cm or proof of anatomical hand placement.
// This matrix tests small/no face-distance departure, not actual band or live-bow video.
for(const phase of ['Aim / Hold','Expansion'])for(const delta of [-.02,0,.02]){
  const first=frame(1000,phase,{...impulse,bowSpeed:.5});
  const terminal=frame(1120,phase,{letDown:true,phaseFaceDist:.6+delta,bowSpeed:.5});
  assert.equal(captures([first,terminal]),1,'compact release does not require a large hand escape');supported++;
  assert.equal(captures([first,{...terminal,bowArmDeg:150}]),0,'lowering must veto the compact rescue');negative++;
  assert.equal(captures([frame(1000,phase),{...terminal,bowSpeed:0}]),0,'hand near face without impulse is not release proof');negative++;
  assert.equal(captures([{...first,bowSpeed:0},{...terminal,bowSpeed:0}]),0,'unsupported low-reaction case must remain unconfirmed');ambiguous++;
}
console.log(`Compact observability matrix: ${supported} supported releases captured once; ${negative} negatives capture zero; ${ambiguous} low-reaction ambiguous cases remain unconfirmed (known coverage limit, NOT verified real-release detection)`);

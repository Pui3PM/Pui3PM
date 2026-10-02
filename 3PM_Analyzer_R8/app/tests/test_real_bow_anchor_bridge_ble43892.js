'use strict';
const assert=require('assert');
const B=require('../static/real_bow_anchor_bridge_core.js');
assert.equal(B.VERSION,'BLE4.3.8.9.2-anchor-bridge-v1');

function sample(t,fd,extra={}){return{epochMs:t,phaseFaceDist:fd,phaseQuality:.97,phaseDrawWristVisibility:.98,phaseDrawElbowVisibility:.99,phaseShootingPosture:true,phaseBowExtended:true,bowArmDeg:160,wristsLow:false,...extra};}
function latchWith(distances=[1.18,1.14,1.12,1.11,1.10,1.09]){
  let st=B.fresh(),out=null;
  distances.forEach((fd,i)=>{out=B.update(st,sample(1000+i*70,fd),{phase:'Draw',armed:false},{bowPlaneReady:true},1000+i*70);st=out.state;});
  return out;
}

// Real-bow compact anchor: stable plateau outside frozen .76 band must get an engine-only proxy.
let out=latchWith();
assert(out.snapshot.latched,'stable real-bow anchor must latch');
assert(out.snapshot.active,'bridge must be active before frozen core arms');
assert(out.snapshot.rawFaceDist>.76,'fixture must exercise geometry outside frozen anchor band');
assert(out.engineInput.phaseFaceDist<=.70,'engine-only anchor proxy must enter frozen anchor band');
assert.equal(out.engineInput.debugAnchorBridgeRawFaceDist,out.snapshot.rawFaceDist);
assert(!('releaseConfirmed' in out.snapshot)&&!('shotComplete' in out.snapshot)&&!('captureCommitted' in out.snapshot),'bridge must never declare Release/Capture');

// Once Release is armed, true camera geometry must be restored immediately.
let st=out.state;
out=B.update(st,sample(1400,1.09),{phase:'Aim / Hold',armed:true},{bowPlaneReady:true},1400);
assert.equal(out.snapshot.active,false,'armed shot must disable anchor proxy');
assert.equal(out.engineInput.phaseFaceDist,1.09,'armed Release path must receive raw face distance');
assert.equal(out.snapshot.reason,'armed-raw-restored');

// Deliberate lowering/posture loss must never manufacture Anchor admission.
st=B.fresh();
for(let i=0;i<8;i++){
  out=B.update(st,sample(2000+i*80,1.05,{phaseShootingPosture:false,phaseBowExtended:false,wristsLow:true}),{phase:'Draw',armed:false},{bowPlaneReady:true},2000+i*80);st=out.state;
}
assert.equal(out.snapshot.latched,false,'lowering/neutral motion must not latch anchor bridge');
assert.equal(out.snapshot.active,false);
assert.equal(out.engineInput.phaseFaceDist,1.05,'non-shot geometry must remain untouched');

// Unstable face motion is not a stable real-bow Anchor plateau.
st=B.fresh();
for(const [i,fd] of [1.34,.95,1.30,.92,1.28,.90].entries()){
  out=B.update(st,sample(3000+i*70,fd),{phase:'Draw',armed:false},{bowPlaneReady:true},3000+i*70);st=out.state;
}
assert.equal(out.snapshot.latched,false,'jitter/large changing geometry must not latch bridge');

console.log('BLE4.3.8.9.2 Real-Bow Anchor Bridge QA PASS · compact stable Anchor assisted · armed Release raw restored · lowering/jitter 0 assist');

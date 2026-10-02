'use strict';
const assert=require('assert');
// Optional path lets QA prove these cases fail against the untouched R4 implementation.
const A=require(process.env.RELEASE_CORE || '../static/adaptive_release_core.js');
const tl=[{phase:'Draw',epochMs:500},{phase:'Anchor',epochMs:700},{phase:'Aim / Hold',epochMs:800}];
function frame(t,extra={}) {return {epochMs:t,phase:'Aim / Hold',primaryPhase:'Aim / Hold',phaseTimeline:tl,
  armed:false,releaseCandidate:false,shotIntentVerified:true,phaseQuality:1,measurementTrustScore:1,
  phaseDrawWristVisibility:1,phaseDrawElbowVisibility:1,phaseShootingPosture:true,phaseBowExtended:true,
  physicalSetReady:true,nativeSetReady:true,setReady:true,wristsLow:false,phaseFaceDist:.6,bowArmDeg:165,
  bowSpeed:1,visualMotionCorroborated:true,releaseRearStep:0,releaseFaceRearStep:0,releaseElbowRearStep:0,
  releaseFrameSpeed:0,releaseRearThreshold:.0045,releaseSpeedThreshold:.07,...extra};}
function replay(rows){const s=A.fresh(),caps=[];for(const x of rows){const r=A.update(s,x,x,x.epochMs);const out=r.override?{...x,...r.patch}:x;if(out.shotComplete)caps.push(out);}return {s,caps};}
const cases=[];function test(name,fn){cases.push([name,fn]);}
const impulse={releaseRearStep:.13,releaseFaceRearStep:.12,releaseElbowRearStep:.065,releaseFrameSpeed:2.8};
for(const path of ['prearm','compact','terminal','late-current']) {
  for(const collapse of [false,true])test(`${path} ${collapse?'hand-down':'release control'}`,()=>{
    const armed=path==='terminal'||path==='late-current';
    const age=path==='prearm'?60:path==='compact'?120:300;
    const end=frame(1000+age,{armed,bowArmDeg:collapse?150:164,
      phaseFaceDist:path==='compact'?.62:.72,
      letDown:path==='prearm'||path==='compact',
      ...(path==='terminal'?{phase:'Setup',primaryPhase:'Setup'}:{}),
      ...(path==='late-current'?{releaseCandidate:true,releaseRearStep:.03,releaseFrameSpeed:1}:{}),
    });
    const {caps}=replay([frame(1000,{...impulse,armed,releaseCandidate:armed}),end]);
    assert.equal(caps.length,collapse?0:1,`${path} must honor bow-arm collapse across EVERY rescue path`);
  });
}
test('collapse remains vetoed after arm rebounds',()=>{
  const {caps}=replay([frame(1000,impulse),frame(1040,{bowArmDeg:150}),frame(1120,{letDown:true,phaseFaceDist:.62})]);
  assert.equal(caps.length,0,'a rejected impulse must not resurrect on posture rebound');
});
test('stronger motion during collapse cannot replace the rejected onset',()=>{
  const {caps}=replay([frame(1000,impulse),frame(1040,{...impulse,releaseRearStep:.4,releaseFaceRearStep:.4,bowArmDeg:150}),frame(1120,{letDown:true,phaseFaceDist:.62})]);
  assert.equal(caps.length,0,'lowering motion must not overwrite the original arm angle');
});
for(const absent of [null,undefined,'',false,NaN,Infinity])test(`missing face onset ${String(absent)}`,()=>{
  const {caps}=replay([frame(1000,{...impulse,phaseFaceDist:absent}),frame(1060,{letDown:true,phaseFaceDist:.1})]);
  assert.equal(caps.length,0,'missing onset must not be converted to zero to manufacture face departure');
});
test('null current bow angle does not manufacture collapse',()=>{
  const {caps}=replay([frame(1000,{...impulse,armed:true,releaseCandidate:true}),frame(1060,{armed:true,releaseCandidate:true,releaseRearStep:.03,releaseFrameSpeed:1,phaseFaceDist:.72,bowArmDeg:null})]);
  assert.equal(caps.length,1,'unknown angle is not a measured zero-degree arm');
});
for(const sign of [-1,1])test(`native signed motion ${sign}`,()=>{
  const x=frame(1700,{phase:'Follow Through',primaryPhase:'Release',releaseConfirmed:true,shotComplete:true,postReleaseEvidence:true,
    releaseRearStep:sign*.1,releaseFaceRearStep:sign*.1,releaseRearAccum:0,releaseElbowRearAccum:0,releaseFrameSpeed:2});
  assert.equal(replay([x]).caps.length,sign===1?1:0,'forward motion must not pass as strong rearward release');
});
test('native release retains accumulated proof after sign reversal',()=>{
  const x=frame(1700,{phase:'Follow Through',releaseConfirmed:true,shotComplete:true,postReleaseEvidence:true,
    releaseRearStep:-.1,releaseFaceRearStep:-.1,releaseRearAccum:.12,releaseElbowRearAccum:.03,releaseFrameSpeed:2});
  assert.equal(replay([x]).caps.length,1);
});
for(const absent of [null,undefined,'',false,NaN,Infinity])test(`invalid native numeric channels ${String(absent)}`,()=>{
  const x=frame(1700,{phase:'Follow Through',releaseConfirmed:true,shotComplete:true,postReleaseEvidence:true,
    releaseRearStep:absent,releaseFaceRearStep:absent,releaseRearAccum:absent,releaseElbowRearAccum:absent,releaseFrameSpeed:absent});
  assert.equal(replay([x]).caps.length,0);
});
for(const mode of ['valid','other epoch','other event','expired','backward time','invalidated','let-down','weak direction','no independent','arm collapse'])test(`live post-proof: ${mode}`,()=>{
  const s=A.fresh();
  const pending=frame(1700,{phase:'Release',releaseConfirmed:true,releaseEpochMs:1650,releaseEventId:4,
    releaseRearAccum:.075,releaseElbowRearAccum:.03,releaseDirectionalSteps:3});
  A.update(s,pending,pending,1700,pending);
  const validated={...pending,postReleaseEvidence:true,releasePostIndependent:mode!=='no independent',
    ...(mode==='weak direction'?{releaseRearAccum:.0396,releaseElbowRearAccum:.013}:{}),
    ...(mode==='invalidated'?{releaseInvalidated:true}:{}),...(mode==='let-down'?{letDown:true}:{})};
  A.update(s,pending,frame(1760,{bowArmDeg:mode==='arm collapse'?150:165}),1760,validated);
  const now=mode==='expired'?2800:mode==='backward time'?1750:1820;
  const final={...pending,phase:'Follow Through',shotComplete:true,postReleaseEvidence:true,
    releaseEpochMs:mode==='other epoch'?1649:1650,releaseEventId:mode==='other event'?5:4};
  const r=A.update(s,final,frame(now),now);
  assert.equal((r.override?r.patch:final).shotComplete,mode==='valid','post proof must belong to the same valid native release');
});
let failed=0;for(const [name,fn] of cases){try{fn();}catch(e){failed++;console.error('FAIL',name, e.message);}}
console.log(`R5 release audit: ${cases.length-failed}/${cases.length} cases passed`);
if(failed)process.exitCode=1;

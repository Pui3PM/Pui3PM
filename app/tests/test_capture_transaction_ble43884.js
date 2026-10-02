'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const I=require('../static/shot_intent_core.js');
const A=require('../static/adaptive_release_core.js');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/ble43883_zero_capture_field_regression.json'),'utf8'));

function replay(seg){
  let si=I.fresh(), ar=A.fresh(), active=false, starts=0, captures=0, captureType=null, captureT=null, releaseEpoch=null;
  I.reset(si,{neutralAt:seg.start-900});
  for(const r of seg.samples){
    const input={...r,epochMs:r.t,setReady:r.nativeSetReady,phaseShootingPosture:r.phaseShootingPosture,shootingPosture:r.phaseShootingPosture,phaseBowExtended:r.phaseBowExtended,phaseFaceDist:r.phaseFaceDist,phaseDrawWristVisibility:r.phaseDrawWristVisibility,phaseDrawElbowVisibility:r.phaseDrawElbowVisibility,bowWristRel:{x:r.bowWristRelX,y:r.bowWristRelY},measurementTrustScore:r.measurementTrust};
    const d=I.admission(si,input,r.t);I.observePhase(si,r.phase,r.t,d);
    if(!active){const p=I.startProof(si,r.phase,r.t);if(p){active=true;starts++;I.consumeDraw(si);A.reset(ar);}}
    const rr=A.update(ar,r,{...input,setReady:d.ready,shotIntentVerified:active,debugShotIntentVerified:active},r.t);
    if(active&&r.releaseConfirmed===true){captures++;captureType='native';captureT=r.t;releaseEpoch=r.releaseEpochMs||r.t;active=false;I.reset(si,{neutralAt:r.t});A.reset(ar);continue;}
    if(active&&rr.override&&rr.patch?.shotComplete){captures++;captureType='adaptive';captureT=r.t;releaseEpoch=rr.patch.releaseEpochMs;active=false;I.reset(si,{neutralAt:r.t});A.reset(ar);continue;}
    if(active&&r.letDown===true&&!rr.override){active=false;I.reset(si,{neutralAt:r.t});A.reset(ar);}
  }
  return{starts,captures,captureType,captureT,releaseEpoch};
}

// BLE43886 reclassifies the old "explicit letDown is always negative" assumption.
// The historical BLE43883 fixture itself labels shots 1/2/5/6/7 as missed adaptive releases;
// they contain a release candidate followed by independent post-release departure and must now
// Capture exactly once before the later frozen-core letDown edge. Shot 4 has no qualifying
// post-release departure and remains 0 Capture. Shot 3 is native-confirmed.
const expected={shot1:'adaptive',shot2:'adaptive',shot3:'native',shot4:'zero',shot5:'adaptive',shot6:'adaptive',shot7:'adaptive'};
for(const seg of fixture.segments){
  const got=replay(seg),want=expected[seg.name];
  assert.equal(got.starts,1,`${seg.name}: verified Draw/shot-plane must create exactly one cycle`);
  if(want==='native'){
    assert.equal(got.captures,1,`${seg.name}: native-confirmed release must Capture exactly once`);
    assert.equal(got.captureType,'native',`${seg.name}: native release must remain owned by frozen core`);
  }else if(want==='adaptive'){
    assert.equal(got.captures,1,`${seg.name}: trace-backed missed release must Capture exactly once`);
    assert.equal(got.captureType,'adaptive',`${seg.name}: missed frozen-core release must be committed by release-edge proof`);
  }else{
    assert.equal(got.captures,0,`${seg.name}: candidate without independent post-release departure must remain 0 Capture`);
  }
  assert(got.captures<=1,`${seg.name}: cycle must never double Capture`);
}

const ci=fs.readFileSync(path.join(__dirname,'../static/capture_integrity_layer.js'),'utf8');
assert(ci.includes('(c&&c.sideGeneration!==registry.side.generation)'), 'generation guard must require an actual cycle');
assert(!ci.includes('c?.sideGeneration!==registry.side.generation'), 'undefined cycle must never trigger side_generation_changed');
console.log('BLE4.3.8.8.6 legacy field transaction regression PASS · native 1 · trace-backed release-edge adaptive 5 · unsupported candidate 0 · no double Capture');

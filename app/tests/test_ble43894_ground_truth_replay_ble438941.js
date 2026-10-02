'use strict';
const assert=require('assert');
const L=require('../static/side_lifecycle_core.js');
const rows=require('./fixtures/ble43894_scratch_head_ground_truth.json');
let s=L.fresh(), maxRank=0, starts=0;
const rank={Set:0,Setup:1,Draw:2,Anchor:3,'Aim / Hold':4,Expansion:5,Release:6,'Follow Through':7,Recovery:8};
for(const r of rows){
  const input={epochMs:r.t,phaseQuality:r.phaseQuality,phaseDrawWristVisibility:r.phaseDrawWristVisibility,phaseDrawElbowVisibility:r.phaseDrawElbowVisibility,setAdmissionReady:r.setAdmissionReady,shotIntentReady:r.setAdmissionReady,phaseShootingPosture:r.phaseShootingPosture,phaseBowExtended:r.phaseBowExtended,bowPlaneReady:r.bowPlaneReady,bowPlaneStable:r.bowPlaneStable,neutralEvidence:r.neutralToken===true,wristsLow:r.neutralToken===true,bowArmDeg:r.bowArmDeg,bowSpeed:r.bowSpeed,drawSpeed:r.drawSpeed,faceHandSpeed:r.faceHandSpeed,phaseFaceDist:r.phaseFaceDist,drawSideVisible:true};
  const native={phase:r.phase,primaryPhase:r.primaryPhase,releaseConfirmed:r.releaseConfirmed,shotComplete:r.shotComplete,followThroughConfirmed:r.followThroughConfirmed,followThroughEnded:r.followThroughEnded,letDown:r.letDown};
  const z=L.update(s,input,native,r.t); s=z.state; maxRank=Math.max(maxRank,rank[z.snapshot.authorityPhase]??0); if(z.event?.type==='shot-start')starts++;
}
assert.equal(maxRank,0,'BLE43894 scratch-head ground truth must never promote public Setup/Draw');
assert.equal(starts,0,'BLE43894 scratch-head ground truth must not open a verified shot cycle');
assert.equal(s.shotActive,false); assert.equal(s.verifiedSetup,false); assert.equal(s.verifiedDraw,false); assert.equal(s.authorityPhase,'Set'); assert.equal(s.mode,'set');
console.log('BLE43894 ground-truth replay PASS · scratch/head/face false motion remains Set · 0 verified cycles');

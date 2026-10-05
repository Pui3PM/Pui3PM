'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=process.argv[2]||path.join(__dirname,'../static');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const A=require(path.join(root,'adaptive_release_core.js'));
// A post-validation witness must not override collapse/lowering BEFORE transaction commit.
for(const mode of ['collapse','wrists-low','posture-lost','extension-lost','native-letdown','native-invalidated','native-letdown-edge']){
  const s=A.fresh(),release=2000;
  const input={epochMs:2200,bowArmDeg:170,phaseShootingPosture:true,phaseBowExtended:true,bowSpeed:1,phaseFaceDist:.6};
  const obs={releaseConfirmed:true,releaseEpochMs:release,releaseEventId:1,postReleaseEvidence:true,releasePostIndependent:true,releaseDirectionalSteps:3,releaseRearAccum:.12,releaseRearThreshold:.0045,releaseElbowRearAccum:.05};
  A.update(s,{...obs,shotComplete:false},input,2200,obs);
  assert(s.nativePostWitness);
  const last={...input,epochMs:2250},ob={...obs};
  if(mode==='collapse')last.bowArmDeg=150;
  if(mode==='wrists-low')last.wristsLow=true;
  if(mode==='posture-lost')last.phaseShootingPosture=false;
  if(mode==='extension-lost')last.phaseBowExtended=false;
  if(mode==='native-letdown')ob.releasePostLetDown=true;
  if(mode==='native-invalidated')ob.releaseInvalidated=true;
  if(mode==='native-letdown-edge')ob.letDown=true;
  const terminal={...obs,phase:'Follow Through',shotComplete:true,releaseRearStep:.3,releaseFaceRearStep:.3,releaseFrameSpeed:4};
  const result=A.update(s,terminal,last,2250,ob);
  assert.equal(result.patch?.shotComplete,false,mode+' must veto even strong/cached release proof');
}
// The positive branch remains capturable when the same packet has no contradiction.
{
 const s=A.fresh(),m={phase:'Follow Through',releaseConfirmed:true,releaseEpochMs:2000,shotComplete:true,postReleaseEvidence:true,releaseRearAccum:.12,releaseElbowRearAccum:.05};
 assert.notEqual(A.update(s,m,{epochMs:2300,bowArmDeg:170,phaseShootingPosture:true,phaseBowExtended:true},2300).override,true);
}
// Field-derived TIMESTAMPS only. Original trace did not export per-frame tags; zones below are
// deliberately synthetic permutations, not a claimed pixel-accurate replay of the user's shot.
const C=require(path.join(root,'capture_integrity_core.js'));
const ctx={window:{CaptureIntegrityCore:C},console,document:{querySelector(){return null},getElementById(){return null}},queueMicrotask};vm.createContext(ctx);vm.runInContext(read('evidence_timeline_baseline_layer.js'),ctx);
const offsets=[-1112,-925,-859,-792,-759,-692,-659,-592,-559,-492,-459,-359,-292,-192,-158,-59,8,108,208,308,375,475,608,742,774];
const rel=1790786469890,adv={release_epoch_ms:rel,phase_timeline:[{phase:'Draw',epochMs:rel-1218},{phase:'Anchor',epochMs:rel-965},{phase:'Aim / Hold',epochMs:rel-655},{phase:'Expansion',epochMs:rel-352},{phase:'Release',epochMs:rel},{phase:'Follow Through',epochMs:rel+258}]};
for(const zone of ['release-focus','anchor-focus','aim-hold']){
 const frames=offsets.map((o,i)=>({epochMs:rel+o,offsetMs:o,blob:{i},evidenceZone:i===0?'draw-pin':i===1?'anchor-pin':i<=6?'anchor-focus':i===11?'expansion-pin':i>=23?'follow-summary':zone}));
 const rec={releaseEpochMs:rel,anchorEpochMs:rel-965,anchorFocusEpochMs:rel-655,frames};
 const c=C.evidenceContract(rec,adv);
 assert(c.stages.hold.ok,zone+' encoder tags cannot hide an available Hold frame');
 assert(c.stages.hold.index>c.stages.anchor.index);
 const off=frames[c.stages.hold.index].offsetMs;assert(off>=-655&&off<-352);
 const ended=C.evidenceContract({...rec,followThroughEndEpochMs:rel+1464},adv);
 assert.equal(ended.complete,false,'observed recovery without its frame must be explicitly incomplete');assert(ended.missing.includes('recovery'));
 const noHold=C.evidenceContract({...rec,frames:frames.filter(f=>f.offsetMs< -655||f.offsetMs>=-352)},adv);
 assert.equal(noHold.stages.hold.ok,false,'genuinely absent Hold stays missing');
}
console.log('R7 transaction/contract PASS: stale-proof contradictions, positive control, Hold zones, missing evidence stays missing');

const B=require(path.join(root,'evidence_budget_core.js'));
const many=Array.from({length:80},(_,i)=>({epochMs:rel-1500+i*50,blob:{i},evidenceZone:'release-focus'}));
const protectedEpochs=[many[3].epochMs,many[17].epochMs,many[79].epochMs];
const selected=B.selectFixedBudget(many,rel,25,protectedEpochs);
assert.equal(selected.length,25);for(const t of protectedEpochs)assert(selected.some(f=>f.epochMs===t),'contract witness must survive density quotas');
assert.equal(B.canonicalUnique([{epochMs:1,mediaTime:null,blob:{}},{epochMs:100,mediaTime:null,blob:{}}]).length,2);
assert.equal(B.canonicalUnique([{epochMs:1,mediaTime:1,blob:{}},{epochMs:100,mediaTime:1,blob:{}}]).length,1,'same real media frame must not count twice');

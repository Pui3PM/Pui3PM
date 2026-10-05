const fs=require('fs'),vm=require('vm'),assert=require('assert');
const core=require('../static/capture_integrity_core.js');
function run(extra={}){
  const ctx={console,window:{CaptureIntegrityCore:core},document:{querySelector(){return null},getElementById(){return null},createElement(){return {appendChild(){}}}},queueMicrotask:fn=>fn(),...extra};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../static/evidence_timeline_baseline_layer.js'),'utf8'),ctx);return ctx;
}
let ctx=run();
const L=ctx.window.EvidenceTimelineBaselineLayer;
// BLE43887 physical regression: a frame 103 ms before verified Anchor must remain rejected.
let frames=[-4877,-4668,-4356,-4250,-4029,-3749,-3433,-3123,-2785,-2466,-2156,-1840,-1525,-1214,-901,-544,-476,-443,-376,-309,-276,-210,-176,-110,-76,-9,57,91,157,224,257,324,357,423,457,524,591,624,650,757,791,860,970,1024,1071,1177,1282,1324,1824,2423,2957].map((o,i)=>({offsetMs:o,evidenceZone:i===3?'hold-pin':i===4?'anchor-focus':i===25?'release-focus':i===39?'follow-summary':i===50?'recovery-end':'aim-hold'}));
let p=L.settledAnchorPick({anchorFocusEpochMs:1},frames,-4147,0);assert.equal(p.index,4);assert.equal(p.offset,-4029);assert.equal(p.selection,'verified-forward-anchor-focus');
// BLE43888 field trace Shot #6: a dedicated Hold pin only 53 ms before the verified transition is the best real camera frame.
const offs=[-5118,-4712,-4394,-4076,-3769,-3496,-3190,-2868,-2554,-2246,-1979,-1645,-1354,-1037,-728,-629,-562,-530,-462,-429,-362,-296,-263,-196,-163,-95,-62,4,38,105,137,205,271,305,370,404,472,537,571,638,738,805,1005,1337,1804,2370,2838];
frames=offs.map((o,i)=>({offsetMs:o,evidenceZone:i===0?'draw-pin':i===6?'hold-pin':i===7?'expansion-pin':i===27?'release-focus':i===40?'follow-summary':i===46?'recovery-end':'aim-hold'}));
p=L.settledAnchorPick({anchorFocusEpochMs:1790413038988},frames,-3137,0);assert.equal(p.index,6);assert.equal(p.offset,-3190);assert.equal(p.selection,'legacy-verified-hold-pin');
const release=1790413042125;
const adv={release_epoch_ms:release,phase_timeline:[
 {phase:'Draw',epochMs:1790413037113},{phase:'Anchor',epochMs:1790413037354},{phase:'Aim / Hold',epochMs:1790413038988},{phase:'Expansion',epochMs:1790413039308},{phase:'Release',epochMs:release},{phase:'Follow Through',epochMs:1790413042330}
]};
const rec={releaseEpochMs:release,anchorEpochMs:1790413037354,anchorSettledEpochMs:1790413038988,anchorFocusEpochMs:1790413038988,followThroughEndEpochMs:1790413045028,frames};
const base={complete:true,missing:[],notObserved:[],anchorOffsetMs:-3137,stages:{draw:{ok:true,index:0,required:true},anchor:{ok:true,index:7,required:true},hold:{ok:true,index:6,required:true},expansion:{ok:true,index:7,required:true,observed:true,optional:false},release:{ok:true,index:27,required:true},follow:{ok:true,index:40,required:true},recovery:{ok:true,index:46,required:true}}};
const c=L.normalizeContract(rec,adv,base);assert.equal(c.stages.anchor.index,6);assert.equal(c.stages.hold.index,null,'strict evidence must not reuse Anchor as Hold');assert.equal(c.stages.hold.coincidentWith,null);assert.equal(c.complete,false,'missing distinct Hold evidence must remain incomplete');assert(c.missing.includes('hold'));


// BLE438956 regression from 2026-09-29 R1 field behavior: when both Anchor Focus and Hold Pin
// exist around the Aim/Hold boundary, Anchor must consume the earlier anchor-focus frame and
// preserve the hold-pin as distinct Hold evidence. This is what keeps all real verified shots
// eligible for Baseline instead of only the one shot that happened to contain an extra aim-hold frame.
{
  const release=2000000000000, holdEpoch=release-800, expEpoch=release-420;
  const fs2=[
    {offsetMs:-2600,evidenceZone:'draw-pin'},
    {offsetMs:-1500,evidenceZone:'anchor-pin'},
    {offsetMs:-980,evidenceZone:'anchor-focus'},
    {offsetMs:-850,evidenceZone:'anchor-focus'},
    {offsetMs:-800,evidenceZone:'hold-pin'},
    {offsetMs:-420,evidenceZone:'expansion-pin'},
    {offsetMs:-12,evidenceZone:'release-focus'},
    {offsetMs:330,evidenceZone:'follow-summary'},
    {offsetMs:2100,evidenceZone:'recovery-end'}
  ];
  const adv2={release_epoch_ms:release,phase_timeline:[
    {phase:'Draw',epochMs:release-2600},{phase:'Anchor',epochMs:release-1500},{phase:'Aim / Hold',epochMs:holdEpoch},
    {phase:'Expansion',epochMs:expEpoch},{phase:'Release',epochMs:release},{phase:'Follow Through',epochMs:release+300}
  ]};
  const rec2={releaseEpochMs:release,anchorEpochMs:release-1500,anchorSettledEpochMs:holdEpoch,anchorFocusEpochMs:holdEpoch,followThroughEndEpochMs:release+2100,frames:fs2};
  const base2={complete:true,missing:[],notObserved:[],anchorOffsetMs:-800,stages:{draw:{ok:true,index:0,required:true},anchor:{ok:true,index:2,required:true},hold:{ok:true,index:4,required:true},expansion:{ok:true,index:5,required:true,observed:true,optional:false},release:{ok:true,index:6,required:true},follow:{ok:true,index:7,required:true},recovery:{ok:true,index:8,required:false,optional:true}}};
  const fixed2=L.normalizeContract(rec2,adv2,base2);
  assert.equal(fixed2.stages.anchor.index,3);
  assert.equal(fixed2.stages.anchor.selection,'verified-anchor-focus-before-hold');
  assert.equal(fixed2.stages.hold.index,4);
  assert.equal(fixed2.complete,true);
  assert.equal(fixed2.chronology.ok,true);
}

// Replay all 9 BLE43888 captured evidence manifests. Every contract must become chronological.
const field=JSON.parse(fs.readFileSync(require('path').join(__dirname,'fixtures/ble43888_evidence_timeline_regression.json'),'utf8'));
for(const fc of field.cases){
  const advField={release_epoch_ms:fc.releaseEpochMs,phase_timeline:fc.phase_timeline};
  const recField={releaseEpochMs:fc.releaseEpochMs,anchorEpochMs:fc.anchorEpochMs,anchorSettledEpochMs:fc.anchorSettledEpochMs,anchorFocusEpochMs:fc.anchorFocusEpochMs,followThroughEndEpochMs:fc.followThroughEndEpochMs,frames:fc.frames};
  const baseField={complete:true,missing:[],notObserved:[],anchorOffsetMs:fc.anchorOffsetMs,stages:fc.old_stages};
  const fixed=L.normalizeContract(recField,advField,baseField);
  if(fixed.complete){
    assert.equal(fixed.chronology.ok,true,`Shot ${fc.shot_id} complete contract must be chronological`);
    assert(fixed.stages.anchor.index<fixed.stages.hold.index,`Shot ${fc.shot_id} Hold must be a later frame than Anchor`);
    if(fixed.stages.expansion?.observed!==false)assert(fixed.stages.hold.index<fixed.stages.expansion.index,`Shot ${fc.shot_id} Expansion must follow Hold`);
    assert((fixed.stages.expansion.index??fixed.stages.hold.index)<fixed.stages.release.index,`Shot ${fc.shot_id} Release must follow pre-release evidence`);
    assert(fixed.stages.release.index<fixed.stages.follow.index,`Shot ${fc.shot_id} Follow must follow Release`);
  }else{
    assert(fixed.missing.length>0,`Shot ${fc.shot_id} incomplete legacy evidence must explain what is missing`);
  }
}

// Baseline UX: 3 is activation minimum; new shots do not silently enter the coach reference set.
ctx=run({currentSessionId:1,STATE:{sessions:[{id:1,athlete_id:10},{id:2,athlete_id:10}],shots:[{id:1,session_id:1,is_reference:true},{id:2,session_id:1,is_reference:true},{id:3,session_id:1,is_reference:false},{id:4,session_id:2,is_reference:false}]},sessionShots:(sid)=>ctx.STATE.shots.filter(s=>s.session_id===Number(sid)),shotIsBaselineEligible:()=>true});
let rc=ctx.window.EvidenceTimelineBaselineLayer.referenceContext(1);assert.equal(rc.active,false);assert.equal(rc.currentCount,2);assert.equal(rc.remaining,1);
ctx.STATE.shots.push({id:5,session_id:1,is_reference:true});rc=ctx.window.EvidenceTimelineBaselineLayer.referenceContext(1);assert.equal(rc.active,true);assert.equal(rc.count,3);assert.equal(rc.scope,'Current session');
rc=ctx.window.EvidenceTimelineBaselineLayer.referenceContext(1,5);assert.equal(rc.active,false);assert.equal(rc.currentCount,2); // a Reference shot is not allowed to validate itself
// The baseline source label must follow the same exclusion rule used by interpretShot.
ctx=run({currentSessionId:1,STATE:{sessions:[{id:1,athlete_id:10}],shots:[{id:1,session_id:1,is_reference:true},{id:2,session_id:1,is_reference:true},{id:3,session_id:1,is_reference:true},{id:4,session_id:1,is_reference:false}]},sessionShots:(sid)=>ctx.STATE.shots.filter(s=>s.session_id===Number(sid)),shotIsBaselineEligible:()=>true,baselineFor:()=>({sourceLabel:'old',ready:true})});
assert(ctx.baselineFor(1,null).sourceLabel.includes('Athlete Baseline Active'));
assert(ctx.baselineFor(1,3).sourceLabel.includes('Temporary'));
console.log('BLE4.3.8.8.9 Evidence Timeline + Baseline UX QA PASS');

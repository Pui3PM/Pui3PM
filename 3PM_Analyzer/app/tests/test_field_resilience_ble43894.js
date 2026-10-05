'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const L=require('../static/side_lifecycle_core.js');
const A=require('../static/adaptive_release_core.js');
const K=require('../static/coach_keyframe_plan_core.js');
assert.equal(L.VERSION,'BLE4.3.8.9.5.5-side-lifecycle-v7');
assert.equal(A.VERSION,'BLE4.3.8.9.5.7-adaptive-release-v16');
assert.equal(K.VERSION,'BLE4.3.8.9.4.1-keyframe25-t0-v5');
function inp(t,o={}){const posture=o.posture??false,extended=o.extended??false,plane=o.plane??(posture&&extended),admit=o.admit??(posture&&extended);return {epochMs:t,phaseQuality:.95,phaseDrawWristVisibility:.92,phaseDrawElbowVisibility:.94,setReady:o.setReady??true,phaseShootingPosture:posture,phaseBowExtended:extended,bowPlaneReady:plane,bowPlaneStable:o.planeStable??plane,setAdmissionReady:admit,shotIntentReady:admit,neutralEvidence:o.neutral??(!posture),drawSideVisible:o.drawVisible??true,bowArmDeg:o.arm??110,bowSpeed:o.bow??0,drawSpeed:o.draw??0,faceHandSpeed:o.face??0,phaseFaceDist:o.fd??2,wristsLow:o.low??(!posture),...o};}
function nat(phase='Setup',o={}){return {phase,primaryPhase:phase,phaseTimeline:o.tl||[],...o};}
// Monotonic Live Phase: a raw backward classifier frame cannot move authoritative state backward.
let s=L.fresh(),r;
for(const row of [
 [0,inp(0),nat()],[120,inp(120),nat()],
 [200,inp(200,{posture:true,extended:true,arm:140,bow:2,draw:2,low:false,fd:1.5}),nat('Set')],
 [270,inp(270,{posture:true,extended:true,arm:145,bow:2,draw:2,low:false,fd:1.2}),nat('Draw',{tl:[{phase:'Draw',epochMs:250}]})],
 [350,inp(350,{posture:true,extended:true,arm:145,bow:.2,draw:.2,low:false,fd:.8}),nat('Anchor',{tl:[{phase:'Draw',epochMs:250},{phase:'Anchor',epochMs:350}]})],
 [450,inp(450,{posture:true,extended:true,arm:145,bow:.1,draw:.1,low:false,fd:.75}),nat('Aim / Hold',{tl:[{phase:'Draw',epochMs:250},{phase:'Anchor',epochMs:350},{phase:'Aim / Hold',epochMs:450}]})]
]){r=L.update(s,row[1],row[2],row[0]);s=r.state;}
assert.equal(L.authorityPhase(s.lastSnapshot,nat('Aim / Hold')),'Aim / Hold');
r=L.update(s,inp(520,{posture:true,extended:true,arm:145,bow:.1,draw:.1,low:false,fd:.75}),nat('Draw',{tl:[{phase:'Draw',epochMs:250}]}),520);s=r.state;
assert.equal(r.snapshot.authorityPhase,'Aim / Hold','raw backward phase must freeze, not reverse');
// Native let-down is provisional while hands are up, then atomic Set — Ready after trusted neutral.
r=L.update(s,inp(600,{posture:true,extended:true,arm:145,bow:.7,draw:.3,low:false,fd:.8}),nat('Aim / Hold',{letDown:true}),600);s=r.state;
assert.equal(r.snapshot.shotActive,true);assert.equal(r.snapshot.authorityPhase,'Aim / Hold');assert.equal(r.event,null);
r=L.update(s,inp(660,{setReady:false,posture:false,extended:false,arm:115,bow:1,draw:1,low:true,fd:1.4}),nat('Setup'),660);s=r.state;assert.equal(r.event,null);
r=L.update(s,inp(780,{setReady:false,posture:false,extended:false,arm:115,bow:.1,draw:.1,low:true,fd:1.8}),nat('Setup'),780);s=r.state;
assert.equal(r.event?.type,'let-down');assert.equal(r.snapshot.authorityPhase,'Set');assert.equal(r.snapshot.shotActive,false);
// Tracking gap cannot reset a mature shot.
s=L.fresh();
L.update(s,inp(1000),nat(),1000);L.update(s,inp(1120),nat(),1120);
L.update(s,inp(1200,{posture:true,extended:true,arm:145,bow:2,draw:2,low:false}),nat('Draw',{tl:[{phase:'Draw',epochMs:1200}]}),1200);
L.update(s,inp(1260,{posture:true,extended:true,arm:145,bow:.2,draw:.2,face:.2,low:false}),nat('Anchor',{tl:[{phase:'Draw',epochMs:1200},{phase:'Anchor',epochMs:1260}]}),1260);
L.update(s,inp(1360,{posture:true,extended:true,arm:145,bow:.1,draw:.1,face:.1,low:false}),nat('Aim / Hold',{tl:[{phase:'Draw',epochMs:1200},{phase:'Anchor',epochMs:1260},{phase:'Aim / Hold',epochMs:1360}]}),1360);
for(const t of [1410,1460,1510,1560]){r=L.update(s,inp(t,{phaseQuality:.05,phaseDrawWristVisibility:.05,phaseDrawElbowVisibility:.05,posture:false,extended:false,low:false}),nat('Setup'),t);s=r.state;assert.equal(r.snapshot.shotActive,true,'short tracking gap must preserve active shot');assert.equal(r.snapshot.authorityPhase,'Aim / Hold');}
// Active shot-building evidence survives the 8 s stale fuse.
s=L.fresh();L.update(s,inp(2000),nat(),2000);L.update(s,inp(2120),nat(),2120);
r=L.update(s,inp(2200,{posture:true,extended:true,arm:140,bow:2,draw:1,low:false}),nat('Set'),2200);s=r.state;
for(let t=2300;t<=11000;t+=200){r=L.update(s,inp(t,{posture:true,extended:true,arm:140,bow:1.1,draw:.9,low:false}),nat('Set'),t);s=r.state;assert.notEqual(r.event?.type,'shot-abort','active shot-building must not timeout by elapsed time alone');}
// Adaptive pending release: 5-channel witness + sign reversal + native let-down edge must preserve T0 and commit exactly once.
function am(t,o={}){return {epochMs:t,phase:'Aim / Hold',primaryPhase:'Aim / Hold',detected:true,armed:true,releaseCandidate:false,releaseRearStep:0,releaseFaceRearStep:0,releaseElbowRearStep:0,releaseRearThreshold:.1,releaseFrameSpeed:0,releaseSpeedThreshold:2,letDownDirectional:false,phaseTimeline:[{phase:'Draw',epochMs:1000},{phase:'Anchor',epochMs:1300},{phase:'Aim / Hold',epochMs:1500}],...o};}
function ai(t,o={}){return {epochMs:t,phaseQuality:.95,measurementTrustScore:.95,phaseDrawWristVisibility:.95,phaseDrawElbowVisibility:.95,shotIntentVerified:true,phaseShootingPosture:true,phaseBowExtended:true,physicalSetReady:true,setReady:true,wristsLow:false,phaseFaceDist:.8,bowSpeed:.2,visualMotionCorroborated:true,...o};}
let a=A.fresh(),captures=0,t0=null;
for(const [t,m,i] of [
 [3000,am(3000,{releaseCandidate:true,releaseRearStep:.08,releaseFaceRearStep:.08,releaseElbowRearStep:-.18,releaseFrameSpeed:2.4}),ai(3000,{bowSpeed:1.2})],
 [3050,am(3050,{releaseRearStep:-.04,releaseFaceRearStep:-.03,releaseElbowRearStep:-.25,releaseFrameSpeed:1.8,letDownDirectional:true}),ai(3050,{phaseFaceDist:.78,bowSpeed:1.0})],
 [3120,am(3120,{letDown:true,releaseRearStep:-.03,releaseFaceRearStep:-.02,releaseElbowRearStep:-.2,releaseFrameSpeed:1.2,letDownDirectional:true}),ai(3120,{phaseFaceDist:.76,bowSpeed:.8})],
 [3200,am(3200,{phase:'Follow Through',primaryPhase:'Follow Through'}),ai(3200,{phaseFaceDist:1.0,bowSpeed:.7})]
]){const z=A.update(a,m,i,t);a=z.state;if(z.override&&z.patch?.shotComplete){captures++;t0=z.patch.releaseEpochMs;}}
assert.equal(captures,1);assert.equal(t0,3000,'pending arbitration must preserve original physical witness as T0');
// Deliberate smooth let-down remains 0 even if a modest Hold movement created a watcher.
a=A.fresh();captures=0;
for(const [t,m,i] of [
 [4000,am(4000,{releaseRearStep:.045,releaseFaceRearStep:.04,releaseElbowRearStep:.08,releaseFrameSpeed:1.0}),ai(4000,{bowSpeed:.3})],
 [4070,am(4070,{releaseRearStep:-.03,releaseFaceRearStep:-.04,releaseElbowRearStep:-.03,releaseFrameSpeed:.8,letDownDirectional:true}),ai(4070,{phaseFaceDist:.9,bowSpeed:.4})],
 [4140,am(4140,{letDown:true,letDownDirectional:true}),ai(4140,{phaseFaceDist:1.2,bowSpeed:1.0,phaseShootingPosture:false,phaseBowExtended:false,physicalSetReady:false,setReady:false,wristsLow:true})]
]){const z=A.update(a,m,i,t);a=z.state;if(z.override&&z.patch?.shotComplete)captures++;}
assert.equal(captures,0,'deep deliberate let-down must remain 0 Capture');
// Strong Expansion pulse without terminal proof must remain only a witness.
a=A.fresh();captures=0;
for(const [t,m,i] of [[5000,am(5000,{phase:'Expansion',primaryPhase:'Expansion',releaseRearStep:.09,releaseFaceRearStep:.07,releaseElbowRearStep:.08,releaseFrameSpeed:2.2,releaseCandidate:true}),ai(5000,{bowSpeed:1})],[5080,am(5080,{phase:'Aim / Hold',primaryPhase:'Aim / Hold',releaseRearStep:.005,releaseFaceRearStep:.002,releaseFrameSpeed:.2}),ai(5080,{bowSpeed:.1})],[5700,am(5700),ai(5700)]] ){const z=A.update(a,m,i,t);a=z.state;if(z.override&&z.patch?.shotComplete)captures++;}
assert.equal(captures,0,'Expansion pulse alone must never Capture');
// T0-protected Coach plan: Hold length changes context, never Release position or late post-shot tail.
const release=100000;
const short=K.build15([{phase:'Draw',epochMs:97000},{phase:'Anchor',epochMs:98700},{phase:'Aim / Hold',epochMs:99000}],release);
const long=K.build15([{phase:'Draw',epochMs:90000},{phase:'Anchor',epochMs:93000},{phase:'Aim / Hold',epochMs:94000}],release);
for(const p of [short,long]){assert.equal(p.requests.length,15);assert.equal(p.releaseIndex,8);assert.equal(p.requests[8].offset,0);assert.equal(p.requests[8].label,'Release T0');assert(Math.max(...p.requests.map(x=>x.offset))<=850);assert(p.requiredPostMs<=1050);}
assert.notDeepEqual(short.requests.slice(0,6).map(x=>x.offset),long.requests.slice(0,6).map(x=>x.offset),'long Hold should compress to different representative context');
const rich=K.build25([{phase:'Draw',epochMs:90000},{phase:'Anchor',epochMs:93000},{phase:'Aim / Hold',epochMs:94000}],release);assert.equal(rich.requests.length,25);assert.equal(rich.releaseIndex,12);assert.equal(rich.requests[12].offset,0);assert.equal(rich.requests[12].label,'Release T0');assert(Math.max(...rich.requests.map(x=>x.offset))<=850);
// Evidence contract: long Hold must not reuse Anchor when a later real frame exists; Expansion wording remains optional.
const baseCore={evidenceContract(){}};const context={window:{CaptureIntegrityCore:baseCore},console,document:{querySelector(){return null},getElementById(){return null},createElement(){return{};}},queueMicrotask(){},currentSessionId:null};context.globalThis=context.window;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../static/evidence_timeline_baseline_layer.js'),'utf8'),context);
const E=context.window.EvidenceTimelineBaselineLayer;
const rel=100000,frames=[
 {offsetMs:-2600,evidenceZone:'draw-pin',evidenceTags:['draw-pin']},
 {offsetMs:-1900,evidenceZone:'hold-pin',evidenceTags:['hold-pin','anchor-focus']},
 {offsetMs:-1500,evidenceZone:'aim-hold',evidenceTags:['aim-hold']},
 {offsetMs:-1000,evidenceZone:'aim-hold',evidenceTags:['aim-hold']},
 {offsetMs:-700,evidenceZone:'release-focus',evidenceTags:['release-focus']},
 {offsetMs:-260,evidenceZone:'release-focus',evidenceTags:['release-focus']},
 {offsetMs:0,evidenceZone:'release-focus',evidenceTags:['release-focus']},
 {offsetMs:120,evidenceZone:'follow-summary',evidenceTags:['follow-summary']},
 {offsetMs:780,evidenceZone:'follow-summary',evidenceTags:['follow-summary']}
];
const rec={releaseEpochMs:rel,anchorFocusEpochMs:rel-1900,anchorSettledEpochMs:rel-1900,frames};
const adv={release_epoch_ms:rel,phase_timeline:[{phase:'Draw',epochMs:rel-2600},{phase:'Anchor',epochMs:rel-2000},{phase:'Aim / Hold',epochMs:rel-1900},{phase:'Release',epochMs:rel},{phase:'Follow Through',epochMs:rel+80}]};
const out={anchorOffsetMs:-1900,stages:{draw:{required:true,ok:true,index:0},anchor:{required:true,ok:true,index:1},hold:{required:true,ok:true,index:1},expansion:{required:false,optional:true,observed:false,ok:false,index:null},release:{required:true,ok:true,index:6},follow:{required:true,ok:true,index:7},recovery:{required:false,optional:true,observed:false,ok:false,index:null}}};
const c=E.normalizeContract(rec,adv,out);assert.notEqual(c.stages.hold.index,c.stages.anchor.index,'long Hold must have an independent representative real frame');assert.equal(c.chronology.expansionObserved,false);assert(c.chronology.rule.includes('Expansion optional when visually resolved'));
// Frozen Dev4 truth must remain byte-identical.
function sha(f){return crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',f))).digest('hex');}
assert.equal(sha('static/core_runtime.js'),'89d637ce861466460a6c3889a08c45d70401d71ee904e6a4e6d6fd8dd9f9b3bf');
assert.equal(sha('static/pose.js'),'22ee024b6365d8aca20cbe2ada6ac713b4ffd1d4cf84e29d79c4643ed2bd014d');
assert.equal(sha('static/app.js'),'ed23976568e7f25b5fb370c516ba766f272548e13d8398be5f506029d769f378');
console.log('BLE4.3.8.9.4.1 field resilience QA PASS · monotonic Live · let-down Ready · pending Release · T0 fixed · frozen runtime intact');

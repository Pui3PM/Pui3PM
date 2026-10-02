const assert=require('assert');
const G=require('../static/foundation_guard_core.js');
function m(t,o={}){return Object.assign({
  epochMs:1700000000000+t,detected:true,identityAmbiguous:false,phase:'Setup',phaseQuality:.95,
  metricConfidence:{drawElbow:.9,bowArm:.9},debugSetReady:false,debugPhaseShootingPosture:false,debugPhaseBowExtended:false,
  debugPhaseFaceDist:1.30,drawSpeed:.02,faceHandSpeed:.02,holdTimeS:0,armed:false,releaseConfirmed:false,
  releaseInvalidated:false,postReleaseEvidence:false,sequenceQualified:false,shotComplete:false,releaseEpochMs:null
},o)}
// BLE4386 live capture uses one classifier-independent verified-shot profile.
let s=G.fresh('verified_shot');
for(let t=0;t<=150;t+=50)G.update(s,m(t),'verified_shot',t);
assert(s.confirmed.Setup,'both visible arms should confirm Setup after dwell');
for(let t=200;t<=350;t+=50)G.update(s,m(t,{phase:'Set',debugSetReady:true}),'verified_shot',t);
assert(s.confirmed.Set,'Set should confirm with both hands/arms visible');
// Raising both arms while bow side is not extended must not bank fake Draw travel.
for(let i=0;i<20;i++){
 const t=400+i*50,fd=1.30-.55*Math.min(1,(i+1)/15);
 const snap=G.update(s,m(t,{phase:'Set',debugSetReady:true,debugPhaseShootingPosture:true,debugPhaseBowExtended:false,debugPhaseFaceDist:fd,drawSpeed:.3,faceHandSpeed:.3}),'verified_shot',t);
 assert(!snap.confirmed.Draw,'verified shot must stay before Draw while bow side is not extended');
}
assert.equal(s.drawTravel,0,'pre-extension arm raise must not bank draw travel');
// After extension, establish a fresh baseline then genuine draw travel can qualify.
G.update(s,m(1450,{phase:'Set',debugSetReady:true,debugPhaseShootingPosture:true,debugPhaseBowExtended:true,debugPhaseFaceDist:1.10}),'verified_shot',1450);
for(let i=0;i<6;i++)G.update(s,m(1500+i*50,{phase:'Draw',debugSetReady:true,debugPhaseShootingPosture:true,debugPhaseBowExtended:true,debugPhaseFaceDist:1.10-.035*(i+1),drawSpeed:.16,faceHandSpeed:.14}),'verified_shot',1500+i*50);
assert(s.confirmed.Draw,'genuine post-extension draw should qualify');
for(let i=0;i<5;i++)G.update(s,m(1850+i*50,{phase:'Anchor',debugSetReady:true,debugPhaseShootingPosture:true,debugPhaseBowExtended:true,debugPhaseFaceDist:.72,drawSpeed:.03,faceHandSpeed:.03}),'verified_shot',1850+i*50);
assert(s.confirmed.Anchor,'Anchor should qualify after Draw');
for(let i=0;i<6;i++)G.update(s,m(2150+i*50,{phase:'Aim / Hold',debugSetReady:true,debugPhaseShootingPosture:true,debugPhaseBowExtended:true,debugPhaseFaceDist:.70,holdTimeS:.3+i*.05,armed:i>=2}),'verified_shot',2150+i*50);
assert(s.confirmed['Aim / Hold'],'Hold should qualify after settled Anchor');
assert(s.armedEver,'armed state should be remembered');
// This mirrors the central engine's completed-shot proof, independent of equipment classifier label.
const completed=m(2500,{phase:'Follow Through',debugSetReady:true,debugPhaseShootingPosture:true,debugPhaseBowExtended:true,debugPhaseFaceDist:.72,armed:true,releaseConfirmed:true,postReleaseEvidence:true,sequenceQualified:true,shotComplete:true,releaseEpochMs:1700000002450});
G.update(s,completed,'verified_shot',2500);
let gate=G.captureGate(s,completed,'verified_shot');
assert(gate.accepted,'fully qualified verified camera-shot sequence should pass hard capture gate');
// Missing a prerequisite must block capture even if core says shotComplete.
let s2=G.fresh('verified_shot');s2.confirmed.Setup=s2.confirmed.Set=s2.confirmed.Draw=s2.confirmed.Anchor=s2.confirmed['Aim / Hold']=s2.confirmed['Follow Through']=true;s2.bowExtensionSeen=true;
gate=G.captureGate(s2,m(3000,{releaseConfirmed:true,postReleaseEvidence:true,sequenceQualified:true,shotComplete:true,releaseEpochMs:1700000003000}),'verified_shot');
assert(!gate.accepted&&gate.missing.includes('release arming'),'never-armed capture must be blocked');
// Let-down can never pass even when other proof flags are accidentally stale.
s2.armedEver=true;
gate=G.captureGate(s2,m(3100,{releaseConfirmed:true,postReleaseEvidence:true,sequenceQualified:true,shotComplete:true,releaseEpochMs:1700000003100,letDown:true}),'verified_shot');
assert(!gate.accepted&&gate.missing.includes('let-down'),'let-down must always veto capture');
// Diagnostic Hand-only profile remains non-capturing, but is never the live capture profile.
let sh=G.fresh('hand_only');for(const p of ['Setup','Set','Draw','Anchor','Aim / Hold','Follow Through'])sh.confirmed[p]=true;sh.armedEver=true;
gate=G.captureGate(sh,m(3500,{releaseConfirmed:true,postReleaseEvidence:true,sequenceQualified:true,shotComplete:true,releaseEpochMs:1700000003500}),'hand_only');
assert(!gate.accepted&&gate.missing.some(x=>x.includes('Hand-only')),'diagnostic hand-only profile must never auto-capture');
assert(G.MODES.verified_shot.drawTravel===G.MODES.real_bow.drawTravel,'verified shot must preserve strict draw geometry');
console.log('BLE4.3.8.6 foundation verified-shot guard QA PASS');

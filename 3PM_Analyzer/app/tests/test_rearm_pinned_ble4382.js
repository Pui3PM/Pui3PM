const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const C=require('../static/capture_integrity_core.js');
let now=1790509000000,resetCount=0;const seen=[];
const CoreEngine={
  createAthleteShotEngine(){return{update(role,input){seen.push({...input});return{role:'side',phase:'Setup',detected:true,phaseTimeline:[],releaseConfirmed:false,shotComplete:false,letDown:false};},reset(){resetCount++;}}},
  AuthorityTracker:class{update(){return{role:'side'}}getRole(){return'side'}reset(){}},
  selectAuthorityRole(){return{role:'side',score:1}},evidenceScore(){return 1}
};
const sideTrack={readyState:'live',enabled:true,label:'Fake',getSettings(){return{width:1280,height:720,frameRate:30}}};
const sideStream={getVideoTracks(){return[sideTrack]}};
const classList={add(){},remove(){}};
const sideVideo={srcObject:sideStream,parentElement:null,requestVideoFrameCallback:null};
const document={readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},getElementById(id){return id==='sideVideo'?sideVideo:null},body:{classList,appendChild(){}}};
const FormAnalyzer={getCurrentSessionId(){return 1},onPoseMetrics(){},updateLivePhase(){},onShotEvidence(){}};
class FakeDate extends Date{static now(){return now;}}
const window={CaptureIntegrityCore:C,CoreEngine,FormAnalyzer,TemporalEvidenceLayer:{beginCycle(){},endCycle(){},diagnostics(){return{}},openRole(){},closeRole(){}},PoseEngine:{getRoleHealth(){return{}},getLatestMetrics(){return null}}};
const sandbox={window,document,globalThis:window,console,setInterval(fn){return 1},clearInterval(){},setTimeout(fn){fn();return 1},clearTimeout(){},Date:FakeDate,Math,Number,String,Array,Object,Map,Set,WeakMap,JSON,performance:{now:()=>now},innerWidth:1200,innerHeight:800,indexedDB:{open(){throw new Error('unused')}},URL:{},Blob:function(){},Event:function(){}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../static/capture_integrity_layer.js'),'utf8'),sandbox);
const layer=window.CaptureIntegrityLayer;layer.installFormAnalyzer();layer.registry.side.active=true;layer.registry.side.generation=1;layer.registry.side.stream=sideStream;layer.registry.side.track=sideTrack;
const r=layer.run();r.id='run-test';r.startedAt=now;r.sessionId=1;r.currentCycle={id:'cycle-a',active:true,startedAt:now-500,sideGeneration:1,timeline:[{phase:'Set',epochMs:now-480},{phase:'Draw',epochMs:now-400},{phase:'Anchor',epochMs:now-300},{phase:'Aim / Hold',epochMs:now-200}],releaseEpochMs:null,followEnd:null,diagnostics:[]};
window.FormAnalyzer.onPoseMetrics('side',{role:'side',epochMs:now,phase:'Aim / Hold',primaryPhase:'Aim / Hold',detected:true,letDown:true,phaseQuality:.9,phaseTimeline:r.currentCycle.timeline});
assert.equal(r.currentCycle.active,true,'native let-down edge is provisional until physical neutral is confirmed');
const engine=window.CoreEngine.createAthleteShotEngine();
function neutral(){return{epochMs:now,phaseQuality:.9,phaseShootingPosture:false,phaseBowExtended:false,bowArmDeg:110,wristsLow:true,setReady:false,criticalTrackingOK:true,phaseDrawWristVisibility:.9,phaseDrawElbowVisibility:.9};}
engine.update('side',neutral());assert.equal(resetCount,0);
now+=200;engine.update('side',neutral());assert.equal(resetCount,0,'let-down neutral must be debounced');
now+=190;engine.update('side',neutral());assert.equal(resetCount,1,'sustained physical neutral must atomically close let-down and reset the frozen engine');
assert.equal(r.currentCycle.active,false,'neutral-confirmed let-down must close cycle');
assert.equal(r.currentCycle.letDown,true,'closed cycle must be classified as let-down, never Capture');
assert.equal(r.diagnosticClips.length,1,'let-down must pin a diagnostic clip');
assert.ok(r.diagnosticClips[0].samples.length>=1,'pinned clip must preserve late-phase samples');
assert.equal(layer.isRearmRequired(),false,'neutral-confirmed let-down returns directly to Set/Ready without a second rearm wait');
now+=40;engine.update('side',{epochMs:now,phaseQuality:.9,phaseShootingPosture:true,phaseBowExtended:true,bowArmDeg:150,setReady:true,criticalTrackingOK:true,phaseDrawWristVisibility:.9,phaseDrawElbowVisibility:.9});
assert.equal(seen.at(-1).setReady,true,'fresh shot input must be admitted after neutral-confirmed let-down reset');
assert.equal(resetCount,1,'let-down recovery must not repeatedly reset');
console.log('BLE4.3.8.9.4 neutral-confirmed let-down + pinned diagnostics: PASS');

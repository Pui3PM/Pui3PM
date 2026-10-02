const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const C=require('../static/capture_integrity_core.js');
let resetCount=0, updateCount=0, now=1000;
const CoreEngine={
  createAthleteShotEngine(){return{
    update(role,input){updateCount++;return {role:'side',phase:'Setup',detected:true,releaseConfirmed:false,shotComplete:false,letDown:false,phaseTimeline:[]};},
    reset(){resetCount++;},
    getAuthorityRole(){return 'side'}
  }},
  AuthorityTracker:class{update(){return{role:'side'};}getRole(){return'side'}reset(){}},
  selectAuthorityRole(){return{role:'side',score:1}},
  evidenceScore(){return 1}
};
const classList={add(){},remove(){}};
const sideVideo={srcObject:{getVideoTracks(){return[]}},parentElement:null};
const document={
  readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},
  getElementById(id){return id==='sideVideo'?sideVideo:null},body:{classList,appendChild(){}}
};
class FakeDate extends Date { static now(){ return now; } }
const window={CaptureIntegrityCore:C,CoreEngine,FormAnalyzer:null,addEventListener(){},TemporalEvidenceLayer:{beginCycle(){},endCycle(){}}};
const sandbox={window,document,globalThis:window,console,setInterval(){return 1},clearInterval(){},setTimeout(fn){fn();return 1},clearTimeout(){},Date:FakeDate,Math,Number,String,Array,Object,Map,Set,WeakMap,JSON,performance:{now:()=>now},innerWidth:1200,innerHeight:800,indexedDB:{open(){throw new Error('not used')}},URL:{},Blob:function(){},Event:function(){}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../static/capture_integrity_layer.js'),'utf8'),sandbox);

const layer=window.CaptureIntegrityLayer;
layer.registry.side.active=true;layer.registry.side.generation=1;
const r=layer.run();
r.id='run-test';r.startedAt=now;r.sessionId=1;r.currentCycle={
  id:'cycle-test',active:true,startedAt:now-2000,sideGeneration:1,releaseEpochMs:null,followEnd:null,
  timeline:[{phase:'Set',epochMs:now-1900},{phase:'Draw',epochMs:now-1700},{phase:'Anchor',epochMs:now-1300},{phase:'Aim / Hold',epochMs:now-900}]
};
const engine=window.CoreEngine.createAthleteShotEngine();
const neutral={epochMs:now,phaseQuality:.9,phaseShootingPosture:false,phaseBowExtended:false,bowArmDeg:110,wristsLow:true,setReady:false,criticalTrackingOK:true,measurementTrustScore:.9,phaseDrawWristVisibility:.9,phaseDrawElbowVisibility:.9};
engine.update('side',neutral);
assert.equal(resetCount,0,'continuity reset must be debounced');
now+=200;engine.update('side',{...neutral,epochMs:now});
assert.equal(resetCount,0,'must not reset before 360 ms');
now+=190;engine.update('side',{...neutral,epochMs:now});
assert.equal(resetCount,1,'sustained verified neutral must reset frozen shot engine once');
assert.equal(r.currentCycle.active,false);
assert.equal(r.currentCycle.letDown,true);
assert.equal(r.currentCycle.continuityReset,true);
assert.ok(r.events.some(e=>e.type==='cycle_continuity_reset'),'trace must pin continuity reset');
engine.update('side',{...neutral,epochMs:now+50});
assert.equal(resetCount,1,'must not repeatedly reset after cycle closed');
console.log('BLE4.3.8.2 continuity guard QA PASS');

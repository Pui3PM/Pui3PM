const fs=require('fs'),vm=require('vm'),assert=require('assert');
const C=require('../static/capture_integrity_core.js');
let seen=[];
const CoreEngine={
  createAthleteShotEngine(){let phase='Setup';return{
    update(role,input){seen.push({role,input:{...input}});if(phase==='Setup'&&input.setReady)phase='Set';else if(phase==='Set'&&input.shootingPosture)phase='Draw';return{phase,primaryPhase:phase,phaseTimeline:[]};},
    reset(){phase='Setup'},getAuthorityRole(){return'side';}
  }},AuthorityTracker:class{},selectAuthorityRole(){return{role:'side'}},evidenceScore(){return 1}
};
const sideVideo={srcObject:{}};
const localStorage={getItem(k){return k==='3pm-form-activity-mode-v1'?'real_bow':null}};
const document={readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},getElementById(id){return id==='sideVideo'?sideVideo:null},body:{classList:{add(){},remove(){}},appendChild(){}}};
const window={CaptureIntegrityCore:C,CoreEngine,FormAnalyzer:null,FoundationGuardLayer:{getActivityMode:()=> 'real_bow'},addEventListener(){}};
const sandbox={window,document,localStorage,globalThis:window,console,setInterval(){return 1},clearInterval(){},setTimeout(){return 1},clearTimeout(){},Date,Math,Number,String,Array,Object,Map,Set,WeakMap,JSON,performance:{now:()=>0},innerWidth:1200,innerHeight:800,indexedDB:{open(){throw new Error('not used')}},URL:{},Blob:function(){},Event:function(){}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../static/capture_integrity_layer.js'),'utf8'),sandbox);
const e=window.CoreEngine.createAthleteShotEngine();
function inp(extra={}){return {phaseQuality:.7,setReady:false,phaseShootingPosture:true,shootingPosture:true,phaseBowExtended:true,bowExtended:true,phaseDrawWristVisibility:.8,phaseDrawElbowVisibility:.8,bowArmDeg:150,...extra};}
// Native bow-side readiness alone must not pass Set when draw hand is not visible.
let r=e.update('side',inp({setReady:true,phaseDrawWristVisibility:.12,phaseDrawElbowVisibility:.8}));
assert.equal(r.phase,'Setup');assert.equal(seen.at(-1).input.setReady,false,'native Set must be vetoed when draw hand is not visible');
// Both sides visible -> Set allowed.
r=e.update('side',inp({setReady:true}));assert.equal(r.phase,'Set');
// In Real Bow, raised-arm motion with visually unextended bow arm must be fed to frozen core as non-shooting posture, preventing Draw.
r=e.update('side',inp({setReady:true,phaseBowExtended:false,bowExtended:false,bowArmDeg:118,shootingPosture:true,phaseShootingPosture:true}));
assert.equal(r.phase,'Set');assert.equal(seen.at(-1).input.shootingPosture,false,'false-Draw guard must suppress pre-extension shooting posture');
// Once extension is real, Draw can proceed.
r=e.update('side',inp({setReady:true,phaseBowExtended:true,bowExtended:true,bowArmDeg:165,shootingPosture:true,phaseShootingPosture:true}));
assert.equal(r.phase,'Draw');
console.log('BLE4.3.8.3 both-hands Set + false-Draw integration QA PASS');

const fs=require('fs'),vm=require('vm'),assert=require('assert');
const C=require('../static/capture_integrity_core.js');
const I=require('../static/shot_intent_core.js');
let seen=[];
const CoreEngine={createAthleteShotEngine(){return{update(role,input){seen.push({role,input:{...input}});return{phase:input.setReady?'Set':'Setup',primaryPhase:input.setReady?'Set':'Setup',phaseTimeline:[]};},reset(){},getAuthorityRole(){return'side';}}},AuthorityTracker:class{},selectAuthorityRole(){return{role:'side'}},evidenceScore(){return 1}};
const sideVideo={srcObject:{}};
const document={readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},getElementById(id){return id==='sideVideo'?sideVideo:null},body:{classList:{add(){},remove(){}},appendChild(){}}};
const window={CaptureIntegrityCore:C,ShotIntentCore:I,CoreEngine,FormAnalyzer:null,addEventListener(){}};
const sandbox={window,document,globalThis:window,console,setInterval(){return 1},clearInterval(){},setTimeout(){return 1},clearTimeout(){},Date,Math,Number,String,Array,Object,Map,Set,WeakMap,JSON,performance:{now:()=>0},innerWidth:1200,innerHeight:800,indexedDB:{open(){throw new Error('not used')}},URL:{},Blob:function(){},Event:function(){}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../static/capture_integrity_layer.js'),'utf8'),sandbox);
const e=window.CoreEngine.createAthleteShotEngine();
function inp(extra={}){return {epochMs:1000,phaseQuality:.7,setReady:false,phaseShootingPosture:true,phaseBowExtended:true,phaseDrawWristVisibility:.8,phaseDrawElbowVisibility:.8,bowArmDeg:150,bowWristRel:{x:.15,y:.1},...extra};}
let r=e.update('side',inp());assert.equal(r.phase,'Setup');assert.equal(seen.at(-1).input.setReady,false,'generic visible/straight arms must not repair Set admission');
r=e.update('side',inp({epochMs:1100,setReady:true,bowWristRel:{x:.18,y:.1}}));assert.equal(seen.at(-1).input.setReady,false,'native Set without bow shooting plane must be vetoed');
// establish neutral then stable lateral shooting plane
r=e.update('side',inp({epochMs:1200,setReady:false,phaseShootingPosture:false,phaseBowExtended:false,bowWristRel:{x:.1,y:1.2}}));
r=e.update('side',inp({epochMs:1300,setReady:true,bowWristRel:{x:1.2,y:.05}}));
r=e.update('side',inp({epochMs:1400,setReady:true,bowWristRel:{x:1.2,y:.05}}));assert.equal(seen.at(-1).input.setReady,true,'stable fresh bow-plane Set admission must pass');
console.log('BLE4.3.8.8.4 shot-plane Set admission QA PASS · generic fallback removed · fresh lateral bow plane required');

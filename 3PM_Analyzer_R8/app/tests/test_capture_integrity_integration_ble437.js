const fs=require('fs'),vm=require('vm'),assert=require('assert');
const C=require('../static/capture_integrity_core.js');
let calls=[];
class OrigTracker{update(){return{role:'rear',score:9}}getRole(){return'rear'}reset(){}}
const CoreEngine={
  createAthleteShotEngine(){return{update(role,input){calls.push(role);return{phase:role==='side'?'Anchor':'Release',shotComplete:role!=='side',releaseConfirmed:role!=='side',phaseTimeline:[{phase:'Anchor',epochMs:1790000000000,role}]};},reset(){calls=[]},getAuthorityRole(){return'rear'}}},
  AuthorityTracker:OrigTracker,
  selectAuthorityRole(){return{role:'rear',score:9}},
  evidenceScore(){return .9}
};
const sideVideo={srcObject:{}}; const document={readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},getElementById(id){return id==='sideVideo'?sideVideo:null},body:{classList:{add(){},remove(){}},appendChild(){}}};
const window={CaptureIntegrityCore:C,CoreEngine,FormAnalyzer:null,addEventListener(){}};
const sandbox={window,document,globalThis:window,console,setInterval(){return 1},clearInterval(){},setTimeout(){return 1},clearTimeout(){},Date,Math,Number,String,Array,Object,Map,Set,WeakMap,JSON,performance:{now:()=>0},innerWidth:1200,innerHeight:800,indexedDB:{open(){throw new Error('not used')}},URL:{},Blob:function(){},Event:function(){}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../static/capture_integrity_layer.js'),'utf8'),sandbox);
const engine=window.CoreEngine.createAthleteShotEngine();
let r=engine.update('rear',{});assert.deepEqual(calls,[]);assert.equal(r.shotComplete,false);assert.equal(r.releaseConfirmed,false);
r=engine.update('side',{});assert.deepEqual(calls,['side']);assert.equal(r.phase,'Anchor');
r=engine.update('rear',{});assert.deepEqual(calls,['side']);assert.equal(r.phase,'Anchor');assert.equal(r.shotComplete,false);
const t=new window.CoreEngine.AuthorityTracker();assert.equal(t.update({rear:{detected:true}}).role,null);assert.equal(t.update({side:{detected:true},rear:{detected:true}}).role,'side');
assert.equal(window.CoreEngine.selectAuthorityRole({rear:{detected:true}}).role,null);assert.equal(window.CoreEngine.selectAuthorityRole({side:{detected:true}}).role,'side');
console.log('BLE4.3.7 Side authority integration QA PASS');

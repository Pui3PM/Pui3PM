const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const code=fs.readFileSync(path.join(__dirname,'../static/review_precision_layer.js'),'utf8');
let rendered=false,stopped=false;
const ctx={console,window:{CaptureIntegrityCore:{evidenceContract(){return{anchorOffsetMs:-4147,stages:{anchor:{ok:true,index:1,required:true}},missing:[],complete:true};}}},document:{querySelectorAll(){return[]}},queueMicrotask:fn=>fn(),
 interpretShot:s=>({label:s.label,css:s.css||'stable',summary:"Measurements are close to this athlete's current baseline."}),
 shotReplayState:{record:{frames:[{offsetMs:-4668,evidenceZone:'anchor-focus'},{offsetMs:-4356,evidenceZone:'anchor-focus'},{offsetMs:-4250,evidenceZone:'anchor-focus'},{offsetMs:-4029,evidenceZone:'anchor-focus'}]},index:0},
 selectedShot:()=>({id:6}),replayAnchorOffsetForShot:()=>-4147,jumpReplayAnchor:()=>false,stopShotReplay:()=>{stopped=true},renderShotReplayFrame:()=>{rendered=true},toast:()=>{},renderReport:()=>{}};
vm.createContext(ctx);vm.runInContext(code,ctx);
assert.equal(ctx.interpretShot({label:'Stable'}).label,'Within Baseline');
assert.equal(ctx.interpretShot({label:'Review'}).label,'Notable Deviation');
assert.equal(ctx.interpretShot({label:'Significant Deviation'}).label,'Significant Deviation');
assert(ctx.jumpReplayAnchor());assert.equal(ctx.shotReplayState.index,3,'Anchor must choose -4029ms first frame AFTER -4147 target, not earlier -4250ms frame');assert(stopped&&rendered);
const rec={frames:ctx.shotReplayState.record.frames};const c=ctx.window.CaptureIntegrityCore.evidenceContract(rec,{});assert.equal(c.stages.anchor.index,3);assert.equal(c.stages.anchor.verifiedForward,true);
console.log('BLE4.3.8.8.8 Review Precision QA PASS · baseline semantics + forward verified Anchor');

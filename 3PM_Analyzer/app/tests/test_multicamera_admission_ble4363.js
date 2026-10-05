const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/../static/multicamera_admission_guard.js','utf8');
const els={};
const mk=id=>els[id]||(els[id]={id,textContent:'',className:''});
let sideLive=true, side={detected:true,torsoLeanDeg:1.2};let accepted=0;
const ctx={console,performance:{now:()=>1000},Date,document:{getElementById:mk},window:{
  FormAnalyzer:{isRoleLive:r=>r==='side'&&sideLive,onPoseMetrics:()=>{},onShotEvidence:()=>{accepted++}},
  PoseEngine:{getLatestMetrics:r=>r==='side'?side:null}
}};
vm.createContext(ctx);vm.runInContext(src,ctx);
assert(ctx.window.MultiCameraAdmissionGuard,'guard missing');
// Rear completion cannot manufacture a shot.
ctx.window.FormAnalyzer.onPoseMetrics('rear',{detected:true,shotComplete:true,releaseEpochMs:1000});
ctx.window.FormAnalyzer.onShotEvidence({shotComplete:true,releaseEpochMs:1000,role:'rear'});
assert.equal(accepted,0);
// Missing hips blocks Side auto capture.
ctx.window.FormAnalyzer.onPoseMetrics('side',{detected:true,torsoLeanDeg:null,shotComplete:true,releaseEpochMs:2000});
ctx.window.FormAnalyzer.onShotEvidence({shotComplete:true,releaseEpochMs:2000,role:'side'});
assert.equal(accepted,0);
// waiting_anchor release is vetoed even with hips visible.
side={detected:true,torsoLeanDeg:0.4};ctx.window.PoseEngine.getLatestMetrics=()=>side;
ctx.window.FormAnalyzer.onPoseMetrics('side',{detected:true,torsoLeanDeg:0.4,releaseConfirmed:true,shotBlocker:'waiting_anchor',releaseEpochMs:3000});
ctx.window.FormAnalyzer.onPoseMetrics('side',{detected:true,torsoLeanDeg:0.4,shotComplete:true,releaseEpochMs:3000});
ctx.window.FormAnalyzer.onShotEvidence({shotComplete:true,releaseEpochMs:3000,role:'side'});
assert.equal(accepted,0);
// Clean Side completion with hips is accepted.
ctx.window.FormAnalyzer.onPoseMetrics('side',{detected:true,torsoLeanDeg:0.4,shotComplete:true,releaseEpochMs:5000});
ctx.window.FormAnalyzer.onShotEvidence({shotComplete:true,releaseEpochMs:5000,role:'side'});
assert.equal(accepted,1);
console.log('BLE4.3.6.3 multi-camera admission guard: PASS');

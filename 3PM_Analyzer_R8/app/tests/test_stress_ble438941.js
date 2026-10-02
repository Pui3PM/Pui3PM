'use strict';
const assert=require('assert');
const L=require('../static/side_lifecycle_core.js');
const G=require('../static/camera_fps_guard_core.js');
let seed=0x3941a5;

function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function base(t,o={}){return {epochMs:t,phaseQuality:.75+rnd()*.24,phaseDrawWristVisibility:.75+rnd()*.24,phaseDrawElbowVisibility:.75+rnd()*.24,setReady:true,phaseShootingPosture:false,phaseBowExtended:false,bowPlaneReady:false,bowPlaneStable:false,setAdmissionReady:false,shotIntentReady:false,neutralEvidence:true,wristsLow:true,drawSideVisible:true,bowArmDeg:100+rnd()*20,bowSpeed:.05,drawSpeed:.05,faceHandSpeed:.05,phaseFaceDist:2.2,...o};}
function n(phase='Setup',timeline=[]){return{phase,primaryPhase:phase,phaseTimeline:timeline};}
function boot(t0=0){let s=L.fresh();for(const dt of [0,110,220])s=L.update(s,base(t0+dt),n(),t0+dt).state;return s;}
// 500 false-motion bursts of varied speed/face distance must never become a verified shot without plane/admission.
for(let k=0;k<500;k++){
  let s=boot(k*2000),t=k*2000+300;
  const frames=2+Math.floor(rnd()*8);
  for(let i=0;i<frames;i++,t+=35+Math.floor(rnd()*55)){
    const raw=['Setup','Set','Draw','Anchor'][Math.floor(rnd()*4)];
    const r=L.update(s,base(t,{neutralEvidence:false,wristsLow:false,bowSpeed:.7+rnd()*4,drawSpeed:.5+rnd()*4,faceHandSpeed:.5+rnd()*4,bowArmDeg:90+rnd()*70,phaseFaceDist:.5+rnd()*4}),n(raw,raw==='Draw'?[{phase:'Draw',epochMs:t}]:[]),t);s=r.state;
    assert.equal(r.snapshot.shotActive,false,`false burst ${k}/${i} must not verify shot`);assert.equal(r.snapshot.authorityPhase,'Set');
  }
  for(const dt of [0,130,280]){const r=L.update(s,base(t+dt),n(),t+dt);s=r.state;}
  assert.equal(s.authorityPhase,'Set');assert.equal(s.shotActive,false);
}
// 120 verified shots: authority rank must never decrease before terminal/neutral termination.
for(let k=0;k<120;k++){
  const t0=2000000+k*5000;let s=boot(t0),last=0;
  const shot=(t,o={})=>base(t,{phaseShootingPosture:true,phaseBowExtended:true,bowPlaneReady:true,bowPlaneStable:true,setAdmissionReady:true,shotIntentReady:true,neutralEvidence:false,wristsLow:false,bowArmDeg:140+rnd()*8,bowSpeed:.2+rnd(),drawSpeed:.9+rnd(),faceHandSpeed:.8+rnd(),phaseFaceDist:.7+rnd()*.5,...o});
  const rows=[
    [t0+300,'Draw',[{phase:'Draw',epochMs:t0+300}]],
    [t0+380,'Draw',[{phase:'Draw',epochMs:t0+300}]],
    [t0+500,'Anchor',[{phase:'Draw',epochMs:t0+300},{phase:'Anchor',epochMs:t0+500}]],
    [t0+620,'Aim / Hold',[{phase:'Draw',epochMs:t0+300},{phase:'Anchor',epochMs:t0+500},{phase:'Aim / Hold',epochMs:t0+620}]],
    [t0+700,rnd()<.5?'Draw':'Aim / Hold',[{phase:'Draw',epochMs:t0+300}]],
  ];
  for(const [t,ph,tl] of rows){const r=L.update(s,shot(t),n(ph,tl),t);s=r.state;if(s.shotActive){assert(s.authorityRank>=last,`verified authority regressed in shot ${k}`);last=s.authorityRank;}}
  const r=L.update(s,shot(t0+800),{phase:'Follow Through',primaryPhase:'Follow Through',releaseConfirmed:true,shotComplete:true,followThroughConfirmed:true,releaseEpochMs:t0+780},t0+800);s=r.state;assert.equal(r.snapshot.terminal,true);assert(r.snapshot.authorityRank>=7);
}
// Governor: random isolated bad samples must not fall back; sustained overload must.
for(let k=0;k<100;k++){
  let s=G.fresh();for(let i=0;i<20;i++){const bad=(i%7===0);const r=G.update(s,{fps:60,poseHz:bad?9:30,costMs:bad?95:25,rawFps:bad?42:59,discarded:bad?1:0,jitterMs:bad?31:3,activeCount:1,phase:'Set'});s=r.state;assert.notEqual(r.action,'down30','isolated/transient load must not collapse 60-fps mode');}
}
let gs=G.fresh(),gr;for(let i=0;i<3;i++){gr=G.update(gs,{fps:60,poseHz:8,costMs:100,rawFps:59,jitterMs:3,activeCount:1,phase:'Set'});gs=gr.state;}assert.equal(gr.action,'down30','sustained overload must trigger safe fallback');
console.log('BLE4.3.8.9.4.1 Stress QA PASS · 500 false-motion bursts · 120 monotonic shots · 100 transient-load runs · sustained fallback');

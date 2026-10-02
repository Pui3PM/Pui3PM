'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const L=require('../static/side_lifecycle_core.js');
assert.equal(L.VERSION,'BLE4.3.8.9.5.5-side-lifecycle-v7');
function input(t,o={}){return {epochMs:t,phaseQuality:.96,phaseDrawWristVisibility:.95,phaseDrawElbowVisibility:.96,setReady:true,phaseShootingPosture:true,phaseBowExtended:true,bowPlaneReady:true,bowPlaneStable:true,setAdmissionReady:true,shotIntentReady:true,neutralEvidence:false,wristsLow:false,drawSideVisible:true,bowArmDeg:150,bowSpeed:.2,drawSpeed:.2,faceHandSpeed:.2,phaseFaceDist:.8,...o};}
function nat(p,o={}){return {phase:p,primaryPhase:p,phaseTimeline:o.phaseTimeline||[],...o};}
let s=L.fresh();
// establish verified Draw
for(const [t,p,i] of [[0,'Setup',input(0,{phaseShootingPosture:false,phaseBowExtended:false,neutralEvidence:true,wristsLow:true,bowArmDeg:110})],[120,'Setup',input(120,{phaseShootingPosture:false,phaseBowExtended:false,neutralEvidence:true,wristsLow:true,bowArmDeg:110})],[220,'Draw',input(220,{drawSpeed:1.3,faceHandSpeed:1.1,bowSpeed:1.2})],[310,'Draw',input(310,{drawSpeed:1.2,faceHandSpeed:1.0,bowSpeed:1.0})]])s=L.update(s,i,nat(p),t).state;
assert(s.verifiedDraw,'Draw should verify');
// raw Anchor while hand is still travelling must remain authoritative Draw.
for(const t of [380,450,520]){const r=L.update(s,input(t,{drawSpeed:1.15,faceHandSpeed:1.0}),nat('Anchor',{phaseTimeline:[{phase:'Draw',epochMs:220},{phase:'Anchor',epochMs:380}]}),t);s=r.state;assert.equal(r.snapshot.authorityPhase,'Draw','moving Draw must not promote to Anchor');}
// once physically settled, Anchor may advance.
for(const t of [610,710])s=L.update(s,input(t,{drawSpeed:.22,faceHandSpeed:.24}),nat('Anchor'),t).state;
assert.equal(s.authorityPhase,'Anchor');
const adaptive=fs.readFileSync(path.join(__dirname,'../static/adaptive_release_core.js'),'utf8');
assert(adaptive.includes("let-down-veto-bow-arm-collapse"),'bow-arm collapse let-down veto missing');
assert(adaptive.includes("(onsetBowArm-currentBowArm)>=7.5"),'bow-arm collapse threshold missing');
const cap=fs.readFileSync(path.join(__dirname,'../static/capture_integrity_layer.js'),'utf8');
assert(cap.includes('expose only lifecycle-authorized non-terminal phases'),'phase authority clamp missing');
console.log('BLE438954 Phase Truth Guard QA PASS');

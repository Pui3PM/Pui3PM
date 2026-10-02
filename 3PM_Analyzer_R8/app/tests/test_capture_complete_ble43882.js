'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const A=require('../static/adaptive_release_core.js');
const C=require('../static/capture_integrity_core.js');
const T=require('../static/temporal_evidence_core.js');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/ble43881_latest_release_regression.json'),'utf8'));
function replay(c){let s=A.fresh(),n=0,adaptive=0;for(const x of c.samples){const tl=c.timeline.filter(e=>e.epochMs<=x.t),m={...x,phaseTimeline:tl},input={...x,epochMs:x.t,measurementTrustScore:x.measurementTrust,setReady:x.setAdmissionReady};const r=A.update(s,m,input,x.t);s=r.state;const y=r.override?{...m,...r.patch}:m;if(y.shotComplete){n++;if(y.adaptiveReleaseProof)adaptive++;}}return{n,adaptive};}
const mature=fixture.cases.filter(x=>x.kind==='mature-release-miss'),prep=fixture.cases.filter(x=>x.kind==='prep-negative');
assert.equal(mature.length,2);
for(const c of mature){const r=replay(c);assert.equal(r.n,0,'unarmed Hold/return traces must not be promoted into releases');}
for(const c of prep)assert.equal(replay(c).n,0,'Set/Draw preparation must remain 0 Capture');
// Same decoded camera frame arriving from two evidence paths must collapse while preserving both tags.
const blob={};const d=T.dedupeFrames([{epochMs:1000,mediaTime:1.25,blob,evidenceZone:'anchor-pin'},{epochMs:1032,mediaTime:1.25,blob,evidenceZone:'hold-pin'}]);
assert.equal(d.length,1);assert(d[0].evidenceTags.includes('anchor-pin')&&d[0].evidenceTags.includes('hold-pin'));
// Contract accepts a single physical frame carrying both short-phase tags, and does not fabricate Expansion.
const rel=1790000000000,rec={releaseEpochMs:rel,followThroughEndEpochMs:rel+1800,frames:[
 {offsetMs:-900,evidenceZone:'draw-pin',evidenceTags:['draw-pin']},{offsetMs:-300,evidenceZone:'anchor-pin',evidenceTags:['anchor-pin','hold-pin']},{offsetMs:-80,evidenceZone:'release-focus'},{offsetMs:0,evidenceZone:'release-focus'},{offsetMs:800,evidenceZone:'follow-summary'},{offsetMs:1800,evidenceZone:'recovery-end'}]};
const adv={release_epoch_ms:rel,phase_timeline:[{phase:'Draw',epochMs:rel-900,role:'side'},{phase:'Anchor',epochMs:rel-300,role:'side'},{phase:'Aim / Hold',epochMs:rel-250,role:'side'},{phase:'Release',epochMs:rel,role:'side'},{phase:'Follow Through',epochMs:rel+50,role:'side'}]};
const contract=C.evidenceContract(rec,adv);assert.equal(contract.complete,true,JSON.stringify(contract));assert(contract.notObserved.includes('expansion'));
const html=fs.readFileSync(path.join(__dirname,'../static/index.html'),'utf8'),fg=fs.readFileSync(path.join(__dirname,'../static/foundation_guard_layer.js'),'utf8'),ci=fs.readFileSync(path.join(__dirname,'../static/capture_integrity_layer.js'),'utf8'),app=fs.readFileSync(path.join(__dirname,'../static/app.js'),'utf8'),te=fs.readFileSync(path.join(__dirname,'../static/temporal_evidence_layer.js'),'utf8'),launcher=fs.readFileSync(path.join(__dirname,'../../internal/start_services.sh'),'utf8');
assert(html.includes('foundation_guard_layer.js?v=mac20260930r7'));
assert(fg.includes('Shot captured ✓ · Set — Ready')&&fg.includes('function markCaptureComplete'));
assert(ci.includes('duplicate_release_same_cycle')&&ci.includes('shot_intent_not_verified')&&ci.includes('intentProof?.verified'));
assert(app.includes('sourceMediaTime')&&app.includes('mediaTime:Number.isFinite(mediaTime)?mediaTime:null'));
assert(app.includes('calibrationEvidenceComplete')&&app.includes('calibrationEvidenceVerifiedShots.has(Number(shot.id))'),'Calibration must count only complete real evidence');
assert(te.includes('pinLabels')&&te.includes('evidenceTags'));
assert(launcher.includes('3pm_swift_smoke.swift')&&launcher.includes('-sdk "$SWIFT_SDKROOT" -target "$SWIFT_TARGET"'));
console.log('BLE4.3.8.8.5 Capture Complete regression PASS · unsafe unarmed mature traces 0 · prep negatives 0 · frame identity dedupe/tag truth PASS');

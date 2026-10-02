'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=process.argv[2]||path.join(__dirname,'../static');
const B=require(path.join(root,'evidence_budget_core.js'));
class El{constructor(){this.children=[];this.dataset={};this.textContent='';this.classList={add(){},remove(){},toggle(){}};}set innerHTML(html){this.children=Array.from({length:(html.match(/<button /g)||[]).length},()=>new El());}appendChild(x){this.children.push(x);}replaceChildren(){this.children=[];}showModal(){this.open=true;}}
const elements=Object.fromEntries(['filmstrip','filmstripStatus','frameViewerImage','frameViewerTitle','frameViewerTime','frameViewerDialog'].map(k=>[k,new El()]));
const shot={id:2,session_id:1,shot_no:2};let record,readOverride,originalCalls=0;const revoked=[];
const ctx={console,window:{EvidenceBudgetCore:B,CoachKeyframe25BackfillCore:require(path.join(root,'coach_keyframe25_backfill_core.js')),CoachKeyframePlanCore:require(path.join(root,'coach_keyframe_plan_core.js')),addEventListener(){}},document:{getElementById:k=>elements[k],createElement:()=>new El()},URL:{createObjectURL:f=>'blob:'+f.i,revokeObjectURL:u=>revoked.push(u)},queueMicrotask,
 reviewRole:'side', renderMultiReview(){},CAMERA_ROLES:['side','rear','overhead'], $:sel=>elements[sel.replace('#','')]||null, $$:sel=>sel==='#filmstrip .frame-thumb'?elements.filmstrip.children:[], roleFramesForShot:()=>Array.from({length:15},(_,id)=>({id,offset_ms:id*100})),frameGenerationInFlight:new Set(),roleTitle:r=>r,frameBaseLabel:()=> 'Frame',escapeHtml:s=>s,frameUrl:id=>'legacy:'+id,formatOffset:n=>String(n),loadAdvancedShotMetrics:()=>({release_epoch_ms:100000}),evidenceDbGet:()=>readOverride?readOverride():Promise.resolve(record)};
vm.createContext(ctx);const app=fs.readFileSync(path.join(root,'app.js'),'utf8');vm.runInContext(app.slice(app.indexOf('function renderFilmstrip(shot){'),app.indexOf('function formatOffset(ms){')),ctx);vm.runInContext(fs.readFileSync(path.join(root,'coach_keyframe25_backfill_layer.js'),'utf8'),ctx);
const L=ctx.window.CoachKeyframe25BackfillLayer;
(async()=>{
 record={shotId:2,sessionId:1,role:'side',releaseEpochMs:100000,frames:Array.from({length:25},(_,i)=>({epochMs:99000+i*100,offsetMs:-1000+i*100,blob:{i}}))};
 ctx.renderFilmstrip(shot);await new Promise(setImmediate);assert.equal(elements.filmstrip.children.length,25,'actual filmstrip must show 25, even with only 15 legacy backend thumbnails');assert.equal(elements.filmstrip.children.filter(x=>!x.disabled).length,25);
 elements.filmstrip.children[24].onclick();assert.equal(elements.frameViewerImage.src,'blob:24');assert(elements.frameViewerDialog.open);
 for(const role of ['rear','overhead']){ctx.reviewRole=role;record.role=role;await L.render(shot);assert.equal(elements.filmstrip.children.length,25);}
 record.frames=record.frames.slice(0,15);await L.render(shot);assert.equal(elements.filmstrip.children.length,25);assert.equal(elements.filmstrip.children.filter(x=>x.disabled).length,10);
 assert(elements.filmstripStatus.textContent.includes('15/25 real frames'));assert(elements.filmstripStatus.textContent.includes('10 Missing'));
 record.releaseEpochMs=90000;await L.render(shot);assert.equal(elements.filmstrip.children.filter(x=>x.disabled).length,25,'reused id must not leak an old release');
 let resolve;readOverride=()=>new Promise(r=>resolve=r);const pending=L.render(shot);ctx.reviewRole='multi';await L.render(shot);const count=elements.filmstrip.children.length;resolve(record);await pending;assert.equal(elements.filmstrip.children.length,count,'late async read must not replace changed selection');
 assert(revoked.length>=25,'object URLs must be released');
 console.log('R7 filmstrip rendered-DOM PASS: 25 clickable frames, 3 roles, 15+10 Missing, reused-id isolation, async selection and URL cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});

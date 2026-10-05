'use strict';
const assert=require('assert'),path=require('path'),fs=require('fs'),os=require('os'),{chromium}=require('playwright'),S=require('./stub_backend.cjs');
const root=path.resolve(process.argv[3]||path.join(__dirname,'../../static')),exe=process.argv[2]||process.env.CHROMIUM_PATH;
(async()=>{
 const srv=await S.start(root);const dir=fs.mkdtempSync(path.join(os.tmpdir(),'3PM restore bench '));let ctx,errors=[];const checks={};
 const open=async()=>{ctx=await chromium.launchPersistentContext(dir,{executablePath:exe,args:['--no-sandbox','--disable-dev-shm-usage'],viewport:{width:1440,height:1000}});const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${srv.port}/static/index.html`);await p.waitForTimeout(1800);return p;};
 try{
 let p=await open();
 const grouping=await p.evaluate(()=>{
  STATE.shots=Array.from({length:12},(_,i)=>({id:i+1,session_id:1,shot_no:i+1,metrics:{},score:null}));currentSessionId=1;selectedShotId=1;renderShots();
  const ends=[...document.querySelectorAll('.shot-end-group')].map(g=>({end:Number(g.dataset.end),shots:[...g.querySelectorAll('.shot-num')].map(x=>Number(x.textContent.replace(/\D/g,'')))}));
  const cfg={...getImpactConfig(),arrowsPerEnd:3,faceType:'40-r-vertical'};
  const scoring=roundStructure(cfg),links=[linkedShotForArrow(1,2,cfg).shot_no,linkedShotForArrow(2,0,cfg).shot_no];
  // Configure the actual Impact ledger, then render its 3 real scoring chips.
  const data=loadImpactData();data.config=cfg;saveImpactData(data);renderImpactArrowStrip();
  return{ends,scoring:scoring.arrowsPerEnd,links,chips:document.querySelectorAll('#impactArrowStrip .impact-arrow-chip').length};
 });
 assert.deepEqual(grouping.ends.sort((a,b)=>a.end-b.end),[{end:1,shots:[1,2,3,4,5,6]},{end:2,shots:[7,8,9,10,11,12]}]);assert.equal(grouping.scoring,3);assert.deepEqual(grouping.links,[3,4]);assert.equal(grouping.chips,3);checks.analysis6Impact3=true;
 const before=await p.evaluate(async()=>{
  const frames=Array.from({length:10},(_,i)=>({epochMs:100000+i*34,offsetMs:i*34,source:'browser-bench',generation:2,deviceID:'bench-camera',mediaTime:3+i/30,frameSeq:i,blob:new Blob([new Uint8Array([i,22,33,44])],{type:'image/jpeg'}),evidenceZone:'release-focus',evidenceTags:['fixture-byte-witness']}));
  await evidenceDbMerge({sessionId:1,shotId:11,role:'side',releaseEpochMs:100000,frames});
  const summarize=async r=>({sessionId:r.sessionId,shotId:r.shotId,releaseEpochMs:r.releaseEpochMs,frames:await Promise.all(r.frames.map(async f=>({frameUID:f.frameUID,source:f.source,generation:f.generation,epochMs:f.epochMs,offsetMs:f.offsetMs,evidenceTags:f.evidenceTags,bytes:[...new Uint8Array(await f.blob.arrayBuffer())]}))),slots:r.reviewSlots.length,missing:r.reviewSlots.filter(x=>x.missing).length,input:r.evidenceInputCounts});
  const rec=await evidenceDbGet(11,'side',1);await evidenceDbMerge({...rec,frames:rec.frames});const read=await evidenceDbGet(11,'side',1);return summarize(read);
 });
 assert.equal(before.frames.length,10);assert.equal(before.slots,25);assert.equal(before.missing,15);assert(before.frames.every(x=>x.frameUID));checks.readbackRetry=true;
 await ctx.close();p=await open();
 const after=await p.evaluate(async()=>{const r=await evidenceDbGet(11,'side',1);return{sessionId:r.sessionId,shotId:r.shotId,releaseEpochMs:r.releaseEpochMs,frames:await Promise.all(r.frames.map(async f=>({frameUID:f.frameUID,source:f.source,generation:f.generation,epochMs:f.epochMs,offsetMs:f.offsetMs,evidenceTags:f.evidenceTags,bytes:[...new Uint8Array(await f.blob.arrayBuffer())]}))),slots:r.reviewSlots.length,missing:r.reviewSlots.filter(x=>x.missing).length,input:r.evidenceInputCounts};});
 assert.deepEqual(after,before);checks.browserRestartBytesIdentityRestore=true;
 // Cross-session read does not expose the prior session's record.
 const absent=await p.evaluate(()=>evidenceDbGet(11,'side',2));assert.equal(absent,null);checks.sessionIsolation=true;
 await p.click('.mode-btn[data-mode="review"]');await p.click('.shot-row-v34[data-id="11"]');await p.waitForTimeout(700);
 const rail=await p.evaluate(()=>({real:document.querySelectorAll('#fixedEvidence25Rail .real').length,missing:document.querySelectorAll('#fixedEvidence25Rail .missing').length}));assert.deepEqual(rail,{real:10,missing:15});checks.restoredRail25=true;
 const fullCounts=await p.evaluate(async()=>{
  const frames=Array.from({length:30},(_,i)=>({epochMs:200000+i*1000/30,offsetMs:i*1000/30,source:'browser-bench',generation:3,deviceID:'bench-camera',frameSeq:i,mediaTime:8+i/30,blob:new Blob([new Uint8Array([i,11,22])]),evidenceZone:'release-focus'}));
  await evidenceDbMerge({sessionId:1,shotId:99,role:'side',releaseEpochMs:200000,frames});const r=await evidenceDbGet(99,'side',1);
  return {received:r.evidenceInputCounts.receivedBatch,unique:r.evidenceInputCounts.uniqueBatch,persisted:r.frames.length,selected:r.reviewSlots.filter(x=>!x.missing).length,slots:r.reviewSlots.length};
 });
 assert.deepEqual(fullCounts,{received:30,unique:30,persisted:25,selected:25,slots:25});checks.thirtyFPSSeparateCounts=true;
 assert.deepEqual(errors,[]);checks.noRuntimeErrors=true;
 console.log(JSON.stringify({status:'PASS',scope:'Linux Chromium; persisted real Blob bytes from synthetic fixtures; backend test double; no Mac/camera claim',checks,grouping,fullCounts,counts:{received:before.input.receivedBatch,unique:before.input.uniqueBatch,persisted:after.frames.length,selected:rail.real,logicalSlots:25,missing:rail.missing}},null,2));
 }finally{if(ctx)await ctx.close();await srv.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});

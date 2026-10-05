'use strict';
// Post-P108 R2 (2026-10-05, Claude Code): regressions for the defects found in the delivered Post-P108 build.
//   R2-01 fixed-25 selection duplicated a real frame (selection key was per OBJECT; cores copy rows) -> 25 slots with
//         repeated images while distinct frames were dropped.
//   R2-02 camera identity/order required a device id that no pipeline emits -> native frames (source+generation) lost
//         camera order under callback-epoch jitter; re-deliveries inside one explicit domain became new frames.
//   R2-03 writer adapter stamped a RANDOM FrameUID per frame object -> every readback, retry or JPEG re-encode of one
//         capture became a new frame.
//   R2-04 historical rows stored without FrameUID were duplicated whenever a layer merged a raw snapshot back.
// The Post-P108 negatives stay enforced: equal time/size, unknown source/generation, near epochs never prove identity.
// Usage: node app/tests/test_post_p108_r2_identity.js [path-to-app/static]
const assert=require('assert'),path=require('path'),fs=require('fs'),vm=require('vm');
const H=require('./p108_harness');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../static'));
const failures=[];const check=async(name,fn)=>{try{await fn();}catch(e){failures.push(`${name}: ${e.message}`);}};
const rel=100000,sid=1,shot=21,KEY=`${sid}:${shot}:side`;
(async()=>{
  const {T,B}=H.load(root),FI=require(path.join(root,'frame_identity_core.js'));
  // ---- R2-01 ----
  await check('R2-01 fixed-25 never repeats a real frame (30 distinct UID-less rows, 15 equal-epoch pairs)',()=>{
    const rows=[];for(let i=0;i<15;i++){const ep=rel-700+i*100;rows.push({tag:'s'+i,epochMs:ep,offsetMs:ep-rel,mediaTime:null,blob:H.blob('s'+i),source:'sparse-jpeg',evidenceZone:'release-focus'});rows.push({tag:'n'+i,epochMs:ep,offsetMs:ep-rel,mediaTime:null,frameSeq:null,generation:1,blob:H.blob('n'+i),source:'native-avfoundation-standard',evidenceZone:'release-focus'});}
    const out=B.normalizeRecord({releaseEpochMs:rel,frames:rows});
    assert.strictEqual(out.frames.length,25);assert.strictEqual(new Set(out.frames.map(f=>f.tag)).size,25,'a real frame occupies two slots');
    assert.strictEqual(out.evidenceBudget.sourceFrames,30);
  });
  await check('R2-01 fixed-25 never repeats a real frame (40 rows, one placeholder Blob, no labels)',()=>{
    const b={size:1};const rows=Array.from({length:40},(_,i)=>({tag:'p'+i,epochMs:rel-1000+i*50,blob:b,source:'sparse-jpeg',evidenceZone:'release-focus'}));
    const out=B.selectFixedBudget(rows,rel,25,[rows[3].epochMs,rows[30].epochMs]);
    assert.strictEqual(out.length,25);assert.strictEqual(new Set(out.map(f=>f.tag)).size,25);
    assert(out.some(f=>f.tag==='p3')&&out.some(f=>f.tag==='p30'),'reserved witnesses kept');
  });
  // ---- R2-02 ----
  await check('R2-02 native source+generation without device id keeps camera order under epoch jitter',()=>{
    const f=(i,ep)=>({epochMs:ep,mediaTime:5000+i/30,frameSeq:i+1,source:'native-avfoundation-standard',generation:1,blob:H.blob('n'+i)});
    assert.deepStrictEqual(B.canonicalUnique([f(0,1000),f(1,1040),f(2,1035),f(3,1100)]).map(x=>x.frameSeq),[1,2,3,4]);
    assert.deepStrictEqual(T.canonicalFrames([f(3,1100),f(2,1035),f(0,1000),f(1,1040)]).map(x=>x.frameSeq),[1,2,3,4]);
  });
  await check('R2-02 re-delivery of one frame inside an explicit domain (source+generation) is one frame',()=>{
    const a={epochMs:1000,mediaTime:2.5,frameSeq:75,source:'worker-track-processor-30',generation:4,blob:H.blob('w')};
    assert.strictEqual(FI.uniqueFrames([a,structuredClone(a)]).length,1);
    assert.strictEqual(FI.uniqueFrames([a,{...structuredClone(a),frameSeq:76}]).length,2,'contradictory seq stays two');
    assert.strictEqual(FI.uniqueFrames([a,{...structuredClone(a),generation:5}]).length,2,'other generation stays two');
  });
  await check('Post-P108 negatives still hold (equal time/size, unknown source/generation, near epoch)',()=>{
    const f=o=>({epochMs:1000,blob:new Blob(['abc']),...o});
    for(const extra of [{},{source:'same'},{source:'same',generation:1},{deviceID:'d',mediaTime:1,frameSeq:1},{source:'sparse-jpeg',mediaTime:null}])assert.strictEqual(FI.uniqueFrames([f(extra),f(extra)]).length,2,JSON.stringify(extra));
    assert.strictEqual(FI.uniqueFrames([{epochMs:1000,blob:H.blob(1),source:'sparse-jpeg'},{epochMs:1005,mediaTime:3.2,frameSeq:7,blob:H.blob(2),source:'worker-track-processor-60'}]).length,2,'near epoch is not identity');
  });
  // ---- R2-03 writer adapter ----
  const idLayer=fs.existsSync(path.join(root,'evidence_identity_persistence_layer.js'));
  await check('R2-03 writer adapter is shipped and loaded by index.html after app.js',()=>{
    assert(idLayer,'evidence_identity_persistence_layer.js missing');const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
    const a=html.indexOf('/static/app.js?'),w=html.indexOf('/static/evidence_identity_persistence_layer.js?'),t=html.indexOf('/static/temporal_evidence_layer.js?'),n=html.indexOf('/static/native_capture_layer.js?');
    assert(a>0&&w>a&&t>w&&n>w,'load order app.js < identity layer < temporal/native layers');
  });
  await check('R2-03 readback + retry + re-merge of frozen-app rows: no duplicates, stable UIDs',async()=>{
    const e=H.env(root);const frames=Array.from({length:8},(_,i)=>({epochMs:rel-400+i*100,offsetMs:-400+i*100,mediaTime:30+i*0.1,blob:H.blob('f'+i),source:'sparse-jpeg',evidenceZone:'release-focus'}));
    await e.merge({key:KEY,sessionId:sid,shotId:shot,role:'side',releaseEpochMs:rel,frames});
    const uids=e.get(sid,shot).frames.map(f=>f.frameUID);assert(uids.every(Boolean),'every stored row has a FrameUID');
    await e.merge({key:KEY,sessionId:sid,shotId:shot,role:'side',releaseEpochMs:rel,frames});                                        // retry, same objects
    await e.merge({key:KEY,sessionId:sid,shotId:shot,role:'side',releaseEpochMs:rel,frames:frames.map(f=>({...f}))});                // re-plan, shallow copies
    await e.merge({key:KEY,sessionId:sid,shotId:shot,role:'side',releaseEpochMs:rel,frames:structuredClone(e.get(sid,shot).frames)}); // readback
    const rec=e.get(sid,shot);assert.strictEqual(rec.frames.length,8);assert.deepStrictEqual(rec.frames.map(f=>f.frameUID).sort(),[...uids].sort());
  });
  await check('R2-03 JPEG re-encodes of one buffered dense frame share one FrameUID',async()=>{
    const e=H.env(root,{identityLayer:false});const ctx=e.ctx;
    ctx.evidenceFrameToBlob=async f=>f.blob||new Blob(['jpeg-of-'+f.epochMs]);                       // frozen encoder stand-in: new Blob per call
    vm.runInContext(fs.readFileSync(path.join(root,'evidence_identity_persistence_layer.js'),'utf8'),ctx);
    const dense=Array.from({length:6},(_,i)=>({epochMs:rel-200+i*33,mediaTime:900+i/30,bitmap:{w:1},source:'native-video-frame'}));
    const persist=async()=>{const out=[];for(const d of dense){const planned={...d,denseRef:d,offsetMs:d.epochMs-rel,source:'native30',evidenceZone:'release-focus'};const blob=await ctx.evidenceFrameToBlob(planned,.76);
      out.push({epochMs:d.epochMs,offsetMs:d.epochMs-rel,mediaTime:d.mediaTime,blob,source:'native30',evidenceZone:'release-focus',evidenceTags:[]});}
      return e.merge({key:KEY,sessionId:sid,shotId:shot,role:'side',releaseEpochMs:rel,frames:out});};
    await persist();const first=e.get(sid,shot).frames.map(f=>f.frameUID);await persist();
    const rec=e.get(sid,shot);assert.strictEqual(rec.frames.length,6,'second persist must not add re-encoded copies');assert.deepStrictEqual(rec.frames.map(f=>f.frameUID),first);
  });
  // ---- R2-04 historical rows ----
  await check('R2-04 historical stored rows get deterministic, distinct read stamps; clone pairs are retained',()=>{
    const e=H.env(root),L=e.ctx.window.EvidenceIdentityPersistenceLayer;assert(L&&L.stampStoredRecord,'layer read stamp API');
    const twin={epochMs:rel,offsetMs:0,mediaTime:null,blob:H.blob('t'),source:'sparse-jpeg'};
    const stored={key:KEY,sessionId:sid,shotId:shot,role:'side',releaseEpochMs:rel,frames:[twin,structuredClone(twin),{epochMs:rel+100,offsetMs:100,mediaTime:null,blob:H.blob('u'),source:'sparse-jpeg'}]};
    const a=L.stampStoredRecord(structuredClone(stored)).frames.map(f=>f.frameUID),b=L.stampStoredRecord(structuredClone(stored)).frames.map(f=>f.frameUID);
    assert.deepStrictEqual(a,b);assert.strictEqual(new Set(a).size,3,'stored clone pair stays two rows (no proof to collapse)');
    const kept=L.stampStoredRecord(structuredClone({...stored,frames:[{...twin,frameUID:'keep-me'}]}));assert.strictEqual(kept.frames[0].frameUID,'keep-me','existing UID never replaced');
  });
  const historical=async opts=>{
    const rows=[0,1,2,3].map(i=>({index:i,frame_seq:i+10,epoch_ms:rel-60+i*33,capture_epoch_ms:rel-60+i*33,master_time_ms:null,media_time_ms:5000000+i*33,url:`${H.BASE}/frame/${i}`}));
    let e;e=H.env(root,{...opts,bridge:H.nativeBridge({rel,frames:rows,onFrame:()=>e.merge({...e.get(sid,shot),followThroughEndEpochMs:rel+2000,frames:[{epochMs:rel+2000,offsetMs:2000,mediaTime:12,blob:H.blob('rec'),source:'sparse-jpeg',evidenceZone:'recovery-end'}]})})});
    e.seed({key:KEY,sessionId:sid,shotId:shot,role:'side',releaseEpochMs:rel,frames:[{epochMs:rel-900,offsetMs:-900,mediaTime:9.1,blob:H.blob('live'),source:'sparse-jpeg',evidenceZone:'anchor-focus'},{epochMs:rel+800,offsetMs:800,mediaTime:9.9,blob:H.blob('fol'),source:'sparse-jpeg',evidenceZone:'follow-summary'}]});
    await H.openNative(e,1);await H.releaseAndWait(e,rel);return e.get(sid,shot);
  };
  await check('R2-04 historical record + native raw snapshot + Recovery: every real frame stored once',async()=>{
    const rec=await historical({});const k=rec.frames.map(f=>`${f.source}|${f.epochMs}`);
    assert.strictEqual(new Set(k).size,k.length,'duplicate real frame: '+JSON.stringify(k));assert.strictEqual(rec.frames.length,7);
    assert(rec.frames.every(f=>typeof f.frameUID==='string'),'all rows durable after the merge');
  });
  await check('characterization: WITHOUT the shipped adapter the same scenario duplicates (adapter is load-bearing)',async()=>{
    const rec=await historical({identityLayer:false});const k=rec.frames.map(f=>`${f.source}|${f.epochMs}`);
    assert(new Set(k).size<k.length,'expected the pre-adapter stack to duplicate historical rows; if this changed, re-audit the adapter dependency');
  });
  if(failures.length){console.error('Post-P108 R2 identity FAIL\n - '+failures.join('\n - '));process.exit(1);}
  console.log('Post-P108 R2 identity PASS: fixed-25 no repeated frame, explicit-domain order/identity without device id, provenance FrameUID (retry/readback/re-encode), historical read stamp, Post-P108 negatives kept; pre-adapter duplication characterized');
})().catch(e=>{console.error(e);process.exit(1);});

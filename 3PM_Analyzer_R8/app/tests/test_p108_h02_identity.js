'use strict';
// R8 P1-08 H-02: durable frame identity through cores, adapters, persistence and fixed-25 selection.
// Usage: node app/tests/test_p108_h02_identity.js [path-to-app/static]
const assert=require('assert'),path=require('path');
const H=require('./p108_harness');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../static'));
const failures=[];const check=async(name,fn)=>{try{await fn();}catch(e){failures.push(`${name}: ${e.message}`);}};
const rel=100000,sid=1,shotId=9,KEY=`${sid}:${shotId}:side`;
const contentOf=f=>`${f.source}|${f.epochMs}|${f.blob&&f.blob.size}`;
function assertUniqueContent(frames,label){const s=new Set();for(const f of frames){const k=contentOf(f);assert(!s.has(k),`${label}: duplicate real frame ${k}`);s.add(k);}}

(async()=>{
  const {T,B}=H.load(root);
  const fr=(o)=>({blob:H.blob(o.tag||String(o.epochMs)),...o});
  // ---- distinct frames stay distinct ----
  await check('25 null mediaTime/frameSeq frames stay 25 (temporal, budget, merge)',()=>{
    const rows=Array.from({length:25},(_,i)=>fr({epochMs:1000+i*34,mediaTime:null,frameSeq:null,source:'test'}));
    assert.strictEqual(T.canonicalFrames(rows).length,25);assert.strictEqual(B.canonicalUnique(rows).length,25);assert.strictEqual(T.mergeEvidence([],rows,1000).length,25);
  });
  await check('same frameSeq across different sources stays distinct',()=>{
    const rows=[fr({epochMs:1000,frameSeq:5,source:'cam-a',tag:'a'}),fr({epochMs:1500,frameSeq:5,source:'cam-b',tag:'b'})];
    assert.strictEqual(B.canonicalUnique(rows).length,2);assert.strictEqual(T.canonicalFrames(rows).length,2);
  });
  await check('same source+frameSeq across generations stays distinct (Astra ID-GENERATION)',()=>{
    const rows=[fr({epochMs:1000,frameSeq:1,generation:1,source:'native-avfoundation-standard',frameUID:'g1',tag:'g1'}),fr({epochMs:2000,frameSeq:1,generation:2,source:'native-avfoundation-standard',frameUID:'g2',tag:'g2'})];
    assert.strictEqual(B.canonicalUnique(rows).length,2);assert.strictEqual(T.canonicalFrames(rows).length,2);
    const noUid=rows.map(({frameUID,...r})=>r);assert.strictEqual(B.canonicalUnique(noUid).length,2,'generation alone separates');
  });
  await check('equal mediaTime with different FrameUID/source stays distinct (Astra ID-SOURCE)',()=>{
    const rows=[fr({epochMs:1000,mediaTime:1,frameSeq:1,source:'camera-a',frameUID:'a',tag:'a'}),fr({epochMs:1001,mediaTime:1,frameSeq:2,source:'camera-b',frameUID:'b',tag:'b'})];
    assert.strictEqual(T.canonicalFrames(rows).length,2);assert.strictEqual(B.canonicalUnique(rows).length,2);
  });
  await check('native vs browser frames never merge on equal mediaTime',()=>{
    const rows=[fr({epochMs:1000,mediaTime:5.0,source:'sparse-jpeg',tag:'s'}),fr({epochMs:1400,mediaTime:5.0,source:'native-avfoundation-standard',generation:1,frameSeq:3,tag:'n'})];
    assert.strictEqual(B.canonicalUnique(rows).length,2);assert.strictEqual(T.canonicalFrames(rows).length,2);
  });
  // ---- the same frame stays one ----
  await check('structuredClone of one frame is one frame (Astra ID-CLONE)',()=>{
    const original={epochMs:1000,mediaTime:null,frameSeq:null,blob:new Blob(['same original frame']),source:'sparse-jpeg'};
    const cloned=structuredClone(original);
    assert.strictEqual(B.canonicalUnique([original,cloned]).length,1);assert.strictEqual(T.canonicalFrames([original,cloned]).length,1);
  });
  await check('IndexedDB round trip + re-merge keeps identity stable',async()=>{
    const e=H.env(root);const frames=Array.from({length:6},(_,i)=>fr({epochMs:rel-500+i*100,offsetMs:-500+i*100,mediaTime:null,source:'sparse-jpeg',evidenceZone:'release-focus',tag:'r'+i}));
    e.seed({key:KEY,sessionId:sid,shotId,role:'side',releaseEpochMs:rel,frames:[]});
    await e.merge({key:KEY,sessionId:sid,shotId,role:'side',releaseEpochMs:rel,frames});
    const once=e.get(sid,shotId).frames.length;
    await e.merge({key:KEY,sessionId:sid,shotId,role:'side',releaseEpochMs:rel,frames:structuredClone(e.get(sid,shotId).frames)});  // readback re-merged
    await e.merge({key:KEY,sessionId:sid,shotId,role:'side',releaseEpochMs:rel,frames});                                            // retry of original write
    const rec=e.get(sid,shotId);assert.strictEqual(once,6);assert.strictEqual(rec.frames.length,6,'no duplicates after readback/retry');assertUniqueContent(rec.frames,'round trip');
    assert.strictEqual(e.reload(sid,shotId).frames.length,6);
  });
  await check('native writer control: no duplicated sparse frame after late Recovery merge (Astra control)',async()=>{
    const rows=[0,1,2,3].map(i=>({index:i,frame_seq:i<2?null:i+10,epoch_ms:rel-60+i*33,capture_epoch_ms:rel-60+i*33,master_time_ms:null,media_time_ms:i<2?null:5000+i*33,url:`${H.BASE}/frame/${i}`}));
    let e;e=H.env(root,{bridge:H.nativeBridge({rel,frames:rows,onFrame:()=>e.merge({...e.get(sid,shotId),followThroughEndEpochMs:rel+2000,frames:[{epochMs:rel+2000,offsetMs:2000,mediaTime:null,blob:H.blob('rec'),evidenceZone:'recovery-end',source:'sparse-jpeg'}]})})});
    e.seed({key:KEY,sessionId:sid,shotId,role:'side',releaseEpochMs:rel,frames:[{epochMs:rel-900,offsetMs:-900,mediaTime:null,blob:H.blob('live'),source:'sparse-jpeg',evidenceZone:'anchor-focus'}]});
    await H.openNative(e,1);await H.releaseAndWait(e,rel);
    const rec=e.get(sid,shotId);assertUniqueContent(rec.frames,'native control');
    assert.strictEqual(rec.frames.filter(f=>f.epochMs===rel-900).length,1,'sparse frame stored once');
    assert.strictEqual(rec.frames.filter(f=>/^native-/.test(f.source)).length,4,'4 native frames incl. 2 with null seq/media');
    const nat=rec.frames.filter(f=>/^native-/.test(f.source));
    assert(nat.every(f=>f.generation===1&&typeof f.frameUID==='string'&&f.frameUID.includes('/1/')||f.frameSeq===null),'native frames carry origin generation + durable UID when seq known');
    assert(nat.filter(f=>f.frameSeq===null).every(f=>f.mediaTime===null&&f.masterTimeMs===null),'unknown native clocks stay null');
  });
  // ---- adapters ----
  await check('actual worker augmentBundle keeps 25 null-identity frames (Astra WORKER-NULL-MAPPING)',async()=>{
    const e=H.env(root);e.seed({key:KEY,sessionId:sid,shotId,role:'side',releaseEpochMs:rel,frames:[]});
    await e.browserLayer.augmentBundle({role:'side',generation:0,release_epoch_ms:rel,mode:'worker-track-processor',raw_fps:30,reported_fps:30,frames:Array.from({length:25},(_,i)=>({epochMs:rel+i*34,mediaTime:null,frameSeq:null,blob:H.blob('w'+i)}))});
    const rec=e.get(sid,shotId);assert.strictEqual(rec.frames.length,25,'25 unique worker frames persisted');
    assert(rec.frames.every(f=>f.mediaTime===null&&f.frameSeq===null),'unknown stays null, never manufactured 0/0');
  });
  await check('stale native bundle from a previous generation cannot become current evidence',async()=>{
    const rows=[0,1].map(i=>({index:i,frame_seq:i+1,epoch_ms:rel-30+i*33,capture_epoch_ms:rel-30+i*33,master_time_ms:null,media_time_ms:7000+i*33,url:`${H.BASE}/frame/${i}`}));
    // (a) release at gen1; camera reopened as gen2 while blobs download; manifest says gen1 -> frames keep gen1 provenance
    let e;e=H.env(root,{bridge:H.nativeBridge({rel,frames:rows,generation:1,onFrame:async()=>{e.N.states.side.generation=2;e.N.states.side.token++;}})});
    e.seed({key:KEY,sessionId:sid,shotId,role:'side',releaseEpochMs:rel,frames:[]});
    await H.openNative(e,1);await H.releaseAndWait(e,rel);
    const nat=(e.get(sid,shotId).frames||[]).filter(f=>/^native-/.test(f.source));
    assert(nat.length===2&&nat.every(f=>f.generation===1&&/\/1\//.test(f.frameUID)),'late bundle bound to its origin generation, never relabelled current');
    // (b) bundle generation does not match the generation recorded at release -> rejected
    const e2=H.env(root,{bridge:H.nativeBridge({rel,frames:rows,generation:2,diagGeneration:1})});
    e2.seed({key:KEY,sessionId:sid,shotId,role:'side',releaseEpochMs:rel,frames:[]});
    await H.openNative(e2,1);e2.N.release({releaseEpochMs:rel},'cycle');await H.tick(400);
    assert.strictEqual((e2.get(sid,shotId).frames||[]).length,0,'mismatched-generation bundle not written');
    assert(/generation/i.test(String(e2.N.states.side.error||'')),'explicit stale-generation error');
  });
  // ---- fixed 25 = unique real frames only ----
  await check('fixed 25 with clones/readbacks: only unique real frames, Missing slots for the rest',()=>{
    const base=Array.from({length:10},(_,i)=>fr({epochMs:rel-450+i*100,offsetMs:-450+i*100,mediaTime:null,source:'sparse-jpeg',evidenceZone:'release-focus',tag:'u'+i}));
    const out=B.normalizeRecord({releaseEpochMs:rel,frames:[...base,...structuredClone(base),...structuredClone(base)]});
    assert.strictEqual(out.frames.length,10);assert.strictEqual(out.evidenceBudget.missingSlots,15);assert.strictEqual(out.reviewSlots.filter(s=>s.missing).length,15);
    assertUniqueContent(out.frames,'fixed25');
    assert.strictEqual(out.evidenceBudget.sourceFrames,10,'source count is unique frames, not clone rows');
    assert.strictEqual(B.canonicalUnique([...base,...structuredClone(base)]).length,10,'canonicalUnique dedupes readback clones');
  });
  await check('fixed 25 keeps distinct frames that share an epoch (native vs browser, no seq/media)',()=>{
    const rows=[];for(let i=0;i<15;i++){const ep=rel-700+i*100;rows.push(fr({epochMs:ep,offsetMs:ep-rel,mediaTime:null,source:'sparse-jpeg',evidenceZone:'release-focus',tag:'s'+i}));rows.push(fr({epochMs:ep,offsetMs:ep-rel,mediaTime:null,frameSeq:null,generation:1,source:'native-avfoundation-standard',evidenceZone:'release-focus',tag:'n'+i}));}
    const out=B.normalizeRecord({releaseEpochMs:rel,frames:rows});
    assert.strictEqual(out.evidenceBudget.sourceFrames,30,'30 distinct real frames');assert.strictEqual(out.frames.length,25,'25 real slots filled from 30 distinct');assertUniqueContent(out.frames,'equal-epoch');
  });
  await check('preserved: browser pipeline duplicate (sparse w/o identity vs worker <=8 ms) still folds, worker kept',()=>{
    const out=T.canonicalFrames([{epochMs:1000,blob:H.blob(1),source:'sparse-jpeg',evidenceZone:'anchor-pin'},{epochMs:1005,mediaTime:3.2,frameSeq:7,blob:H.blob(2),source:'worker-track-processor-60',evidenceZone:'release-focus'}]);
    assert.strictEqual(out.length,1);assert(/worker/.test(out[0].source));
  });
  if(failures.length){console.error('P1-08 H-02 identity FAIL\n - '+failures.join('\n - '));process.exit(1);}
  console.log('P1-08 H-02 identity PASS: null, source/generation/UID collisions, native-vs-browser, clone, IndexedDB round trip, retry, worker adapter, stale generation, fixed25');
})().catch(e=>{console.error(e);process.exit(1);});

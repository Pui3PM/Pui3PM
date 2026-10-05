'use strict';
// R8 P1-08 H-01: clock-domain-safe chronology through the production evidence path.
// Physical truth in every scenario: Release < Follow-through < Recovery (capture epochs). mediaTime values are
// LOCAL clocks of each pipeline (browser video time, worker VideoFrame time, native AVFoundation PTS).
// Usage: node app/tests/test_p108_h01_chronology.js [path-to-app/static]
const assert=require('assert'),path=require('path');
const H=require('./p108_harness');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../static'));
const failures=[];const check=async(name,fn)=>{try{await fn();}catch(e){failures.push(`${name}: ${e.message}`);}};
const rel=100000,sid=1,shotId=7,KEY=`${sid}:${shotId}:side`;
const isRecovery=f=>f.evidenceZone==='recovery-end'||(f.evidenceTags||[]).includes('recovery-end');
const isFollow=f=>!isRecovery(f)&&(f.evidenceZone==='follow-summary'||(f.evidenceTags||[]).includes('follow-summary'));
const isRelease=f=>!isRecovery(f)&&(f.evidenceZone==='release-focus'||(f.evidenceTags||[]).includes('release-focus'));
function assertPhysical(rec,label){
  const ep=rec.frames.map(f=>f.epochMs);
  for(let i=1;i<ep.length;i++)assert(ep[i]>=ep[i-1],`${label}: epoch order broken at ${i}: ${JSON.stringify(ep)}`);
  const ri=rec.frames.findIndex(isRecovery);
  if(ri>=0){rec.frames.forEach((f,i)=>{if(isRelease(f)||isFollow(f))assert(i<ri,`${label}: ${f.evidenceZone} at ${i} after Recovery at ${ri}`);});}
  // Logical review slots follow the same physical order.
  const slots=(rec.reviewSlots||[]).filter(s=>!s.missing).map(s=>s.epochMs);
  for(let i=1;i<slots.length;i++)assert(slots[i]>=slots[i-1],`${label}: review slot order broken at ${i}`);
  const seen=new Set();for(const f of rec.frames){const k=`${f.source}|${f.epochMs}`;assert(!seen.has(k),`${label}: duplicate real frame ${k}`);seen.add(k);}
}
const sparse=(epoch,media,zone,tag)=>({epochMs:epoch,offsetMs:epoch-rel,mediaTime:media,blob:H.blob(tag||('s'+epoch)),source:'sparse-jpeg',evidenceZone:zone});

(async()=>{
  const {B}=H.load(root);
  // ---- Astra core probe CLOCK-CHRONOLOGY (verbatim fixture) ----
  await check('core: native PTS + browser video time keep Release->Follow->Recovery',()=>{
    const frame=(id,epoch,media,seq,source='native-avfoundation-standard',generation=1)=>({id,epochMs:epoch,mediaTime:media,frameSeq:seq,source,generation,frameUID:id,blob:{id}});
    const mixed=[frame('release',100000,5000,500),{...frame('follow',100800,5000.8,524),evidenceZone:'follow-summary'},{...frame('recovery',102000,12,60,'native30'),evidenceZone:'recovery-end'}];
    assert.deepStrictEqual(B.normalizeRecord({releaseEpochMs:100000,frames:mixed}).frames.map(f=>f.id),['release','follow','recovery']);
  });

  // ---- mixed native + browser through native facade + frozen queue (Astra production-path mixed-clock) ----
  async function mixedScenario({lateRecovery=false,retry=false}={}){
    const rows=[0,1,2,3].map(i=>({index:i,frame_seq:i+10,epoch_ms:rel-60+i*33,capture_epoch_ms:rel-60+i*33,master_time_ms:null,media_time_ms:5000000+i*33,url:`${H.BASE}/frame/${i}`}));
    let e;
    const recovery=()=>e.merge({...e.get(sid,shotId),followThroughEndEpochMs:rel+2000,frames:[sparse(rel+2000,12,'recovery-end','rec')]});
    e=H.env(root,{bridge:H.nativeBridge({rel,frames:rows,onFrame:lateRecovery?null:recovery})});
    e.seed({key:KEY,sessionId:sid,shotId,role:'side',releaseEpochMs:rel,frames:[sparse(rel-900,9.1,'anchor-focus','live'),sparse(rel+800,9.9,'follow-summary','follow')]});
    await H.openNative(e,1);await H.releaseAndWait(e,rel);
    if(retry)await H.releaseAndWait(e,rel);
    if(lateRecovery)await recovery();
    return e;
  }
  for(const [label,opt] of [['mixed native+browser (Recovery during native download)',{}],['late Recovery after native bundle',{lateRecovery:true}],['native bundle retried',{retry:true}]]){
    await check(label,async()=>{
      const e=await mixedScenario(opt),rec=e.get(sid,shotId);
      assert(rec.frames.some(isRecovery),'Recovery frame preserved');assert.strictEqual(rec.followThroughEndEpochMs,rel+2000);
      assertPhysical(rec,label);
      const again=e.reload(sid,shotId);assertPhysical(again,label+' after DB reload');
      assert.deepStrictEqual(again.frames.map(f=>f.epochMs),rec.frames.map(f=>f.epochMs),'reload keeps chronology');
      assert.strictEqual(rec.frames.filter(f=>/^native-/.test(f.source)).length,4,'4 native frames, no retry duplicates');
    });
  }

  // ---- browser-only: worker VideoFrame clock vs video.currentTime clock (actual augmentBundle) ----
  await check('browser-only worker bundle + sparse frames + Recovery',async()=>{
    const e=H.env(root);
    e.seed({key:KEY,sessionId:sid,shotId,role:'side',releaseEpochMs:rel,followThroughEndEpochMs:rel+2000,
      frames:[sparse(rel-1500,2.0,'anchor-focus'),sparse(rel+900,4.4,'follow-summary'),sparse(rel+2000,5.5,'recovery-end','rec')]});
    const frames=Array.from({length:12},(_,i)=>({epochMs:rel-200+i*34,mediaTime:100+i/30,frameSeq:i+1,blob:H.blob('w'+i)}));
    await e.browserLayer.augmentBundle({role:'side',generation:0,release_epoch_ms:rel,mode:'worker-track-processor',raw_fps:30,reported_fps:30,dense_frame_count:12,frames});
    const rec=e.get(sid,shotId);assertPhysical(rec,'browser-only');assertPhysical(e.reload(sid,shotId),'browser-only reload');
  });

  // ---- native-only: within one native domain camera order wins even when callback epochs jitter ----
  await check('native-only domain keeps camera order under epoch jitter',()=>{
    const f=(i,ep)=>({epochMs:ep,mediaTime:5000+i/30,frameSeq:i+1,source:'native-avfoundation-standard',generation:1,blob:H.blob('n'+i)});
    const out=B.canonicalUnique([f(0,1000),f(1,1040),f(2,1035),f(3,1100)]);
    assert.deepStrictEqual(out.map(x=>x.frameSeq),[1,2,3,4]);
  });

  // ---- sparse + dense browser buffers with unrelated media bases ----
  await check('sparse + dense browser buffers ordered by capture epoch across domains',()=>{
    const rows=[sparse(rel-300,1.0,'release-focus'),{epochMs:rel-250,mediaTime:900.0,blob:H.blob('d1'),source:'native30',evidenceZone:'release-focus'},
      sparse(rel+800,2.1,'follow-summary'),{epochMs:rel+2000,mediaTime:0.2,blob:H.blob('d2'),source:'native30',evidenceZone:'recovery-end'}];
    const out=B.normalizeRecord({releaseEpochMs:rel,frames:rows});assertPhysical(out,'sparse+dense');
  });

  // ---- R7 field-trace pattern: Recovery logical slot must not come before Release/Follow slots ----
  await check('R7 trace pattern: Recovery slot after Release/Follow slots',()=>{
    const rows=[];for(let i=0;i<20;i++)rows.push({epochMs:rel-400+i*40,mediaTime:5000+i*0.04,frameSeq:i+1,source:'native-avfoundation-standard',generation:1,blob:H.blob('n'+i),evidenceZone:i<10?'release-focus':'follow-summary'});
    rows.push(sparse(rel+2000,3.0,'recovery-end','rec'));
    const out=B.normalizeRecord({releaseEpochMs:rel,frames:rows});assertPhysical(out,'trace pattern');
    const recSlot=out.reviewSlots.find(s=>!s.missing&&s.epochMs===rel+2000);assert(recSlot,'Recovery occupies a review slot');
    assert(out.reviewSlots.filter(s=>!s.missing).every(s=>s.epochMs<=rel+2000),'no slot after Recovery epoch');
    assert.strictEqual(B.isStrictChronology(out.frames),true,'budget core reports strict chronology');
  });

  // ---- media clock reset inside ONE source without a generation label (video.currentTime restart) ----
  await check('media clock reset inside one source keeps physical order',()=>{
    const rows=[sparse(rel-400,812.30,'release-focus'),sparse(rel-200,812.50,'release-focus'),sparse(rel+900,813.60,'follow-summary'),
      sparse(rel+2000,0.40,'recovery-end','rec')];                               // stream re-attached: currentTime restarted
    const out=B.normalizeRecord({releaseEpochMs:rel,frames:rows});assertPhysical(out,'media reset');
  });
  if(failures.length){console.error('P1-08 H-01 chronology FAIL\n - '+failures.join('\n - '));process.exit(1);}
  console.log('P1-08 H-01 chronology PASS: core probe, mixed native+browser, late Recovery, retry, browser-only, native-only, sparse+dense, trace pattern, media clock reset, DB reload');
})().catch(e=>{console.error(e);process.exit(1);});

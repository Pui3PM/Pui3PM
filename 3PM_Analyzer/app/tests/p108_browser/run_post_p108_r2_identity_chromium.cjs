'use strict';
// Post-P108 R2 browser gate: durable frame identity through the ACTUAL shipped evidence path in real Chromium.
//   1. frozen app.js persistFullShotEvidence() run twice on the same live buffers (sparse JPEG Blobs + dense ImageBitmaps
//      that the frozen code re-encodes to JPEG on every persist) -> the second persist must not add a single row;
//   2. a historical record stored WITHOUT FrameUIDs, read raw through IndexedDB by a layer-style snapshot (as
//      native_capture_layer / temporal_evidence_layer do) and merged back with one new frame -> exactly one row added;
//   3. two separate raw reads of that historical record carry identical FrameUIDs (deterministic read stamp);
//   4. distinct captures are never merged: equal epoch + equal byte size + same source, no generation -> two rows.
// Backend = documented test double (stub_backend.cjs). Frames are synthetic canvases, NOT camera frames.
// Usage: node app/tests/p108_browser/run_post_p108_r2_identity_chromium.cjs [chromiumPath] [staticDir]
// Exit 0 PASS, 1 FAIL, 2 BLOCKED.
const path=require('path'),fs=require('fs'),os=require('os');
let chromium;try{({chromium}=require('playwright'));}catch{console.log(JSON.stringify({status:'BLOCKED',reason:'playwright not resolvable'}));process.exit(2);}
const S=require('./stub_backend.cjs');
const exe=process.argv[2]||process.env.CHROMIUM_PATH||undefined,staticDir=path.resolve(process.argv[3]||path.join(__dirname,'../../static'));
const checks={},detail={};const ok=(k,v,d)=>{checks[k]=!!v;if(d!==undefined)detail[k]=d;};
(async()=>{
  const srv=await S.start(staticDir);const dir=fs.mkdtempSync(path.join(os.tmpdir(),'3PM r2 identity '));let ctx;
  try{ctx=await chromium.launchPersistentContext(dir,{executablePath:exe,args:['--no-sandbox','--disable-dev-shm-usage'],viewport:{width:1440,height:1000}});}
  catch(e){await srv.close();console.log(JSON.stringify({status:'BLOCKED',reason:String(e.message).split('\n')[0]}));process.exit(2);}
  const pageErrors=[];
  try{
    const p=await ctx.newPage();p.on('pageerror',e=>pageErrors.push(String(e.message).slice(0,300)));
    await p.goto(`http://127.0.0.1:${srv.port}/static/index.html`,{waitUntil:'load',timeout:30000});await p.waitForTimeout(2500);
    const versions=await p.evaluate(()=>({identity:window.FrameIdentityCore?.VERSION,writer:window.EvidenceIdentityPersistenceLayer?.version||null,budget:window.EvidenceBudgetCore?.VERSION}));
    detail.versions=versions;
    // Shared in-page helpers.
    await p.evaluate(()=>{
      window.__r2={
        hash:async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await b.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join(''),
        canvas:(i)=>{const c=new OffscreenCanvas(160,90),g=c.getContext('2d');g.fillStyle=`hsl(${(i*37)%360} 70% 50%)`;g.fillRect(0,0,160,90);g.fillStyle='#000';g.font='28px sans-serif';g.fillText(String(i),10,50);return c;},
        summary:async rec=>{const rows=rec?.frames||[];const hashes=await Promise.all(rows.map(f=>window.__r2.hash(f.blob)));
          return {n:rows.length,uids:rows.map(f=>f.frameUID||null),uniqueUIDs:new Set(rows.map(f=>f.frameUID)).size,uniqueBytes:new Set(hashes).size,sources:rows.map(f=>f.source),epochs:rows.map(f=>f.epochMs),allHaveUID:rows.every(f=>typeof f.frameUID==='string'&&f.frameUID.length>0)};},
        rawSession:async sid=>{const db=await new Promise((res,rej)=>{const r=indexedDB.open('3pm-form-analyzer-shot-evidence-v1',1);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
          const rows=await new Promise((res,rej)=>{const tx=db.transaction('shotEvidence','readonly'),r=tx.objectStore('shotEvidence').index('sessionId').getAll(Number(sid));r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});db.close();return rows;},
        rawPut:async rec=>{const db=await new Promise((res,rej)=>{const r=indexedDB.open('3pm-form-analyzer-shot-evidence-v1',1);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
          await new Promise((res,rej)=>{const tx=db.transaction('shotEvidence','readwrite');tx.objectStore('shotEvidence').put(rec);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});db.close();}
      };
    });
    // ---- 1. frozen persistFullShotEvidence twice on the same live buffers ----
    const persisted=await p.evaluate(async()=>{
      const R=window.__r2,release=Date.now()-900,sid=1,shot=11;
      liveFrameBuffers.side.length=0;liveDenseFrameBuffers.side.length=0;
      for(let i=0;i<12;i++){const ep=release-1500+i*190;liveFrameBuffers.side.push({epochMs:ep,mediaTime:40+(ep-release)/1000,blob:await R.canvas(100+i).convertToBlob({type:'image/jpeg',quality:.74})});}
      for(let i=0;i<14;i++){const ep=release-640+i*66;const bitmap=await createImageBitmap(R.canvas(i));liveDenseFrameBuffers.side.push({epochMs:ep,mediaTime:900+(ep-release)/1000,bitmap,width:bitmap.width,height:bitmap.height,source:'native-video-frame'});}
      const ok1=await persistFullShotEvidence(shot,sid,release,['side'],{});
      const first=await R.summary(await evidenceDbGet(shot,'side',sid));
      const ok2=await persistFullShotEvidence(shot,sid,release,['side'],{});
      const second=await R.summary(await evidenceDbGet(shot,'side',sid));
      return {ok1,ok2,first,second,dense:liveDenseFrameBuffers.side.length};
    });
    detail.persist={first:{n:persisted.first.n,uniqueUIDs:persisted.first.uniqueUIDs,uniqueBytes:persisted.first.uniqueBytes,native30:persisted.first.sources.filter(s=>s==='native30').length,sparse:persisted.first.sources.filter(s=>s==='sparse-jpeg').length},
      second:{n:persisted.second.n,uniqueUIDs:persisted.second.uniqueUIDs,uniqueBytes:persisted.second.uniqueBytes,native30:persisted.second.sources.filter(s=>s==='native30').length,sparse:persisted.second.sources.filter(s=>s==='sparse-jpeg').length}};
    ok('frozenPersistRan',persisted.ok1===true&&persisted.ok2===true&&persisted.first.n>=10,{ok1:persisted.ok1,ok2:persisted.ok2});
    ok('firstPersistUniqueBytes',persisted.first.uniqueBytes===persisted.first.n);
    ok('firstPersistHasNative30AndSparse',persisted.first.sources.includes('native30')&&persisted.first.sources.includes('sparse-jpeg'));
    ok('rePersistAddsNoRow',persisted.second.n===persisted.first.n,{first:persisted.first.n,second:persisted.second.n});
    ok('rePersistNoDuplicateBytes',persisted.second.uniqueBytes===persisted.second.n,{rows:persisted.second.n,uniqueBytes:persisted.second.uniqueBytes});
    ok('rePersistStableUIDs',persisted.second.allHaveUID&&persisted.second.uniqueUIDs===persisted.second.n&&persisted.first.uids.every(u=>persisted.second.uids.includes(u)));
    // ---- 2+3. historical record without FrameUID: layer-style raw snapshot + merge ----
    const hist=await p.evaluate(async()=>{
      const R=window.__r2,release=Date.now()-5000,sid=1,shot=12,key=evidenceRecordKey(sid,shot,'side');
      const frames=[];for(let i=0;i<6;i++){const ep=release-600+i*200;frames.push({epochMs:ep,offsetMs:ep-release,mediaTime:null,blob:await R.canvas(300+i).convertToBlob({type:'image/jpeg',quality:.7}),source:'sparse-jpeg',evidenceZone:i<3?'anchor-focus':'release-focus',evidenceTags:[i<3?'anchor-focus':'release-focus']});}
      await R.rawPut({key,sessionId:sid,shotId:shot,role:'side',releaseEpochMs:release,frames});        // historical writer: no FrameUID
      const readA=(await R.rawSession(sid)).find(r=>r.key===key),readB=(await R.rawSession(sid)).find(r=>r.key===key);
      const stampedA=readA.frames.map(f=>f.frameUID||null),stampedB=readB.frames.map(f=>f.frameUID||null);
      // Layer-style writer: snapshot read BEFORE the slow work, then merged through the serialized queue.
      const extra={epochMs:release+2000,offsetMs:2000,mediaTime:null,blob:await R.canvas(399).convertToBlob({type:'image/jpeg',quality:.7}),source:'sparse-jpeg',evidenceZone:'recovery-end',evidenceTags:['recovery-end']};
      await evidenceDbMerge({...readA,followThroughEndEpochMs:release+2000,frames:[...readA.frames,extra]});
      await evidenceDbMerge({...readB,frames:[...readB.frames]});                                          // second stale snapshot of the same version
      const after=await R.summary(await evidenceDbGet(shot,'side',sid));
      return {stampedA,stampedB,after};
    });
    detail.historical={stamped:hist.stampedA,after:{n:hist.after.n,uniqueBytes:hist.after.uniqueBytes,uniqueUIDs:hist.after.uniqueUIDs}};
    ok('historicalReadStampDeterministic',hist.stampedA.every(Boolean)&&JSON.stringify(hist.stampedA)===JSON.stringify(hist.stampedB)&&new Set(hist.stampedA).size===6);
    ok('historicalSnapshotMergeAddsOnlyNewFrame',hist.after.n===7,{rows:hist.after.n});
    ok('historicalNoDuplicateBytes',hist.after.uniqueBytes===hist.after.n);
    ok('historicalRowsNowDurable',hist.after.allHaveUID&&hist.after.uniqueUIDs===hist.after.n);
    // ---- 4. distinct captures with equal epoch/size/source (no generation) are never merged ----
    const neg=await p.evaluate(async()=>{
      const R=window.__r2,release=Date.now()-9000,sid=1,shot=13;const b1=new Blob([new Uint8Array([1,2,3,4])],{type:'image/jpeg'}),b2=new Blob([new Uint8Array([5,6,7,8])],{type:'image/jpeg'});
      await evidenceDbMerge({sessionId:sid,shotId:shot,role:'side',releaseEpochMs:release,frames:[{epochMs:release,offsetMs:0,mediaTime:null,blob:b1,source:'sparse-jpeg',evidenceZone:'release-focus'},{epochMs:release,offsetMs:0,mediaTime:null,blob:b2,source:'sparse-jpeg',evidenceZone:'release-focus'}]});
      return R.summary(await evidenceDbGet(shot,'side',sid));
    });
    ok('equalEpochSizeSourceNotMerged',neg.n===2&&neg.uniqueBytes===2,{rows:neg.n});
    ok('noPageErrors',pageErrors.length===0,pageErrors);
  }finally{if(ctx)await ctx.close();await srv.close();fs.rmSync(dir,{recursive:true,force:true});}
  const pass=Object.values(checks).every(Boolean);
  console.log(JSON.stringify({status:pass?'PASS':'FAIL',scope:'Linux headless Chromium, real IndexedDB, frozen app.js persist path, synthetic canvas frames, backend test double; not Mac/camera acceptance',checks,detail},null,2));
  process.exit(pass?0:1);
})().catch(e=>{console.error(e);process.exit(1);});

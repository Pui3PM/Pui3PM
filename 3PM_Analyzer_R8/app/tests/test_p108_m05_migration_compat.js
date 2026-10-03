'use strict';
// R8 P1-08 M-05: P1-07 -> P1-08 stored-record compatibility.
// evidence_budget_layer.migrateExisting() re-normalizes EVERY stored shotEvidence record at boot (~1.2 s) whenever
// evidenceBudget.version differs (P1-08 bumps VERSION), and writes it back. This test pins what that rewrite does to
// record shapes exactly as the P1-07 field build stored them (shapes captured by running the audited P1-07
// temporal/native layers through the frozen app.js queue; see docs P1-08 TEST_RESULTS, M-05 probe):
//   - no stored frame is dropped, no frame is added; the frame set is identical;
//   - stored chronology broken by P1-07 (H-01: Recovery stored before Release/Follow) is restored to capture order;
//   - re-running the migration is a no-op (idempotent);
//   - P1-07 legacy worker frames with manufactured mediaTime 0 / frameSeq 0 were already collapsed to one frame at
//     P1-07 write time; P1-08 cannot recover them (data already lost) and does not lose more.
// Usage: node app/tests/test_p108_m05_migration_compat.js [path-to-app/static]
const assert=require('assert'),path=require('path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../static'));
const B=require(path.join(root,'evidence_budget_core.js'));
const rel=100000,failures=[];
const check=(n,fn)=>{try{fn();}catch(e){failures.push(`${n}: ${e.message}`);}};
const blob=t=>new Blob([String(t).padEnd(3,'.')]);
const zone=off=>off<-150?'anchor-focus':off<=450?'release-focus':'follow-summary';
const sparse=(ep,m,z)=>({epochMs:ep,offsetMs:ep-rel,mediaTime:m,blob:blob('s'+ep),source:'sparse-jpeg',evidenceZone:z,evidenceTags:[z]});
const p107Worker=(i)=>{const ep=rel-400+i*34;return{epochMs:ep,offsetMs:ep-rel,mediaTime:+(100+i/30).toFixed(6),frameSeq:i+1,blob:blob('w'+i),source:'worker-track-processor-30',evidenceZone:zone(ep-rel),evidenceTags:[zone(ep-rel)]};};
const p107Native=(i)=>{const ep=rel-300+i*33;return{epochMs:ep,captureEpochMs:ep,masterTimeMs:null,mediaTimeMs:5000000+i*33,mediaTime:(5000000+i*33)/1000,frameSeq:i+10,offsetMs:ep-rel,blob:blob('n'+i),source:'native-avfoundation-standard',evidenceZone:zone(ep-rel),evidenceTags:[zone(ep-rel)]};};
const stored=(frames)=>({key:'1:7:side',sessionId:1,shotId:7,role:'side',releaseEpochMs:rel,followThroughEndEpochMs:rel+2000,
  frames:frames.map((f,i)=>({...f,replaySeq:i})),evidenceBudget:{version:'R8-P1-07-previous',target:25}});
const sig=r=>r.frames.map(f=>`${f.source}@${f.epochMs}`);
const recoveryLast=r=>{const i=r.frames.findIndex(f=>f.evidenceZone==='recovery-end'||(f.evidenceTags||[]).includes('recovery-end'));return i===-1||r.frames.slice(i+1).every(f=>(f.evidenceTags||[]).includes('recovery-end')||f.epochMs>=r.frames[i].epochMs);};
function migrate(rec){return B.normalizeRecord(structuredClone(rec));}
function assertCompat(name,rec){
  const before=sig(rec),mig=migrate(rec),after=sig(mig);
  assert.strictEqual(after.length,before.length,`${name}: frame count ${before.length} -> ${after.length}`);
  assert.deepStrictEqual([...after].sort(),[...before].sort(),`${name}: frame set changed`);
  const ep=mig.frames.map(f=>f.epochMs);for(let i=1;i<ep.length;i++)assert(ep[i]>=ep[i-1],`${name}: migrated order not physical at ${i}: ${ep}`);
  assert(recoveryLast(mig),`${name}: Recovery not last after migration`);
  assert.deepStrictEqual(sig(migrate(mig)),after,`${name}: migration not idempotent`);
  assert.strictEqual(mig.evidenceBudget.version,B.VERSION,`${name}: version stamp`);
  return mig;
}
// P1-07 stored order for a worker bundle merged into sparse frames: Recovery (102000) stored 2nd (H-01 defect).
check('P1-07 worker+sparse record (Recovery stored out of order)',()=>{
  const rec=stored([sparse(rel-1500,2,'anchor-focus'),sparse(rel+2000,5.5,'recovery-end'),...Array.from({length:23},(_,i)=>p107Worker(i)).filter(f=>f.epochMs<=100314),p107Worker(24)]);
  assert.strictEqual(rec.frames[1].epochMs,rel+2000,'fixture reproduces the P1-07 stored misorder');
  const mig=assertCompat('worker+sparse',rec);assert.strictEqual(mig.frames.at(-1).epochMs,rel+2000);
});
check('P1-07 native+sparse record (Follow/Recovery stored before native frames)',()=>{
  const rec=stored([sparse(rel-900,9.1,'anchor-focus'),sparse(rel+800,9.9,'follow-summary'),sparse(rel+2000,12,'recovery-end'),...Array.from({length:20},(_,i)=>p107Native(i))]);
  const mig=assertCompat('native+sparse',rec);assert.deepStrictEqual(mig.frames.slice(-2).map(f=>f.epochMs),[rel+800,rel+2000]);
});
check('P1-07 sparse-only record already in order stays byte-identical in frame order',()=>{
  const rec=stored(Array.from({length:25},(_,i)=>sparse(rel-1000+i*100,10+i*0.1,i<10?'anchor-focus':i<20?'release-focus':'follow-summary')));
  const mig=assertCompat('sparse-only',rec);assert.deepStrictEqual(sig(mig),sig(rec));
});
check('P1-07 collapsed worker-null record (single 0/0 frame) stays single, not dropped',()=>{
  const rec=stored([{...p107Worker(0),mediaTime:0,frameSeq:0}]);assertCompat('worker-null',rec);
});
// Characterization (not a defect introduced by P1-08): two P1-07 worker frames that both carry the manufactured 0/0
// clock in one source domain are indistinguishable from one re-delivered frame under the R7 contract (equal media in
// one domain = same frame). P1-07 itself collapsed them identically, so no P1-07 record can contain this pair.
check('characterization: legacy 0/0 pair collapses exactly as under P1-07',()=>{
  const rec=stored([{...p107Worker(0),mediaTime:0,frameSeq:0},{...p107Worker(1),mediaTime:0,frameSeq:0}]);
  assert.strictEqual(B.canonicalUnique(rec.frames).length,1);
});
if(failures.length){console.error('P1-08 M-05 migration compat FAIL\n - '+failures.join('\n - '));process.exit(1);}
console.log('P1-08 M-05 migration compat PASS: P1-07 stored shapes keep identical frame sets, chronology restored, idempotent');

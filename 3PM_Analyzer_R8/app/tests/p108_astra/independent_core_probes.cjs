'use strict';
const path=require('path'),fs=require('fs');
const root=path.resolve(process.argv[2]||'audit_input/3PM_Analyzer_R8_FIELD_TEST/app/static');
const T=require(path.join(root,'temporal_evidence_core.js')),B=require(path.join(root,'evidence_budget_core.js')),C=require(path.join(root,'camera_timeline_core.js'));
const result=[];function probe(id,description,expected,actual){result.push({id,description,expected,actual,invariantPass:JSON.stringify(expected)===JSON.stringify(actual)});}
const frame=(id,epoch,media,seq,source='native-avfoundation-standard',generation=1)=>({id,epochMs:epoch,mediaTime:media,frameSeq:seq,source,generation,frameUID:id,blob:{id}});
const high=Array.from({length:25},(_,i)=>frame('h'+i,100000+i*1000/240,i/240,i));
probe('PASS-HFPS','25 samples at 240 FPS, one stream',25,T.canonicalFrames(high).length);
const sameMedia=[frame('a',1000,1,1,'camera-a'),frame('b',1001,1,2,'camera-b')];
probe('ID-SOURCE','different sources and FrameUIDs sharing media time',2,T.canonicalFrames(sameMedia).length);
const gens=[frame('g1',1000,null,1,undefined,1),frame('g2',2000,null,1,undefined,2)];
probe('ID-GENERATION','different generation, equal source and sequence',2,B.canonicalUnique(gens).length);
const mixed=[frame('release',100000,5000,500),{...frame('follow',100800,5000.8,524),evidenceZone:'follow-summary'},{...frame('recovery',102000,12,60,'native30'),evidenceZone:'recovery-end'}];
probe('CLOCK-CHRONOLOGY','native PTS and browser video time are different domains; physical epoch order', ['release','follow','recovery'],B.normalizeRecord({releaseEpochMs:100000,frames:mixed}).frames.map(f=>f.id));
probe('NULL-TARGET','unknown alignment target must not match a real frame',null,C.nearestFrame([{masterTimeMs:0,frameSeq:1}],null));
probe('NULL-SLOT','null master clock must fall back to epoch, not 0',1000,C.logicalSlotAlignment([{masterTimeMs:null,epochMs:1000}],{} )[0].targetMs);
const original={epochMs:1000,mediaTime:null,frameSeq:null,blob:new Blob(['same original frame']),source:'sparse-jpeg'};
const cloned=structuredClone(original);
probe('ID-CLONE','a stored frame plus its readback clone is one frame',1,B.canonicalUnique([original,cloned]).length);
const workerInput=Array.from({length:25},(_,i)=>({epochMs:1000+i*34,mediaTime:null,frameSeq:null,blob:{i}}));
// This expression is verbatim from augmentBundle mapping; the full VM probe separately executes that function.
const mapped=workerInput.map(f=>({...f,mediaTime:Number.isFinite(Number(f.mediaTime))?Number(f.mediaTime):null,frameSeq:Number.isFinite(Number(f.frameSeq))?Number(f.frameSeq):null,source:'worker-track-processor-30'}));
probe('WORKER-NULL-MAPPING','unknown worker identity survives production mapping',25,T.mergeEvidence([],mapped,1000).length);
console.log(JSON.stringify(result,null,2));

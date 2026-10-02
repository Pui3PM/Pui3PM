'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=process.argv[2]||path.join(__dirname,'../static'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const B=require(path.join(root,'evidence_budget_core.js')),records=new Map(),pending=new Map(),early=new Map(),attempts=[],timers=[];
const key=(s,id,r)=>`${s}:${id}:${r}`;const rel=100000;
const ctx={console,Promise,Map,Set,Date,Math,Number,Array,Object,JSON,queueMicrotask,
 document:{readyState:'loading',addEventListener(){}},navigator:{},window:{EvidenceBudgetCore:B,TemporalEvidenceCore:require(path.join(root,'temporal_evidence_core.js')),dispatchEvent(){},FormAnalyzer:{getCurrentSessionId:()=>1}},
 CustomEvent:function(t,o){this.type=t;this.detail=o?.detail;},setTimeout:fn=>{timers.push(fn);return 1;},setInterval:()=>0,
 evidenceRecordKey:key,evidenceDbGet:async(id,role,sid)=>structuredClone(records.get(key(sid,id,role))||null),
 evidenceDbPut:async r=>{records.set(r.key,structuredClone(B.normalizeRecord(r)));return true;},
 calibrationEvidenceVerifiedShots:new Set(),calibrationEvidenceComplete:(id,r)=>r.contractOK===true,renderBaselineCalibration(){},
 pendingFollowEvidence:pending,earlyRecoveryEvents:early,compactTrajectoryMetric:x=>x,
 registerPendingFollowEvidence(){},finalizeFollowEvidenceFromMetrics(){},
 extendFullShotEvidenceToRecovery:async(c,end)=>{attempts.push({...c,end});for(const role of c.roles){const k=key(c.sessionId,c.shotId,role),r=records.get(k);if(r)r.followThroughEndEpochMs=end;}return true;}
};
vm.createContext(ctx);
const app=read('app.js'),start=app.indexOf('const evidenceWriteChains=new Map();'),end=app.indexOf('async function evidenceDbDeleteShot(',start);
vm.runInContext(app.slice(start,end),ctx); // Execute the shipped frozen write queue, not a reimplementation.
vm.runInContext(read('temporal_evidence_layer.js'),ctx);
(async()=>{
 const base={contractOK:true,key:key(1,2,'side'),sessionId:1,shotId:2,role:'side',releaseEpochMs:rel,frames:[{epochMs:rel,offsetMs:0,mediaTime:null,blob:{i:1}}]};
 records.set(base.key,structuredClone(base));const stale=structuredClone(base);
 await ctx.evidenceDbMerge({...base,followThroughEndEpochMs:rel+2000,frames:[{epochMs:rel+2000,offsetMs:2000,mediaTime:null,blob:{i:2},evidenceZone:'recovery-end'}]});
 assert.equal(records.get(base.key).frames.length,2,'missing mediaTime is not a common frame id');
 await ctx.window.TemporalEvidenceLayer.putRecord(stale);
 assert(ctx.calibrationEvidenceVerifiedShots.has(2),'complete record must refresh calibration');
 await ctx.evidenceDbPut({...records.get(base.key),contractOK:false});assert(!ctx.calibrationEvidenceVerifiedShots.has(2),'later incomplete record must remove stale calibration eligibility');
 const result=records.get(base.key);assert.equal(result.followThroughEndEpochMs,rel+2000,'late temporal bundle must not erase Recovery');assert(result.frames.some(f=>f.evidenceZone==='recovery-end'));
 // Early Recovery from an uncaptured previous cycle has the SAME tracker event id=1.
 ctx.finalizeFollowEvidenceFromMetrics({role:'side',releaseEventId:1,releaseEpochMs:rel-5000,followThroughEnded:true,followThroughEndEpochMs:rel-2000});
 ctx.registerPendingFollowEvidence(2,1,{role:'side',releaseEventId:1,releaseEpochMs:rel},['side']);
 await new Promise(setImmediate);assert.equal(attempts.length,0,'reused event id must never join different cycles');
 ctx.finalizeFollowEvidenceFromMetrics({role:'rear',releaseEventId:1,releaseEpochMs:rel,followThroughEnded:true,followThroughEndEpochMs:rel+2000});assert.equal(attempts.length,0,'auxiliary cannot finalize Side');
 ctx.finalizeFollowEvidenceFromMetrics({role:'side',releaseEventId:1,releaseEpochMs:rel,followThroughEnded:true,followThroughEndEpochMs:rel+2000});
 await new Promise(setImmediate);assert.equal(attempts.length,1);assert.equal(pending.size,0);
 // Reverse event order: recovery can arrive while backend creation/uploads are awaiting network.
 ctx.finalizeFollowEvidenceFromMetrics({role:'side',releaseEventId:1,releaseEpochMs:rel+7000,followThroughEnded:true,followThroughEndEpochMs:rel+9000});
 records.set(key(1,3,'side'),{...base,key:key(1,3,'side'),shotId:3,releaseEpochMs:rel+7000});
 ctx.registerPendingFollowEvidence(3,1,{role:'side',releaseEventId:1,releaseEpochMs:rel+7000},['side']);
 await new Promise(setImmediate);assert.equal(attempts.length,2);assert.equal(pending.size,0);assert.equal(records.get(key(1,3,'side')).followThroughEndEpochMs,rel+9000);
 // A failed write retains its context and retries; it is not falsely reported as finalized.
 let calls=0;ctx.extendFullShotEvidenceToRecovery=async(c,e)=>{if(++calls===1)throw new Error('injected disk failure');records.get(key(1,4,'side')).followThroughEndEpochMs=e;};
 records.set(key(1,4,'side'),{...base,key:key(1,4,'side'),shotId:4,releaseEpochMs:rel+10000});
 ctx.registerPendingFollowEvidence(4,1,{role:'side',releaseEventId:1,releaseEpochMs:rel+10000},['side']);
 ctx.finalizeFollowEvidenceFromMetrics({role:'side',releaseEpochMs:rel+10000,followThroughEnded:true,followThroughEndEpochMs:rel+12000});
 await new Promise(setImmediate);assert.equal(pending.size,1);assert.equal(timers.length,1);timers.shift()();await new Promise(setImmediate);assert.equal(pending.size,0);assert.equal(calls,2);
 console.log('R7 persistence PASS: frozen queue + temporal writer, stale overwrite, null media, reused id, early/late Recovery, role isolation, failed-write retry');
})().catch(e=>{console.error(e);process.exitCode=1;});

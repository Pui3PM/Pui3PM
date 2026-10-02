'use strict';
const assert=require('assert');
const {RoleRing}=require('../../shadow/ring/role_ring');
const {AnalysisScheduler}=require('../../shadow/scheduler/priority_scheduler');
const F=require('./_shadow_fixture');
function tick(ms=0){return new Promise(r=>setTimeout(r,ms));}
(async()=>{
 const ring=new RoleRing({role:'side',retentionUs:10000,byteBudget:100,maxLeasedBytes:90,leaseTtlUs:100000});
 const f1=F.frame(1,{mappedMasterTime:1000}),f2=F.frame(2,{mappedMasterTime:1500}),f3=F.frame(3,{mappedMasterTime:2501});
 ring.add(f1,{byteLength:40});const lease=ring.lease(f1.frameUID);ring.add(f2,{byteLength:40});const lease2=ring.lease(f2.frameUID);assert.deepEqual(ring.add(f3,{byteLength:40}),{admitted:false,reason:'capacity_pinned'});assert(ring.totalBytes<=100);lease.release();lease2.release();ring.advance(12000);assert.equal(ring.totalBytes,0);
 const conflict=F.frame(4,{mappedMasterTime:13000,contentDigest:'a'.repeat(64)});ring.add(conflict,{byteLength:10});assert.throws(()=>ring.add({...conflict,contentDigest:'b'.repeat(64)},{byteLength:10}),/FRAME_UID_CONFLICT/);
 const leakRing=new RoleRing({role:'side',retentionUs:10,byteBudget:20,maxLeasedBytes:15,leaseTtlUs:5});const lf=F.frame(10,{mappedMasterTime:0});leakRing.add(lf,{byteLength:10});leakRing.lease(lf.frameUID);leakRing.advance(100);assert.equal(leakRing.totalBytes,0);

 const outcomes=[],drops=[],pending=new Map();const executor=(d)=>{if(d.messageType==='hang')return new Promise(()=>{});if(d.messageType==='gate')return new Promise(r=>pending.set(d.payloadRef,r));return Promise.resolve(d.messageType);};
 const s=new AnalysisScheduler({executor,jobTimeoutMs:30,onDrop:(j,r)=>drops.push([j.role,j.meta.id,r]),onOutcome:(j,st)=>outcomes.push([j.meta.id,st])});
 assert.throws(()=>s.submit('overhead',()=>{},{}),/does not accept functions/);
 s.submit('overhead',{workerId:'w',messageType:'gate',payloadRef:'aux'},{id:'a',generation:'g'});await tick(1);s.submit('side',{workerId:'w',messageType:'side',payloadRef:null},{id:'s',generation:'g'});await tick(5);assert(outcomes.some(x=>x[0]==='s'&&x[1]==='completed'));
 pending.get('aux')?.();await tick(2);
 s.submit('side',{workerId:'w',messageType:'hang',payloadRef:null},{id:'hang',generation:'g1'});s.submit('side',{workerId:'w',messageType:'next',payloadRef:null},{id:'next',generation:'g2'});s.cancelGeneration('g1');await tick(45);assert(outcomes.some(x=>x[0]==='hang'&&['timed_out','stale_discarded'].includes(x[1])));await tick(5);assert(outcomes.some(x=>x[0]==='next'&&x[1]==='completed'));
 let unhandled=false;const h=()=>{unhandled=true;};process.once('unhandledRejection',h);const s2=new AnalysisScheduler({executor:async()=>1,onOutcome:()=>{throw new Error('observer');}});s2.submit('side',{workerId:'w',messageType:'ok',payloadRef:null},{id:'o'});await tick(5);process.removeListener('unhandledRejection',h);assert.equal(unhandled,false);assert.equal(s2.snapshot().metrics.observerErrors,1);
 console.log('P1-03 ring + descriptor scheduler hardened: PASS');
})().catch(e=>{console.error(e);process.exit(1);});

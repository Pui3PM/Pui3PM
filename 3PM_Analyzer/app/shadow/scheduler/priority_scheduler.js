'use strict';
const {immutablePlainCopy}=require('../contracts/strict_types');
// S-09: a descriptor crosses a Worker boundary, so it must be plain data all the way down
// (no functions/symbols/class instances/undefined/non-finite numbers at any depth). A frozen deep copy is used.
function isPlainObject(v){return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;}
function validateDescriptor(d){
  if(!isPlainObject(d)||typeof d.workerId!=='string'||!d.workerId||typeof d.messageType!=='string'||!d.messageType||!(d.payloadRef===null||typeof d.payloadRef==='string'))throw new TypeError('scheduler requires serializable worker descriptor');
  for(const v of Object.values(d))if(typeof v==='function')throw new TypeError('scheduler descriptor must not contain functions');
  try{return immutablePlainCopy(d);}catch(e){throw new TypeError(`scheduler descriptor must be plain serializable data (no nested functions/symbols/class instances): ${e.message}`);}
}
const CANCELLED_GENERATIONS_RETAINED=64;
// S-08: one job slot with an explicit cancellation contract.
// executor(descriptor, meta, {signal, jobId}) receives an AbortSignal that is aborted on timeout or stale-generation
// cancel; a real Worker executor must forward it (post a cancel keyed by jobId / terminate the worker).
// A job that timed out and has not settled keeps the lane `degraded`: further jobs are dropped as
// `worker_unresponsive` instead of piling more work onto a hung worker. A job aborted because its generation was
// cancelled frees the lane at once (the newer generation must not wait on a superseded one); such abandoned
// in-flight jobs are capped by maxCancelledInFlight, beyond which the lane is degraded as well.
class JobSlot{
  constructor(name,{execute,timeoutMs,maxOutstanding,maxCancelledInFlight,outcome,metrics}){
    this.name=name;this.execute=execute;this.timeoutMs=timeoutMs;this.maxOutstanding=maxOutstanding;this.maxCancelledInFlight=maxCancelledInFlight;this.outcome=outcome;this.metrics=metrics;
    this.current=null;this.timedOutUnsettled=0;this.cancelledUnsettled=0;this.peakRunning=0;this.seq=0;this.onFree=null;
  }
  get active(){return !!this.current;}
  // Outstanding executor work = the current job + timed-out jobs that never settled (bounded by maxOutstanding).
  get outstanding(){return (this.current?1:0)+this.timedOutUnsettled;}
  get degraded(){return !this.current&&(this.timedOutUnsettled>=this.maxOutstanding||this.cancelledUnsettled>=this.maxCancelledInFlight);}
  canStart(){return !this.current&&this.timedOutUnsettled<this.maxOutstanding&&this.cancelledUnsettled<this.maxCancelledInFlight;}
  start(job){
    const controller=typeof AbortController==='function'?new AbortController():null;const run={job,controller,state:'running',timer:null,jobId:`${this.name}:${++this.seq}`};
    this.current=run;this.peakRunning=Math.max(this.peakRunning,1+this.timedOutUnsettled+this.cancelledUnsettled);
    run.timer=setTimeout(()=>{if(run.state!=='running')return;run.state='timed_out';this.timedOutUnsettled++;this._abort(run,'SCHEDULER_JOB_TIMEOUT');const e=new Error('SCHEDULER_JOB_TIMEOUT');e.code='SCHEDULER_JOB_TIMEOUT';this.outcome(job,'timed_out',e);this._free(run);},this.timeoutMs);
    Promise.resolve().then(()=>this.execute(job.descriptor,job.meta,{signal:controller?controller.signal:null,jobId:run.jobId})).then(v=>this._settle(run,true,v),e=>this._settle(run,false,e));
  }
  cancelRunning(generation){
    const run=this.current;if(!run||run.state!=='running'||generation==null||run.job.meta?.generation!==generation)return false;
    run.state='cancelled';this.cancelledUnsettled++;clearTimeout(run.timer);this._abort(run,'SCHEDULER_GENERATION_CANCELLED');this.outcome(run.job,'stale_discarded',null);this._free(run);return true;
  }
  _abort(run,reason){this.metrics.aborted++;try{run.controller?.abort(reason);}catch{}}
  _settle(run,ok,value){
    if(run.state==='running'){run.state='settled';clearTimeout(run.timer);this.outcome(run.job,ok?'completed':'failed',value,{stalenessCheck:true});this._free(run);return;}
    // Late settle of a timed-out or cancelled job: release its capacity; never report a second outcome.
    this.metrics.lateSettled++;if(run.state==='timed_out')this.timedOutUnsettled--;else if(run.state==='cancelled')this.cancelledUnsettled--;run.state='settled';this.onFree?.();
  }
  _free(run){if(this.current===run)this.current=null;this.onFree?.();}
}
class LatestLane{
  constructor(name,{onDrop,slot}){this.name=name;this.onDrop=onDrop;this.slot=slot;this.pending=null;slot.onFree=()=>this._pump();}
  get active(){return this.slot.active;}
  submit(job){
    if(!job||!job.descriptor)throw new TypeError('descriptor required');
    if(this.slot.canStart()&&!this.pending){this.slot.start(job);return {accepted:true,replaced:false};}
    if(this.slot.degraded){this.onDrop(job,'worker_unresponsive');return {accepted:false,replaced:false,dropped:'worker_unresponsive'};}
    const replaced=!!this.pending;if(replaced)this.onDrop(this.pending,'replaced_by_latest');this.pending=job;return {accepted:true,replaced};
  }
  cancelGeneration(generation){if(this.pending&&this.pending.meta?.generation===generation){this.onDrop(this.pending,'generation_cancelled');this.pending=null;}this.slot.cancelRunning(generation);}
  _pump(){if(!this.pending)return;if(this.slot.canStart()){const n=this.pending;this.pending=null;this.slot.start(n);}else if(this.slot.degraded){const n=this.pending;this.pending=null;this.onDrop(n,'worker_unresponsive');}}
}
class AnalysisScheduler{
  constructor({onDrop=null,onOutcome=null,executor=null,jobTimeoutMs=1000,maxOutstanding=1,maxCancelledInFlight=4}={}){
    if(typeof executor!=='function')executor=async()=>{throw new Error('SCHEDULER_EXECUTOR_UNAVAILABLE');};
    if(!Number.isInteger(jobTimeoutMs)||jobTimeoutMs<1)throw new TypeError('jobTimeoutMs required');
    if(!Number.isInteger(maxOutstanding)||maxOutstanding<1||!Number.isInteger(maxCancelledInFlight)||maxCancelledInFlight<1)throw new TypeError('maxOutstanding/maxCancelledInFlight must be positive integers');
    this.cancelledGenerations=new Set();this.metrics={sideSubmitted:0,auxSubmitted:0,droppedPending:0,failed:0,completed:0,timedOut:0,staleDiscarded:0,observerErrors:0,workerUnresponsiveDrops:0,aborted:0,lateSettled:0};
    this._safeDrop=(job,reason)=>{this.metrics.droppedPending++;if(reason==='worker_unresponsive')this.metrics.workerUnresponsiveDrops++;try{onDrop?.(job,reason);}catch{this.metrics.observerErrors++;}};
    const isCancelled=g=>g!=null&&this.cancelledGenerations.has(g);this.isCancelled=isCancelled;
    this._safeOutcome=(job,status,value,{stalenessCheck=false}={})=>{if(stalenessCheck&&isCancelled(job.meta?.generation))status='stale_discarded';if(status==='failed')this.metrics.failed++;else if(status==='timed_out')this.metrics.timedOut++;else if(status==='stale_discarded')this.metrics.staleDiscarded++;else this.metrics.completed++;try{onOutcome?.(job,status,value);}catch{this.metrics.observerErrors++;}};
    this.executor=executor;this.jobTimeoutMs=jobTimeoutMs;
    const slotOpts={execute:executor,timeoutMs:jobTimeoutMs,maxOutstanding,maxCancelledInFlight,outcome:this._safeOutcome,metrics:this.metrics};
    // Side and aux run in separate slots: Side never waits on aux work, and a hung aux worker never degrades Side.
    this.side=new LatestLane('side',{onDrop:this._safeDrop,slot:new JobSlot('side',slotOpts)});
    this.auxSlot=new JobSlot('aux',slotOpts);this.auxSlot.onFree=()=>this._pumpAux();this.auxPending={overhead:null,rear:null};this.auxTurn='overhead';
  }
  get auxActive(){return this.auxSlot.active;}
  submit(role,descriptor,meta={}){
    if(typeof descriptor==='function')throw new TypeError('scheduler does not accept functions');const desc=validateDescriptor(descriptor);if(meta.dispatchKind!==undefined&&meta.dispatchKind!=='worker-dispatch')throw new TypeError('invalid dispatchKind');const job={role,descriptor:desc,meta:{...meta,dispatchKind:'worker-dispatch'}};
    if(role==='side'){this.metrics.sideSubmitted++;return this.side.submit(job);}if(!['overhead','rear'].includes(role))throw new TypeError('invalid role');this.metrics.auxSubmitted++;
    if(this.auxSlot.canStart()&&!this.auxPending.overhead&&!this.auxPending.rear){this._startAux(job);return {accepted:true,replaced:false};}
    if(this.auxSlot.degraded){this._safeDrop(job,'worker_unresponsive');return {accepted:false,replaced:false,dropped:'worker_unresponsive'};}
    const replaced=!!this.auxPending[role];if(replaced)this._safeDrop(this.auxPending[role],'replaced_by_latest');this.auxPending[role]=job;return {accepted:true,replaced};
  }
  cancelGeneration(generation){
    if(generation==null)return;this.cancelledGenerations.delete(generation);this.cancelledGenerations.add(generation);
    while(this.cancelledGenerations.size>CANCELLED_GENERATIONS_RETAINED)this.cancelledGenerations.delete(this.cancelledGenerations.values().next().value);
    this.side.cancelGeneration(generation);for(const role of ['overhead','rear'])if(this.auxPending[role]?.meta?.generation===generation){this._safeDrop(this.auxPending[role],'generation_cancelled');this.auxPending[role]=null;}this.auxSlot.cancelRunning(generation);
  }
  _startAux(job){this.auxTurn=job.role==='overhead'?'rear':'overhead';this.auxSlot.start(job);}
  _pumpAux(){
    const first=this.auxPending[this.auxTurn]?this.auxTurn:(this.auxPending.overhead?'overhead':this.auxPending.rear?'rear':null);if(!first)return;
    if(this.auxSlot.canStart()){const n=this.auxPending[first];this.auxPending[first]=null;this._startAux(n);}
    else if(this.auxSlot.degraded){for(const r of ['overhead','rear'])if(this.auxPending[r]){const n=this.auxPending[r];this.auxPending[r]=null;this._safeDrop(n,'worker_unresponsive');}}
  }
  snapshot(){return Object.freeze({metrics:Object.freeze({...this.metrics}),sideActive:this.side.active,sidePending:!!this.side.pending,sideDegraded:this.side.slot.degraded,auxActive:this.auxSlot.active,auxDegraded:this.auxSlot.degraded,auxPending:Object.freeze({overhead:!!this.auxPending.overhead,rear:!!this.auxPending.rear}),peakRunning:Object.freeze({side:this.side.slot.peakRunning,aux:this.auxSlot.peakRunning}),cancelledGenerations:Object.freeze([...this.cancelledGenerations])});}
}
module.exports={AnalysisScheduler,validateDescriptor,CANCELLED_GENERATIONS_RETAINED};

'use strict';
function isPlainObject(v){return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;}
function validateDescriptor(d){if(!isPlainObject(d)||typeof d.workerId!=='string'||!d.workerId||typeof d.messageType!=='string'||!d.messageType||!(d.payloadRef===null||typeof d.payloadRef==='string'))throw new TypeError('scheduler requires serializable worker descriptor');for(const v of Object.values(d))if(typeof v==='function')throw new TypeError('scheduler descriptor must not contain functions');return Object.freeze({...d});}
class LatestLane{
  constructor(name,{onDrop,onOutcome,execute,timeoutMs,isCancelled}){this.name=name;this.onDrop=onDrop;this.onOutcome=onOutcome;this.execute=execute;this.timeoutMs=timeoutMs;this.isCancelled=isCancelled;this.active=false;this.pending=null;this.generation=null;this.token=0;}
  submit(job){if(!job||!job.descriptor)throw new TypeError('descriptor required');if(!this.active){this._start(job);return {accepted:true,replaced:false};}const replaced=!!this.pending;if(replaced)this.onDrop(this.pending,'replaced_by_latest');this.pending=job;return {accepted:true,replaced};}
  cancelGeneration(generation){if(this.pending&&this.pending.meta?.generation===generation){this.onDrop(this.pending,'generation_cancelled');this.pending=null;}}
  _start(job){
    this.active=true;this.generation=job.meta?.generation??null;const myToken=++this.token;let timer=null;
    const timeout=new Promise((_,rej)=>{timer=setTimeout(()=>{const e=new Error('SCHEDULER_JOB_TIMEOUT');e.code='SCHEDULER_JOB_TIMEOUT';rej(e);},this.timeoutMs);});
    Promise.race([Promise.resolve().then(()=>this.execute(job.descriptor,job.meta)),timeout]).then(v=>{
      if(this.isCancelled(job.meta?.generation))this.onOutcome(job,'stale_discarded',v);else this.onOutcome(job,'completed',v);
    },e=>{if(e&&e.code==='SCHEDULER_JOB_TIMEOUT')this.onOutcome(job,'timed_out',e);else if(this.isCancelled(job.meta?.generation))this.onOutcome(job,'stale_discarded',e);else this.onOutcome(job,'failed',e);}).finally(()=>{
      if(timer)clearTimeout(timer);if(myToken!==this.token)return;this.active=false;this.generation=null;const next=this.pending;this.pending=null;if(next)this._start(next);
    });
  }
}
class AnalysisScheduler{
  constructor({onDrop=null,onOutcome=null,executor=null,jobTimeoutMs=1000}={}){
    if(typeof executor!=='function')executor=async()=>{throw new Error('SCHEDULER_EXECUTOR_UNAVAILABLE');};
    if(!Number.isInteger(jobTimeoutMs)||jobTimeoutMs<1)throw new TypeError('jobTimeoutMs required');
    this.cancelledGenerations=new Set();this.metrics={sideSubmitted:0,auxSubmitted:0,droppedPending:0,failed:0,completed:0,timedOut:0,staleDiscarded:0,observerErrors:0};
    this._safeDrop=(job,reason)=>{this.metrics.droppedPending++;try{onDrop?.(job,reason);}catch{this.metrics.observerErrors++;}};
    this._safeOutcome=(job,status,value)=>{if(status==='failed')this.metrics.failed++;else if(status==='timed_out')this.metrics.timedOut++;else if(status==='stale_discarded')this.metrics.staleDiscarded++;else this.metrics.completed++;try{onOutcome?.(job,status,value);}catch{this.metrics.observerErrors++;}};
    const isCancelled=g=>g!=null&&this.cancelledGenerations.has(g);this.executor=executor;this.jobTimeoutMs=jobTimeoutMs;
    this.side=new LatestLane('side',{onDrop:this._safeDrop,onOutcome:this._safeOutcome,execute:executor,timeoutMs:jobTimeoutMs,isCancelled});this.auxActive=false;this.auxToken=0;this.auxPending={overhead:null,rear:null};this.auxTurn='overhead';this.isCancelled=isCancelled;
  }
  submit(role,descriptor,meta={}){
    if(typeof descriptor==='function')throw new TypeError('scheduler does not accept functions');const desc=validateDescriptor(descriptor);if(meta.dispatchKind!==undefined&&meta.dispatchKind!=='worker-dispatch')throw new TypeError('invalid dispatchKind');const job={role,descriptor:desc,meta:{...meta,dispatchKind:'worker-dispatch'}};
    if(role==='side'){this.metrics.sideSubmitted++;return this.side.submit(job);}if(!['overhead','rear'].includes(role))throw new TypeError('invalid role');this.metrics.auxSubmitted++;if(!this.auxActive){this._startAux(job);return {accepted:true,replaced:false};}const replaced=!!this.auxPending[role];if(replaced)this._safeDrop(this.auxPending[role],'replaced_by_latest');this.auxPending[role]=job;return {accepted:true,replaced};
  }
  cancelGeneration(generation){if(generation==null)return;this.cancelledGenerations.add(generation);this.side.cancelGeneration(generation);for(const role of ['overhead','rear'])if(this.auxPending[role]?.meta?.generation===generation){this._safeDrop(this.auxPending[role],'generation_cancelled');this.auxPending[role]=null;}}
  _startAux(job){
    this.auxActive=true;this.auxTurn=job.role==='overhead'?'rear':'overhead';const token=++this.auxToken;let timer=null;const timeout=new Promise((_,rej)=>{timer=setTimeout(()=>{const e=new Error('SCHEDULER_JOB_TIMEOUT');e.code='SCHEDULER_JOB_TIMEOUT';rej(e);},this.jobTimeoutMs);});
    Promise.race([Promise.resolve().then(()=>this.executor(job.descriptor,job.meta)),timeout]).then(v=>{this._safeOutcome(job,this.isCancelled(job.meta?.generation)?'stale_discarded':'completed',v);},e=>{this._safeOutcome(job,e?.code==='SCHEDULER_JOB_TIMEOUT'?'timed_out':this.isCancelled(job.meta?.generation)?'stale_discarded':'failed',e);}).finally(()=>{if(timer)clearTimeout(timer);if(token!==this.auxToken)return;this.auxActive=false;const first=this.auxPending[this.auxTurn]?this.auxTurn:(this.auxPending.overhead?'overhead':this.auxPending.rear?'rear':null);if(first){const n=this.auxPending[first];this.auxPending[first]=null;this._startAux(n);}});
  }
  snapshot(){return Object.freeze({metrics:Object.freeze({...this.metrics}),sideActive:this.side.active,sidePending:!!this.side.pending,auxActive:this.auxActive,auxPending:Object.freeze({overhead:!!this.auxPending.overhead,rear:!!this.auxPending.rear}),cancelledGenerations:Object.freeze([...this.cancelledGenerations])});}
}
module.exports={AnalysisScheduler,validateDescriptor};

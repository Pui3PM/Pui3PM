// 3PM Native Vision Shadow Core v1
// Pure comparison/telemetry helpers. Shadow data must never drive shot decisions.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.NativeVisionShadowCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='3PM-native-vision-shadow-core-v1';
  const METRICS=[
    {production:'shoulderLineDeg',native:'shoulderLineDeg',key:'shoulder_line_deg',periodic180:true},
    {production:'bowArm2DDeg',native:'bowArm2DDeg',key:'bow_arm_2d_deg'},
    {production:'drawElbow2DDeg',native:'drawElbow2DDeg',key:'draw_elbow_2d_deg'}
  ];
  const finite=v=>Number.isFinite(Number(v));
  function percentile(xs,p){
    const a=(xs||[]).filter(finite).map(Number).sort((x,y)=>x-y);if(!a.length)return null;
    const i=Math.max(0,Math.min(a.length-1,Math.round((a.length-1)*p)));return a[i];
  }
  function median(xs){return percentile(xs,.5);}
  function angleDelta(a,b,periodic180=false){
    if(!finite(a)||!finite(b))return null;
    let d=Math.abs(Number(a)-Number(b));
    if(periodic180){d%=180;if(d>90)d=180-d;}
    return d;
  }
  function compare(production,nativeSample,maxEpochDeltaMs=350){
    if(!production||!nativeSample?.available)return null;
    const pEpoch=Number(production.epochMs),nEpoch=Number(nativeSample.epoch_ms);
    if(!finite(pEpoch)||!finite(nEpoch))return null;
    const epochDeltaMs=Math.abs(pEpoch-nEpoch);if(epochDeltaMs>maxEpochDeltaMs)return null;
    const ng=nativeSample.geometry||{},deltas={};let comparable=0;
    for(const m of METRICS){const d=angleDelta(production[m.production],ng[m.native],!!m.periodic180);if(d!==null){deltas[m.key]=d;comparable++;}}
    return {version:VERSION,role:production.role||nativeSample.role||'side',epoch_delta_ms:epochDeltaMs,comparable_metrics:comparable,deltas,native_latency_ms:finite(nativeSample.latency_ms)?Number(nativeSample.latency_ms):null,native_body_quality:finite(nativeSample.body_quality)?Number(nativeSample.body_quality):null,hand_pose_active:!!nativeSample.hand_pose_active,phase:production.phase||nativeSample.phase_hint||null};
  }
  function fresh(){return{version:VERSION,samples:0,matched:0,last:null,latency:[],epochDelta:[],deltas:{shoulder_line_deg:[],bow_arm_2d_deg:[],draw_elbow_2d_deg:[]},phaseCounts:{}};}
  function update(state,comparison){
    const s=state||fresh();s.samples++;
    if(!comparison)return s;
    s.matched++;s.last=comparison;
    if(finite(comparison.native_latency_ms))s.latency.push(Number(comparison.native_latency_ms));
    if(finite(comparison.epoch_delta_ms))s.epochDelta.push(Number(comparison.epoch_delta_ms));
    for(const [k,v] of Object.entries(comparison.deltas||{})){if(!s.deltas[k])s.deltas[k]=[];if(finite(v))s.deltas[k].push(Number(v));}
    if(comparison.phase)s.phaseCounts[comparison.phase]=(s.phaseCounts[comparison.phase]||0)+1;
    for(const a of [s.latency,s.epochDelta,...Object.values(s.deltas)])if(a.length>600)a.splice(0,a.length-600);
    return s;
  }
  function summary(s){
    s=s||fresh();const metric={};for(const [k,a] of Object.entries(s.deltas||{}))metric[k]={median_abs_delta_deg:median(a),p95_abs_delta_deg:percentile(a,.95),n:a.length};
    return{version:VERSION,samples:s.samples,matched:s.matched,match_rate:s.samples?s.matched/s.samples:0,native_latency_ms:{median:median(s.latency),p95:percentile(s.latency,.95),n:s.latency.length},epoch_delta_ms:{median:median(s.epochDelta),p95:percentile(s.epochDelta,.95),n:s.epochDelta.length},metric_delta:metric,phase_counts:{...s.phaseCounts},last:s.last?JSON.parse(JSON.stringify(s.last)):null};
  }
  return{VERSION,METRICS,angleDelta,compare,fresh,update,summary,median,percentile};
});

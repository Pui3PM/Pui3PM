// 3PM BLE4.3.7.1 UI Stability Core
// Pure helpers only. No camera, pose, capture, or detector side effects.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.UIStabilityCore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const ORDER=['Setup','Set','Draw','Anchor','Aim / Hold','Expansion','Release','Follow Through','Recovery'];
  const ALIAS={
    'aim/hold':'Aim / Hold','aim / hold':'Aim / Hold','hold':'Aim / Hold',
    'follow-through':'Follow Through','follow through':'Follow Through','followthrough':'Follow Through',
    'setup':'Setup','set':'Set','draw':'Draw','anchor':'Anchor','expansion':'Expansion','release':'Release','recovery':'Recovery'
  };
  function phaseName(v){
    const s=String(v??'').trim();
    if(!s)return null;
    const k=s.toLowerCase();
    return ALIAS[k]||ORDER.find(x=>x.toLowerCase()===k)||null;
  }
  function coachPhaseSummary(entries){
    const seen=new Map();
    for(const e of Array.isArray(entries)?entries:[]){
      const phase=phaseName(typeof e==='string'?e:e?.phase);
      if(!phase)continue;
      const current=seen.get(phase)||{phase,count:0};
      current.count++;
      seen.set(phase,current);
    }
    return ORDER.filter(p=>seen.has(p)).map(p=>seen.get(p));
  }
  function stableMetricSnapshot(values){
    const out={};
    for(const [k,v] of Object.entries(values||{}))out[k]=String(v==null||v===''?'—':v);
    return out;
  }
  return {ORDER,phaseName,coachPhaseSummary,stableMetricSnapshot};
});

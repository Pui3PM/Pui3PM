(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.TemporalEvidenceCore=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  'use strict';
  // R8C/F02: null, undefined, booleans and empty strings are UNKNOWN, never 0 (INV-001; same rule as evidence_budget_core).
  const finite=v=>(typeof v==='number'||(typeof v==='string'&&v.trim()!==''))&&Number.isFinite(Number(v));
  const num=v=>finite(v)?Number(v):null;
  const median=a=>{const x=(a||[]).filter(finite).map(Number).sort((p,q)=>p-q);if(!x.length)return null;const i=Math.floor(x.length/2);return x.length%2?x[i]:(x[i-1]+x[i])/2;};
  const percentile=(a,p=.95)=>{const x=(a||[]).filter(finite).map(Number).sort((u,v)=>u-v);if(!x.length)return null;return x[Math.max(0,Math.min(x.length-1,Math.round((x.length-1)*p)))];};
  function cadence(intervals=[]){
    const clean=intervals.filter(x=>finite(x)&&Number(x)>1&&Number(x)<250).map(Number),m=median(clean);
    if(!m)return{fps:null,medianMs:null,p95Ms:null,jitterP95Ms:null};
    const dev=clean.map(x=>Math.abs(x-m));
    return{fps:1000/m,medianMs:m,p95Ms:percentile(clean,.95),jitterP95Ms:percentile(dev,.95)};
  }
  function releaseZone(offsetMs,pinLabel=null){
    const p=String(pinLabel||'').toLowerCase();
    if(p==='set')return 'set-pin';
    if(p==='setup')return 'setup-pin';
    if(p==='draw')return 'draw';
    if(p==='anchor')return 'anchor-focus';
    if(p==='hold')return 'aim-hold';
    if(p==='expansion')return 'expansion-pin';
    if(p==='follow')return 'follow-summary';
    const o=Number(offsetMs);
    if(!Number.isFinite(o))return 'temporal-native';
    if(o>=700)return 'follow-summary';
    return 'release-focus';
  }
  function frameChronologyKey(f){
    const mt=num(f?.mediaTime),seq=num(f?.frameSeq),ep=num(f?.epochMs);
    return {mediaTime:mt,frameSeq:seq,epochMs:ep};
  }
  function canonicalFrames(frames=[],toleranceMs=8){
    // BLE4.3.8.9.5.2: a replay is camera chronology, not a merge-order timeline.
    // Prefer camera mediaTime when it is available. epochMs remains the Release-T0
    // alignment clock, but must not be allowed to make the picture walk backwards.
    const rows=(frames||[]).filter(f=>finite(f?.epochMs)&&f?.blob).map((f,i)=>({...f,__i:i}));
    rows.sort((a,b)=>{
      const am=num(a.mediaTime),bm=num(b.mediaTime);
      if(am!==null&&bm!==null&&Math.abs(am-bm)>.0004)return am-bm;
      const as=num(a.frameSeq),bs=num(b.frameSeq);
      if(as!==null&&bs!==null&&as!==bs)return as-bs;
      return Number(a.epochMs)-Number(b.epochMs)||a.__i-b.__i;
    });
    const out=[],tagList=f=>[String(f?.evidenceZone||''),...(Array.isArray(f?.evidenceTags)?f.evidenceTags.map(String):[])].filter(Boolean);
    let lastMedia=null;const lastSeqBySource=new Map();
    for(const raw of rows){
      const f={...raw};delete f.__i;
      const mt=num(f.mediaTime),seq=num(f.frameSeq),last=out.at(-1),lmt=num(last?.mediaTime),src=String(f.source||''),lsrc=String(last?.source||'');
      const lastSeq=lastSeqBySource.has(src)?lastSeqBySource.get(src):null;
      // Reject an actual camera-time inversion. This is the failure that makes Frame
      // playback visibly jump backwards even though epochMs happened to sort forward.
      if(mt!==null&&lastMedia!==null&&mt<lastMedia-.0004)continue;
      if(seq!==null&&lastSeq!==null&&seq<lastSeq&&mt===null)continue;
      const sameMedia=last&&mt!==null&&lmt!==null&&Math.abs(mt-lmt)<.0008;
      // R8C/F02: frameSeq is a per-source counter; equal numbers from different sources are not one sample.
      const sameSeq=last&&seq!==null&&num(last?.frameSeq)!==null&&seq===num(last.frameSeq)&&src===lsrc;
      // R8C/F02: epoch nearness is NOT camera identity. It may only fold a cross-pipeline duplicate
      // (different source) when the two rows cannot be compared by camera mediaTime. Two known mediaTimes
      // are decided by sameMedia above; same-source rows are distinct captures (240 FPS = 4.2 ms apart).
      const sameEpoch=last&&src!==lsrc&&!(mt!==null&&lmt!==null)&&Math.abs(Number(f.epochMs)-Number(last.epochMs))<=toleranceMs;
      if(last&&(sameMedia||sameSeq||sameEpoch)){
        const fw=/worker|native-/.test(String(f.source||'')),lw=/worker|native-/.test(String(last.source||''));
        const tags=[...new Set([...tagList(last),...tagList(f)])];
        if(fw&&!lw)out[out.length-1]={...f,evidenceTags:tags};else out[out.length-1]={...last,evidenceTags:tags};
      }else out.push({...f,evidenceTags:[...new Set(tagList(f))]});
      const kept=out.at(-1),kmt=num(kept?.mediaTime),ks=num(kept?.frameSeq);
      if(kmt!==null)lastMedia=kmt;if(ks!==null)lastSeqBySource.set(String(kept?.source||''),ks);
    }
    return out.map((f,i)=>({...f,replaySeq:i}));
  }
  function dedupeFrames(frames=[],toleranceMs=8){return canonicalFrames(frames,toleranceMs);}
  function mergeEvidence(existing=[],workerFrames=[],releaseEpochMs=null,{preMs=1250,postMs=900,replaceDense=true}={}){
    const rel=num(releaseEpochMs),wf=canonicalFrames(workerFrames);
    let base=(existing||[]).filter(f=>finite(f?.epochMs)&&f?.blob);
    if(replaceDense&&rel!==null&&wf.length){
      const lo=rel-preMs,hi=rel+postMs;
      const mts=wf.map(f=>num(f.mediaTime)).filter(x=>x!==null),mtLo=mts.length?Math.min(...mts):null,mtHi=mts.length?Math.max(...mts):null;
      base=base.filter(f=>{
        if(String(f.evidenceZone||'')==='recovery-end')return true;
        if(Number(f.epochMs)>=lo&&Number(f.epochMs)<=hi)return false;
        const mt=num(f.mediaTime);if(mt!==null&&mtLo!==null&&mt>=mtLo-.001&&mt<=mtHi+.001)return false;
        return true;
      });
    }
    return canonicalFrames([...base,...wf],8);
  }
  function bundleHealthy(bundle,reportedFps=null){
    const fps=num(bundle?.raw_fps),count=Number(bundle?.dense_frame_count)||0,reported=num(reportedFps),target=(reported&&reported>=50)?45:23;
    return !!(fps&&fps>=target&&count>=Math.max(20,Math.floor(fps*1.6)));
  }
  return{finite,num,median,percentile,cadence,releaseZone,frameChronologyKey,canonicalFrames,dedupeFrames,mergeEvidence,bundleHealthy};
});

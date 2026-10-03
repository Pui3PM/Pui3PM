(function(root,factory){
  // R8 P1-08: identity/chronology rules come from the shared FrameIdentityCore (H-01/H-02).
  const FI=(typeof module!=="undefined"&&module.exports&&typeof require==="function")?require('./frame_identity_core.js'):root&&root.FrameIdentityCore;
  if(!FI)throw new Error('TemporalEvidenceCore requires FrameIdentityCore (load frame_identity_core.js first)');
  const api=factory(FI);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.TemporalEvidenceCore=api;
})(typeof window!=="undefined"?window:globalThis,function(FI){
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
    // R8 P1-08 H-01/H-02: a replay is camera chronology. mediaTime/frameSeq order a frame only within its own
    // clock domain (source pipeline + stream generation); domains are merged on the shared capture epoch.
    // One physical capture is one row: identity rules are FrameIdentityCore.sameFrame. When two rows are one
    // frame the worker/native representation is kept and evidence tags are unioned. toleranceMs is kept for API
    // compatibility; the pipeline-duplicate window is FrameIdentityCore.PIPELINE_FOLD_MS (8 ms).
    const tagList=f=>[String(f?.evidenceZone||''),...(Array.isArray(f?.evidenceTags)?f.evidenceTags.map(String):[])].filter(Boolean);
    const rank=f=>/worker|native-/.test(String(f?.source||''))?1:0;
    const rows=(frames||[]).filter(f=>finite(f?.epochMs)&&f?.blob);
    const out=FI.uniqueFrames(rows,{rank,merge:(keep,f,better)=>{const best=better?f:keep;return {...best,evidenceTags:[...new Set([...tagList(keep),...tagList(f)])]};}});
    return out.map((f,i)=>({...f,evidenceTags:[...new Set(tagList(f))],replaySeq:i}));
  }
  function dedupeFrames(frames=[],toleranceMs=8){return canonicalFrames(frames,toleranceMs);}
  function mergeEvidence(existing=[],workerFrames=[],releaseEpochMs=null,{preMs=1250,postMs=900,replaceDense=true}={}){
    const rel=num(releaseEpochMs),wf=canonicalFrames(workerFrames);
    let base=(existing||[]).filter(f=>finite(f?.epochMs)&&f?.blob);
    if(replaceDense&&rel!==null&&wf.length){
      const lo=rel-preMs,hi=rel+postMs;
      // mediaTime ranges are compared only inside the SAME clock domain (H-01): a browser frame whose local
      // video time happens to fall inside a native PTS range is a different clock, not a replaced frame.
      const ranges=new Map();for(const f of wf){const mt=num(f.mediaTime);if(mt===null)continue;const d=FI.clockDomain(f),r=ranges.get(d)||[mt,mt];ranges.set(d,[Math.min(r[0],mt),Math.max(r[1],mt)]);}
      base=base.filter(f=>{
        if(String(f.evidenceZone||'')==='recovery-end'||(Array.isArray(f.evidenceTags)&&f.evidenceTags.includes('recovery-end')))return true;
        if(Number(f.epochMs)>=lo&&Number(f.epochMs)<=hi)return false;
        const mt=num(f.mediaTime),r=ranges.get(FI.clockDomain(f));if(mt!==null&&r&&mt>=r[0]-.001&&mt<=r[1]+.001)return false;
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

(function(root,factory){
  // R8 P1-08: identity/chronology rules come from the shared FrameIdentityCore (H-01/H-02).
  const FI=(typeof module!=="undefined"&&module.exports&&typeof require==="function")?require('./frame_identity_core.js'):root&&root.FrameIdentityCore;
  if(!FI)throw new Error('EvidenceBudgetCore requires FrameIdentityCore (load frame_identity_core.js first)');
  const api=factory(FI);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.EvidenceBudgetCore=api;
})(typeof window!=="undefined"?window:globalThis,function(FI){
  'use strict';
  const VERSION='R8-P1-08-fixed25-domain-chronology-durable-identity-v2';
  const TARGET=25;
  const finite=v=>(typeof v==='number'||(typeof v==='string'&&v.trim()!==''))&&Number.isFinite(Number(v));
  const num=v=>finite(v)?Number(v):null;
  const tags=f=>[String(f?.evidenceZone||''),...(Array.isArray(f?.evidenceTags)?f.evidenceTags.map(String):[])].filter(Boolean);
  const sourceRank=s=>/native-avfoundation/.test(String(s||''))?5:/worker/.test(String(s||''))?4:/native30|main-track/.test(String(s||''))?3:/sparse/.test(String(s||''))?2:1;

  // Deprecated pairwise comparator, kept for API compatibility. It is only meaningful WITHIN one clock domain;
  // ordering across domains must use FI.physicalOrder (a pairwise rule across domains is not transitive).
  function cameraCompare(a,b){
    if(FI.mediaComparable(a,b)&&Math.abs(num(a.mediaTime)-num(b.mediaTime))>.0004)return num(a.mediaTime)-num(b.mediaTime);
    if(FI.clockDomain(a)===FI.clockDomain(b)){const as=num(a?.frameSeq),bs=num(b?.frameSeq);if(as!==null&&bs!==null&&as!==bs)return as-bs;}
    return Number(a?.epochMs)-Number(b?.epochMs);
  }
  const order=frames=>FI.physicalOrder(frames);

  function canonicalUnique(frames=[]){
    // One logical real frame per physical capture (H-02): durable FrameUID, generation fencing, same-domain camera
    // identity, exact persisted copies (survive IndexedDB/structuredClone) and same-track pipeline duplicates fold;
    // distinct sources/generations/devices never fold. Output is clock-domain-safe physical order (H-01).
    const rows=[...new Set(frames||[])].filter(f=>f&&finite(f.epochMs)&&f.blob);
    const out=FI.uniqueFrames(rows,{rank:f=>sourceRank(f.source),merge:(keep,f,better)=>{const best=better?f:keep;return {...best,evidenceTags:[...new Set([...tags(keep),...tags(f)])]};}});
    return out.map((f,i)=>({...f,evidenceTags:[...new Set(tags(f))],replaySeq:i}));
  }

  function zoneHas(f,needles=[]){
    const hay=tags(f).map(x=>x.toLowerCase());
    return needles.some(n=>hay.some(x=>x===n||x.includes(n)));
  }
  function bucketFrames(frames,kind,release){
    if(kind==='draw')return frames.filter(f=>zoneHas(f,['draw-pin','draw','draw-anchor']));
    if(kind==='anchor')return frames.filter(f=>zoneHas(f,['anchor-focus','anchor-pin']));
    if(kind==='hold')return frames.filter(f=>zoneHas(f,['hold-pin','aim-hold']));
    if(kind==='expansion')return frames.filter(f=>zoneHas(f,['expansion-pin']));
    if(kind==='recovery')return frames.filter(f=>zoneHas(f,['recovery-end']));
    if(kind==='follow')return frames.filter(f=>zoneHas(f,['follow-summary'])||(!zoneHas(f,['recovery-end'])&&finite(release)&&Number(f.epochMs)-release>=700));
    if(kind==='release')return frames.filter(f=>zoneHas(f,['release-focus'])||(finite(release)&&Math.abs(Number(f.epochMs)-release)<=700));
    return [];
  }
  function evenly(frames,n){
    const a=order(frames);
    if(n<=0||!a.length)return[];
    if(a.length<=n)return a;
    if(n===1)return[a[Math.round((a.length-1)/2)]];
    const out=[],seen=new Set();
    for(let i=0;i<n;i++){
      let idx=Math.round(i*(a.length-1)/(n-1));
      while(idx<a.length&&seen.has(idx))idx++;
      if(idx>=a.length){idx=Math.round(i*(a.length-1)/(n-1));while(idx>=0&&seen.has(idx))idx--;}
      if(idx>=0&&!seen.has(idx)){seen.add(idx);out.push(a[idx]);}
    }
    return out;
  }
  // Selection key = durable identity key of an already-unique frame (never epoch-only: distinct frames may share
  // an epoch across devices; never media-only: mediaTime is local to one clock domain).
  function key(f){return FI.idKey(f);}
  function fillMaxGap(all,selected,target){
    const chosen=new Map(selected.map(f=>[key(f),f]));
    while(chosen.size<target){
      let best=null,bestScore=-1;
      for(const f of all){
        const k=key(f);if(chosen.has(k))continue;
        let minGap=Infinity;
        for(const s of chosen.values())minGap=Math.min(minGap,Math.abs(Number(f.epochMs)-Number(s.epochMs)));
        if(!Number.isFinite(minGap))minGap=0;
        const phaseBonus=zoneHas(f,['hold-pin','anchor-focus','anchor-pin','expansion-pin','recovery-end'])?50:0;
        const score=minGap+phaseBonus;
        if(score>bestScore||(score===bestScore&&Number(f.epochMs)<Number(best?.epochMs))){best=f;bestScore=score;}
      }
      if(!best)break;chosen.set(key(best),best);
    }
    return order([...chosen.values()]);
  }

  function selectFixedBudget(frames=[],releaseEpochMs=null,target=TARGET,reservedEpochs=[]){
    const all=canonicalUnique(frames),release=finite(releaseEpochMs)?Number(releaseEpochMs):null;
    if(all.length<=target)return all.map((f,i)=>({...f,offsetMs:release===null?(finite(f.offsetMs)?Number(f.offsetMs):null):Number(f.epochMs)-release,replaySeq:i}));
    const quotas={draw:2,anchor:3,hold:3,expansion:2,release:9,follow:5,recovery:1};
    const reserved=all.filter(f=>reservedEpochs.includes(Number(f.epochMs))).slice(0,target);
    const selected=[];
    for(const kind of ['draw','anchor','hold','expansion','release','follow','recovery'])selected.push(...evenly(bucketFrames(all,kind,release),quotas[kind]));
    let out=canonicalUnique(selected);
    // Preserve R7 contract witnesses before filling aesthetic/density quotas.
    const reservedKeys=new Set(reserved.map(key));
    const rest=out.filter(f=>!reservedKeys.has(key(f)));
    out=order([...reserved,...evenly(rest,Math.max(0,target-reserved.length))]);
    if(out.length<target)out=fillMaxGap(all,out,target);
    out=order(out.slice(0,target));
    return out.map((f,i)=>({...f,offsetMs:release===null?(finite(f.offsetMs)?Number(f.offsetMs):null):Number(f.epochMs)-release,replaySeq:i}));
  }

  function normalizeRecord(record,target=TARGET){
    if(!record||!Array.isArray(record.frames))return record;
    const sourceCount=canonicalUnique(record.frames).length,release=finite(record.releaseEpochMs)?Number(record.releaseEpochMs):null;
    let reservedEpochs=[];
    try{
      const core=typeof window!=='undefined'?window.CaptureIntegrityCore:null;
      const advanced=record.phaseTimeline?{phase_timeline:record.phaseTimeline,release_epoch_ms:release}:typeof loadAdvancedShotMetrics==='function'?loadAdvancedShotMetrics(record.shotId):null;
      if(core?.evidenceContract){
        const candidates=canonicalUnique(record.frames).map(f=>({...f,offsetMs:release===null?null:Number(f.epochMs)-release}));
        const contract=core.evidenceContract({...record,frames:candidates},advanced);
        reservedEpochs=Object.values(contract.stages||{}).filter(s=>s.ok&&s.index!==null).map(s=>Number(candidates[s.index]?.epochMs)).filter(Number.isFinite);
      }
    }catch{}
    const frames=selectFixedBudget(record.frames,release,target,reservedEpochs),missing=Math.max(0,target-frames.length);
    const reviewSlots=Array.from({length:target},(_,i)=>frames[i]?{slot:i+1,epochMs:Number(frames[i].epochMs),offsetMs:finite(frames[i].offsetMs)?Number(frames[i].offsetMs):null,missing:false}:{slot:i+1,epochMs:null,offsetMs:null,missing:true});
    const budget={version:VERSION,targetSlots:target,actualFrames:frames.length,missingSlots:missing,sourceFrames:sourceCount,trimmed:Math.max(0,sourceCount-frames.length),deterministic:true,chronology:'per-clock-domain-camera-order-merged-by-capture-epoch',identity:FI.VERSION,noFabrication:true};
    const epochs=frames.map(f=>Number(f.epochMs)).filter(Number.isFinite);
    return {...record,frames,startEpochMs:epochs.length?Math.min(...epochs):record.startEpochMs,endEpochMs:epochs.length?Math.max(...epochs):record.endEpochMs,evidenceBudget:budget,reviewSlots,captureKind:String(record.captureKind||'phase-weighted').includes('fixed25')?record.captureKind:`${record.captureKind||'phase-weighted'}+fixed25`};
  }
  // Strict = in clock-domain-safe physical order and no logical frame repeated.
  function isStrictChronology(frames=[]){const a=frames||[];if(!FI.isPhysicalOrder(a))return false;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(FI.sameFrame(a[i],a[j]))return false;return true;}
  return{VERSION,TARGET,cameraCompare,canonicalUnique,bucketFrames,selectFixedBudget,normalizeRecord,isStrictChronology};
});

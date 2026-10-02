(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.EvidenceBudgetCore=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  'use strict';
  const VERSION='R8-merge-fixed25-camera-witnesses-v1';
  const TARGET=25;
  const finite=v=>(typeof v==='number'||(typeof v==='string'&&v.trim()!==''))&&Number.isFinite(Number(v));
  const num=v=>finite(v)?Number(v):null;
  const tags=f=>[String(f?.evidenceZone||''),...(Array.isArray(f?.evidenceTags)?f.evidenceTags.map(String):[])].filter(Boolean);
  const sourceRank=s=>/native-avfoundation/.test(String(s||''))?5:/worker/.test(String(s||''))?4:/native30|main-track/.test(String(s||''))?3:/sparse/.test(String(s||''))?2:1;

  function cameraCompare(a,b){
    const am=num(a?.mediaTime),bm=num(b?.mediaTime);
    if(am!==null&&bm!==null&&Math.abs(am-bm)>.0004)return am-bm;
    const as=num(a?.frameSeq),bs=num(b?.frameSeq);
    if(as!==null&&bs!==null&&as!==bs)return as-bs;
    return Number(a?.epochMs)-Number(b?.epochMs);
  }

  function canonicalUnique(frames=[]){
    // Remove repeated references introduced when the same source frame belongs to multiple phase buckets.
    // This is not temporal dedup: distinct frame objects remain distinct even at the same epoch.
    const uniqueRefs=[...new Set(frames||[])];
    const rows=uniqueRefs
      .filter(f=>f&&finite(f.epochMs)&&f.blob)
      .map((f,i)=>({...f,__i:i}))
      .sort((a,b)=>cameraCompare(a,b)||sourceRank(b.source)-sourceRank(a.source)||a.__i-b.__i);
    const out=[];
    for(const raw of rows){
      const f={...raw};delete f.__i;
      const prev=out.at(-1);
      const mt=num(f.mediaTime),pmt=num(prev?.mediaTime),seq=num(f.frameSeq),pseq=num(prev?.frameSeq);
      const sameMedia=prev&&mt!==null&&pmt!==null&&Math.abs(mt-pmt)<.0008;
      const sameSeq=prev&&seq!==null&&pseq!==null&&seq===pseq&&String(f.source||'')===String(prev.source||'');
      const sameBlobRef=prev&&f.blob===prev.blob;
      // Epoch proximity is deliberately NOT an identity rule: it drops real high-FPS frames.
      // Exact object/blob reuse is safe to collapse because it is the same in-memory artifact.
      if(prev&&(sameBlobRef||sameMedia||sameSeq)){
        const mergedTags=[...new Set([...tags(prev),...tags(f)])];
        const best=sourceRank(f.source)>sourceRank(prev.source)?f:prev;
        out[out.length-1]={...best,evidenceTags:mergedTags};
        continue;
      }
      out.push({...f,evidenceTags:[...new Set(tags(f))]});
    }
    return out.map((f,i)=>({...f,replaySeq:i}));
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
    const a=[...frames].sort(cameraCompare);
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
  function key(f){
    if(finite(f?.frameSeq))return `seq:${String(f.source||'')}:${Number(f.frameSeq)}`;
    if(finite(f?.mediaTime))return `media:${Number(f.mediaTime).toFixed(6)}`;
    return `epoch:${Number(f.epochMs)}`;
  }
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
    return [...chosen.values()].sort(cameraCompare);
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
    out=[...reserved,...evenly(rest,Math.max(0,target-reserved.length))].sort(cameraCompare);
    if(out.length<target)out=fillMaxGap(all,out,target);
    out=out.slice(0,target).sort(cameraCompare);
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
    const budget={version:VERSION,targetSlots:target,actualFrames:frames.length,missingSlots:missing,sourceFrames:sourceCount,trimmed:Math.max(0,sourceCount-frames.length),deterministic:true,chronology:'camera-mediaTime-frameSeq-epoch-fallback',noFabrication:true};
    const epochs=frames.map(f=>Number(f.epochMs)).filter(Number.isFinite);
    return {...record,frames,startEpochMs:epochs.length?Math.min(...epochs):record.startEpochMs,endEpochMs:epochs.length?Math.max(...epochs):record.endEpochMs,evidenceBudget:budget,reviewSlots,captureKind:String(record.captureKind||'phase-weighted').includes('fixed25')?record.captureKind:`${record.captureKind||'phase-weighted'}+fixed25`};
  }
  function isStrictChronology(frames=[]){for(let i=1;i<(frames||[]).length;i++)if(cameraCompare(frames[i-1],frames[i])>=0)return false;return true;}
  return{VERSION,TARGET,cameraCompare,canonicalUnique,bucketFrames,selectFixedBudget,normalizeRecord,isStrictChronology};
});

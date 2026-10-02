(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.CaptureIntegrityCore=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  'use strict';
  const ROLES=['side','rear','overhead'];
  const CANONICAL_PHASES=['Setup','Set','Draw','Anchor','Aim / Hold','Expansion','Release','Follow Through'];
  // Missing evidence is unknown, never a numeric zero. Preserve numeric strings
  // for imported records, but reject booleans, arrays and blank strings.
  const finite=v=>(typeof v==='number'||(typeof v==='string'&&v.trim()!==''))&&Number.isFinite(Number(v));
  const num=v=>finite(v)?Number(v):null;
  const median=a=>{const x=(a||[]).filter(finite).map(Number).sort((p,q)=>p-q);if(!x.length)return null;const n=Math.floor(x.length/2);return x.length%2?x[n]:(x[n-1]+x[n])/2;};
  const percentile=(a,p=.95)=>{const x=(a||[]).filter(finite).map(Number).sort((u,v)=>u-v);if(!x.length)return null;return x[Math.max(0,Math.min(x.length-1,Math.round((x.length-1)*p)))];};
  function safeOffset(epoch,release,maxAbsMs=60000){
    const e=num(epoch),r=num(release);if(!e||!r||e<1e12||r<1e12)return null;const d=Math.round(e-r);return Math.abs(d)<=maxAbsMs?d:null;
  }
  function actualFps(intervals){const m=median((intervals||[]).filter(x=>x>1&&x<250));return m?1000/m:null;}
  function jitterStats(intervals){
    const clean=(intervals||[]).filter(x=>x>1&&x<250).map(Number),m=median(clean);if(!m)return{median_ms:null,p95_deviation_ms:null,p95_interval_ms:null};
    const dev=clean.map(x=>Math.abs(x-m));return{median_ms:m,p95_deviation_ms:percentile(dev,.95),p95_interval_ms:percentile(clean,.95)};
  }
  function cameraQuality({width=null,height=null,reportedFps=null,actualFps:fps=null,jitterMs=null,poseHz=null,active=false}={}){
    if(!active)return{level:'off',mode:'CLOSED',detail:'camera closed',captureRate:null,analysisRate:num(poseHz)};
    const f=num(fps)??num(reportedFps),w=num(width)||0,h=num(height)||0,j=num(jitterMs);
    const rate=f>=50?'HIGH-SPEED':f>=24?'STANDARD':f>=18?'REDUCED':'LOW-RATE';
    const detail=w>=1920&&h>=1080?'high detail':w>=1280&&h>=720?'standard detail':'reduced detail';
    let level='good';if(f!==null&&f<18)level='bad';else if((f!==null&&f<24)||(j!==null&&j>10))level='warn';
    return{level,mode:`${rate} EVIDENCE`,detail,captureRate:f,analysisRate:num(poseHz)};
  }
  function canonicalPhase(p){const s=String(p||'').trim();return CANONICAL_PHASES.includes(s)?s:null;}
  function normalizeTimeline(events=[],releaseEpoch=null){
    const rel=num(releaseEpoch),rows=[],rank=new Map(CANONICAL_PHASES.map((p,i)=>[p,i]));
    for(const e of events||[]){
      const phase=canonicalPhase(e?.phase),epoch=num(e?.epochMs);if(!phase||!epoch||epoch<1e12)continue;
      if(e?.role&&String(e.role)!=='side')continue;if(rel&&epoch>rel+1800)continue;
      rows.push({phase,epochMs:epoch,role:'side',confidence:finite(e?.confidence)?Number(e.confidence):null});
    }
    rows.sort((a,b)=>a.epochMs-b.epochMs);
    // Evidence timeline is semantic, not a per-frame phase trace. Keep the first valid
    // forward transition for each stage so a long Hold/Expansion can never push Draw/Anchor
    // out of the timeline. Backward classifier flicker remains available in raw diagnostics.
    const out=[];let highest=-1;
    for(const r of rows){
      const rr=rank.get(r.phase);if(!Number.isFinite(rr))continue;
      if(rr<highest)continue;
      const last=out.at(-1);
      if(rr===highest){
        if(last&&last.phase===r.phase&&finite(r.confidence)&&(!finite(last.confidence)||Number(r.confidence)>Number(last.confidence)))last.confidence=Number(r.confidence);
        continue;
      }
      out.push(r);highest=rr;
    }
    return out;
  }
  function mergePhaseEvent(events,phase,epochMs,confidence=null){
    const p=canonicalPhase(phase),t=num(epochMs);if(!p||!t||t<1e12)return normalizeTimeline(events);
    return normalizeTimeline([...(events||[]),{phase:p,epochMs:t,role:'side',confidence}],null);
  }
  function phaseEpoch(timeline,phase,releaseEpoch=null){
    const rel=num(releaseEpoch)||Infinity,rows=normalizeTimeline(timeline,rel);for(let i=rows.length-1;i>=0;i--)if(rows[i].phase===phase&&rows[i].epochMs<=rel)return rows[i].epochMs;return null;
  }
  function nearestFrameIndex(frames,targetOffset,maxDelta=Infinity){
    const t=num(targetOffset);if(t===null||!Array.isArray(frames)||!frames.length)return{index:null,delta:null};let bi=null,bd=Infinity;
    frames.forEach((f,i)=>{const o=num(f?.offsetMs);if(o===null)return;const d=Math.abs(o-t);if(d<bd){bd=d;bi=i;}});return bi!==null&&bd<=maxDelta?{index:bi,delta:bd}:{index:null,delta:bd===Infinity?null:bd};
  }
  function evidenceContract(record=null,advanced=null){
    const frames=Array.isArray(record?.frames)?record.frames:[],zones={};frames.forEach(f=>{const z=String(f?.evidenceZone||f?.zone||'legacy');zones[z]=(zones[z]||0)+1;});
    const release=num(record?.releaseEpochMs)||num(advanced?.release_epoch_ms),tl=normalizeTimeline(advanced?.phase_timeline||advanced?.phaseTimeline||[],release);
    const anchors=[num(record?.anchorFocusEpochMs),num(record?.anchorSettledEpochMs),num(record?.anchorEpochMs)].filter(x=>x&&x>1e12);
    const anchorEpoch=anchors[0]||phaseEpoch(tl,'Aim / Hold',release)||phaseEpoch(tl,'Anchor',release);
    const expEpoch=phaseEpoch(tl,'Expansion',release),drawEpoch=phaseEpoch(tl,'Draw',release),holdEpoch=phaseEpoch(tl,'Aim / Hold',release),followEpoch=phaseEpoch(tl,'Follow Through',release);
    const releaseNear=frames.reduce((b,f,i)=>{const o=num(f?.offsetMs);if(o===null)return b;const d=Math.abs(o);return !b||d<b.delta?{index:i,delta:d,offset:o}:b;},null);
    const target=(epoch,max=360)=>{const off=safeOffset(epoch,release);return off===null?{index:null,delta:null,offset:null}:({...nearestFrameIndex(frames,off,max),offset:off});};
    const tags=f=>[String(f?.evidenceZone||f?.zone||''),...(Array.isArray(f?.evidenceTags)?f.evidenceTags.map(String):[])];
    const firstZone=(names)=>{const i=frames.findIndex(f=>tags(f).some(z=>names.includes(z)));return i>=0?i:null;};
    const lastZone=(names)=>{for(let i=frames.length-1;i>=0;i--)if(tags(frames[i]).some(z=>names.includes(z)))return i;return null;};
    // Evidence Contract is intentionally strict: a timeline timestamp is not evidence by itself.
    // Every required stage must be represented by a real persisted frame/tag. Expansion is
    // optional only when the detector itself did not observe Expansion for that physical shot.
    const drawIdx=firstZone(['draw','draw-anchor','draw-pin']);
    const anchorIdx=firstZone(['anchor-focus','anchor-pin']);
    const holdIdx=firstZone(['aim-hold','hold-pin']);
    const expansionObserved=expEpoch!==null;
    const expIdx=firstZone(['expansion-pin']);
    const releaseIdx=releaseNear&&releaseNear.delta<=120?releaseNear.index:null;
    const followIdx=firstZone(['follow-summary'])??target(followEpoch,520).index;
    const recoveryIdx=lastZone(['recovery-end']);
    const stages={
      draw:{ok:drawIdx!==null,index:drawIdx,required:true},anchor:{ok:anchorIdx!==null,index:anchorIdx,required:true},hold:{ok:holdIdx!==null,index:holdIdx,required:true},
      expansion:{ok:expIdx!==null,index:expIdx,required:expansionObserved,observed:expansionObserved,optional:!expansionObserved},release:{ok:releaseIdx!==null,index:releaseIdx,deltaMs:releaseNear?.delta??null,required:true},
      follow:{ok:followIdx!==null,index:followIdx,required:true},recovery:{ok:recoveryIdx!==null&&finite(record?.followThroughEndEpochMs),index:recoveryIdx,required:false,optional:true,observed:recoveryIdx!==null&&finite(record?.followThroughEndEpochMs)}
    };
    const missing=Object.entries(stages).filter(([,v])=>v.required!==false&&!v.ok).map(([k])=>k);
    const notObserved=Object.entries(stages).filter(([,v])=>v.optional===true&&!v.ok).map(([k])=>k);
    return{complete:missing.length===0,missing,notObserved,zones,stages,releaseDeltaMs:releaseNear?.delta??null,anchorOffsetMs:safeOffset(anchorEpoch,release),releaseEpochMs:release};
  }
  function robustSpread(values){
    const a=(values||[]).filter(finite).map(Number);if(a.length<3)return null;const m=median(a),dev=a.map(x=>Math.abs(x-m)),mad=median(dev);return{median:m,mad,relative:m!==0?Math.abs(mad/m):null,n:a.length};
  }
  return{ROLES,CANONICAL_PHASES,finite,num,median,percentile,safeOffset,actualFps,jitterStats,cameraQuality,normalizeTimeline,mergePhaseEvent,phaseEpoch,nearestFrameIndex,evidenceContract,robustSpread};
});

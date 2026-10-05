// 3PM BLE4.3.8.9.4 Evidence Timeline + Baseline UX · representative Hold + optional visual Expansion.
// Integration-only: frozen Dev4 app/core/pose runtime and BLE43887 Release Arbitration remain unchanged.
(function(){
'use strict';
const VERSION='BLE4.3.8.9.5.6-evidence-timeline-baseline-v7';
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const tags=f=>[String(f?.evidenceZone||f?.zone||''),...(Array.isArray(f?.evidenceTags)?f.evidenceTags.map(String):[])].filter(Boolean);
const hasTag=(f,names)=>tags(f).some(t=>names.includes(t));
const frameOffset=(frames,i)=>i==null?null:(finite(frames?.[i]?.offsetMs)?Number(frames[i].offsetMs):null);
function phaseOffset(advanced,phase,release){
  const rel=finite(release)?Number(release):Number(advanced?.release_epoch_ms||advanced?.releaseEpochMs);
  const tl=advanced?.phase_timeline||advanced?.phaseTimeline||[];
  if(!finite(rel)||!Array.isArray(tl))return null;
  const rows=tl.filter(e=>String(e?.phase)===phase&&finite(e?.epochMs)&&Number(e.epochMs)<=rel).sort((a,b)=>Number(a.epochMs)-Number(b.epochMs));
  return rows.length?Number(rows.at(-1).epochMs)-rel:null;
}
function firstIndex(frames,predicate,start=0){for(let i=Math.max(0,start);i<(frames||[]).length;i++)if(predicate(frames[i],i))return i;return null;}
function lastIndex(frames,predicate,start=null){for(let i=start==null?(frames||[]).length-1:Math.min(start,(frames||[]).length-1);i>=0;i--)if(predicate(frames[i],i))return i;return null;}
function taggedNear(frames,names,target,{minIndex=0,maxIndex=null,preMs=70,postMs=360,forwardFallback=true}={}){
  if(!Array.isArray(frames)||!frames.length||!finite(target))return null;
  const hi=maxIndex==null?frames.length-1:Math.min(frames.length-1,maxIndex);let best=null,bd=Infinity;
  for(let i=Math.max(0,minIndex);i<=hi;i++){
    const o=frameOffset(frames,i);if(o===null||!hasTag(frames[i],names))continue;
    const d=o-Number(target);if(d < -Math.max(0,preMs) || d > Math.max(0,postMs))continue;
    const ad=Math.abs(d);if(ad<bd){best={index:i,offset:o,signedDeltaMs:d,deltaMs:ad};bd=ad;}
  }
  if(best)return best;
  if(!forwardFallback)return null;
  for(let i=Math.max(0,minIndex);i<=hi;i++){
    const o=frameOffset(frames,i);if(o===null||o<Number(target)||!hasTag(frames[i],names))continue;
    const d=o-Number(target);if(d<=postMs)return{index:i,offset:o,signedDeltaMs:d,deltaMs:d};
  }
  return null;
}
function anyForward(frames,target,{minIndex=0,maxIndex=null,postMs=360}={}){
  if(!Array.isArray(frames)||!finite(target))return null;const hi=maxIndex==null?frames.length-1:Math.min(frames.length-1,maxIndex);
  for(let i=Math.max(0,minIndex);i<=hi;i++){const o=frameOffset(frames,i);if(o!==null&&o>=Number(target)&&o-Number(target)<=postMs)return{index:i,offset:o,signedDeltaMs:o-Number(target),deltaMs:o-Number(target)};}
  return null;
}
function nearestReleaseAfter(frames,minIndex,maxDelta=120){let best=null,bd=Infinity;for(let i=Math.max(0,minIndex);i<(frames||[]).length;i++){const o=frameOffset(frames,i);if(o===null)continue;const d=Math.abs(o);if(d<bd&&d<=maxDelta){best={index:i,offset:o,deltaMs:d,signedDeltaMs:o};bd=d;}}return best;}
function taggedBefore(frames,names,target,{minIndex=0,preMs=520}={}){
  if(!Array.isArray(frames)||!frames.length||!finite(target))return null;let best=null,bd=Infinity;
  for(let i=Math.max(0,minIndex);i<frames.length;i++){
    const o=frameOffset(frames,i);if(o===null||o>Number(target)||!hasTag(frames[i],names))continue;
    const d=Number(target)-o;if(d>Math.max(0,preMs))continue;if(d<bd){best={index:i,offset:o,signedDeltaMs:o-Number(target),deltaMs:d};bd=d;}
  }
  return best;
}
function settledAnchorPick(record,frames,target,minIndex=0){
  const hasSettled=finite(record?.anchorFocusEpochMs)||finite(record?.anchorSettledEpochMs);
  // BLE438956: Anchor Focus and Hold must remain two distinct pieces of evidence. The stored
  // Anchor Focus timestamp is the Aim/Hold boundary, so prefer the last real anchor-focus
  // camera frame at/before that boundary. This prevents the hold-pin itself from being consumed
  // as Anchor, which previously made the same real shot fail the strict Hold stage.
  if(hasSettled){
    const pre=taggedBefore(frames,['anchor-focus'],target,{minIndex,preMs:520});if(pre)return{...pre,selection:'verified-anchor-focus-before-hold'};
    const fwFocus=taggedNear(frames,['anchor-focus'],target,{minIndex,preMs:0,postMs:360,forwardFallback:true});if(fwFocus)return{...fwFocus,selection:'verified-forward-anchor-focus'};
    // Legacy evidence may not contain anchor-focus tags. Keep the historical fallback only in
    // that case so old archived sessions remain reviewable without changing new-shot semantics.
    const pin=taggedNear(frames,['hold-pin'],target,{minIndex,preMs:70,postMs:220,forwardFallback:false});if(pin)return{...pin,selection:'legacy-verified-hold-pin'};
    const fw=taggedNear(frames,['hold-pin'],target,{minIndex,preMs:0,postMs:360,forwardFallback:true})||anyForward(frames,target,{minIndex,postMs:360});
    return fw?{...fw,selection:'legacy-verified-forward'}:null;
  }
  const acq=taggedNear(frames,['anchor-pin'],target,{minIndex,preMs:70,postMs:260,forwardFallback:false})||taggedNear(frames,['anchor-pin','anchor-focus'],target,{minIndex,preMs:0,postMs:360,forwardFallback:true})||anyForward(frames,target,{minIndex,postMs:360});
  return acq?{...acq,selection:'anchor-acquisition'}:null;
}
function normalizeContract(record,advanced,out){
  const frames=Array.isArray(record?.frames)?record.frames:[];if(!out?.stages||!frames.length)return out;
  const release=Number(record?.releaseEpochMs||advanced?.release_epoch_ms||advanced?.releaseEpochMs);const targetAnchor=Number(out.anchorOffsetMs);
  const holdTarget=phaseOffset(advanced,'Aim / Hold',release);const expTarget=phaseOffset(advanced,'Expansion',release);const followTarget=phaseOffset(advanced,'Follow Through',release);
  const stages={...out.stages};
  let draw=stages.draw?.index??firstIndex(frames,f=>hasTag(f,['draw','draw-pin','draw-anchor']),0);
  const anchorPick=settledAnchorPick(record,frames,targetAnchor,Math.max(0,(draw??-1)+1));
  let anchor=anchorPick?.index??null;
  // Settled Anchor is the beginning of the stable plateau. For a materially long Hold, Review
  // must also preserve a later representative Hold frame instead of silently reusing Anchor.
  let holdPick=finite(holdTarget)?taggedNear(frames,['hold-pin','aim-hold'],holdTarget,{minIndex:anchor===null?0:anchor+1,preMs:70,postMs:300,forwardFallback:true}):null;
  // BLE438955: Anchor and Hold are distinct physical evidence. Never manufacture a complete
  // contract by reusing the Anchor frame as Hold. Missing evidence stays Missing.
  // R7: release-focus and anchor-focus encoding windows overlap Hold. Their labels are
  // sampling zones, not physical phases. Use a distinct real frame inside the verified Hold
  // interval when the dedicated pin was consumed by Anchor or omitted by fixed-25 selection.
  if(!holdPick&&anchor!==null&&finite(holdTarget)){
    const end=finite(expTarget)?Number(expTarget):0;
    const i=firstIndex(frames,(f,j)=>{const o=frameOffset(frames,j);return o!==null&&o>=Number(holdTarget)&&o<end&&!hasTag(f,['expansion-pin','recovery-end','follow-summary']);},anchor+1);
    if(i!==null)holdPick={index:i,offset:frameOffset(frames,i),signedDeltaMs:frameOffset(frames,i)-Number(holdTarget),deltaMs:frameOffset(frames,i)-Number(holdTarget),selection:'verified-hold-interval'};
  }
  let hold=holdPick?.index??null;
  if(anchor!==null&&hold!==null&&hold<=anchor)hold=null;
  const anchorOffset=frameOffset(frames,anchor),holdEndTarget=finite(expTarget)?Number(expTarget):0,holdSpan=finite(anchorOffset)?Math.max(0,holdEndTarget-Number(anchorOffset)):0;
  if(anchor!==null&&holdSpan>=650&&(hold===anchor||Math.abs((frameOffset(frames,hold)??0)-Number(anchorOffset))<180)){
    const repTarget=Math.min(holdEndTarget-100,Number(anchorOffset)+holdSpan*.55);
    const rep=taggedNear(frames,['aim-hold','release-focus','hold-pin'],repTarget,{minIndex:anchor+1,preMs:160,postMs:260,forwardFallback:true})||anyForward(frames,repTarget,{minIndex:anchor+1,postMs:300});
    if(rep&&finite(rep.offset)&&Number(rep.offset)<-80){holdPick={...rep,selection:'representative-hold'};hold=rep.index;}
  }
  let expansion=null,expPick=null;
  if(stages.expansion?.observed!==false&&finite(expTarget)){
    expPick=taggedNear(frames,['expansion-pin'],expTarget,{minIndex:hold!==null?hold+1:(anchor!==null?anchor+1:0),preMs:70,postMs:260,forwardFallback:false})||taggedNear(frames,['expansion-pin','aim-hold','release-focus'],expTarget,{minIndex:hold!==null?hold+1:(anchor!==null?anchor+1:0),preMs:0,postMs:320,forwardFallback:true})||anyForward(frames,expTarget,{minIndex:hold!==null?hold+1:(anchor!==null?anchor+1:0),postMs:320});
    expansion=expPick?.index??null;
    // When Hold and Expansion targets are materially separated, do not silently collapse them
    // onto the same frame if a later real frame exists before Release.
    if(expansion!==null&&hold!==null&&expansion===hold&&finite(holdTarget)&&expTarget-Number(holdTarget)>90){
      const next=anyForward(frames,expTarget,{minIndex:hold+1,postMs:320});if(next){expPick=next;expansion=next.index;}
    }
  }
  const releasePick=nearestReleaseAfter(frames,(expansion??hold??anchor??draw??-1)+1,120);const releaseIdx=releasePick?.index??null;
  let follow=releaseIdx===null?null:firstIndex(frames,f=>hasTag(f,['follow-summary']),releaseIdx+1);
  if(follow===null&&releaseIdx!==null&&finite(followTarget))follow=firstIndex(frames,(f)=>{const o=frameOffset(frames,frames.indexOf(f));return o!==null&&o>=followTarget;},releaseIdx+1);
  const recovery=follow===null?null:lastIndex(frames,f=>hasTag(f,['recovery-end']),frames.length-1);
  const setStage=(name,index,extra={})=>{const prior=stages[name]||{};stages[name]={...prior,ok:index!==null,index,...extra};};
  setStage('draw',draw,{chronologyVerified:draw!==null});
  setStage('anchor',anchor,{deltaMs:anchorPick?.deltaMs??null,signedDeltaMs:anchorPick?.signedDeltaMs??null,verifiedFrame:true,verifiedForward:anchorPick?anchorPick.signedDeltaMs>=0:false,selection:anchorPick?.selection||null,chronologyVerified:anchor!==null});
  setStage('hold',hold,{deltaMs:holdPick?.deltaMs??(hold===anchor?anchorPick?.deltaMs:null),signedDeltaMs:holdPick?.signedDeltaMs??(hold===anchor?anchorPick?.signedDeltaMs:null),chronologyVerified:hold!==null&&(anchor===null||hold>anchor),coincidentWith:null});
  if(stages.expansion?.required===false&&!finite(expTarget))stages.expansion={...stages.expansion,ok:stages.expansion.ok,index:stages.expansion.index,chronologyVerified:true};
  else setStage('expansion',expansion,{...stages.expansion,deltaMs:expPick?.deltaMs??null,signedDeltaMs:expPick?.signedDeltaMs??null,chronologyVerified:expansion!==null&&(hold===null||expansion>hold),coincidentWith:null});
  setStage('release',releaseIdx,{deltaMs:releasePick?.deltaMs??null,chronologyVerified:releaseIdx!==null&&(expansion===null||releaseIdx>expansion)&&(hold===null||releaseIdx>hold)});
  setStage('follow',follow,{chronologyVerified:follow!==null&&releaseIdx!==null&&follow>releaseIdx});
  setStage('recovery',recovery,{required:finite(record?.followThroughEndEpochMs),optional:!finite(record?.followThroughEndEpochMs),observed:finite(record?.followThroughEndEpochMs),chronologyVerified:recovery===null||(follow!==null&&recovery>follow)});
  const orderOk=(draw===null||anchor===null||draw<anchor)&&(anchor===null||hold===null||anchor<hold)&&(hold===null||expansion===null||hold<expansion)&&(releaseIdx!==null&&(expansion!==null?expansion<releaseIdx:(hold!==null?hold<releaseIdx:true)))&&(follow!==null&&releaseIdx<follow)&&(recovery===null||follow<recovery);
  const missing=Object.entries(stages).filter(([,v])=>v.required!==false&&!v.ok).map(([k])=>k);
  if(!orderOk&&!missing.includes('chronology'))missing.push('chronology');
  // BLE43891: recompute optional-stage truth after forward-frame normalization. The base contract
  // can be created before the Recovery append lands; once a real recovery-end frame is present,
  // exported diagnostics must not simultaneously say Recovery was "notObserved".
  const notObserved=Object.entries(stages).filter(([,v])=>v.optional===true&&!v.ok).map(([k])=>k);
  const expansionObserved=expansion!==null&&stages.expansion?.observed!==false;
  const chronologyRule=expansionObserved?'Draw < Anchor < Hold < Expansion < Release < Follow [< Recovery when observed]':'Draw < Anchor < Hold < Release < Follow [< Recovery when observed] · Expansion optional when visually resolved';
  return {...out,stages,missing,notObserved,complete:missing.length===0,chronology:{ok:orderOk,rule:chronologyRule,holdAnchorCoincident:anchor!==null&&hold===anchor,expansionHoldCoincident:hold!==null&&expansion===hold,expansionOptional:true,expansionObserved}};
}
// Review Anchor uses the same verified timing semantics as the diagnostic contract.
try{
  if(typeof jumpReplayAnchor==='function'){
    jumpReplayAnchor=function(){
      const r=shotReplayState?.record,shot=selectedShot?.();if(!r?.frames?.length||!shot)return false;const target=replayAnchorOffsetForShot(shot,r);
      if(!finite(target)){toast?.('Settled Anchor timing is not available for this shot.','warn',3000);return false;}
      const pick=settledAnchorPick(r,r.frames,Number(target),0);if(!pick){toast?.(`Full Shot Evidence is missing a verified Anchor frame near ${Math.round(target)} ms.`,'warn',3600);return false;}
      stopShotReplay?.();shotReplayState.index=pick.index;renderShotReplayFrame?.();return true;
    };
  }
}catch(e){console.warn('EvidenceTimeline Anchor navigation unavailable',e);}
try{
  const C=window.CaptureIntegrityCore;
  if(C?.evidenceContract){const base=C.evidenceContract.bind(C);C.evidenceContract=function(record,advanced){return normalizeContract(record,advanced,base(record,advanced));};}
}catch(e){console.warn('EvidenceTimeline contract wrapper unavailable',e);}
function referenceContext(sessionId,excludeId=null){
  try{
    const sid=Number(sessionId??currentSessionId),session=STATE.sessions.find(s=>s.id===sid);if(!session)return null;
    const excluded=Number(excludeId);const eligible=s=>(!Number.isFinite(excluded)||Number(s?.id)!==excluded)&&(typeof shotIsBaselineEligible==='function'?shotIsBaselineEligible(s):!!s);
    const current=(typeof sessionShots==='function'?sessionShots(sid):STATE.shots.filter(s=>s.session_id===sid)).filter(eligible),currentRefs=current.filter(s=>s.is_reference);
    const athleteIds=new Set(STATE.sessions.filter(s=>s.athlete_id===session.athlete_id).map(s=>s.id));
    const athleteRefs=STATE.shots.filter(s=>s.is_reference&&athleteIds.has(s.session_id)&&eligible(s));
    if(currentRefs.length>=3)return{active:true,count:currentRefs.length,scope:'Current session',currentCount:currentRefs.length};
    if(athleteRefs.length>=3)return{active:true,count:athleteRefs.length,scope:'Athlete history',currentCount:currentRefs.length};
    return{active:false,count:currentRefs.length,scope:'Current session',currentCount:currentRefs.length,remaining:Math.max(0,3-currentRefs.length)};
  }catch{return null;}
}
function applyReferenceUx(sessionId){
  const ctx=referenceContext(sessionId);if(!ctx)return;
  const actions=document.querySelector?.('.reference-actions');if(actions){let p=document.getElementById?.('referenceProgress');if(!p){p=document.createElement('small');p.id='referenceProgress';p.className='reference-progress';actions.appendChild(p);}p.textContent=ctx.active?`Athlete Baseline Active · ${ctx.count} Reference Shots · ${ctx.scope}. New shots are compared against this set.`:`Reference set: ${ctx.currentCount}/3 minimum · Select ${ctx.remaining} more representative shot${ctx.remaining===1?'':'s'} to activate Athlete Baseline.`;}
  const host=document.getElementById?.('consistencyPanel');if(host){const cards=[...(host.querySelectorAll?.('.consistency-overview > div')||[])];for(const card of cards){const span=card.querySelector?.('span'),b=card.querySelector?.('b');if(!span||!b)continue;if(span.textContent==='Reference source')b.textContent=ctx.active?`Athlete Baseline Active · ${ctx.count} Reference Shots · ${ctx.scope}`:`Temporary session baseline · ${ctx.currentCount}/3 coach references`;}}
}
try{
  if(typeof baselineFor==='function'){
    const baseBaseline=baselineFor;baselineFor=function(...args){const r=baseBaseline.apply(this,args);const ctx=referenceContext(args[0],args[1]);if(!r||!ctx)return r;return{...r,sourceLabel:ctx.active?`Athlete Baseline Active · ${ctx.count} Reference Shots · ${ctx.scope}`:`Temporary validated-session baseline · Coach Reference ${ctx.currentCount}/3`};};
  }
}catch(e){console.warn('BaselineUX baseline wrapper unavailable',e);}
try{
  if(typeof renderAnalyze==='function'){const base=renderAnalyze;renderAnalyze=function(...args){const v=base.apply(this,args);queueMicrotask(()=>applyReferenceUx(currentSessionId));return v;};}
  if(typeof renderConsistencyPanel==='function'){const base=renderConsistencyPanel;renderConsistencyPanel=function(...args){const v=base.apply(this,args);queueMicrotask(()=>applyReferenceUx(args[0]??currentSessionId));return v;};}
}catch(e){console.warn('BaselineUX render wrapper unavailable',e);}
window.EvidenceTimelineBaselineLayer={VERSION,taggedNear,settledAnchorPick,normalizeContract,referenceContext,applyReferenceUx};
})();

// 3PM BLE4.3.8.9.4.1 Side Lifecycle Core
// Trust-first Shot State authority for Side view. Motion may create a provisional hypothesis, but
// public Setup/Draw authority is promoted only after shot-geometry continuity is credible.
// Raw phase classifiers may flicker; verified Draw+ authority is monotonic until Release/Recovery
// or a neutral-confirmed Let-down. This module never decides Capture.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SideLifecycleCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='BLE4.3.8.9.5.5-side-lifecycle-v7';
const DISPLAY_PHASE={Setup:'Set',Set:'Setup',Draw:'Draw',Anchor:'Anchor','Aim / Hold':'Aim / Hold',Expansion:'Expansion',Release:'Release','Follow Through':'Follow Through',Recovery:'Recovery'};
const AUTH=['Set','Setup','Draw','Anchor','Aim / Hold','Expansion','Release','Follow Through','Recovery'];
const AUTH_RANK=Object.fromEntries(AUTH.map((p,i)=>[p,i]));
const finite=v=>Number.isFinite(Number(v));
const num=(v,d=0)=>finite(v)?Number(v):d;
const aRank=p=>AUTH_RANK[String(p||'')]??-1;
function displayPhase(p){return DISPLAY_PHASE[String(p||'')]||String(p||'')||null;}
function nativeDisplay(nativeResult={}){return displayPhase(nativeResult?.phase||nativeResult?.primaryPhase)||null;}
function nativeProgressed(nativeResult={}){
  const p=String(nativeResult?.phase||nativeResult?.primaryPhase||'');
  if(['Draw','Anchor','Aim / Hold','Expansion','Release','Follow Through'].includes(p))return true;
  return Array.isArray(nativeResult?.phaseTimeline)&&nativeResult.phaseTimeline.some(e=>['Draw','Anchor','Aim / Hold','Expansion','Release','Follow Through'].includes(String(e?.phase||'')));
}
function authorityPhase(snapshot,nativeResult={}){
  const s=snapshot||{};
  if(s.terminal===true)return nativeResult?.followThroughEnded===true||s.mode==='recovery'?'Recovery':'Follow Through';
  if(s.shotActive===true&&s.authorityPhase)return s.authorityPhase;
  return 'Set';
}
function fresh(){return{
  mode:'set',shotActive:false,terminal:false,shotStartEpoch:null,releaseEpoch:null,
  stableSetSince:0,movingSince:0,provisionalSince:0,setupEvidenceSince:0,drawEvidenceSince:0,neutralReturnSince:0,
  preDrawQuietSince:0,preDrawInactiveSince:0,recoverySince:0,letDownSince:0,trackingLostSince:0,anchorEvidenceSince:0,holdEvidenceSince:0,
  lastEpoch:0,lastArmDeg:null,lastFaceDist:null,setFaceDist:null,
  lastStartEventId:0,lastRecoveryEventId:0,drawIntent:false,raiseIntent:false,preloadIntent:false,
  stableSet:false,letDownPending:false,verifiedSetup:false,verifiedDraw:false,provisional:false,
  lastReason:'waiting-set',authorityPhase:'Set',authorityRank:0,lastSnapshot:null
};}
function reset(s){Object.assign(s,fresh());return s;}
function visibility(input){
  const q=num(input?.phaseQuality,0),w=num(input?.phaseDrawWristVisibility??input?.drawWristVisibility,0),e=num(input?.phaseDrawElbowVisibility??input?.drawElbowVisibility,0);
  return {q,w,e,ok:q>=.22&&(w>=.20||e>=.22)};
}
function motion(input,s,dt){
  const bow=Math.abs(num(input?.bowSpeed,0)),draw=Math.abs(num(input?.drawSpeed,0)),face=Math.abs(num(input?.faceHandSpeed,0));
  const arm=finite(input?.bowArmDeg)?Number(input.bowArmDeg):null,fd=finite(input?.phaseFaceDist)?Number(input.phaseFaceDist):null;
  const armRate=arm!==null&&s.lastArmDeg!==null&&dt>0?Math.abs(arm-s.lastArmDeg)/(dt/1000):0;
  const faceApproach=fd!==null&&s.lastFaceDist!==null?Math.max(0,s.lastFaceDist-fd):0;
  const drawIntent=draw>=.78||face>=.88||faceApproach>=.035;
  const raiseIntent=bow>=.85||armRate>=18;
  const preloadIntent=drawIntent&&!raiseIntent;
  const moving=(Math.max(bow,draw,face)>=.78)||((bow+draw+face)>=1.65)||armRate>=18;
  const quiet=Math.max(bow,draw,face)<.58&&armRate<13;
  return{bow,draw,face,arm,fd,armRate,faceApproach,drawIntent,raiseIntent,preloadIntent,moving,quiet};
}
function advanceAuthority(s,next){
  const p=String(next||''),r=aRank(p);if(r<0)return;
  if(r>s.authorityRank){s.authorityRank=r;s.authorityPhase=p;}
}
function resetToReady(s,now,reason,{stable=true}={}){
  s.terminal=false;s.shotActive=false;s.shotStartEpoch=null;s.releaseEpoch=null;s.mode='set';
  s.drawIntent=false;s.raiseIntent=false;s.preloadIntent=false;s.movingSince=0;s.provisionalSince=0;s.setupEvidenceSince=0;s.drawEvidenceSince=0;s.neutralReturnSince=0;
  s.preDrawQuietSince=0;s.preDrawInactiveSince=0;s.recoverySince=0;s.letDownSince=0;s.anchorEvidenceSince=0;s.holdEvidenceSince=0;s.letDownPending=false;
  s.verifiedSetup=false;s.verifiedDraw=false;s.provisional=false;s.authorityPhase='Set';s.authorityRank=0;
  s.stableSet=stable;s.stableSetSince=stable?now:0;s.lastReason=reason;
}
function update(state,input={},nativeResult={},nowArg){
  const s=state||fresh(),now=finite(nowArg)?Number(nowArg):finite(input?.epochMs)?Number(input.epochMs):Date.now();
  const dt=s.lastEpoch?Math.max(1,Math.min(250,now-s.lastEpoch)):50,vis=visibility(input),mv=motion(input,s,dt);
  const posture=input?.phaseShootingPosture===true||input?.shootingPosture===true;
  const extended=input?.phaseBowExtended===true||input?.bowExtended===true;
  const setReady=input?.setReady===true;
  const shotPlaneReady=input?.bowPlaneReady===true||input?.debugBowPlaneReady===true;
  const shotPlaneStable=input?.bowPlaneStable===true||input?.debugBowPlaneStable===true;
  const admissionReady=input?.setAdmissionReady===true||input?.shotIntentReady===true;
  const drawSideVisible=input?.drawSideVisible!==false&&(vis.w>=.24||vis.e>=.26);
  const armLow=mv.arm!==null&&mv.arm<125;
  const neutralish=input?.wristsLow===true||input?.neutralEvidence===true||(!posture&&!extended)||(armLow&&!extended)||(!setReady&&!posture);
  const trustedNeutral=vis.ok&&neutralish;
  const strongNeutral=vis.ok&&(input?.neutralEvidence===true||input?.wristsLow===true||armLow)&&!posture;
  const progressed=nativeProgressed(nativeResult),rawDisplay=nativeDisplay(nativeResult);
  const terminalSignal=nativeResult?.releaseConfirmed===true||nativeResult?.shotComplete===true||nativeResult?.phase==='Follow Through'||nativeResult?.followThroughConfirmed===true;
  let event=null;

  if(!vis.ok){if(!s.trackingLostSince)s.trackingLostSince=now;}else s.trackingLostSince=0;

  if(terminalSignal&&!s.terminal){
    s.terminal=true;s.shotActive=true;s.verifiedSetup=true;s.verifiedDraw=true;s.provisional=false;s.letDownPending=false;
    s.releaseEpoch=finite(nativeResult?.releaseEpochMs)?Number(nativeResult.releaseEpochMs):now;
    s.mode='follow';s.recoverySince=0;s.lastReason='terminal-lock';advanceAuthority(s,'Release');advanceAuthority(s,'Follow Through');
  }
  if(s.terminal){
    const recovered=nativeResult?.followThroughEnded===true||(trustedNeutral&&vis.ok);
    if(recovered){if(!s.recoverySince)s.recoverySince=now;}else s.recoverySince=0;
    if((nativeResult?.followThroughEnded===true)||(s.recoverySince&&now-s.recoverySince>=160)){
      resetToReady(s,now,'recovery-complete',{stable:trustedNeutral});s.setFaceDist=mv.fd;s.lastRecoveryEventId++;
      event={type:'recovery-complete',epochMs:now,eventId:s.lastRecoveryEventId};
    }else{s.mode=nativeResult?.followThroughEnded===true?'recovery':'follow';advanceAuthority(s,s.mode==='recovery'?'Recovery':'Follow Through');}
  }else{
    // Native let-down is provisional until real neutral evidence arrives. This protects real Release
    // reaction from being destroyed while the adaptive Release arbiter is still confirming T0.
    if(nativeResult?.letDown===true&&s.shotActive){s.letDownPending=true;s.lastReason='let-down-pending';}

    if(s.letDownPending&&s.shotActive){
      if(strongNeutral){if(!s.letDownSince)s.letDownSince=now;}else s.letDownSince=0;
      if(s.letDownSince&&now-s.letDownSince>=100){
        resetToReady(s,now,'let-down-neutral',{stable:true});s.setFaceDist=mv.fd;event={type:'let-down',epochMs:now,reason:'neutral-confirmed',ready:true};
      }else if(s.shotActive){s.mode='letdown-pending';}
    }

    if(!event&&!s.shotActive){
      // Mature-core repair is deliberately strict. A scratch/head-touch may make the raw detector
      // say Draw, but without a plausible shot plane/admission it remains only a private hypothesis.
      const matureRepair=progressed&&vis.ok&&(posture||extended)&&drawSideVisible&&(admissionReady||shotPlaneStable||(shotPlaneReady&&posture));
      if(matureRepair){
        s.shotActive=true;s.verifiedSetup=true;s.verifiedDraw=true;s.provisional=false;s.shotStartEpoch=s.shotStartEpoch||now;
        s.stableSet=false;s.drawIntent=true;s.raiseIntent=s.raiseIntent||mv.raiseIntent;s.preloadIntent=s.preloadIntent||mv.preloadIntent;
        s.mode='draw-building';s.lastReason='native-progress-verified-repair';advanceAuthority(s,'Setup');advanceAuthority(s,rawDisplay||'Draw');
        s.lastStartEventId++;event={type:'shot-start',epochMs:s.shotStartEpoch,eventId:s.lastStartEventId,drawIntent:true,raiseIntent:s.raiseIntent,preloadIntent:s.preloadIntent,verifiedStart:true,verifiedDraw:true,bowPlaneReady:shotPlaneReady||shotPlaneStable,source:'native-progress-verified-repair'};
      }else{
        const setCandidate=vis.ok&&(neutralish||setReady||posture);
        if(setCandidate&&mv.quiet){if(!s.stableSetSince)s.stableSetSince=now;if(now-s.stableSetSince>=90){s.stableSet=true;s.mode='set';s.setFaceDist=mv.fd;s.lastReason='stable-set';s.authorityPhase='Set';s.authorityRank=0;}}
        else if(!mv.moving)s.stableSetSince=0;

        // Ordinary movement is provisional only. It does NOT become athlete-facing Setup/Draw.
        if(s.stableSet&&vis.ok&&mv.moving&&(mv.raiseIntent||mv.drawIntent)){
          if(!s.provisionalSince)s.provisionalSince=now;s.provisional=true;s.mode='provisional';s.lastReason='possible-shot-motion';
          s.drawIntent=s.drawIntent||mv.drawIntent;s.raiseIntent=s.raiseIntent||mv.raiseIntent;s.preloadIntent=s.preloadIntent||mv.preloadIntent;
        }else if(!mv.moving){s.provisionalSince=0;s.provisional=false;s.drawIntent=false;s.raiseIntent=false;s.preloadIntent=false;s.mode='set';s.lastReason='provisional-cancelled';}

        // Setup becomes public only after bow-plane geometry itself supports a shot hypothesis for
        // a sustained window. This blocks scratch/head-touch/face-touch movement from leaving Set.
        const setupProof=vis.ok&&shotPlaneReady&&drawSideVisible&&(admissionReady||shotPlaneStable||posture)&&(mv.raiseIntent||mv.drawIntent||extended||posture);
        if(setupProof){if(!s.setupEvidenceSince)s.setupEvidenceSince=now;}else s.setupEvidenceSince=0;
        if(s.stableSet&&s.setupEvidenceSince&&now-s.setupEvidenceSince>=110){
          s.shotActive=true;s.verifiedSetup=true;s.provisional=false;s.shotStartEpoch=s.provisionalSince||s.setupEvidenceSince;s.stableSet=false;
          s.mode='setup-building';s.lastReason='verified-setup';advanceAuthority(s,'Setup');s.lastStartEventId++;
          event={type:'shot-start',epochMs:s.shotStartEpoch,eventId:s.lastStartEventId,drawIntent:s.drawIntent,raiseIntent:s.raiseIntent,preloadIntent:s.preloadIntent,verifiedStart:true,verifiedDraw:false,bowPlaneReady:true,source:'verified-shot-plane-setup'};
        }
      }
    }else if(!event&&s.shotActive&&!s.letDownPending){
      const age=s.shotStartEpoch?now-s.shotStartEpoch:0;
      // Until Draw is verified, Setup may still be abandoned. Returning to trusted neutral is an
      // explicit false-start escape, not a backwards phase transition inside a verified shot.
      if(!s.verifiedDraw){
        const drawProof=vis.ok&&drawSideVisible&&posture&&(admissionReady||shotPlaneStable||(shotPlaneReady&&extended))&&(mv.drawIntent||rawDisplay==='Draw'||progressed);
        if(drawProof){if(!s.drawEvidenceSince)s.drawEvidenceSince=now;}else s.drawEvidenceSince=0;
        if(s.drawEvidenceSince&&now-s.drawEvidenceSince>=70){
          s.verifiedDraw=true;s.mode='draw-building';s.lastReason='verified-draw';advanceAuthority(s,'Draw');
        }
        if(strongNeutral){if(!s.neutralReturnSince)s.neutralReturnSince=now;}else s.neutralReturnSince=0;
        const falseStart=s.neutralReturnSince&&now-s.neutralReturnSince>=220;
        const staleSetup=age>=4500&&(!shotPlaneReady||!posture)&&(!s.drawEvidenceSince||now-s.drawEvidenceSince>=650);
        if(falseStart||staleSetup){
          resetToReady(s,now,falseStart?'pre-draw-return-to-set':'pre-draw-timeout',{stable:trustedNeutral});s.setFaceDist=mv.fd;
          event={type:'shot-abort',epochMs:now,reason:s.lastReason};
        }
      }else{
        // Plan-B neutral closure: if the native detector misses a deliberate let-down edge, a
        // sustained strong neutral return still closes the verified shot as 0 Capture. Uncertainty
        // never reverses phases; it either holds authority or terminates cleanly at neutral.
        if(strongNeutral){if(!s.neutralReturnSince)s.neutralReturnSince=now;}else s.neutralReturnSince=0;
        if(s.neutralReturnSince&&now-s.neutralReturnSince>=320){
          resetToReady(s,now,'verified-draw-neutral-let-down',{stable:true});s.setFaceDist=mv.fd;
          event={type:'let-down',epochMs:now,reason:'neutral-fallback',ready:true};
        }
      }
      if(s.shotActive&&!event){
        s.drawIntent=s.drawIntent||mv.drawIntent;s.raiseIntent=s.raiseIntent||mv.raiseIntent;s.preloadIntent=s.preloadIntent||mv.preloadIntent;
        if(s.verifiedDraw){
          if(mv.drawIntent&&mv.raiseIntent)s.mode='setup-draw-overlap';
          else if(mv.drawIntent)s.mode='draw-building';
          else s.mode='building';
          // BLE438954 PhaseTruthGuard: raw phase labels are hypotheses, not authority.
          // Anchor may not advance while the draw hand is still materially travelling. Aim/Hold
          // requires a short settled plateau after Anchor. This prevents Review's Anchor button
          // from targeting a frame that is visibly still Draw.
          const anchorCandidate=['Anchor','Aim / Hold','Expansion'].includes(rawDisplay)&&mv.draw<.72&&mv.face<.82&&posture&&drawSideVisible;
          if(anchorCandidate){if(!s.anchorEvidenceSince)s.anchorEvidenceSince=now;}else s.anchorEvidenceSince=0;
          if(s.authorityRank<aRank('Anchor')&&s.anchorEvidenceSince&&now-s.anchorEvidenceSince>=90)advanceAuthority(s,'Anchor');
          const holdCandidate=s.authorityRank>=aRank('Anchor')&&['Aim / Hold','Expansion'].includes(rawDisplay)&&mv.draw<.60&&mv.face<.72;
          if(holdCandidate){if(!s.holdEvidenceSince)s.holdEvidenceSince=now;}else s.holdEvidenceSince=0;
          const anchorMature=s.anchorEvidenceSince&&now-s.anchorEvidenceSince>=90;
          if(s.authorityRank<aRank('Aim / Hold')&&holdCandidate&&(anchorMature||(s.holdEvidenceSince&&now-s.holdEvidenceSince>=80)))advanceAuthority(s,'Aim / Hold');
          if(rawDisplay==='Expansion'&&s.authorityRank>=aRank('Aim / Hold'))advanceAuthority(s,'Expansion');
          if(s.authorityRank<aRank('Anchor'))advanceAuthority(s,'Draw');
        }else{
          s.mode='setup-building';s.authorityPhase='Setup';s.authorityRank=aRank('Setup');
        }
      }
    }
  }

  s.lastEpoch=now;s.lastArmDeg=mv.arm;s.lastFaceDist=mv.fd;
  s.lastSnapshot={version:VERSION,mode:s.mode,shotActive:s.shotActive,terminal:s.terminal,stableSet:s.stableSet,shotStartEpoch:s.shotStartEpoch,drawIntent:s.drawIntent,raiseIntent:s.raiseIntent,preloadIntent:s.preloadIntent,letDownPending:s.letDownPending,verifiedSetup:s.verifiedSetup,verifiedDraw:s.verifiedDraw,provisional:s.provisional,authorityPhase:s.authorityPhase,authorityRank:s.authorityRank,trackingGapMs:s.trackingLostSince?Math.max(0,now-s.trackingLostSince):0,motion:{bow:mv.bow,draw:mv.draw,face:mv.face,armRate:mv.armRate,faceApproach:mv.faceApproach,moving:mv.moving,quiet:mv.quiet},reason:s.lastReason};
  return{state:s,event,snapshot:s.lastSnapshot};
}

function reconcileResult(state,nativeResult={},nowArg){
  const s=state||fresh(),now=finite(nowArg)?Number(nowArg):Date.now(),raw=nativeDisplay(nativeResult);
  const terminalSignal=nativeResult?.releaseConfirmed===true||nativeResult?.shotComplete===true||nativeResult?.phase==='Follow Through'||nativeResult?.followThroughConfirmed===true;
  if(terminalSignal&&!s.terminal){
    s.terminal=true;s.shotActive=true;s.verifiedSetup=true;s.verifiedDraw=true;s.provisional=false;s.letDownPending=false;s.releaseEpoch=finite(nativeResult?.releaseEpochMs)?Number(nativeResult.releaseEpochMs):now;
    s.mode='follow';s.recoverySince=0;s.lastReason='terminal-lock';advanceAuthority(s,'Release');advanceAuthority(s,'Follow Through');
  }else if(!s.terminal&&nativeResult?.letDown===true&&s.shotActive){s.letDownPending=true;s.mode='letdown-pending';s.lastReason='let-down-pending';}
  // BLE438955 Motion-gated reconciliation: preserve fast real-shot catch-up, but raw Anchor/Hold/
  // Expansion cannot override a current frame that is still physically drawing toward the face.
  else if(!s.terminal&&s.shotActive&&s.verifiedDraw&&raw){
    const mot=s.lastSnapshot?.motion||{},stillDrawing=num(mot.draw,0)>=.72||num(mot.face,0)>=.82;
    if(!(stillDrawing&&aRank(raw)>aRank('Draw')))advanceAuthority(s,raw);
  }
  if(s.lastSnapshot)s.lastSnapshot={...s.lastSnapshot,mode:s.mode,shotActive:s.shotActive,terminal:s.terminal,letDownPending:s.letDownPending,verifiedSetup:s.verifiedSetup,verifiedDraw:s.verifiedDraw,provisional:s.provisional,authorityPhase:s.authorityPhase,authorityRank:s.authorityRank,reason:s.lastReason};
  return{state:s,snapshot:s.lastSnapshot};
}
return{VERSION,DISPLAY_PHASE,displayPhase,authorityPhase,fresh,reset,update,reconcileResult};
});

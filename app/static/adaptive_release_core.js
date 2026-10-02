// 3PM BLE4.3.8.9.4 Adaptive Release Sentinel · persistent pending-release arbitration
// Release arbitration layer for the frozen Dev4 detector.
// Goals: listen for genuine Release immediately after verified Anchor/Hold (no minimum visible
// Expansion travel), preserve deliberate let-down as 0 Capture, and keep tentative native Release
// invisible until post-release validation is real.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AdaptiveReleaseCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='BLE4.3.8.9.5.7-adaptive-release-v16';
const PHASES=['Setup','Set','Draw','Anchor','Aim / Hold','Expansion','Release','Follow Through'];
const RANK=Object.fromEntries(PHASES.map((p,i)=>[p,i]));
const finite=v=>(typeof v==='number'||(typeof v==='string'&&v.trim()!==''))&&Number.isFinite(Number(v));
const num=(v,d=0)=>finite(v)?Number(v):d;
const rank=p=>RANK[String(p||'')]??-1;
function hasPhase(m,p){return (m?.phase===p)||(m?.primaryPhase===p)||(Array.isArray(m?.phaseTimeline)&&m.phaseTimeline.some(e=>String(e?.phase)===p&&finite(e?.epochMs)));}
function fresh(){return{nativeOnset:null,nativePostWitness:null,reachedHold:false,reachedAnchor:false,provisional:null,preArmCandidate:null,holdWatchCandidate:null,terminalCandidate:null,preArmContext:[],latched:false,latchedSource:null,completeEmitted:false,recoverySince:0,recoveryEmitted:false,releaseEpochMs:null,confidence:null,releaseEventId:0,letDownArbitrationSince:0,lastDecision:'idle'};}
function reset(s){Object.assign(s,fresh());return s;}
function timeline(m,releaseEpoch,followEpoch=null){
  const rows=(Array.isArray(m?.phaseTimeline)?m.phaseTimeline:[]).filter(e=>PHASES.includes(String(e?.phase))&&finite(e?.epochMs)&&!['Release','Follow Through'].includes(String(e?.phase))).map(e=>({...e,epochMs:Number(e.epochMs),role:'side'}));
  const add=(phase,epoch)=>{if(!finite(epoch)||rows.some(e=>e.phase===phase))return;rows.push({phase,epochMs:Number(epoch),role:'side',confidence:null});};
  add('Release',releaseEpoch);if(finite(followEpoch))add('Follow Through',followEpoch);
  rows.sort((a,b)=>a.epochMs-b.epochMs);const out=[];let hi=-1;
  for(const e of rows){const r=rank(e.phase);if(r<hi||r===hi)continue;out.push(e);hi=r;}
  return out;
}
function candidateEvidence(m,input){
  const rear=num(m?.releaseRearStep),faceRear=num(m?.releaseFaceRearStep),rearT=Math.max(.0045,num(m?.releaseRearThreshold,.0045));
  const speed=num(m?.releaseFrameSpeed),speedT=Math.max(.07,num(m?.releaseSpeedThreshold,.07));
  const elbow=num(m?.releaseElbowRearStep),coreCandidate=!!m?.releaseCandidate;
  const quality=num(input?.phaseQuality,1)>=.34&&num(input?.measurementTrustScore,1)>=.28;
  const shotIntentVerified=input?.shotIntentVerified===true||input?.debugShotIntentVerified===true;
  const visible=num(input?.phaseDrawWristVisibility??input?.drawWristVisibility,1)>=.20&&num(input?.phaseDrawElbowVisibility??input?.drawElbowVisibility,1)>=.22;
  const hardLowering=input?.wristsLow===true||(input?.phaseShootingPosture===false&&input?.setReady!==true)||(input?.phaseBowExtended===false&&input?.setReady!==true);
  const directionalLowering=!!m?.letDownDirectional;
  const armed=m?.armed===true;
  const coreImpulse=coreCandidate&&armed&&rear>=Math.max(.006,rearT*.72)&&speed>=Math.max(.22,speedT*.62)&&elbow>=-.002;
  const expansionSeen=hasPhase(m,'Expansion')||String(m?.phase||'')==='Expansion'||String(m?.primaryPhase||'')==='Expansion';
  const matureImpulse=!coreCandidate&&armed&&rear>=Math.max(.010,rearT*.95)&&speed>=Math.max(.34,speedT*.58)&&elbow>=.0025&&(input?.visualMotionCorroborated===true||rear>=Math.max(.020,rearT*1.8));
  const expansionImpulse=!coreCandidate&&expansionSeen&&armed&&rear>=Math.max(.008,rearT*.68)&&speed>=Math.max(.28,speedT*.48)&&elbow>=.004&&(input?.visualMotionCorroborated===true||rear>=Math.max(.014,rearT*.80));
  const ultraImpulse=!coreCandidate&&armed&&rear>=Math.max(.060,rearT*1.35)&&speed>=Math.max(.95,speedT*1.05)&&elbow>=.015;
  // Fast-release rescue is only a deferred candidate. It may be created before native arming,
  // but can NEVER Capture by itself. It needs a subsequent terminal edge while posture remains intact.
  const preArmImpulse=!armed&&shotIntentVerified&&quality&&visible&&!hardLowering&&
    rear>=Math.max(.075,rearT*8.0)&&faceRear>=Math.max(.060,rearT*6.0)&&speed>=Math.max(1.45,speedT*8.0)&&elbow>=.028&&
    input?.visualMotionCorroborated===true;

  // BLE43893: Olympic-recurve Expansion can be visually microscopic.  Release listening therefore
  // starts as soon as Anchor + Aim/Hold are verified.  This is ONLY a deferred witness: it cannot
  // Capture on its own and it does not require native arming or an Expansion milestone.  Direction
  // is taken from the draw-hand/face channels; elbow magnitude is support only because a real release
  // may move the elbow either way in a 2-D Side projection.
  const elbowAbs=Math.abs(elbow),bow=num(input?.bowSpeed);
  const watchRear=rear>=Math.max(.035,rearT*.42);
  const watchFace=faceRear>=Math.max(.035,rearT*.42);
  const watchSpeed=speed>=Math.max(.45,speedT*.38);
  const watchElbow=elbowAbs>=.070;
  const watchBow=bow>=.75;
  const watchLocal=input?.visualMotionCorroborated===true;
  const watchChannels=(watchRear?1:0)+(watchFace?1:0)+(watchSpeed?1:0)+(watchElbow?1:0)+(watchBow?1:0)+(watchLocal?1:0);
  const holdWatchImpulse=shotIntentVerified&&quality&&visible&&!hardLowering&&(watchRear||watchFace)&&(watchSpeed||watchElbow)&&watchChannels>=3;
  const watchScore=(watchRear?1:0)+(watchFace?1:0)+(watchSpeed?.75:0)+(watchElbow?.70:0)+(watchBow?.35:0)+(watchLocal?.25:0)+Math.max(0,rear)*2+Math.max(0,faceRear)*1.4+elbowAbs*.45;
  const rr=rear/rearT,sr=speed/speedT;
  const score=Math.max(0,rr)*.34+Math.max(0,sr)*.28+Math.max(0,elbow)*8*.22+(coreCandidate?.28:0)+(matureImpulse?.16:0)+(expansionImpulse?.12:0)+(input?.visualMotionCorroborated===true?.10:0)-(directionalLowering?.04:0);
  const terminalExpansion=expansionSeen&&rear>=Math.max(.007,rearT*.62)&&speed>=Math.max(.24,speedT*.42)&&elbow>=.003;
  const terminalHoldOnly=!expansionSeen&&(coreCandidate||matureImpulse||ultraImpulse)&&rear>=Math.max(.009,rearT*.88)&&speed>=Math.max(.30,speedT*.58)&&elbow>=.006;
  const terminalEligible=shotIntentVerified&&quality&&visible&&!hardLowering&&armed&&(terminalExpansion||terminalHoldOnly);
  return{ok:shotIntentVerified&&quality&&visible&&!hardLowering&&(coreImpulse||matureImpulse||ultraImpulse),terminalEligible,preArmImpulse,holdWatchImpulse,watchScore,watchChannels,watchRear,watchFace,watchSpeed,watchElbow,watchBow,watchLocal,shotIntentVerified,coreCandidate,matureImpulse,expansionImpulse,ultraImpulse,hardLowering,directionalLowering,rear,faceRear,rearT,speed,speedT,elbow,score};
}
// Negative evidence belongs to the impulse, not just the current frame. Once a measured
// collapse contradicts T0, a posture rebound cannot make that same witness valid again.
function markBowArmCollapse(c,input){
  if(c&&finite(c.onsetBowArm)&&finite(input?.bowArmDeg)&&Number(c.onsetBowArm)-Number(input.bowArmDeg)>=7.5)c.bowArmCollapsed=true;
}
function physicalTerminalRescue(c,m,input,now,{preArm=false}={}){
  if(!c||c.bowArmCollapsed)return false;
  const age=now-c.seenAt;if(age<0||age>(preArm?180:520))return false;
  const physicalReady=(input?.physicalSetReady??input?.nativeSetReady??input?.setReady)===true;
  const postureIntact=input?.phaseShootingPosture!==false&&input?.phaseBowExtended!==false&&physicalReady&&input?.wristsLow!==true;
  if(!postureIntact)return false;
  const face=finite(input?.phaseFaceDist)?Number(input.phaseFaceDist):null;
  const faceDeparture=face!==null&&finite(c.onsetFace)?face-Number(c.onsetFace):0;
  const bow=num(input?.bowSpeed);
  const onsetStrong=preArm
    ? c.rear>=.075&&c.faceRear>=.060&&c.elbow>=.028&&c.speed>=1.45
    : c.score>=1.05&&c.rear>=Math.max(.008,c.rearT*.65)&&c.speed>=Math.max(.30,c.speedT*.50)&&c.elbow>=.002;
  return onsetStrong&&faceDeparture>=.055&&bow>=.55;
}
// Compact releases can be missed before the frozen Hold baseline arms.  Do not commit them
// on the first post-impulse frame: that confused a real field abort with Release.  Instead keep
// the physical T0 as a witness and only rescue it when the frozen core reaches its terminal
// let-down edge quickly while the athlete is still in shooting posture and the hand has NOT
// travelled materially away from the anchor.  This makes the terminal edge an arbitration
// point, not the release timestamp.
function compactTerminalRescue(c,m,input,now){
  if(!c||c.bowArmCollapsed||m?.letDown!==true)return false;
  const age=now-c.seenAt;if(age<80||age>225)return false;
  const physicalReady=(input?.physicalSetReady??input?.nativeSetReady??input?.setReady)===true;
  const postureIntact=input?.phaseShootingPosture!==false&&input?.phaseBowExtended!==false&&physicalReady&&input?.wristsLow!==true;
  if(!postureIntact)return false;
  const face=finite(input?.phaseFaceDist)?Number(input.phaseFaceDist):null;
  if(face===null||!finite(c.onsetFace))return false;
  const terminalFaceDelta=face-Number(c.onsetFace);
  const maxPost=finite(c.maxPostFaceDelta)?Number(c.maxPostFaceDelta):terminalFaceDelta;
  const minPost=finite(c.minPostFaceDelta)?Number(c.minPostFaceDelta):terminalFaceDelta;
  const onsetStrong=c.rear>=.12&&c.faceRear>=.10&&c.elbow>=.055&&c.speed>=2.6&&c.score>=1.0&&num(c.preFaceRise)<=.065;
  const boundedCompactPath=maxPost<=.095&&minPost>=-.085&&terminalFaceDelta>=-.035&&terminalFaceDelta<=.085;
  const bowReaction=num(input?.bowSpeed)>=.40;
  return onsetStrong&&boundedCompactPath&&bowReaction;
}

// BLE43893 real-bow terminal arbitration.  A Hold watcher is a witness, never a Capture trigger.
// Commit only when the frozen core reaches its immediate let-down/reset edge while shooting posture
// and bow extension are still intact.  Deliberate lowering normally loses bow extension and/or shows
// a large monotonic face-distance departure; a real Release may oscillate/reverse within the short
// reaction window, so elbow sign and minimum Expansion travel are deliberately not required.
function holdWatchTerminalRescue(c,m,input,now){
  if(!c||c.bowArmCollapsed||m?.letDown!==true)return false;
  // BLE43894 keeps a strong multi-channel T0 witness alive long enough to observe the actual
  // physical terminal edge. Real releases can reverse sign for several Side-view frames; a smooth
  // deliberate let-down still loses on sustained lowering/neutral evidence.
  const age=now-c.seenAt;if(age<35||age>720)return false;
  const postureIntact=input?.phaseShootingPosture!==false&&input?.phaseBowExtended!==false&&input?.wristsLow!==true;
  if(!postureIntact)return false;
  const onsetBowArm=finite(c.onsetBowArm)?Number(c.onsetBowArm):null,currentBowArm=finite(input?.bowArmDeg)?Number(input.bowArmDeg):null;
  const bowArmCollapse=onsetBowArm!==null&&currentBowArm!==null&&(onsetBowArm-currentBowArm)>=7.5;
  if(bowArmCollapse)return false;
  const face=finite(input?.phaseFaceDist)?Number(input.phaseFaceDist):null;
  if(face===null||!finite(c.onsetFace))return false;
  const terminalFaceDelta=face-Number(c.onsetFace);
  const maxPost=finite(c.maxPostFaceDelta)?Number(c.maxPostFaceDelta):terminalFaceDelta;
  const returnedFromPeak=maxPost-terminalFaceDelta>=.10;
  const compactOrReturned=terminalFaceDelta<=.20&&(maxPost<=.24||returnedFromPeak||terminalFaceDelta<=0);
  const reaction=Math.max(num(c.maxBow),num(input?.bowSpeed))>=.70;
  const multiChannel=num(c.channels)>=3&&(c.rearPositive===true||c.facePositive===true)&&(c.speedSupport===true||c.elbowSupport===true);
  const strongWitness=num(c.score)>=2.20||num(c.channels)>=5;
  const notLongLowering=num(c.directionalFrames)<=6;
  return strongWitness&&multiChannel&&reaction&&compactOrReturned&&notLongLowering;
}
// The athlete engine returns a snapshot taken at initial confirmation while a shot is pending.
// Read the actual Side tracker separately so validated post-release proof is not lost. Only
// retain independently corroborated, multi-step evidence for this exact native release.
function observeNativePost(s,obs,input,now){
  if(!obs)return;
  if(obs.releaseInvalidated===true||obs.letDown===true){s.nativeOnset=null;s.nativePostWitness=null;return;}
  if(obs.releaseConfirmed!==true||!finite(obs.releaseEpochMs))return;
  const epoch=Number(obs.releaseEpochMs);
  if(!s.nativeOnset||s.nativeOnset.epochMs!==epoch){
    s.nativeOnset={epochMs:epoch,onsetBowArm:finite(input?.bowArmDeg)?Number(input.bowArmDeg):null};
    s.nativePostWitness=null;
  }
  markBowArmCollapse(s.nativeOnset,input);
  const direction=num(obs.releaseDirectionalSteps)>=2&&num(obs.releaseRearAccum)>=Math.max(.008,num(obs.releaseRearThreshold,.0045)*1.35)&&num(obs.releaseElbowRearAccum)>=.020;
  if(!s.nativePostWitness&&obs.postReleaseEvidence===true&&(obs.releasePostIndependent===true||obs.releasePostBlurSupported===true)&&
    obs.releasePostLetDown!==true&&!s.nativeOnset.bowArmCollapsed&&input?.wristsLow!==true&&input?.phaseShootingPosture!==false&&input?.phaseBowExtended!==false&&direction){
    s.nativePostWitness={epochMs:epoch,eventId:finite(obs.releaseEventId)?Number(obs.releaseEventId):null,seenAt:now,source:'side-tracker-post-validation'};
  }
}
function update(state,m={},input={},nowArg,nativeObservation=null){
  const s=state||fresh(),now=finite(nowArg)?Number(nowArg):finite(input?.epochMs)?Number(input.epochMs):Date.now();
  observeNativePost(s,nativeObservation,input,now);
  if(s.nativeOnset)markBowArmCollapse(s.nativeOnset,input);
  const witnesses=[s.provisional,s.preArmCandidate,s.holdWatchCandidate,s.terminalCandidate];
  for(const witness of witnesses)markBowArmCollapse(witness,input);
  const contradictedWitness=witnesses.some(c=>c?.bowArmCollapsed===true);
  // Preserve a short PRE-candidate context. Compact releases can look like a one-frame impulse,
  // but a deliberate return/let-down normally has already started drifting away from the anchor.
  // The current sample is appended only after the pre-context snapshot is taken, so it cannot
  // manufacture its own history. This is diagnostic/arbitration state only; frozen Dev4 is untouched.
  const preContext=(Array.isArray(s.preArmContext)?s.preArmContext:[]).filter(x=>now-x.t>=0&&now-x.t<=190);
  const recentFace=preContext.filter(x=>now-x.t<=150&&finite(x.face));
  const preFaceRise=recentFace.length>=2?Number(recentFace[recentFace.length-1].face)-Number(recentFace[0].face):0;
  const preDirectionalCount=preContext.filter(x=>now-x.t<=125&&x.directional===true).length;
  s.preArmContext=[...preContext,{t:now,face:finite(input?.phaseFaceDist)?Number(input.phaseFaceDist):null,directional:m?.letDownDirectional===true,bow:num(input?.bowSpeed),phase:String(m?.phase||m?.primaryPhase||'')}].slice(-8);
  const pRank=Math.max(rank(m?.phase),rank(m?.primaryPhase));
  s.reachedAnchor=s.reachedAnchor||pRank>=rank('Anchor')||hasPhase(m,'Anchor');
  s.reachedHold=s.reachedHold||pRank>=rank('Aim / Hold')||hasPhase(m,'Aim / Hold');

  // Native Release is provisional until the frozen core has completed post-release validation.
  // Hiding the tentative Release prevents Live Phase from advancing to Release and then being
  // contradicted back to Hold on a false candidate. The frozen core itself remains untouched.
  if(m?.releaseConfirmed===true&&!s.latched){
    // A terminal recovery frame must be allowed through even when a previously rejected/tentative
    // native release never became a capturable transaction. Otherwise Foundation would remain
    // terminal-locked forever. This path cannot Capture because shotComplete is still false.
    if(m?.followThroughEnded===true&&m?.shotComplete!==true){s.provisional=null;s.preArmCandidate=null;s.holdWatchCandidate=null;s.terminalCandidate=null;s.lastDecision='native-terminal-recovery';return{override:false,state:s};}
    if(m?.shotComplete===true&&m?.postReleaseEvidence===true){
      // R4 user-ground-truth guard: a deliberate hand-down can briefly satisfy the frozen native
      // Release/Follow transaction while still carrying only a weak rearward release signature.
      // Do not commit that weak terminal packet. Keep it provisional so neutral/lowering can win.
      // Strong real releases (including no-visible-Expansion shots) still pass immediately.
      const rear=num(m?.releaseRearStep),faceRear=num(m?.releaseFaceRearStep),acc=num(m?.releaseRearAccum),elAcc=num(m?.releaseElbowRearAccum),spd=num(m?.releaseFrameSpeed),bow=num(input?.bowSpeed);
      const traceEvidencePresent=['releaseRearStep','releaseFaceRearStep','releaseRearAccum','releaseElbowRearAccum','releaseFrameSpeed'].some(k=>Object.prototype.hasOwnProperty.call(m,k));
      const strongCurrent=(rear>=.055&&faceRear>=.045&&spd>=1.35&&bow>=.55);
      const strongAccum=(acc>=.085&&(elAcc>=.020||spd>=1.80));
      const witness=s.nativePostWitness;
      const nativeContradiction=s.nativeOnset?.bowArmCollapsed===true||input?.wristsLow===true||input?.phaseShootingPosture===false||input?.phaseBowExtended===false||nativeObservation?.releasePostLetDown===true||nativeObservation?.releaseInvalidated===true||nativeObservation?.letDown===true||m?.releasePostLetDown===true||m?.releaseInvalidated===true||m?.letDown===true;
      const sameNativeProof=!nativeContradiction&&!!witness&&finite(m?.releaseEpochMs)&&Number(m.releaseEpochMs)===witness.epochMs&&
        (witness.eventId===null||!finite(m?.releaseEventId)||Number(m.releaseEventId)===witness.eventId)&&now-witness.seenAt>=0&&now-witness.seenAt<=900;
      const independent=m?.releasePostIndependent===true||m?.releasePostBlurSupported===true||sameNativeProof;
      const weakNativeTerminal=nativeContradiction||(traceEvidencePresent&&!strongCurrent&&!strongAccum&&!independent);
      if(weakNativeTerminal){
        const fallback=hasPhase(m,'Expansion')?'Expansion':'Aim / Hold';
        const safeTimeline=(Array.isArray(m?.phaseTimeline)?m.phaseTimeline:[]).filter(e=>!['Release','Follow Through'].includes(String(e?.phase)));
        s.lastDecision=nativeContradiction?'native-release-veto-contradiction':'native-release-veto-weak-terminal';
        return{override:true,event:'native-release-weak-terminal',state:s,patch:{phase:fallback,primaryPhase:'Aim / Hold',didRelease:false,releaseConfirmed:false,releaseInvalidated:false,releaseCandidate:true,releaseConfidence:null,releaseEpochMs:null,postReleaseEvidence:false,followThroughConfirmed:false,followThroughEnded:false,shotComplete:false,shotCompleteEventId:0,shotEvent:null,letDown:false,blocker:'native_release_weak_terminal',phaseTimeline:safeTimeline}};
      }
      s.provisional=null;s.preArmCandidate=null;s.holdWatchCandidate=null;s.lastDecision=sameNativeProof?'native-release-live-post-proof':'native-release';return{override:false,state:s};
    }
    const fallback=hasPhase(m,'Expansion')?'Expansion':'Aim / Hold';
    const safeTimeline=(Array.isArray(m?.phaseTimeline)?m.phaseTimeline:[]).filter(e=>!['Release','Follow Through'].includes(String(e?.phase)));
    s.lastDecision='native-release-pending-validation';
    return{override:true,event:'native-release-pending',state:s,patch:{phase:fallback,primaryPhase:'Aim / Hold',didRelease:false,releaseConfirmed:false,releaseInvalidated:false,releaseCandidate:true,releaseConfidence:null,releaseEpochMs:null,postReleaseEvidence:false,followThroughConfirmed:false,followThroughEnded:false,shotComplete:false,shotCompleteEventId:0,shotEvent:null,letDown:false,blocker:'native_release_pending_validation',phaseTimeline:safeTimeline}};
  }
  if(m?.releaseConfirmed===true&&s.latched){s.provisional=null;s.preArmCandidate=null;s.lastDecision='native-corroborated';}

  if(!s.latched&&s.reachedHold&&s.reachedAnchor){
    const ev=candidateEvidence(m,input);

    // Early Release readiness from verified Anchor/Hold.  No visible Expansion distance is required.
    // The witness is intentionally permissive at T0, then conservative at the terminal arbitration
    // edge so that a one-frame Expansion pulse cannot Capture by itself.
    if(ev.holdWatchImpulse&&!contradictedWitness){
      const epoch=finite(input?.epochMs)?Number(input.epochMs):now;
      const wc={epochMs:epoch,seenAt:now,onsetFace:finite(input?.phaseFaceDist)?Number(input.phaseFaceDist):null,onsetBowArm:finite(input?.bowArmDeg)?Number(input.bowArmDeg):null,rear:ev.rear,faceRear:ev.faceRear,elbow:ev.elbow,speed:ev.speed,bow:num(input?.bowSpeed),score:ev.watchScore,channels:ev.watchChannels,rearPositive:ev.watchRear,facePositive:ev.watchFace,speedSupport:ev.watchSpeed,elbowSupport:ev.watchElbow,maxPostFaceDelta:0,minPostFaceDelta:0,lastPostFaceDelta:0,maxBow:num(input?.bowSpeed),maxSpeed:ev.speed,maxElbowAbs:Math.abs(ev.elbow),directionalFrames:m?.letDownDirectional===true?1:0,positiveFrames:(ev.watchRear||ev.watchFace)?1:0,negativeFrames:0,source:'anchor-hold-release-watch'};
      if(!s.holdWatchCandidate||now-s.holdWatchCandidate.seenAt>700||wc.score>s.holdWatchCandidate.score*1.22||((now-s.holdWatchCandidate.seenAt)>240&&wc.score>=s.holdWatchCandidate.score*.96)){s.holdWatchCandidate=wc;s.lastDecision='hold-release-watch';}
    }
    const hw=s.holdWatchCandidate;
    if(hw&&!s.latched){
      const age=now-hw.seenAt,face=finite(input?.phaseFaceDist)?Number(input.phaseFaceDist):null;
      if(face!==null&&finite(hw.onsetFace)){
        const delta=face-Number(hw.onsetFace);hw.lastPostFaceDelta=delta;hw.maxPostFaceDelta=Math.max(num(hw.maxPostFaceDelta,delta),delta);hw.minPostFaceDelta=Math.min(num(hw.minPostFaceDelta,delta),delta);
      }
      hw.maxBow=Math.max(num(hw.maxBow),num(input?.bowSpeed));hw.maxSpeed=Math.max(num(hw.maxSpeed),num(m?.releaseFrameSpeed));hw.maxElbowAbs=Math.max(num(hw.maxElbowAbs),Math.abs(num(m?.releaseElbowRearStep)));
      if(m?.letDownDirectional===true)hw.directionalFrames++;
      if(num(m?.releaseRearStep)>.02||num(m?.releaseFaceRearStep)>.02)hw.positiveFrames++;
      if(num(m?.releaseRearStep)<-.02&&num(m?.releaseFaceRearStep)<-.02)hw.negativeFrames++;
      if(age>760){s.holdWatchCandidate=null;if(s.lastDecision==='hold-release-watch')s.lastDecision='hold-release-watch-expired';}
    }

    if(ev.preArmImpulse&&!contradictedWitness){
      // Do not promote an impulse that arrives after the draw hand has already been travelling
      // away from the face. That pattern is the field signature of the known Hold/return false
      // positive. Small pre-release motion is allowed; only a material outward trend is vetoed.
      const preLoweringTrend=preFaceRise>=.065;
      if(!preLoweringTrend){
        s.preArmCandidate={epochMs:finite(input?.epochMs)?Number(input.epochMs):now,seenAt:now,onsetFace:finite(input?.phaseFaceDist)?Number(input.phaseFaceDist):null,onsetBowArm:finite(input?.bowArmDeg)?Number(input.bowArmDeg):null,rear:ev.rear,faceRear:ev.faceRear,elbow:ev.elbow,speed:ev.speed,rearT:ev.rearT,speedT:ev.speedT,score:ev.score,preFaceRise,preDirectionalCount,maxPostFaceDelta:0,minPostFaceDelta:0,lastPostFaceDelta:0};
        s.lastDecision='prearm-release-candidate';
      }else s.lastDecision='prearm-veto-preexisting-face-departure';
    }
    if(m?.armed===true&&m?.releaseCandidate===true)s.preArmCandidate=null;
    if(s.preArmCandidate&&now-s.preArmCandidate.seenAt>225)s.preArmCandidate=null;

    // Track the compact pre-arm witness through a short arbitration window.  It is NOT allowed
    // to Capture here.  Capture can happen only at a later terminal edge (or through the normal
    // armed/current-escape path below).  This prevents ordinary Hold/return motion from being
    // promoted just because one post-candidate frame stayed close to the face.
    const pre=s.preArmCandidate;
    if(pre&&!s.latched){
      const face=finite(input?.phaseFaceDist)?Number(input.phaseFaceDist):null;
      if(face!==null&&finite(pre.onsetFace)){
        const d=face-Number(pre.onsetFace);
        pre.lastPostFaceDelta=d;
        pre.maxPostFaceDelta=Math.max(num(pre.maxPostFaceDelta,d),d);
        pre.minPostFaceDelta=Math.min(num(pre.minPostFaceDelta,d),d);
      }
    }

    if(ev.terminalEligible&&!contradictedWitness){
      const epoch=finite(input?.epochMs)?Number(input.epochMs):now;
      const tc={epochMs:epoch,seenAt:now,onsetFace:finite(input?.phaseFaceDist)?Number(input.phaseFaceDist):null,onsetBowArm:finite(input?.bowArmDeg)?Number(input.bowArmDeg):null,score:ev.score,rear:ev.rear,faceRear:ev.faceRear,rearT:ev.rearT,speed:ev.speed,speedT:ev.speedT,elbow:ev.elbow,coreCandidate:ev.coreCandidate,ultraImpulse:ev.ultraImpulse,source:ev.coreCandidate?'core-candidate':ev.ultraImpulse?'ultra-impulse':'terminal-expansion'};
      if(!s.terminalCandidate||now-s.terminalCandidate.seenAt>900||tc.score>=s.terminalCandidate.score*.92)s.terminalCandidate=tc;
    }
    if(ev.ok&&!contradictedWitness){
      const epoch=finite(input?.epochMs)?Number(input.epochMs):now;
      if(!s.provisional||ev.score>s.provisional.score*1.12||now-s.provisional.startedAt>420){
        s.provisional={startedAt:now,epochMs:epoch,score:ev.score,onsetFace:finite(input?.phaseFaceDist)?Number(input.phaseFaceDist):null,onsetBowArm:finite(input?.bowArmDeg)?Number(input.bowArmDeg):null,peakFace:finite(input?.phaseFaceDist)?Number(input.phaseFaceDist):null,support:new Set(),frames:1,loweringFrames:0,source:ev.coreCandidate?'core-candidate':ev.ultraImpulse?'ultra-impulse':ev.expansionImpulse?'expansion-impulse':'mature-impulse',onsetExpansion:hasPhase(m,'Expansion'),onset:ev};
      }
    }
    const p=s.provisional;
    if(p){
      p.frames++;
      const age=now-p.startedAt,rear=num(m?.releaseRearStep),elbow=num(m?.releaseElbowRearStep),speed=num(m?.releaseFrameSpeed),rearT=Math.max(.0045,num(m?.releaseRearThreshold,.0045)),speedT=Math.max(.07,num(m?.releaseSpeedThreshold,.07)),bow=num(input?.bowSpeed),face=finite(input?.phaseFaceDist)?Number(input.phaseFaceDist):null;
      if(face!==null)p.peakFace=p.peakFace===null?face:Math.max(p.peakFace,face);
      if(rear>=.0025&&elbow>=.0035)p.support.add('rear-elbow');
      if(bow>=.055)p.support.add('bow-reaction');
      if(input?.visualMotionCorroborated===true)p.support.add('local-motion');
      if(face!==null&&p.onsetFace!==null&&face-p.onsetFace>=.055)p.support.add('face-departure');
      if(num(input?.trackingDrop)>=.10||num(input?.visibilityDrop)>=.13)p.support.add('fast-visibility-change');
      const hardLower=input?.wristsLow===true||(input?.phaseShootingPosture===false&&input?.setReady!==true)||(input?.phaseBowExtended===false&&input?.setReady!==true);
      if(hardLower)p.loweringFrames++;else p.loweringFrames=Math.max(0,p.loweringFrames-1);
      const currentDeparture=(face!==null&&p.onsetFace!==null)?face-p.onsetFace:0;
      // A false Expansion spike can create a strong provisional candidate because early Hold
      // thresholds are still learning. If that spike has not produced outward escape by ~90 ms
      // and the frozen core no longer sees a candidate, retire it so it cannot poison a later
      // genuine Release in the same shot.
      const expansionPulseCollapsed=age>=90&&m?.releaseCandidate!==true&&m?.letDown!==true&&currentDeparture<.055;
      if(p.loweringFrames>=2&&age<170){s.provisional=null;s.lastDecision='provisional-veto-lowering';}
      else if(expansionPulseCollapsed){s.provisional=null;s.lastDecision='provisional-veto-expansion-pulse';}
      else{
        const support=p.support.size;
        const structuralRelease=p.support.has('rear-elbow')&&(p.support.has('bow-reaction')||p.support.has('local-motion')||p.onset.coreCandidate);
        const strong=p.onset.ultraImpulse||p.onset.matureImpulse||(p.onsetExpansion?p.onset.score>=1.28:p.onset.score>=1.60);
        const supported=p.onset.ultraImpulse?(support>=2&&structuralRelease):p.onset.matureImpulse?(support>=2&&structuralRelease):(support>=3&&structuralRelease);
        if(age>=42&&age<=460&&!hardLower&&p.loweringFrames<2&&strong&&supported){
          s.lastDecision='release-candidate-supported';
          // BLE43887: a supported candidate cannot Capture merely because evidence accumulated.
          // It must show a CURRENT outward escape after T0. Sticky historical face-departure is
          // deliberately insufficient; this is what separates Expansion motion from a real release.
          const currentKinematic=(rear>=Math.max(.022,rearT*.45)||speed>=Math.max(.80,speedT*.75));
          // BLE438954 PhaseTruthGuard: a deliberate Expansion→Let-down can create a large
          // draw-hand escape that resembles Release. A real recurve release keeps the bow arm
          // substantially extended through T0; a rapid bow-arm collapse is therefore terminal
          // negative evidence and must veto Capture before latching Release.
          const onsetBowArm=finite(p.onsetBowArm)?Number(p.onsetBowArm):null,currentBowArm=finite(input?.bowArmDeg)?Number(input.bowArmDeg):null;
          const bowArmCollapse=p.bowArmCollapsed===true||(onsetBowArm!==null&&currentBowArm!==null&&(onsetBowArm-currentBowArm)>=7.5);
          const postReleaseEdge=currentDeparture>=.075&&currentKinematic&&bow>=.15&&!bowArmCollapse;
          if(bowArmCollapse){s.provisional=null;s.terminalCandidate=null;s.preArmCandidate=null;s.holdWatchCandidate=null;s.lastDecision='let-down-veto-bow-arm-collapse';}
          if(age>=45&&postReleaseEdge){
            s.latched=true;s.releaseEpochMs=p.epochMs;
            s.confidence=Math.max(.72,Math.min(.96,.74+Math.min(.16,p.score*.04)+(p.onset.coreCandidate?.04:0)+(p.onset.ultraImpulse?.04:0)));
            s.releaseEventId++;s.latchedSource='sentinel';s.provisional=null;s.preArmCandidate=null;s.holdWatchCandidate=null;s.terminalCandidate=null;s.lastDecision='release-confirmed-current-escape';
          }
        }
        if(!s.latched&&age>520){s.provisional=null;s.lastDecision='provisional-expired';}
      }
    }

    // The frozen core sometimes calls a genuine fast release a let-down on the very next frame,
    // especially before the 70 ms arming debounce. Rescue only if the terminal frame still shows
    // intact shooting posture and outward separation. A deliberate lower therefore remains 0 Capture.
    if(!s.latched&&m?.letDown===true){
      const p=s.provisional,pre=s.preArmCandidate,tc=s.terminalCandidate,hwc=s.holdWatchCandidate;
      const pProof=physicalTerminalRescue(p?{...p,seenAt:p.startedAt,rear:p.onset.rear,faceRear:p.onset.faceRear||0,elbow:p.onset.elbow,speed:p.onset.speed,rearT:p.onset.rearT,speedT:p.onset.speedT}:null,m,input,now);
      const preProof=physicalTerminalRescue(pre,m,input,now,{preArm:true});
      const compactProof=compactTerminalRescue(pre,m,input,now);
      const holdWatchProof=holdWatchTerminalRescue(hwc,m,input,now);
      const tcProof=physicalTerminalRescue(tc,m,input,now);
      if(pProof||preProof||compactProof||holdWatchProof||tcProof){
        const src=pProof?p:(preProof||compactProof)?pre:holdWatchProof?hwc:tc;
        s.latched=true;s.releaseEpochMs=pProof?p.epochMs:(preProof||compactProof)?pre.epochMs:holdWatchProof?hwc.epochMs:tc.epochMs;s.confidence=Math.max(.72,Math.min(.95,.76+Math.min(.14,(src.score||1)*.035)));s.releaseEventId++;
        s.latchedSource=holdWatchProof?'hold-watch-terminal':'sentinel';s.letDownArbitrationSince=0;
        s.provisional=null;s.preArmCandidate=null;s.holdWatchCandidate=null;s.terminalCandidate=null;s.lastDecision=pProof?'release-confirmed-terminal-edge':compactProof?'release-confirmed-compact-terminal-edge':preProof?'release-confirmed-prearm-terminal-edge':holdWatchProof?'release-confirmed-hold-watch-terminal':'release-confirmed-terminal-witness';
      }else{
        // A strong pending witness gets a brief arbitration grace window. Hiding this one native
        // let-down edge prevents the active shot from being destroyed before the next post-T0 frame.
        // No Capture is produced here; neutral/lowering will still win if the athlete really lets down.
        const recent=hwc&&!hwc.bowArmCollapsed&&now-hwc.seenAt<=720&&(num(hwc.score)>=2.35||num(hwc.channels)>=5);
        const postureIntact=input?.phaseShootingPosture!==false&&input?.phaseBowExtended!==false&&input?.wristsLow!==true;
        if(recent&&postureIntact){
          if(!s.letDownArbitrationSince)s.letDownArbitrationSince=now;
          if(now-s.letDownArbitrationSince<=190){
            s.lastDecision='release-pending-terminal-arbitration';
            return{override:true,event:'release-pending',state:s,patch:{phase:'Aim / Hold',primaryPhase:'Aim / Hold',didRelease:false,releaseConfirmed:false,releaseInvalidated:false,releaseCandidate:true,releaseConfidence:null,releaseEpochMs:null,postReleaseEvidence:false,followThroughConfirmed:false,followThroughEnded:false,shotComplete:false,shotCompleteEventId:0,shotEvent:null,letDown:false,blocker:'adaptive_release_pending_terminal',phaseTimeline:(Array.isArray(m?.phaseTimeline)?m.phaseTimeline:[]).filter(e=>!['Release','Follow Through'].includes(String(e?.phase)))}};
          }
        }
      }
    }
  }

  if(s.latched){
    const face=finite(input?.phaseFaceDist)?Number(input.phaseFaceDist):null;
    const recovered=input?.wristsLow===true||(input?.setReady!==true&&input?.phaseShootingPosture===false)||(input?.setReady!==true&&input?.phaseBowExtended===false&&(face===null||face>.92));
    if(recovered){if(!s.recoverySince)s.recoverySince=now;}else s.recoverySince=0;
    const end=!!s.recoverySince&&now-s.recoverySince>=120;
    const firstComplete=!s.completeEmitted;s.completeEmitted=true;
    const patch={phase:'Follow Through',primaryPhase:'Follow Through',didRelease:false,releaseConfirmed:true,releaseInvalidated:false,releaseCandidate:false,releaseConfidence:s.confidence,releaseEpochMs:s.releaseEpochMs,armed:true,sequenceQualified:true,postReleaseEvidence:true,followThroughConfirmed:true,shotComplete:firstComplete,shotCompleteEventId:firstComplete?s.releaseEventId:0,releaseEventId:s.releaseEventId,letDown:false,shotEvent:firstComplete?'release':null,blocker:end?'adaptive_recovery_complete':'adaptive_follow_through',adaptiveReleaseProof:true,adaptiveReleaseSource:s.latchedSource||'sentinel',phaseTimeline:timeline(m,s.releaseEpochMs,s.releaseEpochMs+60)};
    if(end&&!s.recoveryEmitted){s.recoveryEmitted=true;patch.followThroughEnded=true;patch.followThroughEndEpochMs=finite(input?.epochMs)?Number(input.epochMs):now;patch.blocker='adaptive_recovery_complete';s.lastDecision='adaptive-recovery';}
    else patch.followThroughEnded=false;
    if(s.recoveryEmitted&&recovered&&now-s.recoverySince>260){const final={...patch};reset(s);return{override:true,event:'recovery-final',state:s,patch:final};}
    return{override:true,event:firstComplete?'shot-complete':end?'recovery':'follow',state:s,patch};
  }

  if(m?.letDown===true){
    // Do not erase a recent strong release witness simply because the frozen detector emitted one
    // let-down edge. The Side lifecycle will close a real let-down only after neutral is observed.
    const hw=s.holdWatchCandidate,recent=hw&&!hw.bowArmCollapsed&&now-hw.seenAt<=720&&(num(hw.score)>=2.35||num(hw.channels)>=5);
    if(!recent){s.provisional=null;s.preArmCandidate=null;s.terminalCandidate=null;s.lastDecision='native-let-down';}
    else s.lastDecision='native-let-down-witness-retained';
    return{override:false,state:s};
  }
  const terminalEdge=((String(m?.phase||m?.primaryPhase||'')==='Setup'||String(m?.phase||m?.primaryPhase||'')==='Set')&&s.reachedHold);
  if(terminalEdge){
    const hw=s.holdWatchCandidate;
    const hwProof=holdWatchTerminalRescue(hw,{...m,letDown:true},input,now);
    if(hwProof){
      s.latched=true;s.releaseEpochMs=hw.epochMs;s.confidence=Math.max(.72,Math.min(.95,.76+Math.min(.14,(hw.score||1)*.035)));s.releaseEventId++;s.latchedSource='hold-watch-terminal';s.completeEmitted=true;s.letDownArbitrationSince=0;s.provisional=null;s.preArmCandidate=null;s.holdWatchCandidate=null;s.terminalCandidate=null;s.lastDecision='terminal-reset-hold-watch-rescue';
      return{override:true,event:'terminal-release-rescue',state:s,patch:{phase:'Follow Through',primaryPhase:'Follow Through',didRelease:true,releaseConfirmed:true,releaseInvalidated:false,releaseCandidate:false,releaseConfidence:s.confidence,releaseEpochMs:s.releaseEpochMs,armed:true,sequenceQualified:true,postReleaseEvidence:true,followThroughConfirmed:true,followThroughEnded:false,shotComplete:true,shotCompleteEventId:s.releaseEventId,releaseEventId:s.releaseEventId,letDown:false,shotEvent:'release',blocker:'terminal_release_rescue',adaptiveReleaseProof:true,adaptiveReleaseSource:'hold-watch-terminal',phaseTimeline:timeline(m,s.releaseEpochMs,now)}};
    }
    const tc=s.terminalCandidate,age=tc?now-tc.seenAt:Infinity,face=finite(input?.phaseFaceDist)?Number(input.phaseFaceDist):null,faceDeparture=tc&&face!==null&&finite(tc.onsetFace)?face-tc.onsetFace:0;
    const postureIntact=input?.phaseShootingPosture!==false&&input?.phaseBowExtended!==false&&input?.setReady===true&&input?.wristsLow!==true;
    const terminalRelease=!!tc&&!tc.bowArmCollapsed&&age>=0&&age<=900&&postureIntact&&faceDeparture>=.055&&tc.score>=.72&&tc.rear>=Math.max(.007,tc.rearT*.62)&&tc.speed>=Math.max(.24,tc.speedT*.42)&&tc.elbow>=.003;
    if(terminalRelease){
      s.latched=true;s.releaseEpochMs=tc.epochMs;s.confidence=Math.max(.70,Math.min(.94,.72+Math.min(.14,tc.score*.035)+(tc.coreCandidate?.05:0)));s.releaseEventId++;s.latchedSource='sentinel';s.completeEmitted=true;s.letDownArbitrationSince=0;s.provisional=null;s.preArmCandidate=null;s.holdWatchCandidate=null;s.terminalCandidate=null;s.lastDecision='terminal-release-rescue';
      return{override:true,event:'terminal-release-rescue',state:s,patch:{phase:'Follow Through',primaryPhase:'Follow Through',didRelease:true,releaseConfirmed:true,releaseInvalidated:false,releaseCandidate:false,releaseConfidence:s.confidence,releaseEpochMs:s.releaseEpochMs,armed:true,sequenceQualified:true,postReleaseEvidence:true,followThroughConfirmed:true,followThroughEnded:false,shotComplete:true,shotCompleteEventId:s.releaseEventId,releaseEventId:s.releaseEventId,letDown:false,shotEvent:'release',blocker:'terminal_release_rescue',adaptiveReleaseProof:true,adaptiveReleaseSource:tc.source,phaseTimeline:timeline(m,s.releaseEpochMs,now)}};
    }
  }
  if(s.terminalCandidate&&now-s.terminalCandidate.seenAt>1100)s.terminalCandidate=null;
  if(s.preArmCandidate&&now-s.preArmCandidate.seenAt>225)s.preArmCandidate=null;
  if(s.holdWatchCandidate&&now-s.holdWatchCandidate.seenAt>760)s.holdWatchCandidate=null;
  if(s.letDownArbitrationSince&&now-s.letDownArbitrationSince>260)s.letDownArbitrationSince=0;
  return{override:false,state:s};
}
return{VERSION,PHASES,fresh,reset,candidateEvidence,update};
});

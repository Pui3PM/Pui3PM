// 3PM BLE4.3.8.8.5 Foundation Guard Core · fresh-shot monotonic progress
// Pure phase-confirmation + automatic-capture safety invariants.
// Activity classification is diagnostic-only and never decides whether a camera shot may be captured.
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.FoundationGuardCore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const PHASES=['Setup','Set','Draw','Anchor','Aim / Hold','Expansion','Release','Follow Through'];
  const RANK=Object.fromEntries(PHASES.map((p,i)=>[p,i]));
  const MODES={
    // Camera-shot proof profile. This is the only profile used by the live capture guard.
    // Thresholds intentionally preserve the stricter former Unknown/Real-Bow geometry so
    // classifier uncertainty can never loosen Shot Proof.
    verified_shot:{id:'verified_shot',label:'Verified Shot',autoCapture:true,requireBowExtension:true,drawTravel:.120,anchorDist:.80,setupQuality:.30,armVisibility:.32,holdConfirmMs:55},
    // Legacy/diagnostic profiles remain exported for classifier tests and trace comparison.
    unknown:{id:'unknown',label:'Unknown',autoCapture:false,requireBowExtension:true,drawTravel:.120,anchorDist:.80,setupQuality:.30,armVisibility:.32,holdConfirmMs:55},
    real_bow:{id:'real_bow',label:'Real Bow',autoCapture:true,requireBowExtension:true,drawTravel:.120,anchorDist:.80,setupQuality:.30,armVisibility:.32,holdConfirmMs:55},
    elastic:{id:'elastic',label:'Elastic',autoCapture:true,requireBowExtension:true,drawTravel:.086,anchorDist:.88,setupQuality:.28,armVisibility:.30,holdConfirmMs:55},
    hand_only:{id:'hand_only',label:'Hand-only',autoCapture:false,requireBowExtension:false,drawTravel:.066,anchorDist:.94,setupQuality:.26,armVisibility:.28,holdConfirmMs:55}
  };
  const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;};
  const rank=p=>RANK[p]??-1;
  function mode(name){return MODES[name]||MODES.verified_shot;}
  function fresh(selected='verified_shot'){
    return {
      mode:mode(selected).id,lastEpoch:0,lastCorePhase:'Setup',currentPhase:'Setup',reason:'Waiting for Side athlete tracking',
      confirmed:Object.fromEntries(PHASES.map(p=>[p,false])),
      setupReadySince:0,setReadySince:0,drawReadySince:0,anchorReadySince:0,holdReadySince:0,neutralReadySince:0,neutralSeen:false,trackingLostSince:0,
      setBaselineFaceDist:null,drawTravel:0,bowExtensionSeen:false,armedEver:false,cycleStarted:false,cycleEnded:false,
      lastDetectedAt:0,lastResetAt:0,lastGate:null
    };
  }
  function resetCycle(s,{keepSetup=false,reason='cycle reset',now=Date.now()}={}){
    const wasSetup=keepSetup&&s.confirmed.Setup;
    for(const p of PHASES)s.confirmed[p]=false;
    if(wasSetup)s.confirmed.Setup=true;
    s.setupReadySince=0;s.setReadySince=0;s.drawReadySince=0;s.anchorReadySince=0;s.holdReadySince=0;s.neutralReadySince=0;s.neutralSeen=false;s.trackingLostSince=0;
    s.setBaselineFaceDist=null;s.drawTravel=0;s.bowExtensionSeen=false;s.armedEver=false;s.cycleStarted=false;s.cycleEnded=false;
    s.currentPhase='Setup';s.reason=reason;s.lastResetAt=now;s.lastGate=null;
    return s;
  }
  function bothArmsVisible(m,cfg){
    const mc=m?.metricConfidence||{};
    const draw=num(mc.drawElbow)??0;
    const bow=num(mc.bowArm)??0;
    return !!m?.detected&&!m?.identityAmbiguous&&draw>=cfg.armVisibility&&bow>=cfg.armVisibility;
  }
  // Missing geometry stays missing; null/undefined are never coerced to numeric zero.
  function faceDist(m){
    const d=num(m?.debugPhaseFaceDist);if(d!==null)return d;
    const pct=num(m?.anchorFaceDistPct);return pct===null?null:pct/100;
  }
  function bowExtended(m,cfg){
    if(!cfg.requireBowExtension)return true;
    // Integration diagnostics are authoritative when explicitly supplied. A false shot-plane
    // verdict must never be bypassed by a merely straight elbow angle.
    if(m?.debugPhaseBowExtended===false)return false;
    if(m?.debugPhaseBowExtended===true)return true;
    const a=num(m?.bowArmDeg);return a!==null&&a>=(cfg.id==='elastic'?136:142);
  }
  function posture(m){
    if(m?.debugPhaseShootingPosture===false)return false;
    return m?.debugPhaseShootingPosture===true||m?.phaseShootingPosture===true;
  }
  function setReady(m){
    if(m?.debugSetReady===false)return false;
    return m?.debugSetReady===true||m?.setReady===true;
  }
  function stableSince(ok,s,key,now,ms){
    if(!ok){s[key]=0;return false;}
    if(!s[key])s[key]=(now===0?Number.EPSILON:now);
    return now-s[key]>=ms;
  }
  function update(state,m,selectedMode='verified_shot',nowArg){
    const s=state||fresh(selectedMode),cfg=mode(selectedMode||s.mode),now=num(nowArg)??num(m?.epochMs)??Date.now();
    if(s.mode!==cfg.id){resetCycle(s,{reason:'Shot proof profile changed · restart sequence',now});s.mode=cfg.id;}
    s.lastEpoch=now;s.lastCorePhase=m?.phase||s.lastCorePhase||'Setup';
    if(m?.detected)s.lastDetectedAt=now;
    if(!m?.detected){
      // Tracking loss is observation loss, not evidence that the athlete moved backwards.
      // Once a real cycle has started, preserve the highest confirmed phase until an explicit
      // let-down/recovery/new-cycle edge closes it. This is duration-independent.
      if(s.cycleStarted){if(!s.trackingLostSince)s.trackingLostSince=now;s.reason=`Tracking… · keeping ${s.currentPhase} progress`;return snapshot(s,m);}
      if(now-(s.lastDetectedAt||0)>1400)resetCycle(s,{reason:'Waiting for Side athlete tracking',now});
      s.currentPhase='Setup';s.reason='Waiting for Side athlete tracking';return snapshot(s,m);
    }
    s.trackingLostSince=0;
    if(m?.identityAmbiguous){s.reason=`Tracking… · keeping ${s.currentPhase} progress`;return snapshot(s,m);}
    const visible=bothArmsVisible(m,cfg),q=num(m?.phaseQuality)??0,explicitSet=setReady(m),post=posture(m),ext=bowExtended(m,cfg),fd=faceDist(m);
    const setupOK=visible&&q>=cfg.setupQuality;
    if(!s.confirmed.Setup&&stableSince(setupOK,s,'setupReadySince',now,90))s.confirmed.Setup=true;
    if(!s.confirmed.Setup){s.currentPhase='Setup';s.reason=!visible?'Setup · waiting for both hands / both arms to be clearly visible':q<cfg.setupQuality?'Setup · tracking quality is still stabilizing':'Setup · confirming athlete readiness';return snapshot(s,m);}

    // A real cycle must begin from a neutral edge. This prevents a preparatory arm position,
    // chair movement or old Set posture from instantly creating Set/Draw before the athlete raises.
    const neutral=visible&&!explicitSet&&(!post||!ext);
    if(!s.neutralSeen&&stableSince(neutral,s,'neutralReadySince',now,45))s.neutralSeen=true;
    const tl=Array.isArray(m?.phaseTimeline)?m.phaseTimeline:[];
    const timelineHas=p=>tl.some(e=>e?.phase===p&&num(e?.epochMs)!==null);
    const setOK=s.neutralSeen&&visible&&explicitSet&&q>=cfg.setupQuality;
    if(!s.confirmed.Set&&stableSince(setOK,s,'setReadySince',now,110)){
      s.confirmed.Set=true;s.cycleStarted=true;s.currentPhase='Set';s.setBaselineFaceDist=fd;s.drawTravel=0;s.reason='Set confirmed';
    }
    if(!s.confirmed.Set){s.currentPhase='Setup';s.reason=s.neutralSeen?'Setup · ready · waiting for actual bow raise':'Setup · establish neutral ready position';return snapshot(s,m);}

    if(!ext){s.drawTravel=0;}
    else if(!s.bowExtensionSeen){s.bowExtensionSeen=true;if(fd!==null)s.setBaselineFaceDist=fd;s.drawTravel=0;}
    else if(fd!==null){if(s.setBaselineFaceDist===null)s.setBaselineFaceDist=fd;s.drawTravel=Math.max(0,s.setBaselineFaceDist-fd);}
    const coreAtDraw=rank(m?.phase)>=rank('Draw')||rank(m?.primaryPhase)>=rank('Draw');
    const drawMotion=s.drawTravel>=Math.min(cfg.drawTravel,.055)||(Math.abs(num(m?.faceHandSpeed)??0)>=.10&&Math.abs(num(m?.drawSpeed)??0)>=.08);
    const drawOK=visible&&post&&ext&&coreAtDraw&&drawMotion;
    if(!s.confirmed.Draw&&stableSince(drawOK,s,'drawReadySince',now,65)){s.confirmed.Draw=true;s.currentPhase='Draw';s.reason='Draw confirmed';}
    if(!s.confirmed.Draw){s.currentPhase='Set';s.reason=`Set confirmed · waiting for Draw${!post?' · shooting posture not ready':''}`;return snapshot(s,m);}

    const coreAtAnchor=rank(m?.phase)>=rank('Anchor')||rank(m?.primaryPhase)>=rank('Anchor')||timelineHas('Anchor');
    const anchorOK=visible&&post&&fd!==null&&fd<=cfg.anchorDist&&coreAtAnchor;
    if(!s.confirmed.Anchor&&stableSince(anchorOK,s,'anchorReadySince',now,80)){s.confirmed.Anchor=true;s.currentPhase='Anchor';s.reason='Anchor confirmed';}
    if(!s.confirmed.Anchor){s.currentPhase='Draw';s.reason=fd===null?'Draw confirmed · waiting for Anchor geometry':`Draw confirmed · approaching Anchor (${fd.toFixed(2)})`;return snapshot(s,m);}

    if(m?.armed)s.armedEver=true;
    const timelineHold=timelineHas('Aim / Hold');
    const coreHold=rank(m?.phase)>=rank('Aim / Hold')||rank(m?.primaryPhase)>=rank('Aim / Hold')||timelineHold||(num(m?.holdTimeS)!==null&&num(m?.holdTimeS)>0);
    const holdStable=coreHold&&visible&&post;
    if(!s.confirmed['Aim / Hold']&&stableSince(holdStable,s,'holdReadySince',now,cfg.holdConfirmMs)){s.confirmed['Aim / Hold']=true;s.currentPhase='Aim / Hold';s.reason='Aim / Hold confirmed';}
    // A verified Release may occur very quickly after a valid Anchor/Hold transition. The timeline
    // is allowed to promote Hold retrospectively; duration itself is never a hard gate.
    if(m?.releaseConfirmed&&(timelineHold||m?.adaptiveReleaseProof===true))s.confirmed['Aim / Hold']=true;
    if(!s.confirmed['Aim / Hold']){s.currentPhase='Anchor';s.reason='Anchor confirmed · waiting for Hold evidence';return snapshot(s,m);}

    if(m?.shotActivity==='Expansion'||m?.expansionActive||m?.phase==='Expansion'||(Array.isArray(m?.phaseTimeline)&&m.phaseTimeline.some(e=>e?.phase==='Expansion'))){s.confirmed.Expansion=true;s.currentPhase='Expansion';s.reason='Expansion evidence';}
    if(m?.releaseConfirmed){s.confirmed.Release=true;s.armedEver=true;s.currentPhase='Release';s.reason=m?.adaptiveReleaseProof?'Release confirmed · adaptive event proof':'Release confirmed';}
    if(m?.phase==='Follow Through'||m?.followThroughConfirmed||m?.followThroughEnded||m?.shotComplete){s.confirmed['Follow Through']=true;s.currentPhase='Follow Through';s.reason='Follow Through confirmed';}

    // Monotonic display: never show the *next expected* phase as if it had already happened.
    if(!s.confirmed.Release&&!s.confirmed.Expansion){s.currentPhase='Aim / Hold';s.reason='Aim / Hold confirmed · waiting for Expansion / Release';}
    else if(!s.confirmed.Release&&s.confirmed.Expansion){s.currentPhase='Expansion';s.reason='Expansion confirmed · waiting for Release';}
    else if(s.confirmed.Release&&!s.confirmed['Follow Through']){s.currentPhase='Release';s.reason='Release confirmed · collecting post-release evidence';}

    if(m?.letDown&&!m?.releaseConfirmed){resetCycle(s,{keepSetup:false,reason:'Let-down · 0 Capture · return to neutral Setup',now});}
    else if(m?.followThroughEnded){s.cycleEnded=true;}
    else if(s.cycleEnded&&m?.phase==='Setup'&&!m?.releaseConfirmed){resetCycle(s,{keepSetup:false,reason:'Recovery complete · ready for next sequence',now});}
    return snapshot(s,m);
  }
  function captureGate(state,m,selectedMode='verified_shot'){
    const s=state||fresh(selectedMode),cfg=mode(selectedMode||s.mode),missing=[];
    if(cfg.id!=='verified_shot'&&!cfg.autoCapture)missing.push(cfg.id==='unknown'?'activity not classified':cfg.id==='hand_only'?'Hand-only activity':'automatic capture disabled');
    if(!s.confirmed.Setup)missing.push('Setup');
    if(!s.confirmed.Set)missing.push('Set');
    if(!s.confirmed.Draw)missing.push('Draw');
    if(!s.confirmed.Anchor)missing.push('Anchor');
    if(!s.confirmed['Aim / Hold'])missing.push('Aim / Hold');
    if(cfg.requireBowExtension&&!s.bowExtensionSeen)missing.push('bow-arm extension');
    if(!s.armedEver&&m?.adaptiveReleaseProof!==true)missing.push('release arming');
    if(m?.sequenceQualified!==true&&m?.adaptiveReleaseProof!==true)missing.push('qualified shot sequence');
    if(m?.releaseConfirmed!==true)missing.push('confirmed Release');
    if(m?.releaseInvalidated===true)missing.push('release invalidated');
    if(m?.postReleaseEvidence!==true)missing.push('post-release evidence');
    if(m?.shotComplete!==true)missing.push('shot completion');
    if(!s.confirmed['Follow Through'])missing.push('Follow Through');
    if(num(m?.releaseEpochMs)===null)missing.push('release timestamp');
    if(m?.letDown===true)missing.push('let-down');
    return {accepted:missing.length===0,missing,reason:missing.length?`Capture blocked · missing ${missing.join(', ')}`:'Capture gate passed · verified shot proof',mode:cfg.id};
  }
  function snapshot(s,m){
    const cfg=mode(s.mode);return {
      mode:s.mode,modeLabel:cfg.label,autoCaptureAllowed:cfg.autoCapture,currentPhase:s.currentPhase,reason:s.reason,
      confirmed:{...s.confirmed},drawTravel:Number(s.drawTravel)||0,bowExtensionSeen:!!s.bowExtensionSeen,armedEver:!!s.armedEver,
      bothArmsVisible:bothArmsVisible(m||{},cfg),corePhase:m?.phase||s.lastCorePhase||null,phaseFaceDist:faceDist(m||{})
    };
  }
  return {VERSION:'BLE4.3.8.8.5',PHASES,MODES,mode,fresh,resetCycle,update,captureGate,snapshot,bothArmsVisible,faceDist};
});

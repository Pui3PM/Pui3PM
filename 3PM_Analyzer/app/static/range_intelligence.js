(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.RangeIntelligence=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const vis=p=>finite(p?.visibility)?Number(p.visibility):1;
  const dist=(a,b)=>a&&b?Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0)):Infinity;
  const meanPoint=pts=>{const good=pts.filter(p=>p&&finite(p.x)&&finite(p.y));return good.length?{x:good.reduce((s,p)=>s+p.x,0)/good.length,y:good.reduce((s,p)=>s+p.y,0)/good.length}:null;};

  function signature(lm){
    if(!Array.isArray(lm)||lm.length<25)return null;
    const shoulders=[lm[11],lm[12]].filter(p=>vis(p)>.25),hips=[lm[23],lm[24]].filter(p=>vis(p)>.20);
    const center=meanPoint(hips.length?shoulders.concat(hips):shoulders);
    const shoulderWidth=(lm[11]&&lm[12])?dist(lm[11],lm[12]):null;
    const qIdx=[0,11,12,13,14,15,16,23,24];
    const quality=qIdx.reduce((s,i)=>s+clamp(vis(lm[i]),0,1),0)/qIdx.length;
    const shoulderY=meanPoint(shoulders)?.y??.5,armPts=[lm[13],lm[14],lm[15],lm[16]].filter(p=>p&&vis(p)>.30);
    const raised=armPts.length?armPts.filter(p=>p.y<shoulderY+.26).length/armPts.length:0;
    const armSpan=(lm[15]&&lm[16])?Math.abs(Number(lm[16].x)-Number(lm[15].x)):0;
    const archeryHint=clamp(raised*.65+(shoulderWidth>0?clamp(armSpan/(shoulderWidth*2.2),0,1)*.35:0),0,1);
    if(!center||!finite(shoulderWidth))return null;
    return {center,shoulderWidth:Number(shoulderWidth),quality,archeryHint};
  }

  function colorDistance(a,b){if(!a||!b)return null;const dr=Number(a.r)-Number(b.r),dg=Number(a.g)-Number(b.g),db=Number(a.b)-Number(b.b);if(![dr,dg,db].every(finite))return null;return clamp(Math.hypot(dr,dg,db)/441.7,0,1);}

  function selectAthletePose(candidates,lock=null,now=Date.now(),appearances=[]){
    const list=(candidates||[]).map((lm,index)=>({index,lm,sig:signature(lm)})).filter(x=>x.sig);
    const hasHome=!!(lock?.homeCenter||lock?.center)&&finite(lock?.homeShoulderWidth??lock?.shoulderWidth);
    const homeCenter=lock?.homeCenter||lock?.center||null,homeW=Number(lock?.homeShoulderWidth??lock?.shoulderWidth)||null;
    if(!list.length)return {index:-1,landmarks:null,lock,identityConfidence:0,ambiguous:false,athleteLost:!!lock,peopleCount:0};

    // V5 identity contract: continuity is a hard gate. After temporary loss, reacquisition
    // must return to the athlete's Ready Zone/body scale; a clearer passer-by may not steal it.
    const lockFresh=lock&&finite(lock.lastSeenAt)&&now-Number(lock.lastSeenAt)<2200&&lock.center&&finite(lock.shoulderWidth);
    for(const c of list){
      const centerBias=Math.hypot(c.sig.center.x-.5,c.sig.center.y-.48),prominence=clamp((c.sig.shoulderWidth-.045)/.20,0,1);
      c.appearance=appearances?.[c.index]||null;
      c.appearanceDistance=lock?colorDistance(c.appearance,lock.appearance):null;
      c.centerDistance=lockFresh?dist(c.sig.center,lock.center):null;
      c.scaleDelta=lockFresh?Math.abs(Math.log(Math.max(.02,c.sig.shoulderWidth)/Math.max(.02,Number(lock.shoulderWidth)))):null;
      c.homeDistance=hasHome?dist(c.sig.center,homeCenter):null;
      c.homeScaleDelta=hasHome?Math.abs(Math.log(Math.max(.02,c.sig.shoulderWidth)/Math.max(.02,homeW))):null;
      let score=c.sig.quality-centerBias*.10+c.sig.archeryHint*.20+prominence*.13;
      if(lockFresh){
        score+=.60-clamp(c.centerDistance,0,.8)*1.80-clamp(c.scaleDelta,0,2)*.36;
        if(finite(c.appearanceDistance))score+=(1-c.appearanceDistance)*.34-.12;
        const maxJump=clamp(Math.max(.105,Number(lock.shoulderWidth)*1.05),.105,.22);
        const appearanceOK=!finite(c.appearanceDistance)||c.appearanceDistance<=.50;
        c.identityGate=c.centerDistance<=maxJump&&c.scaleDelta<=.52&&appearanceOK;
      }else if(hasHome){
        const readyRadius=clamp(Math.max(.13,homeW*1.45),.13,.28);
        const appearanceOK=!finite(c.appearanceDistance)||c.appearanceDistance<=.55;
        c.identityGate=c.homeDistance<=readyRadius&&c.homeScaleDelta<=.62&&appearanceOK;
        if(c.identityGate)score+=.44-clamp(c.homeDistance/readyRadius,0,1)*.24-clamp(c.homeScaleDelta,0,1)*.12;
      }else c.identityGate=true;
      c.score=score;
    }

    const pool=(lockFresh||hasHome)?list.filter(c=>c.identityGate):list;
    if((lockFresh||hasHome)&&!pool.length){
      const appearanceConflict=list.some(c=>finite(c.appearanceDistance)&&c.appearanceDistance>.40);
      return {index:-1,landmarks:null,lock,identityConfidence:.18,ambiguous:list.length>1,athleteLost:true,hardLockMiss:true,appearanceConflict,peopleCount:list.length};
    }
    pool.sort((a,b)=>b.score-a.score);const best=pool[0],second=pool[1],gap=second?best.score-second.score:.35;
    const spatialMatch=lockFresh?clamp(1-(best.centerDistance||0)/.30,0,1):hasHome?clamp(1-(best.homeDistance||0)/.30,0,1):.72;
    const appearanceMatch=finite(best.appearanceDistance)?1-best.appearanceDistance:null;
    const identityConfidence=clamp(best.sig.quality*.40+spatialMatch*.34+clamp(gap/.18,0,1)*.11+(appearanceMatch===null?.15:appearanceMatch*.15),0,1);
    const appearanceConflict=!!lock&&finite(best.appearanceDistance)&&best.appearanceDistance>.40;
    const closeRival=!!second&&gap<.055;
    const ambiguous=appearanceConflict||(closeRival&&identityConfidence<.80);
    if(ambiguous&&(lockFresh||hasHome))return {index:-1,landmarks:null,lock,identityConfidence:Math.min(identityConfidence,appearanceConflict?.38:.44),ambiguous:true,athleteLost:false,appearanceConflict,peopleCount:list.length,quality:best.sig.quality};

    // Ready Zone is anchored when the athlete is first acquired. Tracking center may move;
    // the home zone changes only very slowly so passers-by cannot drag the lock across frame.
    const oldCenter=lockFresh?lock.center:null,oldW=lockFresh?Number(lock.shoulderWidth):null;
    const center=oldCenter?{x:oldCenter.x*.72+best.sig.center.x*.28,y:oldCenter.y*.72+best.sig.center.y*.28}:{...best.sig.center};
    const shoulderWidth=finite(oldW)?oldW*.80+best.sig.shoulderWidth*.20:best.sig.shoulderWidth;
    let appearance=lock?.appearance||null;if(best.appearance)appearance=!appearance?best.appearance:{r:appearance.r*.90+best.appearance.r*.10,g:appearance.g*.90+best.appearance.g*.10,b:appearance.b*.90+best.appearance.b*.10};
    const establishedHome=homeCenter?{x:homeCenter.x*.985+best.sig.center.x*.015,y:homeCenter.y*.985+best.sig.center.y*.015}:{...best.sig.center};
    const establishedHomeW=finite(homeW)?homeW*.985+best.sig.shoulderWidth*.015:best.sig.shoulderWidth;
    const newLock={center,shoulderWidth,lastSeenAt:now,quality:best.sig.quality,appearance,homeCenter:establishedHome,homeShoulderWidth:establishedHomeW};
    return {index:best.index,landmarks:best.lm,lock:newLock,identityConfidence,ambiguous:false,athleteLost:false,appearanceConflict:false,peopleCount:list.length,quality:best.sig.quality};
  }

  function positioningGuide(lm,{sourceWidth=0,sourceHeight=0}={}){
    if(!Array.isArray(lm)||lm.length<25)return {status:'waiting',level:'waiting',message:'Move into camera view',detail:'Waiting for athlete landmarks',score:0};

    // X1.1 field fix: the framing safe-area is an ADVISORY, not a capture boundary.
    // A single extended wrist/elbow must never make an otherwise visible archer permanently red.
    // Framing uses the current VISUAL pose; measurement outliers may be frozen independently.
    const armIdx=[11,12,13,14,15,16];
    const visiblePts=(idx,min=.30)=>idx.map(i=>lm[i]).filter(p=>p&&vis(p)>min&&finite(p.x)&&finite(p.y));
    const headPts=visiblePts([0,7,8],.30),shoulderPts=visiblePts([11,12],.30),hipPts=visiblePts([23,24],.26),armPts=visiblePts(armIdx,.30);
    const headCenter=meanPoint(headPts),hipCenter=meanPoint(hipPts);
    // Use robust body representatives instead of letting one ear/hip landmark decide the entire framing state.
    const corePts=[headCenter,...shoulderPts,hipCenter].filter(Boolean);
    const allPts=[...corePts,...armPts];
    if(allPts.length<6||!headCenter||shoulderPts.length<2)return {status:'partial',level:'warn',message:'Show more of the upper body',detail:'Need head, shoulders and both arms visible',score:.25};

    const box=pts=>{const xs=pts.map(p=>Number(p.x)),ys=pts.map(p=>Number(p.y));const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);return {minX,maxX,minY,maxY,w:maxX-minX,h:maxY-minY,span:Math.max(maxX-minX,maxY-minY),margin:{left:minX,right:1-maxX,top:minY,bottom:1-maxY}};};
    const allBox=box(allPts),coreBox=box(corePts),maxSpan=allBox.span,coreSpan=coreBox.span;
    const coreEdge=Math.min(coreBox.margin.left,coreBox.margin.right,coreBox.margin.top,coreBox.margin.bottom);
    const armEdge=armPts.length?Math.min(...armPts.flatMap(p=>[Number(p.x),1-Number(p.x),Number(p.y),1-Number(p.y)])):1;
    const armGood=armIdx.filter(i=>vis(lm[i])>.42&&finite(lm[i]?.x)&&finite(lm[i]?.y)).length;
    const armOutside=armPts.some(p=>p.x<-.005||p.x>1.005||p.y<-.005||p.y>1.005);
    const shoulderDist=(lm[11]&&lm[12])?dist(lm[11],lm[12]):0;
    const drawHandDetail=(sourceWidth||0)*Math.max(.015,Number.isFinite(shoulderDist)?shoulderDist:0);

    // Only the BODY CORE may create a hard "too close" condition. Extended archery arms
    // are expected to approach the horizontal edge during set-up and follow-through.
    if(coreEdge<.008||coreSpan>.94){
      return {status:'too_close',level:'bad',message:'Move back slightly',detail:'Head / torso is too close to the frame edge',score:.20,maxSpan,coreSpan,margin:coreBox.margin,armGood,drawHandDetail,armEdge};
    }
    if(armOutside){
      return {status:'partial',level:'warn',message:'Re-center slightly',detail:'One arm is partly outside the camera image',score:.52,maxSpan,coreSpan,margin:coreBox.margin,armGood,drawHandDetail,armEdge};
    }

    // Distance is judged primarily from the stable body core. Arm extension must not make
    // a far-away athlete look "too close" or prevent readiness from ever becoming green.
    const sizeSignal=Math.max(coreSpan,Math.min(maxSpan,.72)*.62);
    if(sizeSignal<.22){
      return {status:'too_far',level:'warn',message:'Move closer',detail:'Athlete is too small for reliable fine analysis',score:.38,maxSpan,coreSpan,margin:coreBox.margin,armGood,drawHandDetail,armEdge};
    }
    if(sizeSignal<.28){
      return {status:'slightly_far',level:'warn',message:'Move closer a little',detail:'Shot cycle is usable; release detail will improve closer',score:.58,maxSpan,coreSpan,margin:coreBox.margin,armGood,drawHandDetail,armEdge};
    }
    if(armGood<5){
      return {status:'partial',level:'warn',message:'Show both arms clearly',detail:'Keep both elbows and wrists visible',score:.55,maxSpan,coreSpan,margin:coreBox.margin,armGood,drawHandDetail,armEdge};
    }
    if(coreEdge<.028){
      const m=coreBox.margin,side=m.left<.028?'left':m.right<.028?'right':m.top<.028?'top':'bottom';
      return {status:'edge',level:'warn',message:'Re-center slightly',detail:`Need a little more body space at the ${side} edge`,score:.64,maxSpan,coreSpan,margin:coreBox.margin,armGood,drawHandDetail,armEdge};
    }

    const fine=(sourceWidth>=1200&&sizeSignal>=.38)||(sourceWidth>=900&&sizeSignal>=.44);
    const optimal=sizeSignal>=.34&&sizeSignal<=.70&&coreEdge>=.045;
    const armNearEdge=armEdge<.025;
    const detail=armNearEdge
      ? 'Shot capture ready · arm is near the edge; extra follow-through space is recommended'
      : fine?'Shot cycle + fine release evidence ready':'Shot capture ready · fine hand detail depends on camera resolution';
    return {status:optimal?'optimal':'ready',level:'good',message:optimal?'Capture ready · optimal framing':'Capture ready',detail,score:optimal?.95:.82,maxSpan,coreSpan,margin:coreBox.margin,armGood,drawHandDetail,fineReleaseReady:fine,armNearEdge,armEdge};
  }

  function viewDescriptor(worldLm){
    if(!Array.isArray(worldLm)||!worldLm[11]||!worldLm[12])return {type:'unknown',sideScore:null,frontalScore:null};
    const l=worldLm[11],r=worldLm[12],dx=Number(r.x)-Number(l.x),dz=Number(r.z||0)-Number(l.z||0),m=Math.hypot(dx,dz);
    if(!finite(m)||m<1e-5)return {type:'unknown',sideScore:null,frontalScore:null};
    const sideScore=clamp(Math.abs(dz)/m,0,1),frontalScore=clamp(Math.abs(dx)/m,0,1);
    const type=sideScore>.72?'side-like':frontalScore>.78?'front/rear-like':'oblique';
    return {type,sideScore,frontalScore};
  }

  function shotObservability(lm,rightHanded=true,identityConfidence=1){
    if(!Array.isArray(lm)||lm.length<25)return 0;
    const draw={shoulder:rightHanded?12:11,elbow:rightHanded?14:13,wrist:rightHanded?16:15};
    const bow={shoulder:rightHanded?11:12,elbow:rightHanded?13:14,wrist:rightHanded?15:16};
    const head=Math.max(vis(lm[0]),vis(lm[7]),vis(lm[8]));
    const critical=[vis(lm[draw.shoulder]),vis(lm[draw.elbow]),vis(lm[draw.wrist]),vis(lm[bow.shoulder]),vis(lm[bow.elbow]),head];
    const min=Math.min(...critical),avg=critical.reduce((a,b)=>a+b,0)/critical.length;
    return clamp((avg*.68+min*.32)*clamp(identityConfidence,0,1),0,1);
  }

  return {signature,selectAthletePose,positioningGuide,viewDescriptor,shotObservability,colorDistance};
});

// 3PM BLE4.3.8.4 Automatic Activity Classifier Core
// Pure visual-evidence extraction + temporal classification.
// Accuracy policy: abstain as Unknown whenever evidence is weak or contradictory.
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.ActivityClassifierCore=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const VERSION='ble4385-auto-activity-v2';
  const LABELS={unknown:'Unknown',real_bow:'Real Bow',elastic:'Elastic',hand_only:'Hand-only'};
  const PHASE_RANK={'Setup':0,'Set':1,'Draw':2,'Anchor':3,'Aim / Hold':4,'Expansion':5,'Release':6,'Follow Through':7};
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const finite=v=>Number.isFinite(Number(v));
  const vis=p=>finite(p?.visibility)?Number(p.visibility):1;
  const lum=(data,w,h,x,y)=>{
    const ix=Math.max(0,Math.min(w-1,Math.round(x))),iy=Math.max(0,Math.min(h-1,Math.round(y))),i=(iy*w+ix)*4;
    return data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;
  };
  function contrastAt(data,w,h,x,y,nx,ny){
    const c=lum(data,w,h,x,y),a=lum(data,w,h,x+nx*1.7,y+ny*1.7),b=lum(data,w,h,x-nx*1.7,y-ny*1.7);
    const c2=lum(data,w,h,x+nx*.7,y+ny*.7),c3=lum(data,w,h,x-nx*.7,y-ny*.7);
    return clamp(Math.max(Math.abs(c-(a+b)*.5),Math.abs(a-b)*.62,Math.abs(c2-c3)*.82)/58);
  }
  function samplePath(data,w,h,p0,p1,{start=.08,end=.92,steps=42,search=2.5,controlOffset=0}={}){
    const dx=p1.x-p0.x,dy=p1.y-p0.y,len=Math.hypot(dx,dy);if(len<8)return{mean:0,continuity:0,strong:0};
    const nx=-dy/len,ny=dx/len,vals=[];
    for(let i=0;i<steps;i++){
      const t=start+(end-start)*(i/(steps-1)),bx=p0.x+dx*t+nx*controlOffset,by=p0.y+dy*t+ny*controlOffset;
      let best=0;
      for(let s=-search;s<=search;s+=1)best=Math.max(best,contrastAt(data,w,h,bx+nx*s,by+ny*s,nx,ny));
      vals.push(best);
    }
    const mean=vals.reduce((a,b)=>a+b,0)/Math.max(1,vals.length),strong=vals.filter(v=>v>.36).length/Math.max(1,vals.length);
    let runs=0,bestRun=0;for(const v of vals){if(v>.28){runs++;bestRun=Math.max(bestRun,runs);}else runs=0;}
    return{mean,continuity:bestRun/Math.max(1,vals.length),strong};
  }
  function pathThickness(data,w,h,p0,p1){
    const dx=p1.x-p0.x,dy=p1.y-p0.y,len=Math.hypot(dx,dy);if(len<8)return 0;
    const nx=-dy/len,ny=dx/len,widths=[];
    for(let j=0;j<12;j++){
      const t=.18+.64*(j/11),x=p0.x+dx*t,y=p0.y+dy*t;
      const side=[];for(const o of [-8,-7,-6,6,7,8])side.push(lum(data,w,h,x+nx*o,y+ny*o));side.sort((a,b)=>a-b);const base=(side[2]+side[3])*.5;
      const vals=[];for(let o=-6;o<=6;o++)vals.push(Math.abs(lum(data,w,h,x+nx*o,y+ny*o)-base));
      const centre=6;if(vals[centre]<16)continue;let lo=centre,hi=centre;while(lo>0&&vals[lo-1]>14)lo--;while(hi<vals.length-1&&vals[hi+1]>14)hi++;widths.push(hi-lo+1);
    }
    if(!widths.length)return 0;widths.sort((a,b)=>a-b);return widths[Math.floor(widths.length/2)];
  }
  function limbPathScore(data,w,h,wrist,angleDeg){
    const th=angleDeg*Math.PI/180,dx=Math.sin(th),dy=Math.cos(th),L=h*.43;
    const top={x:wrist.x-dx*L,y:wrist.y-dy*L},bottom={x:wrist.x+dx*L,y:wrist.y+dy*L};
    const full=samplePath(data,w,h,top,bottom,{start:.04,end:.96,steps:60,search:4});
    // Require support on both sides of the grip so a forearm/door edge cannot dominate.
    const upper=samplePath(data,w,h,top,wrist,{start:.02,end:.72,steps:25,search:4});
    const lower=samplePath(data,w,h,wrist,bottom,{start:.28,end:.98,steps:25,search:4});
    const bilateral=Math.min(upper.mean,lower.mean),cont=Math.min(upper.continuity,lower.continuity);
    return clamp(full.mean*.26+full.strong*.15+full.continuity*.17+bilateral*.28+cont*.14);
  }
  function frameQuality(data,w,h){
    if(!data||w<32||h<24)return 0;
    let sum=0,sum2=0,n=0,grad=0,gn=0;
    for(let y=2;y<h-2;y+=4)for(let x=2;x<w-2;x+=4){const v=lum(data,w,h,x,y);sum+=v;sum2+=v*v;n++;grad+=Math.abs(lum(data,w,h,x+2,y)-lum(data,w,h,x-2,y))+Math.abs(lum(data,w,h,x,y+2)-lum(data,w,h,x,y-2));gn+=2;}
    const mean=sum/Math.max(1,n),variance=Math.max(0,sum2/Math.max(1,n)-mean*mean),contrast=Math.sqrt(variance),sharp=grad/Math.max(1,gn);
    const exposure=mean<25||mean>235?.25:mean<42||mean>220?.60:1;
    return clamp((contrast/46)*.48+(sharp/24)*.52)*exposure;
  }
  function handPoints(landmarks,rightHanded=true,w=320,h=180){
    if(!Array.isArray(landmarks)||landmarks.length<17)return null;
    const idx=rightHanded?{bowS:11,bowE:13,bowW:15,drawS:12,drawE:14,drawW:16}:{bowS:12,bowE:14,bowW:16,drawS:11,drawE:13,drawW:15};
    const pts={};for(const [k,i] of Object.entries(idx)){const p=landmarks[i];if(!p||!finite(p.x)||!finite(p.y)||vis(p)<.28)return null;pts[k]={x:Number(p.x)*w,y:Number(p.y)*h,v:vis(p)};}
    const shoulderPx=Math.hypot(pts.bowS.x-pts.drawS.x,pts.bowS.y-pts.drawS.y);if(shoulderPx<8)return null;
    return{...pts,shoulderPx};
  }
  function extractVisualEvidence(imageData,landmarks,{rightHanded=true}={}){
    const data=imageData?.data||imageData,w=Number(imageData?.width)||0,h=Number(imageData?.height)||0;
    if(!data||!w||!h)return{usable:false,quality:0,bowStructure:0,elasticLine:0,reason:'no frame'};
    const q=frameQuality(data,w,h),p=handPoints(landmarks,rightHanded,w,h);
    if(!p)return{usable:false,quality:q,bowStructure:0,elasticLine:0,reason:'arm landmarks unavailable'};
    const wrist=p.bowW;
    let bowStructure=0,bowAngle=0;
    for(let a=-34;a<=34;a+=4){const s=limbPathScore(data,w,h,wrist,a);if(s>bowStructure){bowStructure=s;bowAngle=a;}}
    const bandMain=samplePath(data,w,h,p.bowW,p.drawW,{start:.14,end:.88,steps:44,search:2.5});
    const lineLen=Math.hypot(p.drawW.x-p.bowW.x,p.drawW.y-p.bowW.y),off=Math.max(7,Math.min(14,p.shoulderPx*.18));
    const c1=samplePath(data,w,h,p.bowW,p.drawW,{start:.14,end:.88,steps:44,search:1.5,controlOffset:off});
    const c2=samplePath(data,w,h,p.bowW,p.drawW,{start:.14,end:.88,steps:44,search:1.5,controlOffset:-off});
    const control=(c1.mean+c2.mean)*.5,bandWidthPx=pathThickness(data,w,h,p.bowW,p.drawW);
    // Thin arrow/string edges alone are not enough to call Elastic. A visible band should have
    // measurable thickness at this 320px classifier scale; otherwise abstain rather than mislabel a bow.
    const widthFactor=clamp((bandWidthPx-1.15)/2.35);
    const elasticLine=clamp(((bandMain.mean-control)*1.55+bandMain.continuity*.34+bandMain.strong*.20-(bowStructure*.12))*(.28+.72*widthFactor));
    const equipmentEvidence=Math.max(bowStructure,elasticLine),handSeparationRatio=lineLen/Math.max(1,p.shoulderPx);
    const usable=q>=.22&&handSeparationRatio>=.70;
    const reason=q<.22?'low visual quality':handSeparationRatio<.70?'hands too close for equipment classification':'ok';
    return{usable,quality:q,bowStructure,elasticLine,equipmentEvidence,bowAngleDeg:bowAngle,bandMean:bandMain.mean,bandControl:control,bandWidthPx,lineLenPx:lineLen,shoulderPx:p.shoulderPx,handSeparationRatio,reason};
  }
  function fresh(){return{label:'unknown',confidence:0,candidate:'unknown',candidateSince:0,lastUpdate:0,samples:0,visualSamples:0,eligibleVisualSamples:0,scores:{real_bow:0,elastic:0,hand_only:0},history:[],reason:'Checking equipment evidence',source:'camera',lockedAt:0,lastStrongEvidenceAt:0,lastEligibleAt:0,postureEligible:false};}
  function phaseRank(m){return PHASE_RANK[m?.phase]??PHASE_RANK[m?.primaryPhase]??0;}
  function realSensor(sensor){return !!(sensor?.connected&&sensor?.deviceId&&!String(sensor?.dataMode||'').includes('SYNTHETIC')&&sensor?.lastPacketAgeMs<1800);}
  function cameraPostureEligible(m={}){
    const bowExtended=m?.debugPhaseBowExtended===true||m?.phaseBowExtended===true||m?.bowExtended===true;
    const setReady=m?.debugSetReady===true||m?.setReady===true;
    const posture=m?.debugPhaseShootingPosture===true||m?.phaseShootingPosture===true;
    const wrist=finite(m?.debugPhaseDrawWristVisibility)?Number(m.debugPhaseDrawWristVisibility):1;
    const elbow=finite(m?.debugPhaseDrawElbowVisibility)?Number(m.debugPhaseDrawElbowVisibility):1;
    return !!(bowExtended&&(setReady||posture||phaseRank(m)>=2)&&wrist>=.50&&elbow>=.45);
  }
  function update(state,input={}){
    const s=state||fresh(),now=finite(input.now)?Number(input.now):Date.now(),m=input.metrics||{},v=input.visual||null,sensor=input.sensor||null;
    s.lastUpdate=now;s.samples++;
    if(realSensor(sensor)){
      s.label='real_bow';s.confidence=.995;s.candidate='real_bow';s.candidateSince=now;s.lockedAt=s.lockedAt||now;s.lastStrongEvidenceAt=now;s.lastEligibleAt=now;s.postureEligible=true;s.source='bow_sensor';s.reason='Real Bow confirmed by live Bow Sensor';s.scores={real_bow:.995,elastic:.01,hand_only:0};return snapshot(s,v);
    }
    const eligible=cameraPostureEligible(m);s.postureEligible=eligible;if(eligible)s.lastEligibleAt=now;
    if(v?.usable){
      s.visualSamples++;
      if(eligible){
        s.eligibleVisualSamples++;
        const a=.24;
        s.scores.real_bow=s.scores.real_bow*(1-a)+clamp(v.bowStructure)*a;
        s.scores.elastic=s.scores.elastic*(1-a)+clamp(v.elasticLine)*(a*.95);
      }else{
        s.scores.real_bow*=.78;s.scores.elastic*=.78;
      }
    }else{
      s.scores.real_bow*=.94;s.scores.elastic*=.94;
    }
    const progressed=phaseRank(m)>=2||m?.debugPhaseShootingPosture===true||m?.phaseShootingPosture===true;
    const noEquip=1-Math.max(s.scores.real_bow,s.scores.elastic);
    const handRaw=eligible&&progressed&&s.eligibleVisualSamples>=5?clamp((noEquip-.40)/.60):0;
    s.scores.hand_only=s.scores.hand_only*.76+handRaw*.24;
    const realScore=clamp(s.scores.real_bow*1.06);
    const elasticScore=clamp(s.scores.elastic*(1-s.scores.real_bow*.62)*(progressed?1:.38));
    const handScore=clamp(s.scores.hand_only*(1-Math.max(realScore,elasticScore)*.52));
    const ranked=[['real_bow',realScore],['elastic',elasticScore],['hand_only',handScore]].sort((a,b)=>b[1]-a[1]);
    const [top,second]=ranked,margin=top[1]-second[1];
    const currentRealStrong=!!(eligible&&v?.usable&&Number(v.bowStructure)>=.56);
    const currentElasticStrong=!!(eligible&&v?.usable&&Number(v.elasticLine)>=.48);
    let candidate='unknown';
    if(top[0]==='real_bow'&&top[1]>=.66&&margin>=.14&&s.eligibleVisualSamples>=4&&currentRealStrong)candidate='real_bow';
    else if(top[0]==='elastic'&&top[1]>=.60&&margin>=.14&&s.eligibleVisualSamples>=4&&progressed&&currentElasticStrong)candidate='elastic';
    else if(top[0]==='hand_only'&&top[1]>=.70&&Math.max(realScore,elasticScore)<.28&&s.eligibleVisualSamples>=6&&eligible&&progressed)candidate='hand_only';
    if(candidate!==s.candidate){s.candidate=candidate;s.candidateSince=now;}
    const dwell=candidate==='real_bow'?520:candidate==='elastic'?620:candidate==='hand_only'?720:0;
    if(candidate!=='unknown'&&now-s.candidateSince>=dwell){
      if(s.label!==candidate){s.label=candidate;s.lockedAt=now;}
      if(candidate==='real_bow'||candidate==='elastic')s.lastStrongEvidenceAt=now;
      s.confidence=clamp(top[1]*.82+margin*.38);
    }else if(s.label==='real_bow'&&currentRealStrong){
      s.lastStrongEvidenceAt=now;
      s.confidence=clamp(Math.max(s.confidence,top[1]*.80+margin*.30));
    }else if(s.label==='elastic'&&currentElasticStrong){
      s.lastStrongEvidenceAt=now;
      s.confidence=clamp(Math.max(s.confidence,top[1]*.80+margin*.30));
    }
    if(s.source!=='bow_sensor'&&(s.label==='real_bow'||s.label==='elastic')&&now-(s.lastStrongEvidenceAt||0)>1200){
      s.label='unknown';s.candidate='unknown';s.candidateSince=now;s.confidence=clamp(top[1]*.42);
    }else if(candidate==='unknown'&&s.label==='hand_only'&&(!eligible||now-(s.lastEligibleAt||0)>1200)){
      s.label='unknown';s.confidence=clamp(top[1]*.42);
    }
    s.source='camera';
    if(!eligible)s.reason='Activity unknown · waiting for valid shooting geometry / bow-arm extension';
    else if(!v?.usable){
      if(v?.reason==='low visual quality')s.reason='Activity unknown · improve light / framing';
      else if(v?.reason==='hands too close for equipment classification')s.reason='Activity unknown · hands are too close to classify equipment safely';
      else s.reason='Activity unknown · waiting for clear equipment view';
    }else if(s.label==='real_bow')s.reason=`Real Bow detected · verified limb evidence ${(realScore*100).toFixed(0)}%`;
    else if(s.label==='elastic')s.reason=`Elastic detected · verified tension-line evidence ${(elasticScore*100).toFixed(0)}%`;
    else if(s.label==='hand_only')s.reason='Hand-only detected · shooting geometry present with no equipment evidence';
    else s.reason='Activity unknown · collecting eligible multi-frame equipment evidence';
    s.history.push({t:now,label:s.label,confidence:s.confidence,real:realScore,elastic:elasticScore,hand:handScore,bow:v?.bowStructure??null,band:v?.elasticLine??null,eligible});if(s.history.length>36)s.history.shift();
    return snapshot(s,v);
  }
  function snapshot(s,v=null){
    const evidenceAge=Number.isFinite(Number(s.lastStrongEvidenceAt))&&s.lastStrongEvidenceAt>0?Math.max(0,s.lastUpdate-s.lastStrongEvidenceAt):null;
    const freshEvidence=s.source==='bow_sensor'||(evidenceAge!==null&&evidenceAge<=900);
    return{version:VERSION,label:s.label,labelText:LABELS[s.label]||LABELS.unknown,confidence:clamp(s.confidence||0),candidate:s.candidate,source:s.source,reason:s.reason,samples:s.samples,visualSamples:s.visualSamples,eligibleVisualSamples:s.eligibleVisualSamples||0,postureEligible:!!s.postureEligible,freshEvidence,lastStrongEvidenceAgeMs:evidenceAge,scores:{...s.scores},visual:v?{usable:!!v.usable,quality:v.quality??null,bowStructure:v.bowStructure??null,elasticLine:v.elasticLine??null,bowAngleDeg:v.bowAngleDeg??null,bandWidthPx:v.bandWidthPx??null,lineLenPx:v.lineLenPx??null,shoulderPx:v.shoulderPx??null,handSeparationRatio:v.handSeparationRatio??null,reason:v.reason??null}:null,captureClassified:(s.label==='real_bow'||s.label==='elastic')&&s.confidence>=.62&&freshEvidence};
  }
  return{VERSION,LABELS,fresh,update,snapshot,extractVisualEvidence,frameQuality,handPoints,samplePath,pathThickness,cameraPostureEligible};
});

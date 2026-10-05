"use strict";
(function(root){
  const Core={};
  const finite=v=>Number.isFinite(Number(v));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const vis=p=>finite(p?.visibility)?Number(p.visibility):1;
  const d2=(a,b)=>a&&b?Math.hypot(Number(a.x)-Number(b.x),Number(a.y)-Number(b.y)):NaN;
  const median=a=>{const v=a.filter(finite).map(Number).sort((x,y)=>x-y);if(!v.length)return NaN;const m=v.length>>1;return v.length%2?v[m]:(v[m-1]+v[m])/2;};

  function robustBodyScale(lm){
    if(!Array.isArray(lm))return .14;
    const ls=lm[11],rs=lm[12],le=lm[13],re=lm[14],lw=lm[15],rw=lm[16],lh=lm[23],rh=lm[24];
    const shoulder=d2(ls,rs);
    const upperL=d2(ls,le),upperR=d2(rs,re),foreL=d2(le,lw),foreR=d2(re,rw);
    const sm=(ls&&rs)?{x:(ls.x+rs.x)/2,y:(ls.y+rs.y)/2}:null;
    const hm=(lh&&rh)?{x:(lh.x+rh.x)/2,y:(lh.y+rh.y)/2}:null;
    const torso=d2(sm,hm),hip=d2(lh,rh);
    const candidates=[];
    if(finite(shoulder)&&shoulder>.018)candidates.push(shoulder);
    for(const x of [upperL,upperR])if(finite(x)&&x>.035)candidates.push(x*.90);
    for(const x of [foreL,foreR])if(finite(x)&&x>.035)candidates.push(x*.95);
    if(finite(torso)&&torso>.07)candidates.push(torso*.52);
    if(finite(hip)&&hip>.025)candidates.push(hip*.92);
    const m=median(candidates);
    return clamp(finite(m)?m:.14,.07,.28);
  }

  function copyPoint(p){return p?{...p}:p;}

  function fusedJointAngle(twoD,world){
    const a=finite(twoD)?Number(twoD):null,b=finite(world)?Number(world):null;
    if(a===null)return b;
    if(b===null)return a;
    // Live MediaPipe world landmarks can occasionally fold an otherwise straight arm in
    // depth. A large 2D/world disagreement must not block the shot phase state machine.
    // Keep 2D as the posture authority on a disagreement; blend only when both agree.
    if(Math.abs(a-b)>32)return a;
    return a*.72+b*.28;
  }


  class DualPoseFilter{
    constructor(){this.measurement=null;this.visual=null;this.lastMs=0;this.segment={};this.rejectStreak=new Array(33).fill(0);this.reacquire=Array.from({length:33},()=>null);}
    reset(){this.measurement=null;this.visual=null;this.lastMs=0;this.segment={};this.rejectStreak.fill(0);this.reacquire=Array.from({length:33},()=>null);}
    update(rawLandmarks,nowMs){
      if(!Array.isArray(rawLandmarks)||!rawLandmarks.length)return {measurement:rawLandmarks,visual:rawLandmarks,rejected:[],bodyScale:.14,trust:[]};
      const raw=rawLandmarks.map(copyPoint),bodyScale=robustBodyScale(raw);
      const dt=this.lastMs?clamp((nowMs-this.lastMs)/1000,.012,.20):.033;this.lastMs=nowMs;
      if(!Array.isArray(this.measurement)||this.measurement.length!==raw.length){
        this.measurement=raw.map(p=>({...p,_trusted:vis(p)>=.28,_rawVisibility:vis(p),_rejectReason:null}));
        this.visual=raw.map(copyPoint);
        return {measurement:this.measurement.map(copyPoint),visual:this.visual.map(copyPoint),rejected:[],bodyScale,trust:this.measurement.map(p=>!!p?._trusted)};
      }
      const prev=this.measurement,measurement=raw.map((p,i)=>({...p,_trusted:true,_rawVisibility:vis(p),_rejectReason:null}));
      const rejected=[];
      const reject=(i,reason)=>{
        const p=raw[i],q=prev[i];if(!p||!q)return;
        this.rejectStreak[i]=(this.rejectStreak[i]||0)+1;
        // X1.4: a real limb can legitimately move farther than one-frame teleport limits.
        // Never let a rejected measurement freeze forever.  If the RAW model lands on a
        // new, high-confidence position and repeats that position for several consecutive
        // frames, re-acquire it as the new measurement track.  A one-frame hallucination
        // still remains rejected, while genuine bow-raise/draw motion can recover.
        const canReacquire=(reason==="teleport"||reason==="segment_geometry")&&vis(p)>=.58;
        if(canReacquire){
          const c=this.reacquire[i];
          const stableTol=Math.max(.016,bodyScale*.28);
          const stable=c&&c.p&&d2(p,c.p)<=stableTol;
          const next={p:{x:p.x,y:p.y,z:p.z||0},stable:stable?(c.stable||0)+1:1,reason};
          this.reacquire[i]=next;
          if(next.stable>=3){
            measurement[i]={...p,_trusted:true,_rawVisibility:vis(p),_rejectReason:null,_reacquired:true};
            this.rejectStreak[i]=0;
            this.reacquire[i]=null;
            return;
          }
        } else this.reacquire[i]=null;
        measurement[i]={...q,visibility:vis(p),presence:p.presence,_trusted:false,_rawVisibility:vis(p),_rejectReason:reason};
        rejected.push({i,reason,rawVisibility:vis(p),streak:this.rejectStreak[i]});
      };
      const accept=i=>{this.rejectStreak[i]=0;this.reacquire[i]=null;};

      // Semantic left/right swap protection. Keep measurement continuity without changing what is visually shown.
      for(const [li,ri] of [[11,12],[13,14],[15,16]]){
        const l=raw[li],r=raw[ri],pl=prev[li],pr=prev[ri];if(!l||!r||!pl||!pr)continue;
        const same=d2(l,pl)+d2(r,pr),cross=d2(l,pr)+d2(r,pl);
        if(finite(same)&&finite(cross)&&cross+bodyScale*.12<same*.58){reject(li,"semantic_swap");reject(ri,"semantic_swap");}
      }

      const core=new Set([0,11,12,23,24]),elbows=new Set([13,14]),wrists=new Set([15,16]);
      raw.forEach((p,i)=>{
        if(measurement[i]?._trusted===false)return;
        const q=prev[i];if(!p||!q)return;
        if(vis(p)<.22){reject(i,"low_visibility");return;}
        const jump=d2(p,q),speed=finite(jump)?jump/Math.max(dt,.012):0;
        let maxScalePerSec=core.has(i)?2.4:elbows.has(i)?4.5:wrists.has(i)?7.2:3.5;
        let allowance=bodyScale*(.30+maxScalePerSec*dt);
        // A genuine release can move the draw wrist quickly. High visibility does not bypass the gate,
        // but it receives a bounded extra allowance rather than unlimited teleport permission.
        if(wrists.has(i)&&vis(p)>.72)allowance+=bodyScale*.38;
        if(elbows.has(i)&&vis(p)>.72)allowance+=bodyScale*.20;
        if(finite(jump)&&jump>allowance && speed>bodyScale*maxScalePerSec*1.15)reject(i,"teleport");
        else accept(i);
      });

      // Segment sanity uses slowly learned ratios; distal joint is held for measurement only.
      for(const [a,b,key] of [[11,13,"lua"],[13,15,"lfa"],[12,14,"rua"],[14,16,"rfa"]]){
        const A=measurement[a],B=measurement[b];if(!A||!B||!A._trusted||!B._trusted)continue;
        const len=d2(A,B);if(!finite(len)||len<bodyScale*.18)continue;
        const base=this.segment[key];
        if(!finite(base)){if(Math.min(vis(raw[a]),vis(raw[b]))>.55)this.segment[key]=len;continue;}
        // A deliberate re-acquisition starts a new trustworthy segment baseline instead of
        // being immediately rejected again by the old pre-movement limb geometry.
        if(A._reacquired||B._reacquired){this.segment[key]=len;continue;}
        const ratio=len/base;
        if(ratio<.43||ratio>1.72){
          const target=vis(raw[b])<=vis(raw[a])?b:a;reject(target,"segment_geometry");
        }else if(Math.min(vis(raw[a]),vis(raw[b]))>.55)this.segment[key]=base*.985+len*.015;
      }

      // Adaptive measurement smoothing: stable joints are smooth; rapid trusted motion remains responsive.
      const mOut=measurement.map((p,i)=>{
        const q=prev[i];if(!p||!q||p._trusted===false)return p?{...p}:p;
        const move=d2(p,q),norm=finite(move)?move/Math.max(bodyScale,.07):0;
        let a=norm<.025?.22:norm<.08?.34:norm<.22?.55:norm<.55?.76:.90;
        if((i===15||i===16)&&norm>.35)a=.94;
        return {...p,x:q.x+(p.x-q.x)*a,y:q.y+(p.y-q.y)*a,z:(q.z??0)+((p.z??0)-(q.z??0))*a};
      });

      // Visual channel follows RAW pose independently. It should look human and continuous even when a
      // measurement sample is rejected. Low-visibility points drift slowly instead of vanishing instantly.
      const prevV=Array.isArray(this.visual)?this.visual:raw;
      const vOut=raw.map((p,i)=>{
        const q=prevV[i]||p;if(!p||!q)return p?{...p}:p;
        const move=d2(p,q),norm=finite(move)?move/Math.max(bodyScale,.07):0;
        let a=norm<.02?.18:norm<.07?.30:norm<.18?.46:norm<.42?.68:.86;
        if(i===15||i===16||i===13||i===14)a=Math.min(.90,a+.08);
        if(vis(p)<.22)a=Math.min(a,.14);
        return {...p,x:q.x+(p.x-q.x)*a,y:q.y+(p.y-q.y)*a,z:(q.z??0)+((p.z??0)-(q.z??0))*a,_measurementTrusted:mOut[i]?._trusted!==false};
      });
      this.measurement=mOut;this.visual=vOut;
      return {measurement:mOut.map(copyPoint),visual:vOut.map(copyPoint),rejected,bodyScale,trust:mOut.map(p=>p?._trusted!==false)};
    }
  }

  function setPostureEvidence(lm,rightHanded,bodyScale){
    if(!Array.isArray(lm))return {ready:false,bowElbowRaised:false,bowWristRaised:false,bow2DLong:false};
    const sh=rightHanded?lm[11]:lm[12],el=rightHanded?lm[13]:lm[14],wr=rightHanded?lm[15]:lm[16];
    const scale=finite(bodyScale)?clamp(Number(bodyScale),.07,.28):robustBodyScale(lm);
    if(!sh||!el||!wr)return {ready:false,bowElbowRaised:false,bowWristRaised:false,bow2DLong:false};
    const elbowDrop=Number(el.y)-Number(sh.y),wristDrop=Number(wr.y)-Number(sh.y);
    const armSpan=d2(sh,wr);
    const bowElbowRaised=vis(el)>=.28 && elbowDrop < Math.max(.065,scale*.72);
    const bowWristRaised=vis(wr)>=.28 && wristDrop < Math.max(.095,scale*1.02);
    const bow2DLong=finite(armSpan) && armSpan > scale*.92;
    // Set is the bow-raising stage, not anchor. Do not require the draw arm to already be raised.
    const ready=bowElbowRaised && bowWristRaised && bow2DLong;
    return {ready,bowElbowRaised,bowWristRaised,bow2DLong,elbowDrop,wristDrop,armSpan,scale};
  }

  function worldBodyScale(world){
    if(!Array.isArray(world))return null;
    const ls=world[11],rs=world[12],le=world[13],re=world[14],lw=world[15],rw=world[16],lh=world[23],rh=world[24];
    const d3=(a,b)=>a&&b?Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0),(a.z||0)-(b.z||0)):NaN;
    const sm=ls&&rs?{x:(ls.x+rs.x)/2,y:(ls.y+rs.y)/2,z:((ls.z||0)+(rs.z||0))/2}:null;
    const hm=lh&&rh?{x:(lh.x+rh.x)/2,y:(lh.y+rh.y)/2,z:((lh.z||0)+(rh.z||0))/2}:null;
    const vals=[d3(ls,rs),d3(ls,le)*.9,d3(rs,re)*.9,d3(le,lw)*.95,d3(re,rw)*.95,d3(sm,hm)*.52].filter(x=>finite(x)&&x>.02);
    const m=median(vals);return finite(m)?clamp(m,.08,.50):null;
  }

  Core.robustBodyScale=robustBodyScale;
  Core.fusedJointAngle=fusedJointAngle;
  Core.setPostureEvidence=setPostureEvidence;
  Core.worldBodyScale=worldBodyScale;
  Core.DualPoseFilter=DualPoseFilter;
  Core.visibility=vis;
  root.PoseFilterCore=Core;
})(typeof window!=="undefined"?window:globalThis);

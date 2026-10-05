(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.CameraPolicy=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  const PROFILES=[
    {id:"720p60",width:1280,height:720,fps:60,detail:4.2,highFps:true},
    {id:"1440p30",width:2560,height:1440,fps:30,detail:5},
    {id:"1080p30",width:1920,height:1080,fps:30,detail:4},
    {id:"900p30",width:1600,height:900,fps:30,detail:3.5},
    {id:"720p30",width:1280,height:720,fps:30,detail:3},
    {id:"540p30",width:960,height:540,fps:30,detail:2},
    {id:"480p30",width:640,height:480,fps:30,detail:1.5},
    {id:"360p24",width:640,height:360,fps:24,detail:1},
  ];
  const area=p=>p.width*p.height;
  function capNumber(x,k){const v=x?.[k];return Number.isFinite(Number(v))?Number(v):null;}
  function capabilityAllows(p,caps={}){
    const wMax=capNumber(caps.width,"max")??Number(caps.width?.max),hMax=Number(caps.height?.max),fMax=Number(caps.frameRate?.max);
    const wMin=Number(caps.width?.min),hMin=Number(caps.height?.min);
    if(Number.isFinite(wMax)&&p.width>wMax+2)return false;
    if(Number.isFinite(hMax)&&p.height>hMax+2)return false;
    if(Number.isFinite(wMin)&&p.width<wMin-2)return false;
    if(Number.isFinite(hMin)&&p.height<hMin-2)return false;
    if(Number.isFinite(fMax)&&p.fps>fMax+1)return false;
    return true;
  }
  function ceiling(role="side",activeCount=1,mode="auto",authority=null){
    // Keep the proven A2 startup budget, but once V4 Core identifies the best
    // evidence camera that role may inherit the high-detail ceiling regardless
    // of whether its UI label is Side, Rear or Overhead.
    if(mode==="performance")return role==="side"?"720p30":"540p30";
    if(mode==="detail")return "1440p30";
    if(activeCount<=1)return "1440p30";
    if(activeCount===2){if(authority===true)return "1440p30";if(authority===false)return "1080p30";return role==="side"?"1440p30":"1080p30";}
    if(authority===true)return "1080p30";if(authority===false)return "720p30";return role==="side"?"1080p30":"720p30";
  }
  function candidates(role="side",activeCount=1,mode="auto",caps={},authority=null){
    const ceilId=ceiling(role,activeCount,mode,authority),ceil=PROFILES.find(p=>p.id===ceilId)||PROFILES[4],maxArea=area(ceil);
    const fMax=Number(caps?.frameRate?.max),singleHighFps=mode==="auto"&&Number(activeCount)<=1&&Number.isFinite(fMax)&&fMax>=50;
    let out=PROFILES.filter(p=>area(p)<=maxArea&&capabilityAllows(p,caps)&&(singleHighFps||!p.highFps));
    if(!out.length)out=PROFILES.filter(p=>capabilityAllows(p,caps)&&(singleHighFps||!p.highFps));
    // One-camera Auto prefers real 60 fps at 720p when the device explicitly advertises it.
    // Multi-camera / manual Detail stays at the proven 30 fps bandwidth budget by default.
    if(singleHighFps)out.sort((a,b)=>(b.highFps?1:0)-(a.highFps?1:0)||b.detail-a.detail);
    return out.length?out:[...PROFILES.filter(p=>!p.highFps)];
  }
  function nearestIndex(settings={},profiles=PROFILES){
    const w=Number(settings.width)||0,h=Number(settings.height)||0,f=Number(settings.frameRate)||0;
    if(!w||!h)return profiles.length-1;
    let best=0,err=Infinity;profiles.forEach((p,i)=>{const e=Math.abs(p.width-w)/Math.max(p.width,1)+Math.abs(p.height-h)/Math.max(p.height,1)+(f?Math.abs(p.fps-f)/Math.max(p.fps,30)*.35:0);if(e<err){err=e;best=i;}});return best;
  }
  function decision({role="side",authority=true,activeCount=1,mode="auto",settings={},hz=null,costMs=null,phase="Setup",armed=false,candidate=false,stableGood=0}={}){
    const unsafe=armed||candidate||["Draw","Anchor","Aim / Hold","Expansion","Release","Follow Through"].includes(phase);
    if(mode!=="auto"||unsafe)return{action:"hold",reason:unsafe?"shot active":"manual mode",stableGood:0};
    const currentArea=(Number(settings.width)||0)*(Number(settings.height)||0),ceil=PROFILES.find(p=>p.id===ceiling(role,activeCount,mode,authority))||PROFILES[4];
    if(currentArea>area(ceil)*1.08)return{action:"down",reason:"multi-camera bandwidth budget",stableGood:0,targetCeiling:ceil.id};
    const h=Number(hz),c=Number(costMs),priority=!!authority;
    const overloaded=(Number.isFinite(h)&&(priority?h<10.5:h<5.8))||(Number.isFinite(c)&&(priority?c>72:c>105));
    if(overloaded)return{action:"down",reason:Number.isFinite(h)?`pose ${h.toFixed(1)} Hz`:`inference ${c.toFixed(0)} ms`,stableGood:0};
    const strong=(Number.isFinite(h)?h>(priority?15.5:8.0):false)&&(Number.isFinite(c)?c<(priority?48:82):true);
    const nextStable=strong?stableGood+1:0;
    if(nextStable>=3&&currentArea<area(ceil)*.90)return{action:"up",reason:"performance headroom",stableGood:0,targetCeiling:ceil.id};
    return{action:"hold",reason:strong?"building headroom":"balanced",stableGood:nextStable,targetCeiling:ceil.id};
  }
  return{PROFILES,candidates,ceiling,nearestIndex,decision,area};
});

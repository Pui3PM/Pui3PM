// 3PM BLE4.3.8.9.4.1 Coach Keyframe Plan
// The frozen Dev4 app still asks for build15(), so that legacy entry point remains unchanged.
// build25() is an asynchronous post-shot enrichment plan: it adds evidence density around Release
// without putting extra work on the live Capture critical path. Release T0 is always fixed.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CoachKeyframePlanCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='BLE4.3.8.9.4.1-keyframe25-t0-v5';
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
function phaseTimes(events,phase){return events.filter(e=>String(e?.phase)===phase&&finite(e?.epochMs)).map(e=>Number(e.epochMs)).sort((a,b)=>a-b);}
function first(events,phase){const a=phaseTimes(events,phase);return a.length?a[0]:null;}
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function semanticPre(phaseTimeline,releaseEpochMs,count=6){
  const release=Number(releaseEpochMs),events=Array.isArray(phaseTimeline)?phaseTimeline.filter(e=>finite(e?.epochMs)):[];
  const drawAt=first(events,'Draw'),anchorAt=first(events,'Anchor'),holdAt=first(events,'Aim / Hold'),expansionAt=first(events,'Expansion');
  const off=t=>finite(t)?Math.round(Number(t)-release):null;
  const drawOff=off(drawAt),anchorOff=off(anchorAt),holdOff=off(holdAt),expOff=off(expansionAt);
  const fallback=[-3200,-2250,-1550,-1100,-700,-400];
  let pre=[
    {offset:drawOff,label:'Draw Start',phase:'Draw',priority:8,kind:'context'},
    {offset:finite(drawAt)&&finite(anchorAt)?Math.round(((Number(drawAt)+Number(anchorAt))/2)-release):null,label:'Mid Draw',phase:'Draw',priority:8,kind:'context'},
    {offset:anchorOff,label:'Anchor Acquisition',phase:'Anchor',priority:9,kind:'context'},
    {offset:holdOff,label:'Anchor Settled',phase:'Aim / Hold',priority:9,kind:'context'},
    {offset:finite(holdAt)?Math.round(Number(holdAt)+Math.max(0,release-Number(holdAt))*.48-release):null,label:'Representative Hold',phase:'Aim / Hold',priority:9,kind:'context'},
    {offset:finite(expOff)&&expOff< -300?expOff:(finite(holdAt)?Math.round(Number(holdAt)+Math.max(0,release-Number(holdAt))*.76-release):null),label:finite(expOff)&&expOff< -300?'Expansion · visually resolved':'Late Hold / Pre-Release Context',phase:finite(expOff)&&expOff< -300?'Expansion':'Aim / Hold',priority:9,kind:'context'}
  ];
  pre=pre.map((r,i)=>({...r,offset:finite(r.offset)?Number(r.offset):fallback[i]}));
  pre.sort((a,b)=>a.offset-b.offset);
  for(let i=pre.length-1;i>=0;i--){const upper=i===pre.length-1?-360:pre[i+1].offset-70;pre[i].offset=Math.round(clamp(pre[i].offset,-10000,upper));}
  const semantic=['Draw Start','Mid Draw','Anchor Acquisition','Anchor Settled','Representative Hold'];
  if(pre.slice(0,5).some((r,i)=>r.label!==semantic[i])){
    pre=[
      {offset:drawOff??fallback[0],label:'Draw Start',phase:'Draw',priority:8,kind:'context'},
      {offset:fallback[1],label:'Mid Draw',phase:'Draw',priority:8,kind:'context'},
      {offset:anchorOff??fallback[2],label:'Anchor Acquisition',phase:'Anchor',priority:9,kind:'context'},
      {offset:holdOff??fallback[3],label:'Anchor Settled',phase:'Aim / Hold',priority:9,kind:'context'},
      {offset:fallback[4],label:'Representative Hold',phase:'Aim / Hold',priority:9,kind:'context'},
      {offset:finite(expOff)&&expOff< -300?expOff:fallback[5],label:finite(expOff)&&expOff< -300?'Expansion · visually resolved':'Late Hold / Pre-Release Context',phase:finite(expOff)&&expOff< -300?'Expansion':'Aim / Hold',priority:9,kind:'context'}
    ];
    for(let i=pre.length-1;i>=0;i--){const upper=i===pre.length-1?-360:pre[i+1].offset-70;pre[i].offset=Math.round(clamp(pre[i].offset,-10000,upper));}
  }
  return {events,pre:pre.slice(0,count)};
}
function build15(phaseTimeline,releaseEpochMs){
  const release=Number(releaseEpochMs);
  if(!finite(release))return{requests:[],requiredPostMs:1030,source:'invalid-release',targetCount:15,releaseIndex:8,version:VERSION};
  const {events,pre}=semanticPre(phaseTimeline,release,6);
  const requests=[...pre,
    {offset:-260,label:'Pre-Release · -0.26 s',phase:'Release',priority:10,kind:'release'},
    {offset:-100,label:'Pre-Release · -0.10 s',phase:'Release',priority:10,kind:'release'},
    {offset:0,label:'Release T0',phase:'Release',priority:10,kind:'release'},
    {offset:70,label:'Post-Release · +0.07 s',phase:'Follow Through',priority:10,kind:'release'},
    {offset:160,label:'Post-Release · +0.16 s',phase:'Follow Through',priority:10,kind:'release'},
    {offset:280,label:'Post-Release · +0.28 s',phase:'Follow Through',priority:10,kind:'release'},
    {offset:450,label:'Early Follow-through',phase:'Follow Through',priority:9,kind:'follow'},
    {offset:650,label:'Follow-through · +0.65 s',phase:'Follow Through',priority:8,kind:'follow'},
    {offset:850,label:'Meaningful Follow-through End',phase:'Follow Through',priority:8,kind:'follow'}
  ];
  return{requests,targetCount:15,releaseIndex:8,requiredPostMs:1030,source:events.length?'phase-aware-t0-protected-15':'release-t0-protected-15',version:VERSION};
}
function build25(phaseTimeline,releaseEpochMs){
  const release=Number(releaseEpochMs);
  if(!finite(release))return{requests:[],requiredPostMs:1030,source:'invalid-release',targetCount:25,releaseIndex:12,version:VERSION};
  const {events,pre}=semanticPre(phaseTimeline,release,5);
  // 12 frames before T0, T0 fixed at 13/25, 12 after. The seven pre/post Release slots follow
  // real 30/60 fps cadence closely enough to expose whether T0 is actually aligned with reaction.
  const requests=[...pre,
    {offset:-400,label:'Release Approach · -0.40 s',phase:'Aim / Hold',priority:10,kind:'release'},
    {offset:-300,label:'Release Approach · -0.30 s',phase:'Aim / Hold',priority:10,kind:'release'},
    {offset:-233,label:'Pre-Release · -0.23 s',phase:'Release',priority:10,kind:'release'},
    {offset:-167,label:'Pre-Release · -0.17 s',phase:'Release',priority:10,kind:'release'},
    {offset:-100,label:'Pre-Release · -0.10 s',phase:'Release',priority:10,kind:'release'},
    {offset:-67,label:'Pre-Release · -0.07 s',phase:'Release',priority:10,kind:'release'},
    {offset:-33,label:'Pre-Release · -0.03 s',phase:'Release',priority:10,kind:'release'},
    {offset:0,label:'Release T0',phase:'Release',priority:10,kind:'release'},
    {offset:33,label:'Post-Release · +0.03 s',phase:'Follow Through',priority:10,kind:'release'},
    {offset:67,label:'Post-Release · +0.07 s',phase:'Follow Through',priority:10,kind:'release'},
    {offset:100,label:'Post-Release · +0.10 s',phase:'Follow Through',priority:10,kind:'release'},
    {offset:167,label:'Post-Release · +0.17 s',phase:'Follow Through',priority:10,kind:'release'},
    {offset:233,label:'Post-Release · +0.23 s',phase:'Follow Through',priority:10,kind:'release'},
    {offset:300,label:'Post-Release · +0.30 s',phase:'Follow Through',priority:10,kind:'release'},
    {offset:400,label:'Post-Release · +0.40 s',phase:'Follow Through',priority:10,kind:'release'},
    {offset:500,label:'Early Follow-through · +0.50 s',phase:'Follow Through',priority:9,kind:'follow'},
    {offset:600,label:'Follow-through · +0.60 s',phase:'Follow Through',priority:9,kind:'follow'},
    {offset:700,label:'Follow-through · +0.70 s',phase:'Follow Through',priority:8,kind:'follow'},
    {offset:800,label:'Follow-through · +0.80 s',phase:'Follow Through',priority:8,kind:'follow'},
    {offset:850,label:'Meaningful Follow-through End',phase:'Follow Through',priority:8,kind:'follow'}
  ];
  return{requests,targetCount:25,releaseIndex:12,requiredPostMs:1030,source:events.length?'phase-aware-t0-protected-25':'release-t0-protected-25',version:VERSION};
}
return{VERSION,build15,build25};
});

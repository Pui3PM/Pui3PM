// Brute-force oracle for contract §2.6 assignment: max cardinality -> min total |delta| -> lexicographic (slotId,frameUID,derivationId) list.
const {project25,slotTargets}=require('/home/claude/run/app/shadow/projector/logical25');const H='a'.repeat(64);
function cand(uid,t,fps){return {candidateId:'c'+uid,frameUID:uid,derivationId:'d',runId:'r',cycleId:'c',role:'side',masterClockId:'m',sourceId:'cam',streamGeneration:'g',payloadRef:'b/'+uid,payloadState:'available',contentDigest:H,actualMasterTime:t,mappingStatus:'validated',mappingUncertainty:0,decodeValid:true,width:10,height:10,measuredFPS:fps,phaseEvidenceRefs:['p']};}
function pct(a,p){if(!a.length)return 0;const x=[...a].sort((a,b)=>a-b);return x[Math.round((x.length-1)*p)];}
function tol(frames){const t=frames.map(f=>f.actualMasterTime).sort((a,b)=>a-b),ds=[];for(let i=1;i<t.length;i++){const d=t[i]-t[i-1];if(d>0&&d<250000)ds.push(d);}const med=ds.length?[...ds].sort((a,b)=>a-b)[Math.floor(ds.length/2)]:null;const dev=med===null?[]:ds.map(d=>Math.abs(d-med));const P=med||Math.round(1e6/frames[0].measuredFPS);return Math.min(50000,Math.ceil(P/2+pct(dev,.95)));}
let seed=7;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
const tl={anchor:{status:'verified',start:0,end:400000,refs:['a']},hold:{status:'verified',start:400000,end:800000,refs:['h']}};
const slots=slotTargets({timeline:tl}).map((s,i)=>({...s,i})).filter(s=>s.targetMasterTime!==null);
let checked=0,bad=null;
for(let iter=0;iter<4000&&!bad;iter++){
 const n=2+Math.floor(rnd()*4);const fr=[];const used=new Set();
 for(let k=0;k<n;k++){let u;do{u='f'+String.fromCharCode(65+Math.floor(rnd()*8));}while(used.has(u));used.add(u);fr.push(cand(u,Math.round(rnd()*32)*25000,10));}
 const T=tol(fr);
 const elig=(s,f)=>Math.abs(f.actualMasterTime-s.targetMasterTime)<=T&&f.actualMasterTime>=tl[s.phase].start&&f.actualMasterTime<=tl[s.phase].end;
 let best=null;
 const rec=(si,usedF,list,cost)=>{if(si===slots.length){const key=[-list.length,cost];const lex=list.map(([s,f])=>s+'|'+f).join(',');if(!best||key[0]<best.k[0]||(key[0]===best.k[0]&&(key[1]<best.k[1]||(key[1]===best.k[1]&&lex<best.lex))))best={k:key,lex,list:[...list]};return;}
  rec(si+1,usedF,list,cost);const s=slots[si];for(const f of fr){if(usedF.has(f.frameUID)||!elig(s,f))continue;usedF.add(f.frameUID);list.push([s.slotId,f.frameUID]);rec(si+1,usedF,list,cost+Math.abs(f.actualMasterTime-s.targetMasterTime));list.pop();usedF.delete(f.frameUID);}};
 rec(0,new Set(),[],0);
 const p=project25({runId:'r',cycleId:'c',masterClockId:'m',role:'side',timeline:tl,candidates:fr});
 const got=p.slots.filter(s=>s.status==='real').map(s=>s.slotId+'|'+s.actualFrameUID).join(',');
 const gotCost=p.slots.filter(s=>s.status==='real').reduce((a,s)=>a+Math.abs(s.signedDelta),0);
 checked++;if(got!==best.lex)bad={frames:fr.map(f=>[f.frameUID,f.actualMasterTime]),T,expected:best.lex,expectedCost:best.k[1],got,gotCost};
}
console.log(JSON.stringify({checked,counterexample:bad}));

'use strict';
// Independent brute-force oracle for contract §2.6 on the FULL 25-slot plan:
// multi-phase timeline + overlapping release window, mapping uncertainty, jitter, 2 derivations per UID,
// two role bindings. Objective: max cardinality -> min total |delta| -> lexicographic (slotId,frameUID,derivationId).
// Usage: node independent_projector_oracle.cjs <tree>/app [cases]
const path=require('path');const APP=path.resolve(process.argv[2]||'.');const N=Number(process.argv[3]||3000);
const {project25,slotTargets}=require(path.join(APP,'shadow/projector/logical25'));const F=require(path.join(APP,'tests/phase01/_shadow_fixture.js'));
let seed=Number(process.env.SEED||20261002);const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};const pick=a=>a[Math.floor(rnd()*a.length)];
const TL={masterClockId:'m',draw:{status:'verified',start:0,end:200000,refs:['d']},anchor:{status:'verified',start:250000,end:600000,refs:['a']},hold:{status:'verified',start:600000,end:900000,refs:['h']}};
const REL=1000000;const slots=slotTargets({timeline:TL,releaseTime:REL});
let checked=0,bad=null;
for(let it=0;it<N&&!bad;it++){
 const binds=[F.binding({sourceId:'cam',streamGeneration:'g',startMasterTime:0,endMasterTime:1300000,capturePeriodUs:pick([33333,66666,100000]),jitterUs:pick([0,5000])}),F.binding({sourceId:'cam',streamGeneration:'g2',startMasterTime:0,endMasterTime:1300000,capturePeriodUs:pick([33333,66666]),jitterUs:0})];
 const n=2+Math.floor(rnd()*5),cands=[];
 for(let k=0;k<n;k++){const gen=rnd()<0.75?'g':'g2',seq=it*20+k+1,t=Math.round(rnd()*72)*16667,u=pick([0,0,1500,3000]);
  cands.push(F.candidate(seq,t,{streamGeneration:gen,derivationId:'dA',width:10,height:10,mappingUncertainty:u,candidateId:`c${seq}A`}));
  if(rnd()<0.3)cands.push(F.candidate(seq,t,{streamGeneration:gen,derivationId:'dB',width:pick([10,20]),height:10,mappingUncertainty:u,candidateId:`c${seq}B`}));}
 // oracle derivation choice: highest area, then lexical derivationId
 const by=new Map();for(const c of cands){const p=by.get(c.frameUID);if(!p||c.width*c.height>p.width*p.height||(c.width*c.height===p.width*p.height&&c.derivationId<p.derivationId))by.set(c.frameUID,c);}
 const frames=[...by.values()];const bOf=c=>binds.find(b=>b.streamGeneration===c.streamGeneration);
 const tol=c=>Math.min(50000,Math.ceil(bOf(c).capturePeriodUs/2+bOf(c).jitterUs+c.mappingUncertainty));
 const elig=(s,c)=>{if(!Number.isSafeInteger(s.targetMasterTime))return false;if(Math.abs(c.actualMasterTime-s.targetMasterTime)>tol(c))return false;if(s.phase==='release_window')return true;const iv=TL[s.phase];return !!iv&&c.actualMasterTime-c.mappingUncertainty>=iv.start&&c.actualMasterTime+c.mappingUncertainty<=iv.end;};
 let best=null;const used=new Set();
 const recur=(fi,list,cost)=>{if(fi===frames.length){const sorted=[...list].sort((a,b)=>a[0]-b[0]);const lex=sorted.map(([si,c])=>`${slots[si].slotId}|${c.frameUID}|${c.derivationId}`).join(',');if(!best||sorted.length>best.n||(sorted.length===best.n&&(cost<best.cost||(cost===best.cost&&lex<best.lex))))best={n:sorted.length,cost,lex};return;}
  const c=frames[fi];recur(fi+1,list,cost);slots.forEach((s,si)=>{if(used.has(si)||!elig(s,c))return;used.add(si);list.push([si,c]);recur(fi+1,list,cost+Math.abs(c.actualMasterTime-s.targetMasterTime));list.pop();used.delete(si);});};
 recur(0,[],0);
 const p=project25({runId:'r',cycleId:'c',masterClockId:'m',role:'side',timeline:TL,releaseTime:REL,candidates:cands,roleBindings:binds,projectionId:'o'+it,configDigest:'cfg'});
 const real=p.slots.filter(s=>s.status==='real'),lex=real.map(s=>`${s.slotId}|${s.actualFrameUID}|${s.derivationId}`).join(','),cost=real.reduce((a,s)=>a+Math.abs(s.signedDelta),0);
 if(real.length!==best.n||cost!==best.cost||lex!==best.lex)bad={it,expected:best,got:{n:real.length,cost,lex},frames:frames.map(f=>[f.frameUID.slice(0,10),f.streamGeneration,f.actualMasterTime,f.mappingUncertainty,f.derivationId])};
 checked++;}
console.log(JSON.stringify({kind:'independent-full25-oracle',checked,counterexample:bad}));process.exit(bad?1:0);

const fs=require('fs'),path=require('path');const {project25}=require('./candidate/3PM_Analyzer_R8_P1_Harden_DEV/app/shadow/projector/logical25');let found=null,checked=0;
for(let mask=0;mask<4096;mask++){
 const times=[mask%16,Math.floor(mask/16)%16,Math.floor(mask/256)%16].map(t=>100000+t);if(new Set(times).size<3)continue;
 const candidates=times.map((t,i)=>({role:'side',frameUID:'f'+i,candidateId:'c'+i,derivationId:'d',actualMasterTime:t,mappingStatus:'validated',mappingUncertainty:0,decodeValid:true,width:1,height:1,measuredFPS:30}));
 const timeline={anchor:{status:'verified',start:100000,end:100016}};const p=project25({role:'side',runId:'r',cycleId:'c',timeline,candidates});const slots=p.slots.slice(2,5);let bestN=-1,bestCost=Infinity;
 function walk(i,used,n,cost){if(i===3){if(n>bestN||n===bestN&&cost<bestCost){bestN=n;bestCost=cost;}return;}walk(i+1,used,n,cost);for(let j=0;j<3;j++)if(!used.has(j)&&Math.abs(times[j]-slots[i].targetMasterTime)<=slots[i].toleranceUs){const s=new Set(used);s.add(j);walk(i+1,s,n+1,cost+Math.abs(times[j]-slots[i].targetMasterTime));}}
 walk(0,new Set(),0,0);const real=slots.filter(x=>x.status==='real');const cost=real.reduce((s,x)=>s+Math.abs(x.signedDelta),0);checked++;
 if(real.length!==bestN||cost!==bestCost){found={times,actual:{n:real.length,cost},expected:{n:bestN,cost:bestCost},slots};break;}
}
const out={checked,counterexample:found};fs.writeFileSync(path.join(__dirname,'matching_oracle_results.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));

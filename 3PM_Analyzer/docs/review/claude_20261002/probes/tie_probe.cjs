const {project25}=require('/home/claude/run/app/shadow/projector/logical25');const H='a'.repeat(64);
function cand(uid,t,x={}){return {candidateId:'c'+uid,frameUID:uid,derivationId:'d',runId:'r',cycleId:'c',role:'side',masterClockId:'m',sourceId:'cam',streamGeneration:'g',payloadRef:'b/'+uid,payloadState:'available',contentDigest:H,actualMasterTime:t,mappingStatus:'validated',mappingUncertainty:0,decodeValid:true,width:10,height:10,measuredFPS:10,phaseEvidenceRefs:['p'],...x};}
const tl={anchor:{status:'verified',start:0,end:400000,refs:['a']}};const res={};
for(const order of [['fA','fB'],['fB','fA']]){const p=project25({runId:'r',cycleId:'c',masterClockId:'m',role:'side',timeline:tl,candidates:order.map(u=>cand(u,150000))});res[order.join('>')]=p.slots.slice(2,4).map(s=>[s.slotId,s.actualFrameUID,s.signedDelta]);}
// different-cadence probe: two sources in one role; does cad use per-source?
console.log(JSON.stringify({contractExpectsS03:'fA',result:res}));

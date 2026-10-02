'use strict';
const assert=require('assert'),crypto=require('crypto');
const {frameUID:nodeUID}=require('../../shadow/contracts/identity');
const {frameUID:webUID}=require('../../shadow/contracts/identity_browser');
const {ReplayAdapter}=require('../../shadow/adapters/replay/replay_adapter');
const {validateClockMapping}=require('../../shadow/contracts/clock_mapper');
const F=require('./_shadow_fixture');
function sample(seq,pts=null,{payload=false}={}){return {frameSeq:String(seq),sourcePTS:pts===null?null:String(pts),sourceTimebase:pts===null?undefined:{numerator:'1',denominator:'1000000'},clockId:'clk',timestampKind:pts===null?'unknown':'presentation',sourceTimeMissingReason:pts===null?'fixture_missing':null,width:640,height:480,mirror:null,rotation:0,pixelFormat:'rgba',arrivalTime:F.arrival(Number(pts??seq)),payloadRef:payload?`blob/${seq}`:null,contentDigest:payload?crypto.createHash('sha256').update(String(seq)).digest('hex'):null,quality:{decodeValid:payload,trackingConfidence:null,blurScore:null,exposureClipped:null,qualitySchema:'q',flags:[]},dropCounters:{source:null,transport:null,encoder:null,counterScope:'g'},transformId:'identity'};}
(async()=>{
 const id={runId:'r',sourceId:'s',streamGeneration:'g',frameSeq:'18446744073709551615'};assert.equal(await webUID(id,crypto.webcrypto),nodeUID(id));
 for(const bad of ['18446744073709551616','-0','',null,true]){const x={...id,frameSeq:bad};assert.throws(()=>nodeUID(x));await assert.rejects(()=>webUID(x,crypto.webcrypto));}
 assert.throws(()=>nodeUID({...id,runId:'r\uD800'}));await assert.rejects(()=>webUID({...id,runId:'r\uD800'},crypto.webcrypto));
 const mapping=validateClockMapping(F.mapping());
 const a=new ReplayAdapter({runId:'r',masterClockId:'m',sourceId:'cam',streamGeneration:'g',role:'side',createdByVersion:'test-v1',backendVersion:'1',mapping});
 const f1=a.envelope(sample(1,1000,{payload:true})),f2=a.envelope(sample(2,2000,{payload:true}));assert.notEqual(f1.frameUID,f2.frameUID);assert.equal(f1.mappedMasterTime,1000);
 assert.throws(()=>a.envelope(sample(2,9000,{payload:true})),/FRAMESEQ_DISCONTINUITY/);
 const b=new ReplayAdapter({runId:'r',masterClockId:'m',sourceId:'cam',streamGeneration:'g2',role:'side',createdByVersion:'test-v1',backendVersion:'1'});const restarted=b.envelope({...sample(1),dropCounters:{source:null,transport:null,encoder:null,counterScope:'g2'}});assert.notEqual(restarted.frameUID,f1.frameUID);
 assert.throws(()=>new ReplayAdapter({runId:'r',masterClockId:'m',sourceId:'cam',streamGeneration:'g'}),/role|required/);
 assert.throws(()=>b.envelope({...sample(2),quality:{decodeValid:true,trackingConfidence:null,blurScore:null,exposureClipped:null,qualitySchema:'q',flags:[]}}),/decodeValid/);
 console.log('P1-02 replay identity/discontinuity: PASS');
})().catch(e=>{console.error(e);process.exit(1);});

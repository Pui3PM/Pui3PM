const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','static','bow_sensor_ble.js'),'utf8');
const store=new Map();
const document={readyState:'loading',querySelector:()=>null,querySelectorAll:()=>[],addEventListener:()=>{}};
const windowObj={FormAnalyzer:{getCurrentSession:()=>null,getCurrentAthlete:()=>null},addEventListener:()=>{},dispatchEvent:()=>{}};
const ctx={window:windowObj,document,sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},navigator:{},fetch:async()=>({ok:false,json:async()=>({})}),CustomEvent:function(){},indexedDB:undefined,console,setTimeout,clearTimeout,Blob:function(){},URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},Date,Math,Number,Map,Set,Uint8Array,ArrayBuffer,DataView,BigInt,TextDecoder};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
function frame(kind){const b=new ArrayBuffer(20),d=new DataView(b);d.setUint8(0,kind);d.setUint8(1,1);d.setUint8(2,1);d.setUint8(3,1);d.setUint32(4,12,true);return d;}
const a=frame(0xB1);a.setUint32(8,5000,true);a.setUint16(12,3180,true);a.setUint16(14,730,true);a.setUint16(16,440,true);a.setUint8(18,85);a.setUint8(19,91);
const b=frame(0xB2);b.setInt16(8,52,true);b.setInt16(10,48,true);b.setInt16(12,50,true);b.setInt16(14,81,true);b.setInt16(16,3020,true);b.setInt16(18,11400,true);
const c=frame(0xB3);c.setInt16(8,123,true);c.setInt16(10,7370,true);c.setUint8(12,88);c.setUint8(13,79);c.setUint16(14,2222,true);c.setUint16(16,4400,true);c.setUint16(18,7,true);
const api=ctx.window.ThreePMBowSensor;
api.ingestSummaryFrame(a,'test',10000);api.ingestSummaryFrame(b,'test',10004);api.ingestSummaryFrame(c,'test',10008);
setTimeout(()=>{const shots=api.getSensorShots();if(!shots.length)throw new Error('No summary record created');const r=shots[0],m=r.metrics;const assert=(x,msg)=>{if(!x)throw new Error(msg)};assert(r.authoritative==='S3_SUMMARY_V1','Not authoritative S3 summary');assert(m.scores.motionIndex===85,'Motion Index mismatch');assert(m.holdRmsDps===0.52,'Hold RMS mismatch');assert(m.aimDriftDeg===0.48,'Drift mismatch');assert(m.cantReleaseDeg===0.5,'Cant mismatch');assert(m.releaseDisturbanceDeg===0.81,'Disturbance mismatch');assert(m.releasePeakDps===302,'Peak dps mismatch');assert(m.releasePeakG===11.4,'Peak G mismatch');assert(m.bowRotationDeg===73.7,'Rotation mismatch');assert(m.holdDurationMs===3180,'Hold ms mismatch');console.log('BLE4.1 authoritative summary protocol QA: PASS · exact S3 metrics preserved');},20);

const fs=require('fs'),vm=require('vm'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','static','bow_sensor_ble.js'),'utf8');
const store=new Map();
const document={readyState:'loading',querySelector:()=>null,querySelectorAll:()=>[],addEventListener:()=>{}};
const windowObj={FormAnalyzer:{getCurrentSession:()=>null,getCurrentAthlete:()=>null},addEventListener:()=>{},dispatchEvent:()=>{}};
const ctx={window:windowObj,document,sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},navigator:{},fetch:async()=>({ok:false,json:async()=>({})}),CustomEvent:function(){},indexedDB:undefined,console,setTimeout,clearTimeout,Blob:function(){},URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},Date,Math,Number,Map,Set,Uint8Array,ArrayBuffer,DataView,BigInt,TextDecoder};
ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
const api=ctx.window.ThreePMBowSensor;
function meta(){const b=new ArrayBuffer(20),d=new DataView(b);d.setUint8(0,0xC1);d.setUint8(1,1);d.setUint8(2,1);d.setUint8(3,1);d.setUint32(4,12,true);d.setUint8(8,5);d.setUint8(9,4);d.setInt16(10,-800,true);d.setUint16(12,30,true);d.setUint16(14,100,true);d.setUint16(16,2222,true);d.setUint16(18,9,true);return d;}
function chunk(kind,idx,pairs){const b=new ArrayBuffer(20),d=new DataView(b);d.setUint8(0,kind);d.setUint8(1,1);d.setUint8(2,1);d.setUint8(3,idx);d.setUint32(4,12,true);pairs.forEach((p,j)=>{d.setInt16(8+j*4,p[0],true);d.setInt16(10+j*4,p[1],true)});return d;}
api.ingestTraceFrame(meta(),'test',9000);
api.ingestTraceFrame(chunk(0xC2,0,[[10,20],[20,30],[30,40]]),'test',9004);
api.ingestTraceFrame(chunk(0xC2,1,[[40,50],[50,60],[0,0]]),'test',9008);
api.ingestTraceFrame(chunk(0xC3,0,[[11,12],[21,22],[31,32]]),'test',9012);
api.ingestTraceFrame(chunk(0xC3,1,[[41,42],[0,0],[0,0]]),'test',9016);
function summary(kind){const b=new ArrayBuffer(20),d=new DataView(b);d.setUint8(0,kind);d.setUint8(1,1);d.setUint8(2,1);d.setUint8(3,1);d.setUint32(4,12,true);return d;}
const a=summary(0xB1);a.setUint32(8,5000,true);a.setUint16(12,3180,true);a.setUint16(14,730,true);a.setUint16(16,440,true);a.setUint8(18,85);a.setUint8(19,91);
const b=summary(0xB2);b.setInt16(8,52,true);b.setInt16(10,48,true);b.setInt16(12,50,true);b.setInt16(14,81,true);b.setInt16(16,3020,true);b.setInt16(18,11400,true);
const c=summary(0xB3);c.setInt16(8,123,true);c.setInt16(10,7370,true);c.setUint8(12,88);c.setUint8(13,79);c.setUint16(14,2222,true);c.setUint16(16,4400,true);c.setUint16(18,7,true);
api.ingestSummaryFrame(a,'test',10000);api.ingestSummaryFrame(b,'test',10004);api.ingestSummaryFrame(c,'test',10008);
setTimeout(()=>{const r=api.getSensorShots()[0];const assert=(x,m)=>{if(!x)throw new Error(m)};assert(r,'No sensor record');assert(r.trace?.authoritative==='S3_TRACE_V1','Trace not attached as authoritative S3 trace');assert(r.trace.start_ms===-800&&r.trace.step_ms===30,'Trace timing mismatch');assert(JSON.stringify(r.trace.gyro)==='[1,2,3,4,5]','Gyro reconstruction mismatch');assert(JSON.stringify(r.trace.accel)==='[0.02,0.03,0.04,0.05,0.06]','Accel reconstruction mismatch');assert(JSON.stringify(r.trace.hold_x)==='[0.11,0.21,0.31,0.41]','Hold X reconstruction mismatch');assert(JSON.stringify(r.trace.hold_y)==='[0.12,0.22,0.32,0.42]','Hold Y reconstruction mismatch');console.log('BLE4.2 S3 visual trace protocol QA: PASS · exact saved trace reconstructed and attached to summary record');},25);

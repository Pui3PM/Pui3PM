'use strict';
const assert=require('assert');
function putRecord(db,record){db.record=structuredClone(record);}
const db={record:{key:'1:7:side',recordVersion:1,frames:[{uid:'A'}],recovery:null,metadata:{base:true}}};
const staleNativeRead=structuredClone(db.record);
putRecord(db,{...db.record,recordVersion:2,frames:[...db.record.frames,{uid:'R'}],recovery:{end:900},metadata:{...db.record.metadata,recovery:true}});
const nativeMerged={...staleNativeRead,frames:[...staleNativeRead.frames,{uid:'N'}],native:true};
putRecord(db,nativeMerged);
assert.equal(db.record.recovery,null,'stale whole-record replacement must lose newer Recovery in baseline model');
assert.deepEqual(db.record.frames.map(x=>x.uid),['A','N']);
console.log(JSON.stringify({finding:'F04',baselineFinal:db.record,lost:['R','recovery metadata'],note:'Controlled interleaving model derived from native/temporal whole-record put paths; source call graph recorded separately.'},null,2));

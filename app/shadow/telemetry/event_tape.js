'use strict';
const {utf8ByteLength}=require('../contracts/binary_pure');
const {immutablePlainCopy}=require('../contracts/strict_types');
class EventTape{
  constructor({maxEvents=20000,maxApproxBytes=8*1024*1024}={}){this.maxEvents=maxEvents;this.maxApproxBytes=maxApproxBytes;this.events=[];this.bytes=0;this.dropped=0;this.seq=0;}
  append(event){
    const row=immutablePlainCopy({...event,sequence:++this.seq});
    const n=utf8ByteLength(JSON.stringify(row));
    this.events.push(row);this.bytes+=n;
    while(this.events.length>this.maxEvents||this.bytes>this.maxApproxBytes){const x=this.events.shift();this.bytes-=utf8ByteLength(JSON.stringify(x));this.dropped++;}
    return row;
  }
  snapshot(){return immutablePlainCopy({events:this.events,dropped:this.dropped,sequence:this.seq,approxBytes:this.bytes});}
}
module.exports={EventTape};

'use strict';
const assert=require('assert'),path=require('path'),H=require('./p108_harness');
const root=path.join(__dirname,'../static');
(async()=>{
 let checks=0;
 for(const bad of [{data:{roles:{side:{active:true}}}},{data:{roles:{side:{active:true,generation:1}}},status:503},{data:{roles:{side:{generation:1}}}},{data:{roles:{side:{active:true,generation:1,error:'bad'}}}},{throw:true}]){
  const bridge=async(p,b)=>{if(p==='/health')return{data:{ok:true,backend_id:'native-avfoundation'}};if(p==='/open'||p==='/close')return{data:{ok:true}};if(p==='/diag'){if(bad.throw)throw Error('timeout');return bad;}throw Error(p);};
  const e=H.env(root,{bridge});e.N.openRole('side',{label:'test',getSettings:()=>({frameRate:30})},1);await H.tick(550);assert.equal(e.N.states.side.active,false);assert.equal(e.N.diagnostics('side').confirmed===true,false);checks++;
 }
 const e=H.env(root,{bridge:H.nativeBridge({rel:1000,frames:[]})});await H.openNative(e);assert.equal(e.N.diagnostics('side').confirmed,true);e.N.closeRole('side');assert.equal(e.N.diagnostics('side').active,false);checks++;
 console.log('Post-P108 M06 PASS '+checks+' acknowledgement cases (JS facade + HTTP test double)');
})().catch(e=>{console.error(e);process.exit(1);});

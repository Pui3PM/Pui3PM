'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');const root=path.resolve(process.argv[2]||'audit_input/3PM_Analyzer_R8_FIELD_TEST/app/static');
let resolveOld,oldWaiting=false,hardwareGeneration=null;const log=[];const json=data=>({ok:true,status:200,json:async()=>data});
const ctx={console,Promise,Map,Set,Date,Math,Number,Array,Object,JSON,String,Error,queueMicrotask,AbortController,setTimeout,clearTimeout,setInterval:()=>0,navigator:{userAgent:'audit'},window:{TemporalEvidenceCore:require(path.join(root,'temporal_evidence_core.js')),TemporalEvidenceLayer:{closeRole(){},openRole(){return true;}},dispatchEvent(){}},fetch:async(url,opt={})=>{
 const u=String(url);
 if(u.includes('/static/'))return json({});
 if(u.endsWith('/health'))return json({ok:true,backend_id:'native-avfoundation'});
 if(u.endsWith('/close')){log.push({event:'close',hardwareGeneration});hardwareGeneration=null;return json({ok:true});}
 if(u.endsWith('/open')){const body=JSON.parse(opt.body);log.push({event:'open',generation:body.generation});hardwareGeneration=body.generation;if(body.generation===1){oldWaiting=true;return await new Promise(r=>{resolveOld=()=>r(json({ok:true,diagnostics:{backend:'native-avfoundation'}}));});}return json({ok:true,diagnostics:{backend:'native-avfoundation'}});}
 if(u.endsWith('/diag'))return json({roles:{side:{active:hardwareGeneration!==null,generation:hardwareGeneration,raw_fps:30}}});
 throw new Error(u);
}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'native_capture_layer.js'),'utf8'),ctx);
const tick=()=>new Promise(setImmediate);
(async()=>{const N=ctx.window.NativeCaptureLayer,track={label:'camera',getSettings:()=>({frameRate:30})};N.openRole('side',track,1);for(let i=0;i<20&&!oldWaiting;i++)await tick();if(!oldWaiting)throw Error('old open never waited');N.openRole('side',track,2);for(let i=0;i<20&&!N.states.side.active;i++)await tick();if(N.states.side.generation!==2||!N.states.side.active)throw Error('new open failed');resolveOld();for(let i=0;i<5;i++)await tick();console.log(JSON.stringify({expectedHardwareGeneration:2,actualHardwareGeneration:hardwareGeneration,facadeGeneration:N.states.side.generation,facadeActive:N.states.side.active,log},null,2));})().catch(e=>{console.error(e);process.exitCode=1;});

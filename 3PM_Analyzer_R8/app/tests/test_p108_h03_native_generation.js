'use strict';
// R8 P1-08 H-03: stale native camera requests have no authority over the successor generation, and the facade
// reports only what the bridge acknowledges. Bridge double mirrors the shipped Swift semantics:
// /open takes effect on arrival (RoleCapture.start stops the previous session first); /close {role} stops
// whatever runs for that role (it is NOT generation-scoped); /diag reports the running generation.
// Usage: node app/tests/test_p108_h03_native_generation.js [path-to-app/static]
const assert=require('assert'),path=require('path');
const H=require('./p108_harness');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../static'));
const failures=[];const check=async(name,fn)=>{try{await fn();}catch(e){failures.push(`${name}: ${e.message}`);}};
const track=(label='FaceTime HD Camera')=>({label,getSettings:()=>({width:1280,height:720,frameRate:30})});

function makeBridge(){
  const hw={side:{active:false,generation:null,label:null}},gates=[];const requests=[];
  const gate=(match)=>{let release;const p=new Promise(r=>{release=r;});gates.push({match,p,release,used:false});return {release:(v)=>release(v)};};
  const bridge=async(p,body)=>{
    requests.push({p,body:body&&{...body}});
    const g=gates.find(x=>!x.used&&x.match(p,body));
    if(p==='/health')return {data:{ok:true,version:'t',backend_id:'native-avfoundation',platform:'macOS'}};
    if(p==='/open'){
      if(g&&g.delayArrival){}
      Object.assign(hw[body.role],{active:true,generation:body.generation,label:body.label});      // effect on arrival
      if(g){g.used=true;const v=await g.p;if(v&&v.fail)return {data:{ok:false,error:'Camera busy (stale open)'},status:500};}
      return {data:{ok:true,diagnostics:{backend:'native-avfoundation'}}};
    }
    if(p==='/close'){
      if(g){g.used=true;await g.p;}                                     // delayed ARRIVAL of the close at the bridge
      Object.assign(hw[body.role],{active:false,generation:null});return {data:{ok:true}};
    }
    if(p==='/diag'){
      const snap={roles:{side:{active:hw.side.active,generation:hw.side.generation,raw_fps:30,capture_fps:30}}};
      if(g){g.used=true;await g.p;}
      return {data:snap};
    }
    if(p==='/release')return {data:{ok:true,tokens:{}}};
    throw new Error('bridge '+p);
  };
  return {hw,gate,bridge,requests};
}
function consistent(e,b,label){
  const s=e.N.states.side,h=b.hw.side;
  const facadeActive=!!s.active&&String(s.backend).startsWith('native-');
  assert.strictEqual(facadeActive,h.active&&h.generation===s.generation,`${label}: facade active=${s.active}/${s.backend} gen=${s.generation} vs bridge active=${h.active} gen=${h.generation}`);
}
async function settle(e){for(let i=0;i<40;i++)await H.tick(2);if(typeof e.N._reconcile==='function'){await e.N._reconcile();for(let i=0;i<40;i++)await H.tick(2);}}

(async()=>{
  await check('1 old-open SUCCESS after new-open success',async()=>{
    const b=makeBridge(),e=H.env(root,{bridge:b.bridge});const old=b.gate((p,x)=>p==='/open'&&x.generation===1);
    e.N.openRole('side',track(),1);await H.tick(20);e.N.openRole('side',track(),2);
    await e.until(()=>e.N.states.side.active&&e.N.states.side.generation===2,1500);
    old.release({ok:true});await settle(e);
    assert.strictEqual(b.hw.side.generation,2,'bridge still runs generation 2');assert.strictEqual(b.hw.side.active,true);consistent(e,b,'1');
  });
  await check('2 old-open ERROR after new-open success',async()=>{
    const b=makeBridge(),e=H.env(root,{bridge:b.bridge});const old=b.gate((p,x)=>p==='/open'&&x.generation===1);
    e.N.openRole('side',track(),1);await H.tick(20);e.N.openRole('side',track(),2);
    await e.until(()=>e.N.states.side.active&&e.N.states.side.generation===2,1500);
    old.release({fail:true});await settle(e);
    assert.strictEqual(e.N.states.side.backend.startsWith('native-'),true,'stale error must not switch current role to browser fallback');
    assert.strictEqual(b.hw.side.generation,2);consistent(e,b,'2');
  });
  await check('3 close(gen1) arriving late does not kill gen2',async()=>{
    const b=makeBridge(),e=H.env(root,{bridge:b.bridge});
    e.N.openRole('side',track(),1);await e.until(()=>e.N.states.side.active,1500);
    const late=b.gate(p=>p==='/close');e.N.closeRole('side');e.N.openRole('side',track(),2);
    await H.tick(30);late.release();await settle(e);
    await e.until(()=>e.N.states.side.active&&e.N.states.side.generation===2,1500);await settle(e);
    assert.strictEqual(b.hw.side.active,true,'gen2 running after late close');assert.strictEqual(b.hw.side.generation,2);consistent(e,b,'3');
  });
  await check('4 rapid open -> close -> open',async()=>{
    const b=makeBridge(),e=H.env(root,{bridge:b.bridge});
    e.N.openRole('side',track(),1);e.N.closeRole('side');e.N.openRole('side',track(),2);
    await e.until(()=>e.N.states.side.active&&e.N.states.side.generation===2,1500);await settle(e);
    assert.strictEqual(b.hw.side.generation,2);assert.strictEqual(b.hw.side.active,true);consistent(e,b,'4');
  });
  await check('5 open A -> device switch -> open B',async()=>{
    const b=makeBridge(),e=H.env(root,{bridge:b.bridge});const old=b.gate((p,x)=>p==='/open'&&x.generation===1);
    e.N.openRole('side',track('Camera A'),1);await H.tick(20);e.N.openRole('side',track('Camera B'),2);
    await e.until(()=>e.N.states.side.active&&e.N.states.side.generation===2,1500);old.release({ok:true});await settle(e);
    assert.strictEqual(b.hw.side.label,'Camera B','device B is the running device');consistent(e,b,'5');
  });
  await check('6 stale diagnostics response after new generation',async()=>{
    const b=makeBridge(),e=H.env(root,{bridge:b.bridge});
    e.N.openRole('side',track(),1);await e.until(()=>e.N.states.side.active,1500);await settle(e);
    b.hw.side.active=false;                                                      // bridge stopped gen1 ...
    const slow=b.gate(p=>p==='/diag');const pending=typeof e.N._reconcile==='function'?e.N._reconcile():Promise.resolve();
    await H.tick(5);e.N.openRole('side',track(),2);await e.until(()=>e.N.states.side.active&&e.N.states.side.generation===2,1500);
    slow.release();await pending;await settle(e);                                 // ... but its stale report arrives after gen2
    assert.strictEqual(e.N.states.side.generation,2);assert.strictEqual(b.hw.side.generation,2);consistent(e,b,'6');
  });
  await check('7 backend acknowledgement: bridge silently on another generation -> facade not active for it',async()=>{
    const b=makeBridge(),e=H.env(root,{bridge:b.bridge});
    e.N.openRole('side',track(),2);await e.until(()=>e.N.states.side.active,1500);
    Object.assign(b.hw.side,{active:true,generation:1});                         // e.g. an old start finished last inside the bridge
    await settle(e);
    consistent(e,b,'7');
    assert(!(e.N.states.side.active&&b.hw.side.generation!==e.N.states.side.generation),'facade never claims a generation the bridge does not run');
  });
  await check('8 session switch during delayed native bundle: bundle bound to its origin session',async()=>{
    const rel=100000,rows=[0,1].map(i=>({index:i,frame_seq:i+1,epoch_ms:rel-30+i*33,capture_epoch_ms:rel-30+i*33,master_time_ms:null,media_time_ms:9000+i*33,url:`${H.BASE}/frame/${i}`}));
    let e;e=H.env(root,{bridge:H.nativeBridge({rel,frames:rows,onFrame:async()=>{e.setSession(2);}})});
    e.seed({key:'1:4:side',sessionId:1,shotId:4,role:'side',releaseEpochMs:rel,frames:[]});
    e.seed({key:'2:4:side',sessionId:2,shotId:4,role:'side',releaseEpochMs:rel+30,frames:[]});
    await H.openNative(e,1);await H.releaseAndWait(e,rel);
    assert.strictEqual((e.get(1,4).frames||[]).length,2,'origin session record received the bundle');
    assert.strictEqual((e.get(2,4).frames||[]).length,0,'new session record untouched');
  });
  if(failures.length){console.error('P1-08 H-03 native generation FAIL\n - '+failures.join('\n - '));process.exit(1);}
  console.log('P1-08 H-03 native generation PASS: stale open success/error, late close, rapid reopen, device switch, stale diag, backend ack, session switch');
})().catch(e=>{console.error(e);process.exit(1);});

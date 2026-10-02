'use strict';
// SHA-256 pure correctness vs Node crypto + runtime budget measurements (Node, this machine; NOT browser/Mac numbers).
const path=require('path'),crypto=require('crypto');const APP=path.resolve(process.argv[2]||'.');
const Sha=require(path.join(APP,'shadow/contracts/sha256_pure'));const Bin=require(path.join(APP,'shadow/contracts/binary_pure'));
const F=require(path.join(APP,'tests/phase01/_shadow_fixture.js'));const {RoleRing}=require(path.join(APP,'shadow/ring/role_ring'));
const {project25}=require(path.join(APP,'shadow/projector/logical25'));
const out={};
// correctness: all lengths 0..300 + boundary + random binary + unicode
let mism=0,checked=0;for(let L=0;L<=300;L++){const b=crypto.randomBytes(L);checked++;if(Sha.hex(new Uint8Array(b))!==crypto.createHash('sha256').update(b).digest('hex'))mism++;}
for(const s of ['','abc','รอบ-1 กล้อง','\u{1F3F9}archery',"x".repeat(1000)]){checked++;if(Sha.hex(s)!==crypto.createHash('sha256').update(Buffer.from(s,'utf8')).digest('hex'))mism++;}
for(let i=0;i<200;i++){const b=crypto.randomBytes(Math.floor(Math.random()*5000));checked++;const enc=Bin.base64Encode(new Uint8Array(b));if(enc!==b.toString('base64')||Buffer.compare(Buffer.from(Bin.base64Decode(enc)),b)!==0)mism++;}
out.sha_base64_correctness={checked,mismatches:mism};
// throughput: 8 MB
const MB=2;const big=new Uint8Array(crypto.randomBytes(MB*1024*1024));let t=process.hrtime.bigint();Sha.hex(big);const shaMs=Number(process.hrtime.bigint()-t)/1e6;
t=process.hrtime.bigint();const enc=Bin.base64Encode(big);const encMs=Number(process.hrtime.bigint()-t)/1e6;t=process.hrtime.bigint();Bin.base64Decode(enc);const decMs=Number(process.hrtime.bigint()-t)/1e6;
out.archive_hash_base64_throughput_MBps={sha256:+(MB/(shaMs/1000)).toFixed(1),base64Encode:+(MB/(encMs/1000)).toFixed(1),base64Decode:+(MB/(decMs/1000)).toFixed(1),estimated_seconds_for_512MB_archive_validate:+((512/(MB/(shaMs/1000)))+(512/(MB/(decMs/1000)))).toFixed(1)};
// ring.add per-frame cost at steady state: 240 fps for 6.5 s retention => ~1560 rows
const ring=new RoleRing({role:'side',retentionUs:6500000,byteBudget:1024*1024*1024,maxLeasedBytes:512*1024*1024});
const frames=[];for(let i=1;i<=3000;i++)frames.push(F.frame(i,{mappedMasterTime:i*4167,contentDigest:null}));
for(let i=0;i<1600;i++)ring.add(frames[i],{byteLength:100000});
const samples=[];for(let i=1600;i<3000;i++){const s=process.hrtime.bigint();ring.add(frames[i],{byteLength:100000});samples.push(Number(process.hrtime.bigint()-s)/1000);}
samples.sort((a,b)=>a-b);const pct=p=>+samples[Math.floor((samples.length-1)*p)].toFixed(1);
out.ring_add_us_steady_state_1560rows={p50:pct(.5),p95:pct(.95),p99:pct(.99),max:+samples.at(-1).toFixed(1),rows:ring.snapshot().count,budget_note:'240 fps => 4167 us per frame per role'};
// projector with dense candidates (240 fps, 2.2 s window => ~530 candidates)
const TL={masterClockId:'m',draw:{status:'verified',start:0,end:400000,refs:['d']},anchor:{status:'verified',start:400000,end:1200000,refs:['a']},hold:{status:'verified',start:1200000,end:1800000,refs:['h']},expansion:{status:'verified',start:1800000,end:2000000,refs:['e']},follow_through:{status:'verified',start:2100000,end:2600000,refs:['f']},recovery:{status:'verified',start:2600000,end:2700000,refs:['r']}};
for(const n of [100,530]){const cands=[];for(let i=0;i<n;i++)cands.push(F.candidate(10000+i,Math.round(i*(2700000/n)),{}));
 t=process.hrtime.bigint();project25({runId:'r',cycleId:'c',masterClockId:'m',role:'side',timeline:TL,releaseTime:2050000,candidates:cands,roleBindings:[F.binding({startMasterTime:0,endMasterTime:3000000,capturePeriodUs:4167,jitterUs:500})],projectionId:'perf',configDigest:'cfg'});
 out['project25_ms_'+n+'_candidates']=+(Number(process.hrtime.bigint()-t)/1e6).toFixed(1);}
console.log(JSON.stringify({environment:{node:process.version,platform:process.platform+'-'+process.arch,note:'Linux container; not a Mac/browser measurement'},...out},null,1));

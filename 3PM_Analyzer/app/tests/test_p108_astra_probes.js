'use strict';
// R8 P1-08: the independent auditor's (Astra) probes, kept VERBATIM in app/tests/p108_astra/, are executed against
// this package and every invariant they report is asserted. The probes are diagnostic (exit 0 = ran); this file
// turns them into a permanent gate. Usage: node app/tests/test_p108_astra_probes.js [package-root]
const assert=require('assert'),path=require('path'),{spawnSync}=require('child_process');
const pkg=path.resolve(process.argv[2]||path.join(__dirname,'../..')),stat=path.join(pkg,'app/static'),dir=path.join(__dirname,'p108_astra');
const run=(probe,arg)=>{const r=spawnSync(process.execPath,[path.join(dir,probe),arg],{encoding:'utf8',timeout:120000});assert.strictEqual(r.status,0,`${probe} did not run: ${r.stderr}`);return JSON.parse(r.stdout);};
const failures=[];const check=(n,f)=>{try{f();}catch(e){failures.push(`${n}: ${e.message}`);}};
const core=run('independent_core_probes.cjs',stat);
// History: D-108-06 pinned core WORKER-NULL-MAPPING as a documented conflict (value 1, the auditor expected 25) because the R7
// contract counted equal mediaTime in a source-only domain once. D-R2-01 (owner decision 2026-10-05, option 1: the Post-P108 H02 identity rule is authoritative; docs/post_p108_r2/OWNER_DECISION_REQUIRED.md): a domain needs source AND generation, so the
// auditor's invariant now HOLDS (25) and is asserted like every other probe.
// The auditor's core ID-CLONE probe (verbatim, not edited) feeds a row WITHOUT FrameUID plus its clone and expects 1; under H02
// equal epoch+size is not identity, so it returns 2. Its intent ("a stored frame plus its readback clone is one frame") is proven on
// the production path: test_p108_h02_identity.js (stored clone), test_post_p108_r2_identity.js R2-03/R2-04 and the Chromium R2 gate.
const SUPERSEDED={'ID-CLONE':{actual:2,decision:'D-R2-01',intentProof:'test_p108_h02_identity.js stored-clone + test_post_p108_r2_identity.js + run_post_p108_r2_identity_chromium.cjs'}};
for(const r of core)check(`core ${r.id}`,()=>{
  if(SUPERSEDED[r.id]){assert.strictEqual(r.invariantPass,false);assert.strictEqual(r.actual,SUPERSEDED[r.id].actual,'superseded probe must stay exactly as analysed');return;}
  assert.strictEqual(r.invariantPass,true,`expected ${JSON.stringify(r.expected)} got ${JSON.stringify(r.actual)}`);});
check('D-R2-01 is recorded where the R7 contract lived',()=>{const t=require('fs').readFileSync(require('path').join(__dirname,'test_transaction_r7.js'),'utf8');assert(t.includes('D-R2-01')&&t.includes("'same real media frame must not count twice'"));});
const prod=run('production_path_probes.cjs',pkg);
for(const r of prod.filter(x=>x.kind!=='actual-worker-augmentBundle'))check(`production ${r.kind}`,()=>{
  assert.strictEqual(r.epochOrderValid,true,'persisted epoch order');assert.strictEqual(r.recoveryPreserved,true,'Recovery preserved');
  assert.strictEqual(new Set(r.epochs.map((e,i)=>e+'|'+r.sources[i])).size,r.epochs.length,'no duplicated persisted frame');
  assert.strictEqual(r.nativeFrameCount,4,'all native frames kept');
  r.sources.forEach((s,i)=>{if(/^native-/.test(s))assert.strictEqual(r.generations[i],1,'native frames carry their origin generation');});
});
const w=prod.find(x=>x.kind==='actual-worker-augmentBundle');
check('production worker augmentBundle',()=>{assert.strictEqual(w.mergedFrames,25);assert(w.identities.every(x=>x.mediaTime===null&&x.frameSeq===null),'no manufactured 0/0');});
const race=run('native_open_race_probe.cjs',stat);
check('native open race',()=>{assert.strictEqual(race.actualHardwareGeneration,race.expectedHardwareGeneration);assert.strictEqual(race.facadeGeneration,2);assert.strictEqual(race.facadeActive,race.actualHardwareGeneration===race.facadeGeneration);
  assert(!race.log.some((x,i)=>x.event==='close'&&race.log.slice(0,i).some(y=>y.event==='open'&&y.generation===2)),'no close after the successor open');});
const add=run('additional_probes.cjs',stat);
check('Anchor unknown target',()=>assert.strictEqual(add.unknownAnchorTarget.actualJump,false));
// Frozen app.js sampler: OPEN M-01 (field scope 30 FPS). Asserted as characterization, not as a pass.
check('frozen sampler characterization (OPEN M-01)',()=>assert.strictEqual(add.frozenProductionSampler.actual,13));
if(failures.length){console.error('P1-08 Astra probes FAIL\n - '+failures.join('\n - '));process.exit(1);}
console.log(`P1-08 Astra probes PASS: core ${core.length-1}/${core.length} invariants GREEN (WORKER-NULL-MAPPING now GREEN) + 1 probe superseded by D-R2-01 (ID-CLONE; intent proven on the production path), production path ${prod.length} runs, native race, Anchor; frozen sampler 240 FPS = 13 (OPEN M-01, characterized)`);

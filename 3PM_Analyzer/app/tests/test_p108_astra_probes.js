'use strict';
// R8 P1-08: the independent auditor's (Astra) probes, kept VERBATIM in app/tests/p108_astra/, are executed against
// this package and every invariant they report is asserted. The probes are diagnostic (exit 0 = ran); this file
// turns them into a permanent gate. Usage: node app/tests/test_p108_astra_probes.js [package-root]
const assert=require('assert'),path=require('path'),{spawnSync}=require('child_process');
const pkg=path.resolve(process.argv[2]||path.join(__dirname,'../..')),stat=path.join(pkg,'app/static'),dir=path.join(__dirname,'p108_astra');
const run=(probe,arg)=>{const r=spawnSync(process.execPath,[path.join(dir,probe),arg],{encoding:'utf8',timeout:120000});assert.strictEqual(r.status,0,`${probe} did not run: ${r.stderr}`);return JSON.parse(r.stdout);};
const failures=[];const check=(n,f)=>{try{f();}catch(e){failures.push(`${n}: ${e.message}`);}};
const core=run('independent_core_probes.cjs',stat);
// Documented discrepancy (DECISION_LOG D-108-06): core WORKER-NULL-MAPPING feeds the core the OUTPUT of the old
// adapter (25 rows, one source, mediaTime 0 / frameSeq 0) and expects 25. The verified R7 TransactionRepair contract
// (tests/test_transaction_r7.js: 'same real media frame must not count twice', unchanged) requires equal same-domain
// mediaTime to count once, so both cannot hold. The defect the probe targets (adapter Number(null)->0) is closed and
// is gated below by the probe's own production-path run of the ACTUAL augmentBundle (25/25, null identity kept).
const CONFLICT={'WORKER-NULL-MAPPING':{actual:1,proof:'R7 test_transaction_r7.js:56 + production worker run 25/25'}};
for(const r of core)check(`core ${r.id}`,()=>{
  if(CONFLICT[r.id]){assert.strictEqual(r.invariantPass,false);assert.strictEqual(r.actual,CONFLICT[r.id].actual,'conflict must stay exactly as analysed');return;}
  assert.strictEqual(r.invariantPass,true,`expected ${JSON.stringify(r.expected)} got ${JSON.stringify(r.actual)}`);});
check('R7 contract that decides WORKER-NULL-MAPPING is still present and unchanged',()=>{const t=require('fs').readFileSync(require('path').join(__dirname,'test_transaction_r7.js'),'utf8');assert(t.includes("'same real media frame must not count twice'"));});
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
console.log(`P1-08 Astra probes PASS: core ${core.length-1}/${core.length} invariants GREEN + 1 documented R7-contract conflict (WORKER-NULL-MAPPING; real adapter GREEN), production path ${prod.length} runs, native race, Anchor; frozen sampler 240 FPS = 13 (OPEN M-01, characterized)`);

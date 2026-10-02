'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),cp=require('child_process');
const root=process.env.PACKAGE_ROOT||path.resolve(__dirname,'../..');
const launcher=path.join(root,process.env.PACKAGE_ROOT&&fs.existsSync(path.join(root,'start_mac.command'))?'start_mac.command':'internal/start_analyzer.sh');
const source=fs.readFileSync(launcher,'utf8');
// Execute the shipped guard itself; stop BEFORE architecture/runtime/OS interactions.
// This catches a mismatch between EXPECTED_* and actual source that syntax-only QA misses.
const prefix=source.split('ARCH="$(uname -m)"')[0];
assert(prefix.length<source.length,'preflight boundary must exist');
const r=cp.spawnSync('bash',['-c',prefix,launcher],{env:{...process.env,THREEPM_BLE_WRAPPED:'1'},input:'\n',encoding:'utf8',timeout:5000});
assert.equal(r.status,0,`shipped preflight failed: ${r.stdout}\n${r.stderr}`);
assert(r.stdout.includes('Preflight: R7 transaction signatures + HV3 three-camera/timeline signatures verified.'));
console.log('Mac launcher preflight executed: PASS (native runtime not executed)');

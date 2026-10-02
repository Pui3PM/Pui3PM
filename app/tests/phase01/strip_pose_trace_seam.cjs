'use strict';
// Produce the frozen HV3 pose.js from the approved trace-seam pose.js using EXACTLY the reconstruction rules of
// app/tests/phase01/test_pose_narrow_thaw.js, and refuse to write unless the result hashes to the frozen baseline.
// Usage: node strip_pose_trace_seam.cjs <in pose.js> <out pose.js>
const fs=require('fs'),crypto=require('crypto'),path=require('path');
const [,,inp,outp]=process.argv;if(!inp||!outp){console.error('usage: strip_pose_trace_seam.cjs <in> <out>');process.exit(2);}
const guard=fs.readFileSync(path.join(path.dirname(inp),'../tests/phase01/test_pose_narrow_thaw.js'),'utf8');
const BASE=guard.match(/BASELINE_SHA256='([0-9a-f]{64})'/)[1];
const block=guard.slice(guard.indexOf('const marker='),guard.indexOf("assert.equal(sha(reconstructed),BASELINE_SHA256"));
const assert=require('assert');const source=fs.readFileSync(inp,'utf8');let reconstructed;
eval(block.replace('let reconstructed=','reconstructed='));
const got=crypto.createHash('sha256').update(reconstructed).digest('hex');
if(got!==BASE){console.error(JSON.stringify({ok:false,got,expected:BASE}));process.exit(1);}
fs.writeFileSync(outp,reconstructed);console.log(JSON.stringify({ok:true,frozenBaselineSha256:got,written:outp}));

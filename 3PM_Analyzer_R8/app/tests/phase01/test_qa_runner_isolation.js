'use strict';
// Q-01 regression: QA runners must never mutate SHA256SUMS-attested package files.
// Copies the package to a temp dir, attests it exactly as packaging does, runs all three
// runners, then runs the distribution contract on the copy. The contract must still PASS.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const pkg = path.resolve(__dirname, '..', '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '3pm-q01-'));
const copy = path.join(tmp, 'pkg with spaces');
const out = path.join(tmp, 'qa_out');
try {
  fs.cpSync(pkg, copy, { recursive: true, preserveTimestamps: true });
  // Attest the copy (same format as SHA256SUMS.txt: "<sha256>  <relpath>", self excluded).
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p); else if (e.isFile()) files.push(path.relative(copy, p).split(path.sep).join('/'));
    }
  })(copy);
  const lines = files.filter((f) => f !== 'SHA256SUMS.txt').sort()
    .map((f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(copy, f))).digest('hex') + '  ' + f);
  fs.writeFileSync(path.join(copy, 'SHA256SUMS.txt'), lines.join('\n') + '\n');

  const contract = () => spawnSync('python3', [path.join(copy, 'app/tests/test_distribution_contract_r6.py')], { cwd: copy, encoding: 'utf8' });
  const pre = contract();
  assert.strictEqual(pre.status, 0, 'precondition: freshly attested copy passes the contract\n' + pre.stdout + pre.stderr);

  const env = Object.assign({}, process.env, { THREEPM_QA_OUT: out });
  const runners = ['app/tests/phase01/run_phase0_repros.py', 'app/tests/run_regressions.py', 'app/tests/phase01/run_p006_regressions.py'];
  for (const r of runners) {
    const res = spawnSync('python3', ['-B', path.join(copy, r)], { cwd: copy, env, encoding: 'utf8', timeout: 600000 });
    assert.ok(res.status === 0 || res.status === 1, `${r} ran to completion (status ${res.status})\n${res.stderr}`);
  }
  for (const f of ['phase0_repro_results.json', 'r7_results.json', 'p006_js_regressions.json']) {
    assert.ok(fs.existsSync(path.join(out, f)), `runner output ${f} written to the QA output directory`);
  }
  const post = contract();
  assert.strictEqual(post.status, 0, 'distribution contract still PASS after all runners\n' + post.stdout + post.stderr);

  // Negative: an output path inside the attested package is refused and writes nothing.
  const inside = path.join(copy, 'docs', 'qa_out_forbidden');
  const neg = spawnSync('python3', ['-B', path.join(copy, 'app/tests/phase01/run_phase0_repros.py')], { cwd: copy, env: Object.assign({}, process.env, { THREEPM_QA_OUT: inside }), encoding: 'utf8' });
  assert.notStrictEqual(neg.status, 0, 'runner refuses an in-package QA output directory');
  assert.ok(/outside the attested package/.test(neg.stdout + neg.stderr), 'refusal is explicit');
  assert.ok(!fs.existsSync(inside), 'no in-package output directory created');
  const post2 = contract();
  assert.strictEqual(post2.status, 0, 'contract still PASS after the refused run');
  console.log('Q-01 QA runner isolation: PASS (3 runners, contract green after run, in-package output refused)');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

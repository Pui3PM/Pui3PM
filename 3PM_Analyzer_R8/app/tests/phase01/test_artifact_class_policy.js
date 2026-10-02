'use strict';
// P-06 regression: artifact-class-aware pose policy (OWNER DECISION D-B option 1).
// development_not_release -> trace-seam pose.js + reconstruction guard; field_test_not_production -> frozen HV3 pose.js.
// The pins live in the gates; editing PACKAGE_CONTRACT.json can select a class but never relax a pin.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const pkg = path.resolve(__dirname, '..', '..', '..');
const FROZEN = '22ee024b6365d8aca20cbe2ada6ac713b4ffd1d4cf84e29d79c4643ed2bd014d';
const SEAM = 'fe8cafaea88833c6a5068ebbefad7962b0a32ec826f61cd406d180ec72518f02';
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '3pm-p06-'));

function variant(name, { cls, frozenPose, marker, contractEdit }) {
  const dir = path.join(tmp, name);
  fs.cpSync(pkg, dir, { recursive: true });
  if (frozenPose) {
    const r = spawnSync('node', [path.join(dir, 'app/tests/phase01/strip_pose_trace_seam.cjs'), path.join(dir, 'app/static/pose.js'), path.join(tmp, name + '.pose.js')], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    fs.copyFileSync(path.join(tmp, name + '.pose.js'), path.join(dir, 'app/static/pose.js'));
  }
  const cp = path.join(dir, 'PACKAGE_CONTRACT.json'); const c = JSON.parse(fs.readFileSync(cp, 'utf8'));
  c.artifact_class = cls; if (contractEdit) contractEdit(c); fs.writeFileSync(cp, JSON.stringify(c, null, 2) + '\n');
  // Normalize class markers regardless of which package this test runs in.
  for (const m of ['DEV_NOT_RELEASE.txt', 'FIELD_TEST_NOT_PRODUCTION.txt']) fs.rmSync(path.join(dir, m), { force: true });
  fs.writeFileSync(path.join(dir, marker), marker === 'FIELD_TEST_NOT_PRODUCTION.txt' ? 'FIELD TEST BUILD — NOT PRODUCTION\n' : 'NOT A RELEASE.\n');
  // Attest the variant exactly like packaging so the distribution contract evaluates policy, not manifest drift.
  const files = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(path.relative(dir, p).split(path.sep).join('/')); } })(dir);
  fs.writeFileSync(path.join(dir, 'SHA256SUMS.txt'), files.filter((f) => f !== 'SHA256SUMS.txt').sort().map((f) => sha(path.join(dir, f)) + '  ' + f).join('\n') + '\n');
  return dir;
}
function gates(dir) {
  const py = (f) => spawnSync('python3', ['-B', path.join(dir, f)], { cwd: dir, encoding: 'utf8' });
  const st = py('app/tests/static_integrity_x282.py'), dc = py('app/tests/test_distribution_contract_r6.py');
  const pg = spawnSync('node', [path.join(dir, 'app/tests/phase01/test_pose_narrow_thaw.js')], { cwd: dir, encoding: 'utf8' });
  return { static: st.status === 0, contract: dc.status === 0, pose: pg.status === 0, detail: (st.stderr + dc.stderr + pg.stderr).split('\n').filter((l) => /Error|assert/i.test(l)).slice(-3).join(' | ') };
}

try {
  const poseHere = sha(path.join(pkg, 'app/static/pose.js'));
  const pkgClass = JSON.parse(fs.readFileSync(path.join(pkg, 'PACKAGE_CONTRACT.json'), 'utf8')).artifact_class;
  assert.ok((pkgClass === 'development_not_release' && poseHere === SEAM) || (pkgClass === 'field_test_not_production' && poseHere === FROZEN), `precondition: package pose matches its own class (${pkgClass})`);
  const hasSeam = poseHere === SEAM;
  const ok = (g, label) => assert.deepStrictEqual([g.static, g.contract, g.pose], [true, true, true], `${label} must pass all gates: ${g.detail}`);
  const bad = (g, label) => assert.ok(!(g.static && g.contract && g.pose), `${label} must be rejected by at least one gate`);
  // In a field package pose.js is already frozen, so "frozenPose" is a no-op and seam-based variants cannot be built.
  const frozen = hasSeam;
  let ran = 0, skipped = [];
  const caseIf = (needsSeam, name, fn) => { if (needsSeam && !hasSeam) { skipped.push(name); return; } fn(); ran++; };

  caseIf(true, 'development class accepted', () => ok(gates(variant('dev', { cls: 'development_not_release', marker: 'DEV_NOT_RELEASE.txt' })), 'development class'));
  caseIf(false, 'field class with frozen pose accepted', () => {
    const field = variant('field', { cls: 'field_test_not_production', frozenPose: frozen, marker: 'FIELD_TEST_NOT_PRODUCTION.txt' });
    assert.strictEqual(sha(path.join(field, 'app/static/pose.js')), FROZEN);
    ok(gates(field), 'field class with frozen pose');
  });
  caseIf(true, 'field class with seam pose rejected', () => {
    const g1 = gates(variant('field-with-seam', { cls: 'field_test_not_production', marker: 'FIELD_TEST_NOT_PRODUCTION.txt' }));
    assert.deepStrictEqual([g1.static, g1.contract, g1.pose], [false, false, false], 'field class with the dev seam pose fails every pose gate');
  });
  caseIf(false, 'dev class with frozen pose rejected', () => {
    const g2 = gates(variant('dev-with-frozen', { cls: 'development_not_release', frozenPose: frozen, marker: 'DEV_NOT_RELEASE.txt' }));
    assert.deepStrictEqual([g2.static, g2.contract, g2.pose], [false, false, false], 'dev class with frozen pose fails (seam reconstruction guard + pins)');
  });
  caseIf(false, 'field class with DEV marker rejected', () => bad(gates(variant('field-dev-marker', { cls: 'field_test_not_production', frozenPose: frozen, marker: 'DEV_NOT_RELEASE.txt' })), 'field class with DEV marker'));
  caseIf(true, 'dev class with FIELD marker rejected', () => bad(gates(variant('dev-field-marker', { cls: 'development_not_release', marker: 'FIELD_TEST_NOT_PRODUCTION.txt' })), 'dev class with FIELD marker'));
  caseIf(false, 'unknown class rejected', () => bad(gates(variant('unknown-class', { cls: 'production', frozenPose: frozen, marker: 'FIELD_TEST_NOT_PRODUCTION.txt' })), 'unknown class'));
  // Editing the contract pin cannot make a pose acceptable that the gate pin rejects.
  caseIf(false, 'contract pin edit rejected', () => bad(gates(variant('contract-pin-edit', { cls: 'development_not_release', frozenPose: frozen, marker: 'DEV_NOT_RELEASE.txt', contractEdit: (c) => { c.artifact_classes.development_not_release.pose_sha256 = FROZEN; } })), 'contract pin edit'));
  console.log(`P-06 artifact class pose policy: PASS (${pkgClass}: ${ran} cases run` + (skipped.length ? `; ${skipped.length} seam-dependent cases need the development artifact: ${skipped.join('; ')}` : '') + ')');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

'use strict';
// Round-2 review repairs (FINAL_REVIEW_FOR_CLAUDE_CODE.md, Track S).
// Each block is the inverted form of the reviewer probe recorded in docs/review/claude_round2_20261002/.
const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const APP = path.resolve(__dirname, '..', '..');
const req = (p) => require(path.join(APP, p));

const blocks = [];
function block(id, fn) { blocks.push([id, fn]); }

// S-01: linear base64, canonical padding, large archives.
block('S-01', () => {
  const Bin = req('shadow/contracts/binary_pure');
  const AR = req('shadow/archive/shadow_archive');
  for (const n of [0, 1, 2, 3, 4, 5, 3355239, 8 * 1024 * 1024, 64 * 1024 * 1024]) {
    const b = n < 1024 ? crypto.randomBytes(n) : Buffer.alloc(n, 0xa5);
    if (n >= 1024) crypto.randomFillSync(b, 0, Math.min(n, 65536));
    const enc = Bin.base64Encode(b);
    assert.strictEqual(enc, b.toString('base64'), `encode parity at ${n} bytes`);
    const dec = Bin.base64Decode(enc);
    assert.strictEqual(Buffer.compare(Buffer.from(dec.buffer, dec.byteOffset, dec.byteLength), b), 0, `decode parity at ${n} bytes`);
  }
  for (const bad of ['QR==', 'QUJ=QQ==', 'QUL=', 'Q===', 'QQ=', '=QQ=', 'QQ=A', 'QUJD\n', 'QUJé', 'Q-_A', null, 5]) {
    assert.throws(() => Bin.base64Decode(bad), /INVALID_BASE64/, `rejects ${JSON.stringify(bad)}`);
  }
  assert.strictEqual(Buffer.from(Bin.base64Decode('QQ==')).toString(), 'A');
  assert.strictEqual(Buffer.from(Bin.base64Decode('QUI=')).toString(), 'AB');
  const blob = new Uint8Array(16 * 1024 * 1024); crypto.randomFillSync(blob, 0, 65536);
  const base = crypto.createHash('sha256').update('b').digest('hex');
  const a = AR.buildArchive({ archiveId: 'big', baselineDigest: base, records: { frames: [], candidates: [], events: [], projections: [] }, files: { 'clip.bin': blob } });
  assert.strictEqual(AR.validateArchive(a), true, '16 MiB archive validates');
  assert.strictEqual(a.manifest.fileTable[0].sha256, crypto.createHash('sha256').update(blob).digest('hex'));
});

let failed = 0;
for (const [id, fn] of blocks) {
  try { fn(); console.log(`${id}: PASS`); } catch (e) { failed++; console.error(`${id}: FAIL`, e && e.stack || e); }
}
if (failed) { console.error(`Claude round-2 repairs: ${failed} FAIL`); process.exit(1); }
console.log(`Claude round-2 repairs: PASS (${blocks.length} blocks)`);

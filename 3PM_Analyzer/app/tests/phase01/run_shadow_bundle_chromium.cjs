'use strict';
// Real-browser gate for app/shadow/browser/shadow_runtime_bundle.js (round-2 repairs).
// Runs the bundle in Chromium with no Node globals and compares canonical results with Node.
// Usage: node app/tests/phase01/run_shadow_bundle_chromium.cjs [chromiumPath]   (or CHROMIUM_PATH)
// Exit: 0 PASS, 1 FAIL, 2 BLOCKED (no Playwright/Chromium available — never reported as PASS).
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const APP = path.resolve(__dirname, '..', '..');
const EXE = process.argv[2] || process.env.CHROMIUM_PATH || undefined;
let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { console.log('BLOCKED: playwright not resolvable (set NODE_PATH)'); process.exit(2); }
const { canonicalize, sha256Canonical } = require(path.join(APP, 'shadow/contracts/canonical_json'));
const F = require(path.join(APP, 'tests/phase01/_shadow_fixture.js'));
const { frameUID } = require(path.join(APP, 'shadow/contracts/identity'));
const { project25 } = require(path.join(APP, 'shadow/projector/logical25'));
const AR = require(path.join(APP, 'shadow/archive/shadow_archive'));

const TL = { masterClockId: 'm', draw: { status: 'verified', start: 0, end: 200000, refs: ['d'] }, anchor: { status: 'verified', start: 250000, end: 600000, refs: ['a'] }, hold: { status: 'verified', start: 600000, end: 900000, refs: ['h'] } };
const cands = []; for (let i = 0; i < 40; i++) cands.push(F.candidate(100 + i, i * 33333, {}));
const pargs = { runId: 'r', cycleId: 'c', masterClockId: 'm', role: 'side', timeline: TL, releaseTime: 1000000, candidates: cands, roleBindings: [F.binding({ startMasterTime: 0, endMasterTime: 2000000, capturePeriodUs: 33333, jitterUs: 0 })], projectionId: 'chrome', configDigest: 'cfg' };
const vectors = [{ runId: 'run-1', sourceId: 'cam-side', streamGeneration: 'g1', frameSeq: '42' }, { runId: 'รอบ', sourceId: 'กล้อง', streamGeneration: 'g', frameSeq: '18446744073709551615' }, { runId: 'r', sourceId: 's', streamGeneration: 'g', frameSeq: '18446744073709551616' }, { runId: 'run\uD800', sourceId: 's', streamGeneration: 'g', frameSeq: '1' }];
const nodeUIDs = vectors.map((v) => { try { return frameUID(v); } catch (_) { return 'REJECT'; } });
const nodeProj = project25(pargs);
const img = 'img-bytes';
const digest = crypto.createHash('sha256').update(img).digest('hex');
const c7 = F.candidate(7, 66667, { payloadRef: 'blobs/7.jpg', contentDigest: digest });
const fr7 = F.frame(7, { mappedMasterTime: 66667, payloadRef: 'blobs/7.jpg', contentDigest: digest, decodeValid: true });
const p7 = project25({ runId: 'r', cycleId: 'c', masterClockId: 'm', role: 'side', timeline: TL, candidates: [c7], roleBindings: pargs.roleBindings, projectionId: 'p7', configDigest: 'cfg' });
if (p7.uniqueRealCount !== 1) { console.error('fixture precondition: p7 must have exactly one real slot'); process.exit(1); }
const archIn = { archiveId: 'chrome-arc', baselineDigest: 'a'.repeat(64), records: { frames: [fr7], candidates: [c7], events: [], projections: [p7], timelines: [{ projectionId: 'p7', timeline: TL, releaseTime: null }] } };
const nodeArc = AR.buildArchive(Object.assign({}, archIn, { files: { 'blobs/7.jpg': new TextEncoder().encode(img) } })).manifest.manifestDigest;

(async () => {
  let b;
  try { b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] }); } catch (e) { console.log('BLOCKED: Chromium did not launch: ' + e.message.split('\n')[0]); process.exit(2); }
  const blank = path.join(os.tmpdir(), '3pm_shadow_bundle_blank.html'); fs.writeFileSync(blank, '<!doctype html><meta charset=utf-8><p>x</p>');
  const page = await b.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message)));
  await page.goto('file://' + blank);
  const ua = await page.evaluate(() => navigator.userAgent);
  await page.addScriptTag({ content: fs.readFileSync(path.join(APP, 'shadow/browser/shadow_runtime_bundle.js'), 'utf8') });
  const r = await page.evaluate(({ vectors, pargs, archIn, img }) => {
    const S = globalThis.ThreePMShadow; const out = {};
    out.nodeGlobals = [typeof require, typeof Buffer, typeof process];
    out.uids = vectors.map((v) => { try { return S.identity.frameUID(v); } catch (_) { return 'REJECT'; } });
    out.proj = JSON.parse(JSON.stringify(S.projector.project25(pargs)));
    const enc = new TextEncoder();
    out.arc = S.archive.buildArchive(Object.assign({}, archIn, { files: { 'blobs/7.jpg': enc.encode(img) } })).manifest.manifestDigest;
    const big = (n) => { try { const a = S.archive.buildArchive({ archiveId: 'big', baselineDigest: 'a'.repeat(64), records: { frames: [], candidates: [], events: [], projections: [] }, files: { 'b.bin': new Uint8Array(n) } }); return S.archive.validateArchive(a); } catch (e) { return 'ERR ' + (e && e.message); } };
    out.archive16MB = big(16 * 1024 * 1024);
    const rej = (f) => { try { f(); return 'ACCEPTED'; } catch (e) { return String(e && e.message || e); } };
    out.wrongBytes = rej(() => S.archive.buildArchive(Object.assign({}, archIn, { files: { 'blobs/7.jpg': enc.encode('other') } })));
    return out;
  }, { vectors, pargs, archIn, img });
  // Writer checks: payload digests computed in Node (canonical JSON parity is checked above), writer runs in the page.
  const save = async (projection, id) => page.evaluate(({ projection, id, TL, c7, d1, d2 }) => {
    const S = globalThis.ThreePMShadow; const W = new S.writer.InMemoryEvidenceWriter();
    W.execute({ commandId: 'a', namespace: 'shadow/b', runId: 'r', cycleId: 'c', role: 'side', operation: 'addCandidates', expectedRecordVersion: 0, payload: { candidates: [c7] }, payloadDigest: d1 });
    try { return W.execute({ commandId: id, namespace: 'shadow/b', runId: 'r', cycleId: 'c', role: 'side', operation: 'saveProjection', expectedRecordVersion: 1, payload: { projection, timeline: TL, releaseTime: null }, payloadDigest: d2 }).status; } catch (e) { return String(e.message); }
  }, { projection, id, TL, c7, d1: sha256Canonical({ candidates: [c7] }), d2: sha256Canonical({ projection, timeline: TL, releaseTime: null }) });
  const honestSave = await save(p7, 'honest');
  const forgedP = JSON.parse(JSON.stringify(p7)); { const src = forgedP.slots.find((s) => s.status === 'real'); const dst = forgedP.slots.find((s) => s.status === 'missing' && s.phase === 'hold' && Number.isSafeInteger(s.targetMasterTime)); Object.assign(dst, { status: 'real', actualFrameUID: src.actualFrameUID, derivationId: src.derivationId, candidateId: src.candidateId, actualMasterTime: dst.targetMasterTime, signedDelta: 0, missingReason: null, mappingUncertaintyUs: 0, toleranceUs: 50000, actualPhaseEvidenceRefs: dst.targetPhaseEvidenceRefs, selectionReason: 'forged', sourceId: src.sourceId, streamGeneration: src.streamGeneration, frameSeq: src.frameSeq, contentDigest: src.contentDigest, frameEnvelopeRef: src.frameEnvelopeRef, contributingReasons: [], phaseProof: { phase: 'hold', timelineRefs: dst.targetPhaseEvidenceRefs, intervalCheck: 'inside' } }); Object.assign(src, { status: 'missing', actualFrameUID: null, derivationId: null, candidateId: null, actualMasterTime: null, signedDelta: null, missingReason: 'no_frame_in_tolerance', mappingUncertaintyUs: null, toleranceUs: null, actualPhaseEvidenceRefs: [], selectionReason: 'missing', sourceId: null, streamGeneration: null, frameSeq: null, contentDigest: null, frameEnvelopeRef: null, phaseProof: null }); }
  const forgedSave = await save(forgedP, 'forged');
  const nsDenied = await page.evaluate(() => { try { new globalThis.ThreePMShadow.writer.InMemoryEvidenceWriter({ allowedNamespacePrefix: 'legacy-' }); return 'ACCEPTED'; } catch (e) { return String(e.message); } });
  await b.close();
  const checks = {
    noNodeGlobals: r.nodeGlobals.every((t) => t === 'undefined'),
    uidParity: JSON.stringify(r.uids) === JSON.stringify(nodeUIDs),
    projectionCanonicalParity: canonicalize(r.proj) === canonicalize(nodeProj),
    archiveV2DigestParity: r.arc === nodeArc,
    archive16MB: r.archive16MB === true,
    payloadDigestBound: /PAYLOAD_DIGEST_MISMATCH/.test(r.wrongBytes),
    honestProjectionSaved: honestSave === 'committed',
    forgedProjectionRejected: /PROJECTION_PHASE_MISMATCH/.test(forgedSave),
    namespacePolicyFixed: /namespace policy is fixed/.test(nsDenied),
    noPageErrors: errs.length === 0,
  };
  const ok = Object.values(checks).every(Boolean);
  console.log(JSON.stringify({ browser: ua, checks, detail: { forgedSave, honestSave, archive16MB: r.archive16MB, wrongBytes: r.wrongBytes, pageErrors: errs } }, null, 1));
  console.log(ok ? `Shadow bundle Chromium gate: PASS (${Object.keys(checks).length} checks)` : 'Shadow bundle Chromium gate: FAIL');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });

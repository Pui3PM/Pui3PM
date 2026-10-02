'use strict';
// Round-2 review repairs (FINAL_REVIEW_FOR_CLAUDE_CODE.md, Track S).
// Each block is the inverted form of the reviewer probe recorded in docs/review/claude_round2_20261002/.
const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const APP = path.resolve(__dirname, '..', '..');
const req = (p) => require(path.join(APP, p));

const blocks = [];
// ROUND2_ONLY=S-02,S-03 runs a subset while iterating; the default (and every gate) runs all blocks.
const only = process.env.ROUND2_ONLY ? new Set(process.env.ROUND2_ONLY.split(',')) : null;
function block(id, fn) { if (!only || only.has(id)) blocks.push([id, fn]); }

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

// Shared fixtures for Track S blocks.
const F = require('./_shadow_fixture.js');
const { sha256Canonical } = req('shadow/contracts/canonical_json');
const TL = { masterClockId: 'm', draw: { status: 'verified', start: 0, end: 90000, refs: ['tl-draw'] }, anchor: { status: 'verified', start: 100000, end: 400000, refs: ['tl-anchor'] } };
const BIND = [F.binding({ startMasterTime: 0, endMasterTime: 1000000, capturePeriodUs: 100000, jitterUs: 0 })];
const clone = (x) => JSON.parse(JSON.stringify(x));

// S-02: FrameUID canonical lower-case and bound to its identity tuple in projections (probe N03).
block('S-02', () => {
  const T = req('shadow/contracts/strict_types');
  const RV = req('shadow/contracts/record_validators');
  const VM = req('shadow/review/view_model');
  const { project25 } = req('shadow/projector/logical25');
  const c8 = F.candidate(8, 175000), c9 = F.candidate(9, 250000);
  const p = project25({ runId: 'r', cycleId: 'c', masterClockId: 'm', role: 'side', timeline: TL, candidates: [c8, c9], roleBindings: BIND, projectionId: 'q', configDigest: 'cfg' });
  const reals = p.slots.filter((s) => s.status === 'real');
  assert.strictEqual(reals.length, 2, 'precondition: honest projection has 2 real slots');
  assert.doesNotThrow(() => VM.buildReviewView(p), 'honest projection still reviewable');
  // (a) tuple mismatch: slot claims frameSeq 999 but carries the UID of seq 8/9.
  const a = clone(p); a.slots.find((s) => s.status === 'real').frameSeq = '999';
  assert.throws(() => VM.buildReviewView(a), /FrameUID tuple mismatch/);
  // (b) same image twice via an upper-case UID spelling.
  const b = clone(p); const rs = b.slots.filter((s) => s.status === 'real');
  rs[1].actualFrameUID = 'f1/' + rs[0].actualFrameUID.slice(3).toUpperCase();
  Object.assign(rs[1], { sourceId: rs[0].sourceId, streamGeneration: rs[0].streamGeneration, frameSeq: rs[0].frameSeq, contentDigest: rs[0].contentDigest, frameEnvelopeRef: rs[0].frameEnvelopeRef });
  assert.throws(() => VM.buildReviewView(b), /FrameUID/);
  // Upper-case UID is not a FrameUID anywhere.
  const up = 'f1/' + c8.frameUID.slice(3).toUpperCase();
  assert.strictEqual(T.isFrameUID(c8.frameUID), true);
  assert.strictEqual(T.isFrameUID(up), false);
  assert.throws(() => RV.validateEvidenceCandidate(Object.assign(clone(c8), { frameUID: up })), /frameUID/);
  assert.throws(() => RV.validatePhaseClaim({ claimId: 'x', runId: 'r', cycleId: 'c', role: 'side', phase: 'anchor', frameUID: up, evidenceRef: 'e' }), /frameUID/);
  const obs = { observationId: 'o', runId: 'r', masterClockId: 'm', kind: 'pose', role: 'side', frameUIDs: [c8.frameUID], sensorSampleUIDs: [], sourceInterval: { start: 0, end: 1, clockDomain: 'm' }, inferenceStart: null, inferenceEnd: null, receivedAt: 2, producer: 'p', status: 'valid', confidence: 0.5, payloadSchema: 's', payload: {}, reasonCodes: [] };
  assert.doesNotThrow(() => RV.validateObservation(obs));
  assert.throws(() => RV.validateObservation(Object.assign(clone(obs), { frameUIDs: [up] })), /frameUIDs/);
});

// S-03: uncertainty bound must cover each known component; fixture namespace is an exact segment (probe N04).
block('S-03', () => {
  const CM = req('shadow/contracts/clock_mapper');
  const trusted = F.mapping({ calibrationMethod: 'trusted-api', trustedApiId: 'api', calibrationSampleIds: [], residualBoundUs: null, transportBoundUs: 5000, uncertaintyBoundUs: 0, mappingNamespace: 'shadow/live' });
  assert.throws(() => CM.validateClockMapping(trusted), /uncertainty bound smaller than component bounds/);
  assert.doesNotThrow(() => CM.validateClockMapping(Object.assign(clone(trusted), { uncertaintyBoundUs: 5000 })));
  assert.throws(() => CM.validateClockMapping(F.mapping({ residualBoundUs: 300, transportBoundUs: null, uncertaintyBoundUs: 299 })), /uncertainty bound/);
  assert.doesNotThrow(() => CM.validateClockMapping(F.mapping({ residualBoundUs: 300, transportBoundUs: null, uncertaintyBoundUs: 300 })));
  assert.throws(() => CM.validateClockMapping(F.mapping({ mappingNamespace: 'shadow/replayPRODUCTION' })), /fixture mapping cannot be validated/);
  assert.doesNotThrow(() => CM.validateClockMapping(F.mapping({ mappingNamespace: 'shadow/replay' })));
  assert.doesNotThrow(() => CM.validateClockMapping(F.mapping({ mappingNamespace: 'shadow/replay/test' })));
  // Non-validated mappings keep their existing semantics.
  assert.doesNotThrow(() => CM.validateClockMapping(Object.assign(clone(trusted), { status: 'provisional' })));
});

function eventBody(ns, extra) {
  const body = Object.assign({ eventId: 'e1', runId: 'r', cycleId: 'c1', masterClockId: 'm', seq: '1', eventType: 'confirmed', eventNamespace: ns, idempotencyKey: '', policyVersion: 'p', configDigest: 'cfg', previousEventDigest: null, sourceEventTime: null, sourceInterval: null, uncertaintyUs: null, decidedAtMasterTime: 1, recordedAtMasterTime: 1, supportingObservationIds: ['o1'], contradictingObservationIds: [], reasonCodes: [] }, extra || {});
  body.idempotencyKey = sha256Canonical({ namespace: ns, runId: body.runId, cycleId: body.cycleId, seq: body.seq, eventType: body.eventType, policyVersion: body.policyVersion });
  return Object.assign({}, body, { eventDigest: sha256Canonical(body) });
}
const writeCmd = (w, ns, id) => { const pay = { candidates: [F.candidate(1, 0)] }; return w.execute({ commandId: id, namespace: ns, runId: 'r', cycleId: 'c', role: 'side', operation: 'addCandidates', expectedRecordVersion: 0, payload: pay, payloadDigest: sha256Canonical(pay) }); };

// S-04: shadow sinks write only shadow/ namespaces; the policy is not constructor-configurable (probe N05).
block('S-04', () => {
  const T = req('shadow/contracts/strict_types');
  const { InMemoryShotEventLog } = req('shadow/event_log/in_memory_event_log');
  const { InMemoryEvidenceWriter } = req('shadow/evidence_writer/in_memory_writer');
  const { initialCycle } = req('shadow/decision/shot_cycle_reducer');
  for (const bad of ['legacy-', '', 'shadow', 'production/', 'shadow/production', 'shadow/Legacy/']) {
    assert.throws(() => new InMemoryShotEventLog({ allowedNamespacePrefix: bad }), /namespace policy is fixed/, `event log rejects prefix ${JSON.stringify(bad)}`);
    assert.throws(() => new InMemoryEvidenceWriter({ allowedNamespacePrefix: bad }), /namespace policy is fixed/, `writer rejects prefix ${JSON.stringify(bad)}`);
  }
  const log = new InMemoryShotEventLog(), w = new InMemoryEvidenceWriter();
  for (const ns of ['legacy-production', 'production', 'shadow/', 'shadow/PRODUCTION', 'shadow/x/legacy', 'Shadow/x']) {
    assert.throws(() => log.append(eventBody(ns)), /EVENT_NAMESPACE_DENIED/, `event log denies ${ns}`);
    assert.throws(() => writeCmd(w, ns, 'x-' + ns), /WRITER_NAMESPACE_DENIED/, `writer denies ${ns}`);
    assert.throws(() => initialCycle({ runId: 'r', cycleId: 'c', namespace: ns, policyVersion: 'p', configDigest: 'cfg', masterClockId: 'm' }), /cycle identity/, `reducer denies ${ns}`);
    assert.strictEqual(T.isShadowNamespace(ns), false);
  }
  assert.strictEqual(log.append(eventBody('shadow/n')).status, 'appended');
  assert.strictEqual(writeCmd(w, 'shadow/n', 'ok').status, 'committed');
  // A narrowing prefix under shadow/ is honoured.
  const narrow = new InMemoryEvidenceWriter({ allowedNamespacePrefix: 'shadow/replay/' });
  assert.throws(() => writeCmd(narrow, 'shadow/live', 'n1'), /WRITER_NAMESPACE_DENIED/);
  assert.strictEqual(writeCmd(narrow, 'shadow/replay/a', 'n2').status, 'committed');
});

// S-05: archives never carry non-shadow events into a shadow import (probe N12).
block('S-05', () => {
  const AR = req('shadow/archive/shadow_archive');
  const base = crypto.createHash('sha256').update('b').digest('hex');
  const build = (ns) => AR.buildArchive({ archiveId: 'ev', baselineDigest: base, records: { frames: [], candidates: [], events: [eventBody(ns)], projections: [] }, files: {} });
  assert.throws(() => build('legacy-production'), /ARCHIVE_EVENT_NAMESPACE_DENIED/);
  // Also when the manifest is hand-built (bypassing buildArchive) and then validated/staged.
  const good = build('shadow/n');
  const forged = clone(good); forged.manifest.records.events[0] = eventBody('legacy-production');
  const { manifestDigest, ...bodyOnly } = forged.manifest; forged.manifest.manifestDigest = sha256Canonical(bodyOnly);
  assert.throws(() => AR.validateArchive(forged), /ARCHIVE_EVENT_NAMESPACE_DENIED/);
  assert.throws(() => new AR.InMemoryArchiveImporter().stage(forged, { namespace: 'shadow/import' }), /ARCHIVE_EVENT_NAMESPACE_DENIED/);
  assert.strictEqual(new AR.InMemoryArchiveImporter().stage(good, { namespace: 'shadow/import' }).status, 'staged');
  assert.throws(() => new AR.InMemoryArchiveImporter().stage(good, { namespace: 'shadow/production' }), /shadow namespace required/);
});

const saveCmd = (w, payload, ver, id) => w.execute({ commandId: id, namespace: 'shadow/n', runId: 'r', cycleId: 'c', role: 'side', operation: 'saveProjection', expectedRecordVersion: ver, payload, payloadDigest: sha256Canonical(payload) });
const addCands = (w, cands, ver, id) => { const pay = { candidates: cands }; return w.execute({ commandId: id, namespace: 'shadow/n', runId: 'r', cycleId: 'c', role: 'side', operation: 'addCandidates', expectedRecordVersion: ver, payload: pay, payloadDigest: sha256Canonical(pay) }); };
function forgeDrawIntoAnchor(p) {
  // Reviewer N01: draw-phase real frame relabelled into S03 (anchor) with a forged time and self-asserted proof.
  const forged = clone(p); forged.projectionId = 'forged';
  const src = forged.slots.find((s) => s.status === 'real'), dst = forged.slots[2];
  Object.assign(dst, { status: 'real', actualFrameUID: src.actualFrameUID, derivationId: src.derivationId, candidateId: src.candidateId, actualMasterTime: dst.targetMasterTime, signedDelta: 0, missingReason: null, mappingUncertaintyUs: 0, toleranceUs: 50000, actualPhaseEvidenceRefs: ['tl-anchor'], selectionReason: 'forged', sourceId: src.sourceId, streamGeneration: src.streamGeneration, frameSeq: src.frameSeq, contentDigest: src.contentDigest, frameEnvelopeRef: src.frameEnvelopeRef, contributingReasons: [], phaseProof: { phase: 'anchor', timelineRefs: ['tl-anchor'], intervalCheck: 'inside', settledAnchorBoundary: true } });
  Object.assign(src, { status: 'missing', actualFrameUID: null, derivationId: null, candidateId: null, actualMasterTime: null, signedDelta: null, missingReason: 'no_frame_in_tolerance', mappingUncertaintyUs: null, toleranceUs: null, actualPhaseEvidenceRefs: [], selectionReason: 'missing', sourceId: null, streamGeneration: null, frameSeq: null, contentDigest: null, frameEnvelopeRef: null, phaseProof: null });
  return { forged, src, dst };
}

// S-06: projection slot time/phase/proof bound to candidate + timeline in writer and archive (probe N01).
block('S-06', () => {
  const { InMemoryEvidenceWriter } = req('shadow/evidence_writer/in_memory_writer');
  const { project25 } = req('shadow/projector/logical25');
  const AR = req('shadow/archive/shadow_archive');
  const drawCand = F.candidate(1, 30000);
  const p = project25({ runId: 'r', cycleId: 'c', masterClockId: 'm', role: 'side', timeline: TL, candidates: [drawCand], roleBindings: BIND, projectionId: 'honest', configDigest: 'cfg' });
  const honest = p.slots.find((s) => s.status === 'real');
  assert.strictEqual(honest.phase, 'draw', 'precondition: candidate honestly projected into a draw slot');
  const { forged } = forgeDrawIntoAnchor(p);

  const w = new InMemoryEvidenceWriter(); addCands(w, [drawCand], 0, 'a');
  // Forged projection, even when submitted WITH the honest timeline, is rejected.
  assert.throws(() => saveCmd(w, { projection: forged, timeline: TL, releaseTime: null }, 1, 'f1'), /PROJECTION_PHASE_MISMATCH/);
  assert.throws(() => saveCmd(w, { projection: forged }, 1, 'f2'), /PROJECTION_PHASE_MISMATCH/, 'timeline is mandatory');
  // Consistent-time variant: keep the candidate's real time but claim the anchor slot.
  const v2 = clone(forged); const d2 = v2.slots[2]; d2.actualMasterTime = drawCand.actualMasterTime; d2.signedDelta = drawCand.actualMasterTime - d2.targetMasterTime;
  assert.throws(() => saveCmd(w, { projection: v2, timeline: TL, releaseTime: null }, 1, 'f3'), /PROJECTION_PHASE_MISMATCH/);
  // Honest slot with a forged phaseProof / refs / target / uncertainty.
  for (const mutate of [
    (s) => { s.phaseProof.timelineRefs = ['tl-anchor']; },
    (s) => { s.phaseProof.phase = 'anchor'; },
    (s) => { s.actualPhaseEvidenceRefs = ['tl-anchor']; },
    (s) => { s.mappingUncertaintyUs = 0 + 1; },
    (s) => { s.toleranceUs = 60000; },
    (s) => { s.targetMasterTime += 1; s.signedDelta -= 1; },
  ]) {
    const m = clone(p); mutate(m.slots.find((s) => s.status === 'real'));
    assert.throws(() => saveCmd(w, { projection: m, timeline: TL, releaseTime: null }, 1, 'm' + Math.random()), /PROJECTION_(PHASE|TIMELINE)|real slot phaseProof/);
  }
  // A different timeline than the one projected from.
  const otherTL = clone(TL); otherTL.anchor.end = 400001;
  assert.throws(() => saveCmd(w, { projection: p, timeline: otherTL, releaseTime: null }, 1, 't1'), /PROJECTION_TIMELINE_DIGEST_MISMATCH/);
  assert.throws(() => saveCmd(w, { projection: p, timeline: TL, releaseTime: null, extra: 1 }, 1, 't2'), /unknown payload field/);
  // Honest projection still saves; Review only ever sees the honest record.
  assert.strictEqual(saveCmd(w, { projection: p, timeline: TL, releaseTime: null }, 1, 'ok').status, 'committed');
  const snap = w.snapshot({ namespace: 'shadow/n', runId: 'r', cycleId: 'c', role: 'side' });
  assert.deepStrictEqual(snap.projections.map((x) => x.projectionId), ['honest']);
  assert.strictEqual(snap.projectionTimelines[0].projectionId, 'honest');

  // Archive: same binding, typed timelines collection, explicit schema rejection.
  const digest = crypto.createHash('sha256').update('img').digest('hex');
  const c1 = F.candidate(1, 30000, { payloadRef: 'f/1.bin', contentDigest: digest });
  const f1 = F.frame(1, { mappedMasterTime: 30000, payloadRef: 'f/1.bin', contentDigest: digest, decodeValid: true });
  const pa = project25({ runId: 'r', cycleId: 'c', masterClockId: 'm', role: 'side', timeline: TL, candidates: [c1], roleBindings: BIND, projectionId: 'honest', configDigest: 'cfg' });
  const base = crypto.createHash('sha256').update('b').digest('hex');
  const files = { 'f/1.bin': Buffer.from('img') };
  const goodRecords = { frames: [f1], candidates: [c1], events: [], projections: [pa], timelines: [{ projectionId: 'honest', timeline: TL, releaseTime: null }] };
  const arc = AR.buildArchive({ archiveId: 'a', baselineDigest: base, records: goodRecords, files });
  assert.strictEqual(AR.validateArchive(AR.roundTrip(arc)), true);
  assert.strictEqual(arc.manifest.records.schemaVersion, 2);
  const fa = forgeDrawIntoAnchor(pa).forged; fa.projectionId = 'honest';
  assert.throws(() => AR.buildArchive({ archiveId: 'a', baselineDigest: base, records: Object.assign({}, goodRecords, { projections: [fa] }), files }), /PROJECTION_PHASE_MISMATCH/);
  const reseal = (a) => { const { manifestDigest, ...body } = a.manifest; a.manifest.manifestDigest = sha256Canonical(body); return a; };
  const tam = clone(arc); tam.manifest.records.projections = [fa]; reseal(tam);
  assert.throws(() => AR.validateArchive(tam), /PROJECTION_PHASE_MISMATCH/);
  assert.throws(() => new AR.InMemoryArchiveImporter().stage(tam, { namespace: 'shadow/import' }), /PROJECTION_PHASE_MISMATCH/);
  assert.throws(() => AR.buildArchive({ archiveId: 'a', baselineDigest: base, records: Object.assign({}, goodRecords, { timelines: [] }), files }), /PROJECTION_TIMELINE_MISSING/);
  const v1 = clone(arc); delete v1.manifest.records.schemaVersion; delete v1.manifest.records.timelines; reseal(v1);
  assert.throws(() => AR.validateArchive(v1), /ARCHIVE_SCHEMA_UNSUPPORTED/);
  const orphan = clone(arc); orphan.manifest.records.timelines.push({ projectionId: 'ghost', timeline: TL, releaseTime: null }); reseal(orphan);
  assert.throws(() => AR.validateArchive(orphan), /ORPHAN_PROJECTION_TIMELINE/);

  // No false rejection: randomized honest projections (all phases, release window, jitter, uncertainty) always verify.
  const { verifyProjectionBinding } = req('shadow/projector/projection_binding');
  let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const fullTL = { masterClockId: 'm', draw: { status: 'verified', start: 0, end: 400000, refs: ['d'] }, anchor: { status: 'verified', start: 400000, end: 900000, refs: ['a'] }, hold: { status: 'verified', start: 900000, end: 1400000, refs: ['h'] }, expansion: { status: 'verified', start: 1400000, end: 1600000, refs: ['e'] }, release_window: { status: 'verified', refs: ['rw'] }, follow_through: { status: 'verified', start: 1800000, end: 2400000, refs: ['ft'] }, recovery: { status: 'verified', start: 2400000, end: 2600000, refs: ['rc'] } };
  let verified = 0, realSlots = 0;
  for (let k = 0; k < 150; k++) {
    const tl = clone(fullTL); for (const ph of ['hold', 'expansion', 'recovery']) if (rnd() < 0.2) tl[ph].status = 'unverified';
    const n = 5 + Math.floor(rnd() * 70), cands = [];
    for (let i = 0; i < n; i++) cands.push(F.candidate(i + 1, Math.floor(rnd() * 2700000), { mappingUncertainty: Math.floor(rnd() * 4000), phaseEvidenceRefs: rnd() < 0.3 ? ['claim'] : [] }));
    const releaseTime = rnd() < 0.85 ? 1650000 + Math.floor(rnd() * 100000) : null;
    const pr = project25({ runId: 'r', cycleId: 'c', masterClockId: 'm', role: 'side', timeline: tl, releaseTime, candidates: cands, roleBindings: [F.binding({ startMasterTime: 0, endMasterTime: 3000000, capturePeriodUs: 33333, jitterUs: Math.floor(rnd() * 3000) })], projectionId: 'p' + k, configDigest: 'cfg' });
    const byId = new Map(cands.map((c) => [c.candidateId, c]));
    verifyProjectionBinding({ projection: pr, timeline: tl, releaseTime, candidateById: (id) => byId.get(id) });
    verified++; realSlots += pr.uniqueRealCount;
  }
  assert.strictEqual(verified, 150); assert.ok(realSlots > 1000, 'randomized set exercised many real slots: ' + realSlots);
});

let failed = 0;
for (const [id, fn] of blocks) {
  try { fn(); console.log(`${id}: PASS`); } catch (e) { failed++; console.error(`${id}: FAIL`, e && e.stack || e); }
}
if (failed) { console.error(`Claude round-2 repairs: ${failed} FAIL`); process.exit(1); }
console.log(`Claude round-2 repairs: PASS (${blocks.length} blocks)`);

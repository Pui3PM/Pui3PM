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
  Object.assign(dst, { status: 'real', actualFrameUID: src.actualFrameUID, derivationId: src.derivationId, candidateId: src.candidateId, actualMasterTime: dst.targetMasterTime, signedDelta: 0, missingReason: null, mappingUncertaintyUs: 0, toleranceUs: 50000, actualPhaseEvidenceRefs: ['tl-anchor'], selectionReason: 'forged', sourceId: src.sourceId, streamGeneration: src.streamGeneration, frameSeq: src.frameSeq, contentDigest: src.contentDigest, frameEnvelopeRef: src.frameEnvelopeRef, contributingReasons: [], phaseProof: { phase: 'anchor', timelineRefs: ['tl-anchor'], intervalCheck: 'inside', anchorIntervalKind: 'settled-anchor-interval' } });
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

// S-07: archive binds payloadRef bytes to contentDigest (probe N02).
block('S-07', () => {
  const AR = req('shadow/archive/shadow_archive');
  const imgA = Buffer.from('IMAGE-A-bytes'), imgB = Buffer.from('IMAGE-B-different');
  const dA = crypto.createHash('sha256').update(imgA).digest('hex');
  const base = crypto.createHash('sha256').update('b').digest('hex');
  const fr = F.frame(7, { mappedMasterTime: 30000, payloadRef: 'blobs/7.jpg', contentDigest: dA, decodeValid: true });
  const c = F.candidate(7, 30000, { payloadRef: 'blobs/7.jpg', contentDigest: dA });
  const rec = (frames, cands) => ({ frames, candidates: cands, events: [], projections: [] });
  assert.throws(() => AR.buildArchive({ archiveId: 'x', baselineDigest: base, records: rec([fr], [c]), files: { 'blobs/7.jpg': imgB } }), /PAYLOAD_DIGEST_MISMATCH/);
  assert.throws(() => AR.buildArchive({ archiveId: 'x', baselineDigest: base, records: rec([fr], []), files: { 'blobs/7.jpg': imgB } }), /PAYLOAD_DIGEST_MISMATCH/, 'frame alone is bound too');
  const good = AR.buildArchive({ archiveId: 'x', baselineDigest: base, records: rec([fr], [c]), files: { 'blobs/7.jpg': imgA } });
  assert.strictEqual(AR.validateArchive(AR.roundTrip(good)), true, 'correct bytes still round-trip');
  // Swap the bytes after build (file table re-hashed consistently, manifest resealed): still rejected.
  const tam = clone(good);
  tam.payloads['blobs/7.jpg'] = imgB.toString('base64');
  const ft = tam.manifest.fileTable.find((f) => f.path === 'blobs/7.jpg'); ft.byteLength = imgB.length; ft.sha256 = crypto.createHash('sha256').update(imgB).digest('hex');
  const { manifestDigest, ...body } = tam.manifest; tam.manifest.manifestDigest = sha256Canonical(body);
  assert.throws(() => AR.validateArchive(tam), /PAYLOAD_DIGEST_MISMATCH/);
  // Upper-case digest spelling of the right bytes is the same digest.
  const cU = F.candidate(7, 30000, { payloadRef: 'blobs/7.jpg', contentDigest: dA.toUpperCase() });
  const frU = F.frame(7, { mappedMasterTime: 30000, payloadRef: 'blobs/7.jpg', contentDigest: dA.toUpperCase(), decodeValid: true });
  assert.doesNotThrow(() => AR.buildArchive({ archiveId: 'y', baselineDigest: base, records: rec([frU], [cU]), files: { 'blobs/7.jpg': imgA } }));
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const D = (messageType, payloadRef = null) => ({ workerId: 'w', messageType, payloadRef });

// S-08: timeout aborts the executor job; a hung worker cannot accumulate jobs; generation set is bounded (probe N06).
block('S-08', async () => {
  const { AnalysisScheduler, CANCELLED_GENERATIONS_RETAINED } = req('shadow/scheduler/priority_scheduler');
  // (a) N06 inverted: 8 aux submissions onto one hung worker -> never more than 1 outstanding executor job.
  let running = 0, peak = 0; const signals = []; const drops = [];
  const s = new AnalysisScheduler({ jobTimeoutMs: 10, onDrop: (j, r) => drops.push(r), executor: (d, m, ctx) => { running++; peak = Math.max(peak, running); signals.push(ctx.signal); return new Promise(() => {}); } });
  for (let i = 0; i < 8; i++) { s.submit('overhead', D('hang'), { id: 'j' + i, generation: 'g' + i }); await sleep(14); }
  assert.strictEqual(peak, 1, 'hung worker never receives a second job');
  assert.strictEqual(signals.length, 1); assert.strictEqual(signals[0].aborted, true, 'timed-out job was aborted');
  assert.strictEqual(String(signals[0].reason), 'SCHEDULER_JOB_TIMEOUT');
  assert.strictEqual(drops.filter((r) => r === 'worker_unresponsive').length, 7);
  const snap = s.snapshot(); assert.strictEqual(snap.auxDegraded, true); assert.strictEqual(snap.metrics.workerUnresponsiveDrops, 7); assert.strictEqual(snap.metrics.timedOut, 1);
  // Side is unaffected by the hung aux worker and completes promptly.
  const sideDone = []; const s2 = new AnalysisScheduler({ jobTimeoutMs: 50, onOutcome: (j, st) => sideDone.push([j.role, j.meta.id, st]), executor: (d) => d.messageType === 'hang' ? new Promise(() => {}) : Promise.resolve(d.messageType) });
  s2.submit('overhead', D('hang'), { id: 'aux1' }); await sleep(60); s2.submit('rear', D('hang'), { id: 'aux2' });
  const t0 = Date.now(); s2.submit('side', D('ok'), { id: 'side1' }); await sleep(2);
  assert.ok(sideDone.some((x) => x[1] === 'side1' && x[2] === 'completed'), 'Side completes while aux worker is hung');
  assert.ok(Date.now() - t0 < 40, 'Side did not wait for an aux timeout (50 ms)');
  assert.strictEqual(s2.snapshot().sideDegraded, false); assert.strictEqual(s2.snapshot().auxDegraded, true);
  // (b) An executor that honours abort settles late -> lane recovers and the next job runs.
  const out = []; const s3 = new AnalysisScheduler({ jobTimeoutMs: 10, onOutcome: (j, st) => out.push([j.meta.id, st]), executor: (d, m, { signal }) => d.messageType === 'slow' ? new Promise((_, rej) => signal.addEventListener('abort', () => setTimeout(() => rej(new Error('aborted')), 5))) : Promise.resolve(1) });
  s3.submit('overhead', D('slow'), { id: 'slow' }); await sleep(12);
  assert.strictEqual(s3.snapshot().auxDegraded, true, 'degraded until the aborted job settles');
  await sleep(10); assert.strictEqual(s3.snapshot().auxDegraded, false, 'recovered after late settle');
  s3.submit('rear', D('ok'), { id: 'after' }); await sleep(2);
  assert.deepStrictEqual(out.filter((x) => x[0] === 'slow'), [['slow', 'timed_out']], 'exactly one outcome for the timed-out job');
  assert.ok(out.some((x) => x[0] === 'after' && x[1] === 'completed'));
  assert.strictEqual(s3.snapshot().metrics.lateSettled, 1);
  // (c) Stale-generation cancel aborts the running job and frees the lane for the newer generation; capped.
  const out4 = []; const sig4 = []; const s4 = new AnalysisScheduler({ jobTimeoutMs: 1000, maxCancelledInFlight: 2, onOutcome: (j, st) => out4.push([j.meta.id, st]), onDrop: (j, r) => out4.push([j.meta.id, 'drop:' + r]), executor: (d, m, { signal }) => { sig4.push(signal); return d.messageType === 'hang' ? new Promise(() => {}) : Promise.resolve(1); } });
  s4.submit('side', D('hang'), { id: 'h1', generation: 'a' }); s4.cancelGeneration('a'); await sleep(1);
  assert.ok(sig4[0].aborted && String(sig4[0].reason) === 'SCHEDULER_GENERATION_CANCELLED');
  s4.submit('side', D('hang'), { id: 'h2', generation: 'b' }); s4.cancelGeneration('b'); await sleep(1);
  const r = s4.submit('side', D('ok'), { id: 'n', generation: 'c' });
  assert.deepStrictEqual([r.accepted, r.dropped], [false, 'worker_unresponsive'], 'abandoned cancelled jobs are capped');
  assert.ok(out4.some((x) => x[0] === 'h1' && x[1] === 'stale_discarded'));
  // (d) Bounded cancelled-generation memory, most recent retained.
  const s5 = new AnalysisScheduler({ executor: async () => 1 });
  for (let i = 0; i < 200; i++) s5.cancelGeneration('gen-' + i);
  const gens = s5.snapshot().cancelledGenerations;
  assert.strictEqual(gens.length, CANCELLED_GENERATIONS_RETAINED); assert.strictEqual(gens[gens.length - 1], 'gen-199'); assert.ok(!gens.includes('gen-0'));
});

// S-09: descriptor validation is deep (probe N07).
block('S-09', () => {
  const { validateDescriptor } = req('shadow/scheduler/priority_scheduler');
  class Box { constructor() { this.v = 1; } }
  for (const extra of [{ fn() { return 1; } }, { s: Symbol('x') }, { d: new Date(0) }, { m: new Map() }, { b: new Box() }, { u: undefined }, { n: NaN }, { deep: [{ f: () => 1 }] }]) {
    assert.throws(() => validateDescriptor(Object.assign(D('m'), { extra })), /serializable|functions/, 'rejects ' + Object.keys(extra)[0]);
  }
  const ok = validateDescriptor(Object.assign(D('m'), { extra: { a: [1, 'x', { b: null }] } }));
  assert.ok(Object.isFrozen(ok.extra.a[2]), 'deep-frozen copy');
  assert.doesNotThrow(() => structuredClone(ok));
});

// S-10: idempotency memos are per aggregate; pruned only after finalize + retention; expired retries are explicit (probe N09).
block('S-10', () => {
  const { InMemoryEvidenceWriter } = req('shadow/evidence_writer/in_memory_writer');
  const { project25 } = req('shadow/projector/logical25');
  const ex = (w, cycleId, op, payload, ver, id) => w.execute({ commandId: id, namespace: 'shadow/n', runId: 'r', cycleId, role: 'side', operation: op, expectedRecordVersion: ver, payload, payloadDigest: sha256Canonical(payload) });
  // N09 inverted: other cycles stay writable after one aggregate's worth of memos.
  const w = new InMemoryEvidenceWriter({ maxCommandMemos: 3 });
  for (let i = 0; i < 3; i++) ex(w, 'c' + i, 'addCandidates', { candidates: [F.candidate(1, 0, { cycleId: 'c' + i })] }, 0, 'k' + i);
  assert.strictEqual(ex(w, 'new-shot', 'addCandidates', { candidates: [F.candidate(2, 0, { cycleId: 'new-shot' })] }, 0, 'new').status, 'committed');
  // Cap is fail-closed per aggregate only.
  for (let i = 1; i < 3; i++) ex(w, 'c0', 'addCandidates', { candidates: [F.candidate(10 + i, 0, { cycleId: 'c0' })] }, i, 'c0-' + i);
  assert.throws(() => ex(w, 'c0', 'addCandidates', { candidates: [F.candidate(20, 0, { cycleId: 'c0' })] }, 3, 'c0-x'), /COMMAND_MEMO_CAPACITY/);
  assert.strictEqual(ex(w, 'c1', 'addCandidates', { candidates: [F.candidate(30, 0, { cycleId: 'c1' })] }, 1, 'c1-1').status, 'committed');
  // Same-command retry inside retention returns the memoized result without re-executing.
  const again = ex(w, 'c0', 'addCandidates', { candidates: [F.candidate(1, 0, { cycleId: 'c0' })] }, 0, 'k0');
  assert.deepStrictEqual([again.status, again.recordVersion], ['committed', 1]);
  assert.strictEqual(w.snapshot({ namespace: 'shadow/n', runId: 'r', cycleId: 'c0', role: 'side' }).version, 3, 'retry did not re-execute');

  // Finalize + retention: oldest finalized aggregate is pruned; its retries are COMMAND_EXPIRED, never re-executed.
  const shot = (wr, cycleId, seq) => {
    const cand = F.candidate(seq, 30000, { cycleId });
    ex(wr, cycleId, 'addCandidates', { candidates: [cand] }, 0, cycleId + '-a');
    const pr = project25({ runId: 'r', cycleId, masterClockId: 'm', role: 'side', timeline: TL, candidates: [cand], roleBindings: BIND, projectionId: 'p-' + cycleId, configDigest: 'cfg' });
    ex(wr, cycleId, 'saveProjection', { projection: pr, timeline: TL, releaseTime: null }, 1, cycleId + '-p');
    return ex(wr, cycleId, 'finalizeCycle', {}, 2, cycleId + '-f');
  };
  const w2 = new InMemoryEvidenceWriter({ finalizedRetention: 2 });
  for (const c of ['s1', 's2', 's3']) shot(w2, c, 1);
  assert.throws(() => ex(w2, 's1', 'finalizeCycle', {}, 2, 's1-f'), /COMMAND_EXPIRED/);
  assert.throws(() => ex(w2, 's1', 'addCandidates', { candidates: [F.candidate(1, 30000, { cycleId: 's1' })] }, 0, 's1-a'), /COMMAND_EXPIRED/);
  assert.strictEqual(ex(w2, 's2', 'finalizeCycle', {}, 2, 's2-f').status, 'committed', 's2 still inside retention: memoized');
  assert.strictEqual(w2.snapshot({ namespace: 'shadow/n', runId: 'r', cycleId: 's1', role: 'side' }).finalized, true, 'record itself is kept');
  // Unfinalized aggregates are never pruned.
  const w3 = new InMemoryEvidenceWriter({ finalizedRetention: 0 });
  ex(w3, 'open', 'addCandidates', { candidates: [F.candidate(1, 30000, { cycleId: 'open' })] }, 0, 'open-a');
  shot(w3, 'done', 2);
  assert.strictEqual(ex(w3, 'open', 'addCandidates', { candidates: [F.candidate(1, 30000, { cycleId: 'open' })] }, 0, 'open-a').status, 'committed');

  // Long session with defaults: 3,500 finalized shots (10,500 commands, above the old global 10,000 cap).
  const w4 = new InMemoryEvidenceWriter();
  for (let i = 0; i < 3500; i++) assert.strictEqual(shot(w4, 'L' + i, 1).status, 'committed');
  assert.ok(w4._memoCount() <= (64 + 1) * 3, 'memo memory bounded: ' + w4._memoCount());
});

// S-11: a malformed candidate is classified invalid, counted, and does not abort the projection (probe N10).
block('S-11', () => {
  const { project25 } = req('shadow/projector/logical25');
  const good = F.candidate(4, 250000);
  const args = (cands) => ({ runId: 'r', cycleId: 'c', masterClockId: 'm', role: 'side', timeline: TL, candidates: cands, roleBindings: BIND, projectionId: 'u', configDigest: 'cfg' });
  const honest = project25(args([good]));
  for (const bad of [Object.assign({}, F.candidate(3, 175000), { extensions: undefined }), Object.assign({}, F.candidate(5, 175000), { width: NaN }), null, undefined, 'junk']) {
    const p = project25(args([good, bad]));
    assert.strictEqual(p.inputCandidateCount, 2, 'invalid candidate counted, not dropped');
    assert.strictEqual(p.eligibleCandidateCount, 1);
    assert.strictEqual(p.uniqueRealCount, honest.uniqueRealCount, 'other candidates still real');
    assert.ok(p.slots.filter((s) => s.status === 'missing').some((s) => s.contributingReasons.includes('candidate_invalid')), 'reason surfaced');
    assert.notStrictEqual(p.inputCandidateDigest, honest.inputCandidateDigest, 'digest reflects the invalid input');
  }
  // Honest inputs hash exactly as before (raw list digest).
  assert.strictEqual(honest.inputCandidateDigest, sha256Canonical([good]));
  const inactive = project25(Object.assign(args([good, Object.assign({}, good, { extensions: undefined })]), { active: false }));
  assert.strictEqual(inactive.inactiveCount, 25);
});

// S-12: shadow reducer stream reset, 200 ms reorder watermark, evidence gate (probe N11). Shadow only.
block('S-12', () => {
  const R = req('shadow/decision/shot_cycle_reducer');
  const { InMemoryShotEventLog } = req('shadow/event_log/in_memory_event_log');
  const base = () => R.initialCycle({ runId: 'r', cycleId: 'z', masterClockId: 'm', namespace: 'shadow/x', policyVersion: 'p', configDigest: 'cfg' });
  const prop = (type, extra) => Object.assign({ runId: 'r', cycleId: 'z', eventType: type, eventId: 'e-' + type, decidedAtMasterTime: 10, recordedAtMasterTime: 11 }, extra || {});
  // Evidence gate.
  assert.throws(() => R.reduceCycle(base(), prop('confirmed')), /CONFIRMED_REQUIRES_EVIDENCE/);
  assert.throws(() => R.reduceCycle(base(), prop('confirmed', { supportingObservationIds: [] })), /CONFIRMED_REQUIRES_EVIDENCE/);
  assert.throws(() => R.reduceCycle(base(), prop('confirmed', { supportingObservationIds: ['o1'], trigger: 'timeout' })), /CONFIRMED_REQUIRES_EVIDENCE/, 'timeout never confirms');
  assert.strictEqual(R.reduceCycle(base(), prop('uncertain', { trigger: 'timeout' })).cycle.state, 'uncertain');
  const ok = R.reduceCycle(base(), prop('confirmed', { supportingObservationIds: ['o1'] }));
  assert.strictEqual(ok.cycle.state, 'confirmed');
  const log = new InMemoryShotEventLog(); assert.strictEqual(log.append(ok.event).status, 'appended');
  const raw = eventBody('shadow/x', { cycleId: 'raw', supportingObservationIds: [] });
  assert.throws(() => log.append(raw), /CONFIRMED_REQUIRES_EVIDENCE/, 'direct append cannot bypass the gate');
  // Stream reset.
  for (const kind of ['side_generation_changed', 'clock_discontinuity']) {
    const c1 = R.reduceCycle(base(), prop('candidate', { supportingObservationIds: ['o1'] }));
    const r = R.applyStreamEvent(c1.cycle, { kind, eventId: 'reset', decidedAtMasterTime: 20, recordedAtMasterTime: 21 });
    assert.strictEqual(r.status, 'stream_reset'); assert.strictEqual(r.cycle.state, 'uncertain');
    assert.deepStrictEqual([...r.event.reasonCodes], ['authority_stream_reset', kind]);
    const l2 = new InMemoryShotEventLog();
    assert.strictEqual(l2.append(c1.event).status, 'appended');
    assert.strictEqual(l2.append(r.event).status, 'appended', 'reset event chains onto the candidate');
    assert.strictEqual(R.reduceCycle(r.cycle, prop('confirmed', { supportingObservationIds: ['o2'] })).status, 'terminal_immutable', 'late result cannot change the reset cycle');
  }
  const term = R.applyStreamEvent(ok.cycle, { kind: 'side_generation_changed', eventId: 'reset', decidedAtMasterTime: 20, recordedAtMasterTime: 21 });
  assert.deepStrictEqual([term.status, term.event, term.cycle], ['terminal_immutable', null, ok.cycle], 'terminal cycle unchanged by reset');
  assert.throws(() => R.applyStreamEvent(base(), { kind: 'aux_generation_changed' }), /stream event kind/);
  // Reorder buffer: in order within 200 ms; gap after the wait; late results never applied.
  let st = R.initialReorderState({ generation: 'g1', startSeq: '10' });
  const push = (seq, at) => { const r = R.reorderPush(st, { generation: 'g1', frameSeq: String(seq), arrivalUs: at, result: 'r' + seq }); st = r.state; return r.outputs.map((o) => o.kind === 'result' ? 'R' + o.frameSeq : o.kind === 'gap' ? `G${o.fromSeq}-${o.toSeq}` : o.kind[0].toUpperCase() + o.frameSeq); };
  assert.deepStrictEqual(push(11, 0), []);
  assert.deepStrictEqual(push(12, 50000), []);
  assert.deepStrictEqual(push(10, 120000), ['R10', 'R11', 'R12'], 'out-of-order inside 200 ms released in Side order');
  assert.deepStrictEqual(push(14, 130000), []);
  let adv = R.reorderAdvance(st, 329999); st = adv.state; assert.deepStrictEqual(adv.outputs, [], 'still inside the 200 ms window');
  adv = R.reorderAdvance(st, 330000); st = adv.state;
  assert.deepStrictEqual(adv.outputs.map((o) => o.kind === 'gap' ? `G${o.fromSeq}-${o.toSeq}` : 'R' + o.frameSeq), ['G13-13', 'R14']);
  assert.strictEqual(adv.outputs[0].policyVersion, R.REORDER_POLICY_VERSION);
  assert.deepStrictEqual(push(13, 340000), ['L13'], 'late result after the gap is not applied');
  assert.deepStrictEqual(push(14, 340001), ['L14'], 'duplicate is late');
  const stale = R.reorderPush(st, { generation: 'g0', frameSeq: '15', arrivalUs: 1, result: 'x' });
  assert.strictEqual(stale.outputs[0].kind, 'stale_generation'); assert.strictEqual(stale.state, st);
  assert.ok(Object.isFrozen(st) && Object.isFrozen(st.waiting));
  // Determinism: same inputs -> same outputs.
  const run = () => { let s0 = R.initialReorderState({ generation: 'g', startSeq: '0' }); const out = []; for (const [q, t] of [[2, 0], [0, 5], [5, 7], [1, 9], [3, 300000]]) { const r = R.reorderPush(s0, { generation: 'g', frameSeq: String(q), arrivalUs: t, result: q }); s0 = r.state; out.push(...r.outputs); } return sha256Canonical(out.map((o) => Object.assign({}, o))); };
  assert.strictEqual(run(), run());
  // Shadow must stay out of the production path: no app/static file references app/shadow.
  const fs = require('fs');
  for (const f of fs.readdirSync(path.join(APP, 'static'))) {
    if (!/\.(js|mjs|html)$/.test(f)) continue;
    const src = fs.readFileSync(path.join(APP, 'static', f), 'utf8');
    assert.ok(!/shadow\/(contracts|decision|evidence_writer|event_log|archive|projector|scheduler|browser|review|ring|replay|adapters|telemetry)|ThreePMShadow|shadow_runtime_bundle/.test(src), `app/static/${f} must not import app/shadow`);
  }
});

// S-13 (OWNER DECISION D-A, default option 1): anchor proof states the contract interval kind; unknown timeline
// fields (e.g. an ad-hoc `settled:false`) are rejected at the trust boundary instead of being silently ignored.
block('S-13', () => {
  const { project25, ANCHOR_INTERVAL_KIND } = req('shadow/projector/logical25');
  const { InMemoryEvidenceWriter } = req('shadow/evidence_writer/in_memory_writer');
  const VM = req('shadow/review/view_model');
  const cand = F.candidate(1, 175000);
  const p = project25({ runId: 'r', cycleId: 'c', masterClockId: 'm', role: 'side', timeline: TL, candidates: [cand], roleBindings: BIND, projectionId: 's', configDigest: 'cfg' });
  const a = p.slots.find((s) => s.phase === 'anchor' && s.status === 'real');
  assert.strictEqual(ANCHOR_INTERVAL_KIND, 'settled-anchor-interval');
  assert.strictEqual(a.phaseProof.anchorIntervalKind, 'settled-anchor-interval');
  assert.ok(!('settledAnchorBoundary' in a.phaseProof), 'no self-asserted settledness boolean');
  assert.strictEqual(VM.anchorTarget(VM.buildReviewView(p)).status, 'real', 'behaviour kept: verified anchor interval -> Anchor target');
  for (const s of p.slots.filter((x) => x.status === 'real' && x.phase !== 'anchor')) assert.ok(!('anchorIntervalKind' in s.phaseProof));
  // A proof without the interval kind is not a verified anchor.
  const noKind = clone(p); delete noKind.slots.find((s) => s.slotId === a.slotId).phaseProof.anchorIntervalKind;
  assert.throws(() => VM.buildReviewView(noKind), /anchor settled proof required/);
  // Timeline field outside the contract (reviewer N08 `settled:false`) is rejected by the writer.
  const tlUnsettled = { masterClockId: 'm', anchor: { status: 'verified', start: 100000, end: 400000, refs: ['raw-anchor-not-settled'], settled: false } };
  const pu = project25({ runId: 'r', cycleId: 'c', masterClockId: 'm', role: 'side', timeline: tlUnsettled, candidates: [cand], roleBindings: BIND, projectionId: 'u', configDigest: 'cfg' });
  const w = new InMemoryEvidenceWriter(); addCands(w, [cand], 0, 'a');
  assert.throws(() => saveCmd(w, { projection: pu, timeline: tlUnsettled, releaseTime: null }, 1, 'u'), /PROJECTION_TIMELINE_INVALID.*settled/);
  assert.strictEqual(saveCmd(w, { projection: p, timeline: TL, releaseTime: null }, 1, 's').status, 'committed');
});

(async () => {
  let failed = 0;
  for (const [id, fn] of blocks) {
    try { await fn(); console.log(`${id}: PASS`); } catch (e) { failed++; console.error(`${id}: FAIL`, e && e.stack || e); }
  }
  if (failed) { console.error(`Claude round-2 repairs: ${failed} FAIL`); process.exit(1); }
  console.log(`Claude round-2 repairs: PASS (${blocks.length} blocks)`);
})();

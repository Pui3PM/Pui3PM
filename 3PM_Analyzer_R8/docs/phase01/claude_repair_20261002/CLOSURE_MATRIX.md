# Closure Matrix — Claude R8C Findings

| Finding | Status after repair | Permanent evidence / remaining gate |
|---|---|---|
| R8C-01 Scheduler label-only isolation | **REPAIRED pure contract / runtime worker NOT RUN** | `test_claude_r8_repairs.js`: function task denied, descriptor timeout, stale generation, observer containment. Real Worker/Side latency still runtime gate. |
| R8C-02 FrameUID conflict not enforced | **REPAIRED offline** | Replay/ring/projector identity-record conflict tests. |
| R8C-03 forged/duplicate real slot | **REPAIRED offline** | typed Projection + injective UID + writer/review cross-check. |
| R8C-04 generation filter opt-in | **REPAIRED offline** | roleBindings required and generation interval enforced. |
| R8C-05 event namespace/query leakage | **REPAIRED offline** | `shadow/` namespace deny policy + namespace/run query scope. |
| R8C-06 `__proto__` clone defect | **REPAIRED offline** | forbidden-key regression + archive round-trip. |
| R8C-07 clock semantics | **REPAIRED pure contract** | scale↔timebase, null tick, provenance rules. Physical/native clock calibration NOT RUN. |
| R8C-08 ring clock/admission defects | **REPAIRED offline** | full frame validation, master-clock retention, explicit drop reasons. |
| R8C-09 lease can pin forever | **REPAIRED offline** | lease TTL, leased-byte reservation, advance/pressure tests. |
| R8C-10 tie not contract lexicographic | **REPAIRED offline** | 10,000-case brute-force max-cardinality/min-delta/lex oracle. |
| R8C-11 tolerance from candidate spacing | **REPAIRED offline** | capturePeriod/jitter are explicit role-binding inputs. |
| R8C-12 Anchor proof arbitrary string | **REPAIRED offline** | projector-owned verified timeline proof; review validates it. |
| R8C-13 archive boundary gaps | **REPAIRED in-memory archive boundary** | portable paths, payload whitelist, typed record/ref checks. Filesystem extractor/durable import NOT IMPLEMENTED. |
| R8C-14 validator coverage | **REPAIRED offline** | typed intervals/times + strict unknown fields. |
| R8C-15 lone-surrogate UID collision | **REPAIRED** | negative UID regression. |
| R8C-16 browser portability only FrameUID | **PARTIALLY CLOSED** | bundle VM without require/Buffer/process PASS; pure hash/binary parity PASS. Actual Chromium remains BLOCKED/NOT RUN. |
| R8C-17 misleading report/gates | **REPAIRED for this artifact** | F02 split truth; original legacy suite remains 100/103 with 3 unchanged pre-thaw pose-hash sentinels; approved-thaw reconstruction guard PASS; static gate PASS; package SHA regenerated at finalization; oracle naming corrected. |
| R8C-18 production legacy gaps | **OPEN — AUTHORIZATION BOUNDARY** | `temporal_evidence_core`, legacy camera timeline, legacy/native writer, DOM/Anchor remain production blockers. |
| R8C-19 smaller risks | **MOST PURE ITEMS REPAIRED / durability remains** | explicit replay fields, richer missing reasons/digests, playback ordering, command memo fail-closed, deep EventTape snapshots. Persistent IndexedDB fencing/journal/quota/crash and pose trace runtime budget remain OPEN. |

No row above implies production/live-shooting approval.

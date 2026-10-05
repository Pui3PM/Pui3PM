# Owner decision required — D-R2-01: which identity rule governs 8 legacy assertions (5 test files)

Status: **OPEN — not decided by any AI.** AGENTS.md (Post-P108): "Do not remove original red identity assertions or
claim a green release gate." These assertions were therefore NOT edited. Until the owner decides, the mandatory
regression gate cannot be green and the package stays UNPROMOTED.

## Why they cannot all pass
The Post-P108 H02 instruction says: timestamps, payload sizes and near epochs never prove identity; camera identity
(mediaTime/frameSeq) needs an explicit clock domain; persisted copies must carry a FrameUID.
`app/tests/test_post_p108_identity.js` encodes that rule. The 8 assertions below (in 5 files) were written for the older P1-08 /
R7 rule and require the core to merge rows using exactly the evidence the new rule forbids. For each pair the inputs
are structurally identical, so no principled rule can satisfy both (a rule that tells them apart would be fitted to
the fixtures, which this project forbids).

| # | Assertion (file) | What it requires | Forbidden by new rule | Value-equal counter-case in `test_post_p108_identity.js` |
|---|---|---|---|---|
| 1 | `test_transaction_r7.js:56` "same real media frame must not count twice" | 2 rows, no source, no generation, equal `mediaTime` -> 1 | camera identity outside an explicit domain | `{deviceID,mediaTime:1,frameSeq:1}` x2 -> 2 |
| 2 | `test_evidence_identity_writer_r8c.js` "preserve: cross-pipeline duplicate ... still merges" | sparse vs worker 5 ms apart -> 1 | near epoch | rule text; enforced by `test_post_p108_r2_identity.js` negatives |
| 3 | `test_p108_h02_identity.js` "structuredClone of one frame is one frame (Astra ID-CLONE)" | UID-less row + its clone (equal epoch+size) -> 1 | equal time/size | `{source:'same'}` x2 equal epoch+size -> 2 |
| 4 | `test_p108_h02_identity.js` "fixed 25 with clones/readbacks" | 10 UID-less rows + 2 clone sets -> 10 | equal time/size | same as #3 |
| 5 | `test_p108_h02_identity.js` "preserved: browser pipeline duplicate ... still folds" | same as #2 | near epoch | rule text; enforced by `test_post_p108_r2_identity.js` negatives |
| 6 | `test_p108_astra_probes.js` core ID-CLONE (auditor probe) | same as #3 | equal time/size | same as #3 |
| 7 | `test_p108_astra_probes.js` D-108-06 pin "WORKER-NULL-MAPPING must stay exactly 1" | that the auditor's probe keeps FAILING with value 1 | camera identity outside an explicit domain; the auditor's expected value 25 now holds | `{source:'same',generation:1}` x2 -> 2 |
| 8 | `test_p108_m05_migration_compat.js` "characterization: legacy 0/0 pair collapses" | two P1-07 worker rows (source, no generation, manufactured media 0) -> 1 | camera identity outside an explicit domain | `{source:'same',generation:1}` x2 -> 2 |

## Is the intent of each assertion still protected?
Yes on the production path, by durable identity instead of metadata inference (Post-P108 R2):
- #1, #3, #4, #6 (ID-CLONE family): every row is stamped with a provenance FrameUID before the R7 writer; readbacks carry it;
  historical rows stored without one get a deterministic read stamp. Proven by `test_post_p108_r2_identity.js`
  (R2-03, R2-04) and the real-Chromium gate `run_post_p108_r2_identity_chromium.cjs` (re-persist adds 0 rows; a
  historical record re-merged from a raw snapshot adds only the new frame).
- #2, #5 (sparse vs worker of one instant): a healthy temporal bundle replaces sparse rows inside the dense window
  (`T.mergeEvidence(... replaceDense)`), so the overlap is removed by window replacement, not by identity. With an
  unhealthy bundle both rows are kept (possible near-duplicate image, never a lost frame).
- #8: the pinned value is a P1-07 data-loss artefact (0/0 manufactured by the old adapter). Keeping two rows is the
  physical truth.
- #7 WORKER-NULL-MAPPING: the auditor expected 25; it is now 25. The pin asserted the old conflict value 1.

## Options
1. **(Recommended) Adopt the Post-P108 H02 rule as authoritative for these 8 assertions.** Convert each to the new
   expectation in place, keep the original assertion text and history in a comment (precedent: D-108-05 flipped a
   characterization when the gap closed), record the decision in DECISION_LOG, rebuild, re-run every gate.
   Effect: mandatory gate can become green on the field class; package can be re-evaluated as a Mac-bench candidate.
   Mac/Swift/camera remain NOT RUN either way.
2. Keep them red (current state). Package can never be promoted; every future build reports the same 5 files.
3. Revert identity to the P1-08 metadata rule. Contradicts the Post-P108 H02 instruction and re-opens the false-merge
   risk (a real frame silently deleted).

## What the owner needs to reply
"D-R2-01 = 1" (or 2 / 3). Nothing else is needed for this decision.

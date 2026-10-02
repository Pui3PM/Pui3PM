# 3PM Analyzer R8 Merge Candidate — Lineage Reconciliation

Date: 2026-10-01
Status: Development candidate only. Not a release build. Not approved for live shooting.

## Why this exists
The prior HV3 architecture audit used R6 HV3 Three-Camera Foundation as its baseline. A later-valid lineage artifact, R7 TransactionRepair, was not included in that baseline. R7 and HV3 are sibling branches from R6 EL18 FormUXRepair. Continuing from HV3 alone would risk losing R7 transaction/persistence repairs.

## Corrected lineage
- Common ancestor: R6 EL18 FormUXRepair
- Primary parent: R7 TransactionRepair
- Selective merge source: R6 HV3 Three-Camera Foundation
- Phase0/P1 rebase: approved pose.js trace-only narrow thaw plus new shadow/test/docs modules

## Three-way inventory
- all same: 153 files
- R7-only changes: 23 files
- HV3-only changes: 30 files
- changed on both / conflict-or-other: 15 files

The most important production merge conflict was `app/static/evidence_budget_core.js`. `index.html`, launcher/runtime-truth wiring, and package/test metadata also required reconciliation.

## Runtime preservation rules applied
1. R7 is the parent. R7-only runtime files remain byte-identical to R7.
2. HV3-only runtime/native files are imported byte-identically where R7 was still identical to EL18.
3. Shared conflicts are manually reconciled; neither branch is copied wholesale over the other.
4. `app.js`, `core_runtime.js`, and both native runtime binaries remain unchanged from the established frozen baseline.
5. `pose.js` differs only by the previously owner-approved trace-only narrow thaw; its dedicated equivalence test passes.

## Evidence budget reconciliation
The merged core preserves:
- R7 strict null handling and reserved contract-witness protection.
- HV3 camera chronology using mediaTime/frameSeq before epoch fallback.
- No epoch-proximity identity rule. The `<=8 ms` dedup path was removed because it demonstrably drops real 240 FPS frames.
- No fabrication to reach 25 frames.

New R8 lineage gate verifies:
- 25 null-identity distinct frames remain 25.
- 25 unique 240 FPS frames remain 25.
- camera chronology survives epoch correction.
- R7 reserved contract witnesses survive the merged selection logic.

## QA status
See `docs/qa/r8_merge_candidate_results.json` and `docs/qa/r8_lineage_manifest.json`.

Current result:
- 103 JS/stress tests discovered.
- 100 pass unmodified.
- 3 fail only at the legacy frozen pose.js SHA gate because the trace-only narrow thaw was explicitly authorized.
- Temporary diagnostic continuations that change only the expected pose hash pass all three tests after the hash gate.
- No unexpected JS regression failures remain.
- Phase01 contract foundation PASS.
- Phase01 clock contract PASS.
- pose narrow-thaw equivalence PASS.
- R8 lineage merge gate PASS.
- Shared C++ ring compile/run PASS.
- Windows non-Windows sentinel compile PASS.
- Swift syntax parse PASS in the current tool environment.
- EL18 equipment catalog remains 683/683 records.

## Known non-release items
- Package/distribution manifest is not promoted for R8 yet.
- Legacy frozen-hash gates intentionally still identify the pose narrow thaw.
- Windows native adapter remains a stub at runtime even though the boundary compiles.
- No real macOS camera acceptance, real Windows native acceptance, or real-archer acceptance has been performed for this candidate.
- The original Astra Audit and Phase0/1 Contract remain useful, but must be reviewed against this corrected R7-parent lineage before further authority/promotion work.

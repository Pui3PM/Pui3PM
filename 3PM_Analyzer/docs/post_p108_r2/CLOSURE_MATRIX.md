# Post-P108 R2 closure matrix (2026-10-05)

| Item | Status | Evidence / remaining gate |
|---|---|---|
| R2-01 fixed-25 repeated a real frame | CLOSED in software | `test_post_p108_r2_identity.js` R2-01 (RED on delivered bytes); `test_p108_h02_identity` "keeps distinct frames that share an epoch" now green |
| R2-02 domain required device id (camera order / re-delivery) | CLOSED in software | R2-02; `test_evidence_integrity_hv2`, `test_r8_lineage_merge`, `test_p108_h01_chronology` green |
| R2-03 random FrameUID per object (re-encode/retry duplicates) | CLOSED in software | R2-03; Chromium R2 gate `rePersist*` (delivered build: 19 -> 25 rows, 19 distinct images) |
| R2-04 historical rows without FrameUID multiplied | CLOSED in software | R2-04; Chromium R2 gate `historical*` (delivered build: 19 rows / 7 distinct images) |
| R2-05 Swift CaptureManager dictionary race (F11 part) | PARTIAL | lock in source, tree-sitter syntax PASS; compile/runtime on macOS NOT RUN |
| H02 identity (Post-P108 rule) | SOFTWARE PASS except D-R2-01 | `test_post_p108_identity.js` 9/9; 7 legacy assertions need owner decision D-R2-01 |
| H03 native lifecycle | PARTIAL (unchanged) | model/source fences PASS; Swift compile/runtime NOT RUN |
| M06 /diag acknowledgement | JS software PASS (unchanged) | `test_post_p108_ack.js` |
| M04 bridge exposure | PARTIAL / OPEN | loopback bind + Origin allow-list + scoped /close re-pinned (`test_p108_m04_bridge_exposure.js`); no authentication |
| M01 high FPS | OPEN (unchanged) | frozen `app.js` sampler; 30 FPS scope only |
| Analyzer End 6 / Impact End 3 | browser PASS (unchanged) | Post-P108 Chromium gate |
| Legacy regression gate | BLOCKED by D-R2-01 | field class 112/117; red files = D-R2-01 only |
| Mac / Windows / field / labeled data | NOT RUN | no target environment |

# Prompt for GPT-6 Astra Medium — R8 P1-06 Repair Re-review

Review only. Do not modify application code in this pass.

Read in order:
1. `PROJECT_STATE.md`, `AGENTS.md`, `docs/QA_CURRENT.md`, `docs/HANDOFF_NEXT_CHAT.md`.
2. `docs/review/astra_p106_original_evidence/R8_P1_06_Astra_Review_TH.md` and all original evidence in that directory.
3. `docs/phase01/repair_p106/CHANGE_LOG.md`, `CLOSURE_MATRIX.md`, `KNOWN_LIMITATIONS.md`.
4. `docs/phase01/TEST_RESULTS_P106_REPAIR.json`, diagnostic continuation results, projector oracle result, and final provenance manifest.
5. Inspect all changed `app/shadow/**` modules and Phase0/P1 tests directly.

Goals:
- Re-run the original RT-01..RT-08 repro logic against the repaired source. Verify red-before / green-after claims without weakening assertions.
- Red-team Node/Browser identity negative parity, clock mapping semantics, replay provenance, RoleRing admission/lease expiry, scheduler worker-dispatch boundary, event log and writer scope/idempotency/deep immutability, logical25 eligibility/tie determinism, Review Anchor proof and Archive path/reference/import validation.
- Check that production legacy authority and Equipment/Athlete/Session were not changed by this repair.
- Check the final provenance manifest against the source ZIP and distinguish source-tree manifest exclusions from external ZIP hash attestation.
- Verify legacy suite status and the three pose hash sentinels; do not accept modified legacy expected hashes as closure.
- Treat actual Chromium, real macOS/Windows camera, persistent IndexedDB durability and real-archer/field accuracy as NOT RUN unless independent evidence in the pack proves otherwise.

Return:
A. Verdict per RT-01..RT-08: CLOSED IN PURE SCOPE / PARTIAL / OPEN, with exact repro evidence.
B. Contract/invariant gap delta after repair.
C. Any new regressions or cross-module contradictions.
D. Whether P1-06 pure/offline foundation can now be considered internally coherent. This is not permission for live shooting.
E. Exact next dependency order, especially durability/P1-07/browser-live prerequisites.
F. GO / CONDITIONAL GO / NO-GO separately for continued pure work, P1-07 standalone native/security tests, browser live shadow, native live shadow, and live shooting.

Do not redesign the architecture unless evidence shows Option 2 is no longer viable. Do not create a release build.

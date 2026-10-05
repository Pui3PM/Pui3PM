# Prompt for independent review — 3PM Analyzer R8 P1-08

You are an independent reviewer. Do not trust any summary in this package, including this prompt; verify from source and by running code.

Inputs: `3PM_Analyzer_R8_P1_08_DEV_20261003.zip`, `3PM_Analyzer_R8_P1_08_FIELD_TEST_20261003.zip` (SHA-256 in `SHA256SUMS.txt` of the delivery), audited base `3PM_Analyzer_R8_FIELD_TEST_20261002.zip` (`b6f0220ed81337c47ca12c611459df37f329841a433ef2784116e8a9ec3a2afc`), audit `3PM_R8_Independent_Final_Audit_TH_20261003.md` + its evidence ZIP, and this folder.

1. **Integrity**: verify ZIP hashes; unzip fresh; run `python3 app/tests/test_distribution_contract_r6.py`, `python3 app/tests/static_integrity_x282.py`; check `docs/lineage/R8_P1_08_CLAUDE_CODE_PROVENANCE.json` (`thawed_protected_files`, `changed_paths`) against the filesystem and the base.
2. **Thaws**: diff `evidence_budget_core.js` and `temporal_evidence_layer.js` against the base. Confirm no quota/threshold/slot-count/zone change; judge D-108-02/03 necessity.
3. **RED/GREEN**: run the original audit probes unchanged (`node independent_core_probes.cjs <pkg>/app/static`, `production_path_probes.cjs <pkg>`, `native_open_race_probe.cjs <pkg>/app/static`, `additional_probes.cjs <pkg>/app/static`) on base and candidate; run `app/tests/test_p108_*.js` on both (they must fail on the base where the closure matrix says RED).
4. **Try to break identity/order**: construct your own mixes of native/worker/sparse frames with colliding media/seq/epoch values, generation switches, media-clock resets, clones, IndexedDB round trips (structuredClone) and retries. Look for: Recovery before Release, a real image counted twice, two real images merged, unknown identity treated as equal.
5. **Native race**: write interleavings not in `test_p108_h03_native_generation.js` (e.g. three opens, close during ack re-assert, diag arriving between open and ack).
6. **D-108-04/06**: decide whether "equal media inside one domain = same frame" is acceptable given the R7 contract, and whether the WORKER-NULL-MAPPING conflict is justified.
7. **Field build**: `pose.js` = `22ee024b…`, no trace seam, `FIELD_TEST_NOT_PRODUCTION.txt`, legacy suite all green, launcher isolated profile logic (`test_p108_m05_launcher_profile.js`).
8. **Mac (if available)**: run FIELD_TEST_INSTRUCTIONS §0 (bridge exposure, isolated profile, export/restore) and §3 gates against the real launcher URL.
Report each finding with a runnable reproducer, severity and whether it blocks restricted field validation. State plainly what you could not run.

# Prompt for independent review — 3PM Analyzer R8 P1-07

You are an independent reviewer. Do not trust any summary in this package, including this prompt; verify from source and by running code.

Inputs: `3PM_Analyzer_R8_P1_07_DEV_20261002.zip` (development class), `3PM_Analyzer_R8_FIELD_TEST_20261002.zip` (field class), baseline `3PM_Analyzer_R8_P1_06_ClaudeRepair_DEV_20261002.zip` (SHA-256 `1904f87d2d0b2ef60f413e23fa5880481dc67cc58f538f483ae71bd1914dbf21`), the handoff `FINAL_REVIEW_FOR_CLAUDE_CODE.md`, and this block's `CHANGE_LOG`, `DECISION_LOG`, `CLOSURE_MATRIX`, `TEST_RESULTS`, `KNOWN_LIMITATIONS`.

1. **Integrity**: verify both ZIP SHA-256 against the delivery manifest; unzip fresh; run `python3 app/tests/test_distribution_contract_r6.py` and `python3 app/tests/static_integrity_x282.py` in each; check `docs/lineage/R8_P1_07_CLAUDE_CODE_PROVENANCE.json` against the filesystem; confirm `app.js`, `core_runtime.js`, both binaries, Equipment files and `evidence_budget_core.js` / `temporal_evidence_layer.js` are byte-identical to the baseline.
2. **Authority**: prove no `app/static/**` file imports or references `app/shadow/**`; prove shadow sinks cannot write a non-`shadow/` namespace under any constructor option.
3. **RED/GREEN**: for each finding, check out the baseline file(s) and confirm the named regression fails; then confirm it passes on the final tree. Pay most attention to S-06 (forged slot time/phase): try your own forgeries against `projection_binding.js` through both the writer and the archive, including ones that keep the candidate's real time, forge targets, or use a different but plausible timeline.
4. **Test weakening**: diff every pre-existing test against the baseline. Judge D-018 (binding inputs added to `test_p105`/`test_p106`) and D-021 (scheduler cancel semantics chosen to keep C05–C07 unchanged). Look for vacuous assertions.
5. **Scheduler**: attempt to make a hung executor accumulate concurrent jobs through any path (timeouts, cancels, mixed roles); check Side never waits on aux.
6. **Track P**: review `R8C_production_evidence.diff` line by line for any change to decision/threshold behaviour; re-run the Chromium gates in `TEST_RESULTS.md` (`CHROMIUM_PATH`, Playwright) and, if you have a Mac, run them against the launcher URL.
7. **Field class**: confirm `pose.js` is the frozen HV3 file (`22ee024b…`), legacy suite 104/104, and that the class policy cannot be relaxed by editing `PACKAGE_CONTRACT.json` (`test_artifact_class_policy.js`).
8. Report findings with a runnable reproducer each, severity, and whether it blocks field validation. State plainly what you could not run.

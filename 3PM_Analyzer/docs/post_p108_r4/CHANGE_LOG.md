# Post-P108 R4 change log (vs R3 commit 8b0760a)

- A `internal/equipment_inputs/OWNER_EQUIPMENT_LIST_20261005.csv` — owner list, verbatim (303 rows)
- A `app/tests/phase01/build_equipment_catalog_el19.py` — reproducible, idempotent EL18 -> EL19 merge
- A `internal/3PM_Equipment_Catalog_CANONICAL_EL19_OWNER_LIST_2026_10_05_R1.json` — 879 records (EL18 JSON unchanged)
- A `internal/3PM_Equipment_Catalog_EL19_MERGE_AUDIT.json` — 303 row decisions, 13 renames, 9 folds, 8 conflicts, 32 anomalies, 12 holds
- M `app/static/equipment_catalog.js` — regenerated (EL19 records, `byId` resolves folded ids, `isVerified`, metadata counts)
- M `app/static/equipment_lab_layer.js` — unverified never auto-fills/locks; "· unverified" labels and reported text (⚠);
  alias/merged-id restore; saved limb name read before restore; limb core once per variant (`limbCoreOf`);
  owner nock/vane/pin picker items show the reported value as text and leave the weight to the coach
- M `app/static/index.html` — cache keys `el19-owner-r1` for the two changed equipment scripts (no markup change)
- A `app/tests/test_equipment_catalog_el19.js`, `app/tests/test_equipment_form_el19.js`
- A `app/tests/p108_browser/run_equipment_form_el19_chromium.cjs`
- M `app/tests/test_equipment_catalog_el7/el8/el9/el11/el15/el17.js`, `test_equipment_form_el18.js` — version check accepts EL19
  (EL17 test: the exact `683` pin became `≥ 683` + `recordCount = records.length`; the exact EL19 pin (879) and per-id
  retention of every EL18 record are asserted in `test_equipment_catalog_el19.js`). No other assertion changed.
- M `app/tests/phase01/build_r8_artifact.py` — D-EL19-01 thaw: new pins, previous pins in THAWED, EL19 files pinned
- M `app/tests/phase01/verify_package_fresh_unzip.py` — registers the EL19 Chromium gate
- M `PACKAGE_CONTRACT.json` — 3 new required test files
- Docs: `docs/post_p108_r4/*`, DECISION_LOG D-EL19-01, root status lines, AGENTS, PROJECT_STATE, HANDOFF item 20,
  README, FIELD_TEST_INSTRUCTIONS; `PACKAGE_ID.txt`, `SHA256SUMS.txt` regenerated.

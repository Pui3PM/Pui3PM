# Post-P108 R3 change log (vs R2 commit 44bb273)

- M `app/tests/test_transaction_r7.js` — D-R2-01: line 56 converted (original kept in comment) + explicit-domain R7 assertion
- M `app/tests/test_evidence_identity_writer_r8c.js` — D-R2-01: pipeline fold check converted + healthy-window replacement check
- M `app/tests/test_p108_h02_identity.js` — D-R2-01: ID-CLONE via shipped writer, fixed-25 clones with stamped rows, pipeline fold converted
- M `app/tests/test_p108_astra_probes.js` — D-R2-01: WORKER-NULL-MAPPING asserted GREEN; verbatim ID-CLONE probe pinned as superseded (2)
- M `app/tests/test_p108_m05_migration_compat.js` — D-R2-01: 0/0 characterization flipped + migration frame-set check
- M `app/tests/phase01/build_post_p108_engineering.py` — `--field-label`, `--field-status-line`
- Docs: `docs/post_p108_r3/*`, `docs/architecture/DECISION_LOG.md` (D-R2-01), `docs/post_p108_r2/OWNER_DECISION_REQUIRED.md`
  (DECIDED), `docs/post_p108_r2/DELIVERY_REPORT.md` (historical header), root status lines, AGENTS, HANDOFF item 19,
  QA_CURRENT, README, FIELD_TEST_INSTRUCTIONS; `PACKAGE_ID.txt`, `SHA256SUMS.txt` regenerated.
- No `app/static`, Swift, launcher or internal-script change.

# Phase 0 writer call graph — HV3 baseline characterization

This file records source-confirmed production evidence writers without changing them.

- `app/static/app.js`
  - `evidenceDbPut(record)` performs whole-record `put` into `3pm-form-analyzer-shot-evidence-v1/shotEvidence`.
  - `evidenceDbMerge(record)` has a per-key promise chain only for callers that use this function, then ends in `evidenceDbPut(merged)`.
  - Recovery paths call `evidenceDbMerge`, but archive import and other paths can call `evidenceDbPut` directly.
- `app/static/native_capture_layer.js`
  - opens the same IndexedDB/store independently.
  - `findRecord` links by role + release epoch within ±400 ms.
  - `collectBundle` reads a record, fetches blobs asynchronously, builds a merged whole record, then calls its own `putRecord`.
  - it does not join `app.js` `evidenceWriteChains`.
- `app/static/temporal_evidence_layer.js`
  - opens the same IndexedDB/store independently.
  - `findRecordForBundle` links by role + release epoch within ±350 ms.
  - `augmentBundle` reads a record and later performs a whole-record `putRecord` after merge.

Therefore the existing per-key merge chain is not a global single-writer boundary. A stale read followed by a whole-record write can overwrite a newer Recovery/metadata update from another path. Phase 0 preserves this as a known production risk; Phase 1 shadow writer will use command-based versioned/idempotent writes in an isolated namespace.

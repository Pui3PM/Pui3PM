# Post-P108 R2 known limitations

- **D-R2-01 open:** 5 regression files (7 assertions) encode the pre-Post-P108 identity rule and stay red by owner
  rule. The package is UNPROMOTED until the owner decides (`OWNER_DECISION_REQUIRED.md`).
- **Not executed here:** Swift compile (both helpers), macOS runtime, Mac browser, camera permission/device switching,
  BLE, Windows, real archer, labeled release/let-down data. Linux/Chromium results with synthetic canvas frames and a
  backend test double are software evidence only.
- **Swift edits are uncompiled.** Post-P108 lifecycle fencing (Codex) and the R2 `tableLock` were checked by reading
  and by tree-sitter-swift (syntax only). A compile failure on the Mac makes the launcher fall back to browser capture
  and print `build_failed` with the compiler line — send that line back.
- **Historical rows:** rows stored without FrameUID get a deterministic read stamp (record key + release + row index).
  Rows already duplicated by older builds are kept as separate rows (no proof to collapse them). A stale snapshot taken
  before the ~1.2 s boot migration rewrites the same old record could still add one retained duplicate (old records
  are not re-written by capture in normal use).
- **Sparse vs worker rows of one instant** are merged only by healthy-bundle window replacement, not by identity; with
  an unhealthy bundle both rows are kept.
- **M-01:** frozen `app.js` sampler keeps 13/25 at 240 FPS; use 30 FPS. **M-04:** no request authentication; any
  local process can command the bridge; loopback bind and Origin allow-list are source facts not yet seen on a Mac.
- `shot_list_ux_layer.js` changed in Post-P108 but its cache key stays `ble43892` (pinned by an original test). The
  Mac-bench package opens a new isolated browser profile, so no stale copy is possible there; with the DEV package on a
  default profile use a hard reload once.

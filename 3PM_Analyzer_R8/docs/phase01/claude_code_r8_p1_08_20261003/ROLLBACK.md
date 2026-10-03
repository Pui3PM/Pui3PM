# ROLLBACK — R8 P1-08 (Claude Code, 2026-10-03)

Never delete the user's sessions, IndexedDB data, traces or uploaded originals. Keep R7 installed alongside; never overwrite it.

## Whole artifact
Each artifact is a standalone folder. Rollback = quit the app, launch the previous folder's `START_3PM.command`. The audited P1-07 build (`3PM_Analyzer_R8_FIELD_TEST_20261002.zip`, `b6f0220e…`) is **blocked** for field use by the independent audit; for field work roll back to R7, not to P1-07.

## Data
- Field class: browser data lives in `~/Library/Application Support/3PM_FieldTest_Profiles/<PACKAGE_ID>` (isolated profile). Rolling back does not touch the normal browser profile. Delete that folder only after exporting what you need.
- If the field build was launched with `THREEPM_USE_DEFAULT_PROFILE=1`, its boot migration re-stamped stored evidence records in the default profile (frame sets preserved, order repaired). A previous build re-stamps them again on its next boot; frames are not lost by either direction (`test_p108_m05_migration_compat.js`).
- Backend data (sessions/shots in the runtime's data folder) is restored from the copy made in FIELD_TEST_INSTRUCTIONS §0.

## Per finding (source, git)
`git revert` in reverse order: `823e155` (M-05 launcher) → `8e6abce` (tests only) → `63ca2dc` (L-01) → `6ce6aeb` (M-03 gate) → `ca72abc` (M-02) → `56451bf` (H-03) → `163b3bb` (H-02 thaw) → `964f032` (H-01/H-02 cores). Reverting `964f032` restores the protected pins `fd7335e8…`/`65aec490…` only together with `163b3bb`; update `PROTECTED` in `build_r8_artifact.py` back from `THAWED`. RED tests from `b0db211` then fail again — the correct signal.

## Pose (class policy)
Field build ships the frozen HV3 `pose.js` (`22ee024b…`); development build ships the trace seam (`fe8cafae…`). Rebuild only through `app/tests/phase01/build_r8_artifact.py`.

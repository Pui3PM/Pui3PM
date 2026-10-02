# ROLLBACK — R8 P1-07 (Claude Code, 2026-10-02)

Never delete the user's sessions, IndexedDB data, traces or uploaded originals during a rollback. Keep the R7 production/field candidate installed alongside; do not overwrite it with either R8 artifact.

## Whole artifact
Keep using the previously installed build, or the baseline `3PM_Analyzer_R8_P1_06_ClaudeRepair_DEV_20261002.zip` (SHA-256 `1904f87d…bf21`). Each artifact is a standalone folder; rollback = launch the previous folder's `START_3PM.command`.

## Per finding (source)
Every finding is one commit (see CHANGE_LOG). In a git checkout of this tree: `git revert <commit>` in reverse dependency order (P-06 → P-05 → P-01..P-04 → Track S bundle → S-13 … S-01 → Q-03 … Q-01). After any shadow revert, rebuild the bundle: `python3 -B app/shadow/browser/build_bundle.py`.

## Track P only (production evidence path)
`patch -p1 -R < docs/review/claude_r8c_20261002/R8C_production_evidence.diff` (copy of the reviewed patch, SHA-256 `bb9310309cd4194e13fc08b0b00b125badd4971482cf11e2e7c7cfcd5eaa8e68`, shipped in the delivery ZIP). Then revert P-05 (closure scripts would turn red, which is the correct signal).

## D-B (pose)
The field build carries the frozen HV3 `pose.js` (`22ee024b…`). To return to the development trace seam, copy `app/static/pose.js` from the development artifact (`fe8cafae…`) and set `PACKAGE_CONTRACT.json` `artifact_class` back to `development_not_release` with `DEV_NOT_RELEASE.txt` (rebuild via `build_r8_artifact.py`).

## Data
- Shadow namespaces are read-only after rollback; nothing in production reads them.
- Archives written with `records.schemaVersion: 2` are rejected by the pre-P1-07 code (unknown `timelines` collection); keep them for re-import after re-upgrading.
- Production evidence records written by the R8C native path are ordinary R7 records merged through `evidenceDbMerge`; the previous build reads them.

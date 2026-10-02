# Phase 0 boundaries

- Production authority: HV3 legacy path only.
- Still frozen: `app/static/app.js`, `app/static/core_runtime.js`, both Analyzer binaries.
- Conditionally thawed: `app/static/pose.js` ONLY for the owner-approved Phase 0 trace seam around inference input/result/metrics.
  - HV3 baseline hash: `22ee024b6365d8aca20cbe2ada6ac713b4ffd1d4cf84e29d79c4643ed2bd014d`
  - P0-06 development hash: `ca544eb05f68e309de2b8c6b0855448b211788230d7820edb651f7c7c4e5cb50`
  - Removing the approved seam/calls must reconstruct the baseline hash byte-for-byte.
  - Forbidden in this thaw: release/let-down logic, thresholds, phase logic, scheduler policy, `inferenceSource`, `detectForVideo` arguments, input raster substitution, production persistence.
- Trace is default-off. When enabled, external callback emission occurs only after legacy `detectForVideo` has returned.
- Direct-video input is explicitly NOT certified as immutable exact-raster; it is reported as blocked for exact-frame parity.
- No production IndexedDB migration.
- No Apple Vision promotion.
- No Windows-native support claim.
- Shadow namespace: `3pm.analyzer.shadow.v1`.
- Equipment/Athlete/Session untouched.
- Original HV3 ZIP remains immutable; all work occurs in a separate development checkout.

# Known legacy failures carried into Phase 0

These are intentionally NOT repaired in the production HV3 path during Phase 0.

- F01: evidence rail MutationObserver can self-trigger from renderer output.
- F02a: `Number(null)` semantics can collapse 25 distinct legacy records to one in `canonicalUnique` when mediaTime/frameSeq are null.
- F02b: epoch-nearness dedup (`<=8 ms`) can remove distinct real samples at 240 FPS.
- F03: `camera_timeline_core.frameTimeMs` can treat `masterTimeMs:null` as known zero instead of falling through honestly.
- F04: multiple independent whole-record evidence writers can perform stale replacement; native/temporal record linkage uses near release epoch rather than durable cycle identity.
- Windows Media Foundation runtime remains unsupported (`E_NOTIMPL`) in this baseline.

The new shadow path must make these cases green without editing legacy behavior merely to improve the test report.

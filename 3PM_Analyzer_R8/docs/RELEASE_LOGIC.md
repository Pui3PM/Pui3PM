> Current provenance correction: see TEST_CONTEXT.md. User clarified yesterday's tests used elastic band. Historical fixture labels do not prove live-bow testing.

# Release logic retained in R6 (implemented in R5)

Base: user-supplied `3PM_Analyzer_Mac_20260929_R4_HandDownGuard(1).zip`.
Status: Field Candidate. This report distinguishes executable regression evidence from physical validation.

## Reproduced defects and changes

| Defect in R4 | Consequence | R5 change |
| --- | --- | --- |
| Collapse veto covered Hold-watch and early current-escape, but not every physical/pre-arm/compact/reset rescue; current-escape stopped checking at 220 ms | Lowering can be rescued into a shot by another path | Store onset arm angle for each candidate and honor measured collapse in all adaptive rescue paths for that witness's lifetime |
| Contradiction was evaluated only at the terminal frame; stronger motion could replace the original angle | Returning the arm or a stronger lowering pulse revives an invalid witness | Retain `bowArmCollapsed`; stop replacement while a contradicted witness remains active; retain existing expiration/reset semantics |
| `Number(null)`, `Number(false)`, and empty strings became zero; missing onset was stored as null and subsequently accepted as numeric | Manufactured face departure, or false arm collapse | Accept finite numbers/non-empty numeric strings only; keep missing coordinates unknown; explicit invalid native channels cannot bypass the weak-evidence guard |
| `Math.abs` removed release motion direction | Forward motion could satisfy strong rearward-current proof | Preserve signs; valid positive accumulated proof still permits real post-release direction reversal |
| Native athlete engine emits its initial confirmation snapshot while pending, so current Side post-validation flags are absent/stale | A validated moderate release can be vetoed once the one-shot completion event fires | Pass actual `inner.latestResults.side` to the overlay; retain independent post-proof for the exact release epoch/event, valid for at most 900 ms. Require >=2 directional steps, the existing native accumulation threshold, elbow accumulation >=.020, no lowering/collapse at validation. Weak field hand-down (.0396/.013 accumulation) does not gain this exception |
| Launcher expected adaptive v13 but R4 contained v14; browser/README still identified R1 | Shipped preflight exits 2 before native startup; version confusion | Match v15, R5 title/launcher/package identity/cache keys; add executable preflight test and trace package identity |

The 7.5-degree threshold is inherited from R4, not newly calibrated from video. It is a heuristic negative cue, not a universal physical definition of release. New proof transport does not replace the frozen detector or loosen its requirement for post-release validation.

## Verification and provenance

- `qa/r4_baseline_reproduction.json`: new tests executed against untouched R4. Release audit passes only 18/36; actual Core -> old Adaptive synthetic pipeline fails on a genuine-release case; original launcher preflight exits 2.
- `app/tests/test_release_audit_r5.js`: 36 directed cases, including four rescue paths with positive/negative controls, rebound/replacement, absent numeric values, signed motion, accumulated proof, and native proof identity/expiry/invalidation/lowering checks.
- `app/tests/test_release_pipeline_r5.js`: actual frozen CoreEngine -> new AdaptiveReleaseCore, 120 randomized genuine-release trajectories with exactly one completion each, 120 let-down trajectories with zero each. Deterministic seed; starts at a primed verified Hold. This is NOT a full Draw-to-Recovery camera test.
- Existing field fixtures, user R4 two-hand-down regression, three-native-shot/one-let-down layer replay, duplicate-capture protection, lifecycle/rearm, tracking-loss, long Hold/follow, evidence/baseline and fixed-25 tests remain in the suite.
- Existing stress includes 400 let-down, 300 genuine-release and 300 tracking-drop synthetic Core cases; these are not 1,000 real-camera samples.
- `app/tests/test_mac_preflight_r5.js` executes the actual launcher prefix through all EXPECTED_* checks, stopping before architecture/runtime/OS calls. Syntax-only launcher checks previously missed the mismatch.
- Version/cache assertions were updated only for intentionally changed metadata. No legacy behavioral assertion was removed or weakened. New failure cases were reproduced before the fixes.
- Full final results: `qa/r7_results.json`. Packaging checks: `qa/r7_distribution_checks.json`. `SHA256SUMS.txt` covers package members except itself.

## Preserved behavior

No edits to frozen core_runtime.js, pose.js, app.js or either native Mac binary. No minimum visible Expansion, Hold timeout or new mandatory athlete cadence. Side remains shot authority; other cameras corroborate. R2 baseline evidence fix, R3 fixed 25-slot Review budget, no fabricated frames, session guard and Equipment EL18 retained.

## Limits and remaining risks

The test harness uses stored/reduced diagnostic fixtures and synthetic geometry, not the user's current physical camera. The two R4 user-ground-truth failures are represented by the supplied test signatures, not complete synchronized video. Camera projection, handedness/mirroring, motion blur, occlusion, low FPS, landmark jitter, equipment and archer variation may change false-positive/false-negative rates. Newly extending the existing collapse rule could reject a real shot whose measured arm drops before validation; this needs video-labeled field assessment.

Legacy minimal native packets without numeric diagnostic channels retain the prior compatibility route; production frozen Core supplies those channels. The final capture transaction layer still enforces shot lifecycle proof. Unknown measurements alone are not positive release evidence.

Native macOS startup beyond preflight, Swift compilation, camera permissions, AVFoundation capture, BLE hardware, live browser rendering and physical release-timestamp error were not tested here. Do not call this Stable/RC or claim zero field errors. Follow the Thai README protocol and compare every labeled release/let-down with Capture Trace and video; count errors and inspect T0 before accepting the build.

## R7 open field defect
Read ROOT_CAUSE_REVIEW_TH.md. One current capture is user-reported false-positive lowering but its shot number is not identified. Foundation disagreement is logged, not force-admitted. Synthetic positives are not physical ground truth. Native cached proof must lose to contradictory pre-commit geometry.

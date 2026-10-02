# Release test provenance and observability

User clarification (2026-09-30): their trials on the previous day used elastic band, with an effort to simulate real release and keep the hand near jaw, face or ear afterward. Earlier assistant statements describing these as real-bow proof were too strong. A genuine RELEASE label can describe release of a band; it does not establish that an arrow was shot. Existing old fixture names are preserved for reproducibility but not treated as independent proof of equipment.

## What can transfer

Band practice can exercise Draw/Anchor/Hold/Expansion, deliberate lowering, repeated cycles and near-face hand movement. It is useful input for classifier robustness. USA Archery recommends stretch bands/string loops for release technique practice; Astra also describes stretch tubing for release training.
Sources: https://www.usarchery.org/resources/adaptive-archery-manual-220319172814.pdf (Release/Follow Through); https://www.astraarchery.com/spt-handbook-pictures

Engineering inference: load, force-displacement curve, finger/string interaction, hand/elbow acceleration and bow reaction need not match live bow + arrow behavior. Keeping the hand close to the face tests a different visual signature from a large outward hand escape. No defensible percentage of accuracy transfer is available from the current material.

## What the code currently covers

Adaptive v16 includes compact/pre-arm and Hold-watch terminal rescue, so large hand-to-face departure is not required on EVERY path. Other paths still use departure thresholds. There is no dedicated calibrated band mode and no direct visual proof of string separation in these body-pose tests.

The new synthetic matrix uses two pre-release phases (Hold, Expansion), small/no face-distance changes (-.02, 0, +.02 normalized units), and positive/negative controls:
- 6 compact cases WITH coherent impulse and reaction: one Capture each.
- 6 lowered-arm counterparts and 6 no-impulse counterparts: zero Capture.
- 6 compact impulse cases WITHOUT enough reaction: remain unconfirmed. These are explicitly a coverage limit, not six successfully detected real releases. A real band release with those features may be missed.
The matrix models landmark channels; it does not show photographed anatomical hand positions or real band behavior.

## What remains unresolved

Tiny release, partial finger relaxation, hand occlusion by face/ear, tracking jitter and gentle band let-down can overlap in available body-pose features. Increasing sensitivity without more evidence can restore false captures. R7 preserves the sensitivity thresholds and adds pre-commit contradictory native-proof rejection. Need labeled video and trace of BOTH band and live bow, including no-release negatives, to quantify false captures, misses, duplicate captures and release T0 error. Consider richer finger/string observations or independent device cues only after validating their actual signal and transport; never use synthetic sensor data as real release proof.

No claim of every possible case handled, zero field error, real-camera acceptance, or live-bow equivalence is made.

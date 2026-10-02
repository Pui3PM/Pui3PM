# Change Log — R8 P1-06 Claude Repair — 2026-10-02

## Primitive / contract hardening
- Reject ill-formed UTF-16 IDs and lone-surrogate FrameUID collisions.
- Harden plain-value clone against `__proto__`, `prototype`, `constructor` keys; deep immutable copies remain the publication boundary.
- Add portable pure SHA-256 and binary/base64/UTF-8 helpers.
- Tighten Observation, EvidenceCandidate, ShotEvent and Projection validators; reject unknown fields and inconsistent identity/time/provenance combinations.

## Replay / clock / identity
- Replay requires explicit role/version/dimensions/mirror/quality/payload metadata; no silent truth defaults.
- Detect frameSeq/sourcePTS discontinuity and FrameUID identity-record conflicts.
- Bind validated clock scale to source timebase and mapping provenance; null source tick remains null.

## Ring / scheduler
- Validate full FrameEnvelope on admission; use master-clock domain only.
- Loud conflict for same FrameUID with different identity/content.
- Add bounded leased bytes, lease TTL, explicit late/pressure drop reasons.
- Scheduler rejects inline function tasks; requires serializable worker descriptor, timeout, stale-generation discard and observer-error containment.

## Event log / writer
- Enforce `shadow/` namespace and scope-qualified query/idempotency keys.
- Writer scope/version/identity/projection cross-checks hardened; failed commands do not mutate stored state.
- Command memo capacity now fails closed instead of evicting idempotency history.

## Projector / review
- Role bindings are mandatory; stale generation is ineligible.
- Tolerance derives from binding capture period + jitter + mapping uncertainty, not candidate spacing.
- Timeline phase proof is projector-owned; Anchor review cannot trust arbitrary candidate strings.
- Same-master-clock timeline is required for verified phase data.
- Matching objective implemented as maximum cardinality, minimum total delta, lexicographic tie-break; brute-force oracle checks 10,000 cases.
- Missing/contributing reasons expanded; projection digests include candidate/timeline/config inputs.

## Archive / browser portability
- Portable path collision policy: NFC, case-fold, Windows reserved/trailing-dot/space/colon/backslash/NUL restrictions.
- Reject unlisted payload keys; validate typed records and frame/candidate/projection references.
- Archive byte hashing/base64 no longer depends on Node crypto/Buffer.
- Browser bundle built from the same shadow module sources; VM test runs with no require/Buffer/process.

## QA truth / packaging
- Phase0 F02 runner now reports budget mitigation separately from upstream legacy OPEN gap.
- Approved pose trace hash is pinned by active gates while reconstruction guard retains frozen-baseline proof.
- `DEV_NOT_RELEASE.txt` is formally part of development package contract.
- Historical 3360 oracle renamed in behavior/output to input-reversal invariance; optimality is checked by new brute-force oracle.

- Legacy hash-sentinel tests were not rebaselined: the original three pose hash expectations remain unchanged and continue to report the approved narrow-thaw as 3 policy failures; reconstruction proof is separate.

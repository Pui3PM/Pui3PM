# ARCHITECTURE STATE — after R8 P1-08 (2026-10-03)

Lineage: EL18 → R7 TransactionRepair parent → selective HV3 merge → R8 (P1-01..P1-07) → P1-08 narrow integration repair. Production shot authority: Legacy Shot Decision only; R8 shadow under `app/shadow/**` is not imported by `app/static/**`.

## Evidence identity and order (new contract)
- **Clock domain** = source pipeline + generation (`FrameIdentityCore.clockDomain`). mediaTime/frameSeq are meaningful only inside a domain. A domain is split into segments when its media clock disagrees with capture epoch by >1 s (stream re-attached) or sequence goes backwards by >5.
- **Physical order** = camera order inside each domain segment (media → seq → epoch), domains merged by capture epoch (k-way merge). Used by temporal, budget and timeline cores and therefore by persisted records, fixed-25 selection, Review slots and boot migration.
- **Identity** (`sameFrame`): FrameUID when both have one → different generations never equal → same-domain media (<0.8 ms) or seq equality (R7 contract) → same Blob object only if ≤8 ms → same-source exact persisted copy (equal epoch + blob size, survives IndexedDB) → browser pipeline duplicate fold (≤8 ms, at least one without UID). Native and browser frames never fold together. Unknown identity is never invented (null stays null).
- **Native frames** carry `generation`, `clockSource` and FrameUID `n1/<role>/<gen>/<seq>/<epoch>`; worker frames `w1/<role>/<source>/<gen>/<seq>/<epoch>` when seq is known.

## Native facade generation authority
Request tokens per role; stale success/error ignored; reopen never sends `/close`; a pending close is awaited by the next open; after `/open` the facade requires `/diag` acknowledgement of its generation (bounded re-assert ×2) and otherwise reports inactive with an error; diagnostics apply only to the issuing token and native-managed roles; bundles are bound at release to origin generation/session and rejected on role/generation mismatch.

## Unchanged / still open
Frozen `app.js` (incl. `evidenceUniqueByEpoch`, M-01), frozen runtime binaries, Swift bridge (M-04), boot migration code (`evidence_budget_layer.js`), decision/threshold modules, Equipment/Athlete/Session.

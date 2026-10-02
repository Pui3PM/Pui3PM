# Core invariants — working index

Normative definitions are in the Implementation Contract. This index is intentionally short:

- Unknown/null is never coerced into known zero.
- Physical frame identity is immutable within run/source/generation/sequence; timestamp proximity is not identity.
- Source/capture time is distinct from arrival/inference/decision/wall time.
- Production has one Shot Decision Owner; shadow has no production commit capability.
- Evidence has one durable writer in the shadow namespace.
- 25 logical slots per active role; real frames are unique, never fabricated/duplicated to fill slots.
- Secondary cameras never block Side authority in Phase 0/1.
- Every backend switch/reconnect creates a new generation; stale generation results cannot mutate current state.
- Mac/Windows share contracts/decision/evidence semantics; platform-specific behavior stays in adapters.
- UI renders snapshots and user intent only; it does not repair/reclassify persistent truth.
- Archive round-trip preserves identity/time/provenance or marks fields unknown honestly.
- Sensor is corroborating evidence, not a unilateral shot-commit authority.
- AI measurement/assessment remains separate from coach conclusion.

# Architecture Authority — 3PM Analyzer Major Refactor

Authority decision: Option 2, staged Major Refactor of Capture → Clock → Frame Identity → Analysis → Shot Decision → Evidence Persistence/Review.

Authoritative planning documents:
1. `PHASE_0_1_IMPLEMENTATION_CONTRACT_v1.md` — normative implementation contract.
2. `ARCHITECTURE_AUDIT_2026-10-01.md` — evidence/rationale and discovered failure modes.
3. `../../AGENTS.md`, `../../PROJECT_STATE.md`, `../QA_CURRENT.md`, `../HANDOFF_NEXT_CHAT.md` — baseline product/release constraints.

Conflict rule: the historical HV3 audit remains immutable evidence, but current development lineage is R7-parent R8. R7 is the rollback/parent policy for transaction and negative-control repairs; no R8 development candidate is production-approved. Phase 0/1 shadow work cannot silently change production authority. The owner-approved pose trace-only seam is the sole current frozen-file exception and does not authorize algorithm changes.

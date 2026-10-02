# R8 P1-06 Claude-Repair Architecture State — 2026-10-02

Status: **PURE/OFFLINE DEVELOPMENT CANDIDATE — NOT FIELD BUILD — NOT PRODUCTION**.

Lineage policy remains `EL18 → R7 parent → selective HV3 merge → R8`. This repair starts from the exact R8 P1-06 Repair DEV artifact reviewed by Claude. No `app/static/**`, Equipment, Athlete, Session, native runtime binary, or production shot-decision source was modified in this work block.

## Authority
- Legacy shot decision remains the only production authority.
- Shadow modules have no production commit authority and require `shadow/` namespaces.
- R8C-18 legacy integration defects are still OPEN because the current owner authorization is pure/offline Phase 0–1 only.

## Pure shadow path now exercised
`Frame contract/identity → clock mapping → replay → role ring → descriptor scheduler → event log → candidate writer → logical25 projector → review → archive`.

Browser portability now has a generated bundle built from the same CommonJS source modules plus pure SHA-256/base64 helpers. A Node VM test executes this bundle without `require`, `Buffer`, or `process`. This is a portability/conformance proof only; actual Chromium remains NOT RUN/BLOCKED in this environment.

## Production blockers deliberately untouched
- F02/M01 upstream temporal legacy dedup in `app/static/temporal_evidence_core.js` (25→1 / 25→13 still characterized).
- F03 null master-time behavior in legacy camera timeline.
- F04/M03 legacy/native writer ownership and stale whole-record path.
- F01/M04 legacy DOM observer/Anchor ownership; actual Chromium repro not closed.

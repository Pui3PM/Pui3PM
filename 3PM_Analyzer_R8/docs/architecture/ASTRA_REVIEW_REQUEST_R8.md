# GPT-6 Astra Medium — R8 Lineage Delta Review Request

Use the attached R8 Merge Candidate source plus the prior Architecture Audit and Phase0+Phase1 Implementation Contract.

Important correction: the prior audit treated R6 HV3 as Source of Truth, but R7 TransactionRepair is a later sibling branch from EL18 and contains transaction/persistence fixes that were not in HV3. The implementer has now rebuilt the candidate with R7 as the primary parent, selectively merged HV3, and rebased the approved Phase0/P1 work.

Do NOT redesign the whole architecture again and do NOT write application code in this review.

Please perform a focused delta audit and answer:

1. Does the corrected lineage strategy (EL18 common ancestor → R7 parent → selective HV3 merge → Phase0/P1 rebase) preserve the intent of Option 2 Major Refactor?
2. Inspect `evidence_budget_core.js` specifically. Does the merge correctly preserve R7 witness/null behavior and HV3 chronology while removing the proven unsafe epoch<=8ms identity rule? Identify any new edge case or semantic regression.
3. Inspect runtime wiring in `index.html`, `internal/start_analyzer.sh`, R7-only runtime files, and HV3-only camera/native files. Flag any hidden ordering, ownership, or cache-key problem.
4. Review `docs/qa/r8_lineage_manifest.json` and `r8_merge_candidate_results.json`. Distinguish true regressions from the three intentionally failing legacy pose hash gates. Challenge any claim that is stronger than the evidence.
5. Reconcile your previous F01–F12 findings against R8. For each finding mark one of: still valid / partially mitigated / fixed in candidate / needs new evidence. Do not assume R7 fixed something unless source/tests support it.
6. Re-check the Phase0/P1 contract against the R7-parent lineage. List exact contract clauses or work-plan steps that must change, if any.
7. Decide whether it is safe to continue from this candidate into P1-02/P1-06 pure shadow work, or whether a specific blocker must be resolved first. This is a go/no-go on continued development only, NOT a production/live-shooting approval.

Return a compact but evidence-based report with:
- Lineage verdict
- Critical merge findings
- F01–F12 delta table
- Contract amendments
- GO / CONDITIONAL GO / NO-GO for P1-02..P1-06
- Exact next actions for the implementer

Do not call R8 production-ready. No real-camera or real-archer validation has been completed for this candidate.

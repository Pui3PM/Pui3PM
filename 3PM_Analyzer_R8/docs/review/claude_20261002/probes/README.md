# Claude independent probes — 3PM R8 P1-06 repair review (2026-10-02)
Review-only. These scripts import the R8 source read-only; they do not modify it.
Run from any directory (Node >= 20):
  node claude_redteam_r8.cjs <path-to>/3PM_Analyzer_R8_P1_06_Repair_DEV/app
  (replay_probe.cjs, tie_probe.cjs, lexi_oracle.cjs, proto_import_probe.cjs use an absolute path at the top: edit it first)
A probe printing defectReproduced=true means the defect exists in the reviewed source.
After repair, each probe should be converted into a permanent red->green regression (assertion inverted), not deleted.

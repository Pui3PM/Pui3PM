# Post-P108 R2 rollback

1. Close the R2 Analyzer (close its Terminal window).
2. Open `START_3PM.command` of the untouched P1-08 folder (or the delivered Post-P108 folder). A Mac-bench/field-class
   package opens Chrome/Edge with its own isolated profile named after `PACKAGE_ID.txt`, so R2 browser evidence stays in
   the R2 profile. A DEV package uses the default browser profile (shared with other DEV builds on the same origin).
3. Do not delete sessions, databases, browser profiles or the older folders. Do not copy files between package folders.
4. Git: the delivered Post-P108 bytes are commit `d6af163` ("Import … as delivered") on branch
   `claude/magical-rubin-bovhje`; R2 is every later commit. `git revert` the R2 commits to return to the delivered bytes.
5. Data written by R2 carries extra `frameUID` fields; older builds ignore unknown fields. Do not point an older build
   with the P1-07 writer at newer data.

---
description: Review the working tree for correctness and missing tests
argument-hint: "[path]"
allowed-tools:
  - Read
  - Grep
  - Bash(git diff)
---

Review the current changes.

1. Read `git diff` and list every behaviour change.
2. For each one, name the test that covers it or say it is uncovered.
3. Report blocking issues first, then nits.

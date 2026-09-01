---
name: am-command-review
description: Review the staged diff against the project working agreements.
x-agentsmesh-kind: command
x-agentsmesh-name: review
x-agentsmesh-allowed-tools:
  - read_files
  - run_terminal_command
---

Review the staged diff.

1. Run `git diff --staged` and read every hunk.
2. Flag any handler that validates inside `src/db` or queries inside `src/routes`.
3. Flag any new `any`.
4. Report findings ordered by severity; say "no findings" when there are none.

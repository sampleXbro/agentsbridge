---
name: am-command-review
description: Review pull-request changes
x-agentsmesh-kind: command
x-agentsmesh-name: review
x-agentsmesh-allowed-tools:
  - Read
  - Grep
  - Bash(git diff)
---

Review pull-request changes for regressions, risky migrations, and missing tests.

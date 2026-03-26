---
agent: agent
description: Review pull request changes
x-agentsmesh-kind: command
x-agentsmesh-name: review
x-agentsmesh-allowed-tools:
  - Read
  - Grep
  - Bash(git diff)
---

Review the current pull request for regressions, risky migrations, and missing tests.

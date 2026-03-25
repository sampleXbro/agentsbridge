---
agent: agent
description: Review pull request changes
x-agentsbridge-kind: command
x-agentsbridge-name: review
x-agentsbridge-allowed-tools:
  - Read
  - Grep
  - Bash(git diff)
---

Review the current pull request for regressions, risky migrations, and missing tests.

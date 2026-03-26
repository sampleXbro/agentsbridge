---
agent: agent
description: Run tests and report results
x-agentsmesh-kind: command
x-agentsmesh-name: test
x-agentsmesh-allowed-tools:
  - Bash(npx vitest)
  - Read
  - Grep
---

Run the project test suite and report:
- Number of passing/failing tests
- Coverage summary
- Any test failures with details
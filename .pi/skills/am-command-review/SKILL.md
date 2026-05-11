---
name: am-command-review
description: Review current changes for code quality and best practices
x-agentsmesh-kind: command
x-agentsmesh-name: review
x-agentsmesh-allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(git diff)
---

Review the current git diff and provide feedback on:
- Code quality and readability
- Potential bugs or edge cases
- Adherence to project conventions
- Test coverage gaps
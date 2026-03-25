---
description: Review current changes for code quality and best practices
x-agentsbridge-kind: command
x-agentsbridge-name: review
x-agentsbridge-allowed-tools:
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
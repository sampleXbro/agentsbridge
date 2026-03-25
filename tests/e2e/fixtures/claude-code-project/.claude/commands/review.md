---
description: Run code review on current changes
allowed-tools: Read, Grep, Glob, Bash(git diff)
---

Run code review on the current branch.

1. Inspect `git diff --stat`, `git diff --cached`, and nearby files for context.
2. List findings by severity with file and line references when possible.
3. Focus on correctness, maintainability, security, and missing tests.
4. End with residual risks if the diff changes behavior or config.

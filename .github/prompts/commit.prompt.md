---
agent: agent
description: Create a conventional commit/s from current changes
x-agentsbridge-kind: command
x-agentsbridge-name: commit
x-agentsbridge-allowed-tools:
  - Read
  - Grep
  - Bash(git status)
  - Bash(git diff)
  - Bash(git add)
  - Bash(git commit)
---

Review the current git changes (staged and unstaged) and:

1. **Analyze changes** — Understand what was modified (files, scope, intent)
2. **Propose a conventional commit message** — Format: `type(scope): message`
   - Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `perf`, `ci`
   - Scope: affected area (e.g. `engine`, `cursor`, `config`)
   - Message: imperative, lowercase, no period
3. **Stage if needed** — Stage relevant files (ask before `git add .` if many files)
4. **Commit** — Run `git commit -m "..."` with the proposed message

If the user requests edits to the message, adjust and re-commit. Do not amend without explicit request.
---
name: am-command-review
description: Review the working tree before opening a pull request.
x-agentsmesh-kind: command
x-agentsmesh-name: review
x-agentsmesh-allowed-tools:
  - Read
  - Grep
---

Review everything `git diff --stat` reports, in this order:

1. Behaviour changes without a matching test.
2. Error paths that swallow a failure instead of surfacing it.
3. New dependencies, and whether a vendored helper would do.

Finish with a go / no-go and the three highest-risk lines.

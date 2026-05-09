---
description: Perform a comprehensive code review of the specified file or diff
argument-hint: [file-path or "staged"]
---

Review the following code or diff for:

1. **Correctness** — logic errors, off-by-ones, unhandled edge cases
2. **Security** — injection risks, improper auth checks, leaked secrets
3. **TypeScript** — missing types, any usage, incorrect inferred types
4. **Performance** — unnecessary re-renders, N+1 queries, memory leaks
5. **Tests** — are there tests? Do they cover the critical paths?

Target: $ARGUMENTS

Provide specific line-level feedback with suggested fixes where applicable.

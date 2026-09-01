---
name: debugging
description: Systematic debugging workflow for production failures and test regressions.
---

# Debugging

1. Reproduce the failure with the smallest possible test case.
2. Read the stack trace top-down and name the first frame you own.
3. Write a failing test that captures the bug before touching the fix.
4. Implement the fix and confirm the new test passes.
5. Re-run the full suite so the fix did not move the problem elsewhere.

See `references/checklist.md` for the pre-merge checks.

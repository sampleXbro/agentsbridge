---
name: debugging
description: Debug failing tests and flaky behavior
---

# Debugging

Start from the failing output and narrow scope before editing code.

Work from reproduction to root cause:

1. Re-run the failing command unchanged.
2. Capture the narrowest input that still fails.
3. Inspect the closest rule, config, or branch that explains the failure.
4. Verify the fix with the exact same command before broadening coverage.

---
description: Testing rules
globs:
  - tests/**/*.ts
  - "**/*.test.ts"
---

# Testing Rules

- Use Vitest.
- Test edge cases and the command output that users actually see.
- Keep one describe block per module unless the behavior clearly splits into scenarios.

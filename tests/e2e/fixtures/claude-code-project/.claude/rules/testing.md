---
description: Test authoring guidance
globs:
  - tests/**/*.ts
  - src/**/*.test.ts
---

# Testing

- Prefer behavior-driven test names that describe the user-visible effect.
- Add one regression assertion for the bug being fixed.
- Use fixture data that looks like production inputs, not toy placeholders.

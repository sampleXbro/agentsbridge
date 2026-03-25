---
description: TypeScript rules
globs:
  - src/**/*.ts
trigger: always_on
---

Use strict mode and avoid `any`.
Prefer `unknown` for external input and narrow before branching on shape.

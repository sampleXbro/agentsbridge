---
description: TypeScript implementation guidance
globs:
  - src/**/*.ts
  - tests/**/*.ts
---

# TypeScript

- Prefer discriminated unions for stateful workflows.
- Use runtime validation for external input.
- Keep async helpers narrow and return typed objects once the shape grows.

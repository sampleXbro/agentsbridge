---
description: Backend implementation guidance
applyTo:
  - src/**/*.ts
  - tests/**/*.ts
---

Prefer pure functions and runtime validation at module boundaries.

- Keep adapters thin and move logic into testable helpers.
- When changing request or response shapes, update the validation schema and tests together.

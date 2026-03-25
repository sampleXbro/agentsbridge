---
description: TypeScript-specific instructions
globs:
  - src/**/*.ts
  - tests/**/*.ts
---

# TypeScript-specific instructions

- No `any` types.
- Use Zod for runtime validation at external boundaries.
- Prefer const assertions and discriminated unions for protocol-like data.

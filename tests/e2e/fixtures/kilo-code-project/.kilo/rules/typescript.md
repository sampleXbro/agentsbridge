---
description: TypeScript standards
globs:
  - src/**/*.ts
  - tests/**/*.ts
---

# TypeScript Rules

- Strict mode is mandatory. Do not loosen the compiler.
- Prefer `unknown` plus narrowing over `any`.
- Use explicit return types on every exported function.
- Prefer `interface` over `type` for object shapes.
- Treat regex capture groups as possibly `undefined` under strict indexed access.

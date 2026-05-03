---
description: TypeScript coding standards
globs:
  - "src/**/*.ts"
  - "tests/**/*.ts"
---

# TypeScript Standards

- Enable strict mode in all TypeScript projects.
- Prefer `unknown` with type narrowing over `any`.
- Add explicit return types on all exported functions.
- Prefer `interface` over `type` for object shapes.
- Treat regex capture groups as possibly `undefined` under strict indexed access.

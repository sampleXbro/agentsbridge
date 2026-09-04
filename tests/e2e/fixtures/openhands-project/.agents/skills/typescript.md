---
description: TypeScript conventions for the billing service
paths:
  - src/**/*.ts
  - test/**/*.ts
---

# TypeScript

- Never use `any`; narrow from `unknown` instead.
- Exported functions declare an explicit return type.
- Prefer `interface` for object shapes and `type` for unions.

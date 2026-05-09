---
always_apply: true
description: Core project guidelines applied to every session
---

# Project Guidelines

This is a TypeScript monorepo using pnpm workspaces. Follow these conventions:

- Use strict TypeScript with explicit return types on all public functions
- Prefer `interface` over `type` for object shapes
- Never use `any` — use `unknown` with narrowing
- All tests use Vitest and must be colocated with source files

## Architecture

The project is structured as:
- `src/` — source code
- `tests/` — integration and e2e tests
- `dist/` — compiled output (never edit directly)

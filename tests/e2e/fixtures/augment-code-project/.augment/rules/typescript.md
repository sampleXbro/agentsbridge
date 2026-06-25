---
type: always_apply
description: TypeScript coding standards for this project
---

# TypeScript Standards

- Enable strict mode in all tsconfig files
- Prefer functional patterns — avoid classes unless the component is stateful
- Use `z.infer<typeof schema>` to derive types from Zod schemas
- Export types from the same file as their implementations

## Naming Conventions

- Files: `kebab-case.ts`
- Interfaces: PascalCase with `I` prefix only for React context providers
- Utility functions: camelCase with verb-first naming (e.g. `buildConfig`, `parseRule`)

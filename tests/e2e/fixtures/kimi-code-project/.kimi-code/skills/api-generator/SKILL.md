---
name: api-generator
description: Scaffolds a versioned REST route, its zod schema, and the matching test file.
---

# API generator

Use this when a task asks for a new endpoint under `/v1`.

## Steps

1. Read [references/route-checklist.md](references/route-checklist.md) and confirm every box applies.
2. Run `scripts/scaffold.ts` with the resource name in kebab-case.
3. Register the router in [src/server/routes.ts](src/server/routes.ts).
4. Write the failing test first, then implement the handler.

## Conventions

- Request and response bodies are validated by zod on both ends.
- Errors return `{ error: { code, message } }`; never leak a stack trace.
- Pagination is cursor based (`?cursor=`, `?limit=`), never offset based.

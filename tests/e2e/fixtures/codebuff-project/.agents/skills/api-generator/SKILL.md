---
name: api-generator
description: Scaffold a new REST route with validation, handler, query and tests.
---

# API generator

Use this skill when a task asks for a new endpoint on the orders service.

## Steps

1. Read `references/route-checklist.md` and confirm every item applies.
2. Add the zod request schema next to the handler in `src/routes`.
3. Add the query builder in `src/db`, never inline SQL in a handler.
4. Write the failing route test first, then implement until it passes.
5. Update `AGENTS.md` only if the layout convention changed.

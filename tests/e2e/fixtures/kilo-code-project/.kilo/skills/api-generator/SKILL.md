---
name: api-generator
description: Generate REST API endpoints following project conventions
---

# API Generator

Use this skill when the user asks for a new REST endpoint or to scaffold a
controller for an existing resource.

## When to use

- New CRUD endpoint on an existing collection.
- Greenfield resource that needs full controller + route wiring.
- Adding a query parameter or pagination wrapper to an existing endpoint.

## Steps

1. Read `references/route-checklist.md` for the per-endpoint contract.
2. Generate the controller stub from `template.ts`.
3. Wire the new route into the router and update the OpenAPI spec.

## Outputs

- Controller file under `src/api/<resource>/`.
- Test stub under `tests/api/<resource>.test.ts`.
- Updated OpenAPI document with the new endpoint.

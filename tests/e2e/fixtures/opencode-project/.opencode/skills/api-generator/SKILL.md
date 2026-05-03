---
name: api-generator
description: Scaffold new REST endpoints or controllers for existing resources
---

## When to use

- New CRUD endpoints for a resource
- Greenfield resource scaffolding
- Adding query parameters or pagination to existing routes

## Steps

1. Read the [route checklist](references/route-checklist.md) for requirements.
2. Generate a controller from [template.ts](template.ts) for the resource name.
3. Wire the route into the router and update the OpenAPI document.

## Outputs

- Controller file under `src/controllers/`
- Test stub under `tests/controllers/`
- Updated OpenAPI document

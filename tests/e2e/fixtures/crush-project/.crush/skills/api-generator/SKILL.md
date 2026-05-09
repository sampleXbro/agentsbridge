---
name: api-generator
description: Generate REST API endpoints with validation and error handling
---

## Purpose

Generate well-structured REST API endpoints following the project's conventions.
Includes request validation, typed response shapes, and consistent error handling.

## Workflow

1. Analyze the endpoint requirements from the user's description
2. Review `references/checklist.md` for quality gates
3. Generate the route handler with input validation
4. Add typed request/response interfaces
5. Include error handling middleware integration
6. Write unit tests alongside the implementation

## Best Practices

- Always validate request bodies against a schema (e.g., zod)
- Return consistent error response shapes: `{ error: string; code: string }`
- Use HTTP status codes correctly (400 for validation, 404 for not found, 500 for unexpected)
- Log errors at the appropriate level (warn for expected, error for unexpected)

---
name: api-generator
description: Generate RESTful API endpoints with validation, error handling, and OpenAPI documentation
---

# API Generator Skill

Use this skill to scaffold complete REST API endpoints following the project's established patterns.

## When to Use

Apply this skill when:
- Adding new resource endpoints (GET, POST, PUT, DELETE)
- Generating CRUD operations for a new data model
- Creating webhook handlers with signature validation

## Process

1. Review the data model or schema in `src/models/`
2. Check existing endpoint patterns in `src/api/`
3. Generate the route handler using the template
4. Add Zod validation schemas for request/response
5. Write unit and integration tests
6. Update OpenAPI spec in `docs/api/`

## References

See [route checklist](references/route-checklist.md) for required fields on each endpoint type.

---
name: api-generator
description: Generate REST API endpoints following project conventions
---

# API Generator

When asked to create an API endpoint:

1. Inspect the closest route, schema, and service modules before creating new files.
2. Use Express router and keep validation at the request boundary.
3. Include Zod validation and typed response payloads.
4. Add structured error handling and one realistic test fixture.
5. Generate the route, test, and any small helper files together.

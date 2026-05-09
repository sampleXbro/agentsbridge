# Route Implementation Checklist

Every REST endpoint must include the following:

## Required

- [ ] Zod schema for request body (POST/PUT)
- [ ] Zod schema for query parameters (GET)
- [ ] Zod schema for path parameters
- [ ] Response type matching OpenAPI spec
- [ ] Error responses: 400 (validation), 401 (auth), 404 (not found), 500 (internal)
- [ ] Unit test covering happy path
- [ ] Unit test covering validation failure
- [ ] Integration test against test database

## Security

- [ ] Auth middleware applied (unless public endpoint)
- [ ] Rate limiting configured in router
- [ ] Input sanitized before DB queries
- [ ] No sensitive data in error messages returned to client

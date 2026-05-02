# Route Checklist

Every new REST route must satisfy:

- [ ] Authentication middleware is applied or explicitly skipped with a comment.
- [ ] Input is validated against a typed schema before reaching the handler.
- [ ] The success response shape matches the existing convention (`{ data, meta }`).
- [ ] Errors use the project's typed error class, not raw `throw new Error(...)`.
- [ ] OpenAPI spec is updated and committed in the same change.
- [ ] Test coverage includes the unhappy paths (auth, validation, not-found).

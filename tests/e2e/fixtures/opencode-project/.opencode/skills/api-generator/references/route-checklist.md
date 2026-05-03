# REST Route Checklist

- [ ] Authentication middleware applied or explicitly skipped with comment
- [ ] Input validated against typed schema before handler
- [ ] Success response matches `{ data, meta }` convention
- [ ] Errors use typed error class, not raw `throw new Error(...)`
- [ ] OpenAPI spec updated and committed in same change
- [ ] Test coverage includes unhappy paths (auth, validation, not-found)

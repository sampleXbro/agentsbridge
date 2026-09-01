# Route checklist

- [ ] Request body validated before it reaches business logic
- [ ] 4xx returned for validation failures, never a 500
- [ ] Query goes through a builder in `src/db`
- [ ] Errors carry a stable machine-readable `code`
- [ ] Happy path and one failure path both covered by tests

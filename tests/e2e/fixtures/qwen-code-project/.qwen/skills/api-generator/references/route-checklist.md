# Route Generation Checklist

- [ ] Route registered in the router with correct HTTP method and path
- [ ] Handler validates input with Zod schema (body, params, query)
- [ ] Response includes accurate HTTP status codes for success and error cases
- [ ] Unit test covers the happy path and at least one validation failure
- [ ] Response schema documented in OpenAPI comment

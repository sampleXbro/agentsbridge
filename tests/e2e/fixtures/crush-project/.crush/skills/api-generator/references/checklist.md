# API Generation Checklist

## Before Generation

- [ ] Confirm the HTTP method and route path
- [ ] Identify all required and optional query/body parameters
- [ ] Determine authentication requirements

## Implementation

- [ ] Input validation schema defined
- [ ] Request handler typed with explicit return type
- [ ] Error cases enumerated and handled
- [ ] Response shape documented in JSDoc

## After Generation

- [ ] Unit tests cover happy path and at least 2 error cases
- [ ] Route is registered in the router module
- [ ] OpenAPI schema updated if applicable

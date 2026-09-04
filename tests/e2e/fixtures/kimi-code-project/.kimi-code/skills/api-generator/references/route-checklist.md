# Route checklist

- [ ] Path is under `/v1` and plural (`/v1/orders`, not `/v1/order`).
- [ ] Request body parsed by a zod schema exported from `src/schemas/`.
- [ ] Auth middleware applied, or an explicit comment saying why the route is public.
- [ ] 404 returns the shared `notFound()` helper rather than a literal object.
- [ ] Happy path, validation failure and auth failure each have a test.
- [ ] OpenAPI snapshot regenerated with `pnpm openapi`.

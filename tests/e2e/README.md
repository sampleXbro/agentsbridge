# E2E Test Status

## Synthetic Fixtures (AI-generated)

All fixtures in `tests/e2e/fixtures/` are SYNTHETIC. They are based on documented tool formats but have NOT been validated against real tool installations.

## Real Export Smoke Lane

`tests/e2e/fixtures-real/` is reserved for human-validated exports captured from real tool installations. The smoke lane in `tests/e2e/real-fixtures-smoke.e2e.test.ts` is wired to use those fixtures when they exist and will skip missing targets rather than pretending synthetic fixtures are validated.

## Action Required (Human)

See `docs/agentsmesh-e2e-human-tasks.md` for fixtures that need replacement with real configs from actual projects.

## Running

```bash
pnpm test:e2e
```

Builds the lib first, then runs all E2E tests with a 30s timeout per test.

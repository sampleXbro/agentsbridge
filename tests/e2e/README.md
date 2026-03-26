# E2E Test Status

## Synthetic Fixtures (AI-generated)

All fixtures in `tests/e2e/fixtures/` are SYNTHETIC. They are based on documented tool formats but have NOT been validated against real tool installations.

## Action Required (Human)

See `docs/agentsmesh-e2e-human-tasks.md` for fixtures that need replacement with real configs from actual projects.

## Running

```bash
pnpm test:e2e
```

Builds the lib first, then runs all E2E tests with a 30s timeout per test.

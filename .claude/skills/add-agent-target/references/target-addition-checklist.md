# Target Addition Checklist

Use this as a concrete audit list when adding a target.

## Research

- Official docs with direct links
- Exact product surface being implemented, distinct from similarly named app/chat products
- Native project file paths
- Legacy or fallback file paths
- Real frontmatter keys and config schema
- MCP/config scope: project file, user config, app settings, remote connector, or unsupported
- Which canonical features are native, embedded, partial, or unsupported

## Code Touchpoints

- `src/config/schema.ts`
- `../../../../src/cli/help.ts`
- `../../../../src/cli/commands/import.ts`
- `../../../../src/cli/commands/init.ts`
- `src/core/matrix.ts`
- `../../../../src/targets/<target>/constants.ts`
- `../../../../src/targets/<target>/generator.ts`
- `../../../../src/targets/<target>/importer.ts`
- `../../../../src/targets/<target>/linter.ts`

## Documentation Touchpoints

- `README.md`
- `docs/agents-folder-structure-research.md`
- `../../../../docs/prd-v2-complete.md` if the architecture contract changes
- Any task or plan doc that tracks support coverage

## Unit Tests

- `../../../../tests/unit/targets/<target>/generator.test.ts`
- `../../../../tests/unit/targets/<target>/importer.test.ts`
- `../../../../tests/unit/core/engine.test.ts` when target wiring changes generation behavior
- `../../../../tests/unit/core/matrix.test.ts` when support levels change
- `../../../../tests/unit/config/schema.test.ts` when target ids change
- `../../../../tests/unit/cli/commands/import.test.ts` and `init.test.ts` when CLI behavior changes

## Integration Tests

- `../../../../tests/integration/import.integration.test.ts`
- `../../../../tests/integration/generate.integration.test.ts`
- `../../../../tests/integration/init.integration.test.ts`

## E2E Tests

- `../../../../tests/e2e/import-capabilities.e2e.test.ts`
- `../../../../tests/e2e/generate-capabilities.e2e.test.ts`
- `../../../../tests/e2e/generate-settings.e2e.test.ts` when settings merge applies
- `../../../../tests/e2e/full-sync.e2e.test.ts` when import is supported
- `../../../../tests/e2e/init.e2e.test.ts` when init detection changes

## Fixture Requirements

- Add `../../../../tests/e2e/fixtures/<target>-project/`
- Include realistic root instructions
- Include scoped rules or equivalent
- Include commands/workflows if supported
- Include agents if supported
- Include skills with supporting files if supported
- Include settings, MCP, hooks, ignore, and legacy/fallback files as applicable
- Keep content realistic enough to hit native-only parser branches

## Edge Cases To Cover

- Missing config produces the correct empty-state message
- Legacy path fallback
- Precedence when both legacy and current formats exist
- Malformed JSON/TOML/frontmatter
- Partial feature translation
- Existing settings merge preservation
- Rich skill directories with nested support files
- Target filtering via `--targets`
- Full round-trip import/generate behavior when import is supported

## Review Questions

- Did you search the internet first, using official docs?
- Did you write failing tests first?
- Did you add rich fixtures instead of placeholders?
- Did you update CLI help, init detection, matrix support, and docs?
- Did you document unsupported features instead of hiding them?
- Did `pnpm test`, `pnpm test:e2e`, `pnpm lint`, and `pnpm typecheck` all pass?

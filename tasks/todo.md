# Target Metadata Registry — Plan

## Goal

Add a `metadata` field to every target descriptor so docs/website can be generated from a single source. Eliminate hardcoded target enumerations in README.md and website pages that already drift behind the catalog (only 13 of 30 targets listed in import docs).

## Approach

1. Extend `TargetDescriptor` with required `metadata: TargetMetadata` (displayName, category, officialUrl, shortDescription).
2. Populate metadata in all 30 target descriptors using existing data from `TARGET_LABELS` and `supported-tools.mdx`.
3. Build `TARGET_REGISTRY` aggregator that surfaces metadata + capabilities per target ID.
4. Extend `scripts/render-support-matrix.ts` with new markers for: import target list, init scan directories.
5. Replace hardcoded enumerations in README.md and website/src/content/docs/cli/import.mdx + quick-start.mdx with marker blocks.
6. Verify with `pnpm matrix:verify`, full test suite, and `pnpm build`.

## File-by-file edits

### `src/targets/catalog/target-descriptor.ts`
- Add `TargetMetadata` interface (displayName, category, officialUrl, shortDescription).
- Add `readonly metadata: TargetMetadata` to `TargetDescriptor`.

### All 30 `src/targets/<id>/index.ts`
- Add `metadata: { ... }` field after `id`.

### `src/core/catalog/registry.ts` (new)
- Export `TARGET_REGISTRY: Record<TargetId, TargetEntry>` built from descriptors.
- `TargetEntry` shape: `{ id, metadata, capabilities, importRoot }`.

### `scripts/render-support-matrix.ts`
- Remove hardcoded `TARGET_LABELS` constant — read from metadata.
- Add new marker blocks for `import-target-list`.
- Refresh README.md import section and website/cli/import.mdx.

### `README.md` line 125
- Replace hardcoded list with marker block.

### `website/src/content/docs/cli/import.mdx` lines 30-44
- Replace hardcoded table with marker block.

### `website/src/content/docs/getting-started/quick-start.mdx` line 86
- Replace hardcoded directory list with generic text + link to supported-tools.

## Risk / scope

- 30 target files need editing — straightforward but volume risk.
- Hardcoded `TARGET_LABELS` removal might cascade if anything else imports it.
- README has prose lists (lines 19, 59, 149, 167-177, 247) that I will NOT replace in this batch — that's a follow-up to avoid scope creep.

## Verification

- `pnpm typecheck` passes
- `pnpm matrix:verify` passes (CI gate)
- `pnpm test` full suite passes
- `pnpm build` succeeds
- Inspect README.md and website pages — generated blocks correct

# Install Compatibility Fixes — TDD Plan

Goal: make `agentsmesh install <source>` work auto-classified against the top community repos that today require workarounds or fail entirely.

## Fix order (smallest blast radius first)

### 1. `{baseDir}` reference placeholder (trailofbits/skills)
- **File**: `src/install/links/scan-relative-links.ts` (and/or `src/core/reference/link-rebaser.ts`)
- **Failing test**: `tests/unit/install/links/scan-relative-links.test.ts` — given content with `{baseDir}/references/foo.md`, scanner should expand `{baseDir}` to the source file's own dir before resolution.
- **Fix**: substitute `{baseDir}` with the source file's parent dir (effectively drop the `{baseDir}/` prefix and treat the remainder as a sibling relative link).

### 2. Root-level SKILL.md (blader/humanizer)
- **Files**: `src/install/classify/layout-types.ts`, `src/install/classify/layout-detect.ts`, `src/install/core/install-discovery.ts`, `src/sources/anthropic-skill-pack/aggregate.ts`
- **Failing test**: `tests/unit/install/classify/layout-detect.test.ts` — fixture with root-level `SKILL.md` (no `skills/` nesting) → detected as a skill source.
- **Fix**: extend layout detection to recognize `<root>/SKILL.md` with valid frontmatter as a "root skill" — treat the entire repo as one skill named after the frontmatter `name` (kebab-cased). Aggregator imports a single skill from `<root>/SKILL.md` + sibling supporting files.

### 3. `.cursorrules` / `.windsurfrules` at root + `rules/*.mdc` auto-detection
- **Files**: `src/install/classify/layout-detect.ts`, plus aggregator wiring
- **Failing tests**:
  - `tests/unit/install/classify/layout-detect.test.ts` — root `.cursorrules` / `.windsurfrules` → flat rules collection.
  - Trace why `rules/*.mdc` (PatrickJS/awesome-cursorrules) auto-classifies in `detectFlatCollections` yet fails downstream.
- **Fix**:
  - Add detection of root-level `.cursorrules` / `.windsurfrules` as a single-rule flat collection.
  - Ensure `mdc` fileShape in `rules/` is dispatched to the rules-import path.

### 4. `.claude-plugin/marketplace.json` (android-reverse-engineering-skill, raptor)
- **Files**: `src/install/classify/layout-detect.ts` (or new `marketplace-manifest.ts`), `src/install/classify/layout-types.ts`
- **Failing test**: `tests/unit/install/classify/layout-detect.test.ts` — fixture with `.claude-plugin/marketplace.json` listing `plugins[].source` paths → produces matching `SubPack[]`.
- **Fix**: when `.claude-plugin/marketplace.json` exists, parse the JSON, treat each `plugins[].source` (relative path) as a sub-pack path. Detect each sub-pack's layout via existing `detectFlatLayout`.

## Verification
- After each fix: targeted unit tests green.
- After all fixes: `pnpm build`, `pnpm lint`, `pnpm typecheck`, full `pnpm test`.
- End-to-end smoke: rerun `agentsmesh install --dry-run` on all 4 previously failing repos.

## Out of scope
- YAML frontmatter parsing in alirezarezvani (single bad file in source repo).
- Basename collision on `--as commands` (edge case, errors cleanly).
- Curated-list repos (travisvn) — README-only, no installable content.

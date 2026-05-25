# Plan — Pack-root README/LICENSE preservation + link validator key fix (C + Tiny A)

## Scope (locked in by user)

1. **Link validator key fix (C)** — recognize copilot's `.agent.md` / `.instructions.md` / `.prompt.md` double-extensions and factory-droid's `droids/` feature dir in `canonicalKeyFromOutputPath`, so broken links in pack-originated outputs correctly downgrade to advisory warnings instead of hard errors.
2. **Pack-root preservation (Tiny A)** — when installing a pack, copy upstream top-level `README*`, `LICENSE*`, `NOTICE*`, `COPYING*`, `COPYRIGHT*` files into the pack root at `.agentsmesh/packs/<name>/`. Honors L270's legal-attribution intent; carries upstream context for the consumer; one file copy in pack writer, no canonical model changes, no per-target descriptor changes.

Explicitly out of scope: emitting README/LICENSE into generated target dirs (`.claude/agents/README.md`, etc.). Broken-link warnings inside agent bodies stay as advisory.

## Files touched

### Step 1: Link validator
- `src/core/reference/validate-generated-markdown-links.ts`
- New/extended: `tests/unit/core/reference/canonical-key-from-output-path.test.ts` (check whether already exists; otherwise create)

### Step 2: Pack-root preservation
- New: `src/install/source/collect-preserved-root.ts` — `collectPreservedRootFiles(contentRoot)` returns top-level preserved-boilerplate files
- `src/install/pack/pack-writer.ts` — accept `preservedRootFiles` arg, copy into pack root before hashing
- `src/install/pack/pack-merge.ts` — accept `preservedRootFiles` arg, copy into pack root (last-write-wins on collision)
- `src/install/run/run-install-pack.ts` — extend `InstallAsPackArgs` with `contentRoot`, collect preserved root files, plumb to writer/merger
- `src/install/run/run-install-execute.ts` — extend `RunInstallExecuteArgs` with `contentRoot`, pass through
- `src/install/run/single-pack-install.ts` — already has `contentRoot`, just thread it through
- New: `tests/unit/install/source/collect-preserved-root.test.ts`
- Extensions: `tests/unit/install/pack-writer.test.ts`, `tests/unit/install/pack-merge.test.ts` if it exists (otherwise covered by writer test + integration)
- New: `tests/integration/install-pack-root-preservation.integration.test.ts`

## TDD plan (test-first per step)

### Step 1 — link validator
1. Write failing tests in `canonical-key-from-output-path.test.ts`:
   - `.github/agents/foo.agent.md` → `agents/foo`
   - `.github/instructions/foo.instructions.md` → `rules/foo`
   - `.github/prompts/foo.prompt.md` → `commands/foo`
   - `.factory/droids/foo.md` → `agents/foo`
   - Existing keys unchanged: `.claude/agents/foo.md` → `agents/foo`, `.kiro/steering/foo.md` → `rules/foo`, `.clinerules/foo.md` → `rules/foo`
2. Implement:
   - `stripMarkdownExt`: extend to peel known double-extensions (`.agent.md`, `.instructions.md`, `.prompt.md`) before falling back to single `.md` / `.mdc` strip
   - `OUTPUT_DIR_TO_FEATURE`: add `droids: 'agents'`
3. Run unit + full link-validator suite.

### Step 2 — preserved root files
1. Write failing tests:
   - `collect-preserved-root.test.ts`: temp dir with README.md, LICENSE, LICENSE-MIT, CHANGELOG.md, foo.md, subdir/README.md → returns exactly README.md + LICENSE + LICENSE-MIT; CHANGELOG/foo/subdir excluded
   - `pack-writer.test.ts` extension: pass `preservedRootFiles: [{relativePath:'README.md', absolutePath: tmp+'/README.md'}, ...]` → assert file exists at `<packDir>/README.md` with matching bytes; assert content_hash differs from baseline-without-preserved-files; assert install-manifest contains the file's sha256
   - Integration: synthesize source dir with `README.md`+`LICENSE`+`agents/foo.md`; run install; assert `.agentsmesh/packs/<name>/{README.md,LICENSE,agents/foo.md}` all present
2. Implement bottom-up:
   - `collect-preserved-root.ts`: readdir contentRoot (top-level only), filter by `isPreservedBoilerplate(name)` AND `dirent.isFile()`, return `{relativePath, absolutePath}[]` sorted
   - `pack-writer.ts`: add optional `preservedRootFiles` to args; iterate after `writeSettings`, before `hashPackContent`; `copyFile` each into the tmpDir
   - `pack-merge.ts`: same — accept arg, copy before `hashPackContent`. Overwrites on re-install (consistent with how the rest of the merge handles same-name files)
   - `run-install-pack.ts`: add `contentRoot` to `InstallAsPackArgs`; call `collectPreservedRootFiles(contentRoot)` once; pass to both `materializePack` and `mergeIntoPack`
   - `run-install-execute.ts`: add `contentRoot` to `RunInstallExecuteArgs`; pass through to `installAsPack`
   - `single-pack-install.ts`: pass `contentRoot` into `executeRunInstallPoolsAndWrite`
3. Run install integration tests (existing + new). Manually re-run the user's broken install to confirm warnings shrink + README/LICENSE land in pack root.

### Step 3 — lesson + verification
1. Add `tasks/lessons.md` entry: "Preserved boilerplate at the upstream source root must travel into the pack root for legal attribution + consumer context; flat-collection per-target emission is intentionally out of scope (treated as advisory link warnings)."
2. Re-run user's original install: `agentsmesh install addyosmani/agent-skills`. Verify:
   - install completes cleanly (no `Generate failed after install` hard error)
   - `.agentsmesh/packs/addyosmani-agent-skills-pack/README.md` + `LICENSE` exist
   - 42 broken-link warnings remain as advisory (acceptable per scope)

## Tracking

- [ ] Step 1 tests written and red
- [ ] Step 1 implementation green
- [ ] Step 2 tests written and red (collect helper, writer, merge, integration)
- [ ] Step 2 implementation green
- [ ] Step 3 lesson + manual verification
- [ ] Full `pnpm test` clean
- [ ] Lint clean

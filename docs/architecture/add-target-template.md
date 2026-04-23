# Add-Target Document Template

**Purpose:** Every PR that adds a new target (project-mode only, global-mode only, or both) **must** open with a copy of this document filled in. It is the checklist, the design note, and the acceptance contract in one file. Store the filled copy as `docs/architecture/targets/<target-id>.md`.

This template assumes the architectural changes in `docs/architecture/review.md` are either shipped or in-flight. Sections marked ⚠️ depend on §3.3 (capability flavors) and §3.4 (`globalSupport` shape) — if those aren't merged yet, fall back to the current descriptor fields and note the TODO.

---

## 1. Target identity

| Field | Value |
| --- | --- |
| Target ID (kebab-case, matches `TARGET_IDS`) | `example-cli` |
| Display name | `Example CLI` |
| Vendor / tool URL | https://… |
| Official docs URL for config | https://… |
| License of target tool | MIT / … |
| Scope(s) introduced in this PR | `project` / `global` / `both` |
| Related targets / prior art | e.g., "Cline: same workflows flavor" |

**Reviewer prompt:** Does this target actually need a new target, or is it a variant of an existing one handled by a capability flavor? If the latter, close this template and open a flavor PR instead.

---

## 2. Research summary

Populate these BEFORE writing any code. Do not infer from existing targets.

### 2.1 Native configuration surface

Paths, file formats, and what each file stores:

| Path (project scope) | Path (global scope) | Format | Purpose |
| --- | --- | --- | --- |
| `.example/rules/*.md` | `~/.example/rules/*.md` | Markdown + YAML frontmatter | Project rules |
| `.example/commands/*.toml` | `~/.example/commands/*.toml` | TOML | Slash commands |
| `.example/mcp.json` | `~/.example/mcp.json` | JSON | MCP servers |
| … | … | … | … |

### 2.2 Feature support matrix

Fill per canonical feature. `level` ∈ `native | embedded | partial | none`. `flavor` is free-form but should match an existing flavor if possible.

| Feature | Project level | Global level | Flavor | Notes |
| --- | --- | --- | --- | --- |
| rules | native | native | standard | `_root.md` maps to `EXAMPLE.md` |
| commands | native | native | workflows | Extension: `.toml`; nested namespaces via `:` |
| agents | embedded | none | projected-skills | Converted via `agent→skill` projection |
| skills | native | native | standard | Dir-per-skill with `SKILL.md` |
| mcp | native | native | settings-embedded | Stored inside `settings.json` |
| hooks | partial | none | gh-actions-lite | Only `PreToolUse`/`PostToolUse`; others lossy |
| ignore | native | native | standard | |
| permissions | none | none | — | Not representable |

### 2.3 Unsupported metadata

List every canonical field that cannot round-trip. For each, decide: silently drop, lint warning, or hard error. Default: **lint warning** (never silent drop; see lesson 87).

| Canonical field | Fate | Diagnostic message |
| --- | --- | --- |
| MCP `description` | Lint warning | "Example CLI drops MCP `description`" |
| Hook `Notification` events | Lint warning | "Example CLI hooks only support Pre/Post ToolUse" |

### 2.4 Conventions and quirks

- Reserved filenames that must be stripped on re-import (e.g., `_ab-*`, hidden files).
- Legacy filenames to accept on import only (never write).
- Case sensitivity, line endings, trailing newline policy.
- Collision rules with other targets sharing a parent directory (e.g., `.gemini/`, `.agents/skills/`).

---

## 3. Architecture decisions

### 3.1 Files and folder

Planned folder layout for `src/targets/example-cli/`:

```
src/targets/example-cli/
├── index.ts              ≤ 120 LOC   descriptor export only
├── constants.ts          ≤ 60  LOC   path constants
├── generator/
│   ├── rules.ts          ≤ 150 LOC
│   ├── commands.ts       ≤ 150 LOC
│   ├── agents.ts
│   ├── skills.ts
│   ├── mcp.ts
│   └── ignore.ts
├── importer/
│   ├── index.ts          ≤ 100 LOC   thin wrapper
│   ├── rules.ts
│   └── skills.ts         (uses shared skill-import-pipeline)
└── linter.ts             optional
```

Reviewer prompt: if any single file will exceed 200 LOC, split it **before** writing.

### 3.2 Descriptor sketch ⚠️

```ts
export const descriptor: TargetDescriptor = {
  id: 'example-cli',
  generators: target,
  capabilities: {
    rules:       { level: 'native',   flavor: 'standard' },
    commands:    { level: 'native',   flavor: 'workflows' },
    agents:      { level: 'embedded', flavor: 'projected-skills' },
    skills:      { level: 'native',   flavor: 'standard' },
    mcp:         { level: 'native',   flavor: 'settings-embedded' },
    hooks:       { level: 'partial',  flavor: 'gh-actions-lite' },
    ignore:      { level: 'native',   flavor: 'standard' },
    permissions: { level: 'none' },
  },
  project: { rootInstructionPath, skillDir, managedOutputs, paths: { rulePath, commandPath, agentPath }, outputs: { … } },
  globalSupport: {                                    // only if scope === 'both' or 'global'
    capabilities: { …overrides vs project… },
    layout:       { rootInstructionPath, rewriteGeneratedPath, mirrorGlobalPath, … },
    detectionPaths: ['~/.example/rules'],
    scopeExtras:  generateExampleGlobalExtras,        // optional
  },
  detectionPaths: ['.example/rules'],
  buildImportPaths: buildExampleImportPaths,
  emptyImportMessage: 'No Example CLI config found under .example/.',
  lintRules: lintExampleRules,
};
```

### 3.3 Reference rewriting

- Does the target share any `.agents/skills/` style artifact with another target? If yes, declare `sharedArtifacts` owner/consumer role.
- Are there multiple output families (e.g., Copilot's `.github/copilot/` + `.github/instructions/`)? List each family and what canonical sources feed it.
- Does the target require an `additionalRootDecorationPaths`-style mirror? If yes, use the `outputs` family model, not ad-hoc decoration paths.

### 3.4 Import normalization

- Does `stripReservedArtifactNames` need a new reserved prefix for this target? If yes, add it to the shared list with a test.
- Does the target have any "compat mode" filenames the importer must accept (old naming) without regenerating? List them.
- Does this importer need the `agent↔skill` projection? If yes, use the shared helper, don't re-implement.

### 3.5 Global-mode specifics ⚠️ (omit if project-only)

- `rewriteGeneratedPath(path)` — list every project prefix this rewrites and the target prefix it produces.
- `mirrorGlobalPath(path, activeTargets)` — what paths are mirrored and which target "owns" the primary path when both are active.
- `scopeExtras` — any file that is generated only in global mode (e.g., Claude output-styles).
- Are any features suppressed in global mode? List them and why.

---

## 4. Canonical examples and fixtures

### 4.1 Fixture plan

New fixtures added in this PR:

| Fixture | Path | Purpose |
| --- | --- | --- |
| `tests/e2e/fixtures/example-cli-project/` | Full tool-native project | Round-trip import baseline |
| `tests/e2e/fixtures/example-cli-global/`   | `~`-layout snapshot     | Global-mode import baseline |

Fixtures must be **realistic** (lesson 68): copied/adapted from real tool output, not minimal synthetic placeholders. Include: nested skill, multi-rule root, at least one unsupported-metadata case, one legacy filename.

### 4.2 Contract entry

Add one entry to `tests/e2e/helpers/target-contracts.ts` (or its replacement, per §3.10 of the review):

```ts
'example-cli': {
  generated: {
    project: [/* exact paths, sorted */],
    global:  [/* exact paths, sorted */],
  },
  imported: [/* exact canonical paths produced by import, sorted */],
  droppedFields: ['mcp.description', 'hooks.Notification'],
},
```

**Strict** — no "at least N" or "some starts with", per lesson 83.

---

## 5. Test plan

All layers are mandatory; see `docs/architecture/testing-strategy.md` for the full doctrine.

### 5.1 Unit (≤ 2 files unique to this target)

- `src/targets/example-cli/index.test.ts` — only for target-unique behavior the contract matrix can't express (e.g., custom TOML encoder).
- `src/targets/example-cli/linter.test.ts` — if lintRules is non-null.

Everything else is covered by the parametrized matrix.

### 5.2 Contract matrix

`TARGET_IDS` adds `example-cli`; the matrix test picks up automatically. Verify:
- `generate --project` produces the exact `contracts.generated.project` file set.
- `generate --global` produces the exact `contracts.generated.global` file set (if applicable).
- `import --from example-cli` produces the exact `contracts.imported` canonical set.
- Roundtrip: canonical → generate → import → canonical byte-equal for representable fields, linter-warned for dropped fields.

### 5.3 Integration

- One `tests/integration/import-example-cli.integration.test.ts` — real `execSync` against `dist/cli.js`.
- One `tests/integration/generate-example-cli.integration.test.ts`.

### 5.4 E2E

- The contract matrix tests automatically exercise e2e through the matrix harness. No extra per-target e2e file unless this target has **unique** behavior.

### 5.5 Reference-rewrite coverage

Add a fixture containing a realistic canonical rule that references `.agentsmesh/skills/<name>/` and a nested script inside a skill's `references/`. Assert that the **generated** target file:
- Contains no `.agentsmesh/` path token (generated-side rewrite).
- Contains the exact target-relative path the rewriter produces (including `./` prefix for same-directory descendants per lesson 9).

On `import`, assert the canonical output contains `.agentsmesh/...` paths again.

### 5.6 Lint and diagnostics

For every "lossy" feature declared in §2.3, add a failing lint test and the expected message. Re-running lint after canonical cleanup must return zero diagnostics.

### 5.7 Edge cases (checklist)

- Missing config directory → `emptyImportMessage` printed, exit 0.
- Malformed config file → lint error, exit 1, no partial generation.
- Legacy filename present → importer reads it; generator writes new filename; stale cleanup removes old file.
- Re-import over existing canonical → unsupported metadata preserved (lesson 88).
- Collision with sibling target sharing a parent dir → either deduplicated (same content) or clean error with both target names.

---

## 6. Docs and matrix sync

Per review §3.5, matrix is codegen. You must still:

- [ ] Run `pnpm matrix:generate` (once shipped) and commit the regenerated README block.
- [ ] Update `website/src/content/docs/reference/supported-tools.mdx` via its generator.
- [ ] Add a one-paragraph "What this target does" entry to `docs/agent-structures/<target-id>.md`.
- [ ] If global mode: add `<target-id>-global-level-generation-strategy.md` documenting exact paths (already the repo convention).
- [ ] Add `<target-id>` to the install-detection help text (generated from descriptor — should need no manual edit once §3.7 ships).

---

## 7. Release and migration notes

- [ ] Version bump: minor (new target).
- [ ] Changeset with user-facing summary ("adds Example CLI support").
- [ ] Migration guide: none (new target).
- [ ] Deprecations: none.

---

## 8. Acceptance gates

A PR passes review only when all of the following hold. This section is **copy-pasted into the PR description** verbatim.

- [ ] All code and tests follow §3 file size budgets (≤200 LOC).
- [ ] No target-id string literal appears outside `src/targets/example-cli/` or the catalog.
- [ ] Contract matrix entry present and strict; suite green.
- [ ] Integration tests green after `pnpm build`.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`, `pnpm test:e2e` — all green.
- [ ] `pnpm matrix:verify` green (README + website matrices in sync with code).
- [ ] Every unsupported canonical field has a lint warning and a test.
- [ ] Reference-rewrite round trip asserted both directions.
- [ ] Realistic fixtures (at least one nested skill, at least one legacy filename, at least one unsupported-metadata sample).
- [ ] If global mode: every item in the global-mode sub-checklist (§5 in the review) is checked.
- [ ] Lessons log updated if any surprise or correction happened during the work (repo convention).

---

## 9. Reviewer's "smell" checklist

Use this during review. If any answer is "yes", request changes.

1. Are there any new `if (target === 'example-cli')` branches in `src/core/*`? **Must be zero.**
2. Are there any new `*-skills-helpers.ts` files? **Must be zero** — use the shared pipeline.
3. Does the descriptor declare all 8 canonical features (even if `level: 'none'`)? **Must.**
4. Are generator files under 200 LOC each?
5. Are test assertions strict (exact paths, exact counts) or loose (`some(...)`, prefix-only)?
6. Are README and website matrices regenerated (not hand-edited)?
7. Is there a realistic fixture, or is it a synthetic placeholder?
8. Does the `emptyImportMessage` point users to the real config location they expect?
9. Does adding this target change `dist/cli.js` size by more than ~5 KB? If yes, inspect for accidental re-imports.
10. Was the lessons log updated for any correction encountered during implementation?

# Capability Update Checklist

Use this when raising one capability on one existing target. Work one (target, feature, scope) at a time.

## 0. Verify the claim (before research, before code)

Confirm, from the tool's **own** docs/source, that the surface exists in the claimed shape at the claimed scope. Reject — and record why — when you hit any of these (each happened repeatedly in real audits):

| Reject reason | What it looks like | Correct action |
|---|---|---|
| **Fabricated** | Claimed file/key the tool never reads (no primary source) | Reject; leave the level as-is |
| **Already-correct** | Current code already does the right thing; the claim is stale | Reject; no change |
| **Wrong scope** | Claimed "both scopes" but the tool reads it only globally (personal/CLI) — or vice versa | Implement only the real scope; keep the other `none` |
| **GUI/cloud-only** | Tool supports the feature but only via a UI/web settings panel, no writable file | `partial` (no-op stub + lint warning), not `native` |
| **Conflicts existing behavior** | Changing the path would break a deliberate shared-path or namespacing choice | Reject; confirm the existing choice was intentional |

Sources, in order of trust: the tool's official docs → its open-source repo/config schema → vendor examples (flag as non-official). **Never** trust the audit row, our own code comments, the README, or memory — those are what produce wrong claims. A rejection with a one-line reason is a complete result.

## 1. Research (resolve before coding)

Once the claim survives §0, capture from primary sources:

- Exact file path the tool reads for this feature, project scope.
- Exact file path, global scope (often different, e.g. `~/.config/<tool>/...`). May not exist.
- Exact serialization: JSON / YAML / Markdown + frontmatter.
- Exact top-level key (`mcpServers` vs `servers` vs `extensions` vs `context_servers` — these differ per tool).
- Whether the tool reads this from a dedicated file (→ `native`), folds it into another file (→ `embedded`), or only manages it in its GUI/settings UI (→ `partial`).
- Whether importing the tool's file back to canonical is meaningful and lossless.

If any item is unknown, stop and resolve it. Do not infer from old fixtures, the README, or memory.

## 2. Capability Level Decision Matrix

| Level | Meaning | Descriptor requirements |
|---|---|---|
| `native` | Tool reads a dedicated file/key agentsmesh fully owns | Generator (or `emitScopedSettings`) **+ importer** (round-trip) + `managedOutputs` entry + `rewriteGeneratedPath` for global |
| `embedded` | Feature folded into another emitted file (e.g. additional rules in the root file) | Emission inside the owning generator; usually no separate file |
| `partial` | Tool supports it, but only via UI / managed settings agentsmesh cannot write | No-op `generateX` returning `[]` **+** `lint.<feature>` warning pointing at the UI |
| `none` | Tool has no support | Nothing; optionally a lint warning if canonical content would be silently dropped |

Set `capabilities` (project) and `globalSupport.capabilities` (global) **independently**. They commonly differ.

## 3. Emission Mechanism Decision

| Situation | Use |
|---|---|
| Feature has its own dedicated file (both scopes, or scope-gated via `ctx`) | A `generateX(canonical, ctx?)` generator returning `[{ path, content }]`; scope-gate via `ctx?.scope` |
| Feature is **global-only** (`native` global, `none` project) and settings-backed | `globalSupport.scopeExtras(canonical, projectRoot, scope, enabledFeatures)`, gated on `scope === 'global'` — **not** a plain `generateX` |
| Multiple features share ONE settings file, written as ONE combined object | `emitScopedSettings(canonical, scope, enabledFeatures)` returning a single output; gate each key on `enabledFeatures.has(...)` (and on `scope` for global-only keys like Augment `toolPermissions`) |
| Multiple SEPARATE writes land on the same file in one pass | Each generator/emitter writes its own key, **plus** `mergeGeneratedOutputContent` that overlays keys using base `pending?.content ?? existing` |
| Settings file must preserve unrelated user keys | `mergeGeneratedOutputContent` overlaying only the keys you own; parse-failure falls back safely |

**Why global-only must use `scopeExtras`:** the permissions/settings feature loop calls `gen(canonical)` *without* a scope, and `resolveTargetFeatureGenerator` returns the generator regardless of capability level — so a plain `generatePermissions`/`generateX` runs in **both** scopes and leaks the file into project scope. `scopeExtras` and `emitScopedSettings` both receive the scope; the descriptor schema accepts either (and `scopeExtras`) as the implementation of a settings-backed global capability. The `mcp`/`hooks` generators *do* receive `ctx`, so they can scope-gate normally. Examples: Continue (`~/.continue/permissions.yaml`), Goose (`~/.config/goose/permission.yaml`) both emit via `scopeExtras`.

## 4. Round-Trip Symmetry (the #1 trap)

For every level raised to `native`:

- [ ] Generator emits the tool's file.
- [ ] Importer reads it back: descriptor `importer` block (`mode: 'singleFile' | 'directory' | 'flatFile' | 'mcpJson'`) or a custom `map` / `importFrom`.
- [ ] If the tool's key differs from canonical (e.g. `servers`, `extensions`), use a data-driven option (`mcpServersKey`) or a custom mapper — never hardcode in core.
- [ ] A test asserts generate → import yields the original canonical content (within format limits; note any unpreservable field).
- [ ] Contract `imported` array includes the canonical destination (project scope). Global-only features are tested via explicit `scope: 'global'` instead.

Cross-check: list every target with this feature `native` and confirm none are generate-only. `grep -rln "feature: 'mcp'"` (or the relevant feature) vs the targets declaring it native.

## 5. Settings-Merge Discipline

- The engine default merge already uses `pending?.content ?? existing` and resolves the descriptor plugin-safely. Custom mergers must match.
- Multi-write target → base MUST be `pending?.content ?? existing`. Using only `existing` drops earlier in-memory keys.
- Single combined-write target → `_pending` is intentionally unused; leave it.
- Always overlay only your keys; preserve unrelated keys; fall back safely on parse failure.

## 6. Plugin Safety

- Engine resolves hooks via `getBuiltinTargetDefinition(id) ?? getDescriptor(id)` — plugin descriptors get them too.
- Using an existing hook (generator, `emitScopedSettings`, `mergeGeneratedOutputContent`, `postProcessHookOutputs`) → no fixture change.
- Changing a hook *contract* (new field/hook on the descriptor or import spec) → update `tests/fixtures/plugins/rich-plugin/index.js` to exercise it and add a registered-plugin-descriptor test.

## 7. File-Size Discipline (≤ 200 lines)

Extract as the existing targets do:

- `capabilities.ts` — `projectCapabilities` / `globalCapabilities`
- `importer-spec.ts` — the `importer` block
- `layout.ts` — `project` / `globalLayout`
- `merge.ts` / `settings.ts` — merge + settings builders
- mappers — `import-mappers.ts`, `<feature>-import.ts`

`wc -l` every changed/new file after wiring.

## 8. Tests You Must Add (write first)

- Generator/emitter: `null` input → `[]`; empty input → `[]`; valid → correct path + parseable content + correct key.
- Permissions: cover allow-only, deny-only, and ask-only independently.
- Hooks: cover empty-command / empty-result → `[]`.
- Contract: exact `generated` and `imported` path arrays (strict — no `some(...)`, no prefix-only).
- Global layout: capability assertions per scope; `rewriteGeneratedPath` mapping; managedOutputs.
- Round-trip: generate → import equality.

## 9. References + Docs

- New ref-bearing generated dir → add to `src/core/reference/import-maps/<target>.ts` (forward + reverse), confirm prose-vs-link classifier holds.
- `pnpm schemas:generate && pnpm matrix:generate`.
- Sync `README.md` matrix and `website/src/content/docs/reference/supported-tools.mdx` (single per-target page). Map: `native`→Native, `embedded`→Embedded, `partial`→Partial, `none`→—. A **global-only** level change still moves the rendered matrix (`SUPPORT_MATRIX_GLOBAL`) — regenerate both docs. `pnpm matrix:generate` also refreshes other generated tool-list docs (e.g. `cli/import.mdx`, `index.mdx`) from descriptor metadata — stage those too.

## 9b. Format / Path-Change Blast Radius (grep before you claim done)

A new generated file, a changed output path/key/shape, or a projection→native move (e.g. commands moving from `.x/skills/am-command-*` to a native `.x/commands/`) ripples far beyond the descriptor. Update every site **in the same change**, then `grep -rn '<old-path-or-shape>' tests/ src/` to prove nothing references the old form:

- **Contract** `tests/contract/contracts/<id>.ts` — both `generated[]` and `imported[]` arrays (keep them sorted; a new file slots in by sort order).
- **e2e exclusion sets** in `tests/e2e/target-contract-matrix.e2e.test.ts` — `TARGETS_WITHOUT_AGENT_OUTPUT`, `TARGETS_WITH_PROJECTED_AGENTS`, `TARGETS_WITH_PROJECTED_COMMANDS`, `TARGETS_WITHOUT_SKILL_OUTPUT`. Removing a target from a projected-* set makes the generate test assert the **native** body carries cross-refs — make sure it does.
- **Both** ternary chains in `tests/e2e/helpers/reference-targets.ts` — `outputPaths()` **and** `expectedRefs()`. The matrix test reads `expectedRefs(target).command`; editing only `outputPaths` fails with "expected <new body> to contain <old tail>".
- **Per-target `dirTreeExactly`** in `tests/e2e/generate-capabilities.e2e.test.ts` — a new generated file must be added here *as well as* the contract `generated[]` (two separate exact-set assertions; the contract round-trips in-process, this one spawns the built CLI).
- **Layout/managed-outputs** tests: `tests/unit/targets/<id>/global-layout.test.ts` and/or `tests/unit/targets/layout-metadata.test.ts` — exact `managedOutputs.dirs/files`, `rewriteGeneratedPath` mappings, `commandPath`/`agentPath` resolvers, `supportsConversion`.
- **Matrix** `tests/unit/core/matrix.test.ts` — per-target/feature level assertions (add one for the new level, both scopes if relevant).
- **Reference import-map** `src/core/reference/import-maps/<id>.ts` — add any new ref-bearing dir (both scopes) or import round-trip reference-rewrite tests fail even when generator/importer are correct.

When migrating projection→native: switch `commandPath`/`agentPath`, add the descriptor `importer` spec (directory mode, `preset: 'command'|'agent'`), **remove** the now-stale `supportsConversion.<feature>`, and drop the dead projection helper import. Old projected files are auto-cleaned on regenerate because they live under `managedOutputs`.

## 10. Two-Stage Review (read-only Explore subagents)

Stage A — spec compliance:

- Matches the researched path/format/key?
- Correct level per scope?
- Round-trip present and symmetric?
- Contract + global-layout tests updated?

Stage B — code quality:

- No `any`; explicit return types; helper reuse.
- ≤ 200 lines per file.
- No target-name branch in shared/core.
- Merge base correct for the write pattern.

Fix and re-review until both pass. Do not start Stage B before Stage A is clean.

## 11. Double-Check (cross-cutting, do explicitly)

- Round-trip symmetry: no `native` feature is generate-only.
- Settings-merge base: `pending?.content ?? existing` for multi-write; untouched for single-write.
- Plugin safety: rich-plugin fixture updated only if a hook contract changed.
- Matrix agreement: descriptor ⇔ `pnpm matrix:verify` ⇔ README ⇔ website all consistent.

Beware false positives: a merger ignoring `_pending` is correct when the target emits a single combined write. Verify reachability (how many writes hit the file in one pass) before changing it.

## 12. Final Verification

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build` — run this **before** any e2e/round-trip. The e2e matrix spawns the built `dist/cli.js`; a stale dist shows up as the in-process contract passing while the e2e fails on a missing/extra/relocated file. Rebuild, don't chase the importer.
- `pnpm test`
- `pnpm matrix:verify`

Then add the changeset — `minor` for a level raise, `patch` for a same-level fix that makes a broken `native` functional — and run `post-feature-qa`. Before committing, `git checkout -- tests/e2e/agents-last-run.md` if a test run rewrote it.

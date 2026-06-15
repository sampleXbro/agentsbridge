# Capability Update Checklist

Use this when raising one capability on one existing target. Work one (target, feature, scope) at a time.

## 1. Research (resolve before coding)

Capture from primary sources (official docs/changelog, then vendor examples — flag if non-official):

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
| Feature has its own dedicated file | A `generateX(canonical, ctx?)` generator returning `[{ path, content }]` |
| Multiple features share ONE settings file, written as ONE combined object | `emitScopedSettings(canonical, scope, enabledFeatures)` returning a single output; gate each key on `enabledFeatures.has(...)` |
| Multiple SEPARATE writes land on the same file in one pass | Each generator/emitter writes its own key, **plus** `mergeGeneratedOutputContent` that overlays keys using base `pending?.content ?? existing` |
| Settings file must preserve unrelated user keys | `mergeGeneratedOutputContent` overlaying only the keys you own; parse-failure falls back safely |

Scope-gate generators that only apply to one scope: check `ctx?.scope` and return `[]` for the wrong scope.

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
- Sync `README.md` matrix and `website/src/content/docs/reference/supported-tools.mdx` (single per-target page). Map: `native`→Native, `embedded`→Embedded, `partial`→Partial, `none`→—.

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
- `pnpm test`
- `pnpm matrix:verify`
- `pnpm build`

Then add a `minor` changeset and run `post-feature-qa`.

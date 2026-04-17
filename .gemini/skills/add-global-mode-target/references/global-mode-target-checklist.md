# Global Mode Target Checklist

Use this checklist when implementing global mode for a single target.

## 1. Contract Extraction From The Target Doc

Capture these before touching code:

- Native global root path
- Root instruction file path, if any
- Non-root rule directory/file pattern
- Commands path/pattern
- Agents path/pattern
- Skills path/pattern
- MCP path/pattern
- Hooks path/pattern
- Ignore path/pattern
- Permissions path/pattern
- Legacy/fallback global paths
- Features that are GUI-only or not file-backed
- Whether import from global files is meaningful
- Whether links inside emitted markdown should point within the global footprint

If any item is unknown, stop and resolve it from the doc or official source instead of guessing.

## 2. Architecture Preflight

Before implementing the target:

- Confirm the repo already has shared global-mode foundation for:
  - scope-aware config/canonical loading
  - scope-aware generation roots
  - scope-aware reference rewriting
  - scope-aware import normalization
  - scope-aware command surfaces for `init`, `install`, `generate`, `import`, `diff`, `lint`, `watch`, `check`, `merge`, and `matrix`
- Confirm the target already has `descriptor.project`
- Confirm the target can express the global layout through descriptor metadata

If the shared foundation is missing, stop and handle that separately. This skill is for the per-target pass, not the first global-mode architecture pass.

## 3. Code Touchpoints

### Target-local

- `../../../../src/targets/<target>/index.ts`
  - add or update `descriptor.global`
  - define `rootInstructionPath`, `skillDir`, `managedOutputs`, and `paths`
- `../../../../src/targets/<target>/constants.ts`
  - add global-path constants if the target module needs explicit names
- `../../../../src/targets/<target>/generator.ts`
  - only if global mode changes feature emission shape, not just root location
- `../../../../src/targets/<target>/importer.ts`
  - only if import from global paths is supported

### Shared, only if required

- `../../../../src/targets/catalog/builtin-targets.ts`
- `../../../../src/core/reference/map-targets.ts`
- `../../../../src/core/reference/map.ts`
- `../../../../src/core/reference/rewriter.ts`
- `../../../../src/core/reference/output-source-map.ts`
- `../../../../src/core/reference/import-rewriter.ts`
- `../../../../src/core/reference/import-map-builders.ts`
- `../../../../src/core/generate/stale-cleanup.ts`
- CLI global-scope flows if the target participates in command-specific handling
  - prove the target works through the existing `--global` flows instead of adding target-specific CLI branches unless unavoidable

## 4. Tests You Must Add Or Update

### Descriptor metadata

- `descriptor.global` exists for supported targets
- `descriptor.global` is absent for unsupported targets
- root instruction path is correct
- global managed outputs are correct
- global skill dir is correct, if applicable

### Generation

- generated paths land in the target's native global locations
- unsupported global features are skipped or warned explicitly
- root and non-root rule outputs match the doc
- command/agent/skill paths match the doc
- `agentsmesh generate --global` works for the target
- `agentsmesh diff --global`, `lint --global`, and `matrix --global` reflect the target correctly when applicable

### Import

If the target supports importing from global files:

- import reads from the native global location
- imported files normalize back to canonical paths correctly
- legacy/fallback global paths are handled if documented
- `agentsmesh import --global --from <target>` works end to end

### Reference rewriting

If the target emits markdown-like files in global mode:

- canonical links to rules/commands/skills/agents rewrite to global target-relative paths
- supporting-file links for skills rewrite correctly
- import rewrites those links back to canonical form

### Stale cleanup

- stale agentsmesh-managed files inside the target's global footprint are removed
- expected files are preserved
- unrelated user files are preserved

### Install / maintenance flows

If the target supports global generation from installed packs:

- `agentsmesh install --global <source>` materializes packs into `~../../../../.agentsmesh/packs/`
- `agentsmesh install --global --sync` replays `~../../../../.agentsmesh/installs.yaml`
- `agentsmesh watch --global` regenerates the target from `~../../../../.agentsmesh/`
- `agentsmesh check --global` and `merge --global` keep the home lock flow healthy

## 5. Review Questions

Ask these before calling the work done:

- Did I encode the target's global layout in descriptor metadata rather than another hardcoded shared table?
- Did I preserve existing project-mode behavior?
- Did I avoid assuming that project root files map directly to user-home files?
- Did I verify links, not just file locations?
- Did I test unsupported or partial global support explicitly?
- Did I prove the existing `--global` command surface still works for this target instead of only testing generator internals?
- Did I update user-facing docs where support status changed?

## 6. Required Final Verification

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

Recommended while iterating:

- targeted unit tests for `../../../../src/targets/<target>/...`
- targeted integration tests for affected CLI/global-scope flows
- targeted e2e tests when the target has realistic fixture coverage

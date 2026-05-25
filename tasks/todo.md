# Security fixes — implementation plan

## Scope
Three HIGH + two MEDIUM findings from the security audit. TDD throughout — failing test first.

## Fix 1 — Plugin source containment (HIGH)

**File:** `src/plugins/load-plugin.ts`
**Risk:** Any actor who writes `agentsmesh.yaml` can trigger arbitrary code execution via `plugins[].source: "../../tmp/evil.js"`.
**Change:** After resolving a local plugin source, assert the resolved absolute path stays under `projectRoot`. Reject otherwise. Bare npm specifiers continue to resolve through `node_modules/<source>`.
**Tests:** `tests/unit/plugins/load-plugin-containment.test.ts`

## Fix 2 — `deepMergeObjects` prototype pollution (HIGH)

**File:** `src/config/core/loader.ts`
**Change:** Skip keys `__proto__`, `constructor`, `prototype` in the merge loop.
**Tests:** new test asserting `Object.prototype` is not polluted by hostile YAML.

## Fix 3 — Symlink traversal in `readDirRecursive` + `copyDir` (HIGH)

**File:** `src/utils/filesystem/fs-traverse.ts`
**Change:** `readDirRecursive` skips both file- and dir-symlinks by default. `copyDir` uses `lstat` and skips symlinks.
**Tests:** Updated `tests/unit/utils/fs.test.ts` + import-pipeline test.

## Fix 4 — Uninstall manifest name validation (MEDIUM)

**File:** `src/install/core/install-manifest.ts`
**Change:** `.refine()` on `installManifestEntrySchema.name` matching `validatePackName` in pack-writer.

## Fix 5 — `parseGitSource` protocol allowlist (MEDIUM)

**File:** `src/config/remote/remote-source.ts`
**Change:** allowlist `https:` + `ssh:` by default; `http:` only with `AGENTSMESH_ALLOW_INSECURE_GIT=1`; drop `file:`.

## Verification

`pnpm typecheck` + `pnpm test`.

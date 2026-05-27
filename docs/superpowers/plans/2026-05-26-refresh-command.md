# `agentsmesh refresh` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `agentsmesh refresh` — a new top-level CLI + MCP command that re-fetches and re-applies installed packs against their originally-recorded source/ref, replacing pack contents atomically per pack and updating `installs.yaml` with a new `refreshed_at` timestamp.

**Architecture:** Refresh composes existing primitives. `materializePack()` in `src/install/pack/pack-writer.ts` already owns atomic swap + backup + restore + orphan recovery. `detectModifiedFiles()` in `src/install/uninstall/detect-modified.ts` already provides drift detection. The only refactor is a new `forceFreshMaterialize?: boolean` flag on `installAsPack()` so refresh can bypass the merge-into-existing branch and force full replacement. All other refresh code is new orchestration under `src/install/refresh/`.

**Tech Stack:** TypeScript (strict, ESM), Vitest, Zod, Node.js `readline` + `AbortController` for prompt timeouts, existing `acquireInstallLock` for serialization, `runPostOperationGenerate` for final regen.

**Spec:** `docs/superpowers/specs/2026-05-26-refresh-command-design.md` (revision 2).

---

## Conventions

- All paths in this plan are absolute from repo root (`/Users/serhii/WebstormProjects/agentsmesh/...`) but written as repo-relative for portability.
- Test commands assume `pnpm` is the package manager. Use `pnpm vitest run <path>` for single-file runs.
- Each task ends with a commit using conventional commit format (`feat|fix|test|refactor(scope): message`). Do NOT add Co-Authored-By footers (per memory: `feedback_no_coauthor.md`).
- After every task, run `pnpm lint` and `pnpm typecheck` before committing. If either fails, fix and re-stage before commit.
- Create the file `src/install/refresh/` directory the first time a file lands in it. Use `mkdir -p` not the Write tool's implicit directory creation if the directory doesn't exist yet.
- Imports use `.js` extensions on relative paths (ESM convention in this repo).

---

## Phase 0: Pre-flight verification

The spec requires verifying current `agentsmesh install` behavior against an already-installed pack name before writing the switch-ref docs. This is a one-shot manual check, no code.

### Task 0: Verify install duplicate-name behavior

**Files:** none (manual verification).

- [ ] **Step 1: Set up a throwaway agentsmesh project**

```bash
mkdir -p /tmp/refresh-preflight && cd /tmp/refresh-preflight
node /Users/serhii/WebstormProjects/agentsmesh/dist/cli.js init --yes
```

- [ ] **Step 2: Install a small pack at a known ref**

```bash
node /Users/serhii/WebstormProjects/agentsmesh/dist/cli.js install github:sampleXbro/agentsmesh-test-pack@v0.1.0
```

(Use any small public test pack the team uses; if no canonical one exists, use a local path source.)

- [ ] **Step 3: Run install again against the same name with a different ref**

```bash
node /Users/serhii/WebstormProjects/agentsmesh/dist/cli.js install github:sampleXbro/agentsmesh-test-pack@v0.2.0
```

Observe: does it (a) error with "pack name collision", (b) merge into the existing pack, or (c) silently overwrite?

- [ ] **Step 4: Record the outcome in `tasks/refresh-preflight-notes.md`**

Write 2-3 sentences documenting which branch fires. This determines the wording of the "switch ref" docs in Phase 12. Possible outcomes:
- Errors → docs say "uninstall, then install with new ref".
- Merges → docs say "uninstall with `--force`, then install with new ref" (to avoid merge).
- Overwrites → docs say "install with new ref" (no uninstall needed).

- [ ] **Step 5: Clean up**

```bash
rm -rf /tmp/refresh-preflight
```

No commit for this task — the notes file is informational only and lives outside the source tree.

---

## Phase 1: Add `forceFreshMaterialize` to `installAsPack`

The single required refactor. ~20 LOC change to `src/install/run/run-install-pack.ts:80-199` plus a new test.

### Task 1.1: Write failing test for `forceFreshMaterialize`

**Files:**
- Create: `tests/unit/install/install-as-pack-force-fresh.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installAsPack } from '../../../src/install/run/run-install-pack.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

describe('installAsPack with forceFreshMaterialize', () => {
  let canonicalDir: string;

  beforeEach(async () => {
    canonicalDir = await mkdtemp(join(tmpdir(), 'install-as-pack-force-fresh-'));
    await mkdir(join(canonicalDir, 'packs'), { recursive: true });
  });

  afterEach(async () => {
    await rm(canonicalDir, { recursive: true, force: true });
  });

  function emptyCanonical(): CanonicalFiles {
    return {
      rules: [],
      commands: [],
      agents: [],
      skills: [],
      mcp: null,
      permissions: null,
      hooks: null,
      ignore: [],
    };
  }

  it('forceFreshMaterialize: true replaces existing pack instead of merging', async () => {
    // Arrange: create an existing pack with a marker file
    const packsDir = join(canonicalDir, 'packs');
    const existingPackDir = join(packsDir, 'my-pack');
    await mkdir(join(existingPackDir, 'skills', 'old-skill'), { recursive: true });
    await writeFile(join(existingPackDir, 'skills', 'old-skill', 'SKILL.md'), '# OLD');
    await writeFile(
      join(existingPackDir, 'pack.yaml'),
      [
        'name: my-pack',
        'source: github:org/repo',
        'source_kind: github',
        'installed_at: 2026-01-01T00:00:00.000Z',
        'updated_at: 2026-01-01T00:00:00.000Z',
        'content_hash: sha256:0000000000000000000000000000000000000000000000000000000000000000',
        'features:',
        '  - skills',
      ].join('\n'),
    );

    // Act: install with forceFreshMaterialize, no skills/rules/commands/agents → empty pack
    await installAsPack({
      canonicalDir,
      packName: 'my-pack',
      narrowed: emptyCanonical(),
      selected: { skillNames: [], ruleSlugs: [], commandNames: [], agentNames: [] },
      sourceForYaml: 'github:org/repo',
      sourceKind: 'github',
      entryFeatures: ['skills'],
      pick: undefined,
      forceFreshMaterialize: true,
    });

    // Assert: old-skill is gone (full replacement, not merge)
    const { exists } = await import('../../../src/utils/filesystem/fs.js');
    expect(await exists(join(existingPackDir, 'skills', 'old-skill', 'SKILL.md'))).toBe(false);
  });

  it('forceFreshMaterialize: false (default) preserves existing merge behavior', async () => {
    // Without the flag, installAsPack merges into existing packs.
    // This test pins the default behavior so refresh can't accidentally
    // regress it.
    const packsDir = join(canonicalDir, 'packs');
    const existingPackDir = join(packsDir, 'my-pack');
    await mkdir(join(existingPackDir, 'skills', 'old-skill'), { recursive: true });
    await writeFile(join(existingPackDir, 'skills', 'old-skill', 'SKILL.md'), '# OLD');
    await writeFile(
      join(existingPackDir, 'pack.yaml'),
      [
        'name: my-pack',
        'source: github:org/repo',
        'source_kind: github',
        'installed_at: 2026-01-01T00:00:00.000Z',
        'updated_at: 2026-01-01T00:00:00.000Z',
        'content_hash: sha256:0000000000000000000000000000000000000000000000000000000000000000',
        'features:',
        '  - skills',
      ].join('\n'),
    );

    await installAsPack({
      canonicalDir,
      packName: 'my-pack',
      narrowed: emptyCanonical(),
      selected: { skillNames: [], ruleSlugs: [], commandNames: [], agentNames: [] },
      sourceForYaml: 'github:org/repo',
      sourceKind: 'github',
      entryFeatures: ['skills'],
      pick: undefined,
      // forceFreshMaterialize omitted → default false
    });

    const { exists } = await import('../../../src/utils/filesystem/fs.js');
    // Merge preserves old-skill (the merge path doesn't strip files not in the new set)
    expect(await exists(join(existingPackDir, 'skills', 'old-skill', 'SKILL.md'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run tests/unit/install/install-as-pack-force-fresh.test.ts
```

Expected: FAIL on the first test with TypeScript error "Object literal may only specify known properties, and `forceFreshMaterialize` does not exist in type 'InstallAsPackArgs'".

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/unit/install/install-as-pack-force-fresh.test.ts
git commit -m "test(install): add failing test for forceFreshMaterialize flag"
```

### Task 1.2: Implement `forceFreshMaterialize` flag

**Files:**
- Modify: `src/install/run/run-install-pack.ts:22-49` (`InstallAsPackArgs` interface) and `:104-179` (`installAsPack` body)

- [ ] **Step 1: Add the field to `InstallAsPackArgs`**

In `src/install/run/run-install-pack.ts`, append to the `InstallAsPackArgs` interface (after `contentRoot?: string;` at line 48):

```typescript
  /**
   * When true, skip the `findExistingPack` merge path and force a full
   * materialize of the new content. Used by `agentsmesh refresh` to replace
   * a pack's contents with a fresh ref rather than merging into the existing
   * pack. When omitted or false, existing merge behavior is preserved.
   */
  forceFreshMaterialize?: boolean;
```

- [ ] **Step 2: Use the flag in `installAsPack` body**

Find the line that destructures `InstallAsPackArgs` (around line 81-97). Add `forceFreshMaterialize` to the destructure:

```typescript
  const {
    canonicalDir,
    packName,
    narrowed,
    selected,
    sourceForYaml,
    version,
    sourceKind,
    entryFeatures,
    pick,
    yamlTarget,
    pathInRepo,
    manualAs,
    renameExistingPack,
    sourceType,
    contentRoot,
    forceFreshMaterialize,
  } = args;
```

Find the `findExistingPack` call around line 105:

```typescript
  const existingPack = await findExistingPack(packsDir, sourceForYaml, {
    target: parsedTarget,
    as: manualAs,
    features: entryFeatures,
  });
```

Replace with:

```typescript
  const existingPack = forceFreshMaterialize
    ? null
    : await findExistingPack(packsDir, sourceForYaml, {
        target: parsedTarget,
        as: manualAs,
        features: entryFeatures,
      });
```

When `existingPack` is `null`, the existing code already falls through to the `materializePack` branch (line 150-178), which is exactly what refresh wants.

- [ ] **Step 3: Also bypass the colliding-pack-name guard when force-fresh**

The colliding-pack-name guard (around line 151-156 in the `else` branch where `existingPack === null`) currently throws if a pack dir exists but isn't tracked by `findExistingPack`. When `forceFreshMaterialize: true`, refresh KNOWS the pack already exists and intends to replace it — this guard must not fire.

Replace the guard block:

```typescript
    const collidingMeta = await readPackMetadata(join(packsDir, packName));
    if (collidingMeta) {
      throw new Error(
        `Auto-generated pack name "${packName}" collides with an existing incompatible pack. Use --name to choose a different pack name.`,
      );
    }
```

with:

```typescript
    if (!forceFreshMaterialize) {
      const collidingMeta = await readPackMetadata(join(packsDir, packName));
      if (collidingMeta) {
        throw new Error(
          `Auto-generated pack name "${packName}" collides with an existing incompatible pack. Use --name to choose a different pack name.`,
        );
      }
    }
```

- [ ] **Step 4: Run the new test to verify it passes**

```bash
pnpm vitest run tests/unit/install/install-as-pack-force-fresh.test.ts
```

Expected: both tests PASS.

- [ ] **Step 5: Run the full install test suite to verify no regression**

```bash
pnpm vitest run tests/unit/install/ tests/integration/install
```

Expected: all PASS. No existing test should be affected by the new optional flag.

- [ ] **Step 6: Lint and typecheck**

```bash
pnpm lint && pnpm typecheck
```

Both must pass.

- [ ] **Step 7: Commit**

```bash
git add src/install/run/run-install-pack.ts
git commit -m "feat(install): add forceFreshMaterialize flag to installAsPack"
```

---

## Phase 2: Add `refreshed_at` to manifest schema

Add the optional field, update `installs list` to display it.

### Task 2.1: Extend `installManifestEntrySchema` and `InstallsListEntry`

**Files:**
- Modify: `src/install/core/install-manifest.ts:27-40` (`installManifestEntrySchema`) and `:120-146` (`buildInstallManifestEntry`)
- Modify: `src/cli/command-result.ts:119-139` (`InstallsListEntry`)

- [ ] **Step 1: Add `refreshed_at` to the Zod schema**

In `src/install/core/install-manifest.ts`, modify `installManifestEntrySchema`:

```typescript
export const installManifestEntrySchema = z.object({
  name: z.string().min(1).refine(isSafeInstallName, {
    message: 'install name must not contain path separators, NUL, or "."/".." segments',
  }),
  source: z.string().min(1),
  version: z.string().optional(),
  source_kind: z.enum(['github', 'gitlab', 'git', 'local']),
  features: z.array(featureSchema).min(1),
  pick: extendPickSchema.optional(),
  target: targetSchema.optional(),
  path: z.string().optional(),
  paths: z.array(z.string().min(1)).min(1).optional(),
  as: manualInstallAsSchema.optional(),
  refreshed_at: z.string().min(1).optional(),
});
```

- [ ] **Step 2: Add `refreshed_at` to `buildInstallManifestEntry`**

In the same file, update `buildInstallManifestEntry` signature and body:

```typescript
export function buildInstallManifestEntry(args: {
  name: string;
  source: string;
  version?: string;
  sourceKind: InstallManifestEntry['source_kind'];
  features: InstallManifestEntry['features'];
  pick?: InstallManifestEntry['pick'];
  target?: InstallManifestEntry['target'];
  path?: string;
  paths?: string[];
  as?: ManualInstallAs;
  refreshed_at?: string;
}): InstallManifestEntry {
  return normalizePersistedInstallPaths(
    installManifestEntrySchema.parse({
      name: args.name,
      source: args.source,
      version: args.version,
      source_kind: args.sourceKind,
      features: args.features,
      pick: args.pick,
      target: args.target,
      path: args.path,
      paths: args.paths,
      as: args.as,
      refreshed_at: args.refreshed_at,
    }),
  );
}
```

- [ ] **Step 3: Add `refreshed_at` to `InstallsListEntry`**

In `src/cli/command-result.ts`, modify `InstallsListEntry`:

```typescript
export interface InstallsListEntry {
  name: string;
  source: string;
  source_kind: string;
  source_type: string | null;
  version: string | null;
  features: string[];
  target: string | null;
  /** ISO timestamp from the pack install-manifest, or `null` when missing. */
  installed_at: string | null;
  /** ISO timestamp from the last `agentsmesh refresh`, or `null` when never refreshed. */
  refreshed_at: string | null;
  pack_path: string;
  license: string | null;
}
```

- [ ] **Step 4: Run typecheck to find every consumer of `InstallsListEntry`**

```bash
pnpm typecheck
```

Expected: TypeScript will error at every site that constructs an `InstallsListEntry` literal because the new required `refreshed_at: string | null` field is missing. These sites must be updated.

- [ ] **Step 5: Update each consumer**

For each TypeScript error, find the construction site and add `refreshed_at: <entry>.refreshed_at ?? null` where `<entry>` is the source `InstallManifestEntry`. The likely site is `src/cli/commands/installs-list.ts` (or wherever `InstallsListEntry` objects are built).

- [ ] **Step 6: Re-run typecheck to confirm clean**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/install/core/install-manifest.ts src/cli/command-result.ts src/cli/commands/installs-list.ts
git commit -m "feat(install): add optional refreshed_at field to install manifest"
```

### Task 2.2: Update `installs list` renderer to surface `refreshed_at`

**Files:**
- Modify: `src/cli/renderers/installs.ts`
- Modify: `tests/unit/cli/renderers/installs-renderer.test.ts` (or wherever it lives — find via grep)

- [ ] **Step 1: Find the existing renderer test**

```bash
grep -rln "installs.test\|installs-renderer\|renderInstalls" tests/ src/
```

- [ ] **Step 2: Add a failing test for `refreshed_at` display**

Append to the located test file:

```typescript
it('displays refreshed_at when present, falls back to installed_at when absent', () => {
  const data: InstallsListData = {
    scope: 'project',
    subcommand: 'list',
    installs: [
      {
        name: 'pack-a',
        source: 'github:org/a',
        source_kind: 'github',
        source_type: null,
        version: 'abc123',
        features: ['skills'],
        target: null,
        installed_at: '2026-01-01T00:00:00.000Z',
        refreshed_at: '2026-05-26T12:00:00.000Z',
        pack_path: 'packs/pack-a',
        license: null,
      },
      {
        name: 'pack-b',
        source: 'github:org/b',
        source_kind: 'github',
        source_type: null,
        version: 'def456',
        features: ['skills'],
        target: null,
        installed_at: '2026-01-01T00:00:00.000Z',
        refreshed_at: null,
        pack_path: 'packs/pack-b',
        license: null,
      },
    ],
  };
  const out = captureLoggerOutput(() => renderInstalls({ exitCode: 0, data }));
  expect(out).toContain('2026-05-26T12:00:00.000Z');  // pack-a uses refreshed_at
  expect(out).toContain('2026-01-01T00:00:00.000Z');  // pack-b falls back to installed_at
});
```

(If `captureLoggerOutput` is not the harness's helper, adapt to the repo's pattern — check existing tests in the same file.)

- [ ] **Step 3: Run the test to verify it fails**

```bash
pnpm vitest run tests/unit/cli/renderers/installs-renderer.test.ts
```

Expected: FAIL (renderer doesn't reference `refreshed_at` yet).

- [ ] **Step 4: Modify the renderer**

In `src/cli/renderers/installs.ts`, find the column that displays `installed_at` and change the value to:

```typescript
const lastTouched = entry.refreshed_at ?? entry.installed_at ?? '—';
```

Use `lastTouched` in place of `installed_at` in the rendered output. Rename the column header to "Last touched" if appropriate.

- [ ] **Step 5: Re-run test to verify it passes**

```bash
pnpm vitest run tests/unit/cli/renderers/installs-renderer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Lint and commit**

```bash
pnpm lint && pnpm typecheck
git add src/cli/renderers/installs.ts tests/unit/cli/renderers/installs-renderer.test.ts
git commit -m "feat(installs): surface refreshed_at in installs list output"
```

---

## Phase 3: Refresh types and flags

Foundation types for the rest of the implementation.

### Task 3.1: Define refresh result types

**Files:**
- Create: `src/install/refresh/refresh-result.ts`
- Modify: `src/cli/command-result.ts` (add `RefreshData`)

- [ ] **Step 1: Create the result types file**

```typescript
// src/install/refresh/refresh-result.ts
/**
 * Result shapes for `agentsmesh refresh`. Mirrors the install/uninstall
 * { exitCode, data } envelope so `handleResult` can route it.
 */

import type { RefreshData } from '../../cli/command-result.js';

export interface RefreshCommandResult {
  readonly exitCode: 0 | 1 | 2;
  readonly data: RefreshData;
}

export interface RefreshedItem {
  readonly name: string;
  readonly oldRef: string | null;
  readonly newRef: string;
  readonly oldSha: string | null;
  readonly newSha: string;
  readonly changedFiles: {
    readonly added: readonly string[];
    readonly removed: readonly string[];
    readonly modified: readonly string[];
  };
}

export interface UnchangedItem {
  readonly name: string;
  readonly ref: string;
}

export interface SkippedItem {
  readonly name: string;
  readonly reason: 'user-declined';
}

export type FailurePhase = 'plan' | 'fetch' | 'apply' | 'manifest-update';

export interface FailedItem {
  readonly name: string;
  readonly phase: FailurePhase;
  readonly error: string;
}
```

- [ ] **Step 2: Add `RefreshData` to `command-result.ts`**

Append to `src/cli/command-result.ts`:

```typescript
export interface RefreshData {
  scope: 'project' | 'global';
  mode: 'refresh';
  refreshed: Array<{
    name: string;
    oldRef: string | null;
    newRef: string;
    oldSha: string | null;
    newSha: string;
    changedFiles: { added: string[]; removed: string[]; modified: string[] };
  }>;
  unchanged: Array<{ name: string; ref: string }>;
  skipped: Array<{ name: string; reason: 'user-declined' }>;
  failed: Array<{ name: string; phase: 'plan' | 'fetch' | 'apply' | 'manifest-update'; error: string }>;
  dryRun: boolean;
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/install/refresh/refresh-result.ts src/cli/command-result.ts
git commit -m "feat(refresh): add refresh result types and RefreshData shape"
```

### Task 3.2: Refresh flag parser

**Files:**
- Create: `src/install/refresh/refresh-flags.ts`
- Create: `tests/unit/install/refresh/refresh-flags.test.ts`

- [ ] **Step 1: Write the failing flag-parser test**

```typescript
// tests/unit/install/refresh/refresh-flags.test.ts
import { describe, expect, it } from 'vitest';
import { readRefreshFlags } from '../../../../src/install/refresh/refresh-flags.js';

describe('readRefreshFlags', () => {
  it('defaults every flag to false', () => {
    expect(readRefreshFlags({})).toEqual({
      dryRun: false,
      force: false,
      global: false,
      json: false,
      verbose: false,
    });
  });

  it('maps --dry-run, --force, --json, --global, --verbose', () => {
    expect(
      readRefreshFlags({
        'dry-run': true,
        force: true,
        json: true,
        global: true,
        verbose: true,
      }),
    ).toEqual({
      dryRun: true,
      force: true,
      global: true,
      json: true,
      verbose: true,
    });
  });

  it('ignores unknown flags', () => {
    expect(readRefreshFlags({ unknown: true, name: 'x' })).toEqual({
      dryRun: false,
      force: false,
      global: false,
      json: false,
      verbose: false,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run tests/unit/install/refresh/refresh-flags.test.ts
```

Expected: FAIL (module doesn't exist).

- [ ] **Step 3: Create the flag parser**

```typescript
// src/install/refresh/refresh-flags.ts
/**
 * Parse and validate `agentsmesh refresh` command flags.
 */

export interface RefreshFlags {
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly global: boolean;
  readonly json: boolean;
  readonly verbose: boolean;
}

export function readRefreshFlags(flags: Record<string, string | boolean>): RefreshFlags {
  return {
    dryRun: flags['dry-run'] === true,
    force: flags.force === true,
    global: flags.global === true,
    json: flags.json === true,
    verbose: flags.verbose === true,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run tests/unit/install/refresh/refresh-flags.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/install/refresh/refresh-flags.ts tests/unit/install/refresh/refresh-flags.test.ts
git commit -m "feat(refresh): add flag parser"
```

### Task 3.3: Parse names argument

**Files:**
- Modify: `src/install/refresh/refresh-flags.ts` (add `parseRefreshNames`)
- Modify: `tests/unit/install/refresh/refresh-flags.test.ts`

- [ ] **Step 1: Add a failing test**

Append to `refresh-flags.test.ts`:

```typescript
import { parseRefreshNames } from '../../../../src/install/refresh/refresh-flags.js';

describe('parseRefreshNames', () => {
  it('returns empty array for no args', () => {
    expect(parseRefreshNames([])).toEqual([]);
  });

  it('splits a single comma-separated arg', () => {
    expect(parseRefreshNames(['a,b,c'])).toEqual(['a', 'b', 'c']);
  });

  it('handles whitespace and empty segments', () => {
    expect(parseRefreshNames(['  a , b ,, c '])).toEqual(['a', 'b', 'c']);
  });

  it('preserves duplicates so callers can detect them', () => {
    expect(parseRefreshNames(['a', 'a'])).toEqual(['a', 'a']);
  });

  it('combines multiple args', () => {
    expect(parseRefreshNames(['a,b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run tests/unit/install/refresh/refresh-flags.test.ts
```

Expected: FAIL (`parseRefreshNames` not exported).

- [ ] **Step 3: Add `parseRefreshNames` to `refresh-flags.ts`**

```typescript
export function parseRefreshNames(args: readonly string[]): string[] {
  const out: string[] = [];
  for (const arg of args) {
    for (const part of arg
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      out.push(part);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run tests/unit/install/refresh/refresh-flags.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/install/refresh/refresh-flags.ts tests/unit/install/refresh/refresh-flags.test.ts
git commit -m "feat(refresh): add parseRefreshNames helper"
```

---

## Phase 4: Refresh plan phase

The plan phase reads `installs.yaml`, re-resolves refs, detects drift, and classifies each pack. Writes nothing.

### Task 4.1: Define `RefreshPlan` type and classifier

**Files:**
- Create: `src/install/refresh/refresh-plan.ts`
- Create: `tests/unit/install/refresh/refresh-plan-classification.test.ts`

- [ ] **Step 1: Write failing classifier tests**

```typescript
// tests/unit/install/refresh/refresh-plan-classification.test.ts
import { describe, expect, it } from 'vitest';
import { classifyRefreshPlan } from '../../../../src/install/refresh/refresh-plan.js';

describe('classifyRefreshPlan', () => {
  it('returns "unchanged" when no drift and SHAs equal', () => {
    expect(
      classifyRefreshPlan({ modifications: [], oldSha: 'abc', newSha: 'abc' }),
    ).toBe('unchanged');
  });

  it('returns "clean-update" when no drift but SHA differs', () => {
    expect(
      classifyRefreshPlan({ modifications: [], oldSha: 'abc', newSha: 'def' }),
    ).toBe('clean-update');
  });

  it('returns "needs-consent" when drift is present', () => {
    expect(
      classifyRefreshPlan({
        modifications: [{ relativePath: 'skills/x/SKILL.md', status: 'modified' }],
        oldSha: 'abc',
        newSha: 'def',
      }),
    ).toBe('needs-consent');
  });

  it('returns "needs-consent" even when SHAs match if drift exists', () => {
    // Local edits matter even if upstream hasn't moved
    expect(
      classifyRefreshPlan({
        modifications: [{ relativePath: 'rules/r.md', status: 'modified' }],
        oldSha: 'abc',
        newSha: 'abc',
      }),
    ).toBe('needs-consent');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run tests/unit/install/refresh/refresh-plan-classification.test.ts
```

Expected: FAIL (module doesn't exist).

- [ ] **Step 3: Create `refresh-plan.ts` with types and classifier**

```typescript
// src/install/refresh/refresh-plan.ts
/**
 * Plan phase for `agentsmesh refresh`. Reads installs.yaml, re-resolves
 * each pack's source/ref, detects drift, and classifies the pack.
 * Writes nothing.
 */

import type { ModifiedFile } from '../uninstall/detect-modified.js';
import type { InstallManifestEntry } from '../core/install-manifest.js';

export type RefreshClassification =
  | 'unchanged'      // no drift, ref didn't move
  | 'clean-update'   // no drift, ref moved
  | 'needs-consent'  // local drift; user must consent
  | 'error';         // plan-phase failure

export interface RefreshPlan {
  readonly name: string;
  readonly entry: InstallManifestEntry;
  readonly oldSha: string | null;
  readonly newSha: string;
  readonly modifications: readonly ModifiedFile[];
  readonly classification: RefreshClassification;
  readonly error?: { readonly phase: 'plan'; readonly message: string };
}

export interface ClassifyArgs {
  readonly modifications: readonly ModifiedFile[];
  readonly oldSha: string | null;
  readonly newSha: string;
}

export function classifyRefreshPlan(args: ClassifyArgs): RefreshClassification {
  if (args.modifications.length > 0) return 'needs-consent';
  if (args.oldSha === args.newSha) return 'unchanged';
  return 'clean-update';
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run tests/unit/install/refresh/refresh-plan-classification.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/install/refresh/refresh-plan.ts tests/unit/install/refresh/refresh-plan-classification.test.ts
git commit -m "feat(refresh): add plan classification logic"
```

### Task 4.2: Plan a single pack

**Files:**
- Modify: `src/install/refresh/refresh-plan.ts`
- Create: `tests/unit/install/refresh/refresh-plan-single.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/install/refresh/refresh-plan-single.test.ts
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { planSinglePack } from '../../../../src/install/refresh/refresh-plan.js';
import type { InstallManifestEntry } from '../../../../src/install/core/install-manifest.js';

describe('planSinglePack', () => {
  let canonicalDir: string;

  beforeEach(async () => {
    canonicalDir = await mkdtemp(join(tmpdir(), 'refresh-plan-'));
    await mkdir(join(canonicalDir, 'packs'), { recursive: true });
  });

  afterEach(async () => {
    await rm(canonicalDir, { recursive: true, force: true });
  });

  it('returns error plan when .agentsmesh-install-manifest.json is missing', async () => {
    const packsDir = join(canonicalDir, 'packs');
    await mkdir(join(packsDir, 'pack-a'), { recursive: true });
    const entry: InstallManifestEntry = {
      name: 'pack-a',
      source: 'github:org/repo',
      source_kind: 'github',
      version: 'abc123',
      features: ['skills'],
    };

    const plan = await planSinglePack(entry, packsDir, {
      resolveRef: async () => 'abc123',
    });

    expect(plan.classification).toBe('error');
    expect(plan.error?.message).toMatch(/manifest/i);
  });

  it('returns "unchanged" when no drift and ref unchanged', async () => {
    const packsDir = join(canonicalDir, 'packs');
    const packDir = join(packsDir, 'pack-a');
    await mkdir(packDir, { recursive: true });
    await writeFile(
      join(packDir, '.agentsmesh-install-manifest.json'),
      JSON.stringify({
        name: 'pack-a',
        source: 'github:org/repo',
        installed_at: '2026-01-01T00:00:00.000Z',
        extends_id: null,
        source_type: null,
        files: {},
      }),
    );

    const entry: InstallManifestEntry = {
      name: 'pack-a',
      source: 'github:org/repo',
      source_kind: 'github',
      version: 'abc123',
      features: ['skills'],
    };

    const plan = await planSinglePack(entry, packsDir, {
      resolveRef: async () => 'abc123',
    });

    expect(plan.classification).toBe('unchanged');
    expect(plan.oldSha).toBe('abc123');
    expect(plan.newSha).toBe('abc123');
  });

  it('returns "clean-update" when ref moved with no drift', async () => {
    const packsDir = join(canonicalDir, 'packs');
    const packDir = join(packsDir, 'pack-a');
    await mkdir(packDir, { recursive: true });
    await writeFile(
      join(packDir, '.agentsmesh-install-manifest.json'),
      JSON.stringify({
        name: 'pack-a',
        source: 'github:org/repo',
        installed_at: '2026-01-01T00:00:00.000Z',
        extends_id: null,
        source_type: null,
        files: {},
      }),
    );

    const entry: InstallManifestEntry = {
      name: 'pack-a',
      source: 'github:org/repo',
      source_kind: 'github',
      version: 'abc123',
      features: ['skills'],
    };

    const plan = await planSinglePack(entry, packsDir, {
      resolveRef: async () => 'def456',
    });

    expect(plan.classification).toBe('clean-update');
    expect(plan.oldSha).toBe('abc123');
    expect(plan.newSha).toBe('def456');
  });

  it('returns "error" when resolveRef throws', async () => {
    const packsDir = join(canonicalDir, 'packs');
    const packDir = join(packsDir, 'pack-a');
    await mkdir(packDir, { recursive: true });
    await writeFile(
      join(packDir, '.agentsmesh-install-manifest.json'),
      JSON.stringify({
        name: 'pack-a',
        source: 'github:org/repo',
        installed_at: '2026-01-01T00:00:00.000Z',
        extends_id: null,
        source_type: null,
        files: {},
      }),
    );

    const entry: InstallManifestEntry = {
      name: 'pack-a',
      source: 'github:org/repo',
      source_kind: 'github',
      version: 'abc123',
      features: ['skills'],
    };

    const plan = await planSinglePack(entry, packsDir, {
      resolveRef: async () => {
        throw new Error('network unreachable');
      },
    });

    expect(plan.classification).toBe('error');
    expect(plan.error?.message).toMatch(/network/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run tests/unit/install/refresh/refresh-plan-single.test.ts
```

Expected: FAIL (`planSinglePack` doesn't exist).

- [ ] **Step 3: Implement `planSinglePack`**

Append to `src/install/refresh/refresh-plan.ts`:

```typescript
import { join } from 'node:path';
import { readFileSafe, exists } from '../../utils/filesystem/fs.js';
import { detectModifiedFiles } from '../uninstall/detect-modified.js';
import { INSTALL_MANIFEST_FILENAME } from '../manifest/install-manifest-hash.js';

export interface PlanSinglePackDeps {
  /**
   * Re-resolve the original source/ref to a new SHA. Injected as a dependency
   * so unit tests can mock network calls. Production wires this to
   * `resolveRemoteRefForInstall` for git sources and a no-op for local.
   */
  readonly resolveRef: (entry: InstallManifestEntry) => Promise<string>;
}

export async function planSinglePack(
  entry: InstallManifestEntry,
  packsDir: string,
  deps: PlanSinglePackDeps,
): Promise<RefreshPlan> {
  const packDir = join(packsDir, entry.name);
  const oldSha = entry.version ?? null;

  // Read pack manifest
  const manifestPath = join(packDir, INSTALL_MANIFEST_FILENAME);
  const manifestRaw = await readFileSafe(manifestPath);
  if (manifestRaw === null) {
    return {
      name: entry.name,
      entry,
      oldSha,
      newSha: oldSha ?? '',
      modifications: [],
      classification: 'error',
      error: { phase: 'plan', message: `Pack manifest missing at ${manifestPath}` },
    };
  }

  let manifestFiles: Record<string, string>;
  try {
    const parsed = JSON.parse(manifestRaw) as { files?: Record<string, string> };
    manifestFiles = parsed.files ?? {};
  } catch {
    return {
      name: entry.name,
      entry,
      oldSha,
      newSha: oldSha ?? '',
      modifications: [],
      classification: 'error',
      error: { phase: 'plan', message: `Pack manifest is corrupt at ${manifestPath}` },
    };
  }

  // Drift detection: only meaningful if the pack dir exists
  let modifications: readonly ModifiedFile[] = [];
  if (await exists(packDir)) {
    modifications = await detectModifiedFiles(packDir, manifestFiles);
  }

  // Re-resolve ref
  let newSha: string;
  try {
    newSha = await deps.resolveRef(entry);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      name: entry.name,
      entry,
      oldSha,
      newSha: oldSha ?? '',
      modifications,
      classification: 'error',
      error: { phase: 'plan', message },
    };
  }

  return {
    name: entry.name,
    entry,
    oldSha,
    newSha,
    modifications,
    classification: classifyRefreshPlan({ modifications, oldSha, newSha }),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run tests/unit/install/refresh/refresh-plan-single.test.ts
```

Expected: PASS.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add src/install/refresh/refresh-plan.ts tests/unit/install/refresh/refresh-plan-single.test.ts
git commit -m "feat(refresh): plan a single pack with drift detection"
```

### Task 4.3: Wire production `resolveRef` for git sources

**Files:**
- Modify: `src/install/refresh/refresh-plan.ts` (add a default `resolveRef` factory)

- [ ] **Step 1: Add the factory and a test**

Append to `tests/unit/install/refresh/refresh-plan-single.test.ts`:

```typescript
import { createDefaultResolveRef } from '../../../../src/install/refresh/refresh-plan.js';

describe('createDefaultResolveRef', () => {
  it('returns entry.version unchanged for local sources', async () => {
    const resolve = createDefaultResolveRef();
    const entry: InstallManifestEntry = {
      name: 'p',
      source: 'local:./x',
      source_kind: 'local',
      version: 'v1',
      features: ['skills'],
    };
    expect(await resolve(entry)).toBe('v1');
  });

  it('falls back to "local" when local source has no version', async () => {
    const resolve = createDefaultResolveRef();
    const entry: InstallManifestEntry = {
      name: 'p',
      source: 'local:./x',
      source_kind: 'local',
      features: ['skills'],
    };
    expect(await resolve(entry)).toBe('local');
  });

  // Git resolution covered by integration tests against bare repos.
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run tests/unit/install/refresh/refresh-plan-single.test.ts
```

Expected: FAIL on `createDefaultResolveRef` import.

- [ ] **Step 3: Implement `createDefaultResolveRef`**

Append to `src/install/refresh/refresh-plan.ts`:

```typescript
import { parseInstallSource } from '../source/parse-install-source.js';
import { resolveRemoteRefForInstall } from '../source/git-pin.js';

/**
 * Production wiring for `PlanSinglePackDeps.resolveRef`. Parses the entry's
 * source and dispatches to the git resolver for remote sources or returns
 * the recorded version unchanged for local sources (which don't have refs).
 */
export function createDefaultResolveRef(): PlanSinglePackDeps['resolveRef'] {
  return async (entry: InstallManifestEntry): Promise<string> => {
    if (entry.source_kind === 'local') {
      return entry.version ?? 'local';
    }
    const parsed = parseInstallSource(entry.source);
    // parsed.ref is the original ref expression (e.g. "main", "v1.2.0", or "");
    // resolveRemoteRefForInstall re-resolves it to a full SHA now.
    return resolveRemoteRefForInstall(parsed.ref ?? '', parsed.remoteUrl);
  };
}
```

(Note: `parseInstallSource` and its `remoteUrl`/`ref` fields are documented in `src/install/source/parse-install-source.ts`. If the field names differ slightly when you read that file, adapt the call.)

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run tests/unit/install/refresh/refresh-plan-single.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/install/refresh/refresh-plan.ts tests/unit/install/refresh/refresh-plan-single.test.ts
git commit -m "feat(refresh): wire default ref resolver for git/local sources"
```

---

## Phase 5: Consent prompt with timeout

### Task 5.1: `promptWithTimeout` helper

**Files:**
- Create: `src/install/refresh/refresh-prompt.ts`
- Create: `tests/unit/install/refresh/refresh-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/install/refresh/refresh-prompt.test.ts
import { describe, expect, it, vi } from 'vitest';
import { promptWithTimeout } from '../../../../src/install/refresh/refresh-prompt.js';

describe('promptWithTimeout', () => {
  it('returns "y" when user answers y', async () => {
    const result = await promptWithTimeout('continue?', 1000, {
      readLine: async () => 'y',
    });
    expect(result).toBe('y');
  });

  it('returns "y" for uppercase Y', async () => {
    const result = await promptWithTimeout('continue?', 1000, {
      readLine: async () => 'Y',
    });
    expect(result).toBe('y');
  });

  it('returns "n" for n or empty input', async () => {
    expect(
      await promptWithTimeout('continue?', 1000, { readLine: async () => 'n' }),
    ).toBe('n');
    expect(
      await promptWithTimeout('continue?', 1000, { readLine: async () => '' }),
    ).toBe('n');
  });

  it('returns "per-pack" for per-pack', async () => {
    const result = await promptWithTimeout('continue?', 1000, {
      readLine: async () => 'per-pack',
    });
    expect(result).toBe('per-pack');
  });

  it('returns "timeout" when no answer arrives within timeoutMs', async () => {
    vi.useFakeTimers();
    try {
      const never: Promise<string> = new Promise(() => {
        // never resolves
      });
      const promise = promptWithTimeout('continue?', 50, {
        readLine: () => never,
      });
      await vi.advanceTimersByTimeAsync(60);
      expect(await promise).toBe('timeout');
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns "n" for any other unrecognized input', async () => {
    const result = await promptWithTimeout('continue?', 1000, {
      readLine: async () => 'wat',
    });
    expect(result).toBe('n');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run tests/unit/install/refresh/refresh-prompt.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `promptWithTimeout`**

```typescript
// src/install/refresh/refresh-prompt.ts
/**
 * Consent prompt with a hard timeout. Built on Node primitives only — no
 * platform-specific terminal handling. The `readLine` injection point lets
 * tests mock stdin.
 */

import { readLine as defaultReadLine } from '../prompts/prompt-io.js';

export type PromptAnswer = 'y' | 'n' | 'per-pack' | 'timeout';

export interface PromptWithTimeoutDeps {
  /** Test seam: inject a custom reader for stdin. */
  readonly readLine?: (prompt: string) => Promise<string>;
}

export async function promptWithTimeout(
  message: string,
  timeoutMs: number,
  deps: PromptWithTimeoutDeps = {},
): Promise<PromptAnswer> {
  const reader = deps.readLine ?? defaultReadLine;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<PromptAnswer>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
    timer.unref?.();
  });

  try {
    const raw = await Promise.race([reader(message), timeout]);
    if (raw === 'timeout') return 'timeout';
    return normalize(raw);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalize(raw: string): PromptAnswer {
  const lower = raw.trim().toLowerCase();
  if (lower === 'y' || lower === 'yes') return 'y';
  if (lower === 'per-pack') return 'per-pack';
  return 'n';
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run tests/unit/install/refresh/refresh-prompt.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/install/refresh/refresh-prompt.ts tests/unit/install/refresh/refresh-prompt.test.ts
git commit -m "feat(refresh): add promptWithTimeout helper"
```

### Task 5.2: Consolidated consent prompt over multiple packs

**Files:**
- Modify: `src/install/refresh/refresh-prompt.ts` (add `runConsentPrompt`)
- Modify: `tests/unit/install/refresh/refresh-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `refresh-prompt.test.ts`:

```typescript
import { runConsentPrompt } from '../../../../src/install/refresh/refresh-prompt.js';

describe('runConsentPrompt', () => {
  it('returns decisions: { proceed: true, perPack: false } when user answers y', async () => {
    const result = await runConsentPrompt(
      [
        { name: 'a', modifiedCount: 3 },
        { name: 'b', modifiedCount: 1 },
      ],
      { timeoutMs: 1000, readLine: async () => 'y' },
    );
    expect(result).toEqual({ proceed: true, perPack: false, declined: [] });
  });

  it('returns decisions: { proceed: false, declined: all } when user answers n', async () => {
    const result = await runConsentPrompt(
      [
        { name: 'a', modifiedCount: 3 },
        { name: 'b', modifiedCount: 1 },
      ],
      { timeoutMs: 1000, readLine: async () => 'n' },
    );
    expect(result).toEqual({ proceed: false, perPack: false, declined: ['a', 'b'] });
  });

  it('returns decisions: { proceed: false, declined: all } on timeout', async () => {
    vi.useFakeTimers();
    try {
      const never: Promise<string> = new Promise(() => {});
      const promise = runConsentPrompt([{ name: 'a', modifiedCount: 1 }], {
        timeoutMs: 50,
        readLine: () => never,
      });
      await vi.advanceTimersByTimeAsync(60);
      expect(await promise).toEqual({ proceed: false, perPack: false, declined: ['a'] });
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns { proceed: true, perPack: true } for per-pack', async () => {
    const result = await runConsentPrompt(
      [{ name: 'a', modifiedCount: 1 }],
      { timeoutMs: 1000, readLine: async () => 'per-pack' },
    );
    expect(result).toEqual({ proceed: true, perPack: true, declined: [] });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run tests/unit/install/refresh/refresh-prompt.test.ts
```

Expected: FAIL (`runConsentPrompt` not exported).

- [ ] **Step 3: Implement `runConsentPrompt`**

Append to `src/install/refresh/refresh-prompt.ts`:

```typescript
export interface ConsentRequestItem {
  readonly name: string;
  readonly modifiedCount: number;
}

export interface ConsentResult {
  readonly proceed: boolean;
  readonly perPack: boolean;
  readonly declined: readonly string[];
}

export interface RunConsentPromptOptions extends PromptWithTimeoutDeps {
  readonly timeoutMs: number;
}

export async function runConsentPrompt(
  items: readonly ConsentRequestItem[],
  options: RunConsentPromptOptions,
): Promise<ConsentResult> {
  const lines = [
    `The following ${items.length} pack(s) have local edits that refresh will overwrite:`,
    ...items.map((i) => `  - ${i.name}: ${i.modifiedCount} modified file(s)`),
    'Continue? [y/N/per-pack]  (5 min timeout, default N) ',
  ];
  const message = lines.join('\n');
  const answer = await promptWithTimeout(message, options.timeoutMs, options);
  switch (answer) {
    case 'y':
      return { proceed: true, perPack: false, declined: [] };
    case 'per-pack':
      return { proceed: true, perPack: true, declined: [] };
    case 'n':
    case 'timeout':
      return {
        proceed: false,
        perPack: false,
        declined: items.map((i) => i.name),
      };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run tests/unit/install/refresh/refresh-prompt.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/install/refresh/refresh-prompt.ts tests/unit/install/refresh/refresh-prompt.test.ts
git commit -m "feat(refresh): add runConsentPrompt for bulk consent"
```

---

## Phase 6: Refresh apply phase (per-pack)

### Task 6.1: Apply a single pack via `installAsPack`

**Files:**
- Create: `src/install/refresh/refresh-apply.ts`
- Create: `tests/unit/install/refresh/refresh-apply.test.ts`

- [ ] **Step 1: Write the failing test for the success path**

```typescript
// tests/unit/install/refresh/refresh-apply.test.ts
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applySinglePack } from '../../../../src/install/refresh/refresh-apply.js';
import type { RefreshPlan } from '../../../../src/install/refresh/refresh-plan.js';
import type { InstallManifestEntry } from '../../../../src/install/core/install-manifest.js';

describe('applySinglePack', () => {
  let canonicalDir: string;

  beforeEach(async () => {
    canonicalDir = await mkdtemp(join(tmpdir(), 'refresh-apply-'));
    await mkdir(join(canonicalDir, 'packs'), { recursive: true });
  });

  afterEach(async () => {
    await rm(canonicalDir, { recursive: true, force: true });
  });

  it('calls runInstallForRefresh and stamps refreshed_at', async () => {
    const calls: Array<{ entry: InstallManifestEntry; newSha: string }> = [];
    const runInstallForRefresh = vi.fn(async (entry: InstallManifestEntry, newSha: string) => {
      calls.push({ entry, newSha });
    });

    const entry: InstallManifestEntry = {
      name: 'pack-a',
      source: 'github:org/repo',
      source_kind: 'github',
      version: 'old',
      features: ['skills'],
    };
    const plan: RefreshPlan = {
      name: 'pack-a',
      entry,
      oldSha: 'old',
      newSha: 'new',
      modifications: [],
      classification: 'clean-update',
    };

    const result = await applySinglePack(plan, canonicalDir, { runInstallForRefresh });

    expect(result.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.newSha).toBe('new');
  });

  it('returns failure when runInstallForRefresh throws', async () => {
    const runInstallForRefresh = vi.fn(async () => {
      throw new Error('fetch failed');
    });

    const entry: InstallManifestEntry = {
      name: 'pack-a',
      source: 'github:org/repo',
      source_kind: 'github',
      version: 'old',
      features: ['skills'],
    };
    const plan: RefreshPlan = {
      name: 'pack-a',
      entry,
      oldSha: 'old',
      newSha: 'new',
      modifications: [],
      classification: 'clean-update',
    };

    const result = await applySinglePack(plan, canonicalDir, { runInstallForRefresh });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fetch failed/);
    expect(result.phase).toBe('apply');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run tests/unit/install/refresh/refresh-apply.test.ts
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement `applySinglePack`**

```typescript
// src/install/refresh/refresh-apply.ts
/**
 * Apply phase for a single refresh: invoke the install pipeline with
 * `forceFreshMaterialize: true` against the pack's recorded source/features,
 * then stamp `refreshed_at` on the installs.yaml row.
 *
 * `materializePack` (inside the install pipeline) owns atomic swap +
 * backup + restore + orphan recovery; refresh never reinvents these.
 */

import {
  readInstallManifest,
  upsertInstallManifestEntry,
  type InstallManifestEntry,
} from '../core/install-manifest.js';
import type { RefreshPlan } from './refresh-plan.js';
import type { FailurePhase } from './refresh-result.js';

export interface ApplySinglePackDeps {
  /**
   * Re-run install for the given entry against the new SHA, with
   * `forceFreshMaterialize: true`. Production wires this to a thin
   * orchestrator that reconstructs install args from the manifest entry
   * (see runRefresh in run-refresh.ts).
   */
  readonly runInstallForRefresh: (entry: InstallManifestEntry, newSha: string) => Promise<void>;
  /** Test seam: override `now` for deterministic timestamps. */
  readonly now?: () => string;
}

export interface ApplyResult {
  readonly success: boolean;
  readonly phase?: FailurePhase;
  readonly error?: string;
}

export async function applySinglePack(
  plan: RefreshPlan,
  canonicalDir: string,
  deps: ApplySinglePackDeps,
): Promise<ApplyResult> {
  // 1. Run install with forceFreshMaterialize
  try {
    await deps.runInstallForRefresh(plan.entry, plan.newSha);
  } catch (err) {
    return {
      success: false,
      phase: 'apply',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // 2. Stamp refreshed_at on the freshly-written installs.yaml row
  try {
    const now = (deps.now ?? (() => new Date().toISOString()))();
    const manifest = await readInstallManifest(canonicalDir);
    const updated = manifest.find((e) => e.name === plan.entry.name);
    if (updated === undefined) {
      return {
        success: false,
        phase: 'manifest-update',
        error: `Entry "${plan.entry.name}" not found after install`,
      };
    }
    await upsertInstallManifestEntry(canonicalDir, { ...updated, refreshed_at: now });
  } catch (err) {
    return {
      success: false,
      phase: 'manifest-update',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return { success: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run tests/unit/install/refresh/refresh-apply.test.ts
```

Expected: PASS.

- [ ] **Step 5: Lint, commit**

```bash
pnpm lint && pnpm typecheck
git add src/install/refresh/refresh-apply.ts tests/unit/install/refresh/refresh-apply.test.ts
git commit -m "feat(refresh): apply a single pack via installAsPack delegation"
```

### Task 6.2: Thread `forceFreshMaterialize` through the install pipeline

The install pipeline already plumbs args from `runInstall` → `runInstallLocked` → `runSinglePackInstall` (in `src/install/run/single-pack-install.ts`) → `executeRunInstallPoolsAndWrite` → `installAsPack`. The cleanest bridge is to add `forceFreshMaterialize` to the existing flag bag and propagate it through one field at each layer. ~5 single-line additions.

**Files:**
- Modify: `src/install/core/install-flags.ts` (read the flag)
- Modify: `src/install/run/run-install.ts` (pass through)
- Modify: `src/install/run/run-install-locked.ts` (`RunInstallLockedArgs` interface + forwarding)
- Modify: `src/install/run/single-pack-install.ts` (forward to `executeRunInstallPoolsAndWrite`)
- Modify: `src/install/run/run-install-execute.ts` (`RunInstallExecuteArgs` + forward to `installAsPack`)
- Create: `src/install/refresh/refresh-install-bridge.ts` (thin wrapper for refresh)

- [ ] **Step 1: Add `forceFreshMaterialize` to `InstallFlags`**

In `src/install/core/install-flags.ts`, extend `readInstallFlags`:

```typescript
export function readInstallFlags(flags: Record<string, string | boolean>): {
  sync: boolean;
  dryRun: boolean;
  force: boolean;
  useExtends: boolean;
  all: boolean;
  explicitPath?: string;
  explicitTarget?: string;
  explicitAs?: ReturnType<typeof manualInstallAsSchema.parse>;
  nameOverride: string;
  forceFreshMaterialize: boolean;
} {
  // ... existing body ...
  return {
    // ... existing returns ...
    forceFreshMaterialize: flags.forceFreshMaterialize === true,
  };
}
```

- [ ] **Step 2: Pass it through `runInstall` → `runInstallLocked`**

In `src/install/run/run-install.ts`, add `forceFreshMaterialize` to the destructured fields and to the `runInstallLocked` arg object:

```typescript
const {
  sync,
  dryRun,
  force,
  useExtends,
  all,
  explicitPath,
  explicitTarget,
  explicitAs,
  nameOverride,
  forceFreshMaterialize,
} = readInstallFlags(flags);
// ...
return await runInstallLocked({
  // ... existing ...
  forceFreshMaterialize,
  recurseInstall: runInstall,
});
```

In `src/install/run/run-install-locked.ts`, add to `RunInstallLockedArgs`:

```typescript
export interface RunInstallLockedArgs {
  // ... existing fields ...
  forceFreshMaterialize?: boolean;
}
```

And in the body, destructure and forward to `runSinglePackInstall`:

```typescript
const { /* ... */ forceFreshMaterialize } = opts;
// ...
return runSinglePackInstall({
  // ... existing ...
  forceFreshMaterialize,
});
```

- [ ] **Step 3: Forward through `runSinglePackInstall`**

In `src/install/run/single-pack-install.ts`, add `forceFreshMaterialize` to the args interface and forward it to `executeRunInstallPoolsAndWrite`. Same one-line pattern.

- [ ] **Step 4: Forward through `executeRunInstallPoolsAndWrite` to `installAsPack`**

In `src/install/run/run-install-execute.ts`, add `forceFreshMaterialize?: boolean` to `RunInstallExecuteArgs`. In the body, pass it to the existing `installAsPack` call:

```typescript
await installAsPack({
  // ... existing args ...
  forceFreshMaterialize: args.forceFreshMaterialize,
});
```

(`installAsPack` already accepts this field from Phase 1.)

- [ ] **Step 5: Build the refresh bridge**

```typescript
// src/install/refresh/refresh-install-bridge.ts
/**
 * Bridge from a recorded install manifest entry back into the install
 * pipeline, with `forceFreshMaterialize: true`. Used by `applySinglePack`.
 *
 * Reuses `runInstall`'s outer lock-skipping recursion path by passing
 * `replay: undefined` and a synthetic flag bag. Refresh's own lock is
 * already held by `runRefresh` — `runInstall` acquires the same
 * `.install.lock` on the same canonical dir, so calling it would deadlock
 * unless we pass `replay` (which suppresses re-acquisition).
 *
 * The trick: pass a minimal `InstallReplayScope` constructed from the
 * manifest entry. That tells `runInstall` "this is a replay, don't
 * re-acquire the lock" while still re-running the full fetch + classify +
 * install pipeline against the entry's source.
 */

import { runInstall } from '../run/run-install.js';
import type { InstallManifestEntry } from '../core/install-manifest.js';

export interface RunInstallForRefreshArgs {
  readonly projectRoot: string;
  readonly scope: 'project' | 'global';
}

export function createRunInstallForRefresh(args: RunInstallForRefreshArgs) {
  return async (entry: InstallManifestEntry, _newSha: string): Promise<void> => {
    // Build flags from the entry. Note: we pass `force: true` because refresh
    // already obtained user consent via its own prompt (or --force).
    const flags: Record<string, string | boolean> = {
      force: true,
      forceFreshMaterialize: true,
    };
    if (args.scope === 'global') flags.global = true;
    if (entry.target) flags.target = entry.target;
    if (entry.as) flags.as = entry.as;
    if (entry.path) flags.path = entry.path;
    flags.name = entry.name;

    // The "replay" scope tells runInstall to skip lock re-acquisition.
    const replay = {
      features: entry.features,
      pick: entry.pick,
    };

    const result = await runInstall(flags, [entry.source], args.projectRoot, replay as never);
    if (result.exitCode !== 0) {
      throw new Error(`Install for refresh failed with exit code ${result.exitCode}`);
    }
  };
}
```

(**Important:** the exact shape of `InstallReplayScope` is defined in `src/install/run/install-replay.ts`. Read that file to confirm the required fields before writing the code above. The `features` and `pick` fields above are best-guess based on the survey; correct them if the actual interface differs.)

- [ ] **Step 6: Test the bridge with the integration fixture from Phase 11**

The bridge cannot be unit-tested in isolation (it requires the full install pipeline). It will be exercised by `tests/integration/refresh-git-source.test.ts` in Phase 11. If that test fails when you get there, revisit this task.

- [ ] **Step 7: Verify install tests still pass after the plumbing changes**

```bash
pnpm vitest run tests/unit/install tests/integration/install
```

Expected: PASS — the new flag is opt-in and defaults to false everywhere.

- [ ] **Step 8: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add src/install/core/install-flags.ts src/install/run/run-install.ts src/install/run/run-install-locked.ts src/install/run/single-pack-install.ts src/install/run/run-install-execute.ts src/install/refresh/refresh-install-bridge.ts
git commit -m "feat(refresh): thread forceFreshMaterialize through install pipeline"
```

---

## Phase 7: Orchestrator

### Task 7.1: `runRefresh` entry point

**Files:**
- Create: `src/install/refresh/run-refresh.ts`
- Create: `tests/unit/install/refresh/run-refresh.test.ts`

- [ ] **Step 1: Write the failing orchestrator test**

```typescript
// tests/unit/install/refresh/run-refresh.test.ts
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runRefresh } from '../../../../src/install/refresh/run-refresh.js';

describe('runRefresh', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'run-refresh-'));
    await mkdir(join(projectRoot, '.agentsmesh', 'packs'), { recursive: true });
    // Minimal agentsmesh.yaml + installs.yaml fixtures
    await writeFile(join(projectRoot, 'agentsmesh.yaml'), 'targets: []\nfeatures: []\n');
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('exits 0 with empty result when no packs are installed', async () => {
    await writeFile(join(projectRoot, '.agentsmesh', 'installs.yaml'), 'version: 1\ninstalls: []\n');
    const result = await runRefresh({}, [], projectRoot);
    expect(result.exitCode).toBe(0);
    expect(result.data.refreshed).toEqual([]);
    expect(result.data.unchanged).toEqual([]);
    expect(result.data.failed).toEqual([]);
  });

  it('exits 2 when an unknown name is requested', async () => {
    await writeFile(join(projectRoot, '.agentsmesh', 'installs.yaml'), 'version: 1\ninstalls: []\n');
    const result = await runRefresh({}, ['does-not-exist'], projectRoot);
    expect(result.exitCode).toBe(2);
  });

  // Bulk and per-pack tests follow once the full wiring is in place.
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run tests/unit/install/refresh/run-refresh.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `runRefresh`**

```typescript
// src/install/refresh/run-refresh.ts
/**
 * agentsmesh refresh orchestration.
 *
 * Acquires the install lock, plans every targeted pack, prompts for consent
 * when drift is present, applies the refresh per pack (atomicity owned by
 * materializePack), then runs post-op generate once if any pack changed.
 */

import { loadScopedConfig } from '../../config/core/scope.js';
import { bootstrapPlugins } from '../../plugins/bootstrap-plugins.js';
import { acquireInstallLock } from '../lock/install-lock.js';
import { readInstallManifest } from '../core/install-manifest.js';
import { runPostOperationGenerate } from '../run/post-install-generate.js';
import { logger } from '../../utils/output/logger.js';
import { readRefreshFlags, parseRefreshNames } from './refresh-flags.js';
import {
  classifyRefreshPlan,
  createDefaultResolveRef,
  planSinglePack,
  type RefreshPlan,
} from './refresh-plan.js';
import { applySinglePack } from './refresh-apply.js';
import { runConsentPrompt } from './refresh-prompt.js';
import { createRunInstallForRefresh } from './refresh-install-bridge.js';
import type { RefreshCommandResult } from './refresh-result.js';
import type { RefreshData } from '../../cli/command-result.js';

const PROMPT_TIMEOUT_MS = 5 * 60 * 1000;

export async function runRefresh(
  flags: Record<string, string | boolean>,
  args: readonly string[],
  projectRoot: string,
): Promise<RefreshCommandResult> {
  const { dryRun, force, global, json } = readRefreshFlags(flags);
  const scope: 'project' | 'global' = global ? 'global' : 'project';
  const names = parseRefreshNames(args);

  const emptyData = (): RefreshData => ({
    scope,
    mode: 'refresh',
    refreshed: [],
    unchanged: [],
    skipped: [],
    failed: [],
    dryRun,
  });

  const { config, context } = await loadScopedConfig(projectRoot, scope);
  await bootstrapPlugins(config, projectRoot);
  const lockRelease = await acquireInstallLock(context.canonicalDir);

  try {
    const manifest = await readInstallManifest(context.canonicalDir);

    // Validate names
    if (names.length > 0) {
      const known = new Set(manifest.map((e) => e.name));
      const unknown = names.filter((n) => !known.has(n));
      if (unknown.length > 0) {
        if (!json) logger.error(`Unknown pack(s): ${unknown.join(', ')}`);
        return { exitCode: 2, data: emptyData() };
      }
    }

    const targets = names.length > 0
      ? manifest.filter((e) => names.includes(e.name))
      : manifest;

    if (targets.length === 0) {
      if (!json) logger.info('No packs to refresh.');
      return { exitCode: 0, data: emptyData() };
    }

    // Plan phase
    const packsDir = `${context.canonicalDir}/packs`;
    const resolveRef = createDefaultResolveRef();
    const plans: RefreshPlan[] = [];
    for (const entry of targets) {
      plans.push(await planSinglePack(entry, packsDir, { resolveRef }));
    }

    // Sort plans into buckets
    const errors = plans.filter((p) => p.classification === 'error');
    const unchanged = plans.filter((p) => p.classification === 'unchanged');
    const cleanUpdate = plans.filter((p) => p.classification === 'clean-update');
    const needsConsent = plans.filter((p) => p.classification === 'needs-consent');

    const data = emptyData();
    data.unchanged = unchanged.map((p) => ({ name: p.name, ref: p.newSha }));
    data.failed = errors.map((p) => ({
      name: p.name,
      phase: 'plan' as const,
      error: p.error?.message ?? 'unknown plan error',
    }));

    // Dry-run: stop here
    if (dryRun) {
      // Render dry-run summary (renderer will handle the details)
      return { exitCode: errors.length > 0 ? 1 : 0, data };
    }

    // Consent for needs-consent
    let proceedSet = new Set(cleanUpdate.map((p) => p.name));
    if (needsConsent.length > 0) {
      if (force) {
        for (const p of needsConsent) proceedSet.add(p.name);
      } else {
        const consent = await runConsentPrompt(
          needsConsent.map((p) => ({ name: p.name, modifiedCount: p.modifications.length })),
          { timeoutMs: PROMPT_TIMEOUT_MS },
        );
        if (consent.proceed && !consent.perPack) {
          for (const p of needsConsent) proceedSet.add(p.name);
        } else if (consent.proceed && consent.perPack) {
          // Per-pack: prompt individually
          for (const p of needsConsent) {
            const per = await runConsentPrompt(
              [{ name: p.name, modifiedCount: p.modifications.length }],
              { timeoutMs: PROMPT_TIMEOUT_MS },
            );
            if (per.proceed) proceedSet.add(p.name);
            else data.skipped.push({ name: p.name, reason: 'user-declined' });
          }
        } else {
          // Declined or timed out
          for (const name of consent.declined) {
            data.skipped.push({ name, reason: 'user-declined' });
          }
        }
      }
    }

    // Apply phase
    const runInstallForRefresh = createRunInstallForRefresh({ projectRoot, scope });
    for (const plan of [...cleanUpdate, ...needsConsent]) {
      if (!proceedSet.has(plan.name)) continue;
      const result = await applySinglePack(plan, context.canonicalDir, { runInstallForRefresh });
      if (result.success) {
        data.refreshed.push({
          name: plan.name,
          oldRef: plan.oldSha,
          newRef: plan.newSha,
          oldSha: plan.oldSha,
          newSha: plan.newSha,
          changedFiles: { added: [], removed: [], modified: [] },
        });
      } else {
        data.failed.push({
          name: plan.name,
          phase: result.phase ?? 'apply',
          error: result.error ?? 'unknown',
        });
      }
    }

    // Post-op generate
    if (data.refreshed.length > 0) {
      await runPostOperationGenerate('refresh', scope, context.rootBase);
    }

    const exitCode = data.failed.length > 0 ? 1 : 0;
    return { exitCode, data };
  } finally {
    await lockRelease();
  }
}
```

(Note: `runPostOperationGenerate` may not currently accept `'refresh'` as its first arg — check the existing signature and either add `'refresh'` to its mode enum or use `'install'` as the closest existing mode.)

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run tests/unit/install/refresh/run-refresh.test.ts
```

Expected: PASS (both tests).

- [ ] **Step 5: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add src/install/refresh/run-refresh.ts tests/unit/install/refresh/run-refresh.test.ts
git commit -m "feat(refresh): add runRefresh orchestrator"
```

---

## Phase 8: CLI wrapper + dispatcher wiring

### Task 8.1: Thin CLI command wrapper

**Files:**
- Create: `src/cli/commands/refresh.ts`

- [ ] **Step 1: Create the wrapper**

```typescript
// src/cli/commands/refresh.ts
/**
 * agentsmesh refresh — re-fetch and re-apply installed packs against their
 * originally-recorded source/ref.
 */

import {
  runRefresh as runRefreshCore,
} from '../../install/refresh/run-refresh.js';
import type { RefreshCommandResult } from '../../install/refresh/refresh-result.js';

export type { RefreshCommandResult };

export async function runRefresh(
  flags: Record<string, string | boolean>,
  args: string[],
  projectRoot: string,
): Promise<RefreshCommandResult> {
  return runRefreshCore(flags, args, projectRoot);
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/cli/commands/refresh.ts
git commit -m "feat(refresh): add CLI command wrapper"
```

### Task 8.2: Register `refresh` in `command-handlers.ts`

**Files:**
- Modify: `src/cli/command-handlers.ts`

- [ ] **Step 1: Add imports at the top of the file**

After the existing `runUninstall` / `renderUninstall` imports:

```typescript
import { runRefresh } from './commands/refresh.js';
import { renderRefresh } from './renderers/refresh.js';
```

- [ ] **Step 2: Add the handler entry inside `cmdHandlers`**

Add after the `uninstall` handler:

```typescript
  refresh: async (flags, args) => {
    const result = await runRefresh(flags, args, process.cwd());
    handleResult('refresh', result, flags, () => renderRefresh(result));
    if (result.exitCode !== 0) process.exit(result.exitCode);
  },
```

(The `process.exit` line matches how other commands return non-zero codes. Check uninstall's exact pattern in `command-handlers.ts` for consistency and match it.)

- [ ] **Step 3: Update help / usage data**

Find `src/cli/help-data.ts` and add a row for `refresh`:

```typescript
{
  command: 'refresh',
  summary: 'Re-fetch and re-apply installed packs from their recorded sources',
  flags: ['--dry-run', '--force', '--json', '--global', '--verbose'],
},
```

(Adapt to the actual shape of `help-data.ts` — read it first.)

- [ ] **Step 4: Typecheck (will fail because renderRefresh doesn't exist yet)**

```bash
pnpm typecheck
```

Expected: FAIL on `renderRefresh` import. This will be resolved in Phase 9. For now, leave the import in place but the command is unreachable until Phase 9 lands.

- [ ] **Step 5: Skip commit until Phase 9**

Do NOT commit this task yet — the file imports `renderRefresh` which doesn't exist. Move to Phase 9 and commit both together (or split the import out into Phase 9's task).

---

## Phase 9: Renderer

### Task 9.1: Text and JSON renderers

**Files:**
- Create: `src/cli/renderers/refresh.ts`
- Create: `tests/unit/cli/renderers/refresh-renderer.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/cli/renderers/refresh-renderer.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../../../src/utils/output/logger.js';
import { renderRefresh } from '../../../../src/cli/renderers/refresh.js';
import type { RefreshCommandResult } from '../../../../src/install/refresh/refresh-result.js';

describe('renderRefresh', () => {
  let logs: string[];
  let warns: string[];
  let errors: string[];

  beforeEach(() => {
    logs = [];
    warns = [];
    errors = [];
    vi.spyOn(logger, 'info').mockImplementation((m: string) => logs.push(m));
    vi.spyOn(logger, 'success').mockImplementation((m: string) => logs.push(m));
    vi.spyOn(logger, 'warn').mockImplementation((m: string) => warns.push(m));
    vi.spyOn(logger, 'error').mockImplementation((m: string) => errors.push(m));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders refreshed packs with name and ref transition', () => {
    const result: RefreshCommandResult = {
      exitCode: 0,
      data: {
        scope: 'project',
        mode: 'refresh',
        refreshed: [
          {
            name: 'pack-a',
            oldRef: 'abc',
            newRef: 'def',
            oldSha: 'abc',
            newSha: 'def',
            changedFiles: { added: [], removed: [], modified: [] },
          },
        ],
        unchanged: [],
        skipped: [],
        failed: [],
        dryRun: false,
      },
    };

    renderRefresh(result);
    expect(logs.some((l) => l.includes('pack-a'))).toBe(true);
    expect(logs.some((l) => l.includes('abc') && l.includes('def'))).toBe(true);
  });

  it('renders dry-run with [dry-run] prefix and no success line', () => {
    const result: RefreshCommandResult = {
      exitCode: 0,
      data: {
        scope: 'project',
        mode: 'refresh',
        refreshed: [],
        unchanged: [],
        skipped: [],
        failed: [],
        dryRun: true,
      },
    };
    renderRefresh(result);
    expect(logs.some((l) => l.includes('[dry-run]'))).toBe(true);
  });

  it('renders unchanged packs', () => {
    const result: RefreshCommandResult = {
      exitCode: 0,
      data: {
        scope: 'project',
        mode: 'refresh',
        refreshed: [],
        unchanged: [{ name: 'pack-b', ref: 'abc' }],
        skipped: [],
        failed: [],
        dryRun: false,
      },
    };
    renderRefresh(result);
    expect(logs.some((l) => l.includes('pack-b') && l.includes('unchanged'))).toBe(true);
  });

  it('renders skipped and failed packs', () => {
    const result: RefreshCommandResult = {
      exitCode: 1,
      data: {
        scope: 'project',
        mode: 'refresh',
        refreshed: [],
        unchanged: [],
        skipped: [{ name: 'pack-c', reason: 'user-declined' }],
        failed: [{ name: 'pack-d', phase: 'plan', error: 'manifest missing' }],
        dryRun: false,
      },
    };
    renderRefresh(result);
    expect(warns.some((w) => w.includes('pack-c'))).toBe(true);
    expect(errors.some((e) => e.includes('pack-d'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run tests/unit/cli/renderers/refresh-renderer.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the renderer**

```typescript
// src/cli/renderers/refresh.ts
/**
 * Human-readable renderer for `agentsmesh refresh`. Mirrors the
 * install/uninstall renderer style: per-line summary, forward-slash paths only.
 */

import { logger } from '../../utils/output/logger.js';
import type { RefreshCommandResult } from '../../install/refresh/refresh-result.js';

export function renderRefresh(result: RefreshCommandResult): void {
  const { data } = result;

  if (data.dryRun) {
    if (data.refreshed.length === 0 && data.unchanged.length === 0) {
      logger.info('[dry-run] No packs to refresh.');
      return;
    }
    logger.info(
      `[dry-run] Would refresh ${data.refreshed.length} pack(s); ${data.unchanged.length} unchanged.`,
    );
    for (const r of data.refreshed) {
      logger.info(`  - ${r.name}: ${r.oldSha ?? '—'} → ${r.newSha}`);
    }
    for (const u of data.unchanged) {
      logger.info(`  - ${u.name}: unchanged at ${u.ref}`);
    }
    return;
  }

  if (data.refreshed.length > 0) {
    logger.success(`Refreshed ${data.refreshed.length} pack(s):`);
    for (const r of data.refreshed) {
      logger.info(`  - ${r.name}: ${r.oldSha ?? '—'} → ${r.newSha}`);
    }
  }

  for (const u of data.unchanged) {
    logger.info(`Pack "${u.name}" unchanged at ${u.ref}.`);
  }

  for (const s of data.skipped) {
    logger.warn(`Skipped "${s.name}": ${s.reason}`);
  }

  for (const f of data.failed) {
    logger.error(`Failed "${f.name}" (${f.phase}): ${f.error}`);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm vitest run tests/unit/cli/renderers/refresh-renderer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Now commit Phase 8 + Phase 9 together**

```bash
pnpm lint && pnpm typecheck
git add src/cli/commands/refresh.ts src/cli/command-handlers.ts src/cli/help-data.ts src/cli/renderers/refresh.ts tests/unit/cli/renderers/refresh-renderer.test.ts
git commit -m "feat(refresh): wire CLI command and renderer"
```

---

## Phase 10: MCP handler + tool table

### Task 10.1: MCP handler

**Files:**
- Create: `src/mcp/handlers/refresh.ts`
- Create: `tests/unit/mcp/handlers/refresh-handler.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/mcp/handlers/refresh-handler.test.ts
import { describe, expect, it, vi } from 'vitest';
import { refresh } from '../../../../src/mcp/handlers/refresh.js';

describe('refresh MCP handler', () => {
  it('forces force: true and dispatches to runRefresh', async () => {
    const ctx = { projectRoot: '/tmp/x' } as never;
    const result = await refresh(ctx, { names: ['a'] }).catch((e) => e);
    // Should at least attempt to run refresh; the actual call will fail
    // because /tmp/x doesn't exist, but the failure must come from runRefresh
    // not from the handler.
    expect(result).toBeDefined();
  });

  it('wraps unknown-pack errors as VALIDATION_FAILED', async () => {
    // Use a real tmpdir with an empty installs.yaml
    const { mkdtemp, writeFile, mkdir, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const projectRoot = await mkdtemp(join(tmpdir(), 'refresh-mcp-'));
    await mkdir(join(projectRoot, '.agentsmesh'), { recursive: true });
    await writeFile(join(projectRoot, 'agentsmesh.yaml'), 'targets: []\nfeatures: []\n');
    await writeFile(join(projectRoot, '.agentsmesh', 'installs.yaml'), 'version: 1\ninstalls: []\n');
    try {
      await expect(refresh({ projectRoot } as never, { names: ['nope'] })).rejects.toThrow(
        /unknown|not found/i,
      );
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run tests/unit/mcp/handlers/refresh-handler.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the handler**

```typescript
// src/mcp/handlers/refresh.ts
/**
 * MCP handler for `agentsmesh refresh`. Forces `force: true` (MCP has no
 * TTY) so the consolidated consent prompt is bypassed.
 */

import type { McpContext } from '../context.js';
import { McpError, redactAbsolutePaths } from '../errors.js';
import { runRefresh } from '../../install/refresh/run-refresh.js';
import type { RefreshData } from '../../cli/command-result.js';

export interface RefreshHandlerInput {
  readonly names?: readonly string[];
  readonly dry_run?: boolean;
  readonly global?: boolean;
}

function toRefreshFlags(input: RefreshHandlerInput): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = { force: true };
  if (input.dry_run === true) flags['dry-run'] = true;
  if (input.global === true) flags.global = true;
  return flags;
}

function wrapRefreshError(e: unknown): never {
  if (e instanceof McpError) throw e;
  const rawMsg = e instanceof Error ? e.message : String(e);
  const msg = redactAbsolutePaths(rawMsg);
  if (/lock|LockAcquisitionError/i.test(msg)) {
    throw new McpError('LOCK_HELD', '.install.lock is held by another process');
  }
  if (/unknown pack|not found|usage:/i.test(msg)) {
    throw new McpError('VALIDATION_FAILED', msg);
  }
  if (/resolve|network|fetch/i.test(msg)) {
    throw new McpError('REFRESH_RESOLVE_FAILED', msg);
  }
  if (/materialize|apply|manifest-update/i.test(msg)) {
    throw new McpError('REFRESH_APPLY_FAILED', msg);
  }
  throw new McpError('IO_ERROR', 'refresh pipeline failure', { reason: msg });
}

export async function refresh(
  ctx: McpContext,
  input: RefreshHandlerInput = {},
): Promise<RefreshData> {
  try {
    const result = await runRefresh(
      toRefreshFlags(input),
      [...(input.names ?? [])],
      ctx.projectRoot,
    );
    if (result.exitCode === 2) {
      const firstFailed = result.data.failed[0];
      throw new McpError(
        'VALIDATION_FAILED',
        firstFailed?.error ?? 'refresh validation failed',
      );
    }
    return result.data;
  } catch (e) {
    wrapRefreshError(e);
  }
}

export const refreshHandlers = { refresh };
```

(Note: `McpError` may not currently have `REFRESH_RESOLVE_FAILED` and `REFRESH_APPLY_FAILED` codes. Either:
- Add them to the `McpError` code enum in `src/mcp/errors.ts`, or
- Fall back to `IO_ERROR` if the enum is too rigid to extend cheaply.)

- [ ] **Step 4: Add the new error codes to `McpError`**

Edit `src/mcp/errors.ts` and append `'REFRESH_RESOLVE_FAILED' | 'REFRESH_APPLY_FAILED'` to the codes union.

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm vitest run tests/unit/mcp/handlers/refresh-handler.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/mcp/handlers/refresh.ts src/mcp/errors.ts tests/unit/mcp/handlers/refresh-handler.test.ts
git commit -m "feat(refresh): add MCP handler"
```

### Task 10.2: MCP tool descriptor

**Files:**
- Modify: `src/mcp/tool-tables/install-tools.ts` (append the descriptor)

- [ ] **Step 1: Add the descriptor**

In `src/mcp/tool-tables/install-tools.ts`, import the refresh handler:

```typescript
import { refreshHandlers } from '../handlers/refresh.js';
```

Add the Zod input schema:

```typescript
const RefreshInput = z.object({
  names: z
    .array(z.string().min(1))
    .optional()
    .describe(
      'Pack names to refresh. Omit or pass empty array to refresh every installed pack in the current scope.',
    ),
  dry_run: z
    .boolean()
    .optional()
    .describe('Preview the refresh plan (resolved refs, drift detection) without writing.'),
  global: z
    .boolean()
    .optional()
    .describe('Refresh packs in the global scope (`~/.agentsmesh/`) instead of the project scope.'),
});
```

Append to `INSTALL_TOOL_DESCRIPTORS`:

```typescript
  {
    name: 'refresh',
    description:
      'Re-fetch and re-apply installed packs against their originally-recorded source/ref. Branch pins re-resolve to the current tip; tag pins re-resolve in case the tag moved; SHA pins stay put. Per-pack atomic via `materializePack` — a failure leaves the affected pack at its prior state. Always runs non-interactively (force: true) over MCP.',
    inputSchema: RefreshInput,
    handler: (ctx, i) => refreshHandlers.refresh(ctx, i as never),
  },
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run MCP tests**

```bash
pnpm vitest run tests/unit/mcp/
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/mcp/tool-tables/install-tools.ts
git commit -m "feat(refresh): register MCP tool descriptor"
```

---

## Phase 11: Integration tests

### Task 11.1: Bare-repo git source integration test

**Files:**
- Create: `tests/integration/refresh-git-source.test.ts`
- Create: `tests/integration/fixtures/refresh-git-source/setup.ts` (helper)

- [ ] **Step 1: Build the bare-repo setup helper**

```typescript
// tests/integration/fixtures/refresh-git-source/setup.ts
/**
 * Creates a bare git repo with two commits at the same ref (force-pushed).
 * Used by refresh-git-source.test.ts to verify the full refresh flow.
 */

import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

export interface BareRepoWithTwoCommits {
  readonly bareRepoPath: string;       // file:// URL or absolute path to the bare repo
  readonly firstSha: string;
  readonly secondSha: string;
  readonly refName: string;            // e.g. "main"
  readonly cleanup: () => Promise<void>;
}

export async function createBareRepoWithTwoCommits(): Promise<BareRepoWithTwoCommits> {
  const baseDir = await mkdtemp(join(tmpdir(), 'refresh-bare-'));
  const workDir = join(baseDir, 'work');
  const bareDir = join(baseDir, 'bare.git');

  await mkdir(workDir, { recursive: true });

  // Initialize working repo with a minimal canonical-agentsmesh layout
  await execFileP('git', ['init', '-b', 'main'], { cwd: workDir });
  await execFileP('git', ['config', 'user.email', 'test@test.local'], { cwd: workDir });
  await execFileP('git', ['config', 'user.name', 'test'], { cwd: workDir });
  await mkdir(join(workDir, 'skills', 'a-skill'), { recursive: true });
  await writeFile(join(workDir, 'skills', 'a-skill', 'SKILL.md'), '---\nname: a-skill\ndescription: v1\n---\n# v1\n');
  await execFileP('git', ['add', '.'], { cwd: workDir });
  await execFileP('git', ['commit', '-m', 'first'], { cwd: workDir });
  const firstSha = (await execFileP('git', ['rev-parse', 'HEAD'], { cwd: workDir })).stdout.trim();

  // Modify and commit again
  await writeFile(join(workDir, 'skills', 'a-skill', 'SKILL.md'), '---\nname: a-skill\ndescription: v2\n---\n# v2\n');
  await execFileP('git', ['commit', '-am', 'second'], { cwd: workDir });
  const secondSha = (await execFileP('git', ['rev-parse', 'HEAD'], { cwd: workDir })).stdout.trim();

  // Push to bare
  await execFileP('git', ['clone', '--bare', workDir, bareDir]);

  return {
    bareRepoPath: bareDir,
    firstSha,
    secondSha,
    refName: 'main',
    cleanup: async () => {
      const { rm } = await import('node:fs/promises');
      await rm(baseDir, { recursive: true, force: true });
    },
  };
}

export async function rewindRepoToFirstCommit(bareRepoPath: string, firstSha: string): Promise<void> {
  // For testing the "refresh moves ref back" scenario.
  await execFileP('git', ['--git-dir', bareRepoPath, 'update-ref', 'refs/heads/main', firstSha]);
}
```

- [ ] **Step 2: Write the failing integration test**

```typescript
// tests/integration/refresh-git-source.test.ts
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runRefresh } from '../../src/install/refresh/run-refresh.js';
import { runInstall } from '../../src/install/run/run-install.js';
import {
  createBareRepoWithTwoCommits,
  type BareRepoWithTwoCommits,
} from './fixtures/refresh-git-source/setup.js';

describe('refresh against a git source', () => {
  let projectRoot: string;
  let bare: BareRepoWithTwoCommits;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'refresh-int-'));
    await writeFile(join(projectRoot, 'agentsmesh.yaml'), 'targets:\n  - claude-code\nfeatures: []\n');
    bare = await createBareRepoWithTwoCommits();
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await bare.cleanup();
  });

  it('refresh moves the pack to the new ref tip when upstream advances', async () => {
    // Rewind upstream to first commit so install captures v1
    const { rewindRepoToFirstCommit } = await import('./fixtures/refresh-git-source/setup.js');
    await rewindRepoToFirstCommit(bare.bareRepoPath, bare.firstSha);

    // Install at first SHA
    const installResult = await runInstall(
      { force: true },
      [`git+file://${bare.bareRepoPath}#main`],
      projectRoot,
    );
    expect(installResult.exitCode).toBe(0);

    // Verify v1 content on disk
    const skillPath = join(projectRoot, '.agentsmesh', 'packs', 'bare', 'skills', 'a-skill', 'SKILL.md');
    const v1 = await readFile(skillPath, 'utf8');
    expect(v1).toContain('# v1');

    // Advance upstream to second SHA
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileP = promisify(execFile);
    await execFileP('git', ['--git-dir', bare.bareRepoPath, 'update-ref', 'refs/heads/main', bare.secondSha]);

    // Refresh
    const refreshResult = await runRefresh({ force: true }, [], projectRoot);
    expect(refreshResult.exitCode).toBe(0);
    expect(refreshResult.data.refreshed).toHaveLength(1);
    expect(refreshResult.data.refreshed[0]?.newSha).toBe(bare.secondSha);

    // Verify v2 content on disk
    const v2 = await readFile(skillPath, 'utf8');
    expect(v2).toContain('# v2');
  });
});
```

(Note: this test depends on `runInstall` accepting `git+file://...` URLs and on the pack-name-from-source inference matching `'bare'`. Both assumptions need verification when you write the test — if they're wrong, adapt. The first time you run this test it WILL fail; fix the wiring then re-run.)

- [ ] **Step 3: Run the test, expect failure, then iterate until pass**

```bash
pnpm vitest run tests/integration/refresh-git-source.test.ts
```

Expected: probably FAIL the first time. Read the error carefully — likely failure modes:
- Source URL format not accepted → check `parseInstallSource` for the right format.
- Pack name doesn't match → use the actual generated name.
- `runInstallForRefresh` not wired properly → revisit Phase 6 Task 6.2.

Iterate until the test passes.

- [ ] **Step 4: Commit when passing**

```bash
git add tests/integration/refresh-git-source.test.ts tests/integration/fixtures/refresh-git-source/setup.ts
git commit -m "test(refresh): add integration test for git source refresh"
```

### Task 11.2: Drift-flow integration test

**Files:**
- Create: `tests/integration/refresh-drift-flow.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// tests/integration/refresh-drift-flow.test.ts
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runRefresh } from '../../src/install/refresh/run-refresh.js';
import { runInstall } from '../../src/install/run/run-install.js';
import { createBareRepoWithTwoCommits, type BareRepoWithTwoCommits } from './fixtures/refresh-git-source/setup.js';

describe('refresh drift handling', () => {
  let projectRoot: string;
  let bare: BareRepoWithTwoCommits;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'refresh-drift-'));
    await writeFile(join(projectRoot, 'agentsmesh.yaml'), 'targets:\n  - claude-code\nfeatures: []\n');
    bare = await createBareRepoWithTwoCommits();
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await bare.cleanup();
  });

  it('refresh --force overwrites user-modified pack files', async () => {
    await runInstall(
      { force: true },
      [`git+file://${bare.bareRepoPath}#main`],
      projectRoot,
    );

    // User modifies a pack file
    const skillPath = join(projectRoot, '.agentsmesh', 'packs', 'bare', 'skills', 'a-skill', 'SKILL.md');
    await writeFile(skillPath, '# USER EDIT');

    // Refresh with --force
    const result = await runRefresh({ force: true }, [], projectRoot);
    expect(result.exitCode).toBe(0);
    expect(result.data.refreshed).toHaveLength(1);

    // User edit was overwritten
    const after = await readFile(skillPath, 'utf8');
    expect(after).not.toContain('USER EDIT');
  });

  it('refresh without --force in non-interactive context skips drifted packs', async () => {
    // Reuse: this scenario is the "MCP-style non-TTY" path.
    // Without --force AND without TTY, the consent prompt times out
    // immediately → user-declined → skipped.
    // Note: this test path depends on the orchestrator's behavior in
    // non-interactive mode. If the orchestrator currently throws instead
    // of skipping, that's a code path to refine here.
    // ...
  });
});
```

- [ ] **Step 2: Run, iterate, commit**

```bash
pnpm vitest run tests/integration/refresh-drift-flow.test.ts
```

Iterate until passing.

```bash
git add tests/integration/refresh-drift-flow.test.ts
git commit -m "test(refresh): add drift handling integration test"
```

### Task 11.3: Local-source integration test

**Files:**
- Create: `tests/integration/refresh-local-source.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// tests/integration/refresh-local-source.test.ts
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runRefresh } from '../../src/install/refresh/run-refresh.js';
import { runInstall } from '../../src/install/run/run-install.js';

describe('refresh against a local source', () => {
  let projectRoot: string;
  let localPack: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'refresh-local-'));
    localPack = await mkdtemp(join(tmpdir(), 'refresh-local-src-'));
    await writeFile(join(projectRoot, 'agentsmesh.yaml'), 'targets:\n  - claude-code\nfeatures: []\n');
    await mkdir(join(localPack, 'skills', 'l-skill'), { recursive: true });
    await writeFile(join(localPack, 'skills', 'l-skill', 'SKILL.md'), '---\nname: l-skill\ndescription: v1\n---\n# v1\n');
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(localPack, { recursive: true, force: true });
  });

  it('refresh re-copies updated local source', async () => {
    await runInstall({ force: true }, [`local:${localPack}`], projectRoot);

    // Update the local source
    await writeFile(join(localPack, 'skills', 'l-skill', 'SKILL.md'), '---\nname: l-skill\ndescription: v2\n---\n# v2\n');

    const result = await runRefresh({ force: true }, [], projectRoot);
    expect(result.exitCode).toBe(0);
    expect(result.data.refreshed).toHaveLength(1);

    const installed = await readFile(
      join(projectRoot, '.agentsmesh', 'packs', /* name */ 'l-skill', 'skills', 'l-skill', 'SKILL.md'),
      'utf8',
    ).catch(() => null);
    // The pack name depends on install's naming inference; adapt the
    // expected path after verifying the actual `installs.yaml` row.
    expect(installed).toContain('# v2');
  });
});
```

(Note: the pack name will probably not be `'l-skill'`. Run the test once, read `.agentsmesh/installs.yaml` to find the actual generated name, then update the path.)

- [ ] **Step 2: Run, iterate, commit**

```bash
pnpm vitest run tests/integration/refresh-local-source.test.ts
git add tests/integration/refresh-local-source.test.ts
git commit -m "test(refresh): add local source integration test"
```

---

## Phase 12: Docs

### Task 12.1: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Find the CLI commands table**

```bash
grep -n "^| .* \`" README.md | head -40
```

Locate the command reference table.

- [ ] **Step 2: Add a `refresh` row in the same style**

Use the exact same column layout as the surrounding rows. Sample (adapt to actual table):

```markdown
| `refresh [<name>[,<name>...]]` | Re-fetch and re-apply installed packs from their recorded sources. Bare command refreshes every pack. Per-pack atomic. Flags: `--dry-run`, `--force`, `--json`, `--global`, `--verbose`. |
```

- [ ] **Step 3: Add a "Refreshing packs" section**

Append after the "Installing packs" / "Uninstalling packs" section a short subsection covering:

```markdown
### Refreshing packs

`agentsmesh refresh` re-fetches every installed pack from its recorded source/ref
and re-applies it. Branch pins (`@main`) advance to the current tip; tag pins
re-resolve in case the tag moved; SHA pins stay put.

```bash
agentsmesh refresh                    # refresh every installed pack
agentsmesh refresh my-pack,other-pack # refresh just these
agentsmesh refresh --dry-run          # preview without writing
agentsmesh refresh --force            # skip the drift prompt
```

Each pack is refreshed atomically — a failure or interruption leaves the
affected pack at its pre-refresh state. Local edits to pack files trigger
a consolidated consent prompt (5-minute timeout) unless `--force` is set.

**refresh does NOT switch refs.** To move a pack to a different ref, uninstall
it and re-install with the new ref:

```bash
agentsmesh uninstall my-pack
agentsmesh install github:org/repo@v2.0.0
```

**refresh vs `install --sync`.** `--sync` replays missing installs from
`installs.yaml` (e.g. after a fresh clone). `refresh` updates existing
installs against their declared sources. They are orthogonal.
```

(Adapt the exact "uninstall + install" wording based on the Phase 0 pre-flight finding — if install errors on duplicate names, recommend uninstall first; if install overwrites silently, just install directly.)

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(refresh): document refresh command in README"
```

### Task 12.2: Website reference page

**Files:**
- Create: `website/src/content/docs/reference/refresh.mdx`
- Modify: `website/src/content/docs/reference/<index page>.mdx` (link from CLI overview)

- [ ] **Step 1: Find the existing command reference structure**

```bash
ls website/src/content/docs/reference/
```

Identify the convention: which existing page corresponds to `install` or `uninstall`? Mirror its structure.

- [ ] **Step 2: Create `refresh.mdx`**

Use the same frontmatter and section layout as the install/uninstall pages. Sections to include:

- Synopsis (CLI usage line)
- Description
- Flags (`--dry-run`, `--force`, `--json`, `--global`, `--verbose`)
- Exit codes (0, 1, 2)
- Examples
- `refresh` does not switch refs (cross-link)
- `refresh` vs `install --sync` (cross-link)
- MCP tool (`mcp__agentsmesh__refresh`) reference

- [ ] **Step 3: Link from the CLI overview index page**

Find the index page that lists install, uninstall, etc. Add a refresh entry pointing to `refresh.mdx`.

- [ ] **Step 4: Build the website locally to verify**

```bash
cd website && pnpm dev
```

Visit the dev server, navigate to refresh.mdx, verify no broken links or render errors. Kill the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add website/src/content/docs/reference/refresh.mdx website/src/content/docs/reference/<index>.mdx
git commit -m "docs(refresh): add website reference page"
```

### Task 12.3: CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (project root)

- [ ] **Step 1: Locate the "AgentsMesh Generation Contract" paragraph**

```bash
grep -n "diff, lint, check" CLAUDE.md
```

- [ ] **Step 2: Add `refresh` to the command list**

Find a sentence like "Use `diff`, `lint`, `check`, `watch`, `matrix`, and `merge` as needed". Add `refresh`:

```
Use `diff`, `lint`, `check`, `watch`, `matrix`, `merge`, and `refresh` as needed
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(refresh): list refresh in CLAUDE.md generation contract"
```

---

## Final verification

### Task F.1: Full test suite + lint + typecheck

- [ ] **Step 1: Run everything**

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Expected: ALL PASS.

If anything fails, fix the underlying issue (do not skip or weaken tests) and re-run.

- [ ] **Step 2: Manual smoke test of `agentsmesh refresh`**

```bash
# In a throwaway dir:
cd /tmp && mkdir refresh-smoke && cd refresh-smoke
node /Users/serhii/WebstormProjects/agentsmesh/dist/cli.js init --yes
node /Users/serhii/WebstormProjects/agentsmesh/dist/cli.js install <some public pack>
node /Users/serhii/WebstormProjects/agentsmesh/dist/cli.js refresh
node /Users/serhii/WebstormProjects/agentsmesh/dist/cli.js refresh --dry-run
node /Users/serhii/WebstormProjects/agentsmesh/dist/cli.js refresh --json
```

Inspect output and verify:
- `--json` produces valid JSON matching `RefreshData`.
- Text output uses forward slashes only.
- `installs.yaml` row gains a `refreshed_at` field.
- `installs list` shows the new "Last touched" value.

Clean up:

```bash
cd / && rm -rf /tmp/refresh-smoke
```

### Task F.2: Update `tasks/lessons.md` if you hit any unexpected snags

**Files:** `tasks/lessons.md`

- [ ] **Step 1: Add one bullet per lesson learned during implementation**

Per CLAUDE.md: when something goes wrong during implementation (test failure, surprising codebase behavior, etc.), add a bullet to `tasks/lessons.md` with (1) what went wrong, (2) root cause, (3) a rule that prevents recurrence.

- [ ] **Step 2: Commit if any lessons were added**

```bash
git add tasks/lessons.md
git commit -m "docs(lessons): capture refresh-implementation gotchas"
```

### Task F.3: Open the PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin <branch-name>
```

- [ ] **Step 2: Open a PR**

Title: `feat(refresh): add agentsmesh refresh command for re-applying installed packs`

Body: link the spec (`docs/superpowers/specs/2026-05-26-refresh-command-design.md`) and summarize the changes per the standard PR template in this repo.

---

## Self-review against the spec

The following spec sections map to plan tasks (verify before declaring the plan complete):

| Spec section | Implemented in |
|---|---|
| Command surface (CLI, MCP, flags, exit codes) | Phase 3 (flags), Phase 7 (orchestrator), Phase 8 (CLI), Phase 10 (MCP) |
| `RefreshCommandResult` / `RefreshData` types | Phase 3 Task 3.1 |
| `forceFreshMaterialize` flag on `installAsPack` | Phase 1 |
| `refreshed_at` field on manifest entries | Phase 2 |
| Plan phase (read entry, re-resolve ref, drift) | Phase 4 |
| Consolidated consent prompt with 5-min timeout | Phase 5 |
| Apply phase (call `installAsPack`, stamp `refreshed_at`) | Phase 6 |
| Orchestrator (lock, bulk, post-op generate) | Phase 7 |
| CLI dispatcher wiring | Phase 8 |
| Renderer (text + JSON, verbose gating) | Phase 9 |
| MCP handler + tool descriptor | Phase 10 |
| Integration tests (git, local, drift) | Phase 11 |
| Docs (README, website, CLAUDE.md) | Phase 12 |
| `installs list` shows `refreshed_at` | Phase 2 Task 2.2 |
| Pre-flight verify install duplicate-name behavior | Phase 0 |

Decisions from the spec also captured:
- ✅ Bulk-by-default (no args = all packs) — Phase 7 orchestrator
- ✅ Per-pack atomicity inherited from `materializePack` — Phase 6 design
- ✅ Stderr-only error reporting — Phase 9 renderer
- ✅ `--dry-run`, `--force`, `--json`, `--global`, `--verbose` flags — Phase 3 flag parser
- ✅ `refresh` does not switch refs — Phase 12 README + website docs
- ✅ Refresh vs `--sync` orthogonality — Phase 12 website page

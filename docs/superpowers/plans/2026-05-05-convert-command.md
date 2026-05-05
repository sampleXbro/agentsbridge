# Convert Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `agentsmesh convert --from <source> --to <target>` for direct tool-to-tool conversion without canonical setup.

**Architecture:** Creates a temp directory with symlinks to the real project's top-level entries (excluding `.agentsmesh`), runs the existing import pipeline into the temp dir's canonical space, loads canonical from there in memory, then runs the generate engine targeting the destination tool. Results are written to the real project root. Temp dir is always cleaned up via `try/finally`.

**Tech Stack:** TypeScript, Vitest, Node.js `fs` symlinks, existing import/generate engine

**Spec:** `docs/superpowers/specs/2026-05-05-convert-command-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/cli/commands/convert.ts` | `runConvert()` — validation, temp dir, import→canonical→generate pipeline |
| Create | `src/cli/renderers/convert.ts` | `renderConvert()` — human-readable output |
| Modify | `src/cli/command-result.ts` | Add `ConvertData` interface |
| Modify | `src/cli/command-handlers.ts` | Add `convert` entry to `cmdHandlers` |
| Create | `tests/unit/cli/commands/convert.test.ts` | Unit tests for `runConvert()` |
| Create | `tests/unit/cli/renderers/convert.test.ts` | Unit tests for `renderConvert()` |
| Modify | `tests/unit/cli/command-handlers.test.ts` | Add convert handler delegation test |
| Create | `tests/integration/convert.integration.test.ts` | Integration tests with real files |
| Create | `tests/e2e/convert.e2e.test.ts` | E2E tests via CLI spawn |
| Create | `.changeset/add-convert-command.md` | Changeset for release |

---

### Task 1: Add `ConvertData` type

**Files:**
- Modify: `src/cli/command-result.ts`

- [ ] **Step 1: Add `ConvertData` interface**

In `src/cli/command-result.ts`, add after the `TargetData` interface (line 108):

```typescript
export interface ConvertData {
  from: string;
  to: string;
  mode: 'convert' | 'dry-run';
  files: Array<{ path: string; target: string; status: 'created' | 'updated' | 'unchanged' }>;
  summary: { created: number; updated: number; unchanged: number };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/cli/command-result.ts
git commit -m "feat(cli): add ConvertData result type"
```

---

### Task 2: Create renderer with tests (TDD)

**Files:**
- Create: `src/cli/renderers/convert.ts`
- Create: `tests/unit/cli/renderers/convert.test.ts`

- [ ] **Step 1: Write failing renderer tests**

Create `tests/unit/cli/renderers/convert.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { renderConvert } from '../../../../src/cli/renderers/convert.js';
import { useCapturedOutput } from './renderer-test-helpers.js';

describe('renderConvert', () => {
  const output = useCapturedOutput();

  it('prints nothing-to-convert message when no files', () => {
    renderConvert({
      exitCode: 0,
      data: {
        from: 'claude-code',
        to: 'cursor',
        mode: 'convert',
        files: [],
        summary: { created: 0, updated: 0, unchanged: 0 },
      },
    });

    expect(output.stdout()).toContain('No files found to convert from claude-code');
  });

  it('prints created/updated files and summary', () => {
    renderConvert({
      exitCode: 0,
      data: {
        from: 'claude-code',
        to: 'cursor',
        mode: 'convert',
        files: [
          { path: '.cursor/rules/root.mdc', target: 'cursor', status: 'created' },
          { path: '.cursor/rules/ts.mdc', target: 'cursor', status: 'updated' },
        ],
        summary: { created: 1, updated: 1, unchanged: 0 },
      },
    });

    const out = output.stdout();
    expect(out).toContain('created .cursor/rules/root.mdc');
    expect(out).toContain('updated .cursor/rules/ts.mdc');
    expect(out).toContain('Converted from claude-code');
    expect(out).toContain('cursor');
    expect(out).toContain('1 created');
    expect(out).toContain('1 updated');
  });

  it('prefixes lines with [dry-run] in dry-run mode', () => {
    renderConvert({
      exitCode: 0,
      data: {
        from: 'claude-code',
        to: 'cursor',
        mode: 'dry-run',
        files: [
          { path: '.cursor/rules/root.mdc', target: 'cursor', status: 'created' },
        ],
        summary: { created: 1, updated: 0, unchanged: 0 },
      },
    });

    const out = output.stdout();
    expect(out).toContain('[dry-run]');
    expect(out).toContain('created');
    expect(out).toContain('.cursor/rules/root.mdc');
    expect(out).toContain('cursor');
  });

  it('skips unchanged files in normal mode', () => {
    renderConvert({
      exitCode: 0,
      data: {
        from: 'claude-code',
        to: 'cursor',
        mode: 'convert',
        files: [
          { path: '.cursor/rules/root.mdc', target: 'cursor', status: 'unchanged' },
        ],
        summary: { created: 0, updated: 0, unchanged: 1 },
      },
    });

    const out = output.stdout();
    expect(out).not.toContain('.cursor/rules/root.mdc');
    expect(out).toContain('Nothing changed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/cli/renderers/convert.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement renderer**

Create `src/cli/renderers/convert.ts`:

```typescript
import { logger } from '../../utils/output/logger.js';
import type { ConvertData } from '../command-result.js';

interface ConvertCommandResult {
  exitCode: number;
  data: ConvertData;
}

export function renderConvert(result: ConvertCommandResult): void {
  const { data } = result;

  if (data.files.length === 0) {
    logger.info(`No files found to convert from ${data.from}.`);
    return;
  }

  if (data.mode === 'dry-run') {
    for (const f of data.files) {
      logger.info(`[dry-run] ${f.status} ${f.path} (${f.target})`);
    }
    return;
  }

  for (const f of data.files) {
    if (f.status === 'created' || f.status === 'updated') {
      logger.success(`${f.status} ${f.path}`);
    }
  }

  const { created, updated, unchanged } = data.summary;
  if (created > 0 || updated > 0) {
    logger.info(
      `Converted from ${data.from} → ${data.to}: ${created} created, ${updated} updated, ${unchanged} unchanged`,
    );
  } else {
    logger.info(`Nothing changed. (${unchanged} unchanged)`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/cli/renderers/convert.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/renderers/convert.ts tests/unit/cli/renderers/convert.test.ts
git commit -m "feat(cli): add convert command renderer with tests"
```

---

### Task 3: Create convert command with tests (TDD)

**Files:**
- Create: `src/cli/commands/convert.ts`
- Create: `tests/unit/cli/commands/convert.test.ts`

- [ ] **Step 1: Write failing validation tests**

Create `tests/unit/cli/commands/convert.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runConvert } from '../../../../src/cli/commands/convert.js';

const TEST_DIR = join(tmpdir(), 'am-convert-cmd-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('runConvert', () => {
  it('throws when --from is missing', async () => {
    await expect(runConvert({ to: 'cursor' }, TEST_DIR)).rejects.toThrow(/--from.*required/i);
  });

  it('throws when --to is missing', async () => {
    await expect(runConvert({ from: 'claude-code' }, TEST_DIR)).rejects.toThrow(/--to.*required/i);
  });

  it('throws when --from and --to are the same', async () => {
    await expect(
      runConvert({ from: 'cursor', to: 'cursor' }, TEST_DIR),
    ).rejects.toThrow(/must be different/i);
  });

  it('throws for unknown --from target', async () => {
    await expect(
      runConvert({ from: 'fake-tool', to: 'cursor' }, TEST_DIR),
    ).rejects.toThrow(/unknown.*from/i);
  });

  it('throws for unknown --to target', async () => {
    await expect(
      runConvert({ from: 'cursor', to: 'fake-tool' }, TEST_DIR),
    ).rejects.toThrow(/unknown.*to/i);
  });

  it('converts claude-code rules to cursor output', async () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Root Rules\n\nUse TypeScript.');
    const result = await runConvert({ from: 'claude-code', to: 'cursor' }, TEST_DIR);

    expect(result.exitCode).toBe(0);
    expect(result.data.from).toBe('claude-code');
    expect(result.data.to).toBe('cursor');
    expect(result.data.mode).toBe('convert');
    expect(result.data.files.length).toBeGreaterThan(0);

    const cursorRoot = readFileSync(join(TEST_DIR, '.cursor', 'rules', 'root.mdc'), 'utf-8');
    expect(cursorRoot).toContain('Use TypeScript');
  });

  it('converts cursor rules to claude-code output', async () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'rules', 'root.mdc'),
      '---\nalwaysApply: true\n---\n\n# Root\n\nUse TDD.',
    );
    const result = await runConvert({ from: 'cursor', to: 'claude-code' }, TEST_DIR);

    expect(result.exitCode).toBe(0);
    expect(result.data.from).toBe('cursor');
    expect(result.data.to).toBe('claude-code');
    expect(result.data.files.length).toBeGreaterThan(0);

    const claudeFile = readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8');
    expect(claudeFile).toContain('Use TDD');
  });

  it('does not create .agentsmesh directory', async () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Root\n');
    await runConvert({ from: 'claude-code', to: 'cursor' }, TEST_DIR);

    expect(existsSync(join(TEST_DIR, '.agentsmesh'))).toBe(false);
  });

  it('preserves existing .agentsmesh directory', async () => {
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Existing\n',
    );
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Root\n');

    await runConvert({ from: 'claude-code', to: 'cursor' }, TEST_DIR);

    const preserved = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      'utf-8',
    );
    expect(preserved).toContain('# Existing');
  });

  it('dry-run does not write files', async () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Root\n');
    const result = await runConvert(
      { from: 'claude-code', to: 'cursor', 'dry-run': true },
      TEST_DIR,
    );

    expect(result.exitCode).toBe(0);
    expect(result.data.mode).toBe('dry-run');
    expect(existsSync(join(TEST_DIR, '.cursor'))).toBe(false);
  });

  it('returns empty files when source has nothing to import', async () => {
    const result = await runConvert({ from: 'claude-code', to: 'cursor' }, TEST_DIR);

    expect(result.exitCode).toBe(0);
    expect(result.data.files).toEqual([]);
  });

  it('preserves source tool files after conversion', async () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Keep me\n');
    await runConvert({ from: 'claude-code', to: 'cursor' }, TEST_DIR);

    expect(readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')).toContain('# Keep me');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/cli/commands/convert.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `runConvert`**

Create `src/cli/commands/convert.ts`:

```typescript
import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  TARGET_IDS,
  isBuiltinTargetId,
} from '../../targets/catalog/target-catalog.js';
import { getDescriptor } from '../../targets/catalog/registry.js';
import { loadCanonicalFiles } from '../../canonical/load/loader.js';
import { generate as runEngine } from '../../core/generate/engine.js';
import { writeFileAtomic } from '../../utils/filesystem/fs.js';
import { ensurePathInsideRoot } from './generate-path.js';
import { loadScopedConfig } from '../../config/core/scope.js';
import { bootstrapPlugins } from '../../plugins/bootstrap-plugins.js';
import { configSchema } from '../../config/core/schema.js';
import type { ConvertData } from '../command-result.js';

export interface ConvertCommandResult {
  exitCode: number;
  data: ConvertData;
}

function createTempProjectRoot(projectRoot: string): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'am-convert-'));
  const entries = readdirSync(projectRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.agentsmesh') continue;
    const src = join(projectRoot, entry.name);
    const dest = join(tempDir, entry.name);
    symlinkSync(src, dest, entry.isDirectory() ? 'dir' : 'file');
  }
  mkdirSync(join(tempDir, '.agentsmesh'), { recursive: true });
  return tempDir;
}

export async function runConvert(
  flags: Record<string, string | boolean>,
  projectRoot?: string,
): Promise<ConvertCommandResult> {
  const root = projectRoot ?? process.cwd();
  const from = flags.from;
  const to = flags.to;

  if (typeof from !== 'string' || !from) {
    throw new Error(
      '--from is required. Example: agentsmesh convert --from cursor --to claude-code',
    );
  }
  if (typeof to !== 'string' || !to) {
    throw new Error(
      '--to is required. Example: agentsmesh convert --from cursor --to claude-code',
    );
  }

  const fromNorm = from.toLowerCase().trim();
  const toNorm = to.toLowerCase().trim();

  if (fromNorm === toNorm) {
    throw new Error('--from and --to must be different targets.');
  }

  const fromBuiltin = isBuiltinTargetId(fromNorm);
  const toBuiltin = isBuiltinTargetId(toNorm);

  if (!fromBuiltin || !toBuiltin) {
    try {
      const { config } = await loadScopedConfig(root, 'project');
      await bootstrapPlugins(config, root);
    } catch {
      const unknown: string[] = [];
      if (!fromBuiltin) unknown.push(`--from "${from}"`);
      if (!toBuiltin) unknown.push(`--to "${to}"`);
      throw new Error(
        `Unknown ${unknown.join(' and ')}. ` +
          `Supported: ${TARGET_IDS.join(', ')}.`,
      );
    }
  }

  const fromDescriptor = getDescriptor(fromNorm);
  if (!fromDescriptor) {
    throw new Error(
      `Unknown --from "${from}". Supported: ${TARGET_IDS.join(', ')}.`,
    );
  }
  const toDescriptor = getDescriptor(toNorm);
  if (!toDescriptor) {
    throw new Error(
      `Unknown --to "${to}". Supported: ${TARGET_IDS.join(', ')}.`,
    );
  }

  const dryRun = flags['dry-run'] === true;
  const mode: ConvertData['mode'] = dryRun ? 'dry-run' : 'convert';

  const tempDir = createTempProjectRoot(root);
  try {
    await fromDescriptor.generators.importFrom(tempDir, { scope: 'project' });

    const canonical = await loadCanonicalFiles(tempDir);

    const config = configSchema.parse({
      version: 1,
      targets: toBuiltin ? [toNorm] : [],
      pluginTargets: toBuiltin ? [] : [toNorm],
    });

    const results = await runEngine({
      config,
      canonical,
      projectRoot: root,
      scope: 'project',
      targetFilter: [toNorm],
    });

    if (!dryRun) {
      for (const r of results) {
        if (r.status === 'created' || r.status === 'updated') {
          const fullPath = ensurePathInsideRoot(root, r.path, r.target);
          await writeFileAtomic(fullPath, r.content);
        }
      }
    }

    const actionable = results.filter((r) => r.status !== 'skipped');
    const files = actionable.map((r) => ({
      path: r.path,
      target: r.target,
      status: r.status as 'created' | 'updated' | 'unchanged',
    }));

    return {
      exitCode: 0,
      data: {
        from: fromNorm,
        to: toNorm,
        mode,
        files,
        summary: {
          created: actionable.filter((r) => r.status === 'created').length,
          updated: actionable.filter((r) => r.status === 'updated').length,
          unchanged: actionable.filter((r) => r.status === 'unchanged').length,
        },
      },
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: Update renderer to import from command file**

In `src/cli/renderers/convert.ts`, replace the local `ConvertCommandResult` interface and `ConvertData` import with:

```typescript
import type { ConvertCommandResult } from '../commands/convert.js';
```

Remove the local `ConvertCommandResult` interface and the `ConvertData` import.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/cli/commands/convert.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Run renderer tests still pass**

Run: `npx vitest run tests/unit/cli/renderers/convert.test.ts`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/cli/commands/convert.ts tests/unit/cli/commands/convert.test.ts src/cli/renderers/convert.ts
git commit -m "feat(cli): implement convert command with unit tests"
```

---

### Task 4: Wire up command handler with tests (TDD)

**Files:**
- Modify: `src/cli/command-handlers.ts`
- Modify: `tests/unit/cli/command-handlers.test.ts`

- [ ] **Step 1: Write failing handler test**

In `tests/unit/cli/command-handlers.test.ts`, add imports at the top with the other mocks:

```typescript
import { runConvert } from '../../../src/cli/commands/convert.js';
import { renderConvert } from '../../../src/cli/renderers/convert.js';
```

Add mocks with the other `vi.mock` calls:

```typescript
vi.mock('../../../src/cli/commands/convert.js', () => ({ runConvert: vi.fn() }));
vi.mock('../../../src/cli/renderers/convert.js', () => ({ renderConvert: vi.fn() }));
```

Add result fixture inside the `describe` block with the other result fixtures:

```typescript
const convertResult = {
  exitCode: 0,
  data: {
    from: 'claude-code',
    to: 'cursor',
    mode: 'convert' as const,
    files: [],
    summary: { created: 0, updated: 0, unchanged: 0 },
  },
};
```

Add mock setup in `beforeEach` with the other mock setups:

```typescript
vi.mocked(runConvert).mockResolvedValue(convertResult);
```

Add test case:

```typescript
it('delegates convert to runConvert and renderConvert', async () => {
  await cmdHandlers.convert({ from: 'claude-code', to: 'cursor' }, []);

  expect(runConvert).toHaveBeenCalledWith({ from: 'claude-code', to: 'cursor' });
  expect(handleResult).toHaveBeenCalledWith(
    'convert',
    convertResult,
    { from: 'claude-code', to: 'cursor' },
    expect.any(Function),
  );
  expect(renderConvert).toHaveBeenCalledWith(convertResult);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/cli/command-handlers.test.ts`
Expected: FAIL — `cmdHandlers.convert` is undefined

- [ ] **Step 3: Wire up handler**

In `src/cli/command-handlers.ts`, add imports:

```typescript
import { runConvert } from './commands/convert.js';
import { renderConvert } from './renderers/convert.js';
```

Add handler entry inside `cmdHandlers` (after the `target` entry):

```typescript
convert: async (flags, _args) => {
  void _args;
  const result = await runConvert(flags);
  handleResult('convert', result, flags, () => renderConvert(result));
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/cli/command-handlers.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run all unit tests**

Run: `npx vitest run tests/unit/cli/`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/cli/command-handlers.ts tests/unit/cli/command-handlers.test.ts
git commit -m "feat(cli): wire convert command into CLI handler table"
```

---

### Task 5: Integration tests

**Files:**
- Create: `tests/integration/convert.integration.test.ts`

- [ ] **Step 1: Write integration tests**

Create `tests/integration/convert.integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const TEST_DIR = join(tmpdir(), 'am-integration-convert');
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('agentsmesh convert (integration)', () => {
  it('converts claude-code to cursor', () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Root\n\nUse TypeScript.');
    mkdirSync(join(TEST_DIR, '.claude', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'rules', 'testing.md'), '# Testing\n\nWrite tests first.');

    execSync(`node ${CLI_PATH} convert --from claude-code --to cursor`, {
      cwd: TEST_DIR,
      stdio: 'pipe',
    });

    const rootRule = readFileSync(join(TEST_DIR, '.cursor', 'rules', 'root.mdc'), 'utf-8');
    expect(rootRule).toContain('Use TypeScript');

    expect(existsSync(join(TEST_DIR, '.agentsmesh'))).toBe(false);

    expect(readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')).toContain('Use TypeScript');
  });

  it('converts cursor to claude-code', () => {
    mkdirSync(join(TEST_DIR, '.cursor', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'rules', 'root.mdc'),
      '---\nalwaysApply: true\n---\n\n# Root\n\nUse TDD.',
    );

    execSync(`node ${CLI_PATH} convert --from cursor --to claude-code`, {
      cwd: TEST_DIR,
      stdio: 'pipe',
    });

    const claudeFile = readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8');
    expect(claudeFile).toContain('Use TDD');

    expect(existsSync(join(TEST_DIR, '.agentsmesh'))).toBe(false);
  });

  it('--dry-run does not write files', () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Root\n');

    execSync(`node ${CLI_PATH} convert --from claude-code --to cursor --dry-run`, {
      cwd: TEST_DIR,
      stdio: 'pipe',
    });

    expect(existsSync(join(TEST_DIR, '.cursor'))).toBe(false);
  });

  it('--json returns valid ConvertData envelope', () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Root\n\nUse TypeScript.');

    const stdout = execSync(
      `node ${CLI_PATH} convert --from claude-code --to cursor --json`,
      { cwd: TEST_DIR, encoding: 'utf-8' },
    );

    const envelope = JSON.parse(stdout) as {
      command: string;
      success: boolean;
      data: { from: string; to: string; mode: string; files: unknown[]; summary: unknown };
    };
    expect(envelope.command).toBe('convert');
    expect(envelope.success).toBe(true);
    expect(envelope.data.from).toBe('claude-code');
    expect(envelope.data.to).toBe('cursor');
    expect(envelope.data.mode).toBe('convert');
    expect(Array.isArray(envelope.data.files)).toBe(true);
    expect(envelope.data.summary).toBeDefined();
  });

  it('preserves existing .agentsmesh directory', () => {
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Existing canonical\n',
    );

    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Root\n');

    execSync(`node ${CLI_PATH} convert --from claude-code --to cursor`, {
      cwd: TEST_DIR,
      stdio: 'pipe',
    });

    const preserved = readFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      'utf-8',
    );
    expect(preserved).toContain('# Existing canonical');
  });
});
```

- [ ] **Step 2: Build the project**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Run integration tests**

Run: `npx vitest run tests/integration/convert.integration.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add tests/integration/convert.integration.test.ts
git commit -m "test(cli): add convert integration tests"
```

---

### Task 6: E2E tests

**Files:**
- Create: `tests/e2e/convert.e2e.test.ts`

- [ ] **Step 1: Write E2E tests**

Create `tests/e2e/convert.e2e.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import { createTestProject, cleanup } from './helpers/setup.js';
import { fileExists, fileContains, fileNotExists } from './helpers/assertions.js';

describe('convert CLI (e2e)', () => {
  let dir: string;

  afterEach(() => {
    if (dir) cleanup(dir);
  });

  it('requires --from', async () => {
    dir = createTestProject();
    const r = await runCli('convert --to cursor', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/--from.*required/i);
  });

  it('requires --to', async () => {
    dir = createTestProject();
    const r = await runCli('convert --from claude-code', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/--to.*required/i);
  });

  it('rejects unknown --from target', async () => {
    dir = createTestProject();
    const r = await runCli('convert --from fake-tool --to cursor', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/unknown.*from/i);
  });

  it('rejects unknown --to target', async () => {
    dir = createTestProject();
    const r = await runCli('convert --from cursor --to fake-tool', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/unknown.*to/i);
  });

  it('rejects --from === --to', async () => {
    dir = createTestProject();
    const r = await runCli('convert --from cursor --to cursor', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/must be different/i);
  });

  it('converts claude-code fixture to cursor output', async () => {
    dir = createTestProject('claude-code-project');
    const r = await runCli('convert --from claude-code --to cursor', dir);

    expect(r.exitCode).toBe(0);
    fileExists(join(dir, '.cursor', 'rules', 'root.mdc'));
    fileContains(join(dir, '.cursor', 'rules', 'root.mdc'), 'Use TypeScript');
    fileNotExists(join(dir, '.agentsmesh'));
  });

  it('converts cursor fixture to claude-code output', async () => {
    dir = createTestProject('cursor-project');
    const r = await runCli('convert --from cursor --to claude-code', dir);

    expect(r.exitCode).toBe(0);
    fileExists(join(dir, '.claude', 'CLAUDE.md'));

    const content = readFileSync(join(dir, '.claude', 'CLAUDE.md'), 'utf-8');
    expect(content.length).toBeGreaterThan(0);
    fileNotExists(join(dir, '.agentsmesh'));
  });

  it('--dry-run writes no files', async () => {
    dir = createTestProject('claude-code-project');
    const r = await runCli('convert --from claude-code --to cursor --dry-run', dir);

    expect(r.exitCode).toBe(0);
    expect(r.stdout + r.stderr).toContain('[dry-run]');
    expect(existsSync(join(dir, '.cursor', 'rules'))).toBe(false);
  });

  it('--json returns structured envelope', async () => {
    dir = createTestProject('claude-code-project');
    const r = await runCli('convert --from claude-code --to cursor --json', dir);

    expect(r.exitCode).toBe(0);
    const envelope = JSON.parse(r.stdout) as {
      command: string;
      success: boolean;
      data: { from: string; to: string };
    };
    expect(envelope.command).toBe('convert');
    expect(envelope.success).toBe(true);
    expect(envelope.data.from).toBe('claude-code');
    expect(envelope.data.to).toBe('cursor');
  });

  it('preserves source tool files after conversion', async () => {
    dir = createTestProject('claude-code-project');
    const originalContent = readFileSync(join(dir, 'CLAUDE.md'), 'utf-8');

    await runCli('convert --from claude-code --to cursor', dir);

    expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf-8')).toBe(originalContent);
  });

  it('preserves existing .agentsmesh directory', async () => {
    dir = createTestProject('claude-code-project');
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(dir, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Existing canonical\n',
    );
    const before = readFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), 'utf-8');

    const r = await runCli('convert --from claude-code --to cursor', dir);

    expect(r.exitCode).toBe(0);
    const after = readFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(after).toBe(before);
  });

  it('empty source produces exit 0 with info message', async () => {
    dir = createTestProject();
    const r = await runCli('convert --from claude-code --to cursor', dir);

    expect(r.exitCode).toBe(0);
    expect(r.stdout + r.stderr).toMatch(/no files found/i);
  });
});
```

- [ ] **Step 2: Build the project**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Run E2E tests**

Run: `npx vitest run tests/e2e/convert.e2e.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/convert.e2e.test.ts
git commit -m "test(e2e): add convert command e2e tests"
```

---

### Task 7: Changeset

**Files:**
- Create: `.changeset/add-convert-command.md`

- [ ] **Step 1: Create changeset**

Create `.changeset/add-convert-command.md`:

```markdown
---
"agentsmesh": minor
---

feat(cli): add convert command for direct tool-to-tool migration

Adds `agentsmesh convert --from <source> --to <target>` for direct tool-to-tool conversion without going through canonical setup. Internally chains the existing import and generate pipelines via a temporary directory, producing destination tool files from source tool files in a single command. Supports `--dry-run` and `--json` flags.
```

- [ ] **Step 2: Commit**

```bash
git add .changeset/add-convert-command.md
git commit -m "chore(release): add changeset for convert command"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All tests PASS, no regressions

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Manual smoke test**

Run in this project directory:
```bash
node dist/cli.js convert --from claude-code --to cursor --dry-run
```
Expected: Shows `[dry-run]` output with cursor file paths

- [ ] **Step 5: Verify no .agentsmesh pollution**

After the smoke test, verify that no `.agentsmesh` temporary artifacts leaked:
```bash
ls -la /tmp/am-convert-*
```
Expected: No leftover temp directories

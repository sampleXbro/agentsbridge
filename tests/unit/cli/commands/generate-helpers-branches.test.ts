/**
 * Branch coverage targeted tests for src/cli/commands/generate.ts.
 *
 * Targets:
 *   - --features rejection (line ~52)
 *   - target filter parsing (split/trim/filter Boolean)
 *   - locked-feature violation throws when checksums differ
 *   - global vs project scope display path formatting (covered by check-mode log inspection)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runGenerate } from '../../../../src/cli/commands/generate.js';

const TEST_DIR = join(tmpdir(), 'am-generate-branches-test');

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function writeMinimalProject(features = '[rules]', targets = '[claude-code]'): void {
  mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(TEST_DIR, 'agentsmesh.yaml'),
    `version: 1
targets: ${targets}
features: ${features}
`,
  );
  writeFileSync(
    join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    `---
root: true
description: Root
---
# Root
`,
  );
}

describe('runGenerate — rejection branches', () => {
  it('rejects --features=<list> form (deprecated string flag)', async () => {
    writeMinimalProject();
    await expect(runGenerate({ features: 'rules,mcp' }, TEST_DIR)).rejects.toThrow(
      /--features is no longer supported/i,
    );
  });

  it('rejects --features when passed as a boolean true (still defined)', async () => {
    writeMinimalProject();
    await expect(runGenerate({ features: true }, TEST_DIR)).rejects.toThrow(
      /--features is no longer supported/i,
    );
  });
});

describe('runGenerate — target filter parsing', () => {
  it('accepts a single-target string filter (split/trim/filter Boolean → 1 entry)', async () => {
    writeMinimalProject('[rules]', '[claude-code, codex-cli]');
    // printMatrix:false so the matrix command does not pollute coverage paths.
    const result = await runGenerate({ targets: 'claude-code', 'dry-run': true }, TEST_DIR, {
      printMatrix: false,
    });
    expect(result.exitCode).toBe(0);
  });

  it('accepts comma-separated filter with whitespace and trailing commas', async () => {
    writeMinimalProject('[rules]', '[claude-code, codex-cli]');
    const result = await runGenerate(
      { targets: '  claude-code , codex-cli ,', 'dry-run': true },
      TEST_DIR,
      { printMatrix: false },
    );
    expect(result.exitCode).toBe(0);
  });

  it('treats empty string targets as "no filter" (typeof check guards)', async () => {
    writeMinimalProject('[rules]', '[claude-code]');
    const result = await runGenerate({ targets: '', 'dry-run': true }, TEST_DIR, {
      printMatrix: false,
    });
    expect(result.exitCode).toBe(0);
  });

  it('treats targets=true (boolean flag) as no filter', async () => {
    writeMinimalProject('[rules]', '[claude-code]');
    const result = await runGenerate({ targets: true, 'dry-run': true }, TEST_DIR, {
      printMatrix: false,
    });
    expect(result.exitCode).toBe(0);
  });
});

describe('runGenerate — locked feature violations', () => {
  it('throws "Locked feature violation" when checksums differ and lock_features matches', async () => {
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
collaboration:
  strategy: lock
  lock_features: [rules]
`,
    );
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: Root
---
# Root
`,
    );

    // First generate populates the lock with current checksums.
    await runGenerate({ 'dry-run': false }, TEST_DIR, { printMatrix: false });

    // Mutate canonical content. Second generate should detect violation.
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: Root
---
# Root edited
`,
    );

    await expect(runGenerate({}, TEST_DIR, { printMatrix: false })).rejects.toThrow(
      /Locked feature violation/i,
    );
  });

  it('--force bypasses lock violation and regenerates', async () => {
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
collaboration:
  strategy: lock
  lock_features: [rules]
`,
    );
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: Root
---
# Root
`,
    );

    await runGenerate({}, TEST_DIR, { printMatrix: false });

    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: Root
---
# Root v2
`,
    );

    const result = await runGenerate({ force: true }, TEST_DIR, { printMatrix: false });
    expect(result.exitCode).toBe(0);
  });
});

describe('runGenerate — check mode drift detection', () => {
  it('returns exit code 1 when generated artifacts have drifted', async () => {
    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
`,
    );
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: Root
---
# Root
`,
    );

    const result = await runGenerate({ check: true }, TEST_DIR, { printMatrix: false });
    expect(result.exitCode).toBe(1);
  });

  it('returns 0 when no files would be generated and --check is set', async () => {
    // No rules feature and no canonical: results.length === 0 path with checkOnly=true
    mkdirSync(join(TEST_DIR, '.agentsmesh'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: []
`,
    );
    const result = await runGenerate({ check: true }, TEST_DIR, { printMatrix: false });
    expect(result.exitCode).toBe(0);
  });
});

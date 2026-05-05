/**
 * Unit tests for agentsmesh lint command.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runLintCmd } from '../../../../src/cli/commands/lint.js';

const TEST_DIR = join(tmpdir(), 'am-lint-cmd-test');

function setupProject(): void {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(
    join(TEST_DIR, 'agentsmesh.yaml'),
    `version: 1
targets: [claude-code, cursor]
features: [rules]
`,
  );
  mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    `---
root: true
description: "Project rules"
---
# Rules
- Use TypeScript
`,
  );
}

beforeEach(() => setupProject());
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('runLintCmd', () => {
  it('returns exitCode 0 and empty diagnostics when all checks pass', async () => {
    const result = await runLintCmd({}, TEST_DIR);
    expect(result.exitCode).toBe(0);
    expect(result.data).toHaveProperty('diagnostics');
    expect(result.data).toHaveProperty('summary');
    expect(result.data.diagnostics).toEqual([]);
    expect(result.data.summary).toEqual({ errors: 0, warnings: 0 });
  });

  it('returns exitCode 1 with error diagnostics when rules exist but no root rule', async () => {
    rmSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'));
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'only.md'),
      `---
description: "Only rule"
---
Content`,
    );
    const result = await runLintCmd({}, TEST_DIR);
    expect(result.exitCode).toBe(1);
    expect(result.data.summary.errors).toBeGreaterThan(0);
    expect(result.data.diagnostics[0]).toMatchObject({
      level: 'error',
      file: expect.any(String),
      target: expect.any(String),
      message: expect.any(String),
    });
  });

  it('populates diagnostics with correct structure for singular error and warning', async () => {
    writeFileSync(
      join(TEST_DIR, 'agentsmesh.yaml'),
      `version: 1\ntargets: [claude-code]\nfeatures: [rules]\n`,
    );
    rmSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'));
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'only.md'),
      `---\ndescription: "Only rule"\nglobs: lib/**/*.ts\n---\nContent`,
    );
    const result = await runLintCmd({}, TEST_DIR);
    expect(result.exitCode).toBe(1);
    expect(result.data.summary.errors).toBeGreaterThanOrEqual(1);
  });

  it('returns exitCode 0 when only warnings (globs match 0 files)', async () => {
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'src', 'foo.ts'), 'x');
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', 'lib-only.md'),
      `---
description: "Lib"
globs: lib/**/*.ts
---
Lib rules`,
    );
    const result = await runLintCmd({}, TEST_DIR);
    expect(result.exitCode).toBe(0);
    expect(result.data.summary.warnings).toBeGreaterThan(0);
    expect(result.data.summary.errors).toBe(0);
  });

  it('respects --targets filter', async () => {
    const result = await runLintCmd({ targets: 'claude-code' }, TEST_DIR);
    expect(result.exitCode).toBe(0);
    expect(result.data.diagnostics).toEqual([]);
    expect(result.data.summary).toEqual({ errors: 0, warnings: 0 });
  });

  it('throws when not initialized (no config)', async () => {
    rmSync(join(TEST_DIR, 'agentsmesh.yaml'));
    await expect(runLintCmd({}, TEST_DIR)).rejects.toThrow(/agentsmesh\.yaml/);
  });

  it('lints canonical home config when --global is set', async () => {
    vi.stubEnv('HOME', TEST_DIR);
    vi.stubEnv('USERPROFILE', TEST_DIR);
    const workspace = `${TEST_DIR}-workspace`;
    rmSync(workspace, { recursive: true, force: true });
    mkdirSync(workspace, { recursive: true });

    mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
`,
    );
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: "Global rules"
---
# Rules
- Use TypeScript
`,
    );

    const result = await runLintCmd({ global: true }, workspace);
    expect(result.exitCode).toBe(0);
    expect(result.data.diagnostics).toEqual([]);
    expect(result.data.summary).toEqual({ errors: 0, warnings: 0 });
  });
});

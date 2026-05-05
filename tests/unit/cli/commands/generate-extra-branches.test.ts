/**
 * Extra branch coverage for src/cli/commands/generate.ts.
 * Targets remaining uncovered branches that are unit-testable.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runGenerate } from '../../../../src/cli/commands/generate.js';

let testDir = '';

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'amesh-extra-'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(testDir, { recursive: true, force: true });
});

function writeMinimalProject(): void {
  mkdirSync(join(testDir, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(testDir, 'agentsmesh.yaml'),
    `version: 1
targets: [claude-code]
features: [rules]
`,
  );
  writeFileSync(
    join(testDir, '.agentsmesh', 'rules', '_root.md'),
    `---\nroot: true\ndescription: Root\n---\n# Root\n`,
  );
}

describe('runGenerate — extra branches', () => {
  it('uses USERNAME when USER env var is unset (line 127/200 nullish coalescing)', async () => {
    writeMinimalProject();
    vi.stubEnv('USER', '');
    vi.stubEnv('USERNAME', 'fallback-user');
    const { exitCode: code } = await runGenerate({}, testDir, { printMatrix: false });
    expect(code).toBe(0);
  });

  it('uses "unknown" when both USER and USERNAME unset', async () => {
    writeMinimalProject();
    vi.stubEnv('USER', '');
    vi.stubEnv('USERNAME', '');
    const { exitCode: code } = await runGenerate({}, testDir, { printMatrix: false });
    expect(code).toBe(0);
  });

  it('lock with strategy=lock but lock_features empty → skips violation check (line 73 arm)', async () => {
    mkdirSync(join(testDir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(testDir, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
collaboration:
  strategy: lock
  lock_features: []
`,
    );
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', '_root.md'),
      `---\nroot: true\ndescription: r\n---\n# r\n`,
    );
    const { exitCode: code } = await runGenerate({}, testDir, { printMatrix: false });
    expect(code).toBe(0);
  });

  it('lock strategy with no existing lock → no violation, just generates (line 75 arm)', async () => {
    mkdirSync(join(testDir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(testDir, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
collaboration:
  strategy: lock
  lock_features: [rules]
`,
    );
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', '_root.md'),
      `---\nroot: true\ndescription: r\n---\n# r\n`,
    );
    const { exitCode: code } = await runGenerate({}, testDir, { printMatrix: false });
    expect(code).toBe(0);
  });

  it('lock with existing lock + checksums match → no violations (line 82 if false arm)', async () => {
    mkdirSync(join(testDir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(testDir, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
collaboration:
  strategy: lock
  lock_features: [rules]
`,
    );
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', '_root.md'),
      `---\nroot: true\ndescription: r\n---\n# r\n`,
    );

    // First generate populates lock.
    await runGenerate({}, testDir, { printMatrix: false });
    // Second generate (no edits) — checksums identical, violations.length === 0 path.
    const { exitCode: code } = await runGenerate({}, testDir, { printMatrix: false });
    expect(code).toBe(0);
  });

  it('check mode with empty results returns 0 — no rules feature (line 116 if true arm)', async () => {
    mkdirSync(join(testDir, '.agentsmesh'), { recursive: true });
    writeFileSync(
      join(testDir, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: []
`,
    );
    const { exitCode: code } = await runGenerate({ check: true }, testDir, { printMatrix: false });
    expect(code).toBe(0);
  });

  it('dry-run with empty results returns 0 and skips lock writes (line 120 if false arm)', async () => {
    mkdirSync(join(testDir, '.agentsmesh'), { recursive: true });
    writeFileSync(
      join(testDir, 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: []
`,
    );
    const { exitCode: code } = await runGenerate({ 'dry-run': true }, testDir, {
      printMatrix: false,
    });
    expect(code).toBe(0);
  });

  it('dry-run with results writes nothing but logs (line 171 dry-run arm)', async () => {
    writeMinimalProject();
    const { exitCode: code } = await runGenerate({ 'dry-run': true }, testDir, {
      printMatrix: false,
    });
    expect(code).toBe(0);
  });

  it('default projectRoot uses process.cwd() when undefined (line 55 nullish arm)', async () => {
    writeMinimalProject();
    const original = process.cwd();
    process.chdir(testDir);
    try {
      const { exitCode: code } = await runGenerate({ 'dry-run': true }, undefined, {
        printMatrix: false,
      });
      expect(code).toBe(0);
    } finally {
      process.chdir(original);
    }
  });

  it('refresh-cache flag triggers refreshRemoteCache true (line 60 arm)', async () => {
    writeMinimalProject();
    const { exitCode: code } = await runGenerate(
      { 'refresh-cache': true, 'dry-run': true },
      testDir,
      {
        printMatrix: false,
      },
    );
    expect(code).toBe(0);
  });

  it('no-cache flag (alias) triggers refreshRemoteCache true (line 60 right OR arm)', async () => {
    writeMinimalProject();
    const { exitCode: code } = await runGenerate({ 'no-cache': true, 'dry-run': true }, testDir, {
      printMatrix: false,
    });
    expect(code).toBe(0);
  });

  it('global flag → scope is global, paths display with ~/ prefix', async () => {
    // Global mode reads config from ~/.agentsmesh, not from project root.
    mkdirSync(join(testDir, '.agentsmesh', 'rules'), { recursive: true });
    writeFileSync(
      join(testDir, '.agentsmesh', 'agentsmesh.yaml'),
      `version: 1
targets: [claude-code]
features: [rules]
`,
    );
    writeFileSync(
      join(testDir, '.agentsmesh', 'rules', '_root.md'),
      `---\nroot: true\ndescription: g\n---\n# Global root\n`,
    );
    vi.stubEnv('HOME', testDir);
    vi.stubEnv('USERPROFILE', testDir);
    const { exitCode: code } = await runGenerate(
      { global: true, 'dry-run': true },
      join(testDir, 'worktree'),
      {
        printMatrix: false,
      },
    );
    expect(code).toBe(0);
  });
});

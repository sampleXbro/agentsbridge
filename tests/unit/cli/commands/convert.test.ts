import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runConvert } from '../../../../src/cli/commands/convert.js';

const TEST_DIR = join(tmpdir(), 'am-convert-cmd-test');

beforeEach(() => mkdirSync(TEST_DIR, { recursive: true }));
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('runConvert', () => {
  it('throws when --from is missing', async () => {
    await expect(runConvert({ to: 'cursor' }, TEST_DIR)).rejects.toThrow(/--from.*required/i);
  });

  it('throws when --to is missing', async () => {
    await expect(runConvert({ from: 'claude-code' }, TEST_DIR)).rejects.toThrow(/--to.*required/i);
  });

  it('throws when --from and --to are the same', async () => {
    await expect(runConvert({ from: 'cursor', to: 'cursor' }, TEST_DIR)).rejects.toThrow(
      /must be different/i,
    );
  });

  it('throws for unknown --from target', async () => {
    await expect(runConvert({ from: 'fake-tool', to: 'cursor' }, TEST_DIR)).rejects.toThrow(
      /unknown.*from/i,
    );
  });

  it('throws for unknown --to target', async () => {
    await expect(runConvert({ from: 'cursor', to: 'fake-tool' }, TEST_DIR)).rejects.toThrow(
      /unknown.*to/i,
    );
  });

  it('converts claude-code rules to cursor output', async () => {
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Root Rules\n\nUse TypeScript.');
    const result = await runConvert({ from: 'claude-code', to: 'cursor' }, TEST_DIR);

    expect(result.exitCode).toBe(0);
    expect(result.data.from).toBe('claude-code');
    expect(result.data.to).toBe('cursor');
    expect(result.data.mode).toBe('convert');
    expect(result.data.files.length).toBeGreaterThan(0);

    const cursorRoot = readFileSync(join(TEST_DIR, '.cursor', 'rules', 'general.mdc'), 'utf-8');
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

    const preserved = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
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

  it('converts global claude-code config to cursor', async () => {
    vi.stubEnv('HOME', TEST_DIR);
    vi.stubEnv('USERPROFILE', TEST_DIR);

    mkdirSync(join(TEST_DIR, '.claude', 'rules'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), '# Global Root\n');
    writeFileSync(join(TEST_DIR, '.claude', 'rules', 'testing.md'), '# Testing\n');

    const result = await runConvert(
      { from: 'claude-code', to: 'cursor', global: true },
      join(TEST_DIR, 'worktree'),
    );

    expect(result.exitCode).toBe(0);
    expect(result.data.from).toBe('claude-code');
    expect(result.data.to).toBe('cursor');
    expect(result.data.files.length).toBeGreaterThan(0);
    expect(existsSync(join(TEST_DIR, '.agentsmesh'))).toBe(false);
  });

  it('converts global cursor config to claude-code', async () => {
    vi.stubEnv('HOME', TEST_DIR);
    vi.stubEnv('USERPROFILE', TEST_DIR);

    mkdirSync(join(TEST_DIR, '.cursor', 'rules'), { recursive: true });
    writeFileSync(
      join(TEST_DIR, '.cursor', 'rules', 'general.mdc'),
      '---\nalwaysApply: true\ndescription: G\n---\n# Cursor Global\n',
    );

    const result = await runConvert(
      { from: 'cursor', to: 'claude-code', global: true },
      join(TEST_DIR, 'worktree'),
    );

    expect(result.exitCode).toBe(0);
    expect(result.data.files.length).toBeGreaterThan(0);

    expect(readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8')).toContain(
      'Cursor Global',
    );
  });
});

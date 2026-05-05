import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import { createTestProject, cleanup } from './helpers/setup.js';
import { fileExists, fileNotExists } from './helpers/assertions.js';

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
    fileExists(join(dir, '.cursor', 'rules'));
    fileNotExists(join(dir, '.agentsmesh'));
  });

  it('converts cursor fixture to claude-code output', async () => {
    dir = createTestProject('cursor-project');
    const r = await runCli('convert --from cursor --to claude-code', dir);

    expect(r.exitCode).toBe(0);
    fileExists(join(dir, '.claude'));
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

  it('converts global claude-code config to cursor with --global', async () => {
    dir = createTestProject();
    mkdirSync(join(dir, '.claude', 'rules'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'CLAUDE.md'), '# Global Root\n');
    writeFileSync(join(dir, '.claude', 'rules', 'testing.md'), '# Testing\n');

    const r = await runCli('convert --from claude-code --to cursor --global', dir, {
      HOME: dir,
      USERPROFILE: dir,
    });

    expect(r.exitCode).toBe(0);
    fileExists(join(dir, '.cursor', 'rules'));
    fileNotExists(join(dir, '.agentsmesh'));
  });
});

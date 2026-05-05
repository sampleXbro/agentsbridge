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
    writeFileSync(
      join(TEST_DIR, '.claude', 'rules', 'testing.md'),
      '# Testing\n\nWrite tests first.',
    );

    execSync(`node ${CLI_PATH} convert --from claude-code --to cursor`, {
      cwd: TEST_DIR,
      stdio: 'pipe',
    });

    // Cursor puts root rules in general.mdc
    expect(existsSync(join(TEST_DIR, '.cursor', 'rules'))).toBe(true);
    // Verify content was converted
    const files = execSync(`find ${join(TEST_DIR, '.cursor')} -name "*.mdc"`, {
      encoding: 'utf-8',
    });
    expect(files.trim().length).toBeGreaterThan(0);

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

    const stdout = execSync(`node ${CLI_PATH} convert --from claude-code --to cursor --json`, {
      cwd: TEST_DIR,
      encoding: 'utf-8',
    });

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

    const preserved = readFileSync(join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'), 'utf-8');
    expect(preserved).toContain('# Existing canonical');
  });
});

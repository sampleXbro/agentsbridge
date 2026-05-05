/**
 * Integration tests for --json CLI output.
 * These run the built dist/cli.js binary and verify the JSON envelope.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const TEST_DIR = join(tmpdir(), 'am-json-output-test');
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

function runCli(args: string[]): { stdout: string; stderr: string; status: number } {
  const result = spawnSync('node', [CLI_PATH, ...args], {
    cwd: TEST_DIR,
    encoding: 'utf-8',
    timeout: 30000,
  });
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status ?? 1 };
}

function setupValidProject(): void {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(
    join(TEST_DIR, 'agentsmesh.yaml'),
    `version: 1\ntargets: [claude-code, cursor]\nfeatures: [rules]\n`,
  );
  mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    `---\nroot: true\ndescription: "Project rules"\n---\n# Rules\n- Use TypeScript\n`,
  );
}

beforeEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('agentsmesh --json output (integration)', () => {
  it('lint --json produces valid JSON envelope on success', () => {
    setupValidProject();
    const { stdout, status } = runCli(['lint', '--json']);
    const envelope = JSON.parse(stdout);
    expect(status).toBe(0);
    expect(envelope.success).toBe(true);
    expect(envelope.command).toBe('lint');
    expect(envelope.data.diagnostics).toEqual([]);
    expect(envelope.data.summary).toEqual({ errors: 0, warnings: 0 });
  });

  it('generate --json produces valid JSON envelope', () => {
    setupValidProject();
    const { stdout, status } = runCli(['generate', '--json']);
    const envelope = JSON.parse(stdout);
    expect(status).toBe(0);
    expect(envelope.success).toBe(true);
    expect(envelope.command).toBe('generate');
    expect(Array.isArray(envelope.data.files)).toBe(true);
    expect(envelope.data.summary).toHaveProperty('created');
    expect(envelope.data.summary).toHaveProperty('updated');
    expect(envelope.data.summary).toHaveProperty('unchanged');
  });

  it('generate --check --json reports drift as failure with data', () => {
    setupValidProject();
    // Generate first to create files
    runCli(['generate']);
    // Modify a rule so generated output drifts
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---\nroot: true\ndescription: "Modified"\n---\n# Modified Rules\n- Changed content\n`,
    );
    const { stdout, status } = runCli(['generate', '--check', '--json']);
    const envelope = JSON.parse(stdout);
    expect(status).toBe(1);
    expect(envelope.success).toBe(false);
    expect(envelope.data.mode).toBe('check');
    expect(Array.isArray(envelope.data.files)).toBe(true);
    // At least one file should show as updated (drifted)
    const drifted = envelope.data.files.filter((f: { status: string }) => f.status !== 'unchanged');
    expect(drifted.length).toBeGreaterThan(0);
  });

  it('check --json reports no lock as failure', () => {
    setupValidProject();
    // No generate run, so no .lock file
    const { stdout, status } = runCli(['check', '--json']);
    const envelope = JSON.parse(stdout);
    expect(status).toBe(1);
    expect(envelope.success).toBe(false);
    expect(envelope.command).toBe('check');
    expect(envelope.data.hasLock).toBe(false);
  });

  it('diff --json produces patches', () => {
    setupValidProject();
    // Files not yet generated, so diff should show what would be created
    const { stdout, status } = runCli(['diff', '--json']);
    const envelope = JSON.parse(stdout);
    expect(status).toBe(0);
    expect(envelope.success).toBe(true);
    expect(envelope.command).toBe('diff');
    expect(Array.isArray(envelope.data.patches)).toBe(true);
    expect(envelope.data.patches.length).toBeGreaterThan(0);
  });

  it('matrix --json produces targets and features', () => {
    setupValidProject();
    const { stdout, status } = runCli(['matrix', '--json']);
    const envelope = JSON.parse(stdout);
    expect(status).toBe(0);
    expect(envelope.success).toBe(true);
    expect(envelope.command).toBe('matrix');
    expect(Array.isArray(envelope.data.targets)).toBe(true);
    expect(Array.isArray(envelope.data.features)).toBe(true);
  });

  it('merge --json with no conflict', () => {
    setupValidProject();
    // Generate first to create lock
    runCli(['generate']);
    const { stdout, status } = runCli(['merge', '--json']);
    const envelope = JSON.parse(stdout);
    expect(status).toBe(0);
    expect(envelope.success).toBe(true);
    expect(envelope.command).toBe('merge');
    expect(envelope.data).toEqual({ hadConflict: false, resolved: false });
  });

  it('watch --json is rejected', () => {
    setupValidProject();
    const { stdout, status } = runCli(['watch', '--json']);
    const envelope = JSON.parse(stdout);
    expect(status).toBe(1);
    expect(envelope.success).toBe(false);
    expect(envelope.error).toContain('not supported');
  });

  it('unknown command --json produces error envelope', () => {
    setupValidProject();
    const { stdout, status } = runCli(['nonexistent', '--json']);
    const envelope = JSON.parse(stdout);
    expect(status).not.toBe(0);
    expect(envelope.success).toBe(false);
    expect(envelope.error).toContain('Unknown command');
  });

  it('--json produces no stderr on success', () => {
    setupValidProject();
    const { stderr, status } = runCli(['lint', '--json']);
    expect(status).toBe(0);
    expect(stderr.trim()).toBe('');
  });

  it('--json output is exactly one line', () => {
    setupValidProject();
    const { stdout } = runCli(['lint', '--json']);
    expect(stdout.trim().split('\n').length).toBe(1);
  });

  it('init --json produces valid envelope', () => {
    // Empty directory — no agentsmesh.yaml
    const { stdout, status } = runCli(['init', '--yes', '--json']);
    const envelope = JSON.parse(stdout);
    expect(status).toBe(0);
    expect(envelope.success).toBe(true);
    expect(envelope.command).toBe('init');
    expect(envelope.data.configFile).toContain('agentsmesh.yaml');
  });
});

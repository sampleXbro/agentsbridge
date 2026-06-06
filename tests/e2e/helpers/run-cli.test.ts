/**
 * Unit tests for run-cli helper.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCli, runCliArgs } from './run-cli.js';

const TMP_DIR = join(tmpdir(), 'am-e2e-runcli-' + Date.now());

beforeEach(() => mkdirSync(TMP_DIR, { recursive: true }));
afterEach(() => rmSync(TMP_DIR, { recursive: true, force: true }));

describe('runCli', () => {
  it('--version returns exitCode 0 and stdout contains version', async () => {
    const result = await runCli('--version', TMP_DIR);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('agentsmesh');
    expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);
  });

  it('empty args shows help — run with no args → exit 0, output contains usage', async () => {
    const r = await runCli('', TMP_DIR);
    expect(r.exitCode).toBe(0);
    expect(r.stdout + r.stderr).toMatch(/agentsmesh|init|generate/i);
  });

  it('unknown-cmd returns exitCode 1', async () => {
    const result = await runCli('foobar', TMP_DIR);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown command');
    expect(result.stderr).toContain('foobar');
  });
});

describe('runCliArgs', () => {
  it('preserves a multi-word argv element instead of whitespace-splitting it', async () => {
    // `runCli` would split "Unknown command" handling, but argv array keeps the
    // spaced value whole — proven via the unknown-command echo of a spaced token.
    const result = await runCliArgs(['multi word command'], TMP_DIR);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown command');
    expect(result.stderr).toContain('multi word command');
  });

  it('--version through the array runner returns exitCode 0', async () => {
    const result = await runCliArgs(['--version'], TMP_DIR);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);
  });
});

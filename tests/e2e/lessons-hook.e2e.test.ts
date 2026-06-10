import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCli, runCliArgs } from './helpers/run-cli.js';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

/** Spawn `lessons hook` with a piped stdin payload and capture stdout. */
function runHook(cwd: string, stdin: string): Promise<{ stdout: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('node', [CLI_PATH, 'lessons', 'hook'], {
      cwd,
      env: { ...process.env, NO_COLOR: '1', AGENTSMESH_LESSONS_TELEMETRY: '' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    proc.stdout.on('data', (c) => (stdout += String(c)));
    proc.on('close', (code) => resolve({ stdout: stdout.trim(), exitCode: code ?? 0 }));
    proc.stdin.write(stdin);
    proc.stdin.end();
  });
}

let dir: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'amesh-hook-e2e-'));
  await runCliArgs(['init', '--lessons'], dir);
  await runCliArgs(
    ['lessons', 'add', 'Hook rule X.', '--topic', 'hk', '--new-topic', '--topic-summary', 'Hk.', '--trigger-file', 'src/**'],
    dir,
  );
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('lessons hook (PostToolUse recall)', () => {
  it('injects matching lessons as additionalContext for a piped file-edit payload', async () => {
    const { stdout, exitCode } = await runHook(
      dir,
      JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'src/x.ts' } }),
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('Hook rule X.');
  });

  it('emits nothing for a non-matching payload', async () => {
    const { stdout, exitCode } = await runHook(
      dir,
      JSON.stringify({ tool_input: { file_path: 'docs/none.py' } }),
    );
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
  });

  it('is a silent no-op with no stdin (exit 0, empty stdout)', async () => {
    const r = await runCli('lessons hook', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe('');
  });
});

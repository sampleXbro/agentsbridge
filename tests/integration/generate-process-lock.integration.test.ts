/**
 * Integration test for the cross-process generate lock.
 *
 * Spawns two `agentsmesh generate` invocations against the same canonical
 * directory in parallel and asserts:
 *  - both processes exit 0 (the second waits for the first via the lock retry loop)
 *  - the final on-disk output is deterministic and well-formed
 *  - the `.generate.lock` directory is cleaned up afterwards
 *
 * This is the integration counterpart to `tests/unit/utils/process-lock.test.ts`,
 * which exercises `acquireProcessLock` directly. Together they cover the lock
 * helper in isolation AND its real wiring inside the generate command.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync, spawn } from 'node:child_process';

const TEST_DIR = join(tmpdir(), `am-integration-process-lock-${process.pid}`);
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

beforeAll(() => {
  if (!existsSync(CLI_PATH)) {
    execSync('pnpm build', { cwd: process.cwd(), stdio: 'inherit' });
  }
});

beforeEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
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
});

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

interface SpawnResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function spawnGenerate(cwd: string): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [CLI_PATH, 'generate'], {
      cwd,
      env: { ...process.env, NO_COLOR: '1' },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
    proc.on('error', reject);
  });
}

describe('agentsmesh generate process lock (integration)', () => {
  it('serializes two parallel generates against the same project — both exit 0 and output is deterministic', async () => {
    const [a, b] = await Promise.all([spawnGenerate(TEST_DIR), spawnGenerate(TEST_DIR)]);

    expect(a.code, `first stderr: ${a.stderr}`).toBe(0);
    expect(b.code, `second stderr: ${b.stderr}`).toBe(0);

    const claudeContent = readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8');
    const cursorContent = readFileSync(join(TEST_DIR, '.cursor', 'rules', 'general.mdc'), 'utf-8');
    expect(claudeContent).toContain('Use TypeScript');
    expect(cursorContent).toContain('Use TypeScript');

    const lockDir = join(TEST_DIR, '.agentsmesh', '.generate.lock');
    expect(existsSync(lockDir), 'lock directory should be released after both runs').toBe(false);
  }, 30_000);
});

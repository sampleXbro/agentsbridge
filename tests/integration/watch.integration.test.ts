/**
 * Integration test for agentsmesh watch.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import {
  createWatchTestDir,
  writeMinimalWatchProject,
  watchWaitTimeoutMs,
} from '../harness/watch.js';

const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

let TEST_DIR = '';

function waitForFile(path: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = (): void => {
      try {
        readFileSync(path, 'utf-8');
        resolve();
        return;
      } catch {
        // continue polling
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for file: ${path}`));
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}

beforeEach(() => {
  TEST_DIR = createWatchTestDir();
  writeMinimalWatchProject(TEST_DIR);
});

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('agentsmesh watch (integration)', () => {
  const fileWaitMs = (): number => watchWaitTimeoutMs() + 3_000;

  it('generates on startup and watches for changes', async () => {
    const child = spawn('node', [CLI_PATH, 'watch'], {
      cwd: TEST_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const chunks: Buffer[] = [];
    child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => chunks.push(chunk));

    await waitForFile(join(TEST_DIR, '.claude', 'CLAUDE.md'), fileWaitMs());

    expect(readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8')).toContain(
      'Use TypeScript',
    );

    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      `---
root: true
description: "Updated"
---
# Rules
- Use TypeScript
- Prefer strict mode
`,
    );

    await new Promise((r) => setTimeout(r, 1500));

    const output = chunks.map((c) => c.toString()).join('');
    expect(output).toContain('Watching');
    expect(output).toMatch(/Regenerated|Generated|created|updated/);

    child.kill('SIGINT');
    await new Promise<void>((resolve) => {
      child.on('exit', () => resolve());
      setTimeout(resolve, 1000);
    });
  });

  it('respects --targets filter', async () => {
    const child = spawn('node', [CLI_PATH, 'watch', '--targets', 'claude-code'], {
      cwd: TEST_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const chunks: Buffer[] = [];
    child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => chunks.push(chunk));

    await waitForFile(join(TEST_DIR, '.claude', 'CLAUDE.md'), fileWaitMs());

    expect(readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8')).toContain(
      'Use TypeScript',
    );
    expect(() => readFileSync(join(TEST_DIR, '.cursor', 'rules', 'general.mdc'))).toThrow();

    child.kill('SIGINT');
    await new Promise<void>((resolve) => {
      child.on('exit', () => resolve());
      setTimeout(resolve, 1000);
    });
  });
});

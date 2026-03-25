/**
 * Integration test for agentsbridge watch.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const TEST_DIR = join(tmpdir(), 'ab-integration-watch');
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(
    join(TEST_DIR, 'agentsbridge.yaml'),
    `version: 1
targets: [claude-code, cursor]
features: [rules]
`,
  );
  mkdirSync(join(TEST_DIR, '.agentsbridge', 'rules'), { recursive: true });
  writeFileSync(
    join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'),
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

describe('agentsbridge watch (integration)', () => {
  it('generates on startup and watches for changes', async () => {
    const child = spawn('node', [CLI_PATH, 'watch'], {
      cwd: TEST_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const chunks: Buffer[] = [];
    child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));

    await new Promise<void>((resolve) => {
      child.stdout?.on('data', (chunk: Buffer) => {
        const out = chunk.toString();
        if (out.includes('Regenerated') || out.includes('Generated')) {
          resolve();
        }
      });
      setTimeout(resolve, 3000);
    });

    expect(readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8')).toContain(
      'Use TypeScript',
    );

    writeFileSync(
      join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'),
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

    await new Promise((r) => setTimeout(r, 3000));

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

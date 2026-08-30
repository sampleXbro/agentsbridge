import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { delay, pollForWatch, stopWatchChild, watchStabilityDelayMs } from '../harness/watch.js';

const TEST_DIR = join(tmpdir(), 'am-e2e-watch');
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(join(TEST_DIR, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(TEST_DIR, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code, cursor]\nfeatures: [rules]\n',
  );
  writeFileSync(
    join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\ndescription: "Project rules"\n---\n# Rules\n- Use TypeScript\n',
  );
});

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('watch', () => {
  it('--targets limits the initial regenerate to the named target(s)', async () => {
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      'generated_at: "2026-03-15T14:00:00Z"\nchecksums: {}\nextends: {}\n',
    );

    const child = spawn('node', [CLI_PATH, 'watch', '--targets', 'claude-code'], {
      cwd: TEST_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    try {
      // Poll for the initial regenerate instead of a fixed sleep.
      await pollForWatch(() => {
        expect(readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')).toContain('Use TypeScript');
      });
      // Claude output was generated; cursor output was NOT (--targets filtered).
      expect(existsSync(join(TEST_DIR, '.cursor', 'rules'))).toBe(false);
    } finally {
      await stopWatchChild(child);
    }
  });

  it('regenerates once on startup, stays idle, then reacts to source changes', async () => {
    writeFileSync(
      join(TEST_DIR, '.agentsmesh', '.lock'),
      'generated_at: "2026-03-15T14:00:00Z"\nchecksums: {}\nextends: {}\n',
    );

    const child = spawn('node', [CLI_PATH, 'watch'], {
      cwd: TEST_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });

    // Initial regenerate happened exactly once…
    await pollForWatch(() => {
      expect(readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')).toContain('Use TypeScript');
      expect(stdout.match(/Regenerated\./g) ?? []).toHaveLength(1);
    });
    // …and the watcher stays idle (no spurious second regen) across a settle window.
    await delay(watchStabilityDelayMs());
    expect(stdout.match(/Regenerated\./g) ?? []).toHaveLength(1);

    writeFileSync(
      join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
      '---\nroot: true\ndescription: "Updated"\n---\n# Rules\n- Use TypeScript\n- Prefer strict mode\n',
    );

    // The source edit triggers exactly one more regenerate.
    await pollForWatch(() => {
      expect(stdout.match(/Regenerated\./g) ?? []).toHaveLength(2);
      expect(readFileSync(join(TEST_DIR, 'CLAUDE.md'), 'utf-8')).toContain('Prefer strict mode');
    });
    expect(stdout).toContain('Watching');
    expect(stdout).toMatch(/Regenerated|Generated|created|updated/);

    await stopWatchChild(child);
  });
});

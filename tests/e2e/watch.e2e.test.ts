import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_DIR = join(tmpdir(), 'ab-e2e-watch');
const CLI_PATH = join(process.cwd(), 'dist', 'cli.js');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(join(TEST_DIR, '.agentsbridge', 'rules'), { recursive: true });
  writeFileSync(
    join(TEST_DIR, 'agentsbridge.yaml'),
    'version: 1\ntargets: [claude-code, cursor]\nfeatures: [rules]\n',
  );
  writeFileSync(
    join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'),
    '---\nroot: true\ndescription: "Project rules"\n---\n# Rules\n- Use TypeScript\n',
  );
});

afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

describe('watch', () => {
  it('regenerates once on startup, stays idle, then reacts to source changes', async () => {
    writeFileSync(
      join(TEST_DIR, '.agentsbridge', '.lock'),
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

    await new Promise((resolve) => setTimeout(resolve, 3000));
    expect(readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8')).toContain(
      'Use TypeScript',
    );
    expect(stdout.match(/Regenerated\./g) ?? []).toHaveLength(1);

    writeFileSync(
      join(TEST_DIR, '.agentsbridge', 'rules', '_root.md'),
      '---\nroot: true\ndescription: "Updated"\n---\n# Rules\n- Use TypeScript\n- Prefer strict mode\n',
    );

    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(stdout).toContain('Watching');
    expect(stdout).toMatch(/Regenerated|Generated|created|updated/);
    expect(stdout.match(/Regenerated\./g) ?? []).toHaveLength(2);
    expect(readFileSync(join(TEST_DIR, '.claude', 'CLAUDE.md'), 'utf-8')).toContain(
      'Prefer strict mode',
    );

    child.kill('SIGINT');
    await new Promise((resolve) => child.on('exit', resolve));
  });
});

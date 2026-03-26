/**
 * E2E tests for agentsmesh diff.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import { createTestProject, cleanup } from './helpers/setup.js';

describe('diff', () => {
  let dir: string;

  afterEach(() => {
    if (dir) cleanup(dir);
  });

  it('no changes → exit 0', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);
    const r = await runCli('diff', dir);
    expect(r.exitCode).toBe(0);
  });

  it('rule modified → diff shown in stdout', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'CLAUDE.md'), '# Modified content\n');
    const r = await runCli('diff', dir);
    expect(r.exitCode).toBe(0); // diff command always exits 0
    expect(r.stdout + r.stderr).toMatch(/CLAUDE|diff|Modified|[-+]/);
  });

  it('new rule added → shows new file in diff', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);
    const rulesDir = join(dir, '.agentsmesh', 'rules');
    writeFileSync(
      join(rulesDir, 'new-rule.md'),
      '---\ndescription: New rule\n---\n# New rule content\n',
    );
    const r = await runCli('diff', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout + r.stderr).toMatch(/new|added|[-+]/);
  });

  it('rule deleted from canonical → diff runs without crash, fewer outputs', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);
    const { rmSync } = await import('node:fs');
    rmSync(join(dir, '.agentsmesh', 'rules', 'typescript.md'));
    const r = await runCli('diff', dir);
    expect(r.exitCode).toBe(0);
    expect(r.stdout + r.stderr).toMatch(/unchanged|created|updated/);
  });
});

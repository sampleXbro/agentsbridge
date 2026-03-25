/**
 * E2E tests for agentsbridge check.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli } from './helpers/run-cli.js';
import { createTestProject, cleanup } from './helpers/setup.js';

describe('check', () => {
  let dir: string;

  afterEach(() => {
    if (dir) cleanup(dir);
  });

  it('up to date → exit 0', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);
    const r = await runCli('check', dir);
    expect(r.exitCode).toBe(0);
  });

  it('canonical modified → exit 1', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);
    writeFileSync(
      join(dir, '.agentsbridge', 'rules', '_root.md'),
      '---\nroot: true\n---\n# Changed\n',
    );
    const r = await runCli('check', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/Conflict|modified|Run.*generate/);
  });

  it('lock file missing → exit 1', async () => {
    dir = createTestProject('canonical-full');
    // Never run generate - no lock
    const r = await runCli('check', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/Not initialized|generate first/i);
  });

  it('canonical file added after generate → exit 1', async () => {
    dir = createTestProject('canonical-full');
    await runCli('generate', dir);
    const { writeFileSync, mkdirSync } = await import('node:fs');
    const rulesDir = join(dir, '.agentsbridge', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, 'extra.md'), '---\ndescription: Extra\n---\n# Extra\n');
    const r = await runCli('check', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/added|Conflict|modified/i);
  });
});

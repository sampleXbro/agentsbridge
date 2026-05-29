/**
 * E2E tests for agentsmesh check.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
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
      join(dir, '.agentsmesh', 'rules', '_root.md'),
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
    const rulesDir = join(dir, '.agentsmesh', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(join(rulesDir, 'extra.md'), '---\ndescription: Extra\n---\n# Extra\n');
    const r = await runCli('check', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/added|Conflict|modified/i);
  });

  it('--global verifies $HOME/.agentsmesh/.lock — clean after generate --global', async () => {
    dir = createTestProject();
    const fakeHome = join(dir, 'home');
    const globalCanonical = join(fakeHome, '.agentsmesh');
    mkdirSync(join(globalCanonical, 'rules'), { recursive: true });
    writeFileSync(
      join(globalCanonical, 'agentsmesh.yaml'),
      'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends: []\n',
    );
    writeFileSync(
      join(globalCanonical, 'rules', '_root.md'),
      '---\nroot: true\n---\n# Global root\n',
    );

    const gen = await runCli('generate --global', dir, { HOME: fakeHome });
    expect(gen.exitCode, gen.stderr).toBe(0);

    const r = await runCli('check --global', dir, { HOME: fakeHome });
    expect(r.exitCode, r.stderr).toBe(0);
  });
});

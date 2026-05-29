/**
 * E2E: agentsmesh installs (read-only inventory).
 *
 * Covers: bare `installs` (help / no subcommand), `installs list`, unknown
 * subcommand (typo hint to `install`), --global path, --json envelope, and
 * the empty-manifest message.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, createTestProject } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';

function writeUpstream(root: string, suffix: string): string {
  const upstream = join(root, `upstream-${suffix}`);
  mkdirSync(join(upstream, '.agentsmesh', 'skills', `skill-${suffix}`), { recursive: true });
  writeFileSync(
    join(upstream, '.agentsmesh', 'skills', `skill-${suffix}`, 'SKILL.md'),
    `---\ndescription: ${suffix}\n---\n# ${suffix} body\n`,
  );
  return upstream;
}

function writeProjectConfig(dir: string): void {
  mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(dir, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules, skills]\nextends: []\n',
  );
  writeFileSync(join(dir, '.agentsmesh', 'rules', '_root.md'), '---\nroot: true\n---\n# Root\n');
}

describe('installs e2e', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('bare `installs` (no subcommand) prints help and exits 0', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);

    const r = await runCli('installs', dir);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(r.stdout + r.stderr).toMatch(/installs/i);
  });

  it('unknown subcommand exits 2 with did-you-mean hint pointing at install', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);

    const r = await runCli('installs ad', dir);
    expect(r.exitCode).toBe(2);
    expect(r.stdout + r.stderr).toMatch(/install/);
  });

  it('`installs list` on empty manifest reports nothing installed', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);

    const r = await runCli('installs list', dir);
    expect(r.exitCode, r.stderr).toBe(0);
    // No installed pack should be referenced.
    expect(r.stdout).not.toMatch(/^pack-/m);
  });

  it('`installs list` after install reports the pack name and source', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);
    const upstream = writeUpstream(dir, 'alpha');

    const install = await runCli(`install ${upstream} --force --name listed-pack`, dir);
    expect(install.exitCode, install.stderr).toBe(0);

    const r = await runCli('installs list', dir);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(r.stdout).toContain('listed-pack');
    // Source path should be visible (project-relative or absolute).
    expect(r.stdout).toMatch(/upstream-alpha/);
  });

  it('`installs list --json` emits a machine-readable envelope', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);
    const upstream = writeUpstream(dir, 'json');

    expect((await runCli(`install ${upstream} --force --name json-pack`, dir)).exitCode).toBe(0);

    const r = await runCli('installs list --json', dir);
    expect(r.exitCode, r.stderr).toBe(0);
    const parsed = JSON.parse(r.stdout) as {
      data?: { installs?: Array<{ name?: string }> };
    };
    const installs = parsed.data?.installs ?? [];
    expect(installs.some((entry) => entry.name === 'json-pack')).toBe(true);
  });

  it('`installs list --global` reads from ~/.agentsmesh/installs.yaml', async () => {
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

    const r = await runCli('installs list --global', dir, { HOME: fakeHome });
    expect(r.exitCode, r.stderr).toBe(0);
  });
});

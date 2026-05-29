/**
 * E2E: agentsmesh uninstall.
 *
 * Covers: positional <name>, batch (comma-separated names), --all, --dry-run,
 * --force (required in non-TTY), --keep-pack (drop manifest, keep pack/),
 * --keep-generated (skip post-uninstall generate), validation failures,
 * and the --global no-op path.
 *
 * Uses a local upstream so installs run without network or git fixtures.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, createTestProject } from './helpers/setup.js';
import { runCli } from './helpers/run-cli.js';

function writeUpstream(root: string, suffix: string, body: string): string {
  const upstream = join(root, `upstream-${suffix}`);
  mkdirSync(join(upstream, '.agentsmesh', 'skills', `skill-${suffix}`), { recursive: true });
  writeFileSync(
    join(upstream, '.agentsmesh', 'skills', `skill-${suffix}`, 'SKILL.md'),
    `---\ndescription: ${suffix}\n---\n# ${body}\n`,
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

describe('uninstall e2e', () => {
  let dir = '';

  afterEach(() => {
    if (dir) cleanup(dir);
    dir = '';
  });

  it('fails when no name and no --all', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);

    const r = await runCli('uninstall --force', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/Missing install name/);
  });

  it('non-TTY without --force or --dry-run is rejected', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);

    const r = await runCli('uninstall some-pack', dir);
    expect(r.exitCode).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/Non-interactive terminal/);
  });

  it('positional <name> removes the pack and its generated outputs', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);
    const upstream = writeUpstream(dir, 'a', 'A body');

    const install = await runCli(`install ${upstream} --force --name pack-a`, dir);
    expect(install.exitCode, install.stderr).toBe(0);

    const packDir = join(dir, '.agentsmesh', 'packs', 'pack-a');
    const generated = join(dir, '.claude', 'skills', 'skill-a', 'SKILL.md');
    expect(existsSync(packDir)).toBe(true);
    expect(existsSync(generated)).toBe(true);

    const r = await runCli('uninstall pack-a --force', dir);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(existsSync(packDir)).toBe(false);
    expect(existsSync(generated)).toBe(false);
    // installs.yaml entry should be gone
    const installs = readFileSync(join(dir, '.agentsmesh', 'installs.yaml'), 'utf8');
    expect(installs).not.toContain('pack-a');
  });

  it('--dry-run reports the plan without touching disk', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);
    const upstream = writeUpstream(dir, 'dry', 'D body');

    expect((await runCli(`install ${upstream} --force --name pack-dry`, dir)).exitCode).toBe(0);

    const packDir = join(dir, '.agentsmesh', 'packs', 'pack-dry');
    const generated = join(dir, '.claude', 'skills', 'skill-dry', 'SKILL.md');
    expect(existsSync(packDir)).toBe(true);

    const r = await runCli('uninstall pack-dry --dry-run', dir);
    expect(r.exitCode, r.stderr).toBe(0);
    // Pack and generated outputs untouched.
    expect(existsSync(packDir)).toBe(true);
    expect(existsSync(generated)).toBe(true);
    expect(readFileSync(join(dir, '.agentsmesh', 'installs.yaml'), 'utf8')).toContain('pack-dry');
  });

  it('--keep-pack removes installs.yaml entry but leaves the pack/ directory', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);
    const upstream = writeUpstream(dir, 'kp', 'K body');

    expect((await runCli(`install ${upstream} --force --name pack-kp`, dir)).exitCode).toBe(0);

    const packDir = join(dir, '.agentsmesh', 'packs', 'pack-kp');
    expect(existsSync(packDir)).toBe(true);

    const r = await runCli('uninstall pack-kp --force --keep-pack', dir);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(existsSync(packDir)).toBe(true);
    expect(readFileSync(join(dir, '.agentsmesh', 'installs.yaml'), 'utf8')).not.toContain(
      'pack-kp',
    );
  });

  it('--keep-generated leaves the generated tool outputs in place', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);
    const upstream = writeUpstream(dir, 'kg', 'KG body');

    expect((await runCli(`install ${upstream} --force --name pack-kg`, dir)).exitCode).toBe(0);

    const generated = join(dir, '.claude', 'skills', 'skill-kg', 'SKILL.md');
    expect(existsSync(generated)).toBe(true);

    const r = await runCli('uninstall pack-kg --force --keep-generated', dir);
    expect(r.exitCode, r.stderr).toBe(0);
    // generated tool file is preserved
    expect(existsSync(generated)).toBe(true);
    // a warning about stale files should be surfaced
    expect(r.stdout + r.stderr).toMatch(/keep-generated|stale/i);
  });

  it('--all removes every installed pack', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);
    const up1 = writeUpstream(dir, '1', 'one');
    const up2 = writeUpstream(dir, '2', 'two');

    expect((await runCli(`install ${up1} --force --name pack-1`, dir)).exitCode).toBe(0);
    expect((await runCli(`install ${up2} --force --name pack-2`, dir)).exitCode).toBe(0);

    const pack1 = join(dir, '.agentsmesh', 'packs', 'pack-1');
    const pack2 = join(dir, '.agentsmesh', 'packs', 'pack-2');
    expect(existsSync(pack1)).toBe(true);
    expect(existsSync(pack2)).toBe(true);

    const r = await runCli('uninstall --all --force', dir);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(existsSync(pack1)).toBe(false);
    expect(existsSync(pack2)).toBe(false);
  });

  it('comma-separated names remove a batch in one call', async () => {
    dir = createTestProject();
    writeProjectConfig(dir);
    const upA = writeUpstream(dir, 'ba', 'A');
    const upB = writeUpstream(dir, 'bb', 'B');
    const upC = writeUpstream(dir, 'bc', 'C');

    for (const [u, n] of [
      [upA, 'pack-ba'],
      [upB, 'pack-bb'],
      [upC, 'pack-bc'],
    ] as const) {
      expect((await runCli(`install ${u} --force --name ${n}`, dir)).exitCode).toBe(0);
    }

    const r = await runCli('uninstall pack-ba,pack-bc --force', dir);
    expect(r.exitCode, r.stderr).toBe(0);
    expect(existsSync(join(dir, '.agentsmesh', 'packs', 'pack-ba'))).toBe(false);
    expect(existsSync(join(dir, '.agentsmesh', 'packs', 'pack-bc'))).toBe(false);
    // pack-bb was not named — still present.
    expect(existsSync(join(dir, '.agentsmesh', 'packs', 'pack-bb'))).toBe(true);
  });

  it('--global --all is a no-op when no installs exist at user scope', async () => {
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

    const r = await runCli('uninstall --all --force --global', dir, { HOME: fakeHome });
    expect(r.exitCode, r.stderr).toBe(0);
  });
});

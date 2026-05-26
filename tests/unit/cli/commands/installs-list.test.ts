/**
 * Unit coverage for `agentsmesh installs list`.
 *
 * Three shapes under test:
 *   1. Empty manifest -> empty list, exit 0.
 *   2. Single entry -> hydrated row with `installed_at` + `source_type`
 *      pulled from `.agentsmesh-install-manifest.json`; `pack_path` uses
 *      forward slashes (project rule).
 *   3. Multiple entries -> preserve the yaml insertion order.
 *
 * Each test seeds tmp dirs by hand to avoid the full install pipeline — the
 * integration tests below cover the end-to-end install -> list path.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify as stringifyYaml } from 'yaml';
import { runInstalls } from '../../../../src/cli/commands/installs.js';

let tmpDir: string;

async function writeAgentsmeshYaml(): Promise<void> {
  await writeFile(
    join(tmpDir, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules]\nextends: []\n',
  );
}

async function seedInstallsYaml(installs: ReadonlyArray<Record<string, unknown>>): Promise<void> {
  await mkdir(join(tmpDir, '.agentsmesh'), { recursive: true });
  await writeFile(
    join(tmpDir, '.agentsmesh', 'installs.yaml'),
    stringifyYaml({ version: 1, installs }),
  );
}

async function seedPackManifest(name: string, manifest: Record<string, unknown>): Promise<void> {
  const packDir = join(tmpDir, '.agentsmesh', 'packs', name);
  await mkdir(packDir, { recursive: true });
  await writeFile(
    join(packDir, '.agentsmesh-install-manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
}

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'agentsmesh-installs-list-test-'));
  await writeAgentsmeshYaml();
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('installs list - empty manifest', () => {
  it('returns an empty installs array and exits 0 when installs.yaml is missing', async () => {
    const result = await runInstalls({}, ['list'], tmpDir);

    expect(result.exitCode).toBe(0);
    expect(result.data.subcommand).toBe('list');
    expect(result.data.scope).toBe('project');
    expect(result.data.installs).toEqual([]);
  });

  it('returns an empty installs array when installs.yaml has zero entries', async () => {
    await seedInstallsYaml([]);

    const result = await runInstalls({}, ['list'], tmpDir);

    expect(result.exitCode).toBe(0);
    expect(result.data.installs).toEqual([]);
  });
});

describe('installs list - single entry', () => {
  it('hydrates installed_at and source_type from the pack install-manifest', async () => {
    await seedInstallsYaml([
      {
        name: 'demo-pack',
        source: 'github:acme/demo@abc',
        version: 'abc',
        source_kind: 'github',
        features: ['skills', 'rules'],
        target: 'claude-code',
        path: 'sub/dir',
      },
    ]);
    await seedPackManifest('demo-pack', {
      name: 'demo-pack',
      source: 'github:acme/demo@abc',
      installed_at: '2026-05-16T10:00:00.000Z',
      extends_id: null,
      source_type: 'anthropic-skill-pack',
      files: {},
    });

    const result = await runInstalls({}, ['list'], tmpDir);

    expect(result.exitCode).toBe(0);
    expect(result.data.installs).toHaveLength(1);
    expect(result.data.installs[0]).toEqual({
      name: 'demo-pack',
      source: 'github:acme/demo@abc',
      source_kind: 'github',
      source_type: 'anthropic-skill-pack',
      version: 'abc',
      features: ['skills', 'rules'],
      target: 'claude-code',
      installed_at: '2026-05-16T10:00:00.000Z',
      refreshed_at: null,
      pack_path: '.agentsmesh/packs/demo-pack',
      license: null,
    });
  });

  it('surfaces the SPDX license recorded in pack.yaml', async () => {
    await seedInstallsYaml([
      {
        name: 'mit-pack',
        source: 'github:acme/mit@abc',
        source_kind: 'github',
        features: ['skills'],
      },
    ]);
    const packDir = join(tmpDir, '.agentsmesh', 'packs', 'mit-pack');
    await mkdir(packDir, { recursive: true });
    await writeFile(
      join(packDir, 'pack.yaml'),
      stringifyYaml({
        name: 'mit-pack',
        source: 'github:acme/mit@abc',
        source_kind: 'github',
        installed_at: '2026-05-16T10:00:00.000Z',
        updated_at: '2026-05-16T10:00:00.000Z',
        features: ['skills'],
        content_hash: 'sha256:dummy',
        license: 'MIT',
      }),
    );

    const result = await runInstalls({}, ['list'], tmpDir);

    expect(result.data.installs[0]?.license).toBe('MIT');
  });

  it('leaves installed_at and source_type null when the pack manifest is missing', async () => {
    await seedInstallsYaml([
      {
        name: 'demo-pack',
        source: 'local:/some/path',
        source_kind: 'local',
        features: ['rules'],
      },
    ]);

    const result = await runInstalls({}, ['list'], tmpDir);

    expect(result.data.installs[0]).toMatchObject({
      name: 'demo-pack',
      source_type: null,
      installed_at: null,
      version: null,
      target: null,
      pack_path: '.agentsmesh/packs/demo-pack',
    });
  });
});

describe('installs list - multiple entries', () => {
  it('returns rows in the yaml insertion order (read-only; no resort)', async () => {
    await seedInstallsYaml([
      { name: 'zed', source: 'github:a/zed@x', source_kind: 'github', features: ['rules'] },
      { name: 'alpha', source: 'github:a/alpha@y', source_kind: 'github', features: ['rules'] },
      { name: 'mid', source: 'github:a/mid@z', source_kind: 'github', features: ['rules'] },
    ]);

    const result = await runInstalls({}, ['list'], tmpDir);

    expect(result.data.installs.map((row) => row.name)).toEqual(['zed', 'alpha', 'mid']);
  });
});

describe('installs - subcommand dispatch', () => {
  it('with no subcommand returns the help banner and exit 0', async () => {
    const result = await runInstalls({}, [], tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.showHelp).toBe(true);
  });

  it('rejects unknown subcommands with exit 2 and a typo hint to use install', async () => {
    const result = await runInstalls({}, ['nope'], tmpDir);
    expect(result.exitCode).toBe(2);
    expect(result.error).toMatch(/Unknown installs subcommand|did you mean.*install/i);
  });
});

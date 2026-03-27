import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildInstallManifestEntry,
  readInstallManifest,
  upsertInstallManifestEntry,
} from '../../../src/install/core/install-manifest.js';

function makeConfigDir(name: string): string {
  const dir = join(tmpdir(), `agentsmesh-install-manifest-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, '.agentsmesh'), { recursive: true });
  return dir;
}

afterEach(() => {
  rmSync(join(tmpdir(), 'agentsmesh-install-manifest-missing'), { recursive: true, force: true });
  rmSync(join(tmpdir(), 'agentsmesh-install-manifest-valid'), { recursive: true, force: true });
  rmSync(join(tmpdir(), 'agentsmesh-install-manifest-invalid'), { recursive: true, force: true });
  rmSync(join(tmpdir(), 'agentsmesh-install-manifest-name'), { recursive: true, force: true });
  rmSync(join(tmpdir(), 'agentsmesh-install-manifest-identity'), { recursive: true, force: true });
});

describe('readInstallManifest', () => {
  it('returns an empty list when the manifest file is missing', async () => {
    const configDir = makeConfigDir('missing');

    await expect(readInstallManifest(configDir)).resolves.toEqual([]);
  });

  it('returns parsed installs for a valid manifest and [] for invalid content', async () => {
    const validDir = makeConfigDir('valid');
    writeFileSync(
      join(validDir, '.agentsmesh', 'installs.yaml'),
      `version: 1
installs:
  - name: review-pack
    source: github:org/repo@v1
    source_kind: github
    features: [skills, rules]
    pick:
      skills: [review]
    paths: [skills/review]
    as: skills
`,
    );

    await expect(readInstallManifest(validDir)).resolves.toEqual([
      {
        name: 'review-pack',
        source: 'github:org/repo@v1',
        source_kind: 'github',
        features: ['skills', 'rules'],
        pick: { skills: ['review'] },
        paths: ['skills/review'],
        as: 'skills',
      },
    ]);

    const invalidDir = makeConfigDir('invalid');
    writeFileSync(join(invalidDir, '.agentsmesh', 'installs.yaml'), 'version: 2\ninstalls: nope\n');
    await expect(readInstallManifest(invalidDir)).resolves.toEqual([]);
  });
});

describe('upsertInstallManifestEntry', () => {
  it('replaces an existing entry with the same name and keeps the manifest sorted', async () => {
    const configDir = makeConfigDir('name');
    writeFileSync(
      join(configDir, '.agentsmesh', 'installs.yaml'),
      `version: 1
installs:
  - name: zeta
    source: github:org/zeta@v1
    source_kind: github
    features: [rules]
  - name: alpha
    source: github:org/alpha@v1
    source_kind: github
    features: [skills]
`,
    );

    await upsertInstallManifestEntry(
      configDir,
      buildInstallManifestEntry({
        name: 'alpha',
        source: 'github:org/alpha@v2',
        version: 'v2',
        sourceKind: 'github',
        features: ['commands'],
        path: 'commands',
      }),
    );

    await expect(readInstallManifest(configDir)).resolves.toEqual([
      {
        name: 'alpha',
        source: 'github:org/alpha@v2',
        version: 'v2',
        source_kind: 'github',
        features: ['commands'],
        path: 'commands',
      },
      {
        name: 'zeta',
        source: 'github:org/zeta@v1',
        source_kind: 'github',
        features: ['rules'],
      },
    ]);
  });

  it('replaces entries with the same install identity even when names differ', async () => {
    const configDir = makeConfigDir('identity');
    writeFileSync(
      join(configDir, '.agentsmesh', 'installs.yaml'),
      `version: 1
installs:
  - name: old-name
    source: git+https://example.com/org/repo.git#main
    source_kind: git
    target: cursor
    as: skills
    features: [rules, skills]
  - name: keep-me
    source: github:org/other@v1
    source_kind: github
    features: [rules]
`,
    );

    await upsertInstallManifestEntry(
      configDir,
      buildInstallManifestEntry({
        name: 'renamed-pack',
        source: 'git+https://example.com/org/repo.git#main',
        sourceKind: 'git',
        target: 'cursor',
        as: 'skills',
        features: ['skills', 'rules'],
        paths: ['skills/review', 'rules'],
      }),
    );

    await expect(readInstallManifest(configDir)).resolves.toEqual([
      {
        name: 'keep-me',
        source: 'github:org/other@v1',
        source_kind: 'github',
        features: ['rules'],
      },
      {
        name: 'renamed-pack',
        source: 'git+https://example.com/org/repo.git#main',
        source_kind: 'git',
        target: 'cursor',
        as: 'skills',
        features: ['skills', 'rules'],
        paths: ['skills/review', 'rules'],
      },
    ]);
  });
});

describe('buildInstallManifestEntry', () => {
  it('preserves optional fields for manual installs', () => {
    expect(
      buildInstallManifestEntry({
        name: 'manual-skill',
        source: './skills',
        version: 'local',
        sourceKind: 'local',
        features: ['skills'],
        pick: { skills: ['release-manager'] },
        target: 'claude-code',
        path: 'skills',
        paths: ['skills', 'skills/engineering'],
        as: 'skills',
      }),
    ).toEqual({
      name: 'manual-skill',
      source: './skills',
      version: 'local',
      source_kind: 'local',
      features: ['skills'],
      pick: { skills: ['release-manager'] },
      target: 'claude-code',
      path: 'skills',
      paths: ['skills', 'skills/engineering'],
      as: 'skills',
    });
  });
});

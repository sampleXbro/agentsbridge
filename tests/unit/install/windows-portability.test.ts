import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildInstallManifestEntry,
  readInstallManifest,
} from '../../../src/install/core/install-manifest.js';
import { mergeIntoPack } from '../../../src/install/pack/pack-merge.js';
import { materializePack } from '../../../src/install/pack/pack-writer.js';
import { localParsedFromAbsPath } from '../../../src/install/source/parse-install-local.js';
import type { CanonicalFiles } from '../../../src/core/types.js';
import type { PackMetadata } from '../../../src/install/pack/pack-schema.js';

function emptyCanonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

function readPackYaml(path: string): Record<string, unknown> {
  return parseYaml(readFileSync(path, 'utf-8')) as Record<string, unknown>;
}

const TMP_ROOTS: string[] = [];

afterEach(() => {
  for (const root of TMP_ROOTS) {
    rmSync(root, { recursive: true, force: true });
  }
  TMP_ROOTS.length = 0;
});

describe('Windows install portability', () => {
  it('parses Windows local paths with .agentsmesh segments into POSIX manifest paths', () => {
    const parsed = localParsedFromAbsPath(
      'C:\\work\\shared\\.agentsmesh\\skills\\tdd\\',
      'C:\\work\\project',
      '',
    );

    expect(parsed).toEqual({
      kind: 'local',
      rawRef: '',
      pathInRepo: 'skills/tdd',
      localRoot: 'C:\\work\\shared',
      localSourceForYaml: '../shared',
    });
  });

  it('keeps cross-drive Windows local sources absolute and POSIX-normalized', () => {
    const parsed = localParsedFromAbsPath(
      'D:\\packs\\team\\.agentsmesh\\rules\\team.md',
      'C:\\work\\project',
      '',
    );

    expect(parsed.localRoot).toBe('D:\\packs\\team');
    expect(parsed.pathInRepo).toBe('rules/team');
    expect(parsed.localSourceForYaml).toBe('D:/packs/team');
  });

  it('normalizes persisted local install manifest paths to POSIX', () => {
    expect(
      buildInstallManifestEntry({
        name: 'manual-skill',
        source: '.\\shared\\skills',
        sourceKind: 'local',
        features: ['skills'],
        path: 'skills\\review',
        paths: ['skills\\review', 'rules\\team'],
      }),
    ).toMatchObject({
      source: './shared/skills',
      path: 'skills/review',
      paths: ['skills/review', 'rules/team'],
    });
  });

  it('normalizes legacy local install manifests when reading them', async () => {
    const root = mkdtempSync(join(tmpdir(), 'am-windows-manifest-'));
    TMP_ROOTS.push(root);
    const canonicalDir = join(root, '.agentsmesh');
    mkdirSync(canonicalDir, { recursive: true });
    writeFileSync(
      join(canonicalDir, 'installs.yaml'),
      `version: 1
installs:
  - name: manual-skill
    source: .\\shared\\skills
    source_kind: local
    features: [skills]
    path: skills\\review
    paths: [skills\\review, rules\\team]
`,
    );

    await expect(readInstallManifest(canonicalDir)).resolves.toEqual([
      {
        name: 'manual-skill',
        source: './shared/skills',
        source_kind: 'local',
        features: ['skills'],
        path: 'skills/review',
        paths: ['skills/review', 'rules/team'],
      },
    ]);
  });

  it('writes pack metadata local path fields as POSIX', async () => {
    const root = mkdtempSync(join(tmpdir(), 'am-windows-pack-'));
    TMP_ROOTS.push(root);
    const packsDir = join(root, '.agentsmesh', 'packs');

    const metadata: Omit<PackMetadata, 'content_hash'> = {
      name: 'manual-pack',
      source: '.\\shared\\pack',
      source_kind: 'local',
      installed_at: '2026-04-26T00:00:00.000Z',
      updated_at: '2026-04-26T00:00:00.000Z',
      features: ['skills'],
      path: 'skills\\review',
      paths: ['skills\\review', 'rules\\team'],
    };

    await materializePack(packsDir, 'manual-pack', emptyCanonical(), metadata);

    expect(readPackYaml(join(packsDir, 'manual-pack', 'pack.yaml'))).toMatchObject({
      source: './shared/pack',
      path: 'skills/review',
      paths: ['skills/review', 'rules/team'],
    });
  });

  it('normalizes refreshed local pack metadata paths during merge', async () => {
    const root = mkdtempSync(join(tmpdir(), 'am-windows-pack-merge-'));
    TMP_ROOTS.push(root);
    const packDir = join(root, '.agentsmesh', 'packs', 'manual-pack');
    mkdirSync(packDir, { recursive: true });

    const existingMeta: PackMetadata = {
      name: 'manual-pack',
      source: '.\\old\\pack',
      source_kind: 'local',
      installed_at: '2026-04-26T00:00:00.000Z',
      updated_at: '2026-04-26T00:00:00.000Z',
      features: ['skills'],
      path: 'skills\\review',
      content_hash: 'old',
    };

    await mergeIntoPack(packDir, existingMeta, emptyCanonical(), ['rules'], undefined, {
      source: '.\\new\\pack',
      path: 'rules\\team',
    });

    expect(readPackYaml(join(packDir, 'pack.yaml'))).toMatchObject({
      source: './new/pack',
      paths: ['skills/review', 'rules/team'],
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  migrateLegacyManifest,
  type LegacyMigrationDeps,
} from '../../../../src/install/uninstall/legacy-manifest-migration.js';

let tmpDir: string;

const PACK_YAML = [
  'name: legacy-pack',
  'source: github:acme/legacy-pack@abc1234',
  'source_kind: github',
  'installed_at: "2026-01-01T00:00:00.000Z"',
  'updated_at: "2026-01-01T00:00:00.000Z"',
  'features:',
  '  - rules',
  'content_hash: sha256:legacy-fake',
  '',
].join('\n');

beforeEach(() => {
  tmpDir = join(tmpdir(), `legacy-manifest-migration-test-${Date.now()}-${Math.random()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function makeDeps(): { deps: LegacyMigrationDeps; warnings: string[] } {
  const warnings: string[] = [];
  return {
    warnings,
    deps: {
      warn(message: string): void {
        warnings.push(message);
      },
    },
  };
}

function seedLegacyPack(): void {
  writeFileSync(join(tmpDir, 'pack.yaml'), PACK_YAML);
  mkdirSync(join(tmpDir, 'rules'), { recursive: true });
  writeFileSync(join(tmpDir, 'rules', '_root.md'), '# root\n');
  mkdirSync(join(tmpDir, 'skills', 'demo'), { recursive: true });
  writeFileSync(join(tmpDir, 'skills', 'demo', 'SKILL.md'), '# demo\n');
}

describe('migrateLegacyManifest', () => {
  it('returns null and writes nothing when an install manifest is already present', async () => {
    seedLegacyPack();
    const existing = '{"name":"legacy-pack","files":{}}';
    writeFileSync(join(tmpDir, '.agentsmesh-install-manifest.json'), existing);
    const { deps, warnings } = makeDeps();

    const result = await migrateLegacyManifest(tmpDir, deps);

    expect(result).toBeNull();
    expect(warnings).toEqual([]);
    expect(readFileSync(join(tmpDir, '.agentsmesh-install-manifest.json'), 'utf8')).toBe(existing);
  });

  it('writes a baseline manifest derived from pack.yaml + current file hashes', async () => {
    seedLegacyPack();
    const { deps } = makeDeps();

    const result = await migrateLegacyManifest(tmpDir, deps);

    expect(result).not.toBeNull();
    expect(result!.manifestPath).toBe(join(tmpDir, '.agentsmesh-install-manifest.json'));
    expect(existsSync(result!.manifestPath)).toBe(true);

    const onDisk = JSON.parse(readFileSync(result!.manifestPath, 'utf8')) as unknown;
    expect(onDisk).toEqual({
      name: 'legacy-pack',
      source: 'github:acme/legacy-pack@abc1234',
      installed_at: '2026-01-01T00:00:00.000Z',
      extends_id: null,
      source_type: null,
      files: result!.manifest.files,
    });
  });

  it('produced files map matches hashPackFiles output exactly', async () => {
    seedLegacyPack();
    const { deps } = makeDeps();
    const result = await migrateLegacyManifest(tmpDir, deps);
    expect(result).not.toBeNull();

    const fileKeys = Object.keys(result!.manifest.files).sort();
    expect(fileKeys).toEqual(['rules/_root.md', 'skills/demo/SKILL.md']);
    for (const value of Object.values(result!.manifest.files)) {
      expect(value).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it('emits a warn-level diagnostic identifying the pack and the migration', async () => {
    seedLegacyPack();
    const { deps, warnings } = makeDeps();

    await migrateLegacyManifest(tmpDir, deps);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('legacy-pack');
    expect(warnings[0]!.toLowerCase()).toContain('legacy');
  });

  it('throws when pack.yaml is missing (we cannot synthesize a manifest without provenance)', async () => {
    mkdirSync(join(tmpDir, 'rules'), { recursive: true });
    writeFileSync(join(tmpDir, 'rules', '_root.md'), '# root\n');
    const { deps } = makeDeps();

    await expect(migrateLegacyManifest(tmpDir, deps)).rejects.toThrow(/pack\.yaml/);
  });

  it('throws when pack.yaml is unreadable as valid pack metadata', async () => {
    writeFileSync(join(tmpDir, 'pack.yaml'), 'not: { valid pack metadata');
    const { deps } = makeDeps();

    await expect(migrateLegacyManifest(tmpDir, deps)).rejects.toThrow(/pack\.yaml/);
  });
});

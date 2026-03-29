import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import {
  readPackMetadata,
  findExistingPack,
  listPacks,
} from '../../../src/install/pack/pack-reader.js';
import type { PackMetadata } from '../../../src/install/pack/pack-schema.js';

const BASE_META: PackMetadata = {
  name: 'org-repo',
  source: 'github:org/repo@abc123',
  version: 'abc123',
  source_kind: 'github',
  installed_at: '2026-03-22T10:00:00Z',
  updated_at: '2026-03-22T10:00:00Z',
  features: ['skills'],
  content_hash: 'sha256:aabb',
};

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `pack-reader-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writePackYaml(packDir: string, meta: PackMetadata): void {
  mkdirSync(packDir, { recursive: true });
  writeFileSync(join(packDir, 'pack.yaml'), stringify(meta), 'utf-8');
}

describe('readPackMetadata', () => {
  it('reads and parses a valid pack.yaml', async () => {
    const packDir = join(tmpDir, 'my-pack');
    writePackYaml(packDir, BASE_META);
    const result = await readPackMetadata(packDir);
    expect(result).not.toBeNull();
    const metadata = result!;
    expect(metadata.name).toBe('org-repo');
    expect(metadata.source).toBe('github:org/repo@abc123');
    expect(metadata.features).toEqual(['skills']);
  });

  it('returns null when pack.yaml does not exist', async () => {
    const result = await readPackMetadata(join(tmpDir, 'nonexistent'));
    expect(result).toBeNull();
  });

  it('returns null when pack.yaml is invalid YAML', async () => {
    const packDir = join(tmpDir, 'bad-pack');
    mkdirSync(packDir);
    writeFileSync(join(packDir, 'pack.yaml'), '{ invalid yaml: [', 'utf-8');
    const result = await readPackMetadata(packDir);
    expect(result).toBeNull();
  });

  it('returns null when pack.yaml fails schema validation', async () => {
    const packDir = join(tmpDir, 'bad-schema');
    mkdirSync(packDir);
    writeFileSync(join(packDir, 'pack.yaml'), stringify({ name: 'x' }), 'utf-8');
    const result = await readPackMetadata(packDir);
    expect(result).toBeNull();
  });
});

describe('findExistingPack', () => {
  it('finds a pack matching the source', async () => {
    const packDir = join(tmpDir, 'org-repo');
    writePackYaml(packDir, BASE_META);
    const result = await findExistingPack(tmpDir, 'github:org/repo@abc123', {});
    expect(result).not.toBeNull();
    expect(result?.name).toBe('org-repo');
    expect(result?.packDir).toBe(packDir);
  });

  it('returns null when no pack matches source', async () => {
    const packDir = join(tmpDir, 'org-repo');
    writePackYaml(packDir, BASE_META);
    const result = await findExistingPack(tmpDir, 'github:other/repo@xyz', {});
    expect(result).toBeNull();
  });

  it('matches the same remote repo even when the pinned version changes', async () => {
    const packDir = join(tmpDir, 'org-repo');
    writePackYaml(packDir, BASE_META);

    const result = await findExistingPack(tmpDir, 'github:org/repo@def456', {});

    expect(result).not.toBeNull();
    expect(result?.name).toBe('org-repo');
    expect(result?.meta.source).toBe('github:org/repo@abc123');
  });

  it('matches a pack from the same repo when the install path differs but features match', async () => {
    const packDir = join(tmpDir, 'org-repo');
    writePackYaml(packDir, { ...BASE_META, path: 'agents/universal' });

    const result = await findExistingPack(tmpDir, 'github:org/repo@def456', {
      path: 'agents/frontend',
      features: ['skills'],
    });

    expect(result?.name).toBe('org-repo');
  });

  it('does not match a pack from the same repo when the feature set differs', async () => {
    const packDir = join(tmpDir, 'org-repo');
    writePackYaml(packDir, { ...BASE_META, path: 'agents/universal' });

    const result = await findExistingPack(tmpDir, 'github:org/repo@def456', {
      features: ['commands'],
    });

    expect(result).toBeNull();
  });

  it('returns null when packsDir does not exist', async () => {
    const result = await findExistingPack(join(tmpDir, 'nonexistent'), 'github:org/repo@abc', {});
    expect(result).toBeNull();
  });

  it('skips directories without valid pack.yaml', async () => {
    const badPack = join(tmpDir, 'bad');
    mkdirSync(badPack);
    // no pack.yaml
    const result = await findExistingPack(tmpDir, 'github:org/repo@abc123', {});
    expect(result).toBeNull();
  });
});

describe('listPacks', () => {
  it('returns all valid packs', async () => {
    writePackYaml(join(tmpDir, 'pack-a'), { ...BASE_META, name: 'pack-a' });
    writePackYaml(join(tmpDir, 'pack-b'), {
      ...BASE_META,
      name: 'pack-b',
      source: 'github:org/other@def456',
    });
    const packs = await listPacks(tmpDir);
    expect(packs).toHaveLength(2);
    const names = packs.map((p) => p.name).sort();
    expect(names).toEqual(['pack-a', 'pack-b']);
  });

  it('returns empty array when packsDir does not exist', async () => {
    const result = await listPacks(join(tmpDir, 'nonexistent'));
    expect(result).toEqual([]);
  });

  it('ignores invalid packs', async () => {
    writePackYaml(join(tmpDir, 'valid-pack'), BASE_META);
    const badDir = join(tmpDir, 'bad-pack');
    mkdirSync(badDir);
    writeFileSync(join(badDir, 'pack.yaml'), 'bad yaml [', 'utf-8');
    const packs = await listPacks(tmpDir);
    expect(packs).toHaveLength(1);
    expect(packs[0]?.name).toBe('org-repo');
  });

  it('ignores non-directory entries', async () => {
    writePackYaml(join(tmpDir, 'valid-pack'), BASE_META);
    writeFileSync(join(tmpDir, 'some-file.txt'), 'hello');
    const packs = await listPacks(tmpDir);
    expect(packs).toHaveLength(1);
  });
});

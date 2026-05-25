import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  detectModifiedFiles,
  type ModifiedFile,
} from '../../../../src/install/uninstall/detect-modified.js';
import { hashPackFiles } from '../../../../src/install/manifest/install-manifest-hash.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `detect-modified-test-${Date.now()}-${Math.random()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

async function seedPack(): Promise<Record<string, string>> {
  mkdirSync(join(tmpDir, 'skills', 'demo'), { recursive: true });
  writeFileSync(join(tmpDir, 'skills', 'demo', 'SKILL.md'), '# demo\n');
  writeFileSync(join(tmpDir, 'rules', '_root.md'), '# root\n');
  return hashPackFiles(tmpDir);
}

beforeEach(() => {
  // Ensure rules dir is present in all tests that build pack contents.
  mkdirSync(join(tmpDir, 'rules'), { recursive: true });
});

describe('detectModifiedFiles', () => {
  it('returns an empty result for a pristine pack matching its manifest', async () => {
    const expected = await seedPack();
    const result = await detectModifiedFiles(tmpDir, expected);
    expect(result).toEqual([]);
  });

  it('reports "modified" for a file whose contents changed since install', async () => {
    const expected = await seedPack();
    writeFileSync(join(tmpDir, 'skills', 'demo', 'SKILL.md'), '# demo CHANGED\n');

    const result = await detectModifiedFiles(tmpDir, expected);
    expect(result).toEqual([
      {
        relativePath: 'skills/demo/SKILL.md',
        status: 'modified',
      } satisfies ModifiedFile,
    ]);
  });

  it('reports "deleted" for a file present in the manifest but missing from disk', async () => {
    const expected = await seedPack();
    rmSync(join(tmpDir, 'rules', '_root.md'));

    const result = await detectModifiedFiles(tmpDir, expected);
    expect(result).toEqual([
      {
        relativePath: 'rules/_root.md',
        status: 'deleted',
      } satisfies ModifiedFile,
    ]);
  });

  it('reports "added" for a file present on disk but not in the manifest', async () => {
    const expected = await seedPack();
    writeFileSync(join(tmpDir, 'skills', 'demo', 'extra.md'), 'new\n');

    const result = await detectModifiedFiles(tmpDir, expected);
    expect(result).toEqual([
      {
        relativePath: 'skills/demo/extra.md',
        status: 'added',
      } satisfies ModifiedFile,
    ]);
  });

  it('returns multiple entries sorted by relative path ascending', async () => {
    const expected = await seedPack();
    writeFileSync(join(tmpDir, 'skills', 'demo', 'SKILL.md'), '# demo CHANGED\n');
    rmSync(join(tmpDir, 'rules', '_root.md'));
    writeFileSync(join(tmpDir, 'skills', 'demo', 'extra.md'), 'new\n');

    const result = await detectModifiedFiles(tmpDir, expected);
    expect(result).toEqual([
      { relativePath: 'rules/_root.md', status: 'deleted' },
      { relativePath: 'skills/demo/SKILL.md', status: 'modified' },
      { relativePath: 'skills/demo/extra.md', status: 'added' },
    ] satisfies ModifiedFile[]);
  });

  it('ignores pack.yaml and the install-manifest file on disk', async () => {
    const expected = await seedPack();
    writeFileSync(join(tmpDir, 'pack.yaml'), 'name: x\n');
    writeFileSync(join(tmpDir, '.agentsmesh-install-manifest.json'), '{}');

    const result = await detectModifiedFiles(tmpDir, expected);
    expect(result).toEqual([]);
  });

  it('returns an empty result for an empty pack and empty manifest', async () => {
    const result = await detectModifiedFiles(tmpDir, {});
    expect(result).toEqual([]);
  });

  it('reports added/modified/deleted independently across many files', async () => {
    writeFileSync(join(tmpDir, 'a.md'), 'a');
    writeFileSync(join(tmpDir, 'b.md'), 'b');
    writeFileSync(join(tmpDir, 'c.md'), 'c');
    const expected = await hashPackFiles(tmpDir);

    writeFileSync(join(tmpDir, 'a.md'), 'a-changed');
    rmSync(join(tmpDir, 'b.md'));
    writeFileSync(join(tmpDir, 'd.md'), 'd');

    const result = await detectModifiedFiles(tmpDir, expected);
    expect(result).toEqual([
      { relativePath: 'a.md', status: 'modified' },
      { relativePath: 'b.md', status: 'deleted' },
      { relativePath: 'd.md', status: 'added' },
    ] satisfies ModifiedFile[]);
  });
});

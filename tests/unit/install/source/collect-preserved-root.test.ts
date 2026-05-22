import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collectPreservedRootFiles } from '../../../../src/install/source/collect-preserved-root.js';

let root: string;

beforeEach(() => {
  root = join(
    tmpdir(),
    `collect-preserved-root-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(root, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('collectPreservedRootFiles', () => {
  it('returns README and LICENSE at the source root', async () => {
    writeFileSync(join(root, 'README.md'), '# upstream\n', 'utf-8');
    writeFileSync(join(root, 'LICENSE'), 'MIT\n', 'utf-8');

    const got = await collectPreservedRootFiles(root);

    expect(got.map((f) => f.relativePath).sort()).toEqual(['LICENSE', 'README.md']);
    for (const file of got) {
      expect(file.absolutePath.startsWith(root)).toBe(true);
    }
  });

  it('returns all preserved boilerplate variants (NOTICE / COPYING / COPYRIGHT / LICENSE-MIT)', async () => {
    writeFileSync(join(root, 'NOTICE'), 'n', 'utf-8');
    writeFileSync(join(root, 'COPYING'), 'c', 'utf-8');
    writeFileSync(join(root, 'COPYRIGHT'), 'cr', 'utf-8');
    writeFileSync(join(root, 'LICENSE-MIT'), 'mit', 'utf-8');
    writeFileSync(join(root, 'README.txt'), 'readme', 'utf-8');

    const got = await collectPreservedRootFiles(root);

    expect(got.map((f) => f.relativePath).sort()).toEqual([
      'COPYING',
      'COPYRIGHT',
      'LICENSE-MIT',
      'NOTICE',
      'README.txt',
    ]);
  });

  it('excludes noise boilerplate (CHANGELOG, CONTRIBUTING, etc.)', async () => {
    writeFileSync(join(root, 'CHANGELOG.md'), 'x', 'utf-8');
    writeFileSync(join(root, 'CONTRIBUTING.md'), 'x', 'utf-8');
    writeFileSync(join(root, 'CODE_OF_CONDUCT.md'), 'x', 'utf-8');
    writeFileSync(join(root, 'SECURITY.md'), 'x', 'utf-8');
    writeFileSync(join(root, 'README.md'), 'r', 'utf-8');

    const got = await collectPreservedRootFiles(root);

    expect(got.map((f) => f.relativePath)).toEqual(['README.md']);
  });

  it('excludes non-boilerplate files (agents/foo.md, source files)', async () => {
    writeFileSync(join(root, 'foo.md'), 'x', 'utf-8');
    writeFileSync(join(root, 'package.json'), '{}', 'utf-8');
    writeFileSync(join(root, '.gitignore'), 'node_modules', 'utf-8');
    writeFileSync(join(root, 'README.md'), 'r', 'utf-8');

    const got = await collectPreservedRootFiles(root);

    expect(got.map((f) => f.relativePath)).toEqual(['README.md']);
  });

  it('does not recurse into subdirectories', async () => {
    mkdirSync(join(root, 'agents'));
    writeFileSync(join(root, 'agents', 'README.md'), 'nested', 'utf-8');
    writeFileSync(join(root, 'agents', 'foo.md'), 'agent', 'utf-8');
    writeFileSync(join(root, 'README.md'), 'top', 'utf-8');

    const got = await collectPreservedRootFiles(root);

    expect(got.map((f) => f.relativePath)).toEqual(['README.md']);
  });

  it('returns empty array when no preserved files at root', async () => {
    writeFileSync(join(root, 'package.json'), '{}', 'utf-8');
    writeFileSync(join(root, 'CHANGELOG.md'), 'x', 'utf-8');

    const got = await collectPreservedRootFiles(root);

    expect(got).toEqual([]);
  });

  it('returns empty array when contentRoot does not exist', async () => {
    const missing = join(root, 'does-not-exist');

    const got = await collectPreservedRootFiles(missing);

    expect(got).toEqual([]);
  });

  it('returns sorted results for deterministic pack content_hash', async () => {
    writeFileSync(join(root, 'README.md'), 'r', 'utf-8');
    writeFileSync(join(root, 'LICENSE'), 'l', 'utf-8');
    writeFileSync(join(root, 'NOTICE'), 'n', 'utf-8');

    const got = await collectPreservedRootFiles(root);

    const names = got.map((f) => f.relativePath);
    expect(names).toEqual([...names].sort());
  });
});

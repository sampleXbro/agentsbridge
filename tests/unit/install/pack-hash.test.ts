import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hashPackContent } from '../../../src/install/pack-hash.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `pack-hash-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('hashPackContent', () => {
  it('returns a sha256: prefixed hash', async () => {
    mkdirSync(join(tmpDir, 'rules'), { recursive: true });
    writeFileSync(join(tmpDir, 'rules', '_root.md'), '# Root rule\n', 'utf-8');

    const hash = await hashPackContent(tmpDir);
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('excludes pack.yaml from the hash', async () => {
    mkdirSync(join(tmpDir, 'rules'));
    writeFileSync(join(tmpDir, 'rules', 'typescript.md'), '# TS', 'utf-8');

    writeFileSync(join(tmpDir, 'pack.yaml'), 'name: test\n', 'utf-8');
    const hashWithMeta = await hashPackContent(tmpDir);

    // changing pack.yaml should not affect hash
    writeFileSync(join(tmpDir, 'pack.yaml'), 'name: changed\n', 'utf-8');
    const hashAfterChange = await hashPackContent(tmpDir);

    expect(hashWithMeta).toBe(hashAfterChange);
  });

  it('produces a different hash when content changes', async () => {
    mkdirSync(join(tmpDir, 'rules'));
    writeFileSync(join(tmpDir, 'rules', '_root.md'), 'content-a', 'utf-8');
    const hashA = await hashPackContent(tmpDir);

    writeFileSync(join(tmpDir, 'rules', '_root.md'), 'content-b', 'utf-8');
    const hashB = await hashPackContent(tmpDir);

    expect(hashA).not.toBe(hashB);
  });

  it('produces a stable hash for same content', async () => {
    mkdirSync(join(tmpDir, 'skills', 'tdd'), { recursive: true });
    writeFileSync(join(tmpDir, 'skills', 'tdd', 'SKILL.md'), '# TDD skill\n', 'utf-8');

    const hash1 = await hashPackContent(tmpDir);
    const hash2 = await hashPackContent(tmpDir);
    expect(hash1).toBe(hash2);
  });

  it('returns a valid hash for empty pack directory', async () => {
    const hash = await hashPackContent(tmpDir);
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('includes nested files in the hash', async () => {
    const packA = join(tmpDir, 'pack-a');
    mkdirSync(join(packA, 'skills', 'my-skill'), { recursive: true });
    writeFileSync(join(packA, 'skills', 'my-skill', 'SKILL.md'), '# skill', 'utf-8');
    const hashWith = await hashPackContent(packA);

    const emptyPack = join(tmpDir, 'pack-empty');
    mkdirSync(emptyPack);
    const emptyHash = await hashPackContent(emptyPack);
    expect(hashWith).not.toBe(emptyHash);
  });
});

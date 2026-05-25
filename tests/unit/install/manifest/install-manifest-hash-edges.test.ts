import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hashPackFiles } from '../../../../src/install/manifest/install-manifest-hash.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `install-manifest-hash-edges-${Date.now()}-${Math.random()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('hashPackFiles — edge branches', () => {
  it('skips entries whose hashFile returns null (broken symlink ENOENT path)', async () => {
    // Broken symlink → readDirRecursive surfaces the path; hashFile readFile
    // throws ENOENT and returns null, exercising the `if (hex === null) continue`
    // branch in install-manifest-hash.ts.
    writeFileSync(join(tmpDir, 'kept.md'), 'kept');
    try {
      symlinkSync(join(tmpDir, 'does-not-exist'), join(tmpDir, 'dangling.md'));
    } catch {
      // Skip on platforms where symlinks aren't permitted (e.g. some Windows
      // CI lanes). The branch is still hit by the normal-platform run.
      return;
    }

    const result = await hashPackFiles(tmpDir);

    expect(Object.keys(result)).toEqual(['kept.md']);
    expect(result['kept.md']).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

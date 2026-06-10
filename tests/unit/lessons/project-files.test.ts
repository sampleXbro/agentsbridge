import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listProjectFiles } from '../../../src/lessons/project-files.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-projfiles-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('listProjectFiles', () => {
  it('lists tracked + untracked-unignored files in a git repo, forward-slash relative', () => {
    spawnSync('git', ['init', '-q'], { cwd: root });
    mkdirSync(join(root, 'src', 'nested'), { recursive: true });
    writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 1;\n');
    writeFileSync(join(root, 'src', 'nested', 'b.ts'), 'export const b = 2;\n');
    writeFileSync(join(root, '.gitignore'), 'ignored.txt\n');
    writeFileSync(join(root, 'ignored.txt'), 'nope\n');
    spawnSync('git', ['add', 'src/a.ts'], { cwd: root });

    const files = listProjectFiles(root);
    expect(files).not.toBeNull();
    // tracked (a.ts) + untracked-unignored (b.ts, .gitignore) all present.
    expect(files!.has('src/a.ts')).toBe(true);
    expect(files!.has('src/nested/b.ts')).toBe(true);
    // .gitignore-excluded file must NOT appear.
    expect(files!.has('ignored.txt')).toBe(false);
  });

  it('falls back to a directory walk when the path is not a git repo', () => {
    mkdirSync(join(root, 'pkg'), { recursive: true });
    writeFileSync(join(root, 'pkg', 'x.ts'), 'x\n');
    // node_modules is skipped by the fallback walk.
    mkdirSync(join(root, 'node_modules', 'dep'), { recursive: true });
    writeFileSync(join(root, 'node_modules', 'dep', 'index.js'), 'y\n');

    const files = listProjectFiles(root);
    expect(files).not.toBeNull();
    expect(files!.has('pkg/x.ts')).toBe(true);
    expect([...files!].some((p) => p.includes('node_modules'))).toBe(false);
  });
});

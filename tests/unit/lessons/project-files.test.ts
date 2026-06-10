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
  it('lists every on-disk file, project-relative with forward slashes', () => {
    mkdirSync(join(root, 'src', 'nested'), { recursive: true });
    writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 1;\n');
    writeFileSync(join(root, 'src', 'nested', 'b.ts'), 'export const b = 2;\n');

    const files = listProjectFiles(root);
    expect(files).not.toBeNull();
    expect(files!.has('src/a.ts')).toBe(true);
    expect(files!.has('src/nested/b.ts')).toBe(true);
  });

  it('includes present-but-gitignored files (liveness is on-disk existence, not git tracking)', () => {
    // A glob over a present build artifact must read as LIVE, not dead — so the
    // file list must include it even though it is gitignored.
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, '.gitignore'), 'dist/\n');
    writeFileSync(join(root, 'dist', 'cli.js'), '// built\n');

    const files = listProjectFiles(root)!;
    expect(files.has('dist/cli.js')).toBe(true);
  });

  it('skips .git and node_modules', () => {
    writeFileSync(join(root, 'index.ts'), 'x\n');
    mkdirSync(join(root, 'node_modules', 'dep'), { recursive: true });
    writeFileSync(join(root, 'node_modules', 'dep', 'index.js'), 'y\n');
    mkdirSync(join(root, '.git'), { recursive: true });
    writeFileSync(join(root, '.git', 'HEAD'), 'ref\n');

    const files = listProjectFiles(root)!;
    expect(files.has('index.ts')).toBe(true);
    expect([...files].some((p) => p.includes('node_modules'))).toBe(false);
    expect([...files].some((p) => p.startsWith('.git/'))).toBe(false);
  });
});

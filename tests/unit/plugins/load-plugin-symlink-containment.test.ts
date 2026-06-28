/**
 * Security: the plugin containment check must resolve symlinks and `..`
 * traversal before deciding a source is inside projectRoot. A symlink planted
 * inside the project, or a package.json `main` that climbs out with `../`, must
 * not smuggle the import target past the trust boundary — including when the
 * final entry file does not exist yet (an intermediate symlink still escapes).
 *
 * projectRoot is realpath'd in each test so the assertion is platform-stable
 * (macOS resolves the tmp dir through /private), matching real cwd usage.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, realpathSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir, platform } from 'node:os';
import { loadPlugin } from '../../../src/plugins/load-plugin.js';
import { resetRegistry } from '../../../src/targets/catalog/registry.js';

const ESCAPE = /outside.*project root|escapes/i;
const isWin = platform() === 'win32';

beforeEach(() => resetRegistry());

describe('loadPlugin — symlink & traversal containment', () => {
  it('rejects a bare npm specifier whose package.json main traverses outside projectRoot', async () => {
    const projectRoot = realpathSync(mkdtempSync(join(tmpdir(), 'am-plugin-proj-')));
    const outsideDir = realpathSync(mkdtempSync(join(tmpdir(), 'am-plugin-outside-')));
    const evil = join(outsideDir, 'evil.js');
    writeFileSync(evil, 'export const descriptor = {};');
    const pkgDir = join(projectRoot, 'node_modules', 'evilpkg');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'evilpkg', main: relative(pkgDir, evil) }),
    );
    try {
      await expect(loadPlugin({ id: 'evilpkg', source: 'evilpkg' }, projectRoot)).rejects.toThrow(
        ESCAPE,
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it.skipIf(isWin)(
    'rejects a local source whose entry file symlinks outside projectRoot',
    async () => {
      const projectRoot = realpathSync(mkdtempSync(join(tmpdir(), 'am-plugin-proj-')));
      const outsideDir = realpathSync(mkdtempSync(join(tmpdir(), 'am-plugin-outside-')));
      const evil = join(outsideDir, 'evil.js');
      writeFileSync(evil, 'export const descriptor = {};');
      symlinkSync(evil, join(projectRoot, 'plugin.js'));
      try {
        await expect(loadPlugin({ id: 'pwn', source: './plugin.js' }, projectRoot)).rejects.toThrow(
          ESCAPE,
        );
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
        rmSync(outsideDir, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(isWin)(
    'rejects a local source through a symlinked directory that resolves outside, even when the entry file is absent',
    async () => {
      const projectRoot = realpathSync(mkdtempSync(join(tmpdir(), 'am-plugin-proj-')));
      const outsideDir = realpathSync(mkdtempSync(join(tmpdir(), 'am-plugin-outside-')));
      // projectRoot/linked -> outsideDir (exists), but no index.js inside it.
      symlinkSync(outsideDir, join(projectRoot, 'linked'));
      try {
        await expect(
          loadPlugin({ id: 'pwn', source: './linked/index.js' }, projectRoot),
        ).rejects.toThrow(ESCAPE);
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
        rmSync(outsideDir, { recursive: true, force: true });
      }
    },
  );
});

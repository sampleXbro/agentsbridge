import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, symlink } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';
import { assertContainedPath } from '../../../../src/mcp/writers/path-containment.js';

const isWin = platform() === 'win32';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'containment-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('assertContainedPath', () => {
  it('allows a not-yet-created nested path under the root (ENOENT reconstructs)', async () => {
    await expect(
      assertContainedPath({ root, target: join(root, 'sub/dir/file.md'), message: 'escapes' }),
    ).resolves.toBeUndefined();
  });

  it('allows an existing file inside the root', async () => {
    await mkdir(join(root, 'sub'), { recursive: true });
    await writeFile(join(root, 'sub/file.md'), 'x', 'utf8');
    await expect(
      assertContainedPath({ root, target: join(root, 'sub/file.md'), message: 'escapes' }),
    ).resolves.toBeUndefined();
  });

  it.skipIf(isWin)('rejects a target reached through a symlink that escapes the root', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'containment-out-'));
    try {
      await writeFile(join(outside, 'secret'), 'x', 'utf8');
      await symlink(join(outside, 'secret'), join(root, 'link'));
      await expect(
        assertContainedPath({ root, target: join(root, 'link'), message: 'escapes' }),
      ).rejects.toMatchObject({ code: 'PATH_TRAVERSAL' });
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it.skipIf(isWin)(
    'fails closed when a path component cannot be resolved (symlink loop)',
    async () => {
      // Self-referential symlink → realpath throws ELOOP (not ENOENT); the check
      // must deny rather than optimistically reconstruct the unresolved component.
      await symlink('loop', join(root, 'loop')); // loop -> loop
      await expect(
        assertContainedPath({ root, target: join(root, 'loop/file.md'), message: 'escapes' }),
      ).rejects.toMatchObject({ code: 'PATH_TRAVERSAL' });
    },
  );
});

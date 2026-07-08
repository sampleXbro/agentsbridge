import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, symlink } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';
import { safeConfigWrite } from '../../../../src/mcp/writers/safe-config-write.js';

const isWin = platform() === 'win32';

let root: string;
let outsideDir: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'cfgwrite-'));
  outsideDir = await mkdtemp(join(tmpdir(), 'cfgwrite-out-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(outsideDir, { recursive: true, force: true });
});

describe('safeConfigWrite', () => {
  it('writes to <root>/agentsmesh.yaml only', async () => {
    await safeConfigWrite({ projectRoot: root, content: 'version: 1\n' });
    expect(await readFile(join(root, 'agentsmesh.yaml'), 'utf8')).toBe('version: 1\n');
  });
  it('refuses agentsmesh.local.yaml', async () => {
    await expect(
      safeConfigWrite({
        projectRoot: root,
        content: 'x',
        filename: 'agentsmesh.local.yaml' as never,
      }),
    ).rejects.toMatchObject({ code: 'PATH_TRAVERSAL' });
  });
  it.skipIf(isWin)(
    'rejects a write through a symlinked agentsmesh.yaml (no out-of-tree escape)',
    async () => {
      await writeFile(join(outsideDir, 'victim.yaml'), 'original: true\n', 'utf8');
      await symlink(join(outsideDir, 'victim.yaml'), join(root, 'agentsmesh.yaml'));
      await expect(
        safeConfigWrite({ projectRoot: root, content: 'version: 2\n' }),
      ).rejects.toMatchObject({ code: 'PATH_TRAVERSAL' });
      expect(await readFile(join(outsideDir, 'victim.yaml'), 'utf8')).toBe('original: true\n');
    },
  );
});

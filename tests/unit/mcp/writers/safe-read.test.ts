import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, symlink } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';
import { safeRead } from '../../../../src/mcp/writers/safe-read.js';

const isWin = platform() === 'win32';

let projectRoot: string;
let outsideDir: string;
beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'saferead-'));
  outsideDir = await mkdtemp(join(tmpdir(), 'saferead-out-'));
  await mkdir(join(projectRoot, '.agentsmesh/skills/example'), { recursive: true });
  await writeFile(join(projectRoot, '.agentsmesh/skills/example/helper.md'), 'help', 'utf8');
});
afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
  await rm(outsideDir, { recursive: true, force: true });
});

describe('safeRead', () => {
  it('reads under skill dir', async () => {
    expect(await safeRead({ projectRoot, skillName: 'example', filePath: 'helper.md' })).toBe(
      'help',
    );
  });
  it('blocks traversal', async () => {
    await expect(
      safeRead({ projectRoot, skillName: 'example', filePath: '../../../etc/passwd' }),
    ).rejects.toMatchObject({ code: 'PATH_TRAVERSAL' });
  });
  it.skipIf(isWin)('blocks symlinked files that escape the skill dir', async () => {
    await writeFile(join(outsideDir, 'secret.md'), 'secret', 'utf8');
    await symlink(
      join(outsideDir, 'secret.md'),
      join(projectRoot, '.agentsmesh/skills/example/secret.md'),
    );
    await expect(
      safeRead({ projectRoot, skillName: 'example', filePath: 'secret.md' }),
    ).rejects.toMatchObject({ code: 'PATH_TRAVERSAL' });
  });
  it('throws NOT_FOUND for missing files', async () => {
    await expect(
      safeRead({ projectRoot, skillName: 'example', filePath: 'missing.md' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('throws IO_ERROR on a non-ENOENT read failure (target is a directory)', async () => {
    await mkdir(join(projectRoot, '.agentsmesh/skills/example/adir'), { recursive: true });
    await expect(
      safeRead({ projectRoot, skillName: 'example', filePath: 'adir' }),
    ).rejects.toMatchObject({ code: 'IO_ERROR' });
  });
});

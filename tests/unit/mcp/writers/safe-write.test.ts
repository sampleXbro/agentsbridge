import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeWrite } from '../../../../src/mcp/writers/safe-write.js';

let projectRoot: string;
let outsideDir: string;
beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'safewrite-'));
  outsideDir = await mkdtemp(join(tmpdir(), 'safewrite-out-'));
  await mkdir(join(projectRoot, '.agentsmesh', 'rules'), { recursive: true });
});
afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
  await rm(outsideDir, { recursive: true, force: true });
});

describe('safeWrite', () => {
  it('writes atomically under .agentsmesh/<feature>/', async () => {
    await safeWrite({ projectRoot, feature: 'rules', relativePath: 'auth.md', content: 'x' });
    expect(await readFile(join(projectRoot, '.agentsmesh/rules/auth.md'), 'utf8')).toBe('x');
  });
  it('blocks ".." traversal', async () => {
    await expect(
      safeWrite({ projectRoot, feature: 'rules', relativePath: '../escape.md', content: 'x' }),
    ).rejects.toMatchObject({ code: 'PATH_TRAVERSAL' });
  });
  it('blocks writes through symlinked directories outside the feature dir', async () => {
    await symlink(outsideDir, join(projectRoot, '.agentsmesh/rules/linked'), 'dir');
    await expect(
      safeWrite({ projectRoot, feature: 'rules', relativePath: 'linked/auth.md', content: 'x' }),
    ).rejects.toMatchObject({ code: 'PATH_TRAVERSAL' });
  });
  it('blocks oversize files', async () => {
    const big = 'x'.repeat(1_048_577);
    await expect(
      safeWrite({ projectRoot, feature: 'rules', relativePath: 'big.md', content: big }),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  });
});

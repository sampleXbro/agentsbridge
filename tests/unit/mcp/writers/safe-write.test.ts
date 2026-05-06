import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeWrite } from '../../../../src/mcp/writers/safe-write.js';

let projectRoot: string;
beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'safewrite-'));
  await mkdir(join(projectRoot, '.agentsmesh', 'rules'), { recursive: true });
});
afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
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
  it('blocks oversize files', async () => {
    const big = 'x'.repeat(1_048_577);
    await expect(
      safeWrite({ projectRoot, feature: 'rules', relativePath: 'big.md', content: big }),
    ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeRead } from '../../../../src/mcp/writers/safe-read.js';

let projectRoot: string;
beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'saferead-'));
  await mkdir(join(projectRoot, '.agentsmesh/skills/example'), { recursive: true });
  await writeFile(join(projectRoot, '.agentsmesh/skills/example/helper.md'), 'help', 'utf8');
});
afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
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
  it('throws NOT_FOUND for missing files', async () => {
    await expect(
      safeRead({ projectRoot, skillName: 'example', filePath: 'missing.md' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

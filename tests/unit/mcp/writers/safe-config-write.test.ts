import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeConfigWrite } from '../../../../src/mcp/writers/safe-config-write.js';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'cfgwrite-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
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
});

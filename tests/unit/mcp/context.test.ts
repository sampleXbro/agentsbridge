import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveContext } from '../../../src/mcp/context.js';

let projectRoot: string;
beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'mcpctx-'));
  await writeFile(
    join(projectRoot, 'agentsmesh.yaml'),
    'version: 1\ntargets: []\nfeatures: []\n',
    'utf8',
  );
});
afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe('resolveContext', () => {
  it('finds projectRoot from cwd', async () => {
    const ctx = await resolveContext({ cwd: projectRoot });
    expect(ctx.projectRoot).toBe(projectRoot);
  });
  it('walks upward from a subdir', async () => {
    const sub = join(projectRoot, 'a/b/c');
    await mkdir(sub, { recursive: true });
    expect((await resolveContext({ cwd: sub })).projectRoot).toBe(projectRoot);
  });
  it('throws NO_PROJECT if no agentsmesh.yaml', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'noproject-'));
    await expect(resolveContext({ cwd: empty })).rejects.toMatchObject({ code: 'NO_PROJECT' });
    await rm(empty, { recursive: true, force: true });
  });
});

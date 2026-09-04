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

describe('McpContext.loadCanonical', () => {
  it('loads the canonical files under <projectRoot>/.agentsmesh', async () => {
    await mkdir(join(projectRoot, '.agentsmesh/rules'), { recursive: true });
    await writeFile(
      join(projectRoot, '.agentsmesh/rules/_root.md'),
      '---\nroot: true\ndescription: Root rule\n---\n\nAlways apply this.\n',
      'utf8',
    );
    const ctx = await resolveContext({ cwd: projectRoot });
    const canonical = await ctx.loadCanonical();
    expect(canonical.rules).toHaveLength(1);
    const root = canonical.rules[0];
    expect(root?.root).toBe(true);
    expect(root?.description).toBe('Root rule');
    expect(root?.body.trim()).toBe('Always apply this.');
    expect(root?.source).toBe(join(projectRoot, '.agentsmesh/rules/_root.md'));
    expect(canonical.commands).toEqual([]);
    expect(canonical.agents).toEqual([]);
    expect(canonical.skills).toEqual([]);
    expect(canonical.mcp).toBeNull();
    expect(canonical.permissions).toBeNull();
    expect(canonical.hooks).toBeNull();
    expect(canonical.ignore).toEqual([]);
  });

  it('returns empty canonical files when .agentsmesh is absent', async () => {
    const ctx = await resolveContext({ cwd: projectRoot });
    const canonical = await ctx.loadCanonical();
    expect(canonical.rules).toEqual([]);
    expect(canonical.mcp).toBeNull();
  });
});

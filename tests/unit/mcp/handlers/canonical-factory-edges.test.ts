/**
 * Branch-coverage fill for canonical-factory: NOT_FOUND on get/delete,
 * IO_ERROR on non-ENOENT read failures, VALIDATION_FAILED in update,
 * merge ternary branches in update.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rulesHandlers } from '../../../../src/mcp/handlers/rules.js';
import { agentsHandlers } from '../../../../src/mcp/handlers/agents.js';
import { resolveContext } from '../../../../src/mcp/context.js';
import type { McpContext } from '../../../../src/mcp/context.js';

let projectRoot: string;
let ctx: McpContext;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'cf-edges-'));
  await mkdir(join(projectRoot, '.agentsmesh/rules'), { recursive: true });
  await mkdir(join(projectRoot, '.agentsmesh/agents'), { recursive: true });
  await writeFile(
    join(projectRoot, 'agentsmesh.yaml'),
    'version: 1\ntargets: []\nfeatures: []\n',
    'utf8',
  );
  await writeFile(
    join(projectRoot, '.agentsmesh/rules/_root.md'),
    '---\nroot: true\ndescription: root\n---\n\nbody\n',
    'utf8',
  );
  ctx = await resolveContext({ cwd: projectRoot });
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe('canonical-factory edge branches', () => {
  it('get throws NOT_FOUND when target file is missing', async () => {
    await expect(rulesHandlers.get(ctx, { name: 'missing-rule' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('get throws IO_ERROR when target path is a directory (non-ENOENT)', async () => {
    // Force readFile to fail with EISDIR by making the rule path point at a directory.
    await mkdir(join(projectRoot, '.agentsmesh/rules/dir-rule.md'), { recursive: true });
    await expect(rulesHandlers.get(ctx, { name: 'dir-rule' })).rejects.toMatchObject({
      code: 'IO_ERROR',
      details: { errno: 'EISDIR' },
    });
  });

  it('update throws IO_ERROR when target path is a directory', async () => {
    await mkdir(join(projectRoot, '.agentsmesh/rules/dir-update.md'), { recursive: true });
    await expect(
      rulesHandlers.update(ctx, { name: 'dir-update', frontmatter: { root: true } }),
    ).rejects.toMatchObject({
      code: 'IO_ERROR',
      details: { errno: 'EISDIR' },
    });
  });

  it('update with merge=true keeps untouched fields and overwrites the merged ones', async () => {
    await rulesHandlers.create(ctx, {
      name: 'merge-rule',
      frontmatter: { description: 'orig', globs: ['**/*.ts'] },
      body: 'orig body\n',
    });
    await rulesHandlers.update(ctx, {
      name: 'merge-rule',
      frontmatter: { description: 'updated' },
      merge: true,
    });
    const r = await rulesHandlers.get(ctx, { name: 'merge-rule' });
    expect(r.frontmatter.description).toBe('updated');
    expect(r.frontmatter.globs).toEqual(['**/*.ts']); // preserved
  });

  it('update with frontmatter undefined preserves existing frontmatter', async () => {
    await rulesHandlers.create(ctx, {
      name: 'preserve-fm',
      frontmatter: { description: 'keep' },
      body: 'old\n',
    });
    await rulesHandlers.update(ctx, { name: 'preserve-fm', body: 'new\n' });
    const r = await rulesHandlers.get(ctx, { name: 'preserve-fm' });
    expect(r.frontmatter.description).toBe('keep');
    expect(r.body).toBe('new\n');
  });

  it('delete throws NOT_FOUND when file is missing', async () => {
    await expect(rulesHandlers.delete(ctx, { name: 'never-existed' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('list returns [] when feature directory is missing entirely', async () => {
    // Agents dir exists in setup but is empty; remove it to exercise the catch path.
    await rm(join(projectRoot, '.agentsmesh/agents'), { recursive: true, force: true });
    const out = await agentsHandlers.list(ctx);
    expect(out).toEqual([]);
  });
});

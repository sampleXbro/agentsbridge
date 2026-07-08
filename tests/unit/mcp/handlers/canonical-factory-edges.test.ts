/**
 * Branch-coverage fill for canonical-factory: NOT_FOUND on get/delete,
 * IO_ERROR on non-ENOENT read failures, VALIDATION_FAILED in update,
 * merge ternary branches in update.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, symlink, stat } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';
import { rulesHandlers } from '../../../../src/mcp/handlers/rules.js';
import { agentsHandlers } from '../../../../src/mcp/handlers/agents.js';
import { resolveContext } from '../../../../src/mcp/context.js';
import type { McpContext } from '../../../../src/mcp/context.js';

const isWin = platform() === 'win32';

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

  it.skipIf(isWin)('get rejects markdown files symlinked outside the feature dir', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'cf-edges-out-'));
    try {
      await writeFile(join(outside, 'secret.md'), '---\n---\n\nsecret\n', 'utf8');
      await symlink(join(outside, 'secret.md'), join(projectRoot, '.agentsmesh/rules/linked.md'));
      await expect(rulesHandlers.get(ctx, { name: 'linked' })).rejects.toMatchObject({
        code: 'PATH_TRAVERSAL',
      });
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
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

  it('delete requires force for the protected _root rule', async () => {
    await expect(rulesHandlers.delete(ctx, { name: '_root' })).rejects.toMatchObject({
      code: 'PROTECTED_FILE',
    });
  });

  it.skipIf(isWin)(
    'delete rejects removals through a symlinked feature dir (no escape)',
    async () => {
      const outside = await mkdtemp(join(tmpdir(), 'cf-edges-out-'));
      try {
        await writeFile(join(outside, 'victim.md'), '---\n---\n\nvictim\n', 'utf8');
        // Replace the real rules dir with a symlink pointing outside the project.
        await rm(join(projectRoot, '.agentsmesh/rules'), { recursive: true, force: true });
        await symlink(outside, join(projectRoot, '.agentsmesh/rules'), 'dir');
        await expect(rulesHandlers.delete(ctx, { name: 'victim' })).rejects.toMatchObject({
          code: 'PATH_TRAVERSAL',
        });
        // The outside file must survive the rejected delete.
        await expect(stat(join(outside, 'victim.md'))).resolves.toBeDefined();
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(isWin)(
    'create rejects through a symlinked feature dir even when the target exists',
    async () => {
      const outside = await mkdtemp(join(tmpdir(), 'cf-edges-out-'));
      try {
        await writeFile(join(outside, 'victim.md'), '---\ndescription: x\n---\n\nx\n', 'utf8');
        await rm(join(projectRoot, '.agentsmesh/rules'), { recursive: true, force: true });
        await symlink(outside, join(projectRoot, '.agentsmesh/rules'), 'dir');
        // Must be PATH_TRAVERSAL (not ALREADY_EXISTS) — no out-of-project existence oracle.
        await expect(
          rulesHandlers.create(ctx, {
            name: 'victim',
            frontmatter: { description: 'x' },
            body: 'b\n',
          }),
        ).rejects.toMatchObject({ code: 'PATH_TRAVERSAL' });
      } finally {
        await rm(outside, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(isWin)('list rejects reads through a symlinked feature dir (no leak)', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'cf-edges-out-'));
    try {
      await writeFile(
        join(outside, 'leaked.md'),
        '---\ndescription: SECRET\n---\n\nbody\n',
        'utf8',
      );
      await rm(join(projectRoot, '.agentsmesh/rules'), { recursive: true, force: true });
      await symlink(outside, join(projectRoot, '.agentsmesh/rules'), 'dir');
      await expect(rulesHandlers.list(ctx)).rejects.toMatchObject({ code: 'PATH_TRAVERSAL' });
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('create throws ALREADY_EXISTS when the file already exists', async () => {
    await rulesHandlers.create(ctx, {
      name: 'dup-rule',
      frontmatter: { description: 'x' },
      body: 'b\n',
    });
    await expect(
      rulesHandlers.create(ctx, {
        name: 'dup-rule',
        frontmatter: { description: 'y' },
        body: 'c\n',
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_EXISTS' });
  });

  it('list returns [] when feature directory is missing entirely', async () => {
    // Agents dir exists in setup but is empty; remove it to exercise the catch path.
    await rm(join(projectRoot, '.agentsmesh/agents'), { recursive: true, force: true });
    const out = await agentsHandlers.list(ctx);
    expect(out).toEqual([]);
  });
});

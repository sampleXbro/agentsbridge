import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rulesHandlers } from '../../../../src/mcp/handlers/rules.js';
import { resolveContext } from '../../../../src/mcp/context.js';
import type { McpContext } from '../../../../src/mcp/context.js';

let projectRoot: string;
let ctx: McpContext;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'rules-'));
  await mkdir(join(projectRoot, '.agentsmesh/rules'), { recursive: true });
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

describe('rulesHandlers', () => {
  it('lists rule summaries', async () => {
    const list = await rulesHandlers.list(ctx);
    expect(list).toEqual([
      { name: '_root', description: 'root', root: true, globs: null, targets: null },
    ]);
  });
  it('gets a rule', async () => {
    const r = await rulesHandlers.get(ctx, { name: '_root' });
    expect(r.body).toBe('body\n');
    expect(r.frontmatter).toMatchObject({ root: true, description: 'root' });
  });
  it('creates a rule', async () => {
    await rulesHandlers.create(ctx, {
      name: 'auth',
      frontmatter: { description: 'auth rule' },
      body: 'rules\n',
    });
    const written = await readFile(join(projectRoot, '.agentsmesh/rules/auth.md'), 'utf8');
    expect(written).toContain('description: auth rule');
    expect(written).toContain('rules\n');
  });
  it('rejects ALREADY_EXISTS', async () => {
    await expect(
      rulesHandlers.create(ctx, {
        name: '_root',
        frontmatter: { description: 'x' },
        body: 'y',
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_EXISTS' });
  });
  it('updates with replace', async () => {
    await rulesHandlers.update(ctx, {
      name: '_root',
      frontmatter: { root: true, description: 'new' },
    });
    const r = await rulesHandlers.get(ctx, { name: '_root' });
    expect(r.frontmatter.description).toBe('new');
  });
  it('updates with merge', async () => {
    await rulesHandlers.update(ctx, {
      name: '_root',
      frontmatter: { description: 'merged' },
      merge: true,
    });
    const r = await rulesHandlers.get(ctx, { name: '_root' });
    expect(r.frontmatter.root).toBe(true);
    expect(r.frontmatter.description).toBe('merged');
  });
  it('preserves body when only frontmatter is updated', async () => {
    await rulesHandlers.update(ctx, {
      name: '_root',
      frontmatter: { root: true, description: 'x' },
    });
    const r = await rulesHandlers.get(ctx, { name: '_root' });
    expect(r.body).toBe('body\n');
  });
  it('rejects update NOT_FOUND', async () => {
    await expect(
      rulesHandlers.update(ctx, { name: 'missing', frontmatter: {} }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('protects _root.md from delete', async () => {
    await expect(rulesHandlers.delete(ctx, { name: '_root' })).rejects.toMatchObject({
      code: 'PROTECTED_FILE',
    });
    const result = await rulesHandlers.delete(ctx, { name: '_root', force: true });
    expect(result.deleted).toBe(true);
  });
  it('rejects INVALID_NAME', async () => {
    await expect(
      rulesHandlers.create(ctx, {
        name: '../escape',
        frontmatter: {},
        body: '',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_NAME' });
  });
  it('honors dry_run on create', async () => {
    const r = await rulesHandlers.create(ctx, {
      name: 'auth',
      frontmatter: { description: 'x' },
      body: 'y',
      dry_run: true,
    });
    expect(r.written).toBe(false);
  });
  it('honors dry_run on update', async () => {
    const r = await rulesHandlers.update(ctx, {
      name: '_root',
      frontmatter: { description: 'no' },
      dry_run: true,
    });
    expect(r.written).toBe(false);
  });
  it('honors dry_run on delete', async () => {
    const r = await rulesHandlers.delete(ctx, { name: '_root', force: true, dry_run: true });
    expect(r.deleted).toBe(false);
  });
});

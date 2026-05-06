import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agentsHandlers } from '../../../../src/mcp/handlers/agents.js';
import { resolveContext } from '../../../../src/mcp/context.js';
import type { McpContext } from '../../../../src/mcp/context.js';

let projectRoot: string;
let ctx: McpContext;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'agents-'));
  await mkdir(join(projectRoot, '.agentsmesh/agents'), { recursive: true });
  await writeFile(
    join(projectRoot, 'agentsmesh.yaml'),
    'version: 1\ntargets: []\nfeatures: []\n',
    'utf8',
  );
  await writeFile(
    join(projectRoot, '.agentsmesh/agents/code-review.md'),
    '---\nname: code-review\ndescription: reviews\ntools:\n  - Read\n  - Grep\nmodel: sonnet\n---\n\nbody\n',
    'utf8',
  );
  ctx = await resolveContext({ cwd: projectRoot });
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe('agentsHandlers', () => {
  it('lists agent summaries', async () => {
    const list = await agentsHandlers.list(ctx);
    expect(list).toEqual([
      { name: 'code-review', description: 'reviews', tools: ['Read', 'Grep'], model: 'sonnet' },
    ]);
  });

  it('gets an agent', async () => {
    const r = await agentsHandlers.get(ctx, { name: 'code-review' });
    expect(r.body).toBe('body\n');
    expect(r.frontmatter).toMatchObject({
      name: 'code-review',
      description: 'reviews',
      tools: ['Read', 'Grep'],
      model: 'sonnet',
    });
  });

  it('creates an agent', async () => {
    await agentsHandlers.create(ctx, {
      name: 'refactor',
      frontmatter: { description: 'refactor agent', tools: ['Edit'], model: 'haiku' },
      body: 'refactor body\n',
    });
    const written = await readFile(join(projectRoot, '.agentsmesh/agents/refactor.md'), 'utf8');
    expect(written).toContain('description: refactor agent');
    expect(written).toContain('refactor body\n');
  });

  it('rejects ALREADY_EXISTS', async () => {
    await expect(
      agentsHandlers.create(ctx, {
        name: 'code-review',
        frontmatter: { description: 'duplicate' },
        body: 'body',
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_EXISTS' });
  });

  it('updates with replace', async () => {
    await agentsHandlers.update(ctx, {
      name: 'code-review',
      frontmatter: { description: 'updated', model: 'opus' },
    });
    const r = await agentsHandlers.get(ctx, { name: 'code-review' });
    expect(r.frontmatter.description).toBe('updated');
    expect(r.frontmatter.model).toBe('opus');
  });

  it('updates with merge', async () => {
    await agentsHandlers.update(ctx, {
      name: 'code-review',
      frontmatter: { description: 'merged' },
      merge: true,
    });
    const r = await agentsHandlers.get(ctx, { name: 'code-review' });
    expect(r.frontmatter.model).toBe('sonnet');
    expect(r.frontmatter.description).toBe('merged');
  });

  it('preserves body when only frontmatter is updated', async () => {
    await agentsHandlers.update(ctx, {
      name: 'code-review',
      frontmatter: { description: 'new desc' },
    });
    const r = await agentsHandlers.get(ctx, { name: 'code-review' });
    expect(r.body).toBe('body\n');
  });

  it('rejects update NOT_FOUND', async () => {
    await expect(
      agentsHandlers.update(ctx, { name: 'missing', frontmatter: {} }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('deletes an agent', async () => {
    const result = await agentsHandlers.delete(ctx, { name: 'code-review' });
    expect(result.deleted).toBe(true);
  });

  it('rejects INVALID_NAME', async () => {
    await expect(
      agentsHandlers.create(ctx, {
        name: '../escape',
        frontmatter: {},
        body: '',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_NAME' });
  });

  it('honors dry_run on create', async () => {
    const r = await agentsHandlers.create(ctx, {
      name: 'refactor',
      frontmatter: { description: 'x' },
      body: 'y',
      dry_run: true,
    });
    expect(r.written).toBe(false);
  });

  it('honors dry_run on update', async () => {
    const r = await agentsHandlers.update(ctx, {
      name: 'code-review',
      frontmatter: { description: 'no' },
      dry_run: true,
    });
    expect(r.written).toBe(false);
  });

  it('honors dry_run on delete', async () => {
    const r = await agentsHandlers.delete(ctx, { name: 'code-review', dry_run: true });
    expect(r.deleted).toBe(false);
  });
});

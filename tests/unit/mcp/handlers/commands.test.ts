import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commandsHandlers } from '../../../../src/mcp/handlers/commands.js';
import { resolveContext } from '../../../../src/mcp/context.js';
import type { McpContext } from '../../../../src/mcp/context.js';

let projectRoot: string;
let ctx: McpContext;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'commands-'));
  await mkdir(join(projectRoot, '.agentsmesh/commands'), { recursive: true });
  await writeFile(
    join(projectRoot, 'agentsmesh.yaml'),
    'version: 1\ntargets: []\nfeatures: []\n',
    'utf8',
  );
  await writeFile(
    join(projectRoot, '.agentsmesh/commands/example.md'),
    '---\ndescription: cmd\nallowed-tools:\n  - Read\n  - Grep\n---\n\nbody\n',
    'utf8',
  );
  ctx = await resolveContext({ cwd: projectRoot });
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe('commandsHandlers', () => {
  it('lists command summaries', async () => {
    const list = await commandsHandlers.list(ctx);
    expect(list).toEqual([{ name: 'example', description: 'cmd', allowedTools: ['Read', 'Grep'] }]);
  });

  it('gets a command', async () => {
    const r = await commandsHandlers.get(ctx, { name: 'example' });
    expect(r.body).toBe('body\n');
    expect(r.frontmatter).toMatchObject({ description: 'cmd', 'allowed-tools': ['Read', 'Grep'] });
  });

  it('creates a command', async () => {
    await commandsHandlers.create(ctx, {
      name: 'deploy',
      frontmatter: { description: 'deploy cmd', 'allowed-tools': ['Bash'] },
      body: 'deploy steps\n',
    });
    const written = await readFile(join(projectRoot, '.agentsmesh/commands/deploy.md'), 'utf8');
    expect(written).toContain('description: deploy cmd');
    expect(written).toContain('deploy steps\n');
  });

  it('rejects ALREADY_EXISTS', async () => {
    await expect(
      commandsHandlers.create(ctx, {
        name: 'example',
        frontmatter: { description: 'duplicate' },
        body: 'body',
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_EXISTS' });
  });

  it('updates with replace', async () => {
    await commandsHandlers.update(ctx, {
      name: 'example',
      frontmatter: { description: 'updated', 'allowed-tools': ['Read'] },
    });
    const r = await commandsHandlers.get(ctx, { name: 'example' });
    expect(r.frontmatter.description).toBe('updated');
  });

  it('updates with merge', async () => {
    await commandsHandlers.update(ctx, {
      name: 'example',
      frontmatter: { description: 'merged' },
      merge: true,
    });
    const r = await commandsHandlers.get(ctx, { name: 'example' });
    expect(r.frontmatter['allowed-tools']).toEqual(['Read', 'Grep']);
    expect(r.frontmatter.description).toBe('merged');
  });

  it('preserves body when only frontmatter is updated', async () => {
    await commandsHandlers.update(ctx, {
      name: 'example',
      frontmatter: { description: 'new desc' },
    });
    const r = await commandsHandlers.get(ctx, { name: 'example' });
    expect(r.body).toBe('body\n');
  });

  it('rejects update NOT_FOUND', async () => {
    await expect(
      commandsHandlers.update(ctx, { name: 'missing', frontmatter: {} }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('deletes a command', async () => {
    const result = await commandsHandlers.delete(ctx, { name: 'example' });
    expect(result.deleted).toBe(true);
  });

  it('rejects INVALID_NAME', async () => {
    await expect(
      commandsHandlers.create(ctx, {
        name: '../escape',
        frontmatter: {},
        body: '',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_NAME' });
  });

  it('honors dry_run on create', async () => {
    const r = await commandsHandlers.create(ctx, {
      name: 'deploy',
      frontmatter: { description: 'x' },
      body: 'y',
      dry_run: true,
    });
    expect(r.written).toBe(false);
  });

  it('honors dry_run on update', async () => {
    const r = await commandsHandlers.update(ctx, {
      name: 'example',
      frontmatter: { description: 'no' },
      dry_run: true,
    });
    expect(r.written).toBe(false);
  });

  it('honors dry_run on delete', async () => {
    const r = await commandsHandlers.delete(ctx, { name: 'example', dry_run: true });
    expect(r.deleted).toBe(false);
  });
});

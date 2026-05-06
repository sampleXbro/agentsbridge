import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { settingsHandlers } from '../../../../src/mcp/handlers/settings.js';
import { resolveContext } from '../../../../src/mcp/context.js';
import type { McpContext } from '../../../../src/mcp/context.js';

let projectRoot: string;
let ctx: McpContext;

const BASELINE_YAML = `version: 1
targets:
  - claude-code
  - cursor
features:
  - rules
  - commands
`;

const BASELINE_MCP_JSON =
  JSON.stringify(
    {
      mcpServers: {
        'my-server': { command: 'node', args: ['server.js'], env: {}, type: 'stdio' },
      },
    },
    null,
    2,
  ) + '\n';

const BASELINE_PERMISSIONS_YAML = `allow:
  - Bash
  - Read
deny:
  - Write
ask: []
`;

const BASELINE_HOOKS_YAML = `PreToolUse:
  - matcher: Bash
    hooks:
      - type: command
        command: echo pre
`;

const BASELINE_IGNORE = `# Comment line
node_modules
dist
.env
`;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'settings-'));
  await mkdir(join(projectRoot, '.agentsmesh'), { recursive: true });
  await writeFile(join(projectRoot, 'agentsmesh.yaml'), BASELINE_YAML, 'utf8');
  await writeFile(join(projectRoot, '.agentsmesh/mcp.json'), BASELINE_MCP_JSON, 'utf8');
  await writeFile(
    join(projectRoot, '.agentsmesh/permissions.yaml'),
    BASELINE_PERMISSIONS_YAML,
    'utf8',
  );
  await writeFile(join(projectRoot, '.agentsmesh/hooks.yaml'), BASELINE_HOOKS_YAML, 'utf8');
  await writeFile(join(projectRoot, '.agentsmesh/ignore'), BASELINE_IGNORE, 'utf8');
  ctx = await resolveContext({ cwd: projectRoot });
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe('settingsHandlers', () => {
  // ─── reads ───

  it('getConfig returns parsed yaml', async () => {
    const cfg = await settingsHandlers.getConfig(ctx);
    expect(cfg).toMatchObject({ version: 1, targets: ['claude-code', 'cursor'] });
  });

  it('getConfig throws NO_PROJECT if agentsmesh.yaml missing', async () => {
    await rm(join(projectRoot, 'agentsmesh.yaml'));
    await expect(settingsHandlers.getConfig(ctx)).rejects.toMatchObject({ code: 'NO_PROJECT' });
  });

  it('listMcpServers returns servers from .agentsmesh/mcp.json', async () => {
    const result = await settingsHandlers.listMcpServers(ctx);
    expect(result.servers).not.toBeNull();
    expect(result.servers?.['my-server']).toMatchObject({ command: 'node', args: ['server.js'] });
  });

  it('listMcpServers returns { servers: null } when mcp.json missing', async () => {
    await rm(join(projectRoot, '.agentsmesh/mcp.json'));
    const result = await settingsHandlers.listMcpServers(ctx);
    expect(result).toEqual({ servers: null });
  });

  it('getPermissions returns yaml content or null when missing', async () => {
    const perms = await settingsHandlers.getPermissions(ctx);
    expect(perms).toMatchObject({ allow: ['Bash', 'Read'], deny: ['Write'] });

    await rm(join(projectRoot, '.agentsmesh/permissions.yaml'));
    const none = await settingsHandlers.getPermissions(ctx);
    expect(none).toBeNull();
  });

  it('getHooks returns yaml content or null when missing', async () => {
    const hooks = await settingsHandlers.getHooks(ctx);
    expect(hooks).toMatchObject({ PreToolUse: expect.any(Array) });

    await rm(join(projectRoot, '.agentsmesh/hooks.yaml'));
    const none = await settingsHandlers.getHooks(ctx);
    expect(none).toBeNull();
  });

  it('getIgnore returns patterns array (skipping comments and blanks)', async () => {
    const result = await settingsHandlers.getIgnore(ctx);
    expect(result.patterns).toEqual(['node_modules', 'dist', '.env']);
  });

  // ─── updateConfig ───

  it('updateConfig replace mode: targets array overwritten', async () => {
    const r = await settingsHandlers.updateConfig(ctx, { targets: ['claude-code'] });
    expect(r.written).toBe(true);
    const written = await readFile(join(projectRoot, 'agentsmesh.yaml'), 'utf8');
    expect(written).toContain('claude-code');
    expect(written).not.toContain('cursor');
  });

  it('updateConfig merge: true unions + dedups targets array', async () => {
    // baseline has ['claude-code', 'cursor']
    const r = await settingsHandlers.updateConfig(ctx, {
      targets: ['cursor', 'gemini-cli'],
      merge: true,
    });
    expect(r.written).toBe(true);
    const written = await readFile(join(projectRoot, 'agentsmesh.yaml'), 'utf8');
    expect(written).toContain('claude-code');
    expect(written).toContain('cursor');
    expect(written).toContain('gemini-cli');
    // cursor should not be duplicated — count occurrences
    const cursorCount = (written.match(/cursor/g) ?? []).length;
    expect(cursorCount).toBe(1);
  });

  it('updateConfig rejects invalid target ID → VALIDATION_FAILED', async () => {
    await expect(
      settingsHandlers.updateConfig(ctx, { targets: ['not-a-real-target-xyz'] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('updateConfig rejects forbidden filename → PATH_TRAVERSAL', async () => {
    await expect(
      settingsHandlers.updateConfig(ctx, {
        // @ts-expect-error intentional bad filename
        filename: 'agentsmesh.local.yaml',
      }),
    ).rejects.toMatchObject({ code: 'PATH_TRAVERSAL' });
  });

  it('updateConfig dry_run returns written: false and does not write to disk', async () => {
    const originalContent = await readFile(join(projectRoot, 'agentsmesh.yaml'), 'utf8');
    const r = await settingsHandlers.updateConfig(ctx, {
      targets: ['claude-code'],
      dry_run: true,
    });
    expect(r.written).toBe(false);
    const afterContent = await readFile(join(projectRoot, 'agentsmesh.yaml'), 'utf8');
    expect(afterContent).toBe(originalContent);
  });

  // ─── MCP servers ───

  it('addMcpServer writes a new entry', async () => {
    const r = await settingsHandlers.addMcpServer(ctx, {
      name: 'new-server',
      server: { command: 'python', args: ['-m', 'server'], env: {}, type: 'stdio' },
    });
    expect(r.written).toBe(true);
    const raw = await readFile(join(projectRoot, '.agentsmesh/mcp.json'), 'utf8');
    const parsed = JSON.parse(raw) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers['new-server']).toMatchObject({ command: 'python' });
    expect(parsed.mcpServers['my-server']).toBeDefined();
  });

  it('addMcpServer throws ALREADY_EXISTS on duplicate name', async () => {
    await expect(
      settingsHandlers.addMcpServer(ctx, {
        name: 'my-server',
        server: { command: 'node', args: [], env: {}, type: 'stdio' },
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_EXISTS' });
  });

  it('updateMcpServer replace mode replaces server entry', async () => {
    const r = await settingsHandlers.updateMcpServer(ctx, {
      name: 'my-server',
      server: { command: 'bun', args: ['run', 'server.ts'], env: {}, type: 'stdio' },
    });
    expect(r.written).toBe(true);
    const raw = await readFile(join(projectRoot, '.agentsmesh/mcp.json'), 'utf8');
    const parsed = JSON.parse(raw) as { mcpServers: Record<string, { command: string }> };
    expect(parsed.mcpServers['my-server'].command).toBe('bun');
  });

  it('updateMcpServer merge: true shallow-merges server entry', async () => {
    // Add an env field to existing server to verify merge keeps old fields
    const existing = JSON.parse(
      await readFile(join(projectRoot, '.agentsmesh/mcp.json'), 'utf8'),
    ) as { mcpServers: Record<string, unknown> };
    (existing.mcpServers['my-server'] as Record<string, unknown>)['env'] = { FOO: 'bar' };
    await writeFile(
      join(projectRoot, '.agentsmesh/mcp.json'),
      JSON.stringify(existing, null, 2) + '\n',
      'utf8',
    );

    await settingsHandlers.updateMcpServer(ctx, {
      name: 'my-server',
      server: { env: { BAZ: 'qux' } } as Record<string, unknown>,
      merge: true,
    });
    const raw = await readFile(join(projectRoot, '.agentsmesh/mcp.json'), 'utf8');
    const parsed = JSON.parse(raw) as {
      mcpServers: Record<string, { command: string; env: Record<string, string> }>;
    };
    // command preserved from original, env replaced by merge input
    expect(parsed.mcpServers['my-server'].command).toBe('node');
    expect(parsed.mcpServers['my-server'].env).toMatchObject({ BAZ: 'qux' });
  });

  it('updateMcpServer throws NOT_FOUND for missing server', async () => {
    await expect(
      settingsHandlers.updateMcpServer(ctx, {
        name: 'no-such-server',
        server: { command: 'x', args: [], env: {}, type: 'stdio' },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('removeMcpServer removes the named entry', async () => {
    const r = await settingsHandlers.removeMcpServer(ctx, { name: 'my-server' });
    expect(r.removed).toBe(true);
    const raw = await readFile(join(projectRoot, '.agentsmesh/mcp.json'), 'utf8');
    const parsed = JSON.parse(raw) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers['my-server']).toBeUndefined();
  });

  it('removeMcpServer throws NOT_FOUND for missing server', async () => {
    await expect(
      settingsHandlers.removeMcpServer(ctx, { name: 'no-such-server' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('removeMcpServer removing agentsmesh self-server succeeds (documented self-disable)', async () => {
    // Add an agentsmesh server entry first
    const raw = JSON.parse(await readFile(join(projectRoot, '.agentsmesh/mcp.json'), 'utf8')) as {
      mcpServers: Record<string, unknown>;
    };
    raw.mcpServers['agentsmesh'] = { command: 'agentsmesh', args: ['mcp'], env: {}, type: 'stdio' };
    await writeFile(
      join(projectRoot, '.agentsmesh/mcp.json'),
      JSON.stringify(raw, null, 2) + '\n',
      'utf8',
    );

    const r = await settingsHandlers.removeMcpServer(ctx, { name: 'agentsmesh' });
    expect(r.removed).toBe(true);
    const after = JSON.parse(await readFile(join(projectRoot, '.agentsmesh/mcp.json'), 'utf8')) as {
      mcpServers: Record<string, unknown>;
    };
    expect(after.mcpServers['agentsmesh']).toBeUndefined();
  });

  // ─── permissions ───

  it('updatePermissions replace overwrites listed fields', async () => {
    const r = await settingsHandlers.updatePermissions(ctx, {
      allow: ['Glob'],
      deny: [],
    });
    expect(r.written).toBe(true);
    const written = await readFile(join(projectRoot, '.agentsmesh/permissions.yaml'), 'utf8');
    expect(written).toContain('Glob');
    expect(written).not.toContain('Bash');
  });

  it('updatePermissions append mode unions + dedups', async () => {
    // baseline allow: ['Bash', 'Read']
    await settingsHandlers.updatePermissions(ctx, {
      allow: ['Bash', 'Edit'],
      mode: 'append',
    });
    const written = await readFile(join(projectRoot, '.agentsmesh/permissions.yaml'), 'utf8');
    expect(written).toContain('Read');
    expect(written).toContain('Edit');
    // Bash should appear once only
    const bashCount = (written.match(/Bash/g) ?? []).length;
    expect(bashCount).toBe(1);
  });

  // ─── hooks ───

  it('updateHooks full-replace round-trip', async () => {
    const newHooks = {
      PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'echo post' }] }],
    };
    const r = await settingsHandlers.updateHooks(ctx, { hooks: newHooks as never });
    expect(r.written).toBe(true);
    const written = await readFile(join(projectRoot, '.agentsmesh/hooks.yaml'), 'utf8');
    expect(written).toContain('PostToolUse');
    expect(written).not.toContain('PreToolUse');
  });

  // ─── ignore ───

  it('updateIgnore replace mode replaces patterns', async () => {
    const r = await settingsHandlers.updateIgnore(ctx, { patterns: ['*.log', 'tmp/'] });
    expect(r.written).toBe(true);
    const written = await readFile(join(projectRoot, '.agentsmesh/ignore'), 'utf8');
    expect(written).toContain('*.log');
    expect(written).toContain('tmp/');
    expect(written).not.toContain('node_modules');
  });

  it('updateIgnore append mode unions + dedups existing patterns', async () => {
    // baseline has node_modules, dist, .env
    await settingsHandlers.updateIgnore(ctx, {
      patterns: ['node_modules', '*.log'],
      mode: 'append',
    });
    const result = await settingsHandlers.getIgnore(ctx);
    expect(result.patterns).toContain('node_modules');
    expect(result.patterns).toContain('dist');
    expect(result.patterns).toContain('*.log');
    // node_modules should not be duplicated
    const count = (result.patterns ?? []).filter((p) => p === 'node_modules').length;
    expect(count).toBe(1);
  });

  // ─── dry_run for remaining mutations ───

  it('addMcpServer dry_run returns written: false without writing', async () => {
    const originalContent = await readFile(join(projectRoot, '.agentsmesh/mcp.json'), 'utf8');
    const r = await settingsHandlers.addMcpServer(ctx, {
      name: 'dry-server',
      server: { command: 'echo', args: [], env: {}, type: 'stdio' },
      dry_run: true,
    });
    expect(r.written).toBe(false);
    const afterContent = await readFile(join(projectRoot, '.agentsmesh/mcp.json'), 'utf8');
    expect(afterContent).toBe(originalContent);
  });

  it('removeMcpServer dry_run returns removed: false without writing', async () => {
    const r = await settingsHandlers.removeMcpServer(ctx, { name: 'my-server', dry_run: true });
    expect(r.removed).toBe(false);
    const raw = await readFile(join(projectRoot, '.agentsmesh/mcp.json'), 'utf8');
    const parsed = JSON.parse(raw) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers['my-server']).toBeDefined();
  });

  it('updatePermissions dry_run returns written: false without writing', async () => {
    const originalContent = await readFile(
      join(projectRoot, '.agentsmesh/permissions.yaml'),
      'utf8',
    );
    const r = await settingsHandlers.updatePermissions(ctx, {
      allow: ['NewTool'],
      dry_run: true,
    });
    expect(r.written).toBe(false);
    const afterContent = await readFile(join(projectRoot, '.agentsmesh/permissions.yaml'), 'utf8');
    expect(afterContent).toBe(originalContent);
  });

  it('updateHooks dry_run returns written: false without writing', async () => {
    const originalContent = await readFile(join(projectRoot, '.agentsmesh/hooks.yaml'), 'utf8');
    const r = await settingsHandlers.updateHooks(ctx, {
      hooks: { PostToolUse: [] },
      dry_run: true,
    });
    expect(r.written).toBe(false);
    const afterContent = await readFile(join(projectRoot, '.agentsmesh/hooks.yaml'), 'utf8');
    expect(afterContent).toBe(originalContent);
  });

  it('updateIgnore dry_run returns written: false without writing', async () => {
    const originalContent = await readFile(join(projectRoot, '.agentsmesh/ignore'), 'utf8');
    const r = await settingsHandlers.updateIgnore(ctx, { patterns: ['dry'], dry_run: true });
    expect(r.written).toBe(false);
    const afterContent = await readFile(join(projectRoot, '.agentsmesh/ignore'), 'utf8');
    expect(afterContent).toBe(originalContent);
  });

  it('getIgnore returns { patterns: null } when ignore file missing', async () => {
    await rm(join(projectRoot, '.agentsmesh/ignore'));
    const result = await settingsHandlers.getIgnore(ctx);
    expect(result).toEqual({ patterns: null });
  });

  it('updateMcpServer dry_run returns written: false without writing', async () => {
    const originalContent = await readFile(join(projectRoot, '.agentsmesh/mcp.json'), 'utf8');
    const r = await settingsHandlers.updateMcpServer(ctx, {
      name: 'my-server',
      server: { command: 'changed', args: [], env: {}, type: 'stdio' },
      dry_run: true,
    });
    expect(r.written).toBe(false);
    const afterContent = await readFile(join(projectRoot, '.agentsmesh/mcp.json'), 'utf8');
    expect(afterContent).toBe(originalContent);
  });
});

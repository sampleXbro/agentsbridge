/**
 * E2E tests for the agentsmesh MCP server.
 *
 * Spawns `agentsmesh mcp` as a subprocess and drives it via the
 * @modelcontextprotocol/sdk Client over stdio.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import {
  createInitedProject,
  parseToolText,
  spawnMcpServer,
  type McpServer,
} from './helpers/mcp-client.js';

// ---------------------------------------------------------------------------
// Protocol baseline tests — read-only, shared server instance
// ---------------------------------------------------------------------------

describe('mcp-server protocol', () => {
  let dir = '';
  let server: McpServer;

  beforeAll(async () => {
    dir = createInitedProject();
    server = await spawnMcpServer(dir);
  });

  afterAll(async () => {
    await server.dispose();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('server info has correct name', () => {
    const info = server.client.getServerVersion();
    expect(info).toMatchObject({ name: 'agentsmesh-mcp' });
  });

  it('lists exactly 48 tools with unique names', async () => {
    const { tools } = await server.client.listTools();
    expect(tools).toHaveLength(48);
    expect(new Set(tools.map((t) => t.name)).size).toBe(48);
  });

  it('lists exactly 17 resources', async () => {
    const { resources } = await server.client.listResources();
    expect(resources).toHaveLength(17);
  });

  it('exposes install / uninstall / installs_list / refresh as live MCP tools', async () => {
    const { tools } = await server.client.listTools();
    const names = new Set(tools.map((t) => t.name));
    expect(names.has('install')).toBe(true);
    expect(names.has('uninstall')).toBe(true);
    expect(names.has('installs_list')).toBe(true);
    expect(names.has('refresh')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Read tool tests — read-only, shared server instance
// ---------------------------------------------------------------------------

describe('mcp-server reads', () => {
  let dir = '';
  let server: McpServer;

  beforeAll(async () => {
    dir = createInitedProject();
    server = await spawnMcpServer(dir);
  });

  afterAll(async () => {
    await server.dispose();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('list_rules returns the _root rule', async () => {
    const result = await server.client.callTool({ name: 'list_rules', arguments: {} });
    const data = parseToolText(result) as { name: string; root: boolean }[];
    expect(Array.isArray(data)).toBe(true);
    expect(data).toContainEqual(expect.objectContaining({ name: '_root', root: true }));
  });

  it('get_config returns parsed agentsmesh.yaml with version 1', async () => {
    const result = await server.client.callTool({ name: 'get_config', arguments: {} });
    const data = parseToolText(result) as { version: number };
    expect(data.version).toBe(1);
  });

  it('list_mcp_servers returns the seeded agentsmesh entry', async () => {
    const result = await server.client.callTool({ name: 'list_mcp_servers', arguments: {} });
    const data = parseToolText(result) as { servers: Record<string, { command: string }> };
    expect(data.servers.agentsmesh).toMatchObject({ command: 'npx' });
  });

  it('list_target_capabilities returns a matrix with more than 10 targets', async () => {
    const result = await server.client.callTool({
      name: 'list_target_capabilities',
      arguments: {},
    });
    const data = parseToolText(result) as Record<string, unknown>;
    expect(Object.keys(data).length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// Mutation tests — separate server instance (mutations alter filesystem state)
// ---------------------------------------------------------------------------

describe('mcp-server mutations', () => {
  let dir = '';
  let server: McpServer;

  beforeAll(async () => {
    dir = createInitedProject();
    server = await spawnMcpServer(dir);
  });

  afterAll(async () => {
    await server.dispose();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('create_rule → file appears on disk, get_rule returns the body', async () => {
    const createResult = await server.client.callTool({
      name: 'create_rule',
      arguments: { name: 'e2e-auth', frontmatter: { description: 'e2e' }, body: 'rules here\n' },
    });
    const created = parseToolText(createResult) as { written: boolean };
    expect(created.written).toBe(true);

    const getResult = await server.client.callTool({
      name: 'get_rule',
      arguments: { name: 'e2e-auth' },
    });
    const got = parseToolText(getResult) as { body: string };
    expect(got.body).toBe('rules here\n');
  });

  it('delete_rule _root without force returns PROTECTED_FILE error', async () => {
    const result = await server.client.callTool({
      name: 'delete_rule',
      arguments: { name: '_root' },
    });
    expect(result.isError).toBe(true);
    const data = parseToolText(result) as { code: string };
    expect(data.code).toBe('PROTECTED_FILE');
  });
});

// ---------------------------------------------------------------------------
// Self-introspection headline test
// ---------------------------------------------------------------------------

describe('mcp-server self-introspection', () => {
  let dir = '';
  let server: McpServer;

  beforeAll(async () => {
    dir = createInitedProject();
    server = await spawnMcpServer(dir);
  });

  afterAll(async () => {
    await server.dispose();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('agent can see its own MCP server entry via list_mcp_servers', async () => {
    const result = await server.client.callTool({ name: 'list_mcp_servers', arguments: {} });
    const data = parseToolText(result) as {
      servers: Record<string, { args: string[] }>;
    };
    expect(data.servers.agentsmesh).toBeDefined();
    expect(data.servers.agentsmesh.args).toEqual(['-y', 'agentsmesh', 'mcp']);
  });
});

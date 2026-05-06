/**
 * E2E tests for the agentsmesh MCP server.
 *
 * Spawns `agentsmesh mcp` as a subprocess and drives it via the
 * @modelcontextprotocol/sdk Client over stdio.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const CLI_PATH = resolve(process.cwd(), 'dist', 'cli.js');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface McpServer {
  client: Client;
  dispose: () => Promise<void>;
}

interface TextContent {
  type: 'text';
  text: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function spawnMcpServer(cwd: string): Promise<McpServer> {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [CLI_PATH, 'mcp'],
    cwd,
    stderr: 'pipe',
  });
  const client = new Client({ name: 'e2e-test', version: '0.0.0' }, { capabilities: {} });
  await client.connect(transport);
  return {
    client,
    dispose: async () => {
      try {
        await client.close();
      } catch {
        /* server may already be dead */
      }
    },
  };
}

function createInitedProject(): string {
  const dir = join(tmpdir(), 'am-mcp-e2e-' + randomBytes(8).toString('hex'));
  mkdirSync(dir, { recursive: true });

  // Minimal agentsmesh.yaml
  writeFileSync(
    join(dir, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules, mcp]\n',
  );

  // .agentsmesh canonical directory
  mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(dir, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\ndescription: Root rule\n---\n# Root\nGlobal agent rules.\n',
  );

  // .agentsmesh/mcp.json with the seeded agentsmesh entry
  writeFileSync(
    join(dir, '.agentsmesh', 'mcp.json'),
    JSON.stringify(
      {
        mcpServers: {
          agentsmesh: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', 'agentsmesh', 'mcp'],
          },
        },
      },
      null,
      2,
    ) + '\n',
  );

  return dir;
}

function parseToolText(result: { content: unknown[] }): unknown {
  const first = result.content[0] as TextContent;
  return JSON.parse(first.text) as unknown;
}

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

  it('lists exactly 41 tools with unique names', async () => {
    const { tools } = await server.client.listTools();
    expect(tools).toHaveLength(41);
    expect(new Set(tools.map((t) => t.name)).size).toBe(41);
  });

  it('lists exactly 16 resources', async () => {
    const { resources } = await server.client.listResources();
    expect(resources).toHaveLength(16);
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

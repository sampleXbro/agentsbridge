/**
 * Shared E2E helpers for driving the real `agentsmesh mcp` server over stdio
 * via the @modelcontextprotocol/sdk client. Used by mcp-server.e2e.test.ts and
 * lessons-mcp.e2e.test.ts.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const CLI_PATH = resolve(process.cwd(), 'dist', 'cli.js');

export interface McpServer {
  client: Client;
  dispose: () => Promise<void>;
}

interface TextContent {
  type: 'text';
  text: string;
}

/** Spawn `agentsmesh mcp` in `cwd` and return a connected MCP client. */
export async function spawnMcpServer(cwd: string): Promise<McpServer> {
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

/** Create a minimal initialized agentsmesh project in a fresh temp dir. */
export function createInitedProject(): string {
  const dir = join(tmpdir(), 'am-mcp-e2e-' + randomBytes(8).toString('hex'));
  mkdirSync(dir, { recursive: true });

  writeFileSync(
    join(dir, 'agentsmesh.yaml'),
    'version: 1\ntargets: [claude-code]\nfeatures: [rules, mcp]\n',
  );

  mkdirSync(join(dir, '.agentsmesh', 'rules'), { recursive: true });
  writeFileSync(
    join(dir, '.agentsmesh', 'rules', '_root.md'),
    '---\nroot: true\ndescription: Root rule\n---\n# Root\nGlobal agent rules.\n',
  );

  writeFileSync(
    join(dir, '.agentsmesh', 'mcp.json'),
    JSON.stringify(
      {
        mcpServers: {
          agentsmesh: { type: 'stdio', command: 'npx', args: ['-y', 'agentsmesh', 'mcp'] },
        },
      },
      null,
      2,
    ) + '\n',
  );

  return dir;
}

/** Parse the first text content block of a tool result as JSON. */
export function parseToolText(result: { content: unknown[] }): unknown {
  const first = result.content[0] as TextContent;
  return JSON.parse(first.text) as unknown;
}

import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { stringify as yamlStringify } from 'yaml';
import { importFromGoose } from '../../../../src/targets/goose/importer.js';
import { generateMcp } from '../../../../src/targets/goose/generator.js';
import { GOOSE_GLOBAL_CONFIG } from '../../../../src/targets/goose/constants.js';
import type { CanonicalFiles, McpServer } from '../../../../src/core/types.js';

const GOOSE_CANONICAL_MCP = '.agentsmesh/mcp.json';

function setupFixture(files: Record<string, string>): string {
  const root = join(
    tmpdir(),
    `goose-mcp-import-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(join(root, '.agentsmesh'), { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const absPath = join(root, relativePath);
    mkdirSync(join(absPath, '..'), { recursive: true });
    writeFileSync(absPath, content, 'utf-8');
  }
  return root;
}

function readCanonicalServers(root: string): Record<string, McpServer> {
  const raw = readFileSync(join(root, GOOSE_CANONICAL_MCP), 'utf-8');
  return (JSON.parse(raw) as { mcpServers: Record<string, McpServer> }).mcpServers;
}

const STDIO_CONFIG = yamlStringify({
  extensions: {
    filesystem: {
      bundled: null,
      description: 'Local files',
      enabled: true,
      env_keys: [],
      envs: { ROOT: '/tmp' },
      name: 'filesystem',
      timeout: 30,
      type: 'stdio',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      cmd: 'npx',
    },
    remote: {
      bundled: null,
      description: '',
      enabled: true,
      env_keys: [],
      envs: {},
      name: 'remote',
      timeout: 30,
      type: 'sse',
      uri: 'https://example.com/sse',
    },
  },
});

describe('goose global MCP import', () => {
  it('imports stdio + sse extensions from config.yaml into canonical mcp.json', async () => {
    const root = setupFixture({ [GOOSE_GLOBAL_CONFIG]: STDIO_CONFIG });

    const results = await importFromGoose(root, { scope: 'global' });

    const mcpResult = results.find((r) => r.feature === 'mcp');
    expect(mcpResult).toBeDefined();
    expect(mcpResult!.fromTool).toBe('goose');
    expect(mcpResult!.toPath).toBe(GOOSE_CANONICAL_MCP);

    const servers = readCanonicalServers(root);
    expect(servers.filesystem).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      env: { ROOT: '/tmp' },
      description: 'Local files',
    });
    expect(servers.remote).toEqual({
      type: 'sse',
      url: 'https://example.com/sse',
      headers: {},
      env: {},
    });

    rmSync(root, { recursive: true, force: true });
  });

  it('does not import MCP in project scope (goose MCP is global-only)', async () => {
    const root = setupFixture({ [GOOSE_GLOBAL_CONFIG]: STDIO_CONFIG });

    const results = await importFromGoose(root, { scope: 'project' });
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();

    rmSync(root, { recursive: true, force: true });
  });

  it('returns no mcp result when config.yaml has no extensions', async () => {
    const root = setupFixture({ [GOOSE_GLOBAL_CONFIG]: yamlStringify({ extensions: {} }) });

    const results = await importFromGoose(root, { scope: 'global' });
    expect(results.find((r) => r.feature === 'mcp')).toBeUndefined();

    rmSync(root, { recursive: true, force: true });
  });

  it('round-trips: generate -> import yields the original servers', async () => {
    const mcpServers: Record<string, McpServer> = {
      filesystem: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        env: { ROOT: '/tmp' },
        description: 'Local files',
      },
      remote: {
        type: 'sse',
        url: 'https://example.com/sse',
        headers: {},
        env: {},
      },
    };
    const canonical: CanonicalFiles = {
      rules: [],
      commands: [],
      agents: [],
      skills: [],
      mcp: { mcpServers },
      permissions: null,
      hooks: null,
      ignore: [],
    };

    const generated = generateMcp(canonical, { scope: 'global' });
    expect(generated).toHaveLength(1);
    expect(generated[0].path).toBe(GOOSE_GLOBAL_CONFIG);

    const root = setupFixture({ [GOOSE_GLOBAL_CONFIG]: generated[0].content });
    await importFromGoose(root, { scope: 'global' });

    expect(readCanonicalServers(root)).toEqual(mcpServers);

    rmSync(root, { recursive: true, force: true });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseMcp } from '../../../src/canonical/features/mcp.js';
import type { StdioMcpServer } from '../../../src/core/mcp-types.js';

const TEST_DIR = join(tmpdir(), 'agentsmesh-mcp-test');
const MCP_PATH = join(TEST_DIR, '.agentsmesh', 'mcp.json');

beforeEach(() => {
  mkdirSync(join(TEST_DIR, '.agentsmesh'), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function writeMcp(content: string): void {
  writeFileSync(MCP_PATH, content);
}

describe('parseMcp', () => {
  it('parses valid mcp.json with stdio server', async () => {
    writeMcp(`{
  "mcpServers": {
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {}
    }
  }
}`);
    const result = await parseMcp(MCP_PATH);
    expect(result).not.toBeNull();
    expect(result?.mcpServers).toHaveProperty('context7');
    expect(result?.mcpServers.context7).toMatchObject({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp'],
      env: {},
    });
  });

  it('parses server with optional description', async () => {
    writeMcp(`{
  "mcpServers": {
    "github": {
      "description": "GitHub MCP server",
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {}
    }
  }
}`);
    const result = await parseMcp(MCP_PATH);
    expect(result?.mcpServers.github?.description).toBe('GitHub MCP server');
  });

  it('parses multiple servers', async () => {
    writeMcp(`{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."],
      "env": {}
    },
    "github": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "$GITHUB_TOKEN" }
    }
  }
}`);
    const result = await parseMcp(MCP_PATH);
    expect(Object.keys(result?.mcpServers ?? {})).toHaveLength(2);
    expect((result?.mcpServers.filesystem as StdioMcpServer | undefined)?.command).toBe('npx');
    expect(result?.mcpServers.github?.env).toEqual({ GITHUB_TOKEN: '$GITHUB_TOKEN' });
  });

  it('parses sse and http types', async () => {
    writeMcp(`{
  "mcpServers": {
    "sse-server": {
      "type": "sse",
      "command": "curl",
      "args": ["https://example.com/sse"],
      "env": {}
    },
    "http-server": {
      "type": "http",
      "command": "node",
      "args": ["server.js"],
      "env": {}
    }
  }
}`);
    const result = await parseMcp(MCP_PATH);
    expect(result?.mcpServers['sse-server']?.type).toBe('sse');
    expect(result?.mcpServers['http-server']?.type).toBe('http');
  });

  it('returns null for non-existent file', async () => {
    const result = await parseMcp(join(TEST_DIR, 'nope', 'mcp.json'));
    expect(result).toBeNull();
  });

  it('returns null for malformed JSON', async () => {
    writeMcp('{ invalid json');
    const result = await parseMcp(MCP_PATH);
    expect(result).toBeNull();
  });

  it('returns null for empty mcpServers', async () => {
    writeMcp('{ "mcpServers": {} }');
    const result = await parseMcp(MCP_PATH);
    expect(result).not.toBeNull();
    expect(Object.keys(result?.mcpServers ?? {})).toHaveLength(0);
  });

  it('returns null when mcpServers is missing', async () => {
    writeMcp('{ "other": "value" }');
    const result = await parseMcp(MCP_PATH);
    expect(result).toBeNull();
  });

  it('preserves any string type (forward compat)', async () => {
    writeMcp(`{
  "mcpServers": {
    "custom": {
      "type": "streamable-http",
      "command": "npx",
      "args": ["server"],
      "env": {}
    }
  }
}`);
    const result = await parseMcp(MCP_PATH);
    expect(result?.mcpServers.custom?.type).toBe('streamable-http');
  });

  it('defaults missing type to stdio', async () => {
    writeMcp(`{
  "mcpServers": {
    "no-type": {
      "command": "npx",
      "args": ["server"],
      "env": {}
    }
  }
}`);
    const result = await parseMcp(MCP_PATH);
    expect(result?.mcpServers['no-type']?.type).toBe('stdio');
  });

  it('defaults args and env when missing', async () => {
    writeMcp(`{
  "mcpServers": {
    "minimal": {
      "type": "stdio",
      "command": "npx"
    }
  }
}`);
    const result = await parseMcp(MCP_PATH);
    expect((result?.mcpServers.minimal as StdioMcpServer | undefined)?.args).toEqual([]);
    expect(result?.mcpServers.minimal?.env).toEqual({});
  });

  it('skips server with missing command', async () => {
    writeMcp(`{
  "mcpServers": {
    "valid": {
      "type": "stdio",
      "command": "npx",
      "args": ["server"],
      "env": {}
    },
    "invalid": {
      "type": "stdio"
    }
  }
}`);
    const result = await parseMcp(MCP_PATH);
    expect(Object.keys(result?.mcpServers ?? {})).toEqual(['valid']);
    expect(result?.mcpServers.invalid).toBeUndefined();
  });
});

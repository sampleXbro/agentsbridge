import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseMcp } from '../../../src/canonical/features/mcp.js';

const TEST_DIR = join(tmpdir(), 'agentsmesh-mcp-transports-test');
const MCP_PATH = join(TEST_DIR, '.agentsmesh', 'mcp.json');

beforeEach(() => {
  mkdirSync(join(TEST_DIR, '.agentsmesh'), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('parseMcp transport variants', () => {
  it('parses URL-based MCP servers with headers and env', async () => {
    writeFileSync(
      MCP_PATH,
      `{
  "mcpServers": {
    "remote": {
      "type": "http",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer \${API_TOKEN}" },
      "env": { "API_TOKEN": "\${API_TOKEN}" }
    }
  }
}`,
    );

    const result = await parseMcp(MCP_PATH);

    expect(result?.mcpServers.remote).toEqual({
      type: 'http',
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer ${API_TOKEN}' },
      env: { API_TOKEN: '${API_TOKEN}' },
    });
  });

  it('skips URL-based servers that are missing a url', async () => {
    writeFileSync(
      MCP_PATH,
      `{
  "mcpServers": {
    "broken": {
      "type": "sse",
      "headers": { "Authorization": "Bearer token" }
    }
  }
}`,
    );

    const result = await parseMcp(MCP_PATH);

    expect(result?.mcpServers).toEqual({});
  });
});

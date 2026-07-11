import { describe, expect, it } from 'vitest';
import { generateMcp } from '../../../../src/targets/codex-cli/generator.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

function canonicalWithMcp(mcp: CanonicalFiles['mcp']): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('generateMcp (codex-cli) transport filtering', () => {
  it('serializes both stdio and remote (url) servers to config.toml', () => {
    const results = generateMcp(
      canonicalWithMcp({
        mcpServers: {
          local: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp'],
            env: {},
          },
          remote: {
            type: 'http',
            url: 'https://example.com/mcp',
            headers: { Authorization: 'Bearer ${TOKEN}' },
            env: {},
          },
        },
      }),
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.content).toContain('command = "npx"');
    expect(results[0]!.content).toContain('[mcp_servers.remote]');
    expect(results[0]!.content).toContain('url = "https://example.com/mcp"');
    expect(results[0]!.content).toContain('bearer_token_env_var = "TOKEN"');
  });

  it('emits literal custom headers under http_headers', () => {
    const results = generateMcp(
      canonicalWithMcp({
        mcpServers: {
          remote: {
            type: 'http',
            url: 'https://example.com/mcp',
            headers: { 'X-Custom': 'value' },
            env: {},
          },
        },
      }),
    );

    expect(results[0]!.content).toContain('http_headers = { X-Custom = "value" }');
  });
});

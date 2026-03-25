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
  it('serializes only stdio servers to config.toml', () => {
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
            env: { TOKEN: '${TOKEN}' },
          },
        },
      }),
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.content).toContain('command = "npx"');
    expect(results[0]!.content).not.toContain('https://example.com/mcp');
    expect(results[0]!.content).not.toContain('[mcp_servers.remote]');
  });
});

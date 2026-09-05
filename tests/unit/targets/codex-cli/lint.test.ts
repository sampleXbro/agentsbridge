import { describe, expect, it } from 'vitest';
import { lintAgents, lintMcp } from '../../../../src/targets/codex-cli/lint.js';
import type { CanonicalAgent, CanonicalFiles, McpConfig } from '../../../../src/core/types.js';

function makeCanonical(mcp: McpConfig | null): CanonicalFiles {
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

describe('codex-cli lintMcp', () => {
  it('returns [] when mcp is null', () => {
    expect(lintMcp(makeCanonical(null))).toEqual([]);
  });

  it('returns [] when mcpServers is empty', () => {
    expect(lintMcp(makeCanonical({ mcpServers: {} }))).toEqual([]);
  });

  it('warns when server has description', () => {
    const out = lintMcp(
      makeCanonical({
        mcpServers: {
          docs: { command: 'npx', args: [], env: {}, type: 'stdio', description: 'My docs' },
        },
      }),
    );
    expect(out.some((d) => d.message.includes('description'))).toBe(true);
  });

  it('does not emit description warning when description is empty', () => {
    const out = lintMcp(
      makeCanonical({
        mcpServers: {
          docs: { command: 'npx', args: [], env: {}, type: 'stdio', description: '' },
        },
      }),
    );
    expect(out.filter((d) => d.message.includes('description'))).toEqual([]);
  });

  it('does not emit description warning when description is non-string', () => {
    const out = lintMcp(
      // @ts-expect-error testing runtime guard
      makeCanonical({ mcpServers: { docs: { command: 'npx', description: 42 } } }),
    );
    expect(out.filter((d) => d.message.includes('description'))).toEqual([]);
  });

  it('does not warn about remote (url) servers with no env vars', () => {
    const out = lintMcp(
      makeCanonical({
        mcpServers: {
          srv: {
            type: 'http',
            url: 'https://example.com',
            headers: {},
            env: {},
          },
        },
      }),
    );
    expect(out).toEqual([]);
  });

  it('warns when a remote (url) server has env vars codex-cli cannot project', () => {
    const out = lintMcp(
      makeCanonical({
        mcpServers: {
          srv: {
            type: 'http',
            url: 'https://example.com',
            headers: {},
            env: { TOKEN: 'secret' },
          },
        },
      }),
    );
    expect(out.some((d) => d.message.includes('env vars'))).toBe(true);
  });

  it('produces both description and env-var warnings on the same server', () => {
    const out = lintMcp(
      makeCanonical({
        mcpServers: {
          srv: {
            type: 'http',
            url: 'https://example.com',
            headers: {},
            env: { TOKEN: 'secret' },
            description: 'has desc',
          },
        },
      }),
    );
    expect(out).toHaveLength(2);
  });
});

function makeAgent(overrides: Partial<CanonicalAgent> = {}): CanonicalAgent {
  return {
    source: '.agentsmesh/agents/reviewer.md',
    name: 'reviewer',
    description: 'Reviews code',
    tools: [],
    disallowedTools: [],
    model: '',
    permissionMode: '',
    maxTurns: 0,
    mcpServers: [],
    hooks: {},
    skills: [],
    memory: '',
    body: 'Review.',
    ...overrides,
  };
}

describe('codex-cli lintAgents', () => {
  it('returns [] when every agent field has a Codex TOML key', () => {
    const agents = [makeAgent({ model: 'gpt-5', permissionMode: 'read-only', mcpServers: ['x'] })];
    expect(lintAgents({ ...makeCanonical(null), agents })).toEqual([]);
  });

  it('warns once per agent, naming every field the TOML never carries', () => {
    const agents = [makeAgent({ tools: ['Read', 'Grep'], maxTurns: 3 }), makeAgent({ name: 'b' })];
    const out = lintAgents({ ...makeCanonical(null), agents });
    expect(out).toEqual([
      {
        level: 'warning',
        file: '.agentsmesh/agents/reviewer.md',
        target: 'codex-cli',
        message:
          'Codex agent TOML supports name, description, developer_instructions, model, sandbox_mode and mcp_servers; canonical maxTurns, tools are not projected to .codex/agents/reviewer.toml.',
      },
    ]);
  });
});

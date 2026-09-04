import { describe, it, expect } from 'vitest';
import type { CanonicalAgent, CanonicalFiles } from '../../../../src/core/types.js';
import { lintAgents, lintMcp, lintPermissions } from '../../../../src/targets/antigravity/lint.js';

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

function makeAgent(overrides: Partial<CanonicalAgent> = {}): CanonicalAgent {
  return {
    source: '.agentsmesh/agents/code-reviewer.md',
    name: 'code-reviewer',
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

describe('lintPermissions (antigravity)', () => {
  it('returns [] when permissions is null', () => {
    expect(lintPermissions(makeCanonical())).toHaveLength(0);
  });

  it('returns [] when all permission lists are empty', () => {
    expect(
      lintPermissions(makeCanonical({ permissions: { allow: [], deny: [], ask: [] } })),
    ).toHaveLength(0);
  });

  it('warns at project scope that permissions live outside the repo', () => {
    const result = lintPermissions(
      makeCanonical({ permissions: { allow: ['run_command(npm test)'], deny: [], ask: [] } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.level).toBe('warning');
    expect(result[0]!.target).toBe('antigravity');
    expect(result[0]!.message).toContain('--global');
  });

  it('warns for deny-only and ask-only canonical permissions at project scope', () => {
    expect(
      lintPermissions(
        makeCanonical({ permissions: { allow: [], deny: ['write_file(*)'], ask: [] } }),
      ),
    ).toHaveLength(1);
    expect(
      lintPermissions(makeCanonical({ permissions: { allow: [], deny: [], ask: ['*'] } })),
    ).toHaveLength(1);
  });

  it('stays silent at global scope where the settings file is written', () => {
    expect(
      lintPermissions(
        makeCanonical({ permissions: { allow: ['run_command(npm test)'], deny: [], ask: [] } }),
        { scope: 'global' },
      ),
    ).toHaveLength(0);
  });
});

describe('lintAgents (antigravity)', () => {
  it('returns [] when no agent carries a field Antigravity ignores', () => {
    expect(lintAgents(makeCanonical({ agents: [makeAgent({ tools: ['Read'] })] }))).toHaveLength(0);
  });

  it('names every dropped canonical field for the agent that carries them', () => {
    const result = lintAgents(
      makeCanonical({
        agents: [makeAgent({ disallowedTools: ['Bash'], maxTurns: 5, memory: 'notes.md' })],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.file).toBe('.agentsmesh/agents/code-reviewer.md');
    expect(result[0]!.message).toContain('disallowedTools');
    expect(result[0]!.message).toContain('maxTurns');
    expect(result[0]!.message).toContain('memory');
    expect(result[0]!.message).not.toContain('mcpServers');
  });
});

describe('lintMcp (antigravity)', () => {
  it('returns [] when no server carries a description', () => {
    expect(
      lintMcp(
        makeCanonical({
          mcp: { mcpServers: { docs: { type: 'stdio', command: 'npx', args: [], env: {} } } },
        }),
      ),
    ).toHaveLength(0);
  });

  it('warns that mcp_config.json has no field for a canonical server description', () => {
    const result = lintMcp(
      makeCanonical({
        mcp: {
          mcpServers: {
            docs: { type: 'stdio', command: 'npx', args: [], env: {}, description: 'Docs' },
          },
        },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.message).toContain('description');
    expect(result[0]!.message).toContain('docs');
  });

  it('warns that a remote server loses its canonical transport type', () => {
    const result = lintMcp(
      makeCanonical({
        mcp: {
          mcpServers: {
            search: { type: 'sse', url: 'https://x/mcp', headers: {}, env: {} },
          },
        },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.message).toContain('type');
    expect(result[0]!.message).toContain('search');
    expect(result[0]!.message).toContain('serverUrl');
  });

  it('does not warn about the type of a local server', () => {
    expect(
      lintMcp(
        makeCanonical({
          mcp: { mcpServers: { docs: { type: 'stdio', command: 'npx', args: [], env: {} } } },
        }),
      ),
    ).toHaveLength(0);
  });
});

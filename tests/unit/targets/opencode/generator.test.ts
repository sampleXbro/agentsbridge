import { describe, it, expect } from 'vitest';
import { parse as yamlParse } from 'yaml';
import type { CanonicalFiles, CanonicalAgent } from '../../../../src/core/types.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateMcp,
  generateSkills,
} from '../../../../src/targets/opencode/generator.js';
import {
  OPENCODE_ROOT_RULE,
  OPENCODE_RULES_DIR,
  OPENCODE_COMMANDS_DIR,
  OPENCODE_AGENTS_DIR,
  OPENCODE_SKILLS_DIR,
  OPENCODE_CONFIG_FILE,
} from '../../../../src/targets/opencode/constants.js';

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
    source: '/proj/.agentsmesh/agents/my-agent.md',
    name: 'My Agent',
    description: '',
    tools: [],
    disallowedTools: [],
    model: '',
    permissionMode: '',
    maxTurns: 0,
    mcpServers: [],
    hooks: {},
    skills: [],
    memory: '',
    body: '',
    ...overrides,
  };
}

describe('generateRules (opencode)', () => {
  it('generates root rule as AGENTS.md', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root\n\nUse TDD.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(OPENCODE_ROOT_RULE);
    expect(results[0].content).toContain('Use TDD.');
  });

  it('generates non-root rules under .opencode/rules/{slug}.md', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root',
        },
        {
          source: '/proj/.agentsmesh/rules/typescript.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: 'Use strict TypeScript.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results).toHaveLength(2);
    const tsRule = results.find((r) => r.path === `${OPENCODE_RULES_DIR}/typescript.md`);
    expect(tsRule).toBeDefined();
    expect(tsRule?.content).toContain('Use strict TypeScript.');
  });

  it('writes description and globs as frontmatter when present', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/typescript.md',
          root: false,
          targets: [],
          description: 'TypeScript standards',
          globs: ['src/**/*.ts'],
          body: 'Strict mode mandatory.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('description: TypeScript standards');
    expect(results[0].content).toContain('globs:');
    expect(results[0].content).toContain('src/**/*.ts');
  });

  it('omits frontmatter block entirely when no description/globs', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/inline.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: 'Plain rule body.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].content.startsWith('---')).toBe(false);
    expect(results[0].content).toBe('Plain rule body.');
  });

  it('skips rules filtered to other targets', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root',
        },
        {
          source: '/proj/.agentsmesh/rules/claude-only.md',
          root: false,
          targets: ['claude-code'],
          description: '',
          globs: [],
          body: 'Claude only.',
        },
        {
          source: '/proj/.agentsmesh/rules/opencode-only.md',
          root: false,
          targets: ['opencode'],
          description: '',
          globs: [],
          body: 'OpenCode only.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.path).sort()).toEqual(
      [OPENCODE_ROOT_RULE, `${OPENCODE_RULES_DIR}/opencode-only.md`].sort(),
    );
  });

  it('returns empty array when no rules', () => {
    expect(generateRules(makeCanonical())).toEqual([]);
  });
});

describe('generateCommands (opencode)', () => {
  it('generates command files in .opencode/commands/', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/proj/.agentsmesh/commands/review.md',
          name: 'review',
          description: 'Review the code',
          allowedTools: ['Read', 'Grep'],
          body: 'Review all changed files.',
        },
      ],
    });
    const results = generateCommands(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${OPENCODE_COMMANDS_DIR}/review.md`);
    expect(results[0].content).toContain('description: Review the code');
    expect(results[0].content).toContain('Review all changed files.');
  });

  it('omits description frontmatter when empty', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/proj/.agentsmesh/commands/commit.md',
          name: 'commit',
          description: '',
          allowedTools: [],
          body: 'Commit changes.',
        },
      ],
    });
    const results = generateCommands(canonical);
    expect(results[0].content).not.toContain('description:');
    expect(results[0].content).toContain('Commit changes.');
  });

  it('does not project allowed-tools (opencode commands carry only description)', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/proj/.agentsmesh/commands/test.md',
          name: 'test',
          description: 'Run tests',
          allowedTools: ['Bash(pnpm test)', 'Bash(pnpm typecheck)'],
          body: 'Run all tests.',
        },
      ],
    });
    const results = generateCommands(canonical);
    expect(results[0].content).not.toContain('allowed-tools');
    expect(results[0].content).not.toContain('allowedTools');
    expect(results[0].content).not.toContain('Bash(pnpm test)');
  });

  it('returns empty array when no commands', () => {
    expect(generateCommands(makeCanonical())).toEqual([]);
  });
});

describe('generateAgents (opencode)', () => {
  it('generates agent files in .opencode/agents/{slug}.md', () => {
    const canonical = makeCanonical({
      agents: [
        makeAgent({
          source: '/proj/.agentsmesh/agents/code-reviewer.md',
          name: 'Code Reviewer',
          description: 'Reviews code for quality',
          body: 'You are an expert code reviewer.',
        }),
      ],
    });
    const results = generateAgents(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${OPENCODE_AGENTS_DIR}/code-reviewer.md`);
    const parsed = yamlParse(
      results[0].content.split('\n---', 2)[0].replace(/^---\n?/, ''),
    ) as Record<string, unknown>;
    expect(parsed.mode).toBe('subagent');
    expect(parsed.description).toBe('Reviews code for quality');
    expect(results[0].content).toContain('You are an expert code reviewer.');
  });

  it('writes mode: subagent always', () => {
    const canonical = makeCanonical({
      agents: [makeAgent({ name: 'helper', source: '/proj/.agentsmesh/agents/helper.md' })],
    });
    const results = generateAgents(canonical);
    expect(results[0].content).toContain('mode: subagent');
  });

  it('writes model when present', () => {
    const canonical = makeCanonical({
      agents: [
        makeAgent({
          source: '/proj/.agentsmesh/agents/researcher.md',
          model: 'anthropic/claude-haiku-4-5',
          description: 'Research things',
          body: 'Research.',
        }),
      ],
    });
    const results = generateAgents(canonical);
    expect(results[0].content).toContain('model: anthropic/claude-haiku-4-5');
  });

  it('omits model when empty', () => {
    const canonical = makeCanonical({
      agents: [
        makeAgent({
          source: '/proj/.agentsmesh/agents/helper.md',
          description: 'Help',
          body: 'Help.',
        }),
      ],
    });
    expect(generateAgents(canonical)[0].content).not.toContain('model:');
  });

  it('writes tools and disallowedTools when present', () => {
    const canonical = makeCanonical({
      agents: [
        makeAgent({
          source: '/proj/.agentsmesh/agents/locked.md',
          tools: ['Read', 'Grep'],
          disallowedTools: ['Bash'],
          body: 'Restricted agent.',
        }),
      ],
    });
    const content = generateAgents(canonical)[0].content;
    expect(content).toContain('tools:');
    expect(content).toContain('Read');
    expect(content).toContain('Grep');
    expect(content).toContain('disallowedTools:');
    expect(content).toContain('Bash');
  });

  it('produces slug from source basename without extension', () => {
    const canonical = makeCanonical({
      agents: [
        makeAgent({ source: '/proj/.agentsmesh/agents/test-writer.md', name: 'Test Writer' }),
      ],
    });
    const results = generateAgents(canonical);
    expect(results[0].path).toBe(`${OPENCODE_AGENTS_DIR}/test-writer.md`);
  });

  it('returns empty array when no agents', () => {
    expect(generateAgents(makeCanonical())).toEqual([]);
  });
});

describe('generateMcp (opencode)', () => {
  it('generates opencode.json with mcp key and OpenCode-native format', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          'my-server': { type: 'stdio', command: 'node', args: ['server.js'], env: {} },
        },
      },
    });
    const results = generateMcp(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(OPENCODE_CONFIG_FILE);
    const parsed = JSON.parse(results[0].content) as { mcp: Record<string, unknown> };
    expect(parsed.mcp).toBeDefined();
    const server = parsed.mcp['my-server'] as Record<string, unknown>;
    expect(server.type).toBe('local');
    expect(server.command).toEqual(['node', 'server.js']);
  });

  it('maps env to environment in OpenCode format', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          github: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: { GITHUB_TOKEN: 'abc' },
          },
        },
      },
    });
    const results = generateMcp(canonical);
    const parsed = JSON.parse(results[0].content) as {
      mcp: Record<string, Record<string, unknown>>;
    };
    expect(parsed.mcp.github.environment).toEqual({ GITHUB_TOKEN: 'abc' });
    expect(parsed.mcp.github.env).toBeUndefined();
  });

  it('generates remote MCP server with url and type: remote', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          remote: {
            type: 'url',
            url: 'https://example.com/mcp',
            headers: { Authorization: 'Bearer token' },
            env: {},
          },
        },
      },
    });
    const results = generateMcp(canonical);
    const parsed = JSON.parse(results[0].content) as {
      mcp: Record<string, Record<string, unknown>>;
    };
    expect(parsed.mcp.remote.type).toBe('remote');
    expect(parsed.mcp.remote.url).toBe('https://example.com/mcp');
    expect(parsed.mcp.remote.headers).toEqual({ Authorization: 'Bearer token' });
  });

  it('includes description when present', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          fs: {
            type: 'stdio',
            command: 'node',
            args: ['fs.js'],
            env: {},
            description: 'Filesystem server',
          },
        },
      },
    });
    const results = generateMcp(canonical);
    const parsed = JSON.parse(results[0].content) as {
      mcp: Record<string, Record<string, unknown>>;
    };
    expect(parsed.mcp.fs.description).toBe('Filesystem server');
  });

  it('returns empty array when mcp is null', () => {
    expect(generateMcp(makeCanonical())).toEqual([]);
  });

  it('returns empty array when mcpServers is empty', () => {
    expect(generateMcp(makeCanonical({ mcp: { mcpServers: {} } }))).toEqual([]);
  });
});

describe('generateSkills (opencode)', () => {
  it('writes SKILL.md to .opencode/skills/{name}/SKILL.md', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/api-generator/SKILL.md',
          name: 'api-generator',
          description: 'Generate REST endpoints',
          body: '# API Generator\n\nUse this skill...',
          supportingFiles: [],
        },
      ],
    });
    const results = generateSkills(canonical);
    const main = results.find((r) => r.path === `${OPENCODE_SKILLS_DIR}/api-generator/SKILL.md`);
    expect(main).toBeDefined();
    expect(main?.content).toContain('name: api-generator');
    expect(main?.content).toContain('description: Generate REST endpoints');
  });

  it('writes supporting files alongside SKILL.md', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/api-generator/SKILL.md',
          name: 'api-generator',
          description: 'Generate REST endpoints',
          body: '# API Generator',
          supportingFiles: [
            {
              relativePath: 'references/route-checklist.md',
              absolutePath: '/proj/.agentsmesh/skills/api-generator/references/route-checklist.md',
              content: '# Route Checklist',
            },
            {
              relativePath: 'template.ts',
              absolutePath: '/proj/.agentsmesh/skills/api-generator/template.ts',
              content: 'export const template = 1;',
            },
          ],
        },
      ],
    });
    const results = generateSkills(canonical);
    const paths = results.map((r) => r.path).sort();
    expect(paths).toEqual([
      `${OPENCODE_SKILLS_DIR}/api-generator/SKILL.md`,
      `${OPENCODE_SKILLS_DIR}/api-generator/references/route-checklist.md`,
      `${OPENCODE_SKILLS_DIR}/api-generator/template.ts`,
    ]);
  });

  it('returns empty array when no skills', () => {
    expect(generateSkills(makeCanonical())).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateMcp,
  generateAgents,
} from '../../../../src/targets/amazon-q/generator.js';
import {
  AMAZON_Q_RULES_DIR,
  AMAZON_Q_MCP_FILE,
  AMAZON_Q_AGENTS_DIR,
} from '../../../../src/targets/amazon-q/constants.js';

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

describe('generateRules (amazon-q)', () => {
  it('generates _root.md for the root rule', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: 'Project standards',
          globs: [],
          body: '# Standards\n\nUse TDD.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${AMAZON_Q_RULES_DIR}/_root.md`);
    expect(results[0].content).toContain('Use TDD.');
    expect(results[0].content).not.toMatch(/^---/);
  });

  it('generates non-root rules in .amazonq/rules/<slug>.md', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/typescript.md',
          root: false,
          targets: [],
          description: 'TypeScript rules',
          globs: ['src/**/*.ts'],
          body: 'Use strict TypeScript.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${AMAZON_Q_RULES_DIR}/typescript.md`);
    expect(results[0].content).toContain('Use strict TypeScript.');
    expect(results[0].content).not.toMatch(/^---/);
  });

  it('generates both root and non-root rules', () => {
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
          source: '/proj/.agentsmesh/rules/security.md',
          root: false,
          targets: [],
          description: 'Security guidelines',
          globs: [],
          body: 'Never expose secrets.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(2);
    expect(results[0].path).toBe(`${AMAZON_Q_RULES_DIR}/_root.md`);
    expect(results[1].path).toBe(`${AMAZON_Q_RULES_DIR}/security.md`);
  });

  it('skips rules filtered to other targets', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/claude-only.md',
          root: false,
          targets: ['claude-code'],
          description: '',
          globs: [],
          body: 'Claude only.',
        },
      ],
    });

    expect(generateRules(canonical)).toHaveLength(0);
  });

  it('includes rules explicitly targeting amazon-q', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/aws.md',
          root: false,
          targets: ['amazon-q'],
          description: 'AWS-specific rules',
          globs: [],
          body: 'Use AWS SDK v3.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${AMAZON_Q_RULES_DIR}/aws.md`);
  });

  it('returns empty array when no rules', () => {
    expect(generateRules(makeCanonical())).toHaveLength(0);
  });

  it('trims rule body whitespace', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/trim.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: '  \n# Rule\n\nContent.\n  ',
        },
      ],
    });

    const results = generateRules(canonical);
    expect(results[0].content).toBe('# Rule\n\nContent.');
  });
});

describe('generateAgents (amazon-q)', () => {
  it('returns empty when no agents', () => {
    expect(generateAgents(makeCanonical())).toHaveLength(0);
  });

  it('generates .amazonq/cli-agents/{name}.json with the official prompt key', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/reviewer.md',
          name: 'reviewer',
          description: 'Reviews code',
          tools: ['Read', 'Grep'],
          disallowedTools: [],
          model: '',
          permissionMode: 'default',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'You review code carefully.',
        },
      ],
    });
    const results = generateAgents(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${AMAZON_Q_AGENTS_DIR}/reviewer.json`);
    const parsed = JSON.parse(results[0].content) as {
      name: string;
      description: string;
      prompt: string;
      allowedTools: string[];
    };
    expect(parsed.name).toBe('reviewer');
    expect(parsed.description).toBe('Reviews code');
    expect(parsed.prompt).toContain('You review code carefully');
    // The AWS agent-v1.json schema uses `prompt`, not `systemPrompt` — guard against regression.
    expect(parsed).not.toHaveProperty('systemPrompt');
    expect(parsed.allowedTools).toEqual(['Read', 'Grep']);
  });

  it('omits description when empty', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/helper.md',
          name: 'helper',
          description: '',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: 'default',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'You help.',
        },
      ],
    });
    const results = generateAgents(canonical);
    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    expect(parsed).not.toHaveProperty('description');
    expect(parsed).not.toHaveProperty('allowedTools');
  });

  it('generates multiple agents', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/a.md',
          name: 'a',
          description: '',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: 'default',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'Agent A.',
        },
        {
          source: '/proj/.agentsmesh/agents/b.md',
          name: 'b',
          description: 'Agent B',
          tools: ['Write'],
          disallowedTools: [],
          model: '',
          permissionMode: 'default',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'Agent B.',
        },
      ],
    });
    const results = generateAgents(canonical);
    expect(results).toHaveLength(2);
    expect(results[0].path).toBe(`${AMAZON_Q_AGENTS_DIR}/a.json`);
    expect(results[1].path).toBe(`${AMAZON_Q_AGENTS_DIR}/b.json`);
  });
});

describe('generateMcp (amazon-q)', () => {
  it('generates .amazonq/mcp.json', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          context7: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp@latest'],
            env: {},
          },
        },
      },
    });

    const results = generateMcp(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(AMAZON_Q_MCP_FILE);
    expect(JSON.parse(results[0].content)).toHaveProperty('mcpServers.context7.command', 'npx');
  });

  it('returns empty array when mcp is null', () => {
    expect(generateMcp(makeCanonical())).toHaveLength(0);
  });

  it('returns empty array when mcpServers is empty', () => {
    const canonical = makeCanonical({ mcp: { mcpServers: {} } });
    expect(generateMcp(canonical)).toHaveLength(0);
  });
});

import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { parseFrontmatter } from '../../../../src/utils/text/markdown.js';
import {
  generateRules,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
  generateCommands,
  generateHooks,
} from '../../../../src/targets/trae/generator.js';
import {
  TRAE_PROJECT_RULES,
  TRAE_RULES_DIR,
  TRAE_AGENTS_DIR,
  TRAE_SKILLS_DIR,
  TRAE_MCP_FILE,
  TRAE_IGNORE,
  TRAE_COMMANDS_DIR,
  TRAE_HOOKS_FILE,
} from '../../../../src/targets/trae/constants.js';

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

describe('generateRules (trae)', () => {
  it('generates project_rules.md for the root rule', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: 'Project defaults',
          globs: [],
          body: '# Project Rules\n\nUse TDD.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(TRAE_PROJECT_RULES);
    expect(results[0].content).toContain('Use TDD.');
    expect(results[0].content).not.toMatch(/^---/);
  });

  it('generates non-root rules as .trae/rules/<slug>.md', () => {
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
          description: 'TypeScript rules',
          globs: ['src/**/*.ts'],
          trigger: 'glob',
          body: 'Use strict TypeScript.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(2);
    const tsRule = results.find((r) => r.path === `${TRAE_RULES_DIR}/typescript.md`);
    expect(tsRule).toBeDefined();
    expect(tsRule?.content).toContain('Use strict TypeScript.');
    expect(tsRule?.content).not.toMatch(/^---/);
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

  it('includes rules that target trae explicitly', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/trae-specific.md',
          root: false,
          targets: ['trae'],
          description: '',
          globs: [],
          body: 'Trae-only rule.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${TRAE_RULES_DIR}/trae-specific.md`);
  });

  it('returns empty array when no rules', () => {
    expect(generateRules(makeCanonical())).toHaveLength(0);
  });

  it('emits only non-root rule when no root rule exists', () => {
    const canonical = makeCanonical({
      rules: [
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

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${TRAE_RULES_DIR}/security.md`);
    expect(results.some((r) => r.path === TRAE_PROJECT_RULES)).toBe(false);
  });

  it('trims whitespace from rule body', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '\n\n# Root\n\n',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results[0].content).toBe('# Root');
  });
});

describe('generateSkills (trae)', () => {
  it('generates skill files in .trae/skills/', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/api-generator/SKILL.md',
          name: 'api-generator',
          description: 'Generate API endpoints',
          body: '# API Generator\n\nGenerate endpoints.',
          supportingFiles: [
            {
              relativePath: 'references/checklist.md',
              absolutePath: '/proj/.agentsmesh/skills/api-generator/references/checklist.md',
              content: '# Checklist',
            },
          ],
        },
      ],
    });

    const results = generateSkills(canonical);

    expect(results).toHaveLength(2);
    expect(results[0].path).toBe(`${TRAE_SKILLS_DIR}/api-generator/SKILL.md`);
    expect(results[1].path).toBe(`${TRAE_SKILLS_DIR}/api-generator/references/checklist.md`);

    const { frontmatter } = parseFrontmatter(results[0].content);
    expect(frontmatter.name).toBe('api-generator');
    expect(frontmatter.description).toBe('Generate API endpoints');
  });

  it('returns empty for no skills', () => {
    expect(generateSkills(makeCanonical())).toHaveLength(0);
  });
});

describe('generateMcp (trae)', () => {
  it('generates .trae/mcp.json', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          github: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
            env: {},
          },
        },
      },
    });

    const results = generateMcp(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(TRAE_MCP_FILE);
    const parsed = JSON.parse(results[0].content) as { mcpServers: Record<string, unknown> };
    expect(Object.keys(parsed.mcpServers)).toContain('github');
  });

  it('returns empty when mcp is null', () => {
    expect(generateMcp(makeCanonical())).toHaveLength(0);
  });

  it('returns empty when mcpServers is empty', () => {
    expect(generateMcp(makeCanonical({ mcp: { mcpServers: {} } }))).toHaveLength(0);
  });
});

describe('generateIgnore (trae)', () => {
  it('generates .trae/.ignore', () => {
    const results = generateIgnore(makeCanonical({ ignore: ['node_modules', '.env'] }));

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(TRAE_IGNORE);
    expect(results[0].content).toBe('node_modules\n.env');
  });

  it('returns empty for empty ignore list', () => {
    expect(generateIgnore(makeCanonical())).toHaveLength(0);
  });
});

describe('generateCommands (trae)', () => {
  it('generates .trae/commands/{name}.md for each command', () => {
    const canonical = makeCanonical({
      commands: [
        {
          name: 'review',
          description: 'Code review',
          body: 'Review this code.',
          source: '/proj/.agentsmesh/commands/review.md',
        },
      ],
    });
    const results = generateCommands(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${TRAE_COMMANDS_DIR}/review.md`);
    expect(results[0].content).toContain('Review this code.');
  });

  it('includes description in frontmatter when present', () => {
    const canonical = makeCanonical({
      commands: [
        {
          name: 'test',
          description: 'Run tests',
          body: 'Run all tests.',
          source: '/proj/.agentsmesh/commands/test.md',
        },
      ],
    });
    const results = generateCommands(canonical);
    const { frontmatter } = parseFrontmatter(results[0].content);
    expect(frontmatter.description).toBe('Run tests');
  });

  it('emits empty body when command body is blank', () => {
    const canonical = makeCanonical({
      commands: [
        {
          name: 'noop',
          description: 'Does nothing',
          body: '   \n  ',
          source: '/proj/.agentsmesh/commands/noop.md',
        },
      ],
    });
    const results = generateCommands(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${TRAE_COMMANDS_DIR}/noop.md`);
    const { frontmatter, body } = parseFrontmatter(results[0].content);
    expect(frontmatter.description).toBe('Does nothing');
    expect(body.trim()).toBe('');
  });

  it('omits description frontmatter when description is empty', () => {
    const canonical = makeCanonical({
      commands: [
        {
          name: 'bare',
          description: '',
          body: 'Run it.',
          source: '/proj/.agentsmesh/commands/bare.md',
        },
      ],
    });
    const results = generateCommands(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].content).not.toContain('description:');
    expect(results[0].content).toContain('Run it.');
  });

  it('returns empty array when no commands', () => {
    expect(generateCommands(makeCanonical())).toHaveLength(0);
  });
});

describe('generateAgents (trae)', () => {
  it('generates .trae/agents/{name}.md for each agent', () => {
    const canonical = makeCanonical({
      agents: [
        {
          name: 'code-reviewer',
          description: 'Reviews code quality',
          tools: [],
          model: '',
          body: 'You are a code reviewer.',
          hooks: { PreToolUse: [] },
          source: '/proj/.agentsmesh/agents/code-reviewer.md',
        },
      ],
    });

    const results = generateAgents(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${TRAE_AGENTS_DIR}/code-reviewer.md`);
  });

  it('serializes name and description in frontmatter', () => {
    const canonical = makeCanonical({
      agents: [
        {
          name: 'researcher',
          description: 'Research assistant',
          tools: [],
          model: '',
          body: 'Research thoroughly.',
          hooks: { PreToolUse: [] },
          source: '/proj/.agentsmesh/agents/researcher.md',
        },
      ],
    });

    const results = generateAgents(canonical);
    const { frontmatter } = parseFrontmatter(results[0].content);

    expect(frontmatter.name).toBe('researcher');
    expect(frontmatter.description).toBe('Research assistant');
  });

  it('includes tools in frontmatter when non-empty', () => {
    const canonical = makeCanonical({
      agents: [
        {
          name: 'builder',
          description: 'Build agent',
          tools: ['Bash', 'Read'],
          model: '',
          body: 'Build things.',
          hooks: { PreToolUse: [] },
          source: '/proj/.agentsmesh/agents/builder.md',
        },
      ],
    });

    const results = generateAgents(canonical);
    const { frontmatter } = parseFrontmatter(results[0].content);

    expect(frontmatter.tools).toEqual(['Bash', 'Read']);
  });

  it('omits tools from frontmatter when empty', () => {
    const canonical = makeCanonical({
      agents: [
        {
          name: 'simple',
          description: 'Simple agent',
          tools: [],
          model: '',
          body: 'Do work.',
          hooks: { PreToolUse: [] },
          source: '/proj/.agentsmesh/agents/simple.md',
        },
      ],
    });

    const results = generateAgents(canonical);
    const { frontmatter } = parseFrontmatter(results[0].content);

    expect(frontmatter.tools).toBeUndefined();
  });

  it('includes model in frontmatter when set', () => {
    const canonical = makeCanonical({
      agents: [
        {
          name: 'smart',
          description: 'Smart agent',
          tools: [],
          model: 'claude-opus-4',
          body: 'Think deep.',
          hooks: { PreToolUse: [] },
          source: '/proj/.agentsmesh/agents/smart.md',
        },
      ],
    });

    const results = generateAgents(canonical);
    const { frontmatter } = parseFrontmatter(results[0].content);

    expect(frontmatter.model).toBe('claude-opus-4');
  });

  it('omits model from frontmatter when empty string', () => {
    const canonical = makeCanonical({
      agents: [
        {
          name: 'nomodel',
          description: 'No model agent',
          tools: [],
          model: '',
          body: 'Run.',
          hooks: { PreToolUse: [] },
          source: '/proj/.agentsmesh/agents/nomodel.md',
        },
      ],
    });

    const results = generateAgents(canonical);
    const { frontmatter } = parseFrontmatter(results[0].content);

    expect(frontmatter.model).toBeUndefined();
  });

  it('trims body whitespace', () => {
    const canonical = makeCanonical({
      agents: [
        {
          name: 'trimmer',
          description: '',
          tools: [],
          model: '',
          body: '\n\nDo the work.\n\n',
          hooks: { PreToolUse: [] },
          source: '/proj/.agentsmesh/agents/trimmer.md',
        },
      ],
    });

    const results = generateAgents(canonical);
    const { body } = parseFrontmatter(results[0].content);

    expect(body.trim()).toBe('Do the work.');
  });

  it('returns empty array when agents list is empty', () => {
    expect(generateAgents(makeCanonical())).toHaveLength(0);
  });
});

describe('generateHooks (trae)', () => {
  it('returns empty array when hooks is null', () => {
    expect(generateHooks(makeCanonical({ hooks: null }))).toHaveLength(0);
  });

  it('returns empty array when all hook events have no command entries', () => {
    expect(generateHooks(makeCanonical({ hooks: { PreToolUse: [] } }))).toHaveLength(0);
  });

  it('generates .trae/hooks.json with version:1 and command entry', () => {
    const results = generateHooks(
      makeCanonical({
        hooks: {
          PreToolUse: [{ matcher: '.*', command: 'echo pre', timeout: 30 }],
        },
      }),
    );

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(TRAE_HOOKS_FILE);

    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    expect(parsed.version).toBe(1);
    const hooks = parsed.hooks as Record<string, unknown[]>;
    expect(Array.isArray(hooks['PreToolUse'])).toBe(true);
    const entry = hooks['PreToolUse']![0] as Record<string, unknown>;
    expect(entry.matcher).toBe('.*');
    expect(entry.type).toBe('command');
    expect(entry.command).toBe('echo pre');
    expect(entry.timeout).toBe(30);
  });

  it('includes multiple events in hooks output', () => {
    const results = generateHooks(
      makeCanonical({
        hooks: {
          PreToolUse: [{ matcher: '*', command: 'echo pre' }],
          PostToolUse: [{ matcher: '*', command: 'echo post' }],
        },
      }),
    );

    expect(results).toHaveLength(1);
    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    const hooks = parsed.hooks as Record<string, unknown[]>;
    expect(Object.keys(hooks).sort()).toEqual(['PostToolUse', 'PreToolUse']);
  });

  it('omits timeout when not set', () => {
    const results = generateHooks(
      makeCanonical({
        hooks: { PreToolUse: [{ matcher: '*', command: 'echo hi' }] },
      }),
    );

    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    const hooks = parsed.hooks as Record<string, unknown[]>;
    const entry = hooks['PreToolUse']![0] as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(entry, 'timeout')).toBe(false);
  });

  it('drops prompt-type hook entries (command-only round-trip)', () => {
    const results = generateHooks(
      makeCanonical({
        hooks: {
          PreToolUse: [{ matcher: '*', command: '', type: 'prompt', prompt: 'Summarize' }],
        },
      }),
    );

    expect(results).toHaveLength(0);
  });
});

import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateSkills,
  generateMcp,
  generateIgnore,
} from '../../../../src/targets/qwen-code/generator.js';
import {
  QWEN_ROOT,
  QWEN_RULES_DIR,
  QWEN_COMMANDS_DIR,
  QWEN_AGENTS_DIR,
  QWEN_SKILLS_DIR,
  QWEN_SETTINGS,
  QWEN_IGNORE,
} from '../../../../src/targets/qwen-code/constants.js';

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

describe('generateRules (qwen-code)', () => {
  it('generates QWEN.md from root rule', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root\n\nUse TDD and strict TypeScript.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(QWEN_ROOT);
    expect(results[0].content).toContain('Use TDD and strict TypeScript.');
  });

  it('generates non-root rule to .qwen/rules/<slug>.md', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/typescript.md',
          root: false,
          targets: [],
          description: 'TypeScript standards',
          globs: ['src/**/*.ts'],
          body: 'Use strict mode.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${QWEN_RULES_DIR}/typescript.md`);
    expect(results[0].content).toContain('Use strict mode.');
  });

  it('generates both QWEN.md (root) and .qwen/rules/<slug>.md (non-root)', () => {
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
          description: 'Security rules',
          globs: [],
          body: 'No hardcoded secrets.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(2);
    expect(results[0].path).toBe(QWEN_ROOT);
    expect(results[1].path).toBe(`${QWEN_RULES_DIR}/security.md`);
  });

  it('filters out rules targeted to other tools', () => {
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
          source: '/proj/.agentsmesh/rules/cursor-only.md',
          root: false,
          targets: ['cursor'],
          description: 'Cursor-specific',
          globs: [],
          body: 'Cursor only.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(QWEN_ROOT);
    expect(results[0].content).not.toContain('Cursor only.');
  });

  it('returns empty when no rules exist', () => {
    const results = generateRules(makeCanonical({ rules: [] }));
    expect(results).toHaveLength(0);
  });
});

describe('generateCommands (qwen-code)', () => {
  it('generates .qwen/commands/<name>.md from canonical command', () => {
    const canonical = makeCanonical({
      commands: [
        {
          name: 'review',
          description: 'Review the current file for issues',
          allowedTools: ['Read', 'Bash'],
          body: 'Read the file and review it.',
        },
      ],
    });

    const results = generateCommands(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${QWEN_COMMANDS_DIR}/review.md`);
    expect(results[0].content).toContain('Review the current file for issues');
    expect(results[0].content).toContain('Read the file and review it.');
  });

  it('generates multiple commands as separate files', () => {
    const canonical = makeCanonical({
      commands: [
        {
          name: 'review',
          description: 'Review code',
          allowedTools: [],
          body: 'Review.',
        },
        {
          name: 'refactor',
          description: 'Refactor code',
          allowedTools: [],
          body: 'Refactor.',
        },
      ],
    });

    const results = generateCommands(canonical);

    expect(results).toHaveLength(2);
    expect(results[0].path).toBe(`${QWEN_COMMANDS_DIR}/review.md`);
    expect(results[1].path).toBe(`${QWEN_COMMANDS_DIR}/refactor.md`);
  });

  it('returns empty when no commands exist', () => {
    const results = generateCommands(makeCanonical({ commands: [] }));
    expect(results).toHaveLength(0);
  });
});

describe('generateAgents (qwen-code)', () => {
  it('generates .qwen/agents/<name>.md from canonical agent', () => {
    const canonical = makeCanonical({
      agents: [
        {
          name: 'researcher',
          description: 'Research agent',
          tools: ['WebSearch'],
          disallowedTools: [],
          model: '',
          permissionMode: '',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'You are a researcher.',
        },
      ],
    });

    const results = generateAgents(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${QWEN_AGENTS_DIR}/researcher.md`);
    expect(results[0].content).toContain('You are a researcher.');
  });

  it('returns empty when no agents exist', () => {
    const results = generateAgents(makeCanonical({ agents: [] }));
    expect(results).toHaveLength(0);
  });
});

describe('generateSkills (qwen-code)', () => {
  it('generates .qwen/skills/<name>/SKILL.md and supporting files', () => {
    const canonical = makeCanonical({
      skills: [
        {
          name: 'api-generator',
          source: '/proj/.agentsmesh/skills/api-generator/SKILL.md',
          description: 'Generate REST API endpoints',
          body: '# API Generator\n\nUse this for REST endpoints.',
          supportingFiles: [
            {
              relativePath: 'references/checklist.md',
              content: '# API Checklist\n\n- Define routes',
            },
          ],
        },
      ],
    });

    const results = generateSkills(canonical);

    expect(results).toHaveLength(2);
    expect(results[0].path).toBe(`${QWEN_SKILLS_DIR}/api-generator/SKILL.md`);
    expect(results[0].content).toContain('api-generator');
    expect(results[0].content).toContain('Generate REST API endpoints');
    expect(results[1].path).toBe(`${QWEN_SKILLS_DIR}/api-generator/references/checklist.md`);
    expect(results[1].content).toContain('API Checklist');
  });

  it('returns empty when no skills exist', () => {
    const results = generateSkills(makeCanonical({ skills: [] }));
    expect(results).toHaveLength(0);
  });
});

describe('generateMcp (qwen-code)', () => {
  it('generates .qwen/settings.json with mcpServers', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          context7: {
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp'],
          },
        },
      },
    });

    const results = generateMcp(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(QWEN_SETTINGS);
    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    expect(parsed).toHaveProperty('mcpServers');
    const servers = parsed['mcpServers'] as Record<string, unknown>;
    expect(Object.keys(servers)).toContain('context7');
  });

  it('returns empty when no MCP config exists', () => {
    const results = generateMcp(makeCanonical({ mcp: null }));
    expect(results).toHaveLength(0);
  });

  it('returns empty when mcpServers is empty', () => {
    const results = generateMcp(makeCanonical({ mcp: { mcpServers: {} } }));
    expect(results).toHaveLength(0);
  });
});

describe('generateIgnore (qwen-code)', () => {
  it('generates .qwenignore from canonical ignore patterns', () => {
    const canonical = makeCanonical({
      ignore: ['.env', 'node_modules/', 'dist/'],
    });

    const results = generateIgnore(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(QWEN_IGNORE);
    expect(results[0].content).toContain('.env');
    expect(results[0].content).toContain('node_modules/');
    expect(results[0].content).toContain('dist/');
  });

  it('returns empty when no ignore patterns exist', () => {
    const results = generateIgnore(makeCanonical({ ignore: [] }));
    expect(results).toHaveLength(0);
  });
});

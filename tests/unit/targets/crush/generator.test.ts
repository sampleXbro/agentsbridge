import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateSkills,
  generateCommands,
  generateAgents,
  generateMcp,
  generateHooks,
  generatePermissions,
  generateIgnore,
} from '../../../../src/targets/crush/generator.js';
import {
  CRUSH_ROOT_FILE,
  CRUSH_SKILLS_DIR,
  CRUSH_CONFIG_FILE,
  CRUSH_IGNORE,
} from '../../../../src/targets/crush/constants.js';

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

describe('generateRules (crush)', () => {
  it('generates AGENTS.md for root rule', () => {
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
    expect(results[0].path).toBe(CRUSH_ROOT_FILE);
    expect(results[0].content).toContain('Use TDD and strict TypeScript.');
    expect(results[0].content).not.toMatch(/^---\n/);
  });

  it('embeds non-root rules in AGENTS.md', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root instructions',
        },
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
    expect(results[0].path).toBe(CRUSH_ROOT_FILE);
    expect(results[0].content).toContain('# Root instructions');
    expect(results[0].content).toContain('Use strict mode.');
  });

  it('filters rules targeted to other tools', () => {
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
          body: 'Only for Cursor.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].content).not.toContain('Only for Cursor.');
  });

  it('includes rules explicitly targeted to crush', () => {
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
          source: '/proj/.agentsmesh/rules/crush-only.md',
          root: false,
          targets: ['crush'],
          description: 'Crush-specific',
          globs: [],
          body: 'Only for Crush.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('Only for Crush.');
  });

  it('returns empty when root rule body is only whitespace', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '   \n  \t  \n  ',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(0);
  });

  it('returns empty when no rules exist', () => {
    const canonical = makeCanonical({ rules: [] });
    const results = generateRules(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateSkills (crush)', () => {
  it('generates skills to .crush/skills/', () => {
    const canonical = makeCanonical({
      skills: [
        {
          name: 'api-generator',
          source: '/proj/.agentsmesh/skills/api-generator/SKILL.md',
          description: 'Generate REST API endpoints',
          body: '## Purpose\n\nGenerate well-structured REST APIs.',
          supportingFiles: [
            {
              relativePath: 'references/checklist.md',
              content: '# Checklist\n\n- Validate inputs',
            },
          ],
        },
      ],
    });

    const results = generateSkills(canonical);

    expect(results).toHaveLength(2);
    expect(results[0].path).toBe(`${CRUSH_SKILLS_DIR}/api-generator/SKILL.md`);
    expect(results[0].content).toContain('name:');
    expect(results[0].content).toContain('description:');
    expect(results[0].content).toContain('Generate REST API endpoints');
    expect(results[1].path).toBe(`${CRUSH_SKILLS_DIR}/api-generator/references/checklist.md`);
    expect(results[1].content).toContain('Validate inputs');
  });

  it('returns empty when no skills exist', () => {
    const canonical = makeCanonical({ skills: [] });
    const results = generateSkills(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateCommands (crush)', () => {
  it('projects commands as skills in .crush/skills/', () => {
    const canonical = makeCanonical({
      commands: [
        {
          name: 'review',
          source: '/proj/.agentsmesh/commands/review.md',
          description: 'Review code changes',
          body: 'Run code review.',
          allowedTools: ['Bash', 'Read'],
        },
      ],
    });

    const results = generateCommands(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toContain(CRUSH_SKILLS_DIR);
    expect(results[0].path).toContain('SKILL.md');
    expect(results[0].content).toContain('review');
    const cmd = results.find((r) => r.path.endsWith('SKILL.md'));
    expect(cmd!.content).toContain('x-agentsmesh-kind: command');
    expect(cmd!.content).toContain('x-agentsmesh-name:');
    expect(cmd!.content).toContain('description:');
    expect(cmd!.content).toContain('- Read');
  });

  it('returns empty when no commands exist', () => {
    const canonical = makeCanonical({ commands: [] });
    const results = generateCommands(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateAgents (crush)', () => {
  it('projects agents as skills in .crush/skills/', () => {
    const canonical = makeCanonical({
      agents: [
        {
          name: 'researcher',
          source: '/proj/.agentsmesh/agents/researcher.md',
          description: 'Research agent',
          body: 'Research topics thoroughly.',
          tools: ['WebSearch'],
          disallowedTools: [],
          model: 'claude-sonnet',
          permissionMode: '',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
        },
      ],
    });

    const results = generateAgents(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toContain(CRUSH_SKILLS_DIR);
    expect(results[0].path).toContain('SKILL.md');
    expect(results[0].content).toContain('researcher');
    const agent = results.find((r) => r.path.endsWith('SKILL.md'));
    expect(agent!.content).toContain('x-agentsmesh-kind: agent');
    expect(agent!.content).toContain('x-agentsmesh-name:');
    expect(agent!.content).toContain('description:');
    expect(agent!.content).toContain('x-agentsmesh-tools:');
    expect(agent!.content).toContain('x-agentsmesh-model:');
  });

  it('returns empty when no agents exist', () => {
    const canonical = makeCanonical({ agents: [] });
    const results = generateAgents(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateMcp (crush)', () => {
  it('generates crush.json with mcp key format', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          filesystem: {
            type: 'stdio',
            command: 'node',
            args: ['/path/to/server.js'],
            env: {},
          },
        },
      },
    });

    const results = generateMcp(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(CRUSH_CONFIG_FILE);
    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    expect(parsed).toHaveProperty('mcp');
    expect(parsed).toHaveProperty('$schema');
    const mcp = parsed['mcp'] as Record<string, unknown>;
    expect(mcp).toHaveProperty('filesystem');
  });

  it('returns empty when no MCP config exists', () => {
    const canonical = makeCanonical({ mcp: null });
    const results = generateMcp(canonical);
    expect(results).toHaveLength(0);
  });

  it('returns empty when mcpServers is empty', () => {
    const canonical = makeCanonical({ mcp: { mcpServers: {} } });
    const results = generateMcp(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateHooks (crush)', () => {
  it('generates crush.json with hooks in PreToolUse format', () => {
    const canonical = makeCanonical({
      hooks: {
        PreToolUse: [
          {
            matcher: '^bash$',
            command: '.crush/hooks/protect.sh',
            timeout: 10,
          },
        ],
      },
    });

    const results = generateHooks(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(CRUSH_CONFIG_FILE);
    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    expect(parsed).toHaveProperty('hooks');
    const hooks = parsed['hooks'] as Record<string, unknown>;
    expect(hooks).toHaveProperty('PreToolUse');
    const preToolUse = hooks['PreToolUse'] as Array<Record<string, unknown>>;
    expect(preToolUse).toHaveLength(1);
    expect(preToolUse[0]).toMatchObject({
      matcher: '^bash$',
      command: '.crush/hooks/protect.sh',
      timeout: 10,
    });
  });

  it('returns empty when no hooks exist', () => {
    const canonical = makeCanonical({ hooks: null });
    const results = generateHooks(canonical);
    expect(results).toHaveLength(0);
  });

  it('skips hooks with empty command', () => {
    const canonical = makeCanonical({
      hooks: {
        PreToolUse: [
          {
            matcher: '^bash$',
            command: '',
          },
        ],
      },
    });

    const results = generateHooks(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generatePermissions (crush)', () => {
  it('generates crush.json with allowed_tools', () => {
    const canonical = makeCanonical({
      permissions: {
        allow: ['view', 'ls', 'grep'],
        deny: [],
        ask: [],
      },
    });

    const results = generatePermissions(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(CRUSH_CONFIG_FILE);
    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    expect(parsed).toHaveProperty('permissions');
    const permissions = parsed['permissions'] as Record<string, unknown>;
    expect(permissions['allowed_tools']).toEqual(['view', 'ls', 'grep']);
  });

  it('generates crush.json with denied_tools', () => {
    const canonical = makeCanonical({
      permissions: {
        allow: [],
        deny: ['bash', 'write'],
        ask: [],
      },
    });

    const results = generatePermissions(canonical);

    expect(results).toHaveLength(1);
    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    const permissions = parsed['permissions'] as Record<string, unknown>;
    expect(permissions['denied_tools']).toEqual(['bash', 'write']);
  });

  it('returns empty when no permissions exist', () => {
    const canonical = makeCanonical({ permissions: null });
    const results = generatePermissions(canonical);
    expect(results).toHaveLength(0);
  });

  it('returns empty when permissions are empty', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: [], ask: [] },
    });
    const results = generatePermissions(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateIgnore (crush)', () => {
  it('generates .crushignore with patterns', () => {
    const canonical = makeCanonical({
      ignore: ['node_modules/', 'dist/', '*.log'],
    });

    const results = generateIgnore(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(CRUSH_IGNORE);
    expect(results[0].content).toContain('node_modules/');
    expect(results[0].content).toContain('dist/');
    expect(results[0].content).toContain('*.log');
  });

  it('returns empty when no ignore patterns exist', () => {
    const canonical = makeCanonical({ ignore: [] });
    const results = generateIgnore(canonical);
    expect(results).toHaveLength(0);
  });
});

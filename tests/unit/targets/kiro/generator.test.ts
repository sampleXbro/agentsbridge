import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateSkills,
  generateCommands,
  generateAgents,
  generateMcp,
  generateHooks,
  generateIgnore,
} from '../../../../src/targets/kiro/generator.js';
import {
  KIRO_AGENTS_MD,
  KIRO_STEERING_DIR,
  KIRO_SKILLS_DIR,
  KIRO_AGENTS_DIR,
  KIRO_MCP_FILE,
  KIRO_HOOKS_DIR,
  KIRO_IGNORE,
} from '../../../../src/targets/kiro/constants.js';

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

describe('generateRules (kiro)', () => {
  it('generates AGENTS.md for the root rule', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: 'Workspace defaults',
          globs: [],
          body: '# Root\n\nUse TDD.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(KIRO_AGENTS_MD);
    expect(results[0].content).toContain('Use TDD.');
  });

  it('generates non-root rules in .kiro/steering with Kiro inclusion frontmatter', () => {
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
    const steeringRule = results.find(
      (result) => result.path === `${KIRO_STEERING_DIR}/typescript.md`,
    );

    expect(steeringRule).toBeDefined();
    expect(steeringRule?.content).toContain('inclusion: fileMatch');
    expect(steeringRule?.content).toContain('fileMatchPattern: src/**/*.ts');
    expect(steeringRule?.content).toContain('description: TypeScript rules');
    expect(steeringRule?.content).toContain('Use strict TypeScript.');
  });

  it('maps manual rules to manual steering files', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/review.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          trigger: 'manual',
          body: 'Review carefully.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results[0]?.content).toContain('inclusion: manual');
    expect(results[0]?.path).toBe(`${KIRO_STEERING_DIR}/review.md`);
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

    expect(generateRules(canonical)).toEqual([]);
  });
});

describe('generateSkills (kiro)', () => {
  it('generates Kiro skill folders with supporting files', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/debugging/SKILL.md',
          name: 'debugging',
          description: 'Debug production failures',
          body: '# Debugging\n\nStart with logs.',
          supportingFiles: [
            {
              relativePath: 'references/checklist.md',
              absolutePath: '/proj/.agentsmesh/skills/debugging/references/checklist.md',
              content: '# Checklist',
            },
          ],
        },
      ],
    });

    const results = generateSkills(canonical);

    expect(results.some((result) => result.path === `${KIRO_SKILLS_DIR}/debugging/SKILL.md`)).toBe(
      true,
    );
    expect(
      results.some(
        (result) => result.path === `${KIRO_SKILLS_DIR}/debugging/references/checklist.md`,
      ),
    ).toBe(true);
    const skillMd = results.find((result) => result.path.endsWith('SKILL.md'));
    expect(skillMd!.content).toContain('name:');
    expect(skillMd!.content).toContain('description:');
  });
});

describe('generateCommands (kiro)', () => {
  it('projects commands as skill bundles with command frontmatter', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/proj/.agentsmesh/commands/review.md',
          name: 'review',
          description: 'Review code changes',
          allowedTools: ['Read', 'Grep', 'Bash(git diff)'],
          body: 'Review the current diff.',
        },
      ],
    });

    const results = generateCommands(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${KIRO_SKILLS_DIR}/am-command-review/SKILL.md`);
    expect(results[0].content).toContain('x-agentsmesh-kind: command');
    expect(results[0].content).toContain('x-agentsmesh-name: review');
    expect(results[0].content).toContain('name: am-command-review');
    expect(results[0].content).toContain('description: Review code changes');
    expect(results[0].content).toContain('x-agentsmesh-allowed-tools:');
    expect(results[0].content).toContain('- Read');
    expect(results[0].content).toContain('Review the current diff.');
  });

  it('returns empty when no commands exist', () => {
    expect(generateCommands(makeCanonical())).toHaveLength(0);
  });
});

describe('generateAgents (kiro)', () => {
  it('generates agent files with native frontmatter in .kiro/agents/', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/reviewer.md',
          name: 'reviewer',
          description: 'Reviews code for quality',
          tools: ['Read', 'Grep', 'Glob'],
          disallowedTools: [],
          model: 'sonnet',
          permissionMode: 'default',
          maxTurns: 10,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'You review code.',
        },
      ],
    });

    const results = generateAgents(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${KIRO_AGENTS_DIR}/reviewer.md`);
    expect(results[0].content).toContain('name: reviewer');
    expect(results[0].content).toContain('description: Reviews code for quality');
    expect(results[0].content).toContain('tools:');
    expect(results[0].content).toContain('model: sonnet');
    expect(results[0].content).toContain('You review code.');
    expect(results[0].content).not.toContain('x-agentsmesh-kind');
  });

  it('omits undefined optional fields from frontmatter', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsmesh/agents/simple.md',
          name: 'simple',
          description: 'A simple agent',
          tools: [],
          disallowedTools: [],
          model: '',
          permissionMode: '',
          maxTurns: 0,
          mcpServers: [],
          hooks: {},
          skills: [],
          memory: '',
          body: 'Do simple things.',
        },
      ],
    });

    const results = generateAgents(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(`${KIRO_AGENTS_DIR}/simple.md`);
    expect(results[0].content).toContain('name: simple');
    expect(results[0].content).toContain('description: A simple agent');
    expect(results[0].content).not.toContain('tools:');
    expect(results[0].content).not.toContain('model:');
  });

  it('returns empty when no agents exist', () => {
    expect(generateAgents(makeCanonical())).toHaveLength(0);
  });
});

describe('generateMcp (kiro)', () => {
  it('generates .kiro/settings/mcp.json', () => {
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
    expect(results[0].path).toBe(KIRO_MCP_FILE);
    expect(JSON.parse(results[0].content)).toHaveProperty('mcpServers.github');
  });
});

describe('generateHooks (kiro)', () => {
  it('generates askAgent hooks for prompt entries and shell hooks for command entries', () => {
    const canonical = makeCanonical({
      hooks: {
        UserPromptSubmit: [
          { matcher: '*', prompt: 'Capture intent before acting.', type: 'prompt' },
        ],
        PreToolUse: [{ matcher: 'write', command: 'pnpm lint', type: 'command' }],
      },
    });

    const results = generateHooks(canonical);
    const promptHook = results.find(
      (result) => result.path === `${KIRO_HOOKS_DIR}/user-prompt-submit-1.kiro.hook`,
    );
    const toolHook = results.find(
      (result) => result.path === `${KIRO_HOOKS_DIR}/pre-tool-use-1.kiro.hook`,
    );

    expect(promptHook).toBeDefined();
    expect(toolHook).toBeDefined();
    expect(JSON.parse(promptHook!.content)).toMatchObject({
      version: '1',
      when: { type: 'promptSubmit' },
      then: { type: 'askAgent', prompt: 'Capture intent before acting.' },
    });
    expect(JSON.parse(toolHook!.content)).toMatchObject({
      version: '1',
      when: { type: 'preToolUse', tools: ['write'] },
      then: { type: 'shellCommand', command: 'pnpm lint' },
    });
  });
});

describe('generateIgnore (kiro)', () => {
  it('generates .kiroignore', () => {
    const results = generateIgnore(makeCanonical({ ignore: ['.env', 'dist/'] }));

    expect(results).toEqual([{ path: KIRO_IGNORE, content: '.env\ndist/' }]);
  });
});

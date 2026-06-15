import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateCommands,
  generateSkills,
  generateAgents,
  generateMcp,
  generateHooks,
} from '../../../../src/targets/antigravity/generator.js';
import {
  ANTIGRAVITY_RULES_ROOT,
  ANTIGRAVITY_RULES_DIR,
  ANTIGRAVITY_WORKFLOWS_DIR,
  ANTIGRAVITY_SKILLS_DIR,
  ANTIGRAVITY_MCP_CONFIG,
  ANTIGRAVITY_HOOKS_FILE,
} from '../../../../src/targets/antigravity/constants.js';

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

describe('generateRules (antigravity)', () => {
  it('generates root rule as .agents/rules/general.md with plain body only', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: 'Root',
          globs: [],
          body: '# Project Rules\n\nUse TDD.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]?.path).toBe(ANTIGRAVITY_RULES_ROOT);
    expect(results[0]?.content).toContain('Use TDD.');
    expect(results[0]?.content).not.toContain('root: true');
    expect(results[0]?.content).not.toContain('---');
  });

  it('generates non-root rules as .agents/rules/{slug}.md with plain body', () => {
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
          body: 'Use strict TypeScript.',
        },
      ],
    });
    const results = generateRules(canonical);
    const tsRule = results.find((r) => r.path === `${ANTIGRAVITY_RULES_DIR}/typescript.md`);
    expect(tsRule).toBeDefined();
    expect(tsRule!.content).toContain('Use strict TypeScript.');
    expect(tsRule!.content).not.toContain('globs:');
  });

  it('skips non-root rules targeting other agents only', () => {
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
          description: '',
          globs: [],
          body: 'Cursor only.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results.some((r) => r.path.includes('cursor-only'))).toBe(false);
  });

  it('returns empty array when no root rule exists', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/typescript.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: 'Use TypeScript.',
        },
      ],
    });
    expect(generateRules(canonical)).toHaveLength(0);
  });
});

describe('generateCommands (antigravity)', () => {
  it('projects canonical commands into .agents/workflows/{name}.md as plain markdown', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/proj/.agentsmesh/commands/review.md',
          name: 'review',
          description: 'Review workflow',
          allowedTools: ['Read', 'Bash(git diff)'],
          body: 'Review the current diff.',
        },
      ],
    });
    const results = generateCommands(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]?.path).toBe(`${ANTIGRAVITY_WORKFLOWS_DIR}/review.md`);
    expect(results[0]?.content).toContain('Review the current diff.');
    expect(results[0]?.content).not.toContain('allowed-tools:');
    expect(results[0]?.content).not.toContain('x-agentsmesh');
  });

  it('returns empty array when no commands exist', () => {
    expect(generateCommands(makeCanonical())).toHaveLength(0);
  });

  it('includes description as intro when body does not start with it', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/proj/.agentsmesh/commands/test.md',
          name: 'test',
          description: 'Run tests before merging',
          allowedTools: [],
          body: '1. Run `pnpm test`\n2. Fix failures',
        },
      ],
    });
    const results = generateCommands(canonical);
    expect(results[0]?.content).toContain('Run tests before merging');
    expect(results[0]?.content).toContain('pnpm test');
  });
});

describe('generateSkills (antigravity)', () => {
  it('generates skills under .agents/skills with SKILL.md and supporting files', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/typescript-pro/SKILL.md',
          name: 'typescript-pro',
          description: 'Helps with advanced TypeScript work',
          body: 'Use advanced TypeScript patterns.',
          supportingFiles: [
            {
              absolutePath: '/proj/.agentsmesh/skills/typescript-pro/references/advanced-types.md',
              relativePath: 'references/advanced-types.md',
              content: '# Advanced Types',
            },
          ],
        },
      ],
    });
    const results = generateSkills(canonical);
    expect(results.map((r) => r.path).sort()).toEqual([
      `${ANTIGRAVITY_SKILLS_DIR}/typescript-pro/SKILL.md`,
      `${ANTIGRAVITY_SKILLS_DIR}/typescript-pro/references/advanced-types.md`,
    ]);
    const skillMd = results.find((r) => r.path.endsWith('SKILL.md'));
    expect(skillMd?.content).toContain('name: typescript-pro');
    expect(skillMd?.content).toContain('description: Helps with advanced TypeScript work');
    expect(skillMd?.content).toContain('Use advanced TypeScript patterns.');
  });

  it('returns empty array when no skills exist', () => {
    expect(generateSkills(makeCanonical())).toHaveLength(0);
  });
});

describe('generateAgents (antigravity)', () => {
  it('projects agents as skill bundles with projected agent frontmatter', () => {
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
    expect(results[0].path).toBe(`${ANTIGRAVITY_SKILLS_DIR}/am-agent-reviewer/SKILL.md`);
    expect(results[0].content).toContain('x-agentsmesh-kind: agent');
    expect(results[0].content).toContain('x-agentsmesh-name: reviewer');
    expect(results[0].content).toContain('name: am-agent-reviewer');
    expect(results[0].content).toContain('description: Reviews code for quality');
    expect(results[0].content).toContain('x-agentsmesh-tools:');
    expect(results[0].content).toContain('x-agentsmesh-model: sonnet');
    expect(results[0].content).toContain('You review code.');
  });

  it('returns empty array when no agents exist', () => {
    expect(generateAgents(makeCanonical())).toHaveLength(0);
  });
});

describe('generateMcp (antigravity)', () => {
  it('emits mcp_config.json with mcpServers key', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          context7: {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp'],
            env: {},
          },
        },
      },
    });
    const results = generateMcp(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(ANTIGRAVITY_MCP_CONFIG);
    const parsed = JSON.parse(results[0].content);
    expect(parsed).toEqual({
      mcpServers: {
        context7: { type: 'stdio', command: 'npx', args: ['-y', '@upstash/context7-mcp'], env: {} },
      },
    });
  });

  it('returns empty array when mcp is null', () => {
    const results = generateMcp(makeCanonical({ mcp: null }));
    expect(results).toEqual([]);
  });

  it('returns empty array when mcpServers is empty', () => {
    const results = generateMcp(makeCanonical({ mcp: { mcpServers: {} } }));
    expect(results).toEqual([]);
  });
});

describe('generateHooks (antigravity)', () => {
  it('returns [] when hooks is null', () => {
    expect(generateHooks(makeCanonical())).toHaveLength(0);
  });

  it('returns [] when hooks is empty', () => {
    expect(generateHooks(makeCanonical({ hooks: {} }))).toHaveLength(0);
  });

  it('emits .agents/hooks.json in Claude Code format', () => {
    const results = generateHooks(
      makeCanonical({
        hooks: { PreToolUse: [{ matcher: '*', command: 'echo hook', type: 'command' }] },
      }),
    );
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(ANTIGRAVITY_HOOKS_FILE);
    const parsed = JSON.parse(results[0].content) as Record<string, unknown>;
    expect(parsed.PreToolUse).toBeDefined();
  });
});

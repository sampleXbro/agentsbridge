import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateCommands,
  generateAgents,
  generateMcp,
  generateIgnore,
  generateSkills,
} from '../../../../src/targets/junie/generator.js';
import {
  JUNIE_DOT_AGENTS,
  JUNIE_COMMANDS_DIR,
  JUNIE_AGENTS_DIR,
  JUNIE_MCP_FILE,
  JUNIE_IGNORE,
  JUNIE_RULES_DIR,
  JUNIE_SKILLS_DIR,
} from '../../../../src/targets/junie/constants.js';

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

describe('generateRules (junie)', () => {
  it('generates root rule as .junie/AGENTS.md', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsbridge/rules/_root.md',
          root: true,
          targets: [],
          description: 'Root',
          globs: [],
          body: '# Guidelines\n\nUse TDD.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results.some((r) => r.path === JUNIE_DOT_AGENTS)).toBe(true);
    expect(results.find((r) => r.path === JUNIE_DOT_AGENTS)?.content).toContain('Use TDD.');
    expect(results).toHaveLength(1);
  });

  it('generates non-root rules as .junie/rules/{slug}.md', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsbridge/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root',
        },
        {
          source: '/proj/.agentsbridge/rules/typescript.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: 'Use strict TypeScript.',
        },
      ],
    });
    const results = generateRules(canonical);
    const tsRule = results.find((r) => r.path === `${JUNIE_RULES_DIR}/typescript.md`);
    expect(tsRule).toBeDefined();
    expect(tsRule!.content).toContain('Use strict TypeScript.');
  });

  it('skips non-root rules targeting other agents only', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsbridge/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: '# Root',
        },
        {
          source: '/proj/.agentsbridge/rules/cursor-only.md',
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
});

describe('generateCommands (junie)', () => {
  it('projects canonical commands into .junie/commands with frontmatter', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/proj/.agentsbridge/commands/review.md',
          name: 'review',
          description: 'Review workflow',
          allowedTools: ['Read', 'Bash(git diff)'],
          body: 'Review the current diff.',
        },
      ],
    });

    const results = generateCommands(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]?.path).toBe(`${JUNIE_COMMANDS_DIR}/review.md`);
    expect(results[0]?.content).not.toContain('description:');
    expect(results[0]?.content).not.toContain('allowed-tools:');
    expect(results[0]?.content).toContain('Review the current diff.');
  });
});

describe('generateAgents (junie)', () => {
  it('projects canonical agents into .junie/agents with frontmatter', () => {
    const canonical = makeCanonical({
      agents: [
        {
          source: '/proj/.agentsbridge/agents/code-reviewer.md',
          name: 'code-reviewer',
          description: 'Performs code reviews',
          tools: ['Read', 'Grep'],
          disallowedTools: [],
          model: 'gpt-5',
          permissionMode: 'default',
          maxTurns: 8,
          mcpServers: ['context7'],
          hooks: {},
          skills: ['api-generator'],
          memory: '',
          body: 'Review changes and call out risks.',
        },
      ],
    });

    const results = generateAgents(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]?.path).toBe(`${JUNIE_AGENTS_DIR}/code-reviewer.md`);
    expect(results[0]?.content).not.toContain('description:');
    expect(results[0]?.content).not.toContain('tools:');
    expect(results[0]?.content).not.toContain('model:');
    expect(results[0]?.content).toContain('Review changes and call out risks.');
  });
});

describe('generateMcp (junie)', () => {
  it('writes Junie project-level mcp.json', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          context7: { type: 'stdio', command: 'npx', args: ['-y', '@ctx/mcp'], env: {} },
        },
      },
    });

    const results = generateMcp(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]?.path).toBe(JUNIE_MCP_FILE);
    expect(results[0]?.content).toContain('context7');
  });
});

describe('generateIgnore (junie)', () => {
  it('writes .aiignore from canonical ignore patterns', () => {
    const results = generateIgnore(makeCanonical({ ignore: ['.env', 'node_modules/'] }));
    expect(results).toHaveLength(1);
    expect(results[0]?.path).toBe(JUNIE_IGNORE);
    expect(results[0]?.content).toContain('.env');
  });
});

describe('generateSkills (junie)', () => {
  it('projects canonical skills into .junie/skills with supporting files', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsbridge/skills/api-generator/SKILL.md',
          name: 'api-generator',
          description: 'API Generator',
          body: 'Use `references/route-checklist.md`.',
          supportingFiles: [
            {
              absolutePath:
                '/proj/.agentsbridge/skills/api-generator/references/route-checklist.md',
              relativePath: 'references/route-checklist.md',
              content: '# Checklist',
            },
          ],
        },
      ],
    });

    const results = generateSkills(canonical);
    expect(results.map((result) => result.path).sort()).toEqual([
      `${JUNIE_SKILLS_DIR}/api-generator/SKILL.md`,
      `${JUNIE_SKILLS_DIR}/api-generator/references/route-checklist.md`,
    ]);
  });
});

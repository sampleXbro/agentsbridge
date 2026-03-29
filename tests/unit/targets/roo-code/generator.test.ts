import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateCommands,
  generateMcp,
  generateIgnore,
  generateSkills,
} from '../../../../src/targets/roo-code/generator.js';
import {
  ROO_CODE_ROOT_RULE,
  ROO_CODE_RULES_DIR,
  ROO_CODE_COMMANDS_DIR,
  ROO_CODE_MCP_FILE,
  ROO_CODE_IGNORE,
  ROO_CODE_SKILLS_DIR,
} from '../../../../src/targets/roo-code/constants.js';

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

describe('generateRules (roo-code)', () => {
  it('generates root rule as .roo/rules/00-root.md', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: 'Root instructions',
          globs: [],
          body: '# Root\n\nUse TDD.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(ROO_CODE_ROOT_RULE);
    expect(results[0].content).toContain('Use TDD.');
  });

  it('generates non-root rules as .roo/rules/{slug}.md', () => {
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
    const tsRule = results.find((r) => r.path === `${ROO_CODE_RULES_DIR}/typescript.md`);
    expect(tsRule).toBeDefined();
    expect(tsRule?.content).toContain('Use strict TypeScript.');
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
          body: 'Claude only rule.',
        },
        {
          source: '/proj/.agentsmesh/rules/roo-only.md',
          root: false,
          targets: ['roo-code'],
          description: '',
          globs: [],
          body: 'Roo only rule.',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results).toHaveLength(2);
    expect(results.some((r) => r.path.includes('claude-only'))).toBe(false);
    expect(results.some((r) => r.path.includes('roo-only'))).toBe(true);
  });

  it('returns empty array when no rules', () => {
    expect(generateRules(makeCanonical())).toEqual([]);
  });
});

describe('generateCommands (roo-code)', () => {
  it('generates command files in .roo/commands/', () => {
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
    expect(results[0].path).toBe(`${ROO_CODE_COMMANDS_DIR}/review.md`);
    expect(results[0].content).toContain('Review all changed files.');
  });

  it('includes description in command frontmatter', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/proj/.agentsmesh/commands/test.md',
          name: 'test',
          description: 'Run tests',
          allowedTools: [],
          body: 'Run all tests.',
        },
      ],
    });
    const results = generateCommands(canonical);
    expect(results[0].content).toContain('description: Run tests');
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

  it('returns empty array when no commands', () => {
    expect(generateCommands(makeCanonical())).toEqual([]);
  });
});

describe('generateMcp (roo-code)', () => {
  it('generates .roo/mcp.json', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          'my-server': {
            type: 'stdio',
            command: 'node',
            args: ['server.js'],
            env: {},
          },
        },
      },
    });
    const results = generateMcp(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(ROO_CODE_MCP_FILE);
    const parsed = JSON.parse(results[0].content) as { mcpServers: Record<string, unknown> };
    expect(parsed.mcpServers['my-server']).toBeDefined();
  });

  it('returns empty array when mcp is null', () => {
    expect(generateMcp(makeCanonical())).toEqual([]);
  });

  it('returns empty array when mcpServers is empty', () => {
    expect(generateMcp(makeCanonical({ mcp: { mcpServers: {} } }))).toEqual([]);
  });
});

describe('generateIgnore (roo-code)', () => {
  it('generates .rooignore', () => {
    const canonical = makeCanonical({ ignore: ['.env', 'node_modules/'] });
    const results = generateIgnore(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(ROO_CODE_IGNORE);
    expect(results[0].content).toBe('.env\nnode_modules/');
  });

  it('returns empty array when no ignore patterns', () => {
    expect(generateIgnore(makeCanonical())).toEqual([]);
  });
});

describe('generateSkills (roo-code)', () => {
  it('generates skill SKILL.md in .roo/skills/', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/typescript-pro/SKILL.md',
          name: 'typescript-pro',
          description: 'Advanced TypeScript patterns',
          body: '# TypeScript Pro\n\nUse advanced types.',
          supportingFiles: [],
        },
      ],
    });
    const results = generateSkills(canonical);
    expect(results.some((r) => r.path === `${ROO_CODE_SKILLS_DIR}/typescript-pro/SKILL.md`)).toBe(
      true,
    );
  });

  it('includes supporting files', () => {
    const canonical = makeCanonical({
      skills: [
        {
          source: '/proj/.agentsmesh/skills/typescript-pro/SKILL.md',
          name: 'typescript-pro',
          description: 'Advanced TypeScript patterns',
          body: '# TypeScript Pro',
          supportingFiles: [
            {
              relativePath: 'references/advanced-types.md',
              absolutePath: '/proj/.agentsmesh/skills/typescript-pro/references/advanced-types.md',
              content: '# Advanced Types',
            },
          ],
        },
      ],
    });
    const results = generateSkills(canonical);
    expect(
      results.some(
        (r) => r.path === `${ROO_CODE_SKILLS_DIR}/typescript-pro/references/advanced-types.md`,
      ),
    ).toBe(true);
  });
});

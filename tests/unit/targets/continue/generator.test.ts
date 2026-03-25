import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateCommands,
  generateMcp,
  generateSkills,
} from '../../../../src/targets/continue/generator.js';
import {
  CONTINUE_MCP_FILE,
  CONTINUE_PROMPTS_DIR,
  CONTINUE_RULES_DIR,
  CONTINUE_SKILLS_DIR,
} from '../../../../src/targets/continue/constants.js';

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

describe('generateRules (continue)', () => {
  it('generates root and scoped rules in .continue/rules', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsbridge/rules/_root.md',
          root: true,
          targets: [],
          description: 'Project standards',
          globs: [],
          body: '# Standards\n\nUse TDD.',
        },
        {
          source: '/proj/.agentsbridge/rules/typescript.md',
          root: false,
          targets: [],
          description: 'TypeScript rules',
          globs: ['src/**/*.ts'],
          body: 'Use strict TypeScript.',
        },
      ],
    });

    const results = generateRules(canonical);
    expect(results).toHaveLength(2);
    expect(results.map((result) => result.path).sort()).toEqual([
      `${CONTINUE_RULES_DIR}/_root.md`,
      `${CONTINUE_RULES_DIR}/typescript.md`,
    ]);
    expect(results[0]?.content).not.toContain('root:');
    expect(results[1]?.content).toContain('globs:');
  });

  it('skips non-root rules that target other tools and omits empty frontmatter', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/proj/.agentsbridge/rules/backend.md',
          root: false,
          targets: ['claude-code'],
          description: 'Backend only',
          globs: ['src/**/*.ts'],
          body: 'Use strict TypeScript.',
        },
        {
          source: '/proj/.agentsbridge/rules/frontend.md',
          root: false,
          targets: ['continue'],
          description: '',
          globs: [],
          body: 'Use Tailwind utilities sparingly.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toEqual([
      {
        path: `${CONTINUE_RULES_DIR}/frontend.md`,
        content: 'Use Tailwind utilities sparingly.',
      },
    ]);
  });
});

describe('generateCommands (continue)', () => {
  it('projects commands as prompt files in .continue/prompts/ without invokable flag', () => {
    const canonical = makeCanonical({
      commands: [
        {
          source: '/proj/.agentsbridge/commands/review.md',
          name: 'review',
          description: 'Review current changes',
          allowedTools: ['Read', 'Bash(git diff)'],
          body: 'Review the current diff for risk.',
        },
      ],
    });

    const results = generateCommands(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]?.path).toBe(`${CONTINUE_PROMPTS_DIR}/review.md`);
    expect(results[0]?.content).not.toContain('invokable:');
    expect(results[0]?.content).toContain('x-agentsbridge-kind: command');
    expect(results[0]?.content).toContain('x-agentsbridge-allowed-tools:');
  });
});

describe('generateMcp (continue)', () => {
  it('writes project mcp servers into .continue/mcpServers/agentsbridge.json', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          context7: { type: 'stdio', command: 'npx', args: ['-y', '@ctx/mcp'], env: {} },
        },
      },
    });

    const results = generateMcp(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]?.path).toBe(CONTINUE_MCP_FILE);
    expect(results[0]?.content).toContain('context7');
    expect(results[0]?.content).toContain('@ctx/mcp');
  });

  it('returns no MCP output when canonical MCP is missing or empty', () => {
    expect(generateMcp(makeCanonical())).toEqual([]);
    expect(
      generateMcp(
        makeCanonical({
          mcp: {
            mcpServers: {},
          },
        }),
      ),
    ).toEqual([]);
  });
});

describe('generateSkills (continue)', () => {
  it('projects canonical skills into .continue/skills with supporting files', () => {
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
      `${CONTINUE_SKILLS_DIR}/api-generator/SKILL.md`,
      `${CONTINUE_SKILLS_DIR}/api-generator/references/route-checklist.md`,
    ]);
  });
});

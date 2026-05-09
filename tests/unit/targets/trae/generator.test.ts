import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateSkills,
  generateMcp,
  generateIgnore,
} from '../../../../src/targets/trae/generator.js';
import {
  TRAE_PROJECT_RULES,
  TRAE_RULES_DIR,
  TRAE_SKILLS_DIR,
  TRAE_MCP_FILE,
  TRAE_IGNORE,
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

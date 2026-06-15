import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { generateRules, generateSkills } from '../../../../src/targets/zed/generator.js';
import { descriptor } from '../../../../src/targets/zed/index.js';
import { ZED_ROOT_FILE, ZED_SETTINGS_FILE } from '../../../../src/targets/zed/constants.js';

const ALL_FEATURES = new Set(['rules', 'mcp', 'hooks', 'ignore', 'permissions', 'agents']);

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

describe('generateRules (zed)', () => {
  it('generates .rules for the root rule', () => {
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
    expect(results[0].path).toBe(ZED_ROOT_FILE);
    expect(results[0].content).toContain('Use TDD and strict TypeScript.');
    expect(results[0].content).not.toMatch(/^---/);
  });

  it('embeds non-root rules in .rules', () => {
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
    expect(results[0].path).toBe(ZED_ROOT_FILE);
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

  it('includes rules explicitly targeted to zed', () => {
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
          source: '/proj/.agentsmesh/rules/zed-rule.md',
          root: false,
          targets: ['zed'],
          description: 'Zed-specific rule',
          globs: [],
          body: 'Zed-specific content.',
        },
      ],
    });

    const results = generateRules(canonical);

    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('Zed-specific content.');
  });

  it('returns empty when no rules exist', () => {
    const canonical = makeCanonical({ rules: [] });
    const results = generateRules(canonical);
    expect(results).toHaveLength(0);
  });
});

describe('generateSkills (zed)', () => {
  it('returns empty when no skills', () => {
    expect(generateSkills(makeCanonical())).toHaveLength(0);
  });

  it('generates .agents/skills/{name}/SKILL.md', () => {
    const canonical = makeCanonical({
      skills: [
        {
          name: 'api-generator',
          source: '/proj/.agentsmesh/skills/api-generator/SKILL.md',
          description: 'Generate API routes',
          body: '# API Generator\n\nGenerate routes.',
          supportingFiles: [],
        },
      ],
    });
    const results = generateSkills(canonical);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.path === '.agents/skills/api-generator/SKILL.md')).toBe(true);
    const skill = results.find((r) => r.path === '.agents/skills/api-generator/SKILL.md')!;
    expect(skill.content).toContain('name: api-generator');
  });

  it('generates supporting files alongside SKILL.md', () => {
    const canonical = makeCanonical({
      skills: [
        {
          name: 'api-generator',
          source: '/proj/.agentsmesh/skills/api-generator/SKILL.md',
          description: 'Generate API routes',
          body: '# API Generator',
          supportingFiles: [
            { relativePath: 'references/route-checklist.md', content: '# Checklist' },
            { relativePath: 'template.ts', content: 'export {};' },
          ],
        },
      ],
    });
    const results = generateSkills(canonical);
    const paths = results.map((r) => r.path);
    expect(paths).toContain('.agents/skills/api-generator/SKILL.md');
    expect(paths).toContain('.agents/skills/api-generator/references/route-checklist.md');
    expect(paths).toContain('.agents/skills/api-generator/template.ts');
  });
});

describe('emitScopedSettings — MCP format (zed)', () => {
  it('emits .zed/settings.json with context_servers key', () => {
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
    const results = descriptor.emitScopedSettings!(canonical, 'project', ALL_FEATURES);
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe(ZED_SETTINGS_FILE);
    const parsed = JSON.parse(results[0].content);
    expect(parsed).toEqual({
      context_servers: {
        context7: { type: 'stdio', command: 'npx', args: ['-y', '@upstash/context7-mcp'], env: {} },
      },
    });
  });

  it('returns empty array when mcp is null', () => {
    const canonical = makeCanonical({ mcp: null });
    const results = descriptor.emitScopedSettings!(canonical, 'project', ALL_FEATURES);
    expect(results).toEqual([]);
  });

  it('returns empty array when mcpServers is empty', () => {
    const canonical = makeCanonical({ mcp: { mcpServers: {} } });
    const results = descriptor.emitScopedSettings!(canonical, 'project', ALL_FEATURES);
    expect(results).toEqual([]);
  });
});

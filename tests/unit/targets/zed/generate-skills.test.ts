import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { generateSkills } from '../../../../src/targets/zed/generator.js';
import { descriptor } from '../../../../src/targets/zed/index.js';
import { ZED_SETTINGS_FILE } from '../../../../src/targets/zed/constants.js';

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

describe('generateSkills (zed)', () => {
  it('returns empty when no skills', () => {
    expect(generateSkills(makeCanonical())).toHaveLength(0);
  });

  it('generates exactly one file (.agents/skills/{name}/SKILL.md) for a skill with no supporting files', () => {
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
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe('.agents/skills/api-generator/SKILL.md');
    expect(results[0]!.content).toContain('name: api-generator');
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

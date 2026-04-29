/**
 * Branch coverage tests for src/targets/kiro/generator.ts.
 * Targets steeringFrontmatter ternary chain (globs/manual/model_decision/always),
 * fileMatchPattern singularity, generateMcp empty branches, generateAgents
 * frontmatter pruning, generateIgnore empty branch, and root-rule trim fallback.
 */
import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  generateRules,
  generateMcp,
  generateHooks,
  generateAgents,
  generateIgnore,
} from '../../../../src/targets/kiro/generator.js';
import {
  KIRO_AGENTS_MD,
  KIRO_STEERING_DIR,
  KIRO_AGENTS_DIR,
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

describe('generateRules — steering frontmatter branches', () => {
  it('emits inclusion=fileMatch with single string fileMatchPattern when globs.length===1', () => {
    const result = generateRules(
      makeCanonical({
        rules: [
          {
            source: '/p/.agentsmesh/rules/_root.md',
            root: true,
            targets: [],
            description: '',
            globs: [],
            body: '# r',
          },
          {
            source: '/p/.agentsmesh/rules/single.md',
            root: false,
            targets: [],
            description: '',
            globs: ['src/**/*.ts'],
            body: 'B',
          },
        ],
      }),
    );
    const single = result.find((r) => r.path === `${KIRO_STEERING_DIR}/single.md`);
    expect(single).toBeDefined();
    expect(single!.content).toContain('inclusion: fileMatch');
    expect(single!.content).toContain('fileMatchPattern: src/**/*.ts');
  });

  it('emits inclusion=fileMatch with array fileMatchPattern when multiple globs', () => {
    const result = generateRules(
      makeCanonical({
        rules: [
          {
            source: '/p/.agentsmesh/rules/_root.md',
            root: true,
            targets: [],
            description: '',
            globs: [],
            body: '# r',
          },
          {
            source: '/p/.agentsmesh/rules/multi.md',
            root: false,
            targets: [],
            description: '',
            globs: ['src/**/*.ts', 'tests/**/*.ts'],
            body: 'B',
          },
        ],
      }),
    );
    const multi = result.find((r) => r.path === `${KIRO_STEERING_DIR}/multi.md`);
    expect(multi).toBeDefined();
    expect(multi!.content).toContain('inclusion: fileMatch');
    // YAML array form
    expect(multi!.content).toMatch(/fileMatchPattern:\s*\n\s*-\s*src\/\*\*\/\*\.ts/);
  });

  it('emits inclusion=auto for trigger=model_decision (no globs)', () => {
    const result = generateRules(
      makeCanonical({
        rules: [
          {
            source: '/p/.agentsmesh/rules/auto.md',
            root: false,
            targets: [],
            description: '',
            globs: [],
            trigger: 'model_decision',
            body: 'b',
          },
        ],
      }),
    );
    expect(result[0]!.content).toContain('inclusion: auto');
  });

  it('emits inclusion=always when no globs, no trigger', () => {
    const result = generateRules(
      makeCanonical({
        rules: [
          {
            source: '/p/.agentsmesh/rules/always.md',
            root: false,
            targets: [],
            description: '',
            globs: [],
            body: 'b',
          },
        ],
      }),
    );
    expect(result[0]!.content).toContain('inclusion: always');
  });

  it('omits description when canonical description is empty', () => {
    const result = generateRules(
      makeCanonical({
        rules: [
          {
            source: '/p/.agentsmesh/rules/no-desc.md',
            root: false,
            targets: [],
            description: '',
            globs: [],
            trigger: 'manual',
            body: 'b',
          },
        ],
      }),
    );
    expect(result[0]!.content).not.toContain('description:');
  });

  it('uses empty string for AGENTS.md when root.body is whitespace only', () => {
    const result = generateRules(
      makeCanonical({
        rules: [
          {
            source: '/p/.agentsmesh/rules/_root.md',
            root: true,
            targets: [],
            description: '',
            globs: [],
            body: '   ',
          },
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe(KIRO_AGENTS_MD);
    expect(result[0]!.content).toBe('');
  });

  it('returns [] when no root rule and no per-target rules', () => {
    expect(generateRules(makeCanonical())).toEqual([]);
  });

  it('keeps non-root rule when targets includes "kiro"', () => {
    const result = generateRules(
      makeCanonical({
        rules: [
          {
            source: '/p/.agentsmesh/rules/kiro-only.md',
            root: false,
            targets: ['kiro'],
            description: '',
            globs: [],
            body: 'b',
          },
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.path).toBe(`${KIRO_STEERING_DIR}/kiro-only.md`);
  });
});

describe('generateMcp — empty branches', () => {
  it('returns [] when canonical.mcp is null', () => {
    expect(generateMcp(makeCanonical({ mcp: null }))).toEqual([]);
  });

  it('returns [] when mcpServers object is empty', () => {
    expect(generateMcp(makeCanonical({ mcp: { mcpServers: {} } }))).toEqual([]);
  });
});

describe('generateHooks — empty branches', () => {
  it('returns [] when canonical.hooks is null', () => {
    expect(generateHooks(makeCanonical({ hooks: null }))).toEqual([]);
  });

  it('returns [] when canonical.hooks is empty object', () => {
    expect(generateHooks(makeCanonical({ hooks: {} }))).toEqual([]);
  });
});

describe('generateAgents — frontmatter pruning branches', () => {
  it('omits tools when array is empty and omits model when empty string', () => {
    const result = generateAgents(
      makeCanonical({
        agents: [
          {
            source: 'a',
            name: 'reviewer',
            description: 'Review',
            tools: [],
            model: '',
            body: 'agent body',
          },
        ],
      }),
    );
    expect(result[0]!.path).toBe(`${KIRO_AGENTS_DIR}/reviewer.md`);
    expect(result[0]!.content).toContain('name: reviewer');
    expect(result[0]!.content).toContain('description: Review');
    expect(result[0]!.content).not.toContain('tools:');
    expect(result[0]!.content).not.toContain('model:');
  });

  it('keeps tools and model when populated', () => {
    const result = generateAgents(
      makeCanonical({
        agents: [
          {
            source: 'a',
            name: 'reviewer',
            description: 'Review',
            tools: ['Read', 'Grep'],
            model: 'gpt-4',
            body: 'agent body',
          },
        ],
      }),
    );
    expect(result[0]!.content).toContain('tools:');
    expect(result[0]!.content).toContain('model: gpt-4');
  });

  it('handles empty body (trim fallback to empty string)', () => {
    const result = generateAgents(
      makeCanonical({
        agents: [
          {
            source: 'a',
            name: 'r',
            description: 'd',
            tools: [],
            model: '',
            body: '   ',
          },
        ],
      }),
    );
    expect(result).toHaveLength(1);
  });
});

describe('generateIgnore — empty branch', () => {
  it('returns [] when canonical.ignore is empty', () => {
    expect(generateIgnore(makeCanonical({ ignore: [] }))).toEqual([]);
  });
});

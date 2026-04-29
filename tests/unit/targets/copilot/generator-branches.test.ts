/**
 * Branch coverage tests for copilot/generator.ts.
 * Targets:
 *   - mapHookEvent default branch (line 41-42) → unsupported phase yields no hooks.
 *   - generateRules: applyTo single-glob string vs. multi-glob array branch.
 *   - generateRules ruleSlug `_root` rename branch (when non-root rule named _root).
 *   - generateAgents: tools list omitted vs. present, model omitted, mcpServers omitted.
 *   - generateSkills: skill body whitespace-only.
 *   - renderCopilotGlobalInstructions: header from description vs. plain body, root
 *     body whitespace-only skipped, target filter dropping non-copilot rules.
 *   - generateHooks: timeout undefined branch and unsupported event branch.
 */

import { describe, expect, it } from 'vitest';
import {
  generateRules,
  generateAgents,
  generateSkills,
  generateHooks,
  renderCopilotGlobalInstructions,
} from '../../../../src/targets/copilot/generator.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import {
  COPILOT_INSTRUCTIONS,
  COPILOT_INSTRUCTIONS_DIR,
} from '../../../../src/targets/copilot/constants.js';

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

describe('generateRules (copilot) — branch coverage', () => {
  it('emits applyTo as a single string when there is exactly one glob', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: '',
          globs: [],
          body: 'Root',
        },
        {
          source: '/p/.agentsmesh/rules/single.md',
          root: false,
          targets: [],
          description: 'Single glob',
          globs: ['src/**/*.ts'],
          body: 'Body',
        },
      ],
    });
    const out = generateRules(canonical).find(
      (r) => r.path === `${COPILOT_INSTRUCTIONS_DIR}/single.instructions.md`,
    );
    expect(out).toBeDefined();
    expect(out!.content).toMatch(/applyTo:\s*src\/\*\*\/\*\.ts/);
  });

  it('emits applyTo as an array when there are multiple globs', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/multi.md',
          root: false,
          targets: [],
          description: 'Multi',
          globs: ['src/**/*.ts', 'tests/**/*.ts'],
          body: 'Body',
        },
      ],
    });
    const out = generateRules(canonical).find((r) => r.path.endsWith('/multi.instructions.md'));
    expect(out).toBeDefined();
    expect(out!.content).toContain('applyTo:');
    expect(out!.content).toContain('src/**/*.ts');
    expect(out!.content).toContain('tests/**/*.ts');
  });

  it('renames non-root rule whose source basename is `_root` to `root` slug', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/_root.md',
          root: false,
          targets: [],
          description: '',
          globs: ['src/**'],
          body: 'Body',
        },
      ],
    });
    const out = generateRules(canonical).find(
      (r) => r.path === `${COPILOT_INSTRUCTIONS_DIR}/root.instructions.md`,
    );
    expect(out).toBeDefined();
  });

  it('omits description from per-context frontmatter when description is empty', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/g.md',
          root: false,
          targets: [],
          description: '',
          globs: ['src/**'],
          body: 'Body',
        },
      ],
    });
    const out = generateRules(canonical).find((r) => r.path.endsWith('/g.instructions.md'));
    expect(out).toBeDefined();
    expect(out!.content).not.toContain('description:');
    expect(out!.content).toContain('applyTo:');
  });

  it('skips emitting copilot-instructions.md when there is no root rule even with non-root rules', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/x.md',
          root: false,
          targets: [],
          description: 'X',
          globs: ['**/*.ts'],
          body: 'X body',
        },
      ],
    });
    const out = generateRules(canonical);
    expect(out.find((r) => r.path === COPILOT_INSTRUCTIONS)).toBeUndefined();
    expect(out.find((r) => r.path.endsWith('/x.instructions.md'))).toBeDefined();
  });
});

describe('renderCopilotGlobalInstructions — branch coverage', () => {
  it('returns empty string when there are no rules', () => {
    expect(renderCopilotGlobalInstructions(makeCanonical())).toBe('');
  });

  it('skips root rule when its body is whitespace-only', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/_root.md',
          root: true,
          targets: [],
          description: 'should be skipped',
          globs: [],
          body: '   \n  \t\n',
        },
        {
          source: '/p/.agentsmesh/rules/x.md',
          root: false,
          targets: [],
          description: 'X',
          globs: [],
          body: 'X body',
        },
      ],
    });
    const out = renderCopilotGlobalInstructions(canonical);
    expect(out).not.toContain('should be skipped');
    expect(out).toContain('X body');
  });

  it('skips non-root rules whose body is whitespace-only', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/blank.md',
          root: false,
          targets: [],
          description: 'Blank',
          globs: [],
          body: '   \n',
        },
      ],
    });
    expect(renderCopilotGlobalInstructions(canonical)).toBe('');
  });

  it('drops non-root rules whose targets exclude copilot', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/x.md',
          root: false,
          targets: ['cursor', 'windsurf'],
          description: 'X',
          globs: [],
          body: 'X body',
        },
      ],
    });
    expect(renderCopilotGlobalInstructions(canonical)).toBe('');
  });

  it('emits plain body without a header when description is empty', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/plain.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: 'Plain body.',
        },
      ],
    });
    const out = renderCopilotGlobalInstructions(canonical);
    expect(out).toBe('Plain body.');
    expect(out.startsWith('## ')).toBe(false);
  });

  it('emits `## description` header when description is set', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/h.md',
          root: false,
          targets: [],
          description: 'Header',
          globs: [],
          body: 'Body.',
        },
      ],
    });
    expect(renderCopilotGlobalInstructions(canonical)).toBe('## Header\n\nBody.');
  });
});

describe('generateAgents (copilot) — branch coverage', () => {
  function baseAgent(): CanonicalFiles['agents'][number] {
    return {
      source: '',
      name: 'a',
      description: 'd',
      tools: [],
      disallowedTools: [],
      model: '',
      permissionMode: '',
      maxTurns: 0,
      mcpServers: [],
      hooks: {},
      skills: [],
      memory: '',
      body: 'Body.',
    };
  }

  it('omits tools / model / mcp-servers / skills frontmatter when arrays empty and strings blank', () => {
    const out = generateAgents(
      makeCanonical({ agents: [{ ...baseAgent(), name: 'minimal' }] }),
    )[0]!;
    expect(out.content).toContain('name: minimal');
    expect(out.content).toContain('description: d');
    expect(out.content).not.toContain('tools:');
    expect(out.content).not.toContain('model:');
    expect(out.content).not.toContain('mcp-servers');
    expect(out.content).not.toContain('skills:');
  });

  it('emits all optional fields when present', () => {
    const out = generateAgents(
      makeCanonical({
        agents: [
          {
            ...baseAgent(),
            name: 'rich',
            tools: ['Read'],
            model: 'gpt-5',
            mcpServers: ['ctx'],
            skills: ['qa'],
          },
        ],
      }),
    )[0]!;
    expect(out.content).toContain('tools:');
    expect(out.content).toContain('Read');
    expect(out.content).toContain('model: gpt-5');
    expect(out.content).toContain('mcp-servers');
    expect(out.content).toContain('ctx');
    expect(out.content).toContain('skills:');
    expect(out.content).toContain('qa');
  });
});

describe('generateSkills (copilot) — branch coverage', () => {
  it('omits description from skill frontmatter when empty', () => {
    const out = generateSkills(
      makeCanonical({
        skills: [
          { source: '', name: 'no-desc', description: '', body: 'Body.', supportingFiles: [] },
        ],
      }),
    )[0]!;
    expect(out.content).toContain('name: no-desc');
    expect(out.content).not.toContain('description:');
  });

  it('emits empty body when skill body is whitespace-only', () => {
    const out = generateSkills(
      makeCanonical({
        skills: [
          { source: '', name: 'blank', description: 'd', body: '   \n', supportingFiles: [] },
        ],
      }),
    )[0]!;
    expect(out.content).toContain('name: blank');
    expect(out.content).toContain('description: d');
    // Body should be empty after trim — frontmatter section ends and nothing follows.
    const afterFm = out.content.split(/^---\n[\s\S]*?\n---\n/m)[1];
    expect(afterFm?.trim() ?? '').toBe('');
  });
});

describe('generateHooks (copilot) — branch coverage', () => {
  it('omits hooks for unsupported event names (mapHookEvent default branch)', () => {
    const canonical = makeCanonical({
      hooks: {
        Unsupported: [{ matcher: '*', command: 'echo', type: 'command' }],
      },
    });
    expect(generateHooks(canonical)).toEqual([]);
  });

  it('omits timeoutSec when entry timeout is undefined', () => {
    const canonical = makeCanonical({
      hooks: {
        PostToolUse: [{ matcher: 'Write', command: 'lint', type: 'command' }],
      },
    });
    const out = generateHooks(canonical)[0]!;
    expect(out.content).not.toContain('timeoutSec');
  });

  it('skips event when its entries value is not an array', () => {
    const canonical = makeCanonical({
      hooks: {
        // entries=null falls through `Array.isArray(entries)` guard
        PostToolUse: null as unknown as never,
        PreToolUse: [{ matcher: '*', command: 'lint', type: 'command' }],
      },
    });
    const out = generateHooks(canonical);
    expect(out).toHaveLength(1);
    expect(out[0]!.content).toContain('"preToolUse"');
    expect(out[0]!.content).not.toContain('"postToolUse"');
  });

  it('skips non-object entries inside an event entries array', () => {
    const canonical = makeCanonical({
      hooks: {
        PreToolUse: [
          'not-an-object' as unknown as never,
          null as unknown as never,
          { matcher: '*', command: 'lint', type: 'command' },
        ],
      },
    });
    const out = generateHooks(canonical);
    expect(out).toHaveLength(1);
    expect(out[0]!.content).toContain('"preToolUse"');
  });
});

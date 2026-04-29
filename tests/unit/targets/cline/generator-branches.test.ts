/**
 * Branch coverage tests for cline/generator.ts.
 * Targets:
 *   - generateRules: rule with `_root` source slug renamed to `root`.
 *   - generateRules: rule with description but no globs, vs. globs but no description.
 *   - generateHooks: non-array entries (line 152) and absent hook command guard.
 *   - generateSkills: empty supportingFiles vs populated.
 */

import { describe, expect, it } from 'vitest';
import { generateRules, generateHooks } from '../../../../src/targets/cline/generator.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { CLINE_RULES_DIR, CLINE_HOOKS_DIR } from '../../../../src/targets/cline/constants.js';

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

describe('generateRules (cline) — branch coverage', () => {
  it('renames non-root `_root.md` slug to `root.md`', () => {
    // Edge case: a non-root rule whose source happens to be named _root.md.
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/_root.md',
          root: false,
          targets: [],
          description: '',
          globs: [],
          body: 'Body',
        },
      ],
    });
    const results = generateRules(canonical);
    expect(results.find((r) => r.path === `${CLINE_RULES_DIR}/root.md`)).toBeDefined();
    expect(results.find((r) => r.path === `${CLINE_RULES_DIR}/_root.md`)).toBeUndefined();
  });

  it('emits frontmatter with description when description present but no globs', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/desc.md',
          root: false,
          targets: [],
          description: 'Desc only',
          globs: [],
          body: 'Body',
        },
      ],
    });
    const result = generateRules(canonical).find((r) => r.path.endsWith('/desc.md'));
    expect(result).toBeDefined();
    expect(result!.content).toContain('description: Desc only');
    expect(result!.content).not.toContain('paths:');
  });

  it('emits frontmatter with paths when globs present but no description', () => {
    const canonical = makeCanonical({
      rules: [
        {
          source: '/p/.agentsmesh/rules/g.md',
          root: false,
          targets: [],
          description: '',
          globs: ['src/**/*.ts'],
          body: 'Body',
        },
      ],
    });
    const result = generateRules(canonical).find((r) => r.path.endsWith('/g.md'));
    expect(result).toBeDefined();
    expect(result!.content).toContain('paths:');
    expect(result!.content).toContain('src/**/*.ts');
    expect(result!.content).not.toContain('description:');
  });
});

describe('generateHooks (cline) — branch coverage', () => {
  it('skips events whose entries value is not an array', () => {
    const canonical = makeCanonical({
      hooks: {
        // Provide a non-array entries shape; hasOwnProperty check would still loop.
        BadEvent: 'not-an-array' as unknown as never,
        PostToolUse: [{ matcher: 'Write', command: 'lint' }],
      },
    });
    const results = generateHooks(canonical);
    expect(results).toHaveLength(1);
    expect(results[0]!.path).toBe(`${CLINE_HOOKS_DIR}/posttooluse-0.sh`);
  });

  it('skips entries that fail hasHookCommand (missing command field)', () => {
    const canonical = makeCanonical({
      hooks: {
        PostToolUse: [{ matcher: 'Write', command: '' }, { matcher: 'Bash' } as unknown as never],
      },
    });
    const results = generateHooks(canonical);
    expect(results).toEqual([]);
  });
});

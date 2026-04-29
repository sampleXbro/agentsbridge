/**
 * Branch coverage tests for src/targets/windsurf/generator/rules.ts.
 * Targets:
 *   - empty canonical → []
 *   - no root rule → []
 *   - rule with targets array excluding 'windsurf' → skipped
 *   - rule with single glob → frontmatter has glob (not globs)
 *   - rule with multi-glob → frontmatter has globs (not glob)
 *   - rule with no description and no globs → no frontmatter wrapper
 *   - directoryScopedRuleDir branches: single dir (mirror), multi-segment, mismatched dirs
 *   - rule slug fallback when source is _root → 'root'
 */
import { describe, it, expect } from 'vitest';
import { generateRules } from '../../../../src/targets/windsurf/generator/rules.js';
import {
  WINDSURF_RULES_DIR,
  WINDSURF_AGENTS_MD,
} from '../../../../src/targets/windsurf/constants.js';
import type { CanonicalFiles, CanonicalRule } from '../../../../src/core/types.js';

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

function rootRule(): CanonicalRule {
  return {
    source: '/p/.agentsmesh/rules/_root.md',
    root: true,
    targets: [],
    description: 'Root',
    globs: [],
    body: '# Root\n\nRoot body.',
  };
}

describe('windsurf generateRules — empty / no-root branches', () => {
  it('returns [] when canonical has no rules', () => {
    expect(generateRules(makeCanonical())).toEqual([]);
  });

  it('returns [] when there is no root rule (only non-root)', () => {
    const result = generateRules(
      makeCanonical({
        rules: [
          {
            source: '/p/.agentsmesh/rules/ts.md',
            root: false,
            targets: [],
            description: '',
            globs: [],
            body: 'B',
          },
        ],
      }),
    );
    expect(result).toEqual([]);
  });
});

describe('windsurf generateRules — root + targets filter', () => {
  it('emits AGENTS.md from root and skips rules whose targets exclude "windsurf"', () => {
    const result = generateRules(
      makeCanonical({
        rules: [
          rootRule(),
          {
            source: '/p/.agentsmesh/rules/cursor-only.md',
            root: false,
            targets: ['cursor'],
            description: '',
            globs: [],
            body: 'C',
          },
          {
            source: '/p/.agentsmesh/rules/ts.md',
            root: false,
            targets: ['windsurf'],
            description: '',
            globs: [],
            body: 'T',
          },
        ],
      }),
    );
    const paths = result.map((r) => r.path);
    expect(paths).toContain(WINDSURF_AGENTS_MD);
    expect(paths.some((p) => p.endsWith('cursor-only.md'))).toBe(false);
    expect(paths).toContain(`${WINDSURF_RULES_DIR}/ts.md`);
  });
});

describe('windsurf generateRules — frontmatter glob/globs branches', () => {
  it('uses singular `glob` field with one glob', () => {
    const result = generateRules(
      makeCanonical({
        rules: [
          rootRule(),
          {
            source: '/p/.agentsmesh/rules/single.md',
            root: false,
            targets: [],
            description: 'TS rules',
            globs: ['src/**/*.ts'],
            body: 'B',
          },
        ],
      }),
    );
    const single = result.find((r) => r.path === `${WINDSURF_RULES_DIR}/single.md`);
    expect(single).toBeDefined();
    expect(single!.content).toContain('description: TS rules');
    expect(single!.content).toContain('glob: src/**/*.ts');
    expect(single!.content).not.toMatch(/^globs:/m);
  });

  it('uses plural `globs` field with multiple globs', () => {
    const result = generateRules(
      makeCanonical({
        rules: [
          rootRule(),
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
    const multi = result.find((r) => r.path === `${WINDSURF_RULES_DIR}/multi.md`);
    expect(multi).toBeDefined();
    expect(multi!.content).toContain('globs:');
    expect(multi!.content).not.toMatch(/^glob:/m);
  });

  it('emits plain body (no frontmatter) when description+trigger+globs are all empty', () => {
    const result = generateRules(
      makeCanonical({
        rules: [
          rootRule(),
          {
            source: '/p/.agentsmesh/rules/plain.md',
            root: false,
            targets: [],
            description: '',
            globs: [],
            body: 'plain body content',
          },
        ],
      }),
    );
    const plain = result.find((r) => r.path === `${WINDSURF_RULES_DIR}/plain.md`);
    expect(plain).toBeDefined();
    expect(plain!.content).not.toMatch(/^---/);
    expect(plain!.content).toBe('plain body content');
  });
});

describe('windsurf generateRules — directoryScopedRuleDir branches', () => {
  it('mirrors a directory-scoped rule into both .windsurf/rules and {dir}/AGENTS.md', () => {
    const result = generateRules(
      makeCanonical({
        rules: [
          rootRule(),
          {
            source: '/p/.agentsmesh/rules/src-scope.md',
            root: false,
            targets: [],
            description: 'Src',
            globs: ['src/**/*.ts'],
            body: 'src-body',
          },
        ],
      }),
    );
    const paths = result.map((r) => r.path);
    expect(paths).toContain(`${WINDSURF_RULES_DIR}/src-scope.md`);
    // dir != slug ('src' vs 'src-scope') → second mirror added
    expect(paths).toContain(`${WINDSURF_RULES_DIR}/src.md`);
    expect(paths).toContain(`src/AGENTS.md`);
    const agentsMirror = result.find((r) => r.path === 'src/AGENTS.md');
    expect(agentsMirror!.content).toBe('src-body');
  });

  it('does not double-emit rules dir copy when slug equals dir', () => {
    const result = generateRules(
      makeCanonical({
        rules: [
          rootRule(),
          {
            source: '/p/.agentsmesh/rules/src.md',
            root: false,
            targets: [],
            description: '',
            globs: ['src/**/*.ts'],
            body: 'b',
          },
        ],
      }),
    );
    // path "src/AGENTS.md" should appear (dir mirror), but only one src.md under rules/.
    const rulesCopies = result.filter((r) => r.path === `${WINDSURF_RULES_DIR}/src.md`);
    expect(rulesCopies).toHaveLength(1);
    expect(result.some((r) => r.path === 'src/AGENTS.md')).toBe(true);
  });

  it('does NOT mirror when globs span multiple top-level directories', () => {
    const result = generateRules(
      makeCanonical({
        rules: [
          rootRule(),
          {
            source: '/p/.agentsmesh/rules/mix.md',
            root: false,
            targets: [],
            description: '',
            globs: ['src/**/*.ts', 'tests/**/*.ts'],
            body: 'b',
          },
        ],
      }),
    );
    const paths = result.map((r) => r.path);
    expect(paths).not.toContain('src/AGENTS.md');
    expect(paths).not.toContain('tests/AGENTS.md');
  });

  it('does NOT mirror when a glob has no leading directory segment', () => {
    const result = generateRules(
      makeCanonical({
        rules: [
          rootRule(),
          {
            source: '/p/.agentsmesh/rules/glob-only.md',
            root: false,
            targets: [],
            description: '',
            globs: ['*.md'],
            body: 'b',
          },
        ],
      }),
    );
    // The first segment '*.md' has '*' which fails the [A-Za-z0-9._-] regex
    // → directoryScopedRuleDir returns null → no AGENTS.md mirror.
    expect(result.some((r) => r.path === '*.md/AGENTS.md')).toBe(false);
  });

  it('uses "root" slug when source is _root.md (still skipped because rule.root=true)', () => {
    // Cover ruleSlug branch: source='_root' even on a non-root rule.
    const result = generateRules(
      makeCanonical({
        rules: [
          rootRule(),
          {
            source: '_root.md',
            root: false,
            targets: [],
            description: '',
            globs: [],
            body: 'shadow body',
          },
        ],
      }),
    );
    expect(result.some((r) => r.path === `${WINDSURF_RULES_DIR}/root.md`)).toBe(true);
  });
});

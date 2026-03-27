import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateRules } from '../../../src/core/lint/validate-rules.js';
import type { CanonicalFiles } from '../../../src/core/types.js';

const TEST_DIR = join(tmpdir(), 'am-validate-rules-test');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
  writeFileSync(join(TEST_DIR, 'src', 'foo.ts'), 'x');
});
afterEach(() => rmSync(TEST_DIR, { recursive: true, force: true }));

function canonical(rules: CanonicalFiles['rules']): CanonicalFiles {
  return {
    rules,
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('validateRules', () => {
  it('returns empty when no rules', () => {
    expect(validateRules(canonical([]), TEST_DIR, [])).toEqual([]);
  });

  it('returns error when rules exist but no root', () => {
    const rules = [
      {
        source: join(TEST_DIR, '.agentsmesh', 'rules', 'other.md'),
        root: false,
        targets: [],
        description: 'Other',
        globs: [] as string[],
        body: 'Other',
      },
    ];
    const diags = validateRules(canonical(rules), TEST_DIR, []);
    expect(diags).toHaveLength(1);
    expect(diags[0]?.level).toBe('error');
    expect(diags[0]?.message).toContain('no root rule');
  });

  it('skips warning when rule globs match files', () => {
    const projectFiles = ['src/foo.ts', 'src/bar.ts'];
    const rules = [
      {
        source: join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
        root: true,
        targets: [],
        description: 'Root',
        globs: [] as string[],
        body: 'Root',
      },
      {
        source: join(TEST_DIR, '.agentsmesh', 'rules', 'src-only.md'),
        root: false,
        targets: [],
        description: 'Src',
        globs: ['src/**/*.ts'],
        body: 'Src rules',
      },
    ];
    const diags = validateRules(canonical(rules), TEST_DIR, projectFiles);
    const warnings = diags.filter((d) => d.level === 'warning' && d.message.includes('match 0'));
    expect(warnings).toHaveLength(0);
  });

  it('skips rule when globs empty', () => {
    const rules = [
      {
        source: join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
        root: true,
        targets: [],
        description: 'Root',
        globs: [] as string[],
        body: 'Root',
      },
    ];
    const diags = validateRules(canonical(rules), TEST_DIR, ['src/foo.ts']);
    expect(diags).toHaveLength(0);
  });

  it('warns when rule globs match 0 files', () => {
    const projectFiles = ['src/foo.ts'];
    const rules = [
      {
        source: join(TEST_DIR, '.agentsmesh', 'rules', '_root.md'),
        root: true,
        targets: [],
        description: 'Root',
        globs: [] as string[],
        body: 'Root',
      },
      {
        source: join(TEST_DIR, '.agentsmesh', 'rules', 'lib-only.md'),
        root: false,
        targets: [],
        description: 'Lib',
        globs: ['lib/**/*.ts'],
        body: 'Lib',
      },
    ];
    const diags = validateRules(canonical(rules), TEST_DIR, projectFiles);
    const warnings = diags.filter((d) => d.message.includes('match 0 files'));
    expect(warnings).toHaveLength(1);
  });
});

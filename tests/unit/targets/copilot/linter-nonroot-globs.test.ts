/**
 * src/targets/copilot/linter.ts — the non-root-without-globs warning mapper and
 * the project/global scope switch for shared glob checks.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { lintRules } from '../../../../src/targets/copilot/linter.js';
import { COPILOT_TARGET } from '../../../../src/targets/copilot/constants.js';
import type { CanonicalFiles, CanonicalRule } from '../../../../src/core/types.js';

const projectRoot = join(tmpdir(), 'am-copilot-linter');
const rootSource = join(projectRoot, '.agentsmesh', 'rules', '_root.md');
const apiSource = join(projectRoot, '.agentsmesh', 'rules', 'api.md');

function rule(overrides: Partial<CanonicalRule>): CanonicalRule {
  return {
    source: apiSource,
    root: false,
    targets: [],
    description: 'API',
    globs: [],
    body: 'Body',
    ...overrides,
  };
}

function canonical(rules: CanonicalRule[]): CanonicalFiles {
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

const rootRule = rule({ source: rootSource, root: true, description: 'Root' });

describe('copilot lintRules — non-root rules without globs', () => {
  it('warns once, pointing at the rule source, when a non-root rule has no globs', () => {
    const diags = lintRules(canonical([rootRule, rule({ globs: [] })]), projectRoot, []);

    expect(diags).toEqual([
      {
        level: 'warning',
        file: apiSource,
        target: COPILOT_TARGET,
        message:
          'Copilot path-specific instructions require applyTo globs; non-root rules without globs are not generated.',
      },
    ]);
    expect(diags[0]!.message).toContain('applyTo globs');
  });

  it('emits no applyTo warning when the non-root rule has globs', () => {
    const diags = lintRules(canonical([rootRule, rule({ globs: ['src/**/*.ts'] })]), projectRoot, [
      'src/index.ts',
    ]);

    expect(diags).toEqual([]);
  });
});

describe('copilot lintRules — scope switch', () => {
  it('runs the shared glob-match check in project scope', () => {
    const diags = lintRules(canonical([rootRule, rule({ globs: ['lib/**'] })]), projectRoot, [
      'src/index.ts',
    ]);

    expect(diags).toEqual([
      {
        level: 'warning',
        file: join('.agentsmesh', 'rules', 'api.md'),
        target: COPILOT_TARGET,
        message: 'globs "lib/**" match 0 files in project',
      },
    ]);
  });

  it('skips the shared glob-match check in global scope', () => {
    const diags = lintRules(
      canonical([rootRule, rule({ globs: ['lib/**'] })]),
      projectRoot,
      ['src/index.ts'],
      { scope: 'global' },
    );

    expect(diags).toEqual([]);
  });
});

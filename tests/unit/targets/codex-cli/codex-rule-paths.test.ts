import { describe, it, expect } from 'vitest';
import type { CanonicalRule } from '../../../../src/core/types.js';
import {
  codexNestedAgentsPath,
  codexRuleDirectory,
} from '../../../../src/targets/codex-cli/codex-rule-paths.js';

function rule(source: string, globs: string[], opts?: { override?: boolean }): CanonicalRule {
  return {
    source,
    root: false,
    targets: [],
    description: '',
    globs,
    body: '',
    ...(opts?.override ? { codexInstructionVariant: 'override' as const } : {}),
  };
}

describe('codexNestedAgentsPath', () => {
  it('derives the directory from a single-level glob prefix', () => {
    expect(codexNestedAgentsPath(rule('/p/.agentsmesh/rules/typescript.md', ['src/**/*.ts']))).toBe(
      'src/AGENTS.md',
    );
  });

  it('derives a multi-level directory from a nested glob prefix', () => {
    expect(
      codexNestedAgentsPath(rule('/p/.agentsmesh/rules/payments.md', ['services/payments/**'])),
    ).toBe('services/payments/AGENTS.md');
  });

  it('uses the slug as directory for **/… globs (no directory prefix)', () => {
    expect(codexNestedAgentsPath(rule('/p/.agentsmesh/rules/typescript.md', ['**/*.ts']))).toBe(
      'typescript/AGENTS.md',
    );
  });

  it('writes AGENTS.override.md for override rules', () => {
    expect(
      codexNestedAgentsPath(
        rule('/p/.agentsmesh/rules/payments.md', ['services/payments/**'], { override: true }),
      ),
    ).toBe('services/payments/AGENTS.override.md');
  });

  it('falls back to slug when no globs are present', () => {
    expect(codexNestedAgentsPath(rule('/p/.agentsmesh/rules/general.md', []))).toBe(
      'general/AGENTS.md',
    );
  });

  it('falls back to slug when glob prefix escapes project via traversal', () => {
    expect(codexNestedAgentsPath(rule('/p/.agentsmesh/rules/typescript.md', ['../**/*.ts']))).toBe(
      'typescript/AGENTS.md',
    );
  });

  it('falls back to slug when glob prefix is absolute', () => {
    expect(
      codexNestedAgentsPath(rule('/p/.agentsmesh/rules/typescript.md', ['/src/**/*.ts'])),
    ).toBe('typescript/AGENTS.md');
  });

  it('normalizes ./ prefix and extracts the real directory', () => {
    expect(
      codexNestedAgentsPath(rule('/p/.agentsmesh/rules/typescript.md', ['./src/**/*.ts'])),
    ).toBe('src/AGENTS.md');
  });

  it('falls back to slug for brace-prefixed ambiguous globs', () => {
    expect(
      codexNestedAgentsPath(rule('/p/.agentsmesh/rules/typescript.md', ['{src,tests}/**/*.ts'])),
    ).toBe('typescript/AGENTS.md');
  });

  it('picks the first glob with a usable directory prefix among several', () => {
    expect(
      codexNestedAgentsPath(
        rule('/p/.agentsmesh/rules/typescript.md', ['src/**/*.ts', 'tests/**/*.ts']),
      ),
    ).toBe('src/AGENTS.md');
  });

  it('treats a literal (non-wildcard) glob path as pointing at its parent directory', () => {
    expect(codexRuleDirectory(rule('/p/.agentsmesh/rules/x.md', ['docs/readme.md']))).toBe('docs');
  });

  it('falls back to slug for a single-segment literal glob with no parent directory', () => {
    expect(codexRuleDirectory(rule('/p/.agentsmesh/rules/readme.md', ['readme.md']))).toBe(
      'readme',
    );
  });
});

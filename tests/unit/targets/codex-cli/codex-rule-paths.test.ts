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

  it('embeds **/… globs (no directory prefix) in the root AGENTS.md, never a slug directory', () => {
    expect(codexNestedAgentsPath(rule('/p/.agentsmesh/rules/typescript.md', ['**/*.ts']))).toBe(
      'AGENTS.md',
    );
    expect(codexNestedAgentsPath(rule('/p/.agentsmesh/rules/a.md', ['**/*.ts']))).not.toBe(
      'a/AGENTS.md',
    );
  });

  it('keeps a real directory prefix even when the rule slug differs', () => {
    expect(codexNestedAgentsPath(rule('/p/.agentsmesh/rules/a.md', ['src/**/*.ts']))).toBe(
      'src/AGENTS.md',
    );
  });

  it('routes unscoped override rules to the root AGENTS.override.md', () => {
    expect(
      codexNestedAgentsPath(rule('/p/.agentsmesh/rules/a.md', ['**/*.ts'], { override: true })),
    ).toBe('AGENTS.override.md');
  });

  it('writes AGENTS.override.md for override rules', () => {
    expect(
      codexNestedAgentsPath(
        rule('/p/.agentsmesh/rules/payments.md', ['services/payments/**'], { override: true }),
      ),
    ).toBe('services/payments/AGENTS.override.md');
  });

  it('falls back to the root AGENTS.md when no globs are present', () => {
    expect(codexNestedAgentsPath(rule('/p/.agentsmesh/rules/general.md', []))).toBe('AGENTS.md');
  });

  it('falls back to the root AGENTS.md when glob prefix escapes project via traversal', () => {
    expect(codexNestedAgentsPath(rule('/p/.agentsmesh/rules/typescript.md', ['../**/*.ts']))).toBe(
      'AGENTS.md',
    );
  });

  it('falls back to the root AGENTS.md when glob prefix is absolute', () => {
    expect(
      codexNestedAgentsPath(rule('/p/.agentsmesh/rules/typescript.md', ['/src/**/*.ts'])),
    ).toBe('AGENTS.md');
  });

  it('normalizes ./ prefix and extracts the real directory', () => {
    expect(
      codexNestedAgentsPath(rule('/p/.agentsmesh/rules/typescript.md', ['./src/**/*.ts'])),
    ).toBe('src/AGENTS.md');
  });

  it('falls back to the root AGENTS.md for brace-prefixed ambiguous globs', () => {
    expect(
      codexNestedAgentsPath(rule('/p/.agentsmesh/rules/typescript.md', ['{src,tests}/**/*.ts'])),
    ).toBe('AGENTS.md');
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

  it('yields no directory for a single-segment literal glob with no parent directory', () => {
    expect(codexRuleDirectory(rule('/p/.agentsmesh/rules/readme.md', ['readme.md']))).toBeNull();
  });
});

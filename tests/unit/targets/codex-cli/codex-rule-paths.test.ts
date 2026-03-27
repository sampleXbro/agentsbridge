import { describe, it, expect } from 'vitest';
import type { CanonicalRule } from '../../../../src/core/types.js';
import { codexAdvisoryInstructionPath } from '../../../../src/targets/codex-cli/codex-rule-paths.js';

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

describe('codexAdvisoryInstructionPath', () => {
  it('uses canonical slug inside .codex/instructions for advisory rules', () => {
    expect(
      codexAdvisoryInstructionPath(rule('/p/.agentsmesh/rules/typescript.md', ['src/**/*.ts'])),
    ).toBe('.codex/instructions/typescript.md');
  });

  it('uses slug for **/… globs', () => {
    expect(
      codexAdvisoryInstructionPath(rule('/p/.agentsmesh/rules/typescript.md', ['**/*.ts'])),
    ).toBe('.codex/instructions/typescript.md');
  });

  it('keeps override rules in the same instructions folder', () => {
    expect(
      codexAdvisoryInstructionPath(
        rule('/p/.agentsmesh/rules/payments.md', ['services/payments/**'], { override: true }),
      ),
    ).toBe('.codex/instructions/payments.md');
  });

  it('falls back to slug when glob prefix escapes project via traversal', () => {
    expect(
      codexAdvisoryInstructionPath(rule('/p/.agentsmesh/rules/typescript.md', ['../**/*.ts'])),
    ).toBe('.codex/instructions/typescript.md');
  });

  it('falls back to slug when glob prefix is absolute', () => {
    expect(
      codexAdvisoryInstructionPath(rule('/p/.agentsmesh/rules/typescript.md', ['/src/**/*.ts'])),
    ).toBe('.codex/instructions/typescript.md');
  });

  it('normalizes ./ prefix for safe relative globs without changing the output slug', () => {
    expect(
      codexAdvisoryInstructionPath(rule('/p/.agentsmesh/rules/typescript.md', ['./src/**/*.ts'])),
    ).toBe('.codex/instructions/typescript.md');
  });

  it('falls back to slug for brace-prefixed ambiguous globs', () => {
    expect(
      codexAdvisoryInstructionPath(
        rule('/p/.agentsmesh/rules/typescript.md', ['{src,tests}/**/*.ts']),
      ),
    ).toBe('.codex/instructions/typescript.md');
  });
});

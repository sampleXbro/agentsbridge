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
  it('uses glob directory prefix for path', () => {
    expect(
      codexAdvisoryInstructionPath(rule('/p/.agentsmesh/rules/typescript.md', ['src/**/*.ts'])),
    ).toBe('src/AGENTS.md');
  });

  it('uses slug for **/… globs', () => {
    expect(
      codexAdvisoryInstructionPath(rule('/p/.agentsmesh/rules/typescript.md', ['**/*.ts'])),
    ).toBe('typescript/AGENTS.md');
  });

  it('uses AGENTS.override.md when codex_instruction is override', () => {
    expect(
      codexAdvisoryInstructionPath(
        rule('/p/.agentsmesh/rules/payments.md', ['services/payments/**'], { override: true }),
      ),
    ).toBe('services/payments/AGENTS.override.md');
  });

  it('falls back to slug when glob prefix escapes project via traversal', () => {
    expect(
      codexAdvisoryInstructionPath(rule('/p/.agentsmesh/rules/typescript.md', ['../**/*.ts'])),
    ).toBe('typescript/AGENTS.md');
  });

  it('falls back to slug when glob prefix is absolute', () => {
    expect(
      codexAdvisoryInstructionPath(rule('/p/.agentsmesh/rules/typescript.md', ['/src/**/*.ts'])),
    ).toBe('typescript/AGENTS.md');
  });

  it('normalizes ./ prefix for safe relative globs', () => {
    expect(
      codexAdvisoryInstructionPath(rule('/p/.agentsmesh/rules/typescript.md', ['./src/**/*.ts'])),
    ).toBe('src/AGENTS.md');
  });

  it('falls back to slug for brace-prefixed ambiguous globs', () => {
    expect(
      codexAdvisoryInstructionPath(
        rule('/p/.agentsmesh/rules/typescript.md', ['{src,tests}/**/*.ts']),
      ),
    ).toBe('typescript/AGENTS.md');
  });
});

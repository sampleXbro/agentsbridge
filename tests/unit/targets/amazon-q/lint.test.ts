import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintHooks, lintPermissions } from '../../../../src/targets/amazon-q/lint.js';

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

describe('lintHooks (amazon-q)', () => {
  it('returns empty when hooks is null', () => {
    expect(lintHooks(makeCanonical({ hooks: null }))).toHaveLength(0);
  });

  it('returns empty when hooks has no entries', () => {
    expect(lintHooks(makeCanonical({ hooks: { PostToolUse: [] } }))).toHaveLength(0);
  });

  it('warns when canonical hooks have entries', () => {
    const canonical = makeCanonical({
      hooks: {
        PostToolUse: [
          {
            matcher: '**',
            command: 'echo done',
          },
        ],
      },
    });
    const result = lintHooks(canonical);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('.agentsmesh/hooks.yaml');
    expect(result[0].target).toBe('amazon-q');
    expect(result[0].level).toBe('warning');
    expect(result[0].message).toContain('per-agent');
  });
});

describe('lintPermissions (amazon-q)', () => {
  it('returns empty when permissions is null', () => {
    expect(lintPermissions(makeCanonical({ permissions: null }))).toHaveLength(0);
  });

  it('returns empty when all permission lists are empty', () => {
    expect(
      lintPermissions(makeCanonical({ permissions: { allow: [], deny: [], ask: [] } })),
    ).toHaveLength(0);
  });

  it('warns when allow is non-empty', () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Bash(git:*)'], deny: [], ask: [] },
    });
    const result = lintPermissions(canonical);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('.agentsmesh/permissions.yaml');
    expect(result[0].target).toBe('amazon-q');
    expect(result[0].level).toBe('warning');
    expect(result[0].message).toContain('allowedTools');
  });

  it('warns when deny is non-empty', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: ['Bash'], ask: [] },
    });
    const result = lintPermissions(canonical);
    expect(result).toHaveLength(1);
  });

  it('warns when ask is non-empty', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: [], ask: ['Bash(rm:*)'] },
    });
    const result = lintPermissions(canonical);
    expect(result).toHaveLength(1);
  });
});

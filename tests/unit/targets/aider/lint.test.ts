import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintHooks, lintPermissions, lintMcp } from '../../../../src/targets/aider/lint.js';

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

describe('lintHooks (aider)', () => {
  it('returns empty when hooks is null', () => {
    const canonical = makeCanonical({ hooks: null });
    expect(lintHooks(canonical)).toHaveLength(0);
  });

  it('returns empty when hooks has no entries', () => {
    const canonical = makeCanonical({
      hooks: { PreGenerate: [], PostGenerate: [] },
    });
    expect(lintHooks(canonical)).toHaveLength(0);
  });

  it('returns warning when hooks have entries', () => {
    const canonical = makeCanonical({
      hooks: {
        PreGenerate: [{ command: 'echo hello', pattern: '' }],
      },
    });

    const result = lintHooks(canonical);

    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].target).toBe('aider');
    expect(result[0].message).toContain('hook');
  });

  it('names every dropped event, matcher and command', () => {
    const result = lintHooks(
      makeCanonical({
        hooks: {
          PreToolUse: [{ matcher: '*', command: 'guard' }],
          PostToolUse: [{ matcher: 'Bash', command: 'audit' }],
        },
      }),
    );

    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('PreToolUse(*): guard');
    expect(result[0].message).toContain('PostToolUse(Bash): audit');
  });

  it('warns separately that test-cmd narrows an unscoped PostToolUse hook', () => {
    const result = lintHooks(
      makeCanonical({ hooks: { PostToolUse: [{ matcher: '*', command: 'npm test' }] } }),
    );

    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('test-cmd');
    expect(result[0].message).toContain('PostToolUse(*): npm test');
  });

  it('stays silent for hooks aider maps exactly', () => {
    expect(
      lintHooks(
        makeCanonical({ hooks: { PostToolUse: [{ matcher: 'Write|Edit', command: 'ruff' }] } }),
      ),
    ).toHaveLength(0);
  });
});

describe('lintPermissions (aider)', () => {
  it('returns empty when permissions is null', () => {
    const canonical = makeCanonical({ permissions: null });
    expect(lintPermissions(canonical)).toHaveLength(0);
  });

  it('returns empty when all permission lists are empty', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: [], ask: [] },
    });
    expect(lintPermissions(canonical)).toHaveLength(0);
  });

  it('returns warning when allow list has entries', () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Bash'], deny: [], ask: [] },
    });

    const result = lintPermissions(canonical);

    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].target).toBe('aider');
    expect(result[0].message).toContain('permissions');
  });

  it('returns warning when deny list has entries', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: ['WebSearch'], ask: [] },
    });

    const result = lintPermissions(canonical);

    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
  });

  it('returns warning when ask list has entries', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: [], ask: ['Bash'] },
    });

    const result = lintPermissions(canonical);

    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
  });

  it('returns empty when permissions has no ask property', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: [] },
    });
    expect(lintPermissions(canonical)).toHaveLength(0);
  });
});

describe('lintMcp (aider)', () => {
  it('returns empty when mcp is null', () => {
    const canonical = makeCanonical({ mcp: null });
    expect(lintMcp(canonical)).toHaveLength(0);
  });

  it('returns empty when mcpServers is empty', () => {
    const canonical = makeCanonical({ mcp: { mcpServers: {} } });
    expect(lintMcp(canonical)).toHaveLength(0);
  });

  it('returns warning when mcp has servers', () => {
    const canonical = makeCanonical({
      mcp: {
        mcpServers: {
          context7: {
            command: 'npx',
            args: ['-y', '@upstash/context7-mcp'],
          },
        },
      },
    });

    const result = lintMcp(canonical);

    expect(result).toHaveLength(1);
    expect(result[0].level).toBe('warning');
    expect(result[0].target).toBe('aider');
    expect(result[0].message).toContain('MCP');
  });
});

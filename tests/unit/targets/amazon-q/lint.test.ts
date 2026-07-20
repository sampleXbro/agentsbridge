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

  it('returns empty for embeddable events (PreToolUse, PostToolUse, UserPromptSubmit) — they are embedded in agent JSON', () => {
    const canonical = makeCanonical({
      hooks: {
        PreToolUse: [{ matcher: 'fs_write', command: 'lint.sh' }],
        PostToolUse: [{ matcher: '**', command: 'echo done' }],
        UserPromptSubmit: [{ matcher: '**', command: 'recall.sh' }],
      },
    });
    expect(lintHooks(canonical)).toHaveLength(0);
  });

  it('warns for non-embeddable hook events (Notification, SubagentStart, SubagentStop)', () => {
    const canonical = makeCanonical({
      hooks: {
        Notification: [{ matcher: '**', command: 'notify.sh' }],
      },
    });
    const result = lintHooks(canonical);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('.agentsmesh/hooks.yaml');
    expect(result[0].target).toBe('amazon-q');
    expect(result[0].level).toBe('warning');
    expect(result[0].message).toContain('Notification');
  });

  it('warns for SubagentStart non-embeddable event', () => {
    const canonical = makeCanonical({
      hooks: {
        SubagentStart: [{ matcher: '**', command: 'start.sh' }],
      },
    });
    const result = lintHooks(canonical);
    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('SubagentStart');
  });

  it('does not warn when only embeddable events are present even alongside non-embeddable', () => {
    // mixed: one embeddable + one non-embeddable → warn only about non-embeddable
    const canonical = makeCanonical({
      hooks: {
        PreToolUse: [{ matcher: 'fs_write', command: 'lint.sh' }],
        Notification: [{ matcher: '**', command: 'notify.sh' }],
      },
    });
    const result = lintHooks(canonical);
    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('Notification');
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

  it('returns empty when only allow is non-empty (embedded in allowedTools)', () => {
    // allow maps cleanly to allowedTools — no warning needed
    const canonical = makeCanonical({
      permissions: { allow: ['Bash(git:*)'], deny: [], ask: [] },
    });
    const result = lintPermissions(canonical);
    expect(result).toHaveLength(0);
  });

  it('warns when deny is non-empty (no Amazon Q equivalent for deny)', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: ['Bash'], ask: [] },
    });
    const result = lintPermissions(canonical);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('.agentsmesh/permissions.yaml');
    expect(result[0].target).toBe('amazon-q');
    expect(result[0].level).toBe('warning');
    expect(result[0].message).toContain('deny');
  });

  it('warns when ask is non-empty (no Amazon Q equivalent for ask)', () => {
    const canonical = makeCanonical({
      permissions: { allow: [], deny: [], ask: ['Bash(rm:*)'] },
    });
    const result = lintPermissions(canonical);
    expect(result).toHaveLength(1);
    expect(result[0].message).toContain('ask');
  });

  it('warns exactly once when both deny and ask are non-empty', () => {
    const canonical = makeCanonical({
      permissions: { allow: ['Read'], deny: ['Bash'], ask: ['Write'] },
    });
    const result = lintPermissions(canonical);
    expect(result).toHaveLength(1);
  });
});

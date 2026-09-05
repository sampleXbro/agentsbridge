import { describe, it, expect } from 'vitest';
import { lintHooks } from '../../../../src/targets/cursor/lint.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

function makeCanonical(hooks: CanonicalFiles['hooks']): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks,
    ignore: [],
  };
}

describe('lintHooks (cursor)', () => {
  it('returns no diagnostics when hooks is null', () => {
    expect(lintHooks(makeCanonical(null))).toEqual([]);
  });

  it('returns no diagnostics when every event maps to a Cursor event', () => {
    const diags = lintHooks(
      makeCanonical({
        PreToolUse: [{ matcher: '*', type: 'command', command: 'lint' }],
        UserPromptSubmit: [{ matcher: '*', type: 'command', command: 'check' }],
      }),
    );
    expect(diags).toEqual([]);
  });

  it('warns when a canonical event has no Cursor equivalent', () => {
    const diags = lintHooks(
      makeCanonical({
        Notification: [{ matcher: '*', type: 'command', command: 'notify' }],
      }),
    );
    expect(diags).toHaveLength(1);
    expect(diags[0]!.message).toContain('Notification');
    expect(diags[0]!.level).toBe('warning');
  });

  it('does NOT warn about best-effort agentsmesh events (PostToolUseFailure)', () => {
    // The lessons recall/capture scaffold injects PostToolUseFailure; Cursor cannot
    // represent it, but dropping it is not user data loss, so warning would be
    // permanent and unfixable. A user-authored unmapped event still warns.
    const diags = lintHooks(
      makeCanonical({
        PostToolUseFailure: [{ matcher: '*', type: 'command', command: 'agentsmesh lessons hook' }],
      }),
    );
    expect(diags).toEqual([]);
  });

  it('warns when a user-authored hook shares a best-effort event with the recall hook', () => {
    const diags = lintHooks(
      makeCanonical({
        PostToolUseFailure: [
          { matcher: '*', type: 'command', command: 'agentsmesh lessons hook' },
          { matcher: '*', type: 'command', command: 'echo failed' },
        ],
      }),
    );
    expect(diags).toHaveLength(1);
    expect(diags[0]!.message).toContain('PostToolUseFailure');
  });
});

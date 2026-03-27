import { describe, expect, it } from 'vitest';
import type { CanonicalFiles } from '../../../src/core/types.js';
import { lintHooks } from '../../../src/core/lint/hooks.js';

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

describe('lintHooks', () => {
  it('returns no diagnostics when hooks are missing', () => {
    expect(lintHooks(makeCanonical(null), 'gemini-cli')).toEqual([]);
  });

  it('returns no diagnostics for supported gemini-cli events', () => {
    expect(
      lintHooks(
        makeCanonical({
          PreToolUse: [{ matcher: '*', command: 'echo pre' }],
          PostToolUse: [{ matcher: '*', command: 'echo post' }],
          Notification: [{ matcher: '*', command: 'echo note' }],
        }),
        'gemini-cli',
      ),
    ).toEqual([]);
  });

  it('warns for unsupported gemini-cli hook events', () => {
    const diagnostics = lintHooks(
      makeCanonical({
        SubagentStop: [{ matcher: '*', command: 'echo stop' }],
      }),
      'gemini-cli',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('only PreToolUse, PostToolUse, and Notification');
  });

  it('warns for unsupported copilot hook events', () => {
    const diagnostics = lintHooks(
      makeCanonical({
        SubagentStart: [{ matcher: '*', command: 'echo start' }],
      }),
      'copilot',
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('UserPromptSubmit');
  });

  it('returns no diagnostics for unrelated targets', () => {
    expect(
      lintHooks(
        makeCanonical({
          SubagentStart: [{ matcher: '*', command: 'echo start' }],
        }),
        'claude-code',
      ),
    ).toEqual([]);
  });
});

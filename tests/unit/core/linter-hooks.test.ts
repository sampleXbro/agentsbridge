import { describe, expect, it } from 'vitest';
import type { CanonicalFiles } from '../../../src/core/types.js';
import { lintHooks as lintGeminiHooks } from '../../../src/targets/gemini-cli/lint.js';
import { lintHooks as lintCopilotHooks } from '../../../src/targets/copilot/lint.js';
import { lintHooks as lintKiroHooks } from '../../../src/targets/kiro/lint.js';

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

describe('per-target lint.hooks hooks', () => {
  it('returns no diagnostics when hooks are missing', () => {
    expect(lintGeminiHooks(makeCanonical(null))).toEqual([]);
  });

  it('returns no diagnostics for supported gemini-cli events', () => {
    expect(
      lintGeminiHooks(
        makeCanonical({
          PreToolUse: [{ matcher: '*', command: 'echo pre' }],
          PostToolUse: [{ matcher: '*', command: 'echo post' }],
          Notification: [{ matcher: '*', command: 'echo note' }],
        }),
      ),
    ).toEqual([]);
  });

  it('warns for unsupported gemini-cli hook events', () => {
    const diagnostics = lintGeminiHooks(
      makeCanonical({
        SubagentStop: [{ matcher: '*', command: 'echo stop' }],
      }),
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('only PreToolUse, PostToolUse, and Notification');
  });

  it('warns for unsupported copilot hook events', () => {
    const diagnostics = lintCopilotHooks(
      makeCanonical({
        SubagentStart: [{ matcher: '*', command: 'echo start' }],
      }),
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('UserPromptSubmit');
  });

  it('warns for unsupported kiro hook events', () => {
    const diagnostics = lintKiroHooks(
      makeCanonical({
        Notification: [{ matcher: '*', command: 'echo note' }],
      }),
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.message).toContain('Kiro hooks');
  });
});

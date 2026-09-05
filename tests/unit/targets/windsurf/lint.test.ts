import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintHooks } from '../../../../src/targets/windsurf/lint.js';

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

describe('lintHooks (windsurf)', () => {
  it('returns nothing when hooks are absent', () => {
    expect(lintHooks(makeCanonical(null))).toEqual([]);
    expect(lintHooks(makeCanonical({}))).toEqual([]);
  });

  it('stays silent for wildcard matchers', () => {
    const diags = lintHooks(
      makeCanonical({
        PreToolUse: [
          { matcher: '*', command: 'echo a' },
          { matcher: '', command: 'echo b' },
          { matcher: '.*', command: 'echo c' },
        ],
      }),
    );
    expect(diags).toEqual([]);
  });

  it('warns once per matcher-scoped hook because Windsurf hooks have no matcher', () => {
    const diags = lintHooks(
      makeCanonical({
        PreToolUse: [{ matcher: 'Bash', command: 'echo pre' }],
        PostToolUse: [{ matcher: 'Edit|Write', command: 'echo post' }],
      }),
    );
    expect(diags).toHaveLength(2);
    expect(diags[0]).toEqual({
      level: 'warning',
      file: '.agentsmesh/hooks.yaml',
      target: 'windsurf',
      message:
        'Windsurf hooks have no matcher field; PreToolUse hook "echo pre" runs on every PreToolUse event (matcher "Bash" is not projected).',
    });
    expect(diags[1]!.message).toContain('matcher "Edit|Write"');
  });
});

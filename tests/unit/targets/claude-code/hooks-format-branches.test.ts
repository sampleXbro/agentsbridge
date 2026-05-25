/**
 * Branch coverage for src/targets/claude-code/hooks-format.ts:
 * - canonical.hooks missing → {} (line 15 short-circuit).
 * - non-array entries are skipped (line 18).
 * - hook with timeout property keeps the field (line 29).
 * - 'prompt' type uses prompt|command fallback (line 24).
 * - empty translated array does NOT add the event key (line 32).
 */

import { describe, it, expect } from 'vitest';
import { buildClaudeHooksObjectFromCanonical } from '../../../../src/targets/claude-code/hooks-format.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

function base(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

describe('buildClaudeHooksObjectFromCanonical', () => {
  it('returns {} when canonical.hooks is null', () => {
    expect(buildClaudeHooksObjectFromCanonical(base())).toEqual({});
  });

  it('returns {} when canonical.hooks is empty object', () => {
    expect(buildClaudeHooksObjectFromCanonical({ ...base(), hooks: {} })).toEqual({});
  });

  it('emits "command" hook with timeout preserved', () => {
    const out = buildClaudeHooksObjectFromCanonical({
      ...base(),
      hooks: {
        PostToolUse: [{ matcher: 'Write', command: 'fmt', type: 'command', timeout: 5000 }],
      },
    });
    expect(
      (out.PostToolUse as Array<{ hooks: Array<Record<string, unknown>> }>)[0]!.hooks[0],
    ).toEqual({ type: 'command', command: 'fmt', timeout: 5000 });
  });

  it('emits "prompt" hook using prompt over command', () => {
    const out = buildClaudeHooksObjectFromCanonical({
      ...base(),
      hooks: {
        UserPromptSubmit: [{ matcher: '*', prompt: 'review!', type: 'prompt' }],
      },
    });
    const arr = out.UserPromptSubmit as Array<{ hooks: Array<Record<string, unknown>> }>;
    expect(arr[0]!.hooks[0]).toEqual({ type: 'prompt', prompt: 'review!' });
  });

  it('skips entries that lack any text payload (hasHookText false)', () => {
    const out = buildClaudeHooksObjectFromCanonical({
      ...base(),
      hooks: {
        PostToolUse: [{ matcher: '*', type: 'command' } as never],
      },
    });
    // No translated entries → event key omitted.
    expect(out).toEqual({});
  });

  it('omits the event key when entries is not an array', () => {
    const out = buildClaudeHooksObjectFromCanonical({
      ...base(),
      hooks: { PostToolUse: 'not-an-array' as never },
    });
    expect(out).toEqual({});
  });
});

import { describe, it, expect } from 'vitest';
import type { Hooks } from '../../../../src/core/types.js';
import {
  toDeepagentsHooks,
  deepagentsHooksToCanonical,
  unmappedDeepagentsHookEvents,
} from '../../../../src/targets/deepagents-cli/hooks-format.js';

describe('toDeepagentsHooks', () => {
  it('maps SessionStart to session.start, wrapping the command for bash -c', () => {
    const hooks: Hooks = {
      SessionStart: [{ matcher: '', command: 'echo hi' }],
    };
    const result = toDeepagentsHooks(hooks);
    expect(result).toEqual([{ command: ['bash', '-c', 'echo hi'], events: ['session.start'] }]);
  });

  it('maps SessionEnd, UserPromptSubmit, Stop, and PreCompact', () => {
    const hooks: Hooks = {
      SessionEnd: [{ matcher: '', command: 'a' }],
      UserPromptSubmit: [{ matcher: '', command: 'b' }],
      Stop: [{ matcher: '', command: 'c' }],
      PreCompact: [{ matcher: '', command: 'd' }],
    };
    const result = toDeepagentsHooks(hooks);
    const events = result.flatMap((h) => h.events);
    expect(events.sort()).toEqual(
      ['context.compact', 'session.end', 'task.complete', 'user.prompt'].sort(),
    );
  });

  it('drops unmapped events (PreToolUse, PostToolUse, Notification)', () => {
    const hooks: Hooks = {
      PreToolUse: [{ matcher: '*', command: 'a' }],
      PostToolUse: [{ matcher: '*', command: 'b' }],
      Notification: [{ matcher: '', command: 'c' }],
    };
    expect(toDeepagentsHooks(hooks)).toEqual([]);
  });

  it('drops prompt-type hooks (no LLM-prompt hooks in Deep Agents)', () => {
    const hooks: Hooks = {
      SessionStart: [{ matcher: '', type: 'prompt', prompt: 'summarize' }],
    };
    expect(toDeepagentsHooks(hooks)).toEqual([]);
  });

  it('drops entries with no command text', () => {
    const hooks: Hooks = { SessionStart: [{ matcher: '', command: '' }] };
    expect(toDeepagentsHooks(hooks)).toEqual([]);
  });

  it('returns [] for empty hooks', () => {
    expect(toDeepagentsHooks({})).toEqual([]);
  });
});

describe('deepagentsHooksToCanonical', () => {
  it('round-trips a bash -c wrapped command back to the original text', () => {
    const canonical = deepagentsHooksToCanonical([
      { command: ['bash', '-c', 'echo hi'], events: ['session.start'] },
    ]);
    expect(canonical.SessionStart).toEqual([{ matcher: '', type: 'command', command: 'echo hi' }]);
  });

  it('joins non bash -c command arrays with spaces', () => {
    const canonical = deepagentsHooksToCanonical([
      { command: ['python3', 'handler.py'], events: ['task.complete'] },
    ]);
    expect(canonical.Stop).toEqual([
      { matcher: '', type: 'command', command: 'python3 handler.py' },
    ]);
  });

  it('maps omitted/empty events to all supported canonical events', () => {
    const canonical = deepagentsHooksToCanonical([{ command: ['echo', 'all'], events: [] }]);
    expect(Object.keys(canonical).sort()).toEqual(
      ['PreCompact', 'SessionEnd', 'SessionStart', 'Stop', 'UserPromptSubmit'].sort(),
    );
  });

  it('drops entries with no command', () => {
    expect(deepagentsHooksToCanonical([{ command: [], events: ['session.start'] }])).toEqual({});
  });

  it('ignores unrecognized event names', () => {
    const canonical = deepagentsHooksToCanonical([
      { command: ['echo', 'hi'], events: ['tool.error'] },
    ]);
    expect(canonical).toEqual({});
  });

  it('returns {} for non-array input', () => {
    expect(deepagentsHooksToCanonical(undefined)).toEqual({});
    expect(deepagentsHooksToCanonical({})).toEqual({});
  });

  it('skips non-object entries in the hooks array (null, primitive)', () => {
    const canonical = deepagentsHooksToCanonical([
      null,
      'not-an-object',
      42,
      { command: ['echo', 'hi'], events: ['session.start'] },
    ]);
    expect(canonical.SessionStart).toEqual([{ matcher: '', type: 'command', command: 'echo hi' }]);
  });

  it('treats a missing `events` key (not an array at all) as "receive all"', () => {
    const canonical = deepagentsHooksToCanonical([{ command: ['echo', 'all'] }]);
    expect(Object.keys(canonical).sort()).toEqual(
      ['PreCompact', 'SessionEnd', 'SessionStart', 'Stop', 'UserPromptSubmit'].sort(),
    );
  });
});

describe('unmappedDeepagentsHookEvents', () => {
  it('flags events with no Deep Agents equivalent', () => {
    const hooks: Hooks = {
      PreToolUse: [{ matcher: '*', command: 'a' }],
      SessionStart: [{ matcher: '', command: 'b' }],
    };
    expect(unmappedDeepagentsHookEvents(hooks)).toEqual(['PreToolUse']);
  });

  it('excludes best-effort agentsmesh-injected events (PostToolUseFailure has no Deep Agents equivalent but is not user-authored data loss)', () => {
    const hooks: Hooks = { PostToolUseFailure: [{ matcher: '', command: 'a' }] };
    expect(unmappedDeepagentsHookEvents(hooks)).toEqual([]);
  });

  it('returns [] when nothing is unmapped', () => {
    expect(unmappedDeepagentsHookEvents({})).toEqual([]);
  });
});

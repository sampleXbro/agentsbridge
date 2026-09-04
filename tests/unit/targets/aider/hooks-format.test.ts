import { describe, it, expect } from 'vitest';
import type { Hooks } from '../../../../src/core/hook-types.js';
import { AIDER_HOOK_KEYS, projectAiderHooks } from '../../../../src/targets/aider/hooks-format.js';
import {
  aiderConfToHookEntries,
  hasAiderHookKeys,
} from '../../../../src/targets/aider/hooks-read.js';

describe('projectAiderHooks', () => {
  it('maps edit-scoped PostToolUse hooks to the lint-cmd list', () => {
    const hooks: Hooks = {
      PostToolUse: [
        { matcher: 'Write|Edit', command: 'prettier --write $FILE_PATH' },
        { matcher: 'MultiEdit', command: 'eslint --fix' },
      ],
    };

    const { keys, unmapped, narrowed } = projectAiderHooks(hooks);

    expect(keys['lint-cmd']).toEqual(['prettier --write $FILE_PATH', 'eslint --fix']);
    expect(keys['auto-lint']).toBe(true);
    expect(unmapped).toHaveLength(0);
    expect(narrowed).toHaveLength(0);
  });

  it('maps an unscoped PostToolUse hook to test-cmd and reports the narrowing', () => {
    const hooks: Hooks = { PostToolUse: [{ matcher: '*', command: 'npm test' }] };

    const { keys, narrowed } = projectAiderHooks(hooks);

    expect(keys['test-cmd']).toBe('npm test');
    expect(keys['auto-test']).toBe(true);
    expect(narrowed).toEqual([{ event: 'PostToolUse', matcher: '*', command: 'npm test' }]);
  });

  it('treats an empty matcher as unscoped', () => {
    const { keys } = projectAiderHooks({ PostToolUse: [{ matcher: '', command: 'npm test' }] });
    expect(keys['test-cmd']).toBe('npm test');
  });

  it('maps the first Notification hook to notifications-command', () => {
    const { keys } = projectAiderHooks({
      Notification: [{ matcher: '*', command: 'terminal-notifier -message aider' }],
    });
    expect(keys['notifications-command']).toBe('terminal-notifier -message aider');
  });

  it('emits keys in aider config order', () => {
    const { keys } = projectAiderHooks({
      Notification: [{ matcher: '*', command: 'notify' }],
      PostToolUse: [
        { matcher: 'Edit', command: 'lint' },
        { matcher: '*', command: 'test' },
      ],
    });
    expect(Object.keys(keys)).toEqual([...AIDER_HOOK_KEYS]);
  });

  it('drops a second unscoped PostToolUse hook and a second Notification hook', () => {
    const { keys, unmapped } = projectAiderHooks({
      PostToolUse: [
        { matcher: '*', command: 'first' },
        { matcher: '*', command: 'second' },
      ],
      Notification: [
        { matcher: '*', command: 'notify-a' },
        { matcher: '*', command: 'notify-b' },
      ],
    });

    expect(keys['test-cmd']).toBe('first');
    expect(keys['notifications-command']).toBe('notify-a');
    expect(unmapped.map((entry) => entry.command)).toEqual(['second', 'notify-b']);
  });

  it('reports PostToolUse hooks scoped to non-edit tools as unmapped', () => {
    const { keys, unmapped } = projectAiderHooks({
      PostToolUse: [{ matcher: 'Bash', command: 'audit' }],
    });
    expect(keys).toEqual({});
    expect(unmapped).toEqual([{ event: 'PostToolUse', matcher: 'Bash', command: 'audit' }]);
  });

  it('reports events aider has no key for', () => {
    const { unmapped } = projectAiderHooks({ PreToolUse: [{ matcher: '*', command: 'guard' }] });
    expect(unmapped).toEqual([{ event: 'PreToolUse', matcher: '*', command: 'guard' }]);
  });

  it('does not report best-effort events injected by agentsmesh', () => {
    const { unmapped } = projectAiderHooks({
      SessionStart: [{ matcher: '*', command: 'recall' }],
      UserPromptSubmit: [{ matcher: '*', command: 'recall' }],
      PostToolUseFailure: [{ matcher: '*', command: 'capture' }],
    });
    expect(unmapped).toHaveLength(0);
  });

  it('drops prompt-type and command-less entries', () => {
    const { keys, unmapped } = projectAiderHooks({
      PostToolUse: [
        { matcher: 'Edit', command: 'ignored', type: 'prompt', prompt: 'think' },
        { matcher: 'Edit', command: '   ' },
      ],
    });
    expect(keys).toEqual({});
    expect(unmapped).toHaveLength(2);
  });

  it('returns an empty projection for null hooks', () => {
    expect(projectAiderHooks(null)).toEqual({ keys: {}, mapped: [], unmapped: [], narrowed: [] });
  });

  it('tags every entry that reached a key with that key', () => {
    const { mapped } = projectAiderHooks({
      Notification: [{ matcher: '*', command: 'notify' }],
      PostToolUse: [
        { matcher: 'Edit', command: 'lint' },
        { matcher: '*', command: 'test' },
      ],
    });
    expect(mapped).toEqual([
      { event: 'Notification', matcher: '*', command: 'notify', key: 'notifications-command' },
      { event: 'PostToolUse', matcher: 'Edit', command: 'lint', key: 'lint-cmd' },
      { event: 'PostToolUse', matcher: '*', command: 'test', key: 'test-cmd' },
    ]);
  });

  it('leaves dropped entries out of mapped', () => {
    const { mapped } = projectAiderHooks({
      PostToolUse: [
        { matcher: '*', command: 'first' },
        { matcher: '*', command: 'second' },
      ],
    });
    expect(mapped.map((entry) => entry.command)).toEqual(['first']);
  });

  it('ignores non-array event values', () => {
    const hooks = { PostToolUse: 'nope' } as unknown as Hooks;
    expect(projectAiderHooks(hooks).keys).toEqual({});
  });
});

describe('aiderConfToHookEntries', () => {
  it('reads lint-cmd back as edit-scoped PostToolUse hooks', () => {
    expect(aiderConfToHookEntries({ 'lint-cmd': ['prettier', 'eslint'] })).toEqual([
      {
        key: 'lint-cmd',
        event: 'PostToolUse',
        entry: { matcher: 'Write|Edit', type: 'command', command: 'prettier' },
      },
      {
        key: 'lint-cmd',
        event: 'PostToolUse',
        entry: { matcher: 'Write|Edit', type: 'command', command: 'eslint' },
      },
    ]);
  });

  it('accepts a scalar lint-cmd', () => {
    expect(aiderConfToHookEntries({ 'lint-cmd': 'ruff check' })).toEqual([
      {
        key: 'lint-cmd',
        event: 'PostToolUse',
        entry: { matcher: 'Write|Edit', type: 'command', command: 'ruff check' },
      },
    ]);
  });

  it('skips lint-cmd when auto-lint is disabled', () => {
    expect(aiderConfToHookEntries({ 'lint-cmd': 'ruff', 'auto-lint': false })).toEqual([]);
  });

  it('reads test-cmd only when auto-test is on', () => {
    expect(aiderConfToHookEntries({ 'test-cmd': 'pytest' })).toEqual([]);
    expect(aiderConfToHookEntries({ 'test-cmd': 'pytest', 'auto-test': true })).toEqual([
      {
        key: 'test-cmd',
        event: 'PostToolUse',
        entry: { matcher: '*', type: 'command', command: 'pytest' },
      },
    ]);
  });

  it('reads notifications-command back as a Notification hook', () => {
    expect(aiderConfToHookEntries({ 'notifications-command': 'notify me' })).toEqual([
      {
        key: 'notifications-command',
        event: 'Notification',
        entry: { matcher: '*', type: 'command', command: 'notify me' },
      },
    ]);
  });

  it('ignores blank and wrongly typed values', () => {
    expect(
      aiderConfToHookEntries({
        'lint-cmd': ['  ', 7],
        'test-cmd': 12,
        'auto-test': true,
        'notifications-command': '   ',
      }),
    ).toEqual([]);
  });

  it('returns nothing for a non-object config', () => {
    expect(aiderConfToHookEntries('nope')).toEqual([]);
    expect(aiderConfToHookEntries(null)).toEqual([]);
  });
});

describe('hasAiderHookKeys', () => {
  it('is true only when the config carries an aider hook key', () => {
    expect(hasAiderHookKeys({ read: ['CONVENTIONS.md'] })).toBe(false);
    expect(hasAiderHookKeys({ 'auto-lint': false })).toBe(true);
    expect(hasAiderHookKeys(null)).toBe(false);
  });
});

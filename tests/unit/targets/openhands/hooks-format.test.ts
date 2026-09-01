import { describe, it, expect } from 'vitest';
import {
  OPENHANDS_HOOK_EVENTS,
  buildOpenhandsHooks,
  droppedHookEntryEvents,
  normalizeOpenhandsHookDocument,
} from '../../../../src/targets/openhands/hooks-format.js';

describe('buildOpenhandsHooks', () => {
  it('maps every supported canonical event to its snake_case key', () => {
    const hooks = Object.fromEntries(
      OPENHANDS_HOOK_EVENTS.map((event) => [event, [{ matcher: '*', command: `run-${event}` }]]),
    );
    expect(Object.keys(buildOpenhandsHooks(hooks)!)).toEqual([
      'pre_tool_use',
      'post_tool_use',
      'user_prompt_submit',
      'session_start',
      'session_end',
      'stop',
    ]);
  });

  it('emits the matcher-group shape with a command handler and optional timeout', () => {
    const built = buildOpenhandsHooks({
      PreToolUse: [{ matcher: 'Bash', command: 'guard.sh', timeout: 30 }],
    });
    expect(built).toEqual({
      pre_tool_use: [
        { matcher: 'Bash', hooks: [{ type: 'command', command: 'guard.sh', timeout: 30 }] },
      ],
    });
  });

  it('drops unsupported events rather than emitting an unrecognised key', () => {
    expect(buildOpenhandsHooks({ Notification: [{ matcher: '*', command: 'echo' }] })).toBeNull();
  });

  // HookType.PROMPT is a first-class handler type (hooks/config.py HookType), and
  // `_validate_type_fields` FORBIDS `command` on a prompt handler.
  it('emits a prompt handler with prompt and no command key', () => {
    expect(
      buildOpenhandsHooks({
        Stop: [{ matcher: '*', command: '', type: 'prompt', prompt: 'summarise' }],
      }),
    ).toEqual({ stop: [{ matcher: '*', hooks: [{ type: 'prompt', prompt: 'summarise' }] }] });
  });

  it('keeps the timeout on a prompt handler', () => {
    expect(
      buildOpenhandsHooks({
        Stop: [{ matcher: '*', command: '', type: 'prompt', prompt: 'wrap up', timeout: 15 }],
      }),
    ).toEqual({
      stop: [{ matcher: '*', hooks: [{ type: 'prompt', prompt: 'wrap up', timeout: 15 }] }],
    });
  });

  it('drops an entry that is neither a usable command nor a usable prompt', () => {
    expect(buildOpenhandsHooks({ Stop: [{ matcher: '*', command: '' }] })).toBeNull();
    expect(
      buildOpenhandsHooks({ Stop: [{ matcher: '*', command: '', type: 'prompt', prompt: '' }] }),
    ).toBeNull();
  });

  it('returns null for null, empty, and non-array event values', () => {
    expect(buildOpenhandsHooks(null)).toBeNull();
    expect(buildOpenhandsHooks({})).toBeNull();
    expect(buildOpenhandsHooks({ Stop: undefined })).toBeNull();
  });
});

describe('normalizeOpenhandsHookDocument', () => {
  it('returns snake_case event keys for both casings and the legacy wrapper', () => {
    expect(normalizeOpenhandsHookDocument({ hooks: { PostToolUse: [], session_end: [] } })).toEqual(
      { post_tool_use: [], session_end: [] },
    );
  });

  it('returns null for non-objects', () => {
    expect(normalizeOpenhandsHookDocument(null)).toBeNull();
    expect(normalizeOpenhandsHookDocument([])).toBeNull();
    expect(normalizeOpenhandsHookDocument({ hooks: 7 })).toBeNull();
  });

  it('drops keys that are not one of the six events', () => {
    expect(normalizeOpenhandsHookDocument({ Notification: [], stop: [] })).toEqual({ stop: [] });
  });
});

describe('droppedHookEntryEvents', () => {
  it('names supported events with an entry that maps to no handler', () => {
    expect(
      droppedHookEntryEvents({
        Stop: [{ matcher: '*', command: '' }],
        PreToolUse: [{ matcher: '*', command: 'ok' }],
      }),
    ).toEqual(['Stop']);
  });

  it('stays quiet for prompt handlers, which are now emitted', () => {
    expect(
      droppedHookEntryEvents({
        Stop: [{ matcher: '*', command: '', type: 'prompt', prompt: 'summarise' }],
      }),
    ).toEqual([]);
  });

  it('returns nothing for null hooks or unsupported events', () => {
    expect(droppedHookEntryEvents(null)).toEqual([]);
    expect(droppedHookEntryEvents({ Notification: [{ matcher: '*', command: '' }] })).toEqual([]);
    expect(droppedHookEntryEvents({ Stop: undefined })).toEqual([]);
  });
});

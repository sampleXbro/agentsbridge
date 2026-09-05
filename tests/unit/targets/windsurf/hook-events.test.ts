import { describe, it, expect } from 'vitest';
import { BEST_EFFORT_HOOK_EVENTS } from '../../../../src/core/hook-types.js';
import {
  KNOWN_CANONICAL_HOOK_EVENTS,
  canonicalHookEventName,
  windsurfEventName,
} from '../../../../src/targets/windsurf/hook-events.js';

describe('windsurf hook event names', () => {
  it('covers every canonical event, including the best-effort scaffold events', () => {
    for (const event of [
      'PreToolUse',
      'PostToolUse',
      'Notification',
      'UserPromptSubmit',
      'SubagentStart',
      'SubagentStop',
      ...BEST_EFFORT_HOOK_EVENTS,
    ]) {
      expect(KNOWN_CANONICAL_HOOK_EVENTS).toContain(event);
    }
  });

  it('inverts generate for every canonical event', () => {
    for (const event of KNOWN_CANONICAL_HOOK_EVENTS) {
      expect(canonicalHookEventName(windsurfEventName(event))).toBe(event);
    }
  });

  it('maps SessionStart to session_start and back', () => {
    expect(windsurfEventName('SessionStart')).toBe('session_start');
    expect(canonicalHookEventName('session_start')).toBe('SessionStart');
  });

  it('drops snake_case events that have no canonical equivalent', () => {
    expect(canonicalHookEventName('pre_read_code')).toBeNull();
    expect(canonicalHookEventName('stop')).toBeNull();
  });
});

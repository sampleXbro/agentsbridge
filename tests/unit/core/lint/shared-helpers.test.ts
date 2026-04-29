import { describe, expect, it } from 'vitest';
import {
  createCommandMetadataWarning,
  createUnsupportedHookWarning,
  createWarning,
} from '../../../../src/core/lint/shared/helpers.js';

describe('createWarning', () => {
  it('produces a warning diagnostic', () => {
    expect(createWarning('a.md', 'cursor', 'msg')).toEqual({
      level: 'warning',
      file: 'a.md',
      target: 'cursor',
      message: 'msg',
    });
  });
});

describe('createCommandMetadataWarning', () => {
  it('joins unsupportedFields with "and"', () => {
    const out = createCommandMetadataWarning('a.md', 'cursor', ['x', 'y']);
    expect(out.message).toBe('cursor command files do not project canonical x and y metadata.');
  });

  it('handles single field', () => {
    const out = createCommandMetadataWarning('a.md', 'cursor', ['x']);
    expect(out.message).toBe('cursor command files do not project canonical x metadata.');
  });
});

describe('createUnsupportedHookWarning — Oxford comma', () => {
  it('formats single supported event', () => {
    const out = createUnsupportedHookWarning('UnknownHook', 'copilot', ['PreToolUse']);
    expect(out.message).toContain('only PreToolUse are projected');
  });

  it('formats two supported events with "and"', () => {
    const out = createUnsupportedHookWarning('UnknownHook', 'copilot', [
      'PreToolUse',
      'PostToolUse',
    ]);
    expect(out.message).toContain('only PreToolUse and PostToolUse are projected');
  });

  it('formats three supported events with Oxford comma', () => {
    const out = createUnsupportedHookWarning('UnknownHook', 'copilot', [
      'PreToolUse',
      'PostToolUse',
      'Notification',
    ]);
    expect(out.message).toContain('only PreToolUse, PostToolUse, and Notification are projected');
  });

  it('handles empty supported events', () => {
    const out = createUnsupportedHookWarning('UnknownHook', 'copilot', []);
    expect(out.message).toContain('only  are projected');
  });

  it('uses unsupportedBy when provided', () => {
    const out = createUnsupportedHookWarning('UnknownHook', 'copilot', ['PreToolUse'], {
      unsupportedBy: 'Copilot hooks',
    });
    expect(out.message).toContain('not supported by Copilot hooks');
  });

  it('falls back to target when unsupportedBy is not provided', () => {
    const out = createUnsupportedHookWarning('UnknownHook', 'cline', ['PreToolUse']);
    expect(out.message).toContain('not supported by cline');
  });
});

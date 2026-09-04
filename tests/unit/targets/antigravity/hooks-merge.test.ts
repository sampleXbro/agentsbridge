/**
 * `.agents/hooks.json` keys the document by user-chosen handler NAME mapping to
 * an object, while agentsmesh writes canonical event names mapping to an array.
 * That shape difference is the ownership line, and there is no hooks importer
 * for Antigravity — an overwritten handler is gone for good.
 */

import { describe, expect, it } from 'vitest';
import {
  mergeAntigravityHooks,
  mergeAntigravityHooksContent,
} from '../../../../src/targets/antigravity/hooks-merge.js';
import {
  ANTIGRAVITY_GLOBAL_HOOKS_FILE,
  ANTIGRAVITY_HOOKS_FILE,
  ANTIGRAVITY_MCP_CONFIG,
} from '../../../../src/targets/antigravity/constants.js';

const GENERATED = JSON.stringify({ PreToolUse: [{ matcher: 'Bash', hooks: [] }] });

describe('mergeAntigravityHooksContent', () => {
  it('keeps the user handlers and replaces the generated event keys', () => {
    const base = JSON.stringify({
      'my-hook': { enabled: true, PreToolUse: [{ matcher: '*' }] },
      PreToolUse: [{ matcher: 'stale', hooks: [] }],
      PostToolUse: [{ matcher: 'gone', hooks: [] }],
    });

    const merged = JSON.parse(mergeAntigravityHooksContent(base, GENERATED)!);

    expect(merged['my-hook']).toEqual({ enabled: true, PreToolUse: [{ matcher: '*' }] });
    expect(merged.PreToolUse).toEqual([{ matcher: 'Bash', hooks: [] }]);
    // Revocation: an event the run no longer emits is dropped.
    expect(merged.PostToolUse).toBeUndefined();
  });

  it('returns null when there is no base to merge into', () => {
    expect(mergeAntigravityHooksContent(null, GENERATED)).toBeNull();
    expect(mergeAntigravityHooksContent('  ', GENERATED)).toBeNull();
  });

  it('returns null when the generated content is not a JSON object', () => {
    expect(mergeAntigravityHooksContent('{}', '[]')).toBeNull();
  });

  it('preserves a base it cannot parse', () => {
    expect(mergeAntigravityHooksContent('{ broken', GENERATED)).toBe('{ broken');
  });
});

describe('mergeAntigravityHooks claims both scope constants', () => {
  it('claims the project and global hooks paths and nothing else', () => {
    const base = '{"my-hook":{}}';
    expect(
      mergeAntigravityHooks(base, undefined, GENERATED, ANTIGRAVITY_HOOKS_FILE),
    ).not.toBeNull();
    expect(
      mergeAntigravityHooks(base, undefined, GENERATED, ANTIGRAVITY_GLOBAL_HOOKS_FILE),
    ).not.toBeNull();
    expect(mergeAntigravityHooks(base, undefined, GENERATED, ANTIGRAVITY_MCP_CONFIG)).toBeNull();
  });

  it('prefers the pending result over what is on disk', () => {
    const merged = mergeAntigravityHooks(
      '{"from":"disk"}',
      { content: '{"from":"pending"}' },
      GENERATED,
      ANTIGRAVITY_HOOKS_FILE,
    );
    expect(JSON.parse(merged!).from).toBe('pending');
  });
});

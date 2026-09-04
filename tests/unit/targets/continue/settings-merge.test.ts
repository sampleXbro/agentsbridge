import { describe, it, expect } from 'vitest';
import { mergeContinueSettings } from '../../../../src/targets/continue/hooks.js';
import { CONTINUE_SETTINGS } from '../../../../src/targets/continue/constants.js';

describe('mergeContinueSettings', () => {
  it('replaces only the hooks key and keeps hand-written settings', () => {
    const merged = mergeContinueSettings(
      '{\n  "disableAllHooks": false,\n  "hooks": { "Stop": [] },\n  "myOwnKey": 1\n}',
      undefined,
      '{"hooks":{"PreToolUse":[]}}',
      CONTINUE_SETTINGS,
    );
    expect(JSON.parse(merged!)).toEqual({
      disableAllHooks: false,
      hooks: { PreToolUse: [] },
      myOwnKey: 1,
    });
  });

  it('uses the pending in-memory result as the merge base over stale disk content', () => {
    const merged = mergeContinueSettings(
      '{"stale":true}',
      {
        target: 'continue',
        path: CONTINUE_SETTINGS,
        content: '{"fresh":true}',
        status: 'updated',
      },
      '{"hooks":{}}',
      CONTINUE_SETTINGS,
    );
    expect(JSON.parse(merged!)).toEqual({ fresh: true, hooks: {} });
  });

  it('defers to the shared merger for paths it does not own', () => {
    expect(mergeContinueSettings(null, undefined, '{}', '.continue/config.yaml')).toBeNull();
  });

  it('starts from an empty object when the existing file is absent or empty', () => {
    expect(
      JSON.parse(mergeContinueSettings(null, undefined, '{"hooks":{}}', CONTINUE_SETTINGS)!),
    ).toEqual({ hooks: {} });
    expect(
      JSON.parse(mergeContinueSettings('   ', undefined, '{"hooks":{}}', CONTINUE_SETTINGS)!),
    ).toEqual({ hooks: {} });
  });

  it('preserves a settings file agentsmesh cannot parse instead of replacing it', () => {
    const broken = '{\n  "description": "my plugin",\n  "disableAllHooks": false,\n';
    expect(mergeContinueSettings(broken, undefined, '{"hooks":{}}', CONTINUE_SETTINGS)).toBe(
      broken,
    );
  });

  it('preserves valid JSON that is not an object', () => {
    expect(mergeContinueSettings('[1,2]', undefined, '{"hooks":{}}', CONTINUE_SETTINGS)).toBe(
      '[1,2]',
    );
  });

  it('keeps the base untouched when the incoming payload is not JSON', () => {
    expect(mergeContinueSettings('{"a":1}', undefined, 'nope', CONTINUE_SETTINGS)).toBe('{"a":1}');
    expect(mergeContinueSettings(null, undefined, 'nope', CONTINUE_SETTINGS)).toBe('nope');
  });
});

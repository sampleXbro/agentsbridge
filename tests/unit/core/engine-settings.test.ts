import { describe, expect, it } from 'vitest';
import { mergeGeminiSettingsJson, mergeSettingsJson } from '../../../src/core/generate/settings.js';

describe('mergeSettingsJson', () => {
  // A base that is not a JSON object is preserved, not replaced: these paths are
  // comment-legal and rewriting them drops the user's comments and every key.
  it('preserves a non-object existing base rather than merging over it', () => {
    expect(mergeSettingsJson('null', '{"permissions":{"allow":["Read"]}}')).toBe('null');
  });

  it('merges into a well-formed base', () => {
    expect(mergeSettingsJson('{"model":"opus"}', '{"permissions":{"allow":["Read"]}}')).toBe(
      JSON.stringify(
        {
          model: 'opus',
          permissions: {
            allow: ['Read'],
            ask: [],
          },
        },
        null,
        2,
      ),
    );
  });
});

describe('mergeGeminiSettingsJson', () => {
  it('preserves a non-object existing base rather than merging hooks over it', () => {
    expect(mergeGeminiSettingsJson('null', '{"hooks":{"PostToolUse":[]}}')).toBe('null');
  });

  it('merges hook-only updates into a well-formed base', () => {
    expect(mergeGeminiSettingsJson('{"theme":"dark"}', '{"hooks":{"PostToolUse":[]}}')).toBe(
      JSON.stringify(
        {
          theme: 'dark',
          hooks: {
            PostToolUse: [],
          },
        },
        null,
        2,
      ),
    );
  });
});

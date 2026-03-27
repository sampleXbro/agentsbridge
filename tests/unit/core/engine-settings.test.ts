import { describe, expect, it } from 'vitest';
import { mergeGeminiSettingsJson, mergeSettingsJson } from '../../../src/core/generate/settings.js';

describe('mergeSettingsJson', () => {
  it('treats non-object existing JSON as empty before merging', () => {
    expect(mergeSettingsJson('null', '{"permissions":{"allow":["Read"]}}')).toBe(
      JSON.stringify(
        {
          permissions: {
            allow: ['Read'],
          },
        },
        null,
        2,
      ),
    );
  });
});

describe('mergeGeminiSettingsJson', () => {
  it('treats non-object existing JSON as empty and preserves hook-only updates', () => {
    expect(mergeGeminiSettingsJson('null', '{"hooks":{"PostToolUse":[]}}')).toBe(
      JSON.stringify(
        {
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

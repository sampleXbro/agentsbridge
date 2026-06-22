// tests/unit/cli/prompts/clack-prompter.test.ts
import { describe, it, expect } from 'vitest';
import { createClackPrompter } from '../../../../src/cli/prompts/clack-prompter.js';

describe('createClackPrompter', () => {
  it('returns a Prompter exposing every required method', () => {
    const p = createClackPrompter();
    for (const m of [
      'intro',
      'outro',
      'note',
      'select',
      'multiselect',
      'isCancel',
      'cancel',
    ] as const) {
      expect(typeof p[m]).toBe('function');
    }
  });

  it('isCancel delegates to clack (plain values are not cancel)', () => {
    const p = createClackPrompter();
    expect(p.isCancel('claude-code')).toBe(false);
    expect(p.isCancel(['claude-code'])).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { TARGET_IDS, isBuiltinTargetId } from '../../../src/targets/catalog/target-ids.js';

describe('TARGET_IDS', () => {
  it('contains exactly the 13 known target IDs', () => {
    expect([...TARGET_IDS].sort()).toStrictEqual(
      [
        'antigravity',
        'claude-code',
        'cline',
        'codex-cli',
        'continue',
        'copilot',
        'cursor',
        'gemini-cli',
        'junie',
        'kilo-code',
        'kiro',
        'roo-code',
        'windsurf',
      ].sort(),
    );
  });
});

describe('isBuiltinTargetId', () => {
  it.each([...TARGET_IDS])('returns true for known target "%s"', (id) => {
    expect(isBuiltinTargetId(id)).toBe(true);
  });

  it.each(['unknown', '', 'Claude-Code'])('returns false for "%s"', (value) => {
    expect(isBuiltinTargetId(value)).toBe(false);
  });
});

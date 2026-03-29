import { describe, expect, it } from 'vitest';
import { TARGET_IDS, isBuiltinTargetId } from '../../../src/targets/catalog/target-ids.js';

describe('TARGET_IDS', () => {
  it('contains exactly the 11 known target IDs', () => {
    expect([...TARGET_IDS]).toStrictEqual([
      'claude-code',
      'cursor',
      'copilot',
      'continue',
      'junie',
      'gemini-cli',
      'cline',
      'codex-cli',
      'windsurf',
      'antigravity',
      'roo-code',
    ]);
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

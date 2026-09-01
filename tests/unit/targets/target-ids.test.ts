import { describe, expect, it } from 'vitest';
import { TARGET_IDS, isBuiltinTargetId } from '../../../src/targets/catalog/target-ids.js';

describe('TARGET_IDS', () => {
  it('contains exactly the known target IDs', () => {
    expect([...TARGET_IDS].sort()).toStrictEqual(
      [
        'aider',
        'amazon-q',
        'amp',
        'antigravity',
        'augment-code',
        'claude-code',
        'cline',
        'codebuff',
        'codex-cli',
        'continue',
        'copilot',
        'crush',
        'cursor',
        'deepagents-cli',
        'factory-droid',
        'gemini-cli',
        'goose',
        'jules',
        'junie',
        'kimi-code',
        'kilo-code',
        'openhands',
        'kiro',
        'opencode',
        'pi-agent',
        'qwen-code',
        'replit-agent',
        'roo-code',
        'rovodev',
        'trae',
        'warp',
        'windsurf',
        'zed',
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

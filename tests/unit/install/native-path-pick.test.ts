/**
 * Native install path → target hint and scoping.
 */

import { describe, it, expect } from 'vitest';
import {
  targetHintFromNativePath,
  pathSupportsNativePick,
  resolveEffectiveTargetForInstall,
} from '../../../src/install/native/native-path-pick.js';

describe('targetHintFromNativePath', () => {
  it('prefers longer prefixes', () => {
    expect(targetHintFromNativePath('.github/instructions/foo')).toBe('copilot');
    expect(targetHintFromNativePath('.github/prompts')).toBe('copilot');
    expect(targetHintFromNativePath('.gemini/commands')).toBe('gemini-cli');
    expect(targetHintFromNativePath('.claude/rules/ts')).toBe('claude-code');
  });
});

describe('pathSupportsNativePick', () => {
  it('matches hint to target', () => {
    expect(pathSupportsNativePick('.cursor/rules', 'cursor')).toBe(true);
    expect(pathSupportsNativePick('.cursor/rules', 'gemini-cli')).toBe(false);
  });
});

describe('resolveEffectiveTargetForInstall', () => {
  it('prefers path hint over detected import target', () => {
    expect(
      resolveEffectiveTargetForInstall({
        explicitTarget: undefined,
        importHappened: true,
        usedTargetFromImport: 'claude-code',
        pathInRepoPosix: '.gemini/commands',
      }),
    ).toBe('gemini-cli');
  });
});

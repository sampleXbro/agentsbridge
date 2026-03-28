/**
 * Native install path → target hint and scoping.
 */

import { describe, it, expect } from 'vitest';
import {
  targetHintFromNativePath,
  pathSupportsNativePick,
  resolveEffectiveTargetForInstall,
  validateTargetMatchesPath,
  extendPickHasArrays,
} from '../../../src/install/native/native-path-pick.js';
import type { ExtendPick } from '../../../src/config/core/schema.js';

describe('targetHintFromNativePath', () => {
  it('prefers longer prefixes', () => {
    expect(targetHintFromNativePath('.github/instructions/foo')).toBe('copilot');
    expect(targetHintFromNativePath('.github/prompts')).toBe('copilot');
    expect(targetHintFromNativePath('.gemini/commands')).toBe('gemini-cli');
    expect(targetHintFromNativePath('.claude/rules/ts')).toBe('claude-code');
  });

  it('returns undefined for unknown paths', () => {
    expect(targetHintFromNativePath('unknown/path')).toBeUndefined();
    expect(targetHintFromNativePath('')).toBeUndefined();
  });

  it('handles exact matches', () => {
    expect(targetHintFromNativePath('.github/copilot-instructions.md')).toBe('copilot');
    expect(targetHintFromNativePath('.codex')).toBe('codex-cli');
  });

  it('normalizes path separators', () => {
    expect(targetHintFromNativePath('.claude\\rules\\ts')).toBe('claude-code');
    expect(targetHintFromNativePath('/.cursor/rules/')).toBe('cursor');
  });
});

describe('pathSupportsNativePick', () => {
  it('matches hint to target', () => {
    expect(pathSupportsNativePick('.cursor/rules', 'cursor')).toBe(true);
    expect(pathSupportsNativePick('.cursor/rules', 'gemini-cli')).toBe(false);
  });

  it('returns false for unknown paths', () => {
    expect(pathSupportsNativePick('unknown/path', 'cursor')).toBe(false);
  });
});

describe('resolveEffectiveTargetForInstall', () => {
  it('prefers explicit target', () => {
    expect(
      resolveEffectiveTargetForInstall({
        explicitTarget: 'copilot',
        importHappened: true,
        usedTargetFromImport: 'claude-code',
        pathInRepoPosix: '.gemini/commands',
      }),
    ).toBe('copilot');
  });

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

  it('falls back to import target when no path hint', () => {
    expect(
      resolveEffectiveTargetForInstall({
        explicitTarget: undefined,
        importHappened: true,
        usedTargetFromImport: 'claude-code',
        pathInRepoPosix: 'unknown/path',
      }),
    ).toBe('claude-code');
  });

  it('returns undefined when no target can be determined', () => {
    expect(
      resolveEffectiveTargetForInstall({
        explicitTarget: undefined,
        importHappened: false,
        pathInRepoPosix: 'unknown/path',
      }),
    ).toBeUndefined();
  });

  it('handles empty path', () => {
    expect(
      resolveEffectiveTargetForInstall({
        explicitTarget: undefined,
        importHappened: true,
        usedTargetFromImport: 'cursor',
        pathInRepoPosix: '',
      }),
    ).toBe('cursor');
  });
});

describe('validateTargetMatchesPath', () => {
  it('does nothing when no explicit target', () => {
    expect(() => validateTargetMatchesPath(undefined, '.cursor/rules')).not.toThrow();
  });

  it('does nothing when no path', () => {
    expect(() => validateTargetMatchesPath('cursor', '')).not.toThrow();
  });

  it('validates matching target and path', () => {
    expect(() => validateTargetMatchesPath('cursor', '.cursor/rules')).not.toThrow();
  });

  it('throws error for mismatching target and path', () => {
    expect(() => validateTargetMatchesPath('copilot', '.cursor/rules')).toThrow(
      '--target "copilot" does not match the install path (native path suggests "cursor")',
    );
  });

  it('allows unknown paths', () => {
    expect(() => validateTargetMatchesPath('cursor', 'unknown/path')).not.toThrow();
  });
});

describe('extendPickHasArrays', () => {
  it('returns false for empty pick', () => {
    const empty: ExtendPick = {};
    expect(extendPickHasArrays(empty)).toBe(false);
  });

  it('returns true when commands array has items', () => {
    const withCommands: ExtendPick = { commands: ['cmd1'] };
    expect(extendPickHasArrays(withCommands)).toBe(true);
  });

  it('returns true when rules array has items', () => {
    const withRules: ExtendPick = { rules: ['rule1'] };
    expect(extendPickHasArrays(withRules)).toBe(true);
  });

  it('returns true when skills array has items', () => {
    const withSkills: ExtendPick = { skills: ['skill1'] };
    expect(extendPickHasArrays(withSkills)).toBe(true);
  });

  it('returns true when agents array has items', () => {
    const withAgents: ExtendPick = { agents: ['agent1'] };
    expect(extendPickHasArrays(withAgents)).toBe(true);
  });

  it('returns false for empty arrays', () => {
    const withEmptyArrays: ExtendPick = {
      commands: [],
      rules: [],
      skills: [],
      agents: [],
    };
    expect(extendPickHasArrays(withEmptyArrays)).toBe(false);
  });
});

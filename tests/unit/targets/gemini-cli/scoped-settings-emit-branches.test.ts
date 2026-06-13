/**
 * Branch coverage for src/targets/gemini-cli/scoped-settings-emit.ts line 16:
 * - The early-return branch when `scope === 'project'` and the gemini-cli
 *   `ignore.flavor` is NOT `settings-embedded`.
 * - The `scope !== 'project'` (global) path which always emits.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { emitScopedGeminiSettings } from '../../../../src/targets/gemini-cli/scoped-settings-emit.js';
import * as caps from '../../../../src/targets/catalog/builtin-targets.js';
import type { CanonicalFiles } from '../../../../src/core/types.js';

function baseCanonical(): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

const ALL_FEATURES = new Set(['rules', 'mcp', 'hooks', 'agents', 'ignore', 'permissions']);

describe('emitScopedGeminiSettings — branch coverage', () => {
  it('returns [] under project scope when ignore.flavor is NOT settings-embedded', () => {
    vi.spyOn(caps, 'getTargetCapabilities').mockReturnValue({
      ignore: { flavor: 'native-ignore-file' },
    } as never);
    const result = emitScopedGeminiSettings(baseCanonical(), 'project', ALL_FEATURES);
    expect(result).toEqual([]);
  });

  it('returns [] under project scope when getTargetCapabilities returns undefined', () => {
    vi.spyOn(caps, 'getTargetCapabilities').mockReturnValue(undefined as never);
    const result = emitScopedGeminiSettings(baseCanonical(), 'project', ALL_FEATURES);
    expect(result).toEqual([]);
  });

  it('emits settings under global scope without consulting capabilities', () => {
    // No matter what capabilities return, global skips the project guard.
    const spy = vi.spyOn(caps, 'getTargetCapabilities');
    const canonical = { ...baseCanonical(), ignore: ['build/', '*.log'] };
    const result = emitScopedGeminiSettings(canonical, 'global', ALL_FEATURES);
    expect(Array.isArray(result)).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});

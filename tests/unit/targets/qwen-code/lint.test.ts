import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintHooks } from '../../../../src/targets/qwen-code/lint.js';

function makeCanonical(overrides: Partial<CanonicalFiles> = {}): CanonicalFiles {
  return {
    rules: [],
    commands: [],
    agents: [],
    skills: [],
    mcp: null,
    permissions: null,
    hooks: null,
    ignore: [],
    ...overrides,
  };
}

describe('lintHooks (qwen-code)', () => {
  it('returns empty diagnostics (stub)', () => {
    const canonical = makeCanonical({
      hooks: {
        PreGenerate: [{ command: 'echo hello', pattern: '' }],
      },
    });
    expect(lintHooks(canonical)).toHaveLength(0);
  });

  it('returns empty when hooks is null', () => {
    const canonical = makeCanonical({ hooks: null });
    expect(lintHooks(canonical)).toHaveLength(0);
  });
});

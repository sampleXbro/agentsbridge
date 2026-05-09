import { describe, it, expect } from 'vitest';
import type { CanonicalFiles } from '../../../../src/core/types.js';
import { lintHooks } from '../../../../src/targets/augment-code/lint.js';

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

describe('lintHooks (augment-code)', () => {
  it('returns empty when hooks is null', () => {
    expect(lintHooks(makeCanonical())).toHaveLength(0);
  });

  it('returns empty when hooks object is empty', () => {
    expect(lintHooks(makeCanonical({ hooks: {} }))).toHaveLength(0);
  });

  it('returns empty for supported hook events', () => {
    const canonical = makeCanonical({
      hooks: {
        PreToolUse: [{ matcher: '.*', command: 'scripts/check.sh' }],
        PostToolUse: [{ matcher: '.*', command: 'scripts/post.sh' }],
        SessionStart: [{ matcher: '.*', command: 'scripts/init.sh' }],
        SessionEnd: [{ matcher: '.*', command: 'scripts/cleanup.sh' }],
        Stop: [{ matcher: '.*', command: 'scripts/stop.sh' }],
      },
    });
    expect(lintHooks(canonical)).toHaveLength(0);
  });

  it('returns warning for unsupported hook events', () => {
    const canonical = makeCanonical({
      hooks: {
        PreToolUse: [{ matcher: '.*', command: 'scripts/check.sh' }],
        CustomEvent: [{ matcher: '.*', command: 'scripts/custom.sh' }],
      },
    });
    const results = lintHooks(canonical);
    expect(results).toHaveLength(1);
    expect(results[0].level).toBe('warning');
    expect(results[0].message).toContain('CustomEvent');
  });

  it('returns multiple warnings for multiple unsupported events', () => {
    const canonical = makeCanonical({
      hooks: {
        UnknownA: [{ matcher: '.*', command: 'a.sh' }],
        UnknownB: [{ matcher: '.*', command: 'b.sh' }],
      },
    });
    const results = lintHooks(canonical);
    expect(results).toHaveLength(2);
  });
});

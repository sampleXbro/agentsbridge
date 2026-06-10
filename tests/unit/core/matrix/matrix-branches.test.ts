/**
 * Branch coverage for src/core/matrix/{verbose,data}.ts:
 * - verbose: each conditional emission branch (hooks count > 0 vs 0; mcp empty; permissions empty).
 * - data: NO_COLOR set vs unset for noColor() decision in colorize().
 */

import { describe, it, expect, afterEach } from 'vitest';
import { formatVerboseDetails } from '../../../../src/core/matrix/verbose.js';
import { coloredSymbol, LEVEL_SYMBOL } from '../../../../src/core/matrix/data.js';
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
  delete process.env['NO_COLOR'];
  delete process.env['FORCE_COLOR'];
});

describe('formatVerboseDetails — empty/edge branches', () => {
  it('returns empty string when canonical is completely empty', () => {
    expect(formatVerboseDetails(baseCanonical())).toBe('');
  });

  it('emits hooks count line only when at least one event has entries', () => {
    const result = formatVerboseDetails({
      ...baseCanonical(),
      hooks: { PostToolUse: [{ matcher: '*', command: 'fmt' }] },
    });
    expect(result).toContain('hooks: 1 entries in hooks.yaml');
  });

  it('does NOT emit hooks line when hooks object exists but all arrays are empty', () => {
    const result = formatVerboseDetails({
      ...baseCanonical(),
      hooks: { PostToolUse: [] },
    });
    expect(result).not.toContain('hooks:');
  });

  it('emits permissions line only when allow/deny total > 0', () => {
    const result = formatVerboseDetails({
      ...baseCanonical(),
      permissions: { allow: ['Bash(rm:*)'], deny: [] },
    });
    expect(result).toContain('permissions:');
  });

  it('does NOT emit permissions line when allow and deny are both empty', () => {
    const result = formatVerboseDetails({
      ...baseCanonical(),
      permissions: { allow: [], deny: [] },
    });
    expect(result).not.toContain('permissions:');
  });

  it('does NOT emit mcp line when mcpServers is an empty object', () => {
    const result = formatVerboseDetails({
      ...baseCanonical(),
      mcp: { mcpServers: {} },
    });
    expect(result).not.toContain('mcp:');
  });
});

describe('coloredSymbol / color-decision branches', () => {
  it('emits ANSI color codes when color is forced', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '1';
    const out = coloredSymbol('native');
    expect(out).toContain(LEVEL_SYMBOL.native);
    expect(out).toContain('\x1b[32m');
  });

  it('strips ANSI codes when NO_COLOR is set to a non-empty value', () => {
    process.env['NO_COLOR'] = '1';
    expect(coloredSymbol('native')).toBe(LEVEL_SYMBOL.native);
  });

  it('emits color for an empty NO_COLOR when color is forced', () => {
    process.env['NO_COLOR'] = '';
    process.env['FORCE_COLOR'] = '1';
    expect(coloredSymbol('native')).toContain('\x1b[32m');
  });

  it('strips ANSI codes on a non-TTY when NO_COLOR is unset', () => {
    delete process.env['NO_COLOR'];
    delete process.env['FORCE_COLOR'];
    expect(coloredSymbol('native')).toBe(LEVEL_SYMBOL.native);
  });
});

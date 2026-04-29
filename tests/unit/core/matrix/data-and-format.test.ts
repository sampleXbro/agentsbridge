import { afterEach, describe, expect, it } from 'vitest';
import {
  LEVEL_SYMBOL,
  SUPPORT_MATRIX,
  SUPPORT_MATRIX_GLOBAL,
  coloredSymbol,
} from '../../../../src/core/matrix/data.js';
import { formatMatrix } from '../../../../src/core/matrix/format-table.js';
import type { CompatibilityRow } from '../../../../src/core/types.js';

const originalNoColor = process.env.NO_COLOR;
const ANSI_ESCAPE_PATTERN = new RegExp(String.raw`\u001B\[`);

afterEach(() => {
  if (originalNoColor === undefined) delete process.env.NO_COLOR;
  else process.env.NO_COLOR = originalNoColor;
});

describe('SUPPORT_MATRIX', () => {
  it('contains all standard feature ids', () => {
    expect(Object.keys(SUPPORT_MATRIX).sort()).toEqual(
      [
        'rules',
        'additionalRules',
        'commands',
        'agents',
        'skills',
        'mcp',
        'hooks',
        'ignore',
        'permissions',
      ].sort(),
    );
  });

  it('every cell has a level', () => {
    for (const targetMap of Object.values(SUPPORT_MATRIX)) {
      for (const cell of Object.values(targetMap)) {
        expect(['native', 'embedded', 'partial', 'none']).toContain(cell.level);
      }
    }
  });
});

describe('SUPPORT_MATRIX_GLOBAL', () => {
  it('contains all features', () => {
    expect(Object.keys(SUPPORT_MATRIX_GLOBAL)).toContain('rules');
  });
});

describe('coloredSymbol', () => {
  it('returns plain symbol when NO_COLOR is set', () => {
    process.env.NO_COLOR = '1';
    expect(coloredSymbol('native')).toBe(LEVEL_SYMBOL.native);
    expect(coloredSymbol('none')).toBe(LEVEL_SYMBOL.none);
  });

  it('returns ANSI-wrapped symbol when NO_COLOR is unset', () => {
    delete process.env.NO_COLOR;
    expect(coloredSymbol('native')).toContain(LEVEL_SYMBOL.native);
    expect(coloredSymbol('native')).toMatch(ANSI_ESCAPE_PATTERN);
  });

  it('returns plain symbol when NO_COLOR is empty string', () => {
    process.env.NO_COLOR = '';
    expect(coloredSymbol('partial')).toContain(LEVEL_SYMBOL.partial);
    expect(coloredSymbol('partial')).toMatch(ANSI_ESCAPE_PATTERN);
  });
});

const MAKE_ROW = (
  feature: string,
  support: Record<string, 'native' | 'none' | 'partial' | 'embedded'>,
): CompatibilityRow => ({
  feature,
  support,
});

describe('formatMatrix', () => {
  it('renders ASCII table with NO_COLOR', () => {
    process.env.NO_COLOR = '1';
    const out = formatMatrix(
      [MAKE_ROW('rules', { 'claude-code': 'native', cursor: 'embedded' })],
      ['claude-code', 'cursor'],
    );
    expect(out).toContain('Feature');
    expect(out).toContain('rules');
    expect(out).toContain(LEVEL_SYMBOL.native);
    expect(out).toContain(LEVEL_SYMBOL.embedded);
    expect(out).toContain('Legend:');
  });

  it('renders ANSI codes when NO_COLOR not set', () => {
    delete process.env.NO_COLOR;
    const out = formatMatrix([MAKE_ROW('rules', { 'claude-code': 'native' })], ['claude-code']);
    expect(out).toMatch(ANSI_ESCAPE_PATTERN);
  });

  it('uses "none" when target is missing in support map', () => {
    process.env.NO_COLOR = '1';
    const out = formatMatrix([MAKE_ROW('rules', {})], ['no-such-target']);
    expect(out).toContain(LEVEL_SYMBOL.none);
  });

  it('handles single target', () => {
    process.env.NO_COLOR = '1';
    const out = formatMatrix([MAKE_ROW('rules', { x: 'native' })], ['x']);
    expect(out).toContain('rules');
  });

  it('handles empty rows', () => {
    process.env.NO_COLOR = '1';
    const out = formatMatrix([], ['claude-code']);
    expect(out).toContain('Feature');
  });
});

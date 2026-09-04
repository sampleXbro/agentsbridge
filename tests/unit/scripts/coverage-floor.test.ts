import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FLOOR,
  filesBelowFloor,
  formatOffenders,
  type CoverageSummary,
  type FileSummary,
  type MetricSummary,
} from '../../../scripts/coverage-floor-core.js';

const metric = (covered: number, total: number): MetricSummary => ({
  total,
  covered,
  skipped: 0,
  pct: total === 0 ? 100 : Math.round((covered / total) * 10000) / 100,
});

const file = (
  lines: [number, number],
  functions: [number, number],
  branches: [number, number],
): FileSummary => ({
  lines: metric(...lines),
  functions: metric(...functions),
  branches: metric(...branches),
  statements: metric(...lines),
});

const summary: CoverageSummary = {
  total: file([100, 100], [10, 10], [50, 50]),
  '/repo/src/good.ts': file([95, 100], [9, 10], [40, 50]),
  '/repo/src/low-lines.ts': file([70, 100], [10, 10], [50, 50]),
  '/repo/src/low-branches.ts': file([100, 100], [10, 10], [30, 50]),
  '/repo/src/no-branches.ts': file([10, 10], [1, 1], [0, 0]),
};

describe('filesBelowFloor', () => {
  it('skips the total row and files that meet the floor', () => {
    const result = filesBelowFloor(summary, DEFAULT_FLOOR);
    expect(result.map((r) => r.file)).toEqual([
      '/repo/src/low-lines.ts',
      '/repo/src/low-branches.ts',
    ]);
  });

  it('reports every metric under its floor with covered/total', () => {
    const [lowLines] = filesBelowFloor(summary, DEFAULT_FLOOR);
    expect(lowLines).toEqual({
      file: '/repo/src/low-lines.ts',
      misses: [{ metric: 'lines', pct: 70, covered: 70, total: 100, floor: 80 }],
    });
  });

  it('ignores a metric with zero total (a file with no branches cannot fail branches)', () => {
    expect(
      filesBelowFloor(summary, { lines: 80, functions: 80, branches: 100 }).map((r) => r.file),
    ).not.toContain('/repo/src/no-branches.ts');
  });

  it('returns nothing when every file clears a zero floor', () => {
    expect(filesBelowFloor(summary, { lines: 0, functions: 0, branches: 0 })).toEqual([]);
  });
});

describe('formatOffenders', () => {
  it('prints one line per file with repo-relative paths and forward slashes', () => {
    const lines = formatOffenders(filesBelowFloor(summary, DEFAULT_FLOOR), '/repo');
    expect(lines).toEqual([
      'src/low-lines.ts  lines 70% (70/100) < 80%',
      'src/low-branches.ts  branches 60% (30/50) < 70%',
    ]);
  });

  it('normalizes Windows separators in the file path', () => {
    const win: CoverageSummary = {
      total: summary.total,
      'C:\\repo\\src\\x.ts': file([1, 10], [1, 1], [0, 0]),
    };
    expect(formatOffenders(filesBelowFloor(win, DEFAULT_FLOOR), 'C:\\repo')[0]).toMatch(
      /^src\/x\.ts {2}lines/,
    );
  });
});

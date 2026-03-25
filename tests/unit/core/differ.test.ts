import { describe, it, expect } from 'vitest';
import { computeDiff, formatDiffSummary } from '../../../src/core/differ.js';
import type { GenerateResult } from '../../../src/core/types.js';

describe('computeDiff', () => {
  it('produces unified diff for updated file', () => {
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: 'CLAUDE.md',
        content: 'Line 1\nLine 2\nLine 3\nAdded',
        status: 'updated',
        currentContent: 'Line 1\nLine 2\nLine 3',
      },
    ];
    const out = computeDiff(results);
    expect(out.diffs).toHaveLength(1);
    expect(out.diffs[0]?.path).toBe('CLAUDE.md');
    expect(out.diffs[0]?.patch).toContain('--- CLAUDE.md (current)');
    expect(out.diffs[0]?.patch).toContain('+++ CLAUDE.md (generated)');
    expect(out.diffs[0]?.patch).toContain('+Added');
    expect(out.summary.updated).toBe(1);
  });

  it('produces unified diff for new file', () => {
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: 'CLAUDE.md',
        content: 'New content',
        status: 'created',
      },
    ];
    const out = computeDiff(results);
    expect(out.diffs).toHaveLength(1);
    expect(out.diffs[0]?.patch).toContain('--- CLAUDE.md (current)');
    expect(out.diffs[0]?.patch).toContain('+++ CLAUDE.md (generated)');
    expect(out.diffs[0]?.patch).toContain('+New content');
    expect(out.summary.new).toBe(1);
  });

  it('skips unchanged files', () => {
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: 'CLAUDE.md',
        content: 'Same',
        status: 'unchanged',
        currentContent: 'Same',
      },
    ];
    const out = computeDiff(results);
    expect(out.diffs).toHaveLength(0);
    expect(out.summary.unchanged).toBe(1);
  });

  it('counts all statuses in summary', () => {
    const results: GenerateResult[] = [
      { target: 'x', path: 'a', content: 'a', status: 'created' },
      {
        target: 'x',
        path: 'b',
        content: 'b2',
        status: 'updated',
        currentContent: 'b1',
      },
      {
        target: 'x',
        path: 'c',
        content: 'c',
        status: 'unchanged',
        currentContent: 'c',
      },
    ];
    const out = computeDiff(results);
    expect(out.summary).toEqual({ new: 1, updated: 1, unchanged: 1, deleted: 0 });
    expect(out.diffs).toHaveLength(2); // created + updated only
  });
});

describe('formatDiffSummary', () => {
  it('formats summary string', () => {
    expect(formatDiffSummary({ new: 2, updated: 1, unchanged: 14, deleted: 0 })).toBe(
      '2 files would be created, 1 updated, 14 unchanged, 0 deleted',
    );
  });
});

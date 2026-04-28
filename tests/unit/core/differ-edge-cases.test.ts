/**
 * Edge cases for the diff engine that are not exercised by `differ.test.ts`.
 * The existing suite covers happy-path created/updated/unchanged. These tests
 * pin the surprising branches a team CI workflow can hit:
 *  - skipped results never appear in diffs or summary buckets
 *  - updated results without `currentContent` are silently dropped
 *  - large multi-result inputs preserve order and counts
 *  - newline-only and trailing-newline divergences produce real patches
 *  - the formatter is consistent for empty input
 */

import { describe, it, expect } from 'vitest';
import { computeDiff, formatDiffSummary } from '../../../src/core/differ.js';
import type { GenerateResult } from '../../../src/core/types.js';

describe('computeDiff edge cases', () => {
  it('returns no diffs and zero summary buckets for an empty result list', () => {
    const out = computeDiff([]);
    expect(out.diffs).toEqual([]);
    expect(out.summary).toEqual({ new: 0, updated: 0, unchanged: 0, deleted: 0 });
  });

  it('drops `updated` results that have no currentContent (safe-no-op contract)', () => {
    const results: GenerateResult[] = [
      {
        target: 'claude-code',
        path: 'CLAUDE.md',
        content: 'new body',
        status: 'updated',
        // currentContent intentionally omitted; differ.ts:53 guards against this.
      },
    ];
    const out = computeDiff(results);
    expect(out.diffs).toEqual([]);
    // Importantly: summary.updated stays 0; we do NOT count an update we can't render.
    expect(out.summary.updated).toBe(0);
    expect(out.summary).toEqual({ new: 0, updated: 0, unchanged: 0, deleted: 0 });
  });

  it('ignores `skipped` status (not a diff, not in any summary bucket)', () => {
    const results: GenerateResult[] = [
      {
        target: 'cursor',
        path: '.cursor/rules/general.mdc',
        content: 'whatever',
        status: 'skipped',
        skipReason: 'feature disabled',
      },
    ];
    const out = computeDiff(results);
    expect(out.diffs).toEqual([]);
    expect(out.summary).toEqual({ new: 0, updated: 0, unchanged: 0, deleted: 0 });
  });

  it('preserves input order across mixed-status batches', () => {
    const results: GenerateResult[] = [
      { target: 't', path: 'a', content: 'A', status: 'created' },
      { target: 't', path: 'b', content: 'B2', status: 'updated', currentContent: 'B1' },
      { target: 't', path: 'c', content: 'C', status: 'unchanged', currentContent: 'C' },
      { target: 't', path: 'd', content: 'D', status: 'created' },
    ];
    const out = computeDiff(results);
    expect(out.diffs.map((d) => d.path)).toEqual(['a', 'b', 'd']);
    expect(out.summary).toEqual({ new: 2, updated: 1, unchanged: 1, deleted: 0 });
  });

  it('produces a real patch when only the trailing newline differs', () => {
    const results: GenerateResult[] = [
      {
        target: 't',
        path: 'README.md',
        content: 'line\n',
        status: 'updated',
        currentContent: 'line',
      },
    ];
    const out = computeDiff(results);
    expect(out.diffs).toHaveLength(1);
    expect(out.summary.updated).toBe(1);
    // Diff library annotates newline-at-EOF differences explicitly.
    expect(out.diffs[0]?.patch).toMatch(/No newline at end of file|\+line/);
  });

  it('emits unified-diff headers using the `(current)` and `(generated)` markers', () => {
    const results: GenerateResult[] = [
      { target: 't', path: 'docs/x.md', content: 'a', status: 'created' },
      { target: 't', path: 'docs/y.md', content: 'b2', status: 'updated', currentContent: 'b1' },
    ];
    const out = computeDiff(results);
    expect(out.diffs[0]?.patch).toContain('--- docs/x.md (current)');
    expect(out.diffs[0]?.patch).toContain('+++ docs/x.md (generated)');
    expect(out.diffs[1]?.patch).toContain('--- docs/y.md (current)');
    expect(out.diffs[1]?.patch).toContain('+++ docs/y.md (generated)');
  });
});

describe('formatDiffSummary', () => {
  it('renders zero counts deterministically', () => {
    expect(formatDiffSummary({ new: 0, updated: 0, unchanged: 0, deleted: 0 })).toBe(
      '0 files would be created, 0 updated, 0 unchanged, 0 deleted',
    );
  });

  it('renders large counts without separators (raw integers)', () => {
    expect(formatDiffSummary({ new: 1234, updated: 56, unchanged: 78, deleted: 9 })).toBe(
      '1234 files would be created, 56 updated, 78 unchanged, 9 deleted',
    );
  });
});

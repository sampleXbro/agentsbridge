import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { loadLessonsGraph, saveLessonsGraph } from '../../../src/lessons/graph-store.js';
import { stripLegacyMarkers, stripMarkersInGraph } from '../../../src/lessons/strip-markers.js';

describe('stripLegacyMarkers', () => {
  it('removes a trailing "See L\\d+" marker', () => {
    expect(stripLegacyMarkers('Do the thing. See L128')).toBe('Do the thing.');
  });

  it('consumes the markers own terminal period without leaving a doubled period', () => {
    expect(stripLegacyMarkers('Audit the output map — one canonical. See L128.')).toBe(
      'Audit the output map — one canonical.',
    );
  });

  it('removes a trailing multi-ref "See L\\d+, L\\d+" marker', () => {
    expect(stripLegacyMarkers('Do the thing. See L140, L149')).toBe('Do the thing.');
  });

  it('removes a trailing parenthesized "(L\\d+)" marker', () => {
    expect(stripLegacyMarkers('Implement global mode in one pass. (L174)')).toBe(
      'Implement global mode in one pass.',
    );
  });

  it('removes a trailing bracketed "[L\\d+, L\\d+]" marker', () => {
    expect(stripLegacyMarkers('Use one helper for skill names. [L161, L208]')).toBe(
      'Use one helper for skill names.',
    );
  });

  it('removes an inline "(also relevant — primary in `x`)" phrase', () => {
    expect(
      stripLegacyMarkers(
        '(also relevant — primary in `fixture-and-assertion-discipline`) Mock fixtures must include plugins.',
      ),
    ).toBe('Mock fixtures must include plugins.');
  });

  it('is idempotent', () => {
    const once = stripLegacyMarkers('Do the thing. See L128');
    expect(stripLegacyMarkers(once)).toBe(once);
  });

  it('does not touch rule text that has no legacy marker', () => {
    const clean = 'Never use `!= null`; the lint gate rejects it.';
    expect(stripLegacyMarkers(clean)).toBe(clean);
  });

  it('preserves legitimate parentheticals and inline code that are not markers', () => {
    const text = 'Flow inputs through `env:` (CWE-78) before use.';
    expect(stripLegacyMarkers(text)).toBe(text);
  });

  it('leaves no double spaces or dangling punctuation after stripping a mid-sentence marker', () => {
    expect(stripLegacyMarkers('First clause (L92, L163), then the rest.')).toBe(
      'First clause, then the rest.',
    );
  });

  it('preserves ellipses, comment fences, and shell punctuation in code samples (regression)', () => {
    for (const text of [
      'Never interpolate `${{ ... }}` directly into `run:` bodies.',
      'Never write a literal `*/` inside any `/* ... */` block comment.',
      'Validate shape (e.g. `case "$VERSION" in *) exit 1 ;; esac`) before use.',
      'Treat `[ref]: ...` definitions as link destinations.',
    ]) {
      expect(stripLegacyMarkers(text)).toBe(text);
    }
  });

  it('removes a mid-sentence marker without gluing neighbouring words', () => {
    expect(stripLegacyMarkers('Use the helper [L161] for skill names.')).toBe(
      'Use the helper for skill names.',
    );
  });
});

describe('stripMarkersInGraph', () => {
  it('strips markers across every lesson and reports the changed ids', async () => {
    const root = mkdtempSync(join(tmpdir(), 'amesh-strip-'));
    try {
      const graph: LessonsGraph = {
        version: 1,
        lessons: {
          'g-1': {
            rule: 'Audit output maps. See L128',
            topics: ['t'],
            triggers: [],
            evidence: [],
            status: 'active',
            createdAt: '2026-06-05',
          },
          'g-2': {
            rule: 'Already clean rule.',
            topics: ['t'],
            triggers: [],
            evidence: [],
            status: 'active',
            createdAt: '2026-06-05',
          },
        },
        topics: { t: { summary: 'T.' } },
        triggers: {},
      };
      saveLessonsGraph(root, graph);

      const report = await stripMarkersInGraph(root);
      expect(report.changedIds).toEqual(['g-1']);
      expect(report.changedCount).toBe(1);

      const out = loadLessonsGraph(root);
      expect(out.lessons['g-1']?.rule).toBe('Audit output maps.');
      expect(out.lessons['g-2']?.rule).toBe('Already clean rule.');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns an empty report when no graph exists (does not create one)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'amesh-strip-none-'));
    try {
      const report = await stripMarkersInGraph(root);
      expect(report).toEqual({ changedIds: [], changedCount: 0 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('supports dry-run: reports changes without writing', async () => {
    const root = mkdtempSync(join(tmpdir(), 'amesh-strip-'));
    try {
      const graph: LessonsGraph = {
        version: 1,
        lessons: {
          'g-1': {
            rule: 'Audit output maps. See L128',
            topics: ['t'],
            triggers: [],
            evidence: [],
            status: 'active',
            createdAt: '2026-06-05',
          },
        },
        topics: { t: { summary: 'T.' } },
        triggers: {},
      };
      saveLessonsGraph(root, graph);

      const report = await stripMarkersInGraph(root, { dryRun: true });
      expect(report.changedIds).toEqual(['g-1']);
      expect(loadLessonsGraph(root).lessons['g-1']?.rule).toBe('Audit output maps. See L128');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

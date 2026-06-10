import { describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import {
  collectDeadFileGlobs,
  collectRunnerAnchoredPatterns,
} from '../../../src/lessons/validate-liveness.js';
import type { ValidationFinding } from '../../../src/lessons/validate.js';

/** A graph with one ACTIVE lesson referencing every supplied trigger. */
function graphWith(triggers: LessonsGraph['triggers']): LessonsGraph {
  return {
    version: 1,
    lessons: {
      L: {
        rule: 'R.',
        topics: ['t'],
        triggers: Object.keys(triggers),
        evidence: [],
        status: 'active',
        createdAt: '2026-06-05',
      },
    },
    topics: { t: { summary: 'T.' } },
    triggers,
  };
}

describe('collectDeadFileGlobs', () => {
  it('flags a file_glob (on an active lesson) matching no working-tree file', () => {
    const g = graphWith({ 't-glob': { kind: 'file_glob', pattern: 'src/gone/**' } });
    const f: ValidationFinding[] = [];
    collectDeadFileGlobs(g, f, new Set(['src/here/a.ts', 'README.md']));
    expect(f).toContainEqual(
      expect.objectContaining({ code: 'DEAD_FILE_GLOB', level: 'warning', triggerId: 't-glob' }),
    );
  });

  it('does not flag a file_glob that still matches at least one file', () => {
    const g = graphWith({ 't-glob': { kind: 'file_glob', pattern: 'src/**' } });
    const f: ValidationFinding[] = [];
    collectDeadFileGlobs(g, f, new Set(['src/here/a.ts']));
    expect(f).toEqual([]);
  });

  it('ignores file_globs referenced only by a non-active lesson', () => {
    const g = graphWith({ 't-glob': { kind: 'file_glob', pattern: 'src/gone/**' } });
    g.lessons.L = { ...g.lessons.L, status: 'deprecated' };
    const f: ValidationFinding[] = [];
    collectDeadFileGlobs(g, f, new Set(['README.md']));
    expect(f).toEqual([]);
  });

  it('ignores non-file_glob triggers', () => {
    const g = graphWith({ 't-cmd': { kind: 'command_pattern', pattern: 'vitest' } });
    const f: ValidationFinding[] = [];
    collectDeadFileGlobs(g, f, new Set());
    expect(f).toEqual([]);
  });
});

describe('collectRunnerAnchoredPatterns', () => {
  it('flags a command_pattern anchored to a single runner', () => {
    for (const pattern of ['^pnpm test', '^npx vitest run', '^npm run build', '^yarn x', '^bun y']) {
      const g = graphWith({ 't-cmd': { kind: 'command_pattern', pattern } });
      const f: ValidationFinding[] = [];
      collectRunnerAnchoredPatterns(g, f);
      expect(f, pattern).toContainEqual(
        expect.objectContaining({ code: 'RUNNER_ANCHORED_PATTERN', level: 'warning' }),
      );
    }
  });

  it('does not flag a runner-agnostic or alternation pattern', () => {
    for (const pattern of ['vitest run', '\\bvitest\\b', '(pnpm|npx) test', 'git commit']) {
      const g = graphWith({ 't-cmd': { kind: 'command_pattern', pattern } });
      const f: ValidationFinding[] = [];
      collectRunnerAnchoredPatterns(g, f);
      expect(f, pattern).toEqual([]);
    }
  });

  it('ignores runner-anchored patterns referenced only by a non-active lesson', () => {
    const g = graphWith({ 't-cmd': { kind: 'command_pattern', pattern: '^pnpm test' } });
    g.lessons.L = { ...g.lessons.L, status: 'deprecated' };
    const f: ValidationFinding[] = [];
    collectRunnerAnchoredPatterns(g, f);
    expect(f).toEqual([]);
  });
});

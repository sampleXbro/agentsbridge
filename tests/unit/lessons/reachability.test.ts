import { describe, it, expect } from 'vitest';
import {
  auditReachability,
  type LessonReachability,
  type ReachabilityReport,
} from '../../../src/lessons/reachability.js';
import type { Lesson, LessonsGraph, Trigger } from '../../../src/lessons/graph-schema.js';

function lesson(triggers: string[], over: Partial<Lesson> = {}): Lesson {
  return {
    rule: 'r',
    topics: ['t'],
    triggers,
    evidence: ['e'],
    status: 'active',
    createdAt: '2026-01-01',
    ...over,
  };
}
function graph(lessons: Record<string, Lesson>, triggers: Record<string, Trigger>): LessonsGraph {
  return { version: 1, lessons, topics: { t: { summary: 's' } }, triggers };
}

const TRIGGERS: Record<string, Trigger> = {
  'g-live': { kind: 'file_glob', pattern: 'src/*.ts' }, // matches src/real.ts
  'g-dead': { kind: 'file_glob', pattern: 'src/ghost/*.ts' }, // matches nothing
  'c-live': { kind: 'command_pattern', pattern: 'vitest' }, // compiles -> valid
  'c-dead': { kind: 'command_pattern', pattern: '(?=danger)' }, // lookahead -> linear engine rejects
  'k-live': { kind: 'keyword', pattern: 'deployment' }, // non-empty needle
  'k-empty': { kind: 'keyword', pattern: 'the' }, // tokenizes to empty
  'k-gap': { kind: 'keyword', pattern: 'state of the art' }, // stopword gap -> never contiguous
};

const KNOWN = new Set(['src/real.ts', 'docs/readme.md']);

const GRAPH = graph(
  {
    'l-glob': lesson(['g-live']),
    'l-glob-dead': lesson(['g-dead']),
    'l-cmd': lesson(['c-live']),
    'l-cmd-dead': lesson(['c-dead']),
    'l-kw': lesson(['k-live']),
    'l-kw-empty': lesson(['k-empty']),
    'l-kw-gap': lesson(['k-gap']),
    'l-dead-glob-live-kw': lesson(['g-dead', 'k-live']),
    'l-live-glob-dead-kw': lesson(['g-live', 'k-empty']),
    'l-missing-trigger': lesson(['g-nope']), // trigger id absent from the graph
    'l-deprecated': lesson(['g-live'], { status: 'deprecated' }),
    'l-superseded': lesson(['g-live'], { status: 'superseded', supersededBy: 'l-glob' }),
  },
  TRIGGERS,
);

function byId(report: ReachabilityReport, id: string): LessonReachability {
  const found = report.lessons.find((l) => l.id === id);
  if (found) return found;
  throw new Error(`expected ${id} in the per-lesson report`);
}
function tierOf(report: ReachabilityReport, id: string): string {
  return byId(report, id).tier;
}

describe('auditReachability', () => {
  const report = auditReachability(GRAPH, KNOWN);

  it('counts only active lessons, in four asymmetric reachability tiers', () => {
    expect(report.activeLessons).toBe(10); // 12 total minus deprecated + superseded
    expect(report.fileReachable).toBe(2); // l-glob, l-live-glob-dead-kw
    expect(report.commandPattern).toBe(1); // l-cmd (valid command, no live glob)
    expect(report.keywordOnly).toBe(2); // l-kw, l-dead-glob-live-kw
    expect(report.inert).toBe(5); // l-glob-dead, l-cmd-dead, l-kw-empty, l-kw-gap, l-missing-trigger
  });

  it('verifies a file_glob against the tree (file-reachable) but a command only compiles (command-pattern)', () => {
    expect(tierOf(report, 'l-glob')).toBe('file-reachable');
    expect(byId(report, 'l-cmd').tier).toBe('command-pattern');
    expect(byId(report, 'l-cmd').validCommand).toEqual(['c-live']);
    expect(tierOf(report, 'l-cmd-dead')).toBe('inert'); // unsafe regex is not even valid
  });

  it('treats a dead glob + live keyword as keyword-only (weak)', () => {
    const r = byId(report, 'l-dead-glob-live-kw');
    expect(r.tier).toBe('keyword-only');
    expect(r.liveKeyword).toEqual(['k-live']);
    expect(r.dead).toEqual(['g-dead']);
  });

  it('treats a live glob + stopword keyword as file-reachable', () => {
    const r = byId(report, 'l-live-glob-dead-kw');
    expect(r.tier).toBe('file-reachable');
    expect(r.liveFileGlob).toEqual(['g-live']);
    expect(r.dead).toEqual(['k-empty']);
  });

  it('marks stopword-only and stopword-gap keywords inert', () => {
    expect(tierOf(report, 'l-kw-empty')).toBe('inert');
    expect(tierOf(report, 'l-kw-gap')).toBe('inert');
  });

  it('counts a reference to a missing trigger as dead', () => {
    const r = byId(report, 'l-missing-trigger');
    expect(r.tier).toBe('inert');
    expect(r.dead).toEqual(['g-nope']);
  });

  it('lists exactly the operationally weak lessons (keyword-only + inert)', () => {
    expect(report.weak.map((w) => w.id).sort()).toEqual([
      'l-cmd-dead',
      'l-dead-glob-live-kw',
      'l-glob-dead',
      'l-kw',
      'l-kw-empty',
      'l-kw-gap',
      'l-missing-trigger',
    ]);
  });
});

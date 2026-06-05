import { describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { queryLessons } from '../../../src/lessons/query.js';

const graph: LessonsGraph = {
  version: 1,
  lessons: {
    'glob-only': {
      rule: 'G.',
      topics: ['t'],
      triggers: ['t-src-glob'],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-01',
    },
    'cmd-only': {
      rule: 'C.',
      topics: ['t'],
      triggers: ['t-test-cmd'],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-01',
    },
    'kw-only': {
      rule: 'K.',
      topics: ['t'],
      triggers: ['t-keyword'],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-01',
    },
    'multi-trigger': {
      rule: 'M.',
      topics: ['t'],
      triggers: ['t-src-glob', 't-test-cmd'],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-01',
    },
    'deprecated-rule': {
      rule: 'D.',
      topics: ['t'],
      triggers: ['t-src-glob'],
      evidence: [],
      status: 'deprecated',
      createdAt: '2026-06-01',
    },
    'superseded-rule': {
      rule: 'S.',
      topics: ['t'],
      triggers: ['t-src-glob'],
      evidence: [],
      status: 'superseded',
      supersededBy: 'glob-only',
      createdAt: '2026-06-01',
    },
  },
  topics: { t: { summary: 'Topic.' } },
  triggers: {
    't-src-glob': { kind: 'file_glob', pattern: 'src/**/*.ts' },
    't-test-cmd': { kind: 'command_pattern', pattern: '^pnpm test' },
    't-keyword': { kind: 'keyword', pattern: 'windows' },
  },
};

describe('queryLessons', () => {
  it('matches file_glob triggers and returns ids in alphabetical order', () => {
    const r = queryLessons(graph, { file: 'src/a.ts' });
    expect(r.map((x) => x.id)).toEqual(['glob-only', 'multi-trigger']);
  });

  it('matches command_pattern triggers against the command string', () => {
    const r = queryLessons(graph, { command: 'pnpm test --watch' });
    expect(r.map((x) => x.id)).toEqual(['cmd-only', 'multi-trigger']);
  });

  it('matches keyword triggers case-insensitively', () => {
    const r = queryLessons(graph, { keyword: 'Windows path bug' });
    expect(r.map((x) => x.id)).toEqual(['kw-only']);
  });

  it('combines file + command + keyword as OR across triggers', () => {
    const r = queryLessons(graph, {
      file: 'src/a.ts',
      command: 'pnpm test',
      keyword: 'windows',
    });
    expect(r.map((x) => x.id)).toEqual(['cmd-only', 'glob-only', 'kw-only', 'multi-trigger']);
  });

  it('deduplicates lessons matched via multiple triggers', () => {
    const r = queryLessons(graph, { file: 'src/a.ts', command: 'pnpm test' });
    const ids = r.map((x) => x.id);
    expect(ids.filter((id) => id === 'multi-trigger').length).toBe(1);
  });

  it('excludes deprecated lessons', () => {
    const r = queryLessons(graph, { file: 'src/a.ts' });
    expect(r.find((x) => x.id === 'deprecated-rule')).toBeUndefined();
  });

  it('excludes superseded lessons', () => {
    const r = queryLessons(graph, { file: 'src/a.ts' });
    expect(r.find((x) => x.id === 'superseded-rule')).toBeUndefined();
  });

  it('returns empty when no predicate is supplied', () => {
    expect(queryLessons(graph, {})).toEqual([]);
  });

  it('returns empty when nothing matches', () => {
    expect(queryLessons(graph, { file: 'docs/readme.md' })).toEqual([]);
  });

  it('treats an invalid command_pattern regex as a non-match without throwing', () => {
    const broken: LessonsGraph = {
      ...graph,
      triggers: {
        ...graph.triggers,
        'bad-regex': { kind: 'command_pattern', pattern: '(' },
      },
      lessons: {
        ...graph.lessons,
        'bad-rule': {
          rule: 'BR.',
          topics: ['t'],
          triggers: ['bad-regex'],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
      },
    };
    expect(() => queryLessons(broken, { command: 'anything' })).not.toThrow();
    expect(queryLessons(broken, { command: 'anything' })).toEqual([]);
  });

  it('returns the full Lesson object alongside the id', () => {
    const r = queryLessons(graph, { file: 'src/a.ts' });
    expect(r[0]?.lesson.rule).toBe('G.');
    expect(r[0]?.lesson.topics).toEqual(['t']);
  });
});

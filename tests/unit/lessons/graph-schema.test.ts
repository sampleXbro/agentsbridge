import { describe, expect, it } from 'vitest';
import { parseGraph } from '../../../src/lessons/graph-schema.js';

const goodGraph = {
  version: 1,
  lessons: {
    'rule-one': {
      rule: 'Always X.',
      topics: ['windows-paths'],
      triggers: ['t-glob-src'],
      evidence: ['commit:abc123'],
      status: 'active',
      createdAt: '2026-06-05',
    },
  },
  topics: {
    'windows-paths': { summary: 'Path handling.' },
  },
  triggers: {
    't-glob-src': { kind: 'file_glob', pattern: 'src/**' },
  },
};

function clone(): typeof goodGraph {
  return JSON.parse(JSON.stringify(goodGraph)) as typeof goodGraph;
}

describe('parseGraph', () => {
  it('accepts a minimal valid graph', () => {
    const g = parseGraph(goodGraph);
    expect(g.version).toBe(1);
    expect(Object.keys(g.lessons)).toEqual(['rule-one']);
    expect(g.lessons['rule-one']?.rule).toBe('Always X.');
  });

  it('accepts an empty graph (fresh init)', () => {
    const g = parseGraph({ version: 1, lessons: {}, topics: {}, triggers: {} });
    expect(g.lessons).toEqual({});
    expect(g.topics).toEqual({});
    expect(g.triggers).toEqual({});
  });

  it('accepts a v2 graph and an always-scoped, trigger-less lesson', () => {
    const g = parseGraph({
      version: 2,
      lessons: {
        'always-one': {
          rule: 'Write comments per the repo style.',
          topics: ['style'],
          triggers: [],
          evidence: [],
          status: 'active',
          scope: 'always',
          createdAt: '2026-06-05',
        },
      },
      topics: { style: { summary: 'Style.' } },
      triggers: {},
    });
    expect(g.version).toBe(2);
    expect(g.lessons['always-one']?.scope).toBe('always');
  });

  it('rejects a scope value other than "always"', () => {
    const bad = clone() as typeof goodGraph & {
      lessons: { 'rule-one': { scope?: string } };
    };
    bad.lessons['rule-one'].scope = 'sometimes';
    expect(() => parseGraph(bad)).toThrow();
  });

  it('accepts optional rationale and supersededBy', () => {
    const bad = clone();
    bad.lessons['rule-one'] = {
      ...bad.lessons['rule-one'],
      rationale: 'because legacy auth broke prod',
      status: 'superseded',
      supersededBy: 'rule-two',
    } as (typeof bad.lessons)['rule-one'];
    const g = parseGraph(bad);
    expect(g.lessons['rule-one']?.rationale).toBe('because legacy auth broke prod');
    expect(g.lessons['rule-one']?.supersededBy).toBe('rule-two');
  });

  it('rejects unknown top-level keys', () => {
    expect(() => parseGraph({ ...goodGraph, extra: 1 })).toThrow();
  });

  it('rejects a lesson with empty rule', () => {
    const bad = clone();
    bad.lessons['rule-one'].rule = '';
    expect(() => parseGraph(bad)).toThrow();
  });

  it('rejects a lesson with no topics', () => {
    const bad = clone();
    bad.lessons['rule-one'].topics = [];
    expect(() => parseGraph(bad)).toThrow();
  });

  it('rejects a trigger with unknown kind', () => {
    const bad = clone() as unknown as {
      triggers: Record<string, { kind: string; pattern: string }>;
    };
    bad.triggers['t-glob-src'].kind = 'banana';
    expect(() => parseGraph(bad)).toThrow();
  });

  it('rejects a non-kebab-case lesson id', () => {
    const bad = clone() as unknown as Record<string, unknown>;
    (bad.lessons as Record<string, unknown>)['Rule_One'] = (bad.lessons as Record<string, unknown>)[
      'rule-one'
    ];
    delete (bad.lessons as Record<string, unknown>)['rule-one'];
    expect(() => parseGraph(bad)).toThrow();
  });

  it('rejects an unknown status value', () => {
    const bad = clone() as unknown as { lessons: Record<string, { status: string }> };
    bad.lessons['rule-one'].status = 'pending';
    expect(() => parseGraph(bad)).toThrow();
  });

  it('rejects a missing version field', () => {
    const { version: _v, ...rest } = goodGraph;
    expect(() => parseGraph(rest)).toThrow();
  });

  it('rejects a malformed createdAt', () => {
    const bad = clone();
    bad.lessons['rule-one'].createdAt = '2026/06/05';
    expect(() => parseGraph(bad)).toThrow();
  });

  it('rejects a topic with empty summary', () => {
    const bad = clone();
    bad.topics['windows-paths'].summary = '';
    expect(() => parseGraph(bad)).toThrow();
  });

  it('rejects a trigger with empty pattern', () => {
    const bad = clone();
    bad.triggers['t-glob-src'].pattern = '';
    expect(() => parseGraph(bad)).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { validateLessonsGraph } from '../../../src/lessons/validate.js';

function baseGraph(): LessonsGraph {
  return {
    version: 1,
    lessons: {
      'a-rule': {
        rule: 'Always X.',
        topics: ['t'],
        triggers: ['t-glob'],
        evidence: [],
        status: 'active',
        createdAt: '2026-06-05',
      },
    },
    topics: { t: { summary: 'Topic.' } },
    triggers: { 't-glob': { kind: 'file_glob', pattern: 'src/**' } },
  };
}

describe('validateLessonsGraph', () => {
  it('reports ok with no findings for a clean graph', () => {
    const r = validateLessonsGraph(baseGraph());
    expect(r.ok).toBe(true);
    expect(r.findings).toEqual([]);
  });

  it('flags a dangling topic reference as an error', () => {
    const g = baseGraph();
    g.lessons['a-rule'].topics = ['missing'];
    const r = validateLessonsGraph(g);
    expect(r.ok).toBe(false);
    expect(r.findings).toContainEqual(
      expect.objectContaining({
        level: 'error',
        code: 'DANGLING_TOPIC',
        lessonId: 'a-rule',
        topicId: 'missing',
      }),
    );
  });

  it('flags a dangling trigger reference as an error', () => {
    const g = baseGraph();
    g.lessons['a-rule'].triggers = ['nope'];
    const r = validateLessonsGraph(g);
    expect(r.ok).toBe(false);
    expect(r.findings).toContainEqual(
      expect.objectContaining({
        level: 'error',
        code: 'DANGLING_TRIGGER',
        lessonId: 'a-rule',
        triggerId: 'nope',
      }),
    );
  });

  it('flags duplicate rule text (normalized) across lessons as an error', () => {
    const g = baseGraph();
    g.lessons['b-rule'] = {
      rule: '  always  X.  ',
      topics: ['t'],
      triggers: ['t-glob'],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-05',
    };
    const r = validateLessonsGraph(g);
    expect(r.ok).toBe(false);
    const dup = r.findings.find((f) => f.code === 'DUPLICATE_RULE');
    expect(dup).toBeDefined();
  });

  it('does NOT flag a duplicate when one copy is superseded (so merge repairs duplicates)', () => {
    const g = baseGraph();
    g.lessons['b-rule'] = {
      ...g.lessons['a-rule'],
      status: 'superseded',
      supersededBy: 'a-rule',
    };
    const r = validateLessonsGraph(g);
    expect(r.findings.some((f) => f.code === 'DUPLICATE_RULE')).toBe(false);
    expect(r.ok).toBe(true);
  });

  it('still flags a duplicate when BOTH copies are active', () => {
    const g = baseGraph();
    g.lessons['b-rule'] = { ...g.lessons['a-rule'] };
    const r = validateLessonsGraph(g);
    expect(r.findings.some((f) => f.code === 'DUPLICATE_RULE')).toBe(true);
    expect(r.ok).toBe(false);
  });

  it('flags self-supersession as an error', () => {
    const g = baseGraph();
    g.lessons['a-rule'].status = 'superseded';
    g.lessons['a-rule'].supersededBy = 'a-rule';
    const r = validateLessonsGraph(g);
    expect(r.findings).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'SELF_SUPERSEDED', lessonId: 'a-rule' }),
    );
  });

  it('flags a supersession cycle as an error', () => {
    const g = baseGraph();
    g.lessons['a-rule'] = { ...g.lessons['a-rule'], status: 'superseded', supersededBy: 'b-rule' };
    g.lessons['b-rule'] = {
      rule: 'B.',
      topics: ['t'],
      triggers: ['t-glob'],
      evidence: [],
      status: 'superseded',
      supersededBy: 'a-rule',
      createdAt: '2026-06-05',
    };
    const r = validateLessonsGraph(g);
    expect(r.findings.some((f) => f.code === 'SUPERSEDE_CYCLE')).toBe(true);
    expect(r.ok).toBe(false);
  });

  it('errors when a superseder is itself inactive (chain dead-ends)', () => {
    const g = baseGraph();
    g.lessons['b-rule'] = {
      rule: 'B.',
      topics: ['t'],
      triggers: ['t-glob'],
      evidence: [],
      status: 'deprecated',
      createdAt: '2026-06-05',
    };
    g.lessons['a-rule'] = { ...g.lessons['a-rule'], status: 'superseded', supersededBy: 'b-rule' };
    const r = validateLessonsGraph(g);
    expect(r.findings).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'INACTIVE_SUPERSEDER', lessonId: 'a-rule' }),
    );
    expect(r.ok).toBe(false);
  });

  it('warns when an active lesson has zero triggers (unreachable)', () => {
    const g = baseGraph();
    g.lessons['a-rule'].triggers = [];
    const r = validateLessonsGraph(g);
    expect(r.findings).toContainEqual(
      expect.objectContaining({ level: 'warning', code: 'UNREACHABLE_LESSON', lessonId: 'a-rule' }),
    );
    expect(r.ok).toBe(true);
  });

  it('flags an orphan trigger as a warning', () => {
    const g = baseGraph();
    g.triggers['t-unused'] = { kind: 'keyword', pattern: 'orphan' };
    const r = validateLessonsGraph(g);
    expect(r.findings).toContainEqual(
      expect.objectContaining({ level: 'warning', code: 'ORPHAN_TRIGGER', triggerId: 't-unused' }),
    );
    expect(r.ok).toBe(true);
  });

  it('flags an orphan topic as a warning', () => {
    const g = baseGraph();
    g.topics['unused'] = { summary: 'Nobody references me.' };
    const r = validateLessonsGraph(g);
    expect(r.findings).toContainEqual(
      expect.objectContaining({ level: 'warning', code: 'ORPHAN_TOPIC', topicId: 'unused' }),
    );
    expect(r.ok).toBe(true);
  });

  it('requires supersededBy when status is superseded', () => {
    const g = baseGraph();
    g.lessons['a-rule'].status = 'superseded';
    const r = validateLessonsGraph(g);
    expect(r.findings).toContainEqual(
      expect.objectContaining({
        level: 'error',
        code: 'SUPERSEDED_WITHOUT_TARGET',
        lessonId: 'a-rule',
      }),
    );
  });

  it('forbids supersededBy when status is active', () => {
    const g = baseGraph();
    g.lessons['b-rule'] = {
      rule: 'B.',
      topics: ['t'],
      triggers: ['t-glob'],
      evidence: [],
      status: 'active',
      supersededBy: 'a-rule',
      createdAt: '2026-06-05',
    };
    const r = validateLessonsGraph(g);
    expect(r.findings).toContainEqual(
      expect.objectContaining({
        level: 'error',
        code: 'ACTIVE_WITH_SUPERSEDER',
        lessonId: 'b-rule',
      }),
    );
  });

  it('flags supersededBy pointing at a missing lesson', () => {
    const g = baseGraph();
    g.lessons['a-rule'].status = 'superseded';
    g.lessons['a-rule'].supersededBy = 'ghost';
    const r = validateLessonsGraph(g);
    expect(r.findings).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'DANGLING_SUPERSEDER', lessonId: 'a-rule' }),
    );
  });

  it('emits one HIGH_FANOUT_TRIGGERS summary warning when a trigger is over-shared', () => {
    const g = baseGraph();
    // 11 active lessons all referencing t-glob → fanout 11 > threshold 10.
    for (let i = 0; i < 11; i++) {
      g.lessons[`f-${i}`] = {
        rule: `Fanout rule ${i}.`,
        topics: ['t'],
        triggers: ['t-glob'],
        evidence: [],
        status: 'active',
        createdAt: '2026-06-05',
      };
    }
    const r = validateLessonsGraph(g);
    const fanout = r.findings.filter((f) => f.code === 'HIGH_FANOUT_TRIGGERS');
    expect(fanout).toHaveLength(1);
    expect(fanout[0]?.level).toBe('warning');
    expect(r.ok).toBe(true);
  });

  it('flags an invalid command_pattern regex as an error', () => {
    const g = baseGraph();
    g.triggers['t-bad'] = { kind: 'command_pattern', pattern: '(' };
    g.lessons['a-rule'].triggers = ['t-glob', 't-bad'];
    const r = validateLessonsGraph(g);
    expect(r.findings).toContainEqual(
      expect.objectContaining({
        level: 'error',
        code: 'INVALID_TRIGGER_PATTERN',
        triggerId: 't-bad',
      }),
    );
    expect(r.ok).toBe(false);
  });

  it('flags a command_pattern the linear engine cannot evaluate as unsafe', () => {
    const g = baseGraph();
    // Lookaround / backreference cannot run on a non-backtracking engine.
    g.triggers['t-unsupported'] = { kind: 'command_pattern', pattern: '(?=foo)bar' };
    g.lessons['a-rule'].triggers = ['t-glob', 't-unsupported'];
    const r = validateLessonsGraph(g);
    expect(r.findings).toContainEqual(
      expect.objectContaining({
        level: 'error',
        code: 'UNSAFE_TRIGGER_PATTERN',
        triggerId: 't-unsupported',
      }),
    );
    expect(r.ok).toBe(false);
  });

  it('does NOT flag a backtracking-shaped but engine-linear pattern as unsafe', () => {
    const g = baseGraph();
    // (a+)+ would ReDoS a RegExp but runs linearly on the engine — accepted.
    g.triggers['t-cmd'] = { kind: 'command_pattern', pattern: '(a+)+$' };
    g.lessons['a-rule'].triggers = ['t-glob', 't-cmd'];
    const r = validateLessonsGraph(g);
    expect(r.findings.some((f) => f.code === 'UNSAFE_TRIGGER_PATTERN')).toBe(false);
    expect(r.ok).toBe(true);
  });

  it('flags a duplicate topic reference within a lesson as an error', () => {
    const g = baseGraph();
    g.lessons['a-rule'].topics = ['t', 't'];
    const r = validateLessonsGraph(g);
    expect(r.findings).toContainEqual(
      expect.objectContaining({
        level: 'error',
        code: 'DUPLICATE_TOPIC_REF',
        lessonId: 'a-rule',
        topicId: 't',
      }),
    );
    expect(r.ok).toBe(false);
  });

  it('flags a duplicate trigger reference within a lesson as an error', () => {
    const g = baseGraph();
    g.lessons['a-rule'].triggers = ['t-glob', 't-glob'];
    const r = validateLessonsGraph(g);
    expect(r.findings).toContainEqual(
      expect.objectContaining({
        level: 'error',
        code: 'DUPLICATE_TRIGGER_REF',
        lessonId: 'a-rule',
        triggerId: 't-glob',
      }),
    );
    expect(r.ok).toBe(false);
  });

  it('flags duplicate (kind, pattern) trigger nodes as an error (content-addressing)', () => {
    const g = baseGraph();
    // Two distinct ids for the same (kind, pattern) — only possible via a
    // low-level/hand-edit; `add` is content-addressed and cannot create this.
    g.triggers['t-glob-dup'] = { kind: 'file_glob', pattern: 'src/**' };
    g.lessons['a-rule'].triggers = ['t-glob', 't-glob-dup'];
    const r = validateLessonsGraph(g);
    const dups = r.findings.filter((f) => f.code === 'DUPLICATE_TRIGGER');
    expect(dups).toHaveLength(2);
    expect(dups.map((f) => f.triggerId).sort()).toEqual(['t-glob', 't-glob-dup']);
    expect(r.ok).toBe(false);
  });

  it('does NOT flag distinct (kind, pattern) triggers as duplicates', () => {
    const g = baseGraph();
    g.triggers['t-kw'] = { kind: 'keyword', pattern: 'src/**' }; // same pattern, different kind
    g.lessons['a-rule'].triggers = ['t-glob', 't-kw'];
    const r = validateLessonsGraph(g);
    expect(r.findings.some((f) => f.code === 'DUPLICATE_TRIGGER')).toBe(false);
    expect(r.ok).toBe(true);
  });

  it('flags schema violations as errors before continuing to other checks', () => {
    const broken = { version: 2, lessons: {}, topics: {}, triggers: {} } as unknown as LessonsGraph;
    const r = validateLessonsGraph(broken);
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.code === 'SCHEMA_INVALID')).toBe(true);
  });
});

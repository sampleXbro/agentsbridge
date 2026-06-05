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

  it('treats a deprecated duplicate as still-duplicate (status does not silence the finding)', () => {
    const g = baseGraph();
    g.lessons['b-rule'] = { ...g.lessons['a-rule'], status: 'deprecated' };
    const r = validateLessonsGraph(g);
    expect(r.findings.some((f) => f.code === 'DUPLICATE_RULE')).toBe(true);
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

  it('flags schema violations as errors before continuing to other checks', () => {
    const broken = { version: 2, lessons: {}, topics: {}, triggers: {} } as unknown as LessonsGraph;
    const r = validateLessonsGraph(broken);
    expect(r.ok).toBe(false);
    expect(r.findings.some((f) => f.code === 'SCHEMA_INVALID')).toBe(true);
  });
});

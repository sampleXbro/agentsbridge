import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintLessonsSubsystem } from '../../../../src/core/lint/shared/lessons.js';

const LESSONS_REL = '.agentsmesh/lessons';
const GRAPH_REL = `${LESSONS_REL}/lessons.json`;
const ROOT_RULE_REL = '.agentsmesh/rules/_root.md';

let ROOT: string;

function write(rel: string, body: string): void {
  const abs = join(ROOT, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, body, 'utf8');
}

function validGraph(): string {
  return JSON.stringify(
    {
      version: 1,
      lessons: {
        'alpha-rule': {
          rule: 'Do the thing.',
          topics: ['alpha'],
          triggers: ['t-glob'],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-05',
        },
      },
      topics: { alpha: { summary: 'Alpha topic.' } },
      triggers: { 't-glob': { kind: 'file_glob', pattern: 'src/**/*.ts' } },
    },
    null,
    2,
  );
}

function validRootRule(): string {
  return '---\nroot: true\n---\n\n# Operational Guidelines\n\n## Lessons (BLOCKING REQUIREMENT — MUST run)\n\nbody\n';
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'agentsmesh-lessons-lint-'));
  // Keep validGraph()'s `src/**/*.ts` trigger LIVE so the dead-`file_glob`
  // liveness check stays quiet — these tests assert the integrity/heading
  // diagnostics, not trigger liveness (which has its own unit coverage).
  write('src/seed.ts', 'export {};\n');
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('lintLessonsSubsystem', () => {
  it('returns no diagnostics when scope is global', () => {
    write(GRAPH_REL, '{ malformed');
    expect(lintLessonsSubsystem(ROOT, 'global')).toEqual([]);
  });

  it('returns no diagnostics when lessons.json is absent (subsystem not installed)', () => {
    expect(lintLessonsSubsystem(ROOT, 'project')).toEqual([]);
  });

  it('returns no diagnostics for a healthy graph + root rule', () => {
    write(GRAPH_REL, validGraph());
    write(ROOT_RULE_REL, validRootRule());
    expect(lintLessonsSubsystem(ROOT, 'project')).toEqual([]);
  });

  it('emits an error when lessons.json is malformed JSON', () => {
    write(GRAPH_REL, '{ not json }');
    write(ROOT_RULE_REL, validRootRule());
    const diags = lintLessonsSubsystem(ROOT, 'project');
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ level: 'error', file: GRAPH_REL, target: 'lessons' });
  });

  it('surfaces graph integrity findings (dangling topic ref) as errors', () => {
    const graph = JSON.parse(validGraph()) as Record<string, unknown>;
    (graph.lessons as Record<string, { topics: string[] }>)['alpha-rule'].topics = ['ghost'];
    write(GRAPH_REL, JSON.stringify(graph, null, 2));
    write(ROOT_RULE_REL, validRootRule());
    const diags = lintLessonsSubsystem(ROOT, 'project');
    expect(diags.some((d) => d.level === 'error' && d.message.includes('DANGLING_TOPIC'))).toBe(
      true,
    );
  });

  it('surfaces graph integrity findings (orphan trigger) as warnings', () => {
    const graph = JSON.parse(validGraph()) as Record<string, unknown>;
    (graph.triggers as Record<string, unknown>)['t-orphan'] = {
      kind: 'keyword',
      pattern: 'orphan',
    };
    write(GRAPH_REL, JSON.stringify(graph, null, 2));
    write(ROOT_RULE_REL, validRootRule());
    const diags = lintLessonsSubsystem(ROOT, 'project');
    expect(diags.some((d) => d.level === 'warning' && d.message.includes('ORPHAN_TRIGGER'))).toBe(
      true,
    );
  });

  it('emits a warning when the procedural rule paragraph is missing from _root.md', () => {
    write(GRAPH_REL, validGraph());
    write(
      ROOT_RULE_REL,
      '---\nroot: true\n---\n\n# Operational Guidelines\n\nno lessons heading\n',
    );
    const diags = lintLessonsSubsystem(ROOT, 'project');
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      level: 'warning',
      file: ROOT_RULE_REL,
      target: 'lessons',
    });
    expect(diags[0]!.message).toMatch(/## Lessons/);
  });

  it('emits a warning when _root.md itself is absent', () => {
    write(GRAPH_REL, validGraph());
    const diags = lintLessonsSubsystem(ROOT, 'project');
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      level: 'warning',
      file: ROOT_RULE_REL,
      target: 'lessons',
    });
  });
});

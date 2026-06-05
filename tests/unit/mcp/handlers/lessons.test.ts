import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lessonsHandlers } from '../../../../src/mcp/handlers/lessons.js';
import type { McpContext } from '../../../../src/mcp/context.js';
import { resolveContext } from '../../../../src/mcp/context.js';
import { saveLessonsGraph, loadLessonsGraph } from '../../../../src/lessons/graph-store.js';
import type { LessonsGraph } from '../../../../src/lessons/graph-schema.js';

let projectRoot: string;
let ctx: McpContext;

const seedGraph: LessonsGraph = {
  version: 1,
  lessons: {
    'topic-x-rule-1': {
      rule: 'Normalize CLI paths.',
      topics: ['topic-x'],
      triggers: ['t-glob'],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-05',
    },
  },
  topics: { 'topic-x': { summary: 'Topic X.' } },
  triggers: { 't-glob': { kind: 'file_glob', pattern: 'src/cli/**/*.ts' } },
};

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'amesh-mcp-lessons-'));
  await mkdir(join(projectRoot, '.agentsmesh'), { recursive: true });
  await writeFile(
    join(projectRoot, 'agentsmesh.yaml'),
    'version: 1\ntargets: []\nfeatures: []\n',
    'utf8',
  );
  saveLessonsGraph(projectRoot, seedGraph);
  ctx = await resolveContext({ cwd: projectRoot });
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe('lessonsHandlers.query', () => {
  it('returns matching lessons when file glob matches', async () => {
    const r = await lessonsHandlers.query(ctx, { file: 'src/cli/x.ts' });
    expect(r.lessons.map((l) => l.id)).toEqual(['topic-x-rule-1']);
  });

  it('returns empty when nothing matches', async () => {
    const r = await lessonsHandlers.query(ctx, { file: 'docs/readme.md' });
    expect(r.lessons).toEqual([]);
  });

  it('returns empty when no graph exists', async () => {
    const fresh = await mkdtemp(join(tmpdir(), 'amesh-mcp-fresh-'));
    await writeFile(
      join(fresh, 'agentsmesh.yaml'),
      'version: 1\ntargets: []\nfeatures: []\n',
      'utf8',
    );
    const freshCtx = await resolveContext({ cwd: fresh });
    const r = await lessonsHandlers.query(freshCtx, { file: 'src/x.ts' });
    expect(r.lessons).toEqual([]);
    await rm(fresh, { recursive: true, force: true });
  });
});

describe('lessonsHandlers.add', () => {
  it('adds a lesson and returns its id', async () => {
    const r = await lessonsHandlers.add(ctx, {
      rule: 'Another rule.',
      topic: 'topic-x',
      trigger_files: ['src/foo/**/*.ts'],
      evidence: ['commit:abc'],
    });
    expect(r.isNewLesson).toBe(true);
    const graph = loadLessonsGraph(projectRoot);
    expect(graph.lessons[r.id]?.rule).toBe('Another rule.');
  });

  it('rejects unknown topic without new_topic', async () => {
    await expect(
      lessonsHandlers.add(ctx, {
        rule: 'X.',
        topic: 'ghost',
        trigger_files: ['src/**'],
      }),
    ).rejects.toThrow(/unknown topic/i);
  });

  it('creates a topic when new_topic + topic_summary are provided', async () => {
    const r = await lessonsHandlers.add(ctx, {
      rule: 'New topic rule.',
      topic: 'fresh',
      topic_summary: 'Fresh topic.',
      new_topic: true,
      trigger_files: ['src/**'],
    });
    expect(r.isNewTopic).toBe(true);
    const graph = loadLessonsGraph(projectRoot);
    expect(graph.topics['fresh']?.summary).toBe('Fresh topic.');
  });

  it('rethrows non-UnknownTopicError failures (e.g. new_topic without topic_summary)', async () => {
    await expect(
      lessonsHandlers.add(ctx, {
        rule: 'X.',
        topic: 'brand-new',
        new_topic: true,
        trigger_files: ['src/**'],
      }),
    ).rejects.toThrow(/topicSummary/i);
  });

  it('is idempotent on repeat with same rule + topic', async () => {
    const a = await lessonsHandlers.add(ctx, {
      rule: 'Idempotent rule.',
      topic: 'topic-x',
      trigger_files: ['src/**'],
    });
    const b = await lessonsHandlers.add(ctx, {
      rule: 'Idempotent rule.',
      topic: 'topic-x',
      trigger_files: ['src/**'],
    });
    expect(b.id).toBe(a.id);
    expect(b.isNewLesson).toBe(false);
  });
});

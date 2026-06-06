import { cpSync, existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const LEGACY_FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../fixtures/lessons/legacy-input',
);
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

  it('is compact by default: id + rule only, no metadata', async () => {
    const r = await lessonsHandlers.query(ctx, { file: 'src/cli/x.ts' });
    expect(r.lessons[0]?.id).toBe('topic-x-rule-1');
    expect(r.lessons[0]?.rule).toBe('Normalize CLI paths.');
    expect(r.lessons[0]?.triggers).toBeUndefined();
    expect(r.lessons[0]?.evidence).toBeUndefined();
  });

  it('includes metadata only when verbose=true', async () => {
    const r = await lessonsHandlers.query(ctx, { file: 'src/cli/x.ts', verbose: true });
    expect(r.lessons[0]?.triggers).toEqual(['t-glob']);
    expect(r.lessons[0]?.topics).toEqual(['topic-x']);
  });

  it('caps results to the limit param and reports totalMatches', async () => {
    const many: LessonsGraph = {
      version: 1,
      lessons: {
        'a-1': {
          rule: 'One.',
          topics: ['t'],
          triggers: ['g'],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
        'a-2': {
          rule: 'Two.',
          topics: ['t'],
          triggers: ['g'],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
        'a-3': {
          rule: 'Three.',
          topics: ['t'],
          triggers: ['g'],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-01',
        },
      },
      topics: { t: { summary: 'T.' } },
      triggers: { g: { kind: 'file_glob', pattern: 'src/**' } },
    };
    saveLessonsGraph(projectRoot, many);
    const r = await lessonsHandlers.query(ctx, { file: 'src/x.ts', limit: 1 });
    expect(r.lessons.length).toBe(1);
    expect(r.totalMatches).toBe(3);
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

describe('lessonsHandlers — legacy auto-migration (no stranding)', () => {
  it('migrates a legacy-only project on MCP query instead of returning empty', async () => {
    const legacy = await mkdtemp(join(tmpdir(), 'amesh-mcp-legacy-'));
    await writeFile(
      join(legacy, 'agentsmesh.yaml'),
      'version: 1\ntargets: []\nfeatures: []\n',
      'utf8',
    );
    cpSync(LEGACY_FIXTURE, join(legacy, '.agentsmesh/lessons'), { recursive: true });
    const legacyCtx = await resolveContext({ cwd: legacy });

    const r = await lessonsHandlers.query(legacyCtx, { keyword: 'alpha' });
    expect(existsSync(join(legacy, '.agentsmesh/lessons/lessons.json'))).toBe(true);
    expect(existsSync(join(legacy, '.agentsmesh/lessons/index.yaml'))).toBe(false);
    expect(r.lessons.length).toBeGreaterThan(0);
    await rm(legacy, { recursive: true, force: true });
  });

  it('migrates before add so capture enriches the migrated graph, not a fresh stub', async () => {
    const legacy = await mkdtemp(join(tmpdir(), 'amesh-mcp-legacy-add-'));
    await writeFile(
      join(legacy, 'agentsmesh.yaml'),
      'version: 1\ntargets: []\nfeatures: []\n',
      'utf8',
    );
    cpSync(LEGACY_FIXTURE, join(legacy, '.agentsmesh/lessons'), { recursive: true });
    const legacyCtx = await resolveContext({ cwd: legacy });

    const before = await lessonsHandlers.topics(legacyCtx); // triggers migration
    await lessonsHandlers.add(legacyCtx, {
      rule: 'A freshly captured MCP rule.',
      topic: before.topics[0]?.id ?? 'alpha',
      trigger_files: ['src/**'],
    });
    expect(existsSync(join(legacy, '.agentsmesh/lessons/index.yaml'))).toBe(false);
    await rm(legacy, { recursive: true, force: true });
  });
});

describe('lessonsHandlers.topics', () => {
  it('lists topic ids and summaries sorted by id', async () => {
    const r = await lessonsHandlers.topics(ctx);
    expect(r.topics).toEqual([{ id: 'topic-x', summary: 'Topic X.' }]);
  });

  it('returns no topics when no graph exists', async () => {
    const fresh = await mkdtemp(join(tmpdir(), 'amesh-mcp-topics-'));
    await writeFile(
      join(fresh, 'agentsmesh.yaml'),
      'version: 1\ntargets: []\nfeatures: []\n',
      'utf8',
    );
    const freshCtx = await resolveContext({ cwd: fresh });
    const r = await lessonsHandlers.topics(freshCtx);
    expect(r.topics).toEqual([]);
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

  it('adds with no trigger arrays supplied (defaults each to empty)', async () => {
    const r = await lessonsHandlers.add(ctx, { rule: 'No triggers at all.', topic: 'topic-x' });
    expect(r.isNewLesson).toBe(true);
    expect(loadLessonsGraph(projectRoot).lessons[r.id]?.triggers).toEqual([]);
  });

  it('accepts command and keyword trigger arrays alongside files', async () => {
    const r = await lessonsHandlers.add(ctx, {
      rule: 'All trigger kinds.',
      topic: 'topic-x',
      trigger_files: ['src/**'],
      trigger_commands: ['^pnpm test'],
      trigger_keywords: ['windows'],
    });
    expect(loadLessonsGraph(projectRoot).lessons[r.id]?.triggers.length).toBe(3);
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

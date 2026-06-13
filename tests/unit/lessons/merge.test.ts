import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { loadLessonsGraph, saveLessonsGraph } from '../../../src/lessons/graph-store.js';
import { mergeLessons } from '../../../src/lessons/merge.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-merge-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/**
 * Keeper lives in topic A with trigger tA; loser lives in topic B with trigger
 * tB. After a merge the keeper must reach both topics and both triggers so it
 * still fires for queries that previously only matched the loser.
 */
function seedTwoTopicGraph(): LessonsGraph {
  const graph: LessonsGraph = {
    version: 1,
    lessons: {
      'a-keep': {
        rule: 'Keeper rule, the canonical wording.',
        topics: ['topic-a'],
        triggers: ['t-a'],
        evidence: ['legacy:a'],
        status: 'active',
        createdAt: '2026-06-05',
      },
      'b-lose': {
        rule: 'Loser rule, a redundant restatement.',
        topics: ['topic-b'],
        triggers: ['t-b'],
        evidence: ['legacy:b'],
        status: 'active',
        createdAt: '2026-06-05',
      },
    },
    topics: { 'topic-a': { summary: 'A.' }, 'topic-b': { summary: 'B.' } },
    triggers: {
      't-a': { kind: 'file_glob', pattern: 'src/a/**' },
      't-b': { kind: 'file_glob', pattern: 'src/b/**' },
    },
  };
  saveLessonsGraph(root, graph);
  return graph;
}

describe('mergeLessons', () => {
  it('supersedes the loser and points it at the keeper', async () => {
    seedTwoTopicGraph();
    const result = await mergeLessons(root, 'b-lose', 'a-keep');
    expect(result).toEqual({ loserId: 'b-lose', keeperId: 'a-keep' });

    const graph = loadLessonsGraph(root);
    expect(graph.lessons['b-lose']?.status).toBe('superseded');
    expect(graph.lessons['b-lose']?.supersededBy).toBe('a-keep');
    expect(graph.lessons['a-keep']?.status).toBe('active');
  });

  it('unions the loser triggers, topics, and evidence onto the keeper (order-stable, deduped)', async () => {
    seedTwoTopicGraph();
    await mergeLessons(root, 'b-lose', 'a-keep');

    const keeper = loadLessonsGraph(root).lessons['a-keep'];
    expect(keeper?.triggers).toEqual(['t-a', 't-b']);
    expect(keeper?.topics).toEqual(['topic-a', 'topic-b']);
    expect(keeper?.evidence).toEqual(['legacy:a', 'legacy:b']);
  });

  it('does not re-add triggers/topics/evidence the keeper already has', async () => {
    const graph = seedTwoTopicGraph();
    graph.lessons['b-lose'] = {
      ...graph.lessons['b-lose']!,
      triggers: ['t-a', 't-b'],
      topics: ['topic-a', 'topic-b'],
      evidence: ['legacy:a', 'legacy:b'],
    };
    saveLessonsGraph(root, graph);

    await mergeLessons(root, 'b-lose', 'a-keep');
    const keeper = loadLessonsGraph(root).lessons['a-keep'];
    expect(keeper?.triggers).toEqual(['t-a', 't-b']);
    expect(keeper?.topics).toEqual(['topic-a', 'topic-b']);
    expect(keeper?.evidence).toEqual(['legacy:a', 'legacy:b']);
  });

  it('leaves the graph valid: keeper stays queryable for the loser old triggers', async () => {
    seedTwoTopicGraph();
    await mergeLessons(root, 'b-lose', 'a-keep');
    const { queryLessons } = await import('../../../src/lessons/query.js');
    const matches = queryLessons(loadLessonsGraph(root), { file: 'src/b/x.ts' });
    expect(matches.map((m) => m.id)).toEqual(['a-keep']);
  });

  it('rejects merging a lesson into itself', async () => {
    seedTwoTopicGraph();
    await expect(mergeLessons(root, 'a-keep', 'a-keep')).rejects.toThrow(/itself|same/i);
  });

  it('rejects an unknown loser or keeper', async () => {
    seedTwoTopicGraph();
    await expect(mergeLessons(root, 'ghost', 'a-keep')).rejects.toThrow(/ghost/);
    await expect(mergeLessons(root, 'b-lose', 'ghost')).rejects.toThrow(/ghost/);
  });

  it('rejects merging into a non-active keeper', async () => {
    const graph = seedTwoTopicGraph();
    graph.lessons['a-keep'] = { ...graph.lessons['a-keep']!, status: 'deprecated' };
    saveLessonsGraph(root, graph);
    await expect(mergeLessons(root, 'b-lose', 'a-keep')).rejects.toThrow(/active/i);
  });

  it('rejects re-merging a loser that is already superseded', async () => {
    seedTwoTopicGraph();
    await mergeLessons(root, 'b-lose', 'a-keep');
    await expect(mergeLessons(root, 'b-lose', 'a-keep')).rejects.toThrow(/superseded|already/i);
  });

  it('supports 3-way clusters: two losers folded into one keeper', async () => {
    const graph = seedTwoTopicGraph();
    graph.topics['topic-c'] = { summary: 'C.' };
    graph.triggers['t-c'] = { kind: 'file_glob', pattern: 'src/c/**' };
    graph.lessons['c-lose'] = {
      rule: 'Third redundant restatement.',
      topics: ['topic-c'],
      triggers: ['t-c'],
      evidence: ['legacy:c'],
      status: 'active',
      createdAt: '2026-06-05',
    };
    saveLessonsGraph(root, graph);

    await mergeLessons(root, 'b-lose', 'a-keep');
    await mergeLessons(root, 'c-lose', 'a-keep');

    const out = loadLessonsGraph(root);
    expect(out.lessons['a-keep']?.topics).toEqual(['topic-a', 'topic-b', 'topic-c']);
    expect(out.lessons['a-keep']?.triggers).toEqual(['t-a', 't-b', 't-c']);
    expect(out.lessons['b-lose']?.status).toBe('superseded');
    expect(out.lessons['c-lose']?.status).toBe('superseded');
  });
});

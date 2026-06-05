import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import {
  graphFilePath,
  loadLessonsGraph,
  saveLessonsGraph,
  serializeGraph,
  tryLoadLessonsGraph,
} from '../../../src/lessons/graph-store.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-graph-store-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const graph: LessonsGraph = {
  version: 1,
  lessons: {
    'b-second': {
      rule: 'B rule.',
      topics: ['t'],
      triggers: ['x'],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-02',
    },
    'a-first': {
      rule: 'A rule.',
      topics: ['t'],
      triggers: ['x'],
      evidence: ['commit:abc'],
      status: 'active',
      createdAt: '2026-06-01',
    },
  },
  topics: { t: { summary: 'Topic.' } },
  triggers: { x: { kind: 'file_glob', pattern: 'src/**' } },
};

describe('graph-store', () => {
  it('graphFilePath uses .agentsmesh/lessons/lessons.json under the project root', () => {
    expect(graphFilePath(root).replaceAll('\\', '/')).toBe(
      `${root.replaceAll('\\', '/')}/.agentsmesh/lessons/lessons.json`,
    );
  });

  it('serializes deterministically with sorted keys', () => {
    const reordered: LessonsGraph = JSON.parse(
      JSON.stringify({
        triggers: graph.triggers,
        topics: graph.topics,
        lessons: { 'b-second': graph.lessons['b-second'], 'a-first': graph.lessons['a-first'] },
        version: graph.version,
      }),
    ) as LessonsGraph;
    expect(serializeGraph(reordered)).toBe(serializeGraph(graph));
  });

  it('ends every serialized graph with a single trailing newline', () => {
    const out = serializeGraph(graph);
    expect(out.endsWith('\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
  });

  it('orders lesson keys alphabetically in the serialized output', () => {
    const out = serializeGraph(graph);
    const aIdx = out.indexOf('"a-first"');
    const bIdx = out.indexOf('"b-second"');
    expect(aIdx).toBeGreaterThan(-1);
    expect(bIdx).toBeGreaterThan(aIdx);
  });

  it('round-trips through save and load', () => {
    saveLessonsGraph(root, graph);
    expect(loadLessonsGraph(root)).toEqual(graph);
  });

  it('save is idempotent byte-for-byte', () => {
    saveLessonsGraph(root, graph);
    const first = readFileSync(graphFilePath(root), 'utf8');
    saveLessonsGraph(root, loadLessonsGraph(root));
    const second = readFileSync(graphFilePath(root), 'utf8');
    expect(second).toBe(first);
  });

  it('tryLoadLessonsGraph returns null when the file is absent', () => {
    expect(tryLoadLessonsGraph(root)).toBeNull();
  });

  it('tryLoadLessonsGraph returns the graph when the file exists', () => {
    saveLessonsGraph(root, graph);
    expect(tryLoadLessonsGraph(root)).toEqual(graph);
  });

  it('loadLessonsGraph throws on a malformed file', () => {
    saveLessonsGraph(root, graph);
    const path = graphFilePath(root);
    rmSync(path, { force: true });
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '{ not json }', 'utf8');
    expect(() => loadLessonsGraph(root)).toThrow();
  });
});

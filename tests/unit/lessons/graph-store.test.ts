import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import {
  graphFilePath,
  loadLessonsGraph,
  loadLessonsGraphResilient,
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

  it('writes atomically, leaving no temp file behind', () => {
    saveLessonsGraph(root, graph);
    const leftovers = readdirSync(dirname(graphFilePath(root))).filter((f) => f.endsWith('.tmp'));
    expect(leftovers).toEqual([]);
    expect(loadLessonsGraph(root)).toEqual(graph);
  });

  it('overwrites an existing graph in place', () => {
    saveLessonsGraph(root, graph);
    const next: LessonsGraph = { version: 1, lessons: {}, topics: {}, triggers: {} };
    saveLessonsGraph(root, next);
    expect(loadLessonsGraph(root)).toEqual(next);
  });

  it('tryLoadLessonsGraph returns null when the file is absent', () => {
    expect(tryLoadLessonsGraph(root)).toBeNull();
  });

  it('tryLoadLessonsGraph returns the graph when the file exists', () => {
    saveLessonsGraph(root, graph);
    expect(tryLoadLessonsGraph(root)).toEqual(graph);
  });

  it('serializes a null nested value without throwing (canonicalizer robustness)', () => {
    // The canonicalizer is a general JSON walker; a null value must pass through
    // as `null` rather than being treated as an object (Object.entries(null) throws).
    const withNull = {
      version: 1,
      lessons: {},
      topics: {},
      triggers: {},
      extra: null,
    } as unknown as LessonsGraph;
    expect(serializeGraph(withNull)).toContain('"extra": null');
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

describe('loadLessonsGraphResilient', () => {
  it('reports an absent graph as status "absent" with a null graph', () => {
    expect(loadLessonsGraphResilient(root)).toEqual({ status: 'absent', graph: null });
  });

  it('reports a valid graph as status "ok" with the parsed graph', () => {
    saveLessonsGraph(root, graph);
    const result = loadLessonsGraphResilient(root);
    expect(result.status).toBe('ok');
    expect(result.graph).toEqual(graph);
  });

  it('reports invalid JSON as status "corrupt" with an Error and a null graph (never throws)', () => {
    const path = graphFilePath(root);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '{ not json }', 'utf8');
    const result = loadLessonsGraphResilient(root);
    expect(result.status).toBe('corrupt');
    expect(result.graph).toBeNull();
    expect(result.status === 'corrupt' && result.error).toBeInstanceOf(Error);
  });

  it('reports schema-invalid (but valid JSON) content as status "corrupt"', () => {
    const path = graphFilePath(root);
    mkdirSync(dirname(path), { recursive: true });
    // Valid JSON, but missing required fields → zod parseGraph rejects it.
    writeFileSync(path, JSON.stringify({ version: 1, lessons: 'not-an-object' }), 'utf8');
    const result = loadLessonsGraphResilient(root);
    expect(result.status).toBe('corrupt');
    expect(result.graph).toBeNull();
  });

  it('reports a graph with a newer numeric version as "newer-version", not "corrupt"', () => {
    const path = graphFilePath(root);
    mkdirSync(dirname(path), { recursive: true });
    // A future schema (version 3) is valid JSON but unknown to this CLI. It must
    // degrade with an upgrade hint, not be mislabeled corrupt.
    writeFileSync(
      path,
      JSON.stringify({ version: 3, lessons: {}, topics: {}, triggers: {} }),
      'utf8',
    );
    const result = loadLessonsGraphResilient(root);
    expect(result.status).toBe('newer-version');
    expect(result.graph).toBeNull();
    expect(result.status === 'newer-version' && result.version).toBe(3);
  });

  it('accepts a current v2 graph (not newer-version)', () => {
    const path = graphFilePath(root);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({ version: 2, lessons: {}, topics: {}, triggers: {} }),
      'utf8',
    );
    expect(loadLessonsGraphResilient(root).status).toBe('ok');
  });
});

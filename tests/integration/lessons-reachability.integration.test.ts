import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { tryLoadLessonsGraph } from '../../src/lessons/graph-store.js';
import { listProjectFiles } from '../../src/lessons/project-files.js';
import { auditReachability } from '../../src/lessons/reachability.js';

let root: string;
afterEach(() => {
  if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
});

function write(rel: string, content: string): void {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, 'utf8');
}

/**
 * End-to-end composition: load a real on-disk graph, walk the real working tree,
 * and audit — proving a glob's liveness reflects what actually exists on disk
 * (the same notion `validate`/`prune` use), not a hand-supplied path set.
 */
describe('reachability audit over a real on-disk graph', () => {
  it('tiers lessons by whether their globs match files that exist on disk', () => {
    root = mkdtempSync(join(tmpdir(), 'am-reach-'));
    write('src/real.ts', 'export const x = 1;\n');
    const graph = {
      version: 1,
      topics: { t: { summary: 's' } },
      triggers: {
        'g-live': { kind: 'file_glob', pattern: 'src/*.ts' },
        'g-dead': { kind: 'file_glob', pattern: 'src/ghost/*.ts' },
        kw: { kind: 'keyword', pattern: 'deployment' },
      },
      lessons: {
        'l-live': {
          rule: 'r',
          topics: ['t'],
          triggers: ['g-live'],
          evidence: ['e'],
          status: 'active',
          createdAt: '2026-01-01',
        },
        'l-dead': {
          rule: 'r',
          topics: ['t'],
          triggers: ['g-dead'],
          evidence: ['e'],
          status: 'active',
          createdAt: '2026-01-01',
        },
        'l-kw': {
          rule: 'r',
          topics: ['t'],
          triggers: ['kw'],
          evidence: ['e'],
          status: 'active',
          createdAt: '2026-01-01',
        },
      },
    };
    write('.agentsmesh/lessons/lessons.json', JSON.stringify(graph));

    const loaded = tryLoadLessonsGraph(root);
    expect(loaded).not.toBeNull();
    const files = listProjectFiles(root);
    expect(files).not.toBeNull();

    const report = auditReachability(loaded!, files!);
    expect(report.activeLessons).toBe(3);
    expect(report.fileReachable).toBe(1); // l-live: src/*.ts matches the on-disk src/real.ts
    expect(report.commandPattern).toBe(0);
    expect(report.keywordOnly).toBe(1); // l-kw
    expect(report.inert).toBe(1); // l-dead: src/ghost/*.ts matches nothing on disk
    expect(report.weak.map((w) => w.id).sort()).toEqual(['l-dead', 'l-kw']);
  });
});

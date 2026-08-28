import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  commandDefinitelyUnmatched,
  commandFastpathCachePath,
  currentGraphStamp,
  refreshCommandFastpath,
} from '../../../src/lessons/cmd-fastpath.js';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { graphFilePath, loadLessonsGraph } from '../../../src/lessons/graph-store.js';
import { recallLessons } from '../../../src/lessons/recall.js';

const GRAPH: LessonsGraph = {
  version: 2,
  topics: { t: { summary: 't' } },
  triggers: {
    'cmd-commit': { kind: 'command_pattern', pattern: 'git commit' },
    'kw-rebase': { kind: 'keyword', pattern: 'link rebase' },
    'glob-src': { kind: 'file_glob', pattern: 'src/**' },
    'cmd-always': { kind: 'command_pattern', pattern: 'always only' },
    'cmd-dead': { kind: 'command_pattern', pattern: 'deprecated only' },
  },
  lessons: {
    l1: {
      rule: 'commit carefully',
      topics: ['t'],
      triggers: ['cmd-commit', 'kw-rebase', 'glob-src'],
      evidence: [],
      status: 'active',
      createdAt: '2026-01-01',
    },
    l2: {
      rule: 'universal standard',
      topics: ['t'],
      triggers: ['cmd-always'],
      evidence: [],
      status: 'active',
      createdAt: '2026-01-01',
      scope: 'always',
    },
    l3: {
      rule: 'retired rule',
      topics: ['t'],
      triggers: ['cmd-dead'],
      evidence: [],
      status: 'deprecated',
      createdAt: '2026-01-01',
    },
  },
};

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-fastpath-'));
  const p = graphFilePath(root);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(GRAPH), 'utf8');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const refresh = (): void => {
  // The contract: stamp BEFORE the read, then hand both to the refresher.
  const pre = currentGraphStamp(root);
  refreshCommandFastpath(root, loadLessonsGraph(root), pre);
};

describe('cache priming via recallLessons', () => {
  it('a real recall primes the cache — deleting the wiring would fail this', async () => {
    await recallLessons(root, { file: 'src/x.ts' });
    expect(commandDefinitelyUnmatched(root, 'ls -la')).toBe(true);
  });
});

describe('commandDefinitelyUnmatched', () => {
  it('is false (full path) when no cache has been written yet', () => {
    expect(commandDefinitelyUnmatched(root, 'ls -la')).toBe(false);
  });

  it('is true for a command no active trigger can match', () => {
    refresh();
    expect(commandDefinitelyUnmatched(root, 'ls -la')).toBe(true);
  });

  it('is false when a command_pattern trigger matches', () => {
    refresh();
    expect(commandDefinitelyUnmatched(root, 'git commit -m "wip"')).toBe(false);
  });

  it('is false when a keyword trigger matches the command tokens', () => {
    refresh();
    expect(commandDefinitelyUnmatched(root, 'run link rebase now')).toBe(false);
  });

  it('ignores triggers reachable only via always-on or inactive lessons', () => {
    refresh();
    expect(commandDefinitelyUnmatched(root, 'always only run')).toBe(true);
    expect(commandDefinitelyUnmatched(root, 'deprecated only run')).toBe(true);
  });

  it('is false (full path) when the graph changed after the cache was written', () => {
    refresh();
    const grown: LessonsGraph = {
      ...GRAPH,
      triggers: { ...GRAPH.triggers, 'cmd-ls': { kind: 'command_pattern', pattern: 'ls' } },
      lessons: {
        ...GRAPH.lessons,
        l4: {
          rule: 'listing rule',
          topics: ['t'],
          triggers: ['cmd-ls'],
          evidence: [],
          status: 'active',
          createdAt: '2026-01-01',
        },
      },
    };
    writeFileSync(graphFilePath(root), JSON.stringify(grown), 'utf8');
    expect(commandDefinitelyUnmatched(root, 'ls -la')).toBe(false);
  });

  it('refuses to cache when a write landed inside the read window (stamp race)', () => {
    // Stamp v1, read v1 — then v2 (with a matching `ls` trigger) atomically
    // replaces the file before the refresher runs. Caching v1's patterns under
    // v2's stamp would make `ls` a permanent false "cannot match"; the pre-read
    // stamp mismatch must skip the write entirely.
    const pre = currentGraphStamp(root);
    const v1 = loadLessonsGraph(root);
    const grown: LessonsGraph = {
      ...GRAPH,
      triggers: { ...GRAPH.triggers, 'cmd-ls': { kind: 'command_pattern', pattern: 'ls' } },
      lessons: {
        ...GRAPH.lessons,
        l4: {
          rule: 'listing rule',
          topics: ['t'],
          triggers: ['cmd-ls'],
          evidence: [],
          status: 'active',
          createdAt: '2026-01-01',
        },
      },
    };
    writeFileSync(graphFilePath(root), JSON.stringify(grown), 'utf8');
    refreshCommandFastpath(root, v1, pre);
    expect(commandDefinitelyUnmatched(root, 'ls -la')).toBe(false);
  });

  it('is false (full path) when the cache file is corrupt', () => {
    refresh();
    writeFileSync(commandFastpathCachePath(root), '{not json', 'utf8');
    expect(commandDefinitelyUnmatched(root, 'ls -la')).toBe(false);
  });
});

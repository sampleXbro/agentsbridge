import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadRecallConfig } from '../../../src/lessons/recall-config.js';
import { DEFAULT_RECALL_LIMIT, DEFAULT_RECALL_MAX_TOKENS } from '../../../src/lessons/ranking.js';
import { recallLessons } from '../../../src/lessons/recall.js';
import { saveLessonsGraph } from '../../../src/lessons/graph-store.js';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-recall-cfg-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeConfig(content: string): void {
  mkdirSync(join(root, '.agentsmesh/lessons'), { recursive: true });
  writeFileSync(join(root, '.agentsmesh/lessons/config.json'), content);
}

describe('loadRecallConfig', () => {
  it('returns the built-in defaults when no config file exists', () => {
    expect(loadRecallConfig(root)).toEqual({
      limit: DEFAULT_RECALL_LIMIT,
      maxTokens: DEFAULT_RECALL_MAX_TOKENS,
    });
  });

  it('reads both overrides when present and valid', () => {
    writeConfig(JSON.stringify({ recallLimit: 5, recallMaxTokens: 250 }));
    expect(loadRecallConfig(root)).toEqual({ limit: 5, maxTokens: 250 });
  });

  it('falls back per-field: an absent field keeps its default', () => {
    writeConfig(JSON.stringify({ recallLimit: 3 }));
    expect(loadRecallConfig(root)).toEqual({
      limit: 3,
      maxTokens: DEFAULT_RECALL_MAX_TOKENS,
    });
  });

  it('ignores invalid values (non-positive, non-integer, wrong type) and uses the default', () => {
    writeConfig(JSON.stringify({ recallLimit: 0, recallMaxTokens: 'lots' }));
    expect(loadRecallConfig(root)).toEqual({
      limit: DEFAULT_RECALL_LIMIT,
      maxTokens: DEFAULT_RECALL_MAX_TOKENS,
    });
  });

  it('is resilient to malformed JSON (recall is a blocking hot path — never throw)', () => {
    writeConfig('{ this is not json');
    expect(loadRecallConfig(root)).toEqual({
      limit: DEFAULT_RECALL_LIMIT,
      maxTokens: DEFAULT_RECALL_MAX_TOKENS,
    });
  });

  it('recallLessons honors the per-project recallLimit (end-to-end wiring)', async () => {
    const graph: LessonsGraph = {
      version: 1,
      lessons: Object.fromEntries(
        ['a', 'b', 'c'].map((id) => [
          id,
          {
            rule: `Rule ${id}.`,
            topics: ['t'],
            triggers: ['t-glob'],
            evidence: [],
            status: 'active' as const,
            createdAt: '2026-06-01',
          },
        ]),
      ),
      topics: { t: { summary: 'T.' } },
      triggers: { 't-glob': { kind: 'file_glob', pattern: 'src/**/*.ts' } },
    };
    saveLessonsGraph(root, graph);

    const def = await recallLessons(root, { file: 'src/x.ts' });
    expect(def.lessons).toHaveLength(3); // default limit (10) returns all 3

    writeConfig(JSON.stringify({ recallLimit: 1 }));
    const capped = await recallLessons(root, { file: 'src/x.ts' });
    expect(capped.lessons).toHaveLength(1); // per-project cap applied
  });
});

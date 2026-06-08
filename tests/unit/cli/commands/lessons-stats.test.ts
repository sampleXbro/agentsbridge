import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { doStats } from '../../../../src/cli/commands/lessons-handlers.js';
import type { LessonsStatsData } from '../../../../src/cli/commands/lessons-types.js';
import type { LessonsGraph } from '../../../../src/lessons/graph-schema.js';
import { saveLessonsGraph } from '../../../../src/lessons/graph-store.js';
import { appendRecallRecord, TELEMETRY_ENV } from '../../../../src/lessons/telemetry.js';

let root: string;
const on = { [TELEMETRY_ENV]: '1' };

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-stats-cmd-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const graph: LessonsGraph = {
  version: 1,
  lessons: {
    kw: {
      rule: 'Keyword-only rule.',
      topics: ['t'],
      triggers: ['t-kw'],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-01',
    },
  },
  topics: { t: { summary: 'T.' } },
  triggers: { 't-kw': { kind: 'keyword', pattern: 'x' } },
};

function statsData(result: ReturnType<typeof doStats>): LessonsStatsData {
  if (result.subcommand !== 'stats') throw new Error('expected stats');
  return result.data;
}

describe('doStats', () => {
  it('reports hasLog=false and zeroed totals when telemetry never ran', () => {
    saveLessonsGraph(root, graph);
    const data = statsData(doStats({}, root));
    expect(data.hasLog).toBe(false);
    // Default test env has telemetry off, so the renderer shows the "enable it" hint.
    expect(data.telemetryEnabled).toBe(false);
    expect(data.report.totalRecalls).toBe(0);
    // The graph still yields the static reachability gap.
    expect(data.report.reachability.keywordOnlyUnreachableLessons).toBe(1);
  });

  it('summarizes a recorded log against the graph', () => {
    saveLessonsGraph(root, graph);
    appendRecallRecord(
      root,
      {
        ts: '2026-06-07T00:00:00.000Z',
        hasFile: true,
        hasCommand: false,
        hasKeyword: false,
        totalMatches: 0,
        returnedCount: 0,
        returnedTokens: 0,
        truncated: false,
        matchedByKind: { file: 0, command: 0, keyword: 0 },
      },
      on,
    );
    const data = statsData(doStats({}, root));
    expect(data.hasLog).toBe(true);
    expect(data.report.totalRecalls).toBe(1);
    expect(data.report.noMatchRate).toBe(1);
  });

  it('honors --json by selecting the json format', () => {
    saveLessonsGraph(root, graph);
    const result = doStats({ json: true }, root);
    expect(result.subcommand === 'stats' && result.format).toBe('json');
  });

  it('does not throw on a project with no lessons graph', () => {
    const data = statsData(doStats({}, root)); // no saveLessonsGraph
    expect(data.hasLog).toBe(false);
    expect(data.report.totalRecalls).toBe(0);
    expect(data.report.reachability.keywordOnlyUnreachableLessons).toBe(0);
  });
});

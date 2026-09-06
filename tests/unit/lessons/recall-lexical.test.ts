import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { saveLessonsGraph } from '../../../src/lessons/graph-store.js';
import { recallLessons } from '../../../src/lessons/recall.js';
import { readRecallLog, TELEMETRY_ENV } from '../../../src/lessons/telemetry.js';

const graph: LessonsGraph = {
  version: 2,
  lessons: {
    // Reachable only by its wording: the keyword trigger never matches.
    lex: {
      rule: 'Reveal an animateMotion driven SVG element on the SMIL clock, never with a CSS delay.',
      topics: ['t'],
      triggers: ['kw-never'],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-01',
    },
    trig: {
      rule: 'Trigger-matched rule about the svg clock.',
      topics: ['t'],
      triggers: ['kw-hit'],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-01',
    },
  },
  topics: { t: { summary: 'T.' } },
  triggers: {
    'kw-never': { kind: 'keyword', pattern: 'zzz-never-matches' },
    'kw-hit': { kind: 'keyword', pattern: 'svg clock' },
  },
};

const PROMPT = 'why do the svg clock animation dots sit parked in the corner';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-lexical-'));
  saveLessonsGraph(root, graph);
  // Telemetry via the project config, with the env var explicitly neutral.
  mkdirSync(join(root, '.agentsmesh', 'lessons'), { recursive: true });
  writeFileSync(join(root, '.agentsmesh', 'lessons', 'config.json'), '{ "telemetry": true }');
  vi.stubEnv(TELEMETRY_ENV, '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe('recallLessons: lexical retrieval on keyword-only queries', () => {
  it('adds a wording match behind the trigger match on a keyword-only query', async () => {
    const { lessons, totalMatches } = await recallLessons(root, { keyword: PROMPT });
    expect(lessons.map((l) => l.id)).toEqual(['trig', 'lex']);
    expect(lessons[1]!.reason.lexical).toBe(true);
    expect(lessons[0]!.reason.lexical).toBeUndefined();
    expect(totalMatches).toBe(2);
  });

  it('never runs on the tool-call path, even when task text rides along', async () => {
    const { lessons } = await recallLessons(root, { file: 'src/x.ts', keyword: PROMPT });
    expect(lessons.map((l) => l.id)).toEqual(['trig']);
  });

  it('records how many candidates came from wording in the recall log', async () => {
    await recallLessons(root, { keyword: PROMPT });
    const last = readRecallLog(root).at(-1);
    expect(last?.matchedByKind).toEqual({ file: 0, command: 0, keyword: 1, text: 1 });
    expect(last?.totalMatches).toBe(2);
  });
});

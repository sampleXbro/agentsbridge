import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { doQuery } from '../../../../src/cli/commands/lessons-handlers.js';
import type { LessonsQueryData } from '../../../../src/cli/commands/lessons-types.js';
import type { LessonsGraph } from '../../../../src/lessons/graph-schema.js';
import { saveLessonsGraph } from '../../../../src/lessons/graph-store.js';

/**
 * The CLI `lessons query` handler runs its own match+rank pipeline, so the
 * task-start `--keyword` recall on non-hook tools must reach lessons by wording
 * exactly like the prompt-submit hook does — and label them for --json readers.
 */
const RULE =
  'Reveal an animateMotion driven SVG element on the SMIL clock, never with a CSS delay.';
const graph: LessonsGraph = {
  version: 2,
  lessons: {
    lex: {
      rule: RULE,
      topics: ['t'],
      triggers: ['kw-never'],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-01',
    },
  },
  topics: { t: { summary: 'T.' } },
  triggers: { 'kw-never': { kind: 'keyword', pattern: 'zzz-never-matches' } },
};
const PROMPT = 'why do the svg clock animation dots sit parked in the corner';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-query-lexical-'));
  saveLessonsGraph(root, graph);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const lessonsOf = (flags: Record<string, string>): LessonsQueryData['lessons'] =>
  (doQuery(flags, root, false).data as LessonsQueryData).lessons;

describe('lessons query: lexical retrieval on the CLI path', () => {
  it('reaches a lesson by wording on a keyword-only query and labels it', () => {
    const lessons = lessonsOf({ keyword: PROMPT });
    expect(lessons.map((l) => l.id)).toEqual(['lex']);
    expect(lessons[0]!.lexical).toBe(true);
  });

  it('stays trigger-only once a file or command is in the query', () => {
    expect(lessonsOf({ keyword: PROMPT, file: 'src/x.ts' })).toEqual([]);
  });
});

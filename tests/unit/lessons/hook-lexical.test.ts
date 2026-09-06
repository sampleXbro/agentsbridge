import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { saveLessonsGraph } from '../../../src/lessons/graph-store.js';
import { buildRecallHookOutput } from '../../../src/lessons/hook.js';

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

let root: string;
let n = 0;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-hook-lexical-'));
  saveLessonsGraph(root, graph);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
const session = (): string => `lex-${process.pid}-${n++}`;

describe('recall hook: lexical retrieval', () => {
  it('surfaces a lesson by its wording on UserPromptSubmit', async () => {
    const out = await buildRecallHookOutput(
      JSON.stringify({
        session_id: session(),
        hook_event_name: 'UserPromptSubmit',
        prompt: 'why do the svg clock animation dots sit parked in the corner',
      }),
      root,
    );
    expect(out.output).toContain(RULE);
  });

  it('does not reach for wording on a tool call, even with matching change content', async () => {
    const out = await buildRecallHookOutput(
      JSON.stringify({
        session_id: session(),
        hook_event_name: 'PreToolUse',
        tool_input: { file_path: 'src/x.ts', new_string: 'svg clock animation dots parked corner' },
      }),
      root,
    );
    expect(out.output).toBe('');
  });
});

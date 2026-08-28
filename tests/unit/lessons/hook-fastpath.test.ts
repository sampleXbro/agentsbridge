import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  currentGraphStamp,
  refreshCommandFastpath,
} from '../../../src/lessons/cmd-fastpath.js';
import { contextKey } from '../../../src/lessons/context-key.js';
import { graphFilePath, loadLessonsGraph } from '../../../src/lessons/graph-store.js';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { buildRecallHookOutput } from '../../../src/lessons/hook.js';
import { recordFailure } from '../../../src/lessons/outcome-log.js';
import { readRecallLog } from '../../../src/lessons/telemetry.js';

const ON = { AGENTSMESH_LESSONS_TELEMETRY: '1' } as NodeJS.ProcessEnv;

const GRAPH: LessonsGraph = {
  version: 2,
  topics: { t: { summary: 't' } },
  triggers: {
    'glob-src': { kind: 'file_glob', pattern: 'src/**' },
    'cmd-commit': { kind: 'command_pattern', pattern: 'git commit' },
  },
  lessons: {
    l1: {
      rule: 'edit src carefully',
      topics: ['t'],
      triggers: ['glob-src'],
      evidence: [],
      status: 'active',
      createdAt: '2026-01-01',
    },
    l2: {
      rule: 'commit with care',
      topics: ['t'],
      triggers: ['cmd-commit'],
      evidence: [],
      status: 'active',
      createdAt: '2026-01-01',
    },
  },
};

let root: string;
let prevTel: string | undefined;
let prevSession: string | undefined;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-hook-fastpath-'));
  const p = graphFilePath(root);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(GRAPH), 'utf8');
  prevTel = process.env.AGENTSMESH_LESSONS_TELEMETRY;
  process.env.AGENTSMESH_LESSONS_TELEMETRY = '1';
  prevSession = process.env.AGENTSMESH_SESSION_ID;
  delete process.env.AGENTSMESH_SESSION_ID;
});
afterEach(() => {
  if (prevTel === undefined) delete process.env.AGENTSMESH_LESSONS_TELEMETRY;
  else process.env.AGENTSMESH_LESSONS_TELEMETRY = prevTel;
  if (prevSession === undefined) delete process.env.AGENTSMESH_SESSION_ID;
  else process.env.AGENTSMESH_SESSION_ID = prevSession;
  rmSync(root, { recursive: true, force: true });
});

const stdin = (command: string): string =>
  JSON.stringify({
    hook_event_name: 'PreToolUse',
    session_id: 'hs-fp',
    tool_input: { command },
  });

const refresh = (): void => {
  const pre = currentGraphStamp(root);
  refreshCommandFastpath(root, loadLessonsGraph(root), pre);
};

describe('hook wiring: command fast path', () => {
  it('returns empty on a provably-unmatched command and records the FULL parity record', async () => {
    refresh();
    const out = await buildRecallHookOutput(stdin('ls -la'), root);
    expect(out.output).toBe('');
    const recs = readRecallLog(root);
    expect(recs).toHaveLength(1);
    const rec = recs[0]!;
    expect(typeof rec.ts).toBe('string');
    expect(rec).toEqual({
      ts: rec.ts,
      hasFile: false,
      hasCommand: true,
      hasKeyword: false,
      totalMatches: 0,
      returnedCount: 0,
      returnedTokens: 0,
      truncated: false,
      matchedByKind: { file: 0, command: 0, keyword: 0 },
      lessonIds: [],
      bypassed: false,
      session: 'hs-fp',
    });
  });

  it('defers to the full path (and injects) for a command a trigger matches', async () => {
    refresh();
    const out = await buildRecallHookOutput(stdin('git commit -m "wip"'), root);
    expect(out.output).toContain('commit with care');
  });

  it('an uncovered recurring command still fast-paths to empty (no covering lesson → no escalation)', async () => {
    const key = contextKey({ command: 'ls -la' }, root);
    recordFailure(root, key, undefined, ON);
    recordFailure(root, key, undefined, ON);
    refresh();
    const out = await buildRecallHookOutput(stdin('ls -la'), root);
    expect(out.output).toBe('');
  });

  it('takes the full path when no cache exists yet — behavior unchanged', async () => {
    const out = await buildRecallHookOutput(stdin('ls -la'), root);
    expect(out.output).toBe('');
    expect(readRecallLog(root)).toHaveLength(1);
  });

  it('never eats a file-touch recall (fast path is command-only)', async () => {
    refresh();
    const out = await buildRecallHookOutput(
      JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: 'hs-fp',
        tool_input: { file_path: 'src/x.ts' },
      }),
      root,
    );
    expect(out.output).toContain('edit src carefully');
  });
});

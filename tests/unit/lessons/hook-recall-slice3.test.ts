import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { saveLessonsGraph } from '../../../src/lessons/graph-store.js';
import { buildRecallHookOutput } from '../../../src/lessons/hook.js';
import { readOutcomeLog } from '../../../src/lessons/outcome-log.js';

let root: string;
const sessions: string[] = [];
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-hook-s3-'));
  // Recurrence is driven by the outcome log, which only records with telemetry on.
  vi.stubEnv('AGENTSMESH_LESSONS_TELEMETRY', '1');
  vi.stubEnv('AGENTSMESH_SESSION_ID', 's3');
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
  for (const id of sessions.splice(0)) {
    rmSync(join(tmpdir(), 'agentsmesh-lessons-seen', `${id}.json`), { force: true });
  }
});

function ctx(out: string): string {
  return (JSON.parse(out) as { hookSpecificOutput: { additionalContext: string } })
    .hookSpecificOutput.additionalContext;
}

// A lesson that does NOT cover `npm run build` (its glob is docs-only).
const UNCOVERED_GRAPH: LessonsGraph = {
  version: 2,
  lessons: {
    x: {
      rule: 'unrelated',
      topics: ['t'],
      triggers: ['g'],
      evidence: [],
      status: 'active',
      createdAt: '2026-06-05',
    },
  },
  topics: { t: { summary: 'T.' } },
  triggers: { g: { kind: 'file_glob', pattern: 'docs/**' } },
};

describe('Slice 3 — recurrence-driven advisory capture (STORE)', () => {
  it('escalates on the 2nd uncovered failure of the same action, pre-filling the trigger + error', async () => {
    saveLessonsGraph(root, UNCOVERED_GRAPH);
    const fail = JSON.stringify({
      session_id: 'sess-rec',
      hook_event_name: 'PostToolUseFailure',
      tool_input: { command: 'npm run build' },
      tool_error: 'TypeError: cannot read prop x',
    });

    const first = ctx((await buildRecallHookOutput(fail, root)).output);
    expect(first).toContain('just failed'); // generic tier on the 1st failure
    expect(first).not.toContain('has failed 2×');

    const second = ctx((await buildRecallHookOutput(fail, root)).output);
    expect(second).toContain('has failed 2×');
    expect(second).toContain('no lesson covers it');
    expect(second).toContain('--trigger-cmd');
    expect(second.toLowerCase()).toContain('typeerror'); // error class surfaced
    sessions.push('sess-rec');
  });

  it('does NOT escalate when a lesson already covers the recurring failure', async () => {
    saveLessonsGraph(root, {
      version: 2,
      lessons: {
        b: {
          rule: 'build carefully',
          topics: ['t'],
          triggers: ['c'],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-05',
        },
      },
      topics: { t: { summary: 'T.' } },
      triggers: { c: { kind: 'command_pattern', pattern: 'run build' } },
    });
    const fail = JSON.stringify({
      session_id: 'sess-cov',
      hook_event_name: 'PostToolUseFailure',
      tool_input: { command: 'npm run build' },
      tool_error: 'boom',
    });
    await buildRecallHookOutput(fail, root); // 1st: generic, deduped after
    const second = (await buildRecallHookOutput(fail, root)).output;
    // Covered → recurrence tier never fires; generic tier already used → silent.
    expect(second).toBe('');
    sessions.push('sess-cov');
  });

  it('does NOT record or escalate an action-less failure (no file/command → key "none")', async () => {
    saveLessonsGraph(root, UNCOVERED_GRAPH);
    // A failed Read/Grep/MCP call carries no file_path and no command.
    const fail = JSON.stringify({
      session_id: 'sess-none',
      hook_event_name: 'PostToolUseFailure',
      tool_input: {},
      tool_error: 'boom',
    });
    await buildRecallHookOutput(fail, root);
    await buildRecallHookOutput(fail, root);
    // Nothing is recorded, so no fabricated cross-action recurrence can ever build up.
    expect(readOutcomeLog(root)).toEqual([]);
    sessions.push('sess-none');
  });

  it('treats a recurring FILE failure as covered when a file_glob lesson matches it', async () => {
    saveLessonsGraph(root, {
      version: 2,
      lessons: {
        f: {
          rule: 'edit src carefully',
          topics: ['t'],
          triggers: ['g'],
          evidence: [],
          status: 'active',
          createdAt: '2026-06-05',
        },
      },
      topics: { t: { summary: 'T.' } },
      triggers: { g: { kind: 'file_glob', pattern: 'src/**' } },
    });
    const fail = JSON.stringify({
      session_id: 'sess-file-cov',
      hook_event_name: 'PostToolUseFailure',
      tool_input: { file_path: 'src/x.ts' },
      tool_error: 'boom',
    });
    await buildRecallHookOutput(fail, root); // 1st: generic, deduped after
    // Covered by the file_glob → recurrence tier never fires; generic already used → silent.
    expect((await buildRecallHookOutput(fail, root)).output).toBe('');
    sessions.push('sess-file-cov');
  });
});

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { saveLessonsGraph } from '../../../src/lessons/graph-store.js';
import { buildRecallHookOutput } from '../../../src/lessons/hook.js';

let root: string;
let counter = 0;
const sessions: string[] = [];
function uniqueSession(): string {
  const id = `hook-${process.pid}-${counter++}`;
  sessions.push(id);
  return id;
}

const graph: LessonsGraph = {
  version: 1,
  lessons: {
    a: { rule: 'Rule A.', topics: ['t'], triggers: ['t-glob'], evidence: [], status: 'active', createdAt: '2026-06-05' },
    b: { rule: 'Rule B.', topics: ['t'], triggers: ['t-glob'], evidence: [], status: 'active', createdAt: '2026-06-05' },
    c: { rule: 'Rule C.', topics: ['t'], triggers: ['t-cmd'], evidence: [], status: 'active', createdAt: '2026-06-05' },
  },
  topics: { t: { summary: 'T.' } },
  triggers: {
    't-glob': { kind: 'file_glob', pattern: 'src/**' },
    't-cmd': { kind: 'command_pattern', pattern: 'vitest' },
  },
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-hook-'));
  saveLessonsGraph(root, graph);
  vi.stubEnv('AGENTSMESH_LESSONS_TELEMETRY', '');
  vi.stubEnv('AGENTSMESH_SESSION_ID', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
  for (const id of sessions.splice(0)) {
    rmSync(join(tmpdir(), 'agentsmesh-lessons-seen', `${id}.json`), { force: true });
  }
});

describe('buildRecallHookOutput', () => {
  it('emits nothing on invalid JSON', async () => {
    expect((await buildRecallHookOutput('not json {', root)).output).toBe('');
  });

  it('emits nothing when the payload carries no file or command', async () => {
    expect((await buildRecallHookOutput(JSON.stringify({ tool_input: {} }), root)).output).toBe('');
    expect((await buildRecallHookOutput(JSON.stringify({}), root)).output).toBe('');
  });

  it('injects matching lessons as PostToolUse additionalContext for a file edit', async () => {
    const raw = JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: 'src/x.ts' } });
    const parsed = JSON.parse((await buildRecallHookOutput(raw, root)).output) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('Rule A.');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('Rule B.');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('src/x.ts');
  });

  it('recalls against a command for a Bash tool call', async () => {
    const raw = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npx vitest run' } });
    const out = (await buildRecallHookOutput(raw, root)).output;
    expect(out).toContain('Rule C.');
  });

  it('emits nothing when no lessons match', async () => {
    const raw = JSON.stringify({ tool_input: { file_path: 'docs/unmatched.py' } });
    expect((await buildRecallHookOutput(raw, root)).output).toBe('');
  });

  it('dedups by session_id — a lesson is injected at most once per session', async () => {
    const raw = JSON.stringify({ session_id: uniqueSession(), tool_input: { file_path: 'src/x.ts' } });
    expect((await buildRecallHookOutput(raw, root)).output).not.toBe('');
    // Second identical PostToolUse in the same session: everything already shown.
    expect((await buildRecallHookOutput(raw, root)).output).toBe('');
  });
});

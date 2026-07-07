import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LessonsGraph } from '../../../src/lessons/graph-schema.js';
import { saveLessonsGraph } from '../../../src/lessons/graph-store.js';
import { buildRecallHookOutput } from '../../../src/lessons/hook.js';
import { HOOK_INJECT_LIMIT } from '../../../src/lessons/hook-emit.js';

let root: string;
const sessions: string[] = [];
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-hook-s2-'));
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

function ctx(out: string): string {
  return (JSON.parse(out) as { hookSpecificOutput: { additionalContext: string } })
    .hookSpecificOutput.additionalContext;
}

describe('Slice 2 — diff-aware recall binds on the change, not just the path', () => {
  const graph: LessonsGraph = {
    version: 2,
    lessons: {
      kw: {
        rule: 'Guard against redos in matchers.',
        topics: ['t'],
        triggers: ['t-kw'],
        evidence: [],
        status: 'active',
        createdAt: '2026-06-05',
      },
    },
    topics: { t: { summary: 'T.' } },
    triggers: { 't-kw': { kind: 'keyword', pattern: 'redos' } },
  };

  it('fires a keyword lesson on the edit CONTENT even when the path never names it', async () => {
    saveLessonsGraph(root, graph);
    const raw = JSON.stringify({
      tool_input: { file_path: 'src/x.ts', new_string: 'fix the redos backtracking' },
    });
    expect(ctx((await buildRecallHookOutput(raw, root)).output)).toContain(
      'Guard against redos in matchers.',
    );
  });

  it('stays silent when neither the path nor the content names the concept', async () => {
    saveLessonsGraph(root, graph);
    const raw = JSON.stringify({
      tool_input: { file_path: 'src/x.ts', new_string: 'just a normal edit' },
    });
    expect((await buildRecallHookOutput(raw, root)).output).toBe('');
  });

  it('reads content from the Write and MultiEdit shapes as well', async () => {
    saveLessonsGraph(root, graph);
    const write = JSON.stringify({
      tool_input: { file_path: 'src/x.ts', content: 'a redos-safe regex' },
    });
    expect(ctx((await buildRecallHookOutput(write, root)).output)).toContain('Guard against redos');
    const multi = JSON.stringify({
      tool_input: { file_path: 'src/x.ts', edits: [{ new_string: 'audit redos paths' }] },
    });
    expect(ctx((await buildRecallHookOutput(multi, root)).output)).toContain('Guard against redos');
  });
});

describe('Slice 2 — injection confidence cap', () => {
  it(`caps the automatic injection at the ${HOOK_INJECT_LIMIT} strongest matches`, async () => {
    const lessons: LessonsGraph['lessons'] = {};
    for (let i = 0; i < HOOK_INJECT_LIMIT + 3; i += 1) {
      lessons[`l${i}`] = {
        rule: `Rule number ${i}.`,
        topics: ['t'],
        triggers: ['t-glob'],
        evidence: [],
        status: 'active',
        createdAt: '2026-06-05',
      };
    }
    saveLessonsGraph(root, {
      version: 2,
      lessons,
      topics: { t: { summary: 'T.' } },
      triggers: { 't-glob': { kind: 'file_glob', pattern: 'src/**' } },
    });
    const raw = JSON.stringify({ tool_input: { file_path: 'src/x.ts' } });
    const bullets = ctx((await buildRecallHookOutput(raw, root)).output)
      .split('\n')
      .filter((line) => line.startsWith('- '));
    expect(bullets.length).toBe(HOOK_INJECT_LIMIT);
  });

  it('marks only the INJECTED set as seen — capped-out lessons resurface on the next touch', async () => {
    const lessons: LessonsGraph['lessons'] = {};
    for (let i = 0; i < HOOK_INJECT_LIMIT + 3; i += 1) {
      lessons[`l${i}`] = {
        rule: `Rule number ${i}.`,
        topics: ['t'],
        triggers: ['t-glob'],
        evidence: [],
        status: 'active',
        createdAt: '2026-06-05',
      };
    }
    saveLessonsGraph(root, {
      version: 2,
      lessons,
      topics: { t: { summary: 'T.' } },
      triggers: { 't-glob': { kind: 'file_glob', pattern: 'src/**' } },
    });
    const session = `s2-dedup-${process.pid}`;
    sessions.push(session);
    const raw = JSON.stringify({ session_id: session, tool_input: { file_path: 'src/x.ts' } });
    const count = (out: string): number =>
      ctx(out)
        .split('\n')
        .filter((l) => l.startsWith('- ')).length;

    // First touch: the top HOOK_INJECT_LIMIT are injected AND marked seen.
    expect(count((await buildRecallHookOutput(raw, root)).output)).toBe(HOOK_INJECT_LIMIT);
    // Second identical touch: exactly the 3 that were capped out (never shown, so never
    // marked seen) resurface — NOT empty, proving seen-set == injected-set.
    const second = ctx((await buildRecallHookOutput(raw, root)).output);
    expect(second.split('\n').filter((l) => l.startsWith('- ')).length).toBe(3);
    expect(second).toContain('Rule number 7.');
  });
});

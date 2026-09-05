import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runLessons } from '../../../src/cli/commands/lessons.js';
import { graphFilePath, saveLessonsGraph } from '../../../src/lessons/graph-store.js';

interface RawGraph {
  lessons: Record<string, unknown>;
  triggers: Record<string, unknown>;
}

let root: string;
let first: string;
let second: string;
let firstTrigger: string;
let firstTriggers: string[];

async function graph(): Promise<RawGraph> {
  return JSON.parse(await readFile(graphFilePath(root), 'utf8')) as RawGraph;
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'am-'));
  saveLessonsGraph(root, {
    version: 1,
    lessons: {},
    topics: { t: { summary: 'T.' } },
    triggers: {},
  });
  await runLessons(
    { topic: 't', 'trigger-file': ['src/**', 'lib/**'] },
    ['add', 'Always run the linter first.'],
    root,
  );
  const afterFirst = await graph();
  first = Object.keys(afterFirst.lessons)[0]!;
  firstTriggers = Object.keys(afterFirst.triggers);
  firstTrigger = firstTriggers[0]!;
  await runLessons(
    { topic: 't', 'trigger-file': 'docs/**' },
    ['add', 'Keep the docs in sync.'],
    root,
  );
  second = Object.keys((await graph()).lessons).find((id) => id !== first)!;
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('lessons untrigger', () => {
  it('needs both ids', async () => {
    const r = await runLessons({}, ['untrigger', first], root);
    expect(r.exitCode).toBe(2);
    expect(r.error).toContain('Usage: agentsmesh lessons untrigger');
  });

  it('detaches one of two triggers and drops the orphaned trigger node', async () => {
    const r = await runLessons({}, ['untrigger', first, firstTrigger], root);
    expect(r.exitCode).toBe(0);
    expect(r.data).toMatchObject({ removedTriggerNode: true, remainingTriggerCount: 1 });
    expect((await graph()).triggers).not.toHaveProperty(firstTrigger);
  });

  it('refuses to strip the only trigger of an active lesson', async () => {
    const secondTrigger = Object.keys((await graph()).triggers).find(
      (id) => !firstTriggers.includes(id),
    )!;
    const r = await runLessons({}, ['untrigger', second, secondTrigger], root);
    expect(r.exitCode).toBe(1);
    expect(r.error).toMatch(/only trigger/i);
  });

  it('reports an unknown trigger as a domain error', async () => {
    const r = await runLessons({}, ['untrigger', first, 't-nope'], root);
    expect(r.exitCode).toBe(1);
    expect(r.error).toBeTruthy();
  });
});

describe('lessons merge', () => {
  it('needs both ids', async () => {
    const r = await runLessons({}, ['merge', first], root);
    expect(r.exitCode).toBe(2);
    expect(r.error).toContain('Usage: agentsmesh lessons merge');
  });

  it('folds the loser into the keeper', async () => {
    const r = await runLessons({}, ['merge', second, first], root);
    expect(r.exitCode).toBe(0);
    expect(Object.keys((await graph()).lessons)).toContain(first);
  });

  it('reports an unknown lesson as a domain error', async () => {
    const r = await runLessons({}, ['merge', 'nope', first], root);
    expect(r.exitCode).toBe(1);
  });
});

describe('lessons strip-markers', () => {
  it('previews with --dry-run and applies without it', async () => {
    const dry = await runLessons({ 'dry-run': true }, ['strip-markers'], root);
    expect(dry.exitCode).toBe(0);
    expect(dry.data).toMatchObject({ dryRun: true, changedCount: 0 });
    const real = await runLessons({}, ['strip-markers'], root);
    expect(real.exitCode).toBe(0);
    expect(real.data).toMatchObject({ dryRun: false });
  });
});

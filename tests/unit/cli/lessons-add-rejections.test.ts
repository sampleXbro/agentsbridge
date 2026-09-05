import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runLessons } from '../../../src/cli/commands/lessons.js';
import { graphFilePath, saveLessonsGraph } from '../../../src/lessons/graph-store.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'am-'));
  saveLessonsGraph(root, {
    version: 1,
    lessons: {},
    topics: { t: { summary: 'T.' } },
    triggers: {},
  });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('lessons add — capture rejections exit 2 with the add hint; the graph is untouched', () => {
  it('rejects a whitespace-only rule as a missing rule (not an internal write-barrier error)', async () => {
    const before = await readFile(graphFilePath(root), 'utf8');
    const r = await runLessons({ topic: 't', 'trigger-file': 'src/**' }, ['add', '   '], root);
    expect(r.exitCode).toBe(2);
    expect(r.error).toMatch(/rule must not be empty/i);
    expect(r.error).not.toMatch(/refusing to write/i);
    expect(r.error).toContain('Example:');
    expect(await readFile(graphFilePath(root), 'utf8')).toBe(before);
  });

  it.each(['.*', ' '])('rejects the over-broad --trigger-cmd %j', async (pattern) => {
    const before = await readFile(graphFilePath(root), 'utf8');
    const r = await runLessons(
      { topic: 't', 'trigger-cmd': pattern },
      ['add', 'Never run the thing without a lock.'],
      root,
    );
    expect(r.exitCode).toBe(2);
    expect(r.error).toMatch(/nearly every command/i);
    expect(r.error).toContain('Example:');
    expect(await readFile(graphFilePath(root), 'utf8')).toBe(before);
  });
});

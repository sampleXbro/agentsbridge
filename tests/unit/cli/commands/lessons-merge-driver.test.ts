import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { doMergeDriver } from '../../../../src/cli/commands/lessons-merge-driver-handler.js';
import type { Lesson, LessonsGraph } from '../../../../src/lessons/graph-schema.js';

let dir: string;
let base: string;
let ours: string;
let theirs: string;

const graph = (over: Partial<LessonsGraph> = {}): LessonsGraph => ({
  version: 1,
  lessons: {},
  topics: { t: { summary: 'T.' } },
  triggers: {},
  ...over,
});
const lesson = (rule: string): Lesson => ({
  rule,
  topics: ['t'],
  triggers: [],
  evidence: [],
  status: 'active',
  createdAt: '2026-06-01',
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'amesh-mergedriver-'));
  base = join(dir, 'base.json');
  ours = join(dir, 'ours.json');
  theirs = join(dir, 'theirs.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('doMergeDriver', () => {
  it('three-way unions the files, writes the result to ours, exit 0', () => {
    writeFileSync(base, JSON.stringify(graph()));
    writeFileSync(ours, JSON.stringify(graph({ lessons: { a: lesson('A.') } })));
    writeFileSync(theirs, JSON.stringify(graph({ lessons: { c: lesson('C.') } })));

    const r = doMergeDriver([base, ours, theirs]);
    expect(r.exitCode).toBe(0);
    const merged = JSON.parse(readFileSync(ours, 'utf8')) as LessonsGraph;
    expect(Object.keys(merged.lessons).sort()).toEqual(['a', 'c']);
    // Written through the canonical serializer (trailing newline, sorted keys).
    expect(readFileSync(ours, 'utf8').endsWith('}\n')).toBe(true);
  });

  it('exits 1 and leaves ours untouched when a side is unparseable (git falls back)', () => {
    writeFileSync(base, JSON.stringify(graph()));
    writeFileSync(ours, '<<<<<<< HEAD not json');
    writeFileSync(theirs, JSON.stringify(graph()));
    const before = readFileSync(ours, 'utf8');

    const r = doMergeDriver([base, ours, theirs]);
    expect(r.exitCode).toBe(1);
    expect(readFileSync(ours, 'utf8')).toBe(before);
  });

  it('exits 1 when a side is valid JSON but fails the graph schema', () => {
    writeFileSync(base, JSON.stringify(graph()));
    writeFileSync(ours, JSON.stringify({ version: 1, lessons: 'not-an-object' }));
    writeFileSync(theirs, JSON.stringify(graph()));
    const before = readFileSync(ours, 'utf8');
    const r = doMergeDriver([base, ours, theirs]);
    expect(r.exitCode).toBe(1);
    expect(readFileSync(ours, 'utf8')).toBe(before);
  });

  it('exits 1 on missing arguments', () => {
    expect(doMergeDriver([]).exitCode).toBe(1);
  });
});

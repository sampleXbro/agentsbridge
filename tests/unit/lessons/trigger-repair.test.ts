import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddLessonInput } from '../../../src/lessons/add.js';
import { captureLesson } from '../../../src/lessons/capture.js';
import { graphFilePath, loadLessonsGraph } from '../../../src/lessons/graph-store.js';
import { isTriggerRepairEnabled, repairTriggers } from '../../../src/lessons/trigger-repair.js';

const input = (
  triggers: AddLessonInput['triggers'],
  evidence?: readonly string[],
): AddLessonInput => ({
  rule: 'test rule',
  topic: 't',
  triggers,
  ...(evidence !== undefined ? { evidence } : {}),
});

const PATHS = new Set(['src/lessons/recall.ts', 'src/lessons/add.ts', 'docs/x.md']);

describe('repairTriggers — file globs', () => {
  it('narrows a broad glob toward the evidence file class', () => {
    const { input: out, repairs } = repairTriggers(
      input({ files: ['src/**'] }, ['src/lessons/recall.ts:138']),
      PATHS,
    );
    expect(out.triggers.files).toEqual(['src/lessons/*.ts']);
    expect(repairs.map((r) => r.code)).toEqual(['NARROWED_GLOB']);
  });

  it('keeps a broad glob when no evidence entry is a working-tree path', () => {
    const { input: out, repairs } = repairTriggers(
      input({ files: ['src/**'] }, ['commit:abc123']),
      PATHS,
    );
    expect(out.triggers.files).toEqual(['src/**']);
    expect(repairs).toEqual([]);
  });

  it('keeps a broad glob when knownPaths is unavailable', () => {
    const { input: out, repairs } = repairTriggers(
      input({ files: ['src/**'] }, ['src/lessons/recall.ts']),
      undefined,
    );
    expect(out.triggers.files).toEqual(['src/**']);
    expect(repairs).toEqual([]);
  });

  it('keeps a broad glob that does not cover the evidence path (outside author intent)', () => {
    const { input: out, repairs } = repairTriggers(
      input({ files: ['tests/**/*.ts'] }, ['src/lessons/recall.ts']),
      PATHS,
    );
    expect(out.triggers.files).toEqual(['tests/**/*.ts']);
    expect(repairs).toEqual([]);
  });

  it('narrows a wide-matching (not structurally broad) glob', () => {
    const wide = new Set(
      Array.from({ length: 45 }, (_, i) => `src/mod${i}/helpers.ts`).concat(['src/mod1/other.ts']),
    );
    const { input: out, repairs } = repairTriggers(
      input({ files: ['src/**/helpers.ts'] }, ['src/mod1/helpers.ts']),
      wide,
    );
    expect(out.triggers.files).toEqual(['src/mod1/*.ts']);
    expect(repairs.map((r) => r.code)).toEqual(['NARROWED_GLOB']);
  });

  it('leaves a precise glob untouched', () => {
    const { input: out, repairs } = repairTriggers(
      input({ files: ['src/lessons/*.ts'] }, ['src/lessons/recall.ts']),
      PATHS,
    );
    expect(out.triggers.files).toEqual(['src/lessons/*.ts']);
    expect(repairs).toEqual([]);
  });

  it('does not "narrow" a wide glob that already equals its evidence directory class', () => {
    // >WIDE_GLOB_MATCH_COUNT files in src/lessons make the class glob "wide", but it
    // is ALSO the glob the author already wrote — narrowing X→X is a no-op and must
    // not emit a self-referential NARROWED_GLOB warning.
    const wide = new Set(
      Array.from({ length: 45 }, (_, i) => `src/lessons/f${i}.ts`).concat([
        'src/lessons/recall.ts',
      ]),
    );
    const { input: out, repairs } = repairTriggers(
      input({ files: ['src/lessons/*.ts'] }, ['src/lessons/recall.ts']),
      wide,
    );
    expect(out.triggers.files).toEqual(['src/lessons/*.ts']);
    expect(repairs).toEqual([]);
  });

  it('keeps the original when the derived class would match MORE files than the original', () => {
    // `**/x.ts` is wide (>40 files named x.ts) but not structurally broad; its
    // evidence-class `src/*.ts` matches even more files, so narrowing would WIDEN
    // coverage — rejected, original kept, no warning.
    const paths = new Set<string>(['src/x.ts']);
    for (let i = 0; i < 41; i += 1) paths.add(`mod${i}/x.ts`); // 42 match **/x.ts
    for (let i = 0; i < 50; i += 1) paths.add(`src/f${i}.ts`); // 51 match src/*.ts
    const { input: out, repairs } = repairTriggers(
      input({ files: ['**/x.ts'] }, ['src/x.ts']),
      paths,
    );
    expect(out.triggers.files).toEqual(['**/x.ts']);
    expect(repairs).toEqual([]);
  });

  it('strips a :line suffix and backslashes from the evidence path', () => {
    const { input: out } = repairTriggers(
      input({ files: ['src/**'] }, ['src\\lessons\\recall.ts:12:5']),
      PATHS,
    );
    expect(out.triggers.files).toEqual(['src/lessons/*.ts']);
  });
});

describe('repairTriggers — keywords', () => {
  it('adds a stopword-stripped variant beside a stopworded phrase', () => {
    const { input: out, repairs } = repairTriggers(
      input({ keywords: ['state of the art'] }),
      PATHS,
    );
    expect(out.triggers.keywords).toEqual(['state of the art', 'state art']);
    expect(repairs.map((r) => r.code)).toEqual(['KEYWORD_VARIANT_ADDED']);
  });

  it('adds a truncated variant beside an over-long keyword', () => {
    const long = 'always rerun full suite twice after every windows failure';
    const { input: out, repairs } = repairTriggers(input({ keywords: [long] }), PATHS);
    expect(out.triggers.keywords).toEqual([long, 'always rerun full suite twice']);
    expect(repairs.map((r) => r.code)).toEqual(['KEYWORD_VARIANT_ADDED']);
  });

  it('drops a keyword that tokenizes to nothing', () => {
    const { input: out, repairs } = repairTriggers(
      input({ keywords: ['to the', 'link rebase'] }),
      PATHS,
    );
    expect(out.triggers.keywords).toEqual(['link rebase']);
    expect(repairs.map((r) => r.code)).toEqual(['DROPPED_KEYWORD']);
  });

  it('leaves a short clean keyword untouched', () => {
    const { input: out, repairs } = repairTriggers(input({ keywords: ['link rebase'] }), PATHS);
    expect(out.triggers.keywords).toEqual(['link rebase']);
    expect(repairs).toEqual([]);
  });

  it('returns the original input when repair would drop every trigger', () => {
    const original = input({ keywords: ['to the'] });
    const { input: out, repairs } = repairTriggers(original, PATHS);
    expect(out).toBe(original);
    expect(repairs).toEqual([]);
  });
});

describe('isTriggerRepairEnabled + captureLesson wiring', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'amesh-trigger-repair-'));
    const p = graphFilePath(root);
    mkdirSync(dirname(p), { recursive: true });
    mkdirSync(join(root, 'src', 'lessons'), { recursive: true });
    writeFileSync(join(root, 'src', 'lessons', 'recall.ts'), '// x\n', 'utf8');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const enable = (): void => {
    writeFileSync(
      join(root, '.agentsmesh', 'lessons', 'config.json'),
      JSON.stringify({ repairTriggers: true }),
      'utf8',
    );
  };

  it('is off by default and on with config repairTriggers:true', () => {
    expect(isTriggerRepairEnabled(root)).toBe(false);
    enable();
    expect(isTriggerRepairEnabled(root)).toBe(true);
  });

  it('captureLesson narrows a broad glob and surfaces the repair as a warning', async () => {
    enable();
    const result = await captureLesson(
      root,
      input({ files: ['src/**'] }, ['src/lessons/recall.ts:10']),
      { allowNewTopic: true, topicSummary: 'test topic' },
    );
    expect(result.warnings.map((w) => w.code)).toContain('NARROWED_GLOB');
    const graph = loadLessonsGraph(root);
    const patterns = Object.values(graph.triggers).map((t) => t.pattern);
    expect(patterns).toEqual(['src/lessons/*.ts']);
  });

  it('captureLesson keeps the broad glob (warn-only) when repair is disabled', async () => {
    const result = await captureLesson(
      root,
      input({ files: ['src/**'] }, ['src/lessons/recall.ts:10']),
      { allowNewTopic: true, topicSummary: 'test topic' },
    );
    expect(result.warnings.map((w) => w.code)).toContain('BROAD_GLOB_TRIGGER');
    const graph = loadLessonsGraph(root);
    expect(Object.values(graph.triggers).map((t) => t.pattern)).toEqual(['src/**']);
  });
});

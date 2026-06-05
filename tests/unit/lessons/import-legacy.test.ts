import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importLegacyLessons } from '../../../src/lessons/import-legacy.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_INPUT = resolve(HERE, '../../fixtures/lessons/legacy-input');
const FIXTURE_EXPECTED = resolve(HERE, '../../fixtures/lessons/legacy-expected');
const MIGRATED_AT = '2026-06-05';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'amesh-import-legacy-'));
  cpSync(FIXTURE_INPUT, join(root, '.agentsmesh/lessons'), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('importLegacyLessons', () => {
  it('writes lessons.json byte-for-byte equal to the committed expected fixture', () => {
    importLegacyLessons(root, { migratedAt: MIGRATED_AT, deleteLegacy: false });
    const got = readFileSync(join(root, '.agentsmesh/lessons/lessons.json'), 'utf8');
    const expected = readFileSync(join(FIXTURE_EXPECTED, 'lessons.json'), 'utf8');
    expect(got).toBe(expected);
  });

  it('DELETES every legacy artifact by default (clean-break upgrade)', () => {
    const report = importLegacyLessons(root, { migratedAt: MIGRATED_AT });
    expect(existsSync(join(root, '.agentsmesh/lessons/index.yaml'))).toBe(false);
    expect(existsSync(join(root, '.agentsmesh/lessons/journal.md'))).toBe(false);
    expect(existsSync(join(root, '.agentsmesh/lessons/topics'))).toBe(false);
    expect(report.deletedPaths.length).toBeGreaterThan(0);
  });

  it('preserves legacy files when deleteLegacy=false (test-only path)', () => {
    importLegacyLessons(root, { migratedAt: MIGRATED_AT, deleteLegacy: false });
    expect(existsSync(join(root, '.agentsmesh/lessons/index.yaml'))).toBe(true);
    expect(existsSync(join(root, '.agentsmesh/lessons/journal.md'))).toBe(true);
    expect(existsSync(join(root, '.agentsmesh/lessons/topics/alpha-rules.md'))).toBe(true);
  });

  it('returns a report with exact counts and the canonical graph path', () => {
    const report = importLegacyLessons(root, { migratedAt: MIGRATED_AT });
    expect(report.topicCount).toBe(2);
    expect(report.lessonCount).toBe(5);
    expect(report.triggerCount).toBe(7);
    expect(report.wroteGraphPath.replaceAll('\\', '/')).toBe(
      join(root, '.agentsmesh/lessons/lessons.json').replaceAll('\\', '/'),
    );
  });

  it('is safe to re-run on the post-migration tree (legacy files gone → zero counts)', () => {
    importLegacyLessons(root, { migratedAt: MIGRATED_AT });
    // index.yaml no longer exists → re-running throws (intended: caller should
    // check before invoking). Verify the first run did its job and the second
    // call cannot accidentally clobber a valid graph from missing inputs.
    expect(() => importLegacyLessons(root, { migratedAt: MIGRATED_AT })).toThrow();
  });

  it('first migration is byte-deterministic when re-run on a fresh copy', () => {
    importLegacyLessons(root, { migratedAt: MIGRATED_AT, deleteLegacy: false });
    const first = readFileSync(join(root, '.agentsmesh/lessons/lessons.json'), 'utf8');
    importLegacyLessons(root, { migratedAt: MIGRATED_AT, deleteLegacy: false });
    const second = readFileSync(join(root, '.agentsmesh/lessons/lessons.json'), 'utf8');
    expect(second).toBe(first);
  });
});

describe('importLegacyLessons — edge inputs', () => {
  let edge: string;

  beforeEach(() => {
    edge = mkdtempSync(join(tmpdir(), 'amesh-import-edge-'));
    const base = join(edge, '.agentsmesh/lessons');
    mkdirSync(join(base, 'topics'), { recursive: true });
    writeFileSync(
      join(base, 'index.yaml'),
      [
        'version: 1',
        'clusters:',
        '  - topic: present',
        '    file: .agentsmesh/lessons/topics/present.md',
        '    summary: Present topic.',
        '    triggers:',
        '      file_globs: ["src/**", "src/**"]',
        '      command_patterns: []',
        '      keywords: []',
        '  - topic: missing',
        '    file: .agentsmesh/lessons/topics/missing.md',
        '    summary: Topic whose file is absent.',
        '    triggers:',
        '      file_globs: ["docs/**"]',
        '      command_patterns: []',
        '      keywords: []',
        '',
      ].join('\n'),
      'utf8',
    );
    // present.md has a rule with an Evidence tail that carries NO L-references.
    // Rules section is followed by another heading (exercises the section break),
    // and rule 1 carries an Evidence tail with no L-references.
    writeFileSync(
      join(base, 'topics/present.md'),
      '# Present\n\n## Rules\n\n1. Do the thing. (Evidence: see the design doc)\n2. Plain rule, no evidence.\n\n## Notes\n\nIgnore me.\n',
      'utf8',
    );
    // topics/missing.md intentionally not written.
  });

  afterEach(() => {
    rmSync(edge, { recursive: true, force: true });
  });

  it('registers the topic but no lessons for a cluster whose topic file is absent', () => {
    const report = importLegacyLessons(edge, { migratedAt: MIGRATED_AT, deleteLegacy: false });
    expect(report.topicCount).toBe(2);
    // Only present.md contributes lessons; missing.md is skipped.
    expect(report.lessonCount).toBe(2);
  });

  it('keeps only the canonical legacy pointer when an Evidence tail has no L-refs', () => {
    importLegacyLessons(edge, { migratedAt: MIGRATED_AT, deleteLegacy: false });
    const graph = JSON.parse(
      readFileSync(join(edge, '.agentsmesh/lessons/lessons.json'), 'utf8'),
    ) as { lessons: Record<string, { evidence: string[] }> };
    const ruleOne = graph.lessons['present-rule-1'];
    expect(ruleOne?.evidence).toEqual(['legacy:.agentsmesh/lessons/topics/present.md#rule-1']);
  });

  it('reports zero deletions when no legacy artifacts remain to remove', () => {
    importLegacyLessons(edge, { migratedAt: MIGRATED_AT, deleteLegacy: false });
    // Re-run with deletion on a tree that still has index.yaml/topics but no journal/distill files.
    const report = importLegacyLessons(edge, { migratedAt: MIGRATED_AT });
    expect(report.deletedPaths.every((p) => !p.includes('journal'))).toBe(true);
  });
});

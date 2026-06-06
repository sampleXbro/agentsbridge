import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LessonsGraph } from '../../src/lessons/graph-schema.js';
import { loadLessonsGraph } from '../../src/lessons/graph-store.js';
import { importLegacyLessons } from '../../src/lessons/import-legacy.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_INPUT = resolve(HERE, '../fixtures/lessons/legacy-input');

const LegacyIndexSchema = z.object({
  version: z.literal(1),
  clusters: z.array(
    z.object({
      topic: z.string(),
      file: z.string(),
      summary: z.string(),
      triggers: z.object({
        file_globs: z.array(z.string()),
        command_patterns: z.array(z.string()),
        keywords: z.array(z.string()),
      }),
    }),
  ),
});

function parseIndex(raw: unknown): z.infer<typeof LegacyIndexSchema> {
  return LegacyIndexSchema.parse(raw);
}

let projectRoot: string;
let graph: LessonsGraph;
let liveLessons: string;

beforeEach(async () => {
  projectRoot = mkdtempSync(join(tmpdir(), 'amesh-import-real-'));
  liveLessons = join(projectRoot, '.agentsmesh/lessons');
  // Mirror a realistic legacy tree (the committed fixture is small but
  // representative — same kind of edge cases as live data).
  cpSync(FIXTURE_INPUT, liveLessons, { recursive: true });
  await importLegacyLessons(projectRoot, { migratedAt: '2026-06-05', deleteLegacy: false });
  graph = loadLessonsGraph(projectRoot);
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
});

describe('importLegacyLessons end-to-end against a representative legacy tree', () => {
  it('topic count equals the cluster count in the source index.yaml', () => {
    const liveIndex = parseIndex(
      parseYaml(readFileSync(join(liveLessons, 'index.yaml'), 'utf8')) as unknown,
    );
    expect(Object.keys(graph.topics).length).toBe(liveIndex.clusters.length);
    for (const cluster of liveIndex.clusters) {
      expect(graph.topics[cluster.topic]?.summary).toBe(cluster.summary);
    }
  });

  it('every cluster trigger pattern appears verbatim in graph.triggers', () => {
    const liveIndex = parseIndex(
      parseYaml(readFileSync(join(liveLessons, 'index.yaml'), 'utf8')) as unknown,
    );
    const allPatterns = new Set<string>();
    for (const cluster of liveIndex.clusters) {
      cluster.triggers.file_globs.forEach((p) => allPatterns.add(`file_glob|${p}`));
      cluster.triggers.command_patterns.forEach((p) => allPatterns.add(`command_pattern|${p}`));
      cluster.triggers.keywords.forEach((p) => allPatterns.add(`keyword|${p}`));
    }
    const graphPatterns = new Set(
      Object.values(graph.triggers).map((t) => `${t.kind}|${t.pattern}`),
    );
    expect(graphPatterns).toEqual(allPatterns);
  });

  it('lesson count equals the sum of numbered bullets across every topic file', () => {
    const liveIndex = parseIndex(
      parseYaml(readFileSync(join(liveLessons, 'index.yaml'), 'utf8')) as unknown,
    );
    let totalBullets = 0;
    for (const cluster of liveIndex.clusters) {
      const md = readFileSync(join(projectRoot, cluster.file), 'utf8');
      totalBullets += countRuleBullets(md);
    }
    expect(Object.keys(graph.lessons).length).toBe(totalBullets);
  });

  it('every lesson points to its source topic via the topics array', () => {
    for (const [id, lesson] of Object.entries(graph.lessons)) {
      expect(lesson.topics.length).toBeGreaterThan(0);
      const topicId = lesson.topics[0];
      expect(graph.topics[topicId ?? '']).toBeDefined();
      expect(id.startsWith(`${topicId}-rule-`)).toBe(true);
    }
  });

  it('every lesson trigger reference resolves in graph.triggers', () => {
    for (const lesson of Object.values(graph.lessons)) {
      for (const triggerId of lesson.triggers) {
        expect(graph.triggers[triggerId]).toBeDefined();
      }
    }
  });

  it('every lesson has the canonical legacy-source evidence pointer first', () => {
    for (const [id, lesson] of Object.entries(graph.lessons)) {
      const first = lesson.evidence[0];
      expect(first).toBeDefined();
      expect(first?.startsWith('legacy:.agentsmesh/lessons/topics/')).toBe(true);
      expect(first?.endsWith(`#rule-${id.split('-rule-')[1] ?? ''}`)).toBe(true);
    }
  });

  it('produces no stray topic files beyond those listed in the index', () => {
    const indexTopics = new Set(Object.keys(graph.topics));
    const onDisk = readdirSync(join(liveLessons, 'topics'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''));
    expect(new Set(onDisk)).toEqual(indexTopics);
  });
});

function countRuleBullets(markdown: string): number {
  const lines = markdown.split(/\r?\n/);
  let inRules = false;
  let count = 0;
  for (const line of lines) {
    if (!inRules) {
      if (/^##\s+Rules\b/i.test(line)) inRules = true;
      continue;
    }
    if (/^##\s+/.test(line)) break;
    if (/^\d+\.\s+\S/.test(line)) count += 1;
  }
  return count;
}

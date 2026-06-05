import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { saveLessonsGraph } from './graph-store.js';
import type { LessonsGraph } from './graph-schema.js';
import { lessonsPaths } from './paths.js';
import {
  appendLessonsParagraph,
  LESSONS_PARAGRAPH_BLOCK,
} from '../targets/projection/lessons-paragraph.js';

export interface ScaffoldLessonsResult {
  readonly created: string[];
  readonly skipped: string[];
  readonly rootRuleUpdated: boolean;
}

/**
 * Idempotent scaffolder for the lessons subsystem. Backs `agentsmesh init
 * --lessons`, the lessons-only retrofit, and the import safety net.
 *
 * - Creates `.agentsmesh/lessons/lessons.json` (an empty graph) if missing.
 * - Injects the lessons ritual into `.agentsmesh/rules/_root.md` as a managed
 *   block (`<!-- agentsmesh:lessons-contract:start -->` … `:end -->`). The
 *   block is canonical content so it reaches every target — including
 *   rules-directory targets the generation-contract decorator skips — while
 *   the sentinels keep the block an identifiable unit for clean round-trip and
 *   let re-running scaffold refresh the wording from one constant.
 */
export function scaffoldLessons(projectRoot: string): ScaffoldLessonsResult {
  const paths = lessonsPaths(projectRoot);
  const created: string[] = [];
  const skipped: string[] = [];

  mkdirSync(paths.base, { recursive: true });
  if (existsSync(paths.graph)) {
    skipped.push(paths.graph);
  } else {
    const emptyGraph: LessonsGraph = { version: 1, lessons: {}, topics: {}, triggers: {} };
    saveLessonsGraph(projectRoot, emptyGraph);
    created.push(paths.graph);
  }

  const rootRuleUpdated = injectProceduralBlock(projectRoot);
  return { created, skipped, rootRuleUpdated };
}

function injectProceduralBlock(projectRoot: string): boolean {
  const rootRule = join(projectRoot, '.agentsmesh/rules/_root.md');
  if (!existsSync(rootRule)) {
    mkdirSync(dirname(rootRule), { recursive: true });
    const seeded = `---\nroot: true\ndescription: ""\n---\n\n# Operational Guidelines\n\n${LESSONS_PARAGRAPH_BLOCK}\n`;
    writeFileSync(rootRule, seeded, 'utf8');
    return true;
  }
  const current = readFileSync(rootRule, 'utf8');
  const desired = `${appendLessonsParagraph(current)}\n`;
  if (desired === current) return false;
  writeFileSync(rootRule, desired, 'utf8');
  return true;
}

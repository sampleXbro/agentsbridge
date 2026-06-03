import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  LESSONS_INDEX_TEMPLATE,
  LESSONS_JOURNAL_TEMPLATE,
  LESSONS_PROCEDURAL_RULE,
  lessonsPaths,
} from './paths.js';

export interface ScaffoldLessonsResult {
  readonly created: string[];
  readonly skipped: string[];
  readonly rootRuleUpdated: boolean;
}

/**
 * Idempotent scaffolder for the lessons subsystem. Intended for a future
 * `agentsmesh init --lessons` flag (project mode); safe to call repeatedly.
 *
 * Creates `.agentsmesh/lessons/` with an empty journal, an empty index, and a
 * `topics/` directory. Appends the procedural rule to
 * `.agentsmesh/rules/_root.md` if not already present.
 *
 * Never overwrites existing files. The ledger and proposal are not created —
 * they are auto-managed by the distill tool on first run.
 */
export function scaffoldLessons(projectRoot: string): ScaffoldLessonsResult {
  const paths = lessonsPaths(projectRoot);
  const created: string[] = [];
  const skipped: string[] = [];

  mkdirSync(paths.topicsDir, { recursive: true });

  for (const [path, template] of [
    [paths.journal, LESSONS_JOURNAL_TEMPLATE],
    [paths.index, LESSONS_INDEX_TEMPLATE],
  ] as const) {
    if (existsSync(path)) {
      skipped.push(path);
    } else {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, template, 'utf8');
      created.push(path);
    }
  }

  const rootRuleUpdated = appendProceduralRule(projectRoot);
  return { created, skipped, rootRuleUpdated };
}

function appendProceduralRule(projectRoot: string): boolean {
  const rootRule = join(projectRoot, '.agentsmesh/rules/_root.md');
  if (!existsSync(rootRule)) {
    mkdirSync(dirname(rootRule), { recursive: true });
    const seeded = `---\nroot: true\ndescription: ""\n---\n\n# Operational Guidelines\n\n${LESSONS_PROCEDURAL_RULE}\n`;
    writeFileSync(rootRule, seeded, 'utf8');
    return true;
  }
  const current = readFileSync(rootRule, 'utf8');
  // Match any '## Lessons (…)' heading — the parenthetical wording may evolve
  // (mandatory / MUST do / etc.) but the H2 itself is the stable idempotency
  // anchor for this paragraph.
  if (/^## Lessons \(/m.test(current)) return false;
  const next = current.endsWith('\n') ? current : `${current}\n`;
  writeFileSync(rootRule, `${next}\n${LESSONS_PROCEDURAL_RULE}\n`, 'utf8');
  return true;
}

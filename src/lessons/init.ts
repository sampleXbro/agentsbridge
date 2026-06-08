import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { maybeAutoMigrateLessons } from './auto-migrate.js';
import { mutateLessonsGraphLocked } from './mutate.js';
import { lessonsPaths } from './paths.js';
import {
  appendLessonsParagraph,
  LESSONS_PARAGRAPH_BLOCK,
} from '../targets/projection/lessons-paragraph.js';
import { LESSONS_SKILL_FILE, LESSONS_SKILL_NAME } from './skill.js';

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
 * - Injects the lessons ritual (Tier 1 — the always-on trigger) into
 *   `.agentsmesh/rules/_root.md` as a managed block
 *   (`<!-- agentsmesh:lessons-contract:start -->` … `:end -->`). The block is
 *   canonical content so it reaches every target — including rules-directory
 *   targets the generation-contract decorator skips — while the sentinels keep
 *   the block an identifiable unit for clean round-trip and let re-running
 *   scaffold refresh the wording from one constant.
 * - Seeds `.agentsmesh/skills/lessons/SKILL.md` (Tier 2 — the on-demand manual)
 *   if missing. Create-if-missing (like the graph): it is canonical, user-owned
 *   content, not a managed block. Targets without skills still get Tier 1.
 */
export async function scaffoldLessons(projectRoot: string): Promise<ScaffoldLessonsResult> {
  const paths = lessonsPaths(projectRoot);
  const created: string[] = [];
  const skipped: string[] = [];

  mkdirSync(paths.base, { recursive: true });
  // Migrate a legacy store before scaffolding so a retrofit does not create an
  // empty graph over still-unmigrated lessons (which would strand them forever).
  await maybeAutoMigrateLessons(projectRoot);
  if (existsSync(paths.graph)) {
    skipped.push(paths.graph);
  } else {
    // Create the empty graph through the transactional path so even the initial
    // write holds the lock and re-reads under it — it cannot clobber a graph a
    // concurrent writer just created.
    await mutateLessonsGraphLocked(projectRoot, () => {});
    created.push(paths.graph);
  }

  seedLessonsSkill(projectRoot, created, skipped);

  const rootRuleUpdated = injectProceduralBlock(projectRoot);
  return { created, skipped, rootRuleUpdated };
}

/**
 * Seed the Tier-2 lessons manual at `.agentsmesh/skills/lessons/SKILL.md`.
 * Create-if-missing: once present it is the user's canonical skill, never
 * clobbered. Records the path in `created` or `skipped` so the renderer reports
 * it alongside the graph.
 */
function seedLessonsSkill(projectRoot: string, created: string[], skipped: string[]): void {
  const skillPath = join(projectRoot, '.agentsmesh/skills', LESSONS_SKILL_NAME, 'SKILL.md');
  if (existsSync(skillPath)) {
    skipped.push(skillPath);
    return;
  }
  mkdirSync(dirname(skillPath), { recursive: true });
  writeFileSync(skillPath, `${LESSONS_SKILL_FILE}\n`, 'utf8');
  created.push(skillPath);
}

function injectProceduralBlock(projectRoot: string): boolean {
  const rootRule = join(projectRoot, '.agentsmesh/rules/_root.md');
  if (!existsSync(rootRule)) {
    mkdirSync(dirname(rootRule), { recursive: true });
    const seeded = `---\nroot: true\ndescription: ""\n---\n\n${LESSONS_PARAGRAPH_BLOCK}\n\n# Operational Guidelines\n`;
    writeFileSync(rootRule, seeded, 'utf8');
    return true;
  }
  const current = readFileSync(rootRule, 'utf8');
  const desired = `${appendLessonsParagraph(current)}\n`;
  if (desired === current) return false;
  writeFileSync(rootRule, desired, 'utf8');
  return true;
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { maybeAutoMigrateLessons } from './auto-migrate.js';
import { mutateLessonsGraphLocked } from './mutate.js';
import { lessonsPaths, toRelPath } from './paths.js';
import { recallLogPath } from './telemetry.js';
import { ensureGitignoreEntries } from '../utils/filesystem/gitignore.js';
import {
  appendLessonsParagraph,
  LESSONS_PARAGRAPH_BLOCK,
} from '../targets/projection/lessons-paragraph.js';
import { LESSONS_SKILL_FILE, LESSONS_SKILL_NAME } from './skill.js';

export interface ScaffoldLessonsResult {
  readonly created: string[];
  /** Managed artifacts rewritten to the current wording (e.g. a stale skill). */
  readonly updated: string[];
  readonly skipped: string[];
  readonly rootRuleUpdated: boolean;
  /** True when the recall-log gitignore entry was added to `.gitignore`. */
  readonly gitignoreUpdated: boolean;
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
 * - Writes `.agentsmesh/skills/lessons/SKILL.md` (Tier 2 — the on-demand manual).
 *   Like the Tier-1 paragraph, this is a MANAGED artifact: every run rewrites it
 *   to the current manual so an upgraded agentsmesh propagates the new wording
 *   (reported as `updated` when it changed, `skipped` when already current).
 *   The graph, by contrast, is user data and stays create-if-missing. Targets
 *   without skills still get Tier 1.
 */
export async function scaffoldLessons(projectRoot: string): Promise<ScaffoldLessonsResult> {
  const paths = lessonsPaths(projectRoot);
  const created: string[] = [];
  const updated: string[] = [];
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

  seedLessonsSkill(projectRoot, created, updated, skipped);

  const rootRuleUpdated = injectProceduralBlock(projectRoot);
  // Keep the opt-in recall telemetry log out of git. The entry is derived from
  // the telemetry module so the path stays single-sourced; the append is
  // idempotent and coverage-aware, so re-running scaffold (init is documented as
  // safe to repeat) and an existing broader `.agentsmesh/` ignore are both no-ops.
  const gitignoreUpdated = await ensureGitignoreEntries(projectRoot, [
    toRelPath(projectRoot, recallLogPath(projectRoot)),
  ]);
  return { created, updated, skipped, rootRuleUpdated, gitignoreUpdated };
}

/**
 * Write the Tier-2 lessons manual at `.agentsmesh/skills/lessons/SKILL.md`.
 * Managed (not user-owned), mirroring the Tier-1 paragraph: every run rewrites
 * it to {@link LESSONS_SKILL_FILE}, so a re-run after an agentsmesh upgrade
 * refreshes a stale manual. Records the path in `created` (new), `updated`
 * (rewritten because it drifted), or `skipped` (already current).
 */
function seedLessonsSkill(
  projectRoot: string,
  created: string[],
  updated: string[],
  skipped: string[],
): void {
  const skillPath = join(projectRoot, '.agentsmesh/skills', LESSONS_SKILL_NAME, 'SKILL.md');
  const desired = `${LESSONS_SKILL_FILE}\n`;
  if (!existsSync(skillPath)) {
    mkdirSync(dirname(skillPath), { recursive: true });
    writeFileSync(skillPath, desired, 'utf8');
    created.push(skillPath);
    return;
  }
  if (readFileSync(skillPath, 'utf8') === desired) {
    skipped.push(skillPath);
    return;
  }
  writeFileSync(skillPath, desired, 'utf8');
  updated.push(skillPath);
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

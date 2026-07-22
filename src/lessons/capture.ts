import {
  addLesson,
  type AddLessonInput,
  type AddLessonOptions,
  type AddLessonResult,
} from './add.js';
import { maybeAutoMigrateLessons } from './auto-migrate.js';
import { maybeAutoPrune } from './auto-prune.js';
import { recordCapture } from './capture-telemetry.js';
import { listProjectFiles } from './project-files.js';
import { isTriggerRepairEnabled, repairTriggers } from './trigger-repair.js';

/**
 * Capture primitive for applications: migrate if needed, then add the lesson
 * through the transactional write path. Idempotent on repeat (same rule+topic).
 * The symmetric counterpart of `recallLessons` (recall.ts), split out for the
 * 200-line limit.
 *
 * Both CLI `lessons add` and MCP `lessons_add` route through here, so capture
 * telemetry is recorded once at this single entry point (mirroring how every
 * recall records through `recallLessons`). Every rejection — a dead trigger, an
 * unknown topic, a write-barrier failure — is recorded as a BLOCKED capture
 * before being rethrown, so `stats` never undercounts blocks.
 */
export async function captureLesson(
  projectRoot: string,
  input: AddLessonInput,
  options: AddLessonOptions = {},
): Promise<AddLessonResult> {
  await maybeAutoMigrateLessons(projectRoot);
  const triggerKinds = {
    file: input.triggers.files?.length ?? 0,
    command: input.triggers.commands?.length ?? 0,
    keyword: input.triggers.keywords?.length ?? 0,
  };
  // Supply the working-tree file list so capture can warn on a dead glob (a typo
  // or stale path) at the best moment to fix it. null (no walk possible) → the
  // DEAD_GLOB check is skipped, never a false positive. Caller-provided
  // knownPaths (e.g. legacy merge) still wins.
  const knownPaths = options.knownPaths ?? listProjectFiles(projectRoot) ?? undefined;
  // Opt-in capture-time trigger repair: narrow broad/wide globs toward the
  // evidence file's class and add matchable keyword variants BEFORE the write,
  // so degraded triggers stop entering the graph (config `repairTriggers`).
  const repair = isTriggerRepairEnabled(projectRoot) ? repairTriggers(input, knownPaths) : null;
  const effective = repair === null ? input : repair.input;
  try {
    const result = await addLesson(projectRoot, effective, { ...options, knownPaths });
    const repaired =
      repair === null || repair.repairs.length === 0
        ? result
        : { ...result, warnings: [...result.warnings, ...repair.repairs] };
    recordCapture(projectRoot, triggerKinds, repaired);
    // Opt-in auto-prune: GC structural cruft right after the graph changed,
    // reusing the working-tree walk we already did. No-op unless config enables
    // it; never throws, so it can't break a successful capture.
    const autoPruned = await maybeAutoPrune(projectRoot, knownPaths);
    return autoPruned === null ? repaired : { ...repaired, autoPruned };
  } catch (err) {
    recordCapture(projectRoot, triggerKinds, null);
    throw err;
  }
}

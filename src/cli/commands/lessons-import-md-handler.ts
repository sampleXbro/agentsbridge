import { existsSync } from 'node:fs';
import { graphFilePath } from '../../lessons/graph-store.js';
import { importLegacyLessons } from '../../lessons/import-legacy.js';
import { lessonsPaths } from '../../lessons/paths.js';
import { errorResult, stringFlag, todayIso, type LessonsFlags } from './lessons-helpers.js';
import type { LessonsCommandResult, LessonsImportMdData } from './lessons-types.js';

/**
 * One-shot migrator from the legacy `index.yaml` + `topics/*.md` + `journal.md`
 * store into the JSON graph. Split into its own module so the write-handler file
 * stays focused (and under the repository's 200-line ceiling).
 */
export async function doImportMd(
  flags: LessonsFlags,
  projectRoot: string,
): Promise<LessonsCommandResult> {
  const force = flags.force === true;
  const merge = flags.merge === true;
  if (!force && !merge && existsSync(graphFilePath(projectRoot))) {
    return errorResult(
      'import-md',
      'lessons.json already exists. Pass --merge to fold legacy lessons into it (recommended — recovers stranded lessons without data loss), or --force to overwrite.',
      1,
    );
  }
  // Guard the legacy read: importLegacyLessons reads index.yaml unconditionally
  // and throws a raw ENOENT when it is absent. Fail with a clean message instead.
  if (!existsSync(lessonsPaths(projectRoot).index)) {
    return errorResult(
      'import-md',
      'No legacy lessons store found (.agentsmesh/lessons/index.yaml) — nothing to migrate.',
      1,
    );
  }
  const migratedAt = stringFlag(flags, 'migrated-at') ?? todayIso();
  const report = await importLegacyLessons(projectRoot, { migratedAt, force, merge });
  const data: LessonsImportMdData = {
    topicCount: report.topicCount,
    lessonCount: report.lessonCount,
    triggerCount: report.triggerCount,
    wroteGraphPath: report.wroteGraphPath,
    deletedPaths: report.deletedPaths,
  };
  return { subcommand: 'import-md', exitCode: 0, data };
}

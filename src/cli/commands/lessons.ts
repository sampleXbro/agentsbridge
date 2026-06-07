/**
 * agentsmesh lessons — query / add / topics / show / deprecate / merge / strip-markers / journal / validate / stats / prune / import-md.
 * Auto-migrates from legacy index.yaml + topics on first invocation.
 */
import { maybeAutoMigrateLessons } from '../../lessons/auto-migrate.js';
import {
  doAdd,
  doDeprecate,
  doImportMd,
  doJournal,
  doMerge,
  doPrune,
  doQuery,
  doShow,
  doStats,
  doStripMarkers,
  doTopics,
  doValidate,
  type LessonsFlags,
} from './lessons-handlers.js';
import type { LessonsCommandResult } from './lessons-types.js';

export type { LessonsCommandResult } from './lessons-types.js';

export async function runLessons(
  flags: LessonsFlags,
  args: string[],
  projectRoot: string,
): Promise<LessonsCommandResult> {
  const subcommand = args[0];
  if (subcommand === undefined || subcommand === '') {
    return { subcommand: 'help', exitCode: 0, data: null };
  }

  const autoMigrated =
    subcommand === 'import-md' ? false : await maybeAutoMigrateLessons(projectRoot);

  switch (subcommand) {
    case 'query':
      return doQuery(flags, projectRoot, autoMigrated);
    case 'add':
      return doAdd(flags, args[1], projectRoot);
    case 'topics':
      return doTopics(projectRoot);
    case 'show':
      return doShow(args[1], projectRoot);
    case 'deprecate':
      return doDeprecate(flags, args[1], projectRoot);
    case 'merge':
      return doMerge(args[1], args[2], projectRoot);
    case 'strip-markers':
      return doStripMarkers(flags, projectRoot);
    case 'journal':
      return doJournal(projectRoot);
    case 'validate':
      return doValidate(projectRoot);
    case 'stats':
      return doStats(flags, projectRoot);
    case 'prune':
      return doPrune(flags, projectRoot);
    case 'import-md':
      return doImportMd(flags, projectRoot);
    default:
      return {
        subcommand: 'help',
        exitCode: 2,
        error: `Unknown lessons subcommand: ${subcommand}`,
        data: null,
      };
  }
}

/**
 * agentsmesh lessons — query / add / topics / show / deprecate / merge / untrigger / strip-markers / journal / validate / stats / prune / import-md.
 * Auto-migrates from legacy index.yaml + topics on first invocation.
 */
import { maybeAutoMigrateLessons } from '../../lessons/auto-migrate.js';
import {
  doAdd,
  doDeprecate,
  doHook,
  doImportMd,
  doJournal,
  doMerge,
  doMergeDriver,
  doPrune,
  doQuery,
  doShow,
  doStats,
  doStripMarkers,
  doTopics,
  doUntrigger,
  doValidate,
  type LessonsFlags,
} from './lessons-handlers.js';
import { validateLessonsFlags } from './lessons-known-flags.js';
import type { LessonsCommandResult } from './lessons-types.js';

export type { LessonsCommandResult } from './lessons-types.js';

/**
 * Pre-dispatch legacy migration. `import-md` migrates explicitly (never here).
 * The RECALL subcommands (`query`, `hook`) must never crash — a corrupt legacy
 * store degrades to an unmigrated (usually absent) graph, leaving the legacy
 * files intact for an explicit `import-md` to surface the error loudly. Every
 * other subcommand keeps the throw: failing a write loudly prevents a fresh
 * empty graph from permanently stranding an unmigrated legacy store.
 */
async function migrateForSubcommand(
  subcommand: string,
  projectRoot: string,
): Promise<boolean> {
  if (subcommand === 'import-md') return false;
  if (subcommand === 'query' || subcommand === 'hook') {
    try {
      return await maybeAutoMigrateLessons(projectRoot);
    } catch {
      return false;
    }
  }
  return maybeAutoMigrateLessons(projectRoot);
}

export async function runLessons(
  flags: LessonsFlags,
  args: string[],
  projectRoot: string,
): Promise<LessonsCommandResult> {
  const subcommand = args[0];
  if (subcommand === undefined || subcommand === '') {
    return { subcommand: 'help', exitCode: 0, data: null };
  }

  // Reject typoed/unknown flags before any side effect: the parser is permissive,
  // so a silently-ignored `--trigger-flie` would drop a trigger from a capture.
  const flagError = validateLessonsFlags(subcommand, flags);
  if (flagError !== null) {
    return { subcommand: 'help', exitCode: 2, error: flagError, data: null };
  }

  const autoMigrated = await migrateForSubcommand(subcommand, projectRoot);

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
    case 'untrigger':
      return doUntrigger(args[1], args[2], projectRoot);
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
    case 'hook':
      // Internal: invoked by a generated PostToolUse hook, not by a human, so it
      // is intentionally absent from LESSONS_SUBCOMMANDS / help.
      return doHook(projectRoot);
    case 'merge-driver':
      // Internal: invoked by git as a merge driver (args = base ours theirs),
      // not by a human — intentionally absent from LESSONS_SUBCOMMANDS / help.
      return doMergeDriver(args.slice(1));
    default:
      return {
        subcommand: 'help',
        exitCode: 2,
        error: `Unknown lessons subcommand: ${subcommand}`,
        data: null,
      };
  }
}

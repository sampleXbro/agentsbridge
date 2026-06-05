/**
 * agentsmesh lessons — query / add / topics / show / deprecate / journal / validate / import-md.
 * Auto-migrates from legacy index.yaml + topics/*.md on first invocation.
 */
import { existsSync } from 'node:fs';
import { graphFilePath } from '../../lessons/graph-store.js';
import { importLegacyLessons } from '../../lessons/import-legacy.js';
import { lessonsPaths } from '../../lessons/paths.js';
import {
  doAdd,
  doDeprecate,
  doImportMd,
  doJournal,
  doQuery,
  doShow,
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

  const autoMigrated = maybeAutoMigrate(projectRoot, subcommand);

  switch (subcommand) {
    case 'query':
      return doQuery(flags, projectRoot, autoMigrated);
    case 'add':
      return doAdd(flags, projectRoot);
    case 'topics':
      return doTopics(projectRoot);
    case 'show':
      return doShow(args[1], projectRoot);
    case 'deprecate':
      return doDeprecate(flags, args[1], projectRoot);
    case 'journal':
      return doJournal(projectRoot);
    case 'validate':
      return doValidate(projectRoot);
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

function maybeAutoMigrate(projectRoot: string, subcommand: string): boolean {
  if (subcommand === 'import-md') return false;
  const paths = lessonsPaths(projectRoot);
  if (existsSync(graphFilePath(projectRoot))) return false;
  if (!existsSync(paths.index)) return false;
  importLegacyLessons(projectRoot, { migratedAt: todayIso() });
  return true;
}

function todayIso(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Human-readable renderer for `agentsmesh lessons` subcommands.
 * Query format defaults to `plain` — one rule per line — to minimize token
 * cost when an agent pastes the output into its context.
 */
import { logger } from '../../utils/output/logger.js';
import type { LessonsCommandResult } from '../commands/lessons-types.js';
import type {
  LessonsAddData,
  LessonsImportMdData,
  LessonsJournalData,
  LessonsQueryData,
  LessonsQueryFormat,
  LessonsShowData,
  LessonsTopicsData,
  LessonsValidateData,
} from '../commands/lessons-types.js';

export function renderLessons(result: LessonsCommandResult): void {
  if (result.error !== undefined && result.error.length > 0) {
    logger.error(result.error);
  }
  switch (result.subcommand) {
    case 'help':
      return printHelp();
    case 'query':
      return renderQuery(result.data, result.format);
    case 'add':
      return renderAdd(result.data);
    case 'topics':
      return renderTopics(result.data);
    case 'show':
      return renderShow(result.data);
    case 'deprecate':
      logger.success(
        result.data.supersededBy === null
          ? `Deprecated ${result.data.id}.`
          : `Superseded ${result.data.id} → ${result.data.supersededBy}.`,
      );
      return;
    case 'journal':
      return renderJournal(result.data);
    case 'validate':
      return renderValidate(result.data);
    case 'import-md':
      return renderImportMd(result.data);
  }
}

function renderQuery(data: LessonsQueryData, format: LessonsQueryFormat): void {
  if (data.autoMigrated) {
    logger.warn('lessons.json was auto-migrated from index.yaml on first invocation.');
  }
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }
  if (data.lessons.length === 0) {
    logger.info('(no matches)');
    return;
  }
  if (format === 'md') {
    data.lessons.forEach((l, i) => logger.info(`${i + 1}. ${l.rule}`));
    return;
  }
  for (const l of data.lessons) logger.info(l.rule);
}

function renderAdd(data: LessonsAddData): void {
  if (!data.isNewLesson) {
    logger.info(`Existing lesson: ${data.id}`);
    return;
  }
  logger.success(`Added lesson: ${data.id}`);
  if (data.isNewTopic) logger.info('  created new topic');
  if (data.newTriggerIds.length > 0) {
    logger.info(`  new triggers: ${data.newTriggerIds.join(', ')}`);
  }
}

function renderTopics(data: LessonsTopicsData): void {
  if (data.topics.length === 0) {
    logger.info('(no topics)');
    return;
  }
  for (const t of data.topics) logger.info(`${t.id}  ${t.summary}`);
}

function renderShow(data: LessonsShowData): void {
  process.stdout.write(data.markdown);
}

function renderJournal(data: LessonsJournalData): void {
  for (const e of data.entries) logger.info(`${e.createdAt}  ${e.id}  ${e.rule}`);
}

function renderValidate(data: LessonsValidateData): void {
  if (data.ok && data.findings.length === 0) {
    logger.success('Lessons graph: ok.');
    return;
  }
  for (const f of data.findings) {
    const line = `${f.level.toUpperCase()} ${f.code}: ${f.message}`;
    if (f.level === 'error') logger.error(line);
    else logger.warn(line);
  }
}

function renderImportMd(data: LessonsImportMdData): void {
  logger.success(
    `Imported lessons: topics=${data.topicCount} lessons=${data.lessonCount} triggers=${data.triggerCount}`,
  );
  logger.info(`  graph: ${data.wroteGraphPath.replaceAll('\\', '/')}`);
  if (data.deletedPaths.length > 0) {
    logger.info(
      `  removed legacy: ${data.deletedPaths.length} path${data.deletedPaths.length === 1 ? '' : 's'}`,
    );
  }
}

function printHelp(): void {
  logger.info('Usage: agentsmesh lessons <subcommand> [args] [flags]');
  logger.info('');
  logger.info('Subcommands:');
  logger.info('  query [--file <p>] [--cmd <c>] [--keyword <k>] [--format plain|md|json]');
  logger.info(
    '  add --rule "<text>" --topic <id> [--trigger-file <glob>]... [--trigger-cmd <regex>]... [--trigger-kw <txt>]... [--evidence <ref>]... [--rationale <text>] [--new-topic --topic-summary "..."]',
  );
  logger.info('  topics');
  logger.info('  show <topic>');
  logger.info('  deprecate <id> [--superseded-by <id>]');
  logger.info('  journal');
  logger.info('  validate');
  logger.info('  import-md [--force] [--migrated-at <ISO date>]');
}

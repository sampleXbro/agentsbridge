import { logger } from '../../utils/output/logger.js';
import type {
  LessonsPruneData,
  LessonsStatsData,
  LessonsValidateData,
} from '../commands/lessons-types.js';

/**
 * Renderers for the diagnostic `lessons` subcommands (`stats`, `prune`,
 * `validate`). Split from the main renderer to keep each file focused and under
 * the repository line limit.
 */

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export function renderStats(data: LessonsStatsData, format: 'text' | 'json'): void {
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify(data.report, null, 2)}\n`);
    return;
  }
  if (!data.hasLog) {
    if (data.telemetryEnabled) {
      logger.info(
        '(telemetry is ON here, but no recall has been recorded yet — telemetry is written by ' +
          '`lessons query` recalls, not by `stats`. Run some `agentsmesh lessons query …` calls, then re-run stats.)',
      );
    } else {
      logger.info(
        '(no recall telemetry yet — recording happens during `lessons query` recalls, NOT during `stats`. ' +
          'Set AGENTSMESH_LESSONS_TELEMETRY=1 in the environment that runs your recalls — your shell for CLI ' +
          'queries, and/or the MCP server process for agent queries — then run some queries before `stats`.)',
      );
    }
    return;
  }
  const r = data.report;
  const be = r.preloadBreakEven;
  logger.info(
    `recalls: ${r.totalRecalls}   no-match: ${pct(r.noMatchRate)}   sessions: ${be.sessions}   bypassed(--all): ${r.bypassedRecalls}`,
  );
  logger.info(
    `match counts: ${r.matchCountHistogram.map((b) => `${b.bucket}=${b.count}`).join('  ')}`,
  );
  logger.info(
    `returned tokens: p50=${r.returnedTokens.p50} p90=${r.returnedTokens.p90} max=${r.returnedTokens.max}`,
  );
  // Honest per-session comparison: preload is paid once PER session, mandatory
  // recall excludes --all dumps. ratio = preload / mandatory recall (>1 ⇒ recall wins).
  logger.info(
    `break-even (per session): preload ${be.sessions}×${r.wholeActiveSetTokens}=${be.preloadTokens} vs mandatory recall=${be.mandatoryRecallTokens} → ` +
      `${be.recallCheaper ? 'recall cheaper' : 'preload cheaper'} (ratio ${be.ratio.toFixed(2)})`,
  );
  logger.info(
    `redundancy: ${pct(r.redundancy.rate)} of delivered rule-tokens are intra-session repeats (coverage ${pct(r.redundancy.coverage)})`,
  );
  logger.info(
    `reachability: keyword-only recalls ${pct(r.reachability.keywordOnlyRecallRate)}, keyword-only-unreachable lessons ${r.reachability.keywordOnlyUnreachableLessons}`,
  );
}

export function renderPrune(data: LessonsPruneData): void {
  const triggerN = data.removedTriggerIds.length;
  const topicN = data.removedTopicIds.length;
  const lessonN = data.trimmedLessons.length;
  const deadGlobN = data.removedDeadGlobs.length;
  if (triggerN === 0 && topicN === 0 && lessonN === 0 && deadGlobN === 0) {
    logger.success(`Lessons graph already lean (cap ${data.cap}) — nothing to prune.`);
    renderUnreachable(data.unreachableLessons);
    return;
  }
  const verb = data.applied ? 'Pruned' : 'Would prune';
  logger.success(
    `${verb}: ${deadGlobN} dead glob${deadGlobN === 1 ? '' : 's'} detached, ${triggerN} dead trigger${triggerN === 1 ? '' : 's'} removed, ${topicN} orphan topic${topicN === 1 ? '' : 's'} removed, ${lessonN} over-cap lesson${lessonN === 1 ? '' : 's'} trimmed (cap ${data.cap}).`,
  );
  for (const t of data.trimmedLessons) {
    logger.info(`  trim ${t.id}: -${t.removedCount} → ${t.keptCount} kept`);
  }
  for (const t of data.removedDeadGlobs) {
    logger.info(`  dead-glob ${t.id}: -${t.removedCount} → ${t.keptCount} kept`);
  }
  renderUnreachable(data.unreachableLessons);
  if (!data.applied) {
    logger.warn(
      'Dry run — pass --apply to write. lessons.json is git-tracked, so prune is reversible.',
    );
  }
}

function renderUnreachable(ids: readonly string[]): void {
  if (ids.length === 0) return;
  logger.warn(
    `${ids.length} lesson${ids.length === 1 ? '' : 's'} unreachable (every trigger is a dead glob) — left intact to avoid stranding; re-point a trigger or deprecate: ${ids.join(', ')}`,
  );
}

export function renderValidate(data: LessonsValidateData): void {
  // Findings (errors + advisory warnings) go to stderr; the stdout verdict tracks
  // the EXIT semantics — `ok` means "no error-level findings". Warnings (e.g. a
  // DEAD_FILE_GLOB) are advisories that don't fail validation, so they're shown
  // but don't suppress the positive verdict.
  for (const f of data.findings) {
    const line = `${f.level.toUpperCase()} ${f.code}: ${f.message}`;
    if (f.level === 'error') logger.error(line);
    else logger.warn(line);
  }
  if (data.ok) logger.success('Lessons graph: ok.');
}

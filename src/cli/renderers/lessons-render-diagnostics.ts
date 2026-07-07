import { INEFFECTIVE_MIN_DELIVERIES } from '../../lessons/validate-health.js';
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
    // Recall (cost) with capture (activity) and effectiveness (benefit) nested, so a
    // single JSON document carries all three halves of the telemetry picture.
    process.stdout.write(
      `${JSON.stringify({ ...data.report, capture: data.captureReport, effectiveness: data.effectiveness }, null, 2)}\n`,
    );
    return;
  }
  // The empty hint fires only when NO log exists — any one present shows its block.
  if (!data.hasLog && !data.hasCaptureLog && !data.hasOutcomeLog) {
    renderEmptyStatsHint(data.telemetryEnabled);
    return;
  }
  if (data.hasLog) renderRecallStats(data.report);
  if (data.hasCaptureLog) renderCaptureStats(data);
  if (data.hasOutcomeLog) renderEffectivenessStats(data.effectiveness);
}

function renderEffectivenessStats(e: LessonsStatsData['effectiveness']): void {
  // The BENEFIT side. `held` is a COARSE upper bound (a delivery with no recorded
  // repeat on the same action) — not proof of prevention — so it is labeled as
  // such, with a pointer to `validate` for the actionable ineffective/uncovered list.
  logger.info(
    `effectiveness (coarse): ${e.deliveries} deliveries of ${e.lessonsDelivered} lesson${e.lessonsDelivered === 1 ? '' : 's'}, ` +
      `held ${pct(e.heldRate)} (no repeat recorded on the same action after delivery — a weak upper bound, not proof)`,
  );
  logger.info(
    `  ${e.ineffectiveLessons} ineffective (delivered ≥${INEFFECTIVE_MIN_DELIVERIES}×, repeated every time), ` +
      `${e.failuresObserved} failures observed — run \`lessons validate\` for the actionable list`,
  );
}

function renderEmptyStatsHint(telemetryEnabled: boolean): void {
  if (telemetryEnabled) {
    logger.info(
      '(telemetry is ON here, but nothing has been recorded yet — telemetry is written by ' +
        '`lessons query` recalls and `lessons add` captures, not by `stats`. Run some `agentsmesh lessons` calls, then re-run stats.)',
    );
  } else {
    logger.info(
      '(no lessons telemetry yet — recording happens during `lessons query` recalls and `lessons add` captures, NOT during `stats`. ' +
        'Set AGENTSMESH_LESSONS_TELEMETRY=1 in the environment that runs them — your shell for CLI ' +
        'calls, and/or the MCP server process for agent calls — then re-run `stats`.)',
    );
  }
}

function renderRecallStats(r: LessonsStatsData['report']): void {
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

function renderCaptureStats(data: LessonsStatsData): void {
  const c = data.captureReport;
  const k = c.byTriggerKind;
  // Recalls-per-capture: a high ratio is healthy (lessons are read far more than
  // written); a ratio near 0 means capture is outpacing use, or recall is off.
  const ratio = c.total === 0 ? '—' : (data.report.totalRecalls / c.total).toFixed(2);
  logger.info(
    `captures: ${c.total}   blocked: ${c.blocked}   new: ${c.newLessons}   upsert: ${c.upserts}   new-topics: ${c.newTopics}   warned: ${c.withWarnings}`,
  );
  logger.info(`capture triggers by kind: file=${k.file}  cmd=${k.command}  kw=${k.keyword}`);
  logger.info(`recall:capture ratio: ${ratio} recalls per capture`);
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

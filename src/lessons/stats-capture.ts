import type { CaptureTelemetryRecord } from './capture-telemetry.js';

/**
 * Pure aggregator over the capture telemetry log — the symmetric counterpart to
 * {@link summarizeRecall}. Answers "are lessons being captured, or silently
 * skipped/blocked?": how many captures, how many were rejected (blocked), the
 * new-vs-upsert split, and the trigger-kind mix. A sibling module (not part of
 * stats.ts) to keep both files under the repository line limit.
 */

export interface CaptureStatsReport {
  /** Every capture attempt recorded (successful + blocked). */
  readonly total: number;
  /** Captures REJECTED (no effective trigger, unknown topic, write-barrier, …). */
  readonly blocked: number;
  /** Successful captures that created a brand-new lesson. */
  readonly newLessons: number;
  /** Successful captures that upserted an existing rule. */
  readonly upserts: number;
  /** Successful captures that also created a topic. */
  readonly newTopics: number;
  /** Successful captures that carried ≥1 non-blocking guardrail warning. */
  readonly withWarnings: number;
  /** Σ trigger kinds passed across all captures (blocked included — kinds are still known). */
  readonly byTriggerKind: {
    readonly file: number;
    readonly command: number;
    readonly keyword: number;
  };
}

export function summarizeCapture(
  records: readonly CaptureTelemetryRecord[],
): CaptureStatsReport {
  const succeeded = records.filter((r) => !r.blocked);
  return {
    total: records.length,
    blocked: records.filter((r) => r.blocked).length,
    newLessons: succeeded.filter((r) => r.isNewLesson).length,
    upserts: succeeded.filter((r) => !r.isNewLesson).length,
    newTopics: succeeded.filter((r) => r.isNewTopic).length,
    withWarnings: succeeded.filter((r) => r.warningCodes.length > 0).length,
    byTriggerKind: {
      file: records.reduce((a, r) => a + r.triggerKinds.file, 0),
      command: records.reduce((a, r) => a + r.triggerKinds.command, 0),
      keyword: records.reduce((a, r) => a + r.triggerKinds.keyword, 0),
    },
  };
}

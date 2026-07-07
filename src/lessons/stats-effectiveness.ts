import type { LessonsGraph } from './graph-schema.js';
import { effectiveness, type OutcomeEvent } from './outcome-log.js';
import { INEFFECTIVE_MIN_DELIVERIES } from './validate-health.js';

/**
 * Pure aggregator over the OUTCOME log — the benefit side of the picture that
 * summarizeRecall (cost) and summarizeCapture (activity) deliberately leave out.
 * Answers "are delivered lessons actually preventing the repeat?" The signal is
 * COARSE by design (attribution is noisy — a delivery not followed by a recorded
 * repeat is a weak upper bound on prevention, NOT proof), so the report is labeled
 * as such and never claims a precise number of mistakes prevented.
 */

export interface EffectivenessStatsReport {
  /** `delivered` events — how many times lessons were injected for an action. */
  readonly deliveries: number;
  /** Distinct lessons delivered at least once. */
  readonly lessonsDelivered: number;
  /** `failure` events observed at decision points. */
  readonly failuresObserved: number;
  /**
   * Coarse HELD rate: fraction of deliveries NOT followed by a repeat failure on
   * the same (session, action). A weak UPPER bound on prevention — the repeat may
   * simply never have been attempted — not proof the lesson worked. 1 when no data.
   */
  readonly heldRate: number;
  /** Active lessons delivered >= threshold that were followed by a repeat EVERY time. */
  readonly ineffectiveLessons: number;
}

export function summarizeEffectiveness(
  events: readonly OutcomeEvent[],
  graph: LessonsGraph,
): EffectivenessStatsReport {
  let deliveries = 0;
  let misses = 0;
  let ineffective = 0;
  const eff = effectiveness(events);
  for (const [id, outcome] of eff) {
    deliveries += outcome.delivered;
    misses += outcome.missed;
    if (
      outcome.delivered >= INEFFECTIVE_MIN_DELIVERIES &&
      outcome.missed === outcome.delivered &&
      graph.lessons[id]?.status === 'active'
    ) {
      ineffective += 1;
    }
  }
  return {
    deliveries,
    lessonsDelivered: eff.size,
    failuresObserved: events.filter((e) => e.kind === 'failure').length,
    heldRate: deliveries === 0 ? 1 : 1 - misses / deliveries,
    ineffectiveLessons: ineffective,
  };
}

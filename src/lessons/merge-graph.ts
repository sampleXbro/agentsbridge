import type { LessonsGraph } from './graph-schema.js';
import { stableStringify } from './graph-store.js';

/**
 * Three-way union merge of the lessons graph — the engine behind the git merge
 * driver. `lessons.json` is a single file, so two branches that each capture a
 * lesson collide in git's line-based merge even though the changes are logically
 * independent. This merges the lessons / topics / triggers maps by key instead:
 * the common case (each branch adds new entries) unions cleanly, and a key edited
 * on both branches is resolved three-way (take the side that changed it; if both
 * changed it differently, prefer a `deprecated` lesson — retirement is monotonic
 * — else a deterministic, side-order-independent tiebreak).
 *
 * Bias: never drop an entry that exists on either side. For a failure-memory
 * graph, keeping a stale lesson is safer than silently losing a captured one.
 */

type Rec<T> = Record<string, T>;

function isDeprecated(v: unknown): boolean {
  return (
    typeof v === 'object' && v !== null && (v as { status?: unknown }).status === 'deprecated'
  );
}

function pick<T>(base: T | undefined, ours: T, theirs: T): T {
  const so = stableStringify(ours);
  const st = stableStringify(theirs);
  if (so === st) return ours;
  if (base !== undefined) {
    const sb = stableStringify(base);
    if (so === sb) return theirs; // ours unchanged → take their edit
    if (st === sb) return ours; // theirs unchanged → take our edit
  }
  const od = isDeprecated(ours);
  const td = isDeprecated(theirs);
  if (od !== td) return od ? ours : theirs;
  return so > st ? ours : theirs;
}

function mergeRecord<T>(base: Rec<T>, ours: Rec<T>, theirs: Rec<T>): Rec<T> {
  const out: Rec<T> = {};
  for (const k of new Set([...Object.keys(ours), ...Object.keys(theirs)])) {
    const o = ours[k];
    const t = theirs[k];
    out[k] = o !== undefined && t !== undefined ? pick(base[k], o, t) : (o ?? t)!;
  }
  return out;
}

export function mergeGraphs(
  base: LessonsGraph,
  ours: LessonsGraph,
  theirs: LessonsGraph,
): LessonsGraph {
  return {
    version: ours.version,
    lessons: mergeRecord(base.lessons, ours.lessons, theirs.lessons),
    topics: mergeRecord(base.topics, ours.topics, theirs.topics),
    triggers: mergeRecord(base.triggers, ours.triggers, theirs.triggers),
  };
}

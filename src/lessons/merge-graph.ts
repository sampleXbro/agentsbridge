import { normalizeRule } from './add-helpers.js';
import type { Lesson, LessonsGraph } from './graph-schema.js';
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
type Lessons = Rec<Lesson>;

function isDeprecated(v: unknown): boolean {
  return typeof v === 'object' && v !== null && (v as { status?: unknown }).status === 'deprecated';
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

/** True when one id holds two DIFFERENT rules and neither is the base's rule. */
function isDistinctEntity(base: Lesson | undefined, ours: Lesson, theirs: Lesson): boolean {
  const o = normalizeRule(ours.rule);
  const t = normalizeRule(theirs.rule);
  if (o === t) return false;
  if (base === undefined) return true;
  const b = normalizeRule(base.rule);
  return o !== b && t !== b;
}

function freeKey(k: string, taken: ReadonlySet<string>): string {
  let i = 2;
  while (taken.has(`${k}-${i}`)) i += 1;
  return `${k}-${i}`;
}

/** Apply `renames` to one side's keys, remapping same-side `supersededBy` chains. */
function rekey(side: Lessons, renames: ReadonlyMap<string, string>): Lessons {
  if (renames.size === 0) return side;
  const out: Lessons = {};
  for (const [k, l] of Object.entries(side)) {
    const by = l.supersededBy === undefined ? undefined : renames.get(l.supersededBy);
    out[renames.get(k) ?? k] = by === undefined ? l : { ...l, supersededBy: by };
  }
  return out;
}

/**
 * Lesson ids derive from topic + leading rule words and are disambiguated only
 * against the LOCAL graph, so two branches can mint the same id for different
 * rules. Treating that key as one entity would silently drop a captured lesson,
 * so the side `pick` would discard is re-keyed to `<id>-2`, `-3`, … before the
 * union. Nothing else references lesson ids except `supersededBy`, which is
 * remapped on the same side.
 */
function resolveIdCollisions(base: Lessons, ours: Lessons, theirs: Lessons): [Lessons, Lessons] {
  const taken = new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)]);
  const oursRenames = new Map<string, string>();
  const theirsRenames = new Map<string, string>();
  for (const k of Object.keys(ours).sort()) {
    const o = ours[k];
    const t = theirs[k];
    if (o === undefined || t === undefined || !isDistinctEntity(base[k], o, t)) continue;
    const fresh = freeKey(k, taken);
    taken.add(fresh);
    (pick(base[k], o, t) === o ? theirsRenames : oursRenames).set(k, fresh);
  }
  return [rekey(ours, oursRenames), rekey(theirs, theirsRenames)];
}

export function mergeGraphs(
  base: LessonsGraph,
  ours: LessonsGraph,
  theirs: LessonsGraph,
): LessonsGraph {
  const [o, t] = resolveIdCollisions(base.lessons, ours.lessons, theirs.lessons);
  return {
    version: ours.version,
    lessons: mergeRecord(base.lessons, o, t),
    topics: mergeRecord(base.topics, ours.topics, theirs.topics),
    triggers: mergeRecord(base.triggers, ours.triggers, theirs.triggers),
  };
}

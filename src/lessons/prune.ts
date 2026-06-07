import { MAX_RECOMMENDED_TRIGGERS } from './capture-guardrails.js';
import type { LessonsGraph } from './graph-schema.js';
import { buildFanout } from './ranking-signals.js';

/**
 * Graph curation. Two safe, deterministic operations, both reversible via git
 * (lessons.json is the committed source of truth):
 *
 *  1. Trim over-cap ACTIVE lessons down to `cap` triggers, dropping the
 *     highest-fanout (least specific) triggers first — they are the ones that
 *     dilute recall the most. Never trims below one trigger.
 *  2. Remove dead triggers — those no ACTIVE lesson references (orphans, or
 *     referenced only by superseded/deprecated lessons) — from the table and
 *     strip their (now non-recall-bearing) references everywhere.
 *
 * `planPrune` is a pure read; `applyPruneToGraph` mutates a loaded graph in
 * place (call it inside `mutateLessonsGraph` so the write stays transactional).
 */

export interface LessonTrim {
  readonly id: string;
  /** Trigger ids dropped from this lesson (kept the most specific `cap`). */
  readonly removedTriggers: string[];
  readonly keptCount: number;
}

export interface PrunePlan {
  /** Triggers removed from the table entirely (dead: no active lesson uses them). */
  readonly removedTriggerIds: string[];
  /** Active lessons trimmed down to the cap. */
  readonly trimmedLessons: LessonTrim[];
  /** The effective per-lesson trigger cap used (clamped to ≥ 1). */
  readonly cap: number;
}

export interface PruneOptions {
  /** Per-lesson trigger cap. Defaults to the capture guardrail recommendation. */
  readonly cap?: number;
}

/** Compute (without mutating) what a prune would change. */
export function planPrune(graph: LessonsGraph, options: PruneOptions = {}): PrunePlan {
  const cap = Math.max(1, options.cap ?? MAX_RECOMMENDED_TRIGGERS);
  const fanout = buildFanout(graph);

  const trimmedLessons: LessonTrim[] = [];
  // Trigger ids each active lesson keeps after trimming — drives liveness below.
  const keptByLesson = new Map<string, readonly string[]>();

  for (const [id, lesson] of Object.entries(graph.lessons)) {
    if (lesson.status !== 'active') continue;
    if (lesson.triggers.length <= cap) {
      keptByLesson.set(id, lesson.triggers);
      continue;
    }
    // Most specific (lowest fanout) first; deterministic id tie-break.
    const ordered = [...lesson.triggers].sort((a, b) => {
      const fa = fanout.get(a) ?? 0;
      const fb = fanout.get(b) ?? 0;
      return fa !== fb ? fa - fb : a < b ? -1 : 1;
    });
    const drop = new Set(ordered.slice(cap));
    const kept = lesson.triggers.filter((t) => !drop.has(t)); // preserve original order
    keptByLesson.set(id, kept);
    trimmedLessons.push({ id, removedTriggers: [...drop], keptCount: kept.length });
  }

  const live = new Set<string>();
  for (const kept of keptByLesson.values()) for (const t of kept) live.add(t);
  const removedTriggerIds = Object.keys(graph.triggers)
    .filter((t) => !live.has(t))
    .sort();

  return { removedTriggerIds, trimmedLessons, cap };
}

/** Apply a {@link planPrune} result to a loaded graph in place. */
export function applyPruneToGraph(graph: LessonsGraph, plan: PrunePlan): void {
  // 1. Trim over-cap lessons. A trimmed trigger may survive in the table when
  //    another active lesson still references it, so this only edits the lesson.
  for (const trim of plan.trimmedLessons) {
    const lesson = graph.lessons[trim.id];
    if (lesson === undefined) continue;
    const drop = new Set(trim.removedTriggers);
    graph.lessons[trim.id] = { ...lesson, triggers: lesson.triggers.filter((t) => !drop.has(t)) };
  }

  // 2. Remove dead triggers from the table and strip every remaining reference
  //    (incl. superseded/deprecated lessons) so no dangling reference survives.
  const dead = new Set(plan.removedTriggerIds);
  if (dead.size === 0) return;
  for (const [id, lesson] of Object.entries(graph.lessons)) {
    if (lesson.triggers.some((t) => dead.has(t))) {
      graph.lessons[id] = { ...lesson, triggers: lesson.triggers.filter((t) => !dead.has(t)) };
    }
  }
  for (const t of dead) delete graph.triggers[t];
}

/** True when a plan would change nothing. */
export function isEmptyPrunePlan(plan: PrunePlan): boolean {
  return plan.removedTriggerIds.length === 0 && plan.trimmedLessons.length === 0;
}

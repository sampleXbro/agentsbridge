import { tryLoadLessonsGraph } from '../../lessons/graph-store.js';
import { mutateLessonsGraph } from '../../lessons/mutate.js';
import {
  applyPruneToGraph,
  isEmptyPrunePlan,
  planPrune,
  type PrunePlan,
} from '../../lessons/prune.js';
import { emptyGraph, errorResult, numberFlag, type LessonsFlags } from './lessons-helpers.js';
import type { LessonsCommandResult, LessonsPruneData } from './lessons-types.js';

function toPruneData(plan: PrunePlan, applied: boolean): LessonsPruneData {
  return {
    applied,
    cap: plan.cap,
    removedTriggerIds: plan.removedTriggerIds,
    trimmedLessons: plan.trimmedLessons.map((t) => ({
      id: t.id,
      removedCount: t.removedTriggers.length,
      keptCount: t.keptCount,
    })),
  };
}

/**
 * `lessons prune` — curate the graph. Dry-run by default (computes the plan,
 * writes nothing); `--apply` routes through the locked transaction so the
 * curation is atomic and validated before persistence. `--cap <n>` overrides
 * the per-lesson trigger cap.
 */
export async function doPrune(
  flags: LessonsFlags,
  projectRoot: string,
): Promise<LessonsCommandResult> {
  const cap = numberFlag(flags, 'cap');
  if (cap !== null && (!Number.isInteger(cap) || cap < 1)) {
    return errorResult('prune', 'Invalid --cap: expected a positive integer.', 2);
  }
  const options = cap !== null ? { cap } : {};

  // The dispatcher already auto-migrated any legacy store before we get here.
  if (flags.apply !== true) {
    const graph = tryLoadLessonsGraph(projectRoot) ?? emptyGraph();
    return {
      subcommand: 'prune',
      exitCode: 0,
      data: toPruneData(planPrune(graph, options), false),
    };
  }
  // Nothing to curate — skip the locked transaction so an empty apply never
  // takes the lock or rewrites the graph file for a no-op.
  const preGraph = tryLoadLessonsGraph(projectRoot) ?? emptyGraph();
  const prePlan = planPrune(preGraph, options);
  if (isEmptyPrunePlan(prePlan)) {
    return { subcommand: 'prune', exitCode: 0, data: toPruneData(prePlan, true) };
  }
  const data = await mutateLessonsGraph(projectRoot, (graph) => {
    const plan = planPrune(graph, options);
    applyPruneToGraph(graph, plan);
    return toPruneData(plan, true);
  });
  return { subcommand: 'prune', exitCode: 0, data };
}

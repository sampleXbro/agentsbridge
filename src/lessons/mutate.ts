import type { LessonsGraph } from './graph-schema.js';
import { saveLessonsGraph, tryLoadLessonsGraph } from './graph-store.js';
import { acquireLessonsLock } from './lessons-lock.js';
import { validateLessonsGraph } from './validate.js';

export interface MutateOptions {
  readonly retries?: number;
}

function emptyGraph(): LessonsGraph {
  return { version: 1, lessons: {}, topics: {}, triggers: {} };
}

/**
 * The single transactional write path for the lessons graph: acquire the lock,
 * load (or start empty), apply `mutator`, **validate**, and only then persist
 * via the atomic save. Every mutating operation (add, merge, deprecate,
 * strip-markers, …) routes through here so writes are serialized, never
 * truncate the file, and never persist an error-level-invalid graph.
 *
 * The mutator receives the live graph and mutates it in place; its return value
 * is forwarded to the caller. If validation finds any error-level finding, the
 * change is discarded (nothing is written) and the call throws.
 */
export async function mutateLessonsGraph<T>(
  projectRoot: string,
  mutator: (graph: LessonsGraph) => T | Promise<T>,
  options: MutateOptions = {},
): Promise<Awaited<T>> {
  const release = await acquireLessonsLock(projectRoot, { retries: options.retries });
  try {
    const graph = tryLoadLessonsGraph(projectRoot) ?? emptyGraph();
    // Await the mutator UNDER the lock so async mutations are fully applied
    // before we validate and persist — otherwise a Promise-returning mutator's
    // changes would be saved before they happened (silent data loss).
    const result = await mutator(graph);

    const report = validateLessonsGraph(graph);
    if (!report.ok) {
      const errors = report.findings
        .filter((f) => f.level === 'error')
        .map((f) => `${f.code}: ${f.message}`)
        .join('; ');
      throw new Error(`mutateLessonsGraph: refusing to write an invalid graph — ${errors}`);
    }

    saveLessonsGraph(projectRoot, graph);
    return result;
  } finally {
    await release();
  }
}

import { maybeAutoMigrateLessons } from './auto-migrate.js';
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
 * The raw transactional write path (NO legacy migration): acquire the lock,
 * load (or start empty), apply `mutator`, **validate**, and only then persist
 * via the atomic save. Writes are serialized, never truncate the file, and never
 * persist an error-level-invalid graph.
 *
 * INTERNAL — not exported from the public surface. The legacy migrator
 * (`importLegacyLessons`) and scaffolding (`scaffoldLessons`) write through here
 * precisely because they must NOT trigger migration: the migrator IS the
 * migration (calling the migrating `mutateLessonsGraph` would recurse) and
 * scaffolding deliberately creates a fresh empty graph. Every other writer uses
 * `mutateLessonsGraph` below so a first write can never strand a legacy store.
 */
export async function mutateLessonsGraphLocked<T>(
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

/**
 * The public transactional write path: migrate a legacy store FIRST (so even a
 * first raw mutation cannot create an empty `lessons.json` and strand
 * `index.yaml`), then run the locked transaction. Every mutating operation
 * (add, merge, deprecate, strip-markers, …) and any third-party consumer routes
 * through here. `maybeAutoMigrateLessons` is a no-op (one stat) when a graph
 * already exists or no legacy index is present, and runs before the lock is
 * taken, so there is no re-entrancy with the migrator's own locked write.
 */
export async function mutateLessonsGraph<T>(
  projectRoot: string,
  mutator: (graph: LessonsGraph) => T | Promise<T>,
  options: MutateOptions = {},
): Promise<Awaited<T>> {
  await maybeAutoMigrateLessons(projectRoot);
  return mutateLessonsGraphLocked(projectRoot, mutator, options);
}

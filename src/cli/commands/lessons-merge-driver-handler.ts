import { readFileSync, writeFileSync } from 'node:fs';
import { LessonsGraphSchema, type LessonsGraph } from '../../lessons/graph-schema.js';
import { serializeGraph } from '../../lessons/graph-store.js';
import { mergeGraphs } from '../../lessons/merge-graph.js';
import { validateLessonsGraph } from '../../lessons/validate.js';
import type { LessonsCommandResult } from './lessons-types.js';

function readGraphFile(path: string): LessonsGraph | null {
  try {
    const parsed = LessonsGraphSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Git merge driver for `.agentsmesh/lessons/lessons.json` (internal — invoked by
 * git, not a human). Args are the three file paths git passes: base (ancestor),
 * ours (also the OUTPUT target), theirs. Three-way unions the graph and writes
 * the result to `ours`, exit 0. On any unreadable/invalid side, or a merged
 * graph that fails validation, it writes nothing and exits 1 — git then falls
 * back to ordinary conflict markers, so a bad merge is never silently persisted.
 */
export function doMergeDriver(args: readonly string[]): LessonsCommandResult {
  const [basePath, oursPath, theirsPath] = args;
  const fail: LessonsCommandResult = {
    subcommand: 'merge-driver',
    exitCode: 1,
    data: { merged: false },
    error: 'lessons merge-driver: could not merge — git will fall back to conflict markers.',
  };
  if (basePath === undefined || oursPath === undefined || theirsPath === undefined) return fail;

  const base = readGraphFile(basePath);
  const ours = readGraphFile(oursPath);
  const theirs = readGraphFile(theirsPath);
  if (base === null || ours === null || theirs === null) return fail;

  const merged = mergeGraphs(base, ours, theirs);
  if (!validateLessonsGraph(merged).ok) return fail;

  writeFileSync(oursPath, serializeGraph(merged), 'utf8');
  return { subcommand: 'merge-driver', exitCode: 0, data: { merged: true } };
}

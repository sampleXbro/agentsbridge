/**
 * Setup facts for the lessons.json git merge driver (see
 * lessons-merge-driver-handler.ts), shared by `init` (which writes the committable
 * half) and the init renderer (which prints the per-clone half).
 *
 * A merge driver has two halves: a COMMITTABLE `.gitattributes` line that binds
 * lessons.json to the driver — one dev commits it, the whole team inherits it —
 * and a PER-CLONE `git config` pair that git cannot auto-run on clone (it would be
 * a remote-code-execution vector). `init --lessons` writes the first and surfaces
 * the second as a one-time setup hint, so concurrent captures union-merge instead
 * of leaving conflict markers.
 */
export const LESSONS_MERGE_DRIVER = 'agentsmesh-lessons';

/** Committable `.gitattributes` entry binding the graph to the union merge driver. */
export const LESSONS_GITATTRIBUTES_ENTRY = `.agentsmesh/lessons/lessons.json merge=${LESSONS_MERGE_DRIVER}`;

/** Per-clone `git config` commands that activate the driver (cannot be auto-run on clone). */
export const LESSONS_MERGE_DRIVER_CONFIG: readonly string[] = [
  `git config merge.${LESSONS_MERGE_DRIVER}.name "agentsmesh lessons union"`,
  `git config merge.${LESSONS_MERGE_DRIVER}.driver "agentsmesh lessons merge-driver %O %A %B"`,
];

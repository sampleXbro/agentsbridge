/**
 * Recovering the `outputs` map from a conflicted `.agentsmesh/.lock`.
 *
 * `outputs` is the provenance the directory sweep gates on: a discovered file is
 * deletable only when the previous lock says agentsmesh wrote it. A merge that
 * dropped the map therefore stranded every pre-merge output permanently — a full
 * generate REPLACES the map with what that run emitted, so a path missing once is
 * missing forever.
 *
 * Both conflict sides are unioned. The map records only what agentsmesh wrote, so
 * widening it can never make a foreign file deletable; it can only restore paths
 * that were already ours.
 */

import { parse as parseYaml } from 'yaml';

const OURS_START = '<<<<<<<';
const SEPARATOR = '=======';
const THEIRS_END = '>>>>>>>';

/**
 * Reconstruct the two full documents a conflicted file represents by keeping the
 * shared lines and one side of every conflicted region.
 */
function conflictSides(content: string): [string, string] {
  const ours: string[] = [];
  const theirs: string[] = [];
  let side: 'both' | 'ours' | 'theirs' = 'both';

  for (const line of content.split('\n')) {
    if (line.startsWith(OURS_START)) {
      side = 'ours';
      continue;
    }
    if (side === 'ours' && line.startsWith(SEPARATOR)) {
      side = 'theirs';
      continue;
    }
    if (line.startsWith(THEIRS_END)) {
      side = 'both';
      continue;
    }
    if (side !== 'theirs') ours.push(line);
    if (side !== 'ours') theirs.push(line);
  }
  return [ours.join('\n'), theirs.join('\n')];
}

function outputsOf(document: string): Record<string, string> {
  try {
    const raw = parseYaml(document) as { outputs?: unknown };
    const outputs = raw?.outputs;
    if (!outputs || typeof outputs !== 'object' || Array.isArray(outputs)) return {};
    const out: Record<string, string> = {};
    for (const [path, hash] of Object.entries(outputs as Record<string, unknown>)) {
      if (typeof hash === 'string') out[path] = hash;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * @returns The union of both sides' `outputs`, or undefined when neither side
 * carries one — an old-format lock stays old-format rather than gaining an empty
 * map, which `readLock` distinguishes and `check` relies on.
 */
export function mergeConflictedLockOutputs(
  conflictedContent: string,
): Record<string, string> | undefined {
  const [ours, theirs] = conflictSides(conflictedContent);
  const merged = { ...outputsOf(theirs), ...outputsOf(ours) };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

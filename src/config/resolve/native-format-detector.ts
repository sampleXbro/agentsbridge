import { join } from 'node:path';
import { exists } from '../../utils/filesystem/fs.js';
import { BUILTIN_TARGETS } from '../../targets/catalog/builtin-targets.js';

/**
 * Per-path count of how many builtin descriptors list that path in
 * `detectionPaths`. Computed once at module load — `BUILTIN_TARGETS` is
 * auto-generated and frozen for the process lifetime.
 *
 * Used to weight shared markers (e.g. `AGENTS.md` is shared by 7 targets,
 * so its per-target weight is 1/7) and to identify unique markers (count === 1).
 */
const PATH_OWNER_COUNT: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>();
  for (const d of BUILTIN_TARGETS) {
    for (const p of d.detectionPaths) {
      map.set(p, (map.get(p) ?? 0) + 1);
    }
  }
  return map;
})();

interface Score {
  readonly id: string;
  readonly uniqueHits: number;
  readonly sharedScore: number;
}

function compare(a: Score, b: Score): number {
  if (a.uniqueHits !== b.uniqueHits) return b.uniqueHits - a.uniqueHits;
  if (a.sharedScore !== b.sharedScore) return b.sharedScore - a.sharedScore;
  return a.id.localeCompare(b.id);
}

/**
 * Detect which native agent format a repo uses by scoring each builtin
 * target's descriptor `detectionPaths` against what exists on disk.
 *
 * Self-scaling: the catalog of targets and their detection markers lives in
 * descriptors (`src/targets/<id>/index.ts`). Adding a new target with a
 * non-empty `detectionPaths` array makes detection work for it automatically;
 * no edit to this file is needed.
 *
 * Scoring:
 *   - `uniqueHits`  = number of present paths owned by exactly one descriptor.
 *   - `sharedScore` = Σ 1/ownerCount for present paths owned by ≥ 2 descriptors.
 *   - Winner = max(uniqueHits, then sharedScore, then alphabetic id).
 *   - Returns `null` when no target has any unique marker present —
 *     "only ambiguous markers" is treated as undetectable rather than
 *     silently picking a deterministic-but-arbitrary owner.
 *
 * @param repoPath - Absolute path to the repo root to inspect
 * @returns The detected target id, or null if no unique marker is present
 */
export async function detectNativeFormat(repoPath: string): Promise<string | null> {
  const scores: Score[] = [];
  for (const descriptor of BUILTIN_TARGETS) {
    let uniqueHits = 0;
    let sharedScore = 0;
    for (const rel of descriptor.detectionPaths) {
      if (!(await exists(join(repoPath, rel)))) continue;
      const owners = PATH_OWNER_COUNT.get(rel) ?? 1;
      if (owners === 1) uniqueHits += 1;
      else sharedScore += 1 / owners;
    }
    if (uniqueHits > 0 || sharedScore > 0) {
      scores.push({ id: descriptor.id, uniqueHits, sharedScore });
    }
  }
  if (scores.length === 0) return null;
  scores.sort(compare);
  const winner = scores[0]!;
  if (winner.uniqueHits === 0) return null;
  return winner.id;
}

/**
 * One representative path per builtin descriptor, in `BUILTIN_TARGETS`
 * iteration order. Used in error messages and help output to advertise the
 * formats agentsmesh knows how to install from.
 */
export const KNOWN_NATIVE_PATHS: readonly string[] = BUILTIN_TARGETS.map(
  (d) => d.detectionPaths[0],
).filter((p): p is string => p !== undefined);

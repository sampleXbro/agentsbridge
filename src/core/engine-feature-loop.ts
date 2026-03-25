import { join } from 'node:path';
import type { CanonicalFiles, GenerateResult } from './types.js';
import { readFileSafe } from '../utils/fs.js';
import { getTarget } from '../targets/registry.js';
import type { TargetGenerators } from '../targets/target.interface.js';

export function computeStatus(existing: string | null, content: string): GenerateResult['status'] {
  if (existing === null) return 'created';
  if (existing !== content) return 'updated';
  return 'unchanged';
}

export async function generateFeature(
  results: GenerateResult[],
  targets: string[],
  canonical: CanonicalFiles,
  projectRoot: string,
  enabled: boolean,
  getGen: (
    t: TargetGenerators,
  ) => ((c: CanonicalFiles) => { path: string; content: string }[]) | undefined,
  skip?: (target: string) => boolean,
): Promise<void> {
  if (!enabled) return;
  for (const target of targets) {
    let t: TargetGenerators;
    try {
      t = getTarget(target);
    } catch {
      continue;
    }
    const gen = getGen(t);
    if (!gen) continue;
    if (skip?.(target)) continue;
    for (const out of gen(canonical)) {
      const existing = await readFileSafe(join(projectRoot, out.path));
      results.push({
        target,
        path: out.path,
        content: out.content,
        currentContent: existing ?? undefined,
        status: computeStatus(existing, out.content),
      });
    }
  }
}

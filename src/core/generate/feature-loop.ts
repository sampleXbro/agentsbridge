import { join } from 'node:path';
import type { CanonicalFiles, GenerateResult } from '../types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';

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
    target: string,
  ) => ((c: CanonicalFiles) => { path: string; content: string }[]) | undefined,
): Promise<void> {
  if (!enabled) return;
  for (const target of targets) {
    const gen = getGen(target);
    if (!gen) continue;
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

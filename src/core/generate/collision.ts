import type { GenerateResult } from '../types.js';

function statusRank(status: GenerateResult['status']): number {
  switch (status) {
    case 'created':
      return 3;
    case 'updated':
      return 2;
    case 'unchanged':
      return 1;
    case 'skipped':
      return 0;
  }
}

/**
 * Resolve duplicate generated outputs that target the same path.
 * Identical content is deduplicated; conflicting content throws.
 *
 * @param results - Raw generated outputs collected per target/feature
 * @returns Deduplicated results preserving first-seen order
 */
export function resolveOutputCollisions(results: GenerateResult[]): GenerateResult[] {
  const deduped: GenerateResult[] = [];

  for (const result of results) {
    const existingIdx = deduped.findIndex((entry) => entry.path === result.path);
    if (existingIdx === -1) {
      deduped.push(result);
      continue;
    }

    const existing = deduped[existingIdx]!;
    if (existing.content !== result.content) {
      throw new Error(
        `Conflicting generated outputs for ${result.path}: ${existing.target} and ${result.target} produce different content.`,
      );
    }

    if (statusRank(result.status) > statusRank(existing.status)) {
      deduped[existingIdx] = {
        ...existing,
        status: result.status,
        currentContent: result.currentContent ?? existing.currentContent,
      };
    }
  }

  return deduped;
}

export function refreshResultStatus(result: GenerateResult): GenerateResult {
  const status =
    result.currentContent === undefined
      ? 'created'
      : result.currentContent !== result.content
        ? 'updated'
        : 'unchanged';

  return result.status === status ? result : { ...result, status };
}

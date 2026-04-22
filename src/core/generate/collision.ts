import type { GenerateResult } from '../types.js';
import { CODEX_CLI_TARGET_ID } from '../../targets/catalog/target-ids.js';

const AGENTS_SUFFIX = 'AGENTS.md';

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

function mergeDuplicateMetadata(preferred: GenerateResult, other: GenerateResult): GenerateResult {
  if (statusRank(other.status) <= statusRank(preferred.status)) return preferred;
  return {
    ...preferred,
    status: other.status,
    currentContent: other.currentContent ?? preferred.currentContent,
  };
}

function trimmedContent(content: string): string {
  return content.trim();
}

function richerAgentsResult(left: GenerateResult, right: GenerateResult): GenerateResult | null {
  if (!left.path.endsWith(AGENTS_SUFFIX) || left.path !== right.path) return null;

  const leftTrimmed = trimmedContent(left.content);
  const rightTrimmed = trimmedContent(right.content);
  if (!leftTrimmed || !rightTrimmed) return null;

  const leftContainsRight = leftTrimmed.includes(rightTrimmed);
  const rightContainsLeft = rightTrimmed.includes(leftTrimmed);

  if (leftContainsRight === rightContainsLeft) return null;
  return leftContainsRight ? left : right;
}

function richerCodexAgentsResult(
  left: GenerateResult,
  right: GenerateResult,
): GenerateResult | null {
  if (!left.path.endsWith(AGENTS_SUFFIX) || left.path !== right.path) return null;

  const codex =
    left.target === CODEX_CLI_TARGET_ID
      ? left
      : right.target === CODEX_CLI_TARGET_ID
        ? right
        : null;
  const other = codex === left ? right : left;
  if (!codex) return null;

  return trimmedContent(codex.content).length > trimmedContent(other.content).length ? codex : null;
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
      const richer = richerAgentsResult(existing, result);
      if (richer) {
        deduped[existingIdx] = richer;
        continue;
      }
      const richerCodex = richerCodexAgentsResult(existing, result);
      if (richerCodex) {
        deduped[existingIdx] = richerCodex;
        continue;
      }
      throw new Error(
        `Conflicting generated outputs for ${result.path}: ${existing.target} and ${result.target} produce different content.`,
      );
    }

    deduped[existingIdx] = mergeDuplicateMetadata(existing, result);
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

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

/**
 * Strip optional decoration blocks that some targets embed in AGENTS.md while
 * others (e.g. cline) omit, then collapse the resulting whitespace. Two
 * AGENTS.md outputs that differ ONLY in these optional blocks are considered
 * semantically equivalent for collision purposes — the one that actually emits
 * the block wins as "richer".
 */
const OPTIONAL_AGENTS_BLOCKS: readonly RegExp[] = [
  /<!-- agentsmesh:embedded-rules:start -->[\s\S]*?<!-- agentsmesh:embedded-rules:end -->\n*/g,
];

function normalizeAgentsContent(content: string): string {
  let out = content;
  for (const block of OPTIONAL_AGENTS_BLOCKS) {
    out = out.replace(block, '');
  }
  return out.trim().replace(/\n{2,}/g, '\n\n');
}

function hasOptionalAgentsBlock(content: string): boolean {
  return /<!-- agentsmesh:embedded-rules:start -->/.test(content);
}

function richerAgentsResult(left: GenerateResult, right: GenerateResult): GenerateResult | null {
  if (!left.path.endsWith(AGENTS_SUFFIX) || left.path !== right.path) return null;

  const leftTrimmed = trimmedContent(left.content);
  const rightTrimmed = trimmedContent(right.content);
  if (!leftTrimmed || !rightTrimmed) return null;

  const leftContainsRight = leftTrimmed.includes(rightTrimmed);
  const rightContainsLeft = rightTrimmed.includes(leftTrimmed);

  if (leftContainsRight !== rightContainsLeft) {
    return leftContainsRight ? left : right;
  }

  // R-7: contents that differ only in optional decoration blocks (e.g. amp
  // embeds non-root rules in AGENTS.md while cline emits them separately) are
  // semantically equivalent. Prefer the one that emits the optional block.
  if (normalizeAgentsContent(left.content) === normalizeAgentsContent(right.content)) {
    const leftHas = hasOptionalAgentsBlock(left.content);
    const rightHas = hasOptionalAgentsBlock(right.content);
    if (leftHas !== rightHas) return leftHas ? left : right;
  }

  return null;
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

  const codexLen = trimmedContent(codex.content).length;
  const otherLen = trimmedContent(other.content).length;
  if (codexLen === otherLen) return null;
  return codexLen > otherLen ? codex : other;
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

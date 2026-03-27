import type { CanonicalFiles, GenerateResult } from './types.js';
import type { ValidatedConfig } from '../config/schema.js';
import { buildReferenceMap } from './reference-map.js';

const AGENTS_SUFFIX = 'AGENTS.md';

function isCodexAgents(result: GenerateResult): boolean {
  return result.target === 'codex-cli' && result.path.endsWith(AGENTS_SUFFIX);
}

function isWindsurfAgents(result: GenerateResult): boolean {
  return result.target === 'windsurf' && result.path.endsWith(AGENTS_SUFFIX);
}

function isClineAgents(result: GenerateResult): boolean {
  return result.target === 'cline' && result.path.endsWith(AGENTS_SUFFIX);
}

function isCursorAgents(result: GenerateResult): boolean {
  return result.target === 'cursor' && result.path.endsWith(AGENTS_SUFFIX);
}

function isGeminiAgents(result: GenerateResult): boolean {
  return result.target === 'gemini-cli' && result.path.endsWith(AGENTS_SUFFIX);
}

function isCompatibilityAgents(result: GenerateResult): boolean {
  return isCursorAgents(result) || isGeminiAgents(result);
}

function reverseReferenceMap(
  target: string,
  canonical: CanonicalFiles,
  config: ValidatedConfig,
  cache: Map<string, Map<string, string>>,
): Map<string, string> {
  const cached = cache.get(target);
  if (cached) return cached;

  const reversed = new Map<string, string>();
  for (const [canonicalPath, targetPath] of buildReferenceMap(target, canonical, config)) {
    if (!reversed.has(targetPath)) reversed.set(targetPath, canonicalPath);
  }
  cache.set(target, reversed);
  return reversed;
}

function normalizeContent(content: string, refs: Map<string, string>): string {
  const entries = [...refs.entries()].sort(([left], [right]) => right.length - left.length);
  let normalized = content;

  for (const [targetPath, canonicalPath] of entries) {
    normalized = normalized.split(targetPath).join(canonicalPath);
  }

  return normalized;
}

function hasEquivalentCanonicalContent(
  left: GenerateResult,
  right: GenerateResult,
  canonical: CanonicalFiles,
  config: ValidatedConfig,
  cache: Map<string, Map<string, string>>,
): boolean {
  const leftRefs = reverseReferenceMap(left.target, canonical, config, cache);
  const rightRefs = reverseReferenceMap(right.target, canonical, config, cache);

  return normalizeContent(left.content, leftRefs) === normalizeContent(right.content, rightRefs);
}

export function preferEquivalentCodexAgents(
  results: GenerateResult[],
  canonical: CanonicalFiles,
  config: ValidatedConfig,
): GenerateResult[] {
  const overlapTargetsByPath = new Map<string, Set<string>>();
  for (const result of results) {
    if (!result.path.endsWith(AGENTS_SUFFIX)) continue;
    const targets = overlapTargetsByPath.get(result.path) ?? new Set<string>();
    targets.add(result.target);
    overlapTargetsByPath.set(result.path, targets);
  }

  const codexByPath = new Map<string, GenerateResult>();
  for (const result of results) {
    if (isCodexAgents(result)) codexByPath.set(result.path, result);
  }

  const reverseCache = new Map<string, Map<string, string>>();
  return results.filter((result) => {
    if (isCursorAgents(result)) {
      const targets = overlapTargetsByPath.get(result.path);
      if (targets && [...targets].some((target) => target !== 'cursor')) return false;
    }

    if (isGeminiAgents(result)) {
      const targets = overlapTargetsByPath.get(result.path);
      if (
        targets &&
        [...targets].some((target) => target !== 'cursor' && target !== 'gemini-cli')
      ) {
        return false;
      }
    }

    if (
      !isWindsurfAgents(result) &&
      !isClineAgents(result) &&
      !isCursorAgents(result) &&
      !isGeminiAgents(result)
    ) {
      return true;
    }
    const codexResult = codexByPath.get(result.path);
    if (!codexResult) return true;
    if (isCompatibilityAgents(result) || isWindsurfAgents(result) || isClineAgents(result)) {
      return false;
    }
    return !hasEquivalentCanonicalContent(codexResult, result, canonical, config, reverseCache);
  });
}

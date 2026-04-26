/**
 * Copilot `.github/instructions/` artifact path rewriting for reference maps.
 */

import { basename } from 'node:path';
import type { CanonicalFiles } from '../../core/types.js';
import { pathApi } from '../../core/path-helpers.js';

function canonicalRulePath(rule: CanonicalFiles['rules'][number]): string {
  return `.agentsmesh/rules/${basename(rule.source)}`;
}

function copilotInstructionsPath(rule: CanonicalFiles['rules'][number]): string {
  const slug = basename(rule.source, '.md');
  return `.github/instructions/${slug}.instructions.md`;
}

/**
 * When rewriting references for Copilot instruction files, map canonical rule paths to instruction outputs.
 */
export function applyCopilotInstructionArtifactRefs(
  target: string,
  refs: Map<string, string>,
  projectRoot: string,
  destinationPath: string | undefined,
  canonical: CanonicalFiles,
): void {
  if (target !== 'copilot' || !destinationPath?.startsWith('.github/instructions/')) return;

  // Match `buildArtifactPathMap`: pick the path API from the projectRoot
  // format so keys interleave with the rewriter's lookups regardless of host.
  const api = pathApi(projectRoot);
  for (const rule of canonical.rules) {
    if (rule.root || rule.globs.length === 0) continue;
    refs.set(
      api.normalize(api.join(projectRoot, canonicalRulePath(rule))),
      api.normalize(api.join(projectRoot, copilotInstructionsPath(rule))),
    );
  }
}

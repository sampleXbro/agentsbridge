/**
 * Copilot `.github/instructions/` artifact path rewriting for reference maps.
 */

import { join, normalize as normalizePath } from 'node:path';
import type { CanonicalFiles } from '../../core/types.js';

function canonicalRulePath(rule: CanonicalFiles['rules'][number]): string {
  return `.agentsmesh/rules/${rule.source.split('/').pop()!}`;
}

function copilotInstructionsPath(rule: CanonicalFiles['rules'][number]): string {
  const slug = rule.source.split('/').pop()!.replace(/\.md$/, '');
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

  for (const rule of canonical.rules) {
    if (rule.root || rule.globs.length === 0) continue;
    refs.set(
      normalizePath(join(projectRoot, canonicalRulePath(rule))),
      normalizePath(join(projectRoot, copilotInstructionsPath(rule))),
    );
  }
}

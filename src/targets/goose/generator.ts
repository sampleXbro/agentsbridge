/**
 * Generate Goose target outputs from canonical files.
 *
 * Emits:
 *   - `.goosehints`       — root rule + embedded non-root rules
 *   - `.agents/skills/`   — skill bundles
 *   - `.gooseignore`      — ignore patterns
 */

import type { CanonicalFiles } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { appendEmbeddedRulesBlock } from '../projection/managed-blocks.js';
import { GOOSE_TARGET, GOOSE_ROOT_FILE, GOOSE_SKILLS_DIR, GOOSE_IGNORE } from './constants.js';

export interface GooseOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): GooseOutput[] {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = canonical.rules.filter((rule) => {
    if (rule.root) return false;
    return rule.targets.length === 0 || rule.targets.includes(GOOSE_TARGET);
  });

  const rootBody = root?.body.trim() ?? '';
  const content = appendEmbeddedRulesBlock(rootBody, nonRootRules);
  if (!content) return [];

  return [{ path: GOOSE_ROOT_FILE, content }];
}

export function generateSkills(canonical: CanonicalFiles): GooseOutput[] {
  return generateEmbeddedSkills(canonical, GOOSE_SKILLS_DIR);
}

export function generateIgnore(canonical: CanonicalFiles): GooseOutput[] {
  if (canonical.ignore.length === 0) return [];
  return [{ path: GOOSE_IGNORE, content: canonical.ignore.join('\n') }];
}

/**
 * Generate Jules target outputs from canonical files.
 *
 * Emits:
 *   - `AGENTS.md` — root rule + embedded non-root rules
 *
 * Jules is a cloud-based async agent — it only reads `AGENTS.md`
 * for project-level instructions. No skills, MCP, or other files.
 */

import type { CanonicalFiles } from '../../core/types.js';
import { appendEmbeddedRulesBlock } from '../projection/managed-blocks.js';
import { JULES_TARGET, JULES_ROOT_FILE } from './constants.js';

export interface JulesOutput {
  path: string;
  content: string;
}

export function generateRules(canonical: CanonicalFiles): JulesOutput[] {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = canonical.rules.filter((rule) => {
    if (rule.root) return false;
    return rule.targets.length === 0 || rule.targets.includes(JULES_TARGET);
  });

  const rootBody = root?.body.trim() ?? '';
  const content = appendEmbeddedRulesBlock(rootBody, nonRootRules);
  if (!content) return [];

  return [{ path: JULES_ROOT_FILE, content }];
}

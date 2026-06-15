/**
 * Generate Zed target outputs from canonical files.
 *
 * Emits:
 *   - `.rules`              — root rule + embedded non-root rules
 *
 * MCP is emitted via `emitScopedSettings` (not generateMcp) because
 * Zed stores MCP servers inside `.zed/settings.json` alongside other
 * editor settings, requiring a JSON-merge strategy.
 */

import type { CanonicalFiles } from '../../core/types.js';
import { generateEmbeddedSkills } from '../import/embedded-skill.js';
import { appendEmbeddedRulesBlock } from '../projection/managed-blocks.js';
import { ZED_TARGET, ZED_ROOT_FILE, ZED_SKILLS_DIR } from './constants.js';

export interface ZedOutput {
  path: string;
  content: string;
}

export function generateSkills(canonical: CanonicalFiles): ZedOutput[] {
  return generateEmbeddedSkills(canonical, ZED_SKILLS_DIR);
}

export function generateRules(canonical: CanonicalFiles): ZedOutput[] {
  const root = canonical.rules.find((rule) => rule.root);
  const nonRootRules = canonical.rules.filter((rule) => {
    if (rule.root) return false;
    return rule.targets.length === 0 || rule.targets.includes(ZED_TARGET);
  });

  const rootBody = root?.body.trim() ?? '';
  const content = appendEmbeddedRulesBlock(rootBody, nonRootRules);
  if (!content) return [];

  return [{ path: ZED_ROOT_FILE, content }];
}

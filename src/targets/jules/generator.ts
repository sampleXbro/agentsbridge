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

/**
 * No-op stub — Jules has no command system.
 * Lint warnings surface this via lintCommands.
 */
export function generateCommands(_canonical: CanonicalFiles): JulesOutput[] {
  return [];
}

/**
 * No-op stub — Jules is a cloud-based agent with no MCP support.
 * Lint warnings surface this via lintMcp.
 */
export function generateMcp(_canonical: CanonicalFiles): JulesOutput[] {
  return [];
}

/**
 * No-op stub — Jules has no lifecycle hook system.
 * Lint warnings surface this via lintHooks.
 */
export function generateHooks(_canonical: CanonicalFiles): JulesOutput[] {
  return [];
}

/**
 * No-op stub — Jules is a cloud-based agent with no dedicated ignore file.
 * Lint warnings surface this via lintIgnore.
 */
export function generateIgnore(_canonical: CanonicalFiles): JulesOutput[] {
  return [];
}

/**
 * No-op stub — Jules has no permissions system.
 * Lint warnings surface this via lintPermissions.
 */
export function generatePermissions(_canonical: CanonicalFiles): JulesOutput[] {
  return [];
}

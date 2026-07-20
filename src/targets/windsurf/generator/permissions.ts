import type { CanonicalFiles } from '../../../core/types.js';
import type { RulesOutput } from './types.js';

/**
 * No-op stub — Windsurf terminal permissions are managed via user settings UI;
 * agentsmesh does not generate permissions config.
 * Lint warnings surface this via lintPermissions.
 */
export function generatePermissions(_canonical: CanonicalFiles): RulesOutput[] {
  return [];
}

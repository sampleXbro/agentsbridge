/**
 * Global-scope extras for Gemini CLI: emits `~/.gemini/policies/permissions.toml`
 * from canonical permissions.
 *
 * The policy engine loads the User tier (`~/.gemini/policies/*.toml`) but its
 * Workspace tier (`<repo>/.gemini/policies/`) is documented as non-functional, so
 * emitting at project scope would write a security policy the tool never reads.
 * Gating lives here (scopeExtras receives the scope) rather than in a plain
 * `generatePermissions`, which the feature loop would run at both scopes.
 *
 * Source: https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/policy-engine.md
 */

import { join } from 'node:path';
import type { ScopeExtrasFn } from '../catalog/target-descriptor.js';
import type { GenerateResult } from '../../core/types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { GEMINI_GLOBAL_POLICIES_FILE } from './constants.js';
import { generateGeminiPermissionsPolicies } from './policies-generator.js';

function computeStatus(existing: string | null, content: string): GenerateResult['status'] {
  if (existing === null) return 'created';
  if (existing !== content) return 'updated';
  return 'unchanged';
}

export const generateGeminiScopeExtras: ScopeExtrasFn = async (
  canonical,
  projectRoot,
  scope,
  enabledFeatures,
) => {
  if (scope !== 'global' || !enabledFeatures.has('permissions')) return [];
  const [policies] = generateGeminiPermissionsPolicies(canonical);
  if (!policies) return [];
  const existing = await readFileSafe(join(projectRoot, GEMINI_GLOBAL_POLICIES_FILE));
  return [
    {
      target: 'gemini-cli',
      path: GEMINI_GLOBAL_POLICIES_FILE,
      content: policies.content,
      currentContent: existing ?? undefined,
      status: computeStatus(existing, policies.content),
    },
  ];
};

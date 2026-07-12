import { join } from 'node:path';
import type { ScopeExtrasFn } from '../catalog/target-descriptor.js';
import type { CanonicalFiles, GenerateResult } from '../../core/types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { COPILOT_GLOBAL_AGENTS_MD } from './constants.js';
import { generateCopilotGlobalMcp } from './global-mcp.js';
import { generateCopilotGlobalHooks } from './global-hooks.js';

function computeStatus(existing: string | null, content: string): GenerateResult['status'] {
  if (existing === null) return 'created';
  if (existing !== content) return 'updated';
  return 'unchanged';
}

/**
 * Emits ~/.copilot/AGENTS.md from root rule body in global scope.
 * Used as AGENTS.md compat mirror so other tools reading AGENTS.md see the rules.
 */
async function buildAgentsMdMirror(
  canonical: CanonicalFiles,
  projectRoot: string,
): Promise<GenerateResult[]> {
  const root = canonical.rules.find((r) => r.root);
  if (!root) return [];
  const content = root.body.trim();
  const existing = await readFileSafe(join(projectRoot, COPILOT_GLOBAL_AGENTS_MD));
  return [
    {
      target: 'copilot',
      path: COPILOT_GLOBAL_AGENTS_MD,
      content,
      currentContent: existing ?? undefined,
      status: computeStatus(existing, content),
    },
  ];
}

/**
 * Copilot's global-only settings-backed outputs: the AGENTS.md compat mirror,
 * ~/.copilot/mcp-config.json, and ~/.copilot/hooks/. Each has a schema/path
 * distinct enough from its project-scope counterpart (or, for AGENTS.md, no
 * project-scope counterpart at all) that it is wired here rather than through
 * a scope-branching plain `generateX`.
 */
export const generateCopilotGlobalExtras: ScopeExtrasFn = async (
  canonical,
  projectRoot,
  scope,
  enabledFeatures,
) => {
  if (scope !== 'global') return [];
  const results: GenerateResult[] = [];
  if (enabledFeatures.has('rules'))
    results.push(...(await buildAgentsMdMirror(canonical, projectRoot)));
  if (enabledFeatures.has('mcp'))
    results.push(...(await generateCopilotGlobalMcp(canonical, projectRoot)));
  if (enabledFeatures.has('hooks')) {
    results.push(...(await generateCopilotGlobalHooks(canonical, projectRoot)));
  }
  return results;
};

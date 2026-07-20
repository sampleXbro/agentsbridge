/**
 * Global-scope hooks support for Copilot CLI: `~/.copilot/hooks/agentsmesh.json`
 * (+ wrapper scripts under `~/.copilot/hooks/scripts/`), using the exact same
 * `{version, hooks}` schema as the project-scope `.github/hooks/` directory
 * (docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks).
 * Wired independently of `generateHooks`/`postProcessHookOutputs` (see
 * `scope-extras.ts`, gated on `scope === 'global'`) rather than letting the
 * project-shaped plain generator leak into global scope.
 */

import { join } from 'node:path';
import type { CanonicalFiles, GenerateResult } from '../../core/types.js';
import { readFileSafe } from '../../utils/filesystem/fs.js';
import { COPILOT_TARGET, COPILOT_GLOBAL_HOOKS_DIR } from './constants.js';
import { buildCopilotHooksObject } from './hook-format.js';
import { addHookScriptAssets } from './hook-assets.js';

function computeStatus(existing: string | null, content: string): GenerateResult['status'] {
  if (existing === null) return 'created';
  if (existing !== content) return 'updated';
  return 'unchanged';
}

/** Emits ~/.copilot/hooks/agentsmesh.json + wrapper scripts from canonical hooks. */
export async function generateCopilotGlobalHooks(
  canonical: CanonicalFiles,
  projectRoot: string,
): Promise<GenerateResult[]> {
  const hooksObj = buildCopilotHooksObject(canonical.hooks);
  if (!hooksObj) return [];

  const mainOutput = {
    path: `${COPILOT_GLOBAL_HOOKS_DIR}/agentsmesh.json`,
    content: JSON.stringify({ version: 1, hooks: hooksObj }, null, 2),
  };
  const outputs = await addHookScriptAssets(
    projectRoot,
    canonical,
    [mainOutput],
    COPILOT_GLOBAL_HOOKS_DIR,
  );

  const results: GenerateResult[] = [];
  for (const out of outputs) {
    const existing = await readFileSafe(join(projectRoot, out.path));
    results.push({
      target: COPILOT_TARGET,
      path: out.path,
      content: out.content,
      currentContent: existing ?? undefined,
      status: computeStatus(existing, out.content),
    });
  }
  return results;
}

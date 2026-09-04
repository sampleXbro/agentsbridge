/**
 * Single writer for `.amazonq/cli-agents/<name>.json`.
 *
 * The agent file is the only writable surface Q CLI offers for hooks, permissions
 * and ignore, so four canonical features land in one file. `config.features` must
 * still gate each of them individually: the engine only skips a whole generator, it
 * cannot strip a key from a file another feature owns. That is why the fully
 * populated file is emitted from the descriptor's `emitScopedSettings` hook — the
 * only generate-time hook that receives the enabled feature set.
 *
 * `generateAgents` emits the same file without any embedded extra, so the agents
 * feature alone never leaks a disabled feature into the artifact.
 */

import type { CanonicalFiles } from '../../core/types.js';
import type { TargetLayoutScope } from '../catalog/target-descriptor.js';
import type { FeatureGeneratorOutput } from '../catalog/target.interface.js';
import { buildAgentHooks, buildAgentResources, buildToolsSettings } from './agent-json.js';
import { AMAZON_Q_AGENTS_DIR } from './constants.js';

/** Gate that lets no embedded feature through. */
const NO_FEATURES: ReadonlySet<string> = new Set();

/**
 * Build one agent JSON per canonical agent. Every embedded key is gated on its own
 * feature; `resources` is unconditional because it describes what the agent may read.
 * Paths are always project-relative — the global layout rewrites them.
 */
export function buildAgentOutputs(
  canonical: CanonicalFiles,
  scope: TargetLayoutScope,
  enabledFeatures: ReadonlySet<string>,
): FeatureGeneratorOutput[] {
  const hooks = enabledFeatures.has('hooks') ? buildAgentHooks(canonical.hooks) : undefined;
  const toolsSettings = enabledFeatures.has('ignore')
    ? buildToolsSettings(canonical.ignore)
    : undefined;
  const globalAllow = enabledFeatures.has('permissions')
    ? (canonical.permissions?.allow ?? [])
    : [];
  const resources = buildAgentResources(scope);

  return canonical.agents.map((agent) => {
    const mergedTools = [...new Set([...agent.tools, ...globalAllow])];
    return {
      path: `${AMAZON_Q_AGENTS_DIR}/${agent.name}.json`,
      content: JSON.stringify(
        {
          name: agent.name,
          ...(agent.description ? { description: agent.description } : {}),
          prompt: agent.body.trim(),
          ...(mergedTools.length > 0 ? { allowedTools: mergedTools } : {}),
          resources,
          ...(hooks ? { hooks } : {}),
          ...(toolsSettings ? { toolsSettings } : {}),
        },
        null,
        2,
      ),
    };
  });
}

/** Base agent JSON: identity plus resources, no feature-gated extras. */
export function buildBaseAgentOutputs(
  canonical: CanonicalFiles,
  scope: TargetLayoutScope,
): FeatureGeneratorOutput[] {
  return buildAgentOutputs(canonical, scope, NO_FEATURES);
}

/**
 * Descriptor `emitScopedSettings` implementation: re-emits each agent JSON with the
 * embedded features that are actually enabled. Emits nothing when agents are off, so
 * a disabled agents feature never creates an agent file.
 */
export function emitAmazonQAgentSettings(
  canonical: CanonicalFiles,
  scope: TargetLayoutScope,
  enabledFeatures: ReadonlySet<string>,
): readonly FeatureGeneratorOutput[] {
  if (!enabledFeatures.has('agents')) return [];
  return buildAgentOutputs(canonical, scope, enabledFeatures);
}

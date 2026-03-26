/**
 * Generate orchestrator: produces target-specific files from canonical sources.
 */

import type { CanonicalFiles, GenerateResult } from './types.js';
import type { ValidatedConfig } from '../config/schema.js';
import {
  shouldConvertAgentsToSkills,
  shouldConvertCommandsToSkills,
} from '../config/conversions.js';
import '../targets/claude-code/index.js';
import '../targets/cursor/index.js';
import '../targets/copilot/index.js';
import '../targets/continue/index.js';
import '../targets/junie/index.js';
import '../targets/gemini-cli/index.js';
import '../targets/cline/index.js';
import '../targets/codex-cli/index.js';
import '../targets/windsurf/index.js';
import { preferEquivalentCodexAgents } from './output-overlap.js';
import { rewriteGeneratedReferences } from './reference-rewriter.js';
import { resolveOutputCollisions, refreshResultStatus } from './engine-collision.js';
import { generateFeature } from './engine-feature-loop.js';
import { decoratePrimaryRootInstructions } from './root-instruction-decorator.js';
import {
  generatePermissionsFeature,
  generateHooksFeature,
  generateGeminiSettingsFeature,
} from './engine-optional-features.js';

export interface GenerateContext {
  config: ValidatedConfig;
  canonical: CanonicalFiles;
  projectRoot: string;
  targetFilter?: string[];
}

export { resolveOutputCollisions };

/**
 * Generate target files from canonical sources.
 * @param ctx - Config, canonical files, project root, optional target filter
 * @returns GenerateResult[] with status per file
 */
export async function generate(ctx: GenerateContext): Promise<GenerateResult[]> {
  const { config, canonical, projectRoot, targetFilter } = ctx;
  const targets = targetFilter
    ? config.targets.filter((t) => targetFilter.includes(t))
    : config.targets;
  const hasRules = config.features.includes('rules');
  const hasCommands = config.features.includes('commands');
  const hasAgents = config.features.includes('agents');
  const hasSkills = config.features.includes('skills');
  const hasMcp = config.features.includes('mcp');
  const hasPermissions = config.features.includes('permissions');
  const hasHooks = config.features.includes('hooks');
  const hasIgnore = config.features.includes('ignore');

  const results: GenerateResult[] = [];

  await generateFeature(results, targets, canonical, projectRoot, hasRules, (t) => t.generateRules);

  await generateFeature(
    results,
    targets,
    canonical,
    projectRoot,
    hasCommands,
    (t) => t.generateWorkflows ?? t.generateCommands,
    (target) => target === 'codex-cli' && !shouldConvertCommandsToSkills(config, target),
  );

  await generateFeature(
    results,
    targets,
    canonical,
    projectRoot,
    hasAgents,
    (t) => t.generateAgents,
    // Skip cline/windsurf when not projecting agents to skills (no native agent path).
    // gemini-cli and codex-cli use native agent paths, so never skip.
    (target) =>
      ['cline', 'windsurf'].includes(target) && !shouldConvertAgentsToSkills(config, target),
  );

  await generateFeature(
    results,
    targets,
    canonical,
    projectRoot,
    hasSkills,
    (t) => t.generateSkills,
  );
  await generateFeature(results, targets, canonical, projectRoot, hasMcp, (t) => t.generateMcp);

  // Permissions: same pattern but merges with existing settings.json
  if (hasPermissions) await generatePermissionsFeature(results, targets, canonical, projectRoot);

  // Hooks: merges with any pending permissions result for same path
  if (hasHooks) await generateHooksFeature(results, targets, canonical, projectRoot);

  await generateFeature(
    results,
    targets,
    canonical,
    projectRoot,
    hasIgnore,
    (t) => t.generateIgnore,
  );

  // Gemini settings: when mcp, ignore, hooks, or agents (experimental.enableAgents) enabled
  if (hasMcp || hasIgnore || hasHooks || hasAgents) {
    await generateGeminiSettingsFeature(results, targets, canonical, projectRoot);
  }

  const rewrittenResults = rewriteGeneratedReferences(results, canonical, config, projectRoot);
  const decoratedResults =
    decoratePrimaryRootInstructions(rewrittenResults).map(refreshResultStatus);

  return resolveOutputCollisions(preferEquivalentCodexAgents(decoratedResults, canonical, config));
}

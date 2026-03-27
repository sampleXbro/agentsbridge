/**
 * Generate orchestrator: produces target-specific files from canonical sources.
 */

import type { CanonicalFiles, GenerateResult } from '../types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import { resolveTargetFeatureGenerator } from '../../targets/catalog/builtin-targets.js';
import { preferEquivalentCodexAgents } from './output-overlap.js';
import { rewriteGeneratedReferences } from '../reference/rewriter.js';
import { resolveOutputCollisions, refreshResultStatus } from './collision.js';
import { generateFeature } from './feature-loop.js';
import { decoratePrimaryRootInstructions } from './root-instruction-decorator.js';
import {
  generatePermissionsFeature,
  generateHooksFeature,
  generateGeminiSettingsFeature,
} from './optional-features.js';

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

  await generateFeature(results, targets, canonical, projectRoot, hasRules, (target) =>
    resolveTargetFeatureGenerator(target, 'rules', config),
  );

  await generateFeature(results, targets, canonical, projectRoot, hasCommands, (target) =>
    resolveTargetFeatureGenerator(target, 'commands', config),
  );

  await generateFeature(results, targets, canonical, projectRoot, hasAgents, (target) =>
    resolveTargetFeatureGenerator(target, 'agents', config),
  );

  await generateFeature(results, targets, canonical, projectRoot, hasSkills, (target) =>
    resolveTargetFeatureGenerator(target, 'skills', config),
  );
  await generateFeature(results, targets, canonical, projectRoot, hasMcp, (target) =>
    resolveTargetFeatureGenerator(target, 'mcp', config),
  );

  // Permissions: same pattern but merges with existing settings.json
  if (hasPermissions) await generatePermissionsFeature(results, targets, canonical, projectRoot);

  // Hooks: merges with any pending permissions result for same path
  if (hasHooks) await generateHooksFeature(results, targets, canonical, projectRoot);

  await generateFeature(results, targets, canonical, projectRoot, hasIgnore, (target) =>
    resolveTargetFeatureGenerator(target, 'ignore', config),
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

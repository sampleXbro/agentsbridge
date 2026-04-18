/**
 * Generate orchestrator: produces target-specific files from canonical sources.
 */

import type { CanonicalFiles, GenerateResult } from '../types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  getBuiltinTargetDefinition,
  resolveTargetFeatureGenerator,
} from '../../targets/catalog/builtin-targets.js';
import { preferEquivalentCodexAgents } from './output-overlap.js';
import { rewriteGeneratedReferences } from '../reference/rewriter.js';
import { validateGeneratedMarkdownLinks } from '../reference/validate-generated-markdown-links.js';
import { resolveOutputCollisions, refreshResultStatus } from './collision.js';
import { generateFeature } from './feature-loop.js';
import { decoratePrimaryRootInstructions } from './root-instruction-decorator.js';
import {
  generatePermissionsFeature,
  generateHooksFeature,
  generateGeminiSettingsFeature,
} from './optional-features.js';
import type { TargetLayoutScope } from '../../targets/catalog/target-descriptor.js';

export interface GenerateContext {
  config: ValidatedConfig;
  canonical: CanonicalFiles;
  projectRoot: string;
  scope?: TargetLayoutScope;
  targetFilter?: string[];
}

export { resolveOutputCollisions };

/**
 * Generate target files from canonical sources.
 * @param ctx - Config, canonical files, project root, optional target filter
 * @returns GenerateResult[] with status per file
 */
export async function generate(ctx: GenerateContext): Promise<GenerateResult[]> {
  const { config, canonical, projectRoot, scope = 'project', targetFilter } = ctx;
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

  await generateFeature(results, targets, canonical, projectRoot, hasRules, scope, (target) =>
    resolveTargetFeatureGenerator(target, 'rules', config),
  );

  await generateFeature(results, targets, canonical, projectRoot, hasCommands, scope, (target) =>
    resolveTargetFeatureGenerator(target, 'commands', config),
  );

  await generateFeature(results, targets, canonical, projectRoot, hasAgents, scope, (target) =>
    resolveTargetFeatureGenerator(target, 'agents', config),
  );

  await generateFeature(results, targets, canonical, projectRoot, hasSkills, scope, (target) =>
    resolveTargetFeatureGenerator(target, 'skills', config),
  );
  await generateFeature(results, targets, canonical, projectRoot, hasMcp, scope, (target) =>
    resolveTargetFeatureGenerator(target, 'mcp', config),
  );

  // Permissions: same pattern but merges with existing settings.json
  if (hasPermissions) {
    await generatePermissionsFeature(results, targets, canonical, projectRoot, scope);
  }

  // Hooks: merges with any pending permissions result for same path
  if (hasHooks) await generateHooksFeature(results, targets, canonical, projectRoot, scope);

  await generateFeature(results, targets, canonical, projectRoot, hasIgnore, scope, (target) =>
    resolveTargetFeatureGenerator(target, 'ignore', config),
  );

  // Per-target scope extras (e.g. Claude Code output-styles in global mode)
  const enabledFeatures = new Set(config.features);
  for (const target of targets) {
    const descriptor = getBuiltinTargetDefinition(target);
    if (descriptor?.generateScopeExtras) {
      const extras = await descriptor.generateScopeExtras(
        canonical,
        projectRoot,
        scope,
        enabledFeatures,
      );
      results.push(...extras);
    }
  }

  // Gemini settings: when mcp, ignore, hooks, or agents (experimental.enableAgents) enabled
  if (hasMcp || hasIgnore || hasHooks || hasAgents) {
    await generateGeminiSettingsFeature(results, targets, canonical, projectRoot, scope);
  }

  // Decoration must run before reference rewriting so that renderPrimaryRootInstruction output
  // (which uses canonical body verbatim) gets its canonical paths rewritten to target paths.
  const decoratedResults = decoratePrimaryRootInstructions(results, canonical, scope);
  const rewrittenResults = rewriteGeneratedReferences(
    decoratedResults,
    canonical,
    config,
    projectRoot,
    scope,
    targets,
  );

  validateGeneratedMarkdownLinks(rewrittenResults, projectRoot);

  return resolveOutputCollisions(
    preferEquivalentCodexAgents(rewrittenResults.map(refreshResultStatus), canonical, config),
  );
}

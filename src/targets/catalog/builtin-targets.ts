import type { SupportLevel } from '../../core/types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  shouldConvertAgentsToSkills,
  shouldConvertCommandsToSkills,
} from '../../config/core/conversions.js';
import type { FeatureGeneratorFn, TargetCapabilities } from './target.interface.js';
import {
  type CapabilityFeatureKey,
  normalizeTargetCapabilities,
  type TargetCapabilityValue,
} from './capabilities.js';
import type {
  TargetDescriptor,
  TargetLayout,
  TargetLayoutScope,
  TargetManagedOutputs,
} from './target-descriptor.js';
import { getDescriptor } from './registry.js';
import { assertSharedArtifactOwnersUnique } from './shared-artifact-owner.js';
import { TARGET_IDS, type BuiltinTargetId, isBuiltinTargetId } from './target-ids.js';
import { descriptor as claudeCode } from '../claude-code/index.js';
import { descriptor as cursor } from '../cursor/index.js';
import { descriptor as copilot } from '../copilot/index.js';
import { descriptor as continueTarget } from '../continue/index.js';
import { descriptor as junie } from '../junie/index.js';
import { descriptor as kiro } from '../kiro/index.js';
import { descriptor as geminiCli } from '../gemini-cli/index.js';
import { descriptor as cline } from '../cline/index.js';
import { descriptor as codexCli } from '../codex-cli/index.js';
import { descriptor as windsurf } from '../windsurf/index.js';
import { descriptor as antigravity } from '../antigravity/index.js';
import { descriptor as rooCode } from '../roo-code/index.js';

type TargetFeature = keyof TargetCapabilities;

/** @deprecated Use TargetDescriptor from target-descriptor.ts instead */
export type BuiltinTargetDefinition = TargetDescriptor;

export const BUILTIN_TARGETS: readonly TargetDescriptor[] = [
  claudeCode,
  cursor,
  copilot,
  continueTarget,
  junie,
  kiro,
  geminiCli,
  cline,
  codexCli,
  windsurf,
  antigravity,
  rooCode,
];

// Lazily initialized to avoid circular-dependency issues during module load.
let _builtinTargetsMap: Map<string, TargetDescriptor> | undefined;
function builtinTargetsMap(): Map<string, TargetDescriptor> {
  if (!_builtinTargetsMap) {
    // Fail fast if two builtins claim the same/overlapping shared-artifact owner
    // prefix — would otherwise silently depend on iteration order in the rewriter.
    assertSharedArtifactOwnersUnique(BUILTIN_TARGETS);
    _builtinTargetsMap = new Map(BUILTIN_TARGETS.map((d) => [d.id, d]));
  }
  return _builtinTargetsMap;
}

// Re-export from target-ids.ts for backward compatibility
export { TARGET_IDS, type BuiltinTargetId, isBuiltinTargetId };

export function getBuiltinTargetDefinition(target: string): TargetDescriptor | undefined {
  return builtinTargetsMap().get(target);
}

export function getTargetCapabilities(
  target: string,
  scope: TargetLayoutScope = 'project',
): Record<CapabilityFeatureKey, TargetCapabilityValue> | undefined {
  const descriptor = getBuiltinTargetDefinition(target) ?? getDescriptor(target);
  if (!descriptor) return undefined;
  const raw =
    scope === 'global'
      ? (descriptor.globalSupport?.capabilities ??
        descriptor.globalCapabilities ??
        descriptor.capabilities)
      : descriptor.capabilities;
  return normalizeTargetCapabilities(raw);
}

export function getTargetDetectionPaths(
  target: string,
  scope: TargetLayoutScope = 'project',
): readonly string[] {
  const descriptor = getBuiltinTargetDefinition(target) ?? getDescriptor(target);
  if (!descriptor) return [];
  if (scope === 'global') {
    return descriptor.globalSupport?.detectionPaths ?? descriptor.globalDetectionPaths ?? [];
  }
  return descriptor.detectionPaths;
}

export function getTargetLayout(
  target: string,
  scope: TargetLayoutScope = 'project',
): TargetLayout | undefined {
  const descriptor = getBuiltinTargetDefinition(target) ?? getDescriptor(target);
  if (!descriptor) return undefined;
  if (scope === 'global') {
    return descriptor.globalSupport?.layout ?? descriptor.global;
  }
  return descriptor.project;
}

export function getTargetPrimaryRootInstructionPath(
  target: string,
  scope: TargetLayoutScope = 'project',
): string | undefined {
  return getTargetLayout(target, scope)?.rootInstructionPath;
}

export function getTargetSkillDir(
  target: string,
  scope: TargetLayoutScope = 'project',
): string | undefined {
  return getTargetLayout(target, scope)?.skillDir;
}

export function getTargetManagedOutputs(
  target: string,
  scope: TargetLayoutScope = 'project',
): TargetManagedOutputs | undefined {
  return getTargetLayout(target, scope)?.managedOutputs;
}

export function rewriteGeneratedOutputPath(
  target: string,
  path: string,
  scope: TargetLayoutScope = 'project',
): string | null {
  const layout = getTargetLayout(target, scope);
  if (!layout) return null;
  return layout.rewriteGeneratedPath ? layout.rewriteGeneratedPath(path) : path;
}

export function getEffectiveTargetSupportLevel(
  target: string,
  feature: keyof TargetCapabilities,
  config: ValidatedConfig,
  scope: TargetLayoutScope = 'project',
): SupportLevel {
  const baseLevel = getTargetCapabilities(target, scope)?.[feature]?.level ?? 'none';
  if (baseLevel !== 'embedded') return baseLevel;
  const descriptor = getBuiltinTargetDefinition(target) ?? getDescriptor(target);
  if (feature === 'commands' && descriptor?.supportsConversion?.commands) {
    return shouldConvertCommandsToSkills(config, target, true, scope) ? 'embedded' : 'none';
  }
  if (feature === 'agents' && descriptor?.supportsConversion?.agents) {
    return shouldConvertAgentsToSkills(config, target, true, scope) ? 'embedded' : 'none';
  }
  return baseLevel;
}

export function resolveTargetFeatureGenerator(
  target: string,
  feature: TargetFeature,
  config?: ValidatedConfig,
  scope: TargetLayoutScope = 'project',
): FeatureGeneratorFn | undefined {
  const descriptor = getBuiltinTargetDefinition(target) ?? getDescriptor(target);
  const generators = descriptor?.generators;
  if (!generators) return undefined;

  switch (feature) {
    case 'rules':
      return generators.generateRules;
    case 'additionalRules':
      return undefined;
    case 'commands':
      if (
        config &&
        descriptor?.supportsConversion?.commands &&
        !shouldConvertCommandsToSkills(config, target, true, scope)
      ) {
        return undefined;
      }
      return generators.generateCommands;
    case 'agents':
      if (
        config &&
        descriptor?.supportsConversion?.agents &&
        !shouldConvertAgentsToSkills(config, target, true, scope)
      ) {
        return undefined;
      }
      return generators.generateAgents;
    case 'skills':
      return generators.generateSkills;
    case 'mcp':
      return generators.generateMcp;
    case 'permissions':
      return generators.generatePermissions;
    case 'hooks':
      return generators.generateHooks;
    case 'ignore':
      return generators.generateIgnore;
  }
}

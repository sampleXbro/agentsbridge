import type { CanonicalFiles, SupportLevel } from '../../core/types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  shouldConvertAgentsToSkills,
  shouldConvertCommandsToSkills,
} from '../../config/core/conversions.js';
import type { TargetCapabilities } from './target.interface.js';
import type {
  TargetDescriptor,
  TargetLayout,
  TargetLayoutScope,
  TargetManagedOutputs,
} from './target-descriptor.js';
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

type TargetFeature = keyof TargetCapabilities | 'settings';
type TargetGenerator = (canonical: CanonicalFiles) => { path: string; content: string }[];

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
): TargetCapabilities | undefined {
  const descriptor = getBuiltinTargetDefinition(target);
  if (!descriptor) return undefined;
  if (scope === 'global') {
    return descriptor.globalCapabilities ?? descriptor.capabilities;
  }
  return descriptor.capabilities;
}

export function getTargetDetectionPaths(
  target: string,
  scope: TargetLayoutScope = 'project',
): readonly string[] {
  const descriptor = getBuiltinTargetDefinition(target);
  if (!descriptor) return [];
  if (scope === 'global') {
    return descriptor.globalDetectionPaths ?? [];
  }
  return descriptor.detectionPaths;
}

export function getTargetLayout(
  target: string,
  scope: TargetLayoutScope = 'project',
): TargetLayout | undefined {
  const descriptor = getBuiltinTargetDefinition(target);
  if (!descriptor) return undefined;
  return scope === 'project' ? descriptor.project : descriptor.global;
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
  const baseLevel = getTargetCapabilities(target, scope)?.[feature] ?? 'none';
  if (baseLevel !== 'embedded') return baseLevel;
  const descriptor = getBuiltinTargetDefinition(target);
  if (feature === 'commands' && descriptor?.supportsConversion?.commands) {
    return shouldConvertCommandsToSkills(config, target) ? 'embedded' : 'none';
  }
  if (feature === 'agents' && descriptor?.supportsConversion?.agents) {
    return shouldConvertAgentsToSkills(config, target) ? 'embedded' : 'none';
  }
  return baseLevel;
}

export function resolveTargetFeatureGenerator(
  target: string,
  feature: TargetFeature,
  config?: ValidatedConfig,
): TargetGenerator | undefined {
  const descriptor = getBuiltinTargetDefinition(target);
  const generators = descriptor?.generators;
  if (!generators) return undefined;

  switch (feature) {
    case 'rules':
      return generators.generateRules;
    case 'commands':
      if (
        config &&
        descriptor?.supportsConversion?.commands &&
        !shouldConvertCommandsToSkills(config, target)
      ) {
        return undefined;
      }
      return generators.generateWorkflows ?? generators.generateCommands;
    case 'agents':
      if (
        config &&
        descriptor?.supportsConversion?.agents &&
        !shouldConvertAgentsToSkills(config, target)
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
    case 'settings':
      return generators.generateSettings;
  }
}

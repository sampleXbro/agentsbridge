import type { CanonicalFiles, SupportLevel } from '../../core/types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import {
  shouldConvertAgentsToSkills,
  shouldConvertCommandsToSkills,
} from '../../config/core/conversions.js';
import type { TargetCapabilities } from './target.interface.js';
import type { TargetDescriptor } from './target-descriptor.js';
import { TARGET_IDS, type BuiltinTargetId, isBuiltinTargetId } from './target-ids.js';
import { descriptor as claudeCode } from '../claude-code/index.js';
import { descriptor as cursor } from '../cursor/index.js';
import { descriptor as copilot } from '../copilot/index.js';
import { descriptor as continueTarget } from '../continue/index.js';
import { descriptor as junie } from '../junie/index.js';
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
  geminiCli,
  cline,
  codexCli,
  windsurf,
  antigravity,
  rooCode,
];

// Re-export from target-ids.ts for backward compatibility
export { TARGET_IDS, type BuiltinTargetId, isBuiltinTargetId };

export function getBuiltinTargetDefinition(target: string): TargetDescriptor | undefined {
  return BUILTIN_TARGETS.find((candidate) => candidate.id === target);
}

export function getTargetSkillDir(target: string): string | undefined {
  return getBuiltinTargetDefinition(target)?.skillDir;
}

export function getEffectiveTargetSupportLevel(
  target: string,
  feature: keyof TargetCapabilities,
  config: ValidatedConfig,
): SupportLevel {
  const definition = getBuiltinTargetDefinition(target);
  const baseLevel = definition?.capabilities[feature] ?? 'none';
  if (baseLevel !== 'embedded') return baseLevel;
  if (feature === 'commands' && target === 'codex-cli') {
    return shouldConvertCommandsToSkills(config, target) ? 'embedded' : 'none';
  }
  if (feature === 'agents' && (target === 'cline' || target === 'windsurf')) {
    return shouldConvertAgentsToSkills(config, target) ? 'embedded' : 'none';
  }
  return baseLevel;
}

export function resolveTargetFeatureGenerator(
  target: string,
  feature: TargetFeature,
  config?: ValidatedConfig,
): TargetGenerator | undefined {
  const generators = getBuiltinTargetDefinition(target)?.generators;
  if (!generators) return undefined;

  switch (feature) {
    case 'rules':
      return generators.generateRules;
    case 'commands':
      if (target === 'codex-cli' && config && !shouldConvertCommandsToSkills(config, target)) {
        return undefined;
      }
      return generators.generateWorkflows ?? generators.generateCommands;
    case 'agents':
      if (
        config &&
        (target === 'cline' || target === 'windsurf') &&
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

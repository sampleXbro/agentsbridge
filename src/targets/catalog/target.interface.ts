import type { CanonicalFiles, ImportResult, LintDiagnostic } from '../../core/types.js';
import type { TargetLayoutScope } from './target-descriptor.js';
import type { TargetCapabilityInput, TargetCapabilityValue } from './capabilities.js';

/**
 * Capabilities of a target tool — each feature has a level and optional serialization flavor.
 * String levels are accepted for authoring; `getTargetCapabilities` normalizes to objects.
 *
 * The matching `SupportLevel` union lives in `core/types.ts` (`'native' | 'embedded' |
 * 'partial' | 'none'`); every external consumer imports it from there.
 */
export type TargetCapabilities = Record<
  | 'rules'
  | 'additionalRules'
  | 'commands'
  | 'agents'
  | 'skills'
  | 'mcp'
  | 'hooks'
  | 'ignore'
  | 'permissions',
  TargetCapabilityInput
>;

/** Optional context passed to feature generators (flavor-aware targets). */
export interface GenerateFeatureContext {
  readonly capability: TargetCapabilityValue;
  readonly scope: TargetLayoutScope;
}

export type FeatureGeneratorOutput = { path: string; content: string };

export type FeatureGeneratorFn = (
  canonical: CanonicalFiles,
  ctx?: GenerateFeatureContext,
) => FeatureGeneratorOutput[];

/**
 * Per-feature generator contract matching engine.ts dispatch tables.
 * Each generator takes CanonicalFiles and returns file outputs.
 * Only generateRules and importFrom are required; all others are optional
 * because not every target supports every feature.
 */
export interface TargetGenerators {
  name: string;
  primaryRootInstructionPath?: string;
  generateRules: FeatureGeneratorFn;
  generateCommands?: FeatureGeneratorFn;
  generateAgents?: FeatureGeneratorFn;
  generateSkills?: FeatureGeneratorFn;
  generateMcp?: FeatureGeneratorFn;
  generatePermissions?: FeatureGeneratorFn;
  generateHooks?: FeatureGeneratorFn;
  generateIgnore?: FeatureGeneratorFn;
  importFrom(projectRoot: string, options?: { scope?: TargetLayoutScope }): Promise<ImportResult[]>;
  lint?(files: CanonicalFiles): LintDiagnostic[];
}

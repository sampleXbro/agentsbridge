import type {
  CanonicalFiles,
  GenerateResult,
  ImportResult,
  LintDiagnostic,
} from '../../core/types.js';
import type { ValidatedConfig } from '../../config/core/schema.js';
import type { TargetLayoutScope } from './target-descriptor.js';
import type { TargetCapabilityInput, TargetCapabilityValue } from './capabilities.js';

/** Feature support level for a given target */
export type SupportLevel = 'native' | 'embedded' | 'partial' | 'none';

/**
 * Capabilities of a target tool — each feature has a level and optional serialization flavor.
 * String levels are accepted for authoring; `getTargetCapabilities` normalizes to objects.
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

/** Context passed to generate() */
export interface GenerateContext {
  config: ValidatedConfig;
  canonical: CanonicalFiles;
  projectRoot: string;
  targetFilter?: string[];
}

/**
 * Interface that every target implementation satisfies.
 * Targets are implemented as standalone function modules rather than classes
 * (per project style: no classes unless stateful), but this interface documents
 * the expected shape for reference.
 */
export interface Target {
  /** Tool identifier, e.g. 'claude-code' */
  id: string;
  /** Human-readable tool name, e.g. 'Claude Code' */
  name: string;
  /** What this tool natively supports */
  capabilities: TargetCapabilities;
  /** Whether this tool supports project-scoped config */
  supportsProject: boolean;
  /** Whether this tool supports user-global config */
  supportsGlobal: boolean;

  /**
   * Generate tool-specific files from canonical sources.
   * @param ctx - Generate context (config, canonical files, project root)
   * @returns Array of file outputs with path and content
   */
  generate(ctx: GenerateContext): GenerateResult[];

  /**
   * Import tool-specific files into canonical .agentsmesh/ format.
   * @param projectRoot - Project root directory
   * @returns Array of import results describing what was imported
   */
  import(projectRoot: string): Promise<ImportResult[]>;

  /**
   * Validate canonical files against this target's constraints.
   * @param files - Canonical files to validate
   * @returns Array of lint diagnostics (errors and warnings)
   */
  lint(files: CanonicalFiles): LintDiagnostic[];
}

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
